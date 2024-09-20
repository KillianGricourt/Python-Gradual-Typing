"use strict";
/*
 * ipythonMode.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for tokenizer ipython mode
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const diagnosticRules_1 = require("../common/diagnosticRules");
const textRange_1 = require("../common/textRange");
const localize_1 = require("../localization/localize");
const testState_1 = require("./harness/fourslash/testState");
test('regular mode', () => {
    const code = `
//// [|/*marker*/%cd test|]
    `;
    testIPython(code, /*expectMagic*/ false);
});
test('ipython magic', () => {
    const code = `
// @ipythonMode: true
//// [|/*marker*/%cd test|]
    `;
    testIPython(code);
});
test('ipython shell escape', () => {
    const code = `
// @ipythonMode: true
//// [|/*marker*/!shellCommand|]
    `;
    testIPython(code);
});
test('ipython regular operator - mod', () => {
    const code = `
// @ipythonMode: true
//// a = 1 [|/*marker*/% 1|]
    `;
    testIPython(code, /*expectMagic*/ false);
});
test('ipython regular operator - bang', () => {
    const code = `
// @ipythonMode: true
//// a = 1
//// a [|/*marker*/!= 1|]
    `;
    testIPython(code, /*expectMagic*/ false);
});
test('ipython regular operator multiline', () => {
    const code = `
// @ipythonMode: true
//// a = 1 \\
//// [|/*marker*/% 1|]
    `;
    testIPython(code, /*expectMagic*/ false);
});
test('ipython at the top', () => {
    const code = `
// @ipythonMode: true
//// [|/*marker*/%cd test|]
//// b = 1
    `;
    testIPython(code);
});
test('ipython between statements', () => {
    const code = `
// @ipythonMode: true
//// a = 1
//// [|/*marker*/%cd test|]
//// b = 1
    `;
    testIPython(code);
});
test('ipython at the end', () => {
    const code = `
// @ipythonMode: true
//// a = 1
//// [|/*marker*/%cd test|]
    `;
    testIPython(code);
});
test('ipython multiline magics', () => {
    const code = `
// @ipythonMode: true
//// a = 1
//// [|/*marker*/%cd test \
////                 other arguments|]
    `;
    testIPython(code);
});
test('ipython cell mode magics', () => {
    const code = `
// @ipythonMode: true
//// [|/*marker*/%%timeit|]
    `;
    testIPython(code);
});
test('ipython with indentation', () => {
    const code = `
// @ipythonMode: true
//// def foo():
////     [|/*marker*/%cd test|]
////     pass
    `;
    testIPython(code);
});
test('ipython without indentation', () => {
    const code = `
// @ipythonMode: true
//// def foo():
//// [|/*marker*/%cd test|]
////     pass
    `;
    testIPython(code);
});
test('ipython mixed with regular comments 1', () => {
    const code = `
// @ipythonMode: true
//// def foo():
////     # comments
////     [|/*marker*/%cd test|]
////     pass
    `;
    testIPython(code);
});
test('ipython mixed with regular comments 2', () => {
    const code = `
// @ipythonMode: true
//// def foo():
////     # comments
////     [|/*marker*/%cd test|]
////     # comments
////     pass
    `;
    testIPython(code);
});
test('ipython mixed with regular comments 3', () => {
    const code = `
// @ipythonMode: true
//// def foo():
////     [|/*marker*/%cd test|]
////     # comments
////     pass
    `;
    testIPython(code);
});
test('ipython mixed with regular comments 4', () => {
    const code = `
// @ipythonMode: true
//// def foo():
//// [|/*marker*/%cd test|]
////     # comments
////     pass
    `;
    testIPython(code);
});
test('ipython multiple magics 1', () => {
    const code = `
// @ipythonMode: true
//// def foo():
//// [|/*marker*/%cd test|]
////     %cd test2
////     pass
    `;
    testIPython(code);
});
test('ipython multiple magics 2', () => {
    const code = `
