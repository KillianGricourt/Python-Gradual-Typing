"use strict";
/*
 * diagnostics.test.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Unit tests for diagnostics
 */
Object.defineProperty(exports, "__esModule", { value: true });
const testState_1 = require("./harness/fourslash/testState");
test('unused import', async () => {
    const code = `
// @filename: test1.py
//// from test2 import [|/*marker*/foo|]

// @filename: test2.py
//// def foo(): pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    state.verifyDiagnostics({
        marker: { category: 'unused', message: '"foo" is not accessed' },
    });
});
test('pyright ignore unused import', async () => {
    const code = `
// @filename: test1.py
//// from test2 import [|/*marker*/foo|] # pyright: ignore

// @filename: test2.py
//// def foo(): pass
    `;
    const state = (0, testState_1.parseAndGetTestState)(code).state;
    state.verifyDiagnostics({
        marker: { category: 'none', message: '' },
    });
});
//# sourceMappingURL=diagnostics.test.js.map