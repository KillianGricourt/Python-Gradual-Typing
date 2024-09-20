"use strict";
/*
 * commentUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility functions that parse comments and extract commands
 * or other directives from them.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileLevelDirectives = void 0;
const configOptions_1 = require("../common/configOptions");
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const positionUtils_1 = require("../common/positionUtils");
const localize_1 = require("../localization/localize");
const strictSetting = 'strict';
const standardSetting = 'standard';
const basicSetting = 'basic';
function getFileLevelDirectives(tokens, lines, defaultRuleSet, useStrict, diagnostics) {
    let ruleSet = (0, configOptions_1.cloneDiagnosticRuleSet)(defaultRuleSet);
    if (useStrict) {
        _applyStrictRules(ruleSet);
    }
    for (let i = 0; i < tokens.count; i++) {
        const token = tokens.getItemAt(i);
        if (token.comments) {
            for (const comment of token.comments) {
                const [value, textRange] = _trimTextWithRange(comment.value, {
                    start: comment.start,
                    length: comment.length,
                });
                const isCommentOnOwnLine = () => {
                    const curTokenLineOffset = (0, positionUtils_1.convertOffsetToPosition)(comment.start, lines).character;
                    return curTokenLineOffset <= 1;
                };
                ruleSet = _parsePyrightComment(value, textRange, isCommentOnOwnLine, ruleSet, diagnostics);
            }
        }
    }
    return ruleSet;
}
exports.getFileLevelDirectives = getFileLevelDirectives;
function _applyStrictRules(ruleSet) {
    _overrideRules(ruleSet, (0, configOptions_1.getStrictDiagnosticRuleSet)(), (0, configOptions_1.getStrictModeNotOverriddenRules)());
}
function _applyStandardRules(ruleSet) {
    _overwriteRules(ruleSet, (0, configOptions_1.getStandardDiagnosticRuleSet)());
}
function _applyBasicRules(ruleSet) {
    _overwriteRules(ruleSet, (0, configOptions_1.getBasicDiagnosticRuleSet)());
}
function _overrideRules(ruleSet, overrideRuleSet, skipRuleNames) {
    const boolRuleNames = (0, configOptions_1.getBooleanDiagnosticRules)();
    const diagRuleNames = (0, configOptions_1.getDiagLevelDiagnosticRules)();
    // Enable the strict rules as appropriate.
    for (const ruleName of boolRuleNames) {
        if (skipRuleNames.find((r) => r === ruleName)) {
            continue;
        }
        if (overrideRuleSet[ruleName]) {
            ruleSet[ruleName] = true;
        }
    }
    for (const ruleName of diagRuleNames) {
        if (skipRuleNames.find((r) => r === ruleName)) {
            continue;
        }
        const overrideValue = overrideRuleSet[ruleName];
        const prevValue = ruleSet[ruleName];
        // Override only if the new value is more strict than the existing value.
        if (overrideValue === 'error' ||
            (overrideValue === 'warning' && prevValue !== 'error') ||
            (overrideValue === 'information' && prevValue !== 'error' && prevValue !== 'warning')) {
            ruleSet[ruleName] = overrideValue;
        }
    }
}
function _overwriteRules(ruleSet, overrideRuleSet) {
    const boolRuleNames = (0, configOptions_1.getBooleanDiagnosticRules)();
    const diagRuleNames = (0, configOptions_1.getDiagLevelDiagnosticRules)();
    for (const ruleName of boolRuleNames) {
        ruleSet[ruleName] = overrideRuleSet[ruleName];
    }
    for (const ruleName of diagRuleNames) {
        ruleSet[ruleName] = overrideRuleSet[ruleName];
    }
}
function _parsePyrightComment(commentValue, commentRange, isCommentOnOwnLine, ruleSet, diagnostics) {
    // Is this a pyright comment?
    const commentPrefix = 'pyright:';
    if (commentValue.startsWith(commentPrefix)) {
        const operands = commentValue.substring(commentPrefix.length);
        // Handle (actual ignore) "ignore" directives.
        if (operands.trim().startsWith('ignore')) {
            return ruleSet;
        }
        if (!isCommentOnOwnLine()) {
            const diagAddendum = new diagnostic_1.DiagnosticAddendum();
            diagAddendum.addMessage(localize_1.LocAddendum.pyrightCommentIgnoreTip());
            const diag = {
                message: localize_1.LocMessage.pyrightCommentNotOnOwnLine() + diagAddendum.getString(),
                range: commentRange,
            };
            diagnostics.push(diag);
        }
        const operandList = operands.split(',');
        // If it contains a "strict" operand, replace the existing
        // diagnostic rules with their strict counterparts.
        if (operandList.some((s) => s.trim() === strictSetting)) {
            _applyStrictRules(ruleSet);
        }
        else if (operandList.some((s) => s.trim() === standardSetting)) {
            _applyStandardRules(ruleSet);
        }
        else if (operandList.some((s) => s.trim() === basicSetting)) {
            _applyBasicRules(ruleSet);
        }
        let rangeOffset = 0;
        for (const operand of operandList) {
            const [trimmedOperand, operandRange] = _trimTextWithRange(operand, {
                start: commentRange.start + commentPrefix.length + rangeOffset,
                length: operand.length,
            });
            ruleSet = _parsePyrightOperand(trimmedOperand, operandRange, ruleSet, diagnostics);
            rangeOffset += operand.length + 1;
        }
    }
    return ruleSet;
}
function _parsePyrightOperand(operand, operandRange, ruleSet, diagnostics) {
    const operandSplit = operand.split('=');
    const [trimmedRule, ruleRange] = _trimTextWithRange(operandSplit[0], {
        start: operandRange.start,
        length: operandSplit[0].length,
    });
    // Handle basic directives "basic" and "strict".
    if (operandSplit.length === 1) {
        if (trimmedRule && [strictSetting, basicSetting].some((setting) => trimmedRule === setting)) {
            return ruleSet;
        }
    }
    const diagLevelRules = (0, configOptions_1.getDiagLevelDiagnosticRules)();
    const boolRules = (0, configOptions_1.getBooleanDiagnosticRules)();
    const ruleValue = operandSplit.length > 0 ? operandSplit.slice(1).join('=') : '';
    const [trimmedRuleValue, ruleValueRange] = _trimTextWithRange(ruleValue, {
        start: operandRange.start + operandSplit[0].length + 1,
        length: ruleValue.length,
    });
    if (diagLevelRules.find((r) => r === trimmedRule)) {
        const diagLevelValue = _parseDiagLevel(trimmedRuleValue);
        if (diagLevelValue !== undefined) {
            ruleSet[trimmedRule] = diagLevelValue;
        }
        else {
            const diag = {
                message: localize_1.LocMessage.pyrightCommentInvalidDiagnosticSeverityValue(),
                range: trimmedRuleValue ? ruleValueRange : ruleRange,
            };
            diagnostics.push(diag);
        }
    }
    else if (boolRules.find((r) => r === trimmedRule)) {
        const boolValue = _parseBoolSetting(trimmedRuleValue);
        if (boolValue !== undefined) {
            ruleSet[trimmedRule] = boolValue;
        }
        else {
            const diag = {
                message: localize_1.LocMessage.pyrightCommentInvalidDiagnosticBoolValue(),
                range: trimmedRuleValue ? ruleValueRange : ruleRange,
            };
            diagnostics.push(diag);
        }
    }
    else if (trimmedRule) {
        const diag = {
            message: trimmedRuleValue
                ? localize_1.LocMessage.pyrightCommentUnknownDiagnosticRule().format({ rule: trimmedRule })
                : localize_1.LocMessage.pyrightCommentUnknownDirective().format({ directive: trimmedRule }),
            range: ruleRange,
        };
        diagnostics.push(diag);
    }
    else {
        const diag = {
            message: localize_1.LocMessage.pyrightCommentMissingDirective(),
            range: ruleRange,
        };
        diagnostics.push(diag);
    }
    return ruleSet;
}
function _parseDiagLevel(value) {
    switch (value) {
        case 'false':
        case 'none':
            return 'none';
        case 'true':
        case 'error':
            return 'error';
        case 'warning':
            return 'warning';
        case 'information':
            return 'information';
        default:
            return undefined;
    }
}
function _parseBoolSetting(value) {
    if (value === 'false') {
        return false;
    }
    else if (value === 'true') {
        return true;
    }
    return undefined;
}
// Calls "trim" on the text and adjusts the corresponding range
// if characters are trimmed from the beginning or end.
function _trimTextWithRange(text, range) {
    (0, debug_1.assert)(text.length === range.length);
    const value1 = text.trimStart();
    let updatedRange = range;
    if (value1 !== text) {
        const delta = text.length - value1.length;
        updatedRange = { start: updatedRange.start + delta, length: updatedRange.length - delta };
    }
    const value2 = value1.trimEnd();
    if (value2 !== value1) {
        updatedRange = { start: updatedRange.start, length: updatedRange.length - value1.length + value2.length };
    }
    (0, debug_1.assert)(value2.length === updatedRange.length);
    return [value2, updatedRange];
}
//# sourceMappingURL=commentUtils.js.map