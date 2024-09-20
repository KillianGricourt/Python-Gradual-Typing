"use strict";
/*
 * serviceKeys.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Define service keys.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceKeys = void 0;
const serviceProvider_1 = require("./serviceProvider");
var ServiceKeys;
(function (ServiceKeys) {
    ServiceKeys.fs = new serviceProvider_1.ServiceKey();
    ServiceKeys.console = new serviceProvider_1.ServiceKey();
    ServiceKeys.sourceFileFactory = new serviceProvider_1.ServiceKey();
    ServiceKeys.partialStubs = new serviceProvider_1.ServiceKey();
    ServiceKeys.symbolDefinitionProvider = new serviceProvider_1.GroupServiceKey();
    ServiceKeys.symbolUsageProviderFactory = new serviceProvider_1.GroupServiceKey();
    ServiceKeys.stateMutationListeners = new serviceProvider_1.GroupServiceKey();
    ServiceKeys.tempFile = new serviceProvider_1.ServiceKey();
    ServiceKeys.cacheManager = new serviceProvider_1.ServiceKey();
    ServiceKeys.debugInfoInspector = new serviceProvider_1.ServiceKey();
    ServiceKeys.caseSensitivityDetector = new serviceProvider_1.ServiceKey();
    ServiceKeys.docStringService = new serviceProvider_1.ServiceKey();
})(ServiceKeys || (exports.ServiceKeys = ServiceKeys = {}));
//# sourceMappingURL=serviceKeys.js.map