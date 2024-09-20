"use strict";
/*
 * completionProviderUtils.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 *
 * Helper functions for providing completions
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCompletionItemDocumentation = exports.getTypeDetail = void 0;
const vscode_languageserver_types_1 = require("vscode-languageserver-types");
const typeUtils_1 = require("../analyzer/typeUtils");
const types_1 = require("../analyzer/types");
const tooltipUtils_1 = require("./tooltipUtils");
const typeDocStringUtils_1 = require("../analyzer/typeDocStringUtils");
function getTypeDetail(evaluator, type, primaryDecl, name, detail, functionSignatureDisplay) {
    if (!primaryDecl) {
        if ((0, types_1.isModule)(type)) {
            // Special casing import modules.
            // submodule imported through `import` statement doesn't have
            // corresponding decls. so use given name as it is.
            //
            // ex) import X.Y
            // X.[Y]
            return name;
        }
        return;
    }
    switch (primaryDecl.type) {
        case 0 /* DeclarationType.Intrinsic */:
        case 1 /* DeclarationType.Variable */:
        case 2 /* DeclarationType.Parameter */:
        case 3 /* DeclarationType.TypeParameter */: {
            let expandTypeAlias = false;
            if (type && types_1.TypeBase.isInstantiable(type)) {
                const typeAliasInfo = (0, types_1.getTypeAliasInfo)(type);
                if (typeAliasInfo) {
                    if (typeAliasInfo.name === name) {
                        expandTypeAlias = true;
                    }
                }
            }
            // Handle the case where type is a function and was assigned to a variable.
            if (type.category === 5 /* TypeCategory.OverloadedFunction */ || type.category === 4 /* TypeCategory.Function */) {
                return (0, tooltipUtils_1.getToolTipForType)(type, 
                /* label */ '', name, evaluator, 
                /* isProperty */ false, functionSignatureDisplay);
            }
            else {
                return name + ': ' + evaluator.printType(type, { expandTypeAlias });
            }
        }
        case 5 /* DeclarationType.Function */: {
            const functionType = (detail === null || detail === void 0 ? void 0 : detail.boundObjectOrClass) && ((0, types_1.isFunction)(type) || (0, types_1.isOverloadedFunction)(type))
                ? evaluator.bindFunctionToClassOrObject(detail.boundObjectOrClass, type)
                : type;
            if (!functionType) {
                return undefined;
            }
            if ((0, typeUtils_1.isProperty)(functionType) && (detail === null || detail === void 0 ? void 0 : detail.boundObjectOrClass) && (0, types_1.isClassInstance)(detail.boundObjectOrClass)) {
                const propertyType = evaluator.getGetterTypeFromProperty(functionType, /* inferTypeIfNeeded */ true) ||
                    types_1.UnknownType.create();
                return name + ': ' + evaluator.printType(propertyType) + ' (property)';
            }
            return (0, tooltipUtils_1.getToolTipForType)(functionType, 
            /* label */ '', name, evaluator, 
            /* isProperty */ false, functionSignatureDisplay);
        }
        case 6 /* DeclarationType.Class */:
        case 7 /* DeclarationType.SpecialBuiltInClass */: {
            return 'class ' + name + '()';
        }
        case 8 /* DeclarationType.Alias */: {
            return name;
        }
        default: {
            return name;
        }
    }
}
exports.getTypeDetail = getTypeDetail;
function getCompletionItemDocumentation(serviceProvider, typeDetail, documentation, markupKind, declaration) {
    if (markupKind === vscode_languageserver_types_1.MarkupKind.Markdown) {
        let markdownString = '```python\n' + typeDetail + '\n```\n';
        if (documentation) {
            markdownString += '---\n';
            markdownString += serviceProvider
                .docStringService()
                .convertDocStringToMarkdown(documentation, (0, typeDocStringUtils_1.isBuiltInModule)(declaration === null || declaration === void 0 ? void 0 : declaration.uri));
        }
        markdownString = markdownString.trimEnd();
        return {
            kind: vscode_languageserver_types_1.MarkupKind.Markdown,
            value: markdownString,
        };
    }
    else if (markupKind === vscode_languageserver_types_1.MarkupKind.PlainText) {
        let plainTextString = typeDetail + '\n';
        if (documentation) {
            plainTextString += '\n';
            plainTextString += serviceProvider.docStringService().convertDocStringToPlainText(documentation);
        }
        plainTextString = plainTextString.trimEnd();
        return {
            kind: vscode_languageserver_types_1.MarkupKind.PlainText,
            value: plainTextString,
        };
    }
    return undefined;
}
exports.getCompletionItemDocumentation = getCompletionItemDocumentation;
//# sourceMappingURL=completionProviderUtils.js.map