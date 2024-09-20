"use strict";
/*
 * chokidarFileWatcherProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Implements a FileWatcherProvider using chokidar.
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
exports.ChokidarFileWatcherProvider = void 0;
const chokidar = __importStar(require("chokidar"));
const _isMacintosh = process.platform === 'darwin';
const _isLinux = process.platform === 'linux';
class ChokidarFileWatcherProvider {
    constructor(_console) {
        this._console = _console;
    }
    createFileWatcher(paths, listener) {
        return this._createFileSystemWatcher(paths).on('all', listener);
    }
    _createFileSystemWatcher(paths) {
        var _a;
        // The following options are copied from VS Code source base. It also
        // uses chokidar for its file watching.
        const watcherOptions = {
            ignoreInitial: true,
            ignorePermissionErrors: true,
            followSymlinks: true,
            interval: 1000,
            binaryInterval: 1000,
            disableGlobbing: true,
            awaitWriteFinish: {
                // this will make sure we re-scan files once file changes are written to disk
                stabilityThreshold: 1000,
                pollInterval: 1000,
            },
        };
        if (_isMacintosh) {
            // Explicitly disable on MacOS because it uses up large amounts of memory
            // and CPU for large file hierarchies, resulting in instability and crashes.
            watcherOptions.usePolling = false;
        }
        const excludes = ['**/__pycache__/**'];
        if (_isMacintosh || _isLinux) {
            if (paths.some((path) => path === '' || path === '/')) {
                excludes.push('/dev/**');
                if (_isLinux) {
                    excludes.push('/proc/**', '/sys/**');
                }
            }
        }
        watcherOptions.ignored = excludes;
        const watcher = chokidar.watch(paths, watcherOptions);
        watcher.on('error', (_) => {
            var _a;
            (_a = this._console) === null || _a === void 0 ? void 0 : _a.error('Error returned from file system watcher.');
        });
        // Detect if for some reason the native watcher library fails to load
        if (_isMacintosh && !watcher.options.useFsEvents) {
            (_a = this._console) === null || _a === void 0 ? void 0 : _a.info('Watcher could not use native fsevents library. File system watcher disabled.');
        }
        return watcher;
    }
}
exports.ChokidarFileWatcherProvider = ChokidarFileWatcherProvider;
//# sourceMappingURL=chokidarFileWatcherProvider.js.map