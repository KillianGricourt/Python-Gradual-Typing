"use strict";
/*
 * testWalker.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Walks a parse tree to validate internal consistency and completeness.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NameTypeWalker = exports.TestWalker = void 0;
const parseTreeWalker_1 = require("../analyzer/parseTreeWalker");
const debug_1 = require("../common/debug");
const textRange_1 = require("../common/textRange");
const parseTreeUtils_1 = require("./parseTreeUtils");
class TestWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor() {
        super();
    }
    visitNode(node) {
        const children = super.visitNode(node);
        this._verifyParentChildLinks(node, children);
        this._verifyChildRanges(node, children);
        return children;
    }
    // Make sure that all of the children point to their parent.
    _verifyParentChildLinks(node, children) {
        children.forEach((child) => {
            if (child) {
                if (child.parent !== node) {
                    (0, debug_1.fail)(`Child node ${child.nodeType} does not ` + `contain a reference to its parent ${node.nodeType}`);
                }
            }
        });
    }
    // Verify that:
    //      Children are all contained within the parent
    //      Children have non-overlapping ranges
    //      Children are listed in increasing order
    _verifyChildRanges(node, children) {
        let prevNode;
        const compliant = (0, parseTreeUtils_1.isCompliantWithNodeRangeRules)(node);
        children.forEach((child) => {
            if (child) {
                let skipCheck = false;
                if (!compliant) {
                    switch (node.nodeType) {
                        case 3 /* ParseNodeType.Assignment */:
                            // There are a few exceptions we need to deal with here. Comment
                            // annotations can occur outside of an assignment node's range.
                            if (child === node.typeAnnotationComment) {
                                skipCheck = true;
                            }
                            // Portions of chained assignments can occur outside of an
                            // assignment node's range.
                            if (child.nodeType === 3 /* ParseNodeType.Assignment */) {
                                skipCheck = true;
                            }
                            break;
                        case 48 /* ParseNodeType.StringList */:
                            if (child === node.typeAnnotation) {
                                skipCheck = true;
                            }
                            break;
                        default:
                            (0, debug_1.fail)(`node ${node.nodeType} is not marked as not following range rules.`);
                    }
                }
                if (!skipCheck) {
                    // Make sure the child is contained within the parent.
                    if (child.start < node.start || textRange_1.TextRange.getEnd(child) > textRange_1.TextRange.getEnd(node)) {
                        (0, debug_1.fail)(`Child node ${child.nodeType} is not contained within its parent ${node.nodeType}`);
                    }
                    if (prevNode) {
                        // Make sure the child is after the previous child.
                        if (child.start < textRange_1.TextRange.getEnd(prevNode)) {
                            // Special-case the function annotation which can "bleed" into the suite.
                            if (prevNode.nodeType !== 62 /* ParseNodeType.FunctionAnnotation */) {
                                (0, debug_1.fail)(`Child node is not after previous child node`);
                            }
                        }
                    }
                    prevNode = child;
                }
            }
        });
    }
}
exports.TestWalker = TestWalker;
// Custom parse node walker that evaluates the types of all
// NameNodes. This helps find bugs in evaluation ordering.
class NameTypeWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_evaluator) {
        super();
        this._evaluator = _evaluator;
    }
    visitName(node) {
        var _a, _b;
        if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 26 /* ParseNodeType.ImportFromAs */ && ((_b = node.parent) === null || _b === void 0 ? void 0 : _b.nodeType) !== 24 /* ParseNodeType.ImportAs */) {
            if (this._evaluator.isNodeReachable(node, /* sourceNode */ undefined)) {
                this._evaluator.getType(node);
            }
        }
        return true;
    }
}
exports.NameTypeWalker = NameTypeWalker;
//# sourceMappingURL=testWalker.js.map