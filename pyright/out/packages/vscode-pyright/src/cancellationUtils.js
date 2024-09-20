"use strict";
/*
 * cancellationUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Helper methods around cancellation
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
exports.FileBasedCancellationStrategy = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const vscode_languageserver_1 = require("vscode-languageserver");
const crypto_1 = require("pyright-internal/common/crypto");
function getCancellationFolderPath(folderName) {
    return path.join(os.tmpdir(), 'python-languageserver-cancellation', folderName);
}
function getCancellationFilePath(folderName, id) {
    return path.join(getCancellationFolderPath(folderName), `cancellation-${String(id)}.tmp`);
}
function tryRun(callback) {
    try {
        callback();
    }
    catch (e) {
        /* empty */
    }
}
class FileCancellationSenderStrategy {
    constructor(folderName) {
        this.folderName = folderName;
        const folder = getCancellationFolderPath(folderName);
        tryRun(() => fs.mkdirSync(folder, { recursive: true }));
    }
    sendCancellation(_, id) {
        const file = getCancellationFilePath(this.folderName, id);
        tryRun(() => fs.writeFileSync(file, '', { flag: 'w' }));
        return Promise.resolve();
    }
    cleanup(id) {
        tryRun(() => fs.unlinkSync(getCancellationFilePath(this.folderName, id)));
    }
    dispose() {
        const folder = getCancellationFolderPath(this.folderName);
        tryRun(() => rimraf(folder));
        function rimraf(location) {
            const stat = fs.lstatSync(location);
            if (stat) {
                if (stat.isDirectory() && !stat.isSymbolicLink()) {
                    for (const dir of fs.readdirSync(location)) {
                        rimraf(path.join(location, dir));
                    }
                    fs.rmdirSync(location);
                }
                else {
                    fs.unlinkSync(location);
                }
            }
        }
    }
}
class FileBasedCancellationStrategy {
    constructor() {
        const folderName = (0, crypto_1.randomBytesHex)(21);
        this._sender = new FileCancellationSenderStrategy(folderName);
    }
    get receiver() {
        return vscode_languageserver_1.CancellationReceiverStrategy.Message;
    }
    get sender() {
        return this._sender;
    }
    getCommandLineArguments() {
        return [`--cancellationReceive=file:${this._sender.folderName}`];
    }
    dispose() {
        this._sender.dispose();
    }
}
exports.FileBasedCancellationStrategy = FileBasedCancellationStrategy;
//# sourceMappingURL=cancellationUtils.js.map