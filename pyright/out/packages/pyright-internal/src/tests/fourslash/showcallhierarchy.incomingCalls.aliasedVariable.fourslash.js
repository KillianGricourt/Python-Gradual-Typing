"use strict";
/// <reference path="fourslash.ts" />
// @filename: declare.py
//// my_variable = "Hello, world!"
// @filename: consume.py
//// from my_module import my_variable as /*marker*/greeting
////
//// print(greeting)
{
    helper.verifyShowCallHierarchyGetIncomingCalls({
        marker: {
            items: [],
        },
    });
}
//# sourceMappingURL=showcallhierarchy.incomingCalls.aliasedVariable.fourslash.js.map