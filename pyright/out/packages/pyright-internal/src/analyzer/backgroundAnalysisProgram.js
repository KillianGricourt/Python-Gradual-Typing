"use strict";
/*
 * BackgroundAnalysisProgram.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Applies operations to both the foreground program and a background
 * analysis running in a worker process.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundAnalysisProgram = exports.InvalidatedReason = void 0;
require("../common/serviceProviderExtensions");
const analysis_1 = require("./analysis");
const program_1 = require("./program");
var InvalidatedReason;
(function (InvalidatedReason) {
    InvalidatedReason[InvalidatedReason["Reanalyzed"] = 0] = "Reanalyzed";
    InvalidatedReason[InvalidatedReason["SourceWatcherChanged"] = 1] = "SourceWatcherChanged";
    InvalidatedReason[InvalidatedReason["LibraryWatcherChanged"] = 2] = "LibraryWatcherChanged";
    InvalidatedReason[InvalidatedReason["LibraryWatcherContentOnlyChanged"] = 3] = "LibraryWatcherContentOnlyChanged";
})(InvalidatedReason || (exports.InvalidatedReason = InvalidatedReason = {}));
class BackgroundAnalysisProgram {
    constructor(serviceId, _serviceProvider, _configOptions, _importResolver, _backgroundAnalysis, _maxAnalysisTime, _disableChecker) {
        this.serviceId = serviceId;
        this._serviceProvider = _serviceProvider;
        this._configOptions = _configOptions;
        this._importResolver = _importResolver;
        this._backgroundAnalysis = _backgroundAnalysis;
        this._maxAnalysisTime = _maxAnalysisTime;
        this._disableChecker = _disableChecker;
        this._disposed = false;
        this._program = new program_1.Program(this.importResolver, this.configOptions, this._serviceProvider, undefined, this._disableChecker, serviceId);
    }
    get configOptions() {
        return this._configOptions;
    }
    get importResolver() {
        return this._importResolver;
    }
    get program() {
        return this._program;
    }
    get host() {
        return this._importResolver.host;
    }
    get backgroundAnalysis() {
        return this._backgroundAnalysis;
    }
    hasSourceFile(fileUri) {
        return !!this._program.getSourceFile(fileUri);
    }
    setConfigOptions(configOptions) {
        var _a;
        this._configOptions = configOptions;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setConfigOptions(configOptions);
        this._program.setConfigOptions(configOptions);
    }
    setImportResolver(importResolver) {
        var _a;
        this._importResolver = importResolver;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setImportResolver(importResolver);
        this._program.setImportResolver(importResolver);
        this.configOptions.getExecutionEnvironments().forEach((e) => this._ensurePartialStubPackages(e));
    }
    setTrackedFiles(fileUris) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setTrackedFiles(fileUris);
        const diagnostics = this._program.setTrackedFiles(fileUris);
        this._reportDiagnosticsForRemovedFiles(diagnostics);
    }
    setAllowedThirdPartyImports(importNames) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setAllowedThirdPartyImports(importNames);
        this._program.setAllowedThirdPartyImports(importNames);
    }
    setFileOpened(fileUri, version, contents, options) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setFileOpened(fileUri, version, contents, options);
        this._program.setFileOpened(fileUri, version, contents, options);
    }
    getChainedUri(fileUri) {
        return this._program.getChainedUri(fileUri);
    }
    updateChainedUri(fileUri, chainedUri) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.updateChainedUri(fileUri, chainedUri);
        this._program.updateChainedUri(fileUri, chainedUri);
    }
    updateOpenFileContents(uri, version, contents, options) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setFileOpened(uri, version, contents, options);
        this._program.setFileOpened(uri, version, contents, options);
        this.markFilesDirty([uri], /* evenIfContentsAreSame */ true);
    }
    setFileClosed(fileUri, isTracked) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setFileClosed(fileUri, isTracked);
        const diagnostics = this._program.setFileClosed(fileUri, isTracked);
        this._reportDiagnosticsForRemovedFiles(diagnostics);
    }
    addInterimFile(fileUri) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.addInterimFile(fileUri);
        this._program.addInterimFile(fileUri);
    }
    markAllFilesDirty(evenIfContentsAreSame) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.markAllFilesDirty(evenIfContentsAreSame);
        this._program.markAllFilesDirty(evenIfContentsAreSame);
    }
    markFilesDirty(fileUris, evenIfContentsAreSame) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.markFilesDirty(fileUris, evenIfContentsAreSame);
        this._program.markFilesDirty(fileUris, evenIfContentsAreSame);
    }
    setCompletionCallback(callback) {
        var _a;
        this._onAnalysisCompletion = callback;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.setCompletionCallback(callback);
    }
    startAnalysis(token) {
        if (this._backgroundAnalysis) {
            this._backgroundAnalysis.startAnalysis(this, token);
            return false;
        }
        return (0, analysis_1.analyzeProgram)(this._program, this._maxAnalysisTime, this._configOptions, this._onAnalysisCompletion, this._serviceProvider.console(), token);
    }
    async analyzeFile(fileUri, token) {
        if (this._backgroundAnalysis) {
            return this._backgroundAnalysis.analyzeFile(fileUri, token);
        }
        return this._program.analyzeFile(fileUri, token);
    }
    libraryUpdated() {
        return false;
    }
    async getDiagnosticsForRange(fileUri, range, token) {
        if (this._backgroundAnalysis) {
            return this._backgroundAnalysis.getDiagnosticsForRange(fileUri, range, token);
        }
        return this._program.getDiagnosticsForRange(fileUri, range);
    }
    async writeTypeStub(targetImportUri, targetIsSingleFile, stubUri, token) {
        if (this._backgroundAnalysis) {
            return this._backgroundAnalysis.writeTypeStub(targetImportUri, targetIsSingleFile, stubUri, token);
        }
        (0, analysis_1.analyzeProgram)(this._program, 
        /* maxTime */ undefined, this._configOptions, this._onAnalysisCompletion, this._serviceProvider.console(), token);
        return this._program.writeTypeStub(targetImportUri, targetIsSingleFile, stubUri, token);
    }
    invalidateAndForceReanalysis(reason) {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.invalidateAndForceReanalysis(reason);
        // Make sure the import resolver doesn't have invalid
        // cached entries.
        this._importResolver.invalidateCache();
        // Mark all files with one or more errors dirty.
        this._program.markAllFilesDirty(/* evenIfContentsAreSame */ true);
    }
    restart() {
        var _a;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.restart();
    }
    dispose() {
        var _a;
        if (this._disposed) {
            return;
        }
        this._disposed = true;
        this._program.dispose();
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.shutdown();
    }
    enterEditMode() {
        // Turn off analysis while in edit mode.
        this._preEditAnalysis = this._backgroundAnalysis;
        this._backgroundAnalysis = undefined;
        // Forward this request to the program.
        this._program.enterEditMode();
    }
    exitEditMode() {
        this._backgroundAnalysis = this._preEditAnalysis;
        this._preEditAnalysis = undefined;
        return this._program.exitEditMode();
    }
    _ensurePartialStubPackages(execEnv) {
        var _a, _b;
        (_a = this._backgroundAnalysis) === null || _a === void 0 ? void 0 : _a.ensurePartialStubPackages((_b = execEnv.root) === null || _b === void 0 ? void 0 : _b.toString());
        return this._importResolver.ensurePartialStubPackages(execEnv);
    }
    _reportDiagnosticsForRemovedFiles(fileDiags) {
        if (fileDiags.length === 0) {
            return;
        }
        // If analysis is running in the foreground process, report any
        // diagnostics that resulted from the close operation (used to
        // clear diagnostics that are no longer of interest).
        if (!this._backgroundAnalysis && this._onAnalysisCompletion) {
            this._onAnalysisCompletion({
                diagnostics: fileDiags,
                filesInProgram: this._program.getFileCount(),
                requiringAnalysisCount: this._program.getFilesToAnalyzeCount(),
                checkingOnlyOpenFiles: this._program.isCheckingOnlyOpenFiles(),
                fatalErrorOccurred: false,
                configParseErrorOccurred: false,
                elapsedTime: 0,
            });
        }
    }
}
exports.BackgroundAnalysisProgram = BackgroundAnalysisProgram;
//# sourceMappingURL=backgroundAnalysisProgram.js.map