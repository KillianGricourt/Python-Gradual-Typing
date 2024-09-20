"use strict";
/*
 * typeUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Functions that operate on Type objects.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.partiallySpecializeType = exports.isTupleIndexUnambiguous = exports.isUnboundedTupleClass = exports.isTupleClass = exports.isMaybeDescriptorInstance = exports.isDescriptorInstance = exports.isCallableType = exports.isProperty = exports.isEllipsisType = exports.getUnionSubtypeCount = exports.getLiteralTypeClassName = exports.containsLiteralType = exports.isLiteralTypeOrUnion = exports.isLiteralType = exports.getSpecializedTupleType = exports.selfSpecializeClass = exports.getUnknownTypeForCallable = exports.getUnknownTypeForVariadicTypeVar = exports.getUnknownTypeForParamSpec = exports.getUnknownTypeForTypeVar = exports.specializeWithUnknownTypeArgs = exports.specializeWithDefaultTypeArgs = exports.getTypeVarScopeIds = exports.getTypeVarScopeId = exports.transformPossibleRecursiveTypeAlias = exports.isTypeAliasRecursive = exports.isTypeAliasPlaceholder = exports.getTypeCondition = exports.addConditionToType = exports.getFullNameOfType = exports.derivesFromAnyOrUnknown = exports.isUnionableType = exports.preserveUnknown = exports.areTypesSame = exports.doForEachSignature = exports.allSubtypes = exports.someSubtypes = exports.doForEachSubtype = exports.sortTypes = exports.cleanIncompleteUnknown = exports.mapSignatures = exports.mapSubtypes = exports.makeInferenceContext = exports.isTypeVarSame = exports.isIncompleteUnknown = exports.removeNoneFromUnion = exports.isNoneTypeClass = exports.isNoneInstance = exports.isOptionalType = exports.UniqueSignatureTracker = void 0;
exports.convertTypeToParamSpecValue = exports.getDeclaringModulesForType = exports.computeMroLinearization = exports.isVarianceOfTypeArgumentCompatible = exports.combineVariances = exports.requiresSpecialization = exports.requiresTypeArguments = exports.getGeneratorTypeArgs = exports.specializeTupleClass = exports.combineSameSizedTuples = exports.explodeGenericClass = exports.isPartlyUnknown = exports.containsAnyOrUnknown = exports.containsAnyRecursive = exports.getMembersForModule = exports.getMembersForClass = exports.convertToInstantiable = exports.convertToInstance = exports.isEffectivelyInstantiable = exports.isMetaclassInstance = exports.isInstantiableMetaclass = exports.getGeneratorYieldType = exports.getDeclaredGeneratorReturnType = exports.synthesizeTypeVarForSelfCls = exports.derivesFromClassRecursive = exports.derivesFromStdlibClass = exports.specializeForBaseClass = exports.buildTypeVarContext = exports.buildTypeVarContextFromSpecializedClass = exports.setTypeArgumentsRecursive = exports.specializeClassType = exports.getTypeVarArgumentsRecursive = exports.addTypeVarsToListIfUnique = exports.getClassFieldsRecursive = exports.getClassIterator = exports.getClassMemberIterator = exports.lookUpClassMember = exports.lookUpObjectMember = exports.getContainerDepth = exports.getProtocolSymbolsRecursive = exports.getProtocolSymbols = exports.transformExpectedType = exports.replaceTypeVarsWithAny = exports.validateTypeVarDefault = exports.applyInScopePlaceholders = exports.applySourceContextTypeVarsToSignature = exports.applySourceContextTypeVars = exports.applySolvedTypeVars = exports.ensureFunctionSignaturesAreUnique = exports.populateTypeVarContextForSelfType = void 0;
exports.convertParamSpecValueToType = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const debug_1 = require("../common/debug");
const symbol_1 = require("./symbol");
const symbolUtils_1 = require("./symbolUtils");
const types_1 = require("./types");
const typeVarContext_1 = require("./typeVarContext");
const typeWalker_1 = require("./typeWalker");
// Tracks whether a function signature has been seen before within
// an expression. For example, in the expression "foo(foo, foo)", the
// signature for "foo" will be seen three times at three different
// file offsets. If the signature is generic, we need to create unique
// type variables for each instance because they are independent of
// each other.
class UniqueSignatureTracker {
    constructor() {
        this._trackedSignatures = [];
    }
    getTrackedSignatures() {
        return this._trackedSignatures;
    }
    addTrackedSignatures(signatures) {
        signatures.forEach((s) => {
            s.expressionOffsets.forEach((offset) => {
                this.addSignature(s.type, offset);
            });
        });
    }
    findSignature(signature) {
        // Use the associated overload type if this is a function associated with an overload.
        let effectiveSignature = signature;
        if ((0, types_1.isFunction)(signature) && signature.overloaded) {
            effectiveSignature = signature.overloaded;
        }
        return this._trackedSignatures.find((s) => {
            return (0, types_1.isTypeSame)(effectiveSignature, s.type);
        });
    }
    addSignature(signature, offset) {
        var _a;
        // If this function is part of a broader overload, use the overload instead.
        const effectiveSignature = (0, types_1.isFunction)(signature) ? (_a = signature.overloaded) !== null && _a !== void 0 ? _a : signature : signature;
        const existingSignature = this.findSignature(effectiveSignature);
        if (existingSignature) {
            if (!existingSignature.expressionOffsets.some((o) => o === offset)) {
                existingSignature.expressionOffsets.push(offset);
            }
        }
        else {
            this._trackedSignatures.push({ type: effectiveSignature, expressionOffsets: [offset] });
        }
    }
}
exports.UniqueSignatureTracker = UniqueSignatureTracker;
function isOptionalType(type) {
    if ((0, types_1.isUnion)(type)) {
        return (0, types_1.findSubtype)(type, (subtype) => isNoneInstance(subtype)) !== undefined;
    }
    return false;
}
exports.isOptionalType = isOptionalType;
function isNoneInstance(type) {
    return (0, types_1.isClassInstance)(type) && types_1.ClassType.isBuiltIn(type, 'NoneType');
}
exports.isNoneInstance = isNoneInstance;
function isNoneTypeClass(type) {
    return (0, types_1.isInstantiableClass)(type) && types_1.ClassType.isBuiltIn(type, 'NoneType');
}
exports.isNoneTypeClass = isNoneTypeClass;
// If the type is a union, remove an "None" type from the union,
// returning only the known types.
function removeNoneFromUnion(type) {
    return (0, types_1.removeFromUnion)(type, (t) => isNoneInstance(t));
}
exports.removeNoneFromUnion = removeNoneFromUnion;
function isIncompleteUnknown(type) {
    return (0, types_1.isUnknown)(type) && type.isIncomplete;
}
exports.isIncompleteUnknown = isIncompleteUnknown;
// Similar to isTypeSame except that type1 is a TypeVar and type2
// can be either a TypeVar of the same type or a union that includes
// conditional types associated with that bound TypeVar.
function isTypeVarSame(type1, type2) {
    if ((0, types_1.isTypeSame)(type1, type2)) {
        return true;
    }
    // If this isn't a bound TypeVar, return false.
    if (type1.details.isParamSpec || type1.details.isVariadic || !type1.details.boundType) {
        return false;
    }
    // If the second type isn't a union, return false.
    if (!(0, types_1.isUnion)(type2)) {
        return false;
    }
    let isCompatible = true;
    doForEachSubtype(type2, (subtype) => {
        if (!isCompatible) {
            return;
        }
        if (!(0, types_1.isTypeSame)(type1, subtype)) {
            const conditions = getTypeCondition(subtype);
            if (!conditions ||
                !conditions.some((condition) => condition.typeVar.nameWithScope === type1.nameWithScope)) {
                isCompatible = false;
            }
        }
    });
    return isCompatible;
}
exports.isTypeVarSame = isTypeVarSame;
function makeInferenceContext(expectedType, isTypeIncomplete) {
    if (!expectedType) {
        return undefined;
    }
    return { expectedType, isTypeIncomplete };
}
exports.makeInferenceContext = makeInferenceContext;
// Calls a callback for each subtype and combines the results
// into a final type. It performs no memory allocations if the
// transformed type is the same as the original.
function mapSubtypes(type, callback, sortSubtypes = false) {
    if ((0, types_1.isUnion)(type)) {
        const subtypes = sortSubtypes ? sortTypes(type.subtypes) : type.subtypes;
        for (let i = 0; i < subtypes.length; i++) {
            const subtype = subtypes[i];
            const transformedType = callback(subtype);
            // Avoid doing any memory allocations until a change is detected.
            if (subtype !== transformedType) {
                const typesToCombine = subtypes.slice(0, i);
                // Create a helper lambda that accumulates transformed subtypes.
                const accumulateSubtype = (newSubtype) => {
                    if (newSubtype) {
                        typesToCombine.push(addConditionToType(newSubtype, getTypeCondition(type)));
                    }
                };
                accumulateSubtype(transformedType);
                for (i++; i < subtypes.length; i++) {
                    accumulateSubtype(callback(subtypes[i]));
                }
                const newType = (0, types_1.combineTypes)(typesToCombine);
                // Do our best to retain type aliases.
                if (newType.category === 8 /* TypeCategory.Union */) {
                    types_1.UnionType.addTypeAliasSource(newType, type);
                }
                return newType;
            }
        }
        return type;
    }
    const transformedSubtype = callback(type);
    if (!transformedSubtype) {
        return types_1.NeverType.createNever();
    }
    return transformedSubtype;
}
exports.mapSubtypes = mapSubtypes;
// Iterates over each signature in a function or overload, allowing the
// caller to replace one or more signatures with new ones.
function mapSignatures(type, callback) {
    if ((0, types_1.isFunction)(type)) {
        return callback(type, 0);
    }
    const newSignatures = [];
    let changeMade = false;
    types_1.OverloadedFunctionType.getOverloads(type).forEach((overload, index) => {
        const newOverload = callback(overload, index);
        if (newOverload !== overload) {
            changeMade = true;
        }
        if (newOverload) {
            newSignatures.push(newOverload);
        }
    });
    if (newSignatures.length === 0) {
        return undefined;
    }
    // Add the unmodified implementation if it's present.
    const implementation = types_1.OverloadedFunctionType.getImplementation(type);
    if (implementation) {
        newSignatures.push(implementation);
    }
    if (!changeMade) {
        return type;
    }
    if (newSignatures.length === 1) {
        return newSignatures[0];
    }
    return types_1.OverloadedFunctionType.create(newSignatures);
}
exports.mapSignatures = mapSignatures;
// The code flow engine uses a special form of the UnknownType (with the
// isIncomplete flag set) to distinguish between an unknown that was generated
// in a loop because it was temporarily incomplete versus an unknown that is
// permanently incomplete. Once an unknown appears within a loop, it is often
// propagated to other types during code flow analysis. We want to remove these
// incomplete unknowns if we find that they are union'ed with other types.
function cleanIncompleteUnknown(type, recursionCount = 0) {
    if (recursionCount >= types_1.maxTypeRecursionCount) {
        return type;
    }
    recursionCount++;
    const result = mapSubtypes(type, (subtype) => {
        // If it's an incomplete unknown, eliminate it.
        if ((0, types_1.isUnknown)(subtype) && subtype.isIncomplete) {
            return undefined;
        }
        if ((0, types_1.isClass)(subtype) && subtype.typeArguments) {
            let typeChanged = false;
            if (subtype.tupleTypeArguments) {
                const updatedTupleTypeArgs = subtype.tupleTypeArguments.map((tupleTypeArg) => {
                    const newTypeArg = cleanIncompleteUnknown(tupleTypeArg.type, recursionCount);
                    if (newTypeArg !== tupleTypeArg.type) {
                        typeChanged = true;
                    }
                    return {
                        type: newTypeArg,
                        isUnbounded: tupleTypeArg.isUnbounded,
                        isOptional: tupleTypeArg.isOptional,
                    };
                });
                if (typeChanged) {
                    return specializeTupleClass(subtype, updatedTupleTypeArgs, !!subtype.isTypeArgumentExplicit, !!subtype.isUnpacked);
                }
            }
            else {
                const updatedTypeArgs = subtype.typeArguments.map((typeArg) => {
                    const newTypeArg = cleanIncompleteUnknown(typeArg, recursionCount);
                    if (newTypeArg !== typeArg) {
                        typeChanged = true;
                    }
                    return newTypeArg;
                });
                if (typeChanged) {
                    return types_1.ClassType.cloneForSpecialization(subtype, updatedTypeArgs, !!subtype.isTypeArgumentExplicit);
                }
            }
        }
        // TODO - this doesn't currently handle function types.
        return subtype;
    });
    // If we eliminated everything, don't return a Never.
    return (0, types_1.isNever)(result) ? type : result;
}
exports.cleanIncompleteUnknown = cleanIncompleteUnknown;
// Sorts types into a deterministic order.
function sortTypes(types) {
    return types.slice(0).sort((a, b) => {
        return compareTypes(a, b);
    });
}
exports.sortTypes = sortTypes;
function compareTypes(a, b, recursionCount = 0) {
    var _a, _b;
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return 0;
    }
    recursionCount++;
    if (a.category !== b.category) {
        return b.category - a.category;
    }
    switch (a.category) {
        case 0 /* TypeCategory.Unbound */:
        case 1 /* TypeCategory.Unknown */:
        case 2 /* TypeCategory.Any */:
        case 3 /* TypeCategory.Never */:
        case 8 /* TypeCategory.Union */: {
            return 0;
        }
        case 4 /* TypeCategory.Function */: {
            const bFunc = b;
            const aParamCount = a.details.parameters.length;
            const bParamCount = bFunc.details.parameters.length;
            if (aParamCount !== bParamCount) {
                return bParamCount - aParamCount;
            }
            for (let i = 0; i < aParamCount; i++) {
                const aParam = a.details.parameters[i];
                const bParam = bFunc.details.parameters[i];
                if (aParam.category !== bParam.category) {
                    return bParam.category - aParam.category;
                }
                const typeComparison = compareTypes(types_1.FunctionType.getEffectiveParameterType(a, i), types_1.FunctionType.getEffectiveParameterType(bFunc, i));
                if (typeComparison !== 0) {
                    return typeComparison;
                }
            }
            const returnTypeComparison = compareTypes((_a = types_1.FunctionType.getEffectiveReturnType(a)) !== null && _a !== void 0 ? _a : types_1.UnknownType.create(), (_b = types_1.FunctionType.getEffectiveReturnType(bFunc)) !== null && _b !== void 0 ? _b : types_1.UnknownType.create());
            if (returnTypeComparison !== 0) {
                return returnTypeComparison;
            }
            const aName = a.details.name;
            const bName = bFunc.details.name;
            if (aName < bName) {
                return -1;
            }
            else if (aName > bName) {
                return 1;
            }
            return 0;
        }
        case 5 /* TypeCategory.OverloadedFunction */: {
            const bOver = b;
            const aOverloadCount = a.overloads.length;
            const bOverloadCount = bOver.overloads.length;
            if (aOverloadCount !== bOverloadCount) {
                return bOverloadCount - aOverloadCount;
            }
            for (let i = 0; i < aOverloadCount; i++) {
                const typeComparison = compareTypes(a.overloads[i], bOver.overloads[i]);
                if (typeComparison !== 0) {
                    return typeComparison;
                }
            }
            return 0;
        }
        case 6 /* TypeCategory.Class */: {
            const bClass = b;
            // Sort instances before instantiables.
            if ((0, types_1.isClassInstance)(a) && (0, types_1.isInstantiableClass)(bClass)) {
                return -1;
            }
            else if ((0, types_1.isInstantiableClass)(a) && (0, types_1.isClassInstance)(bClass)) {
                return 1;
            }
            // Sort literals before non-literals.
            if (isLiteralType(a)) {
                if (!isLiteralType(bClass)) {
                    return -1;
                }
            }
            else if (isLiteralType(bClass)) {
                return 1;
            }
            // Always sort NoneType at the end.
            if (types_1.ClassType.isBuiltIn(a, 'NoneType')) {
                return 1;
            }
            else if (types_1.ClassType.isBuiltIn(bClass, 'NoneType')) {
                return -1;
            }
            // Sort non-generics before generics.
            if (a.details.typeParameters.length > 0 || isTupleClass(a)) {
                if (bClass.details.typeParameters.length === 0) {
                    return 1;
                }
            }
            else if (bClass.details.typeParameters.length > 0 || isTupleClass(bClass)) {
                return -1;
            }
            // Sort by class name.
            const aName = a.details.name;
            const bName = b.details.name;
            if (aName < bName) {
                return -1;
            }
            else if (aName > bName) {
                return 1;
            }
            // Sort by type argument count.
            const aTypeArgCount = a.typeArguments ? a.typeArguments.length : 0;
            const bTypeArgCount = bClass.typeArguments ? bClass.typeArguments.length : 0;
            if (aTypeArgCount < bTypeArgCount) {
                return -1;
            }
            else if (aTypeArgCount > bTypeArgCount) {
                return 1;
            }
            // Sort by type argument.
            for (let i = 0; i < aTypeArgCount; i++) {
                const typeComparison = compareTypes(a.typeArguments[i], bClass.typeArguments[i], recursionCount);
                if (typeComparison !== 0) {
                    return typeComparison;
                }
            }
            return 0;
        }
        case 7 /* TypeCategory.Module */: {
            const aName = a.moduleName;
            const bName = b.moduleName;
            return aName < bName ? -1 : aName === bName ? 0 : 1;
        }
        case 9 /* TypeCategory.TypeVar */: {
            const aName = a.details.name;
            const bName = b.details.name;
            return aName < bName ? -1 : aName === bName ? 0 : 1;
        }
    }
    return 1;
}
function doForEachSubtype(type, callback, sortSubtypes = false) {
    if ((0, types_1.isUnion)(type)) {
        const subtypes = sortSubtypes ? sortTypes(type.subtypes) : type.subtypes;
        subtypes.forEach((subtype, index) => {
            callback(subtype, index, subtypes);
        });
    }
    else {
        callback(type, 0, [type]);
    }
}
exports.doForEachSubtype = doForEachSubtype;
function someSubtypes(type, callback) {
    if ((0, types_1.isUnion)(type)) {
        return type.subtypes.some((subtype) => {
            return callback(subtype);
        });
    }
    else {
        return callback(type);
    }
}
exports.someSubtypes = someSubtypes;
function allSubtypes(type, callback) {
    if ((0, types_1.isUnion)(type)) {
        return type.subtypes.every((subtype) => {
            callback(subtype);
        });
    }
    else {
        return callback(type);
    }
}
exports.allSubtypes = allSubtypes;
function doForEachSignature(type, callback) {
    if ((0, types_1.isFunction)(type)) {
        callback(type, 0);
    }
    else {
        types_1.OverloadedFunctionType.getOverloads(type).forEach((overload, index) => {
            callback(overload, index);
        });
    }
}
exports.doForEachSignature = doForEachSignature;
// Determines if all of the types in the array are the same.
function areTypesSame(types, options) {
    if (types.length < 2) {
        return true;
    }
    for (let i = 1; i < types.length; i++) {
        if (!(0, types_1.isTypeSame)(types[0], types[i], options)) {
            return false;
        }
    }
    return true;
}
exports.areTypesSame = areTypesSame;
// If either type is "Unknown" (versus Any), propagate the Unknown. Preserve
// the incomplete flag on the unknown if present. The caller should verify that
// one or the other type is Unknown or Any.
function preserveUnknown(type1, type2) {
    if ((0, types_1.isUnknown)(type1) && type1.isIncomplete) {
        return type1;
    }
    else if ((0, types_1.isUnknown)(type2) && type2.isIncomplete) {
        return type2;
    }
    else if ((0, types_1.isUnknown)(type1) || (0, types_1.isUnknown)(type2)) {
        return types_1.UnknownType.create();
    }
    else {
        return types_1.AnyType.create();
    }
}
exports.preserveUnknown = preserveUnknown;
// Determines whether the specified type is a type that can be
// combined with other types for a union.
function isUnionableType(subtypes) {
    let typeFlags = 2 /* TypeFlags.Instance */ | 1 /* TypeFlags.Instantiable */;
    for (const subtype of subtypes) {
        typeFlags &= subtype.flags;
    }
    // All subtypes need to be instantiable. Some types (like Any
    // and None) are both instances and instantiable. It's OK to
    // include some of these, but at least one subtype needs to
    // be definitively instantiable (not an instance).
    return (typeFlags & 1 /* TypeFlags.Instantiable */) !== 0 && (typeFlags & 2 /* TypeFlags.Instance */) === 0;
}
exports.isUnionableType = isUnionableType;
function derivesFromAnyOrUnknown(type) {
    let anyOrUnknown = false;
    doForEachSubtype(type, (subtype) => {
        if ((0, types_1.isAnyOrUnknown)(type)) {
            anyOrUnknown = true;
        }
        else if ((0, types_1.isInstantiableClass)(subtype)) {
            if (types_1.ClassType.derivesFromAnyOrUnknown(subtype)) {
                anyOrUnknown = true;
            }
        }
        else if ((0, types_1.isClassInstance)(subtype)) {
            if (types_1.ClassType.derivesFromAnyOrUnknown(subtype)) {
                anyOrUnknown = true;
            }
        }
    });
    return anyOrUnknown;
}
exports.derivesFromAnyOrUnknown = derivesFromAnyOrUnknown;
function getFullNameOfType(type) {
    var _a;
    if ((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.fullName) {
        return type.typeAliasInfo.fullName;
    }
    switch (type.category) {
        case 2 /* TypeCategory.Any */:
        case 1 /* TypeCategory.Unknown */:
            return 'typing.Any';
        case 6 /* TypeCategory.Class */:
            return type.details.fullName;
        case 4 /* TypeCategory.Function */:
            return type.details.fullName;
        case 7 /* TypeCategory.Module */:
            return type.moduleName;
        case 5 /* TypeCategory.OverloadedFunction */:
            return type.overloads[0].details.fullName;
    }
    return undefined;
}
exports.getFullNameOfType = getFullNameOfType;
function addConditionToType(type, condition, skipSelfCondition = false) {
    if (!condition) {
        return type;
    }
    if (skipSelfCondition) {
        condition = condition.filter((c) => !c.typeVar.details.isSynthesizedSelf);
        if (condition.length === 0) {
            return type;
        }
    }
    switch (type.category) {
        case 0 /* TypeCategory.Unbound */:
        case 1 /* TypeCategory.Unknown */:
        case 2 /* TypeCategory.Any */:
        case 3 /* TypeCategory.Never */:
        case 7 /* TypeCategory.Module */:
        case 9 /* TypeCategory.TypeVar */:
            return type;
        case 4 /* TypeCategory.Function */:
            return types_1.TypeBase.cloneForCondition(type, types_1.TypeCondition.combine(type.condition, condition));
        case 5 /* TypeCategory.OverloadedFunction */:
            return types_1.OverloadedFunctionType.create(type.overloads.map((t) => addConditionToType(t, condition)));
        case 6 /* TypeCategory.Class */:
            return types_1.TypeBase.cloneForCondition(type, types_1.TypeCondition.combine(type.condition, condition));
        case 8 /* TypeCategory.Union */:
            return (0, types_1.combineTypes)(type.subtypes.map((t) => addConditionToType(t, condition)));
    }
}
exports.addConditionToType = addConditionToType;
function getTypeCondition(type) {
    switch (type.category) {
        case 0 /* TypeCategory.Unbound */:
        case 1 /* TypeCategory.Unknown */:
        case 2 /* TypeCategory.Any */:
        case 3 /* TypeCategory.Never */:
        case 7 /* TypeCategory.Module */:
        case 9 /* TypeCategory.TypeVar */:
        case 5 /* TypeCategory.OverloadedFunction */:
        case 8 /* TypeCategory.Union */:
            return undefined;
        case 6 /* TypeCategory.Class */:
        case 4 /* TypeCategory.Function */:
            return type.condition;
    }
}
exports.getTypeCondition = getTypeCondition;
// Indicates whether the specified type is a recursive type alias
// placeholder that has not yet been resolved.
function isTypeAliasPlaceholder(type) {
    return (0, types_1.isTypeVar)(type) && types_1.TypeVarType.isTypeAliasPlaceholder(type);
}
exports.isTypeAliasPlaceholder = isTypeAliasPlaceholder;
// Determines whether the type alias placeholder is used directly
// within the specified type. It's OK if it's used indirectly as
// a type argument.
function isTypeAliasRecursive(typeAliasPlaceholder, type) {
    if (type.category !== 8 /* TypeCategory.Union */) {
        if (type === typeAliasPlaceholder) {
            return true;
        }
        // Handle the specific case where the type alias directly refers to itself.
        // In this case, the type will be unbound because it could not be resolved.
        return ((0, types_1.isUnbound)(type) &&
            type.typeAliasInfo &&
            type.typeAliasInfo.name === typeAliasPlaceholder.details.recursiveTypeAliasName);
    }
    return ((0, types_1.findSubtype)(type, (subtype) => (0, types_1.isTypeVar)(subtype) && subtype.details === typeAliasPlaceholder.details) !==
        undefined);
}
exports.isTypeAliasRecursive = isTypeAliasRecursive;
function transformPossibleRecursiveTypeAlias(type) {
    var _a;
    if (type) {
        if ((0, types_1.isTypeVar)(type) && type.details.recursiveTypeAliasName && type.details.boundType) {
            const unspecializedType = types_1.TypeBase.isInstance(type)
                ? convertToInstance(type.details.boundType)
                : type.details.boundType;
            if (!((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.typeArguments) || !type.details.recursiveTypeParameters) {
                return unspecializedType;
            }
            const typeVarContext = buildTypeVarContext(type.details.recursiveTypeParameters, type.typeAliasInfo.typeArguments, getTypeVarScopeId(type));
            return applySolvedTypeVars(unspecializedType, typeVarContext);
        }
        if ((0, types_1.isUnion)(type) && type.includesRecursiveTypeAlias) {
            let newType = mapSubtypes(type, (subtype) => transformPossibleRecursiveTypeAlias(subtype));
            if (newType !== type && type.typeAliasInfo) {
                // Copy the type alias information if present.
                newType = types_1.TypeBase.cloneForTypeAlias(newType, type.typeAliasInfo.name, type.typeAliasInfo.fullName, type.typeAliasInfo.moduleName, type.typeAliasInfo.fileUri, type.typeAliasInfo.typeVarScopeId, type.typeAliasInfo.isPep695Syntax, type.typeAliasInfo.typeParameters, type.typeAliasInfo.typeArguments);
            }
            return newType;
        }
    }
    return type;
}
exports.transformPossibleRecursiveTypeAlias = transformPossibleRecursiveTypeAlias;
function getTypeVarScopeId(type) {
    if ((0, types_1.isClass)(type)) {
        return type.details.typeVarScopeId;
    }
    if ((0, types_1.isFunction)(type)) {
        return type.details.typeVarScopeId;
    }
    if ((0, types_1.isTypeVar)(type)) {
        return type.scopeId;
    }
    return undefined;
}
exports.getTypeVarScopeId = getTypeVarScopeId;
// This is similar to getTypeVarScopeId except that it includes
// the secondary scope IDs for functions.
function getTypeVarScopeIds(type) {
    const scopeIds = [];
    const scopeId = getTypeVarScopeId(type);
    if (scopeId) {
        scopeIds.push(scopeId);
    }
    if ((0, types_1.isFunction)(type)) {
        if (type.details.constructorTypeVarScopeId) {
            scopeIds.push(type.details.constructorTypeVarScopeId);
        }
        if (type.details.higherOrderTypeVarScopeIds) {
            scopeIds.push(...type.details.higherOrderTypeVarScopeIds);
        }
        if (type.boundTypeVarScopeId) {
            scopeIds.push(type.boundTypeVarScopeId);
        }
    }
    return scopeIds;
}
exports.getTypeVarScopeIds = getTypeVarScopeIds;
// If the class type is generic and does not already have type arguments
// specified, specialize it with default type arguments (Unknown or the
// default type if provided).
function specializeWithDefaultTypeArgs(type) {
    if (type.details.typeParameters.length === 0 || type.typeArguments) {
        return type;
    }
    return types_1.ClassType.cloneForSpecialization(type, type.details.typeParameters.map((param) => param.details.defaultType), 
    /* isTypeArgumentExplicit */ false, 
    /* includeSubclasses */ type.includeSubclasses);
}
exports.specializeWithDefaultTypeArgs = specializeWithDefaultTypeArgs;
// Specializes the class with "Unknown" type args (or the equivalent for ParamSpecs
// or TypeVarTuples).
function specializeWithUnknownTypeArgs(type, tupleClassType) {
    if (type.details.typeParameters.length === 0) {
        return type;
    }
    if (isTupleClass(type)) {
        return types_1.ClassType.cloneIncludeSubclasses(specializeTupleClass(type, [{ type: types_1.UnknownType.create(), isUnbounded: true }], 
        /* isTypeArgumentExplicit */ false), !!type.includeSubclasses);
    }
    return types_1.ClassType.cloneForSpecialization(type, type.details.typeParameters.map((param) => getUnknownTypeForTypeVar(param, tupleClassType)), 
    /* isTypeArgumentExplicit */ false, 
    /* includeSubclasses */ type.includeSubclasses);
}
exports.specializeWithUnknownTypeArgs = specializeWithUnknownTypeArgs;
// Returns "Unknown" for simple TypeVars or the equivalent for a ParamSpec.
function getUnknownTypeForTypeVar(typeVar, tupleClassType) {
    if (typeVar.details.isParamSpec) {
        return getUnknownTypeForParamSpec();
    }
    if (typeVar.details.isVariadic && tupleClassType) {
        return getUnknownTypeForVariadicTypeVar(tupleClassType);
    }
    return types_1.UnknownType.create();
}
exports.getUnknownTypeForTypeVar = getUnknownTypeForTypeVar;
// Returns the "Unknown" equivalent for a ParamSpec.
function getUnknownTypeForParamSpec() {
    const newFunction = types_1.FunctionType.createInstance('', '', '', 65536 /* FunctionTypeFlags.ParamSpecValue */ | 32768 /* FunctionTypeFlags.GradualCallableForm */);
    types_1.FunctionType.addDefaultParameters(newFunction);
    return newFunction;
}
exports.getUnknownTypeForParamSpec = getUnknownTypeForParamSpec;
function getUnknownTypeForVariadicTypeVar(tupleClassType) {
    (0, debug_1.assert)((0, types_1.isInstantiableClass)(tupleClassType) && types_1.ClassType.isBuiltIn(tupleClassType, 'tuple'));
    return types_1.ClassType.cloneAsInstance(specializeTupleClass(tupleClassType, [{ type: types_1.UnknownType.create(), isUnbounded: true }], 
    /* isTypeArgumentExplicit */ true, 
    /* isUnpackedTuple */ true));
}
exports.getUnknownTypeForVariadicTypeVar = getUnknownTypeForVariadicTypeVar;
// Returns the equivalent of "Callable[..., Unknown]".
function getUnknownTypeForCallable() {
    const newFunction = types_1.FunctionType.createSynthesizedInstance('', 32768 /* FunctionTypeFlags.GradualCallableForm */);
    types_1.FunctionType.addDefaultParameters(newFunction);
    newFunction.details.declaredReturnType = types_1.UnknownType.create();
    return newFunction;
}
exports.getUnknownTypeForCallable = getUnknownTypeForCallable;
// If the class is generic and not already specialized, this function
// "self specializes" the class, filling in its own type parameters
// as type arguments.
function selfSpecializeClass(type, options) {
    if (type.details.typeParameters.length === 0) {
        return type;
    }
    if (type.typeArguments && !(options === null || options === void 0 ? void 0 : options.overrideTypeArgs)) {
        return type;
    }
    const typeParams = type.details.typeParameters;
    return types_1.ClassType.cloneForSpecialization(type, typeParams, /* isTypeArgumentExplicit */ true);
}
exports.selfSpecializeClass = selfSpecializeClass;
// Determines whether the type derives from tuple. If so, it returns
// the specialized tuple type.
function getSpecializedTupleType(type) {
    let classType;
    if ((0, types_1.isInstantiableClass)(type)) {
        classType = type;
    }
    else if ((0, types_1.isClassInstance)(type)) {
        classType = types_1.ClassType.cloneAsInstantiable(type);
    }
    if (!classType) {
        return undefined;
    }
    // See if this class derives from Tuple or tuple. If it does, we'll assume that it
    // hasn't been overridden in a way that changes the behavior of the tuple class.
    const tupleClass = classType.details.mro.find((mroClass) => (0, types_1.isInstantiableClass)(mroClass) && isTupleClass(mroClass));
    if (!tupleClass || !(0, types_1.isInstantiableClass)(tupleClass)) {
        return undefined;
    }
    if (types_1.ClassType.isSameGenericClass(classType, tupleClass)) {
        return classType;
    }
    const typeVarContext = buildTypeVarContextFromSpecializedClass(classType);
    return applySolvedTypeVars(tupleClass, typeVarContext);
}
exports.getSpecializedTupleType = getSpecializedTupleType;
function isLiteralType(type) {
    return types_1.TypeBase.isInstance(type) && type.literalValue !== undefined;
}
exports.isLiteralType = isLiteralType;
function isLiteralTypeOrUnion(type, allowNone = false) {
    if ((0, types_1.isClassInstance)(type)) {
        if (allowNone && isNoneInstance(type)) {
            return true;
        }
        return type.literalValue !== undefined;
    }
    if ((0, types_1.isUnion)(type)) {
        return !(0, types_1.findSubtype)(type, (subtype) => {
            if (!(0, types_1.isClassInstance)(subtype)) {
                return true;
            }
            if (isNoneInstance(subtype)) {
                return !allowNone;
            }
            return subtype.literalValue === undefined;
        });
    }
    return false;
}
exports.isLiteralTypeOrUnion = isLiteralTypeOrUnion;
function containsLiteralType(type, includeTypeArgs = false) {
    class ContainsLiteralTypeWalker extends typeWalker_1.TypeWalker {
        constructor(_includeTypeArgs) {
            super();
            this._includeTypeArgs = _includeTypeArgs;
            this.foundLiteral = false;
        }
        visitClass(classType) {
            if ((0, types_1.isClassInstance)(classType)) {
                if (isLiteralType(classType) || types_1.ClassType.isBuiltIn(classType, 'LiteralString')) {
                    this.foundLiteral = true;
                    this.cancelWalk();
                }
            }
            if (this._includeTypeArgs) {
                super.visitClass(classType);
            }
        }
    }
    const walker = new ContainsLiteralTypeWalker(includeTypeArgs);
    walker.walk(type);
    return walker.foundLiteral;
}
exports.containsLiteralType = containsLiteralType;
// If all of the subtypes are literals with the same built-in class (e.g.
// all 'int' or all 'str'), this function returns the name of that type. If
// some of the subtypes are not literals or the literal classes don't match,
// it returns undefined.
function getLiteralTypeClassName(type) {
    if ((0, types_1.isClassInstance)(type)) {
        if (type.literalValue !== undefined && types_1.ClassType.isBuiltIn(type)) {
            return type.details.name;
        }
        return undefined;
    }
    if ((0, types_1.isUnion)(type)) {
        let className;
        let foundMismatch = false;
        doForEachSubtype(type, (subtype) => {
            const subtypeLiteralTypeName = getLiteralTypeClassName(subtype);
            if (!subtypeLiteralTypeName) {
                foundMismatch = true;
            }
            else if (!className) {
                className = subtypeLiteralTypeName;
            }
        });
        return foundMismatch ? undefined : className;
    }
    return undefined;
}
exports.getLiteralTypeClassName = getLiteralTypeClassName;
function getUnionSubtypeCount(type) {
    if ((0, types_1.isUnion)(type)) {
        return type.subtypes.length;
    }
    return 1;
}
exports.getUnionSubtypeCount = getUnionSubtypeCount;
function isEllipsisType(type) {
    return (0, types_1.isAny)(type) && type.isEllipsis;
}
exports.isEllipsisType = isEllipsisType;
function isProperty(type) {
    return (0, types_1.isClassInstance)(type) && types_1.ClassType.isPropertyClass(type);
}
exports.isProperty = isProperty;
function isCallableType(type) {
    if ((0, types_1.isFunction)(type) || (0, types_1.isOverloadedFunction)(type) || (0, types_1.isAnyOrUnknown)(type)) {
        return true;
    }
    if (isEffectivelyInstantiable(type)) {
        return true;
    }
    if ((0, types_1.isClass)(type)) {
        if (types_1.TypeBase.isInstantiable(type)) {
            return true;
        }
        const callMember = lookUpObjectMember(type, '__call__', 16 /* MemberAccessFlags.SkipInstanceMembers */);
        return !!callMember;
    }
    if ((0, types_1.isUnion)(type)) {
        return type.subtypes.every((subtype) => isCallableType(subtype));
    }
    return false;
}
exports.isCallableType = isCallableType;
function isDescriptorInstance(type, requireSetter = false) {
    if ((0, types_1.isUnion)(type)) {
        return type.subtypes.every((subtype) => isMaybeDescriptorInstance(subtype, requireSetter));
    }
    return isMaybeDescriptorInstance(type, requireSetter);
}
exports.isDescriptorInstance = isDescriptorInstance;
function isMaybeDescriptorInstance(type, requireSetter = false) {
    if ((0, types_1.isUnion)(type)) {
        return type.subtypes.some((subtype) => isMaybeDescriptorInstance(subtype, requireSetter));
    }
    if (!(0, types_1.isClassInstance)(type)) {
        return false;
    }
    if (!types_1.ClassType.getSymbolTable(type).has('__get__')) {
        return false;
    }
    if (requireSetter && !types_1.ClassType.getSymbolTable(type).has('__set__')) {
        return false;
    }
    return true;
}
exports.isMaybeDescriptorInstance = isMaybeDescriptorInstance;
function isTupleClass(type) {
    return types_1.ClassType.isBuiltIn(type, 'tuple');
}
exports.isTupleClass = isTupleClass;
// Indicates whether the type is a tuple class of
// the form tuple[x, ...] where the number of elements
// in the tuple is unknown.
function isUnboundedTupleClass(type) {
    return (type.tupleTypeArguments &&
        type.tupleTypeArguments.some((t) => t.isUnbounded || (0, types_1.isUnpackedVariadicTypeVar)(t.type)));
}
exports.isUnboundedTupleClass = isUnboundedTupleClass;
// Indicates whether the specified index is within range and its type is unambiguous
// in that it doesn't involve any element ranges that are of indeterminate length.
function isTupleIndexUnambiguous(type, index) {
    if (!type.tupleTypeArguments) {
        return false;
    }
    if (index < 0) {
        if (isUnboundedTupleClass(type) || type.tupleTypeArguments.length + index < 0) {
            return false;
        }
    }
    let unambiguousIndexLimit = type.tupleTypeArguments.findIndex((t) => t.isUnbounded || (0, types_1.isUnpackedVariadicTypeVar)(t.type));
    if (unambiguousIndexLimit < 0) {
        unambiguousIndexLimit = type.tupleTypeArguments.length;
    }
    return index < unambiguousIndexLimit;
}
exports.isTupleIndexUnambiguous = isTupleIndexUnambiguous;
// Partially specializes a type within the context of a specified
// (presumably specialized) class. Optionally specializes the `Self`
// type variables, replacing them with selfClass.
function partiallySpecializeType(type, contextClassType, selfClass, typeClassType) {
    // If the context class is not specialized (or doesn't need specialization),
    // then there's no need to do any more work.
    if (types_1.ClassType.isUnspecialized(contextClassType) && !selfClass) {
        return type;
    }
    // Partially specialize the type using the specialized class type vars.
    const typeVarContext = buildTypeVarContextFromSpecializedClass(contextClassType);
    if (selfClass) {
        populateTypeVarContextForSelfType(typeVarContext, contextClassType, selfClass);
    }
    let result = applySolvedTypeVars(type, typeVarContext, { typeClassType });
    // If this is a property, we may need to partially specialize the
    // access methods associated with it.
    if ((0, types_1.isClass)(result)) {
        if (result.fgetInfo || result.fsetInfo || result.fdelInfo) {
            function updatePropertyMethodInfo(methodInfo) {
                if (!methodInfo) {
                    return undefined;
                }
                return {
                    methodType: partiallySpecializeType(methodInfo.methodType, contextClassType, selfClass, typeClassType),
                    classType: methodInfo.classType,
                };
            }
            result = types_1.TypeBase.cloneType(result);
            result.fgetInfo = updatePropertyMethodInfo(result.fgetInfo);
            result.fsetInfo = updatePropertyMethodInfo(result.fsetInfo);
            result.fdelInfo = updatePropertyMethodInfo(result.fdelInfo);
        }
    }
    return result;
}
exports.partiallySpecializeType = partiallySpecializeType;
function populateTypeVarContextForSelfType(typeVarContext, contextClassType, selfClass) {
    const synthesizedSelfTypeVar = synthesizeTypeVarForSelfCls(contextClassType, /* isClsParam */ false);
    const selfInstance = convertToInstance(selfClass);
    // We can't call stripLiteralValue here because that method requires the type evaluator.
    // Instead, we'll do a simplified version of it here.
    const selfWithoutLiteral = mapSubtypes(selfInstance, (subtype) => {
        if ((0, types_1.isClass)(subtype)) {
            if (subtype.literalValue !== undefined) {
                return types_1.ClassType.cloneWithLiteral(subtype, /* value */ undefined);
            }
        }
        return subtype;
    });
    if (!(0, types_1.isTypeSame)(synthesizedSelfTypeVar, selfWithoutLiteral)) {
        typeVarContext.setTypeVarType(synthesizedSelfTypeVar, selfInstance, selfWithoutLiteral);
    }
}
exports.populateTypeVarContextForSelfType = populateTypeVarContextForSelfType;
// Looks for duplicate function types within the type and ensures that
// if they are generic, they have unique type variables.
function ensureFunctionSignaturesAreUnique(type, signatureTracker, expressionOffset) {
    const transformer = new UniqueFunctionSignatureTransformer(signatureTracker, expressionOffset);
    return transformer.apply(type, 0);
}
exports.ensureFunctionSignaturesAreUnique = ensureFunctionSignaturesAreUnique;
// Specializes a (potentially generic) type by substituting
// type variables from a type var map.
function applySolvedTypeVars(type, typeVarContext, options = {}) {
    // Use a shortcut if the typeVarContext is empty and no transform is necessary.
    if (typeVarContext.isEmpty() &&
        !options.unknownIfNotFound &&
        !options.eliminateUnsolvedInUnions &&
        !options.applyInScopePlaceholders) {
        return type;
    }
    if (options.applyInScopePlaceholders) {
        applyInScopePlaceholders(typeVarContext);
    }
    const transformer = new ApplySolvedTypeVarsTransformer(typeVarContext, options);
    return transformer.apply(type, 0);
}
exports.applySolvedTypeVars = applySolvedTypeVars;
// Applies solved TypeVars from one context to this context.
function applySourceContextTypeVars(destContext, srcContext) {
    if (srcContext.isEmpty()) {
        return;
    }
    destContext.doForEachSignatureContext((destSignature) => {
        applySourceContextTypeVarsToSignature(destSignature, srcContext);
    });
}
exports.applySourceContextTypeVars = applySourceContextTypeVars;
function applySourceContextTypeVarsToSignature(destSignature, srcContext) {
    destSignature.getTypeVars().forEach((entry) => {
        const newNarrowTypeBound = entry.narrowBound ? applySolvedTypeVars(entry.narrowBound, srcContext) : undefined;
        const newNarrowTypeBoundNoLiterals = entry.narrowBoundNoLiterals
            ? applySolvedTypeVars(entry.narrowBoundNoLiterals, srcContext)
            : undefined;
        const newWideTypeBound = entry.wideBound ? applySolvedTypeVars(entry.wideBound, srcContext) : undefined;
        destSignature.setTypeVarType(entry.typeVar, newNarrowTypeBound, newNarrowTypeBoundNoLiterals, newWideTypeBound);
        if (entry.tupleTypes) {
            destSignature.setTupleTypeVar(entry.typeVar, entry.tupleTypes.map((arg) => {
                return {
                    type: applySolvedTypeVars(arg.type, srcContext),
                    isUnbounded: arg.isUnbounded,
                    isOptional: arg.isOptional,
                };
            }));
        }
    });
}
exports.applySourceContextTypeVarsToSignature = applySourceContextTypeVarsToSignature;
// If the TypeVarContext contains any type variables whose types depend on
// in-scope placeholders used for bidirectional type inference, replace those
// with the solved type associated with those in-scope placeholders.
function applyInScopePlaceholders(typeVarContext) {
    typeVarContext.doForEachSignatureContext((signature) => {
        signature.getTypeVars().forEach((entry) => {
            const typeVar = entry.typeVar;
            if (!typeVar.isInScopePlaceholder) {
                const newNarrowTypeBound = entry.narrowBound
                    ? applyInScopePlaceholdersToType(entry.narrowBound, signature)
                    : undefined;
                const newNarrowTypeBoundNoLiterals = entry.narrowBoundNoLiterals
                    ? applyInScopePlaceholdersToType(entry.narrowBoundNoLiterals, signature)
                    : undefined;
                const newWideTypeBound = entry.wideBound
                    ? applyInScopePlaceholdersToType(entry.wideBound, signature)
                    : undefined;
                signature.setTypeVarType(entry.typeVar, newNarrowTypeBound, newNarrowTypeBoundNoLiterals, newWideTypeBound);
                if (entry.tupleTypes) {
                    signature.setTupleTypeVar(entry.typeVar, entry.tupleTypes.map((arg) => {
                        return {
                            type: applyInScopePlaceholdersToType(arg.type, signature),
                            isUnbounded: arg.isUnbounded,
                            isOptional: arg.isOptional,
                        };
                    }));
                }
            }
        });
    });
}
exports.applyInScopePlaceholders = applyInScopePlaceholders;
// Validates that a default type associated with a TypeVar does not refer to
// other TypeVars or ParamSpecs that are out of scope.
function validateTypeVarDefault(typeVar, liveTypeParams, invalidTypeVars) {
    // If there is no default type or the default type is concrete, there's
    // no need to do any more work here.
    if (typeVar.details.isDefaultExplicit && requiresSpecialization(typeVar.details.defaultType)) {
        const validator = new TypeVarDefaultValidator(liveTypeParams, invalidTypeVars);
        validator.apply(typeVar.details.defaultType, 0);
    }
}
exports.validateTypeVarDefault = validateTypeVarDefault;
function replaceTypeVarsWithAny(type) {
    const transformer = new TypeVarAnyReplacer();
    return transformer.apply(type, 0);
}
exports.replaceTypeVarsWithAny = replaceTypeVarsWithAny;
// During bidirectional type inference for constructors, an "expected type"
// is used to prepopulate the type var map. This is problematic when the
// expected type uses TypeVars that are not part of the context of the
// class we are constructing. We'll replace these type variables with dummy
// type variables.
function transformExpectedType(expectedType, liveTypeVarScopes, usageOffset) {
    const transformer = new ExpectedTypeTransformer(liveTypeVarScopes, usageOffset);
    return transformer.apply(expectedType, 0);
}
exports.transformExpectedType = transformExpectedType;
// Given a protocol class (or abstract class), this function returns
// a set of all the symbols (indexed by symbol name) that are part of
// that protocol and its protocol parent classes. If a same-named symbol
// appears in a parent and a child, the child overrides the parent.
function getProtocolSymbols(classType) {
    const symbolMap = new Map();
    if ((classType.details.flags & 512 /* ClassTypeFlags.ProtocolClass */) !== 0) {
        getProtocolSymbolsRecursive(classType, symbolMap, 512 /* ClassTypeFlags.ProtocolClass */);
    }
    return symbolMap;
}
exports.getProtocolSymbols = getProtocolSymbols;
function getProtocolSymbolsRecursive(classType, symbolMap, classFlags = 512 /* ClassTypeFlags.ProtocolClass */, recursionCount = 0) {
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return;
    }
    classType.details.baseClasses.forEach((baseClass) => {
        if ((0, types_1.isClass)(baseClass) && (baseClass.details.flags & classFlags) !== 0) {
            getProtocolSymbolsRecursive(baseClass, symbolMap, classFlags, recursionCount + 1);
        }
    });
    types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
        if (!symbol.isIgnoredForProtocolMatch()) {
            symbolMap.set(name, {
                symbol,
                classType,
                unspecializedClassType: classType,
                isInstanceMember: symbol.isInstanceMember(),
                isClassMember: symbol.isClassMember(),
                isClassVar: (0, symbolUtils_1.isEffectivelyClassVar)(symbol, /* isDataclass */ false),
                isTypeDeclared: symbol.hasTypedDeclarations(),
                skippedUndeclaredType: false,
            });
        }
    });
}
exports.getProtocolSymbolsRecursive = getProtocolSymbolsRecursive;
// Determines the maximum depth of a tuple, list, set or dictionary.
// For example, if the type is tuple[tuple[tuple[int]]], its depth would be 3.
function getContainerDepth(type, recursionCount = 0) {
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return 1;
    }
    recursionCount++;
    if (!(0, types_1.isClassInstance)(type)) {
        return 0;
    }
    let maxChildDepth = 0;
    if (type.tupleTypeArguments) {
        type.tupleTypeArguments.forEach((typeArgInfo) => {
            doForEachSubtype(typeArgInfo.type, (subtype) => {
                const childDepth = getContainerDepth(subtype, recursionCount);
                maxChildDepth = Math.max(childDepth, maxChildDepth);
            });
        });
    }
    else if (type.typeArguments) {
        type.typeArguments.forEach((typeArg) => {
            doForEachSubtype(typeArg, (subtype) => {
                const childDepth = getContainerDepth(subtype, recursionCount);
                maxChildDepth = Math.max(childDepth, maxChildDepth);
            });
        });
    }
    else {
        return 0;
    }
    return 1 + maxChildDepth;
}
exports.getContainerDepth = getContainerDepth;
function lookUpObjectMember(objectType, memberName, flags = 0 /* MemberAccessFlags.Default */, skipMroClass) {
    if ((0, types_1.isClassInstance)(objectType)) {
        return lookUpClassMember(objectType, memberName, flags, skipMroClass);
    }
    return undefined;
}
exports.lookUpObjectMember = lookUpObjectMember;
// Looks up a member in a class using the multiple-inheritance rules
// defined by Python.
function lookUpClassMember(classType, memberName, flags = 0 /* MemberAccessFlags.Default */, skipMroClass) {
    var _a, _b;
    // Look in the metaclass first.
    const metaclass = classType.details.effectiveMetaclass;
    // Skip the "type" class as an optimization because it is known to not
    // define any instance variables, and it's by far the most common metaclass.
    if (metaclass && (0, types_1.isClass)(metaclass) && !types_1.ClassType.isBuiltIn(metaclass, 'type')) {
        const metaMemberItr = getClassMemberIterator(metaclass, memberName, 32 /* MemberAccessFlags.SkipClassMembers */);
        const metaMember = (_a = metaMemberItr.next()) === null || _a === void 0 ? void 0 : _a.value;
        // If the metaclass defines the member and we didn't hit an Unknown
        // class in the metaclass MRO, use the metaclass member.
        if (metaMember && !(0, types_1.isAnyOrUnknown)(metaMember.classType)) {
            // Set the isClassMember to true because it's a class member from the
            // perspective of the classType.
            metaMember.isClassMember = true;
            return metaMember;
        }
    }
    const memberItr = getClassMemberIterator(classType, memberName, flags, skipMroClass);
    return (_b = memberItr.next()) === null || _b === void 0 ? void 0 : _b.value;
}
exports.lookUpClassMember = lookUpClassMember;
// Iterates members in a class matching memberName using the multiple-inheritance rules.
// For more details, see this note on method resolution
// order: https://www.python.org/download/releases/2.3/mro/.
// As it traverses the inheritance tree, it applies partial specialization
// to the the base class and member. For example, if ClassA inherits from
// ClassB[str] which inherits from Dict[_T1, int], a search for '__iter__'
// would return a class type of Dict[str, int] and a symbolType of
// (self) -> Iterator[str].
// If skipMroClass is defined, all MRO classes up to and including that class
// are skipped.
function* getClassMemberIterator(classType, memberName, flags = 0 /* MemberAccessFlags.Default */, skipMroClass) {
    const declaredTypesOnly = (flags & 64 /* MemberAccessFlags.DeclaredTypesOnly */) !== 0;
    let skippedUndeclaredType = false;
    if ((0, types_1.isClass)(classType)) {
        let classFlags = 0 /* ClassIteratorFlags.Default */;
        if (flags & 1 /* MemberAccessFlags.SkipOriginalClass */) {
            if ((0, types_1.isClass)(classType)) {
                skipMroClass = classType;
            }
        }
        if (flags & 2 /* MemberAccessFlags.SkipBaseClasses */) {
            classFlags = classFlags | 1 /* ClassIteratorFlags.SkipBaseClasses */;
        }
        if (flags & 4 /* MemberAccessFlags.SkipObjectBaseClass */) {
            classFlags = classFlags | 2 /* ClassIteratorFlags.SkipObjectBaseClass */;
        }
        if (flags & 8 /* MemberAccessFlags.SkipTypeBaseClass */) {
            classFlags = classFlags | 4 /* ClassIteratorFlags.SkipTypeBaseClass */;
        }
        const classItr = getClassIterator(classType, classFlags, skipMroClass);
        for (const [mroClass, specializedMroClass] of classItr) {
            if (!(0, types_1.isInstantiableClass)(mroClass)) {
                if (!declaredTypesOnly) {
                    const classType = (0, types_1.isAnyOrUnknown)(mroClass) ? mroClass : types_1.UnknownType.create();
                    // The class derives from an unknown type, so all bets are off
                    // when trying to find a member. Return an unknown symbol.
                    const cm = {
                        symbol: symbol_1.Symbol.createWithType(0 /* SymbolFlags.None */, mroClass),
                        isInstanceMember: false,
                        isClassMember: true,
                        isClassVar: false,
                        classType,
                        unspecializedClassType: classType,
                        isTypeDeclared: false,
                        skippedUndeclaredType: false,
                    };
                    yield cm;
                }
                continue;
            }
            if (!(0, types_1.isInstantiableClass)(specializedMroClass)) {
                continue;
            }
            const memberFields = types_1.ClassType.getSymbolTable(specializedMroClass);
            // Look at instance members first if requested.
            if ((flags & 16 /* MemberAccessFlags.SkipInstanceMembers */) === 0) {
                const symbol = memberFields.get(memberName);
                if (symbol && symbol.isInstanceMember()) {
                    const hasDeclaredType = symbol.hasTypedDeclarations();
                    if (!declaredTypesOnly || hasDeclaredType) {
                        const cm = {
                            symbol,
                            isInstanceMember: true,
                            isClassMember: symbol.isClassMember(),
                            isClassVar: (0, symbolUtils_1.isEffectivelyClassVar)(symbol, types_1.ClassType.isDataClass(specializedMroClass)),
                            classType: specializedMroClass,
                            unspecializedClassType: mroClass,
                            isTypeDeclared: hasDeclaredType,
                            skippedUndeclaredType,
                        };
                        yield cm;
                    }
                    else {
                        skippedUndeclaredType = true;
                    }
                }
            }
            // Next look at class members.
            if ((flags & 32 /* MemberAccessFlags.SkipClassMembers */) === 0) {
                const symbol = memberFields.get(memberName);
                if (symbol && symbol.isClassMember()) {
                    const hasDeclaredType = symbol.hasTypedDeclarations();
                    if (!declaredTypesOnly || hasDeclaredType) {
                        let isInstanceMember = symbol.isInstanceMember();
                        let isClassMember = true;
                        // For data classes and typed dicts, variables that are declared
                        // within the class are treated as instance variables. This distinction
                        // is important in cases where a variable is a callable type because
                        // we don't want to bind it to the instance like we would for a
                        // class member.
                        const isDataclass = types_1.ClassType.isDataClass(specializedMroClass);
                        const isTypedDict = types_1.ClassType.isTypedDictClass(specializedMroClass);
                        if (hasDeclaredType && (isDataclass || isTypedDict)) {
                            const decls = symbol.getDeclarations();
                            if (decls.length > 0 && decls[0].type === 1 /* DeclarationType.Variable */) {
                                isInstanceMember = true;
                                isClassMember = isDataclass;
                            }
                        }
                        const cm = {
                            symbol,
                            isInstanceMember,
                            isClassMember,
                            isClassVar: (0, symbolUtils_1.isEffectivelyClassVar)(symbol, isDataclass),
                            classType: specializedMroClass,
                            unspecializedClassType: mroClass,
                            isTypeDeclared: hasDeclaredType,
                            skippedUndeclaredType,
                        };
                        yield cm;
                    }
                    else {
                        skippedUndeclaredType = true;
                    }
                }
            }
        }
    }
    else if ((0, types_1.isAnyOrUnknown)(classType)) {
        // The class derives from an unknown type, so all bets are off
        // when trying to find a member. Return an Any or Unknown symbol.
        const cm = {
            symbol: symbol_1.Symbol.createWithType(0 /* SymbolFlags.None */, classType),
            isInstanceMember: false,
            isClassMember: true,
            isClassVar: false,
            classType,
            unspecializedClassType: classType,
            isTypeDeclared: false,
            skippedUndeclaredType: false,
        };
        yield cm;
    }
    return undefined;
}
exports.getClassMemberIterator = getClassMemberIterator;
function* getClassIterator(classType, flags = 0 /* ClassIteratorFlags.Default */, skipMroClass) {
    if ((0, types_1.isClass)(classType)) {
        let foundSkipMroClass = skipMroClass === undefined;
        for (const mroClass of classType.details.mro) {
            // Are we still searching for the skipMroClass?
            if (!foundSkipMroClass && skipMroClass) {
                if (!(0, types_1.isClass)(mroClass)) {
                    foundSkipMroClass = true;
                }
                else if (types_1.ClassType.isSameGenericClass(mroClass, skipMroClass)) {
                    foundSkipMroClass = true;
                    continue;
                }
                else {
                    continue;
                }
            }
            // If mroClass is an ancestor of classType, partially specialize
            // it in the context of classType.
            const specializedMroClass = partiallySpecializeType(mroClass, classType);
            // Should we ignore members on the 'object' base class?
            if (flags & 2 /* ClassIteratorFlags.SkipObjectBaseClass */) {
                if ((0, types_1.isInstantiableClass)(specializedMroClass)) {
                    if (types_1.ClassType.isBuiltIn(specializedMroClass, 'object')) {
                        break;
                    }
                }
            }
            // Should we ignore members on the 'type' base class?
            if (flags & 4 /* ClassIteratorFlags.SkipTypeBaseClass */) {
                if ((0, types_1.isInstantiableClass)(specializedMroClass)) {
                    if (types_1.ClassType.isBuiltIn(specializedMroClass, 'type')) {
                        break;
                    }
                }
            }
            yield [mroClass, specializedMroClass];
            if ((flags & 1 /* ClassIteratorFlags.SkipBaseClasses */) !== 0) {
                break;
            }
        }
    }
    return undefined;
}
exports.getClassIterator = getClassIterator;
function getClassFieldsRecursive(classType) {
    const memberMap = new Map();
    // Evaluate the types of members from the end of the MRO to the beginning.
    types_1.ClassType.getReverseMro(classType).forEach((mroClass) => {
        const specializedMroClass = partiallySpecializeType(mroClass, classType);
        if ((0, types_1.isClass)(specializedMroClass)) {
            types_1.ClassType.getSymbolTable(specializedMroClass).forEach((symbol, name) => {
                if (!symbol.isIgnoredForProtocolMatch() && symbol.hasTypedDeclarations()) {
                    memberMap.set(name, {
                        classType: specializedMroClass,
                        unspecializedClassType: mroClass,
                        symbol,
                        isInstanceMember: symbol.isInstanceMember(),
                        isClassMember: symbol.isClassMember(),
                        isClassVar: (0, symbolUtils_1.isEffectivelyClassVar)(symbol, types_1.ClassType.isDataClass(specializedMroClass)),
                        isTypeDeclared: true,
                        skippedUndeclaredType: false,
                    });
                }
            });
        }
        else {
            // If this ancestor class is unknown, throw away all symbols
            // found so far because they could be overridden by the unknown class.
            memberMap.clear();
        }
    });
    return memberMap;
}
exports.getClassFieldsRecursive = getClassFieldsRecursive;
// Combines two lists of type var types, maintaining the combined order
// but removing any duplicates.
function addTypeVarsToListIfUnique(list1, list2, typeVarScopeId) {
    for (const type2 of list2) {
        if (typeVarScopeId && type2.scopeId !== typeVarScopeId) {
            continue;
        }
        if (!list1.find((type1) => (0, types_1.isTypeSame)(convertToInstance(type1), convertToInstance(type2)))) {
            list1.push(type2);
        }
    }
}
exports.addTypeVarsToListIfUnique = addTypeVarsToListIfUnique;
// Walks the type recursively (in a depth-first manner), finds all
// type variables that are referenced, and returns an ordered list
// of unique type variables. For example, if the type is
// Union[List[Dict[_T1, _T2]], _T1, _T3], the result would be
// [_T1, _T2, _T3].
function getTypeVarArgumentsRecursive(type, recursionCount = 0) {
    var _a, _b;
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return [];
    }
    recursionCount++;
    if ((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.typeArguments) {
        const combinedList = [];
        (_b = type.typeAliasInfo) === null || _b === void 0 ? void 0 : _b.typeArguments.forEach((typeArg) => {
            addTypeVarsToListIfUnique(combinedList, getTypeVarArgumentsRecursive(typeArg, recursionCount));
        });
        return combinedList;
    }
    if ((0, types_1.isTypeVar)(type)) {
        // Don't return any recursive type alias placeholders.
        if (type.details.recursiveTypeAliasName) {
            return [];
        }
        // Don't return any P.args or P.kwargs types.
        if ((0, types_1.isParamSpec)(type) && type.paramSpecAccess) {
            return [types_1.TypeVarType.cloneForParamSpecAccess(type, /* access */ undefined)];
        }
        return [types_1.TypeBase.isInstantiable(type) ? types_1.TypeVarType.cloneAsInstance(type) : type];
    }
    if ((0, types_1.isClass)(type)) {
        const combinedList = [];
        const typeArgs = type.tupleTypeArguments ? type.tupleTypeArguments.map((e) => e.type) : type.typeArguments;
        if (typeArgs) {
            typeArgs.forEach((typeArg) => {
                addTypeVarsToListIfUnique(combinedList, getTypeVarArgumentsRecursive(typeArg, recursionCount));
            });
        }
        return combinedList;
    }
    if ((0, types_1.isUnion)(type)) {
        const combinedList = [];
        doForEachSubtype(type, (subtype) => {
            addTypeVarsToListIfUnique(combinedList, getTypeVarArgumentsRecursive(subtype, recursionCount));
        });
        return combinedList;
    }
    if ((0, types_1.isFunction)(type)) {
        const combinedList = [];
        for (let i = 0; i < type.details.parameters.length; i++) {
            addTypeVarsToListIfUnique(combinedList, getTypeVarArgumentsRecursive(types_1.FunctionType.getEffectiveParameterType(type, i), recursionCount));
        }
        const returnType = types_1.FunctionType.getEffectiveReturnType(type);
        if (returnType) {
            addTypeVarsToListIfUnique(combinedList, getTypeVarArgumentsRecursive(returnType, recursionCount));
        }
        return combinedList;
    }
    return [];
}
exports.getTypeVarArgumentsRecursive = getTypeVarArgumentsRecursive;
// Creates a specialized version of the class, filling in any unspecified
// type arguments with Unknown.
function specializeClassType(type) {
    const typeVarContext = new typeVarContext_1.TypeVarContext(getTypeVarScopeId(type));
    const typeParams = types_1.ClassType.getTypeParameters(type);
    typeParams.forEach((typeParam) => {
        typeVarContext.setTypeVarType(typeParam, applySolvedTypeVars(typeParam.details.defaultType, typeVarContext));
    });
    return applySolvedTypeVars(type, typeVarContext);
}
exports.specializeClassType = specializeClassType;
// Recursively finds all of the type arguments and sets them
// to the specified srcType.
function setTypeArgumentsRecursive(destType, srcType, typeVarContext, recursionCount = 0) {
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return;
    }
    recursionCount++;
    if (typeVarContext.isLocked()) {
        return;
    }
    switch (destType.category) {
        case 8 /* TypeCategory.Union */:
            doForEachSubtype(destType, (subtype) => {
                setTypeArgumentsRecursive(subtype, srcType, typeVarContext, recursionCount);
            });
            break;
        case 6 /* TypeCategory.Class */:
            if (destType.typeArguments) {
                destType.typeArguments.forEach((typeArg) => {
                    setTypeArgumentsRecursive(typeArg, srcType, typeVarContext, recursionCount);
                });
            }
            if (destType.tupleTypeArguments) {
                destType.tupleTypeArguments.forEach((typeArg) => {
                    setTypeArgumentsRecursive(typeArg.type, srcType, typeVarContext, recursionCount);
                });
            }
            break;
        case 4 /* TypeCategory.Function */:
            if (destType.specializedTypes) {
                destType.specializedTypes.parameterTypes.forEach((paramType) => {
                    setTypeArgumentsRecursive(paramType, srcType, typeVarContext, recursionCount);
                });
                if (destType.specializedTypes.returnType) {
                    setTypeArgumentsRecursive(destType.specializedTypes.returnType, srcType, typeVarContext, recursionCount);
                }
            }
            else {
                destType.details.parameters.forEach((param) => {
                    setTypeArgumentsRecursive(param.type, srcType, typeVarContext, recursionCount);
                });
                if (destType.details.declaredReturnType) {
                    setTypeArgumentsRecursive(destType.details.declaredReturnType, srcType, typeVarContext, recursionCount);
                }
            }
            break;
        case 5 /* TypeCategory.OverloadedFunction */:
            destType.overloads.forEach((subtype) => {
                setTypeArgumentsRecursive(subtype, srcType, typeVarContext, recursionCount);
            });
            break;
        case 9 /* TypeCategory.TypeVar */:
            if (!typeVarContext.getPrimarySignature().getTypeVar(destType)) {
                typeVarContext.setTypeVarType(destType, srcType);
            }
            break;
    }
}
exports.setTypeArgumentsRecursive = setTypeArgumentsRecursive;
// Builds a mapping between type parameters and their specialized
// types. For example, if the generic type is Dict[_T1, _T2] and the
// specialized type is Dict[str, int], it returns a map that associates
// _T1 with str and _T2 with int.
function buildTypeVarContextFromSpecializedClass(classType) {
    const typeParameters = types_1.ClassType.getTypeParameters(classType);
    const typeVarContext = buildTypeVarContext(typeParameters, classType.typeArguments, getTypeVarScopeId(classType));
    if (types_1.ClassType.isTupleClass(classType) && classType.tupleTypeArguments) {
        typeVarContext.setTupleTypeVar(typeParameters[0], classType.tupleTypeArguments);
    }
    return typeVarContext;
}
exports.buildTypeVarContextFromSpecializedClass = buildTypeVarContextFromSpecializedClass;
function buildTypeVarContext(typeParameters, typeArgs, typeVarScopeId) {
    const typeVarContext = new typeVarContext_1.TypeVarContext(typeVarScopeId);
    typeParameters.forEach((typeParam, index) => {
        let typeArgType;
        if (typeArgs) {
            if (typeParam.details.isParamSpec) {
                if (index < typeArgs.length) {
                    typeArgType = typeArgs[index];
                    if ((0, types_1.isFunction)(typeArgType) && types_1.FunctionType.isParamSpecValue(typeArgType)) {
                        const parameters = [];
                        const typeArgFunctionType = typeArgType;
                        typeArgType.details.parameters.forEach((param, paramIndex) => {
                            parameters.push({
                                category: param.category,
                                name: param.name,
                                hasDefault: !!param.hasDefault,
                                defaultValueExpression: param.defaultValueExpression,
                                isNameSynthesized: param.isNameSynthesized,
                                type: types_1.FunctionType.getEffectiveParameterType(typeArgFunctionType, paramIndex),
                            });
                        });
                        typeVarContext.setTypeVarType(typeParam, convertTypeToParamSpecValue(typeArgType));
                    }
                    else if ((0, types_1.isParamSpec)(typeArgType) || (0, types_1.isAnyOrUnknown)(typeArgType)) {
                        typeVarContext.setTypeVarType(typeParam, convertTypeToParamSpecValue(typeArgType));
                    }
                }
            }
            else {
                if (index >= typeArgs.length) {
                    typeArgType = types_1.AnyType.create();
                }
                else {
                    typeArgType = typeArgs[index];
                }
                typeVarContext.setTypeVarType(typeParam, typeArgType, 
                /* narrowBoundNoLiterals */ undefined, typeArgType);
            }
        }
    });
    return typeVarContext;
}
exports.buildTypeVarContext = buildTypeVarContext;
// Determines the specialized base class type that srcType derives from.
function specializeForBaseClass(srcType, baseClass) {
    const typeParams = types_1.ClassType.getTypeParameters(baseClass);
    // If there are no type parameters for the specified base class,
    // no specialization is required.
    if (typeParams.length === 0) {
        return baseClass;
    }
    const typeVarContext = buildTypeVarContextFromSpecializedClass(srcType);
    const specializedType = applySolvedTypeVars(baseClass, typeVarContext);
    (0, debug_1.assert)((0, types_1.isInstantiableClass)(specializedType));
    return specializedType;
}
exports.specializeForBaseClass = specializeForBaseClass;
function derivesFromStdlibClass(classType, className) {
    return classType.details.mro.some((mroClass) => (0, types_1.isClass)(mroClass) && types_1.ClassType.isBuiltIn(mroClass, className));
}
exports.derivesFromStdlibClass = derivesFromStdlibClass;
// If ignoreUnknown is true, an unknown base class is ignored when
// checking for derivation. If ignoreUnknown is false, a return value
// of true is assumed.
function derivesFromClassRecursive(classType, baseClassToFind, ignoreUnknown) {
    if (types_1.ClassType.isSameGenericClass(classType, baseClassToFind)) {
        return true;
    }
    for (const baseClass of classType.details.baseClasses) {
        if ((0, types_1.isInstantiableClass)(baseClass)) {
            if (derivesFromClassRecursive(baseClass, baseClassToFind, ignoreUnknown)) {
                return true;
            }
        }
        else if (!ignoreUnknown && (0, types_1.isAnyOrUnknown)(baseClass)) {
            // If the base class is unknown, we have to make a conservative assumption.
            return true;
        }
    }
    return false;
}
exports.derivesFromClassRecursive = derivesFromClassRecursive;
function synthesizeTypeVarForSelfCls(classType, isClsParam) {
    var _a;
    const selfType = types_1.TypeVarType.createInstance(`__type_of_self__`);
    const scopeId = (_a = getTypeVarScopeId(classType)) !== null && _a !== void 0 ? _a : '';
    selfType.details.isSynthesized = true;
    selfType.details.isSynthesizedSelf = true;
    selfType.nameWithScope = types_1.TypeVarType.makeNameWithScope(selfType.details.name, scopeId);
    selfType.scopeId = scopeId;
    const boundType = types_1.ClassType.cloneForSpecialization(classType, types_1.ClassType.getTypeParameters(classType), 
    /* isTypeArgumentExplicit */ false, 
    /* includeSubclasses */ !!classType.includeSubclasses);
    selfType.details.boundType = types_1.ClassType.cloneAsInstance(boundType);
    return isClsParam ? types_1.TypeVarType.cloneAsInstantiable(selfType) : selfType;
}
exports.synthesizeTypeVarForSelfCls = synthesizeTypeVarForSelfCls;
// Returns the declared "return" type (the type returned from a return statement)
// if it was declared, or undefined otherwise.
function getDeclaredGeneratorReturnType(functionType) {
    const returnType = types_1.FunctionType.getEffectiveReturnType(functionType);
    if (returnType) {
        const generatorTypeArgs = getGeneratorTypeArgs(returnType);
        if (generatorTypeArgs) {
            // The send type is the third type arg.
            return generatorTypeArgs.length >= 3 ? generatorTypeArgs[2] : types_1.UnknownType.create();
        }
    }
    return undefined;
}
exports.getDeclaredGeneratorReturnType = getDeclaredGeneratorReturnType;
// If the declared return type is a Generator, Iterable, Iterator or the async
// counterparts, returns the yield type. If the type is invalid for a generator,
// returns undefined.
function getGeneratorYieldType(declaredReturnType, isAsync) {
    let isLegalGeneratorType = true;
    const yieldType = mapSubtypes(declaredReturnType, (subtype) => {
        if ((0, types_1.isAnyOrUnknown)(subtype)) {
            return subtype;
        }
        if ((0, types_1.isClassInstance)(subtype)) {
            const expectedClasses = [
                ['AsyncIterable', 'Iterable'],
                ['AsyncIterator', 'Iterator'],
                ['AsyncGenerator', 'Generator'],
                ['', 'AwaitableGenerator'],
            ];
            if (expectedClasses.some((classes) => types_1.ClassType.isBuiltIn(subtype, isAsync ? classes[0] : classes[1]))) {
                return subtype.typeArguments && subtype.typeArguments.length >= 1
                    ? subtype.typeArguments[0]
                    : types_1.UnknownType.create();
            }
        }
        isLegalGeneratorType = false;
        return undefined;
    });
    return isLegalGeneratorType ? yieldType : undefined;
}
exports.getGeneratorYieldType = getGeneratorYieldType;
function isInstantiableMetaclass(type) {
    return ((0, types_1.isInstantiableClass)(type) &&
        type.details.mro.some((mroClass) => (0, types_1.isClass)(mroClass) && types_1.ClassType.isBuiltIn(mroClass, 'type')));
}
exports.isInstantiableMetaclass = isInstantiableMetaclass;
function isMetaclassInstance(type) {
    return ((0, types_1.isClassInstance)(type) &&
        type.details.mro.some((mroClass) => (0, types_1.isClass)(mroClass) && types_1.ClassType.isBuiltIn(mroClass, 'type')));
}
exports.isMetaclassInstance = isMetaclassInstance;
function isEffectivelyInstantiable(type, options, recursionCount = 0) {
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return false;
    }
    recursionCount++;
    if (types_1.TypeBase.isInstantiable(type)) {
        return true;
    }
    if ((options === null || options === void 0 ? void 0 : options.honorTypeVarBounds) && (0, types_1.isTypeVar)(type) && type.details.boundType) {
        if (isEffectivelyInstantiable(type.details.boundType, options, recursionCount)) {
            return true;
        }
    }
    // Handle the special case of 'type' (or subclasses thereof),
    // which are instantiable.
    if (isMetaclassInstance(type)) {
        return true;
    }
    if ((0, types_1.isUnion)(type)) {
        return type.subtypes.every((subtype) => isEffectivelyInstantiable(subtype, options, recursionCount));
    }
    return false;
}
exports.isEffectivelyInstantiable = isEffectivelyInstantiable;
function convertToInstance(type, includeSubclasses = true) {
    var _a;
    // See if we've already performed this conversion and cached it.
    if (((_a = type.cached) === null || _a === void 0 ? void 0 : _a.instanceType) && includeSubclasses) {
        return type.cached.instanceType;
    }
    let result = mapSubtypes(type, (subtype) => {
        switch (subtype.category) {
            case 6 /* TypeCategory.Class */: {
                // Handle type[x] as a special case.
                if (types_1.ClassType.isBuiltIn(subtype, 'type')) {
                    if (types_1.TypeBase.isInstance(subtype)) {
                        if (!subtype.typeArguments || subtype.typeArguments.length < 1) {
                            return types_1.UnknownType.create();
                        }
                        else {
                            return subtype.typeArguments[0];
                        }
                    }
                    else {
                        if (subtype.typeArguments && subtype.typeArguments.length > 0) {
                            if (!(0, types_1.isAnyOrUnknown)(subtype.typeArguments[0])) {
                                return convertToInstantiable(subtype.typeArguments[0]);
                            }
                        }
                    }
                }
                return types_1.ClassType.cloneAsInstance(subtype, includeSubclasses);
            }
            case 4 /* TypeCategory.Function */: {
                if (types_1.TypeBase.isInstantiable(subtype)) {
                    return types_1.FunctionType.cloneAsInstance(subtype);
                }
                break;
            }
            case 9 /* TypeCategory.TypeVar */: {
                if (types_1.TypeBase.isInstantiable(subtype)) {
                    return types_1.TypeVarType.cloneAsInstance(subtype);
                }
                break;
            }
            case 2 /* TypeCategory.Any */: {
                return types_1.AnyType.convertToInstance(subtype);
            }
            case 1 /* TypeCategory.Unknown */: {
                return types_1.UnknownType.convertToInstance(subtype);
            }
            case 3 /* TypeCategory.Never */: {
                return types_1.NeverType.convertToInstance(subtype);
            }
            case 0 /* TypeCategory.Unbound */: {
                return types_1.UnboundType.convertToInstance(subtype);
            }
        }
        return subtype;
    });
    // Copy over any type alias information.
    if (type.typeAliasInfo && type !== result) {
        result = types_1.TypeBase.cloneForTypeAlias(result, type.typeAliasInfo.name, type.typeAliasInfo.fullName, type.typeAliasInfo.moduleName, type.typeAliasInfo.fileUri, type.typeAliasInfo.typeVarScopeId, type.typeAliasInfo.isPep695Syntax, type.typeAliasInfo.typeParameters, type.typeAliasInfo.typeArguments);
    }
    if (type !== result && includeSubclasses) {
        // Cache the converted value for next time.
        if (!type.cached) {
            type.cached = {};
        }
        type.cached.instanceType = result;
    }
    return result;
}
exports.convertToInstance = convertToInstance;
function convertToInstantiable(type, includeSubclasses = true) {
    var _a;
    // See if we've already performed this conversion and cached it.
    if ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.instantiableType) {
        return type.cached.instantiableType;
    }
    const result = mapSubtypes(type, (subtype) => {
        switch (subtype.category) {
            case 6 /* TypeCategory.Class */: {
                return types_1.ClassType.cloneAsInstantiable(subtype, includeSubclasses);
            }
            case 4 /* TypeCategory.Function */: {
                return types_1.FunctionType.cloneAsInstantiable(subtype);
            }
            case 9 /* TypeCategory.TypeVar */: {
                return types_1.TypeVarType.cloneAsInstantiable(subtype);
            }
        }
        return subtype;
    });
    if (type !== result) {
        // Cache the converted value for next time.
        if (!type.cached) {
            type.cached = {};
        }
        type.cached.instantiableType = result;
    }
    return result;
}
exports.convertToInstantiable = convertToInstantiable;
function getMembersForClass(classType, symbolTable, includeInstanceVars) {
    classType.details.mro.forEach((mroClass) => {
        if ((0, types_1.isInstantiableClass)(mroClass)) {
            // Add any new member variables from this class.
            const isClassTypedDict = types_1.ClassType.isTypedDictClass(mroClass);
            types_1.ClassType.getSymbolTable(mroClass).forEach((symbol, name) => {
                if (symbol.isClassMember() || (includeInstanceVars && symbol.isInstanceMember())) {
                    if (!isClassTypedDict || !(0, symbolUtils_1.isTypedDictMemberAccessedThroughIndex)(symbol)) {
                        if (!symbol.isInitVar()) {
                            const existingSymbol = symbolTable.get(name);
                            if (!existingSymbol) {
                                symbolTable.set(name, symbol);
                            }
                            else if (!existingSymbol.hasTypedDeclarations() && symbol.hasTypedDeclarations()) {
                                // If the existing symbol is unannotated but a parent class
                                // has an annotation for the symbol, use the parent type instead.
                                symbolTable.set(name, symbol);
                            }
                        }
                    }
                }
            });
        }
    });
    // Add members of the metaclass as well.
    if (!includeInstanceVars) {
        const metaclass = classType.details.effectiveMetaclass;
        if (metaclass && (0, types_1.isInstantiableClass)(metaclass)) {
            for (const mroClass of metaclass.details.mro) {
                if ((0, types_1.isInstantiableClass)(mroClass)) {
                    types_1.ClassType.getSymbolTable(mroClass).forEach((symbol, name) => {
                        const existingSymbol = symbolTable.get(name);
                        if (!existingSymbol) {
                            symbolTable.set(name, symbol);
                        }
                        else if (!existingSymbol.hasTypedDeclarations() && symbol.hasTypedDeclarations()) {
                            // If the existing symbol is unannotated but a parent class
                            // has an annotation for the symbol, use the parent type instead.
                            symbolTable.set(name, symbol);
                        }
                    });
                }
                else {
                    break;
                }
            }
        }
    }
}
exports.getMembersForClass = getMembersForClass;
function getMembersForModule(moduleType, symbolTable) {
    // Start with the loader fields. If there are any symbols of the
    // same name defined within the module, they will overwrite the
    // loader fields.
    if (moduleType.loaderFields) {
        moduleType.loaderFields.forEach((symbol, name) => {
            symbolTable.set(name, symbol);
        });
    }
    moduleType.fields.forEach((symbol, name) => {
        symbolTable.set(name, symbol);
    });
}
exports.getMembersForModule = getMembersForModule;
// Determines if the type contains an Any recursively.
function containsAnyRecursive(type, includeUnknown = true) {
    class AnyWalker extends typeWalker_1.TypeWalker {
        constructor(_includeUnknown) {
            super();
            this._includeUnknown = _includeUnknown;
            this.foundAny = false;
        }
        visitAny(type) {
            this.foundAny = true;
            this.cancelWalk();
        }
        visitUnknown(type) {
            if (this._includeUnknown) {
                this.foundAny = true;
                this.cancelWalk();
            }
        }
    }
    const walker = new AnyWalker(includeUnknown);
    walker.walk(type);
    return walker.foundAny;
}
exports.containsAnyRecursive = containsAnyRecursive;
// Determines if the type contains an Any or Unknown type. If so,
// it returns the Any or Unknown type. Unknowns are preferred over
// Any if both are present. If recurse is true, it will recurse
// through type arguments and parameters.
function containsAnyOrUnknown(type, recurse) {
    class AnyOrUnknownWalker extends typeWalker_1.TypeWalker {
        constructor(_recurse) {
            super();
            this._recurse = _recurse;
        }
        visitTypeAlias(type) {
            // Don't explore type aliases.
        }
        visitUnknown(type) {
            this.anyOrUnknownType = this.anyOrUnknownType ? preserveUnknown(this.anyOrUnknownType, type) : type;
        }
        visitAny(type) {
            this.anyOrUnknownType = this.anyOrUnknownType ? preserveUnknown(this.anyOrUnknownType, type) : type;
        }
        visitClass(type) {
            if (this._recurse) {
                super.visitClass(type);
            }
        }
        visitFunction(type) {
            if (this._recurse) {
                // A function with a "..." type is effectively an "Any".
                if (types_1.FunctionType.isGradualCallableForm(type)) {
                    this.anyOrUnknownType = this.anyOrUnknownType
                        ? preserveUnknown(this.anyOrUnknownType, types_1.AnyType.create())
                        : types_1.AnyType.create();
                }
                super.visitFunction(type);
            }
        }
    }
    const walker = new AnyOrUnknownWalker(recurse);
    walker.walk(type);
    return walker.anyOrUnknownType;
}
exports.containsAnyOrUnknown = containsAnyOrUnknown;
// Determines if any part of the type contains "Unknown", including any type arguments.
// This function does not use the TypeWalker because it is called very frequently,
// and allocating a memory walker object for every call significantly increases
// peak memory usage.
function isPartlyUnknown(type, recursionCount = 0) {
    var _a, _b;
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return false;
    }
    recursionCount++;
    if ((0, types_1.isUnknown)(type)) {
        return true;
    }
    // If this is a generic type alias, see if any of its type arguments
    // are either unspecified or are partially known.
    if ((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.typeArguments) {
        if (type.typeAliasInfo.typeArguments.some((typeArg) => isPartlyUnknown(typeArg, recursionCount))) {
            return true;
        }
    }
    // See if a union contains an unknown type.
    if ((0, types_1.isUnion)(type)) {
        return (0, types_1.findSubtype)(type, (subtype) => isPartlyUnknown(subtype, recursionCount)) !== undefined;
    }
    // See if an object or class has an unknown type argument.
    if ((0, types_1.isClass)(type)) {
        // If this is a reference to the class itself, as opposed to a reference
        // to a type that represents the class and its subclasses, don't flag
        // the type as partially unknown.
        if (!type.includeSubclasses) {
            return false;
        }
        if (!types_1.ClassType.isPseudoGenericClass(type)) {
            const typeArgs = ((_b = type.tupleTypeArguments) === null || _b === void 0 ? void 0 : _b.map((t) => t.type)) || type.typeArguments;
            if (typeArgs) {
                for (const argType of typeArgs) {
                    if (isPartlyUnknown(argType, recursionCount)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    // See if a function has an unknown type.
    if ((0, types_1.isOverloadedFunction)(type)) {
        return types_1.OverloadedFunctionType.getOverloads(type).some((overload) => {
            return isPartlyUnknown(overload, recursionCount);
        });
    }
    if ((0, types_1.isFunction)(type)) {
        for (let i = 0; i < type.details.parameters.length; i++) {
            // Ignore parameters such as "*" that have no name.
            if (type.details.parameters[i].name) {
                const paramType = types_1.FunctionType.getEffectiveParameterType(type, i);
                if (isPartlyUnknown(paramType, recursionCount)) {
                    return true;
                }
            }
        }
        if (type.details.declaredReturnType &&
            !types_1.FunctionType.isParamSpecValue(type) &&
            isPartlyUnknown(type.details.declaredReturnType, recursionCount)) {
            return true;
        }
        return false;
    }
    return false;
}
exports.isPartlyUnknown = isPartlyUnknown;
// If the specified type is a generic class with a single type argument
// that is a union, it "explodes" the class into a union of classes with
// each element of the union - e.g. Foo[A | B] becomes Foo[A] | Foo[B].
function explodeGenericClass(classType) {
    if (!classType.typeArguments || classType.typeArguments.length !== 1 || !(0, types_1.isUnion)(classType.typeArguments[0])) {
        return classType;
    }
    return (0, types_1.combineTypes)(classType.typeArguments[0].subtypes.map((subtype) => {
        return types_1.ClassType.cloneForSpecialization(classType, [subtype], /* isTypeArgumentExplicit */ true);
    }));
}
exports.explodeGenericClass = explodeGenericClass;
// If the type is a union of same-sized tuples, these are combined into
// a single tuple with that size. Otherwise, returns undefined.
function combineSameSizedTuples(type, tupleType) {
    if (!tupleType || !(0, types_1.isInstantiableClass)(tupleType) || isUnboundedTupleClass(tupleType)) {
        return type;
    }
    let tupleEntries;
    let isValid = true;
    doForEachSubtype(type, (subtype) => {
        if ((0, types_1.isClassInstance)(subtype)) {
            let tupleClass;
            if ((0, types_1.isClass)(subtype) && isTupleClass(subtype) && !isUnboundedTupleClass(subtype)) {
                tupleClass = subtype;
            }
            if (!tupleClass) {
                // Look in the mro list to see if this subtype derives from a
                // tuple with a known size. This includes named tuples.
                tupleClass = subtype.details.mro.find((mroClass) => (0, types_1.isClass)(mroClass) && isTupleClass(mroClass) && !isUnboundedTupleClass(mroClass));
            }
            if (tupleClass && (0, types_1.isClass)(tupleClass) && tupleClass.tupleTypeArguments) {
                if (tupleEntries) {
                    if (tupleEntries.length === tupleClass.tupleTypeArguments.length) {
                        tupleClass.tupleTypeArguments.forEach((entry, index) => {
                            tupleEntries[index].push(entry.type);
                        });
                    }
                    else {
                        isValid = false;
                    }
                }
                else {
                    tupleEntries = tupleClass.tupleTypeArguments.map((entry) => [entry.type]);
                }
            }
            else {
                isValid = false;
            }
        }
        else {
            isValid = false;
        }
    });
    if (!isValid || !tupleEntries) {
        return type;
    }
    return convertToInstance(specializeTupleClass(tupleType, tupleEntries.map((entry) => {
        return { type: (0, types_1.combineTypes)(entry), isUnbounded: false };
    })));
}
exports.combineSameSizedTuples = combineSameSizedTuples;
// Tuples require special handling for specialization. This method computes
// the "effective" type argument, which is a union of the variadic type
// arguments.
function specializeTupleClass(classType, typeArgs, isTypeArgumentExplicit = true, isUnpackedTuple = false) {
    const combinedTupleType = (0, types_1.combineTypes)(typeArgs.map((t) => {
        if ((0, types_1.isTypeVar)(t.type) && (0, types_1.isUnpackedVariadicTypeVar)(t.type)) {
            // Treat the unpacked TypeVarTuple as a union.
            return types_1.TypeVarType.cloneForUnpacked(t.type, /* isInUnion */ true);
        }
        return t.type;
    }));
    const clonedClassType = types_1.ClassType.cloneForSpecialization(classType, [combinedTupleType], isTypeArgumentExplicit, 
    /* includeSubclasses */ undefined, typeArgs);
    if (isUnpackedTuple) {
        clonedClassType.isUnpacked = true;
    }
    return clonedClassType;
}
exports.specializeTupleClass = specializeTupleClass;
function _expandVariadicUnpackedUnion(type) {
    if ((0, types_1.isClassInstance)(type) && isTupleClass(type) && type.tupleTypeArguments && type.isUnpacked) {
        return (0, types_1.combineTypes)(type.tupleTypeArguments.map((t) => t.type));
    }
    return type;
}
// If the declared return type for the function is a Generator or AsyncGenerator,
// returns the type arguments for the type.
function getGeneratorTypeArgs(returnType) {
    var _a;
    if ((0, types_1.isClassInstance)(returnType)) {
        if (types_1.ClassType.isBuiltIn(returnType, ['Generator', 'AsyncGenerator'])) {
            return returnType.typeArguments;
        }
        else if (types_1.ClassType.isBuiltIn(returnType, 'AwaitableGenerator')) {
            // AwaitableGenerator has four type arguments, and the first 3
            // correspond to the generator.
            return (_a = returnType.typeArguments) === null || _a === void 0 ? void 0 : _a.slice(0, 3);
        }
    }
    return undefined;
}
exports.getGeneratorTypeArgs = getGeneratorTypeArgs;
function requiresTypeArguments(classType) {
    if (classType.details.typeParameters.length > 0) {
        const firstTypeParam = classType.details.typeParameters[0];
        // If there are type parameters, type arguments are needed.
        // The exception is if type parameters have been synthesized
        // for classes that have untyped constructors.
        if (firstTypeParam.details.isSynthesized) {
            return false;
        }
        // If the first type parameter has a default type, then no
        // type arguments are needed.
        if (firstTypeParam.details.isDefaultExplicit) {
            return false;
        }
        return true;
    }
    // There are a few built-in special classes that require
    // type arguments even though typeParameters is empty.
    if (types_1.ClassType.isSpecialBuiltIn(classType)) {
        const specialClasses = [
            'Tuple',
            'Callable',
            'Generic',
            'Type',
            'Optional',
            'Union',
            'Literal',
            'Annotated',
            'TypeGuard',
            'TypeIs',
        ];
        if (specialClasses.some((t) => t === (classType.aliasName || classType.details.name))) {
            return true;
        }
    }
    return false;
}
exports.requiresTypeArguments = requiresTypeArguments;
function requiresSpecialization(type, options, recursionCount = 0) {
    var _a;
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return false;
    }
    recursionCount++;
    // Is the answer cached?
    const canUseCache = !(options === null || options === void 0 ? void 0 : options.ignorePseudoGeneric) && !(options === null || options === void 0 ? void 0 : options.ignoreSelf);
    if (canUseCache && ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.requiresSpecialization) !== undefined) {
        return type.cached.requiresSpecialization;
    }
    const result = _requiresSpecialization(type, options, recursionCount);
    if (canUseCache) {
        if (type.cached === undefined) {
            type.cached = {};
        }
        type.cached.requiresSpecialization = result;
    }
    return result;
}
exports.requiresSpecialization = requiresSpecialization;
function _requiresSpecialization(type, options, recursionCount = 0) {
    var _a;
    // If the type is conditioned on a TypeVar, it may need to be specialized.
    if (type.condition) {
        return true;
    }
    switch (type.category) {
        case 6 /* TypeCategory.Class */: {
            if (types_1.ClassType.isPseudoGenericClass(type) && (options === null || options === void 0 ? void 0 : options.ignorePseudoGeneric)) {
                return false;
            }
            if (!type.isTypeArgumentExplicit && (options === null || options === void 0 ? void 0 : options.ignoreImplicitTypeArgs)) {
                return false;
            }
            if (type.typeArguments) {
                return type.typeArguments.some((typeArg) => requiresSpecialization(typeArg, options, recursionCount));
            }
            return types_1.ClassType.getTypeParameters(type).length > 0;
        }
        case 4 /* TypeCategory.Function */: {
            for (let i = 0; i < type.details.parameters.length; i++) {
                if (requiresSpecialization(types_1.FunctionType.getEffectiveParameterType(type, i), options, recursionCount)) {
                    return true;
                }
            }
            const declaredReturnType = type.specializedTypes && type.specializedTypes.returnType
                ? type.specializedTypes.returnType
                : type.details.declaredReturnType;
            if (declaredReturnType) {
                if (requiresSpecialization(declaredReturnType, options, recursionCount)) {
                    return true;
                }
            }
            else if (type.inferredReturnType) {
                if (requiresSpecialization(type.inferredReturnType, options, recursionCount)) {
                    return true;
                }
            }
            return false;
        }
        case 5 /* TypeCategory.OverloadedFunction */: {
            return type.overloads.some((overload) => requiresSpecialization(overload, options, recursionCount));
        }
        case 8 /* TypeCategory.Union */: {
            return type.subtypes.some((subtype) => requiresSpecialization(subtype, options, recursionCount));
        }
        case 9 /* TypeCategory.TypeVar */: {
            // Most TypeVar types need to be specialized.
            if (!type.details.recursiveTypeAliasName) {
                if (type.details.isSynthesizedSelf && (options === null || options === void 0 ? void 0 : options.ignoreSelf)) {
                    return false;
                }
                return true;
            }
            // If this is a recursive type alias, it may need to be specialized
            // if it has generic type arguments.
            if ((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.typeArguments) {
                return type.typeAliasInfo.typeArguments.some((typeArg) => requiresSpecialization(typeArg, options, recursionCount));
            }
        }
    }
    return false;
}
// Combines two variances to produce a resulting variance.
function combineVariances(variance1, variance2) {
    if (variance1 === 1 /* Variance.Unknown */) {
        return variance2;
    }
    if (variance2 === 2 /* Variance.Invariant */ ||
        (variance2 === 3 /* Variance.Covariant */ && variance1 === 4 /* Variance.Contravariant */) ||
        (variance2 === 4 /* Variance.Contravariant */ && variance1 === 3 /* Variance.Covariant */)) {
        return 2 /* Variance.Invariant */;
    }
    return variance1;
}
exports.combineVariances = combineVariances;
// Determines if the variance of the type argument for a generic class is compatible
// With the declared variance of the corresponding type parameter.
function isVarianceOfTypeArgumentCompatible(type, typeParamVariance) {
    if (typeParamVariance === 1 /* Variance.Unknown */ || typeParamVariance === 0 /* Variance.Auto */) {
        return true;
    }
    if ((0, types_1.isTypeVar)(type) && !type.details.isParamSpec && !type.details.isVariadic) {
        const typeArgVariance = type.details.declaredVariance;
        if (typeArgVariance === 4 /* Variance.Contravariant */ || typeArgVariance === 3 /* Variance.Covariant */) {
            return typeArgVariance === typeParamVariance;
        }
    }
    else if ((0, types_1.isClassInstance)(type)) {
        if (type.details.typeParameters && type.details.typeParameters.length > 0) {
            return type.details.typeParameters.every((typeParam, index) => {
                let typeArgType;
                if (typeParam.details.isParamSpec || typeParam.details.isVariadic) {
                    return true;
                }
                if (type.typeArguments && index < type.typeArguments.length) {
                    typeArgType = type.typeArguments[index];
                }
                const declaredVariance = typeParam.details.declaredVariance;
                if (declaredVariance === 0 /* Variance.Auto */) {
                    return true;
                }
                let effectiveVariance = 2 /* Variance.Invariant */;
                if (declaredVariance === 3 /* Variance.Covariant */) {
                    // If the declared variance is covariant, the effective variance
                    // is simply copied from the type param variance.
                    effectiveVariance = typeParamVariance;
                }
                else if (declaredVariance === 4 /* Variance.Contravariant */) {
                    // If the declared variance is contravariant, it flips the
                    // effective variance from contravariant to covariant or vice versa.
                    if (typeParamVariance === 3 /* Variance.Covariant */) {
                        effectiveVariance = 4 /* Variance.Contravariant */;
                    }
                    else if (typeParamVariance === 4 /* Variance.Contravariant */) {
                        effectiveVariance = 3 /* Variance.Covariant */;
                    }
                }
                return isVarianceOfTypeArgumentCompatible(typeArgType !== null && typeArgType !== void 0 ? typeArgType : types_1.UnknownType.create(), effectiveVariance);
            });
        }
    }
    return true;
}
exports.isVarianceOfTypeArgumentCompatible = isVarianceOfTypeArgumentCompatible;
// Computes the method resolution ordering for a class whose base classes
// have already been filled in. The algorithm for computing MRO is described
// here: https://www.python.org/download/releases/2.3/mro/. It returns true
// if an MRO was possible, false otherwise.
function computeMroLinearization(classType) {
    let isMroFound = true;
    // Clear out any existing MRO information.
    classType.details.mro = [];
    const filteredBaseClasses = classType.details.baseClasses.filter((baseClass, index) => {
        if ((0, types_1.isInstantiableClass)(baseClass)) {
            // Generic has some special-case logic (see description of __mro_entries__
            // in PEP 560) that we need to account for here.
            if (types_1.ClassType.isBuiltIn(baseClass, 'Generic')) {
                // If the class is a Protocol or TypedDict, the generic is ignored for
                // the purposes of computing the MRO.
                if (types_1.ClassType.isProtocolClass(classType) || types_1.ClassType.isTypedDictClass(classType)) {
                    return false;
                }
                // If the class contains any specialized generic classes after
                // the Generic base, the Generic base is ignored for purposes
                // of computing the MRO.
                if (classType.details.baseClasses.some((innerBaseClass, innerIndex) => {
                    return (innerIndex > index &&
                        (0, types_1.isInstantiableClass)(innerBaseClass) &&
                        innerBaseClass.typeArguments &&
                        innerBaseClass.isTypeArgumentExplicit);
                })) {
                    return false;
                }
            }
        }
        return true;
    });
    // Construct the list of class lists that need to be merged.
    const classListsToMerge = [];
    filteredBaseClasses.forEach((baseClass) => {
        if ((0, types_1.isInstantiableClass)(baseClass)) {
            const typeVarContext = buildTypeVarContextFromSpecializedClass(baseClass);
            classListsToMerge.push(baseClass.details.mro.map((mroClass) => {
                return applySolvedTypeVars(mroClass, typeVarContext);
            }));
        }
        else {
            classListsToMerge.push([baseClass]);
        }
    });
    classListsToMerge.push(filteredBaseClasses.map((baseClass) => {
        const typeVarContext = buildTypeVarContextFromSpecializedClass(classType);
        return applySolvedTypeVars(baseClass, typeVarContext);
    }));
    // The first class in the MRO is the class itself.
    const typeVarContext = buildTypeVarContextFromSpecializedClass(classType);
    let specializedClassType = applySolvedTypeVars(classType, typeVarContext);
    if (!(0, types_1.isClass)(specializedClassType) && !(0, types_1.isAnyOrUnknown)(specializedClassType)) {
        specializedClassType = types_1.UnknownType.create();
    }
    classType.details.mro.push(specializedClassType);
    // Helper function that returns true if the specified searchClass
    // is found in the "tail" (i.e. in elements 1 through n) of any
    // of the class lists.
    function isInTail(searchClass, classLists) {
        return classLists.some((classList) => {
            return (classList.findIndex((value) => (0, types_1.isInstantiableClass)(value) && types_1.ClassType.isSameGenericClass(value, searchClass)) > 0);
        });
    }
    // Helper function that filters the class lists to remove any duplicate
    // entries of the specified class. This is used once the class has been
    // added to the MRO.
    function filterClass(classToFilter, classLists) {
        for (let i = 0; i < classLists.length; i++) {
            classLists[i] = classLists[i].filter((value) => {
                return !(0, types_1.isInstantiableClass)(value) || !types_1.ClassType.isSameGenericClass(value, classToFilter);
            });
        }
    }
    while (true) {
        let foundValidHead = false;
        let nonEmptyList = undefined;
        for (let i = 0; i < classListsToMerge.length; i++) {
            const classList = classListsToMerge[i];
            if (classList.length > 0) {
                if (nonEmptyList === undefined) {
                    nonEmptyList = classList;
                }
                if (!(0, types_1.isInstantiableClass)(classList[0])) {
                    foundValidHead = true;
                    let head = classList[0];
                    if (!(0, types_1.isClass)(head) && !(0, types_1.isAnyOrUnknown)(head)) {
                        head = types_1.UnknownType.create();
                    }
                    classType.details.mro.push(head);
                    classList.shift();
                    break;
                }
                if (!isInTail(classList[0], classListsToMerge)) {
                    foundValidHead = true;
                    classType.details.mro.push(classList[0]);
                    filterClass(classList[0], classListsToMerge);
                    break;
                }
            }
        }
        // If all lists are empty, we are done.
        if (!nonEmptyList) {
            break;
        }
        // We made it all the way through the list of class lists without
        // finding a valid head, but there is at least one list that's not
        // yet empty. This means there's no valid MRO order.
        if (!foundValidHead) {
            isMroFound = false;
            // Handle the situation by pull the head off the first empty list.
            // This allows us to make forward progress.
            if (!(0, types_1.isInstantiableClass)(nonEmptyList[0])) {
                let head = nonEmptyList[0];
                if (!(0, types_1.isClass)(head) && !(0, types_1.isAnyOrUnknown)(head)) {
                    head = types_1.UnknownType.create();
                }
                classType.details.mro.push(head);
                nonEmptyList.shift();
            }
            else {
                classType.details.mro.push(nonEmptyList[0]);
                filterClass(nonEmptyList[0], classListsToMerge);
            }
        }
    }
    return isMroFound;
}
exports.computeMroLinearization = computeMroLinearization;
// Returns zero or more unique module names that point to the place(s)
// where the type is declared. Unions, for example, can result in more
// than one result. Type arguments are not included.
function getDeclaringModulesForType(type) {
    const moduleList = [];
    addDeclaringModuleNamesForType(type, moduleList);
    return moduleList;
}
exports.getDeclaringModulesForType = getDeclaringModulesForType;
function addDeclaringModuleNamesForType(type, moduleList, recursionCount = 0) {
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return;
    }
    recursionCount++;
    const addIfUnique = (moduleName) => {
        if (moduleName && !moduleList.some((n) => n === moduleName)) {
            moduleList.push(moduleName);
        }
    };
    switch (type.category) {
        case 6 /* TypeCategory.Class */: {
            addIfUnique(type.details.moduleName);
            break;
        }
        case 4 /* TypeCategory.Function */: {
            addIfUnique(type.details.moduleName);
            break;
        }
        case 5 /* TypeCategory.OverloadedFunction */: {
            type.overloads.forEach((overload) => {
                addDeclaringModuleNamesForType(overload, moduleList, recursionCount);
            });
            break;
        }
        case 8 /* TypeCategory.Union */: {
            doForEachSubtype(type, (subtype) => {
                addDeclaringModuleNamesForType(subtype, moduleList, recursionCount);
            });
            break;
        }
        case 7 /* TypeCategory.Module */: {
            addIfUnique(type.moduleName);
            break;
        }
    }
}
// Converts a function into a FunctionType that represents the function's
// input signature and converts a ParamSpec into a FunctionType with the input
// signature (*args: P.args, **kwargs: P.kwargs).
function convertTypeToParamSpecValue(type) {
    if ((0, types_1.isParamSpec)(type)) {
        const newFunction = types_1.FunctionType.createInstance('', '', '', 65536 /* FunctionTypeFlags.ParamSpecValue */);
        types_1.FunctionType.addParamSpecVariadics(newFunction, type);
        newFunction.details.typeVarScopeId = getTypeVarScopeId(type);
        return newFunction;
    }
    if ((0, types_1.isFunction)(type)) {
        const newFunction = types_1.FunctionType.createInstance('', '', '', type.details.flags | 65536 /* FunctionTypeFlags.ParamSpecValue */, type.details.docString);
        newFunction.details.deprecatedMessage = type.details.deprecatedMessage;
        type.details.parameters.forEach((param, index) => {
            types_1.FunctionType.addParameter(newFunction, {
                category: param.category,
                name: param.name,
                hasDefault: param.hasDefault,
                defaultValueExpression: param.defaultValueExpression,
                isNameSynthesized: param.isNameSynthesized,
                type: types_1.FunctionType.getEffectiveParameterType(type, index),
            });
        });
        if (type.details.higherOrderTypeVarScopeIds) {
            newFunction.details.higherOrderTypeVarScopeIds = [...type.details.higherOrderTypeVarScopeIds];
            newFunction.details.typeVarScopeId = newFunction.details.higherOrderTypeVarScopeIds.pop();
        }
        newFunction.details.constructorTypeVarScopeId = type.details.constructorTypeVarScopeId;
        return newFunction;
    }
    return getUnknownTypeForParamSpec();
}
exports.convertTypeToParamSpecValue = convertTypeToParamSpecValue;
// Converts a FunctionType into a ParamSpec if it consists only of
// (* args: P.args, ** kwargs: P.kwargs). Otherwise returns the original type.
function convertParamSpecValueToType(type) {
    const paramSpec = types_1.FunctionType.getParamSpecFromArgsKwargs(type);
    const withoutParamSpec = types_1.FunctionType.cloneRemoveParamSpecArgsKwargs(type);
    let hasParameters = withoutParamSpec.details.parameters.length > 0;
    if (withoutParamSpec.details.parameters.length === 1) {
        // If the ParamSpec has a position-only separator as its only parameter,
        // treat it as though there are no parameters.
        const onlyParam = withoutParamSpec.details.parameters[0];
        if ((0, types_1.isPositionOnlySeparator)(onlyParam)) {
            hasParameters = false;
        }
    }
    // Can we simplify it to just a paramSpec?
    if (!hasParameters && paramSpec) {
        return paramSpec;
    }
    // Create a function type from the param spec entries.
    const functionType = types_1.FunctionType.createInstance('', '', '', 65536 /* FunctionTypeFlags.ParamSpecValue */ | withoutParamSpec.details.flags);
    types_1.FunctionType.addHigherOrderTypeVarScopeIds(functionType, withoutParamSpec.details.typeVarScopeId);
    types_1.FunctionType.addHigherOrderTypeVarScopeIds(functionType, withoutParamSpec.details.higherOrderTypeVarScopeIds);
    functionType.details.constructorTypeVarScopeId = withoutParamSpec.details.constructorTypeVarScopeId;
    withoutParamSpec.details.parameters.forEach((entry, index) => {
        types_1.FunctionType.addParameter(functionType, {
            category: entry.category,
            name: entry.name,
            hasDefault: entry.hasDefault,
            defaultValueExpression: entry.defaultValueExpression,
            isNameSynthesized: entry.isNameSynthesized,
            hasDeclaredType: true,
            type: types_1.FunctionType.getEffectiveParameterType(withoutParamSpec, index),
        });
    });
    if (paramSpec) {
        types_1.FunctionType.addParamSpecVariadics(functionType, paramSpec);
    }
    functionType.details.docString = withoutParamSpec.details.docString;
    functionType.details.deprecatedMessage = withoutParamSpec.details.deprecatedMessage;
    functionType.details.methodClass = withoutParamSpec.details.methodClass;
    return functionType;
}
exports.convertParamSpecValueToType = convertParamSpecValueToType;
// Recursively walks a type and calls a callback for each TypeVar, allowing
// it to be replaced with something else.
class TypeVarTransformer {
    constructor() {
        this._isTransformingTypeArg = false;
        this._pendingTypeVarTransformations = new Set();
        this._pendingFunctionTransformations = [];
    }
    apply(type, recursionCount) {
        var _a, _b;
        if (recursionCount > types_1.maxTypeRecursionCount) {
            return type;
        }
        recursionCount++;
        type = this.transformGenericTypeAlias(type, recursionCount);
        // If the type is conditioned on a type variable, see if the condition
        // still applies.
        if (type.condition) {
            type = this.transformConditionalType(type, recursionCount);
        }
        // Shortcut the operation if possible.
        if (!requiresSpecialization(type)) {
            return type;
        }
        if ((0, types_1.isAnyOrUnknown)(type)) {
            return type;
        }
        if (isNoneInstance(type)) {
            return type;
        }
        if ((0, types_1.isTypeVar)(type)) {
            // Handle recursive type aliases specially. In particular,
            // we need to specialize type arguments for generic recursive
            // type aliases.
            if (type.details.recursiveTypeAliasName) {
                if (!((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.typeArguments)) {
                    return type;
                }
                let requiresUpdate = false;
                const typeArgs = type.typeAliasInfo.typeArguments.map((typeArg) => {
                    const replacementType = this.apply(typeArg, recursionCount);
                    if (replacementType !== typeArg) {
                        requiresUpdate = true;
                    }
                    return replacementType;
                });
                if (requiresUpdate) {
                    return types_1.TypeBase.cloneForTypeAlias(type, type.typeAliasInfo.name, type.typeAliasInfo.fullName, type.typeAliasInfo.moduleName, type.typeAliasInfo.fileUri, type.typeAliasInfo.typeVarScopeId, type.typeAliasInfo.isPep695Syntax, type.typeAliasInfo.typeParameters, typeArgs);
                }
                return type;
            }
            let replacementType = type;
            // Recursively transform the results, but ensure that we don't replace any
            // type variables in the same scope recursively by setting it the scope in the
            // _pendingTypeVarTransformations set.
            if (!this._isTypeVarScopePending(type.scopeId)) {
                if (type.details.isParamSpec) {
                    let paramSpecWithoutAccess = type;
                    if (type.paramSpecAccess) {
                        paramSpecWithoutAccess = types_1.TypeVarType.cloneForParamSpecAccess(type, /* access */ undefined);
                    }
                    const paramSpecValue = this.transformParamSpec(paramSpecWithoutAccess, recursionCount);
                    if (paramSpecValue) {
                        const paramSpecType = convertParamSpecValueToType(paramSpecValue);
                        if (type.paramSpecAccess) {
                            if ((0, types_1.isParamSpec)(paramSpecType)) {
                                replacementType = types_1.TypeVarType.cloneForParamSpecAccess(paramSpecType, type.paramSpecAccess);
                            }
                            else {
                                replacementType = types_1.UnknownType.create();
                            }
                        }
                        else {
                            replacementType = paramSpecType;
                        }
                    }
                }
                else {
                    replacementType = (_b = this.transformTypeVar(type, recursionCount)) !== null && _b !== void 0 ? _b : type;
                    if (!this._isTransformingTypeArg) {
                        if (type.scopeId) {
                            this._pendingTypeVarTransformations.add(type.scopeId);
                        }
                        replacementType = this.apply(replacementType, recursionCount);
                        if (type.scopeId) {
                            this._pendingTypeVarTransformations.delete(type.scopeId);
                        }
                    }
                    // If we're transforming a variadic type variable that was in a union,
                    // expand the union types.
                    if ((0, types_1.isVariadicTypeVar)(type) && type.isVariadicInUnion) {
                        replacementType = _expandVariadicUnpackedUnion(replacementType);
                    }
                }
            }
            return replacementType;
        }
        if ((0, types_1.isUnion)(type)) {
            const newUnionType = mapSubtypes(type, (subtype) => {
                let transformedType = this.apply(subtype, recursionCount);
                // If we're transforming a variadic type variable within a union,
                // combine the individual types within the variadic type variable.
                if ((0, types_1.isVariadicTypeVar)(subtype) && !(0, types_1.isVariadicTypeVar)(transformedType)) {
                    const subtypesToCombine = [];
                    doForEachSubtype(transformedType, (transformedSubtype) => {
                        subtypesToCombine.push(_expandVariadicUnpackedUnion(transformedSubtype));
                    });
                    transformedType = (0, types_1.combineTypes)(subtypesToCombine);
                }
                if (this.transformUnionSubtype) {
                    return this.transformUnionSubtype(subtype, transformedType, recursionCount);
                }
                return transformedType;
            });
            return !(0, types_1.isNever)(newUnionType) ? newUnionType : types_1.UnknownType.create();
        }
        if ((0, types_1.isClass)(type)) {
            return this.transformTypeVarsInClassType(type, recursionCount);
        }
        if ((0, types_1.isFunction)(type)) {
            // Prevent recursion.
            if (this._pendingFunctionTransformations.some((t) => t === type)) {
                return type;
            }
            this._pendingFunctionTransformations.push(type);
            const result = this.transformTypeVarsInFunctionType(type, recursionCount);
            this._pendingFunctionTransformations.pop();
            return result;
        }
        if ((0, types_1.isOverloadedFunction)(type)) {
            // Prevent recursion.
            if (this._pendingFunctionTransformations.some((t) => t === type)) {
                return type;
            }
            this._pendingFunctionTransformations.push(type);
            let requiresUpdate = false;
            // Specialize each of the functions in the overload.
            const newOverloads = [];
            type.overloads.forEach((entry) => {
                const replacementType = this.transformTypeVarsInFunctionType(entry, recursionCount);
                if ((0, types_1.isFunction)(replacementType)) {
                    newOverloads.push(replacementType);
                }
                else {
                    (0, collectionUtils_1.appendArray)(newOverloads, replacementType.overloads);
                }
                if (replacementType !== entry) {
                    requiresUpdate = true;
                }
            });
            this._pendingFunctionTransformations.pop();
            // Construct a new overload with the specialized function types.
            return requiresUpdate ? types_1.OverloadedFunctionType.create(newOverloads) : type;
        }
        return type;
    }
    transformTypeVar(typeVar, recursionCount) {
        return undefined;
    }
    transformTupleTypeVar(paramSpec, recursionCount) {
        return undefined;
    }
    transformParamSpec(paramSpec, recursionCount) {
        return undefined;
    }
    transformUnionSubtype(preTransform, postTransform, recursionCount) {
        return postTransform;
    }
    doForEachSignatureContext(callback) {
        // By default, simply return the result of the callback. Subclasses
        // can override this method as they see fit.
        return callback();
    }
    transformGenericTypeAlias(type, recursionCount) {
        if (!type.typeAliasInfo || !type.typeAliasInfo.typeParameters || !type.typeAliasInfo.typeArguments) {
            return type;
        }
        let requiresUpdate = false;
        const newTypeArgs = type.typeAliasInfo.typeArguments.map((typeArg) => {
            const updatedType = this.apply(typeArg, recursionCount);
            if (type !== updatedType) {
                requiresUpdate = true;
            }
            return updatedType;
        });
        return requiresUpdate
            ? types_1.TypeBase.cloneForTypeAlias(type, type.typeAliasInfo.name, type.typeAliasInfo.fullName, type.typeAliasInfo.moduleName, type.typeAliasInfo.fileUri, type.typeAliasInfo.typeVarScopeId, type.typeAliasInfo.isPep695Syntax, type.typeAliasInfo.typeParameters, newTypeArgs)
            : type;
    }
    transformConditionalType(type, recursionCount) {
        // By default, do not perform any transform.
        return type;
    }
    transformTypeVarsInClassType(classType, recursionCount) {
        const typeParams = types_1.ClassType.getTypeParameters(classType);
        // Handle the common case where the class has no type parameters.
        if (typeParams.length === 0 &&
            !types_1.ClassType.isSpecialBuiltIn(classType) &&
            !types_1.ClassType.isBuiltIn(classType, 'type')) {
            return classType;
        }
        let newTypeArgs;
        let newTupleTypeArgs;
        let specializationNeeded = false;
        const transformParamSpec = (paramSpec) => {
            const paramSpecValue = this.transformParamSpec(paramSpec, recursionCount);
            if (paramSpecValue) {
                specializationNeeded = true;
                return convertParamSpecValueToType(paramSpecValue);
            }
            else {
                return paramSpec;
            }
        };
        const wasTransformingTypeArg = this._isTransformingTypeArg;
        this._isTransformingTypeArg = true;
        // If type args were previously provided, specialize them.
        // Handle tuples specially.
        if (types_1.ClassType.isTupleClass(classType)) {
            if (classType.tupleTypeArguments) {
                newTupleTypeArgs = [];
                classType.tupleTypeArguments.forEach((oldTypeArgType) => {
                    const newTypeArgType = this.apply(oldTypeArgType.type, recursionCount);
                    if (newTypeArgType !== oldTypeArgType.type) {
                        specializationNeeded = true;
                    }
                    if ((0, types_1.isUnpackedVariadicTypeVar)(oldTypeArgType.type) &&
                        (0, types_1.isClassInstance)(newTypeArgType) &&
                        isTupleClass(newTypeArgType) &&
                        newTypeArgType.tupleTypeArguments) {
                        (0, collectionUtils_1.appendArray)(newTupleTypeArgs, newTypeArgType.tupleTypeArguments);
                    }
                    else {
                        // Handle the special case where tuple[T, ...] is being specialized
                        // to tuple[Never, ...]. This is equivalent to tuple[()].
                        const isEmptyTuple = oldTypeArgType.isUnbounded &&
                            (0, types_1.isTypeVar)(oldTypeArgType.type) &&
                            (0, types_1.isNever)(newTypeArgType) &&
                            classType.tupleTypeArguments.length === 1;
                        if (!isEmptyTuple) {
                            newTupleTypeArgs.push({
                                type: newTypeArgType,
                                isUnbounded: oldTypeArgType.isUnbounded,
                                isOptional: oldTypeArgType.isOptional,
                            });
                        }
                    }
                });
            }
            else if (typeParams.length > 0) {
                newTupleTypeArgs = this.transformTupleTypeVar(typeParams[0], recursionCount);
                if (newTupleTypeArgs) {
                    specializationNeeded = true;
                }
                else {
                    const newTypeArgType = this.apply(typeParams[0], recursionCount);
                    newTupleTypeArgs = [{ type: newTypeArgType, isUnbounded: true }];
                    specializationNeeded = true;
                }
            }
            // If this is an empty tuple, don't recompute the non-tuple type argument.
            if (newTupleTypeArgs && newTupleTypeArgs.length > 0) {
                // Combine the tuple type args into a single non-tuple type argument.
                newTypeArgs = [
                    (0, types_1.combineTypes)(newTupleTypeArgs.map((t) => {
                        if ((0, types_1.isTypeVar)(t.type) && (0, types_1.isUnpackedVariadicTypeVar)(t.type)) {
                            // Treat the unpacked TypeVarTuple as a union.
                            return types_1.TypeVarType.cloneForUnpacked(t.type, /* isInUnion */ true);
                        }
                        return t.type;
                    })),
                ];
            }
        }
        if (!newTypeArgs) {
            if (classType.typeArguments) {
                newTypeArgs = classType.typeArguments.map((oldTypeArgType) => {
                    if ((0, types_1.isTypeVar)(oldTypeArgType) && oldTypeArgType.details.isParamSpec) {
                        return transformParamSpec(oldTypeArgType);
                    }
                    let newTypeArgType = this.apply(oldTypeArgType, recursionCount);
                    if (newTypeArgType !== oldTypeArgType) {
                        specializationNeeded = true;
                        // If this was a variadic type variable that was part of a union
                        // (e.g. Union[Unpack[Vs]]), expand the subtypes into a union here.
                        if ((0, types_1.isTypeVar)(oldTypeArgType) &&
                            (0, types_1.isVariadicTypeVar)(oldTypeArgType) &&
                            oldTypeArgType.isVariadicInUnion) {
                            newTypeArgType = _expandVariadicUnpackedUnion(newTypeArgType);
                        }
                    }
                    return newTypeArgType;
                });
            }
            else {
                newTypeArgs = [];
                typeParams.forEach((typeParam) => {
                    let replacementType = typeParam;
                    if (typeParam.details.isParamSpec) {
                        replacementType = transformParamSpec(typeParam);
                        if (replacementType !== typeParam) {
                            specializationNeeded = true;
                        }
                    }
                    else {
                        if (!this._isTypeVarScopePending(typeParam.scopeId)) {
                            const transformedType = this.transformTypeVar(typeParam, recursionCount);
                            replacementType = transformedType !== null && transformedType !== void 0 ? transformedType : typeParam;
                            if (replacementType !== typeParam) {
                                specializationNeeded = true;
                            }
                            else if (transformedType !== undefined && !classType.typeArguments) {
                                specializationNeeded = true;
                            }
                        }
                    }
                    newTypeArgs.push(replacementType);
                });
            }
        }
        this._isTransformingTypeArg = wasTransformingTypeArg;
        // If specialization wasn't needed, don't allocate a new class.
        if (!specializationNeeded) {
            return classType;
        }
        return types_1.ClassType.cloneForSpecialization(classType, newTypeArgs, 
        /* isTypeArgumentExplicit */ true, 
        /* includeSubclasses */ undefined, newTupleTypeArgs);
    }
    transformTypeVarsInFunctionType(sourceType, recursionCount) {
        return this.doForEachSignatureContext(() => {
            let functionType = sourceType;
            const declaredReturnType = types_1.FunctionType.getEffectiveReturnType(functionType);
            const specializedReturnType = declaredReturnType
                ? this.apply(declaredReturnType, recursionCount)
                : undefined;
            let typesRequiredSpecialization = declaredReturnType !== specializedReturnType;
            const specializedParameters = {
                parameterTypes: [],
                returnType: specializedReturnType,
            };
            const paramSpec = types_1.FunctionType.getParamSpecFromArgsKwargs(functionType);
            if (paramSpec) {
                const paramSpecType = this.transformParamSpec(paramSpec, recursionCount);
                if (paramSpecType) {
                    const transformedParamSpec = types_1.FunctionType.getParamSpecFromArgsKwargs(paramSpecType);
                    if (paramSpecType.details.parameters.length > 0 ||
                        !transformedParamSpec ||
                        !(0, types_1.isTypeSame)(paramSpec, transformedParamSpec)) {
                        functionType = types_1.FunctionType.applyParamSpecValue(functionType, paramSpecType);
                    }
                }
            }
            let variadicParamIndex;
            let variadicTypesToUnpack;
            const specializedDefaultArgs = [];
            const wasTransformingTypeArg = this._isTransformingTypeArg;
            this._isTransformingTypeArg = true;
            for (let i = 0; i < functionType.details.parameters.length; i++) {
                const paramType = types_1.FunctionType.getEffectiveParameterType(functionType, i);
                const specializedType = this.apply(paramType, recursionCount);
                specializedParameters.parameterTypes.push(specializedType);
                // Do we need to specialize the default argument type for this parameter?
                let defaultArgType = types_1.FunctionType.getEffectiveParameterDefaultArgType(functionType, i);
                if (defaultArgType) {
                    const specializedArgType = this.apply(defaultArgType, recursionCount);
                    if (specializedArgType !== defaultArgType) {
                        defaultArgType = specializedArgType;
                        typesRequiredSpecialization = true;
                    }
                }
                specializedDefaultArgs.push(defaultArgType);
                if (variadicParamIndex === undefined &&
                    (0, types_1.isVariadicTypeVar)(paramType) &&
                    functionType.details.parameters[i].category === 1 /* ParameterCategory.ArgsList */) {
                    variadicParamIndex = i;
                    if ((0, types_1.isClassInstance)(specializedType) &&
                        isTupleClass(specializedType) &&
                        specializedType.isUnpacked) {
                        variadicTypesToUnpack = specializedType.tupleTypeArguments;
                    }
                }
                if (paramType !== specializedType) {
                    typesRequiredSpecialization = true;
                }
            }
            let specializedInferredReturnType;
            if (functionType.inferredReturnType) {
                specializedInferredReturnType = this.apply(functionType.inferredReturnType, recursionCount);
                if (specializedInferredReturnType !== functionType.inferredReturnType) {
                    typesRequiredSpecialization = true;
                }
            }
            // Do we need to update the boundToType?
            if (functionType.boundToType) {
                const newBoundToType = this.apply(functionType.boundToType, recursionCount);
                if (newBoundToType !== functionType.boundToType && (0, types_1.isClass)(newBoundToType)) {
                    functionType = types_1.FunctionType.clone(functionType, /* stripFirstParam */ false, newBoundToType);
                }
            }
            // Do we need to update the strippedFirstParamType?
            if (functionType.strippedFirstParamType) {
                const newStrippedType = this.apply(functionType.strippedFirstParamType, recursionCount);
                if (newStrippedType !== functionType.strippedFirstParamType) {
                    functionType = types_1.TypeBase.cloneType(functionType);
                    functionType.strippedFirstParamType = newStrippedType;
                }
            }
            this._isTransformingTypeArg = wasTransformingTypeArg;
            if (!typesRequiredSpecialization) {
                return functionType;
            }
            if (specializedDefaultArgs.some((t) => t !== undefined)) {
                specializedParameters.parameterDefaultArgs = specializedDefaultArgs;
            }
            // If there was no unpacked variadic type variable, we're done.
            if (!variadicTypesToUnpack) {
                return types_1.FunctionType.cloneForSpecialization(functionType, specializedParameters, specializedInferredReturnType);
            }
            // Unpack the tuple and synthesize a new function in the process.
            const newFunctionType = types_1.TypeBase.isInstantiable(functionType)
                ? types_1.FunctionType.createInstantiable(functionType.details.flags | 64 /* FunctionTypeFlags.SynthesizedMethod */)
                : types_1.FunctionType.createSynthesizedInstance('', functionType.details.flags);
            let insertKeywordOnlySeparator = false;
            let swallowPositionOnlySeparator = false;
            specializedParameters.parameterTypes.forEach((paramType, index) => {
                if (index === variadicParamIndex) {
                    let sawUnboundedEntry = false;
                    // Unpack the tuple into individual parameters.
                    variadicTypesToUnpack.forEach((unpackedType) => {
                        types_1.FunctionType.addParameter(newFunctionType, {
                            category: unpackedType.isUnbounded || (0, types_1.isVariadicTypeVar)(unpackedType.type)
                                ? 1 /* ParameterCategory.ArgsList */
                                : 0 /* ParameterCategory.Simple */,
                            name: `__p${newFunctionType.details.parameters.length}`,
                            isNameSynthesized: true,
                            type: unpackedType.type,
                            hasDeclaredType: true,
                        });
                        if (unpackedType.isUnbounded) {
                            sawUnboundedEntry = true;
                        }
                    });
                    if (sawUnboundedEntry) {
                        swallowPositionOnlySeparator = true;
                    }
                    else {
                        insertKeywordOnlySeparator = true;
                    }
                }
                else {
                    const param = { ...functionType.details.parameters[index] };
                    if ((0, types_1.isKeywordOnlySeparator)(param)) {
                        insertKeywordOnlySeparator = false;
                    }
                    else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
                        insertKeywordOnlySeparator = false;
                    }
                    // Insert a keyword-only separator parameter if we previously
                    // unpacked a variadic TypeVar.
                    if (param.category === 0 /* ParameterCategory.Simple */ && param.name && insertKeywordOnlySeparator) {
                        types_1.FunctionType.addKeywordOnlyParameterSeparator(newFunctionType);
                        insertKeywordOnlySeparator = false;
                    }
                    param.type = paramType;
                    if (param.name && param.isNameSynthesized) {
                        param.name = `__p${newFunctionType.details.parameters.length}`;
                    }
                    if (param.category !== 0 /* ParameterCategory.Simple */ || param.name || !swallowPositionOnlySeparator) {
                        types_1.FunctionType.addParameter(newFunctionType, param);
                    }
                }
            });
            newFunctionType.details.declaredReturnType = specializedParameters.returnType;
            return newFunctionType;
        });
    }
    _isTypeVarScopePending(typeVarScopeId) {
        return !!typeVarScopeId && this._pendingTypeVarTransformations.has(typeVarScopeId);
    }
}
// Converts all type variables to Any.
class TypeVarAnyReplacer extends TypeVarTransformer {
    constructor() {
        super();
    }
    transformTypeVar(typeVar) {
        return types_1.AnyType.create();
    }
    transformParamSpec(paramSpec) {
        return getUnknownTypeForParamSpec();
    }
}
// For a TypeVar with a default type, validates whether the default type is using
// any other TypeVars that are not currently in scope.
class TypeVarDefaultValidator extends TypeVarTransformer {
    constructor(_liveTypeParams, _invalidTypeVars) {
        super();
        this._liveTypeParams = _liveTypeParams;
        this._invalidTypeVars = _invalidTypeVars;
    }
    transformTypeVar(typeVar) {
        const replacementType = this._liveTypeParams.find((param) => param.details.name === typeVar.details.name);
        if (!replacementType || (0, types_1.isParamSpec)(replacementType)) {
            this._invalidTypeVars.add(typeVar.details.name);
        }
        return types_1.UnknownType.create();
    }
    transformParamSpec(paramSpec) {
        const replacementType = this._liveTypeParams.find((param) => param.details.name === paramSpec.details.name);
        if (!replacementType || !(0, types_1.isParamSpec)(replacementType)) {
            this._invalidTypeVars.add(paramSpec.details.name);
        }
        return undefined;
    }
}
class UniqueFunctionSignatureTransformer extends TypeVarTransformer {
    constructor(_signatureTracker, _expressionOffset) {
        super();
        this._signatureTracker = _signatureTracker;
        this._expressionOffset = _expressionOffset;
    }
    transformGenericTypeAlias(type, recursionCount) {
        // Don't transform type aliases.
        return type;
    }
    transformTypeVarsInClassType(classType, recursionCount) {
        // Don't transform classes.
        return classType;
    }
    transformTypeVarsInFunctionType(sourceType, recursionCount) {
        if (sourceType.trackedSignatures) {
            this._signatureTracker.addTrackedSignatures(sourceType.trackedSignatures);
        }
        // If this function is not generic, there's no need to check for uniqueness.
        if (sourceType.details.typeParameters.length === 0) {
            return super.transformTypeVarsInFunctionType(sourceType, recursionCount);
        }
        let updatedSourceType = sourceType;
        const existingSignature = this._signatureTracker.findSignature(sourceType);
        if (existingSignature) {
            let offsetIndex = existingSignature.expressionOffsets.findIndex((offset) => offset === this._expressionOffset);
            if (offsetIndex < 0) {
                offsetIndex = existingSignature.expressionOffsets.length;
            }
            if (offsetIndex > 0) {
                const typeVarContext = new typeVarContext_1.TypeVarContext(getTypeVarScopeIds(sourceType));
                // Create new type variables with the same scope but with
                // different (unique) names.
                sourceType.details.typeParameters.forEach((typeParam) => {
                    if (typeParam.scopeType === 1 /* TypeVarScopeType.Function */) {
                        let replacement = types_1.TypeVarType.cloneForNewName(typeParam, `${typeParam.details.name}(${offsetIndex})`);
                        if (replacement.details.isParamSpec) {
                            replacement = convertTypeToParamSpecValue(replacement);
                        }
                        typeVarContext.setTypeVarType(typeParam, replacement);
                    }
                });
                updatedSourceType = applySolvedTypeVars(sourceType, typeVarContext);
                (0, debug_1.assert)((0, types_1.isFunction)(updatedSourceType) || (0, types_1.isOverloadedFunction)(updatedSourceType));
            }
        }
        this._signatureTracker.addSignature(sourceType, this._expressionOffset);
        return updatedSourceType;
    }
}
// Specializes a (potentially generic) type by substituting
// type variables from a type var map.
class ApplySolvedTypeVarsTransformer extends TypeVarTransformer {
    constructor(_typeVarContext, _options) {
        super();
        this._typeVarContext = _typeVarContext;
        this._options = _options;
        this._isSolvingDefaultType = false;
    }
    transformTypeVar(typeVar, recursionCount) {
        var _a, _b;
        const signatureContext = this._typeVarContext.getSignatureContext((_a = this._activeTypeVarSignatureContextIndex) !== null && _a !== void 0 ? _a : 0);
        // If the type variable is unrelated to the scopes we're solving,
        // don't transform that type variable.
        if (typeVar.scopeId && this._typeVarContext.hasSolveForScope(typeVar.scopeId)) {
            let replacement = signatureContext.getTypeVarType(typeVar, !!this._options.useNarrowBoundOnly);
            // If there was no narrow bound but there is a wide bound that
            // contains literals or a TypeVar, we'll use the wide bound even if
            // "useNarrowBoundOnly" is specified.
            if (!replacement && this._options.useNarrowBoundOnly) {
                const wideType = signatureContext.getTypeVarType(typeVar);
                if (wideType) {
                    if ((0, types_1.isTypeVar)(wideType) || containsLiteralType(wideType, /* includeTypeArgs */ true)) {
                        replacement = wideType;
                    }
                }
            }
            if (replacement) {
                if (types_1.TypeBase.isInstantiable(typeVar)) {
                    if ((0, types_1.isAnyOrUnknown)(replacement) &&
                        this._options.typeClassType &&
                        (0, types_1.isInstantiableClass)(this._options.typeClassType)) {
                        replacement = types_1.ClassType.cloneForSpecialization(types_1.ClassType.cloneAsInstance(this._options.typeClassType), [replacement], 
                        /* isTypeArgumentExplicit */ true);
                    }
                    else {
                        replacement = convertToInstantiable(replacement, /* includeSubclasses */ false);
                    }
                }
                else {
                    // If the TypeVar is not instantiable (i.e. not a type[T]), then
                    // it represents an instance of a type. If the replacement includes
                    // a generic class that has not been specialized, specialize it
                    // now with default type arguments.
                    replacement = mapSubtypes(replacement, (subtype) => {
                        if ((0, types_1.isClassInstance)(subtype)) {
                            // If the includeSubclasses wasn't set, force it to be set by
                            // converting to/from an instantiable.
                            if (!subtype.includeSubclasses) {
                                subtype = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneAsInstantiable(subtype));
                            }
                            if (this._options.unknownIfNotFound) {
                                return this._options.useUnknownOverDefault
                                    ? specializeWithUnknownTypeArgs(subtype, this._options.tupleClassType)
                                    : specializeWithDefaultTypeArgs(subtype);
                            }
                        }
                        return subtype;
                    });
                }
                if ((0, types_1.isTypeVar)(replacement) && typeVar.isVariadicUnpacked && replacement.details.isVariadic) {
                    return types_1.TypeVarType.cloneForUnpacked(replacement, typeVar.isVariadicInUnion);
                }
                if (!(0, types_1.isTypeVar)(replacement) || !replacement.isInScopePlaceholder || !this._options.unknownIfNotFound) {
                    return replacement;
                }
            }
            // If this typeVar is in scope for what we're solving but the type
            // var map doesn't contain any entry for it, replace with the
            // default or Unknown.
            let useDefaultOrUnknown = false;
            if (this._options.unknownIfNotFound) {
                const exemptTypeVars = (_b = this._options.unknownExemptTypeVars) !== null && _b !== void 0 ? _b : [];
                const typeVarInstance = types_1.TypeBase.isInstance(typeVar) ? typeVar : types_1.TypeVarType.cloneAsInstance(typeVar);
                if (!exemptTypeVars.some((t) => (0, types_1.isTypeSame)(t, typeVarInstance))) {
                    useDefaultOrUnknown = true;
                }
            }
            else if (this._options.applyInScopePlaceholders && typeVar.isInScopePlaceholder) {
                useDefaultOrUnknown = true;
            }
            if (useDefaultOrUnknown) {
                // Use the default value if there is one.
                if (typeVar.details.isDefaultExplicit && !this._options.useUnknownOverDefault) {
                    return this._solveDefaultType(typeVar.details.defaultType, recursionCount);
                }
                return getUnknownTypeForTypeVar(typeVar, this._options.tupleClassType);
            }
        }
        // If we're solving a default type, handle type variables with no scope ID.
        if (this._isSolvingDefaultType && !typeVar.scopeId) {
            const replacementEntry = signatureContext
                .getTypeVars()
                .find((entry) => entry.typeVar.details.name === typeVar.details.name);
            if (replacementEntry) {
                return signatureContext.getTypeVarType(replacementEntry.typeVar);
            }
            if (typeVar.details.isDefaultExplicit) {
                return this.apply(typeVar.details.defaultType, recursionCount);
            }
            return types_1.UnknownType.create();
        }
        return undefined;
    }
    transformUnionSubtype(preTransform, postTransform) {
        var _a;
        // If a union contains unsolved TypeVars within scope, eliminate them
        // unless this results in an empty union. This elimination is needed
        // in cases where TypeVars can go unsolved due to unions in parameter
        // annotations, like this:
        //   def test(x: Union[str, T]) -> Union[str, T]
        if (this._options.eliminateUnsolvedInUnions) {
            if ((0, types_1.isTypeVar)(preTransform) &&
                preTransform.scopeId !== undefined &&
                this._typeVarContext.hasSolveForScope(preTransform.scopeId)) {
                const signatureContext = this._typeVarContext.getSignatureContext((_a = this._activeTypeVarSignatureContextIndex) !== null && _a !== void 0 ? _a : 0);
                const typeVarType = signatureContext.getTypeVarType(preTransform);
                // Did the TypeVar remain unsolved?
                if (!typeVarType || ((0, types_1.isTypeVar)(typeVarType) && typeVarType.isInScopePlaceholder)) {
                    // If the TypeVar was not transformed, then it was unsolved,
                    // and we'll eliminate it.
                    if (preTransform === postTransform) {
                        return undefined;
                    }
                    // If unknownIfNotFound is true, the postTransform type will
                    // be Unknown, which we want to eliminate.
                    if ((0, types_1.isUnknown)(postTransform) && this._options.unknownIfNotFound) {
                        return undefined;
                    }
                }
            }
        }
        return postTransform;
    }
    transformTupleTypeVar(typeVar) {
        var _a;
        if (!typeVar.scopeId || !this._typeVarContext.hasSolveForScope(typeVar.scopeId)) {
            const defaultType = typeVar.details.defaultType;
            if (typeVar.details.isDefaultExplicit && (0, types_1.isClassInstance)(defaultType) && defaultType.tupleTypeArguments) {
                return defaultType.tupleTypeArguments;
            }
            return undefined;
        }
        const signatureContext = this._typeVarContext.getSignatureContext((_a = this._activeTypeVarSignatureContextIndex) !== null && _a !== void 0 ? _a : 0);
        return signatureContext.getTupleTypeVar(typeVar);
    }
    transformParamSpec(paramSpec, recursionCount) {
        var _a, _b;
        const signatureContext = this._typeVarContext.getSignatureContext((_a = this._activeTypeVarSignatureContextIndex) !== null && _a !== void 0 ? _a : 0);
        // If we're solving a default type, handle param specs with no scope ID.
        if (this._isSolvingDefaultType && !paramSpec.scopeId) {
            const replacementEntry = signatureContext
                .getTypeVars()
                .find((entry) => entry.typeVar.details.name === paramSpec.details.name);
            if (replacementEntry) {
                return signatureContext.getParamSpecType(replacementEntry.typeVar);
            }
            if (paramSpec.details.isDefaultExplicit) {
                return convertTypeToParamSpecValue(this.apply(paramSpec.details.defaultType, recursionCount));
            }
            return getUnknownTypeForParamSpec();
        }
        if (!paramSpec.scopeId || !this._typeVarContext.hasSolveForScope(paramSpec.scopeId)) {
            return undefined;
        }
        const transformedParamSpec = signatureContext.getParamSpecType(paramSpec);
        if (transformedParamSpec) {
            return transformedParamSpec;
        }
        let useDefaultOrUnknown = false;
        if (this._options.unknownIfNotFound) {
            const exemptTypeVars = (_b = this._options.unknownExemptTypeVars) !== null && _b !== void 0 ? _b : [];
            if (!exemptTypeVars.some((t) => (0, types_1.isTypeSame)(t, paramSpec, { ignoreTypeFlags: true }))) {
                useDefaultOrUnknown = true;
            }
        }
        else if (this._options.applyInScopePlaceholders && paramSpec.isInScopePlaceholder) {
            useDefaultOrUnknown = true;
        }
        if (useDefaultOrUnknown) {
            // Use the default value if there is one.
            if (paramSpec.details.isDefaultExplicit && !this._options.useUnknownOverDefault) {
                return convertTypeToParamSpecValue(this._solveDefaultType(paramSpec.details.defaultType, recursionCount));
            }
            // Convert to the ParamSpec equivalent of "Unknown".
            return getUnknownTypeForParamSpec();
        }
        return undefined;
    }
    transformConditionalType(type, recursionCount) {
        var _a;
        if (!type.condition) {
            return type;
        }
        const signatureContext = this._typeVarContext.getSignatureContext((_a = this._activeTypeVarSignatureContextIndex) !== null && _a !== void 0 ? _a : 0);
        for (const condition of type.condition) {
            // This doesn't apply to bound type variables.
            if (condition.typeVar.details.constraints.length === 0) {
                continue;
            }
            const typeVarEntry = signatureContext.getTypeVar(condition.typeVar);
            if (!typeVarEntry || condition.constraintIndex >= typeVarEntry.typeVar.details.constraints.length) {
                continue;
            }
            const value = signatureContext.getTypeVarType(typeVarEntry.typeVar);
            if (!value) {
                continue;
            }
            const constraintType = typeVarEntry.typeVar.details.constraints[condition.constraintIndex];
            // If this violates the constraint, substitute a Never type.
            if (!(0, types_1.isTypeSame)(constraintType, value)) {
                return types_1.NeverType.createNever();
            }
        }
        return type;
    }
    doForEachSignatureContext(callback) {
        const signatureContexts = this._typeVarContext.getSignatureContexts();
        // Handle the common case where there are not multiple signature contexts.
        if (signatureContexts.length <= 1) {
            return callback();
        }
        // Loop through all of the signature contexts in the type var context
        // to create an overload type.
        const overloadTypes = signatureContexts.map((_, index) => {
            this._activeTypeVarSignatureContextIndex = index;
            return callback();
        });
        this._activeTypeVarSignatureContextIndex = undefined;
        const filteredOverloads = [];
        doForEachSubtype((0, types_1.combineTypes)(overloadTypes), (subtype) => {
            (0, debug_1.assert)((0, types_1.isFunction)(subtype));
            subtype = types_1.FunctionType.cloneWithNewFlags(subtype, subtype.details.flags | 256 /* FunctionTypeFlags.Overloaded */);
            filteredOverloads.push(subtype);
        });
        if (filteredOverloads.length === 1) {
            return filteredOverloads[0];
        }
        return types_1.OverloadedFunctionType.create(filteredOverloads);
    }
    _solveDefaultType(defaultType, recursionCount) {
        const wasSolvingDefaultType = this._isSolvingDefaultType;
        this._isSolvingDefaultType = true;
        const result = this.apply(defaultType, recursionCount);
        this._isSolvingDefaultType = wasSolvingDefaultType;
        return result;
    }
}
class ExpectedTypeTransformer extends TypeVarTransformer {
    constructor(_liveTypeVarScopes, _usageOffset) {
        super();
        this._liveTypeVarScopes = _liveTypeVarScopes;
        this._usageOffset = _usageOffset;
    }
    transformTypeVar(typeVar) {
        if (!this._isTypeVarLive(typeVar)) {
            return types_1.TypeVarType.cloneAsInScopePlaceholder(typeVar, this._usageOffset);
        }
        return typeVar;
    }
    transformParamSpec(paramSpec) {
        if (!this._isTypeVarLive(paramSpec)) {
            return convertTypeToParamSpecValue(types_1.TypeVarType.cloneAsInScopePlaceholder(paramSpec, this._usageOffset));
        }
        return undefined;
    }
    _isTypeVarLive(typeVar) {
        return this._liveTypeVarScopes.some((scopeId) => typeVar.scopeId === scopeId);
    }
}
class InScopePlaceholderTransformer extends TypeVarTransformer {
    constructor(_signatureContext) {
        super();
        this._signatureContext = _signatureContext;
    }
    transformTypeVar(typeVar) {
        var _a;
        if (typeVar.isInScopePlaceholder) {
            return (_a = this._signatureContext.getTypeVarType(typeVar)) !== null && _a !== void 0 ? _a : typeVar;
        }
        return typeVar;
    }
    transformParamSpec(paramSpec) {
        if (paramSpec.isInScopePlaceholder) {
            return this._signatureContext.getParamSpecType(paramSpec);
        }
        return undefined;
    }
}
function applyInScopePlaceholdersToType(type, signatureContext) {
    // Handle the common case where there are no in-scope placeholders.
    // No more work is required in this case.
    if (!signatureContext.getTypeVars().some((entry) => entry.typeVar.isInScopePlaceholder)) {
        return type;
    }
    const transformer = new InScopePlaceholderTransformer(signatureContext);
    return transformer.apply(type, 0);
}
//# sourceMappingURL=typeUtils.js.map