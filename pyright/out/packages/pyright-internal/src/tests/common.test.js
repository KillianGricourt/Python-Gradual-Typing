"use strict";
/*
 * common.test.ts
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
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const textRange_1 = require("../common/textRange");
test('textRange create', () => {
    assert.throws(() => textRange_1.TextRange.create(-1, 1), Error);
    assert.throws(() => textRange_1.TextRange.create(1, -1), Error);
});
test('textRange from bounds', () => {
    assert.throws(() => textRange_1.TextRange.fromBounds(-1, 1), Error);
    assert.throws(() => textRange_1.TextRange.fromBounds(1, -1), Error);
});
test('textRange overlap', () => {
    const textRangeOne = {
        start: {
            line: 0,
            character: 0,
        },
        end: {
            line: 10,
            character: 0,
        },
    };
    const textRangeTwo = {
        start: {
            line: 11,
            character: 0,
        },
        end: {
            line: 20,
            character: 0,
        },
    };
    const textRangeThree = {
        start: {
            line: 5,
            character: 0,
        },
        end: {
            line: 15,
            character: 0,
        },
    };
    assert.equal((0, textRange_1.doRangesOverlap)(textRangeOne, textRangeTwo), false);
    assert.equal((0, textRange_1.doRangesOverlap)(textRangeTwo, textRangeOne), false);
    assert.equal((0, textRange_1.doRangesOverlap)(textRangeOne, textRangeThree), true);
});
test('textRange contain', () => {
    const textRangeOne = {
        start: {
            line: 0,
            character: 5,
        },
        end: {
            line: 10,
            character: 1,
        },
    };
    assert.equal((0, textRange_1.doesRangeContain)(textRangeOne, { line: 0, character: 0 }), false);
    assert.equal((0, textRange_1.doesRangeContain)(textRangeOne, { line: 0, character: 5 }), true);
    assert.equal((0, textRange_1.doesRangeContain)(textRangeOne, { line: 5, character: 0 }), true);
    assert.equal((0, textRange_1.doesRangeContain)(textRangeOne, { line: 10, character: 0 }), true);
    assert.equal((0, textRange_1.doesRangeContain)(textRangeOne, { line: 10, character: 1 }), true);
    assert.equal((0, textRange_1.doesRangeContain)(textRangeOne, { line: 10, character: 2 }), false);
});
test('textRange equal', () => {
    const textRangeOne = {
        start: {
            line: 0,
            character: 0,
        },
        end: {
            line: 10,
            character: 0,
        },
    };
    const textRangeTwo = {
        start: {
            line: 0,
            character: 0,
        },
        end: {
            line: 10,
            character: 0,
        },
    };
    const textRangeThree = {
        start: {
            line: 5,
            character: 0,
        },
        end: {
            line: 15,
            character: 0,
        },
    };
    assert.equal((0, textRange_1.rangesAreEqual)(textRangeOne, textRangeTwo), true);
    assert.equal((0, textRange_1.rangesAreEqual)(textRangeTwo, textRangeOne), true);
    assert.equal((0, textRange_1.rangesAreEqual)(textRangeOne, textRangeThree), false);
});
//# sourceMappingURL=common.test.js.map