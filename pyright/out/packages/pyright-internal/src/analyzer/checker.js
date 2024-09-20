"use strict";
/*
 * checker.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A parse tree walker that performs static type checking for
 * a source file. Most of its work is performed by the type
 * evaluator, but this module touches every node in the file
 * to ensure that all statements and expressions are evaluated
 * and checked. It also performs some additional checks that
 * cannot (or should not be) performed lazily.
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
exports.Checker = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const collectionUtils_1 = require("../common/collectionUtils");
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const pythonVersion_1 = require("../common/pythonVersion");
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const definitionProvider_1 = require("../languageService/definitionProvider");
const localize_1 = require("../localization/localize");
const parseNodes_1 = require("../parser/parseNodes");
const stringTokenUtils_1 = require("../parser/stringTokenUtils");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const constructors_1 = require("./constructors");
const dataClasses_1 = require("./dataClasses");
const declaration_1 = require("./declaration");
const declarationUtils_1 = require("./declarationUtils");
const deprecatedSymbols_1 = require("./deprecatedSymbols");
const enums_1 = require("./enums");
const importResolver_1 = require("./importResolver");
const importStatementUtils_1 = require("./importStatementUtils");
const parameterUtils_1 = require("./parameterUtils");
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const parseTreeWalker_1 = require("./parseTreeWalker");
const patternMatching_1 = require("./patternMatching");
const protocols_1 = require("./protocols");
const scopeUtils_1 = require("./scopeUtils");
const sourceFile_1 = require("./sourceFile");
const sourceMapper_1 = require("./sourceMapper");
const staticExpressions_1 = require("./staticExpressions");
const SymbolNameUtils = __importStar(require("./symbolNameUtils"));
const symbolUtils_1 = require("./symbolUtils");
const typeEvaluator_1 = require("./typeEvaluator");
const typeGuards_1 = require("./typeGuards");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
const typedDicts_1 = require("./typedDicts");
const types_1 = require("./types");
// When enabled, this debug flag causes the code complexity of
// functions to be emitted.
const isPrintCodeComplexityEnabled = false;
class Checker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_importResolver, _evaluator, parseResults, _sourceMapper, _dependentFiles) {
        super();
        this._importResolver = _importResolver;
        this._evaluator = _evaluator;
        this._sourceMapper = _sourceMapper;
        this._dependentFiles = _dependentFiles;
        this._isUnboundCheckSuppressed = false;
        // A list of all nodes that are defined within the module that
        // have their own scopes.
        this._scopedNodes = [];
        // A list of all visited type parameter lists.
        this._typeParameterLists = [];
        this._moduleNode = parseResults.parseTree;
        this._fileInfo = AnalyzerNodeInfo.getFileInfo(this._moduleNode);
    }
    check() {
        this._scopedNodes.push(this._moduleNode);
        this._conditionallyReportShadowedModule();
        // Report code complexity issues for the module.
        const codeComplexity = AnalyzerNodeInfo.getCodeFlowComplexity(this._moduleNode);
        if (isPrintCodeComplexityEnabled) {
            console.log(`Code complexity of module ${this._fileInfo.fileUri.toUserVisibleString()} is ${codeComplexity.toString()}`);
        }
        if (codeComplexity > typeEvaluator_1.maxCodeComplexity) {
            this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.codeTooComplexToAnalyze(), { start: 0, length: 0 });
        }
        this._walkStatementsAndReportUnreachable(this._moduleNode.statements);
        // Mark symbols accessed by __all__ as accessed.
        const dunderAllInfo = AnalyzerNodeInfo.getDunderAllInfo(this._moduleNode);
        if (dunderAllInfo) {
            this._evaluator.markNamesAccessed(this._moduleNode, dunderAllInfo.names);
            this._reportUnusedDunderAllSymbols(dunderAllInfo.stringNodes);
        }
        // Perform a one-time validation of symbols in all scopes
        // defined in this module for things like unaccessed variables.
        this._validateSymbolTables();
        this._reportDuplicateImports();
    }
    walk(node) {
        if (!AnalyzerNodeInfo.isCodeUnreachable(node)) {
            super.walk(node);
        }
        else {
            this._evaluator.suppressDiagnostics(node, () => {
                super.walk(node);
            });
        }
    }
    visitSuite(node) {
        this._walkStatementsAndReportUnreachable(node.statements);
        return false;
    }
    visitStatementList(node) {
        node.statements.forEach((statement) => {
            if ((0, parseNodes_1.isExpressionNode)(statement)) {
                // Evaluate the expression in case it wasn't otherwise evaluated
                // through lazy analysis. This will mark referenced symbols as
                // accessed and report any errors associated with it.
                this._evaluator.getType(statement);
                this._reportUnusedExpression(statement);
            }
        });
        return true;
    }
    visitClass(node) {
        const classTypeResult = this._evaluator.getTypeOfClass(node);
        if (node.typeParameters) {
            this.walk(node.typeParameters);
        }
        this.walk(node.suite);
        this.walkMultiple(node.decorators);
        this.walkMultiple(node.arguments);
        if (classTypeResult) {
            // Protocol classes cannot derive from non-protocol classes.
            if (types_1.ClassType.isProtocolClass(classTypeResult.classType)) {
                node.arguments.forEach((arg) => {
                    if (!arg.name) {
                        const baseClassType = this._evaluator.getType(arg.valueExpression);
                        if (baseClassType &&
                            (0, types_1.isInstantiableClass)(baseClassType) &&
                            !types_1.ClassType.isBuiltIn(baseClassType, 'Protocol') &&
                            !types_1.ClassType.isBuiltIn(baseClassType, 'Generic')) {
                            if (!types_1.ClassType.isProtocolClass(baseClassType)) {
                                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.protocolBaseClass().format({
                                    classType: classTypeResult.classType.details.name,
                                    baseType: baseClassType.details.name,
                                }), arg.valueExpression);
                            }
                        }
                    }
                });
                // If this is a generic protocol class, verify that its type variables
                // have the proper variance.
                this._validateProtocolTypeParamVariance(node, classTypeResult.classType);
            }
            // Skip the slots check because class variables declared in a stub
            // file are interpreted as instance variables.
            if (!this._fileInfo.isStubFile) {
                this._validateSlotsClassVarConflict(classTypeResult.classType);
            }
            this._validateBaseClassOverrides(classTypeResult.classType);
            this._validateTypedDictOverrides(classTypeResult.classType);
            this._validateOverloadDecoratorConsistency(classTypeResult.classType);
            this._validateMultipleInheritanceBaseClasses(classTypeResult.classType, node.name);
            this._validateMultipleInheritanceCompatibility(classTypeResult.classType, node.name);
            this._validateConstructorConsistency(classTypeResult.classType, node.name);
            this._validateFinalMemberOverrides(classTypeResult.classType);
            this._validateInstanceVariableInitialization(node, classTypeResult.classType);
            this._validateFinalClassNotAbstract(classTypeResult.classType, node);
            this._validateDataClassPostInit(classTypeResult.classType, node);
            this._validateEnumMembers(classTypeResult.classType, node);
            if (types_1.ClassType.isTypedDictClass(classTypeResult.classType)) {
                this._validateTypedDictClassSuite(node.suite);
            }
            if (types_1.ClassType.isEnumClass(classTypeResult.classType)) {
                this._validateEnumClassOverride(node, classTypeResult.classType);
            }
            this._evaluator.validateInitSubclassArgs(node, classTypeResult.classType);
        }
        this._scopedNodes.push(node);
        return false;
    }
    visitFunction(node) {
        var _a, _b;
        if (node.typeParameters) {
            this.walk(node.typeParameters);
        }
        if (!this._fileInfo.diagnosticRuleSet.analyzeUnannotatedFunctions && !this._fileInfo.isStubFile) {
            if (ParseTreeUtils.isUnannotatedFunction(node)) {
                this._evaluator.addInformation(localize_1.LocMessage.unannotatedFunctionSkipped().format({ name: node.name.value }), node.name);
            }
        }
        const functionTypeResult = this._evaluator.getTypeOfFunction(node);
        const containingClassNode = ParseTreeUtils.getEnclosingClass(node, /* stopAtFunction */ true);
        if (functionTypeResult) {
            // Track whether we have seen a *args: P.args parameter. Named
            // parameters after this need to be flagged as an error.
            let sawParamSpecArgs = false;
            const keywordNames = new Set();
            const paramDetails = (0, parameterUtils_1.getParameterListDetails)(functionTypeResult.functionType);
            // Report any unknown or missing parameter types.
            node.parameters.forEach((param, index) => {
                if (param.name) {
                    if (param.category === 0 /* ParameterCategory.Simple */ && index >= paramDetails.positionOnlyParamCount) {
                        keywordNames.add(param.name.value);
                    }
                    // Determine whether this is a P.args parameter.
                    if (param.category === 1 /* ParameterCategory.ArgsList */) {
                        const annotationExpr = param.typeAnnotation || param.typeAnnotationComment;
                        if (annotationExpr &&
                            annotationExpr.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                            annotationExpr.memberName.value === 'args') {
                            const baseType = this._evaluator.getType(annotationExpr.leftExpression);
                            if (baseType && (0, types_1.isTypeVar)(baseType) && baseType.details.isParamSpec) {
                                sawParamSpecArgs = true;
                            }
                        }
                    }
                    else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
                        sawParamSpecArgs = false;
                    }
                }
                if (param.name && param.category === 0 /* ParameterCategory.Simple */ && sawParamSpecArgs) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.namedParamAfterParamSpecArgs().format({ name: param.name.value }), param.name);
                }
                // Allow unknown and missing param types if the param is named '_'.
                if (param.name && param.name.value !== '_') {
                    const functionTypeParam = functionTypeResult.functionType.details.parameters.find((p) => { var _a; return p.name === ((_a = param.name) === null || _a === void 0 ? void 0 : _a.value); });
                    if (functionTypeParam) {
                        const paramType = functionTypeParam.type;
                        if (this._fileInfo.diagnosticRuleSet.reportUnknownParameterType !== 'none') {
                            if ((0, types_1.isUnknown)(paramType) ||
                                ((0, types_1.isTypeVar)(paramType) &&
                                    paramType.details.isSynthesized &&
                                    !paramType.details.isSynthesizedSelf)) {
                                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownParameterType, localize_1.LocMessage.paramTypeUnknown().format({ paramName: param.name.value }), param.name);
                            }
                            else if ((0, typeUtils_1.isPartlyUnknown)(paramType)) {
                                const diagAddendum = new diagnostic_1.DiagnosticAddendum();
                                diagAddendum.addMessage(localize_1.LocAddendum.paramType().format({
                                    paramType: this._evaluator.printType(paramType, { expandTypeAlias: true }),
                                }));
                                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownParameterType, localize_1.LocMessage.paramTypePartiallyUnknown().format({
                                    paramName: param.name.value,
                                }) + diagAddendum.getString(), param.name);
                            }
                        }
                        let hasAnnotation = false;
                        if (functionTypeParam.typeAnnotation) {
                            hasAnnotation = true;
                        }
                        else {
                            // See if this is a "self" and "cls" parameter. They are exempt from this rule.
                            if ((0, types_1.isTypeVar)(paramType) && paramType.details.isSynthesizedSelf) {
                                hasAnnotation = true;
                            }
                        }
                        if (!hasAnnotation && this._fileInfo.diagnosticRuleSet.reportMissingParameterType !== 'none') {
                            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportMissingParameterType, localize_1.LocMessage.paramAnnotationMissing().format({ name: param.name.value }), param.name);
                        }
                    }
                }
            });
            // Verify that an unpacked TypedDict doesn't overlap any keyword parameters.
            if (paramDetails.hasUnpackedTypedDict) {
                const kwargsIndex = functionTypeResult.functionType.details.parameters.length - 1;
                const kwargsType = types_1.FunctionType.getEffectiveParameterType(functionTypeResult.functionType, kwargsIndex);
                if ((0, types_1.isClass)(kwargsType) && kwargsType.details.typedDictEntries) {
                    const overlappingEntries = new Set();
                    kwargsType.details.typedDictEntries.knownItems.forEach((_, name) => {
                        if (keywordNames.has(name)) {
                            overlappingEntries.add(name);
                        }
                    });
                    if (overlappingEntries.size > 0) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.overlappingKeywordArgs().format({
                            names: [...overlappingEntries.values()].join(', '),
                        }), (_a = node.parameters[kwargsIndex].typeAnnotation) !== null && _a !== void 0 ? _a : node.parameters[kwargsIndex]);
                    }
                }
            }
            // Check for invalid use of ParamSpec P.args and P.kwargs.
            const paramSpecParams = functionTypeResult.functionType.details.parameters.filter((param) => {
                if (param.typeAnnotation && (0, types_1.isTypeVar)(param.type) && (0, types_1.isParamSpec)(param.type)) {
                    if (param.category !== 0 /* ParameterCategory.Simple */ && param.name && param.type.paramSpecAccess) {
                        return true;
                    }
                }
                return false;
            });
            if (paramSpecParams.length === 1 && paramSpecParams[0].typeAnnotation) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.paramSpecArgsKwargsUsage(), paramSpecParams[0].typeAnnotation);
            }
            // If this is a stub, ensure that the return type is specified.
            if (this._fileInfo.isStubFile) {
                const returnAnnotation = node.returnTypeAnnotation || ((_b = node.functionAnnotationComment) === null || _b === void 0 ? void 0 : _b.returnTypeAnnotation);
                if (!returnAnnotation) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownParameterType, localize_1.LocMessage.returnTypeUnknown(), node.name);
                }
            }
            if (containingClassNode) {
                this._validateMethod(node, functionTypeResult.functionType, containingClassNode);
            }
        }
        node.parameters.forEach((param, index) => {
            if (param.defaultValue) {
                this.walk(param.defaultValue);
            }
            if (param.typeAnnotation) {
                this.walk(param.typeAnnotation);
            }
            if (param.typeAnnotationComment) {
                this.walk(param.typeAnnotationComment);
            }
            // Look for method parameters that are typed with TypeVars that have the wrong variance.
            if (functionTypeResult) {
                const annotationNode = param.typeAnnotation || param.typeAnnotationComment;
                if (annotationNode && index < functionTypeResult.functionType.details.parameters.length) {
                    const paramType = functionTypeResult.functionType.details.parameters[index].type;
                    const exemptMethods = ['__init__', '__new__'];
                    if (containingClassNode &&
                        (0, types_1.isTypeVar)(paramType) &&
                        paramType.details.declaredVariance === 3 /* Variance.Covariant */ &&
                        !paramType.details.isSynthesized &&
                        !exemptMethods.some((name) => name === functionTypeResult.functionType.details.name)) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.paramTypeCovariant(), annotationNode);
                    }
                }
            }
        });
        if (node.returnTypeAnnotation) {
            this.walk(node.returnTypeAnnotation);
        }
        if (node.functionAnnotationComment) {
            this.walk(node.functionAnnotationComment);
            if (this._fileInfo.diagnosticRuleSet.reportTypeCommentUsage !== 'none' &&
                this._fileInfo.executionEnvironment.pythonVersion.isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_5)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportTypeCommentUsage, localize_1.LocMessage.typeCommentDeprecated(), node.functionAnnotationComment);
            }
        }
        this.walkMultiple(node.decorators);
        node.parameters.forEach((param) => {
            if (param.name) {
                this.walk(param.name);
            }
        });
        const codeComplexity = AnalyzerNodeInfo.getCodeFlowComplexity(node);
        const isTooComplexToAnalyze = codeComplexity > typeEvaluator_1.maxCodeComplexity;
        if (isPrintCodeComplexityEnabled) {
            console.log(`Code complexity of function ${node.name.value} is ${codeComplexity.toString()}`);
        }
        if (isTooComplexToAnalyze) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.codeTooComplexToAnalyze(), node.name);
        }
        else {
            this.walk(node.suite);
        }
        if (functionTypeResult) {
            // Validate that the function returns the declared type.
            if (!isTooComplexToAnalyze) {
                this._validateFunctionReturn(node, functionTypeResult.functionType);
            }
            // Verify common dunder signatures.
            this._validateDunderSignatures(node, functionTypeResult.functionType, containingClassNode !== undefined);
            // Verify TypeGuard and TypeIs functions.
            this._validateTypeGuardFunction(node, functionTypeResult.functionType, containingClassNode !== undefined);
            this._validateFunctionTypeVarUsage(node, functionTypeResult);
            this._validateGeneratorReturnType(node, functionTypeResult.functionType);
            this._reportDeprecatedClassProperty(node, functionTypeResult);
            // If this is not a method, @final is disallowed.
            if (!containingClassNode && types_1.FunctionType.isFinal(functionTypeResult.functionType)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.finalNonMethod().format({ name: node.name.value }), node.name);
            }
        }
        // If we're at the module level within a stub file, report a diagnostic
        // if there is a '__getattr__' function defined when in strict mode.
        // This signifies an incomplete stub file that obscures type errors.
        if (this._fileInfo.isStubFile && node.name.value === '__getattr__') {
            const scope = (0, scopeUtils_1.getScopeForNode)(node);
            if ((scope === null || scope === void 0 ? void 0 : scope.type) === 4 /* ScopeType.Module */) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompleteStub, localize_1.LocMessage.stubUsesGetAttr(), node.name);
            }
        }
        this._scopedNodes.push(node);
        if (functionTypeResult && (0, types_1.isOverloadedFunction)(functionTypeResult.decoratedType)) {
            // If this is the implementation for the overloaded function, skip
            // overload consistency checks.
            if (types_1.OverloadedFunctionType.getImplementation(functionTypeResult.decoratedType) !==
                functionTypeResult.functionType) {
                const overloads = types_1.OverloadedFunctionType.getOverloads(functionTypeResult.decoratedType);
                if (overloads.length > 1) {
                    const maxOverloadConsistencyCheckLength = 100;
                    // The check is n^2 in time, so if the number of overloads
                    // is very large (which can happen for some generated code),
                    // skip this check to avoid quadratic analysis time.
                    if (overloads.length < maxOverloadConsistencyCheckLength) {
                        this._validateOverloadConsistency(node, overloads[overloads.length - 1], overloads.slice(0, overloads.length - 1));
                    }
                }
            }
            this._validateOverloadAttributeConsistency(node, functionTypeResult.decoratedType);
        }
        return false;
    }
    visitLambda(node) {
        this._evaluator.getType(node);
        // Walk the children.
        this.walkMultiple([...node.parameters, node.expression]);
        node.parameters.forEach((param) => {
            if (param.name) {
                const paramType = this._evaluator.getType(param.name);
                if (paramType) {
                    if ((0, types_1.isUnknown)(paramType)) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownLambdaType, localize_1.LocMessage.paramTypeUnknown().format({ paramName: param.name.value }), param.name);
                    }
                    else if ((0, typeUtils_1.isPartlyUnknown)(paramType)) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownLambdaType, localize_1.LocMessage.paramTypePartiallyUnknown().format({ paramName: param.name.value }), param.name);
                    }
                }
            }
        });
        const returnType = this._evaluator.getType(node.expression);
        if (returnType) {
            if ((0, types_1.isUnknown)(returnType)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownLambdaType, localize_1.LocMessage.lambdaReturnTypeUnknown(), node.expression);
            }
            else if ((0, typeUtils_1.isPartlyUnknown)(returnType)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownLambdaType, localize_1.LocMessage.lambdaReturnTypePartiallyUnknown().format({
                    returnType: this._evaluator.printType(returnType, { expandTypeAlias: true }),
                }), node.expression);
            }
        }
        this._scopedNodes.push(node);
        return false;
    }
    visitCall(node) {
        var _a;
        this._validateIsInstanceCall(node);
        this._validateIllegalDefaultParamInitializer(node);
        this._validateStandardCollectionInstantiation(node);
        if (this._fileInfo.diagnosticRuleSet.reportUnusedCallResult !== 'none' ||
            this._fileInfo.diagnosticRuleSet.reportUnusedCoroutine !== 'none') {
            if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 47 /* ParseNodeType.StatementList */) {
                const isRevealTypeCall = node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ && node.leftExpression.value === 'reveal_type';
                const returnType = this._evaluator.getType(node);
                if (!isRevealTypeCall && returnType && this._isTypeValidForUnusedValueTest(returnType)) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnusedCallResult, localize_1.LocMessage.unusedCallResult().format({
                        type: this._evaluator.printType(returnType),
                    }), node);
                    if ((0, types_1.isClassInstance)(returnType) && types_1.ClassType.isBuiltIn(returnType, 'Coroutine')) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnusedCoroutine, localize_1.LocMessage.unusedCoroutine(), node);
                    }
                }
            }
        }
        return true;
    }
    visitAwait(node) {
        var _a;
        if (this._fileInfo.diagnosticRuleSet.reportUnusedCallResult !== 'none') {
            if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 47 /* ParseNodeType.StatementList */ &&
                node.expression.nodeType === 9 /* ParseNodeType.Call */) {
                const returnType = this._evaluator.getType(node);
                if (returnType && this._isTypeValidForUnusedValueTest(returnType)) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnusedCallResult, localize_1.LocMessage.unusedCallResult().format({
                        type: this._evaluator.printType(returnType),
                    }), node);
                }
            }
        }
        return true;
    }
    visitFor(node) {
        this._evaluator.evaluateTypesForStatement(node);
        if (node.typeComment) {
            this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, localize_1.LocMessage.annotationNotSupported(), node.typeComment);
        }
        return true;
    }
    visitList(node) {
        this._validateIllegalDefaultParamInitializer(node);
        return true;
    }
    visitSet(node) {
        this._validateIllegalDefaultParamInitializer(node);
        return true;
    }
    visitDictionary(node) {
        this._validateIllegalDefaultParamInitializer(node);
        return true;
    }
    visitComprehension(node) {
        this._scopedNodes.push(node);
        return true;
    }
    visitComprehensionIf(node) {
        this._validateConditionalIsBool(node.testExpression);
        this._reportUnnecessaryConditionExpression(node.testExpression);
        return true;
    }
    visitIf(node) {
        this._validateConditionalIsBool(node.testExpression);
        this._reportUnnecessaryConditionExpression(node.testExpression);
        return true;
    }
    visitWhile(node) {
        this._validateConditionalIsBool(node.testExpression);
        this._reportUnnecessaryConditionExpression(node.testExpression);
        return true;
    }
    visitWith(node) {
        node.withItems.forEach((item) => {
            this._evaluator.evaluateTypesForStatement(item);
        });
        if (node.typeComment) {
            this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, localize_1.LocMessage.annotationNotSupported(), node.typeComment);
        }
        return true;
    }
    visitReturn(node) {
        var _a, _b, _c, _d, _e;
        let returnTypeResult;
        let returnType;
        const enclosingFunctionNode = ParseTreeUtils.getEnclosingFunction(node);
        const declaredReturnType = enclosingFunctionNode
            ? this._evaluator.getFunctionDeclaredReturnType(enclosingFunctionNode)
            : undefined;
        if (node.returnExpression) {
            returnTypeResult = (_a = this._evaluator.getTypeResult(node.returnExpression)) !== null && _a !== void 0 ? _a : { type: types_1.UnknownType.create() };
        }
        else {
            // There is no return expression, so "None" is assumed.
            returnTypeResult = { type: this._evaluator.getNoneType() };
        }
        returnType = returnTypeResult.type;
        // If this type is a special form, use the special form instead.
        if (returnType.specialForm) {
            returnType = returnType.specialForm;
        }
        // If the enclosing function is async and a generator, the return
        // statement is not allowed to have an argument. A syntax error occurs
        // at runtime in this case.
        if ((enclosingFunctionNode === null || enclosingFunctionNode === void 0 ? void 0 : enclosingFunctionNode.isAsync) && node.returnExpression) {
            const functionDecl = AnalyzerNodeInfo.getDeclaration(enclosingFunctionNode);
            if ((functionDecl === null || functionDecl === void 0 ? void 0 : functionDecl.type) === 5 /* DeclarationType.Function */ && functionDecl.isGenerator) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.returnInAsyncGenerator(), node.returnExpression);
            }
        }
        if (this._evaluator.isNodeReachable(node, /* sourceNode */ undefined) && enclosingFunctionNode) {
            if (declaredReturnType) {
                if ((0, types_1.isNever)(declaredReturnType)) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.noReturnContainsReturn(), node);
                }
                else {
                    let diagAddendum = new diagnostic_1.DiagnosticAddendum();
                    let returnTypeMatches = false;
                    if (this._evaluator.assignType(declaredReturnType, returnType, diagAddendum, 
                    /* destTypeVarContext */ undefined, 
                    /* srcTypeVarContext */ undefined, 128 /* AssignTypeFlags.AllowBoolTypeGuard */)) {
                        returnTypeMatches = true;
                    }
                    else {
                        // See if the declared return type includes one or more constrained TypeVars. If so,
                        // try to narrow these TypeVars to a single type.
                        const uniqueTypeVars = (0, typeUtils_1.getTypeVarArgumentsRecursive)(declaredReturnType);
                        if (uniqueTypeVars &&
                            uniqueTypeVars.some((typeVar) => typeVar.details.constraints.length > 0)) {
                            const typeVarContext = new typeVarContext_1.TypeVarContext();
                            for (const typeVar of uniqueTypeVars) {
                                if (typeVar.details.constraints.length > 0) {
                                    const narrowedType = this._evaluator.narrowConstrainedTypeVar(node, typeVar);
                                    if (narrowedType) {
                                        typeVarContext.setTypeVarType(typeVar, narrowedType);
                                        typeVarContext.addSolveForScope((0, typeUtils_1.getTypeVarScopeId)(typeVar));
                                    }
                                }
                            }
                            if (!typeVarContext.isEmpty()) {
                                const adjustedReturnType = (0, typeUtils_1.applySolvedTypeVars)(declaredReturnType, typeVarContext);
                                if (this._evaluator.assignType(adjustedReturnType, returnType, diagAddendum, 
                                /* destTypeVarContext */ undefined, 
                                /* srcTypeVarContext */ undefined, 128 /* AssignTypeFlags.AllowBoolTypeGuard */)) {
                                    returnTypeMatches = true;
                                }
                            }
                        }
                    }
                    if (!returnTypeMatches) {
                        // If we have more detailed diagnostic information from
                        // bidirectional type inference, use that.
                        if (returnTypeResult.expectedTypeDiagAddendum) {
                            diagAddendum = returnTypeResult.expectedTypeDiagAddendum;
                        }
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportReturnType, localize_1.LocMessage.returnTypeMismatch().format({
                            exprType: this._evaluator.printType(returnType),
                            returnType: this._evaluator.printType(declaredReturnType),
                        }) + diagAddendum.getString(), (_b = node.returnExpression) !== null && _b !== void 0 ? _b : node, (_c = returnTypeResult.expectedTypeDiagAddendum) === null || _c === void 0 ? void 0 : _c.getEffectiveTextRange());
                    }
                }
            }
            if ((0, types_1.isUnknown)(returnType)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownVariableType, localize_1.LocMessage.returnTypeUnknown(), (_d = node.returnExpression) !== null && _d !== void 0 ? _d : node);
            }
            else if ((0, typeUtils_1.isPartlyUnknown)(returnType)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownVariableType, localize_1.LocMessage.returnTypePartiallyUnknown().format({
                    returnType: this._evaluator.printType(returnType, { expandTypeAlias: true }),
                }), (_e = node.returnExpression) !== null && _e !== void 0 ? _e : node);
            }
        }
        return true;
    }
    visitYield(node) {
        var _a;
        const yieldTypeResult = node.expression
            ? this._evaluator.getTypeResult(node.expression)
            : { type: this._evaluator.getNoneType() };
        this._validateYieldType(node, (_a = yieldTypeResult === null || yieldTypeResult === void 0 ? void 0 : yieldTypeResult.type) !== null && _a !== void 0 ? _a : types_1.UnknownType.create(), yieldTypeResult === null || yieldTypeResult === void 0 ? void 0 : yieldTypeResult.expectedTypeDiagAddendum);
        return true;
    }
    visitYieldFrom(node) {
        var _a, _b, _c, _d;
        const yieldFromType = this._evaluator.getType(node.expression) || types_1.UnknownType.create();
        let yieldType;
        let sendType;
        if ((0, types_1.isClassInstance)(yieldFromType) && types_1.ClassType.isBuiltIn(yieldFromType, 'Coroutine')) {
            // Handle the case of old-style (pre-await) coroutines.
            yieldType = types_1.UnknownType.create();
        }
        else {
            yieldType =
                (_b = (_a = this._evaluator.getTypeOfIterable({ type: yieldFromType }, /* isAsync */ false, node)) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : types_1.UnknownType.create();
            // Does the iterator return a Generator? If so, get the yield type from it.
            // If the iterator doesn't return a Generator, use the iterator return type
            // directly.
            const generatorTypeArgs = (0, typeUtils_1.getGeneratorTypeArgs)(yieldType);
            if (generatorTypeArgs) {
                yieldType = generatorTypeArgs.length >= 1 ? generatorTypeArgs[0] : types_1.UnknownType.create();
                sendType = generatorTypeArgs.length >= 2 ? generatorTypeArgs[1] : undefined;
            }
            else {
                yieldType =
                    (_d = (_c = this._evaluator.getTypeOfIterator({ type: yieldFromType }, /* isAsync */ false, node)) === null || _c === void 0 ? void 0 : _c.type) !== null && _d !== void 0 ? _d : types_1.UnknownType.create();
            }
        }
        this._validateYieldType(node, yieldType, /* expectedDiagAddendum */ undefined, sendType);
        return true;
    }
    visitRaise(node) {
        this._evaluator.verifyRaiseExceptionType(node);
        if (node.valueExpression) {
            const baseExceptionType = this._evaluator.getBuiltInType(node, 'BaseException');
            const exceptionType = this._evaluator.getType(node.valueExpression);
            // Validate that the argument of "raise" is an exception object or None.
            if (exceptionType && baseExceptionType && (0, types_1.isInstantiableClass)(baseExceptionType)) {
                const diagAddendum = new diagnostic_1.DiagnosticAddendum();
                (0, typeUtils_1.doForEachSubtype)(exceptionType, (subtype) => {
                    subtype = this._evaluator.makeTopLevelTypeVarsConcrete(subtype);
                    if (!(0, types_1.isAnyOrUnknown)(subtype) && !(0, typeUtils_1.isNoneInstance)(subtype)) {
                        if ((0, types_1.isClass)(subtype)) {
                            if (!(0, typeUtils_1.derivesFromClassRecursive)(subtype, baseExceptionType, /* ignoreUnknown */ false)) {
                                diagAddendum.addMessage(localize_1.LocMessage.exceptionTypeIncorrect().format({
                                    type: this._evaluator.printType(subtype),
                                }));
                            }
                        }
                        else {
                            diagAddendum.addMessage(localize_1.LocMessage.exceptionTypeIncorrect().format({
                                type: this._evaluator.printType(subtype),
                            }));
                        }
                    }
                });
                if (!diagAddendum.isEmpty()) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.expectedExceptionObj() + diagAddendum.getString(), node.valueExpression);
                }
            }
        }
        return true;
    }
    visitExcept(node) {
        if (node.typeExpression) {
            this._evaluator.evaluateTypesForStatement(node);
            const exceptionType = this._evaluator.getType(node.typeExpression);
            if (exceptionType) {
                this._validateExceptionType(exceptionType, node.typeExpression, node.isExceptGroup);
            }
        }
        return true;
    }
    visitAssert(node) {
        if (node.exceptionExpression) {
            this._evaluator.getType(node.exceptionExpression);
        }
        this._validateConditionalIsBool(node.testExpression);
        // Specifically look for a common programming error where the two arguments
        // to an assert are enclosed in parens and interpreted as a two-element tuple.
        //   assert (x > 3, "bad value x")
        const type = this._evaluator.getType(node.testExpression);
        if (type && (0, types_1.isClassInstance)(type)) {
            if ((0, typeUtils_1.isTupleClass)(type) && type.tupleTypeArguments) {
                if (type.tupleTypeArguments.length > 0) {
                    if (!(0, typeUtils_1.isUnboundedTupleClass)(type)) {
                        this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportAssertAlwaysTrue, localize_1.LocMessage.assertAlwaysTrue(), node.testExpression);
                    }
                }
            }
        }
        return true;
    }
    visitAssignment(node) {
        this._evaluator.evaluateTypesForStatement(node);
        if (node.typeAnnotationComment) {
            this._evaluator.getType(node.typeAnnotationComment);
            if (this._fileInfo.diagnosticRuleSet.reportTypeCommentUsage !== 'none' &&
                this._fileInfo.executionEnvironment.pythonVersion.isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_6)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportTypeCommentUsage, localize_1.LocMessage.typeCommentDeprecated(), node.typeAnnotationComment);
            }
        }
        // If this isn't a class or global scope, explicit type aliases are not allowed.
        if (node.leftExpression.nodeType === 54 /* ParseNodeType.TypeAnnotation */) {
            const annotationType = this._evaluator.getTypeOfAnnotation(node.leftExpression.typeAnnotation);
            if ((0, types_1.isClassInstance)(annotationType) && types_1.ClassType.isBuiltIn(annotationType, 'TypeAlias')) {
                const scope = (0, scopeUtils_1.getScopeForNode)(node);
                if (scope) {
                    if (scope.type !== 3 /* ScopeType.Class */ &&
                        scope.type !== 4 /* ScopeType.Module */ &&
                        scope.type !== 5 /* ScopeType.Builtin */) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typeAliasNotInModuleOrClass(), node.leftExpression.typeAnnotation);
                    }
                }
            }
        }
        return true;
    }
    visitAssignmentExpression(node) {
        this._evaluator.getType(node);
        return true;
    }
    visitAugmentedAssignment(node) {
        this._evaluator.evaluateTypesForStatement(node);
        return true;
    }
    visitIndex(node) {
        this._evaluator.getType(node);
        // If the index is a literal integer, see if this is a tuple with
        // a known length and the integer value exceeds the length.
        const baseType = this._evaluator.getType(node.baseExpression);
        if (baseType) {
            (0, typeUtils_1.doForEachSubtype)(baseType, (subtype) => {
                const tupleType = (0, typeUtils_1.getSpecializedTupleType)(subtype);
                if (!(0, types_1.isClassInstance)(subtype) || !(tupleType === null || tupleType === void 0 ? void 0 : tupleType.tupleTypeArguments) || (0, typeUtils_1.isUnboundedTupleClass)(tupleType)) {
                    return;
                }
                const tupleLength = tupleType.tupleTypeArguments.length;
                if (node.items.length !== 1 ||
                    node.trailingComma ||
                    node.items[0].argumentCategory !== 0 /* ArgumentCategory.Simple */ ||
                    node.items[0].name) {
                    return;
                }
                const subscriptType = this._evaluator.getType(node.items[0].valueExpression);
                if (!subscriptType ||
                    !(0, types_1.isClassInstance)(subscriptType) ||
                    !types_1.ClassType.isBuiltIn(subscriptType, 'int') ||
                    !(0, typeUtils_1.isLiteralType)(subscriptType) ||
                    typeof subscriptType.literalValue !== 'number') {
                    return;
                }
                if ((subscriptType.literalValue < 0 || subscriptType.literalValue < tupleLength) &&
                    (subscriptType.literalValue >= 0 || subscriptType.literalValue + tupleLength >= 0)) {
                    return;
                }
                // This can be an expensive check, so we save it for the end once we
                // are about to emit a diagnostic.
                if (this._evaluator.isTypeSubsumedByOtherType(tupleType, baseType, /* allowAnyToSubsume */ false)) {
                    return;
                }
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.tupleIndexOutOfRange().format({
                    index: subscriptType.literalValue,
                    type: this._evaluator.printType(subtype),
                }), node);
            });
        }
        return true;
    }
    visitBinaryOperation(node) {
        if (node.operator === 36 /* OperatorType.And */ || node.operator === 37 /* OperatorType.Or */) {
            this._validateConditionalIsBool(node.leftExpression);
            this._validateConditionalIsBool(node.rightExpression);
        }
        if (node.operator === 12 /* OperatorType.Equals */ || node.operator === 28 /* OperatorType.NotEquals */) {
            // Don't apply this rule if it's within an assert.
            if (!ParseTreeUtils.isWithinAssertExpression(node)) {
                this._validateComparisonTypes(node);
            }
        }
        else if (node.operator === 39 /* OperatorType.Is */ || node.operator === 40 /* OperatorType.IsNot */) {
            // Don't apply this rule if it's within an assert.
            if (!ParseTreeUtils.isWithinAssertExpression(node)) {
                this._validateComparisonTypesForIsOperator(node);
            }
        }
        else if (node.operator === 41 /* OperatorType.In */ || node.operator === 42 /* OperatorType.NotIn */) {
            // Don't apply this rule if it's within an assert.
            if (!ParseTreeUtils.isWithinAssertExpression(node)) {
                this._validateContainmentTypes(node);
            }
        }
        this._evaluator.getType(node);
        return true;
    }
    visitSlice(node) {
        this._evaluator.getType(node);
        return true;
    }
    visitUnpack(node) {
        this._evaluator.getType(node);
        return true;
    }
    visitTuple(node) {
        this._evaluator.getType(node);
        return true;
    }
    visitUnaryOperation(node) {
        if (node.operator === 38 /* OperatorType.Not */) {
            this._validateConditionalIsBool(node.expression);
        }
        this._evaluator.getType(node);
        return true;
    }
    visitTernary(node) {
        this._evaluator.getType(node);
        this._validateConditionalIsBool(node.testExpression);
        this._reportUnnecessaryConditionExpression(node.testExpression);
        return true;
    }
    visitStringList(node) {
        // If this is Python 3.11 or older, there are several restrictions
        // associated with f-strings that we need to validate. Determine whether
        // we're within an f-string (or multiple f-strings if nesting is used).
        const fStringContainers = [];
        if (this._fileInfo.executionEnvironment.pythonVersion.isLessThan(pythonVersion_1.pythonVersion3_12)) {
            let curNode = node;
            while (curNode) {
                if (curNode.nodeType === 30 /* ParseNodeType.FormatString */) {
                    fStringContainers.push(curNode);
                }
                curNode = curNode.parent;
            }
        }
        for (const stringNode of node.strings) {
            const stringTokens = stringNode.nodeType === 49 /* ParseNodeType.String */ ? [stringNode.token] : stringNode.middleTokens;
            stringTokens.forEach((token) => {
                const unescapedResult = (0, stringTokenUtils_1.getUnescapedString)(token);
                let start = token.start;
                if (token.type === 5 /* TokenType.String */) {
                    start += token.prefixLength + token.quoteMarkLength;
                }
                unescapedResult.unescapeErrors.forEach((error) => {
                    if (error.errorType === 0 /* UnescapeErrorType.InvalidEscapeSequence */) {
                        this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportInvalidStringEscapeSequence, localize_1.LocMessage.stringUnsupportedEscape(), { start: start + error.offset, length: error.length });
                    }
                });
                // Prior to Python 3.12, it was not allowed to include a slash in an f-string.
                if (fStringContainers.length > 0) {
                    const escapeOffset = token.escapedValue.indexOf('\\');
                    if (escapeOffset >= 0) {
                        this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.formatStringEscape(), { start, length: 1 });
                    }
                }
            });
            // Prior to Python 3.12, it was not allowed to nest strings that
            // used the same quote scheme within an f-string.
            if (fStringContainers.length > 0) {
                const quoteTypeMask = 1 /* StringTokenFlags.SingleQuote */ | 2 /* StringTokenFlags.DoubleQuote */ | 4 /* StringTokenFlags.Triplicate */;
                if (fStringContainers.some((fStringContainer) => (fStringContainer.token.flags & quoteTypeMask) === (stringNode.token.flags & quoteTypeMask))) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.formatStringNestedQuote(), stringNode);
                }
            }
        }
        if (node.typeAnnotation) {
            this._evaluator.getType(node);
        }
        if (node.strings.length > 1 && !node.isParenthesized) {
            this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportImplicitStringConcatenation, localize_1.LocMessage.implicitStringConcat(), node);
        }
        return true;
    }
    visitFormatString(node) {
        node.fieldExpressions.forEach((expr) => {
            this._evaluator.getType(expr);
        });
        node.formatExpressions.forEach((expr) => {
            this._evaluator.getType(expr);
        });
        return true;
    }
    visitGlobal(node) {
        this._suppressUnboundCheck(() => {
            node.nameList.forEach((name) => {
                this._evaluator.getType(name);
                this.walk(name);
            });
        });
        return false;
    }
    visitNonlocal(node) {
        this._suppressUnboundCheck(() => {
            node.nameList.forEach((name) => {
                this._evaluator.getType(name);
                this.walk(name);
            });
        });
        return false;
    }
    visitName(node) {
        // Determine if we should log information about private usage.
        this._conditionallyReportPrivateUsage(node);
        // Determine if the name is possibly unbound.
        if (!this._isUnboundCheckSuppressed) {
            this._reportUnboundName(node);
        }
        // Report the use of a deprecated symbol.
        const type = this._evaluator.getType(node);
        this._reportDeprecatedUseForType(node, type);
        return true;
    }
    visitDel(node) {
        node.expressions.forEach((expr) => {
            this._evaluator.verifyDeleteExpression(expr);
            this.walk(expr);
        });
        return false;
    }
    visitMemberAccess(node) {
        var _a;
        const typeResult = this._evaluator.getTypeResult(node);
        const type = (_a = typeResult === null || typeResult === void 0 ? void 0 : typeResult.type) !== null && _a !== void 0 ? _a : types_1.UnknownType.create();
        const leftExprType = this._evaluator.getType(node.leftExpression);
        this._reportDeprecatedUseForType(node.memberName, type, leftExprType && (0, types_1.isModule)(leftExprType) && leftExprType.moduleName === 'typing');
        if (typeResult === null || typeResult === void 0 ? void 0 : typeResult.memberAccessDeprecationInfo) {
            this._reportDeprecatedUseForMemberAccess(node.memberName, typeResult.memberAccessDeprecationInfo);
        }
        this._conditionallyReportPrivateUsage(node.memberName);
        // Walk the leftExpression but not the memberName.
        this.walk(node.leftExpression);
        return false;
    }
    visitImportAs(node) {
        this._conditionallyReportShadowedImport(node);
        this._evaluator.evaluateTypesForStatement(node);
        return true;
    }
    visitImportFrom(node) {
        // Verify that any "__future__" import occurs at the top of the file.
        if (node.module.leadingDots === 0 &&
            node.module.nameParts.length === 1 &&
            node.module.nameParts[0].value === '__future__') {
            if (!ParseTreeUtils.isValidLocationForFutureImport(node)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.futureImportLocationNotAllowed(), node);
            }
        }
        this._conditionallyReportShadowedImport(node);
        if (!node.isWildcardImport) {
            node.imports.forEach((importAs) => {
                this._evaluator.evaluateTypesForStatement(importAs);
            });
        }
        else {
            this._evaluator.evaluateTypesForStatement(node);
            const importInfo = AnalyzerNodeInfo.getImportInfo(node.module);
            if (importInfo &&
                importInfo.isImportFound &&
                importInfo.importType !== 2 /* ImportType.Local */ &&
                !this._fileInfo.isStubFile) {
                this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportWildcardImportFromLibrary, localize_1.LocMessage.wildcardLibraryImport(), node.wildcardToken || node);
            }
        }
        return true;
    }
    visitImportFromAs(node) {
        var _a, _b;
        if (this._fileInfo.isStubFile) {
            return false;
        }
        const decls = this._evaluator.getDeclarationsForNameNode(node.name);
        if (!decls) {
            return false;
        }
        for (const decl of decls) {
            if (!(0, declaration_1.isAliasDeclaration)(decl) || !decl.submoduleFallback || decl.node !== node) {
                // If it is not implicitly imported module, move to next.
                continue;
            }
            const resolvedAlias = this._evaluator.resolveAliasDeclaration(decl, /* resolveLocalNames */ true);
            const resolvedAliasUri = resolvedAlias === null || resolvedAlias === void 0 ? void 0 : resolvedAlias.uri;
            if (!resolvedAliasUri || !(0, sourceMapper_1.isStubFile)(resolvedAliasUri)) {
                continue;
            }
            const importResult = this._getImportResult(node, resolvedAliasUri);
            if (!importResult) {
                continue;
            }
            this._addMissingModuleSourceDiagnosticIfNeeded(importResult, node.name);
            break;
        }
        let isImportFromTyping = false;
        if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 25 /* ParseNodeType.ImportFrom */) {
            if (node.parent.module.leadingDots === 0 && node.parent.module.nameParts.length === 1) {
                if (node.parent.module.nameParts[0].value === 'typing') {
                    isImportFromTyping = true;
                }
            }
        }
        const type = this._evaluator.getType((_b = node.alias) !== null && _b !== void 0 ? _b : node.name);
        this._reportDeprecatedUseForType(node.name, type, isImportFromTyping);
        return false;
    }
    visitModuleName(node) {
        if (this._fileInfo.isStubFile) {
            return false;
        }
        const importResult = AnalyzerNodeInfo.getImportInfo(node);
        (0, debug_1.assert)(importResult !== undefined);
        this._addMissingModuleSourceDiagnosticIfNeeded(importResult, node);
        return false;
    }
    visitTypeParameterList(node) {
        this._typeParameterLists.push(node);
        return true;
    }
    visitTypeParameter(node) {
        var _a, _b, _c, _d;
        // Verify that there are no live type variables with the same
        // name in outer scopes.
        let curNode = (_b = (_a = node.parent) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.parent;
        let foundDuplicate = false;
        while (curNode) {
            const typeVarScopeNode = ParseTreeUtils.getTypeVarScopeNode(curNode);
            if (!typeVarScopeNode) {
                break;
            }
            if (typeVarScopeNode.nodeType === 10 /* ParseNodeType.Class */) {
                const classType = (_c = this._evaluator.getTypeOfClass(typeVarScopeNode)) === null || _c === void 0 ? void 0 : _c.classType;
                if (classType === null || classType === void 0 ? void 0 : classType.details.typeParameters.some((param) => param.details.name === node.name.value)) {
                    foundDuplicate = true;
                    break;
                }
            }
            else if (typeVarScopeNode.nodeType === 31 /* ParseNodeType.Function */) {
                const functionType = (_d = this._evaluator.getTypeOfFunction(typeVarScopeNode)) === null || _d === void 0 ? void 0 : _d.functionType;
                if (functionType === null || functionType === void 0 ? void 0 : functionType.details.typeParameters.some((param) => param.details.name === node.name.value)) {
                    foundDuplicate = true;
                    break;
                }
            }
            curNode = typeVarScopeNode.parent;
        }
        if (foundDuplicate) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typeVarUsedByOuterScope().format({ name: node.name.value }), node.name);
        }
        return false;
    }
    visitTypeAlias(node) {
        const scope = (0, scopeUtils_1.getScopeForNode)(node);
        if (scope) {
            if (scope.type !== 3 /* ScopeType.Class */ && scope.type !== 4 /* ScopeType.Module */ && scope.type !== 5 /* ScopeType.Builtin */) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typeAliasStatementBadScope(), node.name);
            }
        }
        return true;
    }
    visitTypeAnnotation(node) {
        this._evaluator.getType(node.typeAnnotation);
        return true;
    }
    visitMatch(node) {
        this._evaluator.getType(node.subjectExpression);
        this._validateExhaustiveMatch(node);
        return true;
    }
    visitCase(node) {
        if (node.guardExpression) {
            this._validateConditionalIsBool(node.guardExpression);
        }
        this._evaluator.evaluateTypesForStatement(node.pattern);
        return true;
    }
    visitPatternClass(node) {
        (0, patternMatching_1.validateClassPattern)(this._evaluator, node);
        return true;
    }
    visitTry(node) {
        this._reportUnusedExceptStatements(node);
        return true;
    }
    visitError(node) {
        // Get the type of the child so it's available to
        // the completion provider.
        if (node.child) {
            this._evaluator.getType(node.child);
        }
        // Don't explore further.
        return false;
    }
    _getImportResult(node, uri) {
        const execEnv = this._importResolver.getConfigOptions().findExecEnvironment(uri);
        const moduleNameNode = node.parent.module;
        // Handle both absolute and relative imports.
        const moduleName = moduleNameNode.leadingDots === 0
            ? this._importResolver.getModuleNameForImport(uri, execEnv).moduleName
            : (0, importStatementUtils_1.getRelativeModuleName)(this._importResolver.fileSystem, this._fileInfo.fileUri, uri, this._importResolver.getConfigOptions());
        if (!moduleName) {
            return undefined;
        }
        return this._importResolver.resolveImport(this._fileInfo.fileUri, execEnv, (0, importResolver_1.createImportedModuleDescriptor)(moduleName));
    }
    _addMissingModuleSourceDiagnosticIfNeeded(importResult, node) {
        if (importResult.isNativeLib ||
            !importResult.isStubFile ||
            importResult.importType === 0 /* ImportType.BuiltIn */ ||
            !importResult.nonStubImportResult ||
            importResult.nonStubImportResult.isImportFound) {
            return;
        }
        // Type stub found, but source is missing.
        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportMissingModuleSource, localize_1.LocMessage.importSourceResolveFailure().format({
            importName: importResult.importName,
            venv: this._fileInfo.executionEnvironment.name,
        }), node);
    }
    _validateConditionalIsBool(node) {
        const operandType = this._evaluator.getType(node);
        if (!operandType) {
            return;
        }
        let isTypeBool = true;
        const diag = new diagnostic_1.DiagnosticAddendum();
        this._evaluator.mapSubtypesExpandTypeVars(operandType, /* options */ undefined, (expandedSubtype) => {
            if ((0, types_1.isAnyOrUnknown)(expandedSubtype)) {
                return undefined;
            }
            // If it's a bool (the common case), we're good.
            if ((0, types_1.isClassInstance)(expandedSubtype) && types_1.ClassType.isBuiltIn(expandedSubtype, 'bool')) {
                return undefined;
            }
            // Invoke the __bool__ method on the type.
            const boolReturnType = this._evaluator.getTypeOfMagicMethodCall(expandedSubtype, '__bool__', [], node, 
            /* inferenceContext */ undefined);
            if (!boolReturnType || (0, types_1.isAnyOrUnknown)(boolReturnType)) {
                return undefined;
            }
            if ((0, types_1.isClassInstance)(boolReturnType) && types_1.ClassType.isBuiltIn(boolReturnType, 'bool')) {
                return undefined;
            }
            // All other types are problematic.
            isTypeBool = false;
            diag.addMessage(localize_1.LocAddendum.conditionalRequiresBool().format({
                operandType: this._evaluator.printType(expandedSubtype),
                boolReturnType: this._evaluator.printType(boolReturnType),
            }));
            return undefined;
        });
        if (!isTypeBool) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.conditionalOperandInvalid().format({
                type: this._evaluator.printType(operandType),
            }) + diag.getString(), node);
        }
    }
    _reportUnnecessaryConditionExpression(expression) {
        if (expression.nodeType === 7 /* ParseNodeType.BinaryOperation */) {
            if (expression.operator === 36 /* OperatorType.And */ || expression.operator === 37 /* OperatorType.Or */) {
                this._reportUnnecessaryConditionExpression(expression.leftExpression);
                this._reportUnnecessaryConditionExpression(expression.rightExpression);
            }
            return;
        }
        else if (expression.nodeType === 55 /* ParseNodeType.UnaryOperation */) {
            if (expression.operator === 38 /* OperatorType.Not */) {
                this._reportUnnecessaryConditionExpression(expression.expression);
            }
            return;
        }
        const exprTypeResult = this._evaluator.getTypeOfExpression(expression);
        let isExprFunction = true;
        let isCoroutine = true;
        (0, typeUtils_1.doForEachSubtype)(exprTypeResult.type, (subtype) => {
            subtype = this._evaluator.makeTopLevelTypeVarsConcrete(subtype);
            if (!(0, types_1.isFunction)(subtype) && !(0, types_1.isOverloadedFunction)(subtype)) {
                isExprFunction = false;
            }
            if (!(0, types_1.isClassInstance)(subtype) || !types_1.ClassType.isBuiltIn(subtype, 'Coroutine')) {
                isCoroutine = false;
            }
        });
        if (isExprFunction) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryComparison, localize_1.LocMessage.functionInConditionalExpression(), expression);
        }
        if (isCoroutine) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryComparison, localize_1.LocMessage.coroutineInConditionalExpression(), expression);
        }
    }
    _reportUnusedExpression(node) {
        var _a, _b;
        if (this._fileInfo.diagnosticRuleSet.reportUnusedExpression === 'none') {
            return;
        }
        const simpleExpressionTypes = [
            55 /* ParseNodeType.UnaryOperation */,
            7 /* ParseNodeType.BinaryOperation */,
            40 /* ParseNodeType.Number */,
            14 /* ParseNodeType.Constant */,
            38 /* ParseNodeType.Name */,
            52 /* ParseNodeType.Tuple */,
        ];
        let reportAsUnused = false;
        if (simpleExpressionTypes.some((nodeType) => nodeType === node.nodeType)) {
            reportAsUnused = true;
        }
        else if (node.nodeType === 34 /* ParseNodeType.List */ ||
            node.nodeType === 45 /* ParseNodeType.Set */ ||
            node.nodeType === 18 /* ParseNodeType.Dictionary */) {
            // Exclude comprehensions.
            if (!node.entries.some((entry) => entry.nodeType === 11 /* ParseNodeType.Comprehension */)) {
                reportAsUnused = true;
            }
        }
        if (reportAsUnused &&
            this._fileInfo.ipythonMode === sourceFile_1.IPythonMode.CellDocs &&
            ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 47 /* ParseNodeType.StatementList */ &&
            node.parent.statements[node.parent.statements.length - 1] === node &&
            ((_b = node.parent.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 36 /* ParseNodeType.Module */ &&
            node.parent.parent.statements[node.parent.parent.statements.length - 1] === node.parent) {
            // Exclude an expression at the end of a notebook cell, as that is treated as
            // the cell's value.
            reportAsUnused = false;
        }
        if (reportAsUnused) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnusedExpression, localize_1.LocMessage.unusedExpression(), node);
        }
    }
    _validateExhaustiveMatch(node) {
        // This check can be expensive, so skip it if it's disabled.
        if (this._fileInfo.diagnosticRuleSet.reportMatchNotExhaustive === 'none') {
            return;
        }
        const narrowedTypeResult = this._evaluator.evaluateTypeForSubnode(node, () => {
            this._evaluator.evaluateTypesForMatchStatement(node);
        });
        if (narrowedTypeResult && !(0, types_1.isNever)(narrowedTypeResult.type)) {
            const diagAddendum = new diagnostic_1.DiagnosticAddendum();
            diagAddendum.addMessage(localize_1.LocAddendum.matchIsNotExhaustiveType().format({
                type: this._evaluator.printType(narrowedTypeResult.type),
            }));
            diagAddendum.addMessage(localize_1.LocAddendum.matchIsNotExhaustiveHint());
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportMatchNotExhaustive, localize_1.LocMessage.matchIsNotExhaustive() + diagAddendum.getString(), node.subjectExpression);
        }
    }
    _suppressUnboundCheck(callback) {
        const wasSuppressed = this._isUnboundCheckSuppressed;
        this._isUnboundCheckSuppressed = true;
        try {
            callback();
        }
        finally {
            this._isUnboundCheckSuppressed = wasSuppressed;
        }
    }
    _validateIllegalDefaultParamInitializer(node) {
        if (this._fileInfo.diagnosticRuleSet.reportCallInDefaultInitializer !== 'none') {
            if (ParseTreeUtils.isWithinDefaultParamInitializer(node) && !this._fileInfo.isStubFile) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportCallInDefaultInitializer, localize_1.LocMessage.defaultValueContainsCall(), node);
            }
        }
    }
    _validateStandardCollectionInstantiation(node) {
        const leftType = this._evaluator.getType(node.leftExpression);
        if (leftType &&
            (0, types_1.isInstantiableClass)(leftType) &&
            types_1.ClassType.isBuiltIn(leftType) &&
            !leftType.includeSubclasses &&
            leftType.aliasName) {
            const nonInstantiable = ['List', 'Set', 'Dict', 'Tuple'];
            if (nonInstantiable.some((name) => name === leftType.aliasName)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.collectionAliasInstantiation().format({
                    type: leftType.aliasName,
                    alias: leftType.details.name,
                }), node.leftExpression);
            }
        }
    }
    _validateContainmentTypes(node) {
        const leftType = this._evaluator.getType(node.leftExpression);
        const containerType = this._evaluator.getType(node.rightExpression);
        if (!leftType || !containerType) {
            return;
        }
        if ((0, types_1.isNever)(leftType) || (0, types_1.isNever)(containerType)) {
            return;
        }
        // Use the common narrowing logic for containment.
        const elementType = (0, typeGuards_1.getElementTypeForContainerNarrowing)(containerType);
        if (!elementType) {
            return;
        }
        const narrowedType = (0, typeGuards_1.narrowTypeForContainerElementType)(this._evaluator, leftType, this._evaluator.makeTopLevelTypeVarsConcrete(elementType));
        if ((0, types_1.isNever)(narrowedType)) {
            const getMessage = () => {
                return node.operator === 41 /* OperatorType.In */
                    ? localize_1.LocMessage.containmentAlwaysFalse()
                    : localize_1.LocMessage.containmentAlwaysTrue();
            };
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryContains, getMessage().format({
                leftType: this._evaluator.printType(leftType, { expandTypeAlias: true }),
                rightType: this._evaluator.printType(elementType, { expandTypeAlias: true }),
            }), node);
        }
    }
    // Determines whether the types of the two operands for an "is" or "is not"
    // operation have overlapping types.
    _validateComparisonTypesForIsOperator(node) {
        const rightType = this._evaluator.getType(node.rightExpression);
        if (!rightType || !(0, typeUtils_1.isNoneInstance)(rightType)) {
            return;
        }
        const leftType = this._evaluator.getType(node.leftExpression);
        if (!leftType) {
            return;
        }
        let foundMatchForNone = false;
        (0, typeUtils_1.doForEachSubtype)(leftType, (subtype) => {
            subtype = this._evaluator.makeTopLevelTypeVarsConcrete(subtype);
            if (this._evaluator.assignType(subtype, this._evaluator.getNoneType())) {
                foundMatchForNone = true;
            }
        });
        const getMessage = () => {
            return node.operator === 39 /* OperatorType.Is */
                ? localize_1.LocMessage.comparisonAlwaysFalse()
                : localize_1.LocMessage.comparisonAlwaysTrue();
        };
        if (!foundMatchForNone) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryComparison, getMessage().format({
                leftType: this._evaluator.printType(leftType, { expandTypeAlias: true }),
                rightType: this._evaluator.printType(rightType),
            }), node);
        }
    }
    // Determines whether the types of the two operands for an == or != operation
    // have overlapping types.
    _validateComparisonTypes(node) {
        let rightExpression = node.rightExpression;
        // Check for chained comparisons.
        if (rightExpression.nodeType === 7 /* ParseNodeType.BinaryOperation */ &&
            !rightExpression.parenthesized &&
            ParseTreeUtils.operatorSupportsChaining(rightExpression.operator)) {
            // Use the left side of the right expression for comparison purposes.
            rightExpression = rightExpression.leftExpression;
        }
        const leftType = this._evaluator.getType(node.leftExpression);
        const rightType = this._evaluator.getType(rightExpression);
        if (!leftType || !rightType) {
            return;
        }
        if ((0, types_1.isNever)(leftType) || (0, types_1.isNever)(rightType)) {
            return;
        }
        const getMessage = () => {
            return node.operator === 12 /* OperatorType.Equals */
                ? localize_1.LocMessage.comparisonAlwaysFalse()
                : localize_1.LocMessage.comparisonAlwaysTrue();
        };
        // Check for the special case where the LHS and RHS are both literals.
        if ((0, typeUtils_1.isLiteralTypeOrUnion)(rightType) && (0, typeUtils_1.isLiteralTypeOrUnion)(leftType)) {
            if ((0, staticExpressions_1.evaluateStaticBoolExpression)(node, this._fileInfo.executionEnvironment, this._fileInfo.definedConstants) === undefined) {
                let isPossiblyTrue = false;
                (0, typeUtils_1.doForEachSubtype)(leftType, (leftSubtype) => {
                    if (this._evaluator.assignType(rightType, leftSubtype)) {
                        isPossiblyTrue = true;
                    }
                });
                if (!isPossiblyTrue) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryComparison, getMessage().format({
                        leftType: this._evaluator.printType(leftType, { expandTypeAlias: true }),
                        rightType: this._evaluator.printType(rightType, { expandTypeAlias: true }),
                    }), node);
                }
            }
        }
        else {
            let isComparable = false;
            (0, typeUtils_1.doForEachSubtype)(leftType, (leftSubtype) => {
                if (isComparable) {
                    return;
                }
                leftSubtype = this._evaluator.makeTopLevelTypeVarsConcrete(leftSubtype);
                (0, typeUtils_1.doForEachSubtype)(rightType, (rightSubtype) => {
                    if (isComparable) {
                        return;
                    }
                    rightSubtype = this._evaluator.makeTopLevelTypeVarsConcrete(rightSubtype);
                    if (this._isTypeComparable(leftSubtype, rightSubtype)) {
                        isComparable = true;
                    }
                });
            });
            if (!isComparable) {
                const leftTypeText = this._evaluator.printType(leftType, { expandTypeAlias: true });
                const rightTypeText = this._evaluator.printType(rightType, { expandTypeAlias: true });
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryComparison, getMessage().format({
                    leftType: leftTypeText,
                    rightType: rightTypeText,
                }), node);
            }
        }
    }
    // Determines whether the two types are potentially comparable -- i.e.
    // their types overlap in such a way that it makes sense for them to
    // be compared with an == or != operator.
    _isTypeComparable(leftType, rightType) {
        if ((0, types_1.isAnyOrUnknown)(leftType) || (0, types_1.isAnyOrUnknown)(rightType)) {
            return true;
        }
        if ((0, types_1.isNever)(leftType) || (0, types_1.isNever)(rightType)) {
            return false;
        }
        if ((0, types_1.isModule)(leftType) || (0, types_1.isModule)(rightType)) {
            return (0, types_1.isTypeSame)(leftType, rightType);
        }
        if ((0, typeUtils_1.isNoneInstance)(leftType) || (0, typeUtils_1.isNoneInstance)(rightType)) {
            return (0, types_1.isTypeSame)(leftType, rightType);
        }
        const isLeftCallable = (0, types_1.isFunction)(leftType) || (0, types_1.isOverloadedFunction)(leftType);
        const isRightCallable = (0, types_1.isFunction)(rightType) || (0, types_1.isOverloadedFunction)(rightType);
        if (isLeftCallable !== isRightCallable) {
            return false;
        }
        if ((0, types_1.isInstantiableClass)(leftType) || ((0, types_1.isClassInstance)(leftType) && types_1.ClassType.isBuiltIn(leftType, 'type'))) {
            if ((0, types_1.isInstantiableClass)(rightType) ||
                ((0, types_1.isClassInstance)(rightType) && types_1.ClassType.isBuiltIn(rightType, 'type'))) {
                const genericLeftType = types_1.ClassType.cloneForSpecialization(leftType, 
                /* typeArguments */ undefined, 
                /* isTypeArgumentExplicit */ false);
                const genericRightType = types_1.ClassType.cloneForSpecialization(rightType, 
                /* typeArguments */ undefined, 
                /* isTypeArgumentExplicit */ false);
                if (this._evaluator.assignType(genericLeftType, genericRightType) ||
                    this._evaluator.assignType(genericRightType, genericLeftType)) {
                    return true;
                }
            }
            // Does the class have an operator overload for eq?
            const metaclass = leftType.details.effectiveMetaclass;
            if (metaclass && (0, types_1.isClass)(metaclass)) {
                if ((0, typeUtils_1.lookUpClassMember)(metaclass, '__eq__', 4 /* MemberAccessFlags.SkipObjectBaseClass */)) {
                    return true;
                }
            }
            return false;
        }
        if ((0, types_1.isClassInstance)(leftType)) {
            if ((0, types_1.isClassInstance)(rightType)) {
                const genericLeftType = types_1.ClassType.cloneForSpecialization(leftType, 
                /* typeArguments */ undefined, 
                /* isTypeArgumentExplicit */ false);
                const genericRightType = types_1.ClassType.cloneForSpecialization(rightType, 
                /* typeArguments */ undefined, 
                /* isTypeArgumentExplicit */ false);
                if (this._evaluator.assignType(genericLeftType, genericRightType) ||
                    this._evaluator.assignType(genericRightType, genericLeftType)) {
                    return true;
                }
                // Assume that if the types are disjoint and built-in classes that they
                // will never be comparable.
                if (types_1.ClassType.isBuiltIn(leftType) && types_1.ClassType.isBuiltIn(rightType)) {
                    return false;
                }
            }
            // Does the class have an operator overload for eq?
            const eqMethod = (0, typeUtils_1.lookUpClassMember)(types_1.ClassType.cloneAsInstantiable(leftType), '__eq__', 4 /* MemberAccessFlags.SkipObjectBaseClass */);
            if (eqMethod) {
                // If this is a synthesized method for a dataclass, we can assume
                // that other dataclass types will not be comparable.
                if (types_1.ClassType.isDataClass(leftType) && eqMethod.symbol.getSynthesizedType()) {
                    return false;
                }
                return true;
            }
            return false;
        }
        return true;
    }
    // If the function is a generator, validates that its annotated return type
    // is appropriate for a generator.
    _validateGeneratorReturnType(node, functionType) {
        var _a;
        if (!types_1.FunctionType.isGenerator(functionType)) {
            return;
        }
        const declaredReturnType = functionType.details.declaredReturnType;
        if (!declaredReturnType) {
            return;
        }
        if ((0, types_1.isNever)(declaredReturnType)) {
            return;
        }
        const functionDecl = functionType.details.declaration;
        if (!functionDecl || !functionDecl.yieldStatements || functionDecl.yieldStatements.length === 0) {
            return;
        }
        let generatorType;
        if (!node.isAsync &&
            (0, types_1.isClassInstance)(declaredReturnType) &&
            types_1.ClassType.isBuiltIn(declaredReturnType, 'AwaitableGenerator')) {
            // Handle the old-style (pre-await) generator case
            // if the return type explicitly uses AwaitableGenerator.
            generatorType = this._evaluator.getTypingType(node, 'AwaitableGenerator');
        }
        else {
            generatorType = this._evaluator.getTypingType(node, node.isAsync ? 'AsyncGenerator' : 'Generator');
        }
        if (!generatorType || !(0, types_1.isInstantiableClass)(generatorType)) {
            return;
        }
        const specializedGenerator = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForSpecialization(generatorType, [types_1.AnyType.create(), types_1.AnyType.create(), types_1.AnyType.create()], 
        /* isTypeArgumentExplicit */ true));
        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
        if (!this._evaluator.assignType(declaredReturnType, specializedGenerator, diagAddendum)) {
            const errorMessage = node.isAsync
                ? localize_1.LocMessage.generatorAsyncReturnType()
                : localize_1.LocMessage.generatorSyncReturnType();
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, errorMessage.format({ yieldType: this._evaluator.printType(types_1.AnyType.create()) }) +
                diagAddendum.getString(), (_a = node.returnTypeAnnotation) !== null && _a !== void 0 ? _a : node.name);
        }
    }
    // Determines whether the specified type is one that should trigger
    // an "unused" value diagnostic.
    _isTypeValidForUnusedValueTest(type) {
        return !(0, typeUtils_1.isNoneInstance)(type) && !(0, types_1.isNever)(type) && !(0, types_1.isAnyOrUnknown)(type);
    }
    // Verifies that each local type variable is used more than once.
    _validateFunctionTypeVarUsage(node, functionTypeResult) {
        // Skip this check entirely if it's disabled.
        if (this._fileInfo.diagnosticRuleSet.reportInvalidTypeVarUse === 'none') {
            return;
        }
        const type = functionTypeResult.functionType;
        const localTypeVarUsage = new Map();
        const classTypeVarUsage = new Map();
        let exemptBoundTypeVar = true;
        let curParamNode;
        // Is this a constructor (an __init__ method) for a generic class?
        let constructorClass;
        if (types_1.FunctionType.isInstanceMethod(type) && node.name.value === '__init__') {
            const containingClassNode = ParseTreeUtils.getEnclosingClassOrFunction(node);
            if (containingClassNode && containingClassNode.nodeType === 10 /* ParseNodeType.Class */) {
                const classType = this._evaluator.getTypeOfClass(containingClassNode);
                if (classType && (0, types_1.isClass)(classType.classType)) {
                    constructorClass = classType.classType;
                }
            }
        }
        const nameWalker = new ParseTreeUtils.NameNodeWalker((nameNode, subscriptIndex, baseExpression) => {
            var _a, _b, _c, _d, _e, _f;
            const nameType = this._evaluator.getType(nameNode);
            ``;
            if (nameType && (0, types_1.isTypeVar)(nameType) && !nameType.details.isSynthesizedSelf) {
                // Does this name refer to a TypeVar that is scoped to this function?
                if (nameType.scopeId === ParseTreeUtils.getScopeIdForNode(node)) {
                    // We exempt constrained TypeVars, TypeVars that are type arguments of
                    // other types, and ParamSpecs. There are legitimate uses for singleton
                    // instances in these particular cases.
                    let isExempt = nameType.details.constraints.length > 0 ||
                        nameType.details.isDefaultExplicit ||
                        (exemptBoundTypeVar && subscriptIndex !== undefined) ||
                        (0, types_1.isParamSpec)(nameType);
                    if (!isExempt && baseExpression && subscriptIndex !== undefined) {
                        // Is this a type argument for a generic type alias? If so,
                        // exempt it from the check because the type alias may repeat
                        // the TypeVar multiple times.
                        const baseType = this._evaluator.getType(baseExpression);
                        if ((baseType === null || baseType === void 0 ? void 0 : baseType.typeAliasInfo) &&
                            baseType.typeAliasInfo.typeParameters &&
                            subscriptIndex < baseType.typeAliasInfo.typeParameters.length) {
                            isExempt = true;
                        }
                    }
                    const existingEntry = localTypeVarUsage.get(nameType.details.name);
                    const isParamTypeWithEllipsisUsage = ((_a = curParamNode === null || curParamNode === void 0 ? void 0 : curParamNode.defaultValue) === null || _a === void 0 ? void 0 : _a.nodeType) === 21 /* ParseNodeType.Ellipsis */;
                    if (!existingEntry) {
                        localTypeVarUsage.set(nameType.details.name, {
                            nodes: [nameNode],
                            typeVar: nameType,
                            paramTypeUsageCount: curParamNode !== undefined ? 1 : 0,
                            paramTypeWithEllipsisUsageCount: isParamTypeWithEllipsisUsage ? 1 : 0,
                            returnTypeUsageCount: curParamNode === undefined ? 1 : 0,
                            paramWithEllipsis: isParamTypeWithEllipsisUsage ? (_b = curParamNode === null || curParamNode === void 0 ? void 0 : curParamNode.name) === null || _b === void 0 ? void 0 : _b.value : undefined,
                            isExempt,
                        });
                    }
                    else {
                        existingEntry.nodes.push(nameNode);
                        if (curParamNode !== undefined) {
                            existingEntry.paramTypeUsageCount += 1;
                            if (isParamTypeWithEllipsisUsage) {
                                existingEntry.paramTypeWithEllipsisUsageCount += 1;
                                if (!existingEntry.paramWithEllipsis) {
                                    existingEntry.paramWithEllipsis = (_c = curParamNode === null || curParamNode === void 0 ? void 0 : curParamNode.name) === null || _c === void 0 ? void 0 : _c.value;
                                }
                            }
                        }
                        else {
                            existingEntry.returnTypeUsageCount += 1;
                        }
                    }
                }
                // Does this name refer to a TypeVar that is scoped to the class associated with
                // this constructor method?
                if (constructorClass && nameType.scopeId === constructorClass.details.typeVarScopeId) {
                    const existingEntry = classTypeVarUsage.get(nameType.details.name);
                    const isParamTypeWithEllipsisUsage = ((_d = curParamNode === null || curParamNode === void 0 ? void 0 : curParamNode.defaultValue) === null || _d === void 0 ? void 0 : _d.nodeType) === 21 /* ParseNodeType.Ellipsis */;
                    const isExempt = !!nameType.details.isDefaultExplicit;
                    if (!existingEntry) {
                        classTypeVarUsage.set(nameType.details.name, {
                            typeVar: nameType,
                            nodes: [nameNode],
                            paramTypeUsageCount: curParamNode !== undefined ? 1 : 0,
                            paramTypeWithEllipsisUsageCount: isParamTypeWithEllipsisUsage ? 1 : 0,
                            returnTypeUsageCount: 0,
                            paramWithEllipsis: isParamTypeWithEllipsisUsage ? (_e = curParamNode === null || curParamNode === void 0 ? void 0 : curParamNode.name) === null || _e === void 0 ? void 0 : _e.value : undefined,
                            isExempt,
                        });
                    }
                    else {
                        existingEntry.nodes.push(nameNode);
                        if (curParamNode !== undefined) {
                            existingEntry.paramTypeUsageCount += 1;
                            if (isParamTypeWithEllipsisUsage) {
                                existingEntry.paramTypeWithEllipsisUsageCount += 1;
                                if (!existingEntry.paramWithEllipsis) {
                                    existingEntry.paramWithEllipsis = (_f = curParamNode === null || curParamNode === void 0 ? void 0 : curParamNode.name) === null || _f === void 0 ? void 0 : _f.value;
                                }
                            }
                        }
                    }
                }
            }
        });
        // Find all of the local type variables in signature.
        node.parameters.forEach((param) => {
            const annotation = param.typeAnnotation || param.typeAnnotationComment;
            if (annotation) {
                curParamNode = param;
                nameWalker.walk(annotation);
            }
        });
        curParamNode = undefined;
        if (node.returnTypeAnnotation) {
            // Don't exempt the use of a bound TypeVar when used as a type argument
            // within a return type. This exemption applies only to input parameter
            // annotations.
            exemptBoundTypeVar = false;
            nameWalker.walk(node.returnTypeAnnotation);
        }
        if (node.functionAnnotationComment) {
            node.functionAnnotationComment.paramTypeAnnotations.forEach((expr) => {
                nameWalker.walk(expr);
            });
            if (node.functionAnnotationComment.returnTypeAnnotation) {
                exemptBoundTypeVar = false;
                nameWalker.walk(node.functionAnnotationComment.returnTypeAnnotation);
            }
        }
        localTypeVarUsage.forEach((usage) => {
            var _a;
            // Report error for local type variable that appears only once.
            if (usage.nodes.length === 1 && !usage.isExempt) {
                let altTypeText;
                if (usage.typeVar.details.isVariadic) {
                    altTypeText = '"tuple[object, ...]"';
                }
                else if (usage.typeVar.details.boundType) {
                    altTypeText = `"${this._evaluator.printType((0, typeUtils_1.convertToInstance)(usage.typeVar.details.boundType))}"`;
                }
                else {
                    altTypeText = '"object"';
                }
                const diag = new diagnostic_1.DiagnosticAddendum();
                diag.addMessage(localize_1.LocAddendum.typeVarUnnecessarySuggestion().format({
                    type: altTypeText,
                }));
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeVarUse, localize_1.LocMessage.typeVarUsedOnlyOnce().format({
                    name: usage.nodes[0].value,
                }) + diag.getString(), usage.nodes[0]);
            }
            // Report error for local type variable that appears in return type
            // (but not as a top-level TypeVar within a union) and appears only
            // within parameters that have default values. These may go unsolved.
            let isUsedInReturnType = usage.returnTypeUsageCount > 0;
            if (usage.returnTypeUsageCount === 1 && type.details.declaredReturnType) {
                // If the TypeVar appears only once in the return type and it's a top-level
                // TypeVar within a union, exempt it from this check. Although these
                // TypeVars may go unsolved, they can be safely eliminated from the union
                // without generating an Unknown type.
                const returnType = type.details.declaredReturnType;
                if ((0, types_1.isUnion)(returnType) &&
                    returnType.subtypes.some((subtype) => (0, types_1.isTypeVar)(subtype) && subtype.details.name === usage.nodes[0].value)) {
                    isUsedInReturnType = false;
                }
            }
            // Skip this check if the function is overloaded because the TypeVar
            // will be solved in terms of the overload signatures.
            const skipUnsolvableTypeVarCheck = (0, types_1.isOverloadedFunction)(functionTypeResult.decoratedType) &&
                !types_1.FunctionType.isOverloaded(functionTypeResult.functionType);
            if (isUsedInReturnType &&
                usage.paramTypeWithEllipsisUsageCount > 0 &&
                usage.paramTypeUsageCount === usage.paramTypeWithEllipsisUsageCount &&
                !skipUnsolvableTypeVarCheck) {
                const diag = new diagnostic_1.DiagnosticAddendum();
                diag.addMessage(localize_1.LocAddendum.typeVarUnsolvableRemedy());
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeVarUse, localize_1.LocMessage.typeVarPossiblyUnsolvable().format({
                    name: usage.nodes[0].value,
                    param: (_a = usage.paramWithEllipsis) !== null && _a !== void 0 ? _a : '',
                }) + diag.getString(), usage.nodes[0]);
            }
        });
        // Report error for a class type variable that appears only within
        // constructor parameters that have default values. These may go unsolved.
        classTypeVarUsage.forEach((usage) => {
            var _a;
            if (usage.paramTypeWithEllipsisUsageCount > 0 &&
                usage.paramTypeUsageCount === usage.paramTypeWithEllipsisUsageCount &&
                !usage.isExempt) {
                const diag = new diagnostic_1.DiagnosticAddendum();
                diag.addMessage(localize_1.LocAddendum.typeVarUnsolvableRemedy());
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeVarUse, localize_1.LocMessage.typeVarPossiblyUnsolvable().format({
                    name: usage.nodes[0].value,
                    param: (_a = usage.paramWithEllipsis) !== null && _a !== void 0 ? _a : '',
                }) + diag.getString(), usage.nodes[0]);
            }
        });
    }
    // Validates that overloads use @staticmethod and @classmethod consistently.
    _validateOverloadAttributeConsistency(node, functionType) {
        var _a, _b, _c, _d, _e, _f;
        let staticMethodCount = 0;
        let classMethodCount = 0;
        functionType.overloads.forEach((overload) => {
            if (types_1.FunctionType.isStaticMethod(overload)) {
                staticMethodCount++;
            }
            if (types_1.FunctionType.isClassMethod(overload)) {
                classMethodCount++;
            }
        });
        if (staticMethodCount > 0 && staticMethodCount < functionType.overloads.length) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentOverload, localize_1.LocMessage.overloadStaticMethodInconsistent().format({
                name: node.name.value,
            }), (_c = (_b = (_a = functionType.overloads[0]) === null || _a === void 0 ? void 0 : _a.details.declaration) === null || _b === void 0 ? void 0 : _b.node.name) !== null && _c !== void 0 ? _c : node.name);
        }
        if (classMethodCount > 0 && classMethodCount < functionType.overloads.length) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentOverload, localize_1.LocMessage.overloadClassMethodInconsistent().format({
                name: node.name.value,
            }), (_f = (_e = (_d = functionType.overloads[0]) === null || _d === void 0 ? void 0 : _d.details.declaration) === null || _e === void 0 ? void 0 : _e.node.name) !== null && _f !== void 0 ? _f : node.name);
        }
    }
    // Validates that overloads do not overlap with inconsistent return results.
    _validateOverloadConsistency(node, functionType, prevOverloads) {
        for (let i = 0; i < prevOverloads.length; i++) {
            const prevOverload = prevOverloads[i];
            if (this._isOverlappingOverload(functionType, prevOverload, /* partialOverlap */ false)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOverlappingOverload, localize_1.LocMessage.overlappingOverload().format({
                    name: node.name.value,
                    obscured: prevOverloads.length + 1,
                    obscuredBy: i + 1,
                }), node.name);
                break;
            }
        }
        for (let i = 0; i < prevOverloads.length; i++) {
            const prevOverload = prevOverloads[i];
            if (this._isOverlappingOverload(prevOverload, functionType, /* partialOverlap */ true)) {
                const prevReturnType = types_1.FunctionType.getEffectiveReturnType(prevOverload);
                const returnType = types_1.FunctionType.getEffectiveReturnType(functionType);
                if (prevReturnType &&
                    returnType &&
                    !this._evaluator.assignType(returnType, prevReturnType, 
                    /* diag */ undefined, new typeVarContext_1.TypeVarContext(), 
                    /* srcTypeVarContext */ undefined, 8 /* AssignTypeFlags.SkipSolveTypeVars */ | 1024 /* AssignTypeFlags.IgnoreTypeVarScope */)) {
                    const altNode = this._findNodeForOverload(node, prevOverload);
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOverlappingOverload, localize_1.LocMessage.overloadReturnTypeMismatch().format({
                        name: node.name.value,
                        newIndex: prevOverloads.length + 1,
                        prevIndex: i + 1,
                    }), (altNode || node).name);
                    break;
                }
            }
        }
    }
    // Mypy reports overlapping overload errors on the line that contains the
    // earlier overload. Typeshed stubs contain type: ignore comments on these
    // lines, so it is important for us to report them in the same manner.
    _findNodeForOverload(functionNode, overloadType) {
        const decls = this._evaluator.getDeclarationsForNameNode(functionNode.name);
        if (!decls) {
            return undefined;
        }
        for (const decl of decls) {
            if (decl.type === 5 /* DeclarationType.Function */) {
                const functionType = this._evaluator.getTypeOfFunction(decl.node);
                if ((functionType === null || functionType === void 0 ? void 0 : functionType.functionType) === overloadType) {
                    return decl.node;
                }
            }
        }
        return undefined;
    }
    _isOverlappingOverload(functionType, prevOverload, partialOverlap) {
        // According to precedent, the __get__ method is special-cased and is
        // exempt from overlapping overload checks. It's not clear why this is
        // the case, but for consistency with other type checkers, we'll honor
        // this rule. See https://github.com/python/typing/issues/253#issuecomment-389262904
        // for details.
        if (types_1.FunctionType.isInstanceMethod(functionType) && functionType.details.name === '__get__') {
            return false;
        }
        let flags = 64 /* AssignTypeFlags.SkipFunctionReturnTypeCheck */ | 16 /* AssignTypeFlags.OverloadOverlapCheck */;
        if (partialOverlap) {
            flags |= 32 /* AssignTypeFlags.PartialOverloadOverlapCheck */;
        }
        return this._evaluator.assignType(functionType, prevOverload, 
        /* diag */ undefined, new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(functionType)), 
        /* srcTypeVarContext */ undefined, flags);
    }
    _isLegalOverloadImplementation(overload, implementation, diag) {
        var _a;
        const implTypeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(implementation));
        const overloadTypeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(overload));
        // First check the parameters to see if they are assignable.
        let isLegal = this._evaluator.assignType(overload, implementation, diag, overloadTypeVarContext, implTypeVarContext, 64 /* AssignTypeFlags.SkipFunctionReturnTypeCheck */ |
            2 /* AssignTypeFlags.ReverseTypeVarMatching */ |
            512 /* AssignTypeFlags.SkipSelfClsTypeCheck */);
        // Now check the return types.
        const overloadReturnType = (_a = overload.details.declaredReturnType) !== null && _a !== void 0 ? _a : this._evaluator.getFunctionInferredReturnType(overload);
        const implementationReturnType = (0, typeUtils_1.applySolvedTypeVars)(implementation.details.declaredReturnType || this._evaluator.getFunctionInferredReturnType(implementation), implTypeVarContext);
        const returnDiag = new diagnostic_1.DiagnosticAddendum();
        if (!(0, types_1.isNever)(overloadReturnType) &&
            !this._evaluator.assignType(implementationReturnType, overloadReturnType, returnDiag.createAddendum(), implTypeVarContext, overloadTypeVarContext, 8 /* AssignTypeFlags.SkipSolveTypeVars */)) {
            returnDiag.addMessage(localize_1.LocAddendum.functionReturnTypeMismatch().format({
                sourceType: this._evaluator.printType(overloadReturnType),
                destType: this._evaluator.printType(implementationReturnType),
            }));
            diag === null || diag === void 0 ? void 0 : diag.addAddendum(returnDiag);
            isLegal = false;
        }
        return isLegal;
    }
    _walkStatementsAndReportUnreachable(statements) {
        let reportedUnreachable = false;
        let prevStatement;
        for (const statement of statements) {
            // No need to report unreachable more than once since the first time
            // covers all remaining statements in the statement list.
            if (!reportedUnreachable) {
                if (!this._evaluator.isNodeReachable(statement, prevStatement)) {
                    // Create a text range that covers the next statement through
                    // the end of the statement list.
                    const start = statement.start;
                    const lastStatement = statements[statements.length - 1];
                    const end = textRange_1.TextRange.getEnd(lastStatement);
                    this._evaluator.addUnreachableCode(statement, { start, length: end - start });
                    reportedUnreachable = true;
                }
            }
            if (!reportedUnreachable && this._fileInfo.isStubFile) {
                this._validateStubStatement(statement);
            }
            this.walk(statement);
            prevStatement = statement;
        }
    }
    _validateStubStatement(statement) {
        switch (statement.nodeType) {
            case 22 /* ParseNodeType.If */:
            case 31 /* ParseNodeType.Function */:
            case 10 /* ParseNodeType.Class */:
            case 0 /* ParseNodeType.Error */: {
                // These are allowed in a stub file.
                break;
            }
            case 57 /* ParseNodeType.While */:
            case 29 /* ParseNodeType.For */:
            case 53 /* ParseNodeType.Try */:
            case 58 /* ParseNodeType.With */: {
                // These are not allowed.
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidStubStatement, localize_1.LocMessage.invalidStubStatement(), statement);
                break;
            }
            case 47 /* ParseNodeType.StatementList */: {
                for (const substatement of statement.statements) {
                    let isValid = true;
                    switch (substatement.nodeType) {
                        case 2 /* ParseNodeType.Assert */:
                        case 4 /* ParseNodeType.AssignmentExpression */:
                        case 6 /* ParseNodeType.Await */:
                        case 7 /* ParseNodeType.BinaryOperation */:
                        case 14 /* ParseNodeType.Constant */:
                        case 17 /* ParseNodeType.Del */:
                        case 18 /* ParseNodeType.Dictionary */:
                        case 27 /* ParseNodeType.Index */:
                        case 29 /* ParseNodeType.For */:
                        case 30 /* ParseNodeType.FormatString */:
                        case 32 /* ParseNodeType.Global */:
                        case 33 /* ParseNodeType.Lambda */:
                        case 34 /* ParseNodeType.List */:
                        case 35 /* ParseNodeType.MemberAccess */:
                        case 38 /* ParseNodeType.Name */:
                        case 39 /* ParseNodeType.Nonlocal */:
                        case 40 /* ParseNodeType.Number */:
                        case 43 /* ParseNodeType.Raise */:
                        case 44 /* ParseNodeType.Return */:
                        case 45 /* ParseNodeType.Set */:
                        case 46 /* ParseNodeType.Slice */:
                        case 51 /* ParseNodeType.Ternary */:
                        case 52 /* ParseNodeType.Tuple */:
                        case 53 /* ParseNodeType.Try */:
                        case 55 /* ParseNodeType.UnaryOperation */:
                        case 56 /* ParseNodeType.Unpack */:
                        case 57 /* ParseNodeType.While */:
                        case 58 /* ParseNodeType.With */:
                        case 59 /* ParseNodeType.WithItem */:
                        case 60 /* ParseNodeType.Yield */:
                        case 61 /* ParseNodeType.YieldFrom */: {
                            isValid = false;
                            break;
                        }
                        case 5 /* ParseNodeType.AugmentedAssignment */: {
                            // Exempt __all__ manipulations.
                            isValid =
                                substatement.operator === 1 /* OperatorType.AddEqual */ &&
                                    substatement.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                                    substatement.leftExpression.value === '__all__';
                            break;
                        }
                        case 9 /* ParseNodeType.Call */: {
                            // Exempt __all__ manipulations.
                            isValid =
                                substatement.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                                    substatement.leftExpression.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                                    substatement.leftExpression.leftExpression.value === '__all__';
                            break;
                        }
                    }
                    if (!isValid) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidStubStatement, localize_1.LocMessage.invalidStubStatement(), substatement);
                    }
                }
            }
        }
    }
    _validateExceptionTypeRecursive(exceptionType, diag, baseExceptionType, baseExceptionGroupType, allowTuple, isExceptGroup) {
        const derivesFromBaseException = (classType) => {
            if (!baseExceptionType || !(0, types_1.isInstantiableClass)(baseExceptionType)) {
                return true;
            }
            return (0, typeUtils_1.derivesFromClassRecursive)(classType, baseExceptionType, /* ignoreUnknown */ false);
        };
        const derivesFromBaseExceptionGroup = (classType) => {
            if (!baseExceptionGroupType || !(0, types_1.isInstantiableClass)(baseExceptionGroupType)) {
                return true;
            }
            return (0, typeUtils_1.derivesFromClassRecursive)(classType, baseExceptionGroupType, /* ignoreUnknown */ false);
        };
        (0, typeUtils_1.doForEachSubtype)(exceptionType, (exceptionSubtype) => {
            if ((0, types_1.isAnyOrUnknown)(exceptionSubtype)) {
                return;
            }
            if ((0, types_1.isClass)(exceptionSubtype)) {
                if (types_1.TypeBase.isInstantiable(exceptionSubtype)) {
                    if (!derivesFromBaseException(exceptionSubtype)) {
                        diag.addMessage(localize_1.LocMessage.exceptionTypeIncorrect().format({
                            type: this._evaluator.printType(exceptionSubtype),
                        }));
                    }
                    if (isExceptGroup && derivesFromBaseExceptionGroup(exceptionSubtype)) {
                        diag.addMessage(localize_1.LocMessage.exceptionGroupTypeIncorrect());
                    }
                    return;
                }
                if (allowTuple && exceptionSubtype.tupleTypeArguments) {
                    exceptionSubtype.tupleTypeArguments.forEach((typeArg) => {
                        this._validateExceptionTypeRecursive(typeArg.type, diag, baseExceptionType, baseExceptionGroupType, 
                        /* allowTuple */ false, isExceptGroup);
                    });
                    return;
                }
                diag.addMessage(localize_1.LocMessage.exceptionTypeIncorrect().format({
                    type: this._evaluator.printType(exceptionSubtype),
                }));
            }
        });
    }
    _validateExceptionType(exceptionType, errorNode, isExceptGroup) {
        const baseExceptionType = this._evaluator.getBuiltInType(errorNode, 'BaseException');
        const baseExceptionGroupType = this._evaluator.getBuiltInType(errorNode, 'BaseExceptionGroup');
        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
        this._validateExceptionTypeRecursive(exceptionType, diagAddendum, baseExceptionType, baseExceptionGroupType, 
        /* allowTuple */ true, isExceptGroup);
        if (!diagAddendum.isEmpty()) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.exceptionTypeNotClass().format({
                type: this._evaluator.printType(exceptionType),
            }), errorNode);
        }
    }
    _reportUnusedDunderAllSymbols(nodes) {
        // If this rule is disabled, don't bother doing the work.
        if (this._fileInfo.diagnosticRuleSet.reportUnsupportedDunderAll === 'none') {
            return;
        }
        const moduleScope = AnalyzerNodeInfo.getScope(this._moduleNode);
        if (!moduleScope) {
            return;
        }
        nodes.forEach((node) => {
            if (!moduleScope.symbolTable.has(node.value)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnsupportedDunderAll, localize_1.LocMessage.dunderAllSymbolNotPresent().format({ name: node.value }), node);
            }
        });
    }
    _validateSymbolTables() {
        var _a;
        const dependentFileInfo = (_a = this._dependentFiles) === null || _a === void 0 ? void 0 : _a.map((p) => AnalyzerNodeInfo.getFileInfo(p.parseTree));
        for (const scopedNode of this._scopedNodes) {
            const scope = AnalyzerNodeInfo.getScope(scopedNode);
            if (scope) {
                scope.symbolTable.forEach((symbol, name) => {
                    this._conditionallyReportUnusedSymbol(name, symbol, scope.type, dependentFileInfo);
                    this._reportIncompatibleDeclarations(name, symbol);
                    this._reportMultipleFinalDeclarations(name, symbol, scope.type);
                    this._reportMultipleTypeAliasDeclarations(name, symbol);
                    this._reportInvalidOverload(name, symbol);
                });
            }
        }
        // Report unaccessed type parameters.
        const accessedSymbolSet = this._fileInfo.accessedSymbolSet;
        for (const paramList of this._typeParameterLists) {
            const typeParamScope = AnalyzerNodeInfo.getScope(paramList);
            for (const param of paramList.parameters) {
                const symbol = typeParamScope === null || typeParamScope === void 0 ? void 0 : typeParamScope.symbolTable.get(param.name.value);
                if (!symbol) {
                    // This can happen if the code is unreachable.
                    return;
                }
                if (!accessedSymbolSet.has(symbol.id)) {
                    const decls = symbol.getDeclarations();
                    decls.forEach((decl) => {
                        this._conditionallyReportUnusedDeclaration(decl, /* isPrivate */ false);
                    });
                }
            }
        }
    }
    _reportInvalidOverload(name, symbol) {
        const typedDecls = symbol.getTypedDeclarations();
        if (typedDecls.length === 0) {
            return;
        }
        const primaryDecl = typedDecls[0];
        if (primaryDecl.type !== 5 /* DeclarationType.Function */) {
            return;
        }
        const type = this._evaluator.getEffectiveTypeOfSymbol(symbol);
        const overloadedFunctions = (0, types_1.isOverloadedFunction)(type)
            ? types_1.OverloadedFunctionType.getOverloads(type)
            : (0, types_1.isFunction)(type) && types_1.FunctionType.isOverloaded(type)
                ? [type]
                : [];
        // If the implementation has no name, it was synthesized probably by a
        // decorator that used a callable with a ParamSpec that captured the
        // overloaded signature. We'll exempt it from this check.
        if ((0, types_1.isOverloadedFunction)(type)) {
            const overloads = types_1.OverloadedFunctionType.getOverloads(type);
            if (overloads.length > 0 && overloads[0].details.name === '') {
                return;
            }
        }
        else if ((0, types_1.isFunction)(type)) {
            if (type.details.name === '') {
                return;
            }
        }
        if (overloadedFunctions.length === 1) {
            // There should never be a single overload.
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentOverload, localize_1.LocMessage.singleOverload().format({ name }), primaryDecl.node.name);
        }
        // If the file is not a stub and this is the first overload,
        // verify that there is an implementation.
        if (this._fileInfo.isStubFile || overloadedFunctions.length === 0) {
            return;
        }
        let implementationFunction;
        if ((0, types_1.isOverloadedFunction)(type)) {
            implementationFunction = types_1.OverloadedFunctionType.getImplementation(type);
        }
        else if ((0, types_1.isFunction)(type) && !types_1.FunctionType.isOverloaded(type)) {
            implementationFunction = type;
        }
        if (!implementationFunction) {
            const containingClassNode = ParseTreeUtils.getEnclosingClassOrFunction(primaryDecl.node);
            if (containingClassNode && containingClassNode.nodeType === 10 /* ParseNodeType.Class */) {
                const classType = this._evaluator.getTypeOfClass(containingClassNode);
                if (classType) {
                    if (types_1.ClassType.isProtocolClass(classType.classType)) {
                        return;
                    }
                    if (types_1.ClassType.supportsAbstractMethods(classType.classType)) {
                        if ((0, types_1.isOverloadedFunction)(type) &&
                            types_1.OverloadedFunctionType.getOverloads(type).every((overload) => types_1.FunctionType.isAbstractMethod(overload))) {
                            return;
                        }
                    }
                }
            }
            // If this is a method within a protocol class, don't require that
            // there is an implementation.
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportNoOverloadImplementation, localize_1.LocMessage.overloadWithoutImplementation().format({
                name: primaryDecl.node.name.value,
            }), primaryDecl.node.name);
            return;
        }
        if (!(0, types_1.isOverloadedFunction)(type)) {
            return;
        }
        // Verify that all overload signatures are assignable to implementation signature.
        types_1.OverloadedFunctionType.getOverloads(type).forEach((overload, index) => {
            var _a, _b, _c, _d;
            const diag = new diagnostic_1.DiagnosticAddendum();
            if (!this._isLegalOverloadImplementation(overload, implementationFunction, diag)) {
                if (implementationFunction.details.declaration) {
                    const diagnostic = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentOverload, localize_1.LocMessage.overloadImplementationMismatch().format({
                        name,
                        index: index + 1,
                    }) + diag.getString(), implementationFunction.details.declaration.node.name);
                    if (diagnostic && overload.details.declaration) {
                        diagnostic.addRelatedInfo(localize_1.LocAddendum.overloadSignature(), (_b = (_a = overload.details.declaration) === null || _a === void 0 ? void 0 : _a.uri) !== null && _b !== void 0 ? _b : primaryDecl.uri, (_d = (_c = overload.details.declaration) === null || _c === void 0 ? void 0 : _c.range) !== null && _d !== void 0 ? _d : primaryDecl.range);
                    }
                }
            }
        });
    }
    _reportMultipleFinalDeclarations(name, symbol, scopeType) {
        if (!this._evaluator.isFinalVariable(symbol)) {
            return;
        }
        const decls = symbol.getDeclarations();
        let sawFinal = false;
        let sawAssignment = false;
        decls.forEach((decl) => {
            var _a;
            if (this._evaluator.isFinalVariableDeclaration(decl)) {
                if (sawFinal) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.finalRedeclaration().format({ name }), decl.node);
                }
                sawFinal = true;
            }
            let reportRedeclaration = false;
            if (decl.type === 1 /* DeclarationType.Variable */) {
                if (decl.inferredTypeSource) {
                    if (sawAssignment) {
                        let exemptAssignment = false;
                        if (scopeType === 3 /* ScopeType.Class */) {
                            // We check for assignment of Final instance and class variables
                            // in the type evaluator because we need to take into account whether
                            // the assignment is within an `__init__` method, so ignore class
                            // scopes here.
                            const classOrFunc = ParseTreeUtils.getEnclosingClassOrFunction(decl.node);
                            if ((classOrFunc === null || classOrFunc === void 0 ? void 0 : classOrFunc.nodeType) === 31 /* ParseNodeType.Function */) {
                                exemptAssignment = true;
                            }
                        }
                        if (!exemptAssignment) {
                            reportRedeclaration = true;
                        }
                    }
                    sawAssignment = true;
                }
            }
            else {
                reportRedeclaration = true;
            }
            if (reportRedeclaration) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.finalReassigned().format({ name }), (_a = (0, declarationUtils_1.getNameNodeForDeclaration)(decl)) !== null && _a !== void 0 ? _a : decl.node);
            }
        });
        // If it's not a stub file, an assignment must be provided.
        if (!sawAssignment && !this._fileInfo.isStubFile) {
            const firstDecl = decls.find((decl) => decl.type === 1 /* DeclarationType.Variable */ && decl.isFinal);
            if (firstDecl) {
                // Is this an instance variable declared within a dataclass? If so, it
                // is implicitly initialized by the synthesized `__init__` method and
                // therefore has an implied assignment.
                let isImplicitlyAssigned = false;
                // Is this a class variable within a protocol class? If so, it can
                // be marked final without providing a value.
                let isProtocolClass = false;
                if (symbol.isClassMember() && !symbol.isClassVar()) {
                    const containingClass = ParseTreeUtils.getEnclosingClass(firstDecl.node, /* stopAtFunction */ true);
                    if (containingClass) {
                        const classType = this._evaluator.getTypeOfClass(containingClass);
                        if (classType && (0, types_1.isClass)(classType.decoratedType)) {
                            if (types_1.ClassType.isDataClass(classType.decoratedType)) {
                                isImplicitlyAssigned = true;
                            }
                            if (types_1.ClassType.isProtocolClass(classType.decoratedType)) {
                                isProtocolClass = true;
                            }
                        }
                    }
                }
                if (!isImplicitlyAssigned && !isProtocolClass) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.finalUnassigned().format({ name }), firstDecl.node);
                }
            }
        }
    }
    _reportMultipleTypeAliasDeclarations(name, symbol) {
        const decls = symbol.getDeclarations();
        const typeAliasDecl = decls.find((decl) => this._evaluator.isExplicitTypeAliasDeclaration(decl));
        // If this is a type alias, there should be only one declaration.
        if (typeAliasDecl && decls.length > 1) {
            decls.forEach((decl) => {
                if (decl !== typeAliasDecl) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportRedeclaration, localize_1.LocMessage.typeAliasRedeclared().format({ name }), decl.node);
                }
            });
        }
    }
    _reportIncompatibleDeclarations(name, symbol) {
        var _a, _b, _c, _d;
        // If there's one or more declaration with a declared type,
        // all other declarations should match. The only exception is
        // for functions that have an overload.
        const primaryDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(symbol);
        // If there's no declaration with a declared type, we're done.
        if (!primaryDecl) {
            return;
        }
        // Special case the '_' symbol, which is used in single dispatch
        // code and other cases where the name does not matter.
        if (name === '_') {
            return;
        }
        let otherDecls = symbol.getDeclarations().filter((decl) => decl !== primaryDecl);
        // If it's a function, we can skip any other declarations
        // that are overloads or property setters/deleters.
        if (primaryDecl.type === 5 /* DeclarationType.Function */) {
            const primaryDeclTypeInfo = this._evaluator.getTypeOfFunction(primaryDecl.node);
            otherDecls = otherDecls.filter((decl) => {
                if (decl.type !== 5 /* DeclarationType.Function */) {
                    return true;
                }
                const funcTypeInfo = this._evaluator.getTypeOfFunction(decl.node);
                if (!funcTypeInfo) {
                    return true;
                }
                const decoratedType = primaryDeclTypeInfo
                    ? this._evaluator.makeTopLevelTypeVarsConcrete(primaryDeclTypeInfo.decoratedType)
                    : undefined;
                // We need to handle properties in a careful manner because of
                // the way that setters and deleters are often defined using multiple
                // methods with the same name.
                if (decoratedType &&
                    (0, types_1.isClassInstance)(decoratedType) &&
                    types_1.ClassType.isPropertyClass(decoratedType) &&
                    (0, types_1.isClassInstance)(funcTypeInfo.decoratedType) &&
                    types_1.ClassType.isPropertyClass(funcTypeInfo.decoratedType)) {
                    return funcTypeInfo.decoratedType.details.typeSourceId !== decoratedType.details.typeSourceId;
                }
                return !types_1.FunctionType.isOverloaded(funcTypeInfo.functionType);
            });
        }
        // If there are no other declarations to consider, we're done.
        if (otherDecls.length === 0) {
            return;
        }
        let primaryDeclInfo;
        if (primaryDecl.type === 5 /* DeclarationType.Function */) {
            if (primaryDecl.isMethod) {
                primaryDeclInfo = localize_1.LocAddendum.seeMethodDeclaration();
            }
            else {
                primaryDeclInfo = localize_1.LocAddendum.seeFunctionDeclaration();
            }
        }
        else if (primaryDecl.type === 6 /* DeclarationType.Class */) {
            primaryDeclInfo = localize_1.LocAddendum.seeClassDeclaration();
        }
        else if (primaryDecl.type === 2 /* DeclarationType.Parameter */) {
            primaryDeclInfo = localize_1.LocAddendum.seeParameterDeclaration();
        }
        else if (primaryDecl.type === 1 /* DeclarationType.Variable */) {
            primaryDeclInfo = localize_1.LocAddendum.seeVariableDeclaration();
        }
        else if (primaryDecl.type === 4 /* DeclarationType.TypeAlias */) {
            primaryDeclInfo = localize_1.LocAddendum.seeTypeAliasDeclaration();
        }
        else {
            primaryDeclInfo = localize_1.LocAddendum.seeDeclaration();
        }
        const addPrimaryDeclInfo = (diag) => {
            if (diag) {
                let primaryDeclNode;
                if (primaryDecl.type === 5 /* DeclarationType.Function */ || primaryDecl.type === 6 /* DeclarationType.Class */) {
                    primaryDeclNode = primaryDecl.node.name;
                }
                else if (primaryDecl.type === 1 /* DeclarationType.Variable */) {
                    if (primaryDecl.node.nodeType === 38 /* ParseNodeType.Name */) {
                        primaryDeclNode = primaryDecl.node;
                    }
                }
                else if (primaryDecl.type === 2 /* DeclarationType.Parameter */ ||
                    primaryDecl.type === 3 /* DeclarationType.TypeParameter */) {
                    if (primaryDecl.node.name) {
                        primaryDeclNode = primaryDecl.node.name;
                    }
                }
                if (primaryDeclNode) {
                    diag.addRelatedInfo(primaryDeclInfo, primaryDecl.uri, primaryDecl.range);
                }
            }
        };
        for (const otherDecl of otherDecls) {
            if (otherDecl.type === 6 /* DeclarationType.Class */) {
                let duplicateIsOk = false;
                if (primaryDecl.type === 3 /* DeclarationType.TypeParameter */) {
                    // The error will be reported elsewhere if a type parameter is
                    // involved, so don't report it here.
                    duplicateIsOk = true;
                }
                if (!duplicateIsOk) {
                    const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportRedeclaration, localize_1.LocMessage.obscuredClassDeclaration().format({ name }), otherDecl.node.name);
                    addPrimaryDeclInfo(diag);
                }
            }
            else if (otherDecl.type === 5 /* DeclarationType.Function */) {
                const primaryType = (_a = this._evaluator.getTypeForDeclaration(primaryDecl)) === null || _a === void 0 ? void 0 : _a.type;
                let duplicateIsOk = false;
                // If the return type has not yet been inferred, do so now.
                if (primaryType && (0, types_1.isFunction)(primaryType)) {
                    this._evaluator.getFunctionInferredReturnType(primaryType);
                }
                const otherType = (_b = this._evaluator.getTypeForDeclaration(otherDecl)) === null || _b === void 0 ? void 0 : _b.type;
                const suite1 = ParseTreeUtils.getEnclosingSuite(primaryDecl.node);
                const suite2 = ParseTreeUtils.getEnclosingSuite(otherDecl.node);
                // Allow same-signature overrides in cases where the declarations
                // are not within the same statement suite (e.g. one in the "if"
                // and another in the "else").
                const isInSameStatementList = suite1 === suite2;
                // If the return type has not yet been inferred, do so now.
                if (otherType && (0, types_1.isFunction)(otherType)) {
                    this._evaluator.getFunctionInferredReturnType(otherType);
                }
                // If both declarations are functions, it's OK if they
                // both have the same signatures.
                if (!isInSameStatementList && primaryType && otherType && (0, types_1.isTypeSame)(primaryType, otherType)) {
                    duplicateIsOk = true;
                }
                if (primaryDecl.type === 3 /* DeclarationType.TypeParameter */) {
                    // The error will be reported elsewhere if a type parameter is
                    // involved, so don't report it here.
                    duplicateIsOk = true;
                }
                if (!duplicateIsOk) {
                    const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportRedeclaration, otherDecl.isMethod
                        ? localize_1.LocMessage.obscuredMethodDeclaration().format({ name })
                        : localize_1.LocMessage.obscuredFunctionDeclaration().format({ name }), otherDecl.node.name);
                    addPrimaryDeclInfo(diag);
                }
            }
            else if (otherDecl.type === 2 /* DeclarationType.Parameter */) {
                if (otherDecl.node.name) {
                    let duplicateIsOk = false;
                    if (primaryDecl.type === 3 /* DeclarationType.TypeParameter */) {
                        // The error will be reported elsewhere if a type parameter is
                        // involved, so don't report it here.
                        duplicateIsOk = true;
                    }
                    if (!duplicateIsOk) {
                        const message = localize_1.LocMessage.obscuredParameterDeclaration();
                        const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportRedeclaration, message.format({ name }), otherDecl.node.name);
                        addPrimaryDeclInfo(diag);
                    }
                }
            }
            else if (otherDecl.type === 1 /* DeclarationType.Variable */) {
                const primaryType = (_c = this._evaluator.getTypeForDeclaration(primaryDecl)) === null || _c === void 0 ? void 0 : _c.type;
                if (otherDecl.typeAnnotationNode) {
                    if (otherDecl.node.nodeType === 38 /* ParseNodeType.Name */) {
                        let duplicateIsOk = false;
                        // It's OK if they both have the same declared type.
                        const otherType = (_d = this._evaluator.getTypeForDeclaration(otherDecl)) === null || _d === void 0 ? void 0 : _d.type;
                        if (primaryType && otherType && (0, types_1.isTypeSame)(primaryType, otherType)) {
                            duplicateIsOk = true;
                        }
                        if (primaryDecl.type === 3 /* DeclarationType.TypeParameter */) {
                            // The error will be reported elsewhere if a type parameter is
                            // involved, so don't report it here.
                            duplicateIsOk = true;
                        }
                        if (!duplicateIsOk) {
                            const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportRedeclaration, localize_1.LocMessage.obscuredVariableDeclaration().format({ name }), otherDecl.node);
                            addPrimaryDeclInfo(diag);
                        }
                    }
                }
            }
            else if (otherDecl.type === 4 /* DeclarationType.TypeAlias */) {
                const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportRedeclaration, localize_1.LocMessage.obscuredTypeAliasDeclaration().format({ name }), otherDecl.node.name);
                addPrimaryDeclInfo(diag);
            }
        }
    }
    _conditionallyReportUnusedSymbol(name, symbol, scopeType, dependentFileInfo) {
        const accessedSymbolSet = this._fileInfo.accessedSymbolSet;
        if (symbol.isIgnoredForProtocolMatch() || accessedSymbolSet.has(symbol.id)) {
            return;
        }
        // If this file is implicitly imported by other files, we need to make sure the symbol defined in
        // the current file is not accessed from those other files.
        if (dependentFileInfo && dependentFileInfo.some((i) => i.accessedSymbolSet.has(symbol.id))) {
            return;
        }
        // A name of "_" means "I know this symbol isn't used", so
        // don't report it as unused.
        if (name === '_') {
            return;
        }
        if (SymbolNameUtils.isDunderName(name)) {
            return;
        }
        const decls = symbol.getDeclarations();
        decls.forEach((decl) => {
            this._conditionallyReportUnusedDeclaration(decl, this._isSymbolPrivate(name, scopeType));
        });
    }
    _conditionallyReportUnusedDeclaration(decl, isPrivate) {
        var _a;
        let diagnosticLevel;
        let nameNode;
        let message;
        let rule;
        switch (decl.type) {
            case 8 /* DeclarationType.Alias */:
                diagnosticLevel = this._fileInfo.diagnosticRuleSet.reportUnusedImport;
                rule = diagnosticRules_1.DiagnosticRule.reportUnusedImport;
                if (decl.node.nodeType === 24 /* ParseNodeType.ImportAs */) {
                    if (decl.node.alias) {
                        // For statements of the form "import x as x", don't mark "x" as unaccessed
                        // because it's assumed to be re-exported.
                        // See https://typing.readthedocs.io/en/latest/source/stubs.html#imports.
                        if (decl.node.alias.value !== decl.moduleName) {
                            nameNode = decl.node.alias;
                        }
                    }
                    else {
                        // Handle multi-part names specially.
                        const nameParts = decl.node.module.nameParts;
                        if (nameParts.length > 0) {
                            const multipartName = nameParts.map((np) => np.value).join('.');
                            let textRange = { start: nameParts[0].start, length: nameParts[0].length };
                            textRange = textRange_1.TextRange.extend(textRange, nameParts[nameParts.length - 1]);
                            this._fileInfo.diagnosticSink.addUnusedCodeWithTextRange(localize_1.LocMessage.unaccessedSymbol().format({ name: multipartName }), textRange, { action: "pyright.unusedImport" /* Commands.unusedImport */ });
                            this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportUnusedImport, localize_1.LocMessage.unaccessedImport().format({ name: multipartName }), textRange);
                            return;
                        }
                    }
                }
                else if (decl.node.nodeType === 26 /* ParseNodeType.ImportFromAs */) {
                    const importFrom = decl.node.parent;
                    // For statements of the form "from y import x as x", don't mark "x" as
                    // unaccessed because it's assumed to be re-exported.
                    const isReexport = ((_a = decl.node.alias) === null || _a === void 0 ? void 0 : _a.value) === decl.node.name.value;
                    // If this is a __future__ import, it's OK for the import symbol to be unaccessed.
                    const isFuture = importFrom.module.nameParts.length === 1 &&
                        importFrom.module.nameParts[0].value === '__future__';
                    if (!isReexport && !isFuture) {
                        nameNode = decl.node.alias || decl.node.name;
                    }
                }
                if (nameNode) {
                    message = localize_1.LocMessage.unaccessedImport().format({ name: nameNode.value });
                }
                break;
            case 4 /* DeclarationType.TypeAlias */:
            case 1 /* DeclarationType.Variable */:
            case 2 /* DeclarationType.Parameter */:
                if (!isPrivate) {
                    return;
                }
                if (this._fileInfo.isStubFile) {
                    // Don't mark variables or parameters as unaccessed in
                    // stub files. It's typical for them to be unaccessed here.
                    return;
                }
                diagnosticLevel = this._fileInfo.diagnosticRuleSet.reportUnusedVariable;
                if (decl.node.nodeType === 38 /* ParseNodeType.Name */) {
                    nameNode = decl.node;
                    // Don't emit a diagnostic if the name starts with an underscore.
                    // This indicates that the variable is unused.
                    if (nameNode.value.startsWith('_')) {
                        diagnosticLevel = 'none';
                    }
                }
                else if (decl.node.nodeType === 41 /* ParseNodeType.Parameter */) {
                    nameNode = decl.node.name;
                    // Don't emit a diagnostic for unused parameters or type parameters.
                    diagnosticLevel = 'none';
                }
                if (nameNode) {
                    rule = diagnosticRules_1.DiagnosticRule.reportUnusedVariable;
                    message = localize_1.LocMessage.unaccessedVariable().format({ name: nameNode.value });
                }
                break;
            case 6 /* DeclarationType.Class */:
                if (!isPrivate) {
                    return;
                }
                // If a stub is exporting a private type, we'll assume that the author
                // knows what he or she is doing.
                if (this._fileInfo.isStubFile) {
                    return;
                }
                diagnosticLevel = this._fileInfo.diagnosticRuleSet.reportUnusedClass;
                nameNode = decl.node.name;
                rule = diagnosticRules_1.DiagnosticRule.reportUnusedClass;
                message = localize_1.LocMessage.unaccessedClass().format({ name: nameNode.value });
                break;
            case 5 /* DeclarationType.Function */:
                if (!isPrivate) {
                    return;
                }
                // If a stub is exporting a private type, we'll assume that the author
                // knows what he or she is doing.
                if (this._fileInfo.isStubFile) {
                    return;
                }
                diagnosticLevel = this._fileInfo.diagnosticRuleSet.reportUnusedFunction;
                nameNode = decl.node.name;
                rule = diagnosticRules_1.DiagnosticRule.reportUnusedFunction;
                message = localize_1.LocMessage.unaccessedFunction().format({ name: nameNode.value });
                break;
            case 3 /* DeclarationType.TypeParameter */:
                // Never report a diagnostic for an unused TypeParameter.
                diagnosticLevel = 'none';
                nameNode = decl.node.name;
                break;
            case 0 /* DeclarationType.Intrinsic */:
            case 7 /* DeclarationType.SpecialBuiltInClass */:
                return;
            default:
                (0, debug_1.assertNever)(decl);
        }
        const action = rule === diagnosticRules_1.DiagnosticRule.reportUnusedImport ? { action: "pyright.unusedImport" /* Commands.unusedImport */ } : undefined;
        if (nameNode) {
            this._fileInfo.diagnosticSink.addUnusedCodeWithTextRange(localize_1.LocMessage.unaccessedSymbol().format({ name: nameNode.value }), nameNode, action);
            if (rule !== undefined && message && diagnosticLevel !== 'none') {
                this._evaluator.addDiagnostic(rule, message, nameNode);
            }
        }
    }
    // Validates that a call to isinstance or issubclass are necessary. This is a
    // common source of programming errors. Also validates that arguments passed
    // to isinstance or issubclass won't generate exceptions.
    _validateIsInstanceCall(node) {
        if (node.leftExpression.nodeType !== 38 /* ParseNodeType.Name */ ||
            (node.leftExpression.value !== 'isinstance' && node.leftExpression.value !== 'issubclass') ||
            node.arguments.length !== 2) {
            return;
        }
        const callName = node.leftExpression.value;
        const isInstanceCheck = callName === 'isinstance';
        let arg0Type = this._evaluator.getType(node.arguments[0].valueExpression);
        if (!arg0Type) {
            return;
        }
        arg0Type = (0, typeUtils_1.mapSubtypes)(arg0Type, (subtype) => {
            return (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(subtype);
        });
        arg0Type = this._evaluator.expandPromotionTypes(node, arg0Type);
        const arg1Type = this._evaluator.getType(node.arguments[1].valueExpression);
        if (!arg1Type) {
            return;
        }
        let isValidType = true;
        const diag = new diagnostic_1.DiagnosticAddendum();
        (0, typeUtils_1.doForEachSubtype)(arg1Type, (arg1Subtype) => {
            if ((0, types_1.isClassInstance)(arg1Subtype) && types_1.ClassType.isTupleClass(arg1Subtype) && arg1Subtype.tupleTypeArguments) {
                if (arg1Subtype.tupleTypeArguments.some((typeArg) => !this._isTypeSupportedTypeForIsInstance(typeArg.type, isInstanceCheck, diag))) {
                    isValidType = false;
                }
            }
            else {
                if (!this._isTypeSupportedTypeForIsInstance(arg1Subtype, isInstanceCheck, diag)) {
                    isValidType = false;
                }
            }
        });
        if (!isValidType) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportArgumentType, isInstanceCheck
                ? localize_1.LocMessage.isInstanceInvalidType().format({
                    type: this._evaluator.printType(arg1Type),
                }) + diag.getString()
                : localize_1.LocMessage.isSubclassInvalidType().format({
                    type: this._evaluator.printType(arg1Type),
                }) + diag.getString(), node.arguments[1]);
        }
        // If this call is an issubclass, check for the use of a "data protocol",
        // which PEP 544 says cannot be used in issubclass.
        if (!isInstanceCheck) {
            const diag = new diagnostic_1.DiagnosticAddendum();
            (0, typeUtils_1.doForEachSubtype)(arg1Type, (arg1Subtype) => {
                if ((0, types_1.isClassInstance)(arg1Subtype) &&
                    types_1.ClassType.isTupleClass(arg1Subtype) &&
                    arg1Subtype.tupleTypeArguments) {
                    arg1Subtype.tupleTypeArguments.forEach((typeArg) => {
                        this._validateNotDataProtocol(typeArg.type, diag);
                    });
                }
                else {
                    this._validateNotDataProtocol(arg1Subtype, diag);
                }
            });
            if (!diag.isEmpty()) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataProtocolInSubclassCheck(), node.arguments[1]);
            }
        }
        // If this call is within an assert statement, we won't check whether
        // it's unnecessary.
        let curNode = node;
        while (curNode) {
            if (curNode.nodeType === 2 /* ParseNodeType.Assert */) {
                return;
            }
            curNode = curNode.parent;
        }
        // Several built-in classes don't follow the normal class hierarchy
        // rules, so we'll avoid emitting false-positive diagnostics if these
        // are used.
        const nonstandardClassTypes = [
            'FunctionType',
            'LambdaType',
            'BuiltinFunctionType',
            'BuiltinMethodType',
            'type',
            'Type',
        ];
        const classTypeList = [];
        let arg1IncludesSubclasses = false;
        (0, typeUtils_1.doForEachSubtype)(arg1Type, (arg1Subtype) => {
            if ((0, types_1.isClass)(arg1Subtype)) {
                if (types_1.TypeBase.isInstantiable(arg1Subtype)) {
                    if (arg1Subtype.literalValue === undefined) {
                        classTypeList.push(arg1Subtype);
                        if (types_1.ClassType.isBuiltIn(arg1Subtype) &&
                            nonstandardClassTypes.some((name) => name === arg1Subtype.details.name)) {
                            isValidType = false;
                        }
                        if (arg1Subtype.includeSubclasses) {
                            arg1IncludesSubclasses = true;
                        }
                    }
                    if (arg0Type) {
                        this._validateUnsafeProtocolOverlap(node.arguments[0].valueExpression, (0, typeUtils_1.convertToInstance)(arg1Subtype), isInstanceCheck ? arg0Type : (0, typeUtils_1.convertToInstance)(arg0Type));
                    }
                }
                else {
                    // The isinstance and issubclass call supports a variation where the second
                    // parameter is a tuple of classes.
                    if ((0, typeUtils_1.isTupleClass)(arg1Subtype)) {
                        if (arg1Subtype.tupleTypeArguments) {
                            arg1Subtype.tupleTypeArguments.forEach((typeArg) => {
                                if ((0, types_1.isInstantiableClass)(typeArg.type)) {
                                    classTypeList.push(typeArg.type);
                                    if (typeArg.type.includeSubclasses) {
                                        arg1IncludesSubclasses = true;
                                    }
                                    if (arg0Type) {
                                        this._validateUnsafeProtocolOverlap(node.arguments[0].valueExpression, (0, typeUtils_1.convertToInstance)(typeArg.type), isInstanceCheck ? arg0Type : (0, typeUtils_1.convertToInstance)(arg0Type));
                                    }
                                }
                                else {
                                    isValidType = false;
                                }
                            });
                        }
                    }
                    else {
                        if (arg1Subtype.includeSubclasses) {
                            arg1IncludesSubclasses = true;
                        }
                    }
                    if (types_1.ClassType.isBuiltIn(arg1Subtype) &&
                        nonstandardClassTypes.some((name) => name === arg1Subtype.details.name)) {
                        isValidType = false;
                    }
                }
            }
            else {
                isValidType = false;
            }
        });
        if (!isValidType) {
            return;
        }
        if ((0, typeUtils_1.derivesFromAnyOrUnknown)(arg0Type)) {
            return;
        }
        const finalizeFilteredTypeList = (types) => {
            return (0, types_1.combineTypes)(types);
        };
        const filterType = (varType) => {
            const filteredTypes = [];
            for (const filterType of classTypeList) {
                const filterIsSuperclass = (0, typeGuards_1.isIsinstanceFilterSuperclass)(this._evaluator, varType, varType, filterType, filterType, isInstanceCheck);
                const filterIsSubclass = (0, typeGuards_1.isIsinstanceFilterSubclass)(this._evaluator, varType, filterType, isInstanceCheck);
                // Normally, a class should never be both a subclass and a
                // superclass. However, this can happen if one of the classes
                // derives from an unknown type. In this case, we'll add an
                // unknown type into the filtered type list to avoid any
                // false positives.
                const isClassRelationshipIndeterminate = filterIsSuperclass && filterIsSubclass && !types_1.ClassType.isSameGenericClass(varType, filterType);
                if (isClassRelationshipIndeterminate) {
                    filteredTypes.push(types_1.UnknownType.create());
                }
                else if (filterIsSuperclass) {
                    // If the variable type is a subclass of the isinstance
                    // filter, we haven't learned anything new about the
                    // variable type.
                    filteredTypes.push(varType);
                }
                else if (filterIsSubclass) {
                    // If the variable type is a superclass of the isinstance
                    // filter, we can narrow the type to the subclass.
                    filteredTypes.push(filterType);
                }
            }
            if (!isInstanceCheck) {
                return filteredTypes;
            }
            // Make all instantiable classes into instances before returning them.
            return filteredTypes.map((t) => ((0, types_1.isInstantiableClass)(t) ? types_1.ClassType.cloneAsInstance(t) : t));
        };
        let filteredType;
        if (isInstanceCheck && (0, types_1.isClassInstance)(arg0Type)) {
            const remainingTypes = filterType(types_1.ClassType.cloneAsInstantiable(arg0Type));
            filteredType = finalizeFilteredTypeList(remainingTypes);
        }
        else if (!isInstanceCheck && (0, types_1.isInstantiableClass)(arg0Type)) {
            const remainingTypes = filterType(arg0Type);
            filteredType = finalizeFilteredTypeList(remainingTypes);
        }
        else if ((0, types_1.isUnion)(arg0Type)) {
            let remainingTypes = [];
            let foundAnyType = false;
            (0, typeUtils_1.doForEachSubtype)(arg0Type, (subtype) => {
                if ((0, types_1.isAnyOrUnknown)(subtype)) {
                    foundAnyType = true;
                }
                if (isInstanceCheck && (0, types_1.isClassInstance)(subtype)) {
                    remainingTypes = remainingTypes.concat(filterType(types_1.ClassType.cloneAsInstantiable(subtype)));
                }
                else if (!isInstanceCheck && (0, types_1.isInstantiableClass)(subtype)) {
                    remainingTypes = remainingTypes.concat(filterType(subtype));
                }
            });
            filteredType = finalizeFilteredTypeList(remainingTypes);
            // If we found an any or unknown type, all bets are off.
            if (foundAnyType) {
                return;
            }
        }
        else {
            return;
        }
        const getTestType = () => {
            const objTypeList = classTypeList.map((t) => types_1.ClassType.cloneAsInstance(t));
            return (0, types_1.combineTypes)(objTypeList);
        };
        // If arg1IncludesSubclasses is true, it contains a Type[X] class rather than X. A Type[X]
        // could be a subclass of X, so the "unnecessary isinstance check" may be legit.
        if (!arg1IncludesSubclasses && (0, types_1.isTypeSame)(filteredType, arg0Type, { ignorePseudoGeneric: true })) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnnecessaryIsInstance, isInstanceCheck
                ? localize_1.LocMessage.unnecessaryIsInstanceAlways().format({
                    testType: this._evaluator.printType(arg0Type),
                    classType: this._evaluator.printType(getTestType()),
                })
                : localize_1.LocMessage.unnecessaryIsSubclassAlways().format({
                    testType: this._evaluator.printType(arg0Type),
                    classType: this._evaluator.printType(getTestType()),
                }), node);
        }
    }
    _validateUnsafeProtocolOverlap(errorNode, protocol, testType) {
        // If this is a protocol class, check for an "unsafe overlap"
        // with the arg0 type.
        if (types_1.ClassType.isProtocolClass(protocol)) {
            let isUnsafeOverlap = false;
            const diag = new diagnostic_1.DiagnosticAddendum();
            (0, typeUtils_1.doForEachSubtype)(testType, (testSubtype) => {
                if ((0, types_1.isClassInstance)(testSubtype)) {
                    if ((0, protocols_1.isProtocolUnsafeOverlap)(this._evaluator, protocol, testSubtype)) {
                        isUnsafeOverlap = true;
                        diag.addMessage(localize_1.LocAddendum.protocolUnsafeOverlap().format({
                            name: testSubtype.details.name,
                        }));
                    }
                }
            });
            if (isUnsafeOverlap) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.protocolUnsafeOverlap().format({
                    name: protocol.details.name,
                }) + diag.getString(), errorNode);
            }
        }
    }
    // Determines whether the specified type is allowed as the second argument
    // to an isinstance or issubclass check.
    _isTypeSupportedTypeForIsInstance(type, isInstanceCheck, diag) {
        let isSupported = true;
        (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
            subtype = this._evaluator.makeTopLevelTypeVarsConcrete(subtype);
            subtype = (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(subtype);
            if (subtype.specialForm && types_1.ClassType.isBuiltIn(subtype.specialForm, 'TypeAliasType')) {
                diag.addMessage(localize_1.LocAddendum.typeAliasInstanceCheck());
                isSupported = false;
                return;
            }
            switch (subtype.category) {
                case 2 /* TypeCategory.Any */:
                case 1 /* TypeCategory.Unknown */:
                case 0 /* TypeCategory.Unbound */:
                    break;
                case 6 /* TypeCategory.Class */:
                    if (types_1.ClassType.isBuiltIn(subtype, 'TypedDict')) {
                        diag.addMessage(localize_1.LocAddendum.typedDictNotAllowed());
                        isSupported = false;
                    }
                    else if (types_1.ClassType.isBuiltIn(subtype, 'NamedTuple')) {
                        diag.addMessage(localize_1.LocAddendum.namedTupleNotAllowed());
                        isSupported = false;
                    }
                    else if ((0, typeUtils_1.isNoneInstance)(subtype)) {
                        diag.addMessage(localize_1.LocAddendum.noneNotAllowed());
                        isSupported = false;
                    }
                    else if (types_1.ClassType.isTypedDictClass(subtype)) {
                        diag.addMessage(localize_1.LocAddendum.typedDictClassNotAllowed());
                        isSupported = false;
                    }
                    else if (subtype.isTypeArgumentExplicit && !subtype.includeSubclasses) {
                        // If it's a class, make sure that it has not been given explicit
                        // type arguments. This will result in a TypeError exception.
                        diag.addMessage(localize_1.LocAddendum.genericClassNotAllowed());
                        isSupported = false;
                    }
                    else if (types_1.ClassType.isIllegalIsinstanceClass(subtype)) {
                        diag.addMessage(localize_1.LocAddendum.isinstanceClassNotSupported().format({ type: subtype.details.name }));
                        isSupported = false;
                    }
                    else if (types_1.ClassType.isProtocolClass(subtype) &&
                        !types_1.ClassType.isRuntimeCheckable(subtype) &&
                        !subtype.includeSubclasses) {
                        // According to PEP 544, protocol classes cannot be used as the right-hand
                        // argument to isinstance or issubclass unless they are annotated as
                        // "runtime checkable".
                        diag.addMessage(localize_1.LocAddendum.protocolRequiresRuntimeCheckable());
                        isSupported = false;
                    }
                    else if (types_1.ClassType.isNewTypeClass(subtype)) {
                        diag.addMessage(localize_1.LocAddendum.newTypeClassNotAllowed());
                        isSupported = false;
                    }
                    else if (subtype.specialForm &&
                        (0, types_1.isInstantiableClass)(subtype.specialForm) &&
                        types_1.ClassType.isBuiltIn(subtype.specialForm, 'Annotated')) {
                        diag.addMessage(localize_1.LocAddendum.annotatedNotAllowed());
                        isSupported = false;
                    }
                    break;
                case 4 /* TypeCategory.Function */:
                    if (!types_1.TypeBase.isInstantiable(subtype) || subtype.isCallableWithTypeArgs) {
                        diag.addMessage(localize_1.LocAddendum.genericClassNotAllowed());
                        isSupported = false;
                    }
                    break;
                case 9 /* TypeCategory.TypeVar */:
                    diag.addMessage(localize_1.LocAddendum.typeVarNotAllowed());
                    isSupported = false;
                    break;
            }
        });
        return isSupported;
    }
    _validateNotDataProtocol(type, diag) {
        if ((0, types_1.isInstantiableClass)(type) && types_1.ClassType.isProtocolClass(type) && !(0, protocols_1.isMethodOnlyProtocol)(type)) {
            diag.addMessage(localize_1.LocAddendum.dataProtocolUnsupported().format({
                name: type.details.name,
            }));
        }
    }
    _isSymbolPrivate(nameValue, scopeType) {
        // All variables within the scope of a function or a list
        // comprehension are considered private.
        if (scopeType === 2 /* ScopeType.Function */ || scopeType === 1 /* ScopeType.Comprehension */) {
            return true;
        }
        // See if the symbol is private.
        if (SymbolNameUtils.isPrivateName(nameValue)) {
            return true;
        }
        if (SymbolNameUtils.isProtectedName(nameValue)) {
            // Protected names outside of a class scope are considered private.
            const isClassScope = scopeType === 3 /* ScopeType.Class */;
            return !isClassScope;
        }
        return false;
    }
    _reportDeprecatedClassProperty(node, functionTypeResult) {
        if (!(0, types_1.isClassInstance)(functionTypeResult.decoratedType) ||
            !types_1.ClassType.isClassProperty(functionTypeResult.decoratedType)) {
            return;
        }
        this._reportDeprecatedDiagnostic(node.name, localize_1.LocMessage.classPropertyDeprecated());
    }
    _reportDeprecatedUseForMemberAccess(node, info) {
        let errorMessage;
        if (info.accessType === 'property') {
            if (info.accessMethod === 'get') {
                errorMessage = localize_1.LocMessage.deprecatedPropertyGetter().format({ name: node.value });
            }
            else if (info.accessMethod === 'set') {
                errorMessage = localize_1.LocMessage.deprecatedPropertySetter().format({ name: node.value });
            }
            else {
                errorMessage = localize_1.LocMessage.deprecatedPropertyDeleter().format({ name: node.value });
            }
        }
        else if (info.accessType === 'descriptor') {
            if (info.accessMethod === 'get') {
                errorMessage = localize_1.LocMessage.deprecatedDescriptorGetter().format({ name: node.value });
            }
            else if (info.accessMethod === 'set') {
                errorMessage = localize_1.LocMessage.deprecatedDescriptorSetter().format({ name: node.value });
            }
            else {
                errorMessage = localize_1.LocMessage.deprecatedDescriptorDeleter().format({ name: node.value });
            }
        }
        if (errorMessage) {
            this._reportDeprecatedDiagnostic(node, errorMessage, info.deprecationMessage);
        }
    }
    _reportDeprecatedUseForType(node, type, isImportFromTyping = false) {
        var _a, _b;
        if (!type) {
            return;
        }
        let errorMessage;
        let deprecatedMessage;
        function getDeprecatedMessageForFunction(functionType) {
            if (functionType.details.declaration &&
                functionType.details.declaration.node.nodeType === 31 /* ParseNodeType.Function */) {
                const containingClass = ParseTreeUtils.getEnclosingClass(functionType.details.declaration.node, 
                /* stopAtFunction */ true);
                if (containingClass) {
                    return localize_1.LocMessage.deprecatedMethod().format({
                        name: functionType.details.name || '<anonymous>',
                        className: containingClass.name.value,
                    });
                }
            }
            return localize_1.LocMessage.deprecatedFunction().format({
                name: functionType.details.name,
            });
        }
        function getDeprecatedMessageForOverloadedCall(evaluator, type) {
            // Determine if the node is part of a call expression. If so,
            // we can determine which overload(s) were used to satisfy
            // the call expression and determine whether any of them
            // are deprecated.
            let callTypeResult;
            const callNode = ParseTreeUtils.getCallForName(node);
            if (callNode) {
                callTypeResult = evaluator.getTypeResult(callNode);
            }
            else {
                const decoratorNode = ParseTreeUtils.getDecoratorForName(node);
                if (decoratorNode) {
                    callTypeResult = evaluator.getTypeResultForDecorator(decoratorNode);
                }
            }
            if (callTypeResult &&
                callTypeResult.overloadsUsedForCall &&
                callTypeResult.overloadsUsedForCall.length > 0) {
                callTypeResult.overloadsUsedForCall.forEach((overload) => {
                    if (overload.details.deprecatedMessage !== undefined) {
                        if (node.value === overload.details.name) {
                            deprecatedMessage = overload.details.deprecatedMessage;
                            errorMessage = getDeprecatedMessageForFunction(overload);
                        }
                        else if ((0, types_1.isInstantiableClass)(type) && overload.details.name === '__init__') {
                            deprecatedMessage = overload.details.deprecatedMessage;
                            errorMessage = localize_1.LocMessage.deprecatedConstructor().format({
                                name: type.details.name,
                            });
                        }
                        else if ((0, types_1.isClassInstance)(type) && overload.details.name === '__call__') {
                            deprecatedMessage = overload.details.deprecatedMessage;
                            errorMessage = localize_1.LocMessage.deprecatedFunction().format({
                                name: node.value,
                            });
                        }
                    }
                });
            }
        }
        (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
            if ((0, types_1.isClass)(subtype)) {
                if (!subtype.includeSubclasses &&
                    subtype.details.deprecatedMessage !== undefined &&
                    node.value === subtype.details.name) {
                    deprecatedMessage = subtype.details.deprecatedMessage;
                    errorMessage = localize_1.LocMessage.deprecatedClass().format({ name: subtype.details.name });
                    return;
                }
                getDeprecatedMessageForOverloadedCall(this._evaluator, subtype);
                return;
            }
            if ((0, types_1.isFunction)(subtype)) {
                if (subtype.details.deprecatedMessage !== undefined) {
                    if (!subtype.details.name ||
                        subtype.details.name === '__call__' ||
                        node.value === subtype.details.name) {
                        deprecatedMessage = subtype.details.deprecatedMessage;
                        errorMessage = getDeprecatedMessageForFunction(subtype);
                    }
                }
            }
            else if ((0, types_1.isOverloadedFunction)(subtype)) {
                // Determine if the node is part of a call expression. If so,
                // we can determine which overload(s) were used to satisfy
                // the call expression and determine whether any of them
                // are deprecated.
                getDeprecatedMessageForOverloadedCall(this._evaluator, subtype);
                // If there the implementation itself is deprecated, assume it
                // is deprecated even if it's outside of a call expression.
                const overloadImpl = types_1.OverloadedFunctionType.getImplementation(subtype);
                if ((overloadImpl === null || overloadImpl === void 0 ? void 0 : overloadImpl.details.deprecatedMessage) !== undefined) {
                    if (!overloadImpl.details.name || node.value === overloadImpl.details.name) {
                        deprecatedMessage = overloadImpl.details.deprecatedMessage;
                        errorMessage = getDeprecatedMessageForFunction(overloadImpl);
                    }
                }
            }
        });
        if (errorMessage) {
            this._reportDeprecatedDiagnostic(node, errorMessage, deprecatedMessage);
        }
        if (this._fileInfo.diagnosticRuleSet.deprecateTypingAliases) {
            const deprecatedForm = (_a = deprecatedSymbols_1.deprecatedAliases.get(node.value)) !== null && _a !== void 0 ? _a : deprecatedSymbols_1.deprecatedSpecialForms.get(node.value);
            if (deprecatedForm) {
                if (((0, types_1.isInstantiableClass)(type) && type.details.fullName === deprecatedForm.fullName) ||
                    ((_b = type.typeAliasInfo) === null || _b === void 0 ? void 0 : _b.fullName) === deprecatedForm.fullName) {
                    if (this._fileInfo.executionEnvironment.pythonVersion.isGreaterOrEqualTo(deprecatedForm.version)) {
                        if (!deprecatedForm.typingImportOnly || isImportFromTyping) {
                            if (this._fileInfo.diagnosticRuleSet.reportDeprecated === 'none') {
                                this._evaluator.addDeprecated(localize_1.LocMessage.deprecatedType().format({
                                    version: deprecatedForm.version.toString(),
                                    replacement: deprecatedForm.replacementText,
                                }), node);
                            }
                            else {
                                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportDeprecated, localize_1.LocMessage.deprecatedType().format({
                                    version: deprecatedForm.version.toString(),
                                    replacement: deprecatedForm.replacementText,
                                }), node);
                            }
                        }
                    }
                }
            }
        }
    }
    _reportDeprecatedDiagnostic(node, diagnosticMessage, deprecatedMessage) {
        const diag = new diagnostic_1.DiagnosticAddendum();
        if (deprecatedMessage) {
            diag.addMessage(deprecatedMessage);
        }
        if (this._fileInfo.diagnosticRuleSet.reportDeprecated === 'none') {
            this._evaluator.addDeprecated(diagnosticMessage + diag.getString(), node);
        }
        else {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportDeprecated, diagnosticMessage + diag.getString(), node);
        }
    }
    _reportUnboundName(node) {
        if (this._fileInfo.diagnosticRuleSet.reportUnboundVariable === 'none') {
            return;
        }
        if (!AnalyzerNodeInfo.isCodeUnreachable(node)) {
            const type = this._evaluator.getType(node);
            if (type) {
                if ((0, types_1.isUnbound)(type)) {
                    if (this._evaluator.isNodeReachable(node)) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnboundVariable, localize_1.LocMessage.symbolIsUnbound().format({ name: node.value }), node);
                    }
                }
                else if ((0, types_1.isPossiblyUnbound)(type)) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportPossiblyUnboundVariable, localize_1.LocMessage.symbolIsPossiblyUnbound().format({ name: node.value }), node);
                }
            }
        }
    }
    _conditionallyReportShadowedModule() {
        if (this._fileInfo.diagnosticRuleSet.reportShadowedImports === 'none') {
            return;
        }
        // Check the module we're in.
        const moduleName = this._fileInfo.moduleName;
        const desc = {
            nameParts: moduleName.split('.'),
            leadingDots: 0,
            importedSymbols: new Set(),
        };
        const stdlibPath = this._importResolver.getTypeshedStdLibPath(this._fileInfo.executionEnvironment);
        if (stdlibPath &&
            this._importResolver.isStdlibModule(desc, this._fileInfo.executionEnvironment) &&
            this._sourceMapper.isUserCode(this._fileInfo.fileUri)) {
            // This means the user has a module that is overwriting the stdlib module.
            const diag = this._evaluator.addDiagnosticForTextRange(this._fileInfo, diagnosticRules_1.DiagnosticRule.reportShadowedImports, localize_1.LocMessage.stdlibModuleOverridden().format({
                name: moduleName,
                path: this._fileInfo.fileUri.toUserVisibleString(),
            }), this._moduleNode);
            // Add a quick action that renames the file.
            if (diag) {
                const renameAction = {
                    action: "renameShadowedFile" /* ActionKind.RenameShadowedFileAction */,
                    oldUri: this._fileInfo.fileUri,
                    newUri: this._sourceMapper.getNextFileName(this._fileInfo.fileUri),
                };
                diag.addAction(renameAction);
            }
        }
    }
    _conditionallyReportShadowedImport(node) {
        var _a, _b;
        if (this._fileInfo.diagnosticRuleSet.reportShadowedImports === 'none') {
            return;
        }
        // Skip this check for relative imports.
        const nodeModule = node.nodeType === 26 /* ParseNodeType.ImportFromAs */
            ? ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 25 /* ParseNodeType.ImportFrom */
                ? (_b = node.parent) === null || _b === void 0 ? void 0 : _b.module
                : undefined
            : node.module;
        if (nodeModule === null || nodeModule === void 0 ? void 0 : nodeModule.leadingDots) {
            return;
        }
        // Otherwise use the name to determine if a match for a stdlib module.
        const namePartNodes = node.nodeType === 24 /* ParseNodeType.ImportAs */
            ? node.module.nameParts
            : node.nodeType === 26 /* ParseNodeType.ImportFromAs */
                ? [node.name]
                : node.module.nameParts;
        const nameParts = namePartNodes.map((n) => n.value);
        const module = {
            nameParts,
            leadingDots: 0,
            importedSymbols: new Set(),
        };
        // Make sure the module is a potential stdlib one so we don't spend the time
        // searching for the definition.
        const stdlibPath = this._importResolver.getTypeshedStdLibPath(this._fileInfo.executionEnvironment);
        if (stdlibPath && this._importResolver.isStdlibModule(module, this._fileInfo.executionEnvironment)) {
            // If the definition for this name is in 'user' module, it is overwriting the stdlib module.
            const definitions = definitionProvider_1.DefinitionProvider.getDefinitionsForNode(this._sourceMapper, this._evaluator, namePartNodes[namePartNodes.length - 1], namePartNodes[namePartNodes.length - 1].start, vscode_languageserver_1.CancellationToken.None);
            const paths = definitions ? definitions.map((d) => d.uri) : [];
            paths.forEach((p) => {
                if (!p.startsWith(stdlibPath) && !(0, sourceMapper_1.isStubFile)(p) && this._sourceMapper.isUserCode(p)) {
                    // This means the user has a module that is overwriting the stdlib module.
                    const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportShadowedImports, localize_1.LocMessage.stdlibModuleOverridden().format({
                        name: nameParts.join('.'),
                        path: p.toUserVisibleString(),
                    }), node);
                    // Add a quick action that renames the file.
                    if (diag) {
                        const renameAction = {
                            action: "renameShadowedFile" /* ActionKind.RenameShadowedFileAction */,
                            oldUri: p,
                            newUri: this._sourceMapper.getNextFileName(p),
                        };
                        diag.addAction(renameAction);
                    }
                }
            });
        }
    }
    _conditionallyReportPrivateUsage(node) {
        var _a, _b;
        if (this._fileInfo.diagnosticRuleSet.reportPrivateUsage === 'none') {
            return;
        }
        // Ignore privates in type stubs.
        if (this._fileInfo.isStubFile) {
            return;
        }
        // Ignore privates in named arguments.
        if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 1 /* ParseNodeType.Argument */ && node.parent.name === node) {
            return;
        }
        const nameValue = node.value;
        const isPrivateName = SymbolNameUtils.isPrivateName(nameValue);
        const isProtectedName = SymbolNameUtils.isProtectedName(nameValue);
        // If it's not a protected or private name, don't bother with
        // any further checks.
        if (!isPrivateName && !isProtectedName) {
            return;
        }
        // Get the declarations for this name node, but filter out
        // any variable declarations that are bound using nonlocal
        // or global explicit bindings.
        const declarations = (_b = this._evaluator
            .getDeclarationsForNameNode(node)) === null || _b === void 0 ? void 0 : _b.filter((decl) => decl.type !== 1 /* DeclarationType.Variable */ || !decl.isExplicitBinding);
        let primaryDeclaration = declarations && declarations.length > 0 ? declarations[declarations.length - 1] : undefined;
        if (!primaryDeclaration || primaryDeclaration.node === node) {
            return;
        }
        if (primaryDeclaration.type === 8 /* DeclarationType.Alias */) {
            // If this symbol is an import alias (i.e. it's a local name rather than the
            // original imported name), skip the private check.
            if (primaryDeclaration.usesLocalName) {
                return;
            }
            const resolvedAliasInfo = this._evaluator.resolveAliasDeclarationWithInfo(primaryDeclaration, 
            /* resolveLocalNames */ true);
            if (!resolvedAliasInfo) {
                return;
            }
            primaryDeclaration = resolvedAliasInfo.declaration;
            // If the alias resolved to a stub file or py.typed source file
            // and the declaration is marked "externally visible", it is
            // exempt from private usage checks.
            if (!resolvedAliasInfo.isPrivate) {
                return;
            }
        }
        if (!primaryDeclaration || primaryDeclaration.node === node) {
            return;
        }
        let classNode;
        if (primaryDeclaration.node) {
            classNode = ParseTreeUtils.getEnclosingClass(primaryDeclaration.node);
        }
        // If this is the name of a class, find the class that contains it rather
        // than constraining the use of the class name within the class itself.
        if (primaryDeclaration.node && primaryDeclaration.node.parent && primaryDeclaration.node.parent === classNode) {
            classNode = ParseTreeUtils.getEnclosingClass(classNode);
        }
        // If it's a class member, check whether it's a legal protected access.
        let isProtectedAccess = false;
        if (classNode) {
            if (isProtectedName) {
                const declClassTypeInfo = this._evaluator.getTypeOfClass(classNode);
                if (declClassTypeInfo && (0, types_1.isInstantiableClass)(declClassTypeInfo.decoratedType)) {
                    // If it's a member defined in a stub file, we'll assume that it's part
                    // of the public contract even if it's named as though it's private.
                    if (types_1.ClassType.isDefinedInStub(declClassTypeInfo.decoratedType)) {
                        return;
                    }
                    // Note that the access is to a protected class member.
                    isProtectedAccess = true;
                    const enclosingClassNode = ParseTreeUtils.getEnclosingClass(node);
                    if (enclosingClassNode) {
                        const enclosingClassTypeInfo = this._evaluator.getTypeOfClass(enclosingClassNode);
                        // If the referencing class is a subclass of the declaring class, it's
                        // allowed to access a protected name.
                        if (enclosingClassTypeInfo && (0, types_1.isInstantiableClass)(enclosingClassTypeInfo.decoratedType)) {
                            if ((0, typeUtils_1.derivesFromClassRecursive)(enclosingClassTypeInfo.decoratedType, declClassTypeInfo.decoratedType, 
                            /* ignoreUnknown */ true)) {
                                return;
                            }
                        }
                    }
                }
            }
        }
        if (classNode && !ParseTreeUtils.isNodeContainedWithin(node, classNode)) {
            if (isProtectedAccess) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportPrivateUsage, localize_1.LocMessage.protectedUsedOutsideOfClass().format({ name: nameValue }), node);
            }
            else {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportPrivateUsage, localize_1.LocMessage.privateUsedOutsideOfClass().format({ name: nameValue }), node);
            }
        }
    }
    // Validates that an enum class does not attempt to override another
    // enum class that has already defined values.
    _validateEnumClassOverride(node, classType) {
        classType.details.baseClasses.forEach((baseClass, index) => {
            if ((0, types_1.isClass)(baseClass) && (0, enums_1.isEnumClassWithMembers)(this._evaluator, baseClass)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.enumClassOverride().format({ name: baseClass.details.name }), node.arguments[index]);
            }
        });
    }
    // Verifies the rules specified in PEP 589 about TypedDict classes.
    // They cannot have statements other than type annotations, doc
    // strings, and "pass" statements or ellipses.
    _validateTypedDictClassSuite(suiteNode) {
        const emitBadStatementError = (node) => {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictBadVar(), node);
        };
        suiteNode.statements.forEach((statement) => {
            if (!AnalyzerNodeInfo.isCodeUnreachable(statement)) {
                if (statement.nodeType === 47 /* ParseNodeType.StatementList */) {
                    for (const substatement of statement.statements) {
                        if (substatement.nodeType !== 54 /* ParseNodeType.TypeAnnotation */ &&
                            substatement.nodeType !== 21 /* ParseNodeType.Ellipsis */ &&
                            substatement.nodeType !== 48 /* ParseNodeType.StringList */ &&
                            substatement.nodeType !== 42 /* ParseNodeType.Pass */) {
                            emitBadStatementError(substatement);
                        }
                    }
                }
                else {
                    emitBadStatementError(statement);
                }
            }
        });
    }
    _validateTypeGuardFunction(node, functionType, isMethod) {
        var _a;
        const returnType = functionType.details.declaredReturnType;
        if (!returnType) {
            return;
        }
        if (!(0, types_1.isClassInstance)(returnType) || !returnType.typeArguments || returnType.typeArguments.length < 1) {
            return;
        }
        const isTypeGuard = types_1.ClassType.isBuiltIn(returnType, 'TypeGuard');
        const isTypeIs = types_1.ClassType.isBuiltIn(returnType, 'TypeIs');
        if (!isTypeGuard && !isTypeIs) {
            return;
        }
        // Make sure there's at least one input parameter provided.
        let paramCount = functionType.details.parameters.length;
        if (isMethod) {
            if (types_1.FunctionType.isInstanceMethod(functionType) ||
                types_1.FunctionType.isConstructorMethod(functionType) ||
                types_1.FunctionType.isClassMethod(functionType)) {
                paramCount--;
            }
        }
        if (paramCount < 1) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typeGuardParamCount(), node.name);
        }
        if (isTypeIs) {
            const typeGuardType = returnType.typeArguments[0];
            // Determine the type of the first parameter.
            const paramIndex = isMethod && !types_1.FunctionType.isStaticMethod(functionType) ? 1 : 0;
            if (paramIndex >= functionType.details.parameters.length) {
                return;
            }
            const paramType = types_1.FunctionType.getEffectiveParameterType(functionType, paramIndex);
            // Verify that the typeGuardType is a narrower type than the paramType.
            if (!this._evaluator.assignType(paramType, typeGuardType)) {
                const returnAnnotation = node.returnTypeAnnotation || ((_a = node.functionAnnotationComment) === null || _a === void 0 ? void 0 : _a.returnTypeAnnotation);
                if (returnAnnotation) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typeIsReturnType().format({
                        type: this._evaluator.printType(paramType),
                        returnType: this._evaluator.printType(typeGuardType),
                    }), returnAnnotation);
                }
            }
        }
    }
    _validateDunderSignatures(node, functionType, isMethod) {
        var _a;
        const functionName = functionType.details.name;
        // Is this an '__init__' method? Verify that it returns None.
        if (isMethod && functionName === '__init__') {
            const returnAnnotation = node.returnTypeAnnotation || ((_a = node.functionAnnotationComment) === null || _a === void 0 ? void 0 : _a.returnTypeAnnotation);
            const declaredReturnType = functionType.details.declaredReturnType;
            if (returnAnnotation && declaredReturnType) {
                if (!(0, typeUtils_1.isNoneInstance)(declaredReturnType) && !(0, types_1.isNever)(declaredReturnType)) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.initMustReturnNone(), returnAnnotation);
                }
            }
            else {
                const inferredReturnType = this._evaluator.getFunctionInferredReturnType(functionType);
                if (!(0, types_1.isNever)(inferredReturnType) &&
                    !(0, typeUtils_1.isNoneInstance)(inferredReturnType) &&
                    !(0, types_1.isAnyOrUnknown)(inferredReturnType)) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.initMustReturnNone(), node.name);
                }
            }
        }
    }
    _validateFunctionReturn(node, functionType) {
        var _a;
        // Stub files are allowed not to return an actual value,
        // so skip this if it's a stub file.
        if (this._fileInfo.isStubFile) {
            return;
        }
        const returnAnnotation = node.returnTypeAnnotation || ((_a = node.functionAnnotationComment) === null || _a === void 0 ? void 0 : _a.returnTypeAnnotation);
        if (returnAnnotation) {
            const functionNeverReturns = !this._evaluator.isAfterNodeReachable(node);
            const implicitlyReturnsNone = this._evaluator.isAfterNodeReachable(node.suite);
            let declaredReturnType = functionType.details.declaredReturnType;
            if (declaredReturnType) {
                this._reportUnknownReturnResult(node, declaredReturnType);
                this._validateReturnTypeIsNotContravariant(declaredReturnType, returnAnnotation);
            }
            // Wrap the declared type in a generator type if the function is a generator.
            if (types_1.FunctionType.isGenerator(functionType)) {
                declaredReturnType = (0, typeUtils_1.getDeclaredGeneratorReturnType)(functionType);
            }
            // The types of all return statement expressions were already checked
            // against the declared type, but we need to verify the implicit None
            // at the end of the function.
            if (declaredReturnType && !functionNeverReturns && implicitlyReturnsNone) {
                if ((0, types_1.isNever)(declaredReturnType)) {
                    // If the function consists entirely of "...", assume that it's
                    // an abstract method or a protocol method and don't require that
                    // the return type matches. This check can also be skipped for an overload.
                    if (!ParseTreeUtils.isSuiteEmpty(node.suite) &&
                        !types_1.FunctionType.isOverloaded(functionType) &&
                        !types_1.FunctionType.isAsync(functionType)) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportReturnType, localize_1.LocMessage.noReturnReturnsNone(), returnAnnotation);
                    }
                }
                else if (!types_1.FunctionType.isAbstractMethod(functionType)) {
                    // Make sure that the function doesn't implicitly return None if the declared
                    // type doesn't allow it. Skip this check for abstract methods.
                    const diagAddendum = new diagnostic_1.DiagnosticAddendum();
                    // If the declared type isn't compatible with 'None', flag an error.
                    if (!this._evaluator.assignType(declaredReturnType, this._evaluator.getNoneType(), diagAddendum)) {
                        // If the function consists entirely of "...", assume that it's
                        // an abstract method or a protocol method and don't require that
                        // the return type matches. This check can also be skipped for an overload.
                        if (!ParseTreeUtils.isSuiteEmpty(node.suite) && !types_1.FunctionType.isOverloaded(functionType)) {
                            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportReturnType, localize_1.LocMessage.returnMissing().format({
                                returnType: this._evaluator.printType(declaredReturnType),
                            }) + diagAddendum.getString(), returnAnnotation);
                        }
                    }
                }
            }
        }
        else {
            const inferredReturnType = this._evaluator.getFunctionInferredReturnType(functionType);
            this._reportUnknownReturnResult(node, inferredReturnType);
            this._validateReturnTypeIsNotContravariant(inferredReturnType, node.name);
        }
    }
    _validateReturnTypeIsNotContravariant(returnType, errorNode) {
        let isContraTypeVar = false;
        (0, typeUtils_1.doForEachSubtype)(returnType, (subtype) => {
            if ((0, types_1.isTypeVar)(subtype) &&
                subtype.details.declaredVariance === 4 /* Variance.Contravariant */ &&
                subtype.scopeType === 0 /* TypeVarScopeType.Class */) {
                isContraTypeVar = true;
            }
        });
        if (isContraTypeVar) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.returnTypeContravariant(), errorNode);
        }
    }
    _reportUnknownReturnResult(node, returnType) {
        if ((0, types_1.isUnknown)(returnType)) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownParameterType, localize_1.LocMessage.returnTypeUnknown(), node.name);
        }
        else if ((0, typeUtils_1.isPartlyUnknown)(returnType)) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnknownParameterType, localize_1.LocMessage.returnTypePartiallyUnknown().format({
                returnType: this._evaluator.printType(returnType, { expandTypeAlias: true }),
            }), node.name);
        }
    }
    // Validates that any overridden member variables are not marked
    // as Final in parent classes.
    _validateFinalMemberOverrides(classType) {
        types_1.ClassType.getSymbolTable(classType).forEach((localSymbol, name) => {
            const parentSymbol = (0, typeUtils_1.lookUpClassMember)(classType, name, 1 /* MemberAccessFlags.SkipOriginalClass */);
            if (parentSymbol && (0, types_1.isInstantiableClass)(parentSymbol.classType) && !SymbolNameUtils.isPrivateName(name)) {
                // Did the parent class explicitly declare the variable as final?
                if (this._evaluator.isFinalVariable(parentSymbol.symbol)) {
                    const decl = localSymbol.getDeclarations()[0];
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.finalRedeclarationBySubclass().format({
                        name,
                        className: parentSymbol.classType.details.name,
                    }), decl.node);
                }
                else if (types_1.ClassType.isReadOnlyInstanceVariables(parentSymbol.classType) &&
                    !SymbolNameUtils.isDunderName(name)) {
                    // If the parent class is a named tuple, all instance variables
                    // (other than dundered ones) are implicitly final.
                    const decl = localSymbol.getDeclarations()[0];
                    if (decl.type === 1 /* DeclarationType.Variable */) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.namedTupleEntryRedeclared().format({
                            name,
                            className: parentSymbol.classType.details.name,
                        }), decl.node);
                    }
                }
            }
        });
    }
    // Validates that the values associated with enum members are type compatible.
    // Also looks for duplicate values.
    _validateEnumMembers(classType, node) {
        if (!types_1.ClassType.isEnumClass(classType) || types_1.ClassType.isBuiltIn(classType)) {
            return;
        }
        // Does the "_value_" field have a declared type? If so, we'll enforce it.
        const declaredValueType = (0, enums_1.getEnumDeclaredValueType)(this._evaluator, classType, /* declaredTypesOnly */ true);
        // Is there a custom "__new__" and/or "__init__" method? If so, we'll
        // verify that the signature of these calls is compatible with the values.
        let newMemberTypeResult = (0, constructors_1.getBoundNewMethod)(this._evaluator, node.name, classType, 
        /* diag */ undefined, 4 /* MemberAccessFlags.SkipObjectBaseClass */);
        // If this __new__ comes from a built-in class like Enum, we'll ignore it.
        if (newMemberTypeResult === null || newMemberTypeResult === void 0 ? void 0 : newMemberTypeResult.classType) {
            if ((0, types_1.isClass)(newMemberTypeResult.classType) && types_1.ClassType.isBuiltIn(newMemberTypeResult.classType)) {
                newMemberTypeResult = undefined;
            }
        }
        let initMemberTypeResult = (0, constructors_1.getBoundInitMethod)(this._evaluator, node.name, types_1.ClassType.cloneAsInstance(classType), 
        /* diag */ undefined, 4 /* MemberAccessFlags.SkipObjectBaseClass */);
        // If this __init__ comes from a built-in class like Enum, we'll ignore it.
        if (initMemberTypeResult === null || initMemberTypeResult === void 0 ? void 0 : initMemberTypeResult.classType) {
            if ((0, types_1.isClass)(initMemberTypeResult.classType) && types_1.ClassType.isBuiltIn(initMemberTypeResult.classType)) {
                initMemberTypeResult = undefined;
            }
        }
        types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
            var _a;
            // Determine whether this is an enum member. We ignore the presence
            // of an annotation in this case because the runtime does. From a
            // type checking perspective, if the runtime treats the assignment
            // as an enum member but there is a type annotation present, it is
            // considered a type checking error.
            const symbolType = (0, enums_1.transformTypeForEnumMember)(this._evaluator, classType, name, 
            /* ignoreAnnotation */ true);
            // Is this symbol a literal instance of the enum class?
            if (!symbolType ||
                !(0, types_1.isClassInstance)(symbolType) ||
                !types_1.ClassType.isSameGenericClass(symbolType, classType) ||
                !(symbolType.literalValue instanceof types_1.EnumLiteral)) {
                return;
            }
            // Enum members should not have type annotations.
            const typedDecls = symbol.getTypedDeclarations();
            if (typedDecls.length > 0) {
                if (typedDecls[0].type === 1 /* DeclarationType.Variable */ && typedDecls[0].inferredTypeSource) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.enumMemberTypeAnnotation(), typedDecls[0].node);
                }
                return;
            }
            // Look for a duplicate assignment.
            const decls = symbol.getDeclarations();
            if (decls.length >= 2 && decls[0].type === 1 /* DeclarationType.Variable */) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.duplicateEnumMember().format({ name }), decls[1].node);
                return;
            }
            if (decls[0].type !== 1 /* DeclarationType.Variable */) {
                return;
            }
            const declNode = decls[0].node;
            const assignedValueType = symbolType.literalValue.itemType;
            const assignmentNode = ParseTreeUtils.getParentNodeOfType(declNode, 3 /* ParseNodeType.Assignment */);
            const errorNode = (_a = assignmentNode === null || assignmentNode === void 0 ? void 0 : assignmentNode.rightExpression) !== null && _a !== void 0 ? _a : declNode;
            // Validate the __new__ and __init__ methods if present.
            if (newMemberTypeResult || initMemberTypeResult) {
                if (!(0, types_1.isAnyOrUnknown)(assignedValueType)) {
                    // Construct an argument list. If the assigned type is a tuple, we'll
                    // unpack it. Otherwise, only one argument is passed.
                    const argList = [
                        {
                            argumentCategory: (0, types_1.isClassInstance)(assignedValueType) && (0, typeUtils_1.isTupleClass)(assignedValueType)
                                ? 1 /* ArgumentCategory.UnpackedList */
                                : 0 /* ArgumentCategory.Simple */,
                            typeResult: { type: assignedValueType },
                        },
                    ];
                    if (newMemberTypeResult) {
                        this._evaluator.validateCallArguments(errorNode, argList, newMemberTypeResult, 
                        /* typeVarContext */ undefined, 
                        /* skipUnknownArgCheck */ undefined, 
                        /* inferenceContext */ undefined, 
                        /* signatureTracker */ undefined);
                    }
                    if (initMemberTypeResult) {
                        this._evaluator.validateCallArguments(errorNode, argList, initMemberTypeResult, 
                        /* typeVarContext */ undefined, 
                        /* skipUnknownArgCheck */ undefined, 
                        /* inferenceContext */ undefined, 
                        /* signatureTracker */ undefined);
                    }
                }
            }
            else if (declaredValueType) {
                const diag = new diagnostic_1.DiagnosticAddendum();
                // If the assigned value is already an instance of this enum class, skip this check.
                if (!(0, types_1.isClassInstance)(assignedValueType) ||
                    !types_1.ClassType.isSameGenericClass(assignedValueType, classType)) {
                    if (!this._evaluator.assignType(declaredValueType, assignedValueType, diag)) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportAssignmentType, localize_1.LocMessage.typeAssignmentMismatch().format(this._evaluator.printSrcDestTypes(assignedValueType, declaredValueType)) + diag.getString(), errorNode);
                    }
                }
            }
        });
    }
    // If a class is a dataclass with a `__post_init__` method, verify that its
    // signature is correct.
    _validateDataClassPostInit(classType, errorNode) {
        if (!types_1.ClassType.isDataClass(classType)) {
            return;
        }
        const postInitMember = (0, typeUtils_1.lookUpClassMember)(classType, '__post_init__', 2 /* MemberAccessFlags.SkipBaseClasses */ | 64 /* MemberAccessFlags.DeclaredTypesOnly */);
        // If there's no __post_init__ method, there's nothing to check.
        if (!postInitMember) {
            return;
        }
        // If the class derives from Any, we can't reliably apply the check.
        if (types_1.ClassType.derivesFromAnyOrUnknown(classType)) {
            return;
        }
        // Collect the list of init-only variables in the order they were declared.
        const initOnlySymbolMap = new Map();
        types_1.ClassType.getReverseMro(classType).forEach((mroClass) => {
            if ((0, types_1.isClass)(mroClass) && types_1.ClassType.isDataClass(mroClass)) {
                types_1.ClassType.getSymbolTable(mroClass).forEach((symbol, name) => {
                    if (symbol.isInitVar()) {
                        initOnlySymbolMap.set(name, symbol);
                    }
                });
            }
        });
        const postInitType = this._evaluator.getTypeOfMember(postInitMember);
        if (!(0, types_1.isFunction)(postInitType) ||
            !types_1.FunctionType.isInstanceMethod(postInitType) ||
            !postInitType.details.declaration) {
            return;
        }
        const paramListDetails = (0, parameterUtils_1.getParameterListDetails)(postInitType);
        // If there is an *args or **kwargs parameter or a keyword-only separator,
        // don't bother checking.
        if (paramListDetails.argsIndex !== undefined ||
            paramListDetails.kwargsIndex !== undefined ||
            paramListDetails.firstKeywordOnlyIndex !== undefined) {
            return;
        }
        // Verify that the parameter count matches.
        const nonDefaultParams = paramListDetails.params.filter((paramInfo) => !paramInfo.param.hasDefault);
        // We expect to see one param for "self" plus one for each of the InitVars.
        const expectedParamCount = initOnlySymbolMap.size + 1;
        if (expectedParamCount < nonDefaultParams.length || expectedParamCount > paramListDetails.params.length) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassPostInitParamCount().format({ expected: initOnlySymbolMap.size }), postInitType.details.declaration.node.name);
        }
        // Verify that the parameter types match.
        let paramIndex = 1;
        initOnlySymbolMap.forEach((symbol, fieldName) => {
            var _a;
            if (paramIndex >= paramListDetails.params.length) {
                return;
            }
            const param = paramListDetails.params[paramIndex].param;
            if (param.hasDeclaredType && param.typeAnnotation) {
                const fieldType = (_a = this._evaluator.getDeclaredTypeOfSymbol(symbol)) === null || _a === void 0 ? void 0 : _a.type;
                const paramType = types_1.FunctionType.getEffectiveParameterType(postInitType, paramListDetails.params[paramIndex].index);
                const assignTypeDiag = new diagnostic_1.DiagnosticAddendum();
                if (fieldType && !this._evaluator.assignType(paramType, fieldType, assignTypeDiag)) {
                    const diagnostic = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.dataClassPostInitType().format({ fieldName }) + assignTypeDiag.getString(), param.typeAnnotation);
                    if (diagnostic) {
                        const fieldDecls = symbol.getTypedDeclarations();
                        if (fieldDecls.length > 0) {
                            diagnostic.addRelatedInfo(localize_1.LocAddendum.dataClassFieldLocation(), fieldDecls[0].uri, fieldDecls[0].range);
                        }
                    }
                }
            }
            paramIndex++;
        });
    }
    // If a class is marked final, it must implement all abstract methods,
    // otherwise it is of no use.
    _validateFinalClassNotAbstract(classType, errorNode) {
        if (!types_1.ClassType.isFinal(classType)) {
            return;
        }
        if (!types_1.ClassType.supportsAbstractMethods(classType)) {
            return;
        }
        const abstractSymbols = this._evaluator.getAbstractSymbols(classType);
        if (abstractSymbols.length === 0) {
            return;
        }
        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
        const errorsToDisplay = 2;
        abstractSymbols.forEach((abstractMethod, index) => {
            if (index === errorsToDisplay) {
                diagAddendum.addMessage(localize_1.LocAddendum.memberIsAbstractMore().format({
                    count: abstractSymbols.length - errorsToDisplay,
                }));
            }
            else if (index < errorsToDisplay) {
                if ((0, types_1.isInstantiableClass)(abstractMethod.classType)) {
                    const className = abstractMethod.classType.details.name;
                    diagAddendum.addMessage(localize_1.LocAddendum.memberIsAbstract().format({
                        type: className,
                        name: abstractMethod.symbolName,
                    }));
                }
            }
        });
        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.finalClassIsAbstract().format({
            type: classType.details.name,
        }) + diagAddendum.getString(), errorNode.name);
    }
    // Reports the case where an instance variable is not declared or initialized
    // within the class body or constructor method.
    _validateInstanceVariableInitialization(node, classType) {
        // This check doesn't apply to stub files.
        if (this._fileInfo.isStubFile) {
            return;
        }
        // This check can be expensive, so don't perform it if the corresponding
        // rule is disabled.
        if (this._fileInfo.diagnosticRuleSet.reportUninitializedInstanceVariable === 'none') {
            return;
        }
        // Protocol classes and ABCs are exempted from this check unless they are
        // marked @final.
        if (types_1.ClassType.isProtocolClass(classType) ||
            (types_1.ClassType.supportsAbstractMethods(classType) && !types_1.ClassType.isFinal(classType))) {
            return;
        }
        // If the class is final, see if it has any abstract base classes that define
        // variables. We need to make sure these are initialized.
        const abstractSymbols = new Map();
        if (types_1.ClassType.isFinal(classType)) {
            (0, typeUtils_1.getProtocolSymbolsRecursive)(classType, abstractSymbols, 64 /* ClassTypeFlags.SupportsAbstractMethods */);
        }
        // If this is a dataclass, get all of the entries so we can tell which
        // ones are initialized by the synthesized __init__ method.
        const dataClassEntries = [];
        if (types_1.ClassType.isDataClass(classType)) {
            (0, dataClasses_1.addInheritedDataClassEntries)(classType, dataClassEntries);
        }
        types_1.ClassType.getSymbolTable(classType).forEach((localSymbol, name) => {
            abstractSymbols.delete(name);
            // This applies only to instance members.
            if (!localSymbol.isInstanceMember()) {
                return;
            }
            const decls = localSymbol.getDeclarations();
            // If the symbol is assigned (or at least declared) within the
            // class body or within the __init__ method, it can be ignored.
            if (decls.find((decl) => {
                var _a, _b, _c;
                const containingClass = ParseTreeUtils.getEnclosingClassOrFunction(decl.node);
                if (!containingClass) {
                    return true;
                }
                if (containingClass.nodeType === 10 /* ParseNodeType.Class */) {
                    // If this is part of an assignment statement, assume it has been
                    // initialized as a class variable.
                    if (((_a = decl.node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 3 /* ParseNodeType.Assignment */) {
                        return true;
                    }
                    if (((_b = decl.node.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 54 /* ParseNodeType.TypeAnnotation */ &&
                        ((_c = decl.node.parent.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 3 /* ParseNodeType.Assignment */) {
                        return true;
                    }
                    // If this is part of a dataclass, a class handled by a dataclass_transform,
                    // or a NamedTuple, exempt it because the class variable will be transformed
                    // into an instance variable in this case.
                    if (types_1.ClassType.isDataClass(classType) || types_1.ClassType.isReadOnlyInstanceVariables(classType)) {
                        return true;
                    }
                    // If this is part of a TypedDict, exempt it because the class variables
                    // are not actually class variables in a TypedDict.
                    if (types_1.ClassType.isTypedDictClass(classType)) {
                        return true;
                    }
                }
                if (containingClass.name.value === '__init__') {
                    return true;
                }
                return false;
            })) {
                return;
            }
            // If the symbol is declared by its parent, we can assume it
            // is initialized there.
            const parentSymbol = (0, typeUtils_1.lookUpClassMember)(classType, name, 1 /* MemberAccessFlags.SkipOriginalClass */);
            if (parentSymbol) {
                return;
            }
            // Report the variable as uninitialized only on the first decl.
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUninitializedInstanceVariable, localize_1.LocMessage.uninitializedInstanceVariable().format({ name: name }), decls[0].node);
        });
        // See if there are any variables from abstract base classes
        // that are not initialized.
        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
        abstractSymbols.forEach((member, name) => {
            const decls = member.symbol.getDeclarations();
            if (decls.length === 0 || !(0, types_1.isClass)(member.classType)) {
                return;
            }
            if (decls[0].type !== 1 /* DeclarationType.Variable */) {
                return;
            }
            // Dataclass fields are typically exempted from this check because
            // they have synthesized __init__ methods that initialize these variables.
            const dcEntry = dataClassEntries === null || dataClassEntries === void 0 ? void 0 : dataClassEntries.find((entry) => entry.name === name);
            if (dcEntry) {
                if (dcEntry.includeInInit) {
                    return;
                }
            }
            else {
                // Do one or more declarations involve assignments?
                if (decls.some((decl) => decl.type === 1 /* DeclarationType.Variable */ && !!decl.inferredTypeSource)) {
                    return;
                }
            }
            diagAddendum.addMessage(localize_1.LocAddendum.uninitializedAbstractVariable().format({
                name,
                classType: member.classType.details.name,
            }));
        });
        if (!diagAddendum.isEmpty()) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUninitializedInstanceVariable, localize_1.LocMessage.uninitializedAbstractVariables().format({ classType: classType.details.name }) +
                diagAddendum.getString(), node.name);
        }
    }
    // Validates that the type variables used in a generic protocol class have
    // the proper variance (invariant, covariant, contravariant). See PEP 544
    // for an explanation for why this is important to enforce.
    _validateProtocolTypeParamVariance(errorNode, classType) {
        // If this protocol has no TypeVars with specified variance, there's nothing to do here.
        if (classType.details.typeParameters.length === 0) {
            return;
        }
        const objectType = this._evaluator.getBuiltInType(errorNode, 'object');
        if (!(0, types_1.isInstantiableClass)(objectType)) {
            return;
        }
        const objectObject = types_1.ClassType.cloneAsInstance(objectType);
        const dummyTypeObject = types_1.ClassType.createInstantiable('__varianceDummy', '', '', uri_1.Uri.empty(), 0, 0, undefined, undefined);
        classType.details.typeParameters.forEach((param, paramIndex) => {
            // Skip variadics and ParamSpecs.
            if (param.details.isVariadic || param.details.isParamSpec) {
                return;
            }
            // Skip type variables with auto-variance.
            if (param.details.declaredVariance === 0 /* Variance.Auto */) {
                return;
            }
            // Replace all type arguments with a dummy type except for the
            // TypeVar of interest, which is replaced with an object instance.
            const srcTypeArgs = classType.details.typeParameters.map((p, i) => {
                if (p.details.isVariadic) {
                    return p;
                }
                return i === paramIndex ? objectObject : dummyTypeObject;
            });
            // Replace all type arguments with a dummy type except for the
            // TypeVar of interest, which is replaced with itself.
            const destTypeArgs = classType.details.typeParameters.map((p, i) => {
                return i === paramIndex || p.details.isVariadic ? p : dummyTypeObject;
            });
            const srcType = types_1.ClassType.cloneForSpecialization(classType, srcTypeArgs, /* isTypeArgumentExplicit */ true);
            const destType = types_1.ClassType.cloneForSpecialization(classType, destTypeArgs, 
            /* isTypeArgumentExplicit */ true);
            const isDestSubtypeOfSrc = this._evaluator.assignClassToSelf(srcType, destType, 3 /* Variance.Covariant */);
            let expectedVariance;
            if (isDestSubtypeOfSrc) {
                expectedVariance = 3 /* Variance.Covariant */;
            }
            else {
                const isSrcSubtypeOfDest = this._evaluator.assignClassToSelf(destType, srcType, 4 /* Variance.Contravariant */);
                if (isSrcSubtypeOfDest) {
                    expectedVariance = 4 /* Variance.Contravariant */;
                }
                else {
                    expectedVariance = 2 /* Variance.Invariant */;
                }
            }
            if (expectedVariance !== classType.details.typeParameters[paramIndex].details.declaredVariance) {
                let message;
                if (expectedVariance === 3 /* Variance.Covariant */) {
                    message = localize_1.LocMessage.protocolVarianceCovariant().format({
                        variable: param.details.name,
                        class: classType.details.name,
                    });
                }
                else if (expectedVariance === 4 /* Variance.Contravariant */) {
                    message = localize_1.LocMessage.protocolVarianceContravariant().format({
                        variable: param.details.name,
                        class: classType.details.name,
                    });
                }
                else {
                    message = localize_1.LocMessage.protocolVarianceInvariant().format({
                        variable: param.details.name,
                        class: classType.details.name,
                    });
                }
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeVarUse, message, errorNode.name);
            }
        });
    }
    // Validates that a class variable doesn't conflict with a __slots__
    // name. This will generate a runtime exception.
    _validateSlotsClassVarConflict(classType) {
        if (!classType.details.localSlotsNames) {
            // Nothing to check, since this class doesn't use __slots__.
            return;
        }
        // Don't apply this for dataclasses because their class variables
        // are transformed into instance variables.
        if (types_1.ClassType.isDataClass(classType)) {
            return;
        }
        types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
            const decls = symbol.getDeclarations();
            const isDefinedBySlots = decls.some((decl) => decl.type === 1 /* DeclarationType.Variable */ && decl.isDefinedBySlots);
            if (isDefinedBySlots) {
                decls.forEach((decl) => {
                    if (decl.type === 1 /* DeclarationType.Variable */ &&
                        !decl.isDefinedBySlots &&
                        !decl.isDefinedByMemberAccess) {
                        if (decl.node.nodeType === 38 /* ParseNodeType.Name */ && ParseTreeUtils.isWriteAccess(decl.node)) {
                            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.slotsClassVarConflict().format({ name }), decl.node);
                        }
                    }
                });
            }
        });
    }
    // Validates that the __init__ and __new__ method signatures are consistent.
    _validateConstructorConsistency(classType, errorNode) {
        // If the class has a custom metaclass with a __call__ method, skip this check.
        const callMethodResult = (0, constructors_1.getBoundCallMethod)(this._evaluator, errorNode, classType);
        if (callMethodResult) {
            return;
        }
        const newMethodResult = (0, constructors_1.getBoundNewMethod)(this._evaluator, errorNode, classType);
        if (!newMethodResult ||
            newMethodResult.typeErrors ||
            !newMethodResult.classType ||
            !(0, types_1.isClass)(newMethodResult.classType)) {
            return;
        }
        const initMethodResult = (0, constructors_1.getBoundInitMethod)(this._evaluator, errorNode, types_1.ClassType.cloneAsInstance(classType));
        if (!initMethodResult ||
            initMethodResult.typeErrors ||
            !initMethodResult.classType ||
            !(0, types_1.isClass)(initMethodResult.classType)) {
            return;
        }
        // If both the __new__ and __init__ come from subclasses, don't bother
        // checking for this class.
        if (!types_1.ClassType.isSameGenericClass(initMethodResult.classType, classType) &&
            !types_1.ClassType.isSameGenericClass(newMethodResult.classType, classType)) {
            return;
        }
        let newMemberType = newMethodResult.type;
        if (!(0, types_1.isFunction)(newMemberType) && !(0, types_1.isOverloadedFunction)(newMemberType)) {
            return;
        }
        if ((0, types_1.isOverloadedFunction)(newMemberType)) {
            // Find the implementation, not the overloaded signatures.
            newMemberType = types_1.OverloadedFunctionType.getImplementation(newMemberType);
            if (!newMemberType) {
                return;
            }
        }
        let initMemberType = initMethodResult.type;
        if (!(0, types_1.isFunction)(initMemberType) && !(0, types_1.isOverloadedFunction)(initMemberType)) {
            return;
        }
        if ((0, types_1.isOverloadedFunction)(initMemberType)) {
            // Find the implementation, not the overloaded signatures.
            initMemberType = types_1.OverloadedFunctionType.getImplementation(initMemberType);
            if (!initMemberType) {
                return;
            }
        }
        // If either of the functions has a default parameter signature
        // (* args: Any, ** kwargs: Any), don't proceed with the check.
        if (types_1.FunctionType.hasDefaultParameters(initMemberType) || types_1.FunctionType.hasDefaultParameters(newMemberType)) {
            return;
        }
        // We'll set the "SkipArgsKwargs" flag for pragmatic reasons since __new__
        // often has an *args and/or **kwargs. We'll also set the ParamSpecValue
        // because we don't care about the return type for this check.
        initMemberType = types_1.FunctionType.cloneWithNewFlags(initMemberType, initMemberType.details.flags | 32768 /* FunctionTypeFlags.GradualCallableForm */ | 65536 /* FunctionTypeFlags.ParamSpecValue */);
        newMemberType = types_1.FunctionType.cloneWithNewFlags(newMemberType, initMemberType.details.flags | 32768 /* FunctionTypeFlags.GradualCallableForm */ | 65536 /* FunctionTypeFlags.ParamSpecValue */);
        if (!this._evaluator.assignType(newMemberType, initMemberType, 
        /* diag */ undefined, 
        /* destTypeVarContext */ undefined, 
        /* srcTypeVarContext */ undefined, 64 /* AssignTypeFlags.SkipFunctionReturnTypeCheck */) ||
            !this._evaluator.assignType(initMemberType, newMemberType, 
            /* diag */ undefined, 
            /* destTypeVarContext */ undefined, 
            /* srcTypeVarContext */ undefined, 64 /* AssignTypeFlags.SkipFunctionReturnTypeCheck */)) {
            const displayOnInit = types_1.ClassType.isSameGenericClass(initMethodResult.classType, classType);
            const initDecl = initMemberType.details.declaration;
            const newDecl = newMemberType.details.declaration;
            if (initDecl && newDecl) {
                const mainDecl = displayOnInit ? initDecl : newDecl;
                const mainDeclNode = mainDecl.node.nodeType === 31 /* ParseNodeType.Function */ ? mainDecl.node.name : mainDecl.node;
                const diagAddendum = new diagnostic_1.DiagnosticAddendum();
                const initSignature = this._evaluator.printType(initMemberType);
                const newSignature = this._evaluator.printType(newMemberType);
                diagAddendum.addMessage(localize_1.LocAddendum.initMethodSignature().format({
                    type: initSignature,
                }));
                diagAddendum.addMessage(localize_1.LocAddendum.newMethodSignature().format({
                    type: newSignature,
                }));
                const diagnostic = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentConstructor, localize_1.LocMessage.constructorParametersMismatch().format({
                    classType: this._evaluator.printType(types_1.ClassType.cloneAsInstance(displayOnInit ? initMethodResult.classType : newMethodResult.classType)),
                }) + diagAddendum.getString(), mainDeclNode);
                if (diagnostic) {
                    const secondaryDecl = displayOnInit ? newDecl : initDecl;
                    diagnostic.addRelatedInfo((displayOnInit ? localize_1.LocAddendum.newMethodLocation() : localize_1.LocAddendum.initMethodLocation()).format({
                        type: this._evaluator.printType(types_1.ClassType.cloneAsInstance(displayOnInit ? newMethodResult.classType : initMethodResult.classType)),
                    }), secondaryDecl.uri, secondaryDecl.range);
                }
            }
        }
    }
    // Verifies that classes that have more than one base class do not have
    // have conflicting type arguments.
    _validateMultipleInheritanceBaseClasses(classType, errorNode) {
        // Skip this check if the class has only one base class or one or more
        // of the base classes are Any.
        const filteredBaseClasses = [];
        for (const baseClass of classType.details.baseClasses) {
            if (!(0, types_1.isClass)(baseClass)) {
                return;
            }
            if (!types_1.ClassType.isBuiltIn(baseClass, ['Generic', 'Protocol', 'object'])) {
                filteredBaseClasses.push(baseClass);
            }
        }
        if (filteredBaseClasses.length < 2) {
            return;
        }
        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
        for (const baseClass of filteredBaseClasses) {
            const typeVarContext = (0, typeUtils_1.buildTypeVarContextFromSpecializedClass)(baseClass);
            for (const baseClassMroClass of baseClass.details.mro) {
                // There's no need to check for conflicts if this class isn't generic.
                if ((0, types_1.isClass)(baseClassMroClass) && baseClassMroClass.details.typeParameters.length > 0) {
                    const specializedBaseClassMroClass = (0, typeUtils_1.applySolvedTypeVars)(baseClassMroClass, typeVarContext);
                    // Find the corresponding class in the derived class's MRO list.
                    const matchingMroClass = classType.details.mro.find((mroClass) => (0, types_1.isClass)(mroClass) && types_1.ClassType.isSameGenericClass(mroClass, specializedBaseClassMroClass));
                    if (matchingMroClass && (0, types_1.isInstantiableClass)(matchingMroClass)) {
                        const matchingMroObject = types_1.ClassType.cloneAsInstance(matchingMroClass);
                        const baseClassMroObject = types_1.ClassType.cloneAsInstance(specializedBaseClassMroClass);
                        if (!this._evaluator.assignType(matchingMroObject, baseClassMroObject)) {
                            const diag = new diagnostic_1.DiagnosticAddendum();
                            const baseClassObject = (0, typeUtils_1.convertToInstance)(baseClass);
                            if ((0, types_1.isTypeSame)(baseClassObject, baseClassMroObject)) {
                                diag.addMessage(localize_1.LocAddendum.baseClassIncompatible().format({
                                    baseClass: this._evaluator.printType(baseClassObject),
                                    type: this._evaluator.printType(matchingMroObject),
                                }));
                            }
                            else {
                                diag.addMessage(localize_1.LocAddendum.baseClassIncompatibleSubclass().format({
                                    baseClass: this._evaluator.printType(baseClassObject),
                                    subclass: this._evaluator.printType(baseClassMroObject),
                                    type: this._evaluator.printType(matchingMroObject),
                                }));
                            }
                            diagAddendum.addAddendum(diag);
                            // Break out of the inner loop so we don't report any redundant errors for this base class.
                            break;
                        }
                    }
                }
            }
        }
        if (!diagAddendum.isEmpty()) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.baseClassIncompatible().format({ type: classType.details.name }) + diagAddendum.getString(), errorNode);
        }
    }
    // Validates that any methods and variables in multiple base classes are
    // compatible with each other.
    _validateMultipleInheritanceCompatibility(classType, errorNode) {
        // Skip this check if reportIncompatibleMethodOverride and reportIncompatibleVariableOverride
        // are disabled because it's a relatively expensive check.
        if (this._fileInfo.diagnosticRuleSet.reportIncompatibleMethodOverride === 'none' &&
            this._fileInfo.diagnosticRuleSet.reportIncompatibleVariableOverride === 'none') {
            return;
        }
        const baseClasses = [];
        // Filter any unknown base classes. Also remove Generic and Protocol
        // base classes.
        classType.details.baseClasses.forEach((baseClass) => {
            if ((0, types_1.isClass)(baseClass) &&
                !types_1.ClassType.isBuiltIn(baseClass, 'Generic') &&
                !types_1.ClassType.isBuiltIn(baseClass, 'Protocol')) {
                baseClasses.push(baseClass);
            }
        });
        // If there is only one base class, there's nothing to do.
        if (baseClasses.length < 2) {
            return;
        }
        // Build maps of symbols for each of the base classes.
        const baseClassSymbolMaps = baseClasses.map((baseClass) => {
            const specializedBaseClass = classType.details.mro.find((c) => (0, types_1.isClass)(c) && types_1.ClassType.isSameGenericClass(c, baseClass));
            if (!specializedBaseClass || !(0, types_1.isClass)(specializedBaseClass)) {
                return new Map();
            }
            // Retrieve all of the specialized symbols from the base class and its ancestors.
            return (0, typeUtils_1.getClassFieldsRecursive)(specializedBaseClass);
        });
        const childClassSymbolMap = (0, typeUtils_1.getClassFieldsRecursive)(classType);
        for (let symbolMapBaseIndex = 1; symbolMapBaseIndex < baseClassSymbolMaps.length; symbolMapBaseIndex++) {
            const baseSymbolMap = baseClassSymbolMaps[symbolMapBaseIndex];
            for (const [name, overriddenClassAndSymbol] of baseSymbolMap) {
                // Special-case dundered methods, which can differ in signature. Also
                // exempt private symbols.
                if (SymbolNameUtils.isDunderName(name) || SymbolNameUtils.isPrivateName(name)) {
                    continue;
                }
                const overriddenClassType = overriddenClassAndSymbol.classType;
                if (!(0, types_1.isClass)(overriddenClassType)) {
                    continue;
                }
                const overrideClassAndSymbol = childClassSymbolMap.get(name);
                if (overrideClassAndSymbol) {
                    const overrideClassType = overrideClassAndSymbol.classType;
                    // If the override is the same as the overridden, then there's nothing
                    // to check. If the override is the child class, then we can also skip
                    // the check because the normal override checks will report the error.
                    if (!(0, types_1.isClass)(overrideClassType) ||
                        types_1.ClassType.isSameGenericClass(overrideClassType, overriddenClassType) ||
                        types_1.ClassType.isSameGenericClass(overrideClassType, classType)) {
                        continue;
                    }
                    this._validateMultipleInheritanceOverride(overriddenClassAndSymbol, overrideClassAndSymbol, classType, name, errorNode);
                }
            }
        }
    }
    _validateMultipleInheritanceOverride(overriddenClassAndSymbol, overrideClassAndSymbol, childClassType, memberName, errorNode) {
        var _a, _b, _c, _d;
        if (!(0, types_1.isClass)(overriddenClassAndSymbol.classType) || !(0, types_1.isClass)(overrideClassAndSymbol.classType)) {
            return;
        }
        // Special case the '_' symbol, which is used in single dispatch
        // code and other cases where the name does not matter.
        if (memberName === '_') {
            return;
        }
        let overriddenType = this._evaluator.getEffectiveTypeOfSymbol(overriddenClassAndSymbol.symbol);
        overriddenType = (0, typeUtils_1.partiallySpecializeType)(overriddenType, overriddenClassAndSymbol.classType);
        const overrideSymbol = overrideClassAndSymbol.symbol;
        let overrideType = this._evaluator.getEffectiveTypeOfSymbol(overrideSymbol);
        overrideType = (0, typeUtils_1.partiallySpecializeType)(overrideType, overrideClassAndSymbol.classType);
        const childOverrideSymbol = types_1.ClassType.getSymbolTable(childClassType).get(memberName);
        const childOverrideType = childOverrideSymbol
            ? this._evaluator.getEffectiveTypeOfSymbol(childOverrideSymbol)
            : undefined;
        let diag;
        const overrideDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(overrideClassAndSymbol.symbol);
        const overriddenDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(overriddenClassAndSymbol.symbol);
        if ((0, types_1.isFunction)(overriddenType) || (0, types_1.isOverloadedFunction)(overriddenType)) {
            const diagAddendum = new diagnostic_1.DiagnosticAddendum();
            let overrideFunction;
            if ((0, types_1.isFunction)(overrideType)) {
                overrideFunction = overrideType;
            }
            else if ((0, types_1.isOverloadedFunction)(overrideType)) {
                // Use the last overload.
                overrideFunction = types_1.OverloadedFunctionType.getImplementation(overrideType);
                // If the last overload isn't an implementation, skip the check for this symbol.
                if (!overrideFunction) {
                    return;
                }
            }
            if (overrideFunction) {
                if (!this._evaluator.validateOverrideMethod(overriddenType, overrideFunction, 
                /* baseClass */ undefined, diagAddendum, 
                /* enforceParamNameMatch */ true)) {
                    const decl = overrideFunction.details.declaration;
                    if (decl && decl.type === 5 /* DeclarationType.Function */) {
                        diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.baseClassMethodTypeIncompatible().format({
                            classType: childClassType.details.name,
                            name: memberName,
                        }) + diagAddendum.getString(), errorNode);
                    }
                }
            }
        }
        else if ((0, typeUtils_1.isProperty)(overriddenType)) {
            // Handle properties specially.
            if (!(0, typeUtils_1.isProperty)(overrideType) && !(0, types_1.isAnyOrUnknown)(overrideType)) {
                const decls = overrideSymbol.getDeclarations();
                if (decls.length > 0) {
                    diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.baseClassVariableTypeIncompatible().format({
                        classType: childClassType.details.name,
                        name: memberName,
                    }), errorNode);
                }
            }
            else {
                this._validateMultipleInheritancePropertyOverride(overriddenClassAndSymbol.classType, childClassType, overriddenType, overrideType, overrideSymbol, memberName, errorNode);
            }
        }
        else {
            // This check can be expensive, so don't perform it if the corresponding
            // rule is disabled.
            if (this._fileInfo.diagnosticRuleSet.reportIncompatibleVariableOverride !== 'none') {
                const primaryDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(overriddenClassAndSymbol.symbol);
                let isInvariant = (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.type) === 1 /* DeclarationType.Variable */ && !primaryDecl.isFinal;
                // If the entry is a member of a frozen dataclass, it is immutable,
                // so it does not need to be invariant.
                if (types_1.ClassType.isDataClassFrozen(overriddenClassAndSymbol.classType) &&
                    overriddenClassAndSymbol.classType.details.dataClassEntries) {
                    const dataclassEntry = overriddenClassAndSymbol.classType.details.dataClassEntries.find((entry) => entry.name === memberName);
                    if (dataclassEntry) {
                        isInvariant = false;
                    }
                }
                let overriddenTDEntry;
                if (overriddenClassAndSymbol.classType.details.typedDictEntries) {
                    overriddenTDEntry =
                        (_b = (_a = overriddenClassAndSymbol.classType.details.typedDictEntries.knownItems.get(memberName)) !== null && _a !== void 0 ? _a : overriddenClassAndSymbol.classType.details.typedDictEntries.extraItems) !== null && _b !== void 0 ? _b : (0, typedDicts_1.getEffectiveExtraItemsEntryType)(this._evaluator, overriddenClassAndSymbol.classType);
                    if (overriddenTDEntry === null || overriddenTDEntry === void 0 ? void 0 : overriddenTDEntry.isReadOnly) {
                        isInvariant = false;
                    }
                }
                let overrideTDEntry;
                if (overrideClassAndSymbol.classType.details.typedDictEntries) {
                    overrideTDEntry =
                        (_d = (_c = overrideClassAndSymbol.classType.details.typedDictEntries.knownItems.get(memberName)) !== null && _c !== void 0 ? _c : overrideClassAndSymbol.classType.details.typedDictEntries.extraItems) !== null && _d !== void 0 ? _d : (0, typedDicts_1.getEffectiveExtraItemsEntryType)(this._evaluator, overrideClassAndSymbol.classType);
                }
                if (!this._evaluator.assignType(overriddenType, childOverrideType !== null && childOverrideType !== void 0 ? childOverrideType : overrideType, 
                /* diag */ undefined, 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, isInvariant ? 1 /* AssignTypeFlags.EnforceInvariance */ : 0 /* AssignTypeFlags.Default */)) {
                    diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.baseClassVariableTypeIncompatible().format({
                        classType: childClassType.details.name,
                        name: memberName,
                    }), errorNode);
                }
                else if (overriddenTDEntry && overrideTDEntry) {
                    let isRequiredCompatible;
                    let isReadOnlyCompatible = true;
                    // If both classes are TypedDicts and they both define this field,
                    // make sure the attributes are compatible.
                    if (overriddenTDEntry.isReadOnly) {
                        isRequiredCompatible = overrideTDEntry.isRequired || !overriddenTDEntry.isRequired;
                    }
                    else {
                        isReadOnlyCompatible = !overrideTDEntry.isReadOnly;
                        isRequiredCompatible = overrideTDEntry.isRequired === overriddenTDEntry.isRequired;
                    }
                    if (!isRequiredCompatible) {
                        const message = overrideTDEntry.isRequired
                            ? localize_1.LocMessage.typedDictFieldRequiredRedefinition
                            : localize_1.LocMessage.typedDictFieldNotRequiredRedefinition;
                        diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, message().format({ name: memberName }), errorNode);
                    }
                    else if (!isReadOnlyCompatible) {
                        diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.typedDictFieldReadOnlyRedefinition().format({
                            name: memberName,
                        }), errorNode);
                    }
                }
            }
        }
        if (diag && overrideDecl && overriddenDecl) {
            this._addMultipleInheritanceRelatedInfo(diag, overriddenClassAndSymbol.classType, overriddenType, overriddenDecl, overrideClassAndSymbol.classType, overrideType, overrideDecl);
        }
    }
    _addMultipleInheritanceRelatedInfo(diag, overriddenClass, overriddenType, overriddenDecl, overrideClass, overrideType, overrideDecl) {
        diag.addRelatedInfo(localize_1.LocAddendum.baseClassOverriddenType().format({
            baseClass: this._evaluator.printType((0, typeUtils_1.convertToInstance)(overriddenClass)),
            type: this._evaluator.printType(overriddenType),
        }), overriddenDecl.uri, overriddenDecl.range);
        diag.addRelatedInfo(localize_1.LocAddendum.baseClassOverridesType().format({
            baseClass: this._evaluator.printType((0, typeUtils_1.convertToInstance)(overrideClass)),
            type: this._evaluator.printType(overrideType),
        }), overrideDecl.uri, overrideDecl.range);
    }
    _validateMultipleInheritancePropertyOverride(overriddenClassType, overrideClassType, overriddenSymbolType, overrideSymbolType, overrideSymbol, memberName, errorNode) {
        const propMethodInfo = [
            ['fget', (c) => { var _a; return (_a = c.fgetInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
            ['fset', (c) => { var _a; return (_a = c.fsetInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
            ['fdel', (c) => { var _a; return (_a = c.fdelInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
        ];
        propMethodInfo.forEach((info) => {
            const diagAddendum = new diagnostic_1.DiagnosticAddendum();
            const [methodName, methodAccessor] = info;
            const baseClassPropMethod = methodAccessor(overriddenSymbolType);
            const subclassPropMethod = methodAccessor(overrideSymbolType);
            // Is the method present on the base class but missing in the subclass?
            if (baseClassPropMethod) {
                const baseClassMethodType = (0, typeUtils_1.partiallySpecializeType)(baseClassPropMethod, overriddenClassType);
                if ((0, types_1.isFunction)(baseClassMethodType)) {
                    if (!subclassPropMethod) {
                        // The method is missing.
                        diagAddendum.addMessage(localize_1.LocAddendum.propertyMethodMissing().format({
                            name: methodName,
                        }));
                        const decls = overrideSymbol.getDeclarations();
                        if (decls.length > 0) {
                            const lastDecl = decls[decls.length - 1];
                            const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.propertyOverridden().format({
                                name: memberName,
                                className: overriddenClassType.details.name,
                            }) + diagAddendum.getString(), errorNode);
                            const origDecl = baseClassMethodType.details.declaration;
                            if (diag && origDecl) {
                                this._addMultipleInheritanceRelatedInfo(diag, overriddenClassType, overriddenSymbolType, origDecl, overrideClassType, overrideSymbolType, lastDecl);
                            }
                        }
                    }
                    else {
                        const subclassMethodType = (0, typeUtils_1.partiallySpecializeType)(subclassPropMethod, overrideClassType);
                        if ((0, types_1.isFunction)(subclassMethodType)) {
                            if (!this._evaluator.validateOverrideMethod(baseClassMethodType, subclassMethodType, overrideClassType, diagAddendum.createAddendum())) {
                                diagAddendum.addMessage(localize_1.LocAddendum.propertyMethodIncompatible().format({
                                    name: methodName,
                                }));
                                const decl = subclassMethodType.details.declaration;
                                if (decl && decl.type === 5 /* DeclarationType.Function */) {
                                    const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.propertyOverridden().format({
                                        name: memberName,
                                        className: overriddenClassType.details.name,
                                    }) + diagAddendum.getString(), errorNode);
                                    const origDecl = baseClassMethodType.details.declaration;
                                    if (diag && origDecl) {
                                        this._addMultipleInheritanceRelatedInfo(diag, overriddenClassType, overriddenSymbolType, origDecl, overrideClassType, overrideSymbolType, decl);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    // Validates that any overloaded methods are consistent in how they
    // are decorated. For example, if the first overload is not marked @final
    // but subsequent ones are, an error should be reported.
    _validateOverloadDecoratorConsistency(classType) {
        types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
            const primaryDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(symbol);
            if (!primaryDecl || primaryDecl.type !== 5 /* DeclarationType.Function */) {
                return;
            }
            const typeOfSymbol = this._evaluator.getEffectiveTypeOfSymbol(symbol);
            if (!(0, types_1.isOverloadedFunction)(typeOfSymbol)) {
                return;
            }
            const overloads = types_1.OverloadedFunctionType.getOverloads(typeOfSymbol);
            // If there's an implementation, it will determine whether the
            // function is @final.
            const implementation = types_1.OverloadedFunctionType.getImplementation(typeOfSymbol);
            if (implementation) {
                // If one or more of the overloads is marked @final but the
                // implementation is not, report an error.
                if (!types_1.FunctionType.isFinal(implementation)) {
                    overloads.forEach((overload) => {
                        var _a, _b;
                        if (types_1.FunctionType.isFinal(overload) && ((_a = overload.details.declaration) === null || _a === void 0 ? void 0 : _a.node)) {
                            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentOverload, localize_1.LocMessage.overloadFinalInconsistencyImpl().format({
                                name: overload.details.name,
                            }), (_b = (0, declarationUtils_1.getNameNodeForDeclaration)(overload.details.declaration)) !== null && _b !== void 0 ? _b : overload.details.declaration.node);
                        }
                    });
                }
                return;
            }
            if (!types_1.FunctionType.isFinal(overloads[0])) {
                overloads.slice(1).forEach((overload, index) => {
                    var _a, _b;
                    if (types_1.FunctionType.isFinal(overload) && ((_a = overload.details.declaration) === null || _a === void 0 ? void 0 : _a.node)) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInconsistentOverload, localize_1.LocMessage.overloadFinalInconsistencyNoImpl().format({
                            name: overload.details.name,
                            index: index + 2,
                        }), (_b = (0, declarationUtils_1.getNameNodeForDeclaration)(overload.details.declaration)) !== null && _b !== void 0 ? _b : overload.details.declaration.node);
                    }
                });
            }
        });
    }
    // For a TypedDict class that derives from another TypedDict class
    // that is closed, verify that any new keys are compatible with the
    // base class.
    _validateTypedDictOverrides(classType) {
        if (!types_1.ClassType.isTypedDictClass(classType)) {
            return;
        }
        const typedDictEntries = (0, typedDicts_1.getTypedDictMembersForClass)(this._evaluator, classType, /* allowNarrowed */ false);
        for (const baseClass of classType.details.baseClasses) {
            const diag = new diagnostic_1.DiagnosticAddendum();
            if (!(0, types_1.isClass)(baseClass) ||
                !types_1.ClassType.isTypedDictClass(baseClass) ||
                !types_1.ClassType.isTypedDictEffectivelyClosed(baseClass)) {
                continue;
            }
            const baseTypedDictEntries = (0, typedDicts_1.getTypedDictMembersForClass)(this._evaluator, baseClass, 
            /* allowNarrowed */ false);
            const typeVarContext = (0, typeUtils_1.buildTypeVarContextFromSpecializedClass)(baseClass);
            const baseExtraItemsType = baseTypedDictEntries.extraItems
                ? (0, typeUtils_1.applySolvedTypeVars)(baseTypedDictEntries.extraItems.valueType, typeVarContext)
                : types_1.UnknownType.create();
            for (const [name, entry] of typedDictEntries.knownItems) {
                const baseEntry = baseTypedDictEntries.knownItems.get(name);
                if (!baseEntry) {
                    if (!baseTypedDictEntries.extraItems || (0, types_1.isNever)(baseTypedDictEntries.extraItems.valueType)) {
                        diag.addMessage(localize_1.LocAddendum.typedDictClosedExtraNotAllowed().format({
                            name,
                        }));
                    }
                    else if (!this._evaluator.assignType(baseExtraItemsType, entry.valueType, 
                    /* diag */ undefined, 
                    /* destTypeVarContext */ undefined, 
                    /* srcTypeVarContext */ undefined, !baseTypedDictEntries.extraItems.isReadOnly
                        ? 1 /* AssignTypeFlags.EnforceInvariance */
                        : 0 /* AssignTypeFlags.Default */)) {
                        diag.addMessage(localize_1.LocAddendum.typedDictClosedExtraTypeMismatch().format({
                            name,
                            type: this._evaluator.printType(entry.valueType),
                        }));
                    }
                    else if (!baseTypedDictEntries.extraItems.isReadOnly && entry.isRequired) {
                        diag.addMessage(localize_1.LocAddendum.typedDictClosedFieldNotRequired().format({
                            name,
                        }));
                    }
                }
            }
            if (typedDictEntries.extraItems && baseTypedDictEntries.extraItems) {
                if (!this._evaluator.assignType(baseExtraItemsType, typedDictEntries.extraItems.valueType, 
                /* diag */ undefined, 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, !baseTypedDictEntries.extraItems.isReadOnly
                    ? 1 /* AssignTypeFlags.EnforceInvariance */
                    : 0 /* AssignTypeFlags.Default */)) {
                    diag.addMessage(localize_1.LocAddendum.typedDictClosedExtraTypeMismatch().format({
                        name: '__extra_items__',
                        type: this._evaluator.printType(typedDictEntries.extraItems.valueType),
                    }));
                }
            }
            if (!diag.isEmpty() && classType.details.declaration) {
                const declNode = (0, declarationUtils_1.getNameNodeForDeclaration)(classType.details.declaration);
                if (declNode) {
                    if (baseTypedDictEntries.extraItems) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.typedDictClosedExtras().format({
                            name: baseClass.details.name,
                            type: this._evaluator.printType(baseExtraItemsType),
                        }) + diag.getString(), declNode);
                    }
                    else {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.typedDictClosedNoExtras().format({
                            name: baseClass.details.name,
                        }) + diag.getString(), declNode);
                    }
                }
            }
        }
    }
    // Validates that any overridden methods or variables contain the same
    // types as the original method. Also marks the class as abstract if one
    // or more abstract methods are not overridden.
    _validateBaseClassOverrides(classType) {
        types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
            // Private symbols do not need to match in type since their
            // names are mangled, and subclasses can't access the value in
            // the parent class.
            if (SymbolNameUtils.isPrivateName(name)) {
                return;
            }
            // If the symbol has no declaration, and the type is inferred,
            // skip the type validation but still check for other issues like
            // Final overrides and class/instance variable mismatches.
            let validateType = true;
            if (!symbol.hasTypedDeclarations()) {
                validateType = false;
            }
            // Get the symbol type defined in this class.
            const typeOfSymbol = this._evaluator.getEffectiveTypeOfSymbol(symbol);
            // If the type of the override symbol isn't known, stop here.
            if ((0, types_1.isAnyOrUnknown)(typeOfSymbol)) {
                return;
            }
            let firstOverride;
            for (const baseClass of classType.details.baseClasses) {
                if (!(0, types_1.isClass)(baseClass)) {
                    continue;
                }
                // Look up the base class in the MRO list. It's the same generic class
                // but has already been specialized using the type variables of the classType.
                const mroBaseClass = classType.details.mro.find((mroClass) => (0, types_1.isClass)(mroClass) && types_1.ClassType.isSameGenericClass(mroClass, baseClass));
                if (!mroBaseClass) {
                    continue;
                }
                (0, debug_1.assert)((0, types_1.isClass)(mroBaseClass));
                const baseClassAndSymbol = (0, typeUtils_1.lookUpClassMember)(mroBaseClass, name, 0 /* MemberAccessFlags.Default */);
                if (!baseClassAndSymbol) {
                    continue;
                }
                firstOverride = firstOverride !== null && firstOverride !== void 0 ? firstOverride : baseClassAndSymbol;
                this._validateBaseClassOverride(baseClassAndSymbol, symbol, validateType ? typeOfSymbol : types_1.AnyType.create(), classType, name);
            }
            if (!firstOverride) {
                // If this is a method decorated with @override, validate that there
                // is a base class method of the same name.
                this._validateOverrideDecoratorNotPresent(symbol, typeOfSymbol);
            }
            else {
                this._validateOverrideDecoratorPresent(symbol, typeOfSymbol, firstOverride);
            }
        });
    }
    _validateOverrideDecoratorPresent(symbol, overrideType, baseMember) {
        // Skip this check if disabled.
        if (this._fileInfo.diagnosticRuleSet.reportImplicitOverride === 'none') {
            return;
        }
        let overrideFunction;
        if ((0, types_1.isFunction)(overrideType)) {
            overrideFunction = overrideType;
        }
        else if ((0, types_1.isOverloadedFunction)(overrideType)) {
            overrideFunction = types_1.OverloadedFunctionType.getImplementation(overrideType);
        }
        else if ((0, types_1.isClassInstance)(overrideType) && types_1.ClassType.isPropertyClass(overrideType)) {
            if (overrideType.fgetInfo) {
                overrideFunction = overrideType.fgetInfo.methodType;
            }
        }
        if (!(overrideFunction === null || overrideFunction === void 0 ? void 0 : overrideFunction.details.declaration) || types_1.FunctionType.isOverridden(overrideFunction)) {
            return;
        }
        // Constructors are exempt.
        if (this._isMethodExemptFromLsp(overrideFunction.details.name)) {
            return;
        }
        // If the declaration for the override function is not the same as the
        // declaration for the symbol, the function was probably replaced by a decorator.
        if (!symbol.getDeclarations().some((decl) => decl === overrideFunction.details.declaration)) {
            return;
        }
        // If the base class is unknown, don't report a missing decorator.
        if ((0, types_1.isAnyOrUnknown)(baseMember.classType)) {
            return;
        }
        const funcNode = overrideFunction.details.declaration.node;
        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportImplicitOverride, localize_1.LocMessage.overrideDecoratorMissing().format({
            name: funcNode.name.value,
            className: this._evaluator.printType((0, typeUtils_1.convertToInstance)(baseMember.classType)),
        }), funcNode.name);
    }
    // Determines whether the name is exempt from Liskov Substitution Principle rules.
    _isMethodExemptFromLsp(name) {
        const exemptMethods = ['__init__', '__new__', '__init_subclass__', '__post_init__'];
        return exemptMethods.some((n) => n === name);
    }
    // Determines whether the type is a function or overloaded function with an @override
    // decorator. In this case, an error is reported because no base class has declared
    // a method of the same name.
    _validateOverrideDecoratorNotPresent(symbol, overrideType) {
        let overrideFunction;
        if ((0, types_1.isFunction)(overrideType)) {
            overrideFunction = overrideType;
        }
        else if ((0, types_1.isOverloadedFunction)(overrideType)) {
            overrideFunction = types_1.OverloadedFunctionType.getImplementation(overrideType);
        }
        else if ((0, types_1.isClassInstance)(overrideType) && types_1.ClassType.isPropertyClass(overrideType)) {
            if (overrideType.fgetInfo) {
                overrideFunction = overrideType.fgetInfo.methodType;
            }
        }
        if (!(overrideFunction === null || overrideFunction === void 0 ? void 0 : overrideFunction.details.declaration) || !types_1.FunctionType.isOverridden(overrideFunction)) {
            return;
        }
        // If the declaration for the override function is not the same as the
        // declaration for the symbol, the function was probably replaced by a decorator.
        if (!symbol.getDeclarations().some((decl) => decl === overrideFunction.details.declaration)) {
            return;
        }
        const funcNode = overrideFunction.details.declaration.node;
        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.overriddenMethodNotFound().format({ name: funcNode.name.value }), funcNode.name);
    }
    _validateBaseClassOverride(baseClassAndSymbol, overrideSymbol, overrideType, childClassType, memberName) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        if (!(0, types_1.isInstantiableClass)(baseClassAndSymbol.classType)) {
            return;
        }
        if (baseClassAndSymbol.symbol.isIgnoredForOverrideChecks() || overrideSymbol.isIgnoredForOverrideChecks()) {
            return;
        }
        // If the base class doesn't provide a type declaration, we won't bother
        // proceeding with additional checks. Type inference is too inaccurate
        // in this case, plus it would be very slow.
        if (!baseClassAndSymbol.symbol.hasTypedDeclarations()) {
            return;
        }
        // Special case the '_' symbol, which is used in single dispatch
        // code and other cases where the name does not matter.
        if (memberName === '_') {
            return;
        }
        const baseClass = baseClassAndSymbol.classType;
        const childClassSelf = types_1.ClassType.cloneAsInstance((0, typeUtils_1.selfSpecializeClass)(childClassType));
        const baseType = (0, typeUtils_1.partiallySpecializeType)(this._evaluator.getEffectiveTypeOfSymbol(baseClassAndSymbol.symbol), baseClass, childClassSelf);
        overrideType = (0, typeUtils_1.partiallySpecializeType)(overrideType, childClassType, childClassSelf);
        if ((0, types_1.isFunction)(baseType) || (0, types_1.isOverloadedFunction)(baseType)) {
            const diagAddendum = new diagnostic_1.DiagnosticAddendum();
            // Determine whether this is an attempt to override a method marked @final.
            let reportFinalMethodOverride = false;
            // Private names (starting with double underscore) are exempt from this check.
            if (!SymbolNameUtils.isPrivateName(memberName)) {
                if ((0, types_1.isFunction)(baseType) && types_1.FunctionType.isFinal(baseType)) {
                    reportFinalMethodOverride = true;
                }
                else if ((0, types_1.isOverloadedFunction)(baseType) &&
                    baseType.overloads.some((overload) => types_1.FunctionType.isFinal(overload))) {
                    reportFinalMethodOverride = true;
                }
            }
            if (reportFinalMethodOverride) {
                const decl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(overrideSymbol);
                if (decl && decl.type === 5 /* DeclarationType.Function */) {
                    const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.finalMethodOverride().format({
                        name: memberName,
                        className: baseClass.details.name,
                    }), decl.node.name);
                    const origDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(baseClassAndSymbol.symbol);
                    if (diag && origDecl) {
                        diag.addRelatedInfo(localize_1.LocAddendum.finalMethod(), origDecl.uri, origDecl.range);
                    }
                }
            }
            if ((0, types_1.isFunction)(overrideType) || (0, types_1.isOverloadedFunction)(overrideType)) {
                // Don't enforce parameter names for dundered methods. Many of them
                // are misnamed in typeshed stubs, so this would result in many
                // false positives.
                const enforceParamNameMatch = !SymbolNameUtils.isDunderName(memberName);
                // Don't check certain magic functions or private symbols.
                // Also, skip this check if the class is a TypedDict. The methods for a TypedDict
                // are synthesized, and they can result in many overloads. We assume they
                // are correct and will not produce any errors.
                if (!this._isMethodExemptFromLsp(memberName) &&
                    !SymbolNameUtils.isPrivateName(memberName) &&
                    !types_1.ClassType.isTypedDictClass(childClassType)) {
                    if (!this._evaluator.validateOverrideMethod(baseType, overrideType, childClassType, diagAddendum, enforceParamNameMatch)) {
                        const decl = (0, types_1.isFunction)(overrideType) && overrideType.details.declaration
                            ? overrideType.details.declaration
                            : (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(overrideSymbol);
                        if (decl) {
                            const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.incompatibleMethodOverride().format({
                                name: memberName,
                                className: baseClass.details.name,
                            }) + diagAddendum.getString(), (_a = (0, declarationUtils_1.getNameNodeForDeclaration)(decl)) !== null && _a !== void 0 ? _a : decl.node);
                            const origDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(baseClassAndSymbol.symbol);
                            if (diag && origDecl) {
                                diag.addRelatedInfo(localize_1.LocAddendum.overriddenMethod(), origDecl.uri, origDecl.range);
                            }
                        }
                    }
                }
            }
            else if (!(0, types_1.isAnyOrUnknown)(overrideType)) {
                // Special-case overrides of methods in '_TypedDict', since
                // TypedDict attributes aren't manifest as attributes but rather
                // as named keys.
                if (!types_1.ClassType.isBuiltIn(baseClass, '_TypedDict')) {
                    const decls = overrideSymbol.getDeclarations();
                    if (decls.length > 0) {
                        const lastDecl = decls[decls.length - 1];
                        const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.methodOverridden().format({
                            name: memberName,
                            className: baseClass.details.name,
                            type: this._evaluator.printType(overrideType),
                        }), (_b = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _b !== void 0 ? _b : lastDecl.node);
                        const origDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(baseClassAndSymbol.symbol);
                        if (diag && origDecl) {
                            diag.addRelatedInfo(localize_1.LocAddendum.overriddenMethod(), origDecl.uri, origDecl.range);
                        }
                    }
                }
            }
        }
        else if ((0, typeUtils_1.isProperty)(baseType)) {
            // Handle properties specially.
            if (!(0, typeUtils_1.isProperty)(overrideType)) {
                const decls = overrideSymbol.getDeclarations();
                if (decls.length > 0 && overrideSymbol.isClassMember()) {
                    const lastDecl = decls[decls.length - 1];
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.propertyOverridden().format({
                        name: memberName,
                        className: baseClass.details.name,
                    }), (_c = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _c !== void 0 ? _c : lastDecl.node);
                }
            }
            else {
                this._validatePropertyOverride(baseClass, childClassType, baseType, overrideType, overrideSymbol, memberName);
            }
        }
        else {
            // This check can be expensive, so don't perform it if the corresponding
            // rule is disabled.
            if (this._fileInfo.diagnosticRuleSet.reportIncompatibleVariableOverride !== 'none') {
                const decls = overrideSymbol.getDeclarations();
                if (decls.length > 0) {
                    const lastDecl = decls[decls.length - 1];
                    const primaryDecl = decls[0];
                    // Verify that the override type is assignable to (same or narrower than)
                    // the declared type of the base symbol.
                    let isInvariant = (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.type) === 1 /* DeclarationType.Variable */ && !primaryDecl.isFinal;
                    // If the entry is a member of a frozen dataclass, it is immutable,
                    // so it does not need to be invariant.
                    if (types_1.ClassType.isDataClassFrozen(baseClass) && baseClass.details.dataClassEntries) {
                        const dataclassEntry = baseClass.details.dataClassEntries.find((entry) => entry.name === memberName);
                        if (dataclassEntry) {
                            isInvariant = false;
                        }
                    }
                    let overriddenTDEntry;
                    let overrideTDEntry;
                    if (!overrideSymbol.isIgnoredForProtocolMatch()) {
                        if (baseClass.details.typedDictEntries) {
                            overriddenTDEntry =
                                (_e = (_d = baseClass.details.typedDictEntries.knownItems.get(memberName)) !== null && _d !== void 0 ? _d : baseClass.details.typedDictEntries.extraItems) !== null && _e !== void 0 ? _e : (0, typedDicts_1.getEffectiveExtraItemsEntryType)(this._evaluator, baseClass);
                            if (overriddenTDEntry === null || overriddenTDEntry === void 0 ? void 0 : overriddenTDEntry.isReadOnly) {
                                isInvariant = false;
                            }
                        }
                        if (childClassType.details.typedDictEntries) {
                            // Exempt __extra_items__ here. We'll check this separately
                            // in _validateTypedDictOverrides. If we don't skip it here,
                            // redundant errors will be produced.
                            if (types_1.ClassType.isTypedDictMarkedClosed(childClassType) && memberName === '__extra_items__') {
                                overrideTDEntry = overriddenTDEntry;
                                overrideType = baseType;
                            }
                            else {
                                overrideTDEntry =
                                    (_g = (_f = childClassType.details.typedDictEntries.knownItems.get(memberName)) !== null && _f !== void 0 ? _f : childClassType.details.typedDictEntries.extraItems) !== null && _g !== void 0 ? _g : (0, typedDicts_1.getEffectiveExtraItemsEntryType)(this._evaluator, childClassType);
                            }
                        }
                    }
                    let diagAddendum = new diagnostic_1.DiagnosticAddendum();
                    if (!this._evaluator.assignType(baseType, overrideType, diagAddendum, 
                    /* destTypeVarContext */ undefined, 
                    /* srcTypeVarContext */ undefined, isInvariant ? 1 /* AssignTypeFlags.EnforceInvariance */ : 0 /* AssignTypeFlags.Default */)) {
                        if (isInvariant) {
                            diagAddendum = new diagnostic_1.DiagnosticAddendum();
                            diagAddendum.addMessage(localize_1.LocAddendum.overrideIsInvariant());
                            diagAddendum.createAddendum().addMessage(localize_1.LocAddendum.overrideInvariantMismatch().format({
                                overrideType: this._evaluator.printType(overrideType),
                                baseType: this._evaluator.printType(baseType),
                            }));
                        }
                        const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.symbolOverridden().format({
                            name: memberName,
                            className: baseClass.details.name,
                        }) + diagAddendum.getString(), (_h = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _h !== void 0 ? _h : lastDecl.node);
                        const origDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(baseClassAndSymbol.symbol);
                        if (diag && origDecl) {
                            diag.addRelatedInfo(localize_1.LocAddendum.overriddenSymbol(), origDecl.uri, origDecl.range);
                        }
                    }
                    else if (overriddenTDEntry && overrideTDEntry) {
                        // Make sure the required/not-required attribute is compatible.
                        let isRequiredCompatible = true;
                        if (overriddenTDEntry.isReadOnly) {
                            // If the read-only flag is set, a not-required field can be overridden
                            // by a required field, but not vice versa.
                            isRequiredCompatible = overrideTDEntry.isRequired || !overriddenTDEntry.isRequired;
                        }
                        else {
                            isRequiredCompatible = overrideTDEntry.isRequired === overriddenTDEntry.isRequired;
                        }
                        if (!isRequiredCompatible) {
                            const message = overrideTDEntry.isRequired
                                ? localize_1.LocMessage.typedDictFieldRequiredRedefinition
                                : localize_1.LocMessage.typedDictFieldNotRequiredRedefinition;
                            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, message().format({ name: memberName }), (_j = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _j !== void 0 ? _j : lastDecl.node);
                        }
                        // Make sure that the derived class isn't marking a previously writable
                        // entry as read-only.
                        if (!overriddenTDEntry.isReadOnly && overrideTDEntry.isReadOnly) {
                            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.typedDictFieldReadOnlyRedefinition().format({
                                name: memberName,
                            }), (_k = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _k !== void 0 ? _k : lastDecl.node);
                        }
                    }
                    // Verify that there is not a Final mismatch.
                    const isBaseVarFinal = this._evaluator.isFinalVariable(baseClassAndSymbol.symbol);
                    const overrideFinalVarDecl = decls.find((d) => this._evaluator.isFinalVariableDeclaration(d));
                    if (!isBaseVarFinal && overrideFinalVarDecl) {
                        const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, localize_1.LocMessage.variableFinalOverride().format({
                            name: memberName,
                            className: baseClass.details.name,
                        }), (_l = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _l !== void 0 ? _l : lastDecl.node);
                        if (diag) {
                            diag.addRelatedInfo(localize_1.LocAddendum.overriddenSymbol(), overrideFinalVarDecl.uri, overrideFinalVarDecl.range);
                        }
                    }
                    // Verify that a class variable isn't overriding an instance
                    // variable or vice versa.
                    const isBaseClassVar = baseClassAndSymbol.symbol.isClassVar();
                    let isClassVar = overrideSymbol.isClassVar();
                    if (isBaseClassVar && !isClassVar) {
                        // If the subclass doesn't redeclare the type but simply assigns
                        // it without declaring its type, we won't consider it an instance
                        // variable.
                        if (!overrideSymbol.hasTypedDeclarations()) {
                            isClassVar = true;
                        }
                        // If the subclass is declaring an inner class, we'll consider that
                        // to be a ClassVar.
                        if (overrideSymbol.getTypedDeclarations().every((decl) => decl.type === 6 /* DeclarationType.Class */)) {
                            isClassVar = true;
                        }
                    }
                    // Allow TypedDict members to have the same name as class variables in the
                    // base class because TypedDict members are not really instance members.
                    const ignoreTypedDictOverride = types_1.ClassType.isTypedDictClass(childClassType) && !isClassVar;
                    if (isBaseClassVar !== isClassVar && !ignoreTypedDictOverride) {
                        const unformattedMessage = overrideSymbol.isClassVar()
                            ? localize_1.LocMessage.classVarOverridesInstanceVar()
                            : localize_1.LocMessage.instanceVarOverridesClassVar();
                        const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleVariableOverride, unformattedMessage.format({
                            name: memberName,
                            className: baseClass.details.name,
                        }), (_m = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _m !== void 0 ? _m : lastDecl.node);
                        const origDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(baseClassAndSymbol.symbol);
                        if (diag && origDecl) {
                            diag.addRelatedInfo(localize_1.LocAddendum.overriddenSymbol(), origDecl.uri, origDecl.range);
                        }
                    }
                }
            }
        }
    }
    _validatePropertyOverride(baseClassType, childClassType, baseType, childType, overrideSymbol, memberName) {
        const propMethodInfo = [
            ['fget', (c) => { var _a; return (_a = c.fgetInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
            ['fset', (c) => { var _a; return (_a = c.fsetInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
            ['fdel', (c) => { var _a; return (_a = c.fdelInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
        ];
        propMethodInfo.forEach((info) => {
            var _a;
            const diagAddendum = new diagnostic_1.DiagnosticAddendum();
            const [methodName, methodAccessor] = info;
            const baseClassPropMethod = methodAccessor(baseType);
            const subclassPropMethod = methodAccessor(childType);
            // Is the method present on the base class but missing in the subclass?
            if (baseClassPropMethod) {
                const baseClassMethodType = (0, typeUtils_1.partiallySpecializeType)(baseClassPropMethod, baseClassType);
                if ((0, types_1.isFunction)(baseClassMethodType)) {
                    if (!subclassPropMethod) {
                        // The method is missing.
                        diagAddendum.addMessage(localize_1.LocAddendum.propertyMethodMissing().format({
                            name: methodName,
                        }));
                        const decls = overrideSymbol.getDeclarations();
                        if (decls.length > 0) {
                            const lastDecl = decls[decls.length - 1];
                            const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.propertyOverridden().format({
                                name: memberName,
                                className: baseClassType.details.name,
                            }) + diagAddendum.getString(), (_a = (0, declarationUtils_1.getNameNodeForDeclaration)(lastDecl)) !== null && _a !== void 0 ? _a : lastDecl.node);
                            const origDecl = baseClassMethodType.details.declaration;
                            if (diag && origDecl) {
                                diag.addRelatedInfo(localize_1.LocAddendum.overriddenMethod(), origDecl.uri, origDecl.range);
                            }
                        }
                    }
                    else {
                        const subclassMethodType = (0, typeUtils_1.partiallySpecializeType)(subclassPropMethod, childClassType);
                        if ((0, types_1.isFunction)(subclassMethodType)) {
                            if (!this._evaluator.validateOverrideMethod(baseClassMethodType, subclassMethodType, childClassType, diagAddendum.createAddendum())) {
                                diagAddendum.addMessage(localize_1.LocAddendum.propertyMethodIncompatible().format({
                                    name: methodName,
                                }));
                                const decl = subclassMethodType.details.declaration;
                                if (decl && decl.type === 5 /* DeclarationType.Function */) {
                                    const diag = this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportIncompatibleMethodOverride, localize_1.LocMessage.propertyOverridden().format({
                                        name: memberName,
                                        className: baseClassType.details.name,
                                    }) + diagAddendum.getString(), decl.node.name);
                                    const origDecl = baseClassMethodType.details.declaration;
                                    if (diag && origDecl) {
                                        diag.addRelatedInfo(localize_1.LocAddendum.overriddenMethod(), origDecl.uri, origDecl.range);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
    }
    // Performs checks on a function that is located within a class
    // and has been determined not to be a property accessor.
    _validateMethod(node, functionType, classNode) {
        var _a, _b;
        const classTypeInfo = this._evaluator.getTypeOfClass(classNode);
        const classType = classTypeInfo === null || classTypeInfo === void 0 ? void 0 : classTypeInfo.classType;
        if (node.name && classType) {
            const superCheckMethods = ['__init__', '__init_subclass__', '__enter__', '__exit__'];
            if (superCheckMethods.some((name) => name === node.name.value)) {
                if (!types_1.FunctionType.isAbstractMethod(functionType) &&
                    !types_1.FunctionType.isOverloaded(functionType) &&
                    !this._fileInfo.isStubFile) {
                    this._validateSuperCallForMethod(node, functionType, classType);
                }
            }
        }
        if (((_a = node.name) === null || _a === void 0 ? void 0 : _a.value) === '__new__') {
            // __new__ overrides should have a "cls" parameter.
            if (node.parameters.length === 0 ||
                !node.parameters[0].name ||
                !['cls', '_cls', '__cls', '__mcls', 'mcls', 'mcs', 'metacls'].some((name) => node.parameters[0].name.value === name)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportSelfClsParameterName, localize_1.LocMessage.newClsParam(), node.parameters.length > 0 ? node.parameters[0] : node.name);
            }
            if (classType) {
                this._validateClsSelfParameterType(functionType, classType, /* isCls */ true);
            }
        }
        else if (((_b = node.name) === null || _b === void 0 ? void 0 : _b.value) === '_generate_next_value_') {
            // Skip this check for _generate_next_value_.
        }
        else if (types_1.FunctionType.isStaticMethod(functionType)) {
            // Static methods should not have "self" or "cls" parameters.
            if (node.parameters.length > 0 && node.parameters[0].name) {
                const paramName = node.parameters[0].name.value;
                if (paramName === 'self' || paramName === 'cls') {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportSelfClsParameterName, localize_1.LocMessage.staticClsSelfParam(), node.parameters[0].name);
                }
            }
        }
        else if (types_1.FunctionType.isClassMethod(functionType)) {
            let paramName = '';
            if (node.parameters.length > 0 && node.parameters[0].name) {
                paramName = node.parameters[0].name.value;
            }
            // Class methods should have a "cls" parameter. We'll exempt parameter
            // names that start with an underscore since those are used in a few
            // cases in the stdlib pyi files.
            if (paramName !== 'cls') {
                if (!this._fileInfo.isStubFile || (!paramName.startsWith('_') && paramName !== 'metacls')) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportSelfClsParameterName, localize_1.LocMessage.classMethodClsParam(), node.parameters.length > 0 ? node.parameters[0] : node.name);
                }
            }
            if (classType) {
                this._validateClsSelfParameterType(functionType, classType, /* isCls */ true);
            }
        }
        else {
            const decoratorIsPresent = node.decorators.length > 0;
            const isOverloaded = types_1.FunctionType.isOverloaded(functionType);
            // The presence of a decorator can change the behavior, so we need
            // to back off from this check if a decorator is present. An overload
            // is a decorator, but we'll ignore that here.
            if (isOverloaded || !decoratorIsPresent) {
                let paramName = '';
                let firstParamIsSimple = true;
                if (node.parameters.length > 0) {
                    if (node.parameters[0].name) {
                        paramName = node.parameters[0].name.value;
                    }
                    if (node.parameters[0].category !== 0 /* ParameterCategory.Simple */) {
                        firstParamIsSimple = false;
                    }
                }
                // Instance methods should have a "self" parameter.
                if (firstParamIsSimple && paramName !== 'self') {
                    // Special-case metaclasses, which can use "cls" or several variants.
                    let isLegalMetaclassName = false;
                    if (['cls', 'mcls', 'mcs'].some((name) => name === paramName)) {
                        const classTypeInfo = this._evaluator.getTypeOfClass(classNode);
                        const typeType = this._evaluator.getBuiltInType(classNode, 'type');
                        if (typeType &&
                            (0, types_1.isInstantiableClass)(typeType) &&
                            classTypeInfo &&
                            (0, types_1.isInstantiableClass)(classTypeInfo.classType)) {
                            if ((0, typeUtils_1.derivesFromClassRecursive)(classTypeInfo.classType, typeType, /* ignoreUnknown */ true)) {
                                isLegalMetaclassName = true;
                            }
                        }
                    }
                    // Some typeshed stubs use a name that starts with an underscore to designate
                    // a parameter that cannot be positional.
                    const isPrivateName = SymbolNameUtils.isPrivateOrProtectedName(paramName);
                    if (!isLegalMetaclassName && !isPrivateName) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportSelfClsParameterName, localize_1.LocMessage.instanceMethodSelfParam(), node.parameters.length > 0 ? node.parameters[0] : node.name);
                    }
                }
            }
            if (classType) {
                this._validateClsSelfParameterType(functionType, classType, /* isCls */ false);
            }
        }
    }
    // Determines whether the method properly calls through to the same method in all
    // parent classes that expose a same-named method.
    _validateSuperCallForMethod(node, methodType, classType) {
        // This is an expensive test, so if it's not enabled, don't do any work.
        if (this._fileInfo.diagnosticRuleSet.reportMissingSuperCall === 'none') {
            return;
        }
        // If the class is marked final, we can skip the "object" base class
        // because we know that the `__init__` method in `object` doesn't do
        // anything. It's not safe to do this if the class isn't final because
        // it could be combined with other classes in a multi-inheritance
        // situation that effectively adds new superclasses that we don't know
        // about statically.
        let effectiveFlags = 16 /* MemberAccessFlags.SkipInstanceMembers */ | 1 /* MemberAccessFlags.SkipOriginalClass */;
        if (types_1.ClassType.isFinal(classType)) {
            effectiveFlags |= 4 /* MemberAccessFlags.SkipObjectBaseClass */;
        }
        const methodMember = (0, typeUtils_1.lookUpClassMember)(classType, methodType.details.name, effectiveFlags);
        if (!methodMember) {
            return;
        }
        let foundCallOfMember = false;
        // Now scan the implementation of the method to determine whether
        // super().<method> has been called for all of the required base classes.
        const callNodeWalker = new ParseTreeUtils.CallNodeWalker((node) => {
            if (node.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                // Is it accessing the method by the same name?
                if (node.leftExpression.memberName.value === methodType.details.name) {
                    const memberBaseExpr = node.leftExpression.leftExpression;
                    // Is it a "super" call?
                    if (memberBaseExpr.nodeType === 9 /* ParseNodeType.Call */ &&
                        memberBaseExpr.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                        memberBaseExpr.leftExpression.value === 'super') {
                        foundCallOfMember = true;
                    }
                    else {
                        // Is it an X.<method> direct call?
                        const baseType = this._evaluator.getType(memberBaseExpr);
                        if (baseType && (0, types_1.isInstantiableClass)(baseType)) {
                            foundCallOfMember = true;
                        }
                    }
                }
            }
        });
        callNodeWalker.walk(node.suite);
        // If we didn't find a call to at least one base class, report the problem.
        if (!foundCallOfMember) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportMissingSuperCall, localize_1.LocMessage.missingSuperCall().format({
                methodName: methodType.details.name,
            }), node.name);
        }
    }
    // Validates that the annotated type of a "self" or "cls" parameter is
    // compatible with the type of the class that contains it.
    _validateClsSelfParameterType(functionType, classType, isCls) {
        if (functionType.details.parameters.length < 1) {
            return;
        }
        // If there is no type annotation, there's nothing to check because
        // the type will be inferred.
        const paramInfo = functionType.details.parameters[0];
        if (!paramInfo.typeAnnotation || !paramInfo.name) {
            return;
        }
        // If this is an __init__ method, we need to specifically check for the
        // use of class-scoped TypeVars, which are not allowed in this context
        // according to the typing spec.
        if (functionType.details.name === '__init__' && functionType.details.methodClass) {
            const typeVars = (0, typeUtils_1.getTypeVarArgumentsRecursive)(paramInfo.type);
            if (typeVars.some((typeVar) => { var _a; return typeVar.scopeId === ((_a = functionType.details.methodClass) === null || _a === void 0 ? void 0 : _a.details.typeVarScopeId); })) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeVarUse, localize_1.LocMessage.initMethodSelfParamTypeVar(), paramInfo.typeAnnotation);
            }
        }
        // If this is a protocol class, the self and cls parameters can be bound
        // to something other than the class.
        if (types_1.ClassType.isProtocolClass(classType)) {
            return;
        }
        const paramType = this._evaluator.makeTopLevelTypeVarsConcrete(paramInfo.type);
        const expectedType = isCls ? classType : (0, typeUtils_1.convertToInstance)(classType);
        // If the declared type is a protocol class or instance, skip
        // the check. This has legitimate uses for mix-in classes.
        if ((0, types_1.isInstantiableClass)(paramType) && types_1.ClassType.isProtocolClass(paramType)) {
            return;
        }
        if ((0, types_1.isClassInstance)(paramType) && types_1.ClassType.isProtocolClass(paramType)) {
            return;
        }
        // If the method starts with a `*args: P.args`, skip the check.
        if (paramInfo.category === 1 /* ParameterCategory.ArgsList */ &&
            (0, types_1.isParamSpec)(paramInfo.type) &&
            paramInfo.type.paramSpecAccess === 'args') {
            return;
        }
        // Don't enforce this for an overloaded method because the "self" param
        // annotation can be used as a filter for the overload. This differs from
        // mypy, which enforces this check for overloads, but there are legitimate
        // uses for this in an overloaded method.
        if (types_1.FunctionType.isOverloaded(functionType)) {
            return;
        }
        // If the declared type is LiteralString and the class is str, exempt this case.
        // It's used in the typeshed stubs.
        if ((0, types_1.isClassInstance)(paramType) &&
            types_1.ClassType.isBuiltIn(paramType, 'LiteralString') &&
            types_1.ClassType.isBuiltIn(classType, 'str')) {
            return;
        }
        const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(functionType));
        if (!this._evaluator.assignType(paramType, expectedType, /* diag */ undefined, typeVarContext)) {
            // We exempt Never from this check because it has a legitimate use in this case.
            if (!(0, types_1.isNever)(paramType)) {
                this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.clsSelfParamTypeMismatch().format({
                    name: paramInfo.name,
                    classType: this._evaluator.printType(expectedType),
                }), paramInfo.typeAnnotation);
            }
        }
    }
    // Determines whether a yield or yield from node is compatible with the
    // return type annotation of the containing function.
    _validateYieldType(node, yieldType, expectedDiagAddendum, sendType) {
        var _a, _b, _c, _d;
        const enclosingFunctionNode = ParseTreeUtils.getEnclosingFunction(node);
        if (!enclosingFunctionNode || !enclosingFunctionNode.returnTypeAnnotation) {
            return;
        }
        const functionTypeResult = this._evaluator.getTypeOfFunction(enclosingFunctionNode);
        if (!functionTypeResult) {
            return;
        }
        const declaredReturnType = types_1.FunctionType.getEffectiveReturnType(functionTypeResult.functionType);
        if (!declaredReturnType) {
            return;
        }
        let generatorType;
        if (!enclosingFunctionNode.isAsync &&
            (0, types_1.isClassInstance)(declaredReturnType) &&
            types_1.ClassType.isBuiltIn(declaredReturnType, 'AwaitableGenerator')) {
            // Handle the old-style (pre-await) generator case
            // if the return type explicitly uses AwaitableGenerator.
            generatorType = this._evaluator.getTypingType(node, 'AwaitableGenerator');
        }
        else {
            generatorType = this._evaluator.getTypingType(node, enclosingFunctionNode.isAsync ? 'AsyncGenerator' : 'Generator');
        }
        if (!generatorType || !(0, types_1.isInstantiableClass)(generatorType)) {
            return;
        }
        if (!this._evaluator.isNodeReachable(node, /* sourceNode */ undefined)) {
            return;
        }
        if ((0, types_1.isNever)(declaredReturnType)) {
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.noReturnContainsYield(), node);
            return;
        }
        const generatorTypeArgs = [yieldType, sendType !== null && sendType !== void 0 ? sendType : types_1.UnknownType.create(), types_1.UnknownType.create()];
        const specializedGenerator = types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForSpecialization(generatorType, generatorTypeArgs, /* isTypeArgumentExplicit */ true));
        const diagAddendum = new diagnostic_1.DiagnosticAddendum();
        if (!this._evaluator.assignType(declaredReturnType, specializedGenerator, diagAddendum)) {
            const errorMessage = enclosingFunctionNode.isAsync
                ? localize_1.LocMessage.generatorAsyncReturnType()
                : localize_1.LocMessage.generatorSyncReturnType();
            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportReturnType, errorMessage.format({ yieldType: this._evaluator.printType(yieldType) }) +
                ((_a = expectedDiagAddendum === null || expectedDiagAddendum === void 0 ? void 0 : expectedDiagAddendum.getString()) !== null && _a !== void 0 ? _a : diagAddendum.getString()), (_b = node.expression) !== null && _b !== void 0 ? _b : node, (_d = (_c = expectedDiagAddendum === null || expectedDiagAddendum === void 0 ? void 0 : expectedDiagAddendum.getEffectiveTextRange()) !== null && _c !== void 0 ? _c : node.expression) !== null && _d !== void 0 ? _d : node);
        }
    }
    // Determines whether any of the except statements are unreachable because
    // they are redundant.
    _reportUnusedExceptStatements(node) {
        let sawUnknownExceptionType = false;
        const exceptionTypesSoFar = [];
        node.exceptClauses.forEach((except) => {
            var _a, _b;
            if (sawUnknownExceptionType || except.isExceptGroup || !except.typeExpression) {
                return;
            }
            const exceptionType = this._evaluator.getType(except.typeExpression);
            if (!exceptionType || (0, types_1.isAnyOrUnknown)(exceptionType)) {
                sawUnknownExceptionType = true;
                return;
            }
            const typesOfThisExcept = [];
            if ((0, types_1.isInstantiableClass)(exceptionType)) {
                // If the exception type is a variable whose type could represent
                // subclasses, the actual exception type is statically unknown.
                if (exceptionType.includeSubclasses) {
                    sawUnknownExceptionType = true;
                }
                typesOfThisExcept.push(exceptionType);
            }
            else if ((0, types_1.isClassInstance)(exceptionType)) {
                const iterableType = (_b = (_a = this._evaluator.getTypeOfIterator({ type: exceptionType }, 
                /* isAsync */ false, 
                /* errorNode */ except.typeExpression, 
                /* emitNotIterableError */ false)) === null || _a === void 0 ? void 0 : _a.type) !== null && _b !== void 0 ? _b : types_1.UnknownType.create();
                (0, typeUtils_1.doForEachSubtype)(iterableType, (subtype) => {
                    if ((0, types_1.isAnyOrUnknown)(subtype)) {
                        sawUnknownExceptionType = true;
                    }
                    if ((0, types_1.isInstantiableClass)(subtype)) {
                        // If the exception type is a variable whose type could represent
                        // subclasses, the actual exception type is statically unknown.
                        if (subtype.includeSubclasses) {
                            sawUnknownExceptionType = true;
                        }
                        typesOfThisExcept.push(subtype);
                    }
                });
            }
            else {
                sawUnknownExceptionType = true;
            }
            if (exceptionTypesSoFar.length > 0 && !sawUnknownExceptionType) {
                const diagAddendum = new diagnostic_1.DiagnosticAddendum();
                let overriddenExceptionCount = 0;
                typesOfThisExcept.forEach((thisExceptType) => {
                    const subtype = exceptionTypesSoFar.find((previousExceptType) => {
                        return (0, typeUtils_1.derivesFromClassRecursive)(thisExceptType, previousExceptType, /* ignoreUnknown */ true);
                    });
                    if (subtype) {
                        diagAddendum.addMessage(localize_1.LocAddendum.unreachableExcept().format({
                            exceptionType: this._evaluator.printType((0, typeUtils_1.convertToInstance)(thisExceptType)),
                            parentType: this._evaluator.printType((0, typeUtils_1.convertToInstance)(subtype)),
                        }));
                        overriddenExceptionCount++;
                    }
                });
                // Were all of the exception types overridden?
                if (typesOfThisExcept.length > 0 && typesOfThisExcept.length === overriddenExceptionCount) {
                    this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnusedExcept, localize_1.LocMessage.unreachableExcept() + diagAddendum.getString(), except.typeExpression);
                    this._evaluator.addUnreachableCode(except, except.exceptSuite);
                }
            }
            (0, collectionUtils_1.appendArray)(exceptionTypesSoFar, typesOfThisExcept);
        });
    }
    _reportDuplicateImports() {
        const importStatements = (0, importStatementUtils_1.getTopLevelImports)(this._moduleNode);
        const importModuleMap = new Map();
        importStatements.orderedImports.forEach((importStatement) => {
            if (importStatement.node.nodeType === 25 /* ParseNodeType.ImportFrom */) {
                const symbolMap = new Map();
                importStatement.node.imports.forEach((importFromAs) => {
                    // Ignore duplicates if they're aliased.
                    if (!importFromAs.alias) {
                        const prevImport = symbolMap.get(importFromAs.name.value);
                        if (prevImport) {
                            this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportDuplicateImport, localize_1.LocMessage.duplicateImport().format({ importName: importFromAs.name.value }), importFromAs.name);
                        }
                        else {
                            symbolMap.set(importFromAs.name.value, importFromAs);
                        }
                    }
                });
            }
            else if (importStatement.subnode) {
                // Ignore duplicates if they're aliased.
                if (!importStatement.subnode.alias) {
                    const prevImport = importModuleMap.get(importStatement.moduleName);
                    if (prevImport) {
                        this._evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportDuplicateImport, localize_1.LocMessage.duplicateImport().format({ importName: importStatement.moduleName }), importStatement.subnode);
                    }
                    else {
                        importModuleMap.set(importStatement.moduleName, importStatement.subnode);
                    }
                }
            }
        });
    }
}
exports.Checker = Checker;
//# sourceMappingURL=checker.js.map