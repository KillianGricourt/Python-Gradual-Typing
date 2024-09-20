"use strict";
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
exports.run = void 0;
/*
 * languageServer.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Test language server wrapper that lets us run the language server during a test.
 */
const node_1 = require("vscode-languageserver/node");
const worker_threads_1 = require("worker_threads");
const deferred_1 = require("../../common/deferred");
const pathUtils_1 = require("../../common/pathUtils");
const serviceProvider_1 = require("../../common/serviceProvider");
const uri_1 = require("../../common/uri/uri");
const fourSlashParser_1 = require("../harness/fourslash/fourSlashParser");
const PyrightTestHost = __importStar(require("../harness/testHost"));
const factory_1 = require("../harness/vfs/factory");
const backgroundAnalysis_1 = require("../../backgroundAnalysis");
const backgroundThreadBase_1 = require("../../backgroundThreadBase");
const pythonVersion_1 = require("../../common/pythonVersion");
const serviceKeys_1 = require("../../common/serviceKeys");
const pyrightFileSystem_1 = require("../../pyrightFileSystem");
const server_1 = require("../../server");
const customLsp_1 = require("./customLsp");
const languageServerTestUtils_1 = require("./languageServerTestUtils");
const WORKER_STARTED = 'WORKER_STARTED';
const WORKER_BACKGROUND_DATA = 'WORKER_BACKGROUND_DATA';
function getCommonRoot(files) {
    var _a;
    let root = ((_a = files[0]) === null || _a === void 0 ? void 0 : _a.getPath()) || languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT;
    for (let i = 1; i < files.length; i++) {
        const file = files[i];
        while (root.length > 0 && !file.pathStartsWith(root)) {
            root = root.slice(0, root.lastIndexOf('/'));
        }
    }
    return root;
}
class TestPyrightHost {
    constructor(_host) {
        this._host = _host;
    }
    useCaseSensitiveFileNames() {
        return this._host.useCaseSensitiveFileNames();
    }
    getAccessibleFileSystemEntries(dirname) {
        return this._host.getAccessibleFileSystemEntries(dirname);
    }
    directoryExists(path) {
        return this._host.directoryExists(path);
    }
    fileExists(fileName) {
        return this._host.fileExists(fileName);
    }
    getFileSize(path) {
        return this._host.getFileSize(path);
    }
    readFile(path) {
        return this._host.readFile(path);
    }
    getWorkspaceRoot() {
        // The default workspace root is wrong. It should be based on where the bundle is running.
        // That's where the typeshed fallback and other bundled files are located.
        return (0, pathUtils_1.resolvePaths)(__dirname);
    }
    writeFile(path, contents) {
        this._host.writeFile(path, contents);
    }
    listFiles(path, filter, options) {
        return this._host.listFiles(path, filter, options);
    }
    log(text) {
        this._host.log(text);
    }
}
function createTestHost(testServerData) {
    const scriptOutput = '';
    const runScript = async (pythonPath, scriptPath, args, cwd, token) => {
        return { stdout: scriptOutput, stderr: '', exitCode: 0 };
    };
    const options = new languageServerTestUtils_1.TestHostOptions({ version: pythonVersion_1.PythonVersion.fromString(testServerData.pythonVersion), runScript });
    const projectRootPaths = testServerData.projectRoots.map((p) => (0, languageServerTestUtils_1.getFileLikePath)(p));
    const testData = (0, fourSlashParser_1.parseTestData)(testServerData.projectRoots.length === 1 ? projectRootPaths[0] : languageServerTestUtils_1.DEFAULT_WORKSPACE_ROOT, testServerData.code, 'noname.py');
    const commonRoot = getCommonRoot(testServerData.projectRoots);
    // Make sure global variables from previous tests are cleared.
    (0, factory_1.clearCache)();
    // create a test file system using the test data.
    const fs = (0, languageServerTestUtils_1.createFileSystem)(commonRoot, testData, new TestPyrightHost(PyrightTestHost.HOST));
    return new languageServerTestUtils_1.TestHost(fs, fs, testData, projectRootPaths, options);
}
class TestServer extends server_1.PyrightServer {
    constructor(connection, fs, _supportsBackgroundAnalysis) {
        super(connection, _supportsBackgroundAnalysis ? 1 : 0, fs);
        this._supportsBackgroundAnalysis = _supportsBackgroundAnalysis;
    }
    test_onDidChangeWatchedFiles(params) {
        this.onDidChangeWatchedFiles(params);
    }
    async updateSettingsForWorkspace(workspace, status, serverSettings) {
        var _a, _b;
        const result = await super.updateSettingsForWorkspace(workspace, status, serverSettings);
        // LSP notification only allows synchronous callback. because of that, the one that sent the notification can't know
        // when the work caused by the notification actually ended. To workaround that issue, we will send custom lsp to indicate
        // something has been done.
        customLsp_1.CustomLSP.sendNotification(this.connection, customLsp_1.CustomLSP.Notifications.TestSignal, {
            uri: (_b = (_a = workspace.rootUri) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : '',
            kind: customLsp_1.CustomLSP.TestSignalKinds.Initialization,
        });
        return result;
    }
    createBackgroundAnalysis(serviceId) {
        if (this._supportsBackgroundAnalysis) {
            return new backgroundAnalysis_1.BackgroundAnalysis(this.serverOptions.serviceProvider);
        }
        return undefined;
    }
}
async function runServer(testServerData, reader, writer, connectionFactory) {
    // Create connection back to the client first.
    const connection = connectionFactory(reader, writer);
    // Fixup the input data.
    testServerData = {
        ...testServerData,
        projectRoots: testServerData.projectRoots.map((p) => uri_1.Uri.fromJsonObj(p)),
        logFile: uri_1.Uri.fromJsonObj(testServerData.logFile),
    };
    try {
        // Create a host so we can control the file system for the PyrightServer.
        const disposables = [];
        const host = createTestHost(testServerData);
        const server = new TestServer(connection, host.fs, testServerData.backgroundAnalysis);
        // Listen for the test messages from the client. These messages
        // are how the test code queries the state of the server.
        disposables.push(customLsp_1.CustomLSP.onRequest(connection, customLsp_1.CustomLSP.Requests.GetDiagnostics, async (params, token) => {
            const filePath = uri_1.Uri.parse(params.uri, server.serviceProvider);
            const workspace = await server.getWorkspaceForFile(filePath);
            workspace.service.test_program.analyze(undefined, token);
            const file = workspace.service.test_program.getBoundSourceFile(filePath);
            const diagnostics = (file === null || file === void 0 ? void 0 : file.getDiagnostics(workspace.service.test_program.configOptions)) || [];
            return { diagnostics: (0, backgroundThreadBase_1.serialize)(diagnostics) };
        }));
        // Dispose the server and connection when terminating the server.
        disposables.push(server);
        disposables.push(connection);
        return { disposables, connection };
    }
    catch (err) {
        console.error(err);
        return { disposables: [], connection };
    }
}
class ListeningPortMessageWriter extends node_1.PortMessageWriter {
    constructor(port) {
        super(port);
        this._callbacks = [];
    }
    async write(msg) {
        await Promise.all(this._callbacks.map((c) => c(msg)));
        return super.write(msg);
    }
    onPostMessage(callback) {
        this._callbacks.push(callback);
    }
}
/**
 * Object that exists in the worker thread that starts and stops (and cleans up after) the main server.
 */
class ServerStateManager {
    constructor(_connectionFactory) {
        this._connectionFactory = _connectionFactory;
        this._instances = [];
        this._reader = new node_1.PortMessageReader(worker_threads_1.parentPort);
        this._writer = new ListeningPortMessageWriter(worker_threads_1.parentPort);
        this._shutdownId = null;
        // Listen for shutdown response.
        this._writer.onPostMessage(async (msg) => {
            if (node_1.Message.isResponse(msg) && msg.id === this._shutdownId) {
                await this._handleShutdown();
            }
        });
    }
    run() {
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.on('message', (message) => this._handleMessage(message));
    }
    _handleMessage(message) {
        try {
            // Debug output to help diagnose sync issues.
            if (message && message.method === customLsp_1.CustomLSP.Notifications.TestStartServer) {
                this._handleStart(message.params);
            }
            else if (node_1.Message.isRequest(message) && message.method === node_1.ShutdownRequest.method) {
                this._shutdownId = message.id;
            }
        }
        catch (err) {
            console.error(err);
        }
    }
    async _handleStart(options) {
        var _a;
        (0, languageServerTestUtils_1.logToDisk)(`Starting server for ${options.testName}`, options.logFile);
        // Every time we start the server, remove all message handlers from our PortMessageReader.
        // This prevents the old servers from responding to messages for new ones.
        this._reader.dispose();
        // Wait for the previous server to finish. This should be okay because the test
        // client waits for the response message before sending anything else. Otherwise
        // we'd receive the initialize message for the server and drop it before the server
        // actually started.
        if (this._pendingDispose) {
            (0, languageServerTestUtils_1.logToDisk)(`Waiting for previous server ${(_a = this._currentOptions) === null || _a === void 0 ? void 0 : _a.testName} to finish for ${options.testName}`, options.logFile);
            await this._pendingDispose.promise;
            this._pendingDispose = undefined;
        }
        this._currentOptions = options;
        // Set the worker data for the current test. Any background threads
        // started after this point will pick up this value.
        (0, worker_threads_1.setEnvironmentData)(WORKER_BACKGROUND_DATA, options);
        // Create an instance of the server.
        const { disposables, connection } = await runServer(options, this._reader, this._writer, this._connectionFactory);
        this._instances.push({ disposables, connection });
        // Enable this to help diagnose sync issues.
        (0, languageServerTestUtils_1.logToDisk)(`Started server for ${options.testName}`, options.logFile);
        // Respond back.
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({
            jsonrpc: '2.0',
            method: customLsp_1.CustomLSP.Notifications.TestStartServerResponse,
            params: options,
        });
    }
    async _handleShutdown() {
        var _a, _b, _c, _d, _e;
        if (this._currentOptions) {
            (0, languageServerTestUtils_1.logToDisk)(`Stopping ${(_a = this._currentOptions) === null || _a === void 0 ? void 0 : _a.testName}`, this._currentOptions.logFile);
        }
        this._shutdownId = null;
        const instance = this._instances.pop();
        if (instance) {
            this._pendingDispose = (0, deferred_1.createDeferred)();
            // Dispose the server first. This might send a message or two.
            const serverIndex = instance.disposables.findIndex((d) => d instanceof TestServer);
            if (serverIndex >= 0) {
                try {
                    instance.disposables[serverIndex].dispose();
                    instance.disposables = instance.disposables.splice(serverIndex, 1);
                }
                catch (e) {
                    // Dispose failures don't matter.
                }
            }
            // Wait for our connection to finish first. Give it 10 tries.
            // This is a bit of a hack but there are no good ways to cancel all running requests
            // on shutdown.
            let count = 0;
            while (count < 10 && ((_c = (_b = instance.connection.console) === null || _b === void 0 ? void 0 : _b._rawConnection) === null || _c === void 0 ? void 0 : _c.hasPendingResponse())) {
                await (0, languageServerTestUtils_1.sleep)(10);
                count += 1;
            }
            this._pendingDispose.resolve();
            try {
                instance.disposables.forEach((d) => {
                    d.dispose();
                });
            }
            catch (e) {
                // Dispose failures don't matter.
            }
            this._pendingDispose = undefined;
            if (this._currentOptions) {
                (0, languageServerTestUtils_1.logToDisk)(`Stopped ${(_d = this._currentOptions) === null || _d === void 0 ? void 0 : _d.testName}`, this._currentOptions.logFile);
            }
        }
        else {
            if (this._currentOptions) {
                (0, languageServerTestUtils_1.logToDisk)(`Failed to stop ${(_e = this._currentOptions) === null || _e === void 0 ? void 0 : _e.testName}`, this._currentOptions.logFile);
            }
        }
        if (global.gc) {
            global.gc();
        }
    }
}
async function runTestBackgroundThread() {
    let options = (0, worker_threads_1.getEnvironmentData)(WORKER_BACKGROUND_DATA);
    // Normalize the options.
    options = {
        ...options,
        projectRoots: options.projectRoots.map((p) => uri_1.Uri.fromJsonObj(p)),
        logFile: uri_1.Uri.fromJsonObj(options.logFile),
    };
    try {
        // Create a host on the background thread too so that it uses
        // the host's file system. Has to be sync so that we don't
        // drop any messages sent to the background thread.
        const host = createTestHost(options);
        const fs = new pyrightFileSystem_1.PyrightFileSystem(host.fs);
        const serviceProvider = new serviceProvider_1.ServiceProvider();
        serviceProvider.add(serviceKeys_1.ServiceKeys.fs, fs);
        // run default background runner
        const runner = new backgroundAnalysis_1.BackgroundAnalysisRunner(serviceProvider);
        runner.start();
    }
    catch (e) {
        console.error(`BackgroundThread crashed with ${e}`);
    }
}
function run() {
    // Start the background thread if this is not the first worker.
    if ((0, worker_threads_1.getEnvironmentData)(WORKER_STARTED) === 'true') {
        runTestBackgroundThread();
    }
    else {
        (0, worker_threads_1.setEnvironmentData)(WORKER_STARTED, 'true');
        // Start the server state manager.
        const stateManager = new ServerStateManager((reader, writer) => (0, node_1.createConnection)(reader, writer, {}));
        stateManager.run();
    }
}
exports.run = run;
//# sourceMappingURL=languageServer.js.map