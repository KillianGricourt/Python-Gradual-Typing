"use strict";
/*
 * commandLineOptions.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Class that holds the command-line options (those that can be
 * passed into the main entry point of the command-line version
 * of the analyzer).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandLineOptions = exports.getDiagnosticSeverityOverrides = void 0;
function getDiagnosticSeverityOverrides() {
    return [
        "error" /* DiagnosticSeverityOverrides.Error */,
        "warning" /* DiagnosticSeverityOverrides.Warning */,
        "information" /* DiagnosticSeverityOverrides.Information */,
        "none" /* DiagnosticSeverityOverrides.None */,
    ];
}
exports.getDiagnosticSeverityOverrides = getDiagnosticSeverityOverrides;
// Some options can be specified from a source other than the pyright config file.
// This can be from command-line parameters or some other settings mechanism, like
// that provided through a language client like the VS Code editor. These options
// are later combined with those from the config file to produce the final configuration.
class CommandLineOptions {
    constructor(executionRoot, fromVsCodeExtension) {
        // A list of file specs to include in the analysis. Can contain
        // directories, in which case all "*.py" files within those directories
        // are included.
        this.includeFileSpecs = [];
        // A list of file specs to exclude in the analysis. Can contain
        // directories, in which case all "*.py" files within those directories
        // are excluded.
        this.excludeFileSpecs = [];
        // A list of file specs whose errors and warnings should be ignored even
        // if they are included in the transitive closure of included files.
        this.ignoreFileSpecs = [];
        // Use type evaluator call tracking.
        this.logTypeEvaluationTime = false;
        // Minimum threshold for type eval logging.
        this.typeEvaluationTimeThreshold = 50;
        // Run ambient analysis.
        this.enableAmbientAnalysis = true;
        this.executionRoot = executionRoot;
        this.fromVsCodeExtension = fromVsCodeExtension;
    }
}
exports.CommandLineOptions = CommandLineOptions;
//# sourceMappingURL=commandLineOptions.js.map