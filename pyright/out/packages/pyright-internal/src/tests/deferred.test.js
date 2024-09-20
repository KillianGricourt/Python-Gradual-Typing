// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
'use strict';
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
const assert = __importStar(require("assert"));
const deferred_1 = require("../common/deferred");
test('Deferred - resolve', (done) => {
    const valueToSent = new Date().getTime();
    const def = (0, deferred_1.createDeferred)();
    def.promise
        .then((value) => {
        assert.equal(value, valueToSent);
        assert.equal(def.resolved, true, 'resolved property value is not `true`');
    })
        .then(done)
        .catch(done);
    assert.equal(def.resolved, false, 'Promise is resolved even when it should not be');
    assert.equal(def.rejected, false, 'Promise is rejected even when it should not be');
    assert.equal(def.completed, false, 'Promise is completed even when it should not be');
    def.resolve(valueToSent);
    assert.equal(def.resolved, true, 'Promise is not resolved even when it should not be');
    assert.equal(def.rejected, false, 'Promise is rejected even when it should not be');
    assert.equal(def.completed, true, 'Promise is not completed even when it should not be');
});
test('Deferred - reject', (done) => {
    const errorToSend = new Error('Something');
    const def = (0, deferred_1.createDeferred)();
    def.promise
        .then((value) => {
        assert.fail(value, 'Error', 'Was expecting promise to get rejected, however it was resolved', '');
        done();
    })
        .catch((reason) => {
        assert.equal(reason, errorToSend, 'Error received is not the same');
        done();
    })
        .catch(done);
    assert.equal(def.resolved, false, 'Promise is resolved even when it should not be');
    assert.equal(def.rejected, false, 'Promise is rejected even when it should not be');
    assert.equal(def.completed, false, 'Promise is completed even when it should not be');
    def.reject(errorToSend);
    assert.equal(def.resolved, false, 'Promise is resolved even when it should not be');
    assert.equal(def.rejected, true, 'Promise is not rejected even when it should not be');
    assert.equal(def.completed, true, 'Promise is not completed even when it should not be');
});
//# sourceMappingURL=deferred.test.js.map