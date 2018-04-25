/*@internal*/
var ts;
(function (ts) {
    function transformES2016(context) {
        const { hoistVariableDeclaration } = context;
        return transformSourceFile;
        function transformSourceFile(node) {
            if (node.isDeclarationFile) {
                return node;
            }
            return ts.visitEachChild(node, visitor, context);
        }
        function visitor(node) {
            if ((node.transformFlags & 32 /* ContainsES2016 */) === 0) {
                return node;
            }
            switch (node.kind) {
                case ts.SyntaxKind.BinaryExpression:
                    return visitBinaryExpression(node);
                default:
                    return ts.visitEachChild(node, visitor, context);
            }
        }
        function visitBinaryExpression(node) {
            switch (node.operatorToken.kind) {
                case ts.SyntaxKind.AsteriskAsteriskEqualsToken:
                    return visitExponentiationAssignmentExpression(node);
                case ts.SyntaxKind.AsteriskAsteriskToken:
                    return visitExponentiationExpression(node);
                default:
                    return ts.visitEachChild(node, visitor, context);
            }
        }
        function visitExponentiationAssignmentExpression(node) {
            let target;
            let value;
            const left = ts.visitNode(node.left, visitor, ts.isExpression);
            const right = ts.visitNode(node.right, visitor, ts.isExpression);
            if (ts.isElementAccessExpression(left)) {
                // Transforms `a[x] **= b` into `(_a = a)[_x = x] = Math.pow(_a[_x], b)`
                const expressionTemp = ts.createTempVariable(hoistVariableDeclaration);
                const argumentExpressionTemp = ts.createTempVariable(hoistVariableDeclaration);
                target = ts.setTextRange(ts.createElementAccess(ts.setTextRange(ts.createAssignment(expressionTemp, left.expression), left.expression), ts.setTextRange(ts.createAssignment(argumentExpressionTemp, left.argumentExpression), left.argumentExpression)), left);
                value = ts.setTextRange(ts.createElementAccess(expressionTemp, argumentExpressionTemp), left);
            }
            else if (ts.isPropertyAccessExpression(left)) {
                // Transforms `a.x **= b` into `(_a = a).x = Math.pow(_a.x, b)`
                const expressionTemp = ts.createTempVariable(hoistVariableDeclaration);
                target = ts.setTextRange(ts.createPropertyAccess(ts.setTextRange(ts.createAssignment(expressionTemp, left.expression), left.expression), left.name), left);
                value = ts.setTextRange(ts.createPropertyAccess(expressionTemp, left.name), left);
            }
            else {
                // Transforms `a **= b` into `a = Math.pow(a, b)`
                target = left;
                value = left;
            }
            return ts.setTextRange(ts.createAssignment(target, ts.createMathPow(value, right, /*location*/ node)), node);
        }
        function visitExponentiationExpression(node) {
            // Transforms `a ** b` into `Math.pow(a, b)`
            const left = ts.visitNode(node.left, visitor, ts.isExpression);
            const right = ts.visitNode(node.right, visitor, ts.isExpression);
            return ts.createMathPow(left, right, /*location*/ node);
        }
    }
    ts.transformES2016 = transformES2016;
})(ts || (ts = {}));
