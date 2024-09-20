"use strict";
/*
 * webUri.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * URI class that represents a URI that isn't 'file' schemed.
 * This can be URIs like:
 * - http://www.microsoft.com/file.txt
 * - untitled:Untitled-1
 * - vscode:extension/ms-python.python
 * - vscode-vfs://github.com/microsoft/debugpy/debugpy/launcher/debugAdapter.py
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebUri = void 0;
const pathUtils_1 = require("../pathUtils");
const baseUri_1 = require("./baseUri");
const memoization_1 = require("./memoization");
const vscode_uri_1 = require("vscode-uri");
class WebUri extends baseUri_1.BaseUri {
    constructor(key, _scheme, _authority, _path, _query, _fragment, _originalString) {
        super(key);
        this._scheme = _scheme;
        this._authority = _authority;
        this._path = _path;
        this._query = _query;
        this._fragment = _fragment;
        this._originalString = _originalString;
    }
    get scheme() {
        return this._scheme;
    }
    get isCaseSensitive() {
        // Web URIs are always case sensitive
        return true;
    }
    get fragment() {
        return this._fragment;
    }
    get query() {
        return this._query;
    }
    get root() {
        const rootPath = this.getRootPath();
        if (rootPath !== this._path) {
            return WebUri.createWebUri(this._scheme, this._authority, rootPath, '', '', undefined);
        }
        return this;
    }
    get fileName() {
        // Path should already be normalized, just get the last on a split of '/'.
        const components = this._path.split('/');
        return components[components.length - 1];
    }
    get lastExtension() {
        const basename = this.fileName;
        const index = basename.lastIndexOf('.');
        if (index >= 0) {
            return basename.slice(index);
        }
        return '';
    }
    static createWebUri(scheme, authority, path, query, fragment, originalString) {
        const key = WebUri._createKey(scheme, authority, path, query, fragment);
        return new WebUri(key, scheme, authority, path, query, fragment, originalString);
    }
    toString() {
        if (!this._originalString) {
            const vscodeUri = vscode_uri_1.URI.revive({
                scheme: this._scheme,
                authority: this._authority,
                path: this._path,
                query: this._query,
                fragment: this._fragment,
            });
            this._originalString = vscodeUri.toString();
        }
        return this._originalString;
    }
    toUserVisibleString() {
        return this.toString();
    }
    static isWebUri(uri) {
        return (uri === null || uri === void 0 ? void 0 : uri._scheme) !== undefined && (uri === null || uri === void 0 ? void 0 : uri._key) !== undefined;
    }
    static fromJsonObj(obj) {
        return WebUri.createWebUri(obj._scheme, obj._authority, obj._path, obj._query, obj._fragment, obj._originalString);
    }
    toJsonObj() {
        return {
            _scheme: this._scheme,
            _authority: this._authority,
            _path: this._path,
            _query: this._query,
            _fragment: this._fragment,
            _originalString: this._originalString,
            _key: this.key,
        };
    }
    matchesRegex(regex) {
        return regex.test(this._path);
    }
    addPath(extra) {
        const newPath = this._path + extra;
        return WebUri.createWebUri(this._scheme, this._authority, newPath, this._query, this._fragment, undefined);
    }
    isRoot() {
        return this._path === this.getRootPath() && this._path.length > 0;
    }
    isChild(parent) {
        if (!WebUri.isWebUri(parent)) {
            return false;
        }
        return parent._path.length < this._path.length && this.startsWith(parent);
    }
    isLocal() {
        return false;
    }
    startsWith(other) {
        if ((other === null || other === void 0 ? void 0 : other.scheme) !== this.scheme) {
            return false;
        }
        const otherWebUri = other;
        if (this._path.length >= otherWebUri._path.length) {
            // Make sure the other ends with a / when comparing longer paths, otherwise we might
            // say that /a/food is a child of /a/foo.
            const otherPath = this._path.length > otherWebUri._path.length && !(0, pathUtils_1.hasTrailingDirectorySeparator)(otherWebUri._path)
                ? `${otherWebUri._path}/`
                : otherWebUri._path;
            return this._path.startsWith(otherPath);
        }
        return false;
    }
    getPathLength() {
        return this._path.length;
    }
    getPath() {
        return this._path;
    }
    getFilePath() {
        return ''; // Web URIs don't have file paths so this is always empty.
    }
    resolvePaths(...paths) {
        // Resolve and combine paths, never want URIs with '..' in the middle.
        let combined = this.normalizeSlashes((0, pathUtils_1.resolvePaths)(this._path, ...paths));
        // Make sure to remove any trailing directory chars.
        if ((0, pathUtils_1.hasTrailingDirectorySeparator)(combined) && combined.length > 1) {
            combined = combined.slice(0, combined.length - 1);
        }
        if (combined !== this._path) {
            return WebUri.createWebUri(this._scheme, this._authority, combined, '', '', undefined);
        }
        return this;
    }
    combinePaths(...paths) {
        if (paths.some((p) => p.includes('..') || p.includes('/') || p === '.')) {
            // This is a slow path that handles paths that contain '..' or '.'.
            return this.resolvePaths(...paths);
        }
        // Paths don't have any thing special that needs to be combined differently, so just
        // use the quick method.
        return this.combinePathsUnsafe(...paths);
    }
    combinePathsUnsafe(...paths) {
        // Combine paths using the quick path implementation.
        const combined = baseUri_1.BaseUri.combinePathElements(this._path, '/', ...paths);
        if (combined !== this._path) {
            return WebUri.createWebUri(this._scheme, this._authority, combined, '', '', undefined);
        }
        return this;
    }
    getDirectory() {
        if (this._path.length === 0) {
            return this;
        }
        const index = this._path.lastIndexOf('/');
        const newPath = index > 0 ? this._path.slice(0, index) : index === 0 ? '/' : '';
        return WebUri.createWebUri(this._scheme, this._authority, newPath, this._query, this._fragment, undefined);
    }
    withFragment(fragment) {
        return WebUri.createWebUri(this._scheme, this._authority, this._path, this._query, fragment, undefined);
    }
    withQuery(query) {
        return WebUri.createWebUri(this._scheme, this._authority, this._path, query, this._fragment, undefined);
    }
    stripExtension() {
        const path = this._path;
        const index = path.lastIndexOf('.');
        if (index > 0) {
            return WebUri.createWebUri(this._scheme, this._authority, path.slice(0, index), this._query, this._fragment, undefined);
        }
        return this;
    }
    stripAllExtensions() {
        const path = this._path;
        const sepIndex = path.lastIndexOf('/');
        const index = path.indexOf('.', sepIndex > 0 ? sepIndex : 0);
        if (index > 0) {
            return WebUri.createWebUri(this._scheme, this._authority, path.slice(0, index), this._query, this._fragment, undefined);
        }
        return this;
    }
    getPathComponentsImpl() {
        // Get the root path and the rest of the path components.
        const rootPath = this.getRootPath();
        const otherPaths = this._path.slice(rootPath.length).split('/');
        return this.reducePathComponents([rootPath, ...otherPaths]).map((component) => this.normalizeSlashes(component));
    }
    getRootPath() {
        const rootLength = (0, pathUtils_1.getRootLength)(this._path, '/');
        return this._path.slice(0, rootLength);
    }
    getComparablePath() {
        return this._path; // Should already have the correct '/'
    }
    static _createKey(scheme, authority, path, query, fragment) {
        return `${scheme}:${authority}${path}${query ? '?' + query : ''}${fragment ? '#' + fragment : ''}`;
    }
}
exports.WebUri = WebUri;
__decorate([
    (0, memoization_1.cacheProperty)()
], WebUri.prototype, "root", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], WebUri.prototype, "fileName", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], WebUri.prototype, "lastExtension", null);
__decorate([
    (0, memoization_1.cacheMethodWithNoArgs)()
], WebUri.prototype, "getDirectory", null);
__decorate([
    (0, memoization_1.cacheStaticFunc)()
], WebUri, "createWebUri", null);
//# sourceMappingURL=webUri.js.map