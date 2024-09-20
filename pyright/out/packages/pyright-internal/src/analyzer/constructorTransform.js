"use strict";
/*
 * constructorTransform.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Code that transforms a newly-created object after a call to the
 * constructor is evaluated. It allows for special-case behavior that
 * cannot otherwise be described in the Python type system.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyConstructorTransform = exports.hasConstructorTransform = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const localize_1 = require("../localization/localize");
const constructors_1 = require("./constructors");
const parameterUtils_1 = require("./parameterUtils");
const symbol_1 = require("./symbol");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
function hasConstructorTransform(classType) {
    if (classType.details.fullName === 'functools.partial') {
        return true;
    }
    return false;
}
exports.hasConstructorTransform = hasConstructorTransform;
function applyConstructorTransform(evaluator, errorNode, argList, classType, result, signatureTracker) {
    if (classType.details.fullName === 'functools.partial') {
        return applyPartialTransform(evaluator, errorNode, argList, result, signatureTracker);
    }
    // By default, return the result unmodified.
    return result;
}
exports.applyConstructorTransform = applyConstructorTransform;
// Applies a transform for the functools.partial class constructor.
function applyPartialTransform(evaluator, errorNode, argList, result, signatureTracker) {
    // We assume that the normal return result is a functools.partial class instance.
    if (!(0, types_1.isClassInstance)(result.returnType) || result.returnType.details.fullName !== 'functools.partial') {
        return result;
    }
    const callMemberResult = (0, typeUtils_1.lookUpObjectMember)(result.returnType, '__call__', 16 /* MemberAccessFlags.SkipInstanceMembers */);
    if (!callMemberResult || !(0, types_1.isTypeSame)((0, typeUtils_1.convertToInstance)(callMemberResult.classType), result.returnType)) {
        return result;
    }
    const callMemberType = evaluator.getTypeOfMember(callMemberResult);
    if (!(0, types_1.isFunction)(callMemberType) || callMemberType.details.parameters.length < 1) {
        return result;
    }
    if (argList.length < 1) {
        return result;
    }
    const origFunctionTypeResult = evaluator.getTypeOfArgument(argList[0], 
    /* inferenceContext */ undefined, signatureTracker);
    let origFunctionType = origFunctionTypeResult.type;
    const origFunctionTypeConcrete = evaluator.makeTopLevelTypeVarsConcrete(origFunctionType);
    if ((0, types_1.isInstantiableClass)(origFunctionTypeConcrete)) {
        const constructor = (0, constructors_1.createFunctionFromConstructor)(evaluator, origFunctionTypeConcrete, (0, types_1.isTypeVar)(origFunctionType) ? (0, typeUtils_1.convertToInstance)(origFunctionType) : undefined);
        if (constructor) {
            origFunctionType = constructor;
        }
    }
    // Evaluate the inferred return type if necessary.
    evaluator.inferReturnTypeIfNecessary(origFunctionType);
    // We don't currently handle unpacked arguments.
    if (argList.some((arg) => arg.argumentCategory !== 0 /* ArgumentCategory.Simple */)) {
        return result;
    }
    // Make sure the first argument is a simple function.
    if ((0, types_1.isFunction)(origFunctionType)) {
        const transformResult = applyPartialTransformToFunction(evaluator, errorNode, argList, callMemberType, origFunctionType);
        if (!transformResult) {
            return result;
        }
        // Create a new copy of the functools.partial class that overrides the __call__ method.
        const newPartialClass = types_1.ClassType.cloneForSymbolTableUpdate(result.returnType);
        types_1.ClassType.getSymbolTable(newPartialClass).set('__call__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, transformResult.returnType));
        return {
            returnType: newPartialClass,
            isTypeIncomplete: result.isTypeIncomplete,
            argumentErrors: transformResult.argumentErrors,
        };
    }
    if ((0, types_1.isOverloadedFunction)(origFunctionType)) {
        const applicableOverloads = [];
        let sawArgErrors = false;
        // Apply the partial transform to each of the functions in the overload.
        types_1.OverloadedFunctionType.getOverloads(origFunctionType).forEach((overload) => {
            // Apply the transform to this overload, but don't report errors.
            const transformResult = applyPartialTransformToFunction(evaluator, 
            /* errorNode */ undefined, argList, callMemberType, overload);
            if (transformResult) {
                if (transformResult.argumentErrors) {
                    sawArgErrors = true;
                }
                else if ((0, types_1.isFunction)(transformResult.returnType)) {
                    applicableOverloads.push(transformResult.returnType);
                }
            }
        });
        if (applicableOverloads.length === 0) {
            if (sawArgErrors) {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.noOverload().format({
                    name: origFunctionType.overloads[0].details.name,
                }), errorNode);
            }
            return result;
        }
        // Create a new copy of the functools.partial class that overrides the __call__ method.
        const newPartialClass = types_1.ClassType.cloneForSymbolTableUpdate(result.returnType);
        let synthesizedCallType;
        if (applicableOverloads.length === 1) {
            synthesizedCallType = applicableOverloads[0];
        }
        else {
            synthesizedCallType = types_1.OverloadedFunctionType.create(
            // Set the "overloaded" flag for each of the __call__ overloads.
            applicableOverloads.map((overload) => types_1.FunctionType.cloneWithNewFlags(overload, overload.details.flags | 256 /* FunctionTypeFlags.Overloaded */)));
        }
        types_1.ClassType.getSymbolTable(newPartialClass).set('__call__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, synthesizedCallType));
        return {
            returnType: newPartialClass,
            isTypeIncomplete: result.isTypeIncomplete,
            argumentErrors: false,
        };
    }
    return result;
}
function applyPartialTransformToFunction(evaluator, errorNode, argList, partialCallMemberType, origFunctionType) {
    // Create a map to track which parameters have supplied arguments.
    const paramMap = new Map();
    const paramListDetails = (0, parameterUtils_1.getParameterListDetails)(origFunctionType);
    // Verify the types of the provided arguments.
    let argumentErrors = false;
    let reportedPositionalError = false;
    const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(origFunctionType));
    const remainingArgsList = argList.slice(1);
    remainingArgsList.forEach((arg, argIndex) => {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (!arg.valueExpression) {
            return;
        }
        // Is it a positional argument or a keyword argument?
        if (!arg.name) {
            // Does this positional argument map to a positional parameter?
            if (argIndex >= paramListDetails.params.length ||
                paramListDetails.params[argIndex].kind === parameterUtils_1.ParameterKind.Keyword) {
                if (paramListDetails.argsIndex !== undefined) {
                    const paramType = types_1.FunctionType.getEffectiveParameterType(origFunctionType, paramListDetails.params[paramListDetails.argsIndex].index);
                    const diag = new diagnostic_1.DiagnosticAddendum();
                    const argTypeResult = evaluator.getTypeOfExpression(arg.valueExpression, 
                    /* flags */ undefined, (0, typeUtils_1.makeInferenceContext)(paramType));
                    if (!evaluator.assignType(paramType, argTypeResult.type, diag, typeVarContext)) {
                        if (errorNode) {
                            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.argAssignmentParamFunction().format({
                                argType: evaluator.printType(argTypeResult.type),
                                paramType: evaluator.printType(paramType),
                                functionName: origFunctionType.details.name,
                                paramName: (_a = paramListDetails.params[paramListDetails.argsIndex].param.name) !== null && _a !== void 0 ? _a : '',
                            }), (_b = arg.valueExpression) !== null && _b !== void 0 ? _b : errorNode);
                        }
                        argumentErrors = true;
                    }
                }
                else {
                    // Don't report multiple positional errors.
                    if (!reportedPositionalError) {
                        if (errorNode) {
                            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, paramListDetails.positionParamCount === 1
                                ? localize_1.LocMessage.argPositionalExpectedOne()
                                : localize_1.LocMessage.argPositionalExpectedCount().format({
                                    expected: paramListDetails.positionParamCount,
                                }), (_c = arg.valueExpression) !== null && _c !== void 0 ? _c : errorNode);
                        }
                    }
                    reportedPositionalError = true;
                    argumentErrors = true;
                }
            }
            else {
                const paramType = types_1.FunctionType.getEffectiveParameterType(origFunctionType, argIndex);
                const diag = new diagnostic_1.DiagnosticAddendum();
                const paramName = (_d = paramListDetails.params[argIndex].param.name) !== null && _d !== void 0 ? _d : '';
                const argTypeResult = evaluator.getTypeOfExpression(arg.valueExpression, 
                /* flags */ undefined, (0, typeUtils_1.makeInferenceContext)(paramType));
                if (!evaluator.assignType(paramType, argTypeResult.type, diag, typeVarContext)) {
                    if (errorNode) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.argAssignmentParamFunction().format({
                            argType: evaluator.printType(argTypeResult.type),
                            paramType: evaluator.printType(paramType),
                            functionName: origFunctionType.details.name,
                            paramName,
                        }), (_e = arg.valueExpression) !== null && _e !== void 0 ? _e : errorNode);
                    }
                    argumentErrors = true;
                }
                // Mark the parameter as assigned.
                paramMap.set(paramName, false);
            }
        }
        else {
            const matchingParam = paramListDetails.params.find((paramInfo) => { var _a; return paramInfo.param.name === ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) && paramInfo.kind !== parameterUtils_1.ParameterKind.Positional; });
            if (!matchingParam) {
                // Is there a kwargs parameter?
                if (paramListDetails.kwargsIndex === undefined) {
                    if (errorNode) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.paramNameMissing().format({ name: arg.name.value }), arg.name);
                    }
                    argumentErrors = true;
                }
                else {
                    const paramType = types_1.FunctionType.getEffectiveParameterType(origFunctionType, paramListDetails.params[paramListDetails.kwargsIndex].index);
                    const diag = new diagnostic_1.DiagnosticAddendum();
                    const argTypeResult = evaluator.getTypeOfExpression(arg.valueExpression, 
                    /* flags */ undefined, (0, typeUtils_1.makeInferenceContext)(paramType));
                    if (!evaluator.assignType(paramType, argTypeResult.type, diag, typeVarContext)) {
                        if (errorNode) {
                            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.argAssignmentParamFunction().format({
                                argType: evaluator.printType(argTypeResult.type),
                                paramType: evaluator.printType(paramType),
                                functionName: origFunctionType.details.name,
                                paramName: (_f = paramListDetails.params[paramListDetails.kwargsIndex].param.name) !== null && _f !== void 0 ? _f : '',
                            }), (_g = arg.valueExpression) !== null && _g !== void 0 ? _g : errorNode);
                        }
                        argumentErrors = true;
                    }
                }
            }
            else {
                const paramName = matchingParam.param.name;
                const paramType = types_1.FunctionType.getEffectiveParameterType(origFunctionType, matchingParam.index);
                if (paramMap.has(paramName)) {
                    if (errorNode) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.paramAlreadyAssigned().format({ name: arg.name.value }), arg.name);
                    }
                    argumentErrors = true;
                }
                else {
                    const diag = new diagnostic_1.DiagnosticAddendum();
                    const argTypeResult = evaluator.getTypeOfExpression(arg.valueExpression, 
                    /* flags */ undefined, (0, typeUtils_1.makeInferenceContext)(paramType));
                    if (!evaluator.assignType(paramType, argTypeResult.type, diag, typeVarContext)) {
                        if (errorNode) {
                            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.argAssignmentParamFunction().format({
                                argType: evaluator.printType(argTypeResult.type),
                                paramType: evaluator.printType(paramType),
                                functionName: origFunctionType.details.name,
                                paramName,
                            }), (_h = arg.valueExpression) !== null && _h !== void 0 ? _h : errorNode);
                        }
                        argumentErrors = true;
                    }
                    paramMap.set(paramName, true);
                }
            }
        }
    });
    const specializedFunctionType = (0, typeUtils_1.applySolvedTypeVars)(origFunctionType, typeVarContext);
    if (!(0, types_1.isFunction)(specializedFunctionType)) {
        return undefined;
    }
    // Create a new parameter list that omits parameters that have been
    // populated already.
    const updatedParamList = specializedFunctionType.details.parameters.map((param, index) => {
        const specializedParam = { ...param };
        specializedParam.type = types_1.FunctionType.getEffectiveParameterType(specializedFunctionType, index);
        // If it's a keyword parameter that has been assigned a value through
        // the "partial" mechanism, mark it has having a default value.
        if (param.name && paramMap.get(param.name)) {
            specializedParam.hasDefault = true;
        }
        return specializedParam;
    });
    const unassignedParamList = updatedParamList.filter((param) => {
        if (param.category === 2 /* ParameterCategory.KwargsDict */) {
            return false;
        }
        if (param.category === 1 /* ParameterCategory.ArgsList */) {
            return true;
        }
        return !param.name || !paramMap.has(param.name);
    });
    const assignedKeywordParamList = updatedParamList.filter((param) => {
        return param.name && paramMap.get(param.name);
    });
    const kwargsParam = updatedParamList.filter((param) => {
        return param.category === 2 /* ParameterCategory.KwargsDict */;
    });
    const newParamList = [];
    (0, collectionUtils_1.appendArray)(newParamList, unassignedParamList);
    (0, collectionUtils_1.appendArray)(newParamList, assignedKeywordParamList);
    (0, collectionUtils_1.appendArray)(newParamList, kwargsParam);
    // Create a new __call__ method that uses the remaining parameters.
    const newCallMemberType = types_1.FunctionType.createInstance(partialCallMemberType.details.name, partialCallMemberType.details.fullName, partialCallMemberType.details.moduleName, partialCallMemberType.details.flags, specializedFunctionType.details.docString);
    if (partialCallMemberType.details.parameters.length > 0) {
        types_1.FunctionType.addParameter(newCallMemberType, partialCallMemberType.details.parameters[0]);
    }
    newParamList.forEach((param) => {
        types_1.FunctionType.addParameter(newCallMemberType, param);
    });
    newCallMemberType.details.declaredReturnType = specializedFunctionType.details.declaredReturnType
        ? types_1.FunctionType.getEffectiveReturnType(specializedFunctionType)
        : specializedFunctionType.inferredReturnType;
    newCallMemberType.details.declaration = partialCallMemberType.details.declaration;
    newCallMemberType.details.typeVarScopeId = specializedFunctionType.details.typeVarScopeId;
    return { returnType: newCallMemberType, isTypeIncomplete: false, argumentErrors };
}
//# sourceMappingURL=constructorTransform.js.map