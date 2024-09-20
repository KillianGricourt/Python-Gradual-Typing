"use strict";
/*
 * quickActionCommand.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Implements command that maps to a quick action.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuickActionCommand = void 0;
const workspaceEditUtils_1 = require("../common/workspaceEditUtils");
const quickActions_1 = require("../languageService/quickActions");
const uri_1 = require("../common/uri/uri");
class QuickActionCommand {
    constructor(_ls) {
        this._ls = _ls;
    }
    async execute(params, token) {
        if (params.arguments && params.arguments.length >= 1) {
            const docUri = uri_1.Uri.parse(params.arguments[0], this._ls.serviceProvider);
            const otherArgs = params.arguments.slice(1);
            const workspace = await this._ls.getWorkspaceForFile(docUri);
            if (params.command === "pyright.organizeimports" /* Commands.orderImports */ && workspace.disableOrganizeImports) {
                return [];
            }
            const editActions = workspace.service.run((p) => {
                return (0, quickActions_1.performQuickAction)(p, docUri, params.command, otherArgs, token);
            }, token);
            return (0, workspaceEditUtils_1.convertToWorkspaceEdit)(workspace.service.fs, (0, workspaceEditUtils_1.convertToFileTextEdits)(docUri, editActions !== null && editActions !== void 0 ? editActions : []));
        }
    }
}
exports.QuickActionCommand = QuickActionCommand;
//# sourceMappingURL=quickActionCommand.js.map