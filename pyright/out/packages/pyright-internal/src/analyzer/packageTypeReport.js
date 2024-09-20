"use strict";
/*
 * packageTypeReport.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Encapsulates the output of the package type verifier,
 * storing information about the public symbols and whether
 * they have known types.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmptyReport = exports.SymbolCategory = void 0;
var SymbolCategory;
(function (SymbolCategory) {
    SymbolCategory[SymbolCategory["Indeterminate"] = 0] = "Indeterminate";
    SymbolCategory[SymbolCategory["Module"] = 1] = "Module";
    SymbolCategory[SymbolCategory["Class"] = 2] = "Class";
    SymbolCategory[SymbolCategory["Variable"] = 3] = "Variable";
    SymbolCategory[SymbolCategory["Constant"] = 4] = "Constant";
    SymbolCategory[SymbolCategory["Function"] = 5] = "Function";
    SymbolCategory[SymbolCategory["Method"] = 6] = "Method";
    SymbolCategory[SymbolCategory["TypeVar"] = 7] = "TypeVar";
    SymbolCategory[SymbolCategory["TypeAlias"] = 8] = "TypeAlias";
})(SymbolCategory || (exports.SymbolCategory = SymbolCategory = {}));
function getEmptyReport(packageName, packageRootUri, moduleName, moduleRootUri, isModuleSingleFile, ignoreExternal) {
    const report = {
        packageName,
        ignoreExternal,
        packageRootDirectoryUri: packageRootUri,
        moduleName,
        moduleRootDirectoryUri: moduleRootUri,
        isModuleSingleFile,
        pyTypedPathUri: undefined,
        missingFunctionDocStringCount: 0,
        missingClassDocStringCount: 0,
        missingDefaultParamCount: 0,
        alternateSymbolNames: new Map(),
        modules: new Map(),
        generalDiagnostics: [],
        symbols: new Map(),
    };
    return report;
}
exports.getEmptyReport = getEmptyReport;
//# sourceMappingURL=packageTypeReport.js.map