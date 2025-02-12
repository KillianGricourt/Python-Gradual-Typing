"use strict";
/*
 * service.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A service that is able to analyze a collection of
 * Python files.
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
exports.AnalyzerService = exports.getNextServiceId = exports.pyprojectTomlName = exports.configFileName = void 0;
const TOML = __importStar(require("@iarna/toml"));
const JSONC = __importStar(require("jsonc-parser"));
const cancellationUtils_1 = require("../common/cancellationUtils");
const configOptions_1 = require("../common/configOptions");
const console_1 = require("../common/console");
const core_1 = require("../common/core");
const fileWatcher_1 = require("../common/fileWatcher");
const host_1 = require("../common/host");
const pathConsts_1 = require("../common/pathConsts");
const pathUtils_1 = require("../common/pathUtils");
const serviceKeys_1 = require("../common/serviceKeys");
const timing_1 = require("../common/timing");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const backgroundAnalysisProgram_1 = require("./backgroundAnalysisProgram");
const importResolver_1 = require("./importResolver");
const pythonPathUtils_1 = require("./pythonPathUtils");
const sourceFile_1 = require("./sourceFile");
exports.configFileName = 'pyrightconfig.json';
exports.pyprojectTomlName = 'pyproject.toml';
// How long since the last user activity should we wait until running
// the analyzer on any files that have not yet been analyzed?
const _userActivityBackoffTimeInMs = 250;
const _gitDirectory = (0, pathUtils_1.normalizeSlashes)('/.git/');
// Hold uniqueId for this service. It can be used to distinguish each service later.
let _nextServiceId = 1;
function getNextServiceId(name) {
    return `${name}_${_nextServiceId++}`;
}
exports.getNextServiceId = getNextServiceId;
class AnalyzerService {
    constructor(instanceName, serviceProvider, options) {
        var _a, _b, _c, _d, _e;
        this._typeStubTargetIsSingleFile = false;
        this._extendedConfigFileUris = [];
        this._requireTrackedFileUpdate = true;
        this._lastUserInteractionTime = Date.now();
        this._disposed = false;
        this._pendingLibraryChanges = { changesOnly: true };
        this._instanceName = instanceName;
        this._executionRootUri = uri_1.Uri.empty();
        this._options = options;
        this._options.serviceId = (_a = this._options.serviceId) !== null && _a !== void 0 ? _a : getNextServiceId(instanceName);
        this._options.console = options.console || new console_1.StandardConsole();
        // Create local copy of the given service provider.
        this._serviceProvider = serviceProvider.clone();
        // Override the console and the file system if they were explicitly provided.
        if (this._options.console) {
            this._serviceProvider.add(serviceKeys_1.ServiceKeys.console, this._options.console);
        }
        if (this._options.fileSystem) {
            this._serviceProvider.add(serviceKeys_1.ServiceKeys.fs, this._options.fileSystem);
        }
        this._options.importResolverFactory = (_b = options.importResolverFactory) !== null && _b !== void 0 ? _b : AnalyzerService.createImportResolver;
        this._options.cancellationProvider = (_c = options.cancellationProvider) !== null && _c !== void 0 ? _c : new cancellationUtils_1.DefaultCancellationProvider();
        this._options.hostFactory = (_d = options.hostFactory) !== null && _d !== void 0 ? _d : (() => new host_1.NoAccessHost());
        this._options.configOptions =
            (_e = options.configOptions) !== null && _e !== void 0 ? _e : new configOptions_1.ConfigOptions(uri_1.Uri.file(process.cwd(), this._serviceProvider));
        const importResolver = this._options.importResolverFactory(this._serviceProvider, this._options.configOptions, this._options.hostFactory());
        this._backgroundAnalysisProgram =
            this._options.backgroundAnalysisProgramFactory !== undefined
                ? this._options.backgroundAnalysisProgramFactory(this._options.serviceId, this._serviceProvider, this._options.configOptions, importResolver, this._options.backgroundAnalysis, this._options.maxAnalysisTime)
                : new backgroundAnalysisProgram_1.BackgroundAnalysisProgram(this._options.serviceId, this._serviceProvider, this._options.configOptions, importResolver, this._options.backgroundAnalysis, this._options.maxAnalysisTime, 
                /* disableChecker */ undefined);
    }
    get fs() {
        return this._backgroundAnalysisProgram.importResolver.fileSystem;
    }
    get serviceProvider() {
        return this._serviceProvider;
    }
    get cancellationProvider() {
        return this._options.cancellationProvider;
    }
    get librarySearchUrisToWatch() {
        return this._librarySearchUrisToWatch;
    }
    get backgroundAnalysisProgram() {
        return this._backgroundAnalysisProgram;
    }
    get test_program() {
        return this._program;
    }
    get id() {
        return this._options.serviceId;
    }
    clone(instanceName, serviceId, backgroundAnalysis, fileSystem) {
        var _a;
        const service = new AnalyzerService(instanceName, this._serviceProvider, {
            ...this._options,
            serviceId,
            backgroundAnalysis,
            skipScanningUserFiles: true,
            fileSystem,
        });
        // Cloned service will use whatever user files the service currently has.
        const userFiles = this.getUserFiles();
        service.backgroundAnalysisProgram.setTrackedFiles(userFiles);
        service.backgroundAnalysisProgram.markAllFilesDirty(true);
        // Make sure we keep editor content (open file) which could be different than one in the file system.
        for (const fileInfo of this.backgroundAnalysisProgram.program.getOpened()) {
            const version = fileInfo.sourceFile.getClientVersion();
            if (version !== undefined) {
                service.setFileOpened(fileInfo.sourceFile.getUri(), version, fileInfo.sourceFile.getOpenFileContents(), fileInfo.sourceFile.getIPythonMode(), (_a = fileInfo.chainedSourceFile) === null || _a === void 0 ? void 0 : _a.sourceFile.getUri());
            }
        }
        return service;
    }
    runEditMode(callback, token) {
        let edits = [];
        this._backgroundAnalysisProgram.enterEditMode();
        try {
            this._program.runEditMode(callback, token);
        }
        finally {
            edits = this._backgroundAnalysisProgram.exitEditMode();
        }
        return token.isCancellationRequested ? [] : edits;
    }
    dispose() {
        if (!this._disposed) {
            // Make sure we dispose program, otherwise, entire program
            // will leak.
            this._backgroundAnalysisProgram.dispose();
        }
        this._disposed = true;
        this._removeSourceFileWatchers();
        this._removeConfigFileWatcher();
        this._removeLibraryFileWatcher();
        this._clearReloadConfigTimer();
        this._clearReanalysisTimer();
        this._clearLibraryReanalysisTimer();
    }
    static createImportResolver(serviceProvider, options, host) {
        return new importResolver_1.ImportResolver(serviceProvider, options, host);
    }
    setCompletionCallback(callback) {
        this._onCompletionCallback = callback;
        this._backgroundAnalysisProgram.setCompletionCallback(callback);
    }
    setOptions(commandLineOptions) {
        this._commandLineOptions = commandLineOptions;
        const host = this._hostFactory();
        const configOptions = this._getConfigOptions(host, commandLineOptions);
        if (configOptions.pythonPath) {
            // Make sure we have default python environment set.
            configOptions.ensureDefaultPythonVersion(host, this._console);
        }
        configOptions.ensureDefaultPythonPlatform(host, this._console);
        this._backgroundAnalysisProgram.setConfigOptions(configOptions);
        this._executionRootUri = configOptions.projectRoot;
        this._applyConfigOptions(host);
    }
    hasSourceFile(uri) {
        return this.backgroundAnalysisProgram.hasSourceFile(uri);
    }
    isTracked(uri) {
        return this._program.owns(uri);
    }
    getUserFiles() {
        return this._program.getUserFiles().map((i) => i.sourceFile.getUri());
    }
    getOpenFiles() {
        return this._program.getOpened().map((i) => i.sourceFile.getUri());
    }
    setFileOpened(uri, version, contents, ipythonMode = sourceFile_1.IPythonMode.None, chainedFileUri) {
        // Open the file. Notebook cells are always tracked as they aren't 3rd party library files.
        // This is how it's worked in the past since each notebook used to have its own
        // workspace and the workspace include setting marked all cells as tracked.
        this._backgroundAnalysisProgram.setFileOpened(uri, version, contents, {
            isTracked: this.isTracked(uri) || ipythonMode !== sourceFile_1.IPythonMode.None,
            ipythonMode,
            chainedFileUri: chainedFileUri,
        });
        this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
    }
    getChainedUri(uri) {
        return this._backgroundAnalysisProgram.getChainedUri(uri);
    }
    updateChainedUri(uri, chainedFileUri) {
        this._backgroundAnalysisProgram.updateChainedUri(uri, chainedFileUri);
        this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
    }
    updateOpenFileContents(uri, version, contents, ipythonMode = sourceFile_1.IPythonMode.None) {
        this._backgroundAnalysisProgram.updateOpenFileContents(uri, version, contents, {
            isTracked: this.isTracked(uri),
            ipythonMode,
            chainedFileUri: undefined,
        });
        this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
    }
    setFileClosed(uri, isTracked) {
        this._backgroundAnalysisProgram.setFileClosed(uri, isTracked);
        this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
    }
    addInterimFile(uri) {
        this._backgroundAnalysisProgram.addInterimFile(uri);
    }
    getParserOutput(uri) {
        return this._program.getParserOutput(uri);
    }
    getParseResults(uri) {
        return this._program.getParseResults(uri);
    }
    getSourceFile(uri) {
        return this._program.getBoundSourceFile(uri);
    }
    getTextOnRange(fileUri, range, token) {
        return this._program.getTextOnRange(fileUri, range, token);
    }
    run(callback, token) {
        return this._program.run(callback, token);
    }
    printStats() {
        this._console.info('');
        this._console.info('Analysis stats');
        const boundFileCount = this._program.getFileCount(/* userFileOnly */ false);
        this._console.info('Total files parsed and bound: ' + boundFileCount.toString());
        const checkedFileCount = this._program.getUserFileCount();
        this._console.info('Total files checked: ' + checkedFileCount.toString());
    }
    printDetailedAnalysisTimes() {
        this._program.printDetailedAnalysisTimes();
    }
    printDependencies(verbose) {
        this._program.printDependencies(this._executionRootUri, verbose);
    }
    analyzeFile(fileUri, token) {
        return this._backgroundAnalysisProgram.analyzeFile(fileUri, token);
    }
    getDiagnosticsForRange(fileUri, range, token) {
        return this._backgroundAnalysisProgram.getDiagnosticsForRange(fileUri, range, token);
    }
    getConfigOptions() {
        return this._configOptions;
    }
    getImportResolver() {
        return this._backgroundAnalysisProgram.importResolver;
    }
    recordUserInteractionTime() {
        this._lastUserInteractionTime = Date.now();
        // If we have a pending timer for reanalysis, cancel it
        // and reschedule for some time in the future.
        if (this._analyzeTimer) {
            this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
        }
    }
    test_getConfigOptions(commandLineOptions) {
        return this._getConfigOptions(this._backgroundAnalysisProgram.host, commandLineOptions);
    }
    test_getFileNamesFromFileSpecs() {
        return this._getFileNamesFromFileSpecs();
    }
    test_shouldHandleSourceFileWatchChanges(uri, isFile) {
        return this._shouldHandleSourceFileWatchChanges(uri, isFile);
    }
    test_shouldHandleLibraryFileWatchChanges(uri, libSearchUris) {
        return this._shouldHandleLibraryFileWatchChanges(uri, libSearchUris);
    }
    writeTypeStub(token) {
        var _a;
        const typingsSubdirUri = this._getTypeStubFolder();
        this._program.writeTypeStub((_a = this._typeStubTargetUri) !== null && _a !== void 0 ? _a : uri_1.Uri.empty(), this._typeStubTargetIsSingleFile, typingsSubdirUri, token);
    }
    writeTypeStubInBackground(token) {
        var _a;
        const typingsSubdirUri = this._getTypeStubFolder();
        return this._backgroundAnalysisProgram.writeTypeStub((_a = this._typeStubTargetUri) !== null && _a !== void 0 ? _a : uri_1.Uri.empty(), this._typeStubTargetIsSingleFile, typingsSubdirUri, token);
    }
    invalidateAndForceReanalysis(reason) {
        this._backgroundAnalysisProgram.invalidateAndForceReanalysis(reason);
    }
    // Forces the service to stop all analysis, discard all its caches,
    // and research for files.
    restart() {
        this._applyConfigOptions(this._hostFactory());
        this._backgroundAnalysisProgram.restart();
    }
    get _console() {
        return this._options.console;
    }
    get _hostFactory() {
        return this._options.hostFactory;
    }
    get _importResolverFactory() {
        return this._options.importResolverFactory;
    }
    get _program() {
        return this._backgroundAnalysisProgram.program;
    }
    get _configOptions() {
        return this._backgroundAnalysisProgram.configOptions;
    }
    get _watchForSourceChanges() {
        var _a;
        return !!((_a = this._commandLineOptions) === null || _a === void 0 ? void 0 : _a.watchForSourceChanges);
    }
    get _watchForLibraryChanges() {
        var _a;
        return !!((_a = this._commandLineOptions) === null || _a === void 0 ? void 0 : _a.watchForLibraryChanges) && !!this._options.libraryReanalysisTimeProvider;
    }
    get _watchForConfigChanges() {
        var _a;
        return !!((_a = this._commandLineOptions) === null || _a === void 0 ? void 0 : _a.watchForConfigChanges);
    }
    get _typeCheckingMode() {
        var _a;
        return (_a = this._commandLineOptions) === null || _a === void 0 ? void 0 : _a.typeCheckingMode;
    }
    get _verboseOutput() {
        return !!this._configOptions.verboseOutput;
    }
    get _typeStubTargetImportName() {
        var _a;
        return (_a = this._commandLineOptions) === null || _a === void 0 ? void 0 : _a.typeStubTargetImportName;
    }
    // Calculates the effective options based on the command-line options,
    // an optional config file, and default values.
    _getConfigOptions(host, commandLineOptions) {
        var _a, _b, _c, _d;
        const optionRoot = commandLineOptions.executionRoot;
        const executionRootUri = uri_1.Uri.is(optionRoot)
            ? optionRoot
            : (0, core_1.isString)(optionRoot) && optionRoot.length > 0
                ? uri_1.Uri.file(optionRoot, this.serviceProvider, /* checkRelative */ true)
                : uri_1.Uri.defaultWorkspace(this.serviceProvider);
        const executionRoot = this.fs.realCasePath(executionRootUri);
        let projectRoot = executionRoot;
        let configFilePath;
        let pyprojectFilePath;
        if (commandLineOptions.configFilePath) {
            // If the config file path was specified, determine whether it's
            // a directory (in which case the default config file name is assumed)
            // or a file.
            configFilePath = this.fs.realCasePath((0, pathUtils_1.isRootedDiskPath)(commandLineOptions.configFilePath)
                ? uri_1.Uri.file(commandLineOptions.configFilePath, this.serviceProvider, /* checkRelative */ true)
                : projectRoot.resolvePaths(commandLineOptions.configFilePath));
            if (!this.fs.existsSync(configFilePath)) {
                this._console.info(`Configuration file not found at ${configFilePath.toUserVisibleString()}.`);
                configFilePath = projectRoot;
            }
            else {
                if (configFilePath.lastExtension.endsWith('.json') || configFilePath.lastExtension.endsWith('.toml')) {
                    projectRoot = configFilePath.getDirectory();
                }
                else {
                    projectRoot = configFilePath;
                    configFilePath = this._findConfigFile(configFilePath);
                    if (!configFilePath) {
                        this._console.info(`Configuration file not found at ${projectRoot.toUserVisibleString()}.`);
                    }
                }
            }
        }
        else if (commandLineOptions.executionRoot) {
            // In a project-based IDE like VS Code, we should assume that the
            // project root directory contains the config file.
            configFilePath = this._findConfigFile(projectRoot);
            // If pyright is being executed from the command line, the working
            // directory may be deep within a project, and we need to walk up the
            // directory hierarchy to find the project root.
            if (!configFilePath && !commandLineOptions.fromVsCodeExtension) {
                configFilePath = this._findConfigFileHereOrUp(projectRoot);
            }
            if (configFilePath) {
                projectRoot = configFilePath.getDirectory();
            }
            else {
                this._console.log(`No configuration file found.`);
                configFilePath = undefined;
            }
        }
        if (!configFilePath) {
            // See if we can find a pyproject.toml file in this directory.
            pyprojectFilePath = this._findPyprojectTomlFile(projectRoot);
            if (!pyprojectFilePath && !commandLineOptions.fromVsCodeExtension) {
                pyprojectFilePath = this._findPyprojectTomlFileHereOrUp(projectRoot);
            }
            if (pyprojectFilePath) {
                projectRoot = pyprojectFilePath.getDirectory();
                this._console.log(`pyproject.toml file found at ${projectRoot.toUserVisibleString()}.`);
            }
            else {
                this._console.log(`No pyproject.toml file found.`);
            }
        }
        const configOptions = new configOptions_1.ConfigOptions(projectRoot);
        configOptions.initializeTypeCheckingMode(this._typeCheckingMode, commandLineOptions.diagnosticSeverityOverrides);
        const defaultExcludes = ['**/node_modules', '**/__pycache__', '**/.*'];
        if (commandLineOptions.pythonPath) {
            this._console.info(`Setting pythonPath for service "${this._instanceName}": ` + `"${commandLineOptions.pythonPath}"`);
            configOptions.pythonPath = this.fs.realCasePath(uri_1.Uri.file(commandLineOptions.pythonPath, this.serviceProvider, /* checkRelative */ true));
        }
        if (commandLineOptions.pythonEnvironmentName) {
            this._console.info(`Setting environmentName for service "${this._instanceName}": ` +
                `"${commandLineOptions.pythonEnvironmentName}"`);
            configOptions.pythonEnvironmentName = commandLineOptions.pythonEnvironmentName;
        }
        // The pythonPlatform and pythonVersion from the command-line can be overridden
        // by the config file, so initialize them upfront.
        configOptions.defaultPythonPlatform = commandLineOptions.pythonPlatform;
        configOptions.defaultPythonVersion = commandLineOptions.pythonVersion;
        configOptions.ensureDefaultExtraPaths(this.fs, (_a = commandLineOptions.autoSearchPaths) !== null && _a !== void 0 ? _a : false, commandLineOptions.extraPaths);
        commandLineOptions.includeFileSpecs.forEach((fileSpec) => {
            configOptions.include.push((0, uriUtils_1.getFileSpec)(projectRoot, fileSpec));
        });
        commandLineOptions.excludeFileSpecs.forEach((fileSpec) => {
            configOptions.exclude.push((0, uriUtils_1.getFileSpec)(projectRoot, fileSpec));
        });
        commandLineOptions.ignoreFileSpecs.forEach((fileSpec) => {
            configOptions.ignore.push((0, uriUtils_1.getFileSpec)(projectRoot, fileSpec));
        });
        configOptions.disableTaggedHints = !!commandLineOptions.disableTaggedHints;
        configOptions.initializeTypeCheckingMode((_b = commandLineOptions.typeCheckingMode) !== null && _b !== void 0 ? _b : 'standard');
        const configs = this._getExtendedConfigurations(configFilePath !== null && configFilePath !== void 0 ? configFilePath : pyprojectFilePath);
        if (configs && configs.length > 0) {
            for (const config of configs) {
                configOptions.initializeFromJson(config.configFileJsonObj, config.configFileDirUri, this.serviceProvider, host, commandLineOptions);
            }
        }
        else {
            configOptions.applyDiagnosticOverrides(commandLineOptions.diagnosticSeverityOverrides);
        }
        // If no include paths were provided, assume that all files within
        // the project should be included.
        if (configOptions.include.length === 0) {
            this._console.info(`No include entries specified; assuming ${projectRoot.toUserVisibleString()}`);
            configOptions.include.push((0, uriUtils_1.getFileSpec)(projectRoot, '.'));
        }
        // If there was no explicit set of excludes, add a few common ones to
        // avoid long scan times.
        if (configOptions.exclude.length === 0) {
            defaultExcludes.forEach((exclude) => {
                this._console.info(`Auto-excluding ${exclude}`);
                configOptions.exclude.push((0, uriUtils_1.getFileSpec)(projectRoot, exclude));
            });
            if (configOptions.autoExcludeVenv === undefined) {
                configOptions.autoExcludeVenv = true;
            }
        }
        // Override the analyzeUnannotatedFunctions setting based on the command-line setting.
        if (commandLineOptions.analyzeUnannotatedFunctions !== undefined) {
            configOptions.diagnosticRuleSet.analyzeUnannotatedFunctions =
                commandLineOptions.analyzeUnannotatedFunctions;
        }
        // Override the include based on command-line settings.
        if (commandLineOptions.includeFileSpecsOverride) {
            configOptions.include = [];
            commandLineOptions.includeFileSpecsOverride.forEach((include) => {
                configOptions.include.push((0, uriUtils_1.getFileSpec)(uri_1.Uri.file(include, this.serviceProvider, /* checkRelative */ true), '.'));
            });
        }
        const reportDuplicateSetting = (settingName, configValue) => {
            const settingSource = commandLineOptions.fromVsCodeExtension
                ? 'the client settings'
                : 'a command-line option';
            this._console.warn(`The ${settingName} has been specified in both the config file and ` +
                `${settingSource}. The value in the config file (${configValue}) ` +
                `will take precedence`);
        };
        // Apply the command-line options if the corresponding
        // item wasn't already set in the config file. Report any
        // duplicates.
        if (commandLineOptions.venvPath) {
            if (!configOptions.venvPath) {
                configOptions.venvPath = projectRoot.resolvePaths(commandLineOptions.venvPath);
            }
            else {
                reportDuplicateSetting('venvPath', configOptions.venvPath.toUserVisibleString());
            }
        }
        if (commandLineOptions.typeshedPath) {
            if (!configOptions.typeshedPath) {
                configOptions.typeshedPath = projectRoot.resolvePaths(commandLineOptions.typeshedPath);
            }
            else {
                reportDuplicateSetting('typeshedPath', configOptions.typeshedPath.toUserVisibleString());
            }
        }
        // If the caller specified that "typeshedPath" is the root of the project,
        // then we're presumably running in the typeshed project itself. Auto-exclude
        // stdlib packages that don't match the current Python version.
        if (configOptions.typeshedPath &&
            configOptions.typeshedPath === projectRoot &&
            configOptions.defaultPythonVersion !== undefined) {
            const excludeList = this.getImportResolver().getTypeshedStdlibExcludeList(configOptions.typeshedPath, configOptions.defaultPythonVersion, configOptions.defaultPythonPlatform);
            this._console.info(`Excluding typeshed stdlib stubs according to VERSIONS file:`);
            excludeList.forEach((exclude) => {
                this._console.info(`    ${exclude}`);
                configOptions.exclude.push((0, uriUtils_1.getFileSpec)(executionRoot, exclude.getFilePath()));
            });
        }
        configOptions.verboseOutput = (_c = commandLineOptions.verboseOutput) !== null && _c !== void 0 ? _c : configOptions.verboseOutput;
        configOptions.checkOnlyOpenFiles = !!commandLineOptions.checkOnlyOpenFiles;
        configOptions.autoImportCompletions = !!commandLineOptions.autoImportCompletions;
        configOptions.indexing = !!commandLineOptions.indexing;
        configOptions.taskListTokens = commandLineOptions.taskListTokens;
        configOptions.logTypeEvaluationTime = !!commandLineOptions.logTypeEvaluationTime;
        configOptions.typeEvaluationTimeThreshold = commandLineOptions.typeEvaluationTimeThreshold;
        // If useLibraryCodeForTypes was not specified in the config, allow the settings
        // or command line to override it.
        if (configOptions.useLibraryCodeForTypes === undefined) {
            configOptions.useLibraryCodeForTypes = commandLineOptions.useLibraryCodeForTypes;
        }
        else if (commandLineOptions.useLibraryCodeForTypes !== undefined) {
            reportDuplicateSetting('useLibraryCodeForTypes', configOptions.useLibraryCodeForTypes);
        }
        // If useLibraryCodeForTypes is unspecified, default it to true.
        if (configOptions.useLibraryCodeForTypes === undefined) {
            configOptions.useLibraryCodeForTypes = true;
        }
        if (commandLineOptions.stubPath) {
            if (!configOptions.stubPath) {
                configOptions.stubPath = this.fs.realCasePath(projectRoot.resolvePaths(commandLineOptions.stubPath));
            }
            else {
                reportDuplicateSetting('stubPath', configOptions.stubPath.toUserVisibleString());
            }
        }
        if (configOptions.stubPath) {
            // If there was a stub path specified, validate it.
            if (!this.fs.existsSync(configOptions.stubPath) || !(0, uriUtils_1.isDirectory)(this.fs, configOptions.stubPath)) {
                this._console.warn(`stubPath ${configOptions.stubPath} is not a valid directory.`);
            }
        }
        else {
            // If no stub path was specified, use a default path.
            configOptions.stubPath = configOptions.projectRoot.resolvePaths(pathConsts_1.defaultStubsDirectory);
        }
        // Do some sanity checks on the specified settings and report missing
        // or inconsistent information.
        if (configOptions.venvPath) {
            if (!this.fs.existsSync(configOptions.venvPath) || !(0, uriUtils_1.isDirectory)(this.fs, configOptions.venvPath)) {
                this._console.error(`venvPath ${configOptions.venvPath.toUserVisibleString()} is not a valid directory.`);
            }
            // venvPath without venv means it won't do anything while resolveImport.
            // so first, try to set venv from existing configOption if it is null. if both are null,
            // then, resolveImport won't consider venv
            configOptions.venv = (_d = configOptions.venv) !== null && _d !== void 0 ? _d : this._configOptions.venv;
            if (configOptions.venv && configOptions.venvPath) {
                const fullVenvPath = configOptions.venvPath.resolvePaths(configOptions.venv);
                if (!this.fs.existsSync(fullVenvPath) || !(0, uriUtils_1.isDirectory)(this.fs, fullVenvPath)) {
                    this._console.error(`venv ${configOptions.venv} subdirectory not found in venv path ${configOptions.venvPath.toUserVisibleString()}.`);
                }
                else {
                    const importFailureInfo = [];
                    if ((0, pythonPathUtils_1.findPythonSearchPaths)(this.fs, configOptions, host, importFailureInfo) === undefined) {
                        this._console.error(`site-packages directory cannot be located for venvPath ` +
                            `${configOptions.venvPath.toUserVisibleString()} and venv ${configOptions.venv}.`);
                        if (configOptions.verboseOutput) {
                            importFailureInfo.forEach((diag) => {
                                this._console.error(`  ${diag}`);
                            });
                        }
                    }
                }
            }
        }
        // Is there a reference to a venv? If so, there needs to be a valid venvPath.
        if (configOptions.venv) {
            if (!configOptions.venvPath) {
                this._console.warn(`venvPath not specified, so venv settings will be ignored.`);
            }
        }
        if (configOptions.typeshedPath) {
            if (!this.fs.existsSync(configOptions.typeshedPath) || !(0, uriUtils_1.isDirectory)(this.fs, configOptions.typeshedPath)) {
                this._console.error(`typeshedPath ${configOptions.typeshedPath.toUserVisibleString()} is not a valid directory.`);
            }
        }
        return configOptions;
    }
    // Loads the config JSON object from the specified config file along with any
    // chained config files specified in the "extends" property (recursively).
    _getExtendedConfigurations(primaryConfigFileUri) {
        this._primaryConfigFileUri = primaryConfigFileUri;
        this._extendedConfigFileUris = [];
        if (!primaryConfigFileUri) {
            return undefined;
        }
        let curConfigFileUri = primaryConfigFileUri;
        const configJsonObjs = [];
        while (true) {
            this._extendedConfigFileUris.push(curConfigFileUri);
            let configFileJsonObj;
            // Is this a TOML or JSON file?
            if (curConfigFileUri.lastExtension.endsWith('.toml')) {
                this._console.info(`Loading pyproject.toml file at ${curConfigFileUri.toUserVisibleString()}`);
                configFileJsonObj = this._parsePyprojectTomlFile(curConfigFileUri);
            }
            else {
                this._console.info(`Loading configuration file at ${curConfigFileUri.toUserVisibleString()}`);
                configFileJsonObj = this._parseJsonConfigFile(curConfigFileUri);
            }
            if (!configFileJsonObj) {
                break;
            }
            // Push onto the start of the array so base configs are processed first.
            configJsonObjs.unshift({ configFileJsonObj, configFileDirUri: curConfigFileUri.getDirectory() });
            const baseConfigUri = configOptions_1.ConfigOptions.resolveExtends(configFileJsonObj, curConfigFileUri.getDirectory());
            if (!baseConfigUri) {
                break;
            }
            // Check for circular references.
            if (this._extendedConfigFileUris.some((uri) => uri.equals(baseConfigUri))) {
                this._console.error(`Circular reference in configuration file "extends" setting: ${curConfigFileUri.toUserVisibleString()} ` +
                    `extends ${baseConfigUri.toUserVisibleString()}`);
                break;
            }
            curConfigFileUri = baseConfigUri;
        }
        return configJsonObjs;
    }
    _getTypeStubFolder() {
        var _a;
        const stubPath = (_a = this._configOptions.stubPath) !== null && _a !== void 0 ? _a : this.fs.realCasePath(this._configOptions.projectRoot.resolvePaths(pathConsts_1.defaultStubsDirectory));
        if (!this._typeStubTargetUri || !this._typeStubTargetImportName) {
            const errMsg = `Import '${this._typeStubTargetImportName}'` + ` could not be resolved`;
            this._console.error(errMsg);
            throw new Error(errMsg);
        }
        const typeStubInputTargetParts = this._typeStubTargetImportName.split('.');
        if (typeStubInputTargetParts[0].length === 0) {
            // We should never get here because the import resolution
            // would have failed.
            const errMsg = `Import '${this._typeStubTargetImportName}'` + ` could not be resolved`;
            this._console.error(errMsg);
            throw new Error(errMsg);
        }
        try {
            // Generate a new typings directory if necessary.
            if (!this.fs.existsSync(stubPath)) {
                this.fs.mkdirSync(stubPath);
            }
        }
        catch (e) {
            const errMsg = `Could not create typings directory '${stubPath.toUserVisibleString()}'`;
            this._console.error(errMsg);
            throw new Error(errMsg);
        }
        // Generate a typings subdirectory hierarchy.
        const typingsSubdirPath = stubPath.resolvePaths(typeStubInputTargetParts[0]);
        const typingsSubdirHierarchy = stubPath.resolvePaths(...typeStubInputTargetParts);
        try {
            // Generate a new typings subdirectory if necessary.
            if (!this.fs.existsSync(typingsSubdirHierarchy)) {
                (0, uriUtils_1.makeDirectories)(this.fs, typingsSubdirHierarchy, stubPath);
            }
        }
        catch (e) {
            const errMsg = `Could not create typings subdirectory '${typingsSubdirHierarchy.toUserVisibleString()}'`;
            this._console.error(errMsg);
            throw new Error(errMsg);
        }
        return typingsSubdirPath;
    }
    _findConfigFileHereOrUp(searchPath) {
        return (0, uriUtils_1.forEachAncestorDirectory)(searchPath, (ancestor) => this._findConfigFile(ancestor));
    }
    _findConfigFile(searchPath) {
        const fileName = searchPath.resolvePaths(exports.configFileName);
        if (this.fs.existsSync(fileName)) {
            return this.fs.realCasePath(fileName);
        }
        return undefined;
    }
    _findPyprojectTomlFileHereOrUp(searchPath) {
        return (0, uriUtils_1.forEachAncestorDirectory)(searchPath, (ancestor) => this._findPyprojectTomlFile(ancestor));
    }
    _findPyprojectTomlFile(searchPath) {
        const fileName = searchPath.resolvePaths(exports.pyprojectTomlName);
        if (this.fs.existsSync(fileName)) {
            return this.fs.realCasePath(fileName);
        }
        return undefined;
    }
    _parseJsonConfigFile(configPath) {
        return this._attemptParseFile(configPath, (fileContents) => {
            const errors = [];
            const result = JSONC.parse(fileContents, errors, { allowTrailingComma: true });
            if (errors.length > 0) {
                throw new Error('Errors parsing JSON file');
            }
            return result;
        });
    }
    _parsePyprojectTomlFile(pyprojectPath) {
        return this._attemptParseFile(pyprojectPath, (fileContents, attemptCount) => {
            try {
                const configObj = TOML.parse(fileContents);
                if (configObj && configObj.tool && configObj.tool.pyright) {
                    return configObj.tool.pyright;
                }
            }
            catch (e) {
                this._console.error(`Pyproject file parse attempt ${attemptCount} error: ${JSON.stringify(e)}`);
                throw e;
            }
            this._console.info(`Pyproject file "${pyprojectPath.toUserVisibleString()}" has no "[tool.pyright]" section.`);
            return undefined;
        });
    }
    _attemptParseFile(fileUri, parseCallback) {
        let fileContents = '';
        let parseAttemptCount = 0;
        while (true) {
            // Attempt to read the file contents.
            try {
                fileContents = this.fs.readFileSync(fileUri, 'utf8');
            }
            catch {
                this._console.error(`Config file "${fileUri.toUserVisibleString()}" could not be read.`);
                this._reportConfigParseError();
                return undefined;
            }
            // Attempt to parse the file.
            let parseFailed = false;
            try {
                return parseCallback(fileContents, parseAttemptCount + 1);
            }
            catch (e) {
                parseFailed = true;
            }
            if (!parseFailed) {
                break;
            }
            // If we attempt to read the file immediately after it was saved, it
            // may have been partially written when we read it, resulting in parse
            // errors. We'll give it a little more time and try again.
            if (parseAttemptCount++ >= 5) {
                this._console.error(`Config file "${fileUri.toUserVisibleString()}" could not be parsed. Verify that format is correct.`);
                this._reportConfigParseError();
                return undefined;
            }
        }
        return undefined;
    }
    _getFileNamesFromFileSpecs() {
        // Use a map to generate a list of unique files.
        const fileMap = new Map();
        // Scan all matching files from file system.
        timing_1.timingStats.findFilesTime.timeOperation(() => {
            const matchedFiles = this._matchFiles(this._configOptions.include, this._configOptions.exclude);
            for (const file of matchedFiles) {
                fileMap.set(file.key, file);
            }
        });
        // And scan all matching open files. We need to do this since some of files are not backed by
        // files in file system but only exist in memory (ex, virtual workspace)
        this._backgroundAnalysisProgram.program
            .getOpened()
            .map((o) => o.sourceFile.getUri())
            .filter((f) => (0, configOptions_1.matchFileSpecs)(this._program.configOptions, f))
            .forEach((f) => fileMap.set(f.key, f));
        return Array.from(fileMap.values());
    }
    // If markFilesDirtyUnconditionally is true, we need to reparse
    // and reanalyze all files in the program. If false, we will
    // reparse and reanalyze only those files whose on-disk contents
    // have changed. Unconditional dirtying is needed in the case where
    // configuration options have changed.
    _updateTrackedFileList(markFilesDirtyUnconditionally) {
        // Are we in type stub generation mode? If so, we need to search
        // for a different set of files.
        if (this._typeStubTargetImportName) {
            const execEnv = this._configOptions.findExecEnvironment(this._executionRootUri);
            const moduleDescriptor = (0, importResolver_1.createImportedModuleDescriptor)(this._typeStubTargetImportName);
            const importResult = this._backgroundAnalysisProgram.importResolver.resolveImport(uri_1.Uri.empty(), execEnv, moduleDescriptor);
            if (importResult.isImportFound) {
                const filesToImport = [];
                // Determine the directory that contains the root package.
                const finalResolvedPath = importResult.resolvedUris[importResult.resolvedUris.length - 1];
                const isFinalPathFile = (0, uriUtils_1.isFile)(this.fs, finalResolvedPath);
                const isFinalPathInitFile = isFinalPathFile && finalResolvedPath.stripAllExtensions().fileName === '__init__';
                let rootPackagePath = finalResolvedPath;
                if (isFinalPathFile) {
                    // If the module is a __init__.pyi? file, use its parent directory instead.
                    rootPackagePath = rootPackagePath.getDirectory();
                }
                for (let i = importResult.resolvedUris.length - 2; i >= 0; i--) {
                    if (!importResult.resolvedUris[i].isEmpty()) {
                        rootPackagePath = importResult.resolvedUris[i];
                    }
                    else {
                        // If there was no file corresponding to this portion
                        // of the name path, assume that it's contained
                        // within its parent directory.
                        rootPackagePath = rootPackagePath.getDirectory();
                    }
                }
                if ((0, uriUtils_1.isDirectory)(this.fs, rootPackagePath)) {
                    this._typeStubTargetUri = rootPackagePath;
                }
                else if ((0, uriUtils_1.isFile)(this.fs, rootPackagePath)) {
                    // This can occur if there is a "dir/__init__.py" at the same level as a
                    // module "dir/module.py" that is specifically targeted for stub generation.
                    this._typeStubTargetUri = rootPackagePath.getDirectory();
                }
                if (finalResolvedPath.isEmpty()) {
                    this._typeStubTargetIsSingleFile = false;
                }
                else {
                    filesToImport.push(finalResolvedPath);
                    this._typeStubTargetIsSingleFile = importResult.resolvedUris.length === 1 && !isFinalPathInitFile;
                }
                // Add the implicit import paths.
                importResult.filteredImplicitImports.forEach((implicitImport) => {
                    if (importResolver_1.ImportResolver.isSupportedImportSourceFile(implicitImport.uri)) {
                        filesToImport.push(implicitImport.uri);
                    }
                });
                this._backgroundAnalysisProgram.setAllowedThirdPartyImports([this._typeStubTargetImportName]);
                this._backgroundAnalysisProgram.setTrackedFiles(filesToImport);
            }
            else {
                this._console.error(`Import '${this._typeStubTargetImportName}' not found`);
            }
        }
        else if (!this._options.skipScanningUserFiles) {
            let fileList = [];
            this._console.log(`Searching for source files`);
            fileList = this._getFileNamesFromFileSpecs();
            // getFileNamesFromFileSpecs might have updated configOptions, resync options.
            this._backgroundAnalysisProgram.setConfigOptions(this._configOptions);
            this._backgroundAnalysisProgram.setTrackedFiles(fileList);
            this._backgroundAnalysisProgram.markAllFilesDirty(markFilesDirtyUnconditionally);
            if (fileList.length === 0) {
                this._console.info(`No source files found.`);
            }
            else {
                this._console.info(`Found ${fileList.length} ` + `source ${fileList.length === 1 ? 'file' : 'files'}`);
            }
        }
        this._requireTrackedFileUpdate = false;
    }
    _matchFiles(include, exclude) {
        const envMarkers = [['bin', 'activate'], ['Scripts', 'activate'], ['pyvenv.cfg'], ['conda-meta']];
        const results = [];
        const startTime = Date.now();
        const longOperationLimitInSec = 10;
        let loggedLongOperationError = false;
        const visitDirectoryUnchecked = (absolutePath, includeRegExp, hasDirectoryWildcard) => {
            if (!loggedLongOperationError) {
                const secondsSinceStart = (Date.now() - startTime) * 0.001;
                // If this is taking a long time, log an error to help the user
                // diagnose and mitigate the problem.
                if (secondsSinceStart >= longOperationLimitInSec) {
                    this._console.error(`Enumeration of workspace source files is taking longer than ${longOperationLimitInSec} seconds.\n` +
                        'This may be because:\n' +
                        '* You have opened your home directory or entire hard drive as a workspace\n' +
                        '* Your workspace contains a very large number of directories and files\n' +
                        '* Your workspace contains a symlink to a directory with many files\n' +
                        '* Your workspace is remote, and file enumeration is slow\n' +
                        'To reduce this time, open a workspace directory with fewer files ' +
                        'or add a pyrightconfig.json configuration file with an "exclude" section to exclude ' +
                        'subdirectories from your workspace. For more details, refer to ' +
                        'https://github.com/microsoft/pyright/blob/main/docs/configuration.md.');
                    loggedLongOperationError = true;
                }
            }
            if (this._configOptions.autoExcludeVenv) {
                if (envMarkers.some((f) => this.fs.existsSync(absolutePath.resolvePaths(...f)))) {
                    // Save auto exclude paths in the configOptions once we found them.
                    if (!uriUtils_1.FileSpec.isInPath(absolutePath, exclude)) {
                        exclude.push((0, uriUtils_1.getFileSpec)(this._configOptions.projectRoot, `${absolutePath}/**`));
                    }
                    this._console.info(`Auto-excluding ${absolutePath.toUserVisibleString()}`);
                    return;
                }
            }
            const { files, directories } = (0, uriUtils_1.getFileSystemEntries)(this.fs, absolutePath);
            for (const filePath of files) {
                if (uriUtils_1.FileSpec.matchIncludeFileSpec(includeRegExp, exclude, filePath)) {
                    results.push(filePath);
                }
            }
            for (const dirPath of directories) {
                if (dirPath.matchesRegex(includeRegExp) || hasDirectoryWildcard) {
                    if (!uriUtils_1.FileSpec.isInPath(dirPath, exclude)) {
                        visitDirectory(dirPath, includeRegExp, hasDirectoryWildcard);
                    }
                }
            }
        };
        const seenDirs = new Set();
        const visitDirectory = (absolutePath, includeRegExp, hasDirectoryWildcard) => {
            const realDirPath = (0, uriUtils_1.tryRealpath)(this.fs, absolutePath);
            if (!realDirPath) {
                this._console.warn(`Skipping broken link "${absolutePath}"`);
                return;
            }
            if (seenDirs.has(realDirPath.key)) {
                this._console.warn(`Skipping recursive symlink "${absolutePath}" -> "${realDirPath}"`);
                return;
            }
            seenDirs.add(realDirPath.key);
            try {
                visitDirectoryUnchecked(absolutePath, includeRegExp, hasDirectoryWildcard);
            }
            finally {
                seenDirs.delete(realDirPath.key);
            }
        };
        include.forEach((includeSpec) => {
            if (!uriUtils_1.FileSpec.isInPath(includeSpec.wildcardRoot, exclude)) {
                let foundFileSpec = false;
                const stat = (0, uriUtils_1.tryStat)(this.fs, includeSpec.wildcardRoot);
                if (stat === null || stat === void 0 ? void 0 : stat.isFile()) {
                    results.push(includeSpec.wildcardRoot);
                    foundFileSpec = true;
                }
                else if (stat === null || stat === void 0 ? void 0 : stat.isDirectory()) {
                    visitDirectory(includeSpec.wildcardRoot, includeSpec.regExp, includeSpec.hasDirectoryWildcard);
                    foundFileSpec = true;
                }
                if (!foundFileSpec) {
                    this._console.error(`File or directory "${includeSpec.wildcardRoot.toUserVisibleString()}" does not exist.`);
                }
            }
        });
        return results;
    }
    _removeSourceFileWatchers() {
        if (this._sourceFileWatcher) {
            this._sourceFileWatcher.close();
            this._sourceFileWatcher = undefined;
        }
    }
    _updateSourceFileWatchers() {
        this._removeSourceFileWatchers();
        if (!this._watchForSourceChanges) {
            return;
        }
        if (this._configOptions.include.length > 0) {
            const fileList = this._configOptions.include.map((spec) => {
                return spec.wildcardRoot;
            });
            try {
                if (this._verboseOutput) {
                    this._console.info(`Adding fs watcher for directories:\n ${fileList.join('\n')}`);
                }
                const isIgnored = (0, fileWatcher_1.ignoredWatchEventFunction)(fileList.map((f) => f.getFilePath()));
                this._sourceFileWatcher = this.fs.createFileSystemWatcher(fileList, (event, path) => {
                    if (!path) {
                        return;
                    }
                    if (this._verboseOutput) {
                        this._console.info(`SourceFile: Received fs event '${event}' for path '${path}'`);
                    }
                    if (isIgnored(path)) {
                        return;
                    }
                    // Wholesale ignore events that appear to be from tmp file / .git modification.
                    if (path.endsWith('.tmp') || path.endsWith('.git') || path.includes(_gitDirectory)) {
                        return;
                    }
                    let uri = uri_1.Uri.file(path, this.serviceProvider, /* checkRelative */ true);
                    // Make sure path is the true case.
                    uri = this.fs.realCasePath(uri);
                    const eventInfo = getEventInfo(this.fs, this._console, this._program, event, uri);
                    if (!eventInfo) {
                        // no-op event, return.
                        return;
                    }
                    if (!this._shouldHandleSourceFileWatchChanges(uri, eventInfo.isFile)) {
                        return;
                    }
                    // This is for performance optimization. If the change only pertains to the content of one file,
                    // then it can't affect the 'import resolution' result. All we need to do is reanalyze the related files
                    // (those that have a transitive dependency on this file).
                    if (eventInfo.isFile && eventInfo.event === 'change') {
                        this._backgroundAnalysisProgram.markFilesDirty([uri], /* evenIfContentsAreSame */ false);
                        this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
                        return;
                    }
                    // When the file system structure changes, like when files are added or removed,
                    // this can affect how we resolve imports. This requires us to reset caches and reanalyze everything.
                    //
                    // However, we don't need to rebuild any indexes in this situation. Changes to workspace files don't affect library indices.
                    // As for user files, their indices don't contain import alias symbols, so adding or removing user files won't affect the existing indices.
                    // We only rebuild the indices for a user file when the symbols within the file are changed, like when a user edits the file.
                    // The index scanner will index any new files during its next background run.
                    this.invalidateAndForceReanalysis(backgroundAnalysisProgram_1.InvalidatedReason.SourceWatcherChanged);
                    this._scheduleReanalysis(/* requireTrackedFileUpdate */ true);
                });
            }
            catch {
                this._console.error(`Exception caught when installing fs watcher for:\n ${fileList
                    .map((f) => f.toUserVisibleString())
                    .join('\n')}`);
            }
        }
        function getEventInfo(fs, console, program, event, path) {
            // Due to the way we implemented file watcher, we will only get 2 events; 'add' and 'change'.
            // Here, we will convert those 2 to 3 events. 'add', 'change' and 'unlink';
            const stats = (0, uriUtils_1.tryStat)(fs, path);
            if (event === 'add') {
                if (!stats) {
                    // If we are told that the path is added, but if we can't access it, then consider it as already deleted.
                    // there is nothing we need to do.
                    return undefined;
                }
                return { event, isFile: stats.isFile() };
            }
            if (event === 'change') {
                // If we got 'change', but can't access the path, then we consider it as delete.
                if (!stats) {
                    // See whether it is a file that got deleted.
                    const isFile = !!program.getSourceFile(path);
                    // If not, check whether it is a part of the workspace at all.
                    if (!isFile && !program.containsSourceFileIn(path)) {
                        // There is no source file under the given path. There is nothing we need to do.
                        return undefined;
                    }
                    return { event: 'unlink', isFile };
                }
                return { event, isFile: stats.isFile() };
            }
            // We have unknown event.
            console.warn(`Received unknown file change event: '${event}' for '${path}'`);
            return undefined;
        }
    }
    _shouldHandleSourceFileWatchChanges(path, isFile) {
        if (isFile) {
            if (!(0, uriUtils_1.hasPythonExtension)(path) || isTemporaryFile(path)) {
                return false;
            }
            // Check whether the file change can affect semantics. If the file changed is not a user file or already a part of
            // the program (since we lazily load library files or extra path files when they are used), then the change can't
            // affect semantics. so just bail out.
            if (!this.isTracked(path) && !this._program.getSourceFileInfo(path)) {
                return false;
            }
            return true;
        }
        // The fs change is on a folder.
        if (!(0, configOptions_1.matchFileSpecs)(this._program.configOptions, path, /* isFile */ false)) {
            // First, make sure the folder is included. By default, we exclude any folder whose name starts with '.'
            return false;
        }
        const parentPath = path.getDirectory();
        const hasInit = parentPath.startsWith(this._configOptions.projectRoot) &&
            (this.fs.existsSync(parentPath.initPyUri) || this.fs.existsSync(parentPath.initPyiUri));
        // We don't have any file under the given path and its parent folder doesn't have __init__ then this folder change
        // doesn't have any meaning to us.
        if (!hasInit && !this._program.containsSourceFileIn(path)) {
            return false;
        }
        return true;
        function isTemporaryFile(path) {
            // Determine if this is an add or delete event related to a temporary
            // file. Some tools (like auto-formatters) create temporary files
            // alongside the original file and name them "x.py.<temp-id>.py" where
            // <temp-id> is a 32-character random string of hex digits. We don't
            // want these events to trigger a full reanalysis.
            const fileName = path.fileName;
            const fileNameSplit = fileName.split('.');
            if (fileNameSplit.length === 4) {
                if (fileNameSplit[3] === fileNameSplit[1] && fileNameSplit[2].length === 32) {
                    return true;
                }
            }
            return false;
        }
    }
    _removeLibraryFileWatcher() {
        if (this._libraryFileWatcher) {
            this._libraryFileWatcher.close();
            this._libraryFileWatcher = undefined;
        }
    }
    _updateLibraryFileWatcher() {
        this._removeLibraryFileWatcher();
        if (!this._watchForLibraryChanges) {
            this._librarySearchUrisToWatch = undefined;
            return;
        }
        // Watch the library paths for package install/uninstall.
        const importFailureInfo = [];
        this._librarySearchUrisToWatch = (0, pythonPathUtils_1.findPythonSearchPaths)(this.fs, this._backgroundAnalysisProgram.configOptions, this._backgroundAnalysisProgram.host, importFailureInfo, 
        /* includeWatchPathsOnly */ true, this._executionRootUri);
        const watchList = this._librarySearchUrisToWatch;
        if (watchList && watchList.length > 0) {
            try {
                if (this._verboseOutput) {
                    this._console.info(`Adding fs watcher for library directories:\n ${watchList.join('\n')}`);
                }
                const isIgnored = (0, fileWatcher_1.ignoredWatchEventFunction)(watchList.map((f) => f.getFilePath()));
                this._libraryFileWatcher = this.fs.createFileSystemWatcher(watchList, (event, path) => {
                    if (!path) {
                        return;
                    }
                    if (this._verboseOutput) {
                        this._console.info(`LibraryFile: Received fs event '${event}' for path '${path}'`);
                    }
                    if (isIgnored(path)) {
                        return;
                    }
                    const uri = uri_1.Uri.file(path, this.serviceProvider, /* checkRelative */ true);
                    if (!this._shouldHandleLibraryFileWatchChanges(uri, watchList)) {
                        return;
                    }
                    // If file doesn't exist, it is delete.
                    const isChange = event === 'change' && this.fs.existsSync(uri);
                    this._scheduleLibraryAnalysis(isChange);
                });
            }
            catch {
                this._console.error(`Exception caught when installing fs watcher for:\n ${watchList
                    .map((w) => w.toUserVisibleString())
                    .join('\n')}`);
            }
        }
    }
    _shouldHandleLibraryFileWatchChanges(path, libSearchPaths) {
        if (this._program.getSourceFileInfo(path)) {
            return true;
        }
        // find the innermost matching search path
        let matchingSearchPath;
        for (const libSearchPath of libSearchPaths) {
            if (path.isChild(libSearchPath) &&
                (!matchingSearchPath || matchingSearchPath.getPathLength() < libSearchPath.getPathLength())) {
                matchingSearchPath = libSearchPath;
            }
        }
        if (!matchingSearchPath) {
            return true;
        }
        const parentComponents = matchingSearchPath.getPathComponents();
        const childComponents = path.getPathComponents();
        for (let i = parentComponents.length; i < childComponents.length; i++) {
            if (childComponents[i].startsWith('.')) {
                return false;
            }
        }
        return true;
    }
    _clearLibraryReanalysisTimer() {
        var _a, _b, _c;
        if (this._libraryReanalysisTimer) {
            clearTimeout(this._libraryReanalysisTimer);
            this._libraryReanalysisTimer = undefined;
            const handled = (_a = this._backgroundAnalysisProgram) === null || _a === void 0 ? void 0 : _a.libraryUpdated();
            (_c = (_b = this._options.libraryReanalysisTimeProvider) === null || _b === void 0 ? void 0 : _b.libraryUpdated) === null || _c === void 0 ? void 0 : _c.call(_b, handled);
        }
    }
    _scheduleLibraryAnalysis(isChange) {
        if (this._disposed) {
            // Already disposed.
            return;
        }
        this._clearLibraryReanalysisTimer();
        const reanalysisTimeProvider = this._options.libraryReanalysisTimeProvider;
        const backOffTimeInMS = reanalysisTimeProvider === null || reanalysisTimeProvider === void 0 ? void 0 : reanalysisTimeProvider();
        if (!backOffTimeInMS) {
            // We don't support library reanalysis.
            return;
        }
        // Add pending library files/folders changes.
        this._pendingLibraryChanges.changesOnly = this._pendingLibraryChanges.changesOnly && isChange;
        // Wait for a little while, since library changes
        // tend to happen in big batches when packages
        // are installed or uninstalled.
        this._libraryReanalysisTimer = setTimeout(() => {
            var _a, _b;
            this._clearLibraryReanalysisTimer();
            // Invalidate import resolver, mark all files dirty unconditionally,
            // and reanalyze.
            this.invalidateAndForceReanalysis(this._pendingLibraryChanges.changesOnly
                ? backgroundAnalysisProgram_1.InvalidatedReason.LibraryWatcherContentOnlyChanged
                : backgroundAnalysisProgram_1.InvalidatedReason.LibraryWatcherChanged);
            this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
            // No more pending changes.
            (_b = (_a = reanalysisTimeProvider).libraryReanalysisStarted) === null || _b === void 0 ? void 0 : _b.call(_a);
            this._pendingLibraryChanges.changesOnly = true;
        }, backOffTimeInMS);
    }
    _removeConfigFileWatcher() {
        if (this._configFileWatcher) {
            this._configFileWatcher.close();
            this._configFileWatcher = undefined;
        }
    }
    _updateConfigFileWatcher() {
        this._removeConfigFileWatcher();
        if (!this._watchForConfigChanges) {
            return;
        }
        if (this._primaryConfigFileUri) {
            this._configFileWatcher = this.fs.createFileSystemWatcher(this._extendedConfigFileUris, (event) => {
                if (this._verboseOutput) {
                    this._console.info(`Received fs event '${event}' for config file`);
                }
                this._scheduleReloadConfigFile();
            });
        }
        else if (this._executionRootUri) {
            this._configFileWatcher = this.fs.createFileSystemWatcher([this._executionRootUri], (event, path) => {
                if (!path) {
                    return;
                }
                if (event === 'add' || event === 'change') {
                    const fileName = (0, pathUtils_1.getFileName)(path);
                    if (fileName === exports.configFileName) {
                        if (this._verboseOutput) {
                            this._console.info(`Received fs event '${event}' for config file`);
                        }
                        if (this._commandLineOptions) {
                            this.setOptions(this._commandLineOptions);
                        }
                    }
                }
            });
        }
    }
    _clearReloadConfigTimer() {
        if (this._reloadConfigTimer) {
            clearTimeout(this._reloadConfigTimer);
            this._reloadConfigTimer = undefined;
        }
    }
    _scheduleReloadConfigFile() {
        this._clearReloadConfigTimer();
        // Wait for a little while after we receive the
        // change update event because it may take a while
        // for the file to be written out. Plus, there may
        // be multiple changes.
        this._reloadConfigTimer = setTimeout(() => {
            this._clearReloadConfigTimer();
            this._reloadConfigFile();
        }, 100);
    }
    _reloadConfigFile() {
        this._updateConfigFileWatcher();
        if (this._primaryConfigFileUri) {
            this._console.info(`Reloading configuration file at ${this._primaryConfigFileUri.toUserVisibleString()}`);
            const host = this._backgroundAnalysisProgram.host;
            // We can't just reload config file when it is changed; we need to consider
            // command line options as well to construct new config Options.
            const configOptions = this._getConfigOptions(host, this._commandLineOptions);
            this._backgroundAnalysisProgram.setConfigOptions(configOptions);
            this._applyConfigOptions(host);
        }
    }
    _applyConfigOptions(host) {
        var _a;
        // Allocate a new import resolver because the old one has information
        // cached based on the previous config options.
        const importResolver = this._importResolverFactory(this._serviceProvider, this._backgroundAnalysisProgram.configOptions, host);
        this._backgroundAnalysisProgram.setImportResolver(importResolver);
        if (((_a = this._commandLineOptions) === null || _a === void 0 ? void 0 : _a.fromVsCodeExtension) || this._configOptions.verboseOutput) {
            const logLevel = this._configOptions.verboseOutput ? console_1.LogLevel.Info : console_1.LogLevel.Log;
            for (const execEnv of this._configOptions.getExecutionEnvironments()) {
                (0, console_1.log)(this._console, logLevel, `Search paths for ${execEnv.root || '<default>'}`);
                const roots = importResolver.getImportRoots(execEnv, /* forLogging */ true);
                roots.forEach((path) => {
                    (0, console_1.log)(this._console, logLevel, `  ${path.toUserVisibleString()}`);
                });
            }
        }
        this._updateLibraryFileWatcher();
        this._updateConfigFileWatcher();
        this._updateSourceFileWatchers();
        this._updateTrackedFileList(/* markFilesDirtyUnconditionally */ true);
        this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
    }
    _clearReanalysisTimer() {
        if (this._analyzeTimer) {
            clearTimeout(this._analyzeTimer);
            this._analyzeTimer = undefined;
        }
    }
    _scheduleReanalysis(requireTrackedFileUpdate) {
        var _a, _b;
        if (this._disposed || !((_a = this._commandLineOptions) === null || _a === void 0 ? void 0 : _a.enableAmbientAnalysis)) {
            // already disposed
            return;
        }
        if (requireTrackedFileUpdate) {
            this._requireTrackedFileUpdate = true;
        }
        (_b = this._backgroundAnalysisCancellationSource) === null || _b === void 0 ? void 0 : _b.cancel();
        // Remove any existing analysis timer.
        this._clearReanalysisTimer();
        // How long has it been since the user interacted with the service?
        // If the user is actively typing, back off to let him or her finish.
        const timeSinceLastUserInteractionInMs = Date.now() - this._lastUserInteractionTime;
        const minBackoffTimeInMs = _userActivityBackoffTimeInMs;
        // We choose a small non-zero value here. If this value
        // is too small (like zero), the VS Code extension becomes
        // unresponsive during heavy analysis. If this number is too
        // large, analysis takes longer.
        const minTimeBetweenAnalysisPassesInMs = 20;
        const timeUntilNextAnalysisInMs = Math.max(minBackoffTimeInMs - timeSinceLastUserInteractionInMs, minTimeBetweenAnalysisPassesInMs);
        // Schedule a new timer.
        this._analyzeTimer = setTimeout(() => {
            this._analyzeTimer = undefined;
            if (this._requireTrackedFileUpdate) {
                this._updateTrackedFileList(/* markFilesDirtyUnconditionally */ false);
            }
            // This creates a cancellation source only if it actually gets used.
            this._backgroundAnalysisCancellationSource = this.cancellationProvider.createCancellationTokenSource();
            const moreToAnalyze = this._backgroundAnalysisProgram.startAnalysis(this._backgroundAnalysisCancellationSource.token);
            if (moreToAnalyze) {
                this._scheduleReanalysis(/* requireTrackedFileUpdate */ false);
            }
        }, timeUntilNextAnalysisInMs);
    }
    _reportConfigParseError() {
        if (this._onCompletionCallback) {
            this._onCompletionCallback({
                diagnostics: [],
                filesInProgram: 0,
                requiringAnalysisCount: { files: 0, cells: 0 },
                checkingOnlyOpenFiles: true,
                fatalErrorOccurred: false,
                configParseErrorOccurred: true,
                elapsedTime: 0,
            });
        }
    }
}
exports.AnalyzerService = AnalyzerService;
//# sourceMappingURL=service.js.map