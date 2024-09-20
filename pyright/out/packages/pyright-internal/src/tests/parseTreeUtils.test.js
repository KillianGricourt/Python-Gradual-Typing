"use strict";
/*
 * parseTreeUtils.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for parseTreeUtils module.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const textRange_1 = require("../common/textRange");
const parseNodes_1 = require("../parser/parseNodes");
const testState_1 = require("./harness/fourslash/testState");
test('isImportModuleName', () => {
    const code = `
//// import [|/*marker*/os|]
    `;
    (0, assert_1.default)((0, parseTreeUtils_1.isImportModuleName)((0, testState_1.getNodeAtMarker)(code)));
});
test('isImportAlias', () => {
    const code = `
//// import os as [|/*marker*/os|]
    `;
    (0, assert_1.default)((0, parseTreeUtils_1.isImportAlias)((0, testState_1.getNodeAtMarker)(code)));
});
test('isFromImportModuleName', () => {
    const code = `
//// from [|/*marker*/os|] import path
    `;
    (0, assert_1.default)((0, parseTreeUtils_1.isFromImportModuleName)((0, testState_1.getNodeAtMarker)(code)));
});
test('isFromImportName', () => {
    const code = `
//// from . import [|/*marker*/os|]
    `;
    (0, assert_1.default)((0, parseTreeUtils_1.isFromImportName)((0, testState_1.getNodeAtMarker)(code)));
});
test('isFromImportAlias', () => {
    const code = `
//// from . import os as [|/*marker*/os|]
    `;
    (0, assert_1.default)((0, parseTreeUtils_1.isFromImportAlias)((0, testState_1.getNodeAtMarker)(code)));
});
test('getFirstAncestorOrSelfOfKind', () => {
    const code = `
