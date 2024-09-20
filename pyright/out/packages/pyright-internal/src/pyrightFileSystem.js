"use strict";
/*
 * pyrightFileSystem.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * A file system that knows how to deal with partial stub files.
 * Files within a partial stub package act as though they are
 * copied into the associated package, and the combined set of
 * files is treated as one.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PyrightFileSystem = exports.SupportPartialStubs = void 0;
const pyTypedUtils_1 = require("./analyzer/pyTypedUtils");
const pathConsts_1 = require("./common/pathConsts");
const uriUtils_1 = require("./common/uri/uriUtils");
const readonlyAugmentedFileSystem_1 = require("./readonlyAugmentedFileSystem");
var SupportPartialStubs;
(function (SupportPartialStubs) {
    function is(value) {
        return (value.isPartialStubPackagesScanned &&
            value.isPathScanned &&
            value.processPartialStubPackages &&
            value.clearPartialStubs);
    }
    SupportPartialStubs.is = is;
})(SupportPartialStubs || (exports.SupportPartialStubs = SupportPartialStubs = {}));
class PyrightFileSystem extends readonlyAugmentedFileSystem_1.ReadOnlyAugmentedFileSystem {
    constructor(realFS) {
        super(realFS);
        // Root paths processed
        this._rootSearched = new Set();
        // Partial stub package paths processed
        this._partialStubPackagePaths = new Set();
    }
    mkdirSync(uri, options) {
        this.realFS.mkdirSync(uri, options);
    }
    chdir(uri) {
        this.realFS.chdir(uri);
    }
    writeFileSync(uri, data, encoding) {
        this.realFS.writeFileSync(this.getOriginalPath(uri), data, encoding);
    }
    rmdirSync(uri) {
        this.realFS.rmdirSync(this.getOriginalPath(uri));
    }
    unlinkSync(uri) {
        this.realFS.unlinkSync(this.getOriginalPath(uri));
    }
    createWriteStream(uri) {
        return this.realFS.createWriteStream(this.getOriginalPath(uri));
    }
    copyFileSync(src, dst) {
        this.realFS.copyFileSync(this.getOriginalPath(src), this.getOriginalPath(dst));
    }
    isPartialStubPackagesScanned(execEnv) {
        return execEnv.root ? this.isPathScanned(execEnv.root) : false;
    }
    isPathScanned(uri) {
        return this._rootSearched.has(uri.key);
    }
    processPartialStubPackages(paths, roots, bundledStubPath, allowMoving) {
        var _a;
        const allowMovingFn = allowMoving !== null && allowMoving !== void 0 ? allowMoving : this._allowMoving.bind(this);
        for (const path of paths) {
            this._rootSearched.add(path.key);
            if (!this.realFS.existsSync(path) || !(0, uriUtils_1.isDirectory)(this.realFS, path)) {
                continue;
            }
            let dirEntries = [];
            try {
                dirEntries = this.realFS.readdirEntriesSync(path);
            }
            catch {
                // Leave empty set of dir entries to process.
            }
            const isBundledStub = path.equals(bundledStubPath);
            for (const entry of dirEntries) {
                const partialStubPackagePath = path.combinePaths(entry.name);
                const isDirectory = !entry.isSymbolicLink()
                    ? entry.isDirectory()
                    : !!((_a = (0, uriUtils_1.tryStat)(this.realFS, partialStubPackagePath)) === null || _a === void 0 ? void 0 : _a.isDirectory());
                if (!isDirectory || !entry.name.endsWith(pathConsts_1.stubsSuffix)) {
                    continue;
                }
                const pyTypedInfo = (0, pyTypedUtils_1.getPyTypedInfo)(this.realFS, partialStubPackagePath);
                if (!pyTypedInfo || !pyTypedInfo.isPartiallyTyped) {
                    // Stub-Package is fully typed.
                    continue;
                }
                // We found partially typed stub-packages.
                this._partialStubPackagePaths.add(partialStubPackagePath.key);
                // Search the root to see whether we have matching package installed.
                let partialStubs;
                const packageName = entry.name.substr(0, entry.name.length - pathConsts_1.stubsSuffix.length);
                for (const root of roots) {
                    const packagePath = root.combinePaths(packageName);
                    try {
                        const stat = (0, uriUtils_1.tryStat)(this.realFS, packagePath);
                        if (!(stat === null || stat === void 0 ? void 0 : stat.isDirectory())) {
                            continue;
                        }
                        // If partial stub we found is from bundled stub and library installed is marked as py.typed
                        // ignore bundled partial stub.
                        if (!allowMovingFn(isBundledStub, (0, pyTypedUtils_1.getPyTypedInfo)(this.realFS, packagePath), pyTypedInfo)) {
                            continue;
                        }
                        // Merge partial stub packages to the library.
                        partialStubs = partialStubs !== null && partialStubs !== void 0 ? partialStubs : this._getRelativePathPartialStubs(partialStubPackagePath);
                        for (const partialStub of partialStubs) {
                            const originalPyiFile = partialStubPackagePath.resolvePaths(partialStub);
                            const mappedPyiFile = packagePath.resolvePaths(partialStub);
                            this.recordMovedEntry(mappedPyiFile, originalPyiFile, packagePath);
                        }
                    }
                    catch {
                        // ignore
                    }
                }
            }
        }
    }
    clearPartialStubs() {
        super.clear();
        this._rootSearched.clear();
        this._partialStubPackagePaths.clear();
    }
    isMovedEntry(uri) {
        return this._partialStubPackagePaths.has(uri.key) || super.isMovedEntry(uri);
    }
    _allowMoving(isBundled, packagePyTyped, _stubPyTyped) {
        if (!isBundled) {
            return true;
        }
        // If partial stub we found is from bundled stub and library installed is marked as py.typed
        // allow moving only if the package is marked as partially typed.
        return !packagePyTyped || packagePyTyped.isPartiallyTyped;
    }
    _getRelativePathPartialStubs(partialStubPath) {
        const relativePaths = [];
        const searchAllStubs = (uri) => {
            for (const entry of this.realFS.readdirEntriesSync(uri)) {
                const filePath = uri.combinePaths(entry.name);
                let isDirectory = entry.isDirectory();
                let isFile = entry.isFile();
                if (entry.isSymbolicLink()) {
                    const stat = (0, uriUtils_1.tryStat)(this.realFS, filePath);
                    if (stat) {
                        isDirectory = stat.isDirectory();
                        isFile = stat.isFile();
                    }
                }
                if (isDirectory) {
                    searchAllStubs(filePath);
                }
                if (isFile && entry.name.endsWith('.pyi')) {
                    const relative = partialStubPath.getRelativePathComponents(filePath).join('/');
                    if (relative) {
                        relativePaths.push(relative);
                    }
                }
            }
        };
        searchAllStubs(partialStubPath);
        return relativePaths;
    }
}
exports.PyrightFileSystem = PyrightFileSystem;
//# sourceMappingURL=pyrightFileSystem.js.map