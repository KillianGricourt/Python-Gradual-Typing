"use strict";
/*
 * constantUri.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * URI class that represents a constant/marker URI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConstantUri = void 0;
const baseUri_1 = require("./baseUri");
class ConstantUri extends baseUri_1.BaseUri {
    constructor(name) {
        super(name);
    }
    get scheme() {
        return '';
    }
    get isCaseSensitive() {
        return true;
    }
    get fileName() {
        return '';
    }
    get lastExtension() {
        return '';
    }
    get root() {
        return this;
    }
    get fragment() {
        return '';
    }
    get query() {
        return '';
    }
    equals(other) {
        // For constant Uri, reference equality must be used instead of value equality.
        return this === other;
    }
    toJsonObj() {
        throw new Error(`constant uri can't be serialized`);
    }
    toString() {
        return this.key;
    }
    toUserVisibleString() {
        return '';
    }
    matchesRegex(regex) {
        return false;
    }
    withFragment(fragment) {
        return this;
    }
    withQuery(query) {
        return this;
    }
    addPath(extra) {
        return this;
    }
    getDirectory() {
        return this;
    }
    isRoot() {
        return false;
    }
    isChild(parent, ignoreCase) {
        return false;
    }
    isLocal() {
        return false;
    }
    startsWith(other, ignoreCase) {
        return false;
    }
    getPathLength() {
        return 0;
    }
    resolvePaths(...paths) {
        return this;
    }
    combinePaths(...paths) {
        return this;
    }
    combinePathsUnsafe(...paths) {
        return this;
    }
    getPath() {
        return '';
    }
    getFilePath() {
        return '';
    }
    stripExtension() {
        return this;
    }
    stripAllExtensions() {
        return this;
    }
    getRootPath() {
        return '';
    }
    getComparablePath() {
        return '';
    }
    getPathComponentsImpl() {
        return [];
    }
}
exports.ConstantUri = ConstantUri;
//# sourceMappingURL=constantUri.js.map