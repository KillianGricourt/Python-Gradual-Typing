"use strict";
/*
 * circularDependency.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A list of file paths that are part of a circular dependency
 * chain (i.e. a chain of imports). Since these are circular, there
 * no defined "start", but this module helps normalize the start
 * by picking the alphabetically-first module in the cycle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircularDependency = void 0;
class CircularDependency {
    constructor() {
        this._paths = [];
    }
    appendPath(path) {
        this._paths.push(path);
    }
    getPaths() {
        return this._paths;
    }
    normalizeOrder() {
        // Find the path that is alphabetically first and reorder
        // based on that.
        let firstIndex = 0;
        this._paths.forEach((path, index) => {
            if (path < this._paths[firstIndex]) {
                firstIndex = index;
            }
        });
        if (firstIndex !== 0) {
            this._paths = this._paths.slice(firstIndex).concat(this._paths.slice(0, firstIndex));
        }
    }
    isEqual(circDependency) {
        if (circDependency._paths.length !== this._paths.length) {
            return false;
        }
        for (let i = 0; i < this._paths.length; i++) {
            if (this._paths[i] !== circDependency._paths[i]) {
                return false;
            }
        }
        return true;
    }
}
exports.CircularDependency = CircularDependency;
//# sourceMappingURL=circularDependency.js.map