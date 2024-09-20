"use strict";
/*
 * staticExpressions.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Functions that operate on expressions (parse node trees)
 * whose values can be evaluated statically.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateStaticBoolLikeExpression = exports.evaluateStaticBoolExpression = void 0;
const configOptions_1 = require("../common/configOptions");
const pythonVersion_1 = require("../common/pythonVersion");
// Returns undefined if the expression cannot be evaluated
// statically as a bool value or true/false if it can.
function evaluateStaticBoolExpression(node, execEnv, definedConstants, typingImportAliases, sysImportAliases) {
    if (node.nodeType === 4 /* ParseNodeType.AssignmentExpression */) {
        return evaluateStaticBoolExpression(node.rightExpression, execEnv, definedConstants, typingImportAliases, sysImportAliases);
    }
    if (node.nodeType === 55 /* ParseNodeType.UnaryOperation */) {
        if (node.operator === 38 /* OperatorType.Not */) {
            const value = evaluateStaticBoolLikeExpression(node.expression, execEnv, definedConstants, typingImportAliases, sysImportAliases);
            if (value !== undefined) {
                return !value;
            }
        }
    }
    else if (node.nodeType === 7 /* ParseNodeType.BinaryOperation */) {
        // Is it an OR or AND expression?
        if (node.operator === 37 /* OperatorType.Or */ || node.operator === 36 /* OperatorType.And */) {
            const leftValue = evaluateStaticBoolExpression(node.leftExpression, execEnv, definedConstants, typingImportAliases, sysImportAliases);
            const rightValue = evaluateStaticBoolExpression(node.rightExpression, execEnv, definedConstants, typingImportAliases, sysImportAliases);
            if (leftValue === undefined || rightValue === undefined) {
                return undefined;
            }
            if (node.operator === 37 /* OperatorType.Or */) {
                return leftValue || rightValue;
            }
            else {
                return leftValue && rightValue;
            }
        }
        if (_isSysVersionInfoExpression(node.leftExpression, sysImportAliases) &&
            node.rightExpression.nodeType === 52 /* ParseNodeType.Tuple */) {
            // Handle the special case of "sys.version_info >= (3, x)"
            const comparisonVersion = _convertTupleToVersion(node.rightExpression);
            return _evaluateVersionBinaryOperation(node.operator, execEnv.pythonVersion, comparisonVersion);
        }
        if (node.leftExpression.nodeType === 27 /* ParseNodeType.Index */ &&
            _isSysVersionInfoExpression(node.leftExpression.baseExpression, sysImportAliases) &&
            node.leftExpression.items.length === 1 &&
            !node.leftExpression.trailingComma &&
            !node.leftExpression.items[0].name &&
            node.leftExpression.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
            node.leftExpression.items[0].valueExpression.nodeType === 40 /* ParseNodeType.Number */ &&
            !node.leftExpression.items[0].valueExpression.isImaginary &&
            node.leftExpression.items[0].valueExpression.value === 0 &&
            node.rightExpression.nodeType === 40 /* ParseNodeType.Number */ &&
            node.rightExpression.isInteger &&
            typeof node.rightExpression.value === 'number') {
            // Handle the special case of "sys.version_info[0] >= X"
            return _evaluateVersionBinaryOperation(node.operator, new pythonVersion_1.PythonVersion(execEnv.pythonVersion.major, 0), new pythonVersion_1.PythonVersion(node.rightExpression.value, 0));
        }
        if (_isSysPlatformInfoExpression(node.leftExpression, sysImportAliases) &&
            node.rightExpression.nodeType === 48 /* ParseNodeType.StringList */) {
            // Handle the special case of "sys.platform != 'X'"
            const comparisonPlatform = node.rightExpression.strings.map((s) => s.value).join('');
            const expectedPlatformName = _getExpectedPlatformNameFromPlatform(execEnv);
            return _evaluateStringBinaryOperation(node.operator, expectedPlatformName, comparisonPlatform);
        }
        if (_isOsNameInfoExpression(node.leftExpression) &&
            node.rightExpression.nodeType === 48 /* ParseNodeType.StringList */) {
            // Handle the special case of "os.name == 'X'"
            const comparisonOsName = node.rightExpression.strings.map((s) => s.value).join('');
            const expectedOsName = _getExpectedOsNameFromPlatform(execEnv);
            if (expectedOsName !== undefined) {
                return _evaluateStringBinaryOperation(node.operator, expectedOsName, comparisonOsName);
            }
        }
        else {
            // Handle the special case of <definedConstant> == 'X' or <definedConstant> != 'X'.
            if (node.rightExpression.nodeType === 48 /* ParseNodeType.StringList */) {
                let constantValue;
                if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */) {
                    constantValue = definedConstants.get(node.leftExpression.value);
                }
                else if (node.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                    constantValue = definedConstants.get(node.leftExpression.memberName.value);
                }
                if (constantValue !== undefined && typeof constantValue === 'string') {
                    const comparisonStringName = node.rightExpression.strings.map((s) => s.value).join('');
                    return _evaluateStringBinaryOperation(node.operator, constantValue, comparisonStringName);
                }
            }
        }
    }
    else if (node.nodeType === 14 /* ParseNodeType.Constant */) {
        if (node.constType === 33 /* KeywordType.True */) {
            return true;
        }
        else if (node.constType === 15 /* KeywordType.False */) {
            return false;
        }
    }
    else if (node.nodeType === 38 /* ParseNodeType.Name */) {
        if (node.value === 'TYPE_CHECKING') {
            return true;
        }
        const constant = definedConstants.get(node.value);
        if (constant !== undefined) {
            return !!constant;
        }
    }
    else if (node.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        if (typingImportAliases &&
            node.memberName.value === 'TYPE_CHECKING' &&
            node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
            typingImportAliases.some((alias) => alias === node.leftExpression.value)) {
            return true;
        }
        const constant = definedConstants.get(node.memberName.value);
        if (constant !== undefined) {
            return !!constant;
        }
    }
    return undefined;
}
exports.evaluateStaticBoolExpression = evaluateStaticBoolExpression;
// Similar to evaluateStaticBoolExpression except that it handles
// other non-bool values that are statically falsy or truthy
// (like "None").
function evaluateStaticBoolLikeExpression(node, execEnv, definedConstants, typingImportAliases, sysImportAliases) {
    if (node.nodeType === 14 /* ParseNodeType.Constant */) {
        if (node.constType === 26 /* KeywordType.None */) {
            return false;
        }
    }
    return evaluateStaticBoolExpression(node, execEnv, definedConstants, typingImportAliases, sysImportAliases);
}
exports.evaluateStaticBoolLikeExpression = evaluateStaticBoolLikeExpression;
function _convertTupleToVersion(node) {
    if (node.expressions.length >= 2) {
        if (node.expressions[0].nodeType === 40 /* ParseNodeType.Number */ &&
            !node.expressions[0].isImaginary &&
            node.expressions[1].nodeType === 40 /* ParseNodeType.Number */ &&
            !node.expressions[1].isImaginary) {
            const majorNode = node.expressions[0];
            const minorNode = node.expressions[1];
            if (typeof majorNode.value !== 'number' || typeof minorNode.value !== 'number') {
                return undefined;
            }
            const major = majorNode.value;
            const minor = minorNode.value;
            let micro;
            if (node.expressions.length >= 3 &&
                node.expressions[2].nodeType === 40 /* ParseNodeType.Number */ &&
                !node.expressions[2].isImaginary &&
                typeof node.expressions[2].value === 'number') {
                micro = node.expressions[2].value;
            }
            let releaseLevel;
            if (node.expressions.length >= 4 &&
                node.expressions[3].nodeType === 48 /* ParseNodeType.StringList */ &&
                node.expressions[3].strings.length === 1 &&
                node.expressions[3].strings[0].nodeType === 49 /* ParseNodeType.String */) {
                releaseLevel = node.expressions[3].strings[0].value;
            }
            let serial;
            if (node.expressions.length >= 5 &&
                node.expressions[4].nodeType === 40 /* ParseNodeType.Number */ &&
                !node.expressions[4].isImaginary &&
                typeof node.expressions[4].value === 'number') {
                serial = node.expressions[4].value;
            }
            return new pythonVersion_1.PythonVersion(major, minor, micro, releaseLevel, serial);
        }
    }
    else if (node.expressions.length === 1) {
        const major = node.expressions[0];
        if (typeof major.value === 'number') {
            return new pythonVersion_1.PythonVersion(major.value, 0);
        }
    }
    return undefined;
}
function _evaluateVersionBinaryOperation(operatorType, leftValue, rightValue) {
    if (leftValue !== undefined && rightValue !== undefined) {
        if (operatorType === 20 /* OperatorType.LessThan */) {
            return leftValue.isLessThan(rightValue);
        }
        if (operatorType === 21 /* OperatorType.LessThanOrEqual */) {
            return leftValue.isLessOrEqualTo(rightValue);
        }
        if (operatorType === 15 /* OperatorType.GreaterThan */) {
            return leftValue.isGreaterThan(rightValue);
        }
        if (operatorType === 16 /* OperatorType.GreaterThanOrEqual */) {
            return leftValue.isGreaterOrEqualTo(rightValue);
        }
        if (operatorType === 12 /* OperatorType.Equals */) {
            return leftValue.isEqualTo(rightValue);
        }
        if (operatorType === 28 /* OperatorType.NotEquals */) {
            return !leftValue.isEqualTo(rightValue);
        }
    }
    return undefined;
}
function _evaluateStringBinaryOperation(operatorType, leftValue, rightValue) {
    if (leftValue !== undefined && rightValue !== undefined) {
        if (operatorType === 12 /* OperatorType.Equals */) {
            return leftValue === rightValue;
        }
        else if (operatorType === 28 /* OperatorType.NotEquals */) {
            return leftValue !== rightValue;
        }
    }
    return undefined;
}
function _isSysVersionInfoExpression(node, sysImportAliases = ['sys']) {
    if (node.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ && node.memberName.value === 'version_info') {
            if (sysImportAliases.some((alias) => alias === node.leftExpression.value)) {
                return true;
            }
        }
    }
    return false;
}
function _isSysPlatformInfoExpression(node, sysImportAliases = ['sys']) {
    if (node.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ && node.memberName.value === 'platform') {
            if (sysImportAliases.some((alias) => alias === node.leftExpression.value)) {
                return true;
            }
        }
    }
    return false;
}
function _isOsNameInfoExpression(node) {
    if (node.nodeType === 35 /* ParseNodeType.MemberAccess */) {
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
            node.leftExpression.value === 'os' &&
            node.memberName.value === 'name') {
            return true;
        }
    }
    return false;
}
function _getExpectedPlatformNameFromPlatform(execEnv) {
    if (execEnv.pythonPlatform === configOptions_1.PythonPlatform.Darwin) {
        return 'darwin';
    }
    else if (execEnv.pythonPlatform === configOptions_1.PythonPlatform.Windows) {
        return 'win32';
    }
    else if (execEnv.pythonPlatform === configOptions_1.PythonPlatform.Linux) {
        return 'linux';
    }
    return undefined;
}
function _getExpectedOsNameFromPlatform(execEnv) {
    if (execEnv.pythonPlatform === configOptions_1.PythonPlatform.Darwin) {
        return 'posix';
    }
    else if (execEnv.pythonPlatform === configOptions_1.PythonPlatform.Windows) {
        return 'nt';
    }
    else if (execEnv.pythonPlatform === configOptions_1.PythonPlatform.Linux) {
        return 'posix';
    }
    return undefined;
}
//# sourceMappingURL=staticExpressions.js.map