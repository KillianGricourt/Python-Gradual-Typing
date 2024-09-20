"use strict";
/*
 * typePrinter.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Converts a type into a string representation.
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
exports.printLiteralValue = exports.printLiteralValueTruncated = exports.isLiteralValueTruncated = exports.printObjectTypeForClass = exports.printFunctionParts = exports.printType = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const debug_1 = require("../common/debug");
const parameterUtils_1 = require("./parameterUtils");
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
const singleTickRegEx = /'/g;
const escapedDoubleQuoteRegEx = /\\"/g;
function printType(type, printTypeFlags, returnTypeCallback) {
    const uniqueNameMap = new UniqueNameMap(printTypeFlags, returnTypeCallback);
    uniqueNameMap.build(type);
    return printTypeInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, [], 0);
}
exports.printType = printType;
function printFunctionParts(type, printTypeFlags, returnTypeCallback) {
    const uniqueNameMap = new UniqueNameMap(printTypeFlags, returnTypeCallback);
    uniqueNameMap.build(type);
    return printFunctionPartsInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, [], 0);
}
exports.printFunctionParts = printFunctionParts;
function printObjectTypeForClass(type, printTypeFlags, returnTypeCallback) {
    const uniqueNameMap = new UniqueNameMap(printTypeFlags, returnTypeCallback);
    uniqueNameMap.build(type);
    return printObjectTypeForClassInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, [], 0);
}
exports.printObjectTypeForClass = printObjectTypeForClass;
const maxLiteralStringLength = 50;
function isLiteralValueTruncated(type) {
    if (typeof type.literalValue === 'string') {
        if (type.literalValue.length > maxLiteralStringLength) {
            return true;
        }
    }
    return false;
}
exports.isLiteralValueTruncated = isLiteralValueTruncated;
function printLiteralValueTruncated(type) {
    if (type.details.name === 'bytes') {
        return 'bytes';
    }
    (0, debug_1.assert)(type.details.name === 'str');
    return 'LiteralString';
}
exports.printLiteralValueTruncated = printLiteralValueTruncated;
function printLiteralValue(type, quotation = "'") {
    const literalValue = type.literalValue;
    if (literalValue === undefined) {
        return '';
    }
    let literalStr;
    if (typeof literalValue === 'string') {
        let effectiveLiteralValue = literalValue;
        // Limit the length of the string literal.
        if (literalValue.length > maxLiteralStringLength) {
            effectiveLiteralValue = literalValue.substring(0, maxLiteralStringLength) + '…';
        }
        if (type.details.name === 'bytes') {
            let bytesString = '';
            // There's no good built-in conversion routine in javascript to convert
            // bytes strings. Determine on a character-by-character basis whether
            // it can be rendered into an ASCII character. If not, use an escape.
            for (let i = 0; i < effectiveLiteralValue.length; i++) {
                const char = effectiveLiteralValue.substring(i, i + 1);
                const charCode = char.charCodeAt(0);
                if (charCode >= 20 && charCode <= 126) {
                    if (charCode === 34) {
                        bytesString += '\\' + char;
                    }
                    else {
                        bytesString += char;
                    }
                }
                else {
                    bytesString += `\\x${((charCode >> 4) & 0xf).toString(16)}${(charCode & 0xf).toString(16)}`;
                }
            }
            literalStr = `b"${bytesString}"`;
        }
        else {
            // JSON.stringify will perform proper escaping for " case.
            // So, we only need to do our own escaping for ' case.
            literalStr = JSON.stringify(effectiveLiteralValue).toString();
            if (quotation !== '"') {
                literalStr = `'${literalStr
                    .substring(1, literalStr.length - 1)
                    .replace(escapedDoubleQuoteRegEx, '"')
                    .replace(singleTickRegEx, "\\'")}'`; // CodeQL [SM02383] Code ql is just wrong here. We don't need to replace backslashes.
            }
        }
    }
    else if (typeof literalValue === 'boolean') {
        literalStr = literalValue ? 'True' : 'False';
    }
    else if (literalValue instanceof types_1.EnumLiteral) {
        literalStr = `${literalValue.className}.${literalValue.itemName}`;
    }
    else if (typeof literalValue === 'bigint') {
        literalStr = literalValue.toString();
        if (literalStr.endsWith('n')) {
            literalStr = literalStr.substring(0, literalStr.length - 1);
        }
    }
    else {
        literalStr = literalValue.toString();
    }
    return literalStr;
}
exports.printLiteralValue = printLiteralValue;
function printTypeInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount) {
    const originalPrintTypeFlags = printTypeFlags;
    const parenthesizeUnion = (printTypeFlags & 16 /* PrintTypeFlags.ParenthesizeUnion */) !== 0;
    printTypeFlags &= ~(16 /* PrintTypeFlags.ParenthesizeUnion */ | 128 /* PrintTypeFlags.ParenthesizeCallable */);
    if (recursionCount > types_1.maxTypeRecursionCount) {
        if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
            return 'Any';
        }
        return '<Recursive>';
    }
    recursionCount++;
    // If this is a type alias, see if we should use its name rather than
    // the type it represents.
    if (type.typeAliasInfo) {
        let expandTypeAlias = true;
        if ((printTypeFlags & 32 /* PrintTypeFlags.ExpandTypeAlias */) === 0) {
            expandTypeAlias = false;
        }
        else {
            if (recursionTypes.find((t) => t === type)) {
                expandTypeAlias = false;
            }
        }
        if (!expandTypeAlias) {
            try {
                recursionTypes.push(type);
                let aliasName = (printTypeFlags & 4096 /* PrintTypeFlags.UseFullyQualifiedNames */) !== 0
                    ? type.typeAliasInfo.fullName
                    : type.typeAliasInfo.name;
                // Use the fully-qualified name if the name isn't unique.
                if (!uniqueNameMap.isUnique(aliasName)) {
                    aliasName = type.typeAliasInfo.fullName;
                }
                const typeParams = type.typeAliasInfo.typeParameters;
                if (typeParams && typeParams.length > 0) {
                    let argumentStrings;
                    // If there is a type arguments array, it's a specialized type alias.
                    if (type.typeAliasInfo.typeArguments) {
                        if ((printTypeFlags & 2 /* PrintTypeFlags.OmitTypeArgumentsIfUnknown */) === 0 ||
                            type.typeAliasInfo.typeArguments.some((typeArg) => !(0, types_1.isUnknown)(typeArg))) {
                            argumentStrings = [];
                            type.typeAliasInfo.typeArguments.forEach((typeArg, index) => {
                                // Which type parameter does this map to?
                                const typeParam = index < typeParams.length ? typeParams[index] : typeParams[typeParams.length - 1];
                                // If this type argument maps to a variadic type parameter, unpack it.
                                if ((0, types_1.isVariadicTypeVar)(typeParam) &&
                                    (0, types_1.isClassInstance)(typeArg) &&
                                    (0, typeUtils_1.isTupleClass)(typeArg) &&
                                    typeArg.tupleTypeArguments &&
                                    typeArg.tupleTypeArguments.every((typeArg) => !typeArg.isUnbounded)) {
                                    typeArg.tupleTypeArguments.forEach((tupleTypeArg) => {
                                        argumentStrings.push(printTypeInternal(tupleTypeArg.type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount));
                                    });
                                }
                                else {
                                    argumentStrings.push(printTypeInternal(typeArg, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount));
                                }
                            });
                        }
                    }
                    else {
                        if ((printTypeFlags & 2 /* PrintTypeFlags.OmitTypeArgumentsIfUnknown */) === 0 ||
                            typeParams.some((typeParam) => !(0, types_1.isUnknown)(typeParam))) {
                            argumentStrings = [];
                            typeParams.forEach((typeParam) => {
                                argumentStrings.push(printTypeInternal(typeParam, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount));
                            });
                        }
                    }
                    if (argumentStrings) {
                        if (argumentStrings.length === 0) {
                            aliasName += `[()]`;
                        }
                        else {
                            aliasName += `[${argumentStrings.join(', ')}]`;
                        }
                    }
                }
                // If it's a TypeVar, don't use the alias name. Instead, use the full
                // name, which may have a scope associated with it.
                if (type.category !== 9 /* TypeCategory.TypeVar */) {
                    return aliasName;
                }
            }
            finally {
                recursionTypes.pop();
            }
        }
    }
    if (recursionTypes.find((t) => {
        var _a;
        return t === type ||
            (t.typeAliasInfo !== undefined && t.typeAliasInfo.fullName === ((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.fullName));
    }) ||
        recursionTypes.length > types_1.maxTypeRecursionCount) {
        // If this is a recursive TypeVar, we've already expanded it once, so
        // just print its name at this point.
        if ((0, types_1.isTypeVar)(type) && type.details.isSynthesized && type.details.recursiveTypeAliasName) {
            return type.details.recursiveTypeAliasName;
        }
        if (type.typeAliasInfo) {
            if (!type.typeAliasInfo.typeParameters) {
                let name = (printTypeFlags & 4096 /* PrintTypeFlags.UseFullyQualifiedNames */) !== 0
                    ? type.typeAliasInfo.fullName
                    : type.typeAliasInfo.name;
                if (!uniqueNameMap.isUnique(name)) {
                    name = type.typeAliasInfo.fullName;
                }
                return name;
            }
            try {
                recursionTypes.push(type);
                return printTypeInternal(type, printTypeFlags & ~32 /* PrintTypeFlags.ExpandTypeAlias */, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
            }
            finally {
                recursionTypes.pop();
            }
        }
        return '...';
    }
    try {
        recursionTypes.push(type);
        const includeConditionalIndicator = (printTypeFlags & (64 /* PrintTypeFlags.OmitConditionalConstraint */ | 256 /* PrintTypeFlags.PythonSyntax */)) === 0;
        const getConditionalIndicator = (subtype) => {
            return subtype.condition !== undefined && includeConditionalIndicator ? '*' : '';
        };
        switch (type.category) {
            case 0 /* TypeCategory.Unbound */: {
                if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
                    return 'Any';
                }
                return 'Unbound';
            }
            case 1 /* TypeCategory.Unknown */: {
                if (printTypeFlags & (256 /* PrintTypeFlags.PythonSyntax */ | 1 /* PrintTypeFlags.PrintUnknownWithAny */)) {
                    return 'Any';
                }
                return 'Unknown';
            }
            case 7 /* TypeCategory.Module */: {
                if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
                    return 'Any';
                }
                return `Module("${type.moduleName}")`;
            }
            case 6 /* TypeCategory.Class */: {
                if (types_1.TypeBase.isInstance(type)) {
                    if (type.literalValue !== undefined) {
                        if (isLiteralValueTruncated(type) && (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) !== 0) {
                            return printLiteralValueTruncated(type);
                        }
                        else {
                            return `Literal[${printLiteralValue(type)}]`;
                        }
                    }
                    return `${printObjectTypeForClassInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount)}${getConditionalIndicator(type)}`;
                }
                else {
                    let typeToWrap;
                    if (type.literalValue !== undefined) {
                        if (isLiteralValueTruncated(type) && (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) !== 0) {
                            typeToWrap = printLiteralValueTruncated(type);
                        }
                        else {
                            typeToWrap = `Literal[${printLiteralValue(type)}]`;
                        }
                    }
                    else {
                        if (type.specialForm) {
                            return printTypeInternal(type.specialForm, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                        }
                        typeToWrap = printObjectTypeForClassInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                    }
                    return `${_printNestedInstantiable(type, typeToWrap)}${getConditionalIndicator(type)}`;
                }
            }
            case 4 /* TypeCategory.Function */: {
                if (types_1.TypeBase.isInstantiable(type)) {
                    const typeString = printFunctionType(types_1.FunctionType.cloneAsInstance(type), printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                    return `type[${typeString}]`;
                }
                return printFunctionType(type, originalPrintTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
            }
            case 5 /* TypeCategory.OverloadedFunction */: {
                const overloads = types_1.OverloadedFunctionType.getOverloads(type).map((overload) => printTypeInternal(overload, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount));
                if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
                    return 'Callable[..., Any]';
                }
                if (overloads.length === 1) {
                    return overloads[0];
                }
                return `Overload[${overloads.join(', ')}]`;
            }
            case 8 /* TypeCategory.Union */: {
                // If this is a value expression that evaluates to a union type but is
                // not a type alias, simply print the special form ("UnionType").
                if (types_1.TypeBase.isInstantiable(type) && type.specialForm && !type.typeAliasInfo) {
                    return printTypeInternal(type.specialForm, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                }
                // Allocate a set that refers to subtypes in the union by
                // their indices. If the index is within the set, it is already
                // accounted for in the output.
                const subtypeHandledSet = new Set();
                // Allocate another set that represents the textual representations
                // of the subtypes in the union.
                const subtypeStrings = new Set();
                // If we're using "|" notation, enclose callable subtypes in parens.
                const updatedPrintTypeFlags = printTypeFlags & 8 /* PrintTypeFlags.PEP604 */
                    ? printTypeFlags | 128 /* PrintTypeFlags.ParenthesizeCallable */
                    : printTypeFlags;
                // Start by matching possible type aliases to the subtypes.
                if ((printTypeFlags & 32 /* PrintTypeFlags.ExpandTypeAlias */) === 0 && type.typeAliasSources) {
                    for (const typeAliasSource of type.typeAliasSources) {
                        let matchedAllSubtypes = true;
                        let allSubtypesPreviouslyHandled = true;
                        const indicesCoveredByTypeAlias = new Set();
                        for (const sourceSubtype of typeAliasSource.subtypes) {
                            let unionSubtypeIndex = 0;
                            let foundMatch = false;
                            const sourceSubtypeInstance = (0, typeUtils_1.convertToInstance)(sourceSubtype);
                            for (const unionSubtype of type.subtypes) {
                                if ((0, types_1.isTypeSame)(sourceSubtypeInstance, unionSubtype)) {
                                    if (!subtypeHandledSet.has(unionSubtypeIndex)) {
                                        allSubtypesPreviouslyHandled = false;
                                    }
                                    indicesCoveredByTypeAlias.add(unionSubtypeIndex);
                                    foundMatch = true;
                                    break;
                                }
                                unionSubtypeIndex++;
                            }
                            if (!foundMatch) {
                                matchedAllSubtypes = false;
                                break;
                            }
                        }
                        if (matchedAllSubtypes && !allSubtypesPreviouslyHandled) {
                            subtypeStrings.add(printTypeInternal(typeAliasSource, updatedPrintTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount));
                            indicesCoveredByTypeAlias.forEach((index) => subtypeHandledSet.add(index));
                        }
                    }
                }
                const noneIndex = type.subtypes.findIndex((subtype) => (0, typeUtils_1.isNoneInstance)(subtype));
                if (noneIndex >= 0 && !subtypeHandledSet.has(noneIndex)) {
                    const typeWithoutNone = (0, typeUtils_1.removeNoneFromUnion)(type);
                    if ((0, types_1.isNever)(typeWithoutNone)) {
                        return 'None';
                    }
                    const optionalType = printTypeInternal(typeWithoutNone, updatedPrintTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                    if (printTypeFlags & 8 /* PrintTypeFlags.PEP604 */) {
                        const unionString = optionalType + ' | None';
                        if (parenthesizeUnion) {
                            return `(${unionString})`;
                        }
                        return unionString;
                    }
                    return 'Optional[' + optionalType + ']';
                }
                const literalObjectStrings = new Set();
                const literalClassStrings = new Set();
                (0, typeUtils_1.doForEachSubtype)(type, (subtype, index) => {
                    if (!subtypeHandledSet.has(index)) {
                        if ((0, types_1.isClassInstance)(subtype) && subtype.literalValue !== undefined) {
                            if (isLiteralValueTruncated(subtype) &&
                                (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) !== 0) {
                                subtypeStrings.add(printLiteralValueTruncated(subtype));
                            }
                            else {
                                literalObjectStrings.add(printLiteralValue(subtype));
                            }
                        }
                        else if ((0, types_1.isInstantiableClass)(subtype) && subtype.literalValue !== undefined) {
                            if (isLiteralValueTruncated(subtype) &&
                                (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) !== 0) {
                                subtypeStrings.add(`type[${printLiteralValueTruncated(subtype)}]`);
                            }
                            else {
                                literalClassStrings.add(printLiteralValue(subtype));
                            }
                        }
                        else {
                            subtypeStrings.add(printTypeInternal(subtype, updatedPrintTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount));
                        }
                    }
                });
                const dedupedSubtypeStrings = [];
                subtypeStrings.forEach((s) => dedupedSubtypeStrings.push(s));
                if (literalObjectStrings.size > 0) {
                    const literalStrings = [];
                    literalObjectStrings.forEach((s) => literalStrings.push(s));
                    dedupedSubtypeStrings.push(`Literal[${literalStrings.join(', ')}]`);
                }
                if (literalClassStrings.size > 0) {
                    const literalStrings = [];
                    literalClassStrings.forEach((s) => literalStrings.push(s));
                    dedupedSubtypeStrings.push(`type[Literal[${literalStrings.join(', ')}]]`);
                }
                if (dedupedSubtypeStrings.length === 1) {
                    return dedupedSubtypeStrings[0];
                }
                if (printTypeFlags & 8 /* PrintTypeFlags.PEP604 */) {
                    const unionString = dedupedSubtypeStrings.join(' | ');
                    if (parenthesizeUnion) {
                        return `(${unionString})`;
                    }
                    return unionString;
                }
                return `Union[${dedupedSubtypeStrings.join(', ')}]`;
            }
            case 9 /* TypeCategory.TypeVar */: {
                // If it's synthesized, don't expose the internal name we generated.
                // This will confuse users. The exception is if it's a bound synthesized
                // type, in which case we'll print the bound type. This is used for
                // "self" and "cls" parameters.
                if (type.details.isSynthesized) {
                    // If it's a synthesized type var used to implement recursive type
                    // aliases, return the type alias name.
                    if (type.details.recursiveTypeAliasName) {
                        if ((printTypeFlags & 32 /* PrintTypeFlags.ExpandTypeAlias */) !== 0 && type.details.boundType) {
                            return printTypeInternal(types_1.TypeBase.isInstance(type)
                                ? (0, typeUtils_1.convertToInstance)(type.details.boundType)
                                : type.details.boundType, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                        }
                        return type.details.recursiveTypeAliasName;
                    }
                    // If it's a synthesized type var used to implement `self` or `cls` types,
                    // print the type with a special character that indicates that the type
                    // is internally represented as a TypeVar.
                    if (type.details.isSynthesizedSelf && type.details.boundType) {
                        let boundTypeString = printTypeInternal(type.details.boundType, printTypeFlags & ~32 /* PrintTypeFlags.ExpandTypeAlias */, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                        if (!(0, types_1.isAnyOrUnknown)(type.details.boundType)) {
                            if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
                                boundTypeString = `Self`;
                            }
                            else {
                                boundTypeString = `Self@${boundTypeString}`;
                            }
                        }
                        if (types_1.TypeBase.isInstantiable(type)) {
                            return `${_printNestedInstantiable(type, boundTypeString)}`;
                        }
                        return boundTypeString;
                    }
                    return (printTypeFlags & (1 /* PrintTypeFlags.PrintUnknownWithAny */ | 256 /* PrintTypeFlags.PythonSyntax */)) !== 0
                        ? 'Any'
                        : 'Unknown';
                }
                if (type.details.isParamSpec) {
                    const paramSpecText = _getReadableTypeVarName(type, (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) !== 0);
                    if (type.paramSpecAccess) {
                        return `${paramSpecText}.${type.paramSpecAccess}`;
                    }
                    return paramSpecText;
                }
                let typeVarName = _getReadableTypeVarName(type, (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) !== 0);
                if (type.isVariadicUnpacked) {
                    typeVarName = _printUnpack(typeVarName, printTypeFlags);
                }
                if (type.isVariadicInUnion) {
                    typeVarName = `Union[${typeVarName}]`;
                }
                if (types_1.TypeBase.isInstantiable(type)) {
                    typeVarName = `${_printNestedInstantiable(type, typeVarName)}`;
                }
                if (!type.details.isVariadic && (printTypeFlags & 2048 /* PrintTypeFlags.PrintTypeVarVariance */) !== 0) {
                    const varianceText = _getTypeVarVarianceText(type);
                    if (varianceText) {
                        typeVarName = `${typeVarName} (${varianceText})`;
                    }
                }
                return typeVarName;
            }
            case 3 /* TypeCategory.Never */: {
                return type.isNoReturn ? 'NoReturn' : 'Never';
            }
            case 2 /* TypeCategory.Any */: {
                const anyType = type;
                return anyType.isEllipsis ? '...' : 'Any';
            }
        }
        return '';
    }
    finally {
        recursionTypes.pop();
    }
}
function printFunctionType(type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount) {
    if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
        const paramSpec = types_1.FunctionType.getParamSpecFromArgsKwargs(type);
        const typeWithoutParamSpec = paramSpec ? types_1.FunctionType.cloneRemoveParamSpecArgsKwargs(type) : type;
        // Callable works only in cases where all parameters are positional-only.
        let isPositionalParamsOnly = false;
        if (typeWithoutParamSpec.details.parameters.length === 0) {
            isPositionalParamsOnly = true;
        }
        else {
            if (typeWithoutParamSpec.details.parameters.every((param) => param.category === 0 /* ParameterCategory.Simple */)) {
                const lastParam = typeWithoutParamSpec.details.parameters[typeWithoutParamSpec.details.parameters.length - 1];
                if (!lastParam.name) {
                    isPositionalParamsOnly = true;
                }
            }
        }
        const returnType = returnTypeCallback(typeWithoutParamSpec);
        let returnTypeString = 'Any';
        if (returnType) {
            returnTypeString = printTypeInternal(returnType, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
        }
        if (isPositionalParamsOnly) {
            const paramTypes = [];
            typeWithoutParamSpec.details.parameters.forEach((param, index) => {
                if (param.name) {
                    const paramType = types_1.FunctionType.getEffectiveParameterType(typeWithoutParamSpec, index);
                    if (recursionTypes.length < types_1.maxTypeRecursionCount) {
                        paramTypes.push(printTypeInternal(paramType, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount));
                    }
                    else {
                        paramTypes.push('Any');
                    }
                }
            });
            if (paramSpec) {
                if (paramTypes.length > 0) {
                    return `Callable[Concatenate[${paramTypes.join(', ')}, ${paramSpec.details.name}], ${returnTypeString}]`;
                }
                return `Callable[${paramSpec.details.name}, ${returnTypeString}]`;
            }
            return `Callable[[${paramTypes.join(', ')}], ${returnTypeString}]`;
        }
        else {
            // We can't represent this type using a Callable so default to
            // a "catch all" Callable.
            return `Callable[..., ${returnTypeString}]`;
        }
    }
    else {
        const parts = printFunctionPartsInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
        const paramSignature = `(${parts[0].join(', ')})`;
        if (types_1.FunctionType.isParamSpecValue(type)) {
            if (parts[0].length === 1 && parts[0][0] === '...') {
                return parts[0][0];
            }
            return paramSignature;
        }
        const fullSignature = `${paramSignature} -> ${parts[1]}`;
        const parenthesizeCallable = (printTypeFlags & 128 /* PrintTypeFlags.ParenthesizeCallable */) !== 0;
        if (parenthesizeCallable) {
            return `(${fullSignature})`;
        }
        return fullSignature;
    }
}
function printObjectTypeForClassInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount) {
    var _a, _b;
    let objName = type.aliasName;
    if (!objName) {
        objName =
            (printTypeFlags & 4096 /* PrintTypeFlags.UseFullyQualifiedNames */) !== 0 ? type.details.fullName : type.details.name;
    }
    // Special-case NoneType to convert it to None.
    if (types_1.ClassType.isBuiltIn(type, 'NoneType')) {
        objName = 'None';
    }
    // Use the fully-qualified name if the name isn't unique.
    if (!uniqueNameMap.isUnique(objName)) {
        objName = type.details.fullName;
    }
    // If this is a pseudo-generic class, don't display the type arguments
    // or type parameters because it will confuse users.
    if (!types_1.ClassType.isPseudoGenericClass(type)) {
        const typeParams = types_1.ClassType.getTypeParameters(type);
        const lastTypeParam = typeParams.length > 0 ? typeParams[typeParams.length - 1] : undefined;
        const isVariadic = lastTypeParam ? lastTypeParam.details.isVariadic : false;
        // If there is a type arguments array, it's a specialized class.
        const typeArgs = (_a = type.tupleTypeArguments) !== null && _a !== void 0 ? _a : (_b = type.typeArguments) === null || _b === void 0 ? void 0 : _b.map((t) => {
            return { type: t, isUnbounded: false };
        });
        if (typeArgs) {
            // Handle Tuple[()] as a special case.
            if (typeArgs.length > 0) {
                const typeArgStrings = [];
                let isAllUnknown = true;
                typeArgs.forEach((typeArg, index) => {
                    const typeParam = index < typeParams.length ? typeParams[index] : undefined;
                    if (typeParam &&
                        typeParam.details.isVariadic &&
                        (0, types_1.isClassInstance)(typeArg.type) &&
                        types_1.ClassType.isBuiltIn(typeArg.type, 'tuple') &&
                        typeArg.type.tupleTypeArguments) {
                        // Expand the tuple type that maps to the variadic type parameter.
                        if (typeArg.type.tupleTypeArguments.length === 0) {
                            if (!(0, types_1.isUnknown)(typeArg.type)) {
                                isAllUnknown = false;
                            }
                            if (index === 0) {
                                typeArgStrings.push(_printUnpack('tuple[()]', printTypeFlags));
                            }
                        }
                        else {
                            (0, collectionUtils_1.appendArray)(typeArgStrings, typeArg.type.tupleTypeArguments.map((typeArg) => {
                                if (!(0, types_1.isUnknown)(typeArg.type)) {
                                    isAllUnknown = false;
                                }
                                const typeArgText = printTypeInternal(typeArg.type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                                if (typeArg.isUnbounded) {
                                    return _printUnpack(`tuple[${typeArgText}, ...]`, printTypeFlags);
                                }
                                return typeArgText;
                            }));
                        }
                    }
                    else {
                        if (!(0, types_1.isUnknown)(typeArg.type)) {
                            isAllUnknown = false;
                        }
                        const typeArgTypeText = printTypeInternal(typeArg.type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                        if (typeArg.isUnbounded) {
                            if (typeArgs.length === 1) {
                                typeArgStrings.push(typeArgTypeText, '...');
                            }
                            else {
                                typeArgStrings.push(_printUnpack(`tuple[${typeArgTypeText}, ...]`, printTypeFlags));
                            }
                        }
                        else {
                            typeArgStrings.push(typeArgTypeText);
                        }
                    }
                });
                if (type.isUnpacked) {
                    objName = _printUnpack(objName, printTypeFlags);
                }
                if ((printTypeFlags & 2 /* PrintTypeFlags.OmitTypeArgumentsIfUnknown */) === 0 || !isAllUnknown) {
                    objName += '[' + typeArgStrings.join(', ') + ']';
                }
            }
            else {
                if (type.isUnpacked) {
                    objName = _printUnpack(objName, printTypeFlags);
                }
                if (types_1.ClassType.isTupleClass(type) || isVariadic) {
                    objName += '[()]';
                }
            }
        }
        else {
            if (type.isUnpacked) {
                objName = _printUnpack(objName, printTypeFlags);
            }
            if (typeParams.length > 0) {
                if ((printTypeFlags & 2 /* PrintTypeFlags.OmitTypeArgumentsIfUnknown */) === 0 ||
                    typeParams.some((typeParam) => !(0, types_1.isUnknown)(typeParam))) {
                    objName +=
                        '[' +
                            typeParams
                                .map((typeParam) => {
                                return printTypeInternal(typeParam, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                            })
                                .join(', ') +
                            ']';
                }
            }
        }
    }
    // Wrap in a "Partial" for TypedDict that has been synthesized as partial.
    if (type.isTypedDictPartial) {
        if ((printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) === 0) {
            objName = `Partial[${objName}]`;
        }
    }
    return objName;
}
function printFunctionPartsInternal(type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount) {
    const paramTypeStrings = [];
    let sawDefinedName = false;
    // Remove the (*args: P.args, **kwargs: P.kwargs) from the end of the parameter list.
    const paramSpec = types_1.FunctionType.getParamSpecFromArgsKwargs(type);
    if (paramSpec) {
        type = types_1.FunctionType.cloneRemoveParamSpecArgsKwargs(type);
    }
    type.details.parameters.forEach((param, index) => {
        // Handle specialized variadic type parameters specially.
        if (index === type.details.parameters.length - 1 &&
            param.category === 1 /* ParameterCategory.ArgsList */ &&
            (0, types_1.isVariadicTypeVar)(param.type)) {
            const specializedParamType = types_1.FunctionType.getEffectiveParameterType(type, index);
            if ((0, types_1.isClassInstance)(specializedParamType) &&
                types_1.ClassType.isBuiltIn(specializedParamType, 'tuple') &&
                specializedParamType.tupleTypeArguments) {
                specializedParamType.tupleTypeArguments.forEach((paramType) => {
                    const paramString = printTypeInternal(paramType.type, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                    paramTypeStrings.push(paramString);
                });
                return;
            }
        }
        // Handle expanding TypedDict kwargs specially.
        if ((0, parameterUtils_1.isTypedKwargs)(param) &&
            printTypeFlags & 1024 /* PrintTypeFlags.ExpandTypedDictArgs */ &&
            param.type.category === 6 /* TypeCategory.Class */) {
            param.type.details.typedDictEntries.knownItems.forEach((v, k) => {
                const valueTypeString = printTypeInternal(v.valueType, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount);
                paramTypeStrings.push(`${k}: ${valueTypeString}`);
            });
            return;
        }
        let paramString = '';
        if (param.category === 1 /* ParameterCategory.ArgsList */) {
            if (!param.name || !param.isNameSynthesized) {
                paramString += '*';
            }
        }
        else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
            paramString += '**';
        }
        let emittedParamName = false;
        if (param.name && !param.isNameSynthesized) {
            paramString += param.name;
            sawDefinedName = true;
            emittedParamName = true;
        }
        else if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
            paramString += `__p${index}`;
            sawDefinedName = true;
            emittedParamName = true;
        }
        let defaultValueAssignment = '=';
        let isParamSpecArgsKwargsParam = false;
        if (param.name) {
            // Avoid printing type types if parameter have unknown type.
            if (param.hasDeclaredType || param.isTypeInferred) {
                const paramType = types_1.FunctionType.getEffectiveParameterType(type, index);
                let paramTypeString = recursionTypes.length < types_1.maxTypeRecursionCount
                    ? printTypeInternal(paramType, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount)
                    : '';
                if (emittedParamName) {
                    paramString += ': ';
                }
                else if (param.category === 1 /* ParameterCategory.ArgsList */ && !(0, types_1.isUnpacked)(paramType)) {
                    paramString += '*';
                }
                if (param.category === 2 /* ParameterCategory.KwargsDict */ && (0, types_1.isUnpacked)(paramType)) {
                    if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
                        // Use "Unpack" because ** isn't legal syntax prior to Python 3.12.
                        paramTypeString = `Unpack[${paramTypeString.substring(1)}]`;
                    }
                    else {
                        // If this is an unpacked TypeDict for a **kwargs parameter, add another star.
                        paramTypeString = '*' + paramTypeString;
                    }
                }
                paramString += paramTypeString;
                if ((0, types_1.isParamSpec)(paramType)) {
                    if (param.category === 1 /* ParameterCategory.ArgsList */ ||
                        param.category === 2 /* ParameterCategory.KwargsDict */) {
                        isParamSpecArgsKwargsParam = true;
                    }
                }
                // PEP8 indicates that the "=" for the default value should have surrounding
                // spaces when used with a type annotation.
                defaultValueAssignment = ' = ';
            }
            else if ((printTypeFlags & 2 /* PrintTypeFlags.OmitTypeArgumentsIfUnknown */) === 0) {
                if (!param.isNameSynthesized) {
                    paramString += ': ';
                }
                if (printTypeFlags & (1 /* PrintTypeFlags.PrintUnknownWithAny */ | 256 /* PrintTypeFlags.PythonSyntax */)) {
                    paramString += 'Any';
                }
                else {
                    paramString += 'Unknown';
                }
                defaultValueAssignment = ' = ';
            }
        }
        else if (param.category === 0 /* ParameterCategory.Simple */) {
            if (sawDefinedName) {
                paramString += '/';
            }
            else {
                return;
            }
        }
        if (param.hasDefault) {
            if (param.defaultValueExpression) {
                paramString += defaultValueAssignment + ParseTreeUtils.printExpression(param.defaultValueExpression);
            }
            else {
                // If the function doesn't originate from a function declaration (e.g. it is
                // synthesized), we can't get to the default declaration, but we can still indicate
                // that there is a default value provided.
                paramString += defaultValueAssignment + '...';
            }
        }
        // If this is a (...) signature, replace the *args, **kwargs with "...".
        if (types_1.FunctionType.isGradualCallableForm(type) && !isParamSpecArgsKwargsParam) {
            if (param.category === 1 /* ParameterCategory.ArgsList */) {
                paramString = '...';
            }
            else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
                return;
            }
        }
        paramTypeStrings.push(paramString);
    });
    if (paramSpec) {
        if (printTypeFlags & 256 /* PrintTypeFlags.PythonSyntax */) {
            paramTypeStrings.push(`*args: ${paramSpec}.args`);
            paramTypeStrings.push(`**kwargs: ${paramSpec}.kwargs`);
        }
        else {
            paramTypeStrings.push(`**${printTypeInternal(paramSpec, printTypeFlags, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount)}`);
        }
    }
    const returnType = returnTypeCallback(type);
    const returnTypeString = recursionTypes.length < types_1.maxTypeRecursionCount
        ? printTypeInternal(returnType, printTypeFlags | 16 /* PrintTypeFlags.ParenthesizeUnion */ | 128 /* PrintTypeFlags.ParenthesizeCallable */, returnTypeCallback, uniqueNameMap, recursionTypes, recursionCount)
        : '';
    return [paramTypeStrings, returnTypeString];
}
function _printUnpack(textToWrap, flags) {
    return flags & 512 /* PrintTypeFlags.UseTypingUnpack */ ? `Unpack[${textToWrap}]` : `*${textToWrap}`;
}
// Surrounds a printed type with Type[...] as many times as needed
// for the nested instantiable count.
function _printNestedInstantiable(type, textToWrap) {
    var _a;
    const nestedTypes = ((_a = type.instantiableNestingLevel) !== null && _a !== void 0 ? _a : 0) + 1;
    for (let nestLevel = 0; nestLevel < nestedTypes; nestLevel++) {
        textToWrap = `type[${textToWrap}]`;
    }
    return textToWrap;
}
function _getReadableTypeVarName(type, usePythonSyntax) {
    if (usePythonSyntax) {
        return type.details.name;
    }
    return types_1.TypeVarType.getReadableName(type);
}
function _getTypeVarVarianceText(type) {
    var _a;
    const computedVariance = (_a = type.computedVariance) !== null && _a !== void 0 ? _a : type.details.declaredVariance;
    if (computedVariance === 2 /* Variance.Invariant */) {
        return 'invariant';
    }
    if (computedVariance === 3 /* Variance.Covariant */) {
        return 'covariant';
    }
    if (computedVariance === 4 /* Variance.Contravariant */) {
        return 'contravariant';
    }
    return '';
}
// Represents a map of named types (classes and type aliases) that appear within
// a specified type to determine whether any of the names require disambiguation
// (i.e. their fully-qualified name is required).
class UniqueNameMap {
    constructor(_printTypeFlags, _returnTypeCallback) {
        this._printTypeFlags = _printTypeFlags;
        this._returnTypeCallback = _returnTypeCallback;
        this._map = new Map();
    }
    build(type, recursionTypes = [], recursionCount = 0) {
        var _a;
        if (recursionCount > types_1.maxTypeRecursionCount) {
            return;
        }
        recursionCount++;
        if (type.typeAliasInfo) {
            let expandTypeAlias = true;
            if ((this._printTypeFlags & 32 /* PrintTypeFlags.ExpandTypeAlias */) === 0) {
                expandTypeAlias = false;
            }
            else {
                if (recursionTypes.find((t) => t === type)) {
                    expandTypeAlias = false;
                }
            }
            if (!expandTypeAlias) {
                const typeAliasName = (this._printTypeFlags & 4096 /* PrintTypeFlags.UseFullyQualifiedNames */) !== 0
                    ? type.typeAliasInfo.fullName
                    : type.typeAliasInfo.name;
                this._addIfUnique(typeAliasName, type, /* useTypeAliasName */ true);
                // Recursively add the type arguments if present.
                if (type.typeAliasInfo.typeArguments) {
                    recursionTypes.push(type);
                    try {
                        type.typeAliasInfo.typeArguments.forEach((typeArg) => {
                            this.build(typeArg, recursionTypes, recursionCount);
                        });
                    }
                    finally {
                        recursionTypes.pop();
                    }
                }
                return;
            }
        }
        try {
            recursionTypes.push(type);
            switch (type.category) {
                case 4 /* TypeCategory.Function */: {
                    type.details.parameters.forEach((_, index) => {
                        const paramType = types_1.FunctionType.getEffectiveParameterType(type, index);
                        this.build(paramType, recursionTypes, recursionCount);
                    });
                    const returnType = this._returnTypeCallback(type);
                    this.build(returnType, recursionTypes, recursionCount);
                    break;
                }
                case 5 /* TypeCategory.OverloadedFunction */: {
                    type.overloads.forEach((overload) => {
                        this.build(overload, recursionTypes, recursionCount);
                    });
                    break;
                }
                case 6 /* TypeCategory.Class */: {
                    if (type.literalValue !== undefined) {
                        break;
                    }
                    let className = type.aliasName;
                    if (!className) {
                        className =
                            (this._printTypeFlags & 4096 /* PrintTypeFlags.UseFullyQualifiedNames */) !== 0
                                ? type.details.fullName
                                : type.details.name;
                    }
                    this._addIfUnique(className, type);
                    if (!types_1.ClassType.isPseudoGenericClass(type)) {
                        if (type.tupleTypeArguments) {
                            type.tupleTypeArguments.forEach((typeArg) => {
                                this.build(typeArg.type, recursionTypes, recursionCount);
                            });
                        }
                        else if (type.typeArguments) {
                            type.typeArguments.forEach((typeArg) => {
                                this.build(typeArg, recursionTypes, recursionCount);
                            });
                        }
                    }
                    break;
                }
                case 8 /* TypeCategory.Union */: {
                    (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
                        this.build(subtype, recursionTypes, recursionCount);
                    });
                    (_a = type.typeAliasSources) === null || _a === void 0 ? void 0 : _a.forEach((typeAliasSource) => {
                        this.build(typeAliasSource, recursionTypes, recursionCount);
                    });
                    break;
                }
            }
        }
        finally {
            recursionTypes.pop();
        }
    }
    isUnique(name) {
        const entry = this._map.get(name);
        return !entry || entry.length === 1;
    }
    _addIfUnique(name, type, useTypeAliasName = false) {
        const existingEntry = this._map.get(name);
        if (!existingEntry) {
            this._map.set(name, [type]);
        }
        else {
            if (!existingEntry.some((t) => this._isSameTypeName(t, type, useTypeAliasName))) {
                existingEntry.push(type);
            }
        }
    }
    _isSameTypeName(type1, type2, useTypeAliasName) {
        var _a, _b;
        if (useTypeAliasName) {
            return ((_a = type1.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.fullName) === ((_b = type2.typeAliasInfo) === null || _b === void 0 ? void 0 : _b.fullName);
        }
        if ((0, types_1.isClass)(type1) && (0, types_1.isClass)(type2)) {
            return types_1.ClassType.isSameGenericClass(type1, type2);
        }
        return false;
    }
}
//# sourceMappingURL=typePrinter.js.map