"use strict";
/*
 * workspaceSymbolProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Provide langue server workspace symbol functionality.
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
exports.WorkspaceSymbolProvider = void 0;
const analyzerNodeInfo_1 = require("../analyzer/analyzerNodeInfo");
const sourceFileInfoUtils_1 = require("../analyzer/sourceFileInfoUtils");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const StringUtils = __importStar(require("../common/stringUtils"));
const uriUtils_1 = require("../common/uri/uriUtils");
const symbolIndexer_1 = require("./symbolIndexer");
class WorkspaceSymbolProvider {
    constructor(_workspaces, resultReporter, _query, _token) {
        this._workspaces = _workspaces;
        this._query = _query;
        this._token = _token;
        this._allSymbols = [];
        this._reporter = resultReporter
            ? (symbols) => resultReporter.report(symbols)
            : (symbols) => (0, collectionUtils_1.appendArray)(this._allSymbols, symbols);
    }
    reportSymbols() {
        for (const workspace of this._workspaces) {
            if (workspace.disableLanguageServices || workspace.disableWorkspaceSymbol) {
                continue;
            }
            if (!workspace.isInitialized.resolved()) {
                // If workspace is not resolved, ignore this workspace and move on.
                // We could wait for the initialization but that cause this to be async
                // so for now, we will just ignore any workspace that is not initialized yet.
                continue;
            }
            workspace.service.run((program) => {
                this._reportSymbolsForProgram(program);
            }, this._token);
        }
        return this._allSymbols;
    }
    getSymbolsForDocument(program, fileUri) {
        const symbolList = [];
        const parseResults = program.getParseResults(fileUri);
        if (!parseResults) {
            return symbolList;
        }
        const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(parseResults.parserOutput.parseTree);
        if (!fileInfo) {
            return symbolList;
        }
        const indexSymbolData = symbolIndexer_1.SymbolIndexer.indexSymbols(fileInfo, parseResults, { includeAliases: false }, this._token);
        this.appendWorkspaceSymbolsRecursive(indexSymbolData, program, fileUri, '', symbolList);
        return symbolList;
    }
    appendWorkspaceSymbolsRecursive(indexSymbolData, program, fileUri, container, symbolList) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!indexSymbolData) {
            return;
        }
        for (const symbolData of indexSymbolData) {
            if (symbolData.alias) {
                continue;
            }
            if (StringUtils.isPatternInSymbol(this._query, symbolData.name)) {
                const location = {
                    uri: (0, uriUtils_1.convertUriToLspUriString)(program.fileSystem, fileUri),
                    range: symbolData.selectionRange,
                };
                const symbolInfo = {
                    name: symbolData.name,
                    kind: symbolData.kind,
                    location,
                };
                if (container.length) {
                    symbolInfo.containerName = container;
                }
                symbolList.push(symbolInfo);
            }
            this.appendWorkspaceSymbolsRecursive(symbolData.children, program, fileUri, this._getContainerName(container, symbolData.name), symbolList);
        }
    }
    _reportSymbolsForProgram(program) {
        // Don't do a search if the query is empty. We'll return
        // too many results in this case.
        if (!this._query) {
            return;
        }
        // "Workspace symbols" searches symbols only from user code.
        for (const sourceFileInfo of program.getSourceFileInfoList()) {
            if (!(0, sourceFileInfoUtils_1.isUserCode)(sourceFileInfo)) {
                continue;
            }
            const symbolList = this.getSymbolsForDocument(program, sourceFileInfo.sourceFile.getUri());
            if (symbolList.length > 0) {
                this._reporter(symbolList);
            }
            // This operation can consume significant memory, so check
            // for situations where we need to discard the type cache.
            program.handleMemoryHighUsage();
        }
    }
    _getContainerName(container, name) {
        if (container.length > 0) {
            return `${container}.${name}`;
        }
        return name;
    }
}
exports.WorkspaceSymbolProvider = WorkspaceSymbolProvider;
//# sourceMappingURL=workspaceSymbolProvider.js.map