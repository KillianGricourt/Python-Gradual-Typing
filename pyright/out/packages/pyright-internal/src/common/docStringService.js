"use strict";
/*
 * docStringService.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Interface for service that parses docstrings and converts them to other formats.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PyrightDocStringService = exports.DocStringService = void 0;
const docStringConversion_1 = require("../analyzer/docStringConversion");
const docStringUtils_1 = require("../analyzer/docStringUtils");
var DocStringService;
(function (DocStringService) {
    function is(value) {
        return (!!value.convertDocStringToMarkdown &&
            !!value.convertDocStringToPlainText &&
            !!value.extractParameterDocumentation);
    }
    DocStringService.is = is;
})(DocStringService || (exports.DocStringService = DocStringService = {}));
class PyrightDocStringService {
    convertDocStringToPlainText(docString) {
        return (0, docStringConversion_1.convertDocStringToPlainText)(docString);
    }
    convertDocStringToMarkdown(docString) {
        return (0, docStringConversion_1.convertDocStringToMarkdown)(docString);
    }
    extractParameterDocumentation(functionDocString, paramName) {
        return (0, docStringUtils_1.extractParameterDocumentation)(functionDocString, paramName);
    }
    clone() {
        // No need to clone, no internal state
        return this;
    }
}
exports.PyrightDocStringService = PyrightDocStringService;
//# sourceMappingURL=docStringService.js.map