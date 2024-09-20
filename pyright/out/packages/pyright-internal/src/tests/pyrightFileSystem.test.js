"use strict";
/*
 * pyrightFileSystem.test.ts
 *
 * pyrightFileSystem tests.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const pathConsts_1 = require("../common/pathConsts");
const pathUtils_1 = require("../common/pathUtils");
const pyrightFileSystem_1 = require("../pyrightFileSystem");
const filesystem_1 = require("./harness/vfs/filesystem");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const libraryRoot = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), pathConsts_1.lib, pathConsts_1.sitePackages);
const libraryRootUri = uriUtils_1.UriEx.file(libraryRoot);
test('virtual file exists', () => {
    const files = [
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'partialStub.pyi'),
            content: 'def test(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'subdir', '__init__.pyi'),
            content: 'def subdir(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
            content: 'partial\n',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
            content: 'def test(): pass',
        },
    ];
    const fs = createFileSystem(files);
    fs.processPartialStubPackages([libraryRootUri], [libraryRootUri]);
    const stubFile = libraryRootUri.combinePaths('myLib', 'partialStub.pyi');
    (0, assert_1.default)(fs.existsSync(stubFile));
    (0, assert_1.default)(fs.isMappedUri(stubFile));
    const myLib = libraryRootUri.combinePaths('myLib');
    const entries = fs.readdirEntriesSync(myLib);
    assert_1.default.strictEqual(3, entries.length);
    const subDirFile = libraryRootUri.combinePaths('myLib', 'subdir', '__init__.pyi');
    (0, assert_1.default)(fs.existsSync(subDirFile));
    (0, assert_1.default)(fs.isMappedUri(subDirFile));
    const fakeFile = entries.filter((e) => e.name.endsWith('.pyi'))[0];
    (0, assert_1.default)(fakeFile.isFile());
    (0, assert_1.default)(!fs.existsSync(libraryRootUri.combinePaths('myLib-stubs')));
});
test('virtual file coexists with real', () => {
    const files = [
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'partialStub.pyi'),
            content: 'def test(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'subdir', '__init__.pyi'),
            content: 'def subdir(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
            content: 'partial\n',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
            content: 'def test(): pass',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'subdir', '__init__.py'),
            content: 'def test(): pass',
        },
    ];
    const fs = createFileSystem(files);
    fs.processPartialStubPackages([libraryRootUri], [libraryRootUri]);
    const stubFile = libraryRootUri.combinePaths('myLib', 'partialStub.pyi');
    (0, assert_1.default)(fs.existsSync(stubFile));
    (0, assert_1.default)(fs.isMappedUri(stubFile));
    const myLib = libraryRootUri.combinePaths('myLib');
    const entries = fs.readdirEntriesSync(myLib);
    assert_1.default.strictEqual(3, entries.length);
    const subDirFile = libraryRootUri.combinePaths('myLib', 'subdir', '__init__.pyi');
    (0, assert_1.default)(fs.existsSync(subDirFile));
    (0, assert_1.default)(fs.isMappedUri(subDirFile));
    const subDirPyiFile = libraryRootUri.combinePaths('myLib', 'subdir', '__init__.pyi');
    (0, assert_1.default)(fs.existsSync(subDirPyiFile));
    const fakeFile = entries.filter((e) => e.name.endsWith('.pyi'))[0];
    (0, assert_1.default)(fakeFile.isFile());
    (0, assert_1.default)(!fs.existsSync(libraryRootUri.combinePaths('myLib-stubs')));
});
test('virtual file not exist', () => {
    const files = [
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'partialStub.pyi'),
            content: 'def test(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'otherType.py'),
            content: 'def test(): pass',
        },
    ];
    const fs = createFileSystem(files);
    fs.processPartialStubPackages([libraryRootUri], [libraryRootUri]);
    (0, assert_1.default)(!fs.existsSync(libraryRootUri.combinePaths('myLib', 'partialStub.pyi')));
    const myLib = libraryRootUri.combinePaths('myLib');
    const entries = fs.readdirEntriesSync(myLib);
    assert_1.default.strictEqual(1, entries.length);
    assert_1.default.strictEqual(0, entries.filter((e) => e.name.endsWith('.pyi')).length);
    (0, assert_1.default)(fs.existsSync(libraryRootUri.combinePaths('myLib-stubs')));
});
test('existing stub file', () => {
    const files = [
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'partialStub.pyi'),
            content: 'def test(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
            content: 'partial\n',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
            content: 'def test(): pass',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.pyi'),
            content: 'def test(): pass',
        },
    ];
    const fs = createFileSystem(files);
    fs.processPartialStubPackages([libraryRootUri], [libraryRootUri]);
    const stubFile = libraryRootUri.combinePaths('myLib', 'partialStub.pyi');
    (0, assert_1.default)(fs.existsSync(stubFile));
    const myLib = libraryRootUri.combinePaths('myLib');
    const entries = fs.readdirEntriesSync(myLib);
    assert_1.default.strictEqual(2, entries.length);
    assert_1.default.strictEqual('def test(): ...', fs.readFileSync(stubFile, 'utf8'));
    (0, assert_1.default)(!fs.existsSync(libraryRootUri.combinePaths('myLib-stubs')));
});
test('multiple package installed', () => {
    const extraRoot = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), pathConsts_1.lib, 'extra');
    const extraRootUri = uriUtils_1.UriEx.file(extraRoot);
    const files = [
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'partialStub.pyi'),
            content: 'def test(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
            content: 'partial\n',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
            content: 'def test(): pass',
        },
        {
            path: (0, pathUtils_1.combinePaths)(extraRoot, 'myLib', 'partialStub.py'),
            content: 'def test(): pass',
        },
    ];
    const fs = createFileSystem(files);
    fs.processPartialStubPackages([libraryRootUri, extraRootUri], [libraryRootUri, extraRootUri]);
    (0, assert_1.default)(fs.isPathScanned(libraryRootUri));
    (0, assert_1.default)(fs.isPathScanned(extraRootUri));
    (0, assert_1.default)(fs.existsSync(libraryRootUri.combinePaths('myLib', 'partialStub.pyi')));
    (0, assert_1.default)(fs.existsSync(extraRootUri.combinePaths('myLib', 'partialStub.pyi')));
    assert_1.default.strictEqual(2, fs.readdirEntriesSync(libraryRootUri.combinePaths('myLib')).length);
    assert_1.default.strictEqual(2, fs.readdirEntriesSync(extraRootUri.combinePaths('myLib')).length);
});
test('bundled partial stubs', () => {
    const bundledPath = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), 'bundled');
    const bundledPathUri = uriUtils_1.UriEx.file(bundledPath);
    const files = [
        {
            path: (0, pathUtils_1.combinePaths)(bundledPath, 'myLib-stubs', 'partialStub.pyi'),
            content: 'def test(): ...',
        },
        {
            path: (0, pathUtils_1.combinePaths)(bundledPath, 'myLib-stubs', 'py.typed'),
            content: 'partial\n',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
            content: 'def test(): pass',
        },
        {
            path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'py.typed'),
            content: '',
        },
    ];
    const fs = createFileSystem(files);
    fs.processPartialStubPackages([bundledPathUri], [libraryRootUri], bundledPathUri);
    const stubFile = libraryRootUri.combinePaths('myLib', 'partialStub.pyi');
    (0, assert_1.default)(!fs.existsSync(stubFile));
    const myLib = libraryRootUri.combinePaths('myLib');
    const entries = fs.readdirEntriesSync(myLib);
    assert_1.default.strictEqual(2, entries.length);
});
function createFileSystem(files) {
    const fs = new filesystem_1.TestFileSystem(/* ignoreCase */ false, { cwd: (0, pathUtils_1.normalizeSlashes)('/') });
    for (const file of files) {
        const path = (0, pathUtils_1.normalizeSlashes)(file.path);
        const dir = (0, pathUtils_1.getDirectoryPath)(path);
        fs.mkdirpSync(dir);
        fs.writeFileSync(uri_1.Uri.file(path, fs), file.content);
    }
    return new pyrightFileSystem_1.PyrightFileSystem(fs);
}
//# sourceMappingURL=pyrightFileSystem.test.js.map