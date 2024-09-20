"use strict";
/*
 * pathUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
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
exports.validate = void 0;
const path_1 = require("path");
const pu = __importStar(require("../../../common/pathUtils"));
const utils_1 = require("../utils");
const uri_1 = require("../../../common/uri/uri");
const invalidRootComponentRegExp = getInvalidRootComponentRegExp();
const invalidNavigableComponentRegExp = /[:*?"<>|]/;
const invalidNavigableComponentWithWildcardsRegExp = /[:"<>|]/;
const invalidNonNavigableComponentRegExp = /^\.{1,2}$|[:*?"<>|]/;
const invalidNonNavigableComponentWithWildcardsRegExp = /^\.{1,2}$|[:"<>|]/;
const extRegExp = /\.\w+$/;
function validateComponents(components, flags, hasTrailingSeparator) {
    const hasRoot = !!components[0];
    const hasDirname = components.length > 2;
    const hasBasename = components.length > 1;
    const hasExtname = hasBasename && extRegExp.test(components[components.length - 1]);
    const invalidComponentRegExp = flags & 1024 /* ValidationFlags.AllowNavigation */
        ? flags & 2048 /* ValidationFlags.AllowWildcard */
            ? invalidNavigableComponentWithWildcardsRegExp
            : invalidNavigableComponentRegExp
        : flags & 2048 /* ValidationFlags.AllowWildcard */
            ? invalidNonNavigableComponentWithWildcardsRegExp
            : invalidNonNavigableComponentRegExp;
    // Validate required components
    if (flags & 1 /* ValidationFlags.RequireRoot */ && !hasRoot) {
        return false;
    }
    if (flags & 2 /* ValidationFlags.RequireDirname */ && !hasDirname) {
        return false;
    }
    if (flags & 4 /* ValidationFlags.RequireBasename */ && !hasBasename) {
        return false;
    }
    if (flags & 8 /* ValidationFlags.RequireExtname */ && !hasExtname) {
        return false;
    }
    if (flags & 16 /* ValidationFlags.RequireTrailingSeparator */ && !hasTrailingSeparator) {
        return false;
    }
    // Required components indicate allowed components
    if (flags & 1 /* ValidationFlags.RequireRoot */) {
        flags |= 32 /* ValidationFlags.AllowRoot */;
    }
    if (flags & 2 /* ValidationFlags.RequireDirname */) {
        flags |= 64 /* ValidationFlags.AllowDirname */;
    }
    if (flags & 4 /* ValidationFlags.RequireBasename */) {
        flags |= 128 /* ValidationFlags.AllowBasename */;
    }
    if (flags & 8 /* ValidationFlags.RequireExtname */) {
        flags |= 256 /* ValidationFlags.AllowExtname */;
    }
    if (flags & 16 /* ValidationFlags.RequireTrailingSeparator */) {
        flags |= 512 /* ValidationFlags.AllowTrailingSeparator */;
    }
    // Validate disallowed components
    if (~flags & 32 /* ValidationFlags.AllowRoot */ && hasRoot) {
        return false;
    }
    if (~flags & 64 /* ValidationFlags.AllowDirname */ && hasDirname) {
        return false;
    }
    if (~flags & 128 /* ValidationFlags.AllowBasename */ && hasBasename) {
        return false;
    }
    if (~flags & 256 /* ValidationFlags.AllowExtname */ && hasExtname) {
        return false;
    }
    if (~flags & 512 /* ValidationFlags.AllowTrailingSeparator */ && hasTrailingSeparator) {
        return false;
    }
    // Validate component strings
    if (invalidRootComponentRegExp.test(components[0])) {
        return false;
    }
    for (let i = 1; i < components.length; i++) {
        if (invalidComponentRegExp.test(components[i]) && components[i] !== uri_1.Uri.DefaultWorkspaceRootComponent) {
            return false;
        }
    }
    return true;
}
function validate(path, flags = 2016 /* ValidationFlags.RelativeOrAbsolute */) {
    const components = pu.getPathComponents(path);
    const trailing = pu.hasTrailingDirectorySeparator(path);
    if (!validateComponents(components, flags, trailing)) {
        throw (0, utils_1.createIOError)('ENOENT');
    }
    return components.length > 1 && trailing
        ? pu.combinePathComponents(pu.reducePathComponents(components)) + path_1.sep
        : pu.combinePathComponents(pu.reducePathComponents(components));
}
exports.validate = validate;
function getInvalidRootComponentRegExp() {
    const escapedSeparator = pu.getRegexEscapedSeparator();
    return new RegExp(`^(?!(${escapedSeparator}|${escapedSeparator}${escapedSeparator}w+${escapedSeparator}|[a-zA-Z]:${escapedSeparator}?|)$)`);
}
//# sourceMappingURL=pathValidation.js.map