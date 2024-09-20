"use strict";
/*
 * properties.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides type evaluation logic that is specific to properties.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignProperty = exports.clonePropertyWithDeleter = exports.clonePropertyWithSetter = exports.createProperty = exports.validatePropertyMethod = void 0;
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const localize_1 = require("../localization/localize");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const parseTreeUtils_1 = require("./parseTreeUtils");
const symbol_1 = require("./symbol");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
function validatePropertyMethod(evaluator, method, errorNode) {
    if (types_1.FunctionType.isStaticMethod(method)) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.propertyStaticMethod(), errorNode);
    }
}
exports.validatePropertyMethod = validatePropertyMethod;
function createProperty(evaluator, decoratorNode, decoratorType, fget) {
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(decoratorNode);
    const typeMetaclass = evaluator.getBuiltInType(decoratorNode, 'type');
    const typeSourceId = types_1.ClassType.isBuiltIn(decoratorType, 'property')
        ? (0, parseTreeUtils_1.getTypeSourceId)(decoratorNode)
        : decoratorType.details.typeSourceId;
    const propertyClass = types_1.ClassType.createInstantiable(decoratorType.details.name, (0, parseTreeUtils_1.getClassFullName)(decoratorNode, fileInfo.moduleName, `__property_${fget.details.name}`), fileInfo.moduleName, fileInfo.fileUri, 128 /* ClassTypeFlags.PropertyClass */ | 1 /* ClassTypeFlags.BuiltInClass */, typeSourceId, 
    /* declaredMetaclass */ undefined, (0, types_1.isInstantiableClass)(typeMetaclass) ? typeMetaclass : types_1.UnknownType.create());
    propertyClass.details.declaration = decoratorType.details.declaration;
    propertyClass.details.typeVarScopeId = decoratorType.details.typeVarScopeId;
    const objectType = evaluator.getBuiltInType(decoratorNode, 'object');
    propertyClass.details.baseClasses.push((0, types_1.isInstantiableClass)(objectType) ? objectType : types_1.UnknownType.create());
    (0, typeUtils_1.computeMroLinearization)(propertyClass);
    // Clone the symbol table of the old class type.
    const fields = types_1.ClassType.getSymbolTable(propertyClass);
    types_1.ClassType.getSymbolTable(decoratorType).forEach((symbol, name) => {
        const ignoredMethods = ['__get__', '__set__', '__delete__'];
        if (!symbol.isIgnoredForProtocolMatch()) {
            if (!ignoredMethods.some((m) => m === name)) {
                fields.set(name, symbol);
            }
        }
    });
    const propertyObject = types_1.ClassType.cloneAsInstance(propertyClass);
    propertyClass.isAsymmetricDescriptor = false;
    // Update the __set__ and __delete__ methods if present.
    updateGetSetDelMethodForClonedProperty(evaluator, propertyObject);
    // Fill in the fget method.
    propertyObject.fgetInfo = {
        methodType: types_1.FunctionType.cloneWithNewFlags(fget, fget.details.flags | 4 /* FunctionTypeFlags.StaticMethod */),
        classType: fget.details.methodClass,
    };
    if (types_1.FunctionType.isClassMethod(fget)) {
        propertyClass.details.flags |= 131072 /* ClassTypeFlags.ClassProperty */;
    }
    // Fill in the __get__ method with an overload.
    addGetMethodToPropertySymbolTable(evaluator, propertyObject, fget);
    // Fill in the getter, setter and deleter methods.
    addDecoratorMethodsToPropertySymbolTable(propertyObject);
    return propertyObject;
}
exports.createProperty = createProperty;
function clonePropertyWithSetter(evaluator, prop, fset, errorNode) {
    if (!(0, typeUtils_1.isProperty)(prop)) {
        return prop;
    }
    const classType = prop;
    const flagsToClone = classType.details.flags;
    let isAsymmetricDescriptor = !!classType.isAsymmetricDescriptor;
    // Verify parameters for fset.
    // We'll skip this test if the diagnostic rule is disabled because it
    // can be somewhat expensive, especially in code that is not annotated.
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(errorNode);
    if (errorNode.parameters.length >= 2) {
        const typeAnnotation = (0, parseTreeUtils_1.getTypeAnnotationForParameter)(errorNode, 1);
        if (typeAnnotation) {
            // Verify consistency of the type.
            const fgetType = evaluator.getGetterTypeFromProperty(classType, /* inferTypeIfNeeded */ false);
            if (fgetType && !(0, types_1.isAnyOrUnknown)(fgetType)) {
                const fsetType = evaluator.getTypeOfAnnotation(typeAnnotation, {
                    associateTypeVarsWithScope: true,
                });
                // The setter type should be assignable to the getter type.
                if (fileInfo.diagnosticRuleSet.reportPropertyTypeMismatch !== 'none') {
                    const diag = new diagnostic_1.DiagnosticAddendum();
                    if (!evaluator.assignType(fgetType, fsetType, diag)) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportPropertyTypeMismatch, localize_1.LocMessage.setterGetterTypeMismatch() + diag.getString(), typeAnnotation);
                    }
                }
                if (!(0, types_1.isTypeSame)(fgetType, fsetType)) {
                    isAsymmetricDescriptor = true;
                }
            }
        }
    }
    const propertyClass = types_1.ClassType.createInstantiable(classType.details.name, classType.details.fullName, classType.details.moduleName, (0, analyzerNodeInfo_1.getFileInfo)(errorNode).fileUri, flagsToClone, classType.details.typeSourceId, classType.details.declaredMetaclass, classType.details.effectiveMetaclass);
    propertyClass.details.declaration = classType.details.declaration;
    propertyClass.details.typeVarScopeId = classType.details.typeVarScopeId;
    const objectType = evaluator.getBuiltInType(errorNode, 'object');
    propertyClass.details.baseClasses.push((0, types_1.isInstantiableClass)(objectType) ? objectType : types_1.UnknownType.create());
    (0, typeUtils_1.computeMroLinearization)(propertyClass);
    propertyClass.fgetInfo = classType.fgetInfo;
    propertyClass.fdelInfo = classType.fdelInfo;
    propertyClass.isAsymmetricDescriptor = isAsymmetricDescriptor;
    const propertyObject = types_1.ClassType.cloneAsInstance(propertyClass);
    // Clone the symbol table of the old class type.
    const fields = types_1.ClassType.getSymbolTable(propertyClass);
    types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
        if (!symbol.isIgnoredForProtocolMatch()) {
            fields.set(name, symbol);
        }
    });
    // Update the __get__ and __delete__ methods if present.
    updateGetSetDelMethodForClonedProperty(evaluator, propertyObject);
    // Fill in the new fset method.
    propertyObject.fsetInfo = {
        methodType: types_1.FunctionType.cloneWithNewFlags(fset, fset.details.flags | 4 /* FunctionTypeFlags.StaticMethod */),
        classType: fset.details.methodClass,
    };
    // Fill in the __set__ method.
    addSetMethodToPropertySymbolTable(evaluator, propertyObject, fset);
    // Fill in the getter, setter and deleter methods.
    addDecoratorMethodsToPropertySymbolTable(propertyObject);
    return propertyObject;
}
exports.clonePropertyWithSetter = clonePropertyWithSetter;
function clonePropertyWithDeleter(evaluator, prop, fdel, errorNode) {
    var _a;
    if (!(0, typeUtils_1.isProperty)(prop)) {
        return prop;
    }
    const classType = prop;
    const propertyClass = types_1.ClassType.createInstantiable(classType.details.name, classType.details.fullName, classType.details.moduleName, (0, analyzerNodeInfo_1.getFileInfo)(errorNode).fileUri, classType.details.flags, classType.details.typeSourceId, classType.details.declaredMetaclass, classType.details.effectiveMetaclass);
    propertyClass.details.declaration = classType.details.declaration;
    propertyClass.details.typeVarScopeId = classType.details.typeVarScopeId;
    const objectType = evaluator.getBuiltInType(errorNode, 'object');
    propertyClass.details.baseClasses.push((0, types_1.isInstantiableClass)(objectType) ? objectType : types_1.UnknownType.create());
    (0, typeUtils_1.computeMroLinearization)(propertyClass);
    propertyClass.fgetInfo = classType.fgetInfo;
    propertyClass.fsetInfo = classType.fsetInfo;
    const propertyObject = types_1.ClassType.cloneAsInstance(propertyClass);
    propertyClass.isAsymmetricDescriptor = (_a = classType.isAsymmetricDescriptor) !== null && _a !== void 0 ? _a : false;
    // Clone the symbol table of the old class type.
    const fields = types_1.ClassType.getSymbolTable(propertyClass);
    types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
        if (!symbol.isIgnoredForProtocolMatch()) {
            fields.set(name, symbol);
        }
    });
    // Update the __get__ and __set__ methods if present.
    updateGetSetDelMethodForClonedProperty(evaluator, propertyObject);
    // Fill in the fdel method.
    propertyObject.fdelInfo = {
        methodType: types_1.FunctionType.cloneWithNewFlags(fdel, fdel.details.flags | 4 /* FunctionTypeFlags.StaticMethod */),
        classType: fdel.details.methodClass,
    };
    // Fill in the __delete__ method.
    addDelMethodToPropertySymbolTable(evaluator, propertyObject, fdel);
    // Fill in the getter, setter and deleter methods.
    addDecoratorMethodsToPropertySymbolTable(propertyObject);
    return propertyObject;
}
exports.clonePropertyWithDeleter = clonePropertyWithDeleter;
function addGetMethodToPropertySymbolTable(evaluator, propertyObject, fget) {
    const fields = types_1.ClassType.getSymbolTable(propertyObject);
    // The first overload is for accesses through a class object (where
    // the instance argument is None).
    const getFunction1 = types_1.FunctionType.createSynthesizedInstance('__get__', 256 /* FunctionTypeFlags.Overloaded */);
    types_1.FunctionType.addParameter(getFunction1, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
    });
    types_1.FunctionType.addParameter(getFunction1, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'obj',
        type: evaluator.getNoneType(),
        hasDeclaredType: true,
    });
    types_1.FunctionType.addParameter(getFunction1, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'objtype',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
        hasDefault: true,
        defaultType: types_1.AnyType.create(),
    });
    getFunction1.details.declaredReturnType = types_1.FunctionType.isClassMethod(fget)
        ? types_1.FunctionType.getEffectiveReturnType(fget)
        : propertyObject;
    getFunction1.details.declaration = fget.details.declaration;
    getFunction1.details.deprecatedMessage = fget.details.deprecatedMessage;
    // Override the scope ID since we're using parameter types from the
    // decorated function.
    getFunction1.details.typeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(fget);
    // The second overload is for accesses through a class instance.
    const getFunction2 = types_1.FunctionType.createSynthesizedInstance('__get__', 256 /* FunctionTypeFlags.Overloaded */);
    types_1.FunctionType.addParameter(getFunction2, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
    });
    const objType = fget.details.parameters.length > 0 ? types_1.FunctionType.getEffectiveParameterType(fget, 0) : types_1.AnyType.create();
    types_1.FunctionType.addParameter(getFunction2, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'obj',
        type: objType,
        hasDeclaredType: true,
    });
    types_1.FunctionType.addParameter(getFunction2, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'objtype',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
        hasDefault: true,
        defaultType: types_1.AnyType.create(),
    });
    getFunction2.details.declaredReturnType = types_1.FunctionType.getEffectiveReturnType(fget);
    getFunction2.details.declaration = fget.details.declaration;
    getFunction2.details.deprecatedMessage = fget.details.deprecatedMessage;
    // Override the scope ID since we're using parameter types from the
    // decorated function.
    getFunction2.details.typeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(fget);
    // We previously placed getFunction1 before getFunction2, but this creates
    // problems specifically for the `NoneType` class because None.__class__
    // is a property, and both overloads match in this case because None
    // is passed for the "obj" parameter.
    const getFunctionOverload = types_1.OverloadedFunctionType.create([getFunction2, getFunction1]);
    const getSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, getFunctionOverload);
    fields.set('__get__', getSymbol);
}
function addSetMethodToPropertySymbolTable(evaluator, propertyObject, fset) {
    const fields = types_1.ClassType.getSymbolTable(propertyObject);
    const setFunction = types_1.FunctionType.createSynthesizedInstance('__set__');
    types_1.FunctionType.addParameter(setFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
    });
    let objType = fset.details.parameters.length > 0 ? types_1.FunctionType.getEffectiveParameterType(fset, 0) : types_1.AnyType.create();
    if ((0, types_1.isTypeVar)(objType) && objType.details.isSynthesizedSelf) {
        objType = evaluator.makeTopLevelTypeVarsConcrete(objType);
    }
    types_1.FunctionType.addParameter(setFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'obj',
        type: (0, types_1.combineTypes)([objType, evaluator.getNoneType()]),
        hasDeclaredType: true,
    });
    setFunction.details.declaredReturnType = evaluator.getNoneType();
    // Adopt the TypeVarScopeId of the fset function in case it has any
    // TypeVars that need to be solved.
    setFunction.details.typeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(fset);
    setFunction.details.deprecatedMessage = fset.details.deprecatedMessage;
    let setParamType = types_1.UnknownType.create();
    if (fset.details.parameters.length >= 2 &&
        fset.details.parameters[1].category === 0 /* ParameterCategory.Simple */ &&
        fset.details.parameters[1].name) {
        setParamType = fset.details.parameters[1].type;
    }
    types_1.FunctionType.addParameter(setFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'value',
        type: setParamType,
        hasDeclaredType: true,
    });
    const setSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, setFunction);
    fields.set('__set__', setSymbol);
}
function addDelMethodToPropertySymbolTable(evaluator, propertyObject, fdel) {
    const fields = types_1.ClassType.getSymbolTable(propertyObject);
    const delFunction = types_1.FunctionType.createSynthesizedInstance('__delete__');
    types_1.FunctionType.addParameter(delFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
    });
    // Adopt the TypeVarScopeId of the fdel function in case it has any
    // TypeVars that need to be solved.
    delFunction.details.typeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(fdel);
    delFunction.details.deprecatedMessage = fdel.details.deprecatedMessage;
    let objType = fdel.details.parameters.length > 0 ? types_1.FunctionType.getEffectiveParameterType(fdel, 0) : types_1.AnyType.create();
    if ((0, types_1.isTypeVar)(objType) && objType.details.isSynthesizedSelf) {
        objType = evaluator.makeTopLevelTypeVarsConcrete(objType);
    }
    types_1.FunctionType.addParameter(delFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'obj',
        type: (0, types_1.combineTypes)([objType, evaluator.getNoneType()]),
        hasDeclaredType: true,
    });
    delFunction.details.declaredReturnType = evaluator.getNoneType();
    const delSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, delFunction);
    fields.set('__delete__', delSymbol);
}
function updateGetSetDelMethodForClonedProperty(evaluator, propertyObject) {
    const fgetInfo = propertyObject.fgetInfo;
    if (fgetInfo && (0, types_1.isFunction)(fgetInfo.methodType)) {
        addGetMethodToPropertySymbolTable(evaluator, propertyObject, fgetInfo.methodType);
    }
    const fsetInfo = propertyObject.fsetInfo;
    if (fsetInfo && (0, types_1.isFunction)(fsetInfo.methodType)) {
        addSetMethodToPropertySymbolTable(evaluator, propertyObject, fsetInfo.methodType);
    }
    const fdelInfo = propertyObject.fdelInfo;
    if (fdelInfo && (0, types_1.isFunction)(fdelInfo.methodType)) {
        addDelMethodToPropertySymbolTable(evaluator, propertyObject, fdelInfo.methodType);
    }
}
function addDecoratorMethodsToPropertySymbolTable(propertyObject) {
    const fields = types_1.ClassType.getSymbolTable(propertyObject);
    // Fill in the getter, setter and deleter methods.
    ['getter', 'setter', 'deleter'].forEach((accessorName) => {
        const accessorFunction = types_1.FunctionType.createSynthesizedInstance(accessorName);
        types_1.FunctionType.addParameter(accessorFunction, {
            category: 0 /* ParameterCategory.Simple */,
            name: 'self',
            type: types_1.AnyType.create(),
            hasDeclaredType: true,
        });
        types_1.FunctionType.addParameter(accessorFunction, {
            category: 0 /* ParameterCategory.Simple */,
            name: 'accessor',
            type: types_1.AnyType.create(),
            hasDeclaredType: true,
        });
        accessorFunction.details.declaredReturnType = propertyObject;
        const accessorSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, accessorFunction);
        fields.set(accessorName, accessorSymbol);
    });
}
function assignProperty(evaluator, destPropertyType, srcPropertyType, destClass, srcClass, diag, typeVarContext, selfTypeVarContext, recursionCount = 0) {
    const srcObjectToBind = (0, types_1.isClass)(srcClass) ? types_1.ClassType.cloneAsInstance(srcClass) : undefined;
    const destObjectToBind = types_1.ClassType.cloneAsInstance(destClass);
    let isAssignable = true;
    const accessors = [
        {
            getFunction: (c) => { var _a; return (_a = c.fgetInfo) === null || _a === void 0 ? void 0 : _a.methodType; },
            missingDiagMsg: localize_1.LocAddendum.missingGetter,
            incompatibleDiagMsg: localize_1.LocAddendum.incompatibleGetter,
        },
        {
            getFunction: (c) => { var _a; return (_a = c.fsetInfo) === null || _a === void 0 ? void 0 : _a.methodType; },
            missingDiagMsg: localize_1.LocAddendum.missingSetter,
            incompatibleDiagMsg: localize_1.LocAddendum.incompatibleSetter,
        },
        {
            getFunction: (c) => { var _a; return (_a = c.fdelInfo) === null || _a === void 0 ? void 0 : _a.methodType; },
            missingDiagMsg: localize_1.LocAddendum.missingDeleter,
            incompatibleDiagMsg: localize_1.LocAddendum.incompatibleDeleter,
        },
    ];
    accessors.forEach((accessorInfo) => {
        let destAccessType = accessorInfo.getFunction(destPropertyType);
        if (destAccessType && (0, types_1.isFunction)(destAccessType)) {
            let srcAccessType = accessorInfo.getFunction(srcPropertyType);
            if (!srcAccessType || !(0, types_1.isFunction)(srcAccessType)) {
                diag === null || diag === void 0 ? void 0 : diag.addMessage(accessorInfo.missingDiagMsg());
                isAssignable = false;
                return;
            }
            evaluator.inferReturnTypeIfNecessary(srcAccessType);
            evaluator.inferReturnTypeIfNecessary(destAccessType);
            // If the caller provided a "self" TypeVar context, replace any Self types.
            // This is needed during protocol matching.
            if (selfTypeVarContext) {
                destAccessType = (0, typeUtils_1.applySolvedTypeVars)(destAccessType, selfTypeVarContext);
            }
            // The access methods of fget, fset and fdel are modeled as static
            // variables because they do not bind go the "property" class that
            // contains them, but we'll turn it back into a non-static method
            // here and bind them to the associated objects.
            destAccessType = types_1.FunctionType.cloneWithNewFlags(destAccessType, destAccessType.details.flags & ~4 /* FunctionTypeFlags.StaticMethod */);
            srcAccessType = types_1.FunctionType.cloneWithNewFlags(srcAccessType, srcAccessType.details.flags & ~4 /* FunctionTypeFlags.StaticMethod */);
            const boundDestAccessType = evaluator.bindFunctionToClassOrObject(destObjectToBind, destAccessType, 
            /* memberClass */ undefined, 
            /* treatConstructorAsClassMethod */ undefined, 
            /* firstParamType */ undefined, diag === null || diag === void 0 ? void 0 : diag.createAddendum(), recursionCount);
            const boundSrcAccessType = evaluator.bindFunctionToClassOrObject(srcObjectToBind, srcAccessType, 
            /* memberClass */ undefined, 
            /* treatConstructorAsClassMethod */ undefined, 
            /* firstParamType */ undefined, diag === null || diag === void 0 ? void 0 : diag.createAddendum(), recursionCount);
            if (!boundDestAccessType ||
                !boundSrcAccessType ||
                !evaluator.assignType(boundDestAccessType, boundSrcAccessType, diag, typeVarContext, 
                /* srcTypeVarContext */ undefined, 0 /* AssignTypeFlags.Default */, recursionCount)) {
                isAssignable = false;
            }
        }
    });
    return isAssignable;
}
exports.assignProperty = assignProperty;
//# sourceMappingURL=properties.js.map