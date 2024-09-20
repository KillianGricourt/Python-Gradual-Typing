"use strict";
/*
 * types.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Representation of types used during type analysis within Python.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSameWithoutLiteralValue = exports.combineTypes = exports.findSubtype = exports.removeFromUnion = exports.removeUnbound = exports.removeUnknownFromUnion = exports.isTypeSame = exports.getTypeAliasInfo = exports.isOverloadedFunction = exports.isFunction = exports.isParamSpec = exports.isUnpacked = exports.isUnpackedClass = exports.isUnpackedVariadicTypeVar = exports.isVariadicTypeVar = exports.isTypeVar = exports.isModule = exports.isClassInstance = exports.isInstantiableClass = exports.isClass = exports.isPossiblyUnbound = exports.isUnion = exports.isUnbound = exports.isAnyOrUnknown = exports.isUnknown = exports.isAny = exports.isNever = exports.TypeVarType = exports.UnionType = exports.TypeCondition = exports.AnyType = exports.NeverType = exports.OverloadedFunctionType = exports.FunctionType = exports.isKeywordOnlySeparator = exports.isPositionOnlySeparator = exports.ClassType = exports.ModuleType = exports.UnknownType = exports.UnboundType = exports.TypeBase = exports.maxTypeRecursionCount = exports.EnumLiteral = exports.InScopePlaceholderScopeId = void 0;
const debug_1 = require("../common/debug");
exports.InScopePlaceholderScopeId = '-';
class EnumLiteral {
    constructor(classFullName, className, itemName, itemType) {
        this.classFullName = classFullName;
        this.className = className;
        this.itemName = itemName;
        this.itemType = itemType;
    }
    getName() {
        return `${this.classFullName}.${this.itemName}`;
    }
}
exports.EnumLiteral = EnumLiteral;
// This constant controls the maximum number of nested types (i.e. types
// used as type arguments or parameter types in other types) before we
// give up. This constant was previously set to 32, but there were certain
// pathological recursive types where this resulted in a hang. It was also
// previously lowered to 10, but this caused some legitimate failures in
// code that used numpy. Even at 16, there are some legitimate failures in
// numpy.
exports.maxTypeRecursionCount = 20;
var TypeBase;
(function (TypeBase) {
    function isInstantiable(type) {
        return (type.flags & 1 /* TypeFlags.Instantiable */) !== 0;
    }
    TypeBase.isInstantiable = isInstantiable;
    function isInstance(type) {
        return (type.flags & 2 /* TypeFlags.Instance */) !== 0;
    }
    TypeBase.isInstance = isInstance;
    function isAmbiguous(type) {
        return !!type.isAmbiguous;
    }
    TypeBase.isAmbiguous = isAmbiguous;
    function cloneType(type) {
        const clone = { ...type };
        delete clone.cached;
        return clone;
    }
    TypeBase.cloneType = cloneType;
    function cloneAsSpecialForm(type, specialForm) {
        const clone = { ...type };
        delete clone.cached;
        if (specialForm) {
            clone.specialForm = specialForm;
        }
        else {
            delete clone.specialForm;
        }
        return clone;
    }
    TypeBase.cloneAsSpecialForm = cloneAsSpecialForm;
    function cloneTypeAsInstance(type, cache) {
        (0, debug_1.assert)(TypeBase.isInstantiable(type));
        const newInstance = TypeBase.cloneType(type);
        if (newInstance.instantiableNestingLevel === undefined) {
            newInstance.flags &= ~1 /* TypeFlags.Instantiable */;
            newInstance.flags |= 2 /* TypeFlags.Instance */;
            delete newInstance.instantiableNestingLevel;
        }
        else {
            if (newInstance.instantiableNestingLevel === 1) {
                delete newInstance.instantiableNestingLevel;
            }
            else {
                newInstance.instantiableNestingLevel--;
            }
        }
        // Should we cache it for next time?
        if (cache) {
            if (!type.cached) {
                type.cached = {};
            }
            type.cached.typeBaseInstanceType = newInstance;
        }
        return newInstance;
    }
    TypeBase.cloneTypeAsInstance = cloneTypeAsInstance;
    function cloneTypeAsInstantiable(type, cache) {
        const newInstance = TypeBase.cloneType(type);
        if (TypeBase.isInstance(type)) {
            newInstance.flags &= ~2 /* TypeFlags.Instance */;
            newInstance.flags |= 1 /* TypeFlags.Instantiable */;
        }
        else {
            newInstance.instantiableNestingLevel =
                newInstance.instantiableNestingLevel === undefined ? 1 : newInstance.instantiableNestingLevel;
        }
        // Remove type alias information because the type will no longer match
        // that of the type alias definition.
        delete newInstance.typeAliasInfo;
        // Should we cache it for next time?
        if (cache) {
            if (!type.cached) {
                type.cached = {};
            }
            type.cached.typeBaseInstantiableType = newInstance;
        }
        return newInstance;
    }
    TypeBase.cloneTypeAsInstantiable = cloneTypeAsInstantiable;
    function cloneForTypeAlias(type, name, fullName, moduleName, fileUri, typeVarScopeId, isPep695Syntax, typeParams, typeArgs) {
        const typeClone = cloneType(type);
        typeClone.typeAliasInfo = {
            name,
            fullName,
            moduleName,
            fileUri,
            typeParameters: typeParams,
            typeArguments: typeArgs,
            typeVarScopeId,
            isPep695Syntax,
        };
        return typeClone;
    }
    TypeBase.cloneForTypeAlias = cloneForTypeAlias;
    function cloneForCondition(type, condition) {
        // Handle the common case where there are no conditions. In this case,
        // cloning isn't necessary.
        if (type.condition === undefined && condition === undefined) {
            return type;
        }
        const typeClone = cloneType(type);
        typeClone.condition = condition;
        return typeClone;
    }
    TypeBase.cloneForCondition = cloneForCondition;
    function cloneForAmbiguousType(type) {
        if (type.isAmbiguous) {
            return type;
        }
        const typeClone = cloneType(type);
        typeClone.isAmbiguous = true;
        return typeClone;
    }
    TypeBase.cloneForAmbiguousType = cloneForAmbiguousType;
})(TypeBase || (exports.TypeBase = TypeBase = {}));
var UnboundType;
(function (UnboundType) {
    const _instance = {
        category: 0 /* TypeCategory.Unbound */,
        flags: 1 /* TypeFlags.Instantiable */ | 2 /* TypeFlags.Instance */,
    };
    function create() {
        // All Unbound objects are the same, so use a shared instance.
        return _instance;
    }
    UnboundType.create = create;
    function convertToInstance(type) {
        // Remove the "special form" if present. Otherwise return the existing type.
        return type.specialForm ? UnboundType.create() : type;
    }
    UnboundType.convertToInstance = convertToInstance;
})(UnboundType || (exports.UnboundType = UnboundType = {}));
var UnknownType;
(function (UnknownType) {
    const _instance = {
        category: 1 /* TypeCategory.Unknown */,
        flags: 1 /* TypeFlags.Instantiable */ | 2 /* TypeFlags.Instance */,
        isIncomplete: false,
    };
    const _incompleteInstance = {
        category: 1 /* TypeCategory.Unknown */,
        flags: 1 /* TypeFlags.Instantiable */ | 2 /* TypeFlags.Instance */,
        isIncomplete: true,
    };
    function create(isIncomplete = false) {
        return isIncomplete ? _incompleteInstance : _instance;
    }
    UnknownType.create = create;
    function createPossibleType(possibleType, isIncomplete) {
        const unknownWithPossibleType = {
            category: 1 /* TypeCategory.Unknown */,
            flags: 1 /* TypeFlags.Instantiable */ | 2 /* TypeFlags.Instance */,
            isIncomplete,
            possibleType,
        };
        return unknownWithPossibleType;
    }
    UnknownType.createPossibleType = createPossibleType;
    function convertToInstance(type) {
        // Remove the "special form" if present. Otherwise return the existing type.
        return type.specialForm ? UnknownType.create(type.isIncomplete) : type;
    }
    UnknownType.convertToInstance = convertToInstance;
})(UnknownType || (exports.UnknownType = UnknownType = {}));
var ModuleType;
(function (ModuleType) {
    function create(moduleName, fileUri, symbolTable) {
        const newModuleType = {
            category: 7 /* TypeCategory.Module */,
            fields: symbolTable || new Map(),
            loaderFields: new Map(),
            flags: 1 /* TypeFlags.Instantiable */ | 1 /* TypeFlags.Instantiable */,
            moduleName,
            fileUri,
        };
        return newModuleType;
    }
    ModuleType.create = create;
    function getField(moduleType, name) {
        // Always look for the symbol in the module's fields before consulting
        // the loader fields. The loader runs before the module, so its values
        // will be overwritten by the module.
        let symbol = moduleType.fields.get(name);
        if (moduleType.loaderFields) {
            if (!symbol) {
                symbol = moduleType.loaderFields.get(name);
            }
            else if (symbol.getDeclarations().length === 1) {
                // If the symbol is hidden when accessed via the module but is
                // also accessible through a loader field, use the latter so it
                // isn't flagged as an error.
                const loaderSymbol = moduleType.loaderFields.get(name);
                if (loaderSymbol && !loaderSymbol.isExternallyHidden()) {
                    symbol = loaderSymbol;
                }
            }
        }
        return symbol;
    }
    ModuleType.getField = getField;
})(ModuleType || (exports.ModuleType = ModuleType = {}));
var ClassType;
(function (ClassType) {
    function createInstantiable(name, fullName, moduleName, fileUri, flags, typeSourceId, declaredMetaclass, effectiveMetaclass, docString) {
        const newClass = {
            category: 6 /* TypeCategory.Class */,
            details: {
                name,
                fullName,
                moduleName,
                fileUri,
                flags,
                typeSourceId,
                baseClasses: [],
                declaredMetaclass,
                effectiveMetaclass,
                mro: [],
                fields: new Map(),
                typeParameters: [],
                docString,
            },
            flags: 1 /* TypeFlags.Instantiable */,
        };
        return newClass;
    }
    ClassType.createInstantiable = createInstantiable;
    function cloneAsInstance(type, includeSubclasses = true) {
        var _a;
        if (TypeBase.isInstance(type)) {
            return type;
        }
        if (includeSubclasses && ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.typeBaseInstanceType)) {
            return type.cached.typeBaseInstanceType;
        }
        const newInstance = TypeBase.cloneTypeAsInstance(type, /* cache */ includeSubclasses);
        delete newInstance.specialForm;
        if (includeSubclasses) {
            newInstance.includeSubclasses = true;
        }
        return newInstance;
    }
    ClassType.cloneAsInstance = cloneAsInstance;
    function cloneAsInstantiable(type, includeSubclasses = true) {
        var _a;
        if (includeSubclasses && ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.typeBaseInstantiableType)) {
            return type.cached.typeBaseInstantiableType;
        }
        const newInstance = TypeBase.cloneTypeAsInstantiable(type, includeSubclasses);
        if (includeSubclasses) {
            newInstance.includeSubclasses = true;
        }
        return newInstance;
    }
    ClassType.cloneAsInstantiable = cloneAsInstantiable;
    function cloneForSpecialization(classType, typeArguments, isTypeArgumentExplicit, includeSubclasses = false, tupleTypeArguments, isEmptyContainer) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.typeArguments = (typeArguments === null || typeArguments === void 0 ? void 0 : typeArguments.length) === 0 ? undefined : typeArguments;
        newClassType.isTypeArgumentExplicit = isTypeArgumentExplicit;
        if (includeSubclasses) {
            newClassType.includeSubclasses = true;
        }
        newClassType.tupleTypeArguments = tupleTypeArguments ? [...tupleTypeArguments] : undefined;
        if (isEmptyContainer !== undefined) {
            newClassType.isEmptyContainer = isEmptyContainer;
        }
        return newClassType;
    }
    ClassType.cloneForSpecialization = cloneForSpecialization;
    function cloneIncludeSubclasses(classType, includeSubclasses = true) {
        if (!!classType.includeSubclasses === includeSubclasses) {
            return classType;
        }
        const newClassType = TypeBase.cloneType(classType);
        newClassType.includeSubclasses = includeSubclasses;
        return newClassType;
    }
    ClassType.cloneIncludeSubclasses = cloneIncludeSubclasses;
    function cloneWithLiteral(classType, value) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.literalValue = value;
        // Remove type alias information because the type will no longer match
        // that of the type alias definition if we change the literal type.
        delete newClassType.typeAliasInfo;
        return newClassType;
    }
    ClassType.cloneWithLiteral = cloneWithLiteral;
    function cloneForDeprecatedInstance(type, deprecatedMessage) {
        const newClassType = TypeBase.cloneType(type);
        newClassType.deprecatedInstanceMessage = deprecatedMessage;
        return newClassType;
    }
    ClassType.cloneForDeprecatedInstance = cloneForDeprecatedInstance;
    function cloneForTypingAlias(classType, aliasName) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.aliasName = aliasName;
        return newClassType;
    }
    ClassType.cloneForTypingAlias = cloneForTypingAlias;
    function cloneForNarrowedTypedDictEntries(classType, narrowedEntries) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.typedDictNarrowedEntries = narrowedEntries;
        return newClassType;
    }
    ClassType.cloneForNarrowedTypedDictEntries = cloneForNarrowedTypedDictEntries;
    function cloneForPartialTypedDict(classType) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.isTypedDictPartial = true;
        return newClassType;
    }
    ClassType.cloneForPartialTypedDict = cloneForPartialTypedDict;
    function cloneRemoveTypePromotions(classType) {
        if (!classType.includePromotions) {
            return classType;
        }
        const newClassType = TypeBase.cloneType(classType);
        delete newClassType.includePromotions;
        return newClassType;
    }
    ClassType.cloneRemoveTypePromotions = cloneRemoveTypePromotions;
    function cloneForTypeGuard(classType, typeGuardType, isStrictTypeGuard) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.typeGuardType = typeGuardType;
        newClassType.isStrictTypeGuard = isStrictTypeGuard;
        return newClassType;
    }
    ClassType.cloneForTypeGuard = cloneForTypeGuard;
    function cloneForSymbolTableUpdate(classType) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.details = { ...newClassType.details };
        newClassType.details.fields = new Map(newClassType.details.fields);
        newClassType.details.mro = Array.from(newClassType.details.mro);
        newClassType.details.mro[0] = cloneAsInstantiable(newClassType);
        return newClassType;
    }
    ClassType.cloneForSymbolTableUpdate = cloneForSymbolTableUpdate;
    function cloneForUnpacked(classType, isUnpacked = true) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.isUnpacked = isUnpacked;
        return newClassType;
    }
    ClassType.cloneForUnpacked = cloneForUnpacked;
    function cloneWithNewFlags(classType, newFlags) {
        const newClassType = TypeBase.cloneType(classType);
        newClassType.details = { ...newClassType.details };
        newClassType.details.flags = newFlags;
        return newClassType;
    }
    ClassType.cloneWithNewFlags = cloneWithNewFlags;
    function isLiteralValueSame(type1, type2) {
        if (type1.literalValue === undefined) {
            return type2.literalValue === undefined;
        }
        else if (type2.literalValue === undefined) {
            return false;
        }
        if (type1.literalValue instanceof EnumLiteral) {
            if (type2.literalValue instanceof EnumLiteral) {
                return type1.literalValue.itemName === type2.literalValue.itemName;
            }
            return false;
        }
        return type1.literalValue === type2.literalValue;
    }
    ClassType.isLiteralValueSame = isLiteralValueSame;
    // Determines whether two typed dict classes are equivalent given
    // that one or both have narrowed entries (i.e. entries that are
    // guaranteed to be present).
    function isTypedDictNarrowedEntriesSame(type1, type2) {
        if (type1.typedDictNarrowedEntries) {
            if (!type2.typedDictNarrowedEntries) {
                return false;
            }
            const tdEntries1 = type1.typedDictNarrowedEntries;
            const tdEntries2 = type2.typedDictNarrowedEntries;
            if (tdEntries1.size !== tdEntries2.size) {
                return false;
            }
            let key;
            let entry1;
            for ([key, entry1] of tdEntries1.entries()) {
                const entry2 = tdEntries2.get(key);
                if (!entry2) {
                    return false;
                }
                if (entry1.isProvided !== entry2.isProvided) {
                    return false;
                }
            }
        }
        else if (type2.typedDictNarrowedEntries) {
            return false;
        }
        return true;
    }
    ClassType.isTypedDictNarrowedEntriesSame = isTypedDictNarrowedEntriesSame;
    // Determines whether typed dict class type1 is a narrower form of type2,
    // i.e. all of the "narrowed entries" found within type2 are also found
    // within type1.
    function isTypedDictNarrower(type1, type2) {
        var _a;
        const tdEntries2 = type2.typedDictNarrowedEntries;
        if (!tdEntries2) {
            return true;
        }
        const tdEntries1 = (_a = type1.typedDictNarrowedEntries) !== null && _a !== void 0 ? _a : new Map();
        let key;
        let entry2;
        for ([key, entry2] of tdEntries2.entries()) {
            if (entry2.isProvided) {
                const entry1 = tdEntries1.get(key);
                if (!(entry1 === null || entry1 === void 0 ? void 0 : entry1.isProvided)) {
                    return false;
                }
            }
        }
        return true;
    }
    ClassType.isTypedDictNarrower = isTypedDictNarrower;
    // Is the class generic but not specialized?
    function isUnspecialized(classType) {
        return classType.details.typeParameters.length > 0 && classType.typeArguments === undefined;
    }
    ClassType.isUnspecialized = isUnspecialized;
    function isSpecialBuiltIn(classType, className) {
        if (!(classType.details.flags & 2 /* ClassTypeFlags.SpecialBuiltIn */) && !classType.aliasName) {
            return false;
        }
        if (className !== undefined) {
            return classType.details.name === className;
        }
        return true;
    }
    ClassType.isSpecialBuiltIn = isSpecialBuiltIn;
    function isBuiltIn(classType, className) {
        if (!(classType.details.flags & 1 /* ClassTypeFlags.BuiltInClass */)) {
            return false;
        }
        if (className !== undefined) {
            const classArray = Array.isArray(className) ? className : [className];
            return (classArray.some((name) => name === classType.details.name) ||
                classArray.some((name) => name === classType.aliasName));
        }
        return true;
    }
    ClassType.isBuiltIn = isBuiltIn;
    function supportsAbstractMethods(classType) {
        return !!(classType.details.flags & 64 /* ClassTypeFlags.SupportsAbstractMethods */);
    }
    ClassType.supportsAbstractMethods = supportsAbstractMethods;
    function isDataClass(classType) {
        return !!classType.details.dataClassBehaviors;
    }
    ClassType.isDataClass = isDataClass;
    function isDataClassSkipGenerateInit(classType) {
        var _a;
        return !!((_a = classType.details.dataClassBehaviors) === null || _a === void 0 ? void 0 : _a.skipGenerateInit);
    }
    ClassType.isDataClassSkipGenerateInit = isDataClassSkipGenerateInit;
    function isDataClassSkipGenerateEq(classType) {
        var _a;
        return !!((_a = classType.details.dataClassBehaviors) === null || _a === void 0 ? void 0 : _a.skipGenerateEq);
    }
    ClassType.isDataClassSkipGenerateEq = isDataClassSkipGenerateEq;
    function isDataClassFrozen(classType) {
        var _a;
        return !!((_a = classType.details.dataClassBehaviors) === null || _a === void 0 ? void 0 : _a.frozen);
    }
    ClassType.isDataClassFrozen = isDataClassFrozen;
    function isDataClassGenerateOrder(classType) {
        var _a;
        return !!((_a = classType.details.dataClassBehaviors) === null || _a === void 0 ? void 0 : _a.generateOrder);
    }
    ClassType.isDataClassGenerateOrder = isDataClassGenerateOrder;
    function isDataClassKeywordOnly(classType) {
        var _a;
        return !!((_a = classType.details.dataClassBehaviors) === null || _a === void 0 ? void 0 : _a.keywordOnly);
    }
    ClassType.isDataClassKeywordOnly = isDataClassKeywordOnly;
    function isDataClassGenerateSlots(classType) {
        var _a;
        return !!((_a = classType.details.dataClassBehaviors) === null || _a === void 0 ? void 0 : _a.generateSlots);
    }
    ClassType.isDataClassGenerateSlots = isDataClassGenerateSlots;
    function isDataClassGenerateHash(classType) {
        var _a;
        return !!((_a = classType.details.dataClassBehaviors) === null || _a === void 0 ? void 0 : _a.generateHash);
    }
    ClassType.isDataClassGenerateHash = isDataClassGenerateHash;
    function isTypeCheckOnly(classType) {
        return !!(classType.details.flags & 1048576 /* ClassTypeFlags.TypeCheckOnly */);
    }
    ClassType.isTypeCheckOnly = isTypeCheckOnly;
    function isNewTypeClass(classType) {
        return !!(classType.details.flags & 2097152 /* ClassTypeFlags.NewTypeClass */);
    }
    ClassType.isNewTypeClass = isNewTypeClass;
    function isValidTypeAliasClass(classType) {
        return !!(classType.details.flags & 4194304 /* ClassTypeFlags.ValidTypeAliasClass */);
    }
    ClassType.isValidTypeAliasClass = isValidTypeAliasClass;
    function isSpecialFormClass(classType) {
        return !!(classType.details.flags & 8388608 /* ClassTypeFlags.SpecialFormClass */);
    }
    ClassType.isSpecialFormClass = isSpecialFormClass;
    function isIllegalIsinstanceClass(classType) {
        return !!(classType.details.flags & 16777216 /* ClassTypeFlags.IllegalIsinstanceClass */);
    }
    ClassType.isIllegalIsinstanceClass = isIllegalIsinstanceClass;
    function isTypedDictClass(classType) {
        return !!(classType.details.flags & 4 /* ClassTypeFlags.TypedDictClass */);
    }
    ClassType.isTypedDictClass = isTypedDictClass;
    function isCanOmitDictValues(classType) {
        return !!(classType.details.flags & 32 /* ClassTypeFlags.CanOmitDictValues */);
    }
    ClassType.isCanOmitDictValues = isCanOmitDictValues;
    function isTypedDictMarkedClosed(classType) {
        return !!(classType.details.flags & 8 /* ClassTypeFlags.TypedDictMarkedClosed */);
    }
    ClassType.isTypedDictMarkedClosed = isTypedDictMarkedClosed;
    function isTypedDictEffectivelyClosed(classType) {
        return !!(classType.details.flags & 16 /* ClassTypeFlags.TypedDictEffectivelyClosed */);
    }
    ClassType.isTypedDictEffectivelyClosed = isTypedDictEffectivelyClosed;
    function isEnumClass(classType) {
        return !!(classType.details.flags & 65536 /* ClassTypeFlags.EnumClass */);
    }
    ClassType.isEnumClass = isEnumClass;
    function isPropertyClass(classType) {
        return !!(classType.details.flags & 128 /* ClassTypeFlags.PropertyClass */);
    }
    ClassType.isPropertyClass = isPropertyClass;
    function isClassProperty(classType) {
        return !!(classType.details.flags & 131072 /* ClassTypeFlags.ClassProperty */);
    }
    ClassType.isClassProperty = isClassProperty;
    function isFinal(classType) {
        return !!(classType.details.flags & 256 /* ClassTypeFlags.Final */);
    }
    ClassType.isFinal = isFinal;
    function isProtocolClass(classType) {
        return !!(classType.details.flags & 512 /* ClassTypeFlags.ProtocolClass */);
    }
    ClassType.isProtocolClass = isProtocolClass;
    function isDefinedInStub(classType) {
        return !!(classType.details.flags & 262144 /* ClassTypeFlags.DefinedInStub */);
    }
    ClassType.isDefinedInStub = isDefinedInStub;
    function isPseudoGenericClass(classType) {
        return !!(classType.details.flags & 1024 /* ClassTypeFlags.PseudoGenericClass */);
    }
    ClassType.isPseudoGenericClass = isPseudoGenericClass;
    function getDataClassEntries(classType) {
        var _a, _b;
        (_b = (_a = classType.details).synthesizeMethodsDeferred) === null || _b === void 0 ? void 0 : _b.call(_a);
        return classType.details.dataClassEntries || [];
    }
    ClassType.getDataClassEntries = getDataClassEntries;
    function isRuntimeCheckable(classType) {
        return !!(classType.details.flags & 2048 /* ClassTypeFlags.RuntimeCheckable */);
    }
    ClassType.isRuntimeCheckable = isRuntimeCheckable;
    function isTypingExtensionClass(classType) {
        return !!(classType.details.flags & 4096 /* ClassTypeFlags.TypingExtensionClass */);
    }
    ClassType.isTypingExtensionClass = isTypingExtensionClass;
    function isPartiallyEvaluated(classType) {
        return !!(classType.details.flags & 8192 /* ClassTypeFlags.PartiallyEvaluated */);
    }
    ClassType.isPartiallyEvaluated = isPartiallyEvaluated;
    function hasCustomClassGetItem(classType) {
        return !!(classType.details.flags & 16384 /* ClassTypeFlags.HasCustomClassGetItem */);
    }
    ClassType.hasCustomClassGetItem = hasCustomClassGetItem;
    function isTupleClass(classType) {
        return !!(classType.details.flags & 32768 /* ClassTypeFlags.TupleClass */);
    }
    ClassType.isTupleClass = isTupleClass;
    function isReadOnlyInstanceVariables(classType) {
        return !!(classType.details.flags & 524288 /* ClassTypeFlags.ReadOnlyInstanceVariables */);
    }
    ClassType.isReadOnlyInstanceVariables = isReadOnlyInstanceVariables;
    function getTypeParameters(classType) {
        return classType.details.typeParameters;
    }
    ClassType.getTypeParameters = getTypeParameters;
    function derivesFromAnyOrUnknown(classType) {
        return classType.details.mro.some((baseClass) => isAnyOrUnknown(baseClass));
    }
    ClassType.derivesFromAnyOrUnknown = derivesFromAnyOrUnknown;
    function getSymbolTable(classType) {
        var _a, _b;
        (_b = (_a = classType.details).synthesizeMethodsDeferred) === null || _b === void 0 ? void 0 : _b.call(_a);
        return classType.details.fields;
    }
    ClassType.getSymbolTable = getSymbolTable;
    function getInheritedSlotsNames(classType) {
        var _a, _b, _c, _d;
        // First synthesize methods if needed. The slots entries
        // can depend on synthesized methods.
        (_b = (_a = classType.details).synthesizeMethodsDeferred) === null || _b === void 0 ? void 0 : _b.call(_a);
        (_d = (_c = classType.details).calculateInheritedSlotsNamesDeferred) === null || _d === void 0 ? void 0 : _d.call(_c);
        return classType.details.inheritedSlotsNamesCached;
    }
    ClassType.getInheritedSlotsNames = getInheritedSlotsNames;
    // Similar to isPartiallyEvaluated except that it also looks at all of the
    // classes in the MRO list for this class to see if any of them are still
    // partially evaluated.
    function isHierarchyPartiallyEvaluated(classType) {
        return (ClassType.isPartiallyEvaluated(classType) ||
            classType.details.mro.some((mroClass) => isClass(mroClass) && ClassType.isPartiallyEvaluated(mroClass)));
    }
    ClassType.isHierarchyPartiallyEvaluated = isHierarchyPartiallyEvaluated;
    // Same as isTypeSame except that it doesn't compare type arguments.
    function isSameGenericClass(classType, type2, recursionCount = 0) {
        if (!classType.isTypedDictPartial !== !type2.isTypedDictPartial) {
            return false;
        }
        const class1Details = classType.details;
        const class2Details = type2.details;
        if (class1Details === class2Details) {
            return true;
        }
        // Compare most of the details fields. We intentionally skip the isAbstractClass
        // flag because it gets set dynamically.
        if (class1Details.fullName !== class2Details.fullName ||
            class1Details.flags !== class2Details.flags ||
            class1Details.typeSourceId !== class2Details.typeSourceId ||
            class1Details.baseClasses.length !== class2Details.baseClasses.length ||
            class1Details.typeParameters.length !== class2Details.typeParameters.length) {
            return false;
        }
        if (recursionCount > exports.maxTypeRecursionCount) {
            return true;
        }
        recursionCount++;
        // Special-case NamedTuple and Tuple classes because we rewrite the base classes
        // in these cases.
        if (ClassType.isBuiltIn(classType, 'NamedTuple') && ClassType.isBuiltIn(type2, 'NamedTuple')) {
            return true;
        }
        if (ClassType.isBuiltIn(classType, 'tuple') && ClassType.isBuiltIn(type2, 'tuple')) {
            return true;
        }
        // Make sure the base classes match.
        for (let i = 0; i < class1Details.baseClasses.length; i++) {
            if (!isTypeSame(class1Details.baseClasses[i], class2Details.baseClasses[i], { ignorePseudoGeneric: true }, recursionCount)) {
                return false;
            }
        }
        if (class1Details.declaredMetaclass || class2Details.declaredMetaclass) {
            if (!class1Details.declaredMetaclass ||
                !class2Details.declaredMetaclass ||
                !isTypeSame(class1Details.declaredMetaclass, class2Details.declaredMetaclass, { ignorePseudoGeneric: true }, recursionCount)) {
                return false;
            }
        }
        for (let i = 0; i < class1Details.typeParameters.length; i++) {
            if (!isTypeSame(class1Details.typeParameters[i], class2Details.typeParameters[i], { ignorePseudoGeneric: true }, recursionCount)) {
                return false;
            }
        }
        return true;
    }
    ClassType.isSameGenericClass = isSameGenericClass;
    // Determines whether this is a subclass (derived class)
    // of the specified class. If the caller passes an empty
    // array to inheritanceChain, it will be filled in by
    // the call to include the chain of inherited classes starting
    // with type2 and ending with this type.
    function isDerivedFrom(subclassType, parentClassType, inheritanceChain) {
        // Is it the exact same class?
        if (isSameGenericClass(subclassType, parentClassType)) {
            // Handle literal types.
            if (parentClassType.literalValue !== undefined) {
                if (subclassType.literalValue === undefined ||
                    !ClassType.isLiteralValueSame(parentClassType, subclassType)) {
                    return false;
                }
            }
            if (inheritanceChain) {
                inheritanceChain.push(subclassType);
            }
            return true;
        }
        // Handle built-in types like 'dict' and 'list', which are all
        // subclasses of object even though they are not explicitly declared
        // that way.
        if (isBuiltIn(subclassType) && isBuiltIn(parentClassType, 'object')) {
            if (inheritanceChain) {
                inheritanceChain.push(parentClassType);
            }
            return true;
        }
        // Handle the case where both source and dest are property objects. This
        // special case is needed because we synthesize a new class for each
        // property declaration.
        if (ClassType.isBuiltIn(subclassType, 'property') && ClassType.isBuiltIn(parentClassType, 'property')) {
            if (inheritanceChain) {
                inheritanceChain.push(subclassType);
            }
            return true;
        }
        for (const baseClass of subclassType.details.baseClasses) {
            if (isInstantiableClass(baseClass)) {
                if (isDerivedFrom(baseClass, parentClassType, inheritanceChain)) {
                    if (inheritanceChain) {
                        inheritanceChain.push(subclassType);
                    }
                    return true;
                }
            }
            else if (isAnyOrUnknown(baseClass)) {
                if (inheritanceChain) {
                    inheritanceChain.push(UnknownType.create());
                }
                return true;
            }
        }
        return false;
    }
    ClassType.isDerivedFrom = isDerivedFrom;
    function getReverseMro(classType) {
        return classType.details.mro.slice(0).reverse();
    }
    ClassType.getReverseMro = getReverseMro;
})(ClassType || (exports.ClassType = ClassType = {}));
function isPositionOnlySeparator(param) {
    // A simple parameter with no name is treated as a "/" separator.
    return param.category === 0 /* ParameterCategory.Simple */ && !param.name;
}
exports.isPositionOnlySeparator = isPositionOnlySeparator;
function isKeywordOnlySeparator(param) {
    // An *args parameter with no name is treated as a "*" separator.
    return param.category === 1 /* ParameterCategory.ArgsList */ && !param.name;
}
exports.isKeywordOnlySeparator = isKeywordOnlySeparator;
var FunctionType;
(function (FunctionType) {
    function createInstance(name, fullName, moduleName, functionFlags, docString) {
        return create(name, fullName, moduleName, functionFlags, 2 /* TypeFlags.Instance */, docString);
    }
    FunctionType.createInstance = createInstance;
    function createInstantiable(functionFlags, docString) {
        return create('', '', '', functionFlags, 1 /* TypeFlags.Instantiable */, docString);
    }
    FunctionType.createInstantiable = createInstantiable;
    function createSynthesizedInstance(name, additionalFlags = 0 /* FunctionTypeFlags.None */) {
        return create(name, '', '', additionalFlags | 64 /* FunctionTypeFlags.SynthesizedMethod */, 2 /* TypeFlags.Instance */);
    }
    FunctionType.createSynthesizedInstance = createSynthesizedInstance;
    function create(name, fullName, moduleName, functionFlags, typeFlags, docString) {
        const newFunctionType = {
            category: 4 /* TypeCategory.Function */,
            details: {
                name,
                fullName,
                moduleName,
                flags: functionFlags,
                parameters: [],
                typeParameters: [],
                docString,
            },
            flags: typeFlags,
        };
        return newFunctionType;
    }
    // Creates a deep copy of the function type, including a fresh
    // version of _functionDetails.
    function clone(type, stripFirstParam = false, boundToType, boundTypeVarScopeId) {
        var _a;
        const newFunction = TypeBase.cloneType(type);
        newFunction.details = { ...type.details };
        newFunction.preBoundFlags = newFunction.details.flags;
        newFunction.boundToType = boundToType;
        newFunction.boundTypeVarScopeId = boundTypeVarScopeId;
        if (stripFirstParam) {
            if (type.details.parameters.length > 0) {
                if (type.details.parameters[0].category === 0 /* ParameterCategory.Simple */) {
                    if (type.details.parameters.length > 0 && !type.details.parameters[0].isTypeInferred) {
                        // Stash away the effective type of the first parameter if it
                        // wasn't synthesized.
                        newFunction.strippedFirstParamType = getEffectiveParameterType(type, 0);
                    }
                    newFunction.details.parameters = type.details.parameters.slice(1);
                }
            }
            else {
                stripFirstParam = false;
            }
            // If we strip off the first parameter, this is no longer an
            // instance method or class method.
            newFunction.details.flags &= ~(1 /* FunctionTypeFlags.ConstructorMethod */ | 2 /* FunctionTypeFlags.ClassMethod */);
            newFunction.details.flags |= 4 /* FunctionTypeFlags.StaticMethod */;
        }
        if (type.typeAliasInfo !== undefined) {
            newFunction.typeAliasInfo = type.typeAliasInfo;
        }
        if (type.specializedTypes) {
            newFunction.specializedTypes = {
                parameterTypes: stripFirstParam
                    ? type.specializedTypes.parameterTypes.slice(1)
                    : type.specializedTypes.parameterTypes,
                parameterDefaultArgs: stripFirstParam
                    ? (_a = type.specializedTypes.parameterDefaultArgs) === null || _a === void 0 ? void 0 : _a.slice(1)
                    : type.specializedTypes.parameterDefaultArgs,
                returnType: type.specializedTypes.returnType,
            };
        }
        newFunction.inferredReturnType = type.inferredReturnType;
        return newFunction;
    }
    FunctionType.clone = clone;
    function cloneAsInstance(type) {
        var _a;
        if ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.typeBaseInstanceType) {
            return type.cached.typeBaseInstanceType;
        }
        const newInstance = TypeBase.cloneTypeAsInstance(type, /* cache */ true);
        delete newInstance.specialForm;
        return newInstance;
    }
    FunctionType.cloneAsInstance = cloneAsInstance;
    function cloneAsInstantiable(type) {
        var _a;
        if ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.typeBaseInstantiableType) {
            return type.cached.typeBaseInstantiableType;
        }
        const newInstance = TypeBase.cloneTypeAsInstantiable(type, /* cache */ true);
        return newInstance;
    }
    FunctionType.cloneAsInstantiable = cloneAsInstantiable;
    // Creates a shallow copy of the function type with new
    // specialized types. The clone shares the _functionDetails
    // with the object being cloned.
    function cloneForSpecialization(type, specializedTypes, specializedInferredReturnType) {
        const newFunction = TypeBase.cloneType(type);
        (0, debug_1.assert)(specializedTypes.parameterTypes.length === type.details.parameters.length);
        if (specializedTypes.parameterDefaultArgs) {
            (0, debug_1.assert)(specializedTypes.parameterDefaultArgs.length === type.details.parameters.length);
        }
        newFunction.specializedTypes = specializedTypes;
        newFunction.inferredReturnType = specializedInferredReturnType;
        return newFunction;
    }
    FunctionType.cloneForSpecialization = cloneForSpecialization;
    // Creates a new function based on the parameters of another function.
    function applyParamSpecValue(type, paramSpecValue) {
        const hasPositionalOnly = paramSpecValue.details.parameters.some((param) => isPositionOnlySeparator(param));
        const newFunction = FunctionType.cloneRemoveParamSpecArgsKwargs(TypeBase.cloneType(type), hasPositionalOnly);
        const paramSpec = FunctionType.getParamSpecFromArgsKwargs(type);
        (0, debug_1.assert)(paramSpec !== undefined);
        // Make a shallow clone of the details.
        newFunction.details = { ...newFunction.details };
        newFunction.details.typeParameters = newFunction.details.typeParameters.filter((t) => !isTypeSame(t, paramSpec));
        const prevParams = Array.from(newFunction.details.parameters);
        newFunction.details.parameters = [
            ...prevParams,
            ...paramSpecValue.details.parameters.map((param) => {
                return {
                    category: param.category,
                    name: param.name,
                    hasDefault: param.hasDefault,
                    defaultValueExpression: param.defaultValueExpression,
                    isNameSynthesized: param.isNameSynthesized,
                    hasDeclaredType: true,
                    type: param.type,
                };
            }),
        ];
        if (newFunction.details.docString === undefined) {
            newFunction.details.docString = paramSpecValue.details.docString;
        }
        if (newFunction.details.deprecatedMessage === undefined) {
            newFunction.details.deprecatedMessage = paramSpecValue.details.deprecatedMessage;
        }
        const origFlagsMask = 256 /* FunctionTypeFlags.Overloaded */ | 65536 /* FunctionTypeFlags.ParamSpecValue */;
        newFunction.details.flags = type.details.flags & origFlagsMask;
        const methodFlagsMask = 2 /* FunctionTypeFlags.ClassMethod */ | 4 /* FunctionTypeFlags.StaticMethod */ | 1 /* FunctionTypeFlags.ConstructorMethod */;
        // If the original function was a method, use its method type. Otherwise
        // use the method type of the param spec.
        if (type.details.methodClass) {
            newFunction.details.flags |= type.details.flags & methodFlagsMask;
        }
        else {
            newFunction.details.flags |= paramSpecValue.details.flags & methodFlagsMask;
        }
        // Use the "..." flag from the param spec.
        newFunction.details.flags |= paramSpecValue.details.flags & 32768 /* FunctionTypeFlags.GradualCallableForm */;
        // Mark the function as synthesized since there is no user-defined declaration for it.
        newFunction.details.flags |= 64 /* FunctionTypeFlags.SynthesizedMethod */;
        delete newFunction.details.declaration;
        // Update the specialized parameter types as well.
        const specializedTypes = newFunction.specializedTypes;
        if (specializedTypes) {
            paramSpecValue.details.parameters.forEach((paramInfo) => {
                var _a;
                specializedTypes.parameterTypes.push(paramInfo.type);
                // Assume that the parameters introduced via paramSpec have no specialized
                // default arg types. Fall back on the original default arg type in this case.
                (_a = specializedTypes.parameterDefaultArgs) === null || _a === void 0 ? void 0 : _a.push(undefined);
            });
        }
        FunctionType.addHigherOrderTypeVarScopeIds(newFunction, paramSpecValue.details.typeVarScopeId);
        FunctionType.addHigherOrderTypeVarScopeIds(newFunction, paramSpecValue.details.higherOrderTypeVarScopeIds);
        newFunction.details.constructorTypeVarScopeId = paramSpecValue.details.constructorTypeVarScopeId;
        if (!newFunction.details.methodClass && paramSpecValue.details.methodClass) {
            newFunction.details.methodClass = paramSpecValue.details.methodClass;
        }
        return newFunction;
    }
    FunctionType.applyParamSpecValue = applyParamSpecValue;
    function cloneWithNewFlags(type, flags) {
        const newFunction = TypeBase.cloneType(type);
        // Make a shallow clone of the details.
        newFunction.details = { ...type.details };
        newFunction.details.flags = flags;
        return newFunction;
    }
    FunctionType.cloneWithNewFlags = cloneWithNewFlags;
    function cloneWithNewTypeVarScopeId(type, newScopeId, newConstructorScopeId, typeParameters, trackedSignatures) {
        const newFunction = TypeBase.cloneType(type);
        // Make a shallow clone of the details.
        newFunction.details = { ...type.details };
        newFunction.details.typeVarScopeId = newScopeId;
        newFunction.details.constructorTypeVarScopeId = newConstructorScopeId;
        newFunction.details.typeParameters = typeParameters;
        newFunction.trackedSignatures = trackedSignatures;
        FunctionType.addHigherOrderTypeVarScopeIds(newFunction, typeParameters.map((t) => t.scopeId));
        return newFunction;
    }
    FunctionType.cloneWithNewTypeVarScopeId = cloneWithNewTypeVarScopeId;
    function cloneWithDocString(type, docString) {
        const newFunction = TypeBase.cloneType(type);
        // Make a shallow clone of the details.
        newFunction.details = { ...type.details };
        newFunction.details.docString = docString;
        return newFunction;
    }
    FunctionType.cloneWithDocString = cloneWithDocString;
    function cloneWithDeprecatedMessage(type, deprecatedMessage) {
        const newFunction = TypeBase.cloneType(type);
        // Make a shallow clone of the details.
        newFunction.details = { ...type.details };
        newFunction.details.deprecatedMessage = deprecatedMessage;
        return newFunction;
    }
    FunctionType.cloneWithDeprecatedMessage = cloneWithDeprecatedMessage;
    // If the function ends with "*args: P.args, **kwargs: P.kwargs", this function
    // returns a new function that is a clone of the input function with the
    // *args and **kwargs parameters removed. If stripPositionOnlySeparator is true,
    // a trailing positional-only separator will be removed.
    function cloneRemoveParamSpecArgsKwargs(type, stripPositionOnlySeparator = false) {
        const paramCount = type.details.parameters.length;
        if (paramCount < 2) {
            return type;
        }
        const argsParam = type.details.parameters[paramCount - 2];
        const kwargsParam = type.details.parameters[paramCount - 1];
        if (argsParam.category !== 1 /* ParameterCategory.ArgsList */ ||
            kwargsParam.category !== 2 /* ParameterCategory.KwargsDict */) {
            return type;
        }
        const argsType = FunctionType.getEffectiveParameterType(type, paramCount - 2);
        const kwargsType = FunctionType.getEffectiveParameterType(type, paramCount - 1);
        if (!isParamSpec(argsType) || !isParamSpec(kwargsType) || !isTypeSame(argsType, kwargsType)) {
            return type;
        }
        const newFunction = TypeBase.cloneType(type);
        // Make a shallow clone of the details.
        newFunction.details = { ...type.details };
        const details = newFunction.details;
        let paramsToDrop = 2;
        // If the last remaining parameter is a position-only separator, remove it as well.
        // Always remove it if it's the only remaining parameter.
        if (paramCount >= 3 && isPositionOnlySeparator(details.parameters[paramCount - 3])) {
            if (paramCount === 3 || stripPositionOnlySeparator) {
                paramsToDrop = 3;
            }
        }
        // Remove the last parameters, which are the *args and **kwargs.
        details.parameters = details.parameters.slice(0, details.parameters.length - paramsToDrop);
        if (type.specializedTypes) {
            newFunction.specializedTypes = { ...type.specializedTypes };
            newFunction.specializedTypes.parameterTypes = newFunction.specializedTypes.parameterTypes.slice(0, newFunction.specializedTypes.parameterTypes.length - paramsToDrop);
            if (newFunction.specializedTypes.parameterDefaultArgs) {
                newFunction.specializedTypes.parameterDefaultArgs =
                    newFunction.specializedTypes.parameterDefaultArgs.slice(0, newFunction.specializedTypes.parameterDefaultArgs.length - paramsToDrop);
            }
        }
        if (type.inferredReturnType) {
            newFunction.inferredReturnType = type.inferredReturnType;
        }
        return newFunction;
    }
    FunctionType.cloneRemoveParamSpecArgsKwargs = cloneRemoveParamSpecArgsKwargs;
    // If the function ends with "*args: P.args, **kwargs: P.kwargs", this function
    // returns P. Otherwise, it returns undefined.
    function getParamSpecFromArgsKwargs(type) {
        const params = type.details.parameters;
        if (params.length < 2) {
            return undefined;
        }
        const secondLastParam = params[params.length - 2];
        const lastParam = params[params.length - 1];
        if (secondLastParam.category === 1 /* ParameterCategory.ArgsList */ &&
            isTypeVar(secondLastParam.type) &&
            secondLastParam.type.paramSpecAccess === 'args' &&
            lastParam.category === 2 /* ParameterCategory.KwargsDict */ &&
            isTypeVar(lastParam.type) &&
            lastParam.type.paramSpecAccess === 'kwargs') {
            return TypeVarType.cloneForParamSpecAccess(secondLastParam.type, /* access */ undefined);
        }
        return undefined;
    }
    FunctionType.getParamSpecFromArgsKwargs = getParamSpecFromArgsKwargs;
    function addParamSpecVariadics(type, paramSpec) {
        FunctionType.addParameter(type, {
            category: 1 /* ParameterCategory.ArgsList */,
            name: 'args',
            type: TypeVarType.cloneForParamSpecAccess(paramSpec, 'args'),
            hasDeclaredType: true,
        });
        FunctionType.addParameter(type, {
            category: 2 /* ParameterCategory.KwargsDict */,
            name: 'kwargs',
            type: TypeVarType.cloneForParamSpecAccess(paramSpec, 'kwargs'),
            hasDeclaredType: true,
        });
    }
    FunctionType.addParamSpecVariadics = addParamSpecVariadics;
    function addDefaultParameters(type, useUnknown = false) {
        getDefaultParameters(useUnknown).forEach((param) => {
            FunctionType.addParameter(type, param);
        });
    }
    FunctionType.addDefaultParameters = addDefaultParameters;
    function addHigherOrderTypeVarScopeIds(functionType, scopeIds) {
        if (!scopeIds) {
            return;
        }
        if (!Array.isArray(scopeIds)) {
            scopeIds = [scopeIds];
        }
        if (!functionType.details.higherOrderTypeVarScopeIds) {
            functionType.details.higherOrderTypeVarScopeIds = [];
        }
        // Add the scope IDs to the function if they're unique.
        scopeIds.forEach((scopeId) => {
            if (!scopeId || scopeId === functionType.details.typeVarScopeId) {
                return;
            }
            if (!functionType.details.higherOrderTypeVarScopeIds.some((id) => id === scopeId)) {
                functionType.details.higherOrderTypeVarScopeIds.push(scopeId);
            }
        });
    }
    FunctionType.addHigherOrderTypeVarScopeIds = addHigherOrderTypeVarScopeIds;
    function getDefaultParameters(useUnknown = false) {
        return [
            {
                category: 1 /* ParameterCategory.ArgsList */,
                name: 'args',
                type: useUnknown ? UnknownType.create() : AnyType.create(),
                hasDeclaredType: !useUnknown,
            },
            {
                category: 2 /* ParameterCategory.KwargsDict */,
                name: 'kwargs',
                type: useUnknown ? UnknownType.create() : AnyType.create(),
                hasDeclaredType: !useUnknown,
            },
        ];
    }
    FunctionType.getDefaultParameters = getDefaultParameters;
    // Indicates whether the input signature consists of (*args: Any, **kwargs: Any).
    function hasDefaultParameters(functionType) {
        let sawArgs = false;
        let sawKwargs = false;
        for (let i = 0; i < functionType.details.parameters.length; i++) {
            const param = functionType.details.parameters[i];
            // Ignore nameless separator parameters.
            if (!param.name) {
                continue;
            }
            if (param.category === 0 /* ParameterCategory.Simple */) {
                return false;
            }
            else if (param.category === 1 /* ParameterCategory.ArgsList */) {
                sawArgs = true;
            }
            else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
                sawKwargs = true;
            }
            if (!isAnyOrUnknown(FunctionType.getEffectiveParameterType(functionType, i))) {
                return false;
            }
        }
        return sawArgs && sawKwargs;
    }
    FunctionType.hasDefaultParameters = hasDefaultParameters;
    function isInstanceMethod(type) {
        return ((type.details.flags &
            (1 /* FunctionTypeFlags.ConstructorMethod */ |
                4 /* FunctionTypeFlags.StaticMethod */ |
                2 /* FunctionTypeFlags.ClassMethod */)) ===
            0);
    }
    FunctionType.isInstanceMethod = isInstanceMethod;
    function isConstructorMethod(type) {
        return (type.details.flags & 1 /* FunctionTypeFlags.ConstructorMethod */) !== 0;
    }
    FunctionType.isConstructorMethod = isConstructorMethod;
    function isStaticMethod(type) {
        return (type.details.flags & 4 /* FunctionTypeFlags.StaticMethod */) !== 0;
    }
    FunctionType.isStaticMethod = isStaticMethod;
    function isClassMethod(type) {
        return (type.details.flags & 2 /* FunctionTypeFlags.ClassMethod */) !== 0;
    }
    FunctionType.isClassMethod = isClassMethod;
    function isAbstractMethod(type) {
        return (type.details.flags & 8 /* FunctionTypeFlags.AbstractMethod */) !== 0;
    }
    FunctionType.isAbstractMethod = isAbstractMethod;
    function isGenerator(type) {
        return (type.details.flags & 16 /* FunctionTypeFlags.Generator */) !== 0;
    }
    FunctionType.isGenerator = isGenerator;
    function isSynthesizedMethod(type) {
        return (type.details.flags & 64 /* FunctionTypeFlags.SynthesizedMethod */) !== 0;
    }
    FunctionType.isSynthesizedMethod = isSynthesizedMethod;
    function isTypeCheckOnly(type) {
        return (type.details.flags & 128 /* FunctionTypeFlags.TypeCheckOnly */) !== 0;
    }
    FunctionType.isTypeCheckOnly = isTypeCheckOnly;
    function isOverloaded(type) {
        return (type.details.flags & 256 /* FunctionTypeFlags.Overloaded */) !== 0;
    }
    FunctionType.isOverloaded = isOverloaded;
    function isDefaultParameterCheckDisabled(type) {
        return (type.details.flags & 32 /* FunctionTypeFlags.DisableDefaultChecks */) !== 0;
    }
    FunctionType.isDefaultParameterCheckDisabled = isDefaultParameterCheckDisabled;
    function isAsync(type) {
        return (type.details.flags & 512 /* FunctionTypeFlags.Async */) !== 0;
    }
    FunctionType.isAsync = isAsync;
    function isStubDefinition(type) {
        return (type.details.flags & 2048 /* FunctionTypeFlags.StubDefinition */) !== 0;
    }
    FunctionType.isStubDefinition = isStubDefinition;
    function isPyTypedDefinition(type) {
        return (type.details.flags & 4096 /* FunctionTypeFlags.PyTypedDefinition */) !== 0;
    }
    FunctionType.isPyTypedDefinition = isPyTypedDefinition;
    function isFinal(type) {
        return (type.details.flags & 8192 /* FunctionTypeFlags.Final */) !== 0;
    }
    FunctionType.isFinal = isFinal;
    function hasUnannotatedParams(type) {
        return (type.details.flags & 16384 /* FunctionTypeFlags.UnannotatedParams */) !== 0;
    }
    FunctionType.hasUnannotatedParams = hasUnannotatedParams;
    function isGradualCallableForm(type) {
        return (type.details.flags & 32768 /* FunctionTypeFlags.GradualCallableForm */) !== 0;
    }
    FunctionType.isGradualCallableForm = isGradualCallableForm;
    function isParamSpecValue(type) {
        return (type.details.flags & 65536 /* FunctionTypeFlags.ParamSpecValue */) !== 0;
    }
    FunctionType.isParamSpecValue = isParamSpecValue;
    function isPartiallyEvaluated(type) {
        return !!(type.details.flags & 131072 /* FunctionTypeFlags.PartiallyEvaluated */);
    }
    FunctionType.isPartiallyEvaluated = isPartiallyEvaluated;
    function isOverridden(type) {
        return !!(type.details.flags & 262144 /* FunctionTypeFlags.Overridden */);
    }
    FunctionType.isOverridden = isOverridden;
    function getEffectiveParameterType(type, index) {
        (0, debug_1.assert)(index < type.details.parameters.length, 'Parameter types array overflow');
        if (type.specializedTypes && index < type.specializedTypes.parameterTypes.length) {
            return type.specializedTypes.parameterTypes[index];
        }
        return type.details.parameters[index].type;
    }
    FunctionType.getEffectiveParameterType = getEffectiveParameterType;
    function getEffectiveParameterDefaultArgType(type, index) {
        var _a;
        (0, debug_1.assert)(index < type.details.parameters.length, 'Parameter types array overflow');
        if (((_a = type.specializedTypes) === null || _a === void 0 ? void 0 : _a.parameterDefaultArgs) && index < type.specializedTypes.parameterDefaultArgs.length) {
            const defaultArgType = type.specializedTypes.parameterDefaultArgs[index];
            if (defaultArgType) {
                return defaultArgType;
            }
        }
        return type.details.parameters[index].defaultType;
    }
    FunctionType.getEffectiveParameterDefaultArgType = getEffectiveParameterDefaultArgType;
    function addParameter(type, param) {
        type.details.parameters.push(param);
        if (type.specializedTypes) {
            type.specializedTypes.parameterTypes.push(param.type);
        }
    }
    FunctionType.addParameter = addParameter;
    function addPositionOnlyParameterSeparator(type) {
        addParameter(type, {
            category: 0 /* ParameterCategory.Simple */,
            type: AnyType.create(),
        });
    }
    FunctionType.addPositionOnlyParameterSeparator = addPositionOnlyParameterSeparator;
    function addKeywordOnlyParameterSeparator(type) {
        addParameter(type, {
            category: 1 /* ParameterCategory.ArgsList */,
            type: AnyType.create(),
        });
    }
    FunctionType.addKeywordOnlyParameterSeparator = addKeywordOnlyParameterSeparator;
    function getEffectiveReturnType(type, includeInferred = true) {
        var _a;
        if ((_a = type.specializedTypes) === null || _a === void 0 ? void 0 : _a.returnType) {
            return type.specializedTypes.returnType;
        }
        if (type.details.declaredReturnType) {
            return type.details.declaredReturnType;
        }
        if (includeInferred) {
            return type.inferredReturnType;
        }
        return undefined;
    }
    FunctionType.getEffectiveReturnType = getEffectiveReturnType;
})(FunctionType || (exports.FunctionType = FunctionType = {}));
var OverloadedFunctionType;
(function (OverloadedFunctionType) {
    function create(overloads) {
        const newType = {
            category: 5 /* TypeCategory.OverloadedFunction */,
            overloads: [],
            flags: 2 /* TypeFlags.Instance */,
        };
        overloads.forEach((overload) => {
            OverloadedFunctionType.addOverload(newType, overload);
        });
        return newType;
    }
    OverloadedFunctionType.create = create;
    // Adds a new overload or an implementation.
    function addOverload(type, functionType) {
        functionType.overloaded = type;
        type.overloads.push(functionType);
    }
    OverloadedFunctionType.addOverload = addOverload;
    function getOverloads(type) {
        return type.overloads.filter((func) => FunctionType.isOverloaded(func));
    }
    OverloadedFunctionType.getOverloads = getOverloads;
    function getImplementation(type) {
        return type.overloads.find((func) => !FunctionType.isOverloaded(func));
    }
    OverloadedFunctionType.getImplementation = getImplementation;
})(OverloadedFunctionType || (exports.OverloadedFunctionType = OverloadedFunctionType = {}));
var NeverType;
(function (NeverType) {
    const _neverInstance = {
        category: 3 /* TypeCategory.Never */,
        flags: 2 /* TypeFlags.Instance */ | 1 /* TypeFlags.Instantiable */,
        isNoReturn: false,
    };
    const _noReturnInstance = {
        category: 3 /* TypeCategory.Never */,
        flags: 2 /* TypeFlags.Instance */ | 1 /* TypeFlags.Instantiable */,
        isNoReturn: true,
    };
    function createNever() {
        return _neverInstance;
    }
    NeverType.createNever = createNever;
    function createNoReturn() {
        return _noReturnInstance;
    }
    NeverType.createNoReturn = createNoReturn;
    function convertToInstance(type) {
        // Remove the "special form" if present. Otherwise return the existing type.
        if (!type.specialForm) {
            return type;
        }
        return type.isNoReturn ? NeverType.createNoReturn() : NeverType.createNever();
    }
    NeverType.convertToInstance = convertToInstance;
})(NeverType || (exports.NeverType = NeverType = {}));
var AnyType;
(function (AnyType) {
    const _anyInstanceSpecialForm = {
        category: 2 /* TypeCategory.Any */,
        isEllipsis: false,
        flags: 2 /* TypeFlags.Instance */ | 1 /* TypeFlags.Instantiable */,
    };
    const _anyInstance = {
        category: 2 /* TypeCategory.Any */,
        isEllipsis: false,
        flags: 2 /* TypeFlags.Instance */ | 1 /* TypeFlags.Instantiable */,
    };
    const _ellipsisInstance = {
        category: 2 /* TypeCategory.Any */,
        isEllipsis: true,
        flags: 2 /* TypeFlags.Instance */ | 1 /* TypeFlags.Instantiable */,
    };
    function create(isEllipsis = false) {
        return isEllipsis ? _ellipsisInstance : _anyInstance;
    }
    AnyType.create = create;
    function createSpecialForm() {
        return _anyInstanceSpecialForm;
    }
    AnyType.createSpecialForm = createSpecialForm;
})(AnyType || (exports.AnyType = AnyType = {}));
(function (AnyType) {
    function convertToInstance(type) {
        // Remove the "special form" if present. Otherwise return the existing type.
        return type.specialForm ? AnyType.create() : type;
    }
    AnyType.convertToInstance = convertToInstance;
})(AnyType || (exports.AnyType = AnyType = {}));
var TypeCondition;
(function (TypeCondition) {
    function combine(conditions1, conditions2) {
        if (!conditions1) {
            return conditions2;
        }
        if (!conditions2) {
            return conditions1;
        }
        // Deduplicate the lists.
        const combined = Array.from(conditions1);
        conditions2.forEach((c1) => {
            if (!combined.some((c2) => _compare(c1, c2) === 0)) {
                combined.push(c1);
            }
        });
        // Always keep the conditions sorted for easier comparison.
        return combined.sort(_compare);
    }
    TypeCondition.combine = combine;
    function _compare(c1, c2) {
        if (c1.typeVar.details.name < c2.typeVar.details.name) {
            return -1;
        }
        else if (c1.typeVar.details.name > c2.typeVar.details.name) {
            return 1;
        }
        if (c1.constraintIndex < c2.constraintIndex) {
            return -1;
        }
        else if (c1.constraintIndex > c2.constraintIndex) {
            return 1;
        }
        return 0;
    }
    function isSame(conditions1, conditions2) {
        if (!conditions1) {
            return !conditions2;
        }
        if (!conditions2 || conditions1.length !== conditions2.length) {
            return false;
        }
        return (conditions1.find((c1, index) => c1.typeVar.nameWithScope !== conditions2[index].typeVar.nameWithScope ||
            c1.constraintIndex !== conditions2[index].constraintIndex) === undefined);
    }
    TypeCondition.isSame = isSame;
    // Determines if the two conditions can be used at the same time. If
    // one constraint list contains a constraint for a type variable, and the
    // same constraint is not in the other constraint list, the two are considered
    // incompatible.
    function isCompatible(conditions1, conditions2) {
        if (!conditions1 || !conditions2) {
            return true;
        }
        for (const c1 of conditions1) {
            let foundTypeVarMatch = false;
            const exactMatch = conditions2.find((c2) => {
                if (c1.typeVar.nameWithScope === c2.typeVar.nameWithScope) {
                    foundTypeVarMatch = true;
                    return c1.constraintIndex === c2.constraintIndex;
                }
                return false;
            });
            if (foundTypeVarMatch && !exactMatch) {
                return false;
            }
        }
        return true;
    }
    TypeCondition.isCompatible = isCompatible;
})(TypeCondition || (exports.TypeCondition = TypeCondition = {}));
var UnionType;
(function (UnionType) {
    function create() {
        const newUnionType = {
            category: 8 /* TypeCategory.Union */,
            subtypes: [],
            literalInstances: {},
            literalClasses: {},
            flags: 2 /* TypeFlags.Instance */ | 1 /* TypeFlags.Instantiable */,
        };
        return newUnionType;
    }
    UnionType.create = create;
    function addType(unionType, newType) {
        // If we're adding a string, integer or enum literal, add it to the
        // corresponding literal map to speed up some operations. It's not
        // uncommon for unions to contain hundreds of literals.
        if (isClass(newType) && newType.literalValue !== undefined && newType.condition === undefined) {
            const literalMaps = isClassInstance(newType) ? unionType.literalInstances : unionType.literalClasses;
            if (ClassType.isBuiltIn(newType, 'str')) {
                if (literalMaps.literalStrMap === undefined) {
                    literalMaps.literalStrMap = new Map();
                }
                literalMaps.literalStrMap.set(newType.literalValue, newType);
            }
            else if (ClassType.isBuiltIn(newType, 'int')) {
                if (literalMaps.literalIntMap === undefined) {
                    literalMaps.literalIntMap = new Map();
                }
                literalMaps.literalIntMap.set(newType.literalValue, newType);
            }
            else if (ClassType.isEnumClass(newType)) {
                if (literalMaps.literalEnumMap === undefined) {
                    literalMaps.literalEnumMap = new Map();
                }
                const enumLiteral = newType.literalValue;
                literalMaps.literalEnumMap.set(enumLiteral.getName(), newType);
            }
        }
        unionType.flags &= newType.flags;
        unionType.subtypes.push(newType);
        if (isTypeVar(newType) && newType.details.recursiveTypeAliasName) {
            // Note that at least one recursive type alias was included in
            // this union. We'll need to expand it before the union is used.
            unionType.includesRecursiveTypeAlias = true;
        }
    }
    UnionType.addType = addType;
    // Determines whether the union contains a specified subtype. If exclusionSet is passed,
    // the method skips any subtype indexes that are in the set and adds a found index to
    // the exclusion set. This speeds up union type comparisons.
    function containsType(unionType, subtype, exclusionSet, recursionCount = 0) {
        // Handle string literals as a special case because unions can sometimes
        // contain hundreds of string literal types.
        if (isClass(subtype) && subtype.condition === undefined && subtype.literalValue !== undefined) {
            const literalMaps = isClassInstance(subtype) ? unionType.literalInstances : unionType.literalClasses;
            if (ClassType.isBuiltIn(subtype, 'str') && literalMaps.literalStrMap !== undefined) {
                return literalMaps.literalStrMap.has(subtype.literalValue);
            }
            else if (ClassType.isBuiltIn(subtype, 'int') && literalMaps.literalIntMap !== undefined) {
                return literalMaps.literalIntMap.has(subtype.literalValue);
            }
            else if (ClassType.isEnumClass(subtype) && literalMaps.literalEnumMap !== undefined) {
                const enumLiteral = subtype.literalValue;
                return literalMaps.literalEnumMap.has(enumLiteral.getName());
            }
        }
        const foundIndex = unionType.subtypes.findIndex((t, i) => {
            if (exclusionSet === null || exclusionSet === void 0 ? void 0 : exclusionSet.has(i)) {
                return false;
            }
            return isTypeSame(t, subtype, {}, recursionCount);
        });
        if (foundIndex < 0) {
            return false;
        }
        exclusionSet === null || exclusionSet === void 0 ? void 0 : exclusionSet.add(foundIndex);
        return true;
    }
    UnionType.containsType = containsType;
    function addTypeAliasSource(unionType, typeAliasSource) {
        if (typeAliasSource.category === 8 /* TypeCategory.Union */) {
            const sourcesToAdd = typeAliasSource.typeAliasInfo ? [typeAliasSource] : typeAliasSource.typeAliasSources;
            if (sourcesToAdd) {
                if (!unionType.typeAliasSources) {
                    unionType.typeAliasSources = new Set();
                }
                sourcesToAdd.forEach((source) => {
                    unionType.typeAliasSources.add(source);
                });
            }
        }
    }
    UnionType.addTypeAliasSource = addTypeAliasSource;
})(UnionType || (exports.UnionType = UnionType = {}));
var TypeVarType;
(function (TypeVarType) {
    function createInstance(name) {
        return create(name, /* isParamSpec */ false, 2 /* TypeFlags.Instance */);
    }
    TypeVarType.createInstance = createInstance;
    function createInstantiable(name, isParamSpec = false) {
        return create(name, isParamSpec, 1 /* TypeFlags.Instantiable */);
    }
    TypeVarType.createInstantiable = createInstantiable;
    function cloneAsInstance(type) {
        var _a;
        (0, debug_1.assert)(TypeBase.isInstantiable(type));
        if ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.typeBaseInstanceType) {
            return type.cached.typeBaseInstanceType;
        }
        const newInstance = TypeBase.cloneTypeAsInstance(type, /* cache */ true);
        delete newInstance.specialForm;
        return newInstance;
    }
    TypeVarType.cloneAsInstance = cloneAsInstance;
    function cloneAsInstantiable(type) {
        var _a;
        if ((_a = type.cached) === null || _a === void 0 ? void 0 : _a.typeBaseInstantiableType) {
            return type.cached.typeBaseInstantiableType;
        }
        const newInstance = TypeBase.cloneTypeAsInstantiable(type, /* cache */ true);
        return newInstance;
    }
    TypeVarType.cloneAsInstantiable = cloneAsInstantiable;
    function cloneForNewName(type, name) {
        const newInstance = TypeBase.cloneType(type);
        newInstance.details = { ...type.details };
        newInstance.details.name = name;
        if (newInstance.scopeId) {
            newInstance.nameWithScope = makeNameWithScope(name, newInstance.scopeId);
        }
        return newInstance;
    }
    TypeVarType.cloneForNewName = cloneForNewName;
    function cloneForScopeId(type, scopeId, scopeName, scopeType) {
        const newInstance = TypeBase.cloneType(type);
        newInstance.nameWithScope = makeNameWithScope(type.details.name, scopeId);
        newInstance.scopeId = scopeId;
        newInstance.scopeName = scopeName;
        newInstance.scopeType = scopeType;
        return newInstance;
    }
    TypeVarType.cloneForScopeId = cloneForScopeId;
    function cloneForUnpacked(type, isInUnion = false) {
        (0, debug_1.assert)(type.details.isVariadic);
        const newInstance = TypeBase.cloneType(type);
        newInstance.isVariadicUnpacked = true;
        newInstance.isVariadicInUnion = isInUnion;
        return newInstance;
    }
    TypeVarType.cloneForUnpacked = cloneForUnpacked;
    function cloneForPacked(type) {
        (0, debug_1.assert)(type.details.isVariadic);
        const newInstance = TypeBase.cloneType(type);
        newInstance.isVariadicUnpacked = false;
        newInstance.isVariadicInUnion = false;
        return newInstance;
    }
    TypeVarType.cloneForPacked = cloneForPacked;
    // Creates a "simplified" version of the TypeVar with invariance
    // and no bound or constraints. ParamSpecs and variadics are left
    // unmodified. So are auto-variant type variables.
    function cloneAsInvariant(type) {
        if (type.details.isParamSpec || type.details.isVariadic) {
            return type;
        }
        if (type.details.declaredVariance === 0 /* Variance.Auto */) {
            return type;
        }
        if (type.details.declaredVariance === 2 /* Variance.Invariant */) {
            if (type.details.boundType === undefined && type.details.constraints.length === 0) {
                return type;
            }
        }
        const newInstance = TypeBase.cloneType(type);
        newInstance.details = { ...newInstance.details };
        newInstance.details.declaredVariance = 2 /* Variance.Invariant */;
        newInstance.details.boundType = undefined;
        newInstance.details.constraints = [];
        return newInstance;
    }
    TypeVarType.cloneAsInvariant = cloneAsInvariant;
    function cloneForParamSpecAccess(type, access) {
        const newInstance = TypeBase.cloneType(type);
        newInstance.paramSpecAccess = access;
        return newInstance;
    }
    TypeVarType.cloneForParamSpecAccess = cloneForParamSpecAccess;
    function cloneAsSpecializedSelf(type, specializedBoundType) {
        (0, debug_1.assert)(type.details.isSynthesizedSelf);
        const newInstance = TypeBase.cloneType(type);
        newInstance.details = { ...newInstance.details };
        newInstance.details.boundType = specializedBoundType;
        return newInstance;
    }
    TypeVarType.cloneAsSpecializedSelf = cloneAsSpecializedSelf;
    function cloneAsInScopePlaceholder(type, usageOffset) {
        if (type.isInScopePlaceholder) {
            return type;
        }
        // If the caller specified a usage offset, append it to the TypeVar
        // internal name. This allows us to distinguish it from other uses
        // of the same TypeVar. For example nested calls to a generic
        // function like `foo(foo(1))`.
        let newNameWithScope = type.nameWithScope;
        if (usageOffset) {
            newNameWithScope = `${type.nameWithScope}-${usageOffset}`;
        }
        const newInstance = TypeBase.cloneType(type);
        newInstance.isInScopePlaceholder = true;
        newInstance.scopeId = exports.InScopePlaceholderScopeId;
        newInstance.nameWithScope = newNameWithScope;
        return newInstance;
    }
    TypeVarType.cloneAsInScopePlaceholder = cloneAsInScopePlaceholder;
    function makeNameWithScope(name, scopeId) {
        return `${name}.${scopeId}`;
    }
    TypeVarType.makeNameWithScope = makeNameWithScope;
    function create(name, isParamSpec, typeFlags) {
        const newTypeVarType = {
            category: 9 /* TypeCategory.TypeVar */,
            details: {
                name,
                constraints: [],
                declaredVariance: 2 /* Variance.Invariant */,
                isParamSpec,
                isVariadic: false,
                isSynthesized: false,
                defaultType: UnknownType.create(),
            },
            flags: typeFlags,
        };
        return newTypeVarType;
    }
    function addConstraint(typeVarType, constraintType) {
        typeVarType.details.constraints.push(constraintType);
    }
    TypeVarType.addConstraint = addConstraint;
    function getNameWithScope(typeVarType) {
        // If there is no name with scope, fall back on the (unscoped) name.
        return typeVarType.nameWithScope || typeVarType.details.name;
    }
    TypeVarType.getNameWithScope = getNameWithScope;
    function getReadableName(typeVarType) {
        if (typeVarType.scopeName) {
            return `${typeVarType.details.name}@${typeVarType.scopeName}`;
        }
        return typeVarType.details.name;
    }
    TypeVarType.getReadableName = getReadableName;
    function getVariance(type) {
        var _a;
        const variance = (_a = type.computedVariance) !== null && _a !== void 0 ? _a : type.details.declaredVariance;
        // By this point, the variance should have been inferred.
        (0, debug_1.assert)(variance !== 0 /* Variance.Auto */, 'Expected variance to be inferred');
        // If we're in the process of computing variance, it will still be
        // unknown. Default to covariant in this case.
        if (variance === 1 /* Variance.Unknown */) {
            return 3 /* Variance.Covariant */;
        }
        return variance;
    }
    TypeVarType.getVariance = getVariance;
    // Indicates whether the specified type is a recursive type alias
    // placeholder that has not yet been resolved.
    function isTypeAliasPlaceholder(type) {
        return !!type.details.recursiveTypeAliasName && !type.details.boundType;
    }
    TypeVarType.isTypeAliasPlaceholder = isTypeAliasPlaceholder;
})(TypeVarType || (exports.TypeVarType = TypeVarType = {}));
function isNever(type) {
    return type.category === 3 /* TypeCategory.Never */;
}
exports.isNever = isNever;
function isAny(type) {
    return type.category === 2 /* TypeCategory.Any */;
}
exports.isAny = isAny;
function isUnknown(type) {
    return type.category === 1 /* TypeCategory.Unknown */;
}
exports.isUnknown = isUnknown;
function isAnyOrUnknown(type) {
    if (type.category === 2 /* TypeCategory.Any */ || type.category === 1 /* TypeCategory.Unknown */) {
        return true;
    }
    if (isUnion(type)) {
        return type.subtypes.find((subtype) => !isAnyOrUnknown(subtype)) === undefined;
    }
    return false;
}
exports.isAnyOrUnknown = isAnyOrUnknown;
function isUnbound(type) {
    return type.category === 0 /* TypeCategory.Unbound */;
}
exports.isUnbound = isUnbound;
function isUnion(type) {
    return type.category === 8 /* TypeCategory.Union */;
}
exports.isUnion = isUnion;
function isPossiblyUnbound(type) {
    if (isUnbound(type)) {
        return true;
    }
    if (isUnion(type)) {
        return type.subtypes.find((subtype) => isPossiblyUnbound(subtype)) !== undefined;
    }
    return false;
}
exports.isPossiblyUnbound = isPossiblyUnbound;
function isClass(type) {
    return type.category === 6 /* TypeCategory.Class */;
}
exports.isClass = isClass;
function isInstantiableClass(type) {
    return type.category === 6 /* TypeCategory.Class */ && TypeBase.isInstantiable(type);
}
exports.isInstantiableClass = isInstantiableClass;
function isClassInstance(type) {
    return type.category === 6 /* TypeCategory.Class */ && TypeBase.isInstance(type);
}
exports.isClassInstance = isClassInstance;
function isModule(type) {
    return type.category === 7 /* TypeCategory.Module */;
}
exports.isModule = isModule;
function isTypeVar(type) {
    return type.category === 9 /* TypeCategory.TypeVar */;
}
exports.isTypeVar = isTypeVar;
function isVariadicTypeVar(type) {
    return type.category === 9 /* TypeCategory.TypeVar */ && type.details.isVariadic;
}
exports.isVariadicTypeVar = isVariadicTypeVar;
function isUnpackedVariadicTypeVar(type) {
    return (type.category === 9 /* TypeCategory.TypeVar */ &&
        type.details.isVariadic &&
        !!type.isVariadicUnpacked &&
        !type.isVariadicInUnion);
}
exports.isUnpackedVariadicTypeVar = isUnpackedVariadicTypeVar;
function isUnpackedClass(type) {
    if (!isClass(type) || !type.isUnpacked) {
        return false;
    }
    return true;
}
exports.isUnpackedClass = isUnpackedClass;
function isUnpacked(type) {
    return isUnpackedVariadicTypeVar(type) || isUnpackedClass(type);
}
exports.isUnpacked = isUnpacked;
function isParamSpec(type) {
    return type.category === 9 /* TypeCategory.TypeVar */ && type.details.isParamSpec;
}
exports.isParamSpec = isParamSpec;
function isFunction(type) {
    return type.category === 4 /* TypeCategory.Function */;
}
exports.isFunction = isFunction;
function isOverloadedFunction(type) {
    return type.category === 5 /* TypeCategory.OverloadedFunction */;
}
exports.isOverloadedFunction = isOverloadedFunction;
function getTypeAliasInfo(type) {
    if (type.typeAliasInfo) {
        return type.typeAliasInfo;
    }
    if (isTypeVar(type) &&
        type.details.recursiveTypeAliasName &&
        type.details.boundType &&
        type.details.boundType.typeAliasInfo) {
        return type.details.boundType.typeAliasInfo;
    }
    return undefined;
}
exports.getTypeAliasInfo = getTypeAliasInfo;
// Determines whether two types are the same. If ignorePseudoGeneric is true,
// type arguments for "pseudo-generic" classes (non-generic classes whose init
// methods are not annotated and are therefore treated as generic) are ignored.
function isTypeSame(type1, type2, options = {}, recursionCount = 0) {
    var _a, _b;
    if (type1 === type2) {
        return true;
    }
    if (type1.category !== type2.category) {
        if (options.treatAnySameAsUnknown) {
            if (type1.category === 2 /* TypeCategory.Any */ && type2.category === 1 /* TypeCategory.Unknown */) {
                return true;
            }
            if (type1.category === 1 /* TypeCategory.Unknown */ && type2.category === 2 /* TypeCategory.Any */) {
                return true;
            }
        }
        return false;
    }
    if (!options.ignoreTypeFlags) {
        if (type1.flags !== type2.flags) {
            return false;
        }
    }
    if (recursionCount > exports.maxTypeRecursionCount) {
        return true;
    }
    recursionCount++;
    switch (type1.category) {
        case 6 /* TypeCategory.Class */: {
            const classType2 = type2;
            // If the details are not the same it's not the same class.
            if (!ClassType.isSameGenericClass(type1, classType2, recursionCount)) {
                return false;
            }
            if (!options.ignoreConditions && !TypeCondition.isSame(type1.condition, type2.condition)) {
                return false;
            }
            if (!options.ignorePseudoGeneric || !ClassType.isPseudoGenericClass(type1)) {
                // Make sure the type args match.
                if (type1.tupleTypeArguments && classType2.tupleTypeArguments) {
                    const type1TupleTypeArgs = type1.tupleTypeArguments || [];
                    const type2TupleTypeArgs = classType2.tupleTypeArguments || [];
                    if (type1TupleTypeArgs.length !== type2TupleTypeArgs.length) {
                        return false;
                    }
                    for (let i = 0; i < type1TupleTypeArgs.length; i++) {
                        if (!isTypeSame(type1TupleTypeArgs[i].type, type2TupleTypeArgs[i].type, { ...options, ignoreTypeFlags: false }, recursionCount)) {
                            return false;
                        }
                        if (type1TupleTypeArgs[i].isUnbounded !== type2TupleTypeArgs[i].isUnbounded) {
                            return false;
                        }
                    }
                }
                else {
                    const type1TypeArgs = type1.typeArguments || [];
                    const type2TypeArgs = classType2.typeArguments || [];
                    const typeArgCount = Math.max(type1TypeArgs.length, type2TypeArgs.length);
                    for (let i = 0; i < typeArgCount; i++) {
                        // Assume that missing type args are "Unknown".
                        const typeArg1 = i < type1TypeArgs.length ? type1TypeArgs[i] : UnknownType.create();
                        const typeArg2 = i < type2TypeArgs.length ? type2TypeArgs[i] : UnknownType.create();
                        if (!isTypeSame(typeArg1, typeArg2, { ...options, ignoreTypeFlags: false }, recursionCount)) {
                            return false;
                        }
                    }
                }
            }
            if (!ClassType.isLiteralValueSame(type1, classType2)) {
                return false;
            }
            if (!type1.isTypedDictPartial !== !classType2.isTypedDictPartial) {
                return false;
            }
            if (!options.ignoreTypedDictNarrowEntries && !ClassType.isTypedDictNarrowedEntriesSame(type1, classType2)) {
                return false;
            }
            return true;
        }
        case 4 /* TypeCategory.Function */: {
            // Make sure the parameter counts match.
            const functionType2 = type2;
            const params1 = type1.details.parameters;
            const params2 = functionType2.details.parameters;
            if (params1.length !== params2.length) {
                return false;
            }
            // If one function is ... and the other is not, they are not the same.
            if (FunctionType.isGradualCallableForm(type1) !== FunctionType.isGradualCallableForm(functionType2)) {
                return false;
            }
            const positionOnlyIndex1 = params1.findIndex((param) => isPositionOnlySeparator(param));
            const positionOnlyIndex2 = params2.findIndex((param) => isPositionOnlySeparator(param));
            // Make sure the parameter details match.
            for (let i = 0; i < params1.length; i++) {
                const param1 = params1[i];
                const param2 = params2[i];
                if (param1.category !== param2.category) {
                    return false;
                }
                const isName1Relevant = positionOnlyIndex1 !== undefined && i > positionOnlyIndex1;
                const isName2Relevant = positionOnlyIndex2 !== undefined && i > positionOnlyIndex2;
                if (isName1Relevant !== isName2Relevant) {
                    return false;
                }
                if (isName1Relevant) {
                    if (param1.name !== param2.name) {
                        return false;
                    }
                }
                else if (isPositionOnlySeparator(param1) && isPositionOnlySeparator(param2)) {
                    continue;
                }
                else if (isKeywordOnlySeparator(param1) && isKeywordOnlySeparator(param2)) {
                    continue;
                }
                const param1Type = FunctionType.getEffectiveParameterType(type1, i);
                const param2Type = FunctionType.getEffectiveParameterType(functionType2, i);
                if (!isTypeSame(param1Type, param2Type, { ...options, ignoreTypeFlags: false }, recursionCount)) {
                    return false;
                }
            }
            // Make sure the return types match.
            let return1Type = type1.details.declaredReturnType;
            if (type1.specializedTypes && type1.specializedTypes.returnType) {
                return1Type = type1.specializedTypes.returnType;
            }
            if (!return1Type && type1.inferredReturnType) {
                return1Type = type1.inferredReturnType;
            }
            let return2Type = functionType2.details.declaredReturnType;
            if (functionType2.specializedTypes && functionType2.specializedTypes.returnType) {
                return2Type = functionType2.specializedTypes.returnType;
            }
            if (!return2Type && functionType2.inferredReturnType) {
                return2Type = functionType2.inferredReturnType;
            }
            if (return1Type || return2Type) {
                if (!return1Type ||
                    !return2Type ||
                    !isTypeSame(return1Type, return2Type, { ...options, ignoreTypeFlags: false }, recursionCount)) {
                    return false;
                }
            }
            return true;
        }
        case 5 /* TypeCategory.OverloadedFunction */: {
            // Make sure the overload counts match.
            const functionType2 = type2;
            if (type1.overloads.length !== functionType2.overloads.length) {
                return false;
            }
            // We assume here that overloaded functions always appear
            // in the same order from one analysis pass to another.
            for (let i = 0; i < type1.overloads.length; i++) {
                if (!isTypeSame(type1.overloads[i], functionType2.overloads[i], options, recursionCount)) {
                    return false;
                }
            }
            return true;
        }
        case 8 /* TypeCategory.Union */: {
            const unionType2 = type2;
            const subtypes1 = type1.subtypes;
            const subtypes2 = unionType2.subtypes;
            if (subtypes1.length !== subtypes2.length) {
                return false;
            }
            // The types do not have a particular order, so we need to
            // do the comparison in an order-independent manner.
            const exclusionSet = new Set();
            return (findSubtype(type1, (subtype) => !UnionType.containsType(unionType2, subtype, exclusionSet, recursionCount)) === undefined);
        }
        case 9 /* TypeCategory.TypeVar */: {
            const type2TypeVar = type2;
            if (type1.scopeId !== type2TypeVar.scopeId) {
                return false;
            }
            // Handle the case where this is a generic recursive type alias. Make
            // sure that the type argument types match.
            if (type1.details.recursiveTypeParameters && type2TypeVar.details.recursiveTypeParameters) {
                const type1TypeArgs = ((_a = type1 === null || type1 === void 0 ? void 0 : type1.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.typeArguments) || [];
                const type2TypeArgs = ((_b = type2 === null || type2 === void 0 ? void 0 : type2.typeAliasInfo) === null || _b === void 0 ? void 0 : _b.typeArguments) || [];
                const typeArgCount = Math.max(type1TypeArgs.length, type2TypeArgs.length);
                for (let i = 0; i < typeArgCount; i++) {
                    // Assume that missing type args are "Any".
                    const typeArg1 = i < type1TypeArgs.length ? type1TypeArgs[i] : AnyType.create();
                    const typeArg2 = i < type2TypeArgs.length ? type2TypeArgs[i] : AnyType.create();
                    if (!isTypeSame(typeArg1, typeArg2, { ...options, ignoreTypeFlags: false }, recursionCount)) {
                        return false;
                    }
                }
            }
            if (!type1.isVariadicInUnion !== !type2TypeVar.isVariadicInUnion) {
                return false;
            }
            if (type1.details === type2TypeVar.details) {
                return true;
            }
            if (type1.details.name !== type2TypeVar.details.name ||
                type1.details.isParamSpec !== type2TypeVar.details.isParamSpec ||
                type1.details.isVariadic !== type2TypeVar.details.isVariadic ||
                type1.details.isSynthesized !== type2TypeVar.details.isSynthesized ||
                type1.details.declaredVariance !== type2TypeVar.details.declaredVariance ||
                type1.scopeId !== type2TypeVar.scopeId) {
                return false;
            }
            const boundType1 = type1.details.boundType;
            const boundType2 = type2TypeVar.details.boundType;
            if (boundType1) {
                if (!boundType2 ||
                    !isTypeSame(boundType1, boundType2, { ...options, ignoreTypeFlags: false }, recursionCount)) {
                    return false;
                }
            }
            else {
                if (boundType2) {
                    return false;
                }
            }
            const constraints1 = type1.details.constraints;
            const constraints2 = type2TypeVar.details.constraints;
            if (constraints1.length !== constraints2.length) {
                return false;
            }
            for (let i = 0; i < constraints1.length; i++) {
                if (!isTypeSame(constraints1[i], constraints2[i], { ...options, ignoreTypeFlags: false }, recursionCount)) {
                    return false;
                }
            }
            return true;
        }
        case 7 /* TypeCategory.Module */: {
            const type2Module = type2;
            // Module types are the same if they share the same
            // module symbol table.
            if (type1.fields === type2Module.fields) {
                return true;
            }
            // If both symbol tables are empty, we can also assume
            // they're equal.
            if (type1.fields.size === 0 && type2Module.fields.size === 0) {
                return true;
            }
            return false;
        }
        case 1 /* TypeCategory.Unknown */: {
            const type2Unknown = type2;
            return type1.isIncomplete === type2Unknown.isIncomplete;
        }
    }
    return true;
}
exports.isTypeSame = isTypeSame;
// If the type is a union, remove an "unknown" type from the union,
// returning only the known types.
function removeUnknownFromUnion(type) {
    return removeFromUnion(type, (t) => isUnknown(t));
}
exports.removeUnknownFromUnion = removeUnknownFromUnion;
// If the type is a union, remove an "unbound" type from the union,
// returning only the known types.
function removeUnbound(type) {
    if (isUnion(type)) {
        return removeFromUnion(type, (t) => isUnbound(t));
    }
    if (isUnbound(type)) {
        return UnknownType.create();
    }
    return type;
}
exports.removeUnbound = removeUnbound;
function removeFromUnion(type, removeFilter) {
    if (isUnion(type)) {
        const remainingTypes = type.subtypes.filter((t) => !removeFilter(t));
        if (remainingTypes.length < type.subtypes.length) {
            const newType = combineTypes(remainingTypes);
            if (isUnion(newType)) {
                UnionType.addTypeAliasSource(newType, type);
            }
            return newType;
        }
    }
    return type;
}
exports.removeFromUnion = removeFromUnion;
function findSubtype(type, filter) {
    if (isUnion(type)) {
        return type.subtypes.find((subtype) => {
            return filter(subtype);
        });
    }
    return filter(type) ? type : undefined;
}
exports.findSubtype = findSubtype;
// Combines multiple types into a single type. If the types are
// the same, only one is returned. If they differ, they
// are combined into a UnionType. NeverTypes are filtered out.
// If no types remain in the end, a NeverType is returned.
function combineTypes(subtypes, maxSubtypeCount) {
    // Filter out any "Never" and "NoReturn" types.
    let sawNoReturn = false;
    if (subtypes.some((subtype) => subtype.category === 3 /* TypeCategory.Never */))
        subtypes = subtypes.filter((subtype) => {
            if (subtype.category === 3 /* TypeCategory.Never */ && subtype.isNoReturn) {
                sawNoReturn = true;
            }
            return subtype.category !== 3 /* TypeCategory.Never */;
        });
    if (subtypes.length === 0) {
        return sawNoReturn ? NeverType.createNoReturn() : NeverType.createNever();
    }
    // Handle the common case where there is only one type.
    // Also handle the common case where there are multiple copies of the same type.
    let allSubtypesAreSame = true;
    if (subtypes.length > 1) {
        for (let index = 1; index < subtypes.length; index++) {
            if (subtypes[index] !== subtypes[0]) {
                allSubtypesAreSame = false;
                break;
            }
        }
    }
    if (allSubtypesAreSame) {
        return subtypes[0];
    }
    // Expand all union types.
    let expandedTypes;
    const typeAliasSources = new Set();
    for (let i = 0; i < subtypes.length; i++) {
        const subtype = subtypes[i];
        if (isUnion(subtype)) {
            if (!expandedTypes) {
                expandedTypes = subtypes.slice(0, i);
            }
            expandedTypes = expandedTypes.concat(subtype.subtypes);
            if (subtype.typeAliasInfo) {
                typeAliasSources.add(subtype);
            }
            else if (subtype.typeAliasSources) {
                subtype.typeAliasSources.forEach((subtype) => {
                    typeAliasSources.add(subtype);
                });
            }
        }
        else if (expandedTypes) {
            expandedTypes.push(subtype);
        }
    }
    expandedTypes = expandedTypes !== null && expandedTypes !== void 0 ? expandedTypes : subtypes;
    // Sort all of the literal and empty types to the end.
    expandedTypes = expandedTypes.sort((type1, type2) => {
        if (isClass(type1) && type1.literalValue !== undefined) {
            return 1;
        }
        if (isClass(type2) && type2.literalValue !== undefined) {
            return -1;
        }
        if (isClassInstance(type1) && type1.isEmptyContainer) {
            return 1;
        }
        else if (isClassInstance(type2) && type2.isEmptyContainer) {
            return -1;
        }
        return 0;
    });
    // If removing all NoReturn types results in no remaining types,
    // convert it to an unknown.
    if (expandedTypes.length === 0) {
        return UnknownType.create();
    }
    const newUnionType = UnionType.create();
    if (typeAliasSources.size > 0) {
        newUnionType.typeAliasSources = typeAliasSources;
    }
    let hitMaxSubtypeCount = false;
    expandedTypes.forEach((subtype, index) => {
        if (index === 0) {
            UnionType.addType(newUnionType, subtype);
        }
        else {
            if (maxSubtypeCount === undefined || newUnionType.subtypes.length < maxSubtypeCount) {
                _addTypeIfUnique(newUnionType, subtype);
            }
            else {
                hitMaxSubtypeCount = true;
            }
        }
    });
    if (hitMaxSubtypeCount) {
        return AnyType.create();
    }
    // If only one type remains, convert it from a union to a simple type.
    if (newUnionType.subtypes.length === 1) {
        return newUnionType.subtypes[0];
    }
    return newUnionType;
}
exports.combineTypes = combineTypes;
// Determines whether the dest type is the same as the source type with
// the possible exception that the source type has a literal value when
// the dest does not.
function isSameWithoutLiteralValue(destType, srcType) {
    // If it's the same with literals, great.
    if (isTypeSame(destType, srcType)) {
        return true;
    }
    if (isInstantiableClass(srcType) && srcType.literalValue !== undefined) {
        // Strip the literal.
        srcType = ClassType.cloneWithLiteral(srcType, /* value */ undefined);
        return isTypeSame(destType, srcType);
    }
    if (isClassInstance(srcType) && srcType.literalValue !== undefined) {
        // Strip the literal.
        srcType = ClassType.cloneWithLiteral(srcType, /* value */ undefined);
        return isTypeSame(destType, srcType, { ignoreConditions: true });
    }
    return false;
}
exports.isSameWithoutLiteralValue = isSameWithoutLiteralValue;
function _addTypeIfUnique(unionType, typeToAdd) {
    // Handle the addition of a string literal in a special manner to
    // avoid n^2 behavior in unions that contain hundreds of string
    // literal types. Skip this for constrained types.
    if (isClass(typeToAdd) && typeToAdd.condition === undefined) {
        const literalMaps = isClassInstance(typeToAdd) ? unionType.literalInstances : unionType.literalClasses;
        if (ClassType.isBuiltIn(typeToAdd, 'str') &&
            typeToAdd.literalValue !== undefined &&
            literalMaps.literalStrMap !== undefined) {
            if (!literalMaps.literalStrMap.has(typeToAdd.literalValue)) {
                UnionType.addType(unionType, typeToAdd);
            }
            return;
        }
        else if (ClassType.isBuiltIn(typeToAdd, 'int') &&
            typeToAdd.literalValue !== undefined &&
            literalMaps.literalIntMap !== undefined) {
            if (!literalMaps.literalIntMap.has(typeToAdd.literalValue)) {
                UnionType.addType(unionType, typeToAdd);
            }
            return;
        }
        else if (ClassType.isEnumClass(typeToAdd) &&
            typeToAdd.literalValue !== undefined &&
            literalMaps.literalEnumMap !== undefined) {
            const enumLiteral = typeToAdd.literalValue;
            if (!literalMaps.literalEnumMap.has(enumLiteral.getName())) {
                UnionType.addType(unionType, typeToAdd);
            }
            return;
        }
    }
    const isPseudoGeneric = isClass(typeToAdd) && ClassType.isPseudoGenericClass(typeToAdd);
    for (let i = 0; i < unionType.subtypes.length; i++) {
        const type = unionType.subtypes[i];
        // Does this type already exist in the types array?
        if (isTypeSame(type, typeToAdd)) {
            return;
        }
        // Handle the case where pseudo-generic classes with different
        // type arguments are being combined. Rather than add multiple
        // specialized types, we will replace them with a single specialized
        // type that is specialized with Unknowns. This is important because
        // we can hit recursive cases (where a pseudo-generic class is
        // parameterized with its own class) ad infinitum.
        if (isPseudoGeneric) {
            if (isTypeSame(type, typeToAdd, { ignorePseudoGeneric: true })) {
                unionType.subtypes[i] = ClassType.cloneForSpecialization(typeToAdd, typeToAdd.details.typeParameters.map(() => UnknownType.create()), 
                /* isTypeArgumentExplicit */ true);
                return;
            }
        }
        // If the typeToAdd is a literal value and there's already
        // a non-literal type that matches, don't add the literal value.
        if (isClassInstance(type) && isClassInstance(typeToAdd)) {
            if (isSameWithoutLiteralValue(type, typeToAdd)) {
                if (type.literalValue === undefined) {
                    return;
                }
            }
            // If we're adding Literal[False] or Literal[True] to its
            // opposite, combine them into a non-literal 'bool' type.
            if (ClassType.isBuiltIn(type, 'bool') &&
                !type.condition &&
                ClassType.isBuiltIn(typeToAdd, 'bool') &&
                !typeToAdd.condition) {
                if (typeToAdd.literalValue !== undefined && !typeToAdd.literalValue === type.literalValue) {
                    unionType.subtypes[i] = ClassType.cloneWithLiteral(type, /* value */ undefined);
                    return;
                }
            }
            // If the typeToAdd is a TypedDict that is the same class as the
            // existing type, see if one of them is a proper subset of the other.
            if (ClassType.isTypedDictClass(type) && ClassType.isSameGenericClass(type, typeToAdd)) {
                // Do not proceed if the TypedDicts are generic and have different type arguments.
                if (!type.typeArguments && !typeToAdd.typeArguments) {
                    if (ClassType.isTypedDictNarrower(typeToAdd, type)) {
                        return;
                    }
                    else if (ClassType.isTypedDictNarrower(type, typeToAdd)) {
                        unionType.subtypes[i] = typeToAdd;
                        return;
                    }
                }
            }
        }
        // If the typeToAdd is an empty container and there's already
        // non-empty container of the same type, don't add the empty container.
        if (isClassInstance(typeToAdd) && typeToAdd.isEmptyContainer) {
            if (isClassInstance(type) && ClassType.isSameGenericClass(type, typeToAdd)) {
                return;
            }
        }
    }
    UnionType.addType(unionType, typeToAdd);
}
//# sourceMappingURL=types.js.map