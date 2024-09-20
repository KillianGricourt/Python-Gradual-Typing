"use strict";
/*
 * typeEvaluatorTypes.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Abstract interface and other helper types for type evaluator module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maxSubtypesForInferredType = void 0;
// Maximum number of unioned subtypes for an inferred type (e.g.
// a list) before the type is considered an "Any".
exports.maxSubtypesForInferredType = 64;
//# sourceMappingURL=typeEvaluatorTypes.js.map