"use strict";
/*
 * pathUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Pathname utility functions.
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
exports.isDiskPathRoot = exports.isRootedDiskPath = exports.getRegexEscapedSeparator = exports.hasPythonExtension = exports.getWildcardRoot = exports.isDirectoryWildcardPatternPresent = exports.getWildcardRegexPattern = exports.normalizePath = exports.stripFileExtension = exports.getShortenedFileName = exports.getFileName = exports.getFileExtension = exports.stripTrailingDirectorySeparator = exports.hasTrailingDirectorySeparator = exports.ensureTrailingDirectorySeparator = exports.getRelativePathComponentsFromDirectory = exports.getRelativePathFromDirectory = exports.getBaseFileName = exports.getAnyExtensionFromPath = exports.changeAnyExtension = exports.containsPath = exports.combinePaths = exports.resolvePaths = exports.normalizeSlashes = exports.getRelativePath = exports.combinePathComponents = exports.reducePathComponents = exports.getPathComponents = exports.getPathSeparator = exports.getRootLength = exports.getDirectoryPath = exports.FileSpec = void 0;
const path = __importStar(require("path"));
const collectionUtils_1 = require("./collectionUtils");
const core_1 = require("./core");
const debug = __importStar(require("./debug"));
const stringUtils_1 = require("./stringUtils");
const _includeFileRegex = /\.pyi?$/;
var FileSpec;
(function (FileSpec) {
    function is(value) {
        const candidate = value;
        return candidate && !!candidate.wildcardRoot && !!candidate.regExp;
    }
    FileSpec.is = is;
    function isInPath(path, paths) {
        return !!paths.find((p) => p.regExp.test(path));
    }
    FileSpec.isInPath = isInPath;
    function matchesIncludeFileRegex(filePath, isFile = true) {
        return isFile ? _includeFileRegex.test(filePath) : true;
    }
    FileSpec.matchesIncludeFileRegex = matchesIncludeFileRegex;
    function matchIncludeFileSpec(includeRegExp, exclude, filePath, isFile = true) {
        if (includeRegExp.test(filePath)) {
            if (!FileSpec.isInPath(filePath, exclude) && FileSpec.matchesIncludeFileRegex(filePath, isFile)) {
                return true;
            }
        }
        return false;
    }
    FileSpec.matchIncludeFileSpec = matchIncludeFileSpec;
})(FileSpec || (exports.FileSpec = FileSpec = {}));
function getDirectoryPath(pathString) {
    return pathString.substr(0, Math.max(getRootLength(pathString), pathString.lastIndexOf(path.sep)));
}
exports.getDirectoryPath = getDirectoryPath;
/**
 * Returns length of the root part of a path or URL (i.e. length of "/", "x:/", "//server/").
 */
