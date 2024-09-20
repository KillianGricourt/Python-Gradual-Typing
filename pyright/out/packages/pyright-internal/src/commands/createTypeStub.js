"use strict";
/*
 * createTypeStub.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Implements 'create stub' command functionality.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeStubCreator = exports.CreateTypeStubCommand = void 0;
const cancellationUtils_1 = require("../common/cancellationUtils");
const analyzerServiceExecutor_1 = require("../languageService/analyzerServiceExecutor");
const uri_1 = require("../common/uri/uri");
class CreateTypeStubCommand {
    constructor(_ls) {
        this._ls = _ls;
        // Empty
    }
    async execute(cmdParams, token) {
        if (!cmdParams.arguments || cmdParams.arguments.length < 2) {
            return undefined;
        }
        const workspaceRoot = uri_1.Uri.parse(cmdParams.arguments[0], this._ls.serviceProvider);
        const importName = cmdParams.arguments[1];
        const callingFile = uri_1.Uri.parse(cmdParams.arguments[2], this._ls.serviceProvider);
        const workspace = await this._ls.getWorkspaceForFile(callingFile !== null && callingFile !== void 0 ? callingFile : workspaceRoot);
        return await new TypeStubCreator(this._ls).create(workspace, importName, token);
    }
}
exports.CreateTypeStubCommand = CreateTypeStubCommand;
class TypeStubCreator {
    constructor(_ls) {
        this._ls = _ls;
    }
    async create(workspace, importName, token) {
        const service = await analyzerServiceExecutor_1.AnalyzerServiceExecutor.cloneService(this._ls, workspace, {
            typeStubTargetImportName: importName,
            useBackgroundAnalysis: true,
        });
        try {
            await service.writeTypeStubInBackground(token);
            service.dispose();
            const infoMessage = `Type stub was successfully created for '${importName}'.`;
            this._ls.window.showInformationMessage(infoMessage);
            // This is called after a new type stub has been created. It allows
            // us to invalidate caches and force reanalysis of files that potentially
            // are affected by the appearance of a new type stub.
            this._ls.reanalyze();
        }
        catch (err) {
            const isCancellation = cancellationUtils_1.OperationCanceledException.is(err);
            if (isCancellation) {
                const errMessage = `Type stub creation for '${importName}' was canceled`;
                this._ls.console.error(errMessage);
            }
            else {
                let errMessage = '';
                if (err instanceof Error) {
                    errMessage = ': ' + err.message;
                }
                errMessage = `An error occurred when creating type stub for '${importName}'` + errMessage;
                this._ls.console.error(errMessage);
                this._ls.window.showErrorMessage(errMessage);
            }
        }
    }
}
exports.TypeStubCreator = TypeStubCreator;
//# sourceMappingURL=createTypeStub.js.map