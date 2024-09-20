"use strict";
/*
 * packageTypeVerifier.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Validates the public symbols exported by a package to ensure
 * that the types are complete.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageTypeVerifier = void 0;
const configOptions_1 = require("../common/configOptions");
const console_1 = require("../common/console");
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const fullAccessHost_1 = require("../common/fullAccessHost");
const pathUtils_1 = require("../common/pathUtils");
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const importResolver_1 = require("./importResolver");
const packageTypeReport_1 = require("./packageTypeReport");
const program_1 = require("./program");
const pyTypedUtils_1 = require("./pyTypedUtils");
const scopeUtils_1 = require("./scopeUtils");
const symbolNameUtils_1 = require("./symbolNameUtils");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
class PackageTypeVerifier {
    constructor(_serviceProvider, _host, commandLineOptions, _packageName, _ignoreExternal = false) {
        this._serviceProvider = _serviceProvider;
        this._host = _host;
        this._packageName = _packageName;
        this._ignoreExternal = _ignoreExternal;
        const host = new fullAccessHost_1.FullAccessHost(_serviceProvider);
        this._configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.empty());
        const console = new console_1.NullConsole();
        // Make sure we have a default python platform and version.
        // Allow the command-line parameters to override the normal defaults.
        if (commandLineOptions.pythonPlatform) {
            this._configOptions.defaultPythonPlatform = commandLineOptions.pythonPlatform;
        }
        else {
            this._configOptions.ensureDefaultPythonPlatform(host, console);
        }
        if (commandLineOptions.pythonVersion) {
            this._configOptions.defaultPythonVersion = commandLineOptions.pythonVersion;
        }
        else {
            this._configOptions.ensureDefaultPythonVersion(host, console);
        }
        if (_ignoreExternal) {
            this._configOptions.evaluateUnknownImportsAsAny = true;
        }
        this._execEnv = this._configOptions.findExecEnvironment(uri_1.Uri.file('.', _serviceProvider));
        this._importResolver = new importResolver_1.ImportResolver(this._serviceProvider, this._configOptions, this._host);
        this._program = new program_1.Program(this._importResolver, this._configOptions, this._serviceProvider);
    }
    verify() {
        var _a, _b, _c;
        const trimmedModuleName = this._packageName.trim();
        const moduleNameParts = trimmedModuleName.split('.');
        const packageDirectoryInfo = this._getDirectoryInfoForModule(moduleNameParts[0]);
        const moduleDirectoryInfo = this._getDirectoryInfoForModule(trimmedModuleName);
        const report = (0, packageTypeReport_1.getEmptyReport)(moduleNameParts[0], (_a = packageDirectoryInfo === null || packageDirectoryInfo === void 0 ? void 0 : packageDirectoryInfo.moduleDirectory) !== null && _a !== void 0 ? _a : uri_1.Uri.empty(), trimmedModuleName, (_b = moduleDirectoryInfo === null || moduleDirectoryInfo === void 0 ? void 0 : moduleDirectoryInfo.moduleDirectory) !== null && _b !== void 0 ? _b : uri_1.Uri.empty(), (_c = moduleDirectoryInfo === null || moduleDirectoryInfo === void 0 ? void 0 : moduleDirectoryInfo.isModuleSingleFile) !== null && _c !== void 0 ? _c : false, this._ignoreExternal);
        const commonDiagnostics = report.generalDiagnostics;
        try {
            if (!trimmedModuleName) {
                commonDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, `Module name "${trimmedModuleName}" is invalid`, (0, textRange_1.getEmptyRange)()));
            }
            else if (!report.moduleRootDirectoryUri) {
                commonDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, `Module "${trimmedModuleName}" cannot be resolved`, (0, textRange_1.getEmptyRange)()));
            }
            else {
                let pyTypedInfo;
                if (report.moduleRootDirectoryUri) {
                    pyTypedInfo = this._getDeepestPyTypedInfo(report.moduleRootDirectoryUri, moduleNameParts);
                }
                // If we couldn't find any "py.typed" info in the module path, search again
                // starting at the package root.
                if (!pyTypedInfo && report.packageRootDirectoryUri) {
                    pyTypedInfo = this._getDeepestPyTypedInfo(report.packageRootDirectoryUri, moduleNameParts);
                }
                if (!pyTypedInfo) {
                    commonDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, 'No py.typed file found', (0, textRange_1.getEmptyRange)()));
                }
                else {
                    report.pyTypedPathUri = pyTypedInfo.pyTypedPath;
                    const publicModules = this._getListOfPublicModules(report.moduleRootDirectoryUri, report.isModuleSingleFile, trimmedModuleName);
                    // If the filter eliminated all modules, report an error.
                    if (publicModules.length === 0) {
                        commonDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, `Module "${trimmedModuleName}" cannot be resolved`, (0, textRange_1.getEmptyRange)()));
                    }
                    // Build a set of all public symbols exported by this package. We'll
                    // use this map to determine which diagnostics to report. We don't want
                    // to report diagnostics many times for types that include public types.
                    const publicSymbols = new Set();
                    publicModules.forEach((moduleName) => {
                        this._getPublicSymbolsForModule(moduleName, publicSymbols, report.alternateSymbolNames);
                    });
                    publicModules.forEach((moduleName) => {
                        this._verifyTypesOfModule(moduleName, publicSymbols, report);
                    });
                }
            }
        }
        catch (e) {
            const message = (e.stack ? e.stack.toString() : undefined) ||
                (typeof e.message === 'string' ? e.message : undefined) ||
                JSON.stringify(e);
            commonDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, `An internal error occurred while verifying types: "${message}"`, (0, textRange_1.getEmptyRange)()));
        }
        return report;
    }
    static getSymbolCategoryString(symbolType) {
        switch (symbolType) {
            case packageTypeReport_1.SymbolCategory.Class:
                return 'class';
            case packageTypeReport_1.SymbolCategory.Function:
                return 'function';
            case packageTypeReport_1.SymbolCategory.Method:
                return 'method';
            case packageTypeReport_1.SymbolCategory.Constant:
                return 'constant';
            case packageTypeReport_1.SymbolCategory.Variable:
                return 'variable';
            case packageTypeReport_1.SymbolCategory.Module:
                return 'module';
            case packageTypeReport_1.SymbolCategory.TypeAlias:
                return 'type alias';
            case packageTypeReport_1.SymbolCategory.TypeVar:
                return 'type variable';
            case packageTypeReport_1.SymbolCategory.Indeterminate:
                return 'symbol';
        }
    }
    _getDeepestPyTypedInfo(rootDirectory, packageNameParts) {
        let subNameParts = Array.from(packageNameParts);
        // Find the deepest py.typed file that corresponds to the requested submodule.
        while (subNameParts.length >= 1) {
            const packageSubdir = rootDirectory.combinePaths(...subNameParts.slice(1));
            const pyTypedInfo = (0, pyTypedUtils_1.getPyTypedInfo)(this._serviceProvider.fs(), packageSubdir);
            if (pyTypedInfo) {
                return pyTypedInfo;
            }
            subNameParts = subNameParts.slice(0, subNameParts.length - 1);
        }
        return undefined;
    }
    _resolveImport(moduleName) {
        return this._importResolver.resolveImport(uri_1.Uri.empty(), this._execEnv, (0, importResolver_1.createImportedModuleDescriptor)(moduleName));
    }
    _getPublicSymbolsForModule(moduleName, publicSymbols, alternateSymbolNames) {
        const importResult = this._resolveImport(moduleName);
        if (importResult.isImportFound) {
            const modulePath = importResult.resolvedUris[importResult.resolvedUris.length - 1];
            this._program.addTrackedFiles([modulePath], /* isThirdPartyImport */ true, /* isInPyTypedPackage */ true);
            const sourceFile = this._program.getBoundSourceFile(modulePath);
            if (sourceFile) {
                const module = {
                    name: moduleName,
                    uri: modulePath,
                    isExported: true,
                };
                const parseTree = sourceFile.getParserOutput().parseTree;
                const moduleScope = (0, scopeUtils_1.getScopeForNode)(parseTree);
                this._getPublicSymbolsInSymbolTable(publicSymbols, alternateSymbolNames, module, module.name, moduleScope.symbolTable, 4 /* ScopeType.Module */);
            }
        }
    }
    _getPublicSymbolsInSymbolTable(publicSymbols, alternateSymbolNames, module, scopeName, symbolTable, scopeType) {
        symbolTable.forEach((symbol, name) => {
            if (!(0, symbolNameUtils_1.isPrivateOrProtectedName)(name) &&
                !symbol.isIgnoredForProtocolMatch() &&
                !this._isSymbolTypeImplied(scopeType, name)) {
                const fullName = `${scopeName}.${name}`;
                if (!symbol.isExternallyHidden() && !symbol.isPrivateMember() && !symbol.isPrivatePyTypedImport()) {
                    const symbolType = this._program.getTypeOfSymbol(symbol);
                    publicSymbols.add(fullName);
                    const typedDecls = symbol.getTypedDeclarations();
                    if (typedDecls.length > 0) {
                        // Is this a class declared within this module or class?
                        // If so, add the symbols declared within it.
                        const classDecl = typedDecls.find((decl) => decl.type === 6 /* DeclarationType.Class */);
                        if (classDecl) {
                            if ((0, types_1.isInstantiableClass)(symbolType)) {
                                this._getPublicSymbolsInSymbolTable(publicSymbols, alternateSymbolNames, module, fullName, types_1.ClassType.getSymbolTable(symbolType), 3 /* ScopeType.Class */);
                            }
                        }
                    }
                    // Is this the re-export of an import? If so, record the alternate name.
                    const importDecl = symbol.getDeclarations().find((decl) => decl.type === 8 /* DeclarationType.Alias */);
                    if (importDecl && importDecl.type === 8 /* DeclarationType.Alias */) {
                        const typeName = (0, typeUtils_1.getFullNameOfType)(this._program.getTypeOfSymbol(symbol));
                        if (typeName) {
                            this._addAlternateSymbolName(alternateSymbolNames, typeName, fullName);
                        }
                    }
                }
            }
        });
    }
    _addAlternateSymbolName(map, name, altName) {
        if (name !== altName) {
            let altNameList = map.get(name);
            if (!altNameList) {
                altNameList = [];
                map.set(name, altNameList);
            }
            // Add the alternate name if it's unique.
            if (!altNameList.some((name) => name === altName)) {
                altNameList.push(altName);
            }
        }
    }
    _verifyTypesOfModule(moduleName, publicSymbols, report) {
        const importResult = this._resolveImport(moduleName);
        if (!importResult.isImportFound) {
            report.generalDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, `Could not resolve module "${moduleName}"`, (0, textRange_1.getEmptyRange)()));
        }
        else if (importResult.isStubPackage) {
            report.generalDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, `No inlined types found for module "${moduleName}" because stub package was present`, (0, textRange_1.getEmptyRange)()));
        }
        else {
            const modulePath = importResult.resolvedUris[importResult.resolvedUris.length - 1];
            const module = {
                name: moduleName,
                uri: modulePath,
                isExported: true,
            };
            report.modules.set(modulePath.key, module);
            this._program.addTrackedFiles([modulePath], /* isThirdPartyImport */ true, /* isInPyTypedPackage */ true);
            const sourceFile = this._program.getBoundSourceFile(modulePath);
            if (sourceFile) {
                const parseTree = sourceFile.getParserOutput().parseTree;
                const moduleScope = (0, scopeUtils_1.getScopeForNode)(parseTree);
                this._getTypeKnownStatusForSymbolTable(report, module.name, moduleScope.symbolTable, 4 /* ScopeType.Module */, publicSymbols);
            }
            else {
                report.generalDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, `Could not bind file "${modulePath}"`, (0, textRange_1.getEmptyRange)()));
            }
        }
    }
    // Scans the directory structure for a list of public modules
    // within the package.
    _getListOfPublicModules(moduleRoot, isModuleSingleFile, moduleName) {
        const publicModules = [];
        this._addPublicModulesRecursive(moduleRoot, isModuleSingleFile, moduleName, publicModules);
        // Make sure modules are unique. There may be duplicates if a ".py" and ".pyi"
        // exist for some modules.
        const uniqueModules = [];
        const moduleMap = new Map();
        publicModules.forEach((module) => {
            if (!moduleMap.has(module)) {
                uniqueModules.push(module);
                moduleMap.set(module, module);
            }
        });
        return uniqueModules;
    }
    _addPublicModulesRecursive(dirPath, isModuleSingleFile, modulePath, publicModules) {
        const dirEntries = this._serviceProvider.fs().readdirEntriesSync(dirPath);
        dirEntries.forEach((entry) => {
            let isFile = entry.isFile();
            let isDirectory = entry.isDirectory();
            if (entry.isSymbolicLink()) {
                const stat = (0, uriUtils_1.tryStat)(this._serviceProvider.fs(), dirPath.combinePaths(entry.name));
                if (stat) {
                    isFile = stat.isFile();
                    isDirectory = stat.isDirectory();
                }
            }
            if (isFile) {
                const fileExtension = (0, pathUtils_1.getFileExtension)(entry.name);
                if (fileExtension === '.py' || fileExtension === '.pyi') {
                    const nameWithoutExtension = (0, pathUtils_1.stripFileExtension)(entry.name);
                    if (nameWithoutExtension === '__init__') {
                        publicModules.push(modulePath);
                    }
                    else {
                        if (!(0, symbolNameUtils_1.isPrivateOrProtectedName)(nameWithoutExtension) &&
                            this._isLegalModulePartName(nameWithoutExtension)) {
                            if (isModuleSingleFile) {
                                if (modulePath.endsWith(`.${nameWithoutExtension}`)) {
                                    publicModules.push(modulePath);
                                }
                            }
                            else {
                                publicModules.push(`${modulePath}.${nameWithoutExtension}`);
                            }
                        }
                    }
                }
            }
            else if (isDirectory) {
                if (!(0, symbolNameUtils_1.isPrivateOrProtectedName)(entry.name) && this._isLegalModulePartName(entry.name)) {
                    this._addPublicModulesRecursive(dirPath.combinePaths(entry.name), isModuleSingleFile, `${modulePath}.${entry.name}`, publicModules);
                }
            }
        });
    }
    _isLegalModulePartName(name) {
        // PEP8 indicates that all module names should be lowercase
        // with underscores. It doesn't talk about non-ASCII
        // characters, but it appears that's the convention.
        return !!name.match(/[a-z_]+/);
    }
    _shouldIgnoreType(report, fullTypeName) {
        // If we're ignoring unknown types from other packages, see if we should skip.
        return report.ignoreExternal && !fullTypeName.startsWith(report.packageName);
    }
    _getTypeKnownStatusForSymbolTable(report, scopeName, symbolTable, scopeType, publicSymbols, overrideSymbolCallback) {
        if (this._shouldIgnoreType(report, scopeName)) {
            return 0 /* TypeKnownStatus.Known */;
        }
        let knownStatus = 0 /* TypeKnownStatus.Known */;
        symbolTable.forEach((symbol, name) => {
            var _a, _b;
            if (!(0, symbolNameUtils_1.isPrivateOrProtectedName)(name) &&
                !symbol.isExternallyHidden() &&
                !symbol.isPrivateMember() &&
                !symbol.isPrivatePyTypedImport() &&
                !symbol.isIgnoredForProtocolMatch() &&
                !this._isSymbolTypeImplied(scopeType, name)) {
                const fullName = `${scopeName}.${name}`;
                // If the symbol was already cached, update its reference count
                // and skip the rest.
                const cachedSymbolInfo = report.symbols.get(fullName);
                if (cachedSymbolInfo) {
                    cachedSymbolInfo.referenceCount++;
                    return;
                }
                let symbolType = this._program.getTypeOfSymbol(symbol);
                let usesAmbiguousOverride = false;
                let baseSymbolType;
                let childSymbolType;
                if (overrideSymbolCallback) {
                    const baseTypeSymbol = overrideSymbolCallback(name, symbol);
                    if (baseTypeSymbol !== symbol) {
                        childSymbolType = symbolType;
                        baseSymbolType = this._program.getTypeOfSymbol(baseTypeSymbol);
                        // If the inferred type is ambiguous or the declared base class type is
                        // not the same type as the inferred type, mark it as ambiguous because
                        // different type checkers will get different results.
                        if (types_1.TypeBase.isAmbiguous(childSymbolType) || !(0, types_1.isTypeSame)(baseSymbolType, childSymbolType)) {
                            // If the base type is known to be a descriptor with a setter,
                            // assume that the child class is simply writing to the base class's setter.
                            if (!(0, typeUtils_1.isDescriptorInstance)(baseSymbolType, /* requireSetter */ true)) {
                                usesAmbiguousOverride = true;
                            }
                        }
                        symbolType = baseSymbolType;
                    }
                }
                const typedDecls = symbol.getTypedDeclarations();
                const primaryDecl = typedDecls.length > 0 ? typedDecls[typedDecls.length - 1] : undefined;
                let symbolInfo;
                if ((primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.type) === 6 /* DeclarationType.Class */ && (0, types_1.isInstantiableClass)(symbolType)) {
                    symbolInfo = this._getSymbolForClass(report, symbolType, publicSymbols);
                }
                else if ((primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.type) === 8 /* DeclarationType.Alias */ && (0, types_1.isModule)(symbolType)) {
                    symbolInfo = this._getSymbolForModule(report, symbolType, publicSymbols);
                }
                else {
                    const decls = symbol.getDeclarations();
                    const primaryDecl = decls.length > 0 ? decls[decls.length - 1] : undefined;
                    const declRange = (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.range) || (0, textRange_1.getEmptyRange)();
                    const declPath = (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.uri) || uri_1.Uri.empty();
                    const symbolCategory = this._getSymbolCategory(symbol, symbolType);
                    const isExported = publicSymbols.has(fullName);
                    // If the only reference to this symbol is a "__slots__" entry, we will
                    // skip it when considering type completeness.
                    if (decls.length === 1 &&
                        (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.type) === 1 /* DeclarationType.Variable */ &&
                        primaryDecl.isDefinedBySlots) {
                        return;
                    }
                    symbolInfo = {
                        category: symbolCategory,
                        name,
                        fullName,
                        fileUri: declPath,
                        isExported,
                        typeKnownStatus: 0 /* TypeKnownStatus.Known */,
                        referenceCount: 1,
                        diagnostics: [],
                        scopeType,
                    };
                    this._addSymbol(report, symbolInfo);
                    if (primaryDecl) {
                        let resolvedDecl = primaryDecl;
                        if (resolvedDecl.type === 8 /* DeclarationType.Alias */) {
                            resolvedDecl =
                                (_b = (_a = this._program.evaluator) === null || _a === void 0 ? void 0 : _a.resolveAliasDeclaration(resolvedDecl, 
                                /* resolveLocalNames */ true)) !== null && _b !== void 0 ? _b : resolvedDecl;
                        }
                        if (resolvedDecl.type === 6 /* DeclarationType.Class */ && (0, types_1.isClass)(symbolType)) {
                            this._reportMissingClassDocstring(symbolInfo, symbolType, report);
                        }
                        if (resolvedDecl.type === 5 /* DeclarationType.Function */ && (0, types_1.isFunction)(symbolType)) {
                            this._reportMissingFunctionDocstring(symbolInfo, symbolType, declRange, declPath, report);
                        }
                    }
                    if (!this._isSymbolTypeImplied(scopeType, name)) {
                        this._getSymbolTypeKnownStatus(report, symbolInfo, symbolType, declRange, declPath, publicSymbols);
                    }
                }
                if (usesAmbiguousOverride) {
                    const decls = symbol.getDeclarations();
                    const primaryDecl = decls.length > 0 ? decls[decls.length - 1] : undefined;
                    const declRange = (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.range) || (0, textRange_1.getEmptyRange)();
                    const declPath = (primaryDecl === null || primaryDecl === void 0 ? void 0 : primaryDecl.uri) || uri_1.Uri.empty();
                    const extraInfo = new diagnostic_1.DiagnosticAddendum();
                    if (baseSymbolType) {
                        extraInfo.addMessage(`Type declared in base class is "${this._program.printType(baseSymbolType)}"`);
                    }
                    if (childSymbolType) {
                        extraInfo.addMessage(`Type inferred in child class is "${this._program.printType(childSymbolType)}"`);
                        if (types_1.TypeBase.isAmbiguous(childSymbolType)) {
                            extraInfo.addMessage('Inferred child class type is missing type annotation and could be inferred differently by type checkers');
                        }
                    }
                    this._addSymbolError(symbolInfo, `Ambiguous base class override` + extraInfo.getString(), declRange, declPath);
                    symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, 1 /* TypeKnownStatus.Ambiguous */);
                }
                knownStatus = this._updateKnownStatusIfWorse(knownStatus, symbolInfo.typeKnownStatus);
            }
        });
        return knownStatus;
    }
    _reportMissingClassDocstring(symbolInfo, type, report) {
        if (type.details.docString) {
            return;
        }
        this._addSymbolWarning(symbolInfo, `No docstring found for class "${symbolInfo.fullName}"`, (0, textRange_1.getEmptyRange)(), uri_1.Uri.empty());
        report.missingClassDocStringCount++;
    }
    _reportMissingFunctionDocstring(symbolInfo, type, declRange, declFileUri, report) {
        if (type.details.parameters.find((param) => param.defaultType && (0, typeUtils_1.isEllipsisType)(param.defaultType))) {
            if (symbolInfo) {
                this._addSymbolWarning(symbolInfo, `One or more default values in function "${symbolInfo.fullName}" is specified as "..."`, declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
            }
            report.missingDefaultParamCount++;
        }
        if (type.details.docString) {
            return;
        }
        // Don't require docstrings for dunder methods.
        if (symbolInfo && (0, symbolNameUtils_1.isDunderName)(symbolInfo.name)) {
            return;
        }
        // Don't require docstrings for overloads.
        if (types_1.FunctionType.isOverloaded(type)) {
            return;
        }
        if (symbolInfo) {
            this._addSymbolWarning(symbolInfo, `No docstring found for function "${symbolInfo.fullName}"`, declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
        }
        report.missingFunctionDocStringCount++;
    }
    // Determines whether the type for the symbol in question is fully known.
    // If not, it adds diagnostics to the symbol information and updates the
    // typeKnownStatus field.
    _getSymbolTypeKnownStatus(report, symbolInfo, type, declRange, declFileUri, publicSymbols) {
        let knownStatus = 0 /* TypeKnownStatus.Known */;
        if (type.typeAliasInfo && type.typeAliasInfo.typeArguments) {
            type.typeAliasInfo.typeArguments.forEach((typeArg, index) => {
                if ((0, types_1.isUnknown)(typeArg)) {
                    this._addSymbolError(symbolInfo, `Type argument ${index + 1} for type alias "${type.typeAliasInfo.name}" has unknown type`, declRange, declFileUri);
                    knownStatus = 3 /* TypeKnownStatus.Unknown */;
                }
                else if ((0, typeUtils_1.isPartlyUnknown)(typeArg)) {
                    this._addSymbolError(symbolInfo, `Type argument ${index + 1} for type alias "${type.typeAliasInfo.name}" has partially unknown type`, declRange, declFileUri);
                    knownStatus = 2 /* TypeKnownStatus.PartiallyUnknown */;
                }
            });
        }
        if (types_1.TypeBase.isAmbiguous(type) && !(0, types_1.isUnknown)(type)) {
            const ambiguousDiag = new diagnostic_1.DiagnosticAddendum();
            ambiguousDiag.addMessage(`Inferred type is "${this._program.printType(type)}"`);
            this._addSymbolError(symbolInfo, 'Type is missing type annotation and could be inferred differently by type checkers' +
                ambiguousDiag.getString(), declRange, declFileUri);
            knownStatus = this._updateKnownStatusIfWorse(knownStatus, 1 /* TypeKnownStatus.Ambiguous */);
        }
        switch (type.category) {
            case 0 /* TypeCategory.Unbound */:
            case 2 /* TypeCategory.Any */:
            case 3 /* TypeCategory.Never */:
            case 9 /* TypeCategory.TypeVar */:
                break;
            case 1 /* TypeCategory.Unknown */: {
                this._addSymbolError(symbolInfo, `Type unknown for ${PackageTypeVerifier.getSymbolCategoryString(symbolInfo.category)} "${symbolInfo.fullName}"`, declRange, declFileUri);
                knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
                break;
            }
            case 8 /* TypeCategory.Union */: {
                (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, this._getSymbolTypeKnownStatus(report, symbolInfo, subtype, declRange, declFileUri, publicSymbols));
                });
                break;
            }
            case 5 /* TypeCategory.OverloadedFunction */: {
                for (const overload of type.overloads) {
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, this._getSymbolTypeKnownStatus(report, symbolInfo, overload, declRange, declFileUri, publicSymbols));
                }
                break;
            }
            case 4 /* TypeCategory.Function */: {
                if (!this._shouldIgnoreType(report, type.details.fullName)) {
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, this._getFunctionTypeKnownStatus(report, type, publicSymbols, symbolInfo, declRange, declFileUri, undefined /* diag */));
                }
                break;
            }
            case 6 /* TypeCategory.Class */: {
                // Properties require special handling.
                if (types_1.TypeBase.isInstance(type) && types_1.ClassType.isPropertyClass(type)) {
                    const propMethodInfo = [
                        ['fget', (c) => { var _a; return (_a = c.fgetInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
                        ['fset', (c) => { var _a; return (_a = c.fsetInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
                        ['fdel', (c) => { var _a; return (_a = c.fdelInfo) === null || _a === void 0 ? void 0 : _a.methodType; }],
                    ];
                    const propertyClass = type;
                    propMethodInfo.forEach((info) => {
                        const methodAccessor = info[1];
                        let accessType = methodAccessor(propertyClass);
                        if (!accessType) {
                            return;
                        }
                        if ((0, types_1.isFunction)(accessType)) {
                            // The processing for fget, fset and fdel mark the methods as "static" so they
                            // work properly when accessed directly from the property object. We need
                            // to remove this flag here so the method is seen as an instance method rather than
                            // static. Otherwise we'll incorrectly report that "self" is not annotated.
                            accessType = types_1.FunctionType.cloneWithNewFlags(accessType, accessType.details.flags & ~4 /* FunctionTypeFlags.StaticMethod */);
                        }
                        knownStatus = this._updateKnownStatusIfWorse(knownStatus, this._getSymbolTypeKnownStatus(report, symbolInfo, accessType, (0, textRange_1.getEmptyRange)(), uri_1.Uri.empty(), publicSymbols));
                    });
                    break;
                }
                if (!this._shouldIgnoreType(report, type.details.fullName)) {
                    // Don't bother type-checking built-in types.
                    if (!types_1.ClassType.isBuiltIn(type)) {
                        const symbolInfo = this._getSymbolForClass(report, type, publicSymbols);
                        knownStatus = this._updateKnownStatusIfWorse(knownStatus, symbolInfo.typeKnownStatus);
                    }
                }
                // Analyze type arguments if present to make sure they are known.
                if (type.typeArguments) {
                    type.typeArguments.forEach((typeArg, index) => {
                        if ((0, types_1.isUnknown)(typeArg)) {
                            this._addSymbolError(symbolInfo, `Type argument ${index + 1} for class "${type.details.name}" has unknown type`, declRange, declFileUri);
                            knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
                        }
                        else if ((0, typeUtils_1.isPartlyUnknown)(typeArg)) {
                            const diag = new diagnostic_1.DiagnosticAddendum();
                            diag.addMessage(`Type is ${this._program.printType(typeArg)}`);
                            this._addSymbolError(symbolInfo, `Type argument ${index + 1} for class "${type.details.name}" has partially unknown type` + diag.getString(), declRange, declFileUri);
                            knownStatus = this._updateKnownStatusIfWorse(knownStatus, 2 /* TypeKnownStatus.PartiallyUnknown */);
                        }
                    });
                }
                break;
            }
            case 7 /* TypeCategory.Module */: {
                if (!this._shouldIgnoreType(report, type.moduleName)) {
                    const moduleSymbol = this._getSymbolForModule(report, type, publicSymbols);
                    if (moduleSymbol.typeKnownStatus !== 0 /* TypeKnownStatus.Known */) {
                        this._addSymbolError(symbolInfo, `Module "${moduleSymbol.fullName}" is partially unknown`, declRange, declFileUri);
                        knownStatus = this._updateKnownStatusIfWorse(knownStatus, moduleSymbol.typeKnownStatus);
                    }
                }
                break;
            }
        }
        // Downgrade the symbol's type known status info.
        symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, knownStatus);
        return knownStatus;
    }
    _getFunctionTypeKnownStatus(report, type, publicSymbols, symbolInfo, declRange, declFileUri, diag) {
        let knownStatus = 0 /* TypeKnownStatus.Known */;
        // If the file path wasn't provided, try to get it from the type.
        if (type.details.declaration && !declFileUri) {
            declFileUri = type.details.declaration.uri;
        }
        type.details.parameters.forEach((param, index) => {
            // Skip nameless parameters like "*" and "/".
            if (param.name) {
                if (!param.hasDeclaredType) {
                    // Allow params (like "self" and "cls") to skip declarations because
                    // we're able to synthesize these.
                    const isSynthesized = index === 0 &&
                        (symbolInfo === null || symbolInfo === void 0 ? void 0 : symbolInfo.scopeType) === 3 /* ScopeType.Class */ &&
                        (types_1.FunctionType.isClassMethod(type) ||
                            types_1.FunctionType.isInstanceMethod(type) ||
                            types_1.FunctionType.isConstructorMethod(type));
                    if (!isSynthesized) {
                        if (symbolInfo) {
                            this._addSymbolError(symbolInfo, `Type annotation for parameter "${param.name}" is missing`, declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
                        }
                        diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(`Type annotation for parameter "${param.name}" is missing`);
                        knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
                    }
                }
                else if ((0, types_1.isUnknown)(param.type)) {
                    if (symbolInfo) {
                        this._addSymbolError(symbolInfo, `Type of parameter "${param.name}" is unknown`, declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
                        diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(`Type of parameter "${param.name}" is unknown`);
                    }
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
                }
                else {
                    const extraInfo = new diagnostic_1.DiagnosticAddendum();
                    const paramKnownStatus = this._getTypeKnownStatus(report, param.type, publicSymbols, extraInfo.createAddendum());
                    if (paramKnownStatus !== 0 /* TypeKnownStatus.Known */) {
                        extraInfo.addMessage(`Parameter type is "${this._program.printType(param.type)}"`);
                        if (symbolInfo) {
                            this._addSymbolError(symbolInfo, `Type of parameter "${param.name}" is partially unknown` + extraInfo.getString(), declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
                        }
                        if (diag) {
                            const subDiag = diag.createAddendum();
                            subDiag.addMessage(`Type of parameter "${param.name}" is partially unknown`);
                            subDiag.addAddendum(extraInfo);
                        }
                        knownStatus = this._updateKnownStatusIfWorse(knownStatus, paramKnownStatus);
                    }
                }
            }
        });
        if (type.details.declaredReturnType) {
            if ((0, types_1.isUnknown)(type.details.declaredReturnType)) {
                if (symbolInfo) {
                    this._addSymbolError(symbolInfo, `Return type is unknown`, declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
                }
                knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
            }
            else {
                const extraInfo = new diagnostic_1.DiagnosticAddendum();
                const returnTypeKnownStatus = this._getTypeKnownStatus(report, type.details.declaredReturnType, publicSymbols, extraInfo.createAddendum());
                if (returnTypeKnownStatus !== 0 /* TypeKnownStatus.Known */) {
                    extraInfo.addMessage(`Return type is "${this._program.printType(type.details.declaredReturnType)}"`);
                    if (symbolInfo) {
                        this._addSymbolError(symbolInfo, `Return type is partially unknown` + extraInfo.getString(), declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
                    }
                    if (diag) {
                        const subDiag = diag.createAddendum();
                        subDiag.addMessage(`Return type is partially unknown`);
                        subDiag.addAddendum(extraInfo);
                    }
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, returnTypeKnownStatus);
                }
            }
        }
        else {
            // Init methods have an implied return type.
            if (type.details.name !== '__init__') {
                if (symbolInfo) {
                    this._addSymbolError(symbolInfo, `Return type annotation is missing`, declRange !== null && declRange !== void 0 ? declRange : (0, textRange_1.getEmptyRange)(), declFileUri !== null && declFileUri !== void 0 ? declFileUri : uri_1.Uri.empty());
                }
                diag === null || diag === void 0 ? void 0 : diag.createAddendum().addMessage(`Return type annotation is missing`);
                knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
            }
        }
        if (symbolInfo) {
            symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, knownStatus);
        }
        return knownStatus;
    }
    _getSymbolForClass(report, type, publicSymbols) {
        // See if this type is already analyzed.
        const cachedType = report.symbols.get(type.details.fullName);
        if (cachedType) {
            cachedType.referenceCount++;
            return cachedType;
        }
        const symbolInfo = {
            category: packageTypeReport_1.SymbolCategory.Class,
            name: type.details.name,
            fullName: type.details.fullName,
            fileUri: type.details.fileUri,
            isExported: publicSymbols.has(type.details.fullName),
            typeKnownStatus: 0 /* TypeKnownStatus.Known */,
            referenceCount: 1,
            diagnostics: [],
            scopeType: 3 /* ScopeType.Class */,
        };
        this._addSymbol(report, symbolInfo);
        // Determine whether the class has a proper doc string.
        this._reportMissingClassDocstring(symbolInfo, type, report);
        const symbolTableTypeKnownStatus = this._getTypeKnownStatusForSymbolTable(report, type.details.fullName, types_1.ClassType.getSymbolTable(type), 3 /* ScopeType.Class */, publicSymbols, (name, symbol) => {
            // If the symbol within this class is lacking a type declaration,
            // see if we can find a same-named symbol in a parent class with
            // a type declaration.
            if (!symbol.hasTypedDeclarations()) {
                for (const mroClass of type.details.mro.slice(1)) {
                    if ((0, types_1.isClass)(mroClass)) {
                        const overrideSymbol = types_1.ClassType.getSymbolTable(mroClass).get(name);
                        if (overrideSymbol && overrideSymbol.hasTypedDeclarations()) {
                            return overrideSymbol;
                        }
                    }
                }
            }
            return symbol;
        });
        symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, symbolTableTypeKnownStatus);
        // Add information for the metaclass.
        if (type.details.effectiveMetaclass) {
            if (!(0, types_1.isInstantiableClass)(type.details.effectiveMetaclass)) {
                this._addSymbolError(symbolInfo, `Type of metaclass unknown`, (0, textRange_1.getEmptyRange)(), uri_1.Uri.empty());
                symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, 2 /* TypeKnownStatus.PartiallyUnknown */);
            }
            else {
                const diag = new diagnostic_1.DiagnosticAddendum();
                const metaclassKnownStatus = this._getTypeKnownStatus(report, type.details.effectiveMetaclass, publicSymbols, diag);
                if (metaclassKnownStatus !== 0 /* TypeKnownStatus.Known */) {
                    this._addSymbolError(symbolInfo, `Type of metaclass "${type.details.effectiveMetaclass}" is partially unknown` +
                        diag.getString(), (0, textRange_1.getEmptyRange)(), uri_1.Uri.empty());
                    symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, metaclassKnownStatus);
                }
            }
        }
        // Add information for base classes.
        type.details.baseClasses.forEach((baseClass) => {
            if (!(0, types_1.isInstantiableClass)(baseClass)) {
                this._addSymbolError(symbolInfo, `Type of base class unknown`, (0, textRange_1.getEmptyRange)(), uri_1.Uri.empty());
                symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, 2 /* TypeKnownStatus.PartiallyUnknown */);
            }
            else {
                // Handle "tuple" specially. Even though it's a generic class, it
                // doesn't require a type argument.
                if (types_1.ClassType.isBuiltIn(baseClass, 'tuple')) {
                    return;
                }
                const diag = new diagnostic_1.DiagnosticAddendum();
                const baseClassTypeStatus = this._getTypeKnownStatus(report, baseClass, publicSymbols, diag);
                if (baseClassTypeStatus !== 0 /* TypeKnownStatus.Known */) {
                    this._addSymbolError(symbolInfo, `Type of base class "${baseClass.details.fullName}" is partially unknown` + diag.getString(), (0, textRange_1.getEmptyRange)(), uri_1.Uri.empty());
                    symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, baseClassTypeStatus);
                }
            }
        });
        return symbolInfo;
    }
    _getSymbolForModule(report, type, publicSymbols) {
        // See if this type is already analyzed.
        const cachedType = report.symbols.get(type.moduleName);
        if (cachedType) {
            cachedType.referenceCount++;
            return cachedType;
        }
        const symbolInfo = {
            category: packageTypeReport_1.SymbolCategory.Module,
            name: type.moduleName,
            fullName: type.moduleName,
            fileUri: type.fileUri,
            isExported: publicSymbols.has(type.moduleName),
            typeKnownStatus: 0 /* TypeKnownStatus.Known */,
            referenceCount: 1,
            diagnostics: [],
            scopeType: 4 /* ScopeType.Module */,
        };
        // Add the symbol for the module if the name isn't relative.
        if (!type.moduleName.startsWith('.')) {
            this._addSymbol(report, symbolInfo);
        }
        const symbolTableTypeKnownStatus = this._getTypeKnownStatusForSymbolTable(report, type.moduleName, type.fields, 4 /* ScopeType.Module */, publicSymbols);
        symbolInfo.typeKnownStatus = this._updateKnownStatusIfWorse(symbolInfo.typeKnownStatus, symbolTableTypeKnownStatus);
        return symbolInfo;
    }
    _getTypeKnownStatus(report, type, publicSymbols, diag) {
        let knownStatus = 0 /* TypeKnownStatus.Known */;
        if (type.typeAliasInfo && type.typeAliasInfo.typeArguments) {
            type.typeAliasInfo.typeArguments.forEach((typeArg, index) => {
                if ((0, types_1.isUnknown)(typeArg)) {
                    diag.addMessage(`Type argument ${index + 1} for type alias "${type.typeAliasInfo.name}" has unknown type`);
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
                }
                else if ((0, typeUtils_1.isPartlyUnknown)(typeArg)) {
                    diag.addMessage(`Type argument ${index + 1} for type alias "${type.typeAliasInfo.name}" has partially unknown type`);
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, 2 /* TypeKnownStatus.PartiallyUnknown */);
                }
            });
        }
        if (types_1.TypeBase.isAmbiguous(type)) {
            knownStatus = this._updateKnownStatusIfWorse(knownStatus, 1 /* TypeKnownStatus.Ambiguous */);
        }
        switch (type.category) {
            case 0 /* TypeCategory.Unbound */:
            case 2 /* TypeCategory.Any */:
            case 3 /* TypeCategory.Never */:
            case 9 /* TypeCategory.TypeVar */:
                break;
            case 1 /* TypeCategory.Unknown */: {
                knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
                break;
            }
            case 8 /* TypeCategory.Union */: {
                (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, this._getTypeKnownStatus(report, subtype, publicSymbols, diag.createAddendum()));
                });
                break;
            }
            case 5 /* TypeCategory.OverloadedFunction */: {
                for (const overload of type.overloads) {
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, this._getTypeKnownStatus(report, overload, publicSymbols, diag.createAddendum()));
                }
                break;
            }
            case 4 /* TypeCategory.Function */: {
                if (!this._shouldIgnoreType(report, type.details.fullName)) {
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, this._getFunctionTypeKnownStatus(report, type, publicSymbols, 
                    /* symbolInfo */ undefined, 
                    /* declRange */ undefined, 
                    /* declFilePath */ undefined, diag));
                }
                break;
            }
            case 6 /* TypeCategory.Class */: {
                if (!this._shouldIgnoreType(report, type.details.fullName)) {
                    // Don't bother type-checking built-in types.
                    if (!types_1.ClassType.isBuiltIn(type)) {
                        const symbolInfo = this._getSymbolForClass(report, type, publicSymbols);
                        knownStatus = this._updateKnownStatusIfWorse(knownStatus, symbolInfo.typeKnownStatus);
                    }
                }
                // Analyze type arguments if present to make sure they are known.
                if (type.typeArguments) {
                    type.typeArguments.forEach((typeArg, index) => {
                        if ((0, types_1.isUnknown)(typeArg)) {
                            diag.addMessage(`Type argument ${index + 1} for class "${type.details.name}" has unknown type`);
                            knownStatus = this._updateKnownStatusIfWorse(knownStatus, 3 /* TypeKnownStatus.Unknown */);
                        }
                        else if ((0, typeUtils_1.isPartlyUnknown)(typeArg)) {
                            diag.addMessage(`Type argument ${index + 1} for class "${type.details.name}" has partially unknown type`);
                            knownStatus = this._updateKnownStatusIfWorse(knownStatus, 2 /* TypeKnownStatus.PartiallyUnknown */);
                        }
                    });
                }
                break;
            }
            case 7 /* TypeCategory.Module */: {
                if (!this._shouldIgnoreType(report, type.moduleName)) {
                    const moduleSymbol = this._getSymbolForModule(report, type, publicSymbols);
                    knownStatus = this._updateKnownStatusIfWorse(knownStatus, moduleSymbol.typeKnownStatus);
                }
                break;
            }
        }
        return knownStatus;
    }
    _getSymbolCategory(symbol, type) {
        if (type.typeAliasInfo) {
            return packageTypeReport_1.SymbolCategory.TypeAlias;
        }
        switch (type.category) {
            case 4 /* TypeCategory.Function */:
            case 5 /* TypeCategory.OverloadedFunction */: {
                const funcDecl = symbol
                    .getDeclarations()
                    .find((decl) => decl.type === 5 /* DeclarationType.Function */);
                if (funcDecl && funcDecl.isMethod) {
                    return packageTypeReport_1.SymbolCategory.Method;
                }
                return packageTypeReport_1.SymbolCategory.Function;
            }
            case 6 /* TypeCategory.Class */: {
                if (types_1.TypeBase.isInstantiable(type)) {
                    return packageTypeReport_1.SymbolCategory.Class;
                }
                const varDecl = symbol
                    .getDeclarations()
                    .find((decl) => decl.type === 1 /* DeclarationType.Variable */);
                if (varDecl && (varDecl.isConstant || varDecl.isFinal)) {
                    return packageTypeReport_1.SymbolCategory.Constant;
                }
                return packageTypeReport_1.SymbolCategory.Variable;
            }
            case 7 /* TypeCategory.Module */: {
                return packageTypeReport_1.SymbolCategory.Module;
            }
            case 9 /* TypeCategory.TypeVar */: {
                return packageTypeReport_1.SymbolCategory.TypeVar;
            }
            default: {
                const varDecl = symbol
                    .getDeclarations()
                    .find((decl) => decl.type === 1 /* DeclarationType.Variable */);
                if (varDecl) {
                    if (varDecl.isConstant || varDecl.isFinal) {
                        return packageTypeReport_1.SymbolCategory.Constant;
                    }
                    else {
                        return packageTypeReport_1.SymbolCategory.Variable;
                    }
                }
                return packageTypeReport_1.SymbolCategory.Indeterminate;
            }
        }
    }
    _getDirectoryInfoForModule(moduleName) {
        var _a;
        const importResult = this._importResolver.resolveImport(uri_1.Uri.empty(), this._execEnv, (0, importResolver_1.createImportedModuleDescriptor)(moduleName));
        if (importResult.isImportFound) {
            const resolvedPath = importResult.resolvedUris[importResult.resolvedUris.length - 1];
            // If it's a namespace package with no __init__.py(i), use the package
            // directory instead.
            const moduleDirectory = resolvedPath
                ? resolvedPath.getDirectory()
                : (_a = importResult.packageDirectory) !== null && _a !== void 0 ? _a : uri_1.Uri.empty();
            let isModuleSingleFile = false;
            if (resolvedPath && !resolvedPath.isEmpty() && (0, pathUtils_1.stripFileExtension)(resolvedPath.fileName) !== '__init__') {
                isModuleSingleFile = true;
            }
            return {
                moduleDirectory,
                isModuleSingleFile,
            };
        }
        return undefined;
    }
    _isSymbolTypeImplied(scopeType, name) {
        if (scopeType === 3 /* ScopeType.Class */) {
            const knownClassSymbols = [
                '__class__',
                '__dict__',
                '__doc__',
                '__module__',
                '__qualname__',
                '__slots__',
                '__all__',
                '__weakref__',
            ];
            return knownClassSymbols.some((sym) => sym === name);
        }
        else if (scopeType === 4 /* ScopeType.Module */) {
            const knownModuleSymbols = [
                '__all__',
                '__author__',
                '__copyright__',
                '__email__',
                '__license__',
                '__title__',
                '__uri__',
                '__version__',
            ];
            return knownModuleSymbols.some((sym) => sym === name);
        }
        return false;
    }
    _addSymbol(report, symbolInfo) {
        (0, debug_1.assert)(!report.symbols.has(symbolInfo.fullName));
        report.symbols.set(symbolInfo.fullName, symbolInfo);
    }
    _addSymbolError(symbolInfo, message, declRange, declUri) {
        symbolInfo.diagnostics.push({
            diagnostic: new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, message, declRange),
            uri: declUri,
        });
    }
    _addSymbolWarning(symbolInfo, message, declRange, declUri) {
        symbolInfo.diagnostics.push({
            diagnostic: new diagnostic_1.Diagnostic(1 /* DiagnosticCategory.Warning */, message, declRange),
            uri: declUri,
        });
    }
    _updateKnownStatusIfWorse(currentStatus, newStatus) {
        // Is the current status worse than the current status.
        return newStatus > currentStatus ? newStatus : currentStatus;
    }
}
exports.PackageTypeVerifier = PackageTypeVerifier;
//# sourceMappingURL=packageTypeVerifier.js.map