function getRootLength(pathString, sep = path.sep) {
    if (pathString.charAt(0) === sep) {
        if (pathString.charAt(1) !== sep) {
            return 1; // POSIX: "/" (or non-normalized "\")
        }
        const p1 = pathString.indexOf(sep, 2);
        if (p1 < 0) {
            return pathString.length; // UNC: "//server" or "\\server"
        }
        return p1 + 1; // UNC: "//server/" or "\\server\"
    }
    if (pathString.charAt(1) === ':') {
        if (pathString.charAt(2) === sep) {
            return 3; // DOS: "c:/" or "c:\"
        }
        if (pathString.length === 2) {
            return 2; // DOS: "c:" (but not "c:d")
        }
    }
    return 0;
}
exports.getRootLength = getRootLength;
function getPathSeparator(pathString) {
    return path.sep;
}
exports.getPathSeparator = getPathSeparator;
function getPathComponents(pathString) {
    const normalizedPath = normalizeSlashes(pathString);
    const rootLength = getRootLength(normalizedPath);
    const root = normalizedPath.substring(0, rootLength);
    const sep = getPathSeparator(pathString);
    const rest = normalizedPath.substring(rootLength).split(sep);
    if (rest.length > 0 && !rest[rest.length - 1]) {
        rest.pop();
    }
    return reducePathComponents([root, ...rest]);
}
exports.getPathComponents = getPathComponents;
function reducePathComponents(components) {
    if (!(0, collectionUtils_1.some)(components)) {
        return [];
    }
    // Reduce the path components by eliminating
    // any '.' or '..'.
    const reduced = [components[0]];
    for (let i = 1; i < components.length; i++) {
        const component = components[i];
        if (!component || component === '.') {
            continue;
        }
        if (component === '..') {
            if (reduced.length > 1) {
                if (reduced[reduced.length - 1] !== '..') {
                    reduced.pop();
                    continue;
                }
            }
            else if (reduced[0]) {
                continue;
            }
        }
        reduced.push(component);
    }
    return reduced;
}
exports.reducePathComponents = reducePathComponents;
function combinePathComponents(components) {
    if (components.length === 0) {
        return '';
    }
    const root = components[0] && ensureTrailingDirectorySeparator(components[0]);
    const sep = getPathSeparator(root);
    return normalizeSlashes(root + components.slice(1).join(sep));
}
exports.combinePathComponents = combinePathComponents;
function getRelativePath(dirPath, relativeTo) {
    if (!dirPath.startsWith(ensureTrailingDirectorySeparator(relativeTo))) {
        return undefined;
    }
    const pathComponents = getPathComponents(dirPath);
    const relativeToComponents = getPathComponents(relativeTo);
    const sep = getPathSeparator(dirPath);
    let relativePath = '.';
    for (let i = relativeToComponents.length; i < pathComponents.length; i++) {
        relativePath += sep + pathComponents[i];
    }
    return relativePath;
}
exports.getRelativePath = getRelativePath;
const getInvalidSeparator = (sep) => (sep === '/' ? '\\' : '/');
function normalizeSlashes(pathString, sep = path.sep) {
    if (pathString.includes(getInvalidSeparator(sep))) {
        const separatorRegExp = /[\\/]/g;
        return pathString.replace(separatorRegExp, sep);
    }
    return pathString;
}
exports.normalizeSlashes = normalizeSlashes;
/**
 * Combines and resolves paths. If a path is absolute, it replaces any previous path. Any
 * `.` and `..` path components are resolved. Trailing directory separators are preserved.
 *
 * ```ts
 * resolvePath("/path", "to", "file.ext") === "path/to/file.ext"
 * resolvePath("/path", "to", "file.ext/") === "path/to/file.ext/"
 * resolvePath("/path", "dir", "..", "to", "file.ext") === "path/to/file.ext"
 * ```
 */
