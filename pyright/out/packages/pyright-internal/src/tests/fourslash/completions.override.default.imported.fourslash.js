"use strict";
/// <reference path="fourslash.ts" />
// @filename: test.py
//// from foo import B
////
//// class C(B):
////     def [|method/*marker*/|]
// @filename: foo.py
//// class B:
////     def method1(self, a: str = 'hello', b: int = 1234):
////         pass
////
////     def method2(self, a=None):
////         pass
////
////     def method3(self, a=1234, b=object()):
////         pass
////
////     def method4(self, a=+1234, b=-1.23j, c=1+2j):
////         pass
// @ts-ignore
await helper.verifyCompletion('included', 'markdown', {
    marker: {
        completions: [
            {
                label: 'method1',
                kind: Consts.CompletionItemKind.Method,
                textEdit: {
                    range: helper.getPositionRange('marker'),
                    newText: "method1(self, a: str = 'hello', b: int = 1234):\n    return super().method1(a, b)",
                },
            },
            {
                label: 'method2',
                kind: Consts.CompletionItemKind.Method,
                textEdit: {
                    range: helper.getPositionRange('marker'),
                    newText: 'method2(self, a=None):\n    return super().method2(a)',
                },
            },
            {
                label: 'method3',
                kind: Consts.CompletionItemKind.Method,
                textEdit: {
                    range: helper.getPositionRange('marker'),
                    newText: 'method3(self, a=1234, b=...):\n    return super().method3(a, b)',
                },
            },
            {
                label: 'method4',
                kind: Consts.CompletionItemKind.Method,
                textEdit: {
                    range: helper.getPositionRange('marker'),
                    newText: 'method4(self, a=+1234, b=-1.23j, c=1 + 2j):\n    return super().method4(a, b, c)',
                },
            },
        ],
    },
});
//# sourceMappingURL=completions.override.default.imported.fourslash.js.map