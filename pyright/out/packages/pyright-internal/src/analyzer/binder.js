"use strict";
/*
 * binder.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A parse tree walker that performs basic name binding (creation of
 * scopes and associated symbol tables).
 * The binder walks the parse tree by scopes starting at the module
 * level. When a new scope is detected, it is pushed onto a list and
 * walked separately at a later time. (The exception is a class scope,
 * which is immediately walked.) Walking the tree in this manner
 * simulates the order in which execution normally occurs in a Python
 * file. The binder attempts to statically detect runtime errors that
 * would be reported by the python interpreter when executing the code.
 * This binder doesn't perform any static type checking.
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
exports.DummyScopeGenerator = exports.ReturnFinder = exports.YieldFinder = exports.Binder = void 0;
const collectionUtils_1 = require("../common/collectionUtils");
const debug_1 = require("../common/debug");
const diagnosticRules_1 = require("../common/diagnosticRules");
const pathUtils_1 = require("../common/pathUtils");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const localize_1 = require("../localization/localize");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const codeFlowTypes_1 = require("./codeFlowTypes");
const declaration_1 = require("./declaration");
const docStringUtils_1 = require("./docStringUtils");
const ParseTreeUtils = __importStar(require("./parseTreeUtils"));
const parseTreeWalker_1 = require("./parseTreeWalker");
const scope_1 = require("./scope");
const StaticExpressions = __importStar(require("./staticExpressions"));
const symbol_1 = require("./symbol");
const symbolNameUtils_1 = require("./symbolNameUtils");
// For each flow node within an execution context, we'll add a small
// amount to the complexity factor. Without this, the complexity
// calculation fails to take into account large numbers of non-cyclical
// flow nodes. This number is somewhat arbitrary and is tuned empirically.
const flowNodeComplexityContribution = 0.05;
class Binder extends parseTreeWalker_1.ParseTreeWalker {
    constructor(fileInfo, _docStringService, _moduleSymbolOnly = false) {
        super();
        this._docStringService = _docStringService;
        this._moduleSymbolOnly = _moduleSymbolOnly;
        // A queue of deferred analysis operations.
        this._deferredBindingTasks = [];
        // Flow nodes used within try blocks.
        this._currentExceptTargets = [];
        // Flow nodes used within try/finally flows.
        this._finallyTargets = [];
        // Aliases of "typing" and "typing_extensions".
        this._typingImportAliases = [];
        // Aliases of "sys".
        this._sysImportAliases = [];
        // Aliases of "dataclasses".
        this._dataclassesImportAliases = [];
        // Map of imports of specific symbols imported from "typing" and "typing_extensions"
        // and the names they alias to.
        this._typingSymbolAliases = new Map();
        // Map of imports of specific symbols imported from "dataclasses"
        // and the names they alias to.
        this._dataclassesSymbolAliases = new Map();
        // List of string nodes associated with the "__all__" symbol.
        this._dunderAllStringNodes = [];
        // One or more statements are manipulating __all__ in a manner that a
        // static analyzer doesn't understand.
        this._usesUnsupportedDunderAllForm = false;
        // Are we currently binding code located within an except block?
        this._isInExceptSuite = false;
        // Are we currently walking the type arguments to an Annotated type annotation?
        this._isInAnnotatedAnnotation = false;
        // Map of symbols at the module level that may be externally
        // hidden depending on whether they are listed in the __all__ list.
        this._potentialHiddenSymbols = new Map();
        // Map of symbols at the module level that may be private depending
        // on whether they are listed in the __all__ list.
        this._potentialPrivateSymbols = new Map();
        // Estimates the overall complexity of the code flow graph for
        // the current function.
        this._codeFlowComplexity = 0;
        this._fileInfo = fileInfo;
    }
    bindModule(node) {
        var _a;
        // We'll assume that if there is no builtins scope provided, we must be
        // binding the builtins module itself.
        const isBuiltInModule = this._fileInfo.builtinsScope === undefined;
        this._createNewScope(isBuiltInModule ? 5 /* ScopeType.Builtin */ : 4 /* ScopeType.Module */, this._fileInfo.builtinsScope, 
        /* proxyScope */ undefined, () => {
            AnalyzerNodeInfo.setScope(node, this._currentScope);
            AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
            // Bind implicit names.
            // List taken from https://docs.python.org/3/reference/import.html#__name__
            this._addImplicitSymbolToCurrentScope('__name__', node, 'str');
            this._addImplicitSymbolToCurrentScope('__loader__', node, 'Any');
            this._addImplicitSymbolToCurrentScope('__package__', node, 'str | None');
            this._addImplicitSymbolToCurrentScope('__spec__', node, 'Any');
            this._addImplicitSymbolToCurrentScope('__path__', node, 'Iterable[str]');
            this._addImplicitSymbolToCurrentScope('__file__', node, 'str');
            this._addImplicitSymbolToCurrentScope('__cached__', node, 'str');
            this._addImplicitSymbolToCurrentScope('__dict__', node, 'Dict[str, Any]');
            this._addImplicitSymbolToCurrentScope('__annotations__', node, 'Dict[str, Any]');
            this._addImplicitSymbolToCurrentScope('__builtins__', node, 'Any');
            // If there is a static docstring provided in the module, assume
            // that the type of `__doc__` is `str` rather than `str | None`. This
            // doesn't apply to stub files.
            const moduleDocString = ParseTreeUtils.getDocString(node.statements);
            this._addImplicitSymbolToCurrentScope('__doc__', node, !this._fileInfo.isStubFile && moduleDocString ? 'str' : 'str | None');
            // Create a start node for the module.
            this._currentFlowNode = this._createStartFlowNode();
            this._walkStatementsAndReportUnreachable(node.statements);
            // Associate the code flow node at the end of the module with the module.
            AnalyzerNodeInfo.setAfterFlowNode(node, this._currentFlowNode);
            AnalyzerNodeInfo.setCodeFlowExpressions(node, this._currentScopeCodeFlowExpressions);
            AnalyzerNodeInfo.setCodeFlowComplexity(node, this._codeFlowComplexity);
        });
        // Perform all analysis that was deferred during the first pass.
        this._bindDeferred();
        // Use the __all__ list to determine whether any potential private
        // symbols should be made externally hidden or private.
        this._potentialHiddenSymbols.forEach((symbol, name) => {
            var _a;
            if (!((_a = this._dunderAllNames) === null || _a === void 0 ? void 0 : _a.some((sym) => sym === name))) {
                if (this._fileInfo.isStubFile) {
                    symbol.setIsExternallyHidden();
                }
                else {
                    symbol.setPrivatePyTypedImport();
                }
            }
        });
        this._potentialPrivateSymbols.forEach((symbol, name) => {
            var _a;
            if (!((_a = this._dunderAllNames) === null || _a === void 0 ? void 0 : _a.some((sym) => sym === name))) {
                symbol.setIsPrivateMember();
            }
        });
        if (this._dunderAllNames) {
            AnalyzerNodeInfo.setDunderAllInfo(node, {
                names: this._dunderAllNames,
                stringNodes: this._dunderAllStringNodes,
                usesUnsupportedDunderAllForm: this._usesUnsupportedDunderAllForm,
            });
        }
        else {
            AnalyzerNodeInfo.setDunderAllInfo(node, /* names */ undefined);
        }
        // Set __all__ flags on the module symbols.
        const scope = AnalyzerNodeInfo.getScope(node);
        if (scope && this._dunderAllNames) {
            for (const name of this._dunderAllNames) {
                (_a = scope.symbolTable.get(name)) === null || _a === void 0 ? void 0 : _a.setIsInDunderAll();
            }
        }
    }
    visitModule(node) {
        // Tree walking should start with the children of
        // the node, so we should never get here.
        (0, debug_1.fail)('We should never get here');
        return false;
    }
    visitSuite(node) {
        this._walkStatementsAndReportUnreachable(node.statements);
        return false;
    }
    visitModuleName(node) {
        const importResult = AnalyzerNodeInfo.getImportInfo(node);
        (0, debug_1.assert)(importResult !== undefined);
        if (importResult.isNativeLib) {
            return true;
        }
        if (!importResult.isImportFound) {
            this._addDiagnostic(diagnosticRules_1.DiagnosticRule.reportMissingImports, localize_1.LocMessage.importResolveFailure().format({
                importName: importResult.importName,
                venv: this._fileInfo.executionEnvironment.name,
            }), node);
            return true;
        }
        // A source file was found, but the type stub was missing.
        if (!importResult.isStubFile &&
            importResult.importType === 1 /* ImportType.ThirdParty */ &&
            !importResult.pyTypedInfo) {
            const diagnostic = this._addDiagnostic(diagnosticRules_1.DiagnosticRule.reportMissingTypeStubs, localize_1.LocMessage.stubFileMissing().format({ importName: importResult.importName }), node);
            if (diagnostic) {
                // Add a diagnostic action for resolving this diagnostic.
                const createTypeStubAction = {
                    action: "pyright.createtypestub" /* Commands.createTypeStub */,
                    moduleName: importResult.importName,
                };
                diagnostic.addAction(createTypeStubAction);
            }
        }
        return true;
    }
    visitClass(node) {
        this.walkMultiple(node.decorators);
        const classDeclaration = {
            type: 6 /* DeclarationType.Class */,
            node,
            uri: this._fileInfo.fileUri,
            range: (0, positionUtils_1.convertTextRangeToRange)(node.name, this._fileInfo.lines),
            moduleName: this._fileInfo.moduleName,
            isInExceptSuite: this._isInExceptSuite,
        };
        const symbol = this._bindNameToScope(this._currentScope, node.name);
        if (symbol) {
            symbol.addDeclaration(classDeclaration);
        }
        // Stash the declaration in the parse node for later access.
        AnalyzerNodeInfo.setDeclaration(node, classDeclaration);
        let typeParamScope;
        if (node.typeParameters) {
            this.walk(node.typeParameters);
            typeParamScope = AnalyzerNodeInfo.getScope(node.typeParameters);
        }
        this.walkMultiple(node.arguments);
        this._createNewScope(3 /* ScopeType.Class */, typeParamScope !== null && typeParamScope !== void 0 ? typeParamScope : this._getNonClassParentScope(), 
        /* proxyScope */ undefined, () => {
            AnalyzerNodeInfo.setScope(node, this._currentScope);
            this._addImplicitSymbolToCurrentScope('__doc__', node, 'str | None');
            this._addImplicitSymbolToCurrentScope('__module__', node, 'str');
            this._addImplicitSymbolToCurrentScope('__qualname__', node, 'str');
            this._dunderSlotsEntries = undefined;
            if (!this._moduleSymbolOnly) {
                // Analyze the suite.
                this.walk(node.suite);
            }
            if (this._dunderSlotsEntries) {
                this._addSlotsToCurrentScope(this._dunderSlotsEntries);
            }
            this._dunderSlotsEntries = undefined;
        });
        this._createAssignmentTargetFlowNodes(node.name, /* walkTargets */ false, /* unbound */ false);
        return false;
    }
    visitFunction(node) {
        this._createVariableAnnotationFlowNode();
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        const symbol = this._bindNameToScope(this._currentScope, node.name);
        const containingClassNode = ParseTreeUtils.getEnclosingClass(node, /* stopAtFunction */ true);
        const functionDeclaration = {
            type: 5 /* DeclarationType.Function */,
            node,
            isMethod: !!containingClassNode,
            isGenerator: false,
            uri: this._fileInfo.fileUri,
            range: (0, positionUtils_1.convertTextRangeToRange)(node.name, this._fileInfo.lines),
            moduleName: this._fileInfo.moduleName,
            isInExceptSuite: this._isInExceptSuite,
        };
        if (symbol) {
            symbol.addDeclaration(functionDeclaration);
        }
        // Stash the declaration in the parse node for later access.
        AnalyzerNodeInfo.setDeclaration(node, functionDeclaration);
        // Walk the default values prior to the type parameters.
        node.parameters.forEach((param) => {
            if (param.defaultValue) {
                this.walk(param.defaultValue);
            }
        });
        let typeParamScope;
        if (node.typeParameters) {
            this.walk(node.typeParameters);
            typeParamScope = AnalyzerNodeInfo.getScope(node.typeParameters);
        }
        this.walkMultiple(node.decorators);
        node.parameters.forEach((param) => {
            if (param.typeAnnotation) {
                this.walk(param.typeAnnotation);
            }
            if (param.typeAnnotationComment) {
                this.walk(param.typeAnnotationComment);
            }
        });
        if (node.returnTypeAnnotation) {
            this.walk(node.returnTypeAnnotation);
        }
        if (node.functionAnnotationComment) {
            this.walk(node.functionAnnotationComment);
        }
        // Don't walk the body of the function until we're done analyzing
        // the current scope.
        this._createNewScope(2 /* ScopeType.Function */, typeParamScope !== null && typeParamScope !== void 0 ? typeParamScope : this._getNonClassParentScope(), 
        /* proxyScope */ undefined, () => {
            AnalyzerNodeInfo.setScope(node, this._currentScope);
            const enclosingClass = ParseTreeUtils.getEnclosingClass(node);
            if (enclosingClass) {
                // Add the implicit "__class__" symbol described in PEP 3135.
                this._addImplicitSymbolToCurrentScope('__class__', node, 'type[self]');
            }
            this._deferBinding(() => {
                // Create a start node for the function.
                this._currentFlowNode = this._createStartFlowNode();
                this._codeFlowComplexity = 0;
                node.parameters.forEach((paramNode) => {
                    var _a, _b;
                    if (paramNode.name) {
                        const symbol = this._bindNameToScope(this._currentScope, paramNode.name);
                        // Extract the parameter docString from the function docString
                        let docString = ParseTreeUtils.getDocString((_b = (_a = node === null || node === void 0 ? void 0 : node.suite) === null || _a === void 0 ? void 0 : _a.statements) !== null && _b !== void 0 ? _b : []);
                        if (docString !== undefined) {
                            docString = (0, docStringUtils_1.extractParameterDocumentation)(docString, paramNode.name.value);
                        }
                        if (symbol) {
                            const paramDeclaration = {
                                type: 2 /* DeclarationType.Parameter */,
                                node: paramNode,
                                uri: this._fileInfo.fileUri,
                                range: (0, positionUtils_1.convertTextRangeToRange)(paramNode, this._fileInfo.lines),
                                moduleName: this._fileInfo.moduleName,
                                isInExceptSuite: this._isInExceptSuite,
                                docString: docString,
                            };
                            symbol.addDeclaration(paramDeclaration);
                            AnalyzerNodeInfo.setDeclaration(paramNode.name, paramDeclaration);
                        }
                        this._createFlowAssignment(paramNode.name);
                    }
                });
                this._targetFunctionDeclaration = functionDeclaration;
                this._currentReturnTarget = this._createBranchLabel();
                // Walk the statements that make up the function.
                this.walk(node.suite);
                this._targetFunctionDeclaration = undefined;
                // Associate the code flow node at the end of the suite with
                // the suite.
                AnalyzerNodeInfo.setAfterFlowNode(node.suite, this._currentFlowNode);
                // Compute the final return flow node and associate it with
                // the function's parse node. If this node is unreachable, then
                // the function never returns.
                this._addAntecedent(this._currentReturnTarget, this._currentFlowNode);
                const returnFlowNode = this._finishFlowLabel(this._currentReturnTarget);
                AnalyzerNodeInfo.setAfterFlowNode(node, returnFlowNode);
                AnalyzerNodeInfo.setCodeFlowExpressions(node, this._currentScopeCodeFlowExpressions);
                AnalyzerNodeInfo.setCodeFlowComplexity(node, this._codeFlowComplexity);
            });
        });
        this._createAssignmentTargetFlowNodes(node.name, /* walkTargets */ false, /* unbound */ false);
        // We'll walk the child nodes in a deferred manner, so don't walk them now.
        return false;
    }
    visitLambda(node) {
        this._createVariableAnnotationFlowNode();
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        // Analyze the parameter defaults in the context of the parent's scope
        // before we add any names from the function's scope.
        node.parameters.forEach((param) => {
            if (param.defaultValue) {
                this.walk(param.defaultValue);
            }
        });
        this._createNewScope(2 /* ScopeType.Function */, this._getNonClassParentScope(), /* proxyScope */ undefined, () => {
            AnalyzerNodeInfo.setScope(node, this._currentScope);
            this._deferBinding(() => {
                // Create a start node for the lambda.
                this._currentFlowNode = this._createStartFlowNode();
                node.parameters.forEach((paramNode) => {
                    if (paramNode.name) {
                        const symbol = this._bindNameToScope(this._currentScope, paramNode.name);
                        if (symbol) {
                            const paramDeclaration = {
                                type: 2 /* DeclarationType.Parameter */,
                                node: paramNode,
                                uri: this._fileInfo.fileUri,
                                range: (0, positionUtils_1.convertTextRangeToRange)(paramNode, this._fileInfo.lines),
                                moduleName: this._fileInfo.moduleName,
                                isInExceptSuite: this._isInExceptSuite,
                            };
                            symbol.addDeclaration(paramDeclaration);
                            AnalyzerNodeInfo.setDeclaration(paramNode.name, paramDeclaration);
                        }
                        this._createFlowAssignment(paramNode.name);
                        this.walk(paramNode.name);
                        AnalyzerNodeInfo.setFlowNode(paramNode, this._currentFlowNode);
                    }
                });
                // Walk the expression that make up the lambda body.
                this.walk(node.expression);
                AnalyzerNodeInfo.setCodeFlowExpressions(node, this._currentScopeCodeFlowExpressions);
            });
        });
        // We'll walk the child nodes in a deferred manner.
        return false;
    }
    visitCall(node) {
        var _a, _b;
        this._disableTrueFalseTargets(() => {
            this.walk(node.leftExpression);
            const sortedArgs = ParseTreeUtils.getArgumentsByRuntimeOrder(node);
            sortedArgs.forEach((argNode) => {
                if (this._currentFlowNode) {
                    AnalyzerNodeInfo.setFlowNode(argNode, this._currentFlowNode);
                }
                this.walk(argNode);
            });
        });
        // Create a call flow node. We'll skip this if the call is part of
        // a decorator. We assume that decorators are not NoReturn functions.
        // There are libraries that make extensive use of unannotated decorators,
        // and this can lead to a performance issue when walking the control
        // flow graph if we need to evaluate every decorator.
        if (!ParseTreeUtils.isNodeContainedWithinNodeType(node, 16 /* ParseNodeType.Decorator */)) {
            // Skip if we're in an 'Annotated' annotation because this creates
            // problems for "No Return" return type analysis when annotation
            // evaluation is deferred.
            if (!this._isInAnnotatedAnnotation) {
                this._createCallFlowNode(node);
            }
        }
        // Is this an manipulation of dunder all?
        if (this._currentScope.type === 4 /* ScopeType.Module */ &&
            node.leftExpression.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
            node.leftExpression.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
            node.leftExpression.leftExpression.value === '__all__') {
            let emitDunderAllWarning = true;
            // Is this a call to "__all__.extend()"?
            if (node.leftExpression.memberName.value === 'extend' && node.arguments.length === 1) {
                const argExpr = node.arguments[0].valueExpression;
                // Is this a call to "__all__.extend([<list>])"?
                if (argExpr.nodeType === 34 /* ParseNodeType.List */) {
                    argExpr.entries.forEach((listEntryNode) => {
                        var _a, _b;
                        if (listEntryNode.nodeType === 48 /* ParseNodeType.StringList */ &&
                            listEntryNode.strings.length === 1 &&
                            listEntryNode.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                            (_a = this._dunderAllNames) === null || _a === void 0 ? void 0 : _a.push(listEntryNode.strings[0].value);
                            (_b = this._dunderAllStringNodes) === null || _b === void 0 ? void 0 : _b.push(listEntryNode.strings[0]);
                            emitDunderAllWarning = false;
                        }
                    });
                }
                else if (argExpr.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                    argExpr.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                    argExpr.memberName.value === '__all__') {
                    // Is this a call to "__all__.extend(<mod>.__all__)"?
                    const namesToAdd = this._getDunderAllNamesFromImport(argExpr.leftExpression.value);
                    if (namesToAdd && namesToAdd.length > 0) {
                        namesToAdd.forEach((name) => {
                            var _a;
                            (_a = this._dunderAllNames) === null || _a === void 0 ? void 0 : _a.push(name);
                        });
                        emitDunderAllWarning = false;
                    }
                }
            }
            else if (node.leftExpression.memberName.value === 'remove' && node.arguments.length === 1) {
                // Is this a call to "__all__.remove()"?
                const argExpr = node.arguments[0].valueExpression;
                if (argExpr.nodeType === 48 /* ParseNodeType.StringList */ &&
                    argExpr.strings.length === 1 &&
                    argExpr.strings[0].nodeType === 49 /* ParseNodeType.String */ &&
                    this._dunderAllNames) {
                    this._dunderAllNames = this._dunderAllNames.filter((name) => name !== argExpr.strings[0].value);
                    this._dunderAllStringNodes = this._dunderAllStringNodes.filter((node) => node.value !== argExpr.strings[0].value);
                    emitDunderAllWarning = false;
                }
            }
            else if (node.leftExpression.memberName.value === 'append' && node.arguments.length === 1) {
                // Is this a call to "__all__.append()"?
                const argExpr = node.arguments[0].valueExpression;
                if (argExpr.nodeType === 48 /* ParseNodeType.StringList */ &&
                    argExpr.strings.length === 1 &&
                    argExpr.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                    (_a = this._dunderAllNames) === null || _a === void 0 ? void 0 : _a.push(argExpr.strings[0].value);
                    (_b = this._dunderAllStringNodes) === null || _b === void 0 ? void 0 : _b.push(argExpr.strings[0]);
                    emitDunderAllWarning = false;
                }
            }
            if (emitDunderAllWarning) {
                this._usesUnsupportedDunderAllForm = true;
                this._addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnsupportedDunderAll, localize_1.LocMessage.unsupportedDunderAllOperation(), node);
            }
        }
        return false;
    }
    visitTypeParameterList(node) {
        const typeParamScope = new scope_1.Scope(0 /* ScopeType.TypeParameter */, this._getNonClassParentScope(), this._currentScope);
        node.parameters.forEach((param) => {
            if (param.boundExpression) {
                this.walk(param.boundExpression);
            }
        });
        const typeParamsSeen = new Set();
        node.parameters.forEach((param) => {
            const name = param.name;
            const symbol = typeParamScope.addSymbol(name.value, 0 /* SymbolFlags.None */);
            const paramDeclaration = {
                type: 3 /* DeclarationType.TypeParameter */,
                node: param,
                uri: this._fileInfo.fileUri,
                range: (0, positionUtils_1.convertTextRangeToRange)(node, this._fileInfo.lines),
                moduleName: this._fileInfo.moduleName,
                isInExceptSuite: this._isInExceptSuite,
            };
            symbol.addDeclaration(paramDeclaration);
            AnalyzerNodeInfo.setDeclaration(name, paramDeclaration);
            if (typeParamsSeen.has(name.value)) {
                this._addSyntaxError(localize_1.LocMessage.typeParameterExistingTypeParameter().format({ name: name.value }), name);
            }
            else {
                typeParamsSeen.add(name.value);
            }
        });
        node.parameters.forEach((param) => {
            if (param.defaultExpression) {
                this.walk(param.defaultExpression);
            }
        });
        AnalyzerNodeInfo.setScope(node, typeParamScope);
        return false;
    }
    visitTypeAlias(node) {
        this._bindNameToScope(this._currentScope, node.name);
        this.walk(node.name);
        let typeParamScope;
        if (node.typeParameters) {
            this.walk(node.typeParameters);
            typeParamScope = AnalyzerNodeInfo.getScope(node.typeParameters);
        }
        const typeAliasDeclaration = {
            type: 4 /* DeclarationType.TypeAlias */,
            node,
            uri: this._fileInfo.fileUri,
            range: (0, positionUtils_1.convertTextRangeToRange)(node.name, this._fileInfo.lines),
            moduleName: this._fileInfo.moduleName,
            isInExceptSuite: this._isInExceptSuite,
            docString: this._getVariableDocString(node.expression),
        };
        const symbol = this._bindNameToScope(this._currentScope, node.name);
        if (symbol) {
            symbol.addDeclaration(typeAliasDeclaration);
        }
        // Stash the declaration in the parse node for later access.
        AnalyzerNodeInfo.setDeclaration(node, typeAliasDeclaration);
        this._createAssignmentTargetFlowNodes(node.name, /* walkTargets */ true, /* unbound */ false);
        const prevScope = this._currentScope;
        this._currentScope = typeParamScope !== null && typeParamScope !== void 0 ? typeParamScope : this._currentScope;
        this.walk(node.expression);
        this._currentScope = prevScope;
        return false;
    }
    visitAssignment(node) {
        if (this._handleTypingStubAssignmentOrAnnotation(node)) {
            return false;
        }
        this._bindPossibleTupleNamedTarget(node.leftExpression);
        if (node.typeAnnotationComment) {
            this.walk(node.typeAnnotationComment);
            this._addTypeDeclarationForVariable(node.leftExpression, node.typeAnnotationComment);
        }
        if (node.chainedTypeAnnotationComment) {
            this._addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, localize_1.LocMessage.annotationNotSupported(), node.chainedTypeAnnotationComment);
        }
        // If the assignment target base expression is potentially a
        // TypedDict, add the base expression to the flow expressions set
        // to accommodate TypedDict type narrowing.
        if (node.leftExpression.nodeType === 27 /* ParseNodeType.Index */) {
            const target = node.leftExpression;
            if (target.items.length === 1 &&
                !target.trailingComma &&
                target.items[0].valueExpression.nodeType === 48 /* ParseNodeType.StringList */) {
                if ((0, codeFlowTypes_1.isCodeFlowSupportedForReference)(target.baseExpression)) {
                    const baseExprReferenceKey = (0, codeFlowTypes_1.createKeyForReference)(target.baseExpression);
                    this._currentScopeCodeFlowExpressions.add(baseExprReferenceKey);
                }
            }
        }
        this.walk(node.rightExpression);
        let isPossibleTypeAlias = true;
        if (ParseTreeUtils.getEnclosingFunction(node)) {
            // We will assume that type aliases are defined only at the module level
            // or as class variables, not as local variables within a function.
            isPossibleTypeAlias = false;
        }
        else if (node.rightExpression.nodeType === 9 /* ParseNodeType.Call */ && this._fileInfo.isTypingStubFile) {
            // Some special built-in types defined in typing.pyi use
            // assignments of the form List = _Alias(). We don't want to
            // treat these as type aliases.
            isPossibleTypeAlias = false;
        }
        else if (ParseTreeUtils.isWithinLoop(node)) {
            // Assume that it's not a type alias if it's within a loop.
            isPossibleTypeAlias = false;
        }
        this._addInferredTypeAssignmentForVariable(node.leftExpression, node.rightExpression, isPossibleTypeAlias);
        // If we didn't create assignment target flow nodes above, do so now.
        this._createAssignmentTargetFlowNodes(node.leftExpression, /* walkTargets */ true, /* unbound */ false);
        // Is this an assignment to dunder all?
        if (this._currentScope.type === 4 /* ScopeType.Module */) {
            if ((node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ && node.leftExpression.value === '__all__') ||
                (node.leftExpression.nodeType === 54 /* ParseNodeType.TypeAnnotation */ &&
                    node.leftExpression.valueExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                    node.leftExpression.valueExpression.value === '__all__')) {
                const expr = node.rightExpression;
                this._dunderAllNames = [];
                let emitDunderAllWarning = false;
                if (expr.nodeType === 34 /* ParseNodeType.List */) {
                    expr.entries.forEach((listEntryNode) => {
                        if (listEntryNode.nodeType === 48 /* ParseNodeType.StringList */ &&
                            listEntryNode.strings.length === 1 &&
                            listEntryNode.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                            this._dunderAllNames.push(listEntryNode.strings[0].value);
                            this._dunderAllStringNodes.push(listEntryNode.strings[0]);
                        }
                        else {
                            emitDunderAllWarning = true;
                        }
                    });
                }
                else if (expr.nodeType === 52 /* ParseNodeType.Tuple */) {
                    expr.expressions.forEach((tupleEntryNode) => {
                        if (tupleEntryNode.nodeType === 48 /* ParseNodeType.StringList */ &&
                            tupleEntryNode.strings.length === 1 &&
                            tupleEntryNode.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                            this._dunderAllNames.push(tupleEntryNode.strings[0].value);
                            this._dunderAllStringNodes.push(tupleEntryNode.strings[0]);
                        }
                        else {
                            emitDunderAllWarning = true;
                        }
                    });
                }
                else {
                    emitDunderAllWarning = true;
                }
                if (emitDunderAllWarning) {
                    this._usesUnsupportedDunderAllForm = true;
                    this._addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnsupportedDunderAll, localize_1.LocMessage.unsupportedDunderAllOperation(), node);
                }
            }
        }
        // Is this an assignment to dunder slots?
        if (this._currentScope.type === 3 /* ScopeType.Class */) {
            if ((node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ && node.leftExpression.value === '__slots__') ||
                (node.leftExpression.nodeType === 54 /* ParseNodeType.TypeAnnotation */ &&
                    node.leftExpression.valueExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                    node.leftExpression.valueExpression.value === '__slots__')) {
                const expr = node.rightExpression;
                this._dunderSlotsEntries = [];
                let isExpressionUnderstood = true;
                if (expr.nodeType === 48 /* ParseNodeType.StringList */) {
                    this._dunderSlotsEntries.push(expr);
                }
                else if (expr.nodeType === 34 /* ParseNodeType.List */) {
                    expr.entries.forEach((listEntryNode) => {
                        if (listEntryNode.nodeType === 48 /* ParseNodeType.StringList */ &&
                            listEntryNode.strings.length === 1 &&
                            listEntryNode.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                            this._dunderSlotsEntries.push(listEntryNode);
                        }
                        else {
                            isExpressionUnderstood = false;
                        }
                    });
                }
                else if (expr.nodeType === 52 /* ParseNodeType.Tuple */) {
                    expr.expressions.forEach((tupleEntryNode) => {
                        if (tupleEntryNode.nodeType === 48 /* ParseNodeType.StringList */ &&
                            tupleEntryNode.strings.length === 1 &&
                            tupleEntryNode.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                            this._dunderSlotsEntries.push(tupleEntryNode);
                        }
                        else {
                            isExpressionUnderstood = false;
                        }
                    });
                }
                else {
                    isExpressionUnderstood = false;
                }
                if (!isExpressionUnderstood) {
                    this._dunderSlotsEntries = undefined;
                }
            }
        }
        return false;
    }
    visitAssignmentExpression(node) {
        // Temporarily disable true/false targets in case this assignment
        // expression is located within an if/else conditional.
        this._disableTrueFalseTargets(() => {
            // Evaluate the operand expression.
            this.walk(node.rightExpression);
        });
        const evaluationNode = ParseTreeUtils.getEvaluationNodeForAssignmentExpression(node);
        if (!evaluationNode) {
            this._addSyntaxError(localize_1.LocMessage.assignmentExprContext(), node);
            this.walk(node.name);
        }
        else {
            // Bind the name to the containing scope. This special logic is required
            // because of the behavior defined in PEP 572. Targets of assignment
            // expressions don't bind to a list comprehension's scope but instead
            // bind to its containing scope.
            const containerScope = AnalyzerNodeInfo.getScope(evaluationNode);
            // If we're in a list comprehension (possibly nested), make sure that
            // local for targets don't collide with the target of the assignment
            // expression.
            let curScope = this._currentScope;
            while (curScope && curScope !== containerScope) {
                const localSymbol = curScope.lookUpSymbol(node.name.value);
                if (localSymbol) {
                    this._addSyntaxError(localize_1.LocMessage.assignmentExprComprehension().format({ name: node.name.value }), node.name);
                    break;
                }
                curScope = curScope.parent;
            }
            this._bindNameToScope(containerScope, node.name);
            this._addInferredTypeAssignmentForVariable(node.name, node.rightExpression);
            this._createAssignmentTargetFlowNodes(node.name, /* walkTargets */ true, /* unbound */ false);
        }
        return false;
    }
    visitAugmentedAssignment(node) {
        this.walk(node.leftExpression);
        this.walk(node.rightExpression);
        this._bindPossibleTupleNamedTarget(node.destExpression);
        this._createAssignmentTargetFlowNodes(node.destExpression, /* walkTargets */ false, /* unbound */ false);
        // Is this an assignment to dunder all of the form
        // __all__ += <expression>?
        if (node.operator === 1 /* OperatorType.AddEqual */ &&
            this._currentScope.type === 4 /* ScopeType.Module */ &&
            node.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
            node.leftExpression.value === '__all__') {
            const expr = node.rightExpression;
            let emitDunderAllWarning = true;
            if (expr.nodeType === 34 /* ParseNodeType.List */) {
                // Is this the form __all__ += ["a", "b"]?
                expr.entries.forEach((listEntryNode) => {
                    var _a;
                    if (listEntryNode.nodeType === 48 /* ParseNodeType.StringList */ &&
                        listEntryNode.strings.length === 1 &&
                        listEntryNode.strings[0].nodeType === 49 /* ParseNodeType.String */) {
                        (_a = this._dunderAllNames) === null || _a === void 0 ? void 0 : _a.push(listEntryNode.strings[0].value);
                        this._dunderAllStringNodes.push(listEntryNode.strings[0]);
                    }
                });
                emitDunderAllWarning = false;
            }
            else if (expr.nodeType === 35 /* ParseNodeType.MemberAccess */ &&
                expr.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                expr.memberName.value === '__all__') {
                // Is this using the form "__all__ += <mod>.__all__"?
                const namesToAdd = this._getDunderAllNamesFromImport(expr.leftExpression.value);
                if (namesToAdd) {
                    namesToAdd.forEach((name) => {
                        var _a;
                        (_a = this._dunderAllNames) === null || _a === void 0 ? void 0 : _a.push(name);
                    });
                    emitDunderAllWarning = false;
                }
            }
            if (emitDunderAllWarning) {
                this._usesUnsupportedDunderAllForm = true;
                this._addDiagnostic(diagnosticRules_1.DiagnosticRule.reportUnsupportedDunderAll, localize_1.LocMessage.unsupportedDunderAllOperation(), node);
            }
        }
        return false;
    }
    visitDel(node) {
        node.expressions.forEach((expr) => {
            this._bindPossibleTupleNamedTarget(expr);
            this.walk(expr);
            this._createAssignmentTargetFlowNodes(expr, /* walkTargets */ false, /* unbound */ true);
        });
        return false;
    }
    visitTypeAnnotation(node) {
        var _a;
        if (this._handleTypingStubAssignmentOrAnnotation(node)) {
            return false;
        }
        // If this is an annotated variable assignment within a class body,
        // we need to evaluate the type annotation first.
        const bindVariableBeforeAnnotationEvaluation = ((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 3 /* ParseNodeType.Assignment */ &&
            ParseTreeUtils.getEnclosingClass(node, /* stopAtFunction */ true) !== undefined;
        if (!bindVariableBeforeAnnotationEvaluation) {
            this.walk(node.typeAnnotation);
        }
        this._createVariableAnnotationFlowNode();
        this._bindPossibleTupleNamedTarget(node.valueExpression);
        this._addTypeDeclarationForVariable(node.valueExpression, node.typeAnnotation);
        if (bindVariableBeforeAnnotationEvaluation) {
            this.walk(node.typeAnnotation);
        }
        // For type annotations that are not part of assignments (e.g. simple variable
        // annotations), we need to populate the reference map. Otherwise the type
        // analyzer's code flow engine won't run and detect cases where the variable
        // is unbound.
        const expressionList = [];
        if (this._isNarrowingExpression(node.valueExpression, expressionList)) {
            expressionList.forEach((expr) => {
                const referenceKey = (0, codeFlowTypes_1.createKeyForReference)(expr);
                this._currentScopeCodeFlowExpressions.add(referenceKey);
            });
        }
        this.walk(node.valueExpression);
        return false;
    }
    visitFor(node) {
        this._bindPossibleTupleNamedTarget(node.targetExpression);
        this._addInferredTypeAssignmentForVariable(node.targetExpression, node);
        this.walk(node.iterableExpression);
        const preForLabel = this._createLoopLabel();
        const preElseLabel = this._createBranchLabel();
        const postForLabel = this._createBranchLabel();
        this._addAntecedent(preForLabel, this._currentFlowNode);
        this._currentFlowNode = preForLabel;
        this._addAntecedent(preElseLabel, this._currentFlowNode);
        const targetExpressions = this._trackCodeFlowExpressions(() => {
            this._createAssignmentTargetFlowNodes(node.targetExpression, /* walkTargets */ true, /* unbound */ false);
        });
        this._bindLoopStatement(preForLabel, postForLabel, () => {
            this.walk(node.forSuite);
            this._addAntecedent(preForLabel, this._currentFlowNode);
            // Add any target expressions since they are modified in the loop.
            targetExpressions.forEach((value) => {
                var _a;
                (_a = this._currentScopeCodeFlowExpressions) === null || _a === void 0 ? void 0 : _a.add(value);
            });
        });
        this._currentFlowNode = this._finishFlowLabel(preElseLabel);
        if (node.elseSuite) {
            this.walk(node.elseSuite);
        }
        this._addAntecedent(postForLabel, this._currentFlowNode);
        this._currentFlowNode = this._finishFlowLabel(postForLabel);
        // Async for is not allowed outside of an async function
        // unless we're in ipython mode.
        if (node.asyncToken && !this._fileInfo.ipythonMode) {
            const enclosingFunction = ParseTreeUtils.getEnclosingFunction(node);
            if (!enclosingFunction || !enclosingFunction.isAsync) {
                this._addSyntaxError(localize_1.LocMessage.asyncNotInAsyncFunction(), node.asyncToken);
            }
        }
        return false;
    }
    visitContinue(node) {
        if (this._currentContinueTarget) {
            this._addAntecedent(this._currentContinueTarget, this._currentFlowNode);
        }
        this._currentFlowNode = Binder._unreachableFlowNode;
        // Continue nodes don't have any children.
        return false;
    }
    visitBreak(node) {
        if (this._currentBreakTarget) {
            this._addAntecedent(this._currentBreakTarget, this._currentFlowNode);
        }
        this._currentFlowNode = Binder._unreachableFlowNode;
        // Break nodes don't have any children.
        return false;
    }
    visitReturn(node) {
        if (this._targetFunctionDeclaration) {
            if (!this._targetFunctionDeclaration.returnStatements) {
                this._targetFunctionDeclaration.returnStatements = [];
            }
            this._targetFunctionDeclaration.returnStatements.push(node);
        }
        if (node.returnExpression) {
            this.walk(node.returnExpression);
        }
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        if (this._currentReturnTarget) {
            this._addAntecedent(this._currentReturnTarget, this._currentFlowNode);
        }
        this._finallyTargets.forEach((target) => {
            this._addAntecedent(target, this._currentFlowNode);
        });
        this._currentFlowNode = Binder._unreachableFlowNode;
        return false;
    }
    visitYield(node) {
        if (this._isInComprehension(node, /* ignoreOutermostIterable */ true)) {
            this._addSyntaxError(localize_1.LocMessage.yieldWithinComprehension(), node);
        }
        this._bindYield(node);
        return false;
    }
    visitYieldFrom(node) {
        if (this._isInComprehension(node, /* ignoreOutermostIterable */ true)) {
            this._addSyntaxError(localize_1.LocMessage.yieldWithinComprehension(), node);
        }
        this._bindYield(node);
        return false;
    }
    visitMemberAccess(node) {
        this.walk(node.leftExpression);
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        return false;
    }
    visitName(node) {
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        return false;
    }
    visitIndex(node) {
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        this.walk(node.baseExpression);
        // If we're within an 'Annotated' type annotation, set the flag.
        const wasInAnnotatedAnnotation = this._isInAnnotatedAnnotation;
        if (this._isTypingAnnotation(node.baseExpression, 'Annotated')) {
            this._isInAnnotatedAnnotation = true;
        }
        node.items.forEach((argNode) => {
            this.walk(argNode);
        });
        this._isInAnnotatedAnnotation = wasInAnnotatedAnnotation;
        return false;
    }
    visitIf(node) {
        const preIfFlowNode = this._currentFlowNode;
        const thenLabel = this._createBranchLabel();
        const elseLabel = this._createBranchLabel();
        const postIfLabel = this._createBranchLabel(preIfFlowNode);
        postIfLabel.affectedExpressions = this._trackCodeFlowExpressions(() => {
            // Determine if the test condition is always true or always false. If so,
            // we can treat either the then or the else clause as unconditional.
            const constExprValue = StaticExpressions.evaluateStaticBoolLikeExpression(node.testExpression, this._fileInfo.executionEnvironment, this._fileInfo.definedConstants, this._typingImportAliases, this._sysImportAliases);
            this._bindConditional(node.testExpression, thenLabel, elseLabel);
            // Handle the if clause.
            this._currentFlowNode =
                constExprValue === false ? Binder._unreachableFlowNode : this._finishFlowLabel(thenLabel);
            this.walk(node.ifSuite);
            this._addAntecedent(postIfLabel, this._currentFlowNode);
            // Now handle the else clause if it's present. If there
            // are chained "else if" statements, they'll be handled
            // recursively here.
            this._currentFlowNode =
                constExprValue === true ? Binder._unreachableFlowNode : this._finishFlowLabel(elseLabel);
            if (node.elseSuite) {
                this.walk(node.elseSuite);
            }
            else {
                this._bindNeverCondition(node.testExpression, postIfLabel, /* isPositiveTest */ false);
            }
            this._addAntecedent(postIfLabel, this._currentFlowNode);
            this._currentFlowNode = this._finishFlowLabel(postIfLabel);
        });
        return false;
    }
    visitWhile(node) {
        const thenLabel = this._createBranchLabel();
        const elseLabel = this._createBranchLabel();
        const postWhileLabel = this._createBranchLabel();
        // Determine if the test condition is always true or always false. If so,
        // we can treat either the while or the else clause as unconditional.
        const constExprValue = StaticExpressions.evaluateStaticBoolLikeExpression(node.testExpression, this._fileInfo.executionEnvironment, this._fileInfo.definedConstants, this._typingImportAliases, this._sysImportAliases);
        const preLoopLabel = this._createLoopLabel();
        this._addAntecedent(preLoopLabel, this._currentFlowNode);
        this._currentFlowNode = preLoopLabel;
        this._bindConditional(node.testExpression, thenLabel, elseLabel);
        // Handle the while clause.
        this._currentFlowNode =
            constExprValue === false ? Binder._unreachableFlowNode : this._finishFlowLabel(thenLabel);
        this._bindLoopStatement(preLoopLabel, postWhileLabel, () => {
            this.walk(node.whileSuite);
        });
        this._addAntecedent(preLoopLabel, this._currentFlowNode);
        this._currentFlowNode =
            constExprValue === true ? Binder._unreachableFlowNode : this._finishFlowLabel(elseLabel);
        if (node.elseSuite) {
            this.walk(node.elseSuite);
        }
        this._addAntecedent(postWhileLabel, this._currentFlowNode);
        this._currentFlowNode = this._finishFlowLabel(postWhileLabel);
        return false;
    }
    visitAssert(node) {
        const assertTrueLabel = this._createBranchLabel();
        const assertFalseLabel = this._createBranchLabel();
        this._bindConditional(node.testExpression, assertTrueLabel, assertFalseLabel);
        if (node.exceptionExpression) {
            this._currentFlowNode = this._finishFlowLabel(assertFalseLabel);
            this.walk(node.exceptionExpression);
        }
        this._currentFlowNode = this._finishFlowLabel(assertTrueLabel);
        return false;
    }
    visitExcept(node) {
        if (node.typeExpression) {
            this.walk(node.typeExpression);
        }
        if (node.name) {
            this.walk(node.name);
            const symbol = this._bindNameToScope(this._currentScope, node.name);
            this._createAssignmentTargetFlowNodes(node.name, /* walkTargets */ true, /* unbound */ false);
            if (symbol) {
                const declaration = {
                    type: 1 /* DeclarationType.Variable */,
                    node: node.name,
                    isConstant: (0, symbolNameUtils_1.isConstantName)(node.name.value),
                    inferredTypeSource: node,
                    uri: this._fileInfo.fileUri,
                    range: (0, positionUtils_1.convertTextRangeToRange)(node.name, this._fileInfo.lines),
                    moduleName: this._fileInfo.moduleName,
                    isInExceptSuite: this._isInExceptSuite,
                    isExplicitBinding: this._currentScope.getBindingType(node.name.value) !== undefined,
                };
                symbol.addDeclaration(declaration);
            }
        }
        const wasInExceptSuite = this._isInExceptSuite;
        this._isInExceptSuite = true;
        this.walk(node.exceptSuite);
        this._isInExceptSuite = wasInExceptSuite;
        if (node.name) {
            // The exception name is implicitly unbound at the end of
            // the except block.
            this._createFlowAssignment(node.name, /* unbound */ true);
        }
        return false;
    }
    visitRaise(node) {
        if (this._currentFlowNode) {
            this._addExceptTargets(this._currentFlowNode);
        }
        if (this._targetFunctionDeclaration) {
            if (!this._targetFunctionDeclaration.raiseStatements) {
                this._targetFunctionDeclaration.raiseStatements = [];
            }
            this._targetFunctionDeclaration.raiseStatements.push(node);
        }
        if (node.typeExpression) {
            this.walk(node.typeExpression);
        }
        if (node.valueExpression) {
            this.walk(node.valueExpression);
        }
        if (node.tracebackExpression) {
            this.walk(node.tracebackExpression);
        }
        this._finallyTargets.forEach((target) => {
            this._addAntecedent(target, this._currentFlowNode);
        });
        this._currentFlowNode = Binder._unreachableFlowNode;
        return false;
    }
    visitTry(node) {
        // The try/except/else/finally statement is tricky to model using static code
        // flow rules because the finally clause is executed regardless of whether an
        // exception is raised or a return statement is executed. Code within the finally
        // clause needs to be reachable always, and we conservatively assume that any
        // statement within the try block can generate an exception, so we assume that its
        // antecedent is the pre-try flow. We implement this with a "gate" node in the
        // control flow graph. If analysis starts within the finally clause, the gate is
        // opened, and all raise/return statements within try/except/else blocks are
        // considered antecedents. If analysis starts outside (after) the finally clause,
        // the gate is closed, and only paths that don't hit a raise/return statement
        // in try/except/else blocks are considered.
        //
        //
        //                               1. PostElse
        //                                    ^
        //                                    |
        // 3. TryExceptElseReturnOrExcept     |
        //       ^                            |
        //       |                            |     2. PostExcept (for each except)
        //       |                            |            ^
        // 4. ReturnOrRaiseLabel              |            |
        //       ^                            |            |
        //       |                            |   |---------
        // 5. PreFinallyGate                  |   |
        //       ^                            |   |
        //       |------------------          |   |
        //                         |          |   |
        //                        6. PreFinallyLabel
        //                                ^
        //                         (finally block)
        //                                ^
        //                        7. PostFinally
        //                                ^    (only if isAfterElseAndExceptsReachable)
        //                         (after finally)
        // Create one flow label for every except clause.
        const preTryFlowNode = this._currentFlowNode;
        const curExceptTargets = node.exceptClauses.map(() => this._createBranchLabel());
        const preFinallyLabel = this._createBranchLabel(preTryFlowNode);
        let isAfterElseAndExceptsReachable = false;
        // Create a label for all of the return or raise labels that are
        // encountered within the try/except/else blocks. This conditionally
        // connects the return/raise statement to the finally clause.
        const preFinallyReturnOrRaiseLabel = this._createBranchLabel(preTryFlowNode);
        const preFinallyGate = {
            flags: codeFlowTypes_1.FlowFlags.PreFinallyGate,
            id: this._getUniqueFlowNodeId(),
            antecedent: preFinallyReturnOrRaiseLabel,
        };
        preFinallyLabel.affectedExpressions = this._trackCodeFlowExpressions(() => {
            if (node.finallySuite) {
                this._addAntecedent(preFinallyLabel, preFinallyGate);
            }
            // Add the finally target as an exception target unless there is
            // a "bare" except clause that accepts all exception types.
            const hasBareExceptClause = node.exceptClauses.some((except) => !except.typeExpression);
            if (!hasBareExceptClause) {
                curExceptTargets.push(preFinallyReturnOrRaiseLabel);
            }
            // An exception may be generated before the first flow node
            // added by the try block, so all of the exception targets
            // must have the pre-try flow node as an antecedent.
            curExceptTargets.forEach((exceptLabel) => {
                this._addAntecedent(exceptLabel, this._currentFlowNode);
            });
            // We don't perfectly handle nested finally clauses, which are not
            // possible to model fully within a static analyzer, but we do handle
            // a single level of finally statements, and we handle most cases
            // involving nesting. Returns or raises within the try/except/raise
            // block will execute the finally target(s).
            if (node.finallySuite) {
                this._finallyTargets.push(preFinallyReturnOrRaiseLabel);
            }
            // Handle the try block.
            this._useExceptTargets(curExceptTargets, () => {
                this.walk(node.trySuite);
            });
            // Handle the else block, which is executed only if
            // execution falls through the try block.
            if (node.elseSuite) {
                this.walk(node.elseSuite);
            }
            this._addAntecedent(preFinallyLabel, this._currentFlowNode);
            if (!this._isCodeUnreachable()) {
                isAfterElseAndExceptsReachable = true;
            }
            // Handle the except blocks.
            node.exceptClauses.forEach((exceptNode, index) => {
                this._currentFlowNode = this._finishFlowLabel(curExceptTargets[index]);
                this.walk(exceptNode);
                this._addAntecedent(preFinallyLabel, this._currentFlowNode);
                if (!this._isCodeUnreachable()) {
                    isAfterElseAndExceptsReachable = true;
                }
            });
            if (node.finallySuite) {
                this._finallyTargets.pop();
            }
            // Handle the finally block.
            this._currentFlowNode = this._finishFlowLabel(preFinallyLabel);
        });
        if (node.finallySuite) {
            this.walk(node.finallySuite);
            // Add a post-finally node at the end. If we traverse this node,
            // we'll set the "ignore" flag in the pre-finally node.
            const postFinallyNode = {
                flags: codeFlowTypes_1.FlowFlags.PostFinally,
                id: this._getUniqueFlowNodeId(),
                finallyNode: node.finallySuite,
                antecedent: this._currentFlowNode,
                preFinallyGate,
            };
            this._currentFlowNode = isAfterElseAndExceptsReachable ? postFinallyNode : Binder._unreachableFlowNode;
        }
        return false;
    }
    visitAwait(node) {
        var _a;
        // Make sure this is within an async lambda or function.
        const enclosingFunction = ParseTreeUtils.getEnclosingFunction(node);
        if (enclosingFunction === undefined || !enclosingFunction.isAsync) {
            if (this._fileInfo.ipythonMode && enclosingFunction === undefined) {
                // Top level await is allowed in ipython mode.
                return true;
            }
            // Allow if it's within a generator expression. Execution of
            // generator expressions is deferred and therefore can be
            // run within the context of an async function later.
            if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) !== 11 /* ParseNodeType.Comprehension */) {
                this._addSyntaxError(localize_1.LocMessage.awaitNotInAsync(), node);
            }
        }
        return true;
    }
    visitGlobal(node) {
        const globalScope = this._currentScope.getGlobalScope().scope;
        node.nameList.forEach((name) => {
            const nameValue = name.value;
            // Is the binding inconsistent?
            if (this._currentScope.getBindingType(nameValue) === 0 /* NameBindingType.Nonlocal */) {
                this._addSyntaxError(localize_1.LocMessage.nonLocalRedefinition().format({ name: nameValue }), name);
            }
            const valueWithScope = this._currentScope.lookUpSymbolRecursive(nameValue);
            // Was the name already assigned within this scope before it was declared global?
            if (valueWithScope && valueWithScope.scope === this._currentScope) {
                this._addSyntaxError(localize_1.LocMessage.globalReassignment().format({ name: nameValue }), name);
            }
            // Add it to the global scope if it's not already added.
            this._bindNameToScope(globalScope, name);
            if (this._currentScope !== globalScope) {
                this._currentScope.setBindingType(nameValue, 1 /* NameBindingType.Global */);
            }
        });
        return true;
    }
    visitNonlocal(node) {
        const globalScope = this._currentScope.getGlobalScope().scope;
        if (this._currentScope === globalScope) {
            this._addSyntaxError(localize_1.LocMessage.nonLocalInModule(), node);
        }
        else {
            node.nameList.forEach((name) => {
                const nameValue = name.value;
                // Is the binding inconsistent?
                if (this._currentScope.getBindingType(nameValue) === 1 /* NameBindingType.Global */) {
                    this._addSyntaxError(localize_1.LocMessage.globalRedefinition().format({ name: nameValue }), name);
                }
                const valueWithScope = this._currentScope.lookUpSymbolRecursive(nameValue);
                // Was the name already assigned within this scope before it was declared nonlocal?
                if (valueWithScope && valueWithScope.scope === this._currentScope) {
                    this._addSyntaxError(localize_1.LocMessage.nonLocalReassignment().format({ name: nameValue }), name);
                }
                else if (!valueWithScope || valueWithScope.scope === globalScope) {
                    this._addSyntaxError(localize_1.LocMessage.nonLocalNoBinding().format({ name: nameValue }), name);
                }
                if (valueWithScope) {
                    this._currentScope.setBindingType(nameValue, 0 /* NameBindingType.Nonlocal */);
                }
            });
        }
        return true;
    }
    visitImportAs(node) {
        var _a, _b, _c, _d, _e, _f;
        if (node.module.nameParts.length > 0) {
            const firstNamePartValue = node.module.nameParts[0].value;
            let symbolName;
            let symbolNameNode;
            if (node.alias) {
                // The symbol name is defined by the alias.
                symbolName = node.alias.value;
                symbolNameNode = node.alias;
            }
            else {
                // There was no alias, so we need to use the first element of
                // the name parts as the symbol.
                symbolName = firstNamePartValue;
                symbolNameNode = node.module.nameParts[0];
            }
            const symbol = this._bindNameToScope(this._currentScope, symbolNameNode);
            if (symbol &&
                (this._currentScope.type === 4 /* ScopeType.Module */ || this._currentScope.type === 5 /* ScopeType.Builtin */) &&
                (!node.alias ||
                    node.module.nameParts.length !== 1 ||
                    node.module.nameParts[0].value !== node.alias.value)) {
                if (this._fileInfo.isStubFile || this._fileInfo.isInPyTypedPackage) {
                    // PEP 484 indicates that imported symbols should not be
                    // considered "reexported" from a type stub file unless
                    // they are imported using the "as" form and the aliased
                    // name is entirely redundant.
                    this._potentialHiddenSymbols.set(symbolName, symbol);
                }
            }
            const importInfo = AnalyzerNodeInfo.getImportInfo(node.module);
            (0, debug_1.assert)(importInfo !== undefined);
            if (symbol) {
                this._createAliasDeclarationForMultipartImportName(node, node.alias, importInfo, symbol);
            }
            this._createFlowAssignment(node.alias ? node.alias : node.module.nameParts[0]);
            if (node.module.nameParts.length === 1) {
                if (firstNamePartValue === 'typing' || firstNamePartValue === 'typing_extensions') {
                    this._typingImportAliases.push((_b = (_a = node.alias) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : firstNamePartValue);
                }
                else if (firstNamePartValue === 'sys') {
                    this._sysImportAliases.push((_d = (_c = node.alias) === null || _c === void 0 ? void 0 : _c.value) !== null && _d !== void 0 ? _d : firstNamePartValue);
                }
                else if (firstNamePartValue === 'dataclasses') {
                    this._dataclassesImportAliases.push((_f = (_e = node.alias) === null || _e === void 0 ? void 0 : _e.value) !== null && _f !== void 0 ? _f : firstNamePartValue);
                }
            }
        }
        return true;
    }
    visitImportFrom(node) {
        var _a;
        const typingSymbolsOfInterest = ['Final', 'ClassVar', 'Annotated'];
        const dataclassesSymbolsOfInterest = ['InitVar'];
        const importInfo = AnalyzerNodeInfo.getImportInfo(node.module);
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        let resolvedPath = uri_1.Uri.empty();
        if (importInfo && importInfo.isImportFound && !importInfo.isNativeLib) {
            resolvedPath = importInfo.resolvedUris[importInfo.resolvedUris.length - 1];
        }
        // If this file is a module __init__.py(i), relative imports of submodules
        // using the syntax "from .x import y" introduce a symbol x into the
        // module namespace. We do this first (before adding the individual imported
        // symbols below) in case one of the imported symbols is the same name as the
        // submodule. In that case, we want to the symbol to appear later in the
        // declaration list because it should "win" when resolving the alias.
        const fileName = (0, pathUtils_1.stripFileExtension)(this._fileInfo.fileUri.fileName);
        const isModuleInitFile = fileName === '__init__' && node.module.leadingDots === 1 && node.module.nameParts.length === 1;
        let isTypingImport = false;
        let isDataclassesImport = false;
        if (node.module.nameParts.length === 1) {
            const firstNamePartValue = node.module.nameParts[0].value;
            if (firstNamePartValue === 'typing' || firstNamePartValue === 'typing_extensions') {
                isTypingImport = true;
            }
            if (firstNamePartValue === 'dataclasses') {
                isDataclassesImport = true;
            }
        }
        if (node.isWildcardImport) {
            if (ParseTreeUtils.getEnclosingClass(node) || ParseTreeUtils.getEnclosingFunction(node)) {
                this._addSyntaxError(localize_1.LocMessage.wildcardInFunction(), node);
            }
            if (importInfo) {
                const names = [];
                // Note that this scope uses a wildcard import, so we cannot shortcut
                // any code flow checks. All expressions are potentially in play.
                (_a = this._currentScopeCodeFlowExpressions) === null || _a === void 0 ? void 0 : _a.add(codeFlowTypes_1.wildcardImportReferenceKey);
                const lookupInfo = this._fileInfo.importLookup(resolvedPath);
                if (lookupInfo) {
                    const wildcardNames = this._getWildcardImportNames(lookupInfo);
                    if (isModuleInitFile) {
                        // If the symbol is going to be immediately replaced with a same-named
                        // imported symbol, skip this.
                        const isImmediatelyReplaced = wildcardNames.some((name) => {
                            return name === node.module.nameParts[0].value;
                        });
                        if (!isImmediatelyReplaced) {
                            this._addImplicitFromImport(node, importInfo);
                        }
                    }
                    wildcardNames.forEach((name) => {
                        const localSymbol = this._bindNameValueToScope(this._currentScope, name);
                        if (localSymbol) {
                            const importedSymbol = lookupInfo.symbolTable.get(name);
                            // Is the symbol in the target module's symbol table? If so,
                            // alias it.
                            if (importedSymbol) {
                                const aliasDecl = {
                                    type: 8 /* DeclarationType.Alias */,
                                    node,
                                    uri: resolvedPath,
                                    loadSymbolsFromPath: true,
                                    range: (0, textRange_1.getEmptyRange)(),
                                    usesLocalName: false,
                                    symbolName: name,
                                    moduleName: this._fileInfo.moduleName,
                                    isInExceptSuite: this._isInExceptSuite,
                                };
                                localSymbol.addDeclaration(aliasDecl);
                                names.push(name);
                            }
                            else {
                                // The symbol wasn't in the target module's symbol table. It's probably
                                // an implicitly-imported submodule referenced by __all__.
                                if (importInfo && importInfo.filteredImplicitImports) {
                                    const implicitImport = importInfo.filteredImplicitImports.get(name);
                                    if (implicitImport) {
                                        const submoduleFallback = {
                                            type: 8 /* DeclarationType.Alias */,
                                            node,
                                            uri: implicitImport.uri,
                                            loadSymbolsFromPath: true,
                                            range: (0, textRange_1.getEmptyRange)(),
                                            usesLocalName: false,
                                            moduleName: this._fileInfo.moduleName,
                                            isInExceptSuite: this._isInExceptSuite,
                                        };
                                        const aliasDecl = {
                                            type: 8 /* DeclarationType.Alias */,
                                            node,
                                            uri: resolvedPath,
                                            loadSymbolsFromPath: true,
                                            usesLocalName: false,
                                            symbolName: name,
                                            submoduleFallback,
                                            range: (0, textRange_1.getEmptyRange)(),
                                            moduleName: this._fileInfo.moduleName,
                                            isInExceptSuite: this._isInExceptSuite,
                                        };
                                        localSymbol.addDeclaration(aliasDecl);
                                        names.push(name);
                                    }
                                }
                            }
                        }
                    });
                }
                this._createFlowWildcardImport(node, names);
                if (isTypingImport) {
                    typingSymbolsOfInterest.forEach((s) => {
                        this._typingSymbolAliases.set(s, s);
                    });
                }
                if (isDataclassesImport) {
                    dataclassesSymbolsOfInterest.forEach((s) => {
                        this._dataclassesSymbolAliases.set(s, s);
                    });
                }
            }
        }
        else {
            if (isModuleInitFile) {
                this._addImplicitFromImport(node, importInfo);
            }
            node.imports.forEach((importSymbolNode) => {
                const importedName = importSymbolNode.name.value;
                const nameNode = importSymbolNode.alias || importSymbolNode.name;
                AnalyzerNodeInfo.setFlowNode(importSymbolNode, this._currentFlowNode);
                const symbol = this._bindNameToScope(this._currentScope, nameNode);
                if (symbol) {
                    // All import statements of the form `from . import x` treat x
                    // as an externally-visible (not hidden) symbol.
                    if (node.module.nameParts.length > 0) {
                        if (this._currentScope.type === 4 /* ScopeType.Module */ ||
                            this._currentScope.type === 5 /* ScopeType.Builtin */) {
                            if (!importSymbolNode.alias ||
                                importSymbolNode.alias.value !== importSymbolNode.name.value) {
                                if (this._fileInfo.isStubFile || this._fileInfo.isInPyTypedPackage) {
                                    // PEP 484 indicates that imported symbols should not be
                                    // considered "reexported" from a type stub file unless
                                    // they are imported using the "as" form using a redundant form.
                                    // Py.typed packages follow the same rule as PEP 484.
                                    this._potentialHiddenSymbols.set(nameNode.value, symbol);
                                }
                            }
                        }
                    }
                    // Is the import referring to an implicitly-imported module?
                    let implicitImport;
                    if (importInfo && importInfo.filteredImplicitImports) {
                        implicitImport = importInfo.filteredImplicitImports.get(importedName);
                    }
                    let submoduleFallback;
                    let loadSymbolsFromPath = true;
                    if (implicitImport) {
                        submoduleFallback = {
                            type: 8 /* DeclarationType.Alias */,
                            node: importSymbolNode,
                            uri: implicitImport.uri,
                            loadSymbolsFromPath: true,
                            range: (0, textRange_1.getEmptyRange)(),
                            usesLocalName: false,
                            moduleName: this._formatModuleName(node.module),
                            isInExceptSuite: this._isInExceptSuite,
                        };
                        // Handle the case where this is an __init__.py file and the imported
                        // module name refers to itself. The most common situation where this occurs
                        // is with a "from . import X" form, but it can also occur with
                        // an absolute import (e.g. "from A.B.C import X"). In this case, we want to
                        // always resolve to the submodule rather than the resolved path.
                        if (fileName === '__init__') {
                            if (node.module.leadingDots === 1 && node.module.nameParts.length === 0) {
                                loadSymbolsFromPath = false;
                            }
                            else if (resolvedPath.equals(this._fileInfo.fileUri)) {
                                loadSymbolsFromPath = false;
                            }
                        }
                    }
                    const aliasDecl = {
                        type: 8 /* DeclarationType.Alias */,
                        node: importSymbolNode,
                        uri: resolvedPath,
                        loadSymbolsFromPath,
                        usesLocalName: !!importSymbolNode.alias,
                        symbolName: importedName,
                        submoduleFallback,
                        range: (0, positionUtils_1.convertTextRangeToRange)(nameNode, this._fileInfo.lines),
                        moduleName: this._formatModuleName(node.module),
                        isInExceptSuite: this._isInExceptSuite,
                        isNativeLib: importInfo === null || importInfo === void 0 ? void 0 : importInfo.isNativeLib,
                    };
                    symbol.addDeclaration(aliasDecl);
                    this._createFlowAssignment(importSymbolNode.alias || importSymbolNode.name);
                    if (isTypingImport) {
                        if (typingSymbolsOfInterest.some((s) => s === importSymbolNode.name.value)) {
                            this._typingSymbolAliases.set(nameNode.value, importSymbolNode.name.value);
                        }
                    }
                    if (isDataclassesImport) {
                        if (dataclassesSymbolsOfInterest.some((s) => s === importSymbolNode.name.value)) {
                            this._dataclassesSymbolAliases.set(nameNode.value, importSymbolNode.name.value);
                        }
                    }
                }
            });
        }
        return true;
    }
    visitWith(node) {
        node.withItems.forEach((item) => {
            this.walk(item.expression);
            if (item.target) {
                this._bindPossibleTupleNamedTarget(item.target);
                this._addInferredTypeAssignmentForVariable(item.target, item);
                this._createAssignmentTargetFlowNodes(item.target, /* walkTargets */ true, /* unbound */ false);
            }
        });
        // We need to treat the "with" body as though it is wrapped in a try/except
        // block because some context managers catch and suppress exceptions.
        // We'll make use of a special "context manager label" which acts like
        // a regular branch label in most respects except that it is disabled
        // if none of the context managers support exception suppression. We won't
        // be able to determine whether any context managers support exception
        // processing until the type evaluation phase.
        //
        //  (pre with suite)
        //         ^
        //         |<--------------------|
        //    (with suite)<--------------|
        //         ^                     |
        //         |    ContextManagerSwallowExceptionTarget
        //         |                     ^
        //         |          PostContextManagerLabel
        //         |                     ^
        //         |---------------------|
        //         |
        //   (after with)
        //
        // In addition to the ContextManagerSwallowExceptionTarget, we'll create
        // a second target called ContextManagerForwardExceptionTarget that forwards
        // exceptions to existing exception targets if they exist.
        const contextManagerSwallowExceptionTarget = this._createContextManagerLabel(node.withItems.map((item) => item.expression), !!node.isAsync, 
        /* blockIfSwallowsExceptions */ false);
        this._addAntecedent(contextManagerSwallowExceptionTarget, this._currentFlowNode);
        const contextManagerForwardExceptionTarget = this._createContextManagerLabel(node.withItems.map((item) => item.expression), !!node.isAsync, 
        /* blockIfSwallowsExceptions */ true);
        this._currentExceptTargets.forEach((exceptionTarget) => {
            this._addAntecedent(exceptionTarget, contextManagerForwardExceptionTarget);
        });
        const preWithSuiteNode = this._currentFlowNode;
        const postContextManagerLabel = this._createBranchLabel(preWithSuiteNode);
        this._addAntecedent(postContextManagerLabel, contextManagerSwallowExceptionTarget);
        postContextManagerLabel.affectedExpressions = this._trackCodeFlowExpressions(() => {
            this._useExceptTargets([contextManagerSwallowExceptionTarget, contextManagerForwardExceptionTarget], () => {
                this.walk(node.suite);
            });
            this._addAntecedent(postContextManagerLabel, this._currentFlowNode);
            this._currentFlowNode = postContextManagerLabel;
            // Model the call to `__exit__` as a potential exception generator.
            if (!this._isCodeUnreachable()) {
                this._addExceptTargets(this._currentFlowNode);
            }
            if (node.asyncToken && !this._fileInfo.ipythonMode) {
                // Top level async with is allowed in ipython mode.
                const enclosingFunction = ParseTreeUtils.getEnclosingFunction(node);
                if (!enclosingFunction || !enclosingFunction.isAsync) {
                    this._addSyntaxError(localize_1.LocMessage.asyncNotInAsyncFunction(), node.asyncToken);
                }
            }
        });
        return false;
    }
    visitTernary(node) {
        const preTernaryFlowNode = this._currentFlowNode;
        const trueLabel = this._createBranchLabel();
        const falseLabel = this._createBranchLabel();
        const postExpressionLabel = this._createBranchLabel(preTernaryFlowNode);
        postExpressionLabel.affectedExpressions = this._trackCodeFlowExpressions(() => {
            // Handle the test expression.
            this._bindConditional(node.testExpression, trueLabel, falseLabel);
            // Handle the "true" portion (the "if" expression).
            this._currentFlowNode = this._finishFlowLabel(trueLabel);
            this.walk(node.ifExpression);
            this._addAntecedent(postExpressionLabel, this._currentFlowNode);
            // Handle the "false" portion (the "else" expression).
            this._currentFlowNode = this._finishFlowLabel(falseLabel);
            this.walk(node.elseExpression);
            this._addAntecedent(postExpressionLabel, this._currentFlowNode);
            this._currentFlowNode = this._finishFlowLabel(postExpressionLabel);
        });
        return false;
    }
    visitUnaryOperation(node) {
        if (node.operator === 38 /* OperatorType.Not */ && this._currentFalseTarget && this._currentTrueTarget) {
            // Swap the existing true/false targets.
            this._bindConditional(node.expression, this._currentFalseTarget, this._currentTrueTarget);
        }
        else {
            // Temporarily set the true/false targets to undefined because
            // this unary operation is not part of a chain of logical expressions
            // (AND/OR/NOT subexpressions).
            this._disableTrueFalseTargets(() => {
                // Evaluate the operand expression.
                this.walk(node.expression);
            });
        }
        return false;
    }
    visitBinaryOperation(node) {
        if (node.operator === 36 /* OperatorType.And */ || node.operator === 37 /* OperatorType.Or */) {
            let trueTarget = this._currentTrueTarget;
            let falseTarget = this._currentFalseTarget;
            let postRightLabel;
            if (!trueTarget || !falseTarget) {
                postRightLabel = this._createBranchLabel();
                trueTarget = falseTarget = postRightLabel;
            }
            const preRightLabel = this._createBranchLabel();
            if (node.operator === 36 /* OperatorType.And */) {
                this._bindConditional(node.leftExpression, preRightLabel, falseTarget);
            }
            else {
                this._bindConditional(node.leftExpression, trueTarget, preRightLabel);
            }
            this._currentFlowNode = this._finishFlowLabel(preRightLabel);
            this._bindConditional(node.rightExpression, trueTarget, falseTarget);
            if (postRightLabel) {
                this._currentFlowNode = this._finishFlowLabel(postRightLabel);
            }
        }
        else {
            // Temporarily set the true/false targets to undefined because
            // this binary operation is not part of a chain of logical expressions
            // (AND/OR/NOT subexpressions).
            this._disableTrueFalseTargets(() => {
                this.walk(node.leftExpression);
                this.walk(node.rightExpression);
            });
        }
        return false;
    }
    visitComprehension(node) {
        const enclosingFunction = ParseTreeUtils.getEnclosingFunction(node);
        // The first iterable is executed outside of the comprehension scope.
        if (node.forIfNodes.length > 0 && node.forIfNodes[0].nodeType === 12 /* ParseNodeType.ComprehensionFor */) {
            this.walk(node.forIfNodes[0].iterableExpression);
        }
        this._createNewScope(1 /* ScopeType.Comprehension */, this._getNonClassParentScope(), 
        /* proxyScope */ undefined, () => {
            var _a;
            AnalyzerNodeInfo.setScope(node, this._currentScope);
            const falseLabel = this._createBranchLabel();
            // We'll walk the forIfNodes list twice. The first time we'll
            // bind targets of for statements. The second time we'll walk
            // expressions and create the control flow graph.
            for (let i = 0; i < node.forIfNodes.length; i++) {
                const compr = node.forIfNodes[i];
                const addedSymbols = new Map();
                if (compr.nodeType === 12 /* ParseNodeType.ComprehensionFor */) {
                    this._bindPossibleTupleNamedTarget(compr.targetExpression, addedSymbols);
                    this._addInferredTypeAssignmentForVariable(compr.targetExpression, compr);
                    // Async for is not allowed outside of an async function
                    // unless we're in ipython mode.
                    if (compr.asyncToken && !this._fileInfo.ipythonMode) {
                        if (!enclosingFunction || !enclosingFunction.isAsync) {
                            // Allow if it's within a generator expression. Execution of
                            // generator expressions is deferred and therefore can be
                            // run within the context of an async function later.
                            if (((_a = node.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 34 /* ParseNodeType.List */) {
                                this._addSyntaxError(localize_1.LocMessage.asyncNotInAsyncFunction(), compr.asyncToken);
                            }
                        }
                    }
                }
            }
            for (let i = 0; i < node.forIfNodes.length; i++) {
                const compr = node.forIfNodes[i];
                if (compr.nodeType === 12 /* ParseNodeType.ComprehensionFor */) {
                    // We already walked the first iterable expression above,
                    // so skip it here.
                    if (i !== 0) {
                        this.walk(compr.iterableExpression);
                    }
                    this._createAssignmentTargetFlowNodes(compr.targetExpression, 
                    /* walkTargets */ true, 
                    /* unbound */ false);
                }
                else {
                    const trueLabel = this._createBranchLabel();
                    this._bindConditional(compr.testExpression, trueLabel, falseLabel);
                    this._currentFlowNode = this._finishFlowLabel(trueLabel);
                }
            }
            this.walk(node.expression);
            this._addAntecedent(falseLabel, this._currentFlowNode);
            this._currentFlowNode = this._finishFlowLabel(falseLabel);
        });
        return false;
    }
    visitMatch(node) {
        // Evaluate the subject expression.
        this.walk(node.subjectExpression);
        const expressionList = [];
        const isSubjectNarrowable = this._isNarrowingExpression(node.subjectExpression, expressionList);
        if (isSubjectNarrowable) {
            expressionList.forEach((expr) => {
                const referenceKey = (0, codeFlowTypes_1.createKeyForReference)(expr);
                this._currentScopeCodeFlowExpressions.add(referenceKey);
            });
        }
        const postMatchLabel = this._createBranchLabel();
        let foundIrrefutableCase = false;
        // Model the match statement as a series of if/elif clauses
        // each of which tests for the specified pattern (and optionally
        // for the guard condition).
        node.cases.forEach((caseStatement) => {
            const postCaseLabel = this._createBranchLabel();
            const preGuardLabel = this._createBranchLabel();
            const preSuiteLabel = this._createBranchLabel();
            // Evaluate the pattern.
            this._addAntecedent(preGuardLabel, this._currentFlowNode);
            if (!caseStatement.isIrrefutable) {
                this._addAntecedent(postCaseLabel, this._currentFlowNode);
            }
            else if (!caseStatement.guardExpression) {
                foundIrrefutableCase = true;
            }
            this._currentFlowNode = this._finishFlowLabel(preGuardLabel);
            // Bind the pattern.
            this.walk(caseStatement.pattern);
            this._createFlowNarrowForPattern(node.subjectExpression, caseStatement);
            // Apply the guard expression.
            if (caseStatement.guardExpression) {
                this._bindConditional(caseStatement.guardExpression, preSuiteLabel, postCaseLabel);
            }
            else {
                this._addAntecedent(preSuiteLabel, this._currentFlowNode);
            }
            this._currentFlowNode = this._finishFlowLabel(preSuiteLabel);
            // Bind the body of the case statement.
            this.walk(caseStatement.suite);
            this._addAntecedent(postMatchLabel, this._currentFlowNode);
            this._currentFlowNode = this._finishFlowLabel(postCaseLabel);
        });
        // Add a final narrowing step for the subject expression for the entire
        // match statement. This will compute the narrowed type if no case
        // statements are matched.
        if (isSubjectNarrowable) {
            this._createFlowNarrowForPattern(node.subjectExpression, node);
        }
        // Create an "implied else" to conditionally gate code flow based on
        // whether the narrowed type of the subject expression is Never at this point.
        if (!foundIrrefutableCase) {
            this._createFlowExhaustedMatch(node);
        }
        this._addAntecedent(postMatchLabel, this._currentFlowNode);
        this._currentFlowNode = this._finishFlowLabel(postMatchLabel);
        return false;
    }
    visitPatternAs(node) {
        const postOrLabel = this._createBranchLabel();
        node.orPatterns.forEach((orPattern) => {
            this.walk(orPattern);
            this._addAntecedent(postOrLabel, this._currentFlowNode);
        });
        this._currentFlowNode = this._finishFlowLabel(postOrLabel);
        if (node.target) {
            this.walk(node.target);
            const symbol = this._bindNameToScope(this._currentScope, node.target);
            this._createAssignmentTargetFlowNodes(node.target, /* walkTargets */ false, /* unbound */ false);
            if (symbol) {
                const declaration = {
                    type: 1 /* DeclarationType.Variable */,
                    node: node.target,
                    isConstant: (0, symbolNameUtils_1.isConstantName)(node.target.value),
                    inferredTypeSource: node,
                    uri: this._fileInfo.fileUri,
                    range: (0, positionUtils_1.convertTextRangeToRange)(node.target, this._fileInfo.lines),
                    moduleName: this._fileInfo.moduleName,
                    isInExceptSuite: this._isInExceptSuite,
                    isExplicitBinding: this._currentScope.getBindingType(node.target.value) !== undefined,
                };
                symbol.addDeclaration(declaration);
            }
        }
        return false;
    }
    visitPatternCapture(node) {
        if (!node.isWildcard) {
            this._addPatternCaptureTarget(node.target);
        }
        return true;
    }
    visitPatternMappingExpandEntry(node) {
        if (node.target.value !== '_') {
            this._addPatternCaptureTarget(node.target);
        }
        return true;
    }
    _formatModuleName(node) {
        return '.'.repeat(node.leadingDots) + node.nameParts.map((part) => part.value).join('.');
    }
    _getNonClassParentScope() {
        // We may not be able to use the current scope if it's a class scope.
        // Walk up until we find a non-class scope instead.
        let parentScope = this._currentScope;
        while (parentScope.type === 3 /* ScopeType.Class */) {
            parentScope = parentScope.parent;
        }
        return parentScope;
    }
    _addSlotsToCurrentScope(slotNameNodes) {
        (0, debug_1.assert)(this._currentScope.type === 3 /* ScopeType.Class */);
        let slotsContainsDict = false;
        for (const slotNameNode of slotNameNodes) {
            const slotName = slotNameNode.strings[0].value;
            if (slotName === '__dict__') {
                slotsContainsDict = true;
                continue;
            }
            let symbol = this._currentScope.lookUpSymbol(slotName);
            if (!symbol) {
                symbol = this._currentScope.addSymbol(slotName, 1 /* SymbolFlags.InitiallyUnbound */ | 4 /* SymbolFlags.ClassMember */);
                const honorPrivateNaming = this._fileInfo.diagnosticRuleSet.reportPrivateUsage !== 'none';
                if ((0, symbolNameUtils_1.isPrivateOrProtectedName)(slotName) && honorPrivateNaming) {
                    symbol.setIsPrivateMember();
                }
            }
            const declaration = {
                type: 1 /* DeclarationType.Variable */,
                node: slotNameNode,
                isConstant: (0, symbolNameUtils_1.isConstantName)(slotName),
                isDefinedBySlots: true,
                uri: this._fileInfo.fileUri,
                range: (0, positionUtils_1.convertTextRangeToRange)(slotNameNode, this._fileInfo.lines),
                moduleName: this._fileInfo.moduleName,
                isInExceptSuite: this._isInExceptSuite,
                isExplicitBinding: this._currentScope.getBindingType(slotName) !== undefined,
            };
            symbol.addDeclaration(declaration);
        }
        if (!slotsContainsDict) {
            this._currentScope.setSlotsNames(slotNameNodes.map((node) => node.strings[0].value));
        }
    }
    _isInComprehension(node, ignoreOutermostIterable = false) {
        let curNode = node;
        let prevNode;
        let prevPrevNode;
        while (curNode) {
            if (curNode.nodeType === 11 /* ParseNodeType.Comprehension */) {
                if (ignoreOutermostIterable && curNode.forIfNodes.length > 0) {
                    const outermostCompr = curNode.forIfNodes[0];
                    if (prevNode === outermostCompr && outermostCompr.nodeType === 12 /* ParseNodeType.ComprehensionFor */) {
                        if (prevPrevNode === outermostCompr.iterableExpression) {
                            return false;
                        }
                    }
                }
                return true;
            }
            prevPrevNode = prevNode;
            prevNode = curNode;
            curNode = curNode.parent;
        }
        return false;
    }
    _addPatternCaptureTarget(target) {
        const symbol = this._bindNameToScope(this._currentScope, target);
        this._createAssignmentTargetFlowNodes(target, /* walkTargets */ false, /* unbound */ false);
        if (symbol) {
            const declaration = {
                type: 1 /* DeclarationType.Variable */,
                node: target,
                isConstant: (0, symbolNameUtils_1.isConstantName)(target.value),
                inferredTypeSource: target.parent,
                uri: this._fileInfo.fileUri,
                range: (0, positionUtils_1.convertTextRangeToRange)(target, this._fileInfo.lines),
                moduleName: this._fileInfo.moduleName,
                isInExceptSuite: this._isInExceptSuite,
                isExplicitBinding: this._currentScope.getBindingType(target.value) !== undefined,
            };
            symbol.addDeclaration(declaration);
        }
    }
    _useExceptTargets(targets, callback) {
        const prevExceptTargets = this._currentExceptTargets;
        this._currentExceptTargets = targets;
        callback();
        this._currentExceptTargets = prevExceptTargets;
    }
    // Attempts to resolve the module name, import it, and return
    // its __all__ symbols.
    _getDunderAllNamesFromImport(varName) {
        var _a, _b;
        const varSymbol = this._currentScope.lookUpSymbol(varName);
        if (!varSymbol) {
            return undefined;
        }
        // There should be only one declaration for the variable.
        const aliasDecl = varSymbol.getDeclarations().find((decl) => decl.type === 8 /* DeclarationType.Alias */);
        const resolvedUri = (aliasDecl === null || aliasDecl === void 0 ? void 0 : aliasDecl.uri) && !aliasDecl.uri.isEmpty() && aliasDecl.loadSymbolsFromPath
            ? aliasDecl.uri
            : ((_a = aliasDecl === null || aliasDecl === void 0 ? void 0 : aliasDecl.submoduleFallback) === null || _a === void 0 ? void 0 : _a.uri) &&
                !aliasDecl.submoduleFallback.uri.isEmpty() &&
                aliasDecl.submoduleFallback.loadSymbolsFromPath
                ? aliasDecl.submoduleFallback.uri
                : undefined;
        if (!resolvedUri) {
            return undefined;
        }
        let lookupInfo = this._fileInfo.importLookup(resolvedUri);
        if (lookupInfo === null || lookupInfo === void 0 ? void 0 : lookupInfo.dunderAllNames) {
            return lookupInfo.dunderAllNames;
        }
        if (((_b = aliasDecl === null || aliasDecl === void 0 ? void 0 : aliasDecl.submoduleFallback) === null || _b === void 0 ? void 0 : _b.uri) && !aliasDecl.submoduleFallback.uri.isEmpty()) {
            lookupInfo = this._fileInfo.importLookup(aliasDecl.submoduleFallback.uri);
            return lookupInfo === null || lookupInfo === void 0 ? void 0 : lookupInfo.dunderAllNames;
        }
        return undefined;
    }
    _addImplicitFromImport(node, importInfo) {
        const symbolName = node.module.nameParts[0].value;
        const symbol = this._bindNameValueToScope(this._currentScope, symbolName);
        if (symbol) {
            this._createAliasDeclarationForMultipartImportName(node, /* importAlias */ undefined, importInfo, symbol);
        }
        this._createFlowAssignment(node.module.nameParts[0]);
    }
    _createAliasDeclarationForMultipartImportName(node, importAlias, importInfo, symbol) {
        var _a;
        const firstNamePartValue = node.module.nameParts[0].value;
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
        // See if there's already a matching alias declaration for this import.
        // if so, we'll update it rather than creating a new one. This is required
        // to handle cases where multiple import statements target the same
        // starting symbol such as "import a.b.c" and "import a.d". In this case,
        // we'll build a single declaration that describes the combined actions
        // of both import statements, thus reflecting the behavior of the
        // python module loader.
        const existingDecl = symbol
            .getDeclarations()
            .find((decl) => decl.type === 8 /* DeclarationType.Alias */ && decl.firstNamePart === firstNamePartValue);
        let newDecl;
        let uriOfLastSubmodule;
        if (importInfo && importInfo.isImportFound && !importInfo.isNativeLib && importInfo.resolvedUris.length > 0) {
            uriOfLastSubmodule = importInfo.resolvedUris[importInfo.resolvedUris.length - 1];
        }
        else {
            uriOfLastSubmodule = declaration_1.UnresolvedModuleMarker;
        }
        const isResolved = importInfo && importInfo.isImportFound && !importInfo.isNativeLib && importInfo.resolvedUris.length > 0;
        if (existingDecl) {
            newDecl = existingDecl;
        }
        else if (isResolved) {
            newDecl = {
                type: 8 /* DeclarationType.Alias */,
                node,
                uri: uriOfLastSubmodule,
                loadSymbolsFromPath: false,
                range: (0, textRange_1.getEmptyRange)(),
                usesLocalName: !!importAlias,
                moduleName: importAlias
                    ? this._formatModuleName(node.module)
                    : '.'.repeat(node.module.leadingDots) + firstNamePartValue,
                firstNamePart: firstNamePartValue,
                isInExceptSuite: this._isInExceptSuite,
            };
        }
        else {
            // If we couldn't resolve the import, create a dummy declaration with a
            // bogus path so it gets an unknown type (rather than an unbound type) at
            // analysis time.
            newDecl = {
                type: 8 /* DeclarationType.Alias */,
                node,
                uri: uriOfLastSubmodule,
                loadSymbolsFromPath: true,
                range: (0, textRange_1.getEmptyRange)(),
                usesLocalName: !!importAlias,
                moduleName: (_a = importInfo === null || importInfo === void 0 ? void 0 : importInfo.importName) !== null && _a !== void 0 ? _a : '',
                firstNamePart: importAlias
                    ? this._formatModuleName(node.module)
                    : '.'.repeat(node.module.leadingDots) + firstNamePartValue,
                isUnresolved: true,
                isInExceptSuite: this._isInExceptSuite,
            };
        }
        // See if there is import info for this part of the path. This allows us
        // to implicitly import all of the modules in a multi-part module name.
        const implicitImportInfo = AnalyzerNodeInfo.getImportInfo(node.module.nameParts[0]);
        if (implicitImportInfo && implicitImportInfo.resolvedUris.length) {
            newDecl.uri = implicitImportInfo.resolvedUris[0];
            newDecl.loadSymbolsFromPath = true;
            this._addImplicitImportsToLoaderActions(implicitImportInfo, newDecl);
        }
        // Add the implicit imports for this module if it's the last
        // name part we're resolving.
        if (importAlias || node.module.nameParts.length === 1) {
            newDecl.uri = uriOfLastSubmodule;
            newDecl.loadSymbolsFromPath = true;
            newDecl.isUnresolved = false;
            if (importInfo) {
                this._addImplicitImportsToLoaderActions(importInfo, newDecl);
            }
        }
        else {
            // Fill in the remaining name parts.
            let curLoaderActions = newDecl;
            for (let i = 1; i < node.module.nameParts.length; i++) {
                const namePartValue = node.module.nameParts[i].value;
                // Is there an existing loader action for this name?
                let loaderActions = curLoaderActions.implicitImports
                    ? curLoaderActions.implicitImports.get(namePartValue)
                    : undefined;
                if (!loaderActions) {
                    const loaderActionPath = importInfo && i < importInfo.resolvedUris.length
                        ? importInfo.resolvedUris[i]
                        : declaration_1.UnresolvedModuleMarker;
                    // Allocate a new loader action.
                    loaderActions = {
                        uri: loaderActionPath,
                        loadSymbolsFromPath: false,
                        implicitImports: new Map(),
                        isUnresolved: !isResolved,
                    };
                    if (!curLoaderActions.implicitImports) {
                        curLoaderActions.implicitImports = new Map();
                    }
                    curLoaderActions.implicitImports.set(namePartValue, loaderActions);
                }
                if (i === node.module.nameParts.length - 1) {
                    // If this is the last name part we're resolving, add in the
                    // implicit imports as well.
                    if (importInfo && i < importInfo.resolvedUris.length) {
                        loaderActions.uri = importInfo.resolvedUris[i];
                        loaderActions.loadSymbolsFromPath = true;
                        this._addImplicitImportsToLoaderActions(importInfo, loaderActions);
                    }
                }
                else {
                    // If this isn't the last name part we're resolving, see if there
                    // is import info for this part of the path. This allows us to implicitly
                    // import all of the modules in a multi-part module name (e.g. "import a.b.c"
                    // imports "a" and "a.b" and "a.b.c").
                    const implicitImportInfo = AnalyzerNodeInfo.getImportInfo(node.module.nameParts[i]);
                    if (implicitImportInfo && implicitImportInfo.resolvedUris.length) {
                        loaderActions.uri = implicitImportInfo.resolvedUris[i];
                        loaderActions.loadSymbolsFromPath = true;
                        this._addImplicitImportsToLoaderActions(implicitImportInfo, loaderActions);
                    }
                }
                curLoaderActions = loaderActions;
            }
        }
        if (!existingDecl) {
            symbol.addDeclaration(newDecl);
        }
    }
    _getWildcardImportNames(lookupInfo) {
        const namesToImport = [];
        // If a dunder all symbol is defined, it takes precedence.
        if (lookupInfo.dunderAllNames) {
            if (!lookupInfo.usesUnsupportedDunderAllForm) {
                return lookupInfo.dunderAllNames;
            }
            (0, collectionUtils_1.appendArray)(namesToImport, lookupInfo.dunderAllNames);
        }
        lookupInfo.symbolTable.forEach((symbol, name) => {
            if (!symbol.isExternallyHidden() && !name.startsWith('_')) {
                namesToImport.push(name);
            }
        });
        return namesToImport;
    }
    _walkStatementsAndReportUnreachable(statements) {
        let foundUnreachableStatement = false;
        for (const statement of statements) {
            AnalyzerNodeInfo.setFlowNode(statement, this._currentFlowNode);
            if (!foundUnreachableStatement) {
                foundUnreachableStatement = this._isCodeUnreachable();
            }
            if (!foundUnreachableStatement) {
                this.walk(statement);
            }
            else {
                // If we're within a function, we need to look for unreachable yield
                // statements because they affect the behavior of the function (making
                // it a generator) even if they're never executed.
                if (this._targetFunctionDeclaration && !this._targetFunctionDeclaration.isGenerator) {
                    const yieldFinder = new YieldFinder();
                    if (yieldFinder.checkContainsYield(statement)) {
                        this._targetFunctionDeclaration.isGenerator = true;
                    }
                }
                // In case there are any class or function statements within this
                // subtree, we need to create dummy scopes for them. The type analyzer
                // depends on scopes being present.
                if (!this._moduleSymbolOnly) {
                    const dummyScopeGenerator = new DummyScopeGenerator(this._currentScope);
                    dummyScopeGenerator.walk(statement);
                }
            }
        }
        return false;
    }
    _createStartFlowNode() {
        const flowNode = {
            flags: codeFlowTypes_1.FlowFlags.Start,
            id: this._getUniqueFlowNodeId(),
        };
        return flowNode;
    }
    _createBranchLabel(preBranchAntecedent) {
        const flowNode = {
            flags: codeFlowTypes_1.FlowFlags.BranchLabel,
            id: this._getUniqueFlowNodeId(),
            antecedents: [],
            preBranchAntecedent,
            affectedExpressions: undefined,
        };
        return flowNode;
    }
    // Create a flow node that narrows the type of the subject expression for
    // a specified case statement or the entire match statement (if the flow
    // falls through the bottom of all cases).
    _createFlowNarrowForPattern(subjectExpression, statement) {
        const flowNode = {
            flags: codeFlowTypes_1.FlowFlags.NarrowForPattern,
            id: this._getUniqueFlowNodeId(),
            subjectExpression,
            statement,
            antecedent: this._currentFlowNode,
        };
        this._currentFlowNode = flowNode;
    }
    _createContextManagerLabel(expressions, isAsync, blockIfSwallowsExceptions) {
        const flowNode = {
            flags: codeFlowTypes_1.FlowFlags.PostContextManager | codeFlowTypes_1.FlowFlags.BranchLabel,
            id: this._getUniqueFlowNodeId(),
            antecedents: [],
            expressions,
            affectedExpressions: undefined,
            isAsync,
            blockIfSwallowsExceptions,
        };
        return flowNode;
    }
    _createLoopLabel() {
        const flowNode = {
            flags: codeFlowTypes_1.FlowFlags.LoopLabel,
            id: this._getUniqueFlowNodeId(),
            antecedents: [],
            affectedExpressions: undefined,
        };
        return flowNode;
    }
    _finishFlowLabel(node) {
        // If there were no antecedents, this is unreachable.
        if (node.antecedents.length === 0) {
            return Binder._unreachableFlowNode;
        }
        // If there was only one antecedent and this is a simple
        // branch label, there's no need for a label to exist.
        if (node.antecedents.length === 1 && node.flags === codeFlowTypes_1.FlowFlags.BranchLabel) {
            return node.antecedents[0];
        }
        // The cyclomatic complexity is the number of edges minus the
        // number of nodes in the graph. Add n-1 where n is the number
        // of antecedents (edges) and 1 represents the label node.
        this._codeFlowComplexity += node.antecedents.length - 1;
        return node;
    }
    // Creates a node that creates a "gate" that is closed (doesn't allow for code
    // flow) if the specified expression is never once it is narrowed (in either the
    // positive or negative case).
    _bindNeverCondition(node, target, isPositiveTest) {
        const expressionList = [];
        if (node.nodeType === 55 /* ParseNodeType.UnaryOperation */ && node.operator === 38 /* OperatorType.Not */) {
            this._bindNeverCondition(node.expression, target, !isPositiveTest);
        }
        else if (node.nodeType === 7 /* ParseNodeType.BinaryOperation */ &&
            (node.operator === 36 /* OperatorType.And */ || node.operator === 37 /* OperatorType.Or */)) {
            let isAnd = node.operator === 36 /* OperatorType.And */;
            if (isPositiveTest) {
                isAnd = !isAnd;
            }
            if (isAnd) {
                // In the And case, we need to gate the synthesized else clause if both
                // of the operands evaluate to never once they are narrowed.
                const savedCurrentFlowNode = this._currentFlowNode;
                this._bindNeverCondition(node.leftExpression, target, isPositiveTest);
                this._currentFlowNode = savedCurrentFlowNode;
                this._bindNeverCondition(node.rightExpression, target, isPositiveTest);
            }
            else {
                const initialCurrentFlowNode = this._currentFlowNode;
                // In the Or case, we need to gate the synthesized else clause if either
                // of the operands evaluate to never.
                const afterLabel = this._createBranchLabel();
                this._bindNeverCondition(node.leftExpression, afterLabel, isPositiveTest);
                // If the condition didn't result in any new flow nodes, we can skip
                // checking the other condition.
                if (initialCurrentFlowNode !== this._currentFlowNode) {
                    this._currentFlowNode = this._finishFlowLabel(afterLabel);
                    const prevCurrentNode = this._currentFlowNode;
                    this._bindNeverCondition(node.rightExpression, target, isPositiveTest);
                    // If the second condition resulted in no new control flow node, we can
                    // eliminate this entire subgraph.
                    if (prevCurrentNode === this._currentFlowNode) {
                        this._currentFlowNode = initialCurrentFlowNode;
                    }
                }
            }
        }
        else {
            // Limit only to expressions that contain a narrowable subexpression
            // that is a name. This avoids complexities with composite expressions like
            // member access or index expressions.
            if (this._isNarrowingExpression(node, expressionList, /* neverNarrowingExpressions */ true)) {
                const filteredExprList = expressionList.filter((expr) => expr.nodeType === 38 /* ParseNodeType.Name */);
                if (filteredExprList.length > 0) {
                    this._currentFlowNode = this._createFlowConditional(isPositiveTest ? codeFlowTypes_1.FlowFlags.TrueNeverCondition : codeFlowTypes_1.FlowFlags.FalseNeverCondition, this._currentFlowNode, node);
                }
            }
            this._addAntecedent(target, this._currentFlowNode);
        }
    }
    _bindConditional(node, trueTarget, falseTarget) {
        this._setTrueFalseTargets(trueTarget, falseTarget, () => {
            this.walk(node);
        });
        if (!this._isLogicalExpression(node)) {
            this._addAntecedent(trueTarget, this._createFlowConditional(codeFlowTypes_1.FlowFlags.TrueCondition, this._currentFlowNode, node));
            this._addAntecedent(falseTarget, this._createFlowConditional(codeFlowTypes_1.FlowFlags.FalseCondition, this._currentFlowNode, node));
        }
    }
    _disableTrueFalseTargets(callback) {
        this._setTrueFalseTargets(/* trueTarget */ undefined, /* falseTarget */ undefined, callback);
    }
    _setTrueFalseTargets(trueTarget, falseTarget, callback) {
        const savedTrueTarget = this._currentTrueTarget;
        const savedFalseTarget = this._currentFalseTarget;
        this._currentTrueTarget = trueTarget;
        this._currentFalseTarget = falseTarget;
        callback();
        this._currentTrueTarget = savedTrueTarget;
        this._currentFalseTarget = savedFalseTarget;
    }
    _createFlowConditional(flags, antecedent, expression) {
        if (antecedent.flags & codeFlowTypes_1.FlowFlags.Unreachable) {
            return antecedent;
        }
        const staticValue = StaticExpressions.evaluateStaticBoolLikeExpression(expression, this._fileInfo.executionEnvironment, this._fileInfo.definedConstants, this._typingImportAliases, this._sysImportAliases);
        if ((staticValue === true && flags & codeFlowTypes_1.FlowFlags.FalseCondition) ||
            (staticValue === false && flags & codeFlowTypes_1.FlowFlags.TrueCondition)) {
            return Binder._unreachableFlowNode;
        }
        const expressionList = [];
        if (!this._isNarrowingExpression(expression, expressionList, 
        /* filterForNeverNarrowing */ (flags &
            (codeFlowTypes_1.FlowFlags.TrueNeverCondition | codeFlowTypes_1.FlowFlags.FalseNeverCondition)) !==
            0)) {
            return antecedent;
        }
        expressionList.forEach((expr) => {
            const referenceKey = (0, codeFlowTypes_1.createKeyForReference)(expr);
            this._currentScopeCodeFlowExpressions.add(referenceKey);
        });
        // Select the first name expression.
        const filteredExprList = expressionList.filter((expr) => expr.nodeType === 38 /* ParseNodeType.Name */);
        const conditionalFlowNode = {
            flags,
            id: this._getUniqueFlowNodeId(),
            reference: filteredExprList.length > 0 ? filteredExprList[0] : undefined,
            expression,
            antecedent,
        };
        this._addExceptTargets(conditionalFlowNode);
        return conditionalFlowNode;
    }
    // Indicates whether the expression is a NOT, AND or OR expression.
    _isLogicalExpression(expression) {
        switch (expression.nodeType) {
            case 55 /* ParseNodeType.UnaryOperation */: {
                return expression.operator === 38 /* OperatorType.Not */;
            }
            case 7 /* ParseNodeType.BinaryOperation */: {
                return expression.operator === 36 /* OperatorType.And */ || expression.operator === 37 /* OperatorType.Or */;
            }
        }
        return false;
    }
    // Determines whether the specified expression can be used for conditional
    // type narrowing. The expression atoms (names, member accesses and index)
    // are provided as an output in the expressionList.
    // If filterForNeverNarrowing is true, we limit some types of narrowing
    // expressions for performance reasons.
    // The isComplexExpression parameter is used internally to determine whether
    // the call is an atom (name, member access, index - plus a "not" form of
    // these) or something more complex (binary operator, call, etc.).
    _isNarrowingExpression(expression, expressionList, filterForNeverNarrowing = false, isComplexExpression = false) {
        switch (expression.nodeType) {
            case 38 /* ParseNodeType.Name */:
            case 35 /* ParseNodeType.MemberAccess */:
            case 27 /* ParseNodeType.Index */: {
                if (filterForNeverNarrowing) {
                    // Never narrowing doesn't support member access or index
                    // expressions.
                    if (expression.nodeType !== 38 /* ParseNodeType.Name */) {
                        return false;
                    }
                    // Never narrowing doesn't support simple names (falsy
                    // or truthy narrowing) because it's too expensive and
                    // provides relatively little utility.
                    if (!isComplexExpression) {
                        return false;
                    }
                }
                if ((0, codeFlowTypes_1.isCodeFlowSupportedForReference)(expression)) {
                    expressionList.push(expression);
                    if (!filterForNeverNarrowing) {
                        // If the expression is a member access expression, add its
                        // leftExpression to the expression list because that expression
                        // can be narrowed based on the attribute type.
                        if (expression.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                            if ((0, codeFlowTypes_1.isCodeFlowSupportedForReference)(expression.leftExpression)) {
                                expressionList.push(expression.leftExpression);
                            }
                        }
                        // If the expression is an index expression with a supported
                        // subscript, add its baseExpression to the expression list because
                        // that expression can be narrowed.
                        if (expression.nodeType === 27 /* ParseNodeType.Index */ &&
                            expression.items.length === 1 &&
                            !expression.trailingComma &&
                            expression.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */) {
                            if ((0, codeFlowTypes_1.isCodeFlowSupportedForReference)(expression.baseExpression)) {
                                expressionList.push(expression.baseExpression);
                            }
                        }
                    }
                    return true;
                }
                return false;
            }
            case 4 /* ParseNodeType.AssignmentExpression */: {
                expressionList.push(expression.name);
                this._isNarrowingExpression(expression.rightExpression, expressionList, filterForNeverNarrowing, 
                /* isComplexExpression */ true);
                return true;
            }
            case 7 /* ParseNodeType.BinaryOperation */: {
                const isOrIsNotOperator = expression.operator === 39 /* OperatorType.Is */ || expression.operator === 40 /* OperatorType.IsNot */;
                const equalsOrNotEqualsOperator = expression.operator === 12 /* OperatorType.Equals */ || expression.operator === 28 /* OperatorType.NotEquals */;
                if (isOrIsNotOperator || equalsOrNotEqualsOperator) {
                    // Look for "X is None", "X is not None", "X == None", "X != None".
                    // These are commonly-used patterns used in control flow.
                    if (expression.rightExpression.nodeType === 14 /* ParseNodeType.Constant */ &&
                        expression.rightExpression.constType === 26 /* KeywordType.None */) {
                        return this._isNarrowingExpression(expression.leftExpression, expressionList, filterForNeverNarrowing, 
                        /* isComplexExpression */ true);
                    }
                    // Look for "type(X) is Y" or "type(X) is not Y".
                    if (isOrIsNotOperator &&
                        expression.leftExpression.nodeType === 9 /* ParseNodeType.Call */ &&
                        expression.leftExpression.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                        expression.leftExpression.leftExpression.value === 'type' &&
                        expression.leftExpression.arguments.length === 1 &&
                        expression.leftExpression.arguments[0].argumentCategory === 0 /* ArgumentCategory.Simple */) {
                        return this._isNarrowingExpression(expression.leftExpression.arguments[0].valueExpression, expressionList, filterForNeverNarrowing, 
                        /* isComplexExpression */ true);
                    }
                    const isLeftNarrowing = this._isNarrowingExpression(expression.leftExpression, expressionList, filterForNeverNarrowing, 
                    /* isComplexExpression */ true);
                    // Look for "X is Y" or "X is not Y".
                    // Look for X == <literal> or X != <literal>
                    // Look for len(X) == <literal> or len(X) != <literal>
                    return isLeftNarrowing;
                }
                // Look for len(X) < <literal>, len(X) <= <literal>, len(X) > <literal>, len(X) >= <literal>.
                if (expression.rightExpression.nodeType === 40 /* ParseNodeType.Number */ &&
                    expression.rightExpression.isInteger) {
                    if (expression.operator === 20 /* OperatorType.LessThan */ ||
                        expression.operator === 21 /* OperatorType.LessThanOrEqual */ ||
                        expression.operator === 15 /* OperatorType.GreaterThan */ ||
                        expression.operator === 16 /* OperatorType.GreaterThanOrEqual */) {
                        const isLeftNarrowing = this._isNarrowingExpression(expression.leftExpression, expressionList, filterForNeverNarrowing, 
                        /* isComplexExpression */ true);
                        return isLeftNarrowing;
                    }
                }
                // Look for "<string> in Y" or "<string> not in Y".
                if (expression.operator === 41 /* OperatorType.In */ || expression.operator === 42 /* OperatorType.NotIn */) {
                    if (expression.leftExpression.nodeType === 48 /* ParseNodeType.StringList */ &&
                        this._isNarrowingExpression(expression.rightExpression, expressionList, filterForNeverNarrowing, 
                        /* isComplexExpression */ true)) {
                        return true;
                    }
                }
                // Look for "X in Y" or "X not in Y".
                if (expression.operator === 41 /* OperatorType.In */ || expression.operator === 42 /* OperatorType.NotIn */) {
                    const isLeftNarrowable = this._isNarrowingExpression(expression.leftExpression, expressionList, filterForNeverNarrowing, 
                    /* isComplexExpression */ true);
                    const isRightNarrowable = this._isNarrowingExpression(expression.rightExpression, expressionList, filterForNeverNarrowing, 
                    /* isComplexExpression */ true);
                    return isLeftNarrowable || isRightNarrowable;
                }
                return false;
            }
            case 55 /* ParseNodeType.UnaryOperation */: {
                return (expression.operator === 38 /* OperatorType.Not */ &&
                    this._isNarrowingExpression(expression.expression, expressionList, filterForNeverNarrowing, 
                    /* isComplexExpression */ false));
            }
            case 5 /* ParseNodeType.AugmentedAssignment */: {
                return this._isNarrowingExpression(expression.rightExpression, expressionList, filterForNeverNarrowing, 
                /* isComplexExpression */ true);
            }
            case 9 /* ParseNodeType.Call */: {
                if (expression.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                    (expression.leftExpression.value === 'isinstance' ||
                        expression.leftExpression.value === 'issubclass') &&
                    expression.arguments.length === 2) {
                    return this._isNarrowingExpression(expression.arguments[0].valueExpression, expressionList, filterForNeverNarrowing, 
                    /* isComplexExpression */ true);
                }
                if (expression.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                    expression.leftExpression.value === 'callable' &&
                    expression.arguments.length === 1) {
                    return this._isNarrowingExpression(expression.arguments[0].valueExpression, expressionList, filterForNeverNarrowing, 
                    /* isComplexExpression */ true);
                }
                // Is this potentially a call to a user-defined type guard function?
                if (expression.arguments.length >= 1) {
                    // Never narrowing doesn't support type guards because they do not
                    // offer negative narrowing.
                    if (filterForNeverNarrowing) {
                        return false;
                    }
                    return this._isNarrowingExpression(expression.arguments[0].valueExpression, expressionList, filterForNeverNarrowing, 
                    /* isComplexExpression */ true);
                }
            }
        }
        return false;
    }
    _createAssignmentTargetFlowNodes(target, walkTargets, unbound) {
        switch (target.nodeType) {
            case 38 /* ParseNodeType.Name */:
            case 35 /* ParseNodeType.MemberAccess */: {
                this._createFlowAssignment(target, unbound);
                if (walkTargets) {
                    this.walk(target);
                }
                break;
            }
            case 27 /* ParseNodeType.Index */: {
                this._createFlowAssignment(target, unbound);
                if (walkTargets) {
                    this.walk(target);
                }
                break;
            }
            case 52 /* ParseNodeType.Tuple */: {
                target.expressions.forEach((expr) => {
                    this._createAssignmentTargetFlowNodes(expr, walkTargets, unbound);
                });
                break;
            }
            case 54 /* ParseNodeType.TypeAnnotation */: {
                this._createAssignmentTargetFlowNodes(target.valueExpression, /* walkTargets */ false, unbound);
                if (walkTargets) {
                    this.walk(target);
                }
                break;
            }
            case 56 /* ParseNodeType.Unpack */: {
                this._createAssignmentTargetFlowNodes(target.expression, /* walkTargets */ false, unbound);
                if (walkTargets) {
                    this.walk(target);
                }
                break;
            }
            case 34 /* ParseNodeType.List */: {
                target.entries.forEach((entry) => {
                    this._createAssignmentTargetFlowNodes(entry, walkTargets, unbound);
                });
                break;
            }
            default: {
                if (walkTargets) {
                    this.walk(target);
                }
            }
        }
    }
    _createCallFlowNode(node) {
        if (!this._isCodeUnreachable()) {
            this._addExceptTargets(this._currentFlowNode);
            const flowNode = {
                flags: codeFlowTypes_1.FlowFlags.Call,
                id: this._getUniqueFlowNodeId(),
                node,
                antecedent: this._currentFlowNode,
            };
            this._currentFlowNode = flowNode;
        }
    }
    _createVariableAnnotationFlowNode() {
        if (!this._isCodeUnreachable()) {
            const flowNode = {
                flags: codeFlowTypes_1.FlowFlags.VariableAnnotation,
                id: this._getUniqueFlowNodeId(),
                antecedent: this._currentFlowNode,
            };
            this._currentFlowNode = flowNode;
        }
    }
    _createFlowAssignment(node, unbound = false) {
        let targetSymbolId = symbol_1.indeterminateSymbolId;
        if (node.nodeType === 38 /* ParseNodeType.Name */) {
            const symbolWithScope = this._currentScope.lookUpSymbolRecursive(node.value);
            (0, debug_1.assert)(symbolWithScope !== undefined);
            targetSymbolId = symbolWithScope.symbol.id;
        }
        const prevFlowNode = this._currentFlowNode;
        if (!this._isCodeUnreachable() && (0, codeFlowTypes_1.isCodeFlowSupportedForReference)(node)) {
            const flowNode = {
                flags: codeFlowTypes_1.FlowFlags.Assignment,
                id: this._getUniqueFlowNodeId(),
                node,
                antecedent: this._currentFlowNode,
                targetSymbolId,
            };
            const referenceKey = (0, codeFlowTypes_1.createKeyForReference)(node);
            this._currentScopeCodeFlowExpressions.add(referenceKey);
            if (unbound) {
                flowNode.flags |= codeFlowTypes_1.FlowFlags.Unbind;
            }
            // Assume that an assignment to a member access expression
            // can potentially generate an exception.
            if (node.nodeType === 35 /* ParseNodeType.MemberAccess */) {
                this._addExceptTargets(flowNode);
            }
            this._currentFlowNode = flowNode;
        }
        // If we're marking the node as unbound and there is already a flow node
        // associated with the node, don't replace it. This case applies for symbols
        // introduced in except clauses. If there is no use the previous flow node
        // associated, use the previous flow node (applies in the del case).
        // Otherwise, the node will be evaluated as unbound at this point in the flow.
        if (!unbound || AnalyzerNodeInfo.getFlowNode(node) === undefined) {
            AnalyzerNodeInfo.setFlowNode(node, unbound ? prevFlowNode : this._currentFlowNode);
        }
    }
    _createFlowWildcardImport(node, names) {
        if (!this._isCodeUnreachable()) {
            const flowNode = {
                flags: codeFlowTypes_1.FlowFlags.WildcardImport,
                id: this._getUniqueFlowNodeId(),
                node,
                names,
                antecedent: this._currentFlowNode,
            };
            this._addExceptTargets(flowNode);
            this._currentFlowNode = flowNode;
        }
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
    }
    _createFlowExhaustedMatch(node) {
        if (!this._isCodeUnreachable()) {
            const flowNode = {
                flags: codeFlowTypes_1.FlowFlags.ExhaustedMatch,
                id: this._getUniqueFlowNodeId(),
                node,
                antecedent: this._currentFlowNode,
                subjectExpression: node.subjectExpression,
            };
            this._currentFlowNode = flowNode;
        }
        AnalyzerNodeInfo.setAfterFlowNode(node, this._currentFlowNode);
    }
    _isCodeUnreachable() {
        return !!(this._currentFlowNode.flags & codeFlowTypes_1.FlowFlags.Unreachable);
    }
    _addExceptTargets(flowNode) {
        // If there are any except targets, then we're in a try block, and we
        // have to assume that an exception can be raised after every assignment.
        if (this._currentExceptTargets) {
            this._currentExceptTargets.forEach((label) => {
                this._addAntecedent(label, flowNode);
            });
        }
    }
    _trackCodeFlowExpressions(callback) {
        const savedExpressions = this._currentScopeCodeFlowExpressions;
        this._currentScopeCodeFlowExpressions = new Set();
        callback();
        const scopedExpressions = this._currentScopeCodeFlowExpressions;
        if (savedExpressions) {
            this._currentScopeCodeFlowExpressions.forEach((value) => {
                savedExpressions.add(value);
            });
        }
        this._currentScopeCodeFlowExpressions = savedExpressions;
        return scopedExpressions;
    }
    _bindLoopStatement(preLoopLabel, postLoopLabel, callback) {
        const savedContinueTarget = this._currentContinueTarget;
        const savedBreakTarget = this._currentBreakTarget;
        this._currentContinueTarget = preLoopLabel;
        this._currentBreakTarget = postLoopLabel;
        preLoopLabel.affectedExpressions = this._trackCodeFlowExpressions(callback);
        this._currentContinueTarget = savedContinueTarget;
        this._currentBreakTarget = savedBreakTarget;
    }
    _addAntecedent(label, antecedent) {
        if (!(this._currentFlowNode.flags & codeFlowTypes_1.FlowFlags.Unreachable)) {
            // Don't add the same antecedent twice.
            if (!label.antecedents.some((existing) => existing.id === antecedent.id)) {
                label.antecedents.push(antecedent);
            }
        }
    }
    _bindNameToScope(scope, node, addedSymbols) {
        return this._bindNameValueToScope(scope, node.value, addedSymbols);
    }
    _bindNameValueToScope(scope, name, addedSymbols) {
        // Is this name already bound to a scope other than the local one?
        const bindingType = this._currentScope.getBindingType(name);
        if (bindingType !== undefined) {
            const scopeToUse = bindingType === 0 /* NameBindingType.Nonlocal */
                ? this._currentScope.parent
                : this._currentScope.getGlobalScope().scope;
            const symbolWithScope = scopeToUse.lookUpSymbolRecursive(name);
            if (symbolWithScope) {
                return symbolWithScope.symbol;
            }
        }
        else {
            // Don't overwrite an existing symbol.
            let symbol = scope.lookUpSymbol(name);
            if (!symbol) {
                symbol = scope.addSymbol(name, 1 /* SymbolFlags.InitiallyUnbound */ | 4 /* SymbolFlags.ClassMember */);
                if (this._currentScope.type === 4 /* ScopeType.Module */ || this._currentScope.type === 5 /* ScopeType.Builtin */) {
                    if ((0, symbolNameUtils_1.isPrivateOrProtectedName)(name)) {
                        if ((0, symbolNameUtils_1.isPrivateName)(name)) {
                            // Private names within classes are mangled, so they are always externally hidden.
                            if (scope.type === 3 /* ScopeType.Class */) {
                                symbol.setIsExternallyHidden();
                            }
                            else {
                                this._potentialPrivateSymbols.set(name, symbol);
                            }
                        }
                        else if (this._fileInfo.isStubFile || this._fileInfo.isInPyTypedPackage) {
                            if (this._currentScope.type === 5 /* ScopeType.Builtin */) {
                                // Don't include private-named symbols in the builtin scope.
                                symbol.setIsExternallyHidden();
                            }
                            else {
                                this._potentialPrivateSymbols.set(name, symbol);
                            }
                        }
                        else {
                            symbol.setIsPrivateMember();
                        }
                    }
                }
                if (addedSymbols) {
                    addedSymbols.set(name, symbol);
                }
            }
            return symbol;
        }
        return undefined;
    }
    _bindPossibleTupleNamedTarget(target, addedSymbols) {
        switch (target.nodeType) {
            case 38 /* ParseNodeType.Name */: {
                this._bindNameToScope(this._currentScope, target, addedSymbols);
                break;
            }
            case 52 /* ParseNodeType.Tuple */: {
                target.expressions.forEach((expr) => {
                    this._bindPossibleTupleNamedTarget(expr, addedSymbols);
                });
                break;
            }
            case 34 /* ParseNodeType.List */: {
                target.entries.forEach((expr) => {
                    this._bindPossibleTupleNamedTarget(expr, addedSymbols);
                });
                break;
            }
            case 54 /* ParseNodeType.TypeAnnotation */: {
                this._bindPossibleTupleNamedTarget(target.valueExpression, addedSymbols);
                break;
            }
            case 56 /* ParseNodeType.Unpack */: {
                this._bindPossibleTupleNamedTarget(target.expression, addedSymbols);
                break;
            }
        }
    }
    _addImplicitSymbolToCurrentScope(nameValue, node, type) {
        const symbol = this._addSymbolToCurrentScope(nameValue, /* isInitiallyUnbound */ false);
        if (symbol) {
            symbol.addDeclaration({
                type: 0 /* DeclarationType.Intrinsic */,
                node,
                intrinsicType: type,
                uri: this._fileInfo.fileUri,
                range: (0, textRange_1.getEmptyRange)(),
                moduleName: this._fileInfo.moduleName,
                isInExceptSuite: this._isInExceptSuite,
            });
            symbol.setIsIgnoredForProtocolMatch();
        }
    }
    // Adds a new symbol with the specified name if it doesn't already exist.
    _addSymbolToCurrentScope(nameValue, isInitiallyUnbound) {
        let symbol = this._currentScope.lookUpSymbol(nameValue);
        if (!symbol) {
            let symbolFlags = 0 /* SymbolFlags.None */;
            if (isInitiallyUnbound) {
                symbolFlags |= 1 /* SymbolFlags.InitiallyUnbound */;
            }
            if (this._currentScope.type === 3 /* ScopeType.Class */) {
                symbolFlags |= 4 /* SymbolFlags.ClassMember */;
            }
            if (this._fileInfo.isStubFile && (0, symbolNameUtils_1.isPrivateOrProtectedName)(nameValue)) {
                symbolFlags |= 2 /* SymbolFlags.ExternallyHidden */;
            }
            // Add the symbol. Assume that symbols with a default type source ID
            // are "implicit" symbols added to the scope. These are not initially unbound.
            symbol = this._currentScope.addSymbol(nameValue, symbolFlags);
        }
        return symbol;
    }
    _createNewScope(scopeType, parentScope, proxyScope, callback) {
        const prevScope = this._currentScope;
        const newScope = new scope_1.Scope(scopeType, parentScope, proxyScope);
        this._currentScope = newScope;
        // If this scope is an execution scope, allocate a new reference map.
        const isExecutionScope = scopeType === 5 /* ScopeType.Builtin */ || scopeType === 4 /* ScopeType.Module */ || scopeType === 2 /* ScopeType.Function */;
        const prevExpressions = this._currentScopeCodeFlowExpressions;
        if (isExecutionScope) {
            this._currentScopeCodeFlowExpressions = new Set();
        }
        callback();
        this._currentScopeCodeFlowExpressions = prevExpressions;
        this._currentScope = prevScope;
        return newScope;
    }
    _addInferredTypeAssignmentForVariable(target, source, isPossibleTypeAlias = false) {
        switch (target.nodeType) {
            case 38 /* ParseNodeType.Name */: {
                const name = target;
                const symbolWithScope = this._currentScope.lookUpSymbolRecursive(name.value);
                if (symbolWithScope && symbolWithScope.symbol) {
                    const declaration = {
                        type: 1 /* DeclarationType.Variable */,
                        node: target,
                        isConstant: (0, symbolNameUtils_1.isConstantName)(target.value),
                        inferredTypeSource: source,
                        isInferenceAllowedInPyTyped: this._isInferenceAllowedInPyTyped(name.value),
                        typeAliasName: isPossibleTypeAlias ? target : undefined,
                        uri: this._fileInfo.fileUri,
                        range: (0, positionUtils_1.convertTextRangeToRange)(name, this._fileInfo.lines),
                        moduleName: this._fileInfo.moduleName,
                        isInExceptSuite: this._isInExceptSuite,
                        docString: this._getVariableDocString(target),
                        isExplicitBinding: this._currentScope.getBindingType(name.value) !== undefined,
                    };
                    symbolWithScope.symbol.addDeclaration(declaration);
                }
                break;
            }
            case 35 /* ParseNodeType.MemberAccess */: {
                const memberAccessInfo = this._getMemberAccessInfo(target);
                if (memberAccessInfo) {
                    const name = target.memberName;
                    let symbol = memberAccessInfo.classScope.lookUpSymbol(name.value);
                    if (!symbol) {
                        symbol = memberAccessInfo.classScope.addSymbol(name.value, 1 /* SymbolFlags.InitiallyUnbound */);
                        const honorPrivateNaming = this._fileInfo.diagnosticRuleSet.reportPrivateUsage !== 'none';
                        if ((0, symbolNameUtils_1.isPrivateOrProtectedName)(name.value) && honorPrivateNaming) {
                            symbol.setIsPrivateMember();
                        }
                    }
                    if (memberAccessInfo.isInstanceMember) {
                        // If a method (which has a declared type) is being overwritten
                        // by an expression with no declared type, don't mark it as
                        // an instance member because the type evaluator will think
                        // that it doesn't need to perform object binding.
                        if (!symbol.isClassMember() ||
                            !symbol
                                .getDeclarations()
                                .some((decl) => decl.type === 5 /* DeclarationType.Function */ && decl.isMethod)) {
                            symbol.setIsInstanceMember();
                        }
                    }
                    else {
                        symbol.setIsClassMember();
                    }
                    const declaration = {
                        type: 1 /* DeclarationType.Variable */,
                        node: target.memberName,
                        isConstant: (0, symbolNameUtils_1.isConstantName)(name.value),
                        inferredTypeSource: source,
                        isDefinedByMemberAccess: true,
                        uri: this._fileInfo.fileUri,
                        range: (0, positionUtils_1.convertTextRangeToRange)(target.memberName, this._fileInfo.lines),
                        moduleName: this._fileInfo.moduleName,
                        isInExceptSuite: this._isInExceptSuite,
                        docString: this._getVariableDocString(target),
                    };
                    symbol.addDeclaration(declaration);
                }
                break;
            }
            case 52 /* ParseNodeType.Tuple */: {
                target.expressions.forEach((expr) => {
                    this._addInferredTypeAssignmentForVariable(expr, source);
                });
                break;
            }
            case 54 /* ParseNodeType.TypeAnnotation */: {
                this._addInferredTypeAssignmentForVariable(target.valueExpression, source);
                break;
            }
            case 56 /* ParseNodeType.Unpack */: {
                this._addInferredTypeAssignmentForVariable(target.expression, source);
                break;
            }
            case 34 /* ParseNodeType.List */: {
                target.entries.forEach((entry) => {
                    this._addInferredTypeAssignmentForVariable(entry, source);
                });
                break;
            }
        }
    }
    _isInferenceAllowedInPyTyped(symbolName) {
        const exemptSymbols = ['__match_args__', '__slots__', '__all__'];
        return exemptSymbols.some((name) => name === symbolName);
    }
    _addTypeDeclarationForVariable(target, typeAnnotation) {
        var _a, _b, _c;
        let declarationHandled = false;
        switch (target.nodeType) {
            case 38 /* ParseNodeType.Name */: {
                const name = target;
                const symbolWithScope = this._currentScope.lookUpSymbolRecursive(name.value);
                if (symbolWithScope && symbolWithScope.symbol) {
                    const finalInfo = this._isAnnotationFinal(typeAnnotation);
                    let typeAnnotationNode = typeAnnotation;
                    if (finalInfo.isFinal) {
                        if (!finalInfo.finalTypeNode) {
                            typeAnnotationNode = undefined;
                        }
                    }
                    // Is this annotation indicating that the variable is a "ClassVar"?
                    const classVarInfo = this._isAnnotationClassVar(typeAnnotation);
                    if (classVarInfo.isClassVar) {
                        if (!classVarInfo.classVarTypeNode) {
                            typeAnnotationNode = undefined;
                        }
                    }
                    // PEP 591 indicates that a Final variable initialized within a class
                    // body should also be considered a ClassVar unless it's in a dataclass.
                    // We can't tell at this stage whether it's a dataclass, so we'll simply
                    // record whether it's a Final assigned in a class body.
                    let isFinalAssignedInClassBody = false;
                    if (finalInfo.isFinal) {
                        const containingClass = ParseTreeUtils.getEnclosingClassOrFunction(target);
                        if (containingClass && containingClass.nodeType === 10 /* ParseNodeType.Class */) {
                            // Make sure it's part of an assignment.
                            if (((_a = target.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 3 /* ParseNodeType.Assignment */ ||
                                ((_c = (_b = target.parent) === null || _b === void 0 ? void 0 : _b.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 3 /* ParseNodeType.Assignment */) {
                                isFinalAssignedInClassBody = true;
                            }
                        }
                    }
                    const declaration = {
                        type: 1 /* DeclarationType.Variable */,
                        node: target,
                        isConstant: (0, symbolNameUtils_1.isConstantName)(name.value),
                        isFinal: finalInfo.isFinal,
                        typeAliasName: target,
                        uri: this._fileInfo.fileUri,
                        typeAnnotationNode,
                        range: (0, positionUtils_1.convertTextRangeToRange)(name, this._fileInfo.lines),
                        moduleName: this._fileInfo.moduleName,
                        isInExceptSuite: this._isInExceptSuite,
                        docString: this._getVariableDocString(target),
                        isExplicitBinding: this._currentScope.getBindingType(name.value) !== undefined,
                    };
                    symbolWithScope.symbol.addDeclaration(declaration);
                    if (isFinalAssignedInClassBody) {
                        symbolWithScope.symbol.setIsFinalVarInClassBody();
                    }
                    if (classVarInfo.isClassVar) {
                        symbolWithScope.symbol.setIsClassVar();
                    }
                    else if (!isFinalAssignedInClassBody) {
                        symbolWithScope.symbol.setIsInstanceMember();
                    }
                    // Look for an 'InitVar' either by itself or wrapped in an 'Annotated'.
                    if (typeAnnotation.nodeType === 27 /* ParseNodeType.Index */) {
                        if (this._isDataclassesAnnotation(typeAnnotation.baseExpression, 'InitVar')) {
                            symbolWithScope.symbol.setIsInitVar();
                        }
                        else if (this._isTypingAnnotation(typeAnnotation.baseExpression, 'Annotated') &&
                            typeAnnotation.items.length > 0) {
                            const item0Expr = typeAnnotation.items[0].valueExpression;
                            if (item0Expr.nodeType === 27 /* ParseNodeType.Index */ &&
                                this._isDataclassesAnnotation(item0Expr.baseExpression, 'InitVar')) {
                                symbolWithScope.symbol.setIsInitVar();
                            }
                        }
                    }
                }
                declarationHandled = true;
                break;
            }
            case 35 /* ParseNodeType.MemberAccess */: {
                // We need to determine whether this expression is declaring a class or
                // instance variable. This is difficult because python doesn't provide
                // a keyword for accessing "this". Instead, it uses naming conventions
                // of "cls" and "self", but we don't want to rely on these naming
                // conventions here. Instead, we'll apply some heuristics to determine
                // whether the symbol on the LHS is a reference to the current class
                // or an instance of the current class.
                const memberAccessInfo = this._getMemberAccessInfo(target);
                if (memberAccessInfo) {
                    const name = target.memberName;
                    let symbol = memberAccessInfo.classScope.lookUpSymbol(name.value);
                    if (!symbol) {
                        symbol = memberAccessInfo.classScope.addSymbol(name.value, 1 /* SymbolFlags.InitiallyUnbound */);
                        const honorPrivateNaming = this._fileInfo.diagnosticRuleSet.reportPrivateUsage !== 'none';
                        if ((0, symbolNameUtils_1.isPrivateOrProtectedName)(name.value) && honorPrivateNaming) {
                            symbol.setIsPrivateMember();
                        }
                    }
                    if (memberAccessInfo.isInstanceMember) {
                        symbol.setIsInstanceMember();
                    }
                    else {
                        symbol.setIsClassMember();
                    }
                    const finalInfo = this._isAnnotationFinal(typeAnnotation);
                    const declaration = {
                        type: 1 /* DeclarationType.Variable */,
                        node: target.memberName,
                        isConstant: (0, symbolNameUtils_1.isConstantName)(name.value),
                        isDefinedByMemberAccess: true,
                        isFinal: finalInfo.isFinal,
                        uri: this._fileInfo.fileUri,
                        typeAnnotationNode: finalInfo.isFinal && !finalInfo.finalTypeNode ? undefined : typeAnnotation,
                        range: (0, positionUtils_1.convertTextRangeToRange)(target.memberName, this._fileInfo.lines),
                        moduleName: this._fileInfo.moduleName,
                        isInExceptSuite: this._isInExceptSuite,
                        docString: this._getVariableDocString(target),
                    };
                    symbol.addDeclaration(declaration);
                    declarationHandled = true;
                }
                break;
            }
        }
        if (!declarationHandled) {
            this._addDiagnostic(diagnosticRules_1.DiagnosticRule.reportInvalidTypeForm, localize_1.LocMessage.annotationNotSupported(), typeAnnotation);
        }
    }
    // Determines whether the expression refers to a type exported by the typing
    // or typing_extensions modules. We can directly evaluate the types at binding
    // time. We assume here that the code isn't making use of some custom type alias
    // to refer to the typing types.
    _isTypingAnnotation(typeAnnotation, name) {
        return this._isKnownAnnotation(typeAnnotation, name, this._typingImportAliases, this._typingSymbolAliases);
    }
    _isDataclassesAnnotation(typeAnnotation, name) {
        return this._isKnownAnnotation(typeAnnotation, name, this._dataclassesImportAliases, this._dataclassesSymbolAliases);
    }
    _isKnownAnnotation(typeAnnotation, name, importAliases, symbolAliases) {
        let annotationNode = typeAnnotation;
        // Is this a quoted annotation?
        if (annotationNode.nodeType === 48 /* ParseNodeType.StringList */ && annotationNode.typeAnnotation) {
            annotationNode = annotationNode.typeAnnotation;
        }
        if (annotationNode.nodeType === 38 /* ParseNodeType.Name */) {
            const alias = symbolAliases.get(annotationNode.value);
            if (alias === name) {
                return true;
            }
        }
        else if (annotationNode.nodeType === 35 /* ParseNodeType.MemberAccess */) {
            if (annotationNode.leftExpression.nodeType === 38 /* ParseNodeType.Name */ &&
                annotationNode.memberName.value === name) {
                const baseName = annotationNode.leftExpression.value;
                return importAliases.some((alias) => alias === baseName);
            }
        }
        return false;
    }
    _getVariableDocString(node) {
        const docNode = ParseTreeUtils.getVariableDocStringNode(node);
        if (!docNode) {
            return undefined;
        }
        // A docstring can consist of multiple joined strings in a single expression.
        const strings = docNode.strings;
        if (strings.length === 1) {
            // Common case.
            return strings[0].value;
        }
        return strings.map((s) => s.value).join('');
    }
    // Determines if the specified type annotation expression is a "Final".
    // It returns a value indicating whether the expression is a "Final"
    // expression and whether it's a "raw" Final with no type arguments.
    _isAnnotationFinal(typeAnnotation) {
        let isFinal = false;
        let finalTypeNode;
        if (typeAnnotation) {
            // Allow Final to be enclosed in ClassVar. Normally, Final implies
            // ClassVar, but this combination is required in the case of dataclasses.
            const classVarInfo = this._isAnnotationClassVar(typeAnnotation);
            if (classVarInfo === null || classVarInfo === void 0 ? void 0 : classVarInfo.classVarTypeNode) {
                typeAnnotation = classVarInfo.classVarTypeNode;
            }
            if (this._isTypingAnnotation(typeAnnotation, 'Final')) {
                isFinal = true;
            }
            else if (typeAnnotation.nodeType === 27 /* ParseNodeType.Index */ &&
                typeAnnotation.items.length > 0 &&
                this._isTypingAnnotation(typeAnnotation.baseExpression, 'Annotated')) {
                return this._isAnnotationFinal(typeAnnotation.items[0].valueExpression);
            }
            else if (typeAnnotation.nodeType === 27 /* ParseNodeType.Index */ && typeAnnotation.items.length === 1) {
                // Recursively call to see if the base expression is "Final".
                const finalInfo = this._isAnnotationFinal(typeAnnotation.baseExpression);
                if (finalInfo.isFinal &&
                    typeAnnotation.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
                    !typeAnnotation.items[0].name &&
                    !typeAnnotation.trailingComma) {
                    isFinal = true;
                    finalTypeNode = typeAnnotation.items[0].valueExpression;
                }
            }
        }
        return { isFinal, finalTypeNode };
    }
    // Determines if the specified type annotation expression is a "ClassVar".
    // It returns a value indicating whether the expression is a "ClassVar"
    // expression and whether it's a "raw" ClassVar with no type arguments.
    _isAnnotationClassVar(typeAnnotation) {
        let isClassVar = false;
        let classVarTypeNode;
        while (typeAnnotation) {
            // Is this a quoted annotation?
            if (typeAnnotation.nodeType === 48 /* ParseNodeType.StringList */ && typeAnnotation.typeAnnotation) {
                typeAnnotation = typeAnnotation.typeAnnotation;
            }
            if (typeAnnotation.nodeType === 27 /* ParseNodeType.Index */ &&
                typeAnnotation.items.length > 0 &&
                this._isTypingAnnotation(typeAnnotation.baseExpression, 'Annotated')) {
                typeAnnotation = typeAnnotation.items[0].valueExpression;
            }
            else if (this._isTypingAnnotation(typeAnnotation, 'ClassVar')) {
                isClassVar = true;
                break;
            }
            else if (typeAnnotation.nodeType === 27 /* ParseNodeType.Index */ && typeAnnotation.items.length === 1) {
                // Recursively call to see if the base expression is "ClassVar".
                const finalInfo = this._isAnnotationClassVar(typeAnnotation.baseExpression);
                if (finalInfo.isClassVar &&
                    typeAnnotation.items[0].argumentCategory === 0 /* ArgumentCategory.Simple */ &&
                    !typeAnnotation.items[0].name &&
                    !typeAnnotation.trailingComma) {
                    isClassVar = true;
                    classVarTypeNode = typeAnnotation.items[0].valueExpression;
                }
                break;
            }
            else {
                break;
            }
        }
        return { isClassVar, classVarTypeNode };
    }
    // Determines whether a member access expression is referring to a
    // member of a class (either a class or instance member). This will
    // typically take the form "self.x" or "cls.x".
    _getMemberAccessInfo(node) {
        // We handle only simple names on the left-hand side of the expression,
        // not calls, nested member accesses, index expressions, etc.
        if (node.leftExpression.nodeType !== 38 /* ParseNodeType.Name */) {
            return undefined;
        }
        const leftSymbolName = node.leftExpression.value;
        // Make sure the expression is within a function (i.e. a method) that's
        // within a class definition.
        const methodNode = ParseTreeUtils.getEnclosingFunction(node);
        if (!methodNode) {
            return undefined;
        }
        const classNode = ParseTreeUtils.getEnclosingClass(methodNode, /* stopAtFunction */ true);
        if (!classNode) {
            return undefined;
        }
        // Determine whether the left-hand side indicates a class or
        // instance member.
        let isInstanceMember = false;
        if (methodNode.parameters.length < 1 || !methodNode.parameters[0].name) {
            return undefined;
        }
        const className = classNode.name.value;
        const firstParamName = methodNode.parameters[0].name.value;
        if (leftSymbolName === className) {
            isInstanceMember = false;
        }
        else {
            if (leftSymbolName !== firstParamName) {
                return undefined;
            }
            // To determine whether the first parameter of the method
            // refers to the class or the instance, we need to apply
            // some heuristics.
            if (methodNode.name.value === '__new__') {
                // The __new__ method is special. It acts as a classmethod even
                // though it doesn't have a @classmethod decorator.
                isInstanceMember = false;
            }
            else {
                // Assume that it's an instance member unless we find
                // a decorator that tells us otherwise.
                isInstanceMember = true;
                for (const decorator of methodNode.decorators) {
                    if (decorator.expression.nodeType === 38 /* ParseNodeType.Name */) {
                        const decoratorName = decorator.expression.value;
                        if (decoratorName === 'staticmethod') {
                            // A static method doesn't have a "self" or "cls" parameter.
                            return undefined;
                        }
                        else if (decoratorName === 'classmethod') {
                            // A classmethod implies that the first parameter is "cls".
                            isInstanceMember = false;
                            break;
                        }
                    }
                }
            }
        }
        const classScope = AnalyzerNodeInfo.getScope(classNode);
        (0, debug_1.assert)(classScope !== undefined);
        return {
            classNode,
            methodNode,
            classScope,
            isInstanceMember,
        };
    }
    _addImplicitImportsToLoaderActions(importResult, loaderActions) {
        importResult.filteredImplicitImports.forEach((implicitImport) => {
            const existingLoaderAction = loaderActions.implicitImports
                ? loaderActions.implicitImports.get(implicitImport.name)
                : undefined;
            if (existingLoaderAction) {
                existingLoaderAction.uri = implicitImport.uri;
                existingLoaderAction.loadSymbolsFromPath = true;
            }
            else {
                if (!loaderActions.implicitImports) {
                    loaderActions.implicitImports = new Map();
                }
                loaderActions.implicitImports.set(implicitImport.name, {
                    uri: implicitImport.uri,
                    loadSymbolsFromPath: true,
                    implicitImports: new Map(),
                });
            }
        });
    }
    // Handles some special-case assignment statements that are found
    // within the typings.pyi file.
    _handleTypingStubAssignmentOrAnnotation(node) {
        if (!this._fileInfo.isTypingStubFile) {
            return false;
        }
        let annotationNode;
        if (node.nodeType === 54 /* ParseNodeType.TypeAnnotation */) {
            annotationNode = node;
        }
        else {
            if (node.leftExpression.nodeType !== 54 /* ParseNodeType.TypeAnnotation */) {
                return false;
            }
            annotationNode = node.leftExpression;
        }
        if (annotationNode.valueExpression.nodeType !== 38 /* ParseNodeType.Name */) {
            return false;
        }
        const assignedNameNode = annotationNode.valueExpression;
        const specialTypes = new Set([
            'Tuple',
            'Generic',
            'Protocol',
            'Callable',
            'Type',
            'ClassVar',
            'Final',
            'Literal',
            'TypedDict',
            'Union',
            'Optional',
            'Annotated',
            'TypeAlias',
            'Concatenate',
            'TypeGuard',
            'Unpack',
            'Self',
            'NoReturn',
            'Never',
            'LiteralString',
            'OrderedDict',
            'TypeIs',
        ]);
        const assignedName = assignedNameNode.value;
        if (!specialTypes.has(assignedName)) {
            return false;
        }
        const specialBuiltInClassDeclaration = {
            type: 7 /* DeclarationType.SpecialBuiltInClass */,
            node: annotationNode,
            uri: this._fileInfo.fileUri,
            range: (0, positionUtils_1.convertTextRangeToRange)(annotationNode, this._fileInfo.lines),
            moduleName: this._fileInfo.moduleName,
            isInExceptSuite: this._isInExceptSuite,
        };
        const symbol = this._bindNameToScope(this._currentScope, annotationNode.valueExpression);
        if (symbol) {
            symbol.addDeclaration(specialBuiltInClassDeclaration);
        }
        AnalyzerNodeInfo.setDeclaration(node, specialBuiltInClassDeclaration);
        return true;
    }
    _deferBinding(callback) {
        if (this._moduleSymbolOnly) {
            return;
        }
        this._deferredBindingTasks.push({
            scope: this._currentScope,
            codeFlowExpressions: this._currentScopeCodeFlowExpressions,
            callback,
        });
    }
    _bindDeferred() {
        while (this._deferredBindingTasks.length > 0) {
            const nextItem = this._deferredBindingTasks.shift();
            // Reset the state
            this._currentScope = nextItem.scope;
            this._currentScopeCodeFlowExpressions = nextItem.codeFlowExpressions;
            nextItem.callback();
        }
    }
    _bindYield(node) {
        const functionNode = ParseTreeUtils.getEnclosingFunction(node);
        if (!functionNode) {
            if (!ParseTreeUtils.getEnclosingLambda(node)) {
                this._addSyntaxError(localize_1.LocMessage.yieldOutsideFunction(), node);
            }
        }
        else if (functionNode.isAsync && node.nodeType === 61 /* ParseNodeType.YieldFrom */) {
            // PEP 525 indicates that 'yield from' is not allowed in an
            // async function.
            this._addSyntaxError(localize_1.LocMessage.yieldFromOutsideAsync(), node);
        }
        if (this._targetFunctionDeclaration) {
            if (!this._targetFunctionDeclaration.yieldStatements) {
                this._targetFunctionDeclaration.yieldStatements = [];
            }
            this._targetFunctionDeclaration.yieldStatements.push(node);
            this._targetFunctionDeclaration.isGenerator = true;
        }
        if (node.expression) {
            this.walk(node.expression);
        }
        AnalyzerNodeInfo.setFlowNode(node, this._currentFlowNode);
    }
    _getUniqueFlowNodeId() {
        this._codeFlowComplexity += flowNodeComplexityContribution;
        return (0, codeFlowTypes_1.getUniqueFlowNodeId)();
    }
    _addDiagnostic(rule, message, textRange) {
        const diagLevel = this._fileInfo.diagnosticRuleSet[rule];
        let diagnostic;
        switch (diagLevel) {
            case 'error':
            case 'warning':
            case 'information':
                diagnostic = this._fileInfo.diagnosticSink.addDiagnosticWithTextRange(diagLevel, message, textRange);
                break;
            case 'none':
                break;
            default:
                return (0, debug_1.assertNever)(diagLevel, `${diagLevel} is not expected`);
        }
        if (diagnostic) {
            diagnostic.setRule(rule);
        }
        return diagnostic;
    }
    _addSyntaxError(message, textRange) {
        return this._fileInfo.diagnosticSink.addDiagnosticWithTextRange('error', message, textRange);
    }
}
exports.Binder = Binder;
// Flow node that is used for unreachable code.
Binder._unreachableFlowNode = {
    flags: codeFlowTypes_1.FlowFlags.Unreachable,
    id: (0, codeFlowTypes_1.getUniqueFlowNodeId)(),
};
class YieldFinder extends parseTreeWalker_1.ParseTreeWalker {
    constructor() {
        super(...arguments);
        this._containsYield = false;
    }
    checkContainsYield(node) {
        this.walk(node);
        return this._containsYield;
    }
    visitYield(node) {
        this._containsYield = true;
        return false;
    }
    visitYieldFrom(node) {
        this._containsYield = true;
        return false;
    }
}
exports.YieldFinder = YieldFinder;
class ReturnFinder extends parseTreeWalker_1.ParseTreeWalker {
    constructor() {
        super(...arguments);
        this._containsReturn = false;
    }
    checkContainsReturn(node) {
        this.walk(node);
        return this._containsReturn;
    }
    visitReturn(node) {
        this._containsReturn = true;
        return false;
    }
}
exports.ReturnFinder = ReturnFinder;
// Creates dummy scopes for classes or functions within a parse tree.
// This is needed in cases where the parse tree has been determined
// to be unreachable. There are code paths where the type evaluator
// will still evaluate these types, and it depends on the presence
// of a scope.
class DummyScopeGenerator extends parseTreeWalker_1.ParseTreeWalker {
    constructor(currentScope) {
        super();
        this._currentScope = currentScope;
    }
    visitClass(node) {
        const newScope = this._createNewScope(3 /* ScopeType.Class */, () => {
            this.walk(node.suite);
        });
        if (!AnalyzerNodeInfo.getScope(node)) {
            AnalyzerNodeInfo.setScope(node, newScope);
        }
        return false;
    }
    visitFunction(node) {
        const newScope = this._createNewScope(2 /* ScopeType.Function */, () => {
            this.walk(node.suite);
        });
        if (!AnalyzerNodeInfo.getScope(node)) {
            AnalyzerNodeInfo.setScope(node, newScope);
        }
        return false;
    }
    _createNewScope(scopeType, callback) {
        const prevScope = this._currentScope;
        const newScope = new scope_1.Scope(scopeType, this._currentScope);
        this._currentScope = newScope;
        callback();
        this._currentScope = prevScope;
        return newScope;
    }
}
exports.DummyScopeGenerator = DummyScopeGenerator;
//# sourceMappingURL=binder.js.map