// @ipythonMode: true
//// def foo():
//// %cd test
////     [|/*marker*/%cd test2|]
////     pass
    `;
    testIPython(code);
});
test('ipython cell magic', () => {
    const code = `
// @ipythonMode: true
//// def foo(): ...
//// [|/*marker*/%%cell magic
////     random text
////     and more|]
    `;
    testIPython(code);
});
test('ipython cell shell escape', () => {
    const code = `
// @ipythonMode: true
//// def foo(): ...
//// [|/*marker*/!!cell shell escape
////     random text
////     and more|]
    `;
    testIPython(code);
});
test('ipython wrong magic', () => {
    const code = `
// @ipythonMode: true
//// def foo(): 
//// [|/*marker*/%!not cell magic|]
////     ...
    `;
    testIPython(code);
});
test('top level await raises errors in regular mode', () => {
    const code = `
//// async def foo():
////     pass
//// 
//// [|/*marker*/await foo();|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.awaitNotInAsync()));
});
test('top level await raises no errors in ipython mode', () => {
    const code = `
// @ipythonMode: true
//// async def foo():
////     pass
//// 
//// [|/*marker*/await foo();|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(!(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.awaitNotInAsync())));
});
test('await still raises errors when used in wrong context in ipython mode', () => {
    const code = `
// @ipythonMode: true
//// async def foo():
////     pass
//// 
//// def bar():
////     [|/*marker*/await foo();|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.awaitNotInAsync()));
});
test('top level async for raises errors in regular mode', () => {
    const code = `
//// async def b():
////     for i in range(5):
////         yield i
////
//// [|/*marker*/async for x in b():|]
////     print("")
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.asyncNotInAsyncFunction()));
});
test('top level async for raises no errors in ipython mode', () => {
    const code = `
// @ipythonMode: true
//// async def b():
////     for i in range(5):
////         yield i
////
//// [|/*marker*/async for x in b():|]
////     print("")
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(!(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.asyncNotInAsyncFunction())));
});
test('top level async for in list comprehension raises errors in regular mode', () => {
    const code = `
//// async def b():
////     for i in range(5):
////         yield i
////
//// y = [|/*marker*/[x async for x in b()]|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.asyncNotInAsyncFunction()));
});
test('top level async for in list comprehension raises no errors in ipython mode', () => {
    const code = `
// @ipythonMode: true
//// async def b():
////     for i in range(5):
////         yield i
////
//// y = [|/*marker*/[x async for x in b()]|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(!(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.asyncNotInAsyncFunction())));
});
test('top level async with raises errors in regular mode', () => {
    const code = `
//// from contextlib import AsyncExitStack
////
//// cm = AsyncExitStack()
////
//// [|/*marker*/async with cm:|]
////     pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.asyncNotInAsyncFunction()));
});
test('top level async with raises no errors in ipython mode', () => {
    const code = `
// @ipythonMode: true
//// from contextlib import AsyncExitStack
////
//// cm = AsyncExitStack()
////
//// [|/*marker*/async with cm:|]
////     pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    (0, assert_1.default)(!(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.some((d) => d.message === localize_1.LocMessage.asyncNotInAsyncFunction())));
});
test('try implicitly load ipython display module but fail', async () => {
    const code = `
// @ipythonMode: true
//// [|display/*marker*/|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    await state.verifyCompletion('excluded', vscode_languageserver_types_1.MarkupKind.Markdown, {
        marker: {
            completions: [
                {
                    label: 'display',
                    kind: vscode_languageserver_types_1.CompletionItemKind.Function,
                },
            ],
        },
    });
});
test('magics at the end', async () => {
    const code = `
// @filename: test.py
// @ipythonMode: true
//// from random import random
//// def estimate_pi(n=1e7) -> "area":
////     """Estimate pi with monte carlo simulation.
////     
////     Arguments:
////         n: number of simulations
////     """
////     in_circle = 0
////     total = n
////     
////     while n != 0:
////         prec_x = random()
////         prec_y = random()
////         if pow(prec_x, 2) + pow(prec_y, 2) <= 1:
////             in_circle += 1 # inside the circle
////         n -= 1
////         
////     return 4 * in_circle / total
//// 
//// [|/*marker*/%time estimate_pi()|]
    `;
    testIPython(code);
});
function testIPython(code, expectMagic = true) {
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const results = state.program.getBoundSourceFile(range.fileUri).getParseResults();
    const text = results.text.substring(range.pos, range.end);
    const type = getCommentType(text);
    const offset = type === 1 /* CommentType.IPythonMagic */ || type === 2 /* CommentType.IPythonShellEscape */ ? 1 : 2;
    const comment = findCommentByOffset(results.tokenizerOutput.tokens, range.pos + offset);
    if (!expectMagic) {
        (0, assert_1.default)(!comment);
        return;
    }
    (0, assert_1.default)(comment);
    assert_1.default.strictEqual(type, comment.type);
    assert_1.default.strictEqual(text.substring(offset), comment.value);
}
function getCommentType(text) {
    (0, assert_1.default)(text.length > 0);
    const type = text[0] === '%' ? 1 /* CommentType.IPythonMagic */ : 2 /* CommentType.IPythonShellEscape */;
    if (text.length === 1) {
        return type;
    }
    switch (type) {
        case 1 /* CommentType.IPythonMagic */:
            return text[1] === '%' ? 3 /* CommentType.IPythonCellMagic */ : type;
        case 2 /* CommentType.IPythonShellEscape */:
            return text[1] === '!' ? 4 /* CommentType.IPythonCellShellEscape */ : type;
    }
}
function findCommentByOffset(tokens, offset) {
    var _a;
    let startIndex = tokens.getItemAtPosition(offset);
    startIndex = startIndex >= 0 ? startIndex : 0;
    let comment;
    for (let i = startIndex; i < tokens.count; i++) {
        const token = tokens.getItemAt(i);
        comment = (_a = token.comments) === null || _a === void 0 ? void 0 : _a.find((c) => textRange_1.TextRange.contains(c, offset));
        if (comment) {
            break;
        }
        if (offset < token.start) {
            return undefined;
        }
    }
    return comment;
}
test('unused expression at end is not error', async () => {
    const code = `
// @filename: test.py
// @ipythonMode: true
//// 4[|/*marker*/|]
    `;
    verifyAnalysisDiagnosticCount(code, 0);
});
test('unused expression is error if not at end of cell', async () => {
    const code = `
// @filename: test.py
// @ipythonMode: true
//// 4[|/*marker*/|]
////
//// x = 1
    `;
    verifyAnalysisDiagnosticCount(code, 1, diagnosticRules_1.DiagnosticRule.reportUnusedExpression);
});
test('unused expression is error if within another statement', async () => {
    const code = `
// @filename: test.py
// @ipythonMode: true
//// if True:
////     4[|/*marker*/|]
    `;
    verifyAnalysisDiagnosticCount(code, 1, diagnosticRules_1.DiagnosticRule.reportUnusedExpression);
});
function verifyAnalysisDiagnosticCount(code, expectedCount, expectedRule) {
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    state.analyze();
    const range = state.getRangeByMarkerName('marker');
    const source = state.program.getBoundSourceFile(range.fileUri);
    const diagnostics = source.getDiagnostics(state.configOptions);
    assert_1.default.strictEqual(diagnostics === null || diagnostics === void 0 ? void 0 : diagnostics.length, expectedCount);
    if (expectedRule) {
        diagnostics.forEach((diagnostic) => assert_1.default.strictEqual(diagnostic.getRule(), expectedRule));
    }
}
//# sourceMappingURL=ipythonMode.test.js.map