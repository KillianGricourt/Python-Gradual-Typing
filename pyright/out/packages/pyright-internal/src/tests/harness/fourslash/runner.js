"use strict";
/*
 * runner.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Provide APIs to run fourslash tests from provided fourslash markup contents
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
exports.runFourSlashTestContent = exports.runFourSlashTest = void 0;
const ts = __importStar(require("typescript"));
const pathUtils_1 = require("../../../common/pathUtils");
const host = __importStar(require("../testHost"));
const fourSlashParser_1 = require("./fourSlashParser");
const testState_1 = require("./testState");
const testState_Consts_1 = require("./testState.Consts");
/**
 * run given fourslash test file
 *
 * @param basePath this is used as a base path of the virtual file system the test will run upon
 * @param fileName this is the file path where fourslash test file will be read from
 */
function runFourSlashTest(basePath, fileName, cb, mountPaths, hostSpecificFeatures, testStateFactory) {
    const content = host.HOST.readFile(fileName);
    runFourSlashTestContent(basePath, fileName, content, cb, mountPaths, hostSpecificFeatures, testStateFactory);
}
exports.runFourSlashTest = runFourSlashTest;
/**
 * run given fourslash markup content
 *
 * @param basePath  this is used as a base path of the virtual file system the test will run upon
 * @param fileName this will be used as a filename of the given `content` in the virtual file system
 *                 if fourslash markup `content` doesn't have explicit `@filename` option
 * @param content  this is fourslash markup string
 */
function runFourSlashTestContent(basePath, fileName, content, cb, mountPaths, hostSpecificFeatures, testStateFactory) {
    // give file paths an absolute path for the virtual file system
    const absoluteBasePath = (0, pathUtils_1.combinePaths)('/', basePath);
    const absoluteFileName = (0, pathUtils_1.combinePaths)('/', fileName);
    // parse out the files and their metadata
    const testData = (0, fourSlashParser_1.parseTestData)(absoluteBasePath, content, absoluteFileName);
    const state = testStateFactory !== undefined
        ? testStateFactory(absoluteBasePath, testData, mountPaths, hostSpecificFeatures)
        : new testState_1.TestState(absoluteBasePath, testData, mountPaths, hostSpecificFeatures);
    const output = ts.transpileModule(content, {
        reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2019 },
    });
    if (output.diagnostics.length > 0) {
        throw new Error(`Syntax error in ${absoluteBasePath}: ${output.diagnostics[0].messageText}`);
    }
    runCode(output.outputText, state, cb);
}
exports.runFourSlashTestContent = runFourSlashTestContent;
async function runCode(code, state, cb) {
    // Compile and execute the test
    try {
        const wrappedCode = `(async function(helper, Consts) {
${code}
})`;
        const f = eval(wrappedCode); // CodeQL [SM01632] test code that doesn't need to be secure.
        await f(state, testState_Consts_1.Consts);
        markDone();
    }
    catch (ex) {
        markDone(ex);
    }
    function markDone(...args) {
        if (cb) {
            cb(...args);
        }
        state.dispose();
    }
}
//# sourceMappingURL=runner.js.map