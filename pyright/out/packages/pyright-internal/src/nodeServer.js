"use strict";
/*
 * nodeServer.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Implements utilities for starting the language server in a node environment.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConnectionOptions = exports.run = void 0;
const node_1 = require("vscode-languageserver/node");
const worker_threads_1 = require("worker_threads");
const fileBasedCancellationUtils_1 = require("./common/fileBasedCancellationUtils");
function run(runServer, runBackgroundThread) {
    if (process.env.NODE_ENV === 'production') {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('source-map-support').install();
    }
    if (worker_threads_1.isMainThread) {
        runServer((0, node_1.createConnection)(getConnectionOptions()));
    }
    else {
        runBackgroundThread();
    }
}
exports.run = run;
function getConnectionOptions() {
    return { cancellationStrategy: (0, fileBasedCancellationUtils_1.getCancellationStrategyFromArgv)(process.argv) };
}
exports.getConnectionOptions = getConnectionOptions;
//# sourceMappingURL=nodeServer.js.map