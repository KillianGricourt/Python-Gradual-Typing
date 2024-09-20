"use strict";
/*
 * workspaceEditUtils.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * test workspaceEditUtils
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
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const vscode_languageserver_1 = require("vscode-languageserver");
const sourceFile_1 = require("../analyzer/sourceFile");
const pathUtils_1 = require("../common/pathUtils");
const uri_1 = require("../common/uri/uri");
const workspaceEditUtils_1 = require("../common/workspaceEditUtils");
const analyzerServiceExecutor_1 = require("../languageService/analyzerServiceExecutor");
const testLanguageService_1 = require("./harness/fourslash/testLanguageService");
const testState_1 = require("./harness/fourslash/testState");
const workspaceEditTestUtils_1 = require("./harness/fourslash/workspaceEditTestUtils");
test('test applyWorkspaceEdits changes', async () => {
    var _a;
    const code = `
// @filename: test.py
//// [|/*marker*/|]
        `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const cloned = await getClonedService(state);
    const range = state.getRangeByMarkerName('marker');
    const fileChanged = new Map();
    applyWorkspaceEditToService(cloned, {
        changes: {
            [range.fileUri.toString()]: [
                {
                    range: state.convertPositionRange(range),
                    newText: 'Text Changed',
                },
            ],
        },
    }, fileChanged);
    assert.strictEqual(fileChanged.size, 1);
    assert.strictEqual((_a = cloned.test_program.getSourceFile(range.fileUri)) === null || _a === void 0 ? void 0 : _a.getFileContent(), 'Text Changed');
});
test('test edit mode for workspace', async () => {
    const code = `
// @filename: test.py
//// [|/*marker*/|]
            `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const addedFileUri = uri_1.Uri.file((0, pathUtils_1.combinePaths)((0, pathUtils_1.getDirectoryPath)(range.fileName), 'test2.py'), state.serviceProvider);
    const edits = state.workspace.service.runEditMode((program) => {
        const fileChanged = new Map();
        (0, workspaceEditUtils_1.applyWorkspaceEdit)(program, {
            documentChanges: [
                vscode_languageserver_types_1.TextDocumentEdit.create({
                    uri: range.fileUri.toString(),
                    version: null,
                }, [
                    {
                        range: state.convertPositionRange(range),
                        newText: 'import sys',
                    },
                ]),
            ],
        }, fileChanged);
        assert.strictEqual(fileChanged.size, 1);
        const info = program.getSourceFileInfo(range.fileUri);
        const sourceFile = info.sourceFile;
        program.analyzeFile(sourceFile.getUri(), vscode_languageserver_1.CancellationToken.None);
        assert.strictEqual(sourceFile.getFileContent(), 'import sys');
        assert.strictEqual(info.imports.length, 2);
        // Add a new file.
        program.setFileOpened(addedFileUri, 0, '', {
            isTracked: true,
            ipythonMode: sourceFile_1.IPythonMode.None,
            chainedFileUri: undefined,
        });
        (0, workspaceEditUtils_1.applyWorkspaceEdit)(program, {
            documentChanges: [
                vscode_languageserver_types_1.TextDocumentEdit.create({
                    uri: addedFileUri.toString(),
                    version: null,
                }, [
                    {
                        range: {
                            start: { line: 0, character: 0 },
                            end: { line: 0, character: 0 },
                        },
                        newText: 'import sys',
                    },
                ]),
            ],
        }, fileChanged);
        (0, workspaceEditUtils_1.applyWorkspaceEdit)(program, {
            documentChanges: [
                vscode_languageserver_types_1.TextDocumentEdit.create({
                    uri: addedFileUri.toString(),
                    version: null,
                }, [
                    {
                        range: {
                            start: { line: 0, character: 7 },
                            end: { line: 0, character: 10 },
                        },
                        newText: 'os',
                    },
                ]),
            ],
        }, fileChanged);
        const addedInfo = program.getSourceFileInfo(addedFileUri);
        const addedSourceFile = addedInfo.sourceFile;
        program.analyzeFile(addedSourceFile.getUri(), vscode_languageserver_1.CancellationToken.None);
        assert.strictEqual(addedSourceFile.getFileContent(), 'import os');
        assert.strictEqual(addedInfo.imports.length, 2);
    }, vscode_languageserver_1.CancellationToken.None);
    // After leaving edit mode, we should be back to where we were.
    const oldSourceFile = state.workspace.service.test_program.getSourceFile(range.fileUri);
    state.workspace.service.backgroundAnalysisProgram.analyzeFile(oldSourceFile.getUri(), vscode_languageserver_1.CancellationToken.None);
    assert.strictEqual(oldSourceFile === null || oldSourceFile === void 0 ? void 0 : oldSourceFile.getFileContent(), '');
    assert.strictEqual(oldSourceFile.getImports().length, 1);
    assert.strictEqual(edits.length, 2);
    assert.deepStrictEqual(edits[0].replacementText, 'import sys');
    assert.deepStrictEqual(edits[1].replacementText, 'import os');
    const addedSourceFile = state.workspace.service.test_program.getSourceFile(addedFileUri);
    // The added file should not be there.
    assert.ok(!addedSourceFile);
});
test('test applyWorkspaceEdits documentChanges', async () => {
    var _a;
    const code = `
