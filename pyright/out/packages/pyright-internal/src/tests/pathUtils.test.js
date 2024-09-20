"use strict";
/*
 * pathUtils.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Unit tests for pathUtils module.
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
const path = __importStar(require("path"));
const pathUtils_1 = require("../common/pathUtils");
test('getPathComponents1', () => {
    const components = (0, pathUtils_1.getPathComponents)('');
    assert_1.default.equal(components.length, 1);
    assert_1.default.equal(components[0], '');
});
test('getPathComponents2', () => {
    const components = (0, pathUtils_1.getPathComponents)('/users/');
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], path.sep);
    assert_1.default.equal(components[1], 'users');
});
test('getPathComponents3', () => {
    const components = (0, pathUtils_1.getPathComponents)('/users/hello.py');
    assert_1.default.equal(components.length, 3);
    assert_1.default.equal(components[0], path.sep);
    assert_1.default.equal(components[1], 'users');
    assert_1.default.equal(components[2], 'hello.py');
});
test('getPathComponents4', () => {
    const components = (0, pathUtils_1.getPathComponents)('/users/hello/../');
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], path.sep);
    assert_1.default.equal(components[1], 'users');
});
test('getPathComponents5', () => {
    const components = (0, pathUtils_1.getPathComponents)('./hello.py');
    assert_1.default.equal(components.length, 2);
    assert_1.default.equal(components[0], '');
    assert_1.default.equal(components[1], 'hello.py');
});
test('getPathComponents6', () => {
    const components = (0, pathUtils_1.getPathComponents)(fixSeparators('//server/share/dir/file.py'));
    assert_1.default.equal(components.length, 4);
    assert_1.default.equal(components[0], fixSeparators('//server/'));
    assert_1.default.equal(components[1], 'share');
    assert_1.default.equal(components[2], 'dir');
    assert_1.default.equal(components[3], 'file.py');
});
test('getPathComponents7', () => {
    const components = (0, pathUtils_1.getPathComponents)('ab:cdef/test');
    assert_1.default.equal(components.length, 3);
    assert_1.default.equal(components[0], '');
    assert_1.default.equal(components[1], 'ab:cdef');
    assert_1.default.equal(components[2], 'test');
});
test('combinePaths1', () => {
    const p = (0, pathUtils_1.combinePaths)('/user', '1', '2', '3');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('/user/1/2/3'));
});
test('combinePaths2', () => {
    const p = (0, pathUtils_1.combinePaths)('/foo', 'ab:c');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('/foo/ab:c'));
});
test('combinePaths3', () => {
    const p = (0, pathUtils_1.combinePaths)('untitled:foo', 'ab:c');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('untitled:foo/ab:c'));
});
test('ensureTrailingDirectorySeparator1', () => {
    const p = (0, pathUtils_1.ensureTrailingDirectorySeparator)('hello');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('hello/'));
});
test('hasTrailingDirectorySeparator1', () => {
    (0, assert_1.default)(!(0, pathUtils_1.hasTrailingDirectorySeparator)('hello'));
    (0, assert_1.default)((0, pathUtils_1.hasTrailingDirectorySeparator)('hello/'));
    (0, assert_1.default)((0, pathUtils_1.hasTrailingDirectorySeparator)('hello\\'));
});
test('stripTrailingDirectorySeparator1', () => {
    const path = (0, pathUtils_1.stripTrailingDirectorySeparator)('hello/');
    assert_1.default.equal(path, 'hello');
});
test('getFileExtension1', () => {
    const ext = (0, pathUtils_1.getFileExtension)('blah.blah/hello.JsOn');
    assert_1.default.equal(ext, '.JsOn');
});
test('getFileExtension2', () => {
    const ext1 = (0, pathUtils_1.getFileExtension)('blah.blah/hello.cpython-32m.so', true);
    assert_1.default.equal(ext1, '.cpython-32m.so');
    const ext2 = (0, pathUtils_1.getFileExtension)('blah.blah/hello.cpython-32m.so', false);
    assert_1.default.equal(ext2, '.so');
});
test('getFileName1', () => {
    const fileName = (0, pathUtils_1.getFileName)('blah.blah/HeLLo.JsOn');
    assert_1.default.equal(fileName, 'HeLLo.JsOn');
});
test('getFileName2', () => {
    const fileName1 = (0, pathUtils_1.getFileName)('blah.blah/hello.cpython-32m.so');
    assert_1.default.equal(fileName1, 'hello.cpython-32m.so');
});
test('stripFileExtension1', () => {
    const path = (0, pathUtils_1.stripFileExtension)('blah.blah/HeLLo.JsOn');
    assert_1.default.equal(path, 'blah.blah/HeLLo');
});
test('stripFileExtension2', () => {
    const path1 = (0, pathUtils_1.stripFileExtension)('blah.blah/hello.cpython-32m.so', true);
    assert_1.default.equal(path1, 'blah.blah/hello');
    const path2 = (0, pathUtils_1.stripFileExtension)('blah.blah/hello.cpython-32m.so', false);
    assert_1.default.equal(path2, 'blah.blah/hello.cpython-32m');
});
function fixSeparators(linuxPath) {
    if (path.sep === '\\') {
        return linuxPath.replace(/\//g, path.sep);
    }
    return linuxPath;
}
test('getWildcardRegexPattern1', () => {
    const pattern = (0, pathUtils_1.getWildcardRegexPattern)('/users/me', './blah/');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test(fixSeparators('/users/me/blah/d')));
    assert_1.default.ok(!regex.test(fixSeparators('/users/me/blad/d')));
});
test('getWildcardRegexPattern2', () => {
    const pattern = (0, pathUtils_1.getWildcardRegexPattern)('/users/me', './**/*.py?');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test(fixSeparators('/users/me/.blah/foo.pyd')));
    assert_1.default.ok(!regex.test(fixSeparators('/users/me/.blah/foo.py'))); // No char after
});
test('getWildcardRegexPattern3', () => {
    const pattern = (0, pathUtils_1.getWildcardRegexPattern)('/users/me', './**/.*.py');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test(fixSeparators('/users/me/.blah/.foo.py')));
    assert_1.default.ok(!regex.test(fixSeparators('/users/me/.blah/foo.py')));
});
test('getWildcardRegexPattern4', () => {
    const pattern = (0, pathUtils_1.getWildcardRegexPattern)('//server/share/dir', '.');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test(fixSeparators('//server/share/dir/foo.py')));
    assert_1.default.ok(!regex.test(fixSeparators('//server/share/dix/foo.py')));
});
test('getWildcardRegexPattern5', () => {
    const pattern = (0, pathUtils_1.getWildcardRegexPattern)('//server/share/dir++', '.');
    const regex = new RegExp(pattern);
    assert_1.default.ok(regex.test(fixSeparators('//server/share/dir++/foo.py')));
    assert_1.default.ok(!regex.test(fixSeparators('//server/share/dix++/foo.py')));
});
test('isDirectoryWildcardPatternPresent1', () => {
    const isPresent = (0, pathUtils_1.isDirectoryWildcardPatternPresent)('./**/*.py');
    assert_1.default.equal(isPresent, true);
});
test('isDirectoryWildcardPatternPresent2', () => {
    const isPresent = (0, pathUtils_1.isDirectoryWildcardPatternPresent)('./**/a/*.py');
    assert_1.default.equal(isPresent, true);
});
test('isDirectoryWildcardPatternPresent3', () => {
    const isPresent = (0, pathUtils_1.isDirectoryWildcardPatternPresent)('./**/@tests');
    assert_1.default.equal(isPresent, true);
});
test('isDirectoryWildcardPatternPresent4', () => {
    const isPresent = (0, pathUtils_1.isDirectoryWildcardPatternPresent)('./**/test/test*');
    assert_1.default.equal(isPresent, true);
});
test('getWildcardRoot1', () => {
    const p = (0, pathUtils_1.getWildcardRoot)('/users/me', './blah/');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('/users/me/blah'));
});
test('getWildcardRoot2', () => {
    const p = (0, pathUtils_1.getWildcardRoot)('/users/me', './**/*.py?/');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('/users/me'));
});
test('getWildcardRoot with root', () => {
    const p = (0, pathUtils_1.getWildcardRoot)('/', '.');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('/'));
});
test('getWildcardRoot with drive letter', () => {
    const p = (0, pathUtils_1.getWildcardRoot)('c:/', '.');
    assert_1.default.equal(p, (0, pathUtils_1.normalizeSlashes)('c:'));
});
test('reducePathComponentsEmpty', () => {
    assert_1.default.equal((0, pathUtils_1.reducePathComponents)([]).length, 0);
});
test('reducePathComponents', () => {
    assert_1.default.deepEqual((0, pathUtils_1.reducePathComponents)((0, pathUtils_1.getPathComponents)('/a/b/../c/.')), [path.sep, 'a', 'c']);
});
test('combinePathComponentsEmpty', () => {
    assert_1.default.equal((0, pathUtils_1.combinePathComponents)([]), '');
});
test('combinePathComponentsAbsolute', () => {
    assert_1.default.equal((0, pathUtils_1.combinePathComponents)(['/', 'a', 'b']), (0, pathUtils_1.normalizeSlashes)('/a/b'));
});
test('combinePathComponents', () => {
    assert_1.default.equal((0, pathUtils_1.combinePathComponents)(['a', 'b']), (0, pathUtils_1.normalizeSlashes)('a/b'));
});
test('resolvePath1', () => {
    assert_1.default.equal((0, pathUtils_1.resolvePaths)('/path', 'to', 'file.ext'), (0, pathUtils_1.normalizeSlashes)('/path/to/file.ext'));
});
test('resolvePath2', () => {
    assert_1.default.equal((0, pathUtils_1.resolvePaths)('/path', 'to', '..', 'from', 'file.ext/'), (0, pathUtils_1.normalizeSlashes)('/path/from/file.ext/'));
});
test('containsPath1', () => {
    assert_1.default.equal((0, pathUtils_1.containsPath)('/a/b/c/', '/a/d/../b/c/./d'), true);
});
test('containsPath2', () => {
    assert_1.default.equal((0, pathUtils_1.containsPath)('/', '\\a'), true);
});
test('containsPath3', () => {
    assert_1.default.equal((0, pathUtils_1.containsPath)('/a', '/A/B', true), true);
});
test('changeAnyExtension2', () => {
    assert_1.default.equal((0, pathUtils_1.getAnyExtensionFromPath)('/path/to/file.ext', '.ts', true), '');
});
test('changeAnyExtension3', () => {
    assert_1.default.equal((0, pathUtils_1.getAnyExtensionFromPath)('/path/to/file.ext', ['.ext', '.ts'], true), '.ext');
});
test('getBaseFileName1', () => {
    assert_1.default.equal((0, pathUtils_1.getBaseFileName)('/path/to/file.ext'), 'file.ext');
});
test('getBaseFileName2', () => {
    assert_1.default.equal((0, pathUtils_1.getBaseFileName)('/path/to/'), 'to');
});
test('getBaseFileName3', () => {
    assert_1.default.equal((0, pathUtils_1.getBaseFileName)('c:/'), '');
});
test('getBaseFileName4', () => {
    assert_1.default.equal((0, pathUtils_1.getBaseFileName)('/path/to/file.ext', ['.ext'], true), 'file');
});
test('getRootLength1', () => {
    assert_1.default.equal((0, pathUtils_1.getRootLength)('a'), 0);
});
test('getRootLength2', () => {
    assert_1.default.equal((0, pathUtils_1.getRootLength)(fixSeparators('/')), 1);
});
test('getRootLength3', () => {
    assert_1.default.equal((0, pathUtils_1.getRootLength)('c:'), 2);
});
test('getRootLength4', () => {
    assert_1.default.equal((0, pathUtils_1.getRootLength)('c:d'), 0);
});
test('getRootLength5', () => {
    assert_1.default.equal((0, pathUtils_1.getRootLength)(fixSeparators('c:/')), 3);
});
test('getRootLength6', () => {
    assert_1.default.equal((0, pathUtils_1.getRootLength)(fixSeparators('//server')), 8);
});
test('getRootLength7', () => {
    assert_1.default.equal((0, pathUtils_1.getRootLength)(fixSeparators('//server/share')), 9);
});
test('isRootedDiskPath1', () => {
    (0, assert_1.default)((0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)('C:/a/b')));
});
test('isRootedDiskPath2', () => {
    (0, assert_1.default)((0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)('/')));
});
test('isRootedDiskPath3', () => {
    (0, assert_1.default)(!(0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)('a/b')));
});
test('isDiskPathRoot1', () => {
    (0, assert_1.default)((0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)('/')));
});
test('isDiskPathRoot2', () => {
    (0, assert_1.default)((0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)('c:/')));
});
test('isDiskPathRoot3', () => {
    (0, assert_1.default)((0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)('c:')));
});
test('isDiskPathRoot4', () => {
    (0, assert_1.default)(!(0, pathUtils_1.isRootedDiskPath)((0, pathUtils_1.normalizeSlashes)('c:d')));
});
test('getRelativePath', () => {
    assert_1.default.equal((0, pathUtils_1.getRelativePath)((0, pathUtils_1.normalizeSlashes)('/a/b/c/d/e/f'), (0, pathUtils_1.normalizeSlashes)('/a/b/c')), (0, pathUtils_1.normalizeSlashes)('./d/e/f'));
});
//# sourceMappingURL=pathUtils.test.js.map