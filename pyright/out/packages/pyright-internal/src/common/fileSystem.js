"use strict";
/*
 * fileSystem.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * A "file system provider" abstraction that allows us to swap out a
 * real file system implementation for a virtual (mocked) implementation
 * for testing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualDirent = exports.TempFile = exports.FileSystem = void 0;
var FileSystem;
(function (FileSystem) {
    function is(value) {
        return value.createFileSystemWatcher && value.createReadStream && value.createWriteStream && value.copyFileSync;
    }
    FileSystem.is = is;
})(FileSystem || (exports.FileSystem = FileSystem = {}));
var TempFile;
(function (TempFile) {
    function is(value) {
        return value.tmpdir && value.tmpfile;
    }
    TempFile.is = is;
})(TempFile || (exports.TempFile = TempFile = {}));
class VirtualDirent {
    constructor(name, _file) {
        this.name = name;
        this._file = _file;
    }
    isFile() {
        return this._file;
    }
    isDirectory() {
        return !this._file;
    }
    isBlockDevice() {
        return false;
    }
    isCharacterDevice() {
        return false;
    }
    isSymbolicLink() {
        return false;
    }
    isFIFO() {
        return false;
    }
    isSocket() {
        return false;
    }
}
exports.VirtualDirent = VirtualDirent;
//# sourceMappingURL=fileSystem.js.map