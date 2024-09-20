"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNodeAtMarker = exports.getNodeForRange = exports.parseAndGetTestState = exports.TestState = void 0;
/*
 * testState.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * TestState wraps currently test states and provides a way to query and manipulate
 * the test states.
 */
const assert_1 = __importDefault(require("assert"));
const path = __importStar(require("path"));
const vscode_languageserver_1 = require("vscode-languageserver");
const backgroundAnalysisProgram_1 = require("../../../analyzer/backgroundAnalysisProgram");
const packageTypeVerifier_1 = require("../../../analyzer/packageTypeVerifier");
const parseTreeUtils_1 = require("../../../analyzer/parseTreeUtils");
const service_1 = require("../../../analyzer/service");
const commandResult_1 = require("../../../commands/commandResult");
const commandLineOptions_1 = require("../../../common/commandLineOptions");
const configOptions_1 = require("../../../common/configOptions");
const console_1 = require("../../../common/console");
const core_1 = require("../../../common/core");
const debug = __importStar(require("../../../common/debug"));
const pathUtils_1 = require("../../../common/pathUtils");
const positionUtils_1 = require("../../../common/positionUtils");
const serviceProviderExtensions_1 = require("../../../common/serviceProviderExtensions");
const stringUtils_1 = require("../../../common/stringUtils");
const textRange_1 = require("../../../common/textRange");
const uri_1 = require("../../../common/uri/uri");
const uriUtils_1 = require("../../../common/uri/uriUtils");
const workspaceEditUtils_1 = require("../../../common/workspaceEditUtils");
const callHierarchyProvider_1 = require("../../../languageService/callHierarchyProvider");
const completionProvider_1 = require("../../../languageService/completionProvider");
const definitionProvider_1 = require("../../../languageService/definitionProvider");
const documentHighlightProvider_1 = require("../../../languageService/documentHighlightProvider");
const hoverProvider_1 = require("../../../languageService/hoverProvider");
const navigationUtils_1 = require("../../../languageService/navigationUtils");
const referencesProvider_1 = require("../../../languageService/referencesProvider");
const renameProvider_1 = require("../../../languageService/renameProvider");
const signatureHelpProvider_1 = require("../../../languageService/signatureHelpProvider");
const tokenizer_1 = require("../../../parser/tokenizer");
const pyrightFileSystem_1 = require("../../../pyrightFileSystem");
const workspaceFactory_1 = require("../../../workspaceFactory");
const testAccessHost_1 = require("../testAccessHost");
const host = __importStar(require("../testHost"));
const utils_1 = require("../utils");
const factory_1 = require("../vfs/factory");
const vfs = __importStar(require("../vfs/filesystem"));
const fourSlashParser_1 = require("./fourSlashParser");
const fourSlashTypes_1 = require("./fourSlashTypes");
const testLanguageService_1 = require("./testLanguageService");
const testStateUtils_1 = require("./testStateUtils");
const workspaceEditTestUtils_1 = require("./workspaceEditTestUtils");
const docStringService_1 = require("../../../common/docStringService");
// Make sure everything is in lower case since it has hard coded `isCaseSensitive`: true.
const testAccessHost = new testAccessHost_1.TestAccessHost(uriUtils_1.UriEx.file(vfs.MODULE_PATH), [factory_1.libFolder, factory_1.distlibFolder]);
class TestState {
    constructor(projectRoot, testData, mountPaths, hostSpecificFeatures, testFS, 
    // Setting delayFileInitialization to true enables derived class constructors to execute
    // before any files are opened. When set to true, initializeFiles() must be called separately
    // after construction completes.
    delayFileInitialization = false) {
        this.testData = testData;
        this.files = [];
        // The current caret position in the active file
        this.currentCaretPosition = 0;
        // The position of the end of the current selection, or -1 if nothing is selected
        this.selectionEnd = -1;
        this.lastKnownMarker = '';
        const vfsInfo = (0, testStateUtils_1.createVfsInfoFromFourSlashData)(projectRoot, testData);
        this._vfsFiles = vfsInfo.files;
        this.testFS =
            testFS !== null && testFS !== void 0 ? testFS : (0, factory_1.createFromFileSystem)(host.HOST, vfsInfo.ignoreCase, { cwd: vfsInfo.projectRoot, files: vfsInfo.files, meta: testData.globalOptions }, mountPaths);
        this.fs = new pyrightFileSystem_1.PyrightFileSystem(this.testFS);
        this.console = new console_1.ConsoleWithLogLevel(new console_1.NullConsole(), 'test');
        this.serviceProvider = (0, serviceProviderExtensions_1.createServiceProvider)(this.testFS, this.fs, this.console);
        this._cancellationToken = new fourSlashTypes_1.TestCancellationToken();
        this._hostSpecificFeatures = hostSpecificFeatures !== null && hostSpecificFeatures !== void 0 ? hostSpecificFeatures : new testLanguageService_1.TestFeatures();
        this.files = vfsInfo.sourceFileNames;
        this.rawConfigJson = vfsInfo.rawConfigJson;
        const configOptions = this._convertGlobalOptionsToConfigOptions(vfsInfo.projectRoot, mountPaths);
        if (this.rawConfigJson) {
            configOptions.initializeTypeCheckingMode('standard');
            configOptions.initializeFromJson(this.rawConfigJson, uri_1.Uri.file(projectRoot, this.serviceProvider), this.serviceProvider, testAccessHost);
            this._applyTestConfigOptions(configOptions);
        }
        const service = this._createAnalysisService(this.console, this._hostSpecificFeatures.importResolverFactory, this._hostSpecificFeatures.backgroundAnalysisProgramFactory, configOptions);
        this.workspace = {
            workspaceName: 'test workspace',
            rootUri: uri_1.Uri.file(vfsInfo.projectRoot, this.serviceProvider),
            pythonPath: undefined,
            pythonPathKind: workspaceFactory_1.WorkspacePythonPathKind.Mutable,
            kinds: [workspaceFactory_1.WellKnownWorkspaceKinds.Test],
            service: service,
            disableLanguageServices: false,
            disableTaggedHints: false,
            disableOrganizeImports: false,
            disableWorkspaceSymbol: false,
            isInitialized: (0, workspaceFactory_1.createInitStatus)(),
            searchPathsToWatch: [],
            pythonEnvironmentName: undefined,
        };
        const indexer = (0, core_1.toBoolean)(testData.globalOptions["indexer" /* GlobalMetadataOptionNames.indexer */]);
        const indexerWithoutStdLib = (0, core_1.toBoolean)(testData.globalOptions["indexerwithoutstdlib" /* GlobalMetadataOptionNames.indexerWithoutStdLib */]);
        if (indexer || indexerWithoutStdLib) {
            const indexerOptions = testData.globalOptions["indexeroptions" /* GlobalMetadataOptionNames.indexerOptions */];
            configOptions.indexing = true;
            this._hostSpecificFeatures.runIndexer(this.workspace, indexerWithoutStdLib, indexerOptions);
        }
        if (!delayFileInitialization) {
            this.initializeFiles();
        }
    }
    get importResolver() {
        return this.workspace.service.getImportResolver();
    }
    get configOptions() {
        return this.workspace.service.getConfigOptions();
    }
    get program() {
        return this.workspace.service.test_program;
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    get BOF() {
        return 0;
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    get EOF() {
        return this.getFileContent(this.activeFile.fileName).length;
    }
    initializeFiles() {
        var _a, _b;
        if (this.files.length > 0) {
            // Open the first file by default
            this.openFile(this.files[0]);
        }
        for (const filePath of this.files) {
            const file = this._vfsFiles[filePath];
            if ((_a = file.meta) === null || _a === void 0 ? void 0 : _a["ipythonmode" /* MetadataOptionNames.ipythonMode */]) {
                (_b = this.program.getSourceFile(uri_1.Uri.file(filePath, this.serviceProvider))) === null || _b === void 0 ? void 0 : _b.test_enableIPythonMode(true);
            }
        }
    }
    dispose() {
        this.workspace.service.dispose();
    }
    cwd() {
        return this.testFS.cwd();
    }
    // Entry points from fourslash.ts
    goToMarker(nameOrMarker = '') {
        const marker = (0, core_1.isString)(nameOrMarker) ? this.getMarkerByName(nameOrMarker) : nameOrMarker;
        if (this.activeFile.fileName !== marker.fileName) {
            this.openFile(marker.fileName);
        }
        const content = this.getFileContent(marker.fileName);
        if (marker.position === -1 || marker.position > content.length) {
            throw new Error(`Marker "${nameOrMarker}" has been invalidated by unrecoverable edits to the file.`);
        }
        const mName = (0, core_1.isString)(nameOrMarker) ? nameOrMarker : this.getMarkerName(marker);
        this.lastKnownMarker = mName;
        this.goToPosition(marker.position);
    }
    goToEachMarker(markers, action) {
        assert_1.default.ok(markers.length > 0);
        for (let i = 0; i < markers.length; i++) {
            this.goToMarker(markers[i]);
            action(markers[i], i);
        }
    }
    getMappedFilePath(path) {
        const uri = uri_1.Uri.file(path, this.serviceProvider);
        this.importResolver.ensurePartialStubPackages(this.configOptions.findExecEnvironment(uri));
        return this.fs.getMappedUri(uri).getFilePath();
    }
    getMarkerName(m) {
        return (0, testStateUtils_1.getMarkerName)(this.testData, m);
    }
    getMarkerByName(markerName) {
        return (0, testStateUtils_1.getMarkerByName)(this.testData, markerName);
    }
    getMarkers() {
        //  Return a copy of the list
        return this.testData.markers.slice(0);
    }
    getMarkerNames() {
        return (0, testStateUtils_1.getMarkerNames)(this.testData);
    }
    getPositionRange(markerString) {
        const marker = this.getMarkerByName(markerString);
        const ranges = this.getRanges().filter((r) => r.marker === marker);
        if (ranges.length !== 1) {
            this.raiseError(`no matching range for ${markerString}`);
        }
        const range = ranges[0];
        return this.convertPositionRange(range);
    }
    getPosition(markerString) {
        const marker = this.getMarkerByName(markerString);
        const ranges = this.getRanges().filter((r) => r.marker === marker);
        if (ranges.length !== 1) {
            this.raiseError(`no matching range for ${markerString}`);
        }
        return this.convertOffsetToPosition(marker.fileName, marker.position);
    }
    expandPositionRange(range, start, end) {
        return {
            start: { line: range.start.line, character: range.start.character - start },
            end: { line: range.end.line, character: range.end.character + end },
        };
    }
    convertPositionRange(range) {
        return this.convertOffsetsToRange(range.fileName, range.pos, range.end);
    }
    getPathSep() {
        return path.sep;
    }
    goToPosition(positionOrLineAndColumn) {
        const pos = (0, core_1.isNumber)(positionOrLineAndColumn)
            ? positionOrLineAndColumn
            : this.convertPositionToOffset(this.activeFile.fileName, positionOrLineAndColumn);
        this.currentCaretPosition = pos;
        this.selectionEnd = -1;
    }
    select(startMarker, endMarker) {
        const start = this.getMarkerByName(startMarker);
        const end = this.getMarkerByName(endMarker);
        assert_1.default.ok(start.fileName === end.fileName);
        if (this.activeFile.fileName !== start.fileName) {
            this.openFile(start.fileName);
        }
        this.goToPosition(start.position);
        this.selectionEnd = end.position;
    }
    selectAllInFile(fileName) {
        this.openFile(fileName);
        this.goToPosition(0);
        this.selectionEnd = this.activeFile.content.length;
    }
    selectRange(range) {
        this.goToRangeStart(range);
        this.selectionEnd = range.end;
    }
    selectLine(index) {
        const lineStart = this.convertPositionToOffset(this.activeFile.fileName, { line: index, character: 0 });
        const lineEnd = lineStart + this._getLineContent(index).length;
        this.selectRange({
            fileName: this.activeFile.fileName,
            fileUri: this.activeFile.fileUri,
            pos: lineStart,
            end: lineEnd,
        });
    }
    goToEachRange(action) {
        const ranges = this.getRanges();
        assert_1.default.ok(ranges.length > 0);
        for (const range of ranges) {
            this.selectRange(range);
            action(range);
        }
    }
    goToRangeStart({ fileName, pos }) {
        this.openFile(fileName);
        this.goToPosition(pos);
    }
    getRanges() {
        return this.testData.ranges;
    }
    getRangesInFile(fileName = this.activeFile.fileName) {
        return this.getRanges().filter((r) => r.fileName === fileName);
    }
    getRangesByText() {
        if (this.testData.rangesByText) {
            return this.testData.rangesByText;
        }
        const result = this.createMultiMap(this.getRanges(), (r) => this.rangeText(r));
        this.testData.rangesByText = result;
        return result;
    }
    getFilteredRanges(predicate) {
        return this.getRanges().filter((r) => { var _a; return predicate(r.marker, (_a = r.marker) === null || _a === void 0 ? void 0 : _a.data, this.rangeText(r)); });
    }
    getRangeByMarkerName(markerName) {
        const marker = this.getMarkerByName(markerName);
        return this.getRanges().find((r) => r.marker === marker);
    }
    goToBOF() {
        this.goToPosition(this.BOF);
    }
    goToEOF() {
        this.goToPosition(this.EOF);
    }
    moveCaretRight(count = 1) {
        this.currentCaretPosition += count;
        this.currentCaretPosition = Math.min(this.currentCaretPosition, this.getFileContent(this.activeFile.fileName).length);
        this.selectionEnd = -1;
    }
    // Opens a file given its 0-based index or fileName
    openFile(indexOrName) {
        const fileToOpen = this.findFile(indexOrName);
        fileToOpen.fileName = (0, pathUtils_1.normalizeSlashes)(fileToOpen.fileName);
        this.activeFile = fileToOpen;
        this.program.setFileOpened(this.activeFile.fileUri, 1, fileToOpen.content);
        return fileToOpen;
    }
    openFiles(indexOrNames) {
        for (const indexOrName of indexOrNames) {
            this.openFile(indexOrName);
        }
    }
    printCurrentFileState(showWhitespace, makeCaretVisible) {
        for (const file of this.testData.files) {
            const active = this.activeFile === file;
            host.HOST.log(`=== Script (${file.fileName}) ${active ? '(active, cursor at |)' : ''} ===`);
            let content = this.getFileContent(file.fileName);
            if (active) {
                content =
                    content.substr(0, this.currentCaretPosition) +
                        (makeCaretVisible ? '|' : '') +
                        content.substr(this.currentCaretPosition);
            }
            if (showWhitespace) {
                content = this._makeWhitespaceVisible(content);
            }
            host.HOST.log(content);
        }
    }
    deleteChar(count = 1) {
        const offset = this.currentCaretPosition;
        const ch = '';
        const checkCadence = (count >> 2) + 1;
        for (let i = 0; i < count; i++) {
            this._editScriptAndUpdateMarkers(this.activeFile.fileName, offset, offset + 1, ch);
            if (i % checkCadence === 0) {
                this._checkPostEditInvariants();
            }
        }
        this._checkPostEditInvariants();
    }
    replace(start, length, text) {
        this._editScriptAndUpdateMarkers(this.activeFile.fileName, start, start + length, text);
        this._checkPostEditInvariants();
    }
    deleteLineRange(startIndex, endIndexInclusive) {
        const startPos = this.convertPositionToOffset(this.activeFile.fileName, { line: startIndex, character: 0 });
        const endPos = this.convertPositionToOffset(this.activeFile.fileName, {
            line: endIndexInclusive + 1,
            character: 0,
        });
        this.replace(startPos, endPos - startPos, '');
    }
    deleteCharBehindMarker(count = 1) {
        let offset = this.currentCaretPosition;
        const ch = '';
        const checkCadence = (count >> 2) + 1;
        for (let i = 0; i < count; i++) {
            this.currentCaretPosition--;
            offset--;
            this._editScriptAndUpdateMarkers(this.activeFile.fileName, offset, offset + 1, ch);
            if (i % checkCadence === 0) {
                this._checkPostEditInvariants();
            }
            // Don't need to examine formatting because there are no formatting changes on backspace.
        }
        this._checkPostEditInvariants();
    }
    // Enters lines of text at the current caret position
    type(text) {
        let offset = this.currentCaretPosition;
        const selection = this._getSelection();
        this.replace(selection.start, selection.length, '');
        for (let i = 0; i < text.length; i++) {
            const ch = text.charAt(i);
            this._editScriptAndUpdateMarkers(this.activeFile.fileName, offset, offset, ch);
            this.currentCaretPosition++;
            offset++;
        }
        this._checkPostEditInvariants();
    }
    // Enters text as if the user had pasted it
    paste(text) {
        this._editScriptAndUpdateMarkers(this.activeFile.fileName, this.currentCaretPosition, this.currentCaretPosition, text);
        this._checkPostEditInvariants();
    }
    verifyDiagnostics(map) {
        this.analyze();
        // organize things per file
        const resultPerFile = this._getDiagnosticsPerFile();
        const rangePerFile = this.createMultiMap(this.getRanges(), (r) => r.fileName);
        if (!hasDiagnostics(resultPerFile) && rangePerFile.size === 0) {
            // no errors and no error is expected. we are done
            return;
        }
        for (const [file, ranges] of rangePerFile.entries()) {
            const rangesPerCategory = this.createMultiMap(ranges, (r) => {
                if (map) {
                    const name = this.getMarkerName(r.marker);
                    return map[name].category;
                }
                return r.marker.data.category;
            });
            if (!rangesPerCategory.has('error')) {
                rangesPerCategory.set('error', []);
            }
            if (!rangesPerCategory.has('warning')) {
                rangesPerCategory.set('warning', []);
            }
            if (!rangesPerCategory.has('information')) {
                rangesPerCategory.set('information', []);
            }
            const result = resultPerFile.get(file);
            resultPerFile.delete(file);
            for (const [category, expected] of rangesPerCategory.entries()) {
                const lines = result.parseResults.tokenizerOutput.lines;
                const actual = category === 'error'
                    ? result.errors
                    : category === 'warning'
                        ? result.warnings
                        : category === 'information'
                            ? result.information
                            : category === 'unused'
                                ? result.unused
                                : category === 'none'
                                    ? []
                                    : this.raiseError(`unexpected category ${category}`);
                if (expected.length !== actual.length && category !== 'none') {
                    this.raiseError(`contains unexpected result - expected: ${(0, utils_1.stringify)(expected)}, actual: ${(0, utils_1.stringify)(actual)}`);
                }
                for (const range of expected) {
                    const rangeSpan = textRange_1.TextRange.fromBounds(range.pos, range.end);
                    const matches = actual.filter((d) => {
                        const diagnosticSpan = textRange_1.TextRange.fromBounds((0, positionUtils_1.convertPositionToOffset)(d.range.start, lines), (0, positionUtils_1.convertPositionToOffset)(d.range.end, lines));
                        return this._deepEqual(diagnosticSpan, rangeSpan);
                    });
                    // If the map is provided, it might say
                    // a marker should have none.
                    const name = map ? this.getMarkerName(range.marker) : '';
                    const message = map ? map[name].message : undefined;
                    const expectMatches = !!message;
                    if (expectMatches && matches.length === 0) {
                        this.raiseError(`doesn't contain expected range: ${(0, utils_1.stringify)(range)}`);
                    }
                    else if (!expectMatches && matches.length !== 0) {
                        this.raiseError(`${name} should not contain any matches`);
                    }
                    // if map is provided, check message as well
                    if (message) {
                        if (matches.filter((d) => message === d.message).length !== 1) {
                            this.raiseError(`message doesn't match: ${message} of ${name} - ${(0, utils_1.stringify)(range)}, actual: ${(0, utils_1.stringify)(matches)}`);
                        }
                    }
                }
            }
        }
        if (hasDiagnostics(resultPerFile)) {
            this.raiseError(`these diagnostics were unexpected: ${(0, utils_1.stringify)(resultPerFile)}`);
        }
        function hasDiagnostics(resultPerFile) {
            for (const entry of resultPerFile.values()) {
                if (entry.errors.length + entry.warnings.length > 0) {
                    return true;
                }
            }
            return false;
        }
    }
    async verifyCodeActions(verifyMode, map) {
        // make sure we don't use cache built from other tests
        this.workspace.service.invalidateAndForceReanalysis(backgroundAnalysisProgram_1.InvalidatedReason.Reanalyzed);
        this.analyze();
        // Local copy to use in capture.
        const serviceProvider = this.serviceProvider;
        for (const range of this.getRanges()) {
            const name = this.getMarkerName(range.marker);
            if (!map[name]) {
                continue;
            }
            const codeActions = await this._getCodeActions(range);
            if (verifyMode === 'exact') {
                if (codeActions.length !== map[name].codeActions.length) {
                    this.raiseError(`doesn't contain expected result: ${(0, utils_1.stringify)(map[name])}, actual: ${(0, utils_1.stringify)(codeActions)}`);
                }
            }
            for (const expected of map[name].codeActions) {
                let expectedCommand;
                if (expected.command) {
                    expectedCommand = {
                        title: expected.command.title,
                        command: expected.command.command,
                        arguments: convertToString(expected.command.arguments),
                    };
                }
                const matches = codeActions.filter((a) => {
                    const actualCommand = a.command
                        ? {
                            title: a.command.title,
                            command: a.command.command,
                            arguments: convertToString(a.command.arguments),
                        }
                        : undefined;
                    const actualEdit = a.edit;
                    return (a.title === expected.title &&
                        a.kind === expected.kind &&
                        (expectedCommand ? this._deepEqual(actualCommand, expectedCommand) : true) &&
                        (expected.edit ? this._deepEqual(actualEdit, expected.edit) : true));
                });
                if (verifyMode === 'excluded' && matches.length > 0) {
                    this.raiseError(`unexpected result: ${(0, utils_1.stringify)(map[name])}`);
                }
                else if (verifyMode !== 'excluded' && matches.length !== 1) {
                    this.raiseError(`doesn't contain expected result: ${(0, utils_1.stringify)(expected)}, actual: ${(0, utils_1.stringify)(codeActions)}`);
                }
            }
        }
        function convertToString(args) {
            if (args) {
                // Trim `undefined` from the args.
                while (args.length > 0) {
                    if (args[args.length - 1] === undefined) {
                        args.pop();
                    }
                    else {
                        break;
                    }
                }
            }
            return args === null || args === void 0 ? void 0 : args.map((a) => {
                if ((0, core_1.isString)(a)) {
                    // Might be a URI. For comparison purposes in a test, convert it into a
                    // file path.
                    if (a.startsWith('file://')) {
                        return (0, pathUtils_1.normalizeSlashes)(uri_1.Uri.parse(a, serviceProvider).getFilePath());
                    }
                    return (0, pathUtils_1.normalizeSlashes)(a);
                }
                return JSON.stringify(a);
            });
        }
    }
    async verifyCommand(command, files) {
        var _a;
        this.analyze();
        // Convert command arguments to file Uri strings. That's the expected input for command arguments.
        const convertedArgs = (_a = command.arguments) === null || _a === void 0 ? void 0 : _a.map((arg) => {
            if (typeof arg === 'string' && (arg.endsWith('.py') || arg.endsWith('.pyi'))) {
                return uri_1.Uri.file(arg, this.serviceProvider).toString();
            }
            return arg;
        });
        command.arguments = convertedArgs;
        const commandResult = await this._hostSpecificFeatures.execute(new testLanguageService_1.TestLanguageService(this.workspace, this.console, this.fs), { command: command.command, arguments: command.arguments || [] }, vscode_languageserver_1.CancellationToken.None);
        if (command.command === 'pyright.createtypestub') {
            await this._verifyFiles(files);
        }
        else if (command.command === 'pyright.organizeimports') {
            // Organize imports command can be used on only one file at a time,
            // so there is no looping over "commandResult" or "files".
            const workspaceEditResult = commandResult;
            const uri = Object.keys(workspaceEditResult.changes)[0];
            const textEdit = workspaceEditResult.changes[uri][0];
            const actualText = textEdit.newText;
            const expectedText = Object.values(files)[0];
            if (actualText !== expectedText) {
                this.raiseError(`doesn't contain expected result: ${(0, utils_1.stringify)(expectedText)}, actual: ${(0, utils_1.stringify)(actualText)}`);
            }
        }
        return commandResult;
    }
    verifyWorkspaceEdit(expected, actual, marker) {
        return (0, workspaceEditTestUtils_1.verifyWorkspaceEdit)(expected, actual, marker);
    }
    async verifyInvokeCodeAction(map, verifyCodeActionCount) {
        var _a;
        this.analyze();
        for (const range of this.getRanges()) {
            const name = this.getMarkerName(range.marker);
            if (!map[name]) {
                continue;
            }
            const ls = new testLanguageService_1.TestLanguageService(this.workspace, this.console, this.fs);
            const codeActions = await this._getCodeActions(range);
            if (verifyCodeActionCount) {
                if (codeActions.length !== Object.keys(map).length) {
                    this.raiseError(`doesn't contain expected result count: ${(0, utils_1.stringify)(map[name])}, actual: ${(0, utils_1.stringify)(codeActions)}`);
                }
            }
            const matches = codeActions.filter((c) => c.title === map[name].title);
            if (matches.length === 0) {
                this.raiseError(`doesn't contain expected result: ${(0, utils_1.stringify)(map[name])}, actual: ${(0, utils_1.stringify)(codeActions)}`);
            }
            for (const codeAction of matches) {
                const results = await this._hostSpecificFeatures.execute(ls, {
                    command: codeAction.command.command,
                    arguments: ((_a = codeAction.command) === null || _a === void 0 ? void 0 : _a.arguments) || [],
                }, vscode_languageserver_1.CancellationToken.None);
                if (map[name].edits) {
                    const workspaceEdits = commandResult_1.CommandResult.is(results) ? results.edits : results;
                    for (const edits of Object.values(workspaceEdits.changes)) {
                        for (const edit of edits) {
                            if (map[name].edits.filter((e) => this._editsAreEqual(e, edit)).length !== 1) {
                                this.raiseError(`${name} doesn't contain expected result: ${(0, utils_1.stringify)(map[name])}, actual: ${(0, utils_1.stringify)(edits)}`);
                            }
                        }
                    }
                }
            }
            if (map[name].files) {
                await this._verifyFiles(map[name].files);
            }
        }
    }
    verifyHover(kind, map) {
        // Do not force analyze, it can lead to test passing while it doesn't work in product
        for (const range of this.getRanges()) {
            const name = this.getMarkerName(range.marker);
            const expected = map[name];
            if (expected === undefined) {
                continue;
            }
            const rangePos = this.convertOffsetsToRange(range.fileName, range.pos, range.end);
            const provider = new hoverProvider_1.HoverProvider(this.program, range.fileUri, rangePos.start, kind, vscode_languageserver_1.CancellationToken.None);
            const actual = provider.getHover();
            // if expected is null then there should be nothing shown on hover
            if (expected === null) {
                assert_1.default.equal(actual, undefined);
                continue;
            }
            assert_1.default.ok(actual);
            assert_1.default.deepEqual(actual.range, rangePos);
            if (vscode_languageserver_1.MarkupContent.is(actual.contents)) {
                assert_1.default.equal(actual.contents.value, expected);
                assert_1.default.equal(actual.contents.kind, kind);
            }
            else {
                assert_1.default.fail(`Unexpected type of contents object "${actual.contents}", should be MarkupContent.`);
            }
        }
    }
    verifyCaretAtMarker(markerName = '') {
        const pos = this.getMarkerByName(markerName);
        if (pos.fileName !== this.activeFile.fileName) {
            throw new Error(`verifyCaretAtMarker failed - expected to be in file "${pos.fileName}", but was in file "${this.activeFile.fileName}"`);
        }
        if (pos.position !== this.currentCaretPosition) {
            throw new Error(`verifyCaretAtMarker failed - expected to be at marker "/*${markerName}*/, but was at position ${this.currentCaretPosition}(${this._getLineColStringAtPosition(this.currentCaretPosition)})`);
        }
    }
    verifyCurrentLineContent(text) {
        const actual = this._getCurrentLineContent();
        if (actual !== text) {
            throw new Error('verifyCurrentLineContent\n' + this._displayExpectedAndActualString(text, actual, /* quoted */ true));
        }
    }
    verifyCurrentFileContent(text) {
        this._verifyFileContent(this.activeFile.fileName, text);
    }
    verifyTextAtCaretIs(text) {
        const actual = this.getFileContent(this.activeFile.fileName).substring(this.currentCaretPosition, this.currentCaretPosition + text.length);
        if (actual !== text) {
            throw new Error('verifyTextAtCaretIs\n' + this._displayExpectedAndActualString(text, actual, /* quoted */ true));
        }
    }
    verifyRangeIs(expectedText, includeWhiteSpace) {
        this._verifyTextMatches(this.rangeText(this._getOnlyRange()), !!includeWhiteSpace, expectedText);
    }
    async verifyCompletion(verifyMode, docFormat, map, abbrMap) {
        this.analyze();
        for (const marker of this.getMarkers()) {
            const markerName = this.getMarkerName(marker);
            if (!map[markerName]) {
                continue;
            }
            this.lastKnownMarker = markerName;
            const expectedCompletions = map[markerName].completions;
            const provider = this.getCompletionResults(this, marker, docFormat, abbrMap);
            const results = provider.getCompletions();
            if (results) {
                if (verifyMode === 'exact') {
                    if (results.items.length !== expectedCompletions.length) {
                        assert_1.default.fail(`${markerName} - Expected ${expectedCompletions.length} items but received ${results.items.length}. Actual completions:\n${(0, utils_1.stringify)(results.items.map((r) => r.label))}`);
                    }
                }
                for (let i = 0; i < expectedCompletions.length; i++) {
                    const expected = expectedCompletions[i];
                    const actualIndex = results.items.findIndex((a) => a.label === expected.label &&
                        (expected.kind ? a.kind === expected.kind : true) &&
                        (expected.detail ? a.detail === expected.detail : true) &&
                        (expected.documentation && vscode_languageserver_1.MarkupContent.is(a.documentation)
                            ? a.documentation.value === expected.documentation
                            : true));
                    if (actualIndex >= 0) {
                        if (verifyMode === 'excluded') {
                            // we're not supposed to find the completions passed to the test
                            assert_1.default.fail(`${markerName} - Completion item with label "${expected.label}" unexpected. Actual completions:\n${(0, utils_1.stringify)(results.items.map((r) => r.label))}`);
                        }
                        const actual = results.items[actualIndex];
                        if (expected.additionalTextEdits !== undefined) {
                            if (actual.additionalTextEdits === undefined) {
                                provider.resolveCompletionItem(actual);
                            }
                        }
                        this.verifyCompletionItem(expected, actual);
                        if (expected.documentation !== undefined) {
                            if (actual.documentation === undefined && actual.data) {
                                provider.resolveCompletionItem(actual);
                            }
                            if (vscode_languageserver_1.MarkupContent.is(actual.documentation)) {
                                assert_1.default.strictEqual(actual.documentation.value, expected.documentation);
                                assert_1.default.strictEqual(actual.documentation.kind, docFormat);
                            }
                            else {
                                assert_1.default.fail(`${markerName} - Unexpected type of contents object "${actual.documentation}", should be MarkupContent.`);
                            }
                        }
                        results.items.splice(actualIndex, 1);
                    }
                    else {
                        if (verifyMode === 'included' || verifyMode === 'exact') {
                            // we're supposed to find all items passed to the test
                            assert_1.default.fail(`${markerName} - Completion item with label "${expected.label}" expected. Actual completions:\n${(0, utils_1.stringify)(results.items.map((r) => r.label))}`);
                        }
                    }
                }
                if (verifyMode === 'exact') {
                    if (results.items.length !== 0) {
                        // we removed every item we found, there should not be any remaining
                        assert_1.default.fail(`${markerName} - Completion items unexpected: ${(0, utils_1.stringify)(results.items.map((r) => r.label))}`);
                    }
                }
            }
            else {
                if (verifyMode !== 'exact' || expectedCompletions.length > 0) {
                    assert_1.default.fail(`${markerName} - Failed to get completions`);
                }
            }
        }
    }
    verifySignature(docFormat, map) {
        var _a, _b;
        this.analyze();
        for (const marker of this.getMarkers()) {
            const fileName = marker.fileName;
            const name = this.getMarkerName(marker);
            if (!(name in map)) {
                continue;
            }
            const expected = map[name];
            const position = this.convertOffsetToPosition(fileName, marker.position);
            const actual = new signatureHelpProvider_1.SignatureHelpProvider(this.program, uri_1.Uri.file(fileName, this.serviceProvider), position, docFormat, 
            /* hasSignatureLabelOffsetCapability */ true, 
            /* hasActiveParameterCapability */ true, 
            /* context */ undefined, new docStringService_1.PyrightDocStringService(), vscode_languageserver_1.CancellationToken.None).getSignatureHelp();
            if (expected.noSig) {
                assert_1.default.equal(actual, undefined);
                continue;
            }
            assert_1.default.ok(actual);
            assert_1.default.ok(actual.signatures);
            assert_1.default.ok(expected.activeParameters);
            assert_1.default.equal(actual.signatures.length, expected.activeParameters.length);
            actual.signatures.forEach((sig, index) => {
                const expectedSig = expected.signatures[index];
                assert_1.default.equal(sig.label, expectedSig.label);
                assert_1.default.ok(sig.parameters);
                const actualParameters = [];
                sig.parameters.forEach((p) => {
                    actualParameters.push((0, core_1.isString)(p.label) ? p.label : sig.label.substring(p.label[0], p.label[1]));
                });
                assert_1.default.deepEqual(actualParameters, expectedSig.parameters);
                if (expectedSig.documentation === undefined) {
                    assert_1.default.equal(sig.documentation, undefined);
                }
                else {
                    assert_1.default.deepEqual(sig.documentation, {
                        kind: docFormat,
                        value: expectedSig.documentation,
                    });
                }
            });
            assert_1.default.deepEqual(actual.signatures.map((sig) => sig.activeParameter), expected.activeParameters);
            if (expected.callHasParameters !== undefined) {
                const isActive = (sig) => { var _a; return !expected.callHasParameters && !((_a = sig.parameters) === null || _a === void 0 ? void 0 : _a.length); };
                const activeSignature = (_b = (_a = expected.signatures) === null || _a === void 0 ? void 0 : _a.findIndex(isActive)) !== null && _b !== void 0 ? _b : undefined;
                assert_1.default.equal(actual.activeSignature, activeSignature);
            }
        }
    }
    verifyFindAllReferences(map, createDocumentRange, convertToLocation) {
        var _a;
        this.analyze();
        for (const name of this.getMarkerNames()) {
            const marker = this.getMarkerByName(name);
            const fileName = marker.fileName;
            if (!(name in map)) {
                continue;
            }
            let expected = map[name].references;
            expected = expected.map((c) => {
                var _a;
                return {
                    ...c,
                    uri: (_a = c.uri) !== null && _a !== void 0 ? _a : uri_1.Uri.file(c.path, this.serviceProvider),
                };
            });
            const position = this.convertOffsetToPosition(fileName, marker.position);
            const actual = new referencesProvider_1.ReferencesProvider(this.program, vscode_languageserver_1.CancellationToken.None, createDocumentRange, convertToLocation).reportReferences(uri_1.Uri.file(fileName, this.serviceProvider), position, /* includeDeclaration */ true);
            assert_1.default.strictEqual((_a = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _a !== void 0 ? _a : 0, expected.length, `${name} has failed`);
            for (const r of (0, navigationUtils_1.convertDocumentRangesToLocation)(this.program.fileSystem, expected, convertToLocation)) {
                assert_1.default.equal(actual === null || actual === void 0 ? void 0 : actual.filter((d) => this._deepEqual(d, r)).length, 1);
            }
        }
    }
    verifyShowCallHierarchyGetIncomingCalls(map) {
        var _a, _b, _c;
        this.analyze();
        for (const marker of this.getMarkers()) {
            const fileName = marker.fileName;
            const name = this.getMarkerName(marker);
            if (!(name in map)) {
                continue;
            }
            const expectedFilePath = map[name].items.map((x) => x.filePath);
            const expectedRange = map[name].items.map((x) => x.range);
            const expectedName = map[name].items.map((x) => x.name);
            const position = this.convertOffsetToPosition(fileName, marker.position);
            const actual = new callHierarchyProvider_1.CallHierarchyProvider(this.program, uri_1.Uri.file(fileName, this.serviceProvider), position, vscode_languageserver_1.CancellationToken.None).getIncomingCalls();
            assert_1.default.strictEqual((_a = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _a !== void 0 ? _a : 0, expectedFilePath.length, `${name} has failed`);
            assert_1.default.strictEqual((_b = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _b !== void 0 ? _b : 0, expectedRange.length, `${name} has failed`);
            assert_1.default.strictEqual((_c = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _c !== void 0 ? _c : 0, expectedName.length, `${name} has failed`);
            if (actual) {
                for (const a of actual) {
                    assert_1.default.strictEqual(expectedRange === null || expectedRange === void 0 ? void 0 : expectedRange.filter((e) => this._deepEqual(a.from.range, e)).length, 1);
                    assert_1.default.strictEqual(expectedName === null || expectedName === void 0 ? void 0 : expectedName.filter((e) => this._deepEqual(a.from.name, e)).length, 1);
                    assert_1.default.ok((expectedFilePath === null || expectedFilePath === void 0 ? void 0 : expectedFilePath.filter((e) => this._deepEqual(a.from.uri, uri_1.Uri.file(e, this.serviceProvider).toString())).length) >= 1);
                }
            }
        }
    }
    verifyShowCallHierarchyGetOutgoingCalls(map) {
        var _a, _b, _c;
        this.analyze();
        for (const marker of this.getMarkers()) {
            const fileName = marker.fileName;
            const name = this.getMarkerName(marker);
            if (!(name in map)) {
                continue;
            }
            const expectedFilePath = map[name].items.map((x) => x.filePath);
            const expectedRange = map[name].items.map((x) => x.range);
            const expectedName = map[name].items.map((x) => x.name);
            const position = this.convertOffsetToPosition(fileName, marker.position);
            const actual = new callHierarchyProvider_1.CallHierarchyProvider(this.program, uri_1.Uri.file(fileName, this.serviceProvider), position, vscode_languageserver_1.CancellationToken.None).getOutgoingCalls();
            assert_1.default.strictEqual((_a = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _a !== void 0 ? _a : 0, expectedFilePath.length, `${name} has failed`);
            assert_1.default.strictEqual((_b = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _b !== void 0 ? _b : 0, expectedRange.length, `${name} has failed`);
            assert_1.default.strictEqual((_c = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _c !== void 0 ? _c : 0, expectedName.length, `${name} has failed`);
            if (actual) {
                for (const a of actual) {
                    assert_1.default.strictEqual(expectedRange === null || expectedRange === void 0 ? void 0 : expectedRange.filter((e) => this._deepEqual(a.to.range, e)).length, 1);
                    assert_1.default.strictEqual(expectedName === null || expectedName === void 0 ? void 0 : expectedName.filter((e) => this._deepEqual(a.to.name, e)).length, 1);
                    assert_1.default.ok((expectedFilePath === null || expectedFilePath === void 0 ? void 0 : expectedFilePath.filter((e) => this._deepEqual(a.to.uri, uri_1.Uri.file(e, this.serviceProvider).toString())).length) >= 1);
                }
            }
        }
    }
    getDocumentHighlightKind(m) {
        const kind = (m === null || m === void 0 ? void 0 : m.data) ? m.data.kind : undefined;
        switch (kind) {
            case 'text':
                return vscode_languageserver_1.DocumentHighlightKind.Text;
            case 'read':
                return vscode_languageserver_1.DocumentHighlightKind.Read;
            case 'write':
                return vscode_languageserver_1.DocumentHighlightKind.Write;
            default:
                return undefined;
        }
    }
    verifyHighlightReferences(map) {
        var _a;
        this.analyze();
        for (const name of Object.keys(map)) {
            const marker = this.getMarkerByName(name);
            const fileName = marker.fileName;
            const expected = map[name].references;
            const position = this.convertOffsetToPosition(fileName, marker.position);
            const actual = new documentHighlightProvider_1.DocumentHighlightProvider(this.program, uri_1.Uri.file(fileName, this.serviceProvider), position, vscode_languageserver_1.CancellationToken.None).getDocumentHighlight();
            assert_1.default.equal((_a = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _a !== void 0 ? _a : 0, expected.length);
            for (const r of expected) {
                const match = actual === null || actual === void 0 ? void 0 : actual.filter((h) => this._deepEqual(h.range, r.range));
                assert_1.default.equal(match === null || match === void 0 ? void 0 : match.length, 1);
                if (r.kind) {
                    assert_1.default.equal(match[0].kind, r.kind);
                }
            }
        }
    }
    fixupDefinitionsToMatchExpected(actual) {
        return actual === null || actual === void 0 ? void 0 : actual.map((a) => {
            const { uri, ...restOfActual } = a;
            return {
                ...restOfActual,
                path: uri.getFilePath(),
            };
        });
    }
    verifyFindDefinitions(map, filter = definitionProvider_1.DefinitionFilter.All) {
        var _a;
        this.analyze();
        for (const marker of this.getMarkers()) {
            const fileName = marker.fileName;
            const name = this.getMarkerName(marker);
            if (!(name in map)) {
                continue;
            }
            const expected = map[name].definitions;
            const uri = uri_1.Uri.file(fileName, this.serviceProvider);
            // If we're going to def from a file, act like it's open.
            if (!this.program.getSourceFileInfo(uri)) {
                const file = this.testData.files.find((v) => v.fileName === fileName);
                if (file) {
                    this.program.setFileOpened(uri, file.version, file.content);
                }
            }
            const position = this.convertOffsetToPosition(fileName, marker.position);
            let actual = new definitionProvider_1.DefinitionProvider(this.program, uri, position, filter, vscode_languageserver_1.CancellationToken.None).getDefinitions();
            assert_1.default.equal((_a = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _a !== void 0 ? _a : 0, expected.length, `No definitions found for marker "${name}"`);
            actual = this.fixupDefinitionsToMatchExpected(actual);
            for (const r of expected) {
                assert_1.default.equal(actual === null || actual === void 0 ? void 0 : actual.filter((d) => this._deepEqual(d, r)).length, 1, `No match found for ${JSON.stringify(r)} from marker ${name}`);
            }
        }
    }
    verifyFindTypeDefinitions(map) {
        var _a;
        this.analyze();
        for (const marker of this.getMarkers()) {
            const fileName = marker.fileName;
            const name = this.getMarkerName(marker);
            if (!(name in map)) {
                continue;
            }
            const expected = map[name].definitions;
            const position = this.convertOffsetToPosition(fileName, marker.position);
            let actual = new definitionProvider_1.TypeDefinitionProvider(this.program, uri_1.Uri.file(fileName, this.serviceProvider), position, vscode_languageserver_1.CancellationToken.None).getDefinitions();
            actual = this.fixupDefinitionsToMatchExpected(actual);
            assert_1.default.strictEqual((_a = actual === null || actual === void 0 ? void 0 : actual.length) !== null && _a !== void 0 ? _a : 0, expected.length, name);
            for (const r of expected) {
                assert_1.default.strictEqual(actual === null || actual === void 0 ? void 0 : actual.filter((d) => this._deepEqual(d, r)).length, 1, name);
            }
        }
    }
    verifyRename(map, isUntitled = false) {
        this.analyze();
        for (const marker of this.getMarkers()) {
            const fileName = marker.fileName;
            const name = this.getMarkerName(marker);
            if (!(name in map)) {
                continue;
            }
            const expected = map[name];
            expected.changes = expected.changes.map((c) => {
                var _a;
                return {
                    ...c,
                    fileUri: (_a = c.fileUri) !== null && _a !== void 0 ? _a : uri_1.Uri.file(c.filePath, this.serviceProvider),
                };
            });
            const position = this.convertOffsetToPosition(fileName, marker.position);
            const actual = new renameProvider_1.RenameProvider(this.program, isUntitled
                ? uri_1.Uri.parse(`untitled:${fileName.replace(/\\/g, '/')}`, this.serviceProvider)
                : uri_1.Uri.file(fileName, this.serviceProvider), position, vscode_languageserver_1.CancellationToken.None).renameSymbol(expected.newName, /* isDefaultWorkspace */ false, isUntitled);
            (0, workspaceEditTestUtils_1.verifyWorkspaceEdit)((0, workspaceEditUtils_1.convertToWorkspaceEdit)(this.program.fileSystem, { edits: expected.changes, fileOperations: [] }), actual !== null && actual !== void 0 ? actual : { documentChanges: [] });
        }
    }
    verifyTypeVerifierResults(packageName, ignoreUnknownTypesFromImports, verboseOutput, expected) {
        const commandLineOptions = new commandLineOptions_1.CommandLineOptions(this.configOptions.projectRoot.getFilePath(), 
        /* fromVsCodeExtension */ false);
        commandLineOptions.verboseOutput = verboseOutput;
        const verifier = new packageTypeVerifier_1.PackageTypeVerifier(this.serviceProvider, testAccessHost, commandLineOptions, packageName, ignoreUnknownTypesFromImports);
        const report = verifier.verify();
        assert_1.default.strictEqual(report.generalDiagnostics.length, expected.generalDiagnostics.length);
        assert_1.default.strictEqual(report.missingClassDocStringCount, expected.missingClassDocStringCount);
        assert_1.default.strictEqual(report.missingDefaultParamCount, expected.missingDefaultParamCount);
        assert_1.default.strictEqual(report.missingFunctionDocStringCount, expected.missingFunctionDocStringCount);
        assert_1.default.strictEqual(report.moduleName, expected.moduleName);
        assert_1.default.strictEqual(report.packageName, expected.packageName);
        assert_1.default.deepStrictEqual(Array.from(report.symbols.keys()), Array.from(expected.symbols.keys()));
    }
    setCancelled(numberOfCalls) {
        this._cancellationToken.setCancelled(numberOfCalls);
    }
    resetCancelled() {
        this._cancellationToken.resetCancelled();
    }
    convertPositionToOffset(fileName, position) {
        const lines = this._getTextRangeCollection(fileName);
        return (0, positionUtils_1.convertPositionToOffset)(position, lines);
    }
    convertOffsetToPosition(fileName, offset) {
        const lines = this._getTextRangeCollection(fileName);
        return (0, positionUtils_1.convertOffsetToPosition)(offset, lines);
    }
    analyze() {
        while (this.program.analyze()) {
            // Continue to call analyze until it completes. Since we're not
            // specifying a timeout, it should complete the first time.
        }
    }
    findFile(indexOrName) {
        if (typeof indexOrName === 'number') {
            const index = indexOrName;
            if (index >= this.testData.files.length) {
                throw new Error(`File index (${index}) in openFile was out of range. There are only ${this.testData.files.length} files in this test.`);
            }
            else {
                return this.testData.files[index];
            }
        }
        else if ((0, core_1.isString)(indexOrName)) {
            const { file, availableNames } = this._tryFindFileWorker(indexOrName);
            if (!file) {
                throw new Error(`No test file named "${indexOrName}" exists. Available file names are: ${availableNames.join(', ')}`);
            }
            return file;
        }
        else {
            return debug.assertNever(indexOrName);
        }
    }
    getCompletionResults(state, marker, docFormat, abbrMap) {
        const filePath = marker.fileName;
        const completionPosition = this.convertOffsetToPosition(filePath, marker.position);
        const options = {
            format: docFormat,
            snippet: true,
            lazyEdit: false,
        };
        const provider = new completionProvider_1.CompletionProvider(this.program, uri_1.Uri.file(filePath, this.serviceProvider), completionPosition, options, vscode_languageserver_1.CancellationToken.None);
        return {
            getCompletions: () => provider.getCompletions(),
            resolveCompletionItem: (i) => provider.resolveCompletionItem(i),
        };
    }
    getFileContent(fileName) {
        const files = this.testData.files.filter((f) => this.testFS.ignoreCase
            ? (0, stringUtils_1.compareStringsCaseInsensitive)(f.fileName, fileName) === 0 /* Comparison.EqualTo */
            : (0, stringUtils_1.compareStringsCaseSensitive)(f.fileName, fileName) === 0 /* Comparison.EqualTo */);
        return files[0].content;
    }
    convertOffsetsToRange(fileName, startOffset, endOffset) {
        const lines = this._getTextRangeCollection(fileName);
        return {
            start: (0, positionUtils_1.convertOffsetToPosition)(startOffset, lines),
            end: (0, positionUtils_1.convertOffsetToPosition)(endOffset, lines),
        };
    }
    raiseError(message) {
        throw new Error(this._messageAtLastKnownMarker(message));
    }
    createMultiMap(values, getKey) {
        const map = new Map();
        map.add = multiMapAdd;
        map.remove = multiMapRemove;
        if (values && getKey) {
            for (const value of values) {
                map.add(getKey(value), value);
            }
        }
        return map;
        function multiMapAdd(key, value) {
            let values = this.get(key);
            if (values) {
                values.push(value);
            }
            else {
                this.set(key, (values = [value]));
            }
            return values;
        }
        function multiMapRemove(key, value) {
            const values = this.get(key);
            if (values) {
                values.forEach((v, i, arr) => {
                    if (v === value) {
                        arr.splice(i, 1);
                    }
                });
                if (!values.length) {
                    this.delete(key);
                }
            }
        }
    }
    rangeText({ fileName, pos, end }) {
        return this.getFileContent(fileName).slice(pos, end);
    }
    verifyCompletionItem(expected, actual) {
        var _a, _b, _c;
        assert_1.default.strictEqual(actual.label, expected.label);
        assert_1.default.strictEqual(actual.detail, expected.detail);
        assert_1.default.strictEqual(actual.kind, expected.kind);
        assert_1.default.strictEqual(actual.insertText, expected.insertionText);
        this._verifyEdit(actual.textEdit, expected.textEdit);
        this._verifyEdits(actual.additionalTextEdits, expected.additionalTextEdits);
        if (expected.detailDescription !== undefined) {
            assert_1.default.strictEqual((_a = actual.labelDetails) === null || _a === void 0 ? void 0 : _a.description, expected.detailDescription);
        }
        if (expected.commitCharacters !== undefined) {
            expect(expected.commitCharacters.sort()).toEqual((_c = (_b = actual.commitCharacters) === null || _b === void 0 ? void 0 : _b.sort()) !== null && _c !== void 0 ? _c : []);
        }
    }
    _convertGlobalOptionsToConfigOptions(projectRoot, mountPaths) {
        const configOptions = new configOptions_1.ConfigOptions(uri_1.Uri.file(projectRoot, this.serviceProvider));
        // add more global options as we need them
        const newConfigOptions = this._applyTestConfigOptions(configOptions, mountPaths);
        // default tests to run use compact signatures.
        newConfigOptions.functionSignatureDisplay = configOptions_1.SignatureDisplayType.compact;
        return newConfigOptions;
    }
    _applyTestConfigOptions(configOptions, mountPaths) {
        // Always enable "test mode".
        configOptions.internalTestMode = true;
        // Always analyze all files
        configOptions.checkOnlyOpenFiles = false;
        // make sure we set typing path
        if (configOptions.stubPath === undefined) {
            configOptions.stubPath = uri_1.Uri.file(vfs.MODULE_PATH, this.serviceProvider).combinePaths('typings');
        }
        configOptions.include.push((0, uriUtils_1.getFileSpec)(configOptions.projectRoot, '.'));
        configOptions.exclude.push((0, uriUtils_1.getFileSpec)(configOptions.projectRoot, factory_1.typeshedFolder.getFilePath()));
        configOptions.exclude.push((0, uriUtils_1.getFileSpec)(configOptions.projectRoot, factory_1.distlibFolder.getFilePath()));
        configOptions.exclude.push((0, uriUtils_1.getFileSpec)(configOptions.projectRoot, factory_1.libFolder.getFilePath()));
        if (mountPaths) {
            for (const mountPath of mountPaths.keys()) {
                configOptions.exclude.push((0, uriUtils_1.getFileSpec)(configOptions.projectRoot, mountPath));
            }
        }
        if (configOptions.functionSignatureDisplay === undefined) {
            configOptions.functionSignatureDisplay === configOptions_1.SignatureDisplayType.compact;
        }
        return configOptions;
    }
    _getParserOutput(fileName) {
        const file = this.program.getBoundSourceFile(uri_1.Uri.file(fileName, this.serviceProvider));
        return file === null || file === void 0 ? void 0 : file.getParseResults();
    }
    _getTextRangeCollection(fileName) {
        var _a;
        if (this.files.includes(fileName)) {
            const tokenizerOutput = (_a = this._getParserOutput(fileName)) === null || _a === void 0 ? void 0 : _a.tokenizerOutput;
            if (tokenizerOutput) {
                return tokenizerOutput.lines;
            }
        }
        // slow path
        const fileContents = this.fs.readFileSync(uri_1.Uri.file(fileName, this.serviceProvider), 'utf8');
        const tokenizer = new tokenizer_1.Tokenizer();
        return tokenizer.tokenize(fileContents).lines;
    }
    _messageAtLastKnownMarker(message) {
        const locationDescription = this.lastKnownMarker
            ? this.lastKnownMarker
            : this._getLineColStringAtPosition(this.currentCaretPosition);
        return `At ${locationDescription}: ${message}`;
    }
    _checkPostEditInvariants() {
        // blank for now
    }
    _editScriptAndUpdateMarkers(fileName, editStart, editEnd, newText) {
        var _a, _b;
        let fileContent = this.getFileContent(fileName);
        fileContent = fileContent.slice(0, editStart) + newText + fileContent.slice(editEnd);
        const uri = uri_1.Uri.file(fileName, this.serviceProvider);
        this.testFS.writeFileSync(uri, fileContent, 'utf8');
        const newVersion = ((_b = (_a = this.program.getSourceFile(uri)) === null || _a === void 0 ? void 0 : _a.getClientVersion()) !== null && _b !== void 0 ? _b : -1) + 1;
        this.program.setFileOpened(uri, newVersion, fileContent);
        for (const marker of this.testData.markers) {
            if (marker.fileName === fileName) {
                marker.position = this._updatePosition(marker.position, editStart, editEnd, newText);
            }
        }
        for (const range of this.testData.ranges) {
            if (range.fileName === fileName) {
                range.pos = this._updatePosition(range.pos, editStart, editEnd, newText);
                range.end = this._updatePosition(range.end, editStart, editEnd, newText);
            }
        }
        this.testData.rangesByText = undefined;
    }
    _removeWhitespace(text) {
        return text.replace(/\s/g, '');
    }
    _getOnlyRange() {
        const ranges = this.getRanges();
        if (ranges.length !== 1) {
            this.raiseError('Exactly one range should be specified in the test file.');
        }
        return ranges[0];
    }
    _verifyFileContent(fileName, text) {
        const actual = this.getFileContent(fileName);
        if (actual !== text) {
            throw new Error(`verifyFileContent failed:\n${this._showTextDiff(text, actual)}`);
        }
    }
    _verifyTextMatches(actualText, includeWhitespace, expectedText) {
        const removeWhitespace = (s) => (includeWhitespace ? s : this._removeWhitespace(s));
        if (removeWhitespace(actualText) !== removeWhitespace(expectedText)) {
            this.raiseError(`Actual range text doesn't match expected text.\n${this._showTextDiff(expectedText, actualText)}`);
        }
    }
    _getSelection() {
        return textRange_1.TextRange.fromBounds(this.currentCaretPosition, this.selectionEnd === -1 ? this.currentCaretPosition : this.selectionEnd);
    }
    _getLineContent(index) {
        const text = this.getFileContent(this.activeFile.fileName);
        const pos = this.convertPositionToOffset(this.activeFile.fileName, { line: index, character: 0 });
        let startPos = pos;
        let endPos = pos;
        while (startPos > 0) {
            const ch = text.charCodeAt(startPos - 1);
            if (ch === 13 /* Char.CarriageReturn */ || ch === 10 /* Char.LineFeed */) {
                break;
            }
            startPos--;
        }
        while (endPos < text.length) {
            const ch = text.charCodeAt(endPos);
            if (ch === 13 /* Char.CarriageReturn */ || ch === 10 /* Char.LineFeed */) {
                break;
            }
            endPos++;
        }
        return text.substring(startPos, endPos);
    }
    // Get the text of the entire line the caret is currently at
    _getCurrentLineContent() {
        return this._getLineContent(this.convertOffsetToPosition(this.activeFile.fileName, this.currentCaretPosition).line);
    }
    _tryFindFileWorker(name) {
        name = (0, pathUtils_1.normalizePath)(name);
        let file;
        const availableNames = [];
        this.testData.files.forEach((f) => {
            const fn = (0, pathUtils_1.normalizePath)(f.fileName);
            if (fn) {
                if (fn === name) {
                    file = f;
                }
                availableNames.push(fn);
            }
        });
        assert_1.default.ok(file);
        return { file, availableNames };
    }
    _getLineColStringAtPosition(position, file = this.activeFile) {
        const pos = this.convertOffsetToPosition(file.fileName, position);
        return `line ${pos.line + 1}, col ${pos.character}`;
    }
    _showTextDiff(expected, actual) {
        // Only show whitespace if the difference is whitespace-only.
        if (this._differOnlyByWhitespace(expected, actual)) {
            expected = this._makeWhitespaceVisible(expected);
            actual = this._makeWhitespaceVisible(actual);
        }
        return this._displayExpectedAndActualString(expected, actual);
    }
    _differOnlyByWhitespace(a, b) {
        return this._removeWhitespace(a) === this._removeWhitespace(b);
    }
    _displayExpectedAndActualString(expected, actual, quoted = false) {
        const expectMsg = '\x1b[1mExpected\x1b[0m\x1b[31m';
        const actualMsg = '\x1b[1mActual\x1b[0m\x1b[31m';
        const expectedString = quoted ? '"' + expected + '"' : expected;
        const actualString = quoted ? '"' + actual + '"' : actual;
        return `\n${expectMsg}:\n${expectedString}\n\n${actualMsg}:\n${actualString}`;
    }
    _makeWhitespaceVisible(text) {
        return text
            .replace(/ /g, '\u00B7')
            .replace(/\r/g, '\u00B6')
            .replace(/\n/g, '\u2193\n')
            .replace(/\t/g, '\u2192   ');
    }
    _updatePosition(position, editStart, editEnd, { length }) {
        // If inside the edit, return -1 to mark as invalid
        return position <= editStart ? position : position < editEnd ? -1 : position + length - +(editEnd - editStart);
    }
    _getDiagnosticsPerFile() {
        const sourceFiles = this.files.map((f) => this.program.getSourceFile(uri_1.Uri.file(f, this.serviceProvider)));
        const results = sourceFiles.map((sourceFile, index) => {
            if (sourceFile) {
                const diagnostics = sourceFile.getDiagnostics(this.configOptions) || [];
                const fileUri = sourceFile.getUri();
                const value = {
                    fileUri,
                    parseResults: sourceFile.getParseResults(),
                    errors: diagnostics.filter((diag) => diag.category === 0 /* DiagnosticCategory.Error */),
                    warnings: diagnostics.filter((diag) => diag.category === 1 /* DiagnosticCategory.Warning */),
                    information: diagnostics.filter((diag) => diag.category === 2 /* DiagnosticCategory.Information */),
                    unused: diagnostics.filter((diag) => diag.category === 3 /* DiagnosticCategory.UnusedCode */),
                };
                // Don't use the uri key, but rather the file name, because other spots
                // in the test data assume file paths.
                return [this.files[index], value];
            }
            else {
                this.raiseError(`Source file not found for ${this.files[index]}`);
            }
        });
        return new Map(results);
    }
    _createAnalysisService(nullConsole, importResolverFactory, backgroundAnalysisProgramFactory, configOptions) {
        // we do not initiate automatic analysis or file watcher in test.
        const service = new service_1.AnalyzerService('test service', this.serviceProvider, {
            console: nullConsole,
            hostFactory: () => testAccessHost,
            importResolverFactory,
            backgroundAnalysisProgramFactory,
            configOptions,
            fileSystem: this.fs,
        });
        // directly set files to track rather than using fileSpec from config
        // to discover those files from file system
        service.test_program.setTrackedFiles(this.files
            .filter((path) => {
            const fileExtension = (0, pathUtils_1.getFileExtension)(path).toLowerCase();
            return fileExtension === '.py' || fileExtension === '.pyi';
        })
            .map((path) => uri_1.Uri.file(path, this.serviceProvider))
            .filter((path) => service.isTracked(path)));
        return service;
    }
    _deepEqual(a, e) {
        try {
            // NOTE: find better way.
            assert_1.default.deepStrictEqual(a, e);
        }
        catch {
            return false;
        }
        return true;
    }
    async _waitForFile(filePath) {
        const uri = uri_1.Uri.file(filePath, this.serviceProvider);
        while (!this.fs.existsSync(uri)) {
            await new Promise((res) => setTimeout(() => {
                res();
            }, 200));
        }
    }
    _getCodeActions(range) {
        const file = range.fileName;
        const textRange = {
            start: this.convertOffsetToPosition(file, range.pos),
            end: this.convertOffsetToPosition(file, range.end),
        };
        return this._hostSpecificFeatures.getCodeActionsForPosition(this.workspace, range.fileUri, textRange, vscode_languageserver_1.CancellationToken.None);
    }
    async _verifyFiles(files) {
        for (const filePath of Object.keys(files)) {
            const expected = files[filePath];
            const normalizedFilePath = (0, pathUtils_1.normalizeSlashes)(filePath);
            // wait until the file exists
            await this._waitForFile(normalizedFilePath);
            const actual = this.fs.readFileSync(uri_1.Uri.file(normalizedFilePath, this.serviceProvider), 'utf8');
            if (actual !== expected) {
                this.raiseError(`doesn't contain expected result: ${(0, utils_1.stringify)(expected)}, actual: ${(0, utils_1.stringify)(actual)}`);
            }
        }
    }
    _editsAreEqual(actual, expected) {
        if (actual === expected) {
            return true;
        }
        if (actual === undefined || expected === undefined) {
            return false;
        }
        return (0, textRange_1.rangesAreEqual)(actual.range, expected.range) && actual.newText === expected.newText;
    }
    _verifyEdit(actual, expected) {
        if (!this._editsAreEqual(actual, expected)) {
            this.raiseError(`doesn't contain expected result: ${(0, utils_1.stringify)(expected)}, actual: ${(0, utils_1.stringify)(actual)}`);
        }
    }
    _verifyEdits(actual, expected) {
        actual = actual !== null && actual !== void 0 ? actual : [];
        expected = expected !== null && expected !== void 0 ? expected : [];
        let extra = expected.slice(0);
        let left = actual.slice(0);
        for (const item of actual) {
            extra = extra.filter((e) => !this._editsAreEqual(e, item));
        }
        for (const item of expected) {
            left = left.filter((e) => !this._editsAreEqual(e, item));
        }
        if (extra.length > 0 || left.length > 0) {
            this.raiseError(`doesn't contain expected result: ${(0, utils_1.stringify)(extra)}, actual: ${(0, utils_1.stringify)(left)}`);
        }
    }
}
exports.TestState = TestState;
function parseAndGetTestState(code, projectRoot = '/', anonymousFileName = 'unnamedFile.py', testFS) {
    const data = (0, fourSlashParser_1.parseTestData)((0, pathUtils_1.normalizeSlashes)(projectRoot), code, anonymousFileName);
    const state = new TestState((0, pathUtils_1.normalizeSlashes)('/'), data, 
    /* mountPath */ undefined, 
    /* hostSpecificFeatures */ undefined, testFS);
    return { data, state };
}
exports.parseAndGetTestState = parseAndGetTestState;
function getNodeForRange(codeOrState, markerName = 'marker') {
    const state = (0, core_1.isString)(codeOrState) ? parseAndGetTestState(codeOrState).state : codeOrState;
    const range = state.getRangeByMarkerName(markerName);
    (0, assert_1.default)(range);
    const textRange = textRange_1.TextRange.fromBounds(range.pos, range.end);
    const node = getNodeAtMarker(state, markerName);
    let current = node;
    while (current) {
        if (textRange_1.TextRange.containsRange(current, textRange)) {
            return current;
        }
        current = current.parent;
    }
    return node;
}
exports.getNodeForRange = getNodeForRange;
function getNodeAtMarker(codeOrState, markerName = 'marker') {
    const state = (0, core_1.isString)(codeOrState) ? parseAndGetTestState(codeOrState).state : codeOrState;
    const marker = state.getMarkerByName(markerName);
    const sourceFile = state.program.getBoundSourceFile(marker.fileUri);
    (0, assert_1.default)(sourceFile);
    const parserResults = sourceFile.getParseResults();
    (0, assert_1.default)(parserResults);
    const node = (0, parseTreeUtils_1.findNodeByOffset)(parserResults.parserOutput.parseTree, marker.position);
    (0, assert_1.default)(node);
    return node;
}
exports.getNodeAtMarker = getNodeAtMarker;
//# sourceMappingURL=testState.js.map