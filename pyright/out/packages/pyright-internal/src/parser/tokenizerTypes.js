"use strict";
/*
 * tokenizerTypes.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Based on code from vscode-python repository:
 *  https://github.com/Microsoft/vscode-python
 *
 * Interface, enumeration and class definitions used within
 * the Python tokenizer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IdentifierToken = exports.OperatorToken = exports.NumberToken = exports.FStringEndToken = exports.FStringMiddleToken = exports.FStringStartToken = exports.StringToken = exports.KeywordToken = exports.NewLineToken = exports.DedentToken = exports.IndentToken = exports.Token = exports.Comment = exports.softKeywords = void 0;
exports.softKeywords = [9 /* KeywordType.Debug */, 25 /* KeywordType.Match */, 6 /* KeywordType.Case */, 35 /* KeywordType.Type */];
var Comment;
(function (Comment) {
    function create(start, length, value, type = 0 /* CommentType.Regular */) {
        const comment = {
            type,
            start,
            length,
            value,
        };
        return comment;
    }
    Comment.create = create;
})(Comment || (exports.Comment = Comment = {}));
var Token;
(function (Token) {
    function create(type, start, length, comments) {
        const token = {
            start,
            length,
            type,
            comments,
        };
        return token;
    }
    Token.create = create;
})(Token || (exports.Token = Token = {}));
var IndentToken;
(function (IndentToken) {
    function create(start, length, indentAmount, isIndentAmbiguous, comments) {
        const token = {
            start,
            length,
            type: 3 /* TokenType.Indent */,
            isIndentAmbiguous,
            comments,
            indentAmount,
        };
        return token;
    }
    IndentToken.create = create;
})(IndentToken || (exports.IndentToken = IndentToken = {}));
var DedentToken;
(function (DedentToken) {
    function create(start, length, indentAmount, matchesIndent, isDedentAmbiguous, comments) {
        const token = {
            start,
            length,
            type: 4 /* TokenType.Dedent */,
            comments,
            indentAmount,
            matchesIndent,
            isDedentAmbiguous,
        };
        return token;
    }
    DedentToken.create = create;
})(DedentToken || (exports.DedentToken = DedentToken = {}));
var NewLineToken;
(function (NewLineToken) {
    function create(start, length, newLineType, comments) {
        const token = {
            start,
            length,
            type: 2 /* TokenType.NewLine */,
            comments,
            newLineType,
        };
        return token;
    }
    NewLineToken.create = create;
})(NewLineToken || (exports.NewLineToken = NewLineToken = {}));
var KeywordToken;
(function (KeywordToken) {
    function create(start, length, keywordType, comments) {
        const token = {
            start,
            length,
            type: 8 /* TokenType.Keyword */,
            comments,
            keywordType,
        };
        return token;
    }
    KeywordToken.create = create;
    function isSoftKeyword(token) {
        return exports.softKeywords.some((t) => token.keywordType === t);
    }
    KeywordToken.isSoftKeyword = isSoftKeyword;
})(KeywordToken || (exports.KeywordToken = KeywordToken = {}));
var StringToken;
(function (StringToken) {
    function create(start, length, flags, escapedValue, prefixLength, comments) {
        const token = {
            start,
            length,
            type: 5 /* TokenType.String */,
            flags,
            escapedValue,
            prefixLength,
            quoteMarkLength: flags & 4 /* StringTokenFlags.Triplicate */ ? 3 : 1,
            comments,
        };
        return token;
    }
    StringToken.create = create;
})(StringToken || (exports.StringToken = StringToken = {}));
var FStringStartToken;
(function (FStringStartToken) {
    function create(start, length, flags, prefixLength, comments) {
        const token = {
            start,
            length,
            type: 24 /* TokenType.FStringStart */,
            flags,
            prefixLength,
            quoteMarkLength: flags & 4 /* StringTokenFlags.Triplicate */ ? 3 : 1,
            comments,
        };
        return token;
    }
    FStringStartToken.create = create;
})(FStringStartToken || (exports.FStringStartToken = FStringStartToken = {}));
var FStringMiddleToken;
(function (FStringMiddleToken) {
    function create(start, length, flags, escapedValue) {
        const token = {
            start,
            length,
            type: 25 /* TokenType.FStringMiddle */,
            flags,
            escapedValue,
        };
        return token;
    }
    FStringMiddleToken.create = create;
})(FStringMiddleToken || (exports.FStringMiddleToken = FStringMiddleToken = {}));
var FStringEndToken;
(function (FStringEndToken) {
    function create(start, length, flags) {
        const token = {
            start,
            length,
            type: 26 /* TokenType.FStringEnd */,
            flags,
        };
        return token;
    }
    FStringEndToken.create = create;
})(FStringEndToken || (exports.FStringEndToken = FStringEndToken = {}));
var NumberToken;
(function (NumberToken) {
    function create(start, length, value, isInteger, isImaginary, comments) {
        const token = {
            start,
            length,
            type: 6 /* TokenType.Number */,
            isInteger,
            isImaginary,
            value,
            comments,
        };
        return token;
    }
    NumberToken.create = create;
})(NumberToken || (exports.NumberToken = NumberToken = {}));
var OperatorToken;
(function (OperatorToken) {
    function create(start, length, operatorType, comments) {
        const token = {
            start,
            length,
            type: 9 /* TokenType.Operator */,
            operatorType,
            comments,
        };
        return token;
    }
    OperatorToken.create = create;
})(OperatorToken || (exports.OperatorToken = OperatorToken = {}));
var IdentifierToken;
(function (IdentifierToken) {
    function create(start, length, value, comments) {
        // Perform "NFKC normalization", as per the Python lexical spec.
        const normalizedValue = value.normalize('NFKC');
        const token = {
            start,
            length,
            type: 7 /* TokenType.Identifier */,
            value: normalizedValue,
            comments,
        };
        return token;
    }
    IdentifierToken.create = create;
})(IdentifierToken || (exports.IdentifierToken = IdentifierToken = {}));
//# sourceMappingURL=tokenizerTypes.js.map