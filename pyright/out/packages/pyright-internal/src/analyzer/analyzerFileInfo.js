"use strict";
/*
 * analyzerFileInfo.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Information associated with a source file that is used
 * by the binder and checker.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isAnnotationEvaluationPostponed = void 0;
const pythonVersion_1 = require("../common/pythonVersion");
function isAnnotationEvaluationPostponed(fileInfo) {
    if (fileInfo.isStubFile) {
        return true;
    }
    if (fileInfo.futureImports.has('annotations')) {
        return true;
    }
    // As of May 2023, the Python steering council has approved PEP 649 for Python 3.13.
    // It was tentatively approved for 3.12, but they decided to defer until the next
    // release to reduce the risk. As of May 8, 2024, the change did not make it into
    // Python 3.13beta1, so it has been deferred to Python 3.14.
    // https://discuss.python.org/t/pep-649-deferred-evaluation-of-annotations-tentatively-accepted/21331
    if (fileInfo.executionEnvironment.pythonVersion.isGreaterOrEqualTo(pythonVersion_1.pythonVersion3_14)) {
        return true;
    }
    return false;
}
exports.isAnnotationEvaluationPostponed = isAnnotationEvaluationPostponed;
//# sourceMappingURL=analyzerFileInfo.js.map