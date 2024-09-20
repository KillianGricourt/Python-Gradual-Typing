"use strict";
/*
 * namedTuples.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides special-case logic for the construction of named tuple
 * classes with defined entry names and types.
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
exports.updateNamedTupleBaseClass = exports.createNamedTupleType = void 0;
const diagnosticRules_1 = require("../common/diagnosticRules");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
const localize_1 = require("../localization/localize");
const tokenizer_1 = require("../parser/tokenizer");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const staticExpressions_1 = require("./staticExpressions");
const symbol_1 = require("./symbol");
const typeUtils_1 = require("./typeUtils");
const types_1 = require("./types");
// Creates a new custom tuple factory class with named values.
// Supports both typed and untyped variants.
function createNamedTupleType(evaluator, errorNode, argList, includesTypes) {
    var _a, _b, _c;
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(errorNode);
    let className = 'namedtuple';
    // The "rename" parameter is supported only in the untyped version.
    let allowRename = false;
    if (!includesTypes) {
        const renameArg = argList.find((arg) => { var _a; return arg.argumentCategory === 0 /* ArgumentCategory.Simple */ && ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'rename'; });
        if (renameArg === null || renameArg === void 0 ? void 0 : renameArg.valueExpression) {
            const renameValue = (0, staticExpressions_1.evaluateStaticBoolExpression)(renameArg.valueExpression, fileInfo.executionEnvironment, fileInfo.definedConstants);
            if (renameValue === true) {
                allowRename = true;
            }
        }
    }
    if (argList.length === 0) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.namedTupleFirstArg(), errorNode);
    }
    else {
        const nameArg = argList[0];
        if (nameArg.argumentCategory !== 0 /* ArgumentCategory.Simple */) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.namedTupleFirstArg(), argList[0].valueExpression || errorNode);
        }
        else if (nameArg.valueExpression && nameArg.valueExpression.nodeType === 48 /* ParseNodeType.StringList */) {
            className = nameArg.valueExpression.strings.map((s) => s.value).join('');
        }
    }
    // Is there is a default arg? If so, is it defined in a way that we
    // can determine its length statically?
    const defaultsArg = argList.find((arg) => { var _a; return ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'defaults'; });
    let defaultArgCount = 0;
    if (defaultsArg && defaultsArg.valueExpression) {
        const defaultsArgType = evaluator.getTypeOfExpression(defaultsArg.valueExpression).type;
        if ((0, types_1.isClassInstance)(defaultsArgType) &&
            (0, typeUtils_1.isTupleClass)(defaultsArgType) &&
            !(0, typeUtils_1.isUnboundedTupleClass)(defaultsArgType) &&
            defaultsArgType.tupleTypeArguments) {
            defaultArgCount = defaultsArgType.tupleTypeArguments.length;
        }
        else {
            defaultArgCount = undefined;
        }
    }
    const namedTupleType = evaluator.getTypingType(errorNode, 'NamedTuple') || types_1.UnknownType.create();
    const classType = types_1.ClassType.createInstantiable(className, ParseTreeUtils.getClassFullName(errorNode, fileInfo.moduleName, className), fileInfo.moduleName, fileInfo.fileUri, 524288 /* ClassTypeFlags.ReadOnlyInstanceVariables */ | 4194304 /* ClassTypeFlags.ValidTypeAliasClass */, ParseTreeUtils.getTypeSourceId(errorNode), 
    /* declaredMetaclass */ undefined, (0, types_1.isInstantiableClass)(namedTupleType) ? namedTupleType.details.effectiveMetaclass : types_1.UnknownType.create());
    classType.details.baseClasses.push(namedTupleType);
    classType.details.typeVarScopeId = ParseTreeUtils.getScopeIdForNode(errorNode);
    const classFields = types_1.ClassType.getSymbolTable(classType);
    classFields.set('__class__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */ | 64 /* SymbolFlags.IgnoredForProtocolMatch */, classType));
    const classTypeVar = (0, typeUtils_1.synthesizeTypeVarForSelfCls)(classType, /* isClsParam */ true);
    const constructorType = types_1.FunctionType.createSynthesizedInstance('__new__', 1 /* FunctionTypeFlags.ConstructorMethod */);
    constructorType.details.declaredReturnType = (0, typeUtils_1.convertToInstance)(classTypeVar);
    constructorType.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
    if (ParseTreeUtils.isAssignmentToDefaultsFollowingNamedTuple(errorNode)) {
        constructorType.details.flags |= 32 /* FunctionTypeFlags.DisableDefaultChecks */;
    }
    constructorType.details.typeVarScopeId = classType.details.typeVarScopeId;
    types_1.FunctionType.addParameter(constructorType, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'cls',
        type: classTypeVar,
        hasDeclaredType: true,
    });
    const matchArgsNames = [];
    const selfParameter = {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: (0, typeUtils_1.synthesizeTypeVarForSelfCls)(classType, /* isClsParam */ false),
        hasDeclaredType: true,
    };
    let addGenericGetAttribute = false;
    const entryTypes = [];
    if (argList.length < 2) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.namedTupleSecondArg(), errorNode);
        addGenericGetAttribute = true;
    }
    else {
        const entriesArg = argList[1];
        if (entriesArg.argumentCategory !== 0 /* ArgumentCategory.Simple */) {
            addGenericGetAttribute = true;
        }
        else {
            if (!includesTypes &&
                entriesArg.valueExpression &&
                entriesArg.valueExpression.nodeType === 48 /* ParseNodeType.StringList */) {
                const entries = entriesArg.valueExpression.strings
                    .map((s) => s.value)
                    .join('')
                    .split(/[,\s]+/);
                const firstParamWithDefaultIndex = defaultArgCount === undefined ? 0 : Math.max(0, entries.length - defaultArgCount);
                entries.forEach((entryName, index) => {
                    entryName = entryName.trim();
                    if (entryName) {
                        entryName = renameKeyword(evaluator, entryName, allowRename, entriesArg.valueExpression, index);
                        const entryType = types_1.UnknownType.create();
                        const paramInfo = {
                            category: 0 /* ParameterCategory.Simple */,
                            name: entryName,
                            type: entryType,
                            hasDeclaredType: includesTypes,
                            hasDefault: index >= firstParamWithDefaultIndex,
                        };
                        types_1.FunctionType.addParameter(constructorType, paramInfo);
                        const newSymbol = symbol_1.Symbol.createWithType(8 /* SymbolFlags.InstanceMember */, entryType);
                        matchArgsNames.push(entryName);
                        // We need to associate the declaration with a parse node.
                        // In this case it's just part of a string literal value.
                        // The definition provider won't necessarily take the
                        // user to the exact spot in the string, but it's close enough.
                        const stringNode = entriesArg.valueExpression;
                        const declaration = {
                            type: 1 /* DeclarationType.Variable */,
                            node: stringNode,
                            isRuntimeTypeExpression: true,
                            uri: fileInfo.fileUri,
                            range: (0, positionUtils_1.convertOffsetsToRange)(stringNode.start, textRange_1.TextRange.getEnd(stringNode), fileInfo.lines),
                            moduleName: fileInfo.moduleName,
                            isInExceptSuite: false,
                        };
                        newSymbol.addDeclaration(declaration);
                        classFields.set(entryName, newSymbol);
                        entryTypes.push(entryType);
                    }
                });
            }
            else if (((_a = entriesArg.valueExpression) === null || _a === void 0 ? void 0 : _a.nodeType) === 34 /* ParseNodeType.List */ ||
                ((_b = entriesArg.valueExpression) === null || _b === void 0 ? void 0 : _b.nodeType) === 52 /* ParseNodeType.Tuple */) {
                const entryList = entriesArg.valueExpression;
                const entryMap = new Map();
                const entryExpressions = ((_c = entriesArg.valueExpression) === null || _c === void 0 ? void 0 : _c.nodeType) === 34 /* ParseNodeType.List */
                    ? entriesArg.valueExpression.entries
                    : entriesArg.valueExpression.expressions;
                const firstParamWithDefaultIndex = defaultArgCount === undefined ? 0 : Math.max(0, entryExpressions.length - defaultArgCount);
                entryExpressions.forEach((entry, index) => {
                    let entryTypeNode;
                    let entryType;
                    let entryNameNode;
                    let entryName = '';
                    if (includesTypes) {
                        // Handle the variant that includes name/type tuples.
                        if (entry.nodeType === 52 /* ParseNodeType.Tuple */ && entry.expressions.length === 2) {
                            entryNameNode = entry.expressions[0];
                            entryTypeNode = entry.expressions[1];
                            entryType = (0, typeUtils_1.convertToInstance)(evaluator.getTypeOfExpressionExpectingType(entryTypeNode).type);
                        }
                        else {
                            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, localize_1.LocMessage.namedTupleNameType(), entry);
                        }
                    }
                    else {
                        entryNameNode = entry;
                        entryType = types_1.UnknownType.create();
                    }
                    if (entryNameNode) {
                        const nameTypeResult = evaluator.getTypeOfExpression(entryNameNode);
                        if ((0, types_1.isClassInstance)(nameTypeResult.type) &&
                            types_1.ClassType.isBuiltIn(nameTypeResult.type, 'str') &&
                            (0, typeUtils_1.isLiteralType)(nameTypeResult.type)) {
                            entryName = nameTypeResult.type.literalValue;
                            if (!entryName) {
                                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.namedTupleEmptyName(), entryNameNode);
                            }
                            else {
                                entryName = renameKeyword(evaluator, entryName, allowRename, entryNameNode, index);
                            }
                        }
                        else {
                            addGenericGetAttribute = true;
                        }
                    }
                    else {
                        addGenericGetAttribute = true;
                    }
                    if (!entryName) {
                        entryName = `_${index.toString()}`;
                    }
                    if (entryMap.has(entryName)) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.namedTupleNameUnique(), entryNameNode || entry);
                    }
                    // Record names in a map to detect duplicates.
                    entryMap.set(entryName, entryName);
                    if (!entryType) {
                        entryType = types_1.UnknownType.create();
                    }
                    const paramInfo = {
                        category: 0 /* ParameterCategory.Simple */,
                        name: entryName,
                        type: entryType,
                        hasDeclaredType: includesTypes,
                        hasDefault: index >= firstParamWithDefaultIndex,
                    };
                    types_1.FunctionType.addParameter(constructorType, paramInfo);
                    entryTypes.push(entryType);
                    matchArgsNames.push(entryName);
                    const newSymbol = symbol_1.Symbol.createWithType(8 /* SymbolFlags.InstanceMember */ | 2048 /* SymbolFlags.NamedTupleMember */, entryType);
                    if (entryNameNode && entryNameNode.nodeType === 48 /* ParseNodeType.StringList */) {
                        const declaration = {
                            type: 1 /* DeclarationType.Variable */,
                            node: entryNameNode,
                            uri: fileInfo.fileUri,
                            typeAnnotationNode: entryTypeNode,
                            range: (0, positionUtils_1.convertOffsetsToRange)(entryNameNode.start, textRange_1.TextRange.getEnd(entryNameNode), fileInfo.lines),
                            moduleName: fileInfo.moduleName,
                            isInExceptSuite: false,
                        };
                        newSymbol.addDeclaration(declaration);
                    }
                    classFields.set(entryName, newSymbol);
                });
                // Set the type in the type cache for the dict node so it
                // doesn't get evaluated again.
                evaluator.setTypeResultForNode(entryList, { type: types_1.UnknownType.create() });
            }
            else {
                // A dynamic expression was used, so we can't evaluate
                // the named tuple statically.
                addGenericGetAttribute = true;
            }
            if (entriesArg.valueExpression && !addGenericGetAttribute) {
                // Set the type of the value expression node to Any so we don't attempt to
                // re-evaluate it later, potentially generating "partially unknown" errors
                // in strict mode.
                evaluator.setTypeResultForNode(entriesArg.valueExpression, { type: types_1.AnyType.create() });
            }
        }
    }
    if (addGenericGetAttribute) {
        constructorType.details.parameters = [];
        types_1.FunctionType.addDefaultParameters(constructorType);
        entryTypes.push(types_1.AnyType.create(/* isEllipsis */ false));
        entryTypes.push(types_1.AnyType.create(/* isEllipsis */ true));
    }
    // Always use generic parameters for __init__.
    const initType = types_1.FunctionType.createSynthesizedInstance('__init__');
    types_1.FunctionType.addParameter(initType, selfParameter);
    types_1.FunctionType.addDefaultParameters(initType);
    initType.details.declaredReturnType = evaluator.getNoneType();
    initType.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
    classFields.set('__new__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, constructorType));
    classFields.set('__init__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, initType));
    const lenType = types_1.FunctionType.createSynthesizedInstance('__len__');
    lenType.details.declaredReturnType = evaluator.getBuiltInObject(errorNode, 'int');
    types_1.FunctionType.addParameter(lenType, selfParameter);
    classFields.set('__len__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, lenType));
    if (addGenericGetAttribute) {
        const getAttribType = types_1.FunctionType.createSynthesizedInstance('__getattribute__');
        getAttribType.details.declaredReturnType = types_1.AnyType.create();
        types_1.FunctionType.addParameter(getAttribType, selfParameter);
        types_1.FunctionType.addParameter(getAttribType, {
            category: 0 /* ParameterCategory.Simple */,
            name: 'name',
            type: evaluator.getBuiltInObject(errorNode, 'str'),
        });
        classFields.set('__getattribute__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, getAttribType));
    }
    const tupleClassType = evaluator.getBuiltInType(errorNode, 'tuple');
    // Synthesize the __match_args__ class variable.
    const strType = evaluator.getBuiltInType(errorNode, 'str');
    if (!addGenericGetAttribute &&
        strType &&
        (0, types_1.isInstantiableClass)(strType) &&
        tupleClassType &&
        (0, types_1.isInstantiableClass)(tupleClassType)) {
        const literalTypes = matchArgsNames.map((name) => {
            return { type: types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneWithLiteral(strType, name)), isUnbounded: false };
        });
        const matchArgsType = types_1.ClassType.cloneAsInstance((0, typeUtils_1.specializeTupleClass)(tupleClassType, literalTypes));
        classFields.set('__match_args__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, matchArgsType));
    }
    updateNamedTupleBaseClass(classType, entryTypes, !addGenericGetAttribute);
    (0, typeUtils_1.computeMroLinearization)(classType);
    return classType;
}
exports.createNamedTupleType = createNamedTupleType;
function updateNamedTupleBaseClass(classType, typeArgs, isTypeArgumentExplicit) {
    let isUpdateNeeded = false;
    classType.details.baseClasses = classType.details.baseClasses.map((baseClass) => {
        if (!(0, types_1.isInstantiableClass)(baseClass) || !types_1.ClassType.isBuiltIn(baseClass, 'NamedTuple')) {
            return baseClass;
        }
        const tupleTypeArgs = [];
        if (!isTypeArgumentExplicit) {
            tupleTypeArgs.push({
                type: typeArgs.length > 0 ? (0, types_1.combineTypes)(typeArgs) : types_1.UnknownType.create(),
                isUnbounded: true,
            });
        }
        else {
            typeArgs.forEach((t) => {
                tupleTypeArgs.push({ type: t, isUnbounded: false });
            });
        }
        // Create a copy of the NamedTuple class that replaces the tuple base class.
        const clonedNamedTupleClass = types_1.ClassType.cloneForSpecialization(baseClass, 
        /* typeArguments */ undefined, isTypeArgumentExplicit);
        clonedNamedTupleClass.details = { ...clonedNamedTupleClass.details };
        clonedNamedTupleClass.details.baseClasses = clonedNamedTupleClass.details.baseClasses.map((namedTupleBaseClass) => {
            if (!(0, types_1.isInstantiableClass)(namedTupleBaseClass) || !types_1.ClassType.isBuiltIn(namedTupleBaseClass, 'tuple')) {
                return namedTupleBaseClass;
            }
            return (0, typeUtils_1.specializeTupleClass)(namedTupleBaseClass, tupleTypeArgs, isTypeArgumentExplicit);
        });
        (0, typeUtils_1.computeMroLinearization)(clonedNamedTupleClass);
        isUpdateNeeded = true;
        return clonedNamedTupleClass;
    });
    return isUpdateNeeded;
}
exports.updateNamedTupleBaseClass = updateNamedTupleBaseClass;
function renameKeyword(evaluator, name, allowRename, errorNode, index) {
    // Determine whether the name is a keyword in python.
    const isKeyword = tokenizer_1.Tokenizer.isPythonKeyword(name);
    if (!isKeyword) {
        // No rename necessary.
        return name;
    }
    if (allowRename) {
        // Rename based on index.
        return `_${index}`;
    }
    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.namedTupleNameKeyword(), errorNode);
    return name;
}
//# sourceMappingURL=namedTuples.js.map