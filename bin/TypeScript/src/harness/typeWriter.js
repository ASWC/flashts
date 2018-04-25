class TypeWriterWalker {
    constructor(program, fullTypeCheck) {
        this.program = program;
        // Consider getting both the diagnostics checker and the non-diagnostics checker to verify
        // they are consistent.
        this.checker = fullTypeCheck
            ? program.getDiagnosticsProducingTypeChecker()
            : program.getTypeChecker();
    }
    *getSymbols(fileName) {
        const sourceFile = this.program.getSourceFile(fileName);
        this.currentSourceFile = sourceFile;
        const gen = this.visitNode(sourceFile, /*isSymbolWalk*/ true);
        for (let { done, value } = gen.next(); !done; { done, value } = gen.next()) {
            yield value;
        }
    }
    *getTypes(fileName) {
        const sourceFile = this.program.getSourceFile(fileName);
        this.currentSourceFile = sourceFile;
        const gen = this.visitNode(sourceFile, /*isSymbolWalk*/ false);
        for (let { done, value } = gen.next(); !done; { done, value } = gen.next()) {
            yield value;
        }
    }
    *visitNode(node, isSymbolWalk) {
        if (ts.isExpressionNode(node) || node.kind === ts.SyntaxKind.Identifier || ts.isDeclarationName(node)) {
            const result = this.writeTypeOrSymbol(node, isSymbolWalk);
            if (result) {
                yield result;
            }
        }
        const children = [];
        ts.forEachChild(node, child => void children.push(child));
        for (const child of children) {
            const gen = this.visitNode(child, isSymbolWalk);
            for (let { done, value } = gen.next(); !done; { done, value } = gen.next()) {
                yield value;
            }
        }
    }
    writeTypeOrSymbol(node, isSymbolWalk) {
        const actualPos = ts.skipTrivia(this.currentSourceFile.text, node.pos);
        const lineAndCharacter = this.currentSourceFile.getLineAndCharacterOfPosition(actualPos);
        const sourceText = ts.getSourceTextOfNodeFromSourceFile(this.currentSourceFile, node);
        if (!isSymbolWalk) {
            // Workaround to ensure we output 'C' instead of 'typeof C' for base class expressions
            // let type = this.checker.getTypeAtLocation(node);
            const type = node.parent && ts.isExpressionWithTypeArgumentsInClassExtendsClause(node.parent) && this.checker.getTypeAtLocation(node.parent) || this.checker.getTypeAtLocation(node);
            const typeString = type ? this.checker.typeToString(type, node.parent, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.AllowUniqueESSymbolType) : "No type information available!";
            return {
                line: lineAndCharacter.line,
                syntaxKind: node.kind,
                sourceText,
                type: typeString
            };
        }
        const symbol = this.checker.getSymbolAtLocation(node);
        if (!symbol) {
            return;
        }
        let symbolString = "Symbol(" + this.checker.symbolToString(symbol, node.parent);
        if (symbol.declarations) {
            let count = 0;
            for (const declaration of symbol.declarations) {
                if (count >= 5) {
                    symbolString += ` ... and ${symbol.declarations.length - count} more`;
                    break;
                }
                count++;
                symbolString += ", ";
                if (declaration.__symbolTestOutputCache) {
                    symbolString += declaration.__symbolTestOutputCache;
                    continue;
                }
                const declSourceFile = declaration.getSourceFile();
                const declLineAndCharacter = declSourceFile.getLineAndCharacterOfPosition(declaration.pos);
                const fileName = ts.getBaseFileName(declSourceFile.fileName);
                const isLibFile = /lib(.*)\.d\.ts/i.test(fileName);
                const declText = `Decl(${fileName}, ${isLibFile ? "--" : declLineAndCharacter.line}, ${isLibFile ? "--" : declLineAndCharacter.character})`;
                symbolString += declText;
                declaration.__symbolTestOutputCache = declText;
            }
        }
        symbolString += ")";
        return {
            line: lineAndCharacter.line,
            syntaxKind: node.kind,
            sourceText,
            symbol: symbolString
        };
    }
}
