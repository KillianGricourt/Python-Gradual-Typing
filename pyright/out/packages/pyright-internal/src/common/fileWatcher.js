"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ignoredWatchEventFunction = exports.nullFileWatcherProvider = exports.nullFileWatcherHandler = void 0;
exports.nullFileWatcherHandler = {
    onFileChange(_1, _2) {
        // do nothing
    },
};
exports.nullFileWatcherProvider = {
    createFileWatcher(_1, _2) {
        return nullFileWatcher;
    },
};
// File watchers can give "changed" event even for a file open. but for those cases,
// it will give relative path rather than absolute path. To get rid of such cases,
// we will drop any event with relative paths. this trick is copied from VS Code
// (https://github.com/microsoft/vscode/blob/main/src/vs/platform/files/node/watcher/unix/chokidarWatcherService.ts)
function ignoredWatchEventFunction(paths) {
    const normalizedPaths = paths.map((p) => p.toLowerCase());
    return (path) => {
        if (!path || path.indexOf('__pycache__') >= 0) {
            return true;
        }
        const normalizedPath = path.toLowerCase();
        return normalizedPaths.every((p) => normalizedPath.indexOf(p) < 0);
    };
}
exports.ignoredWatchEventFunction = ignoredWatchEventFunction;
const nullFileWatcher = {
    close() {
        // empty;
    },
};
//# sourceMappingURL=fileWatcher.js.map