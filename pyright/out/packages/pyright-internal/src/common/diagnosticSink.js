"use strict";
/*
 * diagnostics.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Class that collects and deduplicates diagnostics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextRangeDiagnosticSink = exports.DiagnosticSink = exports.FileDiagnostics = void 0;
const collectionUtils_1 = require("./collectionUtils");
const diagnostic_1 = require("./diagnostic");
const positionUtils_1 = require("./positionUtils");
const stringUtils_1 = require("./stringUtils");
const uri_1 = require("./uri/uri");
var FileDiagnostics;
(function (FileDiagnostics) {
    function toJsonObj(fileDiag) {
        return {
            fileUri: fileDiag.fileUri.toJsonObj(),
            version: fileDiag.version,
            diagnostics: fileDiag.diagnostics.map((d) => d.toJsonObj()),
        };
    }
    FileDiagnostics.toJsonObj = toJsonObj;
    function fromJsonObj(fileDiagObj) {
        return {
            fileUri: uri_1.Uri.fromJsonObj(fileDiagObj.fileUri),
            version: fileDiagObj.version,
            diagnostics: fileDiagObj.diagnostics.map((d) => diagnostic_1.Diagnostic.fromJsonObj(d)),
        };
    }
    FileDiagnostics.fromJsonObj = fromJsonObj;
})(FileDiagnostics || (exports.FileDiagnostics = FileDiagnostics = {}));
// Creates and tracks a list of diagnostics.
class DiagnosticSink {
    constructor(diagnostics) {
        this._diagnosticList = diagnostics || [];
        this._diagnosticMap = new Map();
    }
    fetchAndClear() {
        const prevDiagnostics = this._diagnosticList;
        this._diagnosticList = [];
        this._diagnosticMap.clear();
        return prevDiagnostics;
    }
    addError(message, range) {
        return this.addDiagnostic(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, message, range));
    }
    addWarning(message, range) {
        return this.addDiagnostic(new diagnostic_1.Diagnostic(1 /* DiagnosticCategory.Warning */, message, range));
    }
    addInformation(message, range) {
        return this.addDiagnostic(new diagnostic_1.Diagnostic(2 /* DiagnosticCategory.Information */, message, range));
    }
    addUnusedCode(message, range, action) {
        const diag = new diagnostic_1.Diagnostic(3 /* DiagnosticCategory.UnusedCode */, message, range);
        if (action) {
            diag.addAction(action);
        }
        return this.addDiagnostic(diag);
    }
    addUnreachableCode(message, range, action) {
        const diag = new diagnostic_1.Diagnostic(4 /* DiagnosticCategory.UnreachableCode */, message, range);
        if (action) {
            diag.addAction(action);
        }
        return this.addDiagnostic(diag);
    }
    addDeprecated(message, range, action) {
        const diag = new diagnostic_1.Diagnostic(5 /* DiagnosticCategory.Deprecated */, message, range);
        if (action) {
            diag.addAction(action);
        }
        return this.addDiagnostic(diag);
    }
    addDiagnostic(diag) {
        // Create a unique key for the diagnostic to prevent
        // adding duplicates.
        const key = `${diag.range.start.line},${diag.range.start.character}-` +
            `${diag.range.end.line}-${diag.range.end.character}:${(0, stringUtils_1.hashString)(diag.message)}}`;
        if (!this._diagnosticMap.has(key)) {
            this._diagnosticList.push(diag);
            this._diagnosticMap.set(key, diag);
        }
        return diag;
    }
    addDiagnostics(diagsToAdd) {
        (0, collectionUtils_1.appendArray)(this._diagnosticList, diagsToAdd);
    }
    getErrors() {
        return this._diagnosticList.filter((diag) => diag.category === 0 /* DiagnosticCategory.Error */);
    }
    getWarnings() {
        return this._diagnosticList.filter((diag) => diag.category === 1 /* DiagnosticCategory.Warning */);
    }
    getInformation() {
        return this._diagnosticList.filter((diag) => diag.category === 2 /* DiagnosticCategory.Information */);
    }
    getUnusedCode() {
        return this._diagnosticList.filter((diag) => diag.category === 3 /* DiagnosticCategory.UnusedCode */);
    }
    getUnreachableCode() {
        return this._diagnosticList.filter((diag) => diag.category === 4 /* DiagnosticCategory.UnreachableCode */);
    }
    getDeprecated() {
        return this._diagnosticList.filter((diag) => diag.category === 5 /* DiagnosticCategory.Deprecated */);
    }
}
exports.DiagnosticSink = DiagnosticSink;
// Specialized version of DiagnosticSink that works with TextRange objects
// and converts text ranges to line and column numbers.
class TextRangeDiagnosticSink extends DiagnosticSink {
    constructor(lines, diagnostics) {
        super(diagnostics);
        this._lines = lines;
    }
    addDiagnosticWithTextRange(level, message, range) {
        const positionRange = (0, positionUtils_1.convertOffsetsToRange)(range.start, range.start + range.length, this._lines);
        switch (level) {
            case 'error':
                return this.addError(message, positionRange);
            case 'warning':
                return this.addWarning(message, positionRange);
            case 'information':
                return this.addInformation(message, positionRange);
            default:
                throw new Error(`${level} is not expected value`);
        }
    }
    addUnusedCodeWithTextRange(message, range, action) {
        return this.addUnusedCode(message, (0, positionUtils_1.convertOffsetsToRange)(range.start, range.start + range.length, this._lines), action);
    }
    addUnreachableCodeWithTextRange(message, range, action) {
        return this.addUnreachableCode(message, (0, positionUtils_1.convertOffsetsToRange)(range.start, range.start + range.length, this._lines), action);
    }
    addDeprecatedWithTextRange(message, range, action) {
        return this.addDeprecated(message, (0, positionUtils_1.convertOffsetsToRange)(range.start, range.start + range.length, this._lines), action);
    }
}
exports.TextRangeDiagnosticSink = TextRangeDiagnosticSink;
//# sourceMappingURL=diagnosticSink.js.map