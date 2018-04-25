// These utilities are common to multiple language service features.
/* @internal */
var ts;
(function (ts) {
    ts.scanner = ts.createScanner(ts.ScriptTarget.Latest, /*skipTrivia*/ true);
    function getMeaningFromDeclaration(node) {
        switch (node.kind) {
            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.VariableDeclaration:
            case ts.SyntaxKind.BindingElement:
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.ShorthandPropertyAssignment:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.CatchClause:
            case ts.SyntaxKind.JsxAttribute:
                return 1 /* Value */;
            case ts.SyntaxKind.TypeParameter:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.TypeAliasDeclaration:
            case ts.SyntaxKind.TypeLiteral:
                return 2 /* Type */;
            case ts.SyntaxKind.JSDocTypedefTag:
                // If it has no name node, it shares the name with the value declaration below it.
                return node.name === undefined ? 1 /* Value */ | 2 /* Type */ : 2 /* Type */;
            case ts.SyntaxKind.EnumMember:
            case ts.SyntaxKind.ClassDeclaration:
                return 1 /* Value */ | 2 /* Type */;
            case ts.SyntaxKind.ModuleDeclaration:
                if (ts.isAmbientModule(node)) {
                    return 4 /* Namespace */ | 1 /* Value */;
                }
                else if (ts.getModuleInstanceState(node) === 1 /* Instantiated */) {
                    return 4 /* Namespace */ | 1 /* Value */;
                }
                else {
                    return 4 /* Namespace */;
                }
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.NamedImports:
            case ts.SyntaxKind.ImportSpecifier:
            case ts.SyntaxKind.ImportEqualsDeclaration:
            case ts.SyntaxKind.ImportDeclaration:
            case ts.SyntaxKind.ExportAssignment:
            case ts.SyntaxKind.ExportDeclaration:
                return 7 /* All */;
            // An external module can be a Value
            case ts.SyntaxKind.SourceFile:
                return 4 /* Namespace */ | 1 /* Value */;
        }
        return 7 /* All */;
    }
    ts.getMeaningFromDeclaration = getMeaningFromDeclaration;
    function getMeaningFromLocation(node) {
        if (node.kind === ts.SyntaxKind.SourceFile) {
            return 1 /* Value */;
        }
        else if (node.parent.kind === ts.SyntaxKind.ExportAssignment) {
            return 7 /* All */;
        }
        else if (isInRightSideOfInternalImportEqualsDeclaration(node)) {
            return getMeaningFromRightHandSideOfImportEquals(node);
        }
        else if (ts.isDeclarationName(node)) {
            return getMeaningFromDeclaration(node.parent);
        }
        else if (isTypeReference(node)) {
            return 2 /* Type */;
        }
        else if (isNamespaceReference(node)) {
            return 4 /* Namespace */;
        }
        else if (ts.isTypeParameterDeclaration(node.parent)) {
            ts.Debug.assert(ts.isJSDocTemplateTag(node.parent.parent)); // Else would be handled by isDeclarationName
            return 2 /* Type */;
        }
        else {
            return 1 /* Value */;
        }
    }
    ts.getMeaningFromLocation = getMeaningFromLocation;
    function getMeaningFromRightHandSideOfImportEquals(node) {
        //     import a = |b|; // Namespace
        //     import a = |b.c|; // Value, type, namespace
        //     import a = |b.c|.d; // Namespace
        const name = node.kind === ts.SyntaxKind.QualifiedName ? node : ts.isQualifiedName(node.parent) && node.parent.right === node ? node.parent : undefined;
        return name && name.parent.kind === ts.SyntaxKind.ImportEqualsDeclaration ? 7 /* All */ : 4 /* Namespace */;
    }
    function isInRightSideOfInternalImportEqualsDeclaration(node) {
        while (node.parent.kind === ts.SyntaxKind.QualifiedName) {
            node = node.parent;
        }
        return ts.isInternalModuleImportEqualsDeclaration(node.parent) && node.parent.moduleReference === node;
    }
    ts.isInRightSideOfInternalImportEqualsDeclaration = isInRightSideOfInternalImportEqualsDeclaration;
    function isNamespaceReference(node) {
        return isQualifiedNameNamespaceReference(node) || isPropertyAccessNamespaceReference(node);
    }
    function isQualifiedNameNamespaceReference(node) {
        let root = node;
        let isLastClause = true;
        if (root.parent.kind === ts.SyntaxKind.QualifiedName) {
            while (root.parent && root.parent.kind === ts.SyntaxKind.QualifiedName) {
                root = root.parent;
            }
            isLastClause = root.right === node;
        }
        return root.parent.kind === ts.SyntaxKind.TypeReference && !isLastClause;
    }
    function isPropertyAccessNamespaceReference(node) {
        let root = node;
        let isLastClause = true;
        if (root.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
            while (root.parent && root.parent.kind === ts.SyntaxKind.PropertyAccessExpression) {
                root = root.parent;
            }
            isLastClause = root.name === node;
        }
        if (!isLastClause && root.parent.kind === ts.SyntaxKind.ExpressionWithTypeArguments && root.parent.parent.kind === ts.SyntaxKind.HeritageClause) {
            const decl = root.parent.parent.parent;
            return (decl.kind === ts.SyntaxKind.ClassDeclaration && root.parent.parent.token === ts.SyntaxKind.ImplementsKeyword) ||
                (decl.kind === ts.SyntaxKind.InterfaceDeclaration && root.parent.parent.token === ts.SyntaxKind.ExtendsKeyword);
        }
        return false;
    }
    function isTypeReference(node) {
        if (ts.isRightSideOfQualifiedNameOrPropertyAccess(node)) {
            node = node.parent;
        }
        switch (node.kind) {
            case ts.SyntaxKind.ThisKeyword:
                return !ts.isExpressionNode(node);
            case ts.SyntaxKind.ThisType:
                return true;
        }
        switch (node.parent.kind) {
            case ts.SyntaxKind.TypeReference:
                return true;
            case ts.SyntaxKind.ExpressionWithTypeArguments:
                return !ts.isExpressionWithTypeArgumentsInClassExtendsClause(node.parent);
        }
        return false;
    }
    function isCallExpressionTarget(node) {
        return isCallOrNewExpressionTarget(node, ts.SyntaxKind.CallExpression);
    }
    ts.isCallExpressionTarget = isCallExpressionTarget;
    function isNewExpressionTarget(node) {
        return isCallOrNewExpressionTarget(node, ts.SyntaxKind.NewExpression);
    }
    ts.isNewExpressionTarget = isNewExpressionTarget;
    function isCallOrNewExpressionTarget(node, kind) {
        const target = climbPastPropertyAccess(node);
        return target && target.parent && target.parent.kind === kind && target.parent.expression === target;
    }
    function climbPastPropertyAccess(node) {
        return isRightSideOfPropertyAccess(node) ? node.parent : node;
    }
    ts.climbPastPropertyAccess = climbPastPropertyAccess;
    function getTargetLabel(referenceNode, labelName) {
        while (referenceNode) {
            if (referenceNode.kind === ts.SyntaxKind.LabeledStatement && referenceNode.label.escapedText === labelName) {
                return referenceNode.label;
            }
            referenceNode = referenceNode.parent;
        }
        return undefined;
    }
    ts.getTargetLabel = getTargetLabel;
    function isJumpStatementTarget(node) {
        return node.kind === ts.SyntaxKind.Identifier && ts.isBreakOrContinueStatement(node.parent) && node.parent.label === node;
    }
    ts.isJumpStatementTarget = isJumpStatementTarget;
    function isLabelOfLabeledStatement(node) {
        return node.kind === ts.SyntaxKind.Identifier && ts.isLabeledStatement(node.parent) && node.parent.label === node;
    }
    ts.isLabelOfLabeledStatement = isLabelOfLabeledStatement;
    function isLabelName(node) {
        return isLabelOfLabeledStatement(node) || isJumpStatementTarget(node);
    }
    ts.isLabelName = isLabelName;
    function isRightSideOfQualifiedName(node) {
        return node.parent.kind === ts.SyntaxKind.QualifiedName && node.parent.right === node;
    }
    ts.isRightSideOfQualifiedName = isRightSideOfQualifiedName;
    function isRightSideOfPropertyAccess(node) {
        return node && node.parent && node.parent.kind === ts.SyntaxKind.PropertyAccessExpression && node.parent.name === node;
    }
    ts.isRightSideOfPropertyAccess = isRightSideOfPropertyAccess;
    function isNameOfModuleDeclaration(node) {
        return node.parent.kind === ts.SyntaxKind.ModuleDeclaration && node.parent.name === node;
    }
    ts.isNameOfModuleDeclaration = isNameOfModuleDeclaration;
    function isNameOfFunctionDeclaration(node) {
        return node.kind === ts.SyntaxKind.Identifier &&
            ts.isFunctionLike(node.parent) && node.parent.name === node;
    }
    ts.isNameOfFunctionDeclaration = isNameOfFunctionDeclaration;
    function isLiteralNameOfPropertyDeclarationOrIndexAccess(node) {
        switch (node.parent.kind) {
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
            case ts.SyntaxKind.PropertyAssignment:
            case ts.SyntaxKind.EnumMember:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.ModuleDeclaration:
                return ts.getNameOfDeclaration(node.parent) === node;
            case ts.SyntaxKind.ElementAccessExpression:
                return node.parent.argumentExpression === node;
            case ts.SyntaxKind.ComputedPropertyName:
                return true;
            case ts.SyntaxKind.LiteralType:
                return node.parent.parent.kind === ts.SyntaxKind.IndexedAccessType;
        }
    }
    ts.isLiteralNameOfPropertyDeclarationOrIndexAccess = isLiteralNameOfPropertyDeclarationOrIndexAccess;
    function isExpressionOfExternalModuleImportEqualsDeclaration(node) {
        return ts.isExternalModuleImportEqualsDeclaration(node.parent.parent) &&
            ts.getExternalModuleImportEqualsDeclarationExpression(node.parent.parent) === node;
    }
    ts.isExpressionOfExternalModuleImportEqualsDeclaration = isExpressionOfExternalModuleImportEqualsDeclaration;
    function getContainerNode(node) {
        if (node.kind === ts.SyntaxKind.JSDocTypedefTag) {
            // This doesn't just apply to the node immediately under the comment, but to everything in its parent's scope.
            // node.parent = the JSDoc comment, node.parent.parent = the node having the comment.
            // Then we get parent again in the loop.
            node = node.parent.parent;
        }
        while (true) {
            node = node.parent;
            if (!node) {
                return undefined;
            }
            switch (node.kind) {
                case ts.SyntaxKind.SourceFile:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.ModuleDeclaration:
                    return node;
            }
        }
    }
    ts.getContainerNode = getContainerNode;
    function getNodeKind(node) {
        switch (node.kind) {
            case ts.SyntaxKind.SourceFile:
                return ts.isExternalModule(node) ? ts.ScriptElementKind.moduleElement : ts.ScriptElementKind.scriptElement;
            case ts.SyntaxKind.ModuleDeclaration:
                return ts.ScriptElementKind.moduleElement;
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.ClassExpression:
                return ts.ScriptElementKind.classElement;
            case ts.SyntaxKind.InterfaceDeclaration: return ts.ScriptElementKind.interfaceElement;
            case ts.SyntaxKind.TypeAliasDeclaration: return ts.ScriptElementKind.typeElement;
            case ts.SyntaxKind.EnumDeclaration: return ts.ScriptElementKind.enumElement;
            case ts.SyntaxKind.VariableDeclaration:
                return getKindOfVariableDeclaration(node);
            case ts.SyntaxKind.BindingElement:
                return getKindOfVariableDeclaration(ts.getRootDeclaration(node));
            case ts.SyntaxKind.ArrowFunction:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
                return ts.ScriptElementKind.functionElement;
            case ts.SyntaxKind.GetAccessor: return ts.ScriptElementKind.memberGetAccessorElement;
            case ts.SyntaxKind.SetAccessor: return ts.ScriptElementKind.memberSetAccessorElement;
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
                return ts.ScriptElementKind.memberFunctionElement;
            case ts.SyntaxKind.PropertyDeclaration:
            case ts.SyntaxKind.PropertySignature:
                return ts.ScriptElementKind.memberVariableElement;
            case ts.SyntaxKind.IndexSignature: return ts.ScriptElementKind.indexSignatureElement;
            case ts.SyntaxKind.ConstructSignature: return ts.ScriptElementKind.constructSignatureElement;
            case ts.SyntaxKind.CallSignature: return ts.ScriptElementKind.callSignatureElement;
            case ts.SyntaxKind.Constructor: return ts.ScriptElementKind.constructorImplementationElement;
            case ts.SyntaxKind.TypeParameter: return ts.ScriptElementKind.typeParameterElement;
            case ts.SyntaxKind.EnumMember: return ts.ScriptElementKind.enumMemberElement;
            case ts.SyntaxKind.Parameter: return ts.hasModifier(node, ts.ModifierFlags.ParameterPropertyModifier) ? ts.ScriptElementKind.memberVariableElement : ts.ScriptElementKind.parameterElement;
            case ts.SyntaxKind.ImportEqualsDeclaration:
            case ts.SyntaxKind.ImportSpecifier:
            case ts.SyntaxKind.ImportClause:
            case ts.SyntaxKind.ExportSpecifier:
            case ts.SyntaxKind.NamespaceImport:
                return ts.ScriptElementKind.alias;
            case ts.SyntaxKind.JSDocTypedefTag:
                return ts.ScriptElementKind.typeElement;
            case ts.SyntaxKind.BinaryExpression:
                const kind = ts.getSpecialPropertyAssignmentKind(node);
                const { right } = node;
                switch (kind) {
                    case 0 /* None */:
                        return ts.ScriptElementKind.unknown;
                    case 1 /* ExportsProperty */:
                    case 2 /* ModuleExports */:
                        const rightKind = getNodeKind(right);
                        return rightKind === ts.ScriptElementKind.unknown ? ts.ScriptElementKind.constElement : rightKind;
                    case 3 /* PrototypeProperty */:
                        return ts.isFunctionExpression(right) ? ts.ScriptElementKind.memberFunctionElement : ts.ScriptElementKind.memberVariableElement;
                    case 4 /* ThisProperty */:
                        return ts.ScriptElementKind.memberVariableElement; // property
                    case 5 /* Property */:
                        // static method / property
                        return ts.isFunctionExpression(right) ? ts.ScriptElementKind.memberFunctionElement : ts.ScriptElementKind.memberVariableElement;
                    case 6 /* Prototype */:
                        return ts.ScriptElementKind.localClassElement;
                    default: {
                        ts.assertTypeIsNever(kind);
                        return ts.ScriptElementKind.unknown;
                    }
                }
            default:
                return ts.ScriptElementKind.unknown;
        }
        function getKindOfVariableDeclaration(v) {
            return ts.isConst(v)
                ? ts.ScriptElementKind.constElement
                : ts.isLet(v)
                    ? ts.ScriptElementKind.letElement
                    : ts.ScriptElementKind.variableElement;
        }
    }
    ts.getNodeKind = getNodeKind;
    function isThis(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ThisKeyword:
                // case SyntaxKind.ThisType: TODO: GH#9267
                return true;
            case ts.SyntaxKind.Identifier:
                // 'this' as a parameter
                return ts.identifierIsThisKeyword(node) && node.parent.kind === ts.SyntaxKind.Parameter;
            default:
                return false;
        }
    }
    ts.isThis = isThis;
    // Matches the beginning of a triple slash directive
    const tripleSlashDirectivePrefixRegex = /^\/\/\/\s*</;
    function getLineStartPositionForPosition(position, sourceFile) {
        const lineStarts = ts.getLineStarts(sourceFile);
        const line = sourceFile.getLineAndCharacterOfPosition(position).line;
        return lineStarts[line];
    }
    ts.getLineStartPositionForPosition = getLineStartPositionForPosition;
    function rangeContainsRange(r1, r2) {
        return startEndContainsRange(r1.pos, r1.end, r2);
    }
    ts.rangeContainsRange = rangeContainsRange;
    function startEndContainsRange(start, end, range) {
        return start <= range.pos && end >= range.end;
    }
    ts.startEndContainsRange = startEndContainsRange;
    function rangeContainsStartEnd(range, start, end) {
        return range.pos <= start && range.end >= end;
    }
    ts.rangeContainsStartEnd = rangeContainsStartEnd;
    function rangeOverlapsWithStartEnd(r1, start, end) {
        return startEndOverlapsWithStartEnd(r1.pos, r1.end, start, end);
    }
    ts.rangeOverlapsWithStartEnd = rangeOverlapsWithStartEnd;
    function startEndOverlapsWithStartEnd(start1, end1, start2, end2) {
        const start = Math.max(start1, start2);
        const end = Math.min(end1, end2);
        return start < end;
    }
    ts.startEndOverlapsWithStartEnd = startEndOverlapsWithStartEnd;
    /**
     * Assumes `candidate.start <= position` holds.
     */
    function positionBelongsToNode(candidate, position, sourceFile) {
        ts.Debug.assert(candidate.pos <= position);
        return position < candidate.end || !isCompletedNode(candidate, sourceFile);
    }
    ts.positionBelongsToNode = positionBelongsToNode;
    function isCompletedNode(n, sourceFile) {
        if (ts.nodeIsMissing(n)) {
            return false;
        }
        switch (n.kind) {
            case ts.SyntaxKind.ClassDeclaration:
            case ts.SyntaxKind.InterfaceDeclaration:
            case ts.SyntaxKind.EnumDeclaration:
            case ts.SyntaxKind.ObjectLiteralExpression:
            case ts.SyntaxKind.ObjectBindingPattern:
            case ts.SyntaxKind.TypeLiteral:
            case ts.SyntaxKind.Block:
            case ts.SyntaxKind.ModuleBlock:
            case ts.SyntaxKind.CaseBlock:
            case ts.SyntaxKind.NamedImports:
            case ts.SyntaxKind.NamedExports:
                return nodeEndsWith(n, ts.SyntaxKind.CloseBraceToken, sourceFile);
            case ts.SyntaxKind.CatchClause:
                return isCompletedNode(n.block, sourceFile);
            case ts.SyntaxKind.NewExpression:
                if (!n.arguments) {
                    return true;
                }
            // falls through
            case ts.SyntaxKind.CallExpression:
            case ts.SyntaxKind.ParenthesizedExpression:
            case ts.SyntaxKind.ParenthesizedType:
                return nodeEndsWith(n, ts.SyntaxKind.CloseParenToken, sourceFile);
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
                return isCompletedNode(n.type, sourceFile);
            case ts.SyntaxKind.Constructor:
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
            case ts.SyntaxKind.FunctionDeclaration:
            case ts.SyntaxKind.FunctionExpression:
            case ts.SyntaxKind.MethodDeclaration:
            case ts.SyntaxKind.MethodSignature:
            case ts.SyntaxKind.ConstructSignature:
            case ts.SyntaxKind.CallSignature:
            case ts.SyntaxKind.ArrowFunction:
                if (n.body) {
                    return isCompletedNode(n.body, sourceFile);
                }
                if (n.type) {
                    return isCompletedNode(n.type, sourceFile);
                }
                // Even though type parameters can be unclosed, we can get away with
                // having at least a closing paren.
                return hasChildOfKind(n, ts.SyntaxKind.CloseParenToken, sourceFile);
            case ts.SyntaxKind.ModuleDeclaration:
                return n.body && isCompletedNode(n.body, sourceFile);
            case ts.SyntaxKind.IfStatement:
                if (n.elseStatement) {
                    return isCompletedNode(n.elseStatement, sourceFile);
                }
                return isCompletedNode(n.thenStatement, sourceFile);
            case ts.SyntaxKind.ExpressionStatement:
                return isCompletedNode(n.expression, sourceFile) ||
                    hasChildOfKind(n, ts.SyntaxKind.SemicolonToken, sourceFile);
            case ts.SyntaxKind.ArrayLiteralExpression:
            case ts.SyntaxKind.ArrayBindingPattern:
            case ts.SyntaxKind.ElementAccessExpression:
            case ts.SyntaxKind.ComputedPropertyName:
            case ts.SyntaxKind.TupleType:
                return nodeEndsWith(n, ts.SyntaxKind.CloseBracketToken, sourceFile);
            case ts.SyntaxKind.IndexSignature:
                if (n.type) {
                    return isCompletedNode(n.type, sourceFile);
                }
                return hasChildOfKind(n, ts.SyntaxKind.CloseBracketToken, sourceFile);
            case ts.SyntaxKind.CaseClause:
            case ts.SyntaxKind.DefaultClause:
                // there is no such thing as terminator token for CaseClause/DefaultClause so for simplicity always consider them non-completed
                return false;
            case ts.SyntaxKind.ForStatement:
            case ts.SyntaxKind.ForInStatement:
            case ts.SyntaxKind.ForOfStatement:
            case ts.SyntaxKind.WhileStatement:
                return isCompletedNode(n.statement, sourceFile);
            case ts.SyntaxKind.DoStatement:
                // rough approximation: if DoStatement has While keyword - then if node is completed is checking the presence of ')';
                return hasChildOfKind(n, ts.SyntaxKind.WhileKeyword, sourceFile)
                    ? nodeEndsWith(n, ts.SyntaxKind.CloseParenToken, sourceFile)
                    : isCompletedNode(n.statement, sourceFile);
            case ts.SyntaxKind.TypeQuery:
                return isCompletedNode(n.exprName, sourceFile);
            case ts.SyntaxKind.TypeOfExpression:
            case ts.SyntaxKind.DeleteExpression:
            case ts.SyntaxKind.VoidExpression:
            case ts.SyntaxKind.YieldExpression:
            case ts.SyntaxKind.SpreadElement:
                const unaryWordExpression = n;
                return isCompletedNode(unaryWordExpression.expression, sourceFile);
            case ts.SyntaxKind.TaggedTemplateExpression:
                return isCompletedNode(n.template, sourceFile);
            case ts.SyntaxKind.TemplateExpression:
                const lastSpan = ts.lastOrUndefined(n.templateSpans);
                return isCompletedNode(lastSpan, sourceFile);
            case ts.SyntaxKind.TemplateSpan:
                return ts.nodeIsPresent(n.literal);
            case ts.SyntaxKind.ExportDeclaration:
            case ts.SyntaxKind.ImportDeclaration:
                return ts.nodeIsPresent(n.moduleSpecifier);
            case ts.SyntaxKind.PrefixUnaryExpression:
                return isCompletedNode(n.operand, sourceFile);
            case ts.SyntaxKind.BinaryExpression:
                return isCompletedNode(n.right, sourceFile);
            case ts.SyntaxKind.ConditionalExpression:
                return isCompletedNode(n.whenFalse, sourceFile);
            default:
                return true;
        }
    }
    /*
     * Checks if node ends with 'expectedLastToken'.
     * If child at position 'length - 1' is 'SemicolonToken' it is skipped and 'expectedLastToken' is compared with child at position 'length - 2'.
     */
    function nodeEndsWith(n, expectedLastToken, sourceFile) {
        const children = n.getChildren(sourceFile);
        if (children.length) {
            const last = ts.lastOrUndefined(children);
            if (last.kind === expectedLastToken) {
                return true;
            }
            else if (last.kind === ts.SyntaxKind.SemicolonToken && children.length !== 1) {
                return children[children.length - 2].kind === expectedLastToken;
            }
        }
        return false;
    }
    function findListItemInfo(node) {
        const list = findContainingList(node);
        // It is possible at this point for syntaxList to be undefined, either if
        // node.parent had no list child, or if none of its list children contained
        // the span of node. If this happens, return undefined. The caller should
        // handle this case.
        if (!list) {
            return undefined;
        }
        const children = list.getChildren();
        const listItemIndex = ts.indexOfNode(children, node);
        return {
            listItemIndex,
            list
        };
    }
    ts.findListItemInfo = findListItemInfo;
    function hasChildOfKind(n, kind, sourceFile) {
        return !!findChildOfKind(n, kind, sourceFile);
    }
    ts.hasChildOfKind = hasChildOfKind;
    function findChildOfKind(n, kind, sourceFile) {
        return ts.find(n.getChildren(sourceFile), (c) => c.kind === kind);
    }
    ts.findChildOfKind = findChildOfKind;
    function findContainingList(node) {
        // The node might be a list element (nonsynthetic) or a comma (synthetic). Either way, it will
        // be parented by the container of the SyntaxList, not the SyntaxList itself.
        // In order to find the list item index, we first need to locate SyntaxList itself and then search
        // for the position of the relevant node (or comma).
        const syntaxList = ts.find(node.parent.getChildren(), (c) => ts.isSyntaxList(c) && rangeContainsRange(c, node));
        // Either we didn't find an appropriate list, or the list must contain us.
        ts.Debug.assert(!syntaxList || ts.contains(syntaxList.getChildren(), node));
        return syntaxList;
    }
    ts.findContainingList = findContainingList;
    /**
     * Gets the token whose text has range [start, end) and
     * position >= start and (position < end or (position === end && token is literal or keyword or identifier))
     */
    function getTouchingPropertyName(sourceFile, position, includeJsDocComment) {
        return getTouchingToken(sourceFile, position, includeJsDocComment, n => ts.isPropertyNameLiteral(n) || ts.isKeyword(n.kind));
    }
    ts.getTouchingPropertyName = getTouchingPropertyName;
    /**
     * Returns the token if position is in [start, end).
     * If position === end, returns the preceding token if includeItemAtEndPosition(previousToken) === true
     */
    function getTouchingToken(sourceFile, position, includeJsDocComment, includePrecedingTokenAtEndPosition) {
        return getTokenAtPositionWorker(sourceFile, position, /*allowPositionInLeadingTrivia*/ false, includePrecedingTokenAtEndPosition, /*includeEndPosition*/ false, includeJsDocComment);
    }
    ts.getTouchingToken = getTouchingToken;
    /** Returns a token if position is in [start-of-leading-trivia, end) */
    function getTokenAtPosition(sourceFile, position, includeJsDocComment, includeEndPosition) {
        return getTokenAtPositionWorker(sourceFile, position, /*allowPositionInLeadingTrivia*/ true, /*includePrecedingTokenAtEndPosition*/ undefined, includeEndPosition, includeJsDocComment);
    }
    ts.getTokenAtPosition = getTokenAtPosition;
    /** Get the token whose text contains the position */
    function getTokenAtPositionWorker(sourceFile, position, allowPositionInLeadingTrivia, includePrecedingTokenAtEndPosition, includeEndPosition, includeJsDocComment) {
        let current = sourceFile;
        outer: while (true) {
            if (ts.isToken(current)) {
                // exit early
                return current;
            }
            // find the child that contains 'position'
            for (const child of current.getChildren()) {
                if (!includeJsDocComment && ts.isJSDocNode(child)) {
                    continue;
                }
                const start = allowPositionInLeadingTrivia ? child.getFullStart() : child.getStart(sourceFile, includeJsDocComment);
                if (start > position) {
                    // If this child begins after position, then all subsequent children will as well.
                    break;
                }
                const end = child.getEnd();
                if (position < end || (position === end && (child.kind === ts.SyntaxKind.EndOfFileToken || includeEndPosition))) {
                    current = child;
                    continue outer;
                }
                else if (includePrecedingTokenAtEndPosition && end === position) {
                    const previousToken = findPrecedingToken(position, sourceFile, child);
                    if (previousToken && includePrecedingTokenAtEndPosition(previousToken)) {
                        return previousToken;
                    }
                }
            }
            return current;
        }
    }
    /**
     * The token on the left of the position is the token that strictly includes the position
     * or sits to the left of the cursor if it is on a boundary. For example
     *
     *   fo|o               -> will return foo
     *   foo <comment> |bar -> will return foo
     *
     */
    function findTokenOnLeftOfPosition(file, position) {
        // Ideally, getTokenAtPosition should return a token. However, it is currently
        // broken, so we do a check to make sure the result was indeed a token.
        const tokenAtPosition = getTokenAtPosition(file, position, /*includeJsDocComment*/ false);
        if (ts.isToken(tokenAtPosition) && position > tokenAtPosition.getStart(file) && position < tokenAtPosition.getEnd()) {
            return tokenAtPosition;
        }
        return findPrecedingToken(position, file);
    }
    ts.findTokenOnLeftOfPosition = findTokenOnLeftOfPosition;
    function findNextToken(previousToken, parent) {
        return find(parent);
        function find(n) {
            if (ts.isToken(n) && n.pos === previousToken.end) {
                // this is token that starts at the end of previous token - return it
                return n;
            }
            const children = n.getChildren();
            for (const child of children) {
                const shouldDiveInChildNode = 
                // previous token is enclosed somewhere in the child
                (child.pos <= previousToken.pos && child.end > previousToken.end) ||
                    // previous token ends exactly at the beginning of child
                    (child.pos === previousToken.end);
                if (shouldDiveInChildNode && nodeHasTokens(child)) {
                    return find(child);
                }
            }
            return undefined;
        }
    }
    ts.findNextToken = findNextToken;
    /**
     * Finds the rightmost token satisfying `token.end <= position`,
     * excluding `JsxText` tokens containing only whitespace.
     */
    function findPrecedingToken(position, sourceFile, startNode, includeJsDoc) {
        const result = find(startNode || sourceFile);
        ts.Debug.assert(!(result && isWhiteSpaceOnlyJsxText(result)));
        return result;
        function find(n) {
            if (isNonWhitespaceToken(n)) {
                return n;
            }
            const children = n.getChildren(sourceFile);
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                // Note that the span of a node's tokens is [node.getStart(...), node.end).
                // Given that `position < child.end` and child has constituent tokens, we distinguish these cases:
                // 1) `position` precedes `child`'s tokens or `child` has no tokens (ie: in a comment or whitespace preceding `child`):
                // we need to find the last token in a previous child.
                // 2) `position` is within the same span: we recurse on `child`.
                if (position < child.end) {
                    const start = child.getStart(sourceFile, includeJsDoc);
                    const lookInPreviousChild = (start >= position) || // cursor in the leading trivia
                        !nodeHasTokens(child) ||
                        isWhiteSpaceOnlyJsxText(child);
                    if (lookInPreviousChild) {
                        // actual start of the node is past the position - previous token should be at the end of previous child
                        const candidate = findRightmostChildNodeWithTokens(children, /*exclusiveStartPosition*/ i);
                        return candidate && findRightmostToken(candidate, sourceFile);
                    }
                    else {
                        // candidate should be in this node
                        return find(child);
                    }
                }
            }
            ts.Debug.assert(startNode !== undefined || n.kind === ts.SyntaxKind.SourceFile || ts.isJSDocCommentContainingNode(n));
            // Here we know that none of child token nodes embrace the position,
            // the only known case is when position is at the end of the file.
            // Try to find the rightmost token in the file without filtering.
            // Namely we are skipping the check: 'position < node.end'
            if (children.length) {
                const candidate = findRightmostChildNodeWithTokens(children, /*exclusiveStartPosition*/ children.length);
                return candidate && findRightmostToken(candidate, sourceFile);
            }
        }
    }
    ts.findPrecedingToken = findPrecedingToken;
    function isNonWhitespaceToken(n) {
        return ts.isToken(n) && !isWhiteSpaceOnlyJsxText(n);
    }
    function findRightmostToken(n, sourceFile) {
        if (isNonWhitespaceToken(n)) {
            return n;
        }
        const children = n.getChildren(sourceFile);
        const candidate = findRightmostChildNodeWithTokens(children, /*exclusiveStartPosition*/ children.length);
        return candidate && findRightmostToken(candidate, sourceFile);
    }
    /**
     * Finds the rightmost child to the left of `children[exclusiveStartPosition]` which is a non-all-whitespace token or has constituent tokens.
     */
    function findRightmostChildNodeWithTokens(children, exclusiveStartPosition) {
        for (let i = exclusiveStartPosition - 1; i >= 0; i--) {
            const child = children[i];
            if (isWhiteSpaceOnlyJsxText(child)) {
                ts.Debug.assert(i > 0, "`JsxText` tokens should not be the first child of `JsxElement | JsxSelfClosingElement`");
            }
            else if (nodeHasTokens(children[i])) {
                return children[i];
            }
        }
    }
    function isInString(sourceFile, position, previousToken = findPrecedingToken(position, sourceFile)) {
        if (previousToken && ts.isStringTextContainingNode(previousToken)) {
            const start = previousToken.getStart();
            const end = previousToken.getEnd();
            // To be "in" one of these literals, the position has to be:
            //   1. entirely within the token text.
            //   2. at the end position of an unterminated token.
            //   3. at the end of a regular expression (due to trailing flags like '/foo/g').
            if (start < position && position < end) {
                return true;
            }
            if (position === end) {
                return !!previousToken.isUnterminated;
            }
        }
        return false;
    }
    ts.isInString = isInString;
    /**
     * returns true if the position is in between the open and close elements of an JSX expression.
     */
    function isInsideJsxElementOrAttribute(sourceFile, position) {
        const token = getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ false);
        if (!token) {
            return false;
        }
        if (token.kind === ts.SyntaxKind.JsxText) {
            return true;
        }
        // <div>Hello |</div>
        if (token.kind === ts.SyntaxKind.LessThanToken && token.parent.kind === ts.SyntaxKind.JsxText) {
            return true;
        }
        // <div> { | </div> or <div a={| </div>
        if (token.kind === ts.SyntaxKind.LessThanToken && token.parent.kind === ts.SyntaxKind.JsxExpression) {
            return true;
        }
        // <div> {
        // |
        // } < /div>
        if (token && token.kind === ts.SyntaxKind.CloseBraceToken && token.parent.kind === ts.SyntaxKind.JsxExpression) {
            return true;
        }
        // <div>|</div>
        if (token.kind === ts.SyntaxKind.LessThanToken && token.parent.kind === ts.SyntaxKind.JsxClosingElement) {
            return true;
        }
        return false;
    }
    ts.isInsideJsxElementOrAttribute = isInsideJsxElementOrAttribute;
    function isWhiteSpaceOnlyJsxText(node) {
        return ts.isJsxText(node) && node.containsOnlyWhiteSpaces;
    }
    function isInTemplateString(sourceFile, position) {
        const token = getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ false);
        return ts.isTemplateLiteralKind(token.kind) && position > token.getStart(sourceFile);
    }
    ts.isInTemplateString = isInTemplateString;
    function findPrecedingMatchingToken(token, matchingTokenKind, sourceFile) {
        const tokenKind = token.kind;
        let remainingMatchingTokens = 0;
        while (true) {
            token = findPrecedingToken(token.getFullStart(), sourceFile);
            if (!token) {
                return undefined;
            }
            if (token.kind === matchingTokenKind) {
                if (remainingMatchingTokens === 0) {
                    return token;
                }
                remainingMatchingTokens--;
            }
            else if (token.kind === tokenKind) {
                remainingMatchingTokens++;
            }
        }
    }
    ts.findPrecedingMatchingToken = findPrecedingMatchingToken;
    function isPossiblyTypeArgumentPosition(token, sourceFile) {
        // This function determines if the node could be type argument position
        // Since during editing, when type argument list is not complete,
        // the tree could be of any shape depending on the tokens parsed before current node,
        // scanning of the previous identifier followed by "<" before current node would give us better result
        // Note that we also balance out the already provided type arguments, arrays, object literals while doing so
        let remainingLessThanTokens = 0;
        while (token) {
            switch (token.kind) {
                case ts.SyntaxKind.LessThanToken:
                    // Found the beginning of the generic argument expression
                    token = findPrecedingToken(token.getFullStart(), sourceFile);
                    const tokenIsIdentifier = token && ts.isIdentifier(token);
                    if (!remainingLessThanTokens || !tokenIsIdentifier) {
                        return tokenIsIdentifier;
                    }
                    remainingLessThanTokens--;
                    break;
                case ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
                    remainingLessThanTokens = +3;
                    break;
                case ts.SyntaxKind.GreaterThanGreaterThanToken:
                    remainingLessThanTokens = +2;
                    break;
                case ts.SyntaxKind.GreaterThanToken:
                    remainingLessThanTokens++;
                    break;
                case ts.SyntaxKind.CloseBraceToken:
                    // This can be object type, skip untill we find the matching open brace token
                    // Skip untill the matching open brace token
                    token = findPrecedingMatchingToken(token, ts.SyntaxKind.OpenBraceToken, sourceFile);
                    if (!token)
                        return false;
                    break;
                case ts.SyntaxKind.CloseParenToken:
                    // This can be object type, skip untill we find the matching open brace token
                    // Skip untill the matching open brace token
                    token = findPrecedingMatchingToken(token, ts.SyntaxKind.OpenParenToken, sourceFile);
                    if (!token)
                        return false;
                    break;
                case ts.SyntaxKind.CloseBracketToken:
                    // This can be object type, skip untill we find the matching open brace token
                    // Skip untill the matching open brace token
                    token = findPrecedingMatchingToken(token, ts.SyntaxKind.OpenBracketToken, sourceFile);
                    if (!token)
                        return false;
                    break;
                // Valid tokens in a type name. Skip.
                case ts.SyntaxKind.CommaToken:
                case ts.SyntaxKind.EqualsGreaterThanToken:
                case ts.SyntaxKind.Identifier:
                case ts.SyntaxKind.StringLiteral:
                case ts.SyntaxKind.NumericLiteral:
                case ts.SyntaxKind.TrueKeyword:
                case ts.SyntaxKind.FalseKeyword:
                case ts.SyntaxKind.TypeOfKeyword:
                case ts.SyntaxKind.ExtendsKeyword:
                case ts.SyntaxKind.KeyOfKeyword:
                case ts.SyntaxKind.DotToken:
                case ts.SyntaxKind.BarToken:
                case ts.SyntaxKind.QuestionToken:
                case ts.SyntaxKind.ColonToken:
                    break;
                default:
                    if (ts.isTypeNode(token)) {
                        break;
                    }
                    // Invalid token in type
                    return false;
            }
            token = findPrecedingToken(token.getFullStart(), sourceFile);
        }
        return false;
    }
    ts.isPossiblyTypeArgumentPosition = isPossiblyTypeArgumentPosition;
    /**
     * Returns true if the cursor at position in sourceFile is within a comment.
     *
     * @param tokenAtPosition Must equal `getTokenAtPosition(sourceFile, position)
     * @param predicate Additional predicate to test on the comment range.
     */
    function isInComment(sourceFile, position, tokenAtPosition, predicate) {
        return !!ts.formatting.getRangeOfEnclosingComment(sourceFile, position, /*onlyMultiLine*/ false, /*precedingToken*/ undefined, tokenAtPosition, predicate);
    }
    ts.isInComment = isInComment;
    function hasDocComment(sourceFile, position) {
        const token = getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ false);
        // First, we have to see if this position actually landed in a comment.
        const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, token.pos);
        return ts.forEach(commentRanges, jsDocPrefix);
        function jsDocPrefix(c) {
            const text = sourceFile.text;
            return text.length >= c.pos + 3 && text[c.pos] === "/" && text[c.pos + 1] === "*" && text[c.pos + 2] === "*";
        }
    }
    ts.hasDocComment = hasDocComment;
    function nodeHasTokens(n) {
        // If we have a token or node that has a non-zero width, it must have tokens.
        // Note: getWidth() does not take trivia into account.
        return n.getWidth() !== 0;
    }
    function getNodeModifiers(node) {
        const flags = ts.getCombinedModifierFlags(node);
        const result = [];
        if (flags & ts.ModifierFlags.Private)
            result.push(ts.ScriptElementKindModifier.privateMemberModifier);
        if (flags & ts.ModifierFlags.Protected)
            result.push(ts.ScriptElementKindModifier.protectedMemberModifier);
        if (flags & ts.ModifierFlags.Public)
            result.push(ts.ScriptElementKindModifier.publicMemberModifier);
        if (flags & ts.ModifierFlags.Static)
            result.push(ts.ScriptElementKindModifier.staticModifier);
        if (flags & ts.ModifierFlags.Abstract)
            result.push(ts.ScriptElementKindModifier.abstractModifier);
        if (flags & ts.ModifierFlags.Export)
            result.push(ts.ScriptElementKindModifier.exportedModifier);
        if (node.flags & ts.NodeFlags.Ambient)
            result.push(ts.ScriptElementKindModifier.ambientModifier);
        return result.length > 0 ? result.join(",") : ts.ScriptElementKindModifier.none;
    }
    ts.getNodeModifiers = getNodeModifiers;
    function getTypeArgumentOrTypeParameterList(node) {
        if (node.kind === ts.SyntaxKind.TypeReference || node.kind === ts.SyntaxKind.CallExpression) {
            return node.typeArguments;
        }
        if (ts.isFunctionLike(node) || node.kind === ts.SyntaxKind.ClassDeclaration || node.kind === ts.SyntaxKind.InterfaceDeclaration) {
            return node.typeParameters;
        }
        return undefined;
    }
    ts.getTypeArgumentOrTypeParameterList = getTypeArgumentOrTypeParameterList;
    function isComment(kind) {
        return kind === ts.SyntaxKind.SingleLineCommentTrivia || kind === ts.SyntaxKind.MultiLineCommentTrivia;
    }
    ts.isComment = isComment;
    function isStringOrRegularExpressionOrTemplateLiteral(kind) {
        if (kind === ts.SyntaxKind.StringLiteral
            || kind === ts.SyntaxKind.RegularExpressionLiteral
            || ts.isTemplateLiteralKind(kind)) {
            return true;
        }
        return false;
    }
    ts.isStringOrRegularExpressionOrTemplateLiteral = isStringOrRegularExpressionOrTemplateLiteral;
    function isPunctuation(kind) {
        return ts.SyntaxKind.FirstPunctuation <= kind && kind <= ts.SyntaxKind.LastPunctuation;
    }
    ts.isPunctuation = isPunctuation;
    function isInsideTemplateLiteral(node, position) {
        return ts.isTemplateLiteralKind(node.kind)
            && (node.getStart() < position && position < node.getEnd()) || (!!node.isUnterminated && position === node.getEnd());
    }
    ts.isInsideTemplateLiteral = isInsideTemplateLiteral;
    function isAccessibilityModifier(kind) {
        switch (kind) {
            case ts.SyntaxKind.PublicKeyword:
            case ts.SyntaxKind.PrivateKeyword:
            case ts.SyntaxKind.ProtectedKeyword:
                return true;
        }
        return false;
    }
    ts.isAccessibilityModifier = isAccessibilityModifier;
    function cloneCompilerOptions(options) {
        const result = ts.clone(options);
        ts.setConfigFileInOptions(result, options && options.configFile);
        return result;
    }
    ts.cloneCompilerOptions = cloneCompilerOptions;
    function isArrayLiteralOrObjectLiteralDestructuringPattern(node) {
        if (node.kind === ts.SyntaxKind.ArrayLiteralExpression ||
            node.kind === ts.SyntaxKind.ObjectLiteralExpression) {
            // [a,b,c] from:
            // [a, b, c] = someExpression;
            if (node.parent.kind === ts.SyntaxKind.BinaryExpression &&
                node.parent.left === node &&
                node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                return true;
            }
            // [a, b, c] from:
            // for([a, b, c] of expression)
            if (node.parent.kind === ts.SyntaxKind.ForOfStatement &&
                node.parent.initializer === node) {
                return true;
            }
            // [a, b, c] of
            // [x, [a, b, c] ] = someExpression
            // or
            // {x, a: {a, b, c} } = someExpression
            if (isArrayLiteralOrObjectLiteralDestructuringPattern(node.parent.kind === ts.SyntaxKind.PropertyAssignment ? node.parent.parent : node.parent)) {
                return true;
            }
        }
        return false;
    }
    ts.isArrayLiteralOrObjectLiteralDestructuringPattern = isArrayLiteralOrObjectLiteralDestructuringPattern;
    function hasTrailingDirectorySeparator(path) {
        const lastCharacter = path.charAt(path.length - 1);
        return lastCharacter === "/" || lastCharacter === "\\";
    }
    ts.hasTrailingDirectorySeparator = hasTrailingDirectorySeparator;
    function isInReferenceComment(sourceFile, position) {
        return isInComment(sourceFile, position, /*tokenAtPosition*/ undefined, c => {
            const commentText = sourceFile.text.substring(c.pos, c.end);
            return tripleSlashDirectivePrefixRegex.test(commentText);
        });
    }
    ts.isInReferenceComment = isInReferenceComment;
    function isInNonReferenceComment(sourceFile, position) {
        return isInComment(sourceFile, position, /*tokenAtPosition*/ undefined, c => {
            const commentText = sourceFile.text.substring(c.pos, c.end);
            return !tripleSlashDirectivePrefixRegex.test(commentText);
        });
    }
    ts.isInNonReferenceComment = isInNonReferenceComment;
    function createTextSpanFromNode(node, sourceFile) {
        return ts.createTextSpanFromBounds(node.getStart(sourceFile), node.getEnd());
    }
    ts.createTextSpanFromNode = createTextSpanFromNode;
    function createTextSpanFromRange(range) {
        return ts.createTextSpanFromBounds(range.pos, range.end);
    }
    ts.createTextSpanFromRange = createTextSpanFromRange;
    function createTextChangeFromStartLength(start, length, newText) {
        return createTextChange(ts.createTextSpan(start, length), newText);
    }
    ts.createTextChangeFromStartLength = createTextChangeFromStartLength;
    function createTextChange(span, newText) {
        return { span, newText };
    }
    ts.createTextChange = createTextChange;
    ts.typeKeywords = [
        ts.SyntaxKind.AnyKeyword,
        ts.SyntaxKind.BooleanKeyword,
        ts.SyntaxKind.KeyOfKeyword,
        ts.SyntaxKind.NeverKeyword,
        ts.SyntaxKind.NullKeyword,
        ts.SyntaxKind.NumberKeyword,
        ts.SyntaxKind.ObjectKeyword,
        ts.SyntaxKind.StringKeyword,
        ts.SyntaxKind.SymbolKeyword,
        ts.SyntaxKind.VoidKeyword,
        ts.SyntaxKind.UndefinedKeyword,
        ts.SyntaxKind.UniqueKeyword,
    ];
    function isTypeKeyword(kind) {
        return ts.contains(ts.typeKeywords, kind);
    }
    ts.isTypeKeyword = isTypeKeyword;
    /** True if the symbol is for an external module, as opposed to a namespace. */
    function isExternalModuleSymbol(moduleSymbol) {
        ts.Debug.assert(!!(moduleSymbol.flags & ts.SymbolFlags.Module));
        return moduleSymbol.name.charCodeAt(0) === 34 /* doubleQuote */;
    }
    ts.isExternalModuleSymbol = isExternalModuleSymbol;
    /** Returns `true` the first time it encounters a node and `false` afterwards. */
    function nodeSeenTracker() {
        const seen = [];
        return node => {
            const id = ts.getNodeId(node);
            return !seen[id] && (seen[id] = true);
        };
    }
    ts.nodeSeenTracker = nodeSeenTracker;
    function getSnapshotText(snap) {
        return snap.getText(0, snap.getLength());
    }
    ts.getSnapshotText = getSnapshotText;
    function repeatString(str, count) {
        let result = "";
        for (let i = 0; i < count; i++) {
            result += str;
        }
        return result;
    }
    ts.repeatString = repeatString;
    function skipConstraint(type) {
        return type.isTypeParameter() ? type.getConstraint() : type;
    }
    ts.skipConstraint = skipConstraint;
    function getNameFromPropertyName(name) {
        return name.kind === ts.SyntaxKind.ComputedPropertyName
            // treat computed property names where expression is string/numeric literal as just string/numeric literal
            ? ts.isStringOrNumericLiteral(name.expression) ? name.expression.text : undefined
            : ts.getTextOfIdentifierOrLiteral(name);
    }
    ts.getNameFromPropertyName = getNameFromPropertyName;
    function programContainsEs6Modules(program) {
        return program.getSourceFiles().some(s => !s.isDeclarationFile && !program.isSourceFileFromExternalLibrary(s) && !!s.externalModuleIndicator);
    }
    ts.programContainsEs6Modules = programContainsEs6Modules;
    function compilerOptionsIndicateEs6Modules(compilerOptions) {
        return !!compilerOptions.module || compilerOptions.target >= ts.ScriptTarget.ES2015 || !!compilerOptions.noEmit;
    }
    ts.compilerOptionsIndicateEs6Modules = compilerOptionsIndicateEs6Modules;
    function hostUsesCaseSensitiveFileNames(host) {
        return host.useCaseSensitiveFileNames ? host.useCaseSensitiveFileNames() : false;
    }
    ts.hostUsesCaseSensitiveFileNames = hostUsesCaseSensitiveFileNames;
    function hostGetCanonicalFileName(host) {
        return ts.createGetCanonicalFileName(hostUsesCaseSensitiveFileNames(host));
    }
    ts.hostGetCanonicalFileName = hostGetCanonicalFileName;
})(ts || (ts = {}));
// Display-part writer helpers
/* @internal */
(function (ts) {
    function isFirstDeclarationOfSymbolParameter(symbol) {
        return symbol.declarations && symbol.declarations.length > 0 && symbol.declarations[0].kind === ts.SyntaxKind.Parameter;
    }
    ts.isFirstDeclarationOfSymbolParameter = isFirstDeclarationOfSymbolParameter;
    const displayPartWriter = getDisplayPartWriter();
    function getDisplayPartWriter() {
        let displayParts;
        let lineStart;
        let indent;
        resetWriter();
        const unknownWrite = (text) => writeKind(text, ts.SymbolDisplayPartKind.text);
        return {
            displayParts: () => displayParts,
            writeKeyword: text => writeKind(text, ts.SymbolDisplayPartKind.keyword),
            writeOperator: text => writeKind(text, ts.SymbolDisplayPartKind.operator),
            writePunctuation: text => writeKind(text, ts.SymbolDisplayPartKind.punctuation),
            writeSpace: text => writeKind(text, ts.SymbolDisplayPartKind.space),
            writeStringLiteral: text => writeKind(text, ts.SymbolDisplayPartKind.stringLiteral),
            writeParameter: text => writeKind(text, ts.SymbolDisplayPartKind.parameterName),
            writeProperty: text => writeKind(text, ts.SymbolDisplayPartKind.propertyName),
            writeLiteral: text => writeKind(text, ts.SymbolDisplayPartKind.stringLiteral),
            writeSymbol,
            writeLine,
            write: unknownWrite,
            writeTextOfNode: unknownWrite,
            getText: () => "",
            getTextPos: () => 0,
            getColumn: () => 0,
            getLine: () => 0,
            isAtStartOfLine: () => false,
            rawWrite: ts.notImplemented,
            getIndent: () => indent,
            increaseIndent: () => { indent++; },
            decreaseIndent: () => { indent--; },
            clear: resetWriter,
            trackSymbol: ts.noop,
            reportInaccessibleThisError: ts.noop,
            reportInaccessibleUniqueSymbolError: ts.noop,
            reportPrivateInBaseOfClassExpression: ts.noop,
        };
        function writeIndent() {
            if (lineStart) {
                const indentString = ts.getIndentString(indent);
                if (indentString) {
                    displayParts.push(displayPart(indentString, ts.SymbolDisplayPartKind.space));
                }
                lineStart = false;
            }
        }
        function writeKind(text, kind) {
            writeIndent();
            displayParts.push(displayPart(text, kind));
        }
        function writeSymbol(text, symbol) {
            writeIndent();
            displayParts.push(symbolPart(text, symbol));
        }
        function writeLine() {
            displayParts.push(lineBreakPart());
            lineStart = true;
        }
        function resetWriter() {
            displayParts = [];
            lineStart = true;
            indent = 0;
        }
    }
    function symbolPart(text, symbol) {
        return displayPart(text, displayPartKind(symbol));
        function displayPartKind(symbol) {
            const flags = symbol.flags;
            if (flags & ts.SymbolFlags.Variable) {
                return isFirstDeclarationOfSymbolParameter(symbol) ? ts.SymbolDisplayPartKind.parameterName : ts.SymbolDisplayPartKind.localName;
            }
            else if (flags & ts.SymbolFlags.Property) {
                return ts.SymbolDisplayPartKind.propertyName;
            }
            else if (flags & ts.SymbolFlags.GetAccessor) {
                return ts.SymbolDisplayPartKind.propertyName;
            }
            else if (flags & ts.SymbolFlags.SetAccessor) {
                return ts.SymbolDisplayPartKind.propertyName;
            }
            else if (flags & ts.SymbolFlags.EnumMember) {
                return ts.SymbolDisplayPartKind.enumMemberName;
            }
            else if (flags & ts.SymbolFlags.Function) {
                return ts.SymbolDisplayPartKind.functionName;
            }
            else if (flags & ts.SymbolFlags.Class) {
                return ts.SymbolDisplayPartKind.className;
            }
            else if (flags & ts.SymbolFlags.Interface) {
                return ts.SymbolDisplayPartKind.interfaceName;
            }
            else if (flags & ts.SymbolFlags.Enum) {
                return ts.SymbolDisplayPartKind.enumName;
            }
            else if (flags & ts.SymbolFlags.Module) {
                return ts.SymbolDisplayPartKind.moduleName;
            }
            else if (flags & ts.SymbolFlags.Method) {
                return ts.SymbolDisplayPartKind.methodName;
            }
            else if (flags & ts.SymbolFlags.TypeParameter) {
                return ts.SymbolDisplayPartKind.typeParameterName;
            }
            else if (flags & ts.SymbolFlags.TypeAlias) {
                return ts.SymbolDisplayPartKind.aliasName;
            }
            else if (flags & ts.SymbolFlags.Alias) {
                return ts.SymbolDisplayPartKind.aliasName;
            }
            return ts.SymbolDisplayPartKind.text;
        }
    }
    ts.symbolPart = symbolPart;
    function displayPart(text, kind) {
        return { text, kind: ts.SymbolDisplayPartKind[kind] };
    }
    ts.displayPart = displayPart;
    function spacePart() {
        return displayPart(" ", ts.SymbolDisplayPartKind.space);
    }
    ts.spacePart = spacePart;
    function keywordPart(kind) {
        return displayPart(ts.tokenToString(kind), ts.SymbolDisplayPartKind.keyword);
    }
    ts.keywordPart = keywordPart;
    function punctuationPart(kind) {
        return displayPart(ts.tokenToString(kind), ts.SymbolDisplayPartKind.punctuation);
    }
    ts.punctuationPart = punctuationPart;
    function operatorPart(kind) {
        return displayPart(ts.tokenToString(kind), ts.SymbolDisplayPartKind.operator);
    }
    ts.operatorPart = operatorPart;
    function textOrKeywordPart(text) {
        const kind = ts.stringToToken(text);
        return kind === undefined
            ? textPart(text)
            : keywordPart(kind);
    }
    ts.textOrKeywordPart = textOrKeywordPart;
    function textPart(text) {
        return displayPart(text, ts.SymbolDisplayPartKind.text);
    }
    ts.textPart = textPart;
    const carriageReturnLineFeed = "\r\n";
    /**
     * The default is CRLF.
     */
    function getNewLineOrDefaultFromHost(host, formatSettings) {
        return (formatSettings && formatSettings.newLineCharacter) ||
            (host.getNewLine && host.getNewLine()) ||
            carriageReturnLineFeed;
    }
    ts.getNewLineOrDefaultFromHost = getNewLineOrDefaultFromHost;
    function lineBreakPart() {
        return displayPart("\n", ts.SymbolDisplayPartKind.lineBreak);
    }
    ts.lineBreakPart = lineBreakPart;
    /* @internal */
    function mapToDisplayParts(writeDisplayParts) {
        try {
            writeDisplayParts(displayPartWriter);
            return displayPartWriter.displayParts();
        }
        finally {
            displayPartWriter.clear();
        }
    }
    ts.mapToDisplayParts = mapToDisplayParts;
    function typeToDisplayParts(typechecker, type, enclosingDeclaration, flags) {
        return mapToDisplayParts(writer => {
            typechecker.writeType(type, enclosingDeclaration, flags | ts.TypeFormatFlags.MultilineObjectLiterals, writer);
        });
    }
    ts.typeToDisplayParts = typeToDisplayParts;
    function symbolToDisplayParts(typeChecker, symbol, enclosingDeclaration, meaning, flags) {
        return mapToDisplayParts(writer => {
            typeChecker.writeSymbol(symbol, enclosingDeclaration, meaning, flags | ts.SymbolFormatFlags.UseAliasDefinedOutsideCurrentScope, writer);
        });
    }
    ts.symbolToDisplayParts = symbolToDisplayParts;
    function signatureToDisplayParts(typechecker, signature, enclosingDeclaration, flags) {
        flags |= ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope | ts.TypeFormatFlags.MultilineObjectLiterals | ts.TypeFormatFlags.WriteTypeArgumentsOfSignature | ts.TypeFormatFlags.OmitParameterModifiers;
        return mapToDisplayParts(writer => {
            typechecker.writeSignature(signature, enclosingDeclaration, flags, /*signatureKind*/ undefined, writer);
        });
    }
    ts.signatureToDisplayParts = signatureToDisplayParts;
    function isImportOrExportSpecifierName(location) {
        return location.parent &&
            (location.parent.kind === ts.SyntaxKind.ImportSpecifier || location.parent.kind === ts.SyntaxKind.ExportSpecifier) &&
            location.parent.propertyName === location;
    }
    ts.isImportOrExportSpecifierName = isImportOrExportSpecifierName;
    /**
     * Strip off existed single quotes or double quotes from a given string
     *
     * @return non-quoted string
     */
    function stripQuotes(name) {
        const length = name.length;
        if (length >= 2 && name.charCodeAt(0) === name.charCodeAt(length - 1) && startsWithQuote(name)) {
            return name.substring(1, length - 1);
        }
        return name;
    }
    ts.stripQuotes = stripQuotes;
    function startsWithQuote(name) {
        return ts.isSingleOrDoubleQuote(name.charCodeAt(0));
    }
    ts.startsWithQuote = startsWithQuote;
    function scriptKindIs(fileName, host, ...scriptKinds) {
        const scriptKind = getScriptKind(fileName, host);
        return ts.forEach(scriptKinds, k => k === scriptKind);
    }
    ts.scriptKindIs = scriptKindIs;
    function getScriptKind(fileName, host) {
        // First check to see if the script kind was specified by the host. Chances are the host
        // may override the default script kind for the file extension.
        return ts.ensureScriptKind(fileName, host && host.getScriptKind && host.getScriptKind(fileName));
    }
    ts.getScriptKind = getScriptKind;
    function getUniqueSymbolId(symbol, checker) {
        return ts.getSymbolId(ts.skipAlias(symbol, checker));
    }
    ts.getUniqueSymbolId = getUniqueSymbolId;
    function getFirstNonSpaceCharacterPosition(text, position) {
        while (ts.isWhiteSpaceLike(text.charCodeAt(position))) {
            position += 1;
        }
        return position;
    }
    ts.getFirstNonSpaceCharacterPosition = getFirstNonSpaceCharacterPosition;
    /**
     * Creates a deep, memberwise clone of a node with no source map location.
     *
     * WARNING: This is an expensive operation and is only intended to be used in refactorings
     * and code fixes (because those are triggered by explicit user actions).
     */
    function getSynthesizedDeepClone(node, includeTrivia = true) {
        const clone = node && getSynthesizedDeepCloneWorker(node);
        if (clone && !includeTrivia)
            suppressLeadingAndTrailingTrivia(clone);
        return clone;
    }
    ts.getSynthesizedDeepClone = getSynthesizedDeepClone;
    function getSynthesizedDeepCloneWorker(node) {
        const visited = ts.visitEachChild(node, getSynthesizedDeepClone, ts.nullTransformationContext);
        if (visited === node) {
            // This only happens for leaf nodes - internal nodes always see their children change.
            const clone = ts.getSynthesizedClone(node);
            if (ts.isStringLiteral(clone)) {
                clone.textSourceNode = node;
            }
            else if (ts.isNumericLiteral(clone)) {
                clone.numericLiteralFlags = node.numericLiteralFlags;
            }
            return ts.setTextRange(clone, node);
        }
        // PERF: As an optimization, rather than calling getSynthesizedClone, we'll update
        // the new node created by visitEachChild with the extra changes getSynthesizedClone
        // would have made.
        visited.parent = undefined;
        return visited;
    }
    function getSynthesizedDeepClones(nodes, includeTrivia = true) {
        return nodes && ts.createNodeArray(nodes.map(n => getSynthesizedDeepClone(n, includeTrivia)), nodes.hasTrailingComma);
    }
    ts.getSynthesizedDeepClones = getSynthesizedDeepClones;
    /**
     * Sets EmitFlags to suppress leading and trailing trivia on the node.
     */
    /* @internal */
    function suppressLeadingAndTrailingTrivia(node) {
        suppressLeadingTrivia(node);
        suppressTrailingTrivia(node);
    }
    ts.suppressLeadingAndTrailingTrivia = suppressLeadingAndTrailingTrivia;
    /**
     * Sets EmitFlags to suppress leading trivia on the node.
     */
    /* @internal */
    function suppressLeadingTrivia(node) {
        addEmitFlagsRecursively(node, ts.EmitFlags.NoLeadingComments, getFirstChild);
    }
    ts.suppressLeadingTrivia = suppressLeadingTrivia;
    /**
     * Sets EmitFlags to suppress trailing trivia on the node.
     */
    /* @internal */
    function suppressTrailingTrivia(node) {
        addEmitFlagsRecursively(node, ts.EmitFlags.NoTrailingComments, ts.getLastChild);
    }
    ts.suppressTrailingTrivia = suppressTrailingTrivia;
    function addEmitFlagsRecursively(node, flag, getChild) {
        ts.addEmitFlags(node, flag);
        const child = getChild(node);
        if (child)
            addEmitFlagsRecursively(child, flag, getChild);
    }
    function getFirstChild(node) {
        return node.forEachChild(child => child);
    }
    /* @internal */
    function getUniqueName(baseName, fileText) {
        let nameText = baseName;
        for (let i = 1; ts.stringContains(fileText, nameText); i++) {
            nameText = `${baseName}_${i}`;
        }
        return nameText;
    }
    ts.getUniqueName = getUniqueName;
    /**
     * @return The index of the (only) reference to the extracted symbol.  We want the cursor
     * to be on the reference, rather than the declaration, because it's closer to where the
     * user was before extracting it.
     */
    /* @internal */
    function getRenameLocation(edits, renameFilename, name, isDeclaredBeforeUse) {
        let delta = 0;
        let lastPos = -1;
        for (const { fileName, textChanges } of edits) {
            ts.Debug.assert(fileName === renameFilename);
            for (const change of textChanges) {
                const { span, newText } = change;
                const index = newText.indexOf(name);
                if (index !== -1) {
                    lastPos = span.start + delta + index;
                    // If the reference comes first, return immediately.
                    if (!isDeclaredBeforeUse) {
                        return lastPos;
                    }
                }
                delta += newText.length - span.length;
            }
        }
        // If the declaration comes first, return the position of the last occurrence.
        ts.Debug.assert(isDeclaredBeforeUse);
        ts.Debug.assert(lastPos >= 0);
        return lastPos;
    }
    ts.getRenameLocation = getRenameLocation;
})(ts || (ts = {}));
