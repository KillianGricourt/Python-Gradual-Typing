"use strict";
/*
 * collectionUtils.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
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
const utils = __importStar(require("../common/collectionUtils"));
const core_1 = require("../common/core");
test('UtilsContainsDefault', () => {
    const data = [1, 2, 3, 4, 5];
    (0, assert_1.default)(utils.contains(data, 2));
});
test('UtilsContainsComparer', () => {
    const data = [new D(1, 'A'), new D(2, 'B'), new D(3, 'C'), new D(4, 'D')];
    (0, assert_1.default)(utils.contains(data, new D(1, 'D'), (a, b) => a.value === b.value));
});
test('UtilsAppend', () => {
    const data = [];
    assert_1.default.deepEqual(utils.append(data, 1), [1]);
});
test('UtilsAppendUndefined', () => {
    const data = undefined;
    assert_1.default.deepEqual(utils.append(data, 1), [1]);
});
test('UtilsAppendUndefinedValue', () => {
    const data = [1];
    assert_1.default.equal(utils.append(data, undefined), data);
});
test('UtilsFindEmpty', () => {
    const data = [];
    assert_1.default.equal(utils.find(data, (e) => true), undefined);
});
test('UtilsFindNoMatch', () => {
    const data = [1];
    assert_1.default.equal(utils.find(data, (e) => false), undefined);
});
test('UtilsFindMatchSimple', () => {
    const data = [1];
    assert_1.default.equal(utils.find(data, (e) => e === 1), 1);
});
test('UtilsFindMatch', () => {
    const data = [new D(1, 'Hello')];
    assert_1.default.equal(utils.find(data, (e) => e.value === 1), data[0]);
});
test('UtilsFindMatchCovariant', () => {
    const item1 = new D(1, 'Hello');
    const item2 = new D(2, 'Hello2');
    const data = [new B(0), item1, item2, new B(3)];
    assert_1.default.equal(utils.find(data, (e) => e.value === 2), item2);
});
test('UtilsStableSort', () => {
    const data = [new D(2, 'Hello3'), new D(1, 'Hello1'), new D(2, 'Hello4'), new D(1, 'Hello2')];
    const sorted = utils.stableSort(data, (a, b) => (0, core_1.compareValues)(a.value, b.value));
    const result = [];
    sorted.forEach((e) => result.push(e.name));
    assert_1.default.deepEqual(result, ['Hello1', 'Hello2', 'Hello3', 'Hello4']);
});
test('UtilsBinarySearch', () => {
    const data = [new D(1, 'Hello3'), new D(2, 'Hello1'), new D(3, 'Hello4'), new D(4, 'Hello2')];
    const index = utils.binarySearch(data, new D(3, 'Unused'), (v) => v.value, core_1.compareValues, 0);
    assert_1.default.equal(index, 2);
});
test('UtilsBinarySearchMiss', () => {
    const data = [new D(1, 'Hello3'), new D(2, 'Hello1'), new D(4, 'Hello4'), new D(5, 'Hello2')];
    const index = utils.binarySearch(data, new D(3, 'Unused'), (v) => v.value, core_1.compareValues, 0);
    assert_1.default.equal(~index, 2);
});
test('isArray1', () => {
    const data = [new D(1, 'Hello3')];
    (0, assert_1.default)((0, core_1.isArray)(data));
});
test('isArray2', () => {
    const data = {};
    (0, assert_1.default)(!(0, core_1.isArray)(data));
});
test('addRange1', () => {
    const data = [];
    assert_1.default.deepEqual(utils.addRange(data, [1, 2, 3]), [1, 2, 3]);
});
test('addRange2', () => {
    const data = [1, 2, 3];
    assert_1.default.deepEqual(utils.addRange(data, [1, 2, 3, 4], 3, 4), [1, 2, 3, 4]);
});
test('insertAt1', () => {
    const data = [2, 3, 4];
    assert_1.default.deepEqual(utils.insertAt(data, 0, 1), [1, 2, 3, 4]);
});
test('insertAt2', () => {
    const data = [1, 2, 4];
    assert_1.default.deepEqual(utils.insertAt(data, 2, 3), [1, 2, 3, 4]);
});
test('insertAt3', () => {
    const data = [1, 2, 3];
    assert_1.default.deepEqual(utils.insertAt(data, 3, 4), [1, 2, 3, 4]);
});
test('cloneAndSort', () => {
    const data = [3, 2, 1];
    assert_1.default.deepEqual(utils.cloneAndSort(data), [1, 2, 3]);
});
test('flatten', () => {
    const data = [
        [1, 2],
        [3, 4],
        [5, 6],
    ];
    assert_1.default.deepEqual(utils.flatten(data), [1, 2, 3, 4, 5, 6]);
});
test('getNestedProperty', () => {
    const data = { a: { b: { c: 3 } } };
    assert_1.default.deepEqual(utils.getNestedProperty(data, 'a'), { b: { c: 3 } });
    assert_1.default.deepEqual(utils.getNestedProperty(data, 'a.b'), { c: 3 });
    assert_1.default.deepEqual(utils.getNestedProperty(data, 'a.b.c'), 3);
    assert_1.default.deepEqual(utils.getNestedProperty(data, 'x'), undefined);
    assert_1.default.deepEqual(utils.getNestedProperty(data, 'a.x'), undefined);
    assert_1.default.deepEqual(utils.getNestedProperty(data, ''), undefined);
    assert_1.default.deepEqual(utils.getNestedProperty(undefined, ''), undefined);
});
class B {
    constructor(value) {
        this.value = value;
    }
}
class D extends B {
    constructor(value, name) {
        super(value);
        this.name = name;
    }
}
//# sourceMappingURL=collectionUtils.test.js.map