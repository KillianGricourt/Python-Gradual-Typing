"use strict";
/*
 * classDeclaration.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Test class detail's declaration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const declaration_1 = require("../analyzer/declaration");
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const typeUtils_1 = require("../analyzer/typeUtils");
const types_1 = require("../analyzer/types");
const textRange_1 = require("../common/textRange");
const testState_1 = require("./harness/fourslash/testState");
test('regular class', () => {
    const code = `
// @filename: test.py
//// [|class /*marker*/A:
////     pass|]
    `;
    checkClassDetail(code);
});
test('Meta class', () => {
    const code = `
// @filename: test.py
//// [|class /*range*/MyMeta(type):
////     def __new__(cls, name, bases, dct):
////         return super().__new__(cls, name, bases, dct)|]
//// 
//// class MyClass(metaclass=MyMeta):
////     pass
//// 
//// /*marker*/E = MyMeta()
    `;
    checkClassDetail(code, '__class_MyMeta');
});
test('special built in class', () => {
    const code = `
// @filename: test.py
//// from typing import TypedDict
//// def foo(t: /*marker*/TypedDict): ...
    `;
    checkSpecialBuiltInClassDetail(code);
});
test('dynamic enum', () => {
    const code = `
// @filename: test.py
//// from enum import Enum
//// /*marker*/E = Enum('E', { 'One': 1 })
    `;
    checkNoDeclarationInClassDetail(code);
});
test('dynamic named tuple', () => {
    const code = `
// @filename: test.py
//// from typing import NamedTuple
//// /*marker*/N = NamedTuple("N", [('name', str)])
    `;
    checkNoDeclarationInClassDetail(code);
});
test('dynamic typed dict', () => {
    const code = `
// @filename: test.py
//// from typing import TypedDict
//// /*marker*/T = TypedDict("T", { "one": str })
    `;
    checkNoDeclarationInClassDetail(code);
});
test('dynamic new type', () => {
    const code = `
// @filename: test.py
//// from typing import NewType
//// /*marker*/I = NewType('I', int)
    `;
    checkNoDeclarationInClassDetail(code);
});
test('dynamic type', () => {
    const code = `
// @filename: test.py
//// /*marker*/D = type('D', (object,), {})
    `;
    checkNoDeclarationInClassDetail(code);
});
test('property', () => {
    const code = `
// @filename: test.py
//// class MyClass:
////     def __init__(self):
////         self._v = None
////     
////     @property
////     def /*getter*/value(self):
////         return self._v
////     
////     @value.setter
////     def /*setter*/value(self, value):
////         self._v = value
////     
////     @value.deleter
////     def /*deleter*/value(self):
////         del self._v
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    ['getter', 'setter', 'deleter'].forEach((marker) => {
        const node = (0, testState_1.getNodeAtMarker)(state, marker);
        (0, assert_1.default)(node.nodeType === 38 /* ParseNodeType.Name */);
        const functionNode = (0, parseTreeUtils_1.getEnclosingFunction)(node);
        (0, assert_1.default)((functionNode === null || functionNode === void 0 ? void 0 : functionNode.nodeType) === 31 /* ParseNodeType.Function */);
        const result = state.program.evaluator.getTypeOfFunction(functionNode);
        (0, assert_1.default)(result === null || result === void 0 ? void 0 : result.decoratedType);
        (0, assert_1.default)((0, typeUtils_1.isProperty)(result.decoratedType));
        (0, assert_1.default)((0, types_1.isClassInstance)(result.decoratedType));
        (0, assert_1.default)(result.decoratedType.details.declaration);
        (0, assert_1.default)((0, declaration_1.isClassDeclaration)(result.decoratedType.details.declaration));
        (0, assert_1.default)(result.decoratedType.details.declaration.moduleName === 'builtins');
        (0, assert_1.default)(result.decoratedType.details.declaration.node.name.value === 'property');
    });
});
function checkSpecialBuiltInClassDetail(code) {
    var _a;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const node = (0, testState_1.getNodeAtMarker)(state);
    (0, assert_1.default)(node.nodeType === 38 /* ParseNodeType.Name */);
    const type = state.program.evaluator.getType(node);
    (0, assert_1.default)((type === null || type === void 0 ? void 0 : type.category) === 6 /* TypeCategory.Class */);
    assert_1.default.strictEqual(node.value, (_a = type.aliasName) !== null && _a !== void 0 ? _a : type.details.name);
    (0, assert_1.default)(type.details.declaration);
    if (type.aliasName) {
        (0, assert_1.default)((0, declaration_1.isClassDeclaration)(type.details.declaration));
    }
    else {
        (0, assert_1.default)((0, declaration_1.isSpecialBuiltInClassDeclaration)(type.details.declaration));
    }
}
function checkNoDeclarationInClassDetail(code) {
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    _checkClassDetail(state, undefined);
}
function checkClassDetail(code, name) {
    var _a;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    _checkClassDetail(state, (_a = state.getRangeByMarkerName('marker')) !== null && _a !== void 0 ? _a : state.getRangeByMarkerName('range'), name);
}
function _checkClassDetail(state, range, name) {
    var _a;
    const node = (0, testState_1.getNodeAtMarker)(state);
    (0, assert_1.default)(node.nodeType === 38 /* ParseNodeType.Name */);
    const type = state.program.evaluator.getType(node);
    (0, assert_1.default)((type === null || type === void 0 ? void 0 : type.category) === 6 /* TypeCategory.Class */);
    assert_1.default.strictEqual(name !== null && name !== void 0 ? name : node.value, (_a = type.aliasName) !== null && _a !== void 0 ? _a : type.details.name);
    if (range) {
        (0, assert_1.default)(type.details.declaration);
        (0, assert_1.default)((0, declaration_1.isClassDeclaration)(type.details.declaration));
        assert_1.default.deepStrictEqual(textRange_1.TextRange.create(type.details.declaration.node.start, type.details.declaration.node.length), textRange_1.TextRange.fromBounds(range.pos, range.end));
    }
    else {
        // There should be no decl.
        (0, assert_1.default)(!type.details.declaration);
    }
}
//# sourceMappingURL=classDeclaration.test.js.map