/* @internal */
var ts;
(function (ts) {
    var formatting;
    (function (formatting) {
        function getAllRules() {
            const allTokens = [];
            for (let token = ts.SyntaxKind.FirstToken; token <= ts.SyntaxKind.LastToken; token++) {
                allTokens.push(token);
            }
            function anyTokenExcept(...tokens) {
                return { tokens: allTokens.filter(t => !tokens.some(t2 => t2 === t)), isSpecific: false };
            }
            const anyToken = { tokens: allTokens, isSpecific: false };
            const anyTokenIncludingMultilineComments = tokenRangeFrom([...allTokens, ts.SyntaxKind.MultiLineCommentTrivia]);
            const keywords = tokenRangeFromRange(ts.SyntaxKind.FirstKeyword, ts.SyntaxKind.LastKeyword);
            const binaryOperators = tokenRangeFromRange(ts.SyntaxKind.FirstBinaryOperator, ts.SyntaxKind.LastBinaryOperator);
            const binaryKeywordOperators = [ts.SyntaxKind.InKeyword, ts.SyntaxKind.InstanceOfKeyword, ts.SyntaxKind.OfKeyword, ts.SyntaxKind.AsKeyword, ts.SyntaxKind.IsKeyword];
            const unaryPrefixOperators = [ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.MinusMinusToken, ts.SyntaxKind.TildeToken, ts.SyntaxKind.ExclamationToken];
            const unaryPrefixExpressions = [
                ts.SyntaxKind.NumericLiteral, ts.SyntaxKind.Identifier, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.OpenBracketToken,
                ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.ThisKeyword, ts.SyntaxKind.NewKeyword
            ];
            const unaryPreincrementExpressions = [ts.SyntaxKind.Identifier, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.ThisKeyword, ts.SyntaxKind.NewKeyword];
            const unaryPostincrementExpressions = [ts.SyntaxKind.Identifier, ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.CloseBracketToken, ts.SyntaxKind.NewKeyword];
            const unaryPredecrementExpressions = [ts.SyntaxKind.Identifier, ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.ThisKeyword, ts.SyntaxKind.NewKeyword];
            const unaryPostdecrementExpressions = [ts.SyntaxKind.Identifier, ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.CloseBracketToken, ts.SyntaxKind.NewKeyword];
            const comments = [ts.SyntaxKind.SingleLineCommentTrivia, ts.SyntaxKind.MultiLineCommentTrivia];
            const typeNames = [ts.SyntaxKind.Identifier, ...ts.typeKeywords];
            // Place a space before open brace in a function declaration
            // TypeScript: Function can have return types, which can be made of tons of different token kinds
            const functionOpenBraceLeftTokenRange = anyTokenIncludingMultilineComments;
            // Place a space before open brace in a TypeScript declaration that has braces as children (class, module, enum, etc)
            const typeScriptOpenBraceLeftTokenRange = tokenRangeFrom([ts.SyntaxKind.Identifier, ts.SyntaxKind.MultiLineCommentTrivia, ts.SyntaxKind.ClassKeyword, ts.SyntaxKind.ExportKeyword, ts.SyntaxKind.ImportKeyword]);
            // Place a space before open brace in a control flow construct
            const controlOpenBraceLeftTokenRange = tokenRangeFrom([ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.MultiLineCommentTrivia, ts.SyntaxKind.DoKeyword, ts.SyntaxKind.TryKeyword, ts.SyntaxKind.FinallyKeyword, ts.SyntaxKind.ElseKeyword]);
            // These rules are higher in priority than user-configurable
            const highPriorityCommonRules = [
                // Leave comments alone
                rule("IgnoreBeforeComment", anyToken, comments, formatting.anyContext, 1 /* Ignore */),
                rule("IgnoreAfterLineComment", ts.SyntaxKind.SingleLineCommentTrivia, anyToken, formatting.anyContext, 1 /* Ignore */),
                rule("NotSpaceBeforeColon", anyToken, ts.SyntaxKind.ColonToken, [isNonJsxSameLineTokenContext, isNotBinaryOpContext, isNotTypeAnnotationContext], 8 /* Delete */),
                rule("SpaceAfterColon", ts.SyntaxKind.ColonToken, anyToken, [isNonJsxSameLineTokenContext, isNotBinaryOpContext], 2 /* Space */),
                rule("NoSpaceBeforeQuestionMark", anyToken, ts.SyntaxKind.QuestionToken, [isNonJsxSameLineTokenContext, isNotBinaryOpContext], 8 /* Delete */),
                // insert space after '?' only when it is used in conditional operator
                rule("SpaceAfterQuestionMarkInConditionalOperator", ts.SyntaxKind.QuestionToken, anyToken, [isNonJsxSameLineTokenContext, isConditionalOperatorContext], 2 /* Space */),
                // in other cases there should be no space between '?' and next token
                rule("NoSpaceAfterQuestionMark", ts.SyntaxKind.QuestionToken, anyToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeDot", anyToken, ts.SyntaxKind.DotToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceAfterDot", ts.SyntaxKind.DotToken, anyToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                // Special handling of unary operators.
                // Prefix operators generally shouldn't have a space between
                // them and their target unary expression.
                rule("NoSpaceAfterUnaryPrefixOperator", unaryPrefixOperators, unaryPrefixExpressions, [isNonJsxSameLineTokenContext, isNotBinaryOpContext], 8 /* Delete */),
                rule("NoSpaceAfterUnaryPreincrementOperator", ts.SyntaxKind.PlusPlusToken, unaryPreincrementExpressions, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceAfterUnaryPredecrementOperator", ts.SyntaxKind.MinusMinusToken, unaryPredecrementExpressions, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeUnaryPostincrementOperator", unaryPostincrementExpressions, ts.SyntaxKind.PlusPlusToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeUnaryPostdecrementOperator", unaryPostdecrementExpressions, ts.SyntaxKind.MinusMinusToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                // More unary operator special-casing.
                // DevDiv 181814: Be careful when removing leading whitespace
                // around unary operators.  Examples:
                //      1 - -2  --X--> 1--2
                //      a + ++b --X--> a+++b
                rule("SpaceAfterPostincrementWhenFollowedByAdd", ts.SyntaxKind.PlusPlusToken, ts.SyntaxKind.PlusToken, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterAddWhenFollowedByUnaryPlus", ts.SyntaxKind.PlusToken, ts.SyntaxKind.PlusToken, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterAddWhenFollowedByPreincrement", ts.SyntaxKind.PlusToken, ts.SyntaxKind.PlusPlusToken, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterPostdecrementWhenFollowedBySubtract", ts.SyntaxKind.MinusMinusToken, ts.SyntaxKind.MinusToken, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterSubtractWhenFollowedByUnaryMinus", ts.SyntaxKind.MinusToken, ts.SyntaxKind.MinusToken, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterSubtractWhenFollowedByPredecrement", ts.SyntaxKind.MinusToken, ts.SyntaxKind.MinusMinusToken, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("NoSpaceAfterCloseBrace", ts.SyntaxKind.CloseBraceToken, [ts.SyntaxKind.CommaToken, ts.SyntaxKind.SemicolonToken], [isNonJsxSameLineTokenContext], 8 /* Delete */),
                // For functions and control block place } on a new line [multi-line rule]
                rule("NewLineBeforeCloseBraceInBlockContext", anyTokenIncludingMultilineComments, ts.SyntaxKind.CloseBraceToken, [isMultilineBlockContext], 4 /* NewLine */),
                // Space/new line after }.
                rule("SpaceAfterCloseBrace", ts.SyntaxKind.CloseBraceToken, anyTokenExcept(ts.SyntaxKind.CloseParenToken), [isNonJsxSameLineTokenContext, isAfterCodeBlockContext], 2 /* Space */),
                // Special case for (}, else) and (}, while) since else & while tokens are not part of the tree which makes SpaceAfterCloseBrace rule not applied
                // Also should not apply to })
                rule("SpaceBetweenCloseBraceAndElse", ts.SyntaxKind.CloseBraceToken, ts.SyntaxKind.ElseKeyword, [isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBetweenCloseBraceAndWhile", ts.SyntaxKind.CloseBraceToken, ts.SyntaxKind.WhileKeyword, [isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("NoSpaceBetweenEmptyBraceBrackets", ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.CloseBraceToken, [isNonJsxSameLineTokenContext, isObjectContext], 8 /* Delete */),
                // Add a space after control dec context if the next character is an open bracket ex: 'if (false)[a, b] = [1, 2];' -> 'if (false) [a, b] = [1, 2];'
                rule("SpaceAfterConditionalClosingParen", ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.OpenBracketToken, [isControlDeclContext], 2 /* Space */),
                rule("NoSpaceBetweenFunctionKeywordAndStar", ts.SyntaxKind.FunctionKeyword, ts.SyntaxKind.AsteriskToken, [isFunctionDeclarationOrFunctionExpressionContext], 8 /* Delete */),
                rule("SpaceAfterStarInGeneratorDeclaration", ts.SyntaxKind.AsteriskToken, [ts.SyntaxKind.Identifier, ts.SyntaxKind.OpenParenToken], [isFunctionDeclarationOrFunctionExpressionContext], 2 /* Space */),
                rule("SpaceAfterFunctionInFuncDecl", ts.SyntaxKind.FunctionKeyword, anyToken, [isFunctionDeclContext], 2 /* Space */),
                // Insert new line after { and before } in multi-line contexts.
                rule("NewLineAfterOpenBraceInBlockContext", ts.SyntaxKind.OpenBraceToken, anyToken, [isMultilineBlockContext], 4 /* NewLine */),
                // For get/set members, we check for (identifier,identifier) since get/set don't have tokens and they are represented as just an identifier token.
                // Though, we do extra check on the context to make sure we are dealing with get/set node. Example:
                //      get x() {}
                //      set x(val) {}
                rule("SpaceAfterGetSetInMember", [ts.SyntaxKind.GetKeyword, ts.SyntaxKind.SetKeyword], ts.SyntaxKind.Identifier, [isFunctionDeclContext], 2 /* Space */),
                rule("NoSpaceBetweenYieldKeywordAndStar", ts.SyntaxKind.YieldKeyword, ts.SyntaxKind.AsteriskToken, [isNonJsxSameLineTokenContext, isYieldOrYieldStarWithOperand], 8 /* Delete */),
                rule("SpaceBetweenYieldOrYieldStarAndOperand", [ts.SyntaxKind.YieldKeyword, ts.SyntaxKind.AsteriskToken], anyToken, [isNonJsxSameLineTokenContext, isYieldOrYieldStarWithOperand], 2 /* Space */),
                rule("NoSpaceBetweenReturnAndSemicolon", ts.SyntaxKind.ReturnKeyword, ts.SyntaxKind.SemicolonToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("SpaceAfterCertainKeywords", [ts.SyntaxKind.VarKeyword, ts.SyntaxKind.ThrowKeyword, ts.SyntaxKind.NewKeyword, ts.SyntaxKind.DeleteKeyword, ts.SyntaxKind.ReturnKeyword, ts.SyntaxKind.TypeOfKeyword, ts.SyntaxKind.AwaitKeyword], anyToken, [isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceAfterLetConstInVariableDeclaration", [ts.SyntaxKind.LetKeyword, ts.SyntaxKind.ConstKeyword], anyToken, [isNonJsxSameLineTokenContext, isStartOfVariableDeclarationList], 2 /* Space */),
                rule("NoSpaceBeforeOpenParenInFuncCall", anyToken, ts.SyntaxKind.OpenParenToken, [isNonJsxSameLineTokenContext, isFunctionCallOrNewContext, isPreviousTokenNotComma], 8 /* Delete */),
                // Special case for binary operators (that are keywords). For these we have to add a space and shouldn't follow any user options.
                rule("SpaceBeforeBinaryKeywordOperator", anyToken, binaryKeywordOperators, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterBinaryKeywordOperator", binaryKeywordOperators, anyToken, [isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterVoidOperator", ts.SyntaxKind.VoidKeyword, anyToken, [isNonJsxSameLineTokenContext, isVoidOpContext], 2 /* Space */),
                // Async-await
                rule("SpaceBetweenAsyncAndOpenParen", ts.SyntaxKind.AsyncKeyword, ts.SyntaxKind.OpenParenToken, [isArrowFunctionContext, isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBetweenAsyncAndFunctionKeyword", ts.SyntaxKind.AsyncKeyword, ts.SyntaxKind.FunctionKeyword, [isNonJsxSameLineTokenContext], 2 /* Space */),
                // template string
                rule("NoSpaceBetweenTagAndTemplateString", ts.SyntaxKind.Identifier, [ts.SyntaxKind.NoSubstitutionTemplateLiteral, ts.SyntaxKind.TemplateHead], [isNonJsxSameLineTokenContext], 8 /* Delete */),
                // JSX opening elements
                rule("SpaceBeforeJsxAttribute", anyToken, ts.SyntaxKind.Identifier, [isNextTokenParentJsxAttribute, isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBeforeSlashInJsxOpeningElement", anyToken, ts.SyntaxKind.SlashToken, [isJsxSelfClosingElementContext, isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("NoSpaceBeforeGreaterThanTokenInJsxOpeningElement", ts.SyntaxKind.SlashToken, ts.SyntaxKind.GreaterThanToken, [isJsxSelfClosingElementContext, isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeEqualInJsxAttribute", anyToken, ts.SyntaxKind.EqualsToken, [isJsxAttributeContext, isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceAfterEqualInJsxAttribute", ts.SyntaxKind.EqualsToken, anyToken, [isJsxAttributeContext, isNonJsxSameLineTokenContext], 8 /* Delete */),
                // TypeScript-specific rules
                // Use of module as a function call. e.g.: import m2 = module("m2");
                rule("NoSpaceAfterModuleImport", [ts.SyntaxKind.ModuleKeyword, ts.SyntaxKind.RequireKeyword], ts.SyntaxKind.OpenParenToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                // Add a space around certain TypeScript keywords
                rule("SpaceAfterCertainTypeScriptKeywords", [
                    ts.SyntaxKind.AbstractKeyword,
                    ts.SyntaxKind.ClassKeyword,
                    ts.SyntaxKind.DeclareKeyword,
                    ts.SyntaxKind.DefaultKeyword,
                    ts.SyntaxKind.EnumKeyword,
                    ts.SyntaxKind.ExportKeyword,
                    ts.SyntaxKind.ExtendsKeyword,
                    ts.SyntaxKind.GetKeyword,
                    ts.SyntaxKind.ImplementsKeyword,
                    ts.SyntaxKind.ImportKeyword,
                    ts.SyntaxKind.InterfaceKeyword,
                    ts.SyntaxKind.ModuleKeyword,
                    ts.SyntaxKind.NamespaceKeyword,
                    ts.SyntaxKind.PrivateKeyword,
                    ts.SyntaxKind.PublicKeyword,
                    ts.SyntaxKind.ProtectedKeyword,
                    ts.SyntaxKind.ReadonlyKeyword,
                    ts.SyntaxKind.SetKeyword,
                    ts.SyntaxKind.StaticKeyword,
                    ts.SyntaxKind.TypeKeyword,
                    ts.SyntaxKind.FromKeyword,
                    ts.SyntaxKind.KeyOfKeyword,
                    ts.SyntaxKind.InferKeyword,
                ], anyToken, [isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBeforeCertainTypeScriptKeywords", anyToken, [ts.SyntaxKind.ExtendsKeyword, ts.SyntaxKind.ImplementsKeyword, ts.SyntaxKind.FromKeyword], [isNonJsxSameLineTokenContext], 2 /* Space */),
                // Treat string literals in module names as identifiers, and add a space between the literal and the opening Brace braces, e.g.: module "m2" {
                rule("SpaceAfterModuleName", ts.SyntaxKind.StringLiteral, ts.SyntaxKind.OpenBraceToken, [isModuleDeclContext], 2 /* Space */),
                // Lambda expressions
                rule("SpaceBeforeArrow", anyToken, ts.SyntaxKind.EqualsGreaterThanToken, [isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceAfterArrow", ts.SyntaxKind.EqualsGreaterThanToken, anyToken, [isNonJsxSameLineTokenContext], 2 /* Space */),
                // Optional parameters and let args
                rule("NoSpaceAfterEllipsis", ts.SyntaxKind.DotDotDotToken, ts.SyntaxKind.Identifier, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceAfterOptionalParameters", ts.SyntaxKind.QuestionToken, [ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.CommaToken], [isNonJsxSameLineTokenContext, isNotBinaryOpContext], 8 /* Delete */),
                // Remove spaces in empty interface literals. e.g.: x: {}
                rule("NoSpaceBetweenEmptyInterfaceBraceBrackets", ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.CloseBraceToken, [isNonJsxSameLineTokenContext, isObjectTypeContext], 8 /* Delete */),
                // generics and type assertions
                rule("NoSpaceBeforeOpenAngularBracket", typeNames, ts.SyntaxKind.LessThanToken, [isNonJsxSameLineTokenContext, isTypeArgumentOrParameterOrAssertionContext], 8 /* Delete */),
                rule("NoSpaceBetweenCloseParenAndAngularBracket", ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.LessThanToken, [isNonJsxSameLineTokenContext, isTypeArgumentOrParameterOrAssertionContext], 8 /* Delete */),
                rule("NoSpaceAfterOpenAngularBracket", ts.SyntaxKind.LessThanToken, anyToken, [isNonJsxSameLineTokenContext, isTypeArgumentOrParameterOrAssertionContext], 8 /* Delete */),
                rule("NoSpaceBeforeCloseAngularBracket", anyToken, ts.SyntaxKind.GreaterThanToken, [isNonJsxSameLineTokenContext, isTypeArgumentOrParameterOrAssertionContext], 8 /* Delete */),
                rule("NoSpaceAfterCloseAngularBracket", ts.SyntaxKind.GreaterThanToken, [ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.OpenBracketToken, ts.SyntaxKind.GreaterThanToken, ts.SyntaxKind.CommaToken], [isNonJsxSameLineTokenContext, isTypeArgumentOrParameterOrAssertionContext, isNotFunctionDeclContext /*To prevent an interference with the SpaceBeforeOpenParenInFuncDecl rule*/], 8 /* Delete */),
                // decorators
                rule("SpaceBeforeAt", [ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.Identifier], ts.SyntaxKind.AtToken, [isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("NoSpaceAfterAt", ts.SyntaxKind.AtToken, anyToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                // Insert space after @ in decorator
                rule("SpaceAfterDecorator", anyToken, [
                    ts.SyntaxKind.AbstractKeyword,
                    ts.SyntaxKind.Identifier,
                    ts.SyntaxKind.ExportKeyword,
                    ts.SyntaxKind.DefaultKeyword,
                    ts.SyntaxKind.ClassKeyword,
                    ts.SyntaxKind.StaticKeyword,
                    ts.SyntaxKind.PublicKeyword,
                    ts.SyntaxKind.PrivateKeyword,
                    ts.SyntaxKind.ProtectedKeyword,
                    ts.SyntaxKind.GetKeyword,
                    ts.SyntaxKind.SetKeyword,
                    ts.SyntaxKind.OpenBracketToken,
                    ts.SyntaxKind.AsteriskToken,
                ], [isEndOfDecoratorContextOnSameLine], 2 /* Space */),
                rule("NoSpaceBeforeNonNullAssertionOperator", anyToken, ts.SyntaxKind.ExclamationToken, [isNonJsxSameLineTokenContext, isNonNullAssertionContext], 8 /* Delete */),
                rule("NoSpaceAfterNewKeywordOnConstructorSignature", ts.SyntaxKind.NewKeyword, ts.SyntaxKind.OpenParenToken, [isNonJsxSameLineTokenContext, isConstructorSignatureContext], 8 /* Delete */),
            ];
            // These rules are applied after high priority
            const userConfigurableRules = [
                // Treat constructor as an identifier in a function declaration, and remove spaces between constructor and following left parentheses
                rule("SpaceAfterConstructor", ts.SyntaxKind.ConstructorKeyword, ts.SyntaxKind.OpenParenToken, [isOptionEnabled("insertSpaceAfterConstructor"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("NoSpaceAfterConstructor", ts.SyntaxKind.ConstructorKeyword, ts.SyntaxKind.OpenParenToken, [isOptionDisabledOrUndefined("insertSpaceAfterConstructor"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("SpaceAfterComma", ts.SyntaxKind.CommaToken, anyToken, [isOptionEnabled("insertSpaceAfterCommaDelimiter"), isNonJsxSameLineTokenContext, isNonJsxElementOrFragmentContext, isNextTokenNotCloseBracket], 2 /* Space */),
                rule("NoSpaceAfterComma", ts.SyntaxKind.CommaToken, anyToken, [isOptionDisabledOrUndefined("insertSpaceAfterCommaDelimiter"), isNonJsxSameLineTokenContext, isNonJsxElementOrFragmentContext], 8 /* Delete */),
                // Insert space after function keyword for anonymous functions
                rule("SpaceAfterAnonymousFunctionKeyword", ts.SyntaxKind.FunctionKeyword, ts.SyntaxKind.OpenParenToken, [isOptionEnabled("insertSpaceAfterFunctionKeywordForAnonymousFunctions"), isFunctionDeclContext], 2 /* Space */),
                rule("NoSpaceAfterAnonymousFunctionKeyword", ts.SyntaxKind.FunctionKeyword, ts.SyntaxKind.OpenParenToken, [isOptionDisabledOrUndefined("insertSpaceAfterFunctionKeywordForAnonymousFunctions"), isFunctionDeclContext], 8 /* Delete */),
                // Insert space after keywords in control flow statements
                rule("SpaceAfterKeywordInControl", keywords, ts.SyntaxKind.OpenParenToken, [isOptionEnabled("insertSpaceAfterKeywordsInControlFlowStatements"), isControlDeclContext], 2 /* Space */),
                rule("NoSpaceAfterKeywordInControl", keywords, ts.SyntaxKind.OpenParenToken, [isOptionDisabledOrUndefined("insertSpaceAfterKeywordsInControlFlowStatements"), isControlDeclContext], 8 /* Delete */),
                // Insert space after opening and before closing nonempty parenthesis
                rule("SpaceAfterOpenParen", ts.SyntaxKind.OpenParenToken, anyToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBeforeCloseParen", anyToken, ts.SyntaxKind.CloseParenToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBetweenOpenParens", ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.OpenParenToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("NoSpaceBetweenParens", ts.SyntaxKind.OpenParenToken, ts.SyntaxKind.CloseParenToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceAfterOpenParen", ts.SyntaxKind.OpenParenToken, anyToken, [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeCloseParen", anyToken, ts.SyntaxKind.CloseParenToken, [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingNonemptyParenthesis"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                // Insert space after opening and before closing nonempty brackets
                rule("SpaceAfterOpenBracket", ts.SyntaxKind.OpenBracketToken, anyToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBeforeCloseBracket", anyToken, ts.SyntaxKind.CloseBracketToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("NoSpaceBetweenBrackets", ts.SyntaxKind.OpenBracketToken, ts.SyntaxKind.CloseBracketToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceAfterOpenBracket", ts.SyntaxKind.OpenBracketToken, anyToken, [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeCloseBracket", anyToken, ts.SyntaxKind.CloseBracketToken, [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingNonemptyBrackets"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                // Insert a space after { and before } in single-line contexts, but remove space from empty object literals {}.
                rule("SpaceAfterOpenBrace", ts.SyntaxKind.OpenBraceToken, anyToken, [isOptionEnabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces"), isBraceWrappedContext], 2 /* Space */),
                rule("SpaceBeforeCloseBrace", anyToken, ts.SyntaxKind.CloseBraceToken, [isOptionEnabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces"), isBraceWrappedContext], 2 /* Space */),
                rule("NoSpaceBetweenEmptyBraceBrackets", ts.SyntaxKind.OpenBraceToken, ts.SyntaxKind.CloseBraceToken, [isNonJsxSameLineTokenContext, isObjectContext], 8 /* Delete */),
                rule("NoSpaceAfterOpenBrace", ts.SyntaxKind.OpenBraceToken, anyToken, [isOptionDisabled("insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeCloseBrace", anyToken, ts.SyntaxKind.CloseBraceToken, [isOptionDisabled("insertSpaceAfterOpeningAndBeforeClosingNonemptyBraces"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                // Insert space after opening and before closing template string braces
                rule("SpaceAfterTemplateHeadAndMiddle", [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle], anyToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("SpaceBeforeTemplateMiddleAndTail", anyToken, [ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail], [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces"), isNonJsxSameLineTokenContext], 2 /* Space */),
                rule("NoSpaceAfterTemplateHeadAndMiddle", [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle], anyToken, [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceBeforeTemplateMiddleAndTail", anyToken, [ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail], [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingTemplateStringBraces"), isNonJsxSameLineTokenContext], 8 /* Delete */),
                // No space after { and before } in JSX expression
                rule("SpaceAfterOpenBraceInJsxExpression", ts.SyntaxKind.OpenBraceToken, anyToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces"), isNonJsxSameLineTokenContext, isJsxExpressionContext], 2 /* Space */),
                rule("SpaceBeforeCloseBraceInJsxExpression", anyToken, ts.SyntaxKind.CloseBraceToken, [isOptionEnabled("insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces"), isNonJsxSameLineTokenContext, isJsxExpressionContext], 2 /* Space */),
                rule("NoSpaceAfterOpenBraceInJsxExpression", ts.SyntaxKind.OpenBraceToken, anyToken, [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces"), isNonJsxSameLineTokenContext, isJsxExpressionContext], 8 /* Delete */),
                rule("NoSpaceBeforeCloseBraceInJsxExpression", anyToken, ts.SyntaxKind.CloseBraceToken, [isOptionDisabledOrUndefined("insertSpaceAfterOpeningAndBeforeClosingJsxExpressionBraces"), isNonJsxSameLineTokenContext, isJsxExpressionContext], 8 /* Delete */),
                // Insert space after semicolon in for statement
                rule("SpaceAfterSemicolonInFor", ts.SyntaxKind.SemicolonToken, anyToken, [isOptionEnabled("insertSpaceAfterSemicolonInForStatements"), isNonJsxSameLineTokenContext, isForContext], 2 /* Space */),
                rule("NoSpaceAfterSemicolonInFor", ts.SyntaxKind.SemicolonToken, anyToken, [isOptionDisabledOrUndefined("insertSpaceAfterSemicolonInForStatements"), isNonJsxSameLineTokenContext, isForContext], 8 /* Delete */),
                // Insert space before and after binary operators
                rule("SpaceBeforeBinaryOperator", anyToken, binaryOperators, [isOptionEnabled("insertSpaceBeforeAndAfterBinaryOperators"), isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("SpaceAfterBinaryOperator", binaryOperators, anyToken, [isOptionEnabled("insertSpaceBeforeAndAfterBinaryOperators"), isNonJsxSameLineTokenContext, isBinaryOpContext], 2 /* Space */),
                rule("NoSpaceBeforeBinaryOperator", anyToken, binaryOperators, [isOptionDisabledOrUndefined("insertSpaceBeforeAndAfterBinaryOperators"), isNonJsxSameLineTokenContext, isBinaryOpContext], 8 /* Delete */),
                rule("NoSpaceAfterBinaryOperator", binaryOperators, anyToken, [isOptionDisabledOrUndefined("insertSpaceBeforeAndAfterBinaryOperators"), isNonJsxSameLineTokenContext, isBinaryOpContext], 8 /* Delete */),
                rule("SpaceBeforeOpenParenInFuncDecl", anyToken, ts.SyntaxKind.OpenParenToken, [isOptionEnabled("insertSpaceBeforeFunctionParenthesis"), isNonJsxSameLineTokenContext, isFunctionDeclContext], 2 /* Space */),
                rule("NoSpaceBeforeOpenParenInFuncDecl", anyToken, ts.SyntaxKind.OpenParenToken, [isOptionDisabledOrUndefined("insertSpaceBeforeFunctionParenthesis"), isNonJsxSameLineTokenContext, isFunctionDeclContext], 8 /* Delete */),
                // Open Brace braces after control block
                rule("NewLineBeforeOpenBraceInControl", controlOpenBraceLeftTokenRange, ts.SyntaxKind.OpenBraceToken, [isOptionEnabled("placeOpenBraceOnNewLineForControlBlocks"), isControlDeclContext, isBeforeMultilineBlockContext], 4 /* NewLine */, 1 /* CanDeleteNewLines */),
                // Open Brace braces after function
                // TypeScript: Function can have return types, which can be made of tons of different token kinds
                rule("NewLineBeforeOpenBraceInFunction", functionOpenBraceLeftTokenRange, ts.SyntaxKind.OpenBraceToken, [isOptionEnabled("placeOpenBraceOnNewLineForFunctions"), isFunctionDeclContext, isBeforeMultilineBlockContext], 4 /* NewLine */, 1 /* CanDeleteNewLines */),
                // Open Brace braces after TypeScript module/class/interface
                rule("NewLineBeforeOpenBraceInTypeScriptDeclWithBlock", typeScriptOpenBraceLeftTokenRange, ts.SyntaxKind.OpenBraceToken, [isOptionEnabled("placeOpenBraceOnNewLineForFunctions"), isTypeScriptDeclWithBlockContext, isBeforeMultilineBlockContext], 4 /* NewLine */, 1 /* CanDeleteNewLines */),
                rule("SpaceAfterTypeAssertion", ts.SyntaxKind.GreaterThanToken, anyToken, [isOptionEnabled("insertSpaceAfterTypeAssertion"), isNonJsxSameLineTokenContext, isTypeAssertionContext], 2 /* Space */),
                rule("NoSpaceAfterTypeAssertion", ts.SyntaxKind.GreaterThanToken, anyToken, [isOptionDisabledOrUndefined("insertSpaceAfterTypeAssertion"), isNonJsxSameLineTokenContext, isTypeAssertionContext], 8 /* Delete */),
                rule("SpaceBeforeTypeAnnotation", anyToken, ts.SyntaxKind.ColonToken, [isOptionEnabled("insertSpaceBeforeTypeAnnotation"), isNonJsxSameLineTokenContext, isTypeAnnotationContext], 2 /* Space */),
                rule("NoSpaceBeforeTypeAnnotation", anyToken, ts.SyntaxKind.ColonToken, [isOptionDisabledOrUndefined("insertSpaceBeforeTypeAnnotation"), isNonJsxSameLineTokenContext, isTypeAnnotationContext], 8 /* Delete */),
            ];
            // These rules are lower in priority than user-configurable. Rules earlier in this list have priority over rules later in the list.
            const lowPriorityCommonRules = [
                // Space after keyword but not before ; or : or ?
                rule("NoSpaceBeforeSemicolon", anyToken, ts.SyntaxKind.SemicolonToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("SpaceBeforeOpenBraceInControl", controlOpenBraceLeftTokenRange, ts.SyntaxKind.OpenBraceToken, [isOptionDisabledOrUndefinedOrTokensOnSameLine("placeOpenBraceOnNewLineForControlBlocks"), isControlDeclContext, isNotFormatOnEnter, isSameLineTokenOrBeforeBlockContext], 2 /* Space */, 1 /* CanDeleteNewLines */),
                rule("SpaceBeforeOpenBraceInFunction", functionOpenBraceLeftTokenRange, ts.SyntaxKind.OpenBraceToken, [isOptionDisabledOrUndefinedOrTokensOnSameLine("placeOpenBraceOnNewLineForFunctions"), isFunctionDeclContext, isBeforeBlockContext, isNotFormatOnEnter, isSameLineTokenOrBeforeBlockContext], 2 /* Space */, 1 /* CanDeleteNewLines */),
                rule("SpaceBeforeOpenBraceInTypeScriptDeclWithBlock", typeScriptOpenBraceLeftTokenRange, ts.SyntaxKind.OpenBraceToken, [isOptionDisabledOrUndefinedOrTokensOnSameLine("placeOpenBraceOnNewLineForFunctions"), isTypeScriptDeclWithBlockContext, isNotFormatOnEnter, isSameLineTokenOrBeforeBlockContext], 2 /* Space */, 1 /* CanDeleteNewLines */),
                rule("NoSpaceBeforeComma", anyToken, ts.SyntaxKind.CommaToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                // No space before and after indexer `x[]`
                rule("NoSpaceBeforeOpenBracket", anyTokenExcept(ts.SyntaxKind.AsyncKeyword, ts.SyntaxKind.CaseKeyword), ts.SyntaxKind.OpenBracketToken, [isNonJsxSameLineTokenContext], 8 /* Delete */),
                rule("NoSpaceAfterCloseBracket", ts.SyntaxKind.CloseBracketToken, anyToken, [isNonJsxSameLineTokenContext, isNotBeforeBlockInFunctionDeclarationContext], 8 /* Delete */),
                rule("SpaceAfterSemicolon", ts.SyntaxKind.SemicolonToken, anyToken, [isNonJsxSameLineTokenContext], 2 /* Space */),
                // Remove extra space between for and await
                rule("SpaceBetweenForAndAwaitKeyword", ts.SyntaxKind.ForKeyword, ts.SyntaxKind.AwaitKeyword, [isNonJsxSameLineTokenContext], 2 /* Space */),
                // Add a space between statements. All keywords except (do,else,case) has open/close parens after them.
                // So, we have a rule to add a space for [),Any], [do,Any], [else,Any], and [case,Any]
                rule("SpaceBetweenStatements", [ts.SyntaxKind.CloseParenToken, ts.SyntaxKind.DoKeyword, ts.SyntaxKind.ElseKeyword, ts.SyntaxKind.CaseKeyword], anyToken, [isNonJsxSameLineTokenContext, isNonJsxElementOrFragmentContext, isNotForContext], 2 /* Space */),
                // This low-pri rule takes care of "try {" and "finally {" in case the rule SpaceBeforeOpenBraceInControl didn't execute on FormatOnEnter.
                rule("SpaceAfterTryFinally", [ts.SyntaxKind.TryKeyword, ts.SyntaxKind.FinallyKeyword], ts.SyntaxKind.OpenBraceToken, [isNonJsxSameLineTokenContext], 2 /* Space */),
            ];
            return [
                ...highPriorityCommonRules,
                ...userConfigurableRules,
                ...lowPriorityCommonRules,
            ];
        }
        formatting.getAllRules = getAllRules;
        function rule(debugName, left, right, context, action, flags = 0 /* None */) {
            return { leftTokenRange: toTokenRange(left), rightTokenRange: toTokenRange(right), rule: { debugName, context, action, flags } };
        }
        function tokenRangeFrom(tokens) {
            return { tokens, isSpecific: true };
        }
        function toTokenRange(arg) {
            return typeof arg === "number" ? tokenRangeFrom([arg]) : ts.isArray(arg) ? tokenRangeFrom(arg) : arg;
        }
        function tokenRangeFromRange(from, to, except = []) {
            const tokens = [];
            for (let token = from; token <= to; token++) {
                if (!ts.contains(except, token)) {
                    tokens.push(token);
                }
            }
            return tokenRangeFrom(tokens);
        }
        ///
        /// Contexts
        ///
        function isOptionEnabled(optionName) {
            return (context) => context.options && context.options.hasOwnProperty(optionName) && !!context.options[optionName];
        }
        function isOptionDisabled(optionName) {
            return (context) => context.options && context.options.hasOwnProperty(optionName) && !context.options[optionName];
        }
        function isOptionDisabledOrUndefined(optionName) {
            return (context) => !context.options || !context.options.hasOwnProperty(optionName) || !context.options[optionName];
        }
        function isOptionDisabledOrUndefinedOrTokensOnSameLine(optionName) {
            return (context) => !context.options || !context.options.hasOwnProperty(optionName) || !context.options[optionName] || context.TokensAreOnSameLine();
        }
        function isOptionEnabledOrUndefined(optionName) {
            return (context) => !context.options || !context.options.hasOwnProperty(optionName) || !!context.options[optionName];
        }
        function isForContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.ForStatement;
        }
        function isNotForContext(context) {
            return !isForContext(context);
        }
        function isBinaryOpContext(context) {
            switch (context.contextNode.kind) {
                case ts.SyntaxKind.BinaryExpression:
                case ts.SyntaxKind.ConditionalExpression:
                case ts.SyntaxKind.ConditionalType:
                case ts.SyntaxKind.AsExpression:
                case ts.SyntaxKind.ExportSpecifier:
                case ts.SyntaxKind.ImportSpecifier:
                case ts.SyntaxKind.TypePredicate:
                case ts.SyntaxKind.UnionType:
                case ts.SyntaxKind.IntersectionType:
                    return true;
                // equals in binding elements: function foo([[x, y] = [1, 2]])
                case ts.SyntaxKind.BindingElement:
                // equals in type X = ...
                case ts.SyntaxKind.TypeAliasDeclaration:
                // equal in import a = module('a');
                case ts.SyntaxKind.ImportEqualsDeclaration:
                // equal in let a = 0;
                case ts.SyntaxKind.VariableDeclaration:
                // equal in p = 0;
                case ts.SyntaxKind.Parameter:
                case ts.SyntaxKind.EnumMember:
                case ts.SyntaxKind.PropertyDeclaration:
                case ts.SyntaxKind.PropertySignature:
                    return context.currentTokenSpan.kind === ts.SyntaxKind.EqualsToken || context.nextTokenSpan.kind === ts.SyntaxKind.EqualsToken;
                // "in" keyword in for (let x in []) { }
                case ts.SyntaxKind.ForInStatement:
                // "in" keyword in [P in keyof T]: T[P]
                case ts.SyntaxKind.TypeParameter:
                    return context.currentTokenSpan.kind === ts.SyntaxKind.InKeyword || context.nextTokenSpan.kind === ts.SyntaxKind.InKeyword;
                // Technically, "of" is not a binary operator, but format it the same way as "in"
                case ts.SyntaxKind.ForOfStatement:
                    return context.currentTokenSpan.kind === ts.SyntaxKind.OfKeyword || context.nextTokenSpan.kind === ts.SyntaxKind.OfKeyword;
            }
            return false;
        }
        function isNotBinaryOpContext(context) {
            return !isBinaryOpContext(context);
        }
        function isNotTypeAnnotationContext(context) {
            return !isTypeAnnotationContext(context);
        }
        function isTypeAnnotationContext(context) {
            const contextKind = context.contextNode.kind;
            return contextKind === ts.SyntaxKind.PropertyDeclaration ||
                contextKind === ts.SyntaxKind.PropertySignature ||
                contextKind === ts.SyntaxKind.Parameter ||
                contextKind === ts.SyntaxKind.VariableDeclaration ||
                ts.isFunctionLikeKind(contextKind);
        }
        function isConditionalOperatorContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.ConditionalExpression ||
                context.contextNode.kind === ts.SyntaxKind.ConditionalType;
        }
        function isSameLineTokenOrBeforeBlockContext(context) {
            return context.TokensAreOnSameLine() || isBeforeBlockContext(context);
        }
        function isBraceWrappedContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.ObjectBindingPattern ||
                context.contextNode.kind === ts.SyntaxKind.MappedType ||
                isSingleLineBlockContext(context);
        }
        // This check is done before an open brace in a control construct, a function, or a typescript block declaration
        function isBeforeMultilineBlockContext(context) {
            return isBeforeBlockContext(context) && !(context.NextNodeAllOnSameLine() || context.NextNodeBlockIsOnOneLine());
        }
        function isMultilineBlockContext(context) {
            return isBlockContext(context) && !(context.ContextNodeAllOnSameLine() || context.ContextNodeBlockIsOnOneLine());
        }
        function isSingleLineBlockContext(context) {
            return isBlockContext(context) && (context.ContextNodeAllOnSameLine() || context.ContextNodeBlockIsOnOneLine());
        }
        function isBlockContext(context) {
            return nodeIsBlockContext(context.contextNode);
        }
        function isBeforeBlockContext(context) {
            return nodeIsBlockContext(context.nextTokenParent);
        }
        // IMPORTANT!!! This method must return true ONLY for nodes with open and close braces as immediate children
        function nodeIsBlockContext(node) {
            if (nodeIsTypeScriptDeclWithBlockContext(node)) {
                // This means we are in a context that looks like a block to the user, but in the grammar is actually not a node (it's a class, module, enum, object type literal, etc).
                return true;
            }
            switch (node.kind) {
                case ts.SyntaxKind.Block:
                case ts.SyntaxKind.CaseBlock:
                case ts.SyntaxKind.ObjectLiteralExpression:
                case ts.SyntaxKind.ModuleBlock:
                    return true;
            }
            return false;
        }
        function isFunctionDeclContext(context) {
            switch (context.contextNode.kind) {
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                // case SyntaxKind.MemberFunctionDeclaration:
                case ts.SyntaxKind.GetAccessor:
                case ts.SyntaxKind.SetAccessor:
                // case SyntaxKind.MethodSignature:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.Constructor:
                case ts.SyntaxKind.ArrowFunction:
                // case SyntaxKind.ConstructorDeclaration:
                // case SyntaxKind.SimpleArrowFunctionExpression:
                // case SyntaxKind.ParenthesizedArrowFunctionExpression:
                case ts.SyntaxKind.InterfaceDeclaration: // This one is not truly a function, but for formatting purposes, it acts just like one
                    return true;
            }
            return false;
        }
        function isNotFunctionDeclContext(context) {
            return !isFunctionDeclContext(context);
        }
        function isFunctionDeclarationOrFunctionExpressionContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.FunctionDeclaration || context.contextNode.kind === ts.SyntaxKind.FunctionExpression;
        }
        function isTypeScriptDeclWithBlockContext(context) {
            return nodeIsTypeScriptDeclWithBlockContext(context.contextNode);
        }
        function nodeIsTypeScriptDeclWithBlockContext(node) {
            switch (node.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.TypeLiteral:
                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.ExportDeclaration:
                case ts.SyntaxKind.NamedExports:
                case ts.SyntaxKind.ImportDeclaration:
                case ts.SyntaxKind.NamedImports:
                    return true;
            }
            return false;
        }
        function isAfterCodeBlockContext(context) {
            switch (context.currentTokenParent.kind) {
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ModuleDeclaration:
                case ts.SyntaxKind.EnumDeclaration:
                case ts.SyntaxKind.CatchClause:
                case ts.SyntaxKind.ModuleBlock:
                case ts.SyntaxKind.SwitchStatement:
                    return true;
                case ts.SyntaxKind.Block: {
                    const blockParent = context.currentTokenParent.parent;
                    // In a codefix scenario, we can't rely on parents being set. So just always return true.
                    if (!blockParent || blockParent.kind !== ts.SyntaxKind.ArrowFunction && blockParent.kind !== ts.SyntaxKind.FunctionExpression) {
                        return true;
                    }
                }
            }
            return false;
        }
        function isControlDeclContext(context) {
            switch (context.contextNode.kind) {
                case ts.SyntaxKind.IfStatement:
                case ts.SyntaxKind.SwitchStatement:
                case ts.SyntaxKind.ForStatement:
                case ts.SyntaxKind.ForInStatement:
                case ts.SyntaxKind.ForOfStatement:
                case ts.SyntaxKind.WhileStatement:
                case ts.SyntaxKind.TryStatement:
                case ts.SyntaxKind.DoStatement:
                case ts.SyntaxKind.WithStatement:
                // TODO
                // case SyntaxKind.ElseClause:
                case ts.SyntaxKind.CatchClause:
                    return true;
                default:
                    return false;
            }
        }
        function isObjectContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.ObjectLiteralExpression;
        }
        function isFunctionCallContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.CallExpression;
        }
        function isNewContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.NewExpression;
        }
        function isFunctionCallOrNewContext(context) {
            return isFunctionCallContext(context) || isNewContext(context);
        }
        function isPreviousTokenNotComma(context) {
            return context.currentTokenSpan.kind !== ts.SyntaxKind.CommaToken;
        }
        function isNextTokenNotCloseBracket(context) {
            return context.nextTokenSpan.kind !== ts.SyntaxKind.CloseBracketToken;
        }
        function isArrowFunctionContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.ArrowFunction;
        }
        function isNonJsxSameLineTokenContext(context) {
            return context.TokensAreOnSameLine() && context.contextNode.kind !== ts.SyntaxKind.JsxText;
        }
        function isNonJsxElementOrFragmentContext(context) {
            return context.contextNode.kind !== ts.SyntaxKind.JsxElement && context.contextNode.kind !== ts.SyntaxKind.JsxFragment;
        }
        function isJsxExpressionContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.JsxExpression || context.contextNode.kind === ts.SyntaxKind.JsxSpreadAttribute;
        }
        function isNextTokenParentJsxAttribute(context) {
            return context.nextTokenParent.kind === ts.SyntaxKind.JsxAttribute;
        }
        function isJsxAttributeContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.JsxAttribute;
        }
        function isJsxSelfClosingElementContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.JsxSelfClosingElement;
        }
        function isNotBeforeBlockInFunctionDeclarationContext(context) {
            return !isFunctionDeclContext(context) && !isBeforeBlockContext(context);
        }
        function isEndOfDecoratorContextOnSameLine(context) {
            return context.TokensAreOnSameLine() &&
                context.contextNode.decorators &&
                nodeIsInDecoratorContext(context.currentTokenParent) &&
                !nodeIsInDecoratorContext(context.nextTokenParent);
        }
        function nodeIsInDecoratorContext(node) {
            while (ts.isExpressionNode(node)) {
                node = node.parent;
            }
            return node.kind === ts.SyntaxKind.Decorator;
        }
        function isStartOfVariableDeclarationList(context) {
            return context.currentTokenParent.kind === ts.SyntaxKind.VariableDeclarationList &&
                context.currentTokenParent.getStart(context.sourceFile) === context.currentTokenSpan.pos;
        }
        function isNotFormatOnEnter(context) {
            return context.formattingRequestKind !== 2 /* FormatOnEnter */;
        }
        function isModuleDeclContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.ModuleDeclaration;
        }
        function isObjectTypeContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.TypeLiteral; // && context.contextNode.parent.kind !== SyntaxKind.InterfaceDeclaration;
        }
        function isConstructorSignatureContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.ConstructSignature;
        }
        function isTypeArgumentOrParameterOrAssertion(token, parent) {
            if (token.kind !== ts.SyntaxKind.LessThanToken && token.kind !== ts.SyntaxKind.GreaterThanToken) {
                return false;
            }
            switch (parent.kind) {
                case ts.SyntaxKind.TypeReference:
                case ts.SyntaxKind.TypeAssertionExpression:
                case ts.SyntaxKind.TypeAliasDeclaration:
                case ts.SyntaxKind.ClassDeclaration:
                case ts.SyntaxKind.ClassExpression:
                case ts.SyntaxKind.InterfaceDeclaration:
                case ts.SyntaxKind.FunctionDeclaration:
                case ts.SyntaxKind.FunctionExpression:
                case ts.SyntaxKind.ArrowFunction:
                case ts.SyntaxKind.MethodDeclaration:
                case ts.SyntaxKind.MethodSignature:
                case ts.SyntaxKind.CallSignature:
                case ts.SyntaxKind.ConstructSignature:
                case ts.SyntaxKind.CallExpression:
                case ts.SyntaxKind.NewExpression:
                case ts.SyntaxKind.ExpressionWithTypeArguments:
                    return true;
                default:
                    return false;
            }
        }
        function isTypeArgumentOrParameterOrAssertionContext(context) {
            return isTypeArgumentOrParameterOrAssertion(context.currentTokenSpan, context.currentTokenParent) ||
                isTypeArgumentOrParameterOrAssertion(context.nextTokenSpan, context.nextTokenParent);
        }
        function isTypeAssertionContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.TypeAssertionExpression;
        }
        function isVoidOpContext(context) {
            return context.currentTokenSpan.kind === ts.SyntaxKind.VoidKeyword && context.currentTokenParent.kind === ts.SyntaxKind.VoidExpression;
        }
        function isYieldOrYieldStarWithOperand(context) {
            return context.contextNode.kind === ts.SyntaxKind.YieldExpression && context.contextNode.expression !== undefined;
        }
        function isNonNullAssertionContext(context) {
            return context.contextNode.kind === ts.SyntaxKind.NonNullExpression;
        }
    })(formatting = ts.formatting || (ts.formatting = {}));
})(ts || (ts = {}));
