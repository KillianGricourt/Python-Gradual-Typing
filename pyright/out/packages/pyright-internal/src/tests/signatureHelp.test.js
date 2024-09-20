"use strict";
/*
 * signatureHelp.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for signature help.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const vscode_languageserver_1 = require("vscode-languageserver");
const positionUtils_1 = require("../common/positionUtils");
const signatureHelpProvider_1 = require("../languageService/signatureHelpProvider");
const testState_1 = require("./harness/fourslash/testState");
const docStringService_1 = require("../common/docStringService");
test('invalid position in format string segment', () => {
    const code = `
// @filename: test.py
//// f'{"(".capit[|/*marker*/|]alize()}'
    `;
    checkSignatureHelp(code, false);
});
test('valid position in format string segment', () => {
    const code = `
// @filename: test.py
//// f'{"(".capitalize([|/*marker*/|])}'
    `;
    checkSignatureHelp(code, true);
});
test('valid position in the second format string segment', () => {
    const code = `
// @filename: test.py
//// f'{print("hello")} {"(".capitalize([|/*marker*/|])}'
    `;
    checkSignatureHelp(code, true);
});
test('invalid position in the second format string segment', () => {
    const code = `
// @filename: test.py
//// f'{print("hello")} {"(".capitalize [|/*marker*/|]  ()}'
    `;
    checkSignatureHelp(code, false);
});
test('nested call in format string segment', () => {
    const code = `
// @filename: test.py
//// def foo():
////     pass
////
//// f'{"(".capitalize(foo([|/*marker*/|]))}'
    `;
    checkSignatureHelp(code, true);
});
test('within arguments in format string segment', () => {
    const code = `
// @filename: test.py
//// def foo():
////     pass
////
//// f'{"(".capitalize(fo[|/*marker*/|]o())}'
    `;
    checkSignatureHelp(code, true);
});
function checkSignatureHelp(code, expects) {
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const marker = state.getMarkerByName('marker');
    const parseResults = state.workspace.service.getParseResults(marker.fileUri);
    const position = (0, positionUtils_1.convertOffsetToPosition)(marker.position, parseResults.tokenizerOutput.lines);
    const actual = new signatureHelpProvider_1.SignatureHelpProvider(state.workspace.service.test_program, marker.fileUri, position, vscode_languageserver_1.MarkupKind.Markdown, 
    /*hasSignatureLabelOffsetCapability*/ true, 
    /*hasActiveParameterCapability*/ true, 
    /*context*/ undefined, new docStringService_1.PyrightDocStringService(), vscode_languageserver_1.CancellationToken.None).getSignatureHelp();
    assert_1.default.strictEqual(!!actual, expects);
}
//# sourceMappingURL=signatureHelp.test.js.map