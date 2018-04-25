/* @internal */
var ts;
(function (ts) {
    var JsDoc;
    (function (JsDoc) {
        const jsDocTagNames = [
            "augments",
            "author",
            "argument",
            "borrows",
            "class",
            "constant",
            "constructor",
            "constructs",
            "default",
            "deprecated",
            "description",
            "event",
            "example",
            "extends",
            "field",
            "fileOverview",
            "function",
            "ignore",
            "inheritDoc",
            "inner",
            "lends",
            "link",
            "memberOf",
            "method",
            "name",
            "namespace",
            "param",
            "private",
            "prop",
            "property",
            "public",
            "requires",
            "returns",
            "see",
            "since",
            "static",
            "template",
            "throws",
            "type",
            "typedef",
            "version"
        ];
        let jsDocTagNameCompletionEntries;
        let jsDocTagCompletionEntries;
        function getJsDocCommentsFromDeclarations(declarations) {
            // Only collect doc comments from duplicate declarations once:
            // In case of a union property there might be same declaration multiple times
            // which only varies in type parameter
            // Eg. const a: Array<string> | Array<number>; a.length
            // The property length will have two declarations of property length coming
            // from Array<T> - Array<string> and Array<number>
            const documentationComment = [];
            forEachUnique(declarations, declaration => {
                for (const { comment } of getCommentHavingNodes(declaration)) {
                    if (comment === undefined)
                        continue;
                    if (documentationComment.length) {
                        documentationComment.push(ts.lineBreakPart());
                    }
                    documentationComment.push(ts.textPart(comment));
                }
            });
            return documentationComment;
        }
        JsDoc.getJsDocCommentsFromDeclarations = getJsDocCommentsFromDeclarations;
        function getCommentHavingNodes(declaration) {
            switch (declaration.kind) {
                case ts.SyntaxKind.JSDocPropertyTag:
                    return [declaration];
                case ts.SyntaxKind.JSDocTypedefTag:
                    return [declaration.parent];
                default:
                    return ts.getJSDocCommentsAndTags(declaration);
            }
        }
        function getJsDocTagsFromDeclarations(declarations) {
            // Only collect doc comments from duplicate declarations once.
            const tags = [];
            forEachUnique(declarations, declaration => {
                for (const tag of ts.getJSDocTags(declaration)) {
                    tags.push({ name: tag.tagName.text, text: getCommentText(tag) });
                }
            });
            return tags;
        }
        JsDoc.getJsDocTagsFromDeclarations = getJsDocTagsFromDeclarations;
        function getCommentText(tag) {
            const { comment } = tag;
            switch (tag.kind) {
                case ts.SyntaxKind.JSDocAugmentsTag:
                    return withNode(tag.class);
                case ts.SyntaxKind.JSDocTemplateTag:
                    return withList(tag.typeParameters);
                case ts.SyntaxKind.JSDocTypeTag:
                    return withNode(tag.typeExpression);
                case ts.SyntaxKind.JSDocTypedefTag:
                case ts.SyntaxKind.JSDocPropertyTag:
                case ts.SyntaxKind.JSDocParameterTag:
                    const { name } = tag;
                    return name ? withNode(name) : comment;
                default:
                    return comment;
            }
            function withNode(node) {
                return addComment(node.getText());
            }
            function withList(list) {
                return addComment(list.map(x => x.getText()).join(", "));
            }
            function addComment(s) {
                return comment === undefined ? s : `${s} ${comment}`;
            }
        }
        /**
         * Iterates through 'array' by index and performs the callback on each element of array until the callback
         * returns a truthy value, then returns that value.
         * If no such value is found, the callback is applied to each element of array and undefined is returned.
         */
        function forEachUnique(array, callback) {
            if (array) {
                for (let i = 0; i < array.length; i++) {
                    if (array.indexOf(array[i]) === i) {
                        const result = callback(array[i], i);
                        if (result) {
                            return result;
                        }
                    }
                }
            }
            return undefined;
        }
        function getJSDocTagNameCompletions() {
            return jsDocTagNameCompletionEntries || (jsDocTagNameCompletionEntries = ts.map(jsDocTagNames, tagName => {
                return {
                    name: tagName,
                    kind: ts.ScriptElementKind.keyword,
                    kindModifiers: "",
                    sortText: "0",
                };
            }));
        }
        JsDoc.getJSDocTagNameCompletions = getJSDocTagNameCompletions;
        JsDoc.getJSDocTagNameCompletionDetails = getJSDocTagCompletionDetails;
        function getJSDocTagCompletions() {
            return jsDocTagCompletionEntries || (jsDocTagCompletionEntries = ts.map(jsDocTagNames, tagName => {
                return {
                    name: `@${tagName}`,
                    kind: ts.ScriptElementKind.keyword,
                    kindModifiers: "",
                    sortText: "0"
                };
            }));
        }
        JsDoc.getJSDocTagCompletions = getJSDocTagCompletions;
        function getJSDocTagCompletionDetails(name) {
            return {
                name,
                kind: ts.ScriptElementKind.unknown,
                kindModifiers: "",
                displayParts: [ts.textPart(name)],
                documentation: ts.emptyArray,
                tags: ts.emptyArray,
                codeActions: undefined,
            };
        }
        JsDoc.getJSDocTagCompletionDetails = getJSDocTagCompletionDetails;
        function getJSDocParameterNameCompletions(tag) {
            if (!ts.isIdentifier(tag.name)) {
                return ts.emptyArray;
            }
            const nameThusFar = tag.name.text;
            const jsdoc = tag.parent;
            const fn = jsdoc.parent;
            if (!ts.isFunctionLike(fn))
                return [];
            return ts.mapDefined(fn.parameters, param => {
                if (!ts.isIdentifier(param.name))
                    return undefined;
                const name = param.name.text;
                if (jsdoc.tags.some(t => t !== tag && ts.isJSDocParameterTag(t) && ts.isIdentifier(t.name) && t.name.escapedText === name)
                    || nameThusFar !== undefined && !ts.startsWith(name, nameThusFar)) {
                    return undefined;
                }
                return { name, kind: ts.ScriptElementKind.parameterElement, kindModifiers: "", sortText: "0" };
            });
        }
        JsDoc.getJSDocParameterNameCompletions = getJSDocParameterNameCompletions;
        function getJSDocParameterNameCompletionDetails(name) {
            return {
                name,
                kind: ts.ScriptElementKind.parameterElement,
                kindModifiers: "",
                displayParts: [ts.textPart(name)],
                documentation: ts.emptyArray,
                tags: ts.emptyArray,
                codeActions: undefined,
            };
        }
        JsDoc.getJSDocParameterNameCompletionDetails = getJSDocParameterNameCompletionDetails;
        /**
         * Checks if position points to a valid position to add JSDoc comments, and if so,
         * returns the appropriate template. Otherwise returns an empty string.
         * Valid positions are
         *      - outside of comments, statements, and expressions, and
         *      - preceding a:
         *          - function/constructor/method declaration
         *          - class declarations
         *          - variable statements
         *          - namespace declarations
         *          - interface declarations
         *          - method signatures
         *          - type alias declarations
         *
         * Hosts should ideally check that:
         * - The line is all whitespace up to 'position' before performing the insertion.
         * - If the keystroke sequence "/\*\*" induced the call, we also check that the next
         * non-whitespace character is '*', which (approximately) indicates whether we added
         * the second '*' to complete an existing (JSDoc) comment.
         * @param fileName The file in which to perform the check.
         * @param position The (character-indexed) position in the file where the check should
         * be performed.
         */
        function getDocCommentTemplateAtPosition(newLine, sourceFile, position) {
            // Check if in a context where we don't want to perform any insertion
            if (ts.isInString(sourceFile, position) || ts.isInComment(sourceFile, position) || ts.hasDocComment(sourceFile, position)) {
                return undefined;
            }
            const tokenAtPos = ts.getTokenAtPosition(sourceFile, position, /*includeJsDocComment*/ false);
            const tokenStart = tokenAtPos.getStart();
            if (!tokenAtPos || tokenStart < position) {
                return undefined;
            }
            const commentOwnerInfo = getCommentOwnerInfo(tokenAtPos);
            if (!commentOwnerInfo) {
                return undefined;
            }
            const { commentOwner, parameters } = commentOwnerInfo;
            if (commentOwner.getStart() < position) {
                return undefined;
            }
            if (!parameters || parameters.length === 0) {
                // if there are no parameters, just complete to a single line JSDoc comment
                const singleLineResult = "/** */";
                return { newText: singleLineResult, caretOffset: 3 };
            }
            const posLineAndChar = sourceFile.getLineAndCharacterOfPosition(position);
            const lineStart = sourceFile.getLineStarts()[posLineAndChar.line];
            // replace non-whitespace characters in prefix with spaces.
            const indentationStr = sourceFile.text.substr(lineStart, posLineAndChar.character).replace(/\S/i, () => " ");
            const isJavaScriptFile = ts.hasJavaScriptFileExtension(sourceFile.fileName);
            let docParams = "";
            for (let i = 0; i < parameters.length; i++) {
                const currentName = parameters[i].name;
                const paramName = currentName.kind === ts.SyntaxKind.Identifier ? currentName.escapedText : "param" + i;
                if (isJavaScriptFile) {
                    docParams += `${indentationStr} * @param {any} ${paramName}${newLine}`;
                }
                else {
                    docParams += `${indentationStr} * @param ${paramName}${newLine}`;
                }
            }
            // A doc comment consists of the following
            // * The opening comment line
            // * the first line (without a param) for the object's untagged info (this is also where the caret ends up)
            // * the '@param'-tagged lines
            // * TODO: other tags.
            // * the closing comment line
            // * if the caret was directly in front of the object, then we add an extra line and indentation.
            const preamble = "/**" + newLine +
                indentationStr + " * ";
            const result = preamble + newLine +
                docParams +
                indentationStr + " */" +
                (tokenStart === position ? newLine + indentationStr : "");
            return { newText: result, caretOffset: preamble.length };
        }
        JsDoc.getDocCommentTemplateAtPosition = getDocCommentTemplateAtPosition;
        function getCommentOwnerInfo(tokenAtPos) {
            for (let commentOwner = tokenAtPos; commentOwner; commentOwner = commentOwner.parent) {
                switch (commentOwner.kind) {
                    case ts.SyntaxKind.FunctionDeclaration:
                    case ts.SyntaxKind.MethodDeclaration:
                    case ts.SyntaxKind.Constructor:
                    case ts.SyntaxKind.MethodSignature:
                        const { parameters } = commentOwner;
                        return { commentOwner, parameters };
                    case ts.SyntaxKind.ClassDeclaration:
                    case ts.SyntaxKind.InterfaceDeclaration:
                    case ts.SyntaxKind.PropertySignature:
                    case ts.SyntaxKind.EnumDeclaration:
                    case ts.SyntaxKind.EnumMember:
                    case ts.SyntaxKind.TypeAliasDeclaration:
                        return { commentOwner };
                    case ts.SyntaxKind.VariableStatement: {
                        const varStatement = commentOwner;
                        const varDeclarations = varStatement.declarationList.declarations;
                        const parameters = varDeclarations.length === 1 && varDeclarations[0].initializer
                            ? getParametersFromRightHandSideOfAssignment(varDeclarations[0].initializer)
                            : undefined;
                        return { commentOwner, parameters };
                    }
                    case ts.SyntaxKind.SourceFile:
                        return undefined;
                    case ts.SyntaxKind.ModuleDeclaration:
                        // If in walking up the tree, we hit a a nested namespace declaration,
                        // then we must be somewhere within a dotted namespace name; however we don't
                        // want to give back a JSDoc template for the 'b' or 'c' in 'namespace a.b.c { }'.
                        return commentOwner.parent.kind === ts.SyntaxKind.ModuleDeclaration ? undefined : { commentOwner };
                    case ts.SyntaxKind.BinaryExpression: {
                        const be = commentOwner;
                        if (ts.getSpecialPropertyAssignmentKind(be) === 0 /* None */) {
                            return undefined;
                        }
                        const parameters = ts.isFunctionLike(be.right) ? be.right.parameters : ts.emptyArray;
                        return { commentOwner, parameters };
                    }
                }
            }
        }
        /**
         * Digs into an an initializer or RHS operand of an assignment operation
         * to get the parameters of an apt signature corresponding to a
         * function expression or a class expression.
         *
         * @param rightHandSide the expression which may contain an appropriate set of parameters
         * @returns the parameters of a signature found on the RHS if one exists; otherwise 'emptyArray'.
         */
        function getParametersFromRightHandSideOfAssignment(rightHandSide) {
            while (rightHandSide.kind === ts.SyntaxKind.ParenthesizedExpression) {
                rightHandSide = rightHandSide.expression;
            }
            switch (rightHandSide.kind) {
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                    return rightHandSide.parameters;
                case ts.SyntaxKind.ClassExpression: {
                    const ctr = ts.find(rightHandSide.members, ts.isConstructorDeclaration);
                    return ctr && ctr.parameters;
                }
            }
            return ts.emptyArray;
        }
    })(JsDoc = ts.JsDoc || (ts.JsDoc = {}));
})(ts || (ts = {}));
