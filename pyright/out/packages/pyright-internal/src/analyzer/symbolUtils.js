"use strict";
/*
 * symbolUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Functions that operate on Symbol objects.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEffectivelyClassVar = exports.isVisibleExternally = exports.isTypedDictMemberAccessedThroughIndex = exports.getLastTypedDeclarationForSymbol = void 0;
function getLastTypedDeclarationForSymbol(symbol) {
    const typedDecls = symbol.getTypedDeclarations();
    if (typedDecls.length > 0) {
        return typedDecls[typedDecls.length - 1];
    }
    return undefined;
}
exports.getLastTypedDeclarationForSymbol = getLastTypedDeclarationForSymbol;
// Within TypedDict classes, member variables are not accessible as
// normal attributes. Instead, they are accessed through index operations.
function isTypedDictMemberAccessedThroughIndex(symbol) {
    const typedDecls = symbol.getTypedDeclarations();
    if (typedDecls.length > 0) {
        const lastDecl = typedDecls[typedDecls.length - 1];
        if (lastDecl.type === 1 /* DeclarationType.Variable */) {
            return true;
        }
    }
    return false;
}
exports.isTypedDictMemberAccessedThroughIndex = isTypedDictMemberAccessedThroughIndex;
function isVisibleExternally(symbol) {
    return !symbol.isExternallyHidden() && !symbol.isPrivatePyTypedImport();
}
exports.isVisibleExternally = isVisibleExternally;
function isEffectivelyClassVar(symbol, isInDataclass) {
    if (symbol.isClassVar()) {
        return true;
    }
    if (symbol.isFinalVarInClassBody()) {
        return !isInDataclass;
    }
    return false;
}
exports.isEffectivelyClassVar = isEffectivelyClassVar;
//# sourceMappingURL=symbolUtils.js.map