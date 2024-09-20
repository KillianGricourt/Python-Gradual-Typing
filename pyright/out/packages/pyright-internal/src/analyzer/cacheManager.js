"use strict";
/*
 * cacheManager.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A singleton that tracks the size of caches and empties them
 * if memory usage approaches the max heap space.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheManager = void 0;
const debug_1 = require("../common/debug");
const memUtils_1 = require("../common/memUtils");
class CacheManager {
    constructor(_maxWorkers = 0) {
        this._maxWorkers = _maxWorkers;
        this._pausedCount = 0;
        this._cacheOwners = [];
        this._sharedUsagePosition = 0;
        this._lastHeapStats = Date.now();
    }
    registerCacheOwner(provider) {
        this._cacheOwners.push(provider);
    }
    addWorker(index, worker) {
        // Send the sharedArrayBuffer to the worker so it can be used
        // to keep track of heap usage on all threads.
        const buffer = this._getSharedUsageBuffer();
        if (buffer) {
            // The SharedArrayBuffer needs to be separate from data in order for it
            // to be marshalled correctly.
            worker.postMessage({ requestType: 'cacheUsageBuffer', sharedUsageBuffer: buffer, data: index.toString() });
            worker.on('exit', () => {
                const view = new Float64Array(buffer);
                view[index] = 0;
            });
        }
    }
    handleCachedUsageBufferMessage(msg) {
        if (msg.requestType === 'cacheUsageBuffer') {
            const index = parseInt(msg.data || '0');
            const buffer = msg.sharedUsageBuffer;
            // Index of zero is reserved for the main thread so if
            // the index isn't passed, don't save the shared buffer.
            if (buffer && index) {
                this._sharedUsageBuffer = buffer;
                this._sharedUsagePosition = index;
            }
        }
    }
    unregisterCacheOwner(provider) {
        const index = this._cacheOwners.findIndex((p) => p === provider);
        if (index < 0) {
            (0, debug_1.fail)('Specified cache provider not found');
        }
        else {
            this._cacheOwners.splice(index, 1);
        }
    }
    pauseTracking() {
        const local = this;
        local._pausedCount++;
        return {
            dispose() {
                local._pausedCount--;
            },
        };
    }
    getCacheUsage() {
        if (this._pausedCount > 0) {
            return -1;
        }
        let totalUsage = 0;
        this._cacheOwners.forEach((p) => {
            totalUsage += p.getCacheUsage();
        });
        return totalUsage;
    }
    emptyCache(console) {
        if (console) {
            const heapStats = (0, memUtils_1.getHeapStatistics)();
            console.info(`Emptying type cache to avoid heap overflow. Used ${this._convertToMB(heapStats.used_heap_size)} out of ${this._convertToMB(heapStats.heap_size_limit)}.`);
        }
        this._cacheOwners.forEach((p) => {
            p.emptyCache();
        });
    }
    // Returns a ratio of used bytes to total bytes.
    getUsedHeapRatio(console) {
        if (this._pausedCount > 0) {
            return -1;
        }
        const heapStats = (0, memUtils_1.getHeapStatistics)();
        let usage = this._getTotalHeapUsage(heapStats);
        if (console && Date.now() - this._lastHeapStats > 1000) {
            // This can fill up the user's console, so we only do it once per second.
            this._lastHeapStats = Date.now();
            console.info(`Heap stats: ` +
                `total_heap_size=${this._convertToMB(heapStats.total_heap_size)}, ` +
                `used_heap_size=${this._convertToMB(heapStats.used_heap_size)}, ` +
                `cross_worker_used_heap_size=${this._convertToMB(usage)}, ` +
                `total_physical_size=${this._convertToMB(heapStats.total_physical_size)}, ` +
                `total_available_size=${this._convertToMB(heapStats.total_available_size)}, ` +
                `heap_size_limit=${this._convertToMB(heapStats.heap_size_limit)}`);
        }
        // Total usage seems to be off by about 5%, so we'll add that back in
        // to make the ratio more accurate. (200MB at 4GB)
        usage += usage * 0.05;
        return usage / heapStats.heap_size_limit;
    }
    _convertToMB(bytes) {
        return `${Math.round(bytes / (1024 * 1024))}MB`;
    }
    _getSharedUsageBuffer() {
        try {
            if (!this._sharedUsageBuffer && this._maxWorkers > 0) {
                // Allocate enough space for the workers and the main thread.
                this._sharedUsageBuffer = new SharedArrayBuffer(8 * (this._maxWorkers + 1));
            }
            return this._sharedUsageBuffer;
        }
        catch {
            // SharedArrayBuffer is not supported.
            return undefined;
        }
    }
    _getTotalHeapUsage(heapStats) {
        // If the SharedArrayBuffer is supported, we'll use it to to get usage
        // from other threads and add that to our own
        const buffer = this._getSharedUsageBuffer();
        if (buffer) {
            const view = new Float64Array(buffer);
            view[this._sharedUsagePosition] = heapStats.used_heap_size;
            return view.reduce((a, b) => a + b, 0);
        }
        return heapStats.used_heap_size;
    }
}
exports.CacheManager = CacheManager;
(function (CacheManager) {
    function is(obj) {
        return (obj.registerCacheOwner !== undefined &&
            obj.unregisterCacheOwner !== undefined &&
            obj.pauseTracking !== undefined &&
            obj.getCacheUsage !== undefined &&
            obj.emptyCache !== undefined &&
            obj.getUsedHeapRatio !== undefined);
    }
    CacheManager.is = is;
})(CacheManager || (exports.CacheManager = CacheManager = {}));
//# sourceMappingURL=cacheManager.js.map