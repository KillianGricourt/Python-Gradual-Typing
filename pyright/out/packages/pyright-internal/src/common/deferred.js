"use strict";
/*
 * deferred.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Promise utilities for async operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDeferredFromPromise = exports.createDeferredFrom = exports.createDeferred = void 0;
class DeferredImpl {
    constructor(_scope = null) {
        this._scope = _scope;
        this._resolved = false;
        this._rejected = false;
        this._promise = new Promise((res, rej) => {
            this._resolve = res;
            this._reject = rej;
        });
    }
    get promise() {
        return this._promise;
    }
    get resolved() {
        return this._resolved;
    }
    get rejected() {
        return this._rejected;
    }
    get completed() {
        return this._rejected || this._resolved;
    }
    resolve(_value) {
        // eslint-disable-next-line prefer-rest-params
        this._resolve.apply(this._scope ? this._scope : this, arguments);
        this._resolved = true;
    }
    reject(_reason) {
        // eslint-disable-next-line prefer-rest-params
        this._reject.apply(this._scope ? this._scope : this, arguments);
        this._rejected = true;
    }
}
function createDeferred(scope = null) {
    return new DeferredImpl(scope);
}
exports.createDeferred = createDeferred;
function createDeferredFrom(...promises) {
    const deferred = createDeferred();
    Promise.all(promises)
        .then(deferred.resolve.bind(deferred))
        .catch(deferred.reject.bind(deferred));
    return deferred;
}
exports.createDeferredFrom = createDeferredFrom;
function createDeferredFromPromise(promise) {
    const deferred = createDeferred();
    promise.then(deferred.resolve.bind(deferred)).catch(deferred.reject.bind(deferred));
    return deferred;
}
exports.createDeferredFromPromise = createDeferredFromPromise;
//# sourceMappingURL=deferred.js.map