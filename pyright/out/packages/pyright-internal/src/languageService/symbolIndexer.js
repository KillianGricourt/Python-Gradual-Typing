"use strict";
/*
 * symbolIndexer.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Logic that collect all symbol decl information for a specified source file.
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
exports.SymbolIndexer = void 0;
const AnalyzerNodeInfo = __importStar(require("../analyzer/analyzerNodeInfo"));
const symbolUtils_1 = require("../analyzer/symbolUtils");
const cancellationUtils_1 = require("../common/cancellationUtils");
const lspUtils_1 = require("../common/lspUtils");
const positionUtils_1 = require("../common/positionUtils");
const autoImporter_1 = require("./autoImporter");
class SymbolIndexer {
    static indexSymbols(fileInfo, parseResults, indexOptions, token) {
        // Here are the rule of what symbols are indexed for a file.
        // 1. If it is a stub file, we index every public symbols defined by "https://www.python.org/dev/peps/pep-0484/#stub-files"
        // 2. If it is a py file and it is py.typed package, we index public symbols
        //    defined by "https://github.com/microsoft/pyright/blob/main/docs/typed-libraries.md#library-interface"
        // 3. If it is a py file and it is not py.typed package, we index only symbols that appear in
        //    __all__ to make sure we don't include too many symbols in the index.
        const indexSymbolData = [];
        collectSymbolIndexData(fileInfo, parseResults, parseResults.parserOutput.parseTree, indexOptions, indexSymbolData, token);
        return indexSymbolData;
    }
}
exports.SymbolIndexer = SymbolIndexer;
function collectSymbolIndexData(fileInfo, parseResults, node, indexOptions, indexSymbolData, token) {
    (0, cancellationUtils_1.throwIfCancellationRequested)(token);
    const scope = AnalyzerNodeInfo.getScope(node);
    if (!scope) {
        return;
    }
    const symbolTable = scope.symbolTable;
    symbolTable.forEach((symbol, name) => {
        if (symbol.isIgnoredForProtocolMatch()) {
            return;
        }
        // Prefer declarations with a defined type.
        let declaration = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(symbol);
        // Fall back to declarations without a type.
        if (!declaration && symbol.hasDeclarations()) {
            declaration = symbol.getDeclarations()[0];
        }
        if (!declaration) {
            return;
        }
        if (8 /* DeclarationType.Alias */ === declaration.type && !shouldAliasBeIndexed(declaration, indexOptions)) {
            return;
        }
        // We rely on ExternallyHidden flag to determine what
        // symbols should be public (included in the index)
        collectSymbolIndexDataForName(fileInfo, parseResults, declaration, indexOptions, (0, symbolUtils_1.isVisibleExternally)(symbol), name, indexSymbolData, token);
    });
}
function collectSymbolIndexDataForName(fileInfo, parseResults, declaration, indexOptions, externallyVisible, name, indexSymbolData, token) {
    const symbolKind = (0, lspUtils_1.getSymbolKind)(declaration, undefined, name);
    if (symbolKind === undefined) {
        return;
    }
    let selectionRange = declaration.range;
    let range = selectionRange;
    const children = [];
    if (declaration.type === 6 /* DeclarationType.Class */ || declaration.type === 5 /* DeclarationType.Function */) {
        collectSymbolIndexData(fileInfo, parseResults, declaration.node, indexOptions, children, token);
        range = (0, positionUtils_1.convertOffsetsToRange)(declaration.node.start, declaration.node.start + declaration.node.length, parseResults.tokenizerOutput.lines);
    }
    if (8 /* DeclarationType.Alias */ === declaration.type) {
        if (!shouldAliasBeIndexed(declaration, indexOptions)) {
            return;
        }
        // The default range for a module alias is the first character of the module's file.
        // Replace that with the range of the alias token.
        if (declaration.node.nodeType === 24 /* ParseNodeType.ImportAs */ && declaration.node.alias) {
            selectionRange = range = (0, positionUtils_1.convertTextRangeToRange)(declaration.node.alias.token, parseResults.tokenizerOutput.lines);
        }
    }
    const data = {
        name,
        externallyVisible,
        kind: symbolKind,
        itemKind: (0, autoImporter_1.convertSymbolKindToCompletionItemKind)(symbolKind),
        alias: undefined,
        range: range,
        selectionRange: selectionRange,
        children: children,
    };
    indexSymbolData.push(data);
}
function shouldAliasBeIndexed(declaration, indexOptions) {
    if (!indexOptions.includeAliases) {
        return false;
    }
    // Only allow import statements with an alias (`import module as alias` or
    // `from module import symbol as alias`), since the alias is a symbol specific
    // to the importing file.
    return ((declaration.node.nodeType === 24 /* ParseNodeType.ImportAs */ ||
        declaration.node.nodeType === 26 /* ParseNodeType.ImportFromAs */) &&
        declaration.node.alias !== undefined);
}
//# sourceMappingURL=symbolIndexer.js.map