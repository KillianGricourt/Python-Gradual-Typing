"use strict";
/*
 * baseUri.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Base URI class for storing and manipulating URIs.
 */
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseUri = void 0;
const collectionUtils_1 = require("../collectionUtils");
const pathUtils_1 = require("../pathUtils");
const memoization_1 = require("./memoization");
class BaseUri {
    constructor(_key) {
        this._key = _key;
    }
    // Unique key for storing in maps.
    get key() {
        return this._key;
    }
    // Returns just the fileName without any extensions
    get fileNameWithoutExtensions() {
        const fileName = this.fileName;
        const index = fileName.lastIndexOf('.');
        if (index > 0) {
            return fileName.slice(0, index);
        }
        else {
            return fileName;
        }
    }
    // Returns a URI where the path contains the path with .py appended.
    get packageUri() {
        // This is assuming that the current path is a file already.
        return this.addExtension('.py');
    }
    // Returns a URI where the path contains the path with .pyi appended.
    get packageStubUri() {
        // This is assuming that the current path is a file already.
        return this.addExtension('.pyi');
    }
    // Returns a URI where the path has __init__.py appended.
    get initPyUri() {
        // This is assuming that the current path is a directory already.
        return this.combinePathsUnsafe('__init__.py');
    }
    // Returns a URI where the path has __init__.pyi appended.
    get initPyiUri() {
        // This is assuming that the current path is a directory already.
        return this.combinePathsUnsafe('__init__.pyi');
    }
    // Returns a URI where the path has py.typed appended.
    get pytypedUri() {
        // This is assuming that the current path is a directory already.
        return this.combinePathsUnsafe('py.typed');
    }
    isEmpty() {
        return false;
    }
    replaceExtension(ext) {
        const dir = this.getDirectory();
        const base = this.fileName;
        const newBase = base.slice(0, base.length - this.lastExtension.length) + ext;
        return dir.combinePathsUnsafe(newBase);
    }
    addExtension(ext) {
        return this.addPath(ext);
    }
    hasExtension(ext) {
        return this.isCaseSensitive
            ? this.lastExtension === ext
            : this.lastExtension.toLowerCase() === ext.toLowerCase();
    }
    containsExtension(ext) {
        const fileName = this.fileName;
        // Use a regex so we keep the . on the front of the extension.
        const extensions = fileName.split(/(?=\.)/g);
        return extensions.some((e) => (this.isCaseSensitive ? e === ext : e.toLowerCase() === ext.toLowerCase()));
    }
    getRootPathLength() {
        return this.getRootPath().length;
    }
    isUntitled() {
        return this.scheme === 'untitled';
    }
    equals(other) {
        return this.key === (other === null || other === void 0 ? void 0 : other.key);
    }
    pathStartsWith(name) {
        // We're making an assumption here that the name is already normalized.
        return this.getComparablePath().startsWith(name);
    }
    pathEndsWith(name) {
        // We're making an assumption here that the name is already normalized.
        return this.getComparablePath().endsWith(name);
    }
    pathIncludes(include) {
        // We're making an assumption here that the name is already normalized.
        return this.getComparablePath().includes(include);
    }
    getRelativePath(child) {
        if (this.scheme !== child.scheme) {
            return undefined;
        }
        // Unlike getRelativePathComponents, this function should not return relative path
        // markers for non children.
        if (child.isChild(this)) {
            const relativeToComponents = this.getRelativePathComponents(child);
            if (relativeToComponents.length > 0) {
                return ['.', ...relativeToComponents].join('/');
            }
        }
        return undefined;
    }
    getPathComponents() {
        // Make sure to freeze the result so that it can't be modified.
        return Object.freeze(this.getPathComponentsImpl());
    }
    getRelativePathComponents(to) {
        const fromComponents = this.getPathComponents();
        const toComponents = to.getPathComponents();
        let start;
        for (start = 0; start < fromComponents.length && start < toComponents.length; start++) {
            const fromComponent = fromComponents[start];
            const toComponent = toComponents[start];
            const match = this.isCaseSensitive
                ? fromComponent === toComponent
                : fromComponent.toLowerCase() === toComponent.toLowerCase();
            if (!match) {
                break;
            }
        }
        if (start === 0) {
            return toComponents;
        }
        const components = toComponents.slice(start);
        const relative = [];
        for (; start < fromComponents.length; start++) {
            relative.push('..');
        }
        return [...relative, ...components];
    }
    getShortenedFileName(maxDirLength = 15) {
        return (0, pathUtils_1.getShortenedFileName)(this.getPath(), maxDirLength);
    }
    normalizeSlashes(path) {
        if (path.includes('\\')) {
            return path.replace(/\\/g, '/');
        }
        return path;
    }
    static combinePathElements(pathString, separator, ...paths) {
        // Borrowed this algorithm from the pathUtils combinePaths function. This is
        // a quicker implementation that's possible because we assume all paths are normalized already.
        for (const relativePath of paths) {
            if (!relativePath) {
                continue;
            }
            if (!pathString || (0, pathUtils_1.getRootLength)(relativePath) !== 0) {
                pathString = relativePath;
            }
            else if (pathString.endsWith(separator)) {
                pathString += relativePath;
            }
            else {
                pathString += separator + relativePath;
            }
        }
        return pathString;
    }
    reducePathComponents(components) {
        if (!(0, collectionUtils_1.some)(components)) {
            return [];
        }
        // Reduce the path components by eliminating
        // any '.' or '..'. We start at 1 because the first component is
        // always the root.
        const reduced = [components[0]];
        for (let i = 1; i < components.length; i++) {
            const component = components[i];
            if (!component || component === '.') {
                continue;
            }
            if (component === '..') {
                if (reduced.length > 1) {
                    if (reduced[reduced.length - 1] !== '..') {
                        reduced.pop();
                        continue;
                    }
                }
                else if (reduced[0]) {
                    continue;
                }
            }
            reduced.push(component);
        }
        return reduced;
    }
}
exports.BaseUri = BaseUri;
__decorate([
    (0, memoization_1.cacheProperty)()
], BaseUri.prototype, "packageUri", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], BaseUri.prototype, "packageStubUri", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], BaseUri.prototype, "initPyUri", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], BaseUri.prototype, "initPyiUri", null);
__decorate([
    (0, memoization_1.cacheProperty)()
], BaseUri.prototype, "pytypedUri", null);
//# sourceMappingURL=baseUri.js.map