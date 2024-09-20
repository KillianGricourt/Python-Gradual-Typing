"use strict";
/*
 * sourceFile.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Class that represents a single Python source or stub file.
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
exports.SourceFile = exports.IPythonMode = exports.maxSourceFileSize = void 0;
const worker_threads_1 = require("worker_threads");
const cancellationUtils_1 = require("../common/cancellationUtils");
const collectionUtils_1 = require("../common/collectionUtils");
const configOptions_1 = require("../common/configOptions");
const console_1 = require("../common/console");
const debug_1 = require("../common/debug");
const diagnostic_1 = require("../common/diagnostic");
const diagnosticRules_1 = require("../common/diagnosticRules");
const diagnosticSink_1 = require("../common/diagnosticSink");
const logTracker_1 = require("../common/logTracker");
const pathUtils_1 = require("../common/pathUtils");
const positionUtils_1 = require("../common/positionUtils");
const serviceKeys_1 = require("../common/serviceKeys");
require("../common/serviceProviderExtensions");
const StringUtils = __importStar(require("../common/stringUtils"));
const textRange_1 = require("../common/textRange");
const textRangeCollection_1 = require("../common/textRangeCollection");
const timing_1 = require("../common/timing");
const localize_1 = require("../localization/localize");
const parseNodes_1 = require("../parser/parseNodes");
const parser_1 = require("../parser/parser");
const tokenizer_1 = require("../parser/tokenizer");
const AnalyzerNodeInfo = __importStar(require("./analyzerNodeInfo"));
const binder_1 = require("./binder");
const checkerExtension_1 = require("./checkerExtension");
const CommentUtils = __importStar(require("./commentUtils"));
const parseTreeCleaner_1 = require("./parseTreeCleaner");
const testWalker_1 = require("./testWalker");
// Limit the number of import cycles tracked per source file.
const _maxImportCyclesPerFile = 4;
// Allow files up to 50MB in length, same as VS Code.
// https://github.com/microsoft/vscode/blob/1e750a7514f365585d8dab1a7a82e0938481ea2f/src/vs/editor/common/model/textModel.ts#L194
exports.maxSourceFileSize = 50 * 1024 * 1024;
// Indicates whether IPython syntax is supported and if so, what
// type of notebook support is in use.
var IPythonMode;
(function (IPythonMode) {
    // Not a notebook. This is the only falsy enum value, so you
    // can test if IPython is supported via "if (ipythonMode)"
    IPythonMode[IPythonMode["None"] = 0] = "None";
    // Each cell is its own document.
    IPythonMode[IPythonMode["CellDocs"] = 1] = "CellDocs";
})(IPythonMode || (exports.IPythonMode = IPythonMode = {}));
class WriteableData {
    constructor(console) {
        // Number that is incremented every time the diagnostics
        // are updated.
        this.diagnosticVersion = 0;
        // Generation count of the file contents. When the contents
        // change, this is incremented.
        this.fileContentsVersion = 0;
        // Length and hash of the file the last time it was read from disk.
        this.lastFileContentLength = undefined;
        this.lastFileContentHash = undefined;
        // Version of file contents that have been analyzed.
        this.analyzedFileContentsVersion = -1;
        // Do we need to walk the parse tree and clean
        // the binder information hanging from it?
        this.parseTreeNeedsCleaning = false;
        // Reentrancy check for binding.
        this.isBindingInProgress = false;
        // Diagnostics generated during different phases of analysis.
        this.parseDiagnostics = [];
        this.commentDiagnostics = [];
        this.bindDiagnostics = [];
        this.checkerDiagnostics = [];
        this.taskListDiagnostics = [];
        this.typeIgnoreLines = new Map();
        this.pyrightIgnoreLines = new Map();
        // Accumulated and filtered diagnostics that combines all of the
        // above information. This needs to be recomputed any time the
        // above change.
        this.accumulatedDiagnostics = [];
        // Circular dependencies that have been reported in this file.
        this.circularDependencies = [];
        this.noCircularDependencyConfirmed = false;
        // Do we need to perform a binding step?
        this.isBindingNeeded = true;
        // Do we have valid diagnostic results from a checking pass?
        this.isCheckingNeeded = true;
        // True if the file appears to have been deleted.
        this.isFileDeleted = false;
        if (console_1.ConsoleInterface.hasLevel(console)) {
            this._consoleWithLevel = console;
        }
    }
    get parserOutput() {
        return this._parserOutput;
    }
    set parserOutput(value) {
        var _a;
        this._lastCallStack =
            ((_a = this._consoleWithLevel) === null || _a === void 0 ? void 0 : _a.level) === console_1.LogLevel.Log && value === undefined && this._parserOutput !== undefined
                ? new Error().stack
                : undefined;
        this._parserOutput = value;
    }
    debugPrint() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        return `WritableData: 
 diagnosticVersion=${this.diagnosticVersion}, 
 noCircularDependencyConfirmed=${this.noCircularDependencyConfirmed}, 
 isBindingNeeded=${this.isBindingNeeded},
 isBindingInProgress=${this.isBindingInProgress},
 isCheckingNeeded=${this.isCheckingNeeded},
 isFileDeleted=${this.isFileDeleted},
 hitMaxImportDepth=${this.hitMaxImportDepth},
 parseTreeNeedsCleaning=${this.parseTreeNeedsCleaning},
 fileContentsVersion=${this.fileContentsVersion},
 analyzedFileContentsVersion=${this.analyzedFileContentsVersion},
 clientDocumentVersion=${this.clientDocumentVersion},
 lastFileContentLength=${this.lastFileContentLength},
 lastFileContentHash=${this.lastFileContentHash},
 typeIgnoreAll=${this.typeIgnoreAll},
 imports=${(_a = this.imports) === null || _a === void 0 ? void 0 : _a.length},
 builtinsImport=${(_b = this.builtinsImport) === null || _b === void 0 ? void 0 : _b.importName},
 circularDependencies=${(_c = this.circularDependencies) === null || _c === void 0 ? void 0 : _c.length},
 parseDiagnostics=${(_d = this.parseDiagnostics) === null || _d === void 0 ? void 0 : _d.length},
 commentDiagnostics=${(_e = this.commentDiagnostics) === null || _e === void 0 ? void 0 : _e.length},
 bindDiagnostics=${(_f = this.bindDiagnostics) === null || _f === void 0 ? void 0 : _f.length},
 checkerDiagnostics=${(_g = this.checkerDiagnostics) === null || _g === void 0 ? void 0 : _g.length},
 taskListDiagnostics=${(_h = this.taskListDiagnostics) === null || _h === void 0 ? void 0 : _h.length},
 accumulatedDiagnostics=${(_j = this.accumulatedDiagnostics) === null || _j === void 0 ? void 0 : _j.length},
 typeIgnoreLines=${(_k = this.typeIgnoreLines) === null || _k === void 0 ? void 0 : _k.size},
 pyrightIgnoreLines=${(_l = this.pyrightIgnoreLines) === null || _l === void 0 ? void 0 : _l.size},
 checkTime=${this.checkTime},
 clientDocumentContents=${(_m = this.clientDocumentContents) === null || _m === void 0 ? void 0 : _m.length},
 parseResults=${(_o = this.parserOutput) === null || _o === void 0 ? void 0 : _o.parseTree.length},
 parseResultsDropCallStack=${this._lastCallStack}`;
    }
}
class SourceFile {
    constructor(serviceProvider, uri, moduleName, isThirdPartyImport, isThirdPartyPyTypedPresent, editMode, console, logTracker, ipythonMode) {
        this.serviceProvider = serviceProvider;
        // Settings that control which diagnostics should be output. The rules
        // are initialized to the basic set. They should be updated after the
        // the file is parsed.
        this._diagnosticRuleSet = (0, configOptions_1.getBasicDiagnosticRuleSet)();
        // Indicate whether this file is for ipython or not.
        this._ipythonMode = IPythonMode.None;
        this.fileSystem = serviceProvider.get(serviceKeys_1.ServiceKeys.fs);
        this._console = console || new console_1.StandardConsole();
        this._writableData = new WriteableData(this._console);
        this._editMode = editMode;
        this._uri = uri;
        this._moduleName = moduleName;
        this._isStubFile = uri.hasExtension('.pyi');
        this._isThirdPartyImport = isThirdPartyImport;
        this._isThirdPartyPyTypedPresent = isThirdPartyPyTypedPresent;
        const fileName = uri.fileName;
        this._isTypingStubFile =
            this._isStubFile && (this._uri.pathEndsWith('stdlib/typing.pyi') || fileName === 'typing_extensions.pyi');
        this._isTypingExtensionsStubFile = this._isStubFile && fileName === 'typing_extensions.pyi';
        this._isTypeshedStubFile = this._isStubFile && this._uri.pathEndsWith('stdlib/_typeshed/__init__.pyi');
        this._isBuiltInStubFile = false;
        if (this._isStubFile) {
            if (this._uri.pathEndsWith('stdlib/collections/__init__.pyi') ||
                this._uri.pathEndsWith('stdlib/asyncio/futures.pyi') ||
                this._uri.pathEndsWith('stdlib/asyncio/tasks.pyi') ||
                this._uri.pathEndsWith('stdlib/builtins.pyi') ||
                this._uri.pathEndsWith('stdlib/_importlib_modulespec.pyi') ||
                this._uri.pathEndsWith('stdlib/dataclasses.pyi') ||
                this._uri.pathEndsWith('stdlib/abc.pyi') ||
                this._uri.pathEndsWith('stdlib/enum.pyi') ||
                this._uri.pathEndsWith('stdlib/queue.pyi') ||
                this._uri.pathEndsWith('stdlib/types.pyi') ||
                this._uri.pathEndsWith('stdlib/warnings.pyi')) {
                this._isBuiltInStubFile = true;
            }
        }
        // 'FG' or 'BG' based on current thread.
        this._logTracker = logTracker !== null && logTracker !== void 0 ? logTracker : new logTracker_1.LogTracker(console, worker_threads_1.isMainThread ? 'FG' : 'BG');
        this._ipythonMode = ipythonMode !== null && ipythonMode !== void 0 ? ipythonMode : IPythonMode.None;
    }
    getIPythonMode() {
        return this._ipythonMode;
    }
    getUri() {
        return this._uri;
    }
    getModuleName() {
        if (this._moduleName) {
            return this._moduleName;
        }
        // Synthesize a module name using the file path.
        return (0, pathUtils_1.stripFileExtension)(this._uri.fileName);
    }
    setModuleName(name) {
        this._moduleName = name;
    }
    getDiagnosticVersion() {
        return this._writableData.diagnosticVersion;
    }
    isStubFile() {
        return this._isStubFile;
    }
    isTypingStubFile() {
        return this._isTypingStubFile;
    }
    isThirdPartyPyTypedPresent() {
        return this._isThirdPartyPyTypedPresent;
    }
    // Returns a list of cached diagnostics from the latest analysis job.
    // If the prevVersion is specified, the method returns undefined if
    // the diagnostics haven't changed.
    getDiagnostics(options, prevDiagnosticVersion) {
        if (this._writableData.diagnosticVersion === prevDiagnosticVersion) {
            return undefined;
        }
        return this._writableData.accumulatedDiagnostics;
    }
    getImports() {
        return this._writableData.imports || [];
    }
    getBuiltinsImport() {
        return this._writableData.builtinsImport;
    }
    getModuleSymbolTable() {
        return this._writableData.moduleSymbolTable;
    }
    getCheckTime() {
        return this._writableData.checkTime;
    }
    restore() {
        // If we had an edit, return our text.
        if (this._preEditData) {
            const text = this._writableData.clientDocumentContents;
            this._writableData = this._preEditData;
            this._preEditData = undefined;
            return text;
        }
        return undefined;
    }
    // Indicates whether the contents of the file have changed since
    // the last analysis was performed.
    didContentsChangeOnDisk() {
        // If this is an open file any content changes will be
        // provided through the editor. We can assume contents
        // didn't change without us knowing about them.
        if (this._writableData.clientDocumentContents) {
            return false;
        }
        // If the file was never read previously, no need to check for a change.
        if (this._writableData.lastFileContentLength === undefined) {
            return false;
        }
        // Read in the latest file contents and see if the hash matches
        // that of the previous contents.
        try {
            // Read the file's contents.
            if (this.fileSystem.existsSync(this._uri)) {
                const fileContents = this.fileSystem.readFileSync(this._uri, 'utf8');
                if (fileContents.length !== this._writableData.lastFileContentLength) {
                    return true;
                }
                if (StringUtils.hashString(fileContents) !== this._writableData.lastFileContentHash) {
                    return true;
                }
            }
            else {
                // No longer exists, so yes it has changed.
                return true;
            }
        }
        catch (error) {
            return true;
        }
        return false;
    }
    // Drop parse and binding info to save memory. It is used
    // in cases where memory is low. When info is needed, the file
    // will be re-parsed and rebound.
    dropParseAndBindInfo() {
        this._fireFileDirtyEvent();
        this._writableData.parserOutput = undefined;
        this._writableData.tokenizerLines = undefined;
        this._writableData.tokenizerOutput = undefined;
        this._writableData.parsedFileContents = undefined;
        this._writableData.moduleSymbolTable = undefined;
        this._writableData.isBindingNeeded = true;
    }
    markDirty() {
        this._writableData.fileContentsVersion++;
        this._writableData.noCircularDependencyConfirmed = false;
        this._writableData.isCheckingNeeded = true;
        this._writableData.isBindingNeeded = true;
        this._writableData.moduleSymbolTable = undefined;
        this._fireFileDirtyEvent();
    }
    markReanalysisRequired(forceRebinding) {
        // Keep the parse info, but reset the analysis to the beginning.
        this._writableData.isCheckingNeeded = true;
        this._writableData.noCircularDependencyConfirmed = false;
        // If the file contains a wildcard import or __all__ symbols,
        // we need to rebind because a dependent import may have changed.
        if (this._writableData.parserOutput) {
            if (this._writableData.parserOutput.containsWildcardImport ||
                AnalyzerNodeInfo.getDunderAllInfo(this._writableData.parserOutput.parseTree) !== undefined ||
                forceRebinding) {
                // We don't need to rebuild index data since wildcard
                // won't affect user file indices. User file indices
                // don't contain import alias info.
                this._writableData.parseTreeNeedsCleaning = true;
                this._writableData.isBindingNeeded = true;
                this._writableData.moduleSymbolTable = undefined;
            }
        }
    }
    getFileContentsVersion() {
        return this._writableData.fileContentsVersion;
    }
    getClientVersion() {
        return this._writableData.clientDocumentVersion;
    }
    getOpenFileContents() {
        return this._writableData.clientDocumentContents;
    }
    getFileContent() {
        // Get current buffer content if the file is opened.
        const openFileContent = this.getOpenFileContents();
        if (openFileContent !== undefined) {
            return openFileContent;
        }
        // Otherwise, get content from file system.
        try {
            // Check the file's length before attempting to read its full contents.
            const fileStat = this.fileSystem.statSync(this._uri);
            if (fileStat.size > exports.maxSourceFileSize) {
                this._console.error(`File length of "${this._uri}" is ${fileStat.size} ` +
                    `which exceeds the maximum supported file size of ${exports.maxSourceFileSize}`);
                throw new Error('File larger than max');
            }
            return this.fileSystem.readFileSync(this._uri, 'utf8');
        }
        catch (error) {
            return undefined;
        }
    }
    setClientVersion(version, contents) {
        // Save pre edit state if in edit mode.
        this._cachePreEditState();
        if (version === null) {
            this._writableData.clientDocumentVersion = undefined;
            this._writableData.clientDocumentContents = undefined;
            // Since the file is no longer open, dump the tokenizer output
            // so it doesn't consume memory.
            this._writableData.tokenizerOutput = undefined;
        }
        else {
            this._writableData.clientDocumentVersion = version;
            this._writableData.clientDocumentContents = contents;
            const contentsHash = StringUtils.hashString(contents);
            // Have the contents of the file changed?
            if (contents.length !== this._writableData.lastFileContentLength ||
                contentsHash !== this._writableData.lastFileContentHash) {
                this.markDirty();
            }
            this._writableData.lastFileContentLength = contents.length;
            this._writableData.lastFileContentHash = contentsHash;
            this._writableData.isFileDeleted = false;
        }
    }
    prepareForClose() {
        this._fireFileDirtyEvent();
    }
    isFileDeleted() {
        return this._writableData.isFileDeleted;
    }
    isParseRequired() {
        return (!this._writableData.parserOutput ||
            this._writableData.analyzedFileContentsVersion !== this._writableData.fileContentsVersion);
    }
    isBindingRequired() {
        if (this._writableData.isBindingInProgress) {
            return false;
        }
        if (this.isParseRequired()) {
            return true;
        }
        return this._writableData.isBindingNeeded;
    }
    isCheckingRequired() {
        return this._writableData.isCheckingNeeded;
    }
    getParseResults() {
        var _a;
        if (this.isParseRequired()) {
            return undefined;
        }
        (0, debug_1.assert)(this._writableData.parserOutput !== undefined && this._writableData.parsedFileContents !== undefined);
        // If we've cached the tokenizer output, use the cached version.
        // Otherwise re-tokenize the contents on demand.
        const tokenizerOutput = (_a = this._writableData.tokenizerOutput) !== null && _a !== void 0 ? _a : this._tokenizeContents(this._writableData.parsedFileContents);
        return {
            parserOutput: this._writableData.parserOutput,
            tokenizerOutput,
            text: this._writableData.parsedFileContents,
        };
    }
    getParserOutput() {
        if (this.isParseRequired()) {
            return undefined;
        }
        (0, debug_1.assert)(this._writableData.parserOutput !== undefined);
        return this._writableData.parserOutput;
    }
    // Adds a new circular dependency for this file but only if
    // it hasn't already been added.
    addCircularDependency(configOptions, circDependency) {
        let updatedDependencyList = false;
        // Some topologies can result in a massive number of cycles. We'll cut it off.
        if (this._writableData.circularDependencies.length < _maxImportCyclesPerFile) {
            if (!this._writableData.circularDependencies.some((dep) => dep.isEqual(circDependency))) {
                this._writableData.circularDependencies.push(circDependency);
                updatedDependencyList = true;
            }
        }
        if (updatedDependencyList) {
            this._recomputeDiagnostics(configOptions);
        }
    }
    setNoCircularDependencyConfirmed() {
        this._writableData.noCircularDependencyConfirmed = true;
    }
    isNoCircularDependencyConfirmed() {
        return !this.isParseRequired() && this._writableData.noCircularDependencyConfirmed;
    }
    setHitMaxImportDepth(maxImportDepth) {
        this._writableData.hitMaxImportDepth = maxImportDepth;
    }
    // Parse the file and update the state. Callers should wait for completion
    // (or at least cancel) prior to calling again. It returns true if a parse
    // was required and false if the parse information was up to date already.
    parse(configOptions, importResolver, content) {
        return this._logTracker.log(`parsing: ${this._getPathForLogging(this._uri)}`, (logState) => {
            // If the file is already parsed, we can skip.
            if (!this.isParseRequired()) {
                logState.suppress();
                return false;
            }
            const diagSink = this.createDiagnosticSink();
            let fileContents = this.getOpenFileContents();
            if (fileContents === undefined) {
                try {
                    const startTime = timing_1.timingStats.readFileTime.totalTime;
                    timing_1.timingStats.readFileTime.timeOperation(() => {
                        // Read the file's contents.
                        fileContents = content !== null && content !== void 0 ? content : this.getFileContent();
                        if (fileContents === undefined) {
                            throw new Error("Can't get file content");
                        }
                        // Remember the length and hash for comparison purposes.
                        this._writableData.lastFileContentLength = fileContents.length;
                        this._writableData.lastFileContentHash = StringUtils.hashString(fileContents);
                    });
                    logState.add(`fs read ${timing_1.timingStats.readFileTime.totalTime - startTime}ms`);
                }
                catch (error) {
                    diagSink.addError(`Source file could not be read`, (0, textRange_1.getEmptyRange)());
                    fileContents = '';
                    if (!this.fileSystem.existsSync(this._uri)) {
                        this._writableData.isFileDeleted = true;
                    }
                }
            }
            try {
                // Parse the token stream, building the abstract syntax tree.
                const parseFileResults = this._parseFile(configOptions, this._uri, fileContents, this._ipythonMode, diagSink);
                (0, debug_1.assert)(parseFileResults !== undefined && parseFileResults.tokenizerOutput !== undefined);
                this._writableData.parserOutput = parseFileResults.parserOutput;
                this._writableData.tokenizerLines = parseFileResults.tokenizerOutput.lines;
                this._writableData.parsedFileContents = fileContents;
                this._writableData.typeIgnoreLines = parseFileResults.tokenizerOutput.typeIgnoreLines;
                this._writableData.typeIgnoreAll = parseFileResults.tokenizerOutput.typeIgnoreAll;
                this._writableData.pyrightIgnoreLines = parseFileResults.tokenizerOutput.pyrightIgnoreLines;
                // Cache the tokenizer output only if this file is open.
                if (this._writableData.clientDocumentContents !== undefined) {
                    this._writableData.tokenizerOutput = parseFileResults.tokenizerOutput;
                }
                // Resolve imports.
                const execEnvironment = configOptions.findExecEnvironment(this._uri);
                timing_1.timingStats.resolveImportsTime.timeOperation(() => {
                    const importResult = this._resolveImports(importResolver, parseFileResults.parserOutput.importedModules, execEnvironment);
                    this._writableData.imports = importResult.imports;
                    this._writableData.builtinsImport = importResult.builtinsImportResult;
                    this._writableData.parseDiagnostics = diagSink.fetchAndClear();
                    this._writableData.taskListDiagnostics = [];
                    this._addTaskListDiagnostics(configOptions.taskListTokens, parseFileResults.tokenizerOutput, this._writableData.taskListDiagnostics);
                });
                // Is this file in a "strict" path?
                const useStrict = configOptions.strict.find((strictFileSpec) => this._uri.matchesRegex(strictFileSpec.regExp)) !==
                    undefined;
                const commentDiags = [];
                this._diagnosticRuleSet = CommentUtils.getFileLevelDirectives(parseFileResults.tokenizerOutput.tokens, parseFileResults.tokenizerOutput.lines, execEnvironment.diagnosticRuleSet, useStrict, commentDiags);
                this._writableData.commentDiagnostics = [];
                commentDiags.forEach((commentDiag) => {
                    this._writableData.commentDiagnostics.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, commentDiag.message, (0, positionUtils_1.convertTextRangeToRange)(commentDiag.range, parseFileResults.tokenizerOutput.lines)));
                });
            }
            catch (e) {
                const message = (e.stack ? e.stack.toString() : undefined) ||
                    (typeof e.message === 'string' ? e.message : undefined) ||
                    JSON.stringify(e);
                this._console.error(localize_1.LocMessage.internalParseError().format({
                    file: this.getUri().toUserVisibleString(),
                    message,
                }));
                // Create dummy parse results.
                this._writableData.parsedFileContents = '';
                this._writableData.parserOutput = {
                    parseTree: parseNodes_1.ModuleNode.create({ start: 0, length: 0 }),
                    importedModules: [],
                    futureImports: new Set(),
                    containsWildcardImport: false,
                    typingSymbolAliases: new Map(),
                };
                this._writableData.tokenizerLines = new textRangeCollection_1.TextRangeCollection([]);
                this._writableData.tokenizerOutput = {
                    tokens: new textRangeCollection_1.TextRangeCollection([]),
                    lines: this._writableData.tokenizerLines,
                    typeIgnoreAll: undefined,
                    typeIgnoreLines: new Map(),
                    pyrightIgnoreLines: new Map(),
                    predominantEndOfLineSequence: '\n',
                    hasPredominantTabSequence: false,
                    predominantTabSequence: '    ',
                    predominantSingleQuoteCharacter: "'",
                };
                this._writableData.imports = undefined;
                this._writableData.builtinsImport = undefined;
                const diagSink = this.createDiagnosticSink();
                diagSink.addError(localize_1.LocMessage.internalParseError().format({
                    file: this.getUri().toUserVisibleString(),
                    message,
                }), (0, textRange_1.getEmptyRange)());
                this._writableData.parseDiagnostics = diagSink.fetchAndClear();
                this._writableData.taskListDiagnostics = diagSink.fetchAndClear();
                // Do not rethrow the exception, swallow it here. Callers are not
                // prepared to handle an exception.
            }
            this._writableData.analyzedFileContentsVersion = this._writableData.fileContentsVersion;
            this._writableData.isBindingNeeded = true;
            this._writableData.isCheckingNeeded = true;
            this._writableData.parseTreeNeedsCleaning = false;
            this._writableData.hitMaxImportDepth = undefined;
            this._recomputeDiagnostics(configOptions);
            return true;
        });
    }
    bind(configOptions, importLookup, builtinsScope, futureImports) {
        (0, debug_1.assert)(!this.isParseRequired(), 'Bind called before parsing');
        (0, debug_1.assert)(this.isBindingRequired(), 'Bind called unnecessarily');
        (0, debug_1.assert)(!this._writableData.isBindingInProgress, 'Bind called while binding in progress');
        (0, debug_1.assert)(this._writableData.parserOutput !== undefined, 'Parse results not available');
        return this._logTracker.log(`binding: ${this._getPathForLogging(this._uri)}`, () => {
            try {
                // Perform name binding.
                timing_1.timingStats.bindTime.timeOperation(() => {
                    this._cleanParseTreeIfRequired();
                    const fileInfo = this._buildFileInfo(configOptions, this._writableData.parsedFileContents, importLookup, builtinsScope, futureImports);
                    AnalyzerNodeInfo.setFileInfo(this._writableData.parserOutput.parseTree, fileInfo);
                    const binder = new binder_1.Binder(fileInfo, this.serviceProvider.docStringService(), configOptions.indexGenerationMode);
                    this._writableData.isBindingInProgress = true;
                    binder.bindModule(this._writableData.parserOutput.parseTree);
                    // If we're in "test mode" (used for unit testing), run an additional
                    // "test walker" over the parse tree to validate its internal consistency.
                    if (configOptions.internalTestMode) {
                        const testWalker = new testWalker_1.TestWalker();
                        testWalker.walk(this._writableData.parserOutput.parseTree);
                    }
                    this._writableData.bindDiagnostics = fileInfo.diagnosticSink.fetchAndClear();
                    const moduleScope = AnalyzerNodeInfo.getScope(this._writableData.parserOutput.parseTree);
                    (0, debug_1.assert)(moduleScope !== undefined, 'Module scope not returned by binder');
                    this._writableData.moduleSymbolTable = moduleScope.symbolTable;
                });
            }
            catch (e) {
                const message = (e.stack ? e.stack.toString() : undefined) ||
                    (typeof e.message === 'string' ? e.message : undefined) ||
                    JSON.stringify(e);
                this._console.error(localize_1.LocMessage.internalBindError().format({
                    file: this.getUri().toUserVisibleString(),
                    message,
                }));
                const diagSink = this.createDiagnosticSink();
                diagSink.addError(localize_1.LocMessage.internalBindError().format({
                    file: this.getUri().toUserVisibleString(),
                    message,
                }), (0, textRange_1.getEmptyRange)());
                this._writableData.bindDiagnostics = diagSink.fetchAndClear();
                // Do not rethrow the exception, swallow it here. Callers are not
                // prepared to handle an exception.
            }
            finally {
                this._writableData.isBindingInProgress = false;
            }
            // Prepare for the next stage of the analysis.
            this._writableData.isCheckingNeeded = true;
            this._writableData.isBindingNeeded = false;
            this._recomputeDiagnostics(configOptions);
        });
    }
    check(configOptions, importResolver, evaluator, sourceMapper, dependentFiles) {
        (0, debug_1.assert)(!this.isParseRequired(), `Check called before parsing: state=${this._writableData.debugPrint()}`);
        (0, debug_1.assert)(!this.isBindingRequired(), `Check called before binding: state=${this._writableData.debugPrint()}`);
        (0, debug_1.assert)(!this._writableData.isBindingInProgress, 'Check called while binding in progress');
        (0, debug_1.assert)(this.isCheckingRequired(), 'Check called unnecessarily');
        (0, debug_1.assert)(this._writableData.parserOutput !== undefined, 'Parse results not available');
        return this._logTracker.log(`checking: ${this._getPathForLogging(this._uri)}`, () => {
            try {
                timing_1.timingStats.typeCheckerTime.timeOperation(() => {
                    const checkDuration = new timing_1.Duration();
                    const checker = new checkerExtension_1.MyChecker(importResolver, evaluator, this._writableData.parserOutput, sourceMapper, dependentFiles);
                    checker.check();
                    this._writableData.isCheckingNeeded = false;
                    const fileInfo = AnalyzerNodeInfo.getFileInfo(this._writableData.parserOutput.parseTree);
                    this._writableData.checkerDiagnostics = fileInfo.diagnosticSink.fetchAndClear();
                    this._writableData.checkTime = checkDuration.getDurationInMilliseconds();
                });
            }
            catch (e) {
                const isCancellation = cancellationUtils_1.OperationCanceledException.is(e);
                if (!isCancellation) {
                    const message = (e.stack ? e.stack.toString() : undefined) ||
                        (typeof e.message === 'string' ? e.message : undefined) ||
                        JSON.stringify(e);
                    this._console.error(localize_1.LocMessage.internalTypeCheckingError().format({
                        file: this.getUri().toUserVisibleString(),
                        message,
                    }));
                    const diagSink = this.createDiagnosticSink();
                    diagSink.addError(localize_1.LocMessage.internalTypeCheckingError().format({
                        file: this.getUri().toUserVisibleString(),
                        message,
                    }), (0, textRange_1.getEmptyRange)());
                    this._writableData.checkerDiagnostics = diagSink.fetchAndClear();
                    // Mark the file as complete so we don't get into an infinite loop.
                    this._writableData.isCheckingNeeded = false;
                }
                throw e;
            }
            finally {
                // Clear any circular dependencies associated with this file.
                // These will be detected by the program module and associated
                // with the source file right before it is finalized.
                this._writableData.circularDependencies = [];
                this._recomputeDiagnostics(configOptions);
            }
        });
    }
    test_enableIPythonMode(enable) {
        this._ipythonMode = enable ? IPythonMode.CellDocs : IPythonMode.None;
    }
    createDiagnosticSink() {
        return new diagnosticSink_1.DiagnosticSink();
    }
    createTextRangeDiagnosticSink(lines) {
        return new diagnosticSink_1.TextRangeDiagnosticSink(lines);
    }
    // Computes an updated set of accumulated diagnostics for the file
    // based on the partial diagnostics from various analysis stages.
    _recomputeDiagnostics(configOptions) {
        this._writableData.diagnosticVersion++;
        let includeWarningsAndErrors = true;
        // If a file was imported as a third-party file, don't report
        // any errors for it. The user can't fix them anyway.
        if (this._isThirdPartyImport) {
            includeWarningsAndErrors = false;
        }
        let diagList = [];
        (0, collectionUtils_1.appendArray)(diagList, this._writableData.parseDiagnostics);
        (0, collectionUtils_1.appendArray)(diagList, this._writableData.commentDiagnostics);
        (0, collectionUtils_1.appendArray)(diagList, this._writableData.bindDiagnostics);
        (0, collectionUtils_1.appendArray)(diagList, this._writableData.checkerDiagnostics);
        (0, collectionUtils_1.appendArray)(diagList, this._writableData.taskListDiagnostics);
        const prefilteredDiagList = diagList;
        const typeIgnoreLinesClone = new Map(this._writableData.typeIgnoreLines);
        const pyrightIgnoreLinesClone = new Map(this._writableData.pyrightIgnoreLines);
        // Filter the diagnostics based on "type: ignore" lines.
        if (this._diagnosticRuleSet.enableTypeIgnoreComments) {
            if (this._writableData.typeIgnoreLines.size > 0) {
                diagList = diagList.filter((d) => {
                    if (d.category !== 3 /* DiagnosticCategory.UnusedCode */ &&
                        d.category !== 4 /* DiagnosticCategory.UnreachableCode */ &&
                        d.category !== 5 /* DiagnosticCategory.Deprecated */) {
                        for (let line = d.range.start.line; line <= d.range.end.line; line++) {
                            if (this._writableData.typeIgnoreLines.has(line)) {
                                typeIgnoreLinesClone.delete(line);
                                return false;
                            }
                        }
                    }
                    return true;
                });
            }
        }
        // Filter the diagnostics based on "pyright: ignore" lines.
        if (this._writableData.pyrightIgnoreLines.size > 0) {
            diagList = diagList.filter((d) => {
                if (d.category !== 3 /* DiagnosticCategory.UnusedCode */ &&
                    d.category !== 4 /* DiagnosticCategory.UnreachableCode */ &&
                    d.category !== 5 /* DiagnosticCategory.Deprecated */) {
                    for (let line = d.range.start.line; line <= d.range.end.line; line++) {
                        const pyrightIgnoreComment = this._writableData.pyrightIgnoreLines.get(line);
                        if (pyrightIgnoreComment) {
                            if (!pyrightIgnoreComment.rulesList) {
                                pyrightIgnoreLinesClone.delete(line);
                                return false;
                            }
                            const diagRule = d.getRule();
                            if (!diagRule) {
                                // If there's no diagnostic rule, it won't match
                                // against a rules list.
                                return true;
                            }
                            // Did we find this rule in the list?
                            if (pyrightIgnoreComment.rulesList.find((rule) => rule.text === diagRule)) {
                                // Update the pyrightIgnoreLinesClone to remove this rule.
                                const oldClone = pyrightIgnoreLinesClone.get(line);
                                if (oldClone === null || oldClone === void 0 ? void 0 : oldClone.rulesList) {
                                    const filteredRulesList = oldClone.rulesList.filter((rule) => rule.text !== diagRule);
                                    if (filteredRulesList.length === 0) {
                                        pyrightIgnoreLinesClone.delete(line);
                                    }
                                    else {
                                        pyrightIgnoreLinesClone.set(line, {
                                            range: oldClone.range,
                                            rulesList: filteredRulesList,
                                        });
                                    }
                                }
                                return false;
                            }
                            return true;
                        }
                    }
                }
                return true;
            });
        }
        const unnecessaryTypeIgnoreDiags = [];
        // Skip this step if type checking is needed. Otherwise we'll likely produce
        // incorrect (false positive) reportUnnecessaryTypeIgnoreComment diagnostics
        // until checking is performed on this file.
        if (this._diagnosticRuleSet.reportUnnecessaryTypeIgnoreComment !== 'none' &&
            !this._writableData.isCheckingNeeded) {
            const diagCategory = (0, diagnostic_1.convertLevelToCategory)(this._diagnosticRuleSet.reportUnnecessaryTypeIgnoreComment);
            const prefilteredErrorList = prefilteredDiagList.filter((diag) => diag.category === 0 /* DiagnosticCategory.Error */ ||
                diag.category === 1 /* DiagnosticCategory.Warning */ ||
                diag.category === 2 /* DiagnosticCategory.Information */);
            const isUnreachableCodeRange = (range) => {
                return prefilteredDiagList.find((diag) => diag.category === 4 /* DiagnosticCategory.UnreachableCode */ &&
                    diag.range.start.line <= range.start.line &&
                    diag.range.end.line >= range.end.line);
            };
            if (prefilteredErrorList.length === 0 && this._writableData.typeIgnoreAll !== undefined) {
                const rangeStart = this._writableData.typeIgnoreAll.range.start;
                const rangeEnd = rangeStart + this._writableData.typeIgnoreAll.range.length;
                const range = (0, positionUtils_1.convertOffsetsToRange)(rangeStart, rangeEnd, this._writableData.tokenizerLines);
                if (!isUnreachableCodeRange(range) && this._diagnosticRuleSet.enableTypeIgnoreComments) {
                    const diag = new diagnostic_1.Diagnostic(diagCategory, localize_1.LocMessage.unnecessaryTypeIgnore(), range);
                    diag.setRule(diagnosticRules_1.DiagnosticRule.reportUnnecessaryTypeIgnoreComment);
                    unnecessaryTypeIgnoreDiags.push(diag);
                }
            }
            typeIgnoreLinesClone.forEach((ignoreComment) => {
                if (this._writableData.tokenizerLines) {
                    const rangeStart = ignoreComment.range.start;
                    const rangeEnd = rangeStart + ignoreComment.range.length;
                    const range = (0, positionUtils_1.convertOffsetsToRange)(rangeStart, rangeEnd, this._writableData.tokenizerLines);
                    if (!isUnreachableCodeRange(range) && this._diagnosticRuleSet.enableTypeIgnoreComments) {
                        const diag = new diagnostic_1.Diagnostic(diagCategory, localize_1.LocMessage.unnecessaryTypeIgnore(), range);
                        diag.setRule(diagnosticRules_1.DiagnosticRule.reportUnnecessaryTypeIgnoreComment);
                        unnecessaryTypeIgnoreDiags.push(diag);
                    }
                }
            });
            pyrightIgnoreLinesClone.forEach((ignoreComment) => {
                if (this._writableData.tokenizerLines) {
                    if (!ignoreComment.rulesList) {
                        const rangeStart = ignoreComment.range.start;
                        const rangeEnd = rangeStart + ignoreComment.range.length;
                        const range = (0, positionUtils_1.convertOffsetsToRange)(rangeStart, rangeEnd, this._writableData.tokenizerLines);
                        if (!isUnreachableCodeRange(range)) {
                            const diag = new diagnostic_1.Diagnostic(diagCategory, localize_1.LocMessage.unnecessaryTypeIgnore(), range);
                            diag.setRule(diagnosticRules_1.DiagnosticRule.reportUnnecessaryTypeIgnoreComment);
                            unnecessaryTypeIgnoreDiags.push(diag);
                        }
                    }
                    else {
                        ignoreComment.rulesList.forEach((unusedRule) => {
                            const rangeStart = unusedRule.range.start;
                            const rangeEnd = rangeStart + unusedRule.range.length;
                            const range = (0, positionUtils_1.convertOffsetsToRange)(rangeStart, rangeEnd, this._writableData.tokenizerLines);
                            if (!isUnreachableCodeRange(range)) {
                                const diag = new diagnostic_1.Diagnostic(diagCategory, localize_1.LocMessage.unnecessaryPyrightIgnoreRule().format({
                                    name: unusedRule.text,
                                }), range);
                                diag.setRule(diagnosticRules_1.DiagnosticRule.reportUnnecessaryTypeIgnoreComment);
                                unnecessaryTypeIgnoreDiags.push(diag);
                            }
                        });
                    }
                }
            });
        }
        if (this._diagnosticRuleSet.reportImportCycles !== 'none' &&
            this._writableData.circularDependencies.length > 0) {
            const category = (0, diagnostic_1.convertLevelToCategory)(this._diagnosticRuleSet.reportImportCycles);
            this._writableData.circularDependencies.forEach((cirDep) => {
                const diag = new diagnostic_1.Diagnostic(category, localize_1.LocMessage.importCycleDetected() +
                    '\n' +
                    cirDep
                        .getPaths()
                        .map((path) => '  ' + path.toUserVisibleString())
                        .join('\n'), (0, textRange_1.getEmptyRange)());
                diag.setRule(diagnosticRules_1.DiagnosticRule.reportImportCycles);
                diagList.push(diag);
            });
        }
        if (this._writableData.hitMaxImportDepth !== undefined) {
            diagList.push(new diagnostic_1.Diagnostic(0 /* DiagnosticCategory.Error */, localize_1.LocMessage.importDepthExceeded().format({ depth: this._writableData.hitMaxImportDepth }), (0, textRange_1.getEmptyRange)()));
        }
        // If there is a "type: ignore" comment at the top of the file, clear
        // the diagnostic list of all error, warning, and information diagnostics.
        if (this._diagnosticRuleSet.enableTypeIgnoreComments) {
            if (this._writableData.typeIgnoreAll !== undefined) {
                diagList = diagList.filter((diag) => diag.category !== 0 /* DiagnosticCategory.Error */ &&
                    diag.category !== 1 /* DiagnosticCategory.Warning */ &&
                    diag.category !== 2 /* DiagnosticCategory.Information */);
            }
        }
        // Now add in the "unnecessary type ignore" diagnostics.
        diagList = diagList.concat(unnecessaryTypeIgnoreDiags);
        // If we're not returning any diagnostics, filter out all of
        // the errors and warnings, leaving only the unreachable code
        // and deprecated diagnostics.
        if (!includeWarningsAndErrors) {
            diagList = diagList.filter((diag) => diag.category === 3 /* DiagnosticCategory.UnusedCode */ ||
                diag.category === 4 /* DiagnosticCategory.UnreachableCode */ ||
                diag.category === 5 /* DiagnosticCategory.Deprecated */);
        }
        // If the file is in the ignore list, clear the diagnostic list.
        if (configOptions.ignore.find((ignoreFileSpec) => this._uri.matchesRegex(ignoreFileSpec.regExp))) {
            diagList = [];
        }
        this._writableData.accumulatedDiagnostics = diagList;
    }
    _cachePreEditState() {
        // If this is our first write, then make a copy of the writable data.
        if (!this._editMode.isEditMode || this._preEditData) {
            return;
        }
        // Copy over the writable data.
        this._preEditData = this._writableData;
        // Recreate all the writable data from scratch.
        this._writableData = new WriteableData(this._console);
    }
    // Get all task list diagnostics for the current file and add them
    // to the specified diagnostic list.
    _addTaskListDiagnostics(taskListTokens, tokenizerOutput, diagList) {
        if (!taskListTokens || taskListTokens.length === 0 || !diagList) {
            return;
        }
        for (let i = 0; i < tokenizerOutput.tokens.count; i++) {
            const token = tokenizerOutput.tokens.getItemAt(i);
            // If there are no comments, skip this token.
            if (!token.comments || token.comments.length === 0) {
                continue;
            }
            for (const comment of token.comments) {
                for (const token of taskListTokens) {
                    // Check if the comment matches the task list token.
                    // The comment must start with zero or more whitespace characters,
                    // followed by the taskListToken (case insensitive),
                    // followed by (0+ whitespace + EOL) OR (1+ NON-alphanumeric characters)
                    const regexStr = '^[\\s]*' + token.text + '([\\s]*$|[\\W]+)';
                    const regex = RegExp(regexStr, 'i'); // case insensitive
                    // If the comment doesn't match, skip it.
                    if (!regex.test(comment.value)) {
                        continue;
                    }
                    // Calculate the range for the diagnostic. This allows navigation
                    // to the comment via double clicking the item in the task list pane.
                    let rangeStart = comment.start;
                    // The comment technically starts right after the comment identifier(#),
                    // but we want the caret right before the task list token (since there
                    // might be whitespace before it).
                    const indexOfToken = comment.value.toLowerCase().indexOf(token.text.toLowerCase());
                    rangeStart += indexOfToken;
                    const rangeEnd = textRange_1.TextRange.getEnd(comment);
                    const range = (0, positionUtils_1.convertOffsetsToRange)(rangeStart, rangeEnd, tokenizerOutput.lines);
                    // Add the diagnostic to the list and trim whitespace from the comment so
                    // it's easier to read in the task list.
                    diagList.push(new diagnostic_1.Diagnostic(6 /* DiagnosticCategory.TaskItem */, comment.value.trim(), range, token.priority));
                }
            }
        }
    }
    _buildFileInfo(configOptions, fileContents, importLookup, builtinsScope, futureImports) {
        (0, debug_1.assert)(this._writableData.parserOutput !== undefined, 'Parse results not available');
        const analysisDiagnostics = this.createTextRangeDiagnosticSink(this._writableData.tokenizerLines);
        const fileInfo = {
            importLookup,
            futureImports,
            builtinsScope,
            diagnosticSink: analysisDiagnostics,
            executionEnvironment: configOptions.findExecEnvironment(this._uri),
            diagnosticRuleSet: this._diagnosticRuleSet,
            lines: this._writableData.tokenizerLines,
            typingSymbolAliases: this._writableData.parserOutput.typingSymbolAliases,
            definedConstants: configOptions.defineConstant,
            fileUri: this._uri,
            moduleName: this.getModuleName(),
            isStubFile: this._isStubFile,
            isTypingStubFile: this._isTypingStubFile,
            isTypingExtensionsStubFile: this._isTypingExtensionsStubFile,
            isTypeshedStubFile: this._isTypeshedStubFile,
            isBuiltInStubFile: this._isBuiltInStubFile,
            isInPyTypedPackage: this._isThirdPartyPyTypedPresent,
            ipythonMode: this._ipythonMode,
            accessedSymbolSet: new Set(),
        };
        return fileInfo;
    }
    _cleanParseTreeIfRequired() {
        if (this._writableData.parserOutput) {
            if (this._writableData.parseTreeNeedsCleaning) {
                const cleanerWalker = new parseTreeCleaner_1.ParseTreeCleanerWalker(this._writableData.parserOutput.parseTree);
                cleanerWalker.clean();
                this._writableData.parseTreeNeedsCleaning = false;
            }
        }
    }
    _resolveImports(importResolver, moduleImports, execEnv) {
        const imports = [];
        const resolveAndAddIfNotSelf = (nameParts, skipMissingImport = false) => {
            const importResult = importResolver.resolveImport(this._uri, execEnv, {
                leadingDots: 0,
                nameParts,
                importedSymbols: undefined,
            });
            if (skipMissingImport && !importResult.isImportFound) {
                return undefined;
            }
            // Avoid importing module from the module file itself.
            if (importResult.resolvedUris.length === 0 || importResult.resolvedUris[0] !== this._uri) {
                imports.push(importResult);
                return importResult;
            }
            return undefined;
        };
        // Always include an implicit import of the builtins module.
        let builtinsImportResult;
        // If this is a project source file (not a stub), try to resolve
        // the __builtins__ stub first.
        if (!this._isThirdPartyImport && !this._isStubFile) {
            builtinsImportResult = resolveAndAddIfNotSelf(['__builtins__'], /* skipMissingImport */ true);
        }
        if (!builtinsImportResult) {
            builtinsImportResult = resolveAndAddIfNotSelf(['builtins']);
        }
        for (const moduleImport of moduleImports) {
            const importResult = importResolver.resolveImport(this._uri, execEnv, {
                leadingDots: moduleImport.leadingDots,
                nameParts: moduleImport.nameParts,
                importedSymbols: moduleImport.importedSymbols,
            });
            imports.push(importResult);
            // Associate the import results with the module import
            // name node in the parse tree so we can access it later
            // (for hover and definition support).
            if (moduleImport.nameParts.length === moduleImport.nameNode.nameParts.length) {
                AnalyzerNodeInfo.setImportInfo(moduleImport.nameNode, importResult);
            }
            else {
                // For implicit imports of higher-level modules within a multi-part
                // module name, the moduleImport.nameParts will refer to the subset
                // of the multi-part name rather than the full multi-part name. In this
                // case, store the import info on the name part node.
                (0, debug_1.assert)(moduleImport.nameParts.length > 0);
                (0, debug_1.assert)(moduleImport.nameParts.length - 1 < moduleImport.nameNode.nameParts.length);
                AnalyzerNodeInfo.setImportInfo(moduleImport.nameNode.nameParts[moduleImport.nameParts.length - 1], importResult);
            }
        }
        return {
            imports,
            builtinsImportResult,
        };
    }
    _getPathForLogging(fileUri) {
        return (0, logTracker_1.getPathForLogging)(this.fileSystem, fileUri);
    }
    _parseFile(configOptions, fileUri, fileContents, ipythonMode, diagSink) {
        var _a;
        // Use the configuration options to determine the environment zin which
        // this source file will be executed.
        const execEnvironment = configOptions.findExecEnvironment(fileUri);
        const parseOptions = new parser_1.ParseOptions();
        parseOptions.ipythonMode = ipythonMode;
        if (fileUri.pathEndsWith('pyi')) {
            parseOptions.isStubFile = true;
        }
        parseOptions.pythonVersion = execEnvironment.pythonVersion;
        parseOptions.skipFunctionAndClassBody = (_a = configOptions.indexGenerationMode) !== null && _a !== void 0 ? _a : false;
        // Parse the token stream, building the abstract syntax tree.
        const parser = new parser_1.Parser();
        return parser.parseSourceFile(fileContents, parseOptions, diagSink);
    }
    _tokenizeContents(fileContents) {
        const tokenizer = new tokenizer_1.Tokenizer();
        const output = tokenizer.tokenize(fileContents);
        // If the file is currently open, cache the tokenizer results.
        if (this._writableData.clientDocumentContents !== undefined) {
            this._writableData.tokenizerOutput = output;
            // Replace the existing tokenizerLines with the newly-returned
            // version. They should have the same contents, but we want to use
            // the same object so the older object can be deallocated.
            this._writableData.tokenizerLines = output.lines;
        }
        return output;
    }
    _fireFileDirtyEvent() {
        var _a;
        (_a = this.serviceProvider.tryGet(serviceKeys_1.ServiceKeys.stateMutationListeners)) === null || _a === void 0 ? void 0 : _a.forEach((l) => {
            var _a;
            try {
                (_a = l.onFileDirty) === null || _a === void 0 ? void 0 : _a.call(l, this._uri);
            }
            catch (ex) {
                const console = this.serviceProvider.tryGet(serviceKeys_1.ServiceKeys.console);
                if (console) {
                    console.error(`State mutation listener exception: ${ex.message}`);
                }
            }
        });
    }
}
exports.SourceFile = SourceFile;
//# sourceMappingURL=sourceFile.js.map