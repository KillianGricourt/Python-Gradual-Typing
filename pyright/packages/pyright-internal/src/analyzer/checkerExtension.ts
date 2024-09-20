
import { DiagnosticAddendum } from "../common/diagnostic";
import { DiagnosticRule } from "../common/diagnosticRules";
import { pythonVersion3_5 } from '../common/pythonVersion';
import { LocAddendum, LocMessage } from "../localization/localize";
import { ArgumentNode, CallNode, FunctionNode, NameNode, ParameterCategory, ParameterNode, ParseNode, ParseNodeType } from "../parser/parseNodes";
import { ParserOutput } from "../parser/parser";
import * as AnalyzerNodeInfo from './analyzerNodeInfo';
import { Checker } from "./checker";
import { ImportResolver } from "./importResolver";
import { getParameterListDetails } from './parameterUtils';
import * as ParseTreeUtils from './parseTreeUtils';
import { getChildNodes } from "./parseTreeWalker";
import { ScopeType } from "./scope";
import { getScopeForNode } from "./scopeUtils";
import { SourceMapper } from "./sourceMapper";
import { maxCodeComplexity } from "./typeEvaluator";
import { TypeEvaluator } from "./typeEvaluatorTypes";
import { FunctionType, isClass, isOverloadedFunction, isParamSpec, isTypeVar, isUnknown, OverloadedFunctionType, Variance } from "./types";
import { isPartlyUnknown } from "./typeUtils";

// When enabled, this debug flag causes the code complexity of
// functions to be emitted.
const isPrintCodeComplexityEnabled = false;


type Type = Array<String>;

export class MyChecker extends Checker {

    constructor(
        _importResolver: ImportResolver,
        _evaluator: TypeEvaluator,
        parseResults: ParserOutput,
        _sourceMapper: SourceMapper,
        _dependentFiles?: ParserOutput[]
    ) {
        super(_importResolver, _evaluator, parseResults, _sourceMapper, _dependentFiles);

    }

