"use strict";
/*
 * dumpFileDebugInfoCommand.ts
 * Copyright (c) Microsoft Corporation.
 *
 * Dump various token/node/type info
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DumpFileDebugInfo = exports.DumpFileDebugInfoCommand = void 0;
const analyzerNodeInfo_1 = require("../analyzer/analyzerNodeInfo");
const parseTreeUtils_1 = require("../analyzer/parseTreeUtils");
const parseTreeWalker_1 = require("../analyzer/parseTreeWalker");
const types_1 = require("../analyzer/types");
const cancellationUtils_1 = require("../common/cancellationUtils");
const core_1 = require("../common/core");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const parseNodes_1 = require("../parser/parseNodes");
class DumpFileDebugInfoCommand {
    constructor(_ls) {
        this._ls = _ls;
    }
    async execute(params, token) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        if (!params.arguments || params.arguments.length < 2) {
            return [];
        }
        const fileUri = uri_1.Uri.parse(params.arguments[0], this._ls.serviceProvider);
        const workspace = await this._ls.getWorkspaceForFile(fileUri);
        return new DumpFileDebugInfo().dump(workspace, fileUri, params.arguments, token);
    }
}
exports.DumpFileDebugInfoCommand = DumpFileDebugInfoCommand;
class DumpFileDebugInfo {
    dump(workspace, fileUri, args, token) {
        return workspace.service.run((p) => {
            const kind = args[1];
            const parseResults = workspace.service.getParseResults(workspace.service.fs.realCasePath(fileUri));
            if (!parseResults) {
                return [];
            }
            const output = [];
            const collectingConsole = {
                info: (m) => {
                    output.push(m);
                },
                log: (m) => {
                    output.push(m);
                },
                error: (m) => {
                    output.push(m);
                },
                warn: (m) => {
                    output.push(m);
                },
            };
            collectingConsole.info(`* Dump debug info for '${fileUri.toUserVisibleString()}'`);
            switch (kind) {
                case 'tokens': {
                    collectingConsole.info(`* Token info (${parseResults.tokenizerOutput.tokens.count} tokens)`);
                    for (let i = 0; i < parseResults.tokenizerOutput.tokens.count; i++) {
                        const token = parseResults.tokenizerOutput.tokens.getItemAt(i);
                        collectingConsole.info(`[${i}] ${getTokenString(fileUri, token, parseResults.tokenizerOutput.lines)}`);
                    }
                    break;
                }
                case 'nodes': {
                    collectingConsole.info(`* Node info`);
                    const dumper = new TreeDumper(fileUri, parseResults.tokenizerOutput.lines);
                    dumper.walk(parseResults.parserOutput.parseTree);
                    collectingConsole.info(dumper.output);
                    break;
                }
                case 'types': {
                    const evaluator = p.evaluator;
                    const start = args[2];
                    const end = args[3];
                    if (!evaluator || !start || !end) {
                        return [];
                    }
                    collectingConsole.info(`* Type info`);
                    collectingConsole.info(`${getTypeEvaluatorString(fileUri, evaluator, parseResults, start, end)}`);
                    break;
                }
                case 'cachedtypes': {
                    const evaluator = p.evaluator;
                    const start = args[2];
                    const end = args[3];
                    if (!evaluator || !start || !end) {
                        return [];
                    }
                    collectingConsole.info(`* Cached Type info`);
                    collectingConsole.info(`${getTypeEvaluatorString(fileUri, evaluator, parseResults, start, end, true)}`);
                    break;
                }
                case 'codeflowgraph': {
                    const evaluator = p.evaluator;
                    const offset = args[2];
                    if (!evaluator || offset === undefined) {
                        return [];
                    }
                    const node = (0, parseTreeUtils_1.findNodeByOffset)(parseResults.parserOutput.parseTree, offset);
                    if (!node) {
                        return [];
                    }
                    const flowNode = (0, analyzerNodeInfo_1.getFlowNode)(node);
                    if (!flowNode) {
                        return [];
                    }
                    collectingConsole.info(`* CodeFlow Graph`);
                    evaluator.printControlFlowGraph(flowNode, undefined, 'Dump CodeFlowGraph', collectingConsole);
                }
            }
            // Print all of the output in one message so the trace log is smaller.
            workspace.service.serviceProvider.console().info(output.join('\n'));
            return [];
        }, token);
    }
}
exports.DumpFileDebugInfo = DumpFileDebugInfo;
function stringify(value, replacer) {
    const json = JSON.stringify(value, replacer, 2);
    // Unescape any paths so VS code shows them as clickable.
    return json.replace(/\\\\/g, '\\');
}
function getTypeEvaluatorString(uri, evaluator, results, start, end, cacheOnly) {
    var _a, _b;
    const dumper = new TreeDumper(uri, results.tokenizerOutput.lines);
    const node = (_a = (0, parseTreeUtils_1.findNodeByOffset)(results.parserOutput.parseTree, start)) !== null && _a !== void 0 ? _a : (0, parseTreeUtils_1.findNodeByOffset)(results.parserOutput.parseTree, end);
    if (!node) {
        return 'N/A';
    }
    const set = new Set();
    if (node.nodeType === 38 /* ParseNodeType.Name */) {
        switch ((_b = node.parent) === null || _b === void 0 ? void 0 : _b.nodeType) {
            case 10 /* ParseNodeType.Class */: {
                const result = cacheOnly
                    ? evaluator.getCachedType(node.parent.name)
                    : evaluator.getTypeOfClass(node.parent);
                if (!result) {
                    return 'N/A';
                }
                return stringify(result, replacer);
            }
            case 31 /* ParseNodeType.Function */: {
                const result = cacheOnly
                    ? evaluator.getCachedType(node.parent.name)
                    : evaluator.getTypeOfFunction(node.parent);
                if (!result) {
                    return 'N/A';
                }
                return stringify(result, replacer);
            }
        }
    }
    const range = textRange_1.TextRange.fromBounds(start, end);
    const expr = getExpressionNodeWithRange(node, range);
    if (!expr) {
        return 'N/A';
    }
    const sb = `Expression node found at ${getTextSpanString(expr, results.tokenizerOutput.lines)} from the given span ${getTextSpanString(range, results.tokenizerOutput.lines)}\r\n`;
    const result = cacheOnly ? evaluator.getCachedType(expr) : evaluator.getType(expr);
    if (!result) {
        return sb + 'No result';
    }
    return sb + stringify(result, replacer);
    function getExpressionNodeWithRange(node, range) {
        // find best expression node that contains both start and end.
        let current = node;
        while (current && !textRange_1.TextRange.containsRange(current, range)) {
            current = current.parent;
        }
        if (!current) {
            return undefined;
        }
        while (!(0, parseNodes_1.isExpressionNode)(current)) {
            current = current.parent;
        }
        return current;
    }
    function replacer(key, value) {
        if (value === undefined) {
            return undefined;
        }
        if (!(0, core_1.isNumber)(value) && !(0, core_1.isString)(value)) {
            if (set.has(value)) {
                if (isClassType(value)) {
                    return `<cycle> class '${value.details.fullName}' typeSourceId:${value.details.typeSourceId}`;
                }
                if (isFunctionType(value)) {
                    return `<cycle> function '${value.details.fullName}' parameter count:${value.details.parameters.length}`;
                }
                if (isTypeVarType(value)) {
                    return `<cycle> function '${value.details.name}' scope id:${value.nameWithScope}`;
                }
                return undefined;
            }
            else {
                set.add(value);
            }
        }
        if (isTypeBase(this) && key === 'category') {
            return getTypeCategoryString(value, this);
        }
        if (isTypeBase(this) && key === 'flags') {
            return getTypeFlagsString(value);
        }
        if (isClassDetail(this) && key === 'flags') {
            return getClassTypeFlagsString(value);
        }
        if (isFunctionDetail(this) && key === 'flags') {
            return getFunctionTypeFlagsString(value);
        }
        if (isTypeVarDetails(this) && key === 'variance') {
            return getVarianceString(value);
        }
        if (isParameter(this) && key === 'category') {
            return getParameterCategoryString(value);
        }
        if (value.nodeType && value.id) {
            dumper.visitNode(value);
            const output = dumper.output;
            dumper.reset();
            return output;
        }
        return value;
    }
    function isTypeBase(type) {
        return type.category && type.flags;
    }
    function isClassType(type) {
        return isTypeBase(type) && type.details && isClassDetail(type.details);
    }
    function isClassDetail(type) {
        return (type.name !== undefined && type.fullName !== undefined && type.moduleName !== undefined && type.baseClasses);
    }
    function isFunctionType(type) {
        return isTypeBase(type) && type.details && isFunctionDetail(type.details);
    }
    function isFunctionDetail(type) {
        return (type.name !== undefined && type.fullName !== undefined && type.moduleName !== undefined && type.parameters);
    }
    function isTypeVarType(type) {
        return isTypeBase(type) && type.details && isTypeVarDetails(type.details);
    }
    function isTypeVarDetails(type) {
        return type.name !== undefined && type.constraints && type.variance !== undefined;
    }
    function isParameter(type) {
        return type.category && type.type;
    }
}
function getVarianceString(type) {
    switch (type) {
        case 2 /* Variance.Invariant */:
            return 'Invariant';
        case 3 /* Variance.Covariant */:
            return 'Covariant';
        case 4 /* Variance.Contravariant */:
            return 'Contravariant';
        default:
            return `Unknown Value!! (${type})`;
    }
}
function getFlagEnumString(enumMap, enumValue) {
    const str = [];
    enumMap.forEach((e) => {
        if (enumValue & e[0]) {
            str.push(e[1]);
        }
    });
    if (str.length === 0) {
        if (enumValue === 0) {
            return 'None';
        }
        return '<Unknown>';
    }
    return str.join(',');
}
const FunctionTypeFlagsToString = [
    [8 /* FunctionTypeFlags.AbstractMethod */, 'AbstractMethod'],
    [512 /* FunctionTypeFlags.Async */, 'Async'],
    [2 /* FunctionTypeFlags.ClassMethod */, 'ClassMethod'],
    [1 /* FunctionTypeFlags.ConstructorMethod */, 'ConstructorMethod'],
    [32 /* FunctionTypeFlags.DisableDefaultChecks */, 'DisableDefaultChecks'],
    [8192 /* FunctionTypeFlags.Final */, 'Final'],
    [16 /* FunctionTypeFlags.Generator */, 'Generator'],
    [256 /* FunctionTypeFlags.Overloaded */, 'Overloaded'],
    [65536 /* FunctionTypeFlags.ParamSpecValue */, 'ParamSpecValue'],
    [131072 /* FunctionTypeFlags.PartiallyEvaluated */, 'PartiallyEvaluated'],
    [4096 /* FunctionTypeFlags.PyTypedDefinition */, 'PyTypedDefinition'],
    [32768 /* FunctionTypeFlags.GradualCallableForm */, 'SkipArgsKwargsCompatibilityCheck'],
    [4 /* FunctionTypeFlags.StaticMethod */, 'StaticMethod'],
    [2048 /* FunctionTypeFlags.StubDefinition */, 'StubDefinition'],
    [64 /* FunctionTypeFlags.SynthesizedMethod */, 'SynthesizedMethod'],
    [16384 /* FunctionTypeFlags.UnannotatedParams */, 'UnannotatedParams'],
];
function getFunctionTypeFlagsString(flags) {
    return getFlagEnumString(FunctionTypeFlagsToString, flags);
}
const ClassTypeFlagsToString = [
    [1 /* ClassTypeFlags.BuiltInClass */, 'BuiltInClass'],
    [32 /* ClassTypeFlags.CanOmitDictValues */, 'CanOmitDictValues'],
    [131072 /* ClassTypeFlags.ClassProperty */, 'ClassProperty'],
    [262144 /* ClassTypeFlags.DefinedInStub */, 'DefinedInStub'],
    [65536 /* ClassTypeFlags.EnumClass */, 'EnumClass'],
    [256 /* ClassTypeFlags.Final */, 'Final'],
    [16384 /* ClassTypeFlags.HasCustomClassGetItem */, 'HasCustomClassGetItem'],
    [8192 /* ClassTypeFlags.PartiallyEvaluated */, 'PartiallyEvaluated'],
    [128 /* ClassTypeFlags.PropertyClass */, 'PropertyClass'],
    [512 /* ClassTypeFlags.ProtocolClass */, 'ProtocolClass'],
    [1024 /* ClassTypeFlags.PseudoGenericClass */, 'PseudoGenericClass'],
    [524288 /* ClassTypeFlags.ReadOnlyInstanceVariables */, 'ReadOnlyInstanceVariables'],
    [2048 /* ClassTypeFlags.RuntimeCheckable */, 'RuntimeCheckable'],
    [2 /* ClassTypeFlags.SpecialBuiltIn */, 'SpecialBuiltIn'],
    [64 /* ClassTypeFlags.SupportsAbstractMethods */, 'SupportsAbstractMethods'],
    [32768 /* ClassTypeFlags.TupleClass */, 'TupleClass'],
    [4 /* ClassTypeFlags.TypedDictClass */, 'TypedDictClass'],
    [4096 /* ClassTypeFlags.TypingExtensionClass */, 'TypingExtensionClass'],
];
function getClassTypeFlagsString(flags) {
    return getFlagEnumString(ClassTypeFlagsToString, flags);
}
function getTypeFlagsString(flags) {
    const str = [];
    if (flags & 1 /* TypeFlags.Instantiable */) {
        str.push('Instantiable');
    }
    if (flags & 2 /* TypeFlags.Instance */) {
        str.push('Instance');
    }
    if (str.length === 0)
        return 'None';
    return str.join(',');
}
function getTypeCategoryString(typeCategory, type) {
    switch (typeCategory) {
        case 0 /* TypeCategory.Unbound */:
            return 'Unbound';
        case 1 /* TypeCategory.Unknown */:
            return 'Unknown';
        case 2 /* TypeCategory.Any */:
            return 'Any';
        case 3 /* TypeCategory.Never */:
            return 'Never';
        case 4 /* TypeCategory.Function */:
            return 'Function';
        case 5 /* TypeCategory.OverloadedFunction */:
            return 'OverloadedFunction';
        case 6 /* TypeCategory.Class */:
            if (types_1.TypeBase.isInstantiable(type)) {
                return 'Class';
            }
            else {
                return 'Object';
            }
        case 7 /* TypeCategory.Module */:
            return 'Module';
        case 8 /* TypeCategory.Union */:
            return 'Union';
        case 9 /* TypeCategory.TypeVar */:
            return 'TypeVar';
        default:
            return `Unknown Value!! (${typeCategory})`;
    }
}
class TreeDumper extends parseTreeWalker_1.ParseTreeWalker {
    constructor(_uri, _lines) {
        super();
        this._uri = _uri;
        this._lines = _lines;
        this._indentation = '';
        this._output = '';
    }
    get output() {
        return this._output;
    }
    walk(node) {
        const childrenToWalk = this.visitNode(node);
        if (childrenToWalk.length > 0) {
            this._indentation += '  ';
            this.walkMultiple(childrenToWalk);
            this._indentation = this._indentation.substr(0, this._indentation.length - 2);
        }
    }
    reset() {
        this._indentation = '';
        this._output = '';
    }
    visitArgument(node) {
        this._log(`${this._getPrefix(node)} ${getArgumentCategoryString(node.argumentCategory)}`);
        return true;
    }
    visitAssert(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitAssignment(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitAssignmentExpression(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitAugmentedAssignment(node) {
        this._log(`${this._getPrefix(node)} ${getOperatorTypeString(node.operator)}`);
        return true;
    }
    visitAwait(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitBinaryOperation(node) {
        this._log(`${this._getPrefix(node)} ${getTokenString(this._uri, node.operatorToken, this._lines)} ${getOperatorTypeString(node.operator)}} parenthesized:(${node.parenthesized})`);
        return true;
    }
    visitBreak(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitCall(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitClass(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitComprehension(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitComprehensionFor(node) {
        this._log(`${this._getPrefix(node)} async:(${node.isAsync})`);
        return true;
    }
    visitComprehensionIf(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitContinue(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitConstant(node) {
        this._log(`${this._getPrefix(node)} ${getKeywordTypeString(node.constType)}`);
        return true;
    }
    visitDecorator(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitDel(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitDictionary(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitDictionaryKeyEntry(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitDictionaryExpandEntry(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitError(node) {
        this._log(`${this._getPrefix(node)} ${getErrorExpressionCategoryString(node.category)}`);
        return true;
    }
    visitEllipsis(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitIf(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitImport(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitImportAs(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitImportFrom(node) {
        this._log(`${this._getPrefix(node)} wildcard import:(${node.isWildcardImport}) paren:(${node.usesParens}) wildcard token:(${node.wildcardToken ? getTokenString(this._uri, node.wildcardToken, this._lines) : 'N/A'}) missing import keyword:(${node.missingImportKeyword})`);
        return true;
    }
    visitImportFromAs(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitIndex(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitExcept(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitFor(node) {
        this._log(`${this._getPrefix(node)} async:(${node.isAsync})`);
        return true;
    }
    visitFormatString(node) {
        this._log(`${this._getPrefix(node)} f-string`);
        return true;
    }
    visitFunction(node) {
        this._log(`${this._getPrefix(node)} async:(${node.isAsync})`);
        return true;
    }
    visitFunctionAnnotation(node) {
        this._log(`${this._getPrefix(node)} ellipsis:(${node.isParamListEllipsis})`);
        return true;
    }
    visitGlobal(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitLambda(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitList(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitMemberAccess(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitModule(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitModuleName(node) {
        this._log(`${this._getPrefix(node)} leading dots:(${node.leadingDots}) trailing dot:(${node.hasTrailingDot})`);
        return true;
    }
    visitName(node) {
        this._log(`${this._getPrefix(node)} ${getTokenString(this._uri, node.token, this._lines)} ${node.value}`);
        return true;
    }
    visitNonlocal(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitNumber(node) {
        this._log(`${this._getPrefix(node)} ${node.value} int:(${node.isInteger}) imaginary:(${node.isImaginary})`);
        return true;
    }
    visitParameter(node) {
        this._log(`${this._getPrefix(node)} ${getParameterCategoryString(node.category)}`);
        return true;
    }
    visitPass(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitRaise(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitReturn(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitSet(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitSlice(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitStatementList(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitString(node) {
        this._log(`${this._getPrefix(node)} ${getTokenString(this._uri, node.token, this._lines)} ${node.value}`);
        return true;
    }
    visitStringList(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitSuite(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitTernary(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitTuple(node) {
        this._log(`${this._getPrefix(node)} paren:(${node.enclosedInParens})`);
        return true;
    }
    visitTry(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitTypeAnnotation(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitUnaryOperation(node) {
        this._log(`${this._getPrefix(node)} ${getTokenString(this._uri, node.operatorToken, this._lines)} ${getOperatorTypeString(node.operator)}`);
        return true;
    }
    visitUnpack(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitWhile(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitWith(node) {
        this._log(`${this._getPrefix(node)} async:(${node.isAsync})`);
        return true;
    }
    visitWithItem(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitYield(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitYieldFrom(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitCase(node) {
        this._log(`${this._getPrefix(node)} isIrrefutable: ${node.isIrrefutable}`);
        return true;
    }
    visitMatch(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternAs(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternCapture(node) {
        this._log(`${this._getPrefix(node)} isStar:${node.isStar} isWildcard:${node.isWildcard}`);
        return true;
    }
    visitPatternClass(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternClassArgument(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternLiteral(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternMapping(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternMappingExpandEntry(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternMappingKeyEntry(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitPatternSequence(node) {
        this._log(`${this._getPrefix(node)} starEntryIndex: ${node.starEntryIndex}`);
        return true;
    }
    visitPatternValue(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitTypeAlias(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    visitTypeParameter(node) {
        this._log(`${this._getPrefix(node)} typeParamCategory:${getTypeParameterCategoryString(node.typeParamCategory)}`);
        return true;
    }
    visitTypeParameterList(node) {
        this._log(`${this._getPrefix(node)}`);
        return true;
    }
    _log(value) {
        this._output += `${this._indentation}${value}\r\n`;
    }
    _getPrefix(node) {
        const pos = (0, positionUtils_1.convertOffsetToPosition)(node.start, this._lines);
        // VS code's output window expects 1 based values, print the line/char with 1 based.
        return `[${node.id}] '${this._uri.toString()}:${pos.line + 1}:${pos.character + 1}' => ${(0, parseTreeUtils_1.printParseNodeType)(node.nodeType)} ${getTextSpanString(node, this._lines)} =>`;
    }
}
function getTypeParameterCategoryString(type) {
    switch (type) {
        case parseNodes_1.TypeParameterCategory.TypeVar:
            return 'TypeVar';
        case parseNodes_1.TypeParameterCategory.TypeVarTuple:
            return 'TypeVarTuple';
        case parseNodes_1.TypeParameterCategory.ParamSpec:
            return 'ParamSpec';
    }
}
function getParameterCategoryString(type) {
    switch (type) {
        case 0 /* ParameterCategory.Simple */:
            return 'Simple';
        case 1 /* ParameterCategory.ArgsList */:
            return 'VarArgList';
        case 2 /* ParameterCategory.KwargsDict */:
            return 'VarArgDictionary';
    }
}
function getArgumentCategoryString(type) {
    switch (type) {
        case 0 /* ArgumentCategory.Simple */:
            return 'Simple';
        case 1 /* ArgumentCategory.UnpackedList */:
            return 'UnpackedList';
        case 2 /* ArgumentCategory.UnpackedDictionary */:
            return 'UnpackedDictionary';
        default:
            return `Unknown Value!! (${type})`;
    }
}
function getErrorExpressionCategoryString(type) {
    switch (type) {
        case 0 /* ErrorExpressionCategory.MissingIn */:
            return 'MissingIn';
        case 1 /* ErrorExpressionCategory.MissingElse */:
            return 'MissingElse';
        case 2 /* ErrorExpressionCategory.MissingExpression */:
            return 'MissingExpression';
        case 3 /* ErrorExpressionCategory.MissingIndexOrSlice */:
            return 'MissingIndexOrSlice';
        case 4 /* ErrorExpressionCategory.MissingDecoratorCallName */:
            return 'MissingDecoratorCallName';
        case 5 /* ErrorExpressionCategory.MissingCallCloseParen */:
            return 'MissingCallCloseParen';
        case 6 /* ErrorExpressionCategory.MissingIndexCloseBracket */:
            return 'MissingIndexCloseBracket';
        case 7 /* ErrorExpressionCategory.MissingMemberAccessName */:
            return 'MissingMemberAccessName';
        case 8 /* ErrorExpressionCategory.MissingTupleCloseParen */:
            return 'MissingTupleCloseParen';
        case 9 /* ErrorExpressionCategory.MissingListCloseBracket */:
            return 'MissingListCloseBracket';
        case 10 /* ErrorExpressionCategory.MissingFunctionParameterList */:
            return 'MissingFunctionParameterList';
        case 11 /* ErrorExpressionCategory.MissingPattern */:
            return 'MissingPattern';
        case 12 /* ErrorExpressionCategory.MissingPatternSubject */:
            return 'MissingPatternSubject';
        case 13 /* ErrorExpressionCategory.MissingDictValue */:
            return 'MissingDictValue';
        case 14 /* ErrorExpressionCategory.MaxDepthExceeded */:
            return 'MaxDepthExceeded';
        default:
            return `Unknown Value!! (${type})`;
    }
}
function getTokenString(uri, token, lines) {
    const pos = (0, positionUtils_1.convertOffsetToPosition)(token.start, lines);
    let str = `'${uri.toUserVisibleString()}:${pos.line + 1}:${pos.character + 1}' (`;
    str += getTokenTypeString(token.type);
    str += getNewLineInfo(token);
    str += getOperatorInfo(token);
    str += getKeywordInfo(token);
    str += getStringTokenFlags(token);
    str += `, ${getTextSpanString(token, lines)}`;
    str += ') ';
    str += JSON.stringify(token);
    return str;
    function getNewLineInfo(t) {
        return t.newLineType ? `, ${getNewLineTypeString(t.newLineType)}` : '';
    }
    function getOperatorInfo(t) {
        return t.operatorType ? `, ${getOperatorTypeString(t.operatorType)}` : '';
    }
    function getKeywordInfo(t) {
        return t.keywordType ? `, ${getKeywordTypeString(t.keywordType)}` : '';
    }
    function getStringTokenFlags(t) {
        return t.flags ? `, [${getStringTokenFlagsString(t.flags)}]` : '';
    }
}
function getTextSpanString(span, lines) {
    const range = (0, positionUtils_1.convertOffsetsToRange)(span.start, textRange_1.TextRange.getEnd(span), lines);
    return `(${range.start.line},${range.start.character})-(${range.end.line},${range.end.character})`;
}
function getTokenTypeString(type) {
    switch (type) {
        case 0 /* TokenType.Invalid */:
            return 'Invalid';
        case 1 /* TokenType.EndOfStream */:
            return 'EndOfStream';
        case 2 /* TokenType.NewLine */:
            return 'NewLine';
        case 3 /* TokenType.Indent */:
            return 'Indent';
        case 4 /* TokenType.Dedent */:
            return 'Dedent';
        case 5 /* TokenType.String */:
            return 'String';
        case 6 /* TokenType.Number */:
            return 'Number';
        case 7 /* TokenType.Identifier */:
            return 'Identifier';
        case 8 /* TokenType.Keyword */:
            return 'Keyword';
        case 9 /* TokenType.Operator */:
            return 'Operator';
        case 10 /* TokenType.Colon */:
            return 'Colon';
        case 11 /* TokenType.Semicolon */:
            return 'Semicolon';
        case 12 /* TokenType.Comma */:
            return 'Comma';
        case 13 /* TokenType.OpenParenthesis */:
            return 'OpenParenthesis';
        case 14 /* TokenType.CloseParenthesis */:
            return 'CloseParenthesis';
        case 15 /* TokenType.OpenBracket */:
            return 'OpenBracket';
        case 16 /* TokenType.CloseBracket */:
            return 'CloseBracket';
        case 17 /* TokenType.OpenCurlyBrace */:
            return 'OpenCurlyBrace';
        case 18 /* TokenType.CloseCurlyBrace */:
            return 'CloseCurlyBrace';
        case 19 /* TokenType.Ellipsis */:
            return 'Ellipsis';
        case 20 /* TokenType.Dot */:
            return 'Dot';
        case 21 /* TokenType.Arrow */:
            return 'Arrow';
        case 22 /* TokenType.Backtick */:
            return 'Backtick';
        default:
            return `Unknown Value!! (${type})`;
    }
}
function getNewLineTypeString(type) {
    switch (type) {
        case 0 /* NewLineType.CarriageReturn */:
            return 'CarriageReturn';
        case 1 /* NewLineType.LineFeed */:
            return 'LineFeed';
        case 2 /* NewLineType.CarriageReturnLineFeed */:
            return 'CarriageReturnLineFeed';
        case 3 /* NewLineType.Implied */:
            return 'Implied';
        default:
            return `Unknown Value!! (${type})`;
    }
}
function getOperatorTypeString(type) {
    switch (type) {
        case 0 /* OperatorType.Add */:
            return 'Add';
        case 1 /* OperatorType.AddEqual */:
            return 'AddEqual';
        case 2 /* OperatorType.Assign */:
            return 'Assign';
        case 3 /* OperatorType.BitwiseAnd */:
            return 'BitwiseAnd';
        case 4 /* OperatorType.BitwiseAndEqual */:
            return 'BitwiseAndEqual';
        case 5 /* OperatorType.BitwiseInvert */:
            return 'BitwiseInvert';
        case 6 /* OperatorType.BitwiseOr */:
            return 'BitwiseOr';
        case 7 /* OperatorType.BitwiseOrEqual */:
            return 'BitwiseOrEqual';
        case 8 /* OperatorType.BitwiseXor */:
            return 'BitwiseXor';
        case 9 /* OperatorType.BitwiseXorEqual */:
            return 'BitwiseXorEqual';
        case 10 /* OperatorType.Divide */:
            return 'Divide';
        case 11 /* OperatorType.DivideEqual */:
            return 'DivideEqual';
        case 12 /* OperatorType.Equals */:
            return 'Equals';
        case 13 /* OperatorType.FloorDivide */:
            return 'FloorDivide';
        case 14 /* OperatorType.FloorDivideEqual */:
            return 'FloorDivideEqual';
        case 15 /* OperatorType.GreaterThan */:
            return 'GreaterThan';
        case 16 /* OperatorType.GreaterThanOrEqual */:
            return 'GreaterThanOrEqual';
        case 17 /* OperatorType.LeftShift */:
            return 'LeftShift';
        case 18 /* OperatorType.LeftShiftEqual */:
            return 'LeftShiftEqual';
        case 19 /* OperatorType.LessOrGreaterThan */:
            return 'LessOrGreaterThan';
        case 20 /* OperatorType.LessThan */:
            return 'LessThan';
        case 21 /* OperatorType.LessThanOrEqual */:
            return 'LessThanOrEqual';
        case 22 /* OperatorType.MatrixMultiply */:
            return 'MatrixMultiply';
        case 23 /* OperatorType.MatrixMultiplyEqual */:
            return 'MatrixMultiplyEqual';
        case 24 /* OperatorType.Mod */:
            return 'Mod';
        case 25 /* OperatorType.ModEqual */:
            return 'ModEqual';
        case 26 /* OperatorType.Multiply */:
            return 'Multiply';
        case 27 /* OperatorType.MultiplyEqual */:
            return 'MultiplyEqual';
        case 28 /* OperatorType.NotEquals */:
            return 'NotEquals';
        case 29 /* OperatorType.Power */:
            return 'Power';
        case 30 /* OperatorType.PowerEqual */:
            return 'PowerEqual';
        case 31 /* OperatorType.RightShift */:
            return 'RightShift';
        case 32 /* OperatorType.RightShiftEqual */:
            return 'RightShiftEqual';
        case 33 /* OperatorType.Subtract */:
            return 'Subtract';
        case 34 /* OperatorType.SubtractEqual */:
            return 'SubtractEqual';
        case 35 /* OperatorType.Walrus */:
            return 'Walrus';
        case 36 /* OperatorType.And */:
            return 'And';
        case 37 /* OperatorType.Or */:
            return 'Or';
        case 38 /* OperatorType.Not */:
            return 'Not';
        case 39 /* OperatorType.Is */:
            return 'Is';
        case 40 /* OperatorType.IsNot */:
            return 'IsNot';
        case 41 /* OperatorType.In */:
            return 'In';
        case 42 /* OperatorType.NotIn */:
            return 'NotIn';
        default:
            return `Unknown Value!! (${type})`;
    }
}
function getKeywordTypeString(type) {
    switch (type) {
        case 0 /* KeywordType.And */:
            return 'And';
        case 1 /* KeywordType.As */:
            return 'As';
        case 2 /* KeywordType.Assert */:
            return 'Assert';
        case 3 /* KeywordType.Async */:
            return 'Async';
        case 4 /* KeywordType.Await */:
            return 'Await';
        case 5 /* KeywordType.Break */:
            return 'Break';
        case 7 /* KeywordType.Class */:
            return 'Class';
        case 8 /* KeywordType.Continue */:
            return 'Continue';
        case 9 /* KeywordType.Debug */:
            return 'Debug';
        case 10 /* KeywordType.Def */:
            return 'Def';
        case 11 /* KeywordType.Del */:
            return 'Del';
        case 12 /* KeywordType.Elif */:
            return 'Elif';
        case 13 /* KeywordType.Else */:
            return 'Else';
        case 14 /* KeywordType.Except */:
            return 'Except';
        case 15 /* KeywordType.False */:
            return 'False';
        case 16 /* KeywordType.Finally */:
            return 'Finally';
        case 17 /* KeywordType.For */:
            return 'For';
        case 18 /* KeywordType.From */:
            return 'From';
        case 19 /* KeywordType.Global */:
            return 'Global';
        case 20 /* KeywordType.If */:
            return 'If';
        case 21 /* KeywordType.Import */:
            return 'Import';
        case 22 /* KeywordType.In */:
            return 'In';
        case 23 /* KeywordType.Is */:
            return 'Is';
        case 24 /* KeywordType.Lambda */:
            return 'Lambda';
        case 26 /* KeywordType.None */:
            return 'None';
        case 27 /* KeywordType.Nonlocal */:
            return 'Nonlocal';
        case 28 /* KeywordType.Not */:
            return 'Not';
        case 29 /* KeywordType.Or */:
            return 'Or';
        case 30 /* KeywordType.Pass */:
            return 'Pass';
        case 31 /* KeywordType.Raise */:
            return 'Raise';
        case 32 /* KeywordType.Return */:
            return 'Return';
        case 33 /* KeywordType.True */:
            return 'True';
        case 34 /* KeywordType.Try */:
            return 'Try';
        case 36 /* KeywordType.While */:
            return 'While';
        case 37 /* KeywordType.With */:
            return 'With';
        case 38 /* KeywordType.Yield */:
            return 'Yield';
        default:
            return `Unknown Value!! (${type})`;
    }
}
const StringTokenFlagsStrings = [
    [32 /* StringTokenFlags.Bytes */, 'Bytes'],
    [2 /* StringTokenFlags.DoubleQuote */, 'DoubleQuote'],
    [64 /* StringTokenFlags.Format */, 'Format'],
    [8 /* StringTokenFlags.Raw */, 'Raw'],
    [1 /* StringTokenFlags.SingleQuote */, 'SingleQuote'],
    [4 /* StringTokenFlags.Triplicate */, 'Triplicate'],
    [16 /* StringTokenFlags.Unicode */, 'Unicode'],
    [65536 /* StringTokenFlags.Unterminated */, 'Unterminated'],
];
function getStringTokenFlagsString(flags) {
    return getFlagEnumString(StringTokenFlagsStrings, flags);
}
//# sourceMappingURL=dumpFileDebugInfoCommand.js.map