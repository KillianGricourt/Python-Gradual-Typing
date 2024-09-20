"use strict";
/*
 * localizer.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Unit tests for localizer module, including default localized strings.
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
const localize_1 = require("../localization/localize");
const namespaces = [localize_1.Localizer.Diagnostic, localize_1.Localizer.DiagnosticAddendum, localize_1.Localizer.CodeAction];
test('Raw strings present', () => {
    // Allocate a map so we can detect duplicate strings. This is
    // an indication that the string key (e.g. 'DiagnosticAddendum.useDictInstead')
    // used to fetch the localized string is a duplicate of another string key.
    const stringContentMap = new Map();
    namespaces.forEach((namespace) => {
        Object.keys(namespace).forEach((key) => {
            const value = namespace[key]();
            let formatString;
            if (value === undefined) {
                assert.fail(`Default value for localized string "${key}" is missing`);
            }
            else if (typeof value === 'string') {
                formatString = value;
            }
            else if (value instanceof localize_1.ParameterizedString) {
                formatString = value.getFormatString();
                if (!formatString) {
                    assert.fail(`Format string for localized string "${key}" is missing`);
                }
            }
            else {
                assert.fail(`Default value for localized string "${key}" is unexpected type`);
            }
            if (stringContentMap.has(formatString)) {
                assert.fail(`Localized string for "${key}" is duplicate of ${stringContentMap.get(formatString)}`);
            }
            stringContentMap.set(formatString, key);
        });
    });
});
test('Override a specific string', () => {
    // eslint-disable-next-line prefer-const
    let originalRawString;
    function overrideImportResolve(key) {
        if (key === 'Diagnostic.importResolveFailure') {
            return 'Import is {importName}';
        }
        return originalRawString(key);
    }
    originalRawString = (0, localize_1.setGetRawString)(overrideImportResolve);
    const value = localize_1.LocMessage.importResolveFailure().format({ importName: 'foo', venv: 'python' });
    try {
        assert.equal(value, 'Import is foo');
        const nonMovedValue = localize_1.LocMessage.abstractMethodInvocation().format({ method: 'foo' });
        assert.equal(nonMovedValue, 'Method "foo" cannot be called because it is abstract and unimplemented');
    }
    finally {
        (0, localize_1.setGetRawString)(originalRawString);
    }
});
//# sourceMappingURL=localizer.test.js.map