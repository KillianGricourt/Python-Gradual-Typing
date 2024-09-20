"use strict";
/*
 * commandResult.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * wrapper for returning custom command data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandResult = void 0;
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
var CommandResult;
(function (CommandResult) {
    function is(value) {
        return value && value.label !== undefined && value.edits && vscode_languageserver_types_1.WorkspaceEdit.is(value.edits);
    }
    CommandResult.is = is;
})(CommandResult || (exports.CommandResult = CommandResult = {}));
//# sourceMappingURL=commandResult.js.map