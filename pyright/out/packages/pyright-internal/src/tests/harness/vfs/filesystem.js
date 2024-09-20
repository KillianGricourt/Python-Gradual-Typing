"use strict";
/*
 * filesystem.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * virtual file system implementation
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
exports.formatPatch = exports.Mount = exports.S_IFIFO = exports.S_IFCHR = exports.S_IFDIR = exports.S_IFBLK = exports.S_IFREG = exports.S_IFLNK = exports.S_IFSOCK = exports.S_IFMT = exports.Symlink = exports.Unlink = exports.Rmdir = exports.Link = exports.SameFileContentFile = exports.File = exports.Directory = exports.TestFileSystem = exports.TestFileSystemWatcher = exports.MODULE_PATH = void 0;
const pathUtil = __importStar(require("../../../common/pathUtils"));
const stringUtils_1 = require("../../../common/stringUtils");
const fileUri_1 = require("../../../common/uri/fileUri");
const uri_1 = require("../../../common/uri/uri");
const utils_1 = require("../utils");
const utils_2 = require("./../utils");
const pathValidation_1 = require("./pathValidation");
exports.MODULE_PATH = pathUtil.normalizeSlashes('/');
let devCount = 0; // A monotonically increasing count of device ids
let inoCount = 0; // A monotonically increasing count of inodes
class TestFileSystemWatcher {
    constructor(_paths, _listener) {
        this._paths = _paths;
        this._listener = _listener;
    }
    close() {
        // Do nothing.
    }
    fireFileChange(path, eventType) {
        if (this._paths.some((p) => path.startsWith(p))) {
            this._listener(eventType, path.getFilePath());
            return true;
        }
        return false;
    }
}
exports.TestFileSystemWatcher = TestFileSystemWatcher;
/**
 * Represents a virtual POSIX-like file system.
 */
