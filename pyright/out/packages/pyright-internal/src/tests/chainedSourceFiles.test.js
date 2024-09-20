"use strict";
/*
 * chainedSourceFiles.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for tokenizer ipython mode
 */
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const service_1 = require("../analyzer/service");
const sourceFile_1 = require("../analyzer/sourceFile");
const configOptions_1 = require("../common/configOptions");
const console_1 = require("../common/console");
const pathUtils_1 = require("../common/pathUtils");
const positionUtils_1 = require("../common/positionUtils");
const serviceProvider_1 = require("../common/serviceProvider");
const uriUtils_1 = require("../common/uri/uriUtils");
const completionProvider_1 = require("../languageService/completionProvider");
const fourSlashParser_1 = require("./harness/fourslash/fourSlashParser");
const testAccessHost_1 = require("./harness/testAccessHost");
const host = __importStar(require("./harness/testHost"));
const factory_1 = require("./harness/vfs/factory");
const vfs = __importStar(require("./harness/vfs/filesystem"));
test('check chained files', () => {
    const code = `
// @filename: test1.py
//// def foo1(): pass

// @filename: test2.py
//// def foo2(): pass

// @filename: test3.py
//// def foo3(): pass

// @filename: test4.py
//// [|foo/*marker*/|]
    `;
    const basePath = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const { data, service } = createServiceWithChainedSourceFiles(basePath, code);
    const marker = data.markerPositions.get('marker');
    const markerUri = marker.fileUri;
    const parseResult = service.getParseResults(markerUri);
    const result = new completionProvider_1.CompletionProvider(service.test_program, markerUri, (0, positionUtils_1.convertOffsetToPosition)(marker.position, parseResult.tokenizerOutput.lines), {
        format: vscode_languageserver_types_1.MarkupKind.Markdown,
        lazyEdit: false,
        snippet: false,
    }, vscode_jsonrpc_1.CancellationToken.None).getCompletions();
    (0, assert_1.default)(result === null || result === void 0 ? void 0 : result.items.some((i) => i.label === 'foo1'));
    (0, assert_1.default)(result === null || result === void 0 ? void 0 : result.items.some((i) => i.label === 'foo2'));
    (0, assert_1.default)(result === null || result === void 0 ? void 0 : result.items.some((i) => i.label === 'foo3'));
});
test('modify chained files', () => {
    const code = `
// @filename: test1.py
//// def foo1(): pass

// @filename: test2.py
//// [|/*delete*/|]
//// def foo2(): pass

// @filename: test3.py
//// def foo3(): pass

// @filename: test4.py
//// [|foo/*marker*/|]
    `;
    const basePath = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const { data, service } = createServiceWithChainedSourceFiles(basePath, code);
    // Make sure files are all realized.
    const marker = data.markerPositions.get('marker');
    const markerUri = marker.fileUri;
    const parseResult = service.getParseResults(markerUri);
    // Close file in the middle of the chain
    service.setFileClosed(data.markerPositions.get('delete').fileUri);
    // Make sure we don't get suggestion from auto import but from chained files.
    service.test_program.configOptions.autoImportCompletions = false;
    const result = new completionProvider_1.CompletionProvider(service.test_program, markerUri, (0, positionUtils_1.convertOffsetToPosition)(marker.position, parseResult.tokenizerOutput.lines), {
        format: vscode_languageserver_types_1.MarkupKind.Markdown,
        lazyEdit: false,
        snippet: false,
    }, vscode_jsonrpc_1.CancellationToken.None).getCompletions();
    (0, assert_1.default)(result);
    (0, assert_1.default)(!result.items.some((i) => i.label === 'foo1'));
    (0, assert_1.default)(!result.items.some((i) => i.label === 'foo2'));
    (0, assert_1.default)(result.items.some((i) => i.label === 'foo3'));
});
test('modify chained files', async () => {
    const code = `
// @filename: test1.py
//// [|/*changed*/|]
//// def foo1(): pass

// @filename: test2.py
//// def foo2(): pass

// @filename: test3.py
//// def foo3(): pass

// @filename: test4.py
//// [|/*marker*/foo1()|]
    `;
    const basePath = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const { data, service } = createServiceWithChainedSourceFiles(basePath, code);
    const marker = data.markerPositions.get('marker');
    const markerUri = marker.fileUri;
    const range = data.ranges.find((r) => r.marker === marker);
    const parseResults = service.getParseResults(markerUri);
    analyze(service.test_program);
    // Initially, there should be no error.
    const initialDiags = await service.getDiagnosticsForRange(markerUri, (0, positionUtils_1.convertOffsetsToRange)(range.pos, range.end, parseResults.tokenizerOutput.lines), vscode_jsonrpc_1.CancellationToken.None);
    assert_1.default.strictEqual(initialDiags.length, 0);
    // Change test1 content
    service.updateOpenFileContents(data.markerPositions.get('changed').fileUri, 2, 'def foo5(): pass');
    analyze(service.test_program);
    const finalDiags = await service.getDiagnosticsForRange(markerUri, (0, positionUtils_1.convertOffsetsToRange)(range.pos, range.end, parseResults.tokenizerOutput.lines), vscode_jsonrpc_1.CancellationToken.None);
    assert_1.default.strictEqual(finalDiags.length, 1);
});
function generateChainedFiles(count, lastFile) {
    let code = '';
    for (let i = 0; i < count; i++) {
        code += `
// @filename: test${i + 1}.py
//// def foo${i + 1}(): pass
`;
    }
    code += lastFile;
    return code;
}
test('chained files with 1000s of files', async () => {
    const lastFile = `
// @filename: testFinal.py
//// [|/*marker*/foo1()|]
    `;
    const code = generateChainedFiles(1000, lastFile);
    const basePath = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const { data, service } = createServiceWithChainedSourceFiles(basePath, code);
    const marker = data.markerPositions.get('marker');
    const markerUri = marker.fileUri;
    const range = data.ranges.find((r) => r.marker === marker);
    const parseResults = service.getParseResults(markerUri);
    analyze(service.test_program);
    // There should be no error as it should find the foo1 in the first chained file.
    const initialDiags = await service.getDiagnosticsForRange(markerUri, (0, positionUtils_1.convertOffsetsToRange)(range.pos, range.end, parseResults.tokenizerOutput.lines), vscode_jsonrpc_1.CancellationToken.None);
    assert_1.default.strictEqual(initialDiags.length, 0);
});
test('imported by files', async () => {
    const code = `
// @filename: test1.py
//// import [|/*marker*/os|]

// @filename: test2.py
//// os.path.join()
    `;
    const basePath = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const { data, service } = createServiceWithChainedSourceFiles(basePath, code);
    analyze(service.test_program);
    const marker = data.markerPositions.get('marker');
    const markerUri = marker.fileUri;
    const range = data.ranges.find((r) => r.marker === marker);
    const parseResults = service.getParseResults(markerUri);
    const diagnostics = await service.getDiagnosticsForRange(markerUri, (0, positionUtils_1.convertOffsetsToRange)(range.pos, range.end, parseResults.tokenizerOutput.lines), vscode_jsonrpc_1.CancellationToken.None);
    assert_1.default.strictEqual(diagnostics.length, 0);
});
test('re ordering cells', async () => {
    const code = `
// @filename: test1.py
//// import [|/*marker*/os|]

// @filename: test2.py
//// /*bottom*/os.path.join()
    `;
    const basePath = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const { data, service } = createServiceWithChainedSourceFiles(basePath, code);
    analyze(service.test_program);
    const marker = data.markerPositions.get('marker');
    const markerUri = marker.fileUri;
    const range = data.ranges.find((r) => r.marker === marker);
    const bottom = data.markerPositions.get('bottom');
    const bottomUri = bottom.fileUri;
    service.updateChainedUri(bottomUri, undefined);
    service.updateChainedUri(markerUri, bottomUri);
    analyze(service.test_program);
    const parseResults = service.getParseResults(markerUri);
    const diagnostics = await service.getDiagnosticsForRange(markerUri, (0, positionUtils_1.convertOffsetsToRange)(range.pos, range.end, parseResults.tokenizerOutput.lines), vscode_jsonrpc_1.CancellationToken.None);
    assert_1.default.strictEqual(diagnostics.length, 1);
});
function createServiceWithChainedSourceFiles(basePath, code) {
    const fs = (0, factory_1.createFromFileSystem)(host.HOST, /*ignoreCase*/ false, { cwd: basePath.getFilePath() });
    const service = new service_1.AnalyzerService('test service', new serviceProvider_1.ServiceProvider(), {
        console: new console_1.NullConsole(),
        hostFactory: () => new testAccessHost_1.TestAccessHost(uriUtils_1.UriEx.file(vfs.MODULE_PATH), [factory_1.libFolder, factory_1.distlibFolder]),
        importResolverFactory: service_1.AnalyzerService.createImportResolver,
        configOptions: new configOptions_1.ConfigOptions(basePath),
        fileSystem: fs,
    });
    const data = (0, fourSlashParser_1.parseTestData)(basePath.getFilePath(), code, '');
    let chainedFilePath;
    for (const file of data.files) {
        const uri = file.fileUri;
        service.setFileOpened(uri, 1, file.content, sourceFile_1.IPythonMode.CellDocs, chainedFilePath);
        chainedFilePath = uri;
    }
    return { data, service };
}
function analyze(program) {
    while (program.analyze()) {
        // Process all queued items
    }
}
//# sourceMappingURL=chainedSourceFiles.test.js.map