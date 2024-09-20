"use strict";
/*
 * service.test.ts
 *
 * service tests.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const sourceFile_1 = require("../analyzer/sourceFile");
const pathUtils_1 = require("../common/pathUtils");
const testState_1 = require("./harness/fourslash/testState");
const uri_1 = require("../common/uri/uri");
test('random library file changed', () => {
    const state = (0, testState_1.parseAndGetTestState)('', '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/site-packages/test.py', state.serviceProvider), [uri_1.Uri.file('/site-packages', state.serviceProvider)]), true);
});
test('random library file starting with . changed', () => {
    const state = (0, testState_1.parseAndGetTestState)('', '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/site-packages/.test.py', state.serviceProvider), [uri_1.Uri.file('/site-packages', state.serviceProvider)]), false);
});
test('random library file changed, nested search paths', () => {
    const state = (0, testState_1.parseAndGetTestState)('', '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/lib/.venv/site-packages/myFile.py', state.serviceProvider), [uri_1.Uri.file('/lib', state.serviceProvider), uri_1.Uri.file('/lib/.venv/site-packages', state.serviceProvider)]), true);
});
test('random library file changed, nested search paths, fs is not case sensitive', () => {
    const code = `
// global options
// @ignoreCase: true
        `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/lib/.venv/site-packages/myFile.py', state.serviceProvider), [uri_1.Uri.file('/lib', state.serviceProvider), uri_1.Uri.file('/LIB/.venv/site-packages', state.serviceProvider)]), true);
});
test('random library file changed, nested search paths, fs is case sensitive', () => {
    const code = `
// global options
// @ignoreCase: false
        `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/lib/.venv/site-packages/myFile.py', state.serviceProvider), [uri_1.Uri.file('/lib', state.serviceProvider), uri_1.Uri.file('/LIB/.venv/site-packages', state.serviceProvider)]), false);
});
test('random library file starting with . changed, fs is not case sensitive', () => {
    const code = `
// global options
// @ignoreCase: true
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/lib/.test.py', state.serviceProvider), [uri_1.Uri.file('/LIB', state.serviceProvider), uri_1.Uri.file('/lib/site-packages', state.serviceProvider)]), false);
});
test('random library file starting with . changed, fs is case sensitive', () => {
    const code = `
// global options
// @ignoreCase: false
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/lib/.test.py', state.serviceProvider), [uri_1.Uri.file('/LIB', state.serviceProvider), uri_1.Uri.file('/lib/site-packages', state.serviceProvider)]), true);
});
test('random library file under a folder starting with . changed', () => {
    const state = (0, testState_1.parseAndGetTestState)('', '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleLibraryFileWatchChanges(uri_1.Uri.file('/site-packages/.testFolder/test.py', state.serviceProvider), [uri_1.Uri.file('/site-packages', state.serviceProvider)]), false);
});
test('basic file change', () => {
    const code = `
// @filename: test.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code);
});
test('non python file', () => {
    const code = `
// @filename: test.pyc
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ false);
});
test('temp file', () => {
    const code = `
// @filename: test.py.12345678901234567890123456789012.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ false);
});
test('excluded file', () => {
    const code = `
// @filename: pyrightconfig.json
//// {
////   "exclude": ["**/excluded.py"]
//// }

// @filename: included.py
//// # empty

