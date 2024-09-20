"use strict";
/*
 * testState.Consts.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Defines consts that will be available to fourslash tests.
 *
 * Make sure to declare consts in fourslash.ts as well to make them available on design time.
 * Ones defined here will be used on runtime.
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
exports.Consts = void 0;
const lsp = __importStar(require("vscode-languageserver"));
const completionProvider_1 = require("../../../languageService/completionProvider");
/* eslint-disable @typescript-eslint/no-unused-vars */
var Consts;
(function (Consts) {
    Consts.CodeActionKind = lsp.CodeActionKind;
    // it is duped here since original definition in '../../../commands/commands'
    // is marked as const enum and we can't import "const enum" which get removed
    // once compiled
    let Commands;
    (function (Commands) {
        Commands["createTypeStub"] = "pyright.createtypestub";
        Commands["restartServer"] = "pyright.restartserver";
        Commands["orderImports"] = "pyright.organizeimports";
    })(Commands = Consts.Commands || (Consts.Commands = {}));
    Consts.CompletionItemKind = lsp.CompletionItemKind;
    Consts.InlayHintKind = lsp.InlayHintKind;
    Consts.IndexValueDetail = completionProvider_1.indexValueDetail;
})(Consts || (exports.Consts = Consts = {}));
//# sourceMappingURL=testState.Consts.js.map