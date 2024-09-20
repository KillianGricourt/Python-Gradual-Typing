"use strict";
/*
 * typeDocStringUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Logic that obtains the doc string for types by looking
 * at the declaration in the type stub, and if needed, in
 * the source file.
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
exports.getVariableDocString = exports.getFunctionOrClassDeclDocString = exports.getClassDocString = exports.getModuleDocString = exports.getModuleDocStringFromUris = exports.getModuleDocStringFromModuleNodes = exports.isBuiltInModule = exports.getVariableInStubFileDocStrings = exports.getPropertyDocStringInherited = exports.getOverloadedFunctionDocStringsInherited = exports.getFunctionDocStringInherited = void 0;
const declaration_1 = require("../analyzer/declaration");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const sourceMapper_1 = require("../analyzer/sourceMapper");
const types_1 = require("../analyzer/types");
const collectionUtils_1 = require("../common/collectionUtils");
const typeUtils_1 = require("./typeUtils");
const DefaultClassIteratorFlagsForFunctions = 4 /* MemberAccessFlags.SkipObjectBaseClass */ |
    16 /* MemberAccessFlags.SkipInstanceMembers */ |
    1 /* MemberAccessFlags.SkipOriginalClass */ |
    64 /* MemberAccessFlags.DeclaredTypesOnly */;
