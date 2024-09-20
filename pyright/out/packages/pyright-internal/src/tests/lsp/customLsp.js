"use strict";
/*
 * customLsp.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Custom messages and notifications on top of the LSP used for testing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomLSP = void 0;
// Type-safe LSP wrappers for our custom calls.
var CustomLSP;
(function (CustomLSP) {
    let TestSignalKinds;
    (function (TestSignalKinds) {
        TestSignalKinds["Initialization"] = "initialization";
        TestSignalKinds["DidOpenDocument"] = "didopendocument";
        TestSignalKinds["DidChangeDocument"] = "didchangedocument";
    })(TestSignalKinds = CustomLSP.TestSignalKinds || (CustomLSP.TestSignalKinds = {}));
    let Requests;
    (function (Requests) {
        Requests["GetDiagnostics"] = "test/getDiagnostics";
    })(Requests = CustomLSP.Requests || (CustomLSP.Requests = {}));
    let Notifications;
    (function (Notifications) {
        Notifications["SetStatusBarMessage"] = "python/setStatusBarMessage";
        Notifications["BeginProgress"] = "python/beginProgress";
        Notifications["ReportProgress"] = "python/reportProgress";
        Notifications["EndProgress"] = "python/endProgress";
        Notifications["WorkspaceTrusted"] = "python/workspaceTrusted";
        Notifications["TestSignal"] = "test/signal";
        // Due to some restrictions on vscode-languageserver-node package,
        // we can't mix use types from the package in 2 different extensions.
        // Basically due to how lsp package utilizes singleton objects internally,
        // if we use a client created from python core extension, which uses LSP library
        // they imported, with LSP types from LSP library we imported, LSP will throw
        // an exception saying internal singleton objects are not same.
        //
        // To workaround it, we won't use some of LSP types directly but create our own
        // and use them with the client.
        Notifications["DidChangeConfiguration"] = "workspace/didChangeConfiguration";
        Notifications["DidChangeNotebookDocument"] = "notebookDocument/didChange";
        Notifications["CacheDirCreate"] = "python/cacheDirCreate";
        Notifications["CacheFileWrite"] = "python/cacheFileWrite";
        // Starting/stopping the server are all notifications so they pass
        // through without any interference.
        Notifications["TestStartServer"] = "test/startServer";
        Notifications["TestStartServerResponse"] = "test/startServerResponse";
    })(Notifications = CustomLSP.Notifications || (CustomLSP.Notifications = {}));
    function sendRequest(connection, method, params, token) {
        return connection.sendRequest(method, params, token);
    }
    CustomLSP.sendRequest = sendRequest;
    function sendNotification(connection, method, params) {
        connection.sendNotification(method, params);
    }
    CustomLSP.sendNotification = sendNotification;
    function onRequest(connection, method, handler) {
        return connection.onRequest(method, handler);
    }
    CustomLSP.onRequest = onRequest;
    function onNotification(connection, method, handler) {
        return connection.onNotification(method, handler);
    }
    CustomLSP.onNotification = onNotification;
})(CustomLSP || (exports.CustomLSP = CustomLSP = {}));
//# sourceMappingURL=customLsp.js.map