"use strict";
/*
 * functionTransform.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Code that transforms the return result of a function.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyFunctionTransform = void 0;
const diagnosticRules_1 = require("../common/diagnosticRules");
const localize_1 = require("../localization/localize");
const symbol_1 = require("./symbol");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
function applyFunctionTransform(evaluator, errorNode, argList, functionType, result) {
    if ((0, types_1.isFunction)(functionType)) {
        if (functionType.details.fullName === 'functools.total_ordering') {
            return applyTotalOrderingTransform(evaluator, errorNode, argList, result);
        }
    }
    // By default, return the result unmodified.
    return result;
}
exports.applyFunctionTransform = applyFunctionTransform;
function applyTotalOrderingTransform(evaluator, errorNode, argList, result) {
    var _a;
    if (argList.length !== 1) {
        return result;
    }
    // This function is meant to apply to a concrete instantiable class.
    const classType = (_a = argList[0].typeResult) === null || _a === void 0 ? void 0 : _a.type;
    if (!classType || !(0, types_1.isInstantiableClass)(classType) || classType.includeSubclasses) {
        return result;
    }
    const orderingMethods = ['__lt__', '__le__', '__gt__', '__ge__'];
    const instanceType = types_1.ClassType.cloneAsInstance(classType);
    // Verify that the class has at least one of the required functions.
    let firstMemberFound;
    const missingMethods = orderingMethods.filter((methodName) => {
        const memberInfo = (0, typeUtils_1.lookUpObjectMember)(instanceType, methodName, 16 /* MemberAccessFlags.SkipInstanceMembers */);
        if (memberInfo && !firstMemberFound) {
            firstMemberFound = memberInfo;
        }
        return !memberInfo;
    });
    if (!firstMemberFound) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.totalOrderingMissingMethod(), errorNode);
        return result;
    }
    // Determine what type to use for the parameter corresponding to
    // the second operand. This will be taken from the existing method.
    let operandType;
    const firstMemberType = evaluator.getTypeOfMember(firstMemberFound);
    if ((0, types_1.isFunction)(firstMemberType) &&
        firstMemberType.details.parameters.length >= 2 &&
        firstMemberType.details.parameters[1].hasDeclaredType) {
        operandType = firstMemberType.details.parameters[1].type;
    }
    // If there was no provided operand type, fall back to object.
    if (!operandType) {
        const objectType = evaluator.getBuiltInObject(errorNode, 'object');
        if (!objectType || !(0, types_1.isClassInstance)(objectType)) {
            return result;
        }
        operandType = objectType;
    }
    const boolType = evaluator.getBuiltInObject(errorNode, 'bool');
    if (!boolType || !(0, types_1.isClassInstance)(boolType)) {
        return result;
    }
    const selfParam = {
        category: 0 /* ParameterCategory.Simple */,
        name: 'self',
        type: (0, typeUtils_1.synthesizeTypeVarForSelfCls)(classType, /* isClsParam */ false),
        hasDeclaredType: true,
    };
    const objParam = {
        category: 0 /* ParameterCategory.Simple */,
        name: '__value',
        type: operandType,
        hasDeclaredType: true,
    };
    // Add the missing members to the class's symbol table.
    missingMethods.forEach((methodName) => {
        const methodToAdd = types_1.FunctionType.createSynthesizedInstance(methodName);
        types_1.FunctionType.addParameter(methodToAdd, selfParam);
        types_1.FunctionType.addParameter(methodToAdd, objParam);
        methodToAdd.details.declaredReturnType = boolType;
        types_1.ClassType.getSymbolTable(classType).set(methodName, symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, methodToAdd));
    });
    return result;
}
//# sourceMappingURL=functionTransform.js.map