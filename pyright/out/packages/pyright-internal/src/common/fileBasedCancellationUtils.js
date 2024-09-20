"use strict";
/*
 * fileBasedCancellationUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Helper methods relating to file-based cancellation.
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
exports.FileBasedCancellationProvider = exports.getCancellationTokenFromId = exports.disposeCancellationToken = exports.getCancellationStrategyFromArgv = void 0;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const vscode_languageserver_1 = require("vscode-languageserver");
const cancellationUtils_1 = require("./cancellationUtils");
const uriUtils_1 = require("./uri/uriUtils");
class StatSyncFromFs {
    statSync(uri) {
        return fs.statSync(uri.getFilePath());
    }
}
class OwningFileToken extends cancellationUtils_1.FileBasedToken {
    constructor(cancellationId) {
        super(cancellationId, new StatSyncFromFs());
        this._disposed = false;
    }
    get isCancellationRequested() {
        // Since this object owns the file and it gets created when the
        // token is cancelled, there's no point in checking the pipe.
        return this.isCancelled;
    }
    cancel() {
        if (!this._disposed && !this.isCancelled) {
            this._createPipe();
            super.cancel();
        }
    }
    dispose() {
        this._disposed = true;
        super.dispose();
        this._removePipe();
    }
    _createPipe() {
        try {
            fs.writeFileSync(this.cancellationFilePath.getFilePath(), '', { flag: 'w' });
        }
        catch {
            // Ignore the exception.
        }
    }
    _removePipe() {
        try {
            fs.unlinkSync(this.cancellationFilePath.getFilePath());
        }
        catch {
            // Ignore the exception.
        }
    }
}
class FileBasedCancellationTokenSource {
    constructor(_cancellationId, _ownFile = false) {
        this._cancellationId = _cancellationId;
        this._ownFile = _ownFile;
    }
    get token() {
        if (!this._token) {
            // Be lazy and create the token only when actually needed.
            this._token = this._ownFile
                ? new OwningFileToken(this._cancellationId)
                : new cancellationUtils_1.FileBasedToken(this._cancellationId, new StatSyncFromFs());
        }
        return this._token;
    }
    cancel() {
        if (!this._token) {
            // Save an object by returning the default
            // cancelled token when cancellation happens
            // before someone asks for the token.
            this._token = vscode_languageserver_1.CancellationToken.Cancelled;
        }
        else if (this._token.isCancellationRequested) {
            // Already cancelled.
            return;
        }
        else {
            this._token.cancel();
        }
    }
    dispose() {
        if (!this._token) {
            // Make sure to initialize with an empty token if we had none.
            this._token = vscode_languageserver_1.CancellationToken.None;
        }
        else if (this._token instanceof cancellationUtils_1.FileBasedToken) {
            // Actually dispose.
            this._token.dispose();
        }
    }
}
function getCancellationFolderPath(folderName) {
    return path.join(os.tmpdir(), 'python-languageserver-cancellation', folderName);
}
function getCancellationFileUri(folderName, id) {
    return uriUtils_1.UriEx.file(path.join(getCancellationFolderPath(folderName), `cancellation-${String(id)}.tmp`)).toString();
}
class FileCancellationReceiverStrategy {
    constructor(folderName) {
        this.folderName = folderName;
    }
    createCancellationTokenSource(id) {
        return new FileBasedCancellationTokenSource(getCancellationFileUri(this.folderName, id));
    }
}
function getCancellationStrategyFromArgv(argv) {
    let receiver;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--cancellationReceive') {
            receiver = createReceiverStrategyFromArgv(argv[i + 1]);
        }
        else {
            const args = arg.split('=');
            if (args[0] === '--cancellationReceive') {
                receiver = createReceiverStrategyFromArgv(args[1]);
            }
        }
    }
    if (receiver && !(0, cancellationUtils_1.getCancellationFolderName)()) {
        (0, cancellationUtils_1.setCancellationFolderName)(receiver.folderName);
    }
    receiver = receiver ? receiver : vscode_languageserver_1.CancellationReceiverStrategy.Message;
    return { receiver, sender: vscode_languageserver_1.CancellationSenderStrategy.Message };
    function createReceiverStrategyFromArgv(arg) {
        const folderName = extractCancellationFolderName(arg);
        return folderName ? new FileCancellationReceiverStrategy(folderName) : undefined;
    }
    function extractCancellationFolderName(arg) {
        const fileRegex = /^file:(.+)$/;
        const folderName = arg.match(fileRegex);
        return folderName ? folderName[1] : undefined;
    }
}
exports.getCancellationStrategyFromArgv = getCancellationStrategyFromArgv;
function disposeCancellationToken(token) {
    if (token instanceof cancellationUtils_1.FileBasedToken) {
        token.dispose();
    }
}
exports.disposeCancellationToken = disposeCancellationToken;
function getCancellationTokenFromId(cancellationId) {
    if (!cancellationId) {
        return vscode_languageserver_1.CancellationToken.None;
    }
    return new cancellationUtils_1.FileBasedToken(cancellationId, new StatSyncFromFs());
}
exports.getCancellationTokenFromId = getCancellationTokenFromId;
let cancellationSourceId = 0;
class FileBasedCancellationProvider {
    constructor(_prefix) {
        this._prefix = _prefix;
        // empty
    }
    createCancellationTokenSource() {
        const folderName = (0, cancellationUtils_1.getCancellationFolderName)();
        if (!folderName) {
            // File-based cancellation is not used.
            // Return regular cancellation token source.
            return new vscode_jsonrpc_1.CancellationTokenSource();
        }
        return new FileBasedCancellationTokenSource(getCancellationFileUri(folderName, `${this._prefix}-${String(cancellationSourceId++)}`), 
        /* ownFile */ true);
    }
}
exports.FileBasedCancellationProvider = FileBasedCancellationProvider;
//# sourceMappingURL=fileBasedCancellationUtils.js.map