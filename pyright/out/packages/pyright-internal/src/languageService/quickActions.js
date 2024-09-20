"use strict";
/*
 * quickActions.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides support for miscellaneous quick actions.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.performQuickAction = void 0;
const importSorter_1 = require("./importSorter");
function performQuickAction(programView, uri, command, args, token) {
    const sourceFileInfo = programView.getSourceFileInfo(uri);
    // This command should be called only for open files, in which
    // case we should have the file contents already loaded.
    if (!sourceFileInfo || !sourceFileInfo.isOpenByClient) {
        return [];
    }
    // If we have no completed analysis job, there's nothing to do.
    const parseResults = programView.getParseResults(uri);
    if (!parseResults) {
        return [];
    }
    if (command === "pyright.organizeimports" /* Commands.orderImports */) {
        const importSorter = new importSorter_1.ImportSorter(parseResults, token);
        return importSorter.sort();
    }
    return [];
}
exports.performQuickAction = performQuickAction;
//# sourceMappingURL=quickActions.js.map