"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertDocumentRangeToLocation = exports.convertDocumentRangesToLocation = exports.canNavigateToFile = void 0;
/*
 * navigationUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Helper functions for navigating files.
 */
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const uriUtils_1 = require("../common/uri/uriUtils");
function canNavigateToFile(fs, path) {
    return !fs.isInZip(path);
}
exports.canNavigateToFile = canNavigateToFile;
function convertDocumentRangesToLocation(fs, ranges, converter = convertDocumentRangeToLocation) {
    return ranges.map((range) => converter(fs, range)).filter((loc) => !!loc);
}
exports.convertDocumentRangesToLocation = convertDocumentRangesToLocation;
function convertDocumentRangeToLocation(fs, range) {
    if (!canNavigateToFile(fs, range.uri)) {
        return undefined;
    }
    return vscode_languageserver_types_1.Location.create((0, uriUtils_1.convertUriToLspUriString)(fs, range.uri), range.range);
}
exports.convertDocumentRangeToLocation = convertDocumentRangeToLocation;
//# sourceMappingURL=navigationUtils.js.map