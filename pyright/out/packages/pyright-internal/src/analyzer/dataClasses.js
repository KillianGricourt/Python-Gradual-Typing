"use strict";
/*
 * dataClasses.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides special-case logic for the construction of dataclass
 * classes and dataclass transform.
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
exports.applyDataClassDecorator = exports.applyDataClassClassBehaviorOverrides = exports.getDataclassDecoratorBehaviors = exports.validateDataClassTransformDecorator = exports.addInheritedDataClassEntries = exports.synthesizeDataClassMethods = void 0;
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const localize_1 = require("../localization/localize");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const constructors_1 = require("./constructors");
const namedTuples_1 = require("./namedTuples");
const parseTreeUtils_1 = require("./parseTreeUtils");
const staticExpressions_1 = require("./staticExpressions");
const symbol_1 = require("./symbol");
const symbolNameUtils_1 = require("./symbolNameUtils");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
// Validates fields for compatibility with a dataclass and synthesizes
// an appropriate __new__ and __init__ methods plus __dataclass_fields__
// and __match_args__ class variables.
function synthesizeDataClassMethods(evaluator, node, classType, isNamedTuple, skipSynthesizeInit, hasExistingInitMethod, skipSynthesizeHash) {
    var _a;
    (0, debug_1.assert)(types_1.ClassType.isDataClass(classType) || isNamedTuple);
    const classTypeVar = (0, typeUtils_1.synthesizeTypeVarForSelfCls)(classType, /* isClsParam */ true);
    const newType = types_1.FunctionType.createSynthesizedInstance('__new__', 1 /* FunctionTypeFlags.ConstructorMethod */);
    newType.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
    const initType = types_1.FunctionType.createSynthesizedInstance('__init__');
    initType.details.constructorTypeVarScopeId = (0, typeUtils_1.getTypeVarScopeId)(classType);
    // Generate both a __new__ and an __init__ method. The parameters of the
    // __new__ method are based on field definitions for NamedTuple classes,
    // and the parameters of the __init__ method are based on field definitions
    // in other cases.
    types_1.FunctionType.addParameter(newType, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'cls',
        type: classTypeVar,
        hasDeclaredType: true,
    });
    if (!isNamedTuple) {
        types_1.FunctionType.addDefaultParameters(newType);
    }
    newType.details.declaredReturnType = (0, typeUtils_1.convertToInstance)(classTypeVar);
    const selfParam = {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: (0, typeUtils_1.synthesizeTypeVarForSelfCls)(classType, /* isClsParam */ false),
        hasDeclaredType: true,
    };
    types_1.FunctionType.addParameter(initType, selfParam);
    if (isNamedTuple) {
        types_1.FunctionType.addDefaultParameters(initType);
    }
    initType.details.declaredReturnType = evaluator.getNoneType();
    // Maintain a list of all dataclass entries (including
    // those from inherited classes) plus a list of only those
    // entries added by this class.
    const localDataClassEntries = [];
    const fullDataClassEntries = [];
    const allAncestorsKnown = addInheritedDataClassEntries(classType, fullDataClassEntries);
    if (!allAncestorsKnown) {
        // If one or more ancestor classes have an unknown type, we cannot
        // safely determine the parameter list, so we'll accept any parameters
        // to avoid a false positive.
        types_1.FunctionType.addDefaultParameters(initType);
    }
    // Add field-based parameters to either the __new__ or __init__ method
    // based on whether this is a NamedTuple or a dataclass.
    const constructorType = isNamedTuple ? newType : initType;
    const localEntryTypeEvaluator = [];
    let sawKeywordOnlySeparator = false;
    types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
        var _a, _b, _c, _d, _e, _f, _g;
        if (symbol.isIgnoredForProtocolMatch()) {
            return;
        }
        // Apparently, `__hash__` is special-cased in a dataclass. I can't find
        // this in the spec, but the runtime seems to treat is specially.
        if (name === '__hash__') {
            return;
        }
        // Only variables (not functions, classes, etc.) are considered.
        const classVarDecl = symbol.getTypedDeclarations().find((decl) => {
            if (decl.type !== 1 /* DeclarationType.Variable */) {
                return false;
            }
            const container = (0, parseTreeUtils_1.getEnclosingClassOrFunction)(decl.node);
            if (!container || container.nodeType !== 10 /* ParseNodeType.Class */) {
                return false;
            }
            return true;
        });
        if (classVarDecl) {
            let statement = classVarDecl.node;
            while (statement) {
                if (statement.nodeType === 3 /* ParseNodeType.Assignment */) {
                    break;
                }
                if (statement.nodeType === 54 /* ParseNodeType.TypeAnnotation */) {
                    if (((_a = statement.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 3 /* ParseNodeType.Assignment */) {
                        statement = statement.parent;
                    }
                    break;
                }
                statement = statement.parent;
            }
            if (!statement) {
                return;
            }
            let variableNameNode;
            let aliasName;
            let variableTypeEvaluator;
            let hasDefaultValue = false;
            let isKeywordOnly = types_1.ClassType.isDataClassKeywordOnly(classType) || sawKeywordOnlySeparator;
            let defaultValueExpression;
            let includeInInit = true;
            let converter;
            if (statement.nodeType === 3 /* ParseNodeType.Assignment */) {
                if (statement.leftExpression.nodeType === 54 /* ParseNodeType.TypeAnnotation */ &&
                    statement.leftExpression.valueExpression.nodeType === 38 /* ParseNodeType.Name */) {
                    variableNameNode = statement.leftExpression.valueExpression;
                    const assignmentStatement = statement;
                    variableTypeEvaluator = () => evaluator.getTypeOfAnnotation(assignmentStatement.leftExpression.typeAnnotation, {
                        isVariableAnnotation: true,
                        allowFinal: true,
                        allowClassVar: true,
                    });
                }
                hasDefaultValue = true;
                defaultValueExpression = statement.rightExpression;
                // If the RHS of the assignment is assigning a field instance where the
                // "init" parameter is set to false, do not include it in the init method.
                if (statement.rightExpression.nodeType === 9 /* ParseNodeType.Call */) {
                    const callTypeResult = evaluator.getTypeOfExpression(statement.rightExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
                    const callType = callTypeResult.type;
                    if (!isNamedTuple &&
                        isDataclassFieldConstructor(callType, ((_b = classType.details.dataClassBehaviors) === null || _b === void 0 ? void 0 : _b.fieldDescriptorNames) || [])) {
                        const initArg = statement.rightExpression.arguments.find((arg) => { var _a; return ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'init'; });
                        if (initArg && initArg.valueExpression) {
                            const fileInfo = AnalyzerNodeInfo.getFileInfo(node);
                            includeInInit =
                                (_c = (0, staticExpressions_1.evaluateStaticBoolExpression)(initArg.valueExpression, fileInfo.executionEnvironment, fileInfo.definedConstants)) !== null && _c !== void 0 ? _c : includeInInit;
                        }
                        else {
                            includeInInit =
                                (_d = getDefaultArgValueForFieldSpecifier(evaluator, statement.rightExpression, callTypeResult, 'init')) !== null && _d !== void 0 ? _d : includeInInit;
                        }
                        const kwOnlyArg = statement.rightExpression.arguments.find((arg) => { var _a; return ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'kw_only'; });
                        if (kwOnlyArg && kwOnlyArg.valueExpression) {
                            const fileInfo = AnalyzerNodeInfo.getFileInfo(node);
                            isKeywordOnly =
                                (_e = (0, staticExpressions_1.evaluateStaticBoolExpression)(kwOnlyArg.valueExpression, fileInfo.executionEnvironment, fileInfo.definedConstants)) !== null && _e !== void 0 ? _e : isKeywordOnly;
                        }
                        else {
                            isKeywordOnly =
                                (_f = getDefaultArgValueForFieldSpecifier(evaluator, statement.rightExpression, callTypeResult, 'kw_only')) !== null && _f !== void 0 ? _f : isKeywordOnly;
                        }
                        const defaultArg = statement.rightExpression.arguments.find((arg) => {
                            var _a, _b, _c;
                            return ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'default' ||
                                ((_b = arg.name) === null || _b === void 0 ? void 0 : _b.value) === 'default_factory' ||
                                ((_c = arg.name) === null || _c === void 0 ? void 0 : _c.value) === 'factory';
                        });
                        hasDefaultValue = !!defaultArg;
                        if (defaultArg === null || defaultArg === void 0 ? void 0 : defaultArg.valueExpression) {
                            defaultValueExpression = defaultArg.valueExpression;
                        }
                        const aliasArg = statement.rightExpression.arguments.find((arg) => { var _a; return ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'alias'; });
                        if (aliasArg) {
                            const valueType = evaluator.getTypeOfExpression(aliasArg.valueExpression).type;
                            if ((0, types_1.isClassInstance)(valueType) &&
                                types_1.ClassType.isBuiltIn(valueType, 'str') &&
                                (0, typeUtils_1.isLiteralType)(valueType)) {
                                aliasName = valueType.literalValue;
                            }
                        }
                        const converterArg = statement.rightExpression.arguments.find((arg) => { var _a; return ((_a = arg.name) === null || _a === void 0 ? void 0 : _a.value) === 'converter'; });
                        if (converterArg && converterArg.valueExpression) {
                            // Converter support is dependent on PEP 712, which has not yet been approved.
                            if (AnalyzerNodeInfo.getFileInfo(node).diagnosticRuleSet.enableExperimentalFeatures) {
                                converter = converterArg;
                            }
                        }
                    }
                }
            }
            else if (statement.nodeType === 54 /* ParseNodeType.TypeAnnotation */) {
                if (statement.valueExpression.nodeType === 38 /* ParseNodeType.Name */) {
                    variableNameNode = statement.valueExpression;
                    const annotationStatement = statement;
                    variableTypeEvaluator = () => evaluator.getTypeOfAnnotation(annotationStatement.typeAnnotation, {
                        isVariableAnnotation: true,
                        allowFinal: true,
                        allowClassVar: true,
                    });
                    // Is this a KW_ONLY separator introduced in Python 3.10?
                    if (!isNamedTuple && statement.valueExpression.value === '_') {
                        const annotatedType = variableTypeEvaluator();
                        if ((0, types_1.isClassInstance)(annotatedType) && types_1.ClassType.isBuiltIn(annotatedType, 'KW_ONLY')) {
                            sawKeywordOnlySeparator = true;
                            variableNameNode = undefined;
                            variableTypeEvaluator = undefined;
                        }
                    }
                }
            }
            if (variableNameNode && variableTypeEvaluator) {
                const variableName = variableNameNode.value;
                // Don't include class vars. PEP 557 indicates that they shouldn't
                // be considered data class entries.
                const variableSymbol = types_1.ClassType.getSymbolTable(classType).get(variableName);
                if ((variableSymbol === null || variableSymbol === void 0 ? void 0 : variableSymbol.isClassVar()) && !(variableSymbol === null || variableSymbol === void 0 ? void 0 : variableSymbol.isFinalVarInClassBody())) {
                    // If an ancestor class declared an instance variable but this dataclass
                    // declares a ClassVar, delete the older one from the full data class entries.
                    // We exclude final variables here because a Final type annotation is implicitly
                    // considered a ClassVar by the binder, but dataclass rules are different.
                    const index = fullDataClassEntries.findIndex((p) => p.name === variableName);
                    if (index >= 0) {
                        fullDataClassEntries.splice(index, 1);
                    }
                    const dataClassEntry = {
                        name: variableName,
                        classType,
                        alias: aliasName,
                        isKeywordOnly: false,
                        hasDefault: hasDefaultValue,
                        defaultValueExpression,
                        includeInInit,
                        nameNode: variableNameNode,
                        type: types_1.UnknownType.create(),
                        isClassVar: true,
                        converter,
                    };
                    localDataClassEntries.push(dataClassEntry);
                }
                else {
                    // Create a new data class entry, but defer evaluation of the type until
                    // we've compiled the full list of data class entries for this class. This
                    // allows us to handle circular references in types.
                    const dataClassEntry = {
                        name: variableName,
                        classType,
                        alias: aliasName,
                        isKeywordOnly,
                        hasDefault: hasDefaultValue,
                        defaultValueExpression,
                        includeInInit,
                        nameNode: variableNameNode,
                        type: types_1.UnknownType.create(),
                        isClassVar: false,
                        converter,
                    };
                    localEntryTypeEvaluator.push({ entry: dataClassEntry, evaluator: variableTypeEvaluator });
                    // Add the new entry to the local entry list.
                    let insertIndex = localDataClassEntries.findIndex((e) => e.name === variableName);
                    if (insertIndex >= 0) {
                        localDataClassEntries[insertIndex] = dataClassEntry;
                    }
                    else {
                        localDataClassEntries.push(dataClassEntry);
                    }
                    // Add the new entry to the full entry list.
                    insertIndex = fullDataClassEntries.findIndex((p) => p.name === variableName);
                    if (insertIndex >= 0) {
                        const oldEntry = fullDataClassEntries[insertIndex];
                        // While this isn't documented behavior, it appears that the dataclass implementation
                        // causes overridden variables to "inherit" default values from parent classes.
                        if (!dataClassEntry.hasDefault && oldEntry.hasDefault && oldEntry.includeInInit) {
                            dataClassEntry.hasDefault = true;
                            dataClassEntry.defaultValueExpression = oldEntry.defaultValueExpression;
                            hasDefaultValue = true;
                            // Warn the user of this case because it can result in type errors if the
                            // default value is incompatible with the new type.
                            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassFieldInheritedDefault().format({ fieldName: variableName }), variableNameNode);
                        }
                        fullDataClassEntries[insertIndex] = dataClassEntry;
                    }
                    else {
                        fullDataClassEntries.push(dataClassEntry);
                        insertIndex = fullDataClassEntries.length - 1;
                    }
                    // If we've already seen a entry with a default value defined,
                    // all subsequent entries must also have default values.
                    if (!isKeywordOnly && includeInInit && !skipSynthesizeInit && !hasDefaultValue) {
                        const firstDefaultValueIndex = fullDataClassEntries.findIndex((p) => p.hasDefault && p.includeInInit && !p.isKeywordOnly);
                        if (firstDefaultValueIndex >= 0 && firstDefaultValueIndex < insertIndex) {
                            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassFieldWithDefault(), variableNameNode);
                        }
                    }
                }
            }
        }
        else {
            // The symbol had no declared type, so it is (mostly) ignored by dataclasses.
            // However, if it is assigned a field descriptor, it will result in a
            // runtime exception.
            const declarations = symbol.getDeclarations();
            if (declarations.length === 0) {
                return;
            }
            const lastDecl = declarations[declarations.length - 1];
            if (lastDecl.type !== 1 /* DeclarationType.Variable */) {
                return;
            }
            const statement = lastDecl.node.parent;
            if (!statement || statement.nodeType !== 3 /* ParseNodeType.Assignment */) {
                return;
            }
            // If the RHS of the assignment is assigning a field instance where the
            // "init" parameter is set to false, do not include it in the init method.
            if (statement.rightExpression.nodeType === 9 /* ParseNodeType.Call */) {
                const callType = evaluator.getTypeOfExpression(statement.rightExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */).type;
                if (isDataclassFieldConstructor(callType, ((_g = classType.details.dataClassBehaviors) === null || _g === void 0 ? void 0 : _g.fieldDescriptorNames) || [])) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassFieldWithoutAnnotation(), statement.rightExpression);
                }
            }
        }
    });
    if (!isNamedTuple) {
        classType.details.dataClassEntries = localDataClassEntries;
    }
    // Now that the dataClassEntries field has been set with a complete list
    // of local data class entries for this class, perform deferred type
    // evaluations. This could involve circular type dependencies, so it's
    // required that the list be complete (even if types are not yet accurate)
    // before we perform the type evaluations.
    localEntryTypeEvaluator.forEach((entryEvaluator) => {
        entryEvaluator.entry.type = entryEvaluator.evaluator();
    });
    const symbolTable = types_1.ClassType.getSymbolTable(classType);
    const keywordOnlyParams = [];
    if (!skipSynthesizeInit && !hasExistingInitMethod) {
        if (allAncestorsKnown) {
            fullDataClassEntries.forEach((entry) => {
                if (entry.includeInInit) {
                    // If the type refers to Self of the parent class, we need to
                    // transform it to refer to the Self of this subclass.
                    let effectiveType = entry.type;
                    if (entry.classType !== classType && (0, typeUtils_1.requiresSpecialization)(effectiveType)) {
                        const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(entry.classType));
                        (0, typeUtils_1.populateTypeVarContextForSelfType)(typeVarContext, entry.classType, classType);
                        effectiveType = (0, typeUtils_1.applySolvedTypeVars)(effectiveType, typeVarContext);
                    }
                    // Is the field type a descriptor object? If so, we need to extract the corresponding
                    // type of the __init__ method parameter from the __set__ method.
                    effectiveType = transformDescriptorType(evaluator, effectiveType);
                    if (entry.converter) {
                        const fieldType = effectiveType;
                        effectiveType = getConverterInputType(evaluator, entry.converter, effectiveType, entry.name);
                        symbolTable.set(entry.name, getDescriptorForConverterField(evaluator, node, entry.converter, entry.name, fieldType, effectiveType));
                    }
                    const effectiveName = entry.alias || entry.name;
                    if (!entry.alias && entry.nameNode && (0, symbolNameUtils_1.isPrivateName)(entry.nameNode.value)) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassFieldWithPrivateName(), entry.nameNode);
                    }
                    const functionParam = {
                        category: 0 /* ParameterCategory.Simple */,
                        name: effectiveName,
                        hasDefault: entry.hasDefault,
                        defaultValueExpression: entry.defaultValueExpression,
                        type: effectiveType,
                        hasDeclaredType: true,
                    };
                    if (entry.isKeywordOnly) {
                        keywordOnlyParams.push(functionParam);
                    }
                    else {
                        types_1.FunctionType.addParameter(constructorType, functionParam);
                    }
                }
            });
            if (keywordOnlyParams.length > 0) {
                types_1.FunctionType.addKeywordOnlyParameterSeparator(constructorType);
                keywordOnlyParams.forEach((param) => {
                    types_1.FunctionType.addParameter(constructorType, param);
                });
            }
        }
        symbolTable.set('__init__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, initType));
        symbolTable.set('__new__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, newType));
    }
    // Synthesize the __match_args__ class variable if it doesn't exist.
    const strType = evaluator.getBuiltInType(node, 'str');
    const tupleClassType = evaluator.getBuiltInType(node, 'tuple');
    if (tupleClassType &&
        (0, types_1.isInstantiableClass)(tupleClassType) &&
        strType &&
        (0, types_1.isInstantiableClass)(strType) &&
        !symbolTable.has('__match_args__')) {
        const matchArgsNames = [];
        fullDataClassEntries.forEach((entry) => {
            if (entry.includeInInit && !entry.isKeywordOnly) {
                // Use the field name, not its alias (if it has one).
                matchArgsNames.push(entry.name);
            }
        });
        const literalTypes = matchArgsNames.map((name) => {
            return { type: types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneWithLiteral(strType, name)), isUnbounded: false };
        });
        const matchArgsType = types_1.ClassType.cloneAsInstance((0, typeUtils_1.specializeTupleClass)(tupleClassType, literalTypes));
        symbolTable.set('__match_args__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, matchArgsType));
    }
    const synthesizeComparisonMethod = (operator, paramType) => {
        const operatorMethod = types_1.FunctionType.createSynthesizedInstance(operator);
        types_1.FunctionType.addParameter(operatorMethod, selfParam);
        types_1.FunctionType.addParameter(operatorMethod, {
            category: 0 /* ParameterCategory.Simple */,
            name: 'other',
            type: paramType,
            hasDeclaredType: true,
        });
        operatorMethod.details.declaredReturnType = evaluator.getBuiltInObject(node, 'bool');
        // If a method of this name already exists, don't override it.
        if (!symbolTable.get(operator)) {
            symbolTable.set(operator, symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, operatorMethod));
        }
    };
    // Synthesize comparison operators.
    if (!types_1.ClassType.isDataClassSkipGenerateEq(classType)) {
        synthesizeComparisonMethod('__eq__', evaluator.getBuiltInObject(node, 'object'));
    }
    if (types_1.ClassType.isDataClassGenerateOrder(classType)) {
        const objType = types_1.ClassType.cloneAsInstance(classType);
        ['__lt__', '__le__', '__gt__', '__ge__'].forEach((operator) => {
            synthesizeComparisonMethod(operator, objType);
        });
    }
    let synthesizeHashFunction = types_1.ClassType.isDataClassFrozen(classType);
    const synthesizeHashNone = !isNamedTuple && !types_1.ClassType.isDataClassSkipGenerateEq(classType) && !types_1.ClassType.isDataClassFrozen(classType);
    if (skipSynthesizeHash) {
        synthesizeHashFunction = false;
    }
    // If the user has indicated that a hash function should be generated even if it's unsafe
    // to do so or there is already a hash function present, override the default logic.
    if (types_1.ClassType.isDataClassGenerateHash(classType)) {
        synthesizeHashFunction = true;
    }
    if (synthesizeHashFunction) {
        const hashMethod = types_1.FunctionType.createSynthesizedInstance('__hash__');
        types_1.FunctionType.addParameter(hashMethod, selfParam);
        hashMethod.details.declaredReturnType = evaluator.getBuiltInObject(node, 'int');
        symbolTable.set('__hash__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */ | 4096 /* SymbolFlags.IgnoredForOverrideChecks */, hashMethod));
    }
    else if (synthesizeHashNone && !skipSynthesizeHash) {
        symbolTable.set('__hash__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */ | 4096 /* SymbolFlags.IgnoredForOverrideChecks */, evaluator.getNoneType()));
    }
    let dictType = evaluator.getBuiltInType(node, 'dict');
    if ((0, types_1.isInstantiableClass)(dictType)) {
        dictType = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForSpecialization(dictType, [evaluator.getBuiltInObject(node, 'str'), types_1.AnyType.create()], 
        /* isTypeArgumentExplicit */ true));
    }
    if (!isNamedTuple) {
        symbolTable.set('__dataclass_fields__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */ | 128 /* SymbolFlags.ClassVar */, dictType));
    }
    if (types_1.ClassType.isDataClassGenerateSlots(classType) && classType.details.localSlotsNames === undefined) {
        classType.details.localSlotsNames = localDataClassEntries.map((entry) => entry.name);
    }
    // Should we synthesize a __slots__ symbol?
    if (types_1.ClassType.isDataClassGenerateSlots(classType)) {
        let iterableType = (_a = evaluator.getTypingType(node, 'Iterable')) !== null && _a !== void 0 ? _a : types_1.UnknownType.create();
        if ((0, types_1.isInstantiableClass)(iterableType)) {
            iterableType = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForSpecialization(iterableType, [evaluator.getBuiltInObject(node, 'str')], 
            /* isTypeArgumentExplicit */ true));
        }
        symbolTable.set('__slots__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */ | 128 /* SymbolFlags.ClassVar */, iterableType));
    }
    // If this dataclass derived from a NamedTuple, update the NamedTuple with
    // the specialized entry types.
    if ((0, namedTuples_1.updateNamedTupleBaseClass)(classType, fullDataClassEntries.map((entry) => entry.type), 
    /* isTypeArgumentExplicit */ true)) {
        // Recompute the MRO based on the updated NamedTuple base class.
        (0, typeUtils_1.computeMroLinearization)(classType);
    }
}
exports.synthesizeDataClassMethods = synthesizeDataClassMethods;
// If a field specifier is used to define a field, it may define a default
// argument value (either True or False) for a supported keyword parameter.
// This function extracts that default value if present and returns it. If
// it's not present, it returns undefined.
function getDefaultArgValueForFieldSpecifier(evaluator, callNode, callTypeResult, paramName) {
    const callType = callTypeResult.type;
    let callTarget;
    if ((0, types_1.isFunction)(callType)) {
        callTarget = callType;
    }
    else if ((0, types_1.isOverloadedFunction)(callType)) {
        callTarget = evaluator.getBestOverloadForArguments(callNode, { type: callType, isIncomplete: callTypeResult.isIncomplete }, callNode.arguments);
    }
    else if ((0, types_1.isInstantiableClass)(callType)) {
        const initMethodResult = (0, constructors_1.getBoundInitMethod)(evaluator, callNode, callType);
        if (initMethodResult) {
            if ((0, types_1.isFunction)(initMethodResult.type)) {
                callTarget = initMethodResult.type;
            }
            else if ((0, types_1.isOverloadedFunction)(initMethodResult.type)) {
                callTarget = evaluator.getBestOverloadForArguments(callNode, { type: initMethodResult.type }, callNode.arguments);
            }
        }
    }
    if (callTarget) {
        const initParam = callTarget.details.parameters.find((p) => p.name === paramName);
        if (initParam) {
            // Is the parameter type a literal bool?
            if (initParam.hasDeclaredType &&
                (0, types_1.isClass)(initParam.type) &&
                typeof initParam.type.literalValue === 'boolean') {
                return initParam.type.literalValue;
            }
            // Is the default argument value a literal bool?
            if (initParam.defaultValueExpression &&
                initParam.defaultType &&
                (0, types_1.isClass)(initParam.defaultType) &&
                typeof initParam.defaultType.literalValue === 'boolean') {
                return initParam.defaultType.literalValue;
            }
        }
    }
    return undefined;
}
// Validates converter and, if valid, returns its input type. If invalid,
// fieldType is returned.
function getConverterInputType(evaluator, converterNode, fieldType, fieldName) {
    var _a;
    const converterType = getConverterAsFunction(evaluator, evaluator.getTypeOfExpression(converterNode.valueExpression).type);
    if (!converterType) {
        return fieldType;
    }
    // Create synthesized function of the form Callable[[T], fieldType] which
    // will be used to check compatibility of the provided converter.
    const typeVar = types_1.TypeVarType.createInstance('__converterInput');
    typeVar.scopeId = (0, parseTreeUtils_1.getScopeIdForNode)(converterNode);
    const targetFunction = types_1.FunctionType.createSynthesizedInstance('');
    targetFunction.details.typeVarScopeId = typeVar.scopeId;
    targetFunction.details.declaredReturnType = fieldType;
    types_1.FunctionType.addParameter(targetFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: '__input',
        type: typeVar,
        hasDeclaredType: true,
    });
    types_1.FunctionType.addPositionOnlyParameterSeparator(targetFunction);
    if ((0, types_1.isFunction)(converterType) || (0, types_1.isOverloadedFunction)(converterType)) {
        const acceptedTypes = [];
        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
        (0, typeUtils_1.doForEachSignature)(converterType, (signature) => {
            var _a;
            const returnTypeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeIds)(signature));
            if (evaluator.assignType((_a = types_1.FunctionType.getEffectiveReturnType(signature)) !== null && _a !== void 0 ? _a : types_1.UnknownType.create(), fieldType, 
            /* diag */ undefined, returnTypeVarContext)) {
                signature = (0, typeUtils_1.applySolvedTypeVars)(signature, returnTypeVarContext);
            }
            const inputTypeVarContext = new typeVarContext_1.TypeVarContext(typeVar.scopeId);
            if (evaluator.assignType(targetFunction, signature, diagAddendum, inputTypeVarContext)) {
                const overloadSolution = (0, typeUtils_1.applySolvedTypeVars)(typeVar, inputTypeVarContext, {
                    unknownIfNotFound: true,
                    tupleClassType: evaluator.getTupleClassType(),
                });
                acceptedTypes.push(overloadSolution);
            }
        });
        if (acceptedTypes.length > 0) {
            return (0, types_1.combineTypes)(acceptedTypes);
        }
        if ((0, types_1.isFunction)(converterType)) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassConverterFunction().format({
                argType: evaluator.printType(converterType),
                fieldType: evaluator.printType(fieldType),
                fieldName: fieldName,
            }) + diagAddendum.getString(), converterNode, (_a = diagAddendum.getEffectiveTextRange()) !== null && _a !== void 0 ? _a : converterNode);
        }
        else {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassConverterOverloads().format({
                funcName: converterType.overloads[0].details.name || '<anonymous function>',
                fieldType: evaluator.printType(fieldType),
                fieldName: fieldName,
            }) + diagAddendum.getString(), converterNode);
        }
    }
    return fieldType;
}
function getConverterAsFunction(evaluator, converterType) {
    if ((0, types_1.isFunction)(converterType) || (0, types_1.isOverloadedFunction)(converterType)) {
        return converterType;
    }
    if ((0, types_1.isClassInstance)(converterType)) {
        return evaluator.getBoundMagicMethod(converterType, '__call__');
    }
    if ((0, types_1.isInstantiableClass)(converterType)) {
        let fromConstructor = (0, constructors_1.createFunctionFromConstructor)(evaluator, converterType);
        if (fromConstructor) {
            // If conversion to a constructor resulted in a union type, we'll
            // choose the first of the two subtypes, which typically corresponds
            // to the __init__ method (rather than the __new__ method).
            if ((0, types_1.isUnion)(fromConstructor)) {
                fromConstructor = fromConstructor.subtypes[0];
            }
            if ((0, types_1.isFunction)(fromConstructor) || (0, types_1.isOverloadedFunction)(fromConstructor)) {
                return fromConstructor;
            }
        }
    }
    return undefined;
}
// Synthesizes an asymmetric descriptor class to be used in place of the
// annotated type of a field with a converter. The descriptor's __get__ method
// returns the declared type of the field and its __set__ method accepts the
// converter's input type. Returns the symbol for an instance of this descriptor
// type.
function getDescriptorForConverterField(evaluator, dataclassNode, converterNode, fieldName, getType, setType) {
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(dataclassNode);
    const typeMetaclass = evaluator.getBuiltInType(dataclassNode, 'type');
    const descriptorName = `__converterDescriptor_${fieldName}`;
    const descriptorClass = types_1.ClassType.createInstantiable(descriptorName, (0, parseTreeUtils_1.getClassFullName)(converterNode, fileInfo.moduleName, descriptorName), fileInfo.moduleName, fileInfo.fileUri, 0 /* ClassTypeFlags.None */, (0, parseTreeUtils_1.getTypeSourceId)(converterNode), 
    /* declaredMetaclass */ undefined, (0, types_1.isInstantiableClass)(typeMetaclass) ? typeMetaclass : types_1.UnknownType.create());
    descriptorClass.details.baseClasses.push(evaluator.getBuiltInType(dataclassNode, 'object'));
    (0, typeUtils_1.computeMroLinearization)(descriptorClass);
    const fields = types_1.ClassType.getSymbolTable(descriptorClass);
    const selfType = (0, typeUtils_1.synthesizeTypeVarForSelfCls)(descriptorClass, /* isClsParam */ false);
    const setFunction = types_1.FunctionType.createSynthesizedInstance('__set__');
    types_1.FunctionType.addParameter(setFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: selfType,
        hasDeclaredType: true,
    });
    types_1.FunctionType.addParameter(setFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'obj',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
    });
    types_1.FunctionType.addParameter(setFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'value',
        type: setType,
        hasDeclaredType: true,
    });
    setFunction.details.declaredReturnType = evaluator.getNoneType();
    const setSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, setFunction);
    fields.set('__set__', setSymbol);
    const getFunction = types_1.FunctionType.createSynthesizedInstance('__get__');
    types_1.FunctionType.addParameter(getFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: selfType,
        hasDeclaredType: true,
    });
    types_1.FunctionType.addParameter(getFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'obj',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
    });
    types_1.FunctionType.addParameter(getFunction, {
        category: 0 /* ParameterCategory.Simple */,
        name: 'objtype',
        type: types_1.AnyType.create(),
        hasDeclaredType: true,
    });
    getFunction.details.declaredReturnType = getType;
    const getSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, getFunction);
    fields.set('__get__', getSymbol);
    return symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, types_1.ClassType.cloneAsInstance(descriptorClass));
}
// If the specified type is a descriptor — in particular, if it implements a
// __set__ method, this method transforms the type into the input parameter
// for the set method.
function transformDescriptorType(evaluator, type) {
    if (!(0, types_1.isClassInstance)(type) || (0, typeUtils_1.isMetaclassInstance)(type)) {
        return type;
    }
    const setMethodType = evaluator.getBoundMagicMethod(type, '__set__');
    if (!setMethodType) {
        return type;
    }
    if (!(0, types_1.isFunction)(setMethodType)) {
        return type;
    }
    // The value parameter for a bound __set__ method is parameter index 1.
    return types_1.FunctionType.getEffectiveParameterType(setMethodType, 1);
}
// Builds a sorted list of dataclass entries that are inherited by
// the specified class. These entries must be unique and in reverse-MRO
// order. Returns true if all of the class types in the hierarchy are
// known, false if one or more are unknown.
function addInheritedDataClassEntries(classType, entries) {
    let allAncestorsAreKnown = true;
    types_1.ClassType.getReverseMro(classType).forEach((mroClass) => {
        if ((0, types_1.isInstantiableClass)(mroClass)) {
            const typeVarContext = (0, typeUtils_1.buildTypeVarContextFromSpecializedClass)(mroClass);
            const dataClassEntries = types_1.ClassType.getDataClassEntries(mroClass);
            // Add the entries to the end of the list, replacing same-named
            // entries if found.
            dataClassEntries.forEach((entry) => {
                const existingIndex = entries.findIndex((e) => e.name === entry.name);
                // If the type from the parent class is generic, we need to convert
                // to the type parameter namespace of child class.
                const updatedEntry = { ...entry };
                updatedEntry.type = (0, typeUtils_1.applySolvedTypeVars)(updatedEntry.type, typeVarContext);
                if (entry.isClassVar) {
                    // If this entry is a class variable, it overrides an existing
                    // instance variable, so delete it.
                    if (existingIndex >= 0) {
                        entries.splice(existingIndex, 1);
                    }
                }
                else if (existingIndex >= 0) {
                    entries[existingIndex] = updatedEntry;
                }
                else {
                    entries.push(updatedEntry);
                }
            });
        }
        else {
            allAncestorsAreKnown = false;
        }
    });
    return allAncestorsAreKnown;
}
exports.addInheritedDataClassEntries = addInheritedDataClassEntries;
function isDataclassFieldConstructor(type, fieldDescriptorNames) {
    let callName;
    if ((0, types_1.isFunction)(type)) {
        callName = type.details.fullName;
    }
    else if ((0, types_1.isOverloadedFunction)(type)) {
        callName = type.overloads[0].details.fullName;
    }
    else if ((0, types_1.isInstantiableClass)(type)) {
        callName = type.details.fullName;
    }
    if (!callName) {
        return false;
    }
    return fieldDescriptorNames.some((name) => name === callName);
}
function validateDataClassTransformDecorator(evaluator, node) {
    const behaviors = {
        skipGenerateInit: false,
        skipGenerateEq: false,
        generateOrder: false,
        generateSlots: false,
        generateHash: false,
        keywordOnly: false,
        frozen: false,
        frozenDefault: false,
        fieldDescriptorNames: [],
    };
    const fileInfo = AnalyzerNodeInfo.getFileInfo(node);
    // Parse the arguments to the call.
    node.arguments.forEach((arg) => {
        if (!arg.name || arg.argumentCategory !== 0 /* ArgumentCategory.Simple */) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallIssue, localize_1.LocMessage.dataClassTransformPositionalParam(), arg);
            return;
        }
        switch (arg.name.value) {
            case 'kw_only_default': {
                const value = (0, staticExpressions_1.evaluateStaticBoolExpression)(arg.valueExpression, fileInfo.executionEnvironment, fileInfo.definedConstants);
                if (value === undefined) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassTransformExpectedBoolLiteral(), arg.valueExpression);
                    return;
                }
                behaviors.keywordOnly = value;
                break;
            }
            case 'eq_default': {
                const value = (0, staticExpressions_1.evaluateStaticBoolExpression)(arg.valueExpression, fileInfo.executionEnvironment, fileInfo.definedConstants);
                if (value === undefined) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassTransformExpectedBoolLiteral(), arg.valueExpression);
                    return;
                }
                behaviors.skipGenerateEq = !value;
                break;
            }
            case 'order_default': {
                const value = (0, staticExpressions_1.evaluateStaticBoolExpression)(arg.valueExpression, fileInfo.executionEnvironment, fileInfo.definedConstants);
                if (value === undefined) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassTransformExpectedBoolLiteral(), arg.valueExpression);
                    return;
                }
                behaviors.generateOrder = value;
                break;
            }
            case 'frozen_default': {
                const value = (0, staticExpressions_1.evaluateStaticBoolExpression)(arg.valueExpression, fileInfo.executionEnvironment, fileInfo.definedConstants);
                if (value === undefined) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassTransformExpectedBoolLiteral(), arg.valueExpression);
                    return;
                }
                behaviors.frozen = value;
                // Store the frozen default separately because any class that
                // doesn't explicitly specify a frozen value will inherit this
                // value rather than the value from its parent.
                behaviors.frozenDefault = value;
                break;
            }
            // Earlier versions of the dataclass_transform spec used the name "field_descriptors"
            // rather than "field_specifiers". The older name is now deprecated but still supported
            // for the time being because some libraries shipped with the older __dataclass_transform__
            // form that supported this older parameter name.
            case 'field_descriptors':
            case 'field_specifiers': {
                const valueType = evaluator.getTypeOfExpression(arg.valueExpression).type;
                if (!(0, types_1.isClassInstance)(valueType) ||
                    !types_1.ClassType.isBuiltIn(valueType, 'tuple') ||
                    !valueType.tupleTypeArguments ||
                    valueType.tupleTypeArguments.some((entry) => !(0, types_1.isInstantiableClass)(entry.type) &&
                        !(0, types_1.isFunction)(entry.type) &&
                        !(0, types_1.isOverloadedFunction)(entry.type))) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassTransformFieldSpecifier().format({
                        type: evaluator.printType(valueType),
                    }), arg.valueExpression);
                    return;
                }
                valueType.tupleTypeArguments.forEach((arg) => {
                    if ((0, types_1.isInstantiableClass)(arg.type) || (0, types_1.isFunction)(arg.type)) {
                        behaviors.fieldDescriptorNames.push(arg.type.details.fullName);
                    }
                    else if ((0, types_1.isOverloadedFunction)(arg.type)) {
                        behaviors.fieldDescriptorNames.push(arg.type.overloads[0].details.fullName);
                    }
                });
                break;
            }
            default:
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassTransformUnknownArgument().format({ name: arg.name.value }), arg.valueExpression);
                break;
        }
    });
    return behaviors;
}
exports.validateDataClassTransformDecorator = validateDataClassTransformDecorator;
function getDataclassDecoratorBehaviors(type) {
    var _a;
    let functionType;
    if ((0, types_1.isFunction)(type)) {
        functionType = type;
    }
    else if ((0, types_1.isOverloadedFunction)(type)) {
        // Find the first overload or implementation that contains a
        // dataclass_transform decorator. If more than one have such a decorator,
        // only the first one will be honored, as per PEP 681.
        functionType =
            (_a = type.overloads.find((overload) => !!overload.details.decoratorDataClassBehaviors)) !== null && _a !== void 0 ? _a : type.overloads[0];
    }
    if (!functionType) {
        return undefined;
    }
    if (functionType.details.decoratorDataClassBehaviors) {
        return functionType.details.decoratorDataClassBehaviors;
    }
    // Is this the built-in dataclass? If so, return the default behaviors.
    if (functionType.details.fullName === 'dataclasses.dataclass') {
        return {
            fieldDescriptorNames: ['dataclasses.field', 'dataclasses.Field'],
        };
    }
    return undefined;
}
exports.getDataclassDecoratorBehaviors = getDataclassDecoratorBehaviors;
function applyDataClassBehaviorOverride(evaluator, errorNode, classType, argName, argValueExpr, behaviors) {
    const fileInfo = AnalyzerNodeInfo.getFileInfo(errorNode);
    const value = (0, staticExpressions_1.evaluateStaticBoolExpression)(argValueExpr, fileInfo.executionEnvironment, fileInfo.definedConstants);
    applyDataClassBehaviorOverrideValue(evaluator, errorNode, classType, argName, value, behaviors);
}
function applyDataClassBehaviorOverrideValue(evaluator, errorNode, classType, argName, argValue, behaviors) {
    switch (argName) {
        case 'order':
            if (argValue !== undefined) {
                behaviors.generateOrder = argValue;
            }
            break;
        case 'kw_only':
            if (argValue !== undefined) {
                behaviors.keywordOnly = argValue;
            }
            break;
        case 'frozen': {
            let hasUnfrozenBaseClass = false;
            let hasFrozenBaseClass = false;
            if (argValue !== undefined) {
                behaviors.frozen = argValue;
            }
            classType.details.baseClasses.forEach((baseClass) => {
                if ((0, types_1.isInstantiableClass)(baseClass) && types_1.ClassType.isDataClass(baseClass)) {
                    if (types_1.ClassType.isDataClassFrozen(baseClass)) {
                        hasFrozenBaseClass = true;
                    }
                    else if (!baseClass.details.classDataClassTransform &&
                        !(baseClass.details.declaredMetaclass &&
                            (0, types_1.isInstantiableClass)(baseClass.details.declaredMetaclass) &&
                            !!baseClass.details.declaredMetaclass.details.classDataClassTransform)) {
                        // If this base class is unfrozen and isn't the class that directly
                        // references the metaclass that provides dataclass-like behaviors,
                        // we'll assume we're deriving from an unfrozen dataclass.
                        hasUnfrozenBaseClass = true;
                    }
                }
            });
            if (argValue) {
                // A frozen dataclass cannot derive from a non-frozen dataclass.
                if (hasUnfrozenBaseClass) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassBaseClassNotFrozen(), errorNode);
                }
            }
            else {
                // A non-frozen dataclass cannot derive from a frozen dataclass.
                if (hasFrozenBaseClass) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassBaseClassFrozen(), errorNode);
                }
            }
            break;
        }
        case 'init':
            if (argValue !== undefined) {
                behaviors.skipGenerateInit = !argValue;
            }
            break;
        case 'eq':
            if (argValue !== undefined) {
                behaviors.skipGenerateEq = !argValue;
            }
            break;
        case 'slots':
            if (argValue === true) {
                behaviors.generateSlots = true;
                if (classType.details.localSlotsNames) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassSlotsOverwrite(), errorNode);
                }
            }
            else if (argValue === false) {
                behaviors.generateSlots = false;
            }
            break;
        case 'hash':
        case 'unsafe_hash':
            if (argValue === true) {
                behaviors.generateHash = true;
            }
            break;
    }
}
function applyDataClassClassBehaviorOverrides(evaluator, errorNode, classType, args, defaultBehaviors) {
    let sawFrozenArg = false;
    const behaviors = { ...defaultBehaviors };
    // The "frozen" behavior is not inherited from the parent class.
    // Instead, it comes from the default.
    behaviors.frozen = behaviors.frozenDefault;
    classType.details.dataClassBehaviors = behaviors;
    args.forEach((arg) => {
        if (arg.valueExpression && arg.name) {
            applyDataClassBehaviorOverride(evaluator, arg.name, classType, arg.name.value, arg.valueExpression, behaviors);
            if (arg.name.value === 'frozen') {
                sawFrozenArg = true;
            }
        }
    });
    // If there was no frozen argument, it is implicitly set to the frozenDefault.
    // This check validates that we're not overriding a frozen class with a
    // non-frozen class or vice versa.
    if (!sawFrozenArg) {
        applyDataClassBehaviorOverrideValue(evaluator, errorNode, classType, 'frozen', defaultBehaviors.frozenDefault, behaviors);
    }
}
exports.applyDataClassClassBehaviorOverrides = applyDataClassClassBehaviorOverrides;
function applyDataClassDecorator(evaluator, errorNode, classType, defaultBehaviors, callNode) {
    var _a;
    applyDataClassClassBehaviorOverrides(evaluator, errorNode, classType, (_a = callNode === null || callNode === void 0 ? void 0 : callNode.arguments) !== null && _a !== void 0 ? _a : [], defaultBehaviors);
}
exports.applyDataClassDecorator = applyDataClassDecorator;
//# sourceMappingURL=dataClasses.js.map