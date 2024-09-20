"use strict";
/*
 * pythonLanguageVersion.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Types and functions that relate to the Python language version.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.latestStablePythonVersion = exports.pythonVersion3_14 = exports.pythonVersion3_13 = exports.pythonVersion3_12 = exports.pythonVersion3_11 = exports.pythonVersion3_10 = exports.pythonVersion3_9 = exports.pythonVersion3_8 = exports.pythonVersion3_7 = exports.pythonVersion3_6 = exports.pythonVersion3_5 = exports.pythonVersion3_4 = exports.pythonVersion3_3 = exports.pythonVersion3_2 = exports.pythonVersion3_1 = exports.pythonVersion3_0 = exports.PythonVersion = void 0;
class PythonVersion {
    constructor(_major, _minor, _micro, _releaseLevel, _serial) {
        this._major = _major;
        this._minor = _minor;
        this._micro = _micro;
        this._releaseLevel = _releaseLevel;
        this._serial = _serial;
    }
    get major() {
        return this._major;
    }
    get minor() {
        return this._minor;
    }
    get micro() {
        return this._micro;
    }
    get releaseLevel() {
        return this._releaseLevel;
    }
    get serial() {
        return this._serial;
    }
    isEqualTo(other) {
        if (this.major !== other.major || this.minor !== other.minor) {
            return false;
        }
        if (this._micro === undefined || other._micro === undefined) {
            return true;
        }
        else if (this._micro !== other._micro) {
            return false;
        }
        if (this._releaseLevel === undefined || other._releaseLevel === undefined) {
            return true;
        }
        else if (this._releaseLevel !== other._releaseLevel) {
            return false;
        }
        if (this._serial === undefined || other._serial === undefined) {
            return true;
        }
        else if (this._serial !== other._serial) {
            return false;
        }
        return true;
    }
    isGreaterThan(other) {
        if (this.major > other.major) {
            return true;
        }
        else if (this.major < other.major) {
            return false;
        }
        if (this.minor > other.minor) {
            return true;
        }
        else if (this.minor < other.minor) {
            return false;
        }
        if (this._micro === undefined || other._micro === undefined || this._micro < other._micro) {
            return false;
        }
        else if (this._micro > other._micro) {
            return true;
        }
        // We leverage the fact that the alphabetical ordering
        // of the release level designators are ordered by increasing
        // release level.
        if (this._releaseLevel === undefined ||
            other._releaseLevel === undefined ||
            this._releaseLevel < other._releaseLevel) {
            return false;
        }
        else if (this._releaseLevel > other._releaseLevel) {
            return true;
        }
        if (this._serial === undefined || other._serial === undefined || this._serial < other._serial) {
            return false;
        }
        else if (this._serial > other._serial) {
            return true;
        }
        // They are exactly equal!
        return false;
    }
    isGreaterOrEqualTo(other) {
        return this.isEqualTo(other) || this.isGreaterThan(other);
    }
    isLessThan(other) {
        return !this.isGreaterOrEqualTo(other);
    }
    isLessOrEqualTo(other) {
        return !this.isGreaterThan(other);
    }
    toMajorMinorString() {
        return `${this._major}.${this._minor}`;
    }
    toString() {
        let version = this.toMajorMinorString();
        if (this._micro === undefined) {
            return version;
        }
        version += `.${this._micro}`;
        if (this._releaseLevel === undefined) {
            return version;
        }
        version += `.${this._releaseLevel}`;
        if (this._serial === undefined) {
            return version;
        }
        version += `.${this._serial}`;
        return version;
    }
    static fromString(val) {
        const split = val.split('.');
        if (split.length < 2) {
            return undefined;
        }
        const major = parseInt(split[0], 10);
        const minor = parseInt(split[1], 10);
        if (isNaN(major) || isNaN(minor)) {
            return undefined;
        }
        let micro;
        if (split.length >= 3) {
            micro = parseInt(split[2], 10);
            if (isNaN(micro)) {
                micro = undefined;
            }
        }
        let releaseLevel;
        if (split.length >= 4) {
            const releaseLevels = ['alpha', 'beta', 'candidate', 'final'];
            if (releaseLevels.some((level) => level === split[3])) {
                releaseLevel = split[3];
            }
        }
        let serial;
        if (split.length >= 5) {
            serial = parseInt(split[4], 10);
            if (isNaN(serial)) {
                serial = undefined;
            }
        }
        return new PythonVersion(major, minor, micro, releaseLevel, serial);
    }
}
exports.PythonVersion = PythonVersion;
// Predefine some versions.
exports.pythonVersion3_0 = new PythonVersion(3, 0);
exports.pythonVersion3_1 = new PythonVersion(3, 1);
exports.pythonVersion3_2 = new PythonVersion(3, 2);
exports.pythonVersion3_3 = new PythonVersion(3, 3);
exports.pythonVersion3_4 = new PythonVersion(3, 4);
exports.pythonVersion3_5 = new PythonVersion(3, 5);
exports.pythonVersion3_6 = new PythonVersion(3, 6);
exports.pythonVersion3_7 = new PythonVersion(3, 7);
exports.pythonVersion3_8 = new PythonVersion(3, 8);
exports.pythonVersion3_9 = new PythonVersion(3, 9);
exports.pythonVersion3_10 = new PythonVersion(3, 10);
exports.pythonVersion3_11 = new PythonVersion(3, 11);
exports.pythonVersion3_12 = new PythonVersion(3, 12);
exports.pythonVersion3_13 = new PythonVersion(3, 13);
exports.pythonVersion3_14 = new PythonVersion(3, 14);
exports.latestStablePythonVersion = exports.pythonVersion3_12;
//# sourceMappingURL=pythonVersion.js.map