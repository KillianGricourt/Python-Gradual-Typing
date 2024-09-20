"use strict";
/*
 * memoization.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Decorators used to memoize the result of a function call.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheStaticFunc = exports.cacheMethodWithNoArgs = exports.cacheProperty = void 0;
// Cache for static method results.
const staticCache = new Map();
// Caches the results of a getter property.
function cacheProperty() {
    return function (target, functionName, descriptor) {
        const originalMethod = descriptor.get;
        descriptor.get = function (...args) {
            // Call the function once to get the result.
            const result = originalMethod.apply(this, args);
            // Then we replace the original function with one that just returns the result.
            Object.defineProperty(this, functionName, {
                get() {
                    return result;
                },
            });
            return result;
        };
        return descriptor;
    };
}
exports.cacheProperty = cacheProperty;
// Caches the results of method that takes no args.
// This situation can be optimized because the parameters are always the same.
function cacheMethodWithNoArgs() {
    return function (target, functionName, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            // Call the function once to get the result.
            const result = originalMethod.apply(this, args);
            // Then we replace the original function with one that just returns the result.
            this[functionName] = () => {
                // Note that this poses a risk. The result is passed by reference, so if the caller
                // modifies the result, it will modify the cached result.
                return result;
            };
            return result;
        };
        return descriptor;
    };
}
exports.cacheMethodWithNoArgs = cacheMethodWithNoArgs;
// Create a decorator to cache the results of a static method.
function cacheStaticFunc() {
    return function cacheStaticFunc_Fast(target, functionName, descriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function (...args) {
            const key = `${functionName}+${args === null || args === void 0 ? void 0 : args.map((a) => a === null || a === void 0 ? void 0 : a.toString()).join(',')}`;
            let cachedResult;
            if (!staticCache.has(key)) {
                cachedResult = originalMethod.apply(this, args);
                staticCache.set(key, cachedResult);
            }
            else {
                cachedResult = staticCache.get(key);
            }
            return cachedResult;
        };
        return descriptor;
    };
}
exports.cacheStaticFunc = cacheStaticFunc;
//# sourceMappingURL=memoization.js.map