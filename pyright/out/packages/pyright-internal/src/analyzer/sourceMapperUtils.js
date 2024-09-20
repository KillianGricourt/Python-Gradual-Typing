"use strict";
/*
 * sourceMapperUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildImportTree = void 0;
const MAX_TREE_SEARCH_COUNT = 1000;
class NumberReference {
    constructor() {
        this.value = 0;
    }
}
// Builds an array of imports from the 'from' to the 'to' entry where 'from'
// is on the front of the array and the item just before 'to' is on the
// back of the array.
function buildImportTree(to, from, next, token) {
    const totalCountRef = new NumberReference();
    const results = _buildImportTreeImpl(to, from, next, [], totalCountRef, token);
    // Result should always have the 'from' node in it.
    return results.length > 0 ? results : [from];
}
exports.buildImportTree = buildImportTree;
function _buildImportTreeImpl(to, from, next, previous, totalSearched, token) {
    // Exit early if cancellation is requested or we've exceeded max count
    if (totalSearched.value > MAX_TREE_SEARCH_COUNT || token.isCancellationRequested) {
        return [];
    }
    totalSearched.value += 1;
    if (from.equals(to)) {
        // At the top, previous should have our way into this recursion.
        return previous.length ? previous : [from];
    }
    if (previous.length > 1 && previous.find((s) => s.equals(from))) {
        // Fail the search, we're stuck in a loop.
        return [];
    }
    const nextEntries = next(from);
    for (let i = 0; i < nextEntries.length && !token.isCancellationRequested; i++) {
        // Do a search through the next level to get to the 'to' entry.
        const subentries = _buildImportTreeImpl(to, nextEntries[i], next, [...previous, from], totalSearched, token);
        if (subentries.length > 0) {
            return subentries;
        }
    }
    // Search failed on this tree. Fail so we can exit recursion.
    return [];
}
//# sourceMappingURL=sourceMapperUtils.js.map