"use strict";
/*
 * editAction.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Represents a single edit within a file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileEditAction = exports.TextEditAction = void 0;
const textRange_1 = require("./textRange");
var TextEditAction;
(function (TextEditAction) {
    function is(value) {
        return !!value.range && value.replacementText !== undefined;
    }
    TextEditAction.is = is;
})(TextEditAction || (exports.TextEditAction = TextEditAction = {}));
var FileEditAction;
(function (FileEditAction) {
    function is(value) {
        return value.fileUri !== undefined && TextEditAction.is(value);
    }
    FileEditAction.is = is;
    function areEqual(e1, e2) {
        return (e1 === e2 ||
            (e1.fileUri.equals(e2.fileUri) &&
                (0, textRange_1.rangesAreEqual)(e1.range, e2.range) &&
                e1.replacementText === e2.replacementText));
    }
    FileEditAction.areEqual = areEqual;
})(FileEditAction || (exports.FileEditAction = FileEditAction = {}));
//# sourceMappingURL=editAction.js.map