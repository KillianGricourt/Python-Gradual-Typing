"use strict";
/// <reference path="fourslash.ts" />
// @filename: pyrightconfig.json
//// {
////   "useLibraryCodeForTypes": true
//// }
// @filename: testLib1/__init__.py
// @library: true
//// def [|func1|](a):
////     pass
// @filename: test.py
//// from testLib1 import func1
////
//// [|/*marker*/func1|]('')
{
    const ranges = helper.getRanges().filter((r) => !r.marker);
    helper.verifyFindDefinitions({
        marker: {
            definitions: ranges.map((r) => {
                return { path: r.fileName, range: helper.convertPositionRange(r) };
            }),
        },
    });
}
//# sourceMappingURL=findDefinitions.sourceOnly.function1.fourslash.js.map