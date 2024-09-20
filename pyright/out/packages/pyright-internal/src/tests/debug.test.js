"use strict";
/*
 * debug.test.ts
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
const debug = __importStar(require("../common/debug"));
test('DebugAssertTrue', () => {
    assert_1.default.doesNotThrow(() => {
        debug.assert(true, "doesn't throw");
    });
});
test('DebugAssertFalse', () => {
    assert_1.default.throws(() => {
        debug.assert(false, 'should throw');
    }, (err) => err instanceof Error, 'unexpected');
});
test('DebugAssertDetailInfo', () => {
    // let assert to show more detail info which will get collected when
    // assert raised
    const detailInfo = 'Detail Info';
    assert_1.default.throws(() => {
        debug.assert(false, 'should throw', () => detailInfo);
    }, (err) => err instanceof Error && err.message.includes(detailInfo), 'unexpected');
});
test('DebugAssertStackTrace', () => {
    // let assert to control what call stack to put in exception stack
    assert_1.default.throws(() => {
        debug.assert(false, 'should throw', undefined, assert_1.default.throws);
    }, (err) => err instanceof Error && !err.message.includes('assert.throws'), 'unexpected');
});
test('DebugAssertUndefined', () => {
    const unused = undefined;
    assert_1.default.throws(() => debug.assertDefined(unused), (err) => err instanceof Error, 'unexpected');
});
test('DebugAssertDefined', () => {
    const unused = 1;
    assert_1.default.doesNotThrow(() => debug.assertDefined(unused));
});
test('DebugAssertEachUndefined', () => {
    const unused = [1, 2, 3, undefined];
    assert_1.default.throws(() => debug.assertEachDefined(unused), (err) => err instanceof Error, 'unexpected');
});
test('DebugAssertEachDefined', () => {
    const unused = [1, 2, 3];
    assert_1.default.doesNotThrow(() => debug.assertEachDefined(unused));
});
test('DebugAssertNever', () => {
    const unused = 5;
    // prevent one from adding new values and forget to add
    // handlers some places
    assert_1.default.throws(() => {
        switch (unused) {
            case 0 /* MyEnum.A */:
            case 1 /* MyEnum.B */:
            case 2 /* MyEnum.C */:
                break;
            default:
                debug.assertNever(unused);
        }
    }, (err) => err instanceof Error, 'unexpected');
});
test('DebugGetFunctionName', () => {
    // helper method to add better message in exception
    (0, assert_1.default)(debug.getFunctionName(assert_1.default.throws) === 'throws');
});
test('DebugFormatEnum', () => {
    // helper method to add better message in exception around enum
    // const enum require --preserveConstEnums flag to work properly
    let MyEnum;
    (function (MyEnum) {
        MyEnum[MyEnum["A"] = 0] = "A";
        MyEnum[MyEnum["B"] = 1] = "B";
        MyEnum[MyEnum["C"] = 2] = "C";
    })(MyEnum || (MyEnum = {}));
    (0, assert_1.default)(debug.formatEnum(MyEnum.A, MyEnum, false) === 'A');
});
//# sourceMappingURL=debug.test.js.map