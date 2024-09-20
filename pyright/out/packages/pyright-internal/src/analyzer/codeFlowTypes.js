"use strict";
/*
 * codeFlowTypes.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Data structures that track the code flow (or more accurately,
 * the inverse of code flow) starting with return statements and
 * working back to the entry. This allows us to work out the
 * types at each point of the code flow.
 *
 * This is largely based on the code flow engine in the
 * TypeScript compiler.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wildcardImportReferenceKey = exports.createKeysForReferenceSubexpressions = exports.createKeyForReference = exports.isCodeFlowSupportedForReference = exports.getUniqueFlowNodeId = exports.FlowFlags = void 0;
const debug_1 = require("../common/debug");
var FlowFlags;
(function (FlowFlags) {
    FlowFlags[FlowFlags["Unreachable"] = 1] = "Unreachable";
    FlowFlags[FlowFlags["Start"] = 2] = "Start";
    FlowFlags[FlowFlags["BranchLabel"] = 4] = "BranchLabel";
    FlowFlags[FlowFlags["LoopLabel"] = 8] = "LoopLabel";
    FlowFlags[FlowFlags["Assignment"] = 16] = "Assignment";
    FlowFlags[FlowFlags["Unbind"] = 32] = "Unbind";
    FlowFlags[FlowFlags["WildcardImport"] = 64] = "WildcardImport";
    FlowFlags[FlowFlags["TrueCondition"] = 128] = "TrueCondition";
    FlowFlags[FlowFlags["FalseCondition"] = 512] = "FalseCondition";
    FlowFlags[FlowFlags["Call"] = 1024] = "Call";
    FlowFlags[FlowFlags["PreFinallyGate"] = 2048] = "PreFinallyGate";
    FlowFlags[FlowFlags["PostFinally"] = 4096] = "PostFinally";
    FlowFlags[FlowFlags["VariableAnnotation"] = 16384] = "VariableAnnotation";
    FlowFlags[FlowFlags["PostContextManager"] = 32768] = "PostContextManager";
    FlowFlags[FlowFlags["TrueNeverCondition"] = 65536] = "TrueNeverCondition";
    FlowFlags[FlowFlags["FalseNeverCondition"] = 131072] = "FalseNeverCondition";
    FlowFlags[FlowFlags["NarrowForPattern"] = 262144] = "NarrowForPattern";
    FlowFlags[FlowFlags["ExhaustedMatch"] = 524288] = "ExhaustedMatch";
})(FlowFlags || (exports.FlowFlags = FlowFlags = {}));
let _nextFlowNodeId = 1;
function getUniqueFlowNodeId() {
    return _nextFlowNodeId++;
}
exports.getUniqueFlowNodeId = getUniqueFlowNodeId;
function isCodeFlowSupportedForReference(reference) {
    if (reference.nodeType === 38 /* ParseNodeType.Name */) {
        return true;
    }
    if (reference.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        return isCodeFlowSupportedForReference(reference.leftExpression);
    }
    if (reference.nodeType === 27 /* ParseNodeType.Index */) {
        // Allow index expressions that have a single subscript that is a
        // literal integer or string value.
        if (reference.items.length !== 1 ||
            reference.trailingComma ||
            reference.items[0].name !== undefined ||
            reference.items[0].argumentCategory !== 0 /* ArgumentCategory.Simple */) {
            return false;
        }
        const subscriptNode = reference.items[0].valueExpression;
        const isIntegerIndex = subscriptNode.nodeType === 40 /* ParseNodeType.Number */ && !subscriptNode.isImaginary && subscriptNode.isInteger;
        const isNegativeIntegerIndex = subscriptNode.nodeType === 55 /* ParseNodeType.UnaryOperation */ &&
            subscriptNode.operator === 33 /* OperatorType.Subtract */ &&
            subscriptNode.expression.nodeType === 40 /* ParseNodeType.Number */ &&
            !subscriptNode.expression.isImaginary &&
            subscriptNode.expression.isInteger;
        const isStringIndex = subscriptNode.nodeType === 48 /* ParseNodeType.StringList */ &&
            subscriptNode.strings.length === 1 &&
            subscriptNode.strings[0].nodeType === 49 /* ParseNodeType.String */;
        if (!isIntegerIndex && !isNegativeIntegerIndex && !isStringIndex) {
            return false;
        }
        return isCodeFlowSupportedForReference(reference.baseExpression);
    }
    return false;
}
exports.isCodeFlowSupportedForReference = isCodeFlowSupportedForReference;
function createKeyForReference(reference) {
    let key;
    if (reference.nodeType === 38 /* ParseNodeType.Name */) {
        key = reference.value;
    }
    else if (reference.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        const leftKey = createKeyForReference(reference.leftExpression);
        key = `${leftKey}.${reference.memberName.value}`;
    }
    else if (reference.nodeType === 27 /* ParseNodeType.Index */) {
        const leftKey = createKeyForReference(reference.baseExpression);
        (0, debug_1.assert)(reference.items.length === 1);
        const expr = reference.items[0].valueExpression;
        if (expr.nodeType === 40 /* ParseNodeType.Number */) {
            key = `${leftKey}[${expr.value.toString()}]`;
        }
        else if (expr.nodeType === 48 /* ParseNodeType.StringList */) {
            const valExpr = expr;
            (0, debug_1.assert)(valExpr.strings.length === 1 && valExpr.strings[0].nodeType === 49 /* ParseNodeType.String */);
            key = `${leftKey}["${valExpr.strings[0].value}"]`;
        }
        else if (expr.nodeType === 55 /* ParseNodeType.UnaryOperation */ &&
            expr.operator === 33 /* OperatorType.Subtract */ &&
            expr.expression.nodeType === 40 /* ParseNodeType.Number */) {
            key = `${leftKey}[-${expr.expression.value.toString()}]`;
        }
        else {
            (0, debug_1.fail)('createKeyForReference received unexpected index type');
        }
    }
    else {
        (0, debug_1.fail)('createKeyForReference received unexpected expression type');
    }
    return key;
}
exports.createKeyForReference = createKeyForReference;
function createKeysForReferenceSubexpressions(reference) {
    if (reference.nodeType === 38 /* ParseNodeType.Name */) {
        return [createKeyForReference(reference)];
    }
    if (reference.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        return [
            ...createKeysForReferenceSubexpressions(reference.leftExpression),
            createKeyForReference(reference),
        ];
    }
    if (reference.nodeType === 27 /* ParseNodeType.Index */) {
        return [
            ...createKeysForReferenceSubexpressions(reference.baseExpression),
            createKeyForReference(reference),
        ];
    }
    (0, debug_1.fail)('createKeyForReference received unexpected expression type');
}
exports.createKeysForReferenceSubexpressions = createKeysForReferenceSubexpressions;
// A reference key that corresponds to a wildcard import.
exports.wildcardImportReferenceKey = '*';
//# sourceMappingURL=codeFlowTypes.js.map