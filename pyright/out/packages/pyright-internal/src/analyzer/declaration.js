"use strict";
/*
 * declaration.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Tracks the location within the code where a named entity
 * is declared and its associated declared type (if the type
 * is explicitly declared).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUnresolvedAliasDeclaration = exports.isIntrinsicDeclaration = exports.isSpecialBuiltInClassDeclaration = exports.isAliasDeclaration = exports.isVariableDeclaration = exports.isTypeAliasDeclaration = exports.isTypeParameterDeclaration = exports.isParameterDeclaration = exports.isClassDeclaration = exports.isFunctionDeclaration = exports.UnresolvedModuleMarker = void 0;
const uri_1 = require("../common/uri/uri");
exports.UnresolvedModuleMarker = uri_1.Uri.constant('*** unresolved module ***');
function isFunctionDeclaration(decl) {
    return decl.type === 5 /* DeclarationType.Function */;
}
exports.isFunctionDeclaration = isFunctionDeclaration;
function isClassDeclaration(decl) {
    return decl.type === 6 /* DeclarationType.Class */;
}
exports.isClassDeclaration = isClassDeclaration;
function isParameterDeclaration(decl) {
    return decl.type === 2 /* DeclarationType.Parameter */;
}
exports.isParameterDeclaration = isParameterDeclaration;
function isTypeParameterDeclaration(decl) {
    return decl.type === 3 /* DeclarationType.TypeParameter */;
}
exports.isTypeParameterDeclaration = isTypeParameterDeclaration;
function isTypeAliasDeclaration(decl) {
    return decl.type === 4 /* DeclarationType.TypeAlias */;
}
exports.isTypeAliasDeclaration = isTypeAliasDeclaration;
function isVariableDeclaration(decl) {
    return decl.type === 1 /* DeclarationType.Variable */;
}
exports.isVariableDeclaration = isVariableDeclaration;
function isAliasDeclaration(decl) {
    return decl.type === 8 /* DeclarationType.Alias */;
}
exports.isAliasDeclaration = isAliasDeclaration;
function isSpecialBuiltInClassDeclaration(decl) {
    return decl.type === 7 /* DeclarationType.SpecialBuiltInClass */;
}
exports.isSpecialBuiltInClassDeclaration = isSpecialBuiltInClassDeclaration;
function isIntrinsicDeclaration(decl) {
    return decl.type === 0 /* DeclarationType.Intrinsic */;
}
exports.isIntrinsicDeclaration = isIntrinsicDeclaration;
function isUnresolvedAliasDeclaration(decl) {
    return isAliasDeclaration(decl) && decl.uri.equals(exports.UnresolvedModuleMarker);
}
exports.isUnresolvedAliasDeclaration = isUnresolvedAliasDeclaration;
//# sourceMappingURL=declaration.js.map