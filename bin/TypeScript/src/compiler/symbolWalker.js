/** @internal */
var ts;
(function (ts) {
    function createGetSymbolWalker(getRestTypeOfSignature, getTypePredicateOfSignature, getReturnTypeOfSignature, getBaseTypes, resolveStructuredTypeMembers, getTypeOfSymbol, getResolvedSymbol, getIndexTypeOfStructuredType, getConstraintFromTypeParameter, getFirstIdentifier) {
        return getSymbolWalker;
        function getSymbolWalker(accept = () => true) {
            const visitedTypes = []; // Sparse array from id to type
            const visitedSymbols = []; // Sparse array from id to symbol
            return {
                walkType: type => {
                    try {
                        visitType(type);
                        return { visitedTypes: ts.getOwnValues(visitedTypes), visitedSymbols: ts.getOwnValues(visitedSymbols) };
                    }
                    finally {
                        ts.clear(visitedTypes);
                        ts.clear(visitedSymbols);
                    }
                },
                walkSymbol: symbol => {
                    try {
                        visitSymbol(symbol);
                        return { visitedTypes: ts.getOwnValues(visitedTypes), visitedSymbols: ts.getOwnValues(visitedSymbols) };
                    }
                    finally {
                        ts.clear(visitedTypes);
                        ts.clear(visitedSymbols);
                    }
                },
            };
            function visitType(type) {
                if (!type) {
                    return;
                }
                if (visitedTypes[type.id]) {
                    return;
                }
                visitedTypes[type.id] = type;
                // Reuse visitSymbol to visit the type's symbol,
                //  but be sure to bail on recuring into the type if accept declines the symbol.
                const shouldBail = visitSymbol(type.symbol);
                if (shouldBail)
                    return;
                // Visit the type's related types, if any
                if (type.flags & ts.TypeFlags.Object) {
                    const objectType = type;
                    const objectFlags = objectType.objectFlags;
                    if (objectFlags & ts.ObjectFlags.Reference) {
                        visitTypeReference(type);
                    }
                    if (objectFlags & ts.ObjectFlags.Mapped) {
                        visitMappedType(type);
                    }
                    if (objectFlags & (ts.ObjectFlags.Class | ts.ObjectFlags.Interface)) {
                        visitInterfaceType(type);
                    }
                    if (objectFlags & (ts.ObjectFlags.Tuple | ts.ObjectFlags.Anonymous)) {
                        visitObjectType(objectType);
                    }
                }
                if (type.flags & ts.TypeFlags.TypeParameter) {
                    visitTypeParameter(type);
                }
                if (type.flags & ts.TypeFlags.UnionOrIntersection) {
                    visitUnionOrIntersectionType(type);
                }
                if (type.flags & ts.TypeFlags.Index) {
                    visitIndexType(type);
                }
                if (type.flags & ts.TypeFlags.IndexedAccess) {
                    visitIndexedAccessType(type);
                }
            }
            function visitTypeReference(type) {
                visitType(type.target);
                ts.forEach(type.typeArguments, visitType);
            }
            function visitTypeParameter(type) {
                visitType(getConstraintFromTypeParameter(type));
            }
            function visitUnionOrIntersectionType(type) {
                ts.forEach(type.types, visitType);
            }
            function visitIndexType(type) {
                visitType(type.type);
            }
            function visitIndexedAccessType(type) {
                visitType(type.objectType);
                visitType(type.indexType);
                visitType(type.constraint);
            }
            function visitMappedType(type) {
                visitType(type.typeParameter);
                visitType(type.constraintType);
                visitType(type.templateType);
                visitType(type.modifiersType);
            }
            function visitSignature(signature) {
                const typePredicate = getTypePredicateOfSignature(signature);
                if (typePredicate) {
                    visitType(typePredicate.type);
                }
                ts.forEach(signature.typeParameters, visitType);
                for (const parameter of signature.parameters) {
                    visitSymbol(parameter);
                }
                visitType(getRestTypeOfSignature(signature));
                visitType(getReturnTypeOfSignature(signature));
            }
            function visitInterfaceType(interfaceT) {
                visitObjectType(interfaceT);
                ts.forEach(interfaceT.typeParameters, visitType);
                ts.forEach(getBaseTypes(interfaceT), visitType);
                visitType(interfaceT.thisType);
            }
            function visitObjectType(type) {
                const stringIndexType = getIndexTypeOfStructuredType(type, ts.IndexKind.String);
                visitType(stringIndexType);
                const numberIndexType = getIndexTypeOfStructuredType(type, ts.IndexKind.Number);
                visitType(numberIndexType);
                // The two checks above *should* have already resolved the type (if needed), so this should be cached
                const resolved = resolveStructuredTypeMembers(type);
                for (const signature of resolved.callSignatures) {
                    visitSignature(signature);
                }
                for (const signature of resolved.constructSignatures) {
                    visitSignature(signature);
                }
                for (const p of resolved.properties) {
                    visitSymbol(p);
                }
            }
            function visitSymbol(symbol) {
                if (!symbol) {
                    return;
                }
                const symbolId = ts.getSymbolId(symbol);
                if (visitedSymbols[symbolId]) {
                    return;
                }
                visitedSymbols[symbolId] = symbol;
                if (!accept(symbol)) {
                    return true;
                }
                const t = getTypeOfSymbol(symbol);
                visitType(t); // Should handle members on classes and such
                if (symbol.flags & ts.SymbolFlags.HasExports) {
                    symbol.exports.forEach(visitSymbol);
                }
                ts.forEach(symbol.declarations, d => {
                    // Type queries are too far resolved when we just visit the symbol's type
                    //  (their type resolved directly to the member deeply referenced)
                    // So to get the intervening symbols, we need to check if there's a type
                    // query node on any of the symbol's declarations and get symbols there
                    if (d.type && d.type.kind === ts.SyntaxKind.TypeQuery) {
                        const query = d.type;
                        const entity = getResolvedSymbol(getFirstIdentifier(query.exprName));
                        visitSymbol(entity);
                    }
                });
            }
        }
    }
    ts.createGetSymbolWalker = createGetSymbolWalker;
})(ts || (ts = {}));
