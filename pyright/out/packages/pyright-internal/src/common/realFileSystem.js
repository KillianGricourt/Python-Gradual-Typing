"use strict";
/*
 * realFileSystem.ts
 *
 * Helper functions that require real filesystem access.
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
exports.RealTempFile = exports.WorkspaceFileWatcherProvider = exports.RealFileSystem = exports.createFromRealFileSystem = void 0;
const fslib_1 = require("@yarnpkg/fslib");
const libzip_1 = require("@yarnpkg/libzip");
const fs = __importStar(require("fs"));
const tmp = __importStar(require("tmp"));
const worker_threads_1 = require("worker_threads");
const console_1 = require("./console");
const crypto_1 = require("./crypto");
const fileWatcher_1 = require("./fileWatcher");
const pathUtils_1 = require("./pathUtils");
const fileUri_1 = require("./uri/fileUri");
const uri_1 = require("./uri/uri");
const uriUtils_1 = require("./uri/uriUtils");
// Automatically remove files created by tmp at process exit.
tmp.setGracefulCleanup();
// Callers can specify a different file watcher provider if desired.
// By default, we'll use the file watcher based on chokidar.
function createFromRealFileSystem(caseSensitiveDetector, console, fileWatcherProvider) {
    return new RealFileSystem(caseSensitiveDetector, console !== null && console !== void 0 ? console : new console_1.NullConsole(), fileWatcherProvider !== null && fileWatcherProvider !== void 0 ? fileWatcherProvider : fileWatcher_1.nullFileWatcherProvider);
}
exports.createFromRealFileSystem = createFromRealFileSystem;
const DOT_ZIP = `.zip`;
const DOT_EGG = `.egg`;
const DOT_JAR = `.jar`;
// Exactly the same as ZipOpenFS's getArchivePart, but supporting .egg files.
// https://github.com/yarnpkg/berry/blob/64a16b3603ef2ccb741d3c44f109c9cfc14ba8dd/packages/yarnpkg-fslib/sources/ZipOpenFS.ts#L23
function getArchivePart(path) {
    let idx = path.indexOf(DOT_ZIP);
    if (idx <= 0) {
        idx = path.indexOf(DOT_EGG);
        if (idx <= 0) {
            idx = path.indexOf(DOT_JAR);
            if (idx <= 0) {
                return null;
            }
        }
    }
    // Disallow files named ".zip"
    if (path[idx - 1] === fslib_1.ppath.sep)
        return null;
    const nextCharIdx = idx + DOT_ZIP.length; // DOT_ZIP and DOT_EGG are the same length.
    // The path either has to end in ".zip" or contain an archive subpath (".zip/...")
    if (path.length > nextCharIdx && path[nextCharIdx] !== fslib_1.ppath.sep)
        return null;
    return path.slice(0, nextCharIdx);
}
function hasZipExtension(p) {
    return p.endsWith(DOT_ZIP) || p.endsWith(DOT_EGG) || p.endsWith(DOT_JAR);
}
// "Magic" values for the zip file type. https://en.wikipedia.org/wiki/List_of_file_signatures
const zipMagic = [
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    Buffer.from([0x50, 0x4b, 0x07, 0x08]),
];
function hasZipMagic(fs, p) {
    let fd;
    try {
        fd = fs.openSync(p, 'r');
        const buffer = Buffer.alloc(4);
        const bytesRead = fs.readSync(fd, buffer, 0, 4, 0);
        if (bytesRead < 4) {
            return false;
        }
        for (const magic of zipMagic) {
            if (buffer.compare(magic) === 0) {
                return true;
            }
        }
        return false;
    }
    catch {
        return false;
    }
    finally {
        if (fd !== undefined) {
            fs.closeSync(fd);
        }
    }
}
/* eslint-disable @typescript-eslint/naming-convention */
// Patch fslib's ZipOpenFS to also consider .egg files to be .zip files.
//
// For now, override findZip (even though it's private), with the intent
// to upstream a change to allow overriding getArchivePart or add some
// other mechanism to support more extensions as zips (or, to remove this
// hack in favor of a full ZipOpenFS fork).
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-expect-error
class EggZipOpenFS extends fslib_1.ZipOpenFS {
    findZip(p) {
        if (this.filter && !this.filter.test(p))
            return null;
        let filePath = ``;
        while (true) {
            const archivePart = getArchivePart(p.substr(filePath.length));
            if (!archivePart)
                return null;
            filePath = this.pathUtils.join(filePath, archivePart);
            if (this.isZip.has(filePath) === false) {
                if (this.notZip.has(filePath))
                    continue;
                try {
                    if (!this.baseFs.lstatSync(filePath).isFile()) {
                        this.notZip.add(filePath);
                        continue;
                    }
                    if (!hasZipMagic(this.baseFs, filePath)) {
                        this.notZip.add(filePath);
                        continue;
                    }
                    try {
                        // We're pretty sure that it's a zip at this point (it has the magic), but
                        // try accessing the zipfile anyway; if it's corrupt in some way, this will throw.
                        // We don't need to do anything with the ZipFS instance given to the callback
                        // below; ZipOpenFS already manages their lifetimes and we're very likely to
                        // immediately call back into the FS to obtain info from the zip anyway.
                        // eslint-disable-next-line @typescript-eslint/no-empty-function
                        this.getZipSync(filePath, () => { });
                    }
                    catch {
                        this.notZip.add(filePath);
                        continue;
                    }
                }
                catch {
                    return null;
                }
                this.isZip.add(filePath);
            }
            return {
                archivePath: filePath,
                subPath: this.pathUtils.join(fslib_1.PortablePath.root, p.substr(filePath.length)),
            };
        }
    }
    // Hack to provide typed access to this private method.
    getZipSync(p, accept) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //@ts-expect-error
        return super.getZipSync(p, accept);
    }
}
/* eslint-enable @typescript-eslint/naming-convention */
class YarnFS extends fslib_1.PosixFS {
    constructor() {
        const eggZipOpenFS = new EggZipOpenFS({
            libzip: () => (0, libzip_1.getLibzipSync)(),
            useCache: true,
            maxOpenFiles: 80,
            readOnlyArchives: true,
        });
        super(new fslib_1.VirtualFS({
            baseFs: eggZipOpenFS,
        }));
        this._eggZipOpenFS = eggZipOpenFS;
    }
    isZip(p) {
        return !!this._eggZipOpenFS.findZip(this.mapToBase(p));
    }
}
const yarnFS = new YarnFS();
// Use `createFromRealFileSystem` instead of `new RealFileSystem`
// unless you are creating a new file system that inherits from `RealFileSystem`
class RealFileSystem {
    constructor(_caseSensitiveDetector, _console, _fileWatcherProvider) {
        this._caseSensitiveDetector = _caseSensitiveDetector;
        this._console = _console;
        this._fileWatcherProvider = _fileWatcherProvider;
        // Empty
    }
    existsSync(uri) {
        if (uri.isEmpty() || !fileUri_1.FileUri.isFileUri(uri)) {
            return false;
        }
        const path = uri.getFilePath();
        try {
            // Catch zip open errors. existsSync is assumed to never throw by callers.
            return yarnFS.existsSync(path);
        }
        catch {
            return false;
        }
    }
    mkdirSync(uri, options) {
        const path = uri.getFilePath();
        yarnFS.mkdirSync(path, options);
    }
    chdir(uri) {
        const path = uri.getFilePath();
        // If this file system happens to be running in a worker thread,
        // then we can't call 'chdir'.
        if (worker_threads_1.isMainThread) {
            process.chdir(path);
        }
    }
    readdirSync(uri) {
        const path = uri.getFilePath();
        return yarnFS.readdirSync(path);
    }
    readdirEntriesSync(uri) {
        const path = uri.getFilePath();
        return yarnFS.readdirSync(path, { withFileTypes: true }).map((entry) => {
            // Treat zip/egg files as directories.
            // See: https://github.com/yarnpkg/berry/blob/master/packages/vscode-zipfs/sources/ZipFSProvider.ts
            if (hasZipExtension(entry.name)) {
                if (entry.isFile() && yarnFS.isZip(path)) {
                    return {
                        name: entry.name,
                        isFile: () => false,
                        isDirectory: () => true,
                        isBlockDevice: () => false,
                        isCharacterDevice: () => false,
                        isSymbolicLink: () => false,
                        isFIFO: () => false,
                        isSocket: () => false,
                    };
                }
            }
            return entry;
        });
    }
    readFileSync(uri, encoding = null) {
        const path = uri.getFilePath();
        if (encoding === 'utf8' || encoding === 'utf-8') {
            return yarnFS.readFileSync(path, 'utf8');
        }
        return yarnFS.readFileSync(path);
    }
    writeFileSync(uri, data, encoding) {
        const path = uri.getFilePath();
        yarnFS.writeFileSync(path, data, encoding || undefined);
    }
    statSync(uri) {
        if (fileUri_1.FileUri.isFileUri(uri)) {
            const path = uri.getFilePath();
            const stat = yarnFS.statSync(path);
            // Treat zip/egg files as directories.
            // See: https://github.com/yarnpkg/berry/blob/master/packages/vscode-zipfs/sources/ZipFSProvider.ts
            if (hasZipExtension(path)) {
                if (stat.isFile() && yarnFS.isZip(path)) {
                    stat.isFile = () => false;
                    stat.isDirectory = () => true;
                    stat.isZipDirectory = () => true;
                    return stat;
                }
            }
            return stat;
        }
        else {
            return {
                isFile: () => false,
                isDirectory: () => false,
                isBlockDevice: () => false,
                isCharacterDevice: () => false,
                isSymbolicLink: () => false,
                isFIFO: () => false,
                isSocket: () => false,
                dev: 0,
                atimeMs: 0,
                mtimeMs: 0,
                ctimeMs: 0,
                birthtimeMs: 0,
                size: 0,
                blksize: 0,
                blocks: 0,
                ino: 0,
                mode: 0,
                nlink: 0,
                uid: 0,
                gid: 0,
                rdev: 0,
                atime: new Date(),
                mtime: new Date(),
                ctime: new Date(),
                birthtime: new Date(),
            };
        }
    }
    rmdirSync(uri) {
        const path = uri.getFilePath();
        yarnFS.rmdirSync(path);
    }
    unlinkSync(uri) {
        const path = uri.getFilePath();
        yarnFS.unlinkSync(path);
    }
    realpathSync(uri) {
        try {
            const path = uri.getFilePath();
            return uri_1.Uri.file(yarnFS.realpathSync(path), this._caseSensitiveDetector);
        }
        catch (e) {
            return uri;
        }
    }
    getModulePath() {
        // The entry point to the tool should have set the __rootDirectory
        // global variable to point to the directory that contains the
        // typeshed-fallback directory.
        return (0, uriUtils_1.getRootUri)(this._caseSensitiveDetector) || uri_1.Uri.empty();
    }
    createFileSystemWatcher(paths, listener) {
        return this._fileWatcherProvider.createFileWatcher(paths.map((p) => p.getFilePath()), listener);
    }
    createReadStream(uri) {
        const path = uri.getFilePath();
        return yarnFS.createReadStream(path);
    }
    createWriteStream(uri) {
        const path = uri.getFilePath();
        return yarnFS.createWriteStream(path);
    }
    copyFileSync(src, dst) {
        const srcPath = src.getFilePath();
        const destPath = dst.getFilePath();
        yarnFS.copyFileSync(srcPath, destPath);
    }
    readFile(uri) {
        const path = uri.getFilePath();
        return yarnFS.readFilePromise(path);
    }
    async readFileText(uri, encoding) {
        const path = uri.getFilePath();
        if (encoding === 'utf8' || encoding === 'utf-8') {
            return yarnFS.readFilePromise(path, 'utf8');
        }
        const buffer = await yarnFS.readFilePromise(path);
        return buffer.toString(encoding);
    }
    realCasePath(uri) {
        try {
            // If it doesn't exist in the real FS, then just use this path.
            if (!this.existsSync(uri)) {
                return uri;
            }
            // realpathSync.native will return casing as in OS rather than
            // trying to preserve casing given.
            const realCase = fs.realpathSync.native(uri.getFilePath());
            // If the original and real case paths differ by anything other than case,
            // then there's a symbolic link or something of that sort involved. Return
            // the original path instead.
            if (uri.getFilePath().toLowerCase() !== realCase.toLowerCase()) {
                return uri;
            }
            // On UNC mapped drives we want to keep the original drive letter.
            if ((0, pathUtils_1.getRootLength)(realCase) !== (0, pathUtils_1.getRootLength)(uri.getFilePath())) {
                return uri;
            }
            return uri_1.Uri.file(realCase, this._caseSensitiveDetector);
        }
        catch (e) {
            // Return as it is, if anything failed.
            this._console.log(`Failed to get real file system casing for ${uri}: ${e}`);
            return uri;
        }
    }
    isMappedUri(uri) {
        return false;
    }
    getOriginalUri(mappedUri) {
        return mappedUri;
    }
    getMappedUri(originalUri) {
        return originalUri;
    }
    isInZip(uri) {
        const path = uri.getFilePath();
        return /[^\\/]\.(?:egg|zip|jar)[\\/]/.test(path) && yarnFS.isZip(path);
    }
}
exports.RealFileSystem = RealFileSystem;
class WorkspaceFileWatcherProvider {
    constructor() {
        this._fileWatchers = [];
    }
    createFileWatcher(workspacePaths, listener) {
        const self = this;
        const fileWatcher = {
            close() {
                // Stop listening for workspace paths.
                self._fileWatchers = self._fileWatchers.filter((watcher) => watcher !== fileWatcher);
            },
            workspacePaths,
            eventHandler: listener,
        };
        // Record the file watcher.
        self._fileWatchers.push(fileWatcher);
        return fileWatcher;
    }
    onFileChange(eventType, fileUri) {
        // Since file watcher is a server wide service, we don't know which watcher is
        // for which workspace (for multi workspace case), also, we don't know which watcher
        // is for source or library. so we need to solely rely on paths that can cause us
        // to raise events both for source and library if .venv is inside of workspace root
        // for a file change. It is event handler's job to filter those out.
        this._fileWatchers.forEach((watcher) => {
            if (watcher.workspacePaths.some((dirPath) => fileUri.getFilePath().startsWith(dirPath))) {
                watcher.eventHandler(eventType, fileUri.getFilePath());
            }
        });
    }
}
exports.WorkspaceFileWatcherProvider = WorkspaceFileWatcherProvider;
class RealTempFile {
    constructor() {
        // Empty
    }
    tmpdir() {
        return uri_1.Uri.file(this._getTmpDir().name, this);
    }
    tmpfile(options) {
        const f = tmp.fileSync({ dir: this._getTmpDir().name, discardDescriptor: true, ...options });
        return uri_1.Uri.file(f.name, this);
    }
    mktmpdir() {
        const d = tmp.dirSync();
        return uri_1.Uri.file(d.name, this);
    }
    dispose() {
        var _a;
        try {
            (_a = this._tmpdir) === null || _a === void 0 ? void 0 : _a.removeCallback();
            this._tmpdir = undefined;
        }
        catch {
            // ignore
        }
    }
    isCaseSensitive(uri) {
        if (uri.startsWith(fileUri_1.FileUriSchema)) {
            return this._isLocalFileSystemCaseSensitive();
        }
        return true;
    }
    _isLocalFileSystemCaseSensitive() {
        if (this._caseSensitivity === undefined) {
            this._caseSensitivity = this._isFileSystemCaseSensitiveInternal();
        }
        return this._caseSensitivity;
    }
    _getTmpDir() {
        if (!this._tmpdir) {
            this._tmpdir = tmp.dirSync({ prefix: 'pyright' });
        }
        return this._tmpdir;
    }
    _isFileSystemCaseSensitiveInternal() {
        let filePath = undefined;
        try {
            // Make unique file name.
            let name;
            let mangledFilePath;
            do {
                name = `${(0, crypto_1.randomBytesHex)(21)}-a`;
                filePath = (0, pathUtils_1.combinePaths)(this._getTmpDir().name, name);
                mangledFilePath = (0, pathUtils_1.combinePaths)(this._getTmpDir().name, name.toUpperCase());
            } while (fs.existsSync(filePath) || fs.existsSync(mangledFilePath));
            fs.writeFileSync(filePath, '', 'utf8');
            // If file exists, then it is insensitive.
            return !fs.existsSync(mangledFilePath);
        }
        catch (e) {
            return false;
        }
        finally {
            if (filePath) {
                // remove temp file created
                try {
                    fs.unlinkSync(filePath);
                }
                catch (e) {
                    /* ignored */
                }
            }
        }
    }
}
exports.RealTempFile = RealTempFile;
//# sourceMappingURL=realFileSystem.js.map