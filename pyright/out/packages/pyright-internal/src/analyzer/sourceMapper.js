"use strict";
/*
 * sourceMapper.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Logic that maps a ".pyi" stub to its ".py" source file.
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
exports.isStubFile = exports.SourceMapper = void 0;
const AnalyzerNodeInfo = __importStar(require("../analyzer/analyzerNodeInfo"));
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const collectionUtils_1 = require("../common/collectionUtils");
const core_1 = require("../common/core");
const debug_1 = require("../common/debug");
const declaration_1 = require("./declaration");
const sourceFileInfoUtils_1 = require("./sourceFileInfoUtils");
const sourceMapperUtils_1 = require("./sourceMapperUtils");
const typeUtils_1 = require("./typeUtils");
const types_1 = require("./types");
class SourceMapper {
    constructor(_importResolver, _execEnv, _evaluator, _fileBinder, _boundSourceGetter, _mapCompiled, _preferStubs, _fromFile, _cancelToken) {
        this._importResolver = _importResolver;
        this._execEnv = _execEnv;
        this._evaluator = _evaluator;
        this._fileBinder = _fileBinder;
        this._boundSourceGetter = _boundSourceGetter;
        this._mapCompiled = _mapCompiled;
        this._preferStubs = _preferStubs;
        this._fromFile = _fromFile;
        this._cancelToken = _cancelToken;
    }
    findModules(stubFileUri) {
        var _a;
        const sourceFiles = this._isStubThatShouldBeMappedToImplementation(stubFileUri)
            ? this._getBoundSourceFilesFromStubFile(stubFileUri)
            : [(_a = this._boundSourceGetter(stubFileUri)) === null || _a === void 0 ? void 0 : _a.sourceFile];
        return sourceFiles
            .filter(core_1.isDefined)
            .map((sf) => { var _a; return (_a = sf.getParserOutput()) === null || _a === void 0 ? void 0 : _a.parseTree; })
            .filter(core_1.isDefined);
    }
    getModuleNode(fileUri) {
        var _a, _b;
        return (_b = (_a = this._boundSourceGetter(fileUri)) === null || _a === void 0 ? void 0 : _a.sourceFile.getParserOutput()) === null || _b === void 0 ? void 0 : _b.parseTree;
    }
    findDeclarations(stubDecl) {
        if ((0, declaration_1.isClassDeclaration)(stubDecl)) {
            return this._findClassOrTypeAliasDeclarations(stubDecl);
        }
        else if ((0, declaration_1.isFunctionDeclaration)(stubDecl)) {
            return this._findFunctionOrTypeAliasDeclarations(stubDecl);
        }
        else if ((0, declaration_1.isVariableDeclaration)(stubDecl)) {
            return this._findVariableDeclarations(stubDecl);
        }
        else if ((0, declaration_1.isParameterDeclaration)(stubDecl)) {
            return this._findParameterDeclarations(stubDecl);
        }
        else if ((0, declaration_1.isSpecialBuiltInClassDeclaration)(stubDecl)) {
            return this._findSpecialBuiltInClassDeclarations(stubDecl);
        }
        return [];
    }
    findDeclarationsByType(originatedPath, type, useTypeAlias = false) {
        const result = [];
        this._addClassTypeDeclarations(originatedPath, type, result, new Set(), useTypeAlias);
        return result;
    }
    findClassDeclarationsByType(originatedPath, type) {
        const result = this.findDeclarationsByType(originatedPath, type);
        return result.filter((r) => (0, declaration_1.isClassDeclaration)(r)).map((r) => r);
    }
    findFunctionDeclarations(stubDecl) {
        return this._findFunctionOrTypeAliasDeclarations(stubDecl)
            .filter((d) => (0, declaration_1.isFunctionDeclaration)(d))
            .map((d) => d);
    }
    isUserCode(uri) {
        return (0, sourceFileInfoUtils_1.isUserCode)(this._boundSourceGetter(uri));
    }
    getNextFileName(uri) {
        const withoutExtension = uri.stripExtension();
        let suffix = 1;
        let result = withoutExtension.addExtension(`_${suffix}.py`);
        while (this.isUserCode(result) && suffix < 1000) {
            suffix += 1;
            result = withoutExtension.addExtension(`_${suffix}.py`);
        }
        return result;
    }
    _findSpecialBuiltInClassDeclarations(stubDecl, recursiveDeclCache = new Set()) {
        if (stubDecl.node.valueExpression.nodeType === 38 /* ParseNodeType.Name */) {
            const className = stubDecl.node.valueExpression.value;
            const sourceFiles = this._getBoundSourceFilesFromStubFile(stubDecl.uri);
            return sourceFiles.flatMap((sourceFile) => this._findClassDeclarationsByName(sourceFile, className, recursiveDeclCache));
        }
        return [];
    }
    _findClassOrTypeAliasDeclarations(stubDecl, recursiveDeclCache = new Set()) {
        const className = this._getFullClassName(stubDecl.node);
        const sourceFiles = this._getBoundSourceFilesFromStubFile(stubDecl.uri);
        return sourceFiles.flatMap((sourceFile) => this._findClassDeclarationsByName(sourceFile, className, recursiveDeclCache));
    }
    _findFunctionOrTypeAliasDeclarations(stubDecl, recursiveDeclCache = new Set()) {
        const functionName = stubDecl.node.name.value;
        const sourceFiles = this._getBoundSourceFilesFromStubFile(stubDecl.uri);
        if (stubDecl.isMethod) {
            const classNode = ParseTreeUtils.getEnclosingClass(stubDecl.node);
            if (classNode === undefined) {
                return [];
            }
            const className = this._getFullClassName(classNode);
            return sourceFiles.flatMap((sourceFile) => this._findMethodDeclarationsByName(sourceFile, className, functionName, recursiveDeclCache));
        }
        else {
            return sourceFiles.flatMap((sourceFile) => this._findFunctionDeclarationsByName(sourceFile, functionName, recursiveDeclCache));
        }
    }
    _findVariableDeclarations(stubDecl, recursiveDeclCache = new Set()) {
        if (stubDecl.node.nodeType !== 38 /* ParseNodeType.Name */) {
            return [];
        }
        const variableName = stubDecl.node.value;
        const sourceFiles = this._getBoundSourceFilesFromStubFile(stubDecl.uri);
        const classNode = ParseTreeUtils.getEnclosingClass(stubDecl.node);
        if (classNode) {
            const className = this._getFullClassName(classNode);
            return sourceFiles.flatMap((sourceFile) => this._findFieldDeclarationsByName(sourceFile, className, variableName, recursiveDeclCache));
        }
        else {
            return sourceFiles.flatMap((sourceFile) => this._findVariableDeclarationsByName(sourceFile, variableName, recursiveDeclCache));
        }
    }
    _findParameterDeclarations(stubDecl) {
        const result = [];
        if (!stubDecl.node.name) {
            return result;
        }
        const functionNode = ParseTreeUtils.getEnclosingFunction(stubDecl.node);
        if (!functionNode) {
            return result;
        }
        const functionStubDecls = this._evaluator.getDeclarationsForNameNode(functionNode.name);
        if (!functionStubDecls) {
            return result;
        }
        const recursiveDeclCache = new Set();
        for (const functionStubDecl of functionStubDecls) {
            for (const functionDecl of this._findFunctionOrTypeAliasDeclarations(functionStubDecl, recursiveDeclCache)) {
                (0, collectionUtils_1.appendArray)(result, this._lookUpSymbolDeclarations(functionDecl.node, stubDecl.node.name.value)
                    .filter((d) => (0, declaration_1.isParameterDeclaration)(d))
                    .map((d) => d));
            }
        }
        return result;
    }
    _findMemberDeclarationsByName(sourceFile, className, memberName, declAdder, recursiveDeclCache) {
        const result = [];
        const classDecls = this._findClassDeclarationsByName(sourceFile, className, recursiveDeclCache);
        for (const classDecl of classDecls.filter((d) => (0, declaration_1.isClassDeclaration)(d)).map((d) => d)) {
            const classResults = this._evaluator.getTypeOfClass(classDecl.node);
            if (!classResults) {
                continue;
            }
            const member = (0, typeUtils_1.lookUpClassMember)(classResults.classType, memberName);
            if (member) {
                for (const decl of member.symbol.getDeclarations()) {
                    declAdder(decl, recursiveDeclCache, result);
                }
            }
        }
        return result;
    }
    _findFieldDeclarationsByName(sourceFile, className, variableName, recursiveDeclCache) {
        let result = [];
        const uniqueId = `@${sourceFile.getUri()}/c/${className}/v/${variableName}`;
        if (recursiveDeclCache.has(uniqueId)) {
            return result;
        }
        recursiveDeclCache.add(uniqueId);
        result = this._findMemberDeclarationsByName(sourceFile, className, variableName, (decl, cache, result) => {
            if ((0, declaration_1.isVariableDeclaration)(decl)) {
                if (this._isStubThatShouldBeMappedToImplementation(decl.uri)) {
                    for (const implDecl of this._findVariableDeclarations(decl, cache)) {
                        if ((0, declaration_1.isVariableDeclaration)(implDecl)) {
                            result.push(implDecl);
                        }
                    }
                }
                else {
                    result.push(decl);
                }
            }
        }, recursiveDeclCache);
        recursiveDeclCache.delete(uniqueId);
        return result;
    }
    _findMethodDeclarationsByName(sourceFile, className, functionName, recursiveDeclCache) {
        let result = [];
        const uniqueId = `@${sourceFile.getUri()}/c/${className}/f/${functionName}`;
        if (recursiveDeclCache.has(uniqueId)) {
            return result;
        }
        recursiveDeclCache.add(uniqueId);
        result = this._findMemberDeclarationsByName(sourceFile, className, functionName, (decl, cache, result) => {
            if ((0, declaration_1.isFunctionDeclaration)(decl)) {
                if (this._isStubThatShouldBeMappedToImplementation(decl.uri)) {
                    (0, collectionUtils_1.appendArray)(result, this._findFunctionOrTypeAliasDeclarations(decl, cache));
                }
                else {
                    result.push(decl);
                }
            }
        }, recursiveDeclCache);
        recursiveDeclCache.delete(uniqueId);
        return result;
    }
    _findVariableDeclarationsByName(sourceFile, variableName, recursiveDeclCache) {
        var _a;
        const result = [];
        const uniqueId = `@${sourceFile.getUri()}/v/${variableName}`;
        if (recursiveDeclCache.has(uniqueId)) {
            return result;
        }
        recursiveDeclCache.add(uniqueId);
        const moduleNode = (_a = sourceFile.getParserOutput()) === null || _a === void 0 ? void 0 : _a.parseTree;
        if (!moduleNode) {
            // Don't bother deleting from the cache; we'll never get any info from this
            // file if it has no tree.
            return result;
        }
        const decls = this._lookUpSymbolDeclarations(moduleNode, variableName);
        if (decls.length === 0) {
            this._addDeclarationsFollowingWildcardImports(moduleNode, variableName, result, recursiveDeclCache);
        }
        else {
            for (const decl of decls) {
                this._addVariableDeclarations(decl, result, recursiveDeclCache);
            }
        }
        recursiveDeclCache.delete(uniqueId);
        return result;
    }
    _findFunctionDeclarationsByName(sourceFile, functionName, recursiveDeclCache) {
        var _a;
        const result = [];
        const uniqueId = `@${sourceFile.getUri()}/f/${functionName}`;
        if (recursiveDeclCache.has(uniqueId)) {
            return result;
        }
        recursiveDeclCache.add(uniqueId);
        const moduleNode = (_a = sourceFile.getParserOutput()) === null || _a === void 0 ? void 0 : _a.parseTree;
        if (!moduleNode) {
            // Don't bother deleting from the cache; we'll never get any info from this
            // file if it has no tree.
            return result;
        }
        const decls = this._lookUpSymbolDeclarations(moduleNode, functionName);
        if (decls.length === 0) {
            this._addDeclarationsFollowingWildcardImports(moduleNode, functionName, result, recursiveDeclCache);
        }
        else {
            for (const decl of decls) {
                this._addClassOrFunctionDeclarations(decl, result, recursiveDeclCache);
            }
        }
        recursiveDeclCache.delete(uniqueId);
        return result;
    }
    _findClassDeclarationsByName(sourceFile, fullClassName, recursiveDeclCache) {
        var _a;
        let classDecls = [];
        // fullClassName is period delimited, for example: 'OuterClass.InnerClass'
        const parentNode = (_a = sourceFile.getParserOutput()) === null || _a === void 0 ? void 0 : _a.parseTree;
        if (parentNode) {
            let classNameParts = fullClassName.split('.');
            if (classNameParts.length > 0) {
                classDecls = this._findClassDeclarations(sourceFile, classNameParts[0], parentNode, recursiveDeclCache);
                classNameParts = classNameParts.slice(1);
            }
            for (const classNamePart of classNameParts) {
                classDecls = classDecls.flatMap((parentDecl) => this._findClassDeclarations(sourceFile, classNamePart, parentDecl.node, recursiveDeclCache));
            }
        }
        return classDecls;
    }
    _findClassDeclarations(sourceFile, className, parentNode, recursiveDeclCache) {
        const result = [];
        const uniqueId = `@${sourceFile.getUri()}[${parentNode.start}]${className}`;
        if (recursiveDeclCache.has(uniqueId)) {
            return result;
        }
        recursiveDeclCache.add(uniqueId);
        const decls = this._lookUpSymbolDeclarations(parentNode, className);
        if (decls.length === 0 && parentNode.nodeType === 36 /* ParseNodeType.Module */) {
            this._addDeclarationsFollowingWildcardImports(parentNode, className, result, recursiveDeclCache);
        }
        else {
            for (const decl of decls) {
                this._addClassOrFunctionDeclarations(decl, result, recursiveDeclCache);
            }
        }
        recursiveDeclCache.delete(uniqueId);
        return result;
    }
    _addVariableDeclarations(decl, result, recursiveDeclCache) {
        if ((0, declaration_1.isVariableDeclaration)(decl)) {
            if (this._isStubThatShouldBeMappedToImplementation(decl.uri)) {
                (0, collectionUtils_1.appendArray)(result, this._findVariableDeclarations(decl, recursiveDeclCache));
            }
            else {
                result.push(decl);
            }
        }
        else if ((0, declaration_1.isAliasDeclaration)(decl)) {
            const resolvedDecl = this._evaluator.resolveAliasDeclaration(decl, /* resolveLocalNames */ true);
            if (resolvedDecl) {
                if ((0, declaration_1.isVariableDeclaration)(resolvedDecl)) {
                    this._addVariableDeclarations(resolvedDecl, result, recursiveDeclCache);
                }
                else if ((0, declaration_1.isClassDeclaration)(resolvedDecl) || (0, declaration_1.isFunctionDeclaration)(resolvedDecl)) {
                    this._addClassOrFunctionDeclarations(resolvedDecl, result, recursiveDeclCache);
                }
            }
        }
    }
    _addClassOrFunctionDeclarations(decl, result, recursiveDeclCache) {
        var _a;
        if ((0, declaration_1.isClassDeclaration)(decl)) {
            if (this._isStubThatShouldBeMappedToImplementation(decl.uri)) {
                (0, collectionUtils_1.appendArray)(result, this._findClassOrTypeAliasDeclarations(decl, recursiveDeclCache));
            }
            else {
                result.push(decl);
            }
        }
        else if ((0, declaration_1.isSpecialBuiltInClassDeclaration)(decl)) {
            result.push(decl);
        }
        else if ((0, declaration_1.isFunctionDeclaration)(decl)) {
            if (this._isStubThatShouldBeMappedToImplementation(decl.uri)) {
                (0, collectionUtils_1.appendArray)(result, this._findFunctionOrTypeAliasDeclarations(decl, recursiveDeclCache));
            }
            else {
                result.push(decl);
            }
        }
        else if ((0, declaration_1.isAliasDeclaration)(decl)) {
            const adjustedDecl = this._handleSpecialBuiltInModule(decl);
            const resolvedDecl = this._evaluator.resolveAliasDeclaration(adjustedDecl, /* resolveLocalNames */ true);
            if (resolvedDecl && !(0, declaration_1.isAliasDeclaration)(resolvedDecl)) {
                this._addClassOrFunctionDeclarations(resolvedDecl, result, recursiveDeclCache);
            }
        }
        else if ((0, declaration_1.isVariableDeclaration)(decl)) {
            // Always add decl. This handles a case where function is dynamically generated such as pandas.read_csv or type alias.
            this._addVariableDeclarations(decl, result, recursiveDeclCache);
            // And try to add the real decl if we can. Sometimes, we can't since import resolver can't follow up the type alias or assignment.
            // Import resolver can't resolve an import that only exists in the lib but not in the stub in certain circumstance.
            const nodeToBind = (_a = decl.typeAliasName) !== null && _a !== void 0 ? _a : decl.node;
            const type = this._evaluator.getType(nodeToBind);
            if (!type) {
                return;
            }
            if ((0, types_1.isFunction)(type) && type.details.declaration) {
                this._addClassOrFunctionDeclarations(type.details.declaration, result, recursiveDeclCache);
            }
            else if ((0, types_1.isOverloadedFunction)(type)) {
                for (const overloadDecl of type.overloads.map((o) => o.details.declaration).filter(core_1.isDefined)) {
                    this._addClassOrFunctionDeclarations(overloadDecl, result, recursiveDeclCache);
                }
            }
            else if ((0, types_1.isInstantiableClass)(type)) {
                this._addClassTypeDeclarations(decl.uri, type, result, recursiveDeclCache);
            }
        }
    }
    _handleSpecialBuiltInModule(decl) {
        // Some stdlib modules import builtin modules that don't actually exist as a file.
        // For example, io.py has an import statement such as from _io import (..., ByteIO)
        // but _io doesn't actually exist on disk so, decl.path will be empty.
        // That means for symbols that belong to _io such as ByteIO, our regular method
        // won't work. to make it work, this method does 2 things, first, it fakes path
        // to _io in stdlib path which doesn't actually exist and call getSourceFiles to
        // generate or extract builtin module info from runtime, the same way we do for builtin.pyi,
        // and second, clone the given decl and set path to the generated pyi for the
        // builtin module (ex, _io) to make resolveAliasDeclaration to work.
        // once the path is set, our regular code path will work as expected.
        if (!decl.uri.isEmpty() || !decl.node) {
            // If module actually exists, nothing we need to do.
            return decl;
        }
        // See if it is one of those special cases.
        if (decl.moduleName !== 'io' && decl.moduleName !== 'collections') {
            return decl;
        }
        const stdLibPath = this._importResolver.getTypeshedStdLibPath(this._execEnv);
        if (!stdLibPath) {
            return decl;
        }
        const fileInfo = ParseTreeUtils.getFileInfoFromNode(decl.node);
        if (!fileInfo) {
            return decl;
        }
        // ImportResolver might be able to generate or extract builtin module's info
        // from runtime if we provide right synthesized stub path.
        const fakeStubPath = stdLibPath.combinePaths(getModuleName()
            .nameParts.map((n) => n.value)
            .join('.') + '.pyi');
        const sources = this._getSourceFiles(fakeStubPath, fileInfo.fileUri);
        if (sources.length === 0) {
            return decl;
        }
        const synthesizedDecl = { ...decl };
        synthesizedDecl.uri = sources[0].getUri();
        return synthesizedDecl;
        function getModuleName() {
            switch (decl.node.nodeType) {
                case 24 /* ParseNodeType.ImportAs */:
                    return decl.node.module;
                case 26 /* ParseNodeType.ImportFromAs */:
                    return decl.node.parent.module;
                case 25 /* ParseNodeType.ImportFrom */:
                    return decl.node.module;
                default:
                    return (0, debug_1.assertNever)(decl.node);
            }
        }
    }
    _addClassTypeDeclarations(originated, type, result, recursiveDeclCache, useTypeAlias = false) {
        const fileUri = useTypeAlias && type.typeAliasInfo ? type.typeAliasInfo.fileUri : type.details.fileUri;
        const sourceFiles = this._getSourceFiles(fileUri, /* stubToShadow */ undefined, originated);
        const fullName = useTypeAlias && type.typeAliasInfo ? type.typeAliasInfo.fullName : type.details.fullName;
        const moduleName = useTypeAlias && type.typeAliasInfo ? type.typeAliasInfo.moduleName : type.details.moduleName;
        const fullClassName = fullName.substring(moduleName.length + 1 /* +1 for trailing dot */);
        for (const sourceFile of sourceFiles) {
            (0, collectionUtils_1.appendArray)(result, this._findClassDeclarationsByName(sourceFile, fullClassName, recursiveDeclCache));
        }
    }
    _getSourceFiles(fileUri, stubToShadow, originated) {
        const sourceFiles = [];
        if (this._isStubThatShouldBeMappedToImplementation(fileUri)) {
            (0, collectionUtils_1.appendArray)(sourceFiles, this._getBoundSourceFilesFromStubFile(fileUri, stubToShadow, originated));
        }
        else {
            const sourceFileInfo = this._boundSourceGetter(fileUri);
            if (sourceFileInfo) {
                sourceFiles.push(sourceFileInfo.sourceFile);
            }
        }
        return sourceFiles;
    }
    _addDeclarationsFollowingWildcardImports(moduleNode, symbolName, result, recursiveDeclCache) {
        var _a, _b;
        // Symbol exists in a stub doesn't exist in a python file. Use some heuristic
        // to find one from sources.
        const table = (_a = AnalyzerNodeInfo.getScope(moduleNode)) === null || _a === void 0 ? void 0 : _a.symbolTable;
        if (!table) {
            return;
        }
        // Dig down imports with wildcard imports.
        for (const symbol of table.values()) {
            for (const decl of symbol.getDeclarations()) {
                if (!(0, declaration_1.isAliasDeclaration)(decl) ||
                    decl.uri.isEmpty() ||
                    decl.node.nodeType !== 25 /* ParseNodeType.ImportFrom */ ||
                    !decl.node.isWildcardImport) {
                    continue;
                }
                const uniqueId = `@${decl.uri.key}/l/${symbolName}`;
                if (recursiveDeclCache.has(uniqueId)) {
                    continue;
                }
                // While traversing these tables, we may encounter the same decl
                // more than once (via different files' wildcard imports). To avoid this,
                // add an ID unique to this function to the recursiveDeclCache to deduplicate
                // them.
                //
                // The ID is not deleted to avoid needing a second Set to track all decls
                // seen in this function. This is safe because the ID here is unique to this
                // function.
                recursiveDeclCache.add(uniqueId);
                const sourceFiles = this._getSourceFiles(decl.uri);
                for (const sourceFile of sourceFiles) {
                    const moduleNode = (_b = sourceFile.getParserOutput()) === null || _b === void 0 ? void 0 : _b.parseTree;
                    if (!moduleNode) {
                        continue;
                    }
                    const decls = this._lookUpSymbolDeclarations(moduleNode, symbolName);
                    if (decls.length === 0) {
                        this._addDeclarationsFollowingWildcardImports(moduleNode, symbolName, result, recursiveDeclCache);
                    }
                    else {
                        for (const decl of decls) {
                            const resolvedDecl = this._evaluator.resolveAliasDeclaration(decl, 
                            /* resolveLocalNames */ true);
                            if (!resolvedDecl) {
                                continue;
                            }
                            if ((0, declaration_1.isFunctionDeclaration)(resolvedDecl) || (0, declaration_1.isClassDeclaration)(resolvedDecl)) {
                                this._addClassOrFunctionDeclarations(resolvedDecl, result, recursiveDeclCache);
                            }
                            else if ((0, declaration_1.isVariableDeclaration)(resolvedDecl)) {
                                this._addVariableDeclarations(resolvedDecl, result, recursiveDeclCache);
                            }
                        }
                    }
                }
            }
        }
    }
    _lookUpSymbolDeclarations(node, symbolName) {
        if (node === undefined) {
            return [];
        }
        const containingScope = AnalyzerNodeInfo.getScope(node);
        const symbol = containingScope === null || containingScope === void 0 ? void 0 : containingScope.lookUpSymbol(symbolName);
        const decls = symbol === null || symbol === void 0 ? void 0 : symbol.getDeclarations();
        return decls !== null && decls !== void 0 ? decls : [];
    }
    _getFullClassName(node) {
        const fullName = [];
        let current = node;
        while (current !== undefined) {
            fullName.push(current.name.value);
            current = ParseTreeUtils.getEnclosingClass(current);
        }
        return fullName.reverse().join('.');
    }
    _getBoundSourceFilesFromStubFile(stubFileUri, stubToShadow, originated) {
        var _a;
        const paths = this._getSourcePathsFromStub(stubFileUri, originated !== null && originated !== void 0 ? originated : (_a = this._fromFile) === null || _a === void 0 ? void 0 : _a.sourceFile.getUri());
        return paths.map((fp) => this._fileBinder(stubToShadow !== null && stubToShadow !== void 0 ? stubToShadow : stubFileUri, fp)).filter(core_1.isDefined);
    }
    _getSourcePathsFromStub(stubFileUri, fromFile) {
        // Attempt our stubFileUri to see if we can resolve it as a source file path
        let results = this._importResolver.getSourceFilesFromStub(stubFileUri, this._execEnv, this._mapCompiled);
        if (results.length > 0) {
            return results;
        }
        // If that didn't work, try looking through the graph up to our fromFile.
        // One of them should be able to resolve to an actual file.
        const stubFileImportTree = this._getStubFileImportTree(stubFileUri, fromFile);
        // Go through the items in this tree until we find at least one path.
        for (let i = 0; i < stubFileImportTree.length; i++) {
            results = this._importResolver.getSourceFilesFromStub(stubFileImportTree[i], this._execEnv, this._mapCompiled);
            if (results.length > 0) {
                return results;
            }
        }
        return [];
    }
    _getStubFileImportTree(stubFileUri, fromFile) {
        if (!fromFile || !this._isStubThatShouldBeMappedToImplementation(stubFileUri)) {
            // No path to search, just return the starting point.
            return [stubFileUri];
        }
        else {
            // Otherwise recurse through the importedBy list up to our 'fromFile'.
            return (0, sourceMapperUtils_1.buildImportTree)(fromFile, stubFileUri, (p) => {
                const boundSourceInfo = this._boundSourceGetter(p);
                return boundSourceInfo ? boundSourceInfo.importedBy.map((info) => info.sourceFile.getUri()) : [];
            }, this._cancelToken).filter((p) => this._isStubThatShouldBeMappedToImplementation(p));
        }
    }
    _isStubThatShouldBeMappedToImplementation(fileUri) {
        if (this._preferStubs) {
            return false;
        }
        const stub = isStubFile(fileUri);
        if (!stub) {
            return false;
        }
        // If we get the same file as a source file, then we treat the file as a regular file even if it has "pyi" extension.
        return this._importResolver
            .getSourceFilesFromStub(fileUri, this._execEnv, this._mapCompiled)
            .every((f) => f !== fileUri);
    }
}
exports.SourceMapper = SourceMapper;
function isStubFile(uri) {
    return uri.lastExtension === '.pyi';
}
exports.isStubFile = isStubFile;
//# sourceMappingURL=sourceMapper.js.map