"use strict";
/*
 * pythonPathUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Utility routines used to resolve various paths in Python.
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPathsFromPthFiles = exports.isPythonBinary = exports.findPythonSearchPaths = exports.getTypeshedSubdirectory = exports.getTypeShedFallbackPath = exports.thirdPartyFolderName = exports.stdLibFolderName = void 0;
const core_1 = require("../common/core");
const pathConsts = __importStar(require("../common/pathConsts"));
const uriUtils_1 = require("../common/uri/uriUtils");
exports.stdLibFolderName = 'stdlib';
exports.thirdPartyFolderName = 'stubs';
function getTypeShedFallbackPath(fs) {
    const moduleDirectory = fs.getModulePath();
    if (!moduleDirectory || moduleDirectory.isEmpty()) {
        return undefined;
    }
    const typeshedPath = moduleDirectory.combinePaths(pathConsts.typeshedFallback);
    if (fs.existsSync(typeshedPath)) {
        return fs.realCasePath(typeshedPath);
    }
    // In the debug version of Pyright, the code is one level
    // deeper, so we need to look one level up for the typeshed fallback.
    const debugTypeshedPath = moduleDirectory.getDirectory().combinePaths(pathConsts.typeshedFallback);
    if (fs.existsSync(debugTypeshedPath)) {
        return fs.realCasePath(debugTypeshedPath);
    }
    return undefined;
}
exports.getTypeShedFallbackPath = getTypeShedFallbackPath;
function getTypeshedSubdirectory(typeshedPath, isStdLib) {
    return typeshedPath.combinePaths(isStdLib ? exports.stdLibFolderName : exports.thirdPartyFolderName);
}
exports.getTypeshedSubdirectory = getTypeshedSubdirectory;
function findPythonSearchPaths(fs, configOptions, host, importFailureInfo, includeWatchPathsOnly, workspaceRoot) {
    importFailureInfo.push('Finding python search paths');
    if (configOptions.venvPath !== undefined && configOptions.venv) {
        const venvDir = configOptions.venv;
        const venvPath = configOptions.venvPath.combinePaths(venvDir);
        const foundPaths = [];
        const sitePackagesPaths = [];
        [pathConsts.lib, pathConsts.lib64, pathConsts.libAlternate].forEach((libPath) => {
            const sitePackagesPath = findSitePackagesPath(fs, venvPath.combinePaths(libPath), configOptions.defaultPythonVersion, importFailureInfo);
            if (sitePackagesPath) {
                addPathIfUnique(foundPaths, sitePackagesPath);
                sitePackagesPaths.push(fs.realCasePath(sitePackagesPath));
            }
        });
        // Now add paths from ".pth" files located in each of the site packages folders.
        sitePackagesPaths.forEach((sitePackagesPath) => {
            const pthPaths = getPathsFromPthFiles(fs, sitePackagesPath);
            pthPaths.forEach((path) => {
                addPathIfUnique(foundPaths, path);
            });
        });
        if (foundPaths.length > 0) {
            importFailureInfo.push(`Found the following '${pathConsts.sitePackages}' dirs`);
            foundPaths.forEach((path) => {
                importFailureInfo.push(`  ${path}`);
            });
            return foundPaths;
        }
        importFailureInfo.push(`Did not find any '${pathConsts.sitePackages}' dirs. Falling back on python interpreter.`);
    }
    // Fall back on the python interpreter.
    const pathResult = host.getPythonSearchPaths(configOptions.pythonPath, importFailureInfo);
    if (includeWatchPathsOnly && workspaceRoot) {
        const paths = pathResult.paths
            .filter((p) => !p.startsWith(workspaceRoot) || p.startsWith(pathResult.prefix))
            .map((p) => fs.realCasePath(p));
        return paths;
    }
    return pathResult.paths.map((p) => fs.realCasePath(p));
}
exports.findPythonSearchPaths = findPythonSearchPaths;
function isPythonBinary(p) {
    p = p.trim();
    return p === 'python' || p === 'python3';
}
exports.isPythonBinary = isPythonBinary;
function findSitePackagesPath(fs, libPath, pythonVersion, importFailureInfo) {
    if (fs.existsSync(libPath)) {
        importFailureInfo.push(`Found path '${libPath}'; looking for ${pathConsts.sitePackages}`);
    }
    else {
        importFailureInfo.push(`Did not find '${libPath}'`);
        return undefined;
    }
    const sitePackagesPath = libPath.combinePaths(pathConsts.sitePackages);
    if (fs.existsSync(sitePackagesPath)) {
        importFailureInfo.push(`Found path '${sitePackagesPath}'`);
        return sitePackagesPath;
    }
    else {
        importFailureInfo.push(`Did not find '${sitePackagesPath}', so looking for python subdirectory`);
    }
    // We didn't find a site-packages directory directly in the lib
    // directory. Scan for a "python3.X" directory instead.
    const entries = (0, uriUtils_1.getFileSystemEntries)(fs, libPath);
    // Candidate directories start with "python3.".
    const candidateDirs = entries.directories.filter((dirName) => {
        if (dirName.fileName.startsWith('python3.')) {
            const dirPath = dirName.combinePaths(pathConsts.sitePackages);
            return fs.existsSync(dirPath);
        }
        return false;
    });
    // If there is a python3.X directory (where 3.X matches the configured python
    // version), prefer that over other python directories.
    if (pythonVersion) {
        const preferredDir = candidateDirs.find((dirName) => dirName.fileName === `python${pythonVersion.toMajorMinorString()}`);
        if (preferredDir) {
            const dirPath = preferredDir.combinePaths(pathConsts.sitePackages);
            importFailureInfo.push(`Found path '${dirPath}'`);
            return dirPath;
        }
    }
    // If there was no python version or we didn't find an exact match, use the
    // first directory that starts with "python". Most of the time, there will be
    // only one.
    if (candidateDirs.length > 0) {
        const dirPath = candidateDirs[0].combinePaths(pathConsts.sitePackages);
        importFailureInfo.push(`Found path '${dirPath}'`);
        return dirPath;
    }
    return undefined;
}
function getPathsFromPthFiles(fs, parentDir) {
    const searchPaths = [];
    // Get a list of all *.pth files within the specified directory.
    const pthFiles = fs
        .readdirEntriesSync(parentDir)
        .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith('.pth'))
        .sort((a, b) => (0, core_1.compareComparableValues)(a.name, b.name));
    pthFiles.forEach((pthFile) => {
        const filePath = fs.realCasePath(parentDir.combinePaths(pthFile.name));
        const fileStats = (0, uriUtils_1.tryStat)(fs, filePath);
        // Skip all files that are much larger than expected.
        if ((fileStats === null || fileStats === void 0 ? void 0 : fileStats.isFile()) && fileStats.size > 0 && fileStats.size < 64 * 1024) {
            const data = fs.readFileSync(filePath, 'utf8');
            const lines = data.split(/\r?\n/);
            lines.forEach((line) => {
                const trimmedLine = line.trim();
                if (trimmedLine.length > 0 && !trimmedLine.startsWith('#') && !trimmedLine.match(/^import\s/)) {
                    const pthPath = parentDir.combinePaths(trimmedLine);
                    if (fs.existsSync(pthPath) && (0, uriUtils_1.isDirectory)(fs, pthPath)) {
                        searchPaths.push(fs.realCasePath(pthPath));
                    }
                }
            });
        }
    });
    return searchPaths;
}
exports.getPathsFromPthFiles = getPathsFromPthFiles;
function addPathIfUnique(pathList, pathToAdd) {
    if (!pathList.some((path) => path.key === pathToAdd.key)) {
        pathList.push(pathToAdd);
        return true;
    }
    return false;
}
//# sourceMappingURL=pythonPathUtils.js.map