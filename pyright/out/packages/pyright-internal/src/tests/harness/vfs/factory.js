"use strict";
/*
 * factory.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Provides a factory to create virtual file system backed by a real file system with some path remapped
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
exports.clearCache = exports.createFromFileSystem = exports.srcFolder = exports.typeshedFolder = exports.distlibFolder = exports.libFolder = exports.TextDocument = void 0;
const pathConsts = __importStar(require("../../../common/pathConsts"));
const pathUtils_1 = require("../../../common/pathUtils");
const uriUtils_1 = require("../../../common/uri/uriUtils");
const utils_1 = require("../utils");
const filesystem_1 = require("./filesystem");
class TextDocument {
    constructor(file, text, meta) {
        this.file = file;
        this.text = text;
        this.meta = meta || new Map();
    }
}
exports.TextDocument = TextDocument;
// Make sure all paths are lower case since `isCaseSensitive` is hard coded as `true`
exports.libFolder = uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)(filesystem_1.MODULE_PATH, (0, pathUtils_1.normalizeSlashes)((0, pathUtils_1.combinePaths)(pathConsts.lib, pathConsts.sitePackages))));
exports.distlibFolder = uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)(filesystem_1.MODULE_PATH, (0, pathUtils_1.normalizeSlashes)((0, pathUtils_1.combinePaths)(pathConsts.lib, pathConsts.distPackages))));
exports.typeshedFolder = uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)(filesystem_1.MODULE_PATH, (0, pathUtils_1.normalizeSlashes)(pathConsts.typeshedFallback)));
exports.srcFolder = (0, pathUtils_1.normalizeSlashes)('/.src');
/**
 * Create a virtual file system from a physical file system using the following path mappings:
 *
 *  - `/typeshed-fallback` is a directory mapped to `packages/pyright-internal/typeshed-fallback`
 *  - `/.src` is a virtual directory to be used for tests.
 *
 * @param host it provides an access to host (real) file system
 * @param ignoreCase indicates whether we should ignore casing on this file system or not
 * @param documents initial documents to create in this virtual file system
 * @param files initial files to create in this virtual file system
 * @param cwd initial current working directory in this virtual file system
 * @param time initial time in this virtual file system
 * @param meta initial metadata in this virtual file system
 *
 * all `FileSystemCreateOptions` are optional
 */
function createFromFileSystem(host, ignoreCase, { documents, files, cwd, time, meta } = {}, mountPaths = new Map()) {
    const typeshedPath = meta ? meta["typeshed" /* GlobalMetadataOptionNames.typeshed */] : undefined;
    if (typeshedPath) {
        mountPaths.set(exports.typeshedFolder.key, typeshedPath);
    }
    const fs = getBuiltLocal(host, ignoreCase, cwd, mountPaths).shadow();
    if (meta) {
        for (const key of Object.keys(meta)) {
            fs.meta.set(key, meta[key]);
        }
    }
    if (time) {
        fs.time(time);
    }
    if (cwd) {
        fs.mkdirpSync(cwd);
        fs.chdir(uriUtils_1.UriEx.file(cwd, !ignoreCase));
    }
    if (documents) {
        for (const document of documents) {
            fs.mkdirpSync((0, pathUtils_1.getDirectoryPath)(document.file));
            fs.writeFileSync(uriUtils_1.UriEx.file(document.file, !ignoreCase), document.text, 'utf8');
            fs.filemeta(document.file).set('document', document);
            // Add symlinks
            const symlink = document.meta.get('symlink');
            if (symlink) {
                for (const link of symlink.split(',').map((link) => link.trim())) {
                    fs.mkdirpSync((0, pathUtils_1.getDirectoryPath)(link));
                    fs.symlinkSync((0, pathUtils_1.resolvePaths)(fs.cwd(), document.file), link);
                }
            }
        }
    }
    if (files) {
        fs.apply(files);
    }
    return fs;
}
exports.createFromFileSystem = createFromFileSystem;
let cacheKey;
let localCIFSCache;
let localCSFSCache;
function clearCache() {
    cacheKey = undefined;
    localCIFSCache = undefined;
    localCSFSCache = undefined;
}
exports.clearCache = clearCache;
function getBuiltLocal(host, ignoreCase, cwd, mountPaths) {
    // Ensure typeshed folder
    if (!mountPaths.has(exports.typeshedFolder.key)) {
        mountPaths.set(exports.typeshedFolder.key, (0, pathUtils_1.resolvePaths)(host.getWorkspaceRoot(), pathConsts.typeshedFallback));
    }
    if (!canReuseCache(host, mountPaths)) {
        localCIFSCache = undefined;
        localCSFSCache = undefined;
        cacheKey = { host, mountPaths };
    }
    if (!localCIFSCache) {
        const resolver = createResolver(host);
        const files = {};
        mountPaths.forEach((v, k) => (files[k] = new filesystem_1.Mount(v, resolver)));
        localCIFSCache = new filesystem_1.TestFileSystem(/* ignoreCase */ true, {
            files,
            cwd,
            meta: {},
        });
        localCIFSCache.makeReadonly();
    }
    if (ignoreCase) {
        return localCIFSCache;
    }
    if (!localCSFSCache) {
        localCSFSCache = localCIFSCache.shadow(/* ignoreCase */ false);
        localCSFSCache.makeReadonly();
    }
    return localCSFSCache;
}
function canReuseCache(host, mountPaths) {
    if (cacheKey === undefined) {
        return false;
    }
    if (cacheKey.host !== host) {
        return false;
    }
    if (cacheKey.mountPaths.size !== mountPaths.size) {
        return false;
    }
    for (const key of cacheKey.mountPaths.keys()) {
        if (cacheKey.mountPaths.get(key) !== mountPaths.get(key)) {
            return false;
        }
    }
    return true;
}
function createResolver(host) {
    return {
        readdirSync(path) {
            const { files, directories } = host.getAccessibleFileSystemEntries(path);
            return directories.concat(files);
        },
        statSync(path) {
            if (host.directoryExists(path)) {
                return { mode: filesystem_1.S_IFDIR | 0o777, size: 0 };
            }
            else if (host.fileExists(path)) {
                return { mode: filesystem_1.S_IFREG | 0o666, size: host.getFileSize(path) };
            }
            else {
                throw new Error('ENOENT: path does not exist');
            }
        },
        readFileSync(path) {
            return (0, utils_1.bufferFrom)(host.readFile(path), 'utf8');
        },
    };
}
//# sourceMappingURL=factory.js.map