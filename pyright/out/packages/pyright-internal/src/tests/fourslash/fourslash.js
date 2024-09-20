"use strict";
/*
 * fourslash.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * this file only exists for the richer editing experiences on *.fourslash.ts files.
 * when fourslash tests are actually running this file is not used.
 *
 * this basically provides type information through // <reference .. > while editing but
 * get ignored when test run due to how test code is injected when running.
 * see - server\pyright\server\src\tests\harness\fourslash\runner.ts@runCode - for more detail
 *
 * when run, helper variable will be bound to TestState (server\pyright\server\src\tests\harness\fourslash\testState.ts)
 * so make sure Fourslash type is in sync with TestState
 *
 * for how markup language and helper is used in fourslash tests, see these 2 tests
 * server\pyright\server\src\tests\fourSlashParser.test.ts
 * server\pyright\server\src\tests\testState.test.ts
 *
 * for debugging, open *.fourslash.ts test file you want to debug, and select "fourslash current file" as debug configuration
 * and set break point in one of TestState methods you are using in the test or set break point on "runCode" above
 * and hit F5.
 */
//# sourceMappingURL=fourslash.js.map