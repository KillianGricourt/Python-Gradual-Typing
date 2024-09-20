"use strict";
/*
 * stringUtils.test.ts
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
const utils = __importStar(require("../common/stringUtils"));
test('stringUtils computeCompletionSimilarity', () => {
    assert.equal(utils.computeCompletionSimilarity('', 'abcd'), 1);
    assert.equal(utils.computeCompletionSimilarity('abcd', 'abcd'), 1);
    assert.equal(utils.computeCompletionSimilarity('abc', 'abcd'), 1);
    assert.equal(utils.computeCompletionSimilarity('ABCD', 'abcd'), 0.75);
    assert.equal(utils.computeCompletionSimilarity('ABC', 'abcd'), 0.75);
    assert.equal(utils.computeCompletionSimilarity('abce', 'abcd'), 0.375);
    assert.equal(utils.computeCompletionSimilarity('abcde', 'abcd'), 0.4);
    assert.equal(utils.computeCompletionSimilarity('azcde', 'abcd'), 0.3);
    assert.equal(utils.computeCompletionSimilarity('acde', 'abcd'), 0.25);
    assert.equal(utils.computeCompletionSimilarity('zbcd', 'abcd'), 0.375);
});
test('stringUtils isPatternInSymbol', () => {
    assert.equal(utils.isPatternInSymbol('', 'abcd'), true);
    assert.equal(utils.isPatternInSymbol('abcd', 'abcd'), true);
    assert.equal(utils.isPatternInSymbol('abc', 'abcd'), true);
    assert.equal(utils.isPatternInSymbol('ABCD', 'abcd'), true);
    assert.equal(utils.isPatternInSymbol('ABC', 'abcd'), true);
    assert.equal(utils.isPatternInSymbol('acbd', 'abcd'), false);
    assert.equal(utils.isPatternInSymbol('abce', 'abcd'), false);
    assert.equal(utils.isPatternInSymbol('abcde', 'abcd'), false);
    assert.equal(utils.isPatternInSymbol('azcde', 'abcd'), false);
    assert.equal(utils.isPatternInSymbol('acde', 'abcd'), false);
    assert.equal(utils.isPatternInSymbol('zbcd', 'abcd'), false);
});
test('CoreCompareStringsCaseInsensitive1', () => {
    assert.equal(utils.compareStringsCaseInsensitive('Hello', 'hello'), 0 /* core.Comparison.EqualTo */);
});
test('CoreCompareStringsCaseInsensitive2', () => {
    assert.equal(utils.compareStringsCaseInsensitive('Hello', undefined), 1 /* core.Comparison.GreaterThan */);
});
test('CoreCompareStringsCaseInsensitive3', () => {
    assert.equal(utils.compareStringsCaseInsensitive(undefined, 'hello'), -1 /* core.Comparison.LessThan */);
});
test('CoreCompareStringsCaseInsensitive4', () => {
    assert.equal(utils.compareStringsCaseInsensitive(undefined, undefined), 0 /* core.Comparison.EqualTo */);
});
test('CoreCompareStringsCaseSensitive', () => {
    assert.equal(utils.compareStringsCaseSensitive('Hello', 'hello'), -1 /* core.Comparison.LessThan */);
});
//# sourceMappingURL=stringUtils.test.js.map