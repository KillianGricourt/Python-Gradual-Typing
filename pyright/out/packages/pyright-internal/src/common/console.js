"use strict";
/*
 * console.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides an abstraction for console logging and error-reporting
 * methods.
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
exports.convertLogLevel = exports.log = exports.ConsoleWithLogLevel = exports.Chainable = exports.StderrConsole = exports.StandardConsole = exports.NullConsole = exports.getLevelNumber = exports.ConsoleInterface = exports.LogLevel = void 0;
const debug = __importStar(require("./debug"));
const collectionUtils_1 = require("./collectionUtils");
var LogLevel;
(function (LogLevel) {
    LogLevel["Error"] = "error";
    LogLevel["Warn"] = "warn";
    LogLevel["Info"] = "info";
    LogLevel["Log"] = "log";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var ConsoleInterface;
(function (ConsoleInterface) {
    function is(obj) {
        return obj.error !== undefined && obj.warn !== undefined && obj.info !== undefined && obj.log !== undefined;
    }
    ConsoleInterface.is = is;
    function hasLevel(console) {
        return is(console) && 'level' in console;
    }
    ConsoleInterface.hasLevel = hasLevel;
})(ConsoleInterface || (exports.ConsoleInterface = ConsoleInterface = {}));
const levelMap = new Map([
    [LogLevel.Error, 0],
    [LogLevel.Warn, 1],
    [LogLevel.Info, 2],
    [LogLevel.Log, 3],
]);
function getLevelNumber(level) {
    var _a;
    return (_a = levelMap.get(level)) !== null && _a !== void 0 ? _a : 3;
}
exports.getLevelNumber = getLevelNumber;
// Avoids outputting errors to the console but counts
// the number of logs and errors, which can be useful
// for unit tests.
class NullConsole {
    constructor() {
        this.logCount = 0;
        this.infoCount = 0;
        this.warnCount = 0;
        this.errorCount = 0;
    }
    log(message) {
        this.logCount++;
    }
    info(message) {
        this.infoCount++;
    }
    warn(message) {
        this.warnCount++;
    }
    error(message) {
        this.errorCount++;
    }
}
exports.NullConsole = NullConsole;
class StandardConsole {
    constructor(_maxLevel = LogLevel.Log) {
        this._maxLevel = _maxLevel;
    }
    get level() {
        return this._maxLevel;
    }
    log(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Log)) {
            console.log(message);
        }
    }
    info(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Info)) {
            console.info(message);
        }
    }
    warn(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Warn)) {
            console.warn(message);
        }
    }
    error(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Error)) {
            console.error(message);
        }
    }
}
exports.StandardConsole = StandardConsole;
class StderrConsole {
    constructor(_maxLevel = LogLevel.Log) {
        this._maxLevel = _maxLevel;
    }
    get level() {
        return this._maxLevel;
    }
    log(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Log)) {
            console.error(message);
        }
    }
    info(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Info)) {
            console.error(message);
        }
    }
    warn(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Warn)) {
            console.error(message);
        }
    }
    error(message) {
        if (getLevelNumber(this._maxLevel) >= getLevelNumber(LogLevel.Error)) {
            console.error(message);
        }
    }
}
exports.StderrConsole = StderrConsole;
var Chainable;
(function (Chainable) {
    function is(value) {
        return value && value.addChain && value.removeChain;
    }
    Chainable.is = is;
})(Chainable || (exports.Chainable = Chainable = {}));
class ConsoleWithLogLevel {
    constructor(_console, _name = '') {
        this._console = _console;
        this._name = _name;
        this._chains = [];
        this._maxLevel = 2;
        this._disposed = false;
    }
    get level() {
        switch (this._maxLevel) {
            case 0:
                return LogLevel.Error;
            case 1:
                return LogLevel.Warn;
            case 2:
                return LogLevel.Info;
        }
        return LogLevel.Log;
    }
    set level(value) {
        let maxLevel = getLevelNumber(value);
        if (maxLevel === undefined) {
            maxLevel = getLevelNumber(LogLevel.Info);
        }
        this._maxLevel = maxLevel;
    }
    dispose() {
        this._disposed = true;
    }
    error(message) {
        this._log(LogLevel.Error, `${this._prefix}${message}`);
    }
    warn(message) {
        this._log(LogLevel.Warn, `${this._prefix}${message}`);
    }
    info(message) {
        this._log(LogLevel.Info, `${this._prefix}${message}`);
    }
    log(message) {
        this._log(LogLevel.Log, `${this._prefix}${message}`);
    }
    addChain(console) {
        (0, collectionUtils_1.addIfUnique)(this._chains, console);
    }
    removeChain(console) {
        (0, collectionUtils_1.removeArrayElements)(this._chains, (i) => i === console);
    }
    get _prefix() {
        return this._name ? `(${this._name}) ` : '';
    }
    _log(level, message) {
        if (this._disposed) {
            return;
        }
        this._processChains(level, message);
        if (this._getNumericalLevel(level) > this._maxLevel) {
            return;
        }
        log(this._console, level, message);
    }
    _getNumericalLevel(level) {
        const numericLevel = getLevelNumber(level);
        debug.assert(numericLevel !== undefined, 'Logger: unknown log level.');
        return numericLevel !== undefined ? numericLevel : 2;
    }
    _processChains(level, message) {
        this._chains.forEach((c) => log(c, level, message));
    }
}
exports.ConsoleWithLogLevel = ConsoleWithLogLevel;
function log(console, logType, msg) {
    switch (logType) {
        case LogLevel.Log:
            console.log(msg);
            break;
        case LogLevel.Info:
            console.info(msg);
            break;
        case LogLevel.Warn:
            console.warn(msg);
            break;
        case LogLevel.Error:
            console.error(msg);
            break;
        default:
            debug.fail(`${logType} is not expected`);
    }
}
exports.log = log;
function convertLogLevel(logLevelValue) {
    if (!logLevelValue) {
        return LogLevel.Info;
    }
    switch (logLevelValue.toLowerCase()) {
        case 'error':
            return LogLevel.Error;
        case 'warning':
            return LogLevel.Warn;
        case 'information':
            return LogLevel.Info;
        case 'trace':
            return LogLevel.Log;
        default:
            return LogLevel.Info;
    }
}
exports.convertLogLevel = convertLogLevel;
//# sourceMappingURL=console.js.map