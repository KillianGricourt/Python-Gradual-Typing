"use strict";
/*
 * importResolver.test.ts
 *
 * importResolver tests.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const importResolver_1 = require("../analyzer/importResolver");
const configOptions_1 = require("../common/configOptions");
const fullAccessHost_1 = require("../common/fullAccessHost");
const pathConsts_1 = require("../common/pathConsts");
const pathUtils_1 = require("../common/pathUtils");
const realFileSystem_1 = require("../common/realFileSystem");
const serviceKeys_1 = require("../common/serviceKeys");
const serviceProviderExtensions_1 = require("../common/serviceProviderExtensions");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const pyrightFileSystem_1 = require("../pyrightFileSystem");
const testAccessHost_1 = require("./harness/testAccessHost");
const filesystem_1 = require("./harness/vfs/filesystem");
const libraryRoot = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), pathConsts_1.lib, pathConsts_1.sitePackages);
function usingTrueVenv() {
    return process.env.CI_IMPORT_TEST_VENVPATH !== undefined || process.env.CI_IMPORT_TEST_PYTHONPATH !== undefined;
}
if (!usingTrueVenv()) {
    describe('Import tests that cannot run in a true venv', () => {
        test('partial stub file exists', () => {
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
            ];
            const importResult = getImportResult(files, ['myLib', 'partialStub']);
            (0, assert_1.default)(importResult.isImportFound);
            (0, assert_1.default)(importResult.isStubFile);
            assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => !f.isEmpty() && f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.pyi')).length);
        });
        test('partial stub __init__ exists', () => {
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', '__init__.pyi'),
                    content: 'def test(): ...',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
                    content: 'partial\n',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.py'),
                    content: 'def test(): pass',
                },
            ];
            const importResult = getImportResult(files, ['myLib']);
            (0, assert_1.default)(importResult.isImportFound);
            (0, assert_1.default)(importResult.isStubFile);
            assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.pyi')).length);
        });
        test('stub package', () => {
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'stub.pyi'),
                    content: '# empty',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', '__init__.pyi'),
                    content: '# empty',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
                    content: 'def test(): pass',
                },
            ];
            // If fully typed stub package exists, that wins over the real package.
            const importResult = getImportResult(files, ['myLib', 'partialStub']);
            (0, assert_1.default)(!importResult.isImportFound);
        });
        test('partial stub package in typing folder', () => {
            const typingFolder = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), 'typing');
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)(typingFolder, 'myLib-stubs', '__init__.pyi'),
                    content: 'def test(): ...',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(typingFolder, 'myLib-stubs', 'py.typed'),
                    content: 'partial\n',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.py'),
                    content: 'def test(): pass',
                },
            ];
            const importResult = getImportResult(files, ['myLib'], (c) => (c.stubPath = uriUtils_1.UriEx.file(typingFolder)));
            (0, assert_1.default)(importResult.isImportFound);
            (0, assert_1.default)(importResult.isStubFile);
            assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.pyi')).length);
        });
        test('typeshed folder', () => {
            const typeshedFolder = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), 'ts');
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', '__init__.pyi'),
                    content: 'def test(): ...',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
                    content: 'partial\n',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(typeshedFolder, 'stubs', 'myLibPackage', 'myLib.pyi'),
                    content: '# empty',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.py'),
                    content: 'def test(): pass',
                },
            ];
            // Stub packages win over typeshed.
            const importResult = getImportResult(files, ['myLib'], (c) => (c.typeshedPath = uriUtils_1.UriEx.file(typeshedFolder)));
            (0, assert_1.default)(importResult.isImportFound);
            (0, assert_1.default)(importResult.isStubFile);
            assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.pyi')).length);
        });
        test('typeshed fallback folder', () => {
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', '__init__.pyi'),
                    content: 'def test(): ...',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
                    content: 'partial\n',
                },
                {
                    path: (0, pathUtils_1.combinePaths)('/', pathConsts_1.typeshedFallback, 'stubs', 'myLibPackage', 'myLib.pyi'),
                    content: '# empty',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.py'),
                    content: 'def test(): pass',
                },
            ];
            // Stub packages win over typeshed.
            const importResult = getImportResult(files, ['myLib']);
            (0, assert_1.default)(importResult.isImportFound);
            (0, assert_1.default)(importResult.isStubFile);
            assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.pyi')).length);
        });
        test('py.typed file', () => {
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', '__init__.pyi'),
                    content: 'def test(): ...',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
                    content: 'partial\n',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.py'),
                    content: 'def test(): pass',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'py.typed'),
                    content: '# typed',
                },
            ];
            // Partial stub package always overrides original package.
            const importResult = getImportResult(files, ['myLib']);
            (0, assert_1.default)(importResult.isImportFound);
            (0, assert_1.default)(importResult.isStubFile);
        });
        test('py.typed library', () => {
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'os', '__init__.py'),
                    content: 'def test(): ...',
                },
                {
                    path: (0, pathUtils_1.combinePaths)(libraryRoot, 'os', 'py.typed'),
                    content: '',
                },
                {
                    path: (0, pathUtils_1.combinePaths)('/', pathConsts_1.typeshedFallback, 'stubs', 'os', 'os', '__init__.pyi'),
                    content: '# empty',
                },
            ];
            const importResult = getImportResult(files, ['os']);
            (0, assert_1.default)(importResult.isImportFound);
            assert_1.default.strictEqual(files[0].path, importResult.resolvedUris[importResult.resolvedUris.length - 1].getFilePath());
        });
        test('import side by side file sub under lib folder', () => {
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)('/lib/site-packages/myLib', 'file1.py'),
                    content: 'def test1(): ...',
                },
                {
                    path: (0, pathUtils_1.combinePaths)('/lib/site-packages/myLib', 'file2.py'),
                    content: 'def test2(): ...',
                },
            ];
            const importResult = getImportResult(files, ['file1']);
            (0, assert_1.default)(!importResult.isImportFound);
        });
    });
}
describe('Import tests that can run with or without a true venv', () => {
    test('side by side files', () => {
        const myFile = (0, pathUtils_1.combinePaths)('src', 'file.py');
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
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.pyi'),
                content: '# empty',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
                content: 'def test(): pass',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'partialStub2.pyi'),
                content: 'def test(): ...',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub2.py'),
                content: 'def test(): pass',
            },
            {
                path: myFile,
                content: '# not used',
            },
        ];
        const sp = createServiceProviderFromFiles(files);
        const configOptions = new configOptions_1.ConfigOptions(uriUtils_1.UriEx.file('/'));
        const importResolver = new importResolver_1.ImportResolver(sp, configOptions, new testAccessHost_1.TestAccessHost(sp.fs().getModulePath(), [uriUtils_1.UriEx.file(libraryRoot)]));
        // Stub package wins over original package (per PEP 561 rules).
        const myUri = uriUtils_1.UriEx.file(myFile);
        const sideBySideResult = importResolver.resolveImport(myUri, configOptions.findExecEnvironment(myUri), {
            leadingDots: 0,
            nameParts: ['myLib', 'partialStub'],
            importedSymbols: new Set(),
        });
        (0, assert_1.default)(sideBySideResult.isImportFound);
        (0, assert_1.default)(sideBySideResult.isStubFile);
        const sideBySideStubFile = uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.pyi'));
        assert_1.default.strictEqual(1, sideBySideResult.resolvedUris.filter((f) => f.key === sideBySideStubFile.key).length);
        assert_1.default.strictEqual('def test(): ...', sp.fs().readFileSync(sideBySideStubFile, 'utf8'));
        // Side by side stub doesn't completely disable partial stub.
        const partialStubResult = importResolver.resolveImport(myUri, configOptions.findExecEnvironment(myUri), {
            leadingDots: 0,
            nameParts: ['myLib', 'partialStub2'],
            importedSymbols: new Set(),
        });
        (0, assert_1.default)(partialStubResult.isImportFound);
        (0, assert_1.default)(partialStubResult.isStubFile);
        const partialStubFile = uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub2.pyi'));
        assert_1.default.strictEqual(1, partialStubResult.resolvedUris.filter((f) => f.key === partialStubFile.key).length);
    });
    test('stub namespace package', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'stub.pyi'),
                content: '# empty',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py'),
                content: 'def test(): pass',
            },
        ];
        // If fully typed stub package exists, that wins over the real package.
        const importResult = getImportResult(files, ['myLib', 'partialStub']);
        (0, assert_1.default)(importResult.isImportFound);
        (0, assert_1.default)(!importResult.isStubFile);
        assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => !f.isEmpty() && f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'partialStub.py')).length);
    });
    test('py.typed namespace package plus stubs', () => {
        const typingFolder = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), 'typing');
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)(typingFolder, 'myLib/core', 'foo.pyi'),
                content: 'def test(): pass',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', 'py.typed'),
                content: '',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.py'),
                content: 'def test(): pass',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.pyi'),
                content: 'def test(): pass',
            },
        ];
        const importResult = getImportResult(files, ['myLib'], (c) => (c.stubPath = uriUtils_1.UriEx.file(typingFolder)));
        (0, assert_1.default)(importResult.isImportFound);
        (0, assert_1.default)(importResult.isStubFile);
        assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => !f.isEmpty() && f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.pyi')).length);
    });
    test('stub in typing folder over partial stub package', () => {
        const typingFolder = (0, pathUtils_1.combinePaths)((0, pathUtils_1.normalizeSlashes)('/'), 'typing');
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', '__init__.pyi'),
                content: 'def test(): ...',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib-stubs', 'py.typed'),
                content: 'partial\n',
            },
            {
                path: (0, pathUtils_1.combinePaths)(typingFolder, 'myLib.pyi'),
                content: '# empty',
            },
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.py'),
                content: 'def test(): pass',
            },
        ];
        // If the package exists in typing folder, that gets picked up first.
        const importResult = getImportResult(files, ['myLib'], (c) => (c.stubPath = uriUtils_1.UriEx.file(typingFolder)));
        (0, assert_1.default)(importResult.isImportFound);
        (0, assert_1.default)(importResult.isStubFile);
        assert_1.default.strictEqual(0, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)(libraryRoot, 'myLib', '__init__.pyi')).length);
    });
    test('non py.typed library', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)(libraryRoot, 'os', '__init__.py'),
                content: 'def test(): ...',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', pathConsts_1.typeshedFallback, 'stubs', 'os', 'os', '__init__.pyi'),
                content: '# empty',
            },
        ];
        const importResult = getImportResult(files, ['os']);
        (0, assert_1.default)(importResult.isImportFound);
        assert_1.default.strictEqual(files[1].path, importResult.resolvedUris[importResult.resolvedUris.length - 1].getFilePath());
    });
    test('no empty import roots', () => {
        const sp = createServiceProviderFromFiles([]);
        const configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.empty()); // Empty, like open-file mode.
        const importResolver = new importResolver_1.ImportResolver(sp, configOptions, new testAccessHost_1.TestAccessHost(sp.fs().getModulePath(), [uriUtils_1.UriEx.file(libraryRoot)]));
        importResolver.getImportRoots(configOptions.getDefaultExecEnvironment()).forEach((path) => (0, assert_1.default)(path));
    });
    test('multiple typeshedFallback', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', pathConsts_1.typeshedFallback, 'stubs', 'aLib', 'aLib', '__init__.pyi'),
                content: '# empty',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', pathConsts_1.typeshedFallback, 'stubs', 'bLib', 'bLib', '__init__.pyi'),
                content: '# empty',
            },
        ];
        const sp = createServiceProviderFromFiles(files);
        const configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.empty()); // Empty, like open-file mode.
        const importResolver = new importResolver_1.ImportResolver(sp, configOptions, new testAccessHost_1.TestAccessHost(sp.fs().getModulePath(), [uriUtils_1.UriEx.file(libraryRoot)]));
        const importRoots = importResolver.getImportRoots(configOptions.getDefaultExecEnvironment());
        assert_1.default.strictEqual(1, importRoots.filter((f) => !f.isEmpty() && f.getFilePath() === (0, pathUtils_1.combinePaths)('/', pathConsts_1.typeshedFallback, 'stubs', 'aLib')).length);
        assert_1.default.strictEqual(1, importRoots.filter((f) => !f.isEmpty() && f.getFilePath() === (0, pathUtils_1.combinePaths)('/', pathConsts_1.typeshedFallback, 'stubs', 'bLib')).length);
    });
    test('import side by side file root', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', 'file1.py'),
                content: 'def test1(): ...',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'file2.py'),
                content: 'def test2(): ...',
            },
        ];
        const importResult = getImportResult(files, ['file1']);
        (0, assert_1.default)(importResult.isImportFound);
        assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)('/', 'file1.py')).length);
    });
    test('import side by side file sub folder', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/test', 'file1.py'),
                content: 'def test1(): ...',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/test', 'file2.py'),
                content: 'def test2(): ...',
            },
        ];
        const importResult = getImportResult(files, ['file1']);
        (0, assert_1.default)(importResult.isImportFound);
        assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)('/test', 'file1.py')).length);
    });
    test('import side by side file sub under src folder', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/src/nested', 'file1.py'),
                content: 'def test1(): ...',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/src/nested', 'file2.py'),
                content: 'def test2(): ...',
            },
        ];
        const importResult = getImportResult(files, ['file1']);
        (0, assert_1.default)(importResult.isImportFound);
        assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)('/src/nested', 'file1.py')).length);
    });
    test('import file sub under containing folder', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/src/nested', 'file1.py'),
                content: 'def test1(): ...',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/src/nested/nested2', 'file2.py'),
                content: 'def test2(): ...',
            },
        ];
        const importResult = getImportResult(files, ['file1']);
        (0, assert_1.default)(importResult.isImportFound);
        assert_1.default.strictEqual(1, importResult.resolvedUris.filter((f) => f.getFilePath() === (0, pathUtils_1.combinePaths)('/src/nested', 'file1.py')).length);
    });
    test("don't walk up the root", () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', 'file1.py'),
                content: 'def test1(): ...',
            },
        ];
        const importResult = getImportResult(files, ['notExist'], (c) => (c.projectRoot = uri_1.Uri.empty()));
        (0, assert_1.default)(!importResult.isImportFound);
    });
    test('nested namespace package 1', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages1', 'a', 'b', 'c', 'd.py'),
                content: 'def f(): pass',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages1', 'a', '__init__.py'),
                content: '',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages2', 'a', '__init__.py'),
                content: '',
            },
        ];
        const importResult = getImportResult(files, ['a', 'b', 'c', 'd'], (config) => {
            config.defaultExtraPaths = [
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages1')),
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages2')),
            ];
        });
        (0, assert_1.default)(importResult.isImportFound);
    });
    test('nested namespace package 2', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages1', 'a', 'b', 'c', 'd.py'),
                content: 'def f(): pass',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages1', 'a', 'b', 'c', '__init__.py'),
                content: '',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages2', 'a', 'b', 'c', '__init__.py'),
                content: '',
            },
        ];
        const importResult = getImportResult(files, ['a', 'b', 'c', 'd'], (config) => {
            config.defaultExtraPaths = [
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages1')),
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages2')),
            ];
        });
        (0, assert_1.default)(importResult.isImportFound);
    });
    test('nested namespace package 3', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages1', 'a', 'b', 'c', 'd.py'),
                content: 'def f(): pass',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages2', 'a', '__init__.py'),
                content: '',
            },
        ];
        const importResult = getImportResult(files, ['a', 'b', 'c', 'd'], (config) => {
            config.defaultExtraPaths = [
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages1')),
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages2')),
            ];
        });
        (0, assert_1.default)(!importResult.isImportFound);
    });
    test('nested namespace package 4', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages1', 'a', 'b', '__init__.py'),
                content: '',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages1', 'a', 'b', 'c.py'),
                content: 'def f(): pass',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages2', 'a', '__init__.py'),
                content: '',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'packages2', 'a', 'b', '__init__.py'),
                content: '',
            },
        ];
        const importResult = getImportResult(files, ['a', 'b', 'c'], (config) => {
            config.defaultExtraPaths = [
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages1')),
                uriUtils_1.UriEx.file((0, pathUtils_1.combinePaths)('/', 'packages2')),
            ];
        });
        (0, assert_1.default)(!importResult.isImportFound);
    });
    test('default workspace importing side by side file', () => {
        const files = [
            {
                path: (0, pathUtils_1.combinePaths)('/', 'src', 'a', 'b', 'file1.py'),
                content: 'import file2',
            },
            {
                path: (0, pathUtils_1.combinePaths)('/', 'src', 'a', 'b', 'file2.py'),
                content: 'def f(): pass',
            },
        ];
        const importResult = getImportResult(files, ['file2'], (config) => {
            config.projectRoot = uri_1.Uri.defaultWorkspace({ isCaseSensitive: () => true });
        });
        (0, assert_1.default)(importResult.isImportFound);
    });
});
if (usingTrueVenv()) {
    describe('Import tests that have to run with a venv', () => {
        test('venv can find imports', () => {
            var _a;
            const files = [
                {
                    path: (0, pathUtils_1.combinePaths)('/', 'file1.py'),
                    content: 'import pytest',
                },
            ];
            const importResult = getImportResult(files, ['pytest']);
            (0, assert_1.default)(importResult.isImportFound, `Import not found: ${(_a = importResult.importFailureInfo) === null || _a === void 0 ? void 0 : _a.join('\n')}`);
        });
    });
}
function getImportResult(files, nameParts, setup) {
    const defaultHostFactory = (sp) => new testAccessHost_1.TestAccessHost(sp.fs().getModulePath(), [uriUtils_1.UriEx.file(libraryRoot)]);
    const defaultSetup = setup !== null && setup !== void 0 ? setup : ((c) => {
        /* empty */
    });
    const defaultSpFactory = (files) => createServiceProviderFromFiles(files);
    // Use environment variables to determine how to create a host and how to modify the config options.
    // These are set in the CI to test imports with different options.
    let hostFactory = defaultHostFactory;
    let configModifier = defaultSetup;
    let spFactory = defaultSpFactory;
    if (process.env.CI_IMPORT_TEST_VENVPATH) {
        configModifier = (c) => {
            defaultSetup(c);
            c.venvPath = uriUtils_1.UriEx.file(process.env.CI_IMPORT_TEST_VENVPATH, 
            /* isCaseSensitive */ true, 
            /* checkRelative */ true);
            c.venv = process.env.CI_IMPORT_TEST_VENV;
        };
        spFactory = (files) => createServiceProviderWithCombinedFs(files);
    }
    else if (process.env.CI_IMPORT_TEST_PYTHONPATH) {
        configModifier = (c) => {
            defaultSetup(c);
            c.pythonPath = uriUtils_1.UriEx.file(process.env.CI_IMPORT_TEST_PYTHONPATH, 
            /* isCaseSensitive */ true, 
            /* checkRelative */ true);
        };
        hostFactory = (sp) => new TruePythonTestAccessHost(sp);
        spFactory = (files) => createServiceProviderWithCombinedFs(files);
    }
    return getImportResultImpl(files, nameParts, spFactory, configModifier, hostFactory);
}
function getImportResultImpl(files, nameParts, spFactory, configModifier, hostFactory) {
    var _a;
    const sp = spFactory(files);
    const configOptions = new configOptions_1.ConfigOptions(uriUtils_1.UriEx.file('/'));
    configModifier(configOptions);
    const file = files.length > 0 ? files[files.length - 1].path : (0, pathUtils_1.combinePaths)('src', 'file.py');
    if (files.length === 0) {
        files.push({
            path: file,
            content: '# not used',
        });
    }
    const uri = uriUtils_1.UriEx.file(file);
    const importResolver = new importResolver_1.ImportResolver(sp, configOptions, hostFactory(sp));
    const importResult = importResolver.resolveImport(uri, configOptions.findExecEnvironment(uri), {
        leadingDots: 0,
        nameParts: nameParts,
        importedSymbols: new Set(),
    });
    // Add the config venvpath to the import result so we can output it on failure.
    if (!importResult.isImportFound) {
        importResult.importFailureInfo = (_a = importResult.importFailureInfo) !== null && _a !== void 0 ? _a : [];
        importResult.importFailureInfo.push(`venvPath: ${configOptions.venvPath}`);
    }
    return importResult;
}
function createTestFileSystem(files) {
    const fs = new filesystem_1.TestFileSystem(/* ignoreCase */ false, { cwd: (0, pathUtils_1.normalizeSlashes)('/') });
    for (const file of files) {
        const path = (0, pathUtils_1.normalizeSlashes)(file.path);
        const dir = (0, pathUtils_1.getDirectoryPath)(path);
        fs.mkdirpSync(dir);
        fs.writeFileSync(uriUtils_1.UriEx.file(path), file.content);
    }
    return fs;
}
function createServiceProviderFromFiles(files) {
    const testFS = createTestFileSystem(files);
    const fs = new pyrightFileSystem_1.PyrightFileSystem(testFS);
    return (0, serviceProviderExtensions_1.createServiceProvider)(testFS, fs);
}
function createServiceProviderWithCombinedFs(files) {
    const testFS = createTestFileSystem(files);
    const fs = new pyrightFileSystem_1.PyrightFileSystem(new CombinedFileSystem(testFS));
    return (0, serviceProviderExtensions_1.createServiceProvider)(testFS, fs);
}
class TruePythonTestAccessHost extends fullAccessHost_1.FullAccessHost {
    constructor(sp) {
        // Make sure the service provide in use is using a real file system and real temporary file provider.
        const clone = sp.clone();
        clone.add(serviceKeys_1.ServiceKeys.fs, (0, realFileSystem_1.createFromRealFileSystem)(sp.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector)));
        clone.add(serviceKeys_1.ServiceKeys.tempFile, new realFileSystem_1.RealTempFile());
        super(clone);
    }
}
class CombinedFileSystem {
    constructor(_testFS) {
        this._testFS = _testFS;
        this._realFS = (0, realFileSystem_1.createFromRealFileSystem)(this._testFS);
    }
    mkdirSync(path, options) {
        this._testFS.mkdirSync(path, options);
    }
    writeFileSync(path, data, encoding) {
        this._testFS.writeFileSync(path, data, encoding);
    }
    unlinkSync(path) {
        this._testFS.unlinkSync(path);
    }
    rmdirSync(path) {
        this._testFS.rmdirSync(path);
    }
    createFileSystemWatcher(paths, listener) {
        return this._testFS.createFileSystemWatcher(paths, listener);
    }
    createReadStream(path) {
        return this._testFS.createReadStream(path);
    }
    createWriteStream(path) {
        return this._testFS.createWriteStream(path);
    }
    copyFileSync(src, dst) {
        this._testFS.copyFileSync(src, dst);
    }
    existsSync(path) {
        return this._testFS.existsSync(path) || this._realFS.existsSync(path);
    }
    chdir(path) {
        this._testFS.chdir(path);
    }
    readdirEntriesSync(path) {
        if (this._testFS.existsSync(path)) {
            return this._testFS.readdirEntriesSync(path);
        }
        return this._realFS.readdirEntriesSync(path);
    }
    readdirSync(path) {
        if (this._testFS.existsSync(path)) {
            return this._testFS.readdirSync(path);
        }
        return this._realFS.readdirSync(path);
    }
    readFileSync(path, encoding = null) {
        if (this._testFS.existsSync(path)) {
            return this._testFS.readFileSync(path, encoding);
        }
        return this._realFS.readFileSync(path, encoding);
    }
    statSync(path) {
        if (this._testFS.existsSync(path)) {
            return this._testFS.statSync(path);
        }
        return this._realFS.statSync(path);
    }
    realpathSync(path) {
        if (this._testFS.existsSync(path)) {
            return this._testFS.realpathSync(path);
        }
        return this._realFS.realpathSync(path);
    }
    getModulePath() {
        return this._testFS.getModulePath();
    }
    readFile(path) {
        if (this._testFS.existsSync(path)) {
            return this._testFS.readFile(path);
        }
        return this._realFS.readFile(path);
    }
    readFileText(path, encoding) {
        if (this._testFS.existsSync(path)) {
            return this._testFS.readFileText(path, encoding);
        }
        return this._realFS.readFileText(path, encoding);
    }
    realCasePath(path) {
        return this._testFS.realCasePath(path);
    }
    isMappedUri(filepath) {
        return this._testFS.isMappedUri(filepath);
    }
    getOriginalUri(mappedFilePath) {
        return this._testFS.getOriginalUri(mappedFilePath);
    }
    getMappedUri(originalFilePath) {
        return this._testFS.getMappedUri(originalFilePath);
    }
    isInZip(path) {
        return this._testFS.isInZip(path);
    }
}
//# sourceMappingURL=importResolver.test.js.map