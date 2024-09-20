"use strict";
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
/*
 * sourceFile.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Unit tests for pyright sourceFile module.
 */
const assert = __importStar(require("assert"));
const importResolver_1 = require("../analyzer/importResolver");
const sourceFile_1 = require("../analyzer/sourceFile");
const configOptions_1 = require("../common/configOptions");
const fullAccessHost_1 = require("../common/fullAccessHost");
const pathUtils_1 = require("../common/pathUtils");
const realFileSystem_1 = require("../common/realFileSystem");
const serviceProviderExtensions_1 = require("../common/serviceProviderExtensions");
const testState_1 = require("./harness/fourslash/testState");
const uri_1 = require("../common/uri/uri");
test('Empty', () => {
    const filePath = (0, pathUtils_1.combinePaths)(process.cwd(), 'tests/samples/test_file1.py');
    const tempFile = new realFileSystem_1.RealTempFile();
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile);
    const serviceProvider = (0, serviceProviderExtensions_1.createServiceProvider)(tempFile, fs);
    const sourceFile = new sourceFile_1.SourceFile(serviceProvider, uri_1.Uri.file(filePath, serviceProvider), '', false, false, {
        isEditMode: false,
    });
    const configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.file(process.cwd(), serviceProvider));
    const sp = (0, serviceProviderExtensions_1.createServiceProvider)(fs);
    const importResolver = new importResolver_1.ImportResolver(sp, configOptions, new fullAccessHost_1.FullAccessHost(sp));
    sourceFile.parse(configOptions, importResolver);
});
test('Empty Open file', () => {
    var _a, _b;
    const code = `
// @filename: test.py
//// [|/*marker*/# Content|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const marker = state.getMarkerByName('marker');
    assert.strictEqual((_a = state.workspace.service.test_program.getSourceFile(marker.fileUri)) === null || _a === void 0 ? void 0 : _a.getFileContent(), '# Content');
    state.workspace.service.updateOpenFileContents(marker.fileUri, 1, '');
    assert.strictEqual((_b = state.workspace.service.test_program.getSourceFile(marker.fileUri)) === null || _b === void 0 ? void 0 : _b.getFileContent(), '');
});
//# sourceMappingURL=sourceFile.test.js.map