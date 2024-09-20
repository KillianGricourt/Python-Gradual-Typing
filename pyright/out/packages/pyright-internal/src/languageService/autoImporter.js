"use strict";
/*
 * autoImporter.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Logic for performing auto-import completions.
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
exports.convertSymbolKindToCompletionItemKind = exports.AutoImporter = exports.addModuleSymbolsMap = exports.buildModuleSymbolsMap = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const importStatementUtils_1 = require("../analyzer/importStatementUtils");
const sourceFileInfoUtils_1 = require("../analyzer/sourceFileInfoUtils");
const SymbolNameUtils = __importStar(require("../analyzer/symbolNameUtils"));
const symbolUtils_1 = require("../analyzer/symbolUtils");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const pathUtils_1 = require("../common/pathUtils");
const StringUtils = __importStar(require("../common/stringUtils"));
const completionProvider_1 = require("./completionProvider");
// Build a map of all modules within this program and the module-
// level scope that contains the symbol table for the module.
function buildModuleSymbolsMap(files) {
    const map = new Map();
    addModuleSymbolsMap(files, map);
    return map;
}
exports.buildModuleSymbolsMap = buildModuleSymbolsMap;
function addModuleSymbolsMap(files, moduleSymbolMap) {
    files.forEach((file) => {
        if (file.shadows.length > 0) {
            // There is corresponding stub file. Don't add
            // duplicated files in the map.
            return;
        }
        const uri = file.sourceFile.getUri();
        const symbolTable = file.sourceFile.getModuleSymbolTable();
        if (!symbolTable) {
            return;
        }
        const fileName = (0, pathUtils_1.stripFileExtension)(uri.fileName);
        // Don't offer imports from files that are named with private
        // naming semantics like "_ast.py" unless they're in the current userfile list.
        if (SymbolNameUtils.isPrivateOrProtectedName(fileName) && !(0, sourceFileInfoUtils_1.isUserCode)(file)) {
            return;
        }
        moduleSymbolMap.set(uri.key, {
            uri,
            forEach(callbackfn) {
                symbolTable.forEach((symbol, name) => {
                    if (!(0, symbolUtils_1.isVisibleExternally)(symbol)) {
                        return;
                    }
                    const declarations = symbol.getDeclarations();
                    if (!declarations || declarations.length === 0) {
                        return;
                    }
                    const declaration = declarations[0];
                    if (!declaration) {
                        return;
                    }
                    if (declaration.type === 8 /* DeclarationType.Alias */ && (0, sourceFileInfoUtils_1.isUserCode)(file)) {
                        // We don't include import alias in auto import
                        // for workspace files.
                        return;
                    }
                    const variableKind = declaration.type === 1 /* DeclarationType.Variable */ && !declaration.isConstant && !declaration.isFinal
                        ? vscode_languageserver_1.SymbolKind.Variable
                        : undefined;
                    callbackfn({ symbol, kind: variableKind }, name, /* library */ !(0, sourceFileInfoUtils_1.isUserCode)(file));
                });
            },
        });
        return;
    });
}
exports.addModuleSymbolsMap = addModuleSymbolsMap;
class AutoImporter {
    constructor(execEnvironment, program, importResolver, parseResults, _invocationPosition, _excludes, moduleSymbolMap, options) {
        this.execEnvironment = execEnvironment;
        this.program = program;
        this.importResolver = importResolver;
        this.parseResults = parseResults;
        this._invocationPosition = _invocationPosition;
        this._excludes = _excludes;
        this.moduleSymbolMap = moduleSymbolMap;
        this.options = options;
        this._importStatements = (0, importStatementUtils_1.getTopLevelImports)(this.parseResults.parserOutput.parseTree, 
        /* includeImplicitImports */ true);
    }
    getAutoImportCandidates(word, similarityLimit, abbrFromUsers, token) {
        const results = [];
        const map = this.getCandidates(word, similarityLimit, abbrFromUsers, token);
        map.forEach((v) => (0, collectionUtils_1.appendArray)(results, v));
        return results;
    }
    getCandidates(word, similarityLimit, abbrFromUsers, token) {
        const resultMap = new Map();
        const importAliasMap = new Map();
        this.addImportsFromModuleMap(word, similarityLimit, abbrFromUsers, importAliasMap, resultMap, token);
        this.addImportsFromImportAliasMap(importAliasMap, abbrFromUsers, resultMap, token);
        return resultMap;
    }
    addImportsFromModuleMap(word, similarityLimit, abbrFromUsers, aliasMap, results, token) {
        this.moduleSymbolMap.forEach((topLevelSymbols, key) => {
            // See if this file should be offered as an implicit import.
            const uriProperties = this.getUriProperties(this.moduleSymbolMap, topLevelSymbols.uri);
            this.processModuleSymbolTable(topLevelSymbols, topLevelSymbols.uri, word, similarityLimit, uriProperties, abbrFromUsers, aliasMap, results, token);
        });
    }
    addImportsFromImportAliasMap(importAliasMap, abbrFromUsers, results, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        importAliasMap.forEach((mapPerSymbolName) => {
            mapPerSymbolName.forEach((importAliasData, originalName) => {
                var _a, _b;
                if (abbrFromUsers) {
                    // When alias name is used, our regular exclude mechanism would not work. we need to check
                    // whether import, the alias is referring to, already exists.
                    // ex) import numpy
                    //     np| <= auto-import here.
                    // or
                    //     from scipy import io as spio
                    //     io| <= auto-import here
                    // If import statement for the module already exist, then bail out.
                    // ex) import module[.submodule] or from module[.submodule] import symbol
                    if (this._importStatements.mapByFilePath.has(importAliasData.importParts.fileUri.key)) {
                        return;
                    }
                    // If it is the module itself that got imported, make sure we don't import it again.
                    // ex) from module import submodule as ss
                    //     submodule <= auto-import here
                    if (importAliasData.importParts.importFrom) {
                        const imported = this._importStatements.orderedImports.find((i) => i.moduleName === importAliasData.importParts.importFrom);
                        if (imported &&
                            imported.node.nodeType === 25 /* ParseNodeType.ImportFrom */ &&
                            imported.node.imports.some((i) => i.name.value === importAliasData.importParts.symbolName)) {
                            return;
                        }
                    }
                }
                const alreadyIncluded = this._containsName(importAliasData.importParts.importName, importAliasData.importParts.importFrom, results);
                if (alreadyIncluded) {
                    return;
                }
                const autoImportTextEdits = this._getTextEditsForAutoImportByFilePath({ name: importAliasData.importParts.symbolName, alias: abbrFromUsers }, {
                    name: (_a = importAliasData.importParts.importFrom) !== null && _a !== void 0 ? _a : importAliasData.importParts.importName,
                }, importAliasData.importParts.importName, importAliasData.importGroup, importAliasData.importParts.fileUri);
                this._addResult(results, {
                    name: importAliasData.importParts.importName,
                    alias: abbrFromUsers,
                    symbol: importAliasData.symbol,
                    kind: (_b = importAliasData.itemKind) !== null && _b !== void 0 ? _b : convertSymbolKindToCompletionItemKind(importAliasData.kind),
                    source: importAliasData.importParts.importFrom,
                    insertionText: autoImportTextEdits.insertionText,
                    edits: autoImportTextEdits.edits,
                    declUri: importAliasData.importParts.fileUri,
                    originalName,
                    originalDeclUri: importAliasData.fileUri,
                });
            });
        });
    }
    processModuleSymbolTable(topLevelSymbols, moduleUri, word, similarityLimit, fileProperties, abbrFromUsers, importAliasMap, results, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        const [importSource, importGroup, moduleNameAndType] = this._getImportPartsForSymbols(moduleUri);
        if (!importSource) {
            return;
        }
        const dotCount = StringUtils.getCharacterCount(importSource, '.');
        topLevelSymbols.forEach((autoImportSymbol, name) => {
            var _a;
            if (!this._shouldIncludeVariable(autoImportSymbol, name, fileProperties.isStub, !fileProperties.isUserCode)) {
                return;
            }
            // For very short matching strings, we will require an exact match. Otherwise
            // we will tend to return a list that's too long. Once we get beyond two
            // characters, we can do a fuzzy match.
            const isSimilar = this._isSimilar(word, name, similarityLimit);
            if (!isSimilar) {
                return;
            }
            const alreadyIncluded = this._containsName(name, importSource, results);
            if (alreadyIncluded) {
                return;
            }
            // We will collect all aliases and then process it later
            if (autoImportSymbol.importAlias) {
                this._addToImportAliasMap(autoImportSymbol.importAlias, {
                    importParts: {
                        symbolName: name,
                        importName: name,
                        importFrom: importSource,
                        fileUri: moduleUri,
                        dotCount,
                        moduleNameAndType,
                    },
                    importGroup,
                    symbol: autoImportSymbol.symbol,
                    kind: autoImportSymbol.importAlias.kind,
                    itemKind: autoImportSymbol.importAlias.itemKind,
                    fileUri: autoImportSymbol.importAlias.moduleUri,
                }, importAliasMap);
                return;
            }
            const nameForImportFrom = this.getNameForImportFrom(/* library */ !fileProperties.isUserCode, moduleUri);
            const autoImportTextEdits = this._getTextEditsForAutoImportByFilePath({ name, alias: abbrFromUsers }, { name: importSource, nameForImportFrom }, name, importGroup, moduleUri);
            this._addResult(results, {
                name,
                alias: abbrFromUsers,
                symbol: autoImportSymbol.symbol,
                source: importSource,
                kind: (_a = autoImportSymbol.itemKind) !== null && _a !== void 0 ? _a : convertSymbolKindToCompletionItemKind(autoImportSymbol.kind),
                insertionText: autoImportTextEdits.insertionText,
                edits: autoImportTextEdits.edits,
                declUri: moduleUri,
                originalName: name,
                originalDeclUri: moduleUri,
            });
        });
        // If the current file is in a directory that also contains an "__init__.py[i]"
        // file, we can use that directory name as an implicit import target.
        // Or if the file is a stub file, we can use it as import target.
        // Skip this check for user code.
        if (!fileProperties.isStub && !fileProperties.hasInit && !fileProperties.isUserCode) {
            return;
        }
        const importParts = this._getImportParts(moduleUri);
        if (!importParts) {
            return;
        }
        const isSimilar = this._isSimilar(word, importParts.importName, similarityLimit);
        if (!isSimilar) {
            return;
        }
        const alreadyIncluded = this._containsName(importParts.importName, importParts.importFrom, results);
        if (alreadyIncluded) {
            return;
        }
        this._addToImportAliasMap({
            moduleUri,
            originalName: importParts.importName,
            kind: vscode_languageserver_1.SymbolKind.Module,
            itemKind: vscode_languageserver_1.CompletionItemKind.Module,
        }, {
            importParts,
            importGroup,
            kind: vscode_languageserver_1.SymbolKind.Module,
            itemKind: vscode_languageserver_1.CompletionItemKind.Module,
            fileUri: moduleUri,
        }, importAliasMap);
    }
    getNameForImportFrom(library, moduleUri) {
        return undefined;
    }
    getUriProperties(map, uri) {
        const fileDir = uri.getDirectory();
        const initPathPy = fileDir.initPyUri;
        const initPathPyi = fileDir.initPyiUri;
        const isStub = uri.hasExtension('.pyi');
        const hasInit = map.has(initPathPy.key) || map.has(initPathPyi.key);
        const sourceFileInfo = this.program.getSourceFileInfo(uri);
        return { isStub, hasInit, isUserCode: (0, sourceFileInfoUtils_1.isUserCode)(sourceFileInfo) };
    }
    _shouldIncludeVariable(autoImportSymbol, name, isStub, library) {
        var _a;
        // If it is not a stub file and symbol is Variable, we only include it if
        // name is public constant or type alias unless it is in __all__ for user files.
        if (isStub || autoImportSymbol.kind !== vscode_languageserver_1.SymbolKind.Variable) {
            return true;
        }
        if (this.options.allowVariableInAll && !library && ((_a = autoImportSymbol.symbol) === null || _a === void 0 ? void 0 : _a.isInDunderAll())) {
            return true;
        }
        return SymbolNameUtils.isPublicConstantOrTypeAlias(name);
    }
    _addToImportAliasMap(alias, data, importAliasMap) {
        // Since we don't resolve alias declaration using type evaluator, there is still a chance
        // where we show multiple aliases for same symbols. but this should still reduce number of
        // such cases.
        if (!importAliasMap.has(alias.moduleUri.key)) {
            const map = new Map();
            map.set(alias.originalName, data);
            importAliasMap.set(alias.moduleUri.key, map);
            return;
        }
        const map = importAliasMap.get(alias.moduleUri.key);
        if (!map.has(alias.originalName)) {
            map.set(alias.originalName, data);
            return;
        }
        const existingData = map.get(alias.originalName);
        const comparison = this._compareImportAliasData(existingData, data);
        if (comparison <= 0) {
            // Existing data is better than new one.
            return;
        }
        // Keep the new data.
        map.set(alias.originalName, data);
    }
    _compareImportAliasData(left, right) {
        const groupComparison = left.importGroup - right.importGroup;
        if (groupComparison !== 0) {
            return groupComparison;
        }
        const dotComparison = left.importParts.dotCount - right.importParts.dotCount;
        if (dotComparison !== 0) {
            return dotComparison;
        }
        if (left.symbol && !right.symbol) {
            return -1;
        }
        if (!left.symbol && right.symbol) {
            return 1;
        }
        return StringUtils.getStringComparer()(left.importParts.importName, right.importParts.importName);
    }
    _getImportPartsForSymbols(uri) {
        const localImport = this._importStatements.mapByFilePath.get(uri.key);
        if (localImport) {
            return [
                localImport.moduleName,
                (0, importStatementUtils_1.getImportGroup)(localImport),
                {
                    importType: 2 /* ImportType.Local */,
                    isLocalTypingsFile: false,
                    moduleName: localImport.moduleName,
                },
            ];
        }
        else {
            const moduleNameAndType = this._getModuleNameAndTypeFromFilePath(uri);
            return [
                moduleNameAndType.moduleName,
                (0, importStatementUtils_1.getImportGroupFromModuleNameAndType)(moduleNameAndType),
                moduleNameAndType,
            ];
        }
    }
    _getImportParts(uri) {
        const name = (0, pathUtils_1.stripFileExtension)(uri.fileName);
        // See if we can import module as "import xxx"
        if (name === '__init__') {
            return createImportParts(this._getModuleNameAndTypeFromFilePath(uri.getDirectory()));
        }
        return createImportParts(this._getModuleNameAndTypeFromFilePath(uri));
        function createImportParts(module) {
            const moduleName = module.moduleName;
            if (!moduleName) {
                return undefined;
            }
            const index = moduleName.lastIndexOf('.');
            const importNamePart = index > 0 ? moduleName.substring(index + 1) : undefined;
            const importFrom = index > 0 ? moduleName.substring(0, index) : undefined;
            return {
                symbolName: importNamePart,
                importName: importNamePart !== null && importNamePart !== void 0 ? importNamePart : moduleName,
                importFrom,
                fileUri: uri,
                dotCount: StringUtils.getCharacterCount(moduleName, '.'),
                moduleNameAndType: module,
            };
        }
    }
    _isSimilar(word, name, similarityLimit) {
        if (similarityLimit === 1) {
            return word === name;
        }
        if (word.length <= 0 || name.length <= 0) {
            return false;
        }
        if (!this.options.patternMatcher) {
            const index = word[0] !== '_' && name[0] === '_' && name.length > 1 ? 1 : 0;
            if (word[0].toLocaleLowerCase() !== name[index].toLocaleLowerCase()) {
                return false;
            }
            return StringUtils.isPatternInSymbol(word, name);
        }
        return this.options.patternMatcher(word, name);
    }
    _shouldExclude(name) {
        return this._excludes.has(name, completionProvider_1.CompletionMap.labelOnlyIgnoringAutoImports);
    }
    _containsName(name, source, results) {
        if (this._shouldExclude(name)) {
            return true;
        }
        const match = results.get(name);
        if (match === null || match === void 0 ? void 0 : match.some((r) => r.source === source)) {
            return true;
        }
        return false;
    }
    // Given the file path of a module that we want to import,
    // convert to a module name that can be used in an
    // 'import from' statement.
    _getModuleNameAndTypeFromFilePath(uri) {
        return this.importResolver.getModuleNameForImport(uri, this.execEnvironment);
    }
    _getTextEditsForAutoImportByFilePath(importNameInfo, moduleNameInfo, insertionText, importGroup, fileUri) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        // If there is no symbolName, there can't be existing import statement.
        const importStatement = this._importStatements.mapByFilePath.get(fileUri.key);
        if (importStatement) {
            // Found import for given module. See whether we can use the module as it is.
            if (importStatement.node.nodeType === 23 /* ParseNodeType.Import */) {
                // For now, we don't check whether alias or moduleName got overwritten at
                // given position
                const importAlias = (_b = (_a = importStatement.subnode) === null || _a === void 0 ? void 0 : _a.alias) === null || _b === void 0 ? void 0 : _b.value;
                if (importNameInfo.name) {
                    // ex) import module
                    //     method | <= auto-import
                    return {
                        insertionText: `${importAlias !== null && importAlias !== void 0 ? importAlias : importStatement.moduleName}.${importNameInfo.name}`,
                        edits: [],
                    };
                }
                else if (importAlias) {
                    // ex) import module as m
                    //     m | <= auto-import
                    return {
                        insertionText: `${importAlias}`,
                        edits: [],
                    };
                }
            }
            // Does an 'import from' statement already exist?
            if (importNameInfo.name &&
                importStatement.node.nodeType === 25 /* ParseNodeType.ImportFrom */ &&
                !importStatement.node.isWildcardImport) {
                // If so, see whether what we want already exist.
                const importNode = importStatement.node.imports.find((i) => i.name.value === importNameInfo.name);
                if (importNode) {
                    // For now, we don't check whether alias or moduleName got overwritten at
                    // given position
                    const importAlias = (_c = importNode.alias) === null || _c === void 0 ? void 0 : _c.value;
                    return {
                        insertionText: `${importAlias !== null && importAlias !== void 0 ? importAlias : importNameInfo.name}`,
                        edits: [],
                    };
                }
                // If not, add what we want at the existing 'import from' statement as long as
                // what is imported is not module itself.
                // ex) don't add "path" to existing "from os.path import dirname" statement.
                if (moduleNameInfo.name === importStatement.moduleName) {
                    return {
                        insertionText: (_d = importNameInfo.alias) !== null && _d !== void 0 ? _d : insertionText,
                        edits: this.options.lazyEdit
                            ? undefined
                            : (0, importStatementUtils_1.getTextEditsForAutoImportSymbolAddition)(importNameInfo, importStatement, this.parseResults),
                    };
                }
            }
        }
        else if (importNameInfo.name) {
            // If it is the module itself that got imported, make sure we don't import it again.
            // ex) from module import submodule
            const imported = this._importStatements.orderedImports.find((i) => i.moduleName === moduleNameInfo.name);
            if (imported && imported.node.nodeType === 25 /* ParseNodeType.ImportFrom */ && !imported.node.isWildcardImport) {
                const importFrom = imported.node.imports.find((i) => i.name.value === importNameInfo.name);
                if (importFrom) {
                    // For now, we don't check whether alias or moduleName got overwritten at
                    // given position. only move to alias, but not the other way around
                    const importAlias = (_e = importFrom.alias) === null || _e === void 0 ? void 0 : _e.value;
                    if (importAlias) {
                        return {
                            insertionText: `${importAlias}`,
                            edits: [],
                        };
                    }
                }
                else {
                    // If not, add what we want at the existing import from statement.
                    return {
                        insertionText: (_f = importNameInfo.alias) !== null && _f !== void 0 ? _f : insertionText,
                        edits: this.options.lazyEdit
                            ? undefined
                            : (0, importStatementUtils_1.getTextEditsForAutoImportSymbolAddition)(importNameInfo, imported, this.parseResults),
                    };
                }
            }
            // Check whether it is one of implicit imports
            const importFrom = (_g = this._importStatements.implicitImports) === null || _g === void 0 ? void 0 : _g.get(fileUri.key);
            if (importFrom) {
                // For now, we don't check whether alias or moduleName got overwritten at
                // given position
                const importAlias = (_h = importFrom.alias) === null || _h === void 0 ? void 0 : _h.value;
                return {
                    insertionText: `${importAlias !== null && importAlias !== void 0 ? importAlias : importFrom.name.value}.${importNameInfo.name}`,
                    edits: [],
                };
            }
        }
        return {
            insertionText: (_j = importNameInfo.alias) !== null && _j !== void 0 ? _j : insertionText,
            edits: this.options.lazyEdit
                ? undefined
                : (0, importStatementUtils_1.getTextEditsForAutoImportInsertion)(importNameInfo, moduleNameInfo, this._importStatements, importGroup, this.parseResults, this._invocationPosition),
        };
    }
    _addResult(results, result) {
        let entries = results.get(result.name);
        if (!entries) {
            entries = [];
            results.set(result.name, entries);
        }
        entries.push(result);
    }
}
exports.AutoImporter = AutoImporter;
function convertSymbolKindToCompletionItemKind(kind) {
    switch (kind) {
        case vscode_languageserver_1.SymbolKind.File:
            return vscode_languageserver_1.CompletionItemKind.File;
        case vscode_languageserver_1.SymbolKind.Module:
        case vscode_languageserver_1.SymbolKind.Namespace:
            return vscode_languageserver_1.CompletionItemKind.Module;
        case vscode_languageserver_1.SymbolKind.Package:
            return vscode_languageserver_1.CompletionItemKind.Folder;
        case vscode_languageserver_1.SymbolKind.Class:
            return vscode_languageserver_1.CompletionItemKind.Class;
        case vscode_languageserver_1.SymbolKind.Method:
            return vscode_languageserver_1.CompletionItemKind.Method;
        case vscode_languageserver_1.SymbolKind.Property:
            return vscode_languageserver_1.CompletionItemKind.Property;
        case vscode_languageserver_1.SymbolKind.Field:
            return vscode_languageserver_1.CompletionItemKind.Field;
        case vscode_languageserver_1.SymbolKind.Constructor:
            return vscode_languageserver_1.CompletionItemKind.Constructor;
        case vscode_languageserver_1.SymbolKind.Enum:
            return vscode_languageserver_1.CompletionItemKind.Enum;
        case vscode_languageserver_1.SymbolKind.Interface:
            return vscode_languageserver_1.CompletionItemKind.Interface;
        case vscode_languageserver_1.SymbolKind.Function:
            return vscode_languageserver_1.CompletionItemKind.Function;
        case vscode_languageserver_1.SymbolKind.Variable:
        case vscode_languageserver_1.SymbolKind.Array:
            return vscode_languageserver_1.CompletionItemKind.Variable;
        case vscode_languageserver_1.SymbolKind.String:
            return vscode_languageserver_1.CompletionItemKind.Constant;
        case vscode_languageserver_1.SymbolKind.Number:
        case vscode_languageserver_1.SymbolKind.Boolean:
            return vscode_languageserver_1.CompletionItemKind.Value;
        case vscode_languageserver_1.SymbolKind.Constant:
        case vscode_languageserver_1.SymbolKind.Null:
            return vscode_languageserver_1.CompletionItemKind.Constant;
        case vscode_languageserver_1.SymbolKind.Object:
        case vscode_languageserver_1.SymbolKind.Key:
            return vscode_languageserver_1.CompletionItemKind.Value;
        case vscode_languageserver_1.SymbolKind.EnumMember:
            return vscode_languageserver_1.CompletionItemKind.EnumMember;
        case vscode_languageserver_1.SymbolKind.Struct:
            return vscode_languageserver_1.CompletionItemKind.Struct;
        case vscode_languageserver_1.SymbolKind.Event:
            return vscode_languageserver_1.CompletionItemKind.Event;
        case vscode_languageserver_1.SymbolKind.Operator:
            return vscode_languageserver_1.CompletionItemKind.Operator;
        case vscode_languageserver_1.SymbolKind.TypeParameter:
            return vscode_languageserver_1.CompletionItemKind.TypeParameter;
        default:
            return undefined;
    }
}
exports.convertSymbolKindToCompletionItemKind = convertSymbolKindToCompletionItemKind;
//# sourceMappingURL=autoImporter.js.map