"use strict";
/*
 * localize.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Code that localizes user-visible strings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocAddendum = exports.LocMessage = exports.Localizer = exports.loadStringsForLocale = exports.getLocaleFromEnv = exports.setLocaleOverride = exports.getRawStringFromMap = exports.setGetRawString = exports.ParameterizedString = void 0;
const debug_1 = require("../common/debug");
const csStrings = require("./package.nls.cs.json");
const deStrings = require("./package.nls.de.json");
const enUsStrings = require("./package.nls.en-us.json");
const esStrings = require("./package.nls.es.json");
const frStrings = require("./package.nls.fr.json");
const itStrings = require("./package.nls.it.json");
const jaStrings = require("./package.nls.ja.json");
const koStrings = require("./package.nls.ko.json");
const plStrings = require("./package.nls.pl.json");
const ptBrStrings = require("./package.nls.pt-br.json");
const qpsPlocStrings = require("./package.nls.qps-ploc.json");
const ruStrings = require("./package.nls.ru.json");
const trStrings = require("./package.nls.tr.json");
const zhCnStrings = require("./package.nls.zh-cn.json");
const zhTwStrings = require("./package.nls.zh-tw.json");
class ParameterizedString {
    constructor(_formatString) {
        this._formatString = _formatString;
    }
    format(params) {
        let str = this._formatString;
        Object.keys(params).forEach((key) => {
            str = str.replace(new RegExp(`{${key}}`, 'g'), params[key].toString());
        });
        return str;
    }
    getFormatString() {
        return this._formatString;
    }
}
exports.ParameterizedString = ParameterizedString;
const defaultLocale = 'en-us';
const stringMapsByLocale = new Map([
    ['cs', csStrings],
    ['de', deStrings],
    ['en-us', enUsStrings],
    ['en', enUsStrings],
    ['es', esStrings],
    ['fr', frStrings],
    ['it', itStrings],
    ['ja', jaStrings],
    ['ko', koStrings],
    ['pl', plStrings],
    ['pt-br', ptBrStrings],
    ['qps-ploc', qpsPlocStrings],
    ['ru', ruStrings],
    ['tr', trStrings],
    ['zh-cn', zhCnStrings],
    ['zh-tw', zhTwStrings],
]);
let localizedStrings = undefined;
let defaultStrings = {};
function getRawStringDefault(key) {
    if (localizedStrings === undefined) {
        localizedStrings = initialize();
    }
    const keyParts = key.split('.');
    const str = getRawStringFromMap(localizedStrings, keyParts) || getRawStringFromMap(defaultStrings, keyParts);
    if (str) {
        return str;
    }
    (0, debug_1.fail)(`Missing localized string for key "${key}"`);
}
let getRawString = getRawStringDefault;
// Function allowing different strings to be used for messages.
// Returns the previous function used for getting messages.
function setGetRawString(func) {
    const oldLookup = getRawString;
    getRawString = func;
    return oldLookup;
}
exports.setGetRawString = setGetRawString;
function getRawStringFromMap(map, keyParts) {
    let curObj = map;
    for (const keyPart of keyParts) {
        if (!curObj[keyPart]) {
            return undefined;
        }
        curObj = curObj[keyPart];
    }
    return curObj;
}
exports.getRawStringFromMap = getRawStringFromMap;
function initialize() {
    defaultStrings = loadDefaultStrings();
    const currentLocale = getLocaleFromEnv();
    return loadStringsForLocale(currentLocale, stringMapsByLocale);
}
let localeOverride;
function setLocaleOverride(locale) {
    // Force a reload of the localized strings.
    localizedStrings = undefined;
    localeOverride = locale.toLowerCase();
}
exports.setLocaleOverride = setLocaleOverride;
function getLocaleFromEnv() {
    if (localeOverride) {
        return localeOverride;
    }
    try {
        const env = process === null || process === void 0 ? void 0 : process.env;
        // Start with the VSCode environment variables.
        const vscodeConfigString = env === null || env === void 0 ? void 0 : env.VSCODE_NLS_CONFIG;
        if (vscodeConfigString) {
            try {
                return JSON.parse(vscodeConfigString).locale || defaultLocale;
            }
            catch {
                // Fall through
            }
        }
        // See if there is a language env variable.
        const localeString = (env === null || env === void 0 ? void 0 : env.LC_ALL) || (env === null || env === void 0 ? void 0 : env.LC_MESSAGES) || (env === null || env === void 0 ? void 0 : env.LANG) || (env === null || env === void 0 ? void 0 : env.LANGUAGE);
        if (localeString) {
            // This string may contain a local followed by an encoding (e.g. "en-us.UTF-8").
            const localeStringSplit = localeString.split('.');
            if (localeStringSplit.length > 0 && localeStringSplit[0]) {
                return localeStringSplit[0] || defaultLocale;
            }
        }
    }
    catch {
        // Just use the default locale
    }
    // Fall back to the default locale.
    return defaultLocale;
}
exports.getLocaleFromEnv = getLocaleFromEnv;
function loadDefaultStrings() {
    const defaultStrings = stringMapsByLocale.get(defaultLocale);
    if (defaultStrings) {
        return defaultStrings;
    }
    console.error('Could not load default strings');
    return {};
}
function loadStringsForLocale(locale, localeMap) {
    if (locale === defaultLocale) {
        // No need to load override if we're using the default.
        return {};
    }
    let override = localeMap.get(locale);
    if (override !== undefined) {
        return override;
    }
    // If we couldn't find the requested locale, try to fall back on a more
    // general version.
    const localeSplit = locale.split('-');
    if (localeSplit.length > 0 && localeSplit[0]) {
        override = localeMap.get(localeSplit[0]);
        if (override !== undefined) {
            return override;
        }
    }
    return {};
}
exports.loadStringsForLocale = loadStringsForLocale;
var Localizer;
(function (Localizer) {
    let Diagnostic;
    (function (Diagnostic) {
        Diagnostic.annotatedMetadataInconsistent = () => new ParameterizedString(getRawString('Diagnostic.annotatedMetadataInconsistent'));
        Diagnostic.abstractMethodInvocation = () => new ParameterizedString(getRawString('Diagnostic.abstractMethodInvocation'));
        Diagnostic.annotatedParamCountMismatch = () => new ParameterizedString(getRawString('Diagnostic.annotatedParamCountMismatch'));
        Diagnostic.annotatedTypeArgMissing = () => getRawString('Diagnostic.annotatedTypeArgMissing');
        Diagnostic.annotationBytesString = () => getRawString('Diagnostic.annotationBytesString');
        Diagnostic.annotationFormatString = () => getRawString('Diagnostic.annotationFormatString');
        Diagnostic.annotationNotSupported = () => getRawString('Diagnostic.annotationNotSupported');
        Diagnostic.annotationRawString = () => getRawString('Diagnostic.annotationRawString');
        Diagnostic.annotationSpansStrings = () => getRawString('Diagnostic.annotationSpansStrings');
        Diagnostic.annotationStringEscape = () => getRawString('Diagnostic.annotationStringEscape');
        Diagnostic.argAssignment = () => new ParameterizedString(getRawString('Diagnostic.argAssignment'));
        Diagnostic.argAssignmentFunction = () => new ParameterizedString(getRawString('Diagnostic.argAssignmentFunction'));
        Diagnostic.argAssignmentParam = () => new ParameterizedString(getRawString('Diagnostic.argAssignmentParam'));
        Diagnostic.argAssignmentParamFunction = () => new ParameterizedString(getRawString('Diagnostic.argAssignmentParamFunction'));
        Diagnostic.argMissingForParam = () => new ParameterizedString(getRawString('Diagnostic.argMissingForParam'));
        Diagnostic.argMissingForParams = () => new ParameterizedString(getRawString('Diagnostic.argMissingForParams'));
        Diagnostic.argMorePositionalExpectedCount = () => new ParameterizedString(getRawString('Diagnostic.argMorePositionalExpectedCount'));
        Diagnostic.argMorePositionalExpectedOne = () => getRawString('Diagnostic.argMorePositionalExpectedOne');
        Diagnostic.argPositional = () => getRawString('Diagnostic.argPositional');
        Diagnostic.argPositionalExpectedCount = () => new ParameterizedString(getRawString('Diagnostic.argPositionalExpectedCount'));
        Diagnostic.argPositionalExpectedOne = () => getRawString('Diagnostic.argPositionalExpectedOne');
        Diagnostic.argTypePartiallyUnknown = () => getRawString('Diagnostic.argTypePartiallyUnknown');
        Diagnostic.argTypeUnknown = () => getRawString('Diagnostic.argTypeUnknown');
        Diagnostic.assertAlwaysTrue = () => getRawString('Diagnostic.assertAlwaysTrue');
        Diagnostic.assertTypeArgs = () => getRawString('Diagnostic.assertTypeArgs');
        Diagnostic.assertTypeTypeMismatch = () => new ParameterizedString(getRawString('Diagnostic.assertTypeTypeMismatch'));
        Diagnostic.assignmentExprContext = () => getRawString('Diagnostic.assignmentExprContext');
        Diagnostic.assignmentExprComprehension = () => new ParameterizedString(getRawString('Diagnostic.assignmentExprComprehension'));
        Diagnostic.assignmentExprInSubscript = () => getRawString('Diagnostic.assignmentExprInSubscript');
        Diagnostic.assignmentInProtocol = () => getRawString('Diagnostic.assignmentInProtocol');
        Diagnostic.assignmentTargetExpr = () => getRawString('Diagnostic.assignmentTargetExpr');
        Diagnostic.asyncNotInAsyncFunction = () => getRawString('Diagnostic.asyncNotInAsyncFunction');
        Diagnostic.awaitIllegal = () => getRawString('Diagnostic.awaitIllegal');
        Diagnostic.awaitNotAllowed = () => getRawString('Diagnostic.awaitNotAllowed');
        Diagnostic.awaitNotInAsync = () => getRawString('Diagnostic.awaitNotInAsync');
        Diagnostic.backticksIllegal = () => getRawString('Diagnostic.backticksIllegal');
        Diagnostic.baseClassCircular = () => getRawString('Diagnostic.baseClassCircular');
        Diagnostic.baseClassFinal = () => new ParameterizedString(getRawString('Diagnostic.baseClassFinal'));
        Diagnostic.baseClassIncompatible = () => new ParameterizedString(getRawString('Diagnostic.baseClassIncompatible'));
        Diagnostic.baseClassInvalid = () => getRawString('Diagnostic.baseClassInvalid');
        Diagnostic.baseClassMethodTypeIncompatible = () => new ParameterizedString(getRawString('Diagnostic.baseClassMethodTypeIncompatible'));
        Diagnostic.baseClassVariableTypeIncompatible = () => new ParameterizedString(getRawString('Diagnostic.baseClassVariableTypeIncompatible'));
        Diagnostic.baseClassUnknown = () => getRawString('Diagnostic.baseClassUnknown');
        Diagnostic.binaryOperationNotAllowed = () => getRawString('Diagnostic.binaryOperationNotAllowed');
        Diagnostic.bindTypeMismatch = () => new ParameterizedString(getRawString('Diagnostic.bindTypeMismatch'));
        Diagnostic.breakOutsideLoop = () => getRawString('Diagnostic.breakOutsideLoop');
        Diagnostic.callableExtraArgs = () => getRawString('Diagnostic.callableExtraArgs');
        Diagnostic.callableFirstArg = () => getRawString('Diagnostic.callableFirstArg');
        Diagnostic.callableNotInstantiable = () => new ParameterizedString(getRawString('Diagnostic.callableNotInstantiable'));
        Diagnostic.callableSecondArg = () => getRawString('Diagnostic.callableSecondArg');
        Diagnostic.casePatternIsIrrefutable = () => getRawString('Diagnostic.casePatternIsIrrefutable');
        Diagnostic.classAlreadySpecialized = () => new ParameterizedString(getRawString('Diagnostic.classAlreadySpecialized'));
        Diagnostic.classDecoratorTypeUnknown = () => getRawString('Diagnostic.classDecoratorTypeUnknown');
        Diagnostic.classDefinitionCycle = () => new ParameterizedString(getRawString('Diagnostic.classDefinitionCycle'));
        Diagnostic.classGetItemClsParam = () => getRawString('Diagnostic.classGetItemClsParam');
        Diagnostic.classMethodClsParam = () => getRawString('Diagnostic.classMethodClsParam');
        Diagnostic.classNotRuntimeSubscriptable = () => new ParameterizedString(getRawString('Diagnostic.classNotRuntimeSubscriptable'));
        Diagnostic.classPatternBuiltInArgPositional = () => getRawString('Diagnostic.classPatternBuiltInArgPositional');
        Diagnostic.classPatternPositionalArgCount = () => new ParameterizedString(getRawString('Diagnostic.classPatternPositionalArgCount'));
        Diagnostic.classPatternTypeAlias = () => new ParameterizedString(getRawString('Diagnostic.classPatternTypeAlias'));
        Diagnostic.classPropertyDeprecated = () => getRawString('Diagnostic.classPropertyDeprecated');
        Diagnostic.classTypeParametersIllegal = () => getRawString('Diagnostic.classTypeParametersIllegal');
        Diagnostic.classVarNotAllowed = () => getRawString('Diagnostic.classVarNotAllowed');
        Diagnostic.classVarFirstArgMissing = () => getRawString('Diagnostic.classVarFirstArgMissing');
        Diagnostic.classVarOverridesInstanceVar = () => new ParameterizedString(getRawString('Diagnostic.classVarOverridesInstanceVar'));
        Diagnostic.classVarTooManyArgs = () => getRawString('Diagnostic.classVarTooManyArgs');
        Diagnostic.classVarWithTypeVar = () => getRawString('Diagnostic.classVarWithTypeVar');
        Diagnostic.clsSelfParamTypeMismatch = () => new ParameterizedString(getRawString('Diagnostic.clsSelfParamTypeMismatch'));
        Diagnostic.codeTooComplexToAnalyze = () => getRawString('Diagnostic.codeTooComplexToAnalyze');
        Diagnostic.collectionAliasInstantiation = () => new ParameterizedString(getRawString('Diagnostic.collectionAliasInstantiation'));
        Diagnostic.comparisonAlwaysFalse = () => new ParameterizedString(getRawString('Diagnostic.comparisonAlwaysFalse'));
        Diagnostic.comparisonAlwaysTrue = () => new ParameterizedString(getRawString('Diagnostic.comparisonAlwaysTrue'));
        Diagnostic.comprehensionInDict = () => getRawString('Diagnostic.comprehensionInDict');
        Diagnostic.comprehensionInSet = () => getRawString('Diagnostic.comprehensionInSet');
        Diagnostic.concatenateContext = () => getRawString('Diagnostic.concatenateContext');
        Diagnostic.concatenateParamSpecMissing = () => getRawString('Diagnostic.concatenateParamSpecMissing');
        Diagnostic.concatenateTypeArgsMissing = () => getRawString('Diagnostic.concatenateTypeArgsMissing');
        Diagnostic.conditionalOperandInvalid = () => new ParameterizedString(getRawString('Diagnostic.conditionalOperandInvalid'));
        Diagnostic.constantRedefinition = () => new ParameterizedString(getRawString('Diagnostic.constantRedefinition'));
        Diagnostic.constructorNoArgs = () => new ParameterizedString(getRawString('Diagnostic.constructorNoArgs'));
        Diagnostic.coroutineInConditionalExpression = () => getRawString('Diagnostic.coroutineInConditionalExpression');
        Diagnostic.constructorParametersMismatch = () => new ParameterizedString(getRawString('Diagnostic.constructorParametersMismatch'));
        Diagnostic.containmentAlwaysFalse = () => new ParameterizedString(getRawString('Diagnostic.containmentAlwaysFalse'));
        Diagnostic.containmentAlwaysTrue = () => new ParameterizedString(getRawString('Diagnostic.containmentAlwaysTrue'));
        Diagnostic.continueInFinally = () => getRawString('Diagnostic.continueInFinally');
        Diagnostic.continueOutsideLoop = () => getRawString('Diagnostic.continueOutsideLoop');
        Diagnostic.dataClassBaseClassFrozen = () => getRawString('Diagnostic.dataClassBaseClassFrozen');
        Diagnostic.dataClassBaseClassNotFrozen = () => getRawString('Diagnostic.dataClassBaseClassNotFrozen');
        Diagnostic.dataClassConverterFunction = () => new ParameterizedString(getRawString('Diagnostic.dataClassConverterFunction'));
        Diagnostic.dataClassConverterOverloads = () => new ParameterizedString(getRawString('Diagnostic.dataClassConverterOverloads'));
        Diagnostic.dataClassFieldInheritedDefault = () => new ParameterizedString(getRawString('Diagnostic.dataClassFieldInheritedDefault'));
        Diagnostic.dataClassFieldWithDefault = () => getRawString('Diagnostic.dataClassFieldWithDefault');
        Diagnostic.dataClassFieldWithoutAnnotation = () => getRawString('Diagnostic.dataClassFieldWithoutAnnotation');
        Diagnostic.dataClassFieldWithPrivateName = () => getRawString('Diagnostic.dataClassFieldWithPrivateName');
        Diagnostic.dataClassPostInitParamCount = () => new ParameterizedString(getRawString('Diagnostic.dataClassPostInitParamCount'));
        Diagnostic.dataClassPostInitType = () => new ParameterizedString(getRawString('Diagnostic.dataClassPostInitType'));
        Diagnostic.dataClassSlotsOverwrite = () => getRawString('Diagnostic.dataClassSlotsOverwrite');
        Diagnostic.dataClassTransformExpectedBoolLiteral = () => getRawString('Diagnostic.dataClassTransformExpectedBoolLiteral');
        Diagnostic.dataClassTransformFieldSpecifier = () => new ParameterizedString(getRawString('Diagnostic.dataClassTransformFieldSpecifier'));
        Diagnostic.dataClassTransformPositionalParam = () => getRawString('Diagnostic.dataClassTransformPositionalParam');
        Diagnostic.dataClassTransformUnknownArgument = () => new ParameterizedString(getRawString('Diagnostic.dataClassTransformUnknownArgument'));
        Diagnostic.dataProtocolInSubclassCheck = () => getRawString('Diagnostic.dataProtocolInSubclassCheck');
        Diagnostic.declaredReturnTypePartiallyUnknown = () => new ParameterizedString(getRawString('Diagnostic.declaredReturnTypePartiallyUnknown'));
        Diagnostic.declaredReturnTypeUnknown = () => getRawString('Diagnostic.declaredReturnTypeUnknown');
        Diagnostic.defaultValueContainsCall = () => getRawString('Diagnostic.defaultValueContainsCall');
        Diagnostic.defaultValueNotAllowed = () => getRawString('Diagnostic.defaultValueNotAllowed');
        Diagnostic.deprecatedClass = () => new ParameterizedString(getRawString('Diagnostic.deprecatedClass'));
        Diagnostic.deprecatedConstructor = () => new ParameterizedString(getRawString('Diagnostic.deprecatedConstructor'));
        Diagnostic.deprecatedDescriptorDeleter = () => new ParameterizedString(getRawString('Diagnostic.deprecatedDescriptorDeleter'));
        Diagnostic.deprecatedDescriptorGetter = () => new ParameterizedString(getRawString('Diagnostic.deprecatedDescriptorGetter'));
        Diagnostic.deprecatedDescriptorSetter = () => new ParameterizedString(getRawString('Diagnostic.deprecatedDescriptorSetter'));
        Diagnostic.deprecatedFunction = () => new ParameterizedString(getRawString('Diagnostic.deprecatedFunction'));
        Diagnostic.deprecatedMethod = () => new ParameterizedString(getRawString('Diagnostic.deprecatedMethod'));
        Diagnostic.deprecatedPropertyDeleter = () => new ParameterizedString(getRawString('Diagnostic.deprecatedPropertyDeleter'));
        Diagnostic.deprecatedPropertyGetter = () => new ParameterizedString(getRawString('Diagnostic.deprecatedPropertyGetter'));
        Diagnostic.deprecatedPropertySetter = () => new ParameterizedString(getRawString('Diagnostic.deprecatedPropertySetter'));
        Diagnostic.deprecatedType = () => new ParameterizedString(getRawString('Diagnostic.deprecatedType'));
        Diagnostic.dictExpandIllegalInComprehension = () => getRawString('Diagnostic.dictExpandIllegalInComprehension');
        Diagnostic.dictInAnnotation = () => getRawString('Diagnostic.dictInAnnotation');
        Diagnostic.dictKeyValuePairs = () => getRawString('Diagnostic.dictKeyValuePairs');
        Diagnostic.dictUnpackIsNotMapping = () => getRawString('Diagnostic.dictUnpackIsNotMapping');
        Diagnostic.delTargetExpr = () => getRawString('Diagnostic.delTargetExpr');
        Diagnostic.dunderAllSymbolNotPresent = () => new ParameterizedString(getRawString('Diagnostic.dunderAllSymbolNotPresent'));
        Diagnostic.duplicateArgsParam = () => getRawString('Diagnostic.duplicateArgsParam');
        Diagnostic.duplicateBaseClass = () => getRawString('Diagnostic.duplicateBaseClass');
        Diagnostic.duplicateCatchAll = () => getRawString('Diagnostic.duplicateCatchAll');
        Diagnostic.duplicateEnumMember = () => new ParameterizedString(getRawString('Diagnostic.duplicateEnumMember'));
        Diagnostic.duplicateGenericAndProtocolBase = () => getRawString('Diagnostic.duplicateGenericAndProtocolBase');
        Diagnostic.duplicateImport = () => new ParameterizedString(getRawString('Diagnostic.duplicateImport'));
        Diagnostic.duplicateKwargsParam = () => getRawString('Diagnostic.duplicateKwargsParam');
        Diagnostic.duplicateKeywordOnly = () => getRawString('Diagnostic.duplicateKeywordOnly');
        Diagnostic.duplicateParam = () => new ParameterizedString(getRawString('Diagnostic.duplicateParam'));
        Diagnostic.duplicateCapturePatternTarget = () => new ParameterizedString(getRawString('Diagnostic.duplicateCapturePatternTarget'));
        Diagnostic.duplicateStarPattern = () => getRawString('Diagnostic.duplicateStarPattern');
        Diagnostic.duplicateStarStarPattern = () => getRawString('Diagnostic.duplicateStarStarPattern');
        Diagnostic.duplicatePositionOnly = () => getRawString('Diagnostic.duplicatePositionOnly');
        Diagnostic.duplicateUnpack = () => getRawString('Diagnostic.duplicateUnpack');
        Diagnostic.ellipsisAfterUnpacked = () => getRawString('Diagnostic.ellipsisAfterUnpacked');
        Diagnostic.ellipsisContext = () => getRawString('Diagnostic.ellipsisContext');
        Diagnostic.ellipsisSecondArg = () => getRawString('Diagnostic.ellipsisSecondArg');
        Diagnostic.enumClassOverride = () => new ParameterizedString(getRawString('Diagnostic.enumClassOverride'));
        Diagnostic.enumMemberDelete = () => new ParameterizedString(getRawString('Diagnostic.enumMemberDelete'));
        Diagnostic.enumMemberSet = () => new ParameterizedString(getRawString('Diagnostic.enumMemberSet'));
        Diagnostic.enumMemberTypeAnnotation = () => getRawString('Diagnostic.enumMemberTypeAnnotation');
        Diagnostic.exceptionGroupIncompatible = () => getRawString('Diagnostic.exceptionGroupIncompatible');
        Diagnostic.exceptionGroupTypeIncorrect = () => getRawString('Diagnostic.exceptionGroupTypeIncorrect');
        Diagnostic.exceptionTypeIncorrect = () => new ParameterizedString(getRawString('Diagnostic.exceptionTypeIncorrect'));
        Diagnostic.exceptionTypeNotClass = () => new ParameterizedString(getRawString('Diagnostic.exceptionTypeNotClass'));
        Diagnostic.exceptionTypeNotInstantiable = () => new ParameterizedString(getRawString('Diagnostic.exceptionTypeNotInstantiable'));
        Diagnostic.expectedAfterDecorator = () => getRawString('Diagnostic.expectedAfterDecorator');
        Diagnostic.expectedArrow = () => getRawString('Diagnostic.expectedArrow');
        Diagnostic.expectedAsAfterException = () => getRawString('Diagnostic.expectedAsAfterException');
        Diagnostic.expectedAssignRightHandExpr = () => getRawString('Diagnostic.expectedAssignRightHandExpr');
        Diagnostic.expectedBinaryRightHandExpr = () => getRawString('Diagnostic.expectedBinaryRightHandExpr');
        Diagnostic.expectedBoolLiteral = () => getRawString('Diagnostic.expectedBoolLiteral');
        Diagnostic.expectedCase = () => getRawString('Diagnostic.expectedCase');
        Diagnostic.expectedClassName = () => getRawString('Diagnostic.expectedClassName');
        Diagnostic.expectedCloseBrace = () => getRawString('Diagnostic.expectedCloseBrace');
        Diagnostic.expectedCloseBracket = () => getRawString('Diagnostic.expectedCloseBracket');
        Diagnostic.expectedCloseParen = () => getRawString('Diagnostic.expectedCloseParen');
        Diagnostic.expectedColon = () => getRawString('Diagnostic.expectedColon');
        Diagnostic.expectedComplexNumberLiteral = () => getRawString('Diagnostic.expectedComplexNumberLiteral');
        Diagnostic.expectedDecoratorExpr = () => getRawString('Diagnostic.expectedDecoratorExpr');
        Diagnostic.expectedDecoratorName = () => getRawString('Diagnostic.expectedDecoratorName');
        Diagnostic.expectedDecoratorNewline = () => getRawString('Diagnostic.expectedDecoratorNewline');
        Diagnostic.expectedDelExpr = () => getRawString('Diagnostic.expectedDelExpr');
        Diagnostic.expectedElse = () => getRawString('Diagnostic.expectedElse');
        Diagnostic.expectedEquals = () => getRawString('Diagnostic.expectedEquals');
        Diagnostic.expectedExceptionClass = () => getRawString('Diagnostic.expectedExceptionClass');
        Diagnostic.expectedExceptionObj = () => getRawString('Diagnostic.expectedExceptionObj');
        Diagnostic.expectedExpr = () => getRawString('Diagnostic.expectedExpr');
        Diagnostic.expectedImport = () => getRawString('Diagnostic.expectedImport');
        Diagnostic.expectedImportAlias = () => getRawString('Diagnostic.expectedImportAlias');
        Diagnostic.expectedImportSymbols = () => getRawString('Diagnostic.expectedImportSymbols');
        Diagnostic.expectedIdentifier = () => getRawString('Diagnostic.expectedIdentifier');
        Diagnostic.expectedIndentedBlock = () => getRawString('Diagnostic.expectedIndentedBlock');
        Diagnostic.expectedIn = () => getRawString('Diagnostic.expectedIn');
        Diagnostic.expectedInExpr = () => getRawString('Diagnostic.expectedInExpr');
        Diagnostic.expectedFunctionAfterAsync = () => getRawString('Diagnostic.expectedFunctionAfterAsync');
        Diagnostic.expectedFunctionName = () => getRawString('Diagnostic.expectedFunctionName');
        Diagnostic.expectedMemberName = () => getRawString('Diagnostic.expectedMemberName');
        Diagnostic.expectedModuleName = () => getRawString('Diagnostic.expectedModuleName');
        Diagnostic.expectedNameAfterAs = () => getRawString('Diagnostic.expectedNameAfterAs');
        Diagnostic.expectedNamedParameter = () => getRawString('Diagnostic.expectedNamedParameter');
        Diagnostic.expectedNewline = () => getRawString('Diagnostic.expectedNewline');
        Diagnostic.expectedNewlineOrSemicolon = () => getRawString('Diagnostic.expectedNewlineOrSemicolon');
        Diagnostic.expectedOpenParen = () => getRawString('Diagnostic.expectedOpenParen');
        Diagnostic.expectedParamName = () => getRawString('Diagnostic.expectedParamName');
        Diagnostic.expectedPatternExpr = () => getRawString('Diagnostic.expectedPatternExpr');
        Diagnostic.expectedPatternSubjectExpr = () => getRawString('Diagnostic.expectedPatternSubjectExpr');
        Diagnostic.expectedPatternValue = () => getRawString('Diagnostic.expectedPatternValue');
        Diagnostic.expectedReturnExpr = () => getRawString('Diagnostic.expectedReturnExpr');
        Diagnostic.expectedSliceIndex = () => getRawString('Diagnostic.expectedSliceIndex');
        Diagnostic.expectedTypeNotString = () => getRawString('Diagnostic.expectedTypeNotString');
        Diagnostic.expectedTypeParameterName = () => getRawString('Diagnostic.expectedTypeParameterName');
        Diagnostic.expectedYieldExpr = () => getRawString('Diagnostic.expectedYieldExpr');
        Diagnostic.finalClassIsAbstract = () => new ParameterizedString(getRawString('Diagnostic.finalClassIsAbstract'));
        Diagnostic.finalContext = () => getRawString('Diagnostic.finalContext');
        Diagnostic.finalMethodOverride = () => new ParameterizedString(getRawString('Diagnostic.finalMethodOverride'));
        Diagnostic.finalNonMethod = () => new ParameterizedString(getRawString('Diagnostic.finalNonMethod'));
        Diagnostic.finalReassigned = () => new ParameterizedString(getRawString('Diagnostic.finalReassigned'));
        Diagnostic.finalRedeclaration = () => new ParameterizedString(getRawString('Diagnostic.finalRedeclaration'));
        Diagnostic.finalRedeclarationBySubclass = () => new ParameterizedString(getRawString('Diagnostic.finalRedeclarationBySubclass'));
        Diagnostic.finalTooManyArgs = () => getRawString('Diagnostic.finalTooManyArgs');
        Diagnostic.finalUnassigned = () => new ParameterizedString(getRawString('Diagnostic.finalUnassigned'));
        Diagnostic.formatStringBrace = () => getRawString('Diagnostic.formatStringBrace');
        Diagnostic.formatStringBytes = () => getRawString('Diagnostic.formatStringBytes');
        Diagnostic.formatStringDebuggingIllegal = () => getRawString('Diagnostic.formatStringDebuggingIllegal');
        Diagnostic.formatStringEscape = () => getRawString('Diagnostic.formatStringEscape');
        Diagnostic.formatStringExpectedConversion = () => getRawString('Diagnostic.formatStringExpectedConversion');
        Diagnostic.formatStringInPattern = () => getRawString('Diagnostic.formatStringInPattern');
        Diagnostic.formatStringIllegal = () => getRawString('Diagnostic.formatStringIllegal');
        Diagnostic.formatStringNestedFormatSpecifier = () => getRawString('Diagnostic.formatStringNestedFormatSpecifier');
        Diagnostic.formatStringNestedQuote = () => getRawString('Diagnostic.formatStringNestedQuote');
        Diagnostic.formatStringUnicode = () => getRawString('Diagnostic.formatStringUnicode');
        Diagnostic.formatStringUnterminated = () => getRawString('Diagnostic.formatStringUnterminated');
        Diagnostic.functionDecoratorTypeUnknown = () => getRawString('Diagnostic.functionDecoratorTypeUnknown');
        Diagnostic.functionInConditionalExpression = () => getRawString('Diagnostic.functionInConditionalExpression');
        Diagnostic.functionTypeParametersIllegal = () => getRawString('Diagnostic.functionTypeParametersIllegal');
        Diagnostic.futureImportLocationNotAllowed = () => getRawString('Diagnostic.futureImportLocationNotAllowed');
        Diagnostic.generatorAsyncReturnType = () => new ParameterizedString(getRawString('Diagnostic.generatorAsyncReturnType'));
        Diagnostic.generatorNotParenthesized = () => getRawString('Diagnostic.generatorNotParenthesized');
        Diagnostic.generatorSyncReturnType = () => new ParameterizedString(getRawString('Diagnostic.generatorSyncReturnType'));
        Diagnostic.genericBaseClassNotAllowed = () => getRawString('Diagnostic.genericBaseClassNotAllowed');
        Diagnostic.genericClassAssigned = () => getRawString('Diagnostic.genericClassAssigned');
        Diagnostic.genericClassDeleted = () => getRawString('Diagnostic.genericClassDeleted');
        Diagnostic.genericInstanceVariableAccess = () => getRawString('Diagnostic.genericInstanceVariableAccess');
        Diagnostic.genericNotAllowed = () => getRawString('Diagnostic.genericNotAllowed');
        Diagnostic.genericTypeAliasBoundTypeVar = () => new ParameterizedString(getRawString('Diagnostic.genericTypeAliasBoundTypeVar'));
        Diagnostic.genericTypeArgMissing = () => getRawString('Diagnostic.genericTypeArgMissing');
        Diagnostic.genericTypeArgTypeVar = () => getRawString('Diagnostic.genericTypeArgTypeVar');
        Diagnostic.genericTypeArgUnique = () => getRawString('Diagnostic.genericTypeArgUnique');
        Diagnostic.globalReassignment = () => new ParameterizedString(getRawString('Diagnostic.globalReassignment'));
        Diagnostic.globalRedefinition = () => new ParameterizedString(getRawString('Diagnostic.globalRedefinition'));
        Diagnostic.implicitStringConcat = () => getRawString('Diagnostic.implicitStringConcat');
        Diagnostic.importCycleDetected = () => getRawString('Diagnostic.importCycleDetected');
        Diagnostic.importDepthExceeded = () => new ParameterizedString(getRawString('Diagnostic.importDepthExceeded'));
        Diagnostic.importResolveFailure = () => new ParameterizedString(getRawString('Diagnostic.importResolveFailure'));
        Diagnostic.importSourceResolveFailure = () => new ParameterizedString(getRawString('Diagnostic.importSourceResolveFailure'));
        Diagnostic.importSymbolUnknown = () => new ParameterizedString(getRawString('Diagnostic.importSymbolUnknown'));
        Diagnostic.incompatibleMethodOverride = () => new ParameterizedString(getRawString('Diagnostic.incompatibleMethodOverride'));
        Diagnostic.inconsistentIndent = () => getRawString('Diagnostic.inconsistentIndent');
        Diagnostic.inconsistentTabs = () => getRawString('Diagnostic.inconsistentTabs');
        Diagnostic.initMethodSelfParamTypeVar = () => getRawString('Diagnostic.initMethodSelfParamTypeVar');
        Diagnostic.initMustReturnNone = () => getRawString('Diagnostic.initMustReturnNone');
        Diagnostic.initSubclassClsParam = () => getRawString('Diagnostic.initSubclassClsParam');
        Diagnostic.initSubclassCallFailed = () => getRawString('Diagnostic.initSubclassCallFailed');
        Diagnostic.initVarNotAllowed = () => getRawString('Diagnostic.initVarNotAllowed');
        Diagnostic.instanceMethodSelfParam = () => getRawString('Diagnostic.instanceMethodSelfParam');
        Diagnostic.instanceVarOverridesClassVar = () => new ParameterizedString(getRawString('Diagnostic.instanceVarOverridesClassVar'));
        Diagnostic.instantiateAbstract = () => new ParameterizedString(getRawString('Diagnostic.instantiateAbstract'));
        Diagnostic.instantiateProtocol = () => new ParameterizedString(getRawString('Diagnostic.instantiateProtocol'));
        Diagnostic.internalBindError = () => new ParameterizedString(getRawString('Diagnostic.internalBindError'));
        Diagnostic.internalParseError = () => new ParameterizedString(getRawString('Diagnostic.internalParseError'));
        Diagnostic.internalTypeCheckingError = () => new ParameterizedString(getRawString('Diagnostic.internalTypeCheckingError'));
        Diagnostic.invalidIdentifierChar = () => getRawString('Diagnostic.invalidIdentifierChar');
        Diagnostic.invalidStubStatement = () => getRawString('Diagnostic.invalidStubStatement');
        Diagnostic.invalidTokenChars = () => new ParameterizedString(getRawString('Diagnostic.invalidTokenChars'));
        Diagnostic.isInstanceInvalidType = () => new ParameterizedString(getRawString('Diagnostic.isInstanceInvalidType'));
        Diagnostic.isSubclassInvalidType = () => new ParameterizedString(getRawString('Diagnostic.isSubclassInvalidType'));
        Diagnostic.keyValueInSet = () => getRawString('Diagnostic.keyValueInSet');
        Diagnostic.keywordArgInTypeArgument = () => getRawString('Diagnostic.keywordArgInTypeArgument');
        Diagnostic.keywordOnlyAfterArgs = () => getRawString('Diagnostic.keywordOnlyAfterArgs');
        Diagnostic.keywordParameterMissing = () => getRawString('Diagnostic.keywordParameterMissing');
        Diagnostic.keywordSubscriptIllegal = () => getRawString('Diagnostic.keywordSubscriptIllegal');
        Diagnostic.lambdaReturnTypeUnknown = () => getRawString('Diagnostic.lambdaReturnTypeUnknown');
        Diagnostic.lambdaReturnTypePartiallyUnknown = () => new ParameterizedString(getRawString('Diagnostic.lambdaReturnTypePartiallyUnknown'));
        Diagnostic.listAssignmentMismatch = () => new ParameterizedString(getRawString('Diagnostic.listAssignmentMismatch'));
        Diagnostic.listInAnnotation = () => getRawString('Diagnostic.listInAnnotation');
        Diagnostic.literalNamedUnicodeEscape = () => getRawString('Diagnostic.literalNamedUnicodeEscape');
        Diagnostic.literalUnsupportedType = () => getRawString('Diagnostic.literalUnsupportedType');
        Diagnostic.literalEmptyArgs = () => getRawString('Diagnostic.literalEmptyArgs');
        Diagnostic.literalNotAllowed = () => getRawString('Diagnostic.literalNotAllowed');
        Diagnostic.literalNotCallable = () => getRawString('Diagnostic.literalNotCallable');
        Diagnostic.matchIncompatible = () => getRawString('Diagnostic.matchIncompatible');
        Diagnostic.matchIsNotExhaustive = () => getRawString('Diagnostic.matchIsNotExhaustive');
        Diagnostic.maxParseDepthExceeded = () => getRawString('Diagnostic.maxParseDepthExceeded');
        Diagnostic.memberAccess = () => new ParameterizedString(getRawString('Diagnostic.memberAccess'));
        Diagnostic.memberDelete = () => new ParameterizedString(getRawString('Diagnostic.memberDelete'));
        Diagnostic.memberSet = () => new ParameterizedString(getRawString('Diagnostic.memberSet'));
        Diagnostic.metaclassConflict = () => getRawString('Diagnostic.metaclassConflict');
        Diagnostic.metaclassDuplicate = () => getRawString('Diagnostic.metaclassDuplicate');
        Diagnostic.metaclassIsGeneric = () => getRawString('Diagnostic.metaclassIsGeneric');
        Diagnostic.methodNotDefined = () => new ParameterizedString(getRawString('Diagnostic.methodNotDefined'));
        Diagnostic.methodNotDefinedOnType = () => new ParameterizedString(getRawString('Diagnostic.methodNotDefinedOnType'));
        Diagnostic.methodOrdering = () => getRawString('Diagnostic.methodOrdering');
        Diagnostic.methodOverridden = () => new ParameterizedString(getRawString('Diagnostic.methodOverridden'));
        Diagnostic.methodReturnsNonObject = () => new ParameterizedString(getRawString('Diagnostic.methodReturnsNonObject'));
        Diagnostic.missingSuperCall = () => new ParameterizedString(getRawString('Diagnostic.missingSuperCall'));
        Diagnostic.moduleAsType = () => getRawString('Diagnostic.moduleAsType');
        Diagnostic.moduleNotCallable = () => getRawString('Diagnostic.moduleNotCallable');
        Diagnostic.moduleUnknownMember = () => new ParameterizedString(getRawString('Diagnostic.moduleUnknownMember'));
        Diagnostic.namedExceptAfterCatchAll = () => getRawString('Diagnostic.namedExceptAfterCatchAll');
        Diagnostic.namedParamAfterParamSpecArgs = () => new ParameterizedString(getRawString('Diagnostic.namedParamAfterParamSpecArgs'));
        Diagnostic.namedTupleEmptyName = () => getRawString('Diagnostic.namedTupleEmptyName');
        Diagnostic.namedTupleEntryRedeclared = () => new ParameterizedString(getRawString('Diagnostic.namedTupleEntryRedeclared'));
        Diagnostic.namedTupleFirstArg = () => getRawString('Diagnostic.namedTupleFirstArg');
        Diagnostic.namedTupleMultipleInheritance = () => getRawString('Diagnostic.namedTupleMultipleInheritance');
        Diagnostic.namedTupleNameKeyword = () => getRawString('Diagnostic.namedTupleNameKeyword');
        Diagnostic.namedTupleNameType = () => getRawString('Diagnostic.namedTupleNameType');
        Diagnostic.namedTupleNameUnique = () => getRawString('Diagnostic.namedTupleNameUnique');
        Diagnostic.namedTupleNoTypes = () => getRawString('Diagnostic.namedTupleNoTypes');
        Diagnostic.namedTupleSecondArg = () => getRawString('Diagnostic.namedTupleSecondArg');
        Diagnostic.newClsParam = () => getRawString('Diagnostic.newClsParam');
        Diagnostic.newTypeAnyOrUnknown = () => getRawString('Diagnostic.newTypeAnyOrUnknown');
        Diagnostic.newTypeBadName = () => getRawString('Diagnostic.newTypeBadName');
        Diagnostic.newTypeLiteral = () => getRawString('Diagnostic.newTypeLiteral');
        Diagnostic.newTypeNameMismatch = () => getRawString('Diagnostic.newTypeNameMismatch');
        Diagnostic.newTypeNotAClass = () => getRawString('Diagnostic.newTypeNotAClass');
        Diagnostic.newTypeParamCount = () => getRawString('Diagnostic.newTypeParamCount');
        Diagnostic.newTypeProtocolClass = () => getRawString('Diagnostic.newTypeProtocolClass');
        Diagnostic.nonDefaultAfterDefault = () => getRawString('Diagnostic.nonDefaultAfterDefault');
        Diagnostic.noneNotCallable = () => getRawString('Diagnostic.noneNotCallable');
        Diagnostic.noneNotIterable = () => getRawString('Diagnostic.noneNotIterable');
        Diagnostic.noneNotSubscriptable = () => getRawString('Diagnostic.noneNotSubscriptable');
        Diagnostic.noneNotUsableWith = () => getRawString('Diagnostic.noneNotUsableWith');
        Diagnostic.noneOperator = () => new ParameterizedString(getRawString('Diagnostic.noneOperator'));
        Diagnostic.noneUnknownMember = () => new ParameterizedString(getRawString('Diagnostic.noneUnknownMember'));
        Diagnostic.nonLocalNoBinding = () => new ParameterizedString(getRawString('Diagnostic.nonLocalNoBinding'));
        Diagnostic.nonLocalReassignment = () => new ParameterizedString(getRawString('Diagnostic.nonLocalReassignment'));
        Diagnostic.nonLocalRedefinition = () => new ParameterizedString(getRawString('Diagnostic.nonLocalRedefinition'));
        Diagnostic.nonLocalInModule = () => getRawString('Diagnostic.nonLocalInModule');
        Diagnostic.noOverload = () => new ParameterizedString(getRawString('Diagnostic.noOverload'));
        Diagnostic.noReturnContainsReturn = () => getRawString('Diagnostic.noReturnContainsReturn');
        Diagnostic.noReturnContainsYield = () => getRawString('Diagnostic.noReturnContainsYield');
        Diagnostic.noReturnReturnsNone = () => getRawString('Diagnostic.noReturnReturnsNone');
        Diagnostic.notRequiredArgCount = () => getRawString('Diagnostic.notRequiredArgCount');
        Diagnostic.notRequiredNotInTypedDict = () => getRawString('Diagnostic.notRequiredNotInTypedDict');
        Diagnostic.objectNotCallable = () => new ParameterizedString(getRawString('Diagnostic.objectNotCallable'));
        Diagnostic.obscuredClassDeclaration = () => new ParameterizedString(getRawString('Diagnostic.obscuredClassDeclaration'));
        Diagnostic.obscuredFunctionDeclaration = () => new ParameterizedString(getRawString('Diagnostic.obscuredFunctionDeclaration'));
        Diagnostic.obscuredMethodDeclaration = () => new ParameterizedString(getRawString('Diagnostic.obscuredMethodDeclaration'));
        Diagnostic.obscuredParameterDeclaration = () => new ParameterizedString(getRawString('Diagnostic.obscuredParameterDeclaration'));
        Diagnostic.obscuredTypeAliasDeclaration = () => new ParameterizedString(getRawString('Diagnostic.obscuredTypeAliasDeclaration'));
        Diagnostic.obscuredVariableDeclaration = () => new ParameterizedString(getRawString('Diagnostic.obscuredVariableDeclaration'));
        Diagnostic.operatorLessOrGreaterDeprecated = () => getRawString('Diagnostic.operatorLessOrGreaterDeprecated');
        Diagnostic.optionalExtraArgs = () => getRawString('Diagnostic.optionalExtraArgs');
        Diagnostic.orPatternIrrefutable = () => getRawString('Diagnostic.orPatternIrrefutable');
        Diagnostic.orPatternMissingName = () => getRawString('Diagnostic.orPatternMissingName');
        Diagnostic.overlappingKeywordArgs = () => new ParameterizedString(getRawString('Diagnostic.overlappingKeywordArgs'));
        Diagnostic.overlappingOverload = () => new ParameterizedString(getRawString('Diagnostic.overlappingOverload'));
        Diagnostic.overloadAbstractMismatch = () => new ParameterizedString(getRawString('Diagnostic.overloadAbstractMismatch'));
        Diagnostic.overloadClassMethodInconsistent = () => new ParameterizedString(getRawString('Diagnostic.overloadClassMethodInconsistent'));
        Diagnostic.overloadFinalInconsistencyImpl = () => new ParameterizedString(getRawString('Diagnostic.overloadFinalInconsistencyImpl'));
        Diagnostic.overloadFinalInconsistencyNoImpl = () => new ParameterizedString(getRawString('Diagnostic.overloadFinalInconsistencyNoImpl'));
        Diagnostic.overloadImplementationMismatch = () => new ParameterizedString(getRawString('Diagnostic.overloadImplementationMismatch'));
        Diagnostic.overloadReturnTypeMismatch = () => new ParameterizedString(getRawString('Diagnostic.overloadReturnTypeMismatch'));
        Diagnostic.overloadStaticMethodInconsistent = () => new ParameterizedString(getRawString('Diagnostic.overloadStaticMethodInconsistent'));
        Diagnostic.overloadWithoutImplementation = () => new ParameterizedString(getRawString('Diagnostic.overloadWithoutImplementation'));
        Diagnostic.overriddenMethodNotFound = () => new ParameterizedString(getRawString('Diagnostic.overriddenMethodNotFound'));
        Diagnostic.overrideDecoratorMissing = () => new ParameterizedString(getRawString('Diagnostic.overrideDecoratorMissing'));
        Diagnostic.paramAfterKwargsParam = () => getRawString('Diagnostic.paramAfterKwargsParam');
        Diagnostic.paramAlreadyAssigned = () => new ParameterizedString(getRawString('Diagnostic.paramAlreadyAssigned'));
        Diagnostic.paramAnnotationMissing = () => new ParameterizedString(getRawString('Diagnostic.paramAnnotationMissing'));
        Diagnostic.paramNameMissing = () => new ParameterizedString(getRawString('Diagnostic.paramNameMissing'));
        Diagnostic.paramSpecArgsKwargsUsage = () => getRawString('Diagnostic.paramSpecArgsKwargsUsage');
        Diagnostic.paramSpecArgsMissing = () => new ParameterizedString(getRawString('Diagnostic.paramSpecArgsMissing'));
        Diagnostic.paramSpecArgsUsage = () => getRawString('Diagnostic.paramSpecArgsUsage');
        Diagnostic.paramSpecAssignedName = () => new ParameterizedString(getRawString('Diagnostic.paramSpecAssignedName'));
        Diagnostic.paramSpecContext = () => getRawString('Diagnostic.paramSpecContext');
        Diagnostic.paramSpecDefaultNotTuple = () => getRawString('Diagnostic.paramSpecDefaultNotTuple');
        Diagnostic.paramSpecFirstArg = () => getRawString('Diagnostic.paramSpecFirstArg');
        Diagnostic.paramSpecKwargsUsage = () => getRawString('Diagnostic.paramSpecKwargsUsage');
        Diagnostic.paramSpecNotUsedByOuterScope = () => new ParameterizedString(getRawString('Diagnostic.paramSpecNotUsedByOuterScope'));
        Diagnostic.paramSpecUnknownArg = () => getRawString('Diagnostic.paramSpecUnknownArg');
        Diagnostic.paramSpecUnknownMember = () => new ParameterizedString(getRawString('Diagnostic.paramSpecUnknownMember'));
        Diagnostic.paramSpecUnknownParam = () => new ParameterizedString(getRawString('Diagnostic.paramSpecUnknownParam'));
        Diagnostic.paramTypeCovariant = () => getRawString('Diagnostic.paramTypeCovariant');
        Diagnostic.paramTypeUnknown = () => new ParameterizedString(getRawString('Diagnostic.paramTypeUnknown'));
        Diagnostic.paramAssignmentMismatch = () => new ParameterizedString(getRawString('Diagnostic.paramAssignmentMismatch'));
        Diagnostic.paramTypePartiallyUnknown = () => new ParameterizedString(getRawString('Diagnostic.paramTypePartiallyUnknown'));
        Diagnostic.parenthesizedContextManagerIllegal = () => getRawString('Diagnostic.parenthesizedContextManagerIllegal');
        Diagnostic.patternNeverMatches = () => new ParameterizedString(getRawString('Diagnostic.patternNeverMatches'));
        Diagnostic.positionArgAfterNamedArg = () => getRawString('Diagnostic.positionArgAfterNamedArg');
        Diagnostic.privateImportFromPyTypedModule = () => new ParameterizedString(getRawString('Diagnostic.privateImportFromPyTypedModule'));
        Diagnostic.positionOnlyAfterArgs = () => getRawString('Diagnostic.positionOnlyAfterArgs');
        Diagnostic.positionOnlyAfterKeywordOnly = () => getRawString('Diagnostic.positionOnlyAfterKeywordOnly');
        Diagnostic.positionOnlyAfterNon = () => getRawString('Diagnostic.positionOnlyAfterNon');
        Diagnostic.positionOnlyIncompatible = () => getRawString('Diagnostic.positionOnlyIncompatible');
        Diagnostic.positionOnlyFirstParam = () => getRawString('Diagnostic.positionOnlyFirstParam');
        Diagnostic.privateUsedOutsideOfClass = () => new ParameterizedString(getRawString('Diagnostic.privateUsedOutsideOfClass'));
        Diagnostic.privateUsedOutsideOfModule = () => new ParameterizedString(getRawString('Diagnostic.privateUsedOutsideOfModule'));
        Diagnostic.propertyOverridden = () => new ParameterizedString(getRawString('Diagnostic.propertyOverridden'));
        Diagnostic.propertyStaticMethod = () => getRawString('Diagnostic.propertyStaticMethod');
        Diagnostic.protectedUsedOutsideOfClass = () => new ParameterizedString(getRawString('Diagnostic.protectedUsedOutsideOfClass'));
        Diagnostic.protocolBaseClass = () => new ParameterizedString(getRawString('Diagnostic.protocolBaseClass'));
        Diagnostic.protocolBaseClassWithTypeArgs = () => getRawString('Diagnostic.protocolBaseClassWithTypeArgs');
        Diagnostic.protocolIllegal = () => getRawString('Diagnostic.protocolIllegal');
        Diagnostic.protocolNotAllowed = () => getRawString('Diagnostic.protocolNotAllowed');
        Diagnostic.protocolTypeArgMustBeTypeParam = () => getRawString('Diagnostic.protocolTypeArgMustBeTypeParam');
        Diagnostic.protocolUnsafeOverlap = () => new ParameterizedString(getRawString('Diagnostic.protocolUnsafeOverlap'));
        Diagnostic.protocolVarianceContravariant = () => new ParameterizedString(getRawString('Diagnostic.protocolVarianceContravariant'));
        Diagnostic.protocolVarianceCovariant = () => new ParameterizedString(getRawString('Diagnostic.protocolVarianceCovariant'));
        Diagnostic.protocolVarianceInvariant = () => new ParameterizedString(getRawString('Diagnostic.protocolVarianceInvariant'));
        Diagnostic.pyrightCommentInvalidDiagnosticBoolValue = () => getRawString('Diagnostic.pyrightCommentInvalidDiagnosticBoolValue');
        Diagnostic.pyrightCommentInvalidDiagnosticSeverityValue = () => getRawString('Diagnostic.pyrightCommentInvalidDiagnosticSeverityValue');
        Diagnostic.pyrightCommentMissingDirective = () => getRawString('Diagnostic.pyrightCommentMissingDirective');
        Diagnostic.pyrightCommentNotOnOwnLine = () => getRawString('Diagnostic.pyrightCommentNotOnOwnLine');
        Diagnostic.pyrightCommentUnknownDirective = () => new ParameterizedString(getRawString('Diagnostic.pyrightCommentUnknownDirective'));
        Diagnostic.pyrightCommentUnknownDiagnosticRule = () => new ParameterizedString(getRawString('Diagnostic.pyrightCommentUnknownDiagnosticRule'));
        Diagnostic.readOnlyArgCount = () => getRawString('Diagnostic.readOnlyArgCount');
        Diagnostic.readOnlyNotInTypedDict = () => getRawString('Diagnostic.readOnlyNotInTypedDict');
        Diagnostic.recursiveDefinition = () => new ParameterizedString(getRawString('Diagnostic.recursiveDefinition'));
        Diagnostic.relativeImportNotAllowed = () => getRawString('Diagnostic.relativeImportNotAllowed');
        Diagnostic.requiredArgCount = () => getRawString('Diagnostic.requiredArgCount');
        Diagnostic.requiredNotInTypedDict = () => getRawString('Diagnostic.requiredNotInTypedDict');
        Diagnostic.returnInAsyncGenerator = () => getRawString('Diagnostic.returnInAsyncGenerator');
        Diagnostic.returnMissing = () => new ParameterizedString(getRawString('Diagnostic.returnMissing'));
        Diagnostic.returnOutsideFunction = () => getRawString('Diagnostic.returnOutsideFunction');
        Diagnostic.returnTypeContravariant = () => getRawString('Diagnostic.returnTypeContravariant');
        Diagnostic.returnTypeMismatch = () => new ParameterizedString(getRawString('Diagnostic.returnTypeMismatch'));
        Diagnostic.returnTypeUnknown = () => getRawString('Diagnostic.returnTypeUnknown');
        Diagnostic.returnTypePartiallyUnknown = () => new ParameterizedString(getRawString('Diagnostic.returnTypePartiallyUnknown'));
        Diagnostic.revealLocalsArgs = () => getRawString('Diagnostic.revealLocalsArgs');
        Diagnostic.revealLocalsNone = () => getRawString('Diagnostic.revealLocalsNone');
        Diagnostic.revealTypeArgs = () => getRawString('Diagnostic.revealTypeArgs');
        Diagnostic.revealTypeExpectedTextArg = () => getRawString('Diagnostic.revealTypeExpectedTextArg');
        Diagnostic.revealTypeExpectedTextMismatch = () => new ParameterizedString(getRawString('Diagnostic.revealTypeExpectedTextMismatch'));
        Diagnostic.revealTypeExpectedTypeMismatch = () => new ParameterizedString(getRawString('Diagnostic.revealTypeExpectedTypeMismatch'));
        Diagnostic.selfTypeContext = () => getRawString('Diagnostic.selfTypeContext');
        Diagnostic.selfTypeMetaclass = () => getRawString('Diagnostic.selfTypeMetaclass');
        Diagnostic.selfTypeWithTypedSelfOrCls = () => getRawString('Diagnostic.selfTypeWithTypedSelfOrCls');
        Diagnostic.setterGetterTypeMismatch = () => getRawString('Diagnostic.setterGetterTypeMismatch');
        Diagnostic.starPatternInAsPattern = () => getRawString('Diagnostic.starPatternInAsPattern');
        Diagnostic.starPatternInOrPattern = () => getRawString('Diagnostic.starPatternInOrPattern');
        Diagnostic.singleOverload = () => new ParameterizedString(getRawString('Diagnostic.singleOverload'));
        Diagnostic.slotsAttributeError = () => new ParameterizedString(getRawString('Diagnostic.slotsAttributeError'));
        Diagnostic.slotsClassVarConflict = () => new ParameterizedString(getRawString('Diagnostic.slotsClassVarConflict'));
        Diagnostic.starStarWildcardNotAllowed = () => getRawString('Diagnostic.starStarWildcardNotAllowed');
        Diagnostic.staticClsSelfParam = () => getRawString('Diagnostic.staticClsSelfParam');
        Diagnostic.stdlibModuleOverridden = () => new ParameterizedString(getRawString('Diagnostic.stdlibModuleOverridden'));
        Diagnostic.stringNonAsciiBytes = () => getRawString('Diagnostic.stringNonAsciiBytes');
        Diagnostic.stringNotSubscriptable = () => getRawString('Diagnostic.stringNotSubscriptable');
        Diagnostic.stringUnsupportedEscape = () => getRawString('Diagnostic.stringUnsupportedEscape');
        Diagnostic.stringUnterminated = () => getRawString('Diagnostic.stringUnterminated');
        Diagnostic.stubFileMissing = () => new ParameterizedString(getRawString('Diagnostic.stubFileMissing'));
        Diagnostic.stubUsesGetAttr = () => getRawString('Diagnostic.stubUsesGetAttr');
        Diagnostic.sublistParamsIncompatible = () => getRawString('Diagnostic.sublistParamsIncompatible');
        Diagnostic.superCallArgCount = () => getRawString('Diagnostic.superCallArgCount');
        Diagnostic.superCallFirstArg = () => new ParameterizedString(getRawString('Diagnostic.superCallFirstArg'));
        Diagnostic.superCallSecondArg = () => new ParameterizedString(getRawString('Diagnostic.superCallSecondArg'));
        Diagnostic.superCallZeroArgForm = () => getRawString('Diagnostic.superCallZeroArgForm');
        Diagnostic.superCallZeroArgFormStaticMethod = () => getRawString('Diagnostic.superCallZeroArgFormStaticMethod');
        Diagnostic.symbolIsUnbound = () => new ParameterizedString(getRawString('Diagnostic.symbolIsUnbound'));
        Diagnostic.symbolIsUndefined = () => new ParameterizedString(getRawString('Diagnostic.symbolIsUndefined'));
        Diagnostic.symbolIsPossiblyUnbound = () => new ParameterizedString(getRawString('Diagnostic.symbolIsPossiblyUnbound'));
        Diagnostic.symbolOverridden = () => new ParameterizedString(getRawString('Diagnostic.symbolOverridden'));
        Diagnostic.ternaryNotAllowed = () => getRawString('Diagnostic.ternaryNotAllowed');
        Diagnostic.totalOrderingMissingMethod = () => getRawString('Diagnostic.totalOrderingMissingMethod');
        Diagnostic.trailingCommaInFromImport = () => getRawString('Diagnostic.trailingCommaInFromImport');
        Diagnostic.tryWithoutExcept = () => getRawString('Diagnostic.tryWithoutExcept');
        Diagnostic.tupleAssignmentMismatch = () => new ParameterizedString(getRawString('Diagnostic.tupleAssignmentMismatch'));
        Diagnostic.tupleInAnnotation = () => getRawString('Diagnostic.tupleInAnnotation');
        Diagnostic.tupleIndexOutOfRange = () => new ParameterizedString(getRawString('Diagnostic.tupleIndexOutOfRange'));
        Diagnostic.typeAliasIllegalExpressionForm = () => getRawString('Diagnostic.typeAliasIllegalExpressionForm');
        Diagnostic.typeAliasIsRecursiveDirect = () => new ParameterizedString(getRawString('Diagnostic.typeAliasIsRecursiveDirect'));
        Diagnostic.typeAliasNotInModuleOrClass = () => getRawString('Diagnostic.typeAliasNotInModuleOrClass');
        Diagnostic.typeAliasRedeclared = () => new ParameterizedString(getRawString('Diagnostic.typeAliasRedeclared'));
        Diagnostic.typeAliasStatementIllegal = () => getRawString('Diagnostic.typeAliasStatementIllegal');
        Diagnostic.typeAliasStatementBadScope = () => getRawString('Diagnostic.typeAliasStatementBadScope');
        Diagnostic.typeAliasTypeBaseClass = () => getRawString('Diagnostic.typeAliasTypeBaseClass');
        Diagnostic.typeAliasTypeMustBeAssigned = () => getRawString('Diagnostic.typeAliasTypeMustBeAssigned');
        Diagnostic.typeAliasTypeNameArg = () => getRawString('Diagnostic.typeAliasTypeNameArg');
        Diagnostic.typeAliasTypeNameMismatch = () => getRawString('Diagnostic.typeAliasTypeNameMismatch');
        Diagnostic.typeAliasTypeParamInvalid = () => getRawString('Diagnostic.typeAliasTypeParamInvalid');
        Diagnostic.typeAnnotationCall = () => getRawString('Diagnostic.typeAnnotationCall');
        Diagnostic.typeAnnotationVariable = () => getRawString('Diagnostic.typeAnnotationVariable');
        Diagnostic.typeAnnotationWithCallable = () => getRawString('Diagnostic.typeAnnotationWithCallable');
        Diagnostic.typeArgListExpected = () => getRawString('Diagnostic.typeArgListExpected');
        Diagnostic.typeArgListNotAllowed = () => getRawString('Diagnostic.typeArgListNotAllowed');
        Diagnostic.typeArgsExpectingNone = () => new ParameterizedString(getRawString('Diagnostic.typeArgsExpectingNone'));
        Diagnostic.typeArgsMismatchOne = () => new ParameterizedString(getRawString('Diagnostic.typeArgsMismatchOne'));
        Diagnostic.typeArgsMissingForAlias = () => new ParameterizedString(getRawString('Diagnostic.typeArgsMissingForAlias'));
        Diagnostic.typeArgsMissingForClass = () => new ParameterizedString(getRawString('Diagnostic.typeArgsMissingForClass'));
        Diagnostic.typeArgsTooFew = () => new ParameterizedString(getRawString('Diagnostic.typeArgsTooFew'));
        Diagnostic.typeArgsTooMany = () => new ParameterizedString(getRawString('Diagnostic.typeArgsTooMany'));
        Diagnostic.typeAssignmentMismatch = () => new ParameterizedString(getRawString('Diagnostic.typeAssignmentMismatch'));
        Diagnostic.typeAssignmentMismatchWildcard = () => new ParameterizedString(getRawString('Diagnostic.typeAssignmentMismatchWildcard'));
        Diagnostic.typeCallNotAllowed = () => getRawString('Diagnostic.typeCallNotAllowed');
        Diagnostic.typeCheckOnly = () => new ParameterizedString(getRawString('Diagnostic.typeCheckOnly'));
        Diagnostic.typeCommentDeprecated = () => getRawString('Diagnostic.typeCommentDeprecated');
        Diagnostic.typedDictAccess = () => getRawString('Diagnostic.typedDictAccess');
        Diagnostic.typedDictAssignedName = () => new ParameterizedString(getRawString('Diagnostic.typedDictAssignedName'));
        Diagnostic.typedDictBadVar = () => getRawString('Diagnostic.typedDictBadVar');
        Diagnostic.typedDictBaseClass = () => getRawString('Diagnostic.typedDictBaseClass');
        Diagnostic.typedDictBoolParam = () => new ParameterizedString(getRawString('Diagnostic.typedDictBoolParam'));
        Diagnostic.typedDictClosedExtras = () => new ParameterizedString(getRawString('Diagnostic.typedDictClosedExtras'));
        Diagnostic.typedDictClosedNoExtras = () => new ParameterizedString(getRawString('Diagnostic.typedDictClosedNoExtras'));
        Diagnostic.typedDictDelete = () => getRawString('Diagnostic.typedDictDelete');
        Diagnostic.typedDictEmptyName = () => getRawString('Diagnostic.typedDictEmptyName');
        Diagnostic.typedDictEntryName = () => getRawString('Diagnostic.typedDictEntryName');
        Diagnostic.typedDictEntryUnique = () => getRawString('Diagnostic.typedDictEntryUnique');
        Diagnostic.typedDictExtraArgs = () => getRawString('Diagnostic.typedDictExtraArgs');
        Diagnostic.typedDictFieldNotRequiredRedefinition = () => new ParameterizedString(getRawString('Diagnostic.typedDictFieldNotRequiredRedefinition'));
        Diagnostic.typedDictFieldReadOnlyRedefinition = () => new ParameterizedString(getRawString('Diagnostic.typedDictFieldReadOnlyRedefinition'));
        Diagnostic.typedDictFieldRequiredRedefinition = () => new ParameterizedString(getRawString('Diagnostic.typedDictFieldRequiredRedefinition'));
        Diagnostic.typedDictFirstArg = () => getRawString('Diagnostic.typedDictFirstArg');
        Diagnostic.typedDictInitsubclassParameter = () => new ParameterizedString(getRawString('Diagnostic.typedDictInitsubclassParameter'));
        Diagnostic.typedDictNotAllowed = () => getRawString('Diagnostic.typedDictNotAllowed');
        Diagnostic.typedDictSecondArgDict = () => getRawString('Diagnostic.typedDictSecondArgDict');
        Diagnostic.typedDictSecondArgDictEntry = () => getRawString('Diagnostic.typedDictSecondArgDictEntry');
        Diagnostic.typedDictSet = () => getRawString('Diagnostic.typedDictSet');
        Diagnostic.typeExpectedClass = () => new ParameterizedString(getRawString('Diagnostic.typeExpectedClass'));
        Diagnostic.typeGuardArgCount = () => getRawString('Diagnostic.typeGuardArgCount');
        Diagnostic.typeGuardParamCount = () => getRawString('Diagnostic.typeGuardParamCount');
        Diagnostic.typeIsReturnType = () => new ParameterizedString(getRawString('Diagnostic.typeIsReturnType'));
        Diagnostic.typeNotAwaitable = () => new ParameterizedString(getRawString('Diagnostic.typeNotAwaitable'));
        Diagnostic.typeNotIntantiable = () => new ParameterizedString(getRawString('Diagnostic.typeNotIntantiable'));
        Diagnostic.typeNotIterable = () => new ParameterizedString(getRawString('Diagnostic.typeNotIterable'));
        Diagnostic.typeNotSpecializable = () => new ParameterizedString(getRawString('Diagnostic.typeNotSpecializable'));
        Diagnostic.typeNotSubscriptable = () => new ParameterizedString(getRawString('Diagnostic.typeNotSubscriptable'));
        Diagnostic.typeNotUsableWith = () => new ParameterizedString(getRawString('Diagnostic.typeNotUsableWith'));
        Diagnostic.typeNotSupportBinaryOperator = () => new ParameterizedString(getRawString('Diagnostic.typeNotSupportBinaryOperator'));
        Diagnostic.typeNotSupportBinaryOperatorBidirectional = () => new ParameterizedString(getRawString('Diagnostic.typeNotSupportBinaryOperatorBidirectional'));
        Diagnostic.typeNotSupportUnaryOperator = () => new ParameterizedString(getRawString('Diagnostic.typeNotSupportUnaryOperator'));
        Diagnostic.typeNotSupportUnaryOperatorBidirectional = () => new ParameterizedString(getRawString('Diagnostic.typeNotSupportUnaryOperatorBidirectional'));
        Diagnostic.typeParameterBoundNotAllowed = () => getRawString('Diagnostic.typeParameterBoundNotAllowed');
        Diagnostic.typeParameterConstraintTuple = () => getRawString('Diagnostic.typeParameterConstraintTuple');
        Diagnostic.typeParameterExistingTypeParameter = () => new ParameterizedString(getRawString('Diagnostic.typeParameterExistingTypeParameter'));
        Diagnostic.typeParametersMissing = () => getRawString('Diagnostic.typeParametersMissing');
        Diagnostic.typeParameterNotDeclared = () => new ParameterizedString(getRawString('Diagnostic.typeParameterNotDeclared'));
        Diagnostic.typePartiallyUnknown = () => new ParameterizedString(getRawString('Diagnostic.typePartiallyUnknown'));
        Diagnostic.typeUnknown = () => new ParameterizedString(getRawString('Diagnostic.typeUnknown'));
        Diagnostic.typeVarAssignedName = () => new ParameterizedString(getRawString('Diagnostic.typeVarAssignedName'));
        Diagnostic.typeVarAssignmentMismatch = () => new ParameterizedString(getRawString('Diagnostic.typeVarAssignmentMismatch'));
        Diagnostic.typeVarBoundAndConstrained = () => getRawString('Diagnostic.typeVarBoundAndConstrained');
        Diagnostic.typeVarBoundGeneric = () => getRawString('Diagnostic.typeVarBoundGeneric');
        Diagnostic.typeVarConstraintGeneric = () => getRawString('Diagnostic.typeVarConstraintGeneric');
        Diagnostic.typeVarDefaultBoundMismatch = () => getRawString('Diagnostic.typeVarDefaultBoundMismatch');
        Diagnostic.typeVarDefaultConstraintMismatch = () => getRawString('Diagnostic.typeVarDefaultConstraintMismatch');
        Diagnostic.typeVarDefaultIllegal = () => getRawString('Diagnostic.typeVarDefaultIllegal');
        Diagnostic.typeVarDefaultInvalidTypeVar = () => new ParameterizedString(getRawString('Diagnostic.typeVarDefaultInvalidTypeVar'));
        Diagnostic.typeVarFirstArg = () => getRawString('Diagnostic.typeVarFirstArg');
        Diagnostic.typeVarNoMember = () => new ParameterizedString(getRawString('Diagnostic.typeVarNoMember'));
        Diagnostic.typeVarNotSubscriptable = () => new ParameterizedString(getRawString('Diagnostic.typeVarNotSubscriptable'));
        Diagnostic.typeVarNotUsedByOuterScope = () => new ParameterizedString(getRawString('Diagnostic.typeVarNotUsedByOuterScope'));
        Diagnostic.typeVarPossiblyUnsolvable = () => new ParameterizedString(getRawString('Diagnostic.typeVarPossiblyUnsolvable'));
        Diagnostic.typeVarSingleConstraint = () => getRawString('Diagnostic.typeVarSingleConstraint');
        Diagnostic.typeVarsNotInGenericOrProtocol = () => getRawString('Diagnostic.typeVarsNotInGenericOrProtocol');
        Diagnostic.typeVarTupleContext = () => getRawString('Diagnostic.typeVarTupleContext');
        Diagnostic.typeVarTupleDefaultNotUnpacked = () => getRawString('Diagnostic.typeVarTupleDefaultNotUnpacked');
        Diagnostic.typeVarTupleMustBeUnpacked = () => getRawString('Diagnostic.typeVarTupleMustBeUnpacked');
        Diagnostic.typeVarTupleConstraints = () => getRawString('Diagnostic.typeVarTupleConstraints');
        Diagnostic.typeVarTupleUnknownParam = () => new ParameterizedString(getRawString('Diagnostic.typeVarTupleUnknownParam'));
        Diagnostic.typeVarUnknownParam = () => new ParameterizedString(getRawString('Diagnostic.typeVarUnknownParam'));
        Diagnostic.typeVarUsedByOuterScope = () => new ParameterizedString(getRawString('Diagnostic.typeVarUsedByOuterScope'));
        Diagnostic.typeVarUsedOnlyOnce = () => new ParameterizedString(getRawString('Diagnostic.typeVarUsedOnlyOnce'));
        Diagnostic.typeVarVariance = () => getRawString('Diagnostic.typeVarVariance');
        Diagnostic.typeVarWithDefaultFollowsVariadic = () => new ParameterizedString(getRawString('Diagnostic.typeVarWithDefaultFollowsVariadic'));
        Diagnostic.typeVarWithoutDefault = () => new ParameterizedString(getRawString('Diagnostic.typeVarWithoutDefault'));
        Diagnostic.unaccessedClass = () => new ParameterizedString(getRawString('Diagnostic.unaccessedClass'));
        Diagnostic.unaccessedFunction = () => new ParameterizedString(getRawString('Diagnostic.unaccessedFunction'));
        Diagnostic.unaccessedImport = () => new ParameterizedString(getRawString('Diagnostic.unaccessedImport'));
        Diagnostic.unaccessedSymbol = () => new ParameterizedString(getRawString('Diagnostic.unaccessedSymbol'));
        Diagnostic.unaccessedVariable = () => new ParameterizedString(getRawString('Diagnostic.unaccessedVariable'));
        Diagnostic.unannotatedFunctionSkipped = () => new ParameterizedString(getRawString('Diagnostic.unannotatedFunctionSkipped'));
        Diagnostic.unaryOperationNotAllowed = () => getRawString('Diagnostic.unaryOperationNotAllowed');
        Diagnostic.unexpectedAsyncToken = () => getRawString('Diagnostic.unexpectedAsyncToken');
        Diagnostic.unexpectedExprToken = () => getRawString('Diagnostic.unexpectedExprToken');
        Diagnostic.unexpectedIndent = () => getRawString('Diagnostic.unexpectedIndent');
        Diagnostic.unexpectedUnindent = () => getRawString('Diagnostic.unexpectedUnindent');
        Diagnostic.unhashableDictKey = () => getRawString('Diagnostic.unhashableDictKey');
        Diagnostic.unhashableSetEntry = () => getRawString('Diagnostic.unhashableSetEntry');
        Diagnostic.unionForwardReferenceNotAllowed = () => getRawString('Diagnostic.unionForwardReferenceNotAllowed');
        Diagnostic.unionSyntaxIllegal = () => getRawString('Diagnostic.unionSyntaxIllegal');
        Diagnostic.unionTypeArgCount = () => getRawString('Diagnostic.unionTypeArgCount');
        Diagnostic.uninitializedAbstractVariables = () => new ParameterizedString(getRawString('Diagnostic.uninitializedAbstractVariables'));
        Diagnostic.uninitializedInstanceVariable = () => new ParameterizedString(getRawString('Diagnostic.uninitializedInstanceVariable'));
        Diagnostic.unionUnpackedTuple = () => getRawString('Diagnostic.unionUnpackedTuple');
        Diagnostic.unionUnpackedTypeVarTuple = () => getRawString('Diagnostic.unionUnpackedTypeVarTuple');
        Diagnostic.unnecessaryCast = () => new ParameterizedString(getRawString('Diagnostic.unnecessaryCast'));
        Diagnostic.unnecessaryIsInstanceAlways = () => new ParameterizedString(getRawString('Diagnostic.unnecessaryIsInstanceAlways'));
        Diagnostic.unnecessaryIsSubclassAlways = () => new ParameterizedString(getRawString('Diagnostic.unnecessaryIsSubclassAlways'));
        Diagnostic.unnecessaryPyrightIgnore = () => getRawString('Diagnostic.unnecessaryPyrightIgnore');
        Diagnostic.unnecessaryPyrightIgnoreRule = () => new ParameterizedString(getRawString('Diagnostic.unnecessaryPyrightIgnoreRule'));
        Diagnostic.unnecessaryTypeIgnore = () => getRawString('Diagnostic.unnecessaryTypeIgnore');
        Diagnostic.unpackArgCount = () => getRawString('Diagnostic.unpackArgCount');
        Diagnostic.unpackedArgInTypeArgument = () => getRawString('Diagnostic.unpackedArgInTypeArgument');
        Diagnostic.unpackedArgWithVariadicParam = () => getRawString('Diagnostic.unpackedArgWithVariadicParam');
        Diagnostic.unpackedDictArgumentNotMapping = () => getRawString('Diagnostic.unpackedDictArgumentNotMapping');
        Diagnostic.unpackedDictSubscriptIllegal = () => getRawString('Diagnostic.unpackedDictSubscriptIllegal');
        Diagnostic.unpackedSubscriptIllegal = () => getRawString('Diagnostic.unpackedSubscriptIllegal');
        Diagnostic.unpackedTypedDictArgument = () => getRawString('Diagnostic.unpackedTypedDictArgument');
        Diagnostic.unpackedTypeVarTupleExpected = () => new ParameterizedString(getRawString('Diagnostic.unpackedTypeVarTupleExpected'));
        Diagnostic.unpackExpectedTypedDict = () => getRawString('Diagnostic.unpackExpectedTypedDict');
        Diagnostic.unpackExpectedTypeVarTuple = () => getRawString('Diagnostic.unpackExpectedTypeVarTuple');
        Diagnostic.unpackIllegalInComprehension = () => getRawString('Diagnostic.unpackIllegalInComprehension');
        Diagnostic.unpackInAnnotation = () => getRawString('Diagnostic.unpackInAnnotation');
        Diagnostic.unpackInDict = () => getRawString('Diagnostic.unpackInDict');
        Diagnostic.unpackInSet = () => getRawString('Diagnostic.unpackInSet');
        Diagnostic.unpackNotAllowed = () => getRawString('Diagnostic.unpackNotAllowed');
        Diagnostic.unpackOperatorNotAllowed = () => getRawString('Diagnostic.unpackOperatorNotAllowed');
        Diagnostic.unpackTuplesIllegal = () => getRawString('Diagnostic.unpackTuplesIllegal');
        Diagnostic.unreachableCode = () => getRawString('Diagnostic.unreachableCode');
        Diagnostic.unreachableExcept = () => getRawString('Diagnostic.unreachableExcept');
        Diagnostic.unsupportedDunderAllOperation = () => getRawString('Diagnostic.unsupportedDunderAllOperation');
        Diagnostic.unusedCallResult = () => new ParameterizedString(getRawString('Diagnostic.unusedCallResult'));
        Diagnostic.unusedCoroutine = () => getRawString('Diagnostic.unusedCoroutine');
        Diagnostic.unusedExpression = () => getRawString('Diagnostic.unusedExpression');
        Diagnostic.varAnnotationIllegal = () => getRawString('Diagnostic.varAnnotationIllegal');
        Diagnostic.variableFinalOverride = () => new ParameterizedString(getRawString('Diagnostic.variableFinalOverride'));
        Diagnostic.variadicTypeArgsTooMany = () => getRawString('Diagnostic.variadicTypeArgsTooMany');
        Diagnostic.variadicTypeParamTooManyAlias = () => new ParameterizedString(getRawString('Diagnostic.variadicTypeParamTooManyAlias'));
        Diagnostic.variadicTypeParamTooManyClass = () => new ParameterizedString(getRawString('Diagnostic.variadicTypeParamTooManyClass'));
        Diagnostic.walrusIllegal = () => getRawString('Diagnostic.walrusIllegal');
        Diagnostic.walrusNotAllowed = () => getRawString('Diagnostic.walrusNotAllowed');
        Diagnostic.wildcardInFunction = () => getRawString('Diagnostic.wildcardInFunction');
        Diagnostic.wildcardPatternTypeUnknown = () => getRawString('Diagnostic.wildcardPatternTypeUnknown');
        Diagnostic.wildcardPatternTypePartiallyUnknown = () => getRawString('Diagnostic.wildcardPatternTypePartiallyUnknown');
        Diagnostic.wildcardLibraryImport = () => getRawString('Diagnostic.wildcardLibraryImport');
        Diagnostic.yieldFromIllegal = () => getRawString('Diagnostic.yieldFromIllegal');
        Diagnostic.yieldFromOutsideAsync = () => getRawString('Diagnostic.yieldFromOutsideAsync');
        Diagnostic.yieldOutsideFunction = () => getRawString('Diagnostic.yieldOutsideFunction');
        Diagnostic.yieldWithinComprehension = () => getRawString('Diagnostic.yieldWithinComprehension');
        Diagnostic.zeroCaseStatementsFound = () => getRawString('Diagnostic.zeroCaseStatementsFound');
        Diagnostic.zeroLengthTupleNotAllowed = () => getRawString('Diagnostic.zeroLengthTupleNotAllowed');
    })(Diagnostic = Localizer.Diagnostic || (Localizer.Diagnostic = {}));
    let DiagnosticAddendum;
    (function (DiagnosticAddendum) {
        DiagnosticAddendum.annotatedNotAllowed = () => getRawString('DiagnosticAddendum.annotatedNotAllowed');
        DiagnosticAddendum.argParam = () => new ParameterizedString(getRawString('DiagnosticAddendum.argParam'));
        DiagnosticAddendum.argParamFunction = () => new ParameterizedString(getRawString('DiagnosticAddendum.argParamFunction'));
        DiagnosticAddendum.argsParamMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.argsParamMissing'));
        DiagnosticAddendum.argsPositionOnly = () => new ParameterizedString(getRawString('DiagnosticAddendum.argsPositionOnly'));
        DiagnosticAddendum.argumentType = () => new ParameterizedString(getRawString('DiagnosticAddendum.argumentType'));
        DiagnosticAddendum.argumentTypes = () => new ParameterizedString(getRawString('DiagnosticAddendum.argumentTypes'));
        DiagnosticAddendum.assignToNone = () => getRawString('DiagnosticAddendum.assignToNone');
        DiagnosticAddendum.asyncHelp = () => getRawString('DiagnosticAddendum.asyncHelp');
        DiagnosticAddendum.baseClassIncompatible = () => new ParameterizedString(getRawString('DiagnosticAddendum.baseClassIncompatible'));
        DiagnosticAddendum.baseClassIncompatibleSubclass = () => new ParameterizedString(getRawString('DiagnosticAddendum.baseClassIncompatibleSubclass'));
        DiagnosticAddendum.baseClassOverriddenType = () => new ParameterizedString(getRawString('DiagnosticAddendum.baseClassOverriddenType'));
        DiagnosticAddendum.baseClassOverridesType = () => new ParameterizedString(getRawString('DiagnosticAddendum.baseClassOverridesType'));
        DiagnosticAddendum.bytesTypePromotions = () => getRawString('DiagnosticAddendum.bytesTypePromotions');
        DiagnosticAddendum.conditionalRequiresBool = () => new ParameterizedString(getRawString('DiagnosticAddendum.conditionalRequiresBool'));
        DiagnosticAddendum.dataClassFrozen = () => new ParameterizedString(getRawString('DiagnosticAddendum.dataClassFrozen'));
        DiagnosticAddendum.dataClassFieldLocation = () => getRawString('DiagnosticAddendum.dataClassFieldLocation');
        DiagnosticAddendum.dataProtocolUnsupported = () => new ParameterizedString(getRawString('DiagnosticAddendum.dataProtocolUnsupported'));
        DiagnosticAddendum.descriptorAccessBindingFailed = () => new ParameterizedString(getRawString('DiagnosticAddendum.descriptorAccessBindingFailed'));
        DiagnosticAddendum.descriptorAccessCallFailed = () => new ParameterizedString(getRawString('DiagnosticAddendum.descriptorAccessCallFailed'));
        DiagnosticAddendum.finalMethod = () => getRawString('DiagnosticAddendum.finalMethod');
        DiagnosticAddendum.functionParamDefaultMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.functionParamDefaultMissing'));
        DiagnosticAddendum.functionParamName = () => new ParameterizedString(getRawString('DiagnosticAddendum.functionParamName'));
        DiagnosticAddendum.functionParamPositionOnly = () => new ParameterizedString(getRawString('DiagnosticAddendum.functionParamPositionOnly'));
        DiagnosticAddendum.functionReturnTypeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.functionReturnTypeMismatch'));
        DiagnosticAddendum.functionTooFewParams = () => new ParameterizedString(getRawString('DiagnosticAddendum.functionTooFewParams'));
        DiagnosticAddendum.genericClassNotAllowed = () => getRawString('DiagnosticAddendum.genericClassNotAllowed');
        DiagnosticAddendum.incompatibleGetter = () => getRawString('DiagnosticAddendum.incompatibleGetter');
        DiagnosticAddendum.incompatibleSetter = () => getRawString('DiagnosticAddendum.incompatibleSetter');
        DiagnosticAddendum.incompatibleDeleter = () => getRawString('DiagnosticAddendum.incompatibleDeleter');
        DiagnosticAddendum.initMethodLocation = () => new ParameterizedString(getRawString('DiagnosticAddendum.initMethodLocation'));
        DiagnosticAddendum.initMethodSignature = () => new ParameterizedString(getRawString('DiagnosticAddendum.initMethodSignature'));
        DiagnosticAddendum.initSubclassLocation = () => new ParameterizedString(getRawString('DiagnosticAddendum.initSubclassLocation'));
        DiagnosticAddendum.invariantSuggestionDict = () => getRawString('DiagnosticAddendum.invariantSuggestionDict');
        DiagnosticAddendum.invariantSuggestionList = () => getRawString('DiagnosticAddendum.invariantSuggestionList');
        DiagnosticAddendum.invariantSuggestionSet = () => getRawString('DiagnosticAddendum.invariantSuggestionSet');
        DiagnosticAddendum.isinstanceClassNotSupported = () => new ParameterizedString(getRawString('DiagnosticAddendum.isinstanceClassNotSupported'));
        DiagnosticAddendum.functionTooManyParams = () => new ParameterizedString(getRawString('DiagnosticAddendum.functionTooManyParams'));
        DiagnosticAddendum.keyNotRequired = () => new ParameterizedString(getRawString('DiagnosticAddendum.keyNotRequired'));
        DiagnosticAddendum.keyReadOnly = () => new ParameterizedString(getRawString('DiagnosticAddendum.keyReadOnly'));
        DiagnosticAddendum.keyRequiredDeleted = () => new ParameterizedString(getRawString('DiagnosticAddendum.keyRequiredDeleted'));
        DiagnosticAddendum.keyUndefined = () => new ParameterizedString(getRawString('DiagnosticAddendum.keyUndefined'));
        DiagnosticAddendum.kwargsParamMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.kwargsParamMissing'));
        DiagnosticAddendum.listAssignmentMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.listAssignmentMismatch'));
        DiagnosticAddendum.literalAssignmentMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.literalAssignmentMismatch'));
        DiagnosticAddendum.matchIsNotExhaustiveType = () => new ParameterizedString(getRawString('DiagnosticAddendum.matchIsNotExhaustiveType'));
        DiagnosticAddendum.matchIsNotExhaustiveHint = () => getRawString('DiagnosticAddendum.matchIsNotExhaustiveHint');
        DiagnosticAddendum.memberAssignment = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberAssignment'));
        DiagnosticAddendum.memberIsAbstract = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsAbstract'));
        DiagnosticAddendum.memberIsAbstractMore = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsAbstractMore'));
        DiagnosticAddendum.memberIsClassVarInProtocol = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsClassVarInProtocol'));
        DiagnosticAddendum.memberIsFinalInProtocol = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsFinalInProtocol'));
        DiagnosticAddendum.memberIsInitVar = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsInitVar'));
        DiagnosticAddendum.memberIsInvariant = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsInvariant'));
        DiagnosticAddendum.memberIsNotClassVarInClass = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsNotClassVarInClass'));
        DiagnosticAddendum.memberIsNotClassVarInProtocol = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsNotClassVarInProtocol'));
        DiagnosticAddendum.memberIsNotFinalInProtocol = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsNotFinalInProtocol'));
        DiagnosticAddendum.memberIsWritableInProtocol = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberIsWritableInProtocol'));
        DiagnosticAddendum.memberSetClassVar = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberSetClassVar'));
        DiagnosticAddendum.memberTypeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberTypeMismatch'));
        DiagnosticAddendum.memberUnknown = () => new ParameterizedString(getRawString('DiagnosticAddendum.memberUnknown'));
        DiagnosticAddendum.metaclassConflict = () => new ParameterizedString(getRawString('DiagnosticAddendum.metaclassConflict'));
        DiagnosticAddendum.missingGetter = () => getRawString('DiagnosticAddendum.missingGetter');
        DiagnosticAddendum.missingSetter = () => getRawString('DiagnosticAddendum.missingSetter');
        DiagnosticAddendum.missingDeleter = () => getRawString('DiagnosticAddendum.missingDeleter');
        DiagnosticAddendum.namedParamMissingInDest = () => new ParameterizedString(getRawString('DiagnosticAddendum.namedParamMissingInDest'));
        DiagnosticAddendum.namedParamMissingInSource = () => new ParameterizedString(getRawString('DiagnosticAddendum.namedParamMissingInSource'));
        DiagnosticAddendum.namedParamTypeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.namedParamTypeMismatch'));
        DiagnosticAddendum.namedTupleNotAllowed = () => getRawString('DiagnosticAddendum.namedTupleNotAllowed');
        DiagnosticAddendum.newMethodLocation = () => new ParameterizedString(getRawString('DiagnosticAddendum.newMethodLocation'));
        DiagnosticAddendum.newMethodSignature = () => new ParameterizedString(getRawString('DiagnosticAddendum.newMethodSignature'));
        DiagnosticAddendum.noneNotAllowed = () => getRawString('DiagnosticAddendum.noneNotAllowed');
        DiagnosticAddendum.newTypeClassNotAllowed = () => getRawString('DiagnosticAddendum.newTypeClassNotAllowed');
        DiagnosticAddendum.noOverloadAssignable = () => new ParameterizedString(getRawString('DiagnosticAddendum.noOverloadAssignable'));
        DiagnosticAddendum.orPatternMissingName = () => new ParameterizedString(getRawString('DiagnosticAddendum.orPatternMissingName'));
        DiagnosticAddendum.overloadIndex = () => new ParameterizedString(getRawString('DiagnosticAddendum.overloadIndex'));
        DiagnosticAddendum.overloadSignature = () => getRawString('DiagnosticAddendum.overloadSignature');
        DiagnosticAddendum.overloadNotAssignable = () => new ParameterizedString(getRawString('DiagnosticAddendum.overloadNotAssignable'));
        DiagnosticAddendum.overriddenMethod = () => getRawString('DiagnosticAddendum.overriddenMethod');
        DiagnosticAddendum.overriddenSymbol = () => getRawString('DiagnosticAddendum.overriddenSymbol');
        DiagnosticAddendum.overrideIsInvariant = () => getRawString('DiagnosticAddendum.overrideIsInvariant');
        DiagnosticAddendum.overrideInvariantMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideInvariantMismatch'));
        DiagnosticAddendum.overrideNoOverloadMatches = () => getRawString('DiagnosticAddendum.overrideNoOverloadMatches');
        DiagnosticAddendum.overrideNotClassMethod = () => getRawString('DiagnosticAddendum.overrideNotClassMethod');
        DiagnosticAddendum.overrideNotInstanceMethod = () => getRawString('DiagnosticAddendum.overrideNotInstanceMethod');
        DiagnosticAddendum.overrideNotStaticMethod = () => getRawString('DiagnosticAddendum.overrideNotStaticMethod');
        DiagnosticAddendum.overrideOverloadNoMatch = () => getRawString('DiagnosticAddendum.overrideOverloadNoMatch');
        DiagnosticAddendum.overrideOverloadOrder = () => getRawString('DiagnosticAddendum.overrideOverloadOrder');
        DiagnosticAddendum.overrideParamKeywordNoDefault = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamKeywordNoDefault'));
        DiagnosticAddendum.overrideParamKeywordType = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamKeywordType'));
        DiagnosticAddendum.overrideParamName = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamName'));
        DiagnosticAddendum.overrideParamNameExtra = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamNameExtra'));
        DiagnosticAddendum.overrideParamNameMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamNameMissing'));
        DiagnosticAddendum.overrideParamNamePositionOnly = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamNamePositionOnly'));
        DiagnosticAddendum.overrideParamNoDefault = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamNoDefault'));
        DiagnosticAddendum.overrideParamType = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideParamType'));
        DiagnosticAddendum.overridePositionalParamCount = () => new ParameterizedString(getRawString('DiagnosticAddendum.overridePositionalParamCount'));
        DiagnosticAddendum.overrideReturnType = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideReturnType'));
        DiagnosticAddendum.overrideType = () => new ParameterizedString(getRawString('DiagnosticAddendum.overrideType'));
        DiagnosticAddendum.paramAssignment = () => new ParameterizedString(getRawString('DiagnosticAddendum.paramAssignment'));
        DiagnosticAddendum.paramSpecMissingInOverride = () => getRawString('DiagnosticAddendum.paramSpecMissingInOverride');
        DiagnosticAddendum.paramType = () => new ParameterizedString(getRawString('DiagnosticAddendum.paramType'));
        DiagnosticAddendum.privateImportFromPyTypedSource = () => new ParameterizedString(getRawString('DiagnosticAddendum.privateImportFromPyTypedSource'));
        DiagnosticAddendum.propertyAccessFromProtocolClass = () => getRawString('DiagnosticAddendum.propertyAccessFromProtocolClass');
        DiagnosticAddendum.propertyMethodIncompatible = () => new ParameterizedString(getRawString('DiagnosticAddendum.propertyMethodIncompatible'));
        DiagnosticAddendum.propertyMethodMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.propertyMethodMissing'));
        DiagnosticAddendum.propertyMissingDeleter = () => new ParameterizedString(getRawString('DiagnosticAddendum.propertyMissingDeleter'));
        DiagnosticAddendum.propertyMissingSetter = () => new ParameterizedString(getRawString('DiagnosticAddendum.propertyMissingSetter'));
        DiagnosticAddendum.protocolIncompatible = () => new ParameterizedString(getRawString('DiagnosticAddendum.protocolIncompatible'));
        DiagnosticAddendum.protocolMemberMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.protocolMemberMissing'));
        DiagnosticAddendum.protocolRequiresRuntimeCheckable = () => getRawString('DiagnosticAddendum.protocolRequiresRuntimeCheckable');
        DiagnosticAddendum.protocolSourceIsNotConcrete = () => new ParameterizedString(getRawString('DiagnosticAddendum.protocolSourceIsNotConcrete'));
        DiagnosticAddendum.protocolUnsafeOverlap = () => new ParameterizedString(getRawString('DiagnosticAddendum.protocolUnsafeOverlap'));
        DiagnosticAddendum.pyrightCommentIgnoreTip = () => getRawString('DiagnosticAddendum.pyrightCommentIgnoreTip');
        DiagnosticAddendum.readOnlyAttribute = () => new ParameterizedString(getRawString('DiagnosticAddendum.readOnlyAttribute'));
        DiagnosticAddendum.seeDeclaration = () => getRawString('DiagnosticAddendum.seeDeclaration');
        DiagnosticAddendum.seeClassDeclaration = () => getRawString('DiagnosticAddendum.seeClassDeclaration');
        DiagnosticAddendum.seeFunctionDeclaration = () => getRawString('DiagnosticAddendum.seeFunctionDeclaration');
        DiagnosticAddendum.seeMethodDeclaration = () => getRawString('DiagnosticAddendum.seeMethodDeclaration');
        DiagnosticAddendum.seeParameterDeclaration = () => getRawString('DiagnosticAddendum.seeParameterDeclaration');
        DiagnosticAddendum.seeTypeAliasDeclaration = () => getRawString('DiagnosticAddendum.seeTypeAliasDeclaration');
        DiagnosticAddendum.seeVariableDeclaration = () => getRawString('DiagnosticAddendum.seeVariableDeclaration');
        DiagnosticAddendum.tupleEntryTypeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.tupleEntryTypeMismatch'));
        DiagnosticAddendum.tupleAssignmentMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.tupleAssignmentMismatch'));
        DiagnosticAddendum.tupleSizeIndeterminateSrc = () => new ParameterizedString(getRawString('DiagnosticAddendum.tupleSizeIndeterminateSrc'));
        DiagnosticAddendum.tupleSizeIndeterminateSrcDest = () => new ParameterizedString(getRawString('DiagnosticAddendum.tupleSizeIndeterminateSrcDest'));
        DiagnosticAddendum.tupleSizeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.tupleSizeMismatch'));
        DiagnosticAddendum.tupleSizeMismatchIndeterminateDest = () => new ParameterizedString(getRawString('DiagnosticAddendum.tupleSizeMismatchIndeterminateDest'));
        DiagnosticAddendum.typeAliasInstanceCheck = () => getRawString('DiagnosticAddendum.typeAliasInstanceCheck');
        DiagnosticAddendum.typeAssignmentMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeAssignmentMismatch'));
        DiagnosticAddendum.typeBound = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeBound'));
        DiagnosticAddendum.typeConstrainedTypeVar = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeConstrainedTypeVar'));
        DiagnosticAddendum.typedDictBaseClass = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictBaseClass'));
        DiagnosticAddendum.typedDictClassNotAllowed = () => getRawString('DiagnosticAddendum.typedDictClassNotAllowed');
        DiagnosticAddendum.typedDictExtraFieldNotAllowed = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictExtraFieldNotAllowed'));
        DiagnosticAddendum.typedDictExtraFieldTypeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictExtraFieldTypeMismatch'));
        DiagnosticAddendum.typedDictFieldMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictFieldMissing'));
        DiagnosticAddendum.typedDictClosedExtraNotAllowed = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictClosedExtraNotAllowed'));
        DiagnosticAddendum.typedDictClosedExtraTypeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictClosedExtraTypeMismatch'));
        DiagnosticAddendum.typedDictClosedFieldNotRequired = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictClosedFieldNotRequired'));
        DiagnosticAddendum.typedDictFieldNotReadOnly = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictFieldNotReadOnly'));
        DiagnosticAddendum.typedDictFieldNotRequired = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictFieldNotRequired'));
        DiagnosticAddendum.typedDictFieldRequired = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictFieldRequired'));
        DiagnosticAddendum.typedDictFieldTypeMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictFieldTypeMismatch'));
        DiagnosticAddendum.typedDictFieldUndefined = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictFieldUndefined'));
        DiagnosticAddendum.typedDictFinalMismatch = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictFinalMismatch'));
        DiagnosticAddendum.typedDictKeyAccess = () => new ParameterizedString(getRawString('DiagnosticAddendum.typedDictKeyAccess'));
        DiagnosticAddendum.typedDictNotAllowed = () => getRawString('DiagnosticAddendum.typedDictNotAllowed');
        DiagnosticAddendum.typeIncompatible = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeIncompatible'));
        DiagnosticAddendum.typeNotClass = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeNotClass'));
        DiagnosticAddendum.typeParamSpec = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeParamSpec'));
        DiagnosticAddendum.typeNotStringLiteral = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeNotStringLiteral'));
        DiagnosticAddendum.typeOfSymbol = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeOfSymbol'));
        DiagnosticAddendum.typeUnsupported = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeUnsupported'));
        DiagnosticAddendum.typeVarDefaultOutOfScope = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeVarDefaultOutOfScope'));
        DiagnosticAddendum.typeVarIsContravariant = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeVarIsContravariant'));
        DiagnosticAddendum.typeVarIsCovariant = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeVarIsCovariant'));
        DiagnosticAddendum.typeVarIsInvariant = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeVarIsInvariant'));
        DiagnosticAddendum.typeVarsMissing = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeVarsMissing'));
        DiagnosticAddendum.typeVarNotAllowed = () => getRawString('DiagnosticAddendum.typeVarNotAllowed');
        DiagnosticAddendum.typeVarTupleRequiresKnownLength = () => getRawString('DiagnosticAddendum.typeVarTupleRequiresKnownLength');
        DiagnosticAddendum.typeVarUnnecessarySuggestion = () => new ParameterizedString(getRawString('DiagnosticAddendum.typeVarUnnecessarySuggestion'));
        DiagnosticAddendum.typeVarUnsolvableRemedy = () => getRawString('DiagnosticAddendum.typeVarUnsolvableRemedy');
        DiagnosticAddendum.unhashableType = () => new ParameterizedString(getRawString('DiagnosticAddendum.unhashableType'));
        DiagnosticAddendum.uninitializedAbstractVariable = () => new ParameterizedString(getRawString('DiagnosticAddendum.uninitializedAbstractVariable'));
        DiagnosticAddendum.unreachableExcept = () => new ParameterizedString(getRawString('DiagnosticAddendum.unreachableExcept'));
        DiagnosticAddendum.useDictInstead = () => getRawString('DiagnosticAddendum.useDictInstead');
        DiagnosticAddendum.useListInstead = () => getRawString('DiagnosticAddendum.useListInstead');
        DiagnosticAddendum.useTupleInstead = () => getRawString('DiagnosticAddendum.useTupleInstead');
        DiagnosticAddendum.useTypeInstead = () => getRawString('DiagnosticAddendum.useTypeInstead');
        DiagnosticAddendum.varianceMismatchForClass = () => new ParameterizedString(getRawString('DiagnosticAddendum.varianceMismatchForClass'));
        DiagnosticAddendum.varianceMismatchForTypeAlias = () => new ParameterizedString(getRawString('DiagnosticAddendum.varianceMismatchForTypeAlias'));
    })(DiagnosticAddendum = Localizer.DiagnosticAddendum || (Localizer.DiagnosticAddendum = {}));
    let CodeAction;
    (function (CodeAction) {
        CodeAction.createTypeStub = () => getRawString('CodeAction.createTypeStub');
        CodeAction.createTypeStubFor = () => new ParameterizedString(getRawString('CodeAction.createTypeStubFor'));
        CodeAction.executingCommand = () => getRawString('CodeAction.executingCommand');
        CodeAction.filesToAnalyzeOne = () => getRawString('CodeAction.filesToAnalyzeOne');
        CodeAction.filesToAnalyzeCount = () => new ParameterizedString(getRawString('CodeAction.filesToAnalyzeCount'));
        CodeAction.findingReferences = () => getRawString('CodeAction.findingReferences');
        CodeAction.organizeImports = () => getRawString('CodeAction.organizeImports');
        CodeAction.renameShadowedFile = () => new ParameterizedString(getRawString('CodeAction.renameShadowedFile'));
    })(CodeAction = Localizer.CodeAction || (Localizer.CodeAction = {}));
    let Completion;
    (function (Completion) {
        Completion.autoImportDetail = () => getRawString('Completion.autoImportDetail');
        Completion.indexValueDetail = () => getRawString('Completion.indexValueDetail');
    })(Completion = Localizer.Completion || (Localizer.Completion = {}));
})(Localizer || (exports.Localizer = Localizer = {}));
exports.LocMessage = Localizer.Diagnostic;
exports.LocAddendum = Localizer.DiagnosticAddendum;
//# sourceMappingURL=localize.js.map