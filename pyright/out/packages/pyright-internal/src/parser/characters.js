"use strict";
/*
 * characters.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Based on code from vscode-python repository:
 *  https://github.com/Microsoft/vscode-python
 *
 * Utility routines used by tokenizer.
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
exports.isBinary = exports.isOctal = exports.isHex = exports.isDecimal = exports.isNumber = exports.isLineBreak = exports.isWhiteSpace = exports.isSurrogateChar = exports.isIdentifierChar = exports.isIdentifierStartChar = void 0;
const unicode = __importStar(require("./unicode"));
var CharCategory;
(function (CharCategory) {
    // Character cannot appear in identifier
    CharCategory[CharCategory["NotIdentifierChar"] = 0] = "NotIdentifierChar";
    // Character can appear at beginning or within identifier
    CharCategory[CharCategory["StartIdentifierChar"] = 1] = "StartIdentifierChar";
    // Character can appear only within identifier, not at beginning
    CharCategory[CharCategory["IdentifierChar"] = 2] = "IdentifierChar";
    // Character is a surrogate, meaning that additional character
    // needs to be consulted.
    CharCategory[CharCategory["SurrogateChar"] = 3] = "SurrogateChar";
})(CharCategory || (CharCategory = {}));
// Table of first 256 character codes (the most common cases).
const _identifierCharFastTableSize = 256;
const _identifierCharFastTable = new Array(_identifierCharFastTableSize);
const _identifierCharMap = {};
// Secondary character map based on the primary (surrogate) character.
const _surrogateCharMap = {};
// We do lazy initialization of this map because it's rarely used.
let _identifierCharMapInitialized = false;
function isIdentifierStartChar(char, nextChar) {
    if (char < _identifierCharFastTableSize) {
        return _identifierCharFastTable[char] === CharCategory.StartIdentifierChar;
    }
    // Lazy initialize the char map. We'll rarely get here.
    if (!_identifierCharMapInitialized) {
        _buildIdentifierLookupTable(false);
        _identifierCharMapInitialized = true;
    }
    let charCategory;
    if (nextChar !== undefined) {
        charCategory = _lookUpSurrogate(char, nextChar);
    }
    else {
        charCategory = _identifierCharMap[char];
    }
    return charCategory === CharCategory.StartIdentifierChar;
}
exports.isIdentifierStartChar = isIdentifierStartChar;
function isIdentifierChar(char, nextChar) {
    if (char < _identifierCharFastTableSize) {
        return (_identifierCharFastTable[char] === CharCategory.StartIdentifierChar ||
            _identifierCharFastTable[char] === CharCategory.IdentifierChar);
    }
    // Lazy initialize the char map. We'll rarely get here.
    if (!_identifierCharMapInitialized) {
        _buildIdentifierLookupTable(false);
        _identifierCharMapInitialized = true;
    }
    if (nextChar !== undefined) {
        return _lookUpSurrogate(char, nextChar);
    }
    return (_identifierCharMap[char] === CharCategory.StartIdentifierChar ||
        _identifierCharMap[char] === CharCategory.IdentifierChar);
}
exports.isIdentifierChar = isIdentifierChar;
function isSurrogateChar(char) {
    if (char < _identifierCharFastTableSize) {
        return false;
    }
    // Lazy initialize the char map. We'll rarely get here.
    if (!_identifierCharMapInitialized) {
        _buildIdentifierLookupTable(false);
        _identifierCharMapInitialized = true;
    }
    return _identifierCharMap[char] === CharCategory.SurrogateChar;
}
exports.isSurrogateChar = isSurrogateChar;
function isWhiteSpace(ch) {
    return ch === 32 /* Char.Space */ || ch === 9 /* Char.Tab */ || ch === 12 /* Char.FormFeed */;
}
exports.isWhiteSpace = isWhiteSpace;
function isLineBreak(ch) {
    return ch === 13 /* Char.CarriageReturn */ || ch === 10 /* Char.LineFeed */;
}
exports.isLineBreak = isLineBreak;
function isNumber(ch) {
    return (ch >= 48 /* Char._0 */ && ch <= 57 /* Char._9 */) || ch === 95 /* Char.Underscore */;
}
exports.isNumber = isNumber;
function isDecimal(ch) {
    return (ch >= 48 /* Char._0 */ && ch <= 57 /* Char._9 */) || ch === 95 /* Char.Underscore */;
}
exports.isDecimal = isDecimal;
function isHex(ch) {
    return isDecimal(ch) || (ch >= 97 /* Char.a */ && ch <= 102 /* Char.f */) || (ch >= 65 /* Char.A */ && ch <= 70 /* Char.F */) || ch === 95 /* Char.Underscore */;
}
exports.isHex = isHex;
function isOctal(ch) {
    return (ch >= 48 /* Char._0 */ && ch <= 55 /* Char._7 */) || ch === 95 /* Char.Underscore */;
}
exports.isOctal = isOctal;
function isBinary(ch) {
    return ch === 48 /* Char._0 */ || ch === 49 /* Char._1 */ || ch === 95 /* Char.Underscore */;
}
exports.isBinary = isBinary;
function _lookUpSurrogate(char, nextChar) {
    if (_identifierCharMap[char] !== CharCategory.SurrogateChar) {
        return CharCategory.NotIdentifierChar;
    }
    const surrogateTable = _surrogateCharMap[char];
    if (!surrogateTable) {
        return CharCategory.NotIdentifierChar;
    }
    return surrogateTable[nextChar];
}
// Underscore is explicitly allowed to start an identifier.
// Characters with the Other_ID_Start property.
const _specialStartIdentifierChars = [
    95 /* Char.Underscore */,
    0x1885,
    0x1886,
    0x2118,
    0x212e,
    0x309b,
    0x309c,
];
const _startIdentifierCharRanges = [
    _specialStartIdentifierChars,
    unicode.unicodeLu,
    unicode.unicodeLl,
    unicode.unicodeLt,
    unicode.unicodeLo,
    unicode.unicodeLm,
    unicode.unicodeNl,
];
const _startCharSurrogateRanges = [
    unicode.unicodeLuSurrogate,
    unicode.unicodeLlSurrogate,
    unicode.unicodeLoSurrogate,
    unicode.unicodeLmSurrogate,
    unicode.unicodeNlSurrogate,
];
// Characters with the Other_ID_Start property.
const _specialIdentifierChars = [
    0x00b7, 0x0387, 0x1369, 0x136a, 0x136b, 0x136c, 0x136d, 0x136e, 0x136f, 0x1370, 0x1371, 0x19da,
];
const _identifierCharRanges = [
    _specialIdentifierChars,
    unicode.unicodeMn,
    unicode.unicodeMc,
    unicode.unicodeNd,
    unicode.unicodePc,
];
const _identifierCharSurrogateRanges = [
    unicode.unicodeMnSurrogate,
    unicode.unicodeMcSurrogate,
    unicode.unicodeNdSurrogate,
];
function _buildIdentifierLookupTableFromUnicodeRangeTable(table, category, fastTableOnly, fastTable, fullTable) {
    for (let entryIndex = 0; entryIndex < table.length; entryIndex++) {
        const entry = table[entryIndex];
        let rangeStart;
        let rangeEnd;
        if (Array.isArray(entry)) {
            rangeStart = entry[0];
            rangeEnd = entry[1];
        }
        else {
            rangeStart = rangeEnd = entry;
        }
        for (let i = rangeStart; i <= rangeEnd; i++) {
            if (i < _identifierCharFastTableSize) {
                fastTable[i] = category;
            }
            else {
                fullTable[i] = category;
            }
        }
        if (fastTableOnly && rangeStart >= _identifierCharFastTableSize) {
            break;
        }
    }
}
function _buildIdentifierLookupTableFromSurrogateRangeTable(surrogateTable, category) {
    for (const surrogateChar in surrogateTable) {
        if (!_surrogateCharMap[surrogateChar]) {
            _surrogateCharMap[surrogateChar] = {};
            _identifierCharMap[surrogateChar] = CharCategory.SurrogateChar;
        }
        _buildIdentifierLookupTableFromUnicodeRangeTable(surrogateTable[surrogateChar], category, 
        /* fastTableOnly */ false, _surrogateCharMap[surrogateChar], _surrogateCharMap[surrogateChar]);
    }
}
// Build a lookup table for to speed up tokenization of identifiers.
function _buildIdentifierLookupTable(fastTableOnly) {
    _identifierCharFastTable.fill(CharCategory.NotIdentifierChar);
    _identifierCharRanges.forEach((table) => {
        _buildIdentifierLookupTableFromUnicodeRangeTable(table, CharCategory.IdentifierChar, fastTableOnly, _identifierCharFastTable, _identifierCharMap);
    });
    _startIdentifierCharRanges.forEach((table) => {
        _buildIdentifierLookupTableFromUnicodeRangeTable(table, CharCategory.StartIdentifierChar, fastTableOnly, _identifierCharFastTable, _identifierCharMap);
    });
    // Populate the surrogate tables for characters that require two
    // character codes.
    if (!fastTableOnly) {
        for (const surrogateTable of _identifierCharSurrogateRanges) {
            _buildIdentifierLookupTableFromSurrogateRangeTable(surrogateTable, CharCategory.IdentifierChar);
        }
        for (const surrogateTable of _startCharSurrogateRanges) {
            _buildIdentifierLookupTableFromSurrogateRangeTable(surrogateTable, CharCategory.StartIdentifierChar);
        }
    }
}
_buildIdentifierLookupTable(true);
//# sourceMappingURL=characters.js.map