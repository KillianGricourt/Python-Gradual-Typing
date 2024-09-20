"use strict";
/*
 * workspaceEditTestUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Test Utils around workspace edits.
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.textEditAreSame = exports.textEditsAreSame = exports.verifyTextEditMap = exports.verifyDocumentEdits = exports.textDocumentAreSame = exports.verifyChangeAnnotations = exports.verifyWorkspaceEdit = void 0;
const assert_1 = __importDefault(require("assert"));
const vscode_languageserver_1 = require("vscode-languageserver");
const debug = __importStar(require("../../../common/debug"));
const textRange_1 = require("../../../common/textRange");
function verifyWorkspaceEdit(expected, actual, marker) {
    if (actual.changes) {
        verifyTextEditMap(expected.changes, actual.changes, marker);
    }
    else {
        (0, assert_1.default)(!expected.changes);
    }
    if (actual.documentChanges) {
        verifyDocumentEdits(expected.documentChanges, actual.documentChanges);
    }
    else {
        (0, assert_1.default)(!expected.documentChanges);
    }
    if (actual.changeAnnotations) {
        verifyChangeAnnotations(expected.changeAnnotations, actual.changeAnnotations);
    }
    else {
        (0, assert_1.default)(!expected.changeAnnotations);
    }
}
exports.verifyWorkspaceEdit = verifyWorkspaceEdit;
function verifyChangeAnnotations(expected, actual) {
    assert_1.default.strictEqual(Object.entries(expected).length, Object.entries(actual).length);
    for (const key of Object.keys(expected)) {
        const expectedAnnotation = expected[key];
        const actualAnnotation = actual[key];
        // We need to improve it to test localized strings.
        assert_1.default.strictEqual(expectedAnnotation.label, actualAnnotation.label);
        assert_1.default.strictEqual(expectedAnnotation.description, actualAnnotation.description);
        assert_1.default.strictEqual(expectedAnnotation.needsConfirmation, actualAnnotation.needsConfirmation);
    }
}
exports.verifyChangeAnnotations = verifyChangeAnnotations;
function textDocumentAreSame(expected, actual) {
    return expected.version === actual.version && expected.uri === actual.uri;
}
exports.textDocumentAreSame = textDocumentAreSame;
function verifyDocumentEdits(expected, actual) {
    assert_1.default.strictEqual(expected.length, actual.length);
    for (const op of expected) {
        (0, assert_1.default)(actual.some((a) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
            const expectedKind = vscode_languageserver_1.TextDocumentEdit.is(op) ? 'edit' : op.kind;
            const actualKind = vscode_languageserver_1.TextDocumentEdit.is(a) ? 'edit' : a.kind;
            if (expectedKind !== actualKind) {
                return false;
            }
            switch (expectedKind) {
                case 'edit': {
                    const expectedEdit = op;
                    const actualEdit = a;
                    if (!textDocumentAreSame(expectedEdit.textDocument, actualEdit.textDocument)) {
                        return false;
                    }
                    if (!actualEdit.textDocument.uri.includes(':')) {
                        // Not returning a URI, so fail.
                        return false;
                    }
                    return textEditsAreSame(expectedEdit.edits.filter((e) => vscode_languageserver_1.TextEdit.is(e)), actualEdit.edits.filter((e) => vscode_languageserver_1.TextEdit.is(e)));
                }
                case 'create': {
                    const expectedOp = op;
                    const actualOp = a;
                    return (expectedOp.kind === actualOp.kind &&
                        expectedOp.annotationId === actualOp.annotationId &&
                        expectedOp.uri === actualOp.uri &&
                        ((_a = expectedOp.options) === null || _a === void 0 ? void 0 : _a.ignoreIfExists) === ((_b = actualOp.options) === null || _b === void 0 ? void 0 : _b.ignoreIfExists) &&
                        ((_c = expectedOp.options) === null || _c === void 0 ? void 0 : _c.overwrite) === ((_d = actualOp.options) === null || _d === void 0 ? void 0 : _d.overwrite));
                }
                case 'rename': {
                    const expectedOp = op;
                    const actualOp = a;
                    return (expectedOp.kind === actualOp.kind &&
                        expectedOp.annotationId === actualOp.annotationId &&
                        expectedOp.oldUri === actualOp.oldUri &&
                        expectedOp.newUri === actualOp.newUri &&
                        ((_e = expectedOp.options) === null || _e === void 0 ? void 0 : _e.ignoreIfExists) === ((_f = actualOp.options) === null || _f === void 0 ? void 0 : _f.ignoreIfExists) &&
                        ((_g = expectedOp.options) === null || _g === void 0 ? void 0 : _g.overwrite) === ((_h = actualOp.options) === null || _h === void 0 ? void 0 : _h.overwrite));
                }
                case 'delete': {
                    const expectedOp = op;
                    const actualOp = a;
                    return (expectedOp.annotationId === actualOp.annotationId &&
                        expectedOp.kind === actualOp.kind &&
                        expectedOp.uri === actualOp.uri &&
                        ((_j = expectedOp.options) === null || _j === void 0 ? void 0 : _j.ignoreIfNotExists) === ((_k = actualOp.options) === null || _k === void 0 ? void 0 : _k.ignoreIfNotExists) &&
                        ((_l = expectedOp.options) === null || _l === void 0 ? void 0 : _l.recursive) === ((_m = actualOp.options) === null || _m === void 0 ? void 0 : _m.recursive));
                }
                default:
                    debug.assertNever(expectedKind);
            }
        }));
    }
}
exports.verifyDocumentEdits = verifyDocumentEdits;
function verifyTextEditMap(expected, actual, marker) {
    assert_1.default.strictEqual(Object.entries(expected).length, Object.entries(actual).length, marker === undefined ? '' : `${marker} has failed`);
    for (const key of Object.keys(expected)) {
        (0, assert_1.default)(textEditsAreSame(expected[key], actual[key]), marker === undefined ? '' : `${marker} has failed`);
    }
}
exports.verifyTextEditMap = verifyTextEditMap;
function textEditsAreSame(expectedEdits, actualEdits) {
    if (expectedEdits.length !== actualEdits.length) {
        return false;
    }
    for (const edit of expectedEdits) {
        if (!actualEdits.some((a) => textEditAreSame(edit, a))) {
            return false;
        }
    }
    return true;
}
exports.textEditsAreSame = textEditsAreSame;
function textEditAreSame(expected, actual) {
    if (!(0, textRange_1.rangesAreEqual)(expected.range, actual.range)) {
        return false;
    }
    if (expected.newText !== actual.newText) {
        return false;
    }
    const expectedAnnotation = vscode_languageserver_1.AnnotatedTextEdit.is(expected) ? expected.annotationId : '';
    const actualAnnotation = vscode_languageserver_1.AnnotatedTextEdit.is(actual) ? actual.annotationId : '';
    return expectedAnnotation === actualAnnotation;
}
exports.textEditAreSame = textEditAreSame;
//# sourceMappingURL=workspaceEditTestUtils.js.map