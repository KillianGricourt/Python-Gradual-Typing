"use strict";
/// <reference path="fourslash.ts" />
// @filename: testLib1/__init__.py
// @library: true
//// class Test1:
////     def [|M|](self, a):
////         pass
// @filename: typings/testLib1/__init__.pyi
//// class Test1:
////     def [|M|](self, a: str): ...
// @filename: test.py
//// import testLib1
////
//// a = testLib1.Test1()
//// a.[|/*marker*/M|]('')
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
//# sourceMappingURL=findDefinitions.sourceAndStub.outerClassMethod.fourslash.js.map