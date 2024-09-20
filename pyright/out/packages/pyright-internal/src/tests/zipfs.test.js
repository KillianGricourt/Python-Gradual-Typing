"use strict";
/*
 * zipfs.test.ts
 *
 * zip/egg file related FS tests.
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
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
const realFileSystem_1 = require("../common/realFileSystem");
const stringUtils_1 = require("../common/stringUtils");
const uri_1 = require("../common/uri/uri");
function runTests(p) {
    const tempFile = new realFileSystem_1.RealTempFile();
    const zipRoot = uri_1.Uri.file(path.resolve(path.dirname(module.filename), p), tempFile);
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile);
    test('stat root', () => {
        const stats = fs.statSync(zipRoot);
        assert.strictEqual(stats.isDirectory(), true);
        assert.strictEqual(stats.isFile(), false);
        assert.strictEqual(stats.isZipDirectory(), true);
        assert.strictEqual(stats.isSymbolicLink(), false);
    });
    test('readdirEntriesSync root', () => {
        const entries = fs.readdirEntriesSync(zipRoot);
        assert.strictEqual(entries.length, 2);
        entries.sort((a, b) => (0, stringUtils_1.compareStringsCaseSensitive)(a.name, b.name));
        assert.strictEqual(entries[0].name, 'EGG-INFO');
        assert.strictEqual(entries[0].isDirectory(), true);
        assert.strictEqual(entries[0].isFile(), false);
        assert.strictEqual(entries[1].name, 'test');
        assert.strictEqual(entries[1].isDirectory(), true);
        assert.strictEqual(entries[1].isFile(), false);
    });
    test('stat EGG-INFO', () => {
        const stats = fs.statSync(zipRoot.combinePaths('EGG-INFO'));
        assert.strictEqual(stats.isDirectory(), true);
        assert.strictEqual(stats.isFile(), false);
    });
    test('readdirEntriesSync root', () => {
        const entries = fs.readdirEntriesSync(zipRoot.combinePaths('EGG-INFO'));
        assert.strictEqual(entries.length, 5);
        entries.sort((a, b) => (0, stringUtils_1.compareStringsCaseSensitive)(a.name, b.name));
        assert.strictEqual(entries[0].name, 'PKG-INFO');
        assert.strictEqual(entries[0].isDirectory(), false);
        assert.strictEqual(entries[0].isFile(), true);
        assert.strictEqual(entries[1].name, 'SOURCES.txt');
        assert.strictEqual(entries[1].isDirectory(), false);
        assert.strictEqual(entries[1].isFile(), true);
        assert.strictEqual(entries[2].name, 'dependency_links.txt');
        assert.strictEqual(entries[2].isDirectory(), false);
        assert.strictEqual(entries[2].isFile(), true);
        assert.strictEqual(entries[3].name, 'top_level.txt');
        assert.strictEqual(entries[3].isDirectory(), false);
        assert.strictEqual(entries[3].isFile(), true);
        assert.strictEqual(entries[4].name, 'zip-safe');
        assert.strictEqual(entries[4].isDirectory(), false);
        assert.strictEqual(entries[4].isFile(), true);
    });
    test('read file', () => {
        const contents = fs.readFileSync(zipRoot.combinePaths('EGG-INFO', 'top_level.txt'), 'utf-8');
        assert.strictEqual(contents.trim(), 'test');
    });
    test('read file async', async () => {
        const contents = await fs.readFileText(zipRoot.combinePaths('EGG-INFO', 'top_level.txt'), 'utf-8');
        assert.strictEqual(contents.trim(), 'test');
    });
    test('unlink fails', async () => {
        expect(() => {
            fs.unlinkSync(zipRoot.combinePaths('EGG-INFO', 'top_level.txt'));
        }).toThrow(/read-only filesystem/);
    });
    test('isInZip', () => {
        assert.strictEqual(fs.isInZip(zipRoot.combinePaths('EGG-INFO', 'top_level.txt')), true);
        assert.strictEqual(fs.isInZip(uri_1.Uri.file(module.filename, tempFile)), false);
    });
}
describe('zip', () => runTests('./samples/zipfs/basic.zip'));
describe('egg', () => runTests('./samples/zipfs/basic.egg'));
describe('jar', () => runTests('./samples/zipfs/basic.jar'));
function runBadTests(p) {
    const tempFile = new realFileSystem_1.RealTempFile();
    const zipRoot = uri_1.Uri.file(path.resolve(path.dirname(module.filename), p), tempFile);
    const fs = (0, realFileSystem_1.createFromRealFileSystem)(tempFile);
    test('stat root', () => {
        const stats = fs.statSync(zipRoot);
        assert.strictEqual(stats.isDirectory(), false);
        assert.strictEqual(stats.isFile(), true);
    });
    test('isInZip', () => {
        assert.strictEqual(fs.isInZip(zipRoot.combinePaths('EGG-INFO', 'top_level.txt')), false);
    });
}
describe('corrupt zip', () => runBadTests('./samples/zipfs/bad.zip'));
describe('corrupt egg', () => runBadTests('./samples/zipfs/bad.egg'));
describe('corrupt jar', () => runBadTests('./samples/zipfs/bad.jar'));
describe('corrupt zip with magic', () => runBadTests('./samples/zipfs/corrupt.zip'));
describe('corrupt egg with magic', () => runBadTests('./samples/zipfs/corrupt.egg'));
describe('corrupt jar with magic', () => runBadTests('./samples/zipfs/corrupt.jar'));
//# sourceMappingURL=zipfs.test.js.map