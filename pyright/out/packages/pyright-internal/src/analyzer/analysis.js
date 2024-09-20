"use strict";
/*
 * analysis.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Various analysis helper types and functions
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
exports.analyzeProgram = exports.nullCallback = void 0;
const cancellationUtils_1 = require("../common/cancellationUtils");
const debug = __importStar(require("../common/debug"));
const timing_1 = require("../common/timing");
const nullCallback = () => {
    /* empty */
};
exports.nullCallback = nullCallback;
function analyzeProgram(program, maxTime, configOptions, callback, console, token) {
    let moreToAnalyze = false;
    callback = callback !== null && callback !== void 0 ? callback : exports.nullCallback;
    try {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const duration = new timing_1.Duration();
        moreToAnalyze = program.analyze(maxTime, token);
        const requiringAnalysisCount = program.getFilesToAnalyzeCount();
        // If we're using command-line mode, the maxTime will be undefined, and we'll
        // want to report all diagnostics rather than just the ones that have changed.
        const reportDiagnosticDeltasOnly = maxTime !== undefined;
        const diagnostics = program.getDiagnostics(configOptions, reportDiagnosticDeltasOnly);
        const diagnosticFileCount = diagnostics.length;
        const elapsedTime = duration.getDurationInSeconds();
        // Report any diagnostics or completion.
        if (diagnosticFileCount > 0 || !moreToAnalyze) {
            callback({
                diagnostics,
                filesInProgram: program.getFileCount(),
                requiringAnalysisCount: requiringAnalysisCount,
                checkingOnlyOpenFiles: program.isCheckingOnlyOpenFiles(),
                fatalErrorOccurred: false,
                configParseErrorOccurred: false,
                elapsedTime,
            });
        }
    }
    catch (e) {
        if (cancellationUtils_1.OperationCanceledException.is(e)) {
            return false;
        }
        const message = debug.getErrorString(e);
        console.error('Error performing analysis: ' + message);
        callback({
            diagnostics: [],
            filesInProgram: 0,
            requiringAnalysisCount: { files: 0, cells: 0 },
            checkingOnlyOpenFiles: true,
            fatalErrorOccurred: true,
            configParseErrorOccurred: false,
            elapsedTime: 0,
            error: debug.getSerializableError(e),
        });
    }
    return moreToAnalyze;
}
exports.analyzeProgram = analyzeProgram;
//# sourceMappingURL=analysis.js.map