// @filename: excluded.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ false);
});
test('excluded but still part of program', () => {
    const code = `
// @filename: pyrightconfig.json
//// {
////   "exclude": ["**/excluded.py"]
//// }

// @filename: included.py
//// from . import excluded

// @filename: excluded.py
//// [|/*marker*/|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    const marker = state.getMarkerByName('marker');
    while (state.workspace.service.test_program.analyze())
        ;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleSourceFileWatchChanges(marker.fileUri, /* isFile */ true), true);
});
test('random folder changed', () => {
    const code = `
// @filename: notUsed.py
//// # empty
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleSourceFileWatchChanges(uri_1.Uri.file('/randomFolder', state.serviceProvider), 
    /* isFile */ false), false);
});
test('excluded folder changed', () => {
    const code = `
// @filename: pyrightconfig.json
//// {
////   "exclude": ["**/.*"]
//// }
    
// @filename: .excluded/notUsed.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ false, /* isFile */ false);
});
test('file under excluded folder changed', () => {
    const code = `
// @filename: pyrightconfig.json
//// {
////   "exclude": ["**/.*"]
//// }
    
// @filename: included.py
//// # empty

// @filename: .excluded/notUsed.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ false);
});
test('folder under excluded folder changed', () => {
    const code = `
// @filename: pyrightconfig.json
//// {
////   "exclude": ["**/.*"]
//// }

// @filename: .excluded/nested/notUsed.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ false, /* isFile */ false);
});
test('folder that contains no file has changed', () => {
    const code = `
// @filename: pyrightconfig.json
//// {
////   "exclude": ["**/excluded.py"]
//// }

// @filename: included.py
//// # empty

// @filename: lib/excluded.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ false, /* isFile */ false);
});
test('folder that contains a file has changed', () => {
    const code = `
// @filename: lib/included.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ true, /* isFile */ false);
});
test('folder that contains no file but whose parent has __init__ has changed', () => {
    const code = `
// @filename: pyrightconfig.json
//// {
////   "exclude": ["**/excluded.py"]
//// }

// @filename: lib/__init__.py
//// # empty

// @filename: lib/nested/excluded.py
//// [|/*marker*/|]
    `;
    testSourceFileWatchChange(code, /* expected */ true, /* isFile */ false);
});
test('program containsSourceFileIn', () => {
    const code = `
// @ignoreCase: true

// @filename: myLib/__init__.py
//// # empty
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    (0, assert_1.default)(state.workspace.service.test_program.containsSourceFileIn(state.activeFile.fileUri));
});
test('service runEditMode', () => {
    const code = `
// @filename: open.py
//// /*open*/

// @filename: closed.py
//// /*closed*/
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    const open = state.getMarkerByName('open');
    const closed = state.getMarkerByName('closed');
    const openUri = open.fileUri;
    const closedUri = closed.fileUri;
    const newFileUri = uri_1.Uri.file((0, pathUtils_1.combinePaths)((0, pathUtils_1.getDirectoryPath)(open.fileName), 'interimFile.py'), state.serviceProvider);
    state.testFS.writeFileSync(newFileUri, '# empty', 'utf8');
    const options = {
        isTracked: true,
        ipythonMode: sourceFile_1.IPythonMode.None,
        chainedFileUri: newFileUri,
    };
    // try run edit mode
    verifyRunEditMode('# first');
    // try run again to make sure things are cleared up correctly
    verifyRunEditMode('# second');
    function verifyRunEditMode(value) {
        var _a, _b;
        state.workspace.service.runEditMode((p) => {
            p.addInterimFile(newFileUri);
            p.setFileOpened(openUri, 0, value, options);
            p.setFileOpened(closedUri, 0, value, options);
            const interim = p.getSourceFileInfo(newFileUri);
            (0, assert_1.default)(interim);
            const openFile = p.getSourceFileInfo(openUri);
            (0, assert_1.default)(openFile);
            (0, assert_1.default)(openFile.isOpenByClient);
            assert_1.default.strictEqual(value, openFile.sourceFile.getFileContent());
            const closedFile = p.getSourceFileInfo(closedUri);
            (0, assert_1.default)(closedFile);
            (0, assert_1.default)(closedFile.isOpenByClient);
            assert_1.default.strictEqual(value, closedFile.sourceFile.getFileContent());
        }, vscode_jsonrpc_1.CancellationToken.None);
        const interim = state.workspace.service.test_program.getSourceFileInfo(newFileUri);
        (0, assert_1.default)(!interim);
        const openFile = state.workspace.service.test_program.getSourceFileInfo(openUri);
        (0, assert_1.default)(openFile);
        (0, assert_1.default)(openFile.isOpenByClient);
        assert_1.default.strictEqual('', (_a = openFile.sourceFile.getFileContent()) === null || _a === void 0 ? void 0 : _a.trim());
        const closedFile = state.workspace.service.test_program.getSourceFileInfo(closedUri);
        (0, assert_1.default)(closedFile);
        (0, assert_1.default)(!closedFile.isOpenByClient);
        const content = (_b = closedFile.sourceFile.getFileContent()) !== null && _b !== void 0 ? _b : '';
        assert_1.default.strictEqual('', content.trim());
    }
});
function testSourceFileWatchChange(code, expected = true, isFile = true) {
    const state = (0, testState_1.parseAndGetTestState)(code, '/projectRoot').state;
    const marker = state.getMarkerByName('marker');
    const path = isFile ? marker.fileName : (0, pathUtils_1.getDirectoryPath)(marker.fileName);
    assert_1.default.strictEqual(state.workspace.service.test_shouldHandleSourceFileWatchChanges(uri_1.Uri.file(path, state.serviceProvider), isFile), expected);
}
//# sourceMappingURL=service.test.js.map