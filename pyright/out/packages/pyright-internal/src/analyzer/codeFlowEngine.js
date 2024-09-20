"use strict";
/*
 * codeFlowEngine.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Code that traverses the code flow graph to determine the (narrowed)
 * type of a variable or expression or the reachability of a statement.
 *
 * This is largely based on the code flow engine in the
 * TypeScript compiler.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCodeFlowEngine = exports.isIncompleteType = void 0;
const debug_1 = require("../common/debug");
const positionUtils_1 = require("../common/positionUtils");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const codeFlowTypes_1 = require("./codeFlowTypes");
const codeFlowUtils_1 = require("./codeFlowUtils");
const constructors_1 = require("./constructors");
const parseTreeUtils_1 = require("./parseTreeUtils");
const patternMatching_1 = require("./patternMatching");
const typedDicts_1 = require("./typedDicts");
const typeGuards_1 = require("./typeGuards");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
// Define a user type guard function for IncompleteType.
function isIncompleteType(cachedType) {
    return !!cachedType.isIncompleteType;
}
exports.isIncompleteType = isIncompleteType;
// This debugging option prints the control flow graph when getTypeFromCodeFlow is called.
const enablePrintControlFlowGraph = false;
// This debugging option prints the results of calls to isCallNoReturn.
const enablePrintCallNoReturn = false;
// Should the code flow engine assume that an unannotated function does not have
// an inferred return type of `NoReturn`, or should it perform code flow analysis
// to determine whether it is `NoReturn`? Enabling this produces more consistent
// and complete results, but it can be very expensive.
const inferNoReturnForUnannotatedFunctions = false;
function getCodeFlowEngine(evaluator, speculativeTypeTracker) {
    const isReachableRecursionSet = new Set();
    const reachabilityCache = new Map();
    const callIsNoReturnCache = new Map();
    const isExceptionContextManagerCache = new Map();
    let flowIncompleteGeneration = 1;
    let noReturnAnalysisDepth = 0;
    let contextManagerAnalysisDepth = 0;
    // Creates a new code flow analyzer that can be used to narrow the types
    // of the expressions within an execution context. Each code flow analyzer
    // instance maintains a cache of types it has already determined.
    function createCodeFlowAnalyzer() {
        const flowNodeTypeCacheSet = new Map();
        function getFlowNodeTypeCacheForReference(referenceKey) {
            let flowNodeTypeCache = flowNodeTypeCacheSet.get(referenceKey);
            if (!flowNodeTypeCache) {
                flowNodeTypeCache = {
                    cache: new Map(),
                    pendingNodes: new Set(),
                    closedFinallyGateNodes: new Set(),
                };
                flowNodeTypeCacheSet.set(referenceKey, flowNodeTypeCache);
            }
            return flowNodeTypeCache;
        }
        // Determines whether any calls to getTypeFromCodeFlow are pending
        // for an expression other than referenceKeyFilter. This is important in cases
        // where the type of one expression depends on the type of another
        // in a loop. If there are other pending evaluations, we will mark the
        // current evaluation as incomplete and return back to the pending
        // evaluation.
        function isGetTypeFromCodeFlowPending(referenceKeyFilter) {
            if (!referenceKeyFilter) {
                return false;
            }
            for (const [key, value] of flowNodeTypeCacheSet.entries()) {
                if (key !== referenceKeyFilter && value.pendingNodes.size > 0) {
                    return true;
                }
            }
            return false;
        }
        // This function has two primary modes. The first is used to determine
        // the narrowed type of a reference expression based on code flow analysis.
        // The second (when reference is undefined) is used to determine whether
        // the specified flowNode is reachable when "never narrowing" is applied.
        function getTypeFromCodeFlow(flowNode, reference, options) {
            var _a, _b;
            if (enablePrintControlFlowGraph) {
                printControlFlowGraph(flowNode, reference, 'getTypeFromCodeFlow');
            }
            const referenceKey = reference !== undefined ? (0, codeFlowTypes_1.createKeyForReference)(reference) : undefined;
            let subexpressionReferenceKeys;
            const referenceKeyWithSymbolId = referenceKey !== undefined && (options === null || options === void 0 ? void 0 : options.targetSymbolId) !== undefined
                ? referenceKey + `.${options === null || options === void 0 ? void 0 : options.targetSymbolId.toString()}`
                : '.';
            const flowNodeTypeCache = getFlowNodeTypeCacheForReference(referenceKeyWithSymbolId);
            // Caches the type of the flow node in our local cache, keyed by the flow node ID.
            function setCacheEntry(flowNode, type, isIncomplete) {
                if (!isIncomplete) {
                    flowIncompleteGeneration++;
                }
                else if (type) {
                    const prevEntry = flowNodeTypeCache.cache.get(flowNode.id);
                    if (prevEntry) {
                        const prevIncompleteType = prevEntry;
                        if (prevIncompleteType.isIncompleteType &&
                            prevIncompleteType.type &&
                            !(0, types_1.isTypeSame)(prevIncompleteType.type, type)) {
                            flowIncompleteGeneration++;
                        }
                    }
                }
                // For speculative or incomplete types, we'll create a separate
                // object. For non-speculative and complete types, we'll store
                // the type directly.
                const entry = isIncomplete
                    ? {
                        isIncompleteType: true,
                        type,
                        incompleteSubtypes: [],
                        generationCount: flowIncompleteGeneration,
                    }
                    : type;
                flowNodeTypeCache.cache.set(flowNode.id, entry);
                speculativeTypeTracker.trackEntry(flowNodeTypeCache.cache, flowNode.id);
                return {
                    type,
                    isIncomplete,
                    generationCount: flowIncompleteGeneration,
                    incompleteSubtypes: isIncomplete ? [] : undefined,
                };
            }
            function setIncompleteSubtype(flowNode, index, type, isIncomplete, isPending, evaluationCount) {
                const cachedEntry = flowNodeTypeCache.cache.get(flowNode.id);
                if (cachedEntry === undefined || !isIncompleteType(cachedEntry)) {
                    (0, debug_1.fail)('setIncompleteSubtype can be called only on a valid incomplete cache entry: ' +
                        `prev cache entry?: ${!cachedEntry} ` +
                        `index=${index} ` +
                        `isPending=${isPending} ` +
                        `evaluationCount=${evaluationCount}`);
                }
                const incompleteEntries = cachedEntry.incompleteSubtypes;
                if (index < incompleteEntries.length) {
                    const oldEntry = incompleteEntries[index];
                    if (oldEntry.isIncomplete !== isIncomplete || !(0, types_1.isTypeSame)(oldEntry.type, type)) {
                        incompleteEntries[index] = { type, isIncomplete, isPending, evaluationCount };
                        flowIncompleteGeneration++;
                    }
                    else if (oldEntry.isPending !== isPending) {
                        incompleteEntries[index] = { type, isIncomplete, isPending, evaluationCount };
                    }
                }
                else {
                    (0, debug_1.assert)(incompleteEntries.length === index);
                    incompleteEntries.push({ type, isIncomplete, isPending, evaluationCount });
                    flowIncompleteGeneration++;
                }
                let combinedType;
                if (cachedEntry.incompleteSubtypes.length > 0) {
                    // Recompute the effective type based on all of the incomplete
                    // types we've accumulated so far.
                    const typesToCombine = [];
                    cachedEntry.incompleteSubtypes.forEach((t) => {
                        if (t.type) {
                            typesToCombine.push(t.type);
                        }
                    });
                    combinedType = typesToCombine.length > 0 ? (0, types_1.combineTypes)(typesToCombine) : undefined;
                }
                cachedEntry.type = combinedType;
                cachedEntry.generationCount = flowIncompleteGeneration;
                return getCacheEntry(flowNode);
            }
            // Cache either contains a type or an object that represents an incomplete type.
            // Incomplete types are types that haven't gone through all flow nodes yet.
            // Incomplete only happens for branch and loop nodes.
            function getCacheEntry(flowNode) {
                if (!flowNodeTypeCache.cache.has(flowNode.id)) {
                    return undefined;
                }
                const cachedEntry = flowNodeTypeCache.cache.get(flowNode.id);
                if (cachedEntry === undefined) {
                    return { type: undefined, isIncomplete: false };
                }
                if (!isIncompleteType(cachedEntry)) {
                    return { type: cachedEntry, isIncomplete: false };
                }
                return {
                    type: cachedEntry.type,
                    isIncomplete: true,
                    incompleteSubtypes: cachedEntry.incompleteSubtypes,
                    generationCount: cachedEntry.generationCount,
                };
            }
            function deleteCacheEntry(flowNode) {
                flowNodeTypeCache.cache.delete(flowNode.id);
            }
            function evaluateAssignmentFlowNode(flowNode) {
                // For function and class nodes, the reference node is the name
                // node, but we need to use the parent node (the FunctionNode or ClassNode)
                // to access the decorated type in the type cache.
                let nodeForCacheLookup = flowNode.node;
                const parentNode = flowNode.node.parent;
                if (parentNode) {
                    if (parentNode.nodeType === 31 /* ParseNodeType.Function */ || parentNode.nodeType === 10 /* ParseNodeType.Class */) {
                        nodeForCacheLookup = parentNode;
                    }
                }
                return evaluator.evaluateTypeForSubnode(nodeForCacheLookup, () => {
                    evaluator.evaluateTypesForStatement(flowNode.node);
                });
            }
            function preventRecursion(flowNode, callback) {
                flowNodeTypeCache.pendingNodes.add(flowNode.id);
                try {
                    const result = callback();
                    flowNodeTypeCache.pendingNodes.delete(flowNode.id);
                    return result;
                }
                catch (e) {
                    // Don't use a "finally" clause here because the TypeScript
                    // debugger doesn't handle "step out" well with finally clauses.
                    flowNodeTypeCache.pendingNodes.delete(flowNode.id);
                    throw e;
                }
            }
            // If this flow has no knowledge of the target expression, it returns undefined.
            // If the start flow node for this scope is reachable, the typeAtStart value is
            // returned.
            function getTypeFromFlowNode(flowNode) {
                var _a, _b, _c, _d, _e, _f;
                let curFlowNode = flowNode;
                // This is a frequently-called routine, so it's a good place to call
                // the cancellation check. If the operation is canceled, an exception
                // will be thrown at this point.
                evaluator.checkForCancellation();
                while (true) {
                    // Have we already been here? If so, use the cached value.
                    const cachedEntry = getCacheEntry(curFlowNode);
                    if (cachedEntry) {
                        if (!cachedEntry.isIncomplete) {
                            return cachedEntry;
                        }
                        // If the cached entry is incomplete, we can use it only if nothing
                        // has changed that may cause the previously-reported incomplete type to change.
                        if (cachedEntry.generationCount === flowIncompleteGeneration) {
                            return {
                                type: cachedEntry.type ? (0, typeUtils_1.cleanIncompleteUnknown)(cachedEntry.type) : undefined,
                                isIncomplete: true,
                            };
                        }
                    }
                    // Check for recursion.
                    if (flowNodeTypeCache.pendingNodes.has(curFlowNode.id)) {
                        return {
                            type: (_a = cachedEntry === null || cachedEntry === void 0 ? void 0 : cachedEntry.type) !== null && _a !== void 0 ? _a : types_1.UnknownType.create(/* isIncomplete */ true),
                            isIncomplete: true,
                        };
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Unreachable) {
                        // We can get here if there are nodes in a compound logical expression
                        // (e.g. "False and x") that are never executed but are evaluated.
                        return setCacheEntry(curFlowNode, types_1.NeverType.createNever(), /* isIncomplete */ false);
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.VariableAnnotation) {
                        const varAnnotationNode = curFlowNode;
                        curFlowNode = varAnnotationNode.antecedent;
                        continue;
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Call) {
                        const callFlowNode = curFlowNode;
                        // If this function returns a "NoReturn" type, that means
                        // it always raises an exception or otherwise doesn't return,
                        // so we can assume that the code before this is unreachable.
                        if (isCallNoReturn(evaluator, callFlowNode)) {
                            return setCacheEntry(curFlowNode, /* type */ undefined, /* isIncomplete */ false);
                        }
                        curFlowNode = callFlowNode.antecedent;
                        continue;
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Assignment) {
                        const assignmentFlowNode = curFlowNode;
                        const targetNode = assignmentFlowNode.node;
                        // Are we targeting the same symbol? We need to do this extra check because the same
                        // symbol name might refer to different symbols in different scopes (e.g. a list
                        // comprehension introduces a new scope).
                        if (reference) {
                            if ((options === null || options === void 0 ? void 0 : options.targetSymbolId) === assignmentFlowNode.targetSymbolId &&
                                (0, parseTreeUtils_1.isMatchingExpression)(reference, targetNode)) {
                                // Is this a special "unbind" assignment? If so,
                                // we can handle it immediately without any further evaluation.
                                if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Unbind) {
                                    // Don't treat unbound assignments to indexed expressions (i.e. "del x[0]")
                                    // as true deletions. The most common use case for "del x[0]" is in a list,
                                    // and the list class treats this as an element deletion, not an assignment.
                                    if (reference.nodeType === 27 /* ParseNodeType.Index */) {
                                        // No need to explore further.
                                        return setCacheEntry(curFlowNode, undefined, /* isIncomplete */ false);
                                    }
                                    // Don't treat unbound assignments to member access expressions (i.e. "del a.x")
                                    // as true deletions either. These may go through a descriptor object __delete__
                                    // method or a __delattr__ method on the class.
                                    if (reference.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                                        // No need to explore further.
                                        return setCacheEntry(curFlowNode, undefined, /* isIncomplete */ false);
                                    }
                                    return setCacheEntry(curFlowNode, types_1.UnboundType.create(), /* isIncomplete */ false);
                                }
                                let flowTypeResult = preventRecursion(curFlowNode, () => evaluateAssignmentFlowNode(assignmentFlowNode));
                                if (flowTypeResult) {
                                    if ((0, typeUtils_1.isTypeAliasPlaceholder)(flowTypeResult.type)) {
                                        // Don't cache a recursive type alias placeholder.
                                        return {
                                            type: flowTypeResult.type,
                                            isIncomplete: true,
                                        };
                                    }
                                    else if (reference.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                                        evaluator.isAsymmetricAccessorAssignment(targetNode)) {
                                        flowTypeResult = undefined;
                                    }
                                }
                                return setCacheEntry(curFlowNode, flowTypeResult === null || flowTypeResult === void 0 ? void 0 : flowTypeResult.type, !!(flowTypeResult === null || flowTypeResult === void 0 ? void 0 : flowTypeResult.isIncomplete));
                            }
                            // Is this a simple assignment to an index expression? If so, it could
                            // be assigning to a TypedDict, which requires narrowing of the expression's
                            // base type.
                            if (targetNode.nodeType === 27 /* ParseNodeType.Index */ &&
                                (0, parseTreeUtils_1.isMatchingExpression)(reference, targetNode.baseExpression)) {
                                if (((_b = targetNode.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 3 /* ParseNodeType.Assignment */ &&
                                    targetNode.items.length === 1 &&
                                    !targetNode.trailingComma &&
                                    !targetNode.items[0].name &&
                                    targetNode.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
                                    targetNode.items[0].valueExpression.nodeType === 48 /* ParseNodeType.StringList */ &&
                                    targetNode.items[0].valueExpression.strings.length === 1 &&
                                    targetNode.items[0].valueExpression.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                                    const keyValue = targetNode.items[0].valueExpression.strings[0].value;
                                    const narrowedResult = preventRecursion(assignmentFlowNode, () => {
                                        const flowTypeResult = getTypeFromFlowNode(assignmentFlowNode.antecedent);
                                        if (flowTypeResult.type) {
                                            flowTypeResult.type = (0, typeUtils_1.mapSubtypes)(flowTypeResult.type, (subtype) => {
                                                if ((0, types_1.isClass)(subtype) && types_1.ClassType.isTypedDictClass(subtype)) {
                                                    return (0, typedDicts_1.narrowForKeyAssignment)(subtype, keyValue);
                                                }
                                                return subtype;
                                            });
                                        }
                                        return flowTypeResult;
                                    });
                                    return setCacheEntry(curFlowNode, narrowedResult === null || narrowedResult === void 0 ? void 0 : narrowedResult.type, !!(narrowedResult === null || narrowedResult === void 0 ? void 0 : narrowedResult.isIncomplete));
                                }
                            }
                            if ((0, parseTreeUtils_1.isPartialMatchingExpression)(reference, targetNode)) {
                                // If the node partially matches the reference, we need to "kill" any narrowed
                                // types further above this point. For example, if we see the sequence
                                //    a.b = 3
                                //    a = Foo()
                                //    x = a.b
                                // The type of "a.b" can no longer be assumed to be Literal[3].
                                return {
                                    type: (_c = options === null || options === void 0 ? void 0 : options.typeAtStart) === null || _c === void 0 ? void 0 : _c.type,
                                    isIncomplete: !!((_d = options === null || options === void 0 ? void 0 : options.typeAtStart) === null || _d === void 0 ? void 0 : _d.isIncomplete),
                                };
                            }
                        }
                        curFlowNode = assignmentFlowNode.antecedent;
                        continue;
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.BranchLabel) {
                        const branchFlowNode = curFlowNode;
                        if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.PostContextManager) {
                            // Determine whether any of the context managers support exception
                            // suppression. If not, none of its antecedents are reachable.
                            const contextMgrNode = curFlowNode;
                            const contextManagerSwallowsExceptions = contextMgrNode.expressions.some((expr) => isExceptionContextManager(evaluator, expr, contextMgrNode.isAsync));
                            if (contextManagerSwallowsExceptions === contextMgrNode.blockIfSwallowsExceptions) {
                                // Do not explore any further along this code flow path.
                                return setCacheEntry(curFlowNode, /* type */ undefined, /* isIncomplete */ false);
                            }
                        }
                        // Is the current symbol modified in any way within the scope of the branch?
                        // If not, we can skip all processing within the branch scope.
                        if (reference && branchFlowNode.preBranchAntecedent && branchFlowNode.affectedExpressions) {
                            if (!subexpressionReferenceKeys) {
                                subexpressionReferenceKeys = (0, codeFlowTypes_1.createKeysForReferenceSubexpressions)(reference);
                            }
                            if (!subexpressionReferenceKeys.some((key) => branchFlowNode.affectedExpressions.has(key)) &&
                                isFlowNodeReachable(curFlowNode, branchFlowNode.preBranchAntecedent)) {
                                curFlowNode = branchFlowNode.preBranchAntecedent;
                                continue;
                            }
                        }
                        return getTypeFromBranchFlowNode(curFlowNode);
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.LoopLabel) {
                        const loopNode = curFlowNode;
                        // Is the current symbol modified in any way within the loop? If not, we can skip all
                        // processing within the loop and assume that the type comes from the first antecedent,
                        // which feeds the loop.
                        if (reference) {
                            if (!subexpressionReferenceKeys) {
                                subexpressionReferenceKeys = (0, codeFlowTypes_1.createKeysForReferenceSubexpressions)(reference);
                            }
                            if (!subexpressionReferenceKeys.some((key) => loopNode.affectedExpressions.has(key))) {
                                curFlowNode = loopNode.antecedents[0];
                                continue;
                            }
                        }
                        return getTypeFromLoopFlowNode(loopNode, cachedEntry);
                    }
                    if (curFlowNode.flags & (codeFlowTypes_1.FlowFlags.TrueCondition | codeFlowTypes_1.FlowFlags.FalseCondition)) {
                        const conditionalFlowNode = curFlowNode;
                        if (!(options === null || options === void 0 ? void 0 : options.skipConditionalNarrowing) && reference) {
                            const narrowedResult = preventRecursion(curFlowNode, () => {
                                const typeNarrowingCallback = (0, typeGuards_1.getTypeNarrowingCallback)(evaluator, reference, conditionalFlowNode.expression, !!(conditionalFlowNode.flags &
                                    (codeFlowTypes_1.FlowFlags.TrueCondition | codeFlowTypes_1.FlowFlags.TrueNeverCondition)));
                                if (typeNarrowingCallback) {
                                    const flowTypeResult = getTypeFromFlowNode(conditionalFlowNode.antecedent);
                                    let flowType = flowTypeResult.type;
                                    let isIncomplete = flowTypeResult.isIncomplete;
                                    if (flowType) {
                                        const flowTypeResult = typeNarrowingCallback(flowType);
                                        if (flowTypeResult) {
                                            flowType = flowTypeResult.type;
                                            if (flowTypeResult.isIncomplete) {
                                                isIncomplete = true;
                                            }
                                        }
                                    }
                                    return setCacheEntry(curFlowNode, flowType, isIncomplete);
                                }
                                return undefined;
                            });
                            if (narrowedResult) {
                                return narrowedResult;
                            }
                        }
                        curFlowNode = conditionalFlowNode.antecedent;
                        continue;
                    }
                    if (curFlowNode.flags & (codeFlowTypes_1.FlowFlags.TrueNeverCondition | codeFlowTypes_1.FlowFlags.FalseNeverCondition)) {
                        const conditionalFlowNode = curFlowNode;
                        if (!(options === null || options === void 0 ? void 0 : options.skipConditionalNarrowing) && conditionalFlowNode.reference) {
                            // Don't allow apply if the conditional expression references the expression
                            // we're already narrowing. This case will be handled by the TrueCondition
                            // or FalseCondition node.
                            if ((0, codeFlowTypes_1.createKeyForReference)(conditionalFlowNode.reference) !== referenceKey) {
                                // Make sure the reference type has a declared type. If not,
                                // don't bother trying to infer its type because that would be
                                // too expensive.
                                const symbolWithScope = evaluator.lookUpSymbolRecursive(conditionalFlowNode.reference, conditionalFlowNode.reference.value, 
                                /* honorCodeFlow */ false);
                                if (symbolWithScope && symbolWithScope.symbol.hasTypedDeclarations()) {
                                    const result = preventRecursion(curFlowNode, () => {
                                        const typeNarrowingCallback = (0, typeGuards_1.getTypeNarrowingCallback)(evaluator, conditionalFlowNode.reference, conditionalFlowNode.expression, !!(conditionalFlowNode.flags &
                                            (codeFlowTypes_1.FlowFlags.TrueCondition | codeFlowTypes_1.FlowFlags.TrueNeverCondition)));
                                        if (typeNarrowingCallback) {
                                            const refTypeInfo = evaluator.getTypeOfExpression(conditionalFlowNode.reference);
                                            let narrowedType = refTypeInfo.type;
                                            let isIncomplete = !!refTypeInfo.isIncomplete;
                                            const narrowedTypeResult = typeNarrowingCallback(refTypeInfo.type);
                                            if (narrowedTypeResult) {
                                                narrowedType = narrowedTypeResult.type;
                                                if (narrowedTypeResult.isIncomplete) {
                                                    isIncomplete = true;
                                                }
                                            }
                                            // If the narrowed type is "never", don't allow further exploration.
                                            if ((0, types_1.isNever)(narrowedType)) {
                                                return setCacheEntry(curFlowNode, undefined, isIncomplete);
                                            }
                                        }
                                        return undefined;
                                    });
                                    if (result) {
                                        return result;
                                    }
                                }
                            }
                        }
                        curFlowNode = conditionalFlowNode.antecedent;
                        continue;
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.ExhaustedMatch) {
                        const exhaustedMatchFlowNode = curFlowNode;
                        const narrowedTypeResult = evaluator.evaluateTypeForSubnode(exhaustedMatchFlowNode.node, () => {
                            evaluator.evaluateTypesForMatchStatement(exhaustedMatchFlowNode.node);
                        });
                        // If the narrowed type is "never", don't allow further exploration.
                        if (narrowedTypeResult) {
                            if ((0, types_1.isNever)(narrowedTypeResult.type)) {
                                return setCacheEntry(curFlowNode, narrowedTypeResult.type, !!narrowedTypeResult.isIncomplete);
                            }
                            if (reference) {
                                // See if the reference is a subexpression within the subject expression.
                                const typeNarrowingCallback = (0, patternMatching_1.getPatternSubtypeNarrowingCallback)(evaluator, reference, exhaustedMatchFlowNode.subjectExpression);
                                if (typeNarrowingCallback) {
                                    const subexpressionTypeResult = typeNarrowingCallback(narrowedTypeResult.type);
                                    if (subexpressionTypeResult) {
                                        return setCacheEntry(curFlowNode, subexpressionTypeResult.type, !!narrowedTypeResult.isIncomplete || !!subexpressionTypeResult.isIncomplete);
                                    }
                                }
                            }
                        }
                        curFlowNode = exhaustedMatchFlowNode.antecedent;
                        continue;
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.NarrowForPattern) {
                        const patternFlowNode = curFlowNode;
                        if (!reference || (0, parseTreeUtils_1.isMatchingExpression)(reference, patternFlowNode.subjectExpression)) {
                            const typeResult = evaluator.evaluateTypeForSubnode(patternFlowNode.statement, () => {
                                if (patternFlowNode.statement.nodeType === 64 /* ParseNodeType.Case */) {
                                    evaluator.evaluateTypesForCaseStatement(patternFlowNode.statement);
                                }
                                else {
                                    evaluator.evaluateTypesForMatchStatement(patternFlowNode.statement);
                                }
                            });
                            if (typeResult) {
                                if (!reference) {
                                    if ((0, types_1.isNever)(typeResult.type)) {
                                        return setCacheEntry(curFlowNode, 
                                        /* type */ undefined, !!typeResult.isIncomplete);
                                    }
                                }
                                else {
                                    return setCacheEntry(curFlowNode, typeResult.type, !!typeResult.isIncomplete);
                                }
                            }
                        }
                        else if (patternFlowNode.statement.nodeType === 64 /* ParseNodeType.Case */) {
                            const caseStatement = patternFlowNode.statement;
                            // See if the reference is a subexpression within the subject expression.
                            const typeNarrowingCallback = (0, patternMatching_1.getPatternSubtypeNarrowingCallback)(evaluator, reference, patternFlowNode.subjectExpression);
                            if (typeNarrowingCallback) {
                                const typeResult = evaluator.evaluateTypeForSubnode(caseStatement, () => {
                                    evaluator.evaluateTypesForCaseStatement(caseStatement);
                                });
                                if (typeResult) {
                                    const narrowedTypeResult = typeNarrowingCallback(typeResult.type);
                                    if (narrowedTypeResult) {
                                        return setCacheEntry(curFlowNode, narrowedTypeResult.type, !!typeResult.isIncomplete || !!narrowedTypeResult.isIncomplete);
                                    }
                                }
                            }
                        }
                        curFlowNode = patternFlowNode.antecedent;
                        continue;
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.PreFinallyGate) {
                        return getTypeFromPreFinallyGateFlowNode(curFlowNode);
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.PostFinally) {
                        return getTypeFromPostFinallyFlowNode(curFlowNode);
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Start) {
                        return setCacheEntry(curFlowNode, (_e = options === null || options === void 0 ? void 0 : options.typeAtStart) === null || _e === void 0 ? void 0 : _e.type, !!((_f = options === null || options === void 0 ? void 0 : options.typeAtStart) === null || _f === void 0 ? void 0 : _f.isIncomplete));
                    }
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.WildcardImport) {
                        const wildcardImportFlowNode = curFlowNode;
                        if (reference && reference.nodeType === 38 /* ParseNodeType.Name */) {
                            const nameValue = reference.value;
                            if (wildcardImportFlowNode.names.some((name) => name === nameValue)) {
                                return preventRecursion(curFlowNode, () => {
                                    const type = getTypeFromWildcardImport(wildcardImportFlowNode, nameValue);
                                    return setCacheEntry(curFlowNode, type, /* isIncomplete */ false);
                                });
                            }
                        }
                        curFlowNode = wildcardImportFlowNode.antecedent;
                        continue;
                    }
                    // We shouldn't get here.
                    (0, debug_1.fail)('Unexpected flow node flags');
                }
            }
            function getTypeFromBranchFlowNode(branchNode) {
                const typesToCombine = [];
                let sawIncomplete = false;
                for (const antecedent of branchNode.antecedents) {
                    const flowTypeResult = getTypeFromFlowNode(antecedent);
                    if (reference === undefined && flowTypeResult.type && !(0, types_1.isNever)(flowTypeResult.type)) {
                        // If we're solving for "reachability", and we have now proven
                        // reachability, there's no reason to do more work. The type we
                        // return here doesn't matter as long as it's not undefined.
                        return setCacheEntry(branchNode, types_1.UnknownType.create(), /* isIncomplete */ false);
                    }
                    if (flowTypeResult.isIncomplete) {
                        sawIncomplete = true;
                    }
                    if (flowTypeResult.type) {
                        typesToCombine.push(flowTypeResult.type);
                    }
                }
                const effectiveType = typesToCombine.length > 0 ? (0, types_1.combineTypes)(typesToCombine) : undefined;
                return setCacheEntry(branchNode, effectiveType, sawIncomplete);
            }
            function getTypeFromLoopFlowNode(loopNode, cacheEntry) {
                var _a;
                // The type result from one antecedent may depend on the type
                // result from another, so loop up to one time for each
                // antecedent in the loop.
                const maxAttemptCount = loopNode.antecedents.length;
                if (cacheEntry === undefined) {
                    // We haven't been here before, so create a new incomplete cache entry.
                    cacheEntry = setCacheEntry(loopNode, reference ? undefined : types_1.UnknownType.create(), 
                    /* isIncomplete */ true);
                }
                else if (cacheEntry.incompleteSubtypes &&
                    cacheEntry.incompleteSubtypes.length === loopNode.antecedents.length &&
                    cacheEntry.incompleteSubtypes.some((subtype) => subtype.isPending)) {
                    // If entries have been added for all antecedents and there are pending entries
                    // that have not been evaluated even once, treat it as incomplete. We clean
                    // any incomplete unknowns from the type here to assist with type convergence.
                    return {
                        type: cacheEntry.type ? (0, typeUtils_1.cleanIncompleteUnknown)(cacheEntry.type) : undefined,
                        isIncomplete: true,
                    };
                }
                let attemptCount = 0;
                while (true) {
                    let sawIncomplete = false;
                    let sawPending = false;
                    let isProvenReachable = reference === undefined &&
                        ((_a = cacheEntry.incompleteSubtypes) === null || _a === void 0 ? void 0 : _a.some((subtype) => subtype.type !== undefined));
                    let firstAntecedentTypeIsIncomplete = false;
                    let firstAntecedentTypeIsPending = false;
                    loopNode.antecedents.forEach((antecedent, index) => {
                        var _a, _b;
                        // If we've trying to determine reachability and we've already proven
                        // reachability, then we're done.
                        if (reference === undefined && isProvenReachable) {
                            return;
                        }
                        if (firstAntecedentTypeIsPending && index > 0) {
                            return;
                        }
                        cacheEntry = getCacheEntry(loopNode);
                        // Is this entry marked "pending"? If so, we have recursed and there
                        // is another call on the stack that is actively evaluating this
                        // antecedent. Skip it here to avoid infinite recursion but note that
                        // we skipped a "pending" antecedent.
                        if (cacheEntry.incompleteSubtypes &&
                            index < cacheEntry.incompleteSubtypes.length &&
                            cacheEntry.incompleteSubtypes[index].isPending) {
                            // In rare circumstances, it's possible for a code flow graph with
                            // nested loops to hit the case where the first antecedent is marked
                            // as pending. In this case, we'll evaluate only the first antecedent
                            // again even though it's pending. We're guaranteed to make forward
                            // progress with the first antecedent, and that will allow us to establish
                            // an initial type for this expression, but we don't want to evaluate
                            // any other antecedents in this case because this could result in
                            // infinite recursion.
                            if (index === 0) {
                                firstAntecedentTypeIsPending = true;
                            }
                            else {
                                sawIncomplete = true;
                                sawPending = true;
                                return;
                            }
                        }
                        // Have we already been here (i.e. does the entry exist and is
                        // not marked "pending")? If so, we can use the type that was already
                        // computed if it is complete.
                        const subtypeEntry = cacheEntry.incompleteSubtypes !== undefined && index < cacheEntry.incompleteSubtypes.length
                            ? cacheEntry.incompleteSubtypes[index]
                            : undefined;
                        if (subtypeEntry === undefined || (!(subtypeEntry === null || subtypeEntry === void 0 ? void 0 : subtypeEntry.isPending) && (subtypeEntry === null || subtypeEntry === void 0 ? void 0 : subtypeEntry.isIncomplete))) {
                            const entryEvaluationCount = subtypeEntry === undefined ? 0 : subtypeEntry.evaluationCount;
                            // Set this entry to "pending" to prevent infinite recursion.
                            // We'll mark it "not pending" below.
                            cacheEntry = setIncompleteSubtype(loopNode, index, (_a = subtypeEntry === null || subtypeEntry === void 0 ? void 0 : subtypeEntry.type) !== null && _a !== void 0 ? _a : types_1.UnknownType.create(/* isIncomplete */ true), 
                            /* isIncomplete */ true, 
                            /* isPending */ true, entryEvaluationCount);
                            try {
                                const flowTypeResult = getTypeFromFlowNode(antecedent);
                                if (flowTypeResult.isIncomplete) {
                                    sawIncomplete = true;
                                    if (index === 0) {
                                        firstAntecedentTypeIsIncomplete = true;
                                    }
                                }
                                cacheEntry = setIncompleteSubtype(loopNode, index, (_b = flowTypeResult.type) !== null && _b !== void 0 ? _b : (flowTypeResult.isIncomplete
                                    ? types_1.UnknownType.create(/* isIncomplete */ true)
                                    : types_1.NeverType.createNever()), flowTypeResult.isIncomplete, 
                                /* isPending */ firstAntecedentTypeIsPending, entryEvaluationCount + 1);
                            }
                            catch (e) {
                                cacheEntry = setIncompleteSubtype(loopNode, index, types_1.UnknownType.create(/* isIncomplete */ true), 
                                /* isIncomplete */ true, 
                                /* isPending */ firstAntecedentTypeIsPending, entryEvaluationCount + 1);
                                throw e;
                            }
                        }
                        if (reference === undefined && (cacheEntry === null || cacheEntry === void 0 ? void 0 : cacheEntry.type) !== undefined) {
                            isProvenReachable = true;
                        }
                    });
                    if (isProvenReachable) {
                        // If we saw a pending entry, do not save over the top of the cache
                        // entry because we'll overwrite a pending evaluation. The type that
                        // we return here doesn't matter as long as it's not undefined.
                        return sawPending
                            ? { type: types_1.UnknownType.create(), isIncomplete: false }
                            : setCacheEntry(loopNode, types_1.UnknownType.create(), /* isIncomplete */ false);
                    }
                    let effectiveType = cacheEntry.type;
                    if (sawIncomplete) {
                        // If there is an incomplete "Unknown" type within a union type, remove
                        // it. Otherwise we might end up resolving the cycle with a type
                        // that includes an undesirable unknown.
                        if (effectiveType) {
                            const cleanedType = (0, typeUtils_1.cleanIncompleteUnknown)(effectiveType);
                            if (cleanedType !== effectiveType) {
                                effectiveType = cleanedType;
                            }
                        }
                    }
                    if (!sawIncomplete || attemptCount >= maxAttemptCount) {
                        // If we were able to evaluate a type along at least one antecedent
                        // path, mark it as complete. If we couldn't evaluate a type along
                        // any antecedent path, assume that some recursive call further
                        // up the stack will be able to produce a valid type.
                        let reportIncomplete = sawIncomplete;
                        if (sawIncomplete &&
                            !sawPending &&
                            !isGetTypeFromCodeFlowPending(referenceKeyWithSymbolId) &&
                            effectiveType &&
                            !(0, typeUtils_1.isIncompleteUnknown)(effectiveType) &&
                            !firstAntecedentTypeIsIncomplete) {
                            reportIncomplete = false;
                        }
                        // If we saw a pending or incomplete entry, do not save over the top
                        // of the cache entry because we'll overwrite the partial result.
                        if (sawPending || sawIncomplete) {
                            if (!reportIncomplete) {
                                // Bump the generation count because we need to recalculate
                                // other incomplete types based on this now-complete type.
                                flowIncompleteGeneration++;
                            }
                            return { type: effectiveType, isIncomplete: reportIncomplete };
                        }
                        // If the first antecedent was pending, we skipped all of the other
                        // antecedents, so the type is incomplete.
                        if (firstAntecedentTypeIsPending) {
                            return { type: effectiveType, isIncomplete: true };
                        }
                        return setCacheEntry(loopNode, effectiveType, /* isIncomplete */ false);
                    }
                    attemptCount++;
                }
            }
            function getTypeFromPreFinallyGateFlowNode(preFinallyFlowNode) {
                // Is the finally gate closed?
                if (flowNodeTypeCache.closedFinallyGateNodes.has(preFinallyFlowNode.id)) {
                    return { type: undefined, isIncomplete: false };
                }
                const flowTypeResult = getTypeFromFlowNode(preFinallyFlowNode.antecedent);
                // We want to cache the type only if we're evaluating the "gate closed" path.
                deleteCacheEntry(preFinallyFlowNode);
                return {
                    type: flowTypeResult.type,
                    isIncomplete: flowTypeResult.isIncomplete,
                };
            }
            function getTypeFromPostFinallyFlowNode(postFinallyFlowNode) {
                const wasGateClosed = flowNodeTypeCache.closedFinallyGateNodes.has(postFinallyFlowNode.preFinallyGate.id);
                try {
                    flowNodeTypeCache.closedFinallyGateNodes.add(postFinallyFlowNode.preFinallyGate.id);
                    let flowTypeResult;
                    // Use speculative mode for the remainder of the finally suite
                    // because the final types within this parse node block should be
                    // evaluated when the gate is open.
                    evaluator.useSpeculativeMode(postFinallyFlowNode.finallyNode, () => {
                        flowTypeResult = getTypeFromFlowNode(postFinallyFlowNode.antecedent);
                    });
                    // If the type is incomplete, don't write back to the cache.
                    return flowTypeResult.isIncomplete
                        ? flowTypeResult
                        : setCacheEntry(postFinallyFlowNode, flowTypeResult.type, /* isIncomplete */ false);
                }
                finally {
                    if (!wasGateClosed) {
                        flowNodeTypeCache.closedFinallyGateNodes.delete(postFinallyFlowNode.preFinallyGate.id);
                    }
                }
            }
            if (!flowNode) {
                // This should happen only in cases where we're evaluating
                // parse nodes that are created after the initial parse
                // (namely, string literals that are used for forward
                // referenced types).
                return {
                    type: (_a = options === null || options === void 0 ? void 0 : options.typeAtStart) === null || _a === void 0 ? void 0 : _a.type,
                    isIncomplete: !!((_b = options === null || options === void 0 ? void 0 : options.typeAtStart) === null || _b === void 0 ? void 0 : _b.isIncomplete),
                };
            }
            return getTypeFromFlowNode(flowNode);
        }
        return {
            getTypeFromCodeFlow,
        };
    }
    // Determines whether the specified flowNode can be reached by any
    // control flow path within the execution context. If sourceFlowNode
    // is specified, it returns true only if at least one control flow
    // path passes through sourceFlowNode.
    function isFlowNodeReachable(flowNode, sourceFlowNode, ignoreNoReturn = false) {
        const visitedFlowNodeSet = new Set();
        const closedFinallyGateSet = new Set();
        if (enablePrintControlFlowGraph) {
            printControlFlowGraph(flowNode, /* reference */ undefined, 'isFlowNodeReachable');
        }
        function cacheReachabilityResult(isReachable) {
            // If there is a finally gate set, we will not cache the results
            // because this can affect the reachability.
            if (closedFinallyGateSet.size > 0) {
                return isReachable;
            }
            let cacheEntry = reachabilityCache.get(flowNode.id);
            if (!cacheEntry) {
                cacheEntry = { isReachable: undefined, isReachableFrom: new Map() };
                reachabilityCache.set(flowNode.id, cacheEntry);
            }
            if (!sourceFlowNode) {
                cacheEntry.isReachable = isReachable;
            }
            else {
                cacheEntry.isReachableFrom.set(sourceFlowNode.id, isReachable);
            }
            return isReachable;
        }
        function isFlowNodeReachableRecursive(flowNode, recursionCount = 0) {
            var _a;
            // Cut off the recursion at some point to prevent a stack overflow.
            const maxFlowNodeReachableRecursionCount = 64;
            if (recursionCount > maxFlowNodeReachableRecursionCount) {
                return true;
            }
            recursionCount++;
            let curFlowNode = flowNode;
            while (true) {
                // See if we've already cached this result.
                const cacheEntry = reachabilityCache.get(flowNode.id);
                if (cacheEntry !== undefined && closedFinallyGateSet.size === 0) {
                    if (!sourceFlowNode) {
                        if (cacheEntry.isReachable !== undefined) {
                            return cacheEntry.isReachable;
                        }
                    }
                    else {
                        const isReachableFrom = cacheEntry.isReachableFrom.get(sourceFlowNode.id);
                        if (isReachableFrom !== undefined) {
                            return isReachableFrom;
                        }
                    }
                }
                // If we've already visited this node, we can assume
                // it wasn't reachable.
                if (visitedFlowNodeSet.has(curFlowNode.id)) {
                    return cacheReachabilityResult(false);
                }
                // Note that we've been here before.
                visitedFlowNodeSet.add(curFlowNode.id);
                if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Unreachable) {
                    return cacheReachabilityResult(false);
                }
                if (curFlowNode === sourceFlowNode) {
                    return cacheReachabilityResult(true);
                }
                if (curFlowNode.flags &
                    (codeFlowTypes_1.FlowFlags.VariableAnnotation |
                        codeFlowTypes_1.FlowFlags.Assignment |
                        codeFlowTypes_1.FlowFlags.WildcardImport |
                        codeFlowTypes_1.FlowFlags.NarrowForPattern |
                        codeFlowTypes_1.FlowFlags.ExhaustedMatch)) {
                    const typedFlowNode = curFlowNode;
                    curFlowNode = typedFlowNode.antecedent;
                    continue;
                }
                if (curFlowNode.flags &
                    (codeFlowTypes_1.FlowFlags.TrueCondition |
                        codeFlowTypes_1.FlowFlags.FalseCondition |
                        codeFlowTypes_1.FlowFlags.TrueNeverCondition |
                        codeFlowTypes_1.FlowFlags.FalseNeverCondition)) {
                    const conditionalFlowNode = curFlowNode;
                    if (conditionalFlowNode.reference) {
                        // Make sure the reference type has a declared type. If not,
                        // don't bother trying to infer its type because that would be
                        // too expensive.
                        const symbolWithScope = evaluator.lookUpSymbolRecursive(conditionalFlowNode.reference, conditionalFlowNode.reference.value, 
                        /* honorCodeFlow */ false);
                        if (symbolWithScope && symbolWithScope.symbol.hasTypedDeclarations()) {
                            let isUnreachable = false;
                            const typeNarrowingCallback = (0, typeGuards_1.getTypeNarrowingCallback)(evaluator, conditionalFlowNode.reference, conditionalFlowNode.expression, !!(conditionalFlowNode.flags & (codeFlowTypes_1.FlowFlags.TrueCondition | codeFlowTypes_1.FlowFlags.TrueNeverCondition)));
                            if (typeNarrowingCallback) {
                                const refTypeInfo = evaluator.getTypeOfExpression(conditionalFlowNode.reference);
                                const narrowedTypeResult = typeNarrowingCallback(refTypeInfo.type);
                                const narrowedType = (_a = narrowedTypeResult === null || narrowedTypeResult === void 0 ? void 0 : narrowedTypeResult.type) !== null && _a !== void 0 ? _a : refTypeInfo.type;
                                if ((0, types_1.isNever)(narrowedType) && !refTypeInfo.isIncomplete) {
                                    isUnreachable = true;
                                }
                            }
                            if (isUnreachable) {
                                return cacheReachabilityResult(false);
                            }
                        }
                    }
                    curFlowNode = conditionalFlowNode.antecedent;
                    continue;
                }
                if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Call) {
                    const callFlowNode = curFlowNode;
                    // If this function returns a "NoReturn" type, that means
                    // it always raises an exception or otherwise doesn't return,
                    // so we can assume that the code before this is unreachable.
                    if (!ignoreNoReturn && isCallNoReturn(evaluator, callFlowNode)) {
                        return cacheReachabilityResult(false);
                    }
                    curFlowNode = callFlowNode.antecedent;
                    continue;
                }
                if (curFlowNode.flags & (codeFlowTypes_1.FlowFlags.BranchLabel | codeFlowTypes_1.FlowFlags.LoopLabel)) {
                    if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.PostContextManager) {
                        // Determine whether any of the context managers support exception
                        // suppression. If not, none of its antecedents are reachable.
                        const contextMgrNode = curFlowNode;
                        if (!contextMgrNode.expressions.some((expr) => isExceptionContextManager(evaluator, expr, contextMgrNode.isAsync))) {
                            return cacheReachabilityResult(false);
                        }
                    }
                    const labelNode = curFlowNode;
                    for (const antecedent of labelNode.antecedents) {
                        if (isFlowNodeReachableRecursive(antecedent, recursionCount)) {
                            return cacheReachabilityResult(true);
                        }
                    }
                    return cacheReachabilityResult(false);
                }
                if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.Start) {
                    // If we hit the start but were looking for a particular source flow
                    // node, return false. Otherwise, the start is what we're looking for.
                    return cacheReachabilityResult(sourceFlowNode ? false : true);
                }
                if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.PreFinallyGate) {
                    const preFinallyFlowNode = curFlowNode;
                    if (closedFinallyGateSet.has(preFinallyFlowNode.id)) {
                        return cacheReachabilityResult(false);
                    }
                    curFlowNode = preFinallyFlowNode.antecedent;
                    continue;
                }
                if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.PostFinally) {
                    const postFinallyFlowNode = curFlowNode;
                    const wasGateClosed = closedFinallyGateSet.has(postFinallyFlowNode.preFinallyGate.id);
                    try {
                        closedFinallyGateSet.add(postFinallyFlowNode.preFinallyGate.id);
                        return cacheReachabilityResult(isFlowNodeReachableRecursive(postFinallyFlowNode.antecedent, recursionCount));
                    }
                    finally {
                        if (!wasGateClosed) {
                            closedFinallyGateSet.delete(postFinallyFlowNode.preFinallyGate.id);
                        }
                    }
                }
                // We shouldn't get here.
                (0, debug_1.fail)('Unexpected flow node flags');
                return cacheReachabilityResult(false);
            }
        }
        // Protect against infinite recursion.
        if (isReachableRecursionSet.has(flowNode.id)) {
            return false;
        }
        isReachableRecursionSet.add(flowNode.id);
        try {
            return isFlowNodeReachableRecursive(flowNode);
        }
        finally {
            isReachableRecursionSet.delete(flowNode.id);
        }
    }
    // Determines whether the specified typeVar, which is assumed to be constrained,
    // can be narrowed to one of its constrained types based on isinstance type
    // guard checks.
    function narrowConstrainedTypeVar(flowNode, typeVar) {
        (0, debug_1.assert)(!typeVar.details.isParamSpec);
        (0, debug_1.assert)(!typeVar.details.isVariadic);
        (0, debug_1.assert)(!typeVar.details.boundType);
        (0, debug_1.assert)(typeVar.details.constraints.length > 0);
        const visitedFlowNodeMap = new Set();
        const startingConstraints = [];
        for (const constraint of typeVar.details.constraints) {
            if ((0, types_1.isClassInstance)(constraint)) {
                startingConstraints.push(constraint);
            }
            else {
                // If one or more constraints are Unknown, Any, union types, etc.,
                // we can't narrow them.
                return undefined;
            }
        }
        function narrowConstrainedTypeVarRecursive(flowNode, typeVar) {
            let curFlowNode = flowNode;
            while (true) {
                if (visitedFlowNodeMap.has(curFlowNode.id)) {
                    return startingConstraints;
                }
                if (curFlowNode.flags & (codeFlowTypes_1.FlowFlags.Unreachable | codeFlowTypes_1.FlowFlags.Start)) {
                    return startingConstraints;
                }
                if (curFlowNode.flags &
                    (codeFlowTypes_1.FlowFlags.VariableAnnotation |
                        codeFlowTypes_1.FlowFlags.Assignment |
                        codeFlowTypes_1.FlowFlags.WildcardImport |
                        codeFlowTypes_1.FlowFlags.TrueNeverCondition |
                        codeFlowTypes_1.FlowFlags.FalseNeverCondition |
                        codeFlowTypes_1.FlowFlags.ExhaustedMatch |
                        codeFlowTypes_1.FlowFlags.PostFinally |
                        codeFlowTypes_1.FlowFlags.PreFinallyGate |
                        codeFlowTypes_1.FlowFlags.Call)) {
                    const typedFlowNode = curFlowNode;
                    curFlowNode = typedFlowNode.antecedent;
                    continue;
                }
                // Handle a case statement with a class pattern.
                if (curFlowNode.flags & codeFlowTypes_1.FlowFlags.NarrowForPattern) {
                    const narrowForPatternFlowNode = curFlowNode;
                    if (narrowForPatternFlowNode.statement.nodeType === 64 /* ParseNodeType.Case */) {
                        const subjectType = evaluator.getTypeOfExpression(narrowForPatternFlowNode.subjectExpression).type;
                        if (isCompatibleWithConstrainedTypeVar(subjectType, typeVar)) {
                            const patternNode = narrowForPatternFlowNode.statement.pattern;
                            if (patternNode.nodeType === 66 /* ParseNodeType.PatternAs */ &&
                                patternNode.orPatterns.length === 1 &&
                                patternNode.orPatterns[0].nodeType === 68 /* ParseNodeType.PatternClass */) {
                                const classPatternNode = patternNode.orPatterns[0];
                                const classType = evaluator.getTypeOfExpression(classPatternNode.className, 2 /* EvalFlags.CallBaseDefaults */).type;
                                if ((0, types_1.isInstantiableClass)(classType)) {
                                    const priorRemainingConstraints = narrowConstrainedTypeVarRecursive(narrowForPatternFlowNode.antecedent, typeVar);
                                    return priorRemainingConstraints.filter((subtype) => types_1.ClassType.isSameGenericClass(subtype, classType));
                                }
                            }
                        }
                    }
                    curFlowNode = narrowForPatternFlowNode.antecedent;
                    continue;
                }
                // Handle an isinstance type guard.
                if (curFlowNode.flags & (codeFlowTypes_1.FlowFlags.TrueCondition | codeFlowTypes_1.FlowFlags.FalseCondition)) {
                    const conditionFlowNode = curFlowNode;
                    const testExpression = conditionFlowNode.expression;
                    const isPositiveTest = (curFlowNode.flags & codeFlowTypes_1.FlowFlags.TrueCondition) !== 0;
                    if (testExpression.nodeType === 9 /* ParseNodeType.Call */ &&
                        testExpression.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                        testExpression.leftExpression.value === 'isinstance' &&
                        testExpression.arguments.length === 2) {
                        const arg0Expr = testExpression.arguments[0].valueExpression;
                        const arg0Type = evaluator.getTypeOfExpression(arg0Expr).type;
                        if (isCompatibleWithConstrainedTypeVar(arg0Type, typeVar)) {
                            // Prevent infinite recursion by noting that we've been here before.
                            visitedFlowNodeMap.add(curFlowNode.id);
                            const priorRemainingConstraints = narrowConstrainedTypeVarRecursive(conditionFlowNode.antecedent, typeVar);
                            visitedFlowNodeMap.delete(curFlowNode.id);
                            const arg1Expr = testExpression.arguments[1].valueExpression;
                            const arg1Type = evaluator.getTypeOfExpression(arg1Expr, 512 /* EvalFlags.AllowMissingTypeArgs */ |
                                8 /* EvalFlags.StrLiteralAsType */ |
                                32 /* EvalFlags.NoParamSpec */ |
                                64 /* EvalFlags.NoTypeVarTuple */ |
                                16 /* EvalFlags.NoFinal */ |
                                2 /* EvalFlags.NoSpecialize */).type;
                            if ((0, types_1.isInstantiableClass)(arg1Type)) {
                                return priorRemainingConstraints.filter((subtype) => {
                                    if (types_1.ClassType.isSameGenericClass(subtype, arg1Type)) {
                                        return isPositiveTest;
                                    }
                                    else {
                                        return !isPositiveTest;
                                    }
                                });
                            }
                        }
                    }
                    curFlowNode = conditionFlowNode.antecedent;
                    continue;
                }
                if (curFlowNode.flags & (codeFlowTypes_1.FlowFlags.BranchLabel | codeFlowTypes_1.FlowFlags.LoopLabel)) {
                    const labelNode = curFlowNode;
                    const newConstraints = [];
                    // Prevent infinite recursion by noting that we've been here before.
                    visitedFlowNodeMap.add(curFlowNode.id);
                    for (const antecedent of labelNode.antecedents) {
                        const constraintsToAdd = narrowConstrainedTypeVarRecursive(antecedent, typeVar);
                        for (const constraint of constraintsToAdd) {
                            if (!newConstraints.some((t) => (0, types_1.isTypeSame)(t, constraint))) {
                                newConstraints.push(constraint);
                            }
                        }
                    }
                    visitedFlowNodeMap.delete(curFlowNode.id);
                    return newConstraints;
                }
                // We shouldn't get here.
                (0, debug_1.fail)('Unexpected flow node flags');
                return startingConstraints;
            }
        }
        const narrowedConstrainedType = narrowConstrainedTypeVarRecursive(flowNode, typeVar);
        // Have we narrowed the typeVar to a single constraint?
        return narrowedConstrainedType.length === 1 ? narrowedConstrainedType[0] : undefined;
    }
    // Determines whether a specified type is the same as a constrained
    // TypeVar or is conditioned on that same TypeVar or is some union of
    // the above.
    function isCompatibleWithConstrainedTypeVar(type, typeVar) {
        let isCompatible = true;
        (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
            if ((0, types_1.isTypeVar)(subtype)) {
                if (!(0, types_1.isTypeSame)(subtype, typeVar)) {
                    isCompatible = false;
                }
            }
            else if (subtype.condition) {
                if (!subtype.condition.some((condition) => condition.typeVar.details.constraints.length > 0 &&
                    condition.typeVar.nameWithScope === typeVar.nameWithScope)) {
                    isCompatible = false;
                }
            }
            else {
                isCompatible = false;
            }
        });
        return isCompatible;
    }
    // Determines whether a call associated with this flow node returns a NoReturn
    // type, thus preventing further traversal of the code flow graph.
    function isCallNoReturn(evaluator, flowNode) {
        const node = flowNode.node;
        if (enablePrintCallNoReturn) {
            console.log(`isCallNoReturn@${flowNode.id} Pre depth ${noReturnAnalysisDepth}`);
        }
        // See if this information is cached already.
        if (callIsNoReturnCache.has(node.id)) {
            const result = callIsNoReturnCache.get(node.id);
            if (enablePrintCallNoReturn) {
                console.log(`isCallNoReturn@${flowNode.id} Post: ${result ? 'true' : 'false'} (cached)`);
            }
            return result;
        }
        // See if we've exceeded the max recursion depth.
        if (noReturnAnalysisDepth > types_1.maxTypeRecursionCount) {
            return false;
        }
        // Don't attempt to evaluate a lambda call. We need to evaluate these in the
        // context of its arguments.
        if (node.leftExpression.nodeType === 33 /* ParseNodeType.Lambda */) {
            return false;
        }
        // Initially set to false to avoid recursion.
        callIsNoReturnCache.set(node.id, false);
        noReturnAnalysisDepth++;
        try {
            let noReturnTypeCount = 0;
            let subtypeCount = 0;
            // Evaluate the call base type.
            const callTypeResult = evaluator.getTypeOfExpression(node.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
            const callType = callTypeResult.type;
            (0, typeUtils_1.doForEachSubtype)(callType, (callSubtype) => {
                var _a;
                // Track the number of subtypes we've examined.
                subtypeCount++;
                if ((0, types_1.isInstantiableClass)(callSubtype)) {
                    // Does the class have a custom metaclass that implements a `__call__` method?
                    // If so, it will be called instead of `__init__` or `__new__`. We'll assume
                    // in this case that the __call__ method is not a NoReturn type.
                    const metaclassCallResult = (0, constructors_1.getBoundCallMethod)(evaluator, node, callSubtype);
                    if (metaclassCallResult) {
                        return;
                    }
                    const newMethodResult = (0, constructors_1.getBoundNewMethod)(evaluator, node, callSubtype);
                    if (newMethodResult) {
                        if ((0, types_1.isFunction)(newMethodResult.type) || (0, types_1.isOverloadedFunction)(newMethodResult.type)) {
                            callSubtype = newMethodResult.type;
                        }
                    }
                }
                else if ((0, types_1.isClassInstance)(callSubtype)) {
                    const callMethodType = evaluator.getBoundMagicMethod(callSubtype, '__call__');
                    if (callMethodType) {
                        callSubtype = callMethodType;
                    }
                }
                const isCallAwaited = ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 6 /* ParseNodeType.Await */;
                if ((0, types_1.isFunction)(callSubtype)) {
                    if (isFunctionNoReturn(callSubtype, isCallAwaited)) {
                        noReturnTypeCount++;
                    }
                }
                else if ((0, types_1.isOverloadedFunction)(callSubtype)) {
                    let overloadCount = 0;
                    let noReturnOverloadCount = 0;
                    types_1.OverloadedFunctionType.getOverloads(callSubtype).forEach((overload) => {
                        overloadCount++;
                        if (isFunctionNoReturn(overload, isCallAwaited)) {
                            noReturnOverloadCount++;
                        }
                    });
                    // Was at least one of the overloaded return types NoReturn?
                    if (noReturnOverloadCount > 0) {
                        // Do all of the overloads return NoReturn?
                        if (noReturnOverloadCount === overloadCount) {
                            noReturnTypeCount++;
                        }
                        else {
                            // Perform a more complete evaluation to determine whether
                            // the applicable overload returns a NoReturn.
                            const callResult = evaluator.validateOverloadedFunctionArguments(node, node.arguments, { type: callSubtype, isIncomplete: callTypeResult.isIncomplete }, 
                            /* typeVarContext */ undefined, 
                            /* skipUnknownArgCheck */ false, 
                            /* inferenceContext */ undefined, 
                            /* signatureTracker */ undefined);
                            if (callResult.returnType && (0, types_1.isNever)(callResult.returnType)) {
                                noReturnTypeCount++;
                            }
                        }
                    }
                }
            });
            // The call is considered NoReturn if all subtypes evaluate to NoReturn.
            const callIsNoReturn = subtypeCount > 0 && noReturnTypeCount === subtypeCount;
            // Cache the value for next time.
            callIsNoReturnCache.set(node.id, callIsNoReturn);
            if (enablePrintCallNoReturn) {
                console.log(`isCallNoReturn@${flowNode.id} Post: ${callIsNoReturn ? 'true' : 'false'}`);
            }
            return callIsNoReturn;
        }
        finally {
            noReturnAnalysisDepth--;
        }
    }
    function isFunctionNoReturn(functionType, isCallAwaited) {
        const returnType = functionType.details.declaredReturnType;
        if (returnType) {
            if ((0, types_1.isClassInstance)(returnType) &&
                types_1.ClassType.isBuiltIn(returnType, 'Coroutine') &&
                returnType.typeArguments &&
                returnType.typeArguments.length >= 3) {
                if ((0, types_1.isNever)(returnType.typeArguments[2]) && isCallAwaited) {
                    return true;
                }
            }
            return (0, types_1.isNever)(returnType);
        }
        else if (!inferNoReturnForUnannotatedFunctions) {
            return false;
        }
        else if (functionType.details.declaration) {
            // If the function is a generator (i.e. it has yield statements)
            // then it is not a "no return" call. Also, don't infer a "no
            // return" type for abstract methods.
            if (!functionType.details.declaration.isGenerator &&
                !types_1.FunctionType.isAbstractMethod(functionType) &&
                !types_1.FunctionType.isStubDefinition(functionType) &&
                !types_1.FunctionType.isPyTypedDefinition(functionType)) {
                // Check specifically for a common idiom where the only statement
                // (other than a possible docstring) is a "raise NotImplementedError".
                const functionStatements = functionType.details.declaration.node.suite.statements;
                let foundRaiseNotImplemented = false;
                for (const statement of functionStatements) {
                    if (statement.nodeType !== 47 /* ParseNodeType.StatementList */ || statement.statements.length !== 1) {
                        break;
                    }
                    const simpleStatement = statement.statements[0];
                    if (simpleStatement.nodeType === 48 /* ParseNodeType.StringList */) {
                        continue;
                    }
                    if (simpleStatement.nodeType === 43 /* ParseNodeType.Raise */ && simpleStatement.typeExpression) {
                        // Check for a raising about 'NotImplementedError' or a subtype thereof.
                        const exceptionType = evaluator.getType(simpleStatement.typeExpression);
                        if (exceptionType &&
                            (0, types_1.isClass)(exceptionType) &&
                            (0, typeUtils_1.derivesFromStdlibClass)(exceptionType, 'NotImplementedError')) {
                            foundRaiseNotImplemented = true;
                        }
                    }
                    break;
                }
                if (!foundRaiseNotImplemented && !isAfterNodeReachable(evaluator, functionType)) {
                    return true;
                }
            }
        }
        return false;
    }
    function isAfterNodeReachable(evaluator, functionType) {
        if (!functionType.details.declaration) {
            return true;
        }
        return evaluator.isAfterNodeReachable(functionType.details.declaration.node);
    }
    // Performs a cursory analysis to determine whether the expression
    // corresponds to a context manager object that supports the swallowing
    // of exceptions. By convention, these objects have an "__exit__" method
    // that returns a bool response (as opposed to a None). This function is
    // called during code flow, so it can't rely on full type evaluation. It
    // makes some simplifying assumptions that work in most cases.
    function isExceptionContextManager(evaluator, node, isAsync) {
        // See if this information is cached already.
        if (isExceptionContextManagerCache.has(node.id)) {
            return isExceptionContextManagerCache.get(node.id);
        }
        // Initially set to false to avoid infinite recursion.
        isExceptionContextManagerCache.set(node.id, false);
        // See if we've exceeded the max recursion depth.
        if (contextManagerAnalysisDepth > types_1.maxTypeRecursionCount) {
            return false;
        }
        contextManagerAnalysisDepth++;
        let cmSwallowsExceptions = false;
        try {
            const cmType = evaluator.getTypeOfExpression(node).type;
            if (cmType && (0, types_1.isClassInstance)(cmType)) {
                const exitMethodName = isAsync ? '__aexit__' : '__exit__';
                const exitType = evaluator.getBoundMagicMethod(cmType, exitMethodName);
                if (exitType && (0, types_1.isFunction)(exitType) && exitType.details.declaredReturnType) {
                    let returnType = exitType.details.declaredReturnType;
                    // If it's an __aexit__ method, its return type will typically be wrapped
                    // in a Coroutine, so we need to extract the return type from the third
                    // type argument.
                    if (isAsync) {
                        if ((0, types_1.isClassInstance)(returnType) &&
                            types_1.ClassType.isBuiltIn(returnType, 'Coroutine') &&
                            returnType.typeArguments &&
                            returnType.typeArguments.length >= 3) {
                            returnType = returnType.typeArguments[2];
                        }
                    }
                    cmSwallowsExceptions = false;
                    if ((0, types_1.isClassInstance)(returnType) && types_1.ClassType.isBuiltIn(returnType, 'bool')) {
                        if (returnType.literalValue === undefined || returnType.literalValue === true) {
                            cmSwallowsExceptions = true;
                        }
                    }
                }
            }
        }
        finally {
            contextManagerAnalysisDepth--;
        }
        // Cache the value for next time.
        isExceptionContextManagerCache.set(node.id, cmSwallowsExceptions);
        return cmSwallowsExceptions;
    }
    function getTypeFromWildcardImport(flowNode, name) {
        const importInfo = (0, analyzerNodeInfo_1.getImportInfo)(flowNode.node.module);
        (0, debug_1.assert)(importInfo !== undefined && importInfo.isImportFound);
        (0, debug_1.assert)(flowNode.node.isWildcardImport);
        const symbolWithScope = evaluator.lookUpSymbolRecursive(flowNode.node, name, /* honorCodeFlow */ false);
        (0, debug_1.assert)(symbolWithScope !== undefined);
        const decls = symbolWithScope.symbol.getDeclarations();
        const wildcardDecl = decls.find((decl) => decl.node === flowNode.node);
        if (!wildcardDecl) {
            return types_1.UnknownType.create();
        }
        return evaluator.getInferredTypeOfDeclaration(symbolWithScope.symbol, wildcardDecl) || types_1.UnknownType.create();
    }
    function printControlFlowGraph(flowNode, reference, callName, logger = console) {
        let referenceText = '';
        if (reference) {
            const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(reference);
            const pos = (0, positionUtils_1.convertOffsetToPosition)(reference.start, fileInfo.lines);
            referenceText = `${(0, parseTreeUtils_1.printExpression)(reference)}[${pos.line + 1}:${pos.character + 1}]`;
        }
        logger.log(`${callName}@${flowNode.id}: ${referenceText || '(none)'}`);
        logger.log((0, codeFlowUtils_1.formatControlFlowGraph)(flowNode));
    }
    return {
        createCodeFlowAnalyzer,
        isFlowNodeReachable,
        narrowConstrainedTypeVar,
        printControlFlowGraph,
    };
}
exports.getCodeFlowEngine = getCodeFlowEngine;
//# sourceMappingURL=codeFlowEngine.js.map