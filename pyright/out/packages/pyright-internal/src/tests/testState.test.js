"use strict";
/*
 * testState.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Tests and show how to use TestState in unit test
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
const uri_1 = require("../common/uri/uri");
const runner_1 = require("./harness/fourslash/runner");
const testState_1 = require("./harness/fourslash/testState");
const factory = __importStar(require("./harness/vfs/factory"));
test('Create', () => {
    const code = `
// @filename: file1.py
////class A:
////    pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    (0, assert_1.default)(state.activeFile === data.files[0]);
});
test('Multiple files', () => {
    const code = `
// @filename: file1.py
////class A:
////    pass

// @filename: file2.py
////class B:
////    pass

// @filename: file3.py
////class C:
////    pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, factory.srcFolder).state;
    assert_1.default.equal(state.cwd(), (0, pathUtils_1.normalizeSlashes)('/'));
    (0, assert_1.default)(state.fs.existsSync(uri_1.Uri.file((0, pathUtils_1.normalizeSlashes)((0, pathUtils_1.combinePaths)(factory.srcFolder, 'file1.py')), state.serviceProvider)));
});
test('Configuration', () => {
    var _a;
    const code = `
// @filename: pyrightconfig.json
//// {
////   "include": [
////     "src"
////   ],
////
////   "exclude": [
////     "**/node_modules",
////     "**/__pycache__",
////     "src/experimental",
////     "src/web/node_modules",
////     "src/typestubs"
////   ],
////
////   "ignore": [
////     "src/oldstuff"
////   ],
////
////   "typingsPath": "src/typestubs",
////   "venvPath": "/home/foo/.venvs",
////
////   "reportMissingImports": true,
////   "reportMissingTypeStubs": false,
////
////   "pythonVersion": "3.6",
////   "pythonPlatform": "Linux",
////
////   "executionEnvironments": [
////     {
////       "root": "src/web",
////       "pythonVersion": "3.5",
////       "pythonPlatform": "Windows",
////       "extraPaths": [
////         "src/service_libs"
////       ]
////     },
////     {
////       "root": "src/sdk",
////       "pythonVersion": "3.0",
////       "extraPaths": [
////         "src/backend"
////       ],
////       "venv": "venv_bar"
////     },
////     {
////       "root": "src/tests",
////       "extraPaths": [
////         "src/tests/e2e",
////         "src/sdk"
////       ]
////     },
////     {
////       "root": "src"
////     }
////   ]
//// }

// @filename: file1.py
////class A:
////    pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, factory.srcFolder).state;
    assert_1.default.equal(state.cwd(), (0, pathUtils_1.normalizeSlashes)('/'));
    (0, assert_1.default)(state.fs.existsSync(uri_1.Uri.file((0, pathUtils_1.normalizeSlashes)((0, pathUtils_1.combinePaths)(factory.srcFolder, 'file1.py')), state.serviceProvider)));
    assert_1.default.equal(state.configOptions.diagnosticRuleSet.reportMissingImports, 'error');
    assert_1.default.equal(state.configOptions.diagnosticRuleSet.reportMissingModuleSource, 'warning');
    assert_1.default.equal((_a = state.configOptions.stubPath) === null || _a === void 0 ? void 0 : _a.getFilePath(), (0, pathUtils_1.normalizeSlashes)('/src/typestubs'));
});
test('stubPath configuration', () => {
    var _a;
    const code = `
// @filename: pyrightconfig.json
//// {
////   "stubPath": "src/typestubs"
//// }
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    assert_1.default.equal((_a = state.configOptions.stubPath) === null || _a === void 0 ? void 0 : _a.getFilePath(), (0, pathUtils_1.normalizeSlashes)('/src/typestubs'));
});
test('Duplicated stubPath configuration', () => {
    var _a;
    const code = `
// @filename: pyrightconfig.json
//// {
////   "typingsPath": "src/typestubs1",
////   "stubPath": "src/typestubs2"
//// }
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    assert_1.default.equal((_a = state.configOptions.stubPath) === null || _a === void 0 ? void 0 : _a.getFilePath(), (0, pathUtils_1.normalizeSlashes)('/src/typestubs2'));
});
test('ProjectRoot', () => {
    const code = `
// global options
// @projectRoot: /root

// @filename: /root/file1.py
////class A:
////    pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    assert_1.default.equal(state.cwd(), (0, pathUtils_1.normalizeSlashes)('/root'));
    (0, assert_1.default)(state.fs.existsSync(uri_1.Uri.file((0, pathUtils_1.normalizeSlashes)('/root/file1.py'), state.serviceProvider)));
    assert_1.default.equal(state.configOptions.projectRoot.getFilePath(), (0, pathUtils_1.normalizeSlashes)('/root'));
});
test('CustomTypeshedFolder', () => {
    // use differnt physical folder as typeshed folder. this is different than
    // typeshed folder settings in config json file since that points to a path
    // in virtual file system. not physical one. this decides which physical folder
    // those virtual folder will mount to.
    const code = `
// global options
// @typeshed: ${__dirname}
    `;
    // mount the folder this file is in as typeshed folder and check whether
    // in typeshed folder in virtual file system, this file exists.
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    (0, assert_1.default)(state.fs.existsSync(factory.typeshedFolder.combinePaths((0, pathUtils_1.getFileName)(__filename))));
});
test('IgnoreCase', () => {
    const code = `
// global options
// @ignoreCase: true

// @filename: file1.py
////class A:
////    pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code, factory.srcFolder).state;
    (0, assert_1.default)(state.fs.existsSync(uri_1.Uri.file((0, pathUtils_1.normalizeSlashes)((0, pathUtils_1.combinePaths)(factory.srcFolder, 'FILE1.py')), state.serviceProvider)));
});
test('GoToMarker', () => {
    const code = `
////class A:
////    /*marker1*/pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const marker = data.markerPositions.get('marker1');
    state.goToMarker('marker1');
    assert_1.default.equal(state.lastKnownMarker, 'marker1');
    assert_1.default.equal(state.currentCaretPosition, marker.position);
    state.goToMarker(marker);
    assert_1.default.equal(state.lastKnownMarker, 'marker1');
    assert_1.default.equal(state.currentCaretPosition, marker.position);
    assert_1.default.equal(state.selectionEnd, -1);
});
test('GoToEachMarker', () => {
    const code = `
// @filename: file1.py
////class A:
////    /*marker1*/pass

// @filename: file2.py
////class B:
////    /*marker2*/pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const marker1 = data.markerPositions.get('marker1');
    const marker2 = data.markerPositions.get('marker2');
    const results = [];
    state.goToEachMarker([marker1, marker2], (m) => {
        results.push(m.position);
    });
    assert_1.default.deepEqual(results, [marker1.position, marker2.position]);
    assert_1.default.equal(state.activeFile.fileName, marker2.fileName);
    assert_1.default.equal(state.currentCaretPosition, marker2.position);
    assert_1.default.equal(state.selectionEnd, -1);
});
test('Markers', () => {
    const code = `
// @filename: file1.py
////class A:
////    /*marker1*/pass

// @filename: file2.py
////class B:
////    /*marker2*/pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const marker1 = data.markerPositions.get('marker1');
    assert_1.default.deepEqual(state.getMarkerName(marker1), 'marker1');
    assert_1.default.deepEqual(state
        .getMarkers()
        .map((m) => state.getMarkerName(m))
        .sort(stringUtils_1.compareStringsCaseSensitive), state.getMarkerNames().sort(stringUtils_1.compareStringsCaseSensitive));
});
test('GoToPosition', () => {
    const code = `
// @filename: file1.py
////class A:
////    /*marker1*/pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const marker1 = data.markerPositions.get('marker1');
    state.goToPosition(marker1.position);
    assert_1.default.equal(state.currentCaretPosition, marker1.position);
    assert_1.default.equal(state.selectionEnd, -1);
});
test('select', () => {
    const code = `
// @filename: file1.py
/////*start*/class A:
////    class B:
////        def Test(self):
////            pass
////
////    def Test2(self):
////        pass/*end*/
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    state.select('start', 'end');
    assert_1.default.equal(state.currentCaretPosition, data.markerPositions.get('start').position);
    assert_1.default.equal(state.selectionEnd, data.markerPositions.get('end').position);
});
test('selectAllInFile', () => {
    const code = `
// @filename: file1.py
/////*start*/class A:
////    class B:
////        def Test(self):
////            pass
////
////    def Test2(self):
////        pass/*end*/
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    state.selectAllInFile(data.files[0].fileName);
    assert_1.default.equal(state.currentCaretPosition, data.markerPositions.get('start').position);
    assert_1.default.equal(state.selectionEnd, data.markerPositions.get('end').position);
});
test('selectRange', () => {
    const code = `
// @filename: file1.py
/////class A:
////    class B:
////        [|def Test(self):
////            pass|]
////
////    def Test2(self):
////        pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const range = data.ranges[0];
    state.selectRange(range);
    assert_1.default.equal(state.activeFile.fileName, range.fileName);
    assert_1.default.equal(state.currentCaretPosition, range.pos);
    assert_1.default.equal(state.selectionEnd, range.end);
});
test('selectLine', () => {
    const code = `
// @filename: file1.py
/////class A:
////    class B:
////[|        def Test(self):|]
////            pass
////
////    def Test2(self):
////        pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const range = data.ranges[0];
    state.selectLine(2);
    assert_1.default.equal(state.currentCaretPosition, range.pos);
    assert_1.default.equal(state.selectionEnd, range.end);
});
test('goToEachRange', () => {
    const code = `
// @filename: file1.py
/////class A:
////    class B:
////        [|def Test(self):|]
////            pass
////
////    def Test2(self):
////        [|pass|]
    `;
    const { state } = (0, testState_1.parseAndGetTestState)(code);
    const results = [];
    state.goToEachRange((r) => {
        assert_1.default.equal(state.activeFile.fileName, r.fileName);
        results.push(r);
    });
    assert_1.default.deepEqual(results, [state.getRanges()[0], state.getRanges()[1]]);
});
test('getRangesInFile', () => {
    const code = `
// @filename: file1.py
/////class A:
////    class B:
////        [|def Test(self):|]
////            pass

// @filename: file2.py
////    def Test2(self):
////        [|pass|]
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    assert_1.default.deepEqual(state.getRangesInFile(data.files[0].fileName), data.ranges.filter((r) => r.fileName === data.files[0].fileName));
});
test('rangesByText', () => {
    const code = `
// @filename: file1.py
/////class A:
////    class B:
////        [|def Test(self):|]
////            pass

// @filename: file2.py
////    def Test2(self):
////        [|pass|]
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const map = state.getRangesByText();
    assert_1.default.deepEqual(map.get('def Test(self):'), [data.ranges[0]]);
    assert_1.default.deepEqual(map.get('pass'), [data.ranges[1]]);
});
test('moveCaretRight', () => {
    const code = `
// @filename: file1.py
/////class A:
////    class B:
////        /*position*/def Test(self):
////            pass
////
////    def Test2(self):
////        pass
    `;
    const { data, state } = (0, testState_1.parseAndGetTestState)(code);
    const marker = data.markerPositions.get('position');
    state.goToBOF();
    assert_1.default.equal(state.currentCaretPosition, 0);
    state.goToEOF();
    assert_1.default.equal(state.currentCaretPosition, data.files[0].content.length);
    state.goToPosition(marker.position);
    state.moveCaretRight('def'.length);
    assert_1.default.equal(state.currentCaretPosition, marker.position + 'def'.length);
    assert_1.default.equal(state.selectionEnd, -1);
});
test('runFourSlashTestContent', () => {
    const code = `
/// <reference path="fourslash.d.ts" />

// @filename: file1.py
//// class A:
////    class B:
////        /*position*/def Test(self):
////            pass
////
////    def Test2(self):
////        pass

helper.getMarkerByName("position");
    `;
    (0, runner_1.runFourSlashTestContent)((0, pathUtils_1.normalizeSlashes)('/'), 'unused.py', code);
});
test('VerifyDiagnosticsTest1', () => {
    const code = `
/// <reference path="fourslash.d.ts" />

// @filename: dataclass1.py
//// # This sample validates the Python 3.7 data class feature.
////
//// from typing import NamedTuple, Optional
////
//// class Other:
////     pass
////
//// class DataTuple(NamedTuple):
////     def _m(self):
////         pass
////     id: int
////     aid: Other
////     valll: str = ''
////     name: Optional[str] = None
////
//// d1 = DataTuple(id=1, aid=Other())
//// d2 = DataTuple(id=1, aid=Other(), valll='v')
//// d3 = DataTuple(id=1, aid=Other(), name='hello')
//// d4 = DataTuple(id=1, aid=Other(), name=None)
//// id = d1.id
////
//// # This should generate an error because the name argument
//// # is the incorrect type.
//// d5 = DataTuple(id=1, aid=Other(), name=[|{|"category": "error"|}3|])
////
//// # This should generate an error because aid is a required
//// # parameter and is missing an argument here.
//// d6 = [|{|"category": "error"|}DataTuple(id=1, name=None|])

helper.verifyDiagnostics();
    `;
    (0, runner_1.runFourSlashTestContent)(factory.srcFolder, 'unused.py', code);
});
test('VerifyDiagnosticsTest2', () => {
    const code = `
/// <reference path="fourslash.ts" />

//// # This sample tests the handling of the @dataclass decorator.
////
//// from dataclasses import dataclass, InitVar
////
//// @dataclass
//// class Bar():
////     bbb: int
////     ccc: str
////     aaa = 'string'
////
//// bar1 = Bar(bbb=5, ccc='hello')
//// bar2 = Bar(5, 'hello')
//// bar3 = Bar(5, 'hello', 'hello2')
//// print(bar3.bbb)
//// print(bar3.ccc)
//// print(bar3.aaa)
////
//// # This should generate an error because ddd
//// # isn't a declared value.
//// bar = Bar(bbb=5, [|/*marker1*/ddd|]=5, ccc='hello')
////
//// # This should generate an error because the
//// # parameter types don't match.
//// bar = Bar([|/*marker2*/'hello'|], 'goodbye')
////
//// # This should generate an error because a parameter
//// # is missing.
//// bar = [|/*marker3*/Bar(2)|]
////
//// # This should generate an error because there are
//// # too many parameters.
//// bar = Bar(2, 'hello', 'hello', [|/*marker4*/4|])
////
////
//// @dataclass
//// class Baz1():
////     bbb: int
////     aaa = 'string'
////
////     # This should generate an error because variables
////     # with no default cannot come after those with
////     # defaults.
////     [|/*marker5*/ccc|]: str
////
//// @dataclass
//// class Baz2():
////     aaa: str
////     ddd: InitVar[int] = 3

helper.verifyDiagnostics({
    "marker1": { category: "error", message: "No parameter named 'ddd'" },
    "marker2": { category: "error", message: "Argument of type 'Literal['hello']' cannot be assigned to parameter 'bbb' of type 'int'\\n  'str' is incompatible with 'int'" },
    "marker3": { category: "error", message: "Argument missing for parameter 'ccc'" },
    "marker4": { category: "error", message: "Expected 3 positional arguments" },
    "marker5": { category: "error", message: "Data fields without default value cannot appear after data fields with default values" },
});
    `;
    (0, runner_1.runFourSlashTestContent)(factory.srcFolder, 'unused.py', code);
});
//# sourceMappingURL=testState.test.js.map