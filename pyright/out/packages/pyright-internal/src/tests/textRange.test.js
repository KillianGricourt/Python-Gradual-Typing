"use strict";
/*
 * textRange.test.ts
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
test('textRange combine', () => {
    const range1 = textRange_1.TextRange.create(10, 2);
    const range2 = textRange_1.TextRange.create(12, 2);
    const range3 = textRange_1.TextRange.create(8, 2);
    const combined = textRange_1.TextRange.combine([range1, range2, range3]);
    assert.ok(combined);
    assert.equal(combined.start, 8);
    assert.equal(combined.length, 6);
    // Ensure input ranges are unchanged
    assert.equal(range1.start, 10);
    assert.equal(range1.length, 2);
    assert.equal(range2.start, 12);
    assert.equal(range2.length, 2);
    assert.equal(range3.start, 8);
    assert.equal(range3.length, 2);
});
//# sourceMappingURL=textRange.test.js.map