"use strict";
/*
 * pyTypedUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Parser for py.typed files.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPyTypedInfoForPyTypedFile = exports.getPyTypedInfo = void 0;
const uriUtils_1 = require("../common/uri/uriUtils");
//
// Retrieves information about a py.typed file, if it exists, under the given path.
//
function getPyTypedInfo(fileSystem, dirPath) {
    if (!fileSystem.existsSync(dirPath) || !(0, uriUtils_1.isDirectory)(fileSystem, dirPath)) {
        return undefined;
    }
    const pyTypedPath = dirPath.pytypedUri;
    if (!fileSystem.existsSync(pyTypedPath) || !(0, uriUtils_1.isFile)(fileSystem, pyTypedPath)) {
        return undefined;
    }
    return getPyTypedInfoForPyTypedFile(fileSystem, pyTypedPath);
}
exports.getPyTypedInfo = getPyTypedInfo;
//
// Retrieves information about a py.typed file. The pyTypedPath provided must be a valid path.
//
function getPyTypedInfoForPyTypedFile(fileSystem, pyTypedPath) {
    // This function intentionally doesn't check whether the given py.typed path exists or not,
    // as filesystem access is expensive if done repeatedly.
    // The caller should verify the file's validity before calling this method and use a cache if possible
    // to avoid high filesystem access costs.
    let isPartiallyTyped = false;
    // Read the contents of the file as text.
    const fileStats = fileSystem.statSync(pyTypedPath);
    // Do a quick sanity check on the size before we attempt to read it. This
    // file should always be really small - typically zero bytes in length.
    if (fileStats.size > 0 && fileStats.size < 64 * 1024) {
        const pyTypedContents = fileSystem.readFileSync(pyTypedPath, 'utf8');
        // PEP 561 doesn't specify the format of "py.typed" in any detail other than
        // to say that "If a stub package is partial it MUST include partial\n in a top
        // level py.typed file."
        if (pyTypedContents.match(/partial\n/) || pyTypedContents.match(/partial\r\n/)) {
            isPartiallyTyped = true;
        }
    }
    return {
        pyTypedPath,
        isPartiallyTyped,
    };
}
exports.getPyTypedInfoForPyTypedFile = getPyTypedInfoForPyTypedFile;
//# sourceMappingURL=pyTypedUtils.js.map