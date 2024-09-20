"use strict";
/*
 * documentSymbolCollector.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Collects symbols within the given tree that are semantically
 * equivalent to the requested symbol.
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
exports.addDeclarationIfUnique = exports.getDeclarationsForNameNode = exports.DocumentSymbolCollector = exports.AliasResolver = void 0;
const AnalyzerNodeInfo = __importStar(require("../analyzer/analyzerNodeInfo"));
const declaration_1 = require("../analyzer/declaration");
const declarationUtils_1 = require("../analyzer/declarationUtils");
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const parseTreeWalker_1 = require("../analyzer/parseTreeWalker");
const ScopeUtils = __importStar(require("../analyzer/scopeUtils"));
const sourceFile_1 = require("../analyzer/sourceFile");
const sourceFileInfoUtils_1 = require("../analyzer/sourceFileInfoUtils");
const sourceMapper_1 = require("../analyzer/sourceMapper");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const core_1 = require("../common/core");
const debug_1 = require("../common/debug");
const extensibility_1 = require("../common/extensibility");
const serviceKeys_1 = require("../common/serviceKeys");
// 99% of time, `find all references` is looking for a symbol imported from the other file to this file.
// By caching the result of `resolveAlias` we only need to resolve it once per a file.
const withLocalNamesCacheIndex = 0;
const withoutLocalNamesCacheIndex = 1;
class AliasResolver {
    constructor(_evaluator) {
        this._evaluator = _evaluator;
        this._caches = [undefined, undefined];
        // Empty
    }
    resolve(declaration, resolveLocalNames) {
        const index = resolveLocalNames ? withLocalNamesCacheIndex : withoutLocalNamesCacheIndex;
        if (this._caches[index] && this._caches[index].original === declaration) {
            return this._caches[index].resolved;
        }
        const resolved = this._evaluator.resolveAliasDeclaration(declaration, resolveLocalNames, {
            allowExternallyHiddenAccess: true,
            skipFileNeededCheck: true,
        });
        this._caches[index] = { original: declaration, resolved };
        return resolved;
    }
}
exports.AliasResolver = AliasResolver;
// This walker looks for symbols that are semantically equivalent
// to the requested symbol.
class DocumentSymbolCollector extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_program, symbolNames, declarations, _startingNode, _cancellationToken, options) {
        var _a, _b, _c, _d, _e;
        super();
        this._program = _program;
        this._startingNode = _startingNode;
        this._cancellationToken = _cancellationToken;
        this._results = [];
        this._dunderAllNameNodes = new Set();
        this._symbolNames = new Set();
        this._declarations = [];
        this._aliasResolver = new AliasResolver(this._program.evaluator);
        // Start with the symbols passed in
        symbolNames.forEach((s) => this._symbolNames.add(s));
        this._declarations.push(...declarations);
        this._treatModuleInImportAndFromImportSame = (_a = options === null || options === void 0 ? void 0 : options.treatModuleInImportAndFromImportSame) !== null && _a !== void 0 ? _a : false;
        this._skipUnreachableCode = (_b = options === null || options === void 0 ? void 0 : options.skipUnreachableCode) !== null && _b !== void 0 ? _b : true;
        this._useCase = (_c = options === null || options === void 0 ? void 0 : options.useCase) !== null && _c !== void 0 ? _c : extensibility_1.ReferenceUseCase.References;
        this._usageProviders =
            (_d = options === null || options === void 0 ? void 0 : options.providers) !== null && _d !== void 0 ? _d : ((_e = this._program.serviceProvider.tryGet(serviceKeys_1.ServiceKeys.symbolUsageProviderFactory)) !== null && _e !== void 0 ? _e : [])
                .map((f) => f.tryCreateProvider(this._useCase, declarations, this._cancellationToken))
                .filter(core_1.isDefined);
        if ((options === null || options === void 0 ? void 0 : options.providers) === undefined) {
            // Check whether we need to add new symbol names and declarations.
            this._usageProviders.forEach((p) => {
                p.appendSymbolNamesTo(this._symbolNames);
                p.appendDeclarationsTo(this._declarations);
            });
        }
        // Don't report strings in __all__ right away, that will
        // break the assumption on the result ordering.
        this._setDunderAllNodes(this._startingNode);
    }
    static collectFromNode(program, node, cancellationToken, startingNode, options) {
        const declarations = this.getDeclarationsForNode(program, node, /* resolveLocalName */ true, cancellationToken);
        startingNode = startingNode !== null && startingNode !== void 0 ? startingNode : (0, parseTreeUtils_1.getModuleNode)(node);
        if (!startingNode) {
            return [];
        }
        const collector = new DocumentSymbolCollector(program, [node.value], declarations, startingNode, cancellationToken, options);
        return collector.collect();
    }
    static getDeclarationsForNode(program, node, resolveLocalName, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const evaluator = program.evaluator;
        if (!evaluator) {
            return [];
        }
        const declarations = getDeclarationsForNameNode(evaluator, node, /* skipUnreachableCode */ false);
        const fileInfo = AnalyzerNodeInfo.getFileInfo(node);
        const fileUri = fileInfo.fileUri;
        const resolvedDeclarations = [];
        const sourceMapper = program.getSourceMapper(fileUri, token);
        declarations.forEach((decl) => {
            const resolvedDecl = evaluator.resolveAliasDeclaration(decl, resolveLocalName);
            if (resolvedDecl) {
                addDeclarationIfUnique(resolvedDeclarations, resolvedDecl);
                if (sourceMapper && (0, sourceMapper_1.isStubFile)(resolvedDecl.uri)) {
                    const implDecls = sourceMapper.findDeclarations(resolvedDecl);
                    for (const implDecl of implDecls) {
                        if (implDecl && !implDecl.uri.isEmpty()) {
                            addDeclarationIfUnique(resolvedDeclarations, implDecl);
                        }
                    }
                }
            }
        });
        const sourceFileInfo = program.getSourceFileInfo(fileUri);
        if (sourceFileInfo && sourceFileInfo.sourceFile.getIPythonMode() === sourceFile_1.IPythonMode.CellDocs) {
            // Add declarations from chained source files
            let builtinsScope = fileInfo.builtinsScope;
            while (builtinsScope && builtinsScope.type === 4 /* ScopeType.Module */) {
                const symbol = builtinsScope === null || builtinsScope === void 0 ? void 0 : builtinsScope.lookUpSymbol(node.value);
                appendSymbolDeclarations(symbol, resolvedDeclarations);
                builtinsScope = builtinsScope === null || builtinsScope === void 0 ? void 0 : builtinsScope.parent;
            }
            // Add declarations from files that implicitly import the target file.
            const implicitlyImportedBy = (0, sourceFileInfoUtils_1.collectImportedByCells)(program, sourceFileInfo);
            implicitlyImportedBy.forEach((implicitImport) => {
                var _a;
                const parseTree = (_a = program.getParseResults(implicitImport.sourceFile.getUri())) === null || _a === void 0 ? void 0 : _a.parserOutput.parseTree;
                if (parseTree) {
                    const scope = AnalyzerNodeInfo.getScope(parseTree);
                    const symbol = scope === null || scope === void 0 ? void 0 : scope.lookUpSymbol(node.value);
                    appendSymbolDeclarations(symbol, resolvedDeclarations);
                }
            });
        }
        return resolvedDeclarations;
        function appendSymbolDeclarations(symbol, declarations) {
            symbol === null || symbol === void 0 ? void 0 : symbol.getDeclarations().filter((d) => !(0, declaration_1.isAliasDeclaration)(d)).forEach((decl) => {
                const resolvedDecl = evaluator.resolveAliasDeclaration(decl, resolveLocalName);
                if (resolvedDecl) {
                    addDeclarationIfUnique(declarations, resolvedDecl);
                }
            });
        }
    }
    collect() {
        this.walk(this._startingNode);
        return this._results;
    }
    walk(node) {
        if (!this._skipUnreachableCode || !AnalyzerNodeInfo.isCodeUnreachable(node)) {
            super.walk(node);
        }
    }
    visitName(node) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._cancellationToken);
        // No need to do any more work if the symbol name doesn't match.
        if (!this._symbolNames.has(node.value)) {
            return false;
        }
        if (this._declarations.length > 0) {
            const declarations = getDeclarationsForNameNode(this._evaluator, node, this._skipUnreachableCode);
            if (declarations && declarations.length > 0) {
                // Does this name share a declaration with the symbol of interest?
                if (this._resultsContainsDeclaration(node, declarations)) {
                    this._addResult(node);
                }
            }
        }
        else {
            // There were no declarations
            this._addResult(node);
        }
        return false;
    }
    visitStringList(node) {
        // See if we have reference that matches this node.
        if (this._declarations.some((d) => { var _a; return ((_a = d.node) === null || _a === void 0 ? void 0 : _a.id) === node.id; })) {
            // Then the matching string should be included
            const matching = node.strings.find((s) => this._symbolNames.has(s.value));
            if (matching && matching.nodeType === 49 /* ParseNodeType.String */) {
                this._addResult(matching);
            }
        }
        return super.visitStringList(node);
    }
    visitString(node) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._cancellationToken);
        if (this._dunderAllNameNodes.has(node)) {
            this._addResult(node);
        }
        return false;
    }
    get _evaluator() {
        return this._program.evaluator;
    }
    _addResult(node) {
        const range = node.nodeType === 38 /* ParseNodeType.Name */ ? node.token : (0, parseTreeUtils_1.getStringNodeValueRange)(node);
        this._results.push({ node, range });
    }
    _isDeclarationAllowed(resolvedDecl) {
        return this._declarations.some((decl) => (0, declarationUtils_1.areDeclarationsSame)(decl, resolvedDecl, this._treatModuleInImportAndFromImportSame, 
        /* skipRangeForAliases */ true));
    }
    _resultsContainsDeclaration(usage, declarations) {
        const results = [...declarations];
        this._usageProviders.forEach((p) => p.appendDeclarationsAt(usage, declarations, results));
        return results.some((declaration) => {
            // Resolve the declaration.
            const resolvedDecl = this._aliasResolver.resolve(declaration, /* resolveLocalNames */ false);
            if (!resolvedDecl) {
                return false;
            }
            // The reference results declarations are already resolved, so we don't
            // need to call resolveAliasDeclaration on them.
            if (this._isDeclarationAllowed(resolvedDecl)) {
                return true;
            }
            // We didn't find the declaration using local-only alias resolution. Attempt
            // it again by fully resolving the alias.
            const resolvedDeclNonlocal = this._getResolveAliasDeclaration(resolvedDecl);
            if (!resolvedDeclNonlocal || resolvedDeclNonlocal === resolvedDecl) {
                return false;
            }
            return this._isDeclarationAllowed(resolvedDeclNonlocal);
        });
    }
    _getResolveAliasDeclaration(declaration) {
        // TypeEvaluator.resolveAliasDeclaration only resolve alias in AliasDeclaration in the form of
        // "from x import y as [y]" but don't do thing for alias in "import x as [x]"
        // Here, alias should have same name as module name.
        if (isAliasDeclFromImportAsWithAlias(declaration)) {
            return (0, declarationUtils_1.getDeclarationsWithUsesLocalNameRemoved)([declaration])[0];
        }
        const resolvedDecl = this._aliasResolver.resolve(declaration, /* resolveLocalNames */ true);
        return isAliasDeclFromImportAsWithAlias(resolvedDecl)
            ? (0, declarationUtils_1.getDeclarationsWithUsesLocalNameRemoved)([resolvedDecl])[0]
            : resolvedDecl;
        function isAliasDeclFromImportAsWithAlias(decl) {
            return (!!decl &&
                decl.type === 8 /* DeclarationType.Alias */ &&
                decl.node &&
                decl.usesLocalName &&
                decl.node.nodeType === 24 /* ParseNodeType.ImportAs */);
        }
    }
    _setDunderAllNodes(node) {
        if (node.nodeType !== 36 /* ParseNodeType.Module */) {
            return;
        }
        const dunderAllInfo = AnalyzerNodeInfo.getDunderAllInfo(node);
        if (!dunderAllInfo) {
            return;
        }
        const moduleScope = ScopeUtils.getScopeForNode(node);
        if (!moduleScope) {
            return;
        }
        dunderAllInfo.stringNodes.forEach((stringNode) => {
            if (!this._symbolNames.has(stringNode.value)) {
                return;
            }
            const symbolInScope = moduleScope.lookUpSymbolRecursive(stringNode.value);
            if (!symbolInScope) {
                return;
            }
            if (!this._resultsContainsDeclaration(stringNode, symbolInScope.symbol.getDeclarations())) {
                return;
            }
            this._dunderAllNameNodes.add(stringNode);
        });
    }
}
exports.DocumentSymbolCollector = DocumentSymbolCollector;
function getDeclarationsForNameNode(evaluator, node, skipUnreachableCode = true) {
    var _a;
    // This can handle symbols brought in by wildcard (import *) as long as the declarations that the symbol collector
    // compares against point to the actual alias declaration, not one that uses local name (ex, import alias)
    if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 37 /* ParseNodeType.ModuleName */) {
        return _getDeclarationsForNonModuleNameNode(evaluator, node, skipUnreachableCode);
    }
    return _getDeclarationsForModuleNameNode(evaluator, node);
}
exports.getDeclarationsForNameNode = getDeclarationsForNameNode;
function addDeclarationIfUnique(declarations, itemToAdd) {
    for (const def of declarations) {
        if ((0, declarationUtils_1.areDeclarationsSame)(def, itemToAdd, 
        /* treatModuleInImportAndFromImportSame */ false, 
        /* skipRangeForAliases */ true)) {
            return;
        }
    }
    declarations.push(itemToAdd);
}
exports.addDeclarationIfUnique = addDeclarationIfUnique;
function _getDeclarationsForNonModuleNameNode(evaluator, node, skipUnreachableCode = true) {
    var _a, _b;
    (0, debug_1.assert)(((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 37 /* ParseNodeType.ModuleName */);
    let decls = evaluator.getDeclarationsForNameNode(node, skipUnreachableCode) || [];
    if (((_b = node.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 26 /* ParseNodeType.ImportFromAs */) {
        // Make sure we get the decl for this specific "from import" statement
        decls = decls.filter((d) => d.node === node.parent);
    }
    // If we can't get decl, see whether we can get type from the node.
    // Some might have synthesized type for the node such as subModule in import X.Y statement.
    if (decls.length === 0) {
        const type = evaluator.getType(node);
        if ((type === null || type === void 0 ? void 0 : type.category) === 7 /* TypeCategory.Module */) {
            // Synthesize decl for the module.
            return [(0, declarationUtils_1.createSynthesizedAliasDeclaration)(type.fileUri)];
        }
    }
    // We would like to make X in import X and import X.Y as Y to match, but path for
    // X in import X and one in import X.Y as Y might not match since path in X.Y will point
    // to X.Y rather than X if import statement has an alias.
    // so, for such case, we put synthesized one so we can treat X in both statement same.
    for (const aliasDecl of decls.filter((d) => (0, declaration_1.isAliasDeclaration)(d) && !d.loadSymbolsFromPath)) {
        const node = aliasDecl.node;
        if (node.nodeType === 26 /* ParseNodeType.ImportFromAs */) {
            // from ... import X case, decl in the submodule fallback has the path.
            continue;
        }
        (0, collectionUtils_1.appendArray)(decls, evaluator.getDeclarationsForNameNode(node.module.nameParts[0], skipUnreachableCode) || []);
    }
    return decls;
}
function _getDeclarationsForModuleNameNode(evaluator, node) {
    var _a, _b, _c, _d, _e;
    (0, debug_1.assert)(((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 37 /* ParseNodeType.ModuleName */);
    // We don't have symbols corresponding to ModuleName in our system since those
    // are not referenceable. but in "find all reference", we want to match those
    // if it refers to the same module file. Code below handles different kind of
    // ModuleName cases.
    const moduleName = node.parent;
    if (((_b = moduleName.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 24 /* ParseNodeType.ImportAs */ ||
        ((_c = moduleName.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 25 /* ParseNodeType.ImportFrom */) {
        const index = moduleName.nameParts.findIndex((n) => n === node);
        // Special case, first module name part.
        if (index === 0) {
            // 1. import X or from X import ...
            const decls = [];
            // First, we need to put decls for module names type evaluator synthesized so that
            // we can match both "import X" and "from X import ..."
            (0, collectionUtils_1.appendArray)(decls, ((_d = evaluator.getDeclarationsForNameNode(moduleName.nameParts[0])) === null || _d === void 0 ? void 0 : _d.filter((d) => (0, declaration_1.isAliasDeclaration)(d))) ||
                []);
            if (decls.length === 0 || moduleName.parent.nodeType !== 24 /* ParseNodeType.ImportAs */) {
                return decls;
            }
            // If module name belong to "import xxx" not "from xxx", then see whether
            // we can get regular decls (decls created from binder, not synthesized from type eval)
            // from symbol as well.
            // ex, import X as x
            const isImportAsWithAlias = moduleName.nameParts.length === 1 &&
                moduleName.parent.nodeType === 24 /* ParseNodeType.ImportAs */ &&
                !!moduleName.parent.alias;
            // if "import" has alias, symbol is assigned to alias, not the module.
            const importName = isImportAsWithAlias
                ? moduleName.parent.alias.value
                : moduleName.nameParts[0].value;
            // And we also need to re-use "decls for X" binder has created
            // so that it matches with decls type evaluator returns for "references for X".
            // ex) import X or from .X import ... in init file and etc.
            const symbolWithScope = (_e = ScopeUtils.getScopeForNode(node)) === null || _e === void 0 ? void 0 : _e.lookUpSymbolRecursive(importName);
            if (symbolWithScope && moduleName.nameParts.length === 1) {
                let declsFromSymbol = [];
                (0, collectionUtils_1.appendArray)(declsFromSymbol, symbolWithScope.symbol.getDeclarations().filter((d) => (0, declaration_1.isAliasDeclaration)(d)));
                // If symbols are re-used, then find one that belong to this import statement.
                if (declsFromSymbol.length > 1) {
                    declsFromSymbol = declsFromSymbol.filter((d) => {
                        d = d;
                        if (d.firstNamePart !== undefined) {
                            // For multiple import statements with sub modules, decl can be re-used.
                            // ex) import X.Y and import X.Z or from .X import ... in init file.
                            // Decls for X will be reused for both import statements, and node will point
                            // to first import statement. For those case, use firstNamePart instead to check.
                            return d.firstNamePart === moduleName.nameParts[0].value;
                        }
                        return d.node === moduleName.parent;
                    });
                }
                // ex, import X as x
                // We have decls for the alias "x" not the module name "X". Convert decls for the "X"
                if (isImportAsWithAlias) {
                    declsFromSymbol = (0, declarationUtils_1.getDeclarationsWithUsesLocalNameRemoved)(declsFromSymbol);
                }
                (0, collectionUtils_1.appendArray)(decls, declsFromSymbol);
            }
            return decls;
        }
        if (index > 0) {
            // 2. import X.Y or from X.Y import ....
            // For submodule "Y", we just use synthesized decls from type evaluator.
            // Decls for these sub module don't actually exist in the system. Instead, symbol for Y in
            // "import X.Y" hold onto synthesized module type (without any decl).
            // And "from X.Y import ..." doesn't have any symbol associated module names.
            // they can't be referenced in the module.
            return evaluator.getDeclarationsForNameNode(moduleName.nameParts[index]) || [];
        }
        return [];
    }
    return [];
}
//# sourceMappingURL=documentSymbolCollector.js.map