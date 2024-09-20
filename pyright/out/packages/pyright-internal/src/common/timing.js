"use strict";
/*
 * timing.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A simple duration class that can be used to record and report
 * durations at the millisecond level of resolution.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.timingStats = exports.TimingStats = exports.TimingStat = exports.Duration = void 0;
class Duration {
    constructor() {
        this._startTime = Date.now();
    }
    getDurationInMilliseconds() {
        const curTime = Date.now();
        return curTime - this._startTime;
    }
    getDurationInSeconds() {
        return this.getDurationInMilliseconds() / 1000;
    }
}
exports.Duration = Duration;
class TimingStat {
    constructor() {
        this.totalTime = 0;
        this.callCount = 0;
        this.isTiming = false;
    }
    timeOperation(callback, ...args) {
        this.callCount++;
        // Handle reentrancy.
        if (this.isTiming) {
            return callback(...args);
        }
        else {
            this.isTiming = true;
            const duration = new Duration();
            const result = callback(...args);
            this.totalTime += duration.getDurationInMilliseconds();
            this.isTiming = false;
            return result;
        }
    }
    subtractFromTime(callback) {
        if (this.isTiming) {
            this.isTiming = false;
            const duration = new Duration();
            callback();
            this.totalTime -= duration.getDurationInMilliseconds();
            this.isTiming = true;
        }
        else {
            callback();
        }
    }
    printTime() {
        const totalTimeInSec = this.totalTime / 1000;
        const roundedTime = Math.round(totalTimeInSec * 100) / 100;
        return roundedTime.toString() + 'sec';
    }
}
exports.TimingStat = TimingStat;
class TimingStats {
    constructor() {
        this.totalDuration = new Duration();
        this.findFilesTime = new TimingStat();
        this.readFileTime = new TimingStat();
        this.tokenizeFileTime = new TimingStat();
        this.parseFileTime = new TimingStat();
        this.resolveImportsTime = new TimingStat();
        this.cycleDetectionTime = new TimingStat();
        this.bindTime = new TimingStat();
        this.typeCheckerTime = new TimingStat();
        this.typeEvaluationTime = new TimingStat();
    }
    printSummary(console) {
        console.info(`Completed in ${this.totalDuration.getDurationInSeconds()}sec`);
    }
    printDetails(console) {
        console.info('');
        console.info('Timing stats');
        console.info('Find Source Files:    ' + this.findFilesTime.printTime());
        console.info('Read Source Files:    ' + this.readFileTime.printTime());
        console.info('Tokenize:             ' + this.tokenizeFileTime.printTime());
        console.info('Parse:                ' + this.parseFileTime.printTime());
        console.info('Resolve Imports:      ' + this.resolveImportsTime.printTime());
        console.info('Bind:                 ' + this.bindTime.printTime());
        console.info('Check:                ' + this.typeCheckerTime.printTime());
        console.info('Detect Cycles:        ' + this.cycleDetectionTime.printTime());
    }
    getTotalDuration() {
        return this.totalDuration.getDurationInSeconds();
    }
}
exports.TimingStats = TimingStats;
exports.timingStats = new TimingStats();
//# sourceMappingURL=timing.js.map