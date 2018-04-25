/* @internal */
var ts;
(function (ts) {
    var GoToDefinition;
    (function (GoToDefinition) {
        function getDefinitionAtPosition(program, sourceFile, position) {
            const reference = getReferenceAtPosition(sourceFile, position, program);
            if (reference) {
                return [getDefinitionInfoForFileReference(reference.fileName, reference.file.fileName)];
            }
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
            if (node === sourceFile) {
                return undefined;
            }
            // Labels
            if (ts.isJumpStatementTarget(node)) {
                const label = ts.getTargetLabel(node.parent, node.text);
                return label ? [createDefinitionInfoFromName(label, ts.ScriptElementKind.label, node.text, /*containerName*/ undefined)] : undefined;
            }
            const typeChecker = program.getTypeChecker();
            const calledDeclaration = tryGetSignatureDeclaration(typeChecker, node);
            if (calledDeclaration) {
                return [createDefinitionFromSignatureDeclaration(typeChecker, calledDeclaration)];
            }
            let symbol = typeChecker.getSymbolAtLocation(node);
            // Could not find a symbol e.g. node is string or number keyword,
            // or the symbol was an internal symbol and does not have a declaration e.g. undefined symbol
            if (!symbol) {
                return getDefinitionInfoForIndexSignatures(node, typeChecker);
            }
            // If this is an alias, and the request came at the declaration location
            // get the aliased symbol instead. This allows for goto def on an import e.g.
            //   import {A, B} from "mod";
            // to jump to the implementation directly.
            if (symbol.flags & ts.SymbolFlags.Alias && shouldSkipAlias(node, symbol.declarations[0])) {
                const aliased = typeChecker.getAliasedSymbol(symbol);
                if (aliased.declarations) {
                    symbol = aliased;
                }
            }
            // Because name in short-hand property assignment has two different meanings: property name and property value,
            // using go-to-definition at such position should go to the variable declaration of the property value rather than
            // go to the declaration of the property name (in this case stay at the same position). However, if go-to-definition
            // is performed at the location of property access, we would like to go to definition of the property in the short-hand
            // assignment. This case and others are handled by the following code.
            if (node.parent.kind === ts.SyntaxKind.ShorthandPropertyAssignment) {
                const shorthandSymbol = typeChecker.getShorthandAssignmentValueSymbol(symbol.valueDeclaration);
                return shorthandSymbol ? shorthandSymbol.declarations.map(decl => createDefinitionInfo(decl, typeChecker, shorthandSymbol, node)) : [];
            }
            // If the node is the name of a BindingElement within an ObjectBindingPattern instead of just returning the
            // declaration the symbol (which is itself), we should try to get to the original type of the ObjectBindingPattern
            // and return the property declaration for the referenced property.
            // For example:
            //      import('./foo').then(({ b/*goto*/ar }) => undefined); => should get use to the declaration in file "./foo"
            //
            //      function bar<T>(onfulfilled: (value: T) => void) { //....}
            //      interface Test {
            //          pr/*destination*/op1: number
            //      }
            //      bar<Test>(({pr/*goto*/op1})=>{});
            if (ts.isPropertyName(node) && ts.isBindingElement(node.parent) && ts.isObjectBindingPattern(node.parent.parent) &&
                (node === (node.parent.propertyName || node.parent.name))) {
                const type = typeChecker.getTypeAtLocation(node.parent.parent);
                if (type) {
                    const propSymbols = ts.getPropertySymbolsFromType(type, node);
                    if (propSymbols) {
                        return ts.flatMap(propSymbols, propSymbol => getDefinitionFromSymbol(typeChecker, propSymbol, node));
                    }
                }
            }
            // If the current location we want to find its definition is in an object literal, try to get the contextual type for the
            // object literal, lookup the property symbol in the contextual type, and use this for goto-definition.
            // For example
            //      interface Props{
            //          /*first*/prop1: number
            //          prop2: boolean
            //      }
            //      function Foo(arg: Props) {}
            //      Foo( { pr/*1*/op1: 10, prop2: true })
            const element = ts.getContainingObjectLiteralElement(node);
            if (element && typeChecker.getContextualType(element.parent)) {
                return ts.flatMap(ts.getPropertySymbolsFromContextualType(typeChecker, element), propertySymbol => getDefinitionFromSymbol(typeChecker, propertySymbol, node));
            }
            return getDefinitionFromSymbol(typeChecker, symbol, node);
        }
        GoToDefinition.getDefinitionAtPosition = getDefinitionAtPosition;
        function getReferenceAtPosition(sourceFile, position, program) {
            const referencePath = findReferenceInPosition(sourceFile.referencedFiles, position);
            if (referencePath) {
                const file = ts.tryResolveScriptReference(program, sourceFile, referencePath);
                return file && { fileName: referencePath.fileName, file };
            }
            const typeReferenceDirective = findReferenceInPosition(sourceFile.typeReferenceDirectives, position);
            if (typeReferenceDirective) {
                const reference = program.getResolvedTypeReferenceDirectives().get(typeReferenceDirective.fileName);
                const file = reference && program.getSourceFile(reference.resolvedFileName);
                return file && { fileName: typeReferenceDirective.fileName, file };
            }
            return undefined;
        }
        GoToDefinition.getReferenceAtPosition = getReferenceAtPosition;
        /// Goto type
        function getTypeDefinitionAtPosition(typeChecker, sourceFile, position) {
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
            if (node === sourceFile) {
                return undefined;
            }
            const symbol = typeChecker.getSymbolAtLocation(node);
            const type = symbol && typeChecker.getTypeOfSymbolAtLocation(symbol, node);
            if (!type) {
                return undefined;
            }
            if (type.isUnion() && !(type.flags & ts.TypeFlags.Enum)) {
                return ts.flatMap(type.types, t => t.symbol && getDefinitionFromSymbol(typeChecker, t.symbol, node));
            }
            return type.symbol && getDefinitionFromSymbol(typeChecker, type.symbol, node);
        }
        GoToDefinition.getTypeDefinitionAtPosition = getTypeDefinitionAtPosition;
        function getDefinitionAndBoundSpan(program, sourceFile, position) {
            const definitions = getDefinitionAtPosition(program, sourceFile, position);
            if (!definitions || definitions.length === 0) {
                return undefined;
            }
            // Check if position is on triple slash reference.
            const comment = findReferenceInPosition(sourceFile.referencedFiles, position) || findReferenceInPosition(sourceFile.typeReferenceDirectives, position);
            if (comment) {
                return { definitions, textSpan: ts.createTextSpanFromRange(comment) };
            }
            const node = ts.getTouchingPropertyName(sourceFile, position, /*includeJsDocComment*/ true);
            const textSpan = ts.createTextSpan(node.getStart(), node.getWidth());
            return { definitions, textSpan };
        }
        GoToDefinition.getDefinitionAndBoundSpan = getDefinitionAndBoundSpan;
        // At 'x.foo', see if the type of 'x' has an index signature, and if so find its declarations.
        function getDefinitionInfoForIndexSignatures(node, checker) {
            if (!ts.isPropertyAccessExpression(node.parent) || node.parent.name !== node)
                return;
            const type = checker.getTypeAtLocation(node.parent.expression);
            return ts.mapDefined(type.isUnionOrIntersection() ? type.types : [type], nonUnionType => {
                const info = checker.getIndexInfoOfType(nonUnionType, ts.IndexKind.String);
                return info && info.declaration && createDefinitionFromSignatureDeclaration(checker, info.declaration);
            });
        }
        // Go to the original declaration for cases:
        //
        //   (1) when the aliased symbol was declared in the location(parent).
        //   (2) when the aliased symbol is originating from an import.
        //
        function shouldSkipAlias(node, declaration) {
            if (node.kind !== ts.SyntaxKind.Identifier) {
                return false;
            }
            if (node.parent === declaration) {
                return true;
            }
            switch (declaration.kind) {
                case ts.SyntaxKind.ImportClause:
                case ts.SyntaxKind.ImportEqualsDeclaration:
                    return true;
                case ts.SyntaxKind.ImportSpecifier:
                    return declaration.parent.kind === ts.SyntaxKind.NamedImports;
                default:
                    return false;
            }
        }
        function getDefinitionFromSymbol(typeChecker, symbol, node) {
            return getConstructSignatureDefinition() || getCallSignatureDefinition() || ts.map(symbol.declarations, declaration => createDefinitionInfo(declaration, typeChecker, symbol, node));
            function getConstructSignatureDefinition() {
                // Applicable only if we are in a new expression, or we are on a constructor declaration
                // and in either case the symbol has a construct signature definition, i.e. class
                if (symbol.flags & ts.SymbolFlags.Class && (ts.isNewExpressionTarget(node) || node.kind === ts.SyntaxKind.ConstructorKeyword)) {
                    const cls = ts.find(symbol.declarations, ts.isClassLike) || ts.Debug.fail("Expected declaration to have at least one class-like declaration");
                    return getSignatureDefinition(cls.members, /*selectConstructors*/ true);
                }
            }
            function getCallSignatureDefinition() {
                return ts.isCallExpressionTarget(node) || ts.isNewExpressionTarget(node) || ts.isNameOfFunctionDeclaration(node)
                    ? getSignatureDefinition(symbol.declarations, /*selectConstructors*/ false)
                    : undefined;
            }
            function getSignatureDefinition(signatureDeclarations, selectConstructors) {
                if (!signatureDeclarations) {
                    return undefined;
                }
                const declarations = signatureDeclarations.filter(selectConstructors ? ts.isConstructorDeclaration : ts.isFunctionLike);
                return declarations.length
                    ? [createDefinitionInfo(ts.find(declarations, d => !!d.body) || ts.last(declarations), typeChecker, symbol, node)]
                    : undefined;
            }
        }
        /** Creates a DefinitionInfo from a Declaration, using the declaration's name if possible. */
        function createDefinitionInfo(declaration, checker, symbol, node) {
            const symbolName = checker.symbolToString(symbol); // Do not get scoped name, just the name of the symbol
            const symbolKind = ts.SymbolDisplay.getSymbolKind(checker, symbol, node);
            const containerName = symbol.parent ? checker.symbolToString(symbol.parent, node) : "";
            return createDefinitionInfoFromName(declaration, symbolKind, symbolName, containerName);
        }
        /** Creates a DefinitionInfo directly from the name of a declaration. */
        function createDefinitionInfoFromName(declaration, symbolKind, symbolName, containerName) {
            const name = ts.getNameOfDeclaration(declaration) || declaration;
            const sourceFile = name.getSourceFile();
            return {
                fileName: sourceFile.fileName,
                textSpan: ts.createTextSpanFromNode(name, sourceFile),
                kind: symbolKind,
                name: symbolName,
                containerKind: undefined,
                containerName
            };
        }
        function createDefinitionFromSignatureDeclaration(typeChecker, decl) {
            return createDefinitionInfo(decl, typeChecker, decl.symbol, decl);
        }
        function findReferenceInPosition(refs, pos) {
            return ts.find(refs, ref => ref.pos <= pos && pos <= ref.end);
        }
        GoToDefinition.findReferenceInPosition = findReferenceInPosition;
        function getDefinitionInfoForFileReference(name, targetFileName) {
            return {
                fileName: targetFileName,
                textSpan: ts.createTextSpanFromBounds(0, 0),
                kind: ts.ScriptElementKind.scriptElement,
                name,
                containerName: undefined,
                containerKind: undefined
            };
        }
        /** Returns a CallLikeExpression where `node` is the target being invoked. */
        function getAncestorCallLikeExpression(node) {
            const target = climbPastManyPropertyAccesses(node);
            const callLike = target.parent;
            return callLike && ts.isCallLikeExpression(callLike) && ts.getInvokedExpression(callLike) === target && callLike;
        }
        function climbPastManyPropertyAccesses(node) {
            return ts.isRightSideOfPropertyAccess(node) ? climbPastManyPropertyAccesses(node.parent) : node;
        }
        function tryGetSignatureDeclaration(typeChecker, node) {
            const callLike = getAncestorCallLikeExpression(node);
            const signature = callLike && typeChecker.getResolvedSignature(callLike);
            // Don't go to a function type, go to the value having that type.
            return ts.tryCast(signature && signature.declaration, (d) => ts.isFunctionLike(d) && !ts.isFunctionTypeNode(d));
        }
    })(GoToDefinition = ts.GoToDefinition || (ts.GoToDefinition = {}));
})(ts || (ts = {}));
