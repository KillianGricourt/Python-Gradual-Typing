"use strict";
/*
 * testStateUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Test helpers for TestState
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyReferencesAtPosition = exports.applyFileEditActions = exports.verifyEdits = exports.convertRangeToFileEditAction = exports.convertFileEditActionToString = void 0;
const assert_1 = __importDefault(require("assert"));
const vscode_languageserver_1 = require("vscode-languageserver");
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const core_1 = require("../common/core");
const debug_1 = require("../common/debug");
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const workspaceEditUtils_1 = require("../common/workspaceEditUtils");
const documentSymbolCollector_1 = require("../languageService/documentSymbolCollector");
function convertFileEditActionToString(edit) {
    return `'${edit.replacementText.replace(/\n/g, '!n!')}'@'${edit.fileUri}:(${edit.range.start.line},${edit.range.start.character})-(${edit.range.end.line},${edit.range.end.character})'`;
}
exports.convertFileEditActionToString = convertFileEditActionToString;
function convertRangeToFileEditAction(state, range, replacementText) {
    var _a, _b;
    const data = (_a = range.marker) === null || _a === void 0 ? void 0 : _a.data;
    return {
        fileUri: range.fileUri,
        replacementText: ((_b = replacementText !== null && replacementText !== void 0 ? replacementText : data === null || data === void 0 ? void 0 : data.r) !== null && _b !== void 0 ? _b : 'N/A').replace(/!n!/g, '\n'),
        range: state.convertPositionRange(range),
    };
}
exports.convertRangeToFileEditAction = convertRangeToFileEditAction;
function verifyEdits(state, fileEditActions, ranges, replacementText) {
    for (const edit of fileEditActions.edits) {
        const expected = ranges.map((r) => convertRangeToFileEditAction(state, r, replacementText));
        (0, assert_1.default)(expected.some((a) => {
            return (a.fileUri.equals(edit.fileUri) &&
                (0, textRange_1.rangesAreEqual)(a.range, edit.range) &&
                a.replacementText === edit.replacementText);
        }), `can't find ${convertFileEditActionToString(edit)} in ${expected
            .map((a) => convertFileEditActionToString(a))
            .join('|')}`);
    }
}
exports.verifyEdits = verifyEdits;
function applyFileEditActions(state, fileEditActions) {
    // Apply changes
    // First, apply text changes
    const editsPerFileMap = (0, collectionUtils_1.createMapFromItems)(fileEditActions.edits, (e) => e.fileUri.key);
    for (const [editFileName, editsPerFile] of editsPerFileMap) {
        const result = _applyEdits(state, editFileName, editsPerFile);
        state.testFS.writeFileSync(uri_1.Uri.file(editFileName, state.serviceProvider), result.text, 'utf8');
        // Update open file content if the file is in opened state.
        if (result.version) {
            let openedFilePath = editFileName;
            const renamed = fileEditActions.fileOperations.find((o) => o.kind === 'rename' && o.oldFileUri.getFilePath() === editFileName);
            if ((renamed === null || renamed === void 0 ? void 0 : renamed.kind) === 'rename') {
                openedFilePath = renamed.newFileUri.getFilePath();
                state.program.setFileClosed(renamed.oldFileUri);
            }
            state.program.setFileOpened(uri_1.Uri.file(openedFilePath, state.serviceProvider), result.version + 1, result.text);
        }
    }
    // Second, apply filename change to disk or rename directory.
    for (const fileOperation of fileEditActions.fileOperations) {
        switch (fileOperation.kind) {
            case 'create': {
                state.testFS.mkdirpSync(fileOperation.fileUri.getDirectory().getFilePath());
                state.testFS.writeFileSync(fileOperation.fileUri, '');
                break;
            }
            case 'rename': {
                if ((0, uriUtils_1.isFile)(state.testFS, fileOperation.oldFileUri)) {
                    state.testFS.mkdirpSync(fileOperation.newFileUri.getDirectory().getFilePath());
                    state.testFS.renameSync(fileOperation.oldFileUri.getFilePath(), fileOperation.newFileUri.getFilePath());
                    // Add new file as tracked file
                    state.program.addTrackedFile(fileOperation.newFileUri);
                }
                else {
                    state.testFS.renameSync(fileOperation.oldFileUri.getFilePath(), fileOperation.newFileUri.getFilePath());
                }
                break;
            }
            case 'delete': {
                state.testFS.rimrafSync(fileOperation.fileUri.getFilePath());
                break;
            }
            default:
                (0, debug_1.assertNever)(fileOperation);
        }
    }
    // And refresh program.
    state.importResolver.invalidateCache();
    state.program.markAllFilesDirty(true);
}
exports.applyFileEditActions = applyFileEditActions;
function _applyEdits(state, filePath, edits) {
    const sourceFile = state.program.getBoundSourceFile(uri_1.Uri.file(filePath, state.serviceProvider));
    const parseResults = sourceFile.getParseResults();
    const current = (0, workspaceEditUtils_1.applyTextEditsToString)(edits.filter((e) => e.fileUri.getFilePath() === filePath), parseResults.tokenizerOutput.lines, parseResults.text);
    return { version: sourceFile.getClientVersion(), text: current };
}
function verifyReferencesAtPosition(program, configOption, symbolNames, fileName, position, ranges) {
    const sourceFile = program.getBoundSourceFile(uri_1.Uri.file(fileName, program.serviceProvider));
    (0, assert_1.default)(sourceFile);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(sourceFile.getParseResults().parserOutput.parseTree, position);
    const decls = documentSymbolCollector_1.DocumentSymbolCollector.getDeclarationsForNode(program, node, 
    /* resolveLocalName */ true, vscode_languageserver_1.CancellationToken.None);
    const rangesByFile = (0, collectionUtils_1.createMapFromItems)(ranges, (r) => r.fileName);
    for (const rangeFileName of rangesByFile.keys()) {
        const collector = new documentSymbolCollector_1.DocumentSymbolCollector(program, (0, core_1.isArray)(symbolNames) ? symbolNames : [symbolNames], decls, program
            .getBoundSourceFile(uri_1.Uri.file(rangeFileName, program.serviceProvider))
            .getParseResults().parserOutput.parseTree, vscode_languageserver_1.CancellationToken.None, {
            treatModuleInImportAndFromImportSame: true,
            skipUnreachableCode: false,
        });
        const results = collector.collect();
        const rangesOnFile = rangesByFile.get(rangeFileName);
        assert_1.default.strictEqual(results.length, rangesOnFile.length, `${rangeFileName}@${symbolNames}`);
        for (const result of results) {
            (0, assert_1.default)(rangesOnFile.some((r) => r.pos === result.range.start && r.end === textRange_1.TextRange.getEnd(result.range)));
        }
    }
}
exports.verifyReferencesAtPosition = verifyReferencesAtPosition;
//# sourceMappingURL=testStateUtils.js.map