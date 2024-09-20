"use strict";
/*
 * renameProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that rename identifier on the given position and its references.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenameProvider = void 0;
const sourceFileInfoUtils_1 = require("../analyzer/sourceFileInfoUtils");
const cancellationUtils_1 = require("../common/cancellationUtils");
const debug_1 = require("../common/debug");
const extensibility_1 = require("../common/extensibility");
const positionUtils_1 = require("../common/positionUtils");
const workspaceEditUtils_1 = require("../common/workspaceEditUtils");
const referencesProvider_1 = require("../languageService/referencesProvider");
class RenameProvider {
    constructor(_program, _fileUri, _position, _token) {
        this._program = _program;
        this._fileUri = _fileUri;
        this._position = _position;
        this._token = _token;
        this._parseResults = this._program.getParseResults(this._fileUri);
    }
    canRenameSymbol(isDefaultWorkspace, isUntitled) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return null;
        }
        const referencesResult = this._getReferenceResult();
        if (!referencesResult) {
            return null;
        }
        const renameMode = RenameProvider.getRenameSymbolMode(this._program, this._fileUri, referencesResult, isDefaultWorkspace, isUntitled);
        if (renameMode === 'none') {
            return null;
        }
        // Return the range of the symbol.
        return (0, positionUtils_1.convertTextRangeToRange)(referencesResult.nodeAtOffset, this._parseResults.tokenizerOutput.lines);
    }
    renameSymbol(newName, isDefaultWorkspace, isUntitled) {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return null;
        }
        const referencesResult = this._getReferenceResult();
        if (!referencesResult) {
            return null;
        }
        const referenceProvider = new referencesProvider_1.ReferencesProvider(this._program, this._token);
        const renameMode = RenameProvider.getRenameSymbolMode(this._program, this._fileUri, referencesResult, isDefaultWorkspace, isUntitled);
        switch (renameMode) {
            case 'singleFileMode':
                referenceProvider.addReferencesToResult(this._fileUri, /* includeDeclaration */ true, referencesResult);
                break;
            case 'multiFileMode': {
                for (const curSourceFileInfo of this._program.getSourceFileInfoList()) {
                    // Make sure we only add user code to the references to prevent us
                    // from accidentally changing third party library or type stub.
                    if ((0, sourceFileInfoUtils_1.isUserCode)(curSourceFileInfo)) {
                        // Make sure searching symbol name exists in the file.
                        const content = (_a = curSourceFileInfo.sourceFile.getFileContent()) !== null && _a !== void 0 ? _a : '';
                        if (!referencesResult.symbolNames.some((s) => content.search(s) >= 0)) {
                            continue;
                        }
                        referenceProvider.addReferencesToResult(curSourceFileInfo.sourceFile.getUri(), 
                        /* includeDeclaration */ true, referencesResult);
                    }
                    // This operation can consume significant memory, so check
                    // for situations where we need to discard the type cache.
                    this._program.handleMemoryHighUsage();
                }
                break;
            }
            case 'none':
                // Rename is not allowed.
                // ex) rename symbols from libraries.
                return null;
            default:
                (0, debug_1.assertNever)(renameMode);
        }
        const edits = [];
        referencesResult.locations.forEach((loc) => {
            edits.push({
                fileUri: loc.uri,
                range: loc.range,
                replacementText: newName,
            });
        });
        return (0, workspaceEditUtils_1.convertToWorkspaceEdit)(this._program.fileSystem, { edits, fileOperations: [] });
    }
    static getRenameSymbolMode(program, fileUri, referencesResult, isDefaultWorkspace, isUntitled) {
        const sourceFileInfo = program.getSourceFileInfo(fileUri);
        // We have 2 different cases
        // Single file mode.
        // 1. rename on default workspace (ex, standalone file mode).
        // 2. rename local symbols.
        // 3. rename symbols defined in the non user open file.
        //
        // and Multi file mode.
        // 1. rename public symbols defined in user files on regular workspace (ex, open folder mode).
        const userFile = (0, sourceFileInfoUtils_1.isUserCode)(sourceFileInfo);
        if (isDefaultWorkspace ||
            (userFile && !referencesResult.requiresGlobalSearch) ||
            (!userFile &&
                sourceFileInfo.isOpenByClient &&
                referencesResult.declarations.every((d) => program.getSourceFileInfo(d.uri) === sourceFileInfo))) {
            return 'singleFileMode';
        }
        if (referencesResult.declarations.every((d) => (0, sourceFileInfoUtils_1.isUserCode)(program.getSourceFileInfo(d.uri)))) {
            return 'multiFileMode';
        }
        // Rename is not allowed.
        // ex) rename symbols from libraries.
        return 'none';
    }
    _getReferenceResult() {
        const referencesResult = referencesProvider_1.ReferencesProvider.getDeclarationForPosition(this._program, this._fileUri, this._position, 
        /* reporter */ undefined, extensibility_1.ReferenceUseCase.Rename, this._token);
        if (!referencesResult) {
            return undefined;
        }
        if (referencesResult.containsOnlyImportDecls) {
            return undefined;
        }
        if (referencesResult.nonImportDeclarations.length === 0) {
            // There is no symbol we can rename.
            return undefined;
        }
        // Use declarations that doesn't contain import decls.
        return new referencesProvider_1.ReferencesResult(referencesResult.requiresGlobalSearch, referencesResult.nodeAtOffset, referencesResult.symbolNames, referencesResult.nonImportDeclarations, referencesResult.useCase, referencesResult.providers);
    }
}
exports.RenameProvider = RenameProvider;
//# sourceMappingURL=renameProvider.js.map