    override visitFunction(node: FunctionNode): boolean {
        if (node.typeParameters) {
            this.walk(node.typeParameters);
        }

        if (!this._fileInfo.diagnosticRuleSet.analyzeUnannotatedFunctions && !this._fileInfo.isStubFile) {
            if (ParseTreeUtils.isUnannotatedFunction(node)) {
                this._evaluator.addInformation(
                    LocMessage.unannotatedFunctionSkipped().format({ name: node.name.value }),
                    node.name
                );
            }
        }

        const functionTypeResult = this._evaluator.getTypeOfFunction(node);
        const containingClassNode = ParseTreeUtils.getEnclosingClass(node, /* stopAtFunction */ true);

        if (functionTypeResult) {
            // Track whether we have seen a *args: P.args parameter. Named
            // parameters after this need to be flagged as an error.
            let sawParamSpecArgs = false;

            const keywordNames = new Set<string>();
            const paramDetails = getParameterListDetails(functionTypeResult.functionType);

            // Report any unknown or missing parameter types.
            node.parameters.forEach((param, index) => {
                if (param.name) {
                    if (param.category === ParameterCategory.Simple && index >= paramDetails.positionOnlyParamCount) {
                        keywordNames.add(param.name.value);
                    }

                    // Determine whether this is a P.args parameter.
                    if (param.category === ParameterCategory.ArgsList) {
                        const annotationExpr = param.typeAnnotation || param.typeAnnotationComment;
                        if (
                            annotationExpr &&
                            annotationExpr.nodeType === ParseNodeType.MemberAccess &&
                            annotationExpr.memberName.value === 'args'
                        ) {
                            const baseType = this._evaluator.getType(annotationExpr.leftExpression);
                            if (baseType && isTypeVar(baseType) && baseType.details.isParamSpec) {
                                sawParamSpecArgs = true;
                            }
                        }
                    } else if (param.category === ParameterCategory.KwargsDict) {
                        sawParamSpecArgs = false;
                    }
                }

                if (param.name && param.category === ParameterCategory.Simple && sawParamSpecArgs) {
                    this._evaluator.addDiagnostic(
                        DiagnosticRule.reportGeneralTypeIssues,
                        LocMessage.namedParamAfterParamSpecArgs().format({ name: param.name.value }),
                        param.name
                    );
                }

                // Allow unknown and missing param types if the param is named '_'.
                if (param.name && param.name.value !== '_') {
                    const functionTypeParam = functionTypeResult.functionType.details.parameters.find(
                        (p) => p.name === param.name?.value
                    );

                    if (functionTypeParam) {
                        const paramType = functionTypeParam.type;

                        if (this._fileInfo.diagnosticRuleSet.reportUnknownParameterType !== 'none') {
                            if (
                                isUnknown(paramType) ||
                                (isTypeVar(paramType) &&
                                    paramType.details.isSynthesized &&
                                    !paramType.details.isSynthesizedSelf)
                            ) {
                                this._evaluator.addDiagnostic(
                                    DiagnosticRule.reportUnknownParameterType,
                                    LocMessage.paramTypeUnknown().format({ paramName: param.name.value }),
                                    param.name
                                );
                            } else if (isPartlyUnknown(paramType)) {
                                const diagAddendum = new DiagnosticAddendum();
                                diagAddendum.addMessage(
                                    LocAddendum.paramType().format({
                                        paramType: this._evaluator.printType(paramType, { expandTypeAlias: true }),
                                    })
                                );
                                this._evaluator.addDiagnostic(
                                    DiagnosticRule.reportUnknownParameterType,
                                    LocMessage.paramTypePartiallyUnknown().format({
                                        paramName: param.name.value,
                                    }) + diagAddendum.getString(),
                                    param.name
                                );
                            }
                        }

                        let hasAnnotation = false;

                        if (functionTypeParam.typeAnnotation) {
                            hasAnnotation = true;
                        } else {
                            // See if this is a "self" and "cls" parameter. They are exempt from this rule.
                            if (isTypeVar(paramType) && paramType.details.isSynthesizedSelf) {
                                hasAnnotation = true;
                            }
                        }

                        if (!hasAnnotation && this._fileInfo.diagnosticRuleSet.reportMissingParameterType !== 'none') {
                            this._evaluator.addDiagnostic(
                                DiagnosticRule.reportMissingParameterType,
                                LocMessage.paramAnnotationMissing().format({ name: param.name.value }),
                                param.name
                            );
                        }
                    }
                }
            });

            // Verify that an unpacked TypedDict doesn't overlap any keyword parameters.
            if (paramDetails.hasUnpackedTypedDict) {
                const kwargsIndex = functionTypeResult.functionType.details.parameters.length - 1;
                const kwargsType = FunctionType.getEffectiveParameterType(functionTypeResult.functionType, kwargsIndex);

                if (isClass(kwargsType) && kwargsType.details.typedDictEntries) {
                    const overlappingEntries = new Set<string>();
                    kwargsType.details.typedDictEntries.knownItems.forEach((_, name) => {
                        if (keywordNames.has(name)) {
                            overlappingEntries.add(name);
                        }
                    });

                    if (overlappingEntries.size > 0) {
                        this._evaluator.addDiagnostic(
                            DiagnosticRule.reportGeneralTypeIssues,
                            LocMessage.overlappingKeywordArgs().format({
                                names: [...overlappingEntries.values()].join(', '),
                            }),
                            node.parameters[kwargsIndex].typeAnnotation ?? node.parameters[kwargsIndex]
                        );
                    }
                }
            }

            // Check for invalid use of ParamSpec P.args and P.kwargs.
            const paramSpecParams = functionTypeResult.functionType.details.parameters.filter((param) => {
                if (param.typeAnnotation && isTypeVar(param.type) && isParamSpec(param.type)) {
                    if (param.category !== ParameterCategory.Simple && param.name && param.type.paramSpecAccess) {
                        return true;
                    }
                }

                return false;
            });

            if (paramSpecParams.length === 1 && paramSpecParams[0].typeAnnotation) {
                this._evaluator.addDiagnostic(
                    DiagnosticRule.reportGeneralTypeIssues,
                    LocMessage.paramSpecArgsKwargsUsage(),
                    paramSpecParams[0].typeAnnotation
                );
            }

            // If this is a stub, ensure that the return type is specified.
            if (this._fileInfo.isStubFile) {
                const returnAnnotation =
                    node.returnTypeAnnotation || node.functionAnnotationComment?.returnTypeAnnotation;
                if (!returnAnnotation) {
                    this._evaluator.addDiagnostic(
                        DiagnosticRule.reportUnknownParameterType,
                        LocMessage.returnTypeUnknown(),
                        node.name
                    );
                }
            }

            if (containingClassNode) {
                this._validateMethod(node, functionTypeResult.functionType, containingClassNode);
            }
        }

        const callsites = getCallsites(node.suite)
        node.parameters.forEach((param, index) => {
            if (param.defaultValue) {
                this.walk(param.defaultValue);
            }

            if (param.typeAnnotation) {
                this.walk(param.typeAnnotation);
            } else {
                console.log("parameter " + param.name?.value + " needs to be annotated")
                if (param.name) {
                    let typeCandidates = this.getTypeCandidates(param.name, callsites)
                    console.log("candidates : ")
                    console.log(typeCandidates)
                    let typeToinfer = this.findIntersection(typeCandidates)
                    console.log("type to infer : " + typeToinfer)
                    if (!typeToinfer) {
                        this._evaluator.addDiagnostic(
                            DiagnosticRule.reportGeneralTypeIssues,
                            "Type incompatibility between " + typeCandidates.join("|"),
                            param.name
                        );
                    }
                }
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

                    if (
                        containingClassNode &&
                        isTypeVar(paramType) &&
                        paramType.details.declaredVariance === Variance.Covariant &&
                        !paramType.details.isSynthesized &&
                        !exemptMethods.some((name) => name === functionTypeResult.functionType.details.name)
                    ) {
                        this._evaluator.addDiagnostic(
                            DiagnosticRule.reportGeneralTypeIssues,
                            LocMessage.paramTypeCovariant(),
                            annotationNode
                        );
                    }
                }
            }
        });

