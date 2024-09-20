"use strict";
/*
 * callHierarchyProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that provides a list of callers or callees associated with
 * a position.
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
exports.CallHierarchyProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const DeclarationUtils = __importStar(require("../analyzer/declarationUtils"));
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const parseTreeWalker_1 = require("../analyzer/parseTreeWalker");
const sourceFileInfoUtils_1 = require("../analyzer/sourceFileInfoUtils");
const typeUtils_1 = require("../analyzer/typeUtils");
const types_1 = require("../analyzer/types");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const core_1 = require("../common/core");
const extensibility_1 = require("../common/extensibility");
const lspUtils_1 = require("../common/lspUtils");
const positionUtils_1 = require("../common/positionUtils");
const serviceKeys_1 = require("../common/serviceKeys");
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const referencesProvider_1 = require("../languageService/referencesProvider");
const documentSymbolCollector_1 = require("./documentSymbolCollector");
const navigationUtils_1 = require("./navigationUtils");
class CallHierarchyProvider {
    constructor(_program, _fileUri, _position, _token) {
        this._program = _program;
        this._fileUri = _fileUri;
        this._position = _position;
        this._token = _token;
        this._parseResults = this._program.getParseResults(this._fileUri);
    }
    onPrepare() {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return null;
        }
        const referencesResult = this._getDeclaration();
        if (!referencesResult || referencesResult.declarations.length === 0) {
            return null;
        }
        const { targetDecl, callItemUri, symbolName } = this._getTargetDeclaration(referencesResult);
        if (targetDecl.type !== 5 /* DeclarationType.Function */ &&
            targetDecl.type !== 6 /* DeclarationType.Class */ &&
            targetDecl.type !== 8 /* DeclarationType.Alias */) {
            return null;
        }
        // make sure the alias is resolved to class or function
        if (targetDecl.type === 8 /* DeclarationType.Alias */) {
            const resolvedDecl = this._evaluator.resolveAliasDeclaration(targetDecl, true);
            if (!resolvedDecl) {
                return null;
            }
            if (resolvedDecl.type !== 5 /* DeclarationType.Function */ && resolvedDecl.type !== 6 /* DeclarationType.Class */) {
                return null;
            }
        }
        const callItem = {
            name: symbolName,
            kind: (_a = (0, lspUtils_1.getSymbolKind)(targetDecl, this._evaluator, symbolName)) !== null && _a !== void 0 ? _a : vscode_languageserver_1.SymbolKind.Module,
            uri: (0, uriUtils_1.convertUriToLspUriString)(this._program.fileSystem, callItemUri),
            range: targetDecl.range,
            selectionRange: targetDecl.range,
        };
        if (!(0, navigationUtils_1.canNavigateToFile)(this._program.fileSystem, uri_1.Uri.parse(callItem.uri, this._program.serviceProvider))) {
            return null;
        }
        return [callItem];
    }
    getIncomingCalls() {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return null;
        }
        const referencesResult = this._getDeclaration();
        if (!referencesResult || referencesResult.declarations.length === 0) {
            return null;
        }
        const { targetDecl, symbolName } = this._getTargetDeclaration(referencesResult);
        const items = [];
        const sourceFiles = targetDecl.type === 8 /* DeclarationType.Alias */
            ? [this._program.getSourceFileInfo(this._fileUri)]
            : this._program.getSourceFileInfoList();
        for (const curSourceFileInfo of sourceFiles) {
            if ((0, sourceFileInfoUtils_1.isUserCode)(curSourceFileInfo) || curSourceFileInfo.isOpenByClient) {
                const filePath = curSourceFileInfo.sourceFile.getUri();
                const itemsToAdd = this._getIncomingCallsForDeclaration(filePath, symbolName, targetDecl);
                if (itemsToAdd) {
                    (0, collectionUtils_1.appendArray)(items, itemsToAdd);
                }
                // This operation can consume significant memory, so check
                // for situations where we need to discard the type cache.
                this._program.handleMemoryHighUsage();
            }
        }
        if (items.length === 0) {
            return null;
        }
        return items.filter((item) => (0, navigationUtils_1.canNavigateToFile)(this._program.fileSystem, uri_1.Uri.parse(item.from.uri, this._program.serviceProvider)));
    }
    getOutgoingCalls() {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return null;
        }
        const referencesResult = this._getDeclaration();
        if (!referencesResult || referencesResult.declarations.length === 0) {
            return null;
        }
        const { targetDecl } = this._getTargetDeclaration(referencesResult);
        // Find the parse node root corresponding to the function or class.
        let parseRoot;
        const resolvedDecl = this._evaluator.resolveAliasDeclaration(targetDecl, /* resolveLocalNames */ true);
        if (!resolvedDecl) {
            return null;
        }
        if (resolvedDecl.type === 5 /* DeclarationType.Function */) {
            parseRoot = resolvedDecl.node;
        }
        else if (resolvedDecl.type === 6 /* DeclarationType.Class */) {
            // Look up the __init__ method for this class.
            const classType = (_a = this._evaluator.getTypeForDeclaration(resolvedDecl)) === null || _a === void 0 ? void 0 : _a.type;
            if (classType && (0, types_1.isInstantiableClass)(classType)) {
                // Don't perform a recursive search of parent classes in this
                // case because we don't want to find an inherited __init__
                // method defined in a different module.
                const initMethodMember = (0, typeUtils_1.lookUpClassMember)(classType, '__init__', 16 /* MemberAccessFlags.SkipInstanceMembers */ |
                    4 /* MemberAccessFlags.SkipObjectBaseClass */ |
                    2 /* MemberAccessFlags.SkipBaseClasses */);
                if (initMethodMember) {
                    const initMethodType = this._evaluator.getTypeOfMember(initMethodMember);
                    if (initMethodType && (0, types_1.isFunction)(initMethodType)) {
                        const initDecls = initMethodMember.symbol.getDeclarations();
                        if (initDecls && initDecls.length > 0) {
                            const primaryInitDecl = initDecls[0];
                            if (primaryInitDecl.type === 5 /* DeclarationType.Function */) {
                                parseRoot = primaryInitDecl.node;
                            }
                        }
                    }
                }
            }
        }
        if (!parseRoot) {
            return null;
        }
        const callFinder = new FindOutgoingCallTreeWalker(this._program.fileSystem, parseRoot, this._parseResults, this._evaluator, this._token);
        const outgoingCalls = callFinder.findCalls();
        if (outgoingCalls.length === 0) {
            return null;
        }
        return outgoingCalls.filter((item) => (0, navigationUtils_1.canNavigateToFile)(this._program.fileSystem, uri_1.Uri.parse(item.to.uri, this._program.serviceProvider)));
    }
    get _evaluator() {
        return this._program.evaluator;
    }
    _getTargetDeclaration(referencesResult) {
        // If there's more than one declaration, pick the target one.
        // We'll always prefer one with a declared type, and we'll always
        // prefer later declarations.
        const declarations = referencesResult.declarations;
        const node = referencesResult.nodeAtOffset;
        let targetDecl = declarations[0];
        for (const decl of declarations) {
            if (DeclarationUtils.hasTypeForDeclaration(decl) || !DeclarationUtils.hasTypeForDeclaration(targetDecl)) {
                if (decl.type === 5 /* DeclarationType.Function */ || decl.type === 6 /* DeclarationType.Class */) {
                    targetDecl = decl;
                    // If the specified node is an exact match, use this declaration
                    // as the primary even if it's not the last.
                    if (decl.node === node) {
                        break;
                    }
                }
            }
        }
        let symbolName;
        // Although the LSP specification requires a URI, we are using a file path
        // here because it is converted to the proper URI by the caller.
        // This simplifies our code and ensures compatibility with the LSP specification.
        let callItemUri;
        if (targetDecl.type === 8 /* DeclarationType.Alias */) {
            symbolName = referencesResult.nodeAtOffset.value;
            callItemUri = this._fileUri;
        }
        else {
            symbolName = DeclarationUtils.getNameFromDeclaration(targetDecl) || referencesResult.symbolNames[0];
            callItemUri = targetDecl.uri;
        }
        return { targetDecl, callItemUri, symbolName };
    }
    _getIncomingCallsForDeclaration(fileUri, symbolName, declaration) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        const callFinder = new FindIncomingCallTreeWalker(this._program, fileUri, symbolName, declaration, this._token);
        const incomingCalls = callFinder.findCalls();
        return incomingCalls.length > 0 ? incomingCalls : undefined;
    }
    _getDeclaration() {
        return referencesProvider_1.ReferencesProvider.getDeclarationForPosition(this._program, this._fileUri, this._position, 
        /* reporter */ undefined, extensibility_1.ReferenceUseCase.References, this._token);
    }
}
exports.CallHierarchyProvider = CallHierarchyProvider;
class FindOutgoingCallTreeWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_fs, _parseRoot, _parseResults, _evaluator, _cancellationToken) {
        super();
        this._fs = _fs;
        this._parseRoot = _parseRoot;
        this._parseResults = _parseResults;
        this._evaluator = _evaluator;
        this._cancellationToken = _cancellationToken;
        this._outgoingCalls = [];
    }
    findCalls() {
        this.walk(this._parseRoot);
        return this._outgoingCalls;
    }
    visitCall(node) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._cancellationToken);
        let nameNode;
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */) {
            nameNode = node.leftExpression;
        }
        else if (node.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            nameNode = node.leftExpression.memberName;
        }
        if (nameNode) {
            const declarations = this._evaluator.getDeclarationsForNameNode(nameNode);
            if (declarations) {
                // TODO - it would be better if we could match the call to the
                // specific declaration (e.g. a specific overload of a property
                // setter vs getter). For now, add callees for all declarations.
                declarations.forEach((decl) => {
                    this._addOutgoingCallForDeclaration(nameNode, decl);
                });
            }
        }
        return true;
    }
    visitMemberAccess(node) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._cancellationToken);
        // Determine whether the member corresponds to a property.
        // If so, we'll treat it as a function call for purposes of
        // finding outgoing calls.
        const leftHandType = this._evaluator.getType(node.leftExpression);
        if (leftHandType) {
            (0, typeUtils_1.doForEachSubtype)(leftHandType, (subtype) => {
                let baseType = subtype;
                // This could be a bound TypeVar (e.g. used for "self" and "cls").
                baseType = this._evaluator.makeTopLevelTypeVarsConcrete(baseType);
                if (!(0, types_1.isClassInstance)(baseType)) {
                    return;
                }
                const memberInfo = (0, typeUtils_1.lookUpObjectMember)(baseType, node.memberName.value);
                if (!memberInfo) {
                    return;
                }
                const memberType = this._evaluator.getTypeOfMember(memberInfo);
                const propertyDecls = memberInfo.symbol.getDeclarations();
                if (!memberType) {
                    return;
                }
                if ((0, types_1.isClassInstance)(memberType) && types_1.ClassType.isPropertyClass(memberType)) {
                    propertyDecls.forEach((decl) => {
                        this._addOutgoingCallForDeclaration(node.memberName, decl);
                    });
                }
            });
        }
        return true;
    }
    _addOutgoingCallForDeclaration(nameNode, declaration) {
        var _a, _b;
        const resolvedDecl = this._evaluator.resolveAliasDeclaration(declaration, /* resolveLocalNames */ true);
        if (!resolvedDecl) {
            return;
        }
        if (resolvedDecl.type !== 5 /* DeclarationType.Function */ && resolvedDecl.type !== 6 /* DeclarationType.Class */) {
            return;
        }
        const callDest = {
            name: nameNode.value,
            kind: (_a = (0, lspUtils_1.getSymbolKind)(resolvedDecl, this._evaluator, nameNode.value)) !== null && _a !== void 0 ? _a : vscode_languageserver_1.SymbolKind.Module,
            uri: (0, uriUtils_1.convertUriToLspUriString)(this._fs, resolvedDecl.uri),
            range: resolvedDecl.range,
            selectionRange: resolvedDecl.range,
        };
        // Is there already a call recorded for this destination? If so,
        // we'll simply add a new range. Otherwise, we'll create a new entry.
        let outgoingCall = this._outgoingCalls.find((outgoing) => outgoing.to.uri === callDest.uri && (0, textRange_1.rangesAreEqual)(outgoing.to.range, callDest.range));
        if (!outgoingCall) {
            outgoingCall = {
                to: callDest,
                fromRanges: [],
            };
            this._outgoingCalls.push(outgoingCall);
        }
        if (outgoingCall && outgoingCall.to.name !== nameNode.value) {
            // If both the function and its alias are called in the same function,
            // the name of the call item will be the resolved declaration name, not the alias.
            outgoingCall.to.name = (_b = DeclarationUtils.getNameFromDeclaration(resolvedDecl)) !== null && _b !== void 0 ? _b : nameNode.value;
        }
        const fromRange = (0, positionUtils_1.convertOffsetsToRange)(nameNode.start, nameNode.start + nameNode.length, this._parseResults.tokenizerOutput.lines);
        outgoingCall.fromRanges.push(fromRange);
    }
}
class FindIncomingCallTreeWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_program, _fileUri, _symbolName, _targetDeclaration, _cancellationToken) {
        var _a;
        super();
        this._program = _program;
        this._fileUri = _fileUri;
        this._symbolName = _symbolName;
        this._targetDeclaration = _targetDeclaration;
        this._cancellationToken = _cancellationToken;
        this._incomingCalls = [];
        this._declarations = [];
        this._parseResults = this._program.getParseResults(this._fileUri);
        this._usageProviders = ((_a = this._program.serviceProvider.tryGet(serviceKeys_1.ServiceKeys.symbolUsageProviderFactory)) !== null && _a !== void 0 ? _a : [])
            .map((f) => f.tryCreateProvider(extensibility_1.ReferenceUseCase.References, [this._targetDeclaration], this._cancellationToken))
            .filter(core_1.isDefined);
        this._declarations.push(this._targetDeclaration);
        this._usageProviders.forEach((p) => p.appendDeclarationsTo(this._declarations));
    }
    findCalls() {
        this.walk(this._parseResults.parserOutput.parseTree);
        return this._incomingCalls;
    }
    visitCall(node) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._cancellationToken);
        let nameNode;
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */) {
            nameNode = node.leftExpression;
        }
        else if (node.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            nameNode = node.leftExpression.memberName;
        }
        // Don't bother doing any more work if the name doesn't match.
        if (nameNode && nameNode.value === this._symbolName) {
            const declarations = this._getDeclarations(nameNode);
            if (declarations) {
                if (this._targetDeclaration.type === 8 /* DeclarationType.Alias */) {
                    const resolvedCurDecls = this._evaluator.resolveAliasDeclaration(this._targetDeclaration, 
                    /* resolveLocalNames */ true);
                    if (resolvedCurDecls &&
                        declarations.some((decl) => DeclarationUtils.areDeclarationsSame(decl, resolvedCurDecls))) {
                        this._addIncomingCallForDeclaration(nameNode);
                    }
                }
                else if (declarations.some((decl) => this._declarations.some((t) => DeclarationUtils.areDeclarationsSame(decl, t)))) {
                    this._addIncomingCallForDeclaration(nameNode);
                }
            }
        }
        return true;
    }
    visitMemberAccess(node) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._cancellationToken);
        if (node.memberName.value === this._symbolName) {
            // Determine whether the member corresponds to a property.
            // If so, we'll treat it as a function call for purposes of
            // finding outgoing calls.
            const leftHandType = this._evaluator.getType(node.leftExpression);
            if (leftHandType) {
                (0, typeUtils_1.doForEachSubtype)(leftHandType, (subtype) => {
                    let baseType = subtype;
                    // This could be a bound TypeVar (e.g. used for "self" and "cls").
                    baseType = this._evaluator.makeTopLevelTypeVarsConcrete(baseType);
                    if (!(0, types_1.isClassInstance)(baseType)) {
                        return;
                    }
                    const memberInfo = (0, typeUtils_1.lookUpObjectMember)(baseType, node.memberName.value);
                    if (!memberInfo) {
                        return;
                    }
                    const memberType = this._evaluator.getTypeOfMember(memberInfo);
                    const propertyDecls = memberInfo.symbol.getDeclarations();
                    if (!memberType) {
                        return;
                    }
                    if (propertyDecls.some((decl) => DeclarationUtils.areDeclarationsSame(decl, this._targetDeclaration))) {
                        this._addIncomingCallForDeclaration(node.memberName);
                    }
                });
            }
        }
        return true;
    }
    get _evaluator() {
        return this._program.evaluator;
    }
    _getDeclarations(node) {
        const declarations = documentSymbolCollector_1.DocumentSymbolCollector.getDeclarationsForNode(this._program, node, 
        /* resolveLocalName */ true, this._cancellationToken);
        const results = [...declarations];
        this._usageProviders.forEach((p) => p.appendDeclarationsAt(node, declarations, results));
        return results;
    }
    _addIncomingCallForDeclaration(nameNode) {
        let executionNode = ParseTreeUtils.getExecutionScopeNode(nameNode);
        while (executionNode && executionNode.nodeType === 76 /* ParseNodeType.TypeParameterList */) {
            executionNode = ParseTreeUtils.getExecutionScopeNode(executionNode);
        }
        if (!executionNode) {
            return;
        }
        let callSource;
        if (executionNode.nodeType === 36 /* ParseNodeType.Module */) {
            const moduleRange = (0, positionUtils_1.convertOffsetsToRange)(0, 0, this._parseResults.tokenizerOutput.lines);
            const fileName = this._program.fileSystem.getOriginalUri(this._fileUri).fileName;
            callSource = {
                name: `(module) ${fileName}`,
                kind: vscode_languageserver_1.SymbolKind.Module,
                uri: (0, uriUtils_1.convertUriToLspUriString)(this._program.fileSystem, this._fileUri),
                range: moduleRange,
                selectionRange: moduleRange,
            };
        }
        else if (executionNode.nodeType === 33 /* ParseNodeType.Lambda */) {
            const lambdaRange = (0, positionUtils_1.convertOffsetsToRange)(executionNode.start, executionNode.start + executionNode.length, this._parseResults.tokenizerOutput.lines);
            callSource = {
                name: '(lambda)',
                kind: vscode_languageserver_1.SymbolKind.Function,
                uri: (0, uriUtils_1.convertUriToLspUriString)(this._program.fileSystem, this._fileUri),
                range: lambdaRange,
                selectionRange: lambdaRange,
            };
        }
        else {
            const functionRange = (0, positionUtils_1.convertOffsetsToRange)(executionNode.name.start, executionNode.name.start + executionNode.name.length, this._parseResults.tokenizerOutput.lines);
            callSource = {
                name: executionNode.name.value,
                kind: vscode_languageserver_1.SymbolKind.Function,
                uri: (0, uriUtils_1.convertUriToLspUriString)(this._program.fileSystem, this._fileUri),
                range: functionRange,
                selectionRange: functionRange,
            };
        }
        // Is there already a call recorded for this caller? If so,
        // we'll simply add a new range. Otherwise, we'll create a new entry.
        let incomingCall = this._incomingCalls.find((incoming) => incoming.from.uri === callSource.uri && (0, textRange_1.rangesAreEqual)(incoming.from.range, callSource.range));
        if (!incomingCall) {
            incomingCall = {
                from: callSource,
                fromRanges: [],
            };
            this._incomingCalls.push(incomingCall);
        }
        const fromRange = (0, positionUtils_1.convertOffsetsToRange)(nameNode.start, nameNode.start + nameNode.length, this._parseResults.tokenizerOutput.lines);
        incomingCall.fromRanges.push(fromRange);
    }
}
//# sourceMappingURL=callHierarchyProvider.js.map