"use strict";
/*
 * typeGuards.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides logic for narrowing types based on conditional
 * expressions. The logic handles both positive ("if") and
 * negative ("else") narrowing cases.
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
exports.func1 = exports.Tree = exports.Plant = exports.Dog = exports.Animal = exports.enumerateLiteralsForType = exports.narrowTypeForDiscriminatedLiteralFieldComparison = exports.narrowTypeForDiscriminatedTupleComparison = exports.narrowTypeForDiscriminatedDictEntryComparison = exports.narrowTypeForContainerElementType = exports.getElementTypeForContainerNarrowing = exports.isIsinstanceFilterSubclass = exports.isIsinstanceFilterSuperclass = exports.getTypeNarrowingCallback = void 0;
const debug_1 = require("../common/debug");
const parseNodes_1 = require("../parser/parseNodes");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const constraintSolver_1 = require("./constraintSolver");
const enums_1 = require("./enums");
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const scopeUtils_1 = require("./scopeUtils");
const symbol_1 = require("./symbol");
const typedDicts_1 = require("./typedDicts");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
// Given a reference expression and a test expression, returns a callback that
// can be used to narrow the type described by the reference expression.
// If the specified flow node is not associated with the test expression,
// it returns undefined.
function getTypeNarrowingCallback(evaluator, reference, testExpression, isPositiveTest, recursionCount = 0) {
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return undefined;
    }
    recursionCount++;
    if (testExpression.nodeType === 4 /* ParseNodeType.AssignmentExpression */) {
        return getTypeNarrowingCallbackForAssignmentExpression(evaluator, reference, testExpression, isPositiveTest, recursionCount);
    }
    if (testExpression.nodeType === 7 /* ParseNodeType.BinaryOperation */) {
        const isOrIsNotOperator = testExpression.operator === 39 /* OperatorType.Is */ || testExpression.operator === 40 /* OperatorType.IsNot */;
        const equalsOrNotEqualsOperator = testExpression.operator === 12 /* OperatorType.Equals */ || testExpression.operator === 28 /* OperatorType.NotEquals */;
        const comparisonOperator = equalsOrNotEqualsOperator ||
            testExpression.operator === 20 /* OperatorType.LessThan */ ||
            testExpression.operator === 21 /* OperatorType.LessThanOrEqual */ ||
            testExpression.operator === 15 /* OperatorType.GreaterThan */ ||
            testExpression.operator === 16 /* OperatorType.GreaterThanOrEqual */;
        if (isOrIsNotOperator || equalsOrNotEqualsOperator) {
            // Invert the "isPositiveTest" value if this is an "is not" operation.
            const adjIsPositiveTest = testExpression.operator === 39 /* OperatorType.Is */ || testExpression.operator === 12 /* OperatorType.Equals */
                ? isPositiveTest
                : !isPositiveTest;
            // Look for "X is None", "X is not None", "X == None", and "X != None".
            // These are commonly-used patterns used in control flow.
            if (testExpression.rightExpression.nodeType === 14 /* ParseNodeType.Constant */ &&
                testExpression.rightExpression.constType === 26 /* KeywordType.None */) {
                // Allow the LHS to be either a simple expression or an assignment
                // expression that assigns to a simple name.
                let leftExpression = testExpression.leftExpression;
                if (leftExpression.nodeType === 4 /* ParseNodeType.AssignmentExpression */) {
                    leftExpression = leftExpression.name;
                }
                if (ParseTreeUtils.isMatchingExpression(reference, leftExpression)) {
                    return (type) => {
                        return { type: narrowTypeForIsNone(evaluator, type, adjIsPositiveTest), isIncomplete: false };
                    };
                }
                if (leftExpression.nodeType === 27 /* ParseNodeType.Index */ &&
                    ParseTreeUtils.isMatchingExpression(reference, leftExpression.baseExpression) &&
                    leftExpression.items.length === 1 &&
                    !leftExpression.trailingComma &&
                    leftExpression.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
                    !leftExpression.items[0].name &&
                    leftExpression.items[0].valueExpression.nodeType === 40 /* ParseNodeType.Number */ &&
                    leftExpression.items[0].valueExpression.isInteger &&
                    !leftExpression.items[0].valueExpression.isImaginary) {
                    const indexValue = leftExpression.items[0].valueExpression.value;
                    if (typeof indexValue === 'number') {
                        return (type) => {
                            return {
                                type: narrowTupleTypeForIsNone(evaluator, type, adjIsPositiveTest, indexValue),
                                isIncomplete: false,
                            };
                        };
                    }
                }
            }
            // Look for "X is ...", "X is not ...", "X == ...", and "X != ...".
            if (testExpression.rightExpression.nodeType === 21 /* ParseNodeType.Ellipsis */) {
                // Allow the LHS to be either a simple expression or an assignment
                // expression that assigns to a simple name.
                let leftExpression = testExpression.leftExpression;
                if (leftExpression.nodeType === 4 /* ParseNodeType.AssignmentExpression */) {
                    leftExpression = leftExpression.name;
                }
                if (ParseTreeUtils.isMatchingExpression(reference, leftExpression)) {
                    return (type) => {
                        return {
                            type: narrowTypeForIsEllipsis(evaluator, type, adjIsPositiveTest),
                            isIncomplete: false,
                        };
                    };
                }
            }
            // Look for "type(X) is Y", "type(X) is not Y", "type(X) == Y" or "type(X) != Y".
            if (testExpression.leftExpression.nodeType === 9 /* ParseNodeType.Call */) {
                if (testExpression.leftExpression.arguments.length === 1 &&
                    testExpression.leftExpression.arguments[0].argumentCategory === 0 /* ArgumentCategory.Simple */) {
                    const arg0Expr = testExpression.leftExpression.arguments[0].valueExpression;
                    if (ParseTreeUtils.isMatchingExpression(reference, arg0Expr)) {
                        const callType = evaluator.getTypeOfExpression(testExpression.leftExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */).type;
                        if ((0, types_1.isInstantiableClass)(callType) && types_1.ClassType.isBuiltIn(callType, 'type')) {
                            const classTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                            const classType = evaluator.makeTopLevelTypeVarsConcrete(classTypeResult.type);
                            if ((0, types_1.isInstantiableClass)(classType)) {
                                return (type) => {
                                    return {
                                        type: narrowTypeForTypeIs(evaluator, type, classType, adjIsPositiveTest),
                                        isIncomplete: !!classTypeResult.isIncomplete,
                                    };
                                };
                            }
                        }
                    }
                }
            }
            if (isOrIsNotOperator) {
                if (ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression)) {
                    const rightTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                    const rightType = rightTypeResult.type;
                    // Look for "X is Y" or "X is not Y" where Y is a an enum or bool literal.
                    if ((0, types_1.isClassInstance)(rightType) &&
                        (types_1.ClassType.isEnumClass(rightType) || types_1.ClassType.isBuiltIn(rightType, 'bool')) &&
                        rightType.literalValue !== undefined) {
                        return (type) => {
                            return {
                                type: narrowTypeForLiteralComparison(evaluator, type, rightType, adjIsPositiveTest, 
                                /* isIsOperator */ true),
                                isIncomplete: !!rightTypeResult.isIncomplete,
                            };
                        };
                    }
                    // Look for X is <class> or X is not <class>.
                    if ((0, types_1.isInstantiableClass)(rightType)) {
                        return (type) => {
                            return {
                                type: narrowTypeForClassComparison(evaluator, type, rightType, adjIsPositiveTest),
                                isIncomplete: !!rightTypeResult.isIncomplete,
                            };
                        };
                    }
                }
                // Look for X[<literal>] is <literal> or X[<literal>] is not <literal>.
                if (testExpression.leftExpression.nodeType === 27 /* ParseNodeType.Index */ &&
                    testExpression.leftExpression.items.length === 1 &&
                    !testExpression.leftExpression.trailingComma &&
                    testExpression.leftExpression.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
                    ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression.baseExpression)) {
                    const indexTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression.items[0].valueExpression);
                    const indexType = indexTypeResult.type;
                    if ((0, types_1.isClassInstance)(indexType) && (0, typeUtils_1.isLiteralType)(indexType)) {
                        if (types_1.ClassType.isBuiltIn(indexType, 'str')) {
                            const rightType = evaluator.getTypeOfExpression(testExpression.rightExpression).type;
                            if ((0, types_1.isClassInstance)(rightType) && rightType.literalValue !== undefined) {
                                return (type) => {
                                    return {
                                        type: narrowTypeForDiscriminatedDictEntryComparison(evaluator, type, indexType, rightType, adjIsPositiveTest),
                                        isIncomplete: !!indexTypeResult.isIncomplete,
                                    };
                                };
                            }
                        }
                        else if (types_1.ClassType.isBuiltIn(indexType, 'int')) {
                            const rightTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                            const rightType = rightTypeResult.type;
                            if ((0, types_1.isClassInstance)(rightType) && rightType.literalValue !== undefined) {
                                let canNarrow = false;
                                // Narrowing can be applied only for bool or enum literals.
                                if (types_1.ClassType.isBuiltIn(rightType, 'bool')) {
                                    canNarrow = true;
                                }
                                else if (rightType.literalValue instanceof types_1.EnumLiteral) {
                                    canNarrow = true;
                                }
                                if (canNarrow) {
                                    return (type) => {
                                        return {
                                            type: narrowTypeForDiscriminatedTupleComparison(evaluator, type, indexType, rightType, adjIsPositiveTest),
                                            isIncomplete: !!rightTypeResult.isIncomplete,
                                        };
                                    };
                                }
                            }
                        }
                    }
                }
            }
            if (equalsOrNotEqualsOperator) {
                // Look for X == <literal> or X != <literal>
                const adjIsPositiveTest = testExpression.operator === 12 /* OperatorType.Equals */ ? isPositiveTest : !isPositiveTest;
                if (ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression)) {
                    // Use speculative mode here to avoid polluting the type cache. This is
                    // important in cases where evaluation of the right expression creates
                    // a false dependency on another variable.
                    const rightTypeResult = evaluator.useSpeculativeMode(testExpression.rightExpression, () => {
                        return evaluator.getTypeOfExpression(testExpression.rightExpression);
                    });
                    const rightType = rightTypeResult.type;
                    if ((0, types_1.isClassInstance)(rightType) && rightType.literalValue !== undefined) {
                        return (type) => {
                            return {
                                type: narrowTypeForLiteralComparison(evaluator, type, rightType, adjIsPositiveTest, 
                                /* isIsOperator */ false),
                                isIncomplete: !!rightTypeResult.isIncomplete,
                            };
                        };
                    }
                }
                // Look for X[<literal>] == <literal> or X[<literal>] != <literal>
                if (testExpression.leftExpression.nodeType === 27 /* ParseNodeType.Index */ &&
                    testExpression.leftExpression.items.length === 1 &&
                    !testExpression.leftExpression.trailingComma &&
                    testExpression.leftExpression.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
                    ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression.baseExpression)) {
                    const indexTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression.items[0].valueExpression);
                    const indexType = indexTypeResult.type;
                    if ((0, types_1.isClassInstance)(indexType) && (0, typeUtils_1.isLiteralType)(indexType)) {
                        if (types_1.ClassType.isBuiltIn(indexType, ['str', 'int'])) {
                            const rightTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                            const rightType = rightTypeResult.type;
                            if ((0, typeUtils_1.isLiteralTypeOrUnion)(rightType)) {
                                return (type) => {
                                    let narrowedType;
                                    if (types_1.ClassType.isBuiltIn(indexType, 'str')) {
                                        narrowedType = narrowTypeForDiscriminatedDictEntryComparison(evaluator, type, indexType, rightType, adjIsPositiveTest);
                                    }
                                    else {
                                        narrowedType = narrowTypeForDiscriminatedTupleComparison(evaluator, type, indexType, rightType, adjIsPositiveTest);
                                    }
                                    return {
                                        type: narrowedType,
                                        isIncomplete: !!indexTypeResult.isIncomplete || !!rightTypeResult.isIncomplete,
                                    };
                                };
                            }
                        }
                    }
                }
            }
            // Look for X.Y == <literal> or X.Y != <literal>
            if (equalsOrNotEqualsOperator &&
                testExpression.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression.leftExpression)) {
                const rightTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                const rightType = rightTypeResult.type;
                const memberName = testExpression.leftExpression.memberName;
                if ((0, types_1.isClassInstance)(rightType)) {
                    if (rightType.literalValue !== undefined || (0, typeUtils_1.isNoneInstance)(rightType)) {
                        return (type) => {
                            return {
                                type: narrowTypeForDiscriminatedLiteralFieldComparison(evaluator, type, memberName.value, rightType, adjIsPositiveTest),
                                isIncomplete: !!rightTypeResult.isIncomplete,
                            };
                        };
                    }
                }
            }
            // Look for X.Y is <literal> or X.Y is not <literal> where <literal> is
            // an enum or bool literal
            if (testExpression.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression.leftExpression)) {
                const rightTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                const rightType = rightTypeResult.type;
                const memberName = testExpression.leftExpression.memberName;
                if ((0, types_1.isClassInstance)(rightType) &&
                    (types_1.ClassType.isEnumClass(rightType) || types_1.ClassType.isBuiltIn(rightType, 'bool')) &&
                    rightType.literalValue !== undefined) {
                    return (type) => {
                        return {
                            type: narrowTypeForDiscriminatedLiteralFieldComparison(evaluator, type, memberName.value, rightType, adjIsPositiveTest),
                            isIncomplete: !!rightTypeResult.isIncomplete,
                        };
                    };
                }
            }
            // Look for X.Y is None or X.Y is not None
            // These are commonly-used patterns used in control flow.
            if (testExpression.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression.leftExpression) &&
                testExpression.rightExpression.nodeType === 14 /* ParseNodeType.Constant */ &&
                testExpression.rightExpression.constType === 26 /* KeywordType.None */) {
                const memberName = testExpression.leftExpression.memberName;
                return (type) => {
                    return {
                        type: narrowTypeForDiscriminatedFieldNoneComparison(evaluator, type, memberName.value, adjIsPositiveTest),
                        isIncomplete: false,
                    };
                };
            }
        }
        // Look for len(x) == <literal>, len(x) != <literal>, len(x) < <literal>, etc.
        if (comparisonOperator &&
            testExpression.leftExpression.nodeType === 9 /* ParseNodeType.Call */ &&
            testExpression.leftExpression.arguments.length === 1) {
            const arg0Expr = testExpression.leftExpression.arguments[0].valueExpression;
            if (ParseTreeUtils.isMatchingExpression(reference, arg0Expr)) {
                const callTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
                const callType = callTypeResult.type;
                if ((0, types_1.isFunction)(callType) && callType.details.fullName === 'builtins.len') {
                    const rightTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                    const rightType = rightTypeResult.type;
                    if ((0, types_1.isClassInstance)(rightType) &&
                        typeof rightType.literalValue === 'number' &&
                        rightType.literalValue >= 0) {
                        let tupleLength = rightType.literalValue;
                        // We'll treat <, <= and == as positive tests with >=, > and != as
                        // their negative counterparts.
                        const isLessOrEqual = testExpression.operator === 12 /* OperatorType.Equals */ ||
                            testExpression.operator === 20 /* OperatorType.LessThan */ ||
                            testExpression.operator === 21 /* OperatorType.LessThanOrEqual */;
                        const adjIsPositiveTest = isLessOrEqual ? isPositiveTest : !isPositiveTest;
                        // For <= (or its negative counterpart >), adjust the tuple length by 1.
                        if (testExpression.operator === 21 /* OperatorType.LessThanOrEqual */ ||
                            testExpression.operator === 15 /* OperatorType.GreaterThan */) {
                            tupleLength++;
                        }
                        const isEqualityCheck = testExpression.operator === 12 /* OperatorType.Equals */ ||
                            testExpression.operator === 28 /* OperatorType.NotEquals */;
                        return (type) => {
                            return {
                                type: narrowTypeForTupleLength(evaluator, type, tupleLength, adjIsPositiveTest, !isEqualityCheck),
                                isIncomplete: !!callTypeResult.isIncomplete || !!rightTypeResult.isIncomplete,
                            };
                        };
                    }
                }
            }
        }
        if (testExpression.operator === 41 /* OperatorType.In */ || testExpression.operator === 42 /* OperatorType.NotIn */) {
            // Look for "x in y" or "x not in y" where y is one of several built-in types.
            if (ParseTreeUtils.isMatchingExpression(reference, testExpression.leftExpression)) {
                const rightTypeResult = evaluator.getTypeOfExpression(testExpression.rightExpression);
                const rightType = rightTypeResult.type;
                const adjIsPositiveTest = testExpression.operator === 41 /* OperatorType.In */ ? isPositiveTest : !isPositiveTest;
                return (type) => {
                    return {
                        type: narrowTypeForContainerType(evaluator, type, rightType, adjIsPositiveTest),
                        isIncomplete: !!rightTypeResult.isIncomplete,
                    };
                };
            }
            if (ParseTreeUtils.isMatchingExpression(reference, testExpression.rightExpression)) {
                // Look for <string literal> in y where y is a union that contains
                // one or more TypedDicts.
                const leftTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression);
                const leftType = leftTypeResult.type;
                if ((0, types_1.isClassInstance)(leftType) && types_1.ClassType.isBuiltIn(leftType, 'str') && (0, typeUtils_1.isLiteralType)(leftType)) {
                    const adjIsPositiveTest = testExpression.operator === 41 /* OperatorType.In */ ? isPositiveTest : !isPositiveTest;
                    return (type) => {
                        return {
                            type: narrowTypeForTypedDictKey(evaluator, type, types_1.ClassType.cloneAsInstantiable(leftType), adjIsPositiveTest),
                            isIncomplete: !!leftTypeResult.isIncomplete,
                        };
                    };
                }
            }
        }
    }
    if (testExpression.nodeType === 9 /* ParseNodeType.Call */) {
        // Look for "isinstance(X, Y)" or "issubclass(X, Y)".
        if (testExpression.arguments.length === 2) {
            // Make sure the first parameter is a supported expression type
            // and the second parameter is a valid class type or a tuple
            // of valid class types.
            const arg0Expr = testExpression.arguments[0].valueExpression;
            const arg1Expr = testExpression.arguments[1].valueExpression;
            if (ParseTreeUtils.isMatchingExpression(reference, arg0Expr)) {
                const callTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
                const callType = callTypeResult.type;
                if ((0, types_1.isFunction)(callType) &&
                    (callType.details.builtInName === 'isinstance' || callType.details.builtInName === 'issubclass')) {
                    const isInstanceCheck = callType.details.builtInName === 'isinstance';
                    const arg1TypeResult = evaluator.getTypeOfExpression(arg1Expr, 536871546 /* EvalFlags.IsInstanceArgDefaults */);
                    const arg1Type = arg1TypeResult.type;
                    const classTypeList = getIsInstanceClassTypes(evaluator, arg1Type);
                    const isIncomplete = !!callTypeResult.isIncomplete || !!arg1TypeResult.isIncomplete;
                    if (classTypeList) {
                        return (type) => {
                            return {
                                type: narrowTypeForIsInstance(evaluator, type, classTypeList, isInstanceCheck, 
                                /* isTypeIsCheck */ false, isPositiveTest, testExpression),
                                isIncomplete,
                            };
                        };
                    }
                    else if (isIncomplete) {
                        // If the type is incomplete, it may include unknowns, which will result
                        // in classTypeList being undefined.
                        return (type) => {
                            return {
                                type,
                                isIncomplete: true,
                            };
                        };
                    }
                }
            }
        }
        // Look for "callable(X)"
        if (testExpression.arguments.length === 1) {
            const arg0Expr = testExpression.arguments[0].valueExpression;
            if (ParseTreeUtils.isMatchingExpression(reference, arg0Expr)) {
                const callTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
                const callType = callTypeResult.type;
                if ((0, types_1.isFunction)(callType) && callType.details.builtInName === 'callable') {
                    return (type) => {
                        let narrowedType = narrowTypeForCallable(evaluator, type, isPositiveTest, testExpression, 
                        /* allowIntersections */ false);
                        if (isPositiveTest && (0, types_1.isNever)(narrowedType)) {
                            // Try again with intersections allowed.
                            narrowedType = narrowTypeForCallable(evaluator, type, isPositiveTest, testExpression, 
                            /* allowIntersections */ true);
                        }
                        return { type: narrowedType, isIncomplete: !!callTypeResult.isIncomplete };
                    };
                }
            }
        }
        // Look for "bool(X)"
        if (testExpression.arguments.length === 1 && !testExpression.arguments[0].name) {
            if (ParseTreeUtils.isMatchingExpression(reference, testExpression.arguments[0].valueExpression)) {
                const callTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
                const callType = callTypeResult.type;
                if ((0, types_1.isInstantiableClass)(callType) && types_1.ClassType.isBuiltIn(callType, 'bool')) {
                    return (type) => {
                        return {
                            type: narrowTypeForTruthiness(evaluator, type, isPositiveTest),
                            isIncomplete: !!callTypeResult.isIncomplete,
                        };
                    };
                }
            }
        }
        // Look for a TypeGuard function.
        if (testExpression.arguments.length >= 1) {
            const arg0Expr = testExpression.arguments[0].valueExpression;
            if (ParseTreeUtils.isMatchingExpression(reference, arg0Expr)) {
                // Does this look like it's a custom type guard function?
                let isPossiblyTypeGuard = false;
                const isFunctionReturnTypeGuard = (type) => {
                    return (type.details.declaredReturnType &&
                        (0, types_1.isClassInstance)(type.details.declaredReturnType) &&
                        types_1.ClassType.isBuiltIn(type.details.declaredReturnType, ['TypeGuard', 'TypeIs']));
                };
                const callTypeResult = evaluator.getTypeOfExpression(testExpression.leftExpression, 2 /* EvalFlags.CallBaseDefaults */);
                const callType = callTypeResult.type;
                if ((0, types_1.isFunction)(callType) && isFunctionReturnTypeGuard(callType)) {
                    isPossiblyTypeGuard = true;
                }
                else if ((0, types_1.isOverloadedFunction)(callType) &&
                    types_1.OverloadedFunctionType.getOverloads(callType).some((o) => isFunctionReturnTypeGuard(o))) {
                    isPossiblyTypeGuard = true;
                }
                else if ((0, types_1.isClassInstance)(callType)) {
                    isPossiblyTypeGuard = true;
                }
                if (isPossiblyTypeGuard) {
                    // Evaluate the type guard call expression.
                    const functionReturnTypeResult = evaluator.getTypeOfExpression(testExpression);
                    const functionReturnType = functionReturnTypeResult.type;
                    if ((0, types_1.isClassInstance)(functionReturnType) &&
                        types_1.ClassType.isBuiltIn(functionReturnType, 'bool') &&
                        functionReturnType.typeGuardType) {
                        const isStrictTypeGuard = !!functionReturnType.isStrictTypeGuard;
                        const typeGuardType = functionReturnType.typeGuardType;
                        const isIncomplete = !!callTypeResult.isIncomplete || !!functionReturnTypeResult.isIncomplete;
                        return (type) => {
                            return {
                                type: narrowTypeForUserDefinedTypeGuard(evaluator, type, typeGuardType, isPositiveTest, isStrictTypeGuard, testExpression),
                                isIncomplete,
                            };
                        };
                    }
                }
            }
        }
    }
    if (ParseTreeUtils.isMatchingExpression(reference, testExpression)) {
        return (type) => {
            return {
                type: narrowTypeForTruthiness(evaluator, type, isPositiveTest),
                isIncomplete: false,
            };
        };
    }
    // Is this a reference to an aliased conditional expression (a local variable
    // that was assigned a value that can inform type narrowing of the reference expression)?
    const narrowingCallback = getTypeNarrowingCallbackForAliasedCondition(evaluator, reference, testExpression, isPositiveTest, recursionCount);
    if (narrowingCallback) {
        return narrowingCallback;
    }
    // We normally won't find a "not" operator here because they are stripped out
    // by the binder when it creates condition flow nodes, but we can find this
    // in the case of local variables type narrowing.
    if (reference.nodeType === 38 /* ParseNodeType.Name */) {
        if (testExpression.nodeType === 55 /* ParseNodeType.UnaryOperation */ && testExpression.operator === 38 /* OperatorType.Not */) {
            return getTypeNarrowingCallback(evaluator, reference, testExpression.expression, !isPositiveTest, recursionCount);
        }
    }
    return undefined;
}
exports.getTypeNarrowingCallback = getTypeNarrowingCallback;
function getTypeNarrowingCallbackForAliasedCondition(evaluator, reference, testExpression, isPositiveTest, recursionCount) {
    if (testExpression.nodeType !== 38 /* ParseNodeType.Name */ ||
        reference.nodeType !== 38 /* ParseNodeType.Name */ ||
        testExpression === reference) {
        return undefined;
    }
    // Make sure the reference expression is a constant parameter or variable.
    // If the reference expression is modified within the scope multiple times,
    // we need to validate that it is not modified between the test expression
    // evaluation and the conditional check.
    const testExprDecl = getDeclsForLocalVar(evaluator, testExpression, testExpression, /* requireUnique */ true);
    if (!testExprDecl || testExprDecl.length !== 1 || testExprDecl[0].type !== 1 /* DeclarationType.Variable */) {
        return undefined;
    }
    const referenceDecls = getDeclsForLocalVar(evaluator, reference, testExpression, /* requireUnique */ false);
    if (!referenceDecls) {
        return undefined;
    }
    let modifyingDecls = [];
    if (referenceDecls.length > 1) {
        // If there is more than one assignment to the reference variable within
        // the local scope, make sure that none of these assignments are done
        // after the test expression but before the condition check.
        //
        // This is OK:
        //  val = None
        //  is_none = val is None
        //  if is_none: ...
        //
        // This is not OK:
        //  val = None
        //  is_none = val is None
        //  val = 1
        //  if is_none: ...
        modifyingDecls = referenceDecls.filter((decl) => {
            return (evaluator.isNodeReachable(testExpression, decl.node) &&
                evaluator.isNodeReachable(decl.node, testExprDecl[0].node));
        });
    }
    if (modifyingDecls.length !== 0) {
        return undefined;
    }
    const initNode = testExprDecl[0].inferredTypeSource;
    if (!initNode || ParseTreeUtils.isNodeContainedWithin(testExpression, initNode) || !(0, parseNodes_1.isExpressionNode)(initNode)) {
        return undefined;
    }
    return getTypeNarrowingCallback(evaluator, reference, initNode, isPositiveTest, recursionCount);
}
// Determines whether the symbol is a local variable or parameter within
// the current scope. If requireUnique is true, there can be only one
// declaration (assignment) of the symbol, otherwise it is rejected.
function getDeclsForLocalVar(evaluator, name, reachableFrom, requireUnique) {
    const scope = (0, scopeUtils_1.getScopeForNode)(name);
    if ((scope === null || scope === void 0 ? void 0 : scope.type) !== 2 /* ScopeType.Function */ && (scope === null || scope === void 0 ? void 0 : scope.type) !== 4 /* ScopeType.Module */) {
        return undefined;
    }
    const symbol = scope.lookUpSymbol(name.value);
    if (!symbol) {
        return undefined;
    }
    const decls = symbol.getDeclarations();
    if (requireUnique && decls.length > 1) {
        return undefined;
    }
    if (decls.length === 0 ||
        decls.some((decl) => decl.type !== 1 /* DeclarationType.Variable */ && decl.type !== 2 /* DeclarationType.Parameter */)) {
        return undefined;
    }
    // If there are any assignments within different scopes (e.g. via a "global" or
    // "nonlocal" reference), don't consider it a local variable.
    let prevDeclScope;
    if (decls.some((decl) => {
        const nodeToConsider = decl.type === 2 /* DeclarationType.Parameter */ ? decl.node.name : decl.node;
        const declScopeNode = ParseTreeUtils.getExecutionScopeNode(nodeToConsider);
        if (prevDeclScope && declScopeNode !== prevDeclScope) {
            return true;
        }
        prevDeclScope = declScopeNode;
        return false;
    })) {
        return undefined;
    }
    const reachableDecls = decls.filter((decl) => evaluator.isNodeReachable(reachableFrom, decl.node));
    return reachableDecls.length > 0 ? reachableDecls : undefined;
}
function getTypeNarrowingCallbackForAssignmentExpression(evaluator, reference, testExpression, isPositiveTest, recursionCount) {
    var _a;
    return ((_a = getTypeNarrowingCallback(evaluator, reference, testExpression.rightExpression, isPositiveTest, recursionCount)) !== null && _a !== void 0 ? _a : getTypeNarrowingCallback(evaluator, reference, testExpression.name, isPositiveTest, recursionCount));
}
function narrowTypeForUserDefinedTypeGuard(evaluator, type, typeGuardType, isPositiveTest, isStrictTypeGuard, errorNode) {
    // For non-strict type guards, always narrow to the typeGuardType
    // in the positive case and don't narrow in the negative case.
    if (!isStrictTypeGuard) {
        return isPositiveTest ? typeGuardType : type;
    }
    const filterTypes = [];
    (0, typeUtils_1.doForEachSubtype)(typeGuardType, (typeGuardSubtype) => {
        filterTypes.push((0, typeUtils_1.convertToInstantiable)(typeGuardSubtype));
    });
    return narrowTypeForIsInstance(evaluator, type, filterTypes, 
    /* isInstanceCheck */ true, 
    /* isTypeIsCheck */ true, isPositiveTest, errorNode);
}
// Narrow the type based on whether the subtype can be true or false.
function narrowTypeForTruthiness(evaluator, type, isPositiveTest) {
    return (0, typeUtils_1.mapSubtypes)(type, (subtype) => {
        if (isPositiveTest) {
            if (evaluator.canBeTruthy(subtype)) {
                return evaluator.removeFalsinessFromType(subtype);
            }
        }
        else {
            if (evaluator.canBeFalsy(subtype)) {
                return evaluator.removeTruthinessFromType(subtype);
            }
        }
        return undefined;
    });
}
// Handle type narrowing for expressions of the form "a[I] is None" and "a[I] is not None" where
// I is an integer and a is a union of Tuples (or subtypes thereof) with known lengths and entry types.
function narrowTupleTypeForIsNone(evaluator, type, isPositiveTest, indexValue) {
    return evaluator.mapSubtypesExpandTypeVars(type, /* options */ undefined, (subtype) => {
        const tupleType = (0, typeUtils_1.getSpecializedTupleType)(subtype);
        if (!tupleType || (0, typeUtils_1.isUnboundedTupleClass)(tupleType) || !tupleType.tupleTypeArguments) {
            return subtype;
        }
        const tupleLength = tupleType.tupleTypeArguments.length;
        if (indexValue < 0 || indexValue >= tupleLength) {
            return subtype;
        }
        const typeOfEntry = evaluator.makeTopLevelTypeVarsConcrete(tupleType.tupleTypeArguments[indexValue].type);
        if (isPositiveTest) {
            if (!evaluator.assignType(typeOfEntry, evaluator.getNoneType())) {
                return undefined;
            }
        }
        else {
            if ((0, typeUtils_1.isNoneInstance)(typeOfEntry)) {
                return undefined;
            }
        }
        return subtype;
    });
}
// Handle type narrowing for expressions of the form "x is None" and "x is not None".
function narrowTypeForIsNone(evaluator, type, isPositiveTest) {
    const expandedType = (0, typeUtils_1.mapSubtypes)(type, (subtype) => {
        return (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(subtype);
    });
    let resultIncludesNoneSubtype = false;
    const result = evaluator.mapSubtypesExpandTypeVars(expandedType, 
    /* options */ undefined, (subtype, unexpandedSubtype) => {
        if ((0, types_1.isAnyOrUnknown)(subtype)) {
            // We need to assume that "Any" is always both None and not None,
            // so it matches regardless of whether the test is positive or negative.
            return subtype;
        }
        // If this is a TypeVar that isn't constrained, use the unexpanded
        // TypeVar. For all other cases (including constrained TypeVars),
        // use the expanded subtype.
        const adjustedSubtype = (0, types_1.isTypeVar)(unexpandedSubtype) && unexpandedSubtype.details.constraints.length === 0
            ? unexpandedSubtype
            : subtype;
        // See if it's a match for object.
        if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isBuiltIn(subtype, 'object')) {
            resultIncludesNoneSubtype = true;
            return isPositiveTest
                ? (0, typeUtils_1.addConditionToType)(evaluator.getNoneType(), subtype.condition)
                : adjustedSubtype;
        }
        // See if it's a match for None.
        if ((0, typeUtils_1.isNoneInstance)(subtype) === isPositiveTest) {
            resultIncludesNoneSubtype = true;
            if ((0, types_1.isTypeVar)(adjustedSubtype) && adjustedSubtype.details.isSynthesizedSelf) {
                return adjustedSubtype;
            }
            return subtype;
        }
        return undefined;
    });
    // If this is a positive test and the result is a union that includes None,
    // we can eliminate all the non-None subtypes include Any or Unknown. If some
    // of the subtypes are None types with conditions, retain those.
    if (isPositiveTest && resultIncludesNoneSubtype) {
        return (0, typeUtils_1.mapSubtypes)(result, (subtype) => {
            return (0, typeUtils_1.isNoneInstance)(subtype) ? subtype : undefined;
        });
    }
    return result;
}
// Handle type narrowing for expressions of the form "x is ..." and "x is not ...".
function narrowTypeForIsEllipsis(evaluator, type, isPositiveTest) {
    const expandedType = (0, typeUtils_1.mapSubtypes)(type, (subtype) => {
        return (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(subtype);
    });
    return evaluator.mapSubtypesExpandTypeVars(expandedType, /* options */ undefined, (subtype, unexpandedSubtype) => {
        if ((0, types_1.isAnyOrUnknown)(subtype)) {
            // We need to assume that "Any" is always both None and not None,
            // so it matches regardless of whether the test is positive or negative.
            return subtype;
        }
        // If this is a TypeVar that isn't constrained, use the unexpanded
        // TypeVar. For all other cases (including constrained TypeVars),
        // use the expanded subtype.
        const adjustedSubtype = (0, types_1.isTypeVar)(unexpandedSubtype) && unexpandedSubtype.details.constraints.length === 0
            ? unexpandedSubtype
            : subtype;
        // See if it's a match for object.
        if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isBuiltIn(subtype, 'object')) {
            return isPositiveTest ? (0, typeUtils_1.addConditionToType)(evaluator.getNoneType(), subtype.condition) : adjustedSubtype;
        }
        const isEllipsis = (0, types_1.isClassInstance)(subtype) && types_1.ClassType.isBuiltIn(subtype, ['EllipsisType', 'ellipsis']);
        // See if it's a match for "...".
        if (isEllipsis === isPositiveTest) {
            return subtype;
        }
        return undefined;
    });
}
// The "isinstance" and "issubclass" calls support two forms - a simple form
// that accepts a single class, and a more complex form that accepts a tuple
// of classes (including arbitrarily-nested tuples). This method determines
// which form and returns a list of classes or undefined.
function getIsInstanceClassTypes(evaluator, argType) {
    let foundNonClassType = false;
    const classTypeList = [];
    // Create a helper function that returns a list of class types or
    // undefined if any of the types are not valid.
    const addClassTypesToList = (types) => {
        types.forEach((subtype) => {
            if ((0, types_1.isClass)(subtype)) {
                subtype = (0, typeUtils_1.specializeWithUnknownTypeArgs)(subtype, evaluator.getTupleClassType());
                if ((0, types_1.isInstantiableClass)(subtype) && types_1.ClassType.isBuiltIn(subtype, 'Callable')) {
                    subtype = (0, typeUtils_1.convertToInstantiable)((0, typeUtils_1.getUnknownTypeForCallable)());
                }
            }
            if ((0, types_1.isInstantiableClass)(subtype) || ((0, types_1.isTypeVar)(subtype) && types_1.TypeBase.isInstantiable(subtype))) {
                classTypeList.push(subtype);
            }
            else if ((0, typeUtils_1.isNoneTypeClass)(subtype)) {
                (0, debug_1.assert)((0, types_1.isInstantiableClass)(subtype));
                classTypeList.push(subtype);
            }
            else if ((0, types_1.isFunction)(subtype) &&
                subtype.details.parameters.length === 2 &&
                subtype.details.parameters[0].category === 1 /* ParameterCategory.ArgsList */ &&
                subtype.details.parameters[1].category === 2 /* ParameterCategory.KwargsDict */) {
                classTypeList.push(subtype);
            }
            else {
                foundNonClassType = true;
            }
        });
    };
    const addClassTypesRecursive = (type, recursionCount = 0) => {
        if (recursionCount > types_1.maxTypeRecursionCount) {
            return;
        }
        if ((0, types_1.isClass)(type) && types_1.TypeBase.isInstance(type) && (0, typeUtils_1.isTupleClass)(type)) {
            if (type.tupleTypeArguments) {
                type.tupleTypeArguments.forEach((tupleEntry) => {
                    addClassTypesRecursive(tupleEntry.type, recursionCount + 1);
                });
            }
        }
        else {
            (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
                addClassTypesToList([subtype]);
            });
        }
    };
    (0, typeUtils_1.doForEachSubtype)(argType, (subtype) => {
        addClassTypesRecursive(subtype);
    });
    return foundNonClassType ? undefined : classTypeList;
}
function isIsinstanceFilterSuperclass(evaluator, varType, concreteVarType, filterType, concreteFilterType, isInstanceCheck) {
    if ((0, types_1.isTypeVar)(filterType) || concreteFilterType.literalValue !== undefined) {
        return (0, types_1.isTypeSame)((0, typeUtils_1.convertToInstance)(filterType), varType);
    }
    // If the filter type represents all possible subclasses
    // of a type, we can't make any statements about its superclass
    // relationship with concreteVarType.
    if (concreteFilterType.includeSubclasses) {
        return false;
    }
    if (types_1.ClassType.isDerivedFrom(concreteVarType, concreteFilterType)) {
        return true;
    }
    if (isInstanceCheck) {
        if (types_1.ClassType.isProtocolClass(concreteFilterType) &&
            evaluator.assignType(concreteFilterType, concreteVarType)) {
            return true;
        }
    }
    // Handle the special case where the variable type is a TypedDict and
    // we're filtering against 'dict'. TypedDict isn't derived from dict,
    // but at runtime, isinstance returns True.
    if (types_1.ClassType.isBuiltIn(concreteFilterType, 'dict') && types_1.ClassType.isTypedDictClass(concreteVarType)) {
        return true;
    }
    return false;
}
exports.isIsinstanceFilterSuperclass = isIsinstanceFilterSuperclass;
function isIsinstanceFilterSubclass(evaluator, varType, concreteFilterType, isInstanceCheck) {
    if (types_1.ClassType.isDerivedFrom(concreteFilterType, varType)) {
        return true;
    }
    if (isInstanceCheck) {
        if (types_1.ClassType.isProtocolClass(varType) && evaluator.assignType(varType, concreteFilterType)) {
            return true;
        }
    }
    return false;
}
exports.isIsinstanceFilterSubclass = isIsinstanceFilterSubclass;
function narrowTypeForIsInstance(evaluator, type, filterTypes, isInstanceCheck, isTypeIsCheck, isPositiveTest, errorNode) {
    // First try with intersection types disallowed.
    const narrowedType = narrowTypeForIsInstanceInternal(evaluator, type, filterTypes, isInstanceCheck, isTypeIsCheck, isPositiveTest, 
    /* allowIntersections */ false, errorNode);
    if (!(0, types_1.isNever)(narrowedType)) {
        return narrowedType;
    }
    // Try again with intersection types allowed.
    return narrowTypeForIsInstanceInternal(evaluator, type, filterTypes, isInstanceCheck, isTypeIsCheck, isPositiveTest, 
    /* allowIntersections */ true, errorNode);
}
// Attempts to narrow a type (make it more constrained) based on a
// call to isinstance or issubclass. For example, if the original
// type of expression "x" is "Mammal" and the test expression is
// "isinstance(x, Cow)", (assuming "Cow" is a subclass of "Mammal"),
// we can conclude that x must be constrained to "Cow".
function narrowTypeForIsInstanceInternal(evaluator, type, filterTypes, isInstanceCheck, isTypeIsCheck, isPositiveTest, allowIntersections, errorNode) {
    let expandedTypes = (0, typeUtils_1.mapSubtypes)(type, (subtype) => {
        return (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(subtype);
    });
    expandedTypes = evaluator.expandPromotionTypes(errorNode, expandedTypes);
    // Filters the varType by the parameters of the isinstance
    // and returns the list of types the varType could be after
    // applying the filter.
    const filterClassType = (varType, concreteVarType, conditions, negativeFallbackType) => {
        const filteredTypes = [];
        let foundSuperclass = false;
        let isClassRelationshipIndeterminate = false;
        for (const filterType of filterTypes) {
            let concreteFilterType = evaluator.makeTopLevelTypeVarsConcrete(filterType);
            if ((0, types_1.isInstantiableClass)(concreteFilterType)) {
                let filterIsSuperclass;
                let filterIsSubclass;
                if (isTypeIsCheck) {
                    filterIsSuperclass = evaluator.assignType(filterType, concreteVarType);
                    filterIsSubclass = evaluator.assignType(concreteVarType, filterType);
                }
                else {
                    // If the class was implicitly specialized (e.g. because its type
                    // parameters have default values), replace the default type arguments
                    // with Unknown.
                    if (concreteFilterType.typeArguments && !concreteFilterType.isTypeArgumentExplicit) {
                        concreteFilterType = (0, typeUtils_1.specializeWithUnknownTypeArgs)(types_1.ClassType.cloneForSpecialization(concreteFilterType, 
                        /* typeArguments */ undefined, 
                        /* isTypeArgumentExplicit */ false), evaluator.getTupleClassType());
                    }
                    filterIsSuperclass = isIsinstanceFilterSuperclass(evaluator, varType, concreteVarType, filterType, concreteFilterType, isInstanceCheck);
                    filterIsSubclass = isIsinstanceFilterSubclass(evaluator, concreteVarType, concreteFilterType, isInstanceCheck);
                }
                if (filterIsSuperclass) {
                    foundSuperclass = true;
                }
                // Normally, a type should never be both a subclass and a superclass.
                // This can happen if either of the class types derives from a
                // class whose type is unknown (e.g. an import failed). We'll
                // note this case specially so we don't do any narrowing, which
                // will generate false positives.
                if (filterIsSubclass &&
                    filterIsSuperclass &&
                    !types_1.ClassType.isSameGenericClass(concreteVarType, concreteFilterType)) {
                    isClassRelationshipIndeterminate = true;
                }
                // If both the variable type and the filter type ar generics, we can't
                // determine the relationship between the two.
                if ((0, types_1.isTypeVar)(varType) && (0, types_1.isTypeVar)(filterType)) {
                    isClassRelationshipIndeterminate = true;
                }
                if (isPositiveTest) {
                    if (filterIsSuperclass) {
                        // If the variable type is a subclass of the isinstance filter,
                        // we haven't learned anything new about the variable type.
                        // If the varType is a Self or type[Self], retain the unnarrowedType.
                        if ((0, types_1.isTypeVar)(varType) && varType.details.isSynthesizedSelf) {
                            filteredTypes.push((0, typeUtils_1.addConditionToType)(varType, conditions));
                        }
                        else {
                            filteredTypes.push((0, typeUtils_1.addConditionToType)(concreteVarType, conditions));
                        }
                    }
                    else if (filterIsSubclass) {
                        if (evaluator.assignType(concreteVarType, concreteFilterType, 
                        /* diag */ undefined, 
                        /* destTypeVarContext */ undefined, 
                        /* srcTypeVarContext */ undefined, 1024 /* AssignTypeFlags.IgnoreTypeVarScope */ |
                            16384 /* AssignTypeFlags.IgnoreProtocolAssignmentCheck */ |
                            32768 /* AssignTypeFlags.AllowIsinstanceSpecialForms */)) {
                            // If the variable type is a superclass of the isinstance
                            // filter, we can narrow the type to the subclass.
                            let specializedFilterType = filterType;
                            // Try to retain the type arguments for the filter type. This is
                            // important because a specialized version of the filter cannot
                            // be passed to isinstance or issubclass.
                            if ((0, types_1.isClass)(filterType)) {
                                if (types_1.ClassType.isSpecialBuiltIn(filterType) ||
                                    filterType.details.typeParameters.length > 0) {
                                    if (!filterType.typeArguments ||
                                        !filterType.isTypeArgumentExplicit ||
                                        !types_1.ClassType.isSameGenericClass(concreteVarType, filterType)) {
                                        const typeVarContext = new typeVarContext_1.TypeVarContext((0, typeUtils_1.getTypeVarScopeId)(filterType));
                                        const unspecializedFilterType = types_1.ClassType.cloneForSpecialization(filterType, 
                                        /* typeArguments */ undefined, 
                                        /* isTypeArgumentExplicit */ false);
                                        if ((0, constraintSolver_1.addConstraintsForExpectedType)(evaluator, unspecializedFilterType, concreteVarType, typeVarContext, 
                                        /* liveTypeVarScopes */ undefined, errorNode.start)) {
                                            specializedFilterType = (0, typeUtils_1.applySolvedTypeVars)(unspecializedFilterType, typeVarContext, {
                                                unknownIfNotFound: true,
                                                useUnknownOverDefault: true,
                                                tupleClassType: evaluator.getTupleClassType(),
                                            });
                                        }
                                    }
                                }
                            }
                            filteredTypes.push((0, typeUtils_1.addConditionToType)(specializedFilterType, conditions));
                        }
                    }
                    else if (allowIntersections &&
                        !types_1.ClassType.isFinal(concreteVarType) &&
                        !types_1.ClassType.isFinal(concreteFilterType)) {
                        // The two types appear to have no relation. It's possible that the
                        // two types are protocols or the program is expecting one type to
                        // be a mix-in class used with the other. In this case, we'll
                        // synthesize a new class type that represents an intersection of
                        // the two types.
                        const className = `<subclass of ${concreteVarType.details.name} and ${concreteFilterType.details.name}>`;
                        const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(errorNode);
                        // The effective metaclass of the intersection is the narrower of the two metaclasses.
                        let effectiveMetaclass = concreteVarType.details.effectiveMetaclass;
                        if (concreteFilterType.details.effectiveMetaclass) {
                            if (!effectiveMetaclass ||
                                evaluator.assignType(effectiveMetaclass, concreteFilterType.details.effectiveMetaclass)) {
                                effectiveMetaclass = concreteFilterType.details.effectiveMetaclass;
                            }
                        }
                        let newClassType = types_1.ClassType.createInstantiable(className, ParseTreeUtils.getClassFullName(errorNode, fileInfo.moduleName, className), fileInfo.moduleName, fileInfo.fileUri, 0 /* ClassTypeFlags.None */, ParseTreeUtils.getTypeSourceId(errorNode), 
                        /* declaredMetaclass */ undefined, effectiveMetaclass, concreteVarType.details.docString);
                        newClassType.details.baseClasses = [
                            types_1.ClassType.cloneAsInstantiable(concreteVarType),
                            concreteFilterType,
                        ];
                        (0, typeUtils_1.computeMroLinearization)(newClassType);
                        newClassType = (0, typeUtils_1.addConditionToType)(newClassType, concreteFilterType.condition);
                        if ((0, types_1.isTypeVar)(varType) &&
                            !varType.details.isParamSpec &&
                            varType.details.constraints.length === 0) {
                            newClassType = (0, typeUtils_1.addConditionToType)(newClassType, [
                                { typeVar: varType, constraintIndex: 0 },
                            ]);
                        }
                        let newClassInstanceType = types_1.ClassType.cloneAsInstance(newClassType);
                        if (concreteVarType.condition) {
                            newClassInstanceType = (0, typeUtils_1.addConditionToType)(newClassInstanceType, concreteVarType.condition);
                        }
                        // If this is a issubclass check, we do a double conversion from instantiable
                        // to instance back to instantiable to make sure that the includeSubclasses flag
                        // gets cleared.
                        filteredTypes.push(isInstanceCheck ? newClassInstanceType : types_1.ClassType.cloneAsInstantiable(newClassInstanceType));
                    }
                }
            }
            else if ((0, types_1.isTypeVar)(filterType) && types_1.TypeBase.isInstantiable(filterType)) {
                // Handle the case where the filter type is Type[T] and the unexpanded
                // subtype is some instance type, possibly T.
                if (isInstanceCheck && types_1.TypeBase.isInstance(varType)) {
                    if ((0, types_1.isTypeVar)(varType) && (0, types_1.isTypeSame)((0, typeUtils_1.convertToInstance)(filterType), varType)) {
                        // If the unexpanded subtype is T, we can definitively filter
                        // in both the positive and negative cases.
                        if (isPositiveTest) {
                            filteredTypes.push(varType);
                        }
                        else {
                            foundSuperclass = true;
                        }
                    }
                    else {
                        if (isPositiveTest) {
                            filteredTypes.push((0, typeUtils_1.convertToInstance)(filterType));
                        }
                        else {
                            // If the unexpanded subtype is some other instance, we can't
                            // filter anything because it might be an instance.
                            filteredTypes.push(varType);
                            isClassRelationshipIndeterminate = true;
                        }
                    }
                }
                else if (!isInstanceCheck && types_1.TypeBase.isInstantiable(varType)) {
                    if ((0, types_1.isTypeVar)(varType) && (0, types_1.isTypeSame)(filterType, varType)) {
                        if (isPositiveTest) {
                            filteredTypes.push(varType);
                        }
                    }
                    else {
                        if (isPositiveTest) {
                            filteredTypes.push(filterType);
                        }
                        else {
                            filteredTypes.push(varType);
                            isClassRelationshipIndeterminate = true;
                        }
                    }
                }
            }
            else if ((0, types_1.isFunction)(filterType)) {
                // Handle an isinstance check against Callable.
                if (isInstanceCheck) {
                    let isCallable = false;
                    if ((0, types_1.isClass)(concreteVarType)) {
                        if (types_1.TypeBase.isInstantiable(varType)) {
                            isCallable = true;
                        }
                        else {
                            isCallable = !!(0, typeUtils_1.lookUpClassMember)(concreteVarType, '__call__', 16 /* MemberAccessFlags.SkipInstanceMembers */);
                        }
                    }
                    if (isCallable) {
                        if (isPositiveTest) {
                            filteredTypes.push(varType);
                        }
                        else {
                            foundSuperclass = true;
                        }
                    }
                    else if (evaluator.assignType(concreteVarType, filterType, 
                    /* diag */ undefined, 
                    /* destTypeVarContext */ undefined, 
                    /* srcTypeVarContext */ undefined, 32768 /* AssignTypeFlags.AllowIsinstanceSpecialForms */)) {
                        if (isPositiveTest) {
                            filteredTypes.push(filterType);
                        }
                    }
                }
            }
        }
        // In the negative case, if one or more of the filters
        // always match the type (i.e. they are an exact match or
        // a superclass of the type), then there's nothing left after
        // the filter is applied. If we didn't find any superclass
        // match, then the original variable type survives the filter.
        if (!isPositiveTest) {
            if (!foundSuperclass || isClassRelationshipIndeterminate) {
                filteredTypes.push(isInstanceCheck ? (0, typeUtils_1.convertToInstantiable)(negativeFallbackType) : negativeFallbackType);
            }
        }
        if (!isInstanceCheck) {
            // We perform a double conversion from instance to instantiable
            // here to make sure that the includeSubclasses flag is cleared
            // if it's a class.
            return filteredTypes.map((t) => ((0, types_1.isInstantiableClass)(t) ? (0, typeUtils_1.convertToInstantiable)((0, typeUtils_1.convertToInstance)(t)) : t));
        }
        return filteredTypes.map((t) => (0, typeUtils_1.convertToInstance)(t));
    };
    // Filters the metaclassType (which is assumed to be a metaclass instance)
    // by the classTypeList and returns the list of types the varType could be
    // after applying the filter.
    const filterMetaclassType = (metaclassType, negativeFallbackType) => {
        const filteredTypes = [];
        let foundPositiveMatch = false;
        let isMatchIndeterminate = false;
        for (const filterType of filterTypes) {
            const concreteFilterType = evaluator.makeTopLevelTypeVarsConcrete(filterType);
            if ((0, types_1.isInstantiableClass)(concreteFilterType)) {
                const filterMetaclass = concreteFilterType.details.effectiveMetaclass;
                if (filterMetaclass && (0, types_1.isInstantiableClass)(filterMetaclass)) {
                    let isMetaclassOverlap = evaluator.assignType(metaclassType, types_1.ClassType.cloneAsInstance(filterMetaclass));
                    // Handle the special case where the metaclass for the filter is type.
                    // This will normally be treated as type[Any], which is compatible with
                    // any metaclass, but we specifically want to treat type as the class
                    // type[object] in this case.
                    if (types_1.ClassType.isBuiltIn(filterMetaclass, 'type') && !filterMetaclass.isTypeArgumentExplicit) {
                        if (!types_1.ClassType.isBuiltIn(metaclassType, 'type')) {
                            isMetaclassOverlap = false;
                        }
                    }
                    if (isMetaclassOverlap) {
                        if (isPositiveTest) {
                            filteredTypes.push(filterType);
                            foundPositiveMatch = true;
                        }
                        else if (!(0, types_1.isTypeSame)(metaclassType, filterMetaclass) || filterMetaclass.includeSubclasses) {
                            filteredTypes.push(metaclassType);
                            isMatchIndeterminate = true;
                        }
                    }
                }
                else {
                    filteredTypes.push(metaclassType);
                    isMatchIndeterminate = true;
                }
            }
            else {
                filteredTypes.push(metaclassType);
                isMatchIndeterminate = true;
            }
        }
        // In the negative case, if one or more of the filters
        // always match the type in the positive case, then there's nothing
        // left after the filter is applied.
        if (!isPositiveTest) {
            if (!foundPositiveMatch || isMatchIndeterminate) {
                filteredTypes.push(negativeFallbackType);
            }
        }
        // We perform a double conversion from instance to instantiable
        // here to make sure that the includeSubclasses flag is cleared
        // if it's a class.
        return filteredTypes.map((t) => ((0, types_1.isInstantiableClass)(t) ? (0, typeUtils_1.convertToInstantiable)((0, typeUtils_1.convertToInstance)(t)) : t));
    };
    const filterFunctionType = (varType, unexpandedType) => {
        const filteredTypes = [];
        if (isPositiveTest) {
            for (const filterType of filterTypes) {
                const concreteFilterType = evaluator.makeTopLevelTypeVarsConcrete(filterType);
                if (evaluator.assignType(varType, (0, typeUtils_1.convertToInstance)(concreteFilterType), 
                /* diag */ undefined, 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, 1024 /* AssignTypeFlags.IgnoreTypeVarScope */)) {
                    // If the filter type is a Callable, use the original type. If the
                    // filter type is a callback protocol, use the filter type.
                    if ((0, types_1.isFunction)(filterType)) {
                        filteredTypes.push(unexpandedType);
                    }
                    else {
                        filteredTypes.push((0, typeUtils_1.convertToInstance)(filterType));
                    }
                }
            }
        }
        else if (!filterTypes.some((filterType) => {
            // If the filter type is a runtime checkable protocol class, it can
            // be used in an instance check.
            const concreteFilterType = evaluator.makeTopLevelTypeVarsConcrete(filterType);
            if ((0, types_1.isClass)(concreteFilterType) && !types_1.ClassType.isProtocolClass(concreteFilterType)) {
                return false;
            }
            return evaluator.assignType(varType, (0, typeUtils_1.convertToInstance)(concreteFilterType));
        })) {
            filteredTypes.push(unexpandedType);
        }
        return filteredTypes;
    };
    const classListContainsNoneType = () => filterTypes.some((t) => {
        if ((0, typeUtils_1.isNoneTypeClass)(t)) {
            return true;
        }
        return (0, types_1.isInstantiableClass)(t) && types_1.ClassType.isBuiltIn(t, 'NoneType');
    });
    const anyOrUnknownSubstitutions = [];
    const anyOrUnknown = [];
    const filteredType = evaluator.mapSubtypesExpandTypeVars(expandedTypes, {
        expandCallback: (type) => {
            return evaluator.expandPromotionTypes(errorNode, type);
        },
    }, (subtype, unexpandedSubtype) => {
        // If we fail to filter anything in the negative case, we need to decide
        // whether to retain the original TypeVar or replace it with its specialized
        // type(s). We'll assume that if someone is using isinstance or issubclass
        // on a constrained TypeVar that they want to filter based on its constrained
        // parts.
        const negativeFallback = (0, typeUtils_1.getTypeCondition)(subtype) ? subtype : unexpandedSubtype;
        const isSubtypeMetaclass = (0, typeUtils_1.isMetaclassInstance)(subtype);
        if (isPositiveTest && (0, types_1.isAnyOrUnknown)(subtype)) {
            // If this is a positive test and the effective type is Any or
            // Unknown, we can assume that the type matches one of the
            // specified types.
            if (isInstanceCheck) {
                anyOrUnknownSubstitutions.push((0, types_1.combineTypes)(filterTypes.map((classType) => (0, typeUtils_1.convertToInstance)(classType))));
            }
            else {
                // We perform a double conversion from instance to instantiable
                // here to make sure that the includeSubclasses flag is cleared
                // if it's a class.
                anyOrUnknownSubstitutions.push((0, types_1.combineTypes)(filterTypes.map((classType) => (0, typeUtils_1.convertToInstantiable)((0, typeUtils_1.convertToInstance)(classType)))));
            }
            anyOrUnknown.push(subtype);
            return undefined;
        }
        if (isInstanceCheck) {
            if ((0, typeUtils_1.isNoneInstance)(subtype)) {
                return classListContainsNoneType() === isPositiveTest ? subtype : undefined;
            }
            if ((0, types_1.isModule)(subtype) || ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isBuiltIn(subtype, 'ModuleType'))) {
                // Handle type narrowing for runtime-checkable protocols
                // when applied to modules.
                if (isPositiveTest) {
                    const filteredTypes = filterTypes.filter((classType) => {
                        const concreteClassType = evaluator.makeTopLevelTypeVarsConcrete(classType);
                        return ((0, types_1.isInstantiableClass)(concreteClassType) && types_1.ClassType.isProtocolClass(concreteClassType));
                    });
                    if (filteredTypes.length > 0) {
                        return (0, typeUtils_1.convertToInstance)((0, types_1.combineTypes)(filteredTypes));
                    }
                }
            }
            if ((0, types_1.isClassInstance)(subtype)) {
                return (0, types_1.combineTypes)(filterClassType(unexpandedSubtype, types_1.ClassType.cloneAsInstantiable(subtype), (0, typeUtils_1.getTypeCondition)(subtype), negativeFallback));
            }
            if (((0, types_1.isFunction)(subtype) || (0, types_1.isOverloadedFunction)(subtype)) && isInstanceCheck) {
                return (0, types_1.combineTypes)(filterFunctionType(subtype, (0, typeUtils_1.convertToInstance)(unexpandedSubtype)));
            }
            if ((0, types_1.isInstantiableClass)(subtype) || isSubtypeMetaclass) {
                // Handle the special case of isinstance(x, metaclass).
                const includesMetaclassType = filterTypes.some((classType) => (0, typeUtils_1.isInstantiableMetaclass)(classType));
                if (isPositiveTest) {
                    return includesMetaclassType ? negativeFallback : undefined;
                }
                else {
                    return includesMetaclassType ? undefined : negativeFallback;
                }
            }
        }
        else {
            if ((0, typeUtils_1.isNoneTypeClass)(subtype)) {
                return classListContainsNoneType() === isPositiveTest ? subtype : undefined;
            }
            if ((0, types_1.isClass)(subtype)) {
                if ((0, types_1.isInstantiableClass)(subtype)) {
                    return (0, types_1.combineTypes)(filterClassType(unexpandedSubtype, subtype, (0, typeUtils_1.getTypeCondition)(subtype), negativeFallback));
                }
                else if ((0, typeUtils_1.isMetaclassInstance)(subtype)) {
                    return (0, types_1.combineTypes)(filterMetaclassType(subtype, negativeFallback));
                }
            }
            if (isSubtypeMetaclass) {
                const objectType = evaluator.getBuiltInObject(errorNode, 'object');
                if (objectType && (0, types_1.isClassInstance)(objectType)) {
                    return (0, types_1.combineTypes)(filterClassType((0, typeUtils_1.convertToInstantiable)(unexpandedSubtype), types_1.ClassType.cloneAsInstantiable(objectType), (0, typeUtils_1.getTypeCondition)(subtype), negativeFallback));
                }
            }
        }
        return isPositiveTest ? undefined : negativeFallback;
    });
    // If the result is Any/Unknown and contains no other subtypes and
    // we have substitutions for Any/Unknown, use those instead. We don't
    // want to apply this if the filtering produced something other than
    // Any/Unknown. For example, if the statement is "isinstance(x, list)"
    // and the type of x is "List[str] | int | Any", the result should be
    // "List[str]", not "List[str] | List[Unknown]".
    if ((0, types_1.isNever)(filteredType) && anyOrUnknownSubstitutions.length > 0) {
        return (0, types_1.combineTypes)(anyOrUnknownSubstitutions);
    }
    if ((0, types_1.isNever)(filteredType) && anyOrUnknown.length > 0) {
        return (0, types_1.combineTypes)(anyOrUnknown);
    }
    return filteredType;
}
// Attempts to narrow a union of tuples based on their known length.
function narrowTypeForTupleLength(evaluator, referenceType, lengthValue, isPositiveTest, isLessThanCheck) {
    return (0, typeUtils_1.mapSubtypes)(referenceType, (subtype) => {
        const concreteSubtype = evaluator.makeTopLevelTypeVarsConcrete(subtype);
        // If it's not a tuple, we can't narrow it.
        if (!(0, types_1.isClassInstance)(concreteSubtype) ||
            !(0, typeUtils_1.isTupleClass)(concreteSubtype) ||
            !concreteSubtype.tupleTypeArguments) {
            return subtype;
        }
        // If the tuple contains a variadic TypeVar, we can't narrow it.
        if (concreteSubtype.tupleTypeArguments.some((typeArg) => (0, types_1.isUnpackedVariadicTypeVar)(typeArg.type))) {
            return subtype;
        }
        // If the tuple contains no unbounded elements, then we know its length exactly.
        if (!concreteSubtype.tupleTypeArguments.some((typeArg) => typeArg.isUnbounded)) {
            const tupleLengthMatches = isLessThanCheck
                ? concreteSubtype.tupleTypeArguments.length < lengthValue
                : concreteSubtype.tupleTypeArguments.length === lengthValue;
            return tupleLengthMatches === isPositiveTest ? subtype : undefined;
        }
        // The tuple contains a "...". We'll expand this into as many elements as
        // necessary to match the lengthValue.
        const elementsToAdd = lengthValue - concreteSubtype.tupleTypeArguments.length + 1;
        if (!isLessThanCheck) {
            // If the specified length is smaller than the minimum length of this tuple,
            // we can rule it out for a positive test and rule it in for a negative test.
            if (elementsToAdd < 0) {
                return isPositiveTest ? undefined : subtype;
            }
            if (!isPositiveTest) {
                return subtype;
            }
            return expandUnboundedTupleElement(concreteSubtype, elementsToAdd, /* keepUnbounded */ false);
        }
        // If this is a tuple related to an "*args: P.args" parameter, don't expand it.
        if ((0, types_1.isParamSpec)(subtype) && subtype.paramSpecAccess) {
            return subtype;
        }
        // Place an upper limit on the number of union subtypes we
        // will expand the tuple to.
        const maxTupleUnionExpansion = 32;
        if (elementsToAdd > maxTupleUnionExpansion) {
            return subtype;
        }
        if (isPositiveTest) {
            if (elementsToAdd < 1) {
                return undefined;
            }
            const typesToCombine = [];
            for (let i = 0; i < elementsToAdd; i++) {
                typesToCombine.push(expandUnboundedTupleElement(concreteSubtype, i, /* keepUnbounded */ false));
            }
            return (0, types_1.combineTypes)(typesToCombine);
        }
        return expandUnboundedTupleElement(concreteSubtype, elementsToAdd, /* keepUnbounded */ true);
    });
}
// Expands a tuple type that contains an unbounded element to include
// multiple bounded elements of that same type in place of (or in addition
// to) the unbounded element.
function expandUnboundedTupleElement(tupleType, elementsToAdd, keepUnbounded) {
    const tupleTypeArgs = [];
    tupleType.tupleTypeArguments.forEach((typeArg) => {
        if (!typeArg.isUnbounded) {
            tupleTypeArgs.push(typeArg);
        }
        else {
            for (let i = 0; i < elementsToAdd; i++) {
                tupleTypeArgs.push({ isUnbounded: false, type: typeArg.type });
            }
            if (keepUnbounded) {
                tupleTypeArgs.push(typeArg);
            }
        }
    });
    return (0, typeUtils_1.specializeTupleClass)(tupleType, tupleTypeArgs);
}
// Attempts to narrow a type (make it more constrained) based on an "in" binary operator.
function narrowTypeForContainerType(evaluator, referenceType, containerType, isPositiveTest) {
    if (isPositiveTest) {
        const elementType = getElementTypeForContainerNarrowing(containerType);
        if (!elementType) {
            return referenceType;
        }
        return narrowTypeForContainerElementType(evaluator, referenceType, evaluator.makeTopLevelTypeVarsConcrete(elementType));
    }
    // Narrowing in the negative case is possible only with tuples
    // with a known length.
    if (!(0, types_1.isClassInstance)(containerType) ||
        !types_1.ClassType.isBuiltIn(containerType, 'tuple') ||
        !containerType.tupleTypeArguments) {
        return referenceType;
    }
    // Determine which tuple types can be eliminated. Only "None" and
    // literal types can be handled here.
    const typesToEliminate = [];
    containerType.tupleTypeArguments.forEach((tupleEntry) => {
        if (!tupleEntry.isUnbounded) {
            if ((0, typeUtils_1.isNoneInstance)(tupleEntry.type)) {
                typesToEliminate.push(tupleEntry.type);
            }
            else if ((0, types_1.isClassInstance)(tupleEntry.type) && (0, typeUtils_1.isLiteralType)(tupleEntry.type)) {
                typesToEliminate.push(tupleEntry.type);
            }
        }
    });
    if (typesToEliminate.length === 0) {
        return referenceType;
    }
    return (0, typeUtils_1.mapSubtypes)(referenceType, (referenceSubtype) => {
        referenceSubtype = evaluator.makeTopLevelTypeVarsConcrete(referenceSubtype);
        if ((0, types_1.isClassInstance)(referenceSubtype) && referenceSubtype.literalValue === undefined) {
            // If we're able to enumerate all possible literal values
            // (for bool or enum), we can eliminate all others in a negative test.
            const allLiteralTypes = enumerateLiteralsForType(evaluator, referenceSubtype);
            if (allLiteralTypes && allLiteralTypes.length > 0) {
                return (0, types_1.combineTypes)(allLiteralTypes.filter((type) => !typesToEliminate.some((t) => (0, types_1.isTypeSame)(t, type))));
            }
        }
        if (typesToEliminate.some((t) => (0, types_1.isTypeSame)(t, referenceSubtype))) {
            return undefined;
        }
        return referenceSubtype;
    });
}
function getElementTypeForContainerNarrowing(containerType) {
    // We support contains narrowing only for certain built-in types that have been specialized.
    const supportedContainers = ['list', 'set', 'frozenset', 'deque', 'tuple', 'dict', 'defaultdict', 'OrderedDict'];
    if (!(0, types_1.isClassInstance)(containerType) || !types_1.ClassType.isBuiltIn(containerType, supportedContainers)) {
        return undefined;
    }
    if (!containerType.typeArguments || containerType.typeArguments.length < 1) {
        return undefined;
    }
    let elementType = containerType.typeArguments[0];
    if ((0, typeUtils_1.isTupleClass)(containerType) && containerType.tupleTypeArguments) {
        elementType = (0, types_1.combineTypes)(containerType.tupleTypeArguments.map((t) => t.type));
    }
    return elementType;
}
exports.getElementTypeForContainerNarrowing = getElementTypeForContainerNarrowing;
function narrowTypeForContainerElementType(evaluator, referenceType, elementType) {
    let canNarrow = true;
    const elementTypeWithoutLiteral = evaluator.stripLiteralValue(elementType);
    // Look for cases where one or more of the reference subtypes are
    // supertypes of the element types. For example, if the element type
    // is "int | str" and the reference type is "float | bytes", we can
    // narrow the reference type to "float" because it is a supertype of "int".
    const narrowedSupertypes = evaluator.mapSubtypesExpandTypeVars(referenceType, 
    /* options */ undefined, (referenceSubtype) => {
        if ((0, types_1.isAnyOrUnknown)(referenceSubtype)) {
            canNarrow = false;
            return referenceSubtype;
        }
        // Handle "type" specially.
        if ((0, types_1.isClassInstance)(referenceSubtype) && types_1.ClassType.isBuiltIn(referenceSubtype, 'type')) {
            canNarrow = false;
            return referenceSubtype;
        }
        if (evaluator.assignType(elementType, referenceSubtype)) {
            return referenceSubtype;
        }
        if (evaluator.assignType(elementTypeWithoutLiteral, referenceSubtype)) {
            return (0, typeUtils_1.mapSubtypes)(elementType, (elementSubtype) => {
                if ((0, types_1.isClassInstance)(elementSubtype) &&
                    (0, types_1.isSameWithoutLiteralValue)(referenceSubtype, elementSubtype)) {
                    return elementSubtype;
                }
                return undefined;
            });
        }
        return undefined;
    });
    // Look for cases where one or more of the reference subtypes are
    // subtypes of the element types. For example, if the element type
    // is "int | str" and the reference type is "object", we can
    // narrow the reference type to "int | str" because they are both
    // subtypes of "object".
    const narrowedSubtypes = evaluator.mapSubtypesExpandTypeVars(elementType, 
    /* options */ undefined, (elementSubtype) => {
        if ((0, types_1.isAnyOrUnknown)(elementSubtype)) {
            canNarrow = false;
            return referenceType;
        }
        // Handle the special case where the reference type is a dict or Mapping and
        // the element type is a TypedDict. In this case, we can't say whether there
        // is a type overlap, so don't apply narrowing.
        if ((0, types_1.isClassInstance)(referenceType) && types_1.ClassType.isBuiltIn(referenceType, ['dict', 'Mapping'])) {
            if ((0, types_1.isClassInstance)(elementSubtype) && types_1.ClassType.isTypedDictClass(elementSubtype)) {
                return elementSubtype;
            }
        }
        if (evaluator.assignType(referenceType, elementSubtype)) {
            return elementSubtype;
        }
        return undefined;
    });
    return canNarrow ? (0, types_1.combineTypes)([narrowedSupertypes, narrowedSubtypes]) : referenceType;
}
exports.narrowTypeForContainerElementType = narrowTypeForContainerElementType;
// Attempts to narrow a type based on whether it is a TypedDict with
// a literal key value.
function narrowTypeForTypedDictKey(evaluator, referenceType, literalKey, isPositiveTest) {
    const narrowedType = evaluator.mapSubtypesExpandTypeVars(referenceType, 
    /* options */ undefined, (subtype, unexpandedSubtype) => {
        var _a, _b;
        if ((0, types_1.isParamSpec)(unexpandedSubtype)) {
            return unexpandedSubtype;
        }
        if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isTypedDictClass(subtype)) {
            const entries = (0, typedDicts_1.getTypedDictMembersForClass)(evaluator, subtype, /* allowNarrowed */ true);
            const tdEntry = (_a = entries.knownItems.get(literalKey.literalValue)) !== null && _a !== void 0 ? _a : entries.extraItems;
            if (isPositiveTest) {
                if (!tdEntry) {
                    return undefined;
                }
                // If the entry is currently not required and not marked provided, we can mark
                // it as provided after this guard expression confirms it is.
                if (tdEntry.isRequired || tdEntry.isProvided) {
                    return subtype;
                }
                const newNarrowedEntriesMap = new Map((_b = subtype.typedDictNarrowedEntries) !== null && _b !== void 0 ? _b : []);
                // Add the new entry.
                newNarrowedEntriesMap.set(literalKey.literalValue, {
                    valueType: tdEntry.valueType,
                    isReadOnly: tdEntry.isReadOnly,
                    isRequired: false,
                    isProvided: true,
                });
                // Clone the TypedDict object with the new entries.
                return types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneForNarrowedTypedDictEntries(types_1.ClassType.cloneAsInstantiable(subtype), newNarrowedEntriesMap));
            }
            else {
                return tdEntry !== undefined && (tdEntry.isRequired || tdEntry.isProvided) ? undefined : subtype;
            }
        }
        return subtype;
    });
    return narrowedType;
}
// Attempts to narrow a TypedDict type based on a comparison (equal or not
// equal) between a discriminating entry type that has a declared literal
// type to a literal value.
function narrowTypeForDiscriminatedDictEntryComparison(evaluator, referenceType, indexLiteralType, literalType, isPositiveTest) {
    let canNarrow = true;
    const narrowedType = (0, typeUtils_1.mapSubtypes)(referenceType, (subtype) => {
        if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isTypedDictClass(subtype)) {
            const symbolMap = (0, typedDicts_1.getTypedDictMembersForClass)(evaluator, subtype);
            const tdEntry = symbolMap.knownItems.get(indexLiteralType.literalValue);
            if (tdEntry && (0, typeUtils_1.isLiteralTypeOrUnion)(tdEntry.valueType)) {
                if (isPositiveTest) {
                    let foundMatch = false;
                    (0, typeUtils_1.doForEachSubtype)(literalType, (literalSubtype) => {
                        if (evaluator.assignType(tdEntry.valueType, literalSubtype)) {
                            foundMatch = true;
                        }
                    });
                    return foundMatch ? subtype : undefined;
                }
                else {
                    let foundNonMatch = false;
                    (0, typeUtils_1.doForEachSubtype)(literalType, (literalSubtype) => {
                        if (!evaluator.assignType(literalSubtype, tdEntry.valueType)) {
                            foundNonMatch = true;
                        }
                    });
                    return foundNonMatch ? subtype : undefined;
                }
            }
        }
        canNarrow = false;
        return subtype;
    });
    return canNarrow ? narrowedType : referenceType;
}
exports.narrowTypeForDiscriminatedDictEntryComparison = narrowTypeForDiscriminatedDictEntryComparison;
function narrowTypeForDiscriminatedTupleComparison(evaluator, referenceType, indexLiteralType, literalType, isPositiveTest) {
    let canNarrow = true;
    const narrowedType = (0, typeUtils_1.mapSubtypes)(referenceType, (subtype) => {
        var _a;
        if ((0, types_1.isClassInstance)(subtype) &&
            types_1.ClassType.isTupleClass(subtype) &&
            !(0, typeUtils_1.isUnboundedTupleClass)(subtype) &&
            typeof indexLiteralType.literalValue === 'number' &&
            (0, types_1.isClassInstance)(literalType)) {
            const indexValue = indexLiteralType.literalValue;
            if (subtype.tupleTypeArguments && indexValue >= 0 && indexValue < subtype.tupleTypeArguments.length) {
                const tupleEntryType = (_a = subtype.tupleTypeArguments[indexValue]) === null || _a === void 0 ? void 0 : _a.type;
                if (tupleEntryType && (0, typeUtils_1.isLiteralTypeOrUnion)(tupleEntryType)) {
                    if (isPositiveTest) {
                        return evaluator.assignType(tupleEntryType, literalType) ? subtype : undefined;
                    }
                    else {
                        return evaluator.assignType(literalType, tupleEntryType) ? undefined : subtype;
                    }
                }
            }
        }
        canNarrow = false;
        return subtype;
    });
    return canNarrow ? narrowedType : referenceType;
}
exports.narrowTypeForDiscriminatedTupleComparison = narrowTypeForDiscriminatedTupleComparison;
// Attempts to narrow a type based on a comparison (equal or not equal)
// between a discriminating field that has a declared literal type to a
// literal value.
function narrowTypeForDiscriminatedLiteralFieldComparison(evaluator, referenceType, memberName, literalType, isPositiveTest) {
    const narrowedType = (0, typeUtils_1.mapSubtypes)(referenceType, (subtype) => {
        var _a;
        let memberInfo;
        if ((0, types_1.isClassInstance)(subtype)) {
            memberInfo = (0, typeUtils_1.lookUpObjectMember)(subtype, memberName);
        }
        else if ((0, types_1.isInstantiableClass)(subtype)) {
            memberInfo = (0, typeUtils_1.lookUpClassMember)(subtype, memberName);
        }
        if (memberInfo && memberInfo.isTypeDeclared) {
            let memberType = evaluator.getTypeOfMember(memberInfo);
            // Handle the case where the field is a property
            // that has a declared literal return type for its getter.
            if ((0, types_1.isClassInstance)(subtype) && (0, types_1.isClassInstance)(memberType) && (0, typeUtils_1.isProperty)(memberType)) {
                const getterType = (_a = memberType.fgetInfo) === null || _a === void 0 ? void 0 : _a.methodType;
                if (getterType && getterType.details.declaredReturnType) {
                    const getterReturnType = types_1.FunctionType.getEffectiveReturnType(getterType);
                    if (getterReturnType) {
                        memberType = getterReturnType;
                    }
                }
            }
            if ((0, typeUtils_1.isLiteralTypeOrUnion)(memberType, /* allowNone */ true)) {
                if (isPositiveTest) {
                    return evaluator.assignType(memberType, literalType) ? subtype : undefined;
                }
                else {
                    return evaluator.assignType(literalType, memberType) ? undefined : subtype;
                }
            }
        }
        return subtype;
    });
    return narrowedType;
}
exports.narrowTypeForDiscriminatedLiteralFieldComparison = narrowTypeForDiscriminatedLiteralFieldComparison;
// Attempts to narrow a type based on a comparison (equal or not equal)
// between a discriminating field that has a declared None type to a
// None.
function narrowTypeForDiscriminatedFieldNoneComparison(evaluator, referenceType, memberName, isPositiveTest) {
    return (0, typeUtils_1.mapSubtypes)(referenceType, (subtype) => {
        let memberInfo;
        if ((0, types_1.isClassInstance)(subtype)) {
            memberInfo = (0, typeUtils_1.lookUpObjectMember)(subtype, memberName);
        }
        else if ((0, types_1.isInstantiableClass)(subtype)) {
            memberInfo = (0, typeUtils_1.lookUpClassMember)(subtype, memberName);
        }
        if (memberInfo && memberInfo.isTypeDeclared) {
            const memberType = evaluator.makeTopLevelTypeVarsConcrete(evaluator.getTypeOfMember(memberInfo));
            let canNarrow = true;
            if (isPositiveTest) {
                (0, typeUtils_1.doForEachSubtype)(memberType, (memberSubtype) => {
                    memberSubtype = evaluator.makeTopLevelTypeVarsConcrete(memberSubtype);
                    // Don't attempt to narrow if the member is a descriptor or property.
                    if ((0, typeUtils_1.isProperty)(memberSubtype) || (0, typeUtils_1.isMaybeDescriptorInstance)(memberSubtype)) {
                        canNarrow = false;
                    }
                    if ((0, types_1.isAnyOrUnknown)(memberSubtype) || (0, typeUtils_1.isNoneInstance)(memberSubtype) || (0, types_1.isNever)(memberSubtype)) {
                        canNarrow = false;
                    }
                });
            }
            else {
                canNarrow = (0, typeUtils_1.isNoneInstance)(memberType);
            }
            if (canNarrow) {
                return undefined;
            }
        }
        return subtype;
    });
}
// Attempts to narrow a type based on a "type(x) is y" or "type(x) is not y" check.
function narrowTypeForTypeIs(evaluator, type, classType, isPositiveTest) {
    return evaluator.mapSubtypesExpandTypeVars(type, 
    /* options */ undefined, (subtype, unexpandedSubtype) => {
        if ((0, types_1.isClassInstance)(subtype)) {
            const matches = types_1.ClassType.isDerivedFrom(classType, types_1.ClassType.cloneAsInstantiable(subtype));
            if (isPositiveTest) {
                if (matches) {
                    if (types_1.ClassType.isSameGenericClass(subtype, classType)) {
                        return subtype;
                    }
                    return (0, typeUtils_1.addConditionToType)(types_1.ClassType.cloneAsInstance(classType), subtype.condition);
                }
                if (!classType.includeSubclasses) {
                    return undefined;
                }
            }
            else if (!classType.includeSubclasses) {
                // If the class if marked final and it matches, then
                // we can eliminate it in the negative case.
                if (matches && types_1.ClassType.isFinal(subtype)) {
                    return undefined;
                }
                // We can't eliminate the subtype in the negative
                // case because it could be a subclass of the type,
                // in which case `type(x) is y` would fail.
                return subtype;
            }
        }
        else if ((0, typeUtils_1.isNoneInstance)(subtype)) {
            return isPositiveTest ? undefined : subtype;
        }
        else if ((0, types_1.isAnyOrUnknown)(subtype)) {
            return isPositiveTest ? types_1.ClassType.cloneAsInstance(classType) : subtype;
        }
        return unexpandedSubtype;
    });
}
// Attempts to narrow a type based on a comparison with a class using "is" or
// "is not". This pattern is sometimes used for sentinels.
function narrowTypeForClassComparison(evaluator, referenceType, classType, isPositiveTest) {
    return (0, typeUtils_1.mapSubtypes)(referenceType, (subtype) => {
        let concreteSubtype = evaluator.makeTopLevelTypeVarsConcrete(subtype);
        if (isPositiveTest) {
            if ((0, typeUtils_1.isNoneInstance)(concreteSubtype)) {
                return (0, typeUtils_1.isNoneTypeClass)(classType) ? classType : undefined;
            }
            if ((0, types_1.isClassInstance)(concreteSubtype) &&
                types_1.TypeBase.isInstance(subtype) &&
                types_1.ClassType.isBuiltIn(concreteSubtype, 'type')) {
                concreteSubtype =
                    concreteSubtype.typeArguments && concreteSubtype.typeArguments.length > 0
                        ? (0, typeUtils_1.convertToInstantiable)(concreteSubtype.typeArguments[0])
                        : types_1.UnknownType.create();
            }
            if ((0, types_1.isAnyOrUnknown)(concreteSubtype)) {
                return classType;
            }
            if ((0, types_1.isClass)(concreteSubtype)) {
                if (types_1.TypeBase.isInstance(concreteSubtype)) {
                    return types_1.ClassType.isBuiltIn(concreteSubtype, 'object') ? classType : undefined;
                }
                const isSuperType = isIsinstanceFilterSuperclass(evaluator, subtype, concreteSubtype, classType, classType, 
                /* isInstanceCheck */ false);
                if (!classType.includeSubclasses) {
                    // Handle the case where the LHS and RHS operands are specific
                    // classes, as opposed to types that represent classes and their
                    // subclasses.
                    if (!concreteSubtype.includeSubclasses) {
                        return types_1.ClassType.isSameGenericClass(concreteSubtype, classType) ? classType : undefined;
                    }
                    const isSubType = isIsinstanceFilterSubclass(evaluator, concreteSubtype, classType, 
                    /* isInstanceCheck */ false);
                    if (isSuperType) {
                        return classType;
                    }
                    if (isSubType) {
                        return (0, typeUtils_1.addConditionToType)(classType, (0, typeUtils_1.getTypeCondition)(concreteSubtype));
                    }
                    return undefined;
                }
                if (types_1.ClassType.isFinal(concreteSubtype) && !isSuperType) {
                    return undefined;
                }
            }
        }
        else {
            if ((0, types_1.isInstantiableClass)(concreteSubtype) &&
                types_1.ClassType.isSameGenericClass(classType, concreteSubtype) &&
                types_1.ClassType.isFinal(classType)) {
                return undefined;
            }
        }
        return subtype;
    });
}
// Attempts to narrow a type (make it more constrained) based on a comparison
// (equal or not equal) to a literal value. It also handles "is" or "is not"
// operators if isIsOperator is true.
function narrowTypeForLiteralComparison(evaluator, referenceType, literalType, isPositiveTest, isIsOperator) {
    return (0, typeUtils_1.mapSubtypes)(referenceType, (subtype) => {
        subtype = evaluator.makeTopLevelTypeVarsConcrete(subtype);
        if ((0, types_1.isAnyOrUnknown)(subtype)) {
            if (isPositiveTest) {
                return literalType;
            }
            return subtype;
        }
        else if ((0, types_1.isClassInstance)(subtype) && types_1.ClassType.isSameGenericClass(literalType, subtype)) {
            if (subtype.literalValue !== undefined) {
                const literalValueMatches = types_1.ClassType.isLiteralValueSame(subtype, literalType);
                if ((literalValueMatches && !isPositiveTest) || (!literalValueMatches && isPositiveTest)) {
                    return undefined;
                }
                return subtype;
            }
            else if (isPositiveTest) {
                return literalType;
            }
            else {
                // If we're able to enumerate all possible literal values
                // (for bool or enum), we can eliminate all others in a negative test.
                const allLiteralTypes = enumerateLiteralsForType(evaluator, subtype);
                if (allLiteralTypes && allLiteralTypes.length > 0) {
                    return (0, types_1.combineTypes)(allLiteralTypes.filter((type) => !types_1.ClassType.isLiteralValueSame(type, literalType)));
                }
            }
        }
        else if (isPositiveTest) {
            if (isIsOperator || (0, typeUtils_1.isNoneInstance)(subtype)) {
                const isSubtype = evaluator.assignType(subtype, literalType);
                return isSubtype ? literalType : undefined;
            }
        }
        return subtype;
    });
}
function enumerateLiteralsForType(evaluator, type) {
    if (types_1.ClassType.isBuiltIn(type, 'bool')) {
        // Booleans have only two types: True and False.
        return [
            types_1.ClassType.cloneWithLiteral(type, /* value */ true),
            types_1.ClassType.cloneWithLiteral(type, /* value */ false),
        ];
    }
    if (types_1.ClassType.isEnumClass(type)) {
        // Enum expansion doesn't apply to enum classes that derive
        // from enum.Flag.
        if (type.details.baseClasses.some((baseClass) => (0, types_1.isClass)(baseClass) && types_1.ClassType.isBuiltIn(baseClass, 'Flag'))) {
            return undefined;
        }
        // Enumerate all of the values in this enumeration.
        const enumList = [];
        const fields = types_1.ClassType.getSymbolTable(type);
        fields.forEach((symbol, name) => {
            var _a;
            if (!symbol.isIgnoredForProtocolMatch()) {
                let symbolType = evaluator.getEffectiveTypeOfSymbol(symbol);
                symbolType = (_a = (0, enums_1.transformTypeForEnumMember)(evaluator, type, name)) !== null && _a !== void 0 ? _a : symbolType;
                if ((0, types_1.isClassInstance)(symbolType) &&
                    types_1.ClassType.isSameGenericClass(type, symbolType) &&
                    symbolType.literalValue !== undefined) {
                    enumList.push(symbolType);
                }
            }
        });
        return enumList;
    }
    return undefined;
}
exports.enumerateLiteralsForType = enumerateLiteralsForType;
// Attempts to narrow a type (make it more constrained) based on a
// call to "callable". For example, if the original type of expression "x" is
// Union[Callable[..., Any], Type[int], int], it would remove the "int" because
// it's not callable.
function narrowTypeForCallable(evaluator, type, isPositiveTest, errorNode, allowIntersections) {
    return evaluator.mapSubtypesExpandTypeVars(type, /* options */ undefined, (subtype) => {
        switch (subtype.category) {
            case 4 /* TypeCategory.Function */:
            case 5 /* TypeCategory.OverloadedFunction */: {
                return isPositiveTest ? subtype : undefined;
            }
            case 7 /* TypeCategory.Module */: {
                return isPositiveTest ? undefined : subtype;
            }
            case 6 /* TypeCategory.Class */: {
                if ((0, typeUtils_1.isNoneInstance)(subtype)) {
                    return isPositiveTest ? undefined : subtype;
                }
                if (types_1.TypeBase.isInstantiable(subtype)) {
                    return isPositiveTest ? subtype : undefined;
                }
                // See if the object is callable.
                const callMemberType = (0, typeUtils_1.lookUpClassMember)(subtype, '__call__', 16 /* MemberAccessFlags.SkipInstanceMembers */);
                if (!callMemberType) {
                    if (!isPositiveTest) {
                        return subtype;
                    }
                    if (allowIntersections) {
                        // The type appears to not be callable. It's possible that the
                        // two type is a subclass that is callable. We'll synthesize a
                        // new intersection type.
                        const className = `<callable subtype of ${subtype.details.name}>`;
                        const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(errorNode);
                        let newClassType = types_1.ClassType.createInstantiable(className, ParseTreeUtils.getClassFullName(errorNode, fileInfo.moduleName, className), fileInfo.moduleName, fileInfo.fileUri, 0 /* ClassTypeFlags.None */, ParseTreeUtils.getTypeSourceId(errorNode), 
                        /* declaredMetaclass */ undefined, subtype.details.effectiveMetaclass, subtype.details.docString);
                        newClassType.details.baseClasses = [types_1.ClassType.cloneAsInstantiable(subtype)];
                        (0, typeUtils_1.computeMroLinearization)(newClassType);
                        newClassType = (0, typeUtils_1.addConditionToType)(newClassType, subtype.condition);
                        // Add a __call__ method to the new class.
                        const callMethod = types_1.FunctionType.createSynthesizedInstance('__call__');
                        const selfParam = {
                            category: 0 /* ParameterCategory.Simple */,
                            name: 'self',
                            type: types_1.ClassType.cloneAsInstance(newClassType),
                            hasDeclaredType: true,
                        };
                        types_1.FunctionType.addParameter(callMethod, selfParam);
                        types_1.FunctionType.addDefaultParameters(callMethod);
                        callMethod.details.declaredReturnType = types_1.UnknownType.create();
                        types_1.ClassType.getSymbolTable(newClassType).set('__call__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, callMethod));
                        return types_1.ClassType.cloneAsInstance(newClassType);
                    }
                    return undefined;
                }
                else {
                    return isPositiveTest ? subtype : undefined;
                }
            }
            default: {
                // For all other types, we can't determine whether it's
                // callable or not, so we can't eliminate them.
                return subtype;
            }
        }
    });
}
class Animal {
}
exports.Animal = Animal;
class Dog extends Animal {
}
exports.Dog = Dog;
class Plant {
}
exports.Plant = Plant;
class Tree extends Plant {
}
exports.Tree = Tree;
function func1(val) {
    if (val instanceof Tree) {
        console.log(val);
    }
    else {
        console.log(val);
    }
}
exports.func1 = func1;
//# sourceMappingURL=typeGuards.js.map