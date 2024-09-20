"use strict";
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
exports.MyChecker = void 0;
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const pythonVersion_1 = require("../common/pythonVersion");
const localize_1 = require("../localization/localize");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const checker_1 = require("./checker");
const parameterUtils_1 = require("./parameterUtils");
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const parseTreeWalker_1 = require("./parseTreeWalker");
const scopeUtils_1 = require("./scopeUtils");
const typeEvaluator_1 = require("./typeEvaluator");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
// When enabled, this debug flag causes the code complexity of
// functions to be emitted.
const isPrintCodeComplexityEnabled = false;
class MyChecker extends checker_1.Checker {
    constructor(_importResolver, _evaluator, parseResults, _sourceMapper, _dependentFiles) {
        super(_importResolver, _evaluator, parseResults, _sourceMapper, _dependentFiles);
    }
    visitFunction(node) {
        var _a, _b;
        console.log("My function visitor");
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
        const callsites = getCallsites(node.suite);
        node.parameters.forEach((param, index) => {
            var _a;
            if (param.defaultValue) {
                this.walk(param.defaultValue);
            }
            if (param.typeAnnotation) {
                this.walk(param.typeAnnotation);
            }
            else {
                console.log("parameter " + ((_a = param.name) === null || _a === void 0 ? void 0 : _a.value) + " needs to be annotated");
                if (param.name)
                    let parameterCallsites = getTypeCandidates(param.name, callsites);
            }
            if (param.typeAnnotationComment) {
                this.walk(param.typeAnnotationComment);
            }
            // const typeCandidates = new Array;
            // (node.suite?.statements[0] as StatementListNode).statements.forEach((statement) => {
            //     if (this.isVariableInStatement(param.name?.value, statement)) {
            //         var typeCandidate = this.getTypeFromStatement(param.name?.value, statement);
            //         if (typeCandidate) {
            //             typeCandidates.push(typeCandidate);
            //         }
            //     }
            // });
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
    getSignatureFromCall(node) {
        // what should the return looks like ?
        // a list of parameter with type and the return type ?
        // { 
        //     "params": [("name", "type")],
        //     "return": "type"
        // }
        return {
            params: [{
                    pName: "name",
                    type: "type"
                }],
            return: "type"
        };
    }
    getTypeFromStatement(name, node) {
        switch (node.nodeType) {
            case 9 /* ParseNodeType.Call */:
            // var sig = this.getSignatureFromCall(node as CallNode);
            // sig.params.forEach((pName, type) => {
            //     if (pName === name) {
            //         return type
            //     }
            // })
            default:
                return undefined;
        }
    }
    isVariableInStatement(name, node) {
        return true;
    }
    inferTypeFromCandidates(types) {
        if (types.length == 0)
            return undefined;
        let typeToInfer = types[0];
        types.forEach((t) => {
            if (typeToInfer === undefined)
                return;
            typeToInfer = findCommonType(typeToInfer, t);
        });
        return typeToInfer;
    }
}
exports.MyChecker = MyChecker;
function getCallsites(node) {
    let callsites = [];
    if (node.nodeType === 9 /* ParseNodeType.Call */) {
        callsites.push(node);
    }
    const childNodes = (0, parseTreeWalker_1.getChildNodes)(node);
    for (const childNode of childNodes) {
        if (childNode)
            callsites.push(...getCallsites(childNode));
    }
    return callsites;
}
function getTypeCandidates(name, callsites) {
    let candidates = [];
    let parameterCallsites = callsites.filter(cs => isParameterInCallsite(name, cs));
    return candidates;
}
function isParameterInCallsite(name, callsites) {
    return callsites.arguments.some((arg) => {
        return arg.valueExpression.nodeType === 38 /* ParseNodeType.Name */
            && arg.valueExpression.value === name.value;
    });
}
function isSubtype(bestCandidate, t) {
    throw true;
}
function findCommonType(type1, type2) {
    throw new Error("Function not implemented.");
}
//# sourceMappingURL=checkerExtension.js.map