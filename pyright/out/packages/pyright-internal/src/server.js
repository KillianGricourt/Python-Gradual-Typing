"use strict";
/*
 * server.ts
 *
 * Implements pyright language server.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PyrightServer = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const cacheManager_1 = require("./analyzer/cacheManager");
const importResolver_1 = require("./analyzer/importResolver");
const pythonPathUtils_1 = require("./analyzer/pythonPathUtils");
const backgroundAnalysis_1 = require("./backgroundAnalysis");
const commandController_1 = require("./commands/commandController");
const cancellationUtils_1 = require("./common/cancellationUtils");
const configOptions_1 = require("./common/configOptions");
const console_1 = require("./common/console");
const core_1 = require("./common/core");
const envVarUtils_1 = require("./common/envVarUtils");
const fileBasedCancellationUtils_1 = require("./common/fileBasedCancellationUtils");
const fullAccessHost_1 = require("./common/fullAccessHost");
const realFileSystem_1 = require("./common/realFileSystem");
const serviceProviderExtensions_1 = require("./common/serviceProviderExtensions");
const uri_1 = require("./common/uri/uri");
const uriUtils_1 = require("./common/uri/uriUtils");
const languageServerBase_1 = require("./languageServerBase");
const codeActionProvider_1 = require("./languageService/codeActionProvider");
const pyrightFileSystem_1 = require("./pyrightFileSystem");
const workspaceFactory_1 = require("./workspaceFactory");
const maxAnalysisTimeInForeground = { openFilesTimeInMs: 50, noOpenFilesTimeInMs: 200 };
class PyrightServer extends languageServerBase_1.LanguageServerBase {
    constructor(connection, maxWorkers, realFileSystem) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const version = require('../package.json').version || '';
        const tempFile = new realFileSystem_1.RealTempFile();
        const console = new console_1.ConsoleWithLogLevel(connection.console);
        const fileWatcherProvider = new realFileSystem_1.WorkspaceFileWatcherProvider();
        const fileSystem = realFileSystem !== null && realFileSystem !== void 0 ? realFileSystem : (0, realFileSystem_1.createFromRealFileSystem)(tempFile, console, fileWatcherProvider);
        const pyrightFs = new pyrightFileSystem_1.PyrightFileSystem(fileSystem);
        const cacheManager = new cacheManager_1.CacheManager(maxWorkers);
        const serviceProvider = (0, serviceProviderExtensions_1.createServiceProvider)(pyrightFs, tempFile, console, cacheManager);
        // When executed from CLI command (pyright-langserver), __rootDirectory is
        // already defined. When executed from VSCode extension, rootDirectory should
        // be __dirname.
        const rootDirectory = (0, uriUtils_1.getRootUri)(serviceProvider) || uri_1.Uri.file(__dirname, serviceProvider);
        const realPathRoot = pyrightFs.realCasePath(rootDirectory);
        super({
            productName: 'Pyright',
            rootDirectory: realPathRoot,
            version,
            serviceProvider,
            fileWatcherHandler: fileWatcherProvider,
            cancellationProvider: new fileBasedCancellationUtils_1.FileBasedCancellationProvider('bg'),
            maxAnalysisTimeInForeground,
            supportedCodeActions: [vscode_languageserver_1.CodeActionKind.QuickFix, vscode_languageserver_1.CodeActionKind.SourceOrganizeImports],
        }, connection);
        this._controller = new commandController_1.CommandController(this);
    }
    async getSettings(workspace) {
        const serverSettings = {
            watchForSourceChanges: true,
            watchForLibraryChanges: true,
            watchForConfigChanges: true,
            openFilesOnly: true,
            useLibraryCodeForTypes: true,
            disableLanguageServices: false,
            disableTaggedHints: false,
            disableOrganizeImports: false,
            typeCheckingMode: 'standard',
            diagnosticSeverityOverrides: {},
            logLevel: console_1.LogLevel.Info,
            autoImportCompletions: true,
            functionSignatureDisplay: configOptions_1.SignatureDisplayType.formatted,
        };
        try {
            const workspaces = this.workspaceFactory.getNonDefaultWorkspaces(workspaceFactory_1.WellKnownWorkspaceKinds.Regular);
            const pythonSection = await this.getConfiguration(workspace.rootUri, 'python');
            if (pythonSection) {
                const pythonPath = pythonSection.pythonPath;
                if (pythonPath && (0, core_1.isString)(pythonPath) && !(0, pythonPathUtils_1.isPythonBinary)(pythonPath)) {
                    serverSettings.pythonPath = (0, envVarUtils_1.resolvePathWithEnvVariables)(workspace, pythonPath, workspaces);
                }
                const venvPath = pythonSection.venvPath;
                if (venvPath && (0, core_1.isString)(venvPath)) {
                    serverSettings.venvPath = (0, envVarUtils_1.resolvePathWithEnvVariables)(workspace, venvPath, workspaces);
                }
            }
            const pythonAnalysisSection = await this.getConfiguration(workspace.rootUri, 'python.analysis');
            if (pythonAnalysisSection) {
                const typeshedPaths = pythonAnalysisSection.typeshedPaths;
                if (typeshedPaths && Array.isArray(typeshedPaths) && typeshedPaths.length > 0) {
                    const typeshedPath = typeshedPaths[0];
                    if (typeshedPath && (0, core_1.isString)(typeshedPath)) {
                        serverSettings.typeshedPath = (0, envVarUtils_1.resolvePathWithEnvVariables)(workspace, typeshedPath, workspaces);
                    }
                }
                const stubPath = pythonAnalysisSection.stubPath;
                if (stubPath && (0, core_1.isString)(stubPath)) {
                    serverSettings.stubPath = (0, envVarUtils_1.resolvePathWithEnvVariables)(workspace, stubPath, workspaces);
                }
                const diagnosticSeverityOverrides = pythonAnalysisSection.diagnosticSeverityOverrides;
                if (diagnosticSeverityOverrides) {
                    for (const [name, value] of Object.entries(diagnosticSeverityOverrides)) {
                        const ruleName = this.getDiagnosticRuleName(name);
                        const severity = this.getSeverityOverrides(value);
                        if (ruleName && severity) {
                            serverSettings.diagnosticSeverityOverrides[ruleName] = severity;
                        }
                    }
                }
                if (pythonAnalysisSection.diagnosticMode !== undefined) {
                    serverSettings.openFilesOnly = this.isOpenFilesOnly(pythonAnalysisSection.diagnosticMode);
                }
                else if (pythonAnalysisSection.openFilesOnly !== undefined) {
                    serverSettings.openFilesOnly = !!pythonAnalysisSection.openFilesOnly;
                }
                if (pythonAnalysisSection.useLibraryCodeForTypes !== undefined) {
                    serverSettings.useLibraryCodeForTypes = !!pythonAnalysisSection.useLibraryCodeForTypes;
                }
                serverSettings.logLevel = (0, console_1.convertLogLevel)(pythonAnalysisSection.logLevel);
                serverSettings.autoSearchPaths = !!pythonAnalysisSection.autoSearchPaths;
                const extraPaths = pythonAnalysisSection.extraPaths;
                if (extraPaths && Array.isArray(extraPaths) && extraPaths.length > 0) {
                    serverSettings.extraPaths = extraPaths
                        .filter((p) => p && (0, core_1.isString)(p))
                        .map((p) => (0, envVarUtils_1.resolvePathWithEnvVariables)(workspace, p, workspaces))
                        .filter(core_1.isDefined);
                }
                serverSettings.includeFileSpecs = this._getStringValues(pythonAnalysisSection.include);
                serverSettings.excludeFileSpecs = this._getStringValues(pythonAnalysisSection.exclude);
                serverSettings.ignoreFileSpecs = this._getStringValues(pythonAnalysisSection.ignore);
                if (pythonAnalysisSection.typeCheckingMode !== undefined) {
                    serverSettings.typeCheckingMode = pythonAnalysisSection.typeCheckingMode;
                }
                if (pythonAnalysisSection.autoImportCompletions !== undefined) {
                    serverSettings.autoImportCompletions = pythonAnalysisSection.autoImportCompletions;
                }
                if (serverSettings.logLevel === console_1.LogLevel.Log &&
                    pythonAnalysisSection.logTypeEvaluationTime !== undefined) {
                    serverSettings.logTypeEvaluationTime = pythonAnalysisSection.logTypeEvaluationTime;
                }
                if (pythonAnalysisSection.typeEvaluationTimeThreshold !== undefined) {
                    serverSettings.typeEvaluationTimeThreshold = pythonAnalysisSection.typeEvaluationTimeThreshold;
                }
            }
            else {
                serverSettings.autoSearchPaths = true;
            }
            const pyrightSection = await this.getConfiguration(workspace.rootUri, 'pyright');
            if (pyrightSection) {
                if (pyrightSection.openFilesOnly !== undefined) {
                    serverSettings.openFilesOnly = !!pyrightSection.openFilesOnly;
                }
                if (pyrightSection.useLibraryCodeForTypes !== undefined) {
                    serverSettings.useLibraryCodeForTypes = !!pyrightSection.useLibraryCodeForTypes;
                }
                serverSettings.disableLanguageServices = !!pyrightSection.disableLanguageServices;
                serverSettings.disableTaggedHints = !!pyrightSection.disableTaggedHints;
                serverSettings.disableOrganizeImports = !!pyrightSection.disableOrganizeImports;
                const typeCheckingMode = pyrightSection.typeCheckingMode;
                if (typeCheckingMode && (0, core_1.isString)(typeCheckingMode)) {
                    serverSettings.typeCheckingMode = typeCheckingMode;
                }
            }
        }
        catch (error) {
            this.console.error(`Error reading settings: ${error}`);
        }
        return serverSettings;
    }
    createBackgroundAnalysis(serviceId) {
        if ((0, core_1.isDebugMode)() || !(0, cancellationUtils_1.getCancellationFolderName)()) {
            // Don't do background analysis if we're in debug mode or an old client
            // is used where cancellation is not supported.
            return undefined;
        }
        return new backgroundAnalysis_1.BackgroundAnalysis(this.serverOptions.serviceProvider);
    }
    createHost() {
        return new fullAccessHost_1.FullAccessHost(this.serverOptions.serviceProvider);
    }
    createImportResolver(serviceProvider, options, host) {
        const importResolver = new importResolver_1.ImportResolver(serviceProvider, options, host);
        // In case there was cached information in the file system related to
        // import resolution, invalidate it now.
        importResolver.invalidateCache();
        return importResolver;
    }
    executeCommand(params, token) {
        return this._controller.execute(params, token);
    }
    isLongRunningCommand(command) {
        return this._controller.isLongRunningCommand(command);
    }
    isRefactoringCommand(command) {
        return this._controller.isRefactoringCommand(command);
    }
    async executeCodeAction(params, token) {
        this.recordUserInteractionTime();
        const uri = uri_1.Uri.parse(params.textDocument.uri, this.serverOptions.serviceProvider);
        const workspace = await this.getWorkspaceForFile(uri);
        return codeActionProvider_1.CodeActionProvider.getCodeActionsForPosition(workspace, uri, params.range, params.context.only, token);
    }
    createProgressReporter() {
        // The old progress notifications are kept for backwards compatibility with
        // clients that do not support work done progress.
        let workDoneProgress;
        return {
            isEnabled: (data) => true,
            begin: () => {
                if (this.client.hasWindowProgressCapability) {
                    workDoneProgress = this.connection.window.createWorkDoneProgress();
                    workDoneProgress
                        .then((progress) => {
                        progress.begin('');
                    })
                        .ignoreErrors();
                }
                else {
                    this.connection.sendNotification('pyright/beginProgress');
                }
            },
            report: (message) => {
                if (workDoneProgress) {
                    workDoneProgress
                        .then((progress) => {
                        progress.report(message);
                    })
                        .ignoreErrors();
                }
                else {
                    this.connection.sendNotification('pyright/reportProgress', message);
                }
            },
            end: () => {
                if (workDoneProgress) {
                    workDoneProgress
                        .then((progress) => {
                        progress.done();
                    })
                        .ignoreErrors();
                    workDoneProgress = undefined;
                }
                else {
                    this.connection.sendNotification('pyright/endProgress');
                }
            },
        };
    }
    _getStringValues(values) {
        if (!values || !Array.isArray(values) || values.length === 0) {
            return [];
        }
        return values.filter((p) => p && (0, core_1.isString)(p));
    }
}
exports.PyrightServer = PyrightServer;
//# sourceMappingURL=server.js.map