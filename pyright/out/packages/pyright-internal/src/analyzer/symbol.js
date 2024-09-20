"use strict";
/*
 * symbol.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Represents an association between a name and the type
 * (or multiple types) that the symbol is associated with
 * in the program.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Symbol = exports.indeterminateSymbolId = void 0;
const declarationUtils_1 = require("./declarationUtils");
let nextSymbolId = 1;
function getUniqueSymbolId() {
    return nextSymbolId++;
}
// Symbol ID that indicates that there is no specific symbol.
exports.indeterminateSymbolId = 0;
class Symbol {
    constructor(flags) {
        this.id = getUniqueSymbolId();
        this._flags = flags;
    }
    static createWithType(flags, type) {
        const newSymbol = new Symbol(flags);
        newSymbol._synthesizedType = type;
        return newSymbol;
    }
    isInitiallyUnbound() {
        return !!(this._flags & 1 /* SymbolFlags.InitiallyUnbound */);
    }
    setIsExternallyHidden() {
        this._flags |= 2 /* SymbolFlags.ExternallyHidden */;
    }
    isExternallyHidden() {
        return !!(this._flags & 2 /* SymbolFlags.ExternallyHidden */);
    }
    setIsIgnoredForProtocolMatch() {
        this._flags |= 64 /* SymbolFlags.IgnoredForProtocolMatch */;
    }
    isIgnoredForProtocolMatch() {
        return !!(this._flags & 64 /* SymbolFlags.IgnoredForProtocolMatch */);
    }
    setIsClassMember() {
        this._flags |= 4 /* SymbolFlags.ClassMember */;
    }
    isClassMember() {
        return !!(this._flags & 4 /* SymbolFlags.ClassMember */);
    }
    setIsInstanceMember() {
        this._flags |= 8 /* SymbolFlags.InstanceMember */;
    }
    isInstanceMember() {
        return !!(this._flags & 8 /* SymbolFlags.InstanceMember */);
    }
    setIsClassVar() {
        this._flags |= 128 /* SymbolFlags.ClassVar */;
    }
    isClassVar() {
        return !!(this._flags & 128 /* SymbolFlags.ClassVar */);
    }
    setIsFinalVarInClassBody() {
        this._flags |= 8192 /* SymbolFlags.FinalVarInClassBody */;
    }
    isFinalVarInClassBody() {
        return !!(this._flags & 8192 /* SymbolFlags.FinalVarInClassBody */);
    }
    setIsInitVar() {
        this._flags |= 1024 /* SymbolFlags.InitVar */;
    }
    isInitVar() {
        return !!(this._flags & 1024 /* SymbolFlags.InitVar */);
    }
    setIsInDunderAll() {
        this._flags |= 256 /* SymbolFlags.InDunderAll */;
    }
    isInDunderAll() {
        return !!(this._flags & 256 /* SymbolFlags.InDunderAll */);
    }
    setIsPrivateMember() {
        this._flags |= 32 /* SymbolFlags.PrivateMember */;
    }
    isPrivateMember() {
        return !!(this._flags & 32 /* SymbolFlags.PrivateMember */);
    }
    setPrivatePyTypedImport() {
        this._flags |= 512 /* SymbolFlags.PrivatePyTypedImport */;
    }
    isPrivatePyTypedImport() {
        return !!(this._flags & 512 /* SymbolFlags.PrivatePyTypedImport */);
    }
    isNamedTupleMemberMember() {
        return !!(this._flags & 2048 /* SymbolFlags.NamedTupleMember */);
    }
    isIgnoredForOverrideChecks() {
        return !!(this._flags & 4096 /* SymbolFlags.IgnoredForOverrideChecks */);
    }
    addDeclaration(declaration) {
        if (this._declarations) {
            // See if this node was already identified as a declaration. If so,
            // replace it. Otherwise, add it as a new declaration to the end of
            // the list.
            const declIndex = this._declarations.findIndex((decl) => (0, declarationUtils_1.areDeclarationsSame)(decl, declaration));
            if (declIndex < 0) {
                this._declarations.push(declaration);
                // If there is more than one declaration for a symbol, we will
                // assume it is not a type alias.
                this._declarations.forEach((decl) => {
                    if (decl.type === 1 /* DeclarationType.Variable */ && decl.typeAliasName) {
                        delete decl.typeAliasName;
                    }
                });
            }
            else {
                // If the new declaration has a defined type, it should replace
                // the existing one.
                const curDecl = this._declarations[declIndex];
                if ((0, declarationUtils_1.hasTypeForDeclaration)(declaration)) {
                    this._declarations[declIndex] = declaration;
                    if (curDecl.type === 1 /* DeclarationType.Variable */ && declaration.type === 1 /* DeclarationType.Variable */) {
                        if (!declaration.inferredTypeSource && curDecl.inferredTypeSource) {
                            declaration.inferredTypeSource = curDecl.inferredTypeSource;
                        }
                    }
                }
                else if (declaration.type === 1 /* DeclarationType.Variable */) {
                    // If it's marked "final" or "type alias", this should be reflected
                    // in the existing declaration. Likewise, if the existing declaration
                    // doesn't have a type source, add it.
                    if (curDecl.type === 1 /* DeclarationType.Variable */) {
                        if (declaration.isFinal) {
                            curDecl.isFinal = true;
                        }
                        curDecl.typeAliasName = declaration.typeAliasName;
                        if (!curDecl.inferredTypeSource && declaration.inferredTypeSource) {
                            curDecl.inferredTypeSource = declaration.inferredTypeSource;
                        }
                    }
                }
            }
        }
        else {
            this._declarations = [declaration];
        }
    }
    hasDeclarations() {
        return this._declarations ? this._declarations.length > 0 : false;
    }
    getDeclarations() {
        return this._declarations ? this._declarations : [];
    }
    hasTypedDeclarations() {
        // We'll treat an synthesized type as an implicit declaration.
        if (this._synthesizedType) {
            return true;
        }
        return this.getDeclarations().some((decl) => (0, declarationUtils_1.hasTypeForDeclaration)(decl));
    }
    getTypedDeclarations() {
        return this.getDeclarations().filter((decl) => (0, declarationUtils_1.hasTypeForDeclaration)(decl));
    }
    getSynthesizedType() {
        return this._synthesizedType;
    }
}
exports.Symbol = Symbol;
//# sourceMappingURL=symbol.js.map