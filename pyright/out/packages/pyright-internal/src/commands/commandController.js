"use strict";
/*
 * commandController.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Implements language server commands execution functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandController = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const createTypeStub_1 = require("./createTypeStub");
const dumpFileDebugInfoCommand_1 = require("./dumpFileDebugInfoCommand");
const quickActionCommand_1 = require("./quickActionCommand");
const restartServer_1 = require("./restartServer");
class CommandController {
    constructor(ls) {
        this._createStub = new createTypeStub_1.CreateTypeStubCommand(ls);
        this._restartServer = new restartServer_1.RestartServerCommand(ls);
        this._quickAction = new quickActionCommand_1.QuickActionCommand(ls);
        this._dumpFileDebugInfo = new dumpFileDebugInfoCommand_1.DumpFileDebugInfoCommand(ls);
    }
    async execute(cmdParams, token) {
        switch (cmdParams.command) {
            case "pyright.organizeimports" /* Commands.orderImports */: {
                return this._quickAction.execute(cmdParams, token);
            }
            case "pyright.createtypestub" /* Commands.createTypeStub */: {
                return this._createStub.execute(cmdParams, token);
            }
            case "pyright.restartserver" /* Commands.restartServer */: {
                return this._restartServer.execute(cmdParams);
            }
            case "pyright.dumpFileDebugInfo" /* Commands.dumpFileDebugInfo */: {
                return this._dumpFileDebugInfo.execute(cmdParams, token);
            }
            default: {
                return new vscode_languageserver_1.ResponseError(1, 'Unsupported command');
            }
        }
    }
    isLongRunningCommand(command) {
        switch (command) {
            case "pyright.createtypestub" /* Commands.createTypeStub */:
            case "pyright.restartserver" /* Commands.restartServer */:
                return true;
            default:
                return false;
        }
    }
    isRefactoringCommand(command) {
        return false;
    }
}
exports.CommandController = CommandController;
//# sourceMappingURL=commandController.js.map