"use strict";
/*
 * importSorter.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides code that sorts and formats import statements within a
 * Python source file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportSorter = void 0;
const importStatementUtils_1 = require("../analyzer/importStatementUtils");
const cancellationUtils_1 = require("../common/cancellationUtils");
const positionUtils_1 = require("../common/positionUtils");
const textRange_1 = require("../common/textRange");
// We choose a line length that matches the default for the popular
// "black" formatter used in many Python projects.
const _maxLineLength = 88;
class ImportSorter {
    constructor(_parseResults, _cancellationToken) {
        this._parseResults = _parseResults;
        this._cancellationToken = _cancellationToken;
    }
    sort() {
        (0, cancellationUtils_1.throwIfCancellationRequested)(this._cancellationToken);
        const actions = [];
        const importStatements = (0, importStatementUtils_1.getTopLevelImports)(this._parseResults.parserOutput.parseTree);
        const sortedStatements = importStatements.orderedImports
            .map((s) => s)
            .sort((a, b) => {
            return (0, importStatementUtils_1.compareImportStatements)(a, b);
        });
        if (sortedStatements.length === 0) {
            // Nothing to do.
            return [];
        }
        const primaryRange = this._getPrimaryReplacementRange(importStatements.orderedImports);
        actions.push({
            range: primaryRange,
            replacementText: this._generateSortedImportText(sortedStatements),
        });
        this._addSecondaryReplacementRanges(importStatements.orderedImports, actions);
        return actions;
    }
    // Determines the text range for the existing primary block of import statements.
    // If there are other blocks of import statements separated by other statements,
    // we'll ignore these other blocks for now.
    _getPrimaryReplacementRange(statements) {
        let statementLimit = statements.findIndex((s) => s.followsNonImportStatement);
        if (statementLimit < 0) {
            statementLimit = statements.length;
        }
        const lastStatement = statements[statementLimit - 1].node;
        return {
            start: (0, positionUtils_1.convertOffsetToPosition)(statements[0].node.start, this._parseResults.tokenizerOutput.lines),
            end: (0, positionUtils_1.convertOffsetToPosition)(textRange_1.TextRange.getEnd(lastStatement), this._parseResults.tokenizerOutput.lines),
        };
    }
    // If import statements are separated by other statements, we will remove the old
    // secondary blocks.
    _addSecondaryReplacementRanges(statements, actions) {
        let secondaryBlockStart = statements.findIndex((s) => s.followsNonImportStatement);
        if (secondaryBlockStart < 0) {
            return;
        }
        while (true) {
            let secondaryBlockLimit = statements.findIndex((s, index) => index > secondaryBlockStart && s.followsNonImportStatement);
            if (secondaryBlockLimit < 0) {
                secondaryBlockLimit = statements.length;
            }
            actions.push({
                range: {
                    start: (0, positionUtils_1.convertOffsetToPosition)(statements[secondaryBlockStart].node.start, this._parseResults.tokenizerOutput.lines),
                    end: (0, positionUtils_1.convertOffsetToPosition)(textRange_1.TextRange.getEnd(statements[secondaryBlockLimit - 1].node), this._parseResults.tokenizerOutput.lines),
                },
                replacementText: '',
            });
            secondaryBlockStart = secondaryBlockLimit;
            if (secondaryBlockStart >= statements.length) {
                break;
            }
        }
    }
    _generateSortedImportText(sortedStatements) {
        let importText = '';
        let prevImportGroup = (0, importStatementUtils_1.getImportGroup)(sortedStatements[0]);
        for (const statement of sortedStatements) {
            // Insert a blank space between import type groups.
            const curImportType = (0, importStatementUtils_1.getImportGroup)(statement);
            if (prevImportGroup !== curImportType) {
                importText += this._parseResults.tokenizerOutput.predominantEndOfLineSequence;
                prevImportGroup = curImportType;
            }
            let importLine;
            if (statement.node.nodeType === 23 /* ParseNodeType.Import */) {
                importLine = this._formatImportNode(statement.subnode, statement.moduleName);
            }
            else {
                importLine = this._formatImportFromNode(statement.node, statement.moduleName);
            }
            // If this isn't the last statement, add a newline.
            if (statement !== sortedStatements[sortedStatements.length - 1]) {
                importLine += this._parseResults.tokenizerOutput.predominantEndOfLineSequence;
            }
            importText += importLine;
        }
        return importText;
    }
    _formatImportNode(subnode, moduleName) {
        let importText = `import ${moduleName}`;
        if (subnode.alias) {
            importText += ` as ${subnode.alias.value}`;
        }
        return importText;
    }
    _formatImportFromNode(node, moduleName) {
        const symbols = node.imports
            .sort((a, b) => this._compareSymbols(a, b))
            .map((symbol) => {
            let symbolText = symbol.name.value;
            if (symbol.alias) {
                symbolText += ` as ${symbol.alias.value}`;
            }
            return symbolText;
        });
        let cumulativeText = `from ${moduleName} import `;
        if (node.isWildcardImport) {
            return cumulativeText + '*';
        }
        const symbolText = symbols.join(', ');
        if (cumulativeText.length + symbolText.length <= _maxLineLength) {
            return cumulativeText + symbolText;
        }
        // We need to split across multiple lines with parens.
        cumulativeText += '(' + this._parseResults.tokenizerOutput.predominantEndOfLineSequence;
        for (const symbol of symbols) {
            cumulativeText +=
                this._parseResults.tokenizerOutput.predominantTabSequence +
                    symbol +
                    ',' +
                    this._parseResults.tokenizerOutput.predominantEndOfLineSequence;
        }
        cumulativeText += ')';
        return cumulativeText;
    }
    _compareSymbols(a, b) {
        return a.name.value < b.name.value ? -1 : 1;
    }
}
exports.ImportSorter = ImportSorter;
//# sourceMappingURL=importSorter.js.map