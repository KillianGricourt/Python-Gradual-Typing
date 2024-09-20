"use strict";
/*
 * textEditTracker.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Tracks text edits on a per-file basis.
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
exports.TextEditTracker = void 0;
const analyzerNodeInfo_1 = require("../analyzer/analyzerNodeInfo");
const importStatementUtils_1 = require("../analyzer/importStatementUtils");
const ParseTreeUtils = __importStar(require("../analyzer/parseTreeUtils"));
const collectionUtils_1 = require("./collectionUtils");
const debug = __importStar(require("./debug"));
const editAction_1 = require("./editAction");
const positionUtils_1 = require("./positionUtils");
const textRange_1 = require("./textRange");
const uri_1 = require("./uri/uri");
class TextEditTracker {
    constructor(_mergeOnlyDuplications = true) {
        this._mergeOnlyDuplications = _mergeOnlyDuplications;
        this._nodesRemoved = new Map();
        this._results = new Map();
        this._pendingNodeToRemove = [];
        // Empty
    }
    addEdits(...edits) {
        edits.forEach((e) => this.addEdit(e.fileUri, e.range, e.replacementText));
    }
    addEdit(fileUri, range, replacementText) {
        const edits = (0, collectionUtils_1.getOrAdd)(this._results, fileUri.key, () => []);
        // If there is any overlapping edit, see whether we can merge edits.
        // We can merge edits, if one of them is 'deletion' or 2 edits has the same
        // replacement text with containing range.
        const overlappingEdits = this._getEditsToMerge(edits, range, replacementText);
        if (overlappingEdits.length > 0) {
            // Merge the given edit with the existing edits by
            // first deleting existing edits and expanding the current edit's range
            // to cover all existing edits.
            this._removeEdits(edits, overlappingEdits);
            (0, textRange_1.extendRange)(range, overlappingEdits.map((d) => d.range));
        }
        edits.push({ fileUri: fileUri, range, replacementText });
    }
    addEditWithTextRange(parseFileResults, range, replacementText) {
        const filePath = (0, analyzerNodeInfo_1.getFileInfo)(parseFileResults.parserOutput.parseTree).fileUri;
        const existing = parseFileResults.text.substr(range.start, range.length);
        if (existing === replacementText) {
            // No change. Return as it is.
            return;
        }
        this.addEdit(filePath, (0, positionUtils_1.convertTextRangeToRange)(range, parseFileResults.tokenizerOutput.lines), replacementText);
    }
    deleteImportName(parseFileResults, importToDelete) {
        // TODO: remove all these manual text handling and merge it to _processNodeRemoved that is
        //       used by remove unused imports.
        const imports = importToDelete.nodeType === 24 /* ParseNodeType.ImportAs */
            ? importToDelete.parent.list
            : importToDelete.parent.imports;
        const filePath = (0, analyzerNodeInfo_1.getFileInfo)(parseFileResults.parserOutput.parseTree).fileUri;
        const ranges = (0, importStatementUtils_1.getTextRangeForImportNameDeletion)(parseFileResults, imports, imports.findIndex((v) => v === importToDelete));
        ranges.forEach((r) => this.addEditWithTextRange(parseFileResults, r, ''));
        this._markNodeRemoved(importToDelete, parseFileResults);
        // Check whether we have deleted all trailing import names.
        // If either no trailing import is deleted or handled properly
        // then, there is nothing to do. otherwise, either delete the whole statement
        // or remove trailing comma.
        // ex) from x import [y], z or from x import y[, z]
        let lastImportIndexNotDeleted = 0;
        for (lastImportIndexNotDeleted = imports.length - 1; lastImportIndexNotDeleted >= 0; lastImportIndexNotDeleted--) {
            if (!this._nodesRemoved.has(imports[lastImportIndexNotDeleted])) {
                break;
            }
        }
        if (lastImportIndexNotDeleted === -1) {
            // Whole statement is deleted. Remove the statement itself.
            // ex) [from x import a, b, c] or [import a]
            const importStatement = importToDelete.parent;
            if (importStatement) {
                this.addEdit(filePath, ParseTreeUtils.getFullStatementRange(importStatement, parseFileResults), '');
            }
        }
        else if (lastImportIndexNotDeleted >= 0 && lastImportIndexNotDeleted < imports.length - 2) {
            // We need to delete trailing comma
            // ex) from x import a, [b, c]
            const start = textRange_1.TextRange.getEnd(imports[lastImportIndexNotDeleted]);
            const length = textRange_1.TextRange.getEnd(imports[lastImportIndexNotDeleted + 1]) - start;
            this.addEditWithTextRange(parseFileResults, { start, length }, '');
        }
    }
    addOrUpdateImport(parseFileResults, importStatements, moduleNameInfo, importGroup, importNameInfo, updateOptions) {
        // TODO: remove all these manual text handling and merge it to _processNodeRemoved that is
        //       used by remove unused imports.
        if (importNameInfo &&
            this._tryUpdateImport(parseFileResults, importStatements, moduleNameInfo, importNameInfo, updateOptions)) {
            return;
        }
        this._addImport(parseFileResults, importStatements, moduleNameInfo, importGroup, importNameInfo);
    }
    removeNodes(...nodes) {
        this._pendingNodeToRemove.push(...nodes);
    }
    isNodeRemoved(node) {
        return this._nodesRemoved.has(node);
    }
    getEdits(token) {
        this._processNodeRemoved(token);
        const edits = [];
        this._results.forEach((v) => (0, collectionUtils_1.appendArray)(edits, v));
        return edits;
    }
    _addImport(parseFileResults, importStatements, moduleNameInfo, importGroup, importNameInfo) {
        const fileUri = (0, analyzerNodeInfo_1.getFileInfo)(parseFileResults.parserOutput.parseTree).fileUri;
        this.addEdits(...(0, importStatementUtils_1.getTextEditsForAutoImportInsertion)(importNameInfo !== null && importNameInfo !== void 0 ? importNameInfo : [], moduleNameInfo, importStatements, importGroup, parseFileResults, (0, positionUtils_1.convertOffsetToPosition)(parseFileResults.parserOutput.parseTree.length, parseFileResults.tokenizerOutput.lines)).map((e) => ({ fileUri, range: e.range, replacementText: e.replacementText })));
    }
    _tryUpdateImport(parseFileResults, importStatements, moduleNameInfo, importNameInfo, updateOptions) {
        if (!updateOptions) {
            return false;
        }
        // See whether we have existing from import statement for the same module
        // ex) from [|moduleName|] import subModule
        const imported = importStatements.orderedImports.find((i) => i.node.nodeType === 25 /* ParseNodeType.ImportFrom */ &&
            (i.moduleName === moduleNameInfo.nameForImportFrom || i.moduleName === moduleNameInfo.name));
        if (!imported || imported.node.nodeType !== 25 /* ParseNodeType.ImportFrom */ || imported.node.isWildcardImport) {
            return false;
        }
        const fileUri = (0, analyzerNodeInfo_1.getFileInfo)(parseFileResults.parserOutput.parseTree).fileUri;
        const edits = (0, importStatementUtils_1.getTextEditsForAutoImportSymbolAddition)(importNameInfo, imported, parseFileResults);
        if (imported.node !== updateOptions.currentFromImport) {
            // Add what we want to the existing "import from" statement as long as it is not the same import
            // node we are working on.
            // ex) from xxx import yyy <= we are working on here.
            //     from xxx import zzz <= but we found this.
            this.addEdits(...edits.map((e) => ({ fileUri, range: e.range, replacementText: e.replacementText })));
            return true;
        }
        const moduleNames = updateOptions.originalModuleName.split('.');
        const newModuleNames = moduleNameInfo.name.split('.');
        if (!(0, importStatementUtils_1.haveSameParentModule)(moduleNames, newModuleNames)) {
            // Module has moved.
            return false;
        }
        // Check whether we can avoid creating a new statement. We can't just merge with existing one since
        // we could create invalid text edits (2 edits that change the same span, or invalid replacement text since
        // texts on the node has changed)
        if (importNameInfo.length !== 1 || edits.length !== 1) {
            return false;
        }
        const deletions = this._getDeletionsForSpan(fileUri, edits[0].range);
        if (deletions.length === 0) {
            this.addEdit(fileUri, edits[0].range, edits[0].replacementText);
            return true;
        }
        const lastModuleName = moduleNames[moduleNames.length - 1];
        const newLastModuleName = newModuleNames[newModuleNames.length - 1];
        const alias = importNameInfo[0].alias === newLastModuleName ? lastModuleName : importNameInfo[0].alias;
        const importName = updateOptions.currentFromImport.imports.find((i) => { var _a; return i.name.value === lastModuleName && ((_a = i.alias) === null || _a === void 0 ? void 0 : _a.value) === alias; });
        if (!importName) {
            return false;
        }
        this._removeEdits(fileUri, deletions);
        if (importName.alias) {
            this._nodesRemoved.delete(importName.alias);
        }
        this.addEdit(fileUri, (0, positionUtils_1.convertTextRangeToRange)(importName.name, parseFileResults.tokenizerOutput.lines), newLastModuleName);
        return true;
    }
    _getDeletionsForSpan(fileUriOrEdit, range) {
        const edits = this._getOverlappingForSpan(fileUriOrEdit, range);
        return edits.filter((e) => e.replacementText === '');
    }
    _removeEdits(fileUriOrEdit, edits) {
        var _a;
        if (uri_1.Uri.is(fileUriOrEdit)) {
            fileUriOrEdit = (_a = this._results.get(fileUriOrEdit.key)) !== null && _a !== void 0 ? _a : [];
        }
        (0, collectionUtils_1.removeArrayElements)(fileUriOrEdit, (f) => edits.some((e) => editAction_1.FileEditAction.areEqual(f, e)));
    }
    _getEditsToMerge(edits, range, replacementText) {
        const overlappingEdits = this._getOverlappingForSpan(edits, range);
        if (this._mergeOnlyDuplications && overlappingEdits.length > 0) {
            // Merge duplicated deletion. For deletion, we can even merge edits
            // intersecting each other.
            if (replacementText === '') {
                return overlappingEdits.filter((e) => e.replacementText === '');
            }
            // Merge duplicated edits as long as one of them contains the other.
            return overlappingEdits.filter((e) => e.replacementText === replacementText &&
                ((0, textRange_1.doesRangeContain)(range, e.range) || (0, textRange_1.doesRangeContain)(e.range, range)));
        }
        // We are allowed to merge more than exact duplication. If the existing edit
        // is deletion or duplicated text with containing ranges, merge them to 1.
        return overlappingEdits.filter((e) => e.replacementText === '' ||
            (e.replacementText === replacementText &&
                ((0, textRange_1.doesRangeContain)(range, e.range) || (0, textRange_1.doesRangeContain)(e.range, range))));
    }
    _getOverlappingForSpan(fileUriOrEdit, range) {
        var _a;
        if (uri_1.Uri.is(fileUriOrEdit)) {
            fileUriOrEdit = (_a = this._results.get(fileUriOrEdit.key)) !== null && _a !== void 0 ? _a : [];
        }
        return fileUriOrEdit.filter((e) => (0, textRange_1.doRangesIntersect)(e.range, range));
    }
    _processNodeRemoved(token) {
        while (this._pendingNodeToRemove.length > 0) {
            const numberOfNodesBeforeProcessing = this._pendingNodeToRemove.length;
            const peekNodeToRemove = this._pendingNodeToRemove[this._pendingNodeToRemove.length - 1];
            this._handleImportNameNode(peekNodeToRemove, token);
            if (this._pendingNodeToRemove.length === numberOfNodesBeforeProcessing) {
                // It looks like we don't know how to handle the node,
                // Please add code to handle the case.
                debug.assert(`please add handler for ${peekNodeToRemove.node.nodeType}`);
                // As a default behavior, we will just remove the node
                this._pendingNodeToRemove.pop();
                const info = (0, analyzerNodeInfo_1.getFileInfo)(peekNodeToRemove.parseFileResults.parserOutput.parseTree);
                this.addEdit(info.fileUri, (0, positionUtils_1.convertTextRangeToRange)(peekNodeToRemove.node, info.lines), '');
            }
        }
    }
    _handleImportNameNode(nodeToRemove, token) {
        const node = nodeToRemove.node;
        if (node.nodeType !== 38 /* ParseNodeType.Name */) {
            return false;
        }
        const module = nodeToRemove.parseFileResults.parserOutput.parseTree;
        const info = (0, analyzerNodeInfo_1.getFileInfo)(module);
        const importNode = (0, importStatementUtils_1.getContainingImportStatement)(ParseTreeUtils.findNodeByOffset(module, node.start), token);
        if (!importNode) {
            return false;
        }
        const nameNodes = (0, importStatementUtils_1.getAllImportNames)(importNode);
        // check various different cases
        // 1. check whether all imported names in the import statement is not used.
        const nodesRemoved = this._pendingNodeToRemove.filter((nodeToRemove) => nameNodes.some((n) => textRange_1.TextRange.overlapsRange(nodeToRemove.node, n)));
        if (nameNodes.length === nodesRemoved.length) {
            this.addEdit(info.fileUri, ParseTreeUtils.getFullStatementRange(importNode, nodeToRemove.parseFileResults), '');
            // Remove nodes that are handled from queue.
            this._removeNodesHandled(nodesRemoved);
            return true;
        }
        // 2. some of modules in the import statement is used.
        const indices = [];
        for (let i = 0; i < nameNodes.length; i++) {
            const nameNode = nameNodes[i];
            if (nodesRemoved.some((r) => textRange_1.TextRange.overlapsRange(r.node, nameNode))) {
                indices.push(i);
            }
        }
        if (indices.length === 0) {
            // can't find module user wants to remove
            return false;
        }
        const editSpans = (0, importStatementUtils_1.getTextRangeForImportNameDeletion)(nodeToRemove.parseFileResults, nameNodes, ...indices);
        editSpans.forEach((e) => this.addEdit(info.fileUri, (0, positionUtils_1.convertTextRangeToRange)(e, info.lines), ''));
        this._removeNodesHandled(nodesRemoved);
        return true;
    }
    _removeNodesHandled(nodesRemoved) {
        nodesRemoved.forEach((n) => this._markNodeRemoved(n.node, n.parseFileResults));
        (0, collectionUtils_1.removeArrayElements)(this._pendingNodeToRemove, (n) => this._nodesRemoved.has(n.node));
    }
    _markNodeRemoved(nodeToDelete, parseFileResults) {
        // Mark that we don't need to process these node again later.
        this._nodesRemoved.set(nodeToDelete, parseFileResults);
        if (nodeToDelete.nodeType === 24 /* ParseNodeType.ImportAs */) {
            this._nodesRemoved.set(nodeToDelete.module, parseFileResults);
            nodeToDelete.module.nameParts.forEach((n) => this._nodesRemoved.set(n, parseFileResults));
            if (nodeToDelete.alias) {
                this._nodesRemoved.set(nodeToDelete.alias, parseFileResults);
            }
        }
        else if (nodeToDelete.nodeType === 26 /* ParseNodeType.ImportFromAs */) {
            this._nodesRemoved.set(nodeToDelete.name, parseFileResults);
            if (nodeToDelete.alias) {
                this._nodesRemoved.set(nodeToDelete.alias, parseFileResults);
            }
        }
    }
}
exports.TextEditTracker = TextEditTracker;
//# sourceMappingURL=textEditTracker.js.map