/* @internal */
var ts;
(function (ts) {
    var codefix;
    (function (codefix) {
        /**
         * Finds members of the resolved type that are missing in the class pointed to by class decl
         * and generates source code for the missing members.
         * @param possiblyMissingSymbols The collection of symbols to filter and then get insertions for.
         * @returns Empty string iff there are no member insertions.
         */
        function createMissingMemberNodes(classDeclaration, possiblyMissingSymbols, checker, preferences, out) {
            const classMembers = classDeclaration.symbol.members;
            for (const symbol of possiblyMissingSymbols) {
                if (!classMembers.has(symbol.escapedName)) {
                    addNewNodeForMemberSymbol(symbol, classDeclaration, checker, preferences, out);
                }
            }
        }
        codefix.createMissingMemberNodes = createMissingMemberNodes;
        /**
         * @returns Empty string iff there we can't figure out a representation for `symbol` in `enclosingDeclaration`.
         */
        function addNewNodeForMemberSymbol(symbol, enclosingDeclaration, checker, preferences, out) {
            const declarations = symbol.getDeclarations();
            if (!(declarations && declarations.length)) {
                return undefined;
            }
            const declaration = declarations[0];
            const name = ts.getSynthesizedDeepClone(ts.getNameOfDeclaration(declaration), /*includeTrivia*/ false);
            const visibilityModifier = createVisibilityModifier(ts.getModifierFlags(declaration));
            const modifiers = visibilityModifier ? ts.createNodeArray([visibilityModifier]) : undefined;
            const type = checker.getWidenedType(checker.getTypeOfSymbolAtLocation(symbol, enclosingDeclaration));
            const optional = !!(symbol.flags & ts.SymbolFlags.Optional);
            switch (declaration.kind) {
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.PropertySignature:
                case ts.SyntaxKind.PropertyDeclaration:
                    const typeNode = checker.typeToTypeNode(type, enclosingDeclaration);
                    out(ts.createProperty(
                    /*decorators*/ undefined, modifiers, name, optional ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined, typeNode, 
                    /*initializer*/ undefined));
                    break;
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.MethodDeclaration:
                    // The signature for the implementation appears as an entry in `signatures` iff
                    // there is only one signature.
                    // If there are overloads and an implementation signature, it appears as an
                    // extra declaration that isn't a signature for `type`.
                    // If there is more than one overload but no implementation signature
                    // (eg: an abstract method or interface declaration), there is a 1-1
                    // correspondence of declarations and signatures.
                    const signatures = checker.getSignaturesOfType(type, ts.SignatureKind.Call);
                    if (!ts.some(signatures)) {
                        break;
                    }
                    if (declarations.length === 1) {
                        ts.Debug.assert(signatures.length === 1);
                        const signature = signatures[0];
                        outputMethod(signature, modifiers, name, createStubbedMethodBody(preferences));
                        break;
                    }
                    for (const signature of signatures) {
                        // Need to ensure nodes are fresh each time so they can have different positions.
                        outputMethod(signature, ts.getSynthesizedDeepClones(modifiers, /*includeTrivia*/ false), ts.getSynthesizedDeepClone(name, /*includeTrivia*/ false));
                    }
                    if (declarations.length > signatures.length) {
                        const signature = checker.getSignatureFromDeclaration(declarations[declarations.length - 1]);
                        outputMethod(signature, modifiers, name, createStubbedMethodBody(preferences));
                    }
                    else {
                        ts.Debug.assert(declarations.length === signatures.length);
                        out(createMethodImplementingSignatures(signatures, name, optional, modifiers, preferences));
                    }
                    break;
            }
            function outputMethod(signature, modifiers, name, body) {
                const method = signatureToMethodDeclaration(checker, signature, enclosingDeclaration, modifiers, name, optional, body);
                if (method)
                    out(method);
            }
        }
        function signatureToMethodDeclaration(checker, signature, enclosingDeclaration, modifiers, name, optional, body) {
            const signatureDeclaration = checker.signatureToSignatureDeclaration(signature, ts.SyntaxKind.MethodDeclaration, enclosingDeclaration, ts.NodeBuilderFlags.SuppressAnyReturnType);
            if (!signatureDeclaration) {
                return undefined;
            }
            signatureDeclaration.decorators = undefined;
            signatureDeclaration.modifiers = modifiers;
            signatureDeclaration.name = name;
            signatureDeclaration.questionToken = optional ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined;
            signatureDeclaration.body = body;
            return signatureDeclaration;
        }
        function createMethodFromCallExpression({ typeArguments, arguments: args }, methodName, inJs, makeStatic, preferences) {
            return ts.createMethod(
            /*decorators*/ undefined, 
            /*modifiers*/ makeStatic ? [ts.createToken(ts.SyntaxKind.StaticKeyword)] : undefined, 
            /*asteriskToken*/ undefined, methodName, 
            /*questionToken*/ undefined, 
            /*typeParameters*/ inJs ? undefined : ts.map(typeArguments, (_, i) => ts.createTypeParameterDeclaration(84 /* T */ + typeArguments.length - 1 <= 90 /* Z */ ? String.fromCharCode(84 /* T */ + i) : `T${i}`)), 
            /*parameters*/ createDummyParameters(args.length, /*names*/ undefined, /*minArgumentCount*/ undefined, inJs), 
            /*type*/ inJs ? undefined : ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), createStubbedMethodBody(preferences));
        }
        codefix.createMethodFromCallExpression = createMethodFromCallExpression;
        function createDummyParameters(argCount, names, minArgumentCount, inJs) {
            const parameters = [];
            for (let i = 0; i < argCount; i++) {
                const newParameter = ts.createParameter(
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, 
                /*dotDotDotToken*/ undefined, 
                /*name*/ names && names[i] || `arg${i}`, 
                /*questionToken*/ minArgumentCount !== undefined && i >= minArgumentCount ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined, 
                /*type*/ inJs ? undefined : ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), 
                /*initializer*/ undefined);
                parameters.push(newParameter);
            }
            return parameters;
        }
        function createMethodImplementingSignatures(signatures, name, optional, modifiers, preferences) {
            /** This is *a* signature with the maximal number of arguments,
             * such that if there is a "maximal" signature without rest arguments,
             * this is one of them.
             */
            let maxArgsSignature = signatures[0];
            let minArgumentCount = signatures[0].minArgumentCount;
            let someSigHasRestParameter = false;
            for (const sig of signatures) {
                minArgumentCount = Math.min(sig.minArgumentCount, minArgumentCount);
                if (sig.hasRestParameter) {
                    someSigHasRestParameter = true;
                }
                if (sig.parameters.length >= maxArgsSignature.parameters.length && (!sig.hasRestParameter || maxArgsSignature.hasRestParameter)) {
                    maxArgsSignature = sig;
                }
            }
            const maxNonRestArgs = maxArgsSignature.parameters.length - (maxArgsSignature.hasRestParameter ? 1 : 0);
            const maxArgsParameterSymbolNames = maxArgsSignature.parameters.map(symbol => symbol.name);
            const parameters = createDummyParameters(maxNonRestArgs, maxArgsParameterSymbolNames, minArgumentCount, /*inJs*/ false);
            if (someSigHasRestParameter) {
                const anyArrayType = ts.createArrayTypeNode(ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                const restParameter = ts.createParameter(
                /*decorators*/ undefined, 
                /*modifiers*/ undefined, ts.createToken(ts.SyntaxKind.DotDotDotToken), maxArgsParameterSymbolNames[maxNonRestArgs] || "rest", 
                /*questionToken*/ maxNonRestArgs >= minArgumentCount ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined, anyArrayType, 
                /*initializer*/ undefined);
                parameters.push(restParameter);
            }
            return createStubbedMethod(modifiers, name, optional, 
            /*typeParameters*/ undefined, parameters, 
            /*returnType*/ undefined, preferences);
        }
        function createStubbedMethod(modifiers, name, optional, typeParameters, parameters, returnType, preferences) {
            return ts.createMethod(
            /*decorators*/ undefined, modifiers, 
            /*asteriskToken*/ undefined, name, optional ? ts.createToken(ts.SyntaxKind.QuestionToken) : undefined, typeParameters, parameters, returnType, createStubbedMethodBody(preferences));
        }
        function createStubbedMethodBody(preferences) {
            return ts.createBlock([ts.createThrow(ts.createNew(ts.createIdentifier("Error"), 
                /*typeArguments*/ undefined, [ts.createLiteral("Method not implemented.", /*isSingleQuote*/ preferences.quotePreference === "single")]))], 
            /*multiline*/ true);
        }
        function createVisibilityModifier(flags) {
            if (flags & ts.ModifierFlags.Public) {
                return ts.createToken(ts.SyntaxKind.PublicKeyword);
            }
            else if (flags & ts.ModifierFlags.Protected) {
                return ts.createToken(ts.SyntaxKind.ProtectedKeyword);
            }
            return undefined;
        }
    })(codefix = ts.codefix || (ts.codefix = {}));
})(ts || (ts = {}));
