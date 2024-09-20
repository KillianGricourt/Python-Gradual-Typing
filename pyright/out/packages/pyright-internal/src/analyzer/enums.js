"use strict";
/*
 * enums.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Provides special-case logic for the Enum class.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnumAutoValueType = exports.getTypeOfEnumMember = exports.getEnumDeclaredValueType = exports.isDeclInEnumClass = exports.transformTypeForEnumMember = exports.createEnumType = exports.isEnumClassWithMembers = exports.isEnumMetaclass = void 0;
const debug_1 = require("../common/debug");
const analyzerNodeInfo_1 = require("./analyzerNodeInfo");
const parseTreeUtils_1 = require("./parseTreeUtils");
const symbol_1 = require("./symbol");
const symbolNameUtils_1 = require("./symbolNameUtils");
const typeGuards_1 = require("./typeGuards");
const typeUtils_1 = require("./typeUtils");
const types_1 = require("./types");
// Determines whether the class is an Enum metaclass or a subclass thereof.
function isEnumMetaclass(classType) {
    return classType.details.mro.some((mroClass) => (0, types_1.isClass)(mroClass) && types_1.ClassType.isBuiltIn(mroClass, ['EnumMeta', 'EnumType']));
}
exports.isEnumMetaclass = isEnumMetaclass;
// Determines whether this is an enum class that has at least one enum
// member defined.
function isEnumClassWithMembers(evaluator, classType) {
    if (!(0, types_1.isClass)(classType) || !types_1.ClassType.isEnumClass(classType)) {
        return false;
    }
    // Determine whether the enum class defines a member.
    let definesMember = false;
    types_1.ClassType.getSymbolTable(classType).forEach((symbol, name) => {
        const symbolType = transformTypeForEnumMember(evaluator, classType, name);
        if (symbolType && (0, types_1.isClassInstance)(symbolType) && types_1.ClassType.isSameGenericClass(symbolType, classType)) {
            definesMember = true;
        }
    });
    return definesMember;
}
exports.isEnumClassWithMembers = isEnumClassWithMembers;
// Creates a new custom enum class with named values.
function createEnumType(evaluator, errorNode, enumClass, argList) {
    const fileInfo = (0, analyzerNodeInfo_1.getFileInfo)(errorNode);
    if (argList.length === 0) {
        return undefined;
    }
    const nameArg = argList[0];
    if (nameArg.argumentCategory !== 0 /* ArgumentCategory.Simple */ ||
        !nameArg.valueExpression ||
        nameArg.valueExpression.nodeType !== 48 /* ParseNodeType.StringList */ ||
        nameArg.valueExpression.strings.length !== 1 ||
        nameArg.valueExpression.strings[0].nodeType !== 49 /* ParseNodeType.String */) {
        return undefined;
    }
    const className = nameArg.valueExpression.strings.map((s) => s.value).join('');
    const classType = types_1.ClassType.createInstantiable(className, (0, parseTreeUtils_1.getClassFullName)(errorNode, fileInfo.moduleName, className), fileInfo.moduleName, fileInfo.fileUri, 65536 /* ClassTypeFlags.EnumClass */ | 4194304 /* ClassTypeFlags.ValidTypeAliasClass */, (0, parseTreeUtils_1.getTypeSourceId)(errorNode), 
    /* declaredMetaclass */ undefined, enumClass.details.effectiveMetaclass);
    classType.details.baseClasses.push(enumClass);
    (0, typeUtils_1.computeMroLinearization)(classType);
    const classFields = types_1.ClassType.getSymbolTable(classType);
    classFields.set('__class__', symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */ | 64 /* SymbolFlags.IgnoredForProtocolMatch */, classType));
    if (argList.length < 2) {
        return undefined;
    }
    const initArg = argList[1];
    if (initArg.argumentCategory !== 0 /* ArgumentCategory.Simple */ || !initArg.valueExpression) {
        return undefined;
    }
    const intClassType = evaluator.getBuiltInType(errorNode, 'int');
    if (!intClassType || !(0, types_1.isInstantiableClass)(intClassType)) {
        return undefined;
    }
    const classInstanceType = types_1.ClassType.cloneAsInstance(classType);
    // The Enum functional form supports various forms of arguments:
    //   Enum('name', 'a b c')
    //   Enum('name', 'a,b,c')
    //   Enum('name', ['a', 'b', 'c'])
    //   Enum('name', ('a', 'b', 'c'))
    //   Enum('name', (('a', 1), ('b', 2), ('c', 3)))
    //   Enum('name', [('a', 1), ('b', 2), ('c', 3))]
    //   Enum('name', {'a': 1, 'b': 2, 'c': 3})
    if (initArg.valueExpression.nodeType === 48 /* ParseNodeType.StringList */) {
        // Don't allow format strings in the init arg.
        if (!initArg.valueExpression.strings.every((str) => str.nodeType === 49 /* ParseNodeType.String */)) {
            return undefined;
        }
        const initStr = initArg.valueExpression.strings
            .map((s) => s.value)
            .join('')
            .trim();
        // Split by comma or whitespace.
        const entryNames = initStr.split(/[\s,]+/);
        for (const [index, entryName] of entryNames.entries()) {
            if (!entryName) {
                return undefined;
            }
            const valueType = types_1.ClassType.cloneWithLiteral(types_1.ClassType.cloneAsInstance(intClassType), index + 1);
            const enumLiteral = new types_1.EnumLiteral(classType.details.fullName, classType.details.name, entryName, valueType);
            const newSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, types_1.ClassType.cloneWithLiteral(classInstanceType, enumLiteral));
            classFields.set(entryName, newSymbol);
        }
        return classType;
    }
    if (initArg.valueExpression.nodeType === 34 /* ParseNodeType.List */ ||
        initArg.valueExpression.nodeType === 52 /* ParseNodeType.Tuple */) {
        const entries = initArg.valueExpression.nodeType === 34 /* ParseNodeType.List */
            ? initArg.valueExpression.entries
            : initArg.valueExpression.expressions;
        if (entries.length === 0) {
            return undefined;
        }
        // Entries can be either string literals or tuples of a string
        // literal and a value. All entries must follow the same pattern.
        let isSimpleString = false;
        for (const [index, entry] of entries.entries()) {
            if (index === 0) {
                isSimpleString = entry.nodeType === 48 /* ParseNodeType.StringList */;
            }
            let nameNode;
            let valueType;
            if (entry.nodeType === 48 /* ParseNodeType.StringList */) {
                if (!isSimpleString) {
                    return undefined;
                }
                nameNode = entry;
                valueType = types_1.ClassType.cloneWithLiteral(types_1.ClassType.cloneAsInstance(intClassType), index + 1);
            }
            else if (entry.nodeType === 52 /* ParseNodeType.Tuple */) {
                if (isSimpleString) {
                    return undefined;
                }
                if (entry.expressions.length !== 2) {
                    return undefined;
                }
                nameNode = entry.expressions[0];
                valueType = evaluator.getTypeOfExpression(entry.expressions[1]).type;
            }
            else {
                return undefined;
            }
            if (nameNode.nodeType !== 48 /* ParseNodeType.StringList */ ||
                nameNode.strings.length !== 1 ||
                nameNode.strings[0].nodeType !== 49 /* ParseNodeType.String */) {
                return undefined;
            }
            const entryName = nameNode.strings[0].value;
            const enumLiteral = new types_1.EnumLiteral(classType.details.fullName, classType.details.name, entryName, valueType);
            const newSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, types_1.ClassType.cloneWithLiteral(classInstanceType, enumLiteral));
            classFields.set(entryName, newSymbol);
        }
    }
    if (initArg.valueExpression.nodeType === 18 /* ParseNodeType.Dictionary */) {
        const entries = initArg.valueExpression.entries;
        if (entries.length === 0) {
            return undefined;
        }
        for (const entry of entries) {
            // Don't support dictionary expansion expressions.
            if (entry.nodeType !== 20 /* ParseNodeType.DictionaryKeyEntry */) {
                return undefined;
            }
            const nameNode = entry.keyExpression;
            const valueType = evaluator.getTypeOfExpression(entry.valueExpression).type;
            if (nameNode.nodeType !== 48 /* ParseNodeType.StringList */ ||
                nameNode.strings.length !== 1 ||
                nameNode.strings[0].nodeType !== 49 /* ParseNodeType.String */) {
                return undefined;
            }
            const entryName = nameNode.strings[0].value;
            const enumLiteral = new types_1.EnumLiteral(classType.details.fullName, classType.details.name, entryName, valueType);
            const newSymbol = symbol_1.Symbol.createWithType(4 /* SymbolFlags.ClassMember */, types_1.ClassType.cloneWithLiteral(classInstanceType, enumLiteral));
            classFields.set(entryName, newSymbol);
        }
    }
    return classType;
}
exports.createEnumType = createEnumType;
// Performs the "magic" that the Enum metaclass does at runtime when it
// transforms a value into an enum instance. If the specified name isn't
// an enum member, this function returns undefined indicating that the
// Enum metaclass does not transform the value.
// By default, if a type annotation is present, the member is not treated
// as a member of the enumeration, but the Enum metaclass ignores such
// annotations. The typing spec indicates that the use of an annotation is
// illegal, so we need to detect this case and report an error.
function transformTypeForEnumMember(evaluator, classType, memberName, ignoreAnnotation = false, recursionCount = 0) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (recursionCount > types_1.maxTypeRecursionCount) {
        return undefined;
    }
    recursionCount++;
    if (!types_1.ClassType.isEnumClass(classType)) {
        return undefined;
    }
    const memberInfo = (0, typeUtils_1.lookUpClassMember)(classType, memberName);
    if (!memberInfo || !(0, types_1.isClass)(memberInfo.classType) || !types_1.ClassType.isEnumClass(memberInfo.classType)) {
        return undefined;
    }
    const decls = memberInfo.symbol.getDeclarations();
    if (decls.length < 1) {
        return undefined;
    }
    const primaryDecl = decls[0];
    let isMemberOfEnumeration = false;
    let isUnpackedTuple = false;
    let valueTypeExprNode;
    let declaredTypeNode;
    let nameNode;
    if (primaryDecl.node.nodeType === 38 /* ParseNodeType.Name */) {
        nameNode = primaryDecl.node;
    }
    else if (primaryDecl.node.nodeType === 31 /* ParseNodeType.Function */) {
        // Handle the case where a method is decorated with @enum.member.
        nameNode = primaryDecl.node.name;
    }
    else {
        return undefined;
    }
    if (((_a = nameNode.parent) === null || _a === void 0 ? void 0 : _a.nodeType) === 3 /* ParseNodeType.Assignment */ && nameNode.parent.leftExpression === nameNode) {
        isMemberOfEnumeration = true;
        valueTypeExprNode = nameNode.parent.rightExpression;
    }
    else if (((_b = nameNode.parent) === null || _b === void 0 ? void 0 : _b.nodeType) === 52 /* ParseNodeType.Tuple */ &&
        ((_c = nameNode.parent.parent) === null || _c === void 0 ? void 0 : _c.nodeType) === 3 /* ParseNodeType.Assignment */) {
        isMemberOfEnumeration = true;
        isUnpackedTuple = true;
        valueTypeExprNode = nameNode.parent.parent.rightExpression;
    }
    else if (((_d = nameNode.parent) === null || _d === void 0 ? void 0 : _d.nodeType) === 54 /* ParseNodeType.TypeAnnotation */ &&
        nameNode.parent.valueExpression === nameNode) {
        if (ignoreAnnotation) {
            isMemberOfEnumeration = true;
        }
        declaredTypeNode = nameNode.parent.typeAnnotation;
    }
    // The spec specifically excludes names that start and end with a single underscore.
    // This also includes dunder names.
    if ((0, symbolNameUtils_1.isSingleDunderName)(memberName)) {
        return undefined;
    }
    // Specifically exclude "value" and "name". These are reserved by the enum metaclass.
    if (memberName === 'name' || memberName === 'value') {
        return undefined;
    }
    const declaredType = declaredTypeNode ? evaluator.getTypeOfAnnotation(declaredTypeNode) : undefined;
    let assignedType;
    if (valueTypeExprNode) {
        const evalFlags = (0, analyzerNodeInfo_1.getFileInfo)(valueTypeExprNode).isStubFile ? 1 /* EvalFlags.ConvertEllipsisToAny */ : undefined;
        assignedType = evaluator.getTypeOfExpression(valueTypeExprNode, evalFlags).type;
    }
    // Handle aliases to other enum members within the same enum.
    if ((valueTypeExprNode === null || valueTypeExprNode === void 0 ? void 0 : valueTypeExprNode.nodeType) === 38 /* ParseNodeType.Name */ && valueTypeExprNode.value !== memberName) {
        const aliasedEnumType = transformTypeForEnumMember(evaluator, classType, valueTypeExprNode.value, 
        /* ignoreAnnotation */ false, recursionCount);
        if (aliasedEnumType &&
            (0, types_1.isClassInstance)(aliasedEnumType) &&
            types_1.ClassType.isSameGenericClass(aliasedEnumType, types_1.ClassType.cloneAsInstance(memberInfo.classType)) &&
            aliasedEnumType.literalValue !== undefined) {
            return aliasedEnumType;
        }
    }
    if (primaryDecl.node.nodeType === 31 /* ParseNodeType.Function */) {
        const functionType = evaluator.getTypeOfFunction(primaryDecl.node);
        if (functionType) {
            assignedType = functionType.decoratedType;
        }
    }
    let valueType = (_e = declaredType !== null && declaredType !== void 0 ? declaredType : assignedType) !== null && _e !== void 0 ? _e : types_1.UnknownType.create();
    // If the LHS is an unpacked tuple, we need to handle this as
    // a special case.
    if (isUnpackedTuple) {
        valueType =
            (_g = (_f = evaluator.getTypeOfIterator({ type: valueType }, 
            /* isAsync */ false, nameNode, 
            /* emitNotIterableError */ false)) === null || _f === void 0 ? void 0 : _f.type) !== null && _g !== void 0 ? _g : types_1.UnknownType.create();
    }
    // The spec excludes descriptors.
    if ((0, types_1.isClassInstance)(valueType) && types_1.ClassType.getSymbolTable(valueType).get('__get__')) {
        return undefined;
    }
    // The spec excludes private (mangled) names.
    if ((0, symbolNameUtils_1.isPrivateName)(memberName)) {
        return undefined;
    }
    // The enum spec doesn't explicitly specify this, but it
    // appears that callables are excluded.
    if (!(0, types_1.findSubtype)(valueType, (subtype) => !(0, types_1.isFunction)(subtype) && !(0, types_1.isOverloadedFunction)(subtype))) {
        return undefined;
    }
    if (!assignedType &&
        ((_h = nameNode.parent) === null || _h === void 0 ? void 0 : _h.nodeType) === 3 /* ParseNodeType.Assignment */ &&
        nameNode.parent.leftExpression === nameNode) {
        assignedType = evaluator.getTypeOfExpression(nameNode.parent.rightExpression, 
        /* flags */ undefined, (0, typeUtils_1.makeInferenceContext)(declaredType)).type;
    }
    // Handle the Python 3.11 "enum.member()" and "enum.nonmember()" features.
    if (assignedType && (0, types_1.isClassInstance)(assignedType) && types_1.ClassType.isBuiltIn(assignedType)) {
        if (assignedType.details.fullName === 'enum.nonmember') {
            const nonMemberType = assignedType.typeArguments && assignedType.typeArguments.length > 0
                ? assignedType.typeArguments[0]
                : types_1.UnknownType.create();
            // If the type of the nonmember is declared and the assigned value has
            // a compatible type, use the declared type.
            if (declaredType && evaluator.assignType(declaredType, nonMemberType)) {
                return declaredType;
            }
            return nonMemberType;
        }
        if (assignedType.details.fullName === 'enum.member') {
            valueType =
                assignedType.typeArguments && assignedType.typeArguments.length > 0
                    ? assignedType.typeArguments[0]
                    : types_1.UnknownType.create();
            isMemberOfEnumeration = true;
        }
    }
    if (!isMemberOfEnumeration) {
        return undefined;
    }
    const enumLiteral = new types_1.EnumLiteral(memberInfo.classType.details.fullName, memberInfo.classType.details.name, memberName, valueType);
    return types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneWithLiteral(memberInfo.classType, enumLiteral));
}
exports.transformTypeForEnumMember = transformTypeForEnumMember;
function isDeclInEnumClass(evaluator, decl) {
    const classNode = (0, parseTreeUtils_1.getEnclosingClass)(decl.node, /* stopAtFunction */ true);
    if (!classNode) {
        return false;
    }
    const classInfo = evaluator.getTypeOfClass(classNode);
    if (!classInfo) {
        return false;
    }
    return types_1.ClassType.isEnumClass(classInfo.classType);
}
exports.isDeclInEnumClass = isDeclInEnumClass;
function getEnumDeclaredValueType(evaluator, classType, declaredTypesOnly = false) {
    // See if there is a declared type for "_value_".
    let valueType;
    const declaredValueMember = (0, typeUtils_1.lookUpClassMember)(classType, '_value_', declaredTypesOnly ? 64 /* MemberAccessFlags.DeclaredTypesOnly */ : 0 /* MemberAccessFlags.Default */);
    // If the declared type comes from the 'Enum' base class, ignore it
    // because it will be "Any", which isn't useful to us here.
    if (declaredValueMember &&
        declaredValueMember.classType &&
        (0, types_1.isClass)(declaredValueMember.classType) &&
        !types_1.ClassType.isBuiltIn(declaredValueMember.classType, 'Enum')) {
        valueType = evaluator.getTypeOfMember(declaredValueMember);
    }
    return valueType;
}
exports.getEnumDeclaredValueType = getEnumDeclaredValueType;
function getTypeOfEnumMember(evaluator, errorNode, classType, memberName, isIncomplete) {
    if (!types_1.ClassType.isEnumClass(classType)) {
        return undefined;
    }
    const type = transformTypeForEnumMember(evaluator, classType, memberName);
    if (type) {
        return { type, isIncomplete };
    }
    if (types_1.TypeBase.isInstantiable(classType)) {
        return undefined;
    }
    // Handle the special case of 'name' and 'value' members within an enum.
    const literalValue = classType.literalValue;
    if (memberName === 'name' || memberName === '_name_') {
        // Does the class explicitly override this member? Or it it using the
        // standard behavior provided by the "Enum" class?
        const memberInfo = (0, typeUtils_1.lookUpClassMember)(classType, memberName);
        if (memberInfo && (0, types_1.isClass)(memberInfo.classType) && !types_1.ClassType.isBuiltIn(memberInfo.classType, 'Enum')) {
            return undefined;
        }
        const strClass = evaluator.getBuiltInType(errorNode, 'str');
        if (!(0, types_1.isInstantiableClass)(strClass)) {
            return undefined;
        }
        const makeNameType = (value) => {
            return types_1.ClassType.cloneAsInstance(types_1.ClassType.cloneWithLiteral(strClass, value.itemName));
        };
        if (literalValue) {
            (0, debug_1.assert)(literalValue instanceof types_1.EnumLiteral);
            return { type: makeNameType(literalValue), isIncomplete };
        }
        // The type wasn't associated with a particular enum literal, so return
        // a union of all possible enum literals.
        const literalValues = (0, typeGuards_1.enumerateLiteralsForType)(evaluator, classType);
        if (literalValues && literalValues.length > 0) {
            return {
                type: (0, types_1.combineTypes)(literalValues.map((literalClass) => {
                    const literalValue = literalClass.literalValue;
                    (0, debug_1.assert)(literalValue instanceof types_1.EnumLiteral);
                    return makeNameType(literalValue);
                })),
                isIncomplete,
            };
        }
    }
    // See if there is a declared type for "_value_".
    const valueType = getEnumDeclaredValueType(evaluator, classType);
    if (memberName === 'value' || memberName === '_value_') {
        // Does the class explicitly override this member? Or it it using the
        // standard behavior provided by the "Enum" class and other built-in
        // subclasses like "StrEnum" and "IntEnum"?
        const memberInfo = (0, typeUtils_1.lookUpClassMember)(classType, memberName);
        if (memberInfo && (0, types_1.isClass)(memberInfo.classType) && !types_1.ClassType.isBuiltIn(memberInfo.classType)) {
            return undefined;
        }
        // If the enum class has a custom metaclass, it may implement some
        // "magic" that computes different values for the "_value_" attribute.
        // This occurs, for example, in the django TextChoices class. If we
        // detect a custom metaclass, we'll use the declared type of _value_
        // if it is declared.
        const metaclass = classType.details.effectiveMetaclass;
        if (metaclass && (0, types_1.isClass)(metaclass) && !types_1.ClassType.isBuiltIn(metaclass)) {
            return { type: valueType !== null && valueType !== void 0 ? valueType : types_1.AnyType.create(), isIncomplete };
        }
        // If the enum class has a custom __new__ or __init__ method,
        // it may implement some magic that computes different values for
        // the "_value_" attribute. If we see a customer __new__ or __init__,
        // we'll assume the value type is what we computed above, or Any.
        const newMember = (0, typeUtils_1.lookUpClassMember)(classType, '__new__', 4 /* MemberAccessFlags.SkipObjectBaseClass */);
        const initMember = (0, typeUtils_1.lookUpClassMember)(classType, '__init__', 4 /* MemberAccessFlags.SkipObjectBaseClass */);
        if (newMember && (0, types_1.isClass)(newMember.classType) && !types_1.ClassType.isBuiltIn(newMember.classType)) {
            return { type: valueType !== null && valueType !== void 0 ? valueType : types_1.AnyType.create(), isIncomplete };
        }
        if (initMember && (0, types_1.isClass)(initMember.classType) && !types_1.ClassType.isBuiltIn(initMember.classType)) {
            return { type: valueType !== null && valueType !== void 0 ? valueType : types_1.AnyType.create(), isIncomplete };
        }
        // There were no explicit assignments to the "_value_" attribute, so we can
        // assume that the values are assigned directly to the "_value_" by
        // the EnumMeta metaclass.
        if (literalValue) {
            (0, debug_1.assert)(literalValue instanceof types_1.EnumLiteral);
            // If there is no known value type for this literal value,
            // return undefined. This will cause the caller to fall back
            // on the definition of "_value_" within the class definition
            // (if present).
            if ((0, types_1.isAny)(literalValue.itemType)) {
                return valueType ? { type: valueType, isIncomplete } : undefined;
            }
            return { type: literalValue.itemType, isIncomplete };
        }
        // The type wasn't associated with a particular enum literal, so return
        // a union of all possible enum literals.
        const literalValues = (0, typeGuards_1.enumerateLiteralsForType)(evaluator, classType);
        if (literalValues && literalValues.length > 0) {
            return {
                type: (0, types_1.combineTypes)(literalValues.map((literalClass) => {
                    const literalValue = literalClass.literalValue;
                    (0, debug_1.assert)(literalValue instanceof types_1.EnumLiteral);
                    return literalValue.itemType;
                })),
                isIncomplete,
            };
        }
    }
    return undefined;
}
exports.getTypeOfEnumMember = getTypeOfEnumMember;
function getEnumAutoValueType(evaluator, node) {
    const containingClassNode = (0, parseTreeUtils_1.getEnclosingClass)(node);
    if (containingClassNode) {
        const classTypeInfo = evaluator.getTypeOfClass(containingClassNode);
        if (classTypeInfo) {
            const memberInfo = evaluator.getTypeOfBoundMember(node, types_1.ClassType.cloneAsInstance(classTypeInfo.classType), '_generate_next_value_');
            // Did we find a custom _generate_next_value_ sunder override?
            // Ignore if this comes from Enum because it is declared as
            // returning an "Any" type in the typeshed stubs.
            if (memberInfo &&
                !memberInfo.typeErrors &&
                (0, types_1.isFunction)(memberInfo.type) &&
                memberInfo.classType &&
                (0, types_1.isClass)(memberInfo.classType) &&
                !types_1.ClassType.isBuiltIn(memberInfo.classType, 'Enum')) {
                if (memberInfo.type.details.declaredReturnType) {
                    return memberInfo.type.details.declaredReturnType;
                }
            }
        }
    }
    return evaluator.getBuiltInObject(node, 'int');
}
exports.getEnumAutoValueType = getEnumAutoValueType;
//# sourceMappingURL=enums.js.map