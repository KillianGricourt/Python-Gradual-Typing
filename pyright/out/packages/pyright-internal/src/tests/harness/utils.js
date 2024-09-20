"use strict";
/*
 * utils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.stringify = exports.createIOError = exports.IO_ERROR_MESSAGE = exports.bufferFrom = exports.Metadata = exports.closeIterator = exports.nextResult = exports.getIterator = exports.SortedMap = void 0;
const collectionUtils_1 = require("../../common/collectionUtils");
const core_1 = require("../../common/core");
class SortedMap {
    constructor(comparer, iterable) {
        this._keys = [];
        this._values = [];
        this._version = 0;
        this._copyOnWrite = false;
        this._comparer = typeof comparer === 'object' ? comparer.comparer : comparer;
        this._order = typeof comparer === 'object' && comparer.sort === 'insertion' ? [] : undefined;
        if (iterable) {
            const iterator = getIterator(iterable);
            try {
                for (let i = nextResult(iterator); i; i = nextResult(iterator)) {
                    const [key, value] = i.value;
                    this.set(key, value);
                }
            }
            finally {
                closeIterator(iterator);
            }
        }
    }
    get size() {
        return this._keys.length;
    }
    get comparer() {
        return this._comparer;
    }
    get [Symbol.toStringTag]() {
        return 'SortedMap';
    }
    has(key) {
        return (0, collectionUtils_1.binarySearch)(this._keys, key, core_1.identity, this._comparer) >= 0;
    }
    get(key) {
        const index = (0, collectionUtils_1.binarySearch)(this._keys, key, core_1.identity, this._comparer);
        return index >= 0 ? this._values[index] : undefined;
    }
    set(key, value) {
        const index = (0, collectionUtils_1.binarySearch)(this._keys, key, core_1.identity, this._comparer);
        if (index >= 0) {
            this._values[index] = value;
        }
        else {
            this._writePreamble();
            (0, collectionUtils_1.insertAt)(this._keys, ~index, key);
            (0, collectionUtils_1.insertAt)(this._values, ~index, value);
            if (this._order) {
                (0, collectionUtils_1.insertAt)(this._order, ~index, this._version);
            }
            this._writePostScript();
        }
        return this;
    }
    delete(key) {
        const index = (0, collectionUtils_1.binarySearch)(this._keys, key, core_1.identity, this._comparer);
        if (index >= 0) {
            this._writePreamble();
            this._orderedRemoveItemAt(this._keys, index);
            this._orderedRemoveItemAt(this._values, index);
            if (this._order) {
                this._orderedRemoveItemAt(this._order, index);
            }
            this._writePostScript();
            return true;
        }
        return false;
    }
    clear() {
        if (this.size > 0) {
            this._writePreamble();
            this._keys.length = 0;
            this._values.length = 0;
            if (this._order) {
                this._order.length = 0;
            }
            this._writePostScript();
        }
    }
    forEach(callback, thisArg) {
        const keys = this._keys;
        const values = this._values;
        const indices = this._getIterationOrder();
        const version = this._version;
        this._copyOnWrite = true;
        try {
            if (indices) {
                for (const i of indices) {
                    callback.call(thisArg, values[i], keys[i], this);
                }
            }
            else {
                for (let i = 0; i < keys.length; i++) {
                    callback.call(thisArg, values[i], keys[i], this);
                }
            }
        }
        finally {
            if (version === this._version) {
                this._copyOnWrite = false;
            }
        }
    }
    *keys() {
        const keys = this._keys;
        const indices = this._getIterationOrder();
        const version = this._version;
        this._copyOnWrite = true;
        try {
            if (indices) {
                for (const i of indices) {
                    yield keys[i];
                }
            }
            else {
                yield* keys;
            }
        }
        finally {
            if (version === this._version) {
                this._copyOnWrite = false;
            }
        }
    }
    *values() {
        const values = this._values;
        const indices = this._getIterationOrder();
        const version = this._version;
        this._copyOnWrite = true;
        try {
            if (indices) {
                for (const i of indices) {
                    yield values[i];
                }
            }
            else {
                yield* values;
            }
        }
        finally {
            if (version === this._version) {
                this._copyOnWrite = false;
            }
        }
    }
    *entries() {
        const keys = this._keys;
        const values = this._values;
        const indices = this._getIterationOrder();
        const version = this._version;
        this._copyOnWrite = true;
        try {
            if (indices) {
                for (const i of indices) {
                    yield [keys[i], values[i]];
                }
            }
            else {
                for (let i = 0; i < keys.length; i++) {
                    yield [keys[i], values[i]];
                }
            }
        }
        finally {
            if (version === this._version) {
                this._copyOnWrite = false;
            }
        }
    }
    [Symbol.iterator]() {
        return this.entries();
    }
    _writePreamble() {
        if (this._copyOnWrite) {
            this._keys = this._keys.slice();
            this._values = this._values.slice();
            if (this._order) {
                this._order = this._order.slice();
            }
            this._copyOnWrite = false;
        }
    }
    _writePostScript() {
        this._version++;
    }
    _getIterationOrder() {
        if (this._order) {
            const order = this._order;
            return this._order.map((_, i) => i).sort((x, y) => order[x] - order[y]);
        }
        return undefined;
    }
    /** Remove an item by index from an array, moving everything to its right one space left. */
    _orderedRemoveItemAt(array, index) {
        // This seems to be faster than either `array.splice(i, 1)` or `array.copyWithin(i, i+ 1)`.
        for (let i = index; i < array.length - 1; i++) {
            array[i] = array[i + 1];
        }
        array.pop();
    }
}
exports.SortedMap = SortedMap;
function getIterator(iterable) {
    return iterable[Symbol.iterator]();
}
exports.getIterator = getIterator;
function nextResult(iterator) {
    const result = iterator.next();
    return result.done ? undefined : result;
}
exports.nextResult = nextResult;
function closeIterator(iterator) {
    const fn = iterator.return;
    if (typeof fn === 'function') {
        fn.call(iterator);
    }
}
exports.closeIterator = closeIterator;
/**
 * A collection of metadata that supports inheritance.
 */
class Metadata {
    constructor(parent) {
        this._version = 0;
        this._size = -1;
        this._parent = parent;
        this._map = Object.create(parent ? parent._map : null);
    }
    get size() {
        if (this._size === -1 || (this._parent && this._parent._version !== this._parentVersion)) {
            this._size = Object.keys(this._map).length;
            if (this._parent) {
                this._parentVersion = this._parent._version;
            }
        }
        return this._size;
    }
    get parent() {
        return this._parent;
    }
    has(key) {
        return this._map[Metadata._escapeKey(key)] !== undefined;
    }
    get(key) {
        const value = this._map[Metadata._escapeKey(key)];
        return value === Metadata._undefinedValue ? undefined : value;
    }
    set(key, value) {
        this._map[Metadata._escapeKey(key)] = value === undefined ? Metadata._undefinedValue : value;
        this._size = -1;
        this._version++;
        return this;
    }
    delete(key) {
        const escapedKey = Metadata._escapeKey(key);
        if (this._map[escapedKey] !== undefined) {
            delete this._map[escapedKey];
            this._size = -1;
            this._version++;
            return true;
        }
        return false;
    }
    clear() {
        this._map = Object.create(this._parent ? this._parent._map : null);
        this._size = -1;
        this._version++;
    }
    forEach(callback) {
        for (const key of Object.keys(this._map)) {
            callback(this._map[key], Metadata._unescapeKey(key), this);
        }
    }
    static _escapeKey(text) {
        return text.length >= 2 && text.charAt(0) === '_' && text.charAt(1) === '_' ? '_' + text : text;
    }
    static _unescapeKey(text) {
        return text.length >= 3 && text.charAt(0) === '_' && text.charAt(1) === '_' && text.charAt(2) === '_'
            ? text.slice(1)
            : text;
    }
}
exports.Metadata = Metadata;
Metadata._undefinedValue = {};
function bufferFrom(input, encoding) {
    // See https://github.com/Microsoft/TypeScript/issues/25652
    return Buffer.from && Buffer.from !== Int8Array.from
        ? Buffer.from(input, encoding)
        : new Buffer(input, encoding);
}
exports.bufferFrom = bufferFrom;
exports.IO_ERROR_MESSAGE = Object.freeze({
    EACCES: 'access denied',
    EIO: 'an I/O error occurred',
    ENOENT: 'no such file or directory',
    EEXIST: 'file already exists',
    ELOOP: 'too many symbolic links encountered',
    ENOTDIR: 'no such directory',
    EISDIR: 'path is a directory',
    EBADF: 'invalid file descriptor',
    EINVAL: 'invalid value',
    ENOTEMPTY: 'directory not empty',
    EPERM: 'operation not permitted',
    EROFS: 'file system is read-only',
});
function createIOError(code, details = '') {
    const err = new Error(`${code}: ${exports.IO_ERROR_MESSAGE[code]} ${details}`);
    err.code = code;
    if (Error.captureStackTrace) {
        Error.captureStackTrace(err, createIOError);
    }
    return err;
}
exports.createIOError = createIOError;
function stringify(data, replacer) {
    return JSON.stringify(data, replacer, 2);
}
exports.stringify = stringify;
//# sourceMappingURL=utils.js.map