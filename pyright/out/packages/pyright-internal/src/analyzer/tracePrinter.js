"use strict";
/*
 * tracePrinter.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Converts various types into string representations.
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
exports.createTracePrinter = void 0;
const core_1 = require("../common/core");
const debug_1 = require("../common/debug");
const pathUtils_1 = require("../common/pathUtils");
const positionUtils_1 = require("../common/positionUtils");
const uri_1 = require("../common/uri/uri");
const parseNodes_1 = require("../parser/parseNodes");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const symbol_1 = require("./symbol");
const types_1 = require("./types");
function createTracePrinter(roots) {
    function wrap(value, ch = "'") {
        return value ? `${ch}${value}${ch}` : '';
    }
    // Sort roots in desc order so that we compare longer path first
    // when getting relative path.
    // ex) d:/root/.env/lib/site-packages, d:/root/.env
    roots = roots.sort((a, b) => a.key.localeCompare(b.key)).reverse();
    const separatorRegExp = /[\\/]/g;
    function printFileOrModuleName(fileUriOrModule) {
        if (fileUriOrModule) {
            if (uri_1.Uri.is(fileUriOrModule)) {
                for (const root of roots) {
                    if (fileUriOrModule.isChild(root)) {
                        const subFile = root.getRelativePath(fileUriOrModule);
                        return (0, pathUtils_1.stripFileExtension)(subFile).replace(separatorRegExp, '.');
                    }
                }
                return fileUriOrModule.toUserVisibleString();
            }
            else if (fileUriOrModule.nameParts) {
                return fileUriOrModule.nameParts.join('.');
            }
        }
        return '';
    }
    function printType(type) {
        var _a, _b, _c, _d, _e;
        if (type) {
            switch (type.category) {
                case 2 /* TypeCategory.Any */:
                    return `Any ${wrap((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.fullName)}`;
                case 6 /* TypeCategory.Class */:
                    if (types_1.TypeBase.isInstantiable(type)) {
                        return `Class '${type.details.name}' (${type.details.moduleName})`;
                    }
                    else {
                        return `Object '${type.details.name}' (${type.details.moduleName})`;
                    }
                case 4 /* TypeCategory.Function */:
                    return `Function '${type.details.name}' (${type.details.moduleName})`;
                case 7 /* TypeCategory.Module */:
                    return `Module '${type.moduleName}' (${type.moduleName})`;
                case 3 /* TypeCategory.Never */:
                    return `Never ${wrap((_b = type.typeAliasInfo) === null || _b === void 0 ? void 0 : _b.fullName)}`;
                case 5 /* TypeCategory.OverloadedFunction */:
                    return `OverloadedFunction [${type.overloads.map((o) => wrap(printType(o), '"')).join(',')}]`;
                case 9 /* TypeCategory.TypeVar */:
                    return `TypeVar '${type.details.name}' ${wrap((_c = type.typeAliasInfo) === null || _c === void 0 ? void 0 : _c.fullName)}`;
                case 0 /* TypeCategory.Unbound */:
                    return `Unbound ${wrap((_d = type.typeAliasInfo) === null || _d === void 0 ? void 0 : _d.fullName)}`;
                case 8 /* TypeCategory.Union */:
                    return `Union [${type.subtypes.map((o) => wrap(printType(o), '"')).join(',')}]`;
                case 1 /* TypeCategory.Unknown */:
                    return `Unknown ${wrap((_e = type.typeAliasInfo) === null || _e === void 0 ? void 0 : _e.fullName)}`;
                default:
                    (0, debug_1.assertNever)(type);
            }
        }
        return '';
    }
    function printSymbol(symbol) {
        if (symbol) {
            if (symbol.hasDeclarations()) {
                return `symbol ${printDeclaration(symbol.getDeclarations()[0])}`;
            }
            return `<symbol>`;
        }
        return '';
    }
    function printDeclaration(decl) {
        if (decl) {
            switch (decl.type) {
                case 8 /* DeclarationType.Alias */:
                    return `Alias, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                case 6 /* DeclarationType.Class */:
                    return `Class, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                case 5 /* DeclarationType.Function */:
                    return `Function, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                case 0 /* DeclarationType.Intrinsic */:
                    return `Intrinsic, ${printNode(decl.node)} ${decl.intrinsicType} (${printFileOrModuleName(decl.uri)})`;
                case 2 /* DeclarationType.Parameter */:
                    return `Parameter, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                case 3 /* DeclarationType.TypeParameter */:
                    return `TypeParameter, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                case 7 /* DeclarationType.SpecialBuiltInClass */:
                    return `SpecialBuiltInClass, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                case 1 /* DeclarationType.Variable */:
                    return `Variable, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                case 4 /* DeclarationType.TypeAlias */:
                    return `TypeAlias, ${printNode(decl.node)} (${printFileOrModuleName(decl.uri)})`;
                default:
                    (0, debug_1.assertNever)(decl);
            }
        }
        return '';
    }
    function getFileInfo(node) {
        while (node.nodeType !== 36 /* ParseNodeType.Module */ && node.parent) {
            node = node.parent;
        }
        return node.nodeType === 36 /* ParseNodeType.Module */ ? AnalyzerNodeInfo.getFileInfo(node) : undefined;
    }
    function getText(value, max = 30) {
        if (value.length < max) {
            return value;
        }
        return value.substring(0, max) + ' <shortened> ';
    }
    function printNode(node, printPath = false) {
        var _a;
        if (!node) {
            return '';
        }
        let path = printPath ? `(${printFileOrModuleName((_a = getFileInfo(node)) === null || _a === void 0 ? void 0 : _a.fileUri)})` : '';
        const fileInfo = getFileInfo(node);
        if (fileInfo === null || fileInfo === void 0 ? void 0 : fileInfo.lines) {
            const position = (0, positionUtils_1.convertOffsetToPosition)(node.start, fileInfo.lines);
            path += ` [${position.line + 1}:${position.character + 1}]`;
        }
        if ((0, parseNodes_1.isExpressionNode)(node)) {
            return wrap(getText(ParseTreeUtils.printExpression(node)), '"') + ` ${path}`;
        }
        switch (node.nodeType) {
            case 24 /* ParseNodeType.ImportAs */:
                return `importAs '${printNode(node.module)}' ${wrap(node.alias ? printNode(node.alias) : '')} ${path}`;
            case 25 /* ParseNodeType.ImportFrom */:
                return `importFrom [${node.imports.map((i) => wrap(printNode(i), '"')).join(',')}]`;
            case 26 /* ParseNodeType.ImportFromAs */:
                return `ImportFromAs '${printNode(node.name)}' ${wrap(node.alias ? printNode(node.alias) : '')} ${path}`;
            case 36 /* ParseNodeType.Module */:
                return `module ${path}`;
            case 10 /* ParseNodeType.Class */:
                return `class '${printNode(node.name)}' ${path}`;
            case 31 /* ParseNodeType.Function */:
                return `function '${printNode(node.name)}' ${path}`;
            case 37 /* ParseNodeType.ModuleName */:
                return `moduleName '${node.nameParts.map((n) => printNode(n)).join('.')}' ${path}`;
            case 1 /* ParseNodeType.Argument */:
                return `argument '${node.name ? printNode(node.name) : 'N/A'}' ${path}`;
            case 41 /* ParseNodeType.Parameter */:
                return `parameter '${node.name ? printNode(node.name) : 'N/A'}' ${path}`;
            default:
                return `${ParseTreeUtils.printParseNodeType(node.nodeType)} ${path}`;
        }
    }
    function isNode(o) {
        const n = o;
        return n && (0, core_1.isNumber)(n.nodeType);
    }
    function isDeclaration(o) {
        const d = o;
        return d && (0, core_1.isNumber)(d.type) && uri_1.Uri.is(d.uri) && (0, core_1.isString)(d.moduleName);
    }
    function isType(o) {
        const t = o;
        return t && (0, core_1.isNumber)(t.category) && (0, core_1.isNumber)(t.flags);
    }
    function print(o) {
        if (!o) {
            return '';
        }
        if (isNode(o)) {
            return printNode(o, /* printPath */ true);
        }
        if (isDeclaration(o)) {
            return printDeclaration(o);
        }
        if (o instanceof symbol_1.Symbol) {
            return printSymbol(o);
        }
        if (isType(o)) {
            return printType(o);
        }
        // Do nothing, we can't print it.
        return '';
    }
    return {
        print: print,
        printFileOrModuleName: printFileOrModuleName,
    };
}
exports.createTracePrinter = createTracePrinter;
//# sourceMappingURL=tracePrinter.js.map