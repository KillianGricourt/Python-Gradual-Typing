"use strict";
/*
 * parseNodes.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Definition of parse nodes that make up the Python abstract
 * syntax tree (AST).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringListNode = exports.FormatStringNode = exports.StringNode = exports.NumberNode = exports.EllipsisNode = exports.ConstantNode = exports.NameNode = exports.LambdaNode = exports.MemberAccessNode = exports.YieldFromNode = exports.YieldNode = exports.SliceNode = exports.IndexNode = exports.ComprehensionNode = exports.CallNode = exports.TupleNode = exports.UnpackNode = exports.TernaryNode = exports.AwaitNode = exports.AugmentedAssignmentNode = exports.FunctionAnnotationNode = exports.TypeAnnotationNode = exports.TypeAliasNode = exports.TypeParameterListNode = exports.TypeParameterNode = exports.TypeParameterCategory = exports.AssignmentNode = exports.AssignmentExpressionNode = exports.BinaryOperationNode = exports.UnaryOperationNode = exports.ErrorNode = exports.isExpressionNode = exports.StatementListNode = exports.DecoratorNode = exports.WithItemNode = exports.WithNode = exports.ClassNode = exports.ParameterNode = exports.FunctionNode = exports.ExceptNode = exports.TryNode = exports.ComprehensionIfNode = exports.ComprehensionForNode = exports.ForNode = exports.WhileNode = exports.IfNode = exports.SuiteNode = exports.ModuleNode = exports.extendRange = exports.getNextNodeId = void 0;
exports.PatternValueNode = exports.PatternMappingExpandEntryNode = exports.PatternMappingKeyEntryNode = exports.PatternMappingNode = exports.PatternCaptureNode = exports.PatternClassArgumentNode = exports.PatternClassNode = exports.PatternLiteralNode = exports.PatternAsNode = exports.PatternSequenceNode = exports.CaseNode = exports.MatchNode = exports.RaiseNode = exports.ReturnNode = exports.ContinueNode = exports.BreakNode = exports.AssertNode = exports.NonlocalNode = exports.GlobalNode = exports.ImportFromAsNode = exports.ImportFromNode = exports.ImportAsNode = exports.ModuleNameNode = exports.ImportNode = exports.PassNode = exports.DelNode = exports.ArgumentNode = exports.ListNode = exports.SetNode = exports.DictionaryExpandEntryNode = exports.DictionaryKeyEntryNode = exports.DictionaryNode = void 0;
const textRange_1 = require("../common/textRange");
let _nextNodeId = 1;
function getNextNodeId() {
    return _nextNodeId++;
}
exports.getNextNodeId = getNextNodeId;
function extendRange(node, newRange) {
    const extendedRange = textRange_1.TextRange.extend(node, newRange);
    // Temporarily allow writes to the range fields.
    const mutableNode = node;
    mutableNode.start = extendedRange.start;
    mutableNode.length = extendedRange.length;
}
exports.extendRange = extendRange;
var ModuleNode;
(function (ModuleNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 36 /* ParseNodeType.Module */,
            id: _nextNodeId++,
            statements: [],
        };
        return node;
    }
    ModuleNode.create = create;
})(ModuleNode || (exports.ModuleNode = ModuleNode = {}));
var SuiteNode;
(function (SuiteNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 50 /* ParseNodeType.Suite */,
            id: _nextNodeId++,
            statements: [],
        };
        return node;
    }
    SuiteNode.create = create;
})(SuiteNode || (exports.SuiteNode = SuiteNode = {}));
var IfNode;
(function (IfNode) {
    function create(ifOrElifToken, testExpression, ifSuite, elseSuite) {
        const node = {
            start: ifOrElifToken.start,
            length: ifOrElifToken.length,
            nodeType: 22 /* ParseNodeType.If */,
            id: _nextNodeId++,
            testExpression,
            ifSuite,
            elseSuite,
        };
        testExpression.parent = node;
        ifSuite.parent = node;
        extendRange(node, testExpression);
        extendRange(node, ifSuite);
        if (elseSuite) {
            extendRange(node, elseSuite);
            elseSuite.parent = node;
        }
        return node;
    }
    IfNode.create = create;
})(IfNode || (exports.IfNode = IfNode = {}));
var WhileNode;
(function (WhileNode) {
    function create(whileToken, testExpression, whileSuite) {
        const node = {
            start: whileToken.start,
            length: whileToken.length,
            nodeType: 57 /* ParseNodeType.While */,
            id: _nextNodeId++,
            testExpression,
            whileSuite,
        };
        testExpression.parent = node;
        whileSuite.parent = node;
        extendRange(node, whileSuite);
        return node;
    }
    WhileNode.create = create;
})(WhileNode || (exports.WhileNode = WhileNode = {}));
var ForNode;
(function (ForNode) {
    function create(forToken, targetExpression, iterableExpression, forSuite) {
        const node = {
            start: forToken.start,
            length: forToken.length,
            nodeType: 29 /* ParseNodeType.For */,
            id: _nextNodeId++,
            targetExpression,
            iterableExpression,
            forSuite,
        };
        targetExpression.parent = node;
        iterableExpression.parent = node;
        forSuite.parent = node;
        extendRange(node, forSuite);
        return node;
    }
    ForNode.create = create;
})(ForNode || (exports.ForNode = ForNode = {}));
var ComprehensionForNode;
(function (ComprehensionForNode) {
    function create(startToken, targetExpression, iterableExpression) {
        const node = {
            start: startToken.start,
            length: startToken.length,
            nodeType: 12 /* ParseNodeType.ComprehensionFor */,
            id: _nextNodeId++,
            targetExpression,
            iterableExpression,
        };
        targetExpression.parent = node;
        iterableExpression.parent = node;
        extendRange(node, targetExpression);
        extendRange(node, iterableExpression);
        return node;
    }
    ComprehensionForNode.create = create;
})(ComprehensionForNode || (exports.ComprehensionForNode = ComprehensionForNode = {}));
var ComprehensionIfNode;
(function (ComprehensionIfNode) {
    function create(ifToken, testExpression) {
        const node = {
            start: ifToken.start,
            length: ifToken.length,
            nodeType: 13 /* ParseNodeType.ComprehensionIf */,
            id: _nextNodeId++,
            testExpression,
        };
        testExpression.parent = node;
        extendRange(node, testExpression);
        return node;
    }
    ComprehensionIfNode.create = create;
})(ComprehensionIfNode || (exports.ComprehensionIfNode = ComprehensionIfNode = {}));
var TryNode;
(function (TryNode) {
    function create(tryToken, trySuite) {
        const node = {
            start: tryToken.start,
            length: tryToken.length,
            nodeType: 53 /* ParseNodeType.Try */,
            id: _nextNodeId++,
            trySuite,
            exceptClauses: [],
        };
        trySuite.parent = node;
        extendRange(node, trySuite);
        return node;
    }
    TryNode.create = create;
})(TryNode || (exports.TryNode = TryNode = {}));
var ExceptNode;
(function (ExceptNode) {
    function create(exceptToken, exceptSuite, isExceptGroup) {
        const node = {
            start: exceptToken.start,
            length: exceptToken.length,
            nodeType: 28 /* ParseNodeType.Except */,
            id: _nextNodeId++,
            exceptSuite,
            isExceptGroup,
        };
        exceptSuite.parent = node;
        extendRange(node, exceptSuite);
        return node;
    }
    ExceptNode.create = create;
})(ExceptNode || (exports.ExceptNode = ExceptNode = {}));
var FunctionNode;
(function (FunctionNode) {
    function create(defToken, name, suite, typeParameters) {
        const node = {
            start: defToken.start,
            length: defToken.length,
            nodeType: 31 /* ParseNodeType.Function */,
            id: _nextNodeId++,
            decorators: [],
            name,
            typeParameters,
            parameters: [],
            suite,
        };
        name.parent = node;
        suite.parent = node;
        if (typeParameters) {
            typeParameters.parent = node;
        }
        extendRange(node, suite);
        return node;
    }
    FunctionNode.create = create;
})(FunctionNode || (exports.FunctionNode = FunctionNode = {}));
var ParameterNode;
(function (ParameterNode) {
    function create(startToken, paramCategory) {
        const node = {
            start: startToken.start,
            length: startToken.length,
            nodeType: 41 /* ParseNodeType.Parameter */,
            id: _nextNodeId++,
            category: paramCategory,
        };
        return node;
    }
    ParameterNode.create = create;
})(ParameterNode || (exports.ParameterNode = ParameterNode = {}));
var ClassNode;
(function (ClassNode) {
    function create(classToken, name, suite, typeParameters) {
        const node = {
            start: classToken.start,
            length: classToken.length,
            nodeType: 10 /* ParseNodeType.Class */,
            id: _nextNodeId++,
            decorators: [],
            name,
            typeParameters,
            arguments: [],
            suite,
        };
        name.parent = node;
        suite.parent = node;
        if (typeParameters) {
            typeParameters.parent = node;
        }
        extendRange(node, suite);
        return node;
    }
    ClassNode.create = create;
    // This variant is used to create a dummy class
    // when the parser encounters decorators with no
    // function or class declaration.
    function createDummyForDecorators(decorators) {
        const node = {
            start: decorators[0].start,
            length: 0,
            nodeType: 10 /* ParseNodeType.Class */,
            id: _nextNodeId++,
            decorators,
            name: {
                start: decorators[0].start,
                length: 0,
                id: 0,
                nodeType: 38 /* ParseNodeType.Name */,
                token: {
                    type: 7 /* TokenType.Identifier */,
                    start: 0,
                    length: 0,
                    comments: [],
                    value: '',
                },
                value: '',
            },
            arguments: [],
            suite: {
                start: decorators[0].start,
                length: 0,
                id: 0,
                nodeType: 50 /* ParseNodeType.Suite */,
                statements: [],
            },
        };
        decorators.forEach((decorator) => {
            decorator.parent = node;
            extendRange(node, decorator);
        });
        node.name.parent = node;
        node.suite.parent = node;
        return node;
    }
    ClassNode.createDummyForDecorators = createDummyForDecorators;
})(ClassNode || (exports.ClassNode = ClassNode = {}));
var WithNode;
(function (WithNode) {
    function create(withToken, suite) {
        const node = {
            start: withToken.start,
            length: withToken.length,
            nodeType: 58 /* ParseNodeType.With */,
            id: _nextNodeId++,
            withItems: [],
            suite,
        };
        suite.parent = node;
        extendRange(node, suite);
        return node;
    }
    WithNode.create = create;
})(WithNode || (exports.WithNode = WithNode = {}));
var WithItemNode;
(function (WithItemNode) {
    function create(expression) {
        const node = {
            start: expression.start,
            length: expression.length,
            nodeType: 59 /* ParseNodeType.WithItem */,
            id: _nextNodeId++,
            expression,
        };
        expression.parent = node;
        return node;
    }
    WithItemNode.create = create;
})(WithItemNode || (exports.WithItemNode = WithItemNode = {}));
var DecoratorNode;
(function (DecoratorNode) {
    function create(atToken, expression) {
        const node = {
            start: atToken.start,
            length: atToken.length,
            nodeType: 16 /* ParseNodeType.Decorator */,
            id: _nextNodeId++,
            expression,
        };
        expression.parent = node;
        extendRange(node, expression);
        return node;
    }
    DecoratorNode.create = create;
})(DecoratorNode || (exports.DecoratorNode = DecoratorNode = {}));
var StatementListNode;
(function (StatementListNode) {
    function create(atToken) {
        const node = {
            start: atToken.start,
            length: atToken.length,
            nodeType: 47 /* ParseNodeType.StatementList */,
            id: _nextNodeId++,
            statements: [],
        };
        return node;
    }
    StatementListNode.create = create;
})(StatementListNode || (exports.StatementListNode = StatementListNode = {}));
function isExpressionNode(node) {
    switch (node.nodeType) {
        case 0 /* ParseNodeType.Error */:
        case 55 /* ParseNodeType.UnaryOperation */:
        case 7 /* ParseNodeType.BinaryOperation */:
        case 4 /* ParseNodeType.AssignmentExpression */:
        case 54 /* ParseNodeType.TypeAnnotation */:
        case 6 /* ParseNodeType.Await */:
        case 51 /* ParseNodeType.Ternary */:
        case 56 /* ParseNodeType.Unpack */:
        case 52 /* ParseNodeType.Tuple */:
        case 9 /* ParseNodeType.Call */:
        case 11 /* ParseNodeType.Comprehension */:
        case 27 /* ParseNodeType.Index */:
        case 46 /* ParseNodeType.Slice */:
        case 60 /* ParseNodeType.Yield */:
        case 61 /* ParseNodeType.YieldFrom */:
        case 35 /* ParseNodeType.MemberAccess */:
        case 33 /* ParseNodeType.Lambda */:
        case 38 /* ParseNodeType.Name */:
        case 14 /* ParseNodeType.Constant */:
        case 21 /* ParseNodeType.Ellipsis */:
        case 40 /* ParseNodeType.Number */:
        case 49 /* ParseNodeType.String */:
        case 30 /* ParseNodeType.FormatString */:
        case 48 /* ParseNodeType.StringList */:
        case 18 /* ParseNodeType.Dictionary */:
        case 34 /* ParseNodeType.List */:
        case 45 /* ParseNodeType.Set */:
            return true;
        default:
            return false;
    }
}
exports.isExpressionNode = isExpressionNode;
var ErrorNode;
(function (ErrorNode) {
    function create(initialRange, category, child, decorators) {
        const node = {
            start: initialRange.start,
            length: initialRange.length,
            nodeType: 0 /* ParseNodeType.Error */,
            id: _nextNodeId++,
            category,
            child,
            decorators,
        };
        if (child) {
            child.parent = node;
            extendRange(node, child);
        }
        if (decorators) {
            decorators.forEach((decorator) => {
                decorator.parent = node;
            });
            if (decorators.length > 0) {
                extendRange(node, decorators[0]);
            }
        }
        return node;
    }
    ErrorNode.create = create;
})(ErrorNode || (exports.ErrorNode = ErrorNode = {}));
var UnaryOperationNode;
(function (UnaryOperationNode) {
    function create(operatorToken, expression, operator) {
        var _a;
        const node = {
            start: operatorToken.start,
            length: operatorToken.length,
            nodeType: 55 /* ParseNodeType.UnaryOperation */,
            id: _nextNodeId++,
            operator,
            operatorToken,
            expression,
        };
        expression.parent = node;
        node.maxChildDepth = 1 + ((_a = expression.maxChildDepth) !== null && _a !== void 0 ? _a : 0);
        extendRange(node, expression);
        return node;
    }
    UnaryOperationNode.create = create;
})(UnaryOperationNode || (exports.UnaryOperationNode = UnaryOperationNode = {}));
var BinaryOperationNode;
(function (BinaryOperationNode) {
    function create(leftExpression, rightExpression, operatorToken, operator) {
        var _a, _b;
        const node = {
            start: leftExpression.start,
            length: leftExpression.length,
            nodeType: 7 /* ParseNodeType.BinaryOperation */,
            id: _nextNodeId++,
            leftExpression,
            operatorToken,
            operator,
            rightExpression,
        };
        leftExpression.parent = node;
        rightExpression.parent = node;
        node.maxChildDepth = 1 + Math.max((_a = leftExpression.maxChildDepth) !== null && _a !== void 0 ? _a : 0, (_b = rightExpression.maxChildDepth) !== null && _b !== void 0 ? _b : 0);
        extendRange(node, rightExpression);
        return node;
    }
    BinaryOperationNode.create = create;
})(BinaryOperationNode || (exports.BinaryOperationNode = BinaryOperationNode = {}));
var AssignmentExpressionNode;
(function (AssignmentExpressionNode) {
    function create(name, walrusToken, rightExpression) {
        const node = {
            start: name.start,
            length: name.length,
            nodeType: 4 /* ParseNodeType.AssignmentExpression */,
            id: _nextNodeId++,
            name,
            walrusToken,
            rightExpression,
            isParenthesized: false,
        };
        name.parent = node;
        rightExpression.parent = node;
        extendRange(node, rightExpression);
        return node;
    }
    AssignmentExpressionNode.create = create;
})(AssignmentExpressionNode || (exports.AssignmentExpressionNode = AssignmentExpressionNode = {}));
var AssignmentNode;
(function (AssignmentNode) {
    function create(leftExpression, rightExpression) {
        const node = {
            start: leftExpression.start,
            length: leftExpression.length,
            nodeType: 3 /* ParseNodeType.Assignment */,
            id: _nextNodeId++,
            leftExpression,
            rightExpression,
        };
        leftExpression.parent = node;
        rightExpression.parent = node;
        extendRange(node, rightExpression);
        return node;
    }
    AssignmentNode.create = create;
})(AssignmentNode || (exports.AssignmentNode = AssignmentNode = {}));
var TypeParameterCategory;
(function (TypeParameterCategory) {
    TypeParameterCategory[TypeParameterCategory["TypeVar"] = 0] = "TypeVar";
    TypeParameterCategory[TypeParameterCategory["TypeVarTuple"] = 1] = "TypeVarTuple";
    TypeParameterCategory[TypeParameterCategory["ParamSpec"] = 2] = "ParamSpec";
})(TypeParameterCategory || (exports.TypeParameterCategory = TypeParameterCategory = {}));
var TypeParameterNode;
(function (TypeParameterNode) {
    function create(name, typeParamCategory, boundExpression, defaultExpression) {
        const node = {
            start: name.start,
            length: name.length,
            nodeType: 75 /* ParseNodeType.TypeParameter */,
            id: _nextNodeId++,
            name,
            typeParamCategory,
            boundExpression,
            defaultExpression,
        };
        name.parent = node;
        if (boundExpression) {
            boundExpression.parent = node;
            extendRange(node, boundExpression);
        }
        if (defaultExpression) {
            defaultExpression.parent = node;
            extendRange(node, defaultExpression);
        }
        return node;
    }
    TypeParameterNode.create = create;
})(TypeParameterNode || (exports.TypeParameterNode = TypeParameterNode = {}));
var TypeParameterListNode;
(function (TypeParameterListNode) {
    function create(startToken, endToken, parameters) {
        const node = {
            start: startToken.start,
            length: startToken.length,
            nodeType: 76 /* ParseNodeType.TypeParameterList */,
            id: _nextNodeId++,
            parameters,
        };
        extendRange(node, endToken);
        parameters.forEach((param) => {
            extendRange(node, param);
            param.parent = node;
        });
        return node;
    }
    TypeParameterListNode.create = create;
})(TypeParameterListNode || (exports.TypeParameterListNode = TypeParameterListNode = {}));
var TypeAliasNode;
(function (TypeAliasNode) {
    function create(typeToken, name, expression, typeParameters) {
        const node = {
            start: typeToken.start,
            length: typeToken.length,
            nodeType: 77 /* ParseNodeType.TypeAlias */,
            id: _nextNodeId++,
            name,
            typeParameters,
            expression,
        };
        name.parent = node;
        expression.parent = node;
        if (typeParameters) {
            typeParameters.parent = node;
        }
        extendRange(node, expression);
        return node;
    }
    TypeAliasNode.create = create;
})(TypeAliasNode || (exports.TypeAliasNode = TypeAliasNode = {}));
var TypeAnnotationNode;
(function (TypeAnnotationNode) {
    function create(valueExpression, typeAnnotation) {
        const node = {
            start: valueExpression.start,
            length: valueExpression.length,
            nodeType: 54 /* ParseNodeType.TypeAnnotation */,
            id: _nextNodeId++,
            valueExpression,
            typeAnnotation,
        };
        valueExpression.parent = node;
        typeAnnotation.parent = node;
        extendRange(node, typeAnnotation);
        return node;
    }
    TypeAnnotationNode.create = create;
})(TypeAnnotationNode || (exports.TypeAnnotationNode = TypeAnnotationNode = {}));
var FunctionAnnotationNode;
(function (FunctionAnnotationNode) {
    function create(openParenToken, isParamListEllipsis, paramTypeAnnotations, returnTypeAnnotation) {
        const node = {
            start: openParenToken.start,
            length: openParenToken.length,
            nodeType: 62 /* ParseNodeType.FunctionAnnotation */,
            id: _nextNodeId++,
            isParamListEllipsis,
            paramTypeAnnotations,
            returnTypeAnnotation,
        };
        paramTypeAnnotations.forEach((p) => {
            p.parent = node;
        });
        returnTypeAnnotation.parent = node;
        extendRange(node, returnTypeAnnotation);
        return node;
    }
    FunctionAnnotationNode.create = create;
})(FunctionAnnotationNode || (exports.FunctionAnnotationNode = FunctionAnnotationNode = {}));
var AugmentedAssignmentNode;
(function (AugmentedAssignmentNode) {
    function create(leftExpression, rightExpression, operator, destExpression) {
        const node = {
            start: leftExpression.start,
            length: leftExpression.length,
            nodeType: 5 /* ParseNodeType.AugmentedAssignment */,
            id: _nextNodeId++,
            leftExpression,
            operator,
            rightExpression,
            destExpression,
        };
        leftExpression.parent = node;
        rightExpression.parent = node;
        destExpression.parent = node;
        extendRange(node, rightExpression);
        return node;
    }
    AugmentedAssignmentNode.create = create;
})(AugmentedAssignmentNode || (exports.AugmentedAssignmentNode = AugmentedAssignmentNode = {}));
var AwaitNode;
(function (AwaitNode) {
    function create(awaitToken, expression) {
        const node = {
            start: awaitToken.start,
            length: awaitToken.length,
            nodeType: 6 /* ParseNodeType.Await */,
            id: _nextNodeId++,
            expression,
        };
        expression.parent = node;
        extendRange(node, expression);
        return node;
    }
    AwaitNode.create = create;
})(AwaitNode || (exports.AwaitNode = AwaitNode = {}));
var TernaryNode;
(function (TernaryNode) {
    function create(ifExpression, testExpression, elseExpression) {
        const node = {
            start: ifExpression.start,
            length: ifExpression.length,
            nodeType: 51 /* ParseNodeType.Ternary */,
            id: _nextNodeId++,
            ifExpression,
            testExpression,
            elseExpression,
        };
        ifExpression.parent = node;
        testExpression.parent = node;
        elseExpression.parent = node;
        extendRange(node, elseExpression);
        return node;
    }
    TernaryNode.create = create;
})(TernaryNode || (exports.TernaryNode = TernaryNode = {}));
var UnpackNode;
(function (UnpackNode) {
    function create(starToken, expression) {
        const node = {
            starToken,
            start: starToken.start,
            length: starToken.length,
            nodeType: 56 /* ParseNodeType.Unpack */,
            id: _nextNodeId++,
            expression,
        };
        expression.parent = node;
        extendRange(node, expression);
        return node;
    }
    UnpackNode.create = create;
})(UnpackNode || (exports.UnpackNode = UnpackNode = {}));
var TupleNode;
(function (TupleNode) {
    function create(range, enclosedInParens) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 52 /* ParseNodeType.Tuple */,
            id: _nextNodeId++,
            expressions: [],
            enclosedInParens,
        };
        return node;
    }
    TupleNode.create = create;
})(TupleNode || (exports.TupleNode = TupleNode = {}));
var CallNode;
(function (CallNode) {
    function create(leftExpression, argList, trailingComma) {
        var _a;
        const node = {
            start: leftExpression.start,
            length: leftExpression.length,
            nodeType: 9 /* ParseNodeType.Call */,
            id: _nextNodeId++,
            leftExpression,
            arguments: argList,
            trailingComma,
        };
        leftExpression.parent = node;
        node.maxChildDepth = 1 + ((_a = leftExpression.maxChildDepth) !== null && _a !== void 0 ? _a : 0);
        if (argList.length > 0) {
            argList.forEach((arg) => {
                arg.parent = node;
            });
            extendRange(node, argList[argList.length - 1]);
        }
        return node;
    }
    CallNode.create = create;
})(CallNode || (exports.CallNode = CallNode = {}));
var ComprehensionNode;
(function (ComprehensionNode) {
    function create(expression, isGenerator) {
        const node = {
            start: expression.start,
            length: expression.length,
            nodeType: 11 /* ParseNodeType.Comprehension */,
            id: _nextNodeId++,
            expression,
            forIfNodes: [],
            isGenerator,
        };
        expression.parent = node;
        return node;
    }
    ComprehensionNode.create = create;
})(ComprehensionNode || (exports.ComprehensionNode = ComprehensionNode = {}));
var IndexNode;
(function (IndexNode) {
    function create(baseExpression, items, trailingComma, closeBracketToken) {
        var _a;
        const node = {
            start: baseExpression.start,
            length: baseExpression.length,
            nodeType: 27 /* ParseNodeType.Index */,
            id: _nextNodeId++,
            baseExpression,
            items,
            trailingComma,
        };
        baseExpression.parent = node;
        items.forEach((item) => {
            item.parent = node;
        });
        extendRange(node, closeBracketToken);
        node.maxChildDepth = 1 + ((_a = baseExpression.maxChildDepth) !== null && _a !== void 0 ? _a : 0);
        return node;
    }
    IndexNode.create = create;
})(IndexNode || (exports.IndexNode = IndexNode = {}));
var SliceNode;
(function (SliceNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 46 /* ParseNodeType.Slice */,
            id: _nextNodeId++,
        };
        return node;
    }
    SliceNode.create = create;
})(SliceNode || (exports.SliceNode = SliceNode = {}));
var YieldNode;
(function (YieldNode) {
    function create(yieldToken, expression) {
        const node = {
            start: yieldToken.start,
            length: yieldToken.length,
            nodeType: 60 /* ParseNodeType.Yield */,
            id: _nextNodeId++,
            expression,
        };
        if (expression) {
            expression.parent = node;
            extendRange(node, expression);
        }
        return node;
    }
    YieldNode.create = create;
})(YieldNode || (exports.YieldNode = YieldNode = {}));
var YieldFromNode;
(function (YieldFromNode) {
    function create(yieldToken, expression) {
        const node = {
            start: yieldToken.start,
            length: yieldToken.length,
            nodeType: 61 /* ParseNodeType.YieldFrom */,
            id: _nextNodeId++,
            expression,
        };
        expression.parent = node;
        extendRange(node, expression);
        return node;
    }
    YieldFromNode.create = create;
})(YieldFromNode || (exports.YieldFromNode = YieldFromNode = {}));
var MemberAccessNode;
(function (MemberAccessNode) {
    function create(leftExpression, memberName) {
        var _a;
        const node = {
            start: leftExpression.start,
            length: leftExpression.length,
            nodeType: 35 /* ParseNodeType.MemberAccess */,
            id: _nextNodeId++,
            leftExpression,
            memberName,
        };
        leftExpression.parent = node;
        memberName.parent = node;
        extendRange(node, memberName);
        node.maxChildDepth = 1 + ((_a = leftExpression.maxChildDepth) !== null && _a !== void 0 ? _a : 0);
        return node;
    }
    MemberAccessNode.create = create;
})(MemberAccessNode || (exports.MemberAccessNode = MemberAccessNode = {}));
var LambdaNode;
(function (LambdaNode) {
    function create(lambdaToken, expression) {
        const node = {
            start: lambdaToken.start,
            length: lambdaToken.length,
            nodeType: 33 /* ParseNodeType.Lambda */,
            id: _nextNodeId++,
            parameters: [],
            expression,
        };
        expression.parent = node;
        extendRange(node, expression);
        return node;
    }
    LambdaNode.create = create;
})(LambdaNode || (exports.LambdaNode = LambdaNode = {}));
var NameNode;
(function (NameNode) {
    function create(nameToken) {
        const node = {
            start: nameToken.start,
            length: nameToken.length,
            nodeType: 38 /* ParseNodeType.Name */,
            id: _nextNodeId++,
            token: nameToken,
            value: nameToken.value,
        };
        return node;
    }
    NameNode.create = create;
})(NameNode || (exports.NameNode = NameNode = {}));
var ConstantNode;
(function (ConstantNode) {
    function create(token) {
        const node = {
            start: token.start,
            length: token.length,
            nodeType: 14 /* ParseNodeType.Constant */,
            id: _nextNodeId++,
            constType: token.keywordType,
        };
        return node;
    }
    ConstantNode.create = create;
})(ConstantNode || (exports.ConstantNode = ConstantNode = {}));
var EllipsisNode;
(function (EllipsisNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 21 /* ParseNodeType.Ellipsis */,
            id: _nextNodeId++,
        };
        return node;
    }
    EllipsisNode.create = create;
})(EllipsisNode || (exports.EllipsisNode = EllipsisNode = {}));
var NumberNode;
(function (NumberNode) {
    function create(token) {
        const node = {
            start: token.start,
            length: token.length,
            nodeType: 40 /* ParseNodeType.Number */,
            id: _nextNodeId++,
            value: token.value,
            isInteger: token.isInteger,
            isImaginary: token.isImaginary,
        };
        return node;
    }
    NumberNode.create = create;
})(NumberNode || (exports.NumberNode = NumberNode = {}));
var StringNode;
(function (StringNode) {
    function create(token, unescapedValue) {
        const node = {
            start: token.start,
            length: token.length,
            nodeType: 49 /* ParseNodeType.String */,
            id: _nextNodeId++,
            token,
            value: unescapedValue,
        };
        return node;
    }
    StringNode.create = create;
})(StringNode || (exports.StringNode = StringNode = {}));
var FormatStringNode;
(function (FormatStringNode) {
    function create(startToken, endToken, middleTokens, fieldExpressions, formatExpressions) {
        const node = {
            start: startToken.start,
            length: startToken.length,
            nodeType: 30 /* ParseNodeType.FormatString */,
            id: _nextNodeId++,
            token: startToken,
            middleTokens,
            fieldExpressions,
            formatExpressions,
            value: '',
        };
        fieldExpressions.forEach((expr) => {
            expr.parent = node;
            extendRange(node, expr);
        });
        if (formatExpressions) {
            formatExpressions.forEach((expr) => {
                expr.parent = node;
                extendRange(node, expr);
            });
        }
        if (endToken) {
            extendRange(node, endToken);
        }
        return node;
    }
    FormatStringNode.create = create;
})(FormatStringNode || (exports.FormatStringNode = FormatStringNode = {}));
var StringListNode;
(function (StringListNode) {
    function create(strings) {
        const node = {
            start: strings[0].start,
            length: strings[0].length,
            nodeType: 48 /* ParseNodeType.StringList */,
            id: _nextNodeId++,
            strings,
        };
        if (strings.length > 0) {
            strings.forEach((str) => {
                str.parent = node;
            });
            extendRange(node, strings[strings.length - 1]);
        }
        return node;
    }
    StringListNode.create = create;
})(StringListNode || (exports.StringListNode = StringListNode = {}));
var DictionaryNode;
(function (DictionaryNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 18 /* ParseNodeType.Dictionary */,
            id: _nextNodeId++,
            entries: [],
        };
        return node;
    }
    DictionaryNode.create = create;
})(DictionaryNode || (exports.DictionaryNode = DictionaryNode = {}));
var DictionaryKeyEntryNode;
(function (DictionaryKeyEntryNode) {
    function create(keyExpression, valueExpression) {
        const node = {
            start: keyExpression.start,
            length: keyExpression.length,
            nodeType: 20 /* ParseNodeType.DictionaryKeyEntry */,
            id: _nextNodeId++,
            keyExpression,
            valueExpression,
        };
        keyExpression.parent = node;
        valueExpression.parent = node;
        extendRange(node, valueExpression);
        return node;
    }
    DictionaryKeyEntryNode.create = create;
})(DictionaryKeyEntryNode || (exports.DictionaryKeyEntryNode = DictionaryKeyEntryNode = {}));
var DictionaryExpandEntryNode;
(function (DictionaryExpandEntryNode) {
    function create(expandExpression) {
        const node = {
            start: expandExpression.start,
            length: expandExpression.length,
            nodeType: 19 /* ParseNodeType.DictionaryExpandEntry */,
            id: _nextNodeId++,
            expandExpression,
        };
        expandExpression.parent = node;
        return node;
    }
    DictionaryExpandEntryNode.create = create;
})(DictionaryExpandEntryNode || (exports.DictionaryExpandEntryNode = DictionaryExpandEntryNode = {}));
var SetNode;
(function (SetNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 45 /* ParseNodeType.Set */,
            id: _nextNodeId++,
            entries: [],
        };
        return node;
    }
    SetNode.create = create;
})(SetNode || (exports.SetNode = SetNode = {}));
var ListNode;
(function (ListNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 34 /* ParseNodeType.List */,
            id: _nextNodeId++,
            entries: [],
        };
        return node;
    }
    ListNode.create = create;
})(ListNode || (exports.ListNode = ListNode = {}));
var ArgumentNode;
(function (ArgumentNode) {
    function create(startToken, valueExpression, argCategory) {
        const node = {
            start: startToken ? startToken.start : valueExpression.start,
            length: startToken ? startToken.length : valueExpression.length,
            nodeType: 1 /* ParseNodeType.Argument */,
            id: _nextNodeId++,
            valueExpression,
            argumentCategory: argCategory,
        };
        valueExpression.parent = node;
        extendRange(node, valueExpression);
        return node;
    }
    ArgumentNode.create = create;
})(ArgumentNode || (exports.ArgumentNode = ArgumentNode = {}));
var DelNode;
(function (DelNode) {
    function create(delToken) {
        const node = {
            start: delToken.start,
            length: delToken.length,
            nodeType: 17 /* ParseNodeType.Del */,
            id: _nextNodeId++,
            expressions: [],
        };
        return node;
    }
    DelNode.create = create;
})(DelNode || (exports.DelNode = DelNode = {}));
var PassNode;
(function (PassNode) {
    function create(passToken) {
        const node = {
            start: passToken.start,
            length: passToken.length,
            nodeType: 42 /* ParseNodeType.Pass */,
            id: _nextNodeId++,
        };
        return node;
    }
    PassNode.create = create;
})(PassNode || (exports.PassNode = PassNode = {}));
var ImportNode;
(function (ImportNode) {
    function create(passToken) {
        const node = {
            start: passToken.start,
            length: passToken.length,
            nodeType: 23 /* ParseNodeType.Import */,
            id: _nextNodeId++,
            list: [],
        };
        return node;
    }
    ImportNode.create = create;
})(ImportNode || (exports.ImportNode = ImportNode = {}));
var ModuleNameNode;
(function (ModuleNameNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 37 /* ParseNodeType.ModuleName */,
            id: _nextNodeId++,
            leadingDots: 0,
            nameParts: [],
        };
        return node;
    }
    ModuleNameNode.create = create;
})(ModuleNameNode || (exports.ModuleNameNode = ModuleNameNode = {}));
var ImportAsNode;
(function (ImportAsNode) {
    function create(module) {
        const node = {
            start: module.start,
            length: module.length,
            nodeType: 24 /* ParseNodeType.ImportAs */,
            id: _nextNodeId++,
            module,
        };
        module.parent = node;
        return node;
    }
    ImportAsNode.create = create;
})(ImportAsNode || (exports.ImportAsNode = ImportAsNode = {}));
var ImportFromNode;
(function (ImportFromNode) {
    function create(fromToken, module) {
        const node = {
            start: fromToken.start,
            length: fromToken.length,
            nodeType: 25 /* ParseNodeType.ImportFrom */,
            id: _nextNodeId++,
            module,
            imports: [],
            isWildcardImport: false,
            usesParens: false,
        };
        module.parent = node;
        extendRange(node, module);
        return node;
    }
    ImportFromNode.create = create;
})(ImportFromNode || (exports.ImportFromNode = ImportFromNode = {}));
var ImportFromAsNode;
(function (ImportFromAsNode) {
    function create(name) {
        const node = {
            start: name.start,
            length: name.length,
            nodeType: 26 /* ParseNodeType.ImportFromAs */,
            id: _nextNodeId++,
            name,
        };
        name.parent = node;
        return node;
    }
    ImportFromAsNode.create = create;
})(ImportFromAsNode || (exports.ImportFromAsNode = ImportFromAsNode = {}));
var GlobalNode;
(function (GlobalNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 32 /* ParseNodeType.Global */,
            id: _nextNodeId++,
            nameList: [],
        };
        return node;
    }
    GlobalNode.create = create;
})(GlobalNode || (exports.GlobalNode = GlobalNode = {}));
var NonlocalNode;
(function (NonlocalNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 39 /* ParseNodeType.Nonlocal */,
            id: _nextNodeId++,
            nameList: [],
        };
        return node;
    }
    NonlocalNode.create = create;
})(NonlocalNode || (exports.NonlocalNode = NonlocalNode = {}));
var AssertNode;
(function (AssertNode) {
    function create(assertToken, testExpression) {
        const node = {
            start: assertToken.start,
            length: assertToken.length,
            nodeType: 2 /* ParseNodeType.Assert */,
            id: _nextNodeId++,
            testExpression,
        };
        testExpression.parent = node;
        extendRange(node, testExpression);
        return node;
    }
    AssertNode.create = create;
})(AssertNode || (exports.AssertNode = AssertNode = {}));
var BreakNode;
(function (BreakNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 8 /* ParseNodeType.Break */,
            id: _nextNodeId++,
        };
        return node;
    }
    BreakNode.create = create;
})(BreakNode || (exports.BreakNode = BreakNode = {}));
var ContinueNode;
(function (ContinueNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 15 /* ParseNodeType.Continue */,
            id: _nextNodeId++,
        };
        return node;
    }
    ContinueNode.create = create;
})(ContinueNode || (exports.ContinueNode = ContinueNode = {}));
var ReturnNode;
(function (ReturnNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 44 /* ParseNodeType.Return */,
            id: _nextNodeId++,
        };
        return node;
    }
    ReturnNode.create = create;
})(ReturnNode || (exports.ReturnNode = ReturnNode = {}));
var RaiseNode;
(function (RaiseNode) {
    function create(range) {
        const node = {
            start: range.start,
            length: range.length,
            nodeType: 43 /* ParseNodeType.Raise */,
            id: _nextNodeId++,
        };
        return node;
    }
    RaiseNode.create = create;
})(RaiseNode || (exports.RaiseNode = RaiseNode = {}));
var MatchNode;
(function (MatchNode) {
    function create(matchToken, subjectExpression) {
        const node = {
            start: matchToken.start,
            length: matchToken.length,
            nodeType: 63 /* ParseNodeType.Match */,
            id: _nextNodeId++,
            subjectExpression,
            cases: [],
        };
        subjectExpression.parent = node;
        extendRange(node, subjectExpression);
        return node;
    }
    MatchNode.create = create;
})(MatchNode || (exports.MatchNode = MatchNode = {}));
var CaseNode;
(function (CaseNode) {
    function create(caseToken, pattern, isIrrefutable, guardExpression, suite) {
        const node = {
            start: caseToken.start,
            length: caseToken.length,
            nodeType: 64 /* ParseNodeType.Case */,
            id: _nextNodeId++,
            pattern,
            isIrrefutable,
            guardExpression,
            suite,
        };
        extendRange(node, suite);
        pattern.parent = node;
        suite.parent = node;
        if (guardExpression) {
            guardExpression.parent = node;
        }
        return node;
    }
    CaseNode.create = create;
})(CaseNode || (exports.CaseNode = CaseNode = {}));
var PatternSequenceNode;
(function (PatternSequenceNode) {
    function create(firstToken, entries) {
        const starEntryIndex = entries.findIndex((entry) => entry.orPatterns.length === 1 &&
            entry.orPatterns[0].nodeType === 69 /* ParseNodeType.PatternCapture */ &&
            entry.orPatterns[0].isStar);
        const node = {
            start: firstToken.start,
            length: firstToken.length,
            nodeType: 65 /* ParseNodeType.PatternSequence */,
            id: _nextNodeId++,
            entries,
            starEntryIndex: starEntryIndex >= 0 ? starEntryIndex : undefined,
        };
        if (entries.length > 0) {
            extendRange(node, entries[entries.length - 1]);
        }
        entries.forEach((entry) => {
            entry.parent = node;
        });
        return node;
    }
    PatternSequenceNode.create = create;
})(PatternSequenceNode || (exports.PatternSequenceNode = PatternSequenceNode = {}));
var PatternAsNode;
(function (PatternAsNode) {
    function create(orPatterns, target) {
        const node = {
            start: orPatterns[0].start,
            length: orPatterns[0].length,
            nodeType: 66 /* ParseNodeType.PatternAs */,
            id: _nextNodeId++,
            orPatterns,
            target,
        };
        if (orPatterns.length > 1) {
            extendRange(node, orPatterns[orPatterns.length - 1]);
        }
        orPatterns.forEach((pattern) => {
            pattern.parent = node;
        });
        if (target) {
            extendRange(node, target);
            target.parent = node;
        }
        return node;
    }
    PatternAsNode.create = create;
})(PatternAsNode || (exports.PatternAsNode = PatternAsNode = {}));
var PatternLiteralNode;
(function (PatternLiteralNode) {
    function create(expression) {
        const node = {
            start: expression.start,
            length: expression.length,
            nodeType: 67 /* ParseNodeType.PatternLiteral */,
            id: _nextNodeId++,
            expression,
        };
        expression.parent = node;
        return node;
    }
    PatternLiteralNode.create = create;
})(PatternLiteralNode || (exports.PatternLiteralNode = PatternLiteralNode = {}));
var PatternClassNode;
(function (PatternClassNode) {
    function create(className, args) {
        const node = {
            start: className.start,
            length: className.length,
            nodeType: 68 /* ParseNodeType.PatternClass */,
            id: _nextNodeId++,
            className,
            arguments: args,
        };
        className.parent = node;
        args.forEach((arg) => {
            arg.parent = node;
        });
        if (args.length > 0) {
            extendRange(node, args[args.length - 1]);
        }
        return node;
    }
    PatternClassNode.create = create;
})(PatternClassNode || (exports.PatternClassNode = PatternClassNode = {}));
var PatternClassArgumentNode;
(function (PatternClassArgumentNode) {
    function create(pattern, name) {
        const node = {
            start: pattern.start,
            length: pattern.length,
            nodeType: 74 /* ParseNodeType.PatternClassArgument */,
            id: _nextNodeId++,
            pattern,
            name,
        };
        pattern.parent = node;
        if (name) {
            extendRange(node, name);
            name.parent = node;
        }
        return node;
    }
    PatternClassArgumentNode.create = create;
})(PatternClassArgumentNode || (exports.PatternClassArgumentNode = PatternClassArgumentNode = {}));
var PatternCaptureNode;
(function (PatternCaptureNode) {
    function create(target, starToken) {
        const node = {
            start: target.start,
            length: target.length,
            nodeType: 69 /* ParseNodeType.PatternCapture */,
            id: _nextNodeId++,
            target,
            isStar: starToken !== undefined,
            isWildcard: target.value === '_',
        };
        target.parent = node;
        if (starToken) {
            extendRange(node, starToken);
        }
        return node;
    }
    PatternCaptureNode.create = create;
})(PatternCaptureNode || (exports.PatternCaptureNode = PatternCaptureNode = {}));
var PatternMappingNode;
(function (PatternMappingNode) {
    function create(startToken, entries) {
        const node = {
            start: startToken.start,
            length: startToken.length,
            nodeType: 70 /* ParseNodeType.PatternMapping */,
            id: _nextNodeId++,
            entries,
        };
        if (entries.length > 0) {
            extendRange(node, entries[entries.length - 1]);
        }
        entries.forEach((entry) => {
            entry.parent = node;
        });
        return node;
    }
    PatternMappingNode.create = create;
})(PatternMappingNode || (exports.PatternMappingNode = PatternMappingNode = {}));
var PatternMappingKeyEntryNode;
(function (PatternMappingKeyEntryNode) {
    function create(keyPattern, valuePattern) {
        const node = {
            start: keyPattern.start,
            length: keyPattern.length,
            nodeType: 71 /* ParseNodeType.PatternMappingKeyEntry */,
            id: _nextNodeId++,
            keyPattern,
            valuePattern,
        };
        keyPattern.parent = node;
        valuePattern.parent = node;
        extendRange(node, valuePattern);
        return node;
    }
    PatternMappingKeyEntryNode.create = create;
})(PatternMappingKeyEntryNode || (exports.PatternMappingKeyEntryNode = PatternMappingKeyEntryNode = {}));
var PatternMappingExpandEntryNode;
(function (PatternMappingExpandEntryNode) {
    function create(starStarToken, target) {
        const node = {
            start: starStarToken.start,
            length: starStarToken.length,
            nodeType: 72 /* ParseNodeType.PatternMappingExpandEntry */,
            id: _nextNodeId++,
            target,
        };
        target.parent = node;
        extendRange(node, target);
        return node;
    }
    PatternMappingExpandEntryNode.create = create;
})(PatternMappingExpandEntryNode || (exports.PatternMappingExpandEntryNode = PatternMappingExpandEntryNode = {}));
var PatternValueNode;
(function (PatternValueNode) {
    function create(expression) {
        const node = {
            start: expression.start,
            length: expression.length,
            nodeType: 73 /* ParseNodeType.PatternValue */,
            id: _nextNodeId++,
            expression,
        };
        expression.parent = node;
        return node;
    }
    PatternValueNode.create = create;
})(PatternValueNode || (exports.PatternValueNode = PatternValueNode = {}));
//# sourceMappingURL=parseNodes.js.map