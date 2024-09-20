"use strict";
/*
 * readonlyAugmentedFileSystem.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * A file system that lets one to augment backing file system but not allow
 * modifying the backing file system.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReadOnlyAugmentedFileSystem = void 0;
const collectionUtils_1 = require("./common/collectionUtils");
const fileSystem_1 = require("./common/fileSystem");
class ReadOnlyAugmentedFileSystem {
    constructor(realFS) {
        this.realFS = realFS;
        // Mapped file to original file map
        this._entryMap = new Map();
        // Original file to mapped file map
        this._reverseEntryMap = new Map();
        // Mapped files per a containing folder map
        this._folderMap = new Map();
    }
    existsSync(uri) {
        if (this.isMovedEntry(uri)) {
            // Pretend partial stub folder and its files not exist
            return false;
        }
        return this.realFS.existsSync(this.getOriginalPath(uri));
    }
    mkdirSync(uri, options) {
        throw new Error('Operation is not allowed.');
    }
    chdir(uri) {
        throw new Error('Operation is not allowed.');
    }
    readdirEntriesSync(uri) {
        const entries = [];
        const movedEntries = this._folderMap.get(uri.key);
        if (!movedEntries || this.realFS.existsSync(uri)) {
            (0, collectionUtils_1.appendArray)(entries, this.realFS.readdirEntriesSync(uri).filter((item) => {
                // Filter out the stub package directory and any
                // entries that will be overwritten by stub package
                // virtual items.
                return (!this.isMovedEntry(uri.combinePaths(item.name)) &&
                    !(movedEntries === null || movedEntries === void 0 ? void 0 : movedEntries.some((movedEntry) => movedEntry.name === item.name)));
            }));
        }
        if (!movedEntries) {
            return entries;
        }
        return entries.concat(movedEntries.map((e) => new fileSystem_1.VirtualDirent(e.name, e.isFile)));
    }
    readdirSync(uri) {
        return this.readdirEntriesSync(uri).map((p) => p.name);
    }
    readFileSync(uri, encoding) {
        return this.realFS.readFileSync(this.getOriginalPath(uri), encoding);
    }
    writeFileSync(uri, data, encoding) {
        throw new Error('Operation is not allowed.');
    }
    statSync(uri) {
        return this.realFS.statSync(this.getOriginalPath(uri));
    }
    rmdirSync(uri) {
        throw new Error('Operation is not allowed.');
    }
    unlinkSync(uri) {
        throw new Error('Operation is not allowed.');
    }
    realpathSync(uri) {
        if (this._entryMap.has(uri.key)) {
            return uri;
        }
        return this.realFS.realpathSync(uri);
    }
    getModulePath() {
        return this.realFS.getModulePath();
    }
    createFileSystemWatcher(paths, listener) {
        return this.realFS.createFileSystemWatcher(paths, listener);
    }
    createReadStream(uri) {
        return this.realFS.createReadStream(this.getOriginalPath(uri));
    }
    createWriteStream(uri) {
        throw new Error('Operation is not allowed.');
    }
    copyFileSync(src, dst) {
        throw new Error('Operation is not allowed.');
    }
    // Async I/O
    readFile(uri) {
        return this.realFS.readFile(this.getOriginalPath(uri));
    }
    readFileText(uri, encoding) {
        return this.realFS.readFileText(this.getOriginalPath(uri), encoding);
    }
    realCasePath(uri) {
        return this.realFS.realCasePath(uri);
    }
    // See whether the file is mapped to another location.
    isMappedUri(fileUri) {
        return this._entryMap.has(fileUri.key) || this.realFS.isMappedUri(fileUri);
    }
    // Get original filepath if the given filepath is mapped.
    getOriginalUri(mappedFileUri) {
        return this.realFS.getOriginalUri(this.getOriginalPath(mappedFileUri));
    }
    // Get mapped filepath if the given filepath is mapped.
    getMappedUri(originalFileUri) {
        var _a;
        const mappedFileUri = this.realFS.getMappedUri(originalFileUri);
        return (_a = this._reverseEntryMap.get(mappedFileUri.key)) !== null && _a !== void 0 ? _a : mappedFileUri;
    }
    isInZip(uri) {
        return this.realFS.isInZip(uri);
    }
    recordMovedEntry(mappedUri, originalUri, rootPath) {
        this._entryMap.set(mappedUri.key, originalUri);
        this._reverseEntryMap.set(originalUri.key, mappedUri);
        const directory = mappedUri.getDirectory();
        const folderInfo = (0, collectionUtils_1.getOrAdd)(this._folderMap, directory.key, () => []);
        const name = mappedUri.fileName;
        if (!folderInfo.some((entry) => entry.name === name)) {
            folderInfo.push({ name, isFile: true });
        }
        // Add the directory entries for the sub paths as well.
        const subPathEntries = rootPath.getRelativePathComponents(directory);
        for (let i = 0; i < subPathEntries.length; i++) {
            const subdir = rootPath.combinePaths(...subPathEntries.slice(0, i + 1));
            const parent = subdir.getDirectory().key;
            const dirInfo = (0, collectionUtils_1.getOrAdd)(this._folderMap, parent, () => []);
            const dirName = subdir.fileName;
            if (!dirInfo.some((entry) => entry.name === dirName)) {
                dirInfo.push({ name: dirName, isFile: false });
            }
        }
    }
    getOriginalPath(mappedFileUri) {
        var _a;
        return (_a = this._entryMap.get(mappedFileUri.key)) !== null && _a !== void 0 ? _a : mappedFileUri;
    }
    isMovedEntry(uri) {
        return this._reverseEntryMap.has(uri.key);
    }
    clear() {
        this._entryMap.clear();
        this._reverseEntryMap.clear();
        this._folderMap.clear();
    }
}
exports.ReadOnlyAugmentedFileSystem = ReadOnlyAugmentedFileSystem;
//# sourceMappingURL=readonlyAugmentedFileSystem.js.map