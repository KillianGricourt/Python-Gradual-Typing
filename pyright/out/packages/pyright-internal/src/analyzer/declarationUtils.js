"use strict";
/*
 * declarationUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Collection of static methods that operate on declarations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveAliasDeclaration = exports.createSynthesizedAliasDeclaration = exports.getDeclarationsWithUsesLocalNameRemoved = exports.isDefinedInFile = exports.getNameNodeForDeclaration = exports.getNameFromDeclaration = exports.areDeclarationsSame = exports.hasTypeForDeclaration = void 0;
const textRange_1 = require("../common/textRange");
const declaration_1 = require("./declaration");
const parseTreeUtils_1 = require("./parseTreeUtils");
function hasTypeForDeclaration(declaration) {
    switch (declaration.type) {
        case 0 /* DeclarationType.Intrinsic */:
        case 6 /* DeclarationType.Class */:
        case 7 /* DeclarationType.SpecialBuiltInClass */:
        case 5 /* DeclarationType.Function */:
        case 3 /* DeclarationType.TypeParameter */:
        case 4 /* DeclarationType.TypeAlias */:
            return true;
        case 2 /* DeclarationType.Parameter */: {
            if (declaration.node.typeAnnotation || declaration.node.typeAnnotationComment) {
                return true;
            }
            // Handle function type comments.
            const parameterParent = declaration.node.parent;
            if ((parameterParent === null || parameterParent === void 0 ? void 0 : parameterParent.nodeType) === 31 /* ParseNodeType.Function */) {
                if (parameterParent.functionAnnotationComment &&
                    !parameterParent.functionAnnotationComment.isParamListEllipsis) {
                    const paramAnnotations = parameterParent.functionAnnotationComment.paramTypeAnnotations;
                    // Handle the case where the annotation comment is missing an
                    // annotation for the first parameter (self or cls).
                    if (parameterParent.parameters.length > paramAnnotations.length &&
                        declaration.node === parameterParent.parameters[0]) {
                        return false;
                    }
                    return true;
                }
            }
            return false;
        }
        case 1 /* DeclarationType.Variable */:
            return !!declaration.typeAnnotationNode;
        case 8 /* DeclarationType.Alias */:
            return false;
    }
}
exports.hasTypeForDeclaration = hasTypeForDeclaration;
function areDeclarationsSame(decl1, decl2, treatModuleInImportAndFromImportSame = false, skipRangeForAliases = false) {
    if (decl1.type !== decl2.type) {
        return false;
    }
    if (!decl1.uri.equals(decl2.uri)) {
        return false;
    }
    if (!skipRangeForAliases || decl1.type !== 8 /* DeclarationType.Alias */) {
        if (decl1.range.start.line !== decl2.range.start.line ||
            decl1.range.start.character !== decl2.range.start.character) {
            return false;
        }
    }
    // Alias declarations refer to the entire import statement.
    // We need to further differentiate.
    if (decl1.type === 8 /* DeclarationType.Alias */ && decl2.type === 8 /* DeclarationType.Alias */) {
        if (decl1.symbolName !== decl2.symbolName || decl1.usesLocalName !== decl2.usesLocalName) {
            return false;
        }
        if (treatModuleInImportAndFromImportSame) {
            // Treat "module" in "import [|module|]", "from [|module|] import ..."
            // or "from ... import [|module|]" same in IDE services.
            //
            // Some case such as "from [|module|] import ...", symbol for [|module|] doesn't even
            // exist and it can't be referenced inside of a module, but nonetheless, IDE still
            // needs these sometimes for things like hover tooltip, highlight references,
            // find all references and etc.
            return true;
        }
        if (decl1.node !== decl2.node) {
            return false;
        }
    }
    return true;
}
exports.areDeclarationsSame = areDeclarationsSame;
function getNameFromDeclaration(declaration) {
    var _a;
    switch (declaration.type) {
        case 8 /* DeclarationType.Alias */:
            return declaration.symbolName;
        case 6 /* DeclarationType.Class */:
        case 5 /* DeclarationType.Function */:
        case 3 /* DeclarationType.TypeParameter */:
        case 4 /* DeclarationType.TypeAlias */:
            return declaration.node.name.value;
        case 2 /* DeclarationType.Parameter */:
            return (_a = declaration.node.name) === null || _a === void 0 ? void 0 : _a.value;
        case 1 /* DeclarationType.Variable */:
            return declaration.node.nodeType === 38 /* ParseNodeType.Name */ ? declaration.node.value : undefined;
        case 0 /* DeclarationType.Intrinsic */:
        case 7 /* DeclarationType.SpecialBuiltInClass */:
            return declaration.node.nodeType === 54 /* ParseNodeType.TypeAnnotation */ &&
                declaration.node.valueExpression.nodeType === 38 /* ParseNodeType.Name */
                ? declaration.node.valueExpression.value
                : undefined;
    }
    throw new Error(`Shouldn't reach here`);
}
exports.getNameFromDeclaration = getNameFromDeclaration;
function getNameNodeForDeclaration(declaration) {
    var _a, _b;
    switch (declaration.type) {
        case 8 /* DeclarationType.Alias */:
            if (declaration.node.nodeType === 24 /* ParseNodeType.ImportAs */) {
                return (_a = declaration.node.alias) !== null && _a !== void 0 ? _a : declaration.node.module.nameParts[0];
            }
            else if (declaration.node.nodeType === 26 /* ParseNodeType.ImportFromAs */) {
                return (_b = declaration.node.alias) !== null && _b !== void 0 ? _b : declaration.node.name;
            }
            else {
                return declaration.node.module.nameParts[0];
            }
        case 6 /* DeclarationType.Class */:
        case 5 /* DeclarationType.Function */:
        case 3 /* DeclarationType.TypeParameter */:
        case 2 /* DeclarationType.Parameter */:
        case 4 /* DeclarationType.TypeAlias */:
            return declaration.node.name;
        case 1 /* DeclarationType.Variable */:
            return declaration.node.nodeType === 38 /* ParseNodeType.Name */ ? declaration.node : undefined;
        case 0 /* DeclarationType.Intrinsic */:
        case 7 /* DeclarationType.SpecialBuiltInClass */:
            return undefined;
    }
    throw new Error(`Shouldn't reach here`);
}
exports.getNameNodeForDeclaration = getNameNodeForDeclaration;
function isDefinedInFile(decl, fileUri) {
    var _a;
    if ((0, declaration_1.isAliasDeclaration)(decl)) {
        // Alias decl's path points to the original symbol
        // the alias is pointing to. So, we need to get the
        // filepath in that the alias is defined from the node.
        return (_a = (0, parseTreeUtils_1.getFileInfoFromNode)(decl.node)) === null || _a === void 0 ? void 0 : _a.fileUri.equals(fileUri);
    }
    // Other decls, the path points to the file the symbol is defined in.
    return decl.uri.equals(fileUri);
}
exports.isDefinedInFile = isDefinedInFile;
function getDeclarationsWithUsesLocalNameRemoved(decls) {
    // Make a shallow copy and clear the "usesLocalName" field.
    return decls.map((localDecl) => {
        if (localDecl.type !== 8 /* DeclarationType.Alias */) {
            return localDecl;
        }
        const nonLocalDecl = { ...localDecl };
        nonLocalDecl.usesLocalName = false;
        return nonLocalDecl;
    });
}
exports.getDeclarationsWithUsesLocalNameRemoved = getDeclarationsWithUsesLocalNameRemoved;
function createSynthesizedAliasDeclaration(uri) {
    // The only time this decl is used is for IDE services such as
    // the find all references, hover provider and etc.
    return {
        type: 8 /* DeclarationType.Alias */,
        node: undefined,
        uri,
        loadSymbolsFromPath: false,
        range: (0, textRange_1.getEmptyRange)(),
        implicitImports: new Map(),
        usesLocalName: false,
        moduleName: '',
        isInExceptSuite: false,
    };
}
exports.createSynthesizedAliasDeclaration = createSynthesizedAliasDeclaration;
// If the specified declaration is an alias declaration that points to a symbol,
// it resolves the alias and looks up the symbol, then returns a declaration
// (typically the last) associated with that symbol. It does this recursively if
// necessary. If a symbol lookup fails, undefined is returned. If resolveLocalNames
// is true, the method resolves aliases through local renames ("as" clauses found
// in import statements).
function resolveAliasDeclaration(importLookup, declaration, options) {
    let curDeclaration = declaration;
    const alreadyVisited = [];
    let isPrivate = false;
    // These variables are used to find a transition from a non-py.typed to
    // a py.typed resolution chain. In this case, if the imported symbol
    // is a private symbol (i.e. not intended to be re-exported), we store
    // the name of the importer and imported modules so the caller can
    // report an error.
    let sawPyTypedTransition = false;
    let privatePyTypedImported;
    let privatePyTypedImporter;
    while (true) {
        if (curDeclaration.type !== 8 /* DeclarationType.Alias */ || !curDeclaration.symbolName) {
            return {
                declaration: curDeclaration,
                isPrivate,
                privatePyTypedImported,
                privatePyTypedImporter,
            };
        }
        // If we are not supposed to follow local alias names and this
        // is a local name, don't continue to follow the alias.
        if (!options.resolveLocalNames && curDeclaration.usesLocalName) {
            return {
                declaration: curDeclaration,
                isPrivate,
                privatePyTypedImported,
                privatePyTypedImporter,
            };
        }
        let lookupResult;
        if (!curDeclaration.uri.isEmpty() && curDeclaration.loadSymbolsFromPath) {
            lookupResult = importLookup(curDeclaration.uri, {
                skipFileNeededCheck: options.skipFileNeededCheck,
            });
        }
        const symbol = lookupResult
            ? lookupResult.symbolTable.get(curDeclaration.symbolName)
            : undefined;
        if (!symbol) {
            if (curDeclaration.submoduleFallback) {
                if (curDeclaration.symbolName) {
                    // See if we are resolving a specific imported symbol name and the submodule
                    // fallback cannot be resolved. For example, `from a import b`. If b is both
                    // a symbol in `a/__init__.py` and a submodule `a/b.py` and we are not using
                    // type information from this library (e.g. a non-py.typed library source file
                    // when useLibraryCodeForTypes is disabled), b should be evaluated as Unknown,
                    // not as a module.
                    if (!curDeclaration.uri.isEmpty() &&
                        curDeclaration.submoduleFallback.type === 8 /* DeclarationType.Alias */ &&
                        !curDeclaration.submoduleFallback.uri.isEmpty()) {
                        const lookupResult = importLookup(curDeclaration.submoduleFallback.uri, {
                            skipFileNeededCheck: options.skipFileNeededCheck,
                            skipParsing: true,
                        });
                        if (!lookupResult) {
                            return undefined;
                        }
                    }
                }
                let submoduleFallback = curDeclaration.submoduleFallback;
                if (curDeclaration.symbolName) {
                    submoduleFallback = { ...curDeclaration.submoduleFallback };
                    let baseModuleName = submoduleFallback.moduleName;
                    if (baseModuleName) {
                        baseModuleName = `${baseModuleName}.`;
                    }
                    submoduleFallback.moduleName = `${baseModuleName}${curDeclaration.symbolName}`;
                }
                return resolveAliasDeclaration(importLookup, submoduleFallback, options);
            }
            // If the symbol comes from a native library, we won't
            // be able to resolve its type directly.
            if (curDeclaration.isNativeLib) {
                return {
                    declaration: undefined,
                    isPrivate,
                };
            }
            return undefined;
        }
        if (symbol.isPrivateMember() && !sawPyTypedTransition) {
            isPrivate = true;
        }
        if (symbol.isExternallyHidden() && !options.allowExternallyHiddenAccess) {
            return undefined;
        }
        // Prefer declarations with specified types. If we don't have any of those,
        // fall back on declarations with inferred types.
        let declarations = symbol.getTypedDeclarations();
        // Try not to use declarations within an except suite even if it's a typed
        // declaration. These are typically used for fallback exception handling.
        declarations = declarations.filter((decl) => !decl.isInExceptSuite);
        if (declarations.length === 0) {
            declarations = symbol.getDeclarations();
            declarations = declarations.filter((decl) => !decl.isInExceptSuite);
        }
        if (declarations.length === 0) {
            // Use declarations within except clauses if there are no alternatives.
            declarations = symbol.getDeclarations();
        }
        if (declarations.length === 0) {
            return undefined;
        }
        const prevDeclaration = curDeclaration;
        // Prefer the last unvisited declaration in the list. This ensures that
        // we use all of the overloads if it's an overloaded function.
        const unvisitedDecls = declarations.filter((decl) => !alreadyVisited.includes(decl));
        if (unvisitedDecls.length > 0) {
            curDeclaration = unvisitedDecls[unvisitedDecls.length - 1];
        }
        else {
            curDeclaration = declarations[declarations.length - 1];
        }
        if (lookupResult === null || lookupResult === void 0 ? void 0 : lookupResult.isInPyTypedPackage) {
            if (!sawPyTypedTransition) {
                if (symbol.isPrivatePyTypedImport()) {
                    privatePyTypedImporter = prevDeclaration === null || prevDeclaration === void 0 ? void 0 : prevDeclaration.moduleName;
                }
                // Note that we've seen a transition from a non-py.typed to a py.typed
                // import. No further check is needed.
                sawPyTypedTransition = true;
            }
            else {
                // If we've already seen a transition, look for the first non-private
                // symbol that is resolved so we can tell the user to import from this
                // location instead.
                if (!symbol.isPrivatePyTypedImport()) {
                    privatePyTypedImported = privatePyTypedImported !== null && privatePyTypedImported !== void 0 ? privatePyTypedImported : curDeclaration === null || curDeclaration === void 0 ? void 0 : curDeclaration.moduleName;
                }
            }
        }
        // Make sure we don't follow a circular list indefinitely.
        if (alreadyVisited.find((decl) => decl === curDeclaration)) {
            // If the path path of the alias points back to the original path, use the submodule
            // fallback instead. This happens in the case where a module's __init__.py file
            // imports a submodule using itself as the import target. For example, if
            // the module is foo, and the foo.__init__.py file contains the statement
            // "from foo import bar", we want to import the foo/bar.py submodule.
            if (curDeclaration.uri.equals(declaration.uri) &&
                curDeclaration.type === 8 /* DeclarationType.Alias */ &&
                curDeclaration.submoduleFallback) {
                return resolveAliasDeclaration(importLookup, curDeclaration.submoduleFallback, options);
            }
            return {
                declaration,
                isPrivate,
                privatePyTypedImported,
                privatePyTypedImporter,
            };
        }
        alreadyVisited.push(curDeclaration);
    }
}
exports.resolveAliasDeclaration = resolveAliasDeclaration;
//# sourceMappingURL=declarationUtils.js.map