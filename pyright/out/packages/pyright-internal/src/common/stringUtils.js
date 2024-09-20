"use strict";
/*
 * stringUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility methods for manipulating and comparing strings.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeRegExp = exports.truncate = exports.getLastDottedString = exports.getCharacterCount = exports.equateStringsCaseSensitive = exports.equateStringsCaseInsensitive = exports.getStringComparer = exports.compareStringsCaseSensitive = exports.compareStringsCaseInsensitive = exports.hashString = exports.isPatternInSymbol = exports.computeCompletionSimilarity = void 0;
const leven_1 = __importDefault(require("leven"));
const core_1 = require("./core");
// Determines how closely a typed string matches a symbol
// name. An exact match returns 1. A match that differs
// only in case returns a slightly lower number. A match
// that involves a few missing or added characters returns
// an even lower number.
function computeCompletionSimilarity(typedValue, symbolName) {
    if (symbolName.startsWith(typedValue)) {
        return 1;
    }
    const symbolLower = symbolName.toLocaleLowerCase();
    const typedLower = typedValue.toLocaleLowerCase();
    if (symbolLower.startsWith(typedLower)) {
        return 0.75;
    }
    // How far apart are the two strings? Find the smallest edit
    // distance for each of the substrings taken from the start of
    // symbolName.
    let symbolSubstrLength = symbolLower.length;
    let smallestEditDistance = Number.MAX_VALUE;
    while (symbolSubstrLength > 0) {
        const editDistance = (0, leven_1.default)(symbolLower.substr(0, symbolSubstrLength), typedLower);
        if (editDistance < smallestEditDistance) {
            smallestEditDistance = editDistance;
        }
        symbolSubstrLength--;
    }
    // We'll take into account the length of the typed value. If the user
    // has typed more characters, and they largely match the symbol name,
    // it is considered more similar. If the the edit distance is similar
    // to the number of characters the user has typed, then there's almost
    // no similarity.
    if (smallestEditDistance >= typedValue.length) {
        return 0;
    }
    const similarity = (typedValue.length - smallestEditDistance) / typedValue.length;
    return 0.5 * similarity;
}
exports.computeCompletionSimilarity = computeCompletionSimilarity;
// Determines if typed string matches a symbol
// name. Characters must appear in order.
// Return true if all typed characters are in symbol
function isPatternInSymbol(typedValue, symbolName) {
    const typedLower = typedValue.toLocaleLowerCase();
    const symbolLower = symbolName.toLocaleLowerCase();
    const typedLength = typedLower.length;
    const symbolLength = symbolLower.length;
    let typedPos = 0;
    let symbolPos = 0;
    while (typedPos < typedLength && symbolPos < symbolLength) {
        if (typedLower[typedPos] === symbolLower[symbolPos]) {
            typedPos += 1;
        }
        symbolPos += 1;
    }
    return typedPos === typedLength;
}
exports.isPatternInSymbol = isPatternInSymbol;
// This is a simple, non-cryptographic hash function for text.
function hashString(contents) {
    let hash = 0;
    for (let i = 0; i < contents.length; i++) {
        hash = ((hash << 5) - hash + contents.charCodeAt(i)) | 0;
    }
    return hash;
}
exports.hashString = hashString;
/**
 * Compare two strings using a case-insensitive ordinal comparison.
 *
 * Ordinal comparisons are based on the difference between the unicode code points of both
 * strings. Characters with multiple unicode representations are considered unequal. Ordinal
 * comparisons provide predictable ordering, but place "a" after "B".
 *
 * Case-insensitive comparisons compare both strings one code-point at a time using the integer
 * value of each code-point after applying `toUpperCase` to each string. We always map both
 * strings to their upper-case form as some unicode characters do not properly round-trip to
 * lowercase (such as `áºž` (German sharp capital s)).
 */
function compareStringsCaseInsensitive(a, b) {
    return a === b
        ? 0 /* Comparison.EqualTo */
        : a === undefined
            ? -1 /* Comparison.LessThan */
            : b === undefined
                ? 1 /* Comparison.GreaterThan */
                : (0, core_1.compareComparableValues)(a.toUpperCase(), b.toUpperCase());
}
exports.compareStringsCaseInsensitive = compareStringsCaseInsensitive;
/**
 * Compare two strings using a case-sensitive ordinal comparison.
 *
 * Ordinal comparisons are based on the difference between the unicode code points of both
 * strings. Characters with multiple unicode representations are considered unequal. Ordinal
 * comparisons provide predictable ordering, but place "a" after "B".
 *
 * Case-sensitive comparisons compare both strings one code-point at a time using the integer
 * value of each code-point.
 */
function compareStringsCaseSensitive(a, b) {
    return (0, core_1.compareComparableValues)(a, b);
}
exports.compareStringsCaseSensitive = compareStringsCaseSensitive;
function getStringComparer(ignoreCase) {
    return ignoreCase ? compareStringsCaseInsensitive : compareStringsCaseSensitive;
}
exports.getStringComparer = getStringComparer;
/**
 * Compare the equality of two strings using a case-insensitive ordinal comparison.
 *
 * Case-insensitive comparisons compare both strings one code-point at a time using the integer
 * value of each code-point after applying `toUpperCase` to each string. We always map both
 * strings to their upper-case form as some unicode characters do not properly round-trip to
 * lowercase (such as `ẞ` (German sharp capital s)).
 */
function equateStringsCaseInsensitive(a, b) {
    return compareStringsCaseInsensitive(a, b) === 0 /* Comparison.EqualTo */;
}
exports.equateStringsCaseInsensitive = equateStringsCaseInsensitive;
/**
 * Compare the equality of two strings using a case-sensitive ordinal comparison.
 *
 * Case-sensitive comparisons compare both strings one code-point at a time using the
 * integer value of each code-point.
 */
function equateStringsCaseSensitive(a, b) {
    return compareStringsCaseSensitive(a, b) === 0 /* Comparison.EqualTo */;
}
exports.equateStringsCaseSensitive = equateStringsCaseSensitive;
function getCharacterCount(value, ch) {
    let result = 0;
    for (let i = 0; i < value.length; i++) {
        if (value[i] === ch) {
            result++;
        }
    }
    return result;
}
exports.getCharacterCount = getCharacterCount;
function getLastDottedString(text) {
    const index = text.lastIndexOf('.');
    return index > 0 ? text.substring(index + 1) : text;
}
exports.getLastDottedString = getLastDottedString;
function truncate(text, maxLength) {
    if (text.length > maxLength) {
        return text.substring(0, maxLength - '...'.length) + '...';
    }
    return text;
}
exports.truncate = truncate;
function escapeRegExp(text) {
    return text.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}
exports.escapeRegExp = escapeRegExp;
//# sourceMappingURL=stringUtils.js.map