        if (node.returnTypeAnnotation) {
            this.walk(node.returnTypeAnnotation);
        }

        if (node.functionAnnotationComment) {
            this.walk(node.functionAnnotationComment);

            if (
                this._fileInfo.diagnosticRuleSet.reportTypeCommentUsage !== 'none' &&
                this._fileInfo.executionEnvironment.pythonVersion.isGreaterOrEqualTo(pythonVersion3_5)
            ) {
                this._evaluator.addDiagnostic(
                    DiagnosticRule.reportTypeCommentUsage,
                    LocMessage.typeCommentDeprecated(),
                    node.functionAnnotationComment
                );
            }
        }

        this.walkMultiple(node.decorators);

        node.parameters.forEach((param) => {
            if (param.name) {
                this.walk(param.name);
            }
        });

        const codeComplexity = AnalyzerNodeInfo.getCodeFlowComplexity(node);
        const isTooComplexToAnalyze = codeComplexity > maxCodeComplexity;

        if (isPrintCodeComplexityEnabled) {
            console.log(`Code complexity of function ${node.name.value} is ${codeComplexity.toString()}`);
        }

        if (isTooComplexToAnalyze) {
            this._evaluator.addDiagnostic(
                DiagnosticRule.reportGeneralTypeIssues,
                LocMessage.codeTooComplexToAnalyze(),
                node.name
            );
        } else {
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
            if (!containingClassNode && FunctionType.isFinal(functionTypeResult.functionType)) {
                this._evaluator.addDiagnostic(
                    DiagnosticRule.reportGeneralTypeIssues,
                    LocMessage.finalNonMethod().format({ name: node.name.value }),
                    node.name
                );
            }
        }

