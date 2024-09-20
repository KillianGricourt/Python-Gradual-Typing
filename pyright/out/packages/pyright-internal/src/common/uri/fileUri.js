"use strict";
/*
 * fileUri.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * URI class that represents a file path. These URIs are always 'file' schemed.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileUri = exports.FileUriSchema = void 0;
const vscode_uri_1 = require("vscode-uri");
const core_1 = require("../core");
const pathUtils_1 = require("../pathUtils");
const baseUri_1 = require("./baseUri");
const memoization_1 = require("./memoization");
exports.FileUriSchema = 'file';
class FileUri extends baseUri_1.BaseUri {
    constructor(key, _filePath, _query, _fragment, _originalString, _isCaseSensitive) {
        super(_isCaseSensitive ? key : key.toLowerCase());
        this._filePath = _filePath;
        this._query = _query;
        this._fragment = _fragment;
        this._originalString = _originalString;
        this._isCaseSensitive = _isCaseSensitive;
    }
    get scheme() {
        return exports.FileUriSchema;
    }
    get fragment() {
        return this._fragment;
    }
    get query() {
        return this._query;
    }
    get fileName() {
        return (0, pathUtils_1.getFileName)(this._filePath);
    }
    get lastExtension() {
        return (0, pathUtils_1.getFileExtension)(this._filePath);
    }
    get root() {
        const rootPath = this.getRootPath();
        if (rootPath !== this._filePath) {
            return FileUri.createFileUri(rootPath, '', '', undefined, this._isCaseSensitive);
        }
        return this;
    }
    get isCaseSensitive() {
        return this._isCaseSensitive;
    }
    static createFileUri(filePath, query, fragment, originalString, isCaseSensitive) {
        filePath = (0, pathUtils_1.isDiskPathRoot)(filePath) ? (0, pathUtils_1.ensureTrailingDirectorySeparator)(filePath) : filePath;
        const key = FileUri._createKey(filePath, query, fragment);
        return new FileUri(key, filePath, query, fragment, originalString, isCaseSensitive);
    }
    static isFileUri(uri) {
        return (uri === null || uri === void 0 ? void 0 : uri._filePath) !== undefined && (uri === null || uri === void 0 ? void 0 : uri._key) !== undefined;
    }
    static fromJsonObj(obj) {
        if ((0, core_1.isArray)(obj)) {
            const so = obj;
            return FileUri.createFileUri(so[1], so[2], so[3], so[4], so[5] === 1 ? true : false);
        }
        return FileUri.createFileUri(obj._filePath, obj._query, obj._fragment, obj._originalString, obj._isCaseSensitive);
    }
    toJsonObj() {
        const jsonObj = [
            0 /* UriKinds.file */,
            this._filePath,
            this._query,
            this._fragment,
            this._originalString,
            this._isCaseSensitive ? 1 : 0,
        ];
        return jsonObj;
    }
    matchesRegex(regex) {
        // Compare the regex to our path but normalize it for comparison.
        // The regex assumes it's comparing itself to a URI path.
        return regex.test(this._getNormalizedPath());
    }
    toString() {
        if (!this._formattedString) {
            this._formattedString =
                this._originalString ||
                    vscode_uri_1.URI.file(this._filePath).with({ query: this._query, fragment: this._fragment }).toString();
        }
        return this._formattedString;
    }
    toUserVisibleString() {
        return this._filePath;
    }
    addPath(extra) {
        return FileUri.createFileUri(this._filePath + extra, '', '', undefined, this._isCaseSensitive);
    }
    isRoot() {
        return (0, pathUtils_1.isDiskPathRoot)(this._filePath);
    }
    isChild(parent) {
        if (!FileUri.isFileUri(parent)) {
            return false;
        }
        return parent._filePath.length < this._filePath.length && this.startsWith(parent);
    }
    isLocal() {
        return true;
    }
    startsWith(other) {
        if ((other === null || other === void 0 ? void 0 : other.scheme) !== this.scheme) {
            return false;
        }
        const otherFileUri = other;
        if (this._filePath.length >= otherFileUri._filePath.length) {
            // Make sure the other ends with a / when comparing longer paths, otherwise we might
            // say that /a/food is a child of /a/foo.
            const otherPath = this._filePath.length > otherFileUri._filePath.length &&
                !(0, pathUtils_1.hasTrailingDirectorySeparator)(otherFileUri._filePath)
                ? (0, pathUtils_1.ensureTrailingDirectorySeparator)(otherFileUri._filePath)
                : otherFileUri._filePath;
            if (!this.isCaseSensitive) {
                return this._filePath.toLowerCase().startsWith(otherPath.toLowerCase());
            }
            return this._filePath.startsWith(otherPath);
        }
        return false;
    }
    getPathLength() {
        return this._filePath.length;
    }
    getPath() {
        return this._getNormalizedPath();
    }
    getFilePath() {
        return this._filePath;
    }
    resolvePaths(...paths) {
        // Resolve and combine paths, never want URIs with '..' in the middle.
        let combined = (0, pathUtils_1.resolvePaths)(this._filePath, ...paths);
        // Make sure to remove any trailing directory chars.
        if ((0, pathUtils_1.hasTrailingDirectorySeparator)(combined) && combined.length > 1) {
            combined = combined.slice(0, combined.length - 1);
        }
        if (combined !== this._filePath) {
            return FileUri.createFileUri(combined, '', '', undefined, this._isCaseSensitive);
        }
        return this;
    }
    combinePaths(...paths) {
        if (paths.some((p) => p.includes('..') || p.includes(FileUri._separator) || p.includes('/') || p === '.')) {
            // This is a slow path that handles paths that contain '..' or '.'.
            return this.resolvePaths(...paths);
        }
        // Paths don't have any thing special that needs to be combined differently, so just
        // use the quick method.
        return this.combinePathsUnsafe(...paths);
    }
    combinePathsUnsafe(...paths) {
        // Combine paths using the quicker path implementation as we
        // assume all data is already normalized.
        const combined = baseUri_1.BaseUri.combinePathElements(this._filePath, FileUri._separator, ...paths);
        if (combined !== this._filePath) {
            return FileUri.createFileUri(combined, '', '', undefined, this._isCaseSensitive);
        }
        return this;
    }
    getDirectory() {
        const filePath = this._filePath;
        let dir = (0, pathUtils_1.getDirectoryPath)(filePath);
        if ((0, pathUtils_1.hasTrailingDirectorySeparator)(dir) && dir.length > 1) {
            dir = dir.slice(0, -1);
        }
        if (dir !== filePath) {
            return FileUri.createFileUri(dir, '', '', undefined, this._isCaseSensitive);
        }
        else {
            return this;
        }
    }
    withFragment(fragment) {
        return FileUri.createFileUri(this._filePath, this._query, fragment, undefined, this._isCaseSensitive);
    }
    withQuery(query) {
        return FileUri.createFileUri(this._filePath, query, this._fragment, undefined, this._isCaseSensitive);
    }
    stripExtension() {
        const stripped = (0, pathUtils_1.stripFileExtension)(this._filePath);
        if (stripped !== this._filePath) {
            return FileUri.createFileUri(stripped, this._query, this._fragment, undefined, this._isCaseSensitive);
        }
        return this;
    }
    stripAllExtensions() {
        const stripped = (0, pathUtils_1.stripFileExtension)(this._filePath, /* multiDotExtension */ true);
        if (stripped !== this._filePath) {
            return FileUri.createFileUri(stripped, this._query, this._fragment, undefined, this._isCaseSensitive);
        }
        return this;
    }
    getPathComponentsImpl() {
        const components = (0, pathUtils_1.getPathComponents)(this._filePath);
        // Remove the first one if it's empty. The new algorithm doesn't
        // expect this to be there.
        if (components.length > 0 && components[0] === '') {
            components.shift();
        }
        return components.map((component) => this.normalizeSlashes(component));
    }
    getRootPath() {
        return this._filePath.slice(0, (0, pathUtils_1.getRootLength)(this._filePath));
    }
    getComparablePath() {
        return this._getNormalizedPath();
    }
    static _createKey(filePath, query, fragment) {
        return `${filePath}${query ? '?' + query : ''}${fragment ? '#' + fragment : ''}`;
    }
    _getNormalizedPath() {
        if (this._normalizedPath === undefined) {
            this._normalizedPath = this.normalizeSlashes(this._filePath);
        }
        return this._normalizedPath;
    }
}
exports.FileUri = FileUri;
FileUri._separator = (0, pathUtils_1.getPathSeparator)('');
__decorate([
    (0, memoization_1.cacheProperty)()
], FileUri.prototype, "fileName", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], FileUri.prototype, "lastExtension", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], FileUri.prototype, "root", null);
__decorate([
    (0, memoization_1.cacheMethodWithNoArgs)()
], FileUri.prototype, "getDirectory", null);
__decorate([
    (0, memoization_1.cacheStaticFunc)()
], FileUri, "createFileUri", null);
//# sourceMappingURL=fileUri.js.map