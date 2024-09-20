"use strict";
/*
 * constructors.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides type evaluation logic for constructors. A constructor
 * in Python is implemented by a `__call__` method on the metaclass,
 * which is typically the `type` class. The default implementation
 * calls the `__new__` method on the class to allocate the object.
 * If the resulting object is an instance of the class, it then calls
 * the `__init__` method on the resulting object with the same arguments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFunctionFromConstructor = exports.validateConstructorArguments = exports.getBoundCallMethod = exports.getBoundInitMethod = exports.getBoundNewMethod = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const localize_1 = require("../localization/localize");
const constraintSolver_1 = require("./constraintSolver");
const constructorTransform_1 = require("./constructorTransform");
const parseTreeUtils_1 = require("./parseTreeUtils");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
const types_1 = require("./types");
// Fetches and binds the __new__ method from a class.
function getBoundNewMethod(evaluator, errorNode, type, diag = undefined, additionalFlags = 4 /* MemberAccessFlags.SkipObjectBaseClass */) {
    const flags = 32 /* MemberAccessFlags.SkipClassMembers */ |
        512 /* MemberAccessFlags.SkipAttributeAccessOverride */ |
        256 /* MemberAccessFlags.TreatConstructorAsClassMethod */ |
        additionalFlags;
    return evaluator.getTypeOfBoundMember(errorNode, type, '__new__', { method: 'get' }, diag, flags);
}
exports.getBoundNewMethod = getBoundNewMethod;
// Fetches and binds the __init__ method from a class instance.
function getBoundInitMethod(evaluator, errorNode, type, diag = undefined, additionalFlags = 4 /* MemberAccessFlags.SkipObjectBaseClass */) {
    const flags = 16 /* MemberAccessFlags.SkipInstanceMembers */ | 512 /* MemberAccessFlags.SkipAttributeAccessOverride */ | additionalFlags;
    return evaluator.getTypeOfBoundMember(errorNode, type, '__init__', { method: 'get' }, diag, flags);
}
exports.getBoundInitMethod = getBoundInitMethod;
// Fetches and binds the __call__ method from a class or its metaclass.
function getBoundCallMethod(evaluator, errorNode, type) {
    return evaluator.getTypeOfBoundMember(errorNode, type, '__call__', { method: 'get' }, 
    /* diag */ undefined, 16 /* MemberAccessFlags.SkipInstanceMembers */ |
        8 /* MemberAccessFlags.SkipTypeBaseClass */ |
        512 /* MemberAccessFlags.SkipAttributeAccessOverride */);
}
exports.getBoundCallMethod = getBoundCallMethod;
// Matches the arguments of a call to the constructor for a class.
// If successful, it returns the resulting (specialized) object type that
// is allocated by the constructor. If unsuccessful, it reports diagnostics.
function validateConstructorArguments(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker) {
    var _a, _b;
    // If this is an unspecialized generic type alias, specialize it now
    // using default type argument values.
    if (((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.typeParameters) && !type.typeAliasInfo.typeArguments) {
        const typeAliasTypeVarContext = new typeVarContext_1.TypeVarContext(type.typeAliasInfo.typeVarScopeId);
        type = (0, typeUtils_1.applySolvedTypeVars)(type, typeAliasTypeVarContext, { unknownIfNotFound: true });
    }
    const metaclassResult = validateMetaclassCall(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker);
    if (metaclassResult) {
        const metaclassReturnType = (_b = metaclassResult.returnType) !== null && _b !== void 0 ? _b : types_1.UnknownType.create();
        // If there a custom `__call__` method on the metaclass that returns
        // something other than an instance of the class, assume that it
        // overrides the normal `type.__call__` logic and don't perform the usual
        // __new__ and __init__ validation.
        if (metaclassResult.argumentErrors || shouldSkipNewAndInitEvaluation(evaluator, type, metaclassReturnType)) {
            return metaclassResult;
        }
    }
    // Determine whether the class overrides the object.__new__ method.
    const newMethodDiag = new diagnostic_1.DiagnosticAddendum();
    const newMethodTypeResult = getBoundNewMethod(evaluator, errorNode, type, newMethodDiag);
    if (newMethodTypeResult === null || newMethodTypeResult === void 0 ? void 0 : newMethodTypeResult.typeErrors) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, newMethodDiag.getString(), errorNode);
    }
    const useConstructorTransform = (0, constructorTransform_1.hasConstructorTransform)(type);
    // If there is a constructor transform, evaluate all arguments speculatively
    // so we can later re-evaluate them in the context of the transform.
    const returnResult = evaluator.useSpeculativeMode(useConstructorTransform ? errorNode : undefined, () => {
        return validateNewAndInitMethods(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker, newMethodTypeResult);
    });
    let validatedArgExpressions = !useConstructorTransform || returnResult.argumentErrors;
    // Apply a constructor transform if applicable.
    if (useConstructorTransform) {
        if (returnResult.argumentErrors) {
            // If there were errors when validating the __new__ and __init__ methods,
            // we need to re-evaluate the arguments to generate error messages because
            // we previously evaluated them speculatively.
            validateNewAndInitMethods(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker, newMethodTypeResult);
            validatedArgExpressions = true;
        }
        else if (returnResult.returnType) {
            const transformed = (0, constructorTransform_1.applyConstructorTransform)(evaluator, errorNode, argList, type, {
                argumentErrors: !!returnResult.argumentErrors,
                returnType: returnResult.returnType,
                isTypeIncomplete: !!returnResult.isTypeIncomplete,
            }, signatureTracker);
            returnResult.returnType = transformed.returnType;
            if (transformed.isTypeIncomplete) {
                returnResult.isTypeIncomplete = true;
            }
            if (transformed.argumentErrors) {
                returnResult.argumentErrors = true;
            }
            validatedArgExpressions = true;
        }
    }
    // If we weren't able to validate the args, analyze the expressions here
    // to mark symbols referenced and report expression evaluation errors.
    if (!validatedArgExpressions) {
        argList.forEach((arg) => {
            if (arg.valueExpression && !evaluator.isSpeculativeModeInUse(arg.valueExpression)) {
                evaluator.getTypeOfExpression(arg.valueExpression);
            }
        });
    }
    return returnResult;
}
exports.validateConstructorArguments = validateConstructorArguments;
function validateNewAndInitMethods(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker, newMethodTypeResult) {
    var _a, _b;
    let returnType;
    let validatedArgExpressions = false;
    let argumentErrors = false;
    let isTypeIncomplete = false;
    const overloadsUsedForCall = [];
    let newMethodReturnType;
    // Validate __new__ if it is present.
    if (newMethodTypeResult) {
        // Use speculative mode for arg expressions because we don't know whether
        // we'll need to re-evaluate these expressions later for __init__.
        const newCallResult = validateNewMethod(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker, newMethodTypeResult, 
        /* useSpeculativeModeForArgs */ true);
        if (newCallResult.argumentErrors) {
            argumentErrors = true;
        }
        else {
            (0, collectionUtils_1.appendArray)(overloadsUsedForCall, (_a = newCallResult.overloadsUsedForCall) !== null && _a !== void 0 ? _a : []);
        }
        if (newCallResult.isTypeIncomplete) {
            isTypeIncomplete = true;
        }
        newMethodReturnType = newCallResult.returnType;
    }
    if (!newMethodReturnType || isDefaultNewMethod(newMethodTypeResult === null || newMethodTypeResult === void 0 ? void 0 : newMethodTypeResult.type)) {
        // If there is no __new__ method or it uses a default signature,
        // (cls, *args, **kwargs) -> Self, allow the __init__ method to
        // determine the specialized type of the class.
        newMethodReturnType = types_1.ClassType.cloneAsInstance(type);
    }
    else if ((0, types_1.isAnyOrUnknown)(newMethodReturnType)) {
        // If the __new__ method returns Any or Unknown, we'll ignore its return
        // type and assume that it returns Self.
        newMethodReturnType = (0, typeUtils_1.applySolvedTypeVars)(types_1.ClassType.cloneAsInstance(type), new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(type)), { unknownIfNotFound: true, tupleClassType: evaluator.getTupleClassType() });
    }
    let initMethodTypeResult;
    // If there were errors evaluating the __new__ method, assume that __new__
    // returns the class instance and proceed accordingly. This may produce
    // false positives in some cases, but it will prevent false negatives
    // if the __init__ method also produces type errors (perhaps unrelated
    // to the errors in the __new__ method).
    if (argumentErrors) {
        initMethodTypeResult = { type: (0, typeUtils_1.convertToInstance)(type) };
    }
    // Validate __init__ if it's present.
    if (!(0, types_1.isNever)(newMethodReturnType) &&
        !shouldSkipInitEvaluation(evaluator, type, newMethodReturnType) &&
        (0, types_1.isClassInstance)(newMethodReturnType)) {
        // If the __new__ method returned the same type as the class it's constructing
        // but didn't supply solved type arguments, we'll ignore its specialized return
        // type and rely on the __init__ method to supply the type arguments instead.
        let initMethodBindToType = newMethodReturnType;
        if (initMethodBindToType.typeArguments &&
            initMethodBindToType.typeArguments.some((typeArg) => (0, types_1.isUnknown)(typeArg))) {
            initMethodBindToType = types_1.ClassType.cloneAsInstance(type);
        }
        // Determine whether the class overrides the object.__init__ method.
        const initMethodDiag = new diagnostic_1.DiagnosticAddendum();
        initMethodTypeResult = getBoundInitMethod(evaluator, errorNode, initMethodBindToType, initMethodDiag);
        if (initMethodTypeResult === null || initMethodTypeResult === void 0 ? void 0 : initMethodTypeResult.typeErrors) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, initMethodDiag.getString(), errorNode);
        }
        // Validate __init__ if it's present.
        if (initMethodTypeResult) {
            const initCallResult = validateInitMethod(evaluator, errorNode, argList, initMethodBindToType, skipUnknownArgCheck, inferenceContext, signatureTracker, initMethodTypeResult.type);
            if (initCallResult.argumentErrors) {
                argumentErrors = true;
            }
            else if (initCallResult.overloadsUsedForCall) {
                overloadsUsedForCall.push(...initCallResult.overloadsUsedForCall);
            }
            if (initCallResult.isTypeIncomplete) {
                isTypeIncomplete = true;
            }
            returnType = initCallResult.returnType;
            validatedArgExpressions = true;
            skipUnknownArgCheck = true;
        }
    }
    if (!validatedArgExpressions && newMethodTypeResult) {
        // If we skipped the __init__ method and the __new__ method was evaluated only
        // speculatively, evaluate it non-speculatively now so we can report errors.
        if (!evaluator.isSpeculativeModeInUse(errorNode)) {
            validateNewMethod(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker, newMethodTypeResult, 
            /* useSpeculativeModeForArgs */ false);
        }
        validatedArgExpressions = true;
        returnType = newMethodReturnType;
    }
    // If the class doesn't override object.__new__ or object.__init__, use the
    // fallback constructor type evaluation for the `object` class.
    if (!newMethodTypeResult && !initMethodTypeResult) {
        const callResult = validateFallbackConstructorCall(evaluator, errorNode, argList, type, inferenceContext);
        if (callResult.argumentErrors) {
            argumentErrors = true;
        }
        else if (callResult.overloadsUsedForCall) {
            (0, collectionUtils_1.appendArray)(overloadsUsedForCall, callResult.overloadsUsedForCall);
        }
        if (callResult.isTypeIncomplete) {
            isTypeIncomplete = true;
        }
        returnType = (_b = callResult.returnType) !== null && _b !== void 0 ? _b : types_1.UnknownType.create();
    }
    return { argumentErrors, returnType, isTypeIncomplete, overloadsUsedForCall };
}
// Evaluates the __new__ method for type correctness. If useSpeculativeModeForArgs
// is true, use speculative mode to evaluate the arguments (unless an argument
// error is produced, in which case it's OK to use speculative mode).
function validateNewMethod(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker, newMethodTypeResult, useSpeculativeModeForArgs) {
    let newReturnType;
    let isTypeIncomplete = false;
    let argumentErrors = false;
    const overloadsUsedForCall = [];
    if (signatureTracker) {
        newMethodTypeResult.type = (0, typeUtils_1.ensureFunctionSignaturesAreUnique)(newMethodTypeResult.type, signatureTracker, errorNode.start);
    }
    const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(type));
    typeVarContext.addSolveForScope((0, typeUtils_1.getTypeVarScopeId)(newMethodTypeResult.type));
    const callResult = evaluator.useSpeculativeMode(useSpeculativeModeForArgs ? errorNode : undefined, () => {
        return evaluator.validateCallArguments(errorNode, argList, newMethodTypeResult, typeVarContext, skipUnknownArgCheck, inferenceContext, signatureTracker);
    });
    if (callResult.isTypeIncomplete) {
        isTypeIncomplete = true;
    }
    if (callResult.argumentErrors) {
        argumentErrors = true;
        // Evaluate the arguments in a non-speculative manner to generate any diagnostics.
        typeVarContext.unlock();
        evaluator.validateCallArguments(errorNode, argList, newMethodTypeResult, typeVarContext, skipUnknownArgCheck, inferenceContext, signatureTracker);
    }
    else {
        newReturnType = callResult.returnType;
        if (overloadsUsedForCall.length === 0 && callResult.overloadsUsedForCall) {
            overloadsUsedForCall.push(...callResult.overloadsUsedForCall);
        }
    }
    if (newReturnType) {
        // Special-case the 'tuple' type specialization to use the homogenous
        // arbitrary-length form.
        if ((0, types_1.isClassInstance)(newReturnType) && (0, typeUtils_1.isTupleClass)(newReturnType) && !newReturnType.tupleTypeArguments) {
            if (newReturnType.typeArguments && newReturnType.typeArguments.length === 1) {
                newReturnType = (0, typeUtils_1.specializeTupleClass)(newReturnType, [
                    { type: newReturnType.typeArguments[0], isUnbounded: true },
                ]);
            }
            newReturnType = applyExpectedTypeForTupleConstructor(newReturnType, inferenceContext);
        }
    }
    else {
        newReturnType = applyExpectedTypeForConstructor(evaluator, type, inferenceContext, typeVarContext);
    }
    return { argumentErrors, returnType: newReturnType, isTypeIncomplete, overloadsUsedForCall };
}
function validateInitMethod(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker, initMethodType) {
    let returnType;
    let isTypeIncomplete = false;
    let argumentErrors = false;
    const overloadsUsedForCall = [];
    if (signatureTracker) {
        initMethodType = (0, typeUtils_1.ensureFunctionSignaturesAreUnique)(initMethodType, signatureTracker, errorNode.start);
    }
    // If there is an expected type, analyze the __init__ call for each of the
    // subtypes that comprise the expected type. If one or more analyzes with no
    // errors, use those results. This requires special-case processing because
    // the __init__ method doesn't return the expected type. It always
    // returns None.
    if (inferenceContext) {
        let foundWorkingExpectedType = false;
        returnType = (0, typeUtils_1.mapSubtypes)(inferenceContext.expectedType, (expectedSubType) => {
            // If we've already successfully evaluated the __init__ method with
            // one expected type, ignore the remaining ones.
            if (foundWorkingExpectedType) {
                return undefined;
            }
            expectedSubType = (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(expectedSubType);
            // If the expected type is the same type as the class and the class
            // is already explicitly specialized, don't override the explicit
            // specialization.
            if ((0, types_1.isClassInstance)(expectedSubType) &&
                types_1.ClassType.isSameGenericClass(type, expectedSubType) &&
                type.typeArguments) {
                return undefined;
            }
            const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(type));
            typeVarContext.addSolveForScope((0, typeUtils_1.getTypeVarScopeId)(initMethodType));
            if (!(0, constraintSolver_1.addConstraintsForExpectedType)(evaluator, types_1.ClassType.cloneAsInstance(type), expectedSubType, typeVarContext, (0, parseTreeUtils_1.getTypeVarScopesForNode)(errorNode), errorNode.start)) {
                return undefined;
            }
            const specializedConstructor = (0, typeUtils_1.applySolvedTypeVars)(initMethodType, typeVarContext);
            let callResult;
            callResult = evaluator.useSpeculativeMode(errorNode, () => {
                return evaluator.validateCallArguments(errorNode, argList, { type: specializedConstructor }, typeVarContext.clone(), skipUnknownArgCheck, 
                /* inferenceContext */ undefined, signatureTracker);
            });
            if (callResult.argumentErrors) {
                return undefined;
            }
            // Call validateCallArguments again, this time without speculative
            // mode, so any errors are reported.
            callResult = evaluator.validateCallArguments(errorNode, argList, { type: specializedConstructor }, typeVarContext, skipUnknownArgCheck, 
            /* inferenceContext */ undefined, signatureTracker);
            if (callResult.isTypeIncomplete) {
                isTypeIncomplete = true;
            }
            if (callResult.argumentErrors) {
                argumentErrors = true;
            }
            if (callResult.overloadsUsedForCall) {
                (0, collectionUtils_1.appendArray)(overloadsUsedForCall, callResult.overloadsUsedForCall);
            }
            // Note that we've found an expected type that works.
            foundWorkingExpectedType = true;
            return applyExpectedSubtypeForConstructor(evaluator, type, expectedSubType, typeVarContext);
        }, 
        /* sortSubtypes */ true);
        if ((0, types_1.isNever)(returnType) || argumentErrors) {
            returnType = undefined;
        }
    }
    if (!returnType) {
        const typeVarContext = type.typeArguments
            ? (0, typeUtils_1.buildTypeVarContextFromSpecializedClass)(type)
            : new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(type));
        typeVarContext.addSolveForScope((0, typeUtils_1.getTypeVarScopeId)(initMethodType));
        const callResult = evaluator.validateCallArguments(errorNode, argList, { type: initMethodType }, typeVarContext, skipUnknownArgCheck, 
        /* inferenceContext */ undefined, signatureTracker);
        let adjustedClassType = type;
        if (callResult.specializedInitSelfType &&
            (0, types_1.isClassInstance)(callResult.specializedInitSelfType) &&
            types_1.ClassType.isSameGenericClass(callResult.specializedInitSelfType, adjustedClassType)) {
            adjustedClassType = types_1.ClassType.cloneAsInstantiable(callResult.specializedInitSelfType);
        }
        returnType = applyExpectedTypeForConstructor(evaluator, adjustedClassType, 
        /* inferenceContext */ undefined, typeVarContext);
        if (callResult.isTypeIncomplete) {
            isTypeIncomplete = true;
        }
        if (callResult.argumentErrors) {
            argumentErrors = true;
        }
        else if (callResult.overloadsUsedForCall) {
            overloadsUsedForCall.push(...callResult.overloadsUsedForCall);
        }
    }
    return { argumentErrors, returnType, isTypeIncomplete, overloadsUsedForCall };
}
function validateFallbackConstructorCall(evaluator, errorNode, argList, type, inferenceContext) {
    let reportedErrors = false;
    // It's OK if the argument list consists only of `*args` and `**kwargs`.
    if (argList.length > 0 && argList.some((arg) => arg.argumentCategory === 0 /* ArgumentCategory.Simple */)) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.constructorNoArgs().format({ type: type.aliasName || type.details.name }), errorNode);
        reportedErrors = true;
    }
    if (!inferenceContext && type.typeArguments) {
        // If there was no expected type but the type was already specialized,
        // assume that we're constructing an instance of the specialized type.
        return {
            argumentErrors: reportedErrors,
            overloadsUsedForCall: [],
            returnType: (0, typeUtils_1.convertToInstance)(type),
        };
    }
    // Do our best to specialize the instantiated class based on the expected
    // type if provided.
    const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(type));
    if (inferenceContext) {
        let expectedType = inferenceContext.expectedType;
        // If the expectedType is a union, try to pick one that is likely to
        // be the best choice.
        if ((0, types_1.isUnion)(expectedType)) {
            expectedType = (0, types_1.findSubtype)(expectedType, (subtype) => {
                if ((0, types_1.isAnyOrUnknown)(subtype) || (0, types_1.isNever)(subtype)) {
                    return false;
                }
                if ((0, types_1.isClass)(subtype) && evaluator.assignType(subtype, types_1.ClassType.cloneAsInstance(type))) {
                    return true;
                }
                return false;
            });
        }
        if (expectedType) {
            (0, constraintSolver_1.addConstraintsForExpectedType)(evaluator, types_1.ClassType.cloneAsInstance(type), expectedType, typeVarContext, (0, parseTreeUtils_1.getTypeVarScopesForNode)(errorNode), errorNode.start);
        }
    }
    return {
        argumentErrors: reportedErrors,
        overloadsUsedForCall: [],
        returnType: applyExpectedTypeForConstructor(evaluator, type, inferenceContext, typeVarContext),
    };
}
function validateMetaclassCall(evaluator, errorNode, argList, type, skipUnknownArgCheck, inferenceContext, signatureTracker) {
    const metaclassCallMethodInfo = getBoundCallMethod(evaluator, errorNode, type);
    if (!metaclassCallMethodInfo) {
        return undefined;
    }
    const callResult = evaluator.validateCallArguments(errorNode, argList, metaclassCallMethodInfo, 
    /* typeVarContext */ undefined, skipUnknownArgCheck, inferenceContext, signatureTracker);
    // If the return type is unannotated, don't use the inferred return type.
    const callType = metaclassCallMethodInfo.type;
    if ((0, types_1.isFunction)(callType) && !callType.details.declaredReturnType) {
        return undefined;
    }
    // If the return type is unknown, ignore it.
    if (callResult.returnType && (0, types_1.isUnknown)(callResult.returnType)) {
        return undefined;
    }
    return callResult;
}
function applyExpectedSubtypeForConstructor(evaluator, type, expectedSubtype, typeVarContext) {
    const specializedType = (0, typeUtils_1.applySolvedTypeVars)(types_1.ClassType.cloneAsInstance(type), typeVarContext, {
        applyInScopePlaceholders: true,
    });
    if (!evaluator.assignType(expectedSubtype, specializedType)) {
        return undefined;
    }
    // If the expected type is "Any", transform it to an Any.
    if ((0, types_1.isAny)(expectedSubtype)) {
        return expectedSubtype;
    }
    return specializedType;
}
// Handles the case where a constructor is a generic type and the type
// arguments are not specified but can be provided by the expected type.
function applyExpectedTypeForConstructor(evaluator, type, inferenceContext, typeVarContext) {
    let unsolvedTypeVarsAreUnknown = true;
    // If this isn't a generic type or it's a type that has already been
    // explicitly specialized, the expected type isn't applicable.
    if (type.details.typeParameters.length === 0 || type.typeArguments) {
        return (0, typeUtils_1.applySolvedTypeVars)(types_1.ClassType.cloneAsInstance(type), typeVarContext, { applyInScopePlaceholders: true });
    }
    if (inferenceContext) {
        const specializedExpectedType = (0, typeUtils_1.mapSubtypes)(inferenceContext.expectedType, (expectedSubtype) => {
            return applyExpectedSubtypeForConstructor(evaluator, type, expectedSubtype, typeVarContext);
        });
        if (!(0, types_1.isNever)(specializedExpectedType)) {
            return specializedExpectedType;
        }
        // If the expected type didn't provide TypeVar values, remaining
        // unsolved TypeVars should be considered Unknown unless they were
        // provided explicitly in the constructor call.
        if (type.typeArguments) {
            unsolvedTypeVarsAreUnknown = false;
        }
    }
    const specializedType = (0, typeUtils_1.applySolvedTypeVars)(type, typeVarContext, {
        unknownIfNotFound: unsolvedTypeVarsAreUnknown,
        tupleClassType: evaluator.getTupleClassType(),
    });
    return types_1.ClassType.cloneAsInstance(specializedType);
}
// Similar to applyExpectedTypeForConstructor, this function handles the
// special case of the tuple class.
function applyExpectedTypeForTupleConstructor(type, inferenceContext) {
    let specializedType = type;
    if (inferenceContext &&
        (0, types_1.isClassInstance)(inferenceContext.expectedType) &&
        (0, typeUtils_1.isTupleClass)(inferenceContext.expectedType) &&
        inferenceContext.expectedType.tupleTypeArguments) {
        specializedType = (0, typeUtils_1.specializeTupleClass)(type, inferenceContext.expectedType.tupleTypeArguments);
    }
    return specializedType;
}
// Synthesize a function that represents the constructor for this class
// taking into consideration the __init__ and __new__ methods.
function createFunctionFromConstructor(evaluator, classType, selfType = undefined, recursionCount = 0) {
    const fromMetaclassCall = createFunctionFromMetaclassCall(evaluator, classType, recursionCount);
    if (fromMetaclassCall) {
        return fromMetaclassCall;
    }
    const fromNew = createFunctionFromNewMethod(evaluator, classType, selfType, recursionCount);
    if (fromNew) {
        let skipInitMethod = false;
        (0, typeUtils_1.doForEachSignature)(fromNew, (signature) => {
            const newMethodReturnType = types_1.FunctionType.getEffectiveReturnType(signature);
            if (newMethodReturnType && shouldSkipInitEvaluation(evaluator, classType, newMethodReturnType)) {
                skipInitMethod = true;
            }
        });
        if (skipInitMethod) {
            return fromNew;
        }
    }
    const fromInit = createFunctionFromInitMethod(evaluator, classType, selfType, recursionCount);
    // If there is both a __new__ and __init__ method, return a union
    // comprised of both resulting function types.
    if (fromNew && fromInit) {
        return (0, types_1.combineTypes)([fromInit, fromNew]);
    }
    if (fromNew || fromInit) {
        return fromNew !== null && fromNew !== void 0 ? fromNew : fromInit;
    }
    return fromNew !== null && fromNew !== void 0 ? fromNew : createFunctionFromObjectNewMethod(classType);
}
exports.createFunctionFromConstructor = createFunctionFromConstructor;
function createFunctionFromMetaclassCall(evaluator, classType, recursionCount) {
    const metaclass = classType.details.effectiveMetaclass;
    if (!metaclass || !(0, types_1.isClass)(metaclass)) {
        return undefined;
    }
    const callInfo = (0, typeUtils_1.lookUpClassMember)(metaclass, '__call__', 16 /* MemberAccessFlags.SkipInstanceMembers */ |
        8 /* MemberAccessFlags.SkipTypeBaseClass */ |
        512 /* MemberAccessFlags.SkipAttributeAccessOverride */);
    if (!callInfo) {
        return undefined;
    }
    const callType = evaluator.getTypeOfMember(callInfo);
    if (!(0, types_1.isFunction)(callType) && !(0, types_1.isOverloadedFunction)(callType)) {
        return undefined;
    }
    const boundCallType = evaluator.bindFunctionToClassOrObject(classType, callType, callInfo && (0, types_1.isInstantiableClass)(callInfo.classType) ? callInfo.classType : undefined, 
    /* treatConstructorAsClassMethod */ false, types_1.ClassType.cloneAsInstantiable(classType), 
    /* diag */ undefined, recursionCount);
    if (!boundCallType) {
        return undefined;
    }
    let useMetaclassCall = false;
    // Look at the signatures of all the __call__ methods to determine whether
    // any of them returns something other than the instance of the class being
    // constructed.
    (0, typeUtils_1.doForEachSignature)(boundCallType, (signature) => {
        if (signature.details.declaredReturnType) {
            const returnType = types_1.FunctionType.getEffectiveReturnType(signature);
            if (returnType && shouldSkipNewAndInitEvaluation(evaluator, classType, returnType)) {
                useMetaclassCall = true;
            }
        }
    });
    return useMetaclassCall ? boundCallType : undefined;
}
function createFunctionFromNewMethod(evaluator, classType, selfType, recursionCount) {
    const newInfo = (0, typeUtils_1.lookUpClassMember)(classType, '__new__', 16 /* MemberAccessFlags.SkipInstanceMembers */ |
        512 /* MemberAccessFlags.SkipAttributeAccessOverride */ |
        4 /* MemberAccessFlags.SkipObjectBaseClass */);
    if (!newInfo) {
        return undefined;
    }
    const newType = evaluator.getTypeOfMember(newInfo);
    const convertNewToConstructor = (newSubtype) => {
        // If there are no parameters that include class-scoped type parameters,
        // self-specialize the class because the type arguments for the class
        // can't be solved if there are no parameters to supply them.
        const hasParametersWithTypeVars = newSubtype.details.parameters.some((param, index) => {
            if (index === 0 || !param.name) {
                return false;
            }
            const paramType = types_1.FunctionType.getEffectiveParameterType(newSubtype, index);
            const typeVars = (0, typeUtils_1.getTypeVarArgumentsRecursive)(paramType);
            return typeVars.some((typeVar) => typeVar.scopeId === (0, typeUtils_1.getTypeVarScopeId)(classType));
        });
        const boundNew = evaluator.bindFunctionToClassOrObject(hasParametersWithTypeVars ? (0, typeUtils_1.selfSpecializeClass)(classType) : classType, newSubtype, newInfo && (0, types_1.isInstantiableClass)(newInfo.classType) ? newInfo.classType : undefined, 
        /* treatConstructorAsClassMethod */ true, selfType, 
        /* diag */ undefined, recursionCount);
        if (!boundNew) {
            return undefined;
        }
        const convertedNew = types_1.FunctionType.clone(boundNew);
        convertedNew.details.typeVarScopeId = newSubtype.details.typeVarScopeId;
        if (!convertedNew.details.docString && classType.details.docString) {
            convertedNew.details.docString = classType.details.docString;
        }
        convertedNew.details.flags &= ~(4 /* FunctionTypeFlags.StaticMethod */ | 1 /* FunctionTypeFlags.ConstructorMethod */);
        convertedNew.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
        return convertedNew;
    };
    if ((0, types_1.isFunction)(newType)) {
        return convertNewToConstructor(newType);
    }
    if (!(0, types_1.isOverloadedFunction)(newType)) {
        return undefined;
    }
    const newOverloads = [];
    newType.overloads.forEach((overload) => {
        const converted = convertNewToConstructor(overload);
        if (converted) {
            newOverloads.push(converted);
        }
    });
    if (newOverloads.length === 0) {
        return undefined;
    }
    if (newOverloads.length === 1) {
        return newOverloads[0];
    }
    return types_1.OverloadedFunctionType.create(newOverloads);
}
function createFunctionFromObjectNewMethod(classType) {
    // Return a fallback constructor based on the object.__new__ method.
    const constructorFunction = types_1.FunctionType.createSynthesizedInstance('__new__', 0 /* FunctionTypeFlags.None */);
    constructorFunction.details.declaredReturnType = types_1.ClassType.cloneAsInstance(classType);
    // If this is type[T] or a protocol, we don't know what parameters are accepted
    // by the constructor, so add the default parameters.
    if (classType.includeSubclasses || types_1.ClassType.isProtocolClass(classType)) {
        types_1.FunctionType.addDefaultParameters(constructorFunction);
    }
    if (!constructorFunction.details.docString && classType.details.docString) {
        constructorFunction.details.docString = classType.details.docString;
    }
    return constructorFunction;
}
function createFunctionFromInitMethod(evaluator, classType, selfType, recursionCount) {
    // Use the __init__ method if available. It's usually more detailed.
    const initInfo = (0, typeUtils_1.lookUpClassMember)(classType, '__init__', 16 /* MemberAccessFlags.SkipInstanceMembers */ |
        512 /* MemberAccessFlags.SkipAttributeAccessOverride */ |
        4 /* MemberAccessFlags.SkipObjectBaseClass */);
    if (!initInfo) {
        return undefined;
    }
    const initType = evaluator.getTypeOfMember(initInfo);
    const objectType = types_1.ClassType.cloneAsInstance(classType);
    function convertInitToConstructor(initSubtype) {
        var _a;
        const boundInit = evaluator.bindFunctionToClassOrObject(objectType, initSubtype, initInfo && (0, types_1.isInstantiableClass)(initInfo.classType) ? initInfo.classType : undefined, 
        /* treatConstructorAsClassMethod */ undefined, selfType, 
        /* diag */ undefined, recursionCount);
        if (!boundInit) {
            return undefined;
        }
        const convertedInit = types_1.FunctionType.clone(boundInit);
        let returnType = selfType;
        if (!returnType) {
            returnType = objectType;
            // If this is a generic type, self-specialize the class (i.e. fill in
            // its own type parameters as type arguments).
            if (objectType.details.typeParameters.length > 0 && !objectType.typeArguments) {
                const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeIds)(objectType));
                // If a TypeVar is not used in any of the parameter types, it should take
                // on its default value (typically Unknown) in the resulting specialized type.
                const typeVarsInParams = [];
                convertedInit.details.parameters.forEach((param, index) => {
                    const paramType = types_1.FunctionType.getEffectiveParameterType(convertedInit, index);
                    (0, typeUtils_1.addTypeVarsToListIfUnique)(typeVarsInParams, (0, typeUtils_1.getTypeVarArgumentsRecursive)(paramType));
                });
                typeVarsInParams.forEach((typeVar) => {
                    if ((0, types_1.isParamSpec)(typeVar)) {
                        typeVarContext.setTypeVarType(typeVar, (0, typeUtils_1.convertTypeToParamSpecValue)(typeVar));
                    }
                    else {
                        typeVarContext.setTypeVarType(typeVar, typeVar);
                    }
                });
                returnType = (0, typeUtils_1.applySolvedTypeVars)(objectType, typeVarContext, {
                    unknownIfNotFound: true,
                    tupleClassType: evaluator.getTupleClassType(),
                });
            }
        }
        convertedInit.details.declaredReturnType = (_a = boundInit.strippedFirstParamType) !== null && _a !== void 0 ? _a : returnType;
        if (convertedInit.specializedTypes) {
            convertedInit.specializedTypes.returnType = returnType;
        }
        if (!convertedInit.details.docString && classType.details.docString) {
            convertedInit.details.docString = classType.details.docString;
        }
        convertedInit.details.flags &= ~4 /* FunctionTypeFlags.StaticMethod */;
        convertedInit.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
        return convertedInit;
    }
    if ((0, types_1.isFunction)(initType)) {
        return convertInitToConstructor(initType);
    }
    if (!(0, types_1.isOverloadedFunction)(initType)) {
        return undefined;
    }
    const initOverloads = [];
    initType.overloads.forEach((overload) => {
        const converted = convertInitToConstructor(overload);
        if (converted) {
            initOverloads.push(converted);
        }
    });
    if (initOverloads.length === 0) {
        return undefined;
    }
    if (initOverloads.length === 1) {
        return initOverloads[0];
    }
    return types_1.OverloadedFunctionType.create(initOverloads);
}
// If the __call__ method returns a type that is not an instance of the class,
// skip the __new__ and __init__ method evaluation.
function shouldSkipNewAndInitEvaluation(evaluator, classType, callMethodReturnType) {
    if (!evaluator.assignType((0, typeUtils_1.convertToInstance)(classType), callMethodReturnType) ||
        (0, types_1.isNever)(callMethodReturnType) ||
        (0, types_1.findSubtype)(callMethodReturnType, (subtype) => (0, types_1.isAny)(subtype))) {
        return true;
    }
    // Handle the special case of an enum class, where the __new__ and __init__
    // methods are replaced at runtime by the metaclass.
    if (types_1.ClassType.isEnumClass(classType)) {
        return true;
    }
    return false;
}
// If __new__ returns a type that is not an instance of the class, skip the
// __init__ method evaluation. This is consistent with the behavior of the
// type.__call__ runtime behavior.
function shouldSkipInitEvaluation(evaluator, classType, newMethodReturnType) {
    const returnType = evaluator.makeTopLevelTypeVarsConcrete(newMethodReturnType);
    let skipInitCheck = false;
    (0, typeUtils_1.doForEachSubtype)(returnType, (subtype) => {
        if ((0, types_1.isUnknown)(subtype)) {
            return;
        }
        if ((0, types_1.isClassInstance)(subtype)) {
            const inheritanceChain = [];
            const isDerivedFrom = types_1.ClassType.isDerivedFrom(subtype, classType, inheritanceChain);
            if (!isDerivedFrom) {
                skipInitCheck = true;
            }
            return;
        }
        skipInitCheck = true;
    });
    return skipInitCheck;
}
// Determine whether the __new__ method is the placeholder signature
// of "def __new__(cls, *args, **kwargs) -> Self".
function isDefaultNewMethod(newMethod) {
    var _a;
    if (!newMethod || !(0, types_1.isFunction)(newMethod)) {
        return false;
    }
    const params = newMethod.details.parameters;
    if (params.length !== 2) {
        return false;
    }
    if (params[0].category !== 1 /* ParameterCategory.ArgsList */ || params[1].category !== 2 /* ParameterCategory.KwargsDict */) {
        return false;
    }
    const returnType = (_a = newMethod.details.declaredReturnType) !== null && _a !== void 0 ? _a : newMethod.inferredReturnType;
    if (!returnType || !(0, types_1.isTypeVar)(returnType) || !returnType.details.isSynthesizedSelf) {
        return false;
    }
    return true;
}
//# sourceMappingURL=constructors.js.map