        // If we're at the module level within a stub file, report a diagnostic
        // if there is a '__getattr__' function defined when in strict mode.
        // This signifies an incomplete stub file that obscures type errors.
        if (this._fileInfo.isStubFile && node.name.value === '__getattr__') {
            const scope = getScopeForNode(node);
            if (scope?.type === ScopeType.Module) {
                this._evaluator.addDiagnostic(
                    DiagnosticRule.reportIncompleteStub,
                    LocMessage.stubUsesGetAttr(),
                    node.name
                );
            }
        }

        this._scopedNodes.push(node);

        if (functionTypeResult && isOverloadedFunction(functionTypeResult.decoratedType)) {
            // If this is the implementation for the overloaded function, skip
            // overload consistency checks.
            if (
                OverloadedFunctionType.getImplementation(functionTypeResult.decoratedType) !==
                functionTypeResult.functionType
            ) {
                const overloads = OverloadedFunctionType.getOverloads(functionTypeResult.decoratedType);
                if (overloads.length > 1) {
                    const maxOverloadConsistencyCheckLength = 100;

                    // The check is n^2 in time, so if the number of overloads
                    // is very large (which can happen for some generated code),
                    // skip this check to avoid quadratic analysis time.
                    if (overloads.length < maxOverloadConsistencyCheckLength) {
                        this._validateOverloadConsistency(
                            node,
                            overloads[overloads.length - 1],
                            overloads.slice(0, overloads.length - 1)
                        );
                    }
                }
            }

            this._validateOverloadAttributeConsistency(node, functionTypeResult.decoratedType);
        }

        return false;
    }

    getSignatureFromCall(callsite: CallNode): ParameterNode[] {
        let inferanceInfo = this._evaluator.getTypeOfExpression(callsite).overloadsUsedForCall
        if (inferanceInfo) {
            return inferanceInfo[0].details.declaration?.node.parameters || []
        }
        return []
    }


    findIntersection(types: Type[]): Type | undefined {
        if (types.length == 0) return undefined;
        let intersection: Type | undefined = types[0]
        types.forEach((t) => {
            if (intersection === undefined) return;
            intersection = findCommonType(intersection, t)
        })
        return intersection;
    }

    getTypeCandidates(name: NameNode, callsites: CallNode[]): Type[] {
        let candidates: Type[] = []
        let parameterCallsites = callsites.filter(callsite => isParameterInCallsite(name, callsite))

        parameterCallsites.forEach(callsite => {
            //recover the rank of the parameter in the callsite
            let argRank = callsite.arguments.findIndex(arg =>
                arg.valueExpression.nodeType === ParseNodeType.Name
                && arg.valueExpression.value === name.value)
            let signature = this.getSignatureFromCall(callsite)
            let annotation = signature[argRank]?.typeAnnotation
            if (annotation?.nodeType === ParseNodeType.Name) {
                candidates.push([annotation.value])
            } else if (annotation?.nodeType === ParseNodeType.StringList) {
                candidates.push(annotation.strings[0].value.split("|"))
            }
        })

        return candidates
    }

}

function getCallsites(node: ParseNode): CallNode[] {
    let callsites: CallNode[] = [];

    if (node.nodeType === ParseNodeType.Call) {
        callsites.push(node as CallNode);
    }

    const childNodes = getChildNodes(node);
    for (const childNode of childNodes) {
        if (childNode)
            callsites.push(...getCallsites(childNode));
    }

    return callsites;
}



function isParameterInCallsite(name: NameNode, callsites: CallNode): Boolean {
    return callsites.arguments.some((arg: ArgumentNode) => {
        return arg.valueExpression.nodeType === ParseNodeType.Name
            && arg.valueExpression.value === name.value
    })
}

function intersection(type1: Type, type2: Type): Type | undefined {
    let intersection: Type = [];
    type2.forEach((t2) => {
        if (type1.some((t1) => t1 === t2)) intersection.push(t2);
    })
    if (intersection.length === 0) return undefined
    else return intersection
}

function findCommonType(type1: any, type2: any): Type | undefined {
    return intersection(type1, type2)
}

