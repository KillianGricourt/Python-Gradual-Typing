"use strict";
/*
 * parameterUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Utility functions for parameters.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isParamSpecKwargsArgument = exports.isParamSpecArgsArgument = exports.getParameterListDetails = exports.firstParametersExcludingSelf = exports.ParameterKind = exports.isTypedKwargs = void 0;
const symbolNameUtils_1 = require("./symbolNameUtils");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
function isTypedKwargs(param) {
    return (param.category === 2 /* ParameterCategory.KwargsDict */ &&
        (0, types_1.isClassInstance)(param.type) &&
        (0, types_1.isUnpackedClass)(param.type) &&
        types_1.ClassType.isTypedDictClass(param.type) &&
        !!param.type.details.typedDictEntries);
}
exports.isTypedKwargs = isTypedKwargs;
var ParameterKind;
(function (ParameterKind) {
    ParameterKind[ParameterKind["Positional"] = 0] = "Positional";
    ParameterKind[ParameterKind["Standard"] = 1] = "Standard";
    ParameterKind[ParameterKind["Keyword"] = 2] = "Keyword";
})(ParameterKind || (exports.ParameterKind = ParameterKind = {}));
function firstParametersExcludingSelf(type) {
    return type.details.parameters.find((p) => !((0, types_1.isTypeVar)(p.type) && p.type.details.isSynthesizedSelf));
}
exports.firstParametersExcludingSelf = firstParametersExcludingSelf;
// Examines the input parameters within a function signature and creates a
// "virtual list" of parameters, stripping out any markers and expanding
// any *args with unpacked tuples.
function getParameterListDetails(type) {
    const result = {
        firstPositionOrKeywordIndex: 0,
        positionParamCount: 0,
        positionOnlyParamCount: 0,
        params: [],
        hasUnpackedVariadicTypeVar: false,
        hasUnpackedTypedDict: false,
    };
    let positionOnlyIndex = type.details.parameters.findIndex((p) => (0, types_1.isPositionOnlySeparator)(p));
    // Handle the old (pre Python 3.8) way of specifying positional-only
    // parameters by naming them with "__".
    if (positionOnlyIndex < 0) {
        for (let i = 0; i < type.details.parameters.length; i++) {
            const p = type.details.parameters[i];
            if (p.category !== 0 /* ParameterCategory.Simple */) {
                break;
            }
            if (!p.name) {
                break;
            }
            if ((0, symbolNameUtils_1.isDunderName)(p.name) || !p.name.startsWith('__')) {
                // We exempt "self" and "cls" in class and instance methods.
                if (i > 0 || types_1.FunctionType.isStaticMethod(type)) {
                    break;
                }
                continue;
            }
            positionOnlyIndex = i + 1;
        }
    }
    for (let i = 0; i < positionOnlyIndex; i++) {
        if (type.details.parameters[i].hasDefault) {
            break;
        }
        result.positionOnlyParamCount++;
    }
    let sawKeywordOnlySeparator = false;
    const addVirtualParameter = (param, index, typeOverride, defaultArgTypeOverride, sourceOverride) => {
        if (param.name) {
            let kind;
            if (sourceOverride !== undefined) {
                kind = sourceOverride;
            }
            else if (param.category === 1 /* ParameterCategory.ArgsList */) {
                kind = ParameterKind.Positional;
            }
            else if (sawKeywordOnlySeparator) {
                kind = ParameterKind.Keyword;
            }
            else if (positionOnlyIndex >= 0 && index < positionOnlyIndex) {
                kind = ParameterKind.Positional;
            }
            else {
                kind = ParameterKind.Standard;
            }
            result.params.push({
                param,
                index,
                type: typeOverride !== null && typeOverride !== void 0 ? typeOverride : types_1.FunctionType.getEffectiveParameterType(type, index),
                defaultArgType: defaultArgTypeOverride,
                kind,
            });
        }
    };
    type.details.parameters.forEach((param, index) => {
        var _a, _b;
        if (param.category === 1 /* ParameterCategory.ArgsList */) {
            // If this is an unpacked tuple, expand the entries.
            const paramType = types_1.FunctionType.getEffectiveParameterType(type, index);
            if (param.name && (0, types_1.isUnpackedClass)(paramType) && paramType.tupleTypeArguments) {
                const addToPositionalOnly = index < result.positionOnlyParamCount;
                paramType.tupleTypeArguments.forEach((tupleArg, tupleIndex) => {
                    const category = (0, types_1.isVariadicTypeVar)(tupleArg.type) || tupleArg.isUnbounded
                        ? 1 /* ParameterCategory.ArgsList */
                        : 0 /* ParameterCategory.Simple */;
                    if (category === 1 /* ParameterCategory.ArgsList */) {
                        result.argsIndex = result.params.length;
                    }
                    if ((0, types_1.isVariadicTypeVar)(param.type)) {
                        result.hasUnpackedVariadicTypeVar = true;
                    }
                    addVirtualParameter({
                        category,
                        name: `${param.name}[${tupleIndex.toString()}]`,
                        isNameSynthesized: true,
                        type: tupleArg.type,
                        hasDeclaredType: true,
                    }, index, tupleArg.type, 
                    /* defaultArgTypeOverride */ undefined, ParameterKind.Positional);
                    if (category === 0 /* ParameterCategory.Simple */) {
                        result.positionParamCount++;
                    }
                    if (tupleIndex > 0 && addToPositionalOnly) {
                        result.positionOnlyParamCount++;
                    }
                });
                // Normally, a VarArgList parameter (either named or as an unnamed separator)
                // would signify the start of keyword-only parameters. However, we can construct
                // callable signatures that defy this rule by using Callable and TypeVarTuples
                // or unpacked tuples.
                if (!sawKeywordOnlySeparator && (positionOnlyIndex < 0 || index >= positionOnlyIndex)) {
                    result.firstKeywordOnlyIndex = result.params.length;
                    sawKeywordOnlySeparator = true;
                }
            }
            else {
                if (param.name && result.argsIndex === undefined) {
                    result.argsIndex = result.params.length;
                    if ((0, types_1.isVariadicTypeVar)(param.type)) {
                        result.hasUnpackedVariadicTypeVar = true;
                    }
                }
                // Normally, a VarArgList parameter (either named or as an unnamed separator)
                // would signify the start of keyword-only parameters. However, we can construct
                // callable signatures that defy this rule by using Callable and TypeVarTuples
                // or unpacked tuples.
                if (!sawKeywordOnlySeparator && (positionOnlyIndex < 0 || index >= positionOnlyIndex)) {
                    result.firstKeywordOnlyIndex = result.params.length;
                    if (param.name) {
                        result.firstKeywordOnlyIndex++;
                    }
                    sawKeywordOnlySeparator = true;
                }
                addVirtualParameter(param, index);
            }
        }
        else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
            sawKeywordOnlySeparator = true;
            const paramType = types_1.FunctionType.getEffectiveParameterType(type, index);
            // Is this an unpacked TypedDict? If so, expand the entries.
            if ((0, types_1.isClassInstance)(paramType) && (0, types_1.isUnpackedClass)(paramType) && paramType.details.typedDictEntries) {
                if (result.firstKeywordOnlyIndex === undefined) {
                    result.firstKeywordOnlyIndex = result.params.length;
                }
                const typedDictType = paramType;
                paramType.details.typedDictEntries.knownItems.forEach((entry, name) => {
                    const specializedParamType = (0, typeUtils_1.partiallySpecializeType)(entry.valueType, typedDictType);
                    addVirtualParameter({
                        category: 0 /* ParameterCategory.Simple */,
                        name,
                        type: specializedParamType,
                        hasDeclaredType: true,
                        hasDefault: !entry.isRequired,
                    }, index, specializedParamType);
                });
                if (paramType.details.typedDictEntries.extraItems) {
                    addVirtualParameter({
                        category: 2 /* ParameterCategory.KwargsDict */,
                        name: 'kwargs',
                        type: paramType.details.typedDictEntries.extraItems.valueType,
                        hasDeclaredType: true,
                        hasDefault: false,
                    }, index, paramType.details.typedDictEntries.extraItems.valueType);
                    result.kwargsIndex = result.params.length - 1;
                }
                result.hasUnpackedTypedDict = true;
                result.unpackedKwargsTypedDictType = paramType;
            }
            else if (param.name) {
                if (result.kwargsIndex === undefined) {
                    result.kwargsIndex = result.params.length;
                }
                if (result.firstKeywordOnlyIndex === undefined) {
                    result.firstKeywordOnlyIndex = result.params.length;
                }
                addVirtualParameter(param, index);
            }
        }
        else if (param.category === 0 /* ParameterCategory.Simple */) {
            if (param.name && !sawKeywordOnlySeparator) {
                result.positionParamCount++;
            }
            addVirtualParameter(param, index, 
            /* typeOverride */ undefined, ((_a = type.specializedTypes) === null || _a === void 0 ? void 0 : _a.parameterDefaultArgs)
                ? (_b = type.specializedTypes) === null || _b === void 0 ? void 0 : _b.parameterDefaultArgs[index]
                : undefined);
        }
    });
    // If the signature ends in `*args: P.args, **kwargs: P.kwargs`,
    // extract the ParamSpec P.
    result.paramSpec = types_1.FunctionType.getParamSpecFromArgsKwargs(type);
    result.firstPositionOrKeywordIndex = result.params.findIndex((p) => p.kind !== ParameterKind.Positional);
    if (result.firstPositionOrKeywordIndex < 0) {
        result.firstPositionOrKeywordIndex = result.params.length;
    }
    return result;
}
exports.getParameterListDetails = getParameterListDetails;
// Returns true if the type of the argument type is "*args: P.args" or
// "*args: Any". Both of these match a parameter of type "*args: P.args".
function isParamSpecArgsArgument(paramSpec, argType) {
    let isCompatible = true;
    (0, typeUtils_1.doForEachSubtype)(argType, (argSubtype) => {
        if ((0, types_1.isParamSpec)(argSubtype) &&
            argSubtype.paramSpecAccess === 'args' &&
            (0, types_1.isTypeSame)(argSubtype, paramSpec, { ignoreTypeFlags: true })) {
            return;
        }
        if ((0, types_1.isClassInstance)(argSubtype) &&
            argSubtype.tupleTypeArguments &&
            argSubtype.tupleTypeArguments.length === 1 &&
            argSubtype.tupleTypeArguments[0].isUnbounded &&
            (0, types_1.isAnyOrUnknown)(argSubtype.tupleTypeArguments[0].type)) {
            return;
        }
        if ((0, types_1.isAnyOrUnknown)(argSubtype)) {
            return;
        }
        isCompatible = false;
    });
    return isCompatible;
}
exports.isParamSpecArgsArgument = isParamSpecArgsArgument;
// Returns true if the type of the argument type is "**kwargs: P.kwargs" or
// "*kwargs: Any". Both of these match a parameter of type "*kwargs: P.kwargs".
function isParamSpecKwargsArgument(paramSpec, argType) {
    let isCompatible = true;
    (0, typeUtils_1.doForEachSubtype)(argType, (argSubtype) => {
        if ((0, types_1.isParamSpec)(argSubtype) &&
            argSubtype.paramSpecAccess === 'kwargs' &&
            (0, types_1.isTypeSame)(argSubtype, paramSpec, { ignoreTypeFlags: true })) {
            return;
        }
        if ((0, types_1.isClassInstance)(argSubtype) &&
            types_1.ClassType.isBuiltIn(argSubtype, 'dict') &&
            argSubtype.typeArguments &&
            argSubtype.typeArguments.length === 2 &&
            (0, types_1.isClassInstance)(argSubtype.typeArguments[0]) &&
            types_1.ClassType.isBuiltIn(argSubtype.typeArguments[0], 'str') &&
            (0, types_1.isAnyOrUnknown)(argSubtype.typeArguments[1])) {
            return;
        }
        if ((0, types_1.isAnyOrUnknown)(argSubtype)) {
            return;
        }
        isCompatible = false;
    });
    return isCompatible;
}
exports.isParamSpecKwargsArgument = isParamSpecKwargsArgument;
//# sourceMappingURL=parameterUtils.js.map