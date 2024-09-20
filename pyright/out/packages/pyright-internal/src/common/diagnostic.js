"use strict";
/*
 * diagnostics.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Class that represents errors and warnings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticAddendum = exports.compareDiagnostics = exports.Diagnostic = exports.DiagnosticRelatedInfo = exports.convertLevelToCategory = exports.TaskListPriority = exports.defaultMaxDiagnosticLineCount = exports.defaultMaxDiagnosticDepth = void 0;
const collectionUtils_1 = require("./collectionUtils");
const uri_1 = require("./uri/uri");
exports.defaultMaxDiagnosticDepth = 5;
exports.defaultMaxDiagnosticLineCount = 8;
const maxRecursionCount = 64;
// Corresponds to the CommentTaskPriority enum at https://devdiv.visualstudio.com/DefaultCollection/DevDiv/_git/VS?path=src/env/shell/PackageFramework/Framework/CommentTaskPriority.cs
var TaskListPriority;
(function (TaskListPriority) {
    TaskListPriority["High"] = "High";
    TaskListPriority["Normal"] = "Normal";
    TaskListPriority["Low"] = "Low";
})(TaskListPriority || (exports.TaskListPriority = TaskListPriority = {}));
function convertLevelToCategory(level) {
    switch (level) {
        case 'error':
            return 0 /* DiagnosticCategory.Error */;
        case 'warning':
            return 1 /* DiagnosticCategory.Warning */;
        case 'information':
            return 2 /* DiagnosticCategory.Information */;
        default:
            throw new Error(`${level} is not expected`);
    }
}
exports.convertLevelToCategory = convertLevelToCategory;
var DiagnosticRelatedInfo;
(function (DiagnosticRelatedInfo) {
    function toJsonObj(info) {
        return {
            message: info.message,
            uri: info.uri.toJsonObj(),
            range: info.range,
            priority: info.priority,
        };
    }
    DiagnosticRelatedInfo.toJsonObj = toJsonObj;
    function fromJsonObj(obj) {
        return {
            message: obj.message,
            uri: uri_1.Uri.fromJsonObj(obj.uri),
            range: obj.range,
            priority: obj.priority,
        };
    }
    DiagnosticRelatedInfo.fromJsonObj = fromJsonObj;
})(DiagnosticRelatedInfo || (exports.DiagnosticRelatedInfo = DiagnosticRelatedInfo = {}));
// Represents a single error or warning.
class Diagnostic {
    constructor(category, message, range, priority = TaskListPriority.Normal) {
        this.category = category;
        this.message = message;
        this.range = range;
        this.priority = priority;
        this._relatedInfo = [];
    }
    toJsonObj() {
        return {
            category: this.category,
            message: this.message,
            range: this.range,
            priority: this.priority,
            actions: this._actions,
            rule: this._rule,
            relatedInfo: this._relatedInfo.map((info) => DiagnosticRelatedInfo.toJsonObj(info)),
        };
    }
    static fromJsonObj(obj) {
        const diag = new Diagnostic(obj.category, obj.message, obj.range, obj.priority);
        diag._actions = obj.actions;
        diag._rule = obj.rule;
        diag._relatedInfo = obj.relatedInfo.map((info) => DiagnosticRelatedInfo.fromJsonObj(info));
        return diag;
    }
    addAction(action) {
        if (this._actions === undefined) {
            this._actions = [action];
        }
        else {
            this._actions.push(action);
        }
    }
    getActions() {
        return this._actions;
    }
    setRule(rule) {
        this._rule = rule;
    }
    getRule() {
        return this._rule;
    }
    addRelatedInfo(message, fileUri, range, priority = TaskListPriority.Normal) {
        this._relatedInfo.push({ uri: fileUri, message, range, priority });
    }
    getRelatedInfo() {
        return this._relatedInfo;
    }
}
exports.Diagnostic = Diagnostic;
// Compares two diagnostics by location for sorting.
function compareDiagnostics(d1, d2) {
    if (d1.range.start.line < d2.range.start.line) {
        return -1;
    }
    else if (d1.range.start.line > d2.range.start.line) {
        return 1;
    }
    if (d1.range.start.character < d2.range.start.character) {
        return -1;
    }
    else if (d1.range.start.character > d2.range.start.character) {
        return 1;
    }
    return 0;
}
exports.compareDiagnostics = compareDiagnostics;
// Helps to build additional information that can be appended to a diagnostic
// message. It supports hierarchical information and flexible formatting.
class DiagnosticAddendum {
    constructor() {
        this._messages = [];
        this._childAddenda = [];
    }
    addMessage(message) {
        this._messages.push(message);
    }
    addMessageMultiline(message) {
        message.split('\n').forEach((line) => {
            this._messages.push(line);
        });
    }
    addTextRange(range) {
        this._range = range;
    }
    // Create a new (nested) addendum to which messages can be added.
    createAddendum() {
        var _a;
        const newAddendum = new DiagnosticAddendum();
        newAddendum._nestLevel = ((_a = this._nestLevel) !== null && _a !== void 0 ? _a : 0) + 1;
        this.addAddendum(newAddendum);
        return newAddendum;
    }
    getString(maxDepth = exports.defaultMaxDiagnosticDepth, maxLineCount = exports.defaultMaxDiagnosticLineCount) {
        let lines = this._getLinesRecursive(maxDepth, maxLineCount);
        if (lines.length > maxLineCount) {
            lines = lines.slice(0, maxLineCount);
            lines.push('  ...');
        }
        const text = lines.join('\n');
        if (text.length > 0) {
            return '\n' + text;
        }
        return '';
    }
    isEmpty() {
        return this._getMessageCount() === 0;
    }
    addAddendum(addendum) {
        this._childAddenda.push(addendum);
    }
    getChildren() {
        return this._childAddenda;
    }
    getMessages() {
        return this._messages;
    }
    getNestLevel() {
        var _a;
        return (_a = this._nestLevel) !== null && _a !== void 0 ? _a : 0;
    }
    // Returns undefined if no range is associated with this addendum
    // or its children. Returns a non-empty range if there is a single range
    // associated.
    getEffectiveTextRange() {
        const range = this._getTextRangeRecursive();
        // If we received an empty range, it means that there were multiple
        // non-overlapping ranges associated with this addendum.
        if ((range === null || range === void 0 ? void 0 : range.length) === 0) {
            return undefined;
        }
        return range;
    }
    _getTextRangeRecursive(recursionCount = 0) {
        if (recursionCount > maxRecursionCount) {
            return undefined;
        }
        recursionCount++;
        const childRanges = this._childAddenda
            .map((child) => child._getTextRangeRecursive(recursionCount))
            .filter((r) => !!r);
        if (childRanges.length > 1) {
            return { start: 0, length: 0 };
        }
        if (childRanges.length === 1) {
            return childRanges[0];
        }
        if (this._range) {
            return this._range;
        }
        return undefined;
    }
    _getMessageCount(recursionCount = 0) {
        if (recursionCount > maxRecursionCount) {
            return 0;
        }
        // Get the nested message count.
        let messageCount = this._messages.length;
        for (const diag of this._childAddenda) {
            messageCount += diag._getMessageCount(recursionCount + 1);
        }
        return messageCount;
    }
    _getLinesRecursive(maxDepth, maxLineCount, recursionCount = 0) {
        if (maxDepth <= 0 || recursionCount > maxRecursionCount) {
            return [];
        }
        let childLines = [];
        for (const addendum of this._childAddenda) {
            const maxDepthRemaining = this._messages.length > 0 ? maxDepth - 1 : maxDepth;
            (0, collectionUtils_1.appendArray)(childLines, addendum._getLinesRecursive(maxDepthRemaining, maxLineCount, recursionCount + 1));
            // If the number of lines exceeds our max line count, don't bother adding more.
            if (childLines.length >= maxLineCount) {
                childLines = childLines.slice(0, maxLineCount);
                break;
            }
        }
        // Prepend indentation for readability. Skip if there are no
        // messages at this level.
        const extraSpace = this._messages.length > 0 ? '  ' : '';
        return this._messages.concat(childLines).map((line) => extraSpace + line);
    }
}
exports.DiagnosticAddendum = DiagnosticAddendum;
//# sourceMappingURL=diagnostic.js.map