class TestFileSystem {
    constructor(ignoreCase, options = {}) {
        // lazy-initialized state that should be mutable even if the FileSystem is frozen.
        this._lazy = {};
        this._tmpfileCounter = 0;
        this._watchers = [];
        this._id = TestFileSystem._nextId++;
        const { time = -1, files, meta } = options;
        this.ignoreCase = ignoreCase;
        this.stringComparer = this.ignoreCase ? stringUtils_1.compareStringsCaseInsensitive : stringUtils_1.compareStringsCaseSensitive;
        this._time = time;
        if (meta) {
            for (const key of Object.keys(meta)) {
                this.meta.set(key, meta[key]);
            }
        }
        if (files) {
            this._applyFiles(files, /* dirname */ '');
        }
        let cwd = options.cwd;
        if ((!cwd || !pathUtil.isDiskPathRoot(cwd)) && this._lazy.links) {
            const iterator = (0, utils_2.getIterator)(this._lazy.links.keys());
            try {
                for (let i = (0, utils_2.nextResult)(iterator); i; i = (0, utils_2.nextResult)(iterator)) {
                    const name = i.value;
                    cwd = cwd ? pathUtil.resolvePaths(name, cwd) : name;
                    break;
                }
            }
            finally {
                (0, utils_2.closeIterator)(iterator);
            }
        }
        if (cwd) {
            (0, pathValidation_1.validate)(cwd, 2017 /* ValidationFlags.Absolute */);
            this.mkdirpSync(cwd);
        }
        this._cwd = cwd || '';
    }
    /**
     * Gets metadata for this `FileSystem`.
     */
    get meta() {
        if (!this._lazy.meta) {
            this._lazy.meta = new utils_2.Metadata(this._shadowRoot ? this._shadowRoot.meta : undefined);
        }
        return this._lazy.meta;
    }
    /**
     * Gets a value indicating whether the file system is read-only.
     */
    get isReadonly() {
        return Object.isFrozen(this);
    }
    /**
     * Gets the file system shadowed by this file system.
     */
    get shadowRoot() {
        return this._shadowRoot;
    }
    /**
     * Makes the file system read-only.
     */
    makeReadonly() {
        Object.freeze(this);
        return this;
    }
    /**
     * Snapshots the current file system, effectively shadowing itself. This is useful for
     * generating file system patches using `.diff()` from one snapshot to the next. Performs
     * no action if this file system is read-only.
     */
    snapshot() {
        if (this.isReadonly) {
            return;
        }
        const fs = new TestFileSystem(this.ignoreCase, { time: this._time });
        fs._lazy = this._lazy;
        fs._cwd = this._cwd;
        fs._time = this._time;
        fs._shadowRoot = this._shadowRoot;
        fs._dirStack = this._dirStack;
        fs.makeReadonly();
        this._lazy = {};
        this._shadowRoot = fs;
    }
    /**
     * Gets a shadow copy of this file system. Changes to the shadow copy do not affect the
     * original, allowing multiple copies of the same core file system without multiple copies
     * of the same data.
     */
    shadow(ignoreCase = this.ignoreCase) {
        if (!this.isReadonly) {
            throw new Error('Cannot shadow a mutable file system.');
        }
        if (ignoreCase && !this.ignoreCase) {
            throw new Error('Cannot create a case-insensitive file system from a case-sensitive one.');
        }
        const fs = new TestFileSystem(ignoreCase, { time: this._time });
        fs._shadowRoot = this;
        fs._cwd = this._cwd;
        return fs;
    }
    /**
     * Gets or sets the timestamp (in milliseconds) used for file status, returning the previous timestamp.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/time.html
     */
    time(value) {
        if (value !== undefined && this.isReadonly) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        let result = this._time;
        if (typeof result === 'function') {
            result = result();
        }
        if (typeof result === 'object') {
            result = result.getTime();
        }
        if (result === -1) {
            result = Date.now();
        }
        if (value !== undefined) {
            this._time = value;
        }
        return result;
    }
    /**
     * Gets the metadata object for a path.
     * @param path
     */
    filemeta(path) {
        const { node } = this._walk(this._resolve(path));
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        return this._filemeta(node);
    }
    /**
     * Get the pathname of the current working directory.
     *
     * @link - http://pubs.opengroup.org/onlinepubs/9699919799/functions/getcwd.html
     */
    cwd() {
        if (!this._cwd) {
            throw new Error('The current working directory has not been set.');
        }
        const { node } = this._walk(this._cwd);
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        if (!isDirectory(node)) {
            throw (0, utils_1.createIOError)('ENOTDIR');
        }
        return this._cwd;
    }
    /**
     * Changes the current working directory.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/chdir.html
     */
    chdir(uri) {
        let path = uri.getFilePath();
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        path = this._resolve(path);
        const { node } = this._walk(path);
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        if (!isDirectory(node)) {
            throw (0, utils_1.createIOError)('ENOTDIR');
        }
        this._cwd = path;
    }
    /**
     * Pushes the current directory onto the directory stack and changes the current working directory to the supplied path.
     */
    pushd(path) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        if (path) {
            path = this._resolve(path);
        }
        if (this._cwd) {
            if (!this._dirStack) {
                this._dirStack = [];
            }
            this._dirStack.push(this._cwd);
        }
        if (path && path !== this._cwd) {
            this.chdir(uri_1.Uri.file(path, this));
        }
    }
    /**
     * Pops the previous directory from the location stack and changes the current directory to that directory.
     */
    popd() {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        const path = this._dirStack && this._dirStack.pop();
        if (path) {
            this.chdir(uri_1.Uri.file(path, this));
        }
    }
    /**
     * Update the file system with a set of files.
     */
    apply(files) {
        this._applyFiles(files, this._cwd);
    }
    /**
     * Scan file system entries along a path. If `path` is a symbolic link, it is dereferenced.
     * @param path The path at which to start the scan.
     * @param axis The axis along which to traverse.
     * @param traversal The traversal scheme to use.
     */
    scanSync(path, axis, traversal) {
        path = this._resolve(path);
        const results = [];
        this._scan(path, this._stat(this._walk(path)), axis, traversal, /* noFollow */ false, results);
        return results;
    }
    /**
     * Scan file system entries along a path.
     * @param path The path at which to start the scan.
     * @param axis The axis along which to traverse.
     * @param traversal The traversal scheme to use.
     */
    lscanSync(path, axis, traversal) {
        path = this._resolve(path);
        const results = [];
        this._scan(path, this._stat(this._walk(path, /* noFollow */ true)), axis, traversal, 
        /* noFollow */ true, results);
        return results;
    }
    createFileSystemWatcher(paths, listener) {
        const watcher = new TestFileSystemWatcher(paths, listener);
        this._watchers.push(watcher);
        return watcher;
    }
    fireFileWatcherEvent(path, event) {
        for (const watcher of this._watchers) {
            if (watcher.fireFileChange(uri_1.Uri.file(path, this), event)) {
                break;
            }
        }
    }
    getModulePath() {
        return uri_1.Uri.file(exports.MODULE_PATH, this);
    }
    isCaseSensitive(uri) {
        if (uri.startsWith(fileUri_1.FileUriSchema)) {
            return !this.ignoreCase;
        }
        return true;
    }
    isLocalFileSystemCaseSensitive() {
        return !this.ignoreCase;
    }
    tmpdir() {
        this.mkdirpSync('/tmp');
        return uri_1.Uri.parse('file:///tmp', this);
    }
    tmpfile(options) {
        // Use an algorithm similar to tmp's.
        const prefix = (options === null || options === void 0 ? void 0 : options.prefix) || 'tmp';
        const postfix = (options === null || options === void 0 ? void 0 : options.prefix) ? '-' + options.prefix : '';
        const name = `${prefix}-${this._tmpfileCounter++}${postfix}`;
        const path = this.tmpdir().combinePaths(name);
        this.writeFileSync(path, '');
        return path;
    }
    mktmpdir() {
        this.mkdirpSync('/tmp/1');
        return uri_1.Uri.parse('file:///tmp/1', this);
    }
    realCasePath(path) {
        return path;
    }
    isMappedUri(filepath) {
        return false;
    }
    // Get original filepath if the given filepath is mapped.
    getOriginalUri(mappedFilePath) {
        return mappedFilePath;
    }
    // Get mapped filepath if the given filepath is mapped.
    getMappedUri(originalFilepath) {
        return originalFilepath;
    }
    /**
     * Mounts a physical or virtual file system at a location in this virtual file system.
     *
     * @param source The path in the physical (or other virtual) file system.
     * @param target The path in this virtual file system.
     * @param resolver An object used to resolve files in `source`.
     */
    mountSync(source, target, resolver) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        source = (0, pathValidation_1.validate)(source, 2017 /* ValidationFlags.Absolute */);
        const { parent, links, node: existingNode, basename } = this._walk(this._resolve(target), /* noFollow */ true);
        if (existingNode) {
            throw (0, utils_1.createIOError)('EEXIST');
        }
        const time = this.time();
        const node = this._mknod(parent ? parent.dev : ++devCount, exports.S_IFDIR, /* mode */ 0o777, time);
        node.source = source;
        node.resolver = resolver;
        this._addLink(parent, links, basename, node, time);
    }
    /**
     * Recursively remove all files and directories underneath the provided path.
     */
    rimrafSync(path) {
        try {
            const stats = this.lstatSync(path);
            if (stats.isFile() || stats.isSymbolicLink()) {
                this.unlinkSync(uri_1.Uri.file(path, this));
            }
            else if (stats.isDirectory()) {
                for (const file of this.readdirSync(uri_1.Uri.file(path, this))) {
                    this.rimrafSync(pathUtil.combinePaths(path, file));
                }
                this.rmdirSync(uri_1.Uri.file(path, this));
            }
        }
        catch (e) {
            if (e.code === 'ENOENT') {
                return;
            }
            throw e;
        }
    }
    /**
     * Make a directory and all of its parent paths (if they don't exist).
     */
    mkdirpSync(path) {
        path = this._resolve(path);
        const result = this._walk(path, /* noFollow */ true, (error, result) => {
            if (error.code === 'ENOENT') {
                this._mkdir(result);
                return 'retry';
            }
            return 'throw';
        });
        if (!result.node) {
            this._mkdir(result);
        }
    }
    getFileListing(filter) {
        let result = '';
        const addToResult = (path, add) => {
            if (!filter || filter(path)) {
                result += add;
            }
        };
        const printLinks = (dirname, links) => {
            const iterator = (0, utils_2.getIterator)(links);
            try {
                for (let i = (0, utils_2.nextResult)(iterator); i; i = (0, utils_2.nextResult)(iterator)) {
                    const [name, node] = i.value;
                    const path = dirname ? pathUtil.combinePaths(dirname, name) : name;
                    const marker = this.stringComparer(this._cwd, path) === 0 ? '*' : ' ';
                    if (result) {
                        addToResult(path, '\n');
                    }
                    addToResult(path, marker);
                    if (isDirectory(node)) {
                        addToResult(path, pathUtil.ensureTrailingDirectorySeparator(path));
                        printLinks(path, this._getLinks(node));
                    }
                    else if (isFile(node)) {
                        addToResult(path, path);
                    }
                    else if (isSymlink(node)) {
                        addToResult(path, `${path} -> ${node.symlink}`);
                    }
                }
            }
            finally {
                (0, utils_2.closeIterator)(iterator);
            }
        };
        printLinks(/* dirname */ undefined, this._getRootLinks());
        return result;
    }
    /**
     * Print diagnostic information about the structure of the file system to the console.
     */
    debugPrint(filter) {
        console.log(this.getFileListing(filter));
    }
    // POSIX API (aligns with NodeJS "fs" module API)
    /**
     * Determines whether a path exists.
     */
    existsSync(path) {
        if (path.isEmpty()) {
            return false;
        }
        const result = this._walk(this._resolve(path.getFilePath()), /* noFollow */ true, () => 'stop');
        return result !== undefined && result.node !== undefined;
    }
    /**
     * Get file status. If `path` is a symbolic link, it is dereferenced.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/stat.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    statSync(path) {
        return this._stat(this._walk(this._resolve(path.getFilePath())));
    }
    /**
     * Change file access times
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    utimesSync(path, atime, mtime) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        if (!isFinite(+atime) || !isFinite(+mtime)) {
            throw (0, utils_1.createIOError)('EINVAL');
        }
        const entry = this._walk(this._resolve(path));
        if (!entry || !entry.node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        entry.node.atimeMs = +atime;
        entry.node.mtimeMs = +mtime;
        entry.node.ctimeMs = this.time();
    }
    /**
     * Get file status. If `path` is a symbolic link, it is dereferenced.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/lstat.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    lstatSync(path) {
        return this._stat(this._walk(this._resolve(path), /* noFollow */ true));
    }
    /**
     * Read a directory. If `path` is a symbolic link, it is dereferenced.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/readdir.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    readdirSync(path) {
        const { node } = this._walk(this._resolve(path.getFilePath()));
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        if (!isDirectory(node)) {
            throw (0, utils_1.createIOError)('ENOTDIR');
        }
        return Array.from(this._getLinks(node).keys());
    }
    /**
     * Read a directory. If `path` is a symbolic link, it is dereferenced.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/readdir.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    readdirEntriesSync(path) {
        const { node } = this._walk(this._resolve(path.getFilePath()));
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        if (!isDirectory(node)) {
            throw (0, utils_1.createIOError)('ENOTDIR');
        }
        const entries = Array.from(this._getLinks(node).entries());
        return entries.map(([k, v]) => makeDirEnt(k, v));
    }
    /**
     * Make a directory.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/mkdir.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    mkdirSync(path, options) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        if (options === null || options === void 0 ? void 0 : options.recursive) {
            this.mkdirpSync(path.getFilePath());
            return;
        }
        this._mkdir(this._walk(this._resolve(path.getFilePath()), /* noFollow */ true));
    }
    /**
     * Remove a directory.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/rmdir.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    rmdirSync(uri) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        const path = this._resolve(uri.getFilePath());
        const { parent, links, node, basename } = this._walk(path, /* noFollow */ true);
        if (!parent) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        if (!isDirectory(node)) {
            throw (0, utils_1.createIOError)('ENOTDIR');
        }
        if (this._getLinks(node).size !== 0) {
            throw (0, utils_1.createIOError)('ENOTEMPTY');
        }
        this._removeLink(parent, links, basename, node);
    }
    /**
     * Link one file to another file (also known as a "hard link").
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/link.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    linkSync(oldpath, newpath) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        const { node } = this._walk(this._resolve(oldpath));
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        if (isDirectory(node)) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        const { parent, links, basename, node: existingNode } = this._walk(this._resolve(newpath), /* noFollow */ true);
        if (!parent) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        if (existingNode) {
            throw (0, utils_1.createIOError)('EEXIST');
        }
        this._addLink(parent, links, basename, node);
    }
    /**
     * Remove a directory entry.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/unlink.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    unlinkSync(path) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        const { parent, links, node, basename } = this._walk(this._resolve(path.getFilePath()), /* noFollow */ true);
        if (!parent) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        if (isDirectory(node)) {
            throw (0, utils_1.createIOError)('EISDIR');
        }
        this._removeLink(parent, links, basename, node);
    }
    /**
     * Rename a file.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    renameSync(oldpath, newpath) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        const { parent: oldParent, links: oldParentLinks, node, basename: oldBasename, } = this._walk(this._resolve(oldpath), /* noFollow */ true);
        if (!oldParent) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        const { parent: newParent, links: newParentLinks, node: existingNode, basename: newBasename, } = this._walk(this._resolve(newpath), /* noFollow */ true);
        if (!newParent) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        const time = this.time();
        if (existingNode) {
            if (isDirectory(node)) {
                if (!isDirectory(existingNode)) {
                    throw (0, utils_1.createIOError)('ENOTDIR');
                }
                if (this._getLinks(existingNode).size > 0) {
                    throw (0, utils_1.createIOError)('ENOTEMPTY');
                }
            }
            else {
                if (isDirectory(existingNode)) {
                    throw (0, utils_1.createIOError)('EISDIR');
                }
            }
            this._removeLink(newParent, newParentLinks, newBasename, existingNode, time);
        }
        this._replaceLink(oldParent, oldParentLinks, oldBasename, newParent, newParentLinks, newBasename, node, time);
    }
    /**
     * Make a symbolic link.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/symlink.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    symlinkSync(target, linkpath) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        const { parent, links, node: existingNode, basename, } = this._walk(this._resolve(linkpath), /* noFollow */ true);
        if (!parent) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        if (existingNode) {
            throw (0, utils_1.createIOError)('EEXIST');
        }
        const time = this.time();
        const node = this._mknod(parent.dev, exports.S_IFLNK, /* mode */ 0o666, time);
        node.symlink = (0, pathValidation_1.validate)(target, 2016 /* ValidationFlags.RelativeOrAbsolute */);
        this._addLink(parent, links, basename, node, time);
    }
    /**
     * Resolve a pathname.
     *
     * @link http://pubs.opengroup.org/onlinepubs/9699919799/functions/realpath.html
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    realpathSync(path) {
        try {
            const { realpath } = this._walk(this._resolve(path.getFilePath()));
            return uri_1.Uri.file(realpath, this);
        }
        catch (e) {
            return path;
        }
    }
    readFileSync(path, encoding = null) {
        const { node } = this._walk(this._resolve(path.getFilePath()));
        if (!node) {
            throw (0, utils_1.createIOError)('ENOENT');
        }
        if (isDirectory(node)) {
            throw (0, utils_1.createIOError)('EISDIR');
        }
        if (!isFile(node)) {
            throw (0, utils_1.createIOError)('EBADF');
        }
        const buffer = this._getBuffer(node).slice();
        return encoding ? buffer.toString(encoding) : buffer;
    }
    /**
     * Write to a file.
     *
     * NOTE: do not rename this method as it is intended to align with the same named export of the "fs" module.
     */
    writeFileSync(uri, data, encoding = null) {
        if (this.isReadonly) {
            throw (0, utils_1.createIOError)('EROFS');
        }
        const { parent, links, node: existingNode, basename, } = this._walk(this._resolve(uri.getFilePath()), /* noFollow */ false);
        if (!parent) {
            throw (0, utils_1.createIOError)('EPERM');
        }
        const time = this.time();
        let node = existingNode;
        if (!node) {
            node = this._mknod(parent.dev, exports.S_IFREG, 0o666, time);
            this._addLink(parent, links, basename, node, time);
        }
        if (isDirectory(node)) {
            throw (0, utils_1.createIOError)('EISDIR');
        }
        if (!isFile(node)) {
            throw (0, utils_1.createIOError)('EBADF');
        }
        node.buffer = Buffer.isBuffer(data)
            ? data.slice()
            : (0, utils_1.bufferFrom)('' + data, encoding || 'utf8');
        node.size = node.buffer.byteLength;
        node.mtimeMs = time;
        node.ctimeMs = time;
    }
    readFile(fileUri) {
        return Promise.resolve(this.readFileSync(fileUri));
    }
    readFileText(fileUri, encoding) {
        return Promise.resolve(this.readFileSync(fileUri, encoding || 'utf8'));
    }
    createReadStream(path) {
        throw new Error('Not implemented in test file system.');
    }
    createWriteStream(path) {
        throw new Error('Not implemented in test file system.');
    }
    copyFileSync(src, dst) {
        throw new Error('Not implemented in test file system.');
    }
    /**
     * Generates a `FileSet` patch containing all the entries in this `FileSystem` that are not in `base`.
     * @param base The base file system. If not provided, this file system's `shadowRoot` is used (if present).
     */
    diff(base = this.shadowRoot, options = {}) {
        const differences = {};
        const hasDifferences = base
            ? TestFileSystem._rootDiff(differences, this, base, options)
            : TestFileSystem._trackCreatedInodes(differences, this, this._getRootLinks());
        return hasDifferences ? differences : undefined;
    }
    /**
     * Generates a `FileSet` patch containing all the entries in `changed` that are not in `base`.
     */
    static diff(changed, base, options = {}) {
        const differences = {};
        return TestFileSystem._rootDiff(differences, changed, base, options) ? differences : undefined;
    }
    isInZip(path) {
        return false;
    }
    dispose() {
        // Do Nothing
    }
    _mkdir({ parent, links, node: existingNode, basename }) {
        if (existingNode) {
            throw (0, utils_1.createIOError)('EEXIST');
        }
        const time = this.time();
        const node = this._mknod(parent ? parent.dev : ++devCount, exports.S_IFDIR, /* mode */ 0o777, time);
        this._addLink(parent, links, basename, node, time);
    }
    _filemeta(node) {
        if (!node.meta) {
            const parentMeta = node.shadowRoot && this._shadowRoot && this._shadowRoot._filemeta(node.shadowRoot);
            node.meta = new utils_2.Metadata(parentMeta);
        }
        return node.meta;
    }
    _scan(path, stats, axis, traversal, noFollow, results) {
        if (axis === 'ancestors-or-self' || axis === 'self' || axis === 'descendants-or-self') {
            if (!traversal.accept || traversal.accept(path, stats)) {
                results.push(path);
            }
        }
        if (axis === 'ancestors-or-self' || axis === 'ancestors') {
            const dirname = pathUtil.getDirectoryPath(path);
            if (dirname !== path) {
                try {
                    const stats = this._stat(this._walk(dirname, noFollow));
                    if (!traversal.traverse || traversal.traverse(dirname, stats)) {
                        this._scan(dirname, stats, 'ancestors-or-self', traversal, noFollow, results);
                    }
                }
                catch {
                    /* ignored */
                }
            }
        }
        if (axis === 'descendants-or-self' || axis === 'descendants') {
            if (stats.isDirectory() && (!traversal.traverse || traversal.traverse(path, stats))) {
                for (const file of this.readdirSync(uri_1.Uri.file(path, this))) {
                    try {
                        const childpath = pathUtil.combinePaths(path, file);
                        const stats = this._stat(this._walk(childpath, noFollow));
                        this._scan(childpath, stats, 'descendants-or-self', traversal, noFollow, results);
                    }
                    catch {
                        /* ignored */
                    }
                }
            }
        }
    }
    _stat(entry) {
        const node = entry.node;
        if (!node) {
            throw (0, utils_1.createIOError)(`ENOENT`, entry.realpath);
        }
        return new Stats(node.dev, node.ino, node.mode, node.nlink, 
        /* rdev */ 0, 
        /* size */ isFile(node) ? this._getSize(node) : isSymlink(node) ? node.symlink.length : 0, 
        /* blksize */ 4096, 
        /* blocks */ 0, node.atimeMs, node.mtimeMs, node.ctimeMs, node.birthtimeMs);
    }
    static _diffWorker(container, changed, changedLinks, base, baseLinks, options) {
        if (changedLinks && !baseLinks) {
            return TestFileSystem._trackCreatedInodes(container, changed, changedLinks);
        }
        if (baseLinks && !changedLinks) {
            return TestFileSystem._trackDeletedInodes(container, baseLinks);
        }
        if (changedLinks && baseLinks) {
            let hasChanges = false;
            // track base items missing in changed
            baseLinks.forEach((node, basename) => {
                if (!changedLinks.has(basename)) {
                    container[basename] = isDirectory(node) ? new Rmdir() : new Unlink();
                    hasChanges = true;
                }
            });
            // track changed items missing or differing in base
            changedLinks.forEach((changedNode, basename) => {
                const baseNode = baseLinks.get(basename);
                if (baseNode) {
                    if (isDirectory(changedNode) && isDirectory(baseNode)) {
                        return (hasChanges =
                            TestFileSystem._directoryDiff(container, basename, changed, changedNode, base, baseNode, options) || hasChanges);
                    }
                    if (isFile(changedNode) && isFile(baseNode)) {
                        return (hasChanges =
                            TestFileSystem._fileDiff(container, basename, changed, changedNode, base, baseNode, options) || hasChanges);
                    }
                    if (isSymlink(changedNode) && isSymlink(baseNode)) {
                        return (hasChanges =
                            TestFileSystem._symlinkDiff(container, basename, changedNode, baseNode) || hasChanges);
                    }
                }
                return (hasChanges =
                    TestFileSystem._trackCreatedInode(container, basename, changed, changedNode) || hasChanges);
            });
            return hasChanges;
        }
        return false;
    }
    static _rootDiff(container, changed, base, options) {
        while (!changed._lazy.links && changed._shadowRoot) {
            changed = changed._shadowRoot;
        }
        while (!base._lazy.links && base._shadowRoot) {
            base = base._shadowRoot;
        }
        // no difference if the file systems are the same reference
        if (changed === base) {
            return false;
        }
        // no difference if the root links are empty and not shadowed
        if (!changed._lazy.links && !changed._shadowRoot && !base._lazy.links && !base._shadowRoot) {
            return false;
        }
        return TestFileSystem._diffWorker(container, changed, changed._getRootLinks(), base, base._getRootLinks(), options);
    }
    static _directoryDiff(container, basename, changed, changedNode, base, baseNode, options) {
        while (!changedNode.links && changedNode.shadowRoot) {
            changedNode = changedNode.shadowRoot;
        }
        while (!baseNode.links && baseNode.shadowRoot) {
            baseNode = baseNode.shadowRoot;
        }
        // no difference if the nodes are the same reference
        if (changedNode === baseNode) {
            return false;
        }
        // no difference if both nodes are non shadowed and have no entries
        if (isEmptyNonShadowedDirectory(changedNode) && isEmptyNonShadowedDirectory(baseNode)) {
            return false;
        }
        // no difference if both nodes are unpopulated and point to the same mounted file system
        if (!changedNode.links &&
            !baseNode.links &&
            changedNode.resolver &&
            changedNode.source !== undefined &&
            baseNode.resolver === changedNode.resolver &&
            baseNode.source === changedNode.source) {
            return false;
        }
        // no difference if both nodes have identical children
        const children = {};
        if (!TestFileSystem._diffWorker(children, changed, changed._getLinks(changedNode), base, base._getLinks(baseNode), options)) {
            return false;
        }
        container[basename] = new Directory(children);
        return true;
    }
    static _fileDiff(container, basename, changed, changedNode, base, baseNode, options) {
        while (!changedNode.buffer && changedNode.shadowRoot) {
            changedNode = changedNode.shadowRoot;
        }
        while (!baseNode.buffer && baseNode.shadowRoot) {
            baseNode = baseNode.shadowRoot;
        }
        // no difference if the nodes are the same reference
        if (changedNode === baseNode) {
            return false;
        }
        // no difference if both nodes are non shadowed and have no entries
        if (isEmptyNonShadowedFile(changedNode) && isEmptyNonShadowedFile(baseNode)) {
            return false;
        }
        // no difference if both nodes are unpopulated and point to the same mounted file system
        if (!changedNode.buffer &&
            !baseNode.buffer &&
            changedNode.resolver &&
            changedNode.source !== undefined &&
            baseNode.resolver === changedNode.resolver &&
            baseNode.source === changedNode.source) {
            return false;
        }
        const changedBuffer = changed._getBuffer(changedNode);
        const baseBuffer = base._getBuffer(baseNode);
        // no difference if both buffers are the same reference
        if (changedBuffer === baseBuffer) {
            return false;
        }
        // no difference if both buffers are identical
        if (Buffer.compare(changedBuffer, baseBuffer) === 0) {
            if (!options.includeChangedFileWithSameContent) {
                return false;
            }
            container[basename] = new SameFileContentFile(changedBuffer);
            return true;
        }
        container[basename] = new File(changedBuffer);
        return true;
    }
    static _symlinkDiff(container, basename, changedNode, baseNode) {
        // no difference if the nodes are the same reference
        if (changedNode.symlink === baseNode.symlink) {
            return false;
        }
        container[basename] = new Symlink(changedNode.symlink);
        return true;
    }
    static _trackCreatedInode(container, basename, changed, node) {
        if (isDirectory(node)) {
            const children = {};
            TestFileSystem._trackCreatedInodes(children, changed, changed._getLinks(node));
            container[basename] = new Directory(children);
        }
        else if (isSymlink(node)) {
            container[basename] = new Symlink(node.symlink);
        }
        else {
            container[basename] = new File(node.buffer || '');
        }
        return true;
    }
    static _trackCreatedInodes(container, changed, changedLinks) {
        // no difference if links are empty
        if (!changedLinks.size) {
            return false;
        }
        changedLinks.forEach((node, basename) => {
            TestFileSystem._trackCreatedInode(container, basename, changed, node);
        });
        return true;
    }
    static _trackDeletedInodes(container, baseLinks) {
        // no difference if links are empty
        if (!baseLinks.size) {
            return false;
        }
        baseLinks.forEach((node, basename) => {
            container[basename] = isDirectory(node) ? new Rmdir() : new Unlink();
        });
        return true;
    }
    _mknod(dev, type, mode, time = this.time()) {
        return {
            dev,
            ino: ++inoCount,
            mode: (mode & ~exports.S_IFMT & ~0o022 & 0o7777) | (type & exports.S_IFMT),
            atimeMs: time,
            mtimeMs: time,
            ctimeMs: time,
            birthtimeMs: time,
            nlink: 0,
        };
    }
    _addLink(parent, links, name, node, time = this.time()) {
        links.set(name, node);
        node.nlink++;
        node.ctimeMs = time;
        if (parent) {
            parent.mtimeMs = time;
        }
        if (!parent && !this._cwd) {
            this._cwd = name;
        }
    }
    _removeLink(parent, links, name, node, time = this.time()) {
        links.delete(name);
        node.nlink--;
        node.ctimeMs = time;
        if (parent) {
            parent.mtimeMs = time;
        }
    }
    _replaceLink(oldParent, oldLinks, oldName, newParent, newLinks, newName, node, time) {
        if (oldParent !== newParent) {
            this._removeLink(oldParent, oldLinks, oldName, node, time);
            this._addLink(newParent, newLinks, newName, node, time);
        }
        else {
            oldLinks.delete(oldName);
            oldLinks.set(newName, node);
            oldParent.mtimeMs = time;
            newParent.mtimeMs = time;
        }
    }
    _getRootLinks() {
        if (!this._lazy.links) {
            const links = new utils_2.SortedMap(this.stringComparer);
            if (this._shadowRoot) {
                this._copyShadowLinks(this._shadowRoot._getRootLinks(), links);
            }
            this._lazy.links = links;
        }
        return this._lazy.links;
    }
    _getLinks(node) {
        if (!node.links) {
            const links = new utils_2.SortedMap(this.stringComparer);
            const { source, resolver } = node;
            if (source && resolver) {
                node.source = undefined;
                node.resolver = undefined;
                for (const name of resolver.readdirSync(source)) {
                    const path = pathUtil.combinePaths(source, name);
                    const stats = resolver.statSync(path);
                    switch (stats.mode & exports.S_IFMT) {
                        case exports.S_IFDIR: {
                            const dir = this._mknod(node.dev, exports.S_IFDIR, 0o777);
                            dir.source = pathUtil.combinePaths(source, name);
                            dir.resolver = resolver;
                            this._addLink(node, links, name, dir);
                            break;
                        }
                        case exports.S_IFREG: {
                            const file = this._mknod(node.dev, exports.S_IFREG, 0o666);
                            file.source = pathUtil.combinePaths(source, name);
                            file.resolver = resolver;
                            file.size = stats.size;
                            this._addLink(node, links, name, file);
                            break;
                        }
                    }
                }
            }
            else if (this._shadowRoot && node.shadowRoot) {
                this._copyShadowLinks(this._shadowRoot._getLinks(node.shadowRoot), links);
            }
            node.links = links;
        }
        return node.links;
    }
    _getShadow(root) {
        const shadows = this._lazy.shadows || (this._lazy.shadows = new Map());
        let shadow = shadows.get(root.ino);
        if (!shadow) {
            shadow = {
                dev: root.dev,
                ino: root.ino,
                mode: root.mode,
                atimeMs: root.atimeMs,
                mtimeMs: root.mtimeMs,
                ctimeMs: root.ctimeMs,
                birthtimeMs: root.birthtimeMs,
                nlink: root.nlink,
                shadowRoot: root,
            };
            if (isSymlink(root)) {
                shadow.symlink = root.symlink;
            }
            shadows.set(shadow.ino, shadow);
        }
        return shadow;
    }
    _copyShadowLinks(source, target) {
        const iterator = (0, utils_2.getIterator)(source);
        try {
            for (let i = (0, utils_2.nextResult)(iterator); i; i = (0, utils_2.nextResult)(iterator)) {
                const [name, root] = i.value;
                target.set(name, this._getShadow(root));
            }
        }
        finally {
            (0, utils_2.closeIterator)(iterator);
        }
    }
    _getSize(node) {
        if (node.buffer) {
            return node.buffer.byteLength;
        }
        if (node.size !== undefined) {
            return node.size;
        }
        if (node.source && node.resolver) {
            return (node.size = node.resolver.statSync(node.source).size);
        }
        if (this._shadowRoot && node.shadowRoot) {
            return (node.size = this._shadowRoot._getSize(node.shadowRoot));
        }
        return 0;
    }
    _getBuffer(node) {
        if (!node.buffer) {
            const { source, resolver } = node;
            if (source && resolver) {
                node.source = undefined;
                node.resolver = undefined;
                node.size = undefined;
                node.buffer = resolver.readFileSync(source);
            }
            else if (this._shadowRoot && node.shadowRoot) {
                node.buffer = this._shadowRoot._getBuffer(node.shadowRoot);
            }
            else {
                node.buffer = Buffer.allocUnsafe(0);
            }
        }
        return node.buffer;
    }
    _walk(path, noFollow, onError) {
        let links = this._getRootLinks();
        let parent;
        let components = pathUtil.getPathComponents(path);
        let step = 0;
        let depth = 0;
        let retry = false;
        while (true) {
            if (depth >= 40) {
                throw (0, utils_1.createIOError)('ELOOP');
            }
            const lastStep = step === components.length - 1;
            const basename = components[step];
            const node = links.get(basename);
            if (lastStep && (noFollow || !isSymlink(node))) {
                return { realpath: pathUtil.combinePathComponents(components), basename, parent, links, node };
            }
            if (node === undefined) {
                if (trapError((0, utils_1.createIOError)('ENOENT'), node)) {
                    continue;
                }
                return undefined;
            }
            if (isSymlink(node)) {
                const dirname = pathUtil.combinePathComponents(components.slice(0, step));
                const symlink = pathUtil.resolvePaths(dirname, node.symlink);
                links = this._getRootLinks();
                parent = undefined;
                components = pathUtil.getPathComponents(symlink).concat(components.slice(step + 1));
                step = 0;
                depth++;
                retry = false;
                continue;
            }
            if (isDirectory(node)) {
                links = this._getLinks(node);
                parent = node;
                step++;
                retry = false;
                continue;
            }
            if (trapError((0, utils_1.createIOError)('ENOTDIR'), node)) {
                continue;
            }
            return undefined;
        }
        function trapError(error, node) {
            const realpath = pathUtil.combinePathComponents(components.slice(0, step + 1));
            const basename = components[step];
            const result = !retry && onError ? onError(error, { realpath, basename, parent, links, node }) : 'throw';
            if (result === 'stop') {
                return false;
            }
            if (result === 'retry') {
                retry = true;
                return true;
            }
            throw error;
        }
    }
    /**
     * Resolve a path relative to the current working directory.
     */
    _resolve(path) {
        return this._cwd
            ? pathUtil.resolvePaths(this._cwd, (0, pathValidation_1.validate)(path, 2016 /* ValidationFlags.RelativeOrAbsolute */ | 2048 /* ValidationFlags.AllowWildcard */))
            : (0, pathValidation_1.validate)(path, 2017 /* ValidationFlags.Absolute */ | 2048 /* ValidationFlags.AllowWildcard */);
    }
    _applyFiles(files, dirname) {
        const deferred = [];
        this._applyFilesWorker(files, dirname, deferred);
        for (const [entry, path] of deferred) {
            this.mkdirpSync(pathUtil.getDirectoryPath(path));
            this.pushd(pathUtil.getDirectoryPath(path));
            if (entry instanceof Symlink) {
                if (this.stringComparer(pathUtil.getDirectoryPath(path), path) === 0) {
                    throw new TypeError('Roots cannot be symbolic links.');
                }
                this.symlinkSync(pathUtil.resolvePaths(dirname, entry.symlink), path);
                this._applyFileExtendedOptions(path, entry);
            }
            else if (entry instanceof Link) {
                if (this.stringComparer(pathUtil.getDirectoryPath(path), path) === 0) {
                    throw new TypeError('Roots cannot be hard links.');
                }
                this.linkSync(entry.path, path);
            }
            else {
                this.mountSync(entry.source, path, entry.resolver);
                this._applyFileExtendedOptions(path, entry);
            }
            this.popd();
        }
    }
    _applyFileExtendedOptions(path, entry) {
        const { meta } = entry;
        if (meta !== undefined) {
            const filemeta = this.filemeta(path);
            for (const key of Object.keys(meta)) {
                filemeta.set(key, meta[key]);
            }
        }
    }
    _applyFilesWorker(files, dirname, deferred) {
        for (const key of Object.keys(files)) {
            const value = normalizeFileSetEntry(files[key]);
            const path = dirname ? pathUtil.resolvePaths(dirname, key) : key;
            (0, pathValidation_1.validate)(path, 2017 /* ValidationFlags.Absolute */);
            if (value === null || value === undefined || value instanceof Rmdir || value instanceof Unlink) {
                if (this.stringComparer(pathUtil.getDirectoryPath(path), path) === 0) {
                    throw new TypeError('Roots cannot be deleted.');
                }
                this.rimrafSync(path);
            }
            else if (value instanceof File) {
                if (this.stringComparer(pathUtil.getDirectoryPath(path), path) === 0) {
                    throw new TypeError('Roots cannot be files.');
                }
                this.mkdirpSync(pathUtil.getDirectoryPath(path));
                this.writeFileSync(uri_1.Uri.file(path, this), value.data, value.encoding);
                this._applyFileExtendedOptions(path, value);
            }
            else if (value instanceof Directory) {
                this.mkdirpSync(path);
                this._applyFileExtendedOptions(path, value);
                this._applyFilesWorker(value.files, path, deferred);
            }
            else {
                deferred.push([value, path]);
            }
        }
    }
}
exports.TestFileSystem = TestFileSystem;
TestFileSystem._nextId = 1;
/** Extended options for a directory in a `FileSet` */
class Directory {
    constructor(files, { meta } = {}) {
        this.files = files;
        this.meta = meta;
    }
}
exports.Directory = Directory;
/** Extended options for a file in a `FileSet` */
class File {
    constructor(data, { meta, encoding } = {}) {
        this.data = data;
        this.encoding = encoding;
        this.meta = meta;
    }
}
exports.File = File;
class SameFileContentFile extends File {
    constructor(data, metaAndEncoding) {
        super(data, metaAndEncoding);
    }
}
exports.SameFileContentFile = SameFileContentFile;
/** Extended options for a hard link in a `FileSet` */
class Link {
    constructor(path) {
        this.path = path;
    }
}
exports.Link = Link;
/** Removes a directory in a `FileSet` */
class Rmdir {
}
exports.Rmdir = Rmdir;
/** Unlinks a file in a `FileSet` */
class Unlink {
}
exports.Unlink = Unlink;
/** Extended options for a symbolic link in a `FileSet` */
class Symlink {
    constructor(symlink, { meta } = {}) {
        this.symlink = symlink;
        this.meta = meta;
    }
}
exports.Symlink = Symlink;
// file type
// these should be only used inside of test code. it is export just because mock file system is separated into
// 2 files. this and factory.ts file. actual value doesn't matter
exports.S_IFMT = 0o170000; // file type
exports.S_IFSOCK = 0o140000; // socket
exports.S_IFLNK = 0o120000; // symbolic link
exports.S_IFREG = 0o100000; // regular file
exports.S_IFBLK = 0o060000; // block device
exports.S_IFDIR = 0o040000; // directory
exports.S_IFCHR = 0o020000; // character device
exports.S_IFIFO = 0o010000; // FIFO
/** Extended options for mounting a virtual copy of an external file system via a `FileSet` */
class Mount {
    constructor(source, resolver, { meta } = {}) {
        this.source = source;
        this.resolver = resolver;
        this.meta = meta;
    }
}
exports.Mount = Mount;
function isEmptyNonShadowedDirectory(node) {
    return !node.links && !node.shadowRoot && !node.resolver && !node.source;
}
function isEmptyNonShadowedFile(node) {
    return !node.buffer && !node.shadowRoot && !node.resolver && !node.source;
}
function isFile(node) {
    return node !== undefined && (node.mode & exports.S_IFMT) === exports.S_IFREG;
}
function isDirectory(node) {
    return node !== undefined && (node.mode & exports.S_IFMT) === exports.S_IFDIR;
}
function isSymlink(node) {
    return node !== undefined && (node.mode & exports.S_IFMT) === exports.S_IFLNK;
}
function normalizeFileSetEntry(value) {
    if (value === undefined ||
        value === null ||
        value instanceof Directory ||
        value instanceof File ||
        value instanceof Link ||
        value instanceof Symlink ||
        value instanceof Mount ||
        value instanceof Rmdir ||
        value instanceof Unlink) {
        return value;
    }
    return typeof value === 'string' || Buffer.isBuffer(value) ? new File(value) : new Directory(value);
}
function formatPatch(patch) {
    return patch ? formatPatchWorker('', patch) : null;
}
exports.formatPatch = formatPatch;
function formatPatchWorker(dirname, container) {
    let text = '';
    for (const name of Object.keys(container)) {
        const entry = normalizeFileSetEntry(container[name]);
        const file = dirname ? pathUtil.combinePaths(dirname, name) : name;
        if (entry === null || entry === undefined || entry instanceof Unlink) {
            text += `//// [${file}] unlink\r\n`;
        }
        else if (entry instanceof Rmdir) {
            text += `//// [${pathUtil.ensureTrailingDirectorySeparator(file)}] rmdir\r\n`;
        }
        else if (entry instanceof Directory) {
            text += formatPatchWorker(file, entry.files);
        }
        else if (entry instanceof SameFileContentFile) {
            text += `//// [${file}] file written with same contents\r\n`;
        }
        else if (entry instanceof File) {
            const content = typeof entry.data === 'string' ? entry.data : entry.data.toString('utf8');
            text += `//// [${file}]\r\n${content}\r\n\r\n`;
        }
        else if (entry instanceof Link) {
            text += `//// [${file}] link(${entry.path})\r\n`;
        }
        else if (entry instanceof Symlink) {
            text += `//// [${file}] symlink(${entry.symlink})\r\n`;
        }
        else if (entry instanceof Mount) {
            text += `//// [${file}] mount(${entry.source})\r\n`;
        }
    }
    return text;
}
function makeDirEnt(name, node) {
    const de = {
        isFile: () => isFile(node),
        isDirectory: () => isDirectory(node),
        isBlockDevice: () => false,
        isCharacterDevice: () => false,
        isFIFO: () => false,
        isSocket: () => false,
        isSymbolicLink: () => isSymlink(node),
        name,
    };
    return de;
}
class Stats {
    constructor(dev = 0, ino = 0, mode = 0, nlink = 0, rdev = 0, size = 0, blksize = 0, blocks = 0, atimeMs = 0, mtimeMs = 0, ctimeMs = 0, birthtimeMs = 0) {
        this.dev = dev;
        this.ino = ino;
        this.mode = mode;
        this.nlink = nlink;
        this.uid = 0;
        this.gid = 0;
        this.rdev = rdev;
        this.size = size;
        this.blksize = blksize;
        this.blocks = blocks;
        this.atimeMs = atimeMs;
        this.mtimeMs = mtimeMs;
        this.ctimeMs = ctimeMs;
        this.birthtimeMs = birthtimeMs;
        this.atime = new Date(this.atimeMs);
        this.mtime = new Date(this.mtimeMs);
        this.ctime = new Date(this.ctimeMs);
        this.birthtime = new Date(this.birthtimeMs);
    }
    isFile() {
        return (this.mode & exports.S_IFMT) === exports.S_IFREG;
    }
    isDirectory() {
        return (this.mode & exports.S_IFMT) === exports.S_IFDIR;
    }
    isSymbolicLink() {
        return (this.mode & exports.S_IFMT) === exports.S_IFLNK;
    }
    isBlockDevice() {
        return (this.mode & exports.S_IFMT) === exports.S_IFBLK;
    }
    isCharacterDevice() {
        return (this.mode & exports.S_IFMT) === exports.S_IFCHR;
    }
    isFIFO() {
        return (this.mode & exports.S_IFMT) === exports.S_IFIFO;
    }
    isSocket() {
        return (this.mode & exports.S_IFMT) === exports.S_IFSOCK;
    }
}
//# sourceMappingURL=filesystem.js.map