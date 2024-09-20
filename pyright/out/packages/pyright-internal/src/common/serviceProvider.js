"use strict";
/*
 * serviceProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Container for different services used within the application.
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
exports.ServiceProvider = exports.GroupServiceKey = exports.ServiceKey = void 0;
const collectionUtils_1 = require("./collectionUtils");
const debug = __importStar(require("./debug"));
class InternalKey {
}
/**
 * Key for singleton service T.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class ServiceKey extends InternalKey {
    constructor() {
        super(...arguments);
        this.kind = 'singleton';
    }
}
exports.ServiceKey = ServiceKey;
/**
 * Key for group of service T.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class GroupServiceKey extends InternalKey {
    constructor() {
        super(...arguments);
        this.kind = 'group';
    }
}
exports.GroupServiceKey = GroupServiceKey;
class ServiceProvider {
    constructor() {
        this._container = new Map();
    }
    add(key, value) {
        if (key.kind === 'group') {
            this._addGroupService(key, value);
            return;
        }
        if (key.kind === 'singleton') {
            if (value !== undefined) {
                this._container.set(key, value);
            }
            else {
                this.remove(key);
            }
            return;
        }
        debug.assertNever(key, `Unknown key type ${typeof key}`);
    }
    remove(key, value) {
        if (key.kind === 'group') {
            this._removeGroupService(key, value);
            return;
        }
        if (key.kind === 'singleton') {
            this._container.delete(key);
            return;
        }
        debug.assertNever(key, `Unknown key type ${typeof key}`);
    }
    tryGet(key) {
        return this._container.get(key);
    }
    get(key) {
        const value = key.kind === 'group' ? this.tryGet(key) : this.tryGet(key);
        if (value === undefined) {
            throw new Error(`Global service provider not initialized for ${key.toString()}`);
        }
        return value;
    }
    clone() {
        const serviceProvider = new ServiceProvider();
        this._container.forEach((value, key) => {
            if (key.kind === 'group') {
                serviceProvider._container.set(key, [...(value !== null && value !== void 0 ? value : [])]);
            }
            else if (value.clone !== undefined) {
                serviceProvider._container.set(key, value.clone());
            }
            else {
                serviceProvider._container.set(key, value);
            }
        });
        return serviceProvider;
    }
    _addGroupService(key, newValue) {
        // Explicitly cast to remove `readonly`
        const services = this.tryGet(key);
        if (services === undefined) {
            this._container.set(key, [newValue]);
            return;
        }
        if (newValue !== undefined) {
            (0, collectionUtils_1.addIfUnique)(services, newValue);
        }
    }
    _removeGroupService(key, oldValue) {
        const services = this.tryGet(key);
        if (services === undefined) {
            return;
        }
        (0, collectionUtils_1.removeArrayElements)(services, (s) => s === oldValue);
    }
}
exports.ServiceProvider = ServiceProvider;
//# sourceMappingURL=serviceProvider.js.map