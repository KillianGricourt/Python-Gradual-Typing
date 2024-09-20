"use strict";
/*
 * config.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Unit tests for parsing of pyrightconfig.json files.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const service_1 = require("../analyzer/service");
const backgroundThreadBase_1 = require("../backgroundThreadBase");
const commandLineOptions_1 = require("../common/commandLineOptions");
const configOptions_1 = require("../common/configOptions");
const console_1 = require("../common/console");
const host_1 = require("../common/host");
const pathUtils_1 = require("../common/pathUtils");
const pythonVersion_1 = require("../common/pythonVersion");
const realFileSystem_1 = require("../common/realFileSystem");
const serviceProviderExtensions_1 = require("../common/serviceProviderExtensions");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const testAccessHost_1 = require("./harness/testAccessHost");
const filesystem_1 = require("./harness/vfs/filesystem");
function createAnalyzer(console) {
    const tempFile = new realFileSystem_1.RealTempFile();
    const cons = console !== null && console !== void 0 ? console : new console_1.NullConsole();
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile, cons);
    const serviceProvider = (0, serviceProviderExtensions_1.createServiceProvider)(fs, cons, tempFile);
    return new service_1.AnalyzerService('<default>', serviceProvider, { console: cons });
}
test('FindFilesWithConfigFile', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const service = createAnalyzer();
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ true);
    commandLineOptions.configFilePath = 'src/tests/samples/project1';
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    service.setOptions(commandLineOptions);
    // The config file specifies a single file spec (a directory).
    assert_1.default.strictEqual(configOptions.include.length, 1, `failed creating options from ${cwd}`);
    assert_1.default.strictEqual(configOptions.projectRoot.key, service.fs.realCasePath(uri_1.Uri.file((0, pathUtils_1.combinePaths)(cwd, commandLineOptions.configFilePath), service.serviceProvider))
        .key);
    const fileList = service.test_getFileNamesFromFileSpecs();
    // The config file specifies a subdirectory, so we should find
    // only two of the three "*.py" files present in the project
    // directory.
    assert_1.default.strictEqual(fileList.length, 2);
});
test('FindFilesVirtualEnvAutoDetectExclude', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const service = createAnalyzer();
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ true);
    commandLineOptions.configFilePath = 'src/tests/samples/project_with_venv_auto_detect_exclude';
    service.setOptions(commandLineOptions);
    // The config file is empty, so no 'exclude' are specified
    // The myVenv directory is detected as a venv and will be automatically excluded
    const fileList = service.test_getFileNamesFromFileSpecs();
    // There are 3 python files in the workspace, outside of myVenv
    // There is 1 python file in myVenv, which should be excluded
    const fileNames = fileList.map((p) => p.fileName).sort();
    assert_1.default.deepStrictEqual(fileNames, ['sample1.py', 'sample2.py', 'sample3.py']);
});
test('FindFilesVirtualEnvAutoDetectInclude', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const service = createAnalyzer();
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ true);
    commandLineOptions.configFilePath = 'src/tests/samples/project_with_venv_auto_detect_include';
    service.setOptions(commandLineOptions);
    // Config file defines 'exclude' folder so virtual env will be included
    const fileList = service.test_getFileNamesFromFileSpecs();
    // There are 3 python files in the workspace, outside of myVenv
    // There is 1 more python file in excluded folder
    // There is 1 python file in myVenv, which should be included
    const fileNames = fileList.map((p) => p.fileName).sort();
    assert_1.default.deepStrictEqual(fileNames, ['library1.py', 'sample1.py', 'sample2.py', 'sample3.py']);
});
test('FileSpecNotAnArray', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ false);
    commandLineOptions.configFilePath = 'src/tests/samples/project2';
    service.setOptions(commandLineOptions);
    service.test_getConfigOptions(commandLineOptions);
    // The method should return a default config and log an error.
    (0, assert_1.default)(nullConsole.infoCount > 0);
});
test('FileSpecNotAString', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ false);
    commandLineOptions.configFilePath = 'src/tests/samples/project3';
    service.setOptions(commandLineOptions);
    service.test_getConfigOptions(commandLineOptions);
    // The method should return a default config and log an error.
    (0, assert_1.default)(nullConsole.infoCount > 0);
});
test('SomeFileSpecsAreInvalid', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ false);
    commandLineOptions.configFilePath = 'src/tests/samples/project4';
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    // The config file specifies four file specs in the include array
    // and one in the exclude array.
    assert_1.default.strictEqual(configOptions.include.length, 4, `failed creating options from ${cwd}`);
    assert_1.default.strictEqual(configOptions.exclude.length, 1);
    assert_1.default.strictEqual(configOptions.projectRoot.getFilePath(), service.fs
        .realCasePath(uri_1.Uri.file((0, pathUtils_1.combinePaths)(cwd, commandLineOptions.configFilePath), service.serviceProvider))
        .getFilePath());
    const fileList = service.test_getFileNamesFromFileSpecs();
    // We should receive two final files that match the include/exclude rules.
    assert_1.default.strictEqual(fileList.length, 2);
});
test('ConfigBadJson', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ false);
    commandLineOptions.configFilePath = 'src/tests/samples/project5';
    service.setOptions(commandLineOptions);
    service.test_getConfigOptions(commandLineOptions);
    // The method should return a default config and log an error.
    (0, assert_1.default)(nullConsole.infoCount > 0);
});
test('FindExecEnv1', () => {
    const cwd = uriUtils_1.UriEx.file((0, pathUtils_1.normalizePath)(process.cwd()));
    const configOptions = new configOptions_1.ConfigOptions(cwd);
    // Build a config option with three execution environments.
    const execEnv1 = new configOptions_1.ExecutionEnvironment('python', cwd.resolvePaths('src/foo'), (0, configOptions_1.getStandardDiagnosticRuleSet)(), 
    /* defaultPythonVersion */ undefined, 
    /* defaultPythonPlatform */ undefined, 
    /* defaultExtraPaths */ undefined);
    configOptions.executionEnvironments.push(execEnv1);
    const execEnv2 = new configOptions_1.ExecutionEnvironment('python', cwd.resolvePaths('src'), (0, configOptions_1.getStandardDiagnosticRuleSet)(), 
    /* defaultPythonVersion */ undefined, 
    /* defaultPythonPlatform */ undefined, 
    /* defaultExtraPaths */ undefined);
    configOptions.executionEnvironments.push(execEnv2);
    const file1 = cwd.resolvePaths('src/foo/bar.py');
    assert_1.default.strictEqual(configOptions.findExecEnvironment(file1), execEnv1);
    const file2 = cwd.resolvePaths('src/foo2/bar.py');
    assert_1.default.strictEqual(configOptions.findExecEnvironment(file2), execEnv2);
    // If none of the execution environments matched, we should get
    // a default environment with the root equal to that of the config.
    const file4 = uriUtils_1.UriEx.file('/nothing/bar.py');
    const defaultExecEnv = configOptions.findExecEnvironment(file4);
    (0, assert_1.default)(defaultExecEnv.root);
    const rootFilePath = uri_1.Uri.is(defaultExecEnv.root) ? defaultExecEnv.root.getFilePath() : defaultExecEnv.root;
    assert_1.default.strictEqual((0, pathUtils_1.normalizeSlashes)(rootFilePath), (0, pathUtils_1.normalizeSlashes)(configOptions.projectRoot.getFilePath()));
});
test('PythonPlatform', () => {
    const cwd = uriUtils_1.UriEx.file((0, pathUtils_1.normalizePath)(process.cwd()));
    const configOptions = new configOptions_1.ConfigOptions(cwd);
    const json = JSON.parse(`{
        "executionEnvironments" : [
        {
            "root": ".",
            "pythonVersion" : "3.7",
            "pythonPlatform" : "platform",
            "extraPaths" : []
    }]}`);
    const fs = new filesystem_1.TestFileSystem(/* ignoreCase */ false);
    const nullConsole = new console_1.NullConsole();
    const sp = (0, serviceProviderExtensions_1.createServiceProvider)(fs, nullConsole);
    configOptions.initializeFromJson(json, cwd, sp, new host_1.NoAccessHost());
    const env = configOptions.executionEnvironments[0];
    assert_1.default.strictEqual(env.pythonPlatform, 'platform');
});
test('AutoSearchPathsOn', () => {
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const cwd = uri_1.Uri.file((0, pathUtils_1.normalizePath)((0, pathUtils_1.combinePaths)(process.cwd(), 'src/tests/samples/project_src')), service.serviceProvider);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd.getFilePath(), /* fromVsCodeExtension */ false);
    commandLineOptions.autoSearchPaths = true;
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    const expectedExtraPaths = [service.fs.realCasePath(cwd.combinePaths('src'))];
    assert_1.default.deepStrictEqual(configOptions.defaultExtraPaths, expectedExtraPaths);
});
test('AutoSearchPathsOff', () => {
    const cwd = (0, pathUtils_1.normalizePath)((0, pathUtils_1.combinePaths)(process.cwd(), 'src/tests/samples/project_src'));
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ false);
    commandLineOptions.autoSearchPaths = false;
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    assert_1.default.deepStrictEqual(configOptions.executionEnvironments, []);
});
test('AutoSearchPathsOnSrcIsPkg', () => {
    const cwd = (0, pathUtils_1.normalizePath)((0, pathUtils_1.combinePaths)(process.cwd(), 'src/tests/samples/project_src_is_pkg'));
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ false);
    commandLineOptions.autoSearchPaths = true;
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    // The src folder is a package (has __init__.py) and so should not be automatically added as extra path
    assert_1.default.deepStrictEqual(configOptions.executionEnvironments, []);
});
test('AutoSearchPathsOnWithConfigExecEnv', () => {
    const cwd = (0, pathUtils_1.normalizePath)((0, pathUtils_1.combinePaths)(process.cwd(), 'src/tests/samples/project_src_with_config_extra_paths'));
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ false);
    commandLineOptions.configFilePath = (0, pathUtils_1.combinePaths)(cwd, 'pyrightconfig.json');
    commandLineOptions.autoSearchPaths = true;
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    // The extraPaths in the config file should override the setting.
    const expectedExtraPaths = [];
    assert_1.default.deepStrictEqual(configOptions.defaultExtraPaths, expectedExtraPaths);
});
test('AutoSearchPathsOnAndExtraPaths', () => {
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const cwd = uri_1.Uri.file((0, pathUtils_1.normalizePath)((0, pathUtils_1.combinePaths)(process.cwd(), 'src/tests/samples/project_src_with_config_no_extra_paths')), service.serviceProvider);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd.getFilePath(), /* fromVsCodeExtension */ false);
    commandLineOptions.autoSearchPaths = true;
    commandLineOptions.extraPaths = ['src/_vendored'];
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    const expectedExtraPaths = [
        service.fs.realCasePath(cwd.combinePaths('src')),
        service.fs.realCasePath(cwd.combinePaths('src', '_vendored')),
    ];
    assert_1.default.deepStrictEqual(configOptions.defaultExtraPaths, expectedExtraPaths);
});
test('BasicPyprojectTomlParsing', () => {
    const cwd = (0, pathUtils_1.normalizePath)((0, pathUtils_1.combinePaths)(process.cwd(), 'src/tests/samples/project_with_pyproject_toml'));
    const service = createAnalyzer();
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ true);
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    assert_1.default.strictEqual(configOptions.defaultPythonVersion.toString(), pythonVersion_1.pythonVersion3_9.toString());
    assert_1.default.strictEqual(configOptions.diagnosticRuleSet.reportMissingImports, 'error');
    assert_1.default.strictEqual(configOptions.diagnosticRuleSet.reportUnusedClass, 'warning');
});
test('FindFilesInMemoryOnly', () => {
    const cwd = (0, pathUtils_1.normalizePath)(process.cwd());
    const service = createAnalyzer();
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(undefined, /* fromVsCodeExtension */ true);
    // Force a lookup of the typeshed path. This causes us to try and generate a module path for the untitled file.
    commandLineOptions.typeshedPath = (0, pathUtils_1.combinePaths)(cwd, 'src', 'tests', 'samples');
    service.setOptions(commandLineOptions);
    // Open a file that is not backed by the file system.
    const untitled = uri_1.Uri.parse('untitled:Untitled-1.py', service.serviceProvider);
    service.setFileOpened(untitled, 1, '# empty');
    const fileList = service.test_getFileNamesFromFileSpecs();
    (0, assert_1.default)(fileList.filter((f) => f.equals(untitled)));
});
test('verify config fileSpecs after cloning', () => {
    const fs = new filesystem_1.TestFileSystem(/* ignoreCase */ true);
    const configFile = {
        ignore: ['**/node_modules/**'],
    };
    const rootUri = uri_1.Uri.file(process.cwd(), fs);
    const config = new configOptions_1.ConfigOptions(rootUri);
    const sp = (0, serviceProviderExtensions_1.createServiceProvider)(fs, new console_1.NullConsole());
    config.initializeFromJson(configFile, rootUri, sp, new testAccessHost_1.TestAccessHost());
    const cloned = (0, backgroundThreadBase_1.deserialize)((0, backgroundThreadBase_1.serialize)(config));
    assert_1.default.deepEqual(config.ignore, cloned.ignore);
});
test('verify can serialize config options', () => {
    const config = new configOptions_1.ConfigOptions(uriUtils_1.UriEx.file(process.cwd()));
    const serialized = (0, backgroundThreadBase_1.serialize)(config);
    const deserialized = (0, backgroundThreadBase_1.deserialize)(serialized);
    assert_1.default.deepEqual(config, deserialized);
    assert_1.default.ok(deserialized.findExecEnvironment(uriUtils_1.UriEx.file('foo/bar.py')));
});
test('extra paths on undefined execution root/default workspace', () => {
    var _a;
    const nullConsole = new console_1.NullConsole();
    const service = createAnalyzer(nullConsole);
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(undefined, /* fromVsCodeExtension */ false);
    commandLineOptions.extraPaths = ['/extraPaths'];
    service.setOptions(commandLineOptions);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    const expectedExtraPaths = [uri_1.Uri.file('/extraPaths', service.serviceProvider)];
    assert_1.default.deepStrictEqual((_a = configOptions.defaultExtraPaths) === null || _a === void 0 ? void 0 : _a.map((u) => u.getFilePath()), expectedExtraPaths.map((u) => u.getFilePath()));
});
test('Extended config files', () => {
    const cwd = (0, pathUtils_1.normalizePath)((0, pathUtils_1.combinePaths)(process.cwd(), 'src/tests/samples/project_with_extended_config'));
    const service = createAnalyzer();
    const commandLineOptions = new commandLineOptions_1.CommandLineOptions(cwd, /* fromVsCodeExtension */ true);
    service.setOptions(commandLineOptions);
    const fileList = service.test_getFileNamesFromFileSpecs();
    const fileNames = fileList.map((p) => p.fileName).sort();
    assert_1.default.deepStrictEqual(fileNames, ['sample.pyi', 'test.py']);
    const configOptions = service.test_getConfigOptions(commandLineOptions);
    assert_1.default.equal(configOptions.diagnosticRuleSet.strictListInference, true);
});
//# sourceMappingURL=config.test.js.map