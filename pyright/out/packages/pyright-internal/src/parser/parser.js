"use strict";
/*
 * parser.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Based on code from python-language-server repository:
 *  https://github.com/Microsoft/python-language-server
 *
 * Parser for the Python language. Converts a stream of tokens
 * into an abstract syntax tree (AST).
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
exports.Parser = exports.ParseOptions = void 0;
const sourceFile_1 = require("../analyzer/sourceFile");
const collectionUtils_1 = require("../common/collectionUtils");
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticSink_1 = require("../common/diagnosticSink");
const positionUtils_1 = require("../common/positionUtils");
const pythonVersion_1 = require("../common/pythonVersion");
const textRange_1 = require("../common/textRange");
const timing_1 = require("../common/timing");
const localize_1 = require("../localization/localize");
const parseNodes_1 = require("./parseNodes");
const StringTokenUtils = __importStar(require("./stringTokenUtils"));
const tokenizer_1 = require("./tokenizer");
const tokenizerTypes_1 = require("./tokenizerTypes");
class ParseOptions {
    constructor() {
        this.isStubFile = false;
        this.pythonVersion = pythonVersion_1.latestStablePythonVersion;
        this.reportInvalidStringEscapeSequence = false;
        this.skipFunctionAndClassBody = false;
        this.ipythonMode = sourceFile_1.IPythonMode.None;
        this.reportErrorsForParsedStringContents = false;
    }
}
exports.ParseOptions = ParseOptions;
// Limit the max child node depth to prevent stack overflows.
const maxChildNodeDepth = 256;
class Parser {
    constructor() {
        this._tokenIndex = 0;
        this._areErrorsSuppressed = false;
        this._parseOptions = new ParseOptions();
        this._diagSink = new diagnosticSink_1.DiagnosticSink();
        this._isInLoop = false;
        this._isInFunction = false;
        this._isInFinally = false;
        this._isParsingTypeAnnotation = false;
        this._isParsingIndexTrailer = false;
        this._isParsingQuotedText = false;
        this._futureImports = new Set();
        this._importedModules = [];
        this._containsWildcardImport = false;
        this._assignmentExpressionsAllowed = true;
        this._typingImportAliases = [];
        this._typingSymbolAliases = new Map();
    }
    parseSourceFile(fileContents, parseOptions, diagSink) {
        timing_1.timingStats.tokenizeFileTime.timeOperation(() => {
            this._startNewParse(fileContents, 0, fileContents.length, parseOptions, diagSink);
        });
        const moduleNode = parseNodes_1.ModuleNode.create({ start: 0, length: fileContents.length });
        timing_1.timingStats.parseFileTime.timeOperation(() => {
            while (!this._atEof()) {
                if (!this._consumeTokenIfType(2 /* TokenType.NewLine */)) {
                    // Handle a common error case and try to recover.
                    const nextToken = this._peekToken();
                    if (nextToken.type === 3 /* TokenType.Indent */) {
                        this._getNextToken();
                        const indentToken = nextToken;
                        if (indentToken.isIndentAmbiguous) {
                            this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), indentToken);
                        }
                        else {
                            this._addSyntaxError(localize_1.LocMessage.unexpectedIndent(), nextToken);
                        }
                    }
                    const statement = this._parseStatement();
                    if (!statement) {
                        // Perform basic error recovery to get to the next line.
                        this._consumeTokensUntilType([2 /* TokenType.NewLine */]);
                    }
                    else {
                        statement.parent = moduleNode;
                        moduleNode.statements.push(statement);
                    }
                }
            }
        });
        (0, debug_1.assert)(this._tokenizerOutput !== undefined);
        return {
            text: fileContents,
            parserOutput: {
                parseTree: moduleNode,
                importedModules: this._importedModules,
                futureImports: this._futureImports,
                containsWildcardImport: this._containsWildcardImport,
                typingSymbolAliases: this._typingSymbolAliases,
            },
            tokenizerOutput: this._tokenizerOutput,
        };
    }
    parseTextExpression(fileContents, textOffset, textLength, parseOptions, parseTextMode = 0 /* ParseTextMode.Expression */, initialParenDepth = 0, typingSymbolAliases) {
        const diagSink = new diagnosticSink_1.DiagnosticSink();
        this._startNewParse(fileContents, textOffset, textLength, parseOptions, diagSink, initialParenDepth);
        if (typingSymbolAliases) {
            this._typingSymbolAliases = new Map(typingSymbolAliases);
        }
        let parseTree;
        if (parseTextMode === 1 /* ParseTextMode.VariableAnnotation */) {
            this._isParsingQuotedText = true;
            parseTree = this._parseTypeAnnotation();
        }
        else if (parseTextMode === 2 /* ParseTextMode.FunctionAnnotation */) {
            this._isParsingQuotedText = true;
            parseTree = this._parseFunctionTypeAnnotation();
        }
        else {
            const exprListResult = this._parseTestOrStarExpressionList(
            /* allowAssignmentExpression */ false, 
            /* allowMultipleUnpack */ true);
            if (exprListResult.parseError) {
                parseTree = exprListResult.parseError;
            }
            else {
                if (exprListResult.list.length === 0) {
                    this._addSyntaxError(localize_1.LocMessage.expectedExpr(), this._peekToken());
                }
                parseTree = this._makeExpressionOrTuple(exprListResult, /* enclosedInParens */ false);
            }
        }
        if (this._peekTokenType() === 2 /* TokenType.NewLine */) {
            this._getNextToken();
        }
        if (!this._atEof()) {
            this._addSyntaxError(localize_1.LocMessage.unexpectedExprToken(), this._peekToken());
        }
        return {
            parseTree,
            lines: this._tokenizerOutput.lines,
            diagnostics: diagSink.fetchAndClear(),
        };
    }
    _startNewParse(fileContents, textOffset, textLength, parseOptions, diagSink, initialParenDepth = 0) {
        this._fileContents = fileContents;
        this._parseOptions = parseOptions;
        this._diagSink = diagSink;
        // Tokenize the file contents.
        const tokenizer = new tokenizer_1.Tokenizer();
        this._tokenizerOutput = tokenizer.tokenize(fileContents, textOffset, textLength, initialParenDepth, this._parseOptions.ipythonMode);
        this._tokenIndex = 0;
    }
    // stmt: simple_stmt | compound_stmt
    // compound_stmt: if_stmt | while_stmt | for_stmt | try_stmt | with_stmt
    //   | funcdef | classdef | decorated | async_stmt
    _parseStatement() {
        // Handle the errant condition of a dedent token here to provide
        // better recovery.
        if (this._consumeTokenIfType(4 /* TokenType.Dedent */)) {
            this._addSyntaxError(localize_1.LocMessage.unexpectedUnindent(), this._peekToken());
        }
        switch (this._peekKeywordType()) {
            case 20 /* KeywordType.If */:
                return this._parseIfStatement();
            case 36 /* KeywordType.While */:
                return this._parseWhileStatement();
            case 17 /* KeywordType.For */:
                return this._parseForStatement();
            case 34 /* KeywordType.Try */:
                return this._parseTryStatement();
            case 37 /* KeywordType.With */:
                return this._parseWithStatement();
            case 10 /* KeywordType.Def */:
                return this._parseFunctionDef();
            case 7 /* KeywordType.Class */:
                return this._parseClassDef();
            case 3 /* KeywordType.Async */:
                return this._parseAsyncStatement();
            case 25 /* KeywordType.Match */: {
                // Match is considered a "soft" keyword, so we will treat
                // it as an identifier if it is followed by an unexpected
                // token.
                const peekToken = this._peekToken(1);
                let isInvalidMatchToken = false;
                if (peekToken.type === 10 /* TokenType.Colon */ ||
                    peekToken.type === 11 /* TokenType.Semicolon */ ||
                    peekToken.type === 12 /* TokenType.Comma */ ||
                    peekToken.type === 20 /* TokenType.Dot */ ||
                    peekToken.type === 2 /* TokenType.NewLine */ ||
                    peekToken.type === 1 /* TokenType.EndOfStream */) {
                    isInvalidMatchToken = true;
                }
                else if (peekToken.type === 9 /* TokenType.Operator */) {
                    const operatorToken = peekToken;
                    if (operatorToken.operatorType !== 26 /* OperatorType.Multiply */ &&
                        operatorToken.operatorType !== 0 /* OperatorType.Add */ &&
                        operatorToken.operatorType !== 5 /* OperatorType.BitwiseInvert */ &&
                        operatorToken.operatorType !== 33 /* OperatorType.Subtract */) {
                        isInvalidMatchToken = true;
                    }
                }
                if (!isInvalidMatchToken) {
                    // Try to parse the match statement. If it doesn't appear to
                    // be a match statement, treat as a non-keyword and reparse.
                    const matchStatement = this._parseMatchStatement();
                    if (matchStatement) {
                        return matchStatement;
                    }
                }
                break;
            }
        }
        if (this._peekOperatorType() === 22 /* OperatorType.MatrixMultiply */) {
            return this._parseDecorated();
        }
        return this._parseSimpleStatement();
    }
    // async_stmt: 'async' (funcdef | with_stmt | for_stmt)
    _parseAsyncStatement() {
        const asyncToken = this._getKeywordToken(3 /* KeywordType.Async */);
        switch (this._peekKeywordType()) {
            case 10 /* KeywordType.Def */:
                return this._parseFunctionDef(asyncToken);
            case 37 /* KeywordType.With */:
                return this._parseWithStatement(asyncToken);
            case 17 /* KeywordType.For */:
                return this._parseForStatement(asyncToken);
        }
        this._addSyntaxError(localize_1.LocMessage.unexpectedAsyncToken(), asyncToken);
        return undefined;
    }
    // type_alias_stmt: "type" name [type_param_seq] = expr
    _parseTypeAliasStatement() {
        const typeToken = this._getKeywordToken(35 /* KeywordType.Type */);
        if (!this._parseOptions.isStubFile && this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_12)) {
            this._addSyntaxError(localize_1.LocMessage.typeAliasStatementIllegal(), typeToken);
        }
        const nameToken = this._getTokenIfIdentifier();
        (0, debug_1.assert)(nameToken !== undefined);
        const name = parseNodes_1.NameNode.create(nameToken);
        let typeParameters;
        if (this._peekToken().type === 15 /* TokenType.OpenBracket */) {
            typeParameters = this._parseTypeParameterList();
        }
        const assignToken = this._peekToken();
        if (assignToken.type !== 9 /* TokenType.Operator */ ||
            assignToken.operatorType !== 2 /* OperatorType.Assign */) {
            this._addSyntaxError(localize_1.LocMessage.expectedEquals(), assignToken);
        }
        else {
            this._getNextToken();
        }
        const wasParsingTypeAnnotation = this._isParsingTypeAnnotation;
        this._isParsingTypeAnnotation = true;
        const expression = this._parseTestExpression(/* allowAssignmentExpression */ false);
        this._isParsingTypeAnnotation = wasParsingTypeAnnotation;
        return parseNodes_1.TypeAliasNode.create(typeToken, name, expression, typeParameters);
    }
    // type_param_seq: '[' (type_param ',')+ ']'
    _parseTypeParameterList() {
        const typeVariableNodes = [];
        const openBracketToken = this._getNextToken();
        (0, debug_1.assert)(openBracketToken.type === 15 /* TokenType.OpenBracket */);
        while (true) {
            const firstToken = this._peekToken();
            if (firstToken.type === 16 /* TokenType.CloseBracket */) {
                if (typeVariableNodes.length === 0) {
                    this._addSyntaxError(localize_1.LocMessage.typeParametersMissing(), this._peekToken());
                }
                break;
            }
            const typeVarNode = this._parseTypeParameter();
            if (!typeVarNode) {
                break;
            }
            typeVariableNodes.push(typeVarNode);
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                break;
            }
        }
        const closingToken = this._peekToken();
        if (closingToken.type !== 16 /* TokenType.CloseBracket */) {
            this._addSyntaxError(localize_1.LocMessage.expectedCloseBracket(), this._peekToken());
            this._consumeTokensUntilType([2 /* TokenType.NewLine */, 16 /* TokenType.CloseBracket */, 10 /* TokenType.Colon */]);
        }
        else {
            this._getNextToken();
        }
        return parseNodes_1.TypeParameterListNode.create(openBracketToken, closingToken, typeVariableNodes);
    }
    // type_param: ['*' | '**'] NAME [':' bound_expr] ['=' default_expr]
    _parseTypeParameter() {
        let typeParamCategory = parseNodes_1.TypeParameterCategory.TypeVar;
        if (this._consumeTokenIfOperator(26 /* OperatorType.Multiply */)) {
            typeParamCategory = parseNodes_1.TypeParameterCategory.TypeVarTuple;
        }
        else if (this._consumeTokenIfOperator(29 /* OperatorType.Power */)) {
            typeParamCategory = parseNodes_1.TypeParameterCategory.ParamSpec;
        }
        const nameToken = this._getTokenIfIdentifier();
        if (!nameToken) {
            this._addSyntaxError(localize_1.LocMessage.expectedTypeParameterName(), this._peekToken());
            return undefined;
        }
        const name = parseNodes_1.NameNode.create(nameToken);
        let boundExpression;
        if (this._consumeTokenIfType(10 /* TokenType.Colon */)) {
            boundExpression = this._parseExpression(/* allowUnpack */ false);
            if (typeParamCategory !== parseNodes_1.TypeParameterCategory.TypeVar) {
                this._addSyntaxError(localize_1.LocMessage.typeParameterBoundNotAllowed(), boundExpression);
            }
        }
        let defaultExpression;
        if (this._consumeTokenIfOperator(2 /* OperatorType.Assign */)) {
            defaultExpression = this._parseExpression(
            /* allowUnpack */ typeParamCategory === parseNodes_1.TypeParameterCategory.TypeVarTuple);
            if (!this._parseOptions.isStubFile && this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_13)) {
                this._addSyntaxError(localize_1.LocMessage.typeVarDefaultIllegal(), defaultExpression);
            }
        }
        return parseNodes_1.TypeParameterNode.create(name, typeParamCategory, boundExpression, defaultExpression);
    }
    // match_stmt: "match" subject_expr ':' NEWLINE INDENT case_block+ DEDENT
    // subject_expr:
    //     | star_named_expression ',' star_named_expressions?
    //     | named_expression
    _parseMatchStatement() {
        // Parse the subject expression with errors suppressed. If it's not
        // followed by a colon, we'll assume this is not a match statement.
        // We need to do this because "match" is considered a soft keyword,
        // and we need to distinguish between "match(2)" and "match (2):"
        // and between "match[2]" and "match [2]:"
        let smellsLikeMatchStatement = false;
        this._suppressErrors(() => {
            const curTokenIndex = this._tokenIndex;
            this._getKeywordToken(25 /* KeywordType.Match */);
            const expression = this._parseTestOrStarListAsExpression(
            /* allowAssignmentExpression */ true, 
            /* allowMultipleUnpack */ true, 12 /* ErrorExpressionCategory.MissingPatternSubject */, () => localize_1.LocMessage.expectedReturnExpr());
            smellsLikeMatchStatement =
                expression.nodeType !== 0 /* ParseNodeType.Error */ && this._peekToken().type === 10 /* TokenType.Colon */;
            // Set the token index back to the start.
            this._tokenIndex = curTokenIndex;
        });
        if (!smellsLikeMatchStatement) {
            return undefined;
        }
        const matchToken = this._getKeywordToken(25 /* KeywordType.Match */);
        const subjectExpression = this._parseTestOrStarListAsExpression(
        /* allowAssignmentExpression */ true, 
        /* allowMultipleUnpack */ true, 12 /* ErrorExpressionCategory.MissingPatternSubject */, () => localize_1.LocMessage.expectedReturnExpr());
        const matchNode = parseNodes_1.MatchNode.create(matchToken, subjectExpression);
        const nextToken = this._peekToken();
        if (!this._consumeTokenIfType(10 /* TokenType.Colon */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedColon(), nextToken);
            // Try to perform parse recovery by consuming tokens until
            // we find the end of the line.
            if (this._consumeTokensUntilType([2 /* TokenType.NewLine */, 10 /* TokenType.Colon */])) {
                this._getNextToken();
            }
        }
        else {
            (0, parseNodes_1.extendRange)(matchNode, nextToken);
            if (!this._consumeTokenIfType(2 /* TokenType.NewLine */)) {
                this._addSyntaxError(localize_1.LocMessage.expectedNewline(), nextToken);
            }
            else {
                const possibleIndent = this._peekToken();
                if (!this._consumeTokenIfType(3 /* TokenType.Indent */)) {
                    this._addSyntaxError(localize_1.LocMessage.expectedIndentedBlock(), this._peekToken());
                }
                else {
                    const indentToken = possibleIndent;
                    if (indentToken.isIndentAmbiguous) {
                        this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), indentToken);
                    }
                }
                while (true) {
                    // Handle a common error here and see if we can recover.
                    const possibleUnexpectedIndent = this._peekToken();
                    if (possibleUnexpectedIndent.type === 3 /* TokenType.Indent */) {
                        this._getNextToken();
                        const indentToken = possibleUnexpectedIndent;
                        if (indentToken.isIndentAmbiguous) {
                            this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), indentToken);
                        }
                        else {
                            this._addSyntaxError(localize_1.LocMessage.unexpectedIndent(), possibleUnexpectedIndent);
                        }
                    }
                    const caseStatement = this._parseCaseStatement();
                    if (!caseStatement) {
                        // Perform basic error recovery to get to the next line.
                        if (this._consumeTokensUntilType([2 /* TokenType.NewLine */, 10 /* TokenType.Colon */])) {
                            this._getNextToken();
                        }
                    }
                    else {
                        caseStatement.parent = matchNode;
                        matchNode.cases.push(caseStatement);
                    }
                    const dedentToken = this._peekToken();
                    if (this._consumeTokenIfType(4 /* TokenType.Dedent */)) {
                        if (!dedentToken.matchesIndent) {
                            this._addSyntaxError(localize_1.LocMessage.inconsistentIndent(), dedentToken);
                        }
                        if (dedentToken.isDedentAmbiguous) {
                            this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), dedentToken);
                        }
                        break;
                    }
                    if (this._peekTokenType() === 1 /* TokenType.EndOfStream */) {
                        break;
                    }
                }
            }
            if (matchNode.cases.length > 0) {
                (0, parseNodes_1.extendRange)(matchNode, matchNode.cases[matchNode.cases.length - 1]);
            }
            else {
                this._addSyntaxError(localize_1.LocMessage.zeroCaseStatementsFound(), matchToken);
            }
        }
        // This feature requires Python 3.10.
        if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_10)) {
            this._addSyntaxError(localize_1.LocMessage.matchIncompatible(), matchToken);
        }
        // Validate that only the last entry uses an irrefutable pattern.
        for (let i = 0; i < matchNode.cases.length - 1; i++) {
            const caseNode = matchNode.cases[i];
            if (!caseNode.guardExpression && caseNode.isIrrefutable) {
                this._addSyntaxError(localize_1.LocMessage.casePatternIsIrrefutable(), caseNode.pattern);
            }
        }
        return matchNode;
    }
    // case_block: "case" patterns [guard] ':' block
    // patterns: sequence_pattern | as_pattern
    // guard: 'if' named_expression
    _parseCaseStatement() {
        const caseToken = this._peekToken();
        if (!this._consumeTokenIfKeyword(6 /* KeywordType.Case */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedCase(), caseToken);
            return undefined;
        }
        const patternList = this._parsePatternSequence();
        let casePattern;
        if (patternList.parseError) {
            casePattern = patternList.parseError;
        }
        else if (patternList.list.length === 0) {
            this._addSyntaxError(localize_1.LocMessage.expectedPatternExpr(), this._peekToken());
            casePattern = parseNodes_1.ErrorNode.create(caseToken, 11 /* ErrorExpressionCategory.MissingPattern */);
        }
        else if (patternList.list.length === 1 && !patternList.trailingComma) {
            const pattern = patternList.list[0].orPatterns[0];
            if (pattern.nodeType === 69 /* ParseNodeType.PatternCapture */ && pattern.isStar) {
                casePattern = parseNodes_1.PatternSequenceNode.create(patternList.list[0], patternList.list);
            }
            else {
                casePattern = patternList.list[0];
            }
        }
        else {
            casePattern = parseNodes_1.PatternSequenceNode.create(patternList.list[0], patternList.list);
        }
        if (casePattern.nodeType !== 0 /* ParseNodeType.Error */) {
            const globalNameMap = new Map();
            const localNameMap = new Map();
            this._reportDuplicatePatternCaptureTargets(casePattern, globalNameMap, localNameMap);
        }
        let guardExpression;
        if (this._consumeTokenIfKeyword(20 /* KeywordType.If */)) {
            guardExpression = this._parseTestExpression(/* allowAssignmentExpression */ true);
        }
        const suite = this._parseSuite(this._isInFunction);
        return parseNodes_1.CaseNode.create(caseToken, casePattern, this._isPatternIrrefutable(casePattern), guardExpression, suite);
    }
    // PEP 634 defines the concept of an "irrefutable" pattern - a pattern that
    // will always be matched.
    _isPatternIrrefutable(node) {
        if (node.nodeType === 69 /* ParseNodeType.PatternCapture */) {
            return true;
        }
        if (node.nodeType === 66 /* ParseNodeType.PatternAs */) {
            return node.orPatterns.some((pattern) => this._isPatternIrrefutable(pattern));
        }
        return false;
    }
    // Reports any situations where a capture target (a variable that receives part of a pattern)
    // appears twice within the same pattern. This is complicated by the fact that duplicate targets
    // are allowed in separate "or" clauses, so we need to track the targets we've seen globally
    // as well as the targets we've seen locally within the current "or" clause.
    _reportDuplicatePatternCaptureTargets(node, globalNameMap, localNameMap) {
        const reportTargetIfDuplicate = (nameNode) => {
            if (globalNameMap.has(nameNode.value) || localNameMap.has(nameNode.value)) {
                this._addSyntaxError(localize_1.LocMessage.duplicateCapturePatternTarget().format({
                    name: nameNode.value,
                }), nameNode);
            }
            else {
                localNameMap.set(nameNode.value, nameNode);
            }
        };
        switch (node.nodeType) {
            case 65 /* ParseNodeType.PatternSequence */: {
                node.entries.forEach((subpattern) => {
                    this._reportDuplicatePatternCaptureTargets(subpattern, globalNameMap, localNameMap);
                });
                break;
            }
            case 68 /* ParseNodeType.PatternClass */: {
                node.arguments.forEach((arg) => {
                    this._reportDuplicatePatternCaptureTargets(arg.pattern, globalNameMap, localNameMap);
                });
                break;
            }
            case 66 /* ParseNodeType.PatternAs */: {
                if (node.target) {
                    reportTargetIfDuplicate(node.target);
                }
                const orLocalNameMaps = node.orPatterns.map((subpattern) => {
                    const orLocalNameMap = new Map();
                    this._reportDuplicatePatternCaptureTargets(subpattern, localNameMap, orLocalNameMap);
                    return orLocalNameMap;
                });
                const combinedLocalOrNameMap = new Map();
                orLocalNameMaps.forEach((orLocalNameMap) => {
                    orLocalNameMap.forEach((node) => {
                        if (!combinedLocalOrNameMap.has(node.value)) {
                            combinedLocalOrNameMap.set(node.value, node);
                            reportTargetIfDuplicate(node);
                        }
                    });
                });
                break;
            }
            case 69 /* ParseNodeType.PatternCapture */: {
                if (!node.isWildcard) {
                    reportTargetIfDuplicate(node.target);
                }
                break;
            }
            case 70 /* ParseNodeType.PatternMapping */: {
                node.entries.forEach((mapEntry) => {
                    if (mapEntry.nodeType === 72 /* ParseNodeType.PatternMappingExpandEntry */) {
                        reportTargetIfDuplicate(mapEntry.target);
                    }
                    else {
                        this._reportDuplicatePatternCaptureTargets(mapEntry.keyPattern, globalNameMap, localNameMap);
                        this._reportDuplicatePatternCaptureTargets(mapEntry.valuePattern, globalNameMap, localNameMap);
                    }
                });
                break;
            }
            case 67 /* ParseNodeType.PatternLiteral */:
            case 73 /* ParseNodeType.PatternValue */:
            case 0 /* ParseNodeType.Error */: {
                break;
            }
        }
    }
    _getPatternTargetNames(node, nameSet) {
        switch (node.nodeType) {
            case 65 /* ParseNodeType.PatternSequence */: {
                node.entries.forEach((subpattern) => {
                    this._getPatternTargetNames(subpattern, nameSet);
                });
                break;
            }
            case 68 /* ParseNodeType.PatternClass */: {
                node.arguments.forEach((arg) => {
                    this._getPatternTargetNames(arg.pattern, nameSet);
                });
                break;
            }
            case 66 /* ParseNodeType.PatternAs */: {
                if (node.target) {
                    nameSet.add(node.target.value);
                }
                node.orPatterns.forEach((subpattern) => {
                    this._getPatternTargetNames(subpattern, nameSet);
                });
                break;
            }
            case 69 /* ParseNodeType.PatternCapture */: {
                if (!node.isWildcard) {
                    nameSet.add(node.target.value);
                }
                break;
            }
            case 70 /* ParseNodeType.PatternMapping */: {
                node.entries.forEach((mapEntry) => {
                    if (mapEntry.nodeType === 72 /* ParseNodeType.PatternMappingExpandEntry */) {
                        nameSet.add(mapEntry.target.value);
                    }
                    else {
                        this._getPatternTargetNames(mapEntry.keyPattern, nameSet);
                        this._getPatternTargetNames(mapEntry.valuePattern, nameSet);
                    }
                });
                break;
            }
            case 67 /* ParseNodeType.PatternLiteral */:
            case 73 /* ParseNodeType.PatternValue */:
            case 0 /* ParseNodeType.Error */: {
                break;
            }
        }
    }
    _parsePatternSequence() {
        const patternList = this._parseExpressionListGeneric(() => this._parsePatternAs());
        // Check for more than one star entry.
        const starEntries = patternList.list.filter((entry) => entry.orPatterns.length === 1 &&
            entry.orPatterns[0].nodeType === 69 /* ParseNodeType.PatternCapture */ &&
            entry.orPatterns[0].isStar);
        if (starEntries.length > 1) {
            this._addSyntaxError(localize_1.LocMessage.duplicateStarPattern(), starEntries[1].orPatterns[0]);
        }
        return patternList;
    }
    // as_pattern: or_pattern ['as' NAME]
    // or_pattern: '|'.pattern_atom+
    _parsePatternAs() {
        const orPatterns = [];
        while (true) {
            const patternAtom = this._parsePatternAtom();
            orPatterns.push(patternAtom);
            if (!this._consumeTokenIfOperator(6 /* OperatorType.BitwiseOr */)) {
                break;
            }
        }
        if (orPatterns.length > 1) {
            // Star patterns cannot be ORed with other patterns.
            orPatterns.forEach((patternAtom) => {
                if (patternAtom.nodeType === 69 /* ParseNodeType.PatternCapture */ && patternAtom.isStar) {
                    this._addSyntaxError(localize_1.LocMessage.starPatternInOrPattern(), patternAtom);
                }
            });
        }
        let target;
        if (this._consumeTokenIfKeyword(1 /* KeywordType.As */)) {
            const nameToken = this._getTokenIfIdentifier();
            if (nameToken) {
                target = parseNodes_1.NameNode.create(nameToken);
            }
            else {
                this._addSyntaxError(localize_1.LocMessage.expectedNameAfterAs(), this._peekToken());
            }
        }
        // Star patterns cannot be used with AS pattern.
        if (target &&
            orPatterns.length === 1 &&
            orPatterns[0].nodeType === 69 /* ParseNodeType.PatternCapture */ &&
            orPatterns[0].isStar) {
            this._addSyntaxError(localize_1.LocMessage.starPatternInAsPattern(), orPatterns[0]);
        }
        // Validate that irrefutable patterns are not in any entries other than the last.
        orPatterns.forEach((orPattern, index) => {
            if (index < orPatterns.length - 1 && this._isPatternIrrefutable(orPattern)) {
                this._addSyntaxError(localize_1.LocMessage.orPatternIrrefutable(), orPattern);
            }
        });
        // Validate that all bound variables are the same within all or patterns.
        const fullNameSet = new Set();
        orPatterns.forEach((orPattern) => {
            this._getPatternTargetNames(orPattern, fullNameSet);
        });
        orPatterns.forEach((orPattern) => {
            const localNameSet = new Set();
            this._getPatternTargetNames(orPattern, localNameSet);
            if (localNameSet.size < fullNameSet.size) {
                const missingNames = Array.from(fullNameSet.keys()).filter((name) => !localNameSet.has(name));
                const diag = new diagnostic_1.DiagnosticAddendum();
                diag.addMessage(localize_1.LocAddendum.orPatternMissingName().format({
                    name: missingNames.map((name) => `"${name}"`).join(', '),
                }));
                this._addSyntaxError(localize_1.LocMessage.orPatternMissingName() + diag.getString(), orPattern);
            }
        });
        return parseNodes_1.PatternAsNode.create(orPatterns, target);
    }
    // pattern_atom:
    //     | literal_pattern
    //     | name_or_attr
    //     | '(' as_pattern ')'
    //     | '[' [sequence_pattern] ']'
    //     | '(' [sequence_pattern] ')'
    //     | '{' [items_pattern] '}'
    //     | name_or_attr '(' [pattern_arguments ','?] ')'
    // name_or_attr: attr | NAME
    // attr: name_or_attr '.' NAME
    // sequence_pattern: ','.maybe_star_pattern+ ','?
    // maybe_star_pattern: '*' NAME | pattern
    // items_pattern: ','.key_value_pattern+ ','?
    _parsePatternAtom() {
        const patternLiteral = this._parsePatternLiteral();
        if (patternLiteral) {
            return patternLiteral;
        }
        const patternCaptureOrValue = this._parsePatternCaptureOrValue();
        if (patternCaptureOrValue) {
            const openParenToken = this._peekToken();
            if (patternCaptureOrValue.nodeType === 0 /* ParseNodeType.Error */ ||
                !this._consumeTokenIfType(13 /* TokenType.OpenParenthesis */)) {
                return patternCaptureOrValue;
            }
            const args = this._parseClassPatternArgList();
            const classNameExpr = patternCaptureOrValue.nodeType === 69 /* ParseNodeType.PatternCapture */
                ? patternCaptureOrValue.target
                : patternCaptureOrValue.expression;
            const classPattern = parseNodes_1.PatternClassNode.create(classNameExpr, args);
            if (!this._consumeTokenIfType(14 /* TokenType.CloseParenthesis */)) {
                this._addSyntaxError(localize_1.LocMessage.expectedCloseParen(), openParenToken);
                // Consume the remainder of tokens on the line for error
                // recovery.
                this._consumeTokensUntilType([2 /* TokenType.NewLine */]);
                // Extend the node's range to include the rest of the line.
                // This helps the signatureHelpProvider.
                (0, parseNodes_1.extendRange)(classPattern, this._peekToken());
            }
            return classPattern;
        }
        const nextToken = this._peekToken();
        const nextOperator = this._peekOperatorType();
        if (nextOperator === 26 /* OperatorType.Multiply */) {
            const starToken = this._getNextToken();
            const identifierToken = this._getTokenIfIdentifier();
            if (!identifierToken) {
                this._addSyntaxError(localize_1.LocMessage.expectedIdentifier(), this._peekToken());
                return parseNodes_1.ErrorNode.create(starToken, 2 /* ErrorExpressionCategory.MissingExpression */);
            }
            else {
                return parseNodes_1.PatternCaptureNode.create(parseNodes_1.NameNode.create(identifierToken), starToken);
            }
        }
        if (nextToken.type === 13 /* TokenType.OpenParenthesis */ || nextToken.type === 15 /* TokenType.OpenBracket */) {
            const startToken = this._getNextToken();
            const patternList = this._parsePatternSequence();
            let casePattern;
            if (patternList.parseError) {
                casePattern = patternList.parseError;
            }
            else if (patternList.list.length === 1 &&
                !patternList.trailingComma &&
                startToken.type === 13 /* TokenType.OpenParenthesis */) {
                const pattern = patternList.list[0].orPatterns[0];
                if (pattern.nodeType === 69 /* ParseNodeType.PatternCapture */ && pattern.isStar) {
                    casePattern = parseNodes_1.PatternSequenceNode.create(startToken, patternList.list);
                }
                else {
                    casePattern = patternList.list[0];
                }
                (0, parseNodes_1.extendRange)(casePattern, nextToken);
            }
            else {
                casePattern = parseNodes_1.PatternSequenceNode.create(startToken, patternList.list);
            }
            const endToken = this._peekToken();
            if (this._consumeTokenIfType(nextToken.type === 13 /* TokenType.OpenParenthesis */ ? 14 /* TokenType.CloseParenthesis */ : 16 /* TokenType.CloseBracket */)) {
                (0, parseNodes_1.extendRange)(casePattern, endToken);
            }
            else {
                this._addSyntaxError(nextToken.type === 13 /* TokenType.OpenParenthesis */
                    ? localize_1.LocMessage.expectedCloseParen()
                    : localize_1.LocMessage.expectedCloseBracket(), nextToken);
                this._consumeTokensUntilType([
                    10 /* TokenType.Colon */,
                    nextToken.type === 13 /* TokenType.OpenParenthesis */ ? 14 /* TokenType.CloseParenthesis */ : 16 /* TokenType.CloseBracket */,
                ]);
            }
            return casePattern;
        }
        else if (nextToken.type === 17 /* TokenType.OpenCurlyBrace */) {
            const firstToken = this._getNextToken();
            const mappingPattern = this._parsePatternMapping(firstToken);
            const lastToken = this._peekToken();
            if (this._consumeTokenIfType(18 /* TokenType.CloseCurlyBrace */)) {
                (0, parseNodes_1.extendRange)(mappingPattern, lastToken);
            }
            else {
                this._addSyntaxError(localize_1.LocMessage.expectedCloseBrace(), nextToken);
                this._consumeTokensUntilType([10 /* TokenType.Colon */, 18 /* TokenType.CloseCurlyBrace */]);
            }
            return mappingPattern;
        }
        return this._handleExpressionParseError(11 /* ErrorExpressionCategory.MissingPattern */, localize_1.LocMessage.expectedPatternExpr());
    }
    // pattern_arguments:
    //     | positional_patterns [',' keyword_patterns]
    //     | keyword_patterns
    // positional_patterns: ','.as_pattern+
    // keyword_patterns: ','.keyword_pattern+
    _parseClassPatternArgList() {
        const argList = [];
        let sawKeywordArg = false;
        while (true) {
            const nextTokenType = this._peekTokenType();
            if (nextTokenType === 14 /* TokenType.CloseParenthesis */ ||
                nextTokenType === 2 /* TokenType.NewLine */ ||
                nextTokenType === 1 /* TokenType.EndOfStream */) {
                break;
            }
            const arg = this._parseClassPatternArgument();
            if (arg.name) {
                sawKeywordArg = true;
            }
            else if (sawKeywordArg && !arg.name) {
                this._addSyntaxError(localize_1.LocMessage.positionArgAfterNamedArg(), arg);
            }
            argList.push(arg);
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                break;
            }
        }
        return argList;
    }
    // keyword_pattern: NAME '=' as_pattern
    _parseClassPatternArgument() {
        const firstToken = this._peekToken();
        const secondToken = this._peekToken(1);
        let keywordName;
        if ((firstToken.type === 7 /* TokenType.Identifier */ || firstToken.type === 8 /* TokenType.Keyword */) &&
            secondToken.type === 9 /* TokenType.Operator */ &&
            secondToken.operatorType === 2 /* OperatorType.Assign */) {
            const classNameToken = this._getTokenIfIdentifier();
            if (classNameToken !== undefined) {
                keywordName = parseNodes_1.NameNode.create(classNameToken);
                this._getNextToken();
            }
        }
        const pattern = this._parsePatternAs();
        return parseNodes_1.PatternClassArgumentNode.create(pattern, keywordName);
    }
    // literal_pattern:
    //     | signed_number
    //     | signed_number '+' NUMBER
    //     | signed_number '-' NUMBER
    //     | strings
    //     | 'None'
    //     | 'True'
    //     | 'False'
    _parsePatternLiteral() {
        const nextToken = this._peekToken();
        const nextOperator = this._peekOperatorType();
        if (nextToken.type === 6 /* TokenType.Number */ || nextOperator === 33 /* OperatorType.Subtract */) {
            return this._parsePatternLiteralNumber();
        }
        if (nextToken.type === 5 /* TokenType.String */) {
            const stringList = this._parseAtom();
            (0, debug_1.assert)(stringList.nodeType === 48 /* ParseNodeType.StringList */);
            // Check for f-strings, which are not allowed.
            stringList.strings.forEach((stringAtom) => {
                if (stringAtom.nodeType === 30 /* ParseNodeType.FormatString */) {
                    this._addSyntaxError(localize_1.LocMessage.formatStringInPattern(), stringAtom);
                }
            });
            return parseNodes_1.PatternLiteralNode.create(stringList);
        }
        if (nextToken.type === 8 /* TokenType.Keyword */) {
            const keywordToken = nextToken;
            if (keywordToken.keywordType === 15 /* KeywordType.False */ ||
                keywordToken.keywordType === 33 /* KeywordType.True */ ||
                keywordToken.keywordType === 26 /* KeywordType.None */) {
                return parseNodes_1.PatternLiteralNode.create(this._parseAtom());
            }
        }
        return undefined;
    }
    // signed_number: NUMBER | '-' NUMBER
    _parsePatternLiteralNumber() {
        const expression = this._parseArithmeticExpression();
        let realValue;
        let imagValue;
        if (expression.nodeType === 7 /* ParseNodeType.BinaryOperation */) {
            if (expression.operator === 33 /* OperatorType.Subtract */ || expression.operator === 0 /* OperatorType.Add */) {
                realValue = expression.leftExpression;
                imagValue = expression.rightExpression;
            }
        }
        else {
            realValue = expression;
        }
        if (realValue) {
            if (realValue.nodeType === 55 /* ParseNodeType.UnaryOperation */ && realValue.operator === 33 /* OperatorType.Subtract */) {
                realValue = realValue.expression;
            }
            if (realValue.nodeType !== 40 /* ParseNodeType.Number */ || (imagValue !== undefined && realValue.isImaginary)) {
                this._addSyntaxError(localize_1.LocMessage.expectedComplexNumberLiteral(), expression);
                imagValue = undefined;
            }
        }
        if (imagValue) {
            if (imagValue.nodeType === 55 /* ParseNodeType.UnaryOperation */ && imagValue.operator === 33 /* OperatorType.Subtract */) {
                imagValue = imagValue.expression;
            }
            if (imagValue.nodeType !== 40 /* ParseNodeType.Number */ || !imagValue.isImaginary) {
                this._addSyntaxError(localize_1.LocMessage.expectedComplexNumberLiteral(), expression);
            }
        }
        return parseNodes_1.PatternLiteralNode.create(expression);
    }
    _parsePatternMapping(firstToken) {
        const itemList = this._parseExpressionListGeneric(() => this._parsePatternMappingItem());
        if (itemList.list.length > 0) {
            // Verify there's at most one ** entry.
            const starStarEntries = itemList.list.filter((entry) => entry.nodeType === 72 /* ParseNodeType.PatternMappingExpandEntry */);
            if (starStarEntries.length > 1) {
                this._addSyntaxError(localize_1.LocMessage.duplicateStarStarPattern(), starStarEntries[1]);
            }
            return parseNodes_1.PatternMappingNode.create(firstToken, itemList.list);
        }
        return itemList.parseError || parseNodes_1.ErrorNode.create(this._peekToken(), 11 /* ErrorExpressionCategory.MissingPattern */);
    }
    // key_value_pattern:
    //     | (literal_pattern | attr) ':' as_pattern
    //     | '**' NAME
    _parsePatternMappingItem() {
        let keyExpression;
        const doubleStar = this._peekToken();
        if (this._consumeTokenIfOperator(29 /* OperatorType.Power */)) {
            const identifierToken = this._getTokenIfIdentifier();
            if (!identifierToken) {
                this._addSyntaxError(localize_1.LocMessage.expectedIdentifier(), this._peekToken());
                return parseNodes_1.ErrorNode.create(this._peekToken(), 11 /* ErrorExpressionCategory.MissingPattern */);
            }
            const nameNode = parseNodes_1.NameNode.create(identifierToken);
            if (identifierToken.value === '_') {
                this._addSyntaxError(localize_1.LocMessage.starStarWildcardNotAllowed(), nameNode);
            }
            return parseNodes_1.PatternMappingExpandEntryNode.create(doubleStar, nameNode);
        }
        const patternLiteral = this._parsePatternLiteral();
        if (patternLiteral) {
            keyExpression = patternLiteral;
        }
        else {
            const patternCaptureOrValue = this._parsePatternCaptureOrValue();
            if (patternCaptureOrValue) {
                if (patternCaptureOrValue.nodeType === 73 /* ParseNodeType.PatternValue */) {
                    keyExpression = patternCaptureOrValue;
                }
                else {
                    this._addSyntaxError(localize_1.LocMessage.expectedPatternValue(), patternCaptureOrValue);
                    keyExpression = parseNodes_1.ErrorNode.create(this._peekToken(), 11 /* ErrorExpressionCategory.MissingPattern */);
                }
            }
        }
        if (!keyExpression) {
            this._addSyntaxError(localize_1.LocMessage.expectedPatternExpr(), this._peekToken());
            keyExpression = parseNodes_1.ErrorNode.create(this._peekToken(), 11 /* ErrorExpressionCategory.MissingPattern */);
        }
        let valuePattern;
        if (!this._consumeTokenIfType(10 /* TokenType.Colon */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedColon(), this._peekToken());
            valuePattern = parseNodes_1.ErrorNode.create(this._peekToken(), 11 /* ErrorExpressionCategory.MissingPattern */);
        }
        else {
            valuePattern = this._parsePatternAs();
        }
        return parseNodes_1.PatternMappingKeyEntryNode.create(keyExpression, valuePattern);
    }
    _parsePatternCaptureOrValue() {
        const nextToken = this._peekToken();
        if (nextToken.type === 7 /* TokenType.Identifier */ || nextToken.type === 8 /* TokenType.Keyword */) {
            let nameOrMember;
            while (true) {
                const identifierToken = this._getTokenIfIdentifier();
                if (identifierToken) {
                    const nameNode = parseNodes_1.NameNode.create(identifierToken);
                    nameOrMember = nameOrMember ? parseNodes_1.MemberAccessNode.create(nameOrMember, nameNode) : nameNode;
                }
                else {
                    this._addSyntaxError(localize_1.LocMessage.expectedIdentifier(), this._peekToken());
                    break;
                }
                if (!this._consumeTokenIfType(20 /* TokenType.Dot */)) {
                    break;
                }
            }
            if (!nameOrMember) {
                this._addSyntaxError(localize_1.LocMessage.expectedIdentifier(), this._peekToken());
                return parseNodes_1.ErrorNode.create(this._peekToken(), 11 /* ErrorExpressionCategory.MissingPattern */);
            }
            if (nameOrMember.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                return parseNodes_1.PatternValueNode.create(nameOrMember);
            }
            return parseNodes_1.PatternCaptureNode.create(nameOrMember);
        }
        return undefined;
    }
    // if_stmt: 'if' test_suite ('elif' test_suite)* ['else' suite]
    // test_suite: test suite
    // test: or_test ['if' or_test 'else' test] | lambdef
    _parseIfStatement(keywordType = 20 /* KeywordType.If */) {
        const ifOrElifToken = this._getKeywordToken(keywordType);
        const test = this._parseTestExpression(/* allowAssignmentExpression */ true);
        const suite = this._parseSuite(this._isInFunction);
        const ifNode = parseNodes_1.IfNode.create(ifOrElifToken, test, suite);
        if (this._consumeTokenIfKeyword(13 /* KeywordType.Else */)) {
            ifNode.elseSuite = this._parseSuite(this._isInFunction);
            ifNode.elseSuite.parent = ifNode;
            (0, parseNodes_1.extendRange)(ifNode, ifNode.elseSuite);
        }
        else if (this._peekKeywordType() === 12 /* KeywordType.Elif */) {
            // Recursively handle an "elif" statement.
            ifNode.elseSuite = this._parseIfStatement(12 /* KeywordType.Elif */);
            ifNode.elseSuite.parent = ifNode;
            (0, parseNodes_1.extendRange)(ifNode, ifNode.elseSuite);
        }
        return ifNode;
    }
    _parseLoopSuite() {
        const wasInLoop = this._isInLoop;
        const wasInFinally = this._isInFinally;
        this._isInLoop = true;
        this._isInFinally = false;
        let typeComment;
        const suite = this._parseSuite(this._isInFunction, /* skipBody */ false, () => {
            const comment = this._getTypeAnnotationCommentText();
            if (comment) {
                typeComment = comment;
            }
        });
        this._isInLoop = wasInLoop;
        this._isInFinally = wasInFinally;
        if (typeComment) {
            suite.typeComment = typeComment;
        }
        return suite;
    }
    // suite: ':' (simple_stmt | NEWLINE INDENT stmt+ DEDENT)
    _parseSuite(isFunction = false, skipBody = false, postColonCallback) {
        const nextToken = this._peekToken();
        const suite = parseNodes_1.SuiteNode.create(nextToken);
        if (!this._consumeTokenIfType(10 /* TokenType.Colon */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedColon(), nextToken);
            // Try to perform parse recovery by consuming tokens.
            if (this._consumeTokensUntilType([2 /* TokenType.NewLine */, 10 /* TokenType.Colon */])) {
                if (this._peekTokenType() === 10 /* TokenType.Colon */) {
                    this._getNextToken();
                }
                else if (this._peekToken(1).type !== 3 /* TokenType.Indent */) {
                    // Bail so we resume the at the next statement.
                    // We can't parse as a simple statement as we've skipped all but the newline.
                    this._getNextToken();
                    return suite;
                }
            }
        }
        if (skipBody) {
            if (this._consumeTokenIfType(2 /* TokenType.NewLine */)) {
                let indent = 0;
                while (true) {
                    const nextToken = this._getNextToken();
                    if (nextToken.type === 3 /* TokenType.Indent */) {
                        indent++;
                    }
                    if (nextToken.type === 4 /* TokenType.Dedent */) {
                        if (nextToken.isDedentAmbiguous) {
                            this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), nextToken);
                        }
                        indent--;
                        if (indent === 0) {
                            break;
                        }
                    }
                    if (nextToken.type === 1 /* TokenType.EndOfStream */) {
                        break;
                    }
                }
            }
            else {
                // consume tokens
                this._parseSimpleStatement();
            }
            if (this._tokenIndex > 0) {
                (0, parseNodes_1.extendRange)(suite, this._tokenizerOutput.tokens.getItemAt(this._tokenIndex - 1));
            }
            return suite;
        }
        if (postColonCallback) {
            postColonCallback();
        }
        const wasFunction = this._isInFunction;
        this._isInFunction = isFunction;
        if (this._consumeTokenIfType(2 /* TokenType.NewLine */)) {
            if (postColonCallback) {
                postColonCallback();
            }
            const possibleIndent = this._peekToken();
            if (!this._consumeTokenIfType(3 /* TokenType.Indent */)) {
                this._addSyntaxError(localize_1.LocMessage.expectedIndentedBlock(), this._peekToken());
                return suite;
            }
            const bodyIndentToken = possibleIndent;
            if (bodyIndentToken.isIndentAmbiguous) {
                this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), bodyIndentToken);
            }
            while (true) {
                // Handle a common error here and see if we can recover.
                const nextToken = this._peekToken();
                if (nextToken.type === 3 /* TokenType.Indent */) {
                    this._getNextToken();
                    const indentToken = nextToken;
                    if (indentToken.isIndentAmbiguous) {
                        this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), indentToken);
                    }
                    else {
                        this._addSyntaxError(localize_1.LocMessage.unexpectedIndent(), nextToken);
                    }
                }
                else if (nextToken.type === 4 /* TokenType.Dedent */) {
                    // When we see a dedent, stop before parsing the dedented statement.
                    const dedentToken = nextToken;
                    if (!dedentToken.matchesIndent) {
                        this._addSyntaxError(localize_1.LocMessage.inconsistentIndent(), dedentToken);
                    }
                    if (dedentToken.isDedentAmbiguous) {
                        this._addSyntaxError(localize_1.LocMessage.inconsistentTabs(), dedentToken);
                    }
                    // When the suite is incomplete (no statements), leave the dedent token for
                    // recovery. This allows a single dedent token to cause us to break out of
                    // multiple levels of nested suites. Also extend the suite's range in this
                    // case so it is multi-line as this works better with indentationUtils.
                    if (suite.statements.length > 0) {
                        this._consumeTokenIfType(4 /* TokenType.Dedent */);
                    }
                    else {
                        (0, parseNodes_1.extendRange)(suite, dedentToken);
                    }
                    // Did this dedent take us to an indent amount that is less than the
                    // initial indent of the suite body?
                    if (!bodyIndentToken || dedentToken.indentAmount < bodyIndentToken.indentAmount) {
                        break;
                    }
                    else if (dedentToken.indentAmount === bodyIndentToken.indentAmount) {
                        // If the next token is also a dedent that reduces the indent
                        // level to a less than the initial indent of the suite body, swallow
                        // the extra dedent to help recover the parse.
                        const nextToken = this._peekToken();
                        if (this._consumeTokenIfType(4 /* TokenType.Dedent */)) {
                            (0, parseNodes_1.extendRange)(suite, nextToken);
                            break;
                        }
                    }
                }
                const statement = this._parseStatement();
                if (!statement) {
                    // Perform basic error recovery to get to the next line.
                    this._consumeTokensUntilType([2 /* TokenType.NewLine */]);
                }
                else {
                    statement.parent = suite;
                    suite.statements.push(statement);
                }
                if (this._peekTokenType() === 1 /* TokenType.EndOfStream */) {
                    break;
                }
            }
        }
        else {
            const simpleStatement = this._parseSimpleStatement();
            suite.statements.push(simpleStatement);
            simpleStatement.parent = suite;
        }
        if (suite.statements.length > 0) {
            (0, parseNodes_1.extendRange)(suite, suite.statements[suite.statements.length - 1]);
        }
        this._isInFunction = wasFunction;
        return suite;
    }
    // for_stmt: [async] 'for' exprlist 'in' testlist suite ['else' suite]
    _parseForStatement(asyncToken) {
        const forToken = this._getKeywordToken(17 /* KeywordType.For */);
        const targetExpr = this._parseExpressionListAsPossibleTuple(2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedExpr(), forToken);
        let seqExpr;
        let forSuite;
        let elseSuite;
        if (!this._consumeTokenIfKeyword(22 /* KeywordType.In */)) {
            seqExpr = this._handleExpressionParseError(0 /* ErrorExpressionCategory.MissingIn */, localize_1.LocMessage.expectedIn());
            forSuite = parseNodes_1.SuiteNode.create(this._peekToken());
        }
        else {
            seqExpr = this._parseTestOrStarListAsExpression(
            /* allowAssignmentExpression */ false, 
            /* allowMultipleUnpack */ true, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedInExpr());
            forSuite = this._parseLoopSuite();
            // Versions of Python earlier than 3.9 didn't allow unpack operators if the
            // tuple wasn't enclosed in parentheses.
            if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_9) && !this._parseOptions.isStubFile) {
                if (seqExpr.nodeType === 52 /* ParseNodeType.Tuple */ && !seqExpr.enclosedInParens) {
                    let sawStar = false;
                    seqExpr.expressions.forEach((expr) => {
                        if (expr.nodeType === 56 /* ParseNodeType.Unpack */ && !sawStar) {
                            this._addSyntaxError(localize_1.LocMessage.unpackOperatorNotAllowed(), expr);
                            sawStar = true;
                        }
                    });
                }
            }
            if (this._consumeTokenIfKeyword(13 /* KeywordType.Else */)) {
                elseSuite = this._parseSuite(this._isInFunction);
            }
        }
        const forNode = parseNodes_1.ForNode.create(forToken, targetExpr, seqExpr, forSuite);
        forNode.elseSuite = elseSuite;
        if (elseSuite) {
            (0, parseNodes_1.extendRange)(forNode, elseSuite);
            elseSuite.parent = forNode;
        }
        if (asyncToken) {
            forNode.isAsync = true;
            forNode.asyncToken = asyncToken;
            (0, parseNodes_1.extendRange)(forNode, asyncToken);
        }
        if (forSuite.typeComment) {
            forNode.typeComment = forSuite.typeComment;
        }
        return forNode;
    }
    // comp_iter: comp_for | comp_if
    _tryParseComprehension(target, isGenerator) {
        const compFor = this._tryParseCompForStatement();
        if (!compFor) {
            return undefined;
        }
        if (target.nodeType === 56 /* ParseNodeType.Unpack */) {
            this._addSyntaxError(localize_1.LocMessage.unpackIllegalInComprehension(), target);
        }
        else if (target.nodeType === 19 /* ParseNodeType.DictionaryExpandEntry */) {
            this._addSyntaxError(localize_1.LocMessage.dictExpandIllegalInComprehension(), target);
        }
        const compNode = parseNodes_1.ComprehensionNode.create(target, isGenerator);
        const forIfList = [compFor];
        while (true) {
            const compIter = this._tryParseCompForStatement() || this._tryParseCompIfStatement();
            if (!compIter) {
                break;
            }
            compIter.parent = compNode;
            forIfList.push(compIter);
        }
        compNode.forIfNodes = forIfList;
        if (forIfList.length > 0) {
            forIfList.forEach((comp) => {
                comp.parent = compNode;
            });
            (0, parseNodes_1.extendRange)(compNode, forIfList[forIfList.length - 1]);
        }
        return compNode;
    }
    // comp_for: ['async'] 'for' exprlist 'in' or_test [comp_iter]
    _tryParseCompForStatement() {
        const startTokenKeywordType = this._peekKeywordType();
        if (startTokenKeywordType === 3 /* KeywordType.Async */) {
            const nextToken = this._peekToken(1);
            if (nextToken.type !== 8 /* TokenType.Keyword */ || nextToken.keywordType !== 17 /* KeywordType.For */) {
                return undefined;
            }
        }
        else if (startTokenKeywordType !== 17 /* KeywordType.For */) {
            return undefined;
        }
        let asyncToken;
        if (this._peekKeywordType() === 3 /* KeywordType.Async */) {
            asyncToken = this._getKeywordToken(3 /* KeywordType.Async */);
        }
        const forToken = this._getKeywordToken(17 /* KeywordType.For */);
        const targetExpr = this._parseExpressionListAsPossibleTuple(2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedExpr(), forToken);
        let seqExpr;
        if (!this._consumeTokenIfKeyword(22 /* KeywordType.In */)) {
            seqExpr = this._handleExpressionParseError(0 /* ErrorExpressionCategory.MissingIn */, localize_1.LocMessage.expectedIn());
        }
        else {
            this._disallowAssignmentExpression(() => {
                seqExpr = this._parseOrTest();
            });
        }
        const compForNode = parseNodes_1.ComprehensionForNode.create(asyncToken || forToken, targetExpr, seqExpr);
        if (asyncToken) {
            compForNode.isAsync = true;
            compForNode.asyncToken = asyncToken;
        }
        return compForNode;
    }
    // comp_if: 'if' test_nocond [comp_iter]
    // comp_iter: comp_for | comp_if
    _tryParseCompIfStatement() {
        if (this._peekKeywordType() !== 20 /* KeywordType.If */) {
            return undefined;
        }
        const ifToken = this._getKeywordToken(20 /* KeywordType.If */);
        const ifExpr = this._tryParseLambdaExpression() ||
            this._parseAssignmentExpression(/* disallowAssignmentExpression */ true);
        const compIfNode = parseNodes_1.ComprehensionIfNode.create(ifToken, ifExpr);
        return compIfNode;
    }
    // while_stmt: 'while' test suite ['else' suite]
    _parseWhileStatement() {
        const whileToken = this._getKeywordToken(36 /* KeywordType.While */);
        const whileNode = parseNodes_1.WhileNode.create(whileToken, this._parseTestExpression(/* allowAssignmentExpression */ true), this._parseLoopSuite());
        if (this._consumeTokenIfKeyword(13 /* KeywordType.Else */)) {
            whileNode.elseSuite = this._parseSuite(this._isInFunction);
            whileNode.elseSuite.parent = whileNode;
            (0, parseNodes_1.extendRange)(whileNode, whileNode.elseSuite);
        }
        return whileNode;
    }
    // try_stmt: ('try' suite
    //         ((except_clause suite)+
    //             ['else' suite]
    //             ['finally' suite] |
    //         'finally' suite))
    // except_clause: 'except' [test ['as' NAME]]
    _parseTryStatement() {
        const tryToken = this._getKeywordToken(34 /* KeywordType.Try */);
        const trySuite = this._parseSuite(this._isInFunction);
        const tryNode = parseNodes_1.TryNode.create(tryToken, trySuite);
        let sawCatchAllExcept = false;
        while (true) {
            const exceptToken = this._peekToken();
            if (!this._consumeTokenIfKeyword(14 /* KeywordType.Except */)) {
                break;
            }
            // See if this is a Python 3.11 exception group.
            const possibleStarToken = this._peekToken();
            let isExceptGroup = false;
            if (this._consumeTokenIfOperator(26 /* OperatorType.Multiply */)) {
                if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_11) && !this._parseOptions.isStubFile) {
                    this._addSyntaxError(localize_1.LocMessage.exceptionGroupIncompatible(), possibleStarToken);
                }
                isExceptGroup = true;
            }
            let typeExpr;
            let symbolName;
            if (this._peekTokenType() !== 10 /* TokenType.Colon */) {
                typeExpr = this._parseTestExpression(/* allowAssignmentExpression */ true);
                if (this._consumeTokenIfKeyword(1 /* KeywordType.As */)) {
                    symbolName = this._getTokenIfIdentifier();
                    if (!symbolName) {
                        this._addSyntaxError(localize_1.LocMessage.expectedNameAfterAs(), this._peekToken());
                    }
                }
                else {
                    // Handle the python 2.x syntax in a graceful manner.
                    const peekToken = this._peekToken();
                    if (this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                        this._addSyntaxError(localize_1.LocMessage.expectedAsAfterException(), peekToken);
                        // Parse the expression expected in python 2.x, but discard it.
                        this._parseTestExpression(/* allowAssignmentExpression */ false);
                    }
                }
            }
            if (!typeExpr) {
                if (sawCatchAllExcept) {
                    this._addSyntaxError(localize_1.LocMessage.duplicateCatchAll(), exceptToken);
                }
                sawCatchAllExcept = true;
            }
            else {
                if (sawCatchAllExcept) {
                    this._addSyntaxError(localize_1.LocMessage.namedExceptAfterCatchAll(), typeExpr);
                }
            }
            const exceptSuite = this._parseSuite(this._isInFunction);
            const exceptNode = parseNodes_1.ExceptNode.create(exceptToken, exceptSuite, isExceptGroup);
            if (typeExpr) {
                exceptNode.typeExpression = typeExpr;
                exceptNode.typeExpression.parent = exceptNode;
            }
            if (symbolName) {
                exceptNode.name = parseNodes_1.NameNode.create(symbolName);
                exceptNode.name.parent = exceptNode;
            }
            tryNode.exceptClauses.push(exceptNode);
            exceptNode.parent = tryNode;
        }
        if (tryNode.exceptClauses.length > 0) {
            (0, parseNodes_1.extendRange)(tryNode, tryNode.exceptClauses[tryNode.exceptClauses.length - 1]);
            if (this._consumeTokenIfKeyword(13 /* KeywordType.Else */)) {
                tryNode.elseSuite = this._parseSuite(this._isInFunction);
                tryNode.elseSuite.parent = tryNode;
                (0, parseNodes_1.extendRange)(tryNode, tryNode.elseSuite);
            }
        }
        if (this._consumeTokenIfKeyword(16 /* KeywordType.Finally */)) {
            tryNode.finallySuite = this._parseSuite(this._isInFunction);
            tryNode.finallySuite.parent = tryNode;
            (0, parseNodes_1.extendRange)(tryNode, tryNode.finallySuite);
        }
        if (!tryNode.finallySuite && tryNode.exceptClauses.length === 0) {
            this._addSyntaxError(localize_1.LocMessage.tryWithoutExcept(), tryToken);
        }
        return tryNode;
    }
    // funcdef: 'def' NAME parameters ['->' test] ':' suite
    // parameters: '(' [typedargslist] ')'
    _parseFunctionDef(asyncToken, decorators) {
        const defToken = this._getKeywordToken(10 /* KeywordType.Def */);
        const nameToken = this._getTokenIfIdentifier();
        if (!nameToken) {
            this._addSyntaxError(localize_1.LocMessage.expectedFunctionName(), defToken);
            return parseNodes_1.ErrorNode.create(defToken, 10 /* ErrorExpressionCategory.MissingFunctionParameterList */, undefined, decorators);
        }
        let typeParameters;
        const possibleOpenBracket = this._peekToken();
        if (possibleOpenBracket.type === 15 /* TokenType.OpenBracket */) {
            typeParameters = this._parseTypeParameterList();
            if (!this._parseOptions.isStubFile && this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_12)) {
                this._addSyntaxError(localize_1.LocMessage.functionTypeParametersIllegal(), typeParameters);
            }
        }
        const openParenToken = this._peekToken();
        if (!this._consumeTokenIfType(13 /* TokenType.OpenParenthesis */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedOpenParen(), this._peekToken());
            return parseNodes_1.ErrorNode.create(nameToken, 10 /* ErrorExpressionCategory.MissingFunctionParameterList */, parseNodes_1.NameNode.create(nameToken), decorators);
        }
        const paramList = this._parseVarArgsList(14 /* TokenType.CloseParenthesis */, /* allowAnnotations */ true);
        if (!this._consumeTokenIfType(14 /* TokenType.CloseParenthesis */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedCloseParen(), openParenToken);
            this._consumeTokensUntilType([10 /* TokenType.Colon */]);
        }
        let returnType;
        if (this._consumeTokenIfType(21 /* TokenType.Arrow */)) {
            returnType = this._parseTypeAnnotation();
        }
        let functionTypeAnnotationToken;
        const suite = this._parseSuite(/* isFunction */ true, this._parseOptions.skipFunctionAndClassBody, () => {
            if (!functionTypeAnnotationToken) {
                functionTypeAnnotationToken = this._getTypeAnnotationCommentText();
            }
        });
        const functionNode = parseNodes_1.FunctionNode.create(defToken, parseNodes_1.NameNode.create(nameToken), suite, typeParameters);
        if (asyncToken) {
            functionNode.isAsync = true;
            (0, parseNodes_1.extendRange)(functionNode, asyncToken);
        }
        functionNode.parameters = paramList;
        paramList.forEach((param) => {
            param.parent = functionNode;
        });
        if (decorators) {
            functionNode.decorators = decorators;
            decorators.forEach((decorator) => {
                decorator.parent = functionNode;
            });
            if (decorators.length > 0) {
                (0, parseNodes_1.extendRange)(functionNode, decorators[0]);
            }
        }
        if (returnType) {
            functionNode.returnTypeAnnotation = returnType;
            functionNode.returnTypeAnnotation.parent = functionNode;
            (0, parseNodes_1.extendRange)(functionNode, returnType);
        }
        // If there was a type annotation comment for the function,
        // parse it now.
        if (functionTypeAnnotationToken) {
            this._parseFunctionTypeAnnotationComment(functionTypeAnnotationToken, functionNode);
        }
        return functionNode;
    }
    // typedargslist: (
    //   tfpdef ['=' test] (',' tfpdef ['=' test])*
    //      [ ','
    //          [
    //              '*' [tfpdef] (',' tfpdef ['=' test])* [',' ['**' tfpdef [',']]]
    //              | '**' tfpdef [',']
    //          ]
    //      ]
    //   | '*' [tfpdef] (',' tfpdef ['=' test])* [',' ['**' tfpdef [',']]]
    //   | '**' tfpdef [','])
    // tfpdef: NAME [':' test]
    // vfpdef: NAME;
    _parseVarArgsList(terminator, allowAnnotations) {
        const paramMap = new Map();
        const paramList = [];
        let sawDefaultParam = false;
        let reportedNonDefaultParamErr = false;
        let sawKeywordOnlySeparator = false;
        let sawPositionOnlySeparator = false;
        let sawKeywordOnlyParamAfterSeparator = false;
        let sawArgs = false;
        let sawKwArgs = false;
        while (true) {
            if (this._peekTokenType() === terminator) {
                break;
            }
            const param = this._parseParameter(allowAnnotations);
            if (!param) {
                this._consumeTokensUntilType([terminator]);
                break;
            }
            if (param.name) {
                const name = param.name.value;
                if (paramMap.has(name)) {
                    this._addSyntaxError(localize_1.LocMessage.duplicateParam().format({ name }), param.name);
                }
                else {
                    paramMap.set(name, name);
                }
            }
            else if (param.category === 0 /* ParameterCategory.Simple */) {
                if (paramList.length === 0) {
                    this._addSyntaxError(localize_1.LocMessage.positionOnlyFirstParam(), param);
                }
            }
            if (param.category === 0 /* ParameterCategory.Simple */) {
                if (!param.name) {
                    if (sawPositionOnlySeparator) {
                        this._addSyntaxError(localize_1.LocMessage.duplicatePositionOnly(), param);
                    }
                    else if (sawKeywordOnlySeparator) {
                        this._addSyntaxError(localize_1.LocMessage.positionOnlyAfterKeywordOnly(), param);
                    }
                    else if (sawArgs) {
                        this._addSyntaxError(localize_1.LocMessage.positionOnlyAfterArgs(), param);
                    }
                    sawPositionOnlySeparator = true;
                }
                else {
                    if (sawKeywordOnlySeparator) {
                        sawKeywordOnlyParamAfterSeparator = true;
                    }
                    if (param.defaultValue) {
                        sawDefaultParam = true;
                    }
                    else if (sawDefaultParam && !sawKeywordOnlySeparator && !sawArgs) {
                        // Report this error only once.
                        if (!reportedNonDefaultParamErr) {
                            this._addSyntaxError(localize_1.LocMessage.nonDefaultAfterDefault(), param);
                            reportedNonDefaultParamErr = true;
                        }
                    }
                }
            }
            paramList.push(param);
            if (param.category === 1 /* ParameterCategory.ArgsList */) {
                if (!param.name) {
                    if (sawKeywordOnlySeparator) {
                        this._addSyntaxError(localize_1.LocMessage.duplicateKeywordOnly(), param);
                    }
                    else if (sawArgs) {
                        this._addSyntaxError(localize_1.LocMessage.keywordOnlyAfterArgs(), param);
                    }
                    sawKeywordOnlySeparator = true;
                }
                else {
                    if (sawKeywordOnlySeparator || sawArgs) {
                        this._addSyntaxError(localize_1.LocMessage.duplicateArgsParam(), param);
                    }
                    sawArgs = true;
                }
            }
            if (param.category === 2 /* ParameterCategory.KwargsDict */) {
                if (sawKwArgs) {
                    this._addSyntaxError(localize_1.LocMessage.duplicateKwargsParam(), param);
                }
                sawKwArgs = true;
                // A **kwargs cannot immediately follow a keyword-only separator ("*").
                if (sawKeywordOnlySeparator && !sawKeywordOnlyParamAfterSeparator) {
                    this._addSyntaxError(localize_1.LocMessage.keywordParameterMissing(), param);
                }
            }
            else if (sawKwArgs) {
                this._addSyntaxError(localize_1.LocMessage.paramAfterKwargsParam(), param);
            }
            const foundComma = this._consumeTokenIfType(12 /* TokenType.Comma */);
            if (allowAnnotations && !param.typeAnnotation) {
                // Look for a type annotation comment at the end of the line.
                const typeAnnotationComment = this._parseVariableTypeAnnotationComment();
                if (typeAnnotationComment) {
                    param.typeAnnotationComment = typeAnnotationComment;
                    param.typeAnnotationComment.parent = param;
                    (0, parseNodes_1.extendRange)(param, param.typeAnnotationComment);
                }
            }
            if (!foundComma) {
                break;
            }
        }
        if (paramList.length > 0) {
            const lastParam = paramList[paramList.length - 1];
            if (lastParam.category === 1 /* ParameterCategory.ArgsList */ && !lastParam.name) {
                this._addSyntaxError(localize_1.LocMessage.expectedNamedParameter(), lastParam);
            }
        }
        return paramList;
    }
    _parseParameter(allowAnnotations) {
        let starCount = 0;
        let slashCount = 0;
        const firstToken = this._peekToken();
        if (this._consumeTokenIfOperator(26 /* OperatorType.Multiply */)) {
            starCount = 1;
        }
        else if (this._consumeTokenIfOperator(29 /* OperatorType.Power */)) {
            starCount = 2;
        }
        else if (this._consumeTokenIfOperator(10 /* OperatorType.Divide */)) {
            if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_8) && !this._parseOptions.isStubFile) {
                this._addSyntaxError(localize_1.LocMessage.positionOnlyIncompatible(), firstToken);
            }
            slashCount = 1;
        }
        const paramName = this._getTokenIfIdentifier();
        if (!paramName) {
            if (starCount === 1) {
                const paramNode = parseNodes_1.ParameterNode.create(firstToken, 1 /* ParameterCategory.ArgsList */);
                return paramNode;
            }
            else if (slashCount === 1) {
                const paramNode = parseNodes_1.ParameterNode.create(firstToken, 0 /* ParameterCategory.Simple */);
                return paramNode;
            }
            // Check for the Python 2.x parameter sublist syntax and handle it gracefully.
            if (this._peekTokenType() === 13 /* TokenType.OpenParenthesis */) {
                const sublistStart = this._getNextToken();
                if (this._consumeTokensUntilType([14 /* TokenType.CloseParenthesis */])) {
                    this._getNextToken();
                }
                this._addSyntaxError(localize_1.LocMessage.sublistParamsIncompatible(), sublistStart);
            }
            else {
                this._addSyntaxError(localize_1.LocMessage.expectedParamName(), this._peekToken());
            }
        }
        let paramType = 0 /* ParameterCategory.Simple */;
        if (starCount === 1) {
            paramType = 1 /* ParameterCategory.ArgsList */;
        }
        else if (starCount === 2) {
            paramType = 2 /* ParameterCategory.KwargsDict */;
        }
        const paramNode = parseNodes_1.ParameterNode.create(firstToken, paramType);
        if (paramName) {
            paramNode.name = parseNodes_1.NameNode.create(paramName);
            paramNode.name.parent = paramNode;
            (0, parseNodes_1.extendRange)(paramNode, paramName);
        }
        if (allowAnnotations && this._consumeTokenIfType(10 /* TokenType.Colon */)) {
            paramNode.typeAnnotation = this._parseTypeAnnotation(paramType === 1 /* ParameterCategory.ArgsList */);
            paramNode.typeAnnotation.parent = paramNode;
            (0, parseNodes_1.extendRange)(paramNode, paramNode.typeAnnotation);
        }
        if (this._consumeTokenIfOperator(2 /* OperatorType.Assign */)) {
            paramNode.defaultValue = this._parseTestExpression(/* allowAssignmentExpression */ false);
            paramNode.defaultValue.parent = paramNode;
            (0, parseNodes_1.extendRange)(paramNode, paramNode.defaultValue);
            if (starCount > 0) {
                this._addSyntaxError(localize_1.LocMessage.defaultValueNotAllowed(), paramNode.defaultValue);
            }
        }
        return paramNode;
    }
    // with_stmt: 'with' with_item (',' with_item)*  ':' suite
    // Python 3.10 adds support for optional parentheses around
    // with_item list.
    _parseWithStatement(asyncToken) {
        const withToken = this._getKeywordToken(37 /* KeywordType.With */);
        let withItemList = [];
        const possibleParen = this._peekToken();
        // If the expression starts with a paren, parse it as though the
        // paren is enclosing the list of "with items". This is done as a
        // "dry run" to determine whether the entire list of "with items"
        // is enclosed in parentheses.
        let isParenthesizedWithItemList = false;
        if (possibleParen.type === 13 /* TokenType.OpenParenthesis */) {
            const openParenTokenIndex = this._tokenIndex;
            this._suppressErrors(() => {
                this._getNextToken();
                while (true) {
                    withItemList.push(this._parseWithItem());
                    if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                        break;
                    }
                    if (this._peekToken().type === 14 /* TokenType.CloseParenthesis */) {
                        break;
                    }
                }
                if (this._peekToken().type === 14 /* TokenType.CloseParenthesis */ &&
                    this._peekToken(1).type === 10 /* TokenType.Colon */) {
                    isParenthesizedWithItemList = withItemList.length !== 1 || withItemList[0].target !== undefined;
                }
                this._tokenIndex = openParenTokenIndex;
                withItemList = [];
            });
        }
        if (isParenthesizedWithItemList) {
            this._consumeTokenIfType(13 /* TokenType.OpenParenthesis */);
            if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_9)) {
                this._addSyntaxError(localize_1.LocMessage.parenthesizedContextManagerIllegal(), possibleParen);
            }
        }
        while (true) {
            withItemList.push(this._parseWithItem());
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                break;
            }
            if (this._peekToken().type === 14 /* TokenType.CloseParenthesis */) {
                break;
            }
        }
        if (isParenthesizedWithItemList) {
            if (!this._consumeTokenIfType(14 /* TokenType.CloseParenthesis */)) {
                this._addSyntaxError(localize_1.LocMessage.expectedCloseParen(), possibleParen);
            }
        }
        let typeComment;
        const withSuite = this._parseSuite(this._isInFunction, /* skipBody */ false, () => {
            const comment = this._getTypeAnnotationCommentText();
            if (comment) {
                typeComment = comment;
            }
        });
        const withNode = parseNodes_1.WithNode.create(withToken, withSuite);
        if (asyncToken) {
            withNode.isAsync = true;
            withNode.asyncToken = asyncToken;
            (0, parseNodes_1.extendRange)(withNode, asyncToken);
        }
        if (typeComment) {
            withNode.typeComment = typeComment;
        }
        withNode.withItems = withItemList;
        withItemList.forEach((withItem) => {
            withItem.parent = withNode;
        });
        return withNode;
    }
    // with_item: test ['as' expr]
    _parseWithItem() {
        const expr = this._parseTestExpression(/* allowAssignmentExpression */ true);
        const itemNode = parseNodes_1.WithItemNode.create(expr);
        if (this._consumeTokenIfKeyword(1 /* KeywordType.As */)) {
            itemNode.target = this._parseExpression(/* allowUnpack */ false);
            itemNode.target.parent = itemNode;
            (0, parseNodes_1.extendRange)(itemNode, itemNode.target);
        }
        return itemNode;
    }
    // decorators: decorator+
    // decorated: decorators (classdef | funcdef | async_funcdef)
    _parseDecorated() {
        const decoratorList = [];
        while (true) {
            if (this._peekOperatorType() === 22 /* OperatorType.MatrixMultiply */) {
                decoratorList.push(this._parseDecorator());
            }
            else {
                break;
            }
        }
        const nextToken = this._peekToken();
        if (nextToken.type === 8 /* TokenType.Keyword */) {
            if (nextToken.keywordType === 3 /* KeywordType.Async */) {
                this._getNextToken();
                if (this._peekKeywordType() !== 10 /* KeywordType.Def */) {
                    this._addSyntaxError(localize_1.LocMessage.expectedFunctionAfterAsync(), this._peekToken());
                }
                else {
                    return this._parseFunctionDef(nextToken, decoratorList);
                }
            }
            else if (nextToken.keywordType === 10 /* KeywordType.Def */) {
                return this._parseFunctionDef(undefined, decoratorList);
            }
            else if (nextToken.keywordType === 7 /* KeywordType.Class */) {
                return this._parseClassDef(decoratorList);
            }
        }
        this._addSyntaxError(localize_1.LocMessage.expectedAfterDecorator(), this._peekToken());
        // Return a dummy class declaration so the completion provider has
        // some parse nodes to work with.
        return parseNodes_1.ClassNode.createDummyForDecorators(decoratorList);
    }
    // decorator: '@' dotted_name [ '(' [arglist] ')' ] NEWLINE
    _parseDecorator() {
        const atOperator = this._getNextToken();
        (0, debug_1.assert)(atOperator.operatorType === 22 /* OperatorType.MatrixMultiply */);
        const expression = this._parseTestExpression(/* allowAssignmentExpression */ true);
        // Versions of Python prior to 3.9 support a limited set of
        // expression forms.
        if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_9)) {
            let isSupportedExpressionForm = false;
            if (this._isNameOrMemberAccessExpression(expression)) {
                isSupportedExpressionForm = true;
            }
            else if (expression.nodeType === 9 /* ParseNodeType.Call */ &&
                this._isNameOrMemberAccessExpression(expression.leftExpression)) {
                isSupportedExpressionForm = true;
            }
            if (!isSupportedExpressionForm) {
                this._addSyntaxError(localize_1.LocMessage.expectedDecoratorExpr(), expression);
            }
        }
        const decoratorNode = parseNodes_1.DecoratorNode.create(atOperator, expression);
        if (!this._consumeTokenIfType(2 /* TokenType.NewLine */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedDecoratorNewline(), this._peekToken());
            this._consumeTokensUntilType([2 /* TokenType.NewLine */]);
        }
        return decoratorNode;
    }
    _isNameOrMemberAccessExpression(expression) {
        if (expression.nodeType === 38 /* ParseNodeType.Name */) {
            return true;
        }
        else if (expression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            return this._isNameOrMemberAccessExpression(expression.leftExpression);
        }
        return false;
    }
    // classdef: 'class' NAME ['(' [arglist] ')'] suite
    _parseClassDef(decorators) {
        const classToken = this._getKeywordToken(7 /* KeywordType.Class */);
        let nameToken = this._getTokenIfIdentifier();
        if (!nameToken) {
            this._addSyntaxError(localize_1.LocMessage.expectedClassName(), this._peekToken());
            nameToken = tokenizerTypes_1.IdentifierToken.create(0, 0, '', /* comments */ undefined);
        }
        let typeParameters;
        const possibleOpenBracket = this._peekToken();
        if (possibleOpenBracket.type === 15 /* TokenType.OpenBracket */) {
            typeParameters = this._parseTypeParameterList();
            if (!this._parseOptions.isStubFile && this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_12)) {
                this._addSyntaxError(localize_1.LocMessage.classTypeParametersIllegal(), typeParameters);
            }
        }
        let argList = [];
        const openParenToken = this._peekToken();
        if (this._consumeTokenIfType(13 /* TokenType.OpenParenthesis */)) {
            argList = this._parseArgList().args;
            if (!this._consumeTokenIfType(14 /* TokenType.CloseParenthesis */)) {
                this._addSyntaxError(localize_1.LocMessage.expectedCloseParen(), openParenToken);
            }
        }
        const suite = this._parseSuite(/* isFunction */ false, this._parseOptions.skipFunctionAndClassBody);
        const classNode = parseNodes_1.ClassNode.create(classToken, parseNodes_1.NameNode.create(nameToken), suite, typeParameters);
        classNode.arguments = argList;
        argList.forEach((arg) => {
            arg.parent = classNode;
        });
        if (decorators) {
            classNode.decorators = decorators;
            if (decorators.length > 0) {
                decorators.forEach((decorator) => {
                    decorator.parent = classNode;
                });
                (0, parseNodes_1.extendRange)(classNode, decorators[0]);
            }
        }
        return classNode;
    }
    _parsePassStatement() {
        return parseNodes_1.PassNode.create(this._getKeywordToken(30 /* KeywordType.Pass */));
    }
    _parseBreakStatement() {
        const breakToken = this._getKeywordToken(5 /* KeywordType.Break */);
        if (!this._isInLoop) {
            this._addSyntaxError(localize_1.LocMessage.breakOutsideLoop(), breakToken);
        }
        return parseNodes_1.BreakNode.create(breakToken);
    }
    _parseContinueStatement() {
        const continueToken = this._getKeywordToken(8 /* KeywordType.Continue */);
        if (!this._isInLoop) {
            this._addSyntaxError(localize_1.LocMessage.continueOutsideLoop(), continueToken);
        }
        else if (this._isInFinally) {
            this._addSyntaxError(localize_1.LocMessage.continueInFinally(), continueToken);
        }
        return parseNodes_1.ContinueNode.create(continueToken);
    }
    // return_stmt: 'return' [testlist]
    _parseReturnStatement() {
        const returnToken = this._getKeywordToken(32 /* KeywordType.Return */);
        const returnNode = parseNodes_1.ReturnNode.create(returnToken);
        if (!this._isInFunction) {
            this._addSyntaxError(localize_1.LocMessage.returnOutsideFunction(), returnToken);
        }
        if (!this._isNextTokenNeverExpression()) {
            const returnExpr = this._parseTestOrStarListAsExpression(
            /* allowAssignmentExpression */ true, 
            /* allowMultipleUnpack */ true, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedReturnExpr());
            this._reportConditionalErrorForStarTupleElement(returnExpr);
            returnNode.returnExpression = returnExpr;
            returnNode.returnExpression.parent = returnNode;
            (0, parseNodes_1.extendRange)(returnNode, returnExpr);
        }
        return returnNode;
    }
    // import_from: ('from' (('.' | '...')* dotted_name | ('.' | '...')+)
    //             'import' ('*' | '(' import_as_names ')' | import_as_names))
    // import_as_names: import_as_name (',' import_as_name)* [',']
    // import_as_name: NAME ['as' NAME]
    _parseFromStatement() {
        const fromToken = this._getKeywordToken(18 /* KeywordType.From */);
        const modName = this._parseDottedModuleName(/* allowJustDots */ true);
        const importFromNode = parseNodes_1.ImportFromNode.create(fromToken, modName);
        // Handle imports from __future__ specially because they can
        // change the way we interpret the rest of the file.
        const isFutureImport = modName.leadingDots === 0 && modName.nameParts.length === 1 && modName.nameParts[0].value === '__future__';
        const possibleInputToken = this._peekToken();
        if (!this._consumeTokenIfKeyword(21 /* KeywordType.Import */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedImport(), this._peekToken());
            if (!modName.hasTrailingDot) {
                importFromNode.missingImportKeyword = true;
            }
        }
        else {
            (0, parseNodes_1.extendRange)(importFromNode, possibleInputToken);
            // Look for "*" token.
            const possibleStarToken = this._peekToken();
            if (this._consumeTokenIfOperator(26 /* OperatorType.Multiply */)) {
                (0, parseNodes_1.extendRange)(importFromNode, possibleStarToken);
                importFromNode.isWildcardImport = true;
                importFromNode.wildcardToken = possibleStarToken;
                this._containsWildcardImport = true;
            }
            else {
                const openParenToken = this._peekToken();
                const inParen = this._consumeTokenIfType(13 /* TokenType.OpenParenthesis */);
                let trailingCommaToken;
                while (true) {
                    const importName = this._getTokenIfIdentifier();
                    if (!importName) {
                        break;
                    }
                    trailingCommaToken = undefined;
                    const importFromAsNode = parseNodes_1.ImportFromAsNode.create(parseNodes_1.NameNode.create(importName));
                    if (this._consumeTokenIfKeyword(1 /* KeywordType.As */)) {
                        const aliasName = this._getTokenIfIdentifier();
                        if (!aliasName) {
                            this._addSyntaxError(localize_1.LocMessage.expectedImportAlias(), this._peekToken());
                        }
                        else {
                            importFromAsNode.alias = parseNodes_1.NameNode.create(aliasName);
                            importFromAsNode.alias.parent = importFromAsNode;
                            (0, parseNodes_1.extendRange)(importFromAsNode, aliasName);
                        }
                    }
                    importFromNode.imports.push(importFromAsNode);
                    importFromAsNode.parent = importFromNode;
                    (0, parseNodes_1.extendRange)(importFromNode, importFromAsNode);
                    if (isFutureImport) {
                        // Add the future import by name.
                        this._futureImports.add(importName.value);
                    }
                    const nextToken = this._peekToken();
                    if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                        break;
                    }
                    trailingCommaToken = nextToken;
                }
                if (importFromNode.imports.length === 0) {
                    this._addSyntaxError(localize_1.LocMessage.expectedImportSymbols(), this._peekToken());
                }
                if (inParen) {
                    importFromNode.usesParens = true;
                    const nextToken = this._peekToken();
                    if (!this._consumeTokenIfType(14 /* TokenType.CloseParenthesis */)) {
                        this._addSyntaxError(localize_1.LocMessage.expectedCloseParen(), openParenToken);
                    }
                    else {
                        (0, parseNodes_1.extendRange)(importFromNode, nextToken);
                    }
                }
                else if (trailingCommaToken) {
                    this._addSyntaxError(localize_1.LocMessage.trailingCommaInFromImport(), trailingCommaToken);
                }
            }
        }
        this._importedModules.push({
            nameNode: importFromNode.module,
            leadingDots: importFromNode.module.leadingDots,
            nameParts: importFromNode.module.nameParts.map((p) => p.value),
            importedSymbols: new Set(importFromNode.imports.map((imp) => imp.name.value)),
        });
        let isTypingImport = false;
        if (importFromNode.module.nameParts.length === 1) {
            const firstNamePartValue = importFromNode.module.nameParts[0].value;
            if (firstNamePartValue === 'typing' || firstNamePartValue === 'typing_extensions') {
                isTypingImport = true;
            }
        }
        if (isTypingImport) {
            const typingSymbolsOfInterest = ['Literal', 'TypeAlias', 'Annotated'];
            if (importFromNode.isWildcardImport) {
                typingSymbolsOfInterest.forEach((s) => {
                    this._typingSymbolAliases.set(s, s);
                });
            }
            else {
                importFromNode.imports.forEach((imp) => {
                    var _a;
                    if (typingSymbolsOfInterest.some((s) => s === imp.name.value)) {
                        this._typingSymbolAliases.set(((_a = imp.alias) === null || _a === void 0 ? void 0 : _a.value) || imp.name.value, imp.name.value);
                    }
                });
            }
        }
        return importFromNode;
    }
    // import_name: 'import' dotted_as_names
    // dotted_as_names: dotted_as_name (',' dotted_as_name)*
    // dotted_as_name: dotted_name ['as' NAME]
    _parseImportStatement() {
        var _a;
        const importToken = this._getKeywordToken(21 /* KeywordType.Import */);
        const importNode = parseNodes_1.ImportNode.create(importToken);
        while (true) {
            const modName = this._parseDottedModuleName();
            const importAsNode = parseNodes_1.ImportAsNode.create(modName);
            if (this._consumeTokenIfKeyword(1 /* KeywordType.As */)) {
                const aliasToken = this._getTokenIfIdentifier();
                if (aliasToken) {
                    importAsNode.alias = parseNodes_1.NameNode.create(aliasToken);
                    importAsNode.alias.parent = importAsNode;
                    (0, parseNodes_1.extendRange)(importAsNode, importAsNode.alias);
                }
                else {
                    this._addSyntaxError(localize_1.LocMessage.expectedImportAlias(), this._peekToken());
                }
            }
            if (importAsNode.module.leadingDots > 0) {
                this._addSyntaxError(localize_1.LocMessage.relativeImportNotAllowed(), importAsNode.module);
            }
            importNode.list.push(importAsNode);
            importAsNode.parent = importNode;
            const nameParts = importAsNode.module.nameParts.map((p) => p.value);
            if (importAsNode.alias ||
                importAsNode.module.leadingDots > 0 ||
                importAsNode.module.nameParts.length === 0) {
                this._importedModules.push({
                    nameNode: importAsNode.module,
                    leadingDots: importAsNode.module.leadingDots,
                    nameParts,
                    importedSymbols: undefined,
                });
            }
            else {
                // Implicitly import all modules in the multi-part name if we
                // are not assigning the final module to an alias.
                importAsNode.module.nameParts.forEach((_, index) => {
                    this._importedModules.push({
                        nameNode: importAsNode.module,
                        leadingDots: importAsNode.module.leadingDots,
                        nameParts: nameParts.slice(0, index + 1),
                        importedSymbols: undefined,
                    });
                });
            }
            if (modName.nameParts.length === 1) {
                const firstNamePartValue = modName.nameParts[0].value;
                if (firstNamePartValue === 'typing' || firstNamePartValue === 'typing_extensions') {
                    this._typingImportAliases.push(((_a = importAsNode.alias) === null || _a === void 0 ? void 0 : _a.value) || firstNamePartValue);
                }
            }
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                break;
            }
        }
        if (importNode.list.length > 0) {
            (0, parseNodes_1.extendRange)(importNode, importNode.list[importNode.list.length - 1]);
        }
        return importNode;
    }
    // ('.' | '...')* dotted_name | ('.' | '...')+
    // dotted_name: NAME ('.' NAME)*
    _parseDottedModuleName(allowJustDots = false) {
        var _a;
        const moduleNameNode = parseNodes_1.ModuleNameNode.create(this._peekToken());
        while (true) {
            const token = (_a = this._getTokenIfType(19 /* TokenType.Ellipsis */)) !== null && _a !== void 0 ? _a : this._getTokenIfType(20 /* TokenType.Dot */);
            if (token) {
                if (token.type === 19 /* TokenType.Ellipsis */) {
                    moduleNameNode.leadingDots += 3;
                }
                else {
                    moduleNameNode.leadingDots++;
                }
                (0, parseNodes_1.extendRange)(moduleNameNode, token);
            }
            else {
                break;
            }
        }
        while (true) {
            const identifier = this._getTokenIfIdentifier();
            if (!identifier) {
                if (!allowJustDots || moduleNameNode.leadingDots === 0 || moduleNameNode.nameParts.length > 0) {
                    this._addSyntaxError(localize_1.LocMessage.expectedModuleName(), this._peekToken());
                    moduleNameNode.hasTrailingDot = true;
                }
                break;
            }
            const namePart = parseNodes_1.NameNode.create(identifier);
            moduleNameNode.nameParts.push(namePart);
            namePart.parent = moduleNameNode;
            (0, parseNodes_1.extendRange)(moduleNameNode, namePart);
            const nextToken = this._peekToken();
            if (!this._consumeTokenIfType(20 /* TokenType.Dot */)) {
                break;
            }
            // Extend the module name to include the dot.
            (0, parseNodes_1.extendRange)(moduleNameNode, nextToken);
        }
        return moduleNameNode;
    }
    _parseGlobalStatement() {
        const globalToken = this._getKeywordToken(19 /* KeywordType.Global */);
        const globalNode = parseNodes_1.GlobalNode.create(globalToken);
        globalNode.nameList = this._parseNameList();
        if (globalNode.nameList.length > 0) {
            globalNode.nameList.forEach((name) => {
                name.parent = globalNode;
            });
            (0, parseNodes_1.extendRange)(globalNode, globalNode.nameList[globalNode.nameList.length - 1]);
        }
        return globalNode;
    }
    _parseNonlocalStatement() {
        const nonlocalToken = this._getKeywordToken(27 /* KeywordType.Nonlocal */);
        const nonlocalNode = parseNodes_1.NonlocalNode.create(nonlocalToken);
        nonlocalNode.nameList = this._parseNameList();
        if (nonlocalNode.nameList.length > 0) {
            nonlocalNode.nameList.forEach((name) => {
                name.parent = nonlocalNode;
            });
            (0, parseNodes_1.extendRange)(nonlocalNode, nonlocalNode.nameList[nonlocalNode.nameList.length - 1]);
        }
        return nonlocalNode;
    }
    _parseNameList() {
        const nameList = [];
        while (true) {
            const name = this._getTokenIfIdentifier();
            if (!name) {
                this._addSyntaxError(localize_1.LocMessage.expectedIdentifier(), this._peekToken());
                break;
            }
            nameList.push(parseNodes_1.NameNode.create(name));
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                break;
            }
        }
        return nameList;
    }
    // raise_stmt: 'raise' [test ['from' test]]
    // (old) raise_stmt: 'raise' [test [',' test [',' test]]]
    _parseRaiseStatement() {
        const raiseToken = this._getKeywordToken(31 /* KeywordType.Raise */);
        const raiseNode = parseNodes_1.RaiseNode.create(raiseToken);
        if (!this._isNextTokenNeverExpression()) {
            raiseNode.typeExpression = this._parseTestExpression(/* allowAssignmentExpression */ true);
            raiseNode.typeExpression.parent = raiseNode;
            (0, parseNodes_1.extendRange)(raiseNode, raiseNode.typeExpression);
            if (this._consumeTokenIfKeyword(18 /* KeywordType.From */)) {
                raiseNode.valueExpression = this._parseTestExpression(/* allowAssignmentExpression */ true);
                raiseNode.valueExpression.parent = raiseNode;
                (0, parseNodes_1.extendRange)(raiseNode, raiseNode.valueExpression);
            }
            else {
                if (this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                    // Handle the Python 2.x variant
                    raiseNode.valueExpression = this._parseTestExpression(/* allowAssignmentExpression */ true);
                    raiseNode.valueExpression.parent = raiseNode;
                    (0, parseNodes_1.extendRange)(raiseNode, raiseNode.valueExpression);
                    if (this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                        raiseNode.tracebackExpression = this._parseTestExpression(/* allowAssignmentExpression */ true);
                        raiseNode.tracebackExpression.parent = raiseNode;
                        (0, parseNodes_1.extendRange)(raiseNode, raiseNode.tracebackExpression);
                    }
                }
            }
        }
        return raiseNode;
    }
    // assert_stmt: 'assert' test [',' test]
    _parseAssertStatement() {
        const assertToken = this._getKeywordToken(2 /* KeywordType.Assert */);
        const expr = this._parseTestExpression(/* allowAssignmentExpression */ false);
        const assertNode = parseNodes_1.AssertNode.create(assertToken, expr);
        if (this._consumeTokenIfType(12 /* TokenType.Comma */)) {
            const exceptionExpr = this._parseTestExpression(/* allowAssignmentExpression */ false);
            assertNode.exceptionExpression = exceptionExpr;
            assertNode.exceptionExpression.parent = assertNode;
            (0, parseNodes_1.extendRange)(assertNode, exceptionExpr);
        }
        return assertNode;
    }
    // del_stmt: 'del' exprlist
    _parseDelStatement() {
        const delToken = this._getKeywordToken(11 /* KeywordType.Del */);
        const exprListResult = this._parseExpressionList(/* allowStar */ true);
        if (!exprListResult.parseError && exprListResult.list.length === 0) {
            this._addSyntaxError(localize_1.LocMessage.expectedDelExpr(), this._peekToken());
        }
        const delNode = parseNodes_1.DelNode.create(delToken);
        delNode.expressions = exprListResult.list;
        if (delNode.expressions.length > 0) {
            delNode.expressions.forEach((expr) => {
                expr.parent = delNode;
            });
            (0, parseNodes_1.extendRange)(delNode, delNode.expressions[delNode.expressions.length - 1]);
        }
        return delNode;
    }
    // yield_expr: 'yield' [yield_arg]
    // yield_arg: 'from' test | testlist
    _parseYieldExpression() {
        const yieldToken = this._getKeywordToken(38 /* KeywordType.Yield */);
        const nextToken = this._peekToken();
        if (this._consumeTokenIfKeyword(18 /* KeywordType.From */)) {
            if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_3)) {
                this._addSyntaxError(localize_1.LocMessage.yieldFromIllegal(), nextToken);
            }
            return parseNodes_1.YieldFromNode.create(yieldToken, this._parseTestExpression(/* allowAssignmentExpression */ false));
        }
        let exprList;
        if (!this._isNextTokenNeverExpression()) {
            exprList = this._parseTestOrStarListAsExpression(
            /* allowAssignmentExpression */ false, 
            /* allowMultipleUnpack */ true, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedYieldExpr());
            this._reportConditionalErrorForStarTupleElement(exprList);
        }
        return parseNodes_1.YieldNode.create(yieldToken, exprList);
    }
    _tryParseYieldExpression() {
        if (this._peekKeywordType() !== 38 /* KeywordType.Yield */) {
            return undefined;
        }
        return this._parseYieldExpression();
    }
    // simple_stmt: small_stmt (';' small_stmt)* [';'] NEWLINE
    _parseSimpleStatement() {
        const statement = parseNodes_1.StatementListNode.create(this._peekToken());
        while (true) {
            // Swallow invalid tokens to make sure we make forward progress.
            if (this._peekTokenType() === 0 /* TokenType.Invalid */) {
                const invalidToken = this._getNextToken();
                const text = this._fileContents.substr(invalidToken.start, invalidToken.length);
                const firstCharCode = text.charCodeAt(0);
                // Remove any non-printable characters.
                this._addSyntaxError(localize_1.LocMessage.invalidTokenChars().format({ text: `\\u${firstCharCode.toString(16)}` }), invalidToken);
                this._consumeTokensUntilType([2 /* TokenType.NewLine */]);
                break;
            }
            const smallStatement = this._parseSmallStatement();
            statement.statements.push(smallStatement);
            smallStatement.parent = statement;
            (0, parseNodes_1.extendRange)(statement, smallStatement);
            if (smallStatement.nodeType === 0 /* ParseNodeType.Error */) {
                // No need to log an error here. We assume that
                // it was already logged by _parseSmallStatement.
                break;
            }
            // Consume the semicolon if present.
            if (!this._consumeTokenIfType(11 /* TokenType.Semicolon */)) {
                break;
            }
            const nextTokenType = this._peekTokenType();
            if (nextTokenType === 2 /* TokenType.NewLine */ || nextTokenType === 1 /* TokenType.EndOfStream */) {
                break;
            }
        }
        if (!this._consumeTokenIfType(2 /* TokenType.NewLine */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedNewlineOrSemicolon(), this._peekToken());
        }
        return statement;
    }
    // small_stmt: (expr_stmt | del_stmt | pass_stmt | flow_stmt |
    //             import_stmt | global_stmt | nonlocal_stmt | assert_stmt)
    // flow_stmt: break_stmt | continue_stmt | return_stmt | raise_stmt | yield_stmt
    // import_stmt: import_name | import_from
    _parseSmallStatement() {
        switch (this._peekKeywordType()) {
            case 30 /* KeywordType.Pass */:
                return this._parsePassStatement();
            case 5 /* KeywordType.Break */:
                return this._parseBreakStatement();
            case 8 /* KeywordType.Continue */:
                return this._parseContinueStatement();
            case 32 /* KeywordType.Return */:
                return this._parseReturnStatement();
            case 18 /* KeywordType.From */:
                return this._parseFromStatement();
            case 21 /* KeywordType.Import */:
                return this._parseImportStatement();
            case 19 /* KeywordType.Global */:
                return this._parseGlobalStatement();
            case 27 /* KeywordType.Nonlocal */:
                return this._parseNonlocalStatement();
            case 31 /* KeywordType.Raise */:
                return this._parseRaiseStatement();
            case 2 /* KeywordType.Assert */:
                return this._parseAssertStatement();
            case 11 /* KeywordType.Del */:
                return this._parseDelStatement();
            case 38 /* KeywordType.Yield */:
                return this._parseYieldExpression();
            case 35 /* KeywordType.Type */: {
                // Type is considered a "soft" keyword, so we will treat it
                // as an identifier if it is followed by an unexpected token.
                const peekToken1 = this._peekToken(1);
                const peekToken2 = this._peekToken(2);
                let isInvalidTypeToken = true;
                if (peekToken1.type === 7 /* TokenType.Identifier */ ||
                    (peekToken1.type === 8 /* TokenType.Keyword */ && tokenizerTypes_1.KeywordToken.isSoftKeyword(peekToken1))) {
                    if (peekToken2.type === 15 /* TokenType.OpenBracket */) {
                        isInvalidTypeToken = false;
                    }
                    else if (peekToken2.type === 9 /* TokenType.Operator */ &&
                        peekToken2.operatorType === 2 /* OperatorType.Assign */) {
                        isInvalidTypeToken = false;
                    }
                }
                if (!isInvalidTypeToken) {
                    return this._parseTypeAliasStatement();
                }
                break;
            }
        }
        return this._parseExpressionStatement();
    }
    _makeExpressionOrTuple(exprListResult, enclosedInParens) {
        // A single-element tuple with no trailing comma is simply an expression
        // that's surrounded by parens.
        if (exprListResult.list.length === 1 && !exprListResult.trailingComma) {
            if (exprListResult.list[0].nodeType === 56 /* ParseNodeType.Unpack */) {
                this._addSyntaxError(localize_1.LocMessage.unpackOperatorNotAllowed(), exprListResult.list[0]);
            }
            return exprListResult.list[0];
        }
        // To accommodate empty tuples ("()"), we will reach back to get
        // the opening parenthesis as the opening token.
        const tupleStartRange = exprListResult.list.length > 0 ? exprListResult.list[0] : this._peekToken(-1);
        const tupleNode = parseNodes_1.TupleNode.create(tupleStartRange, enclosedInParens);
        tupleNode.expressions = exprListResult.list;
        if (exprListResult.list.length > 0) {
            exprListResult.list.forEach((expr) => {
                expr.parent = tupleNode;
            });
            (0, parseNodes_1.extendRange)(tupleNode, exprListResult.list[exprListResult.list.length - 1]);
        }
        return tupleNode;
    }
    _parseExpressionListAsPossibleTuple(errorCategory, getErrorString, errorToken) {
        if (this._isNextTokenNeverExpression()) {
            this._addSyntaxError(getErrorString(), errorToken);
            return parseNodes_1.ErrorNode.create(errorToken, errorCategory);
        }
        const exprListResult = this._parseExpressionList(/* allowStar */ true);
        if (exprListResult.parseError) {
            return exprListResult.parseError;
        }
        return this._makeExpressionOrTuple(exprListResult, /* enclosedInParens */ false);
    }
    _parseTestListAsExpression(errorCategory, getErrorString) {
        if (this._isNextTokenNeverExpression()) {
            return this._handleExpressionParseError(errorCategory, getErrorString());
        }
        const exprListResult = this._parseTestExpressionList();
        if (exprListResult.parseError) {
            return exprListResult.parseError;
        }
        return this._makeExpressionOrTuple(exprListResult, /* enclosedInParens */ false);
    }
    _parseTestOrStarListAsExpression(allowAssignmentExpression, allowMultipleUnpack, errorCategory, getErrorString) {
        if (this._isNextTokenNeverExpression()) {
            return this._handleExpressionParseError(errorCategory, getErrorString());
        }
        const exprListResult = this._parseTestOrStarExpressionList(allowAssignmentExpression, allowMultipleUnpack);
        if (exprListResult.parseError) {
            return exprListResult.parseError;
        }
        return this._makeExpressionOrTuple(exprListResult, /* enclosedInParens */ false);
    }
    _parseExpressionList(allowStar) {
        return this._parseExpressionListGeneric(() => this._parseExpression(allowStar));
    }
    // testlist: test (',' test)* [',']
    _parseTestExpressionList() {
        return this._parseExpressionListGeneric(() => this._parseTestExpression(/* allowAssignmentExpression */ false));
    }
    _parseTestOrStarExpressionList(allowAssignmentExpression, allowMultipleUnpack) {
        const exprListResult = this._parseExpressionListGeneric(() => this._parseTestOrStarExpression(allowAssignmentExpression));
        if (!allowMultipleUnpack && !exprListResult.parseError) {
            let sawStar = false;
            for (const expr of exprListResult.list) {
                if (expr.nodeType === 56 /* ParseNodeType.Unpack */) {
                    if (sawStar) {
                        this._addSyntaxError(localize_1.LocMessage.duplicateUnpack(), expr);
                        break;
                    }
                    sawStar = true;
                }
            }
        }
        return exprListResult;
    }
    // exp_or_star: expr | star_expr
    // expr: xor_expr ('|' xor_expr)*
    // star_expr: '*' expr
    _parseExpression(allowUnpack) {
        const startToken = this._peekToken();
        if (allowUnpack && this._consumeTokenIfOperator(26 /* OperatorType.Multiply */)) {
            return parseNodes_1.UnpackNode.create(startToken, this._parseExpression(/* allowUnpack */ false));
        }
        return this._parseBitwiseOrExpression();
    }
    // test_or_star: test | star_expr
    _parseTestOrStarExpression(allowAssignmentExpression) {
        if (this._peekOperatorType() === 26 /* OperatorType.Multiply */) {
            return this._parseExpression(/* allowUnpack */ true);
        }
        return this._parseTestExpression(allowAssignmentExpression);
    }
    // test: or_test ['if' or_test 'else' test] | lambdef
    _parseTestExpression(allowAssignmentExpression) {
        if (this._peekKeywordType() === 24 /* KeywordType.Lambda */) {
            return this._parseLambdaExpression();
        }
        const ifExpr = this._parseAssignmentExpression(!allowAssignmentExpression);
        if (ifExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return ifExpr;
        }
        if (!this._consumeTokenIfKeyword(20 /* KeywordType.If */)) {
            return ifExpr;
        }
        const testExpr = this._parseOrTest();
        if (testExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return testExpr;
        }
        if (!this._consumeTokenIfKeyword(13 /* KeywordType.Else */)) {
            return parseNodes_1.TernaryNode.create(ifExpr, testExpr, this._handleExpressionParseError(1 /* ErrorExpressionCategory.MissingElse */, localize_1.LocMessage.expectedElse()));
        }
        const elseExpr = this._parseTestExpression(/* allowAssignmentExpression */ true);
        return parseNodes_1.TernaryNode.create(ifExpr, testExpr, elseExpr);
    }
    // assign_expr: NAME := test
    _parseAssignmentExpression(disallowAssignmentExpression = false) {
        const leftExpr = this._parseOrTest();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        if (leftExpr.nodeType !== 38 /* ParseNodeType.Name */) {
            return leftExpr;
        }
        const walrusToken = this._peekToken();
        if (!this._consumeTokenIfOperator(35 /* OperatorType.Walrus */)) {
            return leftExpr;
        }
        if (!this._assignmentExpressionsAllowed || disallowAssignmentExpression) {
            this._addSyntaxError(localize_1.LocMessage.walrusNotAllowed(), walrusToken);
        }
        if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_8)) {
            this._addSyntaxError(localize_1.LocMessage.walrusIllegal(), walrusToken);
        }
        const rightExpr = this._parseTestExpression(/* allowAssignmentExpression */ false);
        return parseNodes_1.AssignmentExpressionNode.create(leftExpr, walrusToken, rightExpr);
    }
    // or_test: and_test ('or' and_test)*
    _parseOrTest() {
        let leftExpr = this._parseAndTest();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        while (true) {
            const peekToken = this._peekToken();
            if (!this._consumeTokenIfKeyword(29 /* KeywordType.Or */)) {
                break;
            }
            const rightExpr = this._parseAndTest();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, 37 /* OperatorType.Or */);
        }
        return leftExpr;
    }
    // and_test: not_test ('and' not_test)*
    _parseAndTest() {
        let leftExpr = this._parseNotTest();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        while (true) {
            const peekToken = this._peekToken();
            if (!this._consumeTokenIfKeyword(0 /* KeywordType.And */)) {
                break;
            }
            const rightExpr = this._parseNotTest();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, 36 /* OperatorType.And */);
        }
        return leftExpr;
    }
    // not_test: 'not' not_test | comparison
    _parseNotTest() {
        const notToken = this._peekToken();
        if (this._consumeTokenIfKeyword(28 /* KeywordType.Not */)) {
            const notExpr = this._parseNotTest();
            return this._createUnaryOperationNode(notToken, notExpr, 38 /* OperatorType.Not */);
        }
        return this._parseComparison();
    }
    // comparison: expr (comp_op expr)*
    // comp_op: '<'|'>'|'=='|'>='|'<='|'<>'|'!='|'in'|'not' 'in'|'is'|'is' 'not'
    _parseComparison() {
        let leftExpr = this._parseBitwiseOrExpression();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        while (true) {
            let comparisonOperator;
            const peekToken = this._peekToken();
            if (tokenizer_1.Tokenizer.isOperatorComparison(this._peekOperatorType())) {
                comparisonOperator = this._peekOperatorType();
                if (comparisonOperator === 19 /* OperatorType.LessOrGreaterThan */) {
                    this._addSyntaxError(localize_1.LocMessage.operatorLessOrGreaterDeprecated(), peekToken);
                    comparisonOperator = 28 /* OperatorType.NotEquals */;
                }
                this._getNextToken();
            }
            else if (this._consumeTokenIfKeyword(22 /* KeywordType.In */)) {
                comparisonOperator = 41 /* OperatorType.In */;
            }
            else if (this._consumeTokenIfKeyword(23 /* KeywordType.Is */)) {
                if (this._consumeTokenIfKeyword(28 /* KeywordType.Not */)) {
                    comparisonOperator = 40 /* OperatorType.IsNot */;
                }
                else {
                    comparisonOperator = 39 /* OperatorType.Is */;
                }
            }
            else if (this._peekKeywordType() === 28 /* KeywordType.Not */) {
                const tokenAfterNot = this._peekToken(1);
                if (tokenAfterNot.type === 8 /* TokenType.Keyword */ &&
                    tokenAfterNot.keywordType === 22 /* KeywordType.In */) {
                    this._getNextToken();
                    this._getNextToken();
                    comparisonOperator = 42 /* OperatorType.NotIn */;
                }
            }
            if (comparisonOperator === undefined) {
                break;
            }
            const rightExpr = this._parseComparison();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, comparisonOperator);
        }
        return leftExpr;
    }
    // expr: xor_expr ('|' xor_expr)*
    _parseBitwiseOrExpression() {
        let leftExpr = this._parseBitwiseXorExpression();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        while (true) {
            const peekToken = this._peekToken();
            if (!this._consumeTokenIfOperator(6 /* OperatorType.BitwiseOr */)) {
                break;
            }
            const rightExpr = this._parseBitwiseXorExpression();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, 6 /* OperatorType.BitwiseOr */);
        }
        return leftExpr;
    }
    // xor_expr: and_expr ('^' and_expr)*
    _parseBitwiseXorExpression() {
        let leftExpr = this._parseBitwiseAndExpression();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        while (true) {
            const peekToken = this._peekToken();
            if (!this._consumeTokenIfOperator(8 /* OperatorType.BitwiseXor */)) {
                break;
            }
            const rightExpr = this._parseBitwiseAndExpression();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, 8 /* OperatorType.BitwiseXor */);
        }
        return leftExpr;
    }
    // and_expr: shift_expr ('&' shift_expr)*
    _parseBitwiseAndExpression() {
        let leftExpr = this._parseShiftExpression();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        while (true) {
            const peekToken = this._peekToken();
            if (!this._consumeTokenIfOperator(3 /* OperatorType.BitwiseAnd */)) {
                break;
            }
            const rightExpr = this._parseShiftExpression();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, 3 /* OperatorType.BitwiseAnd */);
        }
        return leftExpr;
    }
    // shift_expr: arith_expr (('<<'|'>>') arith_expr)*
    _parseShiftExpression() {
        let leftExpr = this._parseArithmeticExpression();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        let peekToken = this._peekToken();
        let nextOperator = this._peekOperatorType();
        while (nextOperator === 17 /* OperatorType.LeftShift */ || nextOperator === 31 /* OperatorType.RightShift */) {
            this._getNextToken();
            const rightExpr = this._parseArithmeticExpression();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, nextOperator);
            peekToken = this._peekToken();
            nextOperator = this._peekOperatorType();
        }
        return leftExpr;
    }
    // arith_expr: term (('+'|'-') term)*
    _parseArithmeticExpression() {
        let leftExpr = this._parseArithmeticTerm();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        let peekToken = this._peekToken();
        let nextOperator = this._peekOperatorType();
        while (nextOperator === 0 /* OperatorType.Add */ || nextOperator === 33 /* OperatorType.Subtract */) {
            this._getNextToken();
            const rightExpr = this._parseArithmeticTerm();
            if (rightExpr.nodeType === 0 /* ParseNodeType.Error */) {
                return rightExpr;
            }
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, nextOperator);
            peekToken = this._peekToken();
            nextOperator = this._peekOperatorType();
        }
        return leftExpr;
    }
    // term: factor (('*'|'@'|'/'|'%'|'//') factor)*
    _parseArithmeticTerm() {
        let leftExpr = this._parseArithmeticFactor();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        let peekToken = this._peekToken();
        let nextOperator = this._peekOperatorType();
        while (nextOperator === 26 /* OperatorType.Multiply */ ||
            nextOperator === 22 /* OperatorType.MatrixMultiply */ ||
            nextOperator === 10 /* OperatorType.Divide */ ||
            nextOperator === 24 /* OperatorType.Mod */ ||
            nextOperator === 13 /* OperatorType.FloorDivide */) {
            this._getNextToken();
            const rightExpr = this._parseArithmeticFactor();
            leftExpr = this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, nextOperator);
            peekToken = this._peekToken();
            nextOperator = this._peekOperatorType();
        }
        return leftExpr;
    }
    // factor: ('+'|'-'|'~') factor | power
    // power: atom_expr ['**' factor]
    _parseArithmeticFactor() {
        const nextToken = this._peekToken();
        const nextOperator = this._peekOperatorType();
        if (nextOperator === 0 /* OperatorType.Add */ ||
            nextOperator === 33 /* OperatorType.Subtract */ ||
            nextOperator === 5 /* OperatorType.BitwiseInvert */) {
            this._getNextToken();
            const expression = this._parseArithmeticFactor();
            return this._createUnaryOperationNode(nextToken, expression, nextOperator);
        }
        const leftExpr = this._parseAtomExpression();
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        const peekToken = this._peekToken();
        if (this._consumeTokenIfOperator(29 /* OperatorType.Power */)) {
            const rightExpr = this._parseArithmeticFactor();
            return this._createBinaryOperationNode(leftExpr, rightExpr, peekToken, 29 /* OperatorType.Power */);
        }
        return leftExpr;
    }
    // Determines whether the expression refers to a type exported by the typing
    // or typing_extensions modules. We can directly evaluate the types at binding
    // time. We assume here that the code isn't making use of some custom type alias
    // to refer to the typing types.
    _isTypingAnnotation(typeAnnotation, name) {
        if (typeAnnotation.nodeType === 38 /* ParseNodeType.Name */) {
            const alias = this._typingSymbolAliases.get(typeAnnotation.value);
            if (alias === name) {
                return true;
            }
        }
        else if (typeAnnotation.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            if (typeAnnotation.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                typeAnnotation.memberName.value === name) {
                const baseName = typeAnnotation.leftExpression.value;
                return this._typingImportAliases.some((alias) => alias === baseName);
            }
        }
        return false;
    }
    // atom_expr: ['await'] atom trailer*
    // trailer: '(' [arglist] ')' | '[' subscriptlist ']' | '.' NAME
    _parseAtomExpression() {
        let awaitToken;
        if (this._peekKeywordType() === 4 /* KeywordType.Await */) {
            awaitToken = this._getKeywordToken(4 /* KeywordType.Await */);
            if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_5)) {
                this._addSyntaxError(localize_1.LocMessage.awaitIllegal(), awaitToken);
            }
        }
        let atomExpression = this._parseAtom();
        if (atomExpression.nodeType === 0 /* ParseNodeType.Error */) {
            return atomExpression;
        }
        // Consume trailers.
        while (true) {
            // Is it a function call?
            const startOfTrailerToken = this._peekToken();
            if (this._consumeTokenIfType(13 /* TokenType.OpenParenthesis */)) {
                // Generally, function calls are not allowed within type annotations,
                // but they are permitted in "Annotated" annotations.
                const wasParsingTypeAnnotation = this._isParsingTypeAnnotation;
                this._isParsingTypeAnnotation = false;
                const argListResult = this._parseArgList();
                const callNode = parseNodes_1.CallNode.create(atomExpression, argListResult.args, argListResult.trailingComma);
                if (argListResult.args.length > 1 || argListResult.trailingComma) {
                    argListResult.args.forEach((arg) => {
                        if (arg.valueExpression.nodeType === 11 /* ParseNodeType.Comprehension */) {
                            if (!arg.valueExpression.isParenthesized) {
                                this._addSyntaxError(localize_1.LocMessage.generatorNotParenthesized(), arg.valueExpression);
                            }
                        }
                    });
                }
                const nextToken = this._peekToken();
                let isArgListTerminated = false;
                if (!this._consumeTokenIfType(14 /* TokenType.CloseParenthesis */)) {
                    this._addSyntaxError(localize_1.LocMessage.expectedCloseParen(), startOfTrailerToken);
                    // Consume the remainder of tokens on the line for error
                    // recovery.
                    this._consumeTokensUntilType([2 /* TokenType.NewLine */]);
                    // Extend the node's range to include the rest of the line.
                    // This helps the signatureHelpProvider.
                    (0, parseNodes_1.extendRange)(callNode, this._peekToken());
                }
                else {
                    (0, parseNodes_1.extendRange)(callNode, nextToken);
                    isArgListTerminated = true;
                }
                this._isParsingTypeAnnotation = wasParsingTypeAnnotation;
                atomExpression = callNode;
                if (atomExpression.maxChildDepth !== undefined && atomExpression.maxChildDepth >= maxChildNodeDepth) {
                    atomExpression = parseNodes_1.ErrorNode.create(atomExpression, 14 /* ErrorExpressionCategory.MaxDepthExceeded */);
                    this._addSyntaxError(localize_1.LocMessage.maxParseDepthExceeded(), atomExpression);
                }
                // If the argument list wasn't terminated, break out of the loop
                if (!isArgListTerminated) {
                    break;
                }
            }
            else if (this._consumeTokenIfType(15 /* TokenType.OpenBracket */)) {
                // Is it an index operator?
                // This is an unfortunate hack that's necessary to accommodate 'Literal'
                // and 'Annotated' type annotations properly. We need to suspend treating
                // strings as type annotations within a Literal or Annotated subscript.
                const wasParsingIndexTrailer = this._isParsingIndexTrailer;
                const wasParsingTypeAnnotation = this._isParsingTypeAnnotation;
                if (this._isTypingAnnotation(atomExpression, 'Literal') ||
                    this._isTypingAnnotation(atomExpression, 'Annotated')) {
                    this._isParsingTypeAnnotation = false;
                }
                this._isParsingIndexTrailer = true;
                const subscriptList = this._parseSubscriptList();
                this._isParsingTypeAnnotation = wasParsingTypeAnnotation;
                this._isParsingIndexTrailer = wasParsingIndexTrailer;
                const closingToken = this._peekToken();
                const indexNode = parseNodes_1.IndexNode.create(atomExpression, subscriptList.list, subscriptList.trailingComma, closingToken);
                (0, parseNodes_1.extendRange)(indexNode, indexNode);
                if (!this._consumeTokenIfType(16 /* TokenType.CloseBracket */)) {
                    // Handle the error case, but don't use the error node in this
                    // case because it creates problems for the completion provider.
                    this._handleExpressionParseError(6 /* ErrorExpressionCategory.MissingIndexCloseBracket */, localize_1.LocMessage.expectedCloseBracket(), startOfTrailerToken, indexNode);
                }
                atomExpression = indexNode;
                if (atomExpression.maxChildDepth !== undefined && atomExpression.maxChildDepth >= maxChildNodeDepth) {
                    atomExpression = parseNodes_1.ErrorNode.create(atomExpression, 14 /* ErrorExpressionCategory.MaxDepthExceeded */);
                    this._addSyntaxError(localize_1.LocMessage.maxParseDepthExceeded(), atomExpression);
                }
            }
            else if (this._consumeTokenIfType(20 /* TokenType.Dot */)) {
                // Is it a member access?
                const memberName = this._getTokenIfIdentifier();
                if (!memberName) {
                    return this._handleExpressionParseError(7 /* ErrorExpressionCategory.MissingMemberAccessName */, localize_1.LocMessage.expectedMemberName(), startOfTrailerToken, atomExpression, [8 /* TokenType.Keyword */]);
                }
                atomExpression = parseNodes_1.MemberAccessNode.create(atomExpression, parseNodes_1.NameNode.create(memberName));
                if (atomExpression.maxChildDepth !== undefined && atomExpression.maxChildDepth >= maxChildNodeDepth) {
                    atomExpression = parseNodes_1.ErrorNode.create(atomExpression, 14 /* ErrorExpressionCategory.MaxDepthExceeded */);
                    this._addSyntaxError(localize_1.LocMessage.maxParseDepthExceeded(), atomExpression);
                }
            }
            else {
                break;
            }
        }
        if (awaitToken) {
            return parseNodes_1.AwaitNode.create(awaitToken, atomExpression);
        }
        return atomExpression;
    }
    // subscriptlist: subscript (',' subscript)* [',']
    _parseSubscriptList() {
        const argList = [];
        let sawKeywordArg = false;
        let trailingComma = false;
        while (true) {
            const firstToken = this._peekToken();
            if (firstToken.type !== 10 /* TokenType.Colon */ && this._isNextTokenNeverExpression()) {
                break;
            }
            let argType = 0 /* ArgumentCategory.Simple */;
            if (this._consumeTokenIfOperator(26 /* OperatorType.Multiply */)) {
                argType = 1 /* ArgumentCategory.UnpackedList */;
            }
            else if (this._consumeTokenIfOperator(29 /* OperatorType.Power */)) {
                argType = 2 /* ArgumentCategory.UnpackedDictionary */;
            }
            const startOfSubscriptIndex = this._tokenIndex;
            let valueExpr = this._parsePossibleSlice();
            let nameIdentifier;
            // Is this a keyword argument?
            if (argType === 0 /* ArgumentCategory.Simple */) {
                if (this._consumeTokenIfOperator(2 /* OperatorType.Assign */)) {
                    const nameExpr = valueExpr;
                    valueExpr = this._parsePossibleSlice();
                    if (nameExpr.nodeType === 38 /* ParseNodeType.Name */) {
                        nameIdentifier = nameExpr.token;
                    }
                    else {
                        this._addSyntaxError(localize_1.LocMessage.expectedParamName(), nameExpr);
                    }
                }
                else if (valueExpr.nodeType === 38 /* ParseNodeType.Name */ &&
                    this._peekOperatorType() === 35 /* OperatorType.Walrus */) {
                    this._tokenIndex = startOfSubscriptIndex;
                    valueExpr = this._parseTestExpression(/* allowAssignmentExpression */ true);
                    // Python 3.10 and newer allow assignment expressions to be used inside of a subscript.
                    if (!this._parseOptions.isStubFile && this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_10)) {
                        this._addSyntaxError(localize_1.LocMessage.assignmentExprInSubscript(), valueExpr);
                    }
                }
            }
            const argNode = parseNodes_1.ArgumentNode.create(firstToken, valueExpr, argType);
            if (nameIdentifier) {
                argNode.name = parseNodes_1.NameNode.create(nameIdentifier);
                argNode.name.parent = argNode;
            }
            if (argNode.name) {
                sawKeywordArg = true;
            }
            else if (sawKeywordArg && argNode.argumentCategory === 0 /* ArgumentCategory.Simple */) {
                this._addSyntaxError(localize_1.LocMessage.positionArgAfterNamedArg(), argNode);
            }
            argList.push(argNode);
            if (argNode.name) {
                this._addSyntaxError(localize_1.LocMessage.keywordSubscriptIllegal(), argNode.name);
            }
            if (argType !== 0 /* ArgumentCategory.Simple */) {
                const unpackListAllowed = this._parseOptions.isStubFile ||
                    this._isParsingQuotedText ||
                    this._getLanguageVersion().isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_11);
                if (argType === 1 /* ArgumentCategory.UnpackedList */ && !unpackListAllowed) {
                    this._addSyntaxError(localize_1.LocMessage.unpackedSubscriptIllegal(), argNode);
                }
                if (argType === 2 /* ArgumentCategory.UnpackedDictionary */) {
                    this._addSyntaxError(localize_1.LocMessage.unpackedDictSubscriptIllegal(), argNode);
                }
            }
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                trailingComma = false;
                break;
            }
            trailingComma = true;
        }
        // An empty subscript list is illegal.
        if (argList.length === 0) {
            const errorNode = this._handleExpressionParseError(3 /* ErrorExpressionCategory.MissingIndexOrSlice */, localize_1.LocMessage.expectedSliceIndex(), 
            /* targetToken */ undefined, 
            /* childNode */ undefined, [16 /* TokenType.CloseBracket */]);
            argList.push(parseNodes_1.ArgumentNode.create(this._peekToken(), errorNode, 0 /* ArgumentCategory.Simple */));
        }
        return {
            list: argList,
            trailingComma,
        };
    }
    // subscript: test | [test] ':' [test] [sliceop]
    // sliceop: ':' [test]
    _parsePossibleSlice() {
        const firstToken = this._peekToken();
        const sliceExpressions = [undefined, undefined, undefined];
        let sliceIndex = 0;
        let sawColon = false;
        while (true) {
            const nextTokenType = this._peekTokenType();
            if (nextTokenType === 16 /* TokenType.CloseBracket */ || nextTokenType === 12 /* TokenType.Comma */) {
                break;
            }
            if (nextTokenType !== 10 /* TokenType.Colon */) {
                // Python 3.10 and newer allow assignment expressions to be used inside of a subscript.
                const allowAssignmentExpression = this._parseOptions.isStubFile || this._getLanguageVersion().isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_10);
                sliceExpressions[sliceIndex] = this._parseTestExpression(allowAssignmentExpression);
            }
            sliceIndex++;
            if (sliceIndex >= 3 || !this._consumeTokenIfType(10 /* TokenType.Colon */)) {
                break;
            }
            sawColon = true;
        }
        // If this was a simple expression with no colons return it.
        if (!sawColon) {
            if (sliceExpressions[0]) {
                return sliceExpressions[0];
            }
            return parseNodes_1.ErrorNode.create(this._peekToken(), 3 /* ErrorExpressionCategory.MissingIndexOrSlice */);
        }
        const sliceNode = parseNodes_1.SliceNode.create(firstToken);
        sliceNode.startValue = sliceExpressions[0];
        if (sliceNode.startValue) {
            sliceNode.startValue.parent = sliceNode;
        }
        sliceNode.endValue = sliceExpressions[1];
        if (sliceNode.endValue) {
            sliceNode.endValue.parent = sliceNode;
        }
        sliceNode.stepValue = sliceExpressions[2];
        if (sliceNode.stepValue) {
            sliceNode.stepValue.parent = sliceNode;
        }
        const extension = sliceExpressions[2] || sliceExpressions[1] || sliceExpressions[0];
        if (extension) {
            (0, parseNodes_1.extendRange)(sliceNode, extension);
        }
        return sliceNode;
    }
    // arglist: argument (',' argument)*  [',']
    _parseArgList() {
        const argList = [];
        let sawKeywordArg = false;
        let trailingComma = false;
        while (true) {
            const nextTokenType = this._peekTokenType();
            if (nextTokenType === 14 /* TokenType.CloseParenthesis */ ||
                nextTokenType === 2 /* TokenType.NewLine */ ||
                nextTokenType === 1 /* TokenType.EndOfStream */) {
                break;
            }
            trailingComma = false;
            const arg = this._parseArgument();
            if (arg.name) {
                sawKeywordArg = true;
            }
            else if (sawKeywordArg && arg.argumentCategory === 0 /* ArgumentCategory.Simple */) {
                this._addSyntaxError(localize_1.LocMessage.positionArgAfterNamedArg(), arg);
            }
            argList.push(arg);
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                break;
            }
            trailingComma = true;
        }
        return { args: argList, trailingComma };
    }
    // argument: ( test [comp_for] |
    //             test '=' test |
    //             '**' test |
    //             '*' test )
    _parseArgument() {
        const firstToken = this._peekToken();
        let argType = 0 /* ArgumentCategory.Simple */;
        if (this._consumeTokenIfOperator(26 /* OperatorType.Multiply */)) {
            argType = 1 /* ArgumentCategory.UnpackedList */;
        }
        else if (this._consumeTokenIfOperator(29 /* OperatorType.Power */)) {
            argType = 2 /* ArgumentCategory.UnpackedDictionary */;
        }
        let valueExpr = this._parseTestExpression(/* allowAssignmentExpression */ true);
        let nameIdentifier;
        if (argType === 0 /* ArgumentCategory.Simple */) {
            if (this._consumeTokenIfOperator(2 /* OperatorType.Assign */)) {
                const nameExpr = valueExpr;
                valueExpr = this._parseTestExpression(/* allowAssignmentExpression */ false);
                if (nameExpr.nodeType === 38 /* ParseNodeType.Name */) {
                    nameIdentifier = nameExpr.token;
                }
                else {
                    this._addSyntaxError(localize_1.LocMessage.expectedParamName(), nameExpr);
                }
            }
            else {
                const comprehension = this._tryParseComprehension(valueExpr, /* isGenerator */ true);
                if (comprehension) {
                    valueExpr = comprehension;
                }
            }
        }
        const argNode = parseNodes_1.ArgumentNode.create(firstToken, valueExpr, argType);
        if (nameIdentifier) {
            argNode.name = parseNodes_1.NameNode.create(nameIdentifier);
            argNode.name.parent = argNode;
        }
        return argNode;
    }
    // atom: ('(' [yield_expr | testlist_comp] ')' |
    //     '[' [testlist_comp] ']' |
    //     '{' [dictorsetmaker] '}' |
    //     NAME | NUMBER | STRING+ | '...' | 'None' | 'True' | 'False' | '__debug__')
    _parseAtom() {
        const nextToken = this._peekToken();
        if (nextToken.type === 19 /* TokenType.Ellipsis */) {
            return parseNodes_1.EllipsisNode.create(this._getNextToken());
        }
        if (nextToken.type === 6 /* TokenType.Number */) {
            return parseNodes_1.NumberNode.create(this._getNextToken());
        }
        if (nextToken.type === 7 /* TokenType.Identifier */) {
            return parseNodes_1.NameNode.create(this._getNextToken());
        }
        if (nextToken.type === 5 /* TokenType.String */ || nextToken.type === 24 /* TokenType.FStringStart */) {
            return this._parseStringList();
        }
        if (nextToken.type === 22 /* TokenType.Backtick */) {
            this._getNextToken();
            // Atoms with backticks are no longer allowed in Python 3.x, but they
            // were a thing in Python 2.x. We'll parse them to improve parse recovery
            // and emit an error.
            this._addSyntaxError(localize_1.LocMessage.backticksIllegal(), nextToken);
            const expressionNode = this._parseTestListAsExpression(2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedExpr());
            this._consumeTokenIfType(22 /* TokenType.Backtick */);
            return expressionNode;
        }
        if (nextToken.type === 13 /* TokenType.OpenParenthesis */) {
            const possibleTupleNode = this._parseTupleAtom();
            if (possibleTupleNode.nodeType === 55 /* ParseNodeType.UnaryOperation */ ||
                possibleTupleNode.nodeType === 6 /* ParseNodeType.Await */ ||
                possibleTupleNode.nodeType === 7 /* ParseNodeType.BinaryOperation */) {
                // Mark binary expressions as parenthesized so we don't attempt
                // to use comparison chaining, which isn't appropriate when the
                // expression is parenthesized. Unary and await expressions
                // are also marked to be able to display them unambiguously.
                possibleTupleNode.parenthesized = true;
            }
            if (possibleTupleNode.nodeType === 48 /* ParseNodeType.StringList */ ||
                possibleTupleNode.nodeType === 11 /* ParseNodeType.Comprehension */ ||
                possibleTupleNode.nodeType === 4 /* ParseNodeType.AssignmentExpression */) {
                possibleTupleNode.isParenthesized = true;
            }
            return possibleTupleNode;
        }
        else if (nextToken.type === 15 /* TokenType.OpenBracket */) {
            return this._parseListAtom();
        }
        else if (nextToken.type === 17 /* TokenType.OpenCurlyBrace */) {
            return this._parseDictionaryOrSetAtom();
        }
        if (nextToken.type === 8 /* TokenType.Keyword */) {
            const keywordToken = nextToken;
            if (keywordToken.keywordType === 15 /* KeywordType.False */ ||
                keywordToken.keywordType === 33 /* KeywordType.True */ ||
                keywordToken.keywordType === 9 /* KeywordType.Debug */ ||
                keywordToken.keywordType === 26 /* KeywordType.None */) {
                return parseNodes_1.ConstantNode.create(this._getNextToken());
            }
            // Make an identifier out of the keyword.
            const keywordAsIdentifier = this._getTokenIfIdentifier();
            if (keywordAsIdentifier) {
                return parseNodes_1.NameNode.create(keywordAsIdentifier);
            }
        }
        return this._handleExpressionParseError(2 /* ErrorExpressionCategory.MissingExpression */, localize_1.LocMessage.expectedExpr());
    }
    // Allocates a dummy "error expression" and consumes the remainder
    // of the tokens on the line for error recovery. A partially-completed
    // child node can be passed to help the completion provider determine
    // what to do.
    _handleExpressionParseError(category, errorMsg, targetToken, childNode, additionalStopTokens) {
        var _a;
        this._addSyntaxError(errorMsg, targetToken !== null && targetToken !== void 0 ? targetToken : this._peekToken());
        const stopTokens = [2 /* TokenType.NewLine */];
        if (additionalStopTokens) {
            (0, collectionUtils_1.appendArray)(stopTokens, additionalStopTokens);
        }
        // Using a token that is not included in the error node creates problems.
        // Sibling nodes in parse tree shouldn't overlap each other.
        const nextToken = this._peekToken();
        const initialRange = stopTokens.some((k) => nextToken.type === k)
            ? (_a = targetToken !== null && targetToken !== void 0 ? targetToken : childNode) !== null && _a !== void 0 ? _a : textRange_1.TextRange.create(nextToken.start, /* length */ 0)
            : nextToken;
        const expr = parseNodes_1.ErrorNode.create(initialRange, category, childNode);
        this._consumeTokensUntilType(stopTokens);
        return expr;
    }
    // lambdef: 'lambda' [varargslist] ':' test
    _parseLambdaExpression(allowConditional = true) {
        const lambdaToken = this._getKeywordToken(24 /* KeywordType.Lambda */);
        const argList = this._parseVarArgsList(10 /* TokenType.Colon */, /* allowAnnotations */ false);
        if (!this._consumeTokenIfType(10 /* TokenType.Colon */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedColon(), this._peekToken());
        }
        let testExpr;
        if (allowConditional) {
            testExpr = this._parseTestExpression(/* allowAssignmentExpression */ false);
        }
        else {
            testExpr = this._tryParseLambdaExpression(/* allowConditional */ false) || this._parseOrTest();
        }
        const lambdaNode = parseNodes_1.LambdaNode.create(lambdaToken, testExpr);
        lambdaNode.parameters = argList;
        argList.forEach((arg) => {
            arg.parent = lambdaNode;
        });
        return lambdaNode;
    }
    _tryParseLambdaExpression(allowConditional = true) {
        if (this._peekKeywordType() !== 24 /* KeywordType.Lambda */) {
            return undefined;
        }
        return this._parseLambdaExpression(allowConditional);
    }
    // ('(' [yield_expr | testlist_comp] ')'
    // testlist_comp: (test | star_expr) (comp_for | (',' (test | star_expr))* [','])
    _parseTupleAtom() {
        var _a;
        const startParen = this._getNextToken();
        (0, debug_1.assert)(startParen.type === 13 /* TokenType.OpenParenthesis */);
        const yieldExpr = this._tryParseYieldExpression();
        if (yieldExpr) {
            if (this._peekTokenType() !== 14 /* TokenType.CloseParenthesis */) {
                return this._handleExpressionParseError(8 /* ErrorExpressionCategory.MissingTupleCloseParen */, localize_1.LocMessage.expectedCloseParen(), startParen, yieldExpr);
            }
            else {
                (0, parseNodes_1.extendRange)(yieldExpr, this._getNextToken());
            }
            return yieldExpr;
        }
        const exprListResult = this._parseTestListWithComprehension(/* isGenerator */ true);
        const tupleOrExpression = this._makeExpressionOrTuple(exprListResult, /* enclosedInParens */ true);
        (0, parseNodes_1.extendRange)(tupleOrExpression, startParen);
        if (this._peekTokenType() !== 14 /* TokenType.CloseParenthesis */) {
            return this._handleExpressionParseError(8 /* ErrorExpressionCategory.MissingTupleCloseParen */, localize_1.LocMessage.expectedCloseParen(), startParen, (_a = exprListResult.parseError) !== null && _a !== void 0 ? _a : tupleOrExpression);
        }
        else {
            (0, parseNodes_1.extendRange)(tupleOrExpression, this._getNextToken());
        }
        return tupleOrExpression;
    }
    // '[' [testlist_comp] ']'
    // testlist_comp: (test | star_expr) (comp_for | (',' (test | star_expr))* [','])
    _parseListAtom() {
        var _a;
        const startBracket = this._getNextToken();
        (0, debug_1.assert)(startBracket.type === 15 /* TokenType.OpenBracket */);
        const exprListResult = this._parseTestListWithComprehension(/* isGenerator */ false);
        const closeBracket = this._peekToken();
        if (!this._consumeTokenIfType(16 /* TokenType.CloseBracket */)) {
            return this._handleExpressionParseError(9 /* ErrorExpressionCategory.MissingListCloseBracket */, localize_1.LocMessage.expectedCloseBracket(), startBracket, (_a = exprListResult.parseError) !== null && _a !== void 0 ? _a : _createList());
        }
        return _createList();
        function _createList() {
            const listAtom = parseNodes_1.ListNode.create(startBracket);
            if (closeBracket) {
                (0, parseNodes_1.extendRange)(listAtom, closeBracket);
            }
            if (exprListResult.list.length > 0) {
                exprListResult.list.forEach((expr) => {
                    expr.parent = listAtom;
                });
                (0, parseNodes_1.extendRange)(listAtom, exprListResult.list[exprListResult.list.length - 1]);
            }
            listAtom.entries = exprListResult.list;
            return listAtom;
        }
    }
    _parseTestListWithComprehension(isGenerator) {
        let sawComprehension = false;
        return this._parseExpressionListGeneric(() => {
            let expr = this._parseTestOrStarExpression(/* allowAssignmentExpression */ true);
            const comprehension = this._tryParseComprehension(expr, isGenerator);
            if (comprehension) {
                expr = comprehension;
                sawComprehension = true;
            }
            return expr;
        }, () => this._isNextTokenNeverExpression(), () => sawComprehension);
    }
    // '{' [dictorsetmaker] '}'
    // dictorsetmaker: (
    //    (dictentry (comp_for | (',' dictentry)* [',']))
    //    | (setentry (comp_for | (',' setentry)* [',']))
    // )
    // dictentry: (test ':' test | '**' expr)
    // setentry: test | star_expr
    _parseDictionaryOrSetAtom() {
        const startBrace = this._getNextToken();
        (0, debug_1.assert)(startBrace.type === 17 /* TokenType.OpenCurlyBrace */);
        const dictionaryEntries = [];
        const setEntries = [];
        let isDictionary = false;
        let isSet = false;
        let sawComprehension = false;
        let isFirstEntry = true;
        let trailingCommaToken;
        while (true) {
            if (this._peekTokenType() === 18 /* TokenType.CloseCurlyBrace */) {
                break;
            }
            trailingCommaToken = undefined;
            let doubleStarExpression;
            let keyExpression;
            let valueExpression;
            const doubleStar = this._peekToken();
            if (this._consumeTokenIfOperator(29 /* OperatorType.Power */)) {
                doubleStarExpression = this._parseExpression(/* allowUnpack */ false);
            }
            else {
                keyExpression = this._parseTestOrStarExpression(/* allowAssignmentExpression */ true);
                // Allow walrus operators in this context only for Python 3.10 and newer.
                // Older versions of Python generated a syntax error in this context.
                let isWalrusAllowed = this._getLanguageVersion().isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_10);
                if (this._consumeTokenIfType(10 /* TokenType.Colon */)) {
                    valueExpression = this._parseTestExpression(/* allowAssignmentExpression */ false);
                    isWalrusAllowed = false;
                }
                if (!isWalrusAllowed &&
                    keyExpression.nodeType === 4 /* ParseNodeType.AssignmentExpression */ &&
                    !keyExpression.isParenthesized) {
                    this._addSyntaxError(localize_1.LocMessage.walrusNotAllowed(), keyExpression.walrusToken);
                }
            }
            if (keyExpression && valueExpression) {
                if (keyExpression.nodeType === 56 /* ParseNodeType.Unpack */) {
                    this._addSyntaxError(localize_1.LocMessage.unpackInDict(), keyExpression);
                }
                if (isSet) {
                    this._addSyntaxError(localize_1.LocMessage.keyValueInSet(), valueExpression);
                }
                else {
                    const keyEntryNode = parseNodes_1.DictionaryKeyEntryNode.create(keyExpression, valueExpression);
                    let dictEntry = keyEntryNode;
                    const comprehension = this._tryParseComprehension(keyEntryNode, /* isGenerator */ false);
                    if (comprehension) {
                        dictEntry = comprehension;
                        sawComprehension = true;
                        if (!isFirstEntry) {
                            this._addSyntaxError(localize_1.LocMessage.comprehensionInDict(), dictEntry);
                        }
                    }
                    dictionaryEntries.push(dictEntry);
                    isDictionary = true;
                }
            }
            else if (doubleStarExpression) {
                if (isSet) {
                    this._addSyntaxError(localize_1.LocMessage.unpackInSet(), doubleStarExpression);
                }
                else {
                    const listEntryNode = parseNodes_1.DictionaryExpandEntryNode.create(doubleStarExpression);
                    (0, parseNodes_1.extendRange)(listEntryNode, doubleStar);
                    let expandEntryNode = listEntryNode;
                    const comprehension = this._tryParseComprehension(listEntryNode, /* isGenerator */ false);
                    if (comprehension) {
                        expandEntryNode = comprehension;
                        sawComprehension = true;
                        if (!isFirstEntry) {
                            this._addSyntaxError(localize_1.LocMessage.comprehensionInDict(), doubleStarExpression);
                        }
                    }
                    dictionaryEntries.push(expandEntryNode);
                    isDictionary = true;
                }
            }
            else {
                (0, debug_1.assert)(keyExpression !== undefined);
                if (keyExpression) {
                    if (isDictionary) {
                        const missingValueErrorNode = parseNodes_1.ErrorNode.create(this._peekToken(), 13 /* ErrorExpressionCategory.MissingDictValue */);
                        const keyEntryNode = parseNodes_1.DictionaryKeyEntryNode.create(keyExpression, missingValueErrorNode);
                        dictionaryEntries.push(keyEntryNode);
                        this._addSyntaxError(localize_1.LocMessage.dictKeyValuePairs(), keyExpression);
                    }
                    else {
                        const comprehension = this._tryParseComprehension(keyExpression, /* isGenerator */ false);
                        if (comprehension) {
                            keyExpression = comprehension;
                            sawComprehension = true;
                            if (!isFirstEntry) {
                                this._addSyntaxError(localize_1.LocMessage.comprehensionInSet(), keyExpression);
                            }
                        }
                        setEntries.push(keyExpression);
                        isSet = true;
                    }
                }
            }
            // List comprehension statements always end the list.
            if (sawComprehension) {
                break;
            }
            if (this._peekTokenType() !== 12 /* TokenType.Comma */) {
                break;
            }
            trailingCommaToken = this._getNextToken();
            isFirstEntry = false;
        }
        let closeCurlyBrace = this._peekToken();
        if (!this._consumeTokenIfType(18 /* TokenType.CloseCurlyBrace */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedCloseBrace(), startBrace);
            closeCurlyBrace = undefined;
        }
        if (isSet) {
            const setAtom = parseNodes_1.SetNode.create(startBrace);
            if (closeCurlyBrace) {
                (0, parseNodes_1.extendRange)(setAtom, closeCurlyBrace);
            }
            if (setEntries.length > 0) {
                (0, parseNodes_1.extendRange)(setAtom, setEntries[setEntries.length - 1]);
            }
            setEntries.forEach((entry) => {
                entry.parent = setAtom;
            });
            setAtom.entries = setEntries;
            return setAtom;
        }
        const dictionaryAtom = parseNodes_1.DictionaryNode.create(startBrace);
        if (trailingCommaToken) {
            dictionaryAtom.trailingCommaToken = trailingCommaToken;
            (0, parseNodes_1.extendRange)(dictionaryAtom, trailingCommaToken);
        }
        if (closeCurlyBrace) {
            (0, parseNodes_1.extendRange)(dictionaryAtom, closeCurlyBrace);
        }
        if (dictionaryEntries.length > 0) {
            dictionaryEntries.forEach((entry) => {
                entry.parent = dictionaryAtom;
            });
            (0, parseNodes_1.extendRange)(dictionaryAtom, dictionaryEntries[dictionaryEntries.length - 1]);
        }
        dictionaryAtom.entries = dictionaryEntries;
        return dictionaryAtom;
    }
    _parseExpressionListGeneric(parser, terminalCheck = () => this._isNextTokenNeverExpression(), finalEntryCheck = () => false) {
        let trailingComma = false;
        const list = [];
        let parseError;
        while (true) {
            if (terminalCheck()) {
                break;
            }
            const expr = parser();
            if (expr.nodeType === 0 /* ParseNodeType.Error */) {
                parseError = expr;
                break;
            }
            list.push(expr);
            // Should we stop without checking for a trailing comma?
            if (finalEntryCheck()) {
                break;
            }
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                trailingComma = false;
                break;
            }
            trailingComma = true;
        }
        return { trailingComma, list, parseError };
    }
    // expr_stmt: testlist_star_expr (annassign | augassign (yield_expr | testlist) |
    //                     ('=' (yield_expr | testlist_star_expr))*)
    // testlist_star_expr: (test|star_expr) (',' (test|star_expr))* [',']
    // annassign: ':' test ['=' (yield_expr | testlist_star_expr)]
    // augassign: ('+=' | '-=' | '*=' | '@=' | '/=' | '%=' | '&=' | '|=' | '^=' |
    //             '<<=' | '>>=' | '**=' | '//=')
    _parseExpressionStatement() {
        var _a, _b;
        let leftExpr = this._parseTestOrStarListAsExpression(
        /* allowAssignmentExpression */ false, 
        /* allowMultipleUnpack */ false, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedExpr());
        let annotationExpr;
        if (leftExpr.nodeType === 0 /* ParseNodeType.Error */) {
            return leftExpr;
        }
        // Is this a type annotation assignment?
        if (this._consumeTokenIfType(10 /* TokenType.Colon */)) {
            annotationExpr = this._parseTypeAnnotation();
            leftExpr = parseNodes_1.TypeAnnotationNode.create(leftExpr, annotationExpr);
            if (!this._parseOptions.isStubFile && this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_6)) {
                this._addSyntaxError(localize_1.LocMessage.varAnnotationIllegal(), annotationExpr);
            }
            if (!this._consumeTokenIfOperator(2 /* OperatorType.Assign */)) {
                return leftExpr;
            }
            // This is an unfortunate hack that's necessary to accommodate 'TypeAlias'
            // declarations properly. We need to treat this assignment differently than
            // most because the expression on the right side is treated like a type
            // annotation and therefore allows string-literal forward declarations.
            const isTypeAliasDeclaration = this._isTypingAnnotation(annotationExpr, 'TypeAlias');
            const wasParsingTypeAnnotation = this._isParsingTypeAnnotation;
            if (isTypeAliasDeclaration) {
                this._isParsingTypeAnnotation = true;
            }
            const rightExpr = (_a = this._tryParseYieldExpression()) !== null && _a !== void 0 ? _a : this._parseTestOrStarListAsExpression(
            /* allowAssignmentExpression */ false, 
            /* allowMultipleUnpack */ true, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedAssignRightHandExpr());
            this._isParsingTypeAnnotation = wasParsingTypeAnnotation;
            return parseNodes_1.AssignmentNode.create(leftExpr, rightExpr);
        }
        // Is this a simple assignment?
        if (this._consumeTokenIfOperator(2 /* OperatorType.Assign */)) {
            return this._parseChainAssignments(leftExpr);
        }
        if (tokenizer_1.Tokenizer.isOperatorAssignment(this._peekOperatorType())) {
            const operatorToken = this._getNextToken();
            const rightExpr = (_b = this._tryParseYieldExpression()) !== null && _b !== void 0 ? _b : this._parseTestOrStarListAsExpression(
            /* allowAssignmentExpression */ false, 
            /* allowMultipleUnpack */ true, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedBinaryRightHandExpr());
            this._reportConditionalErrorForStarTupleElement(rightExpr, pythonVersion_1.pythonVersion3_9);
            // Make a shallow copy of the dest expression but give it a new ID.
            const destExpr = Object.assign({}, leftExpr);
            destExpr.id = (0, parseNodes_1.getNextNodeId)();
            return parseNodes_1.AugmentedAssignmentNode.create(leftExpr, rightExpr, operatorToken.operatorType, destExpr);
        }
        return leftExpr;
    }
    _parseChainAssignments(leftExpr) {
        var _a;
        // Make a list of assignment targets.
        const assignmentTargets = [leftExpr];
        let rightExpr;
        while (true) {
            rightExpr =
                (_a = this._tryParseYieldExpression()) !== null && _a !== void 0 ? _a : this._parseTestOrStarListAsExpression(
                /* allowAssignmentExpression */ false, 
                /* allowMultipleUnpack */ true, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedAssignRightHandExpr());
            if (rightExpr.nodeType === 0 /* ParseNodeType.Error */) {
                break;
            }
            // Continue until we've consumed the entire chain.
            if (!this._consumeTokenIfOperator(2 /* OperatorType.Assign */)) {
                break;
            }
            assignmentTargets.push(rightExpr);
        }
        // Create a tree of assignment expressions starting with the first one.
        // The final RHS value is assigned to the targets left to right in Python.
        let assignmentNode = parseNodes_1.AssignmentNode.create(assignmentTargets[0], rightExpr);
        // Look for a type annotation comment at the end of the line.
        const typeAnnotationComment = this._parseVariableTypeAnnotationComment();
        if (typeAnnotationComment) {
            if (assignmentTargets.length > 1) {
                // Type comments are not allowed for chained assignments for the
                // same reason that variable type annotations don't support
                // chained assignments. Note that a type comment was used here
                // so it can be later reported as an error by the binder.
                assignmentNode.chainedTypeAnnotationComment = typeAnnotationComment;
            }
            else {
                assignmentNode.typeAnnotationComment = typeAnnotationComment;
                assignmentNode.typeAnnotationComment.parent = assignmentNode;
                (0, parseNodes_1.extendRange)(assignmentNode, assignmentNode.typeAnnotationComment);
            }
        }
        assignmentTargets.forEach((target, index) => {
            if (index > 0) {
                assignmentNode = parseNodes_1.AssignmentNode.create(target, assignmentNode);
            }
        });
        return assignmentNode;
    }
    _parseFunctionTypeAnnotation() {
        const openParenToken = this._peekToken();
        if (!this._consumeTokenIfType(13 /* TokenType.OpenParenthesis */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedOpenParen(), this._peekToken());
            return undefined;
        }
        let paramAnnotations = [];
        while (true) {
            const nextTokenType = this._peekTokenType();
            if (nextTokenType === 14 /* TokenType.CloseParenthesis */ ||
                nextTokenType === 2 /* TokenType.NewLine */ ||
                nextTokenType === 1 /* TokenType.EndOfStream */) {
                break;
            }
            // Consume "*" or "**" indicators but don't do anything with them.
            // (We don't enforce that these are present, absent, or match
            // the corresponding parameter types.)
            this._consumeTokenIfOperator(26 /* OperatorType.Multiply */) || this._consumeTokenIfOperator(29 /* OperatorType.Power */);
            const paramAnnotation = this._parseTypeAnnotation();
            paramAnnotations.push(paramAnnotation);
            if (!this._consumeTokenIfType(12 /* TokenType.Comma */)) {
                break;
            }
        }
        if (!this._consumeTokenIfType(14 /* TokenType.CloseParenthesis */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedCloseParen(), openParenToken);
            this._consumeTokensUntilType([10 /* TokenType.Colon */]);
        }
        if (!this._consumeTokenIfType(21 /* TokenType.Arrow */)) {
            this._addSyntaxError(localize_1.LocMessage.expectedArrow(), this._peekToken());
            return undefined;
        }
        const returnType = this._parseTypeAnnotation();
        let isParamListEllipsis = false;
        if (paramAnnotations.length === 1 && paramAnnotations[0].nodeType === 21 /* ParseNodeType.Ellipsis */) {
            paramAnnotations = [];
            isParamListEllipsis = true;
        }
        return parseNodes_1.FunctionAnnotationNode.create(openParenToken, isParamListEllipsis, paramAnnotations, returnType);
    }
    _parseTypeAnnotation(allowUnpack = false) {
        // Temporary set a flag that indicates we're parsing a type annotation.
        const wasParsingTypeAnnotation = this._isParsingTypeAnnotation;
        this._isParsingTypeAnnotation = true;
        // Allow unpack operators.
        const startToken = this._peekToken();
        const isUnpack = this._consumeTokenIfOperator(26 /* OperatorType.Multiply */);
        if (isUnpack &&
            allowUnpack &&
            !this._parseOptions.isStubFile &&
            !this._isParsingQuotedText &&
            this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_11)) {
            this._addSyntaxError(localize_1.LocMessage.unpackedSubscriptIllegal(), startToken);
        }
        let result = this._parseTestExpression(/* allowAssignmentExpression */ false);
        if (isUnpack) {
            result = parseNodes_1.UnpackNode.create(startToken, result);
        }
        this._isParsingTypeAnnotation = wasParsingTypeAnnotation;
        return result;
    }
    _reportStringTokenErrors(stringToken, unescapedResult) {
        if (stringToken.flags & 65536 /* StringTokenFlags.Unterminated */) {
            this._addSyntaxError(localize_1.LocMessage.stringUnterminated(), stringToken);
        }
        if (unescapedResult === null || unescapedResult === void 0 ? void 0 : unescapedResult.nonAsciiInBytes) {
            this._addSyntaxError(localize_1.LocMessage.stringNonAsciiBytes(), stringToken);
        }
        if (stringToken.flags & 64 /* StringTokenFlags.Format */) {
            if (this._getLanguageVersion().isLessThan(pythonVersion_1.pythonVersion3_6)) {
                this._addSyntaxError(localize_1.LocMessage.formatStringIllegal(), stringToken);
            }
            if (stringToken.flags & 32 /* StringTokenFlags.Bytes */) {
                this._addSyntaxError(localize_1.LocMessage.formatStringBytes(), stringToken);
            }
            if (stringToken.flags & 16 /* StringTokenFlags.Unicode */) {
                this._addSyntaxError(localize_1.LocMessage.formatStringUnicode(), stringToken);
            }
        }
    }
    _makeStringNode(stringToken) {
        const unescapedResult = StringTokenUtils.getUnescapedString(stringToken);
        this._reportStringTokenErrors(stringToken, unescapedResult);
        return parseNodes_1.StringNode.create(stringToken, unescapedResult.value);
    }
    _getTypeAnnotationCommentText() {
        if (this._tokenIndex === 0) {
            return undefined;
        }
        const curToken = this._tokenizerOutput.tokens.getItemAt(this._tokenIndex - 1);
        const nextToken = this._tokenizerOutput.tokens.getItemAt(this._tokenIndex);
        if (curToken.start + curToken.length === nextToken.start) {
            return undefined;
        }
        const interTokenContents = this._fileContents.slice(curToken.start + curToken.length, nextToken.start);
        const commentRegEx = /^(\s*#\s*type:\s*)([^\r\n]*)/;
        const match = interTokenContents.match(commentRegEx);
        if (!match) {
            return undefined;
        }
        // Synthesize a string token and StringNode.
        const typeString = match[2];
        // Ignore all "ignore" comments. Include "[" in the regular
        // expression because mypy supports ignore comments of the
        // form ignore[errorCode, ...]. We'll treat these as regular
        // ignore statements (as though no errorCodes were included).
        if (typeString.trim().match(/^ignore(\s|\[|$)/)) {
            return undefined;
        }
        const tokenOffset = curToken.start + curToken.length + match[1].length;
        return tokenizerTypes_1.StringToken.create(tokenOffset, typeString.length, 0 /* StringTokenFlags.None */, typeString, 0, 
        /* comments */ undefined);
    }
    _parseVariableTypeAnnotationComment() {
        const stringToken = this._getTypeAnnotationCommentText();
        if (!stringToken) {
            return undefined;
        }
        const stringNode = this._makeStringNode(stringToken);
        const stringListNode = parseNodes_1.StringListNode.create([stringNode]);
        const parser = new Parser();
        const parseResults = parser.parseTextExpression(this._fileContents, stringToken.start, stringToken.length, this._parseOptions, 1 /* ParseTextMode.VariableAnnotation */, 
        /* initialParenDepth */ undefined, this._typingSymbolAliases);
        parseResults.diagnostics.forEach((diag) => {
            this._addSyntaxError(diag.message, stringListNode);
        });
        if (!parseResults.parseTree) {
            return undefined;
        }
        (0, debug_1.assert)(parseResults.parseTree.nodeType !== 62 /* ParseNodeType.FunctionAnnotation */);
        return parseResults.parseTree;
    }
    _parseFunctionTypeAnnotationComment(stringToken, functionNode) {
        const stringNode = this._makeStringNode(stringToken);
        const stringListNode = parseNodes_1.StringListNode.create([stringNode]);
        const parser = new Parser();
        const parseResults = parser.parseTextExpression(this._fileContents, stringToken.start, stringToken.length, this._parseOptions, 2 /* ParseTextMode.FunctionAnnotation */, 
        /* initialParenDepth */ undefined, this._typingSymbolAliases);
        parseResults.diagnostics.forEach((diag) => {
            this._addSyntaxError(diag.message, stringListNode);
        });
        if (!parseResults.parseTree || parseResults.parseTree.nodeType !== 62 /* ParseNodeType.FunctionAnnotation */) {
            return;
        }
        const functionAnnotation = parseResults.parseTree;
        functionNode.functionAnnotationComment = functionAnnotation;
        functionAnnotation.parent = functionNode;
        (0, parseNodes_1.extendRange)(functionNode, functionAnnotation);
    }
    _parseFStringReplacementField(fieldExpressions, middleTokens, formatExpressions, nestingDepth = 0) {
        var _a;
        let nextToken = this._getNextToken();
        // The caller should have already confirmed that the next token is an open brace.
        (0, debug_1.assert)(nextToken.type === 17 /* TokenType.OpenCurlyBrace */);
        // Consume the expression.
        const expr = (_a = this._tryParseYieldExpression()) !== null && _a !== void 0 ? _a : this._parseTestOrStarListAsExpression(
        /* allowAssignmentExpression */ true, 
        /* allowMultipleUnpack */ true, 2 /* ErrorExpressionCategory.MissingExpression */, () => localize_1.LocMessage.expectedExpr());
        fieldExpressions.push(expr);
        if (expr.nodeType === 0 /* ParseNodeType.Error */) {
            return false;
        }
        // Consume an optional "=" token after the expression.
        nextToken = this._peekToken();
        if (nextToken.type === 9 /* TokenType.Operator */ &&
            nextToken.operatorType === 2 /* OperatorType.Assign */) {
            // This feature requires Python 3.8 or newer.
            if (this._parseOptions.pythonVersion.isLessThan(pythonVersion_1.pythonVersion3_8)) {
                this._addSyntaxError(localize_1.LocMessage.formatStringDebuggingIllegal(), nextToken);
            }
            this._getNextToken();
            nextToken = this._peekToken();
        }
        // Consume an optional !r, !s, or !a token.
        if (nextToken.type === 23 /* TokenType.ExclamationMark */) {
            this._getNextToken();
            nextToken = this._peekToken();
            if (nextToken.type !== 7 /* TokenType.Identifier */) {
                this._addSyntaxError(localize_1.LocMessage.formatStringExpectedConversion(), nextToken);
            }
            else {
                this._getNextToken();
                nextToken = this._peekToken();
            }
        }
        if (nextToken.type === 10 /* TokenType.Colon */) {
            this._getNextToken();
            this._parseFStringFormatString(fieldExpressions, middleTokens, formatExpressions, nestingDepth);
            nextToken = this._peekToken();
        }
        if (nextToken.type !== 18 /* TokenType.CloseCurlyBrace */) {
            this._addSyntaxError(localize_1.LocMessage.formatStringUnterminated(), nextToken);
            return false;
        }
        else {
            this._getNextToken();
        }
        // Indicate success.
        return true;
    }
    _parseFStringFormatString(fieldExpressions, middleTokens, formatExpressions, nestingDepth) {
        while (true) {
            const nextToken = this._peekToken();
            if (nextToken.type === 18 /* TokenType.CloseCurlyBrace */ || nextToken.type === 26 /* TokenType.FStringEnd */) {
                break;
            }
            if (nextToken.type === 25 /* TokenType.FStringMiddle */) {
                this._getNextToken();
                continue;
            }
            if (nextToken.type === 17 /* TokenType.OpenCurlyBrace */) {
                // The Python interpreter reports an error at the point where the
                // nesting level exceeds 1. Don't report the error again for deeper nestings.
                if (nestingDepth === 2) {
                    this._addSyntaxError(localize_1.LocMessage.formatStringNestedFormatSpecifier(), nextToken);
                }
                this._parseFStringReplacementField(fieldExpressions, middleTokens, formatExpressions, nestingDepth + 1);
                continue;
            }
            break;
        }
    }
    _parseFormatString(startToken) {
        const middleTokens = [];
        const fieldExpressions = [];
        const formatExpressions = [];
        let endToken = undefined;
        // Consume middle tokens and expressions until we hit a "{" or "}" token.
        while (true) {
            const nextToken = this._peekToken();
            if (nextToken.type === 26 /* TokenType.FStringEnd */) {
                endToken = nextToken;
                if ((endToken.flags & 65536 /* StringTokenFlags.Unterminated */) !== 0) {
                    this._addSyntaxError(localize_1.LocMessage.stringUnterminated(), startToken);
                }
                this._getNextToken();
                break;
            }
            if (nextToken.type === 25 /* TokenType.FStringMiddle */) {
                middleTokens.push(nextToken);
                this._getNextToken();
                continue;
            }
            if (nextToken.type === 17 /* TokenType.OpenCurlyBrace */) {
                if (!this._parseFStringReplacementField(fieldExpressions, middleTokens, formatExpressions)) {
                    // An error was reported. Try to recover the parse.
                    if (this._consumeTokensUntilType([26 /* TokenType.FStringEnd */, 2 /* TokenType.NewLine */])) {
                        if (this._peekToken().type === 26 /* TokenType.FStringEnd */) {
                            this._getNextToken();
                        }
                    }
                    break;
                }
                continue;
            }
            // We've hit an error. Consume tokens until we find the end.
            if (this._consumeTokensUntilType([26 /* TokenType.FStringEnd */])) {
                this._getNextToken();
            }
            this._addSyntaxError(nextToken.type === 18 /* TokenType.CloseCurlyBrace */
                ? localize_1.LocMessage.formatStringBrace()
                : localize_1.LocMessage.stringUnterminated(), nextToken);
            break;
        }
        this._reportStringTokenErrors(startToken);
        return parseNodes_1.FormatStringNode.create(startToken, endToken, middleTokens, fieldExpressions, formatExpressions);
    }
    _createBinaryOperationNode(leftExpression, rightExpression, operatorToken, operator) {
        // Determine if we're exceeding the max parse depth. If so, replace
        // the subnode with an error node. Otherwise we risk crashing in the binder
        // or type evaluator.
        if (leftExpression.maxChildDepth !== undefined && leftExpression.maxChildDepth >= maxChildNodeDepth) {
            leftExpression = parseNodes_1.ErrorNode.create(leftExpression, 14 /* ErrorExpressionCategory.MaxDepthExceeded */);
            this._addSyntaxError(localize_1.LocMessage.maxParseDepthExceeded(), leftExpression);
        }
        if (rightExpression.maxChildDepth !== undefined && rightExpression.maxChildDepth >= maxChildNodeDepth) {
            rightExpression = parseNodes_1.ErrorNode.create(rightExpression, 14 /* ErrorExpressionCategory.MaxDepthExceeded */);
            this._addSyntaxError(localize_1.LocMessage.maxParseDepthExceeded(), rightExpression);
        }
        return parseNodes_1.BinaryOperationNode.create(leftExpression, rightExpression, operatorToken, operator);
    }
    _createUnaryOperationNode(operatorToken, expression, operator) {
        // Determine if we're exceeding the max parse depth. If so, replace
        // the subnode with an error node. Otherwise we risk crashing in the binder
        // or type evaluator.
        if (expression.maxChildDepth !== undefined && expression.maxChildDepth >= maxChildNodeDepth) {
            expression = parseNodes_1.ErrorNode.create(expression, 14 /* ErrorExpressionCategory.MaxDepthExceeded */);
            this._addSyntaxError(localize_1.LocMessage.maxParseDepthExceeded(), expression);
        }
        return parseNodes_1.UnaryOperationNode.create(operatorToken, expression, operator);
    }
    _parseStringList() {
        const stringList = [];
        while (true) {
            const nextToken = this._peekToken();
            if (nextToken.type === 5 /* TokenType.String */) {
                stringList.push(this._makeStringNode(this._getNextToken()));
            }
            else if (nextToken.type === 24 /* TokenType.FStringStart */) {
                stringList.push(this._parseFormatString(this._getNextToken()));
            }
            else {
                break;
            }
        }
        const stringNode = parseNodes_1.StringListNode.create(stringList);
        // If we're parsing a type annotation, parse the contents of the string.
        if (this._isParsingTypeAnnotation) {
            // Don't allow multiple strings because we have no way of reporting
            // parse errors that span strings.
            if (stringNode.strings.length > 1) {
                if (this._isParsingQuotedText) {
                    this._addSyntaxError(localize_1.LocMessage.annotationSpansStrings(), stringNode);
                }
            }
            else if (stringNode.strings[0].nodeType === 30 /* ParseNodeType.FormatString */) {
                if (this._isParsingQuotedText) {
                    this._addSyntaxError(localize_1.LocMessage.annotationFormatString(), stringNode);
                }
            }
            else {
                const stringToken = stringNode.strings[0].token;
                const stringValue = StringTokenUtils.getUnescapedString(stringNode.strings[0].token);
                const unescapedString = stringValue.value;
                const tokenOffset = stringToken.start;
                const prefixLength = stringToken.prefixLength + stringToken.quoteMarkLength;
                // Don't allow escape characters because we have no way of mapping
                // error ranges back to the escaped text.
                if (unescapedString.length !== stringToken.length - prefixLength - stringToken.quoteMarkLength) {
                    if (this._isParsingQuotedText) {
                        this._addSyntaxError(localize_1.LocMessage.annotationStringEscape(), stringNode);
                    }
                }
                else if ((stringToken.flags & (8 /* StringTokenFlags.Raw */ | 32 /* StringTokenFlags.Bytes */ | 64 /* StringTokenFlags.Format */)) ===
                    0) {
                    const parser = new Parser();
                    const parseResults = parser.parseTextExpression(this._fileContents, tokenOffset + prefixLength, unescapedString.length, this._parseOptions, 1 /* ParseTextMode.VariableAnnotation */, (stringNode.strings[0].token.flags & 4 /* StringTokenFlags.Triplicate */) !== 0 ? 1 : 0, this._typingSymbolAliases);
                    if (parseResults.diagnostics.length === 0 ||
                        this._parseOptions.reportErrorsForParsedStringContents) {
                        parseResults.diagnostics.forEach((diag) => {
                            this._addSyntaxError(diag.message, stringNode);
                        });
                        if (parseResults.parseTree) {
                            (0, debug_1.assert)(parseResults.parseTree.nodeType !== 62 /* ParseNodeType.FunctionAnnotation */);
                            stringNode.typeAnnotation = parseResults.parseTree;
                            stringNode.typeAnnotation.parent = stringNode;
                        }
                    }
                }
            }
        }
        return stringNode;
    }
    // Python 3.8 added support for star (unpack) expressions in tuples
    // following a return or yield statement in cases where the tuple
    // wasn't surrounded in parentheses.
    _reportConditionalErrorForStarTupleElement(possibleTupleExpr, pythonVersion = pythonVersion_1.pythonVersion3_8) {
        if (possibleTupleExpr.nodeType !== 52 /* ParseNodeType.Tuple */) {
            return;
        }
        if (possibleTupleExpr.enclosedInParens) {
            return;
        }
        if (this._parseOptions.pythonVersion.isGreaterOrEqualTo(pythonVersion)) {
            return;
        }
        for (const expr of possibleTupleExpr.expressions) {
            if (expr.nodeType === 56 /* ParseNodeType.Unpack */) {
                this._addSyntaxError(localize_1.LocMessage.unpackTuplesIllegal(), expr);
                return;
            }
        }
    }
    // Peeks at the next token and returns true if it can never
    // represent the start of an expression.
    _isNextTokenNeverExpression() {
        const nextToken = this._peekToken();
        switch (nextToken.type) {
            case 8 /* TokenType.Keyword */: {
                switch (this._peekKeywordType()) {
                    case 17 /* KeywordType.For */:
                    case 22 /* KeywordType.In */:
                    case 20 /* KeywordType.If */:
                        return true;
                }
                break;
            }
            case 9 /* TokenType.Operator */: {
                switch (this._peekOperatorType()) {
                    case 1 /* OperatorType.AddEqual */:
                    case 34 /* OperatorType.SubtractEqual */:
                    case 27 /* OperatorType.MultiplyEqual */:
                    case 11 /* OperatorType.DivideEqual */:
                    case 25 /* OperatorType.ModEqual */:
                    case 4 /* OperatorType.BitwiseAndEqual */:
                    case 7 /* OperatorType.BitwiseOrEqual */:
                    case 9 /* OperatorType.BitwiseXorEqual */:
                    case 18 /* OperatorType.LeftShiftEqual */:
                    case 32 /* OperatorType.RightShiftEqual */:
                    case 30 /* OperatorType.PowerEqual */:
                    case 14 /* OperatorType.FloorDivideEqual */:
                    case 2 /* OperatorType.Assign */:
                        return true;
                }
                break;
            }
            case 3 /* TokenType.Indent */:
            case 4 /* TokenType.Dedent */:
            case 2 /* TokenType.NewLine */:
            case 1 /* TokenType.EndOfStream */:
            case 11 /* TokenType.Semicolon */:
            case 14 /* TokenType.CloseParenthesis */:
            case 16 /* TokenType.CloseBracket */:
            case 18 /* TokenType.CloseCurlyBrace */:
            case 12 /* TokenType.Comma */:
            case 10 /* TokenType.Colon */:
            case 23 /* TokenType.ExclamationMark */:
            case 25 /* TokenType.FStringMiddle */:
            case 26 /* TokenType.FStringEnd */:
                return true;
        }
        return false;
    }
    _disallowAssignmentExpression(callback) {
        const wasAllowed = this._assignmentExpressionsAllowed;
        this._assignmentExpressionsAllowed = false;
        callback();
        this._assignmentExpressionsAllowed = wasAllowed;
    }
    _getNextToken() {
        const token = this._tokenizerOutput.tokens.getItemAt(this._tokenIndex);
        if (!this._atEof()) {
            this._tokenIndex++;
        }
        return token;
    }
    _atEof() {
        // Are we pointing at the last token in the stream (which is
        // assumed to be an end-of-stream token)?
        return this._tokenIndex >= this._tokenizerOutput.tokens.count - 1;
    }
    _peekToken(count = 0) {
        if (this._tokenIndex + count < 0) {
            return this._tokenizerOutput.tokens.getItemAt(0);
        }
        if (this._tokenIndex + count >= this._tokenizerOutput.tokens.count) {
            return this._tokenizerOutput.tokens.getItemAt(this._tokenizerOutput.tokens.count - 1);
        }
        return this._tokenizerOutput.tokens.getItemAt(this._tokenIndex + count);
    }
    _peekTokenType() {
        return this._peekToken().type;
    }
    _peekKeywordType() {
        const nextToken = this._peekToken();
        if (nextToken.type !== 8 /* TokenType.Keyword */) {
            return undefined;
        }
        return nextToken.keywordType;
    }
    _peekOperatorType() {
        const nextToken = this._peekToken();
        if (nextToken.type !== 9 /* TokenType.Operator */) {
            return undefined;
        }
        return nextToken.operatorType;
    }
    _getTokenIfIdentifier() {
        const nextToken = this._peekToken();
        if (nextToken.type === 7 /* TokenType.Identifier */) {
            return this._getNextToken();
        }
        // If the next token is invalid, treat it as an identifier.
        if (nextToken.type === 0 /* TokenType.Invalid */) {
            this._getNextToken();
            this._addSyntaxError(localize_1.LocMessage.invalidIdentifierChar(), nextToken);
            return tokenizerTypes_1.IdentifierToken.create(nextToken.start, nextToken.length, '', nextToken.comments);
        }
        // If this is a "soft keyword", it can be converted into an identifier.
        if (nextToken.type === 8 /* TokenType.Keyword */) {
            const keywordToken = nextToken;
            if (tokenizerTypes_1.KeywordToken.isSoftKeyword(keywordToken)) {
                const keywordText = this._fileContents.substr(nextToken.start, nextToken.length);
                this._getNextToken();
                return tokenizerTypes_1.IdentifierToken.create(nextToken.start, nextToken.length, keywordText, nextToken.comments);
            }
        }
        return undefined;
    }
    // Consumes tokens until the next one in the stream is
    // either a specified terminator or the end-of-stream
    // token.
    _consumeTokensUntilType(terminators) {
        while (true) {
            const token = this._peekToken();
            if (terminators.some((term) => term === token.type)) {
                return true;
            }
            if (token.type === 1 /* TokenType.EndOfStream */) {
                return false;
            }
            this._getNextToken();
        }
    }
    _getTokenIfType(tokenType) {
        if (this._peekTokenType() === tokenType) {
            return this._getNextToken();
        }
        return undefined;
    }
    _consumeTokenIfType(tokenType) {
        return !!this._getTokenIfType(tokenType);
    }
    _consumeTokenIfKeyword(keywordType) {
        if (this._peekKeywordType() === keywordType) {
            this._getNextToken();
            return true;
        }
        return false;
    }
    _consumeTokenIfOperator(operatorType) {
        if (this._peekOperatorType() === operatorType) {
            this._getNextToken();
            return true;
        }
        return false;
    }
    _getKeywordToken(keywordType) {
        const keywordToken = this._getNextToken();
        (0, debug_1.assert)(keywordToken.type === 8 /* TokenType.Keyword */);
        (0, debug_1.assert)(keywordToken.keywordType === keywordType);
        return keywordToken;
    }
    _getLanguageVersion() {
        return this._parseOptions.pythonVersion;
    }
    _suppressErrors(callback) {
        const errorsWereSuppressed = this._areErrorsSuppressed;
        try {
            this._areErrorsSuppressed = true;
            callback();
        }
        finally {
            this._areErrorsSuppressed = errorsWereSuppressed;
        }
    }
    _addSyntaxError(message, range) {
        (0, debug_1.assert)(range !== undefined);
        if (!this._areErrorsSuppressed) {
            this._diagSink.addError(message, (0, positionUtils_1.convertOffsetsToRange)(range.start, range.start + range.length, this._tokenizerOutput.lines));
        }
    }
}
exports.Parser = Parser;
//# sourceMappingURL=parser.js.map