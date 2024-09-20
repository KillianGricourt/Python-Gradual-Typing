"use strict";
/*
 * documentHighlightProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that maps a position within a Python program file into
 * one or more highlight types.
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
exports.DocumentHighlightProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const cancellationUtils_1 = require("../common/cancellationUtils");
const extensibility_1 = require("../common/extensibility");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
const documentSymbolCollector_1 = require("./documentSymbolCollector");
class DocumentHighlightProvider {
    constructor(_program, _fileUri, _position, _token) {
        this._program = _program;
        this._fileUri = _fileUri;
        this._position = _position;
        this._token = _token;
        this._parseResults = this._program.getParseResults(this._fileUri);
    }
    getDocumentHighlight() {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return undefined;
        }
        const offset = (0, positionUtils_1.convertPositionToOffset)(this._position, this._parseResults.tokenizerOutput.lines);
        if (offset === undefined) {
            return undefined;
        }
        const node = ParseTreeUtils.findNodeByOffset(this._parseResults.parserOutput.parseTree, offset);
        if (node === undefined) {
            return undefined;
        }
        if (node.nodeType !== 38 /* ParseNodeType.Name */) {
            return undefined;
        }
        const results = documentSymbolCollector_1.DocumentSymbolCollector.collectFromNode(this._program, node, this._token, this._parseResults.parserOutput.parseTree, {
            treatModuleInImportAndFromImportSame: true,
            useCase: extensibility_1.ReferenceUseCase.References,
        });
        const lines = this._parseResults.tokenizerOutput.lines;
        return results.map((r) => ({
            kind: r.node.nodeType === 38 /* ParseNodeType.Name */ && ParseTreeUtils.isWriteAccess(r.node)
                ? vscode_languageserver_1.DocumentHighlightKind.Write
                : vscode_languageserver_1.DocumentHighlightKind.Read,
            range: (0, positionUtils_1.convertOffsetsToRange)(r.range.start, textRange_1.TextRange.getEnd(r.range), lines),
        }));
    }
}
exports.DocumentHighlightProvider = DocumentHighlightProvider;
//# sourceMappingURL=documentHighlightProvider.js.map