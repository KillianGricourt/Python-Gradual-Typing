"use strict";
/*
 * definitionProvider.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Logic that maps a position within a Python program file into
 * a "definition" of the item that is referred to at that position.
 * For example, if the location is within an import name, the
 * definition is the top of the resolved import file.
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
exports.TypeDefinitionProvider = exports.DefinitionProvider = exports.filterDefinitions = exports.addDeclarationsToDefinitions = exports.DefinitionFilter = void 0;
const analyzerNodeInfo_1 = require("../analyzer/analyzerNodeInfo");
const declaration_1 = require("../analyzer/declaration");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const sourceMapper_1 = require("../analyzer/sourceMapper");
const typeUtils_1 = require("../analyzer/typeUtils");
const types_1 = require("../analyzer/types");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const core_1 = require("../common/core");
const positionUtils_1 = require("../common/positionUtils");
const serviceKeys_1 = require("../common/serviceKeys");
const textRange_1 = require("../common/textRange");
var DefinitionFilter;
(function (DefinitionFilter) {
    DefinitionFilter["All"] = "all";
    DefinitionFilter["PreferSource"] = "preferSource";
    DefinitionFilter["PreferStubs"] = "preferStubs";
})(DefinitionFilter || (exports.DefinitionFilter = DefinitionFilter = {}));
function addDeclarationsToDefinitions(evaluator, sourceMapper, declarations, definitions) {
    if (!declarations) {
        return;
    }
    declarations.forEach((decl) => {
        var _a;
        let resolvedDecl = evaluator.resolveAliasDeclaration(decl, /* resolveLocalNames */ true, {
            allowExternallyHiddenAccess: true,
        });
        if (!resolvedDecl || resolvedDecl.uri.isEmpty()) {
            return;
        }
        // If the decl is an unresolved import, skip it.
        if (resolvedDecl.type === 8 /* DeclarationType.Alias */) {
            if (resolvedDecl.isUnresolved || (0, declaration_1.isUnresolvedAliasDeclaration)(resolvedDecl)) {
                return;
            }
        }
        // If the resolved decl is still an alias, it means it
        // resolved to a module. We need to apply loader actions
        // to determine its path.
        if (resolvedDecl.type === 8 /* DeclarationType.Alias */ &&
            resolvedDecl.symbolName &&
            resolvedDecl.submoduleFallback &&
            !resolvedDecl.submoduleFallback.uri.isEmpty()) {
            resolvedDecl = resolvedDecl.submoduleFallback;
        }
        _addIfUnique(definitions, {
            uri: resolvedDecl.uri,
            range: resolvedDecl.range,
        });
        if ((0, declaration_1.isFunctionDeclaration)(resolvedDecl)) {
            // Handle overloaded function case
            const functionType = (_a = evaluator.getTypeForDeclaration(resolvedDecl)) === null || _a === void 0 ? void 0 : _a.type;
            if (functionType && (0, types_1.isOverloadedFunction)(functionType)) {
                for (const overloadDecl of functionType.overloads.map((o) => o.details.declaration).filter(core_1.isDefined)) {
                    _addIfUnique(definitions, {
                        uri: overloadDecl.uri,
                        range: overloadDecl.range,
                    });
                }
            }
        }
        if (!(0, sourceMapper_1.isStubFile)(resolvedDecl.uri)) {
            return;
        }
        if (resolvedDecl.type === 8 /* DeclarationType.Alias */) {
            // Add matching source module
            sourceMapper
                .findModules(resolvedDecl.uri)
                .map((m) => { var _a; return (_a = (0, analyzerNodeInfo_1.getFileInfo)(m)) === null || _a === void 0 ? void 0 : _a.fileUri; })
                .filter(core_1.isDefined)
                .forEach((f) => _addIfUnique(definitions, _createModuleEntry(f)));
            return;
        }
        const implDecls = sourceMapper.findDeclarations(resolvedDecl);
        for (const implDecl of implDecls) {
            if (implDecl && !implDecl.uri.isEmpty()) {
                _addIfUnique(definitions, {
                    uri: implDecl.uri,
                    range: implDecl.range,
                });
            }
        }
    });
}
exports.addDeclarationsToDefinitions = addDeclarationsToDefinitions;
function filterDefinitions(filter, definitions) {
    if (filter === DefinitionFilter.All) {
        return definitions;
    }
    // If go-to-declaration is supported, attempt to only show only pyi files in go-to-declaration
    // and none in go-to-definition, unless filtering would produce an empty list.
    const preferStubs = filter === DefinitionFilter.PreferStubs;
    const wantedFile = (v) => preferStubs === (0, sourceMapper_1.isStubFile)(v.uri);
    if (definitions.find(wantedFile)) {
        return definitions.filter(wantedFile);
    }
    return definitions;
}
exports.filterDefinitions = filterDefinitions;
class DefinitionProviderBase {
    constructor(sourceMapper, evaluator, _serviceProvider, node, offset, _filter, token) {
        this.sourceMapper = sourceMapper;
        this.evaluator = evaluator;
        this._serviceProvider = _serviceProvider;
        this.node = node;
        this.offset = offset;
        this._filter = _filter;
        this.token = token;
    }
    getDefinitionsForNode(node, offset) {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(this.token);
        const definitions = [];
        const factories = (_a = this._serviceProvider) === null || _a === void 0 ? void 0 : _a.tryGet(serviceKeys_1.ServiceKeys.symbolDefinitionProvider);
        if (factories) {
            factories.forEach((f) => {
                const declarations = f.tryGetDeclarations(node, offset, this.token);
                this.resolveDeclarations(declarations, definitions);
            });
        }
        // There should be only one 'definition', so only if extensions failed should we try again.
        if (definitions.length === 0) {
            if (node.nodeType === 38 /* ParseNodeType.Name */) {
                const declarations = this.evaluator.getDeclarationsForNameNode(node);
                this.resolveDeclarations(declarations, definitions);
            }
            else if (node.nodeType === 49 /* ParseNodeType.String */) {
                const declarations = this.evaluator.getDeclarationsForStringNode(node);
                this.resolveDeclarations(declarations, definitions);
            }
        }
        if (definitions.length === 0) {
            return undefined;
        }
        return filterDefinitions(this._filter, definitions);
    }
    resolveDeclarations(declarations, definitions) {
        addDeclarationsToDefinitions(this.evaluator, this.sourceMapper, declarations, definitions);
    }
}
class DefinitionProvider extends DefinitionProviderBase {
    constructor(program, fileUri, position, filter, token) {
        const sourceMapper = program.getSourceMapper(fileUri, token);
        const parseResults = program.getParseResults(fileUri);
        const { node, offset } = _tryGetNode(parseResults, position);
        super(sourceMapper, program.evaluator, program.serviceProvider, node, offset, filter, token);
    }
    static getDefinitionsForNode(sourceMapper, evaluator, node, offset, token) {
        const provider = new DefinitionProviderBase(sourceMapper, evaluator, undefined, node, offset, DefinitionFilter.All, token);
        return provider.getDefinitionsForNode(node, offset);
    }
    getDefinitions() {
        if (this.node === undefined) {
            return undefined;
        }
        return this.getDefinitionsForNode(this.node, this.offset);
    }
}
exports.DefinitionProvider = DefinitionProvider;
class TypeDefinitionProvider extends DefinitionProviderBase {
    constructor(program, fileUri, position, token) {
        const sourceMapper = program.getSourceMapper(fileUri, token, /*mapCompiled*/ false, /*preferStubs*/ true);
        const parseResults = program.getParseResults(fileUri);
        const { node, offset } = _tryGetNode(parseResults, position);
        super(sourceMapper, program.evaluator, program.serviceProvider, node, offset, DefinitionFilter.All, token);
        this._fileUri = fileUri;
    }
    getDefinitions() {
        var _a;
        (0, cancellationUtils_1.throwIfCancellationRequested)(this.token);
        if (this.node === undefined) {
            return undefined;
        }
        const definitions = [];
        if (this.node.nodeType === 38 /* ParseNodeType.Name */) {
            const type = this.evaluator.getType(this.node);
            if (type) {
                let declarations = [];
                (0, typeUtils_1.doForEachSubtype)(type, (subtype) => {
                    if ((subtype === null || subtype === void 0 ? void 0 : subtype.category) === 6 /* TypeCategory.Class */) {
                        (0, collectionUtils_1.appendArray)(declarations, this.sourceMapper.findClassDeclarationsByType(this._fileUri, subtype));
                    }
                });
                // Fall back to Go To Definition if the type can't be found (ex. Go To Type Definition
                // was executed on a type name)
                if (declarations.length === 0) {
                    declarations = (_a = this.evaluator.getDeclarationsForNameNode(this.node)) !== null && _a !== void 0 ? _a : [];
                }
                this.resolveDeclarations(declarations, definitions);
            }
        }
        else if (this.node.nodeType === 49 /* ParseNodeType.String */) {
            const declarations = this.evaluator.getDeclarationsForStringNode(this.node);
            this.resolveDeclarations(declarations, definitions);
        }
        if (definitions.length === 0) {
            return undefined;
        }
        return definitions;
    }
}
exports.TypeDefinitionProvider = TypeDefinitionProvider;
function _tryGetNode(parseResults, position) {
    if (!parseResults) {
        return { node: undefined, offset: 0 };
    }
    const offset = (0, positionUtils_1.convertPositionToOffset)(position, parseResults.tokenizerOutput.lines);
    if (offset === undefined) {
        return { node: undefined, offset: 0 };
    }
    return { node: ParseTreeUtils.findNodeByOffset(parseResults.parserOutput.parseTree, offset), offset };
}
function _createModuleEntry(uri) {
    return {
        uri,
        range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 0 },
        },
    };
}
function _addIfUnique(definitions, itemToAdd) {
    for (const def of definitions) {
        if (def.uri.equals(itemToAdd.uri) && (0, textRange_1.rangesAreEqual)(def.range, itemToAdd.range)) {
            return;
        }
    }
    definitions.push(itemToAdd);
}
//# sourceMappingURL=definitionProvider.js.map