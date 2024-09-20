"use strict";
/*
 * operations.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides type evaluation logic for unary, binary, augmented assignment,
 * and ternary operators.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTypeOfTernaryOperation = exports.getTypeOfUnaryOperation = exports.getTypeOfAugmentedAssignment = exports.getTypeOfBinaryOperation = exports.validateBinaryOperation = void 0;
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const pythonVersion_1 = require("../common/pythonVersion");
const localize_1 = require("../localization/localize");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const parseTreeUtils_1 = require("./parseTreeUtils");
const scopeUtils_1 = require("./scopeUtils");
const staticExpressions_1 = require("./staticExpressions");
const typeUtils_1 = require("./typeUtils");
const types_1 = require("./types");
// Maps binary operators to the magic methods that implement them.
const binaryOperatorMap = {
    [0 /* OperatorType.Add */]: ['__add__', '__radd__'],
    [33 /* OperatorType.Subtract */]: ['__sub__', '__rsub__'],
    [26 /* OperatorType.Multiply */]: ['__mul__', '__rmul__'],
    [13 /* OperatorType.FloorDivide */]: ['__floordiv__', '__rfloordiv__'],
    [10 /* OperatorType.Divide */]: ['__truediv__', '__rtruediv__'],
    [24 /* OperatorType.Mod */]: ['__mod__', '__rmod__'],
    [29 /* OperatorType.Power */]: ['__pow__', '__rpow__'],
    [22 /* OperatorType.MatrixMultiply */]: ['__matmul__', '__rmatmul__'],
    [3 /* OperatorType.BitwiseAnd */]: ['__and__', '__rand__'],
    [6 /* OperatorType.BitwiseOr */]: ['__or__', '__ror__'],
    [8 /* OperatorType.BitwiseXor */]: ['__xor__', '__rxor__'],
    [17 /* OperatorType.LeftShift */]: ['__lshift__', '__rlshift__'],
    [31 /* OperatorType.RightShift */]: ['__rshift__', '__rrshift__'],
    [12 /* OperatorType.Equals */]: ['__eq__', '__eq__'],
    [28 /* OperatorType.NotEquals */]: ['__ne__', '__ne__'],
    [20 /* OperatorType.LessThan */]: ['__lt__', '__gt__'],
    [21 /* OperatorType.LessThanOrEqual */]: ['__le__', '__ge__'],
    [15 /* OperatorType.GreaterThan */]: ['__gt__', '__lt__'],
    [16 /* OperatorType.GreaterThanOrEqual */]: ['__ge__', '__le__'],
};
// Map of operators that always return a bool result.
const booleanOperatorMap = {
    [36 /* OperatorType.And */]: true,
    [37 /* OperatorType.Or */]: true,
    [39 /* OperatorType.Is */]: true,
    [40 /* OperatorType.IsNot */]: true,
    [41 /* OperatorType.In */]: true,
    [42 /* OperatorType.NotIn */]: true,
};
// If the number of subtypes starts to explode when applying "literal math",
// cut off the literal union and fall back to the non-literal supertype.
const maxLiteralMathSubtypeCount = 64;
function validateBinaryOperation(evaluator, operator, leftTypeResult, rightTypeResult, errorNode, inferenceContext, diag, options) {
    const leftType = leftTypeResult.type;
    const rightType = rightTypeResult.type;
    const isIncomplete = !!leftTypeResult.isIncomplete || !!rightTypeResult.isIncomplete;
    let type;
    let concreteLeftType = evaluator.makeTopLevelTypeVarsConcrete(leftType);
    if (booleanOperatorMap[operator] !== undefined) {
        // If it's an AND or OR, we need to handle short-circuiting by
        // eliminating any known-truthy or known-falsy types.
        if (operator === 36 /* OperatorType.And */) {
            // If the LHS evaluates to falsy, the And expression will
            // always return the type of the left-hand side.
            if (!evaluator.canBeTruthy(concreteLeftType)) {
                return leftType;
            }
            // If the LHS evaluates to truthy, the And expression will
            // always return the type of the right-hand side.
            if (!evaluator.canBeFalsy(concreteLeftType)) {
                return rightType;
            }
            concreteLeftType = evaluator.removeTruthinessFromType(concreteLeftType);
            if ((0, types_1.isNever)(rightType)) {
                return concreteLeftType;
            }
        }
        else if (operator === 37 /* OperatorType.Or */) {
            // If the LHS evaluates to truthy, the Or expression will
            // always return the type of the left-hand side.
            if (!evaluator.canBeFalsy(concreteLeftType)) {
                return leftType;
            }
            // If the LHS evaluates to falsy, the Or expression will
            // always return the type of the right-hand side.
            if (!evaluator.canBeTruthy(concreteLeftType)) {
                return rightType;
            }
            concreteLeftType = evaluator.removeFalsinessFromType(concreteLeftType);
            if ((0, types_1.isNever)(rightType)) {
                return concreteLeftType;
            }
        }
        if ((0, types_1.isNever)(leftType) || (0, types_1.isNever)(rightType)) {
            return types_1.NeverType.createNever();
        }
        // The "in" and "not in" operators make use of the __contains__
        // magic method.
        if (operator === 41 /* OperatorType.In */ || operator === 42 /* OperatorType.NotIn */) {
            type = evaluator.mapSubtypesExpandTypeVars(rightType, 
            /* options */ undefined, (rightSubtypeExpanded, rightSubtypeUnexpanded) => {
                return evaluator.mapSubtypesExpandTypeVars(concreteLeftType, { conditionFilter: (0, typeUtils_1.getTypeCondition)(rightSubtypeExpanded) }, (leftSubtype) => {
                    var _a;
                    if ((0, types_1.isAnyOrUnknown)(leftSubtype) || (0, types_1.isAnyOrUnknown)(rightSubtypeUnexpanded)) {
                        return (0, typeUtils_1.preserveUnknown)(leftSubtype, rightSubtypeExpanded);
                    }
                    let returnType = evaluator.getTypeOfMagicMethodCall(rightSubtypeExpanded, '__contains__', [{ type: leftSubtype, isIncomplete: leftTypeResult.isIncomplete }], errorNode, 
                    /* inferenceContext */ undefined);
                    if (!returnType) {
                        // If __contains__ was not supported, fall back
                        // on an iterable.
                        const iteratorType = (_a = evaluator.getTypeOfIterator({ type: rightSubtypeExpanded, isIncomplete: rightTypeResult.isIncomplete }, 
                        /* isAsync */ false, errorNode, 
                        /* emitNotIterableError */ false)) === null || _a === void 0 ? void 0 : _a.type;
                        if (iteratorType && evaluator.assignType(iteratorType, leftSubtype)) {
                            returnType = evaluator.getBuiltInObject(errorNode, 'bool');
                        }
                    }
                    if (!returnType) {
                        diag.addMessage(localize_1.LocMessage.typeNotSupportBinaryOperator().format({
                            operator: (0, parseTreeUtils_1.printOperator)(operator),
                            leftType: evaluator.printType(leftSubtype),
                            rightType: evaluator.printType(rightSubtypeExpanded),
                        }));
                    }
                    return returnType;
                });
            });
            // Assume that a bool is returned even if the type is unknown
            if (type && !(0, types_1.isNever)(type)) {
                type = evaluator.getBuiltInObject(errorNode, 'bool');
            }
        }
        else {
            type = evaluator.mapSubtypesExpandTypeVars(concreteLeftType, 
            /* options */ undefined, (leftSubtypeExpanded, leftSubtypeUnexpanded) => {
                return evaluator.mapSubtypesExpandTypeVars(rightType, { conditionFilter: (0, typeUtils_1.getTypeCondition)(leftSubtypeExpanded) }, (rightSubtypeExpanded, rightSubtypeUnexpanded) => {
                    // If the operator is an AND or OR, we need to combine the two types.
                    if (operator === 36 /* OperatorType.And */ || operator === 37 /* OperatorType.Or */) {
                        return (0, types_1.combineTypes)([leftSubtypeUnexpanded, rightSubtypeUnexpanded]);
                    }
                    // The other boolean operators always return a bool value.
                    return evaluator.getBuiltInObject(errorNode, 'bool');
                });
            });
        }
    }
    else if (binaryOperatorMap[operator]) {
        if ((0, types_1.isNever)(leftType) || (0, types_1.isNever)(rightType)) {
            return types_1.NeverType.createNever();
        }
        // Handle certain operations on certain homogenous literal types
        // using special-case math. For example, Literal[1, 2] + Literal[3, 4]
        // should result in Literal[4, 5, 6].
        if (options.isLiteralMathAllowed) {
            const leftLiteralClassName = (0, typeUtils_1.getLiteralTypeClassName)(leftType);
            if (leftLiteralClassName && !(0, typeUtils_1.getTypeCondition)(leftType)) {
                const rightLiteralClassName = (0, typeUtils_1.getLiteralTypeClassName)(rightType);
                if (leftLiteralClassName === rightLiteralClassName &&
                    !(0, typeUtils_1.getTypeCondition)(rightType) &&
                    (0, typeUtils_1.getUnionSubtypeCount)(leftType) * (0, typeUtils_1.getUnionSubtypeCount)(rightType) < maxLiteralMathSubtypeCount) {
                    if (leftLiteralClassName === 'str' || leftLiteralClassName === 'bytes') {
                        if (operator === 0 /* OperatorType.Add */) {
                            type = (0, typeUtils_1.mapSubtypes)(leftType, (leftSubtype) => {
                                return (0, typeUtils_1.mapSubtypes)(rightType, (rightSubtype) => {
                                    const leftClassSubtype = leftSubtype;
                                    const rightClassSubtype = rightSubtype;
                                    return types_1.ClassType.cloneWithLiteral(leftClassSubtype, (leftClassSubtype.literalValue +
                                        rightClassSubtype.literalValue));
                                });
                            });
                        }
                    }
                    else if (leftLiteralClassName === 'int') {
                        if (operator === 0 /* OperatorType.Add */ ||
                            operator === 33 /* OperatorType.Subtract */ ||
                            operator === 26 /* OperatorType.Multiply */ ||
                            operator === 13 /* OperatorType.FloorDivide */ ||
                            operator === 24 /* OperatorType.Mod */) {
                            let isValidResult = true;
                            type = (0, typeUtils_1.mapSubtypes)(leftType, (leftSubtype) => {
                                return (0, typeUtils_1.mapSubtypes)(rightType, (rightSubtype) => {
                                    try {
                                        const leftClassSubtype = leftSubtype;
                                        const rightClassSubtype = rightSubtype;
                                        const leftLiteralValue = BigInt(leftClassSubtype.literalValue);
                                        const rightLiteralValue = BigInt(rightClassSubtype.literalValue);
                                        let newValue;
                                        if (operator === 0 /* OperatorType.Add */) {
                                            newValue = leftLiteralValue + rightLiteralValue;
                                        }
                                        else if (operator === 33 /* OperatorType.Subtract */) {
                                            newValue = leftLiteralValue - rightLiteralValue;
                                        }
                                        else if (operator === 26 /* OperatorType.Multiply */) {
                                            newValue = leftLiteralValue * rightLiteralValue;
                                        }
                                        else if (operator === 13 /* OperatorType.FloorDivide */) {
                                            if (rightLiteralValue !== BigInt(0)) {
                                                newValue = leftLiteralValue / rightLiteralValue;
                                            }
                                        }
                                        else if (operator === 24 /* OperatorType.Mod */) {
                                            if (rightLiteralValue !== BigInt(0)) {
                                                newValue = leftLiteralValue % rightLiteralValue;
                                            }
                                        }
                                        if (newValue === undefined) {
                                            isValidResult = false;
                                            return undefined;
                                        }
                                        else if (typeof newValue === 'number' && isNaN(newValue)) {
                                            isValidResult = false;
                                            return undefined;
                                        }
                                        else {
                                            // Convert back to a simple number if it fits. Leave as a bigint
                                            // if it doesn't.
                                            if (newValue >= Number.MIN_SAFE_INTEGER &&
                                                newValue <= Number.MAX_SAFE_INTEGER) {
                                                newValue = Number(newValue);
                                            }
                                            return types_1.ClassType.cloneWithLiteral(leftClassSubtype, newValue);
                                        }
                                    }
                                    catch {
                                        isValidResult = false;
                                        return undefined;
                                    }
                                });
                            });
                            if (!isValidResult) {
                                type = undefined;
                            }
                        }
                    }
                }
            }
        }
        if (!type) {
            type = evaluator.mapSubtypesExpandTypeVars(leftType, 
            /* options */ undefined, (leftSubtypeExpanded, leftSubtypeUnexpanded) => {
                return evaluator.mapSubtypesExpandTypeVars(rightType, { conditionFilter: (0, typeUtils_1.getTypeCondition)(leftSubtypeExpanded) }, (rightSubtypeExpanded, rightSubtypeUnexpanded) => {
                    if ((0, types_1.isAnyOrUnknown)(leftSubtypeUnexpanded) || (0, types_1.isAnyOrUnknown)(rightSubtypeUnexpanded)) {
                        return (0, typeUtils_1.preserveUnknown)(leftSubtypeUnexpanded, rightSubtypeUnexpanded);
                    }
                    const tupleClassType = evaluator.getTupleClassType();
                    // Special-case __add__ for tuples when the types for both tuples are known.
                    if (options.isTupleAddAllowed &&
                        operator === 0 /* OperatorType.Add */ &&
                        (0, types_1.isClassInstance)(leftSubtypeExpanded) &&
                        (0, typeUtils_1.isTupleClass)(leftSubtypeExpanded) &&
                        leftSubtypeExpanded.tupleTypeArguments &&
                        (0, types_1.isClassInstance)(rightSubtypeExpanded) &&
                        (0, typeUtils_1.isTupleClass)(rightSubtypeExpanded) &&
                        rightSubtypeExpanded.tupleTypeArguments &&
                        tupleClassType &&
                        (0, types_1.isInstantiableClass)(tupleClassType)) {
                        // If at least one of the tuples is of fixed size, we can
                        // combine them into a precise new type. If both are unbounded
                        // (or contain an unbounded element), we cannot combine them
                        // in this manner because tuples can contain at most one
                        // unbounded element.
                        if (!(0, typeUtils_1.isUnboundedTupleClass)(leftSubtypeExpanded) ||
                            !(0, typeUtils_1.isUnboundedTupleClass)(rightSubtypeExpanded)) {
                            return types_1.ClassType.cloneAsInstance((0, typeUtils_1.specializeTupleClass)(tupleClassType, [
                                ...leftSubtypeExpanded.tupleTypeArguments,
                                ...rightSubtypeExpanded.tupleTypeArguments,
                            ]));
                        }
                    }
                    const magicMethodName = binaryOperatorMap[operator][0];
                    let resultType = evaluator.getTypeOfMagicMethodCall(convertFunctionToObject(evaluator, leftSubtypeUnexpanded), magicMethodName, [{ type: rightSubtypeUnexpanded, isIncomplete: rightTypeResult.isIncomplete }], errorNode, inferenceContext);
                    if (!resultType && leftSubtypeUnexpanded !== leftSubtypeExpanded) {
                        // Try the expanded left type.
                        resultType = evaluator.getTypeOfMagicMethodCall(convertFunctionToObject(evaluator, leftSubtypeExpanded), magicMethodName, [{ type: rightSubtypeUnexpanded, isIncomplete: rightTypeResult.isIncomplete }], errorNode, inferenceContext);
                    }
                    if (!resultType && rightSubtypeUnexpanded !== rightSubtypeExpanded) {
                        // Try the expanded left and right type.
                        resultType = evaluator.getTypeOfMagicMethodCall(convertFunctionToObject(evaluator, leftSubtypeExpanded), magicMethodName, [{ type: rightSubtypeExpanded, isIncomplete: rightTypeResult.isIncomplete }], errorNode, inferenceContext);
                    }
                    if (!resultType) {
                        // Try the alternate form (swapping right and left).
                        const altMagicMethodName = binaryOperatorMap[operator][1];
                        resultType = evaluator.getTypeOfMagicMethodCall(convertFunctionToObject(evaluator, rightSubtypeUnexpanded), altMagicMethodName, [{ type: leftSubtypeUnexpanded, isIncomplete: leftTypeResult.isIncomplete }], errorNode, inferenceContext);
                        if (!resultType && rightSubtypeUnexpanded !== rightSubtypeExpanded) {
                            // Try the expanded right type.
                            resultType = evaluator.getTypeOfMagicMethodCall(convertFunctionToObject(evaluator, rightSubtypeExpanded), altMagicMethodName, [
                                {
                                    type: leftSubtypeUnexpanded,
                                    isIncomplete: leftTypeResult.isIncomplete,
                                },
                            ], errorNode, inferenceContext);
                        }
                        if (!resultType && leftSubtypeUnexpanded !== leftSubtypeExpanded) {
                            // Try the expanded right and left type.
                            resultType = evaluator.getTypeOfMagicMethodCall(convertFunctionToObject(evaluator, rightSubtypeExpanded), altMagicMethodName, [{ type: leftSubtypeExpanded, isIncomplete: leftTypeResult.isIncomplete }], errorNode, inferenceContext);
                        }
                    }
                    if (!resultType) {
                        if (inferenceContext) {
                            diag.addMessage(localize_1.LocMessage.typeNotSupportBinaryOperatorBidirectional().format({
                                operator: (0, parseTreeUtils_1.printOperator)(operator),
                                leftType: evaluator.printType(leftSubtypeExpanded),
                                rightType: evaluator.printType(rightSubtypeExpanded),
                                expectedType: evaluator.printType(inferenceContext.expectedType),
                            }));
                        }
                        else {
                            diag.addMessage(localize_1.LocMessage.typeNotSupportBinaryOperator().format({
                                operator: (0, parseTreeUtils_1.printOperator)(operator),
                                leftType: evaluator.printType(leftSubtypeExpanded),
                                rightType: evaluator.printType(rightSubtypeExpanded),
                            }));
                        }
                    }
                    return resultType !== null && resultType !== void 0 ? resultType : types_1.UnknownType.create(isIncomplete);
                });
            });
        }
    }
    return type !== null && type !== void 0 ? type : types_1.UnknownType.create(isIncomplete);
}
exports.validateBinaryOperation = validateBinaryOperation;
function getTypeOfBinaryOperation(evaluator, node, flags, inferenceContext) {
    const leftExpression = node.leftExpression;
    let rightExpression = node.rightExpression;
    let isIncomplete = false;
    let typeErrors = false;
    // If this is a comparison and the left expression is also a comparison,
    // we need to change the behavior to accommodate python's "chained
    // comparisons" feature.
    if ((0, parseTreeUtils_1.operatorSupportsChaining)(node.operator)) {
        if (rightExpression.nodeType === 7 /* ParseNodeType.BinaryOperation */ &&
            !rightExpression.parenthesized &&
            (0, parseTreeUtils_1.operatorSupportsChaining)(rightExpression.operator)) {
            // Evaluate the right expression so it is type checked.
            getTypeOfBinaryOperation(evaluator, rightExpression, flags, inferenceContext);
            // Use the left side of the right expression for comparison purposes.
            rightExpression = rightExpression.leftExpression;
        }
    }
    // For most binary operations, the "expected type" is applied to the output
    // of the magic method for that operation. However, the "or" and "and" operators
    // have no magic method, so we apply the expected type directly to both operands.
    let expectedOperandType = node.operator === 37 /* OperatorType.Or */ || node.operator === 36 /* OperatorType.And */
        ? inferenceContext === null || inferenceContext === void 0 ? void 0 : inferenceContext.expectedType
        : undefined;
    // Handle the very special case where the expected type is a list
    // and the operator is a multiply. This comes up in the common case
    // of "x: List[Optional[X]] = [None] * y" where y is an integer literal.
    let expectedLeftOperandType;
    if (node.operator === 26 /* OperatorType.Multiply */ &&
        inferenceContext &&
        (0, types_1.isClassInstance)(inferenceContext.expectedType) &&
        types_1.ClassType.isBuiltIn(inferenceContext.expectedType, 'list') &&
        inferenceContext.expectedType.typeArguments &&
        inferenceContext.expectedType.typeArguments.length >= 1 &&
        node.leftExpression.nodeType === 34 /* ParseNodeType.List */) {
        expectedLeftOperandType = inferenceContext.expectedType;
    }
    const effectiveExpectedType = expectedOperandType !== null && expectedOperandType !== void 0 ? expectedOperandType : expectedLeftOperandType;
    const leftTypeResult = evaluator.getTypeOfExpression(leftExpression, flags, (0, typeUtils_1.makeInferenceContext)(effectiveExpectedType));
    let leftType = leftTypeResult.type;
    if (!expectedOperandType) {
        if (node.operator === 37 /* OperatorType.Or */ || node.operator === 36 /* OperatorType.And */) {
            // For "or" and "and", use the type of the left operand under certain
            // circumstances. This allows us to infer a better type for expressions
            // like `x or []`. Do this only if it's a generic class (like list or dict)
            // or a TypedDict.
            if ((0, typeUtils_1.someSubtypes)(leftType, (subtype) => {
                if (!(0, types_1.isClassInstance)(subtype)) {
                    return false;
                }
                return types_1.ClassType.isTypedDictClass(subtype) || subtype.details.typeParameters.length > 0;
            })) {
                expectedOperandType = leftType;
            }
        }
        else if (node.operator === 0 /* OperatorType.Add */ && node.rightExpression.nodeType === 34 /* ParseNodeType.List */) {
            // For the "+" operator , use this technique only if the right operand is
            // a list expression. This heuristic handles the common case of `my_list + [0]`.
            expectedOperandType = leftType;
        }
        else if (node.operator === 6 /* OperatorType.BitwiseOr */) {
            // If this is a bitwise or ("|"), use the type of the left operand. This allows
            // us to support the case where a TypedDict is being updated with a dict expression.
            if ((0, types_1.isClassInstance)(leftType) && types_1.ClassType.isTypedDictClass(leftType)) {
                expectedOperandType = leftType;
            }
        }
    }
    const rightTypeResult = evaluator.getTypeOfExpression(rightExpression, flags, (0, typeUtils_1.makeInferenceContext)(expectedOperandType));
    let rightType = rightTypeResult.type;
    if (leftTypeResult.isIncomplete || rightTypeResult.isIncomplete) {
        isIncomplete = true;
    }
    // Is this a "|" operator used in a context where it is supposed to be
    // interpreted as a union operator?
    if (node.operator === 6 /* OperatorType.BitwiseOr */ &&
        !customMetaclassSupportsMethod(leftType, '__or__') &&
        !customMetaclassSupportsMethod(rightType, '__ror__')) {
        let adjustedRightType = rightType;
        let adjustedLeftType = leftType;
        if (!(0, typeUtils_1.isNoneInstance)(leftType) && (0, typeUtils_1.isNoneInstance)(rightType)) {
            // Handle the special case where "None" is being added to the union
            // with something else. Even though "None" will normally be interpreted
            // as the None singleton object in contexts where a type annotation isn't
            // assumed, we'll allow it here.
            adjustedRightType = (0, typeUtils_1.convertToInstantiable)(evaluator.getNoneType());
        }
        else if (!(0, typeUtils_1.isNoneInstance)(rightType) && (0, typeUtils_1.isNoneInstance)(leftType)) {
            adjustedLeftType = (0, typeUtils_1.convertToInstantiable)(evaluator.getNoneType());
        }
        if ((0, typeUtils_1.isUnionableType)([adjustedLeftType, adjustedRightType])) {
            const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(node);
            const unionNotationSupported = fileInfo.isStubFile ||
                (flags & 4 /* EvalFlags.ForwardRefs */) !== 0 ||
                fileInfo.executionEnvironment.pythonVersion.isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_10);
            if (!unionNotationSupported) {
                // If the left type is Any, we can't say for sure whether this
                // is an illegal syntax or a valid application of the "|" operator.
                if (!(0, types_1.isAnyOrUnknown)(adjustedLeftType)) {
                    evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.unionSyntaxIllegal(), node, node.operatorToken);
                }
            }
            const isLeftTypeArgValid = evaluator.validateTypeArg({ ...leftTypeResult, node: leftExpression });
            const isRightTypeArgValid = evaluator.validateTypeArg({ ...rightTypeResult, node: rightExpression });
            if (!isLeftTypeArgValid || !isRightTypeArgValid) {
                return { type: types_1.UnknownType.create() };
            }
            adjustedLeftType = evaluator.reportMissingTypeArguments(node.leftExpression, adjustedLeftType, flags | 128 /* EvalFlags.InstantiableType */);
            adjustedRightType = evaluator.reportMissingTypeArguments(node.rightExpression, adjustedRightType, flags | 128 /* EvalFlags.InstantiableType */);
            let newUnion = (0, types_1.combineTypes)([adjustedLeftType, adjustedRightType]);
            const unionClass = evaluator.getUnionClassType();
            if (unionClass && (0, types_1.isInstantiableClass)(unionClass)) {
                newUnion = types_1.TypeBase.cloneAsSpecialForm(newUnion, types_1.ClassType.cloneAsInstance(unionClass));
            }
            // Check for "stringified" forward reference type expressions. The "|" operator
            // doesn't support these except in certain circumstances. Notably, it can't be used
            // with other strings or with types that are not specialized using an index form.
            if (!fileInfo.isStubFile) {
                let stringNode;
                let otherNode;
                let otherType;
                if (leftExpression.nodeType === 48 /* ParseNodeType.StringList */) {
                    stringNode = leftExpression;
                    otherNode = rightExpression;
                    otherType = rightType;
                }
                else if (rightExpression.nodeType === 48 /* ParseNodeType.StringList */) {
                    stringNode = rightExpression;
                    otherNode = leftExpression;
                    otherType = leftType;
                }
                if (stringNode && otherNode && otherType) {
                    let isAllowed = true;
                    if ((0, types_1.isClass)(otherType)) {
                        if (!otherType.isTypeArgumentExplicit || (0, types_1.isClassInstance)(otherType)) {
                            isAllowed = false;
                        }
                    }
                    if (!isAllowed) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportGeneralTypeIssues, localize_1.LocMessage.unionForwardReferenceNotAllowed(), stringNode);
                    }
                }
            }
            return { type: newUnion };
        }
    }
    if ((flags & 256 /* EvalFlags.TypeExpression */) !== 0) {
        // Exempt "|" because it might be a union operation involving unknowns.
        if (node.operator !== 6 /* OperatorType.BitwiseOr */) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, localize_1.LocMessage.binaryOperationNotAllowed(), node);
            return { type: types_1.UnknownType.create() };
        }
    }
    // Optional checks apply to all operations except for boolean operations.
    let isLeftOptionalType = false;
    if (booleanOperatorMap[node.operator] === undefined) {
        // None is a valid operand for == and != even if the type stub says otherwise.
        if (node.operator === 12 /* OperatorType.Equals */ || node.operator === 28 /* OperatorType.NotEquals */) {
            leftType = (0, typeUtils_1.removeNoneFromUnion)(leftType);
        }
        else {
            isLeftOptionalType = (0, typeUtils_1.isOptionalType)(leftType);
        }
        // None is a valid operand for == and != even if the type stub says otherwise.
        if (node.operator === 12 /* OperatorType.Equals */ || node.operator === 28 /* OperatorType.NotEquals */) {
            rightType = (0, typeUtils_1.removeNoneFromUnion)(rightType);
        }
    }
    const diag = new diagnostic_1.DiagnosticAddendum();
    // Don't use literal math if the operation is within a loop
    // because the literal values may change each time. We also don't want to
    // apply literal math within the body of a lambda because they are often
    // used as callbacks where the value changes each time they are called.
    const isLiteralMathAllowed = !(0, parseTreeUtils_1.isWithinLoop)(node) && !(0, parseTreeUtils_1.getEnclosingLambda)(node);
    // Don't special-case tuple __add__ if the left type is a union. This
    // can result in an infinite loop if we keep creating new tuple types
    // within a loop construct using __add__.
    const isTupleAddAllowed = !(0, types_1.isUnion)(leftType);
    const type = validateBinaryOperation(evaluator, node.operator, { type: leftType, isIncomplete: leftTypeResult.isIncomplete }, { type: rightType, isIncomplete: rightTypeResult.isIncomplete }, node, inferenceContext, diag, { isLiteralMathAllowed, isTupleAddAllowed });
    if (!diag.isEmpty()) {
        typeErrors = true;
        if (!isIncomplete) {
            if (isLeftOptionalType && diag.getMessages().length === 1) {
                // If the left was an optional type and there is just one diagnostic,
                // assume that it was due to a "None" not being supported. Report
                // this as a reportOptionalOperand diagnostic rather than a
                // reportGeneralTypeIssues diagnostic.
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOptionalOperand, localize_1.LocMessage.noneOperator().format({
                    operator: (0, parseTreeUtils_1.printOperator)(node.operator),
                }), node.leftExpression);
            }
            else {
                // If neither the LHS or RHS are unions, don't include a diagnostic addendum
                // because it will be redundant with the main diagnostic message. The addenda
                // are useful only if union expansion was used for one or both operands.
                let diagString = '';
                if ((0, types_1.isUnion)(evaluator.makeTopLevelTypeVarsConcrete(leftType)) ||
                    (0, types_1.isUnion)(evaluator.makeTopLevelTypeVarsConcrete(rightType))) {
                    diagString = diag.getString();
                }
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOperatorIssue, localize_1.LocMessage.typeNotSupportBinaryOperator().format({
                    operator: (0, parseTreeUtils_1.printOperator)(node.operator),
                    leftType: evaluator.printType(leftType),
                    rightType: evaluator.printType(rightType),
                }) + diagString, node);
            }
        }
    }
    return { type, isIncomplete, typeErrors };
}
exports.getTypeOfBinaryOperation = getTypeOfBinaryOperation;
function getTypeOfAugmentedAssignment(evaluator, node, inferenceContext) {
    const operatorMap = {
        [1 /* OperatorType.AddEqual */]: ['__iadd__', 0 /* OperatorType.Add */],
        [34 /* OperatorType.SubtractEqual */]: ['__isub__', 33 /* OperatorType.Subtract */],
        [27 /* OperatorType.MultiplyEqual */]: ['__imul__', 26 /* OperatorType.Multiply */],
        [14 /* OperatorType.FloorDivideEqual */]: ['__ifloordiv__', 13 /* OperatorType.FloorDivide */],
        [11 /* OperatorType.DivideEqual */]: ['__itruediv__', 10 /* OperatorType.Divide */],
        [25 /* OperatorType.ModEqual */]: ['__imod__', 24 /* OperatorType.Mod */],
        [30 /* OperatorType.PowerEqual */]: ['__ipow__', 29 /* OperatorType.Power */],
        [23 /* OperatorType.MatrixMultiplyEqual */]: ['__imatmul__', 22 /* OperatorType.MatrixMultiply */],
        [4 /* OperatorType.BitwiseAndEqual */]: ['__iand__', 3 /* OperatorType.BitwiseAnd */],
        [7 /* OperatorType.BitwiseOrEqual */]: ['__ior__', 6 /* OperatorType.BitwiseOr */],
        [9 /* OperatorType.BitwiseXorEqual */]: ['__ixor__', 8 /* OperatorType.BitwiseXor */],
        [18 /* OperatorType.LeftShiftEqual */]: ['__ilshift__', 17 /* OperatorType.LeftShift */],
        [32 /* OperatorType.RightShiftEqual */]: ['__irshift__', 31 /* OperatorType.RightShift */],
    };
    let type;
    let typeResult;
    const diag = new diagnostic_1.DiagnosticAddendum();
    const leftTypeResult = evaluator.getTypeOfExpression(node.leftExpression);
    const leftType = leftTypeResult.type;
    let expectedOperandType;
    if (node.operator === 7 /* OperatorType.BitwiseOrEqual */) {
        // If this is a bitwise or ("|="), use the type of the left operand. This allows
        // us to support the case where a TypedDict is being updated with a dict expression.
        expectedOperandType = leftType;
    }
    const rightTypeResult = evaluator.getTypeOfExpression(node.rightExpression, 
    /* flags */ undefined, (0, typeUtils_1.makeInferenceContext)(expectedOperandType));
    const rightType = rightTypeResult.type;
    const isIncomplete = !!rightTypeResult.isIncomplete || !!leftTypeResult.isIncomplete;
    if ((0, types_1.isNever)(leftType) || (0, types_1.isNever)(rightType)) {
        typeResult = { type: types_1.NeverType.createNever(), isIncomplete };
    }
    else {
        type = evaluator.mapSubtypesExpandTypeVars(leftType, 
        /* options */ undefined, (leftSubtypeExpanded, leftSubtypeUnexpanded) => {
            return evaluator.mapSubtypesExpandTypeVars(rightType, { conditionFilter: (0, typeUtils_1.getTypeCondition)(leftSubtypeExpanded) }, (rightSubtypeExpanded, rightSubtypeUnexpanded) => {
                if ((0, types_1.isAnyOrUnknown)(leftSubtypeUnexpanded) || (0, types_1.isAnyOrUnknown)(rightSubtypeUnexpanded)) {
                    return (0, typeUtils_1.preserveUnknown)(leftSubtypeUnexpanded, rightSubtypeUnexpanded);
                }
                const magicMethodName = operatorMap[node.operator][0];
                let returnType = evaluator.getTypeOfMagicMethodCall(leftSubtypeUnexpanded, magicMethodName, [{ type: rightSubtypeUnexpanded, isIncomplete: rightTypeResult.isIncomplete }], node, inferenceContext);
                if (!returnType && leftSubtypeUnexpanded !== leftSubtypeExpanded) {
                    // Try with the expanded left type.
                    returnType = evaluator.getTypeOfMagicMethodCall(leftSubtypeExpanded, magicMethodName, [{ type: rightSubtypeUnexpanded, isIncomplete: rightTypeResult.isIncomplete }], node, inferenceContext);
                }
                if (!returnType && rightSubtypeUnexpanded !== rightSubtypeExpanded) {
                    // Try with the expanded left and right type.
                    returnType = evaluator.getTypeOfMagicMethodCall(leftSubtypeExpanded, magicMethodName, [{ type: rightSubtypeExpanded, isIncomplete: rightTypeResult.isIncomplete }], node, inferenceContext);
                }
                if (!returnType) {
                    // If the LHS class didn't support the magic method for augmented
                    // assignment, fall back on the normal binary expression evaluator.
                    const binaryOperator = operatorMap[node.operator][1];
                    // Don't use literal math if the operation is within a loop
                    // because the literal values may change each time.
                    const isLiteralMathAllowed = !(0, parseTreeUtils_1.isWithinLoop)(node) &&
                        isExpressionLocalVariable(evaluator, node.leftExpression) &&
                        (0, typeUtils_1.getUnionSubtypeCount)(leftType) * (0, typeUtils_1.getUnionSubtypeCount)(rightType) <
                            maxLiteralMathSubtypeCount;
                    // Don't special-case tuple __add__ if the left type is a union. This
                    // can result in an infinite loop if we keep creating new tuple types
                    // within a loop construct using __add__.
                    const isTupleAddAllowed = !(0, types_1.isUnion)(leftType);
                    returnType = validateBinaryOperation(evaluator, binaryOperator, { type: leftSubtypeUnexpanded, isIncomplete: leftTypeResult.isIncomplete }, { type: rightSubtypeUnexpanded, isIncomplete: rightTypeResult.isIncomplete }, node, inferenceContext, diag, { isLiteralMathAllowed, isTupleAddAllowed });
                }
                return returnType;
            });
        });
        // If the LHS class didn't support the magic method for augmented
        // assignment, fall back on the normal binary expression evaluator.
        if (!diag.isEmpty() || !type || (0, types_1.isNever)(type)) {
            if (!isIncomplete) {
                evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOperatorIssue, localize_1.LocMessage.typeNotSupportBinaryOperator().format({
                    operator: (0, parseTreeUtils_1.printOperator)(node.operator),
                    leftType: evaluator.printType(leftType),
                    rightType: evaluator.printType(rightType),
                }) + diag.getString(), node);
            }
        }
        typeResult = { type, isIncomplete };
    }
    evaluator.assignTypeToExpression(node.destExpression, typeResult, node.rightExpression);
    return typeResult;
}
exports.getTypeOfAugmentedAssignment = getTypeOfAugmentedAssignment;
function getTypeOfUnaryOperation(evaluator, node, flags, inferenceContext) {
    if ((flags & 256 /* EvalFlags.TypeExpression */) !== 0) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, localize_1.LocMessage.unaryOperationNotAllowed(), node);
        return { type: types_1.UnknownType.create() };
    }
    const exprTypeResult = evaluator.getTypeOfExpression(node.expression);
    let exprType = evaluator.makeTopLevelTypeVarsConcrete((0, typeUtils_1.transformPossibleRecursiveTypeAlias)(exprTypeResult.type));
    const isIncomplete = exprTypeResult.isIncomplete;
    if ((0, types_1.isNever)(exprType)) {
        return { type: types_1.NeverType.createNever(), isIncomplete };
    }
    // Map unary operators to magic functions. Note that the bitwise
    // invert has two magic functions that are aliases of each other.
    const unaryOperatorMap = {
        [0 /* OperatorType.Add */]: '__pos__',
        [33 /* OperatorType.Subtract */]: '__neg__',
        [5 /* OperatorType.BitwiseInvert */]: '__invert__',
    };
    let type;
    if (node.operator !== 38 /* OperatorType.Not */) {
        if ((0, typeUtils_1.isOptionalType)(exprType)) {
            evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOptionalOperand, localize_1.LocMessage.noneOperator().format({
                operator: (0, parseTreeUtils_1.printOperator)(node.operator),
            }), node.expression);
            exprType = (0, typeUtils_1.removeNoneFromUnion)(exprType);
        }
    }
    // Handle certain operations on certain literal types
    // using special-case math. Do not apply this if the input type
    // is incomplete because we may be evaluating an expression within
    // a loop, so the literal value may change each time.
    if (!exprTypeResult.isIncomplete) {
        const literalClassName = (0, typeUtils_1.getLiteralTypeClassName)(exprType);
        if (literalClassName === 'int') {
            if (node.operator === 0 /* OperatorType.Add */) {
                type = exprType;
            }
            else if (node.operator === 33 /* OperatorType.Subtract */) {
                type = (0, typeUtils_1.mapSubtypes)(exprType, (subtype) => {
                    const classSubtype = subtype;
                    return types_1.ClassType.cloneWithLiteral(classSubtype, -classSubtype.literalValue);
                });
            }
        }
        else if (literalClassName === 'bool') {
            if (node.operator === 38 /* OperatorType.Not */) {
                type = (0, typeUtils_1.mapSubtypes)(exprType, (subtype) => {
                    const classSubtype = subtype;
                    return types_1.ClassType.cloneWithLiteral(classSubtype, !classSubtype.literalValue);
                });
            }
        }
    }
    if (!type) {
        // __not__ always returns a boolean.
        if (node.operator === 38 /* OperatorType.Not */) {
            type = evaluator.getBuiltInObject(node, 'bool');
            if (!type) {
                type = types_1.UnknownType.create();
            }
        }
        else {
            if ((0, types_1.isAnyOrUnknown)(exprType)) {
                type = exprType;
            }
            else {
                const magicMethodName = unaryOperatorMap[node.operator];
                let isResultValid = true;
                type = evaluator.mapSubtypesExpandTypeVars(exprType, /* options */ undefined, (subtypeExpanded) => {
                    const result = evaluator.getTypeOfMagicMethodCall(subtypeExpanded, magicMethodName, [], node, inferenceContext);
                    if (!result) {
                        isResultValid = false;
                    }
                    return result;
                });
                if (!isResultValid) {
                    type = undefined;
                }
            }
            if (!type) {
                if (!isIncomplete) {
                    if (inferenceContext) {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOperatorIssue, localize_1.LocMessage.typeNotSupportUnaryOperatorBidirectional().format({
                            operator: (0, parseTreeUtils_1.printOperator)(node.operator),
                            type: evaluator.printType(exprType),
                            expectedType: evaluator.printType(inferenceContext.expectedType),
                        }), node);
                    }
                    else {
                        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportOperatorIssue, localize_1.LocMessage.typeNotSupportUnaryOperator().format({
                            operator: (0, parseTreeUtils_1.printOperator)(node.operator),
                            type: evaluator.printType(exprType),
                        }), node);
                    }
                }
                type = types_1.UnknownType.create(isIncomplete);
            }
        }
    }
    return { type, isIncomplete };
}
exports.getTypeOfUnaryOperation = getTypeOfUnaryOperation;
function getTypeOfTernaryOperation(evaluator, node, flags, inferenceContext) {
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(node);
    if ((flags & 256 /* EvalFlags.TypeExpression */) !== 0) {
        evaluator.addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, localize_1.LocMessage.ternaryNotAllowed(), node);
        return { type: types_1.UnknownType.create() };
    }
    evaluator.getTypeOfExpression(node.testExpression);
    const typesToCombine = [];
    let isIncomplete = false;
    let typeErrors = false;
    const constExprValue = (0, staticExpressions_1.evaluateStaticBoolExpression)(node.testExpression, fileInfo.executionEnvironment, fileInfo.definedConstants);
    if (constExprValue !== false && evaluator.isNodeReachable(node.ifExpression)) {
        const ifType = evaluator.getTypeOfExpression(node.ifExpression, flags, inferenceContext);
        typesToCombine.push(ifType.type);
        if (ifType.isIncomplete) {
            isIncomplete = true;
        }
        if (ifType.typeErrors) {
            typeErrors = true;
        }
    }
    if (constExprValue !== true && evaluator.isNodeReachable(node.elseExpression)) {
        const elseType = evaluator.getTypeOfExpression(node.elseExpression, flags, inferenceContext);
        typesToCombine.push(elseType.type);
        if (elseType.isIncomplete) {
            isIncomplete = true;
        }
        if (elseType.typeErrors) {
            typeErrors = true;
        }
    }
    return { type: (0, types_1.combineTypes)(typesToCombine), isIncomplete, typeErrors };
}
exports.getTypeOfTernaryOperation = getTypeOfTernaryOperation;
function customMetaclassSupportsMethod(type, methodName) {
    if (!(0, types_1.isInstantiableClass)(type)) {
        return false;
    }
    const metaclass = type.details.effectiveMetaclass;
    if (!metaclass || !(0, types_1.isInstantiableClass)(metaclass)) {
        return false;
    }
    if (types_1.ClassType.isBuiltIn(metaclass, 'type')) {
        return false;
    }
    const memberInfo = (0, typeUtils_1.lookUpClassMember)(metaclass, methodName);
    if (!memberInfo) {
        return false;
    }
    // If the metaclass inherits from Any or Unknown, we have to guess
    // whether the method is supported. We'll assume it's not, since this
    // is the most likely case.
    if ((0, types_1.isAnyOrUnknown)(memberInfo.classType)) {
        return false;
    }
    if ((0, types_1.isInstantiableClass)(memberInfo.classType) && types_1.ClassType.isBuiltIn(memberInfo.classType, 'type')) {
        return false;
    }
    return true;
}
// All functions in Python derive from object, so they inherit all
// of the capabilities of an object. This function converts a function
// to an object instance.
function convertFunctionToObject(evaluator, type) {
    if ((0, types_1.isFunction)(type) || (0, types_1.isOverloadedFunction)(type)) {
        return evaluator.getObjectType();
    }
    return type;
}
// Determines whether the expression refers to a variable that
// is defined within the current scope or some outer scope.
function isExpressionLocalVariable(evaluator, node) {
    if (node.nodeType !== 38 /* ParseNodeType.Name */) {
        return false;
    }
    const symbolWithScope = evaluator.lookUpSymbolRecursive(node, node.value, /* honorCodeFlow */ false);
    if (!symbolWithScope) {
        return false;
    }
    const currentScope = (0, scopeUtils_1.getScopeForNode)(node);
    return currentScope === symbolWithScope.scope;
}
//# sourceMappingURL=operations.js.map