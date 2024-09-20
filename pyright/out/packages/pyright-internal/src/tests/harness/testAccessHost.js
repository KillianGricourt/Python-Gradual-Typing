"use strict";
/*
 * testAccessHost.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * NoAccessHost variation for test environment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestAccessHost = void 0;
const host_1 = require("../../common/host");
const uri_1 = require("../../common/uri/uri");
class TestAccessHost extends host_1.NoAccessHost {
    constructor(_modulePath = uri_1.Uri.empty(), _searchPaths = []) {
        super();
        this._modulePath = _modulePath;
        this._searchPaths = _searchPaths;
    }
    getPythonSearchPaths(pythonPath, logInfo) {
        return {
            paths: this._searchPaths,
            prefix: this._modulePath,
        };
    }
}
exports.TestAccessHost = TestAccessHost;
//# sourceMappingURL=testAccessHost.js.map