// @filename: test.py
//// [|/*marker*/|]
        `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const cloned = await getClonedService(state);
    const range = state.getRangeByMarkerName('marker');
    const fileChanged = new Map();
    applyWorkspaceEditToService(cloned, {
        documentChanges: [
            vscode_languageserver_types_1.TextDocumentEdit.create({
                uri: range.fileUri.toString(),
                version: null,
            }, [
                {
                    range: state.convertPositionRange(range),
                    newText: 'Text Changed',
                },
            ]),
        ],
    }, fileChanged);
    assert.strictEqual(fileChanged.size, 1);
    assert.strictEqual((_a = cloned.test_program.getSourceFile(range.fileUri)) === null || _a === void 0 ? void 0 : _a.getFileContent(), 'Text Changed');
});
test('test generateWorkspaceEdits', async () => {
    const code = `
// @filename: test1.py
//// [|/*marker1*/|]

// @filename: test2.py
//// [|/*marker2*/|]
        `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const cloned = await getClonedService(state);
    const range1 = state.getRangeByMarkerName('marker1');
    const fileChanged = new Map();
    applyWorkspaceEditToService(cloned, {
        changes: {
            [range1.fileUri.toString()]: [
                {
                    range: state.convertPositionRange(range1),
                    newText: 'Test1 Changed',
                },
            ],
        },
    }, fileChanged);
    applyWorkspaceEditToService(cloned, {
        documentChanges: [
            vscode_languageserver_types_1.TextDocumentEdit.create({
                uri: range1.fileUri.toString(),
                version: null,
            }, [
                {
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                    newText: 'NewTest1',
                },
            ]),
        ],
    }, fileChanged);
    const range2 = state.getRangeByMarkerName('marker2');
    applyWorkspaceEditToService(cloned, {
        documentChanges: [
            vscode_languageserver_types_1.TextDocumentEdit.create({
                uri: range2.fileUri.toString(),
                version: null,
            }, [
                {
                    range: state.convertPositionRange(range2),
                    newText: 'Test2 Changed',
                },
            ]),
        ],
    }, fileChanged);
    applyWorkspaceEditToService(cloned, {
        changes: {
            [range2.fileUri.toString()]: [
                {
                    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 5 } },
                    newText: 'NewTest2',
                },
            ],
        },
    }, fileChanged);
    assert.strictEqual(fileChanged.size, 2);
    const actualEdits = (0, workspaceEditUtils_1.generateWorkspaceEdit)(state.workspace.service.fs, state.workspace.service, cloned, fileChanged);
    (0, workspaceEditTestUtils_1.verifyWorkspaceEdit)({
        changes: {
            [range1.fileUri.toString()]: [
                {
                    range: state.convertPositionRange(range1),
                    newText: 'NewTest1 Changed',
                },
            ],
            [range2.fileUri.toString()]: [
                {
                    range: state.convertPositionRange(range1),
                    newText: 'NewTest2 Changed',
                },
            ],
        },
    }, actualEdits);
});
function applyWorkspaceEditToService(service, edits, filesChanged) {
    const program = service.backgroundAnalysisProgram.program;
    (0, workspaceEditUtils_1.applyWorkspaceEdit)(program, edits, filesChanged);
}
async function getClonedService(state) {
    return await analyzerServiceExecutor_1.AnalyzerServiceExecutor.cloneService(new testLanguageService_1.TestLanguageService(state.workspace, state.console, state.workspace.service.fs), state.workspace, { useBackgroundAnalysis: false });
}
//# sourceMappingURL=workspaceEditUtils.test.js.map