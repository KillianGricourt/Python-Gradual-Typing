"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceProvider = void 0;
/*
 * serviceProviderExtensions.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Shortcuts to common services.
 */
const cacheManager_1 = require("../analyzer/cacheManager");
const programTypes_1 = require("../analyzer/programTypes");
const sourceFile_1 = require("../analyzer/sourceFile");
const pyrightFileSystem_1 = require("../pyrightFileSystem");
const serviceKeys_1 = require("./serviceKeys");
const caseSensitivityDetector_1 = require("./caseSensitivityDetector");
const console_1 = require("./console");
const fileSystem_1 = require("./fileSystem");
const serviceProvider_1 = require("./serviceProvider");
const docStringService_1 = require("./docStringService");
function createServiceProvider(...services) {
    const sp = new serviceProvider_1.ServiceProvider();
    // For known interfaces, register the service.
    services.forEach((service) => {
        if (fileSystem_1.FileSystem.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.fs, service);
        }
        if (console_1.ConsoleInterface.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.console, service);
        }
        if (programTypes_1.ISourceFileFactory.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.sourceFileFactory, service);
        }
        if (pyrightFileSystem_1.SupportPartialStubs.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.partialStubs, service);
        }
        if (fileSystem_1.TempFile.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.tempFile, service);
        }
        if (caseSensitivityDetector_1.CaseSensitivityDetector.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.caseSensitivityDetector, service);
        }
        if (cacheManager_1.CacheManager.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.cacheManager, service);
        }
        if (docStringService_1.DocStringService.is(service)) {
            sp.add(serviceKeys_1.ServiceKeys.docStringService, service);
        }
    });
    return sp;
}
exports.createServiceProvider = createServiceProvider;
serviceProvider_1.ServiceProvider.prototype.fs = function () {
    return this.get(serviceKeys_1.ServiceKeys.fs);
};
serviceProvider_1.ServiceProvider.prototype.console = function () {
    return this.get(serviceKeys_1.ServiceKeys.console);
};
serviceProvider_1.ServiceProvider.prototype.partialStubs = function () {
    return this.get(serviceKeys_1.ServiceKeys.partialStubs);
};
serviceProvider_1.ServiceProvider.prototype.tmp = function () {
    return this.tryGet(serviceKeys_1.ServiceKeys.tempFile);
};
serviceProvider_1.ServiceProvider.prototype.sourceFileFactory = function () {
    const result = this.tryGet(serviceKeys_1.ServiceKeys.sourceFileFactory);
    return result || DefaultSourceFileFactory;
};
serviceProvider_1.ServiceProvider.prototype.docStringService = function () {
    const result = this.tryGet(serviceKeys_1.ServiceKeys.docStringService);
    return result || new docStringService_1.PyrightDocStringService();
};
serviceProvider_1.ServiceProvider.prototype.cacheManager = function () {
    const result = this.tryGet(serviceKeys_1.ServiceKeys.cacheManager);
    return result;
};
const DefaultSourceFileFactory = {
    createSourceFile(serviceProvider, fileUri, moduleName, isThirdPartyImport, isThirdPartyPyTypedPresent, editMode, console, logTracker, ipythonMode) {
        return new sourceFile_1.SourceFile(serviceProvider, fileUri, moduleName, isThirdPartyImport, isThirdPartyPyTypedPresent, editMode, console, logTracker, ipythonMode);
    },
};
//# sourceMappingURL=serviceProviderExtensions.js.map