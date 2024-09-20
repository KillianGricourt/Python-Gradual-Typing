"use strict";
/*
 * collectionUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Helper functions relating to collections and arrays.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.arrayEquals = exports.addIfNotNull = exports.getMapValues = exports.addIfUnique = exports.createMapFromItems = exports.removeArrayElements = exports.getOrAdd = exports.getNestedProperty = exports.flatten = exports.binarySearchKey = exports.binarySearch = exports.every = exports.some = exports.map = exports.stableSort = exports.cloneAndSort = exports.insertAt = exports.addRange = exports.find = exports.appendArray = exports.append = exports.contains = exports.emptyArray = void 0;
const core_1 = require("./core");
exports.emptyArray = [];
function contains(array, value, equalityComparer = core_1.equateValues) {
    if (array) {
        for (const v of array) {
            if (equalityComparer(v, value)) {
                return true;
            }
        }
    }
    return false;
}
exports.contains = contains;
function append(to, value) {
    if (value === undefined) {
        return to;
    }
    if (to === undefined) {
        return [value];
    }
    to.push(value);
    return to;
}
exports.append = append;
/**
 * Safely pushes the values of one array onto another array. This is the
 * same as receiver.push(...elementsToPush) except that it doesn't risk overflowing
 * the stack if elementsToPush is very large.
 */
function appendArray(to, elementsToPush) {
    if (elementsToPush.length < 256) {
        to.push(...elementsToPush);
        return;
    }
    for (const elem of elementsToPush) {
        to.push(elem);
    }
}
exports.appendArray = appendArray;
function find(array, predicate) {
    for (let i = 0; i < array.length; i++) {
        const value = array[i];
        if (predicate(value, i)) {
            return value;
        }
    }
    return undefined;
}
exports.find = find;
/**
 * Gets the actual offset into an array for a relative offset. Negative offsets indicate a
 * position offset from the end of the array.
 */
function toOffset(array, offset) {
    return offset < 0 ? array.length + offset : offset;
}
function addRange(to, from, start, end) {
    if (from === undefined || from.length === 0) {
        return to;
    }
    if (to === undefined) {
        return from.slice(start, end);
    }
    start = start === undefined ? 0 : toOffset(from, start);
    end = end === undefined ? from.length : toOffset(from, end);
    for (let i = start; i < end && i < from.length; i++) {
        if (from[i] !== undefined) {
            to.push(from[i]);
        }
    }
    return to;
}
exports.addRange = addRange;
function insertAt(array, index, value) {
    if (index === 0) {
        array.unshift(value);
    }
    else if (index === array.length) {
        array.push(value);
    }
    else {
        for (let i = array.length; i > index; i--) {
            array[i] = array[i - 1];
        }
        array[index] = value;
    }
    return array;
}
exports.insertAt = insertAt;
/**
 * Returns a new sorted array.
 */
function cloneAndSort(array, comparer) {
    return (array.length === 0 ? array : array.slice().sort(comparer));
}
exports.cloneAndSort = cloneAndSort;
function selectIndex(_, i) {
    return i;
}
function indicesOf(array) {
    return array.map(selectIndex);
}
/**
 * Stable sort of an array. Elements equal to each other maintain their relative position in the array.
 */
function stableSort(array, comparer) {
    const indices = indicesOf(array);
    stableSortIndices(array, indices, comparer);
    return indices.map((i) => array[i]);
}
exports.stableSort = stableSort;
function stableSortIndices(array, indices, comparer) {
    // sort indices by value then position
    indices.sort((x, y) => comparer(array[x], array[y]) || (0, core_1.compareValues)(x, y));
}
function map(array, f) {
    if (array) {
        return array.map(f);
    }
    return undefined;
}
exports.map = map;
function some(array, predicate) {
    if (array) {
        if (predicate) {
            return array.some(predicate);
        }
        else {
            return array.length > 0;
        }
    }
    return false;
}
exports.some = some;
/**
 * Iterates through `array` by index and performs the callback on each element of array until the callback
 * returns a falsey value, then returns false.
 * If no such value is found, the callback is applied to each element of array and `true` is returned.
 */
function every(array, callback) {
    if (array) {
        return array.every(callback);
    }
    return true;
}
exports.every = every;
/**
 * Performs a binary search, finding the index at which `value` occurs in `array`.
 * If no such index is found, returns the 2's-complement of first index at which
 * `array[index]` exceeds `value`.
 * @param array A sorted array whose first element must be no larger than number
 * @param value The value to be searched for in the array.
 * @param keySelector A callback used to select the search key from `value` and each element of
 * `array`.
 * @param keyComparer A callback used to compare two keys in a sorted array.
 * @param offset An offset into `array` at which to start the search.
 */
function binarySearch(array, value, keySelector, keyComparer, offset) {
    return binarySearchKey(array, keySelector(value), keySelector, keyComparer, offset);
}
exports.binarySearch = binarySearch;
/**
 * Performs a binary search, finding the index at which an object with `key` occurs in `array`.
 * If no such index is found, returns the 2's-complement of first index at which
 * `array[index]` exceeds `key`.
 * @param array A sorted array whose first element must be no larger than number
 * @param key The key to be searched for in the array.
 * @param keySelector A callback used to select the search key from each element of `array`.
 * @param keyComparer A callback used to compare two keys in a sorted array.
 * @param offset An offset into `array` at which to start the search.
 */
function binarySearchKey(array, key, keySelector, keyComparer, offset) {
    if (!some(array)) {
        return -1;
    }
    let low = offset || 0;
    let high = array.length - 1;
    while (low <= high) {
        const middle = low + ((high - low) >> 1);
        const midKey = keySelector(array[middle]);
        switch (keyComparer(midKey, key)) {
            case -1 /* Comparison.LessThan */:
                low = middle + 1;
                break;
            case 0 /* Comparison.EqualTo */:
                return middle;
            case 1 /* Comparison.GreaterThan */:
                high = middle - 1;
                break;
        }
    }
    return ~low;
}
exports.binarySearchKey = binarySearchKey;
/**
 * Flattens an array containing a mix of array or non-array elements.
 *
 * @param array The array to flatten.
 */
function flatten(array) {
    const result = [];
    for (const v of array) {
        if (v) {
            if ((0, core_1.isArray)(v)) {
                addRange(result, v);
            }
            else {
                result.push(v);
            }
        }
    }
    return result;
}
exports.flatten = flatten;
/**
 * Retrieves nested objects by parsing chained properties. ie. "a.b.c"
 * Returns undefined if not found
 * @param object The object to query
 * @param property The property to be searched for in the object ie. "a.b.c"
 */
function getNestedProperty(object, property) {
    const value = property.split('.').reduce((obj, prop) => {
        return obj && obj[prop];
    }, object);
    return value;
}
exports.getNestedProperty = getNestedProperty;
function getOrAdd(map, key, newValueFactory) {
    const value = map.get(key);
    if (value !== undefined) {
        return value;
    }
    const newValue = newValueFactory();
    map.set(key, newValue);
    return newValue;
}
exports.getOrAdd = getOrAdd;
/**
 * Remove matching item from the array in place.
 * Returns the given array itself.
 * @param array The array to operate on.
 * @param predicate Return true for an item to delete.
 */
function removeArrayElements(array, predicate) {
    for (let i = 0; i < array.length; i++) {
        if (predicate(array[i])) {
            array.splice(i, 1);
            // Array is modified in place, we need to look at the same index again.
            i--;
        }
    }
    return array;
}
exports.removeArrayElements = removeArrayElements;
function createMapFromItems(items, keyGetter) {
    return items
        .map((t) => keyGetter(t))
        .reduce((map, key, i) => {
        map.set(key, (map.get(key) || []).concat(items[i]));
        return map;
    }, new Map());
}
exports.createMapFromItems = createMapFromItems;
function addIfUnique(arr, t, equalityComparer = core_1.equateValues) {
    if (contains(arr, t, equalityComparer)) {
        return arr;
    }
    arr.push(t);
    return arr;
}
exports.addIfUnique = addIfUnique;
function getMapValues(m, predicate) {
    const values = [];
    m.forEach((v, k) => {
        if (predicate(k, v)) {
            values.push(v);
        }
    });
    return values;
}
exports.getMapValues = getMapValues;
function addIfNotNull(arr, t) {
    if (t === undefined) {
        return arr;
    }
    arr.push(t);
    return arr;
}
exports.addIfNotNull = addIfNotNull;
function arrayEquals(c1, c2, predicate) {
    if (c1.length !== c2.length) {
        return false;
    }
    return c1.every((v, i) => predicate(v, c2[i]));
}
exports.arrayEquals = arrayEquals;
//# sourceMappingURL=collectionUtils.js.map