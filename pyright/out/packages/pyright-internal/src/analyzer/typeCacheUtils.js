"use strict";
/*
 * typeCacheUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utilities for managing type caches.
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
exports.SpeculativeTypeTracker = void 0;
const debug_1 = require("../common/debug");
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const types_1 = require("./types");
// This class maintains a stack of "speculative type contexts". When
// a context is popped off the stack, all of the speculative type cache
// entries that were created within that context are removed from the
// corresponding type caches because they are no longer valid.
// Each type context also contains a map of "speculative types" that are
// contextually evaluated based on an "expected type" and potentially
// one or more "dependent types". The "expected type" applies in cases
// where the speculative root node is being evaluated with bidirectional
// type inference. Dependent types apply in cases where the type of
// many subnodes depends on the expected type of a parent node, as in the
// case of lambda type inference.
class SpeculativeTypeTracker {
    constructor() {
        this._speculativeContextStack = [];
        this._speculativeTypeCache = new Map();
        this._activeDependentTypes = [];
    }
    enterSpeculativeContext(speculativeRootNode, options) {
        this._speculativeContextStack.push({
            speculativeRootNode,
            entriesToUndo: [],
            dependentType: options === null || options === void 0 ? void 0 : options.dependentType,
            allowDiagnostics: options === null || options === void 0 ? void 0 : options.allowDiagnostics,
        });
        // Retain a list of active dependent types. This information is already
        // contained within the speculative context stack, but we retain a copy
        // in this alternate form for performance reasons.
        if (options === null || options === void 0 ? void 0 : options.dependentType) {
            this._activeDependentTypes.push({
                speculativeRootNode,
                dependentType: options.dependentType,
            });
        }
    }
    leaveSpeculativeContext() {
        (0, debug_1.assert)(this._speculativeContextStack.length > 0);
        const context = this._speculativeContextStack.pop();
        if (context === null || context === void 0 ? void 0 : context.dependentType) {
            (0, debug_1.assert)(this._activeDependentTypes.length > 0);
            this._activeDependentTypes.pop();
        }
        // Delete all of the speculative type cache entries
        // that were tracked in this context.
        context.entriesToUndo.forEach((entry) => {
            entry.cache.delete(entry.id);
        });
    }
    isSpeculative(node, ignoreIfDiagnosticsAllowed = false) {
        if (this._speculativeContextStack.length === 0) {
            return false;
        }
        if (!node) {
            return true;
        }
        for (let i = this._speculativeContextStack.length - 1; i >= 0; i--) {
            const stackEntry = this._speculativeContextStack[i];
            if (ParseTreeUtils.isNodeContainedWithin(node, stackEntry.speculativeRootNode)) {
                if (!ignoreIfDiagnosticsAllowed || !stackEntry.allowDiagnostics) {
                    return true;
                }
            }
        }
        return false;
    }
    trackEntry(cache, id) {
        const stackSize = this._speculativeContextStack.length;
        if (stackSize > 0) {
            this._speculativeContextStack[stackSize - 1].entriesToUndo.push({
                cache,
                id,
            });
        }
    }
    // Temporarily disables speculative mode, clearing the stack
    // of speculative contexts. It returns the stack so the caller
    // can later restore it by calling enableSpeculativeMode.
    disableSpeculativeMode() {
        const stack = this._speculativeContextStack;
        this._speculativeContextStack = [];
        return stack;
    }
    enableSpeculativeMode(stack) {
        (0, debug_1.assert)(this._speculativeContextStack.length === 0);
        this._speculativeContextStack = stack;
    }
    addSpeculativeType(node, typeResult, incompleteGenerationCount, expectedType) {
        (0, debug_1.assert)(this._speculativeContextStack.length > 0);
        const maxCacheEntriesPerNode = 8;
        let cacheEntries = this._speculativeTypeCache.get(node.id);
        if (!cacheEntries) {
            cacheEntries = [];
        }
        else {
            cacheEntries = cacheEntries.filter((entry) => {
                // Filter out any incomplete entries that no longer match the generation count.
                // These are obsolete and cannot be used.
                if (entry.typeResult.isIncomplete && entry.incompleteGenerationCount !== incompleteGenerationCount) {
                    return false;
                }
                // Filter out any entries that match the expected type of the
                // new entry. The new entry replaces the old in this case.
                if (expectedType) {
                    if (!entry.expectedType) {
                        return true;
                    }
                    return !(0, types_1.isTypeSame)(entry.expectedType, expectedType);
                }
                return !!entry.expectedType;
            });
            // Don't allow the cache to grow too large.
            if (cacheEntries.length >= maxCacheEntriesPerNode) {
                cacheEntries.slice(1);
            }
        }
        // Add the new entry.
        const newEntry = {
            typeResult,
            expectedType,
            incompleteGenerationCount,
        };
        if (this._activeDependentTypes.length > 0) {
            newEntry.dependentTypes = Array.from(this._activeDependentTypes);
        }
        cacheEntries.push(newEntry);
        this._speculativeTypeCache.set(node.id, cacheEntries);
    }
    getSpeculativeType(node, expectedType) {
        if (this._speculativeContextStack.some((context) => ParseTreeUtils.isNodeContainedWithin(node, context.speculativeRootNode))) {
            const entries = this._speculativeTypeCache.get(node.id);
            if (entries) {
                for (const entry of entries) {
                    if (!expectedType) {
                        if (!entry.expectedType && this._dependentTypesMatch(entry)) {
                            return entry;
                        }
                    }
                    else if (entry.expectedType &&
                        (0, types_1.isTypeSame)(expectedType, entry.expectedType) &&
                        this._dependentTypesMatch(entry)) {
                        return entry;
                    }
                }
            }
        }
        return undefined;
    }
    // Determines whether a cache entry matches the current set of
    // active dependent types. If not, the cache entry can't be used
    // in the current context.
    _dependentTypesMatch(entry) {
        var _a;
        const cachedDependentTypes = (_a = entry.dependentTypes) !== null && _a !== void 0 ? _a : [];
        if (cachedDependentTypes.length !== this._activeDependentTypes.length) {
            return false;
        }
        return cachedDependentTypes.every((cachedDepType, index) => {
            const activeDepType = this._activeDependentTypes[index];
            if (cachedDepType.speculativeRootNode !== activeDepType.speculativeRootNode) {
                return false;
            }
            return (0, types_1.isTypeSame)(cachedDepType.dependentType, activeDepType.dependentType);
        });
    }
}
exports.SpeculativeTypeTracker = SpeculativeTypeTracker;
//# sourceMappingURL=typeCacheUtils.js.map