"use strict";
/// <reference path="fourslash.ts" />
// @filename: declare.py
//// def func():
////    pass
// @filename: Untitled-1.py
//// from declare import func
//// /*marker*/func()
{
    helper.verifyRename({
        marker: {
            newName: 'func1',
            changes: [],
        },
    }, true);
}
//# sourceMappingURL=rename.function.untitledFile.fourslash.js.map