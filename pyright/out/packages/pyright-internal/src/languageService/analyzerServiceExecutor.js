"use strict";
/*
 * analyzerServiceExecutor.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Runs the analyzer service of a given workspace service instance
 * with a specified set of options.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyzerServiceExecutor = void 0;
const pythonPathUtils_1 = require("../analyzer/pythonPathUtils");
const service_1 = require("../analyzer/service");
const commandLineOptions_1 = require("../common/commandLineOptions");
const console_1 = require("../common/console");
const workspaceFactory_1 = require("../workspaceFactory");
class AnalyzerServiceExecutor {
    static runWithOptions(workspace, serverSettings, typeStubTargetImportName, trackFiles = true) {
        const commandLineOptions = getEffectiveCommandLineOptions(workspace.rootUri, serverSettings, trackFiles, typeStubTargetImportName, workspace.pythonEnvironmentName);
        // Setting options causes the analyzer service to re-analyze everything.
        workspace.service.setOptions(commandLineOptions);
    }
    static async cloneService(ls, workspace, options) {
        // Allocate a temporary pseudo-workspace to perform this job.
        const instanceName = 'cloned service';
        const serviceId = (0, service_1.getNextServiceId)(instanceName);
        options = options !== null && options !== void 0 ? options : {};
        const tempWorkspace = {
            ...workspace,
            workspaceName: `temp workspace for cloned service`,
            rootUri: workspace.rootUri,
            pythonPath: workspace.pythonPath,
            pythonPathKind: workspace.pythonPathKind,
            kinds: [...workspace.kinds, workspaceFactory_1.WellKnownWorkspaceKinds.Cloned],
            service: workspace.service.clone(instanceName, serviceId, options.useBackgroundAnalysis ? ls.createBackgroundAnalysis(serviceId) : undefined, options.fileSystem),
            disableLanguageServices: true,
            disableTaggedHints: true,
            disableOrganizeImports: true,
            disableWorkspaceSymbol: true,
            isInitialized: (0, workspaceFactory_1.createInitStatus)(),
            searchPathsToWatch: [],
        };
        const serverSettings = await ls.getSettings(workspace);
        AnalyzerServiceExecutor.runWithOptions(tempWorkspace, serverSettings, options.typeStubTargetImportName, 
        /* trackFiles */ false);
        return tempWorkspace.service;
    }
}
exports.AnalyzerServiceExecutor = AnalyzerServiceExecutor;
function getEffectiveCommandLineOptions(workspaceRootUri, serverSettings, trackFiles, typeStubTargetImportName, pythonEnvironmentName) {
    var _a, _b, _c, _d, _e, _f, _g;
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(workspaceRootUri, true);
    commandLineOptions.checkOnlyOpenFiles = serverSettings.openFilesOnly;
    commandLineOptions.useLibraryCodeForTypes = serverSettings.useLibraryCodeForTypes;
    commandLineOptions.typeCheckingMode = serverSettings.typeCheckingMode;
    commandLineOptions.autoImportCompletions = serverSettings.autoImportCompletions;
    commandLineOptions.indexing = serverSettings.indexing;
    commandLineOptions.taskListTokens = serverSettings.taskListTokens;
    commandLineOptions.logTypeEvaluationTime = (_a = serverSettings.logTypeEvaluationTime) !== null && _a !== void 0 ? _a : false;
    commandLineOptions.typeEvaluationTimeThreshold = (_b = serverSettings.typeEvaluationTimeThreshold) !== null && _b !== void 0 ? _b : 50;
    commandLineOptions.enableAmbientAnalysis = trackFiles;
    commandLineOptions.pythonEnvironmentName = pythonEnvironmentName;
    commandLineOptions.disableTaggedHints = serverSettings.disableTaggedHints;
    if (!trackFiles) {
        commandLineOptions.watchForSourceChanges = false;
        commandLineOptions.watchForLibraryChanges = false;
        commandLineOptions.watchForConfigChanges = false;
    }
    else {
        commandLineOptions.watchForSourceChanges = serverSettings.watchForSourceChanges;
        commandLineOptions.watchForLibraryChanges = serverSettings.watchForLibraryChanges;
        commandLineOptions.watchForConfigChanges = serverSettings.watchForConfigChanges;
    }
    if (serverSettings.venvPath) {
        commandLineOptions.venvPath = serverSettings.venvPath.getFilePath();
    }
    if (serverSettings.pythonPath) {
        // The Python VS Code extension treats the value "python" specially. This means
        // the local python interpreter should be used rather than interpreting the
        // setting value as a path to the interpreter. We'll simply ignore it in this case.
        if (!(0, pythonPathUtils_1.isPythonBinary)(serverSettings.pythonPath.getFilePath())) {
            commandLineOptions.pythonPath = serverSettings.pythonPath.getFilePath();
        }
    }
    if (serverSettings.typeshedPath) {
        // Pyright supports only one typeshed path currently, whereas the
        // official VS Code Python extension supports multiple typeshed paths.
        // We'll use the first one specified and ignore the rest.
        commandLineOptions.typeshedPath = serverSettings.typeshedPath.getFilePath();
    }
    if (serverSettings.stubPath) {
        commandLineOptions.stubPath = serverSettings.stubPath.getFilePath();
    }
    if (serverSettings.logLevel === console_1.LogLevel.Log) {
        // When logLevel is "Trace", turn on verboseOutput as well
        // so we can get detailed log from analysis service.
        commandLineOptions.verboseOutput = true;
    }
    if (typeStubTargetImportName) {
        commandLineOptions.typeStubTargetImportName = typeStubTargetImportName;
    }
    commandLineOptions.autoSearchPaths = serverSettings.autoSearchPaths;
    commandLineOptions.extraPaths = (_d = (_c = serverSettings.extraPaths) === null || _c === void 0 ? void 0 : _c.map((e) => e.getFilePath())) !== null && _d !== void 0 ? _d : [];
    commandLineOptions.diagnosticSeverityOverrides = serverSettings.diagnosticSeverityOverrides;
    commandLineOptions.includeFileSpecs = (_e = serverSettings.includeFileSpecs) !== null && _e !== void 0 ? _e : [];
    commandLineOptions.excludeFileSpecs = (_f = serverSettings.excludeFileSpecs) !== null && _f !== void 0 ? _f : [];
    commandLineOptions.ignoreFileSpecs = (_g = serverSettings.ignoreFileSpecs) !== null && _g !== void 0 ? _g : [];
    return commandLineOptions;
}
//# sourceMappingURL=analyzerServiceExecutor.js.map