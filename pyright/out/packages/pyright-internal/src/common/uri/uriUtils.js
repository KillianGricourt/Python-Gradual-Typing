"use strict";
/*
 * uriUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Utility functions for manipulating URIs.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UriEx = exports.convertUriToLspUriString = exports.getRootUri = exports.deduplicateFolders = exports.getDirectoryChangeKind = exports.getFileSpec = exports.hasPythonExtension = exports.getWildcardRoot = exports.getWildcardRegexPattern = exports.getFileSystemEntriesFromDirEntries = exports.getFileSystemEntries = exports.tryRealpath = exports.tryStat = exports.isFile = exports.isDirectory = exports.directoryExists = exports.fileExists = exports.getFileSize = exports.makeDirectories = exports.forEachAncestorDirectory = exports.FileSpec = void 0;
const pathUtils_1 = require("../pathUtils");
const uri_1 = require("./uri");
const serviceKeys_1 = require("../serviceKeys");
const caseSensitivityDetector_1 = require("../caseSensitivityDetector");
const _includeFileRegex = /\.pyi?$/;
var FileSpec;
(function (FileSpec) {
    function is(value) {
        const candidate = value;
        return candidate && !!candidate.wildcardRoot && !!candidate.regExp;
    }
    FileSpec.is = is;
    function isInPath(uri, paths) {
        return !!paths.find((p) => uri.matchesRegex(p.regExp));
    }
    FileSpec.isInPath = isInPath;
    function matchesIncludeFileRegex(uri, isFile = true) {
        return isFile ? uri.matchesRegex(_includeFileRegex) : true;
    }
    FileSpec.matchesIncludeFileRegex = matchesIncludeFileRegex;
    function matchIncludeFileSpec(includeRegExp, exclude, uri, isFile = true) {
        if (uri.matchesRegex(includeRegExp)) {
            if (!FileSpec.isInPath(uri, exclude) && FileSpec.matchesIncludeFileRegex(uri, isFile)) {
                return true;
            }
        }
        return false;
    }
    FileSpec.matchIncludeFileSpec = matchIncludeFileSpec;
})(FileSpec || (exports.FileSpec = FileSpec = {}));
function forEachAncestorDirectory(directory, callback) {
    while (true) {
        const result = callback(directory);
        if (result !== undefined) {
            return result;
        }
        const parentPath = directory.getDirectory();
        if (parentPath.equals(directory)) {
            return undefined;
        }
        directory = parentPath;
    }
}
exports.forEachAncestorDirectory = forEachAncestorDirectory;
// Creates a directory hierarchy for a path, starting from some ancestor path.
function makeDirectories(fs, dir, startingFrom) {
    if (!dir.startsWith(startingFrom)) {
        return;
    }
    const pathComponents = dir.getPathComponents();
    const relativeToComponents = startingFrom.getPathComponents();
    let curPath = startingFrom;
    for (let i = relativeToComponents.length; i < pathComponents.length; i++) {
        curPath = curPath.combinePaths(pathComponents[i]);
        if (!fs.existsSync(curPath)) {
            fs.mkdirSync(curPath);
        }
    }
}
exports.makeDirectories = makeDirectories;
function getFileSize(fs, uri) {
    const stat = tryStat(fs, uri);
    if (stat === null || stat === void 0 ? void 0 : stat.isFile()) {
        return stat.size;
    }
    return 0;
}
exports.getFileSize = getFileSize;
function fileExists(fs, uri) {
    return fileSystemEntryExists(fs, uri, 0 /* FileSystemEntryKind.File */);
}
exports.fileExists = fileExists;
function directoryExists(fs, uri) {
    return fileSystemEntryExists(fs, uri, 1 /* FileSystemEntryKind.Directory */);
}
exports.directoryExists = directoryExists;
function isDirectory(fs, uri) {
    var _a, _b;
    return (_b = (_a = tryStat(fs, uri)) === null || _a === void 0 ? void 0 : _a.isDirectory()) !== null && _b !== void 0 ? _b : false;
}
exports.isDirectory = isDirectory;
function isFile(fs, uri, treatZipDirectoryAsFile = false) {
    var _a, _b;
    const stats = tryStat(fs, uri);
    if (stats === null || stats === void 0 ? void 0 : stats.isFile()) {
        return true;
    }
    if (!treatZipDirectoryAsFile) {
        return false;
    }
    return (_b = (_a = stats === null || stats === void 0 ? void 0 : stats.isZipDirectory) === null || _a === void 0 ? void 0 : _a.call(stats)) !== null && _b !== void 0 ? _b : false;
}
exports.isFile = isFile;
function tryStat(fs, uri) {
    try {
        if (fs.existsSync(uri)) {
            return fs.statSync(uri);
        }
    }
    catch (e) {
        return undefined;
    }
    return undefined;
}
exports.tryStat = tryStat;
function tryRealpath(fs, uri) {
    try {
        return fs.realpathSync(uri);
    }
    catch (e) {
        return undefined;
    }
}
exports.tryRealpath = tryRealpath;
function getFileSystemEntries(fs, uri) {
    try {
        return getFileSystemEntriesFromDirEntries(fs.readdirEntriesSync(uri), fs, uri);
    }
    catch (e) {
        return { files: [], directories: [] };
    }
}
exports.getFileSystemEntries = getFileSystemEntries;
// Sorts the entires into files and directories, including any symbolic links.
function getFileSystemEntriesFromDirEntries(dirEntries, fs, uri) {
    const entries = dirEntries.sort((a, b) => {
        if (a.name < b.name) {
            return -1;
        }
        else if (a.name > b.name) {
            return 1;
        }
        else {
            return 0;
        }
    });
    const files = [];
    const directories = [];
    for (const entry of entries) {
        // This is necessary because on some file system node fails to exclude
        // "." and "..". See https://github.com/nodejs/node/issues/4002
        if (entry.name === '.' || entry.name === '..') {
            continue;
        }
        const entryUri = uri.combinePaths(entry.name);
        if (entry.isFile()) {
            files.push(entryUri);
        }
        else if (entry.isDirectory()) {
            directories.push(entryUri);
        }
        else if (entry.isSymbolicLink()) {
            const stat = tryStat(fs, entryUri);
            if (stat === null || stat === void 0 ? void 0 : stat.isFile()) {
                files.push(entryUri);
            }
            else if (stat === null || stat === void 0 ? void 0 : stat.isDirectory()) {
                directories.push(entryUri);
            }
        }
    }
    return { files, directories };
}
exports.getFileSystemEntriesFromDirEntries = getFileSystemEntriesFromDirEntries;
// Transforms a relative file spec (one that potentially contains
// escape characters **, * or ?) and returns a regular expression
// that can be used for matching against.
function getWildcardRegexPattern(root, fileSpec) {
    const absolutePath = root.resolvePaths(fileSpec);
    const pathComponents = Array.from(absolutePath.getPathComponents());
    const escapedSeparator = (0, pathUtils_1.getRegexEscapedSeparator)('/');
    const doubleAsteriskRegexFragment = `(${escapedSeparator}[^${escapedSeparator}][^${escapedSeparator}]*)*?`;
    const reservedCharacterPattern = new RegExp(`[^\\w\\s${escapedSeparator}]`, 'g');
    // Strip the directory separator from the root component.
    if (pathComponents.length > 0) {
        pathComponents[0] = (0, pathUtils_1.stripTrailingDirectorySeparator)(pathComponents[0]);
    }
    let regExPattern = '';
    let firstComponent = true;
    for (let component of pathComponents) {
        if (component === '**') {
            regExPattern += doubleAsteriskRegexFragment;
        }
        else {
            if (!firstComponent) {
                component = escapedSeparator + component;
            }
            regExPattern += component.replace(reservedCharacterPattern, (match) => {
                if (match === '*') {
                    return `[^${escapedSeparator}]*`;
                }
                else if (match === '?') {
                    return `[^${escapedSeparator}]`;
                }
                else {
                    // escaping anything that is not reserved characters - word/space/separator
                    return '\\' + match;
                }
            });
            firstComponent = false;
        }
    }
    return regExPattern;
}
exports.getWildcardRegexPattern = getWildcardRegexPattern;
// Returns the topmost path that contains no wildcard characters.
function getWildcardRoot(root, fileSpec) {
    const absolutePath = root.resolvePaths(fileSpec);
    // make a copy of the path components so we can modify them.
    const pathComponents = Array.from(absolutePath.getPathComponents());
    let wildcardRoot = absolutePath.root;
    // Remove the root component.
    if (pathComponents.length > 0) {
        pathComponents.shift();
    }
    for (const component of pathComponents) {
        if (component === '**') {
            break;
        }
        else {
            if (/[*?]/.test(component)) {
                break;
            }
            wildcardRoot = wildcardRoot.resolvePaths(component);
        }
    }
    return wildcardRoot;
}
exports.getWildcardRoot = getWildcardRoot;
function hasPythonExtension(uri) {
    return uri.hasExtension('.py') || uri.hasExtension('.pyi');
}
exports.hasPythonExtension = hasPythonExtension;
function getFileSpec(root, fileSpec) {
    let regExPattern = getWildcardRegexPattern(root, fileSpec);
    const escapedSeparator = (0, pathUtils_1.getRegexEscapedSeparator)('/');
    regExPattern = `^(${regExPattern})($|${escapedSeparator})`;
    const regExp = new RegExp(regExPattern, root.isCaseSensitive ? undefined : 'i');
    const wildcardRoot = getWildcardRoot(root, fileSpec);
    const hasDirectoryWildcard = (0, pathUtils_1.isDirectoryWildcardPatternPresent)(fileSpec);
    return {
        wildcardRoot,
        regExp,
        hasDirectoryWildcard,
    };
}
exports.getFileSpec = getFileSpec;
function fileSystemEntryExists(fs, uri, entryKind) {
    try {
        const stat = fs.statSync(uri);
        switch (entryKind) {
            case 0 /* FileSystemEntryKind.File */:
                return stat.isFile();
            case 1 /* FileSystemEntryKind.Directory */:
                return stat.isDirectory();
            default:
                return false;
        }
    }
    catch (e) {
        return false;
    }
}
function getDirectoryChangeKind(fs, oldDirectory, newDirectory) {
    if (oldDirectory.equals(newDirectory)) {
        return 'Same';
    }
    const relativePaths = oldDirectory.getRelativePathComponents(newDirectory);
    // 2 means only last folder name has changed.
    if (relativePaths.length === 2 && relativePaths[0] === '..' && relativePaths[1] !== '..') {
        return 'Renamed';
    }
    return 'Moved';
}
exports.getDirectoryChangeKind = getDirectoryChangeKind;
function deduplicateFolders(listOfFolders) {
    const foldersToWatch = new Map();
    listOfFolders.forEach((folders) => {
        folders.forEach((p) => {
            if (foldersToWatch.has(p.key)) {
                // Bail out on exact match.
                return;
            }
            for (const existing of foldersToWatch) {
                // ex) p: "/user/test" existing: "/user"
                if (p.startsWith(existing[1])) {
                    // We already have the parent folder in the watch list
                    return;
                }
                // ex) p: "/user" folderToWatch: "/user/test"
                if (existing[1].startsWith(p)) {
                    // We found better one to watch. replace.
                    foldersToWatch.delete(existing[0]);
                    foldersToWatch.set(p.key, p);
                    return;
                }
            }
            foldersToWatch.set(p.key, p);
        });
    });
    return [...foldersToWatch.values()];
}
exports.deduplicateFolders = deduplicateFolders;
function getRootUri(csdOrSp) {
    csdOrSp = caseSensitivityDetector_1.CaseSensitivityDetector.is(csdOrSp) ? csdOrSp : csdOrSp.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector);
    if (global.__rootDirectory) {
        return uri_1.Uri.file(global.__rootDirectory, csdOrSp);
    }
    return undefined;
}
exports.getRootUri = getRootUri;
function convertUriToLspUriString(fs, uri) {
    // Convert to a URI string that the LSP client understands (mapped files are only local to the server).
    return fs.getOriginalUri(uri).toString();
}
exports.convertUriToLspUriString = convertUriToLspUriString;
var UriEx;
(function (UriEx) {
    function file(path, arg, checkRelative) {
        const caseDetector = _getCaseSensitivityDetector(arg);
        return uri_1.Uri.file(path, caseDetector, checkRelative);
    }
    UriEx.file = file;
    function parse(value, arg) {
        const caseDetector = _getCaseSensitivityDetector(arg);
        return uri_1.Uri.parse(value, caseDetector);
    }
    UriEx.parse = parse;
    const caseSensitivityDetector = {
        isCaseSensitive: () => true,
    };
    const caseInsensitivityDetector = {
        isCaseSensitive: () => false,
    };
    function _getCaseSensitivityDetector(arg) {
        if (arg === undefined) {
            return caseSensitivityDetector;
        }
        return arg ? caseSensitivityDetector : caseInsensitivityDetector;
    }
})(UriEx || (exports.UriEx = UriEx = {}));
//# sourceMappingURL=uriUtils.js.map