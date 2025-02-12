"use strict";
/*
 * extensions.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Extension methods to various types.
 */
/* eslint-disable @typescript-eslint/no-empty-function */
// Explicitly tells that promise should be run asynchronously.
Promise.prototype.ignoreErrors = function () {
    this.catch((e) => {
        console.log(e);
    });
};
//# sourceMappingURL=extensions.js.map