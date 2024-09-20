"use strict";
/*
 * emptyUri.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * URI class that represents an empty URI.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyUri = void 0;
const constantUri_1 = require("./constantUri");
const EmptyKey = '<empty>';
class EmptyUri extends constantUri_1.ConstantUri {
    constructor() {
        super(EmptyKey);
    }
    static get instance() {
        return EmptyUri._instance;
    }
    toJsonObj() {
        return {
            _key: EmptyKey,
        };
    }
    static isEmptyUri(uri) {
        return (uri === null || uri === void 0 ? void 0 : uri._key) === EmptyKey;
    }
    isEmpty() {
        return true;
    }
    toString() {
        return '';
    }
}
exports.EmptyUri = EmptyUri;
EmptyUri._instance = new EmptyUri();
//# sourceMappingURL=emptyUri.js.map