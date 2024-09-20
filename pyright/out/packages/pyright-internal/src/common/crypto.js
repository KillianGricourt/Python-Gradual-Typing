"use strict";
/*
 * crypto.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Platform-independent helper functions for crypto.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.randomBytesHex = void 0;
const debug_1 = require("./debug");
let nodeCrypto;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nodeCrypto = require('crypto');
    if (!(nodeCrypto === null || nodeCrypto === void 0 ? void 0 : nodeCrypto.randomBytes)) {
        nodeCrypto = undefined;
    }
}
catch {
    // Not running in node.
}
function arrayToHex(arr) {
    return [...arr].map((x) => x.toString(16).padStart(2, '0')).join('');
}
function randomBytesHex(size) {
    if (nodeCrypto) {
        return nodeCrypto.randomBytes(size).toString('hex');
    }
    if (crypto) {
        const buf = crypto.getRandomValues(new Uint8Array(size));
        return arrayToHex(buf);
    }
    (0, debug_1.fail)('crypto library not found');
}
exports.randomBytesHex = randomBytesHex;
//# sourceMappingURL=crypto.js.map