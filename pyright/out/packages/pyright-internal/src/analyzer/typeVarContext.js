"use strict";
/*
 * typeVarContext.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Module that records the relationship between type variables (and ParamSpecs)
 * and their types. It is used by the type evaluator to "solve" for the type of
 * each type variable.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeVarContext = exports.TypeVarSignatureContext = void 0;
const debug_1 = require("../common/debug");
const typeUtils_1 = require("./typeUtils");
const types_1 = require("./types");
// The maximum number of signature contexts that can be associated
// with a TypeVarContext. This equates to the number of overloads
// that can be captured by a ParamSpec (or multiple ParamSpecs).
// We should never hit this limit in practice, but there are certain
// pathological cases where we could, and we need to protect against
// this so it doesn't completely exhaust memory. This was previously
// set to 64, but we have seen cases where a library uses in excess
// of 300 overloads on a single function.
const maxSignatureContextCount = 1024;
class TypeVarSignatureContext {
    constructor() {
        this._typeVarMap = new Map();
    }
    clone() {
        const newContext = new TypeVarSignatureContext();
        this._typeVarMap.forEach((value) => {
            newContext.setTypeVarType(value.typeVar, value.narrowBound, value.narrowBoundNoLiterals, value.wideBound);
            if (value.tupleTypes) {
                newContext.setTupleTypeVar(value.typeVar, value.tupleTypes);
            }
        });
        if (this._sourceTypeVarScopeId) {
            this._sourceTypeVarScopeId.forEach((scopeId) => newContext.addSourceTypeVarScopeId(scopeId));
        }
        return newContext;
    }
    isSame(other) {
        if (this._typeVarMap.size !== other._typeVarMap.size) {
            return false;
        }
        function typesMatch(type1, type2) {
            if (!type1 || !type2) {
                return type1 === type2;
            }
            return (0, types_1.isTypeSame)(type1, type2);
        }
        let isSame = true;
        this._typeVarMap.forEach((value, key) => {
            const otherValue = other._typeVarMap.get(key);
            if (!otherValue ||
                !typesMatch(value.narrowBound, otherValue.narrowBound) ||
                !typesMatch(value.wideBound, otherValue.wideBound)) {
                isSame = false;
            }
        });
        return isSame;
    }
    isEmpty() {
        return this._typeVarMap.size === 0;
    }
    // Provides a "score" - a value that values completeness (number
    // of type variables that are assigned) and simplicity.
    getScore() {
        let score = 0;
        // Sum the scores for the defined type vars.
        this._typeVarMap.forEach((value) => {
            // Add 1 to the score for each type variable defined.
            score += 1;
            // Add a fractional amount based on the simplicity of the definition.
            // The more complex, the lower the score. In the spirit of Occam's
            // Razor, we always want to favor simple answers.
            const typeVarType = this.getTypeVarType(value.typeVar);
            score += 1.0 - this._getComplexityScoreForType(typeVarType);
        });
        return score;
    }
    getTypeVarType(reference, useNarrowBoundOnly = false) {
        var _a, _b;
        const entry = this.getTypeVar(reference);
        if (!entry) {
            return undefined;
        }
        if (useNarrowBoundOnly) {
            return entry.narrowBound;
        }
        // Prefer the narrow version with no literals. It will be undefined
        // if the literal type couldn't be widened due to constraints imposed
        // by the wide bound.
        return (_b = (_a = entry.narrowBoundNoLiterals) !== null && _a !== void 0 ? _a : entry.narrowBound) !== null && _b !== void 0 ? _b : entry.wideBound;
    }
    getParamSpecType(reference) {
        const entry = this.getTypeVar(reference);
        if (!(entry === null || entry === void 0 ? void 0 : entry.narrowBound)) {
            return undefined;
        }
        if ((0, types_1.isFunction)(entry.narrowBound)) {
            return entry.narrowBound;
        }
        if ((0, types_1.isAnyOrUnknown)(entry.narrowBound)) {
            return (0, typeUtils_1.getUnknownTypeForParamSpec)();
        }
        return undefined;
    }
    setTypeVarType(reference, narrowBound, narrowBoundNoLiterals, wideBound, tupleTypes) {
        const key = types_1.TypeVarType.getNameWithScope(reference);
        this._typeVarMap.set(key, {
            typeVar: reference,
            narrowBound,
            narrowBoundNoLiterals,
            wideBound,
            tupleTypes,
        });
    }
    getTupleTypeVar(reference) {
        var _a;
        return (_a = this.getTypeVar(reference)) === null || _a === void 0 ? void 0 : _a.tupleTypes;
    }
    setTupleTypeVar(reference, types) {
        // Caller should have already assigned a value to this type variable.
        const entry = this.getTypeVar(reference);
        (0, debug_1.assert)(entry);
        entry.tupleTypes = types;
    }
    getTypeVar(reference) {
        const key = types_1.TypeVarType.getNameWithScope(reference);
        return this._typeVarMap.get(key);
    }
    getTypeVars() {
        const entries = [];
        this._typeVarMap.forEach((entry) => {
            entries.push(entry);
        });
        return entries;
    }
    getTypeVarCount() {
        return this._typeVarMap.size;
    }
    getWideTypeBound(reference) {
        const entry = this.getTypeVar(reference);
        if (entry) {
            return entry.wideBound;
        }
        return undefined;
    }
    addSourceTypeVarScopeId(scopeId) {
        if (!this._sourceTypeVarScopeId) {
            this._sourceTypeVarScopeId = new Set();
        }
        this._sourceTypeVarScopeId.add(scopeId);
    }
    hasSourceTypeVarScopeId(scopeId) {
        if (!this._sourceTypeVarScopeId) {
            return false;
        }
        return this._sourceTypeVarScopeId.has(scopeId);
    }
    // Returns a "score" for a type that captures the relative complexity
    // of the type. Scores should all be between 0 and 1 where 0 means
    // very simple and 1 means complex. This is a heuristic, so there's
    // often no objectively correct answer.
    _getComplexityScoreForType(type, recursionCount = 0) {
        if (recursionCount > types_1.maxTypeRecursionCount) {
            return 1;
        }
        recursionCount++;
        switch (type.category) {
            case 1 /* TypeCategory.Unknown */:
            case 2 /* TypeCategory.Any */:
            case 9 /* TypeCategory.TypeVar */: {
                return 0.5;
            }
            case 4 /* TypeCategory.Function */:
            case 5 /* TypeCategory.OverloadedFunction */: {
                // Classes and unions should be preferred over functions,
                // so make this relatively high (more than 0.75).
                return 0.8;
            }
            case 0 /* TypeCategory.Unbound */:
            case 3 /* TypeCategory.Never */:
                return 1.0;
            case 8 /* TypeCategory.Union */: {
                let maxScore = 0;
                // If this union has a very large number of subtypes, don't bother
                // accurately computing the score. Assume a fixed value.
                if (type.subtypes.length < 16) {
                    type.subtypes.forEach((subtype) => {
                        const subtypeScore = this._getComplexityScoreForType(subtype, recursionCount);
                        maxScore = Math.max(maxScore, subtypeScore);
                    });
                }
                else {
                    maxScore = 0.5;
                }
                return maxScore;
            }
            case 6 /* TypeCategory.Class */: {
                return this._getComplexityScoreForClass(type, recursionCount);
            }
        }
        // For all other types, return a score of 0.
        return 0;
    }
    _getComplexityScoreForClass(classType, recursionCount) {
        let typeArgScoreSum = 0;
        let typeArgCount = 0;
        if (classType.tupleTypeArguments) {
            classType.tupleTypeArguments.forEach((typeArg) => {
                typeArgScoreSum += this._getComplexityScoreForType(typeArg.type, recursionCount);
                typeArgCount++;
            });
        }
        else if (classType.typeArguments) {
            classType.typeArguments.forEach((type) => {
                typeArgScoreSum += this._getComplexityScoreForType(type, recursionCount);
                typeArgCount++;
            });
        }
        else if (classType.details.typeParameters) {
            classType.details.typeParameters.forEach((type) => {
                typeArgScoreSum += this._getComplexityScoreForType(types_1.AnyType.create(), recursionCount);
                typeArgCount++;
            });
        }
        const averageTypeArgComplexity = typeArgCount > 0 ? typeArgScoreSum / typeArgCount : 0;
        return 0.5 + averageTypeArgComplexity * 0.25;
    }
}
exports.TypeVarSignatureContext = TypeVarSignatureContext;
class TypeVarContext {
    constructor(solveForScopes) {
        this._isLocked = false;
        this._id = TypeVarContext.nextTypeVarContextId++;
        if (Array.isArray(solveForScopes)) {
            this._solveForScopes = solveForScopes;
        }
        else if (solveForScopes !== undefined) {
            this._solveForScopes = [solveForScopes];
        }
        else {
            this._solveForScopes = undefined;
        }
        this._signatureContexts = [new TypeVarSignatureContext()];
    }
    clone() {
        const newTypeVarMap = new TypeVarContext();
        if (this._solveForScopes) {
            newTypeVarMap._solveForScopes = Array.from(this._solveForScopes);
        }
        newTypeVarMap._signatureContexts = this._signatureContexts.map((context) => context.clone());
        newTypeVarMap._isLocked = this._isLocked;
        return newTypeVarMap;
    }
    cloneWithSignatureSource(typeVarScopeId) {
        const clonedContext = this.clone();
        if (typeVarScopeId) {
            const filteredSignatures = this._signatureContexts.filter((context) => context.hasSourceTypeVarScopeId(typeVarScopeId));
            if (filteredSignatures.length > 0) {
                clonedContext._signatureContexts = filteredSignatures;
            }
            else {
                clonedContext._signatureContexts.forEach((context) => {
                    context.addSourceTypeVarScopeId(typeVarScopeId);
                });
            }
        }
        return clonedContext;
    }
    // Copies a cloned type var context back into this object.
    copyFromClone(clone) {
        this._signatureContexts = clone._signatureContexts.map((context) => context.clone());
        this._isLocked = clone._isLocked;
    }
    // Copy the specified signature contexts into this type var context.
    copySignatureContexts(contexts) {
        (0, debug_1.assert)(contexts.length > 0);
        // Limit the number of signature contexts. There are rare circumstances
        // where this can grow to unbounded numbers and exhaust memory.
        if (contexts.length < maxSignatureContextCount) {
            this._signatureContexts = Array.from(contexts);
        }
    }
    isSame(other) {
        if (other._signatureContexts.length !== this._signatureContexts.length) {
            return false;
        }
        return this._signatureContexts.every((context, index) => context.isSame(other._signatureContexts[index]));
    }
    getId() {
        return this._id;
    }
    // Returns the list of scopes this type var map is "solving".
    getSolveForScopes() {
        return this._solveForScopes;
    }
    hasSolveForScope(scopeId) {
        if (Array.isArray(scopeId)) {
            return scopeId.some((s) => this.hasSolveForScope(s));
        }
        if (scopeId === types_1.InScopePlaceholderScopeId) {
            return true;
        }
        return (scopeId !== undefined &&
            this._solveForScopes !== undefined &&
            this._solveForScopes.some((s) => s === scopeId));
    }
    setSolveForScopes(scopeIds) {
        scopeIds.forEach((scopeId) => {
            this.addSolveForScope(scopeId);
        });
    }
    addSolveForScope(scopeId) {
        if (Array.isArray(scopeId)) {
            scopeId.forEach((s) => this.addSolveForScope(s));
            return;
        }
        if (scopeId !== undefined && !this.hasSolveForScope(scopeId)) {
            if (!this._solveForScopes) {
                this._solveForScopes = [];
            }
            this._solveForScopes.push(scopeId);
        }
    }
    lock() {
        // Locks the type var map, preventing any further changes.
        (0, debug_1.assert)(!this._isLocked);
        this._isLocked = true;
    }
    unlock() {
        // Unlocks the type var map, allowing further changes.
        this._isLocked = false;
    }
    isLocked() {
        return this._isLocked;
    }
    isEmpty() {
        return this._signatureContexts.every((context) => context.isEmpty());
    }
    setTypeVarType(reference, narrowBound, narrowBoundNoLiterals, wideBound, tupleTypes) {
        (0, debug_1.assert)(!this._isLocked);
        return this._signatureContexts.forEach((context) => {
            context.setTypeVarType(reference, narrowBound, narrowBoundNoLiterals, wideBound, tupleTypes);
        });
    }
    setTupleTypeVar(reference, tupleTypes) {
        (0, debug_1.assert)(!this._isLocked);
        return this._signatureContexts.forEach((context) => {
            context.setTupleTypeVar(reference, tupleTypes);
        });
    }
    getScore() {
        let total = 0;
        this._signatureContexts.forEach((context) => {
            total += context.getScore();
        });
        // Return the average score among all signature contexts.
        return total / this._signatureContexts.length;
    }
    getPrimarySignature() {
        return this._signatureContexts[0];
    }
    getSignatureContexts() {
        return this._signatureContexts;
    }
    doForEachSignatureContext(callback) {
        const wasLocked = this.isLocked();
        this.unlock();
        this.getSignatureContexts().forEach((signature, signatureIndex) => {
            callback(signature, signatureIndex);
        });
        if (wasLocked) {
            this.lock();
        }
    }
    getSignatureContext(index) {
        (0, debug_1.assert)(index >= 0 && index < this._signatureContexts.length);
        return this._signatureContexts[index];
    }
    doForEachSignature(callback) {
        this._signatureContexts.forEach((context) => {
            callback(context);
        });
    }
}
exports.TypeVarContext = TypeVarContext;
TypeVarContext.nextTypeVarContextId = 1;
//# sourceMappingURL=typeVarContext.js.map