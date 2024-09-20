"use strict";
/*
 * languageServer.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Tests to verify Pyright works as the backend for a language server.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const vscode_languageserver_1 = require("vscode-languageserver");
const positionUtils_1 = require("../common/positionUtils");
const pythonVersion_1 = require("../common/pythonVersion");
const core_1 = require("../common/core");
const pathUtils_1 = require("../common/pathUtils");
const languageServerTestUtils_1 = require("./lsp/languageServerTestUtils");
describe(`Basic language server tests`, () => {
    let serverInfo;
    async function runLanguageServer(projectRoots, code, callInitialize = true, extraSettings, pythonVersion = pythonVersion_1.pythonVersion3_10, supportsBackgroundThread) {
        const result = await (0, languageServerTestUtils_1.runPyrightServer)(projectRoots, code, callInitialize, extraSettings, pythonVersion, supportsBackgroundThread);
        serverInfo = result;
        return result;
    }
    afterEach(async () => {
        if (serverInfo) {
            await serverInfo.dispose();
            serverInfo = undefined;
        }
    });
    afterAll(async () => {
        await (0, languageServerTestUtils_1.cleanupAfterAll)();
    });
    test('Basic Initialize', async () => {
        var _a;
        const code = `
// @filename: test.py
//// # empty file
        `;
        const serverInfo = await runLanguageServer(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, code, /* callInitialize */ false);
        const initializeResult = await (0, languageServerTestUtils_1.initializeLanguageServer)(serverInfo);
        (0, assert_1.default)(initializeResult);
        (0, assert_1.default)((_a = initializeResult.capabilities.completionProvider) === null || _a === void 0 ? void 0 : _a.resolveProvider);
    });
    test('Initialize without workspace folder support', async () => {
        const code = `
// @filename: test.py
//// import [|/*marker*/os|]
        `;
        const info = await runLanguageServer(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, code, /* callInitialize */ false);
        // This will test clients with no folder and configuration support.
        const params = info.getInitializeParams();
        params.capabilities.workspace.workspaceFolders = false;
        params.capabilities.workspace.configuration = false;
        // Perform LSP Initialize/Initialized handshake.
        const result = await info.connection.sendRequest(vscode_languageserver_1.InitializeRequest.type, params, vscode_languageserver_1.CancellationToken.None);
        (0, assert_1.default)(result);
        await info.connection.sendNotification(vscode_languageserver_1.InitializedNotification.type, {});
        // Do simple hover request to verify our server works with a client that doesn't support
        // workspace folder/configuration capabilities.
        (0, languageServerTestUtils_1.openFile)(info, 'marker');
        const hoverResult = await (0, languageServerTestUtils_1.hover)(info, 'marker');
        (0, assert_1.default)(hoverResult);
        (0, assert_1.default)(vscode_languageserver_1.MarkupContent.is(hoverResult.contents));
        assert_1.default.strictEqual(hoverResult.contents.value, '```python\n(module) os\n```');
    });
    test('Hover', async () => {
        const code = `
// @filename: test.py
//// import [|/*marker*/os|]
        `;
        const info = await runLanguageServer(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, code, /* callInitialize */ true);
        // Do simple hover request
        (0, languageServerTestUtils_1.openFile)(info, 'marker');
        const hoverResult = await (0, languageServerTestUtils_1.hover)(info, 'marker');
        (0, assert_1.default)(hoverResult);
        (0, assert_1.default)(vscode_languageserver_1.MarkupContent.is(hoverResult.contents));
        assert_1.default.strictEqual(hoverResult.contents.value, '```python\n(module) os\n```');
    });
    test('Completions', async () => {
        const code = `
// @filename: test.py
//// import os
//// os.[|/*marker*/|]
        `;
        const info = await runLanguageServer(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, code, /* callInitialize */ true);
        // Do simple completion request
        (0, languageServerTestUtils_1.openFile)(info, 'marker');
        const marker = info.testData.markerPositions.get('marker');
        const fileUri = marker.fileUri;
        const text = info.testData.files.find((d) => d.fileName === marker.fileName).content;
        const parseResult = (0, languageServerTestUtils_1.getParseResults)(text);
        const completionResult = await info.connection.sendRequest(vscode_languageserver_1.CompletionRequest.type, {
            textDocument: { uri: fileUri.toString() },
            position: (0, positionUtils_1.convertOffsetToPosition)(marker.position, parseResult.tokenizerOutput.lines),
        }, vscode_languageserver_1.CancellationToken.None);
        (0, assert_1.default)(completionResult);
        (0, assert_1.default)(!(0, core_1.isArray)(completionResult));
        const completionItem = completionResult.items.find((i) => i.label === 'path');
        (0, assert_1.default)(completionItem);
    });
    test('background thread diagnostics', async () => {
        const code = `
// @filename: root/test.py
//// from math import cos, sin
//// import sys
//// [|/*marker*/|]
        `;
        const settings = [
            {
                item: {
                    scopeUri: `file://${(0, pathUtils_1.normalizeSlashes)(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, '/')}`,
                    section: 'python.analysis',
                },
                value: {
                    typeCheckingMode: 'strict',
                    diagnosticMode: 'workspace',
                },
            },
        ];
        const info = await runLanguageServer(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, code, 
        /* callInitialize */ true, settings, undefined, 
        /* supportsBackgroundThread */ true);
        // get the file containing the marker that also contains our task list comments
        await (0, languageServerTestUtils_1.openFile)(info, 'marker');
        // Wait for the diagnostics to publish
        const diagnostics = await (0, languageServerTestUtils_1.waitForDiagnostics)(info);
        const diagnostic = diagnostics.find((d) => d.uri.includes('root/test.py'));
        (0, assert_1.default)(diagnostic);
        assert_1.default.equal(diagnostic.diagnostics.length, 6);
        // Make sure the error has a special rule
        assert_1.default.equal(diagnostic.diagnostics[1].code, 'reportUnusedImport');
        assert_1.default.equal(diagnostic.diagnostics[3].code, 'reportUnusedImport');
        assert_1.default.equal(diagnostic.diagnostics[5].code, 'reportUnusedImport');
    });
    test('Diagnostic severity overrides test', async () => {
        const code = `
// @filename: test.py
//// def test([|/*marker*/x|]): ...
//// 
// @filename: pyproject.toml
//// 
    `;
        const settings = [
            {
                item: {
                    scopeUri: `file://${(0, pathUtils_1.normalizeSlashes)(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, '/')}`,
                    section: 'python.analysis',
                },
                value: {
                    diagnosticSeverityOverrides: {
                        reportUnknownParameterType: 'warning',
                    },
                },
            },
        ];
        const info = await runLanguageServer(languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, code, 
        /* callInitialize */ true, settings, undefined, 
        /* supportsBackgroundThread */ true);
        // get the file containing the marker that also contains our task list comments
        await (0, languageServerTestUtils_1.openFile)(info, 'marker');
        // Wait for the diagnostics to publish
        const diagnostics = await (0, languageServerTestUtils_1.waitForDiagnostics)(info);
        const diagnostic = diagnostics.find((d) => d.uri.includes('test.py'));
        (0, assert_1.default)(diagnostic);
        // Make sure the error has a special rule
        assert_1.default.equal(diagnostic.diagnostics[0].code, 'reportUnknownParameterType');
    });
});
//# sourceMappingURL=languageServer.test.js.map