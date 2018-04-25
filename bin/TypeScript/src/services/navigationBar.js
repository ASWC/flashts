/* @internal */
var ts;
(function (ts) {
    var NavigationBar;
    (function (NavigationBar) {
        /**
         * Matches all whitespace characters in a string. Eg:
         *
         * "app.
         *
         * onactivated"
         *
         * matches because of the newline, whereas
         *
         * "app.onactivated"
         *
         * does not match.
         */
        const whiteSpaceRegex = /\s+/g;
        // Keep sourceFile handy so we don't have to search for it every time we need to call `getText`.
        let curCancellationToken;
        let curSourceFile;
        /**
         * For performance, we keep navigation bar parents on a stack rather than passing them through each recursion.
         * `parent` is the current parent and is *not* stored in parentsStack.
         * `startNode` sets a new parent and `endNode` returns to the previous parent.
         */
        let parentsStack = [];
        let parent;
        // NavigationBarItem requires an array, but will not mutate it, so just give it this for performance.
        let emptyChildItemArray = [];
        function getNavigationBarItems(sourceFile, cancellationToken) {
            curCancellationToken = cancellationToken;
            curSourceFile = sourceFile;
            try {
                return ts.map(topLevelItems(rootNavigationBarNode(sourceFile)), convertToTopLevelItem);
            }
            finally {
                reset();
            }
        }
        NavigationBar.getNavigationBarItems = getNavigationBarItems;
        function getNavigationTree(sourceFile, cancellationToken) {
            curCancellationToken = cancellationToken;
            curSourceFile = sourceFile;
            try {
                return convertToTree(rootNavigationBarNode(sourceFile));
            }
            finally {
                reset();
            }
        }
        NavigationBar.getNavigationTree = getNavigationTree;
        function reset() {
            curSourceFile = undefined;
            curCancellationToken = undefined;
            parentsStack = [];
            parent = undefined;
            emptyChildItemArray = [];
        }
        function nodeText(node) {
            return node.getText(curSourceFile);
        }
        function navigationBarNodeKind(n) {
            return n.node.kind;
        }
        function pushChild(parent, child) {
            if (parent.children) {
                parent.children.push(child);
            }
            else {
                parent.children = [child];
            }
        }
        function rootNavigationBarNode(sourceFile) {
            ts.Debug.assert(!parentsStack.length);
            const root = { node: sourceFile, additionalNodes: undefined, parent: undefined, children: undefined, indent: 0 };
            parent = root;
            for (const statement of sourceFile.statements) {
                addChildrenRecursively(statement);
            }
            endNode();
            ts.Debug.assert(!parent && !parentsStack.length);
            return root;
        }
        function addLeafNode(node) {
            pushChild(parent, emptyNavigationBarNode(node));
        }
        function emptyNavigationBarNode(node) {
            return {
                node,
                additionalNodes: undefined,
                parent,
                children: undefined,
                indent: parent.indent + 1
            };
        }
        /**
         * Add a new level of NavigationBarNodes.
         * This pushes to the stack, so you must call `endNode` when you are done adding to this node.
         */
        function startNode(node) {
            const navNode = emptyNavigationBarNode(node);
            pushChild(parent, navNode);
            // Save the old parent
            parentsStack.push(parent);
            parent = navNode;
        }
        /** Call after calling `startNode` and adding children to it. */
        function endNode() {
            if (parent.children) {
                mergeChildren(parent.children);
                sortChildren(parent.children);
            }
            parent = parentsStack.pop();
        }
        function addNodeWithRecursiveChild(node, child) {
            startNode(node);
            addChildrenRecursively(child);
            endNode();
        }
        /** Look for navigation bar items in node's subtree, adding them to the current `parent`. */
        function addChildrenRecursively(node) {
            curCancellationToken.throwIfCancellationRequested();
            if (!node || ts.isToken(node)) {
                return;
            }
            switch (node.kind) {
                case ts.SyntaxKind.Constructor:
                    // Get parameter properties, and treat them as being on the *same* level as the constructor, not under it.
                    const ctr = node;
                    addNodeWithRecursiveChild(ctr, ctr.body);
                    // Parameter properties are children of the class, not the constructor.
                    for (const param of ctr.parameters) {
                        if (ts.isParameterPropertyDeclaration(param)) {
                            addLeafNode(param);
                        }
                    }
                    break;
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                case ts.SyntaxKind.MethodSignature:
                    if (!ts.hasDynamicName(node)) {
                        addNodeWithRecursiveChild(node, node.body);
                    }
                    break;
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                    if (!ts.hasDynamicName(node)) {
                        addLeafNode(node);
                    }
                    break;
                case ts.SyntaxKind.ImportClause:
                    const importClause = node;
                    // Handle default import case e.g.:
                    //    import d from "mod";
                    if (importClause.name) {
                        addLeafNode(importClause);
                    }
                    // Handle named bindings in imports e.g.:
                    //    import * as NS from "mod";
                    //    import {a, b as B} from "mod";
                    const { namedBindings } = importClause;
                    if (namedBindings) {
                        if (namedBindings.kind === ts.SyntaxKind.NamespaceImport) {
                            addLeafNode(namedBindings);
                        }
                        else {
                            for (const element of namedBindings.elements) {
                                addLeafNode(element);
                            }
                        }
                    }
                    break;
                case ts.SyntaxKind.BindingElement:
                case ts.SyntaxKind.VariableDeclaration:
                    const { name, initializer } = node;
                    if (ts.isBindingPattern(name)) {
                        addChildrenRecursively(name);
                    }
                    else if (initializer && isFunctionOrClassExpression(initializer)) {
                        if (initializer.name) {
                            // Don't add a node for the VariableDeclaration, just for the initializer.
                            addChildrenRecursively(initializer);
                        }
                        else {
                            // Add a node for the VariableDeclaration, but not for the initializer.
                            startNode(node);
                            ts.forEachChild(initializer, addChildrenRecursively);
                            endNode();
                        }
                    }
                    else {
                        addNodeWithRecursiveChild(node, initializer);
                    }
                    break;
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                    addNodeWithRecursiveChild(node, node.body);
                    break;
                case ts.SyntaxKind.EnumDeclaration:
                    startNode(node);
                    for (const member of node.members) {
                        if (!isComputedProperty(member)) {
                            addLeafNode(member);
                        }
                    }
                    endNode();
                    break;
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.InterfaceDeclaration:
                    startNode(node);
                    for (const member of node.members) {
                        addChildrenRecursively(member);
                    }
                    endNode();
                    break;
                case ts.SyntaxKind.ModuleDeclaration:
                    addNodeWithRecursiveChild(node, getInteriorModule(node).body);
                    break;
                case ts.SyntaxKind.ExportSpecifier:
                case ts.SyntaxKind.ImportEqualsDeclaration:
                case ts.SyntaxKind.IndexSignature:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.TypeAliasDeclaration:
                    addLeafNode(node);
                    break;
                case ts.SyntaxKind.BinaryExpression: {
                    const special = ts.getSpecialPropertyAssignmentKind(node);
                    switch (special) {
                        case 1 /* ExportsProperty */:
                        case 2 /* ModuleExports */:
                        case 3 /* PrototypeProperty */:
                        case 6 /* Prototype */:
                            addNodeWithRecursiveChild(node, node.right);
                            break;
                        case 4 /* ThisProperty */:
                        case 5 /* Property */:
                        case 0 /* None */:
                            break;
                        default:
                            ts.Debug.assertNever(special);
                    }
                }
                // falls through
                default:
                    if (ts.hasJSDocNodes(node)) {
                        ts.forEach(node.jsDoc, jsDoc => {
                            ts.forEach(jsDoc.tags, tag => {
                                if (tag.kind === ts.SyntaxKind.JSDocTypedefTag) {
                                    addLeafNode(tag);
                                }
                            });
                        });
                    }
                    ts.forEachChild(node, addChildrenRecursively);
            }
        }
        /** Merge declarations of the same kind. */
        function mergeChildren(children) {
            const nameToItems = ts.createMap();
            ts.filterMutate(children, child => {
                const declName = ts.getNameOfDeclaration(child.node);
                const name = declName && nodeText(declName);
                if (!name) {
                    // Anonymous items are never merged.
                    return true;
                }
                const itemsWithSameName = nameToItems.get(name);
                if (!itemsWithSameName) {
                    nameToItems.set(name, child);
                    return true;
                }
                if (itemsWithSameName instanceof Array) {
                    for (const itemWithSameName of itemsWithSameName) {
                        if (tryMerge(itemWithSameName, child)) {
                            return false;
                        }
                    }
                    itemsWithSameName.push(child);
                    return true;
                }
                else {
                    const itemWithSameName = itemsWithSameName;
                    if (tryMerge(itemWithSameName, child)) {
                        return false;
                    }
                    nameToItems.set(name, [itemWithSameName, child]);
                    return true;
                }
            });
        }
        function tryMerge(a, b) {
            if (shouldReallyMerge(a.node, b.node)) {
                merge(a, b);
                return true;
            }
            return false;
        }
        /** a and b have the same name, but they may not be mergeable. */
        function shouldReallyMerge(a, b) {
            if (a.kind !== b.kind) {
                return false;
            }
            switch (a.kind) {
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                    return ts.hasModifier(a, ts.ModifierFlags.Static) === ts.hasModifier(b, ts.ModifierFlags.Static);
                case ts.SyntaxKind.ModuleDeclaration:
                    return areSameModule(a, b);
                default:
                    return true;
            }
        }
        // We use 1 NavNode to represent 'A.B.C', but there are multiple source nodes.
        // Only merge module nodes that have the same chain. Don't merge 'A.B.C' with 'A'!
        function areSameModule(a, b) {
            return a.body.kind === b.body.kind && (a.body.kind !== ts.SyntaxKind.ModuleDeclaration || areSameModule(a.body, b.body));
        }
        /** Merge source into target. Source should be thrown away after this is called. */
        function merge(target, source) {
            target.additionalNodes = target.additionalNodes || [];
            target.additionalNodes.push(source.node);
            if (source.additionalNodes) {
                target.additionalNodes.push(...source.additionalNodes);
            }
            target.children = ts.concatenate(target.children, source.children);
            if (target.children) {
                mergeChildren(target.children);
                sortChildren(target.children);
            }
        }
        /** Recursively ensure that each NavNode's children are in sorted order. */
        function sortChildren(children) {
            children.sort(compareChildren);
        }
        function compareChildren(child1, child2) {
            return ts.compareStringsCaseSensitiveUI(tryGetName(child1.node), tryGetName(child2.node))
                || ts.compareValues(navigationBarNodeKind(child1), navigationBarNodeKind(child2));
        }
        /**
         * This differs from getItemName because this is just used for sorting.
         * We only sort nodes by name that have a more-or-less "direct" name, as opposed to `new()` and the like.
         * So `new()` can still come before an `aardvark` method.
         */
        function tryGetName(node) {
            if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
                return getModuleName(node);
            }
            const declName = ts.getNameOfDeclaration(node);
            if (declName) {
                return ts.unescapeLeadingUnderscores(ts.getPropertyNameForPropertyNameNode(declName));
            }
            switch (node.kind) {
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.ClassExpression:
                    return getFunctionOrClassName(node);
                case ts.SyntaxKind.JSDocTypedefTag:
                    return getJSDocTypedefTagName(node);
                default:
                    return undefined;
            }
        }
        function getItemName(node) {
            if (node.kind === ts.SyntaxKind.ModuleDeclaration) {
                return getModuleName(node);
            }
            const name = ts.getNameOfDeclaration(node);
            if (name) {
                const text = nodeText(name);
                if (text.length > 0) {
                    return text;
                }
            }
            switch (node.kind) {
                case ts.SyntaxKind.SourceFile:
                    const sourceFile = node;
                    return ts.isExternalModule(sourceFile)
                        ? `"${ts.escapeString(ts.getBaseFileName(ts.removeFileExtension(ts.normalizePath(sourceFile.fileName))))}"`
                        : "<global>";
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                    if (ts.getModifierFlags(node) & ts.ModifierFlags.Default) {
                        return "default";
                    }
                    // We may get a string with newlines or other whitespace in the case of an object dereference
                    // (eg: "app\n.onactivated"), so we should remove the whitespace for readabiltiy in the
                    // navigation bar.
                    return getFunctionOrClassName(node);
                case ts.SyntaxKind.Constructor:
                    return "constructor";
                case ts.SyntaxKind.ConstructSignature:
                    return "new()";
                case ts.SyntaxKind.CallSignature:
                    return "()";
                case ts.SyntaxKind.IndexSignature:
                    return "[]";
                case ts.SyntaxKind.JSDocTypedefTag:
                    return getJSDocTypedefTagName(node);
                default:
                    return "<unknown>";
            }
        }
        function getJSDocTypedefTagName(node) {
            if (node.name) {
                return node.name.text;
            }
            else {
                const parentNode = node.parent && node.parent.parent;
                if (parentNode && parentNode.kind === ts.SyntaxKind.VariableStatement) {
                    if (parentNode.declarationList.declarations.length > 0) {
                        const nameIdentifier = parentNode.declarationList.declarations[0].name;
                        if (nameIdentifier.kind === ts.SyntaxKind.Identifier) {
                            return nameIdentifier.text;
                        }
                    }
                }
                return "<typedef>";
            }
        }
        /** Flattens the NavNode tree to a list, keeping only the top-level items. */
        function topLevelItems(root) {
            const topLevel = [];
            function recur(item) {
                if (isTopLevel(item)) {
                    topLevel.push(item);
                    if (item.children) {
                        for (const child of item.children) {
                            recur(child);
                        }
                    }
                }
            }
            recur(root);
            return topLevel;
            function isTopLevel(item) {
                switch (navigationBarNodeKind(item)) {
                    case ts.SyntaxKind.ClassDeclaration:
                    case ts.SyntaxKind.ClassExpression:
                    case ts.SyntaxKind.EnumDeclaration:
                    case ts.SyntaxKind.InterfaceDeclaration:
                    case ts.SyntaxKind.ModuleDeclaration:
                    case ts.SyntaxKind.SourceFile:
                    case ts.SyntaxKind.TypeAliasDeclaration:
                    case ts.SyntaxKind.JSDocTypedefTag:
                        return true;
                    case ts.SyntaxKind.Constructor:
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.GetAccessor:
                    case ts.SyntaxKind.SetAccessor:
                    case ts.SyntaxKind.VariableDeclaration:
                        return hasSomeImportantChild(item);
                    case ts.SyntaxKind.ArrowFunction:
                    case ts.SyntaxKind.FunctionDeclaration:
                    case ts.SyntaxKind.FunctionExpression:
                        return isTopLevelFunctionDeclaration(item);
                    default:
                        return false;
                }
                function isTopLevelFunctionDeclaration(item) {
                    if (!item.node.body) {
                        return false;
                    }
                    switch (navigationBarNodeKind(item.parent)) {
                        case ts.SyntaxKind.ModuleBlock:
                        case ts.SyntaxKind.SourceFile:
                        case ts.SyntaxKind.MethodDeclaration:
                        case ts.SyntaxKind.Constructor:
                            return true;
                        default:
                            return hasSomeImportantChild(item);
                    }
                }
                function hasSomeImportantChild(item) {
                    return ts.forEach(item.children, child => {
                        const childKind = navigationBarNodeKind(child);
                        return childKind !== ts.SyntaxKind.VariableDeclaration && childKind !== ts.SyntaxKind.BindingElement;
                    });
                }
            }
        }
        function convertToTree(n) {
            return {
                text: getItemName(n.node),
                kind: ts.getNodeKind(n.node),
                kindModifiers: getModifiers(n.node),
                spans: getSpans(n),
                childItems: ts.map(n.children, convertToTree)
            };
        }
        function convertToTopLevelItem(n) {
            return {
                text: getItemName(n.node),
                kind: ts.getNodeKind(n.node),
                kindModifiers: getModifiers(n.node),
                spans: getSpans(n),
                childItems: ts.map(n.children, convertToChildItem) || emptyChildItemArray,
                indent: n.indent,
                bolded: false,
                grayed: false
            };
            function convertToChildItem(n) {
                return {
                    text: getItemName(n.node),
                    kind: ts.getNodeKind(n.node),
                    kindModifiers: ts.getNodeModifiers(n.node),
                    spans: getSpans(n),
                    childItems: emptyChildItemArray,
                    indent: 0,
                    bolded: false,
                    grayed: false
                };
            }
        }
        function getSpans(n) {
            const spans = [getNodeSpan(n.node)];
            if (n.additionalNodes) {
                for (const node of n.additionalNodes) {
                    spans.push(getNodeSpan(node));
                }
            }
            return spans;
        }
        function getModuleName(moduleDeclaration) {
            // We want to maintain quotation marks.
            if (ts.isAmbientModule(moduleDeclaration)) {
                return ts.getTextOfNode(moduleDeclaration.name);
            }
            // Otherwise, we need to aggregate each identifier to build up the qualified name.
            const result = [];
            result.push(ts.getTextOfIdentifierOrLiteral(moduleDeclaration.name));
            while (moduleDeclaration.body && moduleDeclaration.body.kind === ts.SyntaxKind.ModuleDeclaration) {
                moduleDeclaration = moduleDeclaration.body;
                result.push(ts.getTextOfIdentifierOrLiteral(moduleDeclaration.name));
            }
            return result.join(".");
        }
        /**
         * For 'module A.B.C', we want to get the node for 'C'.
         * We store 'A' as associated with a NavNode, and use getModuleName to traverse down again.
         */
        function getInteriorModule(decl) {
            return decl.body.kind === ts.SyntaxKind.ModuleDeclaration ? getInteriorModule(decl.body) : decl;
        }
        function isComputedProperty(member) {
            return !member.name || member.name.kind === ts.SyntaxKind.ComputedPropertyName;
        }
        function getNodeSpan(node) {
            return node.kind === ts.SyntaxKind.SourceFile ? ts.createTextSpanFromRange(node) : ts.createTextSpanFromNode(node, curSourceFile);
        }
        function getModifiers(node) {
            if (node.parent && node.parent.kind === ts.SyntaxKind.VariableDeclaration) {
                node = node.parent;
            }
            return ts.getNodeModifiers(node);
        }
        function getFunctionOrClassName(node) {
            if (node.name && ts.getFullWidth(node.name) > 0) {
                return ts.declarationNameToString(node.name);
            }
            // See if it is a var initializer. If so, use the var name.
            else if (node.parent.kind === ts.SyntaxKind.VariableDeclaration) {
                return ts.declarationNameToString(node.parent.name);
            }
            // See if it is of the form "<expr> = function(){...}". If so, use the text from the left-hand side.
            else if (node.parent.kind === ts.SyntaxKind.BinaryExpression &&
                node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
                return nodeText(node.parent.left).replace(whiteSpaceRegex, "");
            }
            // See if it is a property assignment, and if so use the property name
            else if (node.parent.kind === ts.SyntaxKind.PropertyAssignment && node.parent.name) {
                return nodeText(node.parent.name);
            }
            // Default exports are named "default"
            else if (ts.getModifierFlags(node) & ts.ModifierFlags.Default) {
                return "default";
            }
            else {
                return ts.isClassLike(node) ? "<class>" : "<function>";
            }
        }
        function isFunctionOrClassExpression(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ClassExpression:
                    return true;
                default:
                    return false;
            }
        }
    })(NavigationBar = ts.NavigationBar || (ts.NavigationBar = {}));
})(ts || (ts = {}));
