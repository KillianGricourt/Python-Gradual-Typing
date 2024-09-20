"use strict";
/*
 * envVarUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Utils functions that handles environment variables.
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
exports.expandPathVariables = exports.resolvePathWithEnvVariables = void 0;
const os = __importStar(require("os"));
const uri_1 = require("./uri/uri");
const pathUtils_1 = require("./pathUtils");
const serviceKeys_1 = require("./serviceKeys");
const stringUtils_1 = require("./stringUtils");
function resolvePathWithEnvVariables(workspace, path, workspaces) {
    const rootUri = workspace.rootUri;
    const expanded = expandPathVariables(path, rootUri !== null && rootUri !== void 0 ? rootUri : uri_1.Uri.empty(), workspaces);
    const caseDetector = workspace.service.serviceProvider.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector);
    if (maybeUri(expanded)) {
        // If path is expanded to uri, no need to resolve it against the workspace root.
        return uri_1.Uri.parse((0, pathUtils_1.normalizeSlashes)(expanded, '/'), caseDetector);
    }
    if (rootUri) {
        // normal case, resolve the path against workspace root.
        return rootUri.resolvePaths((0, pathUtils_1.normalizeSlashes)(expanded, '/'));
    }
    // We don't have workspace root. but path contains something that require `workspace root`
    if (path.includes('${workspaceFolder')) {
        return undefined;
    }
    // Without workspace root, we can't handle any `relative path`.
    if (!(0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)(expanded))) {
        return undefined;
    }
    // We have absolute file path.
    return uri_1.Uri.file(expanded, caseDetector);
}
exports.resolvePathWithEnvVariables = resolvePathWithEnvVariables;
// Expands certain predefined variables supported within VS Code settings.
// Ideally, VS Code would provide an API for doing this expansion, but
// it doesn't. We'll handle the most common variables here as a convenience.
function expandPathVariables(path, rootPath, workspaces) {
    // Make sure all replacements look like URI paths too.
    const replace = (match, replaceValue) => {
        path = path.replace(match, replaceValue);
    };
    // Replace everything inline.
    path = path.replace(/\$\{workspaceFolder\}/g, rootPath.getPath());
    // this is for vscode multiroot workspace supports.
    // https://code.visualstudio.com/docs/editor/variables-reference#_variables-scoped-per-workspace-folder
    for (const workspace of workspaces) {
        if (!workspace.rootUri) {
            continue;
        }
        const escapedWorkspaceName = (0, stringUtils_1.escapeRegExp)(workspace.workspaceName);
        const ws_regexp = RegExp(`\\$\\{workspaceFolder:${escapedWorkspaceName}\\}`, 'g');
        path = path.replace(ws_regexp, workspace.rootUri.getPath());
    }
    if (process.env.HOME !== undefined) {
        replace(/\$\{env:HOME\}/g, process.env.HOME || '');
    }
    if (process.env.USERNAME !== undefined) {
        replace(/\$\{env:USERNAME\}/g, process.env.USERNAME || '');
    }
    if (process.env.VIRTUAL_ENV !== undefined) {
        replace(/\$\{env:VIRTUAL_ENV\}/g, process.env.VIRTUAL_ENV || '');
    }
    if (os.homedir) {
        replace(/(?:^|\/)~(?=\/)/g, os.homedir() || process.env.HOME || process.env.USERPROFILE || '~');
    }
    return path;
}
exports.expandPathVariables = expandPathVariables;
function maybeUri(value) {
    const windows = /^[a-zA-Z]:\\?/;
    const uri = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/?\/?/;
    return uri.test(value) && !windows.test(value);
}
//# sourceMappingURL=envVarUtils.js.map