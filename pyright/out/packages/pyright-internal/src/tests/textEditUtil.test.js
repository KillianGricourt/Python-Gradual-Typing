"use strict";
/*
 * textEditUtil.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const editAction_1 = require("../common/editAction");
const textEditTracker_1 = require("../common/textEditTracker");
const testState_1 = require("./harness/fourslash/testState");
const testStateUtils_1 = require("./testStateUtils");
test('simple add', () => {
    const code = `
//// import [|{|"r":"bar"|}foo|]
    `;
    verifyEdits(code);
});
test('multiple edits', () => {
    const code = `
//// import [|{|"r":"bar"|}foo|][|{|"r":"!n!import os"|}|]
    `;
    verifyEdits(code);
});
test('delete and add', () => {
    const code = `
//// [|{|"r":""|}import foo|][|{|"r":"import os"|}|]
    `;
    verifyEdits(code);
});
test('overlapped delete', () => {
    const code = `
//// [|{|"e":""|}[|{|"r":""|}import [|{|"r":""|}foo|]|]|]
    `;
    verifyEdits(code);
});
test('overlapped delete and add', () => {
    const code = `
//// [|{|"r":""|}import foo[|{|"r":"!n!import os"|}|]
//// |]
    `;
    verifyEdits(code);
});
test('dup with same range', () => {
    const code = `
//// [|{|"e":"import os"|}[|{|"r":"import os"|}[|{|"r":"import os"|}import foo|]|]|]
    `;
    verifyEdits(code);
});
test('delete and add with merge', () => {
    const code = `
//// [|{|"e":"import os"|}[|{|"r":""|}import foo|][|{|"r":"import os"|}|]|]
    `;
    verifyEdits(code, false);
});
test('overlapped delete with merge', () => {
    const code = `
//// [|{|"e":""|}[|{|"r":""|}import [|{|"r":""|}foo|]|]|]
    `;
    verifyEdits(code, false);
});
test('overlapped delete and add with merge', () => {
    const code = `
//// [|{|"e":"!n!import os"|}[|{|"r":""|}import foo[|{|"r":"!n!import os"|}|]
//// |]|]
    `;
    verifyEdits(code, false);
});
test('dup with overlapped range', () => {
    const code = `
//// [|{|"e":"import os"|}[|{|"r":""|}import sys!n!|][|{|"r":"import os"|}[|{|"r":"import os"|}import foo|]|]|]
    `;
    verifyEdits(code, false);
});
test('handle comments', () => {
    const code = `
//// from os import (
////      abort[|{|"e":""|},|] # comment[|{|"e":""|}
////      [|{|"r":""|}access|]|]
////      )
    `;
    verifyRemoveNodes(code);
});
function verifyRemoveNodes(code) {
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const tracker = new textEditTracker_1.TextEditTracker();
    const ranges = state.getRanges();
    const changeRanges = _getChangeRanges(ranges);
    for (const range of changeRanges) {
        const parseFileResults = state.program.getParseResults(range.fileUri);
        const node = (0, parseTreeUtils_1.findNodeByOffset)(parseFileResults.parserOutput.parseTree, range.pos);
        tracker.removeNodes({ node, parseFileResults });
    }
    const edits = tracker.getEdits(vscode_jsonrpc_1.CancellationToken.None);
    const editRanges = _getEditRanges(ranges);
    assert_1.default.strictEqual(edits.length, editRanges.length);
    (0, assert_1.default)(_areEqual(edits, editRanges.map((r) => _createFileActionEdit(state, r))));
}
function verifyEdits(code, mergeOnlyDuplications = true) {
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const tracker = new textEditTracker_1.TextEditTracker(mergeOnlyDuplications);
    const ranges = state.getRanges();
    const changeRanges = _getChangeRanges(ranges);
    for (const range of changeRanges) {
        const edit = (0, testStateUtils_1.convertRangeToFileEditAction)(state, range);
        tracker.addEdit(edit.fileUri, edit.range, edit.replacementText);
    }
    const edits = tracker.getEdits(vscode_jsonrpc_1.CancellationToken.None);
    const editRanges = _getEditRanges(ranges);
    assert_1.default.strictEqual(edits.length, editRanges.length);
    (0, assert_1.default)(_areEqual(edits, editRanges.map((r) => _createFileActionEdit(state, r))));
}
function _getChangeRanges(ranges) {
    return ranges.filter((r) => { var _a; return ((_a = r.marker) === null || _a === void 0 ? void 0 : _a.data) && r.marker.data.r !== undefined; });
}
function _getEditRanges(ranges) {
    const editRanges = ranges.filter((r) => { var _a; return ((_a = r.marker) === null || _a === void 0 ? void 0 : _a.data) && r.marker.data.e !== undefined; });
    return editRanges.length > 0 ? editRanges : _getChangeRanges(ranges);
}
function _areEqual(a1, a2) {
    return a1.some((e1) => a2.some((e2) => editAction_1.FileEditAction.areEqual(e1, e2)));
}
function _createFileActionEdit(state, range) {
    const replacementText = range.marker.data.e;
    return (0, testStateUtils_1.convertRangeToFileEditAction)(state, range, replacementText);
}
//# sourceMappingURL=textEditUtil.test.js.map