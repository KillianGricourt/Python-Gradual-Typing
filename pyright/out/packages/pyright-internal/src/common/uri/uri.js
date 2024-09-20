"use strict";
/*
 * uri.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * URI namespace for storing and manipulating URIs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Uri = void 0;
const vscode_uri_1 = require("vscode-uri");
const caseSensitivityDetector_1 = require("../caseSensitivityDetector");
const core_1 = require("../core");
const pathUtils_1 = require("../pathUtils");
const serviceKeys_1 = require("../serviceKeys");
const constantUri_1 = require("./constantUri");
const emptyUri_1 = require("./emptyUri");
const fileUri_1 = require("./fileUri");
const webUri_1 = require("./webUri");
// Returns just the fsPath path portion of a vscode URI.
function getFilePath(uri) {
    let filePath;
    // Compute the file path ourselves. The vscode.URI class doesn't
    // treat UNC shares with a single slash as UNC paths.
    // https://github.com/microsoft/vscode-uri/blob/53e4ca6263f2e4ddc35f5360c62bc1b1d30f27dd/src/uri.ts#L567
    if (uri.authority && uri.path[0] === '/' && uri.path.length === 1) {
        filePath = `//${uri.authority}${uri.path}`;
    }
    else {
        // Otherwise use the vscode.URI version
        filePath = uri.fsPath;
    }
    // If this is a DOS-style path with a drive letter, remove
    // the leading slash.
    if (filePath.match(/^\/[a-zA-Z]:\//)) {
        filePath = filePath.slice(1);
    }
    // vscode.URI normalizes the path to use the correct path separators.
    // We need to do the same.
    if ((process === null || process === void 0 ? void 0 : process.platform) === 'win32') {
        filePath = filePath.replace(/\//g, '\\');
    }
    return filePath;
}
// Function called to normalize input URIs. This gets rid of '..' and '.' in the path.
// It also removes any '/' on the end of the path.
// This is slow but should only be called when the URI is first created.
function normalizeUri(uri) {
    // Make sure the drive letter is lower case. This
    // is consistent with what VS code does for URIs.
    const parsed = vscode_uri_1.URI.isUri(uri) ? uri : vscode_uri_1.URI.parse(uri);
    // Original URI may not have resolved all the `..` in the path, so remove them.
    // Note: this also has the effect of removing any trailing slashes.
    const finalURI = parsed.path.length > 0 ? vscode_uri_1.Utils.resolvePath(parsed) : parsed;
    const finalString = finalURI.toString();
    return { uri: finalURI, str: finalString };
}
var Uri;
(function (Uri) {
    function file(path, arg, checkRelative = false) {
        arg = caseSensitivityDetector_1.CaseSensitivityDetector.is(arg) ? arg : arg.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector);
        // Fix path if we're checking for relative paths and this is not a rooted path.
        path = checkRelative && !(0, pathUtils_1.isRootedDiskPath)(path) ? (0, pathUtils_1.combinePaths)(process.cwd(), path) : path;
        // If this already starts with 'file:', then we can
        // parse it normally. It's actually a uri string. Otherwise parse it as a file path.
        const normalized = path.startsWith('file:')
            ? normalizeUri(path)
            : normalizeUri(vscode_uri_1.URI.file((0, pathUtils_1.normalizeSlashes)(path)));
        // Turn the path into a file URI.
        return fileUri_1.FileUri.createFileUri(getFilePath(normalized.uri), normalized.uri.query, normalized.uri.fragment, normalized.str, arg.isCaseSensitive(normalized.str));
    }
    Uri.file = file;
    function parse(value, arg) {
        if (!value) {
            return Uri.empty();
        }
        arg = caseSensitivityDetector_1.CaseSensitivityDetector.is(arg) ? arg : arg.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector);
        // Normalize the value here. This gets rid of '..' and '.' in the path. It also removes any
        // '/' on the end of the path.
        const normalized = normalizeUri(value);
        if (normalized.uri.scheme === fileUri_1.FileUriSchema) {
            return fileUri_1.FileUri.createFileUri(getFilePath(normalized.uri), normalized.uri.query, normalized.uri.fragment, normalized.str, arg.isCaseSensitive(normalized.str));
        }
        // Web URIs are always case sensitive.
        return webUri_1.WebUri.createWebUri(normalized.uri.scheme, normalized.uri.authority, normalized.uri.path, normalized.uri.query, normalized.uri.fragment, normalized.str);
    }
    Uri.parse = parse;
    function constant(markerName) {
        return new constantUri_1.ConstantUri(markerName);
    }
    Uri.constant = constant;
    function empty() {
        return emptyUri_1.EmptyUri.instance;
    }
    Uri.empty = empty;
    // Excel's copy of tests\harness\vfs\pathValidation.ts knows about this constant.
    // If the value is changed, the Excel team should be told.
    Uri.DefaultWorkspaceRootComponent = '<default workspace root>';
    Uri.DefaultWorkspaceRootPath = `/${Uri.DefaultWorkspaceRootComponent}`;
    function defaultWorkspace(arg) {
        arg = caseSensitivityDetector_1.CaseSensitivityDetector.is(arg) ? arg : arg.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector);
        return Uri.file(Uri.DefaultWorkspaceRootPath, arg);
    }
    Uri.defaultWorkspace = defaultWorkspace;
    function fromJsonObj(jsonObj) {
        if ((0, core_1.isArray)(jsonObj)) {
            // Currently only file uri supports SerializedType.
            switch (jsonObj[0]) {
                case 0 /* UriKinds.file */:
                    return fileUri_1.FileUri.fromJsonObj(jsonObj);
            }
        }
        if (fileUri_1.FileUri.isFileUri(jsonObj)) {
            return fileUri_1.FileUri.fromJsonObj(jsonObj);
        }
        if (webUri_1.WebUri.isWebUri(jsonObj)) {
            return webUri_1.WebUri.fromJsonObj(jsonObj);
        }
        if (emptyUri_1.EmptyUri.isEmptyUri(jsonObj)) {
            return emptyUri_1.EmptyUri.instance;
        }
        return jsonObj;
    }
    Uri.fromJsonObj = fromJsonObj;
    function is(thing) {
        return !!thing && typeof thing._key === 'string';
    }
    Uri.is = is;
    function isEmpty(uri) {
        return !uri || uri.isEmpty();
    }
    Uri.isEmpty = isEmpty;
    function equals(a, b) {
        var _a;
        if (a === b) {
            return true;
        }
        return (_a = a === null || a === void 0 ? void 0 : a.equals(b)) !== null && _a !== void 0 ? _a : false;
    }
    Uri.equals = equals;
    function isDefaultWorkspace(uri) {
        return uri.fileName.includes(Uri.DefaultWorkspaceRootComponent);
    }
    Uri.isDefaultWorkspace = isDefaultWorkspace;
})(Uri || (exports.Uri = Uri = {}));
//# sourceMappingURL=uri.js.map