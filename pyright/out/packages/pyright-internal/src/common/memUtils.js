"use strict";
/*
 * memUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Platform-independent helper functions for memory.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHeapStatistics = void 0;
function getHeapStatisticsFunc() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const getHeapStatistics = require('v8').getHeapStatistics;
        if (getHeapStatistics) {
            return getHeapStatistics;
        }
    }
    catch {
        // empty on purpose
    }
    return () => ({
        total_heap_size: 0,
        total_heap_size_executable: 0,
        total_physical_size: 0,
        total_available_size: 0,
        used_heap_size: 0,
        heap_size_limit: 0,
        malloced_memory: 0,
        peak_malloced_memory: 0,
        does_zap_garbage: 0,
        number_of_native_contexts: 0,
        number_of_detached_contexts: 0,
    });
}
exports.getHeapStatistics = getHeapStatisticsFunc();
//# sourceMappingURL=memUtils.js.map