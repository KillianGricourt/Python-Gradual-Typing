"use strict";
/*
 * commandUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Utilities for working with LSP commands.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCommand = void 0;
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const uri_1 = require("./uri/uri");
function createCommand(title, command, ...args) {
    // Make sure if any of the args are URIs, we convert them to strings.
    const convertedArgs = args.map((arg) => {
        if (uri_1.Uri.is(arg)) {
            return arg.toString();
        }
        return arg;
    });
    return vscode_languageserver_types_1.Command.create(title, command, ...convertedArgs);
}
exports.createCommand = createCommand;
//# sourceMappingURL=commandUtils.js.map