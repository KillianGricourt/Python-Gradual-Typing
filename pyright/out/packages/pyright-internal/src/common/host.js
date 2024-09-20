"use strict";
/*
 * host.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Provides access to the host environment the language service is running on.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoAccessHost = void 0;
class NoAccessHost {
    get kind() {
        return 2 /* HostKind.NoAccess */;
    }
    getPythonSearchPaths(pythonPath, logInfo) {
        logInfo === null || logInfo === void 0 ? void 0 : logInfo.push('No access to python executable.');
        return {
            paths: [],
            prefix: undefined,
        };
    }
    getPythonVersion(pythonPath, logInfo) {
        return undefined;
    }
    getPythonPlatform(logInfo) {
        return undefined;
    }
    async runScript(pythonPath, scriptPath, args, cwd, token) {
        return { stdout: '', stderr: '' };
    }
}
exports.NoAccessHost = NoAccessHost;
//# sourceMappingURL=host.js.map