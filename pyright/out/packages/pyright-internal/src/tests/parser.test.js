"use strict";
/*
 * parser.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Unit tests for Python parser. These are very basic because
 * the parser gets lots of exercise in the type checker tests.
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
const assert = __importStar(require("assert"));
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const diagnosticSink_1 = require("../common/diagnosticSink");
const textRange_1 = require("../common/textRange");
const testState_1 = require("./harness/fourslash/testState");
const TestUtils = __importStar(require("./testUtils"));
test('Empty', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    const parserOutput = TestUtils.parseText('', diagSink).parserOutput;
    assert.equal(diagSink.fetchAndClear().length, 0);
    assert.equal(parserOutput.parseTree.statements.length, 0);
});
test('Parser1', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    const parserOutput = TestUtils.parseSampleFile('parser1.py', diagSink).parserOutput;
    assert.equal(diagSink.fetchAndClear().length, 0);
    assert.equal(parserOutput.parseTree.statements.length, 4);
});
test('Parser2', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    TestUtils.parseSampleFile('parser2.py', diagSink);
    assert.strictEqual(diagSink.getErrors().length, 0);
});
test('FStringEmptyTuple', () => {
    assert.doesNotThrow(() => {
        const diagSink = new diagnosticSink_1.DiagnosticSink();
        TestUtils.parseSampleFile('fstring6.py', diagSink);
    });
});
test('SuiteExpectedColon1', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    TestUtils.parseSampleFile('suiteExpectedColon1.py', diagSink);
    assert.strictEqual(diagSink.getErrors().length, 1);
});
test('SuiteExpectedColon2', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    TestUtils.parseSampleFile('suiteExpectedColon2.py', diagSink);
    assert.strictEqual(diagSink.getErrors().length, 1);
});
test('SuiteExpectedColon3', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    TestUtils.parseSampleFile('suiteExpectedColon3.py', diagSink);
    assert.strictEqual(diagSink.getErrors().length, 1);
});
test('ExpressionWrappedInParens', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    const parserOutput = TestUtils.parseText('(str)', diagSink).parserOutput;
    assert.equal(diagSink.fetchAndClear().length, 0);
    assert.equal(parserOutput.parseTree.statements.length, 1);
    assert.equal(parserOutput.parseTree.statements[0].nodeType, 47 /* ParseNodeType.StatementList */);
    const statementList = parserOutput.parseTree.statements[0];
    assert.equal(statementList.statements.length, 1);
    // length of node should include parens
    assert.equal(statementList.statements[0].nodeType, 38 /* ParseNodeType.Name */);
    assert.equal(statementList.statements[0].length, 5);
});
test('MaxParseDepth1', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    TestUtils.parseSampleFile('maxParseDepth1.py', diagSink);
    assert.strictEqual(diagSink.getErrors().length, 1);
});
test('MaxParseDepth2', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    TestUtils.parseSampleFile('maxParseDepth2.py', diagSink);
    assert.strictEqual(diagSink.getErrors().length, 4);
});
test('ModuleName range', () => {
    const code = `
//// from [|/*marker*/...|] import A
        `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const expectedRange = state.getRangeByMarkerName('marker');
    const node = (0, testState_1.getNodeAtMarker)(state);
    assert.strictEqual(node.start, expectedRange === null || expectedRange === void 0 ? void 0 : expectedRange.pos);
    assert.strictEqual(textRange_1.TextRange.getEnd(node), expectedRange === null || expectedRange === void 0 ? void 0 : expectedRange.end);
});
test('ParserRecovery1', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    const parseResults = TestUtils.parseSampleFile('parserRecovery1.py', diagSink);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(parseResults.parserOutput.parseTree, parseResults.text.length - 2);
    const functionNode = (0, parseTreeUtils_1.getFirstAncestorOrSelfOfKind)(node, 31 /* ParseNodeType.Function */);
    assert.equal(functionNode.parent.nodeType, 36 /* ParseNodeType.Module */);
});
test('ParserRecovery2', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    const parseResults = TestUtils.parseSampleFile('parserRecovery2.py', diagSink);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(parseResults.parserOutput.parseTree, parseResults.text.length - 2);
    const functionNode = (0, parseTreeUtils_1.getFirstAncestorOrSelfOfKind)(node, 31 /* ParseNodeType.Function */);
    assert.equal(functionNode.parent.nodeType, 50 /* ParseNodeType.Suite */);
});
test('ParserRecovery3', () => {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    const parseResults = TestUtils.parseSampleFile('parserRecovery3.py', diagSink);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(parseResults.parserOutput.parseTree, parseResults.text.length - 2);
    const functionNode = (0, parseTreeUtils_1.getFirstAncestorOrSelfOfKind)(node, 31 /* ParseNodeType.Function */);
    assert.equal(functionNode.parent.nodeType, 36 /* ParseNodeType.Module */);
});
//# sourceMappingURL=parser.test.js.map