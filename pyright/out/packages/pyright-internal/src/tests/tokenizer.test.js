"use strict";
/*
 * tokenizer.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Based on code from vscode-python repository:
 *  https://github.com/Microsoft/vscode-python
 *
 * Unit tests for Python tokenizer.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const StringTokenUtils = __importStar(require("../parser/stringTokenUtils"));
const tokenizer_1 = require("../parser/tokenizer");
const TestUtils = __importStar(require("./testUtils"));
const _implicitTokenCount = 2;
const _implicitTokenCountNoImplicitNewLine = 1;
test('Empty', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('');
    assert_1.default.equal(results.tokens.count, 0 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.length, 0);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 1 /* TokenType.EndOfStream */);
    assert_1.default.equal(results.tokens.getItemAtPosition(-1), -1);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), -1);
    assert_1.default.throws(() => results.tokens.getItemAt(-1), Error);
    assert_1.default.throws(() => results.tokens.getItemAt(10), Error);
    assert_1.default.equal(results.tokens.contains(-1), false);
    assert_1.default.equal(results.tokens.contains(2), false);
});
test('NewLines', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\na\r\nb\r');
    assert_1.default.equal(results.tokens.count, 5 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(0).newLineType, 1 /* NewLineType.LineFeed */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(2).newLineType, 2 /* NewLineType.CarriageReturnLineFeed */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(4).newLineType, 0 /* NewLineType.CarriageReturn */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 1 /* TokenType.EndOfStream */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(6), 5);
    assert_1.default.equal(results.tokens.contains(5), true);
    assert_1.default.equal(results.tokens.contains(6), false);
});
test('InvalidWithNewLine', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\\\\\r\n\\aaa \t\f\n');
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 0 /* TokenType.Invalid */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(1).newLineType, 2 /* NewLineType.CarriageReturnLineFeed */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 0 /* TokenType.Invalid */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 4);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(3).newLineType, 1 /* NewLineType.LineFeed */);
});
test('InvalidIndent', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\tpass\n');
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 3 /* TokenType.Indent */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 8 /* TokenType.Keyword */);
});
test('ParenNewLines', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n(\n(\n)\n)\n)\n');
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 13 /* TokenType.OpenParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 13 /* TokenType.OpenParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 14 /* TokenType.CloseParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 14 /* TokenType.CloseParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 14 /* TokenType.CloseParenthesis */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(6), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(7), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(8), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 6);
    assert_1.default.equal(results.tokens.getItemAtPosition(10), 7);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 8);
    assert_1.default.equal(results.tokens.contains(10), true);
    assert_1.default.equal(results.tokens.contains(11), false);
});
test('BraceNewLines', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n{\n{\n}\n}\n}\n');
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(6), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(7), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(8), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 6);
    assert_1.default.equal(results.tokens.getItemAtPosition(10), 7);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 8);
    assert_1.default.equal(results.tokens.contains(10), true);
    assert_1.default.equal(results.tokens.contains(11), false);
});
test('BracketNewLines', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n[\n[\n]\n]\n]\n');
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 15 /* TokenType.OpenBracket */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 15 /* TokenType.OpenBracket */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 16 /* TokenType.CloseBracket */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 16 /* TokenType.CloseBracket */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 16 /* TokenType.CloseBracket */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(6), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(7), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(8), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 6);
    assert_1.default.equal(results.tokens.getItemAtPosition(10), 7);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 8);
    assert_1.default.equal(results.tokens.contains(10), true);
    assert_1.default.equal(results.tokens.contains(11), false);
});
test('NewLinesWithWhiteSpace', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('  \na   \r\nb  \rc');
    assert_1.default.equal(results.tokens.count, 6 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).newLineType, 1 /* NewLineType.LineFeed */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(2).newLineType, 2 /* NewLineType.CarriageReturnLineFeed */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(4).newLineType, 0 /* NewLineType.CarriageReturn */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(6).newLineType, 3 /* NewLineType.Implied */);
    assert_1.default.equal(results.tokens.getItemAt(6).length, 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), -1);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), -1);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(6), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(7), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(8), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(12), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(13), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(14), 7);
    assert_1.default.equal(results.tokens.contains(13), true);
    assert_1.default.equal(results.tokens.contains(14), false);
});
test('NewLineEliding', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n\r\n\r');
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).newLineType, 1 /* NewLineType.LineFeed */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 1);
    assert_1.default.equal(results.tokens.contains(3), true);
    assert_1.default.equal(results.tokens.contains(4), false);
});
test('LineContinuation', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('foo  \\\na   \\\r\nb  \\\rc  \\ \n # Comment \\\n');
    assert_1.default.equal(results.tokens.count, 6 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 0 /* TokenType.Invalid */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(6), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(7), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(13), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(14), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(18), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(19), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(21), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(22), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(23), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(24), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(37), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(38), 6);
    assert_1.default.equal(results.tokens.contains(37), true);
    assert_1.default.equal(results.tokens.contains(38), false);
});
test('Dots', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('. .. ... ....');
    assert_1.default.equal(results.tokens.count, 6 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 20 /* TokenType.Dot */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 20 /* TokenType.Dot */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 20 /* TokenType.Dot */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 19 /* TokenType.Ellipsis */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 19 /* TokenType.Ellipsis */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 20 /* TokenType.Dot */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(8), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(12), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(13), 7);
    assert_1.default.equal(results.tokens.contains(12), true);
    assert_1.default.equal(results.tokens.contains(13), false);
});
test('PunctuationTokens', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(':;,()[]{}->');
    assert_1.default.equal(results.tokens.count, 10 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 10 /* TokenType.Colon */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 11 /* TokenType.Semicolon */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 12 /* TokenType.Comma */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 13 /* TokenType.OpenParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 14 /* TokenType.CloseParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 15 /* TokenType.OpenBracket */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 16 /* TokenType.CloseBracket */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(9).type, 21 /* TokenType.Arrow */);
});
test('IndentDedent', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('test\n' + '  i1\n' + '  i2  # \n' + '       # \n' + '  \ti3\n' + '\ti4\n' + ' i1');
    assert_1.default.equal(results.tokens.count, 16 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 3 /* TokenType.Indent */);
    assert_1.default.equal(results.tokens.getItemAt(2).indentAmount, 2);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 3 /* TokenType.Indent */);
    assert_1.default.equal(results.tokens.getItemAt(7).indentAmount, 8);
    assert_1.default.equal(results.tokens.getItemAt(7).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(9).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(10).type, 3 /* TokenType.Indent */);
    assert_1.default.equal(results.tokens.getItemAt(10).isIndentAmbiguous, true);
    assert_1.default.equal(results.tokens.getItemAt(10).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(11).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(12).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(13).type, 4 /* TokenType.Dedent */);
    assert_1.default.equal(results.tokens.getItemAt(13).indentAmount, 2);
    assert_1.default.equal(results.tokens.getItemAt(13).matchesIndent, true);
    assert_1.default.equal(results.tokens.getItemAt(14).type, 4 /* TokenType.Dedent */);
    assert_1.default.equal(results.tokens.getItemAt(14).indentAmount, 1);
    assert_1.default.equal(results.tokens.getItemAt(14).matchesIndent, false);
    assert_1.default.equal(results.tokens.getItemAt(15).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(16).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(17).type, 1 /* TokenType.EndOfStream */);
});
test('IndentDedentParen', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('test (\n  i1\n       )\n  foo');
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCount);
    // Test that indent and dedent tokens are suppressed within
    // a parenthetical clause.
    assert_1.default.equal(results.tokens.getItemAt(0).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 13 /* TokenType.OpenParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 14 /* TokenType.CloseParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 3 /* TokenType.Indent */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 4 /* TokenType.Dedent */);
    assert_1.default.equal(results.tokens.getItemAt(9).type, 1 /* TokenType.EndOfStream */);
});
test('Strings: simple', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(' "a"');
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 3 /* TokenType.Indent */);
    const stringToken = results.tokens.getItemAt(1);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.length, 3);
    assert_1.default.equal(stringToken.escapedValue, 'a');
    assert_1.default.equal(stringToken.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 2 /* TokenType.NewLine */);
});
test('Strings: unclosed', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(' "string" """line1\n#line2"""\t\'un#closed');
    assert_1.default.equal(results.tokens.count, 5 + _implicitTokenCount);
    const ranges = [
        [1, 8],
        [10, 18],
        [29, 10],
    ];
    assert_1.default.equal(results.tokens.getItemAt(0).type, 3 /* TokenType.Indent */);
    for (let i = 0; i < ranges.length; i++) {
        assert_1.default.equal(results.tokens.getItemAt(i + 1).start, ranges[i][0]);
        assert_1.default.equal(results.tokens.getItemAt(i + 1).length, ranges[i][1]);
        assert_1.default.equal(results.tokens.getItemAt(i + 1).type, 5 /* TokenType.String */);
    }
    assert_1.default.equal(results.tokens.getItemAt(5).type, 4 /* TokenType.Dedent */);
});
test('Strings: escaped across multiple lines', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(' "a\\\nb" \'c\\\r\nb\'');
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCount);
    const ranges = [
        [1, 6],
        [8, 7],
    ];
    assert_1.default.equal(results.tokens.getItemAt(0).type, 3 /* TokenType.Indent */);
    for (let i = 0; i < ranges.length; i++) {
        assert_1.default.equal(results.tokens.getItemAt(i + 1).start, ranges[i][0]);
        assert_1.default.equal(results.tokens.getItemAt(i + 1).length, ranges[i][1]);
        assert_1.default.equal(results.tokens.getItemAt(i + 1).type, 5 /* TokenType.String */);
    }
    assert_1.default.equal(results.tokens.getItemAt(5).type, 1 /* TokenType.EndOfStream */);
});
test('Strings: block next to regular, double-quoted', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"string""""s2"""');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    const ranges = [
        [0, 8],
        [8, 8],
    ];
    for (let i = 0; i < ranges.length; i++) {
        assert_1.default.equal(results.tokens.getItemAt(i).start, ranges[i][0]);
        assert_1.default.equal(results.tokens.getItemAt(i).length, ranges[i][1]);
        assert_1.default.equal(results.tokens.getItemAt(i).type, 5 /* TokenType.String */);
    }
});
test('Strings: block next to block, double-quoted', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('""""""""');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    const ranges = [
        [0, 6],
        [6, 2],
    ];
    for (let i = 0; i < ranges.length; i++) {
        assert_1.default.equal(results.tokens.getItemAt(i).start, ranges[i][0]);
        assert_1.default.equal(results.tokens.getItemAt(i).length, ranges[i][1]);
        assert_1.default.equal(results.tokens.getItemAt(i).type, 5 /* TokenType.String */);
    }
});
test('Strings: unclosed sequence of quotes', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"""""');
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCount);
    const ranges = [[0, 5]];
    for (let i = 0; i < ranges.length; i++) {
        assert_1.default.equal(results.tokens.getItemAt(i).start, ranges[i][0]);
        assert_1.default.equal(results.tokens.getItemAt(i).length, ranges[i][1]);
        assert_1.default.equal(results.tokens.getItemAt(i).type, 5 /* TokenType.String */);
    }
});
test('Strings: single quote escape', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("'\\'quoted\\''");
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 1 /* StringTokenFlags.SingleQuote */);
    assert_1.default.equal(stringToken.length, 12);
    assert_1.default.equal(stringToken.prefixLength, 0);
    assert_1.default.equal(stringToken.escapedValue, "\\'quoted\\'");
});
test('Strings: double quote escape', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"\\"quoted\\""');
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(stringToken.length, 12);
    assert_1.default.equal(stringToken.escapedValue, '\\"quoted\\"');
});
test('Strings: triplicate double quote escape', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"""\\"quoted\\""""');
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 4 /* StringTokenFlags.Triplicate */);
    assert_1.default.equal(stringToken.length, 16);
    assert_1.default.equal(stringToken.escapedValue, '\\"quoted\\"');
});
test('Strings: single quoted f-string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("a+f'quoted'");
    assert_1.default.equal(results.tokens.count, 5 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 9 /* TokenType.Operator */);
    const fStringStartToken = results.tokens.getItemAt(2);
    assert_1.default.equal(fStringStartToken.type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(fStringStartToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringStartToken.length, 2);
    const fStringMiddleToken = results.tokens.getItemAt(3);
    assert_1.default.equal(fStringMiddleToken.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(fStringMiddleToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringMiddleToken.length, 6);
    assert_1.default.equal(fStringMiddleToken.escapedValue, 'quoted');
    const fStringEndToken = results.tokens.getItemAt(4);
    assert_1.default.equal(fStringEndToken.type, 26 /* TokenType.FStringEnd */);
    assert_1.default.equal(fStringEndToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringEndToken.length, 1);
});
test('Strings: double quoted f-string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('x(1,f"quoted")');
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 13 /* TokenType.OpenParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 12 /* TokenType.Comma */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 14 /* TokenType.CloseParenthesis */);
    const fStringStartToken = results.tokens.getItemAt(4);
    assert_1.default.equal(fStringStartToken.type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(fStringStartToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringStartToken.length, 2);
    const fStringMiddleToken = results.tokens.getItemAt(5);
    assert_1.default.equal(fStringMiddleToken.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(fStringMiddleToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringMiddleToken.length, 6);
    assert_1.default.equal(fStringMiddleToken.escapedValue, 'quoted');
    const fStringEndToken = results.tokens.getItemAt(6);
    assert_1.default.equal(fStringEndToken.type, 26 /* TokenType.FStringEnd */);
    assert_1.default.equal(fStringEndToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringEndToken.length, 1);
});
test('Strings: single quoted multiline f-string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'''quoted'''");
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    const fStringStartToken = results.tokens.getItemAt(0);
    assert_1.default.equal(fStringStartToken.type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(fStringStartToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 4 /* StringTokenFlags.Triplicate */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringStartToken.length, 4);
    const fStringMiddleToken = results.tokens.getItemAt(1);
    assert_1.default.equal(fStringMiddleToken.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(fStringMiddleToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 4 /* StringTokenFlags.Triplicate */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringMiddleToken.length, 6);
    assert_1.default.equal(fStringMiddleToken.escapedValue, 'quoted');
    const fStringEndToken = results.tokens.getItemAt(2);
    assert_1.default.equal(fStringEndToken.type, 26 /* TokenType.FStringEnd */);
    assert_1.default.equal(fStringEndToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 4 /* StringTokenFlags.Triplicate */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringEndToken.length, 3);
});
test('Strings: double quoted multiline f-string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('f"""quoted """');
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    const fStringStartToken = results.tokens.getItemAt(0);
    assert_1.default.equal(fStringStartToken.type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(fStringStartToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 4 /* StringTokenFlags.Triplicate */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringStartToken.length, 4);
    const fStringMiddleToken = results.tokens.getItemAt(1);
    assert_1.default.equal(fStringMiddleToken.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(fStringMiddleToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 4 /* StringTokenFlags.Triplicate */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringMiddleToken.length, 7);
    assert_1.default.equal(fStringMiddleToken.escapedValue, 'quoted ');
    const fStringEndToken = results.tokens.getItemAt(2);
    assert_1.default.equal(fStringEndToken.type, 26 /* TokenType.FStringEnd */);
    assert_1.default.equal(fStringEndToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 4 /* StringTokenFlags.Triplicate */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringEndToken.length, 3);
});
test('Strings: f-string with single right brace', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'hello}'");
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCount);
    const fStringStartToken = results.tokens.getItemAt(0);
    assert_1.default.equal(fStringStartToken.type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(fStringStartToken.length, 2);
    assert_1.default.equal(fStringStartToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 64 /* StringTokenFlags.Format */);
    const fStringMiddleToken = results.tokens.getItemAt(1);
    assert_1.default.equal(fStringMiddleToken.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(fStringMiddleToken.length, 5);
    assert_1.default.equal(fStringMiddleToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 64 /* StringTokenFlags.Format */ | 256 /* StringTokenFlags.ReplacementFieldEnd */);
    const braceToken = results.tokens.getItemAt(2).type;
    assert_1.default.equal(braceToken, 18 /* TokenType.CloseCurlyBrace */);
    const fStringEndToken = results.tokens.getItemAt(3);
    assert_1.default.equal(fStringEndToken.type, 26 /* TokenType.FStringEnd */);
    assert_1.default.equal(fStringEndToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 64 /* StringTokenFlags.Format */);
    assert_1.default.equal(fStringEndToken.length, 1);
});
test('Strings: f-string with backslash escape', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f'\\\\'`);
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    const fStringMiddleToken = results.tokens.getItemAt(1);
    assert_1.default.equal(fStringMiddleToken.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(fStringMiddleToken.length, 2);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with new line escape', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f'x \\\ny'`);
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with escape in expression', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f'hello { "\\t" }'`);
    assert_1.default.equal(results.tokens.count, 6 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 5 /* TokenType.String */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with escape in format string 1', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'he\\{ 1 }lo'");
    assert_1.default.equal(results.tokens.count, 7 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    const middleFString = results.tokens.getItemAt(1);
    assert_1.default.equal(middleFString.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(middleFString.escapedValue.length, 3);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with escape in format string 2', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f"'{{\\"{0}\\": {0}}}'"`);
    assert_1.default.equal(results.tokens.count, 11 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    const middleFString = results.tokens.getItemAt(1);
    assert_1.default.equal(middleFString.type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(middleFString.escapedValue.length, 5);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(9).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(10).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with double brace', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f"hello {{{0==0}}}"`);
    assert_1.default.equal(results.tokens.count, 9 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with walrus operator', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f"{(x:=0)}"`);
    assert_1.default.equal(results.tokens.count, 9 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 13 /* TokenType.OpenParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 14 /* TokenType.CloseParenthesis */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with single right brace', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f"}"`);
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with comment', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(`f'''hello{\nx # comment\n}'''`);
    assert_1.default.equal(results.tokens.count, 6 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    const closeBraceToken = results.tokens.getItemAt(4);
    assert_1.default.equal(closeBraceToken.type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.deepEqual(closeBraceToken.comments, [
        { type: 0 /* CommentType.Regular */, value: ' comment', start: 14, length: 8 },
    ]);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with unterminated expression', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'hello { a'");
    assert_1.default.equal(results.tokens.count, 5 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    const fStringEnd = results.tokens.getItemAt(4);
    assert_1.default.equal(fStringEnd.type, 26 /* TokenType.FStringEnd */);
    assert_1.default.equal(fStringEnd.flags, 64 /* StringTokenFlags.Format */ | 1 /* StringTokenFlags.SingleQuote */);
});
test('Strings: f-string with replacement field', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'hello { a + b}'");
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with format specifier', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'hello { a ! b}'");
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 23 /* TokenType.ExclamationMark */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: f-string with debug format specifier', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'hello { a =}'");
    assert_1.default.equal(results.tokens.count, 7 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: nested f-string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'{f'{a}'}'");
    assert_1.default.equal(results.tokens.count, 9 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 26 /* TokenType.FStringEnd */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: nested f-string formats 1', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'{a:x{{b}+:x{c}+}}'");
    assert_1.default.equal(results.tokens.count, 19 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 10 /* TokenType.Colon */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(9).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(10).type, 10 /* TokenType.Colon */);
    assert_1.default.equal(results.tokens.getItemAt(11).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(12).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(13).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(14).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(15).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(16).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(17).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(18).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: nested f-string formats 2', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("f'hi{'x':*^{8:{'':}}0}'");
    assert_1.default.equal(results.tokens.count, 17 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 24 /* TokenType.FStringStart */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 5 /* TokenType.String */);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 10 /* TokenType.Colon */);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 10 /* TokenType.Colon */);
    assert_1.default.equal(results.tokens.getItemAt(9).type, 17 /* TokenType.OpenCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(10).type, 5 /* TokenType.String */);
    assert_1.default.equal(results.tokens.getItemAt(11).type, 10 /* TokenType.Colon */);
    assert_1.default.equal(results.tokens.getItemAt(12).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(13).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(14).type, 25 /* TokenType.FStringMiddle */);
    assert_1.default.equal(results.tokens.getItemAt(15).type, 18 /* TokenType.CloseCurlyBrace */);
    assert_1.default.equal(results.tokens.getItemAt(16).type, 26 /* TokenType.FStringEnd */);
});
test('Strings: escape at the end of single quoted string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("'quoted\\'\nx");
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 1 /* StringTokenFlags.SingleQuote */ | 65536 /* StringTokenFlags.Unterminated */);
    assert_1.default.equal(stringToken.length, 9);
    assert_1.default.equal(stringToken.escapedValue, "quoted\\'");
    assert_1.default.equal(results.tokens.getItemAt(1).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(8), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(10), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 4);
    assert_1.default.equal(results.tokens.contains(10), true);
    assert_1.default.equal(results.tokens.contains(11), false);
});
test('Strings: escape at the end of double quoted string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"quoted\\"\nx');
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 65536 /* StringTokenFlags.Unterminated */);
    assert_1.default.equal(stringToken.length, 9);
    assert_1.default.equal(stringToken.escapedValue, 'quoted\\"');
    assert_1.default.equal(results.tokens.getItemAt(1).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
});
test('Strings: b/u/r-string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('b"b" U\'u\' bR"br" Ru\'ur\'');
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCount);
    const stringToken0 = results.tokens.getItemAt(0);
    assert_1.default.equal(stringToken0.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken0.flags, 2 /* StringTokenFlags.DoubleQuote */ | 32 /* StringTokenFlags.Bytes */);
    assert_1.default.equal(stringToken0.length, 4);
    assert_1.default.equal(stringToken0.escapedValue, 'b');
    assert_1.default.equal(stringToken0.prefixLength, 1);
    const stringToken1 = results.tokens.getItemAt(1);
    assert_1.default.equal(stringToken1.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken1.flags, 1 /* StringTokenFlags.SingleQuote */ | 16 /* StringTokenFlags.Unicode */);
    assert_1.default.equal(stringToken1.length, 4);
    assert_1.default.equal(stringToken1.escapedValue, 'u');
    assert_1.default.equal(stringToken1.prefixLength, 1);
    const stringToken2 = results.tokens.getItemAt(2);
    assert_1.default.equal(stringToken2.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken2.flags, 2 /* StringTokenFlags.DoubleQuote */ | 32 /* StringTokenFlags.Bytes */ | 8 /* StringTokenFlags.Raw */);
    assert_1.default.equal(stringToken2.length, 6);
    assert_1.default.equal(stringToken2.escapedValue, 'br');
    assert_1.default.equal(stringToken2.prefixLength, 2);
    const stringToken3 = results.tokens.getItemAt(3);
    assert_1.default.equal(stringToken3.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken3.flags, 1 /* StringTokenFlags.SingleQuote */ | 16 /* StringTokenFlags.Unicode */ | 8 /* StringTokenFlags.Raw */);
    assert_1.default.equal(stringToken3.length, 6);
    assert_1.default.equal(stringToken3.escapedValue, 'ur');
    assert_1.default.equal(stringToken3.prefixLength, 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(10), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(16), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(17), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(21), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(22), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(23), 5);
    assert_1.default.equal(results.tokens.contains(22), true);
    assert_1.default.equal(results.tokens.contains(23), false);
});
test('Strings: bytes string with non-ASCII', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize("B\"Teßt\" b'''Teñt'''");
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    const stringToken0 = results.tokens.getItemAt(0);
    const unescapedValue0 = StringTokenUtils.getUnescapedString(stringToken0);
    assert_1.default.equal(stringToken0.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken0.flags, 2 /* StringTokenFlags.DoubleQuote */ | 32 /* StringTokenFlags.Bytes */);
    assert_1.default.equal(unescapedValue0.nonAsciiInBytes, true);
    assert_1.default.equal(stringToken0.length, 7);
    const stringToken1 = results.tokens.getItemAt(1);
    const unescapedValue1 = StringTokenUtils.getUnescapedString(stringToken1);
    assert_1.default.equal(stringToken1.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken1.flags, 1 /* StringTokenFlags.SingleQuote */ | 32 /* StringTokenFlags.Bytes */ | 4 /* StringTokenFlags.Triplicate */);
    assert_1.default.equal(unescapedValue1.nonAsciiInBytes, true);
    assert_1.default.equal(stringToken1.length, 11);
});
test('Strings: raw strings with escapes', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('R"\\"" r"\\\r\n\\\n\\a"');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    const stringToken0 = results.tokens.getItemAt(0);
    const unescapedValue0 = StringTokenUtils.getUnescapedString(stringToken0);
    assert_1.default.equal(stringToken0.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken0.flags, 2 /* StringTokenFlags.DoubleQuote */ | 8 /* StringTokenFlags.Raw */);
    assert_1.default.equal(stringToken0.length, 5);
    assert_1.default.equal(stringToken0.escapedValue, '\\"');
    assert_1.default.equal(unescapedValue0.value, '\\"');
    const stringToken1 = results.tokens.getItemAt(1);
    const unescapedValue1 = StringTokenUtils.getUnescapedString(stringToken1);
    assert_1.default.equal(stringToken1.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken1.flags, 2 /* StringTokenFlags.DoubleQuote */ | 8 /* StringTokenFlags.Raw */);
    assert_1.default.equal(stringToken1.length, 10);
    assert_1.default.equal(stringToken1.escapedValue, '\\\r\n\\\n\\a');
    assert_1.default.equal(unescapedValue1.value, '\\\r\n\\\n\\a');
});
test('Strings: escape at the end of double quoted string', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"quoted\\"\nx');
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 2 /* StringTokenFlags.DoubleQuote */ | 65536 /* StringTokenFlags.Unterminated */);
    assert_1.default.equal(stringToken.length, 9);
    assert_1.default.equal(stringToken.escapedValue, 'quoted\\"');
    assert_1.default.equal(results.tokens.getItemAt(1).type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
});
test('Strings: special escape characters', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"\\r\\n\\a\\v\\t\\b\\f\\\\"');
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    const unescapedValue = StringTokenUtils.getUnescapedString(stringToken);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(stringToken.length, 18);
    assert_1.default.equal(unescapedValue.value, '\r\n\u0007\v\t\b\f\\');
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(17), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(18), 2);
    assert_1.default.equal(results.tokens.contains(17), true);
    assert_1.default.equal(results.tokens.contains(18), false);
});
test('Strings: invalid escape characters', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"\\d  \\ "');
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCount);
    const stringToken = results.tokens.getItemAt(0);
    const unescapedValue = StringTokenUtils.getUnescapedString(stringToken);
    assert_1.default.equal(stringToken.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(stringToken.length, 8);
    assert_1.default.equal(stringToken.escapedValue, '\\d  \\ ');
    assert_1.default.equal(unescapedValue.unescapeErrors.length, 2);
    assert_1.default.equal(unescapedValue.unescapeErrors[0].offset, 0);
    assert_1.default.equal(unescapedValue.unescapeErrors[0].length, 2);
    assert_1.default.equal(unescapedValue.unescapeErrors[0].errorType, 0 /* StringTokenUtils.UnescapeErrorType.InvalidEscapeSequence */);
    assert_1.default.equal(unescapedValue.unescapeErrors[1].offset, 4);
    assert_1.default.equal(unescapedValue.unescapeErrors[1].length, 2);
    assert_1.default.equal(unescapedValue.unescapeErrors[1].errorType, 0 /* StringTokenUtils.UnescapeErrorType.InvalidEscapeSequence */);
});
test('Strings: good hex escapes', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"\\x4d" "\\u006b" "\\U0000006F"');
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    const stringToken0 = results.tokens.getItemAt(0);
    const unescapedValue0 = StringTokenUtils.getUnescapedString(stringToken0);
    assert_1.default.equal(stringToken0.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken0.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(stringToken0.length, 6);
    assert_1.default.equal(stringToken0.escapedValue, '\\x4d');
    assert_1.default.equal(unescapedValue0.value, 'M');
    const stringToken1 = results.tokens.getItemAt(1);
    const unescapedValue1 = StringTokenUtils.getUnescapedString(stringToken1);
    assert_1.default.equal(stringToken1.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken1.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(stringToken1.length, 8);
    assert_1.default.equal(stringToken1.escapedValue, '\\u006b');
    assert_1.default.equal(unescapedValue1.value, 'k');
    const stringToken2 = results.tokens.getItemAt(2);
    const unescapedValue2 = StringTokenUtils.getUnescapedString(stringToken2);
    assert_1.default.equal(stringToken2.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken2.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(stringToken2.length, 12);
    assert_1.default.equal(stringToken2.escapedValue, '\\U0000006F');
    assert_1.default.equal(unescapedValue2.value, 'o');
});
test('Strings: bad hex escapes', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"\\x4g" "\\u006" "\\U0000006m"');
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    const stringToken0 = results.tokens.getItemAt(0);
    const unescapedValue0 = StringTokenUtils.getUnescapedString(stringToken0);
    assert_1.default.equal(stringToken0.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken0.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(unescapedValue0.unescapeErrors.length, 1);
    assert_1.default.equal(stringToken0.length, 6);
    assert_1.default.equal(unescapedValue0.value, '\\x4g');
    const stringToken1 = results.tokens.getItemAt(1);
    const unescapedValue1 = StringTokenUtils.getUnescapedString(stringToken1);
    assert_1.default.equal(stringToken1.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken1.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(unescapedValue1.unescapeErrors.length, 1);
    assert_1.default.equal(stringToken1.length, 7);
    assert_1.default.equal(unescapedValue1.value, '\\u006');
    const stringToken2 = results.tokens.getItemAt(2);
    const unescapedValue2 = StringTokenUtils.getUnescapedString(stringToken2);
    assert_1.default.equal(stringToken2.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken2.flags, 2 /* StringTokenFlags.DoubleQuote */);
    assert_1.default.equal(unescapedValue2.unescapeErrors.length, 1);
    assert_1.default.equal(stringToken2.length, 12);
    assert_1.default.equal(unescapedValue2.value, '\\U0000006m');
});
test('Strings: good name escapes', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"\\N{caret escape blah}" "a\\N{A9}a"');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    const stringToken0 = results.tokens.getItemAt(0);
    const unescapedValue0 = StringTokenUtils.getUnescapedString(stringToken0);
    assert_1.default.equal(stringToken0.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken0.flags, 2 /* StringTokenFlags.DoubleQuote */ | 512 /* StringTokenFlags.NamedUnicodeEscape */);
    assert_1.default.equal(stringToken0.length, 23);
    assert_1.default.equal(stringToken0.escapedValue, '\\N{caret escape blah}');
    assert_1.default.equal(unescapedValue0.value, '-');
    const stringToken1 = results.tokens.getItemAt(1);
    const unescapedValue1 = StringTokenUtils.getUnescapedString(stringToken1);
    assert_1.default.equal(stringToken1.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken1.flags, 2 /* StringTokenFlags.DoubleQuote */ | 512 /* StringTokenFlags.NamedUnicodeEscape */);
    assert_1.default.equal(stringToken1.length, 10);
    assert_1.default.equal(stringToken1.escapedValue, 'a\\N{A9}a');
    assert_1.default.equal(unescapedValue1.value, 'a-a');
});
test('Strings: bad name escapes', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('"\\N{caret" "\\N{.A9}"');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    const stringToken0 = results.tokens.getItemAt(0);
    const unescapedValue0 = StringTokenUtils.getUnescapedString(stringToken0);
    assert_1.default.equal(stringToken0.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken0.flags, 2 /* StringTokenFlags.DoubleQuote */ | 512 /* StringTokenFlags.NamedUnicodeEscape */);
    assert_1.default.equal(unescapedValue0.unescapeErrors.length, 1);
    assert_1.default.equal(stringToken0.length, 10);
    assert_1.default.equal(stringToken0.escapedValue, '\\N{caret');
    assert_1.default.equal(unescapedValue0.value, '\\N{caret');
    const stringToken1 = results.tokens.getItemAt(1);
    const unescapedValue1 = StringTokenUtils.getUnescapedString(stringToken1);
    assert_1.default.equal(stringToken1.type, 5 /* TokenType.String */);
    assert_1.default.equal(stringToken1.flags, 2 /* StringTokenFlags.DoubleQuote */ | 512 /* StringTokenFlags.NamedUnicodeEscape */);
    assert_1.default.equal(unescapedValue1.unescapeErrors.length, 1);
    assert_1.default.equal(stringToken1.length, 9);
    assert_1.default.equal(stringToken1.escapedValue, '\\N{.A9}');
    assert_1.default.equal(unescapedValue1.value, '\\N{.A9}');
});
test('Comments', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(' #co"""mment1\n\t\n#x\'y2 ');
    assert_1.default.equal(results.tokens.count, 1 + _implicitTokenCountNoImplicitNewLine);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 2 /* TokenType.NewLine */);
});
test('Period to operator token', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('x.y');
    assert_1.default.equal(results.tokens.count, 3 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 20 /* TokenType.Dot */);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
});
test('@ to operator token', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('@x');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 7 /* TokenType.Identifier */);
});
test('Unknown token', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('`$');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 22 /* TokenType.Backtick */);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 0 /* TokenType.Invalid */);
});
test('Hex number', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('1 0X2 0xFe_Ab 0x');
    assert_1.default.equal(results.tokens.count, 5 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).value, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(1).value, 2);
    assert_1.default.equal(results.tokens.getItemAt(1).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 7);
    assert_1.default.equal(results.tokens.getItemAt(2).value, 0xfeab);
    assert_1.default.equal(results.tokens.getItemAt(2).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(3).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 1);
});
test('Binary number', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('1 0B1 0b010 0b3 0b');
    assert_1.default.equal(results.tokens.count, 7 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).value, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(1).value, 1);
    assert_1.default.equal(results.tokens.getItemAt(1).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 5);
    assert_1.default.equal(results.tokens.getItemAt(2).value, 2);
    assert_1.default.equal(results.tokens.getItemAt(2).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(3).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(3).value, 0);
    assert_1.default.equal(results.tokens.getItemAt(3).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(5).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(6).length, 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(6), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(12), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(13), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(15), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(16), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(17), 6);
    assert_1.default.equal(results.tokens.getItemAtPosition(18), 8);
    assert_1.default.equal(results.tokens.contains(17), true);
    assert_1.default.equal(results.tokens.contains(18), false);
});
test('Octal number', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('1 0o4 0O0_7_7 -0o200 0o9 0oO');
    assert_1.default.equal(results.tokens.count, 9 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).value, 1);
    assert_1.default.equal(results.tokens.getItemAt(0).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(1).value, 4);
    assert_1.default.equal(results.tokens.getItemAt(1).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 7);
    assert_1.default.equal(results.tokens.getItemAt(2).value, 0o77);
    assert_1.default.equal(results.tokens.getItemAt(2).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(3).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 5);
    assert_1.default.equal(results.tokens.getItemAt(4).value, 0o200);
    assert_1.default.equal(results.tokens.getItemAt(4).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(5).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(5).value, 0);
    assert_1.default.equal(results.tokens.getItemAt(5).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(6).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(6).value, 'o9');
    assert_1.default.equal(results.tokens.getItemAt(7).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(7).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(7).value, 0);
    assert_1.default.equal(results.tokens.getItemAt(7).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(8).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(8).value, 'oO');
});
test('Decimal number', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('-2147483647 ++2147483647');
    assert_1.default.equal(results.tokens.count, 5 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 10);
    assert_1.default.equal(results.tokens.getItemAt(1).value, 2147483647);
    assert_1.default.equal(results.tokens.getItemAt(1).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(3).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 10);
    assert_1.default.equal(results.tokens.getItemAt(4).value, 2147483647);
    assert_1.default.equal(results.tokens.getItemAt(4).isInteger, true);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(12), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(13), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(14), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(23), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(24), 6);
    assert_1.default.equal(results.tokens.contains(23), true);
    assert_1.default.equal(results.tokens.contains(24), false);
});
test('Decimal number operator', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('a[: -1]');
    assert_1.default.equal(results.tokens.count, 6 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 1);
});
test('Floating point number', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('3.0 .2 ++.3e+12 --.4e1 1e-4 0.01 01.0');
    assert_1.default.equal(results.tokens.count, 11 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(0).value, 3);
    assert_1.default.equal(results.tokens.getItemAt(0).isInteger, false);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(1).value, 0.2);
    assert_1.default.equal(results.tokens.getItemAt(1).isInteger, false);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(3).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).value, 0.3e12);
    assert_1.default.equal(results.tokens.getItemAt(4).isInteger, false);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 6);
    assert_1.default.equal(results.tokens.getItemAt(5).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(5).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(6).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(7).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(7).value, 0.4e1);
    assert_1.default.equal(results.tokens.getItemAt(7).isInteger, false);
    assert_1.default.equal(results.tokens.getItemAt(7).length, 4);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(8).value, 1e-4);
    assert_1.default.equal(results.tokens.getItemAt(8).isInteger, false);
    assert_1.default.equal(results.tokens.getItemAt(8).length, 4);
    assert_1.default.equal(results.tokens.getItemAt(9).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(9).value, 0.01);
    assert_1.default.equal(results.tokens.getItemAt(9).isInteger, false);
    assert_1.default.equal(results.tokens.getItemAt(9).length, 4);
    assert_1.default.equal(results.tokens.getItemAt(10).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(10).value, 1.0);
    assert_1.default.equal(results.tokens.getItemAt(10).isInteger, false);
    assert_1.default.equal(results.tokens.getItemAt(10).length, 4);
});
test('Floating point numbers with parens', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('(3.0) (.2) (+.3e+12, .4e1; 0)');
    assert_1.default.equal(results.tokens.count, 14 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(8).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(8).length, 6);
    assert_1.default.equal(results.tokens.getItemAt(10).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(10).length, 4);
    assert_1.default.equal(results.tokens.getItemAt(12).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(12).length, 1);
});
test('Floating point numbers with operators', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('88.9/100.0*4.0-2.0,');
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 4);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 5);
    assert_1.default.equal(results.tokens.getItemAt(4).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(4).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(6).type, 6 /* TokenType.Number */);
    assert_1.default.equal(results.tokens.getItemAt(6).length, 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(5), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(10), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(11), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(13), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(14), 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(15), 6);
    assert_1.default.equal(results.tokens.getItemAtPosition(17), 6);
    assert_1.default.equal(results.tokens.getItemAtPosition(18), 7);
    assert_1.default.equal(results.tokens.getItemAtPosition(19), 9);
    assert_1.default.equal(results.tokens.contains(18), true);
    assert_1.default.equal(results.tokens.contains(19), false);
});
test('Imaginary numbers', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('88.9j/100.0J*4.0e-5j-2.0j,');
    assert_1.default.equal(results.tokens.count, 8 + _implicitTokenCount);
    const token0 = results.tokens.getItemAt(0);
    assert_1.default.equal(token0.type, 6 /* TokenType.Number */);
    assert_1.default.equal(token0.length, 5);
    (0, assert_1.default)(token0.isImaginary);
    const token2 = results.tokens.getItemAt(2);
    assert_1.default.equal(token2.type, 6 /* TokenType.Number */);
    assert_1.default.equal(token2.length, 6);
    (0, assert_1.default)(token2.isImaginary);
    const token4 = results.tokens.getItemAt(4);
    assert_1.default.equal(token4.type, 6 /* TokenType.Number */);
    assert_1.default.equal(token4.length, 7);
    (0, assert_1.default)(token4.isImaginary);
    const token6 = results.tokens.getItemAt(6);
    assert_1.default.equal(token6.type, 6 /* TokenType.Number */);
    assert_1.default.equal(token6.length, 4);
    (0, assert_1.default)(token6.isImaginary);
});
test('Underscore numbers', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('1_0_0_0 0_0 .5_00_3e-4 0xC__A_FE_F00D 10_000_000.0 0b_0011_1111_0100_1110');
    const lengths = [7, 3, 10, 14, 12, 22];
    const isIntegers = [true, true, false, true, false, true];
    assert_1.default.equal(results.tokens.count, 6 + _implicitTokenCount);
    for (let i = 0; i < lengths.length; i++) {
        assert_1.default.equal(results.tokens.getItemAt(i).type, 6 /* TokenType.Number */);
        assert_1.default.equal(results.tokens.getItemAt(i).length, lengths[i]);
        assert_1.default.equal(results.tokens.getItemAt(i).isInteger, isIntegers[i]);
    }
});
test('Simple expression, leading minus', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('x == -y');
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 2);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 9 /* TokenType.Operator */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 1);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(3).length, 1);
});
test('Operators', () => {
    const text = '< << <<= ' +
        '== != > >> >>= >= <=' +
        '+ - ~ %' +
        '* ** / // /= //=' +
        '*= += -= %= **= ' +
        '& &= | |= ^ ^= ' +
        ':= <>';
    const results = new tokenizer_1.Tokenizer().tokenize(text);
    const lengths = [1, 2, 3, 2, 2, 1, 2, 3, 2, 2, 1, 1, 1, 1, 1, 2, 1, 2, 2, 3, 2, 2, 2, 2, 3, 1, 2, 1, 2, 1, 2, 2, 2];
    const operatorTypes = [
        20 /* OperatorType.LessThan */,
        17 /* OperatorType.LeftShift */,
        18 /* OperatorType.LeftShiftEqual */,
        12 /* OperatorType.Equals */,
        28 /* OperatorType.NotEquals */,
        15 /* OperatorType.GreaterThan */,
        31 /* OperatorType.RightShift */,
        32 /* OperatorType.RightShiftEqual */,
        16 /* OperatorType.GreaterThanOrEqual */,
        21 /* OperatorType.LessThanOrEqual */,
        0 /* OperatorType.Add */,
        33 /* OperatorType.Subtract */,
        5 /* OperatorType.BitwiseInvert */,
        24 /* OperatorType.Mod */,
        26 /* OperatorType.Multiply */,
        29 /* OperatorType.Power */,
        10 /* OperatorType.Divide */,
        13 /* OperatorType.FloorDivide */,
        11 /* OperatorType.DivideEqual */,
        14 /* OperatorType.FloorDivideEqual */,
        27 /* OperatorType.MultiplyEqual */,
        1 /* OperatorType.AddEqual */,
        34 /* OperatorType.SubtractEqual */,
        25 /* OperatorType.ModEqual */,
        30 /* OperatorType.PowerEqual */,
        3 /* OperatorType.BitwiseAnd */,
        4 /* OperatorType.BitwiseAndEqual */,
        6 /* OperatorType.BitwiseOr */,
        7 /* OperatorType.BitwiseOrEqual */,
        8 /* OperatorType.BitwiseXor */,
        9 /* OperatorType.BitwiseXorEqual */,
        35 /* OperatorType.Walrus */,
        19 /* OperatorType.LessOrGreaterThan */,
    ];
    assert_1.default.equal(results.tokens.count - _implicitTokenCount, lengths.length);
    assert_1.default.equal(results.tokens.count - _implicitTokenCount, operatorTypes.length);
    for (let i = 0; i < lengths.length; i++) {
        const t = results.tokens.getItemAt(i);
        assert_1.default.equal(t.type, 9 /* TokenType.Operator */, `${t.type} at ${i} is not an operator`);
        assert_1.default.equal(t.operatorType, operatorTypes[i]);
        assert_1.default.equal(t.length, lengths[i], `Length ${t.length} at ${i} (text ${text.substr(t.start, t.length)}), expected ${lengths[i]}`);
    }
});
test('Identifiers', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('and __and __and__ and__');
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 8 /* TokenType.Keyword */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 5);
    assert_1.default.equal(results.tokens.getItemAt(2).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(2).length, 7);
    assert_1.default.equal(results.tokens.getItemAt(3).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(3).length, 5);
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(9), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(10), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(17), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(18), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(22), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(23), 5);
    assert_1.default.equal(results.tokens.contains(22), true);
    assert_1.default.equal(results.tokens.contains(23), false);
});
test('Lines1', () => {
    const sampleText = TestUtils.readSampleFile('lines1.py');
    const t = new tokenizer_1.Tokenizer();
    // Start with the line feed only. We don't know whether the
    // sample file was stored with CR/LF or just LF, so do
    // the replacement here.
    const sampleTextLfOnly = sampleText.replace(/\r\n/g, '\n');
    const resultsLf = t.tokenize(sampleTextLfOnly);
    assert_1.default.equal(resultsLf.lines.count, 15);
    // Now replace the LF with CR/LF sequences.
    const sampleTextCrLf = sampleTextLfOnly.replace(/\n/g, '\r\n');
    const resultsCrLf = t.tokenize(sampleTextCrLf);
    assert_1.default.equal(resultsCrLf.lines.count, 15);
});
test('Comments1', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('# hello\n# good bye\n\n\n""" test """ # another\n\n\npass');
    assert_1.default.equal(results.tokens.count, 4 + _implicitTokenCount);
    const token0 = results.tokens.getItemAt(0);
    assert_1.default.equal(token0.type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(token0.comments.length, 1);
    assert_1.default.equal(token0.comments[0].value, ' hello');
    const token1 = results.tokens.getItemAt(1);
    assert_1.default.equal(token1.type, 5 /* TokenType.String */);
    assert_1.default.equal(token1.comments.length, 1);
    assert_1.default.equal(token1.comments[0].value, ' good bye');
    const token2 = results.tokens.getItemAt(2);
    assert_1.default.equal(token2.type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(token2.comments.length, 1);
    assert_1.default.equal(token2.comments[0].value, ' another');
    assert_1.default.equal(results.tokens.getItemAtPosition(0), -1);
    assert_1.default.equal(results.tokens.getItemAtPosition(7), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(20), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(21), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(42), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(43), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(45), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(46), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(49), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(50), 5);
    assert_1.default.equal(results.tokens.contains(49), true);
    assert_1.default.equal(results.tokens.contains(50), false);
});
test('Comments2', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('class A:\n    def func(self):\n        pass\n        # comment\n    ');
    assert_1.default.equal(results.tokens.count, 16 + _implicitTokenCount);
    const token17 = results.tokens.getItemAt(17);
    assert_1.default.equal(token17.type, 1 /* TokenType.EndOfStream */);
    assert_1.default.equal(token17.comments, undefined);
    const start = token17.start;
    const token16 = results.tokens.getItemAt(16);
    assert_1.default.equal(token16.type, 4 /* TokenType.Dedent */);
    assert_1.default.equal(token16.start, start);
    assert_1.default.equal(token16.comments, undefined);
    // When multiple tokens have the same start position (and 0-length)
    // comments, if any, are stored on the first such token.
    const token15 = results.tokens.getItemAt(15);
    assert_1.default.equal(token15.type, 4 /* TokenType.Dedent */);
    assert_1.default.equal(token15.start, start);
    assert_1.default.equal(token15.comments.length, 1);
    assert_1.default.equal(token15.comments[0].value, ' comment');
    const token14 = results.tokens.getItemAt(14);
    assert_1.default.notEqual(token14.start, start);
});
test('Identifiers1', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('배열 数値 лік Opciók 可選值');
    assert_1.default.equal(results.tokens.count, 5 + _implicitTokenCount);
    // Korean (Hangul)
    const token0 = results.tokens.getItemAt(0);
    assert_1.default.equal(token0.type, 7 /* TokenType.Identifier */);
    // Japanese
    const token1 = results.tokens.getItemAt(1);
    assert_1.default.equal(token1.type, 7 /* TokenType.Identifier */);
    // Russian (Cyrillic)
    const token2 = results.tokens.getItemAt(2);
    assert_1.default.equal(token2.type, 7 /* TokenType.Identifier */);
    // Hungarian
    const token3 = results.tokens.getItemAt(3);
    assert_1.default.equal(token3.type, 7 /* TokenType.Identifier */);
    // Chinese
    const token4 = results.tokens.getItemAt(4);
    assert_1.default.equal(token4.type, 7 /* TokenType.Identifier */);
});
test('TypeIgnoreAll1', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n#type:ignore\n"test"');
    (0, assert_1.default)(results.typeIgnoreAll);
});
test('TypeIgnoreAll2', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n#    type:     ignore ssss\n');
    (0, assert_1.default)(results.typeIgnoreAll);
});
test('TypeIgnoreAll3', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n#    type:     ignoreSsss\n');
    (0, assert_1.default)(!results.typeIgnoreAll);
});
test('TypeIgnoreAll3', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\n"hello"\n# type: ignore\n');
    (0, assert_1.default)(!results.typeIgnoreAll);
});
test('TypeIgnoreLine1', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\na = 3 # type: ignore\n"test" # type:ignore');
    assert_1.default.equal(results.typeIgnoreLines.size, 2);
    (0, assert_1.default)(results.typeIgnoreLines.has(1));
    (0, assert_1.default)(results.typeIgnoreLines.has(2));
});
test('TypeIgnoreLine2', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('a = 3 # type: ignores\n"test" # type:ignore');
    assert_1.default.equal(results.typeIgnoreLines.size, 1);
    (0, assert_1.default)(results.typeIgnoreLines.has(1));
    assert_1.default.equal(results.tokens.getItemAtPosition(0), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(1), 0);
    assert_1.default.equal(results.tokens.getItemAtPosition(2), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(3), 1);
    assert_1.default.equal(results.tokens.getItemAtPosition(4), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(20), 2);
    assert_1.default.equal(results.tokens.getItemAtPosition(21), 3);
    assert_1.default.equal(results.tokens.getItemAtPosition(22), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(41), 4);
    assert_1.default.equal(results.tokens.getItemAtPosition(42), 6);
    assert_1.default.equal(results.tokens.contains(41), true);
    assert_1.default.equal(results.tokens.contains(42), false);
});
test('Constructor', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('def constructor');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    assert_1.default.equal(results.tokens.getItemAt(0).type, 8 /* TokenType.Keyword */);
    assert_1.default.equal(results.tokens.getItemAt(0).length, 3);
    assert_1.default.equal(results.tokens.getItemAt(1).type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(results.tokens.getItemAt(1).length, 11);
});
test('Normalization', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('ℝ 𝕽');
    assert_1.default.equal(results.tokens.count, 2 + _implicitTokenCount);
    let idToken = results.tokens.getItemAt(0);
    assert_1.default.equal(idToken.type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(idToken.length, 1);
    assert_1.default.equal(idToken.value, 'R');
    idToken = results.tokens.getItemAt(1);
    assert_1.default.equal(idToken.type, 7 /* TokenType.Identifier */);
    assert_1.default.equal(idToken.length, 2);
    assert_1.default.equal(idToken.value, 'R');
});
test('Last empty line', () => {
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize('\r\n');
    assert_1.default.equal(results.tokens.count, _implicitTokenCount);
    const newLineToken = results.tokens.getItemAt(0);
    assert_1.default.equal(newLineToken.type, 2 /* TokenType.NewLine */);
    assert_1.default.equal(newLineToken.length, 2);
    assert_1.default.equal(newLineToken.newLineType, 2 /* NewLineType.CarriageReturnLineFeed */);
    const eofToken = results.tokens.getItemAt(1);
    assert_1.default.equal(eofToken.type, 1 /* TokenType.EndOfStream */);
    assert_1.default.equal(eofToken.length, 0);
});
//# sourceMappingURL=tokenizer.test.js.map