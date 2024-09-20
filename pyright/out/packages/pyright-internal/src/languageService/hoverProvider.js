"use strict";
/*
 * hoverProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that maps a position within a Python program file into
 * markdown text that is displayed when the user hovers over that
 * position within a smart editor.
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
exports.HoverProvider = exports.getVariableTypeText = exports.addDocumentationResultsPart = exports.convertHoverResults = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const declaration_1 = require("../analyzer/declaration");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const typeDocStringUtils_1 = require("../analyzer/typeDocStringUtils");
const typeUtils_1 = require("../analyzer/typeUtils");
const types_1 = require("../analyzer/types");
const cancellationUtils_1 = require("../common/cancellationUtils");
const debug_1 = require("../common/debug");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
const tooltipUtils_1 = require("./tooltipUtils");
function convertHoverResults(hoverResults, format) {
    if (!hoverResults) {
        return null;
    }
    const markupString = hoverResults.parts
        .map((part) => {
        if (part.python) {
            if (format === vscode_languageserver_1.MarkupKind.Markdown) {
                return '```python\n' + part.text + '\n```\n';
            }
            else if (format === vscode_languageserver_1.MarkupKind.PlainText) {
                return part.text + '\n\n';
            }
            else {
                (0, debug_1.fail)(`Unsupported markup type: ${format}`);
            }
        }
        return part.text;
    })
        .join('')
        .trimEnd();
    return {
        contents: {
            kind: format,
            value: markupString,
        },
        range: hoverResults.range,
    };
}
exports.convertHoverResults = convertHoverResults;
function addDocumentationResultsPart(serviceProvider, docString, format, parts, resolvedDecl) {
    if (!docString) {
        return;
    }
    if (format === vscode_languageserver_1.MarkupKind.Markdown) {
        const markDown = serviceProvider
            .docStringService()
            .convertDocStringToMarkdown(docString, (0, typeDocStringUtils_1.isBuiltInModule)(resolvedDecl === null || resolvedDecl === void 0 ? void 0 : resolvedDecl.uri));
        if (parts.length > 0 && markDown.length > 0) {
            parts.push({ text: '---\n' });
        }
        parts.push({ text: markDown, python: false });
        return;
    }
    if (format === vscode_languageserver_1.MarkupKind.PlainText) {
        parts.push({ text: serviceProvider.docStringService().convertDocStringToPlainText(docString), python: false });
        return;
    }
    (0, debug_1.fail)(`Unsupported markup type: ${format}`);
}
exports.addDocumentationResultsPart = addDocumentationResultsPart;
function getVariableTypeText(evaluator, declaration, name, type, typeNode, functionSignatureDisplay) {
    let label = declaration.isConstant || evaluator.isFinalVariableDeclaration(declaration) ? 'constant' : 'variable';
    const expandTypeAlias = false;
    let typeVarName;
    if (type.typeAliasInfo && typeNode.nodeType === 38 /* ParseNodeType.Name */) {
        const typeAliasInfo = (0, types_1.getTypeAliasInfo)(type);
        if ((typeAliasInfo === null || typeAliasInfo === void 0 ? void 0 : typeAliasInfo.name) === typeNode.value) {
            if ((0, types_1.isTypeVar)(type)) {
                label = type.details.isParamSpec ? 'param spec' : 'type variable';
                typeVarName = type.details.name;
            }
            else {
                // Handle type aliases specially.
                const typeText = evaluator.printType((0, typeUtils_1.convertToInstance)((0, tooltipUtils_1.getTypeForToolTip)(evaluator, typeNode)), {
                    expandTypeAlias: true,
                });
                return `(type) ${name} = ` + typeText;
            }
        }
    }
    // Handle the case where type is a function and was assigned to a variable.
    if (type.category === 4 /* TypeCategory.Function */ || type.category === 5 /* TypeCategory.OverloadedFunction */) {
        return (0, tooltipUtils_1.getToolTipForType)(type, label, name, evaluator, /* isProperty */ false, functionSignatureDisplay);
    }
    const typeText = typeVarName !== null && typeVarName !== void 0 ? typeVarName : name + ': ' + evaluator.printType((0, tooltipUtils_1.getTypeForToolTip)(evaluator, typeNode), { expandTypeAlias });
    return `(${label}) ` + typeText;
}
exports.getVariableTypeText = getVariableTypeText;
class HoverProvider {
    constructor(_program, _fileUri, _position, _format, _token) {
        this._program = _program;
        this._fileUri = _fileUri;
        this._position = _position;
        this._format = _format;
        this._token = _token;
        this._parseResults = this._program.getParseResults(this._fileUri);
        this._sourceMapper = this._program.getSourceMapper(this._fileUri, this._token, /* mapCompiled */ true);
    }
    getHover() {
        return convertHoverResults(this._getHoverResult(), this._format);
    }
    static getPrimaryDeclaration(declarations) {
        // In most cases, it's best to treat the first declaration as the
        // "primary". This works well for properties that have setters
        // which often have doc strings on the getter but not the setter.
        // The one case where using the first declaration doesn't work as
        // well is the case where an import statement within an __init__.py
        // file uses the form "from .A import A". In this case, if we use
        // the first declaration, it will show up as a module rather than
        // the imported symbol type.
        const primaryDeclaration = declarations[0];
        if (primaryDeclaration.type === 8 /* DeclarationType.Alias */ && declarations.length > 1) {
            return declarations[1];
        }
        else if (primaryDeclaration.type === 1 /* DeclarationType.Variable */ &&
            declarations.length > 1 &&
            primaryDeclaration.isDefinedBySlots) {
            // Slots cannot have docstrings, so pick the secondary.
            return declarations[1];
        }
        return primaryDeclaration;
    }
    get _evaluator() {
        return this._program.evaluator;
    }
    get _functionSignatureDisplay() {
        return this._program.configOptions.functionSignatureDisplay;
    }
    _getHoverResult() {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return null;
        }
        const offset = (0, positionUtils_1.convertPositionToOffset)(this._position, this._parseResults.tokenizerOutput.lines);
        if (offset === undefined) {
            return null;
        }
        const node = ParseTreeUtils.findNodeByOffset(this._parseResults.parserOutput.parseTree, offset);
        if (node === undefined) {
            return null;
        }
        const results = {
            parts: [],
            range: {
                start: (0, positionUtils_1.convertOffsetToPosition)(node.start, this._parseResults.tokenizerOutput.lines),
                end: (0, positionUtils_1.convertOffsetToPosition)(textRange_1.TextRange.getEnd(node), this._parseResults.tokenizerOutput.lines),
            },
        };
        if (node.nodeType === 38 /* ParseNodeType.Name */) {
            const declarations = this._evaluator.getDeclarationsForNameNode(node);
            if (declarations && declarations.length > 0) {
                const primaryDeclaration = HoverProvider.getPrimaryDeclaration(declarations);
                this._addResultsForDeclaration(results.parts, primaryDeclaration, node);
            }
            else if (!node.parent || node.parent.nodeType !== 37 /* ParseNodeType.ModuleName */) {
                // If we had no declaration, see if we can provide a minimal tooltip. We'll skip
                // this if it's part of a module name, since a module name part with no declaration
                // is a directory (a namespace package), and we don't want to provide any hover
                // information in that case.
                if (results.parts.length === 0) {
                    const type = this._getType(node);
                    let typeText;
                    if ((0, types_1.isModule)(type)) {
                        // Handle modules specially because submodules aren't associated with
                        // declarations, but we want them to be presented in the same way as
                        // the top-level module, which does have a declaration.
                        typeText = '(module) ' + node.value;
                    }
                    else {
                        let label = 'function';
                        let isProperty = false;
                        if ((0, typeUtils_1.isMaybeDescriptorInstance)(type, /* requireSetter */ false)) {
                            isProperty = true;
                            label = 'property';
                        }
                        typeText = (0, tooltipUtils_1.getToolTipForType)(type, label, node.value, this._evaluator, isProperty, this._functionSignatureDisplay);
                    }
                    this._addResultsPart(results.parts, typeText, /* python */ true);
                    this._addDocumentationPart(results.parts, node, /* resolvedDecl */ undefined);
                }
            }
        }
        else if (node.nodeType === 49 /* ParseNodeType.String */) {
            const type = (_a = this._evaluator.getExpectedType(node)) === null || _a === void 0 ? void 0 : _a.type;
            if (type !== undefined) {
                this._tryAddPartsForTypedDictKey(node, type, results.parts);
            }
        }
        return results.parts.length > 0 ? results : null;
    }
    _addResultsForDeclaration(parts, declaration, node) {
        var _a, _b, _c;
        const resolvedDecl = this._evaluator.resolveAliasDeclaration(declaration, /* resolveLocalNames */ true);
        if (!resolvedDecl || (0, declaration_1.isUnresolvedAliasDeclaration)(resolvedDecl)) {
            this._addResultsPart(parts, `(import) ` + node.value + this._getTypeText(node), /* python */ true);
            return;
        }
        switch (resolvedDecl.type) {
            case 0 /* DeclarationType.Intrinsic */: {
                this._addResultsPart(parts, node.value + this._getTypeText(node), /* python */ true);
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            case 1 /* DeclarationType.Variable */: {
                // If the named node is an aliased import symbol, we can't call
                // getType on the original name because it's not in the symbol
                // table. Instead, use the node from the resolved alias.
                let typeNode = node;
                if (declaration.node.nodeType === 24 /* ParseNodeType.ImportAs */ ||
                    declaration.node.nodeType === 26 /* ParseNodeType.ImportFromAs */) {
                    if (declaration.node.alias && node !== declaration.node.alias) {
                        if (resolvedDecl.node.nodeType === 38 /* ParseNodeType.Name */) {
                            typeNode = resolvedDecl.node;
                        }
                    }
                }
                else if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 1 /* ParseNodeType.Argument */ && node.parent.name === node) {
                    // If this is a named argument, we would normally have received a Parameter declaration
                    // rather than a variable declaration, but we can get here in the case of a dataclass.
                    // Replace the typeNode with the node of the variable declaration.
                    if (declaration.node.nodeType === 38 /* ParseNodeType.Name */) {
                        typeNode = declaration.node;
                    }
                }
                // Determine if this identifier is a type alias. If so, expand
                // the type alias when printing the type information.
                const type = this._getType(typeNode);
                const typeText = getVariableTypeText(this._evaluator, resolvedDecl, node.value, type, typeNode, this._functionSignatureDisplay);
                this._addResultsPart(parts, typeText, /* python */ true);
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            case 2 /* DeclarationType.Parameter */: {
                this._addResultsPart(parts, '(parameter) ' + node.value + this._getTypeText(node), /* python */ true);
                if (resolvedDecl.docString) {
                    this._addResultsPart(parts, resolvedDecl.docString);
                }
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            case 3 /* DeclarationType.TypeParameter */: {
                // If the user is hovering over a type parameter name in a class type parameter
                // list, display the computed variance of the type param.
                const typeParamListNode = ParseTreeUtils.getParentNodeOfType(node, 76 /* ParseNodeType.TypeParameterList */);
                const printTypeVarVariance = ((_b = typeParamListNode === null || typeParamListNode === void 0 ? void 0 : typeParamListNode.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 10 /* ParseNodeType.Class */;
                this._addResultsPart(parts, '(type parameter) ' + node.value + this._getTypeText(node, { printTypeVarVariance }), 
                /* python */ true);
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            case 6 /* DeclarationType.Class */:
            case 7 /* DeclarationType.SpecialBuiltInClass */: {
                if (this._addInitOrNewMethodInsteadIfCallNode(node, parts, resolvedDecl)) {
                    return;
                }
                const nameNode = resolvedDecl.type === 6 /* DeclarationType.Class */ ? resolvedDecl.node.name : node;
                this._addResultsPart(parts, '(class) ' + nameNode.value, /* python */ true);
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            case 5 /* DeclarationType.Function */: {
                let label = 'function';
                let isProperty = false;
                if (resolvedDecl.isMethod) {
                    const declaredType = (_c = this._evaluator.getTypeForDeclaration(resolvedDecl)) === null || _c === void 0 ? void 0 : _c.type;
                    isProperty = !!declaredType && (0, typeUtils_1.isMaybeDescriptorInstance)(declaredType, /* requireSetter */ false);
                    label = isProperty ? 'property' : 'method';
                }
                let type = this._getType(node);
                const resolvedType = this._getType(resolvedDecl.node.name);
                type = (0, types_1.isAnyOrUnknown)(type) ? resolvedType : type;
                const signatureString = (0, tooltipUtils_1.getToolTipForType)(type, label, node.value, this._evaluator, isProperty, this._functionSignatureDisplay);
                this._addResultsPart(parts, signatureString, /* python */ true);
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            case 8 /* DeclarationType.Alias */: {
                // First the 'module' header.
                this._addResultsPart(parts, '(module) ' + node.value, /* python */ true);
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            case 4 /* DeclarationType.TypeAlias */: {
                const type = (0, typeUtils_1.convertToInstance)(this._getType(node));
                const typeText = this._evaluator.printType(type, { expandTypeAlias: true });
                this._addResultsPart(parts, `(type) ${node.value} = ${typeText}`, /* python */ true);
                this._addDocumentationPart(parts, node, resolvedDecl);
                break;
            }
            default:
                (0, debug_1.assertNever)(resolvedDecl);
        }
    }
    _tryAddPartsForTypedDictKey(node, type, parts) {
        // If the expected type is a TypedDict and the current node is a key entry then we can provide a tooltip
        // with the type of the TypedDict key and its docstring, if available.
        (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
            var _a, _b;
            if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isTypedDictClass(subtype)) {
                const entry = (_a = subtype.details.typedDictEntries) === null || _a === void 0 ? void 0 : _a.knownItems.get(node.value);
                if (entry) {
                    // If we have already added parts for another declaration (e.g. for a union of TypedDicts that share the same key)
                    // then we need to add a separator to prevent a visual bug.
                    if (parts.length > 0) {
                        parts.push({ text: '\n\n---\n' });
                    }
                    // e.g. (key) name: str
                    const text = '(key) ' + node.value + ': ' + this._evaluator.printType(entry.valueType);
                    this._addResultsPart(parts, text, /* python */ true);
                    const declarations = (_b = types_1.ClassType.getSymbolTable(subtype).get(node.value)) === null || _b === void 0 ? void 0 : _b.getDeclarations();
                    if (declarations !== undefined && (declarations === null || declarations === void 0 ? void 0 : declarations.length) !== 0) {
                        // As we are just interested in the docString we don't have to worry about
                        // anything other than the first declaration. There also shouldn't be more
                        // than one declaration for a TypedDict key variable.
                        const declaration = declarations[0];
                        if (declaration.type === 1 /* DeclarationType.Variable */ && declaration.docString !== undefined) {
                            this._addDocumentationPartForType(parts, subtype, declaration);
                        }
                    }
                }
            }
        });
    }
    _addInitOrNewMethodInsteadIfCallNode(node, parts, declaration) {
        const result = (0, tooltipUtils_1.getClassAndConstructorTypes)(node, this._evaluator);
        if (!result) {
            return false;
        }
        if (result.methodType && ((0, types_1.isFunction)(result.methodType) || (0, types_1.isOverloadedFunction)(result.methodType))) {
            this._addResultsPart(parts, (0, tooltipUtils_1.getConstructorTooltip)(node.value, result.methodType, this._evaluator, this._functionSignatureDisplay), 
            /* python */ true);
            const addedDoc = this._addDocumentationPartForType(parts, result.methodType, declaration);
            if (!addedDoc) {
                this._addDocumentationPartForType(parts, result.classType, declaration);
            }
            return true;
        }
        return false;
    }
    _getType(node) {
        // It does common work necessary for hover for a type we got
        // from raw type evaluator.
        return (0, tooltipUtils_1.getTypeForToolTip)(this._evaluator, node);
    }
    _getTypeText(node, options) {
        const type = this._getType(node);
        return ': ' + this._evaluator.printType(type, options);
    }
    _addDocumentationPart(parts, node, resolvedDecl) {
        const type = this._getType(node);
        this._addDocumentationPartForType(parts, type, resolvedDecl, node.value);
    }
    _addDocumentationPartForType(parts, type, resolvedDecl, name) {
        const docString = (0, tooltipUtils_1.getDocumentationPartsForTypeAndDecl)(this._sourceMapper, type, resolvedDecl, this._evaluator, {
            name,
        });
        addDocumentationResultsPart(this._program.serviceProvider, docString, this._format, parts, resolvedDecl);
        return !!docString;
    }
    _addResultsPart(parts, text, python = false) {
        parts.push({
            python,
            text,
        });
    }
}
exports.HoverProvider = HoverProvider;
//# sourceMappingURL=hoverProvider.js.map