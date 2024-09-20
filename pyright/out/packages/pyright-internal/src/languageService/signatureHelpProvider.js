"use strict";
/*
 * signatureHelpProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that maps a position within a Python call node into info
 * that can be presented to the developer to help fill in the remaining
 * arguments for the call.
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
exports.SignatureHelpProvider = void 0;
const vscode_languageserver_1 = require("vscode-languageserver");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const cancellationUtils_1 = require("../common/cancellationUtils");
const positionUtils_1 = require("../common/positionUtils");
const tooltipUtils_1 = require("./tooltipUtils");
const analyzerNodeInfo_1 = require("../analyzer/analyzerNodeInfo");
const typeDocStringUtils_1 = require("../analyzer/typeDocStringUtils");
class SignatureHelpProvider {
    constructor(_program, _fileUri, _position, _format, _hasSignatureLabelOffsetCapability, _hasActiveParameterCapability, _context, _docStringService, _token) {
        this._program = _program;
        this._fileUri = _fileUri;
        this._position = _position;
        this._format = _format;
        this._hasSignatureLabelOffsetCapability = _hasSignatureLabelOffsetCapability;
        this._hasActiveParameterCapability = _hasActiveParameterCapability;
        this._context = _context;
        this._docStringService = _docStringService;
        this._token = _token;
        this._parseResults = this._program.getParseResults(this._fileUri);
        this._sourceMapper = this._program.getSourceMapper(this._fileUri, this._token, /* mapCompiled */ true);
    }
    getSignatureHelp() {
        return this._convert(this._getSignatureHelp());
    }
    get _evaluator() {
        return this._program.evaluator;
    }
    _getSignatureHelp() {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._token);
        if (!this._parseResults) {
            return undefined;
        }
        const offset = (0, positionUtils_1.convertPositionToOffset)(this._position, this._parseResults.tokenizerOutput.lines);
        if (offset === undefined) {
            return undefined;
        }
        let node = ParseTreeUtils.findNodeByOffset(this._parseResults.parserOutput.parseTree, offset);
        // See if we can get to a "better" node by backing up a few columns.
        // A "better" node is defined as one that's deeper than the current
        // node.
        const initialNode = node;
        const initialDepth = node ? ParseTreeUtils.getNodeDepth(node) : 0;
        let curOffset = offset - 1;
        while (curOffset >= 0) {
            // Don't scan back across a comma because commas separate
            // arguments, and we don't want to mistakenly think that we're
            // pointing to a previous argument. Don't scan across open parenthesis so that
            // we don't go into the wrong function call
            const ch = this._parseResults.text.substr(curOffset, 1);
            if (ch === ',' || ch === '(') {
                break;
            }
            const curNode = ParseTreeUtils.findNodeByOffset(this._parseResults.parserOutput.parseTree, curOffset);
            if (curNode && curNode !== initialNode) {
                if (ParseTreeUtils.getNodeDepth(curNode) > initialDepth) {
                    node = curNode;
                }
                break;
            }
            curOffset--;
        }
        if (node === undefined) {
            return undefined;
        }
        const callInfo = (0, parseTreeUtils_1.getCallNodeAndActiveParameterIndex)(node, offset, this._parseResults.tokenizerOutput.tokens);
        if (!callInfo) {
            return;
        }
        const callSignatureInfo = this._evaluator.getCallSignatureInfo(callInfo.callNode, callInfo.activeIndex, callInfo.activeOrFake);
        if (!callSignatureInfo) {
            return undefined;
        }
        const signatures = callSignatureInfo.signatures.map((sig) => this._makeSignature(callSignatureInfo.callNode, sig));
        const callHasParameters = !!((_a = callSignatureInfo.callNode.arguments) === null || _a === void 0 ? void 0 : _a.length);
        return {
            signatures,
            callHasParameters,
        };
    }
    _convert(signatureHelpResults) {
        var _a, _b, _c;
        if (!signatureHelpResults) {
            return undefined;
        }
        const signatures = signatureHelpResults.signatures.map((sig) => {
            let paramInfo = [];
            if (sig.parameters) {
                paramInfo = sig.parameters.map((param) => {
                    var _a;
                    return {
                        label: this._hasSignatureLabelOffsetCapability
                            ? [param.startOffset, param.endOffset]
                            : param.text,
                        documentation: {
                            kind: this._format,
                            value: (_a = param.documentation) !== null && _a !== void 0 ? _a : '',
                        },
                    };
                });
            }
            const sigInfo = vscode_languageserver_1.SignatureInformation.create(sig.label, /* documentation */ undefined, ...paramInfo);
            if (sig.documentation !== undefined) {
                sigInfo.documentation = sig.documentation;
            }
            if (sig.activeParameter !== undefined) {
                sigInfo.activeParameter = sig.activeParameter;
            }
            return sigInfo;
        });
        // A signature is active if it contains an active parameter,
        // or if both the signature and its invocation have no parameters.
        const isActive = (sig) => { var _a; return sig.activeParameter !== undefined || (!signatureHelpResults.callHasParameters && !((_a = sig.parameters) === null || _a === void 0 ? void 0 : _a.length)); };
        let activeSignature = signatures.findIndex(isActive);
        if (activeSignature === -1) {
            activeSignature = undefined;
        }
        let activeParameter = activeSignature !== undefined ? signatures[activeSignature].activeParameter : undefined;
        // Check if we should reuse the user's signature selection. If the retrigger was not "invoked"
        // (i.e., the signature help call was automatically generated by the client due to some navigation
        // or text change), check to see if the previous signature is still "active". If so, we mark it as
        // active in our response.
        //
        // This isn't a perfect method. For nested calls, we can't tell when we are moving between them.
        // Ideally, we would include a token in the signature help responses to compare later, allowing us
        // to know when the user's navigated to a nested call (and therefore the old signature's info does
        // not apply), but for now manually retriggering the signature help will work around the issue.
        if (((_a = this._context) === null || _a === void 0 ? void 0 : _a.isRetrigger) && this._context.triggerKind !== vscode_languageserver_1.SignatureHelpTriggerKind.Invoked) {
            const prevActiveSignature = (_b = this._context.activeSignatureHelp) === null || _b === void 0 ? void 0 : _b.activeSignature;
            if (prevActiveSignature !== undefined && prevActiveSignature < signatures.length) {
                const sig = signatures[prevActiveSignature];
                if (isActive(sig)) {
                    activeSignature = prevActiveSignature;
                    activeParameter = (_c = sig.activeParameter) !== null && _c !== void 0 ? _c : undefined;
                }
            }
        }
        if (this._hasActiveParameterCapability || activeSignature === undefined) {
            // If there is no active parameter, then we want the client to not highlight anything.
            // Unfortunately, the LSP spec says that "undefined" or "out of bounds" values should be
            // treated as 0, which is the first parameter. That's not what we want, but thankfully
            // VS Code (and potentially other clients) choose to handle out of bounds values by
            // not highlighting them, which is what we want.
            //
            // The spec defines activeParameter as uinteger, so use the maximum length of any
            // signature's parameter list to ensure that the value is always out of range.
            //
            // We always set this even if some signature has an active parameter, as this
            // value is used as the fallback for signatures that don't explicitly specify an
            // active parameter (and we use "undefined" to mean "no active parameter").
            //
            // We could apply this hack to each individual signature such that they all specify
            // activeParameter, but that would make it more difficult to determine which actually
            // are active when comparing, and we already have to set this for clients which don't
            // support per-signature activeParameter.
            //
            // See:
            //   - https://github.com/microsoft/language-server-protocol/issues/1271
            //   - https://github.com/microsoft/pyright/pull/1783
            activeParameter = Math.max(...signatures.map((s) => { var _a, _b; return (_b = (_a = s.parameters) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0; }));
        }
        return { signatures, activeSignature, activeParameter };
    }
    _makeSignature(callNode, signature) {
        var _a;
        const functionType = signature.type;
        const stringParts = this._evaluator.printFunctionParts(functionType, 1024 /* PrintTypeFlags.ExpandTypedDictArgs */);
        const parameters = [];
        const functionDocString = (_a = (0, tooltipUtils_1.getFunctionDocStringFromType)(functionType, this._sourceMapper, this._evaluator)) !== null && _a !== void 0 ? _a : this._getDocStringFromCallNode(callNode);
        const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(callNode);
        let label = '(';
        let activeParameter;
        const params = functionType.details.parameters;
        stringParts[0].forEach((paramString, paramIndex) => {
            let paramName = '';
            if (paramIndex < params.length) {
                paramName = params[paramIndex].name || '';
            }
            else if (params.length > 0) {
                paramName = params[params.length - 1].name || '';
            }
            parameters.push({
                startOffset: label.length,
                endOffset: label.length + paramString.length,
                text: paramString,
            });
            // Name match for active parameter. The set of parameters from the function
            // may not match the actual string output from the typeEvaluator (kwargs for TypedDict is an example).
            if (paramName && signature.activeParam && signature.activeParam.name === paramName) {
                activeParameter = paramIndex;
            }
            label += paramString;
            if (paramIndex < stringParts[0].length - 1) {
                label += ', ';
            }
        });
        label += ') -> ' + stringParts[1];
        if (signature.activeParam && activeParameter === undefined) {
            activeParameter = params.indexOf(signature.activeParam);
            if (activeParameter === -1) {
                activeParameter = undefined;
            }
        }
        // Extract the documentation only for the active parameter.
        if (activeParameter !== undefined) {
            const activeParam = parameters[activeParameter];
            if (activeParam) {
                activeParam.documentation = this._docStringService.extractParameterDocumentation(functionDocString || '', params[activeParameter].name || '', this._format);
            }
        }
        const sigInfo = {
            label,
            parameters,
            activeParameter,
        };
        if (functionDocString) {
            if (this._format === vscode_languageserver_1.MarkupKind.Markdown) {
                sigInfo.documentation = {
                    kind: vscode_languageserver_1.MarkupKind.Markdown,
                    value: this._docStringService.convertDocStringToMarkdown(functionDocString, (0, typeDocStringUtils_1.isBuiltInModule)(fileInfo === null || fileInfo === void 0 ? void 0 : fileInfo.fileUri)),
                };
            }
            else {
                sigInfo.documentation = {
                    kind: vscode_languageserver_1.MarkupKind.PlainText,
                    value: this._docStringService.convertDocStringToPlainText(functionDocString),
                };
            }
        }
        return sigInfo;
    }
    _getDocStringFromCallNode(callNode) {
        var _a;
        // This is a heuristic to see whether we can get some docstring
        // from call node when all other methods failed.
        // It only works if call is off a name node.
        let name;
        const expr = callNode.leftExpression;
        if (expr.nodeType === 38 /* ParseNodeType.Name */) {
            name = expr;
        }
        else if (expr.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            name = expr.memberName;
        }
        if (!name) {
            return undefined;
        }
        for (const decl of (_a = this._evaluator.getDeclarationsForNameNode(name)) !== null && _a !== void 0 ? _a : []) {
            const resolveDecl = this._evaluator.resolveAliasDeclaration(decl, /* resolveLocalNames */ true);
            if (!resolveDecl) {
                continue;
            }
            const type = this._evaluator.getType(name);
            if (!type) {
                continue;
            }
            const part = (0, tooltipUtils_1.getDocumentationPartsForTypeAndDecl)(this._sourceMapper, type, resolveDecl, this._evaluator);
            if (part) {
                return part;
            }
        }
        return undefined;
    }
}
exports.SignatureHelpProvider = SignatureHelpProvider;
//# sourceMappingURL=signatureHelpProvider.js.map