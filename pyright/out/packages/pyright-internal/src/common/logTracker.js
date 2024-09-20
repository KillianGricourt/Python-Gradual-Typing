"use strict";
/*
 * logTracker.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * A simple logging class that can be used to track nested loggings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogTracker = exports.getPathForLogging = void 0;
const console_1 = require("./console");
const timing_1 = require("./timing");
// Consider an operation "long running" if it goes longer than this.
const durationThresholdForInfoInMs = 2000;
function getPathForLogging(fs, fileUri) {
    if (fs.isMappedUri(fileUri)) {
        return fs.getOriginalUri(fileUri);
    }
    return fileUri;
}
exports.getPathForLogging = getPathForLogging;
class LogTracker {
    constructor(_console, prefix) {
        this._console = _console;
        this.prefix = prefix;
        this._dummyState = new State();
        this._previousTitles = [];
        this._indentation = '';
        // Empty
    }
    get logLevel() {
        const level = this._console.level;
        return level !== null && level !== void 0 ? level : console_1.LogLevel.Error;
    }
    log(title, callback, minimalDuration = -1, logParsingPerf = false) {
        // If no console is given, don't do anything.
        if (this._console === undefined) {
            return callback(this._dummyState);
        }
        // This is enabled only when level is LogLevel.Log or does not exist.
        const level = this._console.level;
        if (level === undefined || (level !== console_1.LogLevel.Log && level !== console_1.LogLevel.Info)) {
            return callback(this._dummyState);
        }
        // Since this is only used when LogLevel.Log or LogLevel.Info is set or BG,
        // we don't care much about extra logging cost.
        const current = this._indentation;
        this._previousTitles.push(`${current}${title} ...`);
        this._indentation += '  ';
        const state = new State();
        try {
            return callback(state);
        }
        finally {
            const msDuration = state.duration;
            this._indentation = current;
            // if we already printed our header (by nested calls), then it can't be skipped.
            if (this._previousTitles.length > 0 && (state.isSuppressed() || msDuration <= minimalDuration)) {
                // Get rid of myself so we don't even show header.
                this._previousTitles.pop();
            }
            else {
                this._printPreviousTitles();
                let output = `[${this.prefix}] ${this._indentation}${title}${state.get()} (${msDuration}ms)`;
                // Report parsing related perf info only if they occurred.
                if (logParsingPerf &&
                    state.fileReadTotal +
                        state.tokenizeTotal +
                        state.parsingTotal +
                        state.resolveImportsTotal +
                        state.bindingTotal >
                        0) {
                    output += ` [f:${state.fileReadTotal}, t:${state.tokenizeTotal}, p:${state.parsingTotal}, i:${state.resolveImportsTotal}, b:${state.bindingTotal}]`;
                }
                this._console.log(output);
                // If the operation took really long, log it as "info" so it is more visible.
                if (msDuration >= durationThresholdForInfoInMs) {
                    this._console.info(`[${this.prefix}] Long operation: ${title} (${msDuration}ms)`);
                }
            }
        }
    }
    _printPreviousTitles() {
        // Get rid of myself
        this._previousTitles.pop();
        if (this._previousTitles.length <= 0) {
            return;
        }
        for (const previousTitle of this._previousTitles) {
            this._console.log(`[${this.prefix}] ${previousTitle}`);
        }
        this._previousTitles.length = 0;
    }
}
exports.LogTracker = LogTracker;
class State {
    constructor() {
        this._start = new timing_1.Duration();
        this._startFile = timing_1.timingStats.readFileTime.totalTime;
        this._startToken = timing_1.timingStats.tokenizeFileTime.totalTime;
        this._startParse = timing_1.timingStats.parseFileTime.totalTime;
        this._startImport = timing_1.timingStats.resolveImportsTime.totalTime;
        this._startBind = timing_1.timingStats.bindTime.totalTime;
    }
    get duration() {
        return this._start.getDurationInMilliseconds();
    }
    get fileReadTotal() {
        return timing_1.timingStats.readFileTime.totalTime - this._startFile;
    }
    get tokenizeTotal() {
        return timing_1.timingStats.tokenizeFileTime.totalTime - this._startToken;
    }
    get parsingTotal() {
        return timing_1.timingStats.parseFileTime.totalTime - this._startParse;
    }
    get resolveImportsTotal() {
        return timing_1.timingStats.resolveImportsTime.totalTime - this._startImport;
    }
    get bindingTotal() {
        return timing_1.timingStats.bindTime.totalTime - this._startBind;
    }
    add(addendum) {
        if (addendum) {
            this._addendum = addendum;
        }
    }
    get() {
        if (this._addendum) {
            return ` [${this._addendum}]`;
        }
        return '';
    }
    suppress() {
        this._suppress = true;
    }
    isSuppressed() {
        return !!this._suppress;
    }
}
//# sourceMappingURL=logTracker.js.map