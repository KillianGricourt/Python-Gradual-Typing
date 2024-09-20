"use strict";
/*
 * serialization.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for serializing/deserializing data for background threads.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializationTests = void 0;
const assert_1 = __importDefault(require("assert"));
const backgroundThreadBase_1 = require("../backgroundThreadBase");
const uriUtils_1 = require("../common/uri/uriUtils");
function serializationTests(serializer = backgroundThreadBase_1.serialize, deserializer = backgroundThreadBase_1.deserialize) {
    test('Simple string', () => {
        const serialized = serializer('hello');
        const deserialized = deserializer(serialized);
        assert_1.default.strictEqual(deserialized, 'hello');
    });
    test('Simple number', () => {
        const serialized = serializer(123);
        const deserialized = deserializer(serialized);
        assert_1.default.strictEqual(deserialized, 123);
    });
    test('Simple boolean', () => {
        const serialized = serializer(true);
        const deserialized = deserializer(serialized);
        assert_1.default.strictEqual(deserialized, true);
    });
    test('Simple object', () => {
        const serialized = serializer({ a: 1, b: 'hello' });
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, { a: 1, b: 'hello' });
    });
    test('Simple array', () => {
        const serialized = serializer([1, 'hello']);
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, [1, 'hello']);
    });
    test('Object with maps', () => {
        const serialized = serializer({
            a: new Map([
                ['hello', 1],
                ['world', 2],
            ]),
        });
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, {
            a: new Map([
                ['hello', 1],
                ['world', 2],
            ]),
        });
    });
    test('Object with sets', () => {
        const serialized = serializer({ a: new Set(['hello', 'world']) });
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, { a: new Set(['hello', 'world']) });
    });
    test('Object with undefined', () => {
        const serialized = serializer({ a: undefined });
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, {});
    });
    test('Object with null', () => {
        const serialized = serializer({ a: null });
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, { a: null });
    });
    test('Object with URI', () => {
        const serialized = serializer({ a: uriUtils_1.UriEx.file('hello') });
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, { a: uriUtils_1.UriEx.file('hello') });
    });
    test('Object with URI array', () => {
        const serialized = serializer({ a: [uriUtils_1.UriEx.file('hello'), uriUtils_1.UriEx.file('world')] });
        const deserialized = deserializer(serialized);
        assert_1.default.deepStrictEqual(deserialized, { a: [uriUtils_1.UriEx.file('hello'), uriUtils_1.UriEx.file('world')] });
    });
}
exports.serializationTests = serializationTests;
describe('Serialization', () => {
    serializationTests();
});
//# sourceMappingURL=serialization.test.js.map