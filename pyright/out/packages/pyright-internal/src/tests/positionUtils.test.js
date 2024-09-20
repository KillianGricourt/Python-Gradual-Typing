"use strict";
/*
 * positionUtils.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for positionUtils module.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const diagnosticSink_1 = require("../common/diagnosticSink");
const positionUtils_1 = require("../common/positionUtils");
const parser_1 = require("../parser/parser");
const tokenizer_1 = require("../parser/tokenizer");
test('getLineEndOffset', () => {
    const code = 'a = 1';
    verifyLineEnding(code, 0, 5);
});
test('getLineEndOffset with windows style ending at EOF', () => {
    const code = 'a = 1\r\n';
    verifyLineEnding(code, 0, 5);
});
test('getLineEndOffset with windows style ending', () => {
    const code = 'a = 1\r\nb = 1';
    verifyLineEnding(code, 0, 5);
});
test('getLineEndOffset with unix style ending at EOF', () => {
    const code = 'a = 1\n';
    verifyLineEnding(code, 0, 5);
});
test('getLineEndOffset with unix style ending', () => {
    const code = 'a = 1\nb = 1';
    verifyLineEnding(code, 0, 5);
});
test('getLineEndOffset with mixed style ending', () => {
    const code = 'a = 1\r\nb = 1\nc = 1\n';
    verifyLineEnding(code, 0, 5);
    verifyLineEnding(code, 1, 5);
    verifyLineEnding(code, 2, 5);
});
test('End of file position and offest conversion', () => {
    const code = 'hello\n';
    const t = new tokenizer_1.Tokenizer();
    const results = t.tokenize(code);
    const position = (0, positionUtils_1.convertOffsetToPosition)(code.length, results.lines);
    assert_1.default.strictEqual(position.line, 1);
    const offset = (0, positionUtils_1.convertPositionToOffset)(position, results.lines);
    assert_1.default.strictEqual(offset, code.length);
});
function verifyLineEnding(code, line, expected) {
    const parser = new parser_1.Parser();
    const parseResults = parser.parseSourceFile(code, new parser_1.ParseOptions(), new diagnosticSink_1.DiagnosticSink());
    assert_1.default.strictEqual((0, positionUtils_1.getLineEndPosition)(parseResults.tokenizerOutput, parseResults.text, line).character, expected);
}
//# sourceMappingURL=positionUtils.test.js.map