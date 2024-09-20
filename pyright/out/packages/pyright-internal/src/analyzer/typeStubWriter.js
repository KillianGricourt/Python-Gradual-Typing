"use strict";
/*
 * typeStubWriter.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic to emit a type stub file for a corresponding parsed
 * and analyzed python source file.
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
exports.TypeStubWriter = void 0;
const parseNodes_1 = require("../parser/parseNodes");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const parseTreeWalker_1 = require("./parseTreeWalker");
const scopeUtils_1 = require("./scopeUtils");
const SymbolNameUtils = __importStar(require("./symbolNameUtils"));
const types_1 = require("./types");
class TrackedImport {
    constructor(importName) {
        this.importName = importName;
        this.isAccessed = false;
    }
}
class TrackedImportAs extends TrackedImport {
    constructor(importName, alias, symbol) {
        super(importName);
        this.alias = alias;
        this.symbol = symbol;
    }
}
class TrackedImportFrom extends TrackedImport {
    constructor(importName, isWildcardImport, node) {
        super(importName);
        this.isWildcardImport = isWildcardImport;
        this.node = node;
        this.symbols = [];
    }
    addSymbol(symbol, name, alias, isAccessed = false) {
        if (!this.symbols.find((s) => s.name === name)) {
            this.symbols.push({
                symbol,
                name,
                alias,
                isAccessed,
            });
        }
    }
}
class ImportSymbolWalker extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_accessedImportedSymbols, _treatStringsAsSymbols) {
        super();
        this._accessedImportedSymbols = _accessedImportedSymbols;
        this._treatStringsAsSymbols = _treatStringsAsSymbols;
    }
    analyze(node) {
        this.walk(node);
    }
    walk(node) {
        if (!AnalyzerNodeInfo.isCodeUnreachable(node)) {
            super.walk(node);
        }
    }
    visitName(node) {
        this._accessedImportedSymbols.add(node.value);
        return true;
    }
    visitMemberAccess(node) {
        const baseExpression = this._getRecursiveModuleAccessExpression(node.leftExpression);
        if (baseExpression) {
            this._accessedImportedSymbols.add(`${baseExpression}.${node.memberName.value}`);
        }
        return true;
    }
    visitString(node) {
        if (this._treatStringsAsSymbols) {
            this._accessedImportedSymbols.add(node.value);
        }
        return true;
    }
    _getRecursiveModuleAccessExpression(node) {
        if (node.nodeType === 38 /* ParseNodeType.Name */) {
            return node.value;
        }
        if (node.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            const baseExpression = this._getRecursiveModuleAccessExpression(node.leftExpression);
            if (!baseExpression) {
                return undefined;
            }
            return `${baseExpression}.${node.memberName.value}`;
        }
        return undefined;
    }
}
class TypeStubWriter extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_stubPath, _sourceFile, _evaluator) {
        super();
        this._stubPath = _stubPath;
        this._sourceFile = _sourceFile;
        this._evaluator = _evaluator;
        this._indentAmount = 0;
        this._includeAllImports = false;
        this._typeStubText = '';
        this._lineEnd = '\n';
        this._tab = '    ';
        this._classNestCount = 0;
        this._functionNestCount = 0;
        this._ifNestCount = 0;
        this._emittedSuite = false;
        this._emitDocString = true;
        this._trackedImportAs = new Map();
        this._trackedImportFrom = new Map();
        this._accessedImportedSymbols = new Set();
        // As a heuristic, we'll include all of the import statements
        // in "__init__.pyi" files even if they're not locally referenced
        // because these are often used as ways to re-export symbols.
        if (this._stubPath.fileName === '__init__.pyi') {
            this._includeAllImports = true;
        }
    }
    write() {
        const parseResults = this._sourceFile.getParseResults();
        this._lineEnd = parseResults.tokenizerOutput.predominantEndOfLineSequence;
        this._tab = parseResults.tokenizerOutput.predominantTabSequence;
        this.walk(parseResults.parserOutput.parseTree);
        this._writeFile();
    }
    walk(node) {
        if (!AnalyzerNodeInfo.isCodeUnreachable(node)) {
            super.walk(node);
        }
    }
    visitClass(node) {
        const className = node.name.value;
        this._emittedSuite = true;
        this._emitDocString = true;
        this._emitDecorators(node.decorators);
        let line = `class ${className}`;
        if (node.typeParameters) {
            line += this._printTypeParameters(node.typeParameters);
        }
        // Remove "object" from the list, since it's implied
        const args = node.arguments.filter((arg) => arg.name !== undefined ||
            arg.argumentCategory !== 0 /* ArgumentCategory.Simple */ ||
            arg.valueExpression.nodeType !== 38 /* ParseNodeType.Name */ ||
            arg.valueExpression.value !== 'object');
        if (args.length > 0) {
            line += `(${args
                .map((arg) => {
                let argString = '';
                if (arg.name) {
                    argString = arg.name.value + '=';
                }
                argString += this._printExpression(arg.valueExpression);
                return argString;
            })
                .join(', ')})`;
        }
        line += ':';
        this._emitLine(line);
        this._emitSuite(() => {
            this._classNestCount++;
            this.walk(node.suite);
            this._classNestCount--;
        });
        this._emitLine('');
        this._emitLine('');
        return false;
    }
    visitFunction(node) {
        const functionName = node.name.value;
        // Skip if we're already within a function or if the name is private/protected.
        if (this._functionNestCount === 0 && !SymbolNameUtils.isPrivateOrProtectedName(functionName)) {
            this._emittedSuite = true;
            this._emitDocString = true;
            this._emitDecorators(node.decorators);
            let line = node.isAsync ? 'async ' : '';
            line += `def ${functionName}`;
            if (node.typeParameters) {
                line += this._printTypeParameters(node.typeParameters);
            }
            line += `(${node.parameters.map((param, index) => this._printParameter(param, node, index)).join(', ')})`;
            let returnAnnotation;
            if (node.returnTypeAnnotation) {
                returnAnnotation = this._printExpression(node.returnTypeAnnotation, /* treatStringsAsSymbols */ true);
            }
            else if (node.functionAnnotationComment) {
                returnAnnotation = this._printExpression(node.functionAnnotationComment.returnTypeAnnotation, 
                /* treatStringsAsSymbols */ true);
            }
            else {
                // Handle a few common cases where we always know the answer.
                if (node.name.value === '__init__') {
                    returnAnnotation = 'None';
                }
                else if (node.name.value === '__str__') {
                    returnAnnotation = 'str';
                }
                else if (['__int__', '__hash__'].some((name) => name === node.name.value)) {
                    returnAnnotation = 'int';
                }
                else if (['__eq__', '__ne__', '__gt__', '__lt__', '__ge__', '__le__'].some((name) => name === node.name.value)) {
                    returnAnnotation = 'bool';
                }
            }
            if (returnAnnotation) {
                line += ' -> ' + returnAnnotation;
            }
            line += ':';
            // If there was not return type annotation, see if we can infer
            // a type that is not unknown and add it as a comment.
            if (!returnAnnotation) {
                const functionType = this._evaluator.getTypeOfFunction(node);
                if (functionType && (0, types_1.isFunction)(functionType.functionType)) {
                    let returnType = this._evaluator.getFunctionInferredReturnType(functionType.functionType);
                    returnType = (0, types_1.removeUnknownFromUnion)(returnType);
                    if (!(0, types_1.isNever)(returnType) && !(0, types_1.isUnknown)(returnType)) {
                        line += ` # -> ${this._evaluator.printType(returnType, { enforcePythonSyntax: true })}:`;
                    }
                }
            }
            this._emitLine(line);
            this._emitSuite(() => {
                // Don't emit any nested functions.
                this._functionNestCount++;
                this.walk(node.suite);
                this._functionNestCount--;
            });
            this._emitLine('');
        }
        return false;
    }
    visitWhile(node) {
        // Don't emit a doc string after the first statement.
        this._emitDocString = false;
        return false;
    }
    visitFor(node) {
        // Don't emit a doc string after the first statement.
        this._emitDocString = false;
        return false;
    }
    visitTry(node) {
        // Don't emit a doc string after the first statement.
        this._emitDocString = false;
        // Only walk a single branch of the try/catch to for imports.
        this.walk(node.trySuite);
        return false;
    }
    visitWith(node) {
        // Don't emit a doc string after the first statement.
        this._emitDocString = false;
        return false;
    }
    visitIf(node) {
        // Don't emit a doc string after the first statement.
        this._emitDocString = false;
        // Include if statements if they are located
        // at the global scope.
        if (this._functionNestCount === 0 && this._ifNestCount === 0) {
            this._ifNestCount++;
            this._emittedSuite = true;
            this._emitLine('if ' + this._printExpression(node.testExpression) + ':');
            this._emitSuite(() => {
                this.walkMultiple(node.ifSuite.statements);
            });
            const elseSuite = node.elseSuite;
            if (elseSuite) {
                this._emitLine('else:');
                this._emitSuite(() => {
                    if (elseSuite.nodeType === 22 /* ParseNodeType.If */) {
                        this.walkMultiple([elseSuite.testExpression, elseSuite.ifSuite, elseSuite.elseSuite]);
                    }
                    else {
                        this.walkMultiple(elseSuite.statements);
                    }
                });
            }
            this._ifNestCount--;
        }
        return false;
    }
    visitTypeAlias(node) {
        let line = '';
        line = this._printExpression(node.name);
        if (node.typeParameters) {
            line += this._printTypeParameters(node.typeParameters);
        }
        line += ' = ';
        line += this._printExpression(node.expression);
        this._emitLine(line);
        return false;
    }
    visitAssignment(node) {
        let isTypeAlias = false;
        let line = '';
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */) {
            // Handle "__all__" as a special case.
            if (node.leftExpression.value === '__all__') {
                if (this._functionNestCount === 0 && this._ifNestCount === 0) {
                    this._emittedSuite = true;
                    line = this._printExpression(node.leftExpression);
                    line += ' = ';
                    line += this._printExpression(node.rightExpression);
                    this._emitLine(line);
                }
                return false;
            }
            if (this._functionNestCount === 0) {
                line = this._printExpression(node.leftExpression);
                if (node.typeAnnotationComment) {
                    line += ': ' + this._printExpression(node.typeAnnotationComment, /* treatStringsAsSymbols */ true);
                }
                const valueType = this._evaluator.getType(node.leftExpression);
                if (valueType === null || valueType === void 0 ? void 0 : valueType.typeAliasInfo) {
                    isTypeAlias = true;
                }
                else if (node.rightExpression.nodeType === 9 /* ParseNodeType.Call */) {
                    // Special-case TypeVar, TypeVarTuple, ParamSpec and NewType calls. Treat
                    // them like type aliases.
                    const callBaseType = this._evaluator.getType(node.rightExpression.leftExpression);
                    if (callBaseType &&
                        (0, types_1.isInstantiableClass)(callBaseType) &&
                        types_1.ClassType.isBuiltIn(callBaseType, ['TypeVar', 'TypeVarTuple', 'ParamSpec', 'NewType'])) {
                        isTypeAlias = true;
                    }
                }
            }
        }
        else if (node.leftExpression.nodeType === 54 /* ParseNodeType.TypeAnnotation */) {
            const valueExpr = node.leftExpression.valueExpression;
            if (valueExpr.nodeType === 38 /* ParseNodeType.Name */) {
                if (this._functionNestCount === 0) {
                    line = `${this._printExpression(valueExpr)}: ${this._printExpression(node.leftExpression.typeAnnotation, 
                    /* treatStringsAsSymbols */ true)}`;
                }
            }
        }
        if (line) {
            this._emittedSuite = true;
            line += ' = ';
            if (isTypeAlias) {
                line += this._printExpression(node.rightExpression);
            }
            else {
                line += '...';
            }
            this._emitLine(line);
        }
        return false;
    }
    visitAugmentedAssignment(node) {
        if (node.leftExpression.nodeType === 38 /* ParseNodeType.Name */) {
            // Handle "__all__ +=" as a special case.
            if (node.leftExpression.value === '__all__' && node.operator === 1 /* OperatorType.AddEqual */) {
                if (this._functionNestCount === 0 && this._ifNestCount === 0) {
                    let line = this._printExpression(node.leftExpression);
                    line += ' += ';
                    line += this._printExpression(node.rightExpression);
                    this._emitLine(line);
                }
            }
        }
        return false;
    }
    visitTypeAnnotation(node) {
        if (this._functionNestCount === 0) {
            let line = '';
            if (node.valueExpression.nodeType === 38 /* ParseNodeType.Name */) {
                line = this._printExpression(node.valueExpression);
            }
            else if (node.valueExpression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                const baseExpression = node.valueExpression.leftExpression;
                if (baseExpression.nodeType === 38 /* ParseNodeType.Name */) {
                    if (baseExpression.value === 'self') {
                        const memberName = node.valueExpression.memberName.value;
                        if (!SymbolNameUtils.isPrivateOrProtectedName(memberName)) {
                            line = this._printExpression(node.valueExpression);
                        }
                    }
                }
            }
            if (line) {
                line += ': ' + this._printExpression(node.typeAnnotation, /* treatStringsAsSymbols */ true);
                this._emitLine(line);
            }
        }
        return false;
    }
    visitImport(node) {
        if (this._functionNestCount > 0 || this._classNestCount > 0) {
            return false;
        }
        const currentScope = (0, scopeUtils_1.getScopeForNode)(node);
        if (currentScope) {
            // Record the input for later.
            node.list.forEach((imp) => {
                const moduleName = this._printModuleName(imp.module);
                if (!this._trackedImportAs.has(moduleName)) {
                    const symbolName = imp.alias
                        ? imp.alias.value
                        : imp.module.nameParts.length > 0
                            ? imp.module.nameParts[0].value
                            : '';
                    const symbolInfo = currentScope.lookUpSymbolRecursive(symbolName);
                    if (symbolInfo) {
                        const trackedImportAs = new TrackedImportAs(moduleName, imp.alias ? imp.alias.value : undefined, symbolInfo.symbol);
                        this._trackedImportAs.set(moduleName, trackedImportAs);
                    }
                }
            });
        }
        return false;
    }
    visitImportFrom(node) {
        if (this._functionNestCount > 0 || this._classNestCount > 0) {
            return false;
        }
        const currentScope = (0, scopeUtils_1.getScopeForNode)(node);
        if (currentScope) {
            // Record the input for later.
            const moduleName = this._printModuleName(node.module);
            let trackedImportFrom = this._trackedImportFrom.get(moduleName);
            if (!trackedImportFrom) {
                trackedImportFrom = new TrackedImportFrom(moduleName, node.isWildcardImport, node);
                this._trackedImportFrom.set(moduleName, trackedImportFrom);
            }
            node.imports.forEach((imp) => {
                const symbolName = imp.alias ? imp.alias.value : imp.name.value;
                const symbolInfo = currentScope.lookUpSymbolRecursive(symbolName);
                if (symbolInfo) {
                    trackedImportFrom.addSymbol(symbolInfo.symbol, imp.name.value, imp.alias ? imp.alias.value : undefined, false);
                }
            });
        }
        return false;
    }
    visitStatementList(node) {
        if (node.statements.length > 0 && node.statements[0].nodeType === 48 /* ParseNodeType.StringList */) {
            // Is this the first statement in a suite? If it's a string
            // literal, assume it's a doc string and emit it.
            if (!this._emittedSuite && this._emitDocString) {
                this._emitLine(this._printExpression(node.statements[0]));
            }
        }
        // Don't emit a doc string after the first statement.
        this._emitDocString = false;
        this.walkMultiple(node.statements);
        return false;
    }
    _emitSuite(callback) {
        this._increaseIndent(() => {
            const prevEmittedSuite = this._emittedSuite;
            this._emittedSuite = false;
            callback();
            if (!this._emittedSuite) {
                this._emitLine('...');
            }
            this._emittedSuite = prevEmittedSuite;
        });
    }
    _increaseIndent(callback) {
        this._indentAmount++;
        callback();
        this._indentAmount--;
    }
    _emitDecorators(decorators) {
        decorators.forEach((decorator) => {
            this._emitLine('@' + this._printExpression(decorator.expression));
        });
    }
    _printHeaderDocString() {
        return ('"""' +
            this._lineEnd +
            'This type stub file was generated by pyright.' +
            this._lineEnd +
            '"""' +
            this._lineEnd +
            this._lineEnd);
    }
    _emitLine(line) {
        for (let i = 0; i < this._indentAmount; i++) {
            this._typeStubText += this._tab;
        }
        this._typeStubText += line + this._lineEnd;
    }
    _printTypeParameters(node) {
        return `[${node.parameters.map((typeParam) => this._printTypeParameter(typeParam)).join(',')}]`;
    }
    _printTypeParameter(node) {
        let line = '';
        if (node.typeParamCategory === parseNodes_1.TypeParameterCategory.TypeVarTuple) {
            line += '*';
        }
        else if (node.typeParamCategory === parseNodes_1.TypeParameterCategory.ParamSpec) {
            line += '**';
        }
        line += node.name.value;
        if (node.boundExpression) {
            line += ': ';
            line += this._printExpression(node.boundExpression);
        }
        if (node.defaultExpression) {
            line += ' = ';
            line += this._printExpression(node.defaultExpression);
        }
        return line;
    }
    _printModuleName(node) {
        let line = '';
        for (let i = 0; i < node.leadingDots; i++) {
            line += '.';
        }
        line += node.nameParts.map((part) => part.value).join('.');
        return line;
    }
    _printParameter(paramNode, functionNode, paramIndex) {
        let line = '';
        if (paramNode.category === 1 /* ParameterCategory.ArgsList */) {
            line += '*';
        }
        else if (paramNode.category === 2 /* ParameterCategory.KwargsDict */) {
            line += '**';
        }
        if (paramNode.name) {
            line += paramNode.name.value;
        }
        else if (paramNode.category === 0 /* ParameterCategory.Simple */) {
            line += '/';
        }
        const paramTypeAnnotation = ParseTreeUtils.getTypeAnnotationForParameter(functionNode, paramIndex);
        let paramType = '';
        if (paramTypeAnnotation) {
            paramType = this._printExpression(paramTypeAnnotation, /* treatStringsAsSymbols */ true);
        }
        if (paramType) {
            line += ': ' + paramType;
        }
        if (paramNode.defaultValue) {
            // Follow PEP8 spacing rules. Include spaces if type
            // annotation is present, no space otherwise.
            if (paramType) {
                line += ' = ...';
            }
            else {
                line += '=...';
            }
        }
        return line;
    }
    _printExpression(node, isType = false, treatStringsAsSymbols = false) {
        const importSymbolWalker = new ImportSymbolWalker(this._accessedImportedSymbols, treatStringsAsSymbols);
        importSymbolWalker.analyze(node);
        let expressionFlags = isType
            ? 1 /* ParseTreeUtils.PrintExpressionFlags.ForwardDeclarations */
            : 0 /* ParseTreeUtils.PrintExpressionFlags.None */;
        expressionFlags |= 2 /* ParseTreeUtils.PrintExpressionFlags.DoNotLimitStringLength */;
        return ParseTreeUtils.printExpression(node, expressionFlags);
    }
    _printTrackedImports() {
        let importStr = '';
        let lineEmitted = false;
        // Emit the "import" statements.
        this._trackedImportAs.forEach((imp) => {
            if (this._accessedImportedSymbols.has(imp.alias || imp.importName)) {
                imp.isAccessed = true;
            }
            if (imp.isAccessed || this._includeAllImports) {
                importStr += `import ${imp.importName}`;
                if (imp.alias) {
                    importStr += ` as ${imp.alias}`;
                }
                importStr += this._lineEnd;
                lineEmitted = true;
            }
        });
        // Emit the "import from" statements.
        this._trackedImportFrom.forEach((imp) => {
            imp.symbols.forEach((s) => {
                if (this._accessedImportedSymbols.has(s.alias || s.name)) {
                    s.isAccessed = true;
                }
            });
            if (imp.isWildcardImport) {
                importStr += `from ${imp.importName} import *` + this._lineEnd;
                lineEmitted = true;
            }
            const sortedSymbols = imp.symbols
                .filter((s) => s.isAccessed || this._includeAllImports)
                .sort((a, b) => {
                if (a.name < b.name) {
                    return -1;
                }
                else if (a.name > b.name) {
                    return 1;
                }
                return 0;
            });
            if (sortedSymbols.length > 0) {
                importStr += `from ${imp.importName} import `;
                importStr += sortedSymbols
                    .map((symbol) => {
                    let symStr = symbol.name;
                    if (symbol.alias) {
                        symStr += ' as ' + symbol.alias;
                    }
                    return symStr;
                })
                    .join(', ');
                importStr += this._lineEnd;
                lineEmitted = true;
            }
        });
        if (lineEmitted) {
            importStr += this._lineEnd;
        }
        return importStr;
    }
    _writeFile() {
        let finalText = this._printHeaderDocString();
        finalText += this._printTrackedImports();
        finalText += this._typeStubText;
        this._sourceFile.fileSystem.writeFileSync(this._stubPath, finalText, 'utf8');
    }
}
exports.TypeStubWriter = TypeStubWriter;
//# sourceMappingURL=typeStubWriter.js.map