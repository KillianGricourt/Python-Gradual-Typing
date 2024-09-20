"use strict";
/*
 * parentDirectoryCache.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Cache to hold parent directory import result to make sure
 * we don't repeatedly search folders.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParentDirectoryCache = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
class ParentDirectoryCache {
    constructor(_importRootGetter) {
        this._importRootGetter = _importRootGetter;
        this._importChecked = new Map();
        this._cachedResults = new Map();
        this._libPathCache = undefined;
        // empty
    }
    getImportResult(path, importName, importResult) {
        var _a, _b, _c, _d;
        const result = (_a = this._cachedResults.get(importName)) === null || _a === void 0 ? void 0 : _a.get(path.key);
        if (result) {
            // We already checked for the importName at the path.
            return result;
        }
        const checked = (_b = this._importChecked.get(importName)) === null || _b === void 0 ? void 0 : _b.get(path.key);
        if (checked) {
            // We already checked for the importName at the path.
            if (!checked.importPath) {
                return importResult;
            }
            return (_d = (_c = this._cachedResults.get(importName)) === null || _c === void 0 ? void 0 : _c.get(checked.importPath.key)) !== null && _d !== void 0 ? _d : importResult;
        }
        return undefined;
    }
    checkValidPath(fs, sourceFileUri, root) {
        var _a;
        if (!sourceFileUri.startsWith(root)) {
            // We don't search containing folders for libs.
            return false;
        }
        this._libPathCache =
            (_a = this._libPathCache) !== null && _a !== void 0 ? _a : this._importRootGetter()
                .map((r) => fs.realCasePath(r))
                .filter((r) => r !== root)
                .filter((r) => r.startsWith(root));
        if (this._libPathCache.some((p) => sourceFileUri.startsWith(p))) {
            // Make sure it is not lib folders under user code root.
            // ex) .venv folder
            return false;
        }
        return true;
    }
    checked(path, importName, importPath) {
        (0, collectionUtils_1.getOrAdd)(this._importChecked, importName, () => new Map()).set(path.key, importPath);
    }
    add(result) {
        (0, collectionUtils_1.getOrAdd)(this._cachedResults, result.importName, () => new Map()).set(result.path.key, result.importResult);
    }
    reset() {
        this._importChecked.clear();
        this._cachedResults.clear();
        this._libPathCache = undefined;
    }
}
exports.ParentDirectoryCache = ParentDirectoryCache;
//# sourceMappingURL=parentDirectoryCache.js.map