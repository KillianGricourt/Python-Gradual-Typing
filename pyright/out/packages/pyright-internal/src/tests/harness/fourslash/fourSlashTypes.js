"use strict";
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
exports.TestCancellationToken = exports.fileMetadataNames = void 0;
/*
 * fourSlashTypes.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Various common types for fourslash test framework
 */
const debug = __importStar(require("../../../common/debug"));
/** List of allowed file metadata names */
exports.fileMetadataNames = [
    "filename" /* MetadataOptionNames.fileName */,
    "library" /* MetadataOptionNames.library */,
    "distlibrary" /* MetadataOptionNames.distLibrary */,
    "ipythonmode" /* MetadataOptionNames.ipythonMode */,
];
class TestCancellationToken {
    constructor() {
        this._numberOfCallsBeforeCancellation = TestCancellationToken._notCanceled;
    }
    isCancellationRequested() {
        if (this._numberOfCallsBeforeCancellation < 0) {
            return false;
        }
        if (this._numberOfCallsBeforeCancellation > 0) {
            this._numberOfCallsBeforeCancellation--;
            return false;
        }
        return true;
    }
    setCancelled(numberOfCalls = 0) {
        debug.assert(numberOfCalls >= 0);
        this._numberOfCallsBeforeCancellation = numberOfCalls;
    }
    resetCancelled() {
        this._numberOfCallsBeforeCancellation = TestCancellationToken._notCanceled;
    }
}
exports.TestCancellationToken = TestCancellationToken;
// 0 - cancelled
// >0 - not cancelled
// <0 - not cancelled and value denotes number of isCancellationRequested after which token become cancelled
TestCancellationToken._notCanceled = -1;
//# sourceMappingURL=fourSlashTypes.js.map