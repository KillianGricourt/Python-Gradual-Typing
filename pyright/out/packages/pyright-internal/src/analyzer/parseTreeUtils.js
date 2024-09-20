"use strict";
/*
 * parseTreeUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility routines for traversing a parse tree.
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
exports.getTokenIndexAtLeft = exports.getCallNodeAndActiveParameterIndex = exports.getEnclosingParameter = exports.CallNodeWalker = exports.NameNodeWalker = exports.isAssignmentToDefaultsFollowingNamedTuple = exports.isDocString = exports.getDocString = exports.isWithinAssertExpression = exports.isWithinLoop = exports.isWithinAnnotationComment = exports.isWithinTypeAnnotation = exports.isWithinDefaultParamInitializer = exports.isPartialMatchingExpression = exports.isMatchingExpression = exports.containsAwaitNode = exports.isSuiteEmpty = exports.isNodeContainedWithinNodeType = exports.getParentAnnotationNode = exports.getParentNodeOfType = exports.isNodeContainedWithin = exports.isRequiredAllowedForAssignmentTarget = exports.isClassVarAllowedForAssignmentTarget = exports.isFinalAllowedForAssignmentTarget = exports.getArgumentsByRuntimeOrder = exports.getTypeAnnotationNode = exports.getExecutionScopeNode = exports.getTypeVarScopeNode = exports.getEvaluationScopeNode = exports.getEvaluationNodeForAssignmentExpression = exports.getEnclosingSuiteOrModule = exports.getEnclosingClassOrFunction = exports.getEnclosingLambda = exports.getEnclosingFunctionEvaluationScope = exports.getEnclosingFunction = exports.getEnclosingClassOrModule = exports.getEnclosingModule = exports.getEnclosingClass = exports.getEnclosingSuite = exports.getDecoratorForName = exports.getCallForName = exports.printOperator = exports.printExpression = exports.printArgument = exports.getTypeSourceId = exports.getClassFullName = exports.isCompliantWithNodeRangeRules = exports.findNodeByOffset = exports.findNodeByPosition = exports.getNodeDepth = void 0;
exports.isSimpleDefault = exports.checkDecorator = exports.getTypeVarScopesForNode = exports.getScopeIdForNode = exports.getVariableDocStringNode = exports.operatorSupportsChaining = exports.isValidLocationForFutureImport = exports.isUnannotatedFunction = exports.isBlankLine = exports.getFullStatementRange = exports.getStringValueRange = exports.getStringNodeValueRange = exports.isLastNameOfDottedName = exports.isFirstNameOfDottedName = exports.getFirstNameOfDottedName = exports.getDottedName = exports.getDecoratorName = exports.getDottedNameWithGivenNodeAsLastName = exports.getFirstAncestorOrSelf = exports.getFirstAncestorOrSelfOfKind = exports.getAncestorsIncludingSelf = exports.isLastNameOfModuleName = exports.isFromImportAlias = exports.isFromImportName = exports.isFromImportModuleName = exports.isImportAlias = exports.isImportModuleName = exports.getTypeAnnotationForParameter = exports.isFunctionSuiteEmpty = exports.getFileInfoFromNode = exports.getModuleNode = exports.isWriteAccess = exports.printParseNodeType = exports.getCommentsAtTokenIndex = exports.findTokenAfter = exports.getIndexOfTokenOverlapping = exports.getTokenOverlapping = exports.getTokenAt = exports.getTokenAtIndex = exports.isWhitespace = exports.getTokenAtLeft = void 0;
const AnalyzerNodeInfo = __importStar(require("../analyzer/analyzerNodeInfo"));
const core_1 = require("../common/core");
const debug_1 = require("../common/debug");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
const textRangeCollection_1 = require("../common/textRangeCollection");
const parseNodes_1 = require("../parser/parseNodes");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const parseTreeWalker_1 = require("./parseTreeWalker");
// Returns the depth of the node as measured from the root
// of the parse tree.
function getNodeDepth(node) {
    let depth = 0;
    let curNode = node;
    while (curNode) {
        depth++;
        curNode = curNode.parent;
    }
    return depth;
}
exports.getNodeDepth = getNodeDepth;
// Returns the deepest node that contains the specified position.
function findNodeByPosition(node, position, lines) {
    const offset = (0, positionUtils_1.convertPositionToOffset)(position, lines);
    if (offset === undefined) {
        return undefined;
    }
    return findNodeByOffset(node, offset);
}
exports.findNodeByPosition = findNodeByPosition;
// Returns the deepest node that contains the specified offset.
function findNodeByOffset(node, offset) {
    if (!textRange_1.TextRange.overlaps(node, offset)) {
        return undefined;
    }
    // The range is found within this node. See if we can localize it
    // further by checking its children.
    let children = (0, parseTreeWalker_1.getChildNodes)(node);
    if (isCompliantWithNodeRangeRules(node) && children.length > 20) {
        // Use binary search to find the child to visit. This should be helpful
        // when there are many siblings, such as statements in a module/suite
        // or expressions in a list, etc. Otherwise, we will have to traverse
        // every sibling before finding the correct one.
        let index = (0, textRangeCollection_1.getIndexContaining)(children, offset, textRange_1.TextRange.overlaps);
        if (index >= 0) {
            // Find first sibling that overlaps with the offset. This ensures that
            // our binary search result matches what we would have returned via a
            // linear search.
            let searchIndex = index - 1;
            while (searchIndex >= 0) {
                const previousChild = children[searchIndex];
                if (previousChild) {
                    if (textRange_1.TextRange.overlaps(previousChild, offset)) {
                        index = searchIndex;
                    }
                    else {
                        break;
                    }
                }
                searchIndex--;
            }
            children = [children[index]];
        }
    }
    for (const child of children) {
        if (!child) {
            continue;
        }
        const containingChild = findNodeByOffset(child, offset);
        if (containingChild) {
            // For augmented assignments, prefer the dest expression, which is a clone
            // of the left expression but is used to hold the type of the operation result.
            if (node.nodeType === 5 /* ParseNodeType.AugmentedAssignment */ && containingChild === node.leftExpression) {
                return node.destExpression;
            }
            return containingChild;
        }
    }
    return node;
}
exports.findNodeByOffset = findNodeByOffset;
function isCompliantWithNodeRangeRules(node) {
    // ParseNode range rules are
    // 1. Children are all contained within the parent.
    // 2. Children have non-overlapping ranges.
    // 3. Children are listed in increasing order.
    return node.nodeType !== 3 /* ParseNodeType.Assignment */ && node.nodeType !== 48 /* ParseNodeType.StringList */;
}
exports.isCompliantWithNodeRangeRules = isCompliantWithNodeRangeRules;
function getClassFullName(classNode, moduleName, className) {
    const nameParts = [className];
    let curNode = classNode;
    // Walk the parse tree looking for classes.
    while (curNode) {
        curNode = getEnclosingClass(curNode);
        if (curNode) {
            nameParts.push(curNode.name.value);
        }
    }
    nameParts.push(moduleName);
    return nameParts.reverse().join('.');
}
exports.getClassFullName = getClassFullName;
// Create an ID that is based on the location within the file.
// This allows us to disambiguate between different types that
// don't have unique names (those that are not created with class
// declarations).
function getTypeSourceId(node) {
    return node.start;
}
exports.getTypeSourceId = getTypeSourceId;
function printArgument(node, flags) {
    let argStr = '';
    if (node.argumentCategory === 1 /* ArgumentCategory.UnpackedList */) {
        argStr = '*';
    }
    else if (node.argumentCategory === 2 /* ArgumentCategory.UnpackedDictionary */) {
        argStr = '**';
    }
    if (node.name) {
        argStr += node.name.value + '=';
    }
    argStr += printExpression(node.valueExpression, flags);
    return argStr;
}
exports.printArgument = printArgument;
function printExpression(node, flags = 0 /* PrintExpressionFlags.None */) {
    switch (node.nodeType) {
        case 38 /* ParseNodeType.Name */: {
            return node.value;
        }
        case 35 /* ParseNodeType.MemberAccess */: {
            return printExpression(node.leftExpression, flags) + '.' + node.memberName.value;
        }
        case 9 /* ParseNodeType.Call */: {
            let lhs = printExpression(node.leftExpression, flags);
            // Some left-hand expressions must be parenthesized.
            if (node.leftExpression.nodeType !== 35 /* ParseNodeType.MemberAccess */ &&
                node.leftExpression.nodeType !== 38 /* ParseNodeType.Name */ &&
                node.leftExpression.nodeType !== 27 /* ParseNodeType.Index */ &&
                node.leftExpression.nodeType !== 9 /* ParseNodeType.Call */) {
                lhs = `(${lhs})`;
            }
            return lhs + '(' + node.arguments.map((arg) => printArgument(arg, flags)).join(', ') + ')';
        }
        case 27 /* ParseNodeType.Index */: {
            return (printExpression(node.baseExpression, flags) +
                '[' +
                node.items.map((item) => printArgument(item, flags)).join(', ') +
                (node.trailingComma ? ',' : '') +
                ']');
        }
        case 55 /* ParseNodeType.UnaryOperation */: {
            const exprStr = printOperator(node.operator) + printExpression(node.expression, flags);
            return node.parenthesized ? `(${exprStr})` : exprStr;
        }
        case 7 /* ParseNodeType.BinaryOperation */: {
            const exprStr = printExpression(node.leftExpression, flags) +
                ' ' +
                printOperator(node.operator) +
                ' ' +
                printExpression(node.rightExpression, flags);
            return node.parenthesized ? `(${exprStr})` : exprStr;
        }
        case 40 /* ParseNodeType.Number */: {
            let value = node.value.toString();
            // If it's stored as a bigint, strip off the "n".
            if (value.endsWith('n')) {
                value = value.substring(0, value.length - 1);
            }
            if (node.isImaginary) {
                value += 'j';
            }
            return value;
        }
        case 48 /* ParseNodeType.StringList */: {
            if (flags & 1 /* PrintExpressionFlags.ForwardDeclarations */ && node.typeAnnotation) {
                return printExpression(node.typeAnnotation, flags);
            }
            else {
                return node.strings
                    .map((str) => {
                    return printExpression(str, flags);
                })
                    .join(' ');
            }
        }
        case 49 /* ParseNodeType.String */: {
            let exprString = '';
            if (node.token.flags & 8 /* StringTokenFlags.Raw */) {
                exprString += 'r';
            }
            if (node.token.flags & 16 /* StringTokenFlags.Unicode */) {
                exprString += 'u';
            }
            if (node.token.flags & 32 /* StringTokenFlags.Bytes */) {
                exprString += 'b';
            }
            if (node.token.flags & 64 /* StringTokenFlags.Format */) {
                exprString += 'f';
            }
            let escapedString = node.token.escapedValue;
            if ((flags & 2 /* PrintExpressionFlags.DoNotLimitStringLength */) === 0) {
                const maxStringLength = 32;
                escapedString = escapedString.slice(0, maxStringLength);
            }
            if (node.token.flags & 4 /* StringTokenFlags.Triplicate */) {
                if (node.token.flags & 1 /* StringTokenFlags.SingleQuote */) {
                    exprString += `'''${escapedString}'''`;
                }
                else {
                    exprString += `"""${escapedString}"""`;
                }
            }
            else {
                if (node.token.flags & 1 /* StringTokenFlags.SingleQuote */) {
                    exprString += `'${escapedString}'`;
                }
                else {
                    exprString += `"${escapedString}"`;
                }
            }
            return exprString;
        }
        case 30 /* ParseNodeType.FormatString */: {
            let exprString = 'f';
            let escapedString = '';
            const itemsToPrint = [...node.middleTokens, ...node.fieldExpressions].sort((a, b) => a.start - b.start);
            while (itemsToPrint.length > 0) {
                const itemToPrint = itemsToPrint.shift();
                if ('nodeType' in itemToPrint) {
                    escapedString += `{${printExpression(itemToPrint)}}`;
                }
                else {
                    escapedString += itemToPrint.escapedValue;
                }
            }
            if (node.token.flags & 4 /* StringTokenFlags.Triplicate */) {
                if (node.token.flags & 1 /* StringTokenFlags.SingleQuote */) {
                    exprString += `'''${escapedString}'''`;
                }
                else {
                    exprString += `"""${escapedString}"""`;
                }
            }
            else {
                if (node.token.flags & 1 /* StringTokenFlags.SingleQuote */) {
                    exprString += `'${escapedString}'`;
                }
                else {
                    exprString += `"${escapedString}"`;
                }
            }
            return exprString;
        }
        case 3 /* ParseNodeType.Assignment */: {
            return printExpression(node.leftExpression, flags) + ' = ' + printExpression(node.rightExpression, flags);
        }
        case 4 /* ParseNodeType.AssignmentExpression */: {
            return printExpression(node.name, flags) + ' := ' + printExpression(node.rightExpression, flags);
        }
        case 54 /* ParseNodeType.TypeAnnotation */: {
            return printExpression(node.valueExpression, flags) + ': ' + printExpression(node.typeAnnotation, flags);
        }
        case 5 /* ParseNodeType.AugmentedAssignment */: {
            return (printExpression(node.leftExpression, flags) +
                ' ' +
                printOperator(node.operator) +
                ' ' +
                printExpression(node.rightExpression, flags));
        }
        case 6 /* ParseNodeType.Await */: {
            const exprStr = 'await ' + printExpression(node.expression, flags);
            return node.parenthesized ? `(${exprStr})` : exprStr;
        }
        case 51 /* ParseNodeType.Ternary */: {
            return (printExpression(node.ifExpression, flags) +
                ' if ' +
                printExpression(node.testExpression, flags) +
                ' else ' +
                printExpression(node.elseExpression, flags));
        }
        case 34 /* ParseNodeType.List */: {
            const expressions = node.entries.map((expr) => {
                return printExpression(expr, flags);
            });
            return `[${expressions.join(', ')}]`;
        }
        case 56 /* ParseNodeType.Unpack */: {
            return '*' + printExpression(node.expression, flags);
        }
        case 52 /* ParseNodeType.Tuple */: {
            const expressions = node.expressions.map((expr) => {
                return printExpression(expr, flags);
            });
            if (expressions.length === 1) {
                return `(${expressions[0]}, )`;
            }
            return `(${expressions.join(', ')})`;
        }
        case 60 /* ParseNodeType.Yield */: {
            if (node.expression) {
                return 'yield ' + printExpression(node.expression, flags);
            }
            else {
                return 'yield';
            }
        }
        case 61 /* ParseNodeType.YieldFrom */: {
            return 'yield from ' + printExpression(node.expression, flags);
        }
        case 21 /* ParseNodeType.Ellipsis */: {
            return '...';
        }
        case 11 /* ParseNodeType.Comprehension */: {
            let listStr = '<ListExpression>';
            if ((0, parseNodes_1.isExpressionNode)(node.expression)) {
                listStr = printExpression(node.expression, flags);
            }
            else if (node.expression.nodeType === 20 /* ParseNodeType.DictionaryKeyEntry */) {
                const keyStr = printExpression(node.expression.keyExpression, flags);
                const valueStr = printExpression(node.expression.valueExpression, flags);
                listStr = `${keyStr}: ${valueStr}`;
            }
            listStr =
                listStr +
                    ' ' +
                    node.forIfNodes
                        .map((expr) => {
                        if (expr.nodeType === 12 /* ParseNodeType.ComprehensionFor */) {
                            return (`${expr.isAsync ? 'async ' : ''}for ` +
                                printExpression(expr.targetExpression, flags) +
                                ` in ${printExpression(expr.iterableExpression, flags)}`);
                        }
                        else {
                            return `if ${printExpression(expr.testExpression, flags)}`;
                        }
                    })
                        .join(' ');
            return node.isParenthesized ? `(${listStr})` : listStr;
        }
        case 46 /* ParseNodeType.Slice */: {
            let result = '';
            if (node.startValue || node.endValue || node.stepValue) {
                if (node.startValue) {
                    result += printExpression(node.startValue, flags);
                }
                if (node.endValue) {
                    result += ': ' + printExpression(node.endValue, flags);
                }
                if (node.stepValue) {
                    result += ': ' + printExpression(node.stepValue, flags);
                }
            }
            else {
                result += ':';
            }
            return result;
        }
        case 33 /* ParseNodeType.Lambda */: {
            return ('lambda ' +
                node.parameters
                    .map((param) => {
                    let paramStr = '';
                    if (param.category === 1 /* ParameterCategory.ArgsList */) {
                        paramStr += '*';
                    }
                    else if (param.category === 2 /* ParameterCategory.KwargsDict */) {
                        paramStr += '**';
                    }
                    if (param.name) {
                        paramStr += param.name.value;
                    }
                    else if (param.category === 0 /* ParameterCategory.Simple */) {
                        paramStr += '/';
                    }
                    if (param.defaultValue) {
                        paramStr += ' = ' + printExpression(param.defaultValue, flags);
                    }
                    return paramStr;
                })
                    .join(', ') +
                ': ' +
                printExpression(node.expression, flags));
        }
        case 14 /* ParseNodeType.Constant */: {
            if (node.constType === 33 /* KeywordType.True */) {
                return 'True';
            }
            else if (node.constType === 15 /* KeywordType.False */) {
                return 'False';
            }
            else if (node.constType === 9 /* KeywordType.Debug */) {
                return '__debug__';
            }
            else if (node.constType === 26 /* KeywordType.None */) {
                return 'None';
            }
            break;
        }
        case 18 /* ParseNodeType.Dictionary */: {
            const dictContents = `${node.entries.map((entry) => {
                if (entry.nodeType === 20 /* ParseNodeType.DictionaryKeyEntry */) {
                    return (`${printExpression(entry.keyExpression, flags)}: ` +
                        `${printExpression(entry.valueExpression, flags)}`);
                }
                else if (entry.nodeType === 19 /* ParseNodeType.DictionaryExpandEntry */) {
                    return `**${printExpression(entry.expandExpression, flags)}`;
                }
                else {
                    return printExpression(entry, flags);
                }
            })}`;
            if (dictContents) {
                return `{ ${dictContents} }`;
            }
            return '{}';
        }
        case 45 /* ParseNodeType.Set */: {
            return node.entries.map((entry) => printExpression(entry, flags)).join(', ');
        }
        case 0 /* ParseNodeType.Error */: {
            return '<Parse Error>';
        }
        default: {
            (0, debug_1.assertNever)(node);
        }
    }
    return '<Expression>';
}
exports.printExpression = printExpression;
function printOperator(operator) {
    const operatorMap = {
        [0 /* OperatorType.Add */]: '+',
        [1 /* OperatorType.AddEqual */]: '+=',
        [2 /* OperatorType.Assign */]: '=',
        [3 /* OperatorType.BitwiseAnd */]: '&',
        [4 /* OperatorType.BitwiseAndEqual */]: '&=',
        [5 /* OperatorType.BitwiseInvert */]: '~',
        [6 /* OperatorType.BitwiseOr */]: '|',
        [7 /* OperatorType.BitwiseOrEqual */]: '|=',
        [8 /* OperatorType.BitwiseXor */]: '^',
        [9 /* OperatorType.BitwiseXorEqual */]: '^=',
        [10 /* OperatorType.Divide */]: '/',
        [11 /* OperatorType.DivideEqual */]: '/=',
        [12 /* OperatorType.Equals */]: '==',
        [13 /* OperatorType.FloorDivide */]: '//',
        [14 /* OperatorType.FloorDivideEqual */]: '//=',
        [15 /* OperatorType.GreaterThan */]: '>',
        [16 /* OperatorType.GreaterThanOrEqual */]: '>=',
        [17 /* OperatorType.LeftShift */]: '<<',
        [18 /* OperatorType.LeftShiftEqual */]: '<<=',
        [19 /* OperatorType.LessOrGreaterThan */]: '<>',
        [20 /* OperatorType.LessThan */]: '<',
        [21 /* OperatorType.LessThanOrEqual */]: '<=',
        [22 /* OperatorType.MatrixMultiply */]: '@',
        [23 /* OperatorType.MatrixMultiplyEqual */]: '@=',
        [24 /* OperatorType.Mod */]: '%',
        [25 /* OperatorType.ModEqual */]: '%=',
        [26 /* OperatorType.Multiply */]: '*',
        [27 /* OperatorType.MultiplyEqual */]: '*=',
        [28 /* OperatorType.NotEquals */]: '!=',
        [29 /* OperatorType.Power */]: '**',
        [30 /* OperatorType.PowerEqual */]: '**=',
        [31 /* OperatorType.RightShift */]: '>>',
        [32 /* OperatorType.RightShiftEqual */]: '>>=',
        [33 /* OperatorType.Subtract */]: '-',
        [34 /* OperatorType.SubtractEqual */]: '-=',
        [36 /* OperatorType.And */]: 'and',
        [37 /* OperatorType.Or */]: 'or',
        [38 /* OperatorType.Not */]: 'not ',
        [39 /* OperatorType.Is */]: 'is',
        [40 /* OperatorType.IsNot */]: 'is not',
        [41 /* OperatorType.In */]: 'in',
        [42 /* OperatorType.NotIn */]: 'not in',
    };
    if (operatorMap[operator]) {
        return operatorMap[operator];
    }
    return 'unknown';
}
exports.printOperator = printOperator;
// If the name node is the LHS of a call expression or is a member
// name in the LHS of a call expression, returns the call node.
function getCallForName(node) {
    var _a, _b, _c;
    if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 9 /* ParseNodeType.Call */ && node.parent.leftExpression === node) {
        return node.parent;
    }
    if (((_b = node.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 35 /* ParseNodeType.MemberAccess */ &&
        node.parent.memberName === node &&
        ((_c = node.parent.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 9 /* ParseNodeType.Call */ &&
        node.parent.parent.leftExpression === node.parent) {
        return node.parent.parent;
    }
    return undefined;
}
exports.getCallForName = getCallForName;
function getDecoratorForName(node) {
    var _a, _b, _c;
    if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 16 /* ParseNodeType.Decorator */ && node.parent.expression === node) {
        return node.parent;
    }
    if (((_b = node.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 35 /* ParseNodeType.MemberAccess */ &&
        node.parent.memberName === node &&
        ((_c = node.parent.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 16 /* ParseNodeType.Decorator */ &&
        node.parent.parent.expression === node.parent) {
        return node.parent.parent;
    }
    return undefined;
}
exports.getDecoratorForName = getDecoratorForName;
function getEnclosingSuite(node) {
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 50 /* ParseNodeType.Suite */) {
            return curNode;
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingSuite = getEnclosingSuite;
function getEnclosingClass(node, stopAtFunction = false) {
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 10 /* ParseNodeType.Class */) {
            return curNode;
        }
        if (curNode.nodeType === 36 /* ParseNodeType.Module */) {
            return undefined;
        }
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            if (stopAtFunction) {
                return undefined;
            }
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingClass = getEnclosingClass;
function getEnclosingModule(node) {
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 36 /* ParseNodeType.Module */) {
            return curNode;
        }
        curNode = curNode.parent;
    }
    (0, debug_1.fail)('Module node not found');
    return undefined;
}
exports.getEnclosingModule = getEnclosingModule;
function getEnclosingClassOrModule(node, stopAtFunction = false) {
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 10 /* ParseNodeType.Class */) {
            return curNode;
        }
        if (curNode.nodeType === 36 /* ParseNodeType.Module */) {
            return curNode;
        }
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            if (stopAtFunction) {
                return undefined;
            }
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingClassOrModule = getEnclosingClassOrModule;
function getEnclosingFunction(node) {
    let curNode = node.parent;
    let prevNode;
    while (curNode) {
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            // Don't treat a decorator as being "enclosed" in the function.
            if (!curNode.decorators.some((decorator) => decorator === prevNode)) {
                return curNode;
            }
        }
        if (curNode.nodeType === 10 /* ParseNodeType.Class */) {
            return undefined;
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingFunction = getEnclosingFunction;
// This is similar to getEnclosingFunction except that it uses evaluation
// scopes rather than the parse tree to determine whether the specified node
// is within the scope. That means if the node is within a class decorator
// (for example), it will be considered part of its parent node rather than
// the class node.
function getEnclosingFunctionEvaluationScope(node) {
    let curNode = getEvaluationScopeNode(node).node;
    while (curNode) {
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            return curNode;
        }
        if (curNode.nodeType === 10 /* ParseNodeType.Class */ || !curNode.parent) {
            return undefined;
        }
        curNode = getEvaluationScopeNode(curNode.parent).node;
    }
    return undefined;
}
exports.getEnclosingFunctionEvaluationScope = getEnclosingFunctionEvaluationScope;
function getEnclosingLambda(node) {
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 33 /* ParseNodeType.Lambda */) {
            return curNode;
        }
        if (curNode.nodeType === 50 /* ParseNodeType.Suite */) {
            return undefined;
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingLambda = getEnclosingLambda;
function getEnclosingClassOrFunction(node) {
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            return curNode;
        }
        if (curNode.nodeType === 10 /* ParseNodeType.Class */) {
            return curNode;
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingClassOrFunction = getEnclosingClassOrFunction;
function getEnclosingSuiteOrModule(node, stopAtFunction = false, stopAtLambda = true) {
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 50 /* ParseNodeType.Suite */) {
            return curNode;
        }
        if (curNode.nodeType === 36 /* ParseNodeType.Module */) {
            return curNode;
        }
        if (curNode.nodeType === 33 /* ParseNodeType.Lambda */) {
            if (stopAtLambda) {
                return undefined;
            }
        }
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            if (stopAtFunction) {
                return undefined;
            }
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingSuiteOrModule = getEnclosingSuiteOrModule;
function getEvaluationNodeForAssignmentExpression(node) {
    // PEP 572 indicates that the evaluation node for an assignment expression
    // target within a list comprehension is contained within a lambda,
    // function or module, but not a class.
    let sawComprehension = false;
    let curNode = getEvaluationScopeNode(node).node;
    while (curNode !== undefined) {
        switch (curNode.nodeType) {
            case 31 /* ParseNodeType.Function */:
            case 33 /* ParseNodeType.Lambda */:
            case 36 /* ParseNodeType.Module */:
                return curNode;
            case 10 /* ParseNodeType.Class */:
                return sawComprehension ? undefined : curNode;
            case 11 /* ParseNodeType.Comprehension */:
                sawComprehension = true;
                curNode = getEvaluationScopeNode(curNode.parent).node;
                break;
            default:
                return undefined;
        }
    }
    return undefined;
}
exports.getEvaluationNodeForAssignmentExpression = getEvaluationNodeForAssignmentExpression;
// Returns the parse node corresponding to the scope that is used to evaluate
// a symbol referenced in the specified node.
function getEvaluationScopeNode(node) {
    let prevNode;
    let prevPrevNode;
    let curNode = node;
    let isParamNameNode = false;
    let isParamDefaultNode = false;
    while (curNode) {
        if (curNode.nodeType === 41 /* ParseNodeType.Parameter */) {
            if (prevNode === curNode.name) {
                // Note that we passed through a parameter name node.
                isParamNameNode = true;
            }
            else if (prevNode === curNode.defaultValue) {
                // Note that we passed through a parameter default value node.
                isParamDefaultNode = true;
            }
        }
        // We found a scope associated with this node. In most cases,
        // we'll return this scope, but in a few cases we need to return
        // the enclosing scope instead.
        switch (curNode.nodeType) {
            case 76 /* ParseNodeType.TypeParameterList */: {
                return { node: curNode, useProxyScope: true };
            }
            case 31 /* ParseNodeType.Function */: {
                if (!prevNode) {
                    break;
                }
                // Decorators are always evaluated outside of the function scope.
                if (curNode.decorators.some((decorator) => decorator === prevNode)) {
                    break;
                }
                if (curNode.parameters.some((param) => param === prevNode)) {
                    // Default argument expressions are evaluated outside of the function scope.
                    if (isParamDefaultNode) {
                        break;
                    }
                    if (isParamNameNode) {
                        if ((0, analyzerNodeInfo_1.getScope)(curNode) !== undefined) {
                            return { node: curNode };
                        }
                    }
                }
                if (prevNode === curNode.suite) {
                    if ((0, analyzerNodeInfo_1.getScope)(curNode) !== undefined) {
                        return { node: curNode };
                    }
                }
                // All other nodes in the function are evaluated in the context
                // of the type parameter scope if it's present. Otherwise,
                // they are evaluated within the function's parent scope.
                if (curNode.typeParameters) {
                    const scopeNode = curNode.typeParameters;
                    if ((0, analyzerNodeInfo_1.getScope)(scopeNode) !== undefined) {
                        return { node: scopeNode, useProxyScope: true };
                    }
                }
                break;
            }
            case 33 /* ParseNodeType.Lambda */: {
                if (curNode.parameters.some((param) => param === prevNode)) {
                    if (isParamNameNode) {
                        if ((0, analyzerNodeInfo_1.getScope)(curNode) !== undefined) {
                            return { node: curNode };
                        }
                    }
                }
                else if (!prevNode || prevNode === curNode.expression) {
                    if ((0, analyzerNodeInfo_1.getScope)(curNode) !== undefined) {
                        return { node: curNode };
                    }
                }
                break;
            }
            case 10 /* ParseNodeType.Class */: {
                if (!prevNode) {
                    break;
                }
                // Decorators are always evaluated outside of the class scope.
                if (curNode.decorators.some((decorator) => decorator === prevNode)) {
                    break;
                }
                if (prevNode === curNode.suite) {
                    if ((0, analyzerNodeInfo_1.getScope)(curNode) !== undefined) {
                        return { node: curNode };
                    }
                }
                // All other nodes in the class are evaluated in the context
                // of the type parameter scope if it's present. Otherwise,
                // they are evaluated within the class' parent scope.
                if (curNode.typeParameters) {
                    const scopeNode = curNode.typeParameters;
                    if ((0, analyzerNodeInfo_1.getScope)(scopeNode) !== undefined) {
                        return { node: scopeNode, useProxyScope: true };
                    }
                }
                break;
            }
            case 11 /* ParseNodeType.Comprehension */: {
                if ((0, analyzerNodeInfo_1.getScope)(curNode) !== undefined) {
                    // The iterable expression of the first subnode of a list comprehension
                    // is evaluated within the scope of its parent.
                    const isFirstIterableExpr = prevNode === curNode.forIfNodes[0] &&
                        curNode.forIfNodes[0].nodeType === 12 /* ParseNodeType.ComprehensionFor */ &&
                        curNode.forIfNodes[0].iterableExpression === prevPrevNode;
                    if (!isFirstIterableExpr) {
                        return { node: curNode };
                    }
                }
                break;
            }
            case 77 /* ParseNodeType.TypeAlias */: {
                if (prevNode === curNode.expression && curNode.typeParameters) {
                    const scopeNode = curNode.typeParameters;
                    if ((0, analyzerNodeInfo_1.getScope)(scopeNode) !== undefined) {
                        return { node: scopeNode };
                    }
                }
                break;
            }
            case 36 /* ParseNodeType.Module */: {
                if ((0, analyzerNodeInfo_1.getScope)(curNode) !== undefined) {
                    return { node: curNode };
                }
                break;
            }
        }
        prevPrevNode = prevNode;
        prevNode = curNode;
        curNode = curNode.parent;
    }
    (0, debug_1.fail)('Did not find evaluation scope');
    return undefined;
}
exports.getEvaluationScopeNode = getEvaluationScopeNode;
// Returns the parse node corresponding to the function, class, or type alias
// that potentially provides the scope for a type parameter.
function getTypeVarScopeNode(node) {
    let prevNode;
    let curNode = node;
    while (curNode) {
        switch (curNode.nodeType) {
            case 31 /* ParseNodeType.Function */: {
                if (!curNode.decorators.some((decorator) => decorator === prevNode)) {
                    return curNode;
                }
                break;
            }
            case 10 /* ParseNodeType.Class */: {
                if (!curNode.decorators.some((decorator) => decorator === prevNode)) {
                    return curNode;
                }
                break;
            }
            case 77 /* ParseNodeType.TypeAlias */: {
                return curNode;
            }
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getTypeVarScopeNode = getTypeVarScopeNode;
// Returns the parse node corresponding to the scope that is used
// for executing the code referenced in the specified node.
function getExecutionScopeNode(node) {
    let evaluationScope = getEvaluationScopeNode(node).node;
    // Classes are not considered execution scope because they are executed
    // within the context of their containing module or function. Likewise, list
    // comprehensions are executed within their container.
    while (evaluationScope.nodeType === 10 /* ParseNodeType.Class */ ||
        evaluationScope.nodeType === 11 /* ParseNodeType.Comprehension */) {
        evaluationScope = getEvaluationScopeNode(evaluationScope.parent).node;
    }
    return evaluationScope;
}
exports.getExecutionScopeNode = getExecutionScopeNode;
// Given a node within a type annotation expression, returns the type annotation
// node that contains it (if applicable).
function getTypeAnnotationNode(node) {
    let prevNode = node;
    let curNode = node.parent;
    while (curNode) {
        if (curNode.nodeType === 54 /* ParseNodeType.TypeAnnotation */) {
            if (curNode.typeAnnotation === prevNode) {
                return curNode;
            }
            break;
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getTypeAnnotationNode = getTypeAnnotationNode;
// In general, arguments passed to a call are evaluated by the runtime in
// left-to-right order. There is one exception, however, when an unpacked
// iterable is used after a keyword argument.
function getArgumentsByRuntimeOrder(node) {
    const positionalArgs = node.arguments.filter((arg) => !arg.name && arg.argumentCategory !== 2 /* ArgumentCategory.UnpackedDictionary */);
    const keywordArgs = node.arguments.filter((arg) => !!arg.name || arg.argumentCategory === 2 /* ArgumentCategory.UnpackedDictionary */);
    return positionalArgs.concat(keywordArgs);
}
exports.getArgumentsByRuntimeOrder = getArgumentsByRuntimeOrder;
// PEP 591 spells out certain limited cases where an assignment target
// can be annotated with a "Final" annotation. This function determines
// whether Final is allowed for the specified node.
function isFinalAllowedForAssignmentTarget(targetNode) {
    // Simple names always support Final.
    if (targetNode.nodeType === 38 /* ParseNodeType.Name */) {
        return true;
    }
    // Member access expressions like "self.x" are permitted only
    // within __init__ methods.
    if (targetNode.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        if (targetNode.leftExpression.nodeType !== 38 /* ParseNodeType.Name */) {
            return false;
        }
        const classNode = getEnclosingClass(targetNode);
        if (!classNode) {
            return false;
        }
        const methodNode = getEnclosingFunction(targetNode);
        if (!methodNode) {
            return false;
        }
        if (methodNode.name.value !== '__init__') {
            return false;
        }
        return true;
    }
    return false;
}
exports.isFinalAllowedForAssignmentTarget = isFinalAllowedForAssignmentTarget;
function isClassVarAllowedForAssignmentTarget(targetNode) {
    const classNode = getEnclosingClass(targetNode, /* stopAtFunction */ true);
    if (!classNode) {
        return false;
    }
    return true;
}
exports.isClassVarAllowedForAssignmentTarget = isClassVarAllowedForAssignmentTarget;
function isRequiredAllowedForAssignmentTarget(targetNode) {
    const classNode = getEnclosingClass(targetNode, /* stopAtFunction */ true);
    if (!classNode) {
        return false;
    }
    return true;
}
exports.isRequiredAllowedForAssignmentTarget = isRequiredAllowedForAssignmentTarget;
function isNodeContainedWithin(node, potentialContainer) {
    let curNode = node;
    while (curNode) {
        if (curNode === potentialContainer) {
            return true;
        }
        curNode = curNode.parent;
    }
    return false;
}
exports.isNodeContainedWithin = isNodeContainedWithin;
function getParentNodeOfType(node, containerType) {
    let curNode = node;
    while (curNode) {
        if (curNode.nodeType === containerType) {
            return curNode;
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getParentNodeOfType = getParentNodeOfType;
// If the specified node is contained within an expression that is intended to be
// interpreted as a type annotation, this function returns the annotation node.
function getParentAnnotationNode(node) {
    let curNode = node;
    let prevNode;
    while (curNode) {
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            if (prevNode === curNode.returnTypeAnnotation) {
                return prevNode;
            }
            return undefined;
        }
        if (curNode.nodeType === 41 /* ParseNodeType.Parameter */) {
            if (prevNode === curNode.typeAnnotation || prevNode === curNode.typeAnnotationComment) {
                return prevNode;
            }
            return undefined;
        }
        if (curNode.nodeType === 3 /* ParseNodeType.Assignment */) {
            if (prevNode === curNode.typeAnnotationComment) {
                return prevNode;
            }
            return undefined;
        }
        if (curNode.nodeType === 54 /* ParseNodeType.TypeAnnotation */) {
            if (prevNode === curNode.typeAnnotation) {
                return prevNode;
            }
            return undefined;
        }
        if (curNode.nodeType === 62 /* ParseNodeType.FunctionAnnotation */) {
            if (prevNode === curNode.returnTypeAnnotation || curNode.paramTypeAnnotations.some((p) => p === prevNode)) {
                (0, debug_1.assert)(!prevNode || (0, parseNodes_1.isExpressionNode)(prevNode));
                return prevNode;
            }
            return undefined;
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getParentAnnotationNode = getParentAnnotationNode;
function isNodeContainedWithinNodeType(node, containerType) {
    return getParentNodeOfType(node, containerType) !== undefined;
}
exports.isNodeContainedWithinNodeType = isNodeContainedWithinNodeType;
function isSuiteEmpty(node) {
    let sawEllipsis = false;
    for (const statement of node.statements) {
        if (statement.nodeType === 47 /* ParseNodeType.StatementList */) {
            for (const substatement of statement.statements) {
                if (substatement.nodeType === 21 /* ParseNodeType.Ellipsis */) {
                    // Allow an ellipsis
                    sawEllipsis = true;
                }
                else if (substatement.nodeType === 48 /* ParseNodeType.StringList */) {
                    // Allow doc strings
                }
                else {
                    return false;
                }
            }
        }
        else {
            return false;
        }
    }
    return sawEllipsis;
}
exports.isSuiteEmpty = isSuiteEmpty;
function containsAwaitNode(node) {
    let foundAwait = false;
    class AwaitNodeWalker extends parseTreeWalker_1.ParseTreeWalker {
        visitAwait(node) {
            foundAwait = true;
            return false;
        }
    }
    const walker = new AwaitNodeWalker();
    walker.walk(node);
    return foundAwait;
}
exports.containsAwaitNode = containsAwaitNode;
function isMatchingExpression(reference, expression) {
    if (reference.nodeType === 38 /* ParseNodeType.Name */) {
        if (expression.nodeType === 38 /* ParseNodeType.Name */) {
            return reference.value === expression.value;
        }
        else if (expression.nodeType === 4 /* ParseNodeType.AssignmentExpression */) {
            return reference.value === expression.name.value;
        }
        return false;
    }
    else if (reference.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
        expression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        return (isMatchingExpression(reference.leftExpression, expression.leftExpression) &&
            reference.memberName.value === expression.memberName.value);
    }
    else if (reference.nodeType === 27 /* ParseNodeType.Index */ && expression.nodeType === 27 /* ParseNodeType.Index */) {
        if (!isMatchingExpression(reference.baseExpression, expression.baseExpression)) {
            return false;
        }
        if (expression.items.length !== 1 ||
            expression.trailingComma ||
            expression.items[0].name ||
            expression.items[0].argumentCategory !== 0 /* ArgumentCategory.Simple */) {
            return false;
        }
        const expr = reference.items[0].valueExpression;
        if (expr.nodeType === 40 /* ParseNodeType.Number */) {
            const subscriptNode = expression.items[0].valueExpression;
            if (subscriptNode.nodeType !== 40 /* ParseNodeType.Number */ ||
                subscriptNode.isImaginary ||
                !subscriptNode.isInteger) {
                return false;
            }
            return expr.value === subscriptNode.value;
        }
        if (expr.nodeType === 55 /* ParseNodeType.UnaryOperation */ &&
            expr.operator === 33 /* OperatorType.Subtract */ &&
            expr.expression.nodeType === 40 /* ParseNodeType.Number */) {
            const subscriptNode = expression.items[0].valueExpression;
            if (subscriptNode.nodeType !== 55 /* ParseNodeType.UnaryOperation */ ||
                subscriptNode.operator !== 33 /* OperatorType.Subtract */ ||
                subscriptNode.expression.nodeType !== 40 /* ParseNodeType.Number */ ||
                subscriptNode.expression.isImaginary ||
                !subscriptNode.expression.isInteger) {
                return false;
            }
            return expr.expression.value === subscriptNode.expression.value;
        }
        if (expr.nodeType === 48 /* ParseNodeType.StringList */) {
            const referenceStringListNode = expr;
            const subscriptNode = expression.items[0].valueExpression;
            if (referenceStringListNode.strings.length === 1 &&
                referenceStringListNode.strings[0].nodeType === 49 /* ParseNodeType.String */ &&
                subscriptNode.nodeType === 48 /* ParseNodeType.StringList */ &&
                subscriptNode.strings.length === 1 &&
                subscriptNode.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                return referenceStringListNode.strings[0].value === subscriptNode.strings[0].value;
            }
        }
        return false;
    }
    return false;
}
exports.isMatchingExpression = isMatchingExpression;
function isPartialMatchingExpression(reference, expression) {
    if (reference.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        return (isMatchingExpression(reference.leftExpression, expression) ||
            isPartialMatchingExpression(reference.leftExpression, expression));
    }
    else if (reference.nodeType === 27 /* ParseNodeType.Index */) {
        return (isMatchingExpression(reference.baseExpression, expression) ||
            isPartialMatchingExpression(reference.baseExpression, expression));
    }
    return false;
}
exports.isPartialMatchingExpression = isPartialMatchingExpression;
function isWithinDefaultParamInitializer(node) {
    let curNode = node;
    let prevNode;
    while (curNode) {
        if (curNode.nodeType === 41 /* ParseNodeType.Parameter */ && prevNode === curNode.defaultValue) {
            return true;
        }
        if (curNode.nodeType === 33 /* ParseNodeType.Lambda */ ||
            curNode.nodeType === 31 /* ParseNodeType.Function */ ||
            curNode.nodeType === 10 /* ParseNodeType.Class */ ||
            curNode.nodeType === 36 /* ParseNodeType.Module */) {
            return false;
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return false;
}
exports.isWithinDefaultParamInitializer = isWithinDefaultParamInitializer;
function isWithinTypeAnnotation(node, requireQuotedAnnotation) {
    let curNode = node;
    let prevNode;
    let isQuoted = false;
    while (curNode) {
        if (curNode.nodeType === 41 /* ParseNodeType.Parameter */ &&
            (prevNode === curNode.typeAnnotation || prevNode === curNode.typeAnnotationComment)) {
            return isQuoted || !requireQuotedAnnotation;
        }
        if (curNode.nodeType === 31 /* ParseNodeType.Function */ && prevNode === curNode.returnTypeAnnotation) {
            return isQuoted || !requireQuotedAnnotation;
        }
        if (curNode.nodeType === 31 /* ParseNodeType.Function */ && prevNode === curNode.functionAnnotationComment) {
            // Type comments are always considered forward declarations even though
            // they're not "quoted".
            return true;
        }
        if (curNode.nodeType === 54 /* ParseNodeType.TypeAnnotation */ && prevNode === curNode.typeAnnotation) {
            return isQuoted || !requireQuotedAnnotation;
        }
        if (curNode.nodeType === 3 /* ParseNodeType.Assignment */ && prevNode === curNode.typeAnnotationComment) {
            // Type comments are always considered forward declarations even though
            // they're not "quoted".
            return true;
        }
        if (curNode.nodeType === 48 /* ParseNodeType.StringList */ && prevNode === curNode.typeAnnotation) {
            isQuoted = true;
        }
        if (curNode.nodeType === 33 /* ParseNodeType.Lambda */ ||
            curNode.nodeType === 31 /* ParseNodeType.Function */ ||
            curNode.nodeType === 10 /* ParseNodeType.Class */ ||
            curNode.nodeType === 36 /* ParseNodeType.Module */) {
            return false;
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return false;
}
exports.isWithinTypeAnnotation = isWithinTypeAnnotation;
function isWithinAnnotationComment(node) {
    let curNode = node;
    let prevNode;
    while (curNode) {
        if (curNode.nodeType === 31 /* ParseNodeType.Function */ && prevNode === curNode.functionAnnotationComment) {
            // Type comments are always considered forward declarations even though
            // they're not "quoted".
            return true;
        }
        if (curNode.nodeType === 3 /* ParseNodeType.Assignment */ && prevNode === curNode.typeAnnotationComment) {
            // Type comments are always considered forward declarations even though
            // they're not "quoted".
            return true;
        }
        if (curNode.nodeType === 33 /* ParseNodeType.Lambda */ ||
            curNode.nodeType === 31 /* ParseNodeType.Function */ ||
            curNode.nodeType === 10 /* ParseNodeType.Class */ ||
            curNode.nodeType === 36 /* ParseNodeType.Module */) {
            return false;
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return false;
}
exports.isWithinAnnotationComment = isWithinAnnotationComment;
function isWithinLoop(node) {
    let curNode = node;
    while (curNode) {
        switch (curNode.nodeType) {
            case 29 /* ParseNodeType.For */:
            case 57 /* ParseNodeType.While */: {
                return true;
            }
            case 36 /* ParseNodeType.Module */: {
                break;
            }
        }
        curNode = curNode.parent;
    }
    return false;
}
exports.isWithinLoop = isWithinLoop;
function isWithinAssertExpression(node) {
    let curNode = node;
    let prevNode;
    while (curNode) {
        switch (curNode.nodeType) {
            case 2 /* ParseNodeType.Assert */: {
                return curNode.testExpression === prevNode;
            }
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return false;
}
exports.isWithinAssertExpression = isWithinAssertExpression;
function getDocString(statements) {
    // See if the first statement in the suite is a triple-quote string.
    if (statements.length === 0) {
        return undefined;
    }
    if (statements[0].nodeType !== 47 /* ParseNodeType.StatementList */) {
        return undefined;
    }
    if (!isDocString(statements[0])) {
        return undefined;
    }
    // It's up to the user to convert normalize/convert this as needed.
    const strings = statements[0].statements[0].strings;
    if (strings.length === 1) {
        return strings[0].value;
    }
    return strings.map((s) => s.value).join('');
}
exports.getDocString = getDocString;
function isDocString(statementList) {
    // If the first statement in the suite isn't a StringNode,
    // assume there is no docString.
    if (statementList.statements.length === 0 || statementList.statements[0].nodeType !== 48 /* ParseNodeType.StringList */) {
        return false;
    }
    // A docstring can consist of multiple joined strings in a single expression.
    const strings = statementList.statements[0].strings;
    if (strings.length === 0) {
        return false;
    }
    // Any f-strings invalidate the entire docstring.
    if (strings.some((n) => n.nodeType === 30 /* ParseNodeType.FormatString */)) {
        return false;
    }
    // It's up to the user to convert normalize/convert this as needed.
    return true;
}
exports.isDocString = isDocString;
// Sometimes a NamedTuple assignment statement is followed by a statement
// that looks like the following:
//    MyNamedTuple.__new__.__defaults__ = ...
// This pattern is commonly used to set the default values that are
// not specified in the original list.
function isAssignmentToDefaultsFollowingNamedTuple(callNode) {
    var _a, _b;
    if (callNode.nodeType !== 9 /* ParseNodeType.Call */ ||
        !callNode.parent ||
        callNode.parent.nodeType !== 3 /* ParseNodeType.Assignment */ ||
        callNode.parent.leftExpression.nodeType !== 38 /* ParseNodeType.Name */ ||
        !callNode.parent.parent ||
        callNode.parent.parent.nodeType !== 47 /* ParseNodeType.StatementList */) {
        return false;
    }
    const namedTupleAssignedName = callNode.parent.leftExpression.value;
    const statementList = callNode.parent.parent;
    if (statementList.statements[0] !== callNode.parent ||
        !statementList.parent ||
        !(statementList.parent.nodeType === 36 /* ParseNodeType.Module */ ||
            statementList.parent.nodeType === 50 /* ParseNodeType.Suite */)) {
        return false;
    }
    const moduleOrSuite = statementList.parent;
    let statementIndex = moduleOrSuite.statements.findIndex((s) => s === statementList);
    if (statementIndex < 0) {
        return false;
    }
    statementIndex++;
    while (statementIndex < moduleOrSuite.statements.length) {
        const nextStatement = moduleOrSuite.statements[statementIndex];
        if (nextStatement.nodeType !== 47 /* ParseNodeType.StatementList */) {
            break;
        }
        if (((_a = nextStatement.statements[0]) === null || _a === void 0 ? void 0 : _a.nodeType) === 48 /* ParseNodeType.StringList */) {
            // Skip over comments
            statementIndex++;
            continue;
        }
        if (((_b = nextStatement.statements[0]) === null || _b === void 0 ? void 0 : _b.nodeType) === 3 /* ParseNodeType.Assignment */) {
            const assignNode = nextStatement.statements[0];
            if (assignNode.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                assignNode.leftExpression.memberName.value === '__defaults__') {
                const defaultTarget = assignNode.leftExpression.leftExpression;
                if (defaultTarget.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                    defaultTarget.memberName.value === '__new__' &&
                    defaultTarget.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                    defaultTarget.leftExpression.value === namedTupleAssignedName) {
                    return true;
                }
            }
        }
        break;
    }
    return false;
}
exports.isAssignmentToDefaultsFollowingNamedTuple = isAssignmentToDefaultsFollowingNamedTuple;
// This simple parse tree walker calls a callback function
// for each NameNode it encounters.
class NameNodeWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_callback) {
        super();
        this._callback = _callback;
    }
    visitName(node) {
        this._callback(node, this._subscriptIndex, this._baseExpression);
        return true;
    }
    visitIndex(node) {
        this.walk(node.baseExpression);
        const prevSubscriptIndex = this._subscriptIndex;
        const prevBaseExpression = this._baseExpression;
        this._baseExpression = node.baseExpression;
        node.items.forEach((item, index) => {
            this._subscriptIndex = index;
            this.walk(item);
        });
        this._subscriptIndex = prevSubscriptIndex;
        this._baseExpression = prevBaseExpression;
        return false;
    }
}
exports.NameNodeWalker = NameNodeWalker;
class CallNodeWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_callback) {
        super();
        this._callback = _callback;
    }
    visitCall(node) {
        this._callback(node);
        return true;
    }
}
exports.CallNodeWalker = CallNodeWalker;
function getEnclosingParameter(node) {
    let curNode = node;
    while (curNode) {
        if (curNode.nodeType === 41 /* ParseNodeType.Parameter */) {
            return curNode;
        }
        if (curNode.nodeType === 31 /* ParseNodeType.Function */) {
            return undefined;
        }
        curNode = curNode.parent;
    }
    return undefined;
}
exports.getEnclosingParameter = getEnclosingParameter;
function getCallNodeAndActiveParameterIndex(node, insertionOffset, tokens) {
    // Find the call node that contains the specified node.
    let curNode = node;
    let callNode;
    while (curNode !== undefined) {
        // make sure we only look at callNodes when we are inside their arguments
        if (curNode.nodeType === 9 /* ParseNodeType.Call */) {
            if (isOffsetInsideCallArgs(tokens, curNode, insertionOffset)) {
                callNode = curNode;
                break;
            }
        }
        curNode = curNode.parent;
    }
    if (!callNode || !callNode.arguments) {
        return undefined;
    }
    const endPosition = textRange_1.TextRange.getEnd(callNode);
    if (insertionOffset > endPosition) {
        return undefined;
    }
    const tokenAtEnd = getTokenAt(tokens, endPosition - 1);
    if (insertionOffset === endPosition && (tokenAtEnd === null || tokenAtEnd === void 0 ? void 0 : tokenAtEnd.type) === 14 /* TokenType.CloseParenthesis */) {
        return undefined;
    }
    let addedActive = false;
    let activeIndex = -1;
    let activeOrFake = false;
    callNode.arguments.forEach((arg, index) => {
        if (addedActive) {
            return;
        }
        // Calculate the argument's bounds including whitespace and colons.
        let start = arg.start;
        const startTokenIndex = tokens.getItemAtPosition(start);
        if (startTokenIndex >= 0) {
            start = textRange_1.TextRange.getEnd(tokens.getItemAt(startTokenIndex - 1));
        }
        let end = textRange_1.TextRange.getEnd(arg);
        const endTokenIndex = tokens.getItemAtPosition(end);
        if (endTokenIndex >= 0) {
            // Find the true end of the argument by searching for the
            // terminating comma or parenthesis.
            for (let i = endTokenIndex; i < tokens.count; i++) {
                const tok = tokens.getItemAt(i);
                switch (tok.type) {
                    case 12 /* TokenType.Comma */:
                    case 14 /* TokenType.CloseParenthesis */:
                        break;
                    default:
                        continue;
                }
                end = textRange_1.TextRange.getEnd(tok);
                break;
            }
        }
        if (insertionOffset < end) {
            activeIndex = index;
            activeOrFake = insertionOffset >= start;
            addedActive = true;
        }
    });
    if (!addedActive) {
        activeIndex = callNode.arguments.length + 1;
    }
    return {
        callNode,
        activeIndex,
        activeOrFake,
    };
    function isOffsetInsideCallArgs(tokens, node, offset) {
        const argumentStart = node.leftExpression.length > 0 ? textRange_1.TextRange.getEnd(node.leftExpression) - 1 : node.leftExpression.start;
        // Handle obvious case first.
        const callEndOffset = textRange_1.TextRange.getEnd(node);
        if (offset < argumentStart || callEndOffset < offset) {
            return false;
        }
        if (node.arguments.length > 0) {
            const start = node.arguments[0].start;
            const end = textRange_1.TextRange.getEnd(node.arguments[node.arguments.length - 1]);
            if (start <= offset && offset < end) {
                return true;
            }
        }
        const index = tokens.getItemAtPosition(argumentStart);
        if (index < 0 || tokens.count <= index) {
            return true;
        }
        const nextToken = tokens.getItemAt(index + 1);
        if (nextToken.type === 13 /* TokenType.OpenParenthesis */ && offset < textRange_1.TextRange.getEnd(nextToken)) {
            // Position must be after '('.
            return false;
        }
        return true;
    }
}
exports.getCallNodeAndActiveParameterIndex = getCallNodeAndActiveParameterIndex;
function getTokenIndexAtLeft(tokens, position, includeWhitespace = false, includeZeroLengthToken = false) {
    const index = tokens.getItemAtPosition(position);
    if (index < 0) {
        return -1;
    }
    for (let i = index; i >= 0; i--) {
        const token = tokens.getItemAt(i);
        if (!includeZeroLengthToken && token.length === 0) {
            continue;
        }
        if (!includeWhitespace && isWhitespace(token)) {
            continue;
        }
        if (textRange_1.TextRange.getEnd(token) <= position) {
            return i;
        }
    }
    return -1;
}
exports.getTokenIndexAtLeft = getTokenIndexAtLeft;
function getTokenAtLeft(tokens, position, includeWhitespace = false, includeZeroLengthToken = false) {
    const index = getTokenIndexAtLeft(tokens, position, includeWhitespace, includeZeroLengthToken);
    if (index < 0) {
        return undefined;
    }
    return tokens.getItemAt(index);
}
exports.getTokenAtLeft = getTokenAtLeft;
function isWhitespace(token) {
    return token.type === 2 /* TokenType.NewLine */ || token.type === 3 /* TokenType.Indent */ || token.type === 4 /* TokenType.Dedent */;
}
exports.isWhitespace = isWhitespace;
function getTokenAtIndex(tokens, index) {
    if (index < 0) {
        return undefined;
    }
    return tokens.getItemAt(index);
}
exports.getTokenAtIndex = getTokenAtIndex;
function getTokenAt(tokens, position) {
    return getTokenAtIndex(tokens, tokens.getItemAtPosition(position));
}
exports.getTokenAt = getTokenAt;
function getTokenOverlapping(tokens, position) {
    const index = getIndexOfTokenOverlapping(tokens, position);
    return getTokenAtIndex(tokens, index);
}
exports.getTokenOverlapping = getTokenOverlapping;
function getIndexOfTokenOverlapping(tokens, position) {
    const index = tokens.getItemAtPosition(position);
    if (index < 0) {
        return -1;
    }
    const token = tokens.getItemAt(index);
    return textRange_1.TextRange.overlaps(token, position) ? index : -1;
}
exports.getIndexOfTokenOverlapping = getIndexOfTokenOverlapping;
function findTokenAfter(tokenizerOutput, offset, predicate) {
    const tokens = tokenizerOutput.tokens;
    const index = tokens.getItemAtPosition(offset);
    if (index < 0) {
        return undefined;
    }
    for (let i = index; i < tokens.length; i++) {
        const token = tokens.getItemAt(i);
        if (predicate(token)) {
            return token;
        }
    }
    return undefined;
}
exports.findTokenAfter = findTokenAfter;
function getCommentsAtTokenIndex(tokens, index) {
    let token = getTokenAtIndex(tokens, index);
    if (!token) {
        return undefined;
    }
    // If the preceding token has the same start offset
    // (in other words, when tokens have zero length and they're piled on top of each other)
    // look back through the tokens until we find the first token with that start offset.
    // That's where the comments (if any) will be.
    for (let precedingIndex = index - 1; precedingIndex >= 0; --precedingIndex) {
        const precedingToken = getTokenAtIndex(tokens, precedingIndex);
        if (precedingToken && precedingToken.start === token.start) {
            token = precedingToken;
        }
        else {
            break;
        }
    }
    return token.comments;
}
exports.getCommentsAtTokenIndex = getCommentsAtTokenIndex;
function printParseNodeType(type) {
    switch (type) {
        case 0 /* ParseNodeType.Error */:
            return 'Error';
        case 1 /* ParseNodeType.Argument */:
            return 'Argument';
        case 2 /* ParseNodeType.Assert */:
            return 'Assert';
        case 3 /* ParseNodeType.Assignment */:
            return 'Assignment';
        case 4 /* ParseNodeType.AssignmentExpression */:
            return 'AssignmentExpression';
        case 5 /* ParseNodeType.AugmentedAssignment */:
            return 'AugmentedAssignment';
        case 6 /* ParseNodeType.Await */:
            return 'Await';
        case 7 /* ParseNodeType.BinaryOperation */:
            return 'BinaryOperation';
        case 8 /* ParseNodeType.Break */:
            return 'Break';
        case 9 /* ParseNodeType.Call */:
            return 'Call';
        case 10 /* ParseNodeType.Class */:
            return 'Class';
        case 14 /* ParseNodeType.Constant */:
            return 'Constant';
        case 15 /* ParseNodeType.Continue */:
            return 'Continue';
        case 16 /* ParseNodeType.Decorator */:
            return 'Decorator';
        case 17 /* ParseNodeType.Del */:
            return 'Del';
        case 18 /* ParseNodeType.Dictionary */:
            return 'Dictionary';
        case 19 /* ParseNodeType.DictionaryExpandEntry */:
            return 'DictionaryExpandEntry';
        case 20 /* ParseNodeType.DictionaryKeyEntry */:
            return 'DictionaryKeyEntry';
        case 21 /* ParseNodeType.Ellipsis */:
            return 'Ellipsis';
        case 22 /* ParseNodeType.If */:
            return 'If';
        case 23 /* ParseNodeType.Import */:
            return 'Import';
        case 24 /* ParseNodeType.ImportAs */:
            return 'ImportAs';
        case 25 /* ParseNodeType.ImportFrom */:
            return 'ImportFrom';
        case 26 /* ParseNodeType.ImportFromAs */:
            return 'ImportFromAs';
        case 27 /* ParseNodeType.Index */:
            return 'Index';
        case 28 /* ParseNodeType.Except */:
            return 'Except';
        case 29 /* ParseNodeType.For */:
            return 'For';
        case 30 /* ParseNodeType.FormatString */:
            return 'FormatString';
        case 31 /* ParseNodeType.Function */:
            return 'Function';
        case 32 /* ParseNodeType.Global */:
            return 'Global';
        case 33 /* ParseNodeType.Lambda */:
            return 'Lambda';
        case 34 /* ParseNodeType.List */:
            return 'List';
        case 11 /* ParseNodeType.Comprehension */:
            return 'Comprehension';
        case 12 /* ParseNodeType.ComprehensionFor */:
            return 'ComprehensionFor';
        case 13 /* ParseNodeType.ComprehensionIf */:
            return 'ComprehensionIf';
        case 35 /* ParseNodeType.MemberAccess */:
            return 'MemberAccess';
        case 36 /* ParseNodeType.Module */:
            return 'Module';
        case 37 /* ParseNodeType.ModuleName */:
            return 'ModuleName';
        case 38 /* ParseNodeType.Name */:
            return 'Name';
        case 39 /* ParseNodeType.Nonlocal */:
            return 'Nonlocal';
        case 40 /* ParseNodeType.Number */:
            return 'Number';
        case 41 /* ParseNodeType.Parameter */:
            return 'Parameter';
        case 42 /* ParseNodeType.Pass */:
            return 'Pass';
        case 43 /* ParseNodeType.Raise */:
            return 'Raise';
        case 44 /* ParseNodeType.Return */:
            return 'Return';
        case 45 /* ParseNodeType.Set */:
            return 'Set';
        case 46 /* ParseNodeType.Slice */:
            return 'Slice';
        case 47 /* ParseNodeType.StatementList */:
            return 'StatementList';
        case 48 /* ParseNodeType.StringList */:
            return 'StringList';
        case 49 /* ParseNodeType.String */:
            return 'String';
        case 50 /* ParseNodeType.Suite */:
            return 'Suite';
        case 51 /* ParseNodeType.Ternary */:
            return 'Ternary';
        case 52 /* ParseNodeType.Tuple */:
            return 'Tuple';
        case 53 /* ParseNodeType.Try */:
            return 'Try';
        case 54 /* ParseNodeType.TypeAnnotation */:
            return 'TypeAnnotation';
        case 55 /* ParseNodeType.UnaryOperation */:
            return 'UnaryOperation';
        case 56 /* ParseNodeType.Unpack */:
            return 'Unpack';
        case 57 /* ParseNodeType.While */:
            return 'While';
        case 58 /* ParseNodeType.With */:
            return 'With';
        case 59 /* ParseNodeType.WithItem */:
            return 'WithItem';
        case 60 /* ParseNodeType.Yield */:
            return 'Yield';
        case 61 /* ParseNodeType.YieldFrom */:
            return 'YieldFrom';
        case 62 /* ParseNodeType.FunctionAnnotation */:
            return 'FunctionAnnotation';
        case 63 /* ParseNodeType.Match */:
            return 'Match';
        case 64 /* ParseNodeType.Case */:
            return 'Case';
        case 65 /* ParseNodeType.PatternSequence */:
            return 'PatternSequence';
        case 66 /* ParseNodeType.PatternAs */:
            return 'PatternAs';
        case 67 /* ParseNodeType.PatternLiteral */:
            return 'PatternLiteral';
        case 68 /* ParseNodeType.PatternClass */:
            return 'PatternClass';
        case 69 /* ParseNodeType.PatternCapture */:
            return 'PatternCapture';
        case 70 /* ParseNodeType.PatternMapping */:
            return 'PatternMapping';
        case 71 /* ParseNodeType.PatternMappingKeyEntry */:
            return 'PatternMappingKeyEntry';
        case 72 /* ParseNodeType.PatternMappingExpandEntry */:
            return 'PatternMappingExpandEntry';
        case 73 /* ParseNodeType.PatternValue */:
            return 'PatternValue';
        case 74 /* ParseNodeType.PatternClassArgument */:
            return 'PatternClassArgument';
        case 75 /* ParseNodeType.TypeParameter */:
            return 'TypeParameter';
        case 76 /* ParseNodeType.TypeParameterList */:
            return 'TypeParameterList';
        case 77 /* ParseNodeType.TypeAlias */:
            return 'TypeAlias';
    }
    (0, debug_1.assertNever)(type);
}
exports.printParseNodeType = printParseNodeType;
function isWriteAccess(node) {
    let prevNode = node;
    let curNode = prevNode.parent;
    while (curNode) {
        switch (curNode.nodeType) {
            case 3 /* ParseNodeType.Assignment */: {
                return prevNode === curNode.leftExpression;
            }
            case 5 /* ParseNodeType.AugmentedAssignment */: {
                return prevNode === curNode.leftExpression;
            }
            case 4 /* ParseNodeType.AssignmentExpression */: {
                return prevNode === curNode.name;
            }
            case 17 /* ParseNodeType.Del */: {
                return true;
            }
            case 29 /* ParseNodeType.For */: {
                return prevNode === curNode.targetExpression;
            }
            case 24 /* ParseNodeType.ImportAs */: {
                return (prevNode === curNode.alias ||
                    (curNode.module.nameParts.length > 0 && prevNode === curNode.module.nameParts[0]));
            }
            case 26 /* ParseNodeType.ImportFromAs */: {
                return prevNode === curNode.alias || (!curNode.alias && prevNode === curNode.name);
            }
            case 35 /* ParseNodeType.MemberAccess */: {
                if (prevNode !== curNode.memberName) {
                    return false;
                }
                break;
            }
            case 28 /* ParseNodeType.Except */: {
                return prevNode === curNode.name;
            }
            case 58 /* ParseNodeType.With */: {
                return curNode.withItems.some((item) => item === prevNode);
            }
            case 12 /* ParseNodeType.ComprehensionFor */: {
                return prevNode === curNode.targetExpression;
            }
            case 54 /* ParseNodeType.TypeAnnotation */: {
                if (prevNode === curNode.typeAnnotation) {
                    return false;
                }
                break;
            }
            case 31 /* ParseNodeType.Function */:
            case 10 /* ParseNodeType.Class */:
            case 36 /* ParseNodeType.Module */: {
                return false;
            }
        }
        prevNode = curNode;
        curNode = curNode.parent;
    }
    return false;
}
exports.isWriteAccess = isWriteAccess;
function getModuleNode(node) {
    let current = node;
    while (current && current.nodeType !== 36 /* ParseNodeType.Module */) {
        current = current.parent;
    }
    return current;
}
exports.getModuleNode = getModuleNode;
function getFileInfoFromNode(node) {
    const current = getModuleNode(node);
    return current ? AnalyzerNodeInfo.getFileInfo(current) : undefined;
}
exports.getFileInfoFromNode = getFileInfoFromNode;
function isFunctionSuiteEmpty(node) {
    let isEmpty = true;
    node.suite.statements.forEach((statement) => {
        if (statement.nodeType === 0 /* ParseNodeType.Error */) {
            return;
        }
        else if (statement.nodeType === 47 /* ParseNodeType.StatementList */) {
            statement.statements.forEach((subStatement) => {
                // Allow docstrings, ellipsis, and pass statements.
                if (subStatement.nodeType !== 21 /* ParseNodeType.Ellipsis */ &&
                    subStatement.nodeType !== 48 /* ParseNodeType.StringList */ &&
                    subStatement.nodeType !== 42 /* ParseNodeType.Pass */) {
                    isEmpty = false;
                }
            });
        }
        else {
            isEmpty = false;
        }
    });
    return isEmpty;
}
exports.isFunctionSuiteEmpty = isFunctionSuiteEmpty;
function getTypeAnnotationForParameter(node, paramIndex) {
    if (paramIndex >= node.parameters.length) {
        return undefined;
    }
    const param = node.parameters[paramIndex];
    if (param.typeAnnotation) {
        return param.typeAnnotation;
    }
    else if (param.typeAnnotationComment) {
        return param.typeAnnotationComment;
    }
    if (!node.functionAnnotationComment || node.functionAnnotationComment.isParamListEllipsis) {
        return undefined;
    }
    let firstCommentAnnotationIndex = 0;
    const paramAnnotations = node.functionAnnotationComment.paramTypeAnnotations;
    if (paramAnnotations.length < node.parameters.length) {
        firstCommentAnnotationIndex = 1;
    }
    const adjIndex = paramIndex - firstCommentAnnotationIndex;
    if (adjIndex < 0 || adjIndex >= paramAnnotations.length) {
        return undefined;
    }
    return paramAnnotations[adjIndex];
}
exports.getTypeAnnotationForParameter = getTypeAnnotationForParameter;
function isImportModuleName(node) {
    var _a, _b;
    return ((_b = (_a = getFirstAncestorOrSelfOfKind(node, 37 /* ParseNodeType.ModuleName */)) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 24 /* ParseNodeType.ImportAs */;
}
exports.isImportModuleName = isImportModuleName;
function isImportAlias(node) {
    var _a;
    return ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 24 /* ParseNodeType.ImportAs */ && node.parent.alias === node;
}
exports.isImportAlias = isImportAlias;
function isFromImportModuleName(node) {
    var _a, _b;
    return ((_b = (_a = getFirstAncestorOrSelfOfKind(node, 37 /* ParseNodeType.ModuleName */)) === null || _a === void 0 ? void 0 : _a.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 25 /* ParseNodeType.ImportFrom */;
}
exports.isFromImportModuleName = isFromImportModuleName;
function isFromImportName(node) {
    var _a;
    return ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 26 /* ParseNodeType.ImportFromAs */ && node.parent.name === node;
}
exports.isFromImportName = isFromImportName;
function isFromImportAlias(node) {
    var _a;
    return ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 26 /* ParseNodeType.ImportFromAs */ && node.parent.alias === node;
}
exports.isFromImportAlias = isFromImportAlias;
function isLastNameOfModuleName(node) {
    var _a;
    if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 37 /* ParseNodeType.ModuleName */) {
        return false;
    }
    const module = node.parent;
    if (module.nameParts.length === 0) {
        return false;
    }
    return module.nameParts[module.nameParts.length - 1] === node;
}
exports.isLastNameOfModuleName = isLastNameOfModuleName;
function* getAncestorsIncludingSelf(node) {
    while (node !== undefined) {
        yield node;
        node = node.parent;
    }
}
exports.getAncestorsIncludingSelf = getAncestorsIncludingSelf;
function getFirstAncestorOrSelfOfKind(node, type) {
    return getFirstAncestorOrSelf(node, (n) => n.nodeType === type);
}
exports.getFirstAncestorOrSelfOfKind = getFirstAncestorOrSelfOfKind;
function getFirstAncestorOrSelf(node, predicate) {
    for (const current of getAncestorsIncludingSelf(node)) {
        if (predicate(current)) {
            return current;
        }
    }
    return undefined;
}
exports.getFirstAncestorOrSelf = getFirstAncestorOrSelf;
function getDottedNameWithGivenNodeAsLastName(node) {
    var _a;
    // Shape of dotted name is
    //    MemberAccess (ex, a.b)
    //  Name        Name
    // or
    //           MemberAccess (ex, a.b.c)
    //    MemberAccess     Name
    //  Name       Name
    if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 35 /* ParseNodeType.MemberAccess */) {
        return node;
    }
    if (node.parent.leftExpression === node) {
        return node;
    }
    return node.parent;
}
exports.getDottedNameWithGivenNodeAsLastName = getDottedNameWithGivenNodeAsLastName;
//
// Returns the dotted name that makes up the expression for the decorator.
// Example:
// @pytest.fixture()
// def my_fixture():
//    pass
//
// would return `pytest.fixture`
function getDecoratorName(decorator) {
    function getExpressionName(node) {
        var _a;
        if (node.nodeType === 38 /* ParseNodeType.Name */ || node.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            return (_a = getDottedName(node)) === null || _a === void 0 ? void 0 : _a.map((n) => n.value).join('.');
        }
        if (node.nodeType === 9 /* ParseNodeType.Call */) {
            return getExpressionName(node.leftExpression);
        }
        return undefined;
    }
    return getExpressionName(decorator.expression);
}
exports.getDecoratorName = getDecoratorName;
function getDottedName(node) {
    // ex) [a] or [a].b
    // simple case, [a]
    if (node.nodeType === 38 /* ParseNodeType.Name */) {
        return [node];
    }
    // dotted name case.
    const names = [];
    if (_getDottedName(node, names)) {
        return names.reverse();
    }
    return undefined;
    function _getDottedName(node, names) {
        if (node.nodeType === 38 /* ParseNodeType.Name */) {
            names.push(node);
            return true;
        }
        names.push(node.memberName);
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ ||
            node.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            return _getDottedName(node.leftExpression, names);
        }
        return false;
    }
}
exports.getDottedName = getDottedName;
function getFirstNameOfDottedName(node) {
    // ex) [a] or [a].b
    if (node.nodeType === 38 /* ParseNodeType.Name */) {
        return node;
    }
    if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ ||
        node.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        return getFirstNameOfDottedName(node.leftExpression);
    }
    return undefined;
}
exports.getFirstNameOfDottedName = getFirstNameOfDottedName;
function isFirstNameOfDottedName(node) {
    var _a;
    // ex) [A] or [A].B.C.D
    if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 35 /* ParseNodeType.MemberAccess */) {
        return true;
    }
    if (node.parent.leftExpression === node) {
        return true;
    }
    return false;
}
exports.isFirstNameOfDottedName = isFirstNameOfDottedName;
function isLastNameOfDottedName(node) {
    var _a, _b;
    // ex) A or D.C.B.[A]
    if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 35 /* ParseNodeType.MemberAccess */) {
        return true;
    }
    if (node.parent.leftExpression.nodeType !== 38 /* ParseNodeType.Name */ &&
        node.parent.leftExpression.nodeType !== 35 /* ParseNodeType.MemberAccess */) {
        return false;
    }
    if (node.parent.leftExpression === node) {
        return false;
    }
    return ((_b = node.parent.parent) === null || _b === void 0 ? void 0 : _b.nodeType) !== 35 /* ParseNodeType.MemberAccess */;
}
exports.isLastNameOfDottedName = isLastNameOfDottedName;
function getStringNodeValueRange(node) {
    return getStringValueRange(node.token);
}
exports.getStringNodeValueRange = getStringNodeValueRange;
function getStringValueRange(token) {
    const length = token.quoteMarkLength;
    const hasEnding = !(token.flags & 65536 /* StringTokenFlags.Unterminated */);
    return textRange_1.TextRange.create(token.start + length, token.length - length - (hasEnding ? length : 0));
}
exports.getStringValueRange = getStringValueRange;
function getFullStatementRange(statementNode, parseFileResults, options) {
    var _a;
    const range = (0, positionUtils_1.convertTextRangeToRange)(statementNode, parseFileResults.tokenizerOutput.lines);
    const start = (_a = _getStartPositionIfMultipleStatementsAreOnSameLine(range, statementNode.start, parseFileResults.tokenizerOutput)) !== null && _a !== void 0 ? _a : {
        line: range.start.line,
        character: 0,
    };
    // First, see whether there are other tokens except semicolon or new line on the same line.
    const end = _getEndPositionIfMultipleStatementsAreOnSameLine(range, textRange_1.TextRange.getEnd(statementNode), parseFileResults.tokenizerOutput);
    if (end) {
        return { start, end };
    }
    // If not, delete the whole line.
    if (range.end.line === parseFileResults.tokenizerOutput.lines.count - 1) {
        return { start, end: range.end };
    }
    let lineDeltaToAdd = 1;
    if (options) {
        if (options.includeTrailingBlankLines) {
            for (let i = lineDeltaToAdd; range.end.line + i < parseFileResults.tokenizerOutput.lines.count; i++) {
                if (!isBlankLine(parseFileResults.tokenizerOutput, parseFileResults.text, range.end.line + i)) {
                    lineDeltaToAdd = i;
                    break;
                }
            }
        }
    }
    return { start, end: { line: range.end.line + lineDeltaToAdd, character: 0 } };
}
exports.getFullStatementRange = getFullStatementRange;
function isBlankLine(tokenizerOutput, text, line) {
    const span = tokenizerOutput.lines.getItemAt(line);
    return (0, core_1.containsOnlyWhitespace)(text, span);
}
exports.isBlankLine = isBlankLine;
function isUnannotatedFunction(node) {
    return (node.returnTypeAnnotation === undefined &&
        node.parameters.every((param) => param.typeAnnotation === undefined && param.typeAnnotationComment === undefined));
}
exports.isUnannotatedFunction = isUnannotatedFunction;
// Verifies that an import of the form "from __future__ import x"
// occurs only at the top of a file. This mirrors the algorithm used
// in the CPython interpreter.
function isValidLocationForFutureImport(node) {
    const module = getModuleNode(node);
    (0, debug_1.assert)(module);
    let sawDocString = false;
    for (const statement of module.statements) {
        if (statement.nodeType !== 47 /* ParseNodeType.StatementList */) {
            return false;
        }
        for (const simpleStatement of statement.statements) {
            if (simpleStatement === node) {
                return true;
            }
            if (simpleStatement.nodeType === 48 /* ParseNodeType.StringList */) {
                if (sawDocString) {
                    return false;
                }
                sawDocString = true;
            }
            else if (simpleStatement.nodeType === 25 /* ParseNodeType.ImportFrom */) {
                if (simpleStatement.module.leadingDots !== 0 ||
                    simpleStatement.module.nameParts.length !== 1 ||
                    simpleStatement.module.nameParts[0].value !== '__future__') {
                    return false;
                }
            }
            else {
                return false;
            }
        }
    }
    return false;
}
exports.isValidLocationForFutureImport = isValidLocationForFutureImport;
// "Chaining" is when binary operators can be chained together
// as a shorthand. For example, "a < b < c" is shorthand for
// "a < b and b < c".
function operatorSupportsChaining(op) {
    switch (op) {
        case 12 /* OperatorType.Equals */:
        case 28 /* OperatorType.NotEquals */:
        case 20 /* OperatorType.LessThan */:
        case 21 /* OperatorType.LessThanOrEqual */:
        case 15 /* OperatorType.GreaterThan */:
        case 16 /* OperatorType.GreaterThanOrEqual */:
        case 39 /* OperatorType.Is */:
        case 40 /* OperatorType.IsNot */:
        case 41 /* OperatorType.In */:
        case 42 /* OperatorType.NotIn */:
            return true;
    }
    return false;
}
exports.operatorSupportsChaining = operatorSupportsChaining;
// If the statement is a part of multiple statements on the same line
// and the statement is not the first statement on the line, then it will return
// appropriate start position. otherwise, return undefined.
// ex) a = 1; [|b = 1|]
function _getStartPositionIfMultipleStatementsAreOnSameLine(range, tokenPosition, tokenizerOutput) {
    const tokenIndex = tokenizerOutput.tokens.getItemAtPosition(tokenPosition);
    if (tokenIndex < 0) {
        return undefined;
    }
    // Find the last token index on the previous line or the first token.
    let currentIndex = tokenIndex;
    for (; currentIndex > 0; currentIndex--) {
        const token = tokenizerOutput.tokens.getItemAt(currentIndex);
        const tokenRange = (0, positionUtils_1.convertTextRangeToRange)(token, tokenizerOutput.lines);
        if (tokenRange.end.line !== range.start.line) {
            break;
        }
    }
    // Find the previous token of the first token of the statement.
    for (let index = tokenIndex - 1; index > currentIndex; index--) {
        const token = tokenizerOutput.tokens.getItemAt(index);
        // Eat up indentation
        if (token.type === 3 /* TokenType.Indent */ || token.type === 4 /* TokenType.Dedent */) {
            continue;
        }
        // If previous token is new line, use default.
        if (token.type === 2 /* TokenType.NewLine */) {
            return undefined;
        }
        // Anything else (ex, semicolon), use statement start as it is.
        return range.start;
    }
    return undefined;
}
// If the statement is a part of multiple statements on the same line
// and the statement is not the last statement on the line, then it will return
// appropriate end position. otherwise, return undefined.
// ex) [|a = 1|]; b = 1
function _getEndPositionIfMultipleStatementsAreOnSameLine(range, tokenPosition, tokenizerOutput) {
    const tokenIndex = tokenizerOutput.tokens.getItemAtPosition(tokenPosition);
    if (tokenIndex < 0) {
        return undefined;
    }
    // Find the first token index on the next line or the last token.
    let currentIndex = tokenIndex;
    for (; currentIndex < tokenizerOutput.tokens.count; currentIndex++) {
        const token = tokenizerOutput.tokens.getItemAt(currentIndex);
        const tokenRange = (0, positionUtils_1.convertTextRangeToRange)(token, tokenizerOutput.lines);
        if (range.end.line !== tokenRange.start.line) {
            break;
        }
    }
    // Find the next token of the last token of the statement.
    let foundStatementEnd = false;
    for (let index = tokenIndex; index < currentIndex; index++) {
        const token = tokenizerOutput.tokens.getItemAt(index);
        // Eat up semicolon or new line.
        if (token.type === 11 /* TokenType.Semicolon */ || token.type === 2 /* TokenType.NewLine */) {
            foundStatementEnd = true;
            continue;
        }
        if (!foundStatementEnd) {
            continue;
        }
        const tokenRange = (0, positionUtils_1.convertTextRangeToRange)(token, tokenizerOutput.lines);
        return tokenRange.start;
    }
    return undefined;
}
function getVariableDocStringNode(node) {
    var _a, _b, _c, _d;
    // Walk up the parse tree to find an assignment or type alias statement.
    let curNode = node;
    let annotationNode;
    while (curNode) {
        if (curNode.nodeType === 3 /* ParseNodeType.Assignment */) {
            break;
        }
        if (curNode.nodeType === 77 /* ParseNodeType.TypeAlias */) {
            break;
        }
        if (curNode.nodeType === 54 /* ParseNodeType.TypeAnnotation */ && !annotationNode) {
            annotationNode = curNode;
        }
        curNode = curNode.parent;
    }
    if ((curNode === null || curNode === void 0 ? void 0 : curNode.nodeType) !== 3 /* ParseNodeType.Assignment */ && (curNode === null || curNode === void 0 ? void 0 : curNode.nodeType) !== 77 /* ParseNodeType.TypeAlias */) {
        // Allow a simple annotation statement to have a docstring even
        // though PEP 258 doesn't mention this case. This PEP pre-dated
        // PEP 526, so it didn't contemplate this situation.
        if (annotationNode) {
            curNode = annotationNode;
        }
        else {
            return undefined;
        }
    }
    const parentNode = curNode.parent;
    if ((parentNode === null || parentNode === void 0 ? void 0 : parentNode.nodeType) !== 47 /* ParseNodeType.StatementList */) {
        return undefined;
    }
    const suiteOrModule = parentNode.parent;
    if (!suiteOrModule ||
        (suiteOrModule.nodeType !== 36 /* ParseNodeType.Module */ && suiteOrModule.nodeType !== 50 /* ParseNodeType.Suite */)) {
        return undefined;
    }
    const assignmentIndex = suiteOrModule.statements.findIndex((node) => node === parentNode);
    if (assignmentIndex < 0 || assignmentIndex === suiteOrModule.statements.length - 1) {
        return undefined;
    }
    const nextStatement = suiteOrModule.statements[assignmentIndex + 1];
    if (nextStatement.nodeType !== 47 /* ParseNodeType.StatementList */ || !isDocString(nextStatement)) {
        return undefined;
    }
    // See if the assignment is within one of the contexts specified in PEP 258.
    let isValidContext = false;
    if (((_a = parentNode === null || parentNode === void 0 ? void 0 : parentNode.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 36 /* ParseNodeType.Module */) {
        // If we're at the top level of a module, the attribute docstring is valid.
        isValidContext = true;
    }
    else if (((_b = parentNode === null || parentNode === void 0 ? void 0 : parentNode.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 50 /* ParseNodeType.Suite */ &&
        ((_d = (_c = parentNode === null || parentNode === void 0 ? void 0 : parentNode.parent) === null || _c === void 0 ? void 0 : _c.parent) === null || _d === void 0 ? void 0 : _d.nodeType) === 10 /* ParseNodeType.Class */) {
        // If we're at the top level of a class, the attribute docstring is valid.
        isValidContext = true;
    }
    else {
        const func = getEnclosingFunction(parentNode);
        // If we're within an __init__ method, the attribute docstring is valid.
        if (func && func.name.value === '__init__' && getEnclosingClass(func, /* stopAtFunction */ true)) {
            isValidContext = true;
        }
    }
    if (!isValidContext) {
        return undefined;
    }
    // A docstring can consist of multiple joined strings in a single expression.
    return nextStatement.statements[0];
}
exports.getVariableDocStringNode = getVariableDocStringNode;
// Creates an ID that identifies this parse node in a way that will
// not change each time the file is parsed (unless, of course, the
// file contents change).
function getScopeIdForNode(node) {
    let name = '';
    if (node.nodeType === 10 /* ParseNodeType.Class */) {
        name = node.name.value;
    }
    else if (node.nodeType === 31 /* ParseNodeType.Function */) {
        name = node.name.value;
    }
    const fileInfo = AnalyzerNodeInfo.getFileInfo(node);
    return `${fileInfo.fileUri.key}.${node.start.toString()}-${name}`;
}
exports.getScopeIdForNode = getScopeIdForNode;
// Walks up the parse tree and finds all scopes that can provide
// a context for a TypeVar and returns the scope ID for each.
function getTypeVarScopesForNode(node) {
    const scopeIds = [];
    let curNode = node;
    while (curNode) {
        curNode = getTypeVarScopeNode(curNode);
        if (!curNode) {
            break;
        }
        scopeIds.push(getScopeIdForNode(curNode));
        curNode = curNode.parent;
    }
    return scopeIds;
}
exports.getTypeVarScopesForNode = getTypeVarScopesForNode;
function checkDecorator(node, value) {
    return node.expression.nodeType === 38 /* ParseNodeType.Name */ && node.expression.value === value;
}
exports.checkDecorator = checkDecorator;
function isSimpleDefault(node) {
    switch (node.nodeType) {
        case 40 /* ParseNodeType.Number */:
        case 14 /* ParseNodeType.Constant */:
        case 35 /* ParseNodeType.MemberAccess */:
            return true;
        case 49 /* ParseNodeType.String */:
            return (node.token.flags & 64 /* StringTokenFlags.Format */) === 0;
        case 48 /* ParseNodeType.StringList */:
            return node.strings.every(isSimpleDefault);
        case 55 /* ParseNodeType.UnaryOperation */:
            return isSimpleDefault(node.expression);
        case 7 /* ParseNodeType.BinaryOperation */:
            return isSimpleDefault(node.leftExpression) && isSimpleDefault(node.rightExpression);
        default:
            return false;
    }
}
exports.isSimpleDefault = isSimpleDefault;
//# sourceMappingURL=parseTreeUtils.js.map