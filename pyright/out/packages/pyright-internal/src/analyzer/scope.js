"use strict";
/*
 * scope.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Represents an evaluation scope and its defined symbols.
 * It also contains a link to a parent scope (except for the
 * top-most built-in scope).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scope = void 0;
const debug_1 = require("../common/debug");
const symbol_1 = require("./symbol");
class Scope {
    constructor(type, parent, proxy) {
        // Association between names and symbols.
        this.symbolTable = new Map();
        // Names within this scope that are bound to other scopes
        // (either nonlocal or global).
        this.notLocalBindings = new Map();
        this.type = type;
        this.parent = parent;
        this.proxy = proxy;
    }
    getGlobalScope() {
        let curScope = this;
        let isBeyondExecutionScope = false;
        while (curScope) {
            if (curScope.type === 4 /* ScopeType.Module */ || curScope.type === 5 /* ScopeType.Builtin */) {
                return { scope: curScope, isBeyondExecutionScope };
            }
            if (curScope.type === 2 /* ScopeType.Function */) {
                isBeyondExecutionScope = true;
            }
            curScope = curScope.parent;
        }
        (0, debug_1.fail)('failed to find scope');
        return { scope: this, isBeyondExecutionScope };
    }
    // Independently-executable scopes are those that are executed independently
    // of their parent scopes. Classes are executed in the context of their parent
    // scope, so they don't fit this category.
    isIndependentlyExecutable() {
        return this.type === 4 /* ScopeType.Module */ || this.type === 2 /* ScopeType.Function */;
    }
    lookUpSymbol(name) {
        return this.symbolTable.get(name);
    }
    lookUpSymbolRecursive(name, options) {
        let effectiveScope = this;
        let symbol = this.symbolTable.get(name);
        if (!symbol && (options === null || options === void 0 ? void 0 : options.useProxyScope) && this.proxy) {
            symbol = this.proxy.symbolTable.get(name);
            effectiveScope = this.proxy;
        }
        if (symbol) {
            // If we're searching outside of the original caller's module (global) scope,
            // hide any names that are not meant to be visible to importers.
            if ((options === null || options === void 0 ? void 0 : options.isOutsideCallerModule) && symbol.isExternallyHidden()) {
                return undefined;
            }
            // If the symbol is a class variable that is defined only in terms of
            // member accesses, it is not accessible directly by name, so hide it.
            const decls = symbol.getDeclarations();
            if (decls.length === 0 ||
                decls.some((decl) => decl.type !== 1 /* DeclarationType.Variable */ || !decl.isDefinedByMemberAccess)) {
                return {
                    symbol,
                    isOutsideCallerModule: !!(options === null || options === void 0 ? void 0 : options.isOutsideCallerModule),
                    isBeyondExecutionScope: !!(options === null || options === void 0 ? void 0 : options.isBeyondExecutionScope),
                    scope: effectiveScope,
                    usesNonlocalBinding: !!(options === null || options === void 0 ? void 0 : options.usesNonlocalBinding),
                    usesGlobalBinding: !!(options === null || options === void 0 ? void 0 : options.usesGlobalBinding),
                };
            }
        }
        let parentScope;
        let isNextScopeBeyondExecutionScope = (options === null || options === void 0 ? void 0 : options.isBeyondExecutionScope) || this.isIndependentlyExecutable();
        const notLocalBinding = this.notLocalBindings.get(name);
        if (notLocalBinding === 1 /* NameBindingType.Global */) {
            const globalScopeResult = this.getGlobalScope();
            if (globalScopeResult.scope !== this) {
                parentScope = globalScopeResult.scope;
                if (globalScopeResult.isBeyondExecutionScope) {
                    isNextScopeBeyondExecutionScope = true;
                }
            }
        }
        else {
            parentScope = this.parent;
        }
        if (parentScope) {
            // If our recursion is about to take us outside the scope of the current
            // module (i.e. into a built-in scope), indicate as such with the second
            // parameter.
            return parentScope.lookUpSymbolRecursive(name, {
                isOutsideCallerModule: !!(options === null || options === void 0 ? void 0 : options.isOutsideCallerModule) || this.type === 4 /* ScopeType.Module */,
                isBeyondExecutionScope: isNextScopeBeyondExecutionScope,
                usesNonlocalBinding: notLocalBinding === 0 /* NameBindingType.Nonlocal */ || !!(options === null || options === void 0 ? void 0 : options.usesNonlocalBinding),
                usesGlobalBinding: notLocalBinding === 1 /* NameBindingType.Global */ || !!(options === null || options === void 0 ? void 0 : options.usesGlobalBinding),
            });
        }
        return undefined;
    }
    addSymbol(name, flags) {
        const symbol = new symbol_1.Symbol(flags);
        this.symbolTable.set(name, symbol);
        return symbol;
    }
    getBindingType(name) {
        return this.notLocalBindings.get(name);
    }
    setBindingType(name, bindingType) {
        return this.notLocalBindings.set(name, bindingType);
    }
    setSlotsNames(names) {
        this.slotsNames = names;
    }
    getSlotsNames() {
        return this.slotsNames;
    }
}
exports.Scope = Scope;
//# sourceMappingURL=scope.js.map