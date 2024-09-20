"use strict";
/*
 * io.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
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
exports.HOST = exports.TestCaseSensitivityDetector = void 0;
const os = __importStar(require("os"));
const pathModule = __importStar(require("path"));
const console_1 = require("../../common/console");
const pathUtils_1 = require("../../common/pathUtils");
const realFileSystem_1 = require("../../common/realFileSystem");
const stringUtils_1 = require("../../common/stringUtils");
const uriUtils_1 = require("../../common/uri/uriUtils");
const fileUri_1 = require("../../common/uri/fileUri");
const uri_1 = require("../../common/uri/uri");
class TestCaseSensitivityDetector {
    constructor(_isCaseSensitive = true) {
        this._isCaseSensitive = _isCaseSensitive;
        // Empty
    }
    setCaseSensitivity(value) {
        this._isCaseSensitive = value;
    }
    isCaseSensitive(uri) {
        if (uri.startsWith(fileUri_1.FileUriSchema)) {
            return this._isCaseSensitive;
        }
        return false;
    }
}
exports.TestCaseSensitivityDetector = TestCaseSensitivityDetector;
exports.HOST = createHost();
function createHost() {
    // NodeJS detects "\uFEFF" at the start of the string and *replaces* it with the actual
    // byte order mark from the specified encoding. Using any other byte order mark does
    // not actually work.
    const byteOrderMarkIndicator = '\uFEFF';
    const caseDetector = new TestCaseSensitivityDetector();
    const vfs = (0, realFileSystem_1.createFromRealFileSystem)(caseDetector, new console_1.NullConsole());
    const useCaseSensitiveFileNames = isFileSystemCaseSensitive();
    caseDetector.setCaseSensitivity(useCaseSensitiveFileNames);
    function isFileSystemCaseSensitive() {
        // win32\win64 are case insensitive platforms
        const platform = os.platform();
        if (platform === 'win32') {
            return false;
        }
        // If this file exists under a different case, we must be case-insensitve.
        return !vfs.existsSync(uriUtils_1.UriEx.file(swapCase(__filename)));
        /** Convert all lowercase chars to uppercase, and vice-versa */
        function swapCase(s) {
            return s.replace(/\w/g, (ch) => {
                const up = ch.toUpperCase();
                return ch === up ? ch.toLowerCase() : up;
            });
        }
    }
    function listFiles(path, spec, options = {}) {
        function filesInFolder(folder) {
            let paths = [];
            for (const file of vfs.readdirSync(uri_1.Uri.file(folder, caseDetector))) {
                const pathToFile = pathModule.join(folder, file);
                const stat = vfs.statSync(uri_1.Uri.file(pathToFile, caseDetector));
                if (options.recursive && stat.isDirectory()) {
                    paths = paths.concat(filesInFolder(pathToFile));
                }
                else if (stat.isFile() && (!spec || file.match(spec))) {
                    paths.push(pathToFile);
                }
            }
            return paths;
        }
        return filesInFolder(path);
    }
    function getAccessibleFileSystemEntries(dirname) {
        try {
            const entries = vfs
                .readdirSync(uri_1.Uri.file(dirname || '.', caseDetector))
                .sort(useCaseSensitiveFileNames ? stringUtils_1.compareStringsCaseSensitive : stringUtils_1.compareStringsCaseInsensitive);
            const files = [];
            const directories = [];
            for (const entry of entries) {
                if (entry === '.' || entry === '..') {
                    continue;
                }
                const name = (0, pathUtils_1.combinePaths)(dirname, entry);
                try {
                    const stat = vfs.statSync(uri_1.Uri.file(name, caseDetector));
                    if (!stat) {
                        continue;
                    }
                    if (stat.isFile()) {
                        files.push(entry);
                    }
                    else if (stat.isDirectory()) {
                        directories.push(entry);
                    }
                }
                catch {
                    /* ignore */
                }
            }
            return { files, directories };
        }
        catch (e) {
            return { files: [], directories: [] };
        }
    }
    function readFile(fileName, _encoding) {
        if (!(0, uriUtils_1.fileExists)(vfs, uri_1.Uri.file(fileName, caseDetector))) {
            return undefined;
        }
        const buffer = vfs.readFileSync(uri_1.Uri.file(fileName, caseDetector));
        let len = buffer.length;
        if (len >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
            // Big endian UTF-16 byte order mark detected. Since big endian is not supported by node.js,
            // flip all byte pairs and treat as little endian.
            len &= ~1; // Round down to a multiple of 2
            for (let i = 0; i < len; i += 2) {
                const temp = buffer[i];
                buffer[i] = buffer[i + 1];
                buffer[i + 1] = temp;
            }
            return buffer.toString('utf16le', 2);
        }
        if (len >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
            // Little endian UTF-16 byte order mark detected
            return buffer.toString('utf16le', 2);
        }
        if (len >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
            // UTF-8 byte order mark detected
            return buffer.toString('utf8', 3);
        }
        // Default is UTF-8 with no byte order mark
        return buffer.toString('utf8');
    }
    function writeFile(fileName, data, writeByteOrderMark) {
        // If a BOM is required, emit one
        if (writeByteOrderMark) {
            data = byteOrderMarkIndicator + data;
        }
        vfs.writeFileSync(uri_1.Uri.file(fileName, caseDetector), data, 'utf8');
    }
    return {
        useCaseSensitiveFileNames: () => useCaseSensitiveFileNames,
        getFileSize: (path) => (0, uriUtils_1.getFileSize)(vfs, uri_1.Uri.file(path, caseDetector)),
        readFile: (path) => readFile(path),
        writeFile: (path, content) => {
            writeFile(path, content);
        },
        fileExists: (path) => (0, uriUtils_1.fileExists)(vfs, uri_1.Uri.file(path, caseDetector)),
        directoryExists: (path) => (0, uriUtils_1.directoryExists)(vfs, uri_1.Uri.file(path, caseDetector)),
        listFiles,
        log: (s) => {
            console.log(s);
        },
        getWorkspaceRoot: () => (0, pathUtils_1.resolvePaths)(__dirname, '../../..'),
        getAccessibleFileSystemEntries,
    };
}
//# sourceMappingURL=testHost.js.map