"use strict";
/*
 * constraintSolver.ts
 * Copyright (c) Microsoft Corporation.
 * Licensed under the MIT license.
 * Author: Eric Traut
 *
 * Code that solves a TypeVar, TypeVarTuple or ParamSpec based on
 * all of the provided constraints.
 *
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.addConstraintsForExpectedType = exports.updateTypeVarType = exports.assignTypeToTypeVar = void 0;
const diagnostic_1 = require("../common/diagnostic");
const localize_1 = require("../localization/localize");
const typeEvaluatorTypes_1 = require("./typeEvaluatorTypes");
const types_1 = require("./types");
const typeUtils_1 = require("./typeUtils");
const typeVarContext_1 = require("./typeVarContext");
// As we widen the narrow bound of a type variable, we may end up with
// many subtypes. For performance reasons, we need to cap this at some
// point. This constant determines the cap.
const maxSubtypeCountForTypeVarNarrowBound = 64;
// This debugging switch enables logging of the TypeVarContext before and
// after it is updated by the constraint solver.
const logTypeVarContextUpdates = false;
// Assigns the source type to the dest type var in the type var context. If an existing
// type is already associated with that type var name, it attempts to either widen or
// narrow the type (depending on the value of the isContravariant parameter). The goal is
// to produce the narrowest type that meets all of the requirements. If the type var context
// has been "locked", it simply validates that the srcType is compatible (with no attempt
// to widen or narrow).
function assignTypeToTypeVar(evaluator, destType, srcType, diag, typeVarContext, flags = 0 /* AssignTypeFlags.Default */, recursionCount = 0) {
    if (logTypeVarContextUpdates) {
        const indent = ' '.repeat(recursionCount * 2);
        console.log(`${indent}`);
        console.log(`${indent}assignTypeToTypeVar called with`);
        console.log(`${indent}destType: ${evaluator.printType(destType)}`);
        console.log(`${indent}srcType: ${evaluator.printType(srcType)}`);
        console.log(`${indent}flags: ${flags}`);
        console.log(`${indent}scopes: ${(typeVarContext.getSolveForScopes() || []).join(', ')}`);
        console.log(`${indent}pre-call context #${typeVarContext.getId()}: `);
        logTypeVarContext(evaluator, typeVarContext, indent);
    }
    let isTypeVarInScope = true;
    const isInvariant = (flags & 1 /* AssignTypeFlags.EnforceInvariance */) !== 0;
    const isContravariant = (flags & 2 /* AssignTypeFlags.ReverseTypeVarMatching */) !== 0 && !isInvariant;
    // If the TypeVar doesn't have a scope ID, then it's being used
    // outside of a valid TypeVar scope. This will be reported as a
    // separate error. Just ignore this case to avoid redundant errors.
    if (!destType.scopeId) {
        return true;
    }
    // Handle type[T] as a dest and a special form as a source.
    if (types_1.TypeBase.isInstantiable(destType) &&
        (0, types_1.isInstantiableClass)(srcType) &&
        evaluator.isSpecialFormClass(srcType, flags)) {
        return false;
    }
    // Verify that we are solving for the scope associated with this
    // type variable.
    if (!typeVarContext.hasSolveForScope(destType.scopeId)) {
        // Handle Any as a source.
        if ((0, types_1.isAnyOrUnknown)(srcType) || ((0, types_1.isClass)(srcType) && types_1.ClassType.derivesFromAnyOrUnknown(srcType))) {
            return true;
        }
        // Handle a type[Any] as a source.
        if ((0, types_1.isClassInstance)(srcType) && types_1.ClassType.isBuiltIn(srcType, 'type')) {
            if (!srcType.typeArguments ||
                srcType.typeArguments.length < 1 ||
                (0, types_1.isAnyOrUnknown)(srcType.typeArguments[0])) {
                if (types_1.TypeBase.isInstantiable(destType)) {
                    return true;
                }
            }
        }
        // Is this the equivalent of an "Unknown" for a ParamSpec?
        if (destType.details.isParamSpec &&
            (0, types_1.isFunction)(srcType) &&
            types_1.FunctionType.isParamSpecValue(srcType) &&
            types_1.FunctionType.isGradualCallableForm(srcType)) {
            return true;
        }
        // Never or NoReturn is always assignable to all type variables unless
        // we're enforcing invariance.
        if ((0, types_1.isNever)(srcType) && !isInvariant) {
            return true;
        }
        // If we're in "ignore type var scope" mode, don't generate
        // an error in this path.
        if ((flags & 1024 /* AssignTypeFlags.IgnoreTypeVarScope */) !== 0) {
            return true;
        }
        isTypeVarInScope = false;
        // Emit an error unless this is a synthesized type variable used
        // for pseudo-generic classes.
        if (!destType.details.isSynthesized || destType.details.isSynthesizedSelf) {
            diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(srcType, destType)));
            return false;
        }
    }
    // An in-scope placeholder TypeVar can always be assigned to itself,
    // but we won't record this in the typeVarContext.
    if ((0, types_1.isTypeSame)(destType, srcType) && destType.isInScopePlaceholder) {
        return true;
    }
    if ((flags & 8 /* AssignTypeFlags.SkipSolveTypeVars */) !== 0) {
        return evaluator.assignType(evaluator.makeTopLevelTypeVarsConcrete(destType), evaluator.makeTopLevelTypeVarsConcrete(srcType), diag, 
        /* destTypeVarContext */ undefined, 
        /* srcTypeVarContext */ undefined, flags, recursionCount);
    }
    if (destType.details.isParamSpec) {
        return assignTypeToParamSpec(evaluator, destType, srcType, diag, typeVarContext, recursionCount);
    }
    if (destType.details.isVariadic && !destType.isVariadicInUnion) {
        if (!(0, types_1.isUnpacked)(srcType)) {
            const tupleClassType = evaluator.getTupleClassType();
            if (tupleClassType && (0, types_1.isInstantiableClass)(tupleClassType)) {
                // Package up the type into a tuple.
                srcType = (0, typeUtils_1.convertToInstance)((0, typeUtils_1.specializeTupleClass)(tupleClassType, [{ type: srcType, isUnbounded: false }], 
                /* isTypeArgumentExplicit */ true, 
                /* isUnpackedTuple */ true));
            }
            else {
                srcType = types_1.UnknownType.create();
            }
        }
    }
    // If we're assigning an unpacked TypeVarTuple to a regular TypeVar,
    // we need to treat it as a union of the unpacked TypeVarTuple.
    if ((0, types_1.isTypeVar)(srcType) &&
        srcType.details.isVariadic &&
        srcType.isVariadicUnpacked &&
        !srcType.isVariadicInUnion &&
        !destType.details.isVariadic) {
        srcType = types_1.TypeVarType.cloneForUnpacked(srcType, /* isInUnion */ true);
    }
    // Handle the constrained case. This case needs to be handled specially
    // because type narrowing isn't used in this case. For example, if the
    // source type is "Literal[1]" and the constraint list includes the type
    // "float", the resulting type is float.
    if (destType.details.constraints.length > 0) {
        return assignTypeToConstrainedTypeVar(evaluator, destType, srcType, diag, typeVarContext, flags, isTypeVarInScope, recursionCount);
    }
    // Handle the unconstrained (but possibly bound) case.
    const curEntry = typeVarContext.getPrimarySignature().getTypeVar(destType);
    let curWideTypeBound = curEntry === null || curEntry === void 0 ? void 0 : curEntry.wideBound;
    if (!curWideTypeBound && !destType.details.isSynthesizedSelf) {
        curWideTypeBound = destType.details.boundType;
    }
    let curNarrowTypeBound = curEntry === null || curEntry === void 0 ? void 0 : curEntry.narrowBound;
    let newNarrowTypeBound = curNarrowTypeBound;
    let newWideTypeBound = curWideTypeBound;
    const diagAddendum = diag ? new diagnostic_1.DiagnosticAddendum() : undefined;
    let adjSrcType = srcType;
    // If the source is a class that is missing type arguments, fill
    // in missing type arguments with Unknown.
    if ((flags & 8192 /* AssignTypeFlags.AllowUnspecifiedTypeArguments */) === 0) {
        if ((0, types_1.isClass)(adjSrcType) && adjSrcType.includeSubclasses) {
            adjSrcType = (0, typeUtils_1.specializeWithDefaultTypeArgs)(adjSrcType);
        }
    }
    if (types_1.TypeBase.isInstantiable(destType)) {
        if ((0, typeUtils_1.isEffectivelyInstantiable)(adjSrcType)) {
            adjSrcType = (0, typeUtils_1.convertToInstance)(adjSrcType, /* includeSubclasses */ false);
        }
        else {
            // Handle the case of a TypeVar that has a bound of `type`.
            const concreteAdjSrcType = evaluator.makeTopLevelTypeVarsConcrete(adjSrcType);
            if ((0, typeUtils_1.isEffectivelyInstantiable)(concreteAdjSrcType)) {
                adjSrcType = (0, typeUtils_1.convertToInstance)(concreteAdjSrcType);
            }
            else {
                diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(srcType, destType)));
                return false;
            }
        }
    }
    else if ((0, types_1.isTypeVar)(srcType) &&
        types_1.TypeBase.isInstantiable(srcType) &&
        (0, types_1.isTypeSame)((0, typeUtils_1.convertToInstance)(srcType), destType)) {
        diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(adjSrcType, destType)));
        return false;
    }
    if ((flags & 2048 /* AssignTypeFlags.PopulatingExpectedType */) !== 0) {
        if ((flags & 4096 /* AssignTypeFlags.SkipPopulateUnknownExpectedType */) !== 0 && (0, types_1.isUnknown)(adjSrcType)) {
            return true;
        }
        // If we're populating the expected type, constrain either the
        // narrow type bound, wide type bound or both. Don't overwrite
        // an existing entry.
        if (!curEntry) {
            if (isInvariant) {
                newNarrowTypeBound = adjSrcType;
                newWideTypeBound = adjSrcType;
            }
            else if (isContravariant) {
                newNarrowTypeBound = adjSrcType;
            }
            else {
                newWideTypeBound = adjSrcType;
            }
        }
    }
    else if (isContravariant) {
        // Update the wide type bound.
        if (!curWideTypeBound || (0, types_1.isTypeSame)(destType, curWideTypeBound)) {
            newWideTypeBound = adjSrcType;
        }
        else if (!(0, types_1.isTypeSame)(curWideTypeBound, adjSrcType, {}, recursionCount)) {
            if (evaluator.assignType(curWideTypeBound, evaluator.makeTopLevelTypeVarsConcrete(adjSrcType), diagAddendum, 
            /* destTypeVarContext */ undefined, 
            /* srcTypeVarContext */ undefined, flags & 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
                // The srcType is narrower than the current wideTypeBound, so replace it.
                newWideTypeBound = adjSrcType;
            }
            else if (!evaluator.assignType(adjSrcType, curWideTypeBound, diagAddendum, 
            /* destTypeVarContext */ undefined, 
            /* srcTypeVarContext */ undefined, flags & 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
                if (diag && diagAddendum) {
                    diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(curWideTypeBound, adjSrcType)));
                    diag.addAddendum(diagAddendum);
                }
                return false;
            }
        }
        // Make sure we haven't narrowed it beyond the current narrow bound.
        if (curNarrowTypeBound) {
            if (!evaluator.assignType(newWideTypeBound, curNarrowTypeBound, 
            /* diag */ undefined, 
            /* destTypeVarContext */ undefined, 
            /* srcTypeVarContext */ undefined, flags & 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
                if (diag && diagAddendum) {
                    diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(curNarrowTypeBound, newWideTypeBound)));
                    diag.addAddendum(diagAddendum);
                }
                return false;
            }
        }
    }
    else {
        if (!curNarrowTypeBound || (0, types_1.isTypeSame)(destType, curNarrowTypeBound)) {
            // There was previously no narrow bound. We've now established one.
            newNarrowTypeBound = adjSrcType;
        }
        else if ((0, types_1.isTypeSame)(curNarrowTypeBound, adjSrcType, {}, recursionCount)) {
            // If this is an invariant context and there is currently no wide type bound
            // established, use the "no literals" version of the narrow type bounds rather
            // than a version that has literals.
            if (!newWideTypeBound && isInvariant && (curEntry === null || curEntry === void 0 ? void 0 : curEntry.narrowBoundNoLiterals)) {
                newNarrowTypeBound = curEntry.narrowBoundNoLiterals;
            }
        }
        else {
            if ((0, types_1.isAnyOrUnknown)(adjSrcType) && (curEntry === null || curEntry === void 0 ? void 0 : curEntry.tupleTypes)) {
                // Handle the tuple case specially. If Any or Unknown is assigned
                // during the construction of a tuple, the resulting tuple type must
                // be tuple[Any, ...], which is compatible with any tuple.
                newNarrowTypeBound = adjSrcType;
            }
            else if (evaluator.assignType(curNarrowTypeBound, adjSrcType, diagAddendum, typeVarContext, 
            /* srcTypeVarContext */ undefined, flags, recursionCount)) {
                // No need to widen. Stick with the existing type unless it's unknown
                // or partly unknown, in which case we'll replace it with a known type
                // as long as it doesn't violate the current narrow bound.
                if ((0, typeUtils_1.isPartlyUnknown)(curNarrowTypeBound) &&
                    !(0, types_1.isUnknown)(adjSrcType) &&
                    evaluator.assignType(adjSrcType, curNarrowTypeBound, 
                    /* diag */ undefined, typeVarContext, 
                    /* srcTypeVarContext */ undefined, flags & 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
                    newNarrowTypeBound = adjSrcType;
                }
                else {
                    newNarrowTypeBound = (0, typeUtils_1.applySolvedTypeVars)(curNarrowTypeBound, typeVarContext);
                }
            }
            else if ((0, types_1.isTypeVar)(curNarrowTypeBound) &&
                !(0, types_1.isTypeVar)(adjSrcType) &&
                evaluator.assignType(evaluator.makeTopLevelTypeVarsConcrete(curNarrowTypeBound), adjSrcType, diagAddendum, typeVarContext, 
                /* srcTypeVarContext */ undefined, flags, recursionCount)) {
                // If the existing narrow type bound was a TypeVar that is not
                // part of the current context we can replace it with the new
                // source type.
                newNarrowTypeBound = adjSrcType;
            }
            else {
                // We need to widen the type.
                if (typeVarContext.isLocked()) {
                    diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(adjSrcType, curNarrowTypeBound)));
                    return false;
                }
                if (evaluator.assignType(adjSrcType, curNarrowTypeBound, 
                /* diag */ undefined, typeVarContext, 
                /* srcTypeVarContext */ undefined, flags & 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
                    newNarrowTypeBound = adjSrcType;
                }
                else if ((0, types_1.isVariadicTypeVar)(destType)) {
                    const widenedType = widenTypeForVariadicTypeVar(evaluator, curNarrowTypeBound, adjSrcType);
                    if (!widenedType) {
                        diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(curNarrowTypeBound, adjSrcType)));
                        return false;
                    }
                    newNarrowTypeBound = widenedType;
                }
                else {
                    const objectType = evaluator.getObjectType();
                    // If this is an invariant context and there is currently no wide type bound
                    // established, use the "no literals" version of the narrow type bounds rather
                    // than a version that has literals.
                    if (!newWideTypeBound && isInvariant && (curEntry === null || curEntry === void 0 ? void 0 : curEntry.narrowBoundNoLiterals)) {
                        curNarrowTypeBound = curEntry.narrowBoundNoLiterals;
                    }
                    const curSolvedNarrowTypeBound = (0, typeUtils_1.applySolvedTypeVars)(curNarrowTypeBound, typeVarContext);
                    // In some extreme edge cases, the narrow type bound can become
                    // a union with so many subtypes that performance grinds to a
                    // halt. We'll detect this case and widen the resulting type
                    // to an 'object' instead of making the union even bigger. This
                    // is still a valid solution to the TypeVar.
                    if ((0, types_1.isUnion)(curSolvedNarrowTypeBound) &&
                        curSolvedNarrowTypeBound.subtypes.length > typeEvaluatorTypes_1.maxSubtypesForInferredType &&
                        destType.details.boundType !== undefined &&
                        (0, types_1.isClassInstance)(objectType)) {
                        newNarrowTypeBound = (0, types_1.combineTypes)([curSolvedNarrowTypeBound, objectType], maxSubtypeCountForTypeVarNarrowBound);
                    }
                    else {
                        newNarrowTypeBound = (0, types_1.combineTypes)([curSolvedNarrowTypeBound, adjSrcType], maxSubtypeCountForTypeVarNarrowBound);
                    }
                }
            }
        }
        // If this is an invariant context, make sure the narrow type bound
        // isn't too wide.
        if (isInvariant && newNarrowTypeBound) {
            if (!evaluator.assignType(adjSrcType, newNarrowTypeBound, diag === null || diag === void 0 ? void 0 : diag.createAddendum(), 
            /* destTypeVarContext */ undefined, 
            /* srcTypeVarContext */ undefined, 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
                if (diag && diagAddendum) {
                    diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(newNarrowTypeBound, adjSrcType)));
                }
                return false;
            }
        }
        // Make sure we don't exceed the wide type bound.
        if (curWideTypeBound && newNarrowTypeBound) {
            if (!(0, types_1.isTypeSame)(curWideTypeBound, newNarrowTypeBound, {}, recursionCount)) {
                let adjWideTypeBound = evaluator.makeTopLevelTypeVarsConcrete(curWideTypeBound, 
                /* makeParamSpecsConcrete */ true);
                // Convert any remaining (non-top-level) TypeVars in the wide type
                // bound to in-scope placeholders.
                adjWideTypeBound = (0, typeUtils_1.transformExpectedType)(adjWideTypeBound, 
                /* liveTypeVarScopes */ [], 
                /* usageOffset */ undefined);
                if (!evaluator.assignType(adjWideTypeBound, newNarrowTypeBound, diag === null || diag === void 0 ? void 0 : diag.createAddendum(), 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
                    if (diag && diagAddendum) {
                        diag.addMessage(localize_1.LocAddendum.typeAssignmentMismatch().format(evaluator.printSrcDestTypes(newNarrowTypeBound, adjWideTypeBound)));
                    }
                    return false;
                }
            }
        }
    }
    if (!newWideTypeBound && isInvariant) {
        newWideTypeBound = newNarrowTypeBound;
    }
    // If there's a bound type, make sure the source is assignable to it.
    if (destType.details.boundType) {
        const updatedType = (newNarrowTypeBound || newWideTypeBound);
        // If the dest is a Type[T] but the source is not a valid Type,
        // skip the assignType check and the diagnostic addendum, which will
        // be confusing and inaccurate.
        if (types_1.TypeBase.isInstantiable(destType) && !types_1.TypeBase.isInstantiable(srcType)) {
            return false;
        }
        // In general, bound types cannot be generic, but the "Self" type is an
        // exception. In this case, we need to use the original TypeVarContext
        // to solve for the generic type variable(s) in the bound type.
        const effectiveTypeVarContext = destType.details.isSynthesizedSelf
            ? typeVarContext
            : new typeVarContext_1.TypeVarContext(destType.scopeId);
        if (!evaluator.assignType(destType.details.boundType, evaluator.makeTopLevelTypeVarsConcrete(updatedType), diag === null || diag === void 0 ? void 0 : diag.createAddendum(), effectiveTypeVarContext, 
        /* srcTypeVarContext */ undefined, flags & 1024 /* AssignTypeFlags.IgnoreTypeVarScope */, recursionCount)) {
            // Avoid adding a message that will confuse users if the TypeVar was
            // synthesized for internal purposes.
            if (!destType.details.isSynthesized) {
                diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeBound().format({
                    sourceType: evaluator.printType(updatedType),
                    destType: evaluator.printType(destType.details.boundType),
                    name: types_1.TypeVarType.getReadableName(destType),
                }));
            }
            return false;
        }
    }
    // Update the tuple types based on the new type bounds. We need to
    // switch to an unbounded tuple type since the length of the resulting
    // tuple is indeterminate.
    let newTupleTypes = curEntry === null || curEntry === void 0 ? void 0 : curEntry.tupleTypes;
    if (newTupleTypes) {
        const updatedType = newNarrowTypeBound !== null && newNarrowTypeBound !== void 0 ? newNarrowTypeBound : newWideTypeBound;
        if (updatedType) {
            newTupleTypes = [{ type: updatedType, isUnbounded: true }];
        }
    }
    if (!typeVarContext.isLocked() && isTypeVarInScope) {
        updateTypeVarType(evaluator, typeVarContext, destType, newNarrowTypeBound, newWideTypeBound, newTupleTypes, (flags & (2048 /* AssignTypeFlags.PopulatingExpectedType */ | 256 /* AssignTypeFlags.RetainLiteralsForTypeVar */)) !== 0);
    }
    if (logTypeVarContextUpdates) {
        const indent = ' '.repeat(recursionCount * 2);
        console.log(`${indent}`);
        console.log(`${indent}post-call context #${typeVarContext.getId()}: `);
        logTypeVarContext(evaluator, typeVarContext, indent);
    }
    return true;
}
exports.assignTypeToTypeVar = assignTypeToTypeVar;
// Updates the narrow and wide type bounds for a type variable. It also calculates the
// narrowTypeBoundNoLiterals, which is a variant of the narrow type bound that has
// literals stripped. By default, the constraint solver always uses the "no literals"
// type in its solutions unless the version with literals is required to satisfy
// the wide type bound.
function updateTypeVarType(evaluator, typeVarContext, destType, narrowTypeBound, wideTypeBound, tupleTypes = undefined, forceRetainLiterals = false) {
    let narrowTypeBoundNoLiterals;
    if (narrowTypeBound && !forceRetainLiterals) {
        const strippedLiteral = (0, types_1.isVariadicTypeVar)(destType)
            ? stripLiteralValueForUnpackedTuple(evaluator, narrowTypeBound)
            : evaluator.stripLiteralValue(narrowTypeBound);
        // Strip the literals from the narrow type bound and see if it is still
        // narrower than the wide bound.
        if (strippedLiteral !== narrowTypeBound) {
            if (!wideTypeBound || evaluator.assignType(wideTypeBound, strippedLiteral)) {
                narrowTypeBoundNoLiterals = strippedLiteral;
            }
        }
    }
    typeVarContext.setTypeVarType(destType, narrowTypeBound, narrowTypeBoundNoLiterals, wideTypeBound, tupleTypes);
}
exports.updateTypeVarType = updateTypeVarType;
function assignTypeToConstrainedTypeVar(evaluator, destType, srcType, diag, typeVarContext, flags, isTypeVarInScope, recursionCount) {
    let constrainedType;
    const concreteSrcType = evaluator.makeTopLevelTypeVarsConcrete(srcType);
    const curEntry = typeVarContext.getPrimarySignature().getTypeVar(destType);
    const curWideTypeBound = curEntry === null || curEntry === void 0 ? void 0 : curEntry.wideBound;
    const curNarrowTypeBound = curEntry === null || curEntry === void 0 ? void 0 : curEntry.narrowBound;
    let forceRetainLiterals = false;
    if ((0, types_1.isTypeVar)(srcType)) {
        if (evaluator.assignType(destType, concreteSrcType, 
        /* diag */ undefined, new typeVarContext_1.TypeVarContext(destType.scopeId), 
        /* srcTypeVarContext */ undefined, 0 /* AssignTypeFlags.Default */, recursionCount)) {
            constrainedType = srcType;
            // If the source and dest are both instantiables (type[T]), then
            // we need to convert to an instance (T).
            if (types_1.TypeBase.isInstantiable(srcType)) {
                constrainedType = (0, typeUtils_1.convertToInstance)(srcType, /* includeSubclasses */ false);
            }
        }
    }
    else {
        let isCompatible = true;
        // Subtypes that are not conditionally dependent on the dest type var
        // must all map to the same constraint. For example, Union[str, bytes]
        // cannot be assigned to AnyStr.
        let unconditionalConstraintIndex;
        // Find the narrowest constrained type that is compatible.
        constrainedType = (0, typeUtils_1.mapSubtypes)(concreteSrcType, (srcSubtype) => {
            let constrainedSubtype;
            if ((0, types_1.isAnyOrUnknown)(srcSubtype)) {
                return srcSubtype;
            }
            let constraintIndexUsed;
            destType.details.constraints.forEach((constraint, i) => {
                const adjustedConstraint = types_1.TypeBase.isInstantiable(destType)
                    ? (0, typeUtils_1.convertToInstantiable)(constraint)
                    : constraint;
                if (evaluator.assignType(adjustedConstraint, srcSubtype, 
                /* diag */ undefined, 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, 0 /* AssignTypeFlags.Default */, recursionCount)) {
                    if (!constrainedSubtype ||
                        evaluator.assignType(types_1.TypeBase.isInstantiable(destType)
                            ? (0, typeUtils_1.convertToInstantiable)(constrainedSubtype)
                            : constrainedSubtype, adjustedConstraint, 
                        /* diag */ undefined, 
                        /* destTypeVarContext */ undefined, 
                        /* srcTypeVarContext */ undefined, 0 /* AssignTypeFlags.Default */, recursionCount)) {
                        constrainedSubtype = (0, typeUtils_1.addConditionToType)(constraint, (0, typeUtils_1.getTypeCondition)(srcSubtype));
                        constraintIndexUsed = i;
                    }
                }
            });
            if (!constrainedSubtype) {
                // We found a source subtype that is not compatible with the dest.
                // This is OK if we're handling the contravariant case because only
                // one subtype needs to be assignable in that case.
                if ((flags & 2 /* AssignTypeFlags.ReverseTypeVarMatching */) === 0) {
                    isCompatible = false;
                }
            }
            // If this subtype isn't conditional, make sure it maps to the same
            // constraint index as previous unconditional subtypes.
            if (constraintIndexUsed !== undefined && !(0, typeUtils_1.getTypeCondition)(srcSubtype)) {
                if (unconditionalConstraintIndex !== undefined &&
                    unconditionalConstraintIndex !== constraintIndexUsed) {
                    isCompatible = false;
                }
                unconditionalConstraintIndex = constraintIndexUsed;
            }
            return constrainedSubtype;
        });
        if ((0, types_1.isNever)(constrainedType) || !isCompatible) {
            constrainedType = undefined;
        }
        // If the type is a union, see if the entire union is assignable to one
        // of the constraints.
        if (!constrainedType && (0, types_1.isUnion)(concreteSrcType)) {
            constrainedType = destType.details.constraints.find((constraint) => {
                const adjustedConstraint = types_1.TypeBase.isInstantiable(destType)
                    ? (0, typeUtils_1.convertToInstantiable)(constraint)
                    : constraint;
                return evaluator.assignType(adjustedConstraint, concreteSrcType, 
                /* diag */ undefined, 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, 0 /* AssignTypeFlags.Default */, recursionCount);
            });
        }
    }
    // If there was no constrained type that was assignable
    // or there were multiple types that were assignable and they
    // are not conditional, it's an error.
    if (!constrainedType) {
        diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeConstrainedTypeVar().format({
            type: evaluator.printType(srcType),
            name: destType.details.name,
        }));
        return false;
    }
    else if ((0, typeUtils_1.isLiteralTypeOrUnion)(constrainedType)) {
        forceRetainLiterals = true;
    }
    if (curNarrowTypeBound && !(0, types_1.isAnyOrUnknown)(curNarrowTypeBound)) {
        if (!evaluator.assignType(curNarrowTypeBound, constrainedType, 
        /* diag */ undefined, 
        /* destTypeVarContext */ undefined, 
        /* srcTypeVarContext */ undefined, 0 /* AssignTypeFlags.Default */, recursionCount)) {
            // Handle the case where one of the constrained types is a wider
            // version of another constrained type that was previously assigned
            // to the type variable.
            if (evaluator.assignType(constrainedType, curNarrowTypeBound, 
            /* diag */ undefined, 
            /* destTypeVarContext */ undefined, 
            /* srcTypeVarContext */ undefined, 0 /* AssignTypeFlags.Default */, recursionCount)) {
                if (!typeVarContext.isLocked() && isTypeVarInScope) {
                    updateTypeVarType(evaluator, typeVarContext, destType, constrainedType, curWideTypeBound);
                }
            }
            else {
                diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeConstrainedTypeVar().format({
                    type: evaluator.printType(constrainedType),
                    name: evaluator.printType(curNarrowTypeBound),
                }));
                return false;
            }
        }
    }
    else {
        // Assign the type to the type var.
        if (!typeVarContext.isLocked() && isTypeVarInScope) {
            updateTypeVarType(evaluator, typeVarContext, destType, constrainedType, curWideTypeBound, 
            /* tupleTypes */ undefined, forceRetainLiterals);
        }
    }
    return true;
}
function assignTypeToParamSpec(evaluator, destType, srcType, diag, typeVarContext, recursionCount = 0) {
    let isAssignable = true;
    const adjSrcType = (0, types_1.isFunction)(srcType) ? (0, typeUtils_1.convertParamSpecValueToType)(srcType) : srcType;
    typeVarContext.doForEachSignature((signatureContext) => {
        if ((0, types_1.isTypeVar)(adjSrcType) && adjSrcType.details.isParamSpec) {
            const existingType = signatureContext.getParamSpecType(destType);
            if (existingType) {
                const existingTypeParamSpec = types_1.FunctionType.getParamSpecFromArgsKwargs(existingType);
                const existingTypeWithoutArgsKwargs = types_1.FunctionType.cloneRemoveParamSpecArgsKwargs(existingType);
                if (existingTypeWithoutArgsKwargs.details.parameters.length === 0 && existingTypeParamSpec) {
                    // If there's an existing entry that matches, that's fine.
                    if ((0, types_1.isTypeSame)(existingTypeParamSpec, adjSrcType, {}, recursionCount)) {
                        return;
                    }
                }
            }
            else {
                if (!typeVarContext.isLocked() && typeVarContext.hasSolveForScope(destType.scopeId)) {
                    signatureContext.setTypeVarType(destType, (0, typeUtils_1.convertTypeToParamSpecValue)(adjSrcType));
                }
                return;
            }
        }
        else if ((0, types_1.isFunction)(adjSrcType)) {
            const newFunction = adjSrcType;
            let updateContextWithNewFunction = false;
            const existingType = signatureContext.getParamSpecType(destType);
            if (existingType) {
                // Convert the remaining portion of the signature to a function
                // for comparison purposes.
                const existingFunction = (0, typeUtils_1.convertParamSpecValueToType)(existingType);
                const isNewNarrower = evaluator.assignType(existingFunction, newFunction, 
                /* diag */ undefined, 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, 64 /* AssignTypeFlags.SkipFunctionReturnTypeCheck */, recursionCount);
                const isNewWider = evaluator.assignType(newFunction, existingFunction, 
                /* diag */ undefined, 
                /* destTypeVarContext */ undefined, 
                /* srcTypeVarContext */ undefined, 64 /* AssignTypeFlags.SkipFunctionReturnTypeCheck */, recursionCount);
                // Should we widen the type?
                if (isNewNarrower && isNewWider) {
                    // The new type is both a supertype and a subtype of the existing type.
                    // That means the two types are the same or one (or both) have the type
                    // "..." (which is the ParamSpec equivalent of "Any"). If only one has
                    // the type "...", we'll prefer the other one. This is analogous to
                    // what we do with regular TypeVars, where we prefer non-Any values.
                    if (!types_1.FunctionType.isGradualCallableForm(newFunction)) {
                        updateContextWithNewFunction = true;
                    }
                    else {
                        return;
                    }
                }
                else if (isNewWider) {
                    updateContextWithNewFunction = true;
                }
                else if (isNewNarrower) {
                    // The existing function is already narrower than the new function, so
                    // no need to narrow it further.
                    return;
                }
            }
            else {
                updateContextWithNewFunction = true;
            }
            if (updateContextWithNewFunction) {
                if (!typeVarContext.isLocked() && typeVarContext.hasSolveForScope(destType.scopeId)) {
                    signatureContext.setTypeVarType(destType, newFunction);
                }
                return;
            }
        }
        else if ((0, types_1.isAnyOrUnknown)(adjSrcType)) {
            return;
        }
        diag === null || diag === void 0 ? void 0 : diag.addMessage(localize_1.LocAddendum.typeParamSpec().format({
            type: evaluator.printType(adjSrcType),
            name: destType.details.name,
        }));
        isAssignable = false;
    });
    if (logTypeVarContextUpdates) {
        const indent = ' '.repeat(recursionCount * 2);
        console.log(`${indent}`);
        console.log(`${indent}post-call typeVarContext: `);
        logTypeVarContext(evaluator, typeVarContext, indent);
    }
    return isAssignable;
}
// In cases where the expected type is a specialized base class of the
// source type, we need to determine which type arguments in the derived
// class will make it compatible with the specialized base class. This method
// performs this reverse mapping of type arguments and populates the type var
// map for the target type. If the type is not assignable to the expected type,
// it returns false.
function addConstraintsForExpectedType(evaluator, type, expectedType, typeVarContext, liveTypeVarScopes, usageOffset = undefined) {
    if ((0, types_1.isAny)(expectedType)) {
        type.details.typeParameters.forEach((typeParam) => {
            updateTypeVarType(evaluator, typeVarContext, typeParam, expectedType, expectedType);
        });
        return true;
    }
    if ((0, types_1.isTypeVar)(expectedType) && expectedType.details.isSynthesizedSelf && expectedType.details.boundType) {
        expectedType = expectedType.details.boundType;
    }
    if (!(0, types_1.isClass)(expectedType)) {
        return false;
    }
    // If the expected type is generic (but not specialized), we can't proceed.
    const expectedTypeArgs = expectedType.typeArguments;
    if (!expectedTypeArgs) {
        return evaluator.assignType(type, expectedType, 
        /* diag */ undefined, typeVarContext, 
        /* srcTypeVarContext */ undefined, 2048 /* AssignTypeFlags.PopulatingExpectedType */);
    }
    evaluator.inferTypeParameterVarianceForClass(type);
    // If the expected type is the same as the target type (commonly the case),
    // we can use a faster method.
    if (types_1.ClassType.isSameGenericClass(expectedType, type)) {
        const sameClassTypeVarContext = (0, typeUtils_1.buildTypeVarContextFromSpecializedClass)(expectedType);
        sameClassTypeVarContext
            .getPrimarySignature()
            .getTypeVars()
            .forEach((entry) => {
            let typeArgValue = sameClassTypeVarContext.getPrimarySignature().getTypeVarType(entry.typeVar);
            if (typeArgValue && liveTypeVarScopes) {
                typeArgValue = (0, typeUtils_1.transformExpectedType)(typeArgValue, liveTypeVarScopes, usageOffset);
            }
            if (typeArgValue) {
                const variance = types_1.TypeVarType.getVariance(entry.typeVar);
                updateTypeVarType(evaluator, typeVarContext, entry.typeVar, variance === 3 /* Variance.Covariant */ ? undefined : typeArgValue, variance === 4 /* Variance.Contravariant */ ? undefined : typeArgValue);
                if (entry.tupleTypes) {
                    typeVarContext.setTupleTypeVar(entry.typeVar, entry.tupleTypes.map((tupleEntry) => {
                        let tupleType = tupleEntry.type;
                        if (liveTypeVarScopes) {
                            tupleType = (0, typeUtils_1.transformExpectedType)(tupleEntry.type, liveTypeVarScopes, usageOffset);
                        }
                        return {
                            type: tupleType,
                            isUnbounded: tupleEntry.isUnbounded,
                            isOptional: tupleEntry.isOptional,
                        };
                    }));
                }
            }
        });
        return true;
    }
    // Create a generic version of the expected type.
    const expectedTypeScopeId = (0, typeUtils_1.getTypeVarScopeId)(expectedType);
    const synthExpectedTypeArgs = types_1.ClassType.getTypeParameters(expectedType).map((typeParam, index) => {
        const typeVar = types_1.TypeVarType.createInstance(`__dest${index}`);
        typeVar.details.isSynthesized = true;
        if (typeParam.details.isParamSpec) {
            typeVar.details.isParamSpec = true;
        }
        // Use invariance here so we set the narrow and wide values on the TypeVar.
        typeVar.details.declaredVariance = 2 /* Variance.Invariant */;
        typeVar.scopeId = expectedTypeScopeId;
        return typeVar;
    });
    const genericExpectedType = types_1.ClassType.cloneForSpecialization(expectedType, synthExpectedTypeArgs, 
    /* isTypeArgumentExplicit */ true);
    // For each type param in the target type, create a placeholder type variable.
    const typeArgs = types_1.ClassType.getTypeParameters(type).map((typeParam, index) => {
        const typeVar = types_1.TypeVarType.createInstance(`__source${index}`);
        typeVar.details.isSynthesized = true;
        typeVar.details.synthesizedIndex = index;
        typeVar.details.isExemptFromBoundCheck = true;
        if (typeParam.details.isParamSpec) {
            typeVar.details.isParamSpec = true;
        }
        return types_1.TypeVarType.cloneAsInScopePlaceholder(typeVar);
    });
    const specializedType = types_1.ClassType.cloneForSpecialization(type, typeArgs, /* isTypeArgumentExplicit */ true);
    const syntheticTypeVarContext = new typeVarContext_1.TypeVarContext(expectedTypeScopeId);
    if (evaluator.assignType(genericExpectedType, specializedType, 
    /* diag */ undefined, syntheticTypeVarContext, 
    /* srcTypeVarContext */ undefined, 2048 /* AssignTypeFlags.PopulatingExpectedType */)) {
        let isResultValid = true;
        synthExpectedTypeArgs.forEach((typeVar, index) => {
            let synthTypeVar = syntheticTypeVarContext.getPrimarySignature().getTypeVarType(typeVar);
            const otherSubtypes = [];
            // If the resulting type is a union, try to find a matching type var and move
            // the remaining subtypes to the "otherSubtypes" array.
            if (synthTypeVar) {
                if (typeVar.details.isParamSpec && (0, types_1.isFunction)(synthTypeVar)) {
                    synthTypeVar = (0, typeUtils_1.convertParamSpecValueToType)(synthTypeVar);
                }
                if ((0, types_1.isUnion)(synthTypeVar)) {
                    let foundSynthTypeVar;
                    (0, typeUtils_1.sortTypes)(synthTypeVar.subtypes).forEach((subtype) => {
                        if ((0, types_1.isTypeVar)(subtype) &&
                            subtype.details.isSynthesized &&
                            subtype.details.synthesizedIndex !== undefined &&
                            !foundSynthTypeVar) {
                            foundSynthTypeVar = subtype;
                        }
                        else {
                            otherSubtypes.push(subtype);
                        }
                    });
                    if (foundSynthTypeVar) {
                        synthTypeVar = foundSynthTypeVar;
                    }
                }
            }
            // Is this one of the synthesized type vars we allocated above? If so,
            // the type arg that corresponds to this type var maps back to the target type.
            if (synthTypeVar &&
                (0, types_1.isTypeVar)(synthTypeVar) &&
                synthTypeVar.details.isSynthesized &&
                synthTypeVar.details.synthesizedIndex !== undefined) {
                const targetTypeVar = types_1.ClassType.getTypeParameters(specializedType)[synthTypeVar.details.synthesizedIndex];
                if (index < expectedTypeArgs.length) {
                    let typeArgValue = (0, typeUtils_1.transformPossibleRecursiveTypeAlias)(expectedTypeArgs[index]);
                    if (otherSubtypes.length > 0) {
                        typeArgValue = (0, types_1.combineTypes)([typeArgValue, ...otherSubtypes]);
                    }
                    if (liveTypeVarScopes) {
                        typeArgValue = (0, typeUtils_1.transformExpectedType)(typeArgValue, liveTypeVarScopes, usageOffset);
                    }
                    if (typeArgValue) {
                        const variance = types_1.TypeVarType.getVariance(typeVar);
                        // If this type variable already has a type, don't overwrite it. This can
                        // happen if a single type variable in the derived class is used multiple times
                        // in the specialized base class type (e.g. Mapping[T, T]).
                        if (typeVarContext.getPrimarySignature().getTypeVarType(targetTypeVar)) {
                            isResultValid = false;
                            typeArgValue = types_1.UnknownType.create();
                        }
                        updateTypeVarType(evaluator, typeVarContext, targetTypeVar, variance === 3 /* Variance.Covariant */ ? undefined : typeArgValue, variance === 4 /* Variance.Contravariant */ ? undefined : typeArgValue);
                    }
                    else {
                        isResultValid = false;
                    }
                }
            }
        });
        return isResultValid;
    }
    return false;
}
exports.addConstraintsForExpectedType = addConstraintsForExpectedType;
// For normal TypeVars, the constraint solver can widen a type by combining
// two otherwise incompatible types into a union. For TypeVarTuples, we need
// to do the equivalent operation for unpacked tuples.
function widenTypeForVariadicTypeVar(evaluator, type1, type2) {
    // The typing spec indicates that the type should always be "exactly
    // the same type" if a TypeVarTuple is used in multiple locations.
    // This is problematic for a number of reasons, but in the interest
    // of sticking to the spec, we'll enforce that here.
    // If the two types are not unpacked tuples, we can't combine them.
    if (!(0, types_1.isUnpackedClass)(type1) || !(0, types_1.isUnpackedClass)(type2)) {
        return undefined;
    }
    // If the two unpacked tuples are not the same length, we can't combine them.
    if (!type1.tupleTypeArguments ||
        !type2.tupleTypeArguments ||
        type1.tupleTypeArguments.length !== type2.tupleTypeArguments.length) {
        return undefined;
    }
    const strippedType1 = stripLiteralValueForUnpackedTuple(evaluator, type1);
    const strippedType2 = stripLiteralValueForUnpackedTuple(evaluator, type2);
    if ((0, types_1.isTypeSame)(strippedType1, strippedType2)) {
        return strippedType1;
    }
    return undefined;
}
// If the provided type is an unpacked tuple, this function strips the
// literals from types of the corresponding elements.
function stripLiteralValueForUnpackedTuple(evaluator, type) {
    if (!(0, types_1.isUnpackedClass)(type) || !type.tupleTypeArguments) {
        return type;
    }
    let strippedLiteral = false;
    const tupleTypeArgs = type.tupleTypeArguments.map((arg) => {
        const strippedType = evaluator.stripLiteralValue(arg.type);
        if (strippedType !== arg.type) {
            strippedLiteral = true;
        }
        return {
            isUnbounded: arg.isUnbounded,
            isOptional: arg.isOptional,
            type: strippedType,
        };
    });
    if (!strippedLiteral) {
        return type;
    }
    return (0, typeUtils_1.specializeTupleClass)(type, tupleTypeArgs, /* isTypeArgumentExplicit */ true, /* isUnpackedTuple */ true);
}
// This function is used for debugging only. It dumps the current contents of
// the TypeVarContext to the console.
function logTypeVarContext(evaluator, typeVarContext, indent) {
    const signatureContextCount = typeVarContext.getSignatureContexts().length;
    if (signatureContextCount === 0) {
        console.log(`${indent}  no signatures`);
    }
    else if (signatureContextCount === 1) {
        logTypeVarSignatureContext(evaluator, typeVarContext.getSignatureContexts()[0], `${indent}  `);
    }
    else {
        typeVarContext.doForEachSignatureContext((context, signatureIndex) => {
            console.log(`${indent}  signature ${signatureIndex}`);
            logTypeVarSignatureContext(evaluator, context, `${indent}    `);
        });
    }
}
function logTypeVarSignatureContext(evaluator, context, indent) {
    let loggedConstraint = false;
    context.getTypeVars().forEach((entry) => {
        var _a;
        const typeVarName = `${indent}${entry.typeVar.details.name}`;
        const narrowBound = (_a = entry.narrowBoundNoLiterals) !== null && _a !== void 0 ? _a : entry.narrowBound;
        const wideBound = entry.wideBound;
        // Log the narrow and wide bounds.
        if (narrowBound && wideBound && (0, types_1.isTypeSame)(narrowBound, wideBound)) {
            console.log(`${typeVarName} = ${evaluator.printType(narrowBound)}`);
            loggedConstraint = true;
        }
        else {
            if (narrowBound) {
                console.log(`${typeVarName} ≤ ${evaluator.printType(narrowBound)}`);
                loggedConstraint = true;
            }
            if (wideBound) {
                console.log(`${typeVarName} ≥ ${evaluator.printType(wideBound)}`);
                loggedConstraint = true;
            }
        }
    });
    if (!loggedConstraint) {
        console.log(`${indent}no constraints`);
    }
}
//# sourceMappingURL=constraintSolver.js.map