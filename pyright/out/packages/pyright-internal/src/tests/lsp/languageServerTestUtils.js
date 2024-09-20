"use strict";
/*
 * languageServerTestUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Utilities for running tests against the LSP server.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestHost = exports.getInitializeParams = exports.hover = exports.openFile = exports.sleep = exports.initializeLanguageServer = exports.runPyrightServer = exports.waitForDiagnostics = exports.getParseResults = exports.updateSettingsMap = exports.createFileSystem = exports.getFileLikePath = exports.cleanupAfterAll = exports.logToDiskImpl = exports.logToDisk = exports.TestHostOptions = exports.STALL_SCRIPT_OUTPUT = exports.ERROR_SCRIPT_OUTPUT = exports.DEFAULT_WORKSPACE_ROOT = void 0;
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs-extra"));
const node_worker_threads_1 = require("node:worker_threads");
const path_1 = __importDefault(require("path"));
const vscode_languageserver_protocol_1 = require("vscode-languageserver-protocol");
const node_1 = require("vscode-languageserver/node");
const configOptions_1 = require("../../common/configOptions");
const core_1 = require("../../common/core");
const deferred_1 = require("../../common/deferred");
const diagnosticSink_1 = require("../../common/diagnosticSink");
const fullAccessHost_1 = require("../../common/fullAccessHost");
const pathUtils_1 = require("../../common/pathUtils");
const positionUtils_1 = require("../../common/positionUtils");
const pythonVersion_1 = require("../../common/pythonVersion");
const fileUri_1 = require("../../common/uri/fileUri");
const uri_1 = require("../../common/uri/uri");
const uriUtils_1 = require("../../common/uri/uriUtils");
const parser_1 = require("../../parser/parser");
const fourSlashParser_1 = require("../harness/fourslash/fourSlashParser");
const testStateUtils_1 = require("../harness/fourslash/testStateUtils");
const host = __importStar(require("../harness/testHost"));
const factory_1 = require("../harness/vfs/factory");
const vfs = __importStar(require("../harness/vfs/filesystem"));
const customLsp_1 = require("./customLsp");
// bundled root on test virtual file system.
const bundledStubsFolder = (0, pathUtils_1.combinePaths)(vfs.MODULE_PATH, 'bundled', 'stubs');
// bundled file path on real file system.
const bundledStubsFolderPath = (0, pathUtils_1.resolvePaths)(__dirname, '../../bundled/stubs');
const bundledStubsFolderPathTestServer = (0, pathUtils_1.resolvePaths)(__dirname, '../bundled/stubs');
// project root on test virtual file system.
exports.DEFAULT_WORKSPACE_ROOT = (0, pathUtils_1.combinePaths)('/', 'src');
exports.ERROR_SCRIPT_OUTPUT = 'Error: script failed to run';
exports.STALL_SCRIPT_OUTPUT = 'Timeout: script never finished running';
class TestHostOptions {
    constructor({ version = pythonVersion_1.pythonVersion3_10, platform = configOptions_1.PythonPlatform.Linux, searchPaths = [factory_1.libFolder, factory_1.distlibFolder], runScript = async (pythonPath, scriptPath, args, cwd, token) => {
        return { stdout: '', stderr: '' };
    }, } = {}) {
        this.version = version;
        this.platform = platform;
        this.searchPaths = searchPaths;
        this.runScript = runScript;
    }
}
exports.TestHostOptions = TestHostOptions;
// Enable this to log to disk for debugging sync issues.
const logToDisk = (m, f) => { }; // logToDiskImpl
exports.logToDisk = logToDisk;
function logToDiskImpl(message, fileName) {
    const thread = node_worker_threads_1.isMainThread ? 'main' : node_worker_threads_1.threadId.toString();
    fs.writeFileSync(fileName.getFilePath(), `${Date.now()} : ${thread} : ${message}\n`, {
        flag: 'a+',
    });
}
exports.logToDiskImpl = logToDiskImpl;
// Global server worker.
let serverWorker;
let serverWorkerFile;
let lastServerFinished = { name: '', finished: true };
function removeAllListeners(worker) {
    // Only remove the 'message', 'error' and 'close' events
    worker.rawListeners('message').forEach((listener) => worker.removeListener('message', listener));
    worker.rawListeners('error').forEach((listener) => worker.removeListener('error', listener));
    worker.rawListeners('close').forEach((listener) => worker.removeListener('close', listener));
}
function createServerWorker(file, testServerData) {
    // Do not terminate the worker if it's the same file. Reuse it.
    // This makes tests run a lot faster because creating a worker is the same
    // as starting a new process.
    if (!serverWorker || serverWorkerFile !== file) {
        serverWorker === null || serverWorker === void 0 ? void 0 : serverWorker.terminate();
        serverWorkerFile = file;
        serverWorker = new node_worker_threads_1.Worker(file);
        (0, exports.logToDisk)(`Created new server worker for ${file}`, testServerData.logFile);
    }
    // Every time we 'create' the worker, refresh its message handlers. This
    // is essentially the same thing as creating a new worker.
    removeAllListeners(serverWorker);
    (0, exports.logToDisk)(`Removed all worker listeners. Test ${testServerData.testName} is starting.\n  Last test was ${lastServerFinished.name} and finished: ${lastServerFinished.finished}`, testServerData.logFile);
    serverWorker.on('error', (e) => {
        (0, exports.logToDisk)(`Worker error: ${e}`, testServerData.logFile);
    });
    serverWorker.on('exit', (code) => {
        (0, exports.logToDisk)(`Worker exit: ${code}`, testServerData.logFile);
    });
    return serverWorker;
}
async function cleanupAfterAll() {
    if (serverWorker) {
        await serverWorker.terminate();
        serverWorker = undefined;
    }
}
exports.cleanupAfterAll = cleanupAfterAll;
function getFileLikePath(uri) {
    return fileUri_1.FileUri.isFileUri(uri) ? uri.getFilePath() : uri.toString();
}
exports.getFileLikePath = getFileLikePath;
function createFileSystem(projectRoot, testData, optionalHost) {
    const mountedPaths = new Map();
    if (fs.existsSync(bundledStubsFolderPath)) {
        mountedPaths.set(bundledStubsFolder, bundledStubsFolderPath);
    }
    else if (fs.existsSync(bundledStubsFolderPathTestServer)) {
        mountedPaths.set(bundledStubsFolder, bundledStubsFolderPathTestServer);
    }
    const vfsInfo = (0, testStateUtils_1.createVfsInfoFromFourSlashData)(projectRoot, testData);
    return (0, factory_1.createFromFileSystem)(optionalHost !== null && optionalHost !== void 0 ? optionalHost : host.HOST, vfsInfo.ignoreCase, { cwd: vfsInfo.projectRoot, files: vfsInfo.files, meta: testData.globalOptions }, mountedPaths);
}
exports.createFileSystem = createFileSystem;
const settingsMap = new Map();
function updateSettingsMap(info, settings) {
    const ignoreCase = (0, core_1.toBoolean)(info.testData.globalOptions["ignorecase" /* GlobalMetadataOptionNames.ignoreCase */]);
    // Normalize the URIs for all of the settings.
    settings.forEach((s) => {
        if (s.item.scopeUri) {
            s.item.scopeUri = uriUtils_1.UriEx.parse(s.item.scopeUri, !ignoreCase).toString();
        }
    });
    const current = settingsMap.get(info) || [];
    settingsMap.set(info, [...settings, ...current]);
}
exports.updateSettingsMap = updateSettingsMap;
function getParseResults(fileContents, isStubFile = false, ipythonMode = 0) {
    const diagSink = new diagnosticSink_1.DiagnosticSink();
    const parseOptions = new parser_1.ParseOptions();
    parseOptions.ipythonMode = ipythonMode;
    parseOptions.isStubFile = isStubFile;
    parseOptions.pythonVersion = pythonVersion_1.pythonVersion3_10;
    parseOptions.skipFunctionAndClassBody = false;
    // Parse the token stream, building the abstract syntax tree.
    const parser = new parser_1.Parser();
    return parser.parseSourceFile(fileContents, parseOptions, diagSink);
}
exports.getParseResults = getParseResults;
function createServerConnection(testServerData, disposables) {
    // Start a worker with the server running in it.
    const serverPath = path_1.default.join(__dirname, '..', '..', '..', 'out', 'testServer.bundle.js');
    (0, assert_1.default)(fs.existsSync(serverPath), `Server bundle does not exist: ${serverPath}. Make sure you ran the build script for test bundle (npm run webpack:testserver).`);
    const serverWorker = createServerWorker(serverPath, testServerData);
    const options = {};
    const connection = (0, node_1.createConnection)(new node_1.PortMessageReader(serverWorker), new node_1.PortMessageWriter(serverWorker), options);
    disposables.push(connection);
    return connection;
}
async function waitForDiagnostics(info, timeout = 10000) {
    const deferred = (0, deferred_1.createDeferred)();
    const disposable = info.diagnosticsEvent((params) => {
        if (params.diagnostics.length > 0) {
            deferred.resolve();
        }
    });
    const timer = setTimeout(() => deferred.reject('Timed out waiting for diagnostics'), timeout);
    try {
        await deferred.promise;
    }
    finally {
        clearTimeout(timer);
        disposable.dispose();
    }
    return info.diagnostics;
}
exports.waitForDiagnostics = waitForDiagnostics;
class TestProgressPart {
    constructor(_context, _token, info, done) {
        this._context = _context;
        this._token = _token;
        info.disposables.push(info.connection.onProgress(node_1.WorkDoneProgress.type, _token, (params) => {
            var _a;
            switch (params.kind) {
                case 'begin':
                    info.progressReporterStatus.set(_token.toString(), 0);
                    break;
                case 'report':
                    info.progressReporterStatus.set(_token.toString(), (_a = params.percentage) !== null && _a !== void 0 ? _a : 0);
                    break;
                case 'end':
                    done();
                    break;
            }
        }));
        info.progressReporters.push(this._token.toString());
        info.progressParts.set(this._token.toString(), this);
    }
    sendCancel() {
        this._context.sendNotification(node_1.WorkDoneProgressCancelNotification.type, { token: this._token });
    }
}
async function runPyrightServer(projectRoots, code, callInitialize = true, extraSettings, pythonVersion = pythonVersion_1.pythonVersion3_10, backgroundAnalysis) {
    var _a;
    // Setup the test data we need to send for Test server startup.
    const projectRootsArray = Array.isArray(projectRoots) ? projectRoots : [projectRoots];
    // Here all Uri has `isCaseSensitive` as true.
    const testServerData = {
        testName: (_a = expect.getState().currentTestName) !== null && _a !== void 0 ? _a : 'NoName',
        code,
        projectRoots: projectRootsArray.map((p) => (p.includes(':') ? uriUtils_1.UriEx.parse(p) : uriUtils_1.UriEx.file(p))),
        pythonVersion: pythonVersion.toString(),
        backgroundAnalysis,
        logFile: uriUtils_1.UriEx.file(path_1.default.join(__dirname, `log${process.pid}.txt`)),
        pid: process.pid.toString(),
    };
    (0, exports.logToDisk)(`Starting test ${testServerData.testName}`, testServerData.logFile);
    lastServerFinished = { name: testServerData.testName, finished: false };
    // Parse the test data on this side as well. This allows the use of markers and such.
    const testData = (0, fourSlashParser_1.parseTestData)(testServerData.projectRoots.length === 1
        ? getFileLikePath(testServerData.projectRoots[0])
        : exports.DEFAULT_WORKSPACE_ROOT, testServerData.code, 'noname.py');
    const ignoreCase = (0, core_1.toBoolean)(testData.globalOptions["ignorecase" /* GlobalMetadataOptionNames.ignoreCase */]);
    // Normalize the URIs for all of the settings.
    extraSettings === null || extraSettings === void 0 ? void 0 : extraSettings.forEach((s) => {
        if (s.item.scopeUri) {
            s.item.scopeUri = uriUtils_1.UriEx.parse(s.item.scopeUri, !ignoreCase).toString();
        }
    });
    // Start listening to the 'client' side of the connection.
    const disposables = [];
    const connection = createServerConnection(testServerData, disposables);
    const serverStarted = (0, deferred_1.createDeferred)();
    const diagnosticsEmitter = new node_1.Emitter();
    const workspaceEditsEmitter = new node_1.Emitter();
    // Setup the server info.
    const info = {
        disposables,
        registrations: [],
        connection,
        logs: [],
        progressReporters: [],
        progressReporterStatus: new Map(),
        progressParts: new Map(),
        signals: new Map(Object.values(customLsp_1.CustomLSP.TestSignalKinds).map((v) => [v, (0, deferred_1.createDeferred)()])),
        testData,
        testName: testServerData.testName,
        telemetry: [],
        projectRoots: testServerData.projectRoots,
        diagnostics: [],
        diagnosticsEvent: diagnosticsEmitter.event,
        workspaceEdits: [],
        workspaceEditsEvent: workspaceEditsEmitter.event,
        getInitializeParams: () => getInitializeParams(testServerData.projectRoots),
        convertPathToUri: (path) => uriUtils_1.UriEx.file(path, !ignoreCase),
        dispose: async () => {
            // Send shutdown. This should disconnect the dispatcher and kill the server.
            await connection.sendRequest(vscode_languageserver_protocol_1.ShutdownRequest.type, undefined);
            // Now we can dispose the connection.
            disposables.forEach((d) => d.dispose());
            (0, exports.logToDisk)(`Finished test ${testServerData.testName}`, testServerData.logFile);
        },
    };
    info.disposables.push(info.connection.onNotification(customLsp_1.CustomLSP.Notifications.TestStartServerResponse, (p) => {
        serverStarted.resolve(p.testName);
    }), info.connection.onRequest(vscode_languageserver_protocol_1.RegistrationRequest.type, (p) => {
        info.registrations.push(...p.registrations);
    }), info.connection.onNotification(customLsp_1.CustomLSP.Notifications.TestSignal, (p) => {
        info.signals.get(p.kind).resolve(true);
    }), info.connection.onNotification(vscode_languageserver_protocol_1.LogMessageNotification.type, (p) => {
        info.logs.push(p);
    }), info.connection.onRequest(vscode_languageserver_protocol_1.SemanticTokensRefreshRequest.type, () => {
        // Empty. Silently ignore for now.
    }), info.connection.onRequest(vscode_languageserver_protocol_1.InlayHintRefreshRequest.type, () => {
        // Empty. Silently ignore for now.
    }), info.connection.onRequest(vscode_languageserver_protocol_1.ApplyWorkspaceEditRequest.type, (p) => {
        info.workspaceEdits.push(p);
        workspaceEditsEmitter.fire(p);
        return { applied: true };
    }), info.connection.onRequest(vscode_languageserver_protocol_1.UnregistrationRequest.type, (p) => {
        const unregisterIds = p.unregisterations.map((u) => u.id);
        info.registrations = info.registrations.filter((r) => !unregisterIds.includes(r.id));
    }), info.connection.onRequest(node_1.WorkDoneProgressCreateRequest.type, (p) => {
        // Save the progress reporter so we can send progress updates.
        info.progressReporters.push(p.token.toString());
        info.disposables.push(info.connection.onProgress(node_1.WorkDoneProgress.type, p.token, (params) => {
            var _a;
            switch (params.kind) {
                case 'begin':
                    info.progressReporterStatus.set(p.token.toString(), 0);
                    break;
                case 'report':
                    info.progressReporterStatus.set(p.token.toString(), (_a = params.percentage) !== null && _a !== void 0 ? _a : 0);
                    break;
                case 'end':
                    break;
            }
        }));
    }), info.connection.onNotification(vscode_languageserver_protocol_1.PublishDiagnosticsNotification.type, (p) => {
        info.diagnostics.push(p);
        diagnosticsEmitter.fire(p);
    }), info.connection.onNotification(vscode_languageserver_protocol_1.TelemetryEventNotification.type, (p) => {
        info.telemetry.push(p);
    }));
    info.disposables.push(info.connection.onRequest(vscode_languageserver_protocol_1.ConfigurationRequest.type, (p) => {
        const result = [];
        const mappedSettings = settingsMap.get(info) || [];
        for (const item of p.items) {
            const setting = mappedSettings.find((s) => (s.item.scopeUri === item.scopeUri || s.item.scopeUri === undefined) &&
                s.item.section === item.section);
            result.push(setting === null || setting === void 0 ? void 0 : setting.value);
        }
        return result;
    }));
    // Merge the extra settings.
    const settings = [];
    if (extraSettings) {
        for (const extra of extraSettings) {
            const existing = settings.find((s) => s.item.section === extra.item.section && s.item.scopeUri === extra.item.scopeUri);
            if (existing) {
                existing.value = { ...existing.value, ...extra.value };
            }
            else {
                settings.push(extra);
            }
        }
    }
    settingsMap.set(info, settings);
    // Wait for the server to be started.
    connection.listen();
    (0, exports.logToDisk)(`Sending start notification for ${testServerData.testName}`, testServerData.logFile);
    customLsp_1.CustomLSP.sendNotification(connection, customLsp_1.CustomLSP.Notifications.TestStartServer, testServerData);
    const serverTestName = await serverStarted.promise;
    assert_1.default.equal(serverTestName, testServerData.testName, 'Server started for wrong test');
    (0, exports.logToDisk)(`Started test ${testServerData.testName}`, testServerData.logFile);
    // Initialize the server if requested.
    if (callInitialize) {
        await initializeLanguageServer(info);
        (0, exports.logToDisk)(`Initialized test ${testServerData.testName}`, testServerData.logFile);
    }
    if (lastServerFinished.name === testServerData.testName) {
        lastServerFinished.finished = true;
    }
    else {
        (0, exports.logToDisk)(`Last server finished was incorrectly updated to ${lastServerFinished.name}`, testServerData.logFile);
    }
    return info;
}
exports.runPyrightServer = runPyrightServer;
async function initializeLanguageServer(info) {
    var _a;
    const params = info.getInitializeParams();
    // Send the initialize request.
    const result = await info.connection.sendRequest(vscode_languageserver_protocol_1.InitializeRequest.type, params, vscode_languageserver_protocol_1.CancellationToken.None);
    info.connection.sendNotification(vscode_languageserver_protocol_1.InitializedNotification.type, {});
    if ((_a = params.workspaceFolders) === null || _a === void 0 ? void 0 : _a.length) {
        info.connection.sendNotification(vscode_languageserver_protocol_1.DidChangeWorkspaceFoldersNotification.type, {
            event: {
                added: params.workspaceFolders,
                removed: [],
            },
        });
        // Wait until workspace initialization is done.
        // This is required since some tests check status of server directly. In such case, even if the client sent notification,
        // server might not have processed it and still in the event queue.
        // This check makes sure server at least processed initialization before test checking server status directly.
        // If test only uses response from client.sendRequest, then this won't be needed.
        await info.signals.get(customLsp_1.CustomLSP.TestSignalKinds.Initialization).promise;
    }
    return result;
}
exports.initializeLanguageServer = initializeLanguageServer;
async function sleep(timeout) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(timeout), timeout);
    });
}
exports.sleep = sleep;
function openFile(info, markerName, text) {
    const marker = (0, testStateUtils_1.getMarkerByName)(info.testData, markerName);
    const uri = marker.fileUri.toString();
    text = text !== null && text !== void 0 ? text : info.testData.files.find((f) => f.fileName === marker.fileName).content;
    info.connection.sendNotification(vscode_languageserver_protocol_1.DidOpenTextDocumentNotification.type, {
        textDocument: { uri, languageId: 'python', version: 1, text },
    });
}
exports.openFile = openFile;
async function hover(info, markerName) {
    const marker = info.testData.markerPositions.get('marker');
    const fileUri = marker.fileUri;
    const text = info.testData.files.find((d) => d.fileName === marker.fileName).content;
    const parseResult = getParseResults(text);
    const hoverResult = await info.connection.sendRequest(node_1.HoverRequest.type, {
        textDocument: { uri: fileUri.toString() },
        position: (0, positionUtils_1.convertOffsetToPosition)(marker.position, parseResult.tokenizerOutput.lines),
    }, vscode_languageserver_protocol_1.CancellationToken.None);
    return hoverResult;
}
exports.hover = hover;
function getInitializeParams(projectRoots) {
    // cloned vscode "1.71.0-insider"'s initialize params.
    const workspaceFolders = projectRoots
        ? projectRoots.map((root, i) => ({ name: root.fileName, uri: projectRoots[i].toString() }))
        : [];
    const params = {
        processId: process.pid,
        clientInfo: {
            name: `Pylance Unit Test ${expect.getState().currentTestName}`,
            version: '1.71.0-insider',
        },
        locale: 'en-us',
        rootPath: null,
        rootUri: null,
        capabilities: {
            workspace: {
                applyEdit: true,
                workspaceEdit: {
                    documentChanges: true,
                    resourceOperations: ['create', 'rename', 'delete'],
                    failureHandling: 'textOnlyTransactional',
                    normalizesLineEndings: true,
                    changeAnnotationSupport: {
                        groupsOnLabel: true,
                    },
                },
                configuration: true,
                didChangeWatchedFiles: {
                    dynamicRegistration: true,
                    relativePatternSupport: true,
                },
                symbol: {
                    dynamicRegistration: true,
                    symbolKind: {
                        valueSet: [
                            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
                            26,
                        ],
                    },
                    tagSupport: {
                        valueSet: [1],
                    },
                    resolveSupport: {
                        properties: ['location.range'],
                    },
                },
                codeLens: {
                    refreshSupport: true,
                },
                executeCommand: {
                    dynamicRegistration: true,
                },
                didChangeConfiguration: {
                    dynamicRegistration: true,
                },
                workspaceFolders: true,
                semanticTokens: {
                    refreshSupport: true,
                },
                fileOperations: {
                    dynamicRegistration: true,
                    didCreate: true,
                    didRename: true,
                    didDelete: true,
                    willCreate: true,
                    willRename: true,
                    willDelete: true,
                },
                inlineValue: {
                    refreshSupport: true,
                },
                inlayHint: {
                    refreshSupport: true,
                },
                diagnostics: {
                    refreshSupport: true,
                },
            },
            textDocument: {
                publishDiagnostics: {
                    relatedInformation: true,
                    versionSupport: false,
                    tagSupport: {
                        valueSet: [1, 2],
                    },
                    codeDescriptionSupport: true,
                    dataSupport: true,
                },
                synchronization: {
                    dynamicRegistration: true,
                    willSave: true,
                    willSaveWaitUntil: true,
                    didSave: true,
                },
                completion: {
                    dynamicRegistration: true,
                    contextSupport: true,
                    completionItem: {
                        snippetSupport: true,
                        commitCharactersSupport: true,
                        documentationFormat: ['markdown', 'plaintext'],
                        deprecatedSupport: true,
                        preselectSupport: true,
                        tagSupport: {
                            valueSet: [1],
                        },
                        insertReplaceSupport: true,
                        resolveSupport: {
                            properties: ['documentation', 'detail', 'additionalTextEdits'],
                        },
                        insertTextModeSupport: {
                            valueSet: [1, 2],
                        },
                        labelDetailsSupport: true,
                    },
                    insertTextMode: 2,
                    completionItemKind: {
                        valueSet: [
                            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
                        ],
                    },
                    completionList: {
                        itemDefaults: ['commitCharacters', 'editRange', 'insertTextFormat', 'insertTextMode'],
                    },
                },
                hover: {
                    dynamicRegistration: true,
                    contentFormat: ['markdown', 'plaintext'],
                },
                signatureHelp: {
                    dynamicRegistration: true,
                    signatureInformation: {
                        documentationFormat: ['markdown', 'plaintext'],
                        parameterInformation: {
                            labelOffsetSupport: true,
                        },
                        activeParameterSupport: true,
                    },
                    contextSupport: true,
                },
                definition: {
                    dynamicRegistration: true,
                    linkSupport: true,
                },
                references: {
                    dynamicRegistration: true,
                },
                documentHighlight: {
                    dynamicRegistration: true,
                },
                documentSymbol: {
                    dynamicRegistration: true,
                    symbolKind: {
                        valueSet: [
                            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
                            26,
                        ],
                    },
                    hierarchicalDocumentSymbolSupport: true,
                    tagSupport: {
                        valueSet: [1],
                    },
                    labelSupport: true,
                },
                codeAction: {
                    dynamicRegistration: true,
                    isPreferredSupport: true,
                    disabledSupport: true,
                    dataSupport: true,
                    resolveSupport: {
                        properties: ['edit'],
                    },
                    codeActionLiteralSupport: {
                        codeActionKind: {
                            valueSet: [
                                '',
                                'quickfix',
                                'refactor',
                                'refactor.extract',
                                'refactor.inline',
                                'refactor.rewrite',
                                'source',
                                'source.organizeImports',
                            ],
                        },
                    },
                    honorsChangeAnnotations: false,
                },
                codeLens: {
                    dynamicRegistration: true,
                },
                formatting: {
                    dynamicRegistration: true,
                },
                rangeFormatting: {
                    dynamicRegistration: true,
                },
                onTypeFormatting: {
                    dynamicRegistration: true,
                },
                rename: {
                    dynamicRegistration: true,
                    prepareSupport: true,
                    prepareSupportDefaultBehavior: 1,
                    honorsChangeAnnotations: true,
                },
                documentLink: {
                    dynamicRegistration: true,
                    tooltipSupport: true,
                },
                typeDefinition: {
                    dynamicRegistration: true,
                    linkSupport: true,
                },
                implementation: {
                    dynamicRegistration: true,
                    linkSupport: true,
                },
                colorProvider: {
                    dynamicRegistration: true,
                },
                foldingRange: {
                    dynamicRegistration: true,
                    rangeLimit: 5000,
                    lineFoldingOnly: true,
                    foldingRangeKind: {
                        valueSet: ['comment', 'imports', 'region'],
                    },
                    foldingRange: {
                        collapsedText: false,
                    },
                },
                declaration: {
                    dynamicRegistration: true,
                    linkSupport: true,
                },
                selectionRange: {
                    dynamicRegistration: true,
                },
                callHierarchy: {
                    dynamicRegistration: true,
                },
                semanticTokens: {
                    dynamicRegistration: true,
                    tokenTypes: [
                        'namespace',
                        'type',
                        'class',
                        'enum',
                        'interface',
                        'struct',
                        'typeParameter',
                        'parameter',
                        'variable',
                        'property',
                        'enumMember',
                        'event',
                        'function',
                        'method',
                        'macro',
                        'keyword',
                        'modifier',
                        'comment',
                        'string',
                        'number',
                        'regexp',
                        'operator',
                        'decorator',
                    ],
                    tokenModifiers: [
                        'declaration',
                        'definition',
                        'readonly',
                        'static',
                        'deprecated',
                        'abstract',
                        'async',
                        'modification',
                        'documentation',
                        'defaultLibrary',
                    ],
                    formats: ['relative'],
                    requests: {
                        range: true,
                        full: {
                            delta: true,
                        },
                    },
                    multilineTokenSupport: false,
                    overlappingTokenSupport: false,
                    serverCancelSupport: true,
                    augmentsSyntaxTokens: true,
                },
                linkedEditingRange: {
                    dynamicRegistration: true,
                },
                typeHierarchy: {
                    dynamicRegistration: true,
                },
                inlineValue: {
                    dynamicRegistration: true,
                },
                inlayHint: {
                    dynamicRegistration: true,
                    resolveSupport: {
                        properties: ['tooltip', 'textEdits', 'label.tooltip', 'label.location', 'label.command'],
                    },
                },
                diagnostic: {
                    dynamicRegistration: true,
                    relatedDocumentSupport: false,
                },
            },
            window: {
                showMessage: {
                    messageActionItem: {
                        additionalPropertiesSupport: true,
                    },
                },
                showDocument: {
                    support: true,
                },
                workDoneProgress: true,
            },
            general: {
                staleRequestSupport: {
                    cancel: true,
                    retryOnContentModified: [
                        'textDocument/semanticTokens/full',
                        'textDocument/semanticTokens/range',
                        'textDocument/semanticTokens/full/delta',
                    ],
                },
                regularExpressions: {
                    engine: 'ECMAScript',
                    version: 'ES2020',
                },
                markdown: {
                    parser: 'marked',
                    version: '1.1.0',
                },
                positionEncodings: ['utf-16'],
            },
            notebookDocument: {
                synchronization: {
                    dynamicRegistration: true,
                    executionSummarySupport: true,
                },
            },
        },
        initializationOptions: {
            autoFormatStrings: true,
        },
        workspaceFolders,
    };
    return params;
}
exports.getInitializeParams = getInitializeParams;
class TestHost extends fullAccessHost_1.LimitedAccessHost {
    constructor(fs, testFs, testData, projectRoots, options) {
        super();
        this.fs = fs;
        this.testFs = testFs;
        this.testData = testData;
        this.projectRoots = projectRoots;
        this._options = options !== null && options !== void 0 ? options : new TestHostOptions();
    }
    get kind() {
        return 0 /* HostKind.FullAccess */;
    }
    getPythonVersion(pythonPath, logInfo) {
        return this._options.version;
    }
    getPythonPlatform(logInfo) {
        return this._options.platform;
    }
    getPythonSearchPaths(pythonPath, logInfo) {
        return {
            paths: this._options.searchPaths,
            prefix: uri_1.Uri.empty(),
        };
    }
    runScript(pythonPath, scriptPath, args, cwd, token) {
        return this._options.runScript(pythonPath, scriptPath, args, cwd, token);
    }
}
exports.TestHost = TestHost;
//# sourceMappingURL=languageServerTestUtils.js.map