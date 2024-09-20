"use strict";
/*
 * parseTreeWalker.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Class that traverses a parse tree.
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
exports.ParseTreeWalker = exports.ParseTreeVisitor = exports.getChildNodes = void 0;
const debug = __importStar(require("../common/debug"));
// Get child nodes of the given node.
function getChildNodes(node) {
    var _a, _b;
    switch (node.nodeType) {
        case 0 /* ParseNodeType.Error */:
            return [node.child, ...((_a = node.decorators) !== null && _a !== void 0 ? _a : [])];
        case 1 /* ParseNodeType.Argument */:
            return [node.name, node.valueExpression];
        case 2 /* ParseNodeType.Assert */:
            return [node.testExpression, node.exceptionExpression];
        case 4 /* ParseNodeType.AssignmentExpression */:
            return [node.name, node.rightExpression];
        case 3 /* ParseNodeType.Assignment */:
            return [node.leftExpression, node.rightExpression, node.typeAnnotationComment];
        case 5 /* ParseNodeType.AugmentedAssignment */:
            return [node.leftExpression, node.rightExpression];
        case 6 /* ParseNodeType.Await */:
            return [node.expression];
        case 7 /* ParseNodeType.BinaryOperation */:
            return [node.leftExpression, node.rightExpression];
        case 8 /* ParseNodeType.Break */:
            return [];
        case 9 /* ParseNodeType.Call */:
            return [node.leftExpression, ...node.arguments];
        case 64 /* ParseNodeType.Case */:
            return [node.pattern, node.guardExpression, node.suite];
        case 10 /* ParseNodeType.Class */:
            return [...node.decorators, node.name, node.typeParameters, ...node.arguments, node.suite];
        case 11 /* ParseNodeType.Comprehension */:
            return [node.expression, ...node.forIfNodes];
        case 12 /* ParseNodeType.ComprehensionFor */:
            return [node.targetExpression, node.iterableExpression];
        case 13 /* ParseNodeType.ComprehensionIf */:
            return [node.testExpression];
        case 14 /* ParseNodeType.Constant */:
            return [];
        case 15 /* ParseNodeType.Continue */:
            return [];
        case 16 /* ParseNodeType.Decorator */:
            return [node.expression];
        case 17 /* ParseNodeType.Del */:
            return node.expressions;
        case 18 /* ParseNodeType.Dictionary */:
            return node.entries;
        case 19 /* ParseNodeType.DictionaryExpandEntry */:
            return [node.expandExpression];
        case 20 /* ParseNodeType.DictionaryKeyEntry */:
            return [node.keyExpression, node.valueExpression];
        case 21 /* ParseNodeType.Ellipsis */:
            return [];
        case 22 /* ParseNodeType.If */:
            return [node.testExpression, node.ifSuite, node.elseSuite];
        case 23 /* ParseNodeType.Import */:
            return node.list;
        case 24 /* ParseNodeType.ImportAs */:
            return [node.module, node.alias];
        case 25 /* ParseNodeType.ImportFrom */:
            return [node.module, ...node.imports];
        case 26 /* ParseNodeType.ImportFromAs */:
            return [node.name, node.alias];
        case 27 /* ParseNodeType.Index */:
            return [node.baseExpression, ...node.items];
        case 28 /* ParseNodeType.Except */:
            return [node.typeExpression, node.name, node.exceptSuite];
        case 29 /* ParseNodeType.For */:
            return [node.targetExpression, node.iterableExpression, node.forSuite, node.elseSuite];
        case 30 /* ParseNodeType.FormatString */:
            return [...node.fieldExpressions, ...((_b = node.formatExpressions) !== null && _b !== void 0 ? _b : [])];
        case 31 /* ParseNodeType.Function */:
            return [
                ...node.decorators,
                node.name,
                node.typeParameters,
                ...node.parameters,
                node.returnTypeAnnotation,
                node.functionAnnotationComment,
                node.suite,
            ];
        case 62 /* ParseNodeType.FunctionAnnotation */:
            return [...node.paramTypeAnnotations, node.returnTypeAnnotation];
        case 32 /* ParseNodeType.Global */:
            return node.nameList;
        case 33 /* ParseNodeType.Lambda */:
            return [...node.parameters, node.expression];
        case 34 /* ParseNodeType.List */:
            return node.entries;
        case 63 /* ParseNodeType.Match */:
            return [node.subjectExpression, ...node.cases];
        case 35 /* ParseNodeType.MemberAccess */:
            return [node.leftExpression, node.memberName];
        case 37 /* ParseNodeType.ModuleName */:
            return node.nameParts;
        case 36 /* ParseNodeType.Module */:
            return [...node.statements];
        case 38 /* ParseNodeType.Name */:
            return [];
        case 39 /* ParseNodeType.Nonlocal */:
            return node.nameList;
        case 40 /* ParseNodeType.Number */:
            return [];
        case 41 /* ParseNodeType.Parameter */:
            return [node.name, node.typeAnnotation, node.typeAnnotationComment, node.defaultValue];
        case 42 /* ParseNodeType.Pass */:
            return [];
        case 66 /* ParseNodeType.PatternAs */:
            return [...node.orPatterns, node.target];
        case 68 /* ParseNodeType.PatternClass */:
            return [node.className, ...node.arguments];
        case 74 /* ParseNodeType.PatternClassArgument */:
            return [node.name, node.pattern];
        case 69 /* ParseNodeType.PatternCapture */:
            return [node.target];
        case 67 /* ParseNodeType.PatternLiteral */:
            return [node.expression];
        case 72 /* ParseNodeType.PatternMappingExpandEntry */:
            return [node.target];
        case 71 /* ParseNodeType.PatternMappingKeyEntry */:
            return [node.keyPattern, node.valuePattern];
        case 70 /* ParseNodeType.PatternMapping */:
            return [...node.entries];
        case 65 /* ParseNodeType.PatternSequence */:
            return [...node.entries];
        case 73 /* ParseNodeType.PatternValue */:
            return [node.expression];
        case 43 /* ParseNodeType.Raise */:
            return [node.typeExpression, node.valueExpression, node.tracebackExpression];
        case 44 /* ParseNodeType.Return */:
            return [node.returnExpression];
        case 45 /* ParseNodeType.Set */:
            return node.entries;
        case 46 /* ParseNodeType.Slice */:
            return [node.startValue, node.endValue, node.stepValue];
        case 47 /* ParseNodeType.StatementList */:
            return node.statements;
        case 48 /* ParseNodeType.StringList */:
            return [node.typeAnnotation, ...node.strings];
        case 49 /* ParseNodeType.String */:
            return [];
        case 50 /* ParseNodeType.Suite */:
            return [...node.statements];
        case 51 /* ParseNodeType.Ternary */:
            return [node.ifExpression, node.testExpression, node.elseExpression];
        case 52 /* ParseNodeType.Tuple */:
            return node.expressions;
        case 53 /* ParseNodeType.Try */:
            return [node.trySuite, ...node.exceptClauses, node.elseSuite, node.finallySuite];
        case 77 /* ParseNodeType.TypeAlias */:
            return [node.name, node.typeParameters, node.expression];
        case 54 /* ParseNodeType.TypeAnnotation */:
            return [node.valueExpression, node.typeAnnotation];
        case 75 /* ParseNodeType.TypeParameter */:
            return [node.name, node.boundExpression, node.defaultExpression];
        case 76 /* ParseNodeType.TypeParameterList */:
            return [...node.parameters];
        case 55 /* ParseNodeType.UnaryOperation */:
            return [node.expression];
        case 56 /* ParseNodeType.Unpack */:
            return [node.expression];
        case 57 /* ParseNodeType.While */:
            return [node.testExpression, node.whileSuite, node.elseSuite];
        case 58 /* ParseNodeType.With */:
            return [...node.withItems, node.suite];
        case 59 /* ParseNodeType.WithItem */:
            return [node.expression, node.target];
        case 60 /* ParseNodeType.Yield */:
            return [node.expression];
        case 61 /* ParseNodeType.YieldFrom */:
            return [node.expression];
        default:
            debug.assertNever(node, `Unknown node type ${node}`);
    }
}
exports.getChildNodes = getChildNodes;
// To use this class, create a subclass and override the
// visitXXX methods that you want to handle.
class ParseTreeVisitor {
    constructor(_default) {
        this._default = _default;
        // empty
    }
    visit(node) {
        switch (node.nodeType) {
            case 0 /* ParseNodeType.Error */:
                return this.visitError(node);
            case 1 /* ParseNodeType.Argument */:
                return this.visitArgument(node);
            case 2 /* ParseNodeType.Assert */:
                return this.visitAssert(node);
            case 4 /* ParseNodeType.AssignmentExpression */:
                return this.visitAssignmentExpression(node);
            case 3 /* ParseNodeType.Assignment */:
                return this.visitAssignment(node);
            case 5 /* ParseNodeType.AugmentedAssignment */:
                return this.visitAugmentedAssignment(node);
            case 6 /* ParseNodeType.Await */:
                return this.visitAwait(node);
            case 7 /* ParseNodeType.BinaryOperation */:
                return this.visitBinaryOperation(node);
            case 8 /* ParseNodeType.Break */:
                return this.visitBreak(node);
            case 9 /* ParseNodeType.Call */:
                return this.visitCall(node);
            case 64 /* ParseNodeType.Case */:
                return this.visitCase(node);
            case 10 /* ParseNodeType.Class */:
                return this.visitClass(node);
            case 11 /* ParseNodeType.Comprehension */:
                return this.visitComprehension(node);
            case 12 /* ParseNodeType.ComprehensionFor */:
                return this.visitComprehensionFor(node);
            case 13 /* ParseNodeType.ComprehensionIf */:
                return this.visitComprehensionIf(node);
            case 14 /* ParseNodeType.Constant */:
                return this.visitConstant(node);
            case 15 /* ParseNodeType.Continue */:
                return this.visitContinue(node);
            case 16 /* ParseNodeType.Decorator */:
                return this.visitDecorator(node);
            case 17 /* ParseNodeType.Del */:
                return this.visitDel(node);
            case 18 /* ParseNodeType.Dictionary */:
                return this.visitDictionary(node);
            case 19 /* ParseNodeType.DictionaryExpandEntry */:
                return this.visitDictionaryExpandEntry(node);
            case 20 /* ParseNodeType.DictionaryKeyEntry */:
                return this.visitDictionaryKeyEntry(node);
            case 21 /* ParseNodeType.Ellipsis */:
                return this.visitEllipsis(node);
            case 22 /* ParseNodeType.If */:
                return this.visitIf(node);
            case 23 /* ParseNodeType.Import */:
                return this.visitImport(node);
            case 24 /* ParseNodeType.ImportAs */:
                return this.visitImportAs(node);
            case 25 /* ParseNodeType.ImportFrom */:
                return this.visitImportFrom(node);
            case 26 /* ParseNodeType.ImportFromAs */:
                return this.visitImportFromAs(node);
            case 27 /* ParseNodeType.Index */:
                return this.visitIndex(node);
            case 28 /* ParseNodeType.Except */:
                return this.visitExcept(node);
            case 29 /* ParseNodeType.For */:
                return this.visitFor(node);
            case 30 /* ParseNodeType.FormatString */:
                return this.visitFormatString(node);
            case 31 /* ParseNodeType.Function */:
                return this.visitFunction(node);
            case 62 /* ParseNodeType.FunctionAnnotation */:
                return this.visitFunctionAnnotation(node);
            case 32 /* ParseNodeType.Global */:
                return this.visitGlobal(node);
            case 33 /* ParseNodeType.Lambda */:
                return this.visitLambda(node);
            case 34 /* ParseNodeType.List */:
                return this.visitList(node);
            case 63 /* ParseNodeType.Match */:
                return this.visitMatch(node);
            case 35 /* ParseNodeType.MemberAccess */:
                return this.visitMemberAccess(node);
            case 37 /* ParseNodeType.ModuleName */:
                return this.visitModuleName(node);
            case 36 /* ParseNodeType.Module */:
                return this.visitModule(node);
            case 38 /* ParseNodeType.Name */:
                return this.visitName(node);
            case 39 /* ParseNodeType.Nonlocal */:
                return this.visitNonlocal(node);
            case 40 /* ParseNodeType.Number */:
                return this.visitNumber(node);
            case 41 /* ParseNodeType.Parameter */:
                return this.visitParameter(node);
            case 42 /* ParseNodeType.Pass */:
                return this.visitPass(node);
            case 66 /* ParseNodeType.PatternAs */:
                return this.visitPatternAs(node);
            case 68 /* ParseNodeType.PatternClass */:
                return this.visitPatternClass(node);
            case 74 /* ParseNodeType.PatternClassArgument */:
                return this.visitPatternClassArgument(node);
            case 69 /* ParseNodeType.PatternCapture */:
                return this.visitPatternCapture(node);
            case 67 /* ParseNodeType.PatternLiteral */:
                return this.visitPatternLiteral(node);
            case 72 /* ParseNodeType.PatternMappingExpandEntry */:
                return this.visitPatternMappingExpandEntry(node);
            case 71 /* ParseNodeType.PatternMappingKeyEntry */:
                return this.visitPatternMappingKeyEntry(node);
            case 70 /* ParseNodeType.PatternMapping */:
                return this.visitPatternMapping(node);
            case 65 /* ParseNodeType.PatternSequence */:
                return this.visitPatternSequence(node);
            case 73 /* ParseNodeType.PatternValue */:
                return this.visitPatternValue(node);
            case 43 /* ParseNodeType.Raise */:
                return this.visitRaise(node);
            case 44 /* ParseNodeType.Return */:
                return this.visitReturn(node);
            case 45 /* ParseNodeType.Set */:
                return this.visitSet(node);
            case 46 /* ParseNodeType.Slice */:
                return this.visitSlice(node);
            case 47 /* ParseNodeType.StatementList */:
                return this.visitStatementList(node);
            case 48 /* ParseNodeType.StringList */:
                return this.visitStringList(node);
            case 49 /* ParseNodeType.String */:
                return this.visitString(node);
            case 50 /* ParseNodeType.Suite */:
                return this.visitSuite(node);
            case 51 /* ParseNodeType.Ternary */:
                return this.visitTernary(node);
            case 52 /* ParseNodeType.Tuple */:
                return this.visitTuple(node);
            case 53 /* ParseNodeType.Try */:
                return this.visitTry(node);
            case 77 /* ParseNodeType.TypeAlias */:
                return this.visitTypeAlias(node);
            case 54 /* ParseNodeType.TypeAnnotation */:
                return this.visitTypeAnnotation(node);
            case 75 /* ParseNodeType.TypeParameter */:
                return this.visitTypeParameter(node);
            case 76 /* ParseNodeType.TypeParameterList */:
                return this.visitTypeParameterList(node);
            case 55 /* ParseNodeType.UnaryOperation */:
                return this.visitUnaryOperation(node);
            case 56 /* ParseNodeType.Unpack */:
                return this.visitUnpack(node);
            case 57 /* ParseNodeType.While */:
                return this.visitWhile(node);
            case 58 /* ParseNodeType.With */:
                return this.visitWith(node);
            case 59 /* ParseNodeType.WithItem */:
                return this.visitWithItem(node);
            case 60 /* ParseNodeType.Yield */:
                return this.visitYield(node);
            case 61 /* ParseNodeType.YieldFrom */:
                return this.visitYieldFrom(node);
            default:
                debug.assertNever(node, `Unknown node type ${node}`);
        }
    }
    // Override these methods as necessary.
    visitArgument(node) {
        return this._default;
    }
    visitAssert(node) {
        return this._default;
    }
    visitAssignment(node) {
        return this._default;
    }
    visitAssignmentExpression(node) {
        return this._default;
    }
    visitAugmentedAssignment(node) {
        return this._default;
    }
    visitAwait(node) {
        return this._default;
    }
    visitBinaryOperation(node) {
        return this._default;
    }
    visitBreak(node) {
        return this._default;
    }
    visitCall(node) {
        return this._default;
    }
    visitCase(node) {
        return this._default;
    }
    visitClass(node) {
        return this._default;
    }
    visitComprehension(node) {
        return this._default;
    }
    visitComprehensionFor(node) {
        return this._default;
    }
    visitComprehensionIf(node) {
        return this._default;
    }
    visitContinue(node) {
        return this._default;
    }
    visitConstant(node) {
        return this._default;
    }
    visitDecorator(node) {
        return this._default;
    }
    visitDel(node) {
        return this._default;
    }
    visitDictionary(node) {
        return this._default;
    }
    visitDictionaryKeyEntry(node) {
        return this._default;
    }
    visitDictionaryExpandEntry(node) {
        return this._default;
    }
    visitError(node) {
        return this._default;
    }
    visitEllipsis(node) {
        return this._default;
    }
    visitIf(node) {
        return this._default;
    }
    visitImport(node) {
        return this._default;
    }
    visitImportAs(node) {
        return this._default;
    }
    visitImportFrom(node) {
        return this._default;
    }
    visitImportFromAs(node) {
        return this._default;
    }
    visitIndex(node) {
        return this._default;
    }
    visitExcept(node) {
        return this._default;
    }
    visitFor(node) {
        return this._default;
    }
    visitFormatString(node) {
        return this._default;
    }
    visitFunction(node) {
        return this._default;
    }
    visitFunctionAnnotation(node) {
        return this._default;
    }
    visitGlobal(node) {
        return this._default;
    }
    visitLambda(node) {
        return this._default;
    }
    visitList(node) {
        return this._default;
    }
    visitMatch(node) {
        return this._default;
    }
    visitMemberAccess(node) {
        return this._default;
    }
    visitModule(node) {
        return this._default;
    }
    visitModuleName(node) {
        return this._default;
    }
    visitName(node) {
        return this._default;
    }
    visitNonlocal(node) {
        return this._default;
    }
    visitNumber(node) {
        return this._default;
    }
    visitParameter(node) {
        return this._default;
    }
    visitPass(node) {
        return this._default;
    }
    visitPatternCapture(node) {
        return this._default;
    }
    visitPatternClass(node) {
        return this._default;
    }
    visitPatternClassArgument(node) {
        return this._default;
    }
    visitPatternAs(node) {
        return this._default;
    }
    visitPatternLiteral(node) {
        return this._default;
    }
    visitPatternMappingExpandEntry(node) {
        return this._default;
    }
    visitPatternSequence(node) {
        return this._default;
    }
    visitPatternValue(node) {
        return this._default;
    }
    visitPatternMappingKeyEntry(node) {
        return this._default;
    }
    visitPatternMapping(node) {
        return this._default;
    }
    visitRaise(node) {
        return this._default;
    }
    visitReturn(node) {
        return this._default;
    }
    visitSet(node) {
        return this._default;
    }
    visitSlice(node) {
        return this._default;
    }
    visitStatementList(node) {
        return this._default;
    }
    visitString(node) {
        return this._default;
    }
    visitStringList(node) {
        return this._default;
    }
    visitSuite(node) {
        return this._default;
    }
    visitTernary(node) {
        return this._default;
    }
    visitTuple(node) {
        return this._default;
    }
    visitTry(node) {
        return this._default;
    }
    visitTypeAlias(node) {
        return this._default;
    }
    visitTypeAnnotation(node) {
        return this._default;
    }
    visitTypeParameter(node) {
        return this._default;
    }
    visitTypeParameterList(node) {
        return this._default;
    }
    visitUnaryOperation(node) {
        return this._default;
    }
    visitUnpack(node) {
        return this._default;
    }
    visitWhile(node) {
        return this._default;
    }
    visitWith(node) {
        return this._default;
    }
    visitWithItem(node) {
        return this._default;
    }
    visitYield(node) {
        return this._default;
    }
    visitYieldFrom(node) {
        return this._default;
    }
}
exports.ParseTreeVisitor = ParseTreeVisitor;
// To use this class, create a subclass and override the
// visitXXX methods that you want to handle.
class ParseTreeWalker extends ParseTreeVisitor {
    constructor() {
        super(/* default */ true);
    }
    walk(node) {
        const childrenToWalk = this.visitNode(node);
        if (childrenToWalk.length > 0) {
            this.walkMultiple(childrenToWalk);
        }
    }
    walkMultiple(nodes) {
        nodes.forEach((node) => {
            if (node) {
                this.walk(node);
            }
        });
    }
    // If this.visit(node) returns true, all child nodes for the node are returned.
    // If the method returns false, we assume that the handler has already handled the
    // child nodes, so an empty list is returned.
    visitNode(node) {
        return this.visit(node) ? getChildNodes(node) : [];
    }
}
exports.ParseTreeWalker = ParseTreeWalker;
//# sourceMappingURL=parseTreeWalker.js.map