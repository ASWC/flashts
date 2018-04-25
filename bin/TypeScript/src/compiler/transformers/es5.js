/*@internal*/
var ts;
(function (ts) {
    /**
     * Transforms ES5 syntax into ES3 syntax.
     *
     * @param context Context and state information for the transformation.
     */
    function transformES5(context) {
        const compilerOptions = context.getCompilerOptions();
        // enable emit notification only if using --jsx preserve or react-native
        let previousOnEmitNode;
        let noSubstitution;
        if (compilerOptions.jsx === ts.JsxEmit.Preserve || compilerOptions.jsx === ts.JsxEmit.ReactNative) {
            previousOnEmitNode = context.onEmitNode;
            context.onEmitNode = onEmitNode;
            context.enableEmitNotification(ts.SyntaxKind.JsxOpeningElement);
            context.enableEmitNotification(ts.SyntaxKind.JsxClosingElement);
            context.enableEmitNotification(ts.SyntaxKind.JsxSelfClosingElement);
            noSubstitution = [];
        }
        const previousOnSubstituteNode = context.onSubstituteNode;
        context.onSubstituteNode = onSubstituteNode;
        context.enableSubstitution(ts.SyntaxKind.PropertyAccessExpression);
        context.enableSubstitution(ts.SyntaxKind.PropertyAssignment);
        return transformSourceFile;
        /**
         * Transforms an ES5 source file to ES3.
         *
         * @param node A SourceFile
         */
        function transformSourceFile(node) {
            return node;
        }
        /**
         * Called by the printer just before a node is printed.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to emit.
         * @param emitCallback A callback used to emit the node.
         */
        function onEmitNode(hint, node, emitCallback) {
            switch (node.kind) {
                case ts.SyntaxKind.JsxOpeningElement:
                case ts.SyntaxKind.JsxClosingElement:
                case ts.SyntaxKind.JsxSelfClosingElement:
                    const tagName = node.tagName;
                    noSubstitution[ts.getOriginalNodeId(tagName)] = true;
                    break;
            }
            previousOnEmitNode(hint, node, emitCallback);
        }
        /**
         * Hooks node substitutions.
         *
         * @param hint A hint as to the intended usage of the node.
         * @param node The node to substitute.
         */
        function onSubstituteNode(hint, node) {
            if (node.id && noSubstitution && noSubstitution[node.id]) {
                return previousOnSubstituteNode(hint, node);
            }
            node = previousOnSubstituteNode(hint, node);
            if (ts.isPropertyAccessExpression(node)) {
                return substitutePropertyAccessExpression(node);
            }
            else if (ts.isPropertyAssignment(node)) {
                return substitutePropertyAssignment(node);
            }
            return node;
        }
        /**
         * Substitutes a PropertyAccessExpression whose name is a reserved word.
         *
         * @param node A PropertyAccessExpression
         */
        function substitutePropertyAccessExpression(node) {
            const literalName = trySubstituteReservedName(node.name);
            if (literalName) {
                return ts.setTextRange(ts.createElementAccess(node.expression, literalName), node);
            }
            return node;
        }
        /**
         * Substitutes a PropertyAssignment whose name is a reserved word.
         *
         * @param node A PropertyAssignment
         */
        function substitutePropertyAssignment(node) {
            const literalName = ts.isIdentifier(node.name) && trySubstituteReservedName(node.name);
            if (literalName) {
                return ts.updatePropertyAssignment(node, literalName, node.initializer);
            }
            return node;
        }
        /**
         * If an identifier name is a reserved word, returns a string literal for the name.
         *
         * @param name An Identifier
         */
        function trySubstituteReservedName(name) {
            const token = name.originalKeywordKind || (ts.nodeIsSynthesized(name) ? ts.stringToToken(ts.idText(name)) : undefined);
            if (token >= ts.SyntaxKind.FirstReservedWord && token <= ts.SyntaxKind.LastReservedWord) {
                return ts.setTextRange(ts.createLiteral(name), name);
            }
            return undefined;
        }
    }
    ts.transformES5 = transformES5;
})(ts || (ts = {}));
