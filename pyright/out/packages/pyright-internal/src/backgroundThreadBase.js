"use strict";
/*
 * backgroundThreadBase.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * base class for background worker thread.
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
exports.getBackgroundWaiter = exports.run = exports.deserialize = exports.deserializeReviver = exports.serialize = exports.serializeReplacer = exports.BackgroundThreadBase = exports.BackgroundConsole = void 0;
const worker_threads_1 = require("worker_threads");
const cacheManager_1 = require("./analyzer/cacheManager");
const cancellationUtils_1 = require("./common/cancellationUtils");
const configOptions_1 = require("./common/configOptions");
const console_1 = require("./common/console");
const core_1 = require("./common/core");
const debug = __importStar(require("./common/debug"));
const pythonVersion_1 = require("./common/pythonVersion");
const realFileSystem_1 = require("./common/realFileSystem");
const serviceKeys_1 = require("./common/serviceKeys");
const serviceProvider_1 = require("./common/serviceProvider");
require("./common/serviceProviderExtensions");
const uri_1 = require("./common/uri/uri");
class BackgroundConsole {
    constructor() {
        this._level = console_1.LogLevel.Log;
    }
    get level() {
        return this._level;
    }
    set level(value) {
        this._level = value;
    }
    log(msg) {
        this.post(console_1.LogLevel.Log, msg);
    }
    info(msg) {
        this.post(console_1.LogLevel.Info, msg);
    }
    warn(msg) {
        this.post(console_1.LogLevel.Warn, msg);
    }
    error(msg) {
        this.post(console_1.LogLevel.Error, msg);
    }
    post(level, msg) {
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ requestType: 'log', data: serialize({ level: level, message: msg }) });
    }
}
exports.BackgroundConsole = BackgroundConsole;
class BackgroundThreadBase {
    constructor(data, serviceProvider) {
        (0, cancellationUtils_1.setCancellationFolderName)(data.cancellationFolderName);
        // Make sure there's a file system and a console interface.
        this._serviceProvider = serviceProvider !== null && serviceProvider !== void 0 ? serviceProvider : new serviceProvider_1.ServiceProvider();
        if (!this._serviceProvider.tryGet(serviceKeys_1.ServiceKeys.console)) {
            this._serviceProvider.add(serviceKeys_1.ServiceKeys.console, new BackgroundConsole());
        }
        let tempFile = undefined;
        if (!this._serviceProvider.tryGet(serviceKeys_1.ServiceKeys.tempFile)) {
            tempFile = new realFileSystem_1.RealTempFile();
            this._serviceProvider.add(serviceKeys_1.ServiceKeys.tempFile, tempFile);
        }
        if (!this._serviceProvider.tryGet(serviceKeys_1.ServiceKeys.caseSensitivityDetector)) {
            this._serviceProvider.add(serviceKeys_1.ServiceKeys.caseSensitivityDetector, tempFile !== null && tempFile !== void 0 ? tempFile : new realFileSystem_1.RealTempFile());
        }
        if (!this._serviceProvider.tryGet(serviceKeys_1.ServiceKeys.fs)) {
            this._serviceProvider.add(serviceKeys_1.ServiceKeys.fs, (0, realFileSystem_1.createFromRealFileSystem)(this._serviceProvider.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector), this.getConsole()));
        }
        if (!this._serviceProvider.tryGet(serviceKeys_1.ServiceKeys.cacheManager)) {
            this._serviceProvider.add(serviceKeys_1.ServiceKeys.cacheManager, new cacheManager_1.CacheManager());
        }
        // Stash the base directory into a global variable.
        global.__rootDirectory = uri_1.Uri.parse(data.rootUri, this._serviceProvider).getFilePath();
    }
    get fs() {
        return this._serviceProvider.fs();
    }
    log(level, msg) {
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.postMessage({ requestType: 'log', data: serialize({ level: level, message: msg }) });
    }
    getConsole() {
        return this._serviceProvider.console();
    }
    getServiceProvider() {
        return this._serviceProvider;
    }
    handleShutdown() {
        const tempFile = this._serviceProvider.tryGet(serviceKeys_1.ServiceKeys.tempFile);
        if (core_1.Disposable.is(tempFile)) {
            tempFile.dispose();
        }
        worker_threads_1.parentPort === null || worker_threads_1.parentPort === void 0 ? void 0 : worker_threads_1.parentPort.close();
    }
}
exports.BackgroundThreadBase = BackgroundThreadBase;
// Function used to serialize specific types that can't automatically be serialized.
// Exposed here so it can be reused by a caller that wants to add more cases.
function serializeReplacer(value) {
    if (uri_1.Uri.is(value) && value.toJsonObj !== undefined) {
        return { __serialized_uri_val: value.toJsonObj() };
    }
    if (value instanceof pythonVersion_1.PythonVersion) {
        return { __serialized_version_val: value.toString() };
    }
    if (value instanceof Map) {
        return { __serialized_map_val: [...value] };
    }
    if (value instanceof Set) {
        return { __serialized_set_val: [...value] };
    }
    if (value instanceof RegExp) {
        return { __serialized_regexp_val: { source: value.source, flags: value.flags } };
    }
    if (value instanceof configOptions_1.ConfigOptions) {
        const entries = Object.entries(value);
        return { __serialized_config_options: entries.reduce((obj, e, i) => ({ ...obj, [e[0]]: e[1] }), {}) };
    }
    return value;
}
exports.serializeReplacer = serializeReplacer;
function serialize(obj) {
    // Convert the object to a string so it can be sent across a message port.
    return JSON.stringify(obj, (k, v) => serializeReplacer(v));
}
exports.serialize = serialize;
function deserializeReviver(value) {
    if (value && typeof value === 'object') {
        if (value.__serialized_uri_val !== undefined) {
            return uri_1.Uri.fromJsonObj(value.__serialized_uri_val);
        }
        if (value.__serialized_version_val) {
            return pythonVersion_1.PythonVersion.fromString(value.__serialized_version_val);
        }
        if (value.__serialized_map_val) {
            return new Map(value.__serialized_map_val);
        }
        if (value.__serialized_set_val) {
            return new Set(value.__serialized_set_val);
        }
        if (value.__serialized_regexp_val) {
            return new RegExp(value.__serialized_regexp_val.source, value.__serialized_regexp_val.flags);
        }
        if (value.__serialized_config_options) {
            const configOptions = new configOptions_1.ConfigOptions(value.__serialized_config_options.projectRoot);
            Object.assign(configOptions, value.__serialized_config_options);
            return configOptions;
        }
    }
    return value;
}
exports.deserializeReviver = deserializeReviver;
function deserialize(json) {
    if (!json) {
        return undefined;
    }
    // Convert the string back to an object.
    return JSON.parse(json, (k, v) => deserializeReviver(v));
}
exports.deserialize = deserialize;
function run(code, port, serializer = serialize) {
    try {
        const result = code();
        if (!(0, core_1.isThenable)(result)) {
            port.postMessage({ kind: 'ok', data: serializer(result) });
            return;
        }
        return result.then((r) => {
            port.postMessage({ kind: 'ok', data: serializer(r) });
        }, (e) => {
            if (cancellationUtils_1.OperationCanceledException.is(e)) {
                port.postMessage({ kind: 'cancelled', data: e.message });
                return;
            }
            port.postMessage({ kind: 'failed', data: `Exception: ${e.message} in ${e.stack}` });
        });
    }
    catch (e) {
        if (cancellationUtils_1.OperationCanceledException.is(e)) {
            port.postMessage({ kind: 'cancelled', data: e.message });
            return;
        }
        port.postMessage({ kind: 'failed', data: `Exception: ${e.message} in ${e.stack}` });
    }
}
exports.run = run;
function getBackgroundWaiter(port, deserializer = deserialize) {
    return new Promise((resolve, reject) => {
        port.on('message', (m) => {
            switch (m.kind) {
                case 'ok':
                    resolve(deserializer(m.data));
                    break;
                case 'cancelled':
                    reject(new cancellationUtils_1.OperationCanceledException());
                    break;
                case 'failed':
                    reject(m.data);
                    break;
                default:
                    debug.fail(`unknown kind ${m.kind}`);
            }
        });
    });
}
exports.getBackgroundWaiter = getBackgroundWaiter;
//# sourceMappingURL=backgroundThreadBase.js.map