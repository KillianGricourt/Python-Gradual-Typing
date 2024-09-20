"use strict";
/*
 * testUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility functions that are common to a bunch of the tests.
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
exports.validateResults = exports.printDiagnostics = exports.getAnalysisResults = exports.typeAnalyzeSampleFiles = exports.parseSampleFile = exports.parseText = exports.readSampleFile = exports.resolveSampleFilePath = void 0;
const assert = __importStar(require("assert"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const importResolver_1 = require("../analyzer/importResolver");
const program_1 = require("../analyzer/program");
const testWalker_1 = require("../analyzer/testWalker");
const configOptions_1 = require("../common/configOptions");
const console_1 = require("../common/console");
const debug_1 = require("../common/debug");
const fullAccessHost_1 = require("../common/fullAccessHost");
const realFileSystem_1 = require("../common/realFileSystem");
const serviceProviderExtensions_1 = require("../common/serviceProviderExtensions");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const parser_1 = require("../parser/parser");
// This is a bit gross, but it's necessary to allow the fallback typeshed
// directory to be located when running within the jest environment. This
// assumes that the working directory has been set appropriately before
// running the tests.
global.__rootDirectory = path.resolve();
function resolveSampleFilePath(fileName) {
    return path.resolve(path.dirname(module.filename), `./samples/${fileName}`);
}
exports.resolveSampleFilePath = resolveSampleFilePath;
function readSampleFile(fileName) {
    const filePath = resolveSampleFilePath(fileName);
    try {
        return fs.readFileSync(filePath, { encoding: 'utf8' });
    }
    catch {
        console.error(`Could not read file "${fileName}"`);
        return '';
    }
}
exports.readSampleFile = readSampleFile;
function parseText(textToParse, diagSink, parseOptions = new parser_1.ParseOptions()) {
    const parser = new parser_1.Parser();
    return parser.parseSourceFile(textToParse, parseOptions, diagSink);
}
exports.parseText = parseText;
function parseSampleFile(fileName, diagSink, execEnvironment = new configOptions_1.ExecutionEnvironment('python', uriUtils_1.UriEx.file('.'), (0, configOptions_1.getStandardDiagnosticRuleSet)(), 
/* defaultPythonVersion */ undefined, 
/* defaultPythonPlatform */ undefined, 
/* defaultExtraPaths */ undefined)) {
    const text = readSampleFile(fileName);
    const parseOptions = new parser_1.ParseOptions();
    if (fileName.endsWith('pyi')) {
        parseOptions.isStubFile = true;
    }
    parseOptions.pythonVersion = execEnvironment.pythonVersion;
    return parseText(text, diagSink);
}
exports.parseSampleFile = parseSampleFile;
function typeAnalyzeSampleFiles(fileNames, configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.empty()), console) {
    // Always enable "test mode".
    configOptions.internalTestMode = true;
    const tempFile = new realFileSystem_1.RealTempFile();
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile);
    const serviceProvider = (0, serviceProviderExtensions_1.createServiceProvider)(fs, console || new console_1.NullConsole(), tempFile);
    const importResolver = new importResolver_1.ImportResolver(serviceProvider, configOptions, new fullAccessHost_1.FullAccessHost(serviceProvider));
    const program = new program_1.Program(importResolver, configOptions, serviceProvider);
    const fileUris = fileNames.map((name) => uriUtils_1.UriEx.file(resolveSampleFilePath(name)));
    program.setTrackedFiles(fileUris);
    // Set a "pre-check callback" so we can evaluate the types of each NameNode
    // prior to checking the full document. This will exercise the contextual
    // evaluation logic.
    program.setPreCheckCallback((parserOutput, evaluator) => {
        const nameTypeWalker = new testWalker_1.NameTypeWalker(evaluator);
        nameTypeWalker.walk(parserOutput.parseTree);
    });
    const results = getAnalysisResults(program, fileUris, configOptions);
    program.dispose();
    return results;
}
exports.typeAnalyzeSampleFiles = typeAnalyzeSampleFiles;
function getAnalysisResults(program, fileUris, configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.empty())) {
    // Always enable "test mode".
    configOptions.internalTestMode = true;
    while (program.analyze()) {
        // Continue to call analyze until it completes. Since we're not
        // specifying a timeout, it should complete the first time.
    }
    const sourceFiles = fileUris.map((filePath) => program.getSourceFile(filePath));
    return sourceFiles.map((sourceFile, index) => {
        if (sourceFile) {
            const diagnostics = sourceFile.getDiagnostics(configOptions) || [];
            const analysisResult = {
                fileUri: sourceFile.getUri(),
                parseResults: sourceFile.getParseResults(),
                errors: diagnostics.filter((diag) => diag.category === 0 /* DiagnosticCategory.Error */),
                warnings: diagnostics.filter((diag) => diag.category === 1 /* DiagnosticCategory.Warning */),
                infos: diagnostics.filter((diag) => diag.category === 2 /* DiagnosticCategory.Information */),
                unusedCodes: diagnostics.filter((diag) => diag.category === 3 /* DiagnosticCategory.UnusedCode */),
                unreachableCodes: diagnostics.filter((diag) => diag.category === 4 /* DiagnosticCategory.UnreachableCode */),
                deprecateds: diagnostics.filter((diag) => diag.category === 5 /* DiagnosticCategory.Deprecated */),
            };
            return analysisResult;
        }
        else {
            (0, debug_1.fail)(`Source file not found for ${fileUris[index]}`);
            const analysisResult = {
                fileUri: uri_1.Uri.empty(),
                parseResults: undefined,
                errors: [],
                warnings: [],
                infos: [],
                unusedCodes: [],
                unreachableCodes: [],
                deprecateds: [],
            };
            return analysisResult;
        }
    });
}
exports.getAnalysisResults = getAnalysisResults;
function printDiagnostics(fileResults) {
    if (fileResults.errors.length > 0) {
        console.error(`Errors in ${fileResults.fileUri}:`);
        for (const diag of fileResults.errors) {
            console.error(`  ${diag.message}`);
        }
    }
    if (fileResults.warnings.length > 0) {
        console.error(`Warnings in ${fileResults.fileUri}:`);
        for (const diag of fileResults.warnings) {
            console.error(`  ${diag.message}`);
        }
    }
}
exports.printDiagnostics = printDiagnostics;
function validateResults(results, errorCount, warningCount = 0, infoCount, unusedCode, unreachableCode, deprecated) {
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].errors.length, errorCount);
    assert.strictEqual(results[0].warnings.length, warningCount);
    if (infoCount !== undefined) {
        assert.strictEqual(results[0].infos.length, infoCount);
    }
    if (unusedCode !== undefined) {
        assert.strictEqual(results[0].unusedCodes.length, unusedCode);
    }
    if (unreachableCode !== undefined) {
        assert.strictEqual(results[0].unreachableCodes.length, unreachableCode);
    }
    if (deprecated !== undefined) {
        assert.strictEqual(results[0].deprecateds.length, deprecated);
    }
}
exports.validateResults = validateResults;
//# sourceMappingURL=testUtils.js.map