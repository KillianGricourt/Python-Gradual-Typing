"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicFeatures = exports.DynamicFeature = void 0;
class DynamicFeature {
    constructor(name) {
        this.name = name;
        // Empty
    }
    register() {
        this.registerFeature().then((d) => {
            this.dispose();
            this._lastRegistration = d;
        });
    }
    update(settings) {
        // Default is no-op
    }
    dispose() {
        var _a;
        (_a = this._lastRegistration) === null || _a === void 0 ? void 0 : _a.dispose();
        this._lastRegistration = undefined;
    }
}
exports.DynamicFeature = DynamicFeature;
class DynamicFeatures {
    constructor() {
        this._map = new Map();
    }
    add(feature) {
        const old = this._map.get(feature.name);
        if (old) {
            old.dispose();
        }
        this._map.set(feature.name, feature);
    }
    update(settings) {
        for (const feature of this._map.values()) {
            feature.update(settings);
        }
    }
    register() {
        for (const feature of this._map.values()) {
            feature.register();
        }
    }
    unregister() {
        for (const feature of this._map.values()) {
            feature.dispose();
        }
        this._map.clear();
    }
}
exports.DynamicFeatures = DynamicFeatures;
//# sourceMappingURL=dynamicFeature.js.map