//// import a.b.c
//// a.b.c.function(
////     1 + 2 + 3,
////     [|/*result*/a.b.c.function2(
////         [|/*marker*/"name"|]
////     )|]
//// )
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const node = (0, parseTreeUtils_1.getFirstAncestorOrSelfOfKind)((0, testState_1.getNodeAtMarker)(state), 9 /* ParseNodeType.Call */);
    (0, assert_1.default)(node);
    const result = state.getRangeByMarkerName('result');
    (0, assert_1.default)(node.nodeType === 9 /* ParseNodeType.Call */);
    (0, assert_1.default)(node.start === result.pos);
    (0, assert_1.default)(textRange_1.TextRange.getEnd(node) === result.end);
});
test('getDottedNameWithGivenNodeAsLastName', () => {
    const code = `
//// [|/*result1*/[|/*marker1*/a|]|]
//// [|/*result2*/a.[|/*marker2*/b|]|]
//// [|/*result3*/a.b.[|/*marker3*/c|]|]
//// [|/*result4*/a.[|/*marker4*/b|]|].c
//// [|/*result5*/[|/*marker5*/a|]|].b.c
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    for (let i = 1; i <= 5; i++) {
        const markerName = 'marker' + i;
        const resultName = 'result' + i;
        const node = (0, parseTreeUtils_1.getDottedNameWithGivenNodeAsLastName)((0, testState_1.getNodeAtMarker)(state, markerName));
        const result = state.getRangeByMarkerName(resultName);
        (0, assert_1.default)(node.nodeType === 38 /* ParseNodeType.Name */ || node.nodeType === 35 /* ParseNodeType.MemberAccess */);
        (0, assert_1.default)(node.start === result.pos);
        (0, assert_1.default)(textRange_1.TextRange.getEnd(node) === result.end);
    }
});
test('getDottedName', () => {
    const code = `
//// [|/*marker1*/a|]
//// [|/*marker2*/a.b|]
//// [|/*marker3*/a.b.c|]
//// [|/*marker4*/a.b|].c
//// [|/*marker5*/a|].b.c
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    assert_1.default.strictEqual(getDottedNameString('marker1'), 'a');
    assert_1.default.strictEqual(getDottedNameString('marker2'), 'a.b');
    assert_1.default.strictEqual(getDottedNameString('marker3'), 'a.b.c');
    assert_1.default.strictEqual(getDottedNameString('marker4'), 'a.b');
    assert_1.default.strictEqual(getDottedNameString('marker5'), 'a');
    function getDottedNameString(marker) {
        var _a;
        const node = (0, testState_1.getNodeForRange)(state, marker);
        return (_a = (0, parseTreeUtils_1.getDottedName)(node)) === null || _a === void 0 ? void 0 : _a.map((n) => n.value).join('.');
    }
});
test('getFirstNameOfDottedName', () => {
    const code = `
//// [|/*marker1*/a|]
//// [|/*marker2*/a.b|]
//// [|/*marker3*/a.b.c|]
//// [|/*marker4*/a.b|].c
//// [|/*marker5*/a|].b.c
        `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    assert_1.default.strictEqual(getDottedNameString('marker1'), 'a');
    assert_1.default.strictEqual(getDottedNameString('marker2'), 'a');
    assert_1.default.strictEqual(getDottedNameString('marker3'), 'a');
    assert_1.default.strictEqual(getDottedNameString('marker4'), 'a');
    assert_1.default.strictEqual(getDottedNameString('marker5'), 'a');
    function getDottedNameString(marker) {
        var _a, _b;
        const node = (0, testState_1.getNodeForRange)(state, marker);
        return (_b = (_a = (0, parseTreeUtils_1.getFirstNameOfDottedName)(node)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : '';
    }
});
test('isLastNameOfDottedName', () => {
    const code = `
//// [|/*marker1*/a|]
//// a.[|/*marker2*/b|]
//// a.b.[|/*marker3*/c|]
//// a.[|/*marker4*/b|].c
//// [|/*marker5*/a|].b.c
//// (a).[|/*marker6*/b|]
//// (a.b).[|/*marker7*/c|]
//// a().[|/*marker8*/b|]
//// a[0].[|/*marker9*/b|]
//// a.b([|/*marker10*/c|]).d
//// a.b.([|/*marker11*/c|])
//// a.[|/*marker12*/b|].c()
//// a.[|/*marker13*/b|]()
//// a.[|/*marker14*/b|][]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker1')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker2')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker3')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker4')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker5')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker6')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker7')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker8')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker9')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker10')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker11')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker12')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker13')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isLastNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker14')), true);
});
test('isFirstNameOfDottedName', () => {
    const code = `
//// [|/*marker1*/a|]
//// a.[|/*marker2*/b|]
//// a.b.[|/*marker3*/c|]
//// a.[|/*marker4*/b|].c
//// [|/*marker5*/a|].b.c
//// ([|/*marker6*/a|]).b
//// (a.b).[|/*marker7*/c|]
//// [|/*marker8*/a|]().b
//// a[0].[|/*marker9*/b|]
//// a.b([|/*marker10*/c|]).d
//// a.b.([|/*marker11*/c|])
//// a.[|/*marker12*/b|].c()
//// [|/*marker13*/a|].b()
//// a.[|/*marker14*/b|][]
//// [|/*marker15*/a|][]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker1')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker2')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker3')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker4')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker5')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker6')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker7')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker8')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker9')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker10')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker11')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker12')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker13')), true);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker14')), false);
    assert_1.default.strictEqual((0, parseTreeUtils_1.isFirstNameOfDottedName)((0, testState_1.getNodeAtMarker)(state, 'marker15')), true);
});
test('getStringNodeValueRange', () => {
    const code = `
//// a = "[|/*marker1*/test|]"
//// b = '[|/*marker2*/test2|]'
//// c = '''[|/*marker3*/test3|]'''
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    for (let i = 1; i <= 3; i++) {
        const markerName = 'marker' + i;
        const range = (0, parseTreeUtils_1.getStringNodeValueRange)((0, testState_1.getNodeAtMarker)(state, markerName));
        const result = state.getRangeByMarkerName(markerName);
        (0, assert_1.default)(range.start === result.pos);
        (0, assert_1.default)(textRange_1.TextRange.getEnd(range) === result.end);
    }
});
test('getFullStatementRange', () => {
    const code = `
//// [|/*marker1*/import a
//// |][|/*marker2*/a = 1; |][|/*marker3*/b = 2
//// |]
//// try:
//// [|    /*marker4*/a = 1
//// |]except Exception:
////     pass
//// [|/*marker5*/if True:
////     pass|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    testNodeRange(state, 'marker1', 23 /* ParseNodeType.Import */);
    testNodeRange(state, 'marker2', 3 /* ParseNodeType.Assignment */);
    testNodeRange(state, 'marker3', 3 /* ParseNodeType.Assignment */);
    testNodeRange(state, 'marker4', 3 /* ParseNodeType.Assignment */);
    testNodeRange(state, 'marker5', 22 /* ParseNodeType.If */);
});
test('getFullStatementRange with trailing blank lines', () => {
    const code = `
//// [|/*marker*/def foo():
////     return 1
////
//// |]def bar():
////     pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    testNodeRange(state, 'marker', 31 /* ParseNodeType.Function */, true);
});
test('getFullStatementRange with only trailing blank lines', () => {
    const code = `
//// [|/*marker*/def foo():
////     return 1
//// |]
//// 
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    testNodeRange(state, 'marker', 31 /* ParseNodeType.Function */, true);
});
test('printExpression', () => {
    const code = `
//// [|/*marker1*/not x|]
//// [|/*marker2*/+x|]
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    checkExpression('marker1', 'not x');
    checkExpression('marker2', '+x');
    function checkExpression(marker, expected) {
        const node = (0, testState_1.getNodeAtMarker)(state, marker);
        (0, assert_1.default)((0, parseNodes_1.isExpressionNode)(node));
        assert_1.default.strictEqual((0, parseTreeUtils_1.printExpression)(node), expected);
    }
});
test('findNodeByOffset', () => {
    const code = `
//// class A:
////     def read(self): pass
////
//// class B(A):
////     x1 = 1
////     def r[|/*marker*/|]
////
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const sourceFile = state.program.getBoundSourceFile(range.marker.fileUri);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(sourceFile.getParseResults().parserOutput.parseTree, range.pos);
    assert_1.default.strictEqual(node === null || node === void 0 ? void 0 : node.nodeType, 38 /* ParseNodeType.Name */);
    assert_1.default.strictEqual(node.value, 'r');
});
test('findNodeByOffset with binary search', () => {
    const code = `
//// class A:
////     def read(self): pass
////
//// class B(A):
////     x1 = 1
////     x2 = 2
////     x3 = 3
////     x4 = 4
////     x5 = 5
////     x6 = 6
////     x7 = 7
////     x8 = 8
////     x9 = 9
////     x10 = 10
////     x11 = 11
////     x12 = 12
////     x13 = 13
////     x14 = 14
////     x15 = 15
////     x16 = 16
////     x17 = 17
////     x18 = 18
////     x19 = 19
////     def r[|/*marker*/|]
////
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const sourceFile = state.program.getBoundSourceFile(range.marker.fileUri);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(sourceFile.getParseResults().parserOutput.parseTree, range.pos);
    assert_1.default.strictEqual(node === null || node === void 0 ? void 0 : node.nodeType, 38 /* ParseNodeType.Name */);
    assert_1.default.strictEqual(node.value, 'r');
});
test('findNodeByOffset with binary search choose earliest match', () => {
    const code = `
//// class A:
////     def read(self): pass
////
//// class B(A):
////     x1 = 1
////     x2 = 2
////     x3 = 3
////     x4 = 4
////     x5 = 5
////     x6 = 6
////     x7 = 7
////     x8 = 8
////     x9 = 9
////     x10 = 10
////     x11 = 11
////     x12 = 12
////     x13 = 13
////     x14 = 14
////     x15 = 15
////     x16 = 16
////     x17 = 17
////     x18 = 18
////     x19 = 19
////     def r[|/*marker*/|]
////     x20 = 20
////     x21 = 21
////
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const range = state.getRangeByMarkerName('marker');
    const sourceFile = state.program.getBoundSourceFile(range.marker.fileUri);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(sourceFile.getParseResults().parserOutput.parseTree, range.pos);
    assert_1.default.strictEqual(node === null || node === void 0 ? void 0 : node.nodeType, 38 /* ParseNodeType.Name */);
    assert_1.default.strictEqual(node.value, 'r');
});
function testNodeRange(state, markerName, type, includeTrailingBlankLines = false) {
    const range = state.getRangeByMarkerName(markerName);
    const sourceFile = state.program.getBoundSourceFile(range.marker.fileUri);
    const statementNode = (0, parseTreeUtils_1.getFirstAncestorOrSelfOfKind)((0, testState_1.getNodeAtMarker)(state, markerName), type);
    const statementRange = (0, parseTreeUtils_1.getFullStatementRange)(statementNode, sourceFile.getParseResults(), {
        includeTrailingBlankLines,
    });
    const expectedRange = state.convertPositionRange(range);
    (0, assert_1.default)((0, textRange_1.rangesAreEqual)(expectedRange, statementRange));
}
//# sourceMappingURL=parseTreeUtils.test.js.map