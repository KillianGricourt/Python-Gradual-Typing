"use strict";
/*
 * filesystem.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Test and show how to use virtual file system
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
const host = __importStar(require("./harness/testHost"));
const factory = __importStar(require("./harness/vfs/factory"));
const vfs = __importStar(require("./harness/vfs/filesystem"));
const uriUtils_1 = require("../common/uri/uriUtils");
test('CreateVFS', () => {
    const cwd = (0, pathUtils_1.normalizeSlashes)('/');
    const fs = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd });
    assert_1.default.equal(fs.cwd(), cwd);
});
test('Folders', () => {
    const cwd = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const fs = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd: cwd.getFilePath() });
    // no such dir exist
    assert_1.default.throws(() => {
        fs.chdir(cwd.combinePaths('a'));
    });
    fs.mkdirSync(cwd.combinePaths('a'));
    fs.chdir(cwd.combinePaths('a'));
    assert_1.default.equal(fs.cwd(), (0, pathUtils_1.normalizeSlashes)('/a'));
    fs.chdir(cwd.resolvePaths('..'));
    fs.rmdirSync(cwd.combinePaths('a'));
    // no such dir exist
    assert_1.default.throws(() => {
        fs.chdir(cwd.combinePaths('a'));
    });
});
test('Folders Recursive', () => {
    const cwd = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const fs = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd: cwd.getFilePath() });
    // no such dir exist
    assert_1.default.throws(() => {
        fs.chdir(cwd.combinePaths('a'));
    });
    const path = cwd.combinePaths('a', 'b', 'c');
    fs.mkdirSync(path, { recursive: true });
    (0, assert_1.default)(fs.existsSync(path));
});
test('Files', () => {
    const cwd = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const fs = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd: cwd.getFilePath() });
    const uri = cwd.combinePaths('1.txt');
    fs.writeFileSync(uri, 'hello', 'utf8');
    const buffer1 = fs.readFileSync(uri);
    assert_1.default.equal(buffer1.toString(), 'hello');
    const p = cwd.resolvePaths('a/b/c');
    fs.mkdirpSync(p.getFilePath());
    const f = p.combinePaths('2.txt');
    fs.writeFileSync(f, 'hi');
    const str = fs.readFileSync(f, 'utf8');
    assert_1.default.equal(str, 'hi');
});
test('CreateRich', () => {
    const cwd = (0, pathUtils_1.normalizeSlashes)('/');
    const files = {
        [(0, pathUtils_1.normalizeSlashes)('/a/b/c/1.txt')]: new vfs.File('hello1'),
        [(0, pathUtils_1.normalizeSlashes)('/a/b/2.txt')]: new vfs.File('hello2'),
        [(0, pathUtils_1.normalizeSlashes)('/a/3.txt')]: new vfs.File('hello3'),
        [(0, pathUtils_1.normalizeSlashes)('/4.txt')]: new vfs.File('hello4', { encoding: 'utf16le' }),
        [(0, pathUtils_1.normalizeSlashes)('/a/b/../c/./5.txt')]: new vfs.File('hello5', { encoding: 'ucs2' }),
    };
    const fs = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd, files });
    const entries = fs.scanSync(cwd, 'descendants-or-self', {});
    // files + directory + root
    assert_1.default.equal(entries.length, 10);
    assert_1.default.equal(fs.readFileSync(uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/a/b/c/1.txt')), 'ascii'), 'hello1');
    assert_1.default.equal(fs.readFileSync(uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/a/b/2.txt')), 'utf8'), 'hello2');
    assert_1.default.equal(fs.readFileSync(uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/a/3.txt')), 'utf-8'), 'hello3');
    assert_1.default.equal(fs.readFileSync(uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/4.txt')), 'utf16le'), 'hello4');
    assert_1.default.equal(fs.readFileSync(uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/a/c/5.txt')), 'ucs2'), 'hello5');
});
test('Shadow', () => {
    const cwd = (0, pathUtils_1.normalizeSlashes)('/');
    const fs = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd });
    // only readonly fs can be shadowed
    assert_1.default.throws(() => fs.shadow());
    // one way to create shadow is making itself snapshot
    fs.snapshot();
    (0, assert_1.default)(!fs.isReadonly);
    (0, assert_1.default)(fs.shadowRoot.isReadonly);
    // another way is creating one off existing readonly snapshot
    const shadow1 = fs.shadowRoot.shadow();
    (0, assert_1.default)(!shadow1.isReadonly);
    (0, assert_1.default)(shadow1.shadowRoot === fs.shadowRoot);
    // make itself readonly and then shawdow
    shadow1.makeReadonly();
    (0, assert_1.default)(shadow1.isReadonly);
    const shadow2 = shadow1.shadow();
    (0, assert_1.default)(!shadow2.isReadonly);
    (0, assert_1.default)(shadow2.shadowRoot === shadow1);
});
test('Diffing', () => {
    const cwd = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/'));
    const fs = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd: cwd.getFilePath() });
    // first snapshot
    fs.snapshot();
    fs.writeFileSync(cwd.combinePaths('test1.txt'), 'hello1');
    // compared with original
    assert_1.default.equal(countFile(fs.diff()), 1);
    // second snapshot
    fs.snapshot();
    fs.writeFileSync(cwd.combinePaths('test2.txt'), 'hello2');
    // compared with first snapshot
    assert_1.default.equal(countFile(fs.diff()), 1);
    // compare with original snapshot
    assert_1.default.equal(countFile(fs.diff(fs.shadowRoot.shadowRoot)), 2);
    // branch out from first snapshot
    const s = fs.shadowRoot.shadow();
    // "test2.txt" only exist in first snapshot
    (0, assert_1.default)(!s.existsSync(cwd.combinePaths('test2.txt')));
    // create parallel universe where it has another version of test2.txt with different content
    // compared to second snapshot which forked from same first snapshot
    s.writeFileSync(cwd.combinePaths('test2.txt'), 'hello3');
    // diff between non direct snapshots
    // diff gives test2.txt even though it exist in both snapshot
    assert_1.default.equal(countFile(s.diff(fs)), 1);
});
test('createFromFileSystem1', () => {
    const filepath = (0, pathUtils_1.normalizeSlashes)((0, pathUtils_1.combinePaths)(factory.srcFolder, 'test.py'));
    const content = '# test';
    // file system will map physical file system to virtual one
    const fs = factory.createFromFileSystem(host.HOST, false, {
        documents: [new factory.TextDocument(filepath, content)],
        cwd: factory.srcFolder,
    });
    // check existing typeshed folder on virtual path inherited from base snapshot from physical file system
    const entries = fs.readdirSync(factory.typeshedFolder);
    (0, assert_1.default)(entries.length > 0);
    // confirm file
    assert_1.default.equal(fs.readFileSync(uriUtils_1.UriEx.file(filepath), 'utf8'), content);
});
test('createFromFileSystem2', () => {
    const fs = factory.createFromFileSystem(host.HOST, /* ignoreCase */ true, { cwd: factory.srcFolder });
    const entries = fs.readdirSync(uriUtils_1.UriEx.file(factory.typeshedFolder.getFilePath().toUpperCase()));
    (0, assert_1.default)(entries.length > 0);
});
test('createFromFileSystemWithCustomTypeshedPath', () => {
    const invalidpath = (0, pathUtils_1.normalizeSlashes)((0, pathUtils_1.combinePaths)(host.HOST.getWorkspaceRoot(), '../docs'));
    const fs = factory.createFromFileSystem(host.HOST, /* ignoreCase */ false, {
        cwd: factory.srcFolder,
        meta: { [factory.typeshedFolder.getFilePath()]: invalidpath },
    });
    const entries = fs.readdirSync(factory.typeshedFolder);
    (0, assert_1.default)(entries.filter((e) => e.endsWith('.md')).length > 0);
});
test('createFromFileSystemWithMetadata', () => {
    const fs = factory.createFromFileSystem(host.HOST, /* ignoreCase */ false, {
        cwd: factory.srcFolder,
        meta: { unused: 'unused' },
    });
    (0, assert_1.default)(fs.existsSync(uriUtils_1.UriEx.file(factory.srcFolder)));
});
function countFile(files) {
    let count = 0;
    for (const value of Object.values(flatten(files))) {
        if (value instanceof vfs.File) {
            count++;
        }
    }
    return count;
}
function flatten(files) {
    const result = {};
    _flatten(files, result);
    return result;
}
function _flatten(files, result) {
    for (const [key, value] of Object.entries(files)) {
        result[key] = value;
        if (value instanceof vfs.Directory) {
            _flatten(value.files, result);
        }
    }
}
//# sourceMappingURL=filesystem.test.js.map