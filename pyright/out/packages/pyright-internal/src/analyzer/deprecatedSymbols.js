"use strict";
/*
 * deprecatedSymbols.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A list of implicitly-deprecated symbols as defined in PEP 585, etc.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deprecatedSpecialForms = exports.deprecatedAliases = void 0;
const pythonVersion_1 = require("../common/pythonVersion");
exports.deprecatedAliases = new Map([
    ['Tuple', { version: pythonVersion_1.pythonVersion3_9, fullName: 'builtins.tuple', replacementText: 'tuple' }],
    ['List', { version: pythonVersion_1.pythonVersion3_9, fullName: 'builtins.list', replacementText: 'list' }],
    ['Dict', { version: pythonVersion_1.pythonVersion3_9, fullName: 'builtins.dict', replacementText: 'dict' }],
    ['Set', { version: pythonVersion_1.pythonVersion3_9, fullName: 'builtins.set', replacementText: 'set' }],
    ['FrozenSet', { version: pythonVersion_1.pythonVersion3_9, fullName: 'builtins.frozenset', replacementText: 'frozenset' }],
    ['Type', { version: pythonVersion_1.pythonVersion3_9, fullName: 'builtins.type', replacementText: 'type' }],
    ['Deque', { version: pythonVersion_1.pythonVersion3_9, fullName: 'collections.deque', replacementText: 'collections.deque' }],
    [
        'DefaultDict',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'collections.defaultdict',
            replacementText: 'collections.defaultdict',
        },
    ],
    [
        'OrderedDict',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'collections.OrderedDict',
            replacementText: 'collections.OrderedDict',
            typingImportOnly: true,
        },
    ],
    [
        'Counter',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'collections.Counter',
            replacementText: 'collections.Counter',
            typingImportOnly: true,
        },
    ],
    [
        'ChainMap',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'collections.ChainMap',
            replacementText: 'collections.ChainMap',
            typingImportOnly: true,
        },
    ],
    [
        'Awaitable',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Awaitable',
            replacementText: 'collections.abc.Awaitable',
            typingImportOnly: true,
        },
    ],
    [
        'Coroutine',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Coroutine',
            replacementText: 'collections.abc.Coroutine',
            typingImportOnly: true,
        },
    ],
    [
        'AsyncIterable',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.AsyncIterable',
            replacementText: 'collections.abc.AsyncIterable',
            typingImportOnly: true,
        },
    ],
    [
        'AsyncIterator',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.AsyncIterator',
            replacementText: 'collections.abc.AsyncIterator',
            typingImportOnly: true,
        },
    ],
    [
        'AsyncGenerator',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.AsyncGenerator',
            replacementText: 'collections.abc.AsyncGenerator',
            typingImportOnly: true,
        },
    ],
    [
        'Iterable',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Iterable',
            replacementText: 'collections.abc.Iterable',
            typingImportOnly: true,
        },
    ],
    [
        'Iterator',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Iterator',
            replacementText: 'collections.abc.Iterator',
            typingImportOnly: true,
        },
    ],
    [
        'Generator',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Generator',
            replacementText: 'collections.abc.Generator',
            typingImportOnly: true,
        },
    ],
    [
        'Reversible',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Reversible',
            replacementText: 'collections.abc.Reversible',
            typingImportOnly: true,
        },
    ],
    [
        'Container',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Container',
            replacementText: 'collections.abc.Container',
            typingImportOnly: true,
        },
    ],
    [
        'Collection',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Collection',
            replacementText: 'collections.abc.Collection',
            typingImportOnly: true,
        },
    ],
    [
        'AbstractSet',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.AbstractSet',
            replacementText: 'collections.abc.Set',
            typingImportOnly: true,
        },
    ],
    [
        'MutableSet',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.MutableSet',
            replacementText: 'collections.abc.MutableSet',
            typingImportOnly: true,
        },
    ],
    [
        'Mapping',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Mapping',
            replacementText: 'collections.abc.Mapping',
            typingImportOnly: true,
        },
    ],
    [
        'MutableMapping',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.MutableMapping',
            replacementText: 'collections.abc.MutableMapping',
            typingImportOnly: true,
        },
    ],
    [
        'Sequence',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Sequence',
            replacementText: 'collections.abc.Sequence',
            typingImportOnly: true,
        },
    ],
    [
        'MutableSequence',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.MutableSequence',
            replacementText: 'collections.abc.MutableSequence',
            typingImportOnly: true,
        },
    ],
    [
        'ByteString',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.ByteString',
            replacementText: 'collections.abc.ByteString',
            typingImportOnly: true,
        },
    ],
    [
        'MappingView',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.MappingView',
            replacementText: 'collections.abc.MappingView',
            typingImportOnly: true,
        },
    ],
    [
        'KeysView',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.KeysView',
            replacementText: 'collections.abc.KeysView',
            typingImportOnly: true,
        },
    ],
    [
        'ItemsView',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.ItemsView',
            replacementText: 'collections.abc.ItemsView',
            typingImportOnly: true,
        },
    ],
    [
        'ValuesView',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.ValuesView',
            replacementText: 'collections.abc.ValuesView',
            typingImportOnly: true,
        },
    ],
    [
        'ContextManager',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.ContextManager',
            replacementText: 'contextlib.AbstractContextManager',
        },
    ],
    [
        'AsyncContextManager',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.AsyncContextManager',
            replacementText: 'contextlib.AbstractAsyncContextManager',
        },
    ],
    [
        'Pattern',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 're.Pattern',
            replacementText: 're.Pattern',
            typingImportOnly: true,
        },
    ],
    [
        'Match',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 're.Match',
            replacementText: 're.Match',
            typingImportOnly: true,
        },
    ],
]);
exports.deprecatedSpecialForms = new Map([
    ['Optional', { version: pythonVersion_1.pythonVersion3_10, fullName: 'typing.Optional', replacementText: '| None' }],
    ['Union', { version: pythonVersion_1.pythonVersion3_10, fullName: 'typing.Union', replacementText: '|' }],
    [
        'Callable',
        {
            version: pythonVersion_1.pythonVersion3_9,
            fullName: 'typing.Callable',
            replacementText: 'collections.abc.Callable',
            typingImportOnly: true,
        },
    ],
]);
//# sourceMappingURL=deprecatedSymbols.js.map