function isInheritedFromBuiltin(type, classType) {
    if (type.category === 5 /* TypeCategory.OverloadedFunction */) {
        if (type.overloads.length === 0) {
            return false;
        }
        type = type.overloads[0];
    }
    // Functions that are bound to a different type than where they
    // were declared are inherited.
    return (!!type.details.methodClass &&
        types_1.ClassType.isBuiltIn(type.details.methodClass) &&
        !!type.boundToType &&
        !types_1.ClassType.isBuiltIn(type.boundToType));
}
function getFunctionDocStringInherited(type, resolvedDecl, sourceMapper, classType) {
    let docString;
    // Don't allow docs to be inherited from the builtins to other classes;
    // they typically not helpful (and object's __init__ doc causes issues
    // with our current docstring traversal).
    if (!isInheritedFromBuiltin(type, classType) && resolvedDecl && (0, declaration_1.isFunctionDeclaration)(resolvedDecl)) {
        docString = _getFunctionDocString(type, resolvedDecl, sourceMapper);
    }
    // Search mro
    if (!docString && classType) {
        const funcName = type.details.name;
        const memberIterator = (0, typeUtils_1.getClassMemberIterator)(classType, funcName, DefaultClassIteratorFlagsForFunctions);
        for (const classMember of memberIterator) {
            const decls = classMember.symbol.getDeclarations();
            if (decls.length > 0) {
                const inheritedDecl = classMember.symbol.getDeclarations().slice(-1)[0];
                if ((0, declaration_1.isFunctionDeclaration)(inheritedDecl)) {
                    docString = _getFunctionDocStringFromDeclaration(inheritedDecl, sourceMapper);
                    if (docString) {
                        break;
                    }
                }
            }
        }
    }
    return docString || type.details.docString;
}
exports.getFunctionDocStringInherited = getFunctionDocStringInherited;
function getOverloadedFunctionDocStringsInherited(type, resolvedDecls, sourceMapper, evaluator, classType) {
    var _a;
    let docStrings;
    // Don't allow docs to be inherited from the builtins to other classes;
    // they typically not helpful (and object's __init__ doc causes issues
    // with our current docstring traversal).
    if (!isInheritedFromBuiltin(type, classType)) {
        for (const resolvedDecl of resolvedDecls) {
            docStrings = _getOverloadedFunctionDocStrings(type, resolvedDecl, sourceMapper);
            if (docStrings && docStrings.length > 0) {
                return docStrings;
            }
        }
    }
    // Search mro
    if (classType && type.overloads.length > 0) {
        const funcName = type.overloads[0].details.name;
        const memberIterator = (0, typeUtils_1.getClassMemberIterator)(classType, funcName, DefaultClassIteratorFlagsForFunctions);
        for (const classMember of memberIterator) {
            const inheritedDecl = classMember.symbol.getDeclarations().slice(-1)[0];
            const declType = (_a = evaluator.getTypeForDeclaration(inheritedDecl)) === null || _a === void 0 ? void 0 : _a.type;
            if (declType) {
                docStrings = _getOverloadedFunctionDocStrings(declType, inheritedDecl, sourceMapper);
                if (docStrings && docStrings.length > 0) {
                    break;
                }
            }
        }
    }
    return docStrings !== null && docStrings !== void 0 ? docStrings : [];
}
exports.getOverloadedFunctionDocStringsInherited = getOverloadedFunctionDocStringsInherited;
function getPropertyDocStringInherited(decl, sourceMapper, evaluator) {
    const enclosingClass = ParseTreeUtils.getEnclosingClass(decl.node.name, /* stopAtFunction */ false);
    const classResults = enclosingClass ? evaluator.getTypeOfClass(enclosingClass) : undefined;
    if (classResults) {
        return _getPropertyDocStringInherited(decl, sourceMapper, evaluator, classResults.classType);
    }
    return undefined;
}
exports.getPropertyDocStringInherited = getPropertyDocStringInherited;
function getVariableInStubFileDocStrings(decl, sourceMapper) {
    const docStrings = [];
    if (!(0, sourceMapper_1.isStubFile)(decl.uri)) {
        return docStrings;
    }
    for (const implDecl of sourceMapper.findDeclarations(decl)) {
        if ((0, declaration_1.isVariableDeclaration)(implDecl) && !!implDecl.docString) {
            docStrings.push(implDecl.docString);
        }
        else if ((0, declaration_1.isClassDeclaration)(implDecl) || (0, declaration_1.isFunctionDeclaration)(implDecl)) {
            // It is possible that the variable on the stub is not actually a variable on the corresponding py file.
            // in that case, get the doc string from original symbol if possible.
            const docString = getFunctionOrClassDeclDocString(implDecl);
            if (docString) {
                docStrings.push(docString);
            }
        }
    }
    return docStrings;
}
exports.getVariableInStubFileDocStrings = getVariableInStubFileDocStrings;
function isBuiltInModule(uri) {
    if (uri) {
        return uri.getPath().includes('typeshed-fallback/stdlib');
    }
    return false;
}
exports.isBuiltInModule = isBuiltInModule;
function getModuleDocStringFromModuleNodes(modules) {
    for (const module of modules) {
        if (module.statements) {
            const docString = ParseTreeUtils.getDocString(module.statements);
            if (docString) {
                return docString;
            }
        }
    }
    return undefined;
}
exports.getModuleDocStringFromModuleNodes = getModuleDocStringFromModuleNodes;
function getModuleDocStringFromUris(uris, sourceMapper) {
    const modules = [];
    for (const uri of uris) {
        if ((0, sourceMapper_1.isStubFile)(uri)) {
            (0, collectionUtils_1.addIfNotNull)(modules, sourceMapper.getModuleNode(uri));
        }
        (0, collectionUtils_1.appendArray)(modules, sourceMapper.findModules(uri));
    }
    return getModuleDocStringFromModuleNodes(modules);
}
exports.getModuleDocStringFromUris = getModuleDocStringFromUris;
function getModuleDocString(type, resolvedDecl, sourceMapper) {
    var _a;
    let docString = type.docString;
    if (!docString) {
        const uri = (_a = resolvedDecl === null || resolvedDecl === void 0 ? void 0 : resolvedDecl.uri) !== null && _a !== void 0 ? _a : type.fileUri;
        docString = getModuleDocStringFromUris([uri], sourceMapper);
    }
    return docString;
}
exports.getModuleDocString = getModuleDocString;
function getClassDocString(classType, resolvedDecl, sourceMapper) {
    let docString = classType.details.docString;
    if (!docString && resolvedDecl && _isAnyClassDeclaration(resolvedDecl)) {
        docString = (0, declaration_1.isClassDeclaration)(resolvedDecl) ? _getFunctionOrClassDeclsDocString([resolvedDecl]) : undefined;
        if (!docString && resolvedDecl && (0, sourceMapper_1.isStubFile)(resolvedDecl.uri)) {
            for (const implDecl of sourceMapper.findDeclarations(resolvedDecl)) {
                if ((0, declaration_1.isVariableDeclaration)(implDecl) && !!implDecl.docString) {
                    docString = implDecl.docString;
                    break;
                }
                if ((0, declaration_1.isClassDeclaration)(implDecl) || (0, declaration_1.isFunctionDeclaration)(implDecl)) {
                    docString = getFunctionOrClassDeclDocString(implDecl);
                    break;
                }
            }
        }
    }
    if (!docString && resolvedDecl) {
        const implDecls = sourceMapper.findClassDeclarationsByType(resolvedDecl.uri, classType);
        if (implDecls) {
            const classDecls = implDecls.filter((d) => (0, declaration_1.isClassDeclaration)(d)).map((d) => d);
            docString = _getFunctionOrClassDeclsDocString(classDecls);
        }
    }
    return docString;
}
exports.getClassDocString = getClassDocString;
function getFunctionOrClassDeclDocString(decl) {
    var _a, _b, _c;
    return ParseTreeUtils.getDocString((_c = (_b = (_a = decl.node) === null || _a === void 0 ? void 0 : _a.suite) === null || _b === void 0 ? void 0 : _b.statements) !== null && _c !== void 0 ? _c : []);
}
exports.getFunctionOrClassDeclDocString = getFunctionOrClassDeclDocString;
function getVariableDocString(decl, sourceMapper) {
    if (!decl) {
        return undefined;
    }
    if (decl.docString !== undefined) {
        return decl.docString;
    }
    else {
        return getVariableInStubFileDocStrings(decl, sourceMapper).find((doc) => doc);
    }
}
exports.getVariableDocString = getVariableDocString;
function _getOverloadedFunctionDocStrings(type, resolvedDecl, sourceMapper) {
    if (!(0, types_1.isOverloadedFunction)(type)) {
        return undefined;
    }
    const docStrings = [];
    if (type.overloads.some((o) => o.details.docString)) {
        type.overloads.forEach((overload) => {
            if (overload.details.docString) {
                docStrings.push(overload.details.docString);
            }
        });
    }
    else if (resolvedDecl && (0, sourceMapper_1.isStubFile)(resolvedDecl.uri) && (0, declaration_1.isFunctionDeclaration)(resolvedDecl)) {
        const implDecls = sourceMapper.findFunctionDeclarations(resolvedDecl);
        const docString = _getFunctionOrClassDeclsDocString(implDecls);
        if (docString) {
            docStrings.push(docString);
        }
    }
    return docStrings;
}
function _getPropertyDocStringInherited(decl, sourceMapper, evaluator, classType) {
    var _a, _b;
    if (!decl || !(0, declaration_1.isFunctionDeclaration)(decl)) {
        return;
    }
    const declaredType = (_a = evaluator.getTypeForDeclaration(decl)) === null || _a === void 0 ? void 0 : _a.type;
    if (!declaredType || !(0, typeUtils_1.isMaybeDescriptorInstance)(declaredType)) {
        return;
    }
    const fieldName = decl.node.nodeType === 31 /* ParseNodeType.Function */ ? decl.node.name.value : undefined;
    if (!fieldName) {
        return;
    }
    const classItr = (0, typeUtils_1.getClassIterator)(classType, 0 /* ClassIteratorFlags.Default */);
    // Walk the inheritance list starting with the current class searching for docStrings
    for (const [mroClass] of classItr) {
        if (!(0, types_1.isInstantiableClass)(mroClass)) {
            continue;
        }
        const symbol = types_1.ClassType.getSymbolTable(mroClass).get(fieldName);
        // Get both the setter and getter declarations
        const decls = symbol === null || symbol === void 0 ? void 0 : symbol.getDeclarations();
        if (decls) {
            for (const decl of decls) {
                if ((0, declaration_1.isFunctionDeclaration)(decl)) {
                    const declaredType = (_b = evaluator.getTypeForDeclaration(decl)) === null || _b === void 0 ? void 0 : _b.type;
                    if (declaredType && (0, typeUtils_1.isMaybeDescriptorInstance)(declaredType)) {
                        const docString = _getFunctionDocStringFromDeclaration(decl, sourceMapper);
                        if (docString) {
                            return docString;
                        }
                    }
                }
            }
        }
    }
    return;
}
function _getFunctionDocString(type, resolvedDecl, sourceMapper) {
    if (!(0, types_1.isFunction)(type)) {
        return undefined;
    }
    let docString = type.details.docString;
    if (!docString && resolvedDecl) {
        docString = _getFunctionDocStringFromDeclaration(resolvedDecl, sourceMapper);
    }
    if (!docString && type.details.declaration) {
        docString = _getFunctionDocStringFromDeclaration(type.details.declaration, sourceMapper);
    }
    return docString;
}
function _getFunctionDocStringFromDeclaration(resolvedDecl, sourceMapper) {
    let docString = _getFunctionOrClassDeclsDocString([resolvedDecl]);
    if (!docString && (0, sourceMapper_1.isStubFile)(resolvedDecl.uri)) {
        const implDecls = sourceMapper.findFunctionDeclarations(resolvedDecl);
        docString = _getFunctionOrClassDeclsDocString(implDecls);
    }
    return docString;
}
function _getFunctionOrClassDeclsDocString(decls) {
    for (const decl of decls) {
        const docString = getFunctionOrClassDeclDocString(decl);
        if (docString) {
            return docString;
        }
    }
    return undefined;
}
function _isAnyClassDeclaration(decl) {
    return (0, declaration_1.isClassDeclaration)(decl) || (0, declaration_1.isSpecialBuiltInClassDeclaration)(decl);
}
//# sourceMappingURL=typeDocStringUtils.js.map