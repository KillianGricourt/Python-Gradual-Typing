"use strict";
/*
 * envVarUtils.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for functions in envVarUtils.
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
const os = __importStar(require("os"));
const assert_1 = __importDefault(require("assert"));
const envVarUtils_1 = require("../common/envVarUtils");
const workspaceFactory_1 = require("../workspaceFactory");
const uriUtils_1 = require("../common/uri/uriUtils");
const uri_1 = require("../common/uri/uri");
const service_1 = require("../analyzer/service");
const console_1 = require("../common/console");
const testAccessHost_1 = require("./harness/testAccessHost");
const configOptions_1 = require("../common/configOptions");
const filesystem_1 = require("./harness/vfs/filesystem");
const serviceProviderExtensions_1 = require("../common/serviceProviderExtensions");
jest.mock('os', () => ({ __esModule: true, ...jest.requireActual('os') }));
const defaultWorkspace = createWorkspace(undefined);
const normalworkspace = createWorkspace(uriUtils_1.UriEx.file('/'));
test('expands ${workspaceFolder}', () => {
    const workspaceFolderUri = uriUtils_1.UriEx.parse('/src');
    const test_path = '${workspaceFolder}/foo';
    const path = `${workspaceFolderUri.getPath()}/foo`;
    assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, workspaceFolderUri, []), path);
});
test('expands ${workspaceFolder:sibling}', () => {
    const workspaceFolderUri = uriUtils_1.UriEx.parse('/src');
    const workspace = { workspaceName: 'sibling', rootUri: workspaceFolderUri };
    const test_path = `\${workspaceFolder:${workspace.workspaceName}}/foo`;
    const path = `${workspaceFolderUri.getPath()}/foo`;
    assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, workspaceFolderUri, [workspace]), path);
});
test('resolvePathWithEnvVariables ${workspaceFolder}', () => {
    var _a;
    const workspaceFolderUri = uriUtils_1.UriEx.parse('mem-fs:/hello/there');
    const test_path = `\${workspaceFolder}/foo`;
    const path = `${workspaceFolderUri.toString()}/foo`;
    assert_1.default.equal((0, envVarUtils_1.resolvePathWithEnvVariables)(defaultWorkspace, test_path, []), undefined);
    const workspace = createWorkspace(workspaceFolderUri);
    assert_1.default.equal((_a = (0, envVarUtils_1.resolvePathWithEnvVariables)(workspace, test_path, [])) === null || _a === void 0 ? void 0 : _a.toString(), path);
});
test('test resolvePathWithEnvVariables', () => {
    (0, assert_1.default)(!(0, envVarUtils_1.resolvePathWithEnvVariables)(defaultWorkspace, '', []));
    (0, assert_1.default)(!(0, envVarUtils_1.resolvePathWithEnvVariables)(defaultWorkspace, '${workspaceFolder}', []));
});
describe('expandPathVariables', () => {
    const OLD_ENV = process.env;
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...OLD_ENV };
    });
    afterAll(() => {
        process.env = OLD_ENV;
    });
    test('expands ${env:HOME}', () => {
        process.env.HOME = 'file:///home/foo';
        const test_path = '${env:HOME}/bar';
        const path = `${process.env.HOME}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('resolvePathWithEnvVariables ${env:HOME}', () => {
        var _a, _b;
        process.env.HOME = '/home/foo';
        const test_path = '${env:HOME}/bar';
        const path = `file://${process.env.HOME}/bar`;
        assert_1.default.equal((_a = (0, envVarUtils_1.resolvePathWithEnvVariables)(defaultWorkspace, test_path, [])) === null || _a === void 0 ? void 0 : _a.toString(), path);
        assert_1.default.equal((_b = (0, envVarUtils_1.resolvePathWithEnvVariables)(normalworkspace, test_path, [])) === null || _b === void 0 ? void 0 : _b.toString(), path);
    });
    test('expands ${env:USERNAME}', () => {
        process.env.USERNAME = 'foo';
        const test_path = 'file:///home/${env:USERNAME}/bar';
        const path = `file:///home/${process.env.USERNAME}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('expands ${env:VIRTUAL_ENV}', () => {
        process.env.VIRTUAL_ENV = 'file:///home/foo/.venv/path';
        const test_path = '${env:VIRTUAL_ENV}/bar';
        const path = `${process.env.VIRTUAL_ENV}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('resolvePathWithEnvVariables ${env:VIRTUAL_ENV}', () => {
        var _a, _b;
        process.env.VIRTUAL_ENV = 'https://server/home/foo/.venv/path';
        const test_path = '${env:VIRTUAL_ENV}/bar';
        const path = `${process.env.VIRTUAL_ENV}/bar`;
        assert_1.default.equal((_a = (0, envVarUtils_1.resolvePathWithEnvVariables)(defaultWorkspace, test_path, [])) === null || _a === void 0 ? void 0 : _a.toString(), path);
        assert_1.default.equal((_b = (0, envVarUtils_1.resolvePathWithEnvVariables)(normalworkspace, test_path, [])) === null || _b === void 0 ? void 0 : _b.toString(), path);
    });
    test('expands ~ with os.homedir()', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('file:///home/foo');
        process.env.HOME = '';
        process.env.USERPROFILE = '';
        const test_path = '~/bar';
        const path = `${os.homedir()}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('resolvePathWithEnvVariables ~ with os.homedir()', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('c:\\home\\foo');
        process.env.HOME = '';
        process.env.USERPROFILE = '';
        const test_path = '~/bar';
        const fileUri = uriUtils_1.UriEx.file(`${os.homedir()}/bar`);
        const defaultResult = (0, envVarUtils_1.resolvePathWithEnvVariables)(defaultWorkspace, test_path, []);
        const normalResult = (0, envVarUtils_1.resolvePathWithEnvVariables)(normalworkspace, test_path, []);
        assert_1.default.equal(defaultResult === null || defaultResult === void 0 ? void 0 : defaultResult.scheme, fileUri.scheme);
        assert_1.default.equal(normalResult === null || normalResult === void 0 ? void 0 : normalResult.scheme, fileUri.scheme);
        assert_1.default.equal(defaultResult === null || defaultResult === void 0 ? void 0 : defaultResult.getFilePath(), fileUri.getFilePath());
        assert_1.default.equal(normalResult === null || normalResult === void 0 ? void 0 : normalResult.getFilePath(), fileUri.getFilePath());
    });
    test('expands ~ with env:HOME', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('');
        process.env.HOME = 'file:///home/foo';
        process.env.USERPROFILE = '';
        const test_path = '~/bar';
        const path = `${process.env.HOME}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('expands ~ with env:USERPROFILE', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('');
        process.env.HOME = '';
        process.env.USERPROFILE = 'file:///home/foo';
        const test_path = '~/bar';
        const path = `${process.env.USERPROFILE}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('expands /~ with os.homedir()', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('file:///home/foo');
        process.env.HOME = '';
        process.env.USERPROFILE = '';
        const test_path = '/~/bar';
        const path = `${os.homedir()}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('expands /~ with env:HOME', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('');
        process.env.HOME = 'file:///home/foo';
        process.env.USERPROFILE = '';
        const test_path = '/~/bar';
        const path = `${process.env.HOME}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('expands /~ with env:USERPROFILE', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('');
        process.env.HOME = '';
        process.env.USERPROFILE = 'file:///home/foo';
        const test_path = '/~/bar';
        const path = `${process.env.USERPROFILE}/bar`;
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), path);
    });
    test('dont expands ~ when it is used as normal char 1', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('file:///home/foo');
        const test_path = '/home/user/~testfolder/testapp';
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), test_path);
    });
    test('dont expands ~ when it is used as normal char 2', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('file:///home/foo');
        const test_path = '/home/user/testfolder~';
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), test_path);
    });
    test('dont expands ~ when it is used as normal char 3', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('file:///home/foo');
        const test_path = '/home/user/test~folder';
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), test_path);
    });
    test('dont expands ~ when it is used as normal char 4', () => {
        jest.spyOn(os, 'homedir').mockReturnValue('file:///home/foo');
        const test_path = '/home/user/testfolder~/testapp';
        assert_1.default.equal((0, envVarUtils_1.expandPathVariables)(test_path, uri_1.Uri.empty(), []), test_path);
    });
});
function createWorkspace(rootUri) {
    const fs = new filesystem_1.TestFileSystem(false);
    return {
        workspaceName: '',
        rootUri,
        pythonPath: undefined,
        pythonPathKind: workspaceFactory_1.WorkspacePythonPathKind.Mutable,
        kinds: [workspaceFactory_1.WellKnownWorkspaceKinds.Test],
        service: new service_1.AnalyzerService('test service', (0, serviceProviderExtensions_1.createServiceProvider)(fs), {
            console: new console_1.NullConsole(),
            hostFactory: () => new testAccessHost_1.TestAccessHost(),
            importResolverFactory: service_1.AnalyzerService.createImportResolver,
            configOptions: new configOptions_1.ConfigOptions(uri_1.Uri.empty()),
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
//# sourceMappingURL=envVarUtils.test.js.map