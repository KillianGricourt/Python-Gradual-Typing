"use strict";
/*
 * stringTokenUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Methods that handle unescaping of escaped string token
 * literal values.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUnescapedString = void 0;
function completeUnescapedString(incomplete, originalString) {
    const newValue = incomplete.valueParts.join('');
    // Use the original string if it's identical. This prevents us from allocating memory to hold
    // a copy (a copy is made because the original string is a 'slice' of another, so it doesn't exist in the cache yet).
    const value = originalString !== newValue ? newValue : originalString;
    return {
        ...incomplete,
        value,
    };
}
function getUnescapedString(stringToken) {
    const escapedString = stringToken.escapedValue;
    const isRaw = (stringToken.flags & 8 /* StringTokenFlags.Raw */) !== 0;
    if (isRaw) {
        return {
            value: escapedString,
            unescapeErrors: [],
            nonAsciiInBytes: false,
        };
    }
    const charCodes = [];
    for (let index = 0; index < escapedString.length; index++) {
        charCodes.push(escapedString.charCodeAt(index));
    }
    const isBytes = (stringToken.flags & 32 /* StringTokenFlags.Bytes */) !== 0;
    // Handle the common case in an expedited manner.
    if (!charCodes.some((curChar) => curChar === 13 /* Char.CarriageReturn */ || curChar === 10 /* Char.LineFeed */ || curChar === 92 /* Char.Backslash */)) {
        return {
            value: escapedString,
            unescapeErrors: [],
            nonAsciiInBytes: isBytes && charCodes.some((curChar) => curChar >= 128),
        };
    }
    let strOffset = 0;
    const output = {
        valueParts: [],
        unescapeErrors: [],
        nonAsciiInBytes: false,
    };
    const addInvalidEscapeOffset = () => {
        // Invalid escapes are not reported for raw strings.
        if (!isRaw) {
            output.unescapeErrors.push({
                offset: strOffset - 1,
                length: 2,
                errorType: 0 /* UnescapeErrorType.InvalidEscapeSequence */,
            });
        }
    };
    const getEscapedCharacter = (offset = 0) => {
        if (strOffset + offset >= charCodes.length) {
            return 3 /* Char.EndOfText */;
        }
        return charCodes[strOffset + offset];
    };
    const scanHexEscape = (digitCount) => {
        let foundIllegalHexDigit = false;
        let hexValue = 0;
        let localValue = '';
        for (let i = 0; i < digitCount; i++) {
            const charCode = getEscapedCharacter(1 + i);
            if (!_isHexCharCode(charCode)) {
                foundIllegalHexDigit = true;
                break;
            }
            hexValue = 16 * hexValue + _getHexDigitValue(charCode);
        }
        if (foundIllegalHexDigit) {
            addInvalidEscapeOffset();
            localValue = '\\' + String.fromCharCode(getEscapedCharacter());
            strOffset++;
        }
        else {
            localValue = String.fromCharCode(hexValue);
            strOffset += 1 + digitCount;
        }
        return localValue;
    };
    const appendOutputChar = (charCode) => {
        const char = String.fromCharCode(charCode);
        output.valueParts.push(char);
    };
    while (true) {
        let curChar = getEscapedCharacter();
        if (curChar === 3 /* Char.EndOfText */) {
            return completeUnescapedString(output, escapedString);
        }
        if (curChar === 92 /* Char.Backslash */) {
            // Move past the escape (backslash) character.
            strOffset++;
            if (isRaw) {
                appendOutputChar(curChar);
                continue;
            }
            curChar = getEscapedCharacter();
            let localValue = '';
            if (curChar === 13 /* Char.CarriageReturn */ || curChar === 10 /* Char.LineFeed */) {
                if (curChar === 13 /* Char.CarriageReturn */ && getEscapedCharacter(1) === 10 /* Char.LineFeed */) {
                    if (isRaw) {
                        localValue += String.fromCharCode(curChar);
                    }
                    strOffset++;
                    curChar = getEscapedCharacter();
                }
                if (isRaw) {
                    localValue = '\\' + localValue + String.fromCharCode(curChar);
                }
                strOffset++;
            }
            else {
                if (isRaw) {
                    localValue = '\\' + String.fromCharCode(curChar);
                    strOffset++;
                }
                else {
                    switch (curChar) {
                        case 92 /* Char.Backslash */:
                        case 39 /* Char.SingleQuote */:
                        case 34 /* Char.DoubleQuote */:
                            localValue = String.fromCharCode(curChar);
                            strOffset++;
                            break;
                        case 97 /* Char.a */:
                            localValue = '\u0007';
                            strOffset++;
                            break;
                        case 98 /* Char.b */:
                            localValue = '\b';
                            strOffset++;
                            break;
                        case 102 /* Char.f */:
                            localValue = '\f';
                            strOffset++;
                            break;
                        case 110 /* Char.n */:
                            localValue = '\n';
                            strOffset++;
                            break;
                        case 114 /* Char.r */:
                            localValue = '\r';
                            strOffset++;
                            break;
                        case 116 /* Char.t */:
                            localValue = '\t';
                            strOffset++;
                            break;
                        case 118 /* Char.v */:
                            localValue = '\v';
                            strOffset++;
                            break;
                        case 120 /* Char.x */:
                            localValue = scanHexEscape(2);
                            break;
                        case 78 /* Char.N */: {
                            let foundIllegalChar = false;
                            let charCount = 1;
                            if (getEscapedCharacter(charCount) !== 123 /* Char.OpenBrace */) {
                                foundIllegalChar = true;
                            }
                            else {
                                charCount++;
                                while (true) {
                                    const lookaheadChar = getEscapedCharacter(charCount);
                                    if (lookaheadChar === 125 /* Char.CloseBrace */) {
                                        break;
                                    }
                                    else if (!_isAlphaNumericChar(lookaheadChar) &&
                                        lookaheadChar !== 45 /* Char.Hyphen */ &&
                                        !_isWhitespaceChar(lookaheadChar)) {
                                        foundIllegalChar = true;
                                        break;
                                    }
                                    else {
                                        charCount++;
                                    }
                                }
                            }
                            if (foundIllegalChar) {
                                addInvalidEscapeOffset();
                                localValue = '\\' + String.fromCharCode(curChar);
                                strOffset++;
                            }
                            else {
                                // We don't have the Unicode name database handy, so
                                // assume that the name is valid and use a '-' as a
                                // replacement character.
                                localValue = '-';
                                strOffset += 1 + charCount;
                            }
                            break;
                        }
                        case 117 /* Char.u */:
                            localValue = scanHexEscape(4);
                            break;
                        case 85 /* Char.U */:
                            localValue = scanHexEscape(8);
                            break;
                        default:
                            if (_isOctalCharCode(curChar)) {
                                let octalCode = curChar - 48 /* Char._0 */;
                                strOffset++;
                                curChar = getEscapedCharacter();
                                if (_isOctalCharCode(curChar)) {
                                    octalCode = octalCode * 8 + curChar - 48 /* Char._0 */;
                                    strOffset++;
                                    curChar = getEscapedCharacter();
                                    if (_isOctalCharCode(curChar)) {
                                        octalCode = octalCode * 8 + curChar - 48 /* Char._0 */;
                                        strOffset++;
                                    }
                                }
                                localValue = String.fromCharCode(octalCode);
                            }
                            else {
                                localValue = '\\';
                                addInvalidEscapeOffset();
                            }
                            break;
                    }
                }
            }
            output.valueParts.push(localValue);
        }
        else if (curChar === 10 /* Char.LineFeed */ || curChar === 13 /* Char.CarriageReturn */) {
            // Skip over the escaped new line (either one or two characters).
            if (curChar === 13 /* Char.CarriageReturn */ && getEscapedCharacter(1) === 10 /* Char.LineFeed */) {
                appendOutputChar(curChar);
                strOffset++;
                curChar = getEscapedCharacter();
            }
            appendOutputChar(curChar);
            strOffset++;
        }
        else {
            // There's nothing to unescape, so output the escaped character directly.
            if (isBytes && curChar >= 128) {
                output.nonAsciiInBytes = true;
            }
            appendOutputChar(curChar);
            strOffset++;
        }
    }
}
exports.getUnescapedString = getUnescapedString;
function _isWhitespaceChar(charCode) {
    return charCode === 32 /* Char.Space */ || charCode === 9 /* Char.Tab */;
}
function _isAlphaNumericChar(charCode) {
    if (charCode >= 48 /* Char._0 */ && charCode <= 57 /* Char._9 */) {
        return true;
    }
    if (charCode >= 97 /* Char.a */ && charCode <= 122 /* Char.z */) {
        return true;
    }
    if (charCode >= 65 /* Char.A */ && charCode <= 90 /* Char.Z */) {
        return true;
    }
    return false;
}
function _isOctalCharCode(charCode) {
    return charCode >= 48 /* Char._0 */ && charCode <= 55 /* Char._7 */;
}
function _isHexCharCode(charCode) {
    if (charCode >= 48 /* Char._0 */ && charCode <= 57 /* Char._9 */) {
        return true;
    }
    if (charCode >= 97 /* Char.a */ && charCode <= 102 /* Char.f */) {
        return true;
    }
    if (charCode >= 65 /* Char.A */ && charCode <= 70 /* Char.F */) {
        return true;
    }
    return false;
}
function _getHexDigitValue(charCode) {
    if (charCode >= 48 /* Char._0 */ && charCode <= 57 /* Char._9 */) {
        return charCode - 48 /* Char._0 */;
    }
    if (charCode >= 97 /* Char.a */ && charCode <= 102 /* Char.f */) {
        return charCode - 97 /* Char.a */ + 10;
    }
    if (charCode >= 65 /* Char.A */ && charCode <= 70 /* Char.F */) {
        return charCode - 65 /* Char.A */ + 10;
    }
    return 0;
}
//# sourceMappingURL=stringTokenUtils.js.map