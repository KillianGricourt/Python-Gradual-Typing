"use strict";
/*
 * sourceFileInfoUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Functions that operate on SourceFileInfo objects.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChainedByList = exports.verifyNoCyclesInChainedFiles = exports.collectImportedByCells = exports.isUserCode = void 0;
const debug_1 = require("../common/debug");
const serviceKeys_1 = require("../common/serviceKeys");
const sourceFile_1 = require("./sourceFile");
function isUserCode(fileInfo) {
    return !!fileInfo && fileInfo.isTracked && !fileInfo.isThirdPartyImport && !fileInfo.isTypeshedFile;
}
exports.isUserCode = isUserCode;
function collectImportedByCells(program, fileInfo) {
    // The ImportedBy only works when files are parsed. Due to the lazy-loading nature of our system,
    // we can't ensure that all files within the program are parsed, which might lead to an incomplete dependency graph.
    // Parsing all regular files goes against our lazy-nature, but for notebook cells, which we open by default,
    // it makes sense to force complete parsing since they'll be parsed at some point anyway due to things like
    // `semantic tokens` or `checkers`.
    _parseAllOpenCells(program);
    const importedByCells = new Set();
    _collectImportedByCells(fileInfo, importedByCells);
    return importedByCells;
}
exports.collectImportedByCells = collectImportedByCells;
function verifyNoCyclesInChainedFiles(program, fileInfo) {
    var _a, _b;
    let nextChainedFile = fileInfo.chainedSourceFile;
    if (!nextChainedFile) {
        return;
    }
    const set = new Set([fileInfo.sourceFile.getUri().key]);
    while (nextChainedFile) {
        const path = nextChainedFile.sourceFile.getUri().key;
        if (set.has(path)) {
            // We found a cycle.
            (0, debug_1.fail)((_b = (_a = program.serviceProvider
                .tryGet(serviceKeys_1.ServiceKeys.debugInfoInspector)) === null || _a === void 0 ? void 0 : _a.getCycleDetail(program, nextChainedFile)) !== null && _b !== void 0 ? _b : `Found a cycle in implicit imports files for ${path}`);
        }
        set.add(path);
        nextChainedFile = nextChainedFile.chainedSourceFile;
    }
}
exports.verifyNoCyclesInChainedFiles = verifyNoCyclesInChainedFiles;
function createChainedByList(program, fileInfo) {
    var _a, _b;
    // We want to create reverse map of all chained files.
    const map = new Map();
    for (const file of program.getSourceFileInfoList()) {
        if (!file.chainedSourceFile) {
            continue;
        }
        map.set(file.chainedSourceFile, file);
    }
    const visited = new Set();
    const chainedByList = [fileInfo];
    let current = fileInfo;
    while (current) {
        if (visited.has(current)) {
            (0, debug_1.fail)((_b = (_a = program.serviceProvider.tryGet(serviceKeys_1.ServiceKeys.debugInfoInspector)) === null || _a === void 0 ? void 0 : _a.getCycleDetail(program, current)) !== null && _b !== void 0 ? _b : 'detected a cycle in chained files');
        }
        visited.add(current);
        current = map.get(current);
        if (current) {
            chainedByList.push(current);
        }
    }
    return chainedByList;
}
exports.createChainedByList = createChainedByList;
function _parseAllOpenCells(program) {
    for (const file of program.getSourceFileInfoList()) {
        if (file.sourceFile.getIPythonMode() !== sourceFile_1.IPythonMode.CellDocs) {
            continue;
        }
        program.getParserOutput(file.sourceFile.getUri());
        program.handleMemoryHighUsage();
    }
}
function _collectImportedByCells(fileInfo, importedByCells) {
    fileInfo.importedBy.forEach((dep) => {
        if (importedByCells.has(dep)) {
            // Already visited.
            return;
        }
        importedByCells.add(dep);
        _collectImportedByCells(dep, importedByCells);
    });
}
//# sourceMappingURL=sourceFileInfoUtils.js.map