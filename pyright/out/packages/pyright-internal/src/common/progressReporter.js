"use strict";
/*
 * progressReporter.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Implements a mechanism for reporting progress in a language server client.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressReportTracker = void 0;
class ProgressReportTracker {
    constructor(_reporter) {
        this._reporter = _reporter;
        // Tracks whether we're currently displaying progress.
        this._isDisplayingProgress = false;
    }
    isEnabled(data) {
        var _a;
        if (this._isDisplayingProgress) {
            return true;
        }
        return (_a = this._reporter.isEnabled(data)) !== null && _a !== void 0 ? _a : false;
    }
    begin() {
        if (this._isDisplayingProgress) {
            return;
        }
        this._isDisplayingProgress = true;
        this._reporter.begin();
    }
    report(message) {
        if (!this._isDisplayingProgress) {
            return;
        }
        this._reporter.report(message);
    }
    end() {
        if (!this._isDisplayingProgress) {
            return;
        }
        this._isDisplayingProgress = false;
        this._reporter.end();
    }
}
exports.ProgressReportTracker = ProgressReportTracker;
//# sourceMappingURL=progressReporter.js.map