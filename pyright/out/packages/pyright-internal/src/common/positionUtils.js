"use strict";
/*
 * positionUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility routines for converting between file offsets and
 * line/column positions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLineEndOffset = exports.getLineEndPosition = exports.convertTextRangeToRange = exports.convertRangeToTextRange = exports.convertPositionToOffset = exports.convertOffsetsToRange = exports.convertOffsetToPosition = void 0;
const debug_1 = require("./debug");
const textRange_1 = require("./textRange");
// Translates a file offset into a line/column pair.
function convertOffsetToPosition(offset, lines) {
    // Handle the case where the file is empty.
    if (lines.end === 0) {
        return {
            line: 0,
            character: 0,
        };
    }
    const itemIndex = offset >= lines.end ? lines.count - 1 : lines.getItemContaining(offset);
    (0, debug_1.assert)(itemIndex >= 0 && itemIndex <= lines.count);
    const lineRange = lines.getItemAt(itemIndex);
    (0, debug_1.assert)(lineRange !== undefined);
    return {
        line: itemIndex,
        character: Math.max(0, Math.min(lineRange.length, offset - lineRange.start)),
    };
}
exports.convertOffsetToPosition = convertOffsetToPosition;
// Translates a start/end file offset into a pair of line/column positions.
function convertOffsetsToRange(startOffset, endOffset, lines) {
    const start = convertOffsetToPosition(startOffset, lines);
    const end = convertOffsetToPosition(endOffset, lines);
    return { start, end };
}
exports.convertOffsetsToRange = convertOffsetsToRange;
// Translates a position (line and col) into a file offset.
function convertPositionToOffset(position, lines) {
    if (position.line >= lines.count) {
        return undefined;
    }
    return lines.getItemAt(position.line).start + position.character;
}
exports.convertPositionToOffset = convertPositionToOffset;
function convertRangeToTextRange(range, lines) {
    const start = convertPositionToOffset(range.start, lines);
    if (start === undefined) {
        return undefined;
    }
    const end = convertPositionToOffset(range.end, lines);
    if (end === undefined) {
        return undefined;
    }
    return textRange_1.TextRange.fromBounds(start, end);
}
exports.convertRangeToTextRange = convertRangeToTextRange;
function convertTextRangeToRange(range, lines) {
    return convertOffsetsToRange(range.start, textRange_1.TextRange.getEnd(range), lines);
}
exports.convertTextRangeToRange = convertTextRangeToRange;
// Returns the position of the last character in a line (before the newline).
function getLineEndPosition(tokenizerOutput, text, line) {
    return convertOffsetToPosition(getLineEndOffset(tokenizerOutput, text, line), tokenizerOutput.lines);
}
exports.getLineEndPosition = getLineEndPosition;
function getLineEndOffset(tokenizerOutput, text, line) {
    const lineRange = tokenizerOutput.lines.getItemAt(line);
    const lineEndOffset = textRange_1.TextRange.getEnd(lineRange);
    let newLineLength = 0;
    for (let i = lineEndOffset - 1; i >= lineRange.start; i--) {
        const char = text[i];
        if (char !== '\r' && char !== '\n') {
            break;
        }
        newLineLength++;
    }
    // Character should be at the end of the line but before the newline.
    return lineEndOffset - newLineLength;
}
exports.getLineEndOffset = getLineEndOffset;
//# sourceMappingURL=positionUtils.js.map