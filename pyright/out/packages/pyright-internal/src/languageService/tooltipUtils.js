"use strict";
/*
 * tooltipUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Helper functions for formatting text that can appear in hover text,
 * completion suggestions, etc.
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
exports.getTypeForToolTip = exports.limitOverloadBasedOnCall = exports.bindFunctionToClassOrObjectToolTip = exports.getClassAndConstructorTypes = exports.combineExpressionTypes = exports.getAutoImportText = exports.getDocumentationPartsForTypeAndDecl = exports.getOverloadedFunctionDocStringsFromType = exports.getFunctionDocStringFromType = exports.getConstructorTooltip = exports.getFunctionTooltip = exports.getOverloadedFunctionTooltip = exports.getToolTipForType = void 0;
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const typeDocStringUtils_1 = require("../analyzer/typeDocStringUtils");
const typeUtils_1 = require("../analyzer/typeUtils");
const types_1 = require("../analyzer/types");
const configOptions_1 = require("../common/configOptions");
const core_1 = require("../common/core");
// The number of spaces to indent each parameter, after moving to a newline in tooltips.
const functionParamIndentOffset = 4;
function getToolTipForType(type, label, name, evaluator, isProperty, functionSignatureDisplay) {
    let signatureString = '';
    if ((0, types_1.isOverloadedFunction)(type)) {
        signatureString = label.length > 0 ? `(${label})\n` : '';
        signatureString += `${getOverloadedFunctionTooltip(type, evaluator, functionSignatureDisplay)}`;
    }
    else if ((0, types_1.isFunction)(type)) {
        signatureString = `${getFunctionTooltip(label, name, type, evaluator, isProperty, functionSignatureDisplay)}`;
    }
    else {
        signatureString = label.length > 0 ? `(${label}) ` : '';
        signatureString += `${name}: ${evaluator.printType(type)}`;
    }
    return signatureString;
}
exports.getToolTipForType = getToolTipForType;
// 70 is vscode's default hover width size.
function getOverloadedFunctionTooltip(type, evaluator, functionSignatureDisplay, columnThreshold = 70) {
    let content = '';
    const overloads = types_1.OverloadedFunctionType.getOverloads(type).map((o) => getFunctionTooltip(
    /* label */ '', o.details.name, o, evaluator, 
    /* isProperty */ false, functionSignatureDisplay));
    for (let i = 0; i < overloads.length; i++) {
        if (i !== 0 && overloads[i].length > columnThreshold && overloads[i - 1].length <= columnThreshold) {
            content += '\n';
        }
        content += overloads[i] + `: ...`;
        if (i < overloads.length - 1) {
            content += '\n';
            if (overloads[i].length > columnThreshold) {
                content += '\n';
            }
        }
    }
    return content;
}
exports.getOverloadedFunctionTooltip = getOverloadedFunctionTooltip;
function getFunctionTooltip(label, functionName, type, evaluator, isProperty = false, functionSignatureDisplay) {
    const labelFormatted = label.length === 0 ? '' : `(${label}) `;
    const indentStr = functionSignatureDisplay === configOptions_1.SignatureDisplayType.formatted ? '\n' + ' '.repeat(functionParamIndentOffset) : '';
    const funcParts = evaluator.printFunctionParts(type);
    const paramSignature = `${formatSignature(funcParts, indentStr, functionSignatureDisplay)} -> ${funcParts[1]}`;
    if (types_1.TypeBase.isInstantiable(type)) {
        return `${labelFormatted}${functionName}: type[${paramSignature}]`;
    }
    const sep = isProperty ? ': ' : '';
    let defKeyword = '';
    if (!isProperty) {
        defKeyword = 'def ';
        if (types_1.FunctionType.isAsync(type)) {
            defKeyword = 'async ' + defKeyword;
        }
    }
    return `${labelFormatted}${defKeyword}${functionName}${sep}${paramSignature}`;
}
exports.getFunctionTooltip = getFunctionTooltip;
function getConstructorTooltip(constructorName, type, evaluator, functionSignatureDisplay) {
    const classText = `class `;
    let signature = '';
    if ((0, types_1.isOverloadedFunction)(type)) {
        const overloads = type.overloads.map((overload) => getConstructorTooltip(constructorName, overload, evaluator, functionSignatureDisplay));
        overloads.forEach((overload, index) => {
            signature += overload + ': ...' + '\n\n';
        });
    }
    else if ((0, types_1.isFunction)(type)) {
        const indentStr = functionSignatureDisplay === configOptions_1.SignatureDisplayType.formatted
            ? '\n' + ' '.repeat(functionParamIndentOffset)
            : ' ';
        const funcParts = evaluator.printFunctionParts(type);
        const paramSignature = formatSignature(funcParts, indentStr, functionSignatureDisplay);
        signature += `${classText}${constructorName}${paramSignature}`;
    }
    return signature;
}
exports.getConstructorTooltip = getConstructorTooltip;
// Only formats signature if there is more than one parameter
function formatSignature(funcParts, indentStr, functionSignatureDisplay) {
    return functionSignatureDisplay === configOptions_1.SignatureDisplayType.formatted &&
        funcParts.length > 0 &&
        funcParts[0].length > 1
        ? `(${indentStr}${funcParts[0].join(',' + indentStr)}\n)`
        : `(${funcParts[0].join(', ')})`;
}
function getFunctionDocStringFromType(type, sourceMapper, evaluator) {
    const decl = type.details.declaration;
    const enclosingClass = decl ? ParseTreeUtils.getEnclosingClass(decl.node) : undefined;
    const classResults = enclosingClass ? evaluator.getTypeOfClass(enclosingClass) : undefined;
    return (0, typeDocStringUtils_1.getFunctionDocStringInherited)(type, decl, sourceMapper, classResults === null || classResults === void 0 ? void 0 : classResults.classType);
}
exports.getFunctionDocStringFromType = getFunctionDocStringFromType;
function getOverloadedFunctionDocStringsFromType(type, sourceMapper, evaluator) {
    if (type.overloads.length === 0) {
        return [];
    }
    const decl = type.overloads[0].details.declaration;
    const enclosingClass = decl ? ParseTreeUtils.getEnclosingClass(decl.node) : undefined;
    const classResults = enclosingClass ? evaluator.getTypeOfClass(enclosingClass) : undefined;
    return (0, typeDocStringUtils_1.getOverloadedFunctionDocStringsInherited)(type, type.overloads.map((o) => o.details.declaration).filter(core_1.isDefined), sourceMapper, evaluator, classResults === null || classResults === void 0 ? void 0 : classResults.classType);
}
exports.getOverloadedFunctionDocStringsFromType = getOverloadedFunctionDocStringsFromType;
function getDocumentationPartForTypeAlias(sourceMapper, resolvedDecl, evaluator, symbol) {
    var _a;
    if (!resolvedDecl) {
        return undefined;
    }
    if (resolvedDecl.type === 4 /* DeclarationType.TypeAlias */) {
        return resolvedDecl.docString;
    }
    if (resolvedDecl.type === 1 /* DeclarationType.Variable */) {
        if (resolvedDecl.typeAliasName && resolvedDecl.docString) {
            return resolvedDecl.docString;
        }
        const decl = ((_a = symbol === null || symbol === void 0 ? void 0 : symbol.getDeclarations().find((d) => d.type === 1 /* DeclarationType.Variable */ && !!d.docString)) !== null && _a !== void 0 ? _a : resolvedDecl);
        const doc = (0, typeDocStringUtils_1.getVariableDocString)(decl, sourceMapper);
        if (doc) {
            return doc;
        }
    }
    if (resolvedDecl.type === 5 /* DeclarationType.Function */) {
        // @property functions
        const doc = (0, typeDocStringUtils_1.getPropertyDocStringInherited)(resolvedDecl, sourceMapper, evaluator);
        if (doc) {
            return doc;
        }
    }
    return undefined;
}
function getDocumentationPartForType(sourceMapper, type, resolvedDecl, evaluator, boundObjectOrClass) {
    if ((0, types_1.isModule)(type)) {
        const doc = (0, typeDocStringUtils_1.getModuleDocString)(type, resolvedDecl, sourceMapper);
        if (doc) {
            return doc;
        }
    }
    else if ((0, types_1.isInstantiableClass)(type)) {
        const doc = (0, typeDocStringUtils_1.getClassDocString)(type, resolvedDecl, sourceMapper);
        if (doc) {
            return doc;
        }
    }
    else if ((0, types_1.isFunction)(type)) {
        const functionType = boundObjectOrClass
            ? evaluator.bindFunctionToClassOrObject(boundObjectOrClass, type)
            : type;
        if (functionType && (0, types_1.isFunction)(functionType)) {
            const doc = getFunctionDocStringFromType(functionType, sourceMapper, evaluator);
            if (doc) {
                return doc;
            }
        }
    }
    else if ((0, types_1.isOverloadedFunction)(type)) {
        const functionType = boundObjectOrClass
            ? evaluator.bindFunctionToClassOrObject(boundObjectOrClass, type)
            : type;
        if (functionType && (0, types_1.isOverloadedFunction)(functionType)) {
            const doc = getOverloadedFunctionDocStringsFromType(functionType, sourceMapper, evaluator).find((d) => d);
            if (doc) {
                return doc;
            }
        }
    }
    return undefined;
}
function getDocumentationPartsForTypeAndDecl(sourceMapper, type, resolvedDecl, evaluator, optional) {
    var _a;
    // Get the alias first
    const aliasDoc = getDocumentationPartForTypeAlias(sourceMapper, resolvedDecl, evaluator, optional === null || optional === void 0 ? void 0 : optional.symbol);
    // Combine this with the type doc
    let typeDoc;
    if ((resolvedDecl === null || resolvedDecl === void 0 ? void 0 : resolvedDecl.type) === 8 /* DeclarationType.Alias */) {
        // Handle another alias decl special case.
        // ex) import X.Y
        //     [X].Y
        // Asking decl for X gives us "X.Y" rather than "X" since "X" is not actually a symbol.
        // We need to get corresponding module name to use special code in type eval for this case.
        if (resolvedDecl.type === 8 /* DeclarationType.Alias */ &&
            resolvedDecl.node &&
            resolvedDecl.node.nodeType === 24 /* ParseNodeType.ImportAs */ &&
            !!(optional === null || optional === void 0 ? void 0 : optional.name) &&
            !resolvedDecl.node.alias) {
            const name = resolvedDecl.node.module.nameParts.find((n) => n.value === optional.name);
            if (name) {
                const aliasDecls = (_a = evaluator.getDeclarationsForNameNode(name)) !== null && _a !== void 0 ? _a : [resolvedDecl];
                resolvedDecl = aliasDecls.length > 0 ? aliasDecls[0] : resolvedDecl;
            }
        }
        typeDoc = (0, typeDocStringUtils_1.getModuleDocStringFromUris)([resolvedDecl.uri], sourceMapper);
    }
    typeDoc =
        typeDoc !== null && typeDoc !== void 0 ? typeDoc : (type
            ? getDocumentationPartForType(sourceMapper, type, resolvedDecl, evaluator, optional === null || optional === void 0 ? void 0 : optional.boundObjectOrClass)
            : undefined);
    // Combine with a new line if they both exist
    return aliasDoc && typeDoc && aliasDoc !== typeDoc ? `${aliasDoc}\n\n${typeDoc}` : aliasDoc || typeDoc;
}
exports.getDocumentationPartsForTypeAndDecl = getDocumentationPartsForTypeAndDecl;
function getAutoImportText(name, from, alias) {
    let text;
    if (!from) {
        text = `import ${name}`;
    }
    else {
        text = `from ${from} import ${name}`;
    }
    if (alias) {
        text = `${text} as ${alias}`;
    }
    return text;
}
exports.getAutoImportText = getAutoImportText;
function combineExpressionTypes(typeNodes, evaluator) {
    const typeList = typeNodes.map((n) => evaluator.getType(n) || types_1.UnknownType.create());
    let result = (0, types_1.combineTypes)(typeList);
    // We're expecting a set of types, if there is only one and the outermost type is a list, take its inner type. This
    // is probably an expression that at runtime would turn into a list.
    if (typeList.length === 1 &&
        result.category === 6 /* TypeCategory.Class */ &&
        types_1.ClassType.isBuiltIn(result, 'list') &&
        result.typeArguments) {
        result = result.typeArguments[0];
    }
    else if (typeList.length === 1 &&
        result.category === 6 /* TypeCategory.Class */ &&
        types_1.ClassType.isBuiltIn(result, 'range')) {
        result = evaluator.getBuiltInObject(typeNodes[0], 'int');
    }
    return result;
}
exports.combineExpressionTypes = combineExpressionTypes;
function getClassAndConstructorTypes(node, evaluator) {
    var _a, _b;
    // If the class is used as part of a call (i.e. it is being
    // instantiated), include the constructor arguments within the
    // hover text.
    let callLeftNode = node;
    // Allow the left to be a member access chain (e.g. a.b.c) if the
    // node in question is the last item in the chain.
    if (((_a = callLeftNode === null || callLeftNode === void 0 ? void 0 : callLeftNode.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 35 /* ParseNodeType.MemberAccess */ && node === callLeftNode.parent.memberName) {
        callLeftNode = node.parent;
        // Allow the left to be a generic class constructor (e.g. foo[int]())
    }
    else if (((_b = callLeftNode === null || callLeftNode === void 0 ? void 0 : callLeftNode.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 27 /* ParseNodeType.Index */) {
        callLeftNode = node.parent;
    }
    if (!callLeftNode ||
        !callLeftNode.parent ||
        callLeftNode.parent.nodeType !== 9 /* ParseNodeType.Call */ ||
        callLeftNode.parent.leftExpression !== callLeftNode) {
        return;
    }
    // Get the init method for this class.
    const classType = getTypeForToolTip(evaluator, node);
    if (!(0, types_1.isInstantiableClass)(classType)) {
        return;
    }
    const instanceType = getTypeForToolTip(evaluator, callLeftNode.parent);
    if (!(0, types_1.isClassInstance)(instanceType)) {
        return;
    }
    let methodType;
    // Try to get the `__init__` method first because it typically has more type information than `__new__`.
    // Don't exclude `object.__init__` since in the plain case we want to show Foo().
    const initMember = (0, typeUtils_1.lookUpClassMember)(classType, '__init__', 16 /* MemberAccessFlags.SkipInstanceMembers */);
    if (initMember) {
        const functionType = evaluator.getTypeOfMember(initMember);
        if ((0, types_1.isFunction)(functionType) || (0, types_1.isOverloadedFunction)(functionType)) {
            methodType = bindFunctionToClassOrObjectToolTip(evaluator, node, instanceType, functionType);
        }
    }
    // If there was no `__init__`, excluding `object` class `__init__`, or if `__init__` only had default params (*args: Any, **kwargs: Any) or no params (),
    // see if we can find a better `__new__` method.
    if (!methodType ||
        (methodType &&
            (0, types_1.isFunction)(methodType) &&
            (types_1.FunctionType.hasDefaultParameters(methodType) || methodType.details.parameters.length === 0))) {
        const newMember = (0, typeUtils_1.lookUpClassMember)(classType, '__new__', 4 /* MemberAccessFlags.SkipObjectBaseClass */ | 16 /* MemberAccessFlags.SkipInstanceMembers */);
        if (newMember) {
            const newMemberType = evaluator.getTypeOfMember(newMember);
            // Prefer `__new__` if it doesn't have default params (*args: Any, **kwargs: Any) or no params ().
            if ((0, types_1.isFunction)(newMemberType) || (0, types_1.isOverloadedFunction)(newMemberType)) {
                // Set `treatConstructorAsClassMethod` to true to exclude `cls` as a parameter.
                methodType = bindFunctionToClassOrObjectToolTip(evaluator, node, instanceType, newMemberType, 
                /* treatConstructorAsClassMethod */ true);
            }
        }
    }
    return { methodType, classType };
}
exports.getClassAndConstructorTypes = getClassAndConstructorTypes;
function bindFunctionToClassOrObjectToolTip(evaluator, node, baseType, memberType, treatConstructorAsClassMethod) {
    const methodType = evaluator.bindFunctionToClassOrObject(baseType, memberType, 
    /* memberClass */ undefined, treatConstructorAsClassMethod);
    if (!methodType) {
        return undefined;
    }
    return limitOverloadBasedOnCall(evaluator, methodType, node);
}
exports.bindFunctionToClassOrObjectToolTip = bindFunctionToClassOrObjectToolTip;
function limitOverloadBasedOnCall(evaluator, type, node) {
    // If it's an overloaded function, see if it's part of a call expression.
    // If so, we may be able to eliminate some of the overloads based on
    // the overload resolution.
    if (!(0, types_1.isOverloadedFunction)(type) || node.nodeType !== 38 /* ParseNodeType.Name */) {
        return type;
    }
    const callNode = ParseTreeUtils.getCallForName(node);
    if (!callNode) {
        return type;
    }
    const callTypeResult = evaluator.getTypeResult(callNode);
    if (!callTypeResult || !callTypeResult.overloadsUsedForCall || callTypeResult.overloadsUsedForCall.length === 0) {
        return type;
    }
    if (callTypeResult.overloadsUsedForCall.length === 1) {
        return callTypeResult.overloadsUsedForCall[0];
    }
    return types_1.OverloadedFunctionType.create(callTypeResult.overloadsUsedForCall);
}
exports.limitOverloadBasedOnCall = limitOverloadBasedOnCall;
function getTypeForToolTip(evaluator, node) {
    var _a;
    // It does common work necessary for hover for a type we got
    // from raw type evaluator.
    const type = (_a = evaluator.getType(node)) !== null && _a !== void 0 ? _a : types_1.UnknownType.create();
    return limitOverloadBasedOnCall(evaluator, type, node);
}
exports.getTypeForToolTip = getTypeForToolTip;
//# sourceMappingURL=tooltipUtils.js.map