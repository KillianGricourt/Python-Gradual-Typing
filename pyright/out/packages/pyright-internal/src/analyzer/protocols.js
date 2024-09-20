"use strict";
/*
 * protocols.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides type evaluation logic that is specific to protocol
 * (structural subtyping) classes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isProtocolUnsafeOverlap = exports.isMethodOnlyProtocol = exports.assignModuleToProtocol = exports.assignClassToProtocol = void 0;
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const localize_1 = require("../localization/localize");
const constraintSolver_1 = require("./constraintSolver");
const properties_1 = require("./properties");
const symbolUtils_1 = require("./symbolUtils");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
const protocolAssignmentStack = [];
// Maximum number of different types that are cached with a protocol.
const maxProtocolCompatibilityCacheEntries = 64;
function assignClassToProtocol(evaluator, destType, srcType, diag, destTypeVarContext, srcTypeVarContext, flags, recursionCount) {
    // We assume that destType is an instantiable class that is a protocol. The
    // srcType can be an instantiable class or a class instance.
    (0, debug_1.assert)((0, types_1.isInstantiableClass)(destType) && types_1.ClassType.isProtocolClass(destType));
    const enforceInvariance = (flags & 1 /* AssignTypeFlags.EnforceInvariance */) !== 0;
    // Use a stack of pending protocol class evaluations to detect recursion.
    // This can happen when a protocol class refers to itself.
    if (protocolAssignmentStack.some((entry) => {
        return (0, types_1.isTypeSame)(entry.srcType, srcType) && (0, types_1.isTypeSame)(entry.destType, destType);
    })) {
        return !enforceInvariance;
    }
    // See if we've already determined that this class is compatible with this protocol.
    if (!enforceInvariance) {
        const compatibility = getProtocolCompatibility(destType, srcType, flags, destTypeVarContext);
        if (compatibility !== undefined) {
            if (compatibility) {
                // If the caller has provided a destination type var context,
                // we can't use the cached value unless the dest has no type
                // parameters to solve.
                if (!destTypeVarContext || !(0, typeUtils_1.requiresSpecialization)(destType)) {
                    return true;
                }
            }
            // If it's known not to be compatible and the caller hasn't requested
            // any detailed diagnostic information or we've already exceeded the
            // depth of diagnostic information that will be displayed, we can
            // return false immediately.
            if (!compatibility) {
                if (!diag || diag.getNestLevel() > diagnostic_1.defaultMaxDiagnosticDepth) {
                    return false;
                }
            }
        }
    }
    protocolAssignmentStack.push({ srcType, destType });
    let isCompatible = true;
    const clonedTypeVarContext = destTypeVarContext === null || destTypeVarContext === void 0 ? void 0 : destTypeVarContext.clone();
    try {
        isCompatible = assignClassToProtocolInternal(evaluator, destType, srcType, diag, destTypeVarContext, srcTypeVarContext, flags, recursionCount);
    }
    catch (e) {
        // We'd normally use "finally" here, but the TS debugger does such
        // a poor job dealing with finally, we'll use a catch instead.
        protocolAssignmentStack.pop();
        throw e;
    }
    protocolAssignmentStack.pop();
    // Cache the results for next time.
    setProtocolCompatibility(destType, srcType, flags, clonedTypeVarContext, isCompatible);
    return isCompatible;
}
exports.assignClassToProtocol = assignClassToProtocol;
function assignModuleToProtocol(evaluator, destType, srcType, diag, destTypeVarContext, flags, recursionCount) {
    return assignClassToProtocolInternal(evaluator, destType, srcType, diag, destTypeVarContext, 
    /* srcTypeVarContext */ undefined, flags, recursionCount);
}
exports.assignModuleToProtocol = assignModuleToProtocol;
// Determines whether the specified class is a protocol class that has
// only methods, no other symbol types like variables.
function isMethodOnlyProtocol(classType) {
    if (!types_1.ClassType.isProtocolClass(classType)) {
        return false;
    }
    // First check for data members in any protocol base classes.
    for (const baseClass of classType.details.baseClasses) {
        if ((0, types_1.isClass)(baseClass) && types_1.ClassType.isProtocolClass(baseClass) && !isMethodOnlyProtocol(baseClass)) {
            return false;
        }
    }
    for (const [, symbol] of types_1.ClassType.getSymbolTable(classType)) {
        if (symbol.isIgnoredForProtocolMatch()) {
            continue;
        }
        if (symbol.getDeclarations().some((decl) => decl.type !== 5 /* DeclarationType.Function */)) {
            return false;
        }
    }
    return true;
}
exports.isMethodOnlyProtocol = isMethodOnlyProtocol;
// Determines whether the classType has "unsafe overlap" with a runtime checkable protocol.
// This can occur because the runtime doesn't do full type comparisons. It simply looks at
// the presence of specific attributes.
function isProtocolUnsafeOverlap(evaluator, protocol, classType) {
    // If the classType is compatible with the protocol, then it doesn't overlap unsafely.
    if (evaluator.assignType(protocol, classType)) {
        return false;
    }
    let isUnsafeOverlap = true;
    protocol.details.mro.forEach((mroClass) => {
        if (!isUnsafeOverlap || !(0, types_1.isInstantiableClass)(mroClass) || !types_1.ClassType.isProtocolClass(mroClass)) {
            return;
        }
        types_1.ClassType.getSymbolTable(mroClass).forEach((destSymbol, name) => {
            if (!isUnsafeOverlap || !destSymbol.isClassMember() || destSymbol.isIgnoredForProtocolMatch()) {
                return;
            }
            // Does the classType have a member with the same name?
            const srcMemberInfo = (0, typeUtils_1.lookUpClassMember)(classType, name);
            if (!srcMemberInfo) {
                isUnsafeOverlap = false;
            }
        });
    });
    return isUnsafeOverlap;
}
exports.isProtocolUnsafeOverlap = isProtocolUnsafeOverlap;
// Looks up the protocol compatibility in the cache. If it's not found,
// return undefined.
function getProtocolCompatibility(destType, srcType, flags, typeVarContext) {
    const map = srcType.details.protocolCompatibility;
    const entries = map === null || map === void 0 ? void 0 : map.get(destType.details.fullName);
    if (entries === undefined) {
        return undefined;
    }
    const entry = entries.find((entry) => {
        return ((0, types_1.isTypeSame)(entry.destType, destType) &&
            (0, types_1.isTypeSame)(entry.srcType, srcType) &&
            entry.flags === flags &&
            isTypeVarContextSame(typeVarContext, entry.typeVarContext));
    });
    return entry === null || entry === void 0 ? void 0 : entry.isCompatible;
}
function setProtocolCompatibility(destType, srcType, flags, typeVarContext, isCompatible) {
    let map = srcType.details.protocolCompatibility;
    if (!map) {
        map = new Map();
        srcType.details.protocolCompatibility = map;
    }
    let entries = map.get(destType.details.fullName);
    if (!entries) {
        entries = [];
        map.set(destType.details.fullName, entries);
    }
    entries.push({
        destType,
        srcType,
        flags,
        typeVarContext,
        isCompatible,
    });
    if (entries.length > maxProtocolCompatibilityCacheEntries) {
        entries.shift();
    }
}
function isTypeVarContextSame(context1, context2) {
    if (!context1 || !context2) {
        return context1 === context2;
    }
    return context1.isSame(context2);
}
function assignClassToProtocolInternal(evaluator, destType, srcType, diag, destTypeVarContext, srcTypeVarContext, flags, recursionCount) {
    var _a;
    if ((flags & 1 /* AssignTypeFlags.EnforceInvariance */) !== 0) {
        return (0, types_1.isTypeSame)(destType, srcType);
    }
    evaluator.inferTypeParameterVarianceForClass(destType);
    const sourceIsClassObject = (0, types_1.isClass)(srcType) && types_1.TypeBase.isInstantiable(srcType);
    const protocolTypeVarContext = createProtocolTypeVarContext(evaluator, destType, destTypeVarContext);
    const selfTypeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(destType));
    let selfType;
    if ((0, types_1.isClass)(srcType)) {
        // If the srcType is conditioned on "self", use "Self" as the selfType.
        // Otherwise use the class type for selfType.
        if ((_a = srcType.condition) === null || _a === void 0 ? void 0 : _a.some((c) => c.typeVar.details.isSynthesizedSelf)) {
            selfType = (0, typeUtils_1.synthesizeTypeVarForSelfCls)(types_1.TypeBase.cloneForCondition(srcType, undefined), 
            /* isClsType */ false);
        }
        else {
            selfType = srcType;
        }
        (0, typeUtils_1.populateTypeVarContextForSelfType)(selfTypeVarContext, destType, selfType);
    }
    // If the source is a TypedDict, use the _TypedDict placeholder class
    // instead. We don't want to use the TypedDict members for protocol
    // comparison.
    if ((0, types_1.isClass)(srcType) && types_1.ClassType.isTypedDictClass(srcType)) {
        const typedDictClassType = evaluator.getTypedDictClassType();
        if (typedDictClassType && (0, types_1.isInstantiableClass)(typedDictClassType)) {
            srcType = typedDictClassType;
        }
    }
    let typesAreConsistent = true;
    const checkedSymbolSet = new Set();
    let assignTypeFlags = flags & (16 /* AssignTypeFlags.OverloadOverlapCheck */ | 32 /* AssignTypeFlags.PartialOverloadOverlapCheck */);
    assignTypeFlags |= (0, typeUtils_1.containsLiteralType)(srcType, /* includeTypeArgs */ true)
        ? 256 /* AssignTypeFlags.RetainLiteralsForTypeVar */
        : 0 /* AssignTypeFlags.Default */;
    destType.details.mro.forEach((mroClass) => {
        if (!(0, types_1.isInstantiableClass)(mroClass) || !types_1.ClassType.isProtocolClass(mroClass)) {
            return;
        }
        // If we've already determined that the types are not consistent and the caller
        // hasn't requested detailed diagnostic output, we can shortcut the remainder.
        if (!typesAreConsistent && !diag) {
            return;
        }
        types_1.ClassType.getSymbolTable(mroClass).forEach((destSymbol, name) => {
            var _a;
            // If we've already determined that the types are not consistent and the caller
            // hasn't requested detailed diagnostic output, we can shortcut the remainder.
            if (!typesAreConsistent && !diag) {
                return;
            }
            if (!destSymbol.isClassMember() || destSymbol.isIgnoredForProtocolMatch() || checkedSymbolSet.has(name)) {
                return;
            }
            let isMemberFromMetaclass = false;
            let srcMemberInfo;
            let srcSymbol;
            // Special-case the `__class_getitem__` for normal protocol comparison.
            // This is a convention agreed upon by typeshed maintainers.
            if (!sourceIsClassObject && name === '__class_getitem__') {
                return;
            }
            // Special-case the `__slots__` entry for all protocol comparisons.
            // This is a convention agreed upon by typeshed maintainers.
            if (name === '__slots__') {
                return;
            }
            // Note that we've already checked this symbol. It doesn't need to
            // be checked again even if it is declared by a subclass.
            checkedSymbolSet.add(name);
            let destMemberType = (_a = evaluator.getDeclaredTypeOfSymbol(destSymbol)) === null || _a === void 0 ? void 0 : _a.type;
            if (!destMemberType) {
                return;
            }
            let srcMemberType;
            let isSrcReadOnly = false;
            if ((0, types_1.isClass)(srcType)) {
                // Look in the metaclass first if we're treating the source as an instantiable class.
                if (sourceIsClassObject &&
                    srcType.details.effectiveMetaclass &&
                    (0, types_1.isInstantiableClass)(srcType.details.effectiveMetaclass)) {
                    srcMemberInfo = (0, typeUtils_1.lookUpClassMember)(srcType.details.effectiveMetaclass, name);
                    if (srcMemberInfo) {
                        isMemberFromMetaclass = true;
                    }
                }
                if (!srcMemberInfo) {
                    srcMemberInfo = (0, typeUtils_1.lookUpClassMember)(srcType, name);
                }
                if (!srcMemberInfo) {
                    diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.protocolMemberMissing().format({ name }));
                    typesAreConsistent = false;
                    return;
                }
                srcSymbol = srcMemberInfo.symbol;
                // Partially specialize the type of the symbol based on the MRO class.
                // We can skip this if it's the dest class because it is already
                // specialized.
                if (!types_1.ClassType.isSameGenericClass(mroClass, destType)) {
                    destMemberType = (0, typeUtils_1.partiallySpecializeType)(destMemberType, mroClass, selfType);
                }
                if ((0, types_1.isInstantiableClass)(srcMemberInfo.classType)) {
                    const symbolType = evaluator.getEffectiveTypeOfSymbol(srcMemberInfo.symbol);
                    // If this is a function, infer its return type prior to specializing it.
                    if ((0, types_1.isFunction)(symbolType)) {
                        evaluator.inferReturnTypeIfNecessary(symbolType);
                    }
                    srcMemberType = (0, typeUtils_1.partiallySpecializeType)(symbolType, srcMemberInfo.classType, selfType);
                }
                else {
                    srcMemberType = types_1.UnknownType.create();
                }
                // If the source is a method, bind it.
                if ((0, types_1.isFunction)(srcMemberType) || (0, types_1.isOverloadedFunction)(srcMemberType)) {
                    if (isMemberFromMetaclass || (0, types_1.isInstantiableClass)(srcMemberInfo.classType)) {
                        let isInstanceMember = !srcMemberInfo.symbol.isClassMember();
                        // Special-case dataclasses whose entries act like instance members.
                        if (types_1.ClassType.isDataClass(srcType)) {
                            const dataClassFields = types_1.ClassType.getDataClassEntries(srcType);
                            if (dataClassFields.some((entry) => entry.name === name)) {
                                isInstanceMember = true;
                            }
                        }
                        if (isMemberFromMetaclass) {
                            isInstanceMember = false;
                        }
                        // If this is a callable stored in an instance member, skip binding.
                        if (!isInstanceMember) {
                            const boundSrcFunction = evaluator.bindFunctionToClassOrObject(sourceIsClassObject && !isMemberFromMetaclass
                                ? srcType
                                : types_1.ClassType.cloneAsInstance(srcType), srcMemberType, isMemberFromMetaclass ? undefined : srcMemberInfo.classType, 
                            /* treatConstructorAsClassMethod */ undefined, isMemberFromMetaclass ? srcType : selfType, diag === null || diag === void 0 ? void 0 : diag.createAddendum(), recursionCount);
                            if (boundSrcFunction) {
                                srcMemberType = boundSrcFunction;
                            }
                            else {
                                typesAreConsistent = false;
                                return;
                            }
                        }
                    }
                }
                // Frozen dataclasses and named tuples should be treated as read-only.
                if (types_1.ClassType.isDataClassFrozen(srcType) || types_1.ClassType.isReadOnlyInstanceVariables(srcType)) {
                    isSrcReadOnly = true;
                }
            }
            else {
                srcSymbol = srcType.fields.get(name);
                if (!srcSymbol) {
                    diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.protocolMemberMissing().format({ name }));
                    typesAreConsistent = false;
                    return;
                }
                srcMemberType = evaluator.getEffectiveTypeOfSymbol(srcSymbol);
            }
            // Replace any "Self" TypeVar within the dest with the source type.
            destMemberType = (0, typeUtils_1.applySolvedTypeVars)(destMemberType, selfTypeVarContext);
            // If the dest is a method, bind it.
            if ((0, types_1.isFunction)(destMemberType) || (0, types_1.isOverloadedFunction)(destMemberType)) {
                let boundDeclaredType;
                if ((0, types_1.isClass)(srcType)) {
                    (0, debug_1.assert)(srcMemberInfo);
                    if (isMemberFromMetaclass || (0, types_1.isInstantiableClass)(srcMemberInfo.classType)) {
                        boundDeclaredType = evaluator.bindFunctionToClassOrObject(types_1.ClassType.cloneAsInstance(srcType), destMemberType, isMemberFromMetaclass ? undefined : srcMemberInfo.classType, 
                        /* treatConstructorAsClassMethod */ undefined, isMemberFromMetaclass ? srcType : selfType, diag, recursionCount);
                    }
                }
                else {
                    boundDeclaredType = evaluator.bindFunctionToClassOrObject(types_1.ClassType.cloneAsInstance(destType), destMemberType, destType, 
                    /* treatConstructorAsClassMethod */ undefined, 
                    /* firstParamType */ undefined, diag, recursionCount);
                }
                if (boundDeclaredType) {
                    destMemberType = boundDeclaredType;
                }
                else {
                    typesAreConsistent = false;
                    return;
                }
            }
            const subDiag = diag === null || diag === void 0 ? void 0 : diag.createAddendum();
            // Properties require special processing.
            if ((0, types_1.isClassInstance)(destMemberType) && types_1.ClassType.isPropertyClass(destMemberType)) {
                if ((0, types_1.isClassInstance)(srcMemberType) &&
                    types_1.ClassType.isPropertyClass(srcMemberType) &&
                    !sourceIsClassObject) {
                    if (!(0, properties_1.assignProperty)(evaluator, types_1.ClassType.cloneAsInstantiable(destMemberType), types_1.ClassType.cloneAsInstantiable(srcMemberType), mroClass, srcType, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), protocolTypeVarContext, selfTypeVarContext, recursionCount)) {
                        if (subDiag) {
                            subDiag.addMessage(localize_1.LocAddendum.memberTypeMismatch().format({ name }));
                        }
                        typesAreConsistent = false;
                    }
                }
                else {
                    // Extract the property type from the property class.
                    let getterType = evaluator.getGetterTypeFromProperty(destMemberType, /* inferTypeIfNeeded */ true);
                    if (getterType) {
                        getterType = (0, typeUtils_1.partiallySpecializeType)(getterType, mroClass);
                    }
                    if (!getterType ||
                        !evaluator.assignType(getterType, srcMemberType, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), protocolTypeVarContext, 
                        /* srcTypeVarContext */ undefined, assignTypeFlags, recursionCount)) {
                        if (subDiag) {
                            subDiag.addMessage(localize_1.LocAddendum.memberTypeMismatch().format({ name }));
                        }
                        typesAreConsistent = false;
                    }
                    if (isSrcReadOnly) {
                        // The source attribute is read-only. Make sure the setter
                        // is not defined in the dest property.
                        if ((0, typeUtils_1.lookUpClassMember)(destMemberType, '__set__', 16 /* MemberAccessFlags.SkipInstanceMembers */)) {
                            if (subDiag) {
                                subDiag.addMessage(localize_1.LocAddendum.memberIsWritableInProtocol().format({ name }));
                            }
                            typesAreConsistent = false;
                        }
                    }
                }
            }
            else {
                // Class and instance variables that are mutable need to enforce invariance.
                const primaryDecl = destSymbol.getDeclarations()[0];
                const isInvariant = (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.type) === 1 /* DeclarationType.Variable */ && !primaryDecl.isFinal;
                // Temporarily add the TypeVar scope ID for this method to handle method-scoped TypeVars.
                const protocolTypeVarContextClone = protocolTypeVarContext.clone();
                protocolTypeVarContextClone.addSolveForScope((0, typeUtils_1.getTypeVarScopeId)(destMemberType));
                if (!evaluator.assignType(destMemberType, srcMemberType, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), protocolTypeVarContextClone, 
                /* srcTypeVarContext */ undefined, isInvariant ? assignTypeFlags | 1 /* AssignTypeFlags.EnforceInvariance */ : assignTypeFlags, recursionCount)) {
                    if (subDiag) {
                        if (isInvariant) {
                            subDiag.addMessage(localize_1.LocAddendum.memberIsInvariant().format({ name }));
                        }
                        subDiag.addMessage(localize_1.LocAddendum.memberTypeMismatch().format({ name }));
                    }
                    typesAreConsistent = false;
                }
                else {
                    protocolTypeVarContext.copyFromClone(protocolTypeVarContextClone);
                }
            }
            const isDestFinal = destSymbol
                .getTypedDeclarations()
                .some((decl) => decl.type === 1 /* DeclarationType.Variable */ && !!decl.isFinal);
            const isSrcFinal = srcSymbol
                .getTypedDeclarations()
                .some((decl) => decl.type === 1 /* DeclarationType.Variable */ && !!decl.isFinal);
            if (isDestFinal !== isSrcFinal) {
                if (isDestFinal) {
                    if (subDiag) {
                        subDiag.addMessage(localize_1.LocAddendum.memberIsFinalInProtocol().format({ name }));
                    }
                }
                else {
                    if (subDiag) {
                        subDiag.addMessage(localize_1.LocAddendum.memberIsNotFinalInProtocol().format({ name }));
                    }
                }
                typesAreConsistent = false;
            }
            const isDestClassVar = (0, symbolUtils_1.isEffectivelyClassVar)(destSymbol, /* isDataclass */ false);
            const isSrcClassVar = (0, symbolUtils_1.isEffectivelyClassVar)(srcSymbol, /* isDataclass */ false);
            const isSrcVariable = srcSymbol.getDeclarations().some((decl) => decl.type === 1 /* DeclarationType.Variable */);
            if (sourceIsClassObject) {
                // If the source is not marked as a ClassVar or the dest (the protocol) is,
                // the types are not consistent given that the source is a class object.
                if (isDestClassVar) {
                    subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.memberIsClassVarInProtocol().format({ name }));
                    typesAreConsistent = false;
                }
                else if (isSrcVariable && !isSrcClassVar) {
                    if (!isMemberFromMetaclass) {
                        subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.memberIsNotClassVarInClass().format({ name }));
                        typesAreConsistent = false;
                    }
                }
            }
            else {
                // If the source is marked as a ClassVar but the dest (the protocol) is not,
                // or vice versa, the types are not consistent.
                if (isDestClassVar !== isSrcClassVar) {
                    if (isDestClassVar) {
                        subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.memberIsClassVarInProtocol().format({ name }));
                    }
                    else {
                        subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.memberIsNotClassVarInProtocol().format({ name }));
                    }
                    typesAreConsistent = false;
                }
            }
            const destPrimaryDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(destSymbol);
            const srcPrimaryDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(srcSymbol);
            if ((destPrimaryDecl === null || destPrimaryDecl === void 0 ? void 0 : destPrimaryDecl.type) === 1 /* DeclarationType.Variable */ &&
                (srcPrimaryDecl === null || srcPrimaryDecl === void 0 ? void 0 : srcPrimaryDecl.type) === 1 /* DeclarationType.Variable */) {
                const isDestReadOnly = !!destPrimaryDecl.isConstant;
                let isSrcReadOnly = !!srcPrimaryDecl.isConstant;
                if (srcMemberInfo && (0, types_1.isClass)(srcMemberInfo.classType)) {
                    if (types_1.ClassType.isReadOnlyInstanceVariables(srcMemberInfo.classType) ||
                        types_1.ClassType.isDataClassFrozen(srcMemberInfo.classType)) {
                        isSrcReadOnly = true;
                    }
                }
                if (!isDestReadOnly && isSrcReadOnly) {
                    if (subDiag) {
                        subDiag.addMessage(localize_1.LocAddendum.memberIsWritableInProtocol().format({ name }));
                    }
                    typesAreConsistent = false;
                }
            }
        });
    });
    // If the dest protocol has type parameters, make sure the source type arguments match.
    if (typesAreConsistent && destType.details.typeParameters.length > 0) {
        // Create a specialized version of the protocol defined by the dest and
        // make sure the resulting type args can be assigned.
        const genericProtocolType = types_1.ClassType.cloneForSpecialization(destType, undefined, 
        /* isTypeArgumentExplicit */ false);
        const specializedProtocolType = (0, typeUtils_1.applySolvedTypeVars)(genericProtocolType, protocolTypeVarContext);
        if (destType.typeArguments) {
            if (!evaluator.assignTypeArguments(destType, specializedProtocolType, diag, destTypeVarContext, srcTypeVarContext, flags, recursionCount)) {
                typesAreConsistent = false;
            }
        }
        else if (destTypeVarContext && !destTypeVarContext.isLocked()) {
            for (const typeParam of destType.details.typeParameters) {
                const typeArgEntry = protocolTypeVarContext.getPrimarySignature().getTypeVar(typeParam);
                if (typeArgEntry) {
                    destTypeVarContext.setTypeVarType(typeParam, typeArgEntry === null || typeArgEntry === void 0 ? void 0 : typeArgEntry.narrowBound, typeArgEntry === null || typeArgEntry === void 0 ? void 0 : typeArgEntry.narrowBoundNoLiterals, typeArgEntry === null || typeArgEntry === void 0 ? void 0 : typeArgEntry.wideBound);
                }
            }
        }
    }
    return typesAreConsistent;
}
// Given a (possibly-specialized) destType and an optional typeVarContext, creates
// a new typeVarContext that combines the constraints from both the destType and
// the destTypeVarContext.
function createProtocolTypeVarContext(evaluator, destType, destTypeVarContext) {
    const protocolTypeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(destType));
    destType.details.typeParameters.forEach((typeParam, index) => {
        const entry = destTypeVarContext === null || destTypeVarContext === void 0 ? void 0 : destTypeVarContext.getPrimarySignature().getTypeVar(typeParam);
        if (entry) {
            protocolTypeVarContext.setTypeVarType(typeParam, entry.narrowBound, entry.narrowBoundNoLiterals, entry.wideBound);
        }
        else if (destType.typeArguments && index < destType.typeArguments.length) {
            let typeArg = destType.typeArguments[index];
            let flags;
            let hasUnsolvedTypeVars = (0, typeUtils_1.requiresSpecialization)(typeArg);
            // If the type argument has unsolved TypeVars, see if they have
            // solved values in the destTypeVarContext.
            if (hasUnsolvedTypeVars && destTypeVarContext) {
                typeArg = (0, typeUtils_1.applySolvedTypeVars)(typeArg, destTypeVarContext, { useNarrowBoundOnly: true });
                flags = 0 /* AssignTypeFlags.Default */;
                hasUnsolvedTypeVars = (0, typeUtils_1.requiresSpecialization)(typeArg);
            }
            else {
                flags = 2048 /* AssignTypeFlags.PopulatingExpectedType */;
                const variance = types_1.TypeVarType.getVariance(typeParam);
                if (variance === 2 /* Variance.Invariant */) {
                    flags |= 1 /* AssignTypeFlags.EnforceInvariance */;
                }
                else if (variance === 4 /* Variance.Contravariant */) {
                    flags |= 2 /* AssignTypeFlags.ReverseTypeVarMatching */;
                }
            }
            if (!hasUnsolvedTypeVars) {
                (0, constraintSolver_1.assignTypeToTypeVar)(evaluator, typeParam, typeArg, /* diag */ undefined, protocolTypeVarContext, flags);
            }
        }
    });
    return protocolTypeVarContext;
}
//# sourceMappingURL=protocols.js.map