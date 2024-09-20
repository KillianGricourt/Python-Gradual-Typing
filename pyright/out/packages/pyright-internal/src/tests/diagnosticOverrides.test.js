"use strict";
/*
 * diagnosticOverrides.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Tests to verify consistency between declarations of diagnostic
 * overrides in code and in the configuration schema.
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const diagnosticRules_1 = require("../common/diagnosticRules");
describe('Diagnostic overrides', () => {
    test('Compare DiagnosticRule to pyrightconfig.schema.json', () => {
        var _a, _b, _c, _d;
        const schemasFolder = path.resolve(__dirname, '..', '..', '..', 'vscode-pyright', 'schemas');
        const schemaJson = path.join(schemasFolder, 'pyrightconfig.schema.json');
        const jsonString = fs.readFileSync(schemaJson, { encoding: 'utf-8' });
        const json = JSON.parse(jsonString);
        expect((_b = (_a = json.definitions) === null || _a === void 0 ? void 0 : _a.diagnostic) === null || _b === void 0 ? void 0 : _b.anyOf).toBeDefined();
        const anyOf = (_d = (_c = json.definitions) === null || _c === void 0 ? void 0 : _c.diagnostic) === null || _d === void 0 ? void 0 : _d.anyOf;
        expect(Array.isArray(anyOf));
        expect(anyOf).toHaveLength(2);
        expect(anyOf[0].type).toEqual('boolean');
        expect(anyOf[1].type).toEqual('string');
        const enumValues = anyOf[1].enum;
        expect(Array.isArray(enumValues));
        expect(enumValues).toHaveLength(4);
        expect(enumValues[0]).toEqual('none');
        expect(enumValues[1]).toEqual('information');
        expect(enumValues[2]).toEqual('warning');
        expect(enumValues[3]).toEqual('error');
        expect(json.properties).toBeDefined();
        const overrideNamesInJson = Object.keys(json.properties).filter((n) => n.startsWith('report'));
        for (const propName of overrideNamesInJson) {
            const p = json.properties[propName];
            const ref = p['$ref'];
            const def = json.definitions[ref.substring(ref.lastIndexOf('/') + 1)];
            expect(def['$ref']).toEqual(`#/definitions/diagnostic`);
            expect(def.title).toBeDefined();
            expect(def.title.length).toBeGreaterThan(0);
            expect(def.default).toBeDefined();
            expect(enumValues).toContain(def.default);
        }
        const overrideNamesInCode = Object.values(diagnosticRules_1.DiagnosticRule).filter((x) => x.startsWith('report'));
        for (const n of overrideNamesInJson) {
            expect(overrideNamesInCode).toContain(n);
        }
        for (const n of overrideNamesInCode) {
            expect(overrideNamesInJson).toContain(n);
        }
    });
    test('Compare DiagnosticRule to package.json', () => {
        var _a, _b, _c, _d;
        const extensionRoot = path.resolve(__dirname, '..', '..', '..', 'vscode-pyright');
        const packageJson = path.join(extensionRoot, 'package.json');
        const jsonString = fs.readFileSync(packageJson, { encoding: 'utf-8' });
        const json = JSON.parse(jsonString);
        expect((_b = (_a = json.contributes) === null || _a === void 0 ? void 0 : _a.configuration) === null || _b === void 0 ? void 0 : _b.properties).toBeDefined();
        const overrides = (_d = (_c = json.contributes) === null || _c === void 0 ? void 0 : _c.configuration) === null || _d === void 0 ? void 0 : _d.properties['python.analysis.diagnosticSeverityOverrides'];
        expect(overrides).toBeDefined();
        const props = overrides.properties;
        expect(props).toBeDefined();
        const overrideNamesInJson = Object.keys(props);
        for (const propName of overrideNamesInJson) {
            const p = props[propName];
            expect(p.type).toEqual(['string', 'boolean']);
            expect(p.description).toBeDefined();
            expect(p.description.length).toBeGreaterThan(0);
            expect(p.default).toBeDefined();
            expect(p.enum).toBeDefined();
            expect(Array.isArray(p.enum));
            expect(p.enum).toHaveLength(6);
            expect(p.enum[0]).toEqual('none');
            expect(p.enum[1]).toEqual('information');
            expect(p.enum[2]).toEqual('warning');
            expect(p.enum[3]).toEqual('error');
            expect(p.enum[4]).toEqual(true);
            expect(p.enum[5]).toEqual(false);
            expect(p.enum).toContain(p.default);
        }
        const overrideNamesInCode = Object.values(diagnosticRules_1.DiagnosticRule).filter((x) => x.startsWith('report'));
        for (const n of overrideNamesInJson) {
            expect(overrideNamesInCode).toContain(n);
        }
        for (const n of overrideNamesInCode) {
            expect(overrideNamesInJson).toContain(n);
        }
    });
});
//# sourceMappingURL=diagnosticOverrides.test.js.map