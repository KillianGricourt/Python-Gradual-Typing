"use strict";
/// <reference path="fourslash.ts" />
// @filename: typings/testLib1/__init__.pyi
//// def [|func1|](a: str): ...
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
    }, 'preferSource');
}
//# sourceMappingURL=findDefinitions.definitionFilter.preferSource.onlyStubs.js.map