"use strict";
/*
 * debug.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Helper functions that display user friendly debugging info.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSerializableError = exports.getErrorString = exports.formatEnum = exports.getFunctionName = exports.assertNever = exports.assertEachDefined = exports.assertDefined = exports.fail = exports.assert = void 0;
const collectionUtils_1 = require("./collectionUtils");
const core_1 = require("./core");
function assert(expression, message, verboseDebugInfo, stackCrawlMark) {
    if (!expression) {
        if (verboseDebugInfo) {
            message +=
                '\r\nVerbose Debug Information: ' +
                    (typeof verboseDebugInfo === 'string' ? verboseDebugInfo : verboseDebugInfo());
        }
        fail(message ? 'False expression: ' + message : 'False expression.', stackCrawlMark || assert);
    }
}
exports.assert = assert;
function fail(message, stackCrawlMark) {
    // debugger;
    const e = new Error(message ? `Debug Failure. ${message}` : 'Debug Failure.');
    if (Error.captureStackTrace) {
        Error.captureStackTrace(e, stackCrawlMark || fail);
    }
    throw e;
}
exports.fail = fail;
function assertDefined(value, message, stackCrawlMark) {
    if (value === undefined || value === null) {
        fail(message, stackCrawlMark || assertDefined);
    }
}
exports.assertDefined = assertDefined;
function assertEachDefined(value, message, stackCrawlMark) {
    for (const v of value) {
        assertDefined(v, message, stackCrawlMark || assertEachDefined);
    }
}
exports.assertEachDefined = assertEachDefined;
function assertNever(member, message = 'Illegal value:', stackCrawlMark) {
    let detail = '';
    try {
        detail = JSON.stringify(member);
    }
    catch {
        // Do nothing.
    }
    fail(`${message} ${detail}`, stackCrawlMark || assertNever);
}
exports.assertNever = assertNever;
function getFunctionName(func) {
    if (typeof func !== 'function') {
        return '';
    }
    else if ((0, core_1.hasProperty)(func, 'name')) {
        return func.name;
    }
    else {
        const text = Function.prototype.toString.call(func);
        const match = /^function\s+([\w$]+)\s*\(/.exec(text);
        return match ? match[1] : '';
    }
}
exports.getFunctionName = getFunctionName;
/**
 * Formats an enum value as a string for debugging and debug assertions.
 */
function formatEnum(value = 0, enumObject, isFlags) {
    const members = getEnumMembers(enumObject);
    if (value === 0) {
        return members.length > 0 && members[0][0] === 0 ? members[0][1] : '0';
    }
    if (isFlags) {
        let result = '';
        let remainingFlags = value;
        for (const [enumValue, enumName] of members) {
            if (enumValue > value) {
                break;
            }
            if (enumValue !== 0 && enumValue & value) {
                result = `${result}${result ? '|' : ''}${enumName}`;
                remainingFlags &= ~enumValue;
            }
        }
        if (remainingFlags === 0) {
            return result;
        }
    }
    else {
        for (const [enumValue, enumName] of members) {
            if (enumValue === value) {
                return enumName;
            }
        }
    }
    return value.toString();
}
exports.formatEnum = formatEnum;
function getErrorString(error) {
    return ((error.stack ? error.stack.toString() : undefined) ||
        (typeof error.message === 'string' ? error.message : undefined) ||
        JSON.stringify(error));
}
exports.getErrorString = getErrorString;
function getSerializableError(error) {
    if (!error) {
        return undefined;
    }
    const exception = JSON.stringify(error);
    if (exception.length > 2) {
        // Given error object is JSON.stringify serializable. Use it as it is
        // to preserve properties.
        return error;
    }
    // Convert error to JSON.stringify serializable Error shape.
    const name = error.name ? ((0, core_1.isString)(error.name) ? error.name : 'noname') : 'noname';
    const message = error.message ? ((0, core_1.isString)(error.message) ? error.message : 'nomessage') : 'nomessage';
    const stack = error.stack ? ((0, core_1.isString)(error.stack) ? error.stack : undefined) : undefined;
    return { name, message, stack };
}
exports.getSerializableError = getSerializableError;
function getEnumMembers(enumObject) {
    const result = [];
    for (const name of Object.keys(enumObject)) {
        const value = enumObject[name];
        if (typeof value === 'number') {
            result.push([value, name]);
        }
    }
    return (0, collectionUtils_1.stableSort)(result, (x, y) => (0, core_1.compareValues)(x[0], y[0]));
}
//# sourceMappingURL=debug.js.map