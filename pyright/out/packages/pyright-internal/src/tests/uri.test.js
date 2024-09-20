"use strict";
/*
 * uri.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for Uris.
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
const nodefs = __importStar(require("fs-extra"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const envVarUtils_1 = require("../common/envVarUtils");
const pathUtils_1 = require("../common/pathUtils");
const realFileSystem_1 = require("../common/realFileSystem");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const vfs = __importStar(require("./harness/vfs/filesystem"));
const testHost_1 = require("./harness/testHost");
const caseDetector = new testHost_1.TestCaseSensitivityDetector(true);
test('parse', () => {
    assert_1.default.throws(() => uri_1.Uri.parse('\\c:\\foo : bar', caseDetector));
    assert_1.default.throws(() => uri_1.Uri.parse('foo:////server/b/c', caseDetector)); // No authority component
    assert_1.default.ok(uri_1.Uri.parse('foo:///a/b/c', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse('foo:a/b/c', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse('foo:/a/b/c', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse('foo://server/share/dir/file.py', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse('foo://server/share/dir/file.py?query#fragment', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse('foo:///c:/users/me', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse('foo:///c%3A%52users%52me', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse('', caseDetector));
    assert_1.default.ok(uri_1.Uri.parse(undefined, caseDetector));
});
test('file', () => {
    const cwd = process.cwd();
    const uri1 = uri_1.Uri.file('a/b/c', caseDetector, true);
    assert_1.default.ok(uri1.getFilePath().length > 6);
    assert_1.default.ok(uri1.getFilePath().toLowerCase().startsWith(cwd.toLowerCase()), `${uri1.getFilePath()} does not start with ${cwd}`);
    const uri2 = uri_1.Uri.file('a/b/c', caseDetector, false);
    assert_1.default.equal(uri2.getFilePath().length, 6);
});
test('file path', () => {
    // parse works with unix style file format
    assert_1.default.equal(uri_1.Uri.parse('/folder1/folder2', caseDetector).scheme, 'file');
    // parse doesn't work with window style file format
    (0, assert_1.default)(uri_1.Uri.parse('c:\\folder1\\folder2', caseDetector).scheme !== `file`);
    // file works with both styles
    assert_1.default.equal(uri_1.Uri.file('/folder1/folder2', caseDetector).scheme, 'file');
    assert_1.default.equal(uri_1.Uri.file('c:\\folder1\\folder2', caseDetector).scheme, 'file');
});
test('key', () => {
    const key = uri_1.Uri.parse('foo:///a/b/c', caseDetector).key;
    const key2 = uri_1.Uri.parse('foo:///a/b/c', caseDetector).key;
    assert_1.default.equal(key, key2);
    const key3 = uri_1.Uri.parse('foo:///a/b/d', caseDetector).key;
    assert_1.default.notEqual(key, key3);
    const key4 = uriUtils_1.UriEx.file('/a/b/c').key;
    assert_1.default.notEqual(key, key4);
    const key5 = uri_1.Uri.parse('file:///a/b/c', caseDetector).key;
    assert_1.default.equal(key4, key5);
    const key6 = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('c:\\foo\\bar\\d.txt')).key;
    const key7 = uri_1.Uri.parse('file:///c%3A/foo/bar/d.txt', caseDetector).key;
    const key8 = uri_1.Uri.parse('file:///c:/foo/bar/d.txt', caseDetector).key;
    assert_1.default.equal(key6, key7);
    assert_1.default.equal(key6, key8);
    const key9 = uriUtils_1.UriEx.parse('file:///c%3A/foo/bar/D.txt', true).key;
    const key10 = uriUtils_1.UriEx.parse('file:///c:/foo/bar/d.txt', true).key;
    assert_1.default.notEqual(key9, key10);
    const key11 = uriUtils_1.UriEx.parse('file:///c%3A/foo/bar/D.txt', false).key;
    const key12 = uriUtils_1.UriEx.parse('file:///c%3A/foo/bar/d.txt', false).key;
    assert_1.default.equal(key11, key12);
});
test('filename', () => {
    const filename = uri_1.Uri.parse('foo:///a/b/c', caseDetector).fileName;
    assert_1.default.equal(filename, 'c');
    const filename2 = uri_1.Uri.parse('foo:///a/b/c/', caseDetector).fileName;
    assert_1.default.equal(filename2, 'c');
    const filename3 = uri_1.Uri.parse('foo:///a/b/c.py', caseDetector).fileName;
    assert_1.default.equal(filename3, 'c.py');
    const filename4 = uri_1.Uri.parse('foo:///a/b/c.py?query#fragment', caseDetector).fileName;
    assert_1.default.equal(filename4, 'c.py');
    const filename5 = uriUtils_1.UriEx.file('/a/b/c').fileName;
    assert_1.default.equal(filename5, 'c');
    const filename6 = uri_1.Uri.parse('file:///a/b/c', caseDetector).fileName;
    assert_1.default.equal(filename6, 'c');
});
test('extname', () => {
    const extname = uri_1.Uri.parse('foo:///a/b/c', caseDetector).lastExtension;
    assert_1.default.equal(extname, '');
    const extname2 = uri_1.Uri.parse('foo:///a/b/c/', caseDetector).lastExtension;
    assert_1.default.equal(extname2, '');
    const extname3 = uri_1.Uri.parse('foo:///a/b/c.py', caseDetector).lastExtension;
    assert_1.default.equal(extname3, '.py');
    const extname4 = uri_1.Uri.parse('foo:///a/b/c.py?query#fragment', caseDetector).lastExtension;
    assert_1.default.equal(extname4, '.py');
    const extname5 = uriUtils_1.UriEx.file('/a/b/c.py.foo').lastExtension;
    assert_1.default.equal(extname5, '.foo');
    const extname6 = uri_1.Uri.parse('file:///a/b/c.py.foo', caseDetector).lastExtension;
    assert_1.default.equal(extname6, '.foo');
});
test('fragment', () => {
    const fragment = uri_1.Uri.parse('foo:///a/b/c#bar', caseDetector).fragment;
    assert_1.default.equal(fragment, 'bar');
    const fragment2 = uri_1.Uri.parse('foo:///a/b/c#bar#baz', caseDetector).fragment;
    assert_1.default.equal(fragment2, 'bar#baz');
    const fragment3 = uri_1.Uri.parse('foo:///a/b/c?query#bar#baz', caseDetector).fragment;
    assert_1.default.equal(fragment3, 'bar#baz');
    const fragment4 = uri_1.Uri.parse('foo:///a/b/c?query', caseDetector).fragment;
    assert_1.default.equal(fragment4, '');
    const fragment5 = uri_1.Uri.parse('foo:///a/b/c', caseDetector).withFragment('bar').fragment;
    assert_1.default.equal(fragment5, 'bar');
    const fragment6 = uri_1.Uri.parse('foo:///a/b/c#bar', caseDetector).withFragment('').fragment;
    assert_1.default.equal(fragment6, '');
});
test('query', () => {
    const query = uri_1.Uri.parse('foo:///a/b/c?bar', caseDetector).query;
    assert_1.default.equal(query, 'bar');
    const query2 = uri_1.Uri.parse('foo:///a/b/c?bar?baz', caseDetector).query;
    assert_1.default.equal(query2, 'bar?baz');
    const query3 = uri_1.Uri.parse('foo:///a/b/c?bar?baz#fragment', caseDetector).query;
    assert_1.default.equal(query3, 'bar?baz');
    const query4 = uri_1.Uri.parse('foo:///a/b/c#fragment', caseDetector).query;
    assert_1.default.equal(query4, '');
    const query5 = uri_1.Uri.parse('foo:///a/b/c', caseDetector).withQuery('bar').query;
    assert_1.default.equal(query5, 'bar');
    const query6 = uri_1.Uri.parse('foo:///a/b/c?bar', caseDetector).withQuery('').query;
    assert_1.default.equal(query6, '');
});
test('containsExtension', () => {
    const uri1 = uriUtils_1.UriEx.parse('foo:///a/b/c.py', true);
    assert_1.default.ok(uri1.containsExtension('.py'));
    assert_1.default.ok(!uri1.containsExtension('.PY'));
    assert_1.default.ok(!uri1.containsExtension('.pyi'));
    const uri2 = uriUtils_1.UriEx.parse('foo:///a/b/c.pyi', true);
    assert_1.default.ok(uri2.containsExtension('.pyi'));
    assert_1.default.ok(!uri2.containsExtension('.PYI'));
    assert_1.default.ok(!uri2.containsExtension('.py'));
    const uri3 = uriUtils_1.UriEx.parse('foo:///a/b/c.pyi.ipynb', false);
    assert_1.default.ok(uri3.containsExtension('.pyi'));
    assert_1.default.ok(uri3.containsExtension('.ipynb'));
    assert_1.default.ok(!uri3.containsExtension('.PYI'));
});
test('root', () => {
    const root1 = uriUtils_1.UriEx.parse('foo://authority/a/b/c').root;
    assert_1.default.equal(root1.toString(), 'foo://authority/');
    const root = uriUtils_1.UriEx.parse('file://server/b/c').root;
    assert_1.default.equal(root.toString(), 'file://server/');
    assert_1.default.equal(root.getRootPathLength(), 9);
    const root2 = uriUtils_1.UriEx.parse('foo:/').root;
    assert_1.default.equal(root2.toString(), 'foo:/');
    const root3 = uriUtils_1.UriEx.parse('foo://a/b/c/').root;
    assert_1.default.equal(root3.toString(), 'foo://a/');
    assert_1.default.ok(root3.isRoot());
    const root4 = uriUtils_1.UriEx.parse('foo://a/b/c.py').root;
    assert_1.default.equal(root4.toString(), 'foo://a/');
    const root5 = uriUtils_1.UriEx.parse('foo://a/b/c.py?query#fragment').root;
    assert_1.default.equal(root5.toString(), 'foo://a/');
    const root6 = uriUtils_1.UriEx.file('/a/b/c.py.foo').root;
    assert_1.default.equal(root6.toString(), 'file:///');
    const root7 = uriUtils_1.UriEx.parse('file:///a/b/c.py.foo').root;
    assert_1.default.equal(root7.toString(), 'file:///');
    assert_1.default.equal(root7.getRootPathLength(), 1);
    const root8 = uriUtils_1.UriEx.parse('untitled:Untitled-1').root;
    assert_1.default.equal(root8.toString(), 'untitled:');
    assert_1.default.equal(root8.getRootPathLength(), 0);
    assert_1.default.equal(root8.isRoot(), false);
    const root9 = uriUtils_1.UriEx.parse('file://a/b/c/d.py').root;
    assert_1.default.equal(root9.toString(), 'file://a/');
    assert_1.default.equal(root9.getRootPathLength(), 4);
    assert_1.default.ok(root9.isRoot());
    const root10 = uriUtils_1.UriEx.parse('file://c%3A/b/c/d.py').root;
    assert_1.default.equal(root10.toString(), 'file://c:/');
    assert_1.default.equal(root10.getRootPathLength(), 5);
    assert_1.default.ok(root10.isRoot());
});
test('untitled', () => {
    const untitled = uriUtils_1.UriEx.parse('untitled:Untitled-1', true);
    assert_1.default.equal(untitled.scheme, 'untitled');
    assert_1.default.equal(untitled.fileName, 'Untitled-1');
    assert_1.default.equal(untitled.toString(), 'untitled:Untitled-1');
    const untitled2 = uriUtils_1.UriEx.parse('untitled:Untitled-1', true);
    assert_1.default.ok(untitled.equals(untitled2));
    const untitled3 = uriUtils_1.UriEx.parse('untitled:Untitled-2', true);
    assert_1.default.ok(!untitled.equals(untitled3));
    const untitled4 = uriUtils_1.UriEx.parse('untitled:Untitled-1.foo.bar', false);
    assert_1.default.equal(untitled4.scheme, 'untitled');
    assert_1.default.equal(untitled4.fileName, 'Untitled-1.foo.bar');
    (0, assert_1.default)(untitled4.containsExtension('.foo'));
    (0, assert_1.default)(untitled4.containsExtension('.bar'));
});
test('empty', () => {
    const empty = uri_1.Uri.parse('', caseDetector);
    assert_1.default.equal(empty.isEmpty(), true);
    const empty2 = uri_1.Uri.parse('foo:///', caseDetector).isEmpty();
    assert_1.default.equal(empty2, false);
    const empty3 = uri_1.Uri.empty();
    assert_1.default.equal(empty3.isEmpty(), true);
    const empty4 = uri_1.Uri.parse(undefined, caseDetector);
    assert_1.default.equal(empty4.isEmpty(), true);
    assert_1.default.ok(empty4.equals(empty3));
    assert_1.default.ok(empty3.equals(empty));
    const combined = empty.combinePaths((0, pathUtils_1.normalizeSlashes)('/d/e/f'));
    assert_1.default.equal(combined.getFilePath(), '');
});
test('file', () => {
    const file1 = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/a/b/c')).getFilePath();
    assert_1.default.equal(file1, (0, pathUtils_1.normalizeSlashes)('/a/b/c'));
    const file2 = uriUtils_1.UriEx.file('file:///a/b/c').getFilePath();
    assert_1.default.equal(file2, (0, pathUtils_1.normalizeSlashes)('/a/b/c'));
    const resolved = uriUtils_1.UriEx.file((0, pathUtils_1.normalizeSlashes)('/a/b/c')).combinePaths((0, pathUtils_1.normalizeSlashes)('/d/e/f'));
    assert_1.default.equal(resolved.getFilePath(), (0, pathUtils_1.normalizeSlashes)('/d/e/f'));
});
test('isUri', () => {
    const isUri = uri_1.Uri.is('foo:///a/b/c');
    assert_1.default.equal(isUri, false);
    const isUri2 = uri_1.Uri.is('/a/b/c');
    assert_1.default.equal(isUri2, false);
    const isUri3 = uri_1.Uri.is(undefined);
    assert_1.default.equal(isUri3, false);
    const isUri4 = uri_1.Uri.is(uri_1.Uri.parse('foo:///a/b/c', caseDetector));
    assert_1.default.equal(isUri4, true);
    const isUri5 = uri_1.Uri.is(uri_1.Uri.empty());
    assert_1.default.equal(isUri5, true);
});
test('matchesRegex', () => {
    const includeFiles = /\.pyi?$/;
    const uri = uri_1.Uri.parse('file:///a/b/c.pyi', caseDetector);
    assert_1.default.ok(uri.matchesRegex(includeFiles));
    const uri2 = uri_1.Uri.parse('file:///a/b/c.px', caseDetector);
    assert_1.default.equal(uri2.matchesRegex(includeFiles), false);
    const uri3 = uri_1.Uri.parse('vscode-vfs:///a/b/c.pyi', caseDetector);
    assert_1.default.ok(uri3.matchesRegex(includeFiles));
    const fileRegex = /^(c:\/foo\/bar)($|\/)/i;
    const uri4 = uri_1.Uri.parse('file:///C%3A/foo/bar', caseDetector);
    assert_1.default.ok(uri4.matchesRegex(fileRegex));
    const uri5 = uri_1.Uri.parse('file:///c%3A/foo/bar', caseDetector);
    assert_1.default.ok(uri5.matchesRegex(fileRegex));
    const uri6 = uri_1.Uri.parse('file:///c:/foo/bar', caseDetector);
    assert_1.default.ok(uri6.matchesRegex(fileRegex));
    const uri7 = uri_1.Uri.parse('file:///c:/foo/bar/', caseDetector);
    assert_1.default.ok(uri7.matchesRegex(fileRegex));
    const uri8 = uri_1.Uri.parse('file:///c:/foo/baz/', caseDetector);
    assert_1.default.equal(uri8.matchesRegex(fileRegex), false);
});
test('replaceExtension', () => {
    const uri = uri_1.Uri.parse('file:///a/b/c.pyi', caseDetector);
    const uri2 = uri.replaceExtension('.py');
    assert_1.default.equal(uri2.toString(), 'file:///a/b/c.py');
    const uri3 = uri_1.Uri.parse('file:///a/b/c', caseDetector);
    const uri4 = uri3.replaceExtension('.py');
    assert_1.default.equal(uri4.toString(), 'file:///a/b/c.py');
    const uri5 = uri_1.Uri.parse('file:///a/b/c.foo.py', caseDetector);
    const uri6 = uri5.replaceExtension('.pyi');
    assert_1.default.equal(uri6.toString(), 'file:///a/b/c.foo.pyi');
    const uri7 = uri_1.Uri.parse('memfs:/notebook.ipynb.py?query#fragment', caseDetector);
    const uri8 = uri7.replaceExtension('');
    assert_1.default.equal(uri8.toString(), 'memfs:/notebook.ipynb');
    const uri9 = uri_1.Uri.parse('untitled:Untitled-1.ipynb.py?query#fragment', caseDetector);
    const uri10 = uri9.replaceExtension('');
    assert_1.default.equal(uri10.toString(), 'untitled:Untitled-1.ipynb');
});
test('addExtension', () => {
    const uri = uri_1.Uri.parse('file:///a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri.addExtension('.py');
    assert_1.default.equal(uri2.toString(), 'file:///a/b/c.pyi.py');
    const uri3 = uri_1.Uri.parse('file:///a/b/c', caseDetector);
    const uri4 = uri3.addExtension('.py');
    assert_1.default.equal(uri4.toString(), 'file:///a/b/c.py');
});
test('addPath', () => {
    const uri = uri_1.Uri.parse('file:///a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri.addPath('d');
    assert_1.default.equal(uri2.toString(), 'file:///a/b/c.pyid');
});
test('getDirectory', () => {
    const uri = uri_1.Uri.parse('file:///a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri.getDirectory();
    assert_1.default.equal(uri2.toString(), 'file:///a/b');
    const uri3 = uri2.getDirectory();
    assert_1.default.equal(uri3.toString(), 'file:///a');
    const uri4 = uri_1.Uri.parse('file:///a/b/', caseDetector);
    const uri5 = uri4.getDirectory();
    assert_1.default.equal(uri5.toString(), 'file:///a');
    const uri6 = uri4.getDirectory();
    assert_1.default.ok(uri6.equals(uri5));
    const uri7 = uri5.getDirectory();
    assert_1.default.equal(uri7.toString(), 'file:///');
    const uri8 = uri_1.Uri.parse('memfs:/a', caseDetector);
    const uri9 = uri8.getDirectory();
    assert_1.default.equal(uri9.toString(), 'memfs:/');
    const uri10 = uri_1.Uri.parse('untitled:a', caseDetector);
    const uri11 = uri10.getDirectory();
    assert_1.default.equal(uri11.toString(), 'untitled:');
});
test('init and pytyped', () => {
    const uri = uri_1.Uri.parse('file:///a/b/c?query#fragment', caseDetector);
    const uri2 = uri.pytypedUri;
    assert_1.default.equal(uri2.toString(), 'file:///a/b/c/py.typed');
    const uri3 = uri.initPyUri;
    assert_1.default.equal(uri3.toString(), 'file:///a/b/c/__init__.py');
    const uri4 = uri.initPyiUri;
    assert_1.default.equal(uri4.toString(), 'file:///a/b/c/__init__.pyi');
    const uri5 = uri.packageUri;
    assert_1.default.equal(uri5.toString(), 'file:///a/b/c.py');
    const uri6 = uri.packageStubUri;
    assert_1.default.equal(uri6.toString(), 'file:///a/b/c.pyi');
    const uri7 = uri_1.Uri.parse('foo://microsoft.com/a/b/c.py', caseDetector);
    const uri8 = uri7.pytypedUri;
    assert_1.default.equal(uri8.toString(), 'foo://microsoft.com/a/b/c.py/py.typed');
    const uri9 = uri7.initPyUri;
    assert_1.default.equal(uri9.toString(), 'foo://microsoft.com/a/b/c.py/__init__.py');
    const uri10 = uri7.initPyiUri;
    assert_1.default.equal(uri10.toString(), 'foo://microsoft.com/a/b/c.py/__init__.pyi');
    const uri11 = uri7.packageUri;
    assert_1.default.equal(uri11.toString(), 'foo://microsoft.com/a/b/c.py.py');
    const uri12 = uri7.packageStubUri;
    assert_1.default.equal(uri12.toString(), 'foo://microsoft.com/a/b/c.py.pyi');
});
test('isChild', () => {
    const parent = uriUtils_1.UriEx.parse('file:///a/b/?query#fragment', true);
    const child = uriUtils_1.UriEx.parse('file:///a/b/c.pyi?query#fragment', true);
    assert_1.default.ok(child.isChild(parent));
    const parent2 = uriUtils_1.UriEx.parse('file:///a/b', true);
    const child2 = uriUtils_1.UriEx.parse('file:///a/b/c.pyi', true);
    const child2DifferentCase = uriUtils_1.UriEx.parse('file:///a/B/C.pyi', false);
    assert_1.default.ok(child2.isChild(parent2));
    assert_1.default.ok(child2DifferentCase.isChild(parent2));
    const parent3 = uriUtils_1.UriEx.parse('file:///a/b/', true);
    const child3 = uriUtils_1.UriEx.parse('file:///a/b/c.pyi', true);
    assert_1.default.ok(child3.isChild(parent3));
    const parent4 = uriUtils_1.UriEx.parse('file:///a/b/', true);
    const notChild4 = uriUtils_1.UriEx.parse('file:///a/bb/c.pyi', true);
    assert_1.default.ok(!notChild4.isChild(parent4));
    assert_1.default.ok(!notChild4.isChild(parent2));
    const notChild5 = uriUtils_1.UriEx.parse('file:///a/b/', true);
    assert_1.default.ok(!notChild5.isChild(parent4));
});
test('equals', () => {
    const uri1 = uriUtils_1.UriEx.parse('file:///a/b/c.pyi?query#fragment', true);
    const uri2 = uriUtils_1.UriEx.file('/a/b/c.pyi');
    assert_1.default.ok(!uri1.equals(uri2));
    const uri3 = uri1.stripExtension().addExtension('.pyi');
    assert_1.default.ok(uri2.equals(uri3));
    const uri4 = uriUtils_1.UriEx.parse('foo:///a/b/c', true);
    const uri5 = uriUtils_1.UriEx.parse('foo:///a/b/c', true);
    const uri6 = uriUtils_1.UriEx.parse('foo:///a/b/c/', true);
    assert_1.default.ok(uri4.equals(uri5));
    assert_1.default.ok(uri4.equals(uri6));
    const uri7 = uriUtils_1.UriEx.parse('file://c%3A/b/c/d.py', true).root;
    const uri8 = uriUtils_1.UriEx.parse('file://c:/', true);
    assert_1.default.ok(uri7.equals(uri8));
    const uri9 = uriUtils_1.UriEx.parse('foo:///a/b/c?query', true);
    assert_1.default.ok(!uri9.equals(uri4));
    // Web uris are always case sensitive
    const uri10 = uriUtils_1.UriEx.parse('foo:///a/b/c', false);
    const uri11 = uriUtils_1.UriEx.parse('foo:///a/B/c', false);
    assert_1.default.ok(!uri10.equals(uri11));
    // Filre uris pay attention to the parameter.
    const uri12 = uriUtils_1.UriEx.parse('file:///a/b/c', false);
    const uri13 = uriUtils_1.UriEx.parse('file:///a/B/c', false);
    assert_1.default.ok(uri12.equals(uri13));
    const uri14 = uriUtils_1.UriEx.parse('file:///a/b/c', true);
    const uri15 = uriUtils_1.UriEx.parse('file:///a/B/c', true);
    assert_1.default.ok(!uri14.equals(uri15));
});
test('startsWith', () => {
    const parent = uri_1.Uri.parse('file:///a/b/?query#fragment', caseDetector);
    const child = uri_1.Uri.parse('file:///a/b/c.pyi?query#fragment', caseDetector);
    assert_1.default.ok(child.startsWith(parent));
    const parent2 = uri_1.Uri.parse('file:///a/b', caseDetector);
    const child2 = uri_1.Uri.parse('file:///a/b/c.pyi', caseDetector);
    assert_1.default.ok(child2.startsWith(parent2));
    const parent3 = uri_1.Uri.parse('file:///a/b/', caseDetector);
    const child3 = uri_1.Uri.parse('file:///a/b/c.pyi', caseDetector);
    assert_1.default.ok(child3.startsWith(parent3));
    const parent4 = uri_1.Uri.parse('file:///a/b/', caseDetector);
    const notChild4 = uri_1.Uri.parse('file:///a/bb/c.pyi', caseDetector);
    assert_1.default.ok(!notChild4.startsWith(parent4));
    assert_1.default.ok(!notChild4.startsWith(parent2));
});
test('path comparisons', () => {
    const uri = uri_1.Uri.parse('foo:///a/b/c.pyi?query#fragment', caseDetector);
    assert_1.default.ok(uri.pathEndsWith('c.pyi'));
    assert_1.default.ok(uri.pathEndsWith('b/c.pyi'));
    assert_1.default.ok(uri.pathEndsWith('a/b/c.pyi'));
    assert_1.default.ok(!uri.pathEndsWith('a/b/c.py'));
    assert_1.default.ok(!uri.pathEndsWith('b/c.py'));
    assert_1.default.ok(uri.pathIncludes('c.pyi'));
    assert_1.default.ok(uri.pathIncludes('b/c'));
    assert_1.default.ok(uri.pathIncludes('a/b/c'));
    const uri2 = uri_1.Uri.parse('file:///C%3A/a/b/c.pyi?query#fragment', caseDetector);
    assert_1.default.ok(uri2.pathEndsWith('c.pyi'));
    assert_1.default.ok(uri2.pathEndsWith('b/c.pyi'));
    assert_1.default.ok(!uri2.pathStartsWith('C:/a'));
    assert_1.default.ok(!uri2.pathStartsWith('C:/a/b'));
    assert_1.default.ok(uri2.pathStartsWith('c:/a'));
    assert_1.default.ok(uri2.pathStartsWith('c:/a/b'));
});
test('combinePaths', () => {
    const uri1 = uri_1.Uri.parse('file:///a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri1.combinePaths('d', 'e');
    assert_1.default.equal(uri2.toString(), 'file:///a/b/c.pyi/d/e');
    const uri4 = uri1.combinePaths('d', 'e', 'f');
    assert_1.default.equal(uri4.toString(), 'file:///a/b/c.pyi/d/e/f');
    const uri5 = uri1.combinePaths('d', '..', 'e');
    assert_1.default.equal(uri5.toString(), 'file:///a/b/c.pyi/e');
    const rootedPath = process.platform === 'win32' ? 'D:' : '/D';
    const rootedResult = process.platform === 'win32' ? 'file:///d%3A/e/f' : 'file:///D/e/f';
    const uri6 = uri1.combinePaths(rootedPath, 'e', 'f');
    assert_1.default.equal(uri6.toString(), rootedResult);
    const uri7 = uri_1.Uri.parse('foo:', caseDetector);
    const uri8 = uri7.combinePaths('d', 'e');
    assert_1.default.equal(uri8.toString(), 'foo:d/e');
    const uri9 = uri_1.Uri.parse('foo:/', caseDetector);
    const uri10 = uri9.combinePaths('d', 'e');
    assert_1.default.equal(uri10.toString(), 'foo:/d/e');
    const uri11 = uri_1.Uri.empty().combinePaths('d', 'e');
    assert_1.default.equal(uri11.toString(), '');
    const uri12 = uri1.combinePaths('d', 'e', 'f/');
    assert_1.default.equal(uri12.toString(), 'file:///a/b/c.pyi/d/e/f');
});
test('combinePathsUnsafe', () => {
    const uri1 = uri_1.Uri.parse('file:///a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri1.combinePathsUnsafe('d', 'e');
    assert_1.default.equal(uri2.toString(), 'file:///a/b/c.pyi/d/e');
    const uri4 = uri1.combinePathsUnsafe('d', 'e', 'f');
    assert_1.default.equal(uri4.toString(), 'file:///a/b/c.pyi/d/e/f');
    const uri5 = uri1.combinePathsUnsafe('d', '..', 'e');
    assert_1.default.equal(uri5.toString(), 'file:///a/b/c.pyi/d/../e');
    const rootedPath = process.platform === 'win32' ? 'D:' : '/D';
    const rootedResult = process.platform === 'win32' ? 'file:///d%3A/e/f' : 'file:///D/e/f';
    const uri6 = uri1.combinePathsUnsafe(rootedPath, 'e', 'f');
    assert_1.default.equal(uri6.toString(), rootedResult);
    const uri7 = uri_1.Uri.parse('foo:', caseDetector);
    const uri8 = uri7.combinePathsUnsafe('d', 'e');
    assert_1.default.equal(uri8.toString(), 'foo:d/e');
    const uri9 = uri_1.Uri.parse('foo:/', caseDetector);
    const uri10 = uri9.combinePathsUnsafe('d', 'e');
    assert_1.default.equal(uri10.toString(), 'foo:/d/e');
    const uri11 = uri_1.Uri.empty().combinePathsUnsafe('d', 'e');
    assert_1.default.equal(uri11.toString(), '');
    const uri12 = uri1.combinePathsUnsafe('d', 'e', 'f/');
    assert_1.default.equal(uri12.toString(), 'file:///a/b/c.pyi/d/e/f/');
});
test('resolvePaths', () => {
    const uri1 = uri_1.Uri.parse('file:///a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri1.resolvePaths('d', 'e');
    assert_1.default.equal(uri2.toString(), 'file:///a/b/c.pyi/d/e');
    const uri3 = uri1.resolvePaths('d', 'e/');
    assert_1.default.equal(uri3.toString(), 'file:///a/b/c.pyi/d/e');
    const uri4 = uri1.resolvePaths('d', 'e', 'f/');
    assert_1.default.equal(uri4.toString(), 'file:///a/b/c.pyi/d/e/f');
    const uri5 = uri1.resolvePaths('d', '..', 'e');
    assert_1.default.equal(uri5.toString(), 'file:///a/b/c.pyi/e');
    const rootedPath = process.platform === 'win32' ? 'D:' : '/D';
    const rootedResult = process.platform === 'win32' ? 'file:///d%3A/e/f' : 'file:///D/e/f';
    const uri6 = uri1.resolvePaths(rootedPath, 'e', 'f');
    assert_1.default.equal(uri6.toString(), rootedResult);
    const uri7 = uri_1.Uri.parse('foo:', caseDetector);
    const uri8 = uri7.resolvePaths('d', 'e');
    assert_1.default.equal(uri8.toString(), 'foo:d/e');
    const uri9 = uri_1.Uri.parse('foo:/', caseDetector);
    const uri10 = uri9.resolvePaths('d', 'e');
    assert_1.default.equal(uri10.toString(), 'foo:/d/e');
    const uri11 = uri_1.Uri.empty().resolvePaths('d', 'e');
    assert_1.default.equal(uri11.toString(), '');
});
test('combinePaths non file', () => {
    const uri1 = uri_1.Uri.parse('baz://authority/a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri1.combinePaths('d', 'e');
    assert_1.default.equal(uri2.toString(), 'baz://authority/a/b/c.pyi/d/e');
    const uri4 = uri1.combinePaths('d', 'e', 'f');
    assert_1.default.equal(uri4.toString(), 'baz://authority/a/b/c.pyi/d/e/f');
});
test('resolvePaths non file', () => {
    const uri1 = uri_1.Uri.parse('baz://authority/a/b/c.pyi?query#fragment', caseDetector);
    const uri2 = uri1.resolvePaths('d', 'e');
    assert_1.default.equal(uri2.toString(), 'baz://authority/a/b/c.pyi/d/e');
    const uri3 = uri1.resolvePaths('d', 'e/');
    assert_1.default.equal(uri3.toString(), 'baz://authority/a/b/c.pyi/d/e');
    const uri4 = uri1.resolvePaths('d', 'e', 'f');
    assert_1.default.equal(uri4.toString(), 'baz://authority/a/b/c.pyi/d/e/f');
    const uri5 = uri1.resolvePaths('d', '..', 'e');
    assert_1.default.equal(uri5.toString(), 'baz://authority/a/b/c.pyi/e');
});
test('getPathComponents1', () => {
    const components = uri_1.Uri.parse('', caseDetector).getPathComponents();
    assert_1.default.equal(components.length, 0);
});
test('getPathComponents2', () => {
    const components = uri_1.Uri.parse('/users/', caseDetector).getPathComponents();
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], '/');
    assert_1.default.equal(components[1], 'users');
});
test('getPathComponents3', () => {
    const components = uri_1.Uri.parse('/users/hello.py', caseDetector).getPathComponents();
    assert_1.default.equal(components.length, 3);
    assert_1.default.equal(components[0], '/');
    assert_1.default.equal(components[1], 'users');
    assert_1.default.equal(components[2], 'hello.py');
});
test('getPathComponents4', () => {
    const components = uri_1.Uri.parse('/users/hello/../', caseDetector).getPathComponents();
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], '/');
    assert_1.default.equal(components[1], 'users');
});
test('getPathComponents5', () => {
    const components = uri_1.Uri.parse('./hello.py', caseDetector).getPathComponents();
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], '/');
    assert_1.default.equal(components[1], 'hello.py');
});
test('getPathComponents6', () => {
    const components = uri_1.Uri.parse('file://server/share/dir/file.py', caseDetector).getPathComponents();
    assert_1.default.equal(components.length, 4);
    assert_1.default.ok(components[0].slice(2).includes('server'));
    assert_1.default.equal(components[1], 'share');
    assert_1.default.equal(components[2], 'dir');
    assert_1.default.equal(components[3], 'file.py');
});
test('getRelativePathComponents1', () => {
    const components = uri_1.Uri.parse('foo:///users/', caseDetector).getRelativePathComponents(uri_1.Uri.parse('foo:///users/', caseDetector));
    assert_1.default.equal(components.length, 0);
});
test('getRelativePathComponents2', () => {
    const components = uri_1.Uri.parse('foo:///users/', caseDetector).getRelativePathComponents(uri_1.Uri.parse('foo:///users/bar', caseDetector));
    assert_1.default.equal(components.length, 1);
    assert_1.default.equal(components[0], 'bar');
});
test('getRelativePathComponents3', () => {
    const components = uri_1.Uri.parse('bar:///users/', caseDetector).getRelativePathComponents(uri_1.Uri.parse('foo:///users/bar', caseDetector));
    assert_1.default.equal(components.length, 1);
    assert_1.default.equal(components[0], 'bar');
});
test('getRelativePathComponents4', () => {
    const components = uri_1.Uri.parse('foo:///users', caseDetector).getRelativePathComponents(uri_1.Uri.parse('foo:///users/', caseDetector));
    assert_1.default.equal(components.length, 0);
});
test('getRelativePathComponents5', () => {
    const components = uri_1.Uri.parse('foo:///users/', caseDetector).getRelativePathComponents(uri_1.Uri.parse('foo:///users/bar/baz/../foo', caseDetector));
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], 'bar');
    assert_1.default.equal(components[1], 'foo');
});
test('getRelativePathComponents6', () => {
    const components = uri_1.Uri.parse('foo:///users/bar', caseDetector).getRelativePathComponents(uri_1.Uri.parse('foo:///users/foo', caseDetector));
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], '..');
    assert_1.default.equal(components[1], 'foo');
});
test('getRelativePathComponents7', () => {
    const components = uriUtils_1.UriEx.file('\\\\SERVER\\share\\users', false).getRelativePathComponents(uriUtils_1.UriEx.file('\\\\server\\ShArE\\users\\bar', false));
    assert_1.default.equal(components.length, 1);
    assert_1.default.equal(components[0], 'bar');
});
test('getFileExtension1', () => {
    const ext = uri_1.Uri.parse('foo:///blah.blah/hello.JsOn', caseDetector).lastExtension;
    assert_1.default.equal(ext, '.JsOn');
});
test('getFileName1', () => {
    const fileName = uri_1.Uri.parse('foo:///blah.blah/HeLLo.JsOn', caseDetector).fileName;
    assert_1.default.equal(fileName, 'HeLLo.JsOn');
});
test('getFileName2', () => {
    const fileName1 = uri_1.Uri.parse('foo:///blah.blah/hello.cpython-32m.so', caseDetector).fileName;
    assert_1.default.equal(fileName1, 'hello.cpython-32m.so');
});
test('stripFileExtension1', () => {
    const path = uri_1.Uri.parse('foo:///blah.blah/HeLLo.JsOn', caseDetector).stripExtension().getPath();
    assert_1.default.equal(path, '/blah.blah/HeLLo');
});
test('stripFileExtension2', () => {
    const path1 = uri_1.Uri.parse('foo:/blah.blah/hello.cpython-32m.so', caseDetector).stripAllExtensions().getPath();
    assert_1.default.equal(path1, '/blah.blah/hello');
    const path2 = uri_1.Uri.parse('foo:/blah.blah/hello.cpython-32m.so', caseDetector).stripExtension().getPath();
    assert_1.default.equal(path2, '/blah.blah/hello.cpython-32m');
});
test('getWildcardRegexPattern1', () => {
    const pattern = (0, uriUtils_1.getWildcardRegexPattern)(uri_1.Uri.parse('foo:///users/me', caseDetector), './blah/');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test('/users/me/blah/d'));
    assert_1.default.ok(!regex.test('/users/me/blad/d'));
});
test('getWildcardRegexPattern2', () => {
    const pattern = (0, uriUtils_1.getWildcardRegexPattern)(uri_1.Uri.parse('foo:///users/me', caseDetector), './**/*.py?');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test('/users/me/.blah/foo.pyd'));
    assert_1.default.ok(!regex.test('/users/me/.blah/foo.py')); // No char after
});
test('getWildcardRegexPattern3', () => {
    const pattern = (0, uriUtils_1.getWildcardRegexPattern)(uri_1.Uri.parse('foo:///users/me', caseDetector), './**/.*.py');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test('/users/me/.blah/.foo.py'));
    assert_1.default.ok(!regex.test('/users/me/.blah/foo.py'));
});
test('getWildcardRegexPattern4', () => {
    const pattern = (0, uriUtils_1.getWildcardRegexPattern)(uri_1.Uri.parse('//server/share/dir', caseDetector), '.');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test('//server/share/dir/foo.py'));
    assert_1.default.ok(!regex.test('//server/share/dix/foo.py'));
});
test('getWildcardRegexPattern4', () => {
    const pattern = (0, uriUtils_1.getWildcardRegexPattern)(uri_1.Uri.parse('//server/share/dir++/.bar*/bid', caseDetector), '.');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test('//server/share/dir++/.bar*/bidfoo.py'));
    assert_1.default.ok(!regex.test('//server/share/dix++/.bar*/bidfoo.py'));
});
test('getWildcardRoot1', () => {
    const p = (0, uriUtils_1.getWildcardRoot)(uri_1.Uri.parse('foo:/users/me', caseDetector), './blah/');
    assert_1.default.equal(p.toString(), 'foo:/users/me/blah');
});
test('getWildcardRoot2', () => {
    const p = (0, uriUtils_1.getWildcardRoot)(uri_1.Uri.parse('foo:/users/me', caseDetector), './**/*.py?/');
    assert_1.default.equal(p.toString(), 'foo:/users/me');
});
test('getWildcardRoot with root', () => {
    const p = (0, uriUtils_1.getWildcardRoot)(uri_1.Uri.parse('foo:/', caseDetector), '.');
    assert_1.default.equal(p.toString(), 'foo:/');
});
test('getWildcardRoot with drive letter', () => {
    const p = (0, uriUtils_1.getWildcardRoot)(uri_1.Uri.parse('file:///c:/', caseDetector), '.');
    assert_1.default.equal(p.toString(), 'file:///c%3A/');
});
function resolvePaths(uri, ...paths) {
    return uriUtils_1.UriEx.file(uri)
        .resolvePaths(...paths)
        .toString();
}
test('resolvePath1', () => {
    assert_1.default.equal(resolvePaths('/path', 'to', 'file.ext'), 'file:///path/to/file.ext');
});
test('resolvePath2', () => {
    assert_1.default.equal(resolvePaths('/path', 'to', '..', 'from', 'file.ext/'), 'file:///path/from/file.ext');
});
function getHomeDirUri() {
    return uriUtils_1.UriEx.file(os.homedir());
}
test('resolvePath3 ~ escape', () => {
    assert_1.default.equal(resolvePaths((0, envVarUtils_1.expandPathVariables)('~/path', uri_1.Uri.empty(), []), 'to', '..', 'from', 'file.ext/'), `${getHomeDirUri().toString()}/path/from/file.ext`);
});
test('resolvePath4 ~ escape in middle', () => {
    assert_1.default.equal(resolvePaths('/path', (0, envVarUtils_1.expandPathVariables)('~/file.ext/', uri_1.Uri.empty(), [])), `${getHomeDirUri().toString()}/file.ext`);
});
function combinePaths(uri, ...paths) {
    return resolvePaths(uri, ...paths);
}
test('invalid ~ without root', () => {
    const path = combinePaths('Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Development', 'mysuperproject');
    assert_1.default.equal(resolvePaths((0, envVarUtils_1.expandPathVariables)(path, uri_1.Uri.parse('foo:///src', caseDetector), [])), path);
});
test('invalid ~ with root', () => {
    const path = combinePaths('/', 'Library', 'com~apple~CloudDocs', 'Development', 'mysuperproject');
    assert_1.default.equal(resolvePaths((0, envVarUtils_1.expandPathVariables)(path, uri_1.Uri.parse('foo:///src', caseDetector), [])), path);
});
function containsPath(uri, child) {
    return uri_1.Uri.parse(child, caseDetector).isChild(uri_1.Uri.parse(uri, caseDetector));
}
test('containsPath1', () => {
    assert_1.default.equal(containsPath('/a/b/c/', '/a/d/../b/c/./d'), true);
});
test('containsPath2', () => {
    assert_1.default.equal(containsPath('/', '\\a'), true);
});
test('containsPath3', () => {
    assert_1.default.equal(containsPath('/a', '/a/B'), true);
});
function getAnyExtensionFromPath(uri) {
    return uri_1.Uri.parse(uri, caseDetector).lastExtension;
}
test('getAnyExtension1', () => {
    assert_1.default.equal(getAnyExtensionFromPath('/path/to/file.ext'), '.ext');
});
function getBaseFileName(uri) {
    return uri_1.Uri.parse(uri, caseDetector).fileName;
}
test('getBaseFileName1', () => {
    assert_1.default.equal(getBaseFileName('/path/to/file.ext'), 'file.ext');
});
test('getBaseFileName2', () => {
    assert_1.default.equal(getBaseFileName('/path/to/'), 'to');
});
test('getBaseFileName3', () => {
    assert_1.default.equal(getBaseFileName('c:/'), '');
});
function getUriRootLength(uri) {
    return uriUtils_1.UriEx.file(uri).getRootPathLength();
}
test('getRootLength1', () => {
    assert_1.default.equal(getUriRootLength('a'), 1);
});
test('getRootLength2', () => {
    assert_1.default.equal(getUriRootLength('/'), 1);
});
test('getRootLength3', () => {
    assert_1.default.equal(getUriRootLength('c:'), 3);
});
test('getRootLength4', () => {
    assert_1.default.equal(getUriRootLength('c:d'), 0);
});
test('getRootLength5', () => {
    assert_1.default.equal(getUriRootLength('c:/'), 3);
});
test('getRootLength6', () => {
    assert_1.default.equal(getUriRootLength('//server'), 9);
});
test('getRootLength7', () => {
    assert_1.default.equal(getUriRootLength('//server/share'), 9);
});
test('getRootLength8', () => {
    assert_1.default.equal(getUriRootLength('scheme:/no/authority'), 1);
});
test('getRootLength9', () => {
    assert_1.default.equal(getUriRootLength('scheme://with/authority'), 1);
});
function isRootedDiskUri(uri) {
    return (0, pathUtils_1.isRootedDiskPath)(uriUtils_1.UriEx.file(uri).getFilePath());
}
test('isRootedDiskPath1', () => {
    (0, assert_1.default)(isRootedDiskUri('C:/a/b'));
});
test('isRootedDiskPath2', () => {
    (0, assert_1.default)(isRootedDiskUri('/'));
});
test('isRootedDiskPath3', () => {
    (0, assert_1.default)(isRootedDiskUri('a/b'));
});
test('isDiskPathRoot1', () => {
    (0, assert_1.default)(isRootedDiskUri('/'));
});
test('isDiskPathRoot2', () => {
    (0, assert_1.default)(isRootedDiskUri('c:/'));
});
test('isDiskPathRoot3', () => {
    (0, assert_1.default)(isRootedDiskUri('c:'));
});
test('isDiskPathRoot4', () => {
    (0, assert_1.default)(!isRootedDiskUri('c:d'));
});
function getRelativePath(parent, child) {
    return uri_1.Uri.parse(parent, caseDetector).getRelativePath(uri_1.Uri.parse(child, caseDetector));
}
test('getRelativePath', () => {
    assert_1.default.equal(getRelativePath('/a/b/c', '/a/b/c/d/e/f'), './d/e/f');
    assert_1.default.equal(getRelativePath('/a/b/c/d/e/f', '/a/b/c/'), undefined);
    assert_1.default.equal(getRelativePath('/a/b/c', '/d/e/f'), undefined);
});
test('CaseSensitivity', () => {
    const cwd = '/';
    const fsCaseInsensitive = new vfs.TestFileSystem(/*ignoreCase*/ true, { cwd });
    assert_1.default.equal(fsCaseInsensitive.isLocalFileSystemCaseSensitive(), false);
    const fsCaseSensitive = new vfs.TestFileSystem(/*ignoreCase*/ false, { cwd });
    assert_1.default.equal(fsCaseSensitive.isLocalFileSystemCaseSensitive(), true);
});
test('deduplicateFolders', () => {
    const listOfFolders = [
        ['/user', '/user/temp', '/xuser/app', '/lib/python', '/home/p/.venv/lib/site-packages'].map((p) => uriUtils_1.UriEx.file(p)),
        ['/user', '/user/temp', '/xuser/app', '/lib/python/Python310.zip', '/home/z/.venv/lib/site-packages'].map((p) => uriUtils_1.UriEx.file(p)),
        ['/main/python/lib/site-packages', '/home/p'].map((p) => uriUtils_1.UriEx.file(p)),
    ];
    const folders = (0, uriUtils_1.deduplicateFolders)(listOfFolders).map((f) => f.getPath());
    const expected = [
        '/user',
        '/xuser/app',
        '/lib/python',
        '/home/z/.venv/lib/site-packages',
        '/main/python/lib/site-packages',
        '/home/p',
    ];
    assert_1.default.deepStrictEqual(folders.sort(), expected.sort());
});
test('convert UNC path', () => {
    const path = uriUtils_1.UriEx.file('file:///server/c$/folder/file.py');
    // When converting UNC path, server part shouldn't be removed.
    (0, assert_1.default)(path.getPath().indexOf('server') > 0);
});
function lowerCaseDrive(entries) {
    return entries.map((p) => (process.platform === 'win32' ? p[0].toLowerCase() + p.slice(1) : p));
}
test('Realcase', () => {
    const tempFile = new realFileSystem_1.RealTempFile();
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile);
    const cwd = process.cwd();
    const dir = uri_1.Uri.file(path.join(cwd, 'src', 'tests', '..', 'tests'), tempFile);
    const dirFilePath = dir.getFilePath();
    const entries = nodefs
        .readdirSync(dirFilePath)
        .map((entry) => path.basename(nodefs.realpathSync(path.join(dirFilePath, entry))));
    const normalizedEntries = lowerCaseDrive(entries);
    const fsentries = fs.readdirSync(dir);
    assert_1.default.deepStrictEqual(normalizedEntries, fsentries);
    const paths = entries.map((entry) => nodefs.realpathSync(path.join(dirFilePath, entry)));
    const fspaths = fsentries.map((entry) => fs.realCasePath(dir.combinePaths(entry)).getFilePath());
    assert_1.default.deepStrictEqual(lowerCaseDrive(paths), fspaths);
    // Check that the '..' has been removed.
    assert_1.default.ok(!fspaths.some((p) => p.toString().indexOf('..') >= 0));
    // If windows, check that the case is correct.
    if (process.platform === 'win32') {
        for (const p of fspaths) {
            const upper = uriUtils_1.UriEx.file(p.toString().toUpperCase());
            const real = fs.realCasePath(upper);
            assert_1.default.strictEqual(p, real.getFilePath());
        }
    }
});
test('Realcase use cwd implicitly', () => {
    const tempFile = new realFileSystem_1.RealTempFile();
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile);
    const cwd = process.cwd();
    const dir = path.join(cwd, 'src', 'tests');
    const uri = uri_1.Uri.file(dir, tempFile);
    const entries = nodefs.readdirSync(dir).map((entry) => path.basename(nodefs.realpathSync(path.join(dir, entry))));
    const fsentries = fs.readdirSync(uri);
    const paths = entries.map((entry) => nodefs.realpathSync(path.join(dir, entry)));
    const fspaths = fsentries.map((entry) => fs.realCasePath(uri.combinePaths(entry)).getFilePath());
    assert_1.default.deepStrictEqual(lowerCaseDrive(paths), fspaths);
});
test('Web URIs dont exist', () => {
    const tempFile = new realFileSystem_1.RealTempFile();
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile);
    const uri = uriUtils_1.UriEx.parse('http://www.bing.com');
    (0, assert_1.default)(!fs.existsSync(uri));
    const stat = fs.statSync(uri);
    (0, assert_1.default)(!stat.isFile());
});
test('constant uri test', () => {
    const name = 'constant uri';
    const uri1 = uri_1.Uri.constant(name);
    const uri2 = uri_1.Uri.constant(name);
    (0, assert_1.default)(!uri1.equals(uri2));
    (0, assert_1.default)(uri1.equals(uri1));
});
test('root test', () => {
    const uri1 = uriUtils_1.UriEx.file('C:\\');
    const uri2 = uriUtils_1.UriEx.file('C:');
    const uri3 = uriUtils_1.UriEx.file('/');
    assert_1.default.strictEqual(uri1.getFilePath(), (0, pathUtils_1.normalizeSlashes)('c:/'));
    assert_1.default.strictEqual(uri2.getFilePath(), (0, pathUtils_1.normalizeSlashes)('c:/'));
    assert_1.default.strictEqual(uri3.getFilePath(), (0, pathUtils_1.normalizeSlashes)('/'));
});
//# sourceMappingURL=uri.test.js.map