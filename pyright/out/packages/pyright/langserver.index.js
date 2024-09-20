#!/usr/bin/env node
"use strict";
/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
// Stash the base directory into a global variable.
global.__rootDirectory = __dirname + '/dist/';
require('./dist/pyright-langserver');
//# sourceMappingURL=langserver.index.js.map