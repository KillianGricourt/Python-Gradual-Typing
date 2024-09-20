"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodeMain_1 = require("pyright-internal/nodeMain");
Error.stackTraceLimit = 256;
// VS Code version of the server has one background thread.
(0, nodeMain_1.main)(/* maxWorkers */ 1);
//# sourceMappingURL=server.js.map