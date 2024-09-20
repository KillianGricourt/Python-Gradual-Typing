"use strict";
/*
 * tokenizer.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Based on code from vscode-python repository:
 *  https://github.com/Microsoft/vscode-python
 *
 * Converts a Python program text stream into a stream of tokens.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tokenizer = void 0;
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const sourceFile_1 = require("../analyzer/sourceFile");
const textRangeCollection_1 = require("../common/textRangeCollection");
const characters_1 = require("./characters");
const characterStream_1 = require("./characterStream");
const tokenizerTypes_1 = require("./tokenizerTypes");
// This must be a Map, as operations like {}["constructor"] succeed.
const _keywords = new Map([
    ['and', 0 /* KeywordType.And */],
    ['as', 1 /* KeywordType.As */],
    ['assert', 2 /* KeywordType.Assert */],
    ['async', 3 /* KeywordType.Async */],
    ['await', 4 /* KeywordType.Await */],
    ['break', 5 /* KeywordType.Break */],
    ['case', 6 /* KeywordType.Case */],
    ['class', 7 /* KeywordType.Class */],
    ['continue', 8 /* KeywordType.Continue */],
    ['__debug__', 9 /* KeywordType.Debug */],
    ['def', 10 /* KeywordType.Def */],
    ['del', 11 /* KeywordType.Del */],
    ['elif', 12 /* KeywordType.Elif */],
    ['else', 13 /* KeywordType.Else */],
    ['except', 14 /* KeywordType.Except */],
    ['finally', 16 /* KeywordType.Finally */],
    ['for', 17 /* KeywordType.For */],
    ['from', 18 /* KeywordType.From */],
    ['global', 19 /* KeywordType.Global */],
    ['if', 20 /* KeywordType.If */],
    ['import', 21 /* KeywordType.Import */],
    ['in', 22 /* KeywordType.In */],
    ['is', 23 /* KeywordType.Is */],
    ['lambda', 24 /* KeywordType.Lambda */],
    ['match', 25 /* KeywordType.Match */],
    ['nonlocal', 27 /* KeywordType.Nonlocal */],
    ['not', 28 /* KeywordType.Not */],
    ['or', 29 /* KeywordType.Or */],
    ['pass', 30 /* KeywordType.Pass */],
    ['raise', 31 /* KeywordType.Raise */],
    ['return', 32 /* KeywordType.Return */],
    ['try', 34 /* KeywordType.Try */],
    ['type', 35 /* KeywordType.Type */],
    ['while', 36 /* KeywordType.While */],
    ['with', 37 /* KeywordType.With */],
    ['yield', 38 /* KeywordType.Yield */],
    ['False', 15 /* KeywordType.False */],
    ['None', 26 /* KeywordType.None */],
    ['True', 33 /* KeywordType.True */],
]);
const _softKeywords = new Set(['match', 'case', 'type']);
const _operatorInfo = {
    [0 /* OperatorType.Add */]: 1 /* OperatorFlags.Unary */ | 2 /* OperatorFlags.Binary */,
    [1 /* OperatorType.AddEqual */]: 4 /* OperatorFlags.Assignment */,
    [2 /* OperatorType.Assign */]: 4 /* OperatorFlags.Assignment */,
    [3 /* OperatorType.BitwiseAnd */]: 2 /* OperatorFlags.Binary */,
    [4 /* OperatorType.BitwiseAndEqual */]: 4 /* OperatorFlags.Assignment */,
    [5 /* OperatorType.BitwiseInvert */]: 1 /* OperatorFlags.Unary */,
    [6 /* OperatorType.BitwiseOr */]: 2 /* OperatorFlags.Binary */,
    [7 /* OperatorType.BitwiseOrEqual */]: 4 /* OperatorFlags.Assignment */,
    [8 /* OperatorType.BitwiseXor */]: 2 /* OperatorFlags.Binary */,
    [9 /* OperatorType.BitwiseXorEqual */]: 4 /* OperatorFlags.Assignment */,
    [10 /* OperatorType.Divide */]: 2 /* OperatorFlags.Binary */,
    [11 /* OperatorType.DivideEqual */]: 4 /* OperatorFlags.Assignment */,
    [12 /* OperatorType.Equals */]: 2 /* OperatorFlags.Binary */ | 8 /* OperatorFlags.Comparison */,
    [13 /* OperatorType.FloorDivide */]: 2 /* OperatorFlags.Binary */,
    [14 /* OperatorType.FloorDivideEqual */]: 4 /* OperatorFlags.Assignment */,
    [15 /* OperatorType.GreaterThan */]: 2 /* OperatorFlags.Binary */ | 8 /* OperatorFlags.Comparison */,
    [16 /* OperatorType.GreaterThanOrEqual */]: 2 /* OperatorFlags.Binary */ | 8 /* OperatorFlags.Comparison */,
    [17 /* OperatorType.LeftShift */]: 2 /* OperatorFlags.Binary */,
    [18 /* OperatorType.LeftShiftEqual */]: 4 /* OperatorFlags.Assignment */,
    [19 /* OperatorType.LessOrGreaterThan */]: 2 /* OperatorFlags.Binary */ | 8 /* OperatorFlags.Comparison */ | 16 /* OperatorFlags.Deprecated */,
    [20 /* OperatorType.LessThan */]: 2 /* OperatorFlags.Binary */ | 8 /* OperatorFlags.Comparison */,
    [21 /* OperatorType.LessThanOrEqual */]: 2 /* OperatorFlags.Binary */ | 8 /* OperatorFlags.Comparison */,
    [22 /* OperatorType.MatrixMultiply */]: 2 /* OperatorFlags.Binary */,
    [23 /* OperatorType.MatrixMultiplyEqual */]: 4 /* OperatorFlags.Assignment */,
    [24 /* OperatorType.Mod */]: 2 /* OperatorFlags.Binary */,
    [25 /* OperatorType.ModEqual */]: 4 /* OperatorFlags.Assignment */,
    [26 /* OperatorType.Multiply */]: 2 /* OperatorFlags.Binary */,
    [27 /* OperatorType.MultiplyEqual */]: 4 /* OperatorFlags.Assignment */,
    [28 /* OperatorType.NotEquals */]: 2 /* OperatorFlags.Binary */ | 8 /* OperatorFlags.Comparison */,
    [29 /* OperatorType.Power */]: 2 /* OperatorFlags.Binary */,
    [30 /* OperatorType.PowerEqual */]: 4 /* OperatorFlags.Assignment */,
    [31 /* OperatorType.RightShift */]: 2 /* OperatorFlags.Binary */,
    [32 /* OperatorType.RightShiftEqual */]: 4 /* OperatorFlags.Assignment */,
    [33 /* OperatorType.Subtract */]: 2 /* OperatorFlags.Binary */,
    [34 /* OperatorType.SubtractEqual */]: 4 /* OperatorFlags.Assignment */,
    [36 /* OperatorType.And */]: 2 /* OperatorFlags.Binary */,
    [37 /* OperatorType.Or */]: 2 /* OperatorFlags.Binary */,
    [38 /* OperatorType.Not */]: 1 /* OperatorFlags.Unary */,
    [39 /* OperatorType.Is */]: 2 /* OperatorFlags.Binary */,
    [40 /* OperatorType.IsNot */]: 2 /* OperatorFlags.Binary */,
    [41 /* OperatorType.In */]: 2 /* OperatorFlags.Binary */,
    [42 /* OperatorType.NotIn */]: 2 /* OperatorFlags.Binary */,
};
const _byteOrderMarker = 0xfeff;
const defaultTabSize = 8;
class Tokenizer {
    constructor() {
        this._cs = new characterStream_1.CharacterStream('');
        this._tokens = [];
        this._prevLineStart = 0;
        this._parenDepth = 0;
        this._lineRanges = [];
        this._indentAmounts = [];
        this._typeIgnoreLines = new Map();
        this._pyrightIgnoreLines = new Map();
        this._fStringStack = [];
        // Total times CR, CR/LF, and LF are used to terminate
        // lines. Used to determine the predominant line ending.
        this._crCount = 0;
        this._crLfCount = 0;
        this._lfCount = 0;
        // Number of times an indent token is emitted.
        this._indentCount = 0;
        // Number of times an indent token is emitted and a tab character
        // is present (used to determine predominant tab sequence).
        this._indentTabCount = 0;
        // Number of spaces that are added for an indent token
        // (used to determine predominant tab sequence).
        this._indentSpacesTotal = 0;
        // Number of single or double quote string literals found
        // in the code.
        this._singleQuoteCount = 0;
        this._doubleQuoteCount = 0;
        // ipython mode
        this._ipythonMode = sourceFile_1.IPythonMode.None;
    }
    tokenize(text, start, length, initialParenDepth = 0, ipythonMode = sourceFile_1.IPythonMode.None) {
        if (start === undefined) {
            start = 0;
        }
        else if (start < 0 || start > text.length) {
            throw new Error(`Invalid range start (start=${start}, text.length=${text.length})`);
        }
        if (length === undefined) {
            length = text.length;
        }
        else if (length < 0 || start + length > text.length) {
            throw new Error(`Invalid range length (start=${start}, length=${length}, text.length=${text.length})`);
        }
        else if (start + length < text.length) {
            text = text.slice(0, start + length);
        }
        this._cs = new characterStream_1.CharacterStream(text);
        this._cs.position = start;
        this._tokens = [];
        this._prevLineStart = 0;
        this._parenDepth = initialParenDepth;
        this._lineRanges = [];
        this._indentAmounts = [];
        this._ipythonMode = ipythonMode;
        const end = start + length;
        if (start === 0) {
            this._readIndentationAfterNewLine();
        }
        while (!this._cs.isEndOfStream()) {
            this._addNextToken();
            if (this._cs.position >= end) {
                break;
            }
        }
        // Insert any implied FStringEnd tokens.
        while (this._activeFString) {
            this._tokens.push(tokenizerTypes_1.FStringEndToken.create(this._cs.position, 0, this._activeFString.startToken.flags | 65536 /* StringTokenFlags.Unterminated */));
            this._activeFString = this._fStringStack.pop();
        }
        // Insert an implied new line to make parsing easier.
        if (this._tokens.length === 0 || this._tokens[this._tokens.length - 1].type !== 2 /* TokenType.NewLine */) {
            this._tokens.push(tokenizerTypes_1.NewLineToken.create(this._cs.position, 0, 3 /* NewLineType.Implied */, this._getComments()));
        }
        // Insert any implied dedent tokens.
        this._setIndent(this._cs.position, 0, 0, /* isSpacePresent */ false, /* isTabPresent */ false);
        // Add a final end-of-stream token to make parsing easier.
        this._tokens.push(tokenizerTypes_1.Token.create(1 /* TokenType.EndOfStream */, this._cs.position, 0, this._getComments()));
        // Add the final line range.
        this._addLineRange();
        // If the last line ended in a line-end character, add an empty line.
        if (this._lineRanges.length > 0) {
            const lastLine = this._lineRanges[this._lineRanges.length - 1];
            const lastCharOfLastLine = text.charCodeAt(lastLine.start + lastLine.length - 1);
            if (lastCharOfLastLine === 13 /* Char.CarriageReturn */ || lastCharOfLastLine === 10 /* Char.LineFeed */) {
                this._lineRanges.push({ start: this._cs.position, length: 0 });
            }
        }
        let predominantEndOfLineSequence = '\n';
        if (this._crCount > this._crLfCount && this._crCount > this._lfCount) {
            predominantEndOfLineSequence = '\r';
        }
        else if (this._crLfCount > this._crCount && this._crLfCount > this._lfCount) {
            predominantEndOfLineSequence = '\r\n';
        }
        let predominantTabSequence = '    ';
        let hasPredominantTabSequence = false;
        // If more than half of the indents use tab sequences,
        // assume we're using tabs rather than spaces.
        if (this._indentTabCount > this._indentCount / 2) {
            hasPredominantTabSequence = true;
            predominantTabSequence = '\t';
        }
        else if (this._indentCount > 0) {
            hasPredominantTabSequence = true;
            // Compute the average number of spaces per indent
            // to estimate the predominant tab value.
            let averageSpacePerIndent = Math.round(this._indentSpacesTotal / this._indentCount);
            if (averageSpacePerIndent < 1) {
                averageSpacePerIndent = 1;
            }
            else if (averageSpacePerIndent > defaultTabSize) {
                averageSpacePerIndent = defaultTabSize;
            }
            predominantTabSequence = '';
            for (let i = 0; i < averageSpacePerIndent; i++) {
                predominantTabSequence += ' ';
            }
        }
        return {
            tokens: new textRangeCollection_1.TextRangeCollection(this._tokens),
            lines: new textRangeCollection_1.TextRangeCollection(this._lineRanges),
            typeIgnoreLines: this._typeIgnoreLines,
            typeIgnoreAll: this._typeIgnoreAll,
            pyrightIgnoreLines: this._pyrightIgnoreLines,
            predominantEndOfLineSequence,
            hasPredominantTabSequence,
            predominantTabSequence,
            predominantSingleQuoteCharacter: this._singleQuoteCount >= this._doubleQuoteCount ? "'" : '"',
        };
    }
    static getOperatorInfo(operatorType) {
        return _operatorInfo[operatorType];
    }
    static isPythonKeyword(name, includeSoftKeywords = false) {
        const keyword = _keywords.get(name);
        if (!keyword) {
            return false;
        }
        if (includeSoftKeywords) {
            return true;
        }
        return !_softKeywords.has(name);
    }
    static isOperatorAssignment(operatorType) {
        if (operatorType === undefined || _operatorInfo[operatorType] === undefined) {
            return false;
        }
        return (_operatorInfo[operatorType] & 4 /* OperatorFlags.Assignment */) !== 0;
    }
    static isOperatorComparison(operatorType) {
        if (operatorType === undefined || _operatorInfo[operatorType] === undefined) {
            return false;
        }
        return (_operatorInfo[operatorType] & 8 /* OperatorFlags.Comparison */) !== 0;
    }
    _addNextToken() {
        // Are we in the middle of an f-string but not in a replacement field?
        if (this._activeFString &&
            (!this._activeFString.activeReplacementField ||
                this._activeFString.activeReplacementField.inFormatSpecifier)) {
            this._handleFStringMiddle();
        }
        else {
            this._cs.skipWhitespace();
        }
        if (this._cs.isEndOfStream()) {
            return;
        }
        if (!this._handleCharacter()) {
            this._cs.moveNext();
        }
    }
    // Consumes one or more characters from the character stream and pushes
    // tokens onto the token list. Returns true if the caller should advance
    // to the next character.
    _handleCharacter() {
        var _a, _b;
        // f-strings, b-strings, etc
        const stringPrefixLength = this._getStringPrefixLength();
        if (stringPrefixLength >= 0) {
            let stringPrefix = '';
            if (stringPrefixLength > 0) {
                stringPrefix = this._cs.getText().slice(this._cs.position, this._cs.position + stringPrefixLength);
                // Indeed a string
                this._cs.advance(stringPrefixLength);
            }
            const quoteTypeFlags = this._getQuoteTypeFlags(stringPrefix);
            if (quoteTypeFlags !== 0 /* StringTokenFlags.None */) {
                this._handleString(quoteTypeFlags, stringPrefixLength);
                return true;
            }
        }
        if (this._cs.currentChar === 35 /* Char.Hash */) {
            this._handleComment();
            return true;
        }
        if (this._ipythonMode) {
            const kind = this._getIPythonMagicsKind();
            if (kind === 'line') {
                this._handleIPythonMagics(this._cs.currentChar === 37 /* Char.Percent */ ? 1 /* CommentType.IPythonMagic */ : 2 /* CommentType.IPythonShellEscape */);
                return true;
            }
            if (kind === 'cell') {
                this._handleIPythonMagics(this._cs.currentChar === 37 /* Char.Percent */
                    ? 3 /* CommentType.IPythonCellMagic */
                    : 4 /* CommentType.IPythonCellShellEscape */);
                return true;
            }
        }
        switch (this._cs.currentChar) {
            case _byteOrderMarker: {
                // Skip the BOM if it's at the start of the file.
                if (this._cs.position === 0) {
                    return false;
                }
                return this._handleInvalid();
            }
            case 13 /* Char.CarriageReturn */: {
                const length = this._cs.nextChar === 10 /* Char.LineFeed */ ? 2 : 1;
                const newLineType = length === 2 ? 2 /* NewLineType.CarriageReturnLineFeed */ : 0 /* NewLineType.CarriageReturn */;
                this._handleNewLine(length, newLineType);
                return true;
            }
            case 10 /* Char.LineFeed */: {
                this._handleNewLine(1, 1 /* NewLineType.LineFeed */);
                return true;
            }
            case 92 /* Char.Backslash */: {
                if (this._cs.nextChar === 13 /* Char.CarriageReturn */) {
                    if (this._cs.lookAhead(2) === 10 /* Char.LineFeed */) {
                        this._cs.advance(3);
                    }
                    else {
                        this._cs.advance(2);
                    }
                    this._addLineRange();
                    if (this._tokens.length > 0 && this._tokens[this._tokens.length - 1].type === 2 /* TokenType.NewLine */) {
                        this._readIndentationAfterNewLine();
                    }
                    return true;
                }
                if (this._cs.nextChar === 10 /* Char.LineFeed */) {
                    this._cs.advance(2);
                    this._addLineRange();
                    if (this._tokens.length > 0 && this._tokens[this._tokens.length - 1].type === 2 /* TokenType.NewLine */) {
                        this._readIndentationAfterNewLine();
                    }
                    return true;
                }
                return this._handleInvalid();
            }
            case 40 /* Char.OpenParenthesis */: {
                this._parenDepth++;
                this._tokens.push(tokenizerTypes_1.Token.create(13 /* TokenType.OpenParenthesis */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 41 /* Char.CloseParenthesis */: {
                if (this._parenDepth > 0) {
                    this._parenDepth--;
                }
                this._tokens.push(tokenizerTypes_1.Token.create(14 /* TokenType.CloseParenthesis */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 91 /* Char.OpenBracket */: {
                this._parenDepth++;
                this._tokens.push(tokenizerTypes_1.Token.create(15 /* TokenType.OpenBracket */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 93 /* Char.CloseBracket */: {
                if (this._parenDepth > 0) {
                    this._parenDepth--;
                }
                this._tokens.push(tokenizerTypes_1.Token.create(16 /* TokenType.CloseBracket */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 123 /* Char.OpenBrace */: {
                this._parenDepth++;
                this._tokens.push(tokenizerTypes_1.Token.create(17 /* TokenType.OpenCurlyBrace */, this._cs.position, 1, this._getComments()));
                if (this._activeFString) {
                    // Are we starting a new replacement field?
                    if (!this._activeFString.activeReplacementField ||
                        this._activeFString.activeReplacementField.inFormatSpecifier) {
                        // If there is already an active replacement field, push it
                        // on the stack so we can pop it later.
                        if (this._activeFString.activeReplacementField) {
                            this._activeFString.replacementFieldStack.push(this._activeFString.activeReplacementField);
                        }
                        // Create a new active replacement field context.
                        this._activeFString.activeReplacementField = {
                            inFormatSpecifier: false,
                            parenDepth: this._parenDepth,
                        };
                    }
                }
                break;
            }
            case 125 /* Char.CloseBrace */: {
                if (this._activeFString &&
                    ((_a = this._activeFString.activeReplacementField) === null || _a === void 0 ? void 0 : _a.parenDepth) === this._parenDepth) {
                    this._activeFString.activeReplacementField = this._activeFString.replacementFieldStack.pop();
                }
                if (this._parenDepth > 0) {
                    this._parenDepth--;
                }
                this._tokens.push(tokenizerTypes_1.Token.create(18 /* TokenType.CloseCurlyBrace */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 44 /* Char.Comma */: {
                this._tokens.push(tokenizerTypes_1.Token.create(12 /* TokenType.Comma */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 96 /* Char.Backtick */: {
                this._tokens.push(tokenizerTypes_1.Token.create(22 /* TokenType.Backtick */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 59 /* Char.Semicolon */: {
                this._tokens.push(tokenizerTypes_1.Token.create(11 /* TokenType.Semicolon */, this._cs.position, 1, this._getComments()));
                break;
            }
            case 58 /* Char.Colon */: {
                if (this._cs.nextChar === 61 /* Char.Equal */) {
                    if (!this._activeFString ||
                        !this._activeFString.activeReplacementField ||
                        this._activeFString.activeReplacementField.parenDepth !== this._parenDepth) {
                        this._tokens.push(tokenizerTypes_1.OperatorToken.create(this._cs.position, 2, 35 /* OperatorType.Walrus */, this._getComments()));
                        this._cs.advance(1);
                        break;
                    }
                }
                this._tokens.push(tokenizerTypes_1.Token.create(10 /* TokenType.Colon */, this._cs.position, 1, this._getComments()));
                if (((_b = this._activeFString) === null || _b === void 0 ? void 0 : _b.activeReplacementField) &&
                    this._parenDepth === this._activeFString.activeReplacementField.parenDepth) {
                    this._activeFString.activeReplacementField.inFormatSpecifier = true;
                }
                break;
            }
            default: {
                if (this._isPossibleNumber()) {
                    if (this._tryNumber()) {
                        return true;
                    }
                }
                if (this._cs.currentChar === 46 /* Char.Period */) {
                    if (this._cs.nextChar === 46 /* Char.Period */ && this._cs.lookAhead(2) === 46 /* Char.Period */) {
                        this._tokens.push(tokenizerTypes_1.Token.create(19 /* TokenType.Ellipsis */, this._cs.position, 3, this._getComments()));
                        this._cs.advance(3);
                        return true;
                    }
                    this._tokens.push(tokenizerTypes_1.Token.create(20 /* TokenType.Dot */, this._cs.position, 1, this._getComments()));
                    break;
                }
                if (!this._tryIdentifier()) {
                    if (!this._tryOperator()) {
                        return this._handleInvalid();
                    }
                }
                return true;
            }
        }
        return false;
    }
    _addLineRange() {
        const lineLength = this._cs.position - this._prevLineStart;
        if (lineLength > 0) {
            this._lineRanges.push({ start: this._prevLineStart, length: lineLength });
        }
        this._prevLineStart = this._cs.position;
    }
    _handleNewLine(length, newLineType) {
        if (this._parenDepth === 0 && newLineType !== 3 /* NewLineType.Implied */) {
            // New lines are ignored within parentheses.
            // We'll also avoid adding multiple newlines in a row to simplify parsing.
            if (this._tokens.length === 0 || this._tokens[this._tokens.length - 1].type !== 2 /* TokenType.NewLine */) {
                this._tokens.push(tokenizerTypes_1.NewLineToken.create(this._cs.position, length, newLineType, this._getComments()));
            }
        }
        if (newLineType === 0 /* NewLineType.CarriageReturn */) {
            this._crCount++;
        }
        else if (newLineType === 2 /* NewLineType.CarriageReturnLineFeed */) {
            this._crLfCount++;
        }
        else {
            this._lfCount++;
        }
        this._cs.advance(length);
        this._addLineRange();
        this._readIndentationAfterNewLine();
    }
    _readIndentationAfterNewLine() {
        let tab1Spaces = 0;
        let tab8Spaces = 0;
        let isTabPresent = false;
        let isSpacePresent = false;
        const startOffset = this._cs.position;
        while (!this._cs.isEndOfStream()) {
            switch (this._cs.currentChar) {
                case 32 /* Char.Space */:
                    tab1Spaces++;
                    tab8Spaces++;
                    isSpacePresent = true;
                    this._cs.moveNext();
                    break;
                case 9 /* Char.Tab */:
                    // Translate tabs into spaces assuming both 1-space
                    // and 8-space tab stops.
                    tab1Spaces++;
                    tab8Spaces += defaultTabSize - (tab8Spaces % defaultTabSize);
                    isTabPresent = true;
                    this._cs.moveNext();
                    break;
                case 12 /* Char.FormFeed */:
                    tab1Spaces = 0;
                    tab8Spaces = 0;
                    isTabPresent = false;
                    isSpacePresent = false;
                    this._cs.moveNext();
                    break;
                default:
                    // Non-blank line. Set the current indent level.
                    this._setIndent(startOffset, tab1Spaces, tab8Spaces, isSpacePresent, isTabPresent);
                    return;
                case 35 /* Char.Hash */:
                case 10 /* Char.LineFeed */:
                case 13 /* Char.CarriageReturn */:
                    // Blank line -- no need to adjust indentation.
                    return;
            }
        }
    }
    // The caller must specify two space count values. The first assumes
    // that tabs are translated into one-space tab stops. The second assumes
    // that tabs are translated into eight-space tab stops.
    _setIndent(startOffset, tab1Spaces, tab8Spaces, isSpacePresent, isTabPresent) {
        // Indentations are ignored within a parenthesized clause.
        if (this._parenDepth > 0) {
            return;
        }
        // Insert indent or dedent tokens as necessary.
        if (this._indentAmounts.length === 0) {
            if (tab8Spaces > 0) {
                this._indentCount++;
                if (isTabPresent) {
                    this._indentTabCount++;
                }
                this._indentSpacesTotal += tab8Spaces;
                this._indentAmounts.push({
                    tab1Spaces,
                    tab8Spaces,
                    isSpacePresent,
                    isTabPresent,
                });
                this._tokens.push(tokenizerTypes_1.IndentToken.create(startOffset, tab1Spaces, tab8Spaces, false, this._getComments()));
            }
        }
        else {
            const prevTabInfo = this._indentAmounts[this._indentAmounts.length - 1];
            if (prevTabInfo.tab8Spaces < tab8Spaces) {
                // The Python spec says that if there is ambiguity about how tabs should
                // be translated into spaces because the user has intermixed tabs and
                // spaces, it should be an error. We'll record this condition in the token
                // so the parser can later report it.
                const isIndentAmbiguous = ((prevTabInfo.isSpacePresent && isTabPresent) || (prevTabInfo.isTabPresent && isSpacePresent)) &&
                    prevTabInfo.tab1Spaces >= tab1Spaces;
                this._indentCount++;
                if (isTabPresent) {
                    this._indentTabCount++;
                }
                this._indentSpacesTotal += tab8Spaces - this._indentAmounts[this._indentAmounts.length - 1].tab8Spaces;
                this._indentAmounts.push({
                    tab1Spaces,
                    tab8Spaces,
                    isSpacePresent,
                    isTabPresent,
                });
                this._tokens.push(tokenizerTypes_1.IndentToken.create(startOffset, tab1Spaces, tab8Spaces, isIndentAmbiguous, this._getComments()));
            }
            else if (prevTabInfo.tab8Spaces === tab8Spaces) {
                // The Python spec says that if there is ambiguity about how tabs should
                // be translated into spaces because the user has intermixed tabs and
                // spaces, it should be an error. We'll record this condition in the token
                // so the parser can later report it.
                if ((prevTabInfo.isSpacePresent && isTabPresent) || (prevTabInfo.isTabPresent && isSpacePresent)) {
                    this._tokens.push(tokenizerTypes_1.IndentToken.create(startOffset, tab1Spaces, tab8Spaces, true, this._getComments()));
                }
            }
            else {
                // The Python spec says that if there is ambiguity about how tabs should
                // be translated into spaces because the user has intermixed tabs and
                // spaces, it should be an error. We'll record this condition in the token
                // so the parser can later report it.
                let isDedentAmbiguous = (prevTabInfo.isSpacePresent && isTabPresent) || (prevTabInfo.isTabPresent && isSpacePresent);
                // The Python spec says that dedent amounts need to match the indent
                // amount exactly. An error is generated at runtime if it doesn't.
                // We'll record that error condition within the token, allowing the
                // parser to report it later.
                const dedentPoints = [];
                while (this._indentAmounts.length > 0 &&
                    this._indentAmounts[this._indentAmounts.length - 1].tab8Spaces > tab8Spaces) {
                    dedentPoints.push(this._indentAmounts.length > 1
                        ? this._indentAmounts[this._indentAmounts.length - 2].tab8Spaces
                        : 0);
                    this._indentAmounts.pop();
                }
                dedentPoints.forEach((dedentAmount, index) => {
                    const matchesIndent = index < dedentPoints.length - 1 || dedentAmount === tab8Spaces;
                    const actualDedentAmount = index < dedentPoints.length - 1 ? dedentAmount : tab8Spaces;
                    this._tokens.push(tokenizerTypes_1.DedentToken.create(this._cs.position, 0, actualDedentAmount, matchesIndent, isDedentAmbiguous, this._getComments()));
                    isDedentAmbiguous = false;
                });
            }
        }
    }
    _tryIdentifier() {
        const swallowRemainingChars = () => {
            while (true) {
                if ((0, characters_1.isIdentifierChar)(this._cs.currentChar)) {
                    this._cs.moveNext();
                }
                else if ((0, characters_1.isIdentifierChar)(this._cs.currentChar, this._cs.nextChar)) {
                    this._cs.moveNext();
                    this._cs.moveNext();
                }
                else {
                    break;
                }
            }
        };
        const start = this._cs.position;
        if ((0, characters_1.isIdentifierStartChar)(this._cs.currentChar)) {
            this._cs.moveNext();
            swallowRemainingChars();
        }
        else if ((0, characters_1.isIdentifierStartChar)(this._cs.currentChar, this._cs.nextChar)) {
            this._cs.moveNext();
            this._cs.moveNext();
            swallowRemainingChars();
        }
        if (this._cs.position > start) {
            const value = this._cs.getText().slice(start, this._cs.position);
            if (_keywords.has(value)) {
                this._tokens.push(tokenizerTypes_1.KeywordToken.create(start, this._cs.position - start, _keywords.get(value), this._getComments()));
            }
            else {
                this._tokens.push(tokenizerTypes_1.IdentifierToken.create(start, this._cs.position - start, value, this._getComments()));
            }
            return true;
        }
        return false;
    }
    _isPossibleNumber() {
        if ((0, characters_1.isDecimal)(this._cs.currentChar)) {
            return true;
        }
        if (this._cs.currentChar === 46 /* Char.Period */ && (0, characters_1.isDecimal)(this._cs.nextChar)) {
            return true;
        }
        return false;
    }
    _tryNumber() {
        const start = this._cs.position;
        if (this._cs.currentChar === 48 /* Char._0 */) {
            let radix = 0;
            let leadingChars = 0;
            // Try hex => hexinteger: "0" ("x" | "X") (["_"] hexdigit)+
            if ((this._cs.nextChar === 120 /* Char.x */ || this._cs.nextChar === 88 /* Char.X */) && (0, characters_1.isHex)(this._cs.lookAhead(2))) {
                this._cs.advance(2);
                leadingChars = 2;
                while ((0, characters_1.isHex)(this._cs.currentChar)) {
                    this._cs.moveNext();
                }
                radix = 16;
            }
            // Try binary => bininteger: "0" ("b" | "B") (["_"] bindigit)+
            else if ((this._cs.nextChar === 98 /* Char.b */ || this._cs.nextChar === 66 /* Char.B */) &&
                (0, characters_1.isBinary)(this._cs.lookAhead(2))) {
                this._cs.advance(2);
                leadingChars = 2;
                while ((0, characters_1.isBinary)(this._cs.currentChar)) {
                    this._cs.moveNext();
                }
                radix = 2;
            }
            // Try octal => octinteger: "0" ("o" | "O") (["_"] octdigit)+
            else if ((this._cs.nextChar === 111 /* Char.o */ || this._cs.nextChar === 79 /* Char.O */) && (0, characters_1.isOctal)(this._cs.lookAhead(2))) {
                this._cs.advance(2);
                leadingChars = 2;
                while ((0, characters_1.isOctal)(this._cs.currentChar)) {
                    this._cs.moveNext();
                }
                radix = 8;
            }
            if (radix > 0) {
                const text = this._cs.getText().slice(start, this._cs.position);
                const simpleIntText = text.replace(/_/g, '');
                let intValue = parseInt(simpleIntText.slice(leadingChars), radix);
                if (!isNaN(intValue)) {
                    const bigIntValue = BigInt(simpleIntText);
                    if (!isFinite(intValue) ||
                        intValue < Number.MIN_SAFE_INTEGER ||
                        intValue > Number.MAX_SAFE_INTEGER) {
                        intValue = bigIntValue;
                    }
                    this._tokens.push(tokenizerTypes_1.NumberToken.create(start, text.length, intValue, true, false, this._getComments()));
                    return true;
                }
            }
        }
        let isDecimalInteger = false;
        let mightBeFloatingPoint = false;
        // Try decimal int =>
        //    decinteger: nonzerodigit (["_"] digit)* | "0" (["_"] "0")*
        //    nonzerodigit: "1"..."9"
        //    digit: "0"..."9"
        if (this._cs.currentChar >= 49 /* Char._1 */ && this._cs.currentChar <= 57 /* Char._9 */) {
            while ((0, characters_1.isDecimal)(this._cs.currentChar)) {
                mightBeFloatingPoint = true;
                this._cs.moveNext();
            }
            isDecimalInteger =
                this._cs.currentChar !== 46 /* Char.Period */ &&
                    this._cs.currentChar !== 101 /* Char.e */ &&
                    this._cs.currentChar !== 69 /* Char.E */;
        }
        // "0" (["_"] "0")*
        if (this._cs.currentChar === 48 /* Char._0 */) {
            mightBeFloatingPoint = true;
            while (this._cs.currentChar === 48 /* Char._0 */ || this._cs.currentChar === 95 /* Char.Underscore */) {
                this._cs.moveNext();
            }
            isDecimalInteger =
                this._cs.currentChar !== 46 /* Char.Period */ &&
                    this._cs.currentChar !== 101 /* Char.e */ &&
                    this._cs.currentChar !== 69 /* Char.E */ &&
                    (this._cs.currentChar < 49 /* Char._1 */ || this._cs.currentChar > 57 /* Char._9 */);
        }
        if (isDecimalInteger) {
            let text = this._cs.getText().slice(start, this._cs.position);
            const simpleIntText = text.replace(/_/g, '');
            let intValue = parseInt(simpleIntText, 10);
            if (!isNaN(intValue)) {
                let isImaginary = false;
                const bigIntValue = BigInt(simpleIntText);
                if (!isFinite(intValue) ||
                    bigIntValue < Number.MIN_SAFE_INTEGER ||
                    bigIntValue > Number.MAX_SAFE_INTEGER) {
                    intValue = bigIntValue;
                }
                if (this._cs.currentChar === 106 /* Char.j */ || this._cs.currentChar === 74 /* Char.J */) {
                    isImaginary = true;
                    text += String.fromCharCode(this._cs.currentChar);
                    this._cs.moveNext();
                }
                this._tokens.push(tokenizerTypes_1.NumberToken.create(start, text.length, intValue, true, isImaginary, this._getComments()));
                return true;
            }
        }
        // Floating point. Sign and leading digits were already skipped over.
        this._cs.position = start;
        if (mightBeFloatingPoint ||
            (this._cs.currentChar === 46 /* Char.Period */ && this._cs.nextChar >= 48 /* Char._0 */ && this._cs.nextChar <= 57 /* Char._9 */)) {
            if (this._skipFloatingPointCandidate()) {
                let text = this._cs.getText().slice(start, this._cs.position);
                const value = parseFloat(text);
                if (!isNaN(value)) {
                    let isImaginary = false;
                    if (this._cs.currentChar === 106 /* Char.j */ || this._cs.currentChar === 74 /* Char.J */) {
                        isImaginary = true;
                        text += String.fromCharCode(this._cs.currentChar);
                        this._cs.moveNext();
                    }
                    this._tokens.push(tokenizerTypes_1.NumberToken.create(start, this._cs.position - start, value, false, isImaginary, this._getComments()));
                    return true;
                }
            }
        }
        this._cs.position = start;
        return false;
    }
    _tryOperator() {
        var _a, _b;
        let length = 0;
        const nextChar = this._cs.nextChar;
        let operatorType;
        switch (this._cs.currentChar) {
            case 43 /* Char.Plus */:
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 1 /* OperatorType.AddEqual */ : 0 /* OperatorType.Add */;
                break;
            case 38 /* Char.Ampersand */:
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 4 /* OperatorType.BitwiseAndEqual */ : 3 /* OperatorType.BitwiseAnd */;
                break;
            case 124 /* Char.Bar */:
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 7 /* OperatorType.BitwiseOrEqual */ : 6 /* OperatorType.BitwiseOr */;
                break;
            case 94 /* Char.Caret */:
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 9 /* OperatorType.BitwiseXorEqual */ : 8 /* OperatorType.BitwiseXor */;
                break;
            case 61 /* Char.Equal */:
                if (((_a = this._activeFString) === null || _a === void 0 ? void 0 : _a.activeReplacementField) &&
                    ((_b = this._activeFString) === null || _b === void 0 ? void 0 : _b.activeReplacementField.parenDepth) === this._parenDepth &&
                    !this._activeFString.activeReplacementField.inFormatSpecifier &&
                    nextChar !== 61 /* Char.Equal */) {
                    length = 1;
                    operatorType = 2 /* OperatorType.Assign */;
                    break;
                }
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 12 /* OperatorType.Equals */ : 2 /* OperatorType.Assign */;
                break;
            case 33 /* Char.ExclamationMark */:
                if (nextChar !== 61 /* Char.Equal */) {
                    if (this._activeFString) {
                        // Handle the conversion separator (!) within an f-string.
                        this._tokens.push(tokenizerTypes_1.Token.create(23 /* TokenType.ExclamationMark */, this._cs.position, 1, this._getComments()));
                        this._cs.advance(1);
                        return true;
                    }
                    return false;
                }
                length = 2;
                operatorType = 28 /* OperatorType.NotEquals */;
                break;
            case 37 /* Char.Percent */:
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 25 /* OperatorType.ModEqual */ : 24 /* OperatorType.Mod */;
                break;
            case 126 /* Char.Tilde */:
                length = 1;
                operatorType = 5 /* OperatorType.BitwiseInvert */;
                break;
            case 45 /* Char.Hyphen */:
                if (nextChar === 62 /* Char.Greater */) {
                    this._tokens.push(tokenizerTypes_1.Token.create(21 /* TokenType.Arrow */, this._cs.position, 2, this._getComments()));
                    this._cs.advance(2);
                    return true;
                }
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 34 /* OperatorType.SubtractEqual */ : 33 /* OperatorType.Subtract */;
                break;
            case 42 /* Char.Asterisk */:
                if (nextChar === 42 /* Char.Asterisk */) {
                    length = this._cs.lookAhead(2) === 61 /* Char.Equal */ ? 3 : 2;
                    operatorType = length === 3 ? 30 /* OperatorType.PowerEqual */ : 29 /* OperatorType.Power */;
                }
                else {
                    length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                    operatorType = length === 2 ? 27 /* OperatorType.MultiplyEqual */ : 26 /* OperatorType.Multiply */;
                }
                break;
            case 47 /* Char.Slash */:
                if (nextChar === 47 /* Char.Slash */) {
                    length = this._cs.lookAhead(2) === 61 /* Char.Equal */ ? 3 : 2;
                    operatorType = length === 3 ? 14 /* OperatorType.FloorDivideEqual */ : 13 /* OperatorType.FloorDivide */;
                }
                else {
                    length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                    operatorType = length === 2 ? 11 /* OperatorType.DivideEqual */ : 10 /* OperatorType.Divide */;
                }
                break;
            case 60 /* Char.Less */:
                if (nextChar === 60 /* Char.Less */) {
                    length = this._cs.lookAhead(2) === 61 /* Char.Equal */ ? 3 : 2;
                    operatorType = length === 3 ? 18 /* OperatorType.LeftShiftEqual */ : 17 /* OperatorType.LeftShift */;
                }
                else if (nextChar === 62 /* Char.Greater */) {
                    length = 2;
                    operatorType = 19 /* OperatorType.LessOrGreaterThan */;
                }
                else {
                    length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                    operatorType = length === 2 ? 21 /* OperatorType.LessThanOrEqual */ : 20 /* OperatorType.LessThan */;
                }
                break;
            case 62 /* Char.Greater */:
                if (nextChar === 62 /* Char.Greater */) {
                    length = this._cs.lookAhead(2) === 61 /* Char.Equal */ ? 3 : 2;
                    operatorType = length === 3 ? 32 /* OperatorType.RightShiftEqual */ : 31 /* OperatorType.RightShift */;
                }
                else {
                    length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                    operatorType = length === 2 ? 16 /* OperatorType.GreaterThanOrEqual */ : 15 /* OperatorType.GreaterThan */;
                }
                break;
            case 64 /* Char.At */:
                length = nextChar === 61 /* Char.Equal */ ? 2 : 1;
                operatorType = length === 2 ? 23 /* OperatorType.MatrixMultiplyEqual */ : 22 /* OperatorType.MatrixMultiply */;
                break;
            default:
                return false;
        }
        this._tokens.push(tokenizerTypes_1.OperatorToken.create(this._cs.position, length, operatorType, this._getComments()));
        this._cs.advance(length);
        return length > 0;
    }
    _handleInvalid() {
        const start = this._cs.position;
        while (true) {
            if (this._cs.currentChar === 10 /* Char.LineFeed */ ||
                this._cs.currentChar === 13 /* Char.CarriageReturn */ ||
                this._cs.isAtWhiteSpace() ||
                this._cs.isEndOfStream()) {
                break;
            }
            if ((0, characters_1.isSurrogateChar)(this._cs.currentChar)) {
                this._cs.moveNext();
                this._cs.moveNext();
            }
            else {
                this._cs.moveNext();
            }
        }
        const length = this._cs.position - start;
        if (length > 0) {
            this._tokens.push(tokenizerTypes_1.Token.create(0 /* TokenType.Invalid */, start, length, this._getComments()));
            return true;
        }
        return false;
    }
    _getComments() {
        const prevComments = this._comments;
        this._comments = undefined;
        return prevComments;
    }
    _getIPythonMagicsKind() {
        if (!isMagicChar(this._cs.currentChar)) {
            return undefined;
        }
        const prevToken = this._tokens.length > 0 ? this._tokens[this._tokens.length - 1] : undefined;
        if (prevToken !== undefined && !(0, parseTreeUtils_1.isWhitespace)(prevToken)) {
            return undefined;
        }
        if (this._cs.nextChar === this._cs.currentChar) {
            // Eat up next magic char.
            this._cs.moveNext();
            return 'cell';
        }
        return 'line';
        function isMagicChar(ch) {
            return ch === 37 /* Char.Percent */ || ch === 33 /* Char.ExclamationMark */;
        }
    }
    _handleIPythonMagics(type) {
        const start = this._cs.position + 1;
        let begin = start;
        do {
            this._cs.skipToEol();
            if (type === 1 /* CommentType.IPythonMagic */ || type === 2 /* CommentType.IPythonShellEscape */) {
                const length = this._cs.position - begin;
                const value = this._cs.getText().slice(begin, begin + length);
                // is it multiline magics?
                // %magic command \
                //        next arguments
                if (!value.match(/\\\s*$/)) {
                    break;
                }
            }
            this._cs.moveNext();
            begin = this._cs.position + 1;
        } while (!this._cs.isEndOfStream());
        const length = this._cs.position - start;
        const comment = tokenizerTypes_1.Comment.create(start, length, this._cs.getText().slice(start, start + length), type);
        this._addComments(comment);
    }
    _handleComment() {
        var _a, _b;
        const start = this._cs.position + 1;
        this._cs.skipToEol();
        const length = this._cs.position - start;
        const comment = tokenizerTypes_1.Comment.create(start, length, this._cs.getText().slice(start, start + length));
        const typeIgnoreRegexMatch = comment.value.match(/((^|#)\s*)type:\s*ignore(\s*\[([\s\w-,]*)\]|\s|$)/);
        if (typeIgnoreRegexMatch) {
            const commentStart = start + ((_a = typeIgnoreRegexMatch.index) !== null && _a !== void 0 ? _a : 0);
            const textRange = {
                start: commentStart + typeIgnoreRegexMatch[1].length,
                length: typeIgnoreRegexMatch[0].length - typeIgnoreRegexMatch[1].length,
            };
            const ignoreComment = {
                range: textRange,
                rulesList: this._getIgnoreCommentRulesList(commentStart, typeIgnoreRegexMatch),
            };
            if (this._tokens.findIndex((t) => t.type !== 2 /* TokenType.NewLine */ && t && t.type !== 3 /* TokenType.Indent */) < 0) {
                this._typeIgnoreAll = ignoreComment;
            }
            else {
                this._typeIgnoreLines.set(this._lineRanges.length, ignoreComment);
            }
        }
        const pyrightIgnoreRegexMatch = comment.value.match(/((^|#)\s*)pyright:\s*ignore(\s*\[([\s\w-,]*)\]|\s|$)/);
        if (pyrightIgnoreRegexMatch) {
            const commentStart = start + ((_b = pyrightIgnoreRegexMatch.index) !== null && _b !== void 0 ? _b : 0);
            const textRange = {
                start: commentStart + pyrightIgnoreRegexMatch[1].length,
                length: pyrightIgnoreRegexMatch[0].length - pyrightIgnoreRegexMatch[1].length,
            };
            const ignoreComment = {
                range: textRange,
                rulesList: this._getIgnoreCommentRulesList(commentStart, pyrightIgnoreRegexMatch),
            };
            this._pyrightIgnoreLines.set(this._lineRanges.length, ignoreComment);
        }
        this._addComments(comment);
    }
    // Extracts the individual rules within a "type: ignore [x, y, z]" comment.
    _getIgnoreCommentRulesList(start, match) {
        if (match.length < 5 || match[4] === undefined) {
            return undefined;
        }
        const splitElements = match[4].split(',');
        const commentRules = [];
        let currentOffset = start + match[0].indexOf('[') + 1;
        for (const element of splitElements) {
            const frontTrimmed = element.trimStart();
            currentOffset += element.length - frontTrimmed.length;
            const endTrimmed = frontTrimmed.trimEnd();
            if (endTrimmed.length > 0) {
                commentRules.push({
                    range: { start: currentOffset, length: endTrimmed.length },
                    text: endTrimmed,
                });
            }
            currentOffset += frontTrimmed.length + 1;
        }
        return commentRules;
    }
    _addComments(comment) {
        if (this._comments) {
            this._comments.push(comment);
        }
        else {
            this._comments = [comment];
        }
    }
    _getStringPrefixLength() {
        if (this._cs.currentChar === 39 /* Char.SingleQuote */ || this._cs.currentChar === 34 /* Char.DoubleQuote */) {
            // Simple string, no prefix
            return 0;
        }
        if (this._cs.nextChar === 39 /* Char.SingleQuote */ || this._cs.nextChar === 34 /* Char.DoubleQuote */) {
            switch (this._cs.currentChar) {
                case 102 /* Char.f */:
                case 70 /* Char.F */:
                case 114 /* Char.r */:
                case 82 /* Char.R */:
                case 98 /* Char.b */:
                case 66 /* Char.B */:
                case 117 /* Char.u */:
                case 85 /* Char.U */:
                    // Single-char prefix like u"" or r""
                    return 1;
                default:
                    break;
            }
        }
        if (this._cs.lookAhead(2) === 39 /* Char.SingleQuote */ || this._cs.lookAhead(2) === 34 /* Char.DoubleQuote */) {
            const prefix = this._cs
                .getText()
                .slice(this._cs.position, this._cs.position + 2)
                .toLowerCase();
            switch (prefix) {
                case 'rf':
                case 'fr':
                case 'ur':
                case 'ru':
                case 'br':
                case 'rb':
                    return 2;
                default:
                    break;
            }
        }
        return -1;
    }
    _getQuoteTypeFlags(prefix) {
        let flags = 0 /* StringTokenFlags.None */;
        prefix = prefix.toLowerCase();
        for (let i = 0; i < prefix.length; i++) {
            switch (prefix[i]) {
                case 'u':
                    flags |= 16 /* StringTokenFlags.Unicode */;
                    break;
                case 'b':
                    flags |= 32 /* StringTokenFlags.Bytes */;
                    break;
                case 'r':
                    flags |= 8 /* StringTokenFlags.Raw */;
                    break;
                case 'f':
                    flags |= 64 /* StringTokenFlags.Format */;
                    break;
            }
        }
        if (this._cs.currentChar === 39 /* Char.SingleQuote */) {
            flags |= 1 /* StringTokenFlags.SingleQuote */;
            if (this._cs.nextChar === 39 /* Char.SingleQuote */ && this._cs.lookAhead(2) === 39 /* Char.SingleQuote */) {
                flags |= 4 /* StringTokenFlags.Triplicate */;
            }
        }
        else if (this._cs.currentChar === 34 /* Char.DoubleQuote */) {
            flags |= 2 /* StringTokenFlags.DoubleQuote */;
            if (this._cs.nextChar === 34 /* Char.DoubleQuote */ && this._cs.lookAhead(2) === 34 /* Char.DoubleQuote */) {
                flags |= 4 /* StringTokenFlags.Triplicate */;
            }
        }
        return flags;
    }
    _handleString(flags, stringPrefixLength) {
        var _a;
        const start = this._cs.position - stringPrefixLength;
        if (flags & 64 /* StringTokenFlags.Format */) {
            if (flags & 4 /* StringTokenFlags.Triplicate */) {
                this._cs.advance(3);
            }
            else {
                this._cs.moveNext();
            }
            const end = this._cs.position;
            const fStringStartToken = tokenizerTypes_1.FStringStartToken.create(start, end - start, flags, stringPrefixLength, this._getComments());
            // Create a new f-string context and push it on the stack.
            const fStringContext = {
                startToken: fStringStartToken,
                replacementFieldStack: [],
            };
            if (this._activeFString) {
                this._fStringStack.push(this._activeFString);
            }
            this._activeFString = fStringContext;
            this._tokens.push(fStringStartToken);
        }
        else {
            if (flags & 4 /* StringTokenFlags.Triplicate */) {
                this._cs.advance(3);
            }
            else {
                this._cs.moveNext();
                if (flags & 1 /* StringTokenFlags.SingleQuote */) {
                    this._singleQuoteCount++;
                }
                else {
                    this._doubleQuoteCount++;
                }
            }
            const stringLiteralInfo = this._skipToEndOfStringLiteral(flags);
            const end = this._cs.position;
            // If this is an unterminated string, see if it matches the string type
            // of an active f-string. If so, we'll treat it as an f-string end
            // token rather than an unterminated regular string. This helps with
            // parse error recovery if a closing bracket is missing in an f-string.
            if ((stringLiteralInfo.flags & 65536 /* StringTokenFlags.Unterminated */) !== 0 &&
                ((_a = this._activeFString) === null || _a === void 0 ? void 0 : _a.activeReplacementField)) {
                if ((flags &
                    (32 /* StringTokenFlags.Bytes */ |
                        16 /* StringTokenFlags.Unicode */ |
                        8 /* StringTokenFlags.Raw */ |
                        64 /* StringTokenFlags.Format */)) ===
                    0) {
                    const quoteTypeMask = 4 /* StringTokenFlags.Triplicate */ | 2 /* StringTokenFlags.DoubleQuote */ | 1 /* StringTokenFlags.SingleQuote */;
                    if ((this._activeFString.startToken.flags & quoteTypeMask) === (flags & quoteTypeMask)) {
                        // Unwind to the start of this string token and terminate any replacement fields
                        // that are active. This will cause the tokenizer to re-process the quote as an
                        // FStringEnd token.
                        this._cs.position = start;
                        while (this._activeFString.replacementFieldStack.length > 0) {
                            this._activeFString.activeReplacementField =
                                this._activeFString.replacementFieldStack.pop();
                        }
                        this._parenDepth = this._activeFString.activeReplacementField.parenDepth - 1;
                        this._activeFString.activeReplacementField = undefined;
                        return;
                    }
                }
            }
            this._tokens.push(tokenizerTypes_1.StringToken.create(start, end - start, stringLiteralInfo.flags, stringLiteralInfo.escapedValue, stringPrefixLength, this._getComments()));
        }
    }
    // Scans for either the FString end token or a replacement field.
    _handleFStringMiddle() {
        var _a;
        const activeFString = this._activeFString;
        const inFormatSpecifier = !!((_a = this._activeFString.activeReplacementField) === null || _a === void 0 ? void 0 : _a.inFormatSpecifier);
        const start = this._cs.position;
        const flags = activeFString.startToken.flags;
        const stringLiteralInfo = this._skipToEndOfStringLiteral(flags, inFormatSpecifier);
        const end = this._cs.position;
        const isUnterminated = (stringLiteralInfo.flags & 65536 /* StringTokenFlags.Unterminated */) !== 0;
        const sawReplacementFieldStart = (stringLiteralInfo.flags & 128 /* StringTokenFlags.ReplacementFieldStart */) !== 0;
        const sawReplacementFieldEnd = (stringLiteralInfo.flags & 256 /* StringTokenFlags.ReplacementFieldEnd */) !== 0;
        const sawEndQuote = !isUnterminated && !sawReplacementFieldStart && !sawReplacementFieldEnd;
        let middleTokenLength = end - start;
        if (sawEndQuote) {
            middleTokenLength -= activeFString.startToken.quoteMarkLength;
        }
        if (middleTokenLength > 0 || isUnterminated) {
            this._tokens.push(tokenizerTypes_1.FStringMiddleToken.create(start, middleTokenLength, stringLiteralInfo.flags, stringLiteralInfo.escapedValue));
        }
        if (sawEndQuote) {
            this._tokens.push(tokenizerTypes_1.FStringEndToken.create(start + middleTokenLength, activeFString.startToken.quoteMarkLength, stringLiteralInfo.flags));
            this._activeFString = this._fStringStack.pop();
        }
        else if (isUnterminated) {
            this._activeFString = this._fStringStack.pop();
        }
    }
    _skipToEndOfStringLiteral(flags, inFormatSpecifier = false) {
        const quoteChar = flags & 1 /* StringTokenFlags.SingleQuote */ ? 39 /* Char.SingleQuote */ : 34 /* Char.DoubleQuote */;
        const isTriplicate = (flags & 4 /* StringTokenFlags.Triplicate */) !== 0;
        const isFString = (flags & 64 /* StringTokenFlags.Format */) !== 0;
        let isInNamedUnicodeEscape = false;
        const start = this._cs.position;
        let escapedValueLength = 0;
        const getEscapedValue = () => this._cs.getText().slice(start, start + escapedValueLength);
        while (true) {
            if (this._cs.isEndOfStream()) {
                // Hit the end of file without a termination.
                flags |= 65536 /* StringTokenFlags.Unterminated */;
                return {
                    escapedValue: getEscapedValue(),
                    flags,
                };
            }
            if (this._cs.currentChar === 92 /* Char.Backslash */) {
                escapedValueLength++;
                // Move past the escape (backslash) character.
                this._cs.moveNext();
                // Handle the special escape sequence /N{name} for unicode characters.
                if (!isInNamedUnicodeEscape &&
                    this._cs.getCurrentChar() === 78 /* Char.N */ &&
                    this._cs.nextChar === 123 /* Char.OpenBrace */) {
                    flags |= 512 /* StringTokenFlags.NamedUnicodeEscape */;
                    isInNamedUnicodeEscape = true;
                }
                else {
                    // If this is an f-string, the only escapes that are allowed is for
                    // a single or double quote symbol or a newline/carriage return.
                    const isEscapedQuote = this._cs.getCurrentChar() === 39 /* Char.SingleQuote */ ||
                        this._cs.getCurrentChar() === 34 /* Char.DoubleQuote */;
                    const isEscapedNewLine = this._cs.getCurrentChar() === 13 /* Char.CarriageReturn */ ||
                        this._cs.getCurrentChar() === 10 /* Char.LineFeed */;
                    const isEscapedBackslash = this._cs.getCurrentChar() === 92 /* Char.Backslash */;
                    if (!isFString || isEscapedBackslash || isEscapedQuote || isEscapedNewLine) {
                        if (isEscapedNewLine) {
                            if (this._cs.getCurrentChar() === 13 /* Char.CarriageReturn */ &&
                                this._cs.nextChar === 10 /* Char.LineFeed */) {
                                escapedValueLength++;
                                this._cs.moveNext();
                            }
                            escapedValueLength++;
                            this._cs.moveNext();
                            this._addLineRange();
                        }
                        else {
                            escapedValueLength++;
                            this._cs.moveNext();
                        }
                    }
                }
            }
            else if (this._cs.currentChar === 10 /* Char.LineFeed */ || this._cs.currentChar === 13 /* Char.CarriageReturn */) {
                if (!isTriplicate && !isFString) {
                    // Unterminated single-line string
                    flags |= 65536 /* StringTokenFlags.Unterminated */;
                    return {
                        escapedValue: getEscapedValue(),
                        flags,
                    };
                }
                // Skip over the new line (either one or two characters).
                if (this._cs.currentChar === 13 /* Char.CarriageReturn */ && this._cs.nextChar === 10 /* Char.LineFeed */) {
                    escapedValueLength++;
                    this._cs.moveNext();
                }
                escapedValueLength++;
                this._cs.moveNext();
                this._addLineRange();
            }
            else if (!isTriplicate && this._cs.currentChar === quoteChar) {
                this._cs.moveNext();
                break;
            }
            else if (isTriplicate &&
                this._cs.currentChar === quoteChar &&
                this._cs.nextChar === quoteChar &&
                this._cs.lookAhead(2) === quoteChar) {
                this._cs.advance(3);
                break;
            }
            else if (!isInNamedUnicodeEscape && isFString && this._cs.currentChar === 123 /* Char.OpenBrace */) {
                if (inFormatSpecifier || this._cs.nextChar !== 123 /* Char.OpenBrace */) {
                    flags |= 128 /* StringTokenFlags.ReplacementFieldStart */;
                    break;
                }
                else {
                    escapedValueLength++;
                    this._cs.moveNext();
                    escapedValueLength++;
                    this._cs.moveNext();
                }
            }
            else if (isInNamedUnicodeEscape && this._cs.currentChar === 125 /* Char.CloseBrace */) {
                isInNamedUnicodeEscape = false;
                escapedValueLength++;
                this._cs.moveNext();
            }
            else if (isFString && this._cs.currentChar === 125 /* Char.CloseBrace */) {
                if (inFormatSpecifier || this._cs.nextChar !== 125 /* Char.CloseBrace */) {
                    flags |= 256 /* StringTokenFlags.ReplacementFieldEnd */;
                    break;
                }
                else {
                    escapedValueLength++;
                    this._cs.moveNext();
                    escapedValueLength++;
                    this._cs.moveNext();
                }
            }
            else {
                escapedValueLength++;
                this._cs.moveNext();
            }
        }
        return {
            escapedValue: getEscapedValue(),
            flags,
        };
    }
    _skipFloatingPointCandidate() {
        // Determine end of the potential floating point number
        const start = this._cs.position;
        this._skipFractionalNumber();
        if (this._cs.position > start) {
            // Optional exponent sign
            if (this._cs.currentChar === 101 /* Char.e */ || this._cs.currentChar === 69 /* Char.E */) {
                this._cs.moveNext();
                // Skip exponent value
                this._skipDecimalNumber(/* allowSign */ true);
            }
        }
        return this._cs.position > start;
    }
    _skipFractionalNumber() {
        this._skipDecimalNumber(false);
        if (this._cs.currentChar === 46 /* Char.Period */) {
            // Optional period
            this._cs.moveNext();
        }
        this._skipDecimalNumber(false);
    }
    _skipDecimalNumber(allowSign) {
        if (allowSign && (this._cs.currentChar === 45 /* Char.Hyphen */ || this._cs.currentChar === 43 /* Char.Plus */)) {
            // Optional sign
            this._cs.moveNext();
        }
        while ((0, characters_1.isDecimal)(this._cs.currentChar)) {
            // Skip integer part
            this._cs.moveNext();
        }
    }
}
exports.Tokenizer = Tokenizer;
//# sourceMappingURL=tokenizer.js.map