"use strict";
/*
 * logger.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for logger.
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
const assert = __importStar(require("assert"));
const configOptions_1 = require("../common/configOptions");
const console_1 = require("../common/console");
const core_1 = require("../common/core");
const timing_1 = require("../common/timing");
const TestUtils = __importStar(require("./testUtils"));
const uri_1 = require("../common/uri/uri");
class TestConsole {
    constructor() {
        this.errors = [];
        this.warnings = [];
        this.infos = [];
        this.logs = [];
    }
    error(message) {
        this.errors.push(message);
    }
    warn(message) {
        this.warnings.push(message);
    }
    info(message) {
        this.infos.push(message);
    }
    log(message) {
        this.logs.push(message);
    }
    clear() {
        this.logs = [];
        this.errors = [];
        this.warnings = [];
        this.infos = [];
    }
}
describe('TypeEvaluatorWithTracker tests', () => {
    const consoleInterface = new TestConsole();
    const console = new console_1.ConsoleWithLogLevel(consoleInterface);
    const config = new configOptions_1.ConfigOptions(uri_1.Uri.empty());
    beforeEach(() => {
        consoleInterface.clear();
    });
    afterEach(() => {
        consoleInterface.clear();
        timing_1.timingStats.typeEvaluationTime.callCount = 0;
    });
    test('Log generated', () => {
        config.logTypeEvaluationTime = true;
        console.level = console_1.LogLevel.Log;
        TestUtils.typeAnalyzeSampleFiles(['badToken1.py'], config, console);
        assert.ok(consoleInterface.logs.length > 10, `No calls logged`);
    });
    test('Log not generated when level is error', () => {
        config.logTypeEvaluationTime = true;
        console.level = console_1.LogLevel.Error;
        TestUtils.typeAnalyzeSampleFiles(['badToken1.py'], config, console);
        assert.equal(consoleInterface.logs.length, 0, `Should not have any logs when logging level is error`);
    });
    test('Inner log not generated when eval is turned off', () => {
        config.logTypeEvaluationTime = false;
        console.level = console_1.LogLevel.Log;
        TestUtils.typeAnalyzeSampleFiles(['badToken1.py'], config, console);
        assert.equal(consoleInterface.logs.some((s) => s.includes('evaluateTypesForStatement')), false, `Inner evaluateTypesForStatement is being logged when it shouldnt`);
        assert.ok(timing_1.timingStats.typeEvaluationTime.callCount > 1, `Should be tracking timing when not logging but not debugging`);
    });
    test('Timing is not captured in debug mode', () => {
        const oldValue = (0, core_1.test_setDebugMode)(true);
        config.logTypeEvaluationTime = false;
        console.level = console_1.LogLevel.Log;
        TestUtils.typeAnalyzeSampleFiles(['badToken1.py'], config, console);
        assert.equal(timing_1.timingStats.typeEvaluationTime.callCount, 0, `Should not be tracking call counts when debugging`);
        (0, core_1.test_setDebugMode)(oldValue);
    });
});
//# sourceMappingURL=logger.test.js.map