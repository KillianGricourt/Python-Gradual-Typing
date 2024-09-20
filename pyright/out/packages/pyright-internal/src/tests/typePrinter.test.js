"use strict";
/*
 * typePrinter.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Unit tests for typePrinter module.
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
const assert = __importStar(require("assert"));
const typePrinter_1 = require("../analyzer/typePrinter");
const types_1 = require("../analyzer/types");
const uri_1 = require("../common/uri/uri");
function returnTypeCallback(type) {
    var _a;
    return (_a = type.details.declaredReturnType) !== null && _a !== void 0 ? _a : types_1.UnknownType.create(/* isEllipsis */ true);
}
test('SimpleTypes', () => {
    const anyType = types_1.AnyType.create(/* isEllipsis */ false);
    assert.strictEqual((0, typePrinter_1.printType)(anyType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'Any');
    const ellipsisType = types_1.AnyType.create(/* isEllipsis */ true);
    assert.strictEqual((0, typePrinter_1.printType)(ellipsisType, 0 /* PrintTypeFlags.None */, returnTypeCallback), '...');
    const unknownType = types_1.UnknownType.create();
    assert.strictEqual((0, typePrinter_1.printType)(unknownType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'Unknown');
    assert.strictEqual((0, typePrinter_1.printType)(unknownType, 1 /* PrintTypeFlags.PrintUnknownWithAny */, returnTypeCallback), 'Any');
    assert.strictEqual((0, typePrinter_1.printType)(unknownType, 256 /* PrintTypeFlags.PythonSyntax */, returnTypeCallback), 'Any');
    const unboundType = types_1.UnboundType.create();
    assert.strictEqual((0, typePrinter_1.printType)(unboundType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'Unbound');
    assert.strictEqual((0, typePrinter_1.printType)(unboundType, 256 /* PrintTypeFlags.PythonSyntax */, returnTypeCallback), 'Any');
    const moduleType = types_1.ModuleType.create('Test', uri_1.Uri.empty());
    assert.strictEqual((0, typePrinter_1.printType)(moduleType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'Module("Test")');
    assert.strictEqual((0, typePrinter_1.printType)(moduleType, 256 /* PrintTypeFlags.PythonSyntax */, returnTypeCallback), 'Any');
});
test('TypeVarTypes', () => {
    const typeVarType = types_1.TypeVarType.createInstance('T');
    assert.strictEqual((0, typePrinter_1.printType)(typeVarType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'T');
    const paramSpecType = types_1.TypeVarType.createInstance('P');
    paramSpecType.details.isParamSpec = true;
    assert.strictEqual((0, typePrinter_1.printType)(paramSpecType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'P');
    const typeVarTupleType = types_1.TypeVarType.createInstance('Ts');
    paramSpecType.details.isVariadic = true;
    assert.strictEqual((0, typePrinter_1.printType)(typeVarTupleType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'Ts');
});
test('ClassTypes', () => {
    const classTypeA = types_1.ClassType.createInstantiable('A', '', '', uri_1.Uri.empty(), 0 /* ClassTypeFlags.None */, 0, 
    /* declaredMetaclass*/ undefined, 
    /* effectiveMetaclass */ undefined);
    const typeVarS = types_1.TypeVarType.createInstance('S');
    const typeVarT = types_1.TypeVarType.createInstance('T');
    classTypeA.details.typeParameters.push(typeVarS, typeVarT);
    assert.strictEqual((0, typePrinter_1.printType)(classTypeA, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'type[A[S, T]]');
    const instanceA = types_1.ClassType.cloneAsInstance(classTypeA);
    assert.strictEqual((0, typePrinter_1.printType)(instanceA, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'A[S, T]');
    const classTypeInt = types_1.ClassType.createInstantiable('int', '', '', uri_1.Uri.empty(), 0 /* ClassTypeFlags.None */, 0, 
    /* declaredMetaclass*/ undefined, 
    /* effectiveMetaclass */ undefined);
    const instanceInt = types_1.ClassType.cloneAsInstance(classTypeInt);
    const specializedA = types_1.ClassType.cloneForSpecialization(instanceA, [instanceInt, instanceInt], 
    /* isTypeArgumentExplicit */ true);
    assert.strictEqual((0, typePrinter_1.printType)(specializedA, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'A[int, int]');
    const unionType = (0, types_1.combineTypes)([instanceInt, specializedA, typeVarS]);
    assert.strictEqual((0, typePrinter_1.printType)(unionType, 0 /* PrintTypeFlags.None */, returnTypeCallback), 'Union[int, A[int, int], S]');
    assert.strictEqual((0, typePrinter_1.printType)(unionType, 8 /* PrintTypeFlags.PEP604 */, returnTypeCallback), 'int | A[int, int] | S');
});
test('FunctionTypes', () => {
    const funcTypeA = types_1.FunctionType.createInstance('A', '', '', 0 /* FunctionTypeFlags.None */);
    types_1.FunctionType.addParameter(funcTypeA, {
        category: 0 /* ParameterCategory.Simple */,
        hasDeclaredType: true,
        type: types_1.AnyType.create(),
        name: 'a',
    });
    types_1.FunctionType.addPositionOnlyParameterSeparator(funcTypeA);
    types_1.FunctionType.addParameter(funcTypeA, {
        category: 1 /* ParameterCategory.ArgsList */,
        hasDeclaredType: true,
        type: types_1.AnyType.create(),
        name: 'args',
    });
    types_1.FunctionType.addParameter(funcTypeA, {
        category: 2 /* ParameterCategory.KwargsDict */,
        hasDeclaredType: true,
        type: types_1.AnyType.create(),
        name: 'kwargs',
    });
    funcTypeA.details.declaredReturnType = types_1.NeverType.createNoReturn();
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeA, 0 /* PrintTypeFlags.None */, returnTypeCallback), '(a: Any, /, *args: Any, **kwargs: Any) -> NoReturn');
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeA, 256 /* PrintTypeFlags.PythonSyntax */, returnTypeCallback), 'Callable[..., NoReturn]');
    const funcTypeB = types_1.FunctionType.createInstance('B', '', '', 0 /* FunctionTypeFlags.None */);
    types_1.FunctionType.addParameter(funcTypeB, {
        category: 0 /* ParameterCategory.Simple */,
        hasDeclaredType: true,
        type: types_1.AnyType.create(),
        name: 'a',
    });
    types_1.FunctionType.addPositionOnlyParameterSeparator(funcTypeB);
    const paramSpecP = types_1.TypeVarType.createInstance('P');
    paramSpecP.details.isParamSpec = true;
    types_1.FunctionType.addParamSpecVariadics(funcTypeB, paramSpecP);
    funcTypeB.details.declaredReturnType = types_1.NeverType.createNever();
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeB, 0 /* PrintTypeFlags.None */, returnTypeCallback), '(a: Any, /, **P) -> Never');
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeB, 256 /* PrintTypeFlags.PythonSyntax */, returnTypeCallback), 'Callable[Concatenate[Any, P], Never]');
    const funcTypeC = types_1.FunctionType.createInstance('C', '', '', 0 /* FunctionTypeFlags.None */);
    const typeVarTupleTs = types_1.TypeVarType.createInstance('Ts');
    typeVarTupleTs.details.isVariadic = true;
    const unpackedTs = types_1.TypeVarType.cloneForUnpacked(typeVarTupleTs);
    types_1.FunctionType.addParameter(funcTypeC, {
        category: 1 /* ParameterCategory.ArgsList */,
        hasDeclaredType: true,
        type: unpackedTs,
        name: 'args',
    });
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeC, 0 /* PrintTypeFlags.None */, returnTypeCallback), '(*args: *Ts) -> Unknown');
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeC, 512 /* PrintTypeFlags.UseTypingUnpack */, returnTypeCallback), '(*args: Unpack[Ts]) -> Unknown');
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeC, 256 /* PrintTypeFlags.PythonSyntax */, returnTypeCallback), 'Callable[..., Any]');
    const funcTypeD = types_1.FunctionType.createInstance('D', '', '', 0 /* FunctionTypeFlags.None */);
    funcTypeD.details.declaredReturnType = types_1.AnyType.create();
    types_1.FunctionType.addParamSpecVariadics(funcTypeD, paramSpecP);
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeD, 0 /* PrintTypeFlags.None */, returnTypeCallback), '(**P) -> Any');
    assert.strictEqual((0, typePrinter_1.printType)(funcTypeD, 256 /* PrintTypeFlags.PythonSyntax */, returnTypeCallback), 'Callable[P, Any]');
});
//# sourceMappingURL=typePrinter.test.js.map