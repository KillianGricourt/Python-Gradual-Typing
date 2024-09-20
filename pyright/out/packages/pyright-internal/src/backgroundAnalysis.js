"use strict";
/*
 * backgroundAnalysis.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * run analyzer from background thread
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundAnalysisRunner = exports.BackgroundAnalysis = void 0;
const worker_threads_1 = require("worker_threads");
const importResolver_1 = require("./analyzer/importResolver");
const backgroundAnalysisBase_1 = require("./backgroundAnalysisBase");
const cancellationUtils_1 = require("./common/cancellationUtils");
const fullAccessHost_1 = require("./common/fullAccessHost");
const uriUtils_1 = require("./common/uri/uriUtils");
class BackgroundAnalysis extends backgroundAnalysisBase_1.BackgroundAnalysisBase {
    constructor(serviceProvider) {
        var _a, _b, _c;
        super(serviceProvider.console());
        const index = ++BackgroundAnalysis._workerIndex;
        const initialData = {
            rootUri: (_b = (_a = (0, uriUtils_1.getRootUri)(serviceProvider)) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : '',
            serviceId: index.toString(),
            cancellationFolderName: (0, cancellationUtils_1.getCancellationFolderName)(),
            runner: undefined,
            workerIndex: index,
        };
        // this will load this same file in BG thread and start listener
        const worker = new worker_threads_1.Worker(__filename, { workerData: initialData });
        this.setup(worker);
        // Tell the cacheManager we have a worker that needs to share data.
        (_c = serviceProvider.cacheManager()) === null || _c === void 0 ? void 0 : _c.addWorker(initialData.workerIndex, worker);
    }
}
exports.BackgroundAnalysis = BackgroundAnalysis;
BackgroundAnalysis._workerIndex = 0;
class BackgroundAnalysisRunner extends backgroundAnalysisBase_1.BackgroundAnalysisRunnerBase {
    constructor(serviceProvider) {
        super(serviceProvider);
    }
    createHost() {
        return new fullAccessHost_1.FullAccessHost(this.getServiceProvider());
    }
    createImportResolver(serviceProvider, options, host) {
        return new importResolver_1.ImportResolver(serviceProvider, options, host);
    }
}
exports.BackgroundAnalysisRunner = BackgroundAnalysisRunner;
//# sourceMappingURL=backgroundAnalysis.js.map