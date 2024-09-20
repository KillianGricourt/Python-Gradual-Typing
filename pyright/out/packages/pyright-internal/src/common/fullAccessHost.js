"use strict";
/*
 * fullAccessHost.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Implementation of host where it is allowed to run external executables.
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
exports.FullAccessHost = exports.LimitedAccessHost = void 0;
const child_process = __importStar(require("child_process"));
const cancellationUtils_1 = require("./cancellationUtils");
const configOptions_1 = require("./configOptions");
const debug_1 = require("./debug");
const host_1 = require("./host");
const pathUtils_1 = require("./pathUtils");
const pythonVersion_1 = require("./pythonVersion");
const serviceKeys_1 = require("./serviceKeys");
const uri_1 = require("./uri/uri");
const uriUtils_1 = require("./uri/uriUtils");
// preventLocalImports removes the working directory from sys.path.
// The -c flag adds it automatically, which can allow some stdlib
// modules (like json) to be overridden by other files (like json.py).
const removeCwdFromSysPath = [
    'import os, os.path, sys',
    'normalize = lambda p: os.path.normcase(os.path.normpath(p))',
    'cwd = normalize(os.getcwd())',
    'orig_sys_path = [p for p in sys.path if p != ""]',
    'sys.path[:] = [p for p in sys.path if p != "" and normalize(p) != cwd]',
];
const extractSys = [
    ...removeCwdFromSysPath,
    'import sys, json',
    'json.dump(dict(path=orig_sys_path, prefix=sys.prefix), sys.stdout)',
].join('; ');
const extractVersion = [
    ...removeCwdFromSysPath,
    'import sys, json',
    'json.dump(tuple(sys.version_info), sys.stdout)',
].join('; ');
class LimitedAccessHost extends host_1.NoAccessHost {
    get kind() {
        return 1 /* HostKind.LimitedAccess */;
    }
    getPythonPlatform(logInfo) {
        if (process.platform === 'darwin') {
            return configOptions_1.PythonPlatform.Darwin;
        }
        else if (process.platform === 'linux') {
            return configOptions_1.PythonPlatform.Linux;
        }
        else if (process.platform === 'win32') {
            return configOptions_1.PythonPlatform.Windows;
        }
        return undefined;
    }
}
exports.LimitedAccessHost = LimitedAccessHost;
class FullAccessHost extends LimitedAccessHost {
    constructor(serviceProvider) {
        super();
        this.serviceProvider = serviceProvider;
    }
    get kind() {
        return 0 /* HostKind.FullAccess */;
    }
    static createHost(kind, serviceProvider) {
        switch (kind) {
            case 2 /* HostKind.NoAccess */:
                return new host_1.NoAccessHost();
            case 1 /* HostKind.LimitedAccess */:
                return new LimitedAccessHost();
            case 0 /* HostKind.FullAccess */:
                return new FullAccessHost(serviceProvider);
            default:
                (0, debug_1.assertNever)(kind);
        }
    }
    getPythonSearchPaths(pythonPath, logInfo) {
        const importFailureInfo = logInfo !== null && logInfo !== void 0 ? logInfo : [];
        let result = this._executePythonInterpreter(pythonPath === null || pythonPath === void 0 ? void 0 : pythonPath.getFilePath(), (p) => this._getSearchPathResultFromInterpreter(p, importFailureInfo));
        if (!result) {
            result = {
                paths: [],
                prefix: undefined,
            };
        }
        importFailureInfo.push(`Received ${result.paths.length} paths from interpreter`);
        result.paths.forEach((path) => {
            importFailureInfo.push(`  ${path}`);
        });
        return result;
    }
    getPythonVersion(pythonPath, logInfo) {
        const importFailureInfo = logInfo !== null && logInfo !== void 0 ? logInfo : [];
        try {
            const commandLineArgs = ['-I', '-c', extractVersion];
            const execOutput = this._executePythonInterpreter(pythonPath === null || pythonPath === void 0 ? void 0 : pythonPath.getFilePath(), (p) => child_process.execFileSync(p, commandLineArgs, { encoding: 'utf8' }));
            const versionJson = JSON.parse(execOutput);
            if (!Array.isArray(versionJson) || versionJson.length < 5) {
                importFailureInfo.push(`Python version ${execOutput} from interpreter is unexpected format`);
                return undefined;
            }
            const version = new pythonVersion_1.PythonVersion(versionJson[0], versionJson[1], versionJson[2], versionJson[3], versionJson[4]);
            if (version === undefined) {
                importFailureInfo.push(`Python version ${execOutput} from interpreter is unsupported`);
                return undefined;
            }
            return version;
        }
        catch {
            importFailureInfo.push('Unable to get Python version from interpreter');
            return undefined;
        }
    }
    runScript(pythonPath, script, args, cwd, token) {
        // If it is already cancelled, don't bother to run script.
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        // What to do about conda here?
        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';
            const commandLineArgs = ['-I', script.getFilePath(), ...args];
            const child = this._executePythonInterpreter(pythonPath === null || pythonPath === void 0 ? void 0 : pythonPath.getFilePath(), (p) => child_process.spawn(p, commandLineArgs, { cwd: cwd.getFilePath() }));
            const tokenWatch = (0, cancellationUtils_1.onCancellationRequested)(token, () => {
                if (child) {
                    try {
                        if (child.pid && child.exitCode === null) {
                            if (process.platform === 'win32') {
                                // Windows doesn't support SIGTERM, so execute taskkill to kill the process
                                child_process.execSync(`taskkill /pid ${child.pid} /T /F > NUL 2>&1`);
                            }
                            else {
                                process.kill(child.pid);
                            }
                        }
                    }
                    catch {
                        // Ignore.
                    }
                }
                reject(new cancellationUtils_1.OperationCanceledException());
            });
            if (child) {
                child.stdout.on('data', (d) => (stdout = stdout.concat(d)));
                child.stderr.on('data', (d) => (stderr = stderr.concat(d)));
                child.on('error', (e) => {
                    tokenWatch.dispose();
                    reject(e);
                });
                child.on('exit', () => {
                    tokenWatch.dispose();
                    resolve({ stdout, stderr });
                });
            }
            else {
                tokenWatch.dispose();
                reject(new Error(`Cannot start python interpreter with script ${script}`));
            }
        });
    }
    _executePythonInterpreter(pythonPath, execute) {
        if (pythonPath) {
            return execute(pythonPath);
        }
        else {
            let result;
            try {
                // On non-Windows platforms, always default to python3 first. We want to
                // avoid this on Windows because it might invoke a script that displays
                // a dialog box indicating that python can be downloaded from the app store.
                if (process.platform !== 'win32') {
                    result = execute('python3');
                }
            }
            catch {
                // Ignore failure on python3
            }
            if (result !== undefined) {
                return result;
            }
            // On some platforms, 'python3' might not exist. Try 'python' instead.
            return execute('python');
        }
    }
    _getSearchPathResultFromInterpreter(interpreterPath, importFailureInfo) {
        const result = {
            paths: [],
            prefix: undefined,
        };
        try {
            const commandLineArgs = ['-c', extractSys];
            importFailureInfo.push(`Executing interpreter: '${interpreterPath}'`);
            const temp = this.serviceProvider.get(serviceKeys_1.ServiceKeys.tempFile).mktmpdir();
            const execOutput = child_process.execFileSync(interpreterPath, commandLineArgs, {
                encoding: 'utf8',
                cwd: temp.getFilePath(),
            });
            const caseDetector = this.serviceProvider.get(serviceKeys_1.ServiceKeys.caseSensitivityDetector);
            // Parse the execOutput. It should be a JSON-encoded array of paths.
            try {
                const execSplit = JSON.parse(execOutput);
                for (let execSplitEntry of execSplit.path) {
                    execSplitEntry = execSplitEntry.trim();
                    if (execSplitEntry) {
                        const normalizedPath = (0, pathUtils_1.normalizePath)(execSplitEntry);
                        const normalizedUri = uri_1.Uri.file(normalizedPath, caseDetector);
                        // Skip non-existent paths and broken zips/eggs.
                        if (this.serviceProvider.fs().existsSync(normalizedUri) &&
                            (0, uriUtils_1.isDirectory)(this.serviceProvider.fs(), normalizedUri) &&
                            !normalizedUri.equals(temp)) {
                            result.paths.push(normalizedUri);
                        }
                        else {
                            importFailureInfo.push(`Skipping '${normalizedPath}' because it is not a valid directory`);
                        }
                    }
                }
                result.prefix = uri_1.Uri.file(execSplit.prefix, caseDetector);
                if (result.paths.length === 0) {
                    importFailureInfo.push(`Found no valid directories`);
                }
            }
            catch (err) {
                importFailureInfo.push(`Could not parse output: '${execOutput}'`);
                throw err;
            }
        }
        catch {
            return undefined;
        }
        return result;
    }
}
exports.FullAccessHost = FullAccessHost;
//# sourceMappingURL=fullAccessHost.js.map