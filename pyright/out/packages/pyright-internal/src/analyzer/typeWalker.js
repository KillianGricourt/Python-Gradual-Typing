"use strict";
/*
 * typeWalker.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * A class that walks the parts of a type (e.g. the parameters of a function
 * or the type arguments of a class). It detects and prevents infinite recursion.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TypeWalker = void 0;
const debug_1 = require("../common/debug");
const types_1 = require("./types");
class TypeWalker {
    constructor() {
        this._recursionCount = 0;
        this._isWalkCanceled = false;
        this._hitRecursionLimit = false;
    }
    get isRecursionLimitHit() {
        return this._hitRecursionLimit;
    }
    get isWalkCanceled() {
        return this._isWalkCanceled;
    }
    walk(type) {
        if (this._recursionCount > types_1.maxTypeRecursionCount) {
            this._hitRecursionLimit = true;
            return;
        }
        if (this._isWalkCanceled) {
            return;
        }
        this._recursionCount++;
        if (type.typeAliasInfo) {
            this.visitTypeAlias(type);
        }
        switch (type.category) {
            case 0 /* TypeCategory.Unbound */:
                this.visitUnbound(type);
                break;
            case 2 /* TypeCategory.Any */:
                this.visitAny(type);
                break;
            case 1 /* TypeCategory.Unknown */:
                this.visitUnknown(type);
                break;
            case 3 /* TypeCategory.Never */:
                this.visitNever(type);
                break;
            case 4 /* TypeCategory.Function */:
                this.visitFunction(type);
                break;
            case 5 /* TypeCategory.OverloadedFunction */:
                this.visitOverloadedFunction(type);
                break;
            case 6 /* TypeCategory.Class */:
                this.visitClass(type);
                break;
            case 7 /* TypeCategory.Module */:
                this.visitModule(type);
                break;
            case 8 /* TypeCategory.Union */:
                this.visitUnion(type);
                break;
            case 9 /* TypeCategory.TypeVar */:
                this.visitTypeVar(type);
                break;
            default:
                (0, debug_1.assertNever)(type);
        }
        this._recursionCount--;
    }
    cancelWalk() {
        this._isWalkCanceled = true;
    }
    visitTypeAlias(type) {
        (0, debug_1.assert)(type.typeAliasInfo);
        if (type.typeAliasInfo.typeArguments) {
            for (const typeArg of type.typeAliasInfo.typeArguments) {
                this.walk(typeArg);
                if (this._isWalkCanceled) {
                    break;
                }
            }
        }
    }
    visitUnbound(type) {
        // Nothing to do.
    }
    visitAny(type) {
        // Nothing to do.
    }
    visitUnknown(type) {
        // Nothing to do.
    }
    visitNever(type) {
        // Nothing to do.
    }
    visitFunction(type) {
        var _a;
        for (let i = 0; i < type.details.parameters.length; i++) {
            // Ignore parameters such as "*" that have no name.
            if (type.details.parameters[i].name) {
                const paramType = types_1.FunctionType.getEffectiveParameterType(type, i);
                this.walk(paramType);
                if (this._isWalkCanceled) {
                    break;
                }
            }
        }
        if (!this._isWalkCanceled && !types_1.FunctionType.isParamSpecValue(type) && !types_1.FunctionType.isParamSpecValue(type)) {
            const returnType = (_a = type.details.declaredReturnType) !== null && _a !== void 0 ? _a : type.inferredReturnType;
            if (returnType) {
                this.walk(returnType);
            }
        }
    }
    visitOverloadedFunction(type) {
        for (const overload of type.overloads) {
            this.walk(overload);
            if (this._isWalkCanceled) {
                break;
            }
        }
    }
    visitClass(type) {
        var _a;
        if (!types_1.ClassType.isPseudoGenericClass(type)) {
            const typeArgs = ((_a = type.tupleTypeArguments) === null || _a === void 0 ? void 0 : _a.map((t) => t.type)) || type.typeArguments;
            if (typeArgs) {
                for (const argType of typeArgs) {
                    this.walk(argType);
                    if (this._isWalkCanceled) {
                        break;
                    }
                }
            }
        }
    }
    visitModule(type) {
        // Nothing to do.
    }
    visitUnion(type) {
        for (const subtype of type.subtypes) {
            this.walk(subtype);
            if (this._isWalkCanceled) {
                break;
            }
        }
    }
    visitTypeVar(type) {
        // Nothing to do.
    }
}
exports.TypeWalker = TypeWalker;
//# sourceMappingURL=typeWalker.js.map