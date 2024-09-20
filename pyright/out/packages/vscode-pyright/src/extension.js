"use strict";
/*
 * extension.ts
 *
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Provides client for Pyright Python language server. This portion runs
 * in the context of the VS Code process and talks to the server, which
 * runs in another process.
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
exports.deactivate = exports.activate = void 0;
const path = __importStar(require("path"));
const vscode_1 = require("vscode");
const node_1 = require("vscode-languageclient/node");
const commands_1 = require("pyright-internal/commands/commands");
const core_1 = require("pyright-internal/common/core");
const cancellationUtils_1 = require("./cancellationUtils");
let cancellationStrategy;
let languageClient;
const pythonPathChangedListenerMap = new Map();
// Request a heap size of 3GB. This is reasonable for modern systems.
const defaultHeapSize = 3072;
async function activate(context) {
    // See if Pylance is installed. If so, don't activate the Pyright extension.
    // Doing so will generate "command already registered" errors and redundant
    // hover text, etc.because the two extensions overlap in functionality.
    const pylanceExtension = vscode_1.extensions.getExtension('ms-python.vscode-pylance');
    if (pylanceExtension) {
        vscode_1.window.showErrorMessage('Pyright has detected that the Pylance extension is installed. ' +
            'Pylance includes the functionality of Pyright, and running both of ' +
            'these extensions can lead to problems. Pyright will disable itself. ' +
            'Uninstall or disable Pyright to avoid this message.');
        return;
    }
    cancellationStrategy = new cancellationUtils_1.FileBasedCancellationStrategy();
    const bundlePath = context.asAbsolutePath(path.join('dist', 'server.js'));
    const runOptions = { execArgv: [`--max-old-space-size=${defaultHeapSize}`] };
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6600', `--max-old-space-size=${defaultHeapSize}`] };
    // If the extension is launched in debug mode, then the debug server options are used.
    const serverOptions = {
        run: {
            module: bundlePath,
            transport: node_1.TransportKind.ipc,
            args: cancellationStrategy.getCommandLineArguments(),
            options: runOptions,
        },
        // In debug mode, use the non-bundled code if it's present. The production
        // build includes only the bundled package, so we don't want to crash if
        // someone starts the production extension in debug mode.
        debug: {
            module: bundlePath,
            transport: node_1.TransportKind.ipc,
            args: cancellationStrategy.getCommandLineArguments(),
            options: debugOptions,
        },
    };
    // Options to control the language client
    const clientOptions = {
        // Register the server for python source files.
        documentSelector: [
            { scheme: 'file', language: 'python' },
            { scheme: 'untitled', language: 'python' },
        ],
        synchronize: {
            // Synchronize the setting section to the server.
            configurationSection: ['python', 'pyright'],
        },
        connectionOptions: { cancellationStrategy: cancellationStrategy },
        middleware: {
            // Use the middleware hook to override the configuration call. This allows
            // us to inject the proper "python.pythonPath" setting from the Python extension's
            // private settings store.
            workspace: {
                configuration: async (params, token, next) => {
                    let result = next(params, token);
                    if ((0, core_1.isThenable)(result)) {
                        result = await result;
                    }
                    if (result instanceof node_1.ResponseError) {
                        return result;
                    }
                    for (const [i, item] of params.items.entries()) {
                        if (item.section === 'python.analysis') {
                            const analysisConfig = vscode_1.workspace.getConfiguration(item.section, item.scopeUri ? vscode_1.Uri.parse(item.scopeUri) : undefined);
                            // If stubPath is not set, remove it rather than sending default value.
                            // This lets the server know that it's unset rather than explicitly
                            // set to the default value (typings) so it can behave differently.
                            if (!isConfigSettingSetByUser(analysisConfig, 'stubPath')) {
                                delete result[i].stubPath;
                            }
                        }
                    }
                    // For backwards compatibility, set python.pythonPath to the configured
                    // value as though it were in the user's settings.json file.
                    const addPythonPath = (settings) => {
                        const pythonPathPromises = params.items.map((item) => {
                            if (item.section === 'python') {
                                const uri = item.scopeUri ? vscode_1.Uri.parse(item.scopeUri) : undefined;
                                return getPythonPathFromPythonExtension(client.outputChannel, uri, () => {
                                    // Posts a "workspace/didChangeConfiguration" message to the service
                                    // so it re-queries the settings for all workspaces.
                                    client.sendNotification(node_1.DidChangeConfigurationNotification.type, {
                                        settings: null,
                                    });
                                });
                            }
                            return Promise.resolve(undefined);
                        });
                        return Promise.all(pythonPathPromises).then((pythonPaths) => {
                            pythonPaths.forEach((pythonPath, i) => {
                                // If there is a pythonPath returned by the Python extension,
                                // always prefer this over the pythonPath that uses the old
                                // mechanism.
                                if (pythonPath !== undefined) {
                                    settings[i].pythonPath = pythonPath;
                                }
                            });
                            return settings;
                        });
                    };
                    return addPythonPath(result);
                },
            },
        },
    };
    // Create the language client and start the client.
    const client = new node_1.LanguageClient('python', 'Pyright', serverOptions, clientOptions);
    languageClient = client;
    // Register our custom commands.
    const textEditorCommands = [commands_1.Commands.orderImports];
    textEditorCommands.forEach((commandName) => {
        context.subscriptions.push(vscode_1.commands.registerTextEditorCommand(commandName, (editor, edit, ...args) => {
            const cmd = {
                command: commandName,
                arguments: [editor.document.uri.toString(), ...args],
            };
            client.sendRequest('workspace/executeCommand', cmd).then((edits) => {
                if (edits && edits.length > 0) {
                    editor.edit((editBuilder) => {
                        edits.forEach((edit) => {
                            const startPos = new vscode_1.Position(edit.range.start.line, edit.range.start.character);
                            const endPos = new vscode_1.Position(edit.range.end.line, edit.range.end.character);
                            const range = new vscode_1.Range(startPos, endPos);
                            editBuilder.replace(range, edit.newText);
                        });
                    });
                }
            });
        }, () => {
            // Error received. For now, do nothing.
        }));
    });
    const genericCommands = [commands_1.Commands.createTypeStub, commands_1.Commands.restartServer];
    genericCommands.forEach((command) => {
        context.subscriptions.push(vscode_1.commands.registerCommand(command, (...args) => {
            client.sendRequest('workspace/executeCommand', { command, arguments: args });
        }));
    });
    // Register the debug only commands when running under the debugger.
    if (context.extensionMode === vscode_1.ExtensionMode.Development) {
        // Create a 'when' context for development.
        vscode_1.commands.executeCommand('setContext', 'pyright.development', true);
        // Register the commands that only work when in development mode.
        context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.dumpTokens, () => {
            var _a;
            const uri = (_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri.toString();
            if (uri) {
                client.sendRequest('workspace/executeCommand', {
                    command: commands_1.Commands.dumpFileDebugInfo,
                    arguments: [uri, 'tokens'],
                });
            }
        }));
        context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.dumpNodes, () => {
            var _a;
            const uri = (_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri.toString();
            if (uri) {
                client.sendRequest('workspace/executeCommand', {
                    command: commands_1.Commands.dumpFileDebugInfo,
                    arguments: [uri, 'nodes'],
                });
            }
        }));
        context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.dumpTypes, () => {
            var _a;
            const uri = (_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri.toString();
            if (uri) {
                const start = vscode_1.window.activeTextEditor.selection.start;
                const end = vscode_1.window.activeTextEditor.selection.end;
                const startOffset = vscode_1.window.activeTextEditor.document.offsetAt(start);
                const endOffset = vscode_1.window.activeTextEditor.document.offsetAt(end);
                client.sendRequest('workspace/executeCommand', {
                    command: commands_1.Commands.dumpFileDebugInfo,
                    arguments: [uri, 'types', startOffset, endOffset],
                });
            }
        }));
        context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.dumpCachedTypes, () => {
            var _a;
            const uri = (_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri.toString();
            if (uri) {
                const start = vscode_1.window.activeTextEditor.selection.start;
                const end = vscode_1.window.activeTextEditor.selection.end;
                const startOffset = vscode_1.window.activeTextEditor.document.offsetAt(start);
                const endOffset = vscode_1.window.activeTextEditor.document.offsetAt(end);
                client.sendRequest('workspace/executeCommand', {
                    command: commands_1.Commands.dumpFileDebugInfo,
                    arguments: [uri, 'cachedtypes', startOffset, endOffset],
                });
            }
        }));
        context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.dumpCodeFlowGraph, () => {
            var _a;
            const uri = (_a = vscode_1.window.activeTextEditor) === null || _a === void 0 ? void 0 : _a.document.uri.toString();
            if (uri) {
                const start = vscode_1.window.activeTextEditor.selection.start;
                const startOffset = vscode_1.window.activeTextEditor.document.offsetAt(start);
                client.sendRequest('workspace/executeCommand', {
                    command: commands_1.Commands.dumpFileDebugInfo,
                    arguments: [uri, 'codeflowgraph', startOffset],
                });
            }
        }));
    }
    await client.start();
}
exports.activate = activate;
function deactivate() {
    if (cancellationStrategy) {
        cancellationStrategy.dispose();
        cancellationStrategy = undefined;
    }
    const client = languageClient;
    languageClient = undefined;
    return client === null || client === void 0 ? void 0 : client.stop();
}
exports.deactivate = deactivate;
// The VS Code Python extension manages its own internal store of configuration settings.
// The setting that was traditionally named "python.pythonPath" has been moved to the
// Python extension's internal store for reasons of security and because it differs per
// project and by user.
async function getPythonPathFromPythonExtension(outputChannel, scopeUri, postConfigChanged) {
    var _a, _b;
    try {
        const extension = vscode_1.extensions.getExtension('ms-python.python');
        if (!extension) {
            outputChannel.appendLine('Python extension not found');
        }
        else {
            if ((_b = (_a = extension.packageJSON) === null || _a === void 0 ? void 0 : _a.featureFlags) === null || _b === void 0 ? void 0 : _b.usingNewInterpreterStorage) {
                if (!extension.isActive) {
                    outputChannel.appendLine('Waiting for Python extension to load');
                    await extension.activate();
                    outputChannel.appendLine('Python extension loaded');
                }
                const execDetails = await extension.exports.settings.getExecutionDetails(scopeUri);
                let result;
                if (execDetails.execCommand && execDetails.execCommand.length > 0) {
                    result = execDetails.execCommand[0];
                }
                if (extension.exports.settings.onDidChangeExecutionDetails) {
                    installPythonPathChangedListener(extension.exports.settings.onDidChangeExecutionDetails, scopeUri, postConfigChanged);
                }
                if (!result) {
                    outputChannel.appendLine(`No pythonPath provided by Python extension`);
                }
                else {
                    outputChannel.appendLine(`Received pythonPath from Python extension: ${result}`);
                }
                return result;
            }
        }
    }
    catch (error) {
        outputChannel.appendLine(`Exception occurred when attempting to read pythonPath from Python extension: ${JSON.stringify(error)}`);
    }
    return undefined;
}
function installPythonPathChangedListener(onDidChangeExecutionDetails, scopeUri, postConfigChanged) {
    const uriString = scopeUri ? scopeUri.toString() : '';
    // No need to install another listener for this URI if
    // it already exists.
    if (pythonPathChangedListenerMap.has(uriString)) {
        return;
    }
    onDidChangeExecutionDetails(() => {
        postConfigChanged();
    });
    pythonPathChangedListenerMap.set(uriString, uriString);
}
function isConfigSettingSetByUser(configuration, setting) {
    const inspect = configuration.inspect(setting);
    if (inspect === undefined) {
        return false;
    }
    return (inspect.globalValue !== undefined ||
        inspect.workspaceValue !== undefined ||
        inspect.workspaceFolderValue !== undefined ||
        inspect.globalLanguageValue !== undefined ||
        inspect.workspaceLanguageValue !== undefined ||
        inspect.workspaceFolderLanguageValue !== undefined);
}
//# sourceMappingURL=extension.js.map