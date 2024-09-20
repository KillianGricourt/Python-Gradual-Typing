"use strict";
/*
 * core.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Various helpers that don't have a dependency on other code files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Disposable = exports.containsOnlyWhitespace = exports.getEnumNames = exports.isDefined = exports.isThenable = exports.isDebugMode = exports.test_setDebugMode = exports.toBoolean = exports.hasProperty = exports.isBoolean = exports.isNumber = exports.isString = exports.isArray = exports.compareValues = exports.compareComparableValues = exports.equateValues = exports.toLowerCase = exports.identity = exports.returnUndefined = exports.returnTrue = exports.returnFalse = void 0;
const textRange_1 = require("./textRange");
/** Do nothing and return false */
function returnFalse() {
    return false;
}
exports.returnFalse = returnFalse;
/** Do nothing and return true */
function returnTrue() {
    return true;
}
exports.returnTrue = returnTrue;
/** Do nothing and return undefined */
function returnUndefined() {
    return undefined;
}
exports.returnUndefined = returnUndefined;
/** Returns its argument. */
function identity(x) {
    return x;
}
exports.identity = identity;
/** Returns lower case string */
function toLowerCase(x) {
    return x.toLowerCase();
}
exports.toLowerCase = toLowerCase;
function equateValues(a, b) {
    return a === b;
}
exports.equateValues = equateValues;
function compareComparableValues(a, b) {
    return a === b
        ? 0 /* Comparison.EqualTo */
        : a === undefined
            ? -1 /* Comparison.LessThan */
            : b === undefined
                ? 1 /* Comparison.GreaterThan */
                : a < b
                    ? -1 /* Comparison.LessThan */
                    : 1 /* Comparison.GreaterThan */;
}
exports.compareComparableValues = compareComparableValues;
/**
 * Compare two numeric values for their order relative to each other.
 * To compare strings, use any of the `compareStrings` functions.
 */
function compareValues(a, b) {
    return compareComparableValues(a, b);
}
exports.compareValues = compareValues;
/**
 * Tests whether a value is an array.
 */
function isArray(value) {
    return Array.isArray ? Array.isArray(value) : value instanceof Array;
}
exports.isArray = isArray;
/**
 * Tests whether a value is string
 */
function isString(text) {
    return typeof text === 'string';
}
exports.isString = isString;
function isNumber(x) {
    return typeof x === 'number';
}
exports.isNumber = isNumber;
function isBoolean(x) {
    return typeof x === 'boolean';
}
exports.isBoolean = isBoolean;
const hasOwnProperty = Object.prototype.hasOwnProperty;
/**
 * Indicates whether a map-like contains an own property with the specified key.
 *
 * @param map A map-like.
 * @param key A property key.
 */
function hasProperty(map, key) {
    return hasOwnProperty.call(map, key);
}
exports.hasProperty = hasProperty;
/**
 * Convert the given value to boolean
 * @param trueOrFalse string value 'true' or 'false'
 */
function toBoolean(trueOrFalse) {
    const normalized = trueOrFalse === null || trueOrFalse === void 0 ? void 0 : trueOrFalse.trim().toUpperCase();
    if (normalized === 'TRUE') {
        return true;
    }
    return false;
}
exports.toBoolean = toBoolean;
let _debugMode = undefined;
function test_setDebugMode(debugMode) {
    const oldValue = _debugMode;
    _debugMode = debugMode;
    return oldValue;
}
exports.test_setDebugMode = test_setDebugMode;
function isDebugMode() {
    if (_debugMode === undefined) {
        // Cache debugging mode since it can't be changed while process is running.
        const argv = process.execArgv.join();
        _debugMode = argv.includes('inspect') || argv.includes('debug');
    }
    return _debugMode;
}
exports.isDebugMode = isDebugMode;
function isThenable(v) {
    return typeof (v === null || v === void 0 ? void 0 : v.then) === 'function';
}
exports.isThenable = isThenable;
function isDefined(element) {
    return element !== undefined;
}
exports.isDefined = isDefined;
function getEnumNames(enumType) {
    const result = [];
    for (const value in enumType) {
        if (isNaN(Number(value))) {
            result.push(value);
        }
    }
    return result;
}
exports.getEnumNames = getEnumNames;
function containsOnlyWhitespace(text, span) {
    if (span) {
        text = text.substring(span.start, textRange_1.TextRange.getEnd(span));
    }
    return /^\s*$/.test(text);
}
exports.containsOnlyWhitespace = containsOnlyWhitespace;
var Disposable;
(function (Disposable) {
    function is(value) {
        return value && typeof value.dispose === 'function';
    }
    Disposable.is = is;
})(Disposable || (exports.Disposable = Disposable = {}));
//# sourceMappingURL=core.js.map