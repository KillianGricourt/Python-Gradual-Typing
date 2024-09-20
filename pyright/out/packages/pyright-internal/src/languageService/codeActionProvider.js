"use strict";
/*
 * codeActionProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Handles 'code actions' requests from the client.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeActionProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const cancellationUtils_1 = require("../common/cancellationUtils");
const commandUtils_1 = require("../common/commandUtils");
const workspaceEditUtils_1 = require("../common/workspaceEditUtils");
const localize_1 = require("../localization/localize");
class CodeActionProvider {
    static mightSupport(kinds) {
        if (!kinds || kinds.length === 0) {
            return true;
        }
        // Only support quick fix actions
        return kinds.some((s) => s.startsWith(vscode_languageserver_1.CodeActionKind.QuickFix));
    }
    static async getCodeActionsForPosition(workspace, fileUri, range, kinds, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const codeActions = [];
        if (!workspace.rootUri || workspace.disableLanguageServices) {
            return codeActions;
        }
        if (!this.mightSupport(kinds)) {
            // Early exit if code actions are going to be filtered anyway.
            return codeActions;
        }
        const diags = await workspace.service.getDiagnosticsForRange(fileUri, range, token);
        const typeStubDiag = diags.find((d) => {
            const actions = d.getActions();
            return actions && actions.find((a) => a.action === "pyright.createtypestub" /* Commands.createTypeStub */);
        });
        if (typeStubDiag) {
            const action = typeStubDiag
                .getActions()
                .find((a) => a.action === "pyright.createtypestub" /* Commands.createTypeStub */);
            if (action) {
                const createTypeStubAction = vscode_languageserver_1.CodeAction.create(localize_1.Localizer.CodeAction.createTypeStubFor().format({ moduleName: action.moduleName }), (0, commandUtils_1.createCommand)(localize_1.Localizer.CodeAction.createTypeStub(), "pyright.createtypestub" /* Commands.createTypeStub */, workspace.rootUri.toString(), action.moduleName, fileUri.toString()), vscode_languageserver_1.CodeActionKind.QuickFix);
                codeActions.push(createTypeStubAction);
            }
        }
        const renameShadowed = diags.find((d) => {
            const actions = d.getActions();
            return actions && actions.find((a) => a.action === "renameShadowedFile" /* ActionKind.RenameShadowedFileAction */);
        });
        if (renameShadowed) {
            const action = renameShadowed
                .getActions()
                .find((a) => a.action === "renameShadowedFile" /* ActionKind.RenameShadowedFileAction */);
            if (action) {
                const title = localize_1.Localizer.CodeAction.renameShadowedFile().format({
                    oldFile: action.oldUri.getShortenedFileName(),
                    newFile: action.newUri.getShortenedFileName(),
                });
                const editActions = {
                    edits: [],
                    fileOperations: [
                        {
                            kind: 'rename',
                            oldFileUri: action.oldUri,
                            newFileUri: action.newUri,
                        },
                    ],
                };
                const workspaceEdit = (0, workspaceEditUtils_1.convertToWorkspaceEdit)(workspace.service.fs, editActions);
                const renameAction = vscode_languageserver_1.CodeAction.create(title, workspaceEdit, vscode_languageserver_1.CodeActionKind.QuickFix);
                codeActions.push(renameAction);
            }
        }
        return codeActions;
    }
}
exports.CodeActionProvider = CodeActionProvider;
//# sourceMappingURL=codeActionProvider.js.map