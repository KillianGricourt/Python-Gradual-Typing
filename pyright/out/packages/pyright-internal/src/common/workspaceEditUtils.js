"use strict";
/*
 * workspaceEditUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Convert pyright's FileEditActions to LanguageServer's WorkspaceEdits.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWorkspaceEdit = exports.applyDocumentChanges = exports.applyWorkspaceEdit = exports.applyTextEditsToString = exports.appendToWorkspaceEdit = exports.convertToWorkspaceEdit = exports.convertToFileTextEdits = exports.convertToTextEdits = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const vscode_languageserver_textdocument_1 = require("vscode-languageserver-textdocument");
const collectionUtils_1 = require("./collectionUtils");
const core_1 = require("./core");
const debug_1 = require("./debug");
const positionUtils_1 = require("./positionUtils");
const textRange_1 = require("./textRange");
const uri_1 = require("./uri/uri");
const uriUtils_1 = require("./uri/uriUtils");
function convertToTextEdits(editActions) {
    return editActions.map((editAction) => ({
        range: editAction.range,
        newText: editAction.replacementText,
    }));
}
exports.convertToTextEdits = convertToTextEdits;
function convertToFileTextEdits(fileUri, editActions) {
    return editActions.map((a) => ({ fileUri, ...a }));
}
exports.convertToFileTextEdits = convertToFileTextEdits;
function convertToWorkspaceEdit(fs, edits, changeAnnotations, defaultAnnotationId = 'default') {
    if ((0, core_1.isArray)(edits)) {
        return _convertToWorkspaceEditWithChanges(fs, edits);
    }
    return _convertToWorkspaceEditWithDocumentChanges(fs, edits, changeAnnotations, defaultAnnotationId);
}
exports.convertToWorkspaceEdit = convertToWorkspaceEdit;
function appendToWorkspaceEdit(fs, edits, workspaceEdit) {
    edits.forEach((edit) => {
        const uri = (0, uriUtils_1.convertUriToLspUriString)(fs, edit.fileUri);
        workspaceEdit.changes[uri] = workspaceEdit.changes[uri] || [];
        workspaceEdit.changes[uri].push({ range: edit.range, newText: edit.replacementText });
    });
}
exports.appendToWorkspaceEdit = appendToWorkspaceEdit;
function applyTextEditsToString(edits, lines, originalText) {
    const editsWithOffset = edits
        .map((e) => {
        var _a;
        return ({
            range: (_a = (0, positionUtils_1.convertRangeToTextRange)(e.range, lines)) !== null && _a !== void 0 ? _a : { start: originalText.length, length: 0 },
            text: e.replacementText,
        });
    })
        .sort((e1, e2) => {
        const result = e2.range.start - e1.range.start;
        if (result !== 0) {
            return result;
        }
        return textRange_1.TextRange.getEnd(e2.range) - textRange_1.TextRange.getEnd(e1.range);
    });
    // Apply change in reverse order.
    let current = originalText;
    for (const change of editsWithOffset) {
        current = current.substr(0, change.range.start) + change.text + current.substr(textRange_1.TextRange.getEnd(change.range));
    }
    return current;
}
exports.applyTextEditsToString = applyTextEditsToString;
function applyWorkspaceEdit(program, edits, filesChanged) {
    if (edits.changes) {
        for (const kv of Object.entries(edits.changes)) {
            const fileUri = uri_1.Uri.parse(kv[0], program.serviceProvider);
            const fileInfo = program.getSourceFileInfo(fileUri);
            if (!fileInfo || !fileInfo.isTracked) {
                // We don't allow non user file being modified.
                continue;
            }
            applyDocumentChanges(program, fileInfo, kv[1]);
            filesChanged.set(fileUri.key, fileUri);
        }
    }
    // For now, we don't support annotations.
    if (edits.documentChanges) {
        for (const change of edits.documentChanges) {
            if (vscode_languageserver_1.TextDocumentEdit.is(change)) {
                const fileUri = uri_1.Uri.parse(change.textDocument.uri, program.serviceProvider);
                const fileInfo = program.getSourceFileInfo(fileUri);
                if (!fileInfo || !fileInfo.isTracked) {
                    // We don't allow non user file being modified.
                    continue;
                }
                applyDocumentChanges(program, fileInfo, change.edits.filter((e) => vscode_languageserver_1.TextEdit.is(e)));
                filesChanged.set(fileUri.key, fileUri);
            }
            // For now, we don't support other kinds of text changes.
            // But if we want to add support for those in future, we should add them here.
        }
    }
}
exports.applyWorkspaceEdit = applyWorkspaceEdit;
function applyDocumentChanges(program, fileInfo, edits) {
    var _a, _b, _c, _d;
    if (!fileInfo.isOpenByClient) {
        const fileContent = fileInfo.sourceFile.getFileContent();
        program.setFileOpened(fileInfo.sourceFile.getUri(), 0, fileContent !== null && fileContent !== void 0 ? fileContent : '', {
            isTracked: fileInfo.isTracked,
            ipythonMode: fileInfo.sourceFile.getIPythonMode(),
            chainedFileUri: (_a = fileInfo.chainedSourceFile) === null || _a === void 0 ? void 0 : _a.sourceFile.getUri(),
        });
    }
    const version = (_b = fileInfo.sourceFile.getClientVersion()) !== null && _b !== void 0 ? _b : 0;
    const fileUri = fileInfo.sourceFile.getUri();
    const filePath = fileUri.getFilePath();
    const sourceDoc = vscode_languageserver_textdocument_1.TextDocument.create(filePath, 'python', version, (_c = fileInfo.sourceFile.getOpenFileContents()) !== null && _c !== void 0 ? _c : '');
    program.setFileOpened(fileUri, version + 1, vscode_languageserver_textdocument_1.TextDocument.applyEdits(sourceDoc, edits), {
        isTracked: fileInfo.isTracked,
        ipythonMode: fileInfo.sourceFile.getIPythonMode(),
        chainedFileUri: (_d = fileInfo.chainedSourceFile) === null || _d === void 0 ? void 0 : _d.sourceFile.getUri(),
    });
}
exports.applyDocumentChanges = applyDocumentChanges;
function generateWorkspaceEdit(fs, originalService, clonedService, filesChanged) {
    var _a;
    // For now, we won't do text diff to find out minimal text changes. instead, we will
    // consider whole text of the files are changed. In future, we could consider
    // doing minimal changes using vscode's differ (https://github.com/microsoft/vscode/blob/main/src/vs/base/common/diff/diff.ts)
    // to support annotation.
    const edits = { changes: {} };
    for (const uri of filesChanged.values()) {
        const original = originalService.backgroundAnalysisProgram.program.getBoundSourceFile(uri);
        const final = clonedService.backgroundAnalysisProgram.program.getBoundSourceFile(uri);
        if (!original || !final) {
            // Both must exist.
            continue;
        }
        const parseResults = original.getParseResults();
        if (!parseResults) {
            continue;
        }
        edits.changes[(0, uriUtils_1.convertUriToLspUriString)(fs, uri)] = [
            {
                range: (0, positionUtils_1.convertTextRangeToRange)(parseResults.parserOutput.parseTree, parseResults.tokenizerOutput.lines),
                newText: (_a = final.getFileContent()) !== null && _a !== void 0 ? _a : '',
            },
        ];
    }
    return edits;
}
exports.generateWorkspaceEdit = generateWorkspaceEdit;
function _convertToWorkspaceEditWithChanges(fs, edits) {
    const workspaceEdit = {
        changes: {},
    };
    appendToWorkspaceEdit(fs, edits, workspaceEdit);
    return workspaceEdit;
}
function _convertToWorkspaceEditWithDocumentChanges(fs, editActions, changeAnnotations, defaultAnnotationId = 'default') {
    const workspaceEdit = {
        documentChanges: [],
        changeAnnotations: changeAnnotations,
    };
    // Ordering of documentChanges are important.
    // Make sure create operation happens before edits.
    for (const operation of editActions.fileOperations) {
        switch (operation.kind) {
            case 'create':
                workspaceEdit.documentChanges.push(vscode_languageserver_1.CreateFile.create((0, uriUtils_1.convertUriToLspUriString)(fs, operation.fileUri), 
                /* options */ undefined, defaultAnnotationId));
                break;
            case 'rename':
            case 'delete':
                break;
            default:
                (0, debug_1.assertNever)(operation);
        }
    }
    // Text edit's file path must refer to original file paths unless it is a new file just created.
    const mapPerFile = (0, collectionUtils_1.createMapFromItems)(editActions.edits, (e) => (0, uriUtils_1.convertUriToLspUriString)(fs, e.fileUri));
    for (const [uri, value] of mapPerFile) {
        workspaceEdit.documentChanges.push(vscode_languageserver_1.TextDocumentEdit.create({ uri: uri, version: null }, Array.from(value.map((v) => ({
            range: v.range,
            newText: v.replacementText,
            annotationId: defaultAnnotationId,
        })))));
    }
    for (const operation of editActions.fileOperations) {
        switch (operation.kind) {
            case 'create':
                break;
            case 'rename':
                workspaceEdit.documentChanges.push(vscode_languageserver_1.RenameFile.create((0, uriUtils_1.convertUriToLspUriString)(fs, operation.oldFileUri), (0, uriUtils_1.convertUriToLspUriString)(fs, operation.newFileUri), 
                /* options */ undefined, defaultAnnotationId));
                break;
            case 'delete':
                workspaceEdit.documentChanges.push(vscode_languageserver_1.DeleteFile.create((0, uriUtils_1.convertUriToLspUriString)(fs, operation.fileUri), 
                /* options */ undefined, defaultAnnotationId));
                break;
            default:
                (0, debug_1.assertNever)(operation);
        }
    }
    return workspaceEdit;
}
//# sourceMappingURL=workspaceEditUtils.js.map