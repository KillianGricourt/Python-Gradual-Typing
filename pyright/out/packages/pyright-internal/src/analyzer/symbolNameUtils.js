"use strict";
/*
 * symbolNameUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Static methods that apply to symbols or symbol names.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPublicConstantOrTypeAlias = exports.isTypeAliasName = exports.isConstantName = exports.isSingleDunderName = exports.isDunderName = exports.isPrivateOrProtectedName = exports.isProtectedName = exports.isPrivateName = void 0;
const _constantRegEx = /^[A-Z0-9_]+$/;
const _underscoreOnlyRegEx = /^[_]+$/;
const _camelCaseRegEx = /^_{0,2}[A-Z][A-Za-z0-9_]+$/;
// Private symbol names start with a double underscore.
function isPrivateName(name) {
    return name.length > 2 && name.startsWith('__') && !name.endsWith('__');
}
exports.isPrivateName = isPrivateName;
// Protected symbol names start with a single underscore.
function isProtectedName(name) {
    return name.length > 1 && name.startsWith('_') && !name.startsWith('__');
}
exports.isProtectedName = isProtectedName;
function isPrivateOrProtectedName(name) {
    return isPrivateName(name) || isProtectedName(name);
}
exports.isPrivateOrProtectedName = isPrivateOrProtectedName;
// "Dunder" names start and end with two underscores.
function isDunderName(name) {
    return name.length > 4 && name.startsWith('__') && name.endsWith('__');
}
exports.isDunderName = isDunderName;
// "Single Dunder" names start and end with single underscores.
function isSingleDunderName(name) {
    return name.length > 2 && name.startsWith('_') && name.endsWith('_');
}
exports.isSingleDunderName = isSingleDunderName;
// Constants are all-caps with possible numbers and underscores.
function isConstantName(name) {
    return !!name.match(_constantRegEx) && !name.match(_underscoreOnlyRegEx);
}
exports.isConstantName = isConstantName;
// Type aliases are CamelCase with possible numbers and underscores.
function isTypeAliasName(name) {
    return !!name.match(_camelCaseRegEx);
}
exports.isTypeAliasName = isTypeAliasName;
function isPublicConstantOrTypeAlias(name) {
    return !isPrivateOrProtectedName(name) && (isConstantName(name) || isTypeAliasName(name));
}
exports.isPublicConstantOrTypeAlias = isPublicConstantOrTypeAlias;
//# sourceMappingURL=symbolNameUtils.js.map