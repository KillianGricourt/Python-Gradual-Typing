"use strict";
/*
 * typeEvaluatorWithTracker.ts
 *
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Wraps type evaluator to track performance of internal calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTypeEvaluatorWithTracker = void 0;
const console_1 = require("../common/console");
const core_1 = require("../common/core");
const timing_1 = require("../common/timing");
const typeEvaluator_1 = require("./typeEvaluator");
// We don't want to track calls from the type evaluator itself, but only entry points.
function createTypeEvaluatorWithTracker(importLookup, evaluatorOptions, logger, printer) {
    function wrapWithLogger(func) {
        // Wrap the function only if told to do so and the log level is high
        // enough for it to log something.
        if (evaluatorOptions.logCalls && logger.logLevel === console_1.LogLevel.Log) {
            return (...args) => {
                return logger.log(func.name, (s) => {
                    if (func.name === 'importLookup' && args.length > 0) {
                        // This is actually a filename, so special case it.
                        s.add(printer === null || printer === void 0 ? void 0 : printer.printFileOrModuleName(args[0]));
                    }
                    else {
                        // Print all parameters.
                        args.forEach((a) => {
                            s.add(printer === null || printer === void 0 ? void 0 : printer.print(a));
                        });
                    }
                    return timing_1.timingStats.typeEvaluationTime.timeOperation(func, ...args);
                }, evaluatorOptions.minimumLoggingThreshold, 
                /* logParsingPerf */ true);
            };
        }
        else if (!(0, core_1.isDebugMode)()) {
            return timing_1.timingStats.typeEvaluationTime.timeOperation.bind(timing_1.timingStats.typeEvaluationTime, func);
        }
        else {
            return func;
        }
    }
    // Wrap all functions with either a logger or a timer.
    importLookup = wrapWithLogger(importLookup);
    const evaluator = (0, typeEvaluator_1.createTypeEvaluator)(importLookup, evaluatorOptions, wrapWithLogger);
    // Track these apis external usages when logging is on. otherwise, it should be noop.
    const keys = Object.keys(evaluator);
    keys.forEach((k) => {
        const entry = evaluator[k];
        if (typeof entry === 'function' && entry.name) {
            // Only wrap functions that aren't wrapped already.
            evaluator[k] = wrapWithLogger(entry);
        }
    });
    return evaluator;
}
exports.createTypeEvaluatorWithTracker = createTypeEvaluatorWithTracker;
//# sourceMappingURL=typeEvaluatorWithTracker.js.map