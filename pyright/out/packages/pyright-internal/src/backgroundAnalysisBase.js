"use strict";
/*
 * backgroundAnalysisBase.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * run analyzer from background thread
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
exports.BackgroundAnalysisRunnerBase = exports.BackgroundAnalysisBase = void 0;
const worker_threads_1 = require("worker_threads");
const analysis_1 = require("./analyzer/analysis");
const program_1 = require("./analyzer/program");
const backgroundThreadBase_1 = require("./backgroundThreadBase");
const cancellationUtils_1 = require("./common/cancellationUtils");
const configOptions_1 = require("./common/configOptions");
const console_1 = require("./common/console");
const debug = __importStar(require("./common/debug"));
const diagnostic_1 = require("./common/diagnostic");
const fileBasedCancellationUtils_1 = require("./common/fileBasedCancellationUtils");
const logTracker_1 = require("./common/logTracker");
const uri_1 = require("./common/uri/uri");
class BackgroundAnalysisBase {
    constructor(console) {
        this.console = console;
        this._onAnalysisCompletion = analysis_1.nullCallback;
        // Don't allow instantiation of this type directly.
    }
    setCompletionCallback(callback) {
        this._onAnalysisCompletion = callback !== null && callback !== void 0 ? callback : analysis_1.nullCallback;
    }
    setImportResolver(importResolver) {
        this.enqueueRequest({ requestType: 'setImportResolver', data: (0, backgroundThreadBase_1.serialize)(importResolver.host.kind) });
    }
    setConfigOptions(configOptions) {
        this.enqueueRequest({ requestType: 'setConfigOptions', data: (0, backgroundThreadBase_1.serialize)(configOptions) });
    }
    setTrackedFiles(fileUris) {
        this.enqueueRequest({ requestType: 'setTrackedFiles', data: (0, backgroundThreadBase_1.serialize)(fileUris) });
    }
    setAllowedThirdPartyImports(importNames) {
        this.enqueueRequest({ requestType: 'setAllowedThirdPartyImports', data: (0, backgroundThreadBase_1.serialize)(importNames) });
    }
    ensurePartialStubPackages(executionRoot) {
        this.enqueueRequest({ requestType: 'ensurePartialStubPackages', data: (0, backgroundThreadBase_1.serialize)({ executionRoot }) });
    }
    setFileOpened(fileUri, version, contents, options) {
        this.enqueueRequest({
            requestType: 'setFileOpened',
            data: (0, backgroundThreadBase_1.serialize)({ fileUri, version, contents, options }),
        });
    }
    updateChainedUri(fileUri, chainedUri) {
        this.enqueueRequest({
            requestType: 'updateChainedFileUri',
            data: (0, backgroundThreadBase_1.serialize)({ fileUri, chainedUri }),
        });
    }
    setFileClosed(fileUri, isTracked) {
        this.enqueueRequest({ requestType: 'setFileClosed', data: (0, backgroundThreadBase_1.serialize)({ fileUri, isTracked }) });
    }
    addInterimFile(fileUri) {
        this.enqueueRequest({ requestType: 'addInterimFile', data: (0, backgroundThreadBase_1.serialize)({ fileUri }) });
    }
    markAllFilesDirty(evenIfContentsAreSame) {
        this.enqueueRequest({ requestType: 'markAllFilesDirty', data: (0, backgroundThreadBase_1.serialize)({ evenIfContentsAreSame }) });
    }
    markFilesDirty(fileUris, evenIfContentsAreSame) {
        this.enqueueRequest({
            requestType: 'markFilesDirty',
            data: (0, backgroundThreadBase_1.serialize)({ fileUris, evenIfContentsAreSame }),
        });
    }
    startAnalysis(program, token) {
        this._startOrResumeAnalysis('analyze', program, token);
    }
    async analyzeFile(fileUri, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const { port1, port2 } = new worker_threads_1.MessageChannel();
        const waiter = (0, backgroundThreadBase_1.getBackgroundWaiter)(port1);
        const cancellationId = (0, cancellationUtils_1.getCancellationTokenId)(token);
        this.enqueueRequest({
            requestType: 'analyzeFile',
            data: (0, backgroundThreadBase_1.serialize)({ fileUri, cancellationId }),
            port: port2,
        });
        const result = await waiter;
        port2.close();
        port1.close();
        return result;
    }
    async getDiagnosticsForRange(fileUri, range, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const { port1, port2 } = new worker_threads_1.MessageChannel();
        const waiter = (0, backgroundThreadBase_1.getBackgroundWaiter)(port1);
        const cancellationId = (0, cancellationUtils_1.getCancellationTokenId)(token);
        this.enqueueRequest({
            requestType: 'getDiagnosticsForRange',
            data: (0, backgroundThreadBase_1.serialize)({ fileUri, range, cancellationId }),
            port: port2,
        });
        const result = await waiter;
        port2.close();
        port1.close();
        return convertDiagnostics(result);
    }
    async writeTypeStub(targetImportPath, targetIsSingleFile, stubPath, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const { port1, port2 } = new worker_threads_1.MessageChannel();
        const waiter = (0, backgroundThreadBase_1.getBackgroundWaiter)(port1);
        const cancellationId = (0, cancellationUtils_1.getCancellationTokenId)(token);
        this.enqueueRequest({
            requestType: 'writeTypeStub',
            data: (0, backgroundThreadBase_1.serialize)({
                targetImportPath,
                targetIsSingleFile,
                stubPath,
                cancellationId,
            }),
            port: port2,
        });
        await waiter;
        port2.close();
        port1.close();
    }
    invalidateAndForceReanalysis(reason) {
        this.enqueueRequest({ requestType: 'invalidateAndForceReanalysis', data: (0, backgroundThreadBase_1.serialize)({ reason }) });
    }
    restart() {
        this.enqueueRequest({ requestType: 'restart', data: null });
    }
    shutdown() {
        this.enqueueRequest({ requestType: 'shutdown', data: null });
    }
    setup(worker) {
        this._worker = worker;
        // global channel to communicate from BG channel to main thread.
        worker.on('message', (msg) => this.onMessage(msg));
        // this will catch any exception thrown from background thread,
        // print log and ignore exception
        worker.on('error', (msg) => {
            this.log(console_1.LogLevel.Error, `Error occurred on background thread: ${JSON.stringify(msg)}`);
        });
    }
    onMessage(msg) {
        switch (msg.requestType) {
            case 'log': {
                const logData = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.log(logData.level, logData.message);
                break;
            }
            case 'analysisResult': {
                // Change in diagnostics due to host such as file closed rather than
                // analyzing files.
                this._onAnalysisCompletion(convertAnalysisResults((0, backgroundThreadBase_1.deserialize)(msg.data)));
                break;
            }
            default:
                debug.fail(`${msg.requestType} is not expected. Message structure: ${JSON.stringify(msg)}`);
        }
    }
    enqueueRequest(request) {
        if (this._worker) {
            this._worker.postMessage(request, request.port ? [request.port] : undefined);
        }
    }
    log(level, msg) {
        (0, console_1.log)(this.console, level, msg);
    }
    handleAnalysisResponse(msg, program, port1, port2, token) {
        switch (msg.requestType) {
            case 'analysisResult': {
                this._onAnalysisCompletion(convertAnalysisResults((0, backgroundThreadBase_1.deserialize)(msg.data)));
                break;
            }
            case 'analysisPaused': {
                port2.close();
                port1.close();
                // Analysis request has completed, but there is more to
                // analyze, so queue another message to resume later.
                this._startOrResumeAnalysis('resumeAnalysis', program, token);
                break;
            }
            case 'analysisDone': {
                (0, fileBasedCancellationUtils_1.disposeCancellationToken)(token);
                port2.close();
                port1.close();
                break;
            }
            default:
                debug.fail(`${msg.requestType} is not expected. Message structure: ${JSON.stringify(msg)}`);
        }
    }
    _startOrResumeAnalysis(requestType, program, token) {
        const { port1, port2 } = new worker_threads_1.MessageChannel();
        // Handle response from background thread to main thread.
        port1.on('message', (msg) => this.handleAnalysisResponse(msg, program, port1, port2, token));
        const cancellationId = (0, cancellationUtils_1.getCancellationTokenId)(token);
        this.enqueueRequest({ requestType, data: (0, backgroundThreadBase_1.serialize)(cancellationId), port: port2 });
    }
}
exports.BackgroundAnalysisBase = BackgroundAnalysisBase;
class BackgroundAnalysisRunnerBase extends backgroundThreadBase_1.BackgroundThreadBase {
    constructor(serviceProvider) {
        super(worker_threads_1.workerData, serviceProvider);
        this.serviceProvider = serviceProvider;
        this.isCaseSensitive = true;
        // Stash the base directory into a global variable.
        const data = worker_threads_1.workerData;
        this.log(console_1.LogLevel.Info, `Background analysis(${worker_threads_1.threadId}) root directory: ${data.rootUri}`);
        this._configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.parse(data.rootUri, serviceProvider));
        this.importResolver = this.createImportResolver(serviceProvider, this._configOptions, this.createHost());
        const console = this.getConsole();
        this.logTracker = new logTracker_1.LogTracker(console, `BG(${worker_threads_1.threadId})`);
        this._program = new program_1.Program(this.importResolver, this._configOptions, serviceProvider, this.logTracker, undefined, data.serviceId);
    }
    get program() {
        return this._program;
    }
    start() {
        this.log(console_1.LogLevel.Info, `Background analysis(${worker_threads_1.threadId}) started`);
        // Get requests from main thread.
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.on('message', this._onMessageWrapper.bind(this));
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.on('error', (msg) => debug.fail(`failed ${msg}`));
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.on('exit', (c) => {
            if (c !== 0) {
                debug.fail(`worker stopped with exit code ${c}`);
            }
        });
    }
    onMessage(msg) {
        var _a;
        switch (msg.requestType) {
            case 'cacheUsageBuffer': {
                (_a = this.serviceProvider.cacheManager()) === null || _a === void 0 ? void 0 : _a.handleCachedUsageBufferMessage(msg);
                break;
            }
            case 'analyze': {
                const port = msg.port;
                const data = (0, backgroundThreadBase_1.deserialize)(msg.data);
                const token = (0, fileBasedCancellationUtils_1.getCancellationTokenFromId)(data);
                this.handleAnalyze(port, data, token);
                break;
            }
            case 'resumeAnalysis': {
                const port = msg.port;
                const data = (0, backgroundThreadBase_1.deserialize)(msg.data);
                const token = (0, fileBasedCancellationUtils_1.getCancellationTokenFromId)(data);
                this.handleResumeAnalysis(port, data, token);
                break;
            }
            case 'analyzeFile': {
                (0, backgroundThreadBase_1.run)(() => {
                    const { fileUri, cancellationId } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                    const token = (0, fileBasedCancellationUtils_1.getCancellationTokenFromId)(cancellationId);
                    return this.handleAnalyzeFile(fileUri, token);
                }, msg.port);
                break;
            }
            case 'getDiagnosticsForRange': {
                (0, backgroundThreadBase_1.run)(() => {
                    const { fileUri, range, cancellationId } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                    const token = (0, fileBasedCancellationUtils_1.getCancellationTokenFromId)(cancellationId);
                    return this.handleGetDiagnosticsForRange(fileUri, range, token);
                }, msg.port);
                break;
            }
            case 'writeTypeStub': {
                (0, backgroundThreadBase_1.run)(() => {
                    const { targetImportPath, targetIsSingleFile, stubPath, cancellationId } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                    const token = (0, fileBasedCancellationUtils_1.getCancellationTokenFromId)(cancellationId);
                    this.handleWriteTypeStub(targetImportPath, targetIsSingleFile, stubPath, token);
                }, msg.port);
                break;
            }
            case 'setImportResolver': {
                this.handleSetImportResolver((0, backgroundThreadBase_1.deserialize)(msg.data));
                break;
            }
            case 'setConfigOptions': {
                this.handleSetConfigOptions((0, backgroundThreadBase_1.deserialize)(msg.data));
                break;
            }
            case 'setTrackedFiles': {
                this.handleSetTrackedFiles((0, backgroundThreadBase_1.deserialize)(msg.data));
                break;
            }
            case 'setAllowedThirdPartyImports': {
                this.handleSetAllowedThirdPartyImports((0, backgroundThreadBase_1.deserialize)(msg.data));
                break;
            }
            case 'ensurePartialStubPackages': {
                const { executionRoot } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleEnsurePartialStubPackages(executionRoot);
                break;
            }
            case 'setFileOpened': {
                const { fileUri, version, contents, options } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleSetFileOpened(fileUri, version, contents, options);
                break;
            }
            case 'updateChainedFileUri': {
                const { fileUri, chainedUri } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleUpdateChainedFileUri(fileUri, chainedUri);
                break;
            }
            case 'setFileClosed': {
                const { fileUri, isTracked } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleSetFileClosed(fileUri, isTracked);
                break;
            }
            case 'addInterimFile': {
                const { fileUri } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleAddInterimFile(fileUri);
                break;
            }
            case 'markAllFilesDirty': {
                const { evenIfContentsAreSame } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleMarkAllFilesDirty(evenIfContentsAreSame);
                break;
            }
            case 'markFilesDirty': {
                const { fileUris, evenIfContentsAreSame } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleMarkFilesDirty(fileUris, evenIfContentsAreSame);
                break;
            }
            case 'invalidateAndForceReanalysis': {
                const { reason } = (0, backgroundThreadBase_1.deserialize)(msg.data);
                this.handleInvalidateAndForceReanalysis(reason);
                break;
            }
            case 'restart': {
                // recycle import resolver
                this.handleRestart();
                break;
            }
            case 'shutdown': {
                this.handleShutdown();
                break;
            }
            default: {
                debug.fail(`${msg.requestType} is not expected. Message structure: ${JSON.stringify(msg)}`);
            }
        }
    }
    handleAnalyze(port, cancellationId, token) {
        // Report files to analyze first.
        const requiringAnalysisCount = this.program.getFilesToAnalyzeCount();
        this.onAnalysisCompletion(port, {
            diagnostics: [],
            filesInProgram: this.program.getFileCount(),
            requiringAnalysisCount: requiringAnalysisCount,
            checkingOnlyOpenFiles: this.program.isCheckingOnlyOpenFiles(),
            fatalErrorOccurred: false,
            configParseErrorOccurred: false,
            elapsedTime: 0,
        });
        this.handleResumeAnalysis(port, cancellationId, token);
    }
    handleResumeAnalysis(port, cancellationId, token) {
        // Report results at the interval of the max analysis time.
        const maxTime = { openFilesTimeInMs: 50, noOpenFilesTimeInMs: 200 };
        const moreToAnalyze = (0, analysis_1.analyzeProgram)(this.program, maxTime, this._configOptions, (result) => this.onAnalysisCompletion(port, result), this.getConsole(), token);
        if (moreToAnalyze) {
            // There's more to analyze after we exceeded max time,
            // so report that we are paused. The foreground thread will
            // then queue up a message to resume the analysis.
            this._analysisPaused(port, cancellationId);
        }
        else {
            this.analysisDone(port, cancellationId);
        }
    }
    handleAnalyzeFile(fileUri, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        return this.program.analyzeFile(fileUri, token);
    }
    handleGetDiagnosticsForRange(fileUri, range, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        return this.program.getDiagnosticsForRange(fileUri, range);
    }
    handleWriteTypeStub(targetImportPath, targetIsSingleFile, stubPath, token) {
        (0, analysis_1.analyzeProgram)(this.program, 
        /* maxTime */ undefined, this._configOptions, analysis_1.nullCallback, this.getConsole(), token);
        this.program.writeTypeStub(targetImportPath, targetIsSingleFile, stubPath, token);
    }
    handleSetImportResolver(hostKind) {
        this.importResolver = this.createImportResolver(this.getServiceProvider(), this._configOptions, this.createHost());
        this.program.setImportResolver(this.importResolver);
    }
    handleSetConfigOptions(configOptions) {
        this._configOptions = configOptions;
        this.importResolver = this.createImportResolver(this.getServiceProvider(), this._configOptions, this.importResolver.host);
        this.program.setConfigOptions(this._configOptions);
        this.program.setImportResolver(this.importResolver);
    }
    handleSetTrackedFiles(fileUris) {
        const diagnostics = this.program.setTrackedFiles(fileUris);
        this._reportDiagnostics(diagnostics, this.program.getFilesToAnalyzeCount(), 0);
    }
    handleSetAllowedThirdPartyImports(importNames) {
        this.program.setAllowedThirdPartyImports(importNames);
    }
    handleEnsurePartialStubPackages(executionRoot) {
        const execEnv = this._configOptions
            .getExecutionEnvironments()
            .find((e) => { var _a; return ((_a = e.root) === null || _a === void 0 ? void 0 : _a.toString()) === executionRoot; });
        if (execEnv) {
            this.importResolver.ensurePartialStubPackages(execEnv);
        }
    }
    handleSetFileOpened(fileUri, version, contents, options) {
        this.program.setFileOpened(fileUri, version, contents, options
            ? {
                ...options,
                chainedFileUri: uri_1.Uri.fromJsonObj(options === null || options === void 0 ? void 0 : options.chainedFileUri),
            }
            : undefined);
    }
    handleUpdateChainedFileUri(fileUri, chainedFileUri) {
        this.program.updateChainedUri(fileUri, chainedFileUri);
    }
    handleSetFileClosed(fileUri, isTracked) {
        const diagnostics = this.program.setFileClosed(fileUri, isTracked);
        this._reportDiagnostics(diagnostics, this.program.getFilesToAnalyzeCount(), 0);
    }
    handleAddInterimFile(fileUri) {
        this.program.addInterimFile(fileUri);
    }
    handleMarkFilesDirty(fileUris, evenIfContentsAreSame) {
        this.program.markFilesDirty(fileUris, evenIfContentsAreSame);
    }
    handleMarkAllFilesDirty(evenIfContentsAreSame) {
        this.program.markAllFilesDirty(evenIfContentsAreSame);
    }
    handleInvalidateAndForceReanalysis(reason) {
        // Make sure the import resolver doesn't have invalid
        // cached entries.
        this.importResolver.invalidateCache();
        // Mark all files with one or more errors dirty.
        this.program.markAllFilesDirty(/* evenIfContentsAreSame */ true);
    }
    handleRestart() {
        this.importResolver = this.createImportResolver(this.getServiceProvider(), this._configOptions, this.importResolver.host);
        this.program.setImportResolver(this.importResolver);
    }
    handleShutdown() {
        this._program.dispose();
        super.handleShutdown();
    }
    analysisDone(port, cancellationId) {
        port.postMessage({ requestType: 'analysisDone', data: cancellationId });
    }
    onAnalysisCompletion(port, result) {
        // Result URIs can't be sent in current form as they contain methods on
        // them. This causes a DataCloneError when posting.
        // See https://stackoverflow.com/questions/68467946/datacloneerror-the-object-could-not-be-cloned-firefox-browser
        // We turn them back into JSON so we can use Uri.fromJsonObj on the other side.
        port.postMessage({ requestType: 'analysisResult', data: (0, backgroundThreadBase_1.serialize)(result) });
    }
    _onMessageWrapper(msg) {
        try {
            return this.onMessage(msg);
        }
        catch (e) {
            // Don't crash the worker, just send an exception or cancel message
            this.log(console_1.LogLevel.Log, `Background analysis exception leak: ${e}`);
            if (cancellationUtils_1.OperationCanceledException.is(e)) {
                worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ kind: 'cancelled', data: e.message });
                return;
            }
            worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({
                kind: 'failed',
                data: `Exception: for msg ${msg.requestType}: ${e.message} in ${e.stack}`,
            });
        }
    }
    _reportDiagnostics(diagnostics, requiringAnalysisCount, elapsedTime) {
        if (worker_threads_1.parentPort) {
            this.onAnalysisCompletion(worker_threads_1.parentPort, {
                diagnostics,
                filesInProgram: this.program.getFileCount(),
                requiringAnalysisCount: requiringAnalysisCount,
                checkingOnlyOpenFiles: this.program.isCheckingOnlyOpenFiles(),
                fatalErrorOccurred: false,
                configParseErrorOccurred: false,
                elapsedTime,
            });
        }
    }
    _analysisPaused(port, cancellationId) {
        port.postMessage({ requestType: 'analysisPaused', data: cancellationId });
    }
}
exports.BackgroundAnalysisRunnerBase = BackgroundAnalysisRunnerBase;
function convertAnalysisResults(result) {
    result.diagnostics = result.diagnostics.map((f) => {
        return {
            fileUri: uri_1.Uri.fromJsonObj(f.fileUri),
            version: f.version,
            diagnostics: convertDiagnostics(f.diagnostics),
        };
    });
    return result;
}
function convertDiagnostics(diagnostics) {
    // Elements are typed as "any" since data crossing the process
    // boundary loses type info.
    return diagnostics.map((d) => {
        const diag = new diagnostic_1.Diagnostic(d.category, d.message, d.range, d.priority);
        if (d._actions) {
            for (const action of d._actions) {
                diag.addAction(action);
            }
        }
        if (d._rule) {
            diag.setRule(d._rule);
        }
        if (d._relatedInfo) {
            for (const info of d._relatedInfo) {
                diag.addRelatedInfo(info.message, info.uri, info.range);
            }
        }
        return diag;
    });
}
//# sourceMappingURL=backgroundAnalysisBase.js.map