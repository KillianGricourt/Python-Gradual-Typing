"use strict";
/*
 * fourSlashParser.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Tests and show how to use fourslash markup languages
 * and how to use parseTestData API itself for other unit tests
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
const pathUtils_1 = require("../common/pathUtils");
const stringUtils_1 = require("../common/stringUtils");
const fourSlashParser_1 = require("./harness/fourslash/fourSlashParser");
const host = __importStar(require("./harness/testHost"));
const factory = __importStar(require("./harness/vfs/factory"));
const uriUtils_1 = require("../common/uri/uriUtils");
test('GlobalOptions', () => {
    const code = `
// global options
// @libpath: ../dist/lib
// @pythonversion: 3.7

////class A:
////    pass
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assertOptions(data.globalOptions, [
        ['libpath', '../dist/lib'],
        ['pythonversion', '3.7'],
    ]);
    assert_1.default.equal(data.files.length, 1);
    assert_1.default.equal(data.files[0].fileName, 'test.py');
    assert_1.default.equal(data.files[0].content, content);
});
test('Filename', () => {
    const code = `
// @filename: file1.py
////class A:
////    pass
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assertOptions(data.globalOptions, []);
    assert_1.default.equal(data.files.length, 1);
    assert_1.default.equal(data.files[0].fileName, (0, pathUtils_1.normalizeSlashes)('./file1.py'));
    assert_1.default.equal(data.files[0].content, content);
});
test('Extra file options', () => {
    // filename must be the first file options
    const code = `
// @filename: file1.py
// @library: false
////class A:
////    pass
    `;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].fileName, (0, pathUtils_1.normalizeSlashes)('./file1.py'));
    assertOptions(data.globalOptions, []);
    assertOptions(data.files[0].fileOptions, [
        ['filename', 'file1.py'],
        ['library', 'false'],
    ]);
});
test('Library options', () => {
    // filename must be the first file options
    const code = `
// @filename: file1.py
// @library: true
////class A:
////    pass
    `;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].fileName, factory.libFolder.combinePaths('file1.py').getFilePath());
});
test('Range', () => {
    const code = `
////class A:
////    [|pass|]
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].content, content);
    assert_1.default.deepEqual(data.ranges, [
        { fileName: 'test.py', fileUri: uriUtils_1.UriEx.file('test.py'), pos: 13, end: 17, marker: undefined },
    ]);
});
test('Marker', () => {
    const code = `
////class A:
////    /*marker1*/pass
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].content, content);
    const marker = { fileName: 'test.py', fileUri: uriUtils_1.UriEx.file('test.py'), position: 13 };
    assert_1.default.deepEqual(data.markers, [marker]);
    assert_1.default.deepEqual(data.markerPositions.get('marker1'), marker);
});
test('MarkerWithData', () => {
    // embedded json data
    const code = `
////class A:
////    {| "data1":"1", "data2":"2" |}pass
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].content, content);
    assert_1.default.deepEqual(data.markers, [
        { fileName: 'test.py', fileUri: uriUtils_1.UriEx.file('test.py'), position: 13, data: { data1: '1', data2: '2' } },
    ]);
    assert_1.default.equal(data.markerPositions.size, 0);
});
test('MarkerWithDataAndName', () => {
    // embedded json data with "name"
    const code = `
////class A:
////    {| "name": "marker1", "data1":"1", "data2":"2" |}pass
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].content, content);
    const marker = {
        fileName: 'test.py',
        fileUri: uriUtils_1.UriEx.file('test.py'),
        position: 13,
        data: { name: 'marker1', data1: '1', data2: '2' },
    };
    assert_1.default.deepEqual(data.markers, [marker]);
    assert_1.default.deepEqual(data.markerPositions.get(marker.data.name), marker);
});
test('RangeWithMarker', () => {
    // range can have 1 marker in it
    const code = `
////class A:
////    [|/*marker1*/pass|]
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].content, content);
    const marker = { fileName: 'test.py', fileUri: uriUtils_1.UriEx.file('test.py'), position: 13 };
    assert_1.default.deepEqual(data.markers, [marker]);
    assert_1.default.deepEqual(data.markerPositions.get('marker1'), marker);
    assert_1.default.deepEqual(data.ranges, [{ fileName: 'test.py', fileUri: uriUtils_1.UriEx.file('test.py'), pos: 13, end: 17, marker }]);
});
test('RangeWithMarkerAndJsonData', () => {
    // range can have 1 marker in it
    const code = `
////class A:
////    [|{| "name": "marker1", "data1":"1", "data2":"2" |}pass|]
    `;
    const content = `class A:
    pass`;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files[0].content, content);
    const marker = {
        fileName: 'test.py',
        fileUri: uriUtils_1.UriEx.file('test.py'),
        position: 13,
        data: { name: 'marker1', data1: '1', data2: '2' },
    };
    assert_1.default.deepEqual(data.markers, [marker]);
    assert_1.default.deepEqual(data.markerPositions.get(marker.data.name), marker);
    assert_1.default.deepEqual(data.ranges, [{ fileName: 'test.py', fileUri: uriUtils_1.UriEx.file('test.py'), pos: 13, end: 17, marker }]);
});
test('Multiple Files', () => {
    // range can have 1 marker in it
    const code = `
// @filename: src/A.py
// @library: false
////class A:
////    pass

// @filename: src/B.py
// @library: true
////class B:
////    pass

// @filename: src/C.py
////class C:
////    pass
    `;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files.length, 3);
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/A.py'))[0].content, getContent('A'));
    assert_1.default.equal(data.files.filter((f) => f.fileName === factory.libFolder.resolvePaths('src/B.py').getFilePath())[0].content, getContent('B'));
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/C.py'))[0].content, getContent('C'));
});
test('Multiple Files with default name', () => {
    // only very first one can omit filename
    const code = `
////class A:
////    pass

// @filename: src/B.py
////class B:
////    pass

// @filename: src/C.py
////class C:
////    pass
    `;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, './src/test.py');
    assert_1.default.equal(data.files.length, 3);
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/test.py'))[0].content, getContent('A'));
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/B.py'))[0].content, getContent('B'));
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/C.py'))[0].content, getContent('C'));
});
test('Multiple Files with markers', () => {
    // range can have 1 marker in it
    const code = `
// @filename: src/A.py
////class A:
////    [|pass|]

// @filename: src/B.py
////class B:
////    [|/*marker1*/pass|]

// @filename: src/C.py
////class C:
////    [|{|"name":"marker2", "data":"2"|}pass|]
    `;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'test.py');
    assert_1.default.equal(data.files.length, 3);
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/A.py'))[0].content, getContent('A'));
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/B.py'))[0].content, getContent('B'));
    assert_1.default.equal(data.files.filter((f) => f.fileName === (0, pathUtils_1.normalizeSlashes)('./src/C.py'))[0].content, getContent('C'));
    assert_1.default.equal(data.ranges.length, 3);
    (0, assert_1.default)(data.markerPositions.get('marker1'));
    (0, assert_1.default)(data.markerPositions.get('marker2'));
    assert_1.default.equal(data.ranges.filter((r) => r.marker).length, 2);
});
test('fourSlashWithFileSystem', () => {
    const code = `
// @filename: src/A.py
////class A:
////    pass

// @filename: src/B.py
////class B:
////    pass

// @filename: src/C.py
////class C:
////    pass
    `;
    const data = (0, fourSlashParser_1.parseTestData)('.', code, 'unused');
    const documents = data.files.map((f) => new factory.TextDocument(f.fileName, f.content, new Map(Object.entries(f.fileOptions))));
    const fs = factory.createFromFileSystem(host.HOST, /* ignoreCase */ false, {
        documents,
        cwd: (0, pathUtils_1.normalizeSlashes)('/'),
    });
    for (const file of data.files) {
        assert_1.default.equal(fs.readFileSync(file.fileUri, 'utf8'), getContent((0, pathUtils_1.getBaseFileName)(file.fileName, '.py', false)));
    }
});
function getContent(className) {
    return `class ${className}:
    pass`;
}
function assertOptions(actual, expected, message) {
    assert_1.default.deepEqual(Object.entries(actual).sort((x, y) => (0, stringUtils_1.compareStringsCaseSensitive)(x[0], y[0])), expected, message);
}
//# sourceMappingURL=fourSlashParser.test.js.map