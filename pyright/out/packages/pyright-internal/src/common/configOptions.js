"use strict";
/*
 * configOptions.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Class that holds the configuration options for the analyzer.
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
exports.parseDiagLevel = exports.ConfigOptions = exports.matchFileSpecs = exports.getStrictDiagnosticRuleSet = exports.getStandardDiagnosticRuleSet = exports.getBasicDiagnosticRuleSet = exports.getOffDiagnosticRuleSet = exports.getStrictModeNotOverriddenRules = exports.getDiagLevelDiagnosticRules = exports.getBooleanDiagnosticRules = exports.cloneDiagnosticRuleSet = exports.SignatureDisplayType = exports.ExecutionEnvironment = exports.PythonPlatform = void 0;
const path_1 = require("path");
const pythonPathUtils_1 = require("../analyzer/pythonPathUtils");
const pathConsts = __importStar(require("../common/pathConsts"));
const collectionUtils_1 = require("./collectionUtils");
const console_1 = require("./console");
const diagnosticRules_1 = require("./diagnosticRules");
const pythonVersion_1 = require("./pythonVersion");
const serviceKeys_1 = require("./serviceKeys");
const uri_1 = require("./uri/uri");
const uriUtils_1 = require("./uri/uriUtils");
var PythonPlatform;
(function (PythonPlatform) {
    PythonPlatform["Darwin"] = "Darwin";
    PythonPlatform["Windows"] = "Windows";
    PythonPlatform["Linux"] = "Linux";
})(PythonPlatform || (exports.PythonPlatform = PythonPlatform = {}));
class ExecutionEnvironment {
    // Default to "." which indicates every file in the project.
    constructor(name, root, defaultDiagRuleSet, defaultPythonVersion, defaultPythonPlatform, defaultExtraPaths) {
        // Default to no extra paths.
        this.extraPaths = [];
        this.name = name;
        this.root = root;
        this.pythonVersion = defaultPythonVersion !== null && defaultPythonVersion !== void 0 ? defaultPythonVersion : pythonVersion_1.latestStablePythonVersion;
        this.pythonPlatform = defaultPythonPlatform;
        this.extraPaths = Array.from(defaultExtraPaths !== null && defaultExtraPaths !== void 0 ? defaultExtraPaths : []);
        this.diagnosticRuleSet = { ...defaultDiagRuleSet };
    }
}
exports.ExecutionEnvironment = ExecutionEnvironment;
var SignatureDisplayType;
(function (SignatureDisplayType) {
    SignatureDisplayType["compact"] = "compact";
    SignatureDisplayType["formatted"] = "formatted";
})(SignatureDisplayType || (exports.SignatureDisplayType = SignatureDisplayType = {}));
function cloneDiagnosticRuleSet(diagSettings) {
    // Create a shallow copy of the existing object.
    return Object.assign({}, diagSettings);
}
exports.cloneDiagnosticRuleSet = cloneDiagnosticRuleSet;
// Returns a list of the diagnostic rules that are configured with
// a true or false value.
function getBooleanDiagnosticRules(includeNonOverridable = false) {
    const boolRules = [
        diagnosticRules_1.DiagnosticRule.strictListInference,
        diagnosticRules_1.DiagnosticRule.strictSetInference,
        diagnosticRules_1.DiagnosticRule.strictDictionaryInference,
        diagnosticRules_1.DiagnosticRule.analyzeUnannotatedFunctions,
        diagnosticRules_1.DiagnosticRule.strictParameterNoneValue,
        diagnosticRules_1.DiagnosticRule.enableExperimentalFeatures,
        diagnosticRules_1.DiagnosticRule.deprecateTypingAliases,
        diagnosticRules_1.DiagnosticRule.disableBytesTypePromotions,
    ];
    if (includeNonOverridable) {
        // Do not include this these because we don't
        // want to override it in strict mode or support
        // it within pyright comments.
        boolRules.push(diagnosticRules_1.DiagnosticRule.enableTypeIgnoreComments);
    }
    return boolRules;
}
exports.getBooleanDiagnosticRules = getBooleanDiagnosticRules;
// Returns a list of the diagnostic rules that are configured with
// a diagnostic level ('none', 'error', etc.).
function getDiagLevelDiagnosticRules() {
    return [
        diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues,
        diagnosticRules_1.DiagnosticRule.reportPropertyTypeMismatch,
        diagnosticRules_1.DiagnosticRule.reportFunctionMemberAccess,
        diagnosticRules_1.DiagnosticRule.reportMissingImports,
        diagnosticRules_1.DiagnosticRule.reportMissingModuleSource,
        diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm,
        diagnosticRules_1.DiagnosticRule.reportMissingTypeStubs,
        diagnosticRules_1.DiagnosticRule.reportImportCycles,
        diagnosticRules_1.DiagnosticRule.reportUnusedImport,
        diagnosticRules_1.DiagnosticRule.reportUnusedClass,
        diagnosticRules_1.DiagnosticRule.reportUnusedFunction,
        diagnosticRules_1.DiagnosticRule.reportUnusedVariable,
        diagnosticRules_1.DiagnosticRule.reportDuplicateImport,
        diagnosticRules_1.DiagnosticRule.reportWildcardImportFromLibrary,
        diagnosticRules_1.DiagnosticRule.reportAbstractUsage,
        diagnosticRules_1.DiagnosticRule.reportArgumentType,
        diagnosticRules_1.DiagnosticRule.reportAssertTypeFailure,
        diagnosticRules_1.DiagnosticRule.reportAssignmentType,
        diagnosticRules_1.DiagnosticRule.reportAttributeAccessIssue,
        diagnosticRules_1.DiagnosticRule.reportCallIssue,
        diagnosticRules_1.DiagnosticRule.reportInconsistentOverload,
        diagnosticRules_1.DiagnosticRule.reportIndexIssue,
        diagnosticRules_1.DiagnosticRule.reportInvalidTypeArguments,
        diagnosticRules_1.DiagnosticRule.reportNoOverloadImplementation,
        diagnosticRules_1.DiagnosticRule.reportOperatorIssue,
        diagnosticRules_1.DiagnosticRule.reportOptionalSubscript,
        diagnosticRules_1.DiagnosticRule.reportOptionalMemberAccess,
        diagnosticRules_1.DiagnosticRule.reportOptionalCall,
        diagnosticRules_1.DiagnosticRule.reportOptionalIterable,
        diagnosticRules_1.DiagnosticRule.reportOptionalContextManager,
        diagnosticRules_1.DiagnosticRule.reportOptionalOperand,
        diagnosticRules_1.DiagnosticRule.reportRedeclaration,
        diagnosticRules_1.DiagnosticRule.reportReturnType,
        diagnosticRules_1.DiagnosticRule.reportTypedDictNotRequiredAccess,
        diagnosticRules_1.DiagnosticRule.reportUntypedFunctionDecorator,
        diagnosticRules_1.DiagnosticRule.reportUntypedClassDecorator,
        diagnosticRules_1.DiagnosticRule.reportUntypedBaseClass,
        diagnosticRules_1.DiagnosticRule.reportUntypedNamedTuple,
        diagnosticRules_1.DiagnosticRule.reportPrivateUsage,
        diagnosticRules_1.DiagnosticRule.reportTypeCommentUsage,
        diagnosticRules_1.DiagnosticRule.reportPrivateImportUsage,
        diagnosticRules_1.DiagnosticRule.reportConstantRedefinition,
        diagnosticRules_1.DiagnosticRule.reportDeprecated,
        diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride,
        diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride,
        diagnosticRules_1.DiagnosticRule.reportInconsistentConstructor,
        diagnosticRules_1.DiagnosticRule.reportOverlappingOverload,
        diagnosticRules_1.DiagnosticRule.reportPossiblyUnboundVariable,
        diagnosticRules_1.DiagnosticRule.reportMissingSuperCall,
        diagnosticRules_1.DiagnosticRule.reportUninitializedInstanceVariable,
        diagnosticRules_1.DiagnosticRule.reportInvalidStringEscapeSequence,
        diagnosticRules_1.DiagnosticRule.reportUnknownParameterType,
        diagnosticRules_1.DiagnosticRule.reportUnknownArgumentType,
        diagnosticRules_1.DiagnosticRule.reportUnknownLambdaType,
        diagnosticRules_1.DiagnosticRule.reportUnknownVariableType,
        diagnosticRules_1.DiagnosticRule.reportUnknownMemberType,
        diagnosticRules_1.DiagnosticRule.reportMissingParameterType,
        diagnosticRules_1.DiagnosticRule.reportMissingTypeArgument,
        diagnosticRules_1.DiagnosticRule.reportInvalidTypeVarUse,
        diagnosticRules_1.DiagnosticRule.reportCallInDefaultInitializer,
        diagnosticRules_1.DiagnosticRule.reportUnnecessaryIsInstance,
        diagnosticRules_1.DiagnosticRule.reportUnnecessaryCast,
        diagnosticRules_1.DiagnosticRule.reportUnnecessaryComparison,
        diagnosticRules_1.DiagnosticRule.reportUnnecessaryContains,
        diagnosticRules_1.DiagnosticRule.reportAssertAlwaysTrue,
        diagnosticRules_1.DiagnosticRule.reportSelfClsParameterName,
        diagnosticRules_1.DiagnosticRule.reportImplicitStringConcatenation,
        diagnosticRules_1.DiagnosticRule.reportUndefinedVariable,
        diagnosticRules_1.DiagnosticRule.reportUnhashable,
        diagnosticRules_1.DiagnosticRule.reportUnboundVariable,
        diagnosticRules_1.DiagnosticRule.reportInvalidStubStatement,
        diagnosticRules_1.DiagnosticRule.reportIncompleteStub,
        diagnosticRules_1.DiagnosticRule.reportUnsupportedDunderAll,
        diagnosticRules_1.DiagnosticRule.reportUnusedCallResult,
        diagnosticRules_1.DiagnosticRule.reportUnusedCoroutine,
        diagnosticRules_1.DiagnosticRule.reportUnusedExcept,
        diagnosticRules_1.DiagnosticRule.reportUnusedExpression,
        diagnosticRules_1.DiagnosticRule.reportUnnecessaryTypeIgnoreComment,
        diagnosticRules_1.DiagnosticRule.reportMatchNotExhaustive,
        diagnosticRules_1.DiagnosticRule.reportShadowedImports,
        diagnosticRules_1.DiagnosticRule.reportImplicitOverride,
    ];
}
exports.getDiagLevelDiagnosticRules = getDiagLevelDiagnosticRules;
function getStrictModeNotOverriddenRules() {
    // In strict mode, the value in the user config file should be honored and
    // not overwritten by the value from the strict rule set.
    return [diagnosticRules_1.DiagnosticRule.reportMissingModuleSource];
}
exports.getStrictModeNotOverriddenRules = getStrictModeNotOverriddenRules;
function getOffDiagnosticRuleSet() {
    const diagSettings = {
        printUnknownAsAny: true,
        omitTypeArgsIfUnknown: true,
        omitUnannotatedParamType: true,
        omitConditionalConstraint: true,
        pep604Printing: true,
        strictListInference: false,
        strictSetInference: false,
        strictDictionaryInference: false,
        analyzeUnannotatedFunctions: true,
        strictParameterNoneValue: true,
        enableExperimentalFeatures: false,
        enableTypeIgnoreComments: true,
        deprecateTypingAliases: false,
        disableBytesTypePromotions: false,
        reportGeneralTypeIssues: 'none',
        reportPropertyTypeMismatch: 'none',
        reportFunctionMemberAccess: 'none',
        reportMissingImports: 'warning',
        reportMissingModuleSource: 'warning',
        reportInvalidTypeForm: 'warning',
        reportMissingTypeStubs: 'none',
        reportImportCycles: 'none',
        reportUnusedImport: 'none',
        reportUnusedClass: 'none',
        reportUnusedFunction: 'none',
        reportUnusedVariable: 'none',
        reportDuplicateImport: 'none',
        reportWildcardImportFromLibrary: 'none',
        reportAbstractUsage: 'none',
        reportArgumentType: 'none',
        reportAssertTypeFailure: 'none',
        reportAssignmentType: 'none',
        reportAttributeAccessIssue: 'none',
        reportCallIssue: 'none',
        reportInconsistentOverload: 'none',
        reportIndexIssue: 'none',
        reportInvalidTypeArguments: 'none',
        reportNoOverloadImplementation: 'none',
        reportOperatorIssue: 'none',
        reportOptionalSubscript: 'none',
        reportOptionalMemberAccess: 'none',
        reportOptionalCall: 'none',
        reportOptionalIterable: 'none',
        reportOptionalContextManager: 'none',
        reportOptionalOperand: 'none',
        reportRedeclaration: 'none',
        reportReturnType: 'none',
        reportTypedDictNotRequiredAccess: 'none',
        reportUntypedFunctionDecorator: 'none',
        reportUntypedClassDecorator: 'none',
        reportUntypedBaseClass: 'none',
        reportUntypedNamedTuple: 'none',
        reportPrivateUsage: 'none',
        reportTypeCommentUsage: 'none',
        reportPrivateImportUsage: 'none',
        reportConstantRedefinition: 'none',
        reportDeprecated: 'none',
        reportIncompatibleMethodOverride: 'none',
        reportIncompatibleVariableOverride: 'none',
        reportInconsistentConstructor: 'none',
        reportOverlappingOverload: 'none',
        reportPossiblyUnboundVariable: 'none',
        reportMissingSuperCall: 'none',
        reportUninitializedInstanceVariable: 'none',
        reportInvalidStringEscapeSequence: 'none',
        reportUnknownParameterType: 'none',
        reportUnknownArgumentType: 'none',
        reportUnknownLambdaType: 'none',
        reportUnknownVariableType: 'none',
        reportUnknownMemberType: 'none',
        reportMissingParameterType: 'none',
        reportMissingTypeArgument: 'none',
        reportInvalidTypeVarUse: 'none',
        reportCallInDefaultInitializer: 'none',
        reportUnnecessaryIsInstance: 'none',
        reportUnnecessaryCast: 'none',
        reportUnnecessaryComparison: 'none',
        reportUnnecessaryContains: 'none',
        reportAssertAlwaysTrue: 'none',
        reportSelfClsParameterName: 'none',
        reportImplicitStringConcatenation: 'none',
        reportUnboundVariable: 'none',
        reportUnhashable: 'none',
        reportUndefinedVariable: 'warning',
        reportInvalidStubStatement: 'none',
        reportIncompleteStub: 'none',
        reportUnsupportedDunderAll: 'none',
        reportUnusedCallResult: 'none',
        reportUnusedCoroutine: 'none',
        reportUnusedExcept: 'none',
        reportUnusedExpression: 'none',
        reportUnnecessaryTypeIgnoreComment: 'none',
        reportMatchNotExhaustive: 'none',
        reportShadowedImports: 'none',
        reportImplicitOverride: 'none',
    };
    return diagSettings;
}
exports.getOffDiagnosticRuleSet = getOffDiagnosticRuleSet;
function getBasicDiagnosticRuleSet() {
    const diagSettings = {
        printUnknownAsAny: false,
        omitTypeArgsIfUnknown: false,
        omitUnannotatedParamType: true,
        omitConditionalConstraint: false,
        pep604Printing: true,
        strictListInference: false,
        strictSetInference: false,
        strictDictionaryInference: false,
        analyzeUnannotatedFunctions: true,
        strictParameterNoneValue: true,
        enableExperimentalFeatures: false,
        enableTypeIgnoreComments: true,
        deprecateTypingAliases: false,
        disableBytesTypePromotions: false,
        reportGeneralTypeIssues: 'error',
        reportPropertyTypeMismatch: 'none',
        reportFunctionMemberAccess: 'none',
        reportMissingImports: 'error',
        reportMissingModuleSource: 'warning',
        reportInvalidTypeForm: 'error',
        reportMissingTypeStubs: 'none',
        reportImportCycles: 'none',
        reportUnusedImport: 'none',
        reportUnusedClass: 'none',
        reportUnusedFunction: 'none',
        reportUnusedVariable: 'none',
        reportDuplicateImport: 'none',
        reportWildcardImportFromLibrary: 'warning',
        reportAbstractUsage: 'error',
        reportArgumentType: 'error',
        reportAssertTypeFailure: 'error',
        reportAssignmentType: 'error',
        reportAttributeAccessIssue: 'error',
        reportCallIssue: 'error',
        reportInconsistentOverload: 'error',
        reportIndexIssue: 'error',
        reportInvalidTypeArguments: 'error',
        reportNoOverloadImplementation: 'error',
        reportOperatorIssue: 'error',
        reportOptionalSubscript: 'error',
        reportOptionalMemberAccess: 'error',
        reportOptionalCall: 'error',
        reportOptionalIterable: 'error',
        reportOptionalContextManager: 'error',
        reportOptionalOperand: 'error',
        reportRedeclaration: 'error',
        reportReturnType: 'error',
        reportTypedDictNotRequiredAccess: 'error',
        reportUntypedFunctionDecorator: 'none',
        reportUntypedClassDecorator: 'none',
        reportUntypedBaseClass: 'none',
        reportUntypedNamedTuple: 'none',
        reportPrivateUsage: 'none',
        reportTypeCommentUsage: 'none',
        reportPrivateImportUsage: 'error',
        reportConstantRedefinition: 'none',
        reportDeprecated: 'none',
        reportIncompatibleMethodOverride: 'none',
        reportIncompatibleVariableOverride: 'none',
        reportInconsistentConstructor: 'none',
        reportOverlappingOverload: 'none',
        reportPossiblyUnboundVariable: 'none',
        reportMissingSuperCall: 'none',
        reportUninitializedInstanceVariable: 'none',
        reportInvalidStringEscapeSequence: 'warning',
        reportUnknownParameterType: 'none',
        reportUnknownArgumentType: 'none',
        reportUnknownLambdaType: 'none',
        reportUnknownVariableType: 'none',
        reportUnknownMemberType: 'none',
        reportMissingParameterType: 'none',
        reportMissingTypeArgument: 'none',
        reportInvalidTypeVarUse: 'warning',
        reportCallInDefaultInitializer: 'none',
        reportUnnecessaryIsInstance: 'none',
        reportUnnecessaryCast: 'none',
        reportUnnecessaryComparison: 'none',
        reportUnnecessaryContains: 'none',
        reportAssertAlwaysTrue: 'warning',
        reportSelfClsParameterName: 'warning',
        reportImplicitStringConcatenation: 'none',
        reportUnboundVariable: 'error',
        reportUnhashable: 'error',
        reportUndefinedVariable: 'error',
        reportInvalidStubStatement: 'none',
        reportIncompleteStub: 'none',
        reportUnsupportedDunderAll: 'warning',
        reportUnusedCallResult: 'none',
        reportUnusedCoroutine: 'error',
        reportUnusedExcept: 'error',
        reportUnusedExpression: 'warning',
        reportUnnecessaryTypeIgnoreComment: 'none',
        reportMatchNotExhaustive: 'none',
        reportShadowedImports: 'none',
        reportImplicitOverride: 'none',
    };
    return diagSettings;
}
exports.getBasicDiagnosticRuleSet = getBasicDiagnosticRuleSet;
function getStandardDiagnosticRuleSet() {
    const diagSettings = {
        printUnknownAsAny: false,
        omitTypeArgsIfUnknown: false,
        omitUnannotatedParamType: true,
        omitConditionalConstraint: false,
        pep604Printing: true,
        strictListInference: false,
        strictSetInference: false,
        strictDictionaryInference: false,
        analyzeUnannotatedFunctions: true,
        strictParameterNoneValue: true,
        enableExperimentalFeatures: false,
        enableTypeIgnoreComments: true,
        deprecateTypingAliases: false,
        disableBytesTypePromotions: false,
        reportGeneralTypeIssues: 'error',
        reportPropertyTypeMismatch: 'none',
        reportFunctionMemberAccess: 'error',
        reportMissingImports: 'error',
        reportMissingModuleSource: 'warning',
        reportInvalidTypeForm: 'error',
        reportMissingTypeStubs: 'none',
        reportImportCycles: 'none',
        reportUnusedImport: 'none',
        reportUnusedClass: 'none',
        reportUnusedFunction: 'none',
        reportUnusedVariable: 'none',
        reportDuplicateImport: 'none',
        reportWildcardImportFromLibrary: 'warning',
        reportAbstractUsage: 'error',
        reportArgumentType: 'error',
        reportAssertTypeFailure: 'error',
        reportAssignmentType: 'error',
        reportAttributeAccessIssue: 'error',
        reportCallIssue: 'error',
        reportInconsistentOverload: 'error',
        reportIndexIssue: 'error',
        reportInvalidTypeArguments: 'error',
        reportNoOverloadImplementation: 'error',
        reportOperatorIssue: 'error',
        reportOptionalSubscript: 'error',
        reportOptionalMemberAccess: 'error',
        reportOptionalCall: 'error',
        reportOptionalIterable: 'error',
        reportOptionalContextManager: 'error',
        reportOptionalOperand: 'error',
        reportRedeclaration: 'error',
        reportReturnType: 'error',
        reportTypedDictNotRequiredAccess: 'error',
        reportUntypedFunctionDecorator: 'none',
        reportUntypedClassDecorator: 'none',
        reportUntypedBaseClass: 'none',
        reportUntypedNamedTuple: 'none',
        reportPrivateUsage: 'none',
        reportTypeCommentUsage: 'none',
        reportPrivateImportUsage: 'error',
        reportConstantRedefinition: 'none',
        reportDeprecated: 'none',
        reportIncompatibleMethodOverride: 'error',
        reportIncompatibleVariableOverride: 'error',
        reportInconsistentConstructor: 'none',
        reportOverlappingOverload: 'error',
        reportPossiblyUnboundVariable: 'error',
        reportMissingSuperCall: 'none',
        reportUninitializedInstanceVariable: 'none',
        reportInvalidStringEscapeSequence: 'warning',
        reportUnknownParameterType: 'none',
        reportUnknownArgumentType: 'none',
        reportUnknownLambdaType: 'none',
        reportUnknownVariableType: 'none',
        reportUnknownMemberType: 'none',
        reportMissingParameterType: 'none',
        reportMissingTypeArgument: 'none',
        reportInvalidTypeVarUse: 'warning',
        reportCallInDefaultInitializer: 'none',
        reportUnnecessaryIsInstance: 'none',
        reportUnnecessaryCast: 'none',
        reportUnnecessaryComparison: 'none',
        reportUnnecessaryContains: 'none',
        reportAssertAlwaysTrue: 'warning',
        reportSelfClsParameterName: 'warning',
        reportImplicitStringConcatenation: 'none',
        reportUnboundVariable: 'error',
        reportUnhashable: 'error',
        reportUndefinedVariable: 'error',
        reportInvalidStubStatement: 'none',
        reportIncompleteStub: 'none',
        reportUnsupportedDunderAll: 'warning',
        reportUnusedCallResult: 'none',
        reportUnusedCoroutine: 'error',
        reportUnusedExcept: 'error',
        reportUnusedExpression: 'warning',
        reportUnnecessaryTypeIgnoreComment: 'none',
        reportMatchNotExhaustive: 'none',
        reportShadowedImports: 'none',
        reportImplicitOverride: 'none',
    };
    return diagSettings;
}
exports.getStandardDiagnosticRuleSet = getStandardDiagnosticRuleSet;
function getStrictDiagnosticRuleSet() {
    const diagSettings = {
        printUnknownAsAny: false,
        omitTypeArgsIfUnknown: false,
        omitUnannotatedParamType: false,
        omitConditionalConstraint: false,
        pep604Printing: true,
        strictListInference: true,
        strictSetInference: true,
        strictDictionaryInference: true,
        analyzeUnannotatedFunctions: true,
        strictParameterNoneValue: true,
        enableExperimentalFeatures: false,
        enableTypeIgnoreComments: true,
        deprecateTypingAliases: false,
        disableBytesTypePromotions: true,
        reportGeneralTypeIssues: 'error',
        reportPropertyTypeMismatch: 'none',
        reportFunctionMemberAccess: 'error',
        reportMissingImports: 'error',
        reportMissingModuleSource: 'warning',
        reportInvalidTypeForm: 'error',
        reportMissingTypeStubs: 'error',
        reportImportCycles: 'none',
        reportUnusedImport: 'error',
        reportUnusedClass: 'error',
        reportUnusedFunction: 'error',
        reportUnusedVariable: 'error',
        reportDuplicateImport: 'error',
        reportWildcardImportFromLibrary: 'error',
        reportAbstractUsage: 'error',
        reportArgumentType: 'error',
        reportAssertTypeFailure: 'error',
        reportAssignmentType: 'error',
        reportAttributeAccessIssue: 'error',
        reportCallIssue: 'error',
        reportInconsistentOverload: 'error',
        reportIndexIssue: 'error',
        reportInvalidTypeArguments: 'error',
        reportNoOverloadImplementation: 'error',
        reportOperatorIssue: 'error',
        reportOptionalSubscript: 'error',
        reportOptionalMemberAccess: 'error',
        reportOptionalCall: 'error',
        reportOptionalIterable: 'error',
        reportOptionalContextManager: 'error',
        reportOptionalOperand: 'error',
        reportRedeclaration: 'error',
        reportReturnType: 'error',
        reportTypedDictNotRequiredAccess: 'error',
        reportUntypedFunctionDecorator: 'error',
        reportUntypedClassDecorator: 'error',
        reportUntypedBaseClass: 'error',
        reportUntypedNamedTuple: 'error',
        reportPrivateUsage: 'error',
        reportTypeCommentUsage: 'error',
        reportPrivateImportUsage: 'error',
        reportConstantRedefinition: 'error',
        reportDeprecated: 'error',
        reportIncompatibleMethodOverride: 'error',
        reportIncompatibleVariableOverride: 'error',
        reportInconsistentConstructor: 'error',
        reportOverlappingOverload: 'error',
        reportPossiblyUnboundVariable: 'error',
        reportMissingSuperCall: 'none',
        reportUninitializedInstanceVariable: 'none',
        reportInvalidStringEscapeSequence: 'error',
        reportUnknownParameterType: 'error',
        reportUnknownArgumentType: 'error',
        reportUnknownLambdaType: 'error',
        reportUnknownVariableType: 'error',
        reportUnknownMemberType: 'error',
        reportMissingParameterType: 'error',
        reportMissingTypeArgument: 'error',
        reportInvalidTypeVarUse: 'error',
        reportCallInDefaultInitializer: 'none',
        reportUnnecessaryIsInstance: 'error',
        reportUnnecessaryCast: 'error',
        reportUnnecessaryComparison: 'error',
        reportUnnecessaryContains: 'error',
        reportAssertAlwaysTrue: 'error',
        reportSelfClsParameterName: 'error',
        reportImplicitStringConcatenation: 'none',
        reportUnboundVariable: 'error',
        reportUnhashable: 'error',
        reportUndefinedVariable: 'error',
        reportInvalidStubStatement: 'error',
        reportIncompleteStub: 'error',
        reportUnsupportedDunderAll: 'error',
        reportUnusedCallResult: 'none',
        reportUnusedCoroutine: 'error',
        reportUnusedExcept: 'error',
        reportUnusedExpression: 'error',
        reportUnnecessaryTypeIgnoreComment: 'none',
        reportMatchNotExhaustive: 'error',
        reportShadowedImports: 'none',
        reportImplicitOverride: 'none',
    };
    return diagSettings;
}
exports.getStrictDiagnosticRuleSet = getStrictDiagnosticRuleSet;
function matchFileSpecs(configOptions, uri, isFile = true) {
    for (const includeSpec of configOptions.include) {
        if (uriUtils_1.FileSpec.matchIncludeFileSpec(includeSpec.regExp, configOptions.exclude, uri, isFile)) {
            return true;
        }
    }
    return false;
}
exports.matchFileSpecs = matchFileSpecs;
// Internal configuration options. These are derived from a combination
// of the command line and from a JSON-based config file.
class ConfigOptions {
    constructor(projectRoot) {
        // A list of file specs to include in the analysis. Can contain
        // directories, in which case all "*.py" files within those directories
        // are included.
        this.include = [];
        // A list of file specs to exclude from the analysis (overriding include
        // if necessary). Can contain directories, in which case all "*.py" files
        // within those directories are included.
        this.exclude = [];
        // A list of file specs whose errors and warnings should be ignored even
        // if they are included in the transitive closure of included files.
        this.ignore = [];
        // A list of file specs that should be analyzed using "strict" mode.
        this.strict = [];
        // A set of defined constants that are used by the binder to determine
        // whether runtime conditions should evaluate to True or False.
        this.defineConstant = new Map();
        // Offer auto-import completions.
        this.autoImportCompletions = true;
        // Use indexing.
        this.indexing = false;
        // Use type evaluator call tracking
        this.logTypeEvaluationTime = false;
        // Minimum threshold for type eval logging
        this.typeEvaluationTimeThreshold = 50;
        // Was this config initialized from JSON (pyrightconfig/pyproject)?
        this.initializedFromJson = false;
        // Filter out any hint diagnostics with tags?
        this.disableTaggedHints = false;
        //---------------------------------------------------------------
        // Parsing and Import Resolution Settings
        // Parameters that specify the execution environment for
        // the files being analyzed.
        this.executionEnvironments = [];
        this.projectRoot = projectRoot;
        this.diagnosticRuleSet = ConfigOptions.getDiagnosticRuleSet();
        this.functionSignatureDisplay = SignatureDisplayType.formatted;
    }
    static getDiagnosticRuleSet(typeCheckingMode) {
        if (typeCheckingMode === 'strict') {
            return getStrictDiagnosticRuleSet();
        }
        if (typeCheckingMode === 'basic') {
            return getBasicDiagnosticRuleSet();
        }
        if (typeCheckingMode === 'off') {
            return getOffDiagnosticRuleSet();
        }
        return getStandardDiagnosticRuleSet();
    }
    getDefaultExecEnvironment() {
        return new ExecutionEnvironment(this._getEnvironmentName(), this.projectRoot, this.diagnosticRuleSet, this.defaultPythonVersion, this.defaultPythonPlatform, this.defaultExtraPaths);
    }
    // Finds the best execution environment for a given file uri. The
    // specified file path should be absolute.
    // If no matching execution environment can be found, a default
    // execution environment is used.
    findExecEnvironment(file) {
        var _a;
        return ((_a = this.executionEnvironments.find((env) => {
            const envRoot = uri_1.Uri.is(env.root) ? env.root : this.projectRoot.resolvePaths(env.root || '');
            return file.startsWith(envRoot);
        })) !== null && _a !== void 0 ? _a : this.getDefaultExecEnvironment());
    }
    getExecutionEnvironments() {
        if (this.executionEnvironments.length > 0) {
            return this.executionEnvironments;
        }
        return [this.getDefaultExecEnvironment()];
    }
    initializeTypeCheckingMode(typeCheckingMode, severityOverrides) {
        this.diagnosticRuleSet = ConfigOptions.getDiagnosticRuleSet(typeCheckingMode);
        if (severityOverrides) {
            this.applyDiagnosticOverrides(severityOverrides);
        }
    }
    // Initialize the structure from a JSON object.
    initializeFromJson(configObj, configDirUri, serviceProvider, host, commandLineOptions) {
        var _a;
        this.initializedFromJson = true;
        const console = (_a = serviceProvider.tryGet(serviceKeys_1.ServiceKeys.console)) !== null && _a !== void 0 ? _a : new console_1.NullConsole();
        // Read the "include" entry.
        if (configObj.include !== undefined) {
            if (!Array.isArray(configObj.include)) {
                console.error(`Config "include" entry must contain an array.`);
            }
            else {
                this.include = [];
                const filesList = configObj.include;
                filesList.forEach((fileSpec, index) => {
                    if (typeof fileSpec !== 'string') {
                        console.error(`Index ${index} of "include" array should be a string.`);
                    }
                    else if ((0, path_1.isAbsolute)(fileSpec)) {
                        console.error(`Ignoring path "${fileSpec}" in "include" array because it is not relative.`);
                    }
                    else {
                        this.include.push((0, uriUtils_1.getFileSpec)(configDirUri, fileSpec));
                    }
                });
            }
        }
        // Read the "exclude" entry.
        if (configObj.exclude !== undefined) {
            if (!Array.isArray(configObj.exclude)) {
                console.error(`Config "exclude" entry must contain an array.`);
            }
            else {
                this.exclude = [];
                const filesList = configObj.exclude;
                filesList.forEach((fileSpec, index) => {
                    if (typeof fileSpec !== 'string') {
                        console.error(`Index ${index} of "exclude" array should be a string.`);
                    }
                    else if ((0, path_1.isAbsolute)(fileSpec)) {
                        console.error(`Ignoring path "${fileSpec}" in "exclude" array because it is not relative.`);
                    }
                    else {
                        this.exclude.push((0, uriUtils_1.getFileSpec)(configDirUri, fileSpec));
                    }
                });
            }
        }
        // Read the "ignore" entry.
        if (configObj.ignore !== undefined) {
            if (!Array.isArray(configObj.ignore)) {
                console.error(`Config "ignore" entry must contain an array.`);
            }
            else {
                this.ignore = [];
                const filesList = configObj.ignore;
                filesList.forEach((fileSpec, index) => {
                    if (typeof fileSpec !== 'string') {
                        console.error(`Index ${index} of "ignore" array should be a string.`);
                    }
                    else if ((0, path_1.isAbsolute)(fileSpec)) {
                        console.error(`Ignoring path "${fileSpec}" in "ignore" array because it is not relative.`);
                    }
                    else {
                        this.ignore.push((0, uriUtils_1.getFileSpec)(configDirUri, fileSpec));
                    }
                });
            }
        }
        // Read the "strict" entry.
        if (configObj.strict !== undefined) {
            if (!Array.isArray(configObj.strict)) {
                console.error(`Config "strict" entry must contain an array.`);
            }
            else {
                this.strict = [];
                const filesList = configObj.strict;
                filesList.forEach((fileSpec, index) => {
                    if (typeof fileSpec !== 'string') {
                        console.error(`Index ${index} of "strict" array should be a string.`);
                    }
                    else if ((0, path_1.isAbsolute)(fileSpec)) {
                        console.error(`Ignoring path "${fileSpec}" in "strict" array because it is not relative.`);
                    }
                    else {
                        this.strict.push((0, uriUtils_1.getFileSpec)(configDirUri, fileSpec));
                    }
                });
            }
        }
        // If there is a "typeCheckingMode", it can override the provided setting.
        if (configObj.typeCheckingMode !== undefined) {
            if (configObj.typeCheckingMode === 'off' ||
                configObj.typeCheckingMode === 'basic' ||
                configObj.typeCheckingMode === 'standard' ||
                configObj.typeCheckingMode === 'strict') {
                this.diagnosticRuleSet = { ...ConfigOptions.getDiagnosticRuleSet(configObj.typeCheckingMode) };
            }
            else {
                console.error(`Config "typeCheckingMode" entry must contain "off", "basic", "standard", or "strict".`);
            }
        }
        if (configObj.useLibraryCodeForTypes !== undefined) {
            if (typeof configObj.useLibraryCodeForTypes === 'boolean') {
                this.useLibraryCodeForTypes = configObj.useLibraryCodeForTypes;
            }
            else {
                console.error(`Config "useLibraryCodeForTypes" entry must be true or false.`);
            }
        }
        // Apply overrides from the config file for the boolean rules.
        getBooleanDiagnosticRules(/* includeNonOverridable */ true).forEach((ruleName) => {
            this.diagnosticRuleSet[ruleName] = this._convertBoolean(configObj[ruleName], ruleName, this.diagnosticRuleSet[ruleName]);
        });
        // Apply overrides from the config file for the diagnostic level rules.
        getDiagLevelDiagnosticRules().forEach((ruleName) => {
            this.diagnosticRuleSet[ruleName] = this._convertDiagnosticLevel(configObj[ruleName], ruleName, this.diagnosticRuleSet[ruleName]);
        });
        // Read the "venvPath".
        if (configObj.venvPath !== undefined) {
            if (typeof configObj.venvPath !== 'string') {
                console.error(`Config "venvPath" field must contain a string.`);
            }
            else {
                this.venvPath = configDirUri.resolvePaths(configObj.venvPath);
            }
        }
        // Read the "venv" name.
        if (configObj.venv !== undefined) {
            if (typeof configObj.venv !== 'string') {
                console.error(`Config "venv" field must contain a string.`);
            }
            else {
                this.venv = configObj.venv;
            }
        }
        // Read the default "extraPaths".
        if (configObj.extraPaths !== undefined) {
            this.defaultExtraPaths = [];
            if (!Array.isArray(configObj.extraPaths)) {
                console.error(`Config "extraPaths" field must contain an array.`);
            }
            else {
                const pathList = configObj.extraPaths;
                pathList.forEach((path, pathIndex) => {
                    if (typeof path !== 'string') {
                        console.error(`Config "extraPaths" field ${pathIndex} must be a string.`);
                    }
                    else {
                        this.defaultExtraPaths.push(configDirUri.resolvePaths(path));
                    }
                });
            }
        }
        // Read the default "pythonVersion".
        if (configObj.pythonVersion !== undefined) {
            if (typeof configObj.pythonVersion === 'string') {
                const version = pythonVersion_1.PythonVersion.fromString(configObj.pythonVersion);
                if (version) {
                    this.defaultPythonVersion = version;
                }
                else {
                    console.error(`Config "pythonVersion" field contains unsupported version.`);
                }
            }
            else {
                console.error(`Config "pythonVersion" field must contain a string.`);
            }
        }
        // Override the default python version if it was specified on the command line.
        if (commandLineOptions === null || commandLineOptions === void 0 ? void 0 : commandLineOptions.pythonVersion) {
            this.defaultPythonVersion = commandLineOptions.pythonVersion;
        }
        this.ensureDefaultPythonVersion(host, console);
        // Read the default "pythonPlatform".
        if (configObj.pythonPlatform !== undefined) {
            if (typeof configObj.pythonPlatform !== 'string') {
                console.error(`Config "pythonPlatform" field must contain a string.`);
            }
            else {
                this.defaultPythonPlatform = configObj.pythonPlatform;
            }
        }
        if (commandLineOptions === null || commandLineOptions === void 0 ? void 0 : commandLineOptions.pythonPlatform) {
            this.defaultPythonPlatform = commandLineOptions.pythonPlatform;
        }
        this.ensureDefaultPythonPlatform(host, console);
        // Read the "typeshedPath" setting.
        if (configObj.typeshedPath !== undefined) {
            if (typeof configObj.typeshedPath !== 'string') {
                console.error(`Config "typeshedPath" field must contain a string.`);
            }
            else {
                this.typeshedPath = configObj.typeshedPath
                    ? configDirUri.resolvePaths(configObj.typeshedPath)
                    : undefined;
            }
        }
        // Read the "stubPath" setting.
        // Keep this for backward compatibility
        if (configObj.typingsPath !== undefined) {
            if (typeof configObj.typingsPath !== 'string') {
                console.error(`Config "typingsPath" field must contain a string.`);
            }
            else {
                console.error(`Config "typingsPath" is now deprecated. Please, use stubPath instead.`);
                this.stubPath = configDirUri.resolvePaths(configObj.typingsPath);
            }
        }
        if (configObj.stubPath !== undefined) {
            if (typeof configObj.stubPath !== 'string') {
                console.error(`Config "stubPath" field must contain a string.`);
            }
            else {
                this.stubPath = configDirUri.resolvePaths(configObj.stubPath);
            }
        }
        // Read the "verboseOutput" setting.
        // Don't initialize to a default value because we want the command-line "verbose"
        // switch to apply if this setting isn't specified in the config file.
        if (configObj.verboseOutput !== undefined) {
            if (typeof configObj.verboseOutput !== 'boolean') {
                console.error(`Config "verboseOutput" field must be true or false.`);
            }
            else {
                this.verboseOutput = configObj.verboseOutput;
            }
        }
        // Read the "defineConstant" setting.
        if (configObj.defineConstant !== undefined) {
            if (typeof configObj.defineConstant !== 'object' || Array.isArray(configObj.defineConstant)) {
                console.error(`Config "defineConstant" field must contain a map indexed by constant names.`);
            }
            else {
                const keys = Object.getOwnPropertyNames(configObj.defineConstant);
                keys.forEach((key) => {
                    const value = configObj.defineConstant[key];
                    const valueType = typeof value;
                    if (valueType !== 'boolean' && valueType !== 'string') {
                        console.error(`Defined constant "${key}" must be associated with a boolean or string value.`);
                    }
                    else {
                        this.defineConstant.set(key, value);
                    }
                });
            }
        }
        // Read the "useLibraryCodeForTypes" setting.
        if (configObj.useLibraryCodeForTypes !== undefined) {
            if (typeof configObj.useLibraryCodeForTypes !== 'boolean') {
                console.error(`Config "useLibraryCodeForTypes" field must be true or false.`);
            }
            else {
                this.useLibraryCodeForTypes = configObj.useLibraryCodeForTypes;
            }
        }
        // Read the "executionEnvironments" array. This should be done at the end
        // after we've established default values.
        if (configObj.executionEnvironments !== undefined) {
            if (!Array.isArray(configObj.executionEnvironments)) {
                console.error(`Config "executionEnvironments" field must contain an array.`);
            }
            else {
                this.executionEnvironments = [];
                const execEnvironments = configObj.executionEnvironments;
                execEnvironments.forEach((env, index) => {
                    const execEnv = this._initExecutionEnvironmentFromJson(env, configDirUri, index, console, commandLineOptions);
                    if (execEnv) {
                        this.executionEnvironments.push(execEnv);
                    }
                });
            }
        }
        // Read the "autoImportCompletions" setting.
        if (configObj.autoImportCompletions !== undefined) {
            if (typeof configObj.autoImportCompletions !== 'boolean') {
                console.error(`Config "autoImportCompletions" field must be true or false.`);
            }
            else {
                this.autoImportCompletions = configObj.autoImportCompletions;
            }
        }
        // Read the "indexing" setting.
        if (configObj.indexing !== undefined) {
            if (typeof configObj.indexing !== 'boolean') {
                console.error(`Config "indexing" field must be true or false.`);
            }
            else {
                this.indexing = configObj.indexing;
            }
        }
        // Read the "logTypeEvaluationTime" setting.
        if (configObj.logTypeEvaluationTime !== undefined) {
            if (typeof configObj.logTypeEvaluationTime !== 'boolean') {
                console.error(`Config "logTypeEvaluationTime" field must be true or false.`);
            }
            else {
                this.logTypeEvaluationTime = configObj.logTypeEvaluationTime;
            }
        }
        // Read the "typeEvaluationTimeThreshold" setting.
        if (configObj.typeEvaluationTimeThreshold !== undefined) {
            if (typeof configObj.typeEvaluationTimeThreshold !== 'number') {
                console.error(`Config "typeEvaluationTimeThreshold" field must be a number.`);
            }
            else {
                this.typeEvaluationTimeThreshold = configObj.typeEvaluationTimeThreshold;
            }
        }
        // Read the "functionSignatureDisplay" setting.
        if (configObj.functionSignatureDisplay !== undefined) {
            if (typeof configObj.functionSignatureDisplay !== 'string') {
                console.error(`Config "functionSignatureDisplay" field must be true or false.`);
            }
            else {
                if (configObj.functionSignatureDisplay === 'compact' ||
                    configObj.functionSignatureDisplay === 'formatted') {
                    this.functionSignatureDisplay = configObj.functionSignatureDisplay;
                }
            }
        }
    }
    static resolveExtends(configObj, configDirUri) {
        if (configObj.extends !== undefined) {
            if (typeof configObj.extends !== 'string') {
                console.error(`Config "extends" field must contain a string.`);
            }
            else {
                return configDirUri.resolvePaths(configObj.extends);
            }
        }
        return undefined;
    }
    ensureDefaultPythonPlatform(host, console) {
        // If no default python platform was specified, assume that the
        // user wants to use the current platform.
        if (this.defaultPythonPlatform !== undefined) {
            return;
        }
        this.defaultPythonPlatform = host.getPythonPlatform();
        if (this.defaultPythonPlatform !== undefined) {
            console.log(`Assuming Python platform ${this.defaultPythonPlatform}`);
        }
    }
    ensureDefaultPythonVersion(host, console) {
        // If no default python version was specified, retrieve the version
        // from the currently-selected python interpreter.
        if (this.defaultPythonVersion !== undefined) {
            return;
        }
        const importFailureInfo = [];
        this.defaultPythonVersion = host.getPythonVersion(this.pythonPath, importFailureInfo);
        if (this.defaultPythonVersion !== undefined) {
            console.info(`Assuming Python version ${this.defaultPythonVersion.toString()}`);
        }
        for (const log of importFailureInfo) {
            console.info(log);
        }
    }
    ensureDefaultExtraPaths(fs, autoSearchPaths, extraPaths) {
        const paths = [];
        if (autoSearchPaths) {
            // Auto-detect the common scenario where the sources are under the src folder
            const srcPath = this.projectRoot.resolvePaths(pathConsts.src);
            if (fs.existsSync(srcPath) && !fs.existsSync(srcPath.resolvePaths('__init__.py'))) {
                paths.push(fs.realCasePath(srcPath));
            }
        }
        if (extraPaths && extraPaths.length > 0) {
            for (const p of extraPaths) {
                const path = this.projectRoot.resolvePaths(p);
                paths.push(fs.realCasePath(path));
                if ((0, uriUtils_1.isDirectory)(fs, path)) {
                    (0, collectionUtils_1.appendArray)(paths, (0, pythonPathUtils_1.getPathsFromPthFiles)(fs, path));
                }
            }
        }
        if (paths.length > 0) {
            this.defaultExtraPaths = paths;
        }
    }
    applyDiagnosticOverrides(diagnosticSeverityOverrides) {
        if (!diagnosticSeverityOverrides) {
            return;
        }
        for (const ruleName of getDiagLevelDiagnosticRules()) {
            const severity = diagnosticSeverityOverrides[ruleName];
            if (severity !== undefined) {
                this.diagnosticRuleSet[ruleName] = severity;
            }
        }
    }
    _getEnvironmentName() {
        var _a;
        return this.pythonEnvironmentName || ((_a = this.pythonPath) === null || _a === void 0 ? void 0 : _a.toString()) || 'python';
    }
    _convertBoolean(value, fieldName, defaultValue) {
        if (value === undefined) {
            return defaultValue;
        }
        else if (typeof value === 'boolean') {
            return value ? true : false;
        }
        console.log(`Config "${fieldName}" entry must be true or false.`);
        return defaultValue;
    }
    _convertDiagnosticLevel(value, fieldName, defaultValue) {
        if (value === undefined) {
            return defaultValue;
        }
        else if (typeof value === 'boolean') {
            return value ? 'error' : 'none';
        }
        else if (typeof value === 'string') {
            if (value === 'error' || value === 'warning' || value === 'information' || value === 'none') {
                return value;
            }
        }
        console.log(`Config "${fieldName}" entry must be true, false, "error", "warning", "information" or "none".`);
        return defaultValue;
    }
    _initExecutionEnvironmentFromJson(envObj, configDirUri, index, console, commandLineOptions) {
        try {
            const newExecEnv = new ExecutionEnvironment(this._getEnvironmentName(), configDirUri, this.diagnosticRuleSet, this.defaultPythonVersion, this.defaultPythonPlatform, this.defaultExtraPaths);
            // Validate the root.
            if (envObj.root && typeof envObj.root === 'string') {
                newExecEnv.root = configDirUri.resolvePaths(envObj.root);
            }
            else {
                console.error(`Config executionEnvironments index ${index}: missing root value.`);
            }
            // Validate the extraPaths.
            if (envObj.extraPaths) {
                if (!Array.isArray(envObj.extraPaths)) {
                    console.error(`Config executionEnvironments index ${index}: extraPaths field must contain an array.`);
                }
                else {
                    const pathList = envObj.extraPaths;
                    pathList.forEach((path, pathIndex) => {
                        if (typeof path !== 'string') {
                            console.error(`Config executionEnvironments index ${index}:` +
                                ` extraPaths field ${pathIndex} must be a string.`);
                        }
                        else {
                            newExecEnv.extraPaths.push(configDirUri.resolvePaths(path));
                        }
                    });
                }
            }
            // Validate the pythonVersion.
            if (envObj.pythonVersion) {
                if (typeof envObj.pythonVersion === 'string') {
                    const version = pythonVersion_1.PythonVersion.fromString(envObj.pythonVersion);
                    if (version) {
                        newExecEnv.pythonVersion = version;
                    }
                    else {
                        console.warn(`Config executionEnvironments index ${index} contains unsupported pythonVersion.`);
                    }
                }
                else {
                    console.error(`Config executionEnvironments index ${index} pythonVersion must be a string.`);
                }
            }
            // If the pythonVersion was specified on the command line, it overrides
            // the configuration settings for the execution environment.
            if (commandLineOptions === null || commandLineOptions === void 0 ? void 0 : commandLineOptions.pythonVersion) {
                newExecEnv.pythonVersion = commandLineOptions.pythonVersion;
            }
            // Validate the pythonPlatform.
            if (envObj.pythonPlatform) {
                if (typeof envObj.pythonPlatform === 'string') {
                    newExecEnv.pythonPlatform = envObj.pythonPlatform;
                }
                else {
                    console.error(`Config executionEnvironments index ${index} pythonPlatform must be a string.`);
                }
            }
            // If the pythonPlatform was specified on the command line, it overrides
            // the configuration settings for the execution environment.
            if (commandLineOptions === null || commandLineOptions === void 0 ? void 0 : commandLineOptions.pythonPlatform) {
                newExecEnv.pythonPlatform = commandLineOptions.pythonPlatform;
            }
            // Validate the name
            if (envObj.name) {
                if (typeof envObj.name === 'string') {
                    newExecEnv.name = envObj.name;
                }
                else {
                    console.error(`Config executionEnvironments index ${index} pythonPlatform must be a string.`);
                }
            }
            // Apply overrides from the config file for the boolean overrides.
            getBooleanDiagnosticRules(/* includeNonOverridable */ true).forEach((ruleName) => {
                newExecEnv.diagnosticRuleSet[ruleName] = this._convertBoolean(envObj[ruleName], ruleName, newExecEnv.diagnosticRuleSet[ruleName]);
            });
            // Apply overrides from the config file for the diagnostic level overrides.
            getDiagLevelDiagnosticRules().forEach((ruleName) => {
                newExecEnv.diagnosticRuleSet[ruleName] = this._convertDiagnosticLevel(envObj[ruleName], ruleName, newExecEnv.diagnosticRuleSet[ruleName]);
            });
            return newExecEnv;
        }
        catch {
            console.error(`Config executionEnvironments index ${index} is not accessible.`);
        }
        return undefined;
    }
}
exports.ConfigOptions = ConfigOptions;
function parseDiagLevel(value) {
    switch (value) {
        case false:
        case 'none':
            return "none" /* DiagnosticSeverityOverrides.None */;
        case true:
        case 'error':
            return "error" /* DiagnosticSeverityOverrides.Error */;
        case 'warning':
            return "warning" /* DiagnosticSeverityOverrides.Warning */;
        case 'information':
            return "information" /* DiagnosticSeverityOverrides.Information */;
        default:
            return undefined;
    }
}
exports.parseDiagLevel = parseDiagLevel;
//# sourceMappingURL=configOptions.js.map