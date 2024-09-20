"use strict";
/// <reference path="fourslash.ts" />
// @filename: test.py
//// a = 42
//// a.n[|/*marker1*/|]
// @ts-ignore
await helper.verifyCompletion('excluded', 'markdown', {
    marker1: {
        completions: [{ label: 'capitalize', kind: undefined }],
    },
});
//# sourceMappingURL=completions.excluded.fourslash.js.map