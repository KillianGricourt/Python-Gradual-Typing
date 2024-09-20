"use strict";
/*
 * testStateUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Various test utility functions for TestState.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarkerNames = exports.getMarkerByName = exports.getMarkerName = exports.createVfsInfoFromFourSlashData = void 0;
const assert_1 = __importDefault(require("assert"));
const JSONC = __importStar(require("jsonc-parser"));
const service_1 = require("../../../analyzer/service");
const core_1 = require("../../../common/core");
const pathUtils_1 = require("../../../common/pathUtils");
const stringUtils_1 = require("../../../common/stringUtils");
const vfs = __importStar(require("../vfs/filesystem"));
function createVfsInfoFromFourSlashData(projectRoot, testData) {
    const metaProjectRoot = testData.globalOptions["projectroot" /* GlobalMetadataOptionNames.projectRoot */];
    projectRoot = metaProjectRoot ? (0, pathUtils_1.combinePaths)(projectRoot, metaProjectRoot) : projectRoot;
    const ignoreCase = (0, core_1.toBoolean)(testData.globalOptions["ignorecase" /* GlobalMetadataOptionNames.ignoreCase */]);
    let rawConfigJson = '';
    const sourceFileNames = [];
    const files = {};
    for (const file of testData.files) {
        // if one of file is configuration file, set config options from the given json
        if (isConfig(file, ignoreCase)) {
            try {
                rawConfigJson = JSONC.parse(file.content);
            }
            catch (e) {
                throw new Error(`Failed to parse test ${file.fileName}: ${e.message}`);
            }
        }
        else {
            files[file.fileName] = new vfs.File(file.content, { meta: file.fileOptions, encoding: 'utf8' });
            if (!(0, core_1.toBoolean)(file.fileOptions["library" /* MetadataOptionNames.library */])) {
                sourceFileNames.push(file.fileName);
            }
        }
    }
    return { files, sourceFileNames, projectRoot, ignoreCase, rawConfigJson };
}
exports.createVfsInfoFromFourSlashData = createVfsInfoFromFourSlashData;
function getMarkerName(testData, markerToFind) {
    let found;
    testData.markerPositions.forEach((marker, name) => {
        if (marker === markerToFind) {
            found = name;
        }
    });
    assert_1.default.ok(found);
    return found;
}
exports.getMarkerName = getMarkerName;
function getMarkerByName(testData, markerName) {
    const markerPos = testData.markerPositions.get(markerName);
    if (markerPos === undefined) {
        throw new Error(`Unknown marker "${markerName}" Available markers: ${getMarkerNames(testData)
            .map((m) => '"' + m + '"')
            .join(', ')}`);
    }
    else {
        return markerPos;
    }
}
exports.getMarkerByName = getMarkerByName;
function getMarkerNames(testData) {
    return [...testData.markerPositions.keys()];
}
exports.getMarkerNames = getMarkerNames;
function isConfig(file, ignoreCase) {
    const comparer = (0, stringUtils_1.getStringComparer)(ignoreCase);
    return comparer((0, pathUtils_1.getBaseFileName)(file.fileName), service_1.configFileName) === 0 /* Comparison.EqualTo */;
}
//# sourceMappingURL=testStateUtils.js.map