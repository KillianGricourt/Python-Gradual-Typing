"use strict";
/*
 * completionProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that maps a position within a Python program file into
 * a list of zero or more text completions that apply in the context.
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
exports.CompletionMap = exports.CompletionProvider = exports.indexValueDetail = exports.autoImportDetail = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const AnalyzerNodeInfo = __importStar(require("../analyzer/analyzerNodeInfo"));
const declaration_1 = require("../analyzer/declaration");
const declarationUtils_1 = require("../analyzer/declarationUtils");
const enums_1 = require("../analyzer/enums");
const importResolver_1 = require("../analyzer/importResolver");
const parameterUtils_1 = require("../analyzer/parameterUtils");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const scopeUtils_1 = require("../analyzer/scopeUtils");
const sourceMapper_1 = require("../analyzer/sourceMapper");
const SymbolNameUtils = __importStar(require("../analyzer/symbolNameUtils"));
const symbolUtils_1 = require("../analyzer/symbolUtils");
const typedDicts_1 = require("../analyzer/typedDicts");
const typeDocStringUtils_1 = require("../analyzer/typeDocStringUtils");
const typePrinter_1 = require("../analyzer/typePrinter");
const types_1 = require("../analyzer/types");
const typeUtils_1 = require("../analyzer/typeUtils");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const debug = __importStar(require("../common/debug"));
const debug_1 = require("../common/debug");
const lspUtils_1 = require("../common/lspUtils");
const positionUtils_1 = require("../common/positionUtils");
const pythonVersion_1 = require("../common/pythonVersion");
require("../common/serviceProviderExtensions");
const StringUtils = __importStar(require("../common/stringUtils"));
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const workspaceEditUtils_1 = require("../common/workspaceEditUtils");
const localize_1 = require("../localization/localize");
const parseNodes_1 = require("../parser/parseNodes");
const autoImporter_1 = require("./autoImporter");
const completionProviderUtils_1 = require("./completionProviderUtils");
const documentSymbolCollector_1 = require("./documentSymbolCollector");
const tooltipUtils_1 = require("./tooltipUtils");
var Keywords;
(function (Keywords) {
    const base = [
        // Expression keywords
        'True',
        'False',
        'None',
        'and',
        'or',
        'not',
        'is',
        'lambda',
        'yield',
        // Statement keywords
        'assert',
        'break',
        'class',
        'continue',
        'def',
        'del',
        'elif',
        'else',
        'except',
        'finally',
        'for',
        'from',
        'global',
        'if',
        'import',
        'in',
        'nonlocal',
        'pass',
        'raise',
        'return',
        'try',
        'type',
        'while',
        'with',
    ];
    const python3_5 = [...base, 'async', 'await'];
    const python3_10 = [...python3_5, 'case', 'match'];
    function forVersion(version) {
        if (version.isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_10)) {
            return python3_10;
        }
        if (version.isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_5)) {
            return python3_5;
        }
        return base;
    }
    Keywords.forVersion = forVersion;
})(Keywords || (Keywords = {}));
var SortCategory;
(function (SortCategory) {
    // The order of the following is important. We use
    // this to order the completion suggestions.
    // A keyword that must be entered for the syntax to be correct.
    SortCategory[SortCategory["LikelyKeyword"] = 0] = "LikelyKeyword";
    // A module name recently used in an import statement.
    SortCategory[SortCategory["RecentImportModuleName"] = 1] = "RecentImportModuleName";
    // A module name used in an import statement.
    SortCategory[SortCategory["ImportModuleName"] = 2] = "ImportModuleName";
    // A literal string.
    SortCategory[SortCategory["LiteralValue"] = 3] = "LiteralValue";
    // A named parameter in a call expression.
    SortCategory[SortCategory["NamedParameter"] = 4] = "NamedParameter";
    // A keyword or symbol that was recently used for completion.
    SortCategory[SortCategory["RecentKeywordOrSymbol"] = 5] = "RecentKeywordOrSymbol";
    // An auto-import symbol that was recently used for completion.
    SortCategory[SortCategory["RecentAutoImport"] = 6] = "RecentAutoImport";
    // A keyword in the python syntax.
    SortCategory[SortCategory["Keyword"] = 7] = "Keyword";
    // An enum member.
    SortCategory[SortCategory["EnumMember"] = 8] = "EnumMember";
    // A normal symbol.
    SortCategory[SortCategory["NormalSymbol"] = 9] = "NormalSymbol";
    // A symbol that starts with _ or __ (used only when there is
    // no matching filter).
    SortCategory[SortCategory["PrivateSymbol"] = 10] = "PrivateSymbol";
    // A symbol with a dunder name (e.g. __init__).
    SortCategory[SortCategory["DunderSymbol"] = 11] = "DunderSymbol";
    // An auto-import symbol.
    SortCategory[SortCategory["AutoImport"] = 12] = "AutoImport";
})(SortCategory || (SortCategory = {}));
exports.autoImportDetail = localize_1.Localizer.Completion.autoImportDetail();
exports.indexValueDetail = localize_1.Localizer.Completion.indexValueDetail();
// We'll use a somewhat-arbitrary cutoff value here to determine
// whether it's sufficiently similar.
const similarityLimit = 0.25;
// We'll remember this many completions in the MRU list.
const maxRecentCompletions = 128;
class CompletionProvider {
    constructor(program, fileUri, position, options, cancellationToken) {
        this.program = program;
        this.fileUri = fileUri;
        this.position = position;
        this.options = options;
        this.cancellationToken = cancellationToken;
        // Indicates whether invocation position is inside of string literal
        // token or an f-string expression.
        this._stringLiteralContainer = undefined;
        this.execEnv = this.configOptions.findExecEnvironment(this.fileUri);
        this.parseResults = this.program.getParseResults(this.fileUri);
        this.sourceMapper = this.program.getSourceMapper(this.fileUri, this.cancellationToken, /* mapCompiled */ true);
    }
    getCompletions() {
        if (!this.program.getSourceFileInfo(this.fileUri)) {
            return null;
        }
        const completionMap = this._getCompletions();
        return vscode_languageserver_1.CompletionList.create(completionMap === null || completionMap === void 0 ? void 0 : completionMap.toArray());
    }
    // When the user selects a completion, this callback is invoked,
    // allowing us to record what was selected. This allows us to
    // build our MRU cache so we can better predict entries.
    resolveCompletionItem(completionItem) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this.cancellationToken);
        const completionItemData = (0, lspUtils_1.fromLSPAny)(completionItem.data);
        const label = completionItem.label;
        let autoImportText = '';
        if (completionItemData.autoImportText) {
            autoImportText = completionItemData.autoImportText;
        }
        const curIndex = CompletionProvider._mostRecentCompletions.findIndex((item) => item.label === label && item.autoImportText === autoImportText);
        if (curIndex > 0) {
            // If there's an existing entry with the same name that's not at the
            // beginning of the array, remove it.
            CompletionProvider._mostRecentCompletions = CompletionProvider._mostRecentCompletions.splice(curIndex, 1);
        }
        if (curIndex !== 0) {
            // Add to the start of the array.
            CompletionProvider._mostRecentCompletions.unshift({ label, autoImportText });
        }
        if (CompletionProvider._mostRecentCompletions.length > maxRecentCompletions) {
            // Prevent the MRU list from growing indefinitely.
            CompletionProvider._mostRecentCompletions.pop();
        }
        if (!completionItemData.symbolLabel) {
            return;
        }
        if (completionItemData.moduleUri &&
            importResolver_1.ImportResolver.isSupportedImportSourceFile(uri_1.Uri.parse(completionItemData.moduleUri, this.program.serviceProvider))) {
            const moduleUri = uri_1.Uri.parse(completionItemData.moduleUri, this.program.serviceProvider);
            const documentation = (0, typeDocStringUtils_1.getModuleDocStringFromUris)([moduleUri], this.sourceMapper);
            if (!documentation) {
                return;
            }
            if (this.options.format === vscode_languageserver_1.MarkupKind.Markdown) {
                const markdownString = this.program.serviceProvider
                    .docStringService()
                    .convertDocStringToMarkdown(documentation, (0, typeDocStringUtils_1.isBuiltInModule)(moduleUri));
                completionItem.documentation = {
                    kind: vscode_languageserver_1.MarkupKind.Markdown,
                    value: markdownString,
                };
            }
            else if (this.options.format === vscode_languageserver_1.MarkupKind.PlainText) {
                const plainTextString = this.program.serviceProvider
                    .docStringService()
                    .convertDocStringToPlainText(documentation);
                completionItem.documentation = {
                    kind: vscode_languageserver_1.MarkupKind.PlainText,
                    value: plainTextString,
                };
            }
            return;
        }
        this.itemToResolve = completionItem;
        if (!completionItemData.autoImportText) {
            // Rerun the completion lookup. It will fill in additional information
            // about the item to be resolved. We'll ignore the rest of the returned
            // list. This is a bit wasteful, but all of that information should be
            // cached, so it's not as bad as it might seem.
            this.getCompletions();
        }
        else if (!completionItem.additionalTextEdits) {
            const completionMap = new CompletionMap();
            this.addAutoImportCompletions(completionItemData.symbolLabel, 
            /* similarityLimit */ 1, 
            /* lazyEdit */ false, completionMap);
        }
    }
    get evaluator() {
        return this.program.evaluator;
    }
    get importResolver() {
        return this.program.importResolver;
    }
    get configOptions() {
        return this.program.configOptions;
    }
    getMethodOverrideCompletions(priorWord, partialName, decorators) {
        var _a, _b;
        const enclosingClass = ParseTreeUtils.getEnclosingClass(partialName, /* stopAtFunction */ true);
        if (!enclosingClass) {
            return undefined;
        }
        const classResults = this.evaluator.getTypeOfClass(enclosingClass);
        if (!classResults) {
            return undefined;
        }
        const symbolTable = new Map();
        for (let i = 1; i < classResults.classType.details.mro.length; i++) {
            const mroClass = classResults.classType.details.mro[i];
            if ((0, types_1.isInstantiableClass)(mroClass)) {
                (0, typeUtils_1.getMembersForClass)(mroClass, symbolTable, /* includeInstanceVars */ false);
            }
        }
        const staticmethod = (_a = decorators === null || decorators === void 0 ? void 0 : decorators.some((d) => ParseTreeUtils.checkDecorator(d, 'staticmethod'))) !== null && _a !== void 0 ? _a : false;
        const classmethod = (_b = decorators === null || decorators === void 0 ? void 0 : decorators.some((d) => ParseTreeUtils.checkDecorator(d, 'classmethod'))) !== null && _b !== void 0 ? _b : false;
        const completionMap = new CompletionMap();
        symbolTable.forEach((symbol, name) => {
            var _a;
            let decl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(symbol);
            if (decl && decl.type === 5 /* DeclarationType.Function */) {
                if (StringUtils.isPatternInSymbol(partialName.value, name)) {
                    const declaredType = (_a = this.evaluator.getTypeForDeclaration(decl)) === null || _a === void 0 ? void 0 : _a.type;
                    if (!declaredType) {
                        return;
                    }
                    let isProperty = (0, types_1.isClassInstance)(declaredType) && types_1.ClassType.isPropertyClass(declaredType);
                    if (SymbolNameUtils.isDunderName(name)) {
                        // Don't offer suggestions for built-in properties like "__class__", etc.
                        isProperty = false;
                    }
                    if (!(0, types_1.isFunction)(declaredType) && !isProperty) {
                        return;
                    }
                    if (isProperty) {
                        // For properties, we should override the "getter", which is typically
                        // the first declaration.
                        const typedDecls = symbol.getTypedDeclarations();
                        if (typedDecls.length > 0 && typedDecls[0].type === 5 /* DeclarationType.Function */) {
                            decl = typedDecls[0];
                        }
                    }
                    const isDeclaredStaticMethod = (0, types_1.isFunction)(declaredType) && types_1.FunctionType.isStaticMethod(declaredType);
                    // Special-case the "__init_subclass__" method because it's an implicit
                    // classmethod that the type evaluator flags as a real classmethod.
                    const isDeclaredClassMethod = (0, types_1.isFunction)(declaredType) &&
                        types_1.FunctionType.isClassMethod(declaredType) &&
                        name !== '__init_subclass__';
                    if (staticmethod !== isDeclaredStaticMethod || classmethod !== isDeclaredClassMethod) {
                        return;
                    }
                    const methodSignature = this._printMethodSignature(classResults.classType, decl);
                    let text;
                    if ((0, sourceMapper_1.isStubFile)(this.fileUri)) {
                        text = `${methodSignature}: ...`;
                    }
                    else {
                        const methodBody = this.printOverriddenMethodBody(classResults.classType, isDeclaredStaticMethod, isProperty, decl, decl.node.isAsync);
                        text = `${methodSignature}:\n${methodBody}`;
                    }
                    const textEdit = this.createReplaceEdits(priorWord, partialName, text);
                    this.addSymbol(name, symbol, partialName.value, completionMap, {
                        // method signature already contains ()
                        funcParensDisabled: true,
                        edits: {
                            format: this.options.snippet ? vscode_languageserver_1.InsertTextFormat.Snippet : undefined,
                            textEdit,
                        },
                    });
                }
            }
        });
        return completionMap;
    }
    printOverriddenMethodBody(classType, isStaticMethod, isProperty, decl, insertAwait) {
        let sb = this.parseResults.tokenizerOutput.predominantTabSequence;
        if (classType.details.baseClasses.length === 1 &&
            (0, types_1.isClass)(classType.details.baseClasses[0]) &&
            classType.details.baseClasses[0].details.fullName === 'builtins.object') {
            sb += this.options.snippet ? '${0:pass}' : 'pass';
            return sb;
        }
        if (decl.node.parameters.length === 0) {
            sb += this.options.snippet ? '${0:pass}' : 'pass';
            return sb;
        }
        const parameters = getParameters(isStaticMethod ? decl.node.parameters : decl.node.parameters.slice(1));
        if (decl.node.name.value !== '__init__') {
            sb += 'return ';
        }
        if (insertAwait) {
            sb += 'await ';
        }
        if (isProperty) {
            return sb + `super().${decl.node.name.value}`;
        }
        return sb + `super().${decl.node.name.value}(${parameters.map(convertToString).join(', ')})`;
        function getParameters(parameters) {
            const results = [];
            let sawKeywordOnlySeparator = false;
            for (const parameter of parameters) {
                if (parameter.name) {
                    results.push([
                        parameter,
                        parameter.category === 0 /* ParameterCategory.Simple */ && !!parameter.name && sawKeywordOnlySeparator,
                    ]);
                }
                // All simple parameters after a `*` or `*args` parameter
                // are considered keyword only.
                if (parameter.category === 1 /* ParameterCategory.ArgsList */) {
                    sawKeywordOnlySeparator = true;
                }
            }
            return results;
        }
        function convertToString(parameter) {
            var _a;
            const name = (_a = parameter[0].name) === null || _a === void 0 ? void 0 : _a.value;
            if (parameter[0].category === 1 /* ParameterCategory.ArgsList */) {
                return `*${name}`;
            }
            if (parameter[0].category === 2 /* ParameterCategory.KwargsDict */) {
                return `**${name}`;
            }
            return parameter[1] ? `${name}=${name}` : name;
        }
    }
    createReplaceEdits(priorWord, node, text) {
        const replaceOrInsertEndChar = (node === null || node === void 0 ? void 0 : node.nodeType) === 38 /* ParseNodeType.Name */
            ? this.position.character - priorWord.length + node.value.length
            : this.position.character;
        const range = {
            start: { line: this.position.line, character: this.position.character - priorWord.length },
            end: { line: this.position.line, character: replaceOrInsertEndChar },
        };
        return vscode_languageserver_1.TextEdit.replace(range, text);
    }
    shouldProcessDeclaration(declaration) {
        // By default, we allow all symbol/decl to be included in the completion.
        return true;
    }
    addSymbol(name, symbol, priorWord, completionMap, detail) {
        var _a, _b, _c;
        // Make sure we don't crash due to OOM.
        this.program.handleMemoryHighUsage();
        let primaryDecl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(symbol);
        if (!primaryDecl) {
            const declarations = symbol.getDeclarations();
            if (declarations.length > 0) {
                primaryDecl = declarations[declarations.length - 1];
            }
        }
        if (!this.shouldProcessDeclaration(primaryDecl)) {
            return;
        }
        primaryDecl = primaryDecl
            ? (_a = this.evaluator.resolveAliasDeclaration(primaryDecl, /* resolveLocalNames */ true)) !== null && _a !== void 0 ? _a : primaryDecl
            : undefined;
        const autoImportText = detail.autoImportSource
            ? this.getAutoImportText(name, detail.autoImportSource, detail.autoImportAlias)
            : undefined;
        // Are we resolving a completion item? If so, see if this symbol
        // is the one that we're trying to match.
        if (this.itemToResolve) {
            const completionItemData = (0, lspUtils_1.fromLSPAny)(this.itemToResolve.data);
            if (completionItemData.symbolLabel !== name) {
                // It's not what we are looking for.
                return;
            }
            if (this.itemToResolve.additionalTextEdits === undefined &&
                ((_b = detail.edits) === null || _b === void 0 ? void 0 : _b.additionalTextEdits) !== undefined) {
                this.itemToResolve.additionalTextEdits = (0, workspaceEditUtils_1.convertToTextEdits)(detail.edits.additionalTextEdits);
            }
            if (completionItemData.autoImportText) {
                return;
            }
            // This call can be expensive to perform on every completion item
            // that we return, so we do it lazily in the "resolve" callback.
            const type = this.evaluator.getEffectiveTypeOfSymbol(symbol);
            if (!type) {
                // Can't resolve. so bail out.
                return;
            }
            const typeDetail = (0, completionProviderUtils_1.getTypeDetail)(this.evaluator, type, primaryDecl, name, detail, this.configOptions.functionSignatureDisplay);
            const documentation = (0, tooltipUtils_1.getDocumentationPartsForTypeAndDecl)(this.sourceMapper, type, primaryDecl, this.evaluator, {
                name,
                symbol,
                boundObjectOrClass: detail.boundObjectOrClass,
            });
            if (this.options.format === vscode_languageserver_1.MarkupKind.Markdown || this.options.format === vscode_languageserver_1.MarkupKind.PlainText) {
                this.itemToResolve.documentation = (0, completionProviderUtils_1.getCompletionItemDocumentation)(this.program.serviceProvider, typeDetail, documentation, this.options.format, primaryDecl);
            }
            else {
                (0, debug_1.fail)(`Unsupported markup type: ${this.options.format}`);
            }
            // Bail out. We don't need to add items to completion.
            return;
        }
        if (primaryDecl) {
            let itemKind = this._convertDeclarationTypeToItemKind(primaryDecl);
            // Handle enum members specially. Enum members normally look like
            // variables, but the are declared using assignment expressions
            // within an enum class.
            if (this._isEnumMember(detail.boundObjectOrClass, name)) {
                itemKind = vscode_languageserver_1.CompletionItemKind.EnumMember;
            }
            this.addNameToCompletions((_c = detail.autoImportAlias) !== null && _c !== void 0 ? _c : name, itemKind, priorWord, completionMap, {
                autoImportText,
                extraCommitChars: detail.extraCommitChars,
                funcParensDisabled: detail.funcParensDisabled,
                edits: detail.edits,
            });
        }
        else {
            // Does the symbol have no declaration but instead has a synthesized type?
            const synthesizedType = symbol.getSynthesizedType();
            if (synthesizedType) {
                const itemKind = this._convertTypeToItemKind(synthesizedType);
                this.addNameToCompletions(name, itemKind, priorWord, completionMap, {
                    extraCommitChars: detail.extraCommitChars,
                    funcParensDisabled: detail.funcParensDisabled,
                    edits: detail.edits,
                });
            }
        }
    }
    getMemberAccessCompletions(leftExprNode, priorWord) {
        const symbolTable = new Map();
        const completionMap = new CompletionMap();
        let leftType = this.evaluator.getType(leftExprNode);
        if (!leftType) {
            return completionMap;
        }
        leftType = this.evaluator.makeTopLevelTypeVarsConcrete(leftType);
        // If this is an unknown type with a "possible type" associated with
        // it, use the possible type.
        if ((0, types_1.isUnknown)(leftType) && leftType.possibleType) {
            leftType = this.evaluator.makeTopLevelTypeVarsConcrete(leftType.possibleType);
        }
        (0, typeUtils_1.doForEachSubtype)(leftType, (subtype) => {
            subtype = this.evaluator.makeTopLevelTypeVarsConcrete(subtype);
            if ((0, types_1.isClass)(subtype)) {
                const instance = types_1.TypeBase.isInstance(subtype);
                (0, typeUtils_1.getMembersForClass)(subtype, symbolTable, instance);
                if (types_1.ClassType.isEnumClass(subtype) && instance) {
                    // Don't show enum member out of another enum member
                    // ex) Enum.Member. <= shouldn't show `Member` again.
                    for (const name of symbolTable.keys()) {
                        if (this._isEnumMember(subtype, name)) {
                            symbolTable.delete(name);
                        }
                    }
                }
            }
            else if ((0, types_1.isModule)(subtype)) {
                (0, typeUtils_1.getMembersForModule)(subtype, symbolTable);
            }
            else if ((0, types_1.isFunction)(subtype) || (0, types_1.isOverloadedFunction)(subtype)) {
                const functionClass = this.evaluator.getBuiltInType(leftExprNode, 'function');
                if (functionClass && (0, types_1.isInstantiableClass)(functionClass)) {
                    (0, typeUtils_1.getMembersForClass)(functionClass, symbolTable, /* includeInstanceVars */ true);
                }
            }
            else if ((0, typeUtils_1.isNoneInstance)(subtype)) {
                const objectClass = this.evaluator.getBuiltInType(leftExprNode, 'object');
                if (objectClass && (0, types_1.isInstantiableClass)(objectClass)) {
                    (0, typeUtils_1.getMembersForClass)(objectClass, symbolTable, types_1.TypeBase.isInstance(subtype));
                }
            }
            this._addSymbolsForSymbolTable(symbolTable, () => true, priorWord, leftExprNode, 
            /* isInImport */ false, (0, types_1.isClass)(subtype) ? subtype : undefined, completionMap);
        });
        return completionMap;
    }
    addAutoImportCompletions(priorWord, similarityLimit, lazyEdit, completionMap) {
        if (!this.configOptions.autoImportCompletions) {
            // If auto import on the server is turned off or this particular invocation
            // is turned off (ex, notebook), don't do any thing.
            return;
        }
        const currentFile = this.program.getSourceFileInfo(this.fileUri);
        const moduleSymbolMap = (0, autoImporter_1.buildModuleSymbolsMap)(this.program.getSourceFileInfoList().filter((s) => s !== currentFile));
        const autoImporter = new autoImporter_1.AutoImporter(this.execEnv, this.program, this.importResolver, this.parseResults, this.position, completionMap, moduleSymbolMap, {
            lazyEdit,
        });
        const results = [];
        (0, collectionUtils_1.appendArray)(results, autoImporter.getAutoImportCandidates(priorWord, similarityLimit, 
        /* abbrFromUsers */ undefined, this.cancellationToken));
        this.addImportResults(results, priorWord, completionMap);
    }
    addImportResults(results, priorWord, completionMap) {
        var _a, _b;
        for (const result of results) {
            if (result.symbol) {
                this.addSymbol(result.name, result.symbol, priorWord, completionMap, {
                    extraCommitChars: true,
                    autoImportSource: result.source,
                    autoImportAlias: result.alias,
                    edits: {
                        textEdit: this.createReplaceEdits(priorWord, /* node */ undefined, result.insertionText),
                        additionalTextEdits: result.edits,
                    },
                });
            }
            else {
                this.addNameToCompletions((_a = result.alias) !== null && _a !== void 0 ? _a : result.name, (_b = result.kind) !== null && _b !== void 0 ? _b : vscode_languageserver_1.CompletionItemKind.Module, priorWord, completionMap, {
                    extraCommitChars: true,
                    autoImportText: this.getAutoImportText(result.name, result.source, result.alias),
                    edits: {
                        textEdit: this.createReplaceEdits(priorWord, /* node */ undefined, result.insertionText),
                        additionalTextEdits: result.edits,
                    },
                });
            }
        }
    }
    addExtraCommitChar(item) {
        // extra commit char is not supported.
    }
    addNameToCompletions(name, itemKind, filter, completionMap, detail) {
        var _a, _b, _c, _d;
        // Auto importer already filtered out unnecessary ones. No need to do it again.
        const similarity = (detail === null || detail === void 0 ? void 0 : detail.autoImportText) ? true : StringUtils.isPatternInSymbol(filter, name);
        if (!similarity) {
            return;
        }
        if (completionMap.has(name, CompletionMap.matchKindAndImportText, itemKind, (_a = detail === null || detail === void 0 ? void 0 : detail.autoImportText) === null || _a === void 0 ? void 0 : _a.importText)) {
            return;
        }
        const completionItem = vscode_languageserver_1.CompletionItem.create(name);
        completionItem.kind = itemKind;
        if (detail === null || detail === void 0 ? void 0 : detail.extraCommitChars) {
            this.addExtraCommitChar(completionItem);
        }
        const completionItemData = {
            uri: this.fileUri.toString(),
            position: this.position,
        };
        if ((detail === null || detail === void 0 ? void 0 : detail.funcParensDisabled) || !this.options.snippet) {
            completionItemData.funcParensDisabled = true;
        }
        if (detail === null || detail === void 0 ? void 0 : detail.moduleUri) {
            completionItemData.moduleUri = detail.moduleUri.toString();
        }
        completionItem.data = (0, lspUtils_1.toLSPAny)(completionItemData);
        if ((detail === null || detail === void 0 ? void 0 : detail.sortText) || (detail === null || detail === void 0 ? void 0 : detail.itemDetail)) {
            completionItem.sortText = detail.sortText;
            completionItem.detail = detail.itemDetail;
        }
        else if (detail === null || detail === void 0 ? void 0 : detail.autoImportText) {
            // Force auto-import entries to the end.
            completionItem.sortText = this._makeSortText(SortCategory.AutoImport, `${name}.${this._formatInteger(detail.autoImportText.source.length, 2)}.${detail.autoImportText.source}`, detail.autoImportText.importText);
            completionItemData.autoImportText = detail.autoImportText.importText;
            completionItem.detail = exports.autoImportDetail;
            if (detail.autoImportText.source) {
                completionItem.labelDetails = { description: detail.autoImportText.source };
            }
        }
        else if (itemKind === vscode_languageserver_1.CompletionItemKind.EnumMember) {
            // Handle enum members separately so they are sorted above other symbols.
            completionItem.sortText = this._makeSortText(SortCategory.EnumMember, name);
        }
        else if (SymbolNameUtils.isDunderName(name)) {
            // Force dunder-named symbols to appear after all other symbols.
            completionItem.sortText = this._makeSortText(SortCategory.DunderSymbol, name);
        }
        else if (filter === '' && SymbolNameUtils.isPrivateOrProtectedName(name)) {
            // Distinguish between normal and private symbols only if there is
            // currently no filter text. Once we get a single character to filter
            // upon, we'll no longer differentiate.
            completionItem.sortText = this._makeSortText(SortCategory.PrivateSymbol, name);
        }
        else {
            completionItem.sortText = this._makeSortText(SortCategory.NormalSymbol, name);
        }
        completionItemData.symbolLabel = name;
        if (this.options.format === vscode_languageserver_1.MarkupKind.Markdown) {
            let markdownString = '';
            if (detail === null || detail === void 0 ? void 0 : detail.autoImportText) {
                markdownString += detail.autoImportText.importText;
                if (detail.typeDetail || detail.documentation) {
                    // Micro perf optimization to not create new string from trimEnd.
                    markdownString += '\n\n';
                }
            }
            if (detail === null || detail === void 0 ? void 0 : detail.typeDetail) {
                markdownString += '```python\n' + detail.typeDetail + '\n```\n';
            }
            if (detail === null || detail === void 0 ? void 0 : detail.documentation) {
                markdownString += '---\n';
                markdownString += this.program.serviceProvider
                    .docStringService()
                    .convertDocStringToMarkdown(detail.documentation, (0, typeDocStringUtils_1.isBuiltInModule)(detail.moduleUri));
            }
            markdownString = markdownString.trimEnd();
            if (markdownString) {
                completionItem.documentation = {
                    kind: vscode_languageserver_1.MarkupKind.Markdown,
                    value: markdownString,
                };
            }
        }
        else if (this.options.format === vscode_languageserver_1.MarkupKind.PlainText) {
            let plainTextString = '';
            if (detail === null || detail === void 0 ? void 0 : detail.autoImportText) {
                plainTextString += detail.autoImportText.importText;
                if (detail.typeDetail || detail.documentation) {
                    // Micro perf optimization to not create new string from trimEnd.
                    plainTextString += '\n\n';
                }
            }
            if (detail === null || detail === void 0 ? void 0 : detail.typeDetail) {
                plainTextString += detail.typeDetail + '\n';
            }
            if (detail === null || detail === void 0 ? void 0 : detail.documentation) {
                plainTextString +=
                    '\n' +
                        this.program.serviceProvider.docStringService().convertDocStringToPlainText(detail.documentation);
            }
            plainTextString = plainTextString.trimEnd();
            if (plainTextString) {
                completionItem.documentation = {
                    kind: vscode_languageserver_1.MarkupKind.PlainText,
                    value: plainTextString,
                };
            }
        }
        else {
            (0, debug_1.fail)(`Unsupported markup type: ${this.options.format}`);
        }
        if ((_b = detail === null || detail === void 0 ? void 0 : detail.edits) === null || _b === void 0 ? void 0 : _b.format) {
            completionItem.insertTextFormat = detail.edits.format;
        }
        if ((_c = detail === null || detail === void 0 ? void 0 : detail.edits) === null || _c === void 0 ? void 0 : _c.textEdit) {
            completionItem.textEdit = detail.edits.textEdit;
        }
        if ((_d = detail === null || detail === void 0 ? void 0 : detail.edits) === null || _d === void 0 ? void 0 : _d.additionalTextEdits) {
            completionItem.additionalTextEdits = (0, workspaceEditUtils_1.convertToTextEdits)(detail.edits.additionalTextEdits);
            // This is for auto import entries from indices which skip symbols.
            if (this.itemToResolve) {
                const data = (0, lspUtils_1.fromLSPAny)(this.itemToResolve.data);
                if (data.autoImportText === completionItemData.autoImportText) {
                    this.itemToResolve.additionalTextEdits = completionItem.additionalTextEdits;
                }
            }
        }
        completionMap.set(completionItem);
    }
    getAutoImportText(importName, importFrom, importAlias) {
        const autoImportText = (0, tooltipUtils_1.getAutoImportText)(importName, importFrom, importAlias);
        let importText = '';
        if (this.options.format === vscode_languageserver_1.MarkupKind.Markdown) {
            importText = `\`\`\`\n${autoImportText}\n\`\`\``;
        }
        else if (this.options.format === vscode_languageserver_1.MarkupKind.PlainText) {
            importText = autoImportText;
        }
        else {
            (0, debug_1.fail)(`Unsupported markup type: ${this.options.format}`);
        }
        return {
            source: importFrom !== null && importFrom !== void 0 ? importFrom : '',
            importText,
        };
    }
    get _fileContents() {
        var _a, _b;
        return (_b = (_a = this.parseResults) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : '';
    }
    _getCompletions() {
        var _a, _b;
        const offset = (0, positionUtils_1.convertPositionToOffset)(this.position, this.parseResults.tokenizerOutput.lines);
        if (offset === undefined) {
            return undefined;
        }
        let node = ParseTreeUtils.findNodeByOffset(this.parseResults.parserOutput.parseTree, offset);
        // See if we're inside a string literal or an f-string statement.
        const token = ParseTreeUtils.getTokenOverlapping(this.parseResults.tokenizerOutput.tokens, offset);
        if ((token === null || token === void 0 ? void 0 : token.type) === 5 /* TokenType.String */) {
            const stringToken = token;
            this._stringLiteralContainer = textRange_1.TextRange.contains(stringToken, offset)
                ? stringToken
                : stringToken.flags & 65536 /* StringTokenFlags.Unterminated */
                    ? stringToken
                    : undefined;
        }
        else if (node) {
            const fStringContainer = ParseTreeUtils.getParentNodeOfType(node, 30 /* ParseNodeType.FormatString */);
            if (fStringContainer) {
                this._stringLiteralContainer = fStringContainer.token;
            }
        }
        // See if we can get to a "better" node by backing up a few columns.
        // A "better" node is defined as one that's deeper than the current
        // node.
        const initialNode = node;
        const initialDepth = node ? ParseTreeUtils.getNodeDepth(node) : 0;
        if (!initialNode || initialNode.nodeType !== 38 /* ParseNodeType.Name */) {
            let curOffset = offset;
            let sawComma = false;
            while (curOffset >= 0) {
                curOffset--;
                // Stop scanning backward if we hit certain stop characters.
                const curChar = this._fileContents.substr(curOffset, 1);
                if (curChar === '(' || curChar === '\n' || curChar === '}') {
                    break;
                }
                if (curChar === ',') {
                    sawComma = true;
                }
                const curNode = ParseTreeUtils.findNodeByOffset(this.parseResults.parserOutput.parseTree, curOffset);
                if (curNode && curNode !== initialNode) {
                    if (ParseTreeUtils.getNodeDepth(curNode) > initialDepth) {
                        node = curNode;
                        // If we're at the end of a list with a hanging comma, handle the
                        // special case of "from x import y, ".
                        if (sawComma && ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 26 /* ParseNodeType.ImportFromAs */) {
                            node = node.parent;
                        }
                    }
                    break;
                }
            }
        }
        if (node === undefined) {
            return undefined;
        }
        // Get the text on that line prior to the insertion point.
        const lineTextRange = this.parseResults.tokenizerOutput.lines.getItemAt(this.position.line);
        const textOnLine = this._fileContents.substr(lineTextRange.start, lineTextRange.length);
        const priorText = textOnLine.substr(0, this.position.character);
        const postText = textOnLine.substr(this.position.character);
        const priorWordIndex = priorText.search(/\w+$/);
        const priorWord = priorWordIndex >= 0 ? priorText.substr(priorWordIndex) : '';
        // Don't offer completions if we're within a comment.
        if (this._isWithinComment(offset)) {
            return undefined;
        }
        // See if the node is part of an error node. If so, that takes
        // precedence.
        let errorNode = node;
        while (errorNode) {
            if (errorNode.nodeType === 0 /* ParseNodeType.Error */) {
                break;
            }
            errorNode = errorNode.parent;
        }
        // Determine the context based on the parse node's type and
        // that of its ancestors.
        let curNode = errorNode || node;
        while (true) {
            (0, cancellationUtils_1.throwIfCancellationRequested)(this.cancellationToken);
            if (curNode.nodeType === 49 /* ParseNodeType.String */) {
                return this._getLiteralCompletions(curNode, offset, priorWord, priorText, postText);
            }
            if (curNode.nodeType === 48 /* ParseNodeType.StringList */ || curNode.nodeType === 30 /* ParseNodeType.FormatString */) {
                return undefined;
            }
            if (curNode.nodeType === 37 /* ParseNodeType.ModuleName */) {
                return this._getImportModuleCompletions(curNode);
            }
            if (curNode.nodeType === 0 /* ParseNodeType.Error */) {
                return this._getExpressionErrorCompletions(curNode, offset, priorWord, priorText, postText);
            }
            if (curNode.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                return this.getMemberAccessCompletions(curNode.leftExpression, priorWord);
            }
            if (curNode.nodeType === 18 /* ParseNodeType.Dictionary */) {
                const completionMap = new CompletionMap();
                if (this._tryAddTypedDictKeysFromDictionary(curNode, 
                /* stringNode */ undefined, priorWord, priorText, postText, completionMap)) {
                    return completionMap;
                }
            }
            const dictionaryEntry = ParseTreeUtils.getFirstAncestorOrSelfOfKind(curNode, 20 /* ParseNodeType.DictionaryKeyEntry */);
            if (dictionaryEntry) {
                if (((_b = dictionaryEntry.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 18 /* ParseNodeType.Dictionary */) {
                    const dictionaryNode = dictionaryEntry.parent;
                    if (dictionaryNode.trailingCommaToken && dictionaryNode.trailingCommaToken.start < offset) {
                        const completionMap = new CompletionMap();
                        if (this._tryAddTypedDictKeysFromDictionary(dictionaryNode, 
                        /* stringNode */ undefined, priorWord, priorText, postText, completionMap)) {
                            return completionMap;
                        }
                    }
                }
            }
            if (curNode.nodeType === 38 /* ParseNodeType.Name */) {
                // This condition is little different than others since it does its own
                // tree walk up to find context and let outer tree walk up to proceed if it can't find
                // one to show completion.
                const result = this._tryGetNameCompletions(curNode, offset, priorWord, priorText, postText);
                if (result || result === undefined) {
                    return result;
                }
            }
            if (curNode.nodeType === 34 /* ParseNodeType.List */ && this.options.triggerCharacter === '[') {
                // If this is an empty list, don't start putting completions up yet.
                return undefined;
            }
            if (curNode.nodeType === 25 /* ParseNodeType.ImportFrom */) {
                return this._getImportFromCompletions(curNode, offset, priorWord);
            }
            if ((0, parseNodes_1.isExpressionNode)(curNode)) {
                return this._getExpressionCompletions(curNode, priorWord, priorText, postText);
            }
            if (curNode.nodeType === 50 /* ParseNodeType.Suite */) {
                if (curNode.parent &&
                    curNode.parent.nodeType === 28 /* ParseNodeType.Except */ &&
                    !curNode.parent.name &&
                    curNode.parent.typeExpression &&
                    textRange_1.TextRange.getEnd(curNode.parent.typeExpression) < offset &&
                    offset <= curNode.parent.exceptSuite.start) {
                    // except Exception as [<empty>]
                    return undefined;
                }
                if (curNode.parent &&
                    curNode.parent.nodeType === 10 /* ParseNodeType.Class */ &&
                    (!curNode.parent.name || !curNode.parent.name.value) &&
                    curNode.parent.arguments.length === 0 &&
                    offset <= curNode.parent.suite.start) {
                    // class [<empty>]
                    return undefined;
                }
                return this._getStatementCompletions(curNode, priorWord, priorText, postText);
            }
            if (curNode.nodeType === 36 /* ParseNodeType.Module */) {
                return this._getStatementCompletions(curNode, priorWord, priorText, postText);
            }
            if (curNode.nodeType === 41 /* ParseNodeType.Parameter */ &&
                curNode.length === 0 &&
                curNode.parent &&
                curNode.parent.nodeType === 33 /* ParseNodeType.Lambda */) {
                // lambda [<empty>] or lambda x, [<empty>]
                return undefined;
            }
            if (!curNode.parent) {
                break;
            }
            curNode = curNode.parent;
        }
        return undefined;
    }
    // This method returns false if it wants the caller to walk up the
    // tree. It returns CompletionResults or undefined if it wants the
    // caller to return.
    _tryGetNameCompletions(curNode, offset, priorWord, priorText, postText) {
        var _a, _b, _c;
        if (!curNode.parent) {
            return false;
        }
        if (curNode.parent.nodeType === 24 /* ParseNodeType.ImportAs */ && curNode.parent.alias === curNode) {
            // Are we within a "import Y as [Z]"?
            return undefined;
        }
        if (curNode.parent.nodeType === 37 /* ParseNodeType.ModuleName */) {
            // Are we within a "import Y as [<empty>]"?
            if (curNode.parent.parent &&
                curNode.parent.parent.nodeType === 24 /* ParseNodeType.ImportAs */ &&
                !curNode.parent.parent.alias &&
                textRange_1.TextRange.getEnd(curNode.parent.parent) < offset) {
                return undefined;
            }
            // Are we within a "from X import Y as Z" statement and
            // more specifically within the "Y"?
            return this._getImportModuleCompletions(curNode.parent);
        }
        if (curNode.parent.nodeType === 26 /* ParseNodeType.ImportFromAs */) {
            if (curNode.parent.alias === curNode) {
                // Are we within a "from X import Y as [Z]"?
                return undefined;
            }
            const parentNode = curNode.parent.parent;
            if (parentNode && parentNode.nodeType === 25 /* ParseNodeType.ImportFrom */) {
                // Are we within a "from X import Y as [<empty>]"?
                if (!curNode.parent.alias && textRange_1.TextRange.getEnd(curNode.parent) < offset) {
                    return undefined;
                }
                if (curNode.parent.name === curNode) {
                    return this._getImportFromCompletions(parentNode, offset, priorWord);
                }
                return this._getImportFromCompletions(parentNode, offset, '');
            }
            return false;
        }
        if (curNode.parent.nodeType === 35 /* ParseNodeType.MemberAccess */ && curNode === curNode.parent.memberName) {
            return this.getMemberAccessCompletions(curNode.parent.leftExpression, priorWord);
        }
        if (curNode.parent.nodeType === 28 /* ParseNodeType.Except */ && curNode === curNode.parent.name) {
            return undefined;
        }
        if (curNode.parent.nodeType === 31 /* ParseNodeType.Function */ && curNode === curNode.parent.name) {
            if ((_a = curNode.parent.decorators) === null || _a === void 0 ? void 0 : _a.some((d) => this._isOverload(d))) {
                return this._getMethodOverloadsCompletions(priorWord, curNode);
            }
            return undefined;
        }
        if (curNode.parent.nodeType === 41 /* ParseNodeType.Parameter */ && curNode === curNode.parent.name) {
            return undefined;
        }
        if (curNode.parent.nodeType === 10 /* ParseNodeType.Class */ && curNode === curNode.parent.name) {
            return undefined;
        }
        if (curNode.parent.nodeType === 29 /* ParseNodeType.For */ &&
            textRange_1.TextRange.contains(curNode.parent.targetExpression, curNode.start)) {
            return undefined;
        }
        if (curNode.parent.nodeType === 12 /* ParseNodeType.ComprehensionFor */ &&
            textRange_1.TextRange.contains(curNode.parent.targetExpression, curNode.start)) {
            return undefined;
        }
        // For assignments that implicitly declare variables, remove itself (var decl) from completion.
        if (curNode.parent.nodeType === 3 /* ParseNodeType.Assignment */ ||
            curNode.parent.nodeType === 4 /* ParseNodeType.AssignmentExpression */) {
            const leftNode = curNode.parent.nodeType === 4 /* ParseNodeType.AssignmentExpression */
                ? curNode.parent.name
                : curNode.parent.leftExpression;
            if (leftNode !== curNode || priorWord.length === 0) {
                return false;
            }
            const decls = this.evaluator.getDeclarationsForNameNode(curNode);
            if ((decls === null || decls === void 0 ? void 0 : decls.length) !== 1 || !(0, declaration_1.isVariableDeclaration)(decls[0]) || decls[0].node !== curNode) {
                return false;
            }
            const completionMap = this._getExpressionCompletions(curNode, priorWord, priorText, postText);
            if (completionMap) {
                completionMap.delete(curNode.value);
            }
            return completionMap;
        }
        // Defining class variables.
        // ex) class A:
        //         variable = 1
        if (curNode.parent.nodeType === 47 /* ParseNodeType.StatementList */ &&
            ((_b = curNode.parent.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 50 /* ParseNodeType.Suite */ &&
            ((_c = curNode.parent.parent.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 10 /* ParseNodeType.Class */) {
            const completionList = this._getClassVariableCompletions(curNode);
            if (completionList) {
                return completionList;
            }
        }
        return false;
    }
    _isWithinComment(offset) {
        var _a, _b;
        const token = getTokenAfter(offset, this.parseResults.tokenizerOutput.tokens);
        if (!token) {
            // If we're in the middle of a token, we're not in a comment.
            return false;
        }
        return (_b = (_a = token.comments) === null || _a === void 0 ? void 0 : _a.some((c) => textRange_1.TextRange.overlaps(c, offset))) !== null && _b !== void 0 ? _b : false;
        function getTokenAfter(offset, tokens) {
            const tokenIndex = tokens.getItemAtPosition(offset);
            if (tokenIndex < 0) {
                return undefined;
            }
            let token = tokens.getItemAt(tokenIndex);
            // If we're in the middle of a token, we can't be within a comment.
            if (offset > token.start && offset < token.start + token.length) {
                return undefined;
            }
            // Multiple zero length tokens can occupy same position.
            // But comment is associated with the first one. loop
            // backward to find the first token if position is same.
            for (let i = tokenIndex - 1; i >= 0; i--) {
                const prevToken = tokens.getItemAt(i);
                if (token.start !== prevToken.start) {
                    break;
                }
                token = prevToken;
            }
            if (offset <= token.start) {
                return token;
            }
            // If offset > token.start, tokenIndex + 1 < tokens.length
            // should be always true.
            debug.assert(tokenIndex + 1 < tokens.length);
            return tokens.getItemAt(tokenIndex + 1);
        }
    }
    _getExpressionErrorCompletions(node, offset, priorWord, priorText, postText) {
        var _a;
        // Is the error due to a missing member access name? If so,
        // we can evaluate the left side of the member access expression
        // to determine its type and offer suggestions based on it.
        switch (node.category) {
            case 0 /* ErrorExpressionCategory.MissingIn */: {
                return this._createSingleKeywordCompletion('in');
            }
            case 1 /* ErrorExpressionCategory.MissingElse */: {
                return this._createSingleKeywordCompletion('else');
            }
            case 7 /* ErrorExpressionCategory.MissingMemberAccessName */:
            case 2 /* ErrorExpressionCategory.MissingExpression */: {
                // Don't show completion after random dots.
                const tokenizerOutput = this.parseResults.tokenizerOutput;
                const offset = (0, positionUtils_1.convertPositionToOffset)(this.position, tokenizerOutput.lines);
                const index = ParseTreeUtils.getTokenIndexAtLeft(tokenizerOutput.tokens, offset);
                const token = ParseTreeUtils.getTokenAtIndex(tokenizerOutput.tokens, index);
                const prevToken = ParseTreeUtils.getTokenAtIndex(tokenizerOutput.tokens, index - 1);
                if (node.category === 2 /* ErrorExpressionCategory.MissingExpression */) {
                    // Skip dots on expressions.
                    if ((token === null || token === void 0 ? void 0 : token.type) === 20 /* TokenType.Dot */ || (token === null || token === void 0 ? void 0 : token.type) === 19 /* TokenType.Ellipsis */) {
                        break;
                    }
                    // ex) class MyType:
                    //         def is_str(self): ...
                    //     myType = MyType()
                    //
                    // In incomplete code such as "myType.is" <= "is" will be tokenized as keyword not identifier,
                    // so even if user's intention is writing "is_str", completion after "is" won't include "is_str"
                    // since parser won't see "is" as partially written member name instead it will see it as
                    // expression statement with missing expression after "is" keyword.
                    // In such case, use "MyType." to get completion.
                    if ((token === null || token === void 0 ? void 0 : token.type) !== 8 /* TokenType.Keyword */ || textRange_1.TextRange.getEnd(token) !== offset) {
                        return this._getExpressionCompletions(node, priorWord, priorText, postText);
                    }
                    if ((prevToken === null || prevToken === void 0 ? void 0 : prevToken.type) !== 20 /* TokenType.Dot */) {
                        return this._getExpressionCompletions(node, priorWord, priorText, postText);
                    }
                    const previousOffset = textRange_1.TextRange.getEnd(prevToken);
                    const previousNode = ParseTreeUtils.findNodeByOffset(this.parseResults.parserOutput.parseTree, previousOffset);
                    if ((previousNode === null || previousNode === void 0 ? void 0 : previousNode.nodeType) !== 0 /* ParseNodeType.Error */ ||
                        previousNode.category !== 7 /* ErrorExpressionCategory.MissingMemberAccessName */) {
                        return this._getExpressionCompletions(node, priorWord, priorText, postText);
                    }
                    else {
                        // Update node to previous node so we get the member access completions.
                        node = previousNode;
                    }
                }
                else if (node.category === 7 /* ErrorExpressionCategory.MissingMemberAccessName */) {
                    // Skip double dots on member access.
                    if (((token === null || token === void 0 ? void 0 : token.type) === 20 /* TokenType.Dot */ || (token === null || token === void 0 ? void 0 : token.type) === 19 /* TokenType.Ellipsis */) &&
                        ((prevToken === null || prevToken === void 0 ? void 0 : prevToken.type) === 20 /* TokenType.Dot */ || (prevToken === null || prevToken === void 0 ? void 0 : prevToken.type) === 19 /* TokenType.Ellipsis */)) {
                        return undefined;
                    }
                }
                return this._getMissingMemberAccessNameCompletions(node, priorWord);
            }
            case 4 /* ErrorExpressionCategory.MissingDecoratorCallName */: {
                return this._getExpressionCompletions(node, priorWord, priorText, postText);
            }
            case 11 /* ErrorExpressionCategory.MissingPattern */:
            case 3 /* ErrorExpressionCategory.MissingIndexOrSlice */: {
                let completionResults = this._getLiteralCompletions(node, offset, priorWord, priorText, postText);
                if (!completionResults) {
                    completionResults = this._getExpressionCompletions(node, priorWord, priorText, postText);
                }
                return completionResults;
            }
            case 10 /* ErrorExpressionCategory.MissingFunctionParameterList */: {
                if (node.child && node.child.nodeType === 38 /* ParseNodeType.Name */) {
                    if ((_a = node.decorators) === null || _a === void 0 ? void 0 : _a.some((d) => this._isOverload(d))) {
                        return this._getMethodOverloadsCompletions(priorWord, node.child);
                    }
                    // Determine if the partial name is a method that's overriding
                    // a method in a base class.
                    return this.getMethodOverrideCompletions(priorWord, node.child, node.decorators);
                }
                break;
            }
        }
        return undefined;
    }
    _getMissingMemberAccessNameCompletions(node, priorWord) {
        if (!node.child || !(0, parseNodes_1.isExpressionNode)(node.child)) {
            return undefined;
        }
        return this.getMemberAccessCompletions(node.child, priorWord);
    }
    _isOverload(node) {
        return ParseTreeUtils.checkDecorator(node, 'overload');
    }
    _createSingleKeywordCompletion(keyword) {
        const completionItem = vscode_languageserver_1.CompletionItem.create(keyword);
        completionItem.kind = vscode_languageserver_1.CompletionItemKind.Keyword;
        completionItem.sortText = this._makeSortText(SortCategory.LikelyKeyword, keyword);
        const completionMap = new CompletionMap();
        completionMap.set(completionItem);
        return completionMap;
    }
    _addClassVariableTypeAnnotationCompletions(priorWord, parseNode, completionMap) {
        var _a, _b, _c, _d;
        // class T:
        //    f: |<= here
        const isTypeAnnotationOfClassVariable = ((_a = parseNode.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 54 /* ParseNodeType.TypeAnnotation */ &&
            parseNode.parent.valueExpression.nodeType === 38 /* ParseNodeType.Name */ &&
            parseNode.parent.typeAnnotation === parseNode &&
            ((_b = parseNode.parent.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 47 /* ParseNodeType.StatementList */ &&
            ((_c = parseNode.parent.parent.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 50 /* ParseNodeType.Suite */ &&
            ((_d = parseNode.parent.parent.parent.parent) === null || _d === void 0 ? void 0 : _d.nodeType) === 10 /* ParseNodeType.Class */;
        if (!isTypeAnnotationOfClassVariable) {
            return;
        }
        const enclosingClass = ParseTreeUtils.getEnclosingClass(parseNode, false);
        if (!enclosingClass) {
            return;
        }
        const classResults = this.evaluator.getTypeOfClass(enclosingClass);
        if (!classResults) {
            return undefined;
        }
        const classVariableName = parseNode.parent.valueExpression.value;
        const classMember = (0, typeUtils_1.lookUpClassMember)(classResults.classType, classVariableName, 16 /* MemberAccessFlags.SkipInstanceMembers */ | 1 /* MemberAccessFlags.SkipOriginalClass */);
        // First, see whether we can use semantic info to get variable type.
        if (classMember) {
            const memberType = this.evaluator.getTypeOfMember(classMember);
            const text = this.evaluator.printType(memberType, {
                enforcePythonSyntax: true,
                expandTypeAlias: false,
            });
            this.addNameToCompletions(text, vscode_languageserver_1.CompletionItemKind.Reference, priorWord, completionMap, {
                sortText: this._makeSortText(SortCategory.LikelyKeyword, text),
            });
            return;
        }
        // If we can't do that using semantic info, then try syntactic info.
        const symbolTable = new Map();
        for (const mroClass of classResults.classType.details.mro) {
            if (mroClass === classResults.classType) {
                // Ignore current type.
                continue;
            }
            if ((0, types_1.isInstantiableClass)(mroClass)) {
                (0, typeUtils_1.getMembersForClass)(mroClass, symbolTable, /* includeInstanceVars */ false);
            }
        }
        const symbol = symbolTable.get(classVariableName);
        if (!symbol) {
            return;
        }
        const decls = symbol
            .getDeclarations()
            .filter((d) => (0, declaration_1.isVariableDeclaration)(d) && d.moduleName !== 'builtins');
        // Skip any symbols invalid such as defined in the same class.
        if (decls.length === 0 ||
            decls.some((d) => d.node && ParseTreeUtils.getEnclosingClass(d.node, false) === enclosingClass)) {
            return;
        }
        const declWithTypeAnnotations = decls.filter((d) => d.typeAnnotationNode);
        if (declWithTypeAnnotations.length === 0) {
            return;
        }
        const printFlags = (0, sourceMapper_1.isStubFile)(this.fileUri)
            ? 1 /* ParseTreeUtils.PrintExpressionFlags.ForwardDeclarations */ |
                2 /* ParseTreeUtils.PrintExpressionFlags.DoNotLimitStringLength */
            : 2 /* ParseTreeUtils.PrintExpressionFlags.DoNotLimitStringLength */;
        const text = `${ParseTreeUtils.printExpression(declWithTypeAnnotations[declWithTypeAnnotations.length - 1].typeAnnotationNode, printFlags)}`;
        this.addNameToCompletions(text, vscode_languageserver_1.CompletionItemKind.Reference, priorWord, completionMap, {
            sortText: this._makeSortText(SortCategory.LikelyKeyword, text),
        });
    }
    _getClassVariableCompletions(partialName) {
        const enclosingClass = ParseTreeUtils.getEnclosingClass(partialName, false);
        if (!enclosingClass) {
            return undefined;
        }
        const classResults = this.evaluator.getTypeOfClass(enclosingClass);
        if (!classResults) {
            return undefined;
        }
        const symbolTable = new Map();
        for (const mroClass of classResults.classType.details.mro) {
            if ((0, types_1.isInstantiableClass)(mroClass)) {
                (0, typeUtils_1.getMembersForClass)(mroClass, symbolTable, /* includeInstanceVars */ false);
            }
        }
        const completionMap = new CompletionMap();
        symbolTable.forEach((symbol, name) => {
            if (SymbolNameUtils.isPrivateName(name) ||
                symbol.isPrivateMember() ||
                symbol.isExternallyHidden() ||
                !StringUtils.isPatternInSymbol(partialName.value, name)) {
                return;
            }
            const decls = symbol
                .getDeclarations()
                .filter((d) => (0, declaration_1.isVariableDeclaration)(d) && d.moduleName !== 'builtins');
            // Skip any symbols invalid such as defined in the same class.
            if (decls.length === 0 ||
                decls.some((d) => d.node && ParseTreeUtils.getEnclosingClass(d.node, false) === enclosingClass)) {
                return;
            }
            this.addSymbol(name, symbol, partialName.value, completionMap, {});
        });
        return completionMap.size > 0 ? completionMap : undefined;
    }
    _getMethodOverloadsCompletions(priorWord, partialName) {
        var _a;
        const symbolTable = getSymbolTable(this.evaluator, partialName);
        if (!symbolTable) {
            return undefined;
        }
        const funcParensDisabled = ((_a = partialName.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 31 /* ParseNodeType.Function */ ? true : undefined;
        const completionMap = new CompletionMap();
        const enclosingFunc = ParseTreeUtils.getEnclosingFunction(partialName);
        symbolTable.forEach((symbol, name) => {
            const decl = (0, symbolUtils_1.getLastTypedDeclarationForSymbol)(symbol);
            if (!decl || decl.type !== 5 /* DeclarationType.Function */) {
                return;
            }
            if (!decl.node.decorators.some((d) => this._isOverload(d))) {
                // Only consider ones that have overload decorator.
                return;
            }
            const decls = symbol.getDeclarations();
            if (decls.length === 1 && decls.some((d) => d.node === enclosingFunc)) {
                // Don't show itself.
                return;
            }
            if (StringUtils.isPatternInSymbol(partialName.value, name)) {
                const textEdit = this.createReplaceEdits(priorWord, partialName, decl.node.name.value);
                this.addSymbol(name, symbol, partialName.value, completionMap, {
                    funcParensDisabled,
                    edits: { textEdit },
                });
            }
        });
        return completionMap;
        function getSymbolTable(evaluator, partialName) {
            const enclosingClass = ParseTreeUtils.getEnclosingClass(partialName, false);
            if (enclosingClass) {
                const classResults = evaluator.getTypeOfClass(enclosingClass);
                if (!classResults) {
                    return undefined;
                }
                const symbolTable = new Map();
                for (const mroClass of classResults.classType.details.mro) {
                    if ((0, types_1.isInstantiableClass)(mroClass)) {
                        (0, typeUtils_1.getMembersForClass)(mroClass, symbolTable, /* includeInstanceVars */ false);
                    }
                }
                return symbolTable;
            }
            // For function overload, we only care about top level functions
            const moduleNode = ParseTreeUtils.getEnclosingModule(partialName);
            if (moduleNode) {
                const moduleScope = AnalyzerNodeInfo.getScope(moduleNode);
                return moduleScope === null || moduleScope === void 0 ? void 0 : moduleScope.symbolTable;
            }
            return undefined;
        }
    }
    _printMethodSignature(classType, decl) {
        const node = decl.node;
        let ellipsisForDefault;
        if ((0, sourceMapper_1.isStubFile)(this.fileUri)) {
            // In stubs, always use "...".
            ellipsisForDefault = true;
        }
        else if (classType.details.moduleName === decl.moduleName) {
            // In the same file, always print the full default.
            ellipsisForDefault = false;
        }
        const printFlags = (0, sourceMapper_1.isStubFile)(this.fileUri)
            ? 1 /* ParseTreeUtils.PrintExpressionFlags.ForwardDeclarations */ |
                2 /* ParseTreeUtils.PrintExpressionFlags.DoNotLimitStringLength */
            : 2 /* ParseTreeUtils.PrintExpressionFlags.DoNotLimitStringLength */;
        const paramList = node.parameters
            .map((param, index) => {
            let paramString = '';
            if (param.category === 1 /* ParameterCategory.ArgsList */) {
                paramString += '*';
            }
            else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
                paramString += '**';
            }
            if (param.name) {
                paramString += param.name.value;
            }
            // Currently, we don't automatically add import if the type used in the annotation is not imported
            // in current file.
            const paramTypeAnnotation = ParseTreeUtils.getTypeAnnotationForParameter(node, index);
            if (paramTypeAnnotation) {
                paramString += ': ' + ParseTreeUtils.printExpression(paramTypeAnnotation, printFlags);
            }
            if (param.defaultValue) {
                paramString += paramTypeAnnotation ? ' = ' : '=';
                const useEllipsis = ellipsisForDefault !== null && ellipsisForDefault !== void 0 ? ellipsisForDefault : !ParseTreeUtils.isSimpleDefault(param.defaultValue);
                paramString += useEllipsis ? '...' : ParseTreeUtils.printExpression(param.defaultValue, printFlags);
            }
            if (!paramString && !param.name && param.category === 0 /* ParameterCategory.Simple */) {
                return '/';
            }
            return paramString;
        })
            .join(', ');
        let methodSignature = node.name.value + '(' + paramList + ')';
        if (node.returnTypeAnnotation) {
            methodSignature += ' -> ' + ParseTreeUtils.printExpression(node.returnTypeAnnotation, printFlags);
        }
        else if (node.functionAnnotationComment) {
            methodSignature +=
                ' -> ' +
                    ParseTreeUtils.printExpression(node.functionAnnotationComment.returnTypeAnnotation, printFlags);
        }
        return methodSignature;
    }
    _getStatementCompletions(parseNode, priorWord, priorText, postText) {
        // For now, use the same logic for expressions and statements.
        return this._getExpressionCompletions(parseNode, priorWord, priorText, postText);
    }
    _getExpressionCompletions(parseNode, priorWord, priorText, postText) {
        var _a, _b;
        const isIndexArgument = this._isIndexArgument(parseNode);
        // If the user typed a "." as part of a number, don't present
        // any completion options.
        if (!isIndexArgument && parseNode.nodeType === 40 /* ParseNodeType.Number */) {
            return undefined;
        }
        // Are we within a "with Y as []"?
        // Don't add any completion options.
        if (((_a = parseNode.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 59 /* ParseNodeType.WithItem */ &&
            parseNode.parent === ((_b = parseNode.parent.target) === null || _b === void 0 ? void 0 : _b.parent)) {
            return undefined;
        }
        const completionMap = new CompletionMap();
        // Return empty completionList for Ellipsis
        if (priorText.slice(-2) === '..') {
            return completionMap;
        }
        // Defining type annotation for class variables.
        // ex) class A:
        //         variable: | <= here
        this._addClassVariableTypeAnnotationCompletions(priorWord, parseNode, completionMap);
        // Add call argument completions.
        this._addCallArgumentCompletions(parseNode, priorWord, priorText, postText, 
        /* atArgument */ false, completionMap);
        // Add symbols that are in scope.
        this._addSymbols(parseNode, priorWord, completionMap);
        // Add keywords.
        this._findMatchingKeywords(Keywords.forVersion(this.execEnv.pythonVersion), priorWord).map((keyword) => {
            if (completionMap.has(keyword)) {
                return;
            }
            const completionItem = vscode_languageserver_1.CompletionItem.create(keyword);
            completionItem.kind = vscode_languageserver_1.CompletionItemKind.Keyword;
            completionItem.sortText = this._makeSortText(SortCategory.Keyword, keyword);
            completionMap.set(completionItem);
        });
        // Add auto-import suggestions from other modules.
        // Ignore this check for privates, since they are not imported.
        if (!priorWord.startsWith('_') && !this.itemToResolve) {
            this.addAutoImportCompletions(priorWord, similarityLimit, this.options.lazyEdit, completionMap);
        }
        // Add literal values if appropriate.
        this._tryAddLiterals(parseNode, priorWord, priorText, postText, completionMap);
        return completionMap;
    }
    _isIndexArgument(node) {
        const currentNode = node.parent;
        return (currentNode &&
            currentNode.nodeType === 1 /* ParseNodeType.Argument */ &&
            currentNode.argumentCategory === 0 /* ArgumentCategory.Simple */ &&
            currentNode.parent &&
            currentNode.parent.nodeType === 27 /* ParseNodeType.Index */ &&
            currentNode.parent.baseExpression &&
            currentNode.parent.baseExpression.nodeType === 38 /* ParseNodeType.Name */);
    }
    _addCallArgumentCompletions(parseNode, priorWord, priorText, postText, atArgument, completionMap) {
        // If we're within the argument list of a call, add parameter names.
        const offset = (0, positionUtils_1.convertPositionToOffset)(this.position, this.parseResults.tokenizerOutput.lines);
        const callInfo = (0, parseTreeUtils_1.getCallNodeAndActiveParameterIndex)(parseNode, offset, this.parseResults.tokenizerOutput.tokens);
        if (!callInfo) {
            return;
        }
        const signatureInfo = this.evaluator.getCallSignatureInfo(callInfo.callNode, callInfo.activeIndex, callInfo.activeOrFake);
        if (signatureInfo) {
            // Are we past the call expression and within the argument list?
            const callNameEnd = (0, positionUtils_1.convertOffsetToPosition)(signatureInfo.callNode.leftExpression.start + signatureInfo.callNode.leftExpression.length, this.parseResults.tokenizerOutput.lines);
            if ((0, textRange_1.comparePositions)(this.position, callNameEnd) > 0) {
                if (!atArgument) {
                    this._addNamedParameters(signatureInfo, priorWord, completionMap);
                }
                // Add literals that apply to this parameter.
                this._addLiteralValuesForArgument(signatureInfo, priorWord, priorText, postText, completionMap);
            }
        }
    }
    _addLiteralValuesForArgument(signatureInfo, priorWord, priorText, postText, completionMap) {
        signatureInfo.signatures.forEach((signature) => {
            if (!signature.activeParam) {
                return undefined;
            }
            const type = signature.type;
            const paramIndex = type.details.parameters.indexOf(signature.activeParam);
            if (paramIndex < 0) {
                return undefined;
            }
            const paramType = type.details.parameters[paramIndex].type;
            this._addLiteralValuesForTargetType(paramType, priorWord, priorText, postText, completionMap);
            return undefined;
        });
    }
    _addLiteralValuesForTargetType(type, priorWord, priorText, postText, completionMap) {
        const quoteValue = this._getQuoteInfo(priorWord, priorText);
        this._getSubTypesWithLiteralValues(type).forEach((v) => {
            if (types_1.ClassType.isBuiltIn(v, 'str')) {
                const value = (0, typePrinter_1.printLiteralValue)(v, quoteValue.quoteCharacter);
                if (quoteValue.stringValue === undefined) {
                    this.addNameToCompletions(value, vscode_languageserver_1.CompletionItemKind.Constant, priorWord, completionMap, {
                        sortText: this._makeSortText(SortCategory.LiteralValue, v.literalValue),
                    });
                }
                else {
                    this._addStringLiteralToCompletions(value.substr(1, value.length - 2), quoteValue, postText, completionMap);
                }
            }
        });
    }
    _getDictExpressionStringKeys(parseNode, excludeIds) {
        const node = getDictionaryLikeNode(parseNode);
        if (!node) {
            return [];
        }
        return node.entries.flatMap((entry) => {
            if (entry.nodeType !== 20 /* ParseNodeType.DictionaryKeyEntry */ || (excludeIds === null || excludeIds === void 0 ? void 0 : excludeIds.has(entry.keyExpression.id))) {
                return [];
            }
            if (entry.keyExpression.nodeType === 48 /* ParseNodeType.StringList */) {
                return [entry.keyExpression.strings.map((s) => s.value).join('')];
            }
            return [];
        });
        function getDictionaryLikeNode(parseNode) {
            // this method assumes the given parseNode is either a child of a dictionary or a dictionary itself
            if (parseNode.nodeType === 18 /* ParseNodeType.Dictionary */) {
                return parseNode;
            }
            let curNode = parseNode;
            while (curNode && curNode.nodeType !== 18 /* ParseNodeType.Dictionary */ && curNode.nodeType !== 45 /* ParseNodeType.Set */) {
                curNode = curNode.parent;
                if (!curNode) {
                    return;
                }
            }
            return curNode;
        }
    }
    _getSubTypesWithLiteralValues(type) {
        const values = [];
        (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
            if ((0, types_1.isClassInstance)(subtype) && (0, typeUtils_1.isLiteralType)(subtype)) {
                values.push(subtype);
            }
        });
        return values;
    }
    _getIndexKeyType(baseType) {
        // Handle __getitem__.
        const getItemType = this.evaluator.getBoundMagicMethod(baseType, '__getitem__');
        if (getItemType) {
            const typesToCombine = [];
            // Handle both overloaded and non-overloaded functions.
            (0, typeUtils_1.doForEachSignature)(getItemType, (signature) => {
                if (signature.details.parameters.length >= 1 &&
                    signature.details.parameters[0].category === 0 /* ParameterCategory.Simple */) {
                    typesToCombine.push(types_1.FunctionType.getEffectiveParameterType(signature, 0));
                }
            });
            if (typesToCombine.length > 0) {
                return (0, types_1.combineTypes)(typesToCombine);
            }
        }
        return undefined;
    }
    _getIndexKeys(indexNode, invocationNode) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const baseType = this.evaluator.getType(indexNode.baseExpression);
        if (!baseType || !(0, types_1.isClassInstance)(baseType)) {
            return [];
        }
        // See whether subscript is typed using Literal types. If it is, return those literal keys.
        const subscriptType = this._getIndexKeyType(baseType);
        if (subscriptType) {
            const keys = [];
            this._getSubTypesWithLiteralValues(subscriptType).forEach((v) => {
                if (!types_1.ClassType.isBuiltIn(v, 'str') &&
                    !types_1.ClassType.isBuiltIn(v, 'int') &&
                    !types_1.ClassType.isBuiltIn(v, 'bool') &&
                    !types_1.ClassType.isBuiltIn(v, 'bytes') &&
                    !types_1.ClassType.isEnumClass(v)) {
                    return;
                }
                keys.push((0, typePrinter_1.printLiteralValue)(v, this.parseResults.tokenizerOutput.predominantSingleQuoteCharacter));
            });
            if (keys.length > 0) {
                return keys;
            }
        }
        if (indexNode.baseExpression.nodeType !== 38 /* ParseNodeType.Name */) {
            // This completion only supports simple name case
            return [];
        }
        // Must be local variable/parameter
        const declarations = (_a = this.evaluator.getDeclarationsForNameNode(indexNode.baseExpression)) !== null && _a !== void 0 ? _a : [];
        const declaration = declarations.length > 0 ? declarations[0] : undefined;
        if (!declaration ||
            (declaration.type !== 1 /* DeclarationType.Variable */ && declaration.type !== 2 /* DeclarationType.Parameter */)) {
            return [];
        }
        if (!declaration.uri.equals(this.fileUri)) {
            return [];
        }
        let startingNode = indexNode.baseExpression;
        if (declaration.node) {
            const scopeRoot = ParseTreeUtils.getEvaluationScopeNode(declaration.node).node;
            // Find the lowest tree to search the symbol.
            if ((_b = ParseTreeUtils.getFileInfoFromNode(startingNode)) === null || _b === void 0 ? void 0 : _b.fileUri.equals((_c = ParseTreeUtils.getFileInfoFromNode(scopeRoot)) === null || _c === void 0 ? void 0 : _c.fileUri)) {
                startingNode = scopeRoot;
            }
        }
        const results = documentSymbolCollector_1.DocumentSymbolCollector.collectFromNode(this.program, indexNode.baseExpression, this.cancellationToken, startingNode);
        const keys = new Set();
        for (const result of results) {
            const node = ((_d = result.node.parent) === null || _d === void 0 ? void 0 : _d.nodeType) === 54 /* ParseNodeType.TypeAnnotation */ ? result.node.parent : result.node;
            if (((_e = node.parent) === null || _e === void 0 ? void 0 : _e.nodeType) === 3 /* ParseNodeType.Assignment */ ||
                ((_f = node.parent) === null || _f === void 0 ? void 0 : _f.nodeType) === 4 /* ParseNodeType.AssignmentExpression */) {
                if (node.parent.rightExpression.nodeType === 18 /* ParseNodeType.Dictionary */) {
                    const dictionary = node.parent.rightExpression;
                    for (const entry of dictionary.entries.filter((e) => e.nodeType === 20 /* ParseNodeType.DictionaryKeyEntry */)) {
                        const key = this.parseResults.text
                            .substr(entry.keyExpression.start, entry.keyExpression.length)
                            .trim();
                        if (key.length > 0)
                            keys.add(key);
                    }
                }
                if (node.parent.rightExpression.nodeType === 9 /* ParseNodeType.Call */) {
                    const call = node.parent.rightExpression;
                    const type = this.evaluator.getType(call.leftExpression);
                    if (!type || !(0, types_1.isInstantiableClass)(type) || !types_1.ClassType.isBuiltIn(type, 'dict')) {
                        continue;
                    }
                    for (const arg of call.arguments) {
                        const key = (_h = (_g = arg.name) === null || _g === void 0 ? void 0 : _g.value.trim()) !== null && _h !== void 0 ? _h : '';
                        const quote = this.parseResults.tokenizerOutput.predominantSingleQuoteCharacter;
                        if (key.length > 0) {
                            keys.add(`${quote}${key}${quote}`);
                        }
                    }
                }
            }
            if (((_j = node.parent) === null || _j === void 0 ? void 0 : _j.nodeType) === 27 /* ParseNodeType.Index */ &&
                node.parent.items.length === 1 &&
                node.parent.items[0].valueExpression.nodeType !== 0 /* ParseNodeType.Error */ &&
                !textRange_1.TextRange.containsRange(node.parent, invocationNode)) {
                const indexArgument = node.parent.items[0];
                const key = this.parseResults.text
                    .substr(indexArgument.valueExpression.start, indexArgument.valueExpression.length)
                    .trim();
                if (key.length > 0)
                    keys.add(key);
            }
        }
        return Array.from(keys);
    }
    _getLiteralCompletions(parseNode, offset, priorWord, priorText, postText) {
        if (this.options.triggerCharacter === '"' || this.options.triggerCharacter === "'") {
            if (parseNode.start !== offset - 1) {
                // If completion is triggered by typing " or ', it must be the one that starts a string
                // literal. In another word, it can't be something inside of another string or comment
                return undefined;
            }
        }
        const completionMap = new CompletionMap();
        if (!this._tryAddLiterals(parseNode, priorWord, priorText, postText, completionMap)) {
            return undefined;
        }
        return completionMap;
    }
    _tryAddLiterals(parseNode, priorWord, priorText, postText, completionMap) {
        var _a, _b, _c, _d, _e, _f;
        const parentAndChild = getParentSkippingStringList(parseNode);
        if (!parentAndChild) {
            return false;
        }
        // See if the type evaluator can determine the expected type for this node.
        // ex) a: Literal["str"] = /* here */
        const nodeForExpectedType = parentAndChild.parent.nodeType === 3 /* ParseNodeType.Assignment */
            ? parentAndChild.parent.rightExpression === parentAndChild.child
                ? parentAndChild.child
                : undefined
            : (0, parseNodes_1.isExpressionNode)(parentAndChild.child)
                ? parentAndChild.child
                : undefined;
        if (nodeForExpectedType) {
            const expectedTypeResult = this.evaluator.getExpectedType(nodeForExpectedType);
            if (expectedTypeResult && (0, typeUtils_1.containsLiteralType)(expectedTypeResult.type)) {
                this._addLiteralValuesForTargetType(expectedTypeResult.type, priorWord, priorText, postText, completionMap);
                return true;
            }
        }
        // ex) a: TypedDictType = { "/* here */" } or a: TypedDictType = { A/* here */ }
        const nodeForKey = parentAndChild.parent;
        if (nodeForKey) {
            // If the dictionary is not yet filled in, it will appear as though it's
            // a set initially.
            let dictOrSet;
            if (nodeForKey.nodeType === 20 /* ParseNodeType.DictionaryKeyEntry */ &&
                nodeForKey.keyExpression === parentAndChild.child &&
                ((_a = nodeForKey.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 18 /* ParseNodeType.Dictionary */) {
                dictOrSet = nodeForKey.parent;
            }
            else if ((nodeForKey === null || nodeForKey === void 0 ? void 0 : nodeForKey.nodeType) === 45 /* ParseNodeType.Set */) {
                dictOrSet = nodeForKey;
            }
            if (dictOrSet) {
                if (this._tryAddTypedDictKeysFromDictionary(dictOrSet, parseNode.nodeType === 49 /* ParseNodeType.String */ ? parseNode : undefined, priorWord, priorText, postText, completionMap)) {
                    return true;
                }
            }
        }
        // a: DictType = { .... }
        // a[/* here */] or a['/* here */'] or a[variable/*here*/]
        const argument = parentAndChild.parent;
        if (argument.nodeType === 1 /* ParseNodeType.Argument */ && ((_b = argument.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 27 /* ParseNodeType.Index */) {
            const priorTextInString = parseNode.nodeType === 49 /* ParseNodeType.String */ ? priorText : '';
            if (this._tryAddTypedDictKeysFromIndexer(argument.parent, priorWord, priorTextInString, postText, completionMap)) {
                return true;
            }
            const quoteInfo = this._getQuoteInfo(priorWord, priorTextInString);
            const keys = this._getIndexKeys(argument.parent, parseNode);
            let keyFound = false;
            for (const key of keys) {
                if (completionMap.has(key)) {
                    // Don't add key if it already exists in the completion.
                    // ex) key = "dictKey"
                    //     dict[key] = 1
                    //     print(dict[<key will come from symbol table provider>]))
                    continue;
                }
                const stringLiteral = /^["|'].*["|']$/.test(key);
                if (parseNode.nodeType === 49 /* ParseNodeType.String */ && !stringLiteral) {
                    continue;
                }
                keyFound = true;
                if (stringLiteral) {
                    const keyWithoutQuote = key.substr(1, key.length - 2);
                    this._addStringLiteralToCompletions(keyWithoutQuote, quoteInfo, postText, completionMap, exports.indexValueDetail);
                }
                else {
                    this.addNameToCompletions(key, vscode_languageserver_1.CompletionItemKind.Constant, priorWord, completionMap, {
                        sortText: this._makeSortText(SortCategory.LiteralValue, key),
                        itemDetail: exports.indexValueDetail,
                    });
                }
            }
            if (keyFound) {
                return true;
            }
        }
        // if c == "/* here */"
        const comparison = parentAndChild.parent;
        const supportedOperators = [2 /* OperatorType.Assign */, 12 /* OperatorType.Equals */, 28 /* OperatorType.NotEquals */];
        if (comparison.nodeType === 7 /* ParseNodeType.BinaryOperation */ && supportedOperators.includes(comparison.operator)) {
            const type = this.evaluator.getType(comparison.leftExpression);
            if (type && (0, typeUtils_1.containsLiteralType)(type)) {
                this._addLiteralValuesForTargetType(type, priorWord, priorText, postText, completionMap);
                return true;
            }
        }
        // if c := "/* here */"
        const assignmentExpression = parentAndChild.parent;
        if (assignmentExpression.nodeType === 4 /* ParseNodeType.AssignmentExpression */ &&
            assignmentExpression.rightExpression === parentAndChild.child) {
            const type = this.evaluator.getType(assignmentExpression.name);
            if (type && (0, typeUtils_1.containsLiteralType)(type)) {
                this._addLiteralValuesForTargetType(type, priorWord, priorText, postText, completionMap);
                return true;
            }
        }
        // For now, we only support simple cases. no complex pattern matching.
        // match c:
        //     case /* here */
        const caseNode = parentAndChild.parent;
        if (caseNode.nodeType === 64 /* ParseNodeType.Case */ &&
            caseNode.pattern.nodeType === 0 /* ParseNodeType.Error */ &&
            caseNode.pattern.category === 11 /* ErrorExpressionCategory.MissingPattern */ &&
            caseNode.suite === parentAndChild.child &&
            ((_c = caseNode.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 63 /* ParseNodeType.Match */) {
            const type = this.evaluator.getType(caseNode.parent.subjectExpression);
            if (type && (0, typeUtils_1.containsLiteralType)(type)) {
                this._addLiteralValuesForTargetType(type, priorWord, priorText, postText, completionMap);
                return true;
            }
        }
        // match c:
        //     case "/* here */"
        //     case Sym/*here*/
        const patternLiteral = parentAndChild.parent;
        if ((patternLiteral.nodeType === 67 /* ParseNodeType.PatternLiteral */ ||
            patternLiteral.nodeType === 69 /* ParseNodeType.PatternCapture */) &&
            ((_d = patternLiteral.parent) === null || _d === void 0 ? void 0 : _d.nodeType) === 66 /* ParseNodeType.PatternAs */ &&
            ((_e = patternLiteral.parent.parent) === null || _e === void 0 ? void 0 : _e.nodeType) === 64 /* ParseNodeType.Case */ &&
            ((_f = patternLiteral.parent.parent.parent) === null || _f === void 0 ? void 0 : _f.nodeType) === 63 /* ParseNodeType.Match */) {
            const type = this.evaluator.getType(patternLiteral.parent.parent.parent.subjectExpression);
            if (type && (0, typeUtils_1.containsLiteralType)(type)) {
                this._addLiteralValuesForTargetType(type, priorWord, priorText, postText, completionMap);
                return true;
            }
        }
        if (parseNode.nodeType === 49 /* ParseNodeType.String */) {
            const offset = (0, positionUtils_1.convertPositionToOffset)(this.position, this.parseResults.tokenizerOutput.lines);
            const atArgument = parseNode.parent.start < offset && offset < textRange_1.TextRange.getEnd(parseNode);
            this._addCallArgumentCompletions(parseNode, priorWord, priorText, postText, atArgument, completionMap);
            return true;
        }
        return false;
        function getParentSkippingStringList(node) {
            var _a;
            if (!node.parent) {
                return undefined;
            }
            if (node.nodeType !== 49 /* ParseNodeType.String */) {
                return { parent: node.parent, child: node };
            }
            if (!node.parent.parent) {
                return undefined;
            }
            if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 48 /* ParseNodeType.StringList */ || node.parent.strings.length > 1) {
                return undefined;
            }
            return { parent: node.parent.parent, child: node.parent };
        }
    }
    _tryAddTypedDictKeys(type, existingKeys, priorWord, priorText, postText, completionMap) {
        let typedDicts = [];
        (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
            if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isTypedDictClass(subtype)) {
                typedDicts.push(subtype);
            }
        });
        if (typedDicts.length === 0) {
            return false;
        }
        typedDicts = this._tryNarrowTypedDicts(typedDicts, existingKeys);
        const quoteInfo = this._getQuoteInfo(priorWord, priorText);
        const excludes = new Set(existingKeys);
        typedDicts.forEach((typedDict) => {
            (0, typedDicts_1.getTypedDictMembersForClass)(this.evaluator, typedDict, /* allowNarrowed */ true).knownItems.forEach((_, key) => {
                // Unions of TypedDicts may define the same key.
                if (excludes.has(key) || completionMap.has(key)) {
                    return;
                }
                excludes.add(key);
                this._addStringLiteralToCompletions(key, quoteInfo, postText, completionMap);
            });
        });
        return true;
    }
    _tryAddTypedDictKeysFromDictionary(dictionaryNode, stringNode, priorWord, priorText, postText, completionMap) {
        var _a;
        const expectedTypeResult = this.evaluator.getExpectedType(dictionaryNode);
        if (!expectedTypeResult) {
            return false;
        }
        // If the expected type result is associated with a node above the
        // dictionaryNode in the parse tree, there are no typed dict keys to add.
        if (ParseTreeUtils.getNodeDepth(expectedTypeResult.node) < ParseTreeUtils.getNodeDepth(dictionaryNode)) {
            return false;
        }
        const keys = this._getDictExpressionStringKeys(dictionaryNode, stringNode ? new Set([(_a = stringNode.parent) === null || _a === void 0 ? void 0 : _a.id]) : undefined);
        return this._tryAddTypedDictKeys(expectedTypeResult.type, keys, priorWord, priorText, postText, completionMap);
    }
    _tryNarrowTypedDicts(types, keys) {
        const newTypes = types.flatMap((type) => {
            const entries = (0, typedDicts_1.getTypedDictMembersForClass)(this.evaluator, type, /* allowNarrowed */ true);
            for (let index = 0; index < keys.length; index++) {
                if (!entries.knownItems.has(keys[index])) {
                    return [];
                }
            }
            return [type];
        });
        if (newTypes.length === 0) {
            // Couldn't narrow to any typed dicts. Just include all.
            return types;
        }
        return newTypes;
    }
    // Find quotation and string prefix to use for string literals
    // completion under current context.
    _getQuoteInfo(priorWord, priorText) {
        let filterText = priorWord;
        let stringValue = undefined;
        let quoteCharacter = this.parseResults.tokenizerOutput.predominantSingleQuoteCharacter;
        // If completion is not inside of the existing string literal
        // ex) typedDict[ |<= here
        // use default quotation char without any string prefix.
        if (!this._stringLiteralContainer) {
            return { priorWord, priorText, filterText, stringValue, quoteCharacter };
        }
        const singleQuote = "'";
        const doubleQuote = '"';
        // If completion is inside of string literal and has prior text
        // ex) typedDict["key |<= here
        // find quotation user has used (ex, ") and string prefix (ex, key)
        if (priorText !== undefined) {
            const lastSingleQuote = priorText.lastIndexOf(singleQuote);
            const lastDoubleQuote = priorText.lastIndexOf(doubleQuote);
            if (lastSingleQuote > lastDoubleQuote) {
                stringValue = priorText.substr(lastSingleQuote + 1);
                quoteCharacter = singleQuote;
            }
            else if (lastDoubleQuote > lastSingleQuote) {
                stringValue = priorText.substr(lastDoubleQuote + 1);
                quoteCharacter = doubleQuote;
            }
        }
        // If the invocation position is within an f-string, use a double or
        // single quote that doesn't match the f-string. Prior to Python 3.12,
        // using the same quotation mark nested within an f-string was not
        // permitted. For example, f"..{typedDict[|<= here ]}", we need to use
        // single quotes. Note that this doesn't account for deeper nested
        // f-strings.
        if (this._stringLiteralContainer.flags & 64 /* StringTokenFlags.Format */) {
            quoteCharacter =
                this._stringLiteralContainer.flags & 1 /* StringTokenFlags.SingleQuote */ ? doubleQuote : singleQuote;
        }
        if (stringValue) {
            filterText = stringValue;
        }
        return { priorWord, priorText, filterText, stringValue, quoteCharacter };
    }
    _tryAddTypedDictKeysFromIndexer(indexNode, priorWord, priorText, postText, completionMap) {
        if (!indexNode) {
            return false;
        }
        const baseType = this.evaluator.getType(indexNode.baseExpression);
        if (!baseType) {
            return false;
        }
        return this._tryAddTypedDictKeys(baseType, [], priorWord, priorText, postText, completionMap);
    }
    _addStringLiteralToCompletions(value, quoteInfo, postText, completionMap, detail) {
        if (!StringUtils.isPatternInSymbol(quoteInfo.filterText || '', value)) {
            return;
        }
        const valueWithQuotes = `${quoteInfo.quoteCharacter}${value}${quoteInfo.quoteCharacter}`;
        if (completionMap.has(valueWithQuotes)) {
            return;
        }
        const completionItem = vscode_languageserver_1.CompletionItem.create(valueWithQuotes);
        completionItem.kind = vscode_languageserver_1.CompletionItemKind.Constant;
        completionItem.sortText = this._makeSortText(SortCategory.LiteralValue, valueWithQuotes);
        let rangeStartCol = this.position.character;
        if (quoteInfo.stringValue !== undefined) {
            rangeStartCol -= quoteInfo.stringValue.length + 1;
        }
        else if (quoteInfo.priorWord) {
            rangeStartCol -= quoteInfo.priorWord.length;
        }
        // If the text after the insertion point is the closing quote,
        // replace it.
        let rangeEndCol = this.position.character;
        if (postText !== undefined) {
            if (postText.startsWith(quoteInfo.quoteCharacter)) {
                rangeEndCol++;
            }
        }
        const range = {
            start: { line: this.position.line, character: rangeStartCol },
            end: { line: this.position.line, character: rangeEndCol },
        };
        completionItem.textEdit = vscode_languageserver_1.TextEdit.replace(range, valueWithQuotes);
        completionItem.detail = detail;
        completionMap.set(completionItem);
    }
    _getImportFromCompletions(importFromNode, offset, priorWord) {
        var _a;
        // Don't attempt to provide completions for "from X import *".
        if (importFromNode.isWildcardImport) {
            return undefined;
        }
        // Access the imported module information, which is hanging
        // off the ImportFromNode.
        const importInfo = AnalyzerNodeInfo.getImportInfo(importFromNode.module);
        if (!importInfo) {
            return undefined;
        }
        const completionMap = new CompletionMap();
        const resolvedPath = importInfo.resolvedUris.length > 0
            ? importInfo.resolvedUris[importInfo.resolvedUris.length - 1]
            : uri_1.Uri.empty();
        const parseResults = this.program.getParseResults(resolvedPath);
        if (!parseResults) {
            // Add the implicit imports.
            this._addImplicitImportsToCompletion(importInfo, importFromNode, priorWord, completionMap);
            return completionMap;
        }
        const symbolTable = (_a = AnalyzerNodeInfo.getScope(parseResults.parserOutput.parseTree)) === null || _a === void 0 ? void 0 : _a.symbolTable;
        if (!symbolTable) {
            return completionMap;
        }
        this._addSymbolsForSymbolTable(symbolTable, (symbol, name) => {
            return (
            // Don't suggest built in symbols.
            symbol.getDeclarations().some((d) => !(0, declaration_1.isIntrinsicDeclaration)(d)) &&
                // Don't suggest symbols that have already been imported elsewhere
                // in this import statement.
                !importFromNode.imports.find((imp) => imp.name.value === name &&
                    !(textRange_1.TextRange.contains(imp, offset) || textRange_1.TextRange.getEnd(imp) === offset)));
        }, priorWord, importFromNode, 
        /* isInImport */ true, 
        /* boundObject */ undefined, completionMap);
        // Add the implicit imports.
        this._addImplicitImportsToCompletion(importInfo, importFromNode, priorWord, completionMap);
        return completionMap;
    }
    _addImplicitImportsToCompletion(importInfo, importFromNode, priorWord, completionMap) {
        importInfo.implicitImports.forEach((implImport) => {
            if (!importFromNode.imports.find((imp) => imp.name.value === implImport.name)) {
                this.addNameToCompletions(implImport.name, vscode_languageserver_1.CompletionItemKind.Module, priorWord, completionMap, {
                    moduleUri: implImport.uri,
                });
            }
        });
    }
    _findMatchingKeywords(keywordList, partialMatch) {
        return keywordList.filter((keyword) => {
            if (partialMatch) {
                return StringUtils.isPatternInSymbol(partialMatch, keyword);
            }
            else {
                return true;
            }
        });
    }
    _addNamedParameters(signatureInfo, priorWord, completionMap) {
        const argNameSet = new Set();
        signatureInfo.signatures.forEach((signature) => {
            this._addNamedParametersToMap(signature.type, argNameSet);
        });
        // Add keys from typed dict outside signatures.
        signatureInfo.signatures.forEach((signature) => {
            var _a;
            if (signature.type.boundToType) {
                const keys = Array.from(((_a = signature.type.boundToType.details.typedDictEntries) === null || _a === void 0 ? void 0 : _a.knownItems.keys()) || []);
                keys.forEach((key) => argNameSet.add(key));
            }
        });
        // Remove any named parameters that are already provided.
        signatureInfo.callNode.arguments.forEach((arg) => {
            if (arg.name) {
                argNameSet.delete(arg.name.value);
            }
        });
        // Add the remaining unique parameter names to the completion list.
        argNameSet.forEach((argName) => {
            if (StringUtils.isPatternInSymbol(priorWord, argName)) {
                const label = argName + '=';
                if (completionMap.has(label)) {
                    return;
                }
                const completionItem = vscode_languageserver_1.CompletionItem.create(label);
                completionItem.kind = vscode_languageserver_1.CompletionItemKind.Variable;
                const completionItemData = {
                    uri: this.fileUri.toString(),
                    position: this.position,
                };
                completionItem.data = (0, lspUtils_1.toLSPAny)(completionItemData);
                completionItem.sortText = this._makeSortText(SortCategory.NamedParameter, argName);
                completionItem.filterText = argName;
                completionMap.set(completionItem);
            }
        });
    }
    _addNamedParametersToMap(type, names) {
        const paramDetails = (0, parameterUtils_1.getParameterListDetails)(type);
        paramDetails.params.forEach((paramInfo) => {
            if (paramInfo.param.name && paramInfo.kind !== parameterUtils_1.ParameterKind.Positional) {
                if (!SymbolNameUtils.isPrivateOrProtectedName(paramInfo.param.name)) {
                    names.add(paramInfo.param.name);
                }
            }
        });
    }
    _addSymbols(node, priorWord, completionMap) {
        let curNode = node;
        while (curNode) {
            // Does this node have a scope associated with it?
            let scope = (0, scopeUtils_1.getScopeForNode)(curNode);
            if (scope) {
                while (scope) {
                    this._addSymbolsForSymbolTable(scope.symbolTable, () => true, priorWord, node, 
                    /* isInImport */ false, 
                    /* boundObject */ undefined, completionMap);
                    scope = scope.parent;
                }
                // If this is a class scope, add symbols from parent classes.
                if (curNode.nodeType === 10 /* ParseNodeType.Class */) {
                    const classType = this.evaluator.getTypeOfClass(curNode);
                    if (classType && (0, types_1.isInstantiableClass)(classType.classType)) {
                        classType.classType.details.mro.forEach((baseClass, index) => {
                            if ((0, types_1.isInstantiableClass)(baseClass)) {
                                this._addSymbolsForSymbolTable(types_1.ClassType.getSymbolTable(baseClass), (symbol) => {
                                    if (!symbol.isClassMember()) {
                                        return false;
                                    }
                                    // Return only variables, not methods or classes.
                                    return symbol
                                        .getDeclarations()
                                        .some((decl) => decl.type === 1 /* DeclarationType.Variable */);
                                }, priorWord, node, 
                                /* isInImport */ false, 
                                /* boundObject */ undefined, completionMap);
                            }
                        });
                    }
                }
                break;
            }
            curNode = curNode.parent;
        }
    }
    _addSymbolsForSymbolTable(symbolTable, includeSymbolCallback, priorWord, node, isInImport, boundObjectOrClass, completionMap) {
        const insideTypeAnnotation = ParseTreeUtils.isWithinAnnotationComment(node) ||
            ParseTreeUtils.isWithinTypeAnnotation(node, /* requireQuotedAnnotation */ false);
        symbolTable.forEach((symbol, name) => {
            // If there are no declarations or the symbol is not
            // exported from this scope, don't include it in the
            // suggestion list unless we are in the same file.
            const hidden = !(0, symbolUtils_1.isVisibleExternally)(symbol) && !symbol.getDeclarations().some((d) => (0, declarationUtils_1.isDefinedInFile)(d, this.fileUri));
            if (!hidden && includeSymbolCallback(symbol, name)) {
                // Don't add a symbol more than once. It may have already been
                // added from an inner scope's symbol table.
                if (!completionMap.has(name)) {
                    // Skip func parens for classes when not a direct assignment or an argument (passed as a value)
                    const skipForClass = !this._shouldShowAutoParensForClass(symbol, node);
                    this.addSymbol(name, symbol, priorWord, completionMap, {
                        boundObjectOrClass,
                        funcParensDisabled: isInImport || insideTypeAnnotation || skipForClass,
                        extraCommitChars: !isInImport && !!priorWord,
                    });
                }
            }
        });
    }
    _shouldShowAutoParensForClass(symbol, node) {
        var _a, _b;
        if (symbol.getDeclarations().every((d) => d.type !== 6 /* DeclarationType.Class */)) {
            // Not actually a class, so yes show parens.
            return true;
        }
        // If an argument then show parens for classes if not a class argument.
        if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 1 /* ParseNodeType.Argument */ && ((_b = node.parent.parent) === null || _b === void 0 ? void 0 : _b.nodeType) !== 10 /* ParseNodeType.Class */) {
            return true;
        }
        // Otherwise only show when the class is being assigned to a variable.
        const nodeIndex = ParseTreeUtils.getTokenIndexAtLeft(this.parseResults.tokenizerOutput.tokens, node.start);
        const prevToken = ParseTreeUtils.getTokenAtIndex(this.parseResults.tokenizerOutput.tokens, nodeIndex);
        return (prevToken &&
            prevToken.type === 9 /* TokenType.Operator */ &&
            prevToken.operatorType === 2 /* OperatorType.Assign */);
    }
    _getRecentListIndex(name, autoImportText) {
        return CompletionProvider._mostRecentCompletions.findIndex((item) => item.label === name && item.autoImportText === autoImportText);
    }
    _makeSortText(sortCategory, name, autoImportText = '') {
        const recentListIndex = this._getRecentListIndex(name, autoImportText);
        // If the label is in the recent list, modify the category
        // so it appears higher in our list.
        if (recentListIndex >= 0) {
            if (sortCategory === SortCategory.AutoImport) {
                sortCategory = SortCategory.RecentAutoImport;
            }
            else if (sortCategory === SortCategory.ImportModuleName) {
                sortCategory = SortCategory.RecentImportModuleName;
            }
            else if (sortCategory === SortCategory.Keyword ||
                sortCategory === SortCategory.NormalSymbol ||
                sortCategory === SortCategory.PrivateSymbol ||
                sortCategory === SortCategory.DunderSymbol) {
                sortCategory = SortCategory.RecentKeywordOrSymbol;
            }
        }
        // Generate a sort string of the format
        //    XX.YYYY.name
        // where XX is the sort category
        // and YYYY is the index of the item in the MRU list
        return this._formatInteger(sortCategory, 2) + '.' + this._formatInteger(recentListIndex, 4) + '.' + name;
    }
    _formatInteger(val, digits) {
        const charCodeZero = '0'.charCodeAt(0);
        let result = '';
        for (let i = 0; i < digits; i++) {
            // Prepend the next digit.
            let digit = Math.floor(val % 10);
            if (digit < 0) {
                digit = 9;
            }
            result = String.fromCharCode(digit + charCodeZero) + result;
            val = Math.floor(val / 10);
        }
        return result;
    }
    _convertDeclarationTypeToItemKind(declaration) {
        const resolvedDeclaration = this.evaluator.resolveAliasDeclaration(declaration, /* resolveLocalNames */ true);
        if (!resolvedDeclaration) {
            return vscode_languageserver_1.CompletionItemKind.Variable;
        }
        switch (resolvedDeclaration.type) {
            case 0 /* DeclarationType.Intrinsic */:
                return resolvedDeclaration.intrinsicType === 'type[self]'
                    ? vscode_languageserver_1.CompletionItemKind.Class
                    : vscode_languageserver_1.CompletionItemKind.Variable;
            case 2 /* DeclarationType.Parameter */:
                return vscode_languageserver_1.CompletionItemKind.Variable;
            case 3 /* DeclarationType.TypeParameter */:
                return vscode_languageserver_1.CompletionItemKind.TypeParameter;
            case 1 /* DeclarationType.Variable */:
                return resolvedDeclaration.isConstant || resolvedDeclaration.isFinal
                    ? vscode_languageserver_1.CompletionItemKind.Constant
                    : vscode_languageserver_1.CompletionItemKind.Variable;
            case 4 /* DeclarationType.TypeAlias */:
                return vscode_languageserver_1.CompletionItemKind.Variable;
            case 5 /* DeclarationType.Function */: {
                if (this._isPossiblePropertyDeclaration(resolvedDeclaration)) {
                    const functionType = this.evaluator.getTypeOfFunction(resolvedDeclaration.node);
                    if (functionType &&
                        (0, typeUtils_1.isMaybeDescriptorInstance)(functionType.decoratedType, /* requireSetter */ false)) {
                        return vscode_languageserver_1.CompletionItemKind.Property;
                    }
                }
                return resolvedDeclaration.isMethod ? vscode_languageserver_1.CompletionItemKind.Method : vscode_languageserver_1.CompletionItemKind.Function;
            }
            case 6 /* DeclarationType.Class */:
            case 7 /* DeclarationType.SpecialBuiltInClass */:
                return vscode_languageserver_1.CompletionItemKind.Class;
            case 8 /* DeclarationType.Alias */:
                return vscode_languageserver_1.CompletionItemKind.Module;
        }
    }
    _convertTypeToItemKind(type) {
        switch (type.category) {
            case 7 /* TypeCategory.Module */:
                return vscode_languageserver_1.CompletionItemKind.Module;
            case 6 /* TypeCategory.Class */:
                return vscode_languageserver_1.CompletionItemKind.Class;
            case 4 /* TypeCategory.Function */:
            case 5 /* TypeCategory.OverloadedFunction */:
                if ((0, typeUtils_1.isMaybeDescriptorInstance)(type, /* requireSetter */ false)) {
                    return vscode_languageserver_1.CompletionItemKind.Property;
                }
                return vscode_languageserver_1.CompletionItemKind.Function;
            case 9 /* TypeCategory.TypeVar */:
                return vscode_languageserver_1.CompletionItemKind.TypeParameter;
            default:
                return vscode_languageserver_1.CompletionItemKind.Variable;
        }
    }
    _getImportModuleCompletions(node) {
        const moduleDescriptor = {
            leadingDots: node.leadingDots,
            hasTrailingDot: node.hasTrailingDot || false,
            nameParts: node.nameParts.map((part) => part.value),
            importedSymbols: new Set(),
        };
        const completions = this.importResolver.getCompletionSuggestions(this.fileUri, this.execEnv, moduleDescriptor);
        const completionMap = new CompletionMap();
        // If we're in the middle of a "from X import Y" statement, offer
        // the "import" keyword as a completion.
        if (!node.hasTrailingDot &&
            node.parent &&
            node.parent.nodeType === 25 /* ParseNodeType.ImportFrom */ &&
            node.parent.missingImportKeyword) {
            const keyword = 'import';
            const completionItem = vscode_languageserver_1.CompletionItem.create(keyword);
            completionItem.kind = vscode_languageserver_1.CompletionItemKind.Keyword;
            completionItem.sortText = this._makeSortText(SortCategory.Keyword, keyword);
            completionMap.set(completionItem);
        }
        completions.forEach((modulePath, completionName) => {
            this.addNameToCompletions(completionName, vscode_languageserver_1.CompletionItemKind.Module, '', completionMap, {
                sortText: this._makeSortText(SortCategory.ImportModuleName, completionName),
                moduleUri: modulePath,
            });
        });
        return completionMap;
    }
    _isPossiblePropertyDeclaration(decl) {
        // Do cheap check using only nodes that will cover 99.9% cases
        // before doing more expensive type evaluation.
        return decl.isMethod && decl.node.decorators.length > 0;
    }
    _isEnumMember(containingType, name) {
        if (!containingType || !types_1.ClassType.isEnumClass(containingType)) {
            return false;
        }
        const symbolType = (0, enums_1.transformTypeForEnumMember)(this.evaluator, containingType, name);
        return (symbolType &&
            (0, types_1.isClassInstance)(symbolType) &&
            types_1.ClassType.isSameGenericClass(symbolType, containingType) &&
            symbolType.literalValue instanceof types_1.EnumLiteral);
    }
}
exports.CompletionProvider = CompletionProvider;
CompletionProvider._mostRecentCompletions = [];
class CompletionMap {
    constructor() {
        this._completions = new Map();
    }
    get size() {
        return this._completions.size;
    }
    set(value) {
        const existing = this._completions.get(value.label);
        if (!existing) {
            this._completions.set(value.label, value);
        }
        else if (Array.isArray(existing)) {
            existing.push(value);
        }
        else {
            this._completions.set(value.label, [existing, value]);
        }
    }
    get(key) {
        return this._completions.get(key);
    }
    has(label, predicate, kind, autImportText) {
        const existing = this._completions.get(label);
        if (!existing) {
            return false;
        }
        if (predicate) {
            return predicate(existing, kind, autImportText);
        }
        return true;
    }
    clear() {
        this._completions.clear();
    }
    delete(key) {
        return this._completions.delete(key);
    }
    toArray() {
        var _a;
        const items = [];
        (_a = this._completions) === null || _a === void 0 ? void 0 : _a.forEach((value) => {
            if (Array.isArray(value)) {
                value.forEach((item) => {
                    items.push(item);
                });
            }
            else {
                items.push(value);
            }
        });
        return items;
    }
    static matchKindAndImportText(completionItemOrItems, kind, autoImportText) {
        var _a;
        if (!Array.isArray(completionItemOrItems)) {
            return (completionItemOrItems.kind === kind &&
                ((_a = _getCompletionData(completionItemOrItems)) === null || _a === void 0 ? void 0 : _a.autoImportText) === autoImportText);
        }
        else {
            return !!completionItemOrItems.find((c) => { var _a; return c.kind === kind && ((_a = _getCompletionData(c)) === null || _a === void 0 ? void 0 : _a.autoImportText) === autoImportText; });
        }
    }
    static labelOnlyIgnoringAutoImports(completionItemOrItems) {
        var _a;
        if (!Array.isArray(completionItemOrItems)) {
            if (!((_a = _getCompletionData(completionItemOrItems)) === null || _a === void 0 ? void 0 : _a.autoImportText)) {
                return true;
            }
        }
        else {
            if (completionItemOrItems.find((c) => { var _a; return !((_a = _getCompletionData(c)) === null || _a === void 0 ? void 0 : _a.autoImportText); })) {
                return true;
            }
        }
        return false;
    }
}
exports.CompletionMap = CompletionMap;
function _getCompletionData(completionItem) {
    return (0, lspUtils_1.fromLSPAny)(completionItem.data);
}
//# sourceMappingURL=completionProvider.js.map