function resolvePaths(path, ...paths) {
    return normalizePath((0, collectionUtils_1.some)(paths) ? combinePaths(path, ...paths) : normalizeSlashes(path));
}
exports.resolvePaths = resolvePaths;
function combinePaths(pathString, ...paths) {
    if (pathString) {
        pathString = normalizeSlashes(pathString);
    }
    for (let relativePath of paths) {
        if (!relativePath) {
            continue;
        }
        relativePath = normalizeSlashes(relativePath);
        if (!pathString || getRootLength(relativePath) !== 0) {
            pathString = relativePath;
        }
        else {
            pathString = ensureTrailingDirectorySeparator(pathString) + relativePath;
        }
    }
    return pathString;
}
exports.combinePaths = combinePaths;
function containsPath(parent, child, currentDirectory, ignoreCase) {
    if (typeof currentDirectory === 'string') {
        parent = combinePaths(currentDirectory, parent);
        child = combinePaths(currentDirectory, child);
    }
    else if (typeof currentDirectory === 'boolean') {
        ignoreCase = currentDirectory;
    }
    if (parent === undefined || child === undefined) {
        return false;
    }
    if (parent === child) {
        return true;
    }
    const parentComponents = getPathComponents(parent);
    const childComponents = getPathComponents(child);
    if (childComponents.length < parentComponents.length) {
        return false;
    }
    const componentEqualityComparer = ignoreCase ? stringUtils_1.equateStringsCaseInsensitive : stringUtils_1.equateStringsCaseSensitive;
    for (let i = 0; i < parentComponents.length; i++) {
        const equalityComparer = i === 0 ? stringUtils_1.equateStringsCaseInsensitive : componentEqualityComparer;
        if (!equalityComparer(parentComponents[i], childComponents[i])) {
            return false;
        }
    }
    return true;
}
exports.containsPath = containsPath;
function changeAnyExtension(path, ext, extensions, ignoreCase) {
    const pathExt = extensions !== undefined && ignoreCase !== undefined
        ? getAnyExtensionFromPath(path, extensions, ignoreCase)
        : getAnyExtensionFromPath(path);
    return pathExt ? path.slice(0, path.length - pathExt.length) + (ext.startsWith('.') ? ext : '.' + ext) : path;
}
exports.changeAnyExtension = changeAnyExtension;
function getAnyExtensionFromPath(path, extensions, ignoreCase) {
    // Retrieves any string from the final "." onwards from a base file name.
    // Unlike extensionFromPath, which throws an exception on unrecognized extensions.
    if (extensions) {
        return getAnyExtensionFromPathWorker(stripTrailingDirectorySeparator(path), extensions, ignoreCase ? stringUtils_1.equateStringsCaseInsensitive : stringUtils_1.equateStringsCaseSensitive);
    }
    const baseFileName = getBaseFileName(path);
    const extensionIndex = baseFileName.lastIndexOf('.');
    if (extensionIndex >= 0) {
        return baseFileName.substring(extensionIndex);
    }
    return '';
}
exports.getAnyExtensionFromPath = getAnyExtensionFromPath;
function getBaseFileName(pathString, extensions, ignoreCase) {
    pathString = normalizeSlashes(pathString);
    // if the path provided is itself the root, then it has not file name.
    const rootLength = getRootLength(pathString);
    if (rootLength === pathString.length) {
        return '';
    }
    // return the trailing portion of the path starting after the last (non-terminal) directory
    // separator but not including any trailing directory separator.
    pathString = stripTrailingDirectorySeparator(pathString);
    const name = pathString.slice(Math.max(getRootLength(pathString), pathString.lastIndexOf(path.sep) + 1));
    const extension = extensions !== undefined && ignoreCase !== undefined
        ? getAnyExtensionFromPath(name, extensions, ignoreCase)
        : undefined;
    return extension ? name.slice(0, name.length - extension.length) : name;
}
exports.getBaseFileName = getBaseFileName;
function getRelativePathFromDirectory(fromDirectory, to, getCanonicalFileNameOrIgnoreCase) {
    const pathComponents = getRelativePathComponentsFromDirectory(fromDirectory, to, getCanonicalFileNameOrIgnoreCase);
    return combinePathComponents(pathComponents);
}
exports.getRelativePathFromDirectory = getRelativePathFromDirectory;
function getRelativePathComponentsFromDirectory(fromDirectory, to, getCanonicalFileNameOrIgnoreCase) {
    debug.assert(getRootLength(fromDirectory) > 0 === getRootLength(to) > 0, 'Paths must either both be absolute or both be relative');
    const getCanonicalFileName = typeof getCanonicalFileNameOrIgnoreCase === 'function' ? getCanonicalFileNameOrIgnoreCase : core_1.identity;
    const ignoreCase = typeof getCanonicalFileNameOrIgnoreCase === 'boolean' ? getCanonicalFileNameOrIgnoreCase : false;
    const pathComponents = getPathComponentsRelativeTo(fromDirectory, to, ignoreCase ? stringUtils_1.equateStringsCaseInsensitive : stringUtils_1.equateStringsCaseSensitive, getCanonicalFileName);
    return pathComponents;
}
exports.getRelativePathComponentsFromDirectory = getRelativePathComponentsFromDirectory;
function ensureTrailingDirectorySeparator(pathString) {
    const sep = getPathSeparator(pathString);
    if (!hasTrailingDirectorySeparator(pathString)) {
        return pathString + sep;
    }
    return pathString;
}
exports.ensureTrailingDirectorySeparator = ensureTrailingDirectorySeparator;
function hasTrailingDirectorySeparator(pathString) {
    if (pathString.length === 0) {
        return false;
    }
    const ch = pathString.charCodeAt(pathString.length - 1);
    return ch === 47 /* Char.Slash */ || ch === 92 /* Char.Backslash */;
}
exports.hasTrailingDirectorySeparator = hasTrailingDirectorySeparator;
function stripTrailingDirectorySeparator(pathString) {
    if (!hasTrailingDirectorySeparator(pathString)) {
        return pathString;
    }
    return pathString.slice(0, pathString.length - 1);
}
exports.stripTrailingDirectorySeparator = stripTrailingDirectorySeparator;
function getFileExtension(fileName, multiDotExtension = false) {
    if (!multiDotExtension) {
        return path.extname(fileName);
    }
    fileName = getFileName(fileName);
    const firstDotIndex = fileName.indexOf('.');
    return fileName.slice(firstDotIndex);
}
exports.getFileExtension = getFileExtension;
function getFileName(pathString) {
    return path.basename(pathString);
}
exports.getFileName = getFileName;
function getShortenedFileName(pathString, maxDirLength = 15) {
    const fileName = getFileName(pathString);
    const dirName = getDirectoryPath(pathString);
    if (dirName.length > maxDirLength) {
        return `...${dirName.slice(dirName.length - maxDirLength)}${path.sep}${fileName}`;
    }
    return pathString;
}
exports.getShortenedFileName = getShortenedFileName;
function stripFileExtension(fileName, multiDotExtension = false) {
    const ext = getFileExtension(fileName, multiDotExtension);
    return fileName.substr(0, fileName.length - ext.length);
}
exports.stripFileExtension = stripFileExtension;
function normalizePath(pathString) {
    return normalizeSlashes(path.normalize(pathString));
}
exports.normalizePath = normalizePath;
// Transforms a relative file spec (one that potentially contains
// escape characters **, * or ?) and returns a regular expression
// that can be used for matching against.
function getWildcardRegexPattern(rootPath, fileSpec) {
    let absolutePath = normalizePath(combinePaths(rootPath, fileSpec));
    if (!hasPythonExtension(absolutePath)) {
        absolutePath = ensureTrailingDirectorySeparator(absolutePath);
    }
    const pathComponents = getPathComponents(absolutePath);
    const escapedSeparator = getRegexEscapedSeparator(getPathSeparator(rootPath));
    const doubleAsteriskRegexFragment = `(${escapedSeparator}[^${escapedSeparator}][^${escapedSeparator}]*)*?`;
    const reservedCharacterPattern = new RegExp(`[^\\w\\s${escapedSeparator}]`, 'g');
    // Strip the directory separator from the root component.
    if (pathComponents.length > 0) {
        pathComponents[0] = stripTrailingDirectorySeparator(pathComponents[0]);
        if (pathComponents[0].startsWith('\\\\')) {
            pathComponents[0] = '\\\\' + pathComponents[0];
        }
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
// Determines whether the file spec contains a directory wildcard pattern ("**").
function isDirectoryWildcardPatternPresent(fileSpec) {
    const path = normalizePath(fileSpec);
    const pathComponents = getPathComponents(path);
    for (const component of pathComponents) {
        if (component === '**') {
            return true;
        }
    }
    return false;
}
exports.isDirectoryWildcardPatternPresent = isDirectoryWildcardPatternPresent;
// Returns the topmost path that contains no wildcard characters.
function getWildcardRoot(rootPath, fileSpec) {
    let absolutePath = normalizePath(combinePaths(rootPath, fileSpec));
    if (!hasPythonExtension(absolutePath)) {
        absolutePath = ensureTrailingDirectorySeparator(absolutePath);
    }
    const pathComponents = getPathComponents(absolutePath);
    const sep = getPathSeparator(absolutePath);
    // Strip the directory separator from the root component.
    if (pathComponents.length > 0) {
        pathComponents[0] = stripTrailingDirectorySeparator(pathComponents[0]);
    }
    if (pathComponents.length === 1 && !pathComponents[0]) {
        return sep;
    }
    let wildcardRoot = '';
    let firstComponent = true;
    for (let component of pathComponents) {
        if (component === '**') {
            break;
        }
        else {
            if (component.match(/[*?]/)) {
                break;
            }
            if (!firstComponent) {
                component = sep + component;
            }
            wildcardRoot += component;
            firstComponent = false;
        }
    }
    return wildcardRoot;
}
exports.getWildcardRoot = getWildcardRoot;
function hasPythonExtension(path) {
    return path.endsWith('.py') || path.endsWith('.pyi');
}
exports.hasPythonExtension = hasPythonExtension;
function getRegexEscapedSeparator(pathSep = path.sep) {
    // we don't need to escape "/" in typescript regular expression
    return pathSep === '/' ? '/' : '\\\\';
}
exports.getRegexEscapedSeparator = getRegexEscapedSeparator;
/**
 * Determines whether a path is an absolute disk path (e.g. starts with `/`, or a dos path
 * like `c:`, `c:\` or `c:/`).
 */
function isRootedDiskPath(path) {
    return getRootLength(path) > 0;
}
exports.isRootedDiskPath = isRootedDiskPath;
/**
 * Determines whether a path consists only of a path root.
 */
function isDiskPathRoot(path) {
    const rootLength = getRootLength(path);
    return rootLength > 0 && rootLength === path.length;
}
exports.isDiskPathRoot = isDiskPathRoot;
function getAnyExtensionFromPathWorker(path, extensions, stringEqualityComparer) {
    if (typeof extensions === 'string') {
        return tryGetExtensionFromPath(path, extensions, stringEqualityComparer) || '';
    }
    for (const extension of extensions) {
        const result = tryGetExtensionFromPath(path, extension, stringEqualityComparer);
        if (result) {
            return result;
        }
    }
    return '';
}
function tryGetExtensionFromPath(path, extension, stringEqualityComparer) {
    if (!extension.startsWith('.')) {
        extension = '.' + extension;
    }
    if (path.length >= extension.length && path.charCodeAt(path.length - extension.length) === 46 /* Char.Period */) {
        const pathExtension = path.slice(path.length - extension.length);
        if (stringEqualityComparer(pathExtension, extension)) {
            return pathExtension;
        }
    }
    return undefined;
}
function getPathComponentsRelativeTo(from, to, stringEqualityComparer, getCanonicalFileName) {
    const fromComponents = getPathComponents(from);
    const toComponents = getPathComponents(to);
    let start;
    for (start = 0; start < fromComponents.length && start < toComponents.length; start++) {
        const fromComponent = getCanonicalFileName(fromComponents[start]);
        const toComponent = getCanonicalFileName(toComponents[start]);
        const comparer = start === 0 ? stringUtils_1.equateStringsCaseInsensitive : stringEqualityComparer;
        if (!comparer(fromComponent, toComponent)) {
            break;
        }
    }
    if (start === 0) {
        return toComponents;
    }
    const components = toComponents.slice(start);
    const relative = [];
    for (; start < fromComponents.length; start++) {
        relative.push('..');
    }
    return ['', ...relative, ...components];
}
//# sourceMappingURL=pathUtils.js.map