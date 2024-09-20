"use strict";
/*
 * patternMatching.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Type evaluation logic for evaluating and narrowing types
 * related to "match" and "case" statements as documented in
 * PEP 634.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPatternSubtypeNarrowingCallback = exports.validateClassPattern = exports.assignTypeToPatternTargets = exports.checkForUnusedPattern = exports.narrowTypeBasedOnPattern = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const localize_1 = require("../localization/localize");
const constraintSolver_1 = require("./constraintSolver");
const parseTreeUtils_1 = require("./parseTreeUtils");
const typeGuards_1 = require("./typeGuards");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
const typedDicts_1 = require("./typedDicts");
const types_1 = require("./types");
// PEP 634 indicates that several built-in classes are handled differently
// when used with class pattern matching.
const classPatternSpecialCases = [
    'builtins.bool',
    'builtins.bytearray',
    'builtins.bytes',
    'builtins.dict',
    'builtins.float',
    'builtins.frozenset',
    'builtins.int',
    'builtins.list',
    'builtins.set',
    'builtins.str',
    'builtins.tuple',
];
function narrowTypeBasedOnPattern(evaluator, type, pattern, isPositiveTest) {
    switch (pattern.nodeType) {
        case 65 /* ParseNodeType.PatternSequence */: {
            return narrowTypeBasedOnSequencePattern(evaluator, type, pattern, isPositiveTest);
        }
        case 67 /* ParseNodeType.PatternLiteral */: {
            return narrowTypeBasedOnLiteralPattern(evaluator, type, pattern, isPositiveTest);
        }
        case 68 /* ParseNodeType.PatternClass */: {
            return narrowTypeBasedOnClassPattern(evaluator, type, pattern, isPositiveTest);
        }
        case 66 /* ParseNodeType.PatternAs */: {
            return narrowTypeBasedOnAsPattern(evaluator, type, pattern, isPositiveTest);
        }
        case 70 /* ParseNodeType.PatternMapping */: {
            return narrowTypeBasedOnMappingPattern(evaluator, type, pattern, isPositiveTest);
        }
        case 73 /* ParseNodeType.PatternValue */: {
            return narrowTypeBasedOnValuePattern(evaluator, type, pattern, isPositiveTest);
        }
        case 69 /* ParseNodeType.PatternCapture */: {
            // A capture captures everything, so nothing remains in the negative case.
            return isPositiveTest ? type : types_1.NeverType.createNever();
        }
        case 0 /* ParseNodeType.Error */: {
            return type;
        }
    }
}
exports.narrowTypeBasedOnPattern = narrowTypeBasedOnPattern;
// Determines whether this pattern (or part of the pattern) in
// this case statement will never be matched.
function checkForUnusedPattern(evaluator, pattern, subjectType) {
    if ((0, types_1.isNever)(subjectType)) {
        reportUnnecessaryPattern(evaluator, pattern, subjectType);
    }
    else if (pattern.nodeType === 66 /* ParseNodeType.PatternAs */ && pattern.orPatterns.length > 1) {
        // Check each of the or patterns separately.
        pattern.orPatterns.forEach((orPattern) => {
            const subjectTypeMatch = narrowTypeBasedOnPattern(evaluator, subjectType, orPattern, 
            /* isPositiveTest */ true);
            if ((0, types_1.isNever)(subjectTypeMatch)) {
                reportUnnecessaryPattern(evaluator, orPattern, subjectType);
            }
            subjectType = narrowTypeBasedOnPattern(evaluator, subjectType, orPattern, /* isPositiveTest */ false);
        });
    }
    else {
        const subjectTypeMatch = narrowTypeBasedOnPattern(evaluator, subjectType, pattern, /* isPositiveTest */ true);
        if ((0, types_1.isNever)(subjectTypeMatch)) {
            reportUnnecessaryPattern(evaluator, pattern, subjectType);
        }
    }
}
exports.checkForUnusedPattern = checkForUnusedPattern;
function narrowTypeBasedOnSequencePattern(evaluator, type, pattern, isPositiveTest) {
    type = (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(type);
    let sequenceInfo = getSequencePatternInfo(evaluator, pattern, type);
    // Further narrow based on pattern entry types.
    sequenceInfo = sequenceInfo.filter((entry) => {
        var _a;
        if (entry.isDefiniteNoMatch) {
            if (isPositiveTest) {
                return false;
            }
            else {
                return true;
            }
        }
        let isPlausibleMatch = true;
        let isDefiniteMatch = true;
        const narrowedEntryTypes = [];
        let canNarrowTuple = entry.isTuple;
        // Don't attempt to narrow tuples in the negative case if the subject
        // contains indeterminate-length entries or the tuple is of indeterminate
        // length.
        if (!isPositiveTest) {
            if (entry.isIndeterminateLength) {
                canNarrowTuple = false;
            }
            if ((0, types_1.isClassInstance)(entry.subtype) && entry.subtype.tupleTypeArguments) {
                const unboundedIndex = entry.subtype.tupleTypeArguments.findIndex((typeArg) => typeArg.isUnbounded);
                if (unboundedIndex >= 0) {
                    // If the pattern includes a "star" entry that aligns exactly with
                    // the corresponding unbounded entry in the tuple, we can narrow
                    // the tuple type.
                    if (pattern.starEntryIndex === undefined || pattern.starEntryIndex !== unboundedIndex) {
                        canNarrowTuple = false;
                    }
                }
            }
        }
        // If the subject has an indeterminate length but the pattern does not accept
        // an arbitrary number of entries or accepts at least one non-star entry,
        // we can't prove that it's a definite match.
        if (entry.isIndeterminateLength) {
            if (pattern.entries.length !== 1 || pattern.starEntryIndex !== 0) {
                isDefiniteMatch = false;
            }
        }
        let negativeEntriesNarrowed = 0;
        pattern.entries.forEach((sequenceEntry, index) => {
            const entryType = getTypeOfPatternSequenceEntry(evaluator, pattern, entry, index, pattern.entries.length, pattern.starEntryIndex, 
            /* unpackStarEntry */ true);
            const narrowedEntryType = narrowTypeBasedOnPattern(evaluator, entryType, sequenceEntry, isPositiveTest);
            if (isPositiveTest) {
                if (index === pattern.starEntryIndex) {
                    if ((0, types_1.isClassInstance)(narrowedEntryType) &&
                        narrowedEntryType.tupleTypeArguments &&
                        !(0, typeUtils_1.isUnboundedTupleClass)(narrowedEntryType) &&
                        narrowedEntryType.tupleTypeArguments) {
                        (0, collectionUtils_1.appendArray)(narrowedEntryTypes, narrowedEntryType.tupleTypeArguments.map((t) => t.type));
                    }
                    else {
                        narrowedEntryTypes.push(narrowedEntryType);
                        canNarrowTuple = false;
                    }
                }
                else {
                    narrowedEntryTypes.push(narrowedEntryType);
                    if ((0, types_1.isNever)(narrowedEntryType)) {
                        isPlausibleMatch = false;
                    }
                }
            }
            else {
                if (entry.isPotentialNoMatch) {
                    isDefiniteMatch = false;
                }
                if (!(0, types_1.isNever)(narrowedEntryType)) {
                    isDefiniteMatch = false;
                    // Record the number of entries that were narrowed in the negative
                    // case. We can apply the tuple narrowing only if exactly one entry
                    // is narrowed.
                    negativeEntriesNarrowed++;
                    narrowedEntryTypes.push(narrowedEntryType);
                }
                else {
                    narrowedEntryTypes.push(entryType);
                }
                if (index === pattern.starEntryIndex) {
                    canNarrowTuple = false;
                }
            }
        });
        if (pattern.entries.length === 0) {
            // If the pattern is an empty sequence, use the entry types.
            if (entry.entryTypes.length > 0) {
                narrowedEntryTypes.push((0, types_1.combineTypes)(entry.entryTypes));
            }
            if (entry.isPotentialNoMatch) {
                isDefiniteMatch = false;
            }
        }
        if (!isPositiveTest) {
            // If the positive case is a definite match, the negative case can
            // eliminate this subtype entirely.
            if (isDefiniteMatch) {
                return false;
            }
            // Can we narrow a tuple?
            if (canNarrowTuple && negativeEntriesNarrowed === 1) {
                const tupleClassType = evaluator.getBuiltInType(pattern, 'tuple');
                if (tupleClassType && (0, types_1.isInstantiableClass)(tupleClassType)) {
                    entry.subtype = types_1.ClassType.cloneAsInstance((0, typeUtils_1.specializeTupleClass)(tupleClassType, narrowedEntryTypes.map((t) => {
                        return { type: t, isUnbounded: false };
                    })));
                }
            }
            return true;
        }
        if (isPlausibleMatch) {
            // If this is a tuple, we can narrow it to a specific tuple type.
            // Other sequences cannot be narrowed because we don't know if they
            // are immutable (covariant).
            if (canNarrowTuple) {
                const tupleClassType = evaluator.getBuiltInType(pattern, 'tuple');
                if (tupleClassType && (0, types_1.isInstantiableClass)(tupleClassType)) {
                    entry.subtype = types_1.ClassType.cloneAsInstance((0, typeUtils_1.specializeTupleClass)(tupleClassType, narrowedEntryTypes.map((t) => {
                        return { type: t, isUnbounded: false };
                    })));
                }
            }
            // If this is a supertype of Sequence, we can narrow it to a Sequence type.
            if (entry.isPotentialNoMatch && !entry.isTuple) {
                const sequenceType = evaluator.getTypingType(pattern, 'Sequence');
                if (sequenceType && (0, types_1.isInstantiableClass)(sequenceType)) {
                    let typeArgType = evaluator.stripLiteralValue((0, types_1.combineTypes)(narrowedEntryTypes));
                    // If the type is a union that contains Any or Unknown, remove the other types
                    // before wrapping it in a Sequence.
                    typeArgType = (_a = (0, typeUtils_1.containsAnyOrUnknown)(typeArgType, /* recurse */ false)) !== null && _a !== void 0 ? _a : typeArgType;
                    entry.subtype = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForSpecialization(sequenceType, [typeArgType], /* isTypeArgumentExplicit */ true));
                }
            }
        }
        return isPlausibleMatch;
    });
    return (0, types_1.combineTypes)(sequenceInfo.map((entry) => entry.subtype));
}
function narrowTypeBasedOnAsPattern(evaluator, type, pattern, isPositiveTest) {
    let remainingType = type;
    if (!isPositiveTest) {
        pattern.orPatterns.forEach((subpattern) => {
            remainingType = narrowTypeBasedOnPattern(evaluator, remainingType, subpattern, /* isPositiveTest */ false);
        });
        return remainingType;
    }
    const narrowedTypes = pattern.orPatterns.map((subpattern) => {
        const narrowedSubtype = narrowTypeBasedOnPattern(evaluator, remainingType, subpattern, 
        /* isPositiveTest */ true);
        remainingType = narrowTypeBasedOnPattern(evaluator, remainingType, subpattern, /* isPositiveTest */ false);
        return narrowedSubtype;
    });
    return (0, types_1.combineTypes)(narrowedTypes);
}
function narrowTypeBasedOnMappingPattern(evaluator, type, pattern, isPositiveTest) {
    type = (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(type);
    if (!isPositiveTest) {
        // Handle the case where the pattern consists only of a "**x" entry.
        if (pattern.entries.length === 1 && pattern.entries[0].nodeType === 72 /* ParseNodeType.PatternMappingExpandEntry */) {
            const mappingInfo = getMappingPatternInfo(evaluator, type, pattern);
            return (0, types_1.combineTypes)(mappingInfo.filter((m) => !m.isDefinitelyMapping).map((m) => m.subtype));
        }
        if (pattern.entries.length !== 1 || pattern.entries[0].nodeType !== 71 /* ParseNodeType.PatternMappingKeyEntry */) {
            return type;
        }
        // Handle the case where the type is a union that includes a TypedDict with
        // a field discriminated by a literal.
        const keyPattern = pattern.entries[0].keyPattern;
        const valuePattern = pattern.entries[0].valuePattern;
        if (keyPattern.nodeType !== 67 /* ParseNodeType.PatternLiteral */ ||
            valuePattern.nodeType !== 66 /* ParseNodeType.PatternAs */ ||
            !valuePattern.orPatterns.every((orPattern) => orPattern.nodeType === 67 /* ParseNodeType.PatternLiteral */)) {
            return type;
        }
        const keyType = evaluator.getTypeOfExpression(keyPattern.expression).type;
        // The key type must be a str literal.
        if (!(0, types_1.isClassInstance)(keyType) || !types_1.ClassType.isBuiltIn(keyType, 'str') || keyType.literalValue === undefined) {
            return type;
        }
        const keyValue = keyType.literalValue;
        const valueTypes = valuePattern.orPatterns.map((orPattern) => evaluator.getTypeOfExpression(orPattern.expression).type);
        return (0, typeUtils_1.mapSubtypes)(type, (subtype) => {
            if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isTypedDictClass(subtype)) {
                const typedDictMembers = (0, typedDicts_1.getTypedDictMembersForClass)(evaluator, subtype, /* allowNarrowed */ true);
                const member = typedDictMembers.knownItems.get(keyValue);
                if (member && (member.isRequired || member.isProvided) && (0, types_1.isClassInstance)(member.valueType)) {
                    const memberValueType = member.valueType;
                    // If there's at least one literal value pattern that matches
                    // the literal type of the member, we can eliminate this type.
                    if (valueTypes.some((valueType) => (0, types_1.isClassInstance)(valueType) &&
                        types_1.ClassType.isSameGenericClass(valueType, memberValueType) &&
                        valueType.literalValue === memberValueType.literalValue)) {
                        return undefined;
                    }
                }
            }
            return subtype;
        });
    }
    let mappingInfo = getMappingPatternInfo(evaluator, type, pattern);
    // Further narrow based on pattern entry types.
    mappingInfo = mappingInfo.filter((mappingSubtypeInfo) => {
        if (mappingSubtypeInfo.isDefinitelyNotMapping) {
            return false;
        }
        let isPlausibleMatch = true;
        pattern.entries.forEach((mappingEntry) => {
            if (mappingSubtypeInfo.typedDict) {
                if (mappingEntry.nodeType === 71 /* ParseNodeType.PatternMappingKeyEntry */) {
                    const narrowedKeyType = narrowTypeBasedOnPattern(evaluator, evaluator.getBuiltInObject(pattern, 'str'), mappingEntry.keyPattern, isPositiveTest);
                    if ((0, types_1.isNever)(narrowedKeyType)) {
                        isPlausibleMatch = false;
                    }
                    const valueType = (0, typeUtils_1.mapSubtypes)(narrowedKeyType, (keySubtype) => {
                        var _a;
                        if ((0, types_1.isAnyOrUnknown)(keySubtype)) {
                            return keySubtype;
                        }
                        if ((0, types_1.isClassInstance)(keySubtype) && types_1.ClassType.isBuiltIn(keySubtype, 'str')) {
                            if (!(0, typeUtils_1.isLiteralType)(keySubtype)) {
                                return types_1.UnknownType.create();
                            }
                            const tdEntries = (0, typedDicts_1.getTypedDictMembersForClass)(evaluator, mappingSubtypeInfo.typedDict);
                            const valueEntry = tdEntries.knownItems.get(keySubtype.literalValue);
                            if (valueEntry) {
                                const narrowedValueType = narrowTypeBasedOnPattern(evaluator, valueEntry.valueType, mappingEntry.valuePattern, 
                                /* isPositiveTest */ true);
                                if (!(0, types_1.isNever)(narrowedValueType)) {
                                    // If this is a "NotRequired" entry that has not yet been demonstrated
                                    // to be present, we can mark it as "provided" at this point.
                                    if (!valueEntry.isRequired &&
                                        !valueEntry.isProvided &&
                                        (0, types_1.isTypeSame)(mappingSubtypeInfo.subtype, mappingSubtypeInfo.typedDict)) {
                                        const newNarrowedEntriesMap = new Map((_a = mappingSubtypeInfo.typedDict.typedDictNarrowedEntries) !== null && _a !== void 0 ? _a : []);
                                        newNarrowedEntriesMap.set(keySubtype.literalValue, {
                                            valueType: valueEntry.valueType,
                                            isReadOnly: valueEntry.isReadOnly,
                                            isRequired: false,
                                            isProvided: true,
                                        });
                                        // Clone the TypedDict object with the new entries.
                                        mappingSubtypeInfo.subtype = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForNarrowedTypedDictEntries(types_1.ClassType.cloneAsInstantiable(mappingSubtypeInfo.typedDict), newNarrowedEntriesMap));
                                        mappingSubtypeInfo.typedDict = mappingSubtypeInfo.subtype;
                                    }
                                    return narrowedValueType;
                                }
                            }
                        }
                        return undefined;
                    });
                    if ((0, types_1.isNever)(valueType)) {
                        isPlausibleMatch = false;
                    }
                }
            }
            else if (mappingSubtypeInfo.dictTypeArgs) {
                if (mappingEntry.nodeType === 71 /* ParseNodeType.PatternMappingKeyEntry */) {
                    const narrowedKeyType = narrowTypeBasedOnPattern(evaluator, mappingSubtypeInfo.dictTypeArgs.key, mappingEntry.keyPattern, isPositiveTest);
                    const narrowedValueType = narrowTypeBasedOnPattern(evaluator, mappingSubtypeInfo.dictTypeArgs.value, mappingEntry.valuePattern, isPositiveTest);
                    if ((0, types_1.isNever)(narrowedKeyType) || (0, types_1.isNever)(narrowedValueType)) {
                        isPlausibleMatch = false;
                    }
                }
            }
        });
        return isPlausibleMatch;
    });
    return (0, types_1.combineTypes)(mappingInfo.map((entry) => entry.subtype));
}
// Looks up the "__match_args__" class member to determine the names of
// the attributes used for class pattern matching.
function getPositionalMatchArgNames(evaluator, type) {
    const matchArgsMemberInfo = (0, typeUtils_1.lookUpClassMember)(type, '__match_args__');
    if (matchArgsMemberInfo) {
        const matchArgsType = evaluator.getTypeOfMember(matchArgsMemberInfo);
        if ((0, types_1.isClassInstance)(matchArgsType) &&
            (0, typeUtils_1.isTupleClass)(matchArgsType) &&
            !(0, typeUtils_1.isUnboundedTupleClass)(matchArgsType) &&
            matchArgsType.tupleTypeArguments) {
            const tupleArgs = matchArgsType.tupleTypeArguments;
            // Are all the args string literals?
            if (tupleArgs.every((arg) => (0, types_1.isClassInstance)(arg.type) && types_1.ClassType.isBuiltIn(arg.type, 'str') && (0, typeUtils_1.isLiteralType)(arg.type))) {
                return tupleArgs.map((arg) => arg.type.literalValue);
            }
        }
    }
    return [];
}
function narrowTypeBasedOnLiteralPattern(evaluator, type, pattern, isPositiveTest) {
    const literalType = evaluator.getTypeOfExpression(pattern.expression).type;
    if (!isPositiveTest) {
        return evaluator.mapSubtypesExpandTypeVars(type, 
        /* options */ undefined, (expandedSubtype, unexpandedSubtype) => {
            if ((0, types_1.isClassInstance)(literalType) &&
                (0, typeUtils_1.isLiteralType)(literalType) &&
                (0, types_1.isClassInstance)(expandedSubtype) &&
                (0, typeUtils_1.isLiteralType)(expandedSubtype) &&
                evaluator.assignType(literalType, expandedSubtype)) {
                return undefined;
            }
            if ((0, typeUtils_1.isNoneInstance)(expandedSubtype) && (0, typeUtils_1.isNoneInstance)(literalType)) {
                return undefined;
            }
            // Narrow a non-literal bool based on a literal bool pattern.
            if ((0, types_1.isClassInstance)(expandedSubtype) &&
                types_1.ClassType.isBuiltIn(expandedSubtype, 'bool') &&
                expandedSubtype.literalValue === undefined &&
                (0, types_1.isClassInstance)(literalType) &&
                types_1.ClassType.isBuiltIn(literalType, 'bool') &&
                literalType.literalValue !== undefined) {
                return types_1.ClassType.cloneWithLiteral(literalType, !literalType.literalValue);
            }
            return expandedSubtype;
        });
    }
    return evaluator.mapSubtypesExpandTypeVars(type, /* options */ undefined, (expandedSubtype, unexpandedSubtype) => {
        if (evaluator.assignType(expandedSubtype, literalType)) {
            return literalType;
        }
        // See if the subtype is a subclass of the literal's class. For example,
        // if it's a literal str, see if the subtype is subclass of str.
        if ((0, types_1.isClassInstance)(literalType) &&
            (0, typeUtils_1.isLiteralType)(literalType) &&
            (0, types_1.isClassInstance)(expandedSubtype) &&
            !(0, typeUtils_1.isLiteralType)(expandedSubtype)) {
            if (evaluator.assignType(types_1.ClassType.cloneWithLiteral(literalType, /* value */ undefined), expandedSubtype)) {
                return expandedSubtype;
            }
        }
        return undefined;
    });
}
function narrowTypeBasedOnClassPattern(evaluator, type, pattern, isPositiveTest) {
    let exprType = evaluator.getTypeOfExpression(pattern.className, 2 /* EvalFlags.CallBaseDefaults */).type;
    // If this is a class (but not a type alias that refers to a class),
    // specialize it with Unknown type arguments.
    if ((0, types_1.isClass)(exprType) && !exprType.typeAliasInfo) {
        exprType = types_1.ClassType.cloneRemoveTypePromotions(exprType);
        exprType = (0, typeUtils_1.specializeWithUnknownTypeArgs)(exprType, evaluator.getTupleClassType());
    }
    // Are there any positional arguments? If so, try to get the mappings for
    // these arguments by fetching the __match_args__ symbol from the class.
    let positionalArgNames = [];
    if (pattern.arguments.some((arg) => !arg.name) && (0, types_1.isInstantiableClass)(exprType)) {
        positionalArgNames = getPositionalMatchArgNames(evaluator, exprType);
    }
    if (!isPositiveTest) {
        // Don't attempt to narrow if the class type is a more complex type (e.g. a TypeVar or union).
        if (!(0, types_1.isInstantiableClass)(exprType)) {
            return type;
        }
        let classType = exprType;
        if (classType.details.typeParameters.length > 0) {
            classType = types_1.ClassType.cloneForSpecialization(classType, 
            /* typeArguments */ undefined, 
            /* isTypeArgumentExplicit */ false);
        }
        const classInstance = (0, typeUtils_1.convertToInstance)(classType);
        const isPatternMetaclass = (0, typeUtils_1.isMetaclassInstance)(classInstance);
        return evaluator.mapSubtypesExpandTypeVars(type, {
            expandCallback: (type) => evaluator.expandPromotionTypes(pattern, type),
        }, (subjectSubtypeExpanded, subjectSubtypeUnexpanded) => {
            var _a;
            // Handle the case where the class pattern references type() or a subtype thereof
            // and the subject type is an instantiable class itself.
            if (isPatternMetaclass && (0, types_1.isInstantiableClass)(subjectSubtypeExpanded)) {
                const metaclass = (_a = subjectSubtypeExpanded.details.effectiveMetaclass) !== null && _a !== void 0 ? _a : types_1.UnknownType.create();
                if ((0, types_1.isInstantiableClass)(classType) && evaluator.assignType(classType, metaclass)) {
                    return undefined;
                }
                return subjectSubtypeExpanded;
            }
            // Handle Callable specially.
            if (!(0, types_1.isAnyOrUnknown)(subjectSubtypeExpanded) &&
                (0, types_1.isInstantiableClass)(classType) &&
                types_1.ClassType.isBuiltIn(classType, 'Callable')) {
                if (evaluator.assignType((0, typeUtils_1.getUnknownTypeForCallable)(), subjectSubtypeExpanded)) {
                    return undefined;
                }
            }
            if (!(0, typeUtils_1.isNoneInstance)(subjectSubtypeExpanded) && !(0, types_1.isClassInstance)(subjectSubtypeExpanded)) {
                return subjectSubtypeUnexpanded;
            }
            // Handle NoneType specially.
            if ((0, typeUtils_1.isNoneInstance)(subjectSubtypeExpanded) &&
                (0, types_1.isInstantiableClass)(classType) &&
                types_1.ClassType.isBuiltIn(classType, 'NoneType')) {
                return undefined;
            }
            if (!evaluator.assignType(classInstance, subjectSubtypeExpanded)) {
                return subjectSubtypeExpanded;
            }
            if (pattern.arguments.length === 0) {
                if ((0, types_1.isClass)(classInstance) && (0, types_1.isClass)(subjectSubtypeExpanded)) {
                    // We know that this match will always succeed, so we can
                    // eliminate this subtype.
                    return undefined;
                }
                return subjectSubtypeExpanded;
            }
            // We might be able to narrow further based on arguments, but only
            // if the types match exactly, the subject subtype is a final class (and
            // therefore cannot be subclassed), or the pattern class is a protocol
            // class.
            if (!evaluator.assignType(subjectSubtypeExpanded, classInstance)) {
                if ((0, types_1.isClass)(subjectSubtypeExpanded) &&
                    !types_1.ClassType.isFinal(subjectSubtypeExpanded) &&
                    !types_1.ClassType.isProtocolClass(classInstance)) {
                    return subjectSubtypeExpanded;
                }
            }
            for (let index = 0; index < pattern.arguments.length; index++) {
                const narrowedArgType = narrowTypeOfClassPatternArgument(evaluator, pattern.arguments[index], index, positionalArgNames, subjectSubtypeExpanded, isPositiveTest);
                if (!(0, types_1.isNever)(narrowedArgType)) {
                    return subjectSubtypeUnexpanded;
                }
            }
            // We've completely eliminated the type based on the arguments.
            return undefined;
        });
    }
    if (!types_1.TypeBase.isInstantiable(exprType) && !(0, types_1.isNever)(exprType)) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocAddendum.typeNotClass().format({ type: evaluator.printType(exprType) }), pattern.className);
        return types_1.NeverType.createNever();
    }
    else if ((0, types_1.isInstantiableClass)(exprType) &&
        types_1.ClassType.isProtocolClass(exprType) &&
        !types_1.ClassType.isRuntimeCheckable(exprType)) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocAddendum.protocolRequiresRuntimeCheckable(), pattern.className);
    }
    return evaluator.mapSubtypesExpandTypeVars(exprType, 
    /* options */ undefined, (expandedSubtype, unexpandedSubtype) => {
        if ((0, types_1.isAnyOrUnknown)(expandedSubtype)) {
            return unexpandedSubtype;
        }
        if ((0, types_1.isInstantiableClass)(expandedSubtype)) {
            const expandedSubtypeInstance = (0, typeUtils_1.convertToInstance)(expandedSubtype);
            const isPatternMetaclass = (0, typeUtils_1.isMetaclassInstance)(expandedSubtypeInstance);
            return evaluator.mapSubtypesExpandTypeVars(type, /* options */ undefined, (subjectSubtypeExpanded) => {
                var _a;
                if ((0, types_1.isAnyOrUnknown)(subjectSubtypeExpanded)) {
                    if ((0, types_1.isInstantiableClass)(expandedSubtype) && types_1.ClassType.isBuiltIn(expandedSubtype, 'Callable')) {
                        // Convert to an unknown callable type.
                        const unknownCallable = types_1.FunctionType.createSynthesizedInstance('', 32768 /* FunctionTypeFlags.GradualCallableForm */);
                        types_1.FunctionType.addDefaultParameters(unknownCallable, 
                        /* useUnknown */ (0, types_1.isUnknown)(subjectSubtypeExpanded));
                        unknownCallable.details.declaredReturnType = subjectSubtypeExpanded;
                        return unknownCallable;
                    }
                    return (0, typeUtils_1.convertToInstance)(unexpandedSubtype);
                }
                // Handle the case where the class pattern references type() or a subtype thereof
                // and the subject type is a class itself.
                if (isPatternMetaclass && (0, types_1.isInstantiableClass)(subjectSubtypeExpanded)) {
                    const metaclass = (_a = subjectSubtypeExpanded.details.effectiveMetaclass) !== null && _a !== void 0 ? _a : types_1.UnknownType.create();
                    if (evaluator.assignType(expandedSubtype, metaclass) ||
                        evaluator.assignType(metaclass, expandedSubtype)) {
                        return subjectSubtypeExpanded;
                    }
                    return undefined;
                }
                // Handle NoneType specially.
                if ((0, typeUtils_1.isNoneInstance)(subjectSubtypeExpanded) &&
                    (0, types_1.isInstantiableClass)(expandedSubtype) &&
                    types_1.ClassType.isBuiltIn(expandedSubtype, 'NoneType')) {
                    return subjectSubtypeExpanded;
                }
                // Handle Callable specially.
                if ((0, types_1.isInstantiableClass)(expandedSubtype) && types_1.ClassType.isBuiltIn(expandedSubtype, 'Callable')) {
                    const callableType = (0, typeUtils_1.getUnknownTypeForCallable)();
                    if (evaluator.assignType(callableType, subjectSubtypeExpanded)) {
                        return subjectSubtypeExpanded;
                    }
                    const subjObjType = (0, typeUtils_1.convertToInstance)(subjectSubtypeExpanded);
                    if (evaluator.assignType(subjObjType, callableType)) {
                        return callableType;
                    }
                    return undefined;
                }
                if ((0, types_1.isClassInstance)(subjectSubtypeExpanded)) {
                    let resultType;
                    if (evaluator.assignType(types_1.ClassType.cloneAsInstance(expandedSubtype), subjectSubtypeExpanded)) {
                        resultType = subjectSubtypeExpanded;
                    }
                    else if (evaluator.assignType(subjectSubtypeExpanded, types_1.ClassType.cloneAsInstance(expandedSubtype))) {
                        resultType = (0, typeUtils_1.addConditionToType)((0, typeUtils_1.convertToInstance)(unexpandedSubtype), (0, typeUtils_1.getTypeCondition)(subjectSubtypeExpanded));
                        // Try to retain the type arguments for the pattern class type.
                        if ((0, types_1.isInstantiableClass)(unexpandedSubtype) && (0, types_1.isClassInstance)(subjectSubtypeExpanded)) {
                            if (types_1.ClassType.isSpecialBuiltIn(unexpandedSubtype) ||
                                unexpandedSubtype.details.typeParameters.length > 0) {
                                const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(unexpandedSubtype));
                                const unspecializedMatchType = types_1.ClassType.cloneForSpecialization(unexpandedSubtype, 
                                /* typeArguments */ undefined, 
                                /* isTypeArgumentExplicit */ false);
                                const matchTypeInstance = types_1.ClassType.cloneAsInstance(unspecializedMatchType);
                                if ((0, constraintSolver_1.addConstraintsForExpectedType)(evaluator, matchTypeInstance, subjectSubtypeExpanded, typeVarContext, 
                                /* liveTypeVarScopes */ undefined, 
                                /* usageOffset */ undefined)) {
                                    resultType = (0, typeUtils_1.applySolvedTypeVars)(matchTypeInstance, typeVarContext, {
                                        unknownIfNotFound: true,
                                        tupleClassType: evaluator.getTupleClassType(),
                                    });
                                }
                            }
                        }
                    }
                    else {
                        return undefined;
                    }
                    // Are there any positional arguments? If so, try to get the mappings for
                    // these arguments by fetching the __match_args__ symbol from the class.
                    let positionalArgNames = [];
                    if (pattern.arguments.some((arg) => !arg.name)) {
                        positionalArgNames = getPositionalMatchArgNames(evaluator, expandedSubtype);
                    }
                    let isMatchValid = true;
                    pattern.arguments.forEach((arg, index) => {
                        // Narrow the arg pattern. It's possible that the actual type of the object
                        // being matched is a subtype of the resultType, so it might contain additional
                        // attributes that we don't know about.
                        const narrowedArgType = narrowTypeOfClassPatternArgument(evaluator, arg, index, positionalArgNames, resultType, isPositiveTest);
                        if ((0, types_1.isNever)(narrowedArgType)) {
                            isMatchValid = false;
                        }
                    });
                    if (isMatchValid) {
                        return resultType;
                    }
                }
                return undefined;
            });
        }
        return undefined;
    });
}
// Some built-in classes are treated as special cases for the class pattern
// if a positional argument is used.
function isClassSpecialCaseForClassPattern(classType) {
    if (classPatternSpecialCases.some((className) => classType.details.fullName === className)) {
        return true;
    }
    // If the class supplies its own `__match_args__`, it's not a special case.
    const matchArgsMemberInfo = (0, typeUtils_1.lookUpClassMember)(classType, '__match_args__');
    if (matchArgsMemberInfo) {
        return false;
    }
    // If the class derives from a built-in class, it is considered a special case.
    for (const mroClass of classType.details.mro) {
        if ((0, types_1.isClass)(mroClass) &&
            classPatternSpecialCases.some((className) => mroClass.details.fullName === className)) {
            return true;
        }
    }
    return false;
}
// Narrows the pattern provided for a class pattern argument.
function narrowTypeOfClassPatternArgument(evaluator, arg, argIndex, positionalArgNames, matchType, isPositiveTest) {
    var _a;
    let argName;
    if (arg.name) {
        argName = arg.name.value;
    }
    else if (argIndex < positionalArgNames.length) {
        argName = positionalArgNames[argIndex];
    }
    if ((0, types_1.isAnyOrUnknown)(matchType)) {
        return matchType;
    }
    if (!(0, types_1.isClass)(matchType)) {
        return types_1.UnknownType.create();
    }
    // According to PEP 634, some built-in types use themselves as the subject
    // for the first positional argument to a class pattern. Although the PEP does
    // state so explicitly, this is true of subclasses of these built-in classes
    // if the subclass doesn't define its own __match_args__.
    let useSelfForPattern = false;
    let selfForPatternType = matchType;
    if (!arg.name && (0, types_1.isClass)(matchType) && argIndex === 0) {
        if (isClassSpecialCaseForClassPattern(matchType)) {
            useSelfForPattern = true;
        }
        else if (positionalArgNames.length === 0) {
            matchType.details.mro.forEach((mroClass) => {
                if ((0, types_1.isClass)(mroClass) && isClassSpecialCaseForClassPattern(mroClass)) {
                    selfForPatternType = mroClass;
                    useSelfForPattern = true;
                }
            });
        }
    }
    let argType;
    if (useSelfForPattern) {
        argType = types_1.ClassType.cloneAsInstance(selfForPatternType);
    }
    else {
        if (argName) {
            argType = (_a = evaluator.useSpeculativeMode(arg, () => 
            // We need to apply a rather ugly cast here because PatternClassArgumentNode is
            // not technically an ExpressionNode, but it is OK to use it in this context.
            evaluator.getTypeOfBoundMember(arg, types_1.ClassType.cloneAsInstance(matchType), argName))) === null || _a === void 0 ? void 0 : _a.type;
        }
        if (!argType) {
            if (!isPositiveTest) {
                return matchType;
            }
            // If the class type in question is "final", we know that no additional
            // attributes can be added by subtypes, so it's safe to eliminate this
            // type entirely.
            if (types_1.ClassType.isFinal(matchType)) {
                return types_1.NeverType.createNever();
            }
            argType = types_1.UnknownType.create();
        }
    }
    return narrowTypeBasedOnPattern(evaluator, argType, arg.pattern, isPositiveTest);
}
function narrowTypeBasedOnValuePattern(evaluator, subjectType, pattern, isPositiveTest) {
    const valueType = evaluator.getTypeOfExpression(pattern.expression).type;
    const narrowedSubtypes = [];
    evaluator.mapSubtypesExpandTypeVars(valueType, 
    /* options */ undefined, (valueSubtypeExpanded, valueSubtypeUnexpanded) => {
        narrowedSubtypes.push(evaluator.mapSubtypesExpandTypeVars(subjectType, { conditionFilter: (0, typeUtils_1.getTypeCondition)(valueSubtypeExpanded) }, (subjectSubtypeExpanded) => {
            // If this is a negative test, see if it's an enum value.
            if (!isPositiveTest) {
                if ((0, types_1.isClassInstance)(subjectSubtypeExpanded) &&
                    types_1.ClassType.isEnumClass(subjectSubtypeExpanded) &&
                    !(0, typeUtils_1.isLiteralType)(subjectSubtypeExpanded) &&
                    (0, types_1.isClassInstance)(valueSubtypeExpanded) &&
                    (0, types_1.isSameWithoutLiteralValue)(subjectSubtypeExpanded, valueSubtypeExpanded) &&
                    (0, typeUtils_1.isLiteralType)(valueSubtypeExpanded)) {
                    const allEnumTypes = (0, typeGuards_1.enumerateLiteralsForType)(evaluator, subjectSubtypeExpanded);
                    if (allEnumTypes) {
                        return (0, types_1.combineTypes)(allEnumTypes.filter((enumType) => !types_1.ClassType.isLiteralValueSame(valueSubtypeExpanded, enumType)));
                    }
                }
                else if ((0, types_1.isClassInstance)(subjectSubtypeExpanded) &&
                    (0, types_1.isClassInstance)(valueSubtypeExpanded) &&
                    (0, typeUtils_1.isLiteralType)(subjectSubtypeExpanded) &&
                    types_1.ClassType.isLiteralValueSame(valueSubtypeExpanded, subjectSubtypeExpanded)) {
                    return undefined;
                }
                return subjectSubtypeExpanded;
            }
            if ((0, types_1.isNever)(valueSubtypeExpanded) || (0, types_1.isNever)(subjectSubtypeExpanded)) {
                return types_1.NeverType.createNever();
            }
            if ((0, types_1.isAnyOrUnknown)(valueSubtypeExpanded) || (0, types_1.isAnyOrUnknown)(subjectSubtypeExpanded)) {
                // If either type is "Unknown" (versus Any), propagate the Unknown.
                return (0, types_1.isUnknown)(valueSubtypeExpanded) || (0, types_1.isUnknown)(subjectSubtypeExpanded)
                    ? (0, typeUtils_1.preserveUnknown)(valueSubtypeExpanded, subjectSubtypeExpanded)
                    : types_1.AnyType.create();
            }
            // If both types are literals, we can compare the literal values directly.
            if ((0, types_1.isClassInstance)(subjectSubtypeExpanded) &&
                (0, typeUtils_1.isLiteralType)(subjectSubtypeExpanded) &&
                (0, types_1.isClassInstance)(valueSubtypeExpanded) &&
                (0, typeUtils_1.isLiteralType)(valueSubtypeExpanded)) {
                return types_1.ClassType.isLiteralValueSame(valueSubtypeExpanded, subjectSubtypeExpanded)
                    ? valueSubtypeUnexpanded
                    : undefined;
            }
            // Determine if assignment is supported for this combination of
            // value subtype and matching subtype.
            const returnType = evaluator.useSpeculativeMode(pattern.expression, () => evaluator.getTypeOfMagicMethodCall(valueSubtypeExpanded, '__eq__', [{ type: subjectSubtypeExpanded }], pattern.expression, 
            /* expectedType */ undefined));
            return returnType ? valueSubtypeUnexpanded : undefined;
        }));
        return undefined;
    });
    return (0, types_1.combineTypes)(narrowedSubtypes);
}
// Returns information about all subtypes that match the definition of a "mapping" as
// specified in PEP 634.
function getMappingPatternInfo(evaluator, type, node) {
    const mappingInfo = [];
    (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
        const concreteSubtype = evaluator.makeTopLevelTypeVarsConcrete(subtype);
        if ((0, types_1.isAnyOrUnknown)(concreteSubtype)) {
            mappingInfo.push({
                subtype,
                isDefinitelyMapping: false,
                isDefinitelyNotMapping: false,
                dictTypeArgs: {
                    key: concreteSubtype,
                    value: concreteSubtype,
                },
            });
            return;
        }
        if ((0, types_1.isClassInstance)(concreteSubtype)) {
            // Is it a TypedDict?
            if (types_1.ClassType.isTypedDictClass(concreteSubtype)) {
                mappingInfo.push({
                    subtype,
                    isDefinitelyMapping: true,
                    isDefinitelyNotMapping: false,
                    typedDict: concreteSubtype,
                });
                return;
            }
            // Is it a subclass of Mapping?
            let mroClassToSpecialize;
            for (const mroClass of concreteSubtype.details.mro) {
                if ((0, types_1.isInstantiableClass)(mroClass) && types_1.ClassType.isBuiltIn(mroClass, 'Mapping')) {
                    mroClassToSpecialize = mroClass;
                    break;
                }
            }
            if (mroClassToSpecialize) {
                const specializedMapping = (0, typeUtils_1.partiallySpecializeType)(mroClassToSpecialize, concreteSubtype);
                if (specializedMapping.typeArguments && specializedMapping.typeArguments.length >= 2) {
                    mappingInfo.push({
                        subtype,
                        isDefinitelyMapping: true,
                        isDefinitelyNotMapping: false,
                        dictTypeArgs: {
                            key: specializedMapping.typeArguments[0],
                            value: specializedMapping.typeArguments[1],
                        },
                    });
                }
                return;
            }
            // Is it a superclass of Mapping?
            const mappingType = evaluator.getTypingType(node, 'Mapping');
            if (mappingType && (0, types_1.isInstantiableClass)(mappingType)) {
                const mappingObject = types_1.ClassType.cloneAsInstance(mappingType);
                if (evaluator.assignType(subtype, mappingObject)) {
                    mappingInfo.push({
                        subtype,
                        isDefinitelyMapping: false,
                        isDefinitelyNotMapping: false,
                        dictTypeArgs: {
                            key: types_1.UnknownType.create(),
                            value: types_1.UnknownType.create(),
                        },
                    });
                }
            }
            mappingInfo.push({
                subtype,
                isDefinitelyMapping: false,
                isDefinitelyNotMapping: true,
            });
        }
    });
    return mappingInfo;
}
// Returns information about all subtypes that match the definition of a "sequence" as
// specified in PEP 634. For types that are not sequences or sequences that are not of
// sufficient length, it sets definiteNoMatch to true.
function getSequencePatternInfo(evaluator, pattern, type) {
    const patternEntryCount = pattern.entries.length;
    const patternStarEntryIndex = pattern.starEntryIndex;
    const sequenceInfo = [];
    (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
        var _a;
        const concreteSubtype = evaluator.makeTopLevelTypeVarsConcrete(subtype);
        let mroClassToSpecialize;
        let pushedEntry = false;
        if ((0, types_1.isClassInstance)(concreteSubtype)) {
            for (const mroClass of concreteSubtype.details.mro) {
                if (!(0, types_1.isInstantiableClass)(mroClass)) {
                    break;
                }
                // Strings, bytes, and bytearray are explicitly excluded.
                if (types_1.ClassType.isBuiltIn(mroClass, 'str') ||
                    types_1.ClassType.isBuiltIn(mroClass, 'bytes') ||
                    types_1.ClassType.isBuiltIn(mroClass, 'bytearray')) {
                    // This is definitely not a match.
                    sequenceInfo.push({
                        subtype,
                        entryTypes: [],
                        isIndeterminateLength: true,
                        isDefiniteNoMatch: true,
                    });
                    return;
                }
                if (types_1.ClassType.isBuiltIn(mroClass, 'Sequence')) {
                    mroClassToSpecialize = mroClass;
                    break;
                }
                if ((0, typeUtils_1.isTupleClass)(mroClass)) {
                    mroClassToSpecialize = mroClass;
                    break;
                }
            }
            if (mroClassToSpecialize) {
                const specializedSequence = (0, typeUtils_1.partiallySpecializeType)(mroClassToSpecialize, concreteSubtype);
                if ((0, typeUtils_1.isTupleClass)(specializedSequence)) {
                    const typeArgs = (_a = specializedSequence.tupleTypeArguments) !== null && _a !== void 0 ? _a : [
                        { type: types_1.UnknownType.create(), isUnbounded: true },
                    ];
                    const tupleIndeterminateIndex = typeArgs.findIndex((t) => t.isUnbounded || (0, types_1.isUnpackedVariadicTypeVar)(t.type));
                    let tupleDeterminateEntryCount = typeArgs.length;
                    // If the tuple contains an indeterminate entry, expand or remove that
                    // entry to match the length of the pattern if possible.
                    if (tupleIndeterminateIndex >= 0) {
                        tupleDeterminateEntryCount--;
                        while (typeArgs.length < patternEntryCount) {
                            typeArgs.splice(tupleIndeterminateIndex, 0, typeArgs[tupleIndeterminateIndex]);
                        }
                        if (typeArgs.length > patternEntryCount && patternStarEntryIndex === undefined) {
                            typeArgs.splice(tupleIndeterminateIndex, 1);
                        }
                    }
                    // If the pattern contains a star entry and there are too many entries
                    // in the tuple, we can collapse some of them into the star entry.
                    if (patternStarEntryIndex !== undefined &&
                        typeArgs.length >= 2 &&
                        typeArgs.length > patternEntryCount) {
                        const entriesToCombine = typeArgs.length - patternEntryCount + 1;
                        const removedEntries = typeArgs.splice(patternStarEntryIndex, entriesToCombine);
                        typeArgs.splice(patternStarEntryIndex, 0, {
                            type: (0, types_1.combineTypes)(removedEntries.map((t) => t.type)),
                            isUnbounded: removedEntries.every((t) => t.isUnbounded || (0, types_1.isUnpackedVariadicTypeVar)(t.type)),
                        });
                    }
                    if (typeArgs.length === patternEntryCount) {
                        let isDefiniteNoMatch = false;
                        let isPotentialNoMatch = tupleIndeterminateIndex >= 0;
                        // If the pattern includes a "star entry" and the tuple includes an
                        // indeterminate-length entry that aligns to the star entry, we can
                        // assume it will always match.
                        if (patternStarEntryIndex !== undefined &&
                            tupleIndeterminateIndex >= 0 &&
                            pattern.entries.length - 1 === tupleDeterminateEntryCount &&
                            patternStarEntryIndex === tupleIndeterminateIndex) {
                            isPotentialNoMatch = false;
                        }
                        for (let i = 0; i < patternEntryCount; i++) {
                            const subPattern = pattern.entries[i];
                            const typeArg = typeArgs[i].type;
                            const narrowedType = narrowTypeBasedOnPattern(evaluator, typeArg, subPattern, 
                            /* isPositiveTest */ true);
                            if ((0, types_1.isNever)(narrowedType)) {
                                isDefiniteNoMatch = true;
                            }
                        }
                        sequenceInfo.push({
                            subtype,
                            entryTypes: isDefiniteNoMatch ? [] : typeArgs.map((t) => t.type),
                            isIndeterminateLength: false,
                            isTuple: true,
                            isDefiniteNoMatch,
                            isPotentialNoMatch,
                        });
                        pushedEntry = true;
                    }
                    // If the pattern contains a star entry and the pattern associated with
                    // the star entry is unbounded, we can remove it completely under the
                    // assumption that the star pattern will capture nothing.
                    if (patternStarEntryIndex !== undefined) {
                        let tryMatchStarSequence = false;
                        if (typeArgs.length === patternEntryCount - 1) {
                            tryMatchStarSequence = true;
                            typeArgs.splice(patternStarEntryIndex, 0, {
                                type: types_1.AnyType.create(),
                                isUnbounded: true,
                            });
                        }
                        else if (typeArgs.length === patternEntryCount &&
                            typeArgs[patternStarEntryIndex].isUnbounded) {
                            tryMatchStarSequence = true;
                        }
                        if (tryMatchStarSequence) {
                            let isDefiniteNoMatch = false;
                            for (let i = 0; i < patternEntryCount; i++) {
                                if (i === patternStarEntryIndex) {
                                    continue;
                                }
                                const subPattern = pattern.entries[i];
                                const typeArg = typeArgs[i].type;
                                const narrowedType = narrowTypeBasedOnPattern(evaluator, typeArg, subPattern, 
                                /* isPositiveTest */ true);
                                if ((0, types_1.isNever)(narrowedType)) {
                                    isDefiniteNoMatch = true;
                                }
                            }
                            sequenceInfo.push({
                                subtype,
                                entryTypes: isDefiniteNoMatch ? [] : typeArgs.map((t) => t.type),
                                isIndeterminateLength: false,
                                isTuple: true,
                                isDefiniteNoMatch,
                            });
                            pushedEntry = true;
                        }
                    }
                }
                else {
                    sequenceInfo.push({
                        subtype,
                        entryTypes: [
                            specializedSequence.typeArguments && specializedSequence.typeArguments.length > 0
                                ? specializedSequence.typeArguments[0]
                                : types_1.UnknownType.create(),
                        ],
                        isIndeterminateLength: true,
                        isDefiniteNoMatch: false,
                    });
                    pushedEntry = true;
                }
            }
        }
        if (!pushedEntry) {
            // If it wasn't a subtype of Sequence, see if it's a supertype.
            const sequenceType = evaluator.getTypingType(pattern, 'Sequence');
            if (sequenceType && (0, types_1.isInstantiableClass)(sequenceType)) {
                const sequenceTypeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(sequenceType));
                if ((0, constraintSolver_1.addConstraintsForExpectedType)(evaluator, types_1.ClassType.cloneAsInstance(sequenceType), subtype, sequenceTypeVarContext, (0, parseTreeUtils_1.getTypeVarScopesForNode)(pattern), pattern.start)) {
                    const specializedSequence = (0, typeUtils_1.applySolvedTypeVars)(types_1.ClassType.cloneAsInstantiable(sequenceType), sequenceTypeVarContext);
                    if (specializedSequence.typeArguments && specializedSequence.typeArguments.length > 0) {
                        sequenceInfo.push({
                            subtype,
                            entryTypes: [specializedSequence.typeArguments[0]],
                            isIndeterminateLength: true,
                            isDefiniteNoMatch: false,
                            isPotentialNoMatch: true,
                        });
                        return;
                    }
                }
                if (evaluator.assignType(subtype, types_1.ClassType.cloneForSpecialization(types_1.ClassType.cloneAsInstance(sequenceType), [types_1.UnknownType.create()], 
                /* isTypeArgumentExplicit */ true))) {
                    sequenceInfo.push({
                        subtype,
                        entryTypes: [types_1.UnknownType.create()],
                        isIndeterminateLength: true,
                        isDefiniteNoMatch: false,
                        isPotentialNoMatch: true,
                    });
                    return;
                }
            }
            // Push an entry that indicates that this is definitely not a match.
            sequenceInfo.push({
                subtype,
                entryTypes: [],
                isIndeterminateLength: true,
                isDefiniteNoMatch: true,
            });
        }
    });
    return sequenceInfo;
}
function getTypeOfPatternSequenceEntry(evaluator, node, sequenceInfo, entryIndex, entryCount, starEntryIndex, unpackStarEntry) {
    if (sequenceInfo.isIndeterminateLength) {
        let entryType = sequenceInfo.entryTypes[0];
        if (!unpackStarEntry && entryIndex === starEntryIndex && !(0, types_1.isNever)(entryType)) {
            entryType = wrapTypeInList(evaluator, node, entryType);
        }
        return entryType;
    }
    if (starEntryIndex === undefined || entryIndex < starEntryIndex) {
        return sequenceInfo.entryTypes[entryIndex];
    }
    if (entryIndex === starEntryIndex) {
        // Create a list out of the entries that map to the star entry.
        // Note that we strip literal types here.
        const starEntryTypes = sequenceInfo.entryTypes
            .slice(starEntryIndex, starEntryIndex + sequenceInfo.entryTypes.length - entryCount + 1)
            .map((type) => evaluator.stripLiteralValue(type));
        let entryType = (0, types_1.combineTypes)(starEntryTypes);
        if (!unpackStarEntry) {
            entryType = wrapTypeInList(evaluator, node, entryType);
        }
        return entryType;
    }
    // The entry index is past the index of the star entry, so we need
    // to index from the end of the sequence rather than the start.
    const itemIndex = sequenceInfo.entryTypes.length - (entryCount - entryIndex);
    (0, debug_1.assert)(itemIndex >= 0 && itemIndex < sequenceInfo.entryTypes.length);
    return sequenceInfo.entryTypes[itemIndex];
}
// Recursively assigns the specified type to the pattern and any capture
// nodes within it. It returns the narrowed type, as dictated by the pattern.
function assignTypeToPatternTargets(evaluator, type, isTypeIncomplete, pattern) {
    // Further narrow the type based on this pattern.
    const narrowedType = narrowTypeBasedOnPattern(evaluator, type, pattern, /* positiveTest */ true);
    switch (pattern.nodeType) {
        case 65 /* ParseNodeType.PatternSequence */: {
            const sequenceInfo = getSequencePatternInfo(evaluator, pattern, narrowedType).filter((seqInfo) => !seqInfo.isDefiniteNoMatch);
            pattern.entries.forEach((entry, index) => {
                const entryType = (0, types_1.combineTypes)(sequenceInfo.map((info) => getTypeOfPatternSequenceEntry(evaluator, pattern, info, index, pattern.entries.length, pattern.starEntryIndex, 
                /* unpackStarEntry */ false)));
                assignTypeToPatternTargets(evaluator, entryType, isTypeIncomplete, entry);
            });
            break;
        }
        case 66 /* ParseNodeType.PatternAs */: {
            if (pattern.target) {
                evaluator.assignTypeToExpression(pattern.target, { type: narrowedType, isIncomplete: isTypeIncomplete }, pattern.target);
            }
            let runningNarrowedType = narrowedType;
            pattern.orPatterns.forEach((orPattern) => {
                assignTypeToPatternTargets(evaluator, runningNarrowedType, isTypeIncomplete, orPattern);
                // OR patterns are evaluated left to right, so we can narrow
                // the type as we go.
                runningNarrowedType = narrowTypeBasedOnPattern(evaluator, runningNarrowedType, orPattern, 
                /* positiveTest */ false);
            });
            break;
        }
        case 69 /* ParseNodeType.PatternCapture */: {
            if (pattern.isWildcard) {
                if (!isTypeIncomplete) {
                    if ((0, types_1.isUnknown)(narrowedType)) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownVariableType, localize_1.LocMessage.wildcardPatternTypeUnknown(), pattern.target);
                    }
                    else if ((0, typeUtils_1.isPartlyUnknown)(narrowedType)) {
                        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
                        diagAddendum.addMessage(localize_1.LocAddendum.typeOfSymbol().format({
                            name: '_',
                            type: evaluator.printType(narrowedType, { expandTypeAlias: true }),
                        }));
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownVariableType, localize_1.LocMessage.wildcardPatternTypePartiallyUnknown() + diagAddendum.getString(), pattern.target);
                    }
                }
            }
            else {
                evaluator.assignTypeToExpression(pattern.target, { type: narrowedType, isIncomplete: isTypeIncomplete }, pattern.target);
            }
            break;
        }
        case 70 /* ParseNodeType.PatternMapping */: {
            const mappingInfo = getMappingPatternInfo(evaluator, narrowedType, pattern);
            pattern.entries.forEach((mappingEntry) => {
                const keyTypes = [];
                const valueTypes = [];
                mappingInfo.forEach((mappingSubtypeInfo) => {
                    if (mappingSubtypeInfo.typedDict) {
                        if (mappingEntry.nodeType === 71 /* ParseNodeType.PatternMappingKeyEntry */) {
                            const keyType = narrowTypeBasedOnPattern(evaluator, evaluator.getBuiltInObject(pattern, 'str'), mappingEntry.keyPattern, 
                            /* isPositiveTest */ true);
                            keyTypes.push(keyType);
                            (0, typeUtils_1.doForEachSubtype)(keyType, (keySubtype) => {
                                if ((0, types_1.isClassInstance)(keySubtype) &&
                                    types_1.ClassType.isBuiltIn(keySubtype, 'str') &&
                                    (0, typeUtils_1.isLiteralType)(keySubtype)) {
                                    const tdEntries = (0, typedDicts_1.getTypedDictMembersForClass)(evaluator, mappingSubtypeInfo.typedDict);
                                    const valueInfo = tdEntries.knownItems.get(keySubtype.literalValue);
                                    valueTypes.push(valueInfo ? valueInfo.valueType : types_1.UnknownType.create());
                                }
                                else {
                                    valueTypes.push(types_1.UnknownType.create());
                                }
                            });
                        }
                        else if (mappingEntry.nodeType === 72 /* ParseNodeType.PatternMappingExpandEntry */) {
                            keyTypes.push(evaluator.getBuiltInObject(pattern, 'str'));
                            valueTypes.push(evaluator.getObjectType());
                        }
                    }
                    else if (mappingSubtypeInfo.dictTypeArgs) {
                        if (mappingEntry.nodeType === 71 /* ParseNodeType.PatternMappingKeyEntry */) {
                            const keyType = narrowTypeBasedOnPattern(evaluator, mappingSubtypeInfo.dictTypeArgs.key, mappingEntry.keyPattern, 
                            /* isPositiveTest */ true);
                            keyTypes.push(keyType);
                            valueTypes.push(narrowTypeBasedOnPattern(evaluator, mappingSubtypeInfo.dictTypeArgs.value, mappingEntry.valuePattern, 
                            /* isPositiveTest */ true));
                        }
                        else if (mappingEntry.nodeType === 72 /* ParseNodeType.PatternMappingExpandEntry */) {
                            keyTypes.push(mappingSubtypeInfo.dictTypeArgs.key);
                            valueTypes.push(mappingSubtypeInfo.dictTypeArgs.value);
                        }
                    }
                });
                const keyType = (0, types_1.combineTypes)(keyTypes);
                const valueType = (0, types_1.combineTypes)(valueTypes);
                if (mappingEntry.nodeType === 71 /* ParseNodeType.PatternMappingKeyEntry */) {
                    assignTypeToPatternTargets(evaluator, keyType, isTypeIncomplete, mappingEntry.keyPattern);
                    assignTypeToPatternTargets(evaluator, valueType, isTypeIncomplete, mappingEntry.valuePattern);
                }
                else if (mappingEntry.nodeType === 72 /* ParseNodeType.PatternMappingExpandEntry */) {
                    const dictClass = evaluator.getBuiltInType(pattern, 'dict');
                    const strType = evaluator.getBuiltInObject(pattern, 'str');
                    const dictType = dictClass && (0, types_1.isInstantiableClass)(dictClass) && (0, types_1.isClassInstance)(strType)
                        ? types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForSpecialization(dictClass, [keyType, valueType], 
                        /* isTypeArgumentExplicit */ true))
                        : types_1.UnknownType.create();
                    evaluator.assignTypeToExpression(mappingEntry.target, { type: dictType, isIncomplete: isTypeIncomplete }, mappingEntry.target);
                }
            });
            break;
        }
        case 68 /* ParseNodeType.PatternClass */: {
            const argTypes = pattern.arguments.map((arg) => []);
            evaluator.mapSubtypesExpandTypeVars(narrowedType, /* options */ undefined, (expandedSubtype) => {
                if ((0, types_1.isClassInstance)(expandedSubtype)) {
                    (0, typeUtils_1.doForEachSubtype)(narrowedType, (subjectSubtype) => {
                        const concreteSubtype = evaluator.makeTopLevelTypeVarsConcrete(subjectSubtype);
                        if ((0, types_1.isAnyOrUnknown)(concreteSubtype)) {
                            pattern.arguments.forEach((arg, index) => {
                                argTypes[index].push(concreteSubtype);
                            });
                        }
                        else if ((0, types_1.isClassInstance)(concreteSubtype)) {
                            // Are there any positional arguments? If so, try to get the mappings for
                            // these arguments by fetching the __match_args__ symbol from the class.
                            let positionalArgNames = [];
                            if (pattern.arguments.some((arg) => !arg.name)) {
                                positionalArgNames = getPositionalMatchArgNames(evaluator, types_1.ClassType.cloneAsInstantiable(expandedSubtype));
                            }
                            pattern.arguments.forEach((arg, index) => {
                                const narrowedArgType = narrowTypeOfClassPatternArgument(evaluator, arg, index, positionalArgNames, types_1.ClassType.cloneAsInstantiable(expandedSubtype), 
                                /* isPositiveTest */ true);
                                argTypes[index].push(narrowedArgType);
                            });
                        }
                    });
                }
                else {
                    pattern.arguments.forEach((arg, index) => {
                        argTypes[index].push(types_1.UnknownType.create());
                    });
                }
                return undefined;
            });
            pattern.arguments.forEach((arg, index) => {
                assignTypeToPatternTargets(evaluator, (0, types_1.combineTypes)(argTypes[index]), isTypeIncomplete, arg.pattern);
            });
            break;
        }
        case 67 /* ParseNodeType.PatternLiteral */:
        case 73 /* ParseNodeType.PatternValue */:
        case 0 /* ParseNodeType.Error */: {
            // Nothing to do here.
            break;
        }
    }
    return narrowedType;
}
exports.assignTypeToPatternTargets = assignTypeToPatternTargets;
function wrapTypeInList(evaluator, node, type) {
    var _a;
    if ((0, types_1.isNever)(type)) {
        return type;
    }
    const listObjectType = (0, typeUtils_1.convertToInstance)(evaluator.getBuiltInObject(node, 'list'));
    if (listObjectType && (0, types_1.isClassInstance)(listObjectType)) {
        // If the type is a union that contains an Any or Unknown, eliminate the other
        // types before wrapping it in a list.
        type = (_a = (0, typeUtils_1.containsAnyOrUnknown)(type, /* recurse */ false)) !== null && _a !== void 0 ? _a : type;
        return types_1.ClassType.cloneForSpecialization(listObjectType, [type], /* isTypeArgumentExplicit */ true);
    }
    return types_1.UnknownType.create();
}
function validateClassPattern(evaluator, pattern) {
    let exprType = evaluator.getTypeOfExpression(pattern.className, 2 /* EvalFlags.CallBaseDefaults */).type;
    // If the expression is a type alias or other special form, treat it
    // as the special form rather than the class.
    if (exprType.specialForm) {
        exprType = exprType.specialForm;
    }
    if ((0, types_1.isAnyOrUnknown)(exprType)) {
        return;
    }
    // Check for certain uses of type aliases that generate runtime exceptions.
    if (exprType.typeAliasInfo &&
        (0, types_1.isInstantiableClass)(exprType) &&
        exprType.typeArguments &&
        exprType.isTypeArgumentExplicit) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.classPatternTypeAlias().format({ type: evaluator.printType(exprType) }), pattern.className);
    }
    else if (!(0, types_1.isInstantiableClass)(exprType)) {
        if (!(0, types_1.isNever)(exprType)) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocAddendum.typeNotClass().format({ type: evaluator.printType(exprType) }), pattern.className);
        }
    }
    else {
        const isBuiltIn = isClassSpecialCaseForClassPattern(exprType);
        // If it's a special-case builtin class, only positional arguments are allowed.
        if (isBuiltIn) {
            if (pattern.arguments.length === 1 && pattern.arguments[0].name) {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.classPatternBuiltInArgPositional(), pattern.arguments[0].name);
            }
        }
        // Emits an error if the supplied number of positional patterns is less than
        // expected for the given subject type.
        let positionalPatternCount = pattern.arguments.findIndex((arg) => arg.name !== undefined);
        if (positionalPatternCount < 0) {
            positionalPatternCount = pattern.arguments.length;
        }
        let expectedPatternCount = 1;
        if (!isBuiltIn) {
            let positionalArgNames = [];
            if (pattern.arguments.some((arg) => !arg.name)) {
                positionalArgNames = getPositionalMatchArgNames(evaluator, exprType);
            }
            expectedPatternCount = positionalArgNames.length;
        }
        if (positionalPatternCount > expectedPatternCount) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.classPatternPositionalArgCount().format({
                type: exprType.details.name,
                expected: expectedPatternCount,
                received: positionalPatternCount,
            }), pattern.arguments[expectedPatternCount]);
        }
    }
}
exports.validateClassPattern = validateClassPattern;
// Determines whether the reference expression has a relationship to the subject expression
// in such a way that the type of the reference expression can be narrowed based
// on the narrowed type of the subject expression.
function getPatternSubtypeNarrowingCallback(evaluator, reference, subjectExpression) {
    // Look for a subject expression of the form <reference>[<literal>] where
    // <literal> is either a str (for TypedDict discrimination) or an int
    // (for tuple discrimination).
    if (subjectExpression.nodeType === 27 /* ParseNodeType.Index */ &&
        subjectExpression.items.length === 1 &&
        !subjectExpression.trailingComma &&
        subjectExpression.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
        (0, parseTreeUtils_1.isMatchingExpression)(reference, subjectExpression.baseExpression)) {
        const indexTypeResult = evaluator.getTypeOfExpression(subjectExpression.items[0].valueExpression);
        const indexType = indexTypeResult.type;
        if ((0, types_1.isClassInstance)(indexType) && (0, typeUtils_1.isLiteralType)(indexType)) {
            if (types_1.ClassType.isBuiltIn(indexType, ['int', 'str'])) {
                const unnarrowedReferenceTypeResult = evaluator.getTypeOfExpression(subjectExpression.baseExpression, 2 /* EvalFlags.CallBaseDefaults */);
                const unnarrowedReferenceType = unnarrowedReferenceTypeResult.type;
                return (narrowedSubjectType) => {
                    let canNarrow = true;
                    const typesToCombine = [];
                    (0, typeUtils_1.doForEachSubtype)(narrowedSubjectType, (subtype) => {
                        subtype = evaluator.makeTopLevelTypeVarsConcrete(subtype);
                        if ((0, types_1.isClassInstance)(subtype) && subtype.literalValue !== undefined) {
                            if (types_1.ClassType.isBuiltIn(indexType, 'str')) {
                                typesToCombine.push((0, typeGuards_1.narrowTypeForDiscriminatedDictEntryComparison)(evaluator, unnarrowedReferenceType, indexType, subtype, 
                                /* isPositiveTest */ true));
                            }
                            else {
                                typesToCombine.push((0, typeGuards_1.narrowTypeForDiscriminatedTupleComparison)(evaluator, unnarrowedReferenceType, indexType, subtype, 
                                /* isPositiveTest */ true));
                            }
                        }
                        else if (!(0, types_1.isNever)(subtype)) {
                            // We don't know how to narrow in this case.
                            canNarrow = false;
                        }
                    });
                    if (!canNarrow) {
                        return undefined;
                    }
                    return {
                        type: (0, types_1.combineTypes)(typesToCombine),
                        isIncomplete: indexTypeResult.isIncomplete || unnarrowedReferenceTypeResult.isIncomplete,
                    };
                };
            }
        }
    }
    // Look for a subject expression that contains the reference
    // expression as an entry in a tuple.
    if (subjectExpression.nodeType === 52 /* ParseNodeType.Tuple */) {
        const matchingEntryIndex = subjectExpression.expressions.findIndex((expr) => (0, parseTreeUtils_1.isMatchingExpression)(reference, expr));
        if (matchingEntryIndex >= 0) {
            const typeResult = evaluator.getTypeOfExpression(subjectExpression.expressions[matchingEntryIndex]);
            return (narrowedSubjectType) => {
                let canNarrow = true;
                const narrowedSubtypes = [];
                (0, typeUtils_1.doForEachSubtype)(narrowedSubjectType, (subtype) => {
                    if ((0, types_1.isClassInstance)(subtype) &&
                        types_1.ClassType.isBuiltIn(subtype, 'tuple') &&
                        subtype.tupleTypeArguments &&
                        matchingEntryIndex < subtype.tupleTypeArguments.length &&
                        subtype.tupleTypeArguments.every((e) => !e.isUnbounded)) {
                        narrowedSubtypes.push(subtype.tupleTypeArguments[matchingEntryIndex].type);
                    }
                    else if ((0, types_1.isNever)(narrowedSubjectType)) {
                        narrowedSubtypes.push(narrowedSubjectType);
                    }
                    else {
                        canNarrow = false;
                    }
                });
                return canNarrow
                    ? { type: (0, types_1.combineTypes)(narrowedSubtypes), isIncomplete: typeResult.isIncomplete }
                    : undefined;
            };
        }
    }
    // Look for a subject expression of the form "a.b" where "b" is an attribute
    // that is annotated with a literal type.
    if (subjectExpression.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
        (0, parseTreeUtils_1.isMatchingExpression)(reference, subjectExpression.leftExpression)) {
        const unnarrowedReferenceTypeResult = evaluator.getTypeOfExpression(subjectExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
        const unnarrowedReferenceType = unnarrowedReferenceTypeResult.type;
        return (narrowedSubjectType) => {
            if ((0, types_1.isNever)(narrowedSubjectType)) {
                return { type: types_1.NeverType.createNever() };
            }
            if (!(0, typeUtils_1.isLiteralTypeOrUnion)(narrowedSubjectType)) {
                return undefined;
            }
            const resultType = (0, typeUtils_1.mapSubtypes)(narrowedSubjectType, (literalSubtype) => {
                (0, debug_1.assert)((0, types_1.isClassInstance)(literalSubtype) && literalSubtype.literalValue !== undefined);
                return (0, typeGuards_1.narrowTypeForDiscriminatedLiteralFieldComparison)(evaluator, unnarrowedReferenceType, subjectExpression.memberName.value, literalSubtype, 
                /* isPositiveTest */ true);
            });
            return {
                type: resultType,
            };
        };
    }
    return undefined;
}
exports.getPatternSubtypeNarrowingCallback = getPatternSubtypeNarrowingCallback;
function reportUnnecessaryPattern(evaluator, pattern, subjectType) {
    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryComparison, localize_1.LocMessage.patternNeverMatches().format({ type: evaluator.printType(subjectType) }), pattern);
}
//# sourceMappingURL=patternMatching.js.map