"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/*
 * sourceFile.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for pyright sourceMapperUtils module.
 */
const assert_1 = __importDefault(require("assert"));
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const sourceMapperUtils_1 = require("../analyzer/sourceMapperUtils");
const testState_1 = require("./harness/fourslash/testState");
const declaration_1 = require("../analyzer/declaration");
const textRange_1 = require("../common/textRange");
const uriUtils_1 = require("../common/uri/uriUtils");
function buildImportTree(sourceFile, targetFile, importResolver, token) {
    return (0, sourceMapperUtils_1.buildImportTree)(uriUtils_1.UriEx.file(sourceFile), uriUtils_1.UriEx.file(targetFile), (from) => {
        const resolved = importResolver(from.getFilePath().slice(1));
        return resolved.map((f) => uriUtils_1.UriEx.file(f));
    }, token).map((u) => u.getFilePath().slice(1));
}
describe('BuildImportTree', () => {
    const tokenSource = new vscode_jsonrpc_1.CancellationTokenSource();
    test('Simple', () => {
        const results = buildImportTree('A', 'C', (f) => {
            switch (f) {
                case 'C':
                    return ['B'];
                case 'B':
                    return ['A'];
                default:
                    break;
            }
            return [];
        }, tokenSource.token);
        assert_1.default.deepEqual(results, ['C', 'B']);
    });
    test('Recursion', () => {
        const results = buildImportTree('A', 'E', (f) => {
            switch (f) {
                case 'E':
                    return ['D'];
                case 'D':
                    return ['C', 'B'];
                case 'C':
                    return ['D'];
                case 'B':
                    return ['A'];
                default:
                    break;
            }
            return [];
        }, tokenSource.token);
        assert_1.default.deepEqual(results, ['E', 'D', 'B']);
    });
    test('Multiple Paths', () => {
        const results = buildImportTree('A', 'G', (f) => {
            switch (f) {
                case 'G':
                    return ['F', 'H', 'I'];
                case 'F':
                    return ['D', 'E'];
                case 'D':
                    return ['C', 'B'];
                case 'C':
                    return ['E'];
                case 'B':
                    return ['A'];
                default:
                    break;
            }
            return [];
        }, tokenSource.token);
        assert_1.default.deepEqual(results, ['G', 'F', 'D', 'B']);
    });
    test('No paths', () => {
        const results = buildImportTree('A', 'G', (f) => {
            switch (f) {
                case 'G':
                    return ['F', 'H', 'I'];
                case 'F':
                    return ['D', 'E'];
                case 'D':
                    return ['C', 'B'];
                case 'C':
                    return ['E'];
                default:
                    break;
            }
            return [];
        }, tokenSource.token);
        assert_1.default.deepEqual(results, ['G']);
    });
    function genArray(start, end) {
        return Array(end - start)
            .fill(0)
            .map(() => String.fromCharCode(start++));
    }
    test('Too deep', () => {
        const results = buildImportTree('Z', 'A', (f) => {
            const start = f.charCodeAt(0);
            const end = 'Y'.charCodeAt(0);
            return genArray(start, end);
        }, tokenSource.token);
        assert_1.default.deepEqual(results, ['A']);
    });
    test('Canceled', () => {
        const canceled = new vscode_jsonrpc_1.CancellationTokenSource();
        canceled.cancel();
        const results = buildImportTree('A', 'E', (f) => {
            switch (f) {
                case 'E':
                    return ['D'];
                case 'D':
                    return ['C', 'B'];
                case 'C':
                    return ['D'];
                case 'B':
                    return ['A'];
                default:
                    break;
            }
            return [];
        }, canceled.token);
        assert_1.default.deepEqual(results, ['E']);
    });
});
test('find type alias decl', () => {
    const code = `
// @filename: test.py
//// from typing import Mapping
//// [|/*decl*/M|] = Mapping
////
//// def foo(/*marker*/m: M): pass
    `;
    assertTypeAlias(code);
});
test('find type alias decl from inferred type', () => {
    const code = `
// @filename: test.py
//// from typing import Mapping
//// [|/*decl*/M|] = Mapping
////
//// def foo(m: M):
////     return m

// @filename: test1.py
//// from test import foo
//// a = { "hello": 10 }
////
//// /*marker*/b = foo(a)
    `;
    assertTypeAlias(code);
});
function assertTypeAlias(code) {
    var _a;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    const node = (0, testState_1.getNodeAtMarker)(state, 'marker');
    (0, assert_1.default)(node.nodeType === 38 /* ParseNodeType.Name */);
    const type = state.program.evaluator.getType(node);
    (0, assert_1.default)((type === null || type === void 0 ? void 0 : type.category) === 6 /* TypeCategory.Class */);
    assert_1.default.strictEqual(type.details.name, 'Mapping');
    assert_1.default.strictEqual((_a = type.typeAliasInfo) === null || _a === void 0 ? void 0 : _a.name, 'M');
    assert_1.default.strictEqual(type.typeAliasInfo.moduleName, 'test');
    const marker = state.getMarkerByName('marker');
    const markerUri = marker.fileUri;
    const mapper = state.program.getSourceMapper(markerUri, vscode_jsonrpc_1.CancellationToken.None, 
    /* mapCompiled */ false, 
    /* preferStubs */ true);
    const range = state.getRangeByMarkerName('decl');
    const decls = mapper.findDeclarationsByType(markerUri, type, /* userTypeAlias */ true);
    const decl = decls.find((d) => (0, declaration_1.isVariableDeclaration)(d) && d.typeAliasName && d.typeAliasName.value === 'M');
    (0, assert_1.default)(decl);
    assert_1.default.deepEqual(textRange_1.TextRange.create(decl.node.start, decl.node.length), textRange_1.TextRange.fromBounds(range.pos, range.end));
}
//# sourceMappingURL=sourceMapperUtils.test.js.map