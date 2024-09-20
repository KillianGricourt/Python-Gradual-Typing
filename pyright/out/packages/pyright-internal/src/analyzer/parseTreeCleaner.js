"use strict";
/*
 * parseTreeCleaner.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A parse tree walker that's used to clean any analysis
 * information hanging off the parse tree. It's used when
 * dependent files have been modified and the file requires
 * reanalysis. Without this, we'd need to generate a fresh
 * parse tree from scratch.
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
exports.ParseTreeCleanerWalker = void 0;
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const parseTreeWalker_1 = require("./parseTreeWalker");
class ParseTreeCleanerWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(parseTree) {
        super();
        this._parseTree = parseTree;
    }
    clean() {
        this.walk(this._parseTree);
    }
    visitNode(node) {
        AnalyzerNodeInfo.cleanNodeAnalysisInfo(node);
        return super.visitNode(node);
    }
}
exports.ParseTreeCleanerWalker = ParseTreeCleanerWalker;
//# sourceMappingURL=parseTreeCleaner.js.map