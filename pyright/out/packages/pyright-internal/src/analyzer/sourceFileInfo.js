"use strict";
/*
 * sourceFileInfo.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Class that represents information around single source file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SourceFileInfo = void 0;
// Tracks information about each source file in a program,
// including the reason it was added to the program and any
// dependencies that it has on other files in the program.
class SourceFileInfo {
    constructor(sourceFile, isTypeshedFile, isThirdPartyImport, isThirdPartyPyTypedPresent, _editModeTracker, args = {}) {
        this.sourceFile = sourceFile;
        this.isTypeshedFile = isTypeshedFile;
        this.isThirdPartyImport = isThirdPartyImport;
        this.isThirdPartyPyTypedPresent = isThirdPartyPyTypedPresent;
        this._editModeTracker = _editModeTracker;
        this.isCreatedInEditMode = this._editModeTracker.isEditMode;
        this._writableData = this._createWriteableData(args);
        this._cachePreEditState();
    }
    get diagnosticsVersion() {
        return this._writableData.diagnosticsVersion;
    }
    get builtinsImport() {
        return this._writableData.builtinsImport;
    }
    // Information about the chained source file
    // Chained source file is not supposed to exist on file system but
    // must exist in the program's source file list. Module level
    // scope of the chained source file will be inserted before
    // current file's scope.
    get chainedSourceFile() {
        return this._writableData.chainedSourceFile;
    }
    get effectiveFutureImports() {
        return this._writableData.effectiveFutureImports;
    }
    // Information about why the file is included in the program
    // and its relation to other source files in the program.
    get isTracked() {
        return this._writableData.isTracked;
    }
    get isOpenByClient() {
        return this._writableData.isOpenByClient;
    }
    get imports() {
        return this._writableData.imports;
    }
    get importedBy() {
        return this._writableData.importedBy;
    }
    get shadows() {
        return this._writableData.shadows;
    }
    get shadowedBy() {
        return this._writableData.shadowedBy;
    }
    set diagnosticsVersion(value) {
        this._cachePreEditState();
        this._writableData.diagnosticsVersion = value;
    }
    set builtinsImport(value) {
        this._cachePreEditState();
        this._writableData.builtinsImport = value;
    }
    set chainedSourceFile(value) {
        this._cachePreEditState();
        this._writableData.chainedSourceFile = value;
    }
    set effectiveFutureImports(value) {
        this._cachePreEditState();
        this._writableData.effectiveFutureImports = value;
    }
    set isTracked(value) {
        this._cachePreEditState();
        this._writableData.isTracked = value;
    }
    set isOpenByClient(value) {
        this._cachePreEditState();
        this._writableData.isOpenByClient = value;
    }
    mutate(callback) {
        this._cachePreEditState();
        callback(this._writableData);
    }
    restore() {
        if (this._preEditData) {
            this._writableData = this._preEditData;
            this._preEditData = undefined;
            // Some states have changed. Force some of info to be re-calculated.
            this.sourceFile.dropParseAndBindInfo();
        }
        return this.sourceFile.restore();
    }
    _cachePreEditState() {
        if (!this._editModeTracker.isEditMode || this._preEditData) {
            return;
        }
        this._preEditData = this._writableData;
        this._writableData = this._cloneWriteableData(this._writableData);
        this._editModeTracker.addMutatedFiles(this);
    }
    _createWriteableData(args) {
        var _a, _b;
        return {
            isTracked: (_a = args.isTracked) !== null && _a !== void 0 ? _a : false,
            isOpenByClient: (_b = args.isOpenByClient) !== null && _b !== void 0 ? _b : false,
            builtinsImport: args.builtinsImport,
            chainedSourceFile: args.chainedSourceFile,
            diagnosticsVersion: args.diagnosticsVersion,
            effectiveFutureImports: args.effectiveFutureImports,
            imports: [],
            importedBy: [],
            shadows: [],
            shadowedBy: [],
        };
    }
    _cloneWriteableData(data) {
        return {
            isTracked: data.isTracked,
            isOpenByClient: data.isOpenByClient,
            builtinsImport: data.builtinsImport,
            chainedSourceFile: data.chainedSourceFile,
            diagnosticsVersion: data.diagnosticsVersion,
            effectiveFutureImports: data.effectiveFutureImports,
            imports: data.imports.slice(),
            importedBy: data.importedBy.slice(),
            shadows: data.shadows.slice(),
            shadowedBy: data.shadowedBy.slice(),
        };
    }
}
exports.SourceFileInfo = SourceFileInfo;
//# sourceMappingURL=sourceFileInfo.js.map