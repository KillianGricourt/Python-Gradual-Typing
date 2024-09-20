"use strict";
/*
 * nodeMain.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Provides the main entrypoint to the server when running in Node.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const backgroundAnalysis_1 = require("./backgroundAnalysis");
const serviceProvider_1 = require("./common/serviceProvider");
const nodeServer_1 = require("./nodeServer");
const server_1 = require("./server");
function main(maxWorkers) {
    (0, nodeServer_1.run)((conn) => new server_1.PyrightServer(conn, maxWorkers), () => {
        const runner = new backgroundAnalysis_1.BackgroundAnalysisRunner(new serviceProvider_1.ServiceProvider());
        runner.start();
    });
}
exports.main = main;
//# sourceMappingURL=nodeMain.js.map