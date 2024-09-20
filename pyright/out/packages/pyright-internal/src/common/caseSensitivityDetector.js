"use strict";
/*
 * caseSensitivityDetector.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * interface to determine whether the given uri string should be case sensitive or not.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaseSensitivityDetector = void 0;
var CaseSensitivityDetector;
(function (CaseSensitivityDetector) {
    function is(value) {
        return !!value.isCaseSensitive;
    }
    CaseSensitivityDetector.is = is;
})(CaseSensitivityDetector || (exports.CaseSensitivityDetector = CaseSensitivityDetector = {}));
//# sourceMappingURL=caseSensitivityDetector.js.map