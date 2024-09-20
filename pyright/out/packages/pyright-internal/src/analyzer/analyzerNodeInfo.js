"use strict";
/*
 * analyzerNodeInfo.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Defines objects that hang off the parse nodes in the parse tree.
 * It contains information collected during the binder phase that
 * can be used for later analysis steps or for language services
 * (e.g. hover information).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCodeUnreachable = exports.setDunderAllInfo = exports.getDunderAllInfo = exports.setCodeFlowComplexity = exports.getCodeFlowComplexity = exports.setCodeFlowExpressions = exports.getCodeFlowExpressions = exports.setFileInfo = exports.getFileInfo = exports.setAfterFlowNode = exports.getAfterFlowNode = exports.setFlowNode = exports.getFlowNode = exports.setDeclaration = exports.getDeclaration = exports.setScope = exports.getScope = exports.setImportInfo = exports.getImportInfo = exports.cleanNodeAnalysisInfo = void 0;
const codeFlowTypes_1 = require("./codeFlowTypes");
// Cleans out all fields that are added by the analyzer phases
// (after the post-parse walker).
function cleanNodeAnalysisInfo(node) {
    const analyzerNode = node;
    delete analyzerNode.scope;
    delete analyzerNode.declaration;
    delete analyzerNode.flowNode;
    delete analyzerNode.afterFlowNode;
    delete analyzerNode.fileInfo;
    delete analyzerNode.codeFlowExpressions;
    delete analyzerNode.codeFlowComplexity;
    delete analyzerNode.dunderAllInfo;
    delete analyzerNode.typeParameterSymbol;
}
exports.cleanNodeAnalysisInfo = cleanNodeAnalysisInfo;
function getImportInfo(node) {
    const analyzerNode = node;
    return analyzerNode.importInfo;
}
exports.getImportInfo = getImportInfo;
function setImportInfo(node, importInfo) {
    const analyzerNode = node;
    analyzerNode.importInfo = importInfo;
}
exports.setImportInfo = setImportInfo;
function getScope(node) {
    const analyzerNode = node;
    return analyzerNode.scope;
}
exports.getScope = getScope;
function setScope(node, scope) {
    const analyzerNode = node;
    analyzerNode.scope = scope;
}
exports.setScope = setScope;
function getDeclaration(node) {
    const analyzerNode = node;
    return analyzerNode.declaration;
}
exports.getDeclaration = getDeclaration;
function setDeclaration(node, decl) {
    const analyzerNode = node;
    analyzerNode.declaration = decl;
}
exports.setDeclaration = setDeclaration;
function getFlowNode(node) {
    const analyzerNode = node;
    return analyzerNode.flowNode;
}
exports.getFlowNode = getFlowNode;
function setFlowNode(node, flowNode) {
    const analyzerNode = node;
    analyzerNode.flowNode = flowNode;
}
exports.setFlowNode = setFlowNode;
function getAfterFlowNode(node) {
    const analyzerNode = node;
    return analyzerNode.afterFlowNode;
}
exports.getAfterFlowNode = getAfterFlowNode;
function setAfterFlowNode(node, flowNode) {
    const analyzerNode = node;
    analyzerNode.afterFlowNode = flowNode;
}
exports.setAfterFlowNode = setAfterFlowNode;
function getFileInfo(node) {
    while (node.nodeType !== 36 /* ParseNodeType.Module */) {
        node = node.parent;
    }
    const analyzerNode = node;
    return analyzerNode.fileInfo;
}
exports.getFileInfo = getFileInfo;
function setFileInfo(node, fileInfo) {
    const analyzerNode = node;
    analyzerNode.fileInfo = fileInfo;
}
exports.setFileInfo = setFileInfo;
function getCodeFlowExpressions(node) {
    const analyzerNode = node;
    return analyzerNode.codeFlowExpressions;
}
exports.getCodeFlowExpressions = getCodeFlowExpressions;
function setCodeFlowExpressions(node, expressions) {
    const analyzerNode = node;
    analyzerNode.codeFlowExpressions = expressions;
}
exports.setCodeFlowExpressions = setCodeFlowExpressions;
function getCodeFlowComplexity(node) {
    var _a;
    const analyzerNode = node;
    return (_a = analyzerNode.codeFlowComplexity) !== null && _a !== void 0 ? _a : 0;
}
exports.getCodeFlowComplexity = getCodeFlowComplexity;
function setCodeFlowComplexity(node, complexity) {
    const analyzerNode = node;
    analyzerNode.codeFlowComplexity = complexity;
}
exports.setCodeFlowComplexity = setCodeFlowComplexity;
function getDunderAllInfo(node) {
    const analyzerNode = node;
    return analyzerNode.dunderAllInfo;
}
exports.getDunderAllInfo = getDunderAllInfo;
function setDunderAllInfo(node, names) {
    const analyzerNode = node;
    analyzerNode.dunderAllInfo = names;
}
exports.setDunderAllInfo = setDunderAllInfo;
function isCodeUnreachable(node) {
    let curNode = node;
    // Walk up the parse tree until we find a node with
    // an associated flow node.
    while (curNode) {
        const flowNode = getFlowNode(curNode);
        if (flowNode) {
            return !!(flowNode.flags & codeFlowTypes_1.FlowFlags.Unreachable);
        }
        curNode = curNode.parent;
    }
    return false;
}
exports.isCodeUnreachable = isCodeUnreachable;
//# sourceMappingURL=analyzerNodeInfo.js.map