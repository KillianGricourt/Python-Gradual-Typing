"use strict";
/*
 * testLanguageService.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Test mock that implements LanguageServiceInterface
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
exports.TestLanguageService = exports.TestFeatures = void 0;
const backgroundAnalysisProgram_1 = require("../../../analyzer/backgroundAnalysisProgram");
const service_1 = require("../../../analyzer/service");
const commandController_1 = require("../../../commands/commandController");
const configOptions_1 = require("../../../common/configOptions");
const debug = __importStar(require("../../../common/debug"));
const serviceProvider_1 = require("../../../common/serviceProvider");
const uri_1 = require("../../../common/uri/uri");
const codeActionProvider_1 = require("../../../languageService/codeActionProvider");
const workspaceFactory_1 = require("../../../workspaceFactory");
const testAccessHost_1 = require("../testAccessHost");
class TestFeatures {
    constructor() {
        this.importResolverFactory = service_1.AnalyzerService.createImportResolver;
        this.backgroundAnalysisProgramFactory = (serviceId, serviceProvider, configOptions, importResolver, backgroundAnalysis, maxAnalysisTime) => new backgroundAnalysisProgram_1.BackgroundAnalysisProgram(serviceId, serviceProvider, configOptions, importResolver, backgroundAnalysis, maxAnalysisTime, 
        /* disableChecker */ undefined);
    }
    runIndexer(workspace, noStdLib, options) {
        /* empty */
    }
    getCodeActionsForPosition(workspace, fileUri, range, token) {
        return codeActionProvider_1.CodeActionProvider.getCodeActionsForPosition(workspace, fileUri, range, undefined, token);
    }
    execute(ls, params, token) {
        const controller = new commandController_1.CommandController(ls);
        return controller.execute(params, token);
    }
}
exports.TestFeatures = TestFeatures;
class TestLanguageService {
    constructor(workspace, console, fs, options) {
        this.console = console;
        this.fs = fs;
        this.window = new TestWindow();
        this.supportAdvancedEdits = true;
        this._workspace = workspace;
        this.serviceProvider = this._workspace.service.serviceProvider;
        this._defaultWorkspace = {
            workspaceName: '',
            rootUri: undefined,
            pythonPath: undefined,
            pythonPathKind: workspaceFactory_1.WorkspacePythonPathKind.Mutable,
            kinds: [workspaceFactory_1.WellKnownWorkspaceKinds.Test],
            service: new service_1.AnalyzerService('test service', new serviceProvider_1.ServiceProvider(), options !== null && options !== void 0 ? options : {
                console: this.console,
                hostFactory: () => new testAccessHost_1.TestAccessHost(),
                importResolverFactory: service_1.AnalyzerService.createImportResolver,
                configOptions: new configOptions_1.ConfigOptions(uri_1.Uri.empty()),
                fileSystem: this.fs,
            }),
            disableLanguageServices: false,
            disableTaggedHints: false,
            disableOrganizeImports: false,
            disableWorkspaceSymbol: false,
            isInitialized: (0, workspaceFactory_1.createInitStatus)(),
            searchPathsToWatch: [],
            pythonEnvironmentName: undefined,
        };
    }
    getWorkspaces() {
        return Promise.resolve([this._workspace, this._defaultWorkspace]);
    }
    getWorkspaceForFile(uri) {
        if (uri.startsWith(this._workspace.rootUri)) {
            return Promise.resolve(this._workspace);
        }
        return Promise.resolve(this._defaultWorkspace);
    }
    getSettings(_workspace) {
        const settings = {
            venvPath: this._workspace.service.getConfigOptions().venvPath,
            pythonPath: this._workspace.service.getConfigOptions().pythonPath,
            typeshedPath: this._workspace.service.getConfigOptions().typeshedPath,
            openFilesOnly: this._workspace.service.getConfigOptions().checkOnlyOpenFiles,
            useLibraryCodeForTypes: this._workspace.service.getConfigOptions().useLibraryCodeForTypes,
            disableLanguageServices: this._workspace.disableLanguageServices,
            disableTaggedHints: this._workspace.disableTaggedHints,
            autoImportCompletions: this._workspace.service.getConfigOptions().autoImportCompletions,
            functionSignatureDisplay: this._workspace.service.getConfigOptions().functionSignatureDisplay,
        };
        return Promise.resolve(settings);
    }
    createBackgroundAnalysis(serviceId) {
        // worker thread doesn't work in Jest
        // by returning undefined, analysis will run inline
        return undefined;
    }
    reanalyze() {
        // Don't do anything
    }
    restart() {
        // Don't do anything
    }
}
exports.TestLanguageService = TestLanguageService;
class TestWindow {
    showErrorMessage(message, ...actions) {
        debug.fail("shouldn't be called");
    }
    showWarningMessage(message, ...actions) {
        debug.fail("shouldn't be called");
    }
    showInformationMessage(message, ...actions) {
        // Don't do anything
    }
}
//# sourceMappingURL=testLanguageService.js.map