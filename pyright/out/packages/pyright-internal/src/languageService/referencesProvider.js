"use strict";
/*
 * referencesProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that finds all of the references to a symbol specified
 * by a location within a file.
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
exports.ReferencesProvider = exports.FindReferencesTreeWalker = exports.ReferencesResult = void 0;
const declaration_1 = require("../analyzer/declaration");
const declarationUtils_1 = require("../analyzer/declarationUtils");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const sourceFileInfoUtils_1 = require("../analyzer/sourceFileInfoUtils");
const symbolUtils_1 = require("../analyzer/symbolUtils");
const types_1 = require("../analyzer/types");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const core_1 = require("../common/core");
const debug_1 = require("../common/debug");
const extensibility_1 = require("../common/extensibility");
const positionUtils_1 = require("../common/positionUtils");
const serviceKeys_1 = require("../common/serviceKeys");
const textRange_1 = require("../common/textRange");
const documentSymbolCollector_1 = require("./documentSymbolCollector");
const navigationUtils_1 = require("./navigationUtils");
class ReferencesResult {
    constructor(requiresGlobalSearch, nodeAtOffset, symbolNames, declarations, useCase, providers, _reporter) {
        this.requiresGlobalSearch = requiresGlobalSearch;
        this.nodeAtOffset = nodeAtOffset;
        this.symbolNames = symbolNames;
        this.declarations = declarations;
        this.useCase = useCase;
        this.providers = providers;
        this._reporter = _reporter;
        this._locations = [];
        // Filter out any import decls. but leave one with alias.
        this.nonImportDeclarations = declarations.filter((d) => {
            var _a;
            if (!(0, declaration_1.isAliasDeclaration)(d)) {
                return true;
            }
            // We must have alias and decl node that point to import statement.
            if (!d.usesLocalName || !d.node) {
                return false;
            }
            // d.node can't be ImportFrom if usesLocalName is true.
            // but we are doing this for type checker.
            if (d.node.nodeType === 25 /* ParseNodeType.ImportFrom */) {
                return false;
            }
            // Extract alias for comparison (symbolNames.some can't know d is for an Alias).
            const alias = (_a = d.node.alias) === null || _a === void 0 ? void 0 : _a.value;
            // Check alias and what we are renaming is same thing.
            if (!symbolNames.some((s) => s === alias)) {
                return false;
            }
            return true;
        });
    }
    get containsOnlyImportDecls() {
        return this.declarations.length > 0 && this.nonImportDeclarations.length === 0;
    }
    get locations() {
        return this._locations;
    }
    addLocations(...locs) {
        if (locs.length === 0) {
            return;
        }
        if (this._reporter) {
            this._reporter(locs);
        }
        (0, collectionUtils_1.appendArray)(this._locations, locs);
    }
}
exports.ReferencesResult = ReferencesResult;
class FindReferencesTreeWalker {
    constructor(_program, _fileUri, _referencesResult, _includeDeclaration, _cancellationToken, _createDocumentRange = FindReferencesTreeWalker.createDocumentRange) {
        this._program = _program;
        this._fileUri = _fileUri;
        this._referencesResult = _referencesResult;
        this._includeDeclaration = _includeDeclaration;
        this._cancellationToken = _cancellationToken;
        this._createDocumentRange = _createDocumentRange;
        this._parseResults = this._program.getParseResults(this._fileUri);
    }
    findReferences(rootNode) {
        var _a;
        if (rootNode === void 0) { rootNode = (_a = this._parseResults) === null || _a === void 0 ? void 0 : _a.parserOutput.parseTree; }
        const results = [];
        if (!this._parseResults) {
            return results;
        }
        const collector = new documentSymbolCollector_1.DocumentSymbolCollector(this._program, this._referencesResult.symbolNames, this._referencesResult.declarations, rootNode, this._cancellationToken, {
            treatModuleInImportAndFromImportSame: true,
            skipUnreachableCode: false,
            useCase: this._referencesResult.useCase,
            providers: this._referencesResult.providers,
        });
        for (const result of collector.collect()) {
            // Is it the same symbol?
            if (this._includeDeclaration || result.node !== this._referencesResult.nodeAtOffset) {
                results.push(this._createDocumentRange(this._fileUri, result, this._parseResults));
            }
        }
        return results;
    }
    static createDocumentRange(fileUri, result, parseResults) {
        return {
            uri: fileUri,
            range: {
                start: (0, positionUtils_1.convertOffsetToPosition)(result.range.start, parseResults.tokenizerOutput.lines),
                end: (0, positionUtils_1.convertOffsetToPosition)(textRange_1.TextRange.getEnd(result.range), parseResults.tokenizerOutput.lines),
            },
        };
    }
}
exports.FindReferencesTreeWalker = FindReferencesTreeWalker;
class ReferencesProvider {
    constructor(_program, _token, _createDocumentRange, _convertToLocation) {
        this._program = _program;
        this._token = _token;
        this._createDocumentRange = _createDocumentRange;
        this._convertToLocation = _convertToLocation;
        // empty
    }
    reportReferences(fileUri, position, includeDeclaration, resultReporter) {
        const sourceFileInfo = this._program.getSourceFileInfo(fileUri);
        if (!sourceFileInfo) {
            return;
        }
        const parseResults = this._program.getParseResults(fileUri);
        if (!parseResults) {
            return;
        }
        const locations = [];
        const reporter = resultReporter
            ? (range) => resultReporter.report((0, navigationUtils_1.convertDocumentRangesToLocation)(this._program.fileSystem, range, this._convertToLocation))
            : (range) => (0, collectionUtils_1.appendArray)(locations, (0, navigationUtils_1.convertDocumentRangesToLocation)(this._program.fileSystem, range, this._convertToLocation));
        const invokedFromUserFile = (0, sourceFileInfoUtils_1.isUserCode)(sourceFileInfo);
        const referencesResult = ReferencesProvider.getDeclarationForPosition(this._program, fileUri, position, reporter, extensibility_1.ReferenceUseCase.References, this._token);
        if (!referencesResult) {
            return;
        }
        // Do we need to do a global search as well?
        if (!referencesResult.requiresGlobalSearch) {
            this.addReferencesToResult(sourceFileInfo.sourceFile.getUri(), includeDeclaration, referencesResult);
        }
        for (const curSourceFileInfo of this._program.getSourceFileInfoList()) {
            (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
            // "Find all references" will only include references from user code
            // unless the file is explicitly opened in the editor or it is invoked from non user files.
            if (curSourceFileInfo.isOpenByClient || !invokedFromUserFile || (0, sourceFileInfoUtils_1.isUserCode)(curSourceFileInfo)) {
                // See if the reference symbol's string is located somewhere within the file.
                // If not, we can skip additional processing for the file.
                const fileContents = curSourceFileInfo.sourceFile.getFileContent();
                if (!fileContents || referencesResult.symbolNames.some((s) => fileContents.search(s) >= 0)) {
                    this.addReferencesToResult(curSourceFileInfo.sourceFile.getUri(), includeDeclaration, referencesResult);
                }
                // This operation can consume significant memory, so check
                // for situations where we need to discard the type cache.
                this._program.handleMemoryHighUsage();
            }
        }
        // Make sure to include declarations regardless where they are defined
        // if includeDeclaration is set.
        if (includeDeclaration) {
            for (const decl of referencesResult.declarations) {
                (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
                if (referencesResult.locations.some((l) => l.uri.equals(decl.uri))) {
                    // Already included.
                    continue;
                }
                const declFileInfo = this._program.getSourceFileInfo(decl.uri);
                if (!declFileInfo) {
                    // The file the declaration belongs to doesn't belong to the program.
                    continue;
                }
                const tempResult = new ReferencesResult(referencesResult.requiresGlobalSearch, referencesResult.nodeAtOffset, referencesResult.symbolNames, referencesResult.declarations, referencesResult.useCase, referencesResult.providers);
                this.addReferencesToResult(declFileInfo.sourceFile.getUri(), includeDeclaration, tempResult);
                for (const loc of tempResult.locations) {
                    // Include declarations only. And throw away any references
                    if (loc.uri.equals(decl.uri) && (0, textRange_1.doesRangeContain)(decl.range, loc.range)) {
                        referencesResult.addLocations(loc);
                    }
                }
            }
        }
        // Deduplicate locations before returning them.
        const locationsSet = new Set();
        const dedupedLocations = [];
        for (const loc of locations) {
            const key = `${loc.uri.toString()}:${loc.range.start.line}:${loc.range.start.character}`;
            if (!locationsSet.has(key)) {
                locationsSet.add(key);
                dedupedLocations.push(loc);
            }
        }
        return dedupedLocations;
    }
    addReferencesToResult(fileUri, includeDeclaration, referencesResult) {
        const parseResults = this._program.getParseResults(fileUri);
        if (!parseResults) {
            return;
        }
        const refTreeWalker = new FindReferencesTreeWalker(this._program, fileUri, referencesResult, includeDeclaration, this._token, this._createDocumentRange);
        referencesResult.addLocations(...refTreeWalker.findReferences());
    }
    static getDeclarationForNode(program, fileUri, node, reporter, useCase, token) {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const declarations = documentSymbolCollector_1.DocumentSymbolCollector.getDeclarationsForNode(program, node, 
        /* resolveLocalNames */ false, token);
        if (declarations.length === 0) {
            return undefined;
        }
        const requiresGlobalSearch = isVisibleOutside(program.evaluator, fileUri, node, declarations);
        const symbolNames = new Set(declarations.map((d) => (0, declarationUtils_1.getNameFromDeclaration)(d)).filter((n) => !!n));
        symbolNames.add(node.value);
        const providers = ((_a = program.serviceProvider.tryGet(serviceKeys_1.ServiceKeys.symbolUsageProviderFactory)) !== null && _a !== void 0 ? _a : [])
            .map((f) => f.tryCreateProvider(useCase, declarations, token))
            .filter(core_1.isDefined);
        // Check whether we need to add new symbol names and declarations.
        providers.forEach((p) => {
            p.appendSymbolNamesTo(symbolNames);
            p.appendDeclarationsTo(declarations);
        });
        return new ReferencesResult(requiresGlobalSearch, node, Array.from(symbolNames.values()), declarations, useCase, providers, reporter);
    }
    static getDeclarationForPosition(program, fileUri, position, reporter, useCase, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const parseResults = program.getParseResults(fileUri);
        if (!parseResults) {
            return undefined;
        }
        const offset = (0, positionUtils_1.convertPositionToOffset)(position, parseResults.tokenizerOutput.lines);
        if (offset === undefined) {
            return undefined;
        }
        const node = ParseTreeUtils.findNodeByOffset(parseResults.parserOutput.parseTree, offset);
        if (node === undefined) {
            return undefined;
        }
        // If this isn't a name node, there are no references to be found.
        if (node.nodeType !== 38 /* ParseNodeType.Name */) {
            return undefined;
        }
        return this.getDeclarationForNode(program, fileUri, node, reporter, useCase, token);
    }
}
exports.ReferencesProvider = ReferencesProvider;
function isVisibleOutside(evaluator, currentUri, node, declarations) {
    const result = evaluator.lookUpSymbolRecursive(node, node.value, /* honorCodeFlow */ false);
    if (result && !isExternallyVisible(result.symbol)) {
        return false;
    }
    // A symbol's effective external visibility check is not enough to determine whether
    // the symbol is visible to the outside. Something like the local variable inside
    // a function will still say it is externally visible even if it can't be accessed from another module.
    // So, we also need to determine whether the symbol is declared within an evaluation scope
    // that is within the current file and cannot be imported directly from other modules.
    return declarations.some((decl) => {
        var _a, _b;
        // If the declaration is outside of this file, a global search is needed.
        if (!decl.uri.equals(currentUri)) {
            return true;
        }
        const evalScope = ParseTreeUtils.getEvaluationScopeNode(decl.node).node;
        // If the declaration is at the module level or a class level, it can be seen
        // outside of the current module, so a global search is needed.
        if (evalScope.nodeType === 36 /* ParseNodeType.Module */ || evalScope.nodeType === 10 /* ParseNodeType.Class */) {
            return true;
        }
        // If the name node is a member variable, we need to do a global search.
        if (((_b = (_a = decl.node) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 35 /* ParseNodeType.MemberAccess */ && decl.node === decl.node.parent.memberName) {
            return true;
        }
        return false;
    });
    // Return true if the symbol is visible outside of current module, false if not.
    function isExternallyVisible(symbol, recursionCount = 0) {
        if (recursionCount > types_1.maxTypeRecursionCount) {
            return false;
        }
        recursionCount++;
        if (!(0, symbolUtils_1.isVisibleExternally)(symbol)) {
            return false;
        }
        return symbol.getDeclarations().reduce((isVisible, decl) => {
            if (!isVisible) {
                return false;
            }
            switch (decl.type) {
                case 8 /* DeclarationType.Alias */:
                case 0 /* DeclarationType.Intrinsic */:
                case 7 /* DeclarationType.SpecialBuiltInClass */:
                    return isVisible;
                case 6 /* DeclarationType.Class */:
                case 5 /* DeclarationType.Function */:
                    return isVisible && isContainerExternallyVisible(decl.node.name, recursionCount);
                case 2 /* DeclarationType.Parameter */:
                    return isVisible && isContainerExternallyVisible(decl.node.name, recursionCount);
                case 3 /* DeclarationType.TypeParameter */:
                    return false;
                case 1 /* DeclarationType.Variable */:
                case 4 /* DeclarationType.TypeAlias */: {
                    if (decl.node.nodeType === 38 /* ParseNodeType.Name */) {
                        return isVisible && isContainerExternallyVisible(decl.node, recursionCount);
                    }
                    // Symbol without name is not visible outside.
                    return false;
                }
                default:
                    (0, debug_1.assertNever)(decl);
            }
        }, /* visible */ true);
    }
    // Return true if the scope that contains the specified node is visible
    // outside of the current module, false if not.
    function isContainerExternallyVisible(node, recursionCount) {
        const scopingNode = ParseTreeUtils.getEvaluationScopeNode(node).node;
        switch (scopingNode.nodeType) {
            case 10 /* ParseNodeType.Class */:
            case 31 /* ParseNodeType.Function */: {
                const name = scopingNode.name;
                const result = evaluator.lookUpSymbolRecursive(name, name.value, /* honorCodeFlow */ false);
                return result ? isExternallyVisible(result.symbol, recursionCount) : true;
            }
            case 33 /* ParseNodeType.Lambda */:
            case 11 /* ParseNodeType.Comprehension */:
            case 76 /* ParseNodeType.TypeParameterList */:
                // Symbols in this scope can't be visible outside.
                return false;
            case 36 /* ParseNodeType.Module */:
                return true;
            default:
                (0, debug_1.assertNever)(scopingNode);
        }
    }
}
//# sourceMappingURL=referencesProvider.js.map