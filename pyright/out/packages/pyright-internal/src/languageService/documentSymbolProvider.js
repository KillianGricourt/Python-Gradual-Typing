"use strict";
/*
 * documentSymbolProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that enumerates all of the symbols within a specified
 * source file document.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentSymbolProvider = exports.convertToFlatSymbols = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const analyzerNodeInfo_1 = require("../analyzer/analyzerNodeInfo");
const cancellationUtils_1 = require("../common/cancellationUtils");
const uriUtils_1 = require("../common/uri/uriUtils");
const symbolIndexer_1 = require("./symbolIndexer");
function convertToFlatSymbols(program, uri, symbolList) {
    const flatSymbols = [];
    for (const symbol of symbolList) {
        _appendToFlatSymbolsRecursive(program.fileSystem, flatSymbols, uri, symbol);
    }
    return flatSymbols;
}
exports.convertToFlatSymbols = convertToFlatSymbols;
class DocumentSymbolProvider {
    constructor(program, uri, _supportHierarchicalDocumentSymbol, _indexOptions, _token) {
        this.program = program;
        this.uri = uri;
        this._supportHierarchicalDocumentSymbol = _supportHierarchicalDocumentSymbol;
        this._indexOptions = _indexOptions;
        this._token = _token;
        this._parseResults = this.program.getParseResults(this.uri);
    }
    getSymbols() {
        if (!this._parseResults) {
            return [];
        }
        const symbolList = this.getHierarchicalSymbols();
        if (this._supportHierarchicalDocumentSymbol) {
            return symbolList;
        }
        return convertToFlatSymbols(this.program, this.uri, symbolList);
    }
    getHierarchicalSymbols() {
        const symbolList = [];
        const parseResults = this.program.getParseResults(this.uri);
        if (!parseResults) {
            return symbolList;
        }
        const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(parseResults.parserOutput.parseTree);
        if (!fileInfo) {
            return symbolList;
        }
        const indexSymbolData = symbolIndexer_1.SymbolIndexer.indexSymbols(fileInfo, parseResults, this._indexOptions, this._token);
        this.appendDocumentSymbolsRecursive(indexSymbolData, symbolList);
        return symbolList;
    }
    appendDocumentSymbolsRecursive(indexSymbolData, symbolList) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!indexSymbolData) {
            return;
        }
        for (const symbolData of indexSymbolData) {
            if (symbolData.alias) {
                continue;
            }
            // It's possible for a name to be '' under certain error
            // conditions (such as a decorator with no associated function
            // or class).
            if (!symbolData.name) {
                continue;
            }
            const children = [];
            this.appendDocumentSymbolsRecursive(symbolData.children, children);
            const symbolInfo = {
                name: symbolData.name,
                kind: symbolData.kind,
                range: symbolData.range,
                selectionRange: symbolData.selectionRange,
                children: children,
            };
            symbolList.push(symbolInfo);
        }
    }
}
exports.DocumentSymbolProvider = DocumentSymbolProvider;
function _appendToFlatSymbolsRecursive(fs, flatSymbols, documentUri, symbol, parent) {
    const flatSymbol = {
        name: symbol.name,
        kind: symbol.kind,
        location: vscode_languageserver_1.Location.create((0, uriUtils_1.convertUriToLspUriString)(fs, documentUri), symbol.range),
    };
    if (symbol.tags) {
        flatSymbol.tags = symbol.tags;
    }
    if (parent) {
        flatSymbol.containerName = parent.name;
    }
    flatSymbols.push(flatSymbol);
    if (symbol.children) {
        for (const child of symbol.children) {
            _appendToFlatSymbolsRecursive(fs, flatSymbols, documentUri, child, symbol);
        }
    }
}
//# sourceMappingURL=documentSymbolProvider.js.map