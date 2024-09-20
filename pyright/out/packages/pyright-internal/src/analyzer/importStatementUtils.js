"use strict";
/*
 * importStatementUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility routines for summarizing and manipulating
 * import statements in a Python source file.
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
exports.haveSameParentModule = exports.getResolvedFilePath = exports.getDirectoryLeadingDotsPointsTo = exports.getRelativeModuleName = exports.getTextRangeForImportNameDeletion = exports.getImportGroupFromModuleNameAndType = exports.getAllImportNames = exports.getContainingImportStatement = exports.getTextEditsForAutoImportInsertion = exports.getTextEditsForAutoImportInsertions = exports.getTextEditsForAutoImportSymbolAddition = exports.getTopLevelImports = exports.compareImportStatements = exports.getImportGroup = void 0;
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const positionUtils_1 = require("../common/positionUtils");
const stringUtils_1 = require("../common/stringUtils");
const textRange_1 = require("../common/textRange");
const uri_1 = require("../common/uri/uri");
const uriUtils_1 = require("../common/uri/uriUtils");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const parseTreeUtils_1 = require("./parseTreeUtils");
const SymbolNameUtils = __importStar(require("./symbolNameUtils"));
// Determines which import grouping should be used when sorting imports.
function getImportGroup(statement) {
    if (statement.importResult) {
        if (statement.importResult.importType === 0 /* ImportType.BuiltIn */) {
            return 0 /* ImportGroup.BuiltIn */;
        }
        else if (statement.importResult.importType === 1 /* ImportType.ThirdParty */ ||
            statement.importResult.isLocalTypingsFile) {
            return 1 /* ImportGroup.ThirdParty */;
        }
        if (statement.importResult.isRelative) {
            return 3 /* ImportGroup.LocalRelative */;
        }
        return 2 /* ImportGroup.Local */;
    }
    else {
        return 2 /* ImportGroup.Local */;
    }
}
exports.getImportGroup = getImportGroup;
// Compares sort order of two import statements.
function compareImportStatements(a, b) {
    const aImportGroup = getImportGroup(a);
    const bImportGroup = getImportGroup(b);
    if (aImportGroup < bImportGroup) {
        return -1;
    }
    else if (aImportGroup > bImportGroup) {
        return 1;
    }
    return a.moduleName < b.moduleName ? -1 : 1;
}
exports.compareImportStatements = compareImportStatements;
// Looks for top-level 'import' and 'import from' statements and provides
// an ordered list and a map (by file path).
function getTopLevelImports(parseTree, includeImplicitImports = false) {
    const localImports = {
        orderedImports: [],
        mapByFilePath: new Map(),
    };
    let followsNonImportStatement = false;
    let foundFirstImportStatement = false;
    parseTree.statements.forEach((statement) => {
        if (statement.nodeType === 47 /* ParseNodeType.StatementList */) {
            statement.statements.forEach((subStatement) => {
                if (subStatement.nodeType === 23 /* ParseNodeType.Import */) {
                    foundFirstImportStatement = true;
                    _processImportNode(subStatement, localImports, followsNonImportStatement);
                    followsNonImportStatement = false;
                }
                else if (subStatement.nodeType === 25 /* ParseNodeType.ImportFrom */) {
                    foundFirstImportStatement = true;
                    _processImportFromNode(subStatement, localImports, followsNonImportStatement, includeImplicitImports);
                    followsNonImportStatement = false;
                }
                else {
                    followsNonImportStatement = foundFirstImportStatement;
                }
            });
        }
        else {
            followsNonImportStatement = foundFirstImportStatement;
        }
    });
    return localImports;
}
exports.getTopLevelImports = getTopLevelImports;
// Return import symbol type to allow sorting similar to isort
// CONSTANT_VARIABLE, CamelCaseClass, variable_or_function
function _getImportSymbolNameType(symbolName) {
    if (SymbolNameUtils.isConstantName(symbolName)) {
        return 0;
    }
    if (SymbolNameUtils.isTypeAliasName(symbolName)) {
        return 1;
    }
    return 2;
}
function getTextEditsForAutoImportSymbolAddition(importNameInfo, importStatement, parseFileResults) {
    const additionEdits = [];
    if (!importStatement.node ||
        importStatement.node.nodeType !== 25 /* ParseNodeType.ImportFrom */ ||
        importStatement.node.isWildcardImport) {
        return additionEdits;
    }
    // Make sure we're not attempting to auto-import a symbol that
    // already exists in the import list.
    const importFrom = importStatement.node;
    importNameInfo = (Array.isArray(importNameInfo) ? importNameInfo : [importNameInfo]).filter((info) => !!info.name &&
        !importFrom.imports.some((importAs) => { var _a; return importAs.name.value === info.name && ((_a = importAs.alias) === null || _a === void 0 ? void 0 : _a.value) === info.alias; }));
    if (importNameInfo.length === 0) {
        return additionEdits;
    }
    for (const nameInfo of importNameInfo) {
        additionEdits.push(_getTextEditsForAutoImportSymbolAddition(nameInfo.name, nameInfo.alias, importStatement.node, parseFileResults));
    }
    // Merge edits with the same insertion point.
    const editsMap = (0, collectionUtils_1.createMapFromItems)(additionEdits, (e) => textRange_1.Range.print(e.range));
    const textEditList = [];
    for (const editGroup of editsMap.values()) {
        if (editGroup.length === 1) {
            textEditList.push(editGroup[0]);
        }
        else {
            textEditList.push({
                range: editGroup[0].range,
                replacementText: editGroup
                    .sort((a, b) => _compareImportNames(a.importName, b.importName))
                    .map((e) => e.replacementText)
                    .join(''),
            });
        }
    }
    return textEditList;
}
exports.getTextEditsForAutoImportSymbolAddition = getTextEditsForAutoImportSymbolAddition;
function _compareImportNames(name1, name2) {
    // Compare import name by import symbol type and then alphabetical order.
    // Match isort default behavior.
    const name1Type = _getImportSymbolNameType(name1);
    const name2Type = _getImportSymbolNameType(name2);
    const compare = name1Type - name2Type;
    if (compare !== 0) {
        return compare;
    }
    // isort will prefer '_' over alphanumerical chars
    // This can't be reproduced by a normal string compare in TypeScript, since '_' > 'A'.
    // Replace all '_' with '=' which guarantees '=' < 'A'.
    // Safe to do as '=' is an invalid char in Python names.
    const name1toCompare = name1.replace(/_/g, '=');
    const name2toCompare = name2.replace(/_/g, '=');
    return (0, stringUtils_1.compareStringsCaseSensitive)(name1toCompare, name2toCompare);
}
function _getTextEditsForAutoImportSymbolAddition(importName, alias, node, parseFileResults) {
    // Scan through the import symbols to find the right insertion point,
    // assuming we want to keep the imports alphabetized.
    let priorImport;
    for (const curImport of node.imports) {
        if (_compareImportNames(curImport.name.value, importName) > 0) {
            break;
        }
        priorImport = curImport;
    }
    // Are import symbols formatted one per line or multiple per line? We
    // will honor the existing formatting. We'll use a heuristic to determine
    // whether symbols are one per line or multiple per line.
    //   from x import a, b, c
    // or
    //   from x import (
    //      a
    //   )
    let useOnePerLineFormatting = false;
    let indentText = '';
    if (node.imports.length > 0) {
        const importStatementPos = (0, positionUtils_1.convertOffsetToPosition)(node.start, parseFileResults.tokenizerOutput.lines);
        const firstSymbolPos = (0, positionUtils_1.convertOffsetToPosition)(node.imports[0].start, parseFileResults.tokenizerOutput.lines);
        const secondSymbolPos = node.imports.length > 1
            ? (0, positionUtils_1.convertOffsetToPosition)(node.imports[1].start, parseFileResults.tokenizerOutput.lines)
            : undefined;
        if (firstSymbolPos.line > importStatementPos.line &&
            (secondSymbolPos === undefined || secondSymbolPos.line > firstSymbolPos.line)) {
            const firstSymbolLineRange = parseFileResults.tokenizerOutput.lines.getItemAt(firstSymbolPos.line);
            // Use the same combination of spaces or tabs to match
            // existing formatting.
            indentText = parseFileResults.text.substr(firstSymbolLineRange.start, firstSymbolPos.character);
            // Is the indent text composed of whitespace only?
            if (/^\s*$/.test(indentText)) {
                useOnePerLineFormatting = true;
            }
        }
    }
    const insertionOffset = priorImport
        ? textRange_1.TextRange.getEnd(priorImport)
        : node.imports.length > 0
            ? node.imports[0].start
            : node.start + node.length;
    const insertionPosition = (0, positionUtils_1.convertOffsetToPosition)(insertionOffset, parseFileResults.tokenizerOutput.lines);
    const insertText = alias ? `${importName} as ${alias}` : `${importName}`;
    let replacementText;
    if (useOnePerLineFormatting) {
        const eol = parseFileResults.tokenizerOutput.predominantEndOfLineSequence;
        replacementText = priorImport ? `,${eol}${indentText}${insertText}` : `${insertText},${eol}${indentText}`;
    }
    else {
        replacementText = priorImport ? `, ${insertText}` : `${insertText}, `;
    }
    return {
        range: { start: insertionPosition, end: insertionPosition },
        importName,
        replacementText,
    };
}
function getTextEditsForAutoImportInsertions(importNameInfo, importStatements, parseFileResults, invocationPosition) {
    const insertionEdits = [];
    importNameInfo = Array.isArray(importNameInfo) ? importNameInfo : [importNameInfo];
    if (importNameInfo.length === 0) {
        return [];
    }
    const map = (0, collectionUtils_1.createMapFromItems)(importNameInfo, (i) => { var _a; return `${i.module.moduleName}-${(_a = i.nameForImportFrom) !== null && _a !== void 0 ? _a : ''}`; });
    for (const importInfo of map.values()) {
        (0, collectionUtils_1.appendArray)(insertionEdits, _getInsertionEditsForAutoImportInsertion(importInfo, { name: importInfo[0].module.moduleName, nameForImportFrom: importInfo[0].nameForImportFrom }, importStatements, getImportGroupFromModuleNameAndType(importInfo[0].module), parseFileResults, invocationPosition));
    }
    return _convertInsertionEditsToTextEdits(parseFileResults, insertionEdits);
}
exports.getTextEditsForAutoImportInsertions = getTextEditsForAutoImportInsertions;
function getTextEditsForAutoImportInsertion(importNameInfo, moduleNameInfo, importStatements, importGroup, parseFileResults, invocationPosition) {
    const insertionEdits = _getInsertionEditsForAutoImportInsertion(importNameInfo, moduleNameInfo, importStatements, importGroup, parseFileResults, invocationPosition);
    return _convertInsertionEditsToTextEdits(parseFileResults, insertionEdits);
}
exports.getTextEditsForAutoImportInsertion = getTextEditsForAutoImportInsertion;
function _convertInsertionEditsToTextEdits(parseFileResults, insertionEdits) {
    if (insertionEdits.length < 2) {
        return insertionEdits.map((e) => getTextEdit(e));
    }
    // Merge edits with the same insertion point.
    const editsMap = [...(0, collectionUtils_1.createMapFromItems)(insertionEdits, (e) => `${e.importGroup} ${textRange_1.Range.print(e.range)}`)]
        .sort((a, b) => (0, stringUtils_1.compareStringsCaseSensitive)(a[0], b[0]))
        .map((v) => v[1]);
    const textEditList = [];
    for (const editGroup of editsMap) {
        if (editGroup.length === 1) {
            textEditList.push(getTextEdit(editGroup[0]));
        }
        else {
            textEditList.push({
                range: editGroup[0].range,
                replacementText: editGroup[0].preChange +
                    editGroup
                        .map((e) => e.importStatement)
                        .sort((a, b) => compareImports(a, b))
                        .join(parseFileResults.tokenizerOutput.predominantEndOfLineSequence) +
                    editGroup[0].postChange,
            });
        }
    }
    return textEditList;
    function getTextEdit(edit) {
        return { range: edit.range, replacementText: edit.preChange + edit.importStatement + edit.postChange };
    }
    function compareImports(a, b) {
        const isImport1 = a.startsWith('import');
        const isImport2 = b.startsWith('import');
        if (isImport1 === isImport2) {
            return a < b ? -1 : 1;
        }
        return isImport1 ? -1 : 1;
    }
}
function _getInsertionEditsForAutoImportInsertion(importNameInfo, moduleNameInfo, importStatements, importGroup, parseFileResults, invocationPosition) {
    const insertionEdits = [];
    importNameInfo = Array.isArray(importNameInfo) ? importNameInfo : [importNameInfo];
    if (importNameInfo.length === 0) {
        // This will let "import [moduleName]" to be generated.
        importNameInfo.push({});
    }
    // We need to emit a new 'from import' statement if symbolName is given. otherwise, use 'import' statement.
    const map = (0, collectionUtils_1.createMapFromItems)(importNameInfo, (i) => (i.name ? 'from' : 'import'));
    // Add import statements first.
    const imports = map.get('import');
    if (imports) {
        appendToEdits(imports, (names) => `import ${names.join(', ')}`);
    }
    // Add from import statements next.
    const fromImports = map.get('from');
    if (fromImports) {
        appendToEdits(fromImports, (names) => { var _a; return `from ${(_a = moduleNameInfo.nameForImportFrom) !== null && _a !== void 0 ? _a : moduleNameInfo.name} import ${names.join(', ')}`; });
    }
    return insertionEdits;
    function getImportAsText(nameInfo, moduleName) {
        const importText = nameInfo.name ? nameInfo.name : moduleName;
        return {
            sortText: importText,
            text: nameInfo.alias ? `${importText} as ${nameInfo.alias}` : importText,
        };
    }
    function appendToEdits(importNameInfo, importStatementGetter) {
        const importNames = importNameInfo
            .map((i) => getImportAsText(i, moduleNameInfo.name))
            .sort((a, b) => _compareImportNames(a.sortText, b.sortText))
            .reduce((set, v) => (0, collectionUtils_1.addIfUnique)(set, v.text), []);
        insertionEdits.push(_getInsertionEditForAutoImportInsertion(importStatementGetter(importNames), importStatements, moduleNameInfo.name, importGroup, parseFileResults, invocationPosition));
    }
}
function _getInsertionEditForAutoImportInsertion(importStatement, importStatements, moduleName, importGroup, parseFileResults, invocationPosition) {
    let preChange = '';
    let postChange = '';
    let insertionPosition;
    const invocation = (0, positionUtils_1.convertPositionToOffset)(invocationPosition, parseFileResults.tokenizerOutput.lines);
    if (importStatements.orderedImports.length > 0 && invocation > importStatements.orderedImports[0].node.start) {
        let insertBefore = true;
        let insertionImport = importStatements.orderedImports[0];
        // Find a good spot to insert the new import statement. Follow
        // the PEP8 standard sorting order whereby built-in imports are
        // followed by third-party, which are followed by local.
        let prevImportGroup = 0 /* ImportGroup.BuiltIn */;
        for (const curImport of importStatements.orderedImports) {
            // If the import was resolved, use its import type. If it wasn't
            // resolved, assume that it's the same import type as the previous
            // one.
            const curImportGroup = curImport.importResult ? getImportGroup(curImport) : prevImportGroup;
            if (importGroup < curImportGroup) {
                if (!insertBefore && prevImportGroup < importGroup) {
                    // Add an extra line to create a new group.
                    preChange = parseFileResults.tokenizerOutput.predominantEndOfLineSequence + preChange;
                }
                break;
            }
            if (importGroup === curImportGroup && curImport.moduleName > moduleName) {
                insertBefore = true;
                insertionImport = curImport;
                break;
            }
            // If we're about to hit the end of the import statements, don't go
            // any further.
            if (curImport.followsNonImportStatement) {
                if (importGroup > prevImportGroup) {
                    // Add an extra line to create a new group.
                    preChange = parseFileResults.tokenizerOutput.predominantEndOfLineSequence + preChange;
                }
                break;
            }
            // If this is the last import, see if we need to create a new group.
            if (curImport === importStatements.orderedImports[importStatements.orderedImports.length - 1]) {
                if (importGroup > curImportGroup) {
                    // Add an extra line to create a new group.
                    preChange = parseFileResults.tokenizerOutput.predominantEndOfLineSequence + preChange;
                }
            }
            // Are we starting a new group?
            if (!insertBefore && importGroup < prevImportGroup && importGroup === curImportGroup) {
                insertBefore = true;
            }
            else {
                insertBefore = false;
            }
            prevImportGroup = curImportGroup;
            insertionImport = curImport;
        }
        if (insertionImport) {
            if (insertBefore) {
                postChange = postChange + parseFileResults.tokenizerOutput.predominantEndOfLineSequence;
            }
            else {
                preChange = parseFileResults.tokenizerOutput.predominantEndOfLineSequence + preChange;
            }
            insertionPosition = (0, positionUtils_1.convertOffsetToPosition)(insertBefore ? insertionImport.node.start : textRange_1.TextRange.getEnd(insertionImport.node), parseFileResults.tokenizerOutput.lines);
        }
        else {
            insertionPosition = { line: 0, character: 0 };
        }
    }
    else {
        // Insert at or near the top of the file. See if there's a doc string and
        // copyright notice, etc. at the top. If so, move past those.
        insertionPosition = { line: 0, character: 0 };
        let addNewLineBefore = false;
        for (const statement of parseFileResults.parserOutput.parseTree.statements) {
            let stopHere = true;
            if (statement.nodeType === 47 /* ParseNodeType.StatementList */ && statement.statements.length === 1) {
                const simpleStatement = statement.statements[0];
                if (simpleStatement.nodeType === 48 /* ParseNodeType.StringList */) {
                    // Assume that it's a file header doc string.
                    stopHere = false;
                }
                else if (simpleStatement.nodeType === 3 /* ParseNodeType.Assignment */) {
                    if (simpleStatement.leftExpression.nodeType === 38 /* ParseNodeType.Name */) {
                        if (SymbolNameUtils.isDunderName(simpleStatement.leftExpression.value)) {
                            // Assume that it's an assignment of __copyright__, __author__, etc.
                            stopHere = false;
                        }
                    }
                }
            }
            if (stopHere) {
                insertionPosition = (0, positionUtils_1.convertOffsetToPosition)(statement.start, parseFileResults.tokenizerOutput.lines);
                addNewLineBefore = false;
                break;
            }
            else {
                insertionPosition = (0, positionUtils_1.convertOffsetToPosition)(statement.start + statement.length, parseFileResults.tokenizerOutput.lines);
                addNewLineBefore = true;
            }
        }
        postChange =
            postChange +
                parseFileResults.tokenizerOutput.predominantEndOfLineSequence +
                parseFileResults.tokenizerOutput.predominantEndOfLineSequence;
        if (addNewLineBefore) {
            preChange = parseFileResults.tokenizerOutput.predominantEndOfLineSequence + preChange;
        }
        else {
            postChange = postChange + parseFileResults.tokenizerOutput.predominantEndOfLineSequence;
        }
    }
    const range = { start: insertionPosition, end: insertionPosition };
    return { range, preChange, importStatement, postChange, importGroup };
}
function _processImportNode(node, localImports, followsNonImportStatement) {
    node.list.forEach((importAsNode) => {
        const importResult = AnalyzerNodeInfo.getImportInfo(importAsNode.module);
        let resolvedPath;
        if (importResult && importResult.isImportFound) {
            resolvedPath = importResult.resolvedUris[importResult.resolvedUris.length - 1];
        }
        const localImport = {
            node,
            subnode: importAsNode,
            importResult,
            resolvedPath,
            moduleName: _formatModuleName(importAsNode.module),
            followsNonImportStatement,
        };
        localImports.orderedImports.push(localImport);
        // Add it to the map.
        if (resolvedPath && !resolvedPath.isEmpty()) {
            // Don't overwrite existing import or import from statements
            // because we always want to prefer 'import from' over 'import'
            // in the map.
            if (!localImports.mapByFilePath.has(resolvedPath.key)) {
                localImports.mapByFilePath.set(resolvedPath.key, localImport);
            }
        }
    });
}
function _processImportFromNode(node, localImports, followsNonImportStatement, includeImplicitImports) {
    var _a;
    const importResult = AnalyzerNodeInfo.getImportInfo(node.module);
    let resolvedPath;
    if (importResult && importResult.isImportFound) {
        resolvedPath = importResult.resolvedUris[importResult.resolvedUris.length - 1];
    }
    if (includeImplicitImports && importResult) {
        localImports.implicitImports = (_a = localImports.implicitImports) !== null && _a !== void 0 ? _a : new Map();
        for (const implicitImport of importResult.implicitImports.values()) {
            const importFromAs = node.imports.find((i) => i.name.value === implicitImport.name);
            if (importFromAs) {
                localImports.implicitImports.set(implicitImport.uri.key, importFromAs);
            }
        }
    }
    const localImport = {
        node,
        importResult,
        resolvedPath,
        moduleName: _formatModuleName(node.module),
        followsNonImportStatement,
    };
    localImports.orderedImports.push(localImport);
    // Add it to the map.
    if (resolvedPath && !resolvedPath.isEmpty()) {
        const prevEntry = localImports.mapByFilePath.get(resolvedPath.key);
        // Overwrite existing import statements because we always want to prefer
        // 'import from' over 'import'. Also, overwrite existing 'import from' if
        // the module name is shorter.
        if (!prevEntry ||
            prevEntry.node.nodeType === 23 /* ParseNodeType.Import */ ||
            prevEntry.moduleName.length > localImport.moduleName.length) {
            localImports.mapByFilePath.set(resolvedPath.key, localImport);
        }
    }
}
function _formatModuleName(node) {
    let moduleName = '';
    for (let i = 0; i < node.leadingDots; i++) {
        moduleName = moduleName + '.';
    }
    moduleName += node.nameParts.map((part) => part.value).join('.');
    return moduleName;
}
function getContainingImportStatement(node, token) {
    while (node) {
        (0, cancellationUtils_1.throwIfCancellationRequested)(token);
        if (node.nodeType === 23 /* ParseNodeType.Import */ || node.nodeType === 25 /* ParseNodeType.ImportFrom */) {
            break;
        }
        node = node.parent;
    }
    return node;
}
exports.getContainingImportStatement = getContainingImportStatement;
function getAllImportNames(node) {
    if (node.nodeType === 23 /* ParseNodeType.Import */) {
        const importNode = node;
        return importNode.list;
    }
    const importFromNode = node;
    return importFromNode.imports;
}
exports.getAllImportNames = getAllImportNames;
function getImportGroupFromModuleNameAndType(moduleNameAndType) {
    let importGroup = 2 /* ImportGroup.Local */;
    if (moduleNameAndType.isLocalTypingsFile || moduleNameAndType.importType === 1 /* ImportType.ThirdParty */) {
        importGroup = 1 /* ImportGroup.ThirdParty */;
    }
    else if (moduleNameAndType.importType === 0 /* ImportType.BuiltIn */) {
        importGroup = 0 /* ImportGroup.BuiltIn */;
    }
    return importGroup;
}
exports.getImportGroupFromModuleNameAndType = getImportGroupFromModuleNameAndType;
function getTextRangeForImportNameDeletion(parseFileResults, nameNodes, ...nameNodeIndexToDelete) {
    const editSpans = [];
    for (const pair of getConsecutiveNumberPairs(nameNodeIndexToDelete)) {
        const startNode = nameNodes[pair.start];
        const endNode = nameNodes[pair.end];
        if (pair.start === 0 && nameNodes.length === pair.end + 1) {
            // get span of whole statement. ex) "import [|A|]" or "import [|A, B|]"
            editSpans.push(textRange_1.TextRange.fromBounds(startNode.start, textRange_1.TextRange.getEnd(endNode)));
        }
        else if (pair.end === nameNodes.length - 1) {
            // get span of "import A[|, B|]" or "import A[|, B, C|]"
            const previousNode = nameNodes[pair.start - 1];
            editSpans.push(...getEditsPreservingFirstCommentAfterCommaIfExist(parseFileResults, previousNode, startNode, endNode));
        }
        else {
            // get span of "import [|A, |]B" or "import [|A, B,|] C"
            const start = startNode.start;
            const length = nameNodes[pair.end + 1].start - start;
            editSpans.push({ start, length });
        }
    }
    return editSpans;
}
exports.getTextRangeForImportNameDeletion = getTextRangeForImportNameDeletion;
function getEditsPreservingFirstCommentAfterCommaIfExist(parseFileResults, previousNode, startNode, endNode) {
    const offsetOfPreviousNodeEnd = textRange_1.TextRange.getEnd(previousNode);
    const startingToken = (0, parseTreeUtils_1.getTokenAt)(parseFileResults.tokenizerOutput.tokens, startNode.start);
    if (!startingToken || !startingToken.comments || startingToken.comments.length === 0) {
        const length = textRange_1.TextRange.getEnd(endNode) - offsetOfPreviousNodeEnd;
        return [{ start: offsetOfPreviousNodeEnd, length }];
    }
    const commaToken = (0, parseTreeUtils_1.findTokenAfter)(parseFileResults.tokenizerOutput, textRange_1.TextRange.getEnd(previousNode), (t) => t.type === 12 /* TokenType.Comma */);
    if (!commaToken) {
        const length = textRange_1.TextRange.getEnd(endNode) - offsetOfPreviousNodeEnd;
        return [{ start: offsetOfPreviousNodeEnd, length }];
    }
    // We have code something like
    //  previousNode, #comment
    //  startNode,
    //  endNode
    //
    // Make sure we preserve #comment when deleting start/end nodes so we have
    //  previousNode #comment
    // as final result.
    const lengthToComma = textRange_1.TextRange.getEnd(commaToken) - offsetOfPreviousNodeEnd;
    const offsetToCommentEnd = textRange_1.TextRange.getEnd(startingToken.comments[startingToken.comments.length - 1]);
    const length = textRange_1.TextRange.getEnd(endNode) - offsetToCommentEnd;
    return [
        { start: offsetOfPreviousNodeEnd, length: lengthToComma },
        { start: offsetToCommentEnd, length },
    ];
}
function getConsecutiveNumberPairs(indices) {
    if (indices.length === 0) {
        return [];
    }
    if (indices.length === 1) {
        return [{ start: indices[0], end: indices[0] }];
    }
    const pairs = [];
    let start = indices[0];
    let current = start;
    for (const index of indices) {
        if (current === index) {
            continue;
        }
        if (current + 1 === index) {
            current = index;
            continue;
        }
        pairs.push({ start, end: current });
        start = index;
        current = index;
    }
    pairs.push({ start, end: current });
    return pairs;
}
function getRelativeModuleName(fs, sourcePath, targetPath, configOptions, ignoreFolderStructure = false, sourceIsFile) {
    let srcPath = sourcePath;
    sourceIsFile = sourceIsFile !== undefined ? sourceIsFile : (0, uriUtils_1.isFile)(fs, sourcePath);
    if (sourceIsFile) {
        srcPath = sourcePath.getDirectory();
    }
    let symbolName;
    let destPath = targetPath;
    if ((configOptions.stubPath && destPath.isChild(configOptions.stubPath)) ||
        (configOptions.typeshedPath && destPath.isChild(configOptions.typeshedPath))) {
        // Always use absolute imports for files in these library-like directories.
        return undefined;
    }
    if (sourceIsFile) {
        destPath = targetPath.getDirectory();
        const fileName = targetPath.stripAllExtensions().fileName;
        if (fileName !== '__init__') {
            // ex) src: a.py, dest: b.py -> ".b" will be returned.
            symbolName = fileName;
        }
        else if (ignoreFolderStructure) {
            // ex) src: nested1/nested2/__init__.py, dest: nested1/__init__.py -> "...nested1" will be returned
            //     like how it would return for sibling folder.
            //
            // if folder structure is not ignored, ".." will be returned
            symbolName = destPath.fileName;
            destPath = destPath.getDirectory();
        }
    }
    const relativePaths = srcPath.getRelativePathComponents(destPath);
    // This assumes both file paths are under the same importing root.
    // So this doesn't handle paths pointing to 2 different import roots.
    // ex) user file A to library file B
    let currentPaths = '.';
    for (let i = 0; i < relativePaths.length; i++) {
        const relativePath = relativePaths[i];
        if (relativePath === '..') {
            currentPaths += '.';
        }
        else {
            currentPaths += relativePath;
        }
        if (relativePath !== '..' && i !== relativePaths.length - 1) {
            currentPaths += '.';
        }
    }
    if (symbolName) {
        currentPaths =
            currentPaths[currentPaths.length - 1] === '.' ? currentPaths + symbolName : currentPaths + '.' + symbolName;
    }
    return currentPaths;
}
exports.getRelativeModuleName = getRelativeModuleName;
function getDirectoryLeadingDotsPointsTo(fromDirectory, leadingDots) {
    let currentDirectory = fromDirectory;
    for (let i = 1; i < leadingDots; i++) {
        if (currentDirectory.isRoot()) {
            return undefined;
        }
        currentDirectory = currentDirectory.getDirectory();
    }
    return currentDirectory;
}
exports.getDirectoryLeadingDotsPointsTo = getDirectoryLeadingDotsPointsTo;
function getResolvedFilePath(importResult) {
    if (!importResult || !importResult.isImportFound || importResult.resolvedUris.length === 0) {
        return undefined;
    }
    if (importResult.resolvedUris.length === 1 && importResult.resolvedUris[0].equals(uri_1.Uri.empty())) {
        // Import is resolved to namespace package folder.
        if (importResult.packageDirectory) {
            return importResult.packageDirectory;
        }
        // Absolute import is partially resolved from the path.
        if (importResult.searchPath) {
            return importResult.searchPath;
        }
        return undefined;
    }
    // Regular case.
    return importResult.resolvedUris[importResult.resolvedUris.length - 1];
}
exports.getResolvedFilePath = getResolvedFilePath;
function haveSameParentModule(module1, module2) {
    if (module1.length !== module2.length) {
        return false;
    }
    let i = 0;
    for (i = 0; i < module1.length - 1; i++) {
        if (module1[i] !== module2[i]) {
            break;
        }
    }
    return i === module1.length - 1;
}
exports.haveSameParentModule = haveSameParentModule;
//# sourceMappingURL=importStatementUtils.js.map