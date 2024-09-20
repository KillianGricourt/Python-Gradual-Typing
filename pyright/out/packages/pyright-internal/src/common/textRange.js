"use strict";
/*
 * textRange.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Specifies the range of text within a larger string.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.combineRange = exports.extendRange = exports.isEmptyRange = exports.isEmptyPosition = exports.getEmptyRange = exports.rangesAreEqual = exports.positionsAreEqual = exports.doesRangeContain = exports.doRangesIntersect = exports.doRangesOverlap = exports.getEmptyPosition = exports.comparePositions = exports.Range = exports.Position = exports.TextRange = void 0;
var TextRange;
(function (TextRange) {
    function create(start, length) {
        if (start < 0) {
            throw new Error('start must be non-negative');
        }
        if (length < 0) {
            throw new Error('length must be non-negative');
        }
        return { start, length };
    }
    TextRange.create = create;
    function fromBounds(start, end) {
        if (start < 0) {
            throw new Error('start must be non-negative');
        }
        if (start > end) {
            throw new Error('end must be greater than or equal to start');
        }
        return create(start, end - start);
    }
    TextRange.fromBounds = fromBounds;
    function getEnd(range) {
        return range.start + range.length;
    }
    TextRange.getEnd = getEnd;
    function contains(range, position) {
        return position >= range.start && position < getEnd(range);
    }
    TextRange.contains = contains;
    function containsRange(range, span) {
        return span.start >= range.start && getEnd(span) <= getEnd(range);
    }
    TextRange.containsRange = containsRange;
    function overlaps(range, position) {
        return position >= range.start && position <= getEnd(range);
    }
    TextRange.overlaps = overlaps;
    function overlapsRange(range, other) {
        return overlaps(range, other.start) || overlaps(other, range.start);
    }
    TextRange.overlapsRange = overlapsRange;
    function extend(range, extension) {
        let result = range;
        if (extension) {
            if (Array.isArray(extension)) {
                extension.forEach((r) => {
                    result = extend(result, r);
                });
            }
            else {
                if (extension.start < result.start) {
                    result = {
                        start: extension.start,
                        length: result.length + result.start - extension.start,
                    };
                }
                const extensionEnd = getEnd(extension);
                const resultEnd = getEnd(result);
                if (extensionEnd > resultEnd) {
                    result = {
                        start: result.start,
                        length: result.length + extensionEnd - resultEnd,
                    };
                }
            }
        }
        return result;
    }
    TextRange.extend = extend;
    function combine(ranges) {
        if (ranges.length === 0) {
            return undefined;
        }
        let combinedRange = { start: ranges[0].start, length: ranges[0].length };
        for (let i = 1; i < ranges.length; i++) {
            combinedRange = extend(combinedRange, ranges[i]);
        }
        return combinedRange;
    }
    TextRange.combine = combine;
})(TextRange || (exports.TextRange = TextRange = {}));
var Position;
(function (Position) {
    function is(value) {
        const candidate = value;
        return candidate && candidate.line !== void 0 && candidate.character !== void 0;
    }
    Position.is = is;
    function print(value) {
        return `(${value.line}:${value.character})`;
    }
    Position.print = print;
})(Position || (exports.Position = Position = {}));
var Range;
(function (Range) {
    function is(value) {
        const candidate = value;
        return candidate && candidate.start !== void 0 && candidate.end !== void 0;
    }
    Range.is = is;
    function print(value) {
        return `${Position.print(value.start)}-${Position.print(value.end)}`;
    }
    Range.print = print;
})(Range || (exports.Range = Range = {}));
function comparePositions(a, b) {
    if (a.line < b.line) {
        return -1;
    }
    else if (a.line > b.line) {
        return 1;
    }
    else if (a.character < b.character) {
        return -1;
    }
    else if (a.character > b.character) {
        return 1;
    }
    return 0;
}
exports.comparePositions = comparePositions;
function getEmptyPosition() {
    return {
        line: 0,
        character: 0,
    };
}
exports.getEmptyPosition = getEmptyPosition;
function doRangesOverlap(a, b) {
    if (comparePositions(b.start, a.end) >= 0) {
        return false;
    }
    else if (comparePositions(a.start, b.end) >= 0) {
        return false;
    }
    return true;
}
exports.doRangesOverlap = doRangesOverlap;
function doRangesIntersect(a, b) {
    if (comparePositions(b.start, a.end) > 0) {
        return false;
    }
    else if (comparePositions(a.start, b.end) > 0) {
        return false;
    }
    return true;
}
exports.doRangesIntersect = doRangesIntersect;
function doesRangeContain(range, positionOrRange) {
    if (Position.is(positionOrRange)) {
        return comparePositions(range.start, positionOrRange) <= 0 && comparePositions(range.end, positionOrRange) >= 0;
    }
    return doesRangeContain(range, positionOrRange.start) && doesRangeContain(range, positionOrRange.end);
}
exports.doesRangeContain = doesRangeContain;
function positionsAreEqual(a, b) {
    return comparePositions(a, b) === 0;
}
exports.positionsAreEqual = positionsAreEqual;
function rangesAreEqual(a, b) {
    return positionsAreEqual(a.start, b.start) && positionsAreEqual(a.end, b.end);
}
exports.rangesAreEqual = rangesAreEqual;
function getEmptyRange() {
    return {
        start: getEmptyPosition(),
        end: getEmptyPosition(),
    };
}
exports.getEmptyRange = getEmptyRange;
function isEmptyPosition(pos) {
    return pos.character === 0 && pos.line === 0;
}
exports.isEmptyPosition = isEmptyPosition;
function isEmptyRange(range) {
    return isEmptyPosition(range.start) && isEmptyPosition(range.end);
}
exports.isEmptyRange = isEmptyRange;
function extendRange(range, extension) {
    if (extension) {
        if (Array.isArray(extension)) {
            extension.forEach((r) => {
                extendRange(range, r);
            });
        }
        else {
            if (comparePositions(extension.start, range.start) < 0) {
                range.start = extension.start;
            }
            if (comparePositions(extension.end, range.end) > 0) {
                range.end = extension.end;
            }
        }
    }
}
exports.extendRange = extendRange;
function combineRange(ranges) {
    if (ranges.length === 0) {
        return undefined;
    }
    const combinedRange = ranges[0];
    for (let i = 1; i < ranges.length; i++) {
        extendRange(combinedRange, ranges[i]);
    }
    return combinedRange;
}
exports.combineRange = combineRange;
//# sourceMappingURL=textRange.js.map