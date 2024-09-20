"use strict";
/*
 * characterStream.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Based on code from vscode-python repository:
 *  https://github.com/Microsoft/vscode-python
 *
 * Class that represents a stream of characters.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CharacterStream = void 0;
const characters_1 = require("./characters");
class CharacterStream {
    constructor(text) {
        this._text = text;
        this._position = 0;
        this._currentChar = text.length > 0 ? text.charCodeAt(0) : 0;
        this._isEndOfStream = text.length === 0;
    }
    get position() {
        return this._position;
    }
    set position(value) {
        this._position = value;
        this._checkBounds();
    }
    get currentChar() {
        return this._currentChar;
    }
    get nextChar() {
        return this.position + 1 < this._text.length ? this._text.charCodeAt(this.position + 1) : 0;
    }
    get prevChar() {
        return this.position - 1 >= 0 ? this._text.charCodeAt(this.position - 1) : 0;
    }
    get length() {
        return this._text.length;
    }
    getText() {
        return this._text;
    }
    // We also expose a (non-property) method that is
    // the equivalent of currentChar above. This allows
    // us to work around assumptions in the TypeScript
    // compiler that method calls (e.g. moveNext()) don't
    // modify properties.
    getCurrentChar() {
        return this._currentChar;
    }
    isEndOfStream() {
        return this._isEndOfStream;
    }
    lookAhead(offset) {
        const pos = this._position + offset;
        return pos < 0 || pos >= this._text.length ? 0 : this._text.charCodeAt(pos);
    }
    advance(offset) {
        this.position += offset;
    }
    moveNext() {
        if (this._position < this._text.length - 1) {
            // Most common case, no need to check bounds extensively
            this._position += 1;
            this._currentChar = this._text.charCodeAt(this._position);
            return true;
        }
        this.advance(1);
        return !this.isEndOfStream();
    }
    isAtWhiteSpace() {
        return (0, characters_1.isWhiteSpace)(this.currentChar);
    }
    isAtLineBreak() {
        return (0, characters_1.isLineBreak)(this.currentChar);
    }
    skipLineBreak() {
        if (this._currentChar === 13 /* Char.CarriageReturn */) {
            this.moveNext();
            if (this.currentChar === 10 /* Char.LineFeed */) {
                this.moveNext();
            }
        }
        else if (this._currentChar === 10 /* Char.LineFeed */) {
            this.moveNext();
        }
    }
    skipWhitespace() {
        while (!this.isEndOfStream() && this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }
    skipToEol() {
        while (!this.isEndOfStream() && !this.isAtLineBreak()) {
            this.moveNext();
        }
    }
    skipToWhitespace() {
        while (!this.isEndOfStream() && !this.isAtWhiteSpace()) {
            this.moveNext();
        }
    }
    charCodeAt(index) {
        return this._text.charCodeAt(index);
    }
    _checkBounds() {
        if (this._position < 0) {
            this._position = 0;
        }
        this._isEndOfStream = this._position >= this._text.length;
        if (this._isEndOfStream) {
            this._position = this._text.length;
        }
        this._currentChar = this._isEndOfStream ? 0 : this._text.charCodeAt(this._position);
    }
}
exports.CharacterStream = CharacterStream;
//# sourceMappingURL=characterStream.js.map