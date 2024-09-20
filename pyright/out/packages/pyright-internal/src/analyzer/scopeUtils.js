"use strict";
/*
 * scopeUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Static utility methods related to scopes and their related
 * symbol tables.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isScopeContainedWithin = exports.findTopNodeInScope = exports.getScopeHierarchy = exports.getScopeForNode = exports.getBuiltInScope = void 0;
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const parseTreeUtils_1 = require("./parseTreeUtils");
function getBuiltInScope(currentScope) {
    // Starting at the current scope, find the built-in scope, which should
    // be the top-most parent.
    let builtInScope = currentScope;
    while (builtInScope.type !== 5 /* ScopeType.Builtin */) {
        builtInScope = builtInScope.parent;
    }
    return builtInScope;
}
exports.getBuiltInScope = getBuiltInScope;
// Locates the evaluation scope associated with the specified parse node.
function getScopeForNode(node) {
    const scopeNode = (0, parseTreeUtils_1.getEvaluationScopeNode)(node).node;
    return (0, analyzerNodeInfo_1.getScope)(scopeNode);
}
exports.getScopeForNode = getScopeForNode;
// Returns a list of scopes associated with the node and its ancestor nodes.
// If stopScope is provided, the search will stop at that scope.
// Returns undefined if stopScope is not found.
function getScopeHierarchy(node, stopScope) {
    const scopeHierarchy = [];
    let curNode = node;
    while (curNode) {
        const scopeNode = (0, parseTreeUtils_1.getEvaluationScopeNode)(curNode).node;
        const curScope = (0, analyzerNodeInfo_1.getScope)(scopeNode);
        if (!curScope) {
            return undefined;
        }
        if (scopeHierarchy.length === 0 || scopeHierarchy[scopeHierarchy.length - 1] !== curScope) {
            scopeHierarchy.push(curScope);
        }
        if (curScope === stopScope) {
            return scopeHierarchy;
        }
        curNode = scopeNode.parent;
    }
    return stopScope ? undefined : scopeHierarchy;
}
exports.getScopeHierarchy = getScopeHierarchy;
// Walks up the parse tree from the specified node to find the top-most node
// that is within specified scope.
function findTopNodeInScope(node, scope) {
    let curNode = node;
    let prevNode;
    let foundScope = false;
    while (curNode) {
        if ((0, analyzerNodeInfo_1.getScope)(curNode) === scope) {
            foundScope = true;
        }
        else if (foundScope) {
            return prevNode;
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return undefined;
}
exports.findTopNodeInScope = findTopNodeInScope;
function isScopeContainedWithin(scope, potentialParentScope) {
    let curScope = scope;
    while (curScope) {
        if (curScope.parent === potentialParentScope) {
            return true;
        }
        curScope = curScope.parent;
    }
    return false;
}
exports.isScopeContainedWithin = isScopeContainedWithin;
//# sourceMappingURL=scopeUtils.js.map