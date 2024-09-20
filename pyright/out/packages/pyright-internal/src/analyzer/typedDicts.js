"use strict";
/*
 * typedDicts.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides special-case logic for the construction of TypedDict
 * classes.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.narrowForKeyAssignment = exports.getTypeOfIndexedTypedDict = exports.assignToTypedDict = exports.assignTypedDictToTypedDict = exports.getEffectiveExtraItemsEntryType = exports.getTypedDictDictEquivalent = exports.getTypedDictMappingEquivalent = exports.getTypedDictMembersForClass = exports.synthesizeTypedDictClassMethods = exports.createTypedDictType = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
const localize_1 = require("../localization/localize");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const symbol_1 = require("./symbol");
const symbolUtils_1 = require("./symbolUtils");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
// Creates a new custom TypedDict "alternate syntax" factory class.
function createTypedDictType(evaluator, errorNode, typedDictClass, argList) {
    var _a, _b, _c;
    const fileInfo = AnalyzerNodeInfo.getFileInfo(errorNode);
    // TypedDict supports two different syntaxes:
    // Point2D = TypedDict('Point2D', {'x': int, 'y': int, 'label': str})
    // Point2D = TypedDict('Point2D', x=int, y=int, label=str)
    let className;
    if (argList.length === 0) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.typedDictFirstArg(), errorNode);
    }
    else {
        const nameArg = argList[0];
        if (nameArg.argumentCategory !== 0 /* ArgumentCategory.Simple */ ||
            !nameArg.valueExpression ||
            nameArg.valueExpression.nodeType !== 48 /* ParseNodeType.StringList */) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.typedDictFirstArg(), argList[0].valueExpression || errorNode);
        }
        else {
            className = nameArg.valueExpression.strings.map((s) => s.value).join('');
        }
    }
    const effectiveClassName = className || 'TypedDict';
    const classType = types_1.ClassType.createInstantiable(effectiveClassName, ParseTreeUtils.getClassFullName(errorNode, fileInfo.moduleName, effectiveClassName), fileInfo.moduleName, fileInfo.fileUri, 4 /* ClassTypeFlags.TypedDictClass */ | 4194304 /* ClassTypeFlags.ValidTypeAliasClass */, ParseTreeUtils.getTypeSourceId(errorNode), 
    /* declaredMetaclass */ undefined, typedDictClass.details.effectiveMetaclass);
    classType.details.baseClasses.push(typedDictClass);
    (0, typeUtils_1.computeMroLinearization)(classType);
    const classFields = types_1.ClassType.getSymbolTable(classType);
    classFields.set('__class__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */ | 64 /* SymbolFlags.IgnoredForProtocolMatch */, classType));
    let usingDictSyntax = false;
    if (argList.length < 2) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.typedDictSecondArgDict(), errorNode);
    }
    else {
        const entriesArg = argList[1];
        if (entriesArg.argumentCategory === 0 /* ArgumentCategory.Simple */ &&
            entriesArg.valueExpression &&
            entriesArg.valueExpression.nodeType === 18 /* ParseNodeType.Dictionary */) {
            usingDictSyntax = true;
            getTypedDictFieldsFromDictSyntax(evaluator, entriesArg.valueExpression, classFields, /* isInline */ false);
        }
        else if (entriesArg.name) {
            const entrySet = new Set();
            for (let i = 1; i < argList.length; i++) {
                const entry = argList[i];
                if (!entry.name || !entry.valueExpression) {
                    continue;
                }
                if (entrySet.has(entry.name.value)) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictEntryUnique(), entry.valueExpression);
                    continue;
                }
                // Record names in a map to detect duplicates.
                entrySet.add(entry.name.value);
                const newSymbol = new symbol_1.Symbol(8 /* SymbolFlags.InstanceMember */);
                const declaration = {
                    type: 1 /* DeclarationType.Variable */,
                    node: entry.name,
                    uri: fileInfo.fileUri,
                    typeAnnotationNode: entry.valueExpression,
                    isRuntimeTypeExpression: true,
                    range: (0, positionUtils_1.convertOffsetsToRange)(entry.name.start, textRange_1.TextRange.getEnd(entry.valueExpression), fileInfo.lines),
                    moduleName: fileInfo.moduleName,
                    isInExceptSuite: false,
                };
                newSymbol.addDeclaration(declaration);
                classFields.set(entry.name.value, newSymbol);
            }
        }
        else {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.typedDictSecondArgDict(), errorNode);
        }
    }
    if (usingDictSyntax) {
        for (const arg of argList.slice(2)) {
            if (((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'total' || ((_b = arg.name) === null || _b === void 0 ? void 0 : _b.value) === 'closed') {
                if (!arg.valueExpression ||
                    arg.valueExpression.nodeType !== 14 /* ParseNodeType.Constant */ ||
                    !(arg.valueExpression.constType === 15 /* KeywordType.False */ ||
                        arg.valueExpression.constType === 33 /* KeywordType.True */)) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictBoolParam().format({ name: arg.name.value }), arg.valueExpression || errorNode);
                }
                else if (arg.name.value === 'total' && arg.valueExpression.constType === 15 /* KeywordType.False */) {
                    classType.details.flags |= 32 /* ClassTypeFlags.CanOmitDictValues */;
                }
                else if (arg.name.value === 'closed' && arg.valueExpression.constType === 33 /* KeywordType.True */) {
                    // This is an experimental feature because PEP 728 hasn't been accepted yet.
                    if (AnalyzerNodeInfo.getFileInfo(errorNode).diagnosticRuleSet.enableExperimentalFeatures) {
                        classType.details.flags |=
                            8 /* ClassTypeFlags.TypedDictMarkedClosed */ | 16 /* ClassTypeFlags.TypedDictEffectivelyClosed */;
                    }
                }
            }
            else {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.typedDictExtraArgs(), arg.valueExpression || errorNode);
            }
        }
    }
    synthesizeTypedDictClassMethods(evaluator, errorNode, classType);
    // Validate that the assigned variable name is consistent with the provided name.
    if (((_c = errorNode.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 3 /* ParseNodeType.Assignment */ && className) {
        const target = errorNode.parent.leftExpression;
        const typedDictTarget = target.nodeType === 54 /* ParseNodeType.TypeAnnotation */ ? target.valueExpression : target;
        if (typedDictTarget.nodeType === 38 /* ParseNodeType.Name */) {
            if (typedDictTarget.value !== className) {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictAssignedName().format({
                    name: className,
                }), typedDictTarget);
            }
        }
    }
    return classType;
}
exports.createTypedDictType = createTypedDictType;
function synthesizeTypedDictClassMethods(evaluator, node, classType) {
    var _a;
    (0, debug_1.assert)(types_1.ClassType.isTypedDictClass(classType));
    // Synthesize a __new__ method.
    const newType = types_1.FunctionType.createSynthesizedInstance('__new__', 1 /* FunctionTypeFlags.ConstructorMethod */);
    types_1.FunctionType.addParameter(newType, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'cls',
        type: classType,
        hasDeclaredType: true,
    });
    types_1.FunctionType.addDefaultParameters(newType);
    newType.details.declaredReturnType = types_1.ClassType.cloneAsInstance(classType);
    newType.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
    // Synthesize an __init__ method with two overrides.
    const initOverride1 = types_1.FunctionType.createSynthesizedInstance('__init__', 256 /* FunctionTypeFlags.Overloaded */);
    types_1.FunctionType.addParameter(initOverride1, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: types_1.ClassType.cloneAsInstance(classType),
        hasDeclaredType: true,
    });
    initOverride1.details.declaredReturnType = evaluator.getNoneType();
    initOverride1.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
    // The first parameter must be positional-only.
    types_1.FunctionType.addParameter(initOverride1, {
        category: 0 /* ParameterCategory.Simple */,
        name: '__map',
        type: types_1.ClassType.cloneAsInstance(classType),
        hasDeclaredType: true,
    });
    types_1.FunctionType.addPositionOnlyParameterSeparator(initOverride1);
    // All subsequent parameters must be named, so insert an empty "*".
    types_1.FunctionType.addKeywordOnlyParameterSeparator(initOverride1);
    const initOverride2 = types_1.FunctionType.createSynthesizedInstance('__init__', 256 /* FunctionTypeFlags.Overloaded */);
    types_1.FunctionType.addParameter(initOverride2, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: types_1.ClassType.cloneAsInstance(classType),
        hasDeclaredType: true,
    });
    initOverride2.details.declaredReturnType = evaluator.getNoneType();
    initOverride2.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
    // All parameters must be named, so insert an empty "*".
    types_1.FunctionType.addKeywordOnlyParameterSeparator(initOverride2);
    const entries = getTypedDictMembersForClass(evaluator, classType);
    const extraEntriesInfo = (_a = entries.extraItems) !== null && _a !== void 0 ? _a : getEffectiveExtraItemsEntryType(evaluator, classType);
    let allEntriesAreReadOnly = entries.knownItems.size > 0;
    entries.knownItems.forEach((entry, name) => {
        types_1.FunctionType.addParameter(initOverride1, {
            category: 0 /* ParameterCategory.Simple */,
            name,
            hasDefault: true,
            type: entry.valueType,
            hasDeclaredType: true,
        });
        types_1.FunctionType.addParameter(initOverride2, {
            category: 0 /* ParameterCategory.Simple */,
            name,
            hasDefault: !entry.isRequired,
            type: entry.valueType,
            hasDeclaredType: true,
        });
        if (!entry.isReadOnly) {
            allEntriesAreReadOnly = false;
        }
    });
    if (entries.extraItems && !(0, types_1.isNever)(entries.extraItems.valueType)) {
        types_1.FunctionType.addParameter(initOverride1, {
            category: 2 /* ParameterCategory.KwargsDict */,
            name: 'kwargs',
            hasDefault: false,
            type: entries.extraItems.valueType,
            hasDeclaredType: true,
        });
        types_1.FunctionType.addParameter(initOverride2, {
            category: 2 /* ParameterCategory.KwargsDict */,
            name: 'kwargs',
            hasDefault: false,
            type: entries.extraItems.valueType,
            hasDeclaredType: true,
        });
    }
    const symbolTable = types_1.ClassType.getSymbolTable(classType);
    const initType = types_1.OverloadedFunctionType.create([initOverride1, initOverride2]);
    symbolTable.set('__init__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, initType));
    symbolTable.set('__new__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, newType));
    const strClass = evaluator.getBuiltInType(node, 'str');
    // Synthesize a "get", pop, and setdefault method for each named entry.
    if ((0, types_1.isInstantiableClass)(strClass)) {
        const selfParam = {
            category: 0 /* ParameterCategory.Simple */,
            name: 'self',
            type: types_1.ClassType.cloneAsInstance(classType),
            hasDeclaredType: true,
        };
        function createDefaultTypeVar(func) {
            let defaultTypeVar = types_1.TypeVarType.createInstance(`__TDefault`);
            defaultTypeVar = types_1.TypeVarType.cloneForScopeId(defaultTypeVar, func.details.typeVarScopeId, classType.details.name, 1 /* TypeVarScopeType.Function */);
            return defaultTypeVar;
        }
        function createGetMethod(keyType, valueType, includeDefault, isEntryRequired = false, defaultTypeMatchesField = false) {
            const getOverload = types_1.FunctionType.createSynthesizedInstance('get', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(getOverload, selfParam);
            getOverload.details.typeVarScopeId = ParseTreeUtils.getScopeIdForNode(node);
            types_1.FunctionType.addParameter(getOverload, {
                category: 0 /* ParameterCategory.Simple */,
                name: 'k',
                type: keyType,
                hasDeclaredType: true,
            });
            if (includeDefault) {
                const defaultTypeVar = createDefaultTypeVar(getOverload);
                let defaultParamType;
                let returnType;
                if (isEntryRequired) {
                    // If the entry is required, the type of the default param doesn't matter
                    // because the type will always come from the value.
                    defaultParamType = types_1.AnyType.create();
                    returnType = valueType;
                }
                else {
                    if (defaultTypeMatchesField) {
                        defaultParamType = valueType;
                    }
                    else {
                        defaultParamType = (0, types_1.combineTypes)([valueType, defaultTypeVar]);
                    }
                    returnType = defaultParamType;
                }
                types_1.FunctionType.addParameter(getOverload, {
                    category: 0 /* ParameterCategory.Simple */,
                    name: 'default',
                    type: defaultParamType,
                    hasDeclaredType: true,
                });
                getOverload.details.declaredReturnType = returnType;
            }
            else {
                getOverload.details.declaredReturnType = isEntryRequired
                    ? valueType
                    : (0, types_1.combineTypes)([valueType, evaluator.getNoneType()]);
            }
            return getOverload;
        }
        function createPopMethods(keyType, valueType, isEntryRequired) {
            const keyParam = {
                category: 0 /* ParameterCategory.Simple */,
                name: 'k',
                type: keyType,
                hasDeclaredType: true,
            };
            const popOverload1 = types_1.FunctionType.createSynthesizedInstance('pop', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(popOverload1, selfParam);
            types_1.FunctionType.addParameter(popOverload1, keyParam);
            popOverload1.details.declaredReturnType = valueType;
            const popOverload2 = types_1.FunctionType.createSynthesizedInstance('pop', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(popOverload2, selfParam);
            types_1.FunctionType.addParameter(popOverload2, keyParam);
            popOverload2.details.typeVarScopeId = ParseTreeUtils.getScopeIdForNode(node);
            const defaultTypeVar = createDefaultTypeVar(popOverload2);
            let defaultParamType;
            let returnType;
            if (isEntryRequired) {
                // If the entry is required, the type of the default param doesn't matter
                // because the type will always come from the value.
                defaultParamType = types_1.AnyType.create();
                returnType = valueType;
            }
            else {
                defaultParamType = (0, types_1.combineTypes)([valueType, defaultTypeVar]);
                returnType = defaultParamType;
            }
            types_1.FunctionType.addParameter(popOverload2, {
                category: 0 /* ParameterCategory.Simple */,
                name: 'default',
                hasDeclaredType: true,
                type: defaultParamType,
                hasDefault: true,
            });
            popOverload2.details.declaredReturnType = returnType;
            return [popOverload1, popOverload2];
        }
        function createSetDefaultMethod(keyType, valueType) {
            const setDefaultOverload = types_1.FunctionType.createSynthesizedInstance('setdefault', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(setDefaultOverload, selfParam);
            types_1.FunctionType.addParameter(setDefaultOverload, {
                category: 0 /* ParameterCategory.Simple */,
                name: 'k',
                hasDeclaredType: true,
                type: keyType,
            });
            types_1.FunctionType.addParameter(setDefaultOverload, {
                category: 0 /* ParameterCategory.Simple */,
                name: 'default',
                hasDeclaredType: true,
                type: valueType,
            });
            setDefaultOverload.details.declaredReturnType = valueType;
            return setDefaultOverload;
        }
        function createDelItemMethod(keyType) {
            const delItemOverload = types_1.FunctionType.createSynthesizedInstance('delitem', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(delItemOverload, selfParam);
            types_1.FunctionType.addParameter(delItemOverload, {
                category: 0 /* ParameterCategory.Simple */,
                name: 'k',
                hasDeclaredType: true,
                type: keyType,
            });
            delItemOverload.details.declaredReturnType = evaluator.getNoneType();
            return delItemOverload;
        }
        function createUpdateMethod() {
            // Overload 1: update(__m: Partial[<writable fields>], /)
            const updateMethod1 = types_1.FunctionType.createSynthesizedInstance('update', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(updateMethod1, selfParam);
            // Overload 2: update(__m: Iterable[tuple[<name>, <type>]], /)
            const updateMethod2 = types_1.FunctionType.createSynthesizedInstance('update', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(updateMethod2, selfParam);
            // Overload 3: update(*, <name>: <type>, ...)
            const updateMethod3 = types_1.FunctionType.createSynthesizedInstance('update', 256 /* FunctionTypeFlags.Overloaded */);
            types_1.FunctionType.addParameter(updateMethod3, selfParam);
            // If all entries are read-only, don't allow updates.
            types_1.FunctionType.addParameter(updateMethod1, {
                category: 0 /* ParameterCategory.Simple */,
                name: '__m',
                hasDeclaredType: true,
                type: allEntriesAreReadOnly
                    ? types_1.NeverType.createNever()
                    : types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForPartialTypedDict(classType)),
            });
            types_1.FunctionType.addPositionOnlyParameterSeparator(updateMethod1);
            types_1.FunctionType.addKeywordOnlyParameterSeparator(updateMethod3);
            updateMethod1.details.declaredReturnType = evaluator.getNoneType();
            updateMethod2.details.declaredReturnType = evaluator.getNoneType();
            updateMethod3.details.declaredReturnType = evaluator.getNoneType();
            const tuplesToCombine = [];
            const tupleClass = evaluator.getBuiltInType(node, 'tuple');
            entries.knownItems.forEach((entry, name) => {
                if (!entry.isReadOnly) {
                    // For writable entries, add a tuple entry.
                    if (tupleClass && (0, types_1.isInstantiableClass)(tupleClass) && strClass && (0, types_1.isInstantiableClass)(strClass)) {
                        const tupleType = (0, typeUtils_1.specializeTupleClass)(types_1.ClassType.cloneAsInstance(tupleClass), [
                            {
                                type: types_1.ClassType.cloneWithLiteral(types_1.ClassType.cloneAsInstance(strClass), name),
                                isUnbounded: false,
                            },
                            { type: entry.valueType, isUnbounded: false },
                        ]);
                        tuplesToCombine.push(tupleType);
                    }
                    // For writable entries, add a keyword argument.
                    types_1.FunctionType.addParameter(updateMethod3, {
                        category: 0 /* ParameterCategory.Simple */,
                        name,
                        hasDeclaredType: true,
                        hasDefault: true,
                        defaultType: types_1.AnyType.create(/* isEllipsis */ true),
                        type: entry.valueType,
                    });
                }
            });
            const iterableClass = evaluator.getTypingType(node, 'Iterable');
            if (iterableClass && (0, types_1.isInstantiableClass)(iterableClass)) {
                const iterableType = types_1.ClassType.cloneAsInstance(iterableClass);
                types_1.FunctionType.addParameter(updateMethod2, {
                    category: 0 /* ParameterCategory.Simple */,
                    name: '__m',
                    hasDeclaredType: true,
                    type: types_1.ClassType.cloneForSpecialization(iterableType, [(0, types_1.combineTypes)(tuplesToCombine)], 
                    /* isTypeArgumentExplicit */ true),
                });
            }
            types_1.FunctionType.addPositionOnlyParameterSeparator(updateMethod2);
            // Note that the order of method1 and method2 is swapped. This is done so
            // the method1 signature is used in the error message when neither method2
            // or method1 match.
            return types_1.OverloadedFunctionType.create([updateMethod2, updateMethod1, updateMethod3]);
        }
        const getOverloads = [];
        const popOverloads = [];
        const setDefaultOverloads = [];
        entries.knownItems.forEach((entry, name) => {
            const nameLiteralType = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneWithLiteral(strClass, name));
            getOverloads.push(createGetMethod(nameLiteralType, entry.valueType, /* includeDefault */ false, entry.isRequired));
            getOverloads.push(createGetMethod(nameLiteralType, entry.valueType, 
            /* includeDefault */ true, 
            /* isEntryRequired */ entry.isRequired, 
            /* defaultTypeMatchesField */ entry.isRequired));
            // Add a pop method if the entry is not required.
            if (!entry.isRequired && !entry.isReadOnly) {
                (0, collectionUtils_1.appendArray)(popOverloads, createPopMethods(nameLiteralType, entry.valueType, entry.isRequired));
            }
            if (!entry.isReadOnly) {
                setDefaultOverloads.push(createSetDefaultMethod(nameLiteralType, entry.valueType));
            }
        });
        const strType = types_1.ClassType.cloneAsInstance(strClass);
        // If the class is closed, we can assume that any other keys that
        // are present will return the default parameter value or the extra
        // entries value type.
        if (types_1.ClassType.isTypedDictEffectivelyClosed(classType)) {
            getOverloads.push(createGetMethod(strType, (0, types_1.combineTypes)([extraEntriesInfo.valueType, evaluator.getNoneType()]), 
            /* includeDefault */ false, 
            /* isEntryRequired */ true));
            getOverloads.push(createGetMethod(strType, extraEntriesInfo.valueType, /* includeDefault */ true));
        }
        else {
            // Provide a final `get` overload that handles the general case where
            // the key is a str but the literal value isn't known.
            getOverloads.push(createGetMethod(strType, types_1.AnyType.create(), /* includeDefault */ false));
            getOverloads.push(createGetMethod(strType, types_1.AnyType.create(), /* includeDefault */ true));
        }
        symbolTable.set('get', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, types_1.OverloadedFunctionType.create(getOverloads)));
        if (popOverloads.length > 0) {
            symbolTable.set('pop', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, types_1.OverloadedFunctionType.create(popOverloads)));
        }
        if (setDefaultOverloads.length > 0) {
            symbolTable.set('setdefault', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, types_1.OverloadedFunctionType.create(setDefaultOverloads)));
        }
        if (!allEntriesAreReadOnly) {
            symbolTable.set('__delitem__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, createDelItemMethod(strType)));
        }
        symbolTable.set('update', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, createUpdateMethod()));
        // If the TypedDict is closed and all of its entries are NotRequired and
        // not ReadOnly, add a "clear" and "popitem" method.
        const dictValueType = getTypedDictDictEquivalent(evaluator, classType);
        if (dictValueType) {
            const clearMethod = types_1.FunctionType.createSynthesizedInstance('clear');
            types_1.FunctionType.addParameter(clearMethod, selfParam);
            clearMethod.details.declaredReturnType = evaluator.getNoneType();
            symbolTable.set('clear', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, clearMethod));
            const popItemMethod = types_1.FunctionType.createSynthesizedInstance('popitem');
            types_1.FunctionType.addParameter(popItemMethod, selfParam);
            let tupleType = evaluator.getTupleClassType();
            if (tupleType && (0, types_1.isInstantiableClass)(tupleType)) {
                tupleType = (0, typeUtils_1.specializeTupleClass)(types_1.ClassType.cloneAsInstance(tupleType), [
                    { type: strType, isUnbounded: false },
                    { type: dictValueType, isUnbounded: false },
                ], 
                /* isTypeArgumentExplicit */ true);
            }
            else {
                tupleType = types_1.UnknownType.create();
            }
            popItemMethod.details.declaredReturnType = tupleType;
            symbolTable.set('popitem', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, popItemMethod));
        }
        // If the TypedDict is closed, we can provide a more accurate value type
        // for the "items", "keys" and "values" methods.
        const mappingValueType = getTypedDictMappingEquivalent(evaluator, classType);
        if (mappingValueType) {
            ['items', 'keys', 'values'].forEach((methodName) => {
                const method = types_1.FunctionType.createSynthesizedInstance(methodName);
                types_1.FunctionType.addParameter(method, selfParam);
                const returnTypeClass = evaluator.getTypingType(node, `dict_${methodName}`);
                if (returnTypeClass &&
                    (0, types_1.isInstantiableClass)(returnTypeClass) &&
                    returnTypeClass.details.typeParameters.length === 2) {
                    method.details.declaredReturnType = types_1.ClassType.cloneForSpecialization(types_1.ClassType.cloneAsInstance(returnTypeClass), [strType, mappingValueType], 
                    /* isTypeArgumentExplicit */ true);
                    symbolTable.set(methodName, symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, method));
                }
            });
        }
    }
}
exports.synthesizeTypedDictClassMethods = synthesizeTypedDictClassMethods;
function getTypedDictMembersForClass(evaluator, classType, allowNarrowed = false) {
    var _a;
    // Were the entries already calculated and cached?
    if (!classType.details.typedDictEntries) {
        const entries = {
            knownItems: new Map(),
            extraItems: undefined,
        };
        getTypedDictMembersForClassRecursive(evaluator, classType, entries);
        if (types_1.ClassType.isTypedDictMarkedClosed(classType) && !entries.extraItems) {
            entries.extraItems = {
                valueType: types_1.NeverType.createNever(),
                isReadOnly: false,
                isRequired: false,
                isProvided: false,
            };
        }
        // Cache the entries for next time.
        classType.details.typedDictEntries = entries;
    }
    const typeVarContext = (0, typeUtils_1.buildTypeVarContextFromSpecializedClass)(classType);
    // Create a specialized copy of the entries so the caller can mutate them.
    const entries = new Map();
    classType.details.typedDictEntries.knownItems.forEach((value, key) => {
        const tdEntry = { ...value };
        tdEntry.valueType = (0, typeUtils_1.applySolvedTypeVars)(tdEntry.valueType, typeVarContext);
        // If the class is "Partial", make all entries optional and convert all
        // read-only entries to Never.
        if (classType.isTypedDictPartial) {
            tdEntry.isRequired = false;
            if (tdEntry.isReadOnly) {
                tdEntry.valueType = types_1.NeverType.createNever();
            }
            else {
                tdEntry.isReadOnly = true;
            }
        }
        entries.set(key, tdEntry);
    });
    // Apply narrowed types on top of existing entries if present.
    if (allowNarrowed && classType.typedDictNarrowedEntries) {
        classType.typedDictNarrowedEntries.forEach((value, key) => {
            const tdEntry = { ...value };
            tdEntry.valueType = (0, typeUtils_1.applySolvedTypeVars)(tdEntry.valueType, typeVarContext);
            entries.set(key, tdEntry);
        });
    }
    return {
        knownItems: entries,
        extraItems: (_a = classType.details.typedDictEntries) === null || _a === void 0 ? void 0 : _a.extraItems,
    };
}
exports.getTypedDictMembersForClass = getTypedDictMembersForClass;
// If the TypedDict class is consistent with Mapping[str, T] where T
// is some type other than object, it returns T. Otherwise it returns undefined.
function getTypedDictMappingEquivalent(evaluator, classType) {
    (0, debug_1.assert)((0, types_1.isInstantiableClass)(classType));
    (0, debug_1.assert)(types_1.ClassType.isTypedDictClass(classType));
    // If the TypedDict class isn't closed, it's just a normal Mapping[str, object].
    if (!types_1.ClassType.isTypedDictEffectivelyClosed(classType)) {
        return undefined;
    }
    const entries = getTypedDictMembersForClass(evaluator, classType);
    const typesToCombine = [];
    entries.knownItems.forEach((entry) => {
        typesToCombine.push(entry.valueType);
    });
    if (entries.extraItems) {
        typesToCombine.push(entries.extraItems.valueType);
    }
    // Is the final value type 'object'?
    const valueType = (0, types_1.combineTypes)(typesToCombine);
    if ((0, types_1.isClassInstance)(valueType) && types_1.ClassType.isBuiltIn(valueType, 'object')) {
        return undefined;
    }
    return valueType;
}
exports.getTypedDictMappingEquivalent = getTypedDictMappingEquivalent;
// If the TypedDict class is consistent with dict[str, T], it returns T.
// Otherwise it returns undefined.
function getTypedDictDictEquivalent(evaluator, classType, recursionCount = 0) {
    (0, debug_1.assert)((0, types_1.isInstantiableClass)(classType));
    (0, debug_1.assert)(types_1.ClassType.isTypedDictClass(classType));
    // If the TypedDict class isn't closed, it's not equivalent to a dict.
    if (!types_1.ClassType.isTypedDictEffectivelyClosed(classType)) {
        return undefined;
    }
    const entries = getTypedDictMembersForClass(evaluator, classType);
    // If there is no "extraItems" defined or it is read-only, it's not
    // equivalent to a dict.
    if (!entries.extraItems || entries.extraItems.isReadOnly) {
        return undefined;
    }
    let dictValueType = entries.extraItems.valueType;
    let isEquivalentToDict = true;
    entries.knownItems.forEach((entry) => {
        if (entry.isReadOnly || entry.isRequired) {
            isEquivalentToDict = false;
        }
        dictValueType = (0, types_1.combineTypes)([dictValueType, entry.valueType]);
        if (!evaluator.assignType(dictValueType, entry.valueType, 
        /* diag */ undefined, 
        /* destTypeVarContext */ undefined, 
        /* srcTypeVarContext */ undefined, 1 /* AssignTypeFlags.EnforceInvariance */, recursionCount + 1)) {
            isEquivalentToDict = false;
        }
    });
    if (!isEquivalentToDict) {
        return undefined;
    }
    return dictValueType;
}
exports.getTypedDictDictEquivalent = getTypedDictDictEquivalent;
function getTypedDictFieldsFromDictSyntax(evaluator, entryDict, classFields, isInline) {
    const entrySet = new Set();
    const fileInfo = AnalyzerNodeInfo.getFileInfo(entryDict);
    entryDict.entries.forEach((entry) => {
        if (entry.nodeType !== 20 /* ParseNodeType.DictionaryKeyEntry */) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictSecondArgDictEntry(), entry);
            return;
        }
        if (entry.keyExpression.nodeType !== 48 /* ParseNodeType.StringList */) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictEntryName(), entry.keyExpression);
            return;
        }
        const entryName = entry.keyExpression.strings.map((s) => s.value).join('');
        if (!entryName) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictEmptyName(), entry.keyExpression);
            return;
        }
        if (entrySet.has(entryName)) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictEntryUnique(), entry.keyExpression);
            return;
        }
        // Record names in a set to detect duplicates.
        entrySet.add(entryName);
        const newSymbol = new symbol_1.Symbol(8 /* SymbolFlags.InstanceMember */);
        const declaration = {
            type: 1 /* DeclarationType.Variable */,
            node: entry.keyExpression,
            uri: fileInfo.fileUri,
            typeAnnotationNode: entry.valueExpression,
            isRuntimeTypeExpression: !isInline,
            range: (0, positionUtils_1.convertOffsetsToRange)(entry.keyExpression.start, textRange_1.TextRange.getEnd(entry.keyExpression), fileInfo.lines),
            moduleName: fileInfo.moduleName,
            isInExceptSuite: false,
        };
        newSymbol.addDeclaration(declaration);
        classFields.set(entryName, newSymbol);
    });
    // Set the type in the type cache for the dict node so it doesn't
    // get evaluated again.
    evaluator.setTypeResultForNode(entryDict, { type: types_1.UnknownType.create() });
}
function getTypedDictMembersForClassRecursive(evaluator, classType, entries, recursionCount = 0) {
    (0, debug_1.assert)(types_1.ClassType.isTypedDictClass(classType));
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return;
    }
    recursionCount++;
    classType.details.baseClasses.forEach((baseClassType) => {
        if ((0, types_1.isInstantiableClass)(baseClassType) && types_1.ClassType.isTypedDictClass(baseClassType)) {
            const specializedBaseClassType = (0, typeUtils_1.partiallySpecializeType)(baseClassType, classType);
            (0, debug_1.assert)((0, types_1.isClass)(specializedBaseClassType));
            // Recursively gather keys from parent classes. Don't report any errors
            // in these cases because they will be reported within that class.
            getTypedDictMembersForClassRecursive(evaluator, specializedBaseClassType, entries, recursionCount);
        }
    });
    const typeVarContext = (0, typeUtils_1.buildTypeVarContextFromSpecializedClass)(classType);
    // Add any new typed dict entries from this class.
    types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
        if (!symbol.isIgnoredForProtocolMatch()) {
            // Only variables (not functions, classes, etc.) are considered.
            const lastDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(symbol);
            if (lastDecl && lastDecl.type === 1 /* DeclarationType.Variable */) {
                let valueType = evaluator.getEffectiveTypeOfSymbol(symbol);
                valueType = (0, typeUtils_1.applySolvedTypeVars)(valueType, typeVarContext);
                const allowRequired = !types_1.ClassType.isTypedDictMarkedClosed(classType) || name !== '__extra_items__';
                let isRequired = !types_1.ClassType.isCanOmitDictValues(classType);
                let isReadOnly = false;
                if (isRequiredTypedDictVariable(evaluator, symbol, allowRequired)) {
                    isRequired = true;
                }
                else if (isNotRequiredTypedDictVariable(evaluator, symbol, allowRequired)) {
                    isRequired = false;
                }
                if (isReadOnlyTypedDictVariable(evaluator, symbol)) {
                    isReadOnly = true;
                }
                const tdEntry = {
                    valueType,
                    isReadOnly,
                    isRequired,
                    isProvided: false,
                };
                if (types_1.ClassType.isTypedDictMarkedClosed(classType) && name === '__extra_items__') {
                    tdEntry.isRequired = false;
                    entries.extraItems = tdEntry;
                }
                else {
                    entries.knownItems.set(name, tdEntry);
                }
            }
        }
    });
}
function getEffectiveExtraItemsEntryType(evaluator, classType) {
    var _a;
    (0, debug_1.assert)(types_1.ClassType.isTypedDictClass(classType));
    // Missing entries in a non-closed TypedDict class are implicitly typed as
    // ReadOnly[NotRequired[object]].
    if (!types_1.ClassType.isTypedDictMarkedClosed(classType)) {
        return {
            valueType: evaluator.getObjectType(),
            isReadOnly: true,
            isRequired: false,
            isProvided: false,
        };
    }
    if ((_a = classType.details.typedDictEntries) === null || _a === void 0 ? void 0 : _a.extraItems) {
        return classType.details.typedDictEntries.extraItems;
    }
    return {
        valueType: types_1.NeverType.createNever(),
        isReadOnly: true,
        isRequired: false,
        isProvided: false,
    };
}
exports.getEffectiveExtraItemsEntryType = getEffectiveExtraItemsEntryType;
function assignTypedDictToTypedDict(evaluator, destType, srcType, diag, typeVarContext, flags, recursionCount = 0) {
    var _a, _b;
    let typesAreConsistent = true;
    const destEntries = getTypedDictMembersForClass(evaluator, destType);
    const srcEntries = getTypedDictMembersForClass(evaluator, srcType, /* allowNarrowed */ true);
    const extraSrcEntries = (_a = srcEntries.extraItems) !== null && _a !== void 0 ? _a : getEffectiveExtraItemsEntryType(evaluator, srcType);
    destEntries.knownItems.forEach((destEntry, name) => {
        // If we've already determined that the types are inconsistent and
        // the caller isn't interested in detailed diagnostics, skip the remainder.
        if (!typesAreConsistent && !diag) {
            return;
        }
        const srcEntry = srcEntries.knownItems.get(name);
        if (!srcEntry) {
            if (destEntry.isRequired || !destEntry.isReadOnly) {
                diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(localize_1.LocAddendum.typedDictFieldMissing().format({
                    name,
                    type: evaluator.printType(types_1.ClassType.cloneAsInstance(srcType)),
                }));
                typesAreConsistent = false;
            }
            else {
                if ((0, types_1.isClassInstance)(extraSrcEntries.valueType)) {
                    const subDiag = diag === null || diag === void 0 ? void 0 : diag.createAddendum();
                    if (!evaluator.assignType(destEntry.valueType, extraSrcEntries.valueType, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), typeVarContext, 
                    /* srcTypeVarContext */ undefined, flags, recursionCount)) {
                        subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.memberTypeMismatch().format({ name }));
                        typesAreConsistent = false;
                    }
                }
            }
        }
        else {
            if (destEntry.isRequired !== srcEntry.isRequired && !destEntry.isReadOnly) {
                const message = destEntry.isRequired
                    ? localize_1.LocAddendum.typedDictFieldRequired()
                    : localize_1.LocAddendum.typedDictFieldNotRequired();
                diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(message.format({
                    name,
                    type: evaluator.printType(types_1.ClassType.cloneAsInstance(destType)),
                }));
                typesAreConsistent = false;
            }
            if (!destEntry.isReadOnly && srcEntry.isReadOnly) {
                diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(localize_1.LocAddendum.typedDictFieldNotReadOnly().format({
                    name,
                    type: evaluator.printType(types_1.ClassType.cloneAsInstance(destType)),
                }));
                typesAreConsistent = false;
            }
            const subDiag = diag === null || diag === void 0 ? void 0 : diag.createAddendum();
            if (!evaluator.assignType(destEntry.valueType, srcEntry.valueType, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), typeVarContext, 
            /* srcTypeVarContext */ undefined, destEntry.isReadOnly ? flags : flags | 1 /* AssignTypeFlags.EnforceInvariance */, recursionCount)) {
                subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.memberTypeMismatch().format({ name }));
                typesAreConsistent = false;
            }
        }
    });
    // If the types are not consistent and the caller isn't interested
    // in detailed diagnostics, don't do additional work.
    if (!typesAreConsistent && !diag) {
        return false;
    }
    // If the destination TypedDict is closed, check any extra entries in the source
    // TypedDict to ensure that they don't violate the "extra items" type.
    if (types_1.ClassType.isTypedDictEffectivelyClosed(destType)) {
        const extraDestEntries = (_b = destEntries.extraItems) !== null && _b !== void 0 ? _b : getEffectiveExtraItemsEntryType(evaluator, destType);
        srcEntries.knownItems.forEach((srcEntry, name) => {
            // Have we already checked this item in the loop above?
            if (destEntries.knownItems.has(name)) {
                return;
            }
            if (!destEntries.extraItems) {
                const subDiag = diag === null || diag === void 0 ? void 0 : diag.createAddendum();
                subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.typedDictExtraFieldNotAllowed().format({
                    name,
                    type: evaluator.printType(types_1.ClassType.cloneAsInstance(destType)),
                }));
                typesAreConsistent = false;
            }
            else {
                if (srcEntry.isRequired && !destEntries.extraItems.isReadOnly) {
                    diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(localize_1.LocAddendum.typedDictFieldNotRequired().format({
                        name,
                        type: evaluator.printType(types_1.ClassType.cloneAsInstance(destType)),
                    }));
                    typesAreConsistent = false;
                }
                const subDiag = diag === null || diag === void 0 ? void 0 : diag.createAddendum();
                if (!evaluator.assignType(destEntries.extraItems.valueType, srcEntry.valueType, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), typeVarContext, 
                /* srcTypeVarContext */ undefined, destEntries.extraItems.isReadOnly ? flags : flags | 1 /* AssignTypeFlags.EnforceInvariance */, recursionCount)) {
                    subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.typedDictExtraFieldTypeMismatch().format({
                        name,
                        type: evaluator.printType(types_1.ClassType.cloneAsInstance(destType)),
                    }));
                    typesAreConsistent = false;
                }
                else if (!destEntries.extraItems.isReadOnly && srcEntry.isReadOnly) {
                    diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(localize_1.LocAddendum.typedDictFieldNotReadOnly().format({
                        name,
                        type: evaluator.printType(types_1.ClassType.cloneAsInstance(srcType)),
                    }));
                    typesAreConsistent = false;
                }
            }
        });
        const subDiag = diag === null || diag === void 0 ? void 0 : diag.createAddendum();
        if (!evaluator.assignType(extraDestEntries.valueType, extraSrcEntries.valueType, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), typeVarContext, 
        /* srcTypeVarContext */ undefined, extraDestEntries.isReadOnly ? flags : flags | 1 /* AssignTypeFlags.EnforceInvariance */, recursionCount)) {
            subDiag === null || subDiag === void 0 ? void 0 : subDiag.addMessage(localize_1.LocAddendum.typedDictExtraFieldTypeMismatch().format({
                name: '__extra_items__',
                type: evaluator.printType(types_1.ClassType.cloneAsInstance(srcType)),
            }));
            typesAreConsistent = false;
        }
        else if (!extraDestEntries.isReadOnly && extraSrcEntries.isReadOnly) {
            diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(localize_1.LocAddendum.typedDictFieldNotReadOnly().format({
                name: '__extra_items__',
                type: evaluator.printType(types_1.ClassType.cloneAsInstance(destType)),
            }));
            typesAreConsistent = false;
        }
    }
    return typesAreConsistent;
}
exports.assignTypedDictToTypedDict = assignTypedDictToTypedDict;
// Determines whether the specified keys and values can be assigned to
// a typed dictionary class. The caller should have already validated
// that the class is indeed a typed dict. If the types are compatible,
// the typed dict class or a narrowed form of the class is returned.
// Narrowing is possible when not-required keys are provided. If the
// types are not compatible, the function returns undefined.
function assignToTypedDict(evaluator, classType, keyTypes, valueTypes, diagAddendum) {
    (0, debug_1.assert)((0, types_1.isClassInstance)(classType));
    (0, debug_1.assert)(types_1.ClassType.isTypedDictClass(classType));
    (0, debug_1.assert)(keyTypes.length === valueTypes.length);
    let isMatch = true;
    const narrowedEntries = new Map();
    let typeVarContext;
    let genericClassType = classType;
    if (classType.details.typeParameters.length > 0) {
        typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(classType));
        // Create a generic (nonspecialized version) of the class.
        if (classType.typeArguments) {
            genericClassType = types_1.ClassType.cloneForSpecialization(classType, 
            /* typeArguments */ undefined, 
            /* isTypeArgumentExplicit */ false);
        }
    }
    const tdEntries = getTypedDictMembersForClass(evaluator, genericClassType);
    keyTypes.forEach((keyTypeResult, index) => {
        const keyType = keyTypeResult.type;
        if (!(0, types_1.isClassInstance)(keyType) || !types_1.ClassType.isBuiltIn(keyType, 'str') || !(0, typeUtils_1.isLiteralType)(keyType)) {
            isMatch = false;
        }
        else {
            const keyValue = keyType.literalValue;
            const symbolEntry = tdEntries.knownItems.get(keyValue);
            if (!symbolEntry) {
                if (tdEntries.extraItems) {
                    const subDiag = diagAddendum === null || diagAddendum === void 0 ? void 0 : diagAddendum.createAddendum();
                    if (!evaluator.assignType(tdEntries.extraItems.valueType, valueTypes[index].type, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), typeVarContext, 
                    /* srcTypeVarContext */ undefined, 256 /* AssignTypeFlags.RetainLiteralsForTypeVar */)) {
                        if (subDiag) {
                            subDiag.addMessage(localize_1.LocAddendum.typedDictFieldTypeMismatch().format({
                                name: '__extra_items__',
                                type: evaluator.printType(valueTypes[index].type),
                            }));
                            subDiag.addTextRange(keyTypeResult.node);
                        }
                        isMatch = false;
                    }
                }
                else {
                    // The provided key name doesn't exist.
                    isMatch = false;
                    if (diagAddendum) {
                        const subDiag = diagAddendum === null || diagAddendum === void 0 ? void 0 : diagAddendum.createAddendum();
                        subDiag.addMessage(localize_1.LocAddendum.typedDictFieldUndefined().format({
                            name: keyType.literalValue,
                            type: evaluator.printType(types_1.ClassType.cloneAsInstance(classType)),
                        }));
                        subDiag.addTextRange(keyTypeResult.node);
                    }
                }
            }
            else {
                // Can we assign the value to the declared type?
                const subDiag = diagAddendum === null || diagAddendum === void 0 ? void 0 : diagAddendum.createAddendum();
                if (!evaluator.assignType(symbolEntry.valueType, valueTypes[index].type, subDiag === null || subDiag === void 0 ? void 0 : subDiag.createAddendum(), typeVarContext, 
                /* srcTypeVarContext */ undefined, 256 /* AssignTypeFlags.RetainLiteralsForTypeVar */)) {
                    if (subDiag) {
                        subDiag.addMessage(localize_1.LocAddendum.typedDictFieldTypeMismatch().format({
                            name: keyType.literalValue,
                            type: evaluator.printType(valueTypes[index].type),
                        }));
                        subDiag.addTextRange(keyTypeResult.node);
                    }
                    isMatch = false;
                }
                if (!symbolEntry.isRequired) {
                    narrowedEntries.set(keyValue, {
                        valueType: valueTypes[index].type,
                        isReadOnly: !!valueTypes[index].isReadOnly,
                        isRequired: false,
                        isProvided: true,
                    });
                }
                symbolEntry.isProvided = true;
            }
        }
    });
    if (!isMatch) {
        return undefined;
    }
    // See if any required keys are missing.
    tdEntries.knownItems.forEach((entry, name) => {
        if (entry.isRequired && !entry.isProvided) {
            if (diagAddendum) {
                diagAddendum.addMessage(localize_1.LocAddendum.typedDictFieldRequired().format({
                    name,
                    type: evaluator.printType(classType),
                }));
            }
            isMatch = false;
        }
    });
    if (!isMatch) {
        return undefined;
    }
    const specializedClassType = typeVarContext
        ? (0, typeUtils_1.applySolvedTypeVars)(genericClassType, typeVarContext)
        : classType;
    return narrowedEntries.size === 0
        ? specializedClassType
        : types_1.ClassType.cloneForNarrowedTypedDictEntries(specializedClassType, narrowedEntries);
}
exports.assignToTypedDict = assignToTypedDict;
function getTypeOfIndexedTypedDict(evaluator, node, baseType, usage) {
    if (node.items.length !== 1) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typeArgsMismatchOne().format({ received: node.items.length }), node);
        return { type: types_1.UnknownType.create() };
    }
    // Look for subscript types that are not supported by TypedDict.
    if (node.trailingComma || node.items[0].name || node.items[0].argumentCategory !== 0 /* ArgumentCategory.Simple */) {
        return undefined;
    }
    const entries = getTypedDictMembersForClass(evaluator, baseType, /* allowNarrowed */ usage.method === 'get');
    const indexTypeResult = evaluator.getTypeOfExpression(node.items[0].valueExpression);
    const indexType = indexTypeResult.type;
    let diag = new diagnostic_1.DiagnosticAddendum();
    let allDiagsInvolveNotRequiredKeys = true;
    const resultingType = (0, typeUtils_1.mapSubtypes)(indexType, (subtype) => {
        var _a, _b, _c;
        if ((0, types_1.isAnyOrUnknown)(subtype)) {
            return subtype;
        }
        if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isBuiltIn(subtype, 'str')) {
            if (subtype.literalValue === undefined) {
                // If it's a plain str with no literal value, we can't
                // make any determination about the resulting type.
                return types_1.UnknownType.create();
            }
            // Look up the entry in the typed dict to get its type.
            const entryName = subtype.literalValue;
            const entry = (_a = entries.knownItems.get(entryName)) !== null && _a !== void 0 ? _a : entries.extraItems;
            if (!entry) {
                diag.addMessage(localize_1.LocAddendum.keyUndefined().format({
                    name: entryName,
                    type: evaluator.printType(baseType),
                }));
                allDiagsInvolveNotRequiredKeys = false;
                return types_1.UnknownType.create();
            }
            else if (!(entry.isRequired || entry.isProvided) && usage.method === 'get') {
                diag.addMessage(localize_1.LocAddendum.keyNotRequired().format({
                    name: entryName,
                    type: evaluator.printType(baseType),
                }));
            }
            else if (entry.isReadOnly && usage.method !== 'get') {
                diag.addMessage(localize_1.LocAddendum.keyReadOnly().format({
                    name: entryName,
                    type: evaluator.printType(baseType),
                }));
            }
            if (usage.method === 'set') {
                if (!evaluator.assignType(entry.valueType, (_c = (_b = usage.setType) === null || _b === void 0 ? void 0 : _b.type) !== null && _c !== void 0 ? _c : types_1.AnyType.create(), diag)) {
                    allDiagsInvolveNotRequiredKeys = false;
                }
            }
            else if (usage.method === 'del' && entry.isRequired) {
                diag.addMessage(localize_1.LocAddendum.keyRequiredDeleted().format({
                    name: entryName,
                }));
                allDiagsInvolveNotRequiredKeys = false;
            }
            return entry.valueType;
        }
        diag.addMessage(localize_1.LocAddendum.typeNotStringLiteral().format({ type: evaluator.printType(subtype) }));
        allDiagsInvolveNotRequiredKeys = false;
        return types_1.UnknownType.create();
    });
    // If we have an "expected type" diagnostic addendum (used for assignments),
    // use that rather than the local diagnostic information because it will
    // be more informative.
    if (usage.setExpectedTypeDiag && !diag.isEmpty() && !usage.setExpectedTypeDiag.isEmpty()) {
        diag = usage.setExpectedTypeDiag;
    }
    if (!diag.isEmpty()) {
        let typedDictDiag;
        if (usage.method === 'set') {
            typedDictDiag = localize_1.LocMessage.typedDictSet();
        }
        else if (usage.method === 'del') {
            typedDictDiag = localize_1.LocMessage.typedDictDelete();
        }
        else {
            typedDictDiag = localize_1.LocMessage.typedDictAccess();
        }
        evaluator.addDiagnostic(allDiagsInvolveNotRequiredKeys
            ? diagnosticRules_1.DiagnosticRule.reportTypedDictNotRequiredAccess
            : diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, typedDictDiag + diag.getString(), node);
    }
    return { type: resultingType, isIncomplete: !!indexTypeResult.isIncomplete };
}
exports.getTypeOfIndexedTypedDict = getTypeOfIndexedTypedDict;
// If the specified type has a non-required key, this method marks the
// key as present.
function narrowForKeyAssignment(classType, key) {
    var _a;
    // We should never be called if the classType is not a TypedDict or if typedDictEntries
    // is empty, but this can theoretically happen in the presence of certain circular
    // dependencies.
    if (!types_1.ClassType.isTypedDictClass(classType) || !classType.details.typedDictEntries) {
        return classType;
    }
    const tdEntry = classType.details.typedDictEntries.knownItems.get(key);
    if (!tdEntry || tdEntry.isRequired) {
        return classType;
    }
    const narrowedTdEntry = (_a = classType.typedDictNarrowedEntries) === null || _a === void 0 ? void 0 : _a.get(key);
    if (narrowedTdEntry === null || narrowedTdEntry === void 0 ? void 0 : narrowedTdEntry.isProvided) {
        return classType;
    }
    const narrowedEntries = classType.typedDictNarrowedEntries
        ? new Map(classType.typedDictNarrowedEntries)
        : new Map();
    narrowedEntries.set(key, {
        isProvided: true,
        isRequired: false,
        isReadOnly: tdEntry.isReadOnly,
        valueType: tdEntry.valueType,
    });
    return types_1.ClassType.cloneForNarrowedTypedDictEntries(classType, narrowedEntries);
}
exports.narrowForKeyAssignment = narrowForKeyAssignment;
function isRequiredTypedDictVariable(evaluator, symbol, allowRequired) {
    return symbol.getDeclarations().some((decl) => {
        if (decl.type !== 1 /* DeclarationType.Variable */ || !decl.typeAnnotationNode) {
            return false;
        }
        const annotatedType = evaluator.getTypeOfExpressionExpectingType(decl.typeAnnotationNode, {
            allowFinal: true,
            allowRequired: true,
        });
        if (!allowRequired) {
            if (annotatedType.isRequired) {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.requiredNotInTypedDict(), decl.typeAnnotationNode);
            }
            return false;
        }
        return !!annotatedType.isRequired;
    });
}
function isNotRequiredTypedDictVariable(evaluator, symbol, allowRequired) {
    return symbol.getDeclarations().some((decl) => {
        if (decl.type !== 1 /* DeclarationType.Variable */ || !decl.typeAnnotationNode) {
            return false;
        }
        const annotatedType = evaluator.getTypeOfExpressionExpectingType(decl.typeAnnotationNode, {
            allowFinal: true,
            allowRequired: true,
        });
        if (!allowRequired) {
            if (annotatedType.isNotRequired) {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.notRequiredNotInTypedDict(), decl.typeAnnotationNode);
            }
            return false;
        }
        return !!annotatedType.isNotRequired;
    });
}
function isReadOnlyTypedDictVariable(evaluator, symbol) {
    return symbol.getDeclarations().some((decl) => {
        if (decl.type !== 1 /* DeclarationType.Variable */ || !decl.typeAnnotationNode) {
            return false;
        }
        const annotatedType = evaluator.getTypeOfExpressionExpectingType(decl.typeAnnotationNode, {
            allowFinal: true,
            allowRequired: true,
        });
        return !!annotatedType.isReadOnly;
    });
}
//# sourceMappingURL=typedDicts.js.map