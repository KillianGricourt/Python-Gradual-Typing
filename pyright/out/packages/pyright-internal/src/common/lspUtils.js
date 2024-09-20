"use strict";
/*
 * lspUtils.ts
 * Copyright (c) Microsoft Corporation.
 *
 * Helper functions related to the Language Server Protocol (LSP).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSymbolKind = exports.fromLSPAny = exports.toLSPAny = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const typeUtils_1 = require("../analyzer/typeUtils");
// Converts an internal object to LSPAny to be sent out via LSP
function toLSPAny(obj) {
    return obj;
}
exports.toLSPAny = toLSPAny;
// Converts an LSPAny object received via LSP to our internal representation.
function fromLSPAny(lspAny) {
    return lspAny;
}
exports.fromLSPAny = fromLSPAny;
function getSymbolKind(declaration, evaluator, name = '') {
    var _a;
    switch (declaration.type) {
        case 6 /* DeclarationType.Class */:
        case 7 /* DeclarationType.SpecialBuiltInClass */:
            return vscode_languageserver_1.SymbolKind.Class;
        case 5 /* DeclarationType.Function */: {
            if (!declaration.isMethod) {
                return vscode_languageserver_1.SymbolKind.Function;
            }
            const declType = (_a = evaluator === null || evaluator === void 0 ? void 0 : evaluator.getTypeForDeclaration(declaration)) === null || _a === void 0 ? void 0 : _a.type;
            if (declType && (0, typeUtils_1.isMaybeDescriptorInstance)(declType, /* requireSetter */ false)) {
                return vscode_languageserver_1.SymbolKind.Property;
            }
            return vscode_languageserver_1.SymbolKind.Method;
        }
        case 8 /* DeclarationType.Alias */:
            return vscode_languageserver_1.SymbolKind.Module;
        case 2 /* DeclarationType.Parameter */:
            if (name === 'self' || name === 'cls' || name === '_') {
                return undefined;
            }
            return vscode_languageserver_1.SymbolKind.Variable;
        case 3 /* DeclarationType.TypeParameter */:
            return vscode_languageserver_1.SymbolKind.TypeParameter;
        case 1 /* DeclarationType.Variable */:
            if (name === '_') {
                return undefined;
            }
            return declaration.isConstant || declaration.isFinal ? vscode_languageserver_1.SymbolKind.Constant : vscode_languageserver_1.SymbolKind.Variable;
        default:
            return vscode_languageserver_1.SymbolKind.Variable;
    }
}
exports.getSymbolKind = getSymbolKind;
//# sourceMappingURL=lspUtils.js.map