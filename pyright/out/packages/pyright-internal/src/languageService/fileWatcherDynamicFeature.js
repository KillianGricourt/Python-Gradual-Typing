"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcherDynamicFeature = void 0;
/*
 * fileWatcherDynamicFeature.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * implementation of file watcher feature dynamic registration
 */
const vscode_languageserver_1 = require("vscode-languageserver");
const service_1 = require("../analyzer/service");
const uriUtils_1 = require("../common/uri/uriUtils");
const dynamicFeature_1 = require("./dynamicFeature");
class FileWatcherDynamicFeature extends dynamicFeature_1.DynamicFeature {
    constructor(_connection, _hasWatchFileRelativePathCapability, _fs, _workspaceFactory) {
        super('file watcher');
        this._connection = _connection;
        this._hasWatchFileRelativePathCapability = _hasWatchFileRelativePathCapability;
        this._fs = _fs;
        this._workspaceFactory = _workspaceFactory;
    }
    registerFeature() {
        const watchKind = vscode_languageserver_1.WatchKind.Create | vscode_languageserver_1.WatchKind.Change | vscode_languageserver_1.WatchKind.Delete;
        // Set default (config files and all workspace files) first.
        const watchers = [
            { globPattern: `**/${service_1.configFileName}`, kind: watchKind },
            { globPattern: '**', kind: watchKind },
        ];
        // Add all python search paths to watch list
        if (this._hasWatchFileRelativePathCapability) {
            // Dedup search paths from all workspaces.
            // Get rid of any search path under workspace root since it is already watched by
            // "**" above.
            const foldersToWatch = (0, uriUtils_1.deduplicateFolders)(this._workspaceFactory
                .getNonDefaultWorkspaces()
                .map((w) => w.searchPathsToWatch.filter((p) => !p.startsWith(w.rootUri))));
            foldersToWatch.forEach((p) => {
                const globPattern = (0, uriUtils_1.isFile)(this._fs, p, /* treatZipDirectoryAsFile */ true)
                    ? { baseUri: p.getDirectory().toString(), pattern: p.fileName }
                    : { baseUri: p.toString(), pattern: '**' };
                watchers.push({ globPattern, kind: watchKind });
            });
        }
        return this._connection.client.register(vscode_languageserver_1.DidChangeWatchedFilesNotification.type, { watchers });
    }
}
exports.FileWatcherDynamicFeature = FileWatcherDynamicFeature;
//# sourceMappingURL=fileWatcherDynamicFeature.js.map