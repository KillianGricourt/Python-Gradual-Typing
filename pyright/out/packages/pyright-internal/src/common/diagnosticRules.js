"use strict";
/*
 * diagnosticRules.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Strings that represent each of the diagnostic rules
 * that can be enabled or disabled in the configuration.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticRule = void 0;
// Not const enum since keys need to be inspected in tests
// to match declaration of user-visible settings in package.json
var DiagnosticRule;
(function (DiagnosticRule) {
    DiagnosticRule["strictListInference"] = "strictListInference";
    DiagnosticRule["strictSetInference"] = "strictSetInference";
    DiagnosticRule["strictDictionaryInference"] = "strictDictionaryInference";
    DiagnosticRule["analyzeUnannotatedFunctions"] = "analyzeUnannotatedFunctions";
    DiagnosticRule["strictParameterNoneValue"] = "strictParameterNoneValue";
    DiagnosticRule["enableExperimentalFeatures"] = "enableExperimentalFeatures";
    DiagnosticRule["enableTypeIgnoreComments"] = "enableTypeIgnoreComments";
    DiagnosticRule["deprecateTypingAliases"] = "deprecateTypingAliases";
    DiagnosticRule["disableBytesTypePromotions"] = "disableBytesTypePromotions";
    DiagnosticRule["reportGeneralTypeIssues"] = "reportGeneralTypeIssues";
    DiagnosticRule["reportPropertyTypeMismatch"] = "reportPropertyTypeMismatch";
    DiagnosticRule["reportFunctionMemberAccess"] = "reportFunctionMemberAccess";
    DiagnosticRule["reportMissingImports"] = "reportMissingImports";
    DiagnosticRule["reportMissingModuleSource"] = "reportMissingModuleSource";
    DiagnosticRule["reportInvalidTypeForm"] = "reportInvalidTypeForm";
    DiagnosticRule["reportMissingTypeStubs"] = "reportMissingTypeStubs";
    DiagnosticRule["reportImportCycles"] = "reportImportCycles";
    DiagnosticRule["reportUnusedImport"] = "reportUnusedImport";
    DiagnosticRule["reportUnusedClass"] = "reportUnusedClass";
    DiagnosticRule["reportUnusedFunction"] = "reportUnusedFunction";
    DiagnosticRule["reportUnusedVariable"] = "reportUnusedVariable";
    DiagnosticRule["reportDuplicateImport"] = "reportDuplicateImport";
    DiagnosticRule["reportWildcardImportFromLibrary"] = "reportWildcardImportFromLibrary";
    DiagnosticRule["reportAbstractUsage"] = "reportAbstractUsage";
    DiagnosticRule["reportArgumentType"] = "reportArgumentType";
    DiagnosticRule["reportAssertTypeFailure"] = "reportAssertTypeFailure";
    DiagnosticRule["reportAssignmentType"] = "reportAssignmentType";
    DiagnosticRule["reportAttributeAccessIssue"] = "reportAttributeAccessIssue";
    DiagnosticRule["reportCallIssue"] = "reportCallIssue";
    DiagnosticRule["reportInconsistentOverload"] = "reportInconsistentOverload";
    DiagnosticRule["reportIndexIssue"] = "reportIndexIssue";
    DiagnosticRule["reportInvalidTypeArguments"] = "reportInvalidTypeArguments";
    DiagnosticRule["reportNoOverloadImplementation"] = "reportNoOverloadImplementation";
    DiagnosticRule["reportOperatorIssue"] = "reportOperatorIssue";
    DiagnosticRule["reportOptionalSubscript"] = "reportOptionalSubscript";
    DiagnosticRule["reportOptionalMemberAccess"] = "reportOptionalMemberAccess";
    DiagnosticRule["reportOptionalCall"] = "reportOptionalCall";
    DiagnosticRule["reportOptionalIterable"] = "reportOptionalIterable";
    DiagnosticRule["reportOptionalContextManager"] = "reportOptionalContextManager";
    DiagnosticRule["reportOptionalOperand"] = "reportOptionalOperand";
    DiagnosticRule["reportRedeclaration"] = "reportRedeclaration";
    DiagnosticRule["reportReturnType"] = "reportReturnType";
    DiagnosticRule["reportTypedDictNotRequiredAccess"] = "reportTypedDictNotRequiredAccess";
    DiagnosticRule["reportUntypedFunctionDecorator"] = "reportUntypedFunctionDecorator";
    DiagnosticRule["reportUntypedClassDecorator"] = "reportUntypedClassDecorator";
    DiagnosticRule["reportUntypedBaseClass"] = "reportUntypedBaseClass";
    DiagnosticRule["reportUntypedNamedTuple"] = "reportUntypedNamedTuple";
    DiagnosticRule["reportPrivateUsage"] = "reportPrivateUsage";
    DiagnosticRule["reportTypeCommentUsage"] = "reportTypeCommentUsage";
    DiagnosticRule["reportPrivateImportUsage"] = "reportPrivateImportUsage";
    DiagnosticRule["reportConstantRedefinition"] = "reportConstantRedefinition";
    DiagnosticRule["reportDeprecated"] = "reportDeprecated";
    DiagnosticRule["reportIncompatibleMethodOverride"] = "reportIncompatibleMethodOverride";
    DiagnosticRule["reportIncompatibleVariableOverride"] = "reportIncompatibleVariableOverride";
    DiagnosticRule["reportInconsistentConstructor"] = "reportInconsistentConstructor";
    DiagnosticRule["reportOverlappingOverload"] = "reportOverlappingOverload";
    DiagnosticRule["reportPossiblyUnboundVariable"] = "reportPossiblyUnboundVariable";
    DiagnosticRule["reportMissingSuperCall"] = "reportMissingSuperCall";
    DiagnosticRule["reportUninitializedInstanceVariable"] = "reportUninitializedInstanceVariable";
    DiagnosticRule["reportInvalidStringEscapeSequence"] = "reportInvalidStringEscapeSequence";
    DiagnosticRule["reportUnknownParameterType"] = "reportUnknownParameterType";
    DiagnosticRule["reportUnknownArgumentType"] = "reportUnknownArgumentType";
    DiagnosticRule["reportUnknownLambdaType"] = "reportUnknownLambdaType";
    DiagnosticRule["reportUnknownVariableType"] = "reportUnknownVariableType";
    DiagnosticRule["reportUnknownMemberType"] = "reportUnknownMemberType";
    DiagnosticRule["reportMissingParameterType"] = "reportMissingParameterType";
    DiagnosticRule["reportMissingTypeArgument"] = "reportMissingTypeArgument";
    DiagnosticRule["reportInvalidTypeVarUse"] = "reportInvalidTypeVarUse";
    DiagnosticRule["reportCallInDefaultInitializer"] = "reportCallInDefaultInitializer";
    DiagnosticRule["reportUnnecessaryIsInstance"] = "reportUnnecessaryIsInstance";
    DiagnosticRule["reportUnnecessaryCast"] = "reportUnnecessaryCast";
    DiagnosticRule["reportUnnecessaryComparison"] = "reportUnnecessaryComparison";
    DiagnosticRule["reportUnnecessaryContains"] = "reportUnnecessaryContains";
    DiagnosticRule["reportAssertAlwaysTrue"] = "reportAssertAlwaysTrue";
    DiagnosticRule["reportSelfClsParameterName"] = "reportSelfClsParameterName";
    DiagnosticRule["reportImplicitStringConcatenation"] = "reportImplicitStringConcatenation";
    DiagnosticRule["reportUndefinedVariable"] = "reportUndefinedVariable";
    DiagnosticRule["reportUnboundVariable"] = "reportUnboundVariable";
    DiagnosticRule["reportUnhashable"] = "reportUnhashable";
    DiagnosticRule["reportInvalidStubStatement"] = "reportInvalidStubStatement";
    DiagnosticRule["reportIncompleteStub"] = "reportIncompleteStub";
    DiagnosticRule["reportUnsupportedDunderAll"] = "reportUnsupportedDunderAll";
    DiagnosticRule["reportUnusedCallResult"] = "reportUnusedCallResult";
    DiagnosticRule["reportUnusedCoroutine"] = "reportUnusedCoroutine";
    DiagnosticRule["reportUnusedExcept"] = "reportUnusedExcept";
    DiagnosticRule["reportUnusedExpression"] = "reportUnusedExpression";
    DiagnosticRule["reportUnnecessaryTypeIgnoreComment"] = "reportUnnecessaryTypeIgnoreComment";
    DiagnosticRule["reportMatchNotExhaustive"] = "reportMatchNotExhaustive";
    DiagnosticRule["reportShadowedImports"] = "reportShadowedImports";
    DiagnosticRule["reportImplicitOverride"] = "reportImplicitOverride";
})(DiagnosticRule || (exports.DiagnosticRule = DiagnosticRule = {}));
//# sourceMappingURL=diagnosticRules.js.map