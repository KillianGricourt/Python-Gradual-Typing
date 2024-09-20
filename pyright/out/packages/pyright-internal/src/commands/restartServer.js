"use strict";
/*
 * restartServer.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Implements 'restart server' command functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestartServerCommand = void 0;
class RestartServerCommand {
    constructor(_ls) {
        this._ls = _ls;
    }
    async execute(cmdParams) {
        this._ls.restart();
    }
}
exports.RestartServerCommand = RestartServerCommand;
//# sourceMappingURL=restartServer.js.map