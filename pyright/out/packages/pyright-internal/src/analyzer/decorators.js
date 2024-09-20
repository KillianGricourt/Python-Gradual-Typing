"use strict";
/*
 * decorators.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides type evaluation logic that is specific to the application of
 * function or class decorators.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeprecatedMessageFromCall = exports.addOverloadsToFunctionType = exports.applyClassDecorator = exports.applyFunctionDecorator = exports.getFunctionInfoFromDecorators = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const diagnosticRules_1 = require("../common/diagnosticRules");
const localize_1 = require("../localization/localize");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const dataClasses_1 = require("./dataClasses");
const docStringConversion_1 = require("./docStringConversion");
const properties_1 = require("./properties");
const typeUtils_1 = require("./typeUtils");
const types_1 = require("./types");
// Scans through the decorators to find a few built-in decorators
// that affect the function flags.
function getFunctionInfoFromDecorators(evaluator, node, isInClass) {
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(node);
    let flags = 0 /* FunctionTypeFlags.None */;
    let deprecationMessage;
    if (isInClass) {
        // The "__new__" magic method is not an instance method.
        // It acts as a static method instead.
        if (node.name.value === '__new__') {
            flags |= 1 /* FunctionTypeFlags.ConstructorMethod */;
        }
        // Several magic methods are treated as class methods implicitly
        // by the runtime. Check for these here.
        const implicitClassMethods = ['__init_subclass__', '__class_getitem__'];
        if (implicitClassMethods.some((name) => node.name.value === name)) {
            flags |= 2 /* FunctionTypeFlags.ClassMethod */;
        }
    }
    for (const decoratorNode of node.decorators) {
        // Some stub files (e.g. builtins.pyi) rely on forward declarations of decorators.
        let evaluatorFlags = fileInfo.isStubFile ? 4 /* EvalFlags.ForwardRefs */ : 0 /* EvalFlags.None */;
        if (decoratorNode.expression.nodeType !== 9 /* ParseNodeType.Call */) {
            evaluatorFlags |= 2 /* EvalFlags.CallBaseDefaults */;
        }
        const decoratorTypeResult = evaluator.getTypeOfExpression(decoratorNode.expression, evaluatorFlags);
        const decoratorType = decoratorTypeResult.type;
        if ((0, types_1.isFunction)(decoratorType)) {
            if (decoratorType.details.builtInName === 'abstractmethod') {
                if (isInClass) {
                    flags |= 8 /* FunctionTypeFlags.AbstractMethod */;
                }
            }
            else if (decoratorType.details.builtInName === 'final') {
                flags |= 8192 /* FunctionTypeFlags.Final */;
            }
            else if (decoratorType.details.builtInName === 'override') {
                flags |= 262144 /* FunctionTypeFlags.Overridden */;
            }
            else if (decoratorType.details.builtInName === 'type_check_only') {
                flags |= 128 /* FunctionTypeFlags.TypeCheckOnly */;
            }
            else if (decoratorType.details.builtInName === 'no_type_check') {
                flags |= 524288 /* FunctionTypeFlags.NoTypeCheck */;
            }
            else if (decoratorType.details.builtInName === 'overload') {
                flags |= 256 /* FunctionTypeFlags.Overloaded */;
            }
        }
        else if ((0, types_1.isClass)(decoratorType)) {
            if (types_1.TypeBase.isInstantiable(decoratorType)) {
                if (types_1.ClassType.isBuiltIn(decoratorType, 'staticmethod')) {
                    if (isInClass) {
                        flags |= 4 /* FunctionTypeFlags.StaticMethod */;
                    }
                }
                else if (types_1.ClassType.isBuiltIn(decoratorType, 'classmethod')) {
                    if (isInClass) {
                        flags |= 2 /* FunctionTypeFlags.ClassMethod */;
                    }
                }
            }
            else {
                if (types_1.ClassType.isBuiltIn(decoratorType, 'deprecated')) {
                    deprecationMessage = decoratorType.deprecatedInstanceMessage;
                }
            }
        }
    }
    return { flags, deprecationMessage };
}
exports.getFunctionInfoFromDecorators = getFunctionInfoFromDecorators;
// Transforms the input function type into an output type based on the
// decorator function described by the decoratorNode.
function applyFunctionDecorator(evaluator, inputFunctionType, undecoratedType, decoratorNode, functionNode) {
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(decoratorNode);
    // Some stub files (e.g. builtins.pyi) rely on forward declarations of decorators.
    let evaluatorFlags = fileInfo.isStubFile ? 4 /* EvalFlags.ForwardRefs */ : 0 /* EvalFlags.None */;
    if (decoratorNode.expression.nodeType !== 9 /* ParseNodeType.Call */) {
        evaluatorFlags |= 2 /* EvalFlags.CallBaseDefaults */;
    }
    const decoratorTypeResult = evaluator.getTypeOfExpression(decoratorNode.expression, evaluatorFlags);
    const decoratorType = decoratorTypeResult.type;
    // Special-case the "overload" because it has no definition. Older versions of typeshed
    // defined "overload" as an object, but newer versions define it as a function.
    if (((0, types_1.isInstantiableClass)(decoratorType) && types_1.ClassType.isSpecialBuiltIn(decoratorType, 'overload')) ||
        ((0, types_1.isFunction)(decoratorType) && decoratorType.details.builtInName === 'overload')) {
        if ((0, types_1.isFunction)(inputFunctionType)) {
            inputFunctionType.details.flags |= 256 /* FunctionTypeFlags.Overloaded */;
            undecoratedType.details.flags |= 256 /* FunctionTypeFlags.Overloaded */;
            return inputFunctionType;
        }
    }
    if (decoratorNode.expression.nodeType === 9 /* ParseNodeType.Call */) {
        const decoratorCallType = evaluator.getTypeOfExpression(decoratorNode.expression.leftExpression, evaluatorFlags | 2 /* EvalFlags.CallBaseDefaults */).type;
        if ((0, types_1.isFunction)(decoratorCallType)) {
            if (decoratorCallType.details.name === '__dataclass_transform__' ||
                decoratorCallType.details.builtInName === 'dataclass_transform') {
                undecoratedType.details.decoratorDataClassBehaviors = (0, dataClasses_1.validateDataClassTransformDecorator)(evaluator, decoratorNode.expression);
                return inputFunctionType;
            }
        }
    }
    let returnType = getTypeOfDecorator(evaluator, decoratorNode, inputFunctionType);
    // Check for some built-in decorator types with known semantics.
    if ((0, types_1.isFunction)(decoratorType)) {
        if (decoratorType.details.builtInName === 'abstractmethod') {
            return inputFunctionType;
        }
        if (decoratorType.details.builtInName === 'type_check_only') {
            undecoratedType.details.flags |= 128 /* FunctionTypeFlags.TypeCheckOnly */;
            return inputFunctionType;
        }
        // Handle property setters and deleters.
        if (decoratorNode.expression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            const baseType = evaluator.getTypeOfExpression(decoratorNode.expression.leftExpression, evaluatorFlags | 2 /* EvalFlags.MemberAccessBaseDefaults */).type;
            if ((0, typeUtils_1.isProperty)(baseType)) {
                const memberName = decoratorNode.expression.memberName.value;
                if (memberName === 'setter') {
                    if ((0, types_1.isFunction)(inputFunctionType)) {
                        (0, properties_1.validatePropertyMethod)(evaluator, inputFunctionType, decoratorNode);
                        return (0, properties_1.clonePropertyWithSetter)(evaluator, baseType, inputFunctionType, functionNode);
                    }
                    else {
                        return inputFunctionType;
                    }
                }
                else if (memberName === 'deleter') {
                    if ((0, types_1.isFunction)(inputFunctionType)) {
                        (0, properties_1.validatePropertyMethod)(evaluator, inputFunctionType, decoratorNode);
                        return (0, properties_1.clonePropertyWithDeleter)(evaluator, baseType, inputFunctionType, functionNode);
                    }
                    else {
                        return inputFunctionType;
                    }
                }
            }
        }
    }
    else if ((0, types_1.isInstantiableClass)(decoratorType)) {
        if (types_1.ClassType.isBuiltIn(decoratorType)) {
            switch (decoratorType.details.name) {
                case 'classmethod':
                case 'staticmethod': {
                    const requiredFlag = decoratorType.details.name === 'classmethod'
                        ? 2 /* FunctionTypeFlags.ClassMethod */
                        : 4 /* FunctionTypeFlags.StaticMethod */;
                    // If the function isn't currently a class method or static method
                    // (which can happen if the function was wrapped in a decorator),
                    // add the appropriate flag.
                    if ((0, types_1.isFunction)(inputFunctionType) && (inputFunctionType.details.flags & requiredFlag) === 0) {
                        const newFunction = types_1.FunctionType.clone(inputFunctionType);
                        newFunction.details.flags &= ~(1 /* FunctionTypeFlags.ConstructorMethod */ |
                            4 /* FunctionTypeFlags.StaticMethod */ |
                            2 /* FunctionTypeFlags.ClassMethod */);
                        newFunction.details.flags |= requiredFlag;
                        return newFunction;
                    }
                    return inputFunctionType;
                }
                case 'decorator': {
                    return inputFunctionType;
                }
            }
        }
        // Handle properties and subclasses of properties specially.
        if (types_1.ClassType.isPropertyClass(decoratorType)) {
            if ((0, types_1.isFunction)(inputFunctionType)) {
                (0, properties_1.validatePropertyMethod)(evaluator, inputFunctionType, decoratorNode);
                return (0, properties_1.createProperty)(evaluator, decoratorNode, decoratorType, inputFunctionType);
            }
            else if ((0, types_1.isClassInstance)(inputFunctionType)) {
                const boundMethod = evaluator.getBoundMagicMethod(inputFunctionType, '__call__');
                if (boundMethod && (0, types_1.isFunction)(boundMethod)) {
                    return (0, properties_1.createProperty)(evaluator, decoratorNode, decoratorType, boundMethod);
                }
                return types_1.UnknownType.create();
            }
        }
    }
    if ((0, types_1.isFunction)(inputFunctionType) && (0, types_1.isFunction)(returnType)) {
        returnType = types_1.FunctionType.clone(returnType);
        // Copy the overload flag from the input function type.
        if (types_1.FunctionType.isOverloaded(inputFunctionType)) {
            returnType.details.flags |= 256 /* FunctionTypeFlags.Overloaded */;
        }
        // Copy the docstrings from the input function type if the
        // decorator didn't have its own docstring.
        if (!returnType.details.docString) {
            returnType.details.docString = inputFunctionType.details.docString;
        }
    }
    return returnType;
}
exports.applyFunctionDecorator = applyFunctionDecorator;
function applyClassDecorator(evaluator, inputClassType, originalClassType, decoratorNode) {
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(decoratorNode);
    let flags = fileInfo.isStubFile ? 4 /* EvalFlags.ForwardRefs */ : 0 /* EvalFlags.None */;
    if (decoratorNode.expression.nodeType !== 9 /* ParseNodeType.Call */) {
        flags |= 2 /* EvalFlags.CallBaseDefaults */;
    }
    const decoratorType = evaluator.getTypeOfExpression(decoratorNode.expression, flags).type;
    if (decoratorNode.expression.nodeType === 9 /* ParseNodeType.Call */) {
        const decoratorCallType = evaluator.getTypeOfExpression(decoratorNode.expression.leftExpression, flags | 2 /* EvalFlags.CallBaseDefaults */).type;
        if ((0, types_1.isFunction)(decoratorCallType)) {
            if (decoratorCallType.details.name === '__dataclass_transform__' ||
                decoratorCallType.details.builtInName === 'dataclass_transform') {
                originalClassType.details.classDataClassTransform = (0, dataClasses_1.validateDataClassTransformDecorator)(evaluator, decoratorNode.expression);
            }
        }
    }
    if ((0, types_1.isOverloadedFunction)(decoratorType)) {
        const dataclassBehaviors = (0, dataClasses_1.getDataclassDecoratorBehaviors)(decoratorType);
        if (dataclassBehaviors) {
            (0, dataClasses_1.applyDataClassDecorator)(evaluator, decoratorNode, originalClassType, dataclassBehaviors, 
            /* callNode */ undefined);
            return inputClassType;
        }
    }
    else if ((0, types_1.isFunction)(decoratorType)) {
        if (decoratorType.details.builtInName === 'final') {
            originalClassType.details.flags |= 256 /* ClassTypeFlags.Final */;
            // Don't call getTypeOfDecorator for final. We'll hard-code its
            // behavior because its function definition results in a cyclical
            // dependency between builtins, typing and _typeshed stubs.
            return inputClassType;
        }
        if (decoratorType.details.builtInName === 'type_check_only') {
            originalClassType.details.flags |= 1048576 /* ClassTypeFlags.TypeCheckOnly */;
            return inputClassType;
        }
        if (decoratorType.details.builtInName === 'runtime_checkable') {
            originalClassType.details.flags |= 2048 /* ClassTypeFlags.RuntimeCheckable */;
            // Don't call getTypeOfDecorator for runtime_checkable. It appears
            // frequently in stubs, and it's a waste of time to validate its
            // parameters.
            return inputClassType;
        }
        // Is this a dataclass decorator?
        let dataclassBehaviors;
        let callNode;
        if (decoratorNode.expression.nodeType === 9 /* ParseNodeType.Call */) {
            callNode = decoratorNode.expression;
            const decoratorCallType = evaluator.getTypeOfExpression(callNode.leftExpression, flags | 2 /* EvalFlags.CallBaseDefaults */).type;
            dataclassBehaviors = (0, dataClasses_1.getDataclassDecoratorBehaviors)(decoratorCallType);
        }
        else {
            const decoratorType = evaluator.getTypeOfExpression(decoratorNode.expression, flags).type;
            dataclassBehaviors = (0, dataClasses_1.getDataclassDecoratorBehaviors)(decoratorType);
        }
        if (dataclassBehaviors) {
            (0, dataClasses_1.applyDataClassDecorator)(evaluator, decoratorNode, originalClassType, dataclassBehaviors, callNode);
            return inputClassType;
        }
    }
    else if ((0, types_1.isClassInstance)(decoratorType)) {
        if (types_1.ClassType.isBuiltIn(decoratorType, 'deprecated')) {
            originalClassType.details.deprecatedMessage = decoratorType.deprecatedInstanceMessage;
            return inputClassType;
        }
    }
    return getTypeOfDecorator(evaluator, decoratorNode, inputClassType);
}
exports.applyClassDecorator = applyClassDecorator;
function getTypeOfDecorator(evaluator, node, functionOrClassType) {
    var _a, _b;
    // Evaluate the type of the decorator expression.
    let flags = (0, analyzerNodeInfo_1.getFileInfo)(node).isStubFile ? 4 /* EvalFlags.ForwardRefs */ : 0 /* EvalFlags.None */;
    if (node.expression.nodeType !== 9 /* ParseNodeType.Call */) {
        flags |= 2 /* EvalFlags.CallBaseDefaults */;
    }
    const decoratorTypeResult = evaluator.getTypeOfExpression(node.expression, flags);
    // Special-case the combination of a classmethod decorator applied
    // to a property. This is allowed in Python 3.9, but it's not reflected
    // in the builtins.pyi stub for classmethod.
    if ((0, types_1.isInstantiableClass)(decoratorTypeResult.type) &&
        types_1.ClassType.isBuiltIn(decoratorTypeResult.type, 'classmethod') &&
        (0, typeUtils_1.isProperty)(functionOrClassType)) {
        return functionOrClassType;
    }
    const argList = [
        {
            argumentCategory: 0 /* ArgumentCategory.Simple */,
            typeResult: { type: functionOrClassType },
        },
    ];
    const callTypeResult = evaluator.validateCallArguments(node.expression, argList, decoratorTypeResult, 
    /* typeVarContext */ undefined, 
    /* skipUnknownArgCheck */ true, 
    /* inferenceContext */ undefined, 
    /* signatureTracker */ undefined);
    evaluator.setTypeResultForNode(node, {
        type: (_a = callTypeResult.returnType) !== null && _a !== void 0 ? _a : types_1.UnknownType.create(),
        overloadsUsedForCall: callTypeResult.overloadsUsedForCall,
        isIncomplete: callTypeResult.isTypeIncomplete,
    });
    const returnType = (_b = callTypeResult.returnType) !== null && _b !== void 0 ? _b : types_1.UnknownType.create();
    // If the return type is a function that has no annotations
    // and just *args and **kwargs parameters, assume that it
    // preserves the type of the input function.
    if ((0, types_1.isFunction)(returnType) && !returnType.details.declaredReturnType) {
        if (!returnType.details.parameters.some((param, index) => {
            // Don't allow * or / separators or params with declared types.
            if (!param.name || param.hasDeclaredType) {
                return true;
            }
            // Allow *args or **kwargs parameters.
            if (param.category !== 0 /* ParameterCategory.Simple */) {
                return false;
            }
            // Allow inferred "self" or "cls" parameters.
            return index !== 0 || !param.isTypeInferred;
        })) {
            return functionOrClassType;
        }
    }
    // If the decorator is completely unannotated and the return type
    // includes unknowns, assume that it preserves the type of the input
    // function.
    if ((0, typeUtils_1.isPartlyUnknown)(returnType)) {
        if ((0, types_1.isFunction)(decoratorTypeResult.type)) {
            if (!decoratorTypeResult.type.details.parameters.find((param) => param.typeAnnotation !== undefined) &&
                decoratorTypeResult.type.details.declaredReturnType === undefined) {
                return functionOrClassType;
            }
        }
    }
    return returnType;
}
// Given a function node and the function type associated with it, this
// method searches for prior function nodes that are marked as @overload
// and creates an OverloadedFunctionType that includes this function and
// all previous ones.
function addOverloadsToFunctionType(evaluator, node, type) {
    let functionDecl;
    const decl = (0, analyzerNodeInfo_1.getDeclaration)(node);
    if (decl) {
        functionDecl = decl;
    }
    const symbolWithScope = evaluator.lookUpSymbolRecursive(node, node.name.value, /* honorCodeFlow */ false);
    if (symbolWithScope) {
        const decls = symbolWithScope.symbol.getDeclarations();
        // Find this function's declaration.
        const declIndex = decls.findIndex((decl) => decl === functionDecl);
        if (declIndex > 0) {
            // Evaluate all of the previous function declarations. They will
            // be cached. We do it in this order to avoid a stack overflow due
            // to recursion if there is a large number (1000's) of overloads.
            for (let i = 0; i < declIndex; i++) {
                const decl = decls[i];
                if (decl.type === 5 /* DeclarationType.Function */) {
                    evaluator.getTypeOfFunction(decl.node);
                }
            }
            let overloadedTypes = [];
            // Look at the previous declaration's type.
            const prevDecl = decls[declIndex - 1];
            if (prevDecl.type === 5 /* DeclarationType.Function */) {
                const prevDeclDeclTypeInfo = evaluator.getTypeOfFunction(prevDecl.node);
                if (prevDeclDeclTypeInfo) {
                    if ((0, types_1.isFunction)(prevDeclDeclTypeInfo.decoratedType)) {
                        if (types_1.FunctionType.isOverloaded(prevDeclDeclTypeInfo.decoratedType)) {
                            overloadedTypes.push(prevDeclDeclTypeInfo.decoratedType);
                        }
                    }
                    else if ((0, types_1.isOverloadedFunction)(prevDeclDeclTypeInfo.decoratedType)) {
                        // If the previous declaration was itself an overloaded function,
                        // copy the entries from it.
                        (0, collectionUtils_1.appendArray)(overloadedTypes, prevDeclDeclTypeInfo.decoratedType.overloads);
                    }
                }
            }
            overloadedTypes.push(type);
            if (overloadedTypes.length === 1) {
                return overloadedTypes[0];
            }
            // Apply the implementation's docstring to any overloads that don't
            // have their own docstrings.
            const implementation = overloadedTypes.find((signature) => !types_1.FunctionType.isOverloaded(signature));
            if (implementation === null || implementation === void 0 ? void 0 : implementation.details.docString) {
                overloadedTypes = overloadedTypes.map((overload) => {
                    if (types_1.FunctionType.isOverloaded(overload) && !overload.details.docString) {
                        return types_1.FunctionType.cloneWithDocString(overload, implementation.details.docString);
                    }
                    return overload;
                });
            }
            // PEP 702 indicates that if the implementation of an overloaded
            // function is marked deprecated, all of the overloads should be
            // treated as deprecated as well.
            if (implementation && implementation.details.deprecatedMessage !== undefined) {
                overloadedTypes = overloadedTypes.map((overload) => {
                    if (types_1.FunctionType.isOverloaded(overload) && overload.details.deprecatedMessage === undefined) {
                        return types_1.FunctionType.cloneWithDeprecatedMessage(overload, implementation.details.deprecatedMessage);
                    }
                    return overload;
                });
            }
            // Create a new overloaded type that copies the contents of the previous
            // one and adds a new function.
            const newOverload = types_1.OverloadedFunctionType.create(overloadedTypes);
            const prevOverload = overloadedTypes[overloadedTypes.length - 2];
            const isPrevOverloadAbstract = types_1.FunctionType.isAbstractMethod(prevOverload);
            const isCurrentOverloadAbstract = types_1.FunctionType.isAbstractMethod(type);
            if (isPrevOverloadAbstract !== isCurrentOverloadAbstract) {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentOverload, localize_1.LocMessage.overloadAbstractMismatch().format({ name: node.name.value }), node.name);
            }
            return newOverload;
        }
    }
    return type;
}
exports.addOverloadsToFunctionType = addOverloadsToFunctionType;
// Given a @typing.deprecated call node, returns either '' or a custom
// deprecation message if one is provided.
function getDeprecatedMessageFromCall(node) {
    if (node.arguments.length > 0 &&
        node.arguments[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
        node.arguments[0].valueExpression.nodeType === 48 /* ParseNodeType.StringList */) {
        const stringListNode = node.arguments[0].valueExpression;
        const message = stringListNode.strings.map((s) => s.value).join('');
        return (0, docStringConversion_1.convertDocStringToPlainText)(message);
    }
    return '';
}
exports.getDeprecatedMessageFromCall = getDeprecatedMessageFromCall;
//# sourceMappingURL=decorators.js.map