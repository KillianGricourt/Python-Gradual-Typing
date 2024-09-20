"use strict";
/*
 * languageServerInterface.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Interface for language server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowInterface = void 0;
var WindowInterface;
(function (WindowInterface) {
    function is(obj) {
        return (!!obj &&
            obj.showErrorMessage !== undefined &&
            obj.showWarningMessage !== undefined &&
            obj.showInformationMessage !== undefined);
    }
    WindowInterface.is = is;
})(WindowInterface || (exports.WindowInterface = WindowInterface = {}));
//# sourceMappingURL=languageServerInterface.js.map