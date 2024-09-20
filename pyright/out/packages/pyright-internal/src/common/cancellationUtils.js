"use strict";
/*
 * cancellationUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Helper methods relating to cancellation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.raceCancellation = exports.CancellationThrottle = exports.FileBasedToken = exports.getCancellationTokenId = exports.DefaultCancellationProvider = exports.CancelAfter = exports.onCancellationRequested = exports.throwIfCancellationRequested = exports.OperationCanceledException = exports.invalidateTypeCacheIfCanceled = exports.setCancellationFolderName = exports.getCancellationFolderName = void 0;
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const vscode_languageserver_1 = require("vscode-languageserver");
const core_1 = require("./core");
const uriUtils_1 = require("./uri/uriUtils");
let cancellationFolderName;
function getCancellationFolderName() {
    return cancellationFolderName;
}
exports.getCancellationFolderName = getCancellationFolderName;
function setCancellationFolderName(folderName) {
    cancellationFolderName = folderName;
}
exports.setCancellationFolderName = setCancellationFolderName;
function invalidateTypeCacheIfCanceled(cb) {
    try {
        return cb();
    }
    catch (e) {
        if (OperationCanceledException.is(e)) {
            // If the work was canceled before the function type was updated, the
            // function type in the type cache is in an invalid, partially-constructed state.
            e.isTypeCacheInvalid = true;
        }
        throw e;
    }
}
exports.invalidateTypeCacheIfCanceled = invalidateTypeCacheIfCanceled;
class OperationCanceledException extends vscode_languageserver_1.ResponseError {
    constructor() {
        super(vscode_languageserver_1.LSPErrorCodes.RequestCancelled, 'request cancelled');
        // If true, indicates that the cancellation may have left the type cache
        // in an invalid state.
        this.isTypeCacheInvalid = false;
    }
    static is(e) {
        return e.code === vscode_languageserver_1.LSPErrorCodes.RequestCancelled;
    }
}
exports.OperationCanceledException = OperationCanceledException;
function throwIfCancellationRequested(token) {
    // Don't use cancellation in debug mode because it interferes with
    // debugging if requests are cancelled.
    if (!(0, core_1.isDebugMode)() && token.isCancellationRequested) {
        throw new OperationCanceledException();
    }
}
exports.throwIfCancellationRequested = throwIfCancellationRequested;
const nullDisposable = vscode_languageserver_1.Disposable.create(() => { });
function onCancellationRequested(token, func) {
    try {
        return token.onCancellationRequested(func);
    }
    catch {
        // Certain cancellation token implementations, like SharedArrayCancellation
        // (https://github.com/microsoft/vscode-languageserver-node/blob/main/jsonrpc/src/common/sharedArrayCancellation.ts#L70),
        // do not support the `onCancellationRequested` method. In such cases, proceed to the next token.
        return nullDisposable;
    }
}
exports.onCancellationRequested = onCancellationRequested;
function CancelAfter(provider, ...tokens) {
    const source = provider.createCancellationTokenSource();
    const disposables = [];
    for (const token of tokens) {
        disposables.push(onCancellationRequested(token, () => {
            source.cancel();
        }));
    }
    disposables.push(onCancellationRequested(source.token, () => {
        disposables.forEach((d) => d.dispose());
    }));
    return source;
}
exports.CancelAfter = CancelAfter;
class DefaultCancellationProvider {
    createCancellationTokenSource() {
        return new vscode_jsonrpc_1.CancellationTokenSource();
    }
}
exports.DefaultCancellationProvider = DefaultCancellationProvider;
function getCancellationTokenId(token) {
    return token instanceof FileBasedToken ? token.id : undefined;
}
exports.getCancellationTokenId = getCancellationTokenId;
class FileBasedToken {
    constructor(cancellationId, _fs) {
        this._fs = _fs;
        this.isCancelled = false;
        this.cancellationFilePath = uriUtils_1.UriEx.file(cancellationId);
    }
    get id() {
        return this.cancellationFilePath.toString();
    }
    get isCancellationRequested() {
        if (this.isCancelled) {
            return true;
        }
        if (CancellationThrottle.shouldCheck() && this._pipeExists()) {
            // The first time it encounters the cancellation file, it will
            // cancel itself and raise a cancellation event.
            // In this mode, cancel() might not be called explicitly by
            // jsonrpc layer.
            this.cancel();
        }
        return this.isCancelled;
    }
    get onCancellationRequested() {
        if (!this._emitter) {
            this._emitter = new vscode_jsonrpc_1.Emitter();
        }
        return this._emitter.event;
    }
    cancel() {
        if (!this.isCancelled) {
            this.isCancelled = true;
            if (this._emitter) {
                this._emitter.fire(undefined);
                this._disposeEmitter();
            }
        }
    }
    dispose() {
        this._disposeEmitter();
    }
    _disposeEmitter() {
        if (this._emitter) {
            this._emitter.dispose();
            this._emitter = undefined;
        }
    }
    _pipeExists() {
        try {
            this._fs.statSync(this.cancellationFilePath);
            return true;
        }
        catch (e) {
            return false;
        }
    }
}
exports.FileBasedToken = FileBasedToken;
class CancellationThrottle {
    static shouldCheck() {
        // Throttle cancellation checks to one every 5ms. This value
        // was selected through empirical testing. If we call the
        // file system more often than this, type analysis performance
        // is affected. If we call it less often, performance doesn't
        // improve much, but responsiveness suffers.
        const minTimeBetweenChecksInMs = 5;
        const curTimestamp = Date.now().valueOf();
        const timeSinceLastCheck = curTimestamp - this._lastCheckTimestamp;
        if (timeSinceLastCheck >= minTimeBetweenChecksInMs) {
            this._lastCheckTimestamp = curTimestamp;
            return true;
        }
        return false;
    }
}
exports.CancellationThrottle = CancellationThrottle;
CancellationThrottle._lastCheckTimestamp = 0;
async function raceCancellation(token, ...promises) {
    if (!token) {
        return Promise.race(promises);
    }
    if (token.isCancellationRequested) {
        throw new OperationCanceledException();
    }
    return new Promise((resolve, reject) => {
        if (token.isCancellationRequested) {
            return reject(new OperationCanceledException());
        }
        const disposable = onCancellationRequested(token, () => {
            disposable.dispose();
            reject(new OperationCanceledException());
        });
        Promise.race(promises)
            .then(resolve, reject)
            .finally(() => disposable.dispose());
    });
}
exports.raceCancellation = raceCancellation;
//# sourceMappingURL=cancellationUtils.js.map