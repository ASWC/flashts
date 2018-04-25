var ts;
(function (ts) {
    function createSynthesizedNode(kind) {
        const node = ts.createNode(kind, -1, -1);
        node.flags |= ts.NodeFlags.Synthesized;
        return node;
    }
    /* @internal */
    function updateNode(updated, original) {
        if (updated !== original) {
            setOriginalNode(updated, original);
            setTextRange(updated, original);
            ts.aggregateTransformFlags(updated);
        }
        return updated;
    }
    ts.updateNode = updateNode;
    /**
     * Make `elements` into a `NodeArray<T>`. If `elements` is `undefined`, returns an empty `NodeArray<T>`.
     */
    function createNodeArray(elements, hasTrailingComma) {
        if (!elements || elements === ts.emptyArray) {
            elements = [];
        }
        else {
            if (ts.isNodeArray(elements)) {
                return elements;
            }
        }
        const array = elements;
        array.pos = -1;
        array.end = -1;
        array.hasTrailingComma = hasTrailingComma;
        return array;
    }
    ts.createNodeArray = createNodeArray;
    /**
     * Creates a shallow, memberwise clone of a node with no source map location.
     */
    /* @internal */
    function getSynthesizedClone(node) {
        // We don't use "clone" from core.ts here, as we need to preserve the prototype chain of
        // the original node. We also need to exclude specific properties and only include own-
        // properties (to skip members already defined on the shared prototype).
        if (node === undefined) {
            return undefined;
        }
        const clone = createSynthesizedNode(node.kind);
        clone.flags |= node.flags;
        setOriginalNode(clone, node);
        for (const key in node) {
            if (clone.hasOwnProperty(key) || !node.hasOwnProperty(key)) {
                continue;
            }
            clone[key] = node[key];
        }
        return clone;
    }
    ts.getSynthesizedClone = getSynthesizedClone;
    function createLiteral(value, isSingleQuote) {
        if (typeof value === "number") {
            return createNumericLiteral(value + "");
        }
        if (typeof value === "boolean") {
            return value ? createTrue() : createFalse();
        }
        if (ts.isString(value)) {
            const res = createStringLiteral(value);
            if (isSingleQuote)
                res.singleQuote = true;
            return res;
        }
        return createLiteralFromNode(value);
    }
    ts.createLiteral = createLiteral;
    function createNumericLiteral(value) {
        const node = createSynthesizedNode(ts.SyntaxKind.NumericLiteral);
        node.text = value;
        node.numericLiteralFlags = 0;
        return node;
    }
    ts.createNumericLiteral = createNumericLiteral;
    function createStringLiteral(text) {
        const node = createSynthesizedNode(ts.SyntaxKind.StringLiteral);
        node.text = text;
        return node;
    }
    function createLiteralFromNode(sourceNode) {
        const node = createStringLiteral(ts.getTextOfIdentifierOrLiteral(sourceNode));
        node.textSourceNode = sourceNode;
        return node;
    }
    function createIdentifier(text, typeArguments) {
        const node = createSynthesizedNode(ts.SyntaxKind.Identifier);
        node.escapedText = ts.escapeLeadingUnderscores(text);
        node.originalKeywordKind = text ? ts.stringToToken(text) : ts.SyntaxKind.Unknown;
        node.autoGenerateFlags = 0 /* None */;
        node.autoGenerateId = 0;
        if (typeArguments) {
            node.typeArguments = createNodeArray(typeArguments);
        }
        return node;
    }
    ts.createIdentifier = createIdentifier;
    function updateIdentifier(node, typeArguments) {
        return node.typeArguments !== typeArguments
            ? updateNode(createIdentifier(ts.idText(node), typeArguments), node)
            : node;
    }
    ts.updateIdentifier = updateIdentifier;
    let nextAutoGenerateId = 0;
    function createTempVariable(recordTempVariable, reservedInNestedScopes) {
        const name = createIdentifier("");
        name.autoGenerateFlags = 1 /* Auto */;
        name.autoGenerateId = nextAutoGenerateId;
        nextAutoGenerateId++;
        if (recordTempVariable) {
            recordTempVariable(name);
        }
        if (reservedInNestedScopes) {
            name.autoGenerateFlags |= 16 /* ReservedInNestedScopes */;
        }
        return name;
    }
    ts.createTempVariable = createTempVariable;
    /** Create a unique temporary variable for use in a loop. */
    function createLoopVariable() {
        const name = createIdentifier("");
        name.autoGenerateFlags = 2 /* Loop */;
        name.autoGenerateId = nextAutoGenerateId;
        nextAutoGenerateId++;
        return name;
    }
    ts.createLoopVariable = createLoopVariable;
    /** Create a unique name based on the supplied text. */
    function createUniqueName(text) {
        const name = createIdentifier(text);
        name.autoGenerateFlags = 3 /* Unique */;
        name.autoGenerateId = nextAutoGenerateId;
        nextAutoGenerateId++;
        return name;
    }
    ts.createUniqueName = createUniqueName;
    /** Create a unique name based on the supplied text. */
    function createOptimisticUniqueName(text) {
        const name = createIdentifier(text);
        name.autoGenerateFlags = 3 /* Unique */ | 32 /* Optimistic */;
        name.autoGenerateId = nextAutoGenerateId;
        nextAutoGenerateId++;
        return name;
    }
    ts.createOptimisticUniqueName = createOptimisticUniqueName;
    /** Create a unique name based on the supplied text. This does not consider names injected by the transformer. */
    function createFileLevelUniqueName(text) {
        const name = createOptimisticUniqueName(text);
        name.autoGenerateFlags |= 64 /* FileLevel */;
        return name;
    }
    ts.createFileLevelUniqueName = createFileLevelUniqueName;
    function getGeneratedNameForNode(node, shouldSkipNameGenerationScope) {
        const name = createIdentifier("");
        name.autoGenerateFlags = 4 /* Node */;
        name.autoGenerateId = nextAutoGenerateId;
        name.original = node;
        if (shouldSkipNameGenerationScope) {
            name.autoGenerateFlags |= 8 /* SkipNameGenerationScope */;
        }
        nextAutoGenerateId++;
        return name;
    }
    ts.getGeneratedNameForNode = getGeneratedNameForNode;
    // Punctuation
    function createToken(token) {
        return createSynthesizedNode(token);
    }
    ts.createToken = createToken;
    // Reserved words
    function createSuper() {
        return createSynthesizedNode(ts.SyntaxKind.SuperKeyword);
    }
    ts.createSuper = createSuper;
    function createThis() {
        return createSynthesizedNode(ts.SyntaxKind.ThisKeyword);
    }
    ts.createThis = createThis;
    function createNull() {
        return createSynthesizedNode(ts.SyntaxKind.NullKeyword);
    }
    ts.createNull = createNull;
    function createTrue() {
        return createSynthesizedNode(ts.SyntaxKind.TrueKeyword);
    }
    ts.createTrue = createTrue;
    function createFalse() {
        return createSynthesizedNode(ts.SyntaxKind.FalseKeyword);
    }
    ts.createFalse = createFalse;
    // Modifiers
    function createModifier(kind) {
        return createToken(kind);
    }
    ts.createModifier = createModifier;
    function createModifiersFromModifierFlags(flags) {
        const result = [];
        if (flags & ts.ModifierFlags.Export) {
            result.push(createModifier(ts.SyntaxKind.ExportKeyword));
        }
        if (flags & ts.ModifierFlags.Ambient) {
            result.push(createModifier(ts.SyntaxKind.DeclareKeyword));
        }
        if (flags & ts.ModifierFlags.Default) {
            result.push(createModifier(ts.SyntaxKind.DefaultKeyword));
        }
        if (flags & ts.ModifierFlags.Const) {
            result.push(createModifier(ts.SyntaxKind.ConstKeyword));
        }
        if (flags & ts.ModifierFlags.Public) {
            result.push(createModifier(ts.SyntaxKind.PublicKeyword));
        }
        if (flags & ts.ModifierFlags.Private) {
            result.push(createModifier(ts.SyntaxKind.PrivateKeyword));
        }
        if (flags & ts.ModifierFlags.Protected) {
            result.push(createModifier(ts.SyntaxKind.ProtectedKeyword));
        }
        if (flags & ts.ModifierFlags.Abstract) {
            result.push(createModifier(ts.SyntaxKind.AbstractKeyword));
        }
        if (flags & ts.ModifierFlags.Static) {
            result.push(createModifier(ts.SyntaxKind.StaticKeyword));
        }
        if (flags & ts.ModifierFlags.Readonly) {
            result.push(createModifier(ts.SyntaxKind.ReadonlyKeyword));
        }
        if (flags & ts.ModifierFlags.Async) {
            result.push(createModifier(ts.SyntaxKind.AsyncKeyword));
        }
        return result;
    }
    ts.createModifiersFromModifierFlags = createModifiersFromModifierFlags;
    // Names
    function createQualifiedName(left, right) {
        const node = createSynthesizedNode(ts.SyntaxKind.QualifiedName);
        node.left = left;
        node.right = asName(right);
        return node;
    }
    ts.createQualifiedName = createQualifiedName;
    function updateQualifiedName(node, left, right) {
        return node.left !== left
            || node.right !== right
            ? updateNode(createQualifiedName(left, right), node)
            : node;
    }
    ts.updateQualifiedName = updateQualifiedName;
    function parenthesizeForComputedName(expression) {
        return (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.CommaToken) ||
            expression.kind === ts.SyntaxKind.CommaListExpression ?
            createParen(expression) :
            expression;
    }
    function createComputedPropertyName(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ComputedPropertyName);
        node.expression = parenthesizeForComputedName(expression);
        return node;
    }
    ts.createComputedPropertyName = createComputedPropertyName;
    function updateComputedPropertyName(node, expression) {
        return node.expression !== expression
            ? updateNode(createComputedPropertyName(expression), node)
            : node;
    }
    ts.updateComputedPropertyName = updateComputedPropertyName;
    // Signature elements
    function createTypeParameterDeclaration(name, constraint, defaultType) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeParameter);
        node.name = asName(name);
        node.constraint = constraint;
        node.default = defaultType;
        return node;
    }
    ts.createTypeParameterDeclaration = createTypeParameterDeclaration;
    function updateTypeParameterDeclaration(node, name, constraint, defaultType) {
        return node.name !== name
            || node.constraint !== constraint
            || node.default !== defaultType
            ? updateNode(createTypeParameterDeclaration(name, constraint, defaultType), node)
            : node;
    }
    ts.updateTypeParameterDeclaration = updateTypeParameterDeclaration;
    function createParameter(decorators, modifiers, dotDotDotToken, name, questionToken, type, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.Parameter);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.dotDotDotToken = dotDotDotToken;
        node.name = asName(name);
        node.questionToken = questionToken;
        node.type = type;
        node.initializer = initializer ? ts.parenthesizeExpressionForList(initializer) : undefined;
        return node;
    }
    ts.createParameter = createParameter;
    function updateParameter(node, decorators, modifiers, dotDotDotToken, name, questionToken, type, initializer) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.dotDotDotToken !== dotDotDotToken
            || node.name !== name
            || node.questionToken !== questionToken
            || node.type !== type
            || node.initializer !== initializer
            ? updateNode(createParameter(decorators, modifiers, dotDotDotToken, name, questionToken, type, initializer), node)
            : node;
    }
    ts.updateParameter = updateParameter;
    function createDecorator(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.Decorator);
        node.expression = ts.parenthesizeForAccess(expression);
        return node;
    }
    ts.createDecorator = createDecorator;
    function updateDecorator(node, expression) {
        return node.expression !== expression
            ? updateNode(createDecorator(expression), node)
            : node;
    }
    ts.updateDecorator = updateDecorator;
    // Type Elements
    function createPropertySignature(modifiers, name, questionToken, type, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.PropertySignature);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.questionToken = questionToken;
        node.type = type;
        node.initializer = initializer;
        return node;
    }
    ts.createPropertySignature = createPropertySignature;
    function updatePropertySignature(node, modifiers, name, questionToken, type, initializer) {
        return node.modifiers !== modifiers
            || node.name !== name
            || node.questionToken !== questionToken
            || node.type !== type
            || node.initializer !== initializer
            ? updateNode(createPropertySignature(modifiers, name, questionToken, type, initializer), node)
            : node;
    }
    ts.updatePropertySignature = updatePropertySignature;
    function createProperty(decorators, modifiers, name, questionOrExclamationToken, type, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.PropertyDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.questionToken = questionOrExclamationToken !== undefined && questionOrExclamationToken.kind === ts.SyntaxKind.QuestionToken ? questionOrExclamationToken : undefined;
        node.exclamationToken = questionOrExclamationToken !== undefined && questionOrExclamationToken.kind === ts.SyntaxKind.ExclamationToken ? questionOrExclamationToken : undefined;
        node.type = type;
        node.initializer = initializer;
        return node;
    }
    ts.createProperty = createProperty;
    function updateProperty(node, decorators, modifiers, name, questionOrExclamationToken, type, initializer) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.questionToken !== (questionOrExclamationToken !== undefined && questionOrExclamationToken.kind === ts.SyntaxKind.QuestionToken ? questionOrExclamationToken : undefined)
            || node.exclamationToken !== (questionOrExclamationToken !== undefined && questionOrExclamationToken.kind === ts.SyntaxKind.ExclamationToken ? questionOrExclamationToken : undefined)
            || node.type !== type
            || node.initializer !== initializer
            ? updateNode(createProperty(decorators, modifiers, name, questionOrExclamationToken, type, initializer), node)
            : node;
    }
    ts.updateProperty = updateProperty;
    function createMethodSignature(typeParameters, parameters, type, name, questionToken) {
        const node = createSignatureDeclaration(ts.SyntaxKind.MethodSignature, typeParameters, parameters, type);
        node.name = asName(name);
        node.questionToken = questionToken;
        return node;
    }
    ts.createMethodSignature = createMethodSignature;
    function updateMethodSignature(node, typeParameters, parameters, type, name, questionToken) {
        return node.typeParameters !== typeParameters
            || node.parameters !== parameters
            || node.type !== type
            || node.name !== name
            || node.questionToken !== questionToken
            ? updateNode(createMethodSignature(typeParameters, parameters, type, name, questionToken), node)
            : node;
    }
    ts.updateMethodSignature = updateMethodSignature;
    function createMethod(decorators, modifiers, asteriskToken, name, questionToken, typeParameters, parameters, type, body) {
        const node = createSynthesizedNode(ts.SyntaxKind.MethodDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.asteriskToken = asteriskToken;
        node.name = asName(name);
        node.questionToken = questionToken;
        node.typeParameters = asNodeArray(typeParameters);
        node.parameters = createNodeArray(parameters);
        node.type = type;
        node.body = body;
        return node;
    }
    ts.createMethod = createMethod;
    function updateMethod(node, decorators, modifiers, asteriskToken, name, questionToken, typeParameters, parameters, type, body) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.asteriskToken !== asteriskToken
            || node.name !== name
            || node.questionToken !== questionToken
            || node.typeParameters !== typeParameters
            || node.parameters !== parameters
            || node.type !== type
            || node.body !== body
            ? updateNode(createMethod(decorators, modifiers, asteriskToken, name, questionToken, typeParameters, parameters, type, body), node)
            : node;
    }
    ts.updateMethod = updateMethod;
    function createConstructor(decorators, modifiers, parameters, body) {
        const node = createSynthesizedNode(ts.SyntaxKind.Constructor);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.typeParameters = undefined;
        node.parameters = createNodeArray(parameters);
        node.type = undefined;
        node.body = body;
        return node;
    }
    ts.createConstructor = createConstructor;
    function updateConstructor(node, decorators, modifiers, parameters, body) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.parameters !== parameters
            || node.body !== body
            ? updateNode(createConstructor(decorators, modifiers, parameters, body), node)
            : node;
    }
    ts.updateConstructor = updateConstructor;
    function createGetAccessor(decorators, modifiers, name, parameters, type, body) {
        const node = createSynthesizedNode(ts.SyntaxKind.GetAccessor);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.typeParameters = undefined;
        node.parameters = createNodeArray(parameters);
        node.type = type;
        node.body = body;
        return node;
    }
    ts.createGetAccessor = createGetAccessor;
    function updateGetAccessor(node, decorators, modifiers, name, parameters, type, body) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.parameters !== parameters
            || node.type !== type
            || node.body !== body
            ? updateNode(createGetAccessor(decorators, modifiers, name, parameters, type, body), node)
            : node;
    }
    ts.updateGetAccessor = updateGetAccessor;
    function createSetAccessor(decorators, modifiers, name, parameters, body) {
        const node = createSynthesizedNode(ts.SyntaxKind.SetAccessor);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.typeParameters = undefined;
        node.parameters = createNodeArray(parameters);
        node.body = body;
        return node;
    }
    ts.createSetAccessor = createSetAccessor;
    function updateSetAccessor(node, decorators, modifiers, name, parameters, body) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.parameters !== parameters
            || node.body !== body
            ? updateNode(createSetAccessor(decorators, modifiers, name, parameters, body), node)
            : node;
    }
    ts.updateSetAccessor = updateSetAccessor;
    function createCallSignature(typeParameters, parameters, type) {
        return createSignatureDeclaration(ts.SyntaxKind.CallSignature, typeParameters, parameters, type);
    }
    ts.createCallSignature = createCallSignature;
    function updateCallSignature(node, typeParameters, parameters, type) {
        return updateSignatureDeclaration(node, typeParameters, parameters, type);
    }
    ts.updateCallSignature = updateCallSignature;
    function createConstructSignature(typeParameters, parameters, type) {
        return createSignatureDeclaration(ts.SyntaxKind.ConstructSignature, typeParameters, parameters, type);
    }
    ts.createConstructSignature = createConstructSignature;
    function updateConstructSignature(node, typeParameters, parameters, type) {
        return updateSignatureDeclaration(node, typeParameters, parameters, type);
    }
    ts.updateConstructSignature = updateConstructSignature;
    function createIndexSignature(decorators, modifiers, parameters, type) {
        const node = createSynthesizedNode(ts.SyntaxKind.IndexSignature);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.parameters = createNodeArray(parameters);
        node.type = type;
        return node;
    }
    ts.createIndexSignature = createIndexSignature;
    function updateIndexSignature(node, decorators, modifiers, parameters, type) {
        return node.parameters !== parameters
            || node.type !== type
            || node.decorators !== decorators
            || node.modifiers !== modifiers
            ? updateNode(createIndexSignature(decorators, modifiers, parameters, type), node)
            : node;
    }
    ts.updateIndexSignature = updateIndexSignature;
    /* @internal */
    function createSignatureDeclaration(kind, typeParameters, parameters, type, typeArguments) {
        const node = createSynthesizedNode(kind);
        node.typeParameters = asNodeArray(typeParameters);
        node.parameters = asNodeArray(parameters);
        node.type = type;
        node.typeArguments = asNodeArray(typeArguments);
        return node;
    }
    ts.createSignatureDeclaration = createSignatureDeclaration;
    function updateSignatureDeclaration(node, typeParameters, parameters, type) {
        return node.typeParameters !== typeParameters
            || node.parameters !== parameters
            || node.type !== type
            ? updateNode(createSignatureDeclaration(node.kind, typeParameters, parameters, type), node)
            : node;
    }
    // Types
    function createKeywordTypeNode(kind) {
        return createSynthesizedNode(kind);
    }
    ts.createKeywordTypeNode = createKeywordTypeNode;
    function createTypePredicateNode(parameterName, type) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypePredicate);
        node.parameterName = asName(parameterName);
        node.type = type;
        return node;
    }
    ts.createTypePredicateNode = createTypePredicateNode;
    function updateTypePredicateNode(node, parameterName, type) {
        return node.parameterName !== parameterName
            || node.type !== type
            ? updateNode(createTypePredicateNode(parameterName, type), node)
            : node;
    }
    ts.updateTypePredicateNode = updateTypePredicateNode;
    function createTypeReferenceNode(typeName, typeArguments) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeReference);
        node.typeName = asName(typeName);
        node.typeArguments = typeArguments && ts.parenthesizeTypeParameters(typeArguments);
        return node;
    }
    ts.createTypeReferenceNode = createTypeReferenceNode;
    function updateTypeReferenceNode(node, typeName, typeArguments) {
        return node.typeName !== typeName
            || node.typeArguments !== typeArguments
            ? updateNode(createTypeReferenceNode(typeName, typeArguments), node)
            : node;
    }
    ts.updateTypeReferenceNode = updateTypeReferenceNode;
    function createFunctionTypeNode(typeParameters, parameters, type) {
        return createSignatureDeclaration(ts.SyntaxKind.FunctionType, typeParameters, parameters, type);
    }
    ts.createFunctionTypeNode = createFunctionTypeNode;
    function updateFunctionTypeNode(node, typeParameters, parameters, type) {
        return updateSignatureDeclaration(node, typeParameters, parameters, type);
    }
    ts.updateFunctionTypeNode = updateFunctionTypeNode;
    function createConstructorTypeNode(typeParameters, parameters, type) {
        return createSignatureDeclaration(ts.SyntaxKind.ConstructorType, typeParameters, parameters, type);
    }
    ts.createConstructorTypeNode = createConstructorTypeNode;
    function updateConstructorTypeNode(node, typeParameters, parameters, type) {
        return updateSignatureDeclaration(node, typeParameters, parameters, type);
    }
    ts.updateConstructorTypeNode = updateConstructorTypeNode;
    function createTypeQueryNode(exprName) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeQuery);
        node.exprName = exprName;
        return node;
    }
    ts.createTypeQueryNode = createTypeQueryNode;
    function updateTypeQueryNode(node, exprName) {
        return node.exprName !== exprName
            ? updateNode(createTypeQueryNode(exprName), node)
            : node;
    }
    ts.updateTypeQueryNode = updateTypeQueryNode;
    function createTypeLiteralNode(members) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeLiteral);
        node.members = createNodeArray(members);
        return node;
    }
    ts.createTypeLiteralNode = createTypeLiteralNode;
    function updateTypeLiteralNode(node, members) {
        return node.members !== members
            ? updateNode(createTypeLiteralNode(members), node)
            : node;
    }
    ts.updateTypeLiteralNode = updateTypeLiteralNode;
    function createArrayTypeNode(elementType) {
        const node = createSynthesizedNode(ts.SyntaxKind.ArrayType);
        node.elementType = ts.parenthesizeArrayTypeMember(elementType);
        return node;
    }
    ts.createArrayTypeNode = createArrayTypeNode;
    function updateArrayTypeNode(node, elementType) {
        return node.elementType !== elementType
            ? updateNode(createArrayTypeNode(elementType), node)
            : node;
    }
    ts.updateArrayTypeNode = updateArrayTypeNode;
    function createTupleTypeNode(elementTypes) {
        const node = createSynthesizedNode(ts.SyntaxKind.TupleType);
        node.elementTypes = createNodeArray(elementTypes);
        return node;
    }
    ts.createTupleTypeNode = createTupleTypeNode;
    function updateTypleTypeNode(node, elementTypes) {
        return node.elementTypes !== elementTypes
            ? updateNode(createTupleTypeNode(elementTypes), node)
            : node;
    }
    ts.updateTypleTypeNode = updateTypleTypeNode;
    function createUnionTypeNode(types) {
        return createUnionOrIntersectionTypeNode(ts.SyntaxKind.UnionType, types);
    }
    ts.createUnionTypeNode = createUnionTypeNode;
    function updateUnionTypeNode(node, types) {
        return updateUnionOrIntersectionTypeNode(node, types);
    }
    ts.updateUnionTypeNode = updateUnionTypeNode;
    function createIntersectionTypeNode(types) {
        return createUnionOrIntersectionTypeNode(ts.SyntaxKind.IntersectionType, types);
    }
    ts.createIntersectionTypeNode = createIntersectionTypeNode;
    function updateIntersectionTypeNode(node, types) {
        return updateUnionOrIntersectionTypeNode(node, types);
    }
    ts.updateIntersectionTypeNode = updateIntersectionTypeNode;
    function createUnionOrIntersectionTypeNode(kind, types) {
        const node = createSynthesizedNode(kind);
        node.types = ts.parenthesizeElementTypeMembers(types);
        return node;
    }
    ts.createUnionOrIntersectionTypeNode = createUnionOrIntersectionTypeNode;
    function updateUnionOrIntersectionTypeNode(node, types) {
        return node.types !== types
            ? updateNode(createUnionOrIntersectionTypeNode(node.kind, types), node)
            : node;
    }
    function createConditionalTypeNode(checkType, extendsType, trueType, falseType) {
        const node = createSynthesizedNode(ts.SyntaxKind.ConditionalType);
        node.checkType = ts.parenthesizeConditionalTypeMember(checkType);
        node.extendsType = ts.parenthesizeConditionalTypeMember(extendsType);
        node.trueType = trueType;
        node.falseType = falseType;
        return node;
    }
    ts.createConditionalTypeNode = createConditionalTypeNode;
    function updateConditionalTypeNode(node, checkType, extendsType, trueType, falseType) {
        return node.checkType !== checkType
            || node.extendsType !== extendsType
            || node.trueType !== trueType
            || node.falseType !== falseType
            ? updateNode(createConditionalTypeNode(checkType, extendsType, trueType, falseType), node)
            : node;
    }
    ts.updateConditionalTypeNode = updateConditionalTypeNode;
    function createInferTypeNode(typeParameter) {
        const node = createSynthesizedNode(ts.SyntaxKind.InferType);
        node.typeParameter = typeParameter;
        return node;
    }
    ts.createInferTypeNode = createInferTypeNode;
    function updateInferTypeNode(node, typeParameter) {
        return node.typeParameter !== typeParameter
            ? updateNode(createInferTypeNode(typeParameter), node)
            : node;
    }
    ts.updateInferTypeNode = updateInferTypeNode;
    function createImportTypeNode(argument, qualifier, typeArguments, isTypeOf) {
        const node = createSynthesizedNode(ts.SyntaxKind.ImportType);
        node.argument = argument;
        node.qualifier = qualifier;
        node.typeArguments = asNodeArray(typeArguments);
        node.isTypeOf = isTypeOf;
        return node;
    }
    ts.createImportTypeNode = createImportTypeNode;
    function updateImportTypeNode(node, argument, qualifier, typeArguments, isTypeOf) {
        return node.argument !== argument
            || node.qualifier !== qualifier
            || node.typeArguments !== typeArguments
            || node.isTypeOf !== isTypeOf
            ? updateNode(createImportTypeNode(argument, qualifier, typeArguments, isTypeOf), node)
            : node;
    }
    ts.updateImportTypeNode = updateImportTypeNode;
    function createParenthesizedType(type) {
        const node = createSynthesizedNode(ts.SyntaxKind.ParenthesizedType);
        node.type = type;
        return node;
    }
    ts.createParenthesizedType = createParenthesizedType;
    function updateParenthesizedType(node, type) {
        return node.type !== type
            ? updateNode(createParenthesizedType(type), node)
            : node;
    }
    ts.updateParenthesizedType = updateParenthesizedType;
    function createThisTypeNode() {
        return createSynthesizedNode(ts.SyntaxKind.ThisType);
    }
    ts.createThisTypeNode = createThisTypeNode;
    function createTypeOperatorNode(operatorOrType, type) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeOperator);
        node.operator = typeof operatorOrType === "number" ? operatorOrType : ts.SyntaxKind.KeyOfKeyword;
        node.type = ts.parenthesizeElementTypeMember(typeof operatorOrType === "number" ? type : operatorOrType);
        return node;
    }
    ts.createTypeOperatorNode = createTypeOperatorNode;
    function updateTypeOperatorNode(node, type) {
        return node.type !== type ? updateNode(createTypeOperatorNode(node.operator, type), node) : node;
    }
    ts.updateTypeOperatorNode = updateTypeOperatorNode;
    function createIndexedAccessTypeNode(objectType, indexType) {
        const node = createSynthesizedNode(ts.SyntaxKind.IndexedAccessType);
        node.objectType = ts.parenthesizeElementTypeMember(objectType);
        node.indexType = indexType;
        return node;
    }
    ts.createIndexedAccessTypeNode = createIndexedAccessTypeNode;
    function updateIndexedAccessTypeNode(node, objectType, indexType) {
        return node.objectType !== objectType
            || node.indexType !== indexType
            ? updateNode(createIndexedAccessTypeNode(objectType, indexType), node)
            : node;
    }
    ts.updateIndexedAccessTypeNode = updateIndexedAccessTypeNode;
    function createMappedTypeNode(readonlyToken, typeParameter, questionToken, type) {
        const node = createSynthesizedNode(ts.SyntaxKind.MappedType);
        node.readonlyToken = readonlyToken;
        node.typeParameter = typeParameter;
        node.questionToken = questionToken;
        node.type = type;
        return node;
    }
    ts.createMappedTypeNode = createMappedTypeNode;
    function updateMappedTypeNode(node, readonlyToken, typeParameter, questionToken, type) {
        return node.readonlyToken !== readonlyToken
            || node.typeParameter !== typeParameter
            || node.questionToken !== questionToken
            || node.type !== type
            ? updateNode(createMappedTypeNode(readonlyToken, typeParameter, questionToken, type), node)
            : node;
    }
    ts.updateMappedTypeNode = updateMappedTypeNode;
    function createLiteralTypeNode(literal) {
        const node = createSynthesizedNode(ts.SyntaxKind.LiteralType);
        node.literal = literal;
        return node;
    }
    ts.createLiteralTypeNode = createLiteralTypeNode;
    function updateLiteralTypeNode(node, literal) {
        return node.literal !== literal
            ? updateNode(createLiteralTypeNode(literal), node)
            : node;
    }
    ts.updateLiteralTypeNode = updateLiteralTypeNode;
    // Binding Patterns
    function createObjectBindingPattern(elements) {
        const node = createSynthesizedNode(ts.SyntaxKind.ObjectBindingPattern);
        node.elements = createNodeArray(elements);
        return node;
    }
    ts.createObjectBindingPattern = createObjectBindingPattern;
    function updateObjectBindingPattern(node, elements) {
        return node.elements !== elements
            ? updateNode(createObjectBindingPattern(elements), node)
            : node;
    }
    ts.updateObjectBindingPattern = updateObjectBindingPattern;
    function createArrayBindingPattern(elements) {
        const node = createSynthesizedNode(ts.SyntaxKind.ArrayBindingPattern);
        node.elements = createNodeArray(elements);
        return node;
    }
    ts.createArrayBindingPattern = createArrayBindingPattern;
    function updateArrayBindingPattern(node, elements) {
        return node.elements !== elements
            ? updateNode(createArrayBindingPattern(elements), node)
            : node;
    }
    ts.updateArrayBindingPattern = updateArrayBindingPattern;
    function createBindingElement(dotDotDotToken, propertyName, name, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.BindingElement);
        node.dotDotDotToken = dotDotDotToken;
        node.propertyName = asName(propertyName);
        node.name = asName(name);
        node.initializer = initializer;
        return node;
    }
    ts.createBindingElement = createBindingElement;
    function updateBindingElement(node, dotDotDotToken, propertyName, name, initializer) {
        return node.propertyName !== propertyName
            || node.dotDotDotToken !== dotDotDotToken
            || node.name !== name
            || node.initializer !== initializer
            ? updateNode(createBindingElement(dotDotDotToken, propertyName, name, initializer), node)
            : node;
    }
    ts.updateBindingElement = updateBindingElement;
    // Expression
    function createArrayLiteral(elements, multiLine) {
        const node = createSynthesizedNode(ts.SyntaxKind.ArrayLiteralExpression);
        node.elements = ts.parenthesizeListElements(createNodeArray(elements));
        if (multiLine)
            node.multiLine = true;
        return node;
    }
    ts.createArrayLiteral = createArrayLiteral;
    function updateArrayLiteral(node, elements) {
        return node.elements !== elements
            ? updateNode(createArrayLiteral(elements, node.multiLine), node)
            : node;
    }
    ts.updateArrayLiteral = updateArrayLiteral;
    function createObjectLiteral(properties, multiLine) {
        const node = createSynthesizedNode(ts.SyntaxKind.ObjectLiteralExpression);
        node.properties = createNodeArray(properties);
        if (multiLine)
            node.multiLine = true;
        return node;
    }
    ts.createObjectLiteral = createObjectLiteral;
    function updateObjectLiteral(node, properties) {
        return node.properties !== properties
            ? updateNode(createObjectLiteral(properties, node.multiLine), node)
            : node;
    }
    ts.updateObjectLiteral = updateObjectLiteral;
    function createPropertyAccess(expression, name) {
        const node = createSynthesizedNode(ts.SyntaxKind.PropertyAccessExpression);
        node.expression = ts.parenthesizeForAccess(expression);
        node.name = asName(name);
        setEmitFlags(node, ts.EmitFlags.NoIndentation);
        return node;
    }
    ts.createPropertyAccess = createPropertyAccess;
    function updatePropertyAccess(node, expression, name) {
        // Because we are updating existed propertyAccess we want to inherit its emitFlags
        // instead of using the default from createPropertyAccess
        return node.expression !== expression
            || node.name !== name
            ? updateNode(setEmitFlags(createPropertyAccess(expression, name), ts.getEmitFlags(node)), node)
            : node;
    }
    ts.updatePropertyAccess = updatePropertyAccess;
    function createElementAccess(expression, index) {
        const node = createSynthesizedNode(ts.SyntaxKind.ElementAccessExpression);
        node.expression = ts.parenthesizeForAccess(expression);
        node.argumentExpression = asExpression(index);
        return node;
    }
    ts.createElementAccess = createElementAccess;
    function updateElementAccess(node, expression, argumentExpression) {
        return node.expression !== expression
            || node.argumentExpression !== argumentExpression
            ? updateNode(createElementAccess(expression, argumentExpression), node)
            : node;
    }
    ts.updateElementAccess = updateElementAccess;
    function createCall(expression, typeArguments, argumentsArray) {
        const node = createSynthesizedNode(ts.SyntaxKind.CallExpression);
        node.expression = ts.parenthesizeForAccess(expression);
        node.typeArguments = asNodeArray(typeArguments);
        node.arguments = ts.parenthesizeListElements(createNodeArray(argumentsArray));
        return node;
    }
    ts.createCall = createCall;
    function updateCall(node, expression, typeArguments, argumentsArray) {
        return node.expression !== expression
            || node.typeArguments !== typeArguments
            || node.arguments !== argumentsArray
            ? updateNode(createCall(expression, typeArguments, argumentsArray), node)
            : node;
    }
    ts.updateCall = updateCall;
    function createNew(expression, typeArguments, argumentsArray) {
        const node = createSynthesizedNode(ts.SyntaxKind.NewExpression);
        node.expression = ts.parenthesizeForNew(expression);
        node.typeArguments = asNodeArray(typeArguments);
        node.arguments = argumentsArray ? ts.parenthesizeListElements(createNodeArray(argumentsArray)) : undefined;
        return node;
    }
    ts.createNew = createNew;
    function updateNew(node, expression, typeArguments, argumentsArray) {
        return node.expression !== expression
            || node.typeArguments !== typeArguments
            || node.arguments !== argumentsArray
            ? updateNode(createNew(expression, typeArguments, argumentsArray), node)
            : node;
    }
    ts.updateNew = updateNew;
    function createTaggedTemplate(tag, typeArgumentsOrTemplate, template) {
        const node = createSynthesizedNode(ts.SyntaxKind.TaggedTemplateExpression);
        node.tag = ts.parenthesizeForAccess(tag);
        if (template) {
            node.typeArguments = asNodeArray(typeArgumentsOrTemplate);
            node.template = template;
        }
        else {
            node.typeArguments = undefined;
            node.template = typeArgumentsOrTemplate;
        }
        return node;
    }
    ts.createTaggedTemplate = createTaggedTemplate;
    function updateTaggedTemplate(node, tag, typeArgumentsOrTemplate, template) {
        return node.tag !== tag
            || (template
                ? node.typeArguments !== typeArgumentsOrTemplate || node.template !== template
                : node.typeArguments !== undefined || node.template !== typeArgumentsOrTemplate)
            ? updateNode(createTaggedTemplate(tag, typeArgumentsOrTemplate, template), node)
            : node;
    }
    ts.updateTaggedTemplate = updateTaggedTemplate;
    function createTypeAssertion(type, expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeAssertionExpression);
        node.type = type;
        node.expression = ts.parenthesizePrefixOperand(expression);
        return node;
    }
    ts.createTypeAssertion = createTypeAssertion;
    function updateTypeAssertion(node, type, expression) {
        return node.type !== type
            || node.expression !== expression
            ? updateNode(createTypeAssertion(type, expression), node)
            : node;
    }
    ts.updateTypeAssertion = updateTypeAssertion;
    function createParen(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ParenthesizedExpression);
        node.expression = expression;
        return node;
    }
    ts.createParen = createParen;
    function updateParen(node, expression) {
        return node.expression !== expression
            ? updateNode(createParen(expression), node)
            : node;
    }
    ts.updateParen = updateParen;
    function createFunctionExpression(modifiers, asteriskToken, name, typeParameters, parameters, type, body) {
        const node = createSynthesizedNode(ts.SyntaxKind.FunctionExpression);
        node.modifiers = asNodeArray(modifiers);
        node.asteriskToken = asteriskToken;
        node.name = asName(name);
        node.typeParameters = asNodeArray(typeParameters);
        node.parameters = createNodeArray(parameters);
        node.type = type;
        node.body = body;
        return node;
    }
    ts.createFunctionExpression = createFunctionExpression;
    function updateFunctionExpression(node, modifiers, asteriskToken, name, typeParameters, parameters, type, body) {
        return node.name !== name
            || node.modifiers !== modifiers
            || node.asteriskToken !== asteriskToken
            || node.typeParameters !== typeParameters
            || node.parameters !== parameters
            || node.type !== type
            || node.body !== body
            ? updateNode(createFunctionExpression(modifiers, asteriskToken, name, typeParameters, parameters, type, body), node)
            : node;
    }
    ts.updateFunctionExpression = updateFunctionExpression;
    function createArrowFunction(modifiers, typeParameters, parameters, type, equalsGreaterThanToken, body) {
        const node = createSynthesizedNode(ts.SyntaxKind.ArrowFunction);
        node.modifiers = asNodeArray(modifiers);
        node.typeParameters = asNodeArray(typeParameters);
        node.parameters = createNodeArray(parameters);
        node.type = type;
        node.equalsGreaterThanToken = equalsGreaterThanToken || createToken(ts.SyntaxKind.EqualsGreaterThanToken);
        node.body = ts.parenthesizeConciseBody(body);
        return node;
    }
    ts.createArrowFunction = createArrowFunction;
    function updateArrowFunction(node, modifiers, typeParameters, parameters, type, equalsGreaterThanTokenOrBody, bodyOrUndefined) {
        let equalsGreaterThanToken;
        let body;
        if (bodyOrUndefined === undefined) {
            equalsGreaterThanToken = node.equalsGreaterThanToken;
            body = ts.cast(equalsGreaterThanTokenOrBody, ts.isConciseBody);
        }
        else {
            equalsGreaterThanToken = ts.cast(equalsGreaterThanTokenOrBody, (n) => n.kind === ts.SyntaxKind.EqualsGreaterThanToken);
            body = bodyOrUndefined;
        }
        return node.modifiers !== modifiers
            || node.typeParameters !== typeParameters
            || node.parameters !== parameters
            || node.type !== type
            || node.equalsGreaterThanToken !== equalsGreaterThanToken
            || node.body !== body
            ? updateNode(createArrowFunction(modifiers, typeParameters, parameters, type, equalsGreaterThanToken, body), node)
            : node;
    }
    ts.updateArrowFunction = updateArrowFunction;
    function createDelete(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.DeleteExpression);
        node.expression = ts.parenthesizePrefixOperand(expression);
        return node;
    }
    ts.createDelete = createDelete;
    function updateDelete(node, expression) {
        return node.expression !== expression
            ? updateNode(createDelete(expression), node)
            : node;
    }
    ts.updateDelete = updateDelete;
    function createTypeOf(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeOfExpression);
        node.expression = ts.parenthesizePrefixOperand(expression);
        return node;
    }
    ts.createTypeOf = createTypeOf;
    function updateTypeOf(node, expression) {
        return node.expression !== expression
            ? updateNode(createTypeOf(expression), node)
            : node;
    }
    ts.updateTypeOf = updateTypeOf;
    function createVoid(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.VoidExpression);
        node.expression = ts.parenthesizePrefixOperand(expression);
        return node;
    }
    ts.createVoid = createVoid;
    function updateVoid(node, expression) {
        return node.expression !== expression
            ? updateNode(createVoid(expression), node)
            : node;
    }
    ts.updateVoid = updateVoid;
    function createAwait(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.AwaitExpression);
        node.expression = ts.parenthesizePrefixOperand(expression);
        return node;
    }
    ts.createAwait = createAwait;
    function updateAwait(node, expression) {
        return node.expression !== expression
            ? updateNode(createAwait(expression), node)
            : node;
    }
    ts.updateAwait = updateAwait;
    function createPrefix(operator, operand) {
        const node = createSynthesizedNode(ts.SyntaxKind.PrefixUnaryExpression);
        node.operator = operator;
        node.operand = ts.parenthesizePrefixOperand(operand);
        return node;
    }
    ts.createPrefix = createPrefix;
    function updatePrefix(node, operand) {
        return node.operand !== operand
            ? updateNode(createPrefix(node.operator, operand), node)
            : node;
    }
    ts.updatePrefix = updatePrefix;
    function createPostfix(operand, operator) {
        const node = createSynthesizedNode(ts.SyntaxKind.PostfixUnaryExpression);
        node.operand = ts.parenthesizePostfixOperand(operand);
        node.operator = operator;
        return node;
    }
    ts.createPostfix = createPostfix;
    function updatePostfix(node, operand) {
        return node.operand !== operand
            ? updateNode(createPostfix(operand, node.operator), node)
            : node;
    }
    ts.updatePostfix = updatePostfix;
    function createBinary(left, operator, right) {
        const node = createSynthesizedNode(ts.SyntaxKind.BinaryExpression);
        const operatorToken = asToken(operator);
        const operatorKind = operatorToken.kind;
        node.left = ts.parenthesizeBinaryOperand(operatorKind, left, /*isLeftSideOfBinary*/ true, /*leftOperand*/ undefined);
        node.operatorToken = operatorToken;
        node.right = ts.parenthesizeBinaryOperand(operatorKind, right, /*isLeftSideOfBinary*/ false, node.left);
        return node;
    }
    ts.createBinary = createBinary;
    function updateBinary(node, left, right, operator) {
        return node.left !== left
            || node.right !== right
            ? updateNode(createBinary(left, operator || node.operatorToken, right), node)
            : node;
    }
    ts.updateBinary = updateBinary;
    function createConditional(condition, questionTokenOrWhenTrue, whenTrueOrWhenFalse, colonToken, whenFalse) {
        const node = createSynthesizedNode(ts.SyntaxKind.ConditionalExpression);
        node.condition = ts.parenthesizeForConditionalHead(condition);
        node.questionToken = whenFalse ? questionTokenOrWhenTrue : createToken(ts.SyntaxKind.QuestionToken);
        node.whenTrue = ts.parenthesizeSubexpressionOfConditionalExpression(whenFalse ? whenTrueOrWhenFalse : questionTokenOrWhenTrue);
        node.colonToken = whenFalse ? colonToken : createToken(ts.SyntaxKind.ColonToken);
        node.whenFalse = ts.parenthesizeSubexpressionOfConditionalExpression(whenFalse ? whenFalse : whenTrueOrWhenFalse);
        return node;
    }
    ts.createConditional = createConditional;
    function updateConditional(node, condition, ...args) {
        if (args.length === 2) {
            const [whenTrue, whenFalse] = args;
            return updateConditional(node, condition, node.questionToken, whenTrue, node.colonToken, whenFalse);
        }
        ts.Debug.assert(args.length === 4);
        const [questionToken, whenTrue, colonToken, whenFalse] = args;
        return node.condition !== condition
            || node.questionToken !== questionToken
            || node.whenTrue !== whenTrue
            || node.colonToken !== colonToken
            || node.whenFalse !== whenFalse
            ? updateNode(createConditional(condition, questionToken, whenTrue, colonToken, whenFalse), node)
            : node;
    }
    ts.updateConditional = updateConditional;
    function createTemplateExpression(head, templateSpans) {
        const node = createSynthesizedNode(ts.SyntaxKind.TemplateExpression);
        node.head = head;
        node.templateSpans = createNodeArray(templateSpans);
        return node;
    }
    ts.createTemplateExpression = createTemplateExpression;
    function updateTemplateExpression(node, head, templateSpans) {
        return node.head !== head
            || node.templateSpans !== templateSpans
            ? updateNode(createTemplateExpression(head, templateSpans), node)
            : node;
    }
    ts.updateTemplateExpression = updateTemplateExpression;
    function createTemplateHead(text) {
        const node = createSynthesizedNode(ts.SyntaxKind.TemplateHead);
        node.text = text;
        return node;
    }
    ts.createTemplateHead = createTemplateHead;
    function createTemplateMiddle(text) {
        const node = createSynthesizedNode(ts.SyntaxKind.TemplateMiddle);
        node.text = text;
        return node;
    }
    ts.createTemplateMiddle = createTemplateMiddle;
    function createTemplateTail(text) {
        const node = createSynthesizedNode(ts.SyntaxKind.TemplateTail);
        node.text = text;
        return node;
    }
    ts.createTemplateTail = createTemplateTail;
    function createNoSubstitutionTemplateLiteral(text) {
        const node = createSynthesizedNode(ts.SyntaxKind.NoSubstitutionTemplateLiteral);
        node.text = text;
        return node;
    }
    ts.createNoSubstitutionTemplateLiteral = createNoSubstitutionTemplateLiteral;
    function createYield(asteriskTokenOrExpression, expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.YieldExpression);
        node.asteriskToken = asteriskTokenOrExpression && asteriskTokenOrExpression.kind === ts.SyntaxKind.AsteriskToken ? asteriskTokenOrExpression : undefined;
        node.expression = asteriskTokenOrExpression && asteriskTokenOrExpression.kind !== ts.SyntaxKind.AsteriskToken ? asteriskTokenOrExpression : expression;
        return node;
    }
    ts.createYield = createYield;
    function updateYield(node, asteriskToken, expression) {
        return node.expression !== expression
            || node.asteriskToken !== asteriskToken
            ? updateNode(createYield(asteriskToken, expression), node)
            : node;
    }
    ts.updateYield = updateYield;
    function createSpread(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.SpreadElement);
        node.expression = ts.parenthesizeExpressionForList(expression);
        return node;
    }
    ts.createSpread = createSpread;
    function updateSpread(node, expression) {
        return node.expression !== expression
            ? updateNode(createSpread(expression), node)
            : node;
    }
    ts.updateSpread = updateSpread;
    function createClassExpression(modifiers, name, typeParameters, heritageClauses, members) {
        const node = createSynthesizedNode(ts.SyntaxKind.ClassExpression);
        node.decorators = undefined;
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.typeParameters = asNodeArray(typeParameters);
        node.heritageClauses = asNodeArray(heritageClauses);
        node.members = createNodeArray(members);
        return node;
    }
    ts.createClassExpression = createClassExpression;
    function updateClassExpression(node, modifiers, name, typeParameters, heritageClauses, members) {
        return node.modifiers !== modifiers
            || node.name !== name
            || node.typeParameters !== typeParameters
            || node.heritageClauses !== heritageClauses
            || node.members !== members
            ? updateNode(createClassExpression(modifiers, name, typeParameters, heritageClauses, members), node)
            : node;
    }
    ts.updateClassExpression = updateClassExpression;
    function createOmittedExpression() {
        return createSynthesizedNode(ts.SyntaxKind.OmittedExpression);
    }
    ts.createOmittedExpression = createOmittedExpression;
    function createExpressionWithTypeArguments(typeArguments, expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ExpressionWithTypeArguments);
        node.expression = ts.parenthesizeForAccess(expression);
        node.typeArguments = asNodeArray(typeArguments);
        return node;
    }
    ts.createExpressionWithTypeArguments = createExpressionWithTypeArguments;
    function updateExpressionWithTypeArguments(node, typeArguments, expression) {
        return node.typeArguments !== typeArguments
            || node.expression !== expression
            ? updateNode(createExpressionWithTypeArguments(typeArguments, expression), node)
            : node;
    }
    ts.updateExpressionWithTypeArguments = updateExpressionWithTypeArguments;
    function createAsExpression(expression, type) {
        const node = createSynthesizedNode(ts.SyntaxKind.AsExpression);
        node.expression = expression;
        node.type = type;
        return node;
    }
    ts.createAsExpression = createAsExpression;
    function updateAsExpression(node, expression, type) {
        return node.expression !== expression
            || node.type !== type
            ? updateNode(createAsExpression(expression, type), node)
            : node;
    }
    ts.updateAsExpression = updateAsExpression;
    function createNonNullExpression(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.NonNullExpression);
        node.expression = ts.parenthesizeForAccess(expression);
        return node;
    }
    ts.createNonNullExpression = createNonNullExpression;
    function updateNonNullExpression(node, expression) {
        return node.expression !== expression
            ? updateNode(createNonNullExpression(expression), node)
            : node;
    }
    ts.updateNonNullExpression = updateNonNullExpression;
    function createMetaProperty(keywordToken, name) {
        const node = createSynthesizedNode(ts.SyntaxKind.MetaProperty);
        node.keywordToken = keywordToken;
        node.name = name;
        return node;
    }
    ts.createMetaProperty = createMetaProperty;
    function updateMetaProperty(node, name) {
        return node.name !== name
            ? updateNode(createMetaProperty(node.keywordToken, name), node)
            : node;
    }
    ts.updateMetaProperty = updateMetaProperty;
    // Misc
    function createTemplateSpan(expression, literal) {
        const node = createSynthesizedNode(ts.SyntaxKind.TemplateSpan);
        node.expression = expression;
        node.literal = literal;
        return node;
    }
    ts.createTemplateSpan = createTemplateSpan;
    function updateTemplateSpan(node, expression, literal) {
        return node.expression !== expression
            || node.literal !== literal
            ? updateNode(createTemplateSpan(expression, literal), node)
            : node;
    }
    ts.updateTemplateSpan = updateTemplateSpan;
    function createSemicolonClassElement() {
        return createSynthesizedNode(ts.SyntaxKind.SemicolonClassElement);
    }
    ts.createSemicolonClassElement = createSemicolonClassElement;
    // Element
    function createBlock(statements, multiLine) {
        const block = createSynthesizedNode(ts.SyntaxKind.Block);
        block.statements = createNodeArray(statements);
        if (multiLine)
            block.multiLine = multiLine;
        return block;
    }
    ts.createBlock = createBlock;
    function updateBlock(node, statements) {
        return node.statements !== statements
            ? updateNode(createBlock(statements, node.multiLine), node)
            : node;
    }
    ts.updateBlock = updateBlock;
    function createVariableStatement(modifiers, declarationList) {
        const node = createSynthesizedNode(ts.SyntaxKind.VariableStatement);
        node.decorators = undefined;
        node.modifiers = asNodeArray(modifiers);
        node.declarationList = ts.isArray(declarationList) ? createVariableDeclarationList(declarationList) : declarationList;
        return node;
    }
    ts.createVariableStatement = createVariableStatement;
    function updateVariableStatement(node, modifiers, declarationList) {
        return node.modifiers !== modifiers
            || node.declarationList !== declarationList
            ? updateNode(createVariableStatement(modifiers, declarationList), node)
            : node;
    }
    ts.updateVariableStatement = updateVariableStatement;
    function createEmptyStatement() {
        return createSynthesizedNode(ts.SyntaxKind.EmptyStatement);
    }
    ts.createEmptyStatement = createEmptyStatement;
    function createStatement(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ExpressionStatement);
        node.expression = ts.parenthesizeExpressionForExpressionStatement(expression);
        return node;
    }
    ts.createStatement = createStatement;
    function updateStatement(node, expression) {
        return node.expression !== expression
            ? updateNode(createStatement(expression), node)
            : node;
    }
    ts.updateStatement = updateStatement;
    function createIf(expression, thenStatement, elseStatement) {
        const node = createSynthesizedNode(ts.SyntaxKind.IfStatement);
        node.expression = expression;
        node.thenStatement = thenStatement;
        node.elseStatement = elseStatement;
        return node;
    }
    ts.createIf = createIf;
    function updateIf(node, expression, thenStatement, elseStatement) {
        return node.expression !== expression
            || node.thenStatement !== thenStatement
            || node.elseStatement !== elseStatement
            ? updateNode(createIf(expression, thenStatement, elseStatement), node)
            : node;
    }
    ts.updateIf = updateIf;
    function createDo(statement, expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.DoStatement);
        node.statement = statement;
        node.expression = expression;
        return node;
    }
    ts.createDo = createDo;
    function updateDo(node, statement, expression) {
        return node.statement !== statement
            || node.expression !== expression
            ? updateNode(createDo(statement, expression), node)
            : node;
    }
    ts.updateDo = updateDo;
    function createWhile(expression, statement) {
        const node = createSynthesizedNode(ts.SyntaxKind.WhileStatement);
        node.expression = expression;
        node.statement = statement;
        return node;
    }
    ts.createWhile = createWhile;
    function updateWhile(node, expression, statement) {
        return node.expression !== expression
            || node.statement !== statement
            ? updateNode(createWhile(expression, statement), node)
            : node;
    }
    ts.updateWhile = updateWhile;
    function createFor(initializer, condition, incrementor, statement) {
        const node = createSynthesizedNode(ts.SyntaxKind.ForStatement);
        node.initializer = initializer;
        node.condition = condition;
        node.incrementor = incrementor;
        node.statement = statement;
        return node;
    }
    ts.createFor = createFor;
    function updateFor(node, initializer, condition, incrementor, statement) {
        return node.initializer !== initializer
            || node.condition !== condition
            || node.incrementor !== incrementor
            || node.statement !== statement
            ? updateNode(createFor(initializer, condition, incrementor, statement), node)
            : node;
    }
    ts.updateFor = updateFor;
    function createForIn(initializer, expression, statement) {
        const node = createSynthesizedNode(ts.SyntaxKind.ForInStatement);
        node.initializer = initializer;
        node.expression = expression;
        node.statement = statement;
        return node;
    }
    ts.createForIn = createForIn;
    function updateForIn(node, initializer, expression, statement) {
        return node.initializer !== initializer
            || node.expression !== expression
            || node.statement !== statement
            ? updateNode(createForIn(initializer, expression, statement), node)
            : node;
    }
    ts.updateForIn = updateForIn;
    function createForOf(awaitModifier, initializer, expression, statement) {
        const node = createSynthesizedNode(ts.SyntaxKind.ForOfStatement);
        node.awaitModifier = awaitModifier;
        node.initializer = initializer;
        node.expression = expression;
        node.statement = statement;
        return node;
    }
    ts.createForOf = createForOf;
    function updateForOf(node, awaitModifier, initializer, expression, statement) {
        return node.awaitModifier !== awaitModifier
            || node.initializer !== initializer
            || node.expression !== expression
            || node.statement !== statement
            ? updateNode(createForOf(awaitModifier, initializer, expression, statement), node)
            : node;
    }
    ts.updateForOf = updateForOf;
    function createContinue(label) {
        const node = createSynthesizedNode(ts.SyntaxKind.ContinueStatement);
        node.label = asName(label);
        return node;
    }
    ts.createContinue = createContinue;
    function updateContinue(node, label) {
        return node.label !== label
            ? updateNode(createContinue(label), node)
            : node;
    }
    ts.updateContinue = updateContinue;
    function createBreak(label) {
        const node = createSynthesizedNode(ts.SyntaxKind.BreakStatement);
        node.label = asName(label);
        return node;
    }
    ts.createBreak = createBreak;
    function updateBreak(node, label) {
        return node.label !== label
            ? updateNode(createBreak(label), node)
            : node;
    }
    ts.updateBreak = updateBreak;
    function createReturn(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ReturnStatement);
        node.expression = expression;
        return node;
    }
    ts.createReturn = createReturn;
    function updateReturn(node, expression) {
        return node.expression !== expression
            ? updateNode(createReturn(expression), node)
            : node;
    }
    ts.updateReturn = updateReturn;
    function createWith(expression, statement) {
        const node = createSynthesizedNode(ts.SyntaxKind.WithStatement);
        node.expression = expression;
        node.statement = statement;
        return node;
    }
    ts.createWith = createWith;
    function updateWith(node, expression, statement) {
        return node.expression !== expression
            || node.statement !== statement
            ? updateNode(createWith(expression, statement), node)
            : node;
    }
    ts.updateWith = updateWith;
    function createSwitch(expression, caseBlock) {
        const node = createSynthesizedNode(ts.SyntaxKind.SwitchStatement);
        node.expression = ts.parenthesizeExpressionForList(expression);
        node.caseBlock = caseBlock;
        return node;
    }
    ts.createSwitch = createSwitch;
    function updateSwitch(node, expression, caseBlock) {
        return node.expression !== expression
            || node.caseBlock !== caseBlock
            ? updateNode(createSwitch(expression, caseBlock), node)
            : node;
    }
    ts.updateSwitch = updateSwitch;
    function createLabel(label, statement) {
        const node = createSynthesizedNode(ts.SyntaxKind.LabeledStatement);
        node.label = asName(label);
        node.statement = statement;
        return node;
    }
    ts.createLabel = createLabel;
    function updateLabel(node, label, statement) {
        return node.label !== label
            || node.statement !== statement
            ? updateNode(createLabel(label, statement), node)
            : node;
    }
    ts.updateLabel = updateLabel;
    function createThrow(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ThrowStatement);
        node.expression = expression;
        return node;
    }
    ts.createThrow = createThrow;
    function updateThrow(node, expression) {
        return node.expression !== expression
            ? updateNode(createThrow(expression), node)
            : node;
    }
    ts.updateThrow = updateThrow;
    function createTry(tryBlock, catchClause, finallyBlock) {
        const node = createSynthesizedNode(ts.SyntaxKind.TryStatement);
        node.tryBlock = tryBlock;
        node.catchClause = catchClause;
        node.finallyBlock = finallyBlock;
        return node;
    }
    ts.createTry = createTry;
    function updateTry(node, tryBlock, catchClause, finallyBlock) {
        return node.tryBlock !== tryBlock
            || node.catchClause !== catchClause
            || node.finallyBlock !== finallyBlock
            ? updateNode(createTry(tryBlock, catchClause, finallyBlock), node)
            : node;
    }
    ts.updateTry = updateTry;
    function createDebuggerStatement() {
        return createSynthesizedNode(ts.SyntaxKind.DebuggerStatement);
    }
    ts.createDebuggerStatement = createDebuggerStatement;
    function createVariableDeclaration(name, type, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.VariableDeclaration);
        node.name = asName(name);
        node.type = type;
        node.initializer = initializer !== undefined ? ts.parenthesizeExpressionForList(initializer) : undefined;
        return node;
    }
    ts.createVariableDeclaration = createVariableDeclaration;
    function updateVariableDeclaration(node, name, type, initializer) {
        return node.name !== name
            || node.type !== type
            || node.initializer !== initializer
            ? updateNode(createVariableDeclaration(name, type, initializer), node)
            : node;
    }
    ts.updateVariableDeclaration = updateVariableDeclaration;
    function createVariableDeclarationList(declarations, flags) {
        const node = createSynthesizedNode(ts.SyntaxKind.VariableDeclarationList);
        node.flags |= flags & ts.NodeFlags.BlockScoped;
        node.declarations = createNodeArray(declarations);
        return node;
    }
    ts.createVariableDeclarationList = createVariableDeclarationList;
    function updateVariableDeclarationList(node, declarations) {
        return node.declarations !== declarations
            ? updateNode(createVariableDeclarationList(declarations, node.flags), node)
            : node;
    }
    ts.updateVariableDeclarationList = updateVariableDeclarationList;
    function createFunctionDeclaration(decorators, modifiers, asteriskToken, name, typeParameters, parameters, type, body) {
        const node = createSynthesizedNode(ts.SyntaxKind.FunctionDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.asteriskToken = asteriskToken;
        node.name = asName(name);
        node.typeParameters = asNodeArray(typeParameters);
        node.parameters = createNodeArray(parameters);
        node.type = type;
        node.body = body;
        return node;
    }
    ts.createFunctionDeclaration = createFunctionDeclaration;
    function updateFunctionDeclaration(node, decorators, modifiers, asteriskToken, name, typeParameters, parameters, type, body) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.asteriskToken !== asteriskToken
            || node.name !== name
            || node.typeParameters !== typeParameters
            || node.parameters !== parameters
            || node.type !== type
            || node.body !== body
            ? updateNode(createFunctionDeclaration(decorators, modifiers, asteriskToken, name, typeParameters, parameters, type, body), node)
            : node;
    }
    ts.updateFunctionDeclaration = updateFunctionDeclaration;
    function createClassDeclaration(decorators, modifiers, name, typeParameters, heritageClauses, members) {
        const node = createSynthesizedNode(ts.SyntaxKind.ClassDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.typeParameters = asNodeArray(typeParameters);
        node.heritageClauses = asNodeArray(heritageClauses);
        node.members = createNodeArray(members);
        return node;
    }
    ts.createClassDeclaration = createClassDeclaration;
    function updateClassDeclaration(node, decorators, modifiers, name, typeParameters, heritageClauses, members) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.typeParameters !== typeParameters
            || node.heritageClauses !== heritageClauses
            || node.members !== members
            ? updateNode(createClassDeclaration(decorators, modifiers, name, typeParameters, heritageClauses, members), node)
            : node;
    }
    ts.updateClassDeclaration = updateClassDeclaration;
    function createInterfaceDeclaration(decorators, modifiers, name, typeParameters, heritageClauses, members) {
        const node = createSynthesizedNode(ts.SyntaxKind.InterfaceDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.typeParameters = asNodeArray(typeParameters);
        node.heritageClauses = asNodeArray(heritageClauses);
        node.members = createNodeArray(members);
        return node;
    }
    ts.createInterfaceDeclaration = createInterfaceDeclaration;
    function updateInterfaceDeclaration(node, decorators, modifiers, name, typeParameters, heritageClauses, members) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.typeParameters !== typeParameters
            || node.heritageClauses !== heritageClauses
            || node.members !== members
            ? updateNode(createInterfaceDeclaration(decorators, modifiers, name, typeParameters, heritageClauses, members), node)
            : node;
    }
    ts.updateInterfaceDeclaration = updateInterfaceDeclaration;
    function createTypeAliasDeclaration(decorators, modifiers, name, typeParameters, type) {
        const node = createSynthesizedNode(ts.SyntaxKind.TypeAliasDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.typeParameters = asNodeArray(typeParameters);
        node.type = type;
        return node;
    }
    ts.createTypeAliasDeclaration = createTypeAliasDeclaration;
    function updateTypeAliasDeclaration(node, decorators, modifiers, name, typeParameters, type) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.typeParameters !== typeParameters
            || node.type !== type
            ? updateNode(createTypeAliasDeclaration(decorators, modifiers, name, typeParameters, type), node)
            : node;
    }
    ts.updateTypeAliasDeclaration = updateTypeAliasDeclaration;
    function createEnumDeclaration(decorators, modifiers, name, members) {
        const node = createSynthesizedNode(ts.SyntaxKind.EnumDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.members = createNodeArray(members);
        return node;
    }
    ts.createEnumDeclaration = createEnumDeclaration;
    function updateEnumDeclaration(node, decorators, modifiers, name, members) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.members !== members
            ? updateNode(createEnumDeclaration(decorators, modifiers, name, members), node)
            : node;
    }
    ts.updateEnumDeclaration = updateEnumDeclaration;
    function createModuleDeclaration(decorators, modifiers, name, body, flags) {
        const node = createSynthesizedNode(ts.SyntaxKind.ModuleDeclaration);
        node.flags |= flags & (ts.NodeFlags.Namespace | ts.NodeFlags.NestedNamespace | ts.NodeFlags.GlobalAugmentation);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = name;
        node.body = body;
        return node;
    }
    ts.createModuleDeclaration = createModuleDeclaration;
    function updateModuleDeclaration(node, decorators, modifiers, name, body) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.body !== body
            ? updateNode(createModuleDeclaration(decorators, modifiers, name, body, node.flags), node)
            : node;
    }
    ts.updateModuleDeclaration = updateModuleDeclaration;
    function createModuleBlock(statements) {
        const node = createSynthesizedNode(ts.SyntaxKind.ModuleBlock);
        node.statements = createNodeArray(statements);
        return node;
    }
    ts.createModuleBlock = createModuleBlock;
    function updateModuleBlock(node, statements) {
        return node.statements !== statements
            ? updateNode(createModuleBlock(statements), node)
            : node;
    }
    ts.updateModuleBlock = updateModuleBlock;
    function createCaseBlock(clauses) {
        const node = createSynthesizedNode(ts.SyntaxKind.CaseBlock);
        node.clauses = createNodeArray(clauses);
        return node;
    }
    ts.createCaseBlock = createCaseBlock;
    function updateCaseBlock(node, clauses) {
        return node.clauses !== clauses
            ? updateNode(createCaseBlock(clauses), node)
            : node;
    }
    ts.updateCaseBlock = updateCaseBlock;
    function createNamespaceExportDeclaration(name) {
        const node = createSynthesizedNode(ts.SyntaxKind.NamespaceExportDeclaration);
        node.name = asName(name);
        return node;
    }
    ts.createNamespaceExportDeclaration = createNamespaceExportDeclaration;
    function updateNamespaceExportDeclaration(node, name) {
        return node.name !== name
            ? updateNode(createNamespaceExportDeclaration(name), node)
            : node;
    }
    ts.updateNamespaceExportDeclaration = updateNamespaceExportDeclaration;
    function createImportEqualsDeclaration(decorators, modifiers, name, moduleReference) {
        const node = createSynthesizedNode(ts.SyntaxKind.ImportEqualsDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.name = asName(name);
        node.moduleReference = moduleReference;
        return node;
    }
    ts.createImportEqualsDeclaration = createImportEqualsDeclaration;
    function updateImportEqualsDeclaration(node, decorators, modifiers, name, moduleReference) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.name !== name
            || node.moduleReference !== moduleReference
            ? updateNode(createImportEqualsDeclaration(decorators, modifiers, name, moduleReference), node)
            : node;
    }
    ts.updateImportEqualsDeclaration = updateImportEqualsDeclaration;
    function createImportDeclaration(decorators, modifiers, importClause, moduleSpecifier) {
        const node = createSynthesizedNode(ts.SyntaxKind.ImportDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.importClause = importClause;
        node.moduleSpecifier = moduleSpecifier;
        return node;
    }
    ts.createImportDeclaration = createImportDeclaration;
    function updateImportDeclaration(node, decorators, modifiers, importClause, moduleSpecifier) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.importClause !== importClause
            || node.moduleSpecifier !== moduleSpecifier
            ? updateNode(createImportDeclaration(decorators, modifiers, importClause, moduleSpecifier), node)
            : node;
    }
    ts.updateImportDeclaration = updateImportDeclaration;
    function createImportClause(name, namedBindings) {
        const node = createSynthesizedNode(ts.SyntaxKind.ImportClause);
        node.name = name;
        node.namedBindings = namedBindings;
        return node;
    }
    ts.createImportClause = createImportClause;
    function updateImportClause(node, name, namedBindings) {
        return node.name !== name
            || node.namedBindings !== namedBindings
            ? updateNode(createImportClause(name, namedBindings), node)
            : node;
    }
    ts.updateImportClause = updateImportClause;
    function createNamespaceImport(name) {
        const node = createSynthesizedNode(ts.SyntaxKind.NamespaceImport);
        node.name = name;
        return node;
    }
    ts.createNamespaceImport = createNamespaceImport;
    function updateNamespaceImport(node, name) {
        return node.name !== name
            ? updateNode(createNamespaceImport(name), node)
            : node;
    }
    ts.updateNamespaceImport = updateNamespaceImport;
    function createNamedImports(elements) {
        const node = createSynthesizedNode(ts.SyntaxKind.NamedImports);
        node.elements = createNodeArray(elements);
        return node;
    }
    ts.createNamedImports = createNamedImports;
    function updateNamedImports(node, elements) {
        return node.elements !== elements
            ? updateNode(createNamedImports(elements), node)
            : node;
    }
    ts.updateNamedImports = updateNamedImports;
    function createImportSpecifier(propertyName, name) {
        const node = createSynthesizedNode(ts.SyntaxKind.ImportSpecifier);
        node.propertyName = propertyName;
        node.name = name;
        return node;
    }
    ts.createImportSpecifier = createImportSpecifier;
    function updateImportSpecifier(node, propertyName, name) {
        return node.propertyName !== propertyName
            || node.name !== name
            ? updateNode(createImportSpecifier(propertyName, name), node)
            : node;
    }
    ts.updateImportSpecifier = updateImportSpecifier;
    function createExportAssignment(decorators, modifiers, isExportEquals, expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ExportAssignment);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.isExportEquals = isExportEquals;
        node.expression = isExportEquals ? ts.parenthesizeBinaryOperand(ts.SyntaxKind.EqualsToken, expression, /*isLeftSideOfBinary*/ false, /*leftOperand*/ undefined) : ts.parenthesizeDefaultExpression(expression);
        return node;
    }
    ts.createExportAssignment = createExportAssignment;
    function updateExportAssignment(node, decorators, modifiers, expression) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.expression !== expression
            ? updateNode(createExportAssignment(decorators, modifiers, node.isExportEquals, expression), node)
            : node;
    }
    ts.updateExportAssignment = updateExportAssignment;
    function createExportDeclaration(decorators, modifiers, exportClause, moduleSpecifier) {
        const node = createSynthesizedNode(ts.SyntaxKind.ExportDeclaration);
        node.decorators = asNodeArray(decorators);
        node.modifiers = asNodeArray(modifiers);
        node.exportClause = exportClause;
        node.moduleSpecifier = moduleSpecifier;
        return node;
    }
    ts.createExportDeclaration = createExportDeclaration;
    function updateExportDeclaration(node, decorators, modifiers, exportClause, moduleSpecifier) {
        return node.decorators !== decorators
            || node.modifiers !== modifiers
            || node.exportClause !== exportClause
            || node.moduleSpecifier !== moduleSpecifier
            ? updateNode(createExportDeclaration(decorators, modifiers, exportClause, moduleSpecifier), node)
            : node;
    }
    ts.updateExportDeclaration = updateExportDeclaration;
    function createNamedExports(elements) {
        const node = createSynthesizedNode(ts.SyntaxKind.NamedExports);
        node.elements = createNodeArray(elements);
        return node;
    }
    ts.createNamedExports = createNamedExports;
    function updateNamedExports(node, elements) {
        return node.elements !== elements
            ? updateNode(createNamedExports(elements), node)
            : node;
    }
    ts.updateNamedExports = updateNamedExports;
    function createExportSpecifier(propertyName, name) {
        const node = createSynthesizedNode(ts.SyntaxKind.ExportSpecifier);
        node.propertyName = asName(propertyName);
        node.name = asName(name);
        return node;
    }
    ts.createExportSpecifier = createExportSpecifier;
    function updateExportSpecifier(node, propertyName, name) {
        return node.propertyName !== propertyName
            || node.name !== name
            ? updateNode(createExportSpecifier(propertyName, name), node)
            : node;
    }
    ts.updateExportSpecifier = updateExportSpecifier;
    // Module references
    function createExternalModuleReference(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.ExternalModuleReference);
        node.expression = expression;
        return node;
    }
    ts.createExternalModuleReference = createExternalModuleReference;
    function updateExternalModuleReference(node, expression) {
        return node.expression !== expression
            ? updateNode(createExternalModuleReference(expression), node)
            : node;
    }
    ts.updateExternalModuleReference = updateExternalModuleReference;
    // JSX
    function createJsxElement(openingElement, children, closingElement) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxElement);
        node.openingElement = openingElement;
        node.children = createNodeArray(children);
        node.closingElement = closingElement;
        return node;
    }
    ts.createJsxElement = createJsxElement;
    function updateJsxElement(node, openingElement, children, closingElement) {
        return node.openingElement !== openingElement
            || node.children !== children
            || node.closingElement !== closingElement
            ? updateNode(createJsxElement(openingElement, children, closingElement), node)
            : node;
    }
    ts.updateJsxElement = updateJsxElement;
    function createJsxSelfClosingElement(tagName, typeArguments, attributes) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxSelfClosingElement);
        node.tagName = tagName;
        node.typeArguments = typeArguments && createNodeArray(typeArguments);
        node.attributes = attributes;
        return node;
    }
    ts.createJsxSelfClosingElement = createJsxSelfClosingElement;
    function updateJsxSelfClosingElement(node, tagName, typeArguments, attributes) {
        return node.tagName !== tagName
            || node.typeArguments !== typeArguments
            || node.attributes !== attributes
            ? updateNode(createJsxSelfClosingElement(tagName, typeArguments, attributes), node)
            : node;
    }
    ts.updateJsxSelfClosingElement = updateJsxSelfClosingElement;
    function createJsxOpeningElement(tagName, typeArguments, attributes) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxOpeningElement);
        node.tagName = tagName;
        node.typeArguments = typeArguments && createNodeArray(typeArguments);
        node.attributes = attributes;
        return node;
    }
    ts.createJsxOpeningElement = createJsxOpeningElement;
    function updateJsxOpeningElement(node, tagName, typeArguments, attributes) {
        return node.tagName !== tagName
            || node.typeArguments !== typeArguments
            || node.attributes !== attributes
            ? updateNode(createJsxOpeningElement(tagName, typeArguments, attributes), node)
            : node;
    }
    ts.updateJsxOpeningElement = updateJsxOpeningElement;
    function createJsxClosingElement(tagName) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxClosingElement);
        node.tagName = tagName;
        return node;
    }
    ts.createJsxClosingElement = createJsxClosingElement;
    function updateJsxClosingElement(node, tagName) {
        return node.tagName !== tagName
            ? updateNode(createJsxClosingElement(tagName), node)
            : node;
    }
    ts.updateJsxClosingElement = updateJsxClosingElement;
    function createJsxFragment(openingFragment, children, closingFragment) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxFragment);
        node.openingFragment = openingFragment;
        node.children = createNodeArray(children);
        node.closingFragment = closingFragment;
        return node;
    }
    ts.createJsxFragment = createJsxFragment;
    function updateJsxFragment(node, openingFragment, children, closingFragment) {
        return node.openingFragment !== openingFragment
            || node.children !== children
            || node.closingFragment !== closingFragment
            ? updateNode(createJsxFragment(openingFragment, children, closingFragment), node)
            : node;
    }
    ts.updateJsxFragment = updateJsxFragment;
    function createJsxAttribute(name, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxAttribute);
        node.name = name;
        node.initializer = initializer;
        return node;
    }
    ts.createJsxAttribute = createJsxAttribute;
    function updateJsxAttribute(node, name, initializer) {
        return node.name !== name
            || node.initializer !== initializer
            ? updateNode(createJsxAttribute(name, initializer), node)
            : node;
    }
    ts.updateJsxAttribute = updateJsxAttribute;
    function createJsxAttributes(properties) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxAttributes);
        node.properties = createNodeArray(properties);
        return node;
    }
    ts.createJsxAttributes = createJsxAttributes;
    function updateJsxAttributes(node, properties) {
        return node.properties !== properties
            ? updateNode(createJsxAttributes(properties), node)
            : node;
    }
    ts.updateJsxAttributes = updateJsxAttributes;
    function createJsxSpreadAttribute(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxSpreadAttribute);
        node.expression = expression;
        return node;
    }
    ts.createJsxSpreadAttribute = createJsxSpreadAttribute;
    function updateJsxSpreadAttribute(node, expression) {
        return node.expression !== expression
            ? updateNode(createJsxSpreadAttribute(expression), node)
            : node;
    }
    ts.updateJsxSpreadAttribute = updateJsxSpreadAttribute;
    function createJsxExpression(dotDotDotToken, expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.JsxExpression);
        node.dotDotDotToken = dotDotDotToken;
        node.expression = expression;
        return node;
    }
    ts.createJsxExpression = createJsxExpression;
    function updateJsxExpression(node, expression) {
        return node.expression !== expression
            ? updateNode(createJsxExpression(node.dotDotDotToken, expression), node)
            : node;
    }
    ts.updateJsxExpression = updateJsxExpression;
    // Clauses
    function createCaseClause(expression, statements) {
        const node = createSynthesizedNode(ts.SyntaxKind.CaseClause);
        node.expression = ts.parenthesizeExpressionForList(expression);
        node.statements = createNodeArray(statements);
        return node;
    }
    ts.createCaseClause = createCaseClause;
    function updateCaseClause(node, expression, statements) {
        return node.expression !== expression
            || node.statements !== statements
            ? updateNode(createCaseClause(expression, statements), node)
            : node;
    }
    ts.updateCaseClause = updateCaseClause;
    function createDefaultClause(statements) {
        const node = createSynthesizedNode(ts.SyntaxKind.DefaultClause);
        node.statements = createNodeArray(statements);
        return node;
    }
    ts.createDefaultClause = createDefaultClause;
    function updateDefaultClause(node, statements) {
        return node.statements !== statements
            ? updateNode(createDefaultClause(statements), node)
            : node;
    }
    ts.updateDefaultClause = updateDefaultClause;
    function createHeritageClause(token, types) {
        const node = createSynthesizedNode(ts.SyntaxKind.HeritageClause);
        node.token = token;
        node.types = createNodeArray(types);
        return node;
    }
    ts.createHeritageClause = createHeritageClause;
    function updateHeritageClause(node, types) {
        return node.types !== types
            ? updateNode(createHeritageClause(node.token, types), node)
            : node;
    }
    ts.updateHeritageClause = updateHeritageClause;
    function createCatchClause(variableDeclaration, block) {
        const node = createSynthesizedNode(ts.SyntaxKind.CatchClause);
        node.variableDeclaration = ts.isString(variableDeclaration) ? createVariableDeclaration(variableDeclaration) : variableDeclaration;
        node.block = block;
        return node;
    }
    ts.createCatchClause = createCatchClause;
    function updateCatchClause(node, variableDeclaration, block) {
        return node.variableDeclaration !== variableDeclaration
            || node.block !== block
            ? updateNode(createCatchClause(variableDeclaration, block), node)
            : node;
    }
    ts.updateCatchClause = updateCatchClause;
    // Property assignments
    function createPropertyAssignment(name, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.PropertyAssignment);
        node.name = asName(name);
        node.questionToken = undefined;
        node.initializer = ts.parenthesizeExpressionForList(initializer);
        return node;
    }
    ts.createPropertyAssignment = createPropertyAssignment;
    function updatePropertyAssignment(node, name, initializer) {
        return node.name !== name
            || node.initializer !== initializer
            ? updateNode(createPropertyAssignment(name, initializer), node)
            : node;
    }
    ts.updatePropertyAssignment = updatePropertyAssignment;
    function createShorthandPropertyAssignment(name, objectAssignmentInitializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.ShorthandPropertyAssignment);
        node.name = asName(name);
        node.objectAssignmentInitializer = objectAssignmentInitializer !== undefined ? ts.parenthesizeExpressionForList(objectAssignmentInitializer) : undefined;
        return node;
    }
    ts.createShorthandPropertyAssignment = createShorthandPropertyAssignment;
    function updateShorthandPropertyAssignment(node, name, objectAssignmentInitializer) {
        return node.name !== name
            || node.objectAssignmentInitializer !== objectAssignmentInitializer
            ? updateNode(createShorthandPropertyAssignment(name, objectAssignmentInitializer), node)
            : node;
    }
    ts.updateShorthandPropertyAssignment = updateShorthandPropertyAssignment;
    function createSpreadAssignment(expression) {
        const node = createSynthesizedNode(ts.SyntaxKind.SpreadAssignment);
        node.expression = expression !== undefined ? ts.parenthesizeExpressionForList(expression) : undefined;
        return node;
    }
    ts.createSpreadAssignment = createSpreadAssignment;
    function updateSpreadAssignment(node, expression) {
        return node.expression !== expression
            ? updateNode(createSpreadAssignment(expression), node)
            : node;
    }
    ts.updateSpreadAssignment = updateSpreadAssignment;
    // Enum
    function createEnumMember(name, initializer) {
        const node = createSynthesizedNode(ts.SyntaxKind.EnumMember);
        node.name = asName(name);
        node.initializer = initializer && ts.parenthesizeExpressionForList(initializer);
        return node;
    }
    ts.createEnumMember = createEnumMember;
    function updateEnumMember(node, name, initializer) {
        return node.name !== name
            || node.initializer !== initializer
            ? updateNode(createEnumMember(name, initializer), node)
            : node;
    }
    ts.updateEnumMember = updateEnumMember;
    // Top-level nodes
    function updateSourceFileNode(node, statements, isDeclarationFile, referencedFiles, typeReferences, hasNoDefaultLib) {
        if (node.statements !== statements ||
            (isDeclarationFile !== undefined && node.isDeclarationFile !== isDeclarationFile) ||
            (referencedFiles !== undefined && node.referencedFiles !== referencedFiles) ||
            (typeReferences !== undefined && node.typeReferenceDirectives !== typeReferences) ||
            (hasNoDefaultLib !== undefined && node.hasNoDefaultLib !== hasNoDefaultLib)) {
            const updated = createSynthesizedNode(ts.SyntaxKind.SourceFile);
            updated.flags |= node.flags;
            updated.statements = createNodeArray(statements);
            updated.endOfFileToken = node.endOfFileToken;
            updated.fileName = node.fileName;
            updated.path = node.path;
            updated.text = node.text;
            updated.isDeclarationFile = isDeclarationFile === undefined ? node.isDeclarationFile : isDeclarationFile;
            updated.referencedFiles = referencedFiles === undefined ? node.referencedFiles : referencedFiles;
            updated.typeReferenceDirectives = typeReferences === undefined ? node.typeReferenceDirectives : typeReferences;
            updated.hasNoDefaultLib = hasNoDefaultLib === undefined ? node.hasNoDefaultLib : hasNoDefaultLib;
            if (node.amdDependencies !== undefined)
                updated.amdDependencies = node.amdDependencies;
            if (node.moduleName !== undefined)
                updated.moduleName = node.moduleName;
            if (node.languageVariant !== undefined)
                updated.languageVariant = node.languageVariant;
            if (node.renamedDependencies !== undefined)
                updated.renamedDependencies = node.renamedDependencies;
            if (node.languageVersion !== undefined)
                updated.languageVersion = node.languageVersion;
            if (node.scriptKind !== undefined)
                updated.scriptKind = node.scriptKind;
            if (node.externalModuleIndicator !== undefined)
                updated.externalModuleIndicator = node.externalModuleIndicator;
            if (node.commonJsModuleIndicator !== undefined)
                updated.commonJsModuleIndicator = node.commonJsModuleIndicator;
            if (node.identifiers !== undefined)
                updated.identifiers = node.identifiers;
            if (node.nodeCount !== undefined)
                updated.nodeCount = node.nodeCount;
            if (node.identifierCount !== undefined)
                updated.identifierCount = node.identifierCount;
            if (node.symbolCount !== undefined)
                updated.symbolCount = node.symbolCount;
            if (node.parseDiagnostics !== undefined)
                updated.parseDiagnostics = node.parseDiagnostics;
            if (node.bindDiagnostics !== undefined)
                updated.bindDiagnostics = node.bindDiagnostics;
            if (node.lineMap !== undefined)
                updated.lineMap = node.lineMap;
            if (node.classifiableNames !== undefined)
                updated.classifiableNames = node.classifiableNames;
            if (node.resolvedModules !== undefined)
                updated.resolvedModules = node.resolvedModules;
            if (node.resolvedTypeReferenceDirectiveNames !== undefined)
                updated.resolvedTypeReferenceDirectiveNames = node.resolvedTypeReferenceDirectiveNames;
            if (node.imports !== undefined)
                updated.imports = node.imports;
            if (node.moduleAugmentations !== undefined)
                updated.moduleAugmentations = node.moduleAugmentations;
            if (node.pragmas !== undefined)
                updated.pragmas = node.pragmas;
            if (node.localJsxFactory !== undefined)
                updated.localJsxFactory = node.localJsxFactory;
            if (node.localJsxNamespace !== undefined)
                updated.localJsxNamespace = node.localJsxNamespace;
            return updateNode(updated, node);
        }
        return node;
    }
    ts.updateSourceFileNode = updateSourceFileNode;
    /**
     * Creates a shallow, memberwise clone of a node for mutation.
     */
    function getMutableClone(node) {
        const clone = getSynthesizedClone(node);
        clone.pos = node.pos;
        clone.end = node.end;
        clone.parent = node.parent;
        return clone;
    }
    ts.getMutableClone = getMutableClone;
    // Transformation nodes
    /**
     * Creates a synthetic statement to act as a placeholder for a not-emitted statement in
     * order to preserve comments.
     *
     * @param original The original statement.
     */
    function createNotEmittedStatement(original) {
        const node = createSynthesizedNode(ts.SyntaxKind.NotEmittedStatement);
        node.original = original;
        setTextRange(node, original);
        return node;
    }
    ts.createNotEmittedStatement = createNotEmittedStatement;
    /**
     * Creates a synthetic element to act as a placeholder for the end of an emitted declaration in
     * order to properly emit exports.
     */
    /* @internal */
    function createEndOfDeclarationMarker(original) {
        const node = createSynthesizedNode(ts.SyntaxKind.EndOfDeclarationMarker);
        node.emitNode = {};
        node.original = original;
        return node;
    }
    ts.createEndOfDeclarationMarker = createEndOfDeclarationMarker;
    /**
     * Creates a synthetic element to act as a placeholder for the beginning of a merged declaration in
     * order to properly emit exports.
     */
    /* @internal */
    function createMergeDeclarationMarker(original) {
        const node = createSynthesizedNode(ts.SyntaxKind.MergeDeclarationMarker);
        node.emitNode = {};
        node.original = original;
        return node;
    }
    ts.createMergeDeclarationMarker = createMergeDeclarationMarker;
    /**
     * Creates a synthetic expression to act as a placeholder for a not-emitted expression in
     * order to preserve comments or sourcemap positions.
     *
     * @param expression The inner expression to emit.
     * @param original The original outer expression.
     * @param location The location for the expression. Defaults to the positions from "original" if provided.
     */
    function createPartiallyEmittedExpression(expression, original) {
        const node = createSynthesizedNode(ts.SyntaxKind.PartiallyEmittedExpression);
        node.expression = expression;
        node.original = original;
        setTextRange(node, original);
        return node;
    }
    ts.createPartiallyEmittedExpression = createPartiallyEmittedExpression;
    function updatePartiallyEmittedExpression(node, expression) {
        if (node.expression !== expression) {
            return updateNode(createPartiallyEmittedExpression(expression, node.original), node);
        }
        return node;
    }
    ts.updatePartiallyEmittedExpression = updatePartiallyEmittedExpression;
    function flattenCommaElements(node) {
        if (ts.nodeIsSynthesized(node) && !ts.isParseTreeNode(node) && !node.original && !node.emitNode && !node.id) {
            if (node.kind === ts.SyntaxKind.CommaListExpression) {
                return node.elements;
            }
            if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.CommaToken) {
                return [node.left, node.right];
            }
        }
        return node;
    }
    function createCommaList(elements) {
        const node = createSynthesizedNode(ts.SyntaxKind.CommaListExpression);
        node.elements = createNodeArray(ts.sameFlatMap(elements, flattenCommaElements));
        return node;
    }
    ts.createCommaList = createCommaList;
    function updateCommaList(node, elements) {
        return node.elements !== elements
            ? updateNode(createCommaList(elements), node)
            : node;
    }
    ts.updateCommaList = updateCommaList;
    function createBundle(sourceFiles) {
        const node = ts.createNode(ts.SyntaxKind.Bundle);
        node.sourceFiles = sourceFiles;
        return node;
    }
    ts.createBundle = createBundle;
    function updateBundle(node, sourceFiles) {
        if (node.sourceFiles !== sourceFiles) {
            return createBundle(sourceFiles);
        }
        return node;
    }
    ts.updateBundle = updateBundle;
    function createImmediatelyInvokedFunctionExpression(statements, param, paramValue) {
        return createCall(createFunctionExpression(
        /*modifiers*/ undefined, 
        /*asteriskToken*/ undefined, 
        /*name*/ undefined, 
        /*typeParameters*/ undefined, 
        /*parameters*/ param ? [param] : [], 
        /*type*/ undefined, createBlock(statements, /*multiLine*/ true)), 
        /*typeArguments*/ undefined, 
        /*argumentsArray*/ paramValue ? [paramValue] : []);
    }
    ts.createImmediatelyInvokedFunctionExpression = createImmediatelyInvokedFunctionExpression;
    function createImmediatelyInvokedArrowFunction(statements, param, paramValue) {
        return createCall(createArrowFunction(
        /*modifiers*/ undefined, 
        /*typeParameters*/ undefined, 
        /*parameters*/ param ? [param] : [], 
        /*type*/ undefined, 
        /*equalsGreaterThanToken*/ undefined, createBlock(statements, /*multiLine*/ true)), 
        /*typeArguments*/ undefined, 
        /*argumentsArray*/ paramValue ? [paramValue] : []);
    }
    ts.createImmediatelyInvokedArrowFunction = createImmediatelyInvokedArrowFunction;
    function createComma(left, right) {
        return createBinary(left, ts.SyntaxKind.CommaToken, right);
    }
    ts.createComma = createComma;
    function createLessThan(left, right) {
        return createBinary(left, ts.SyntaxKind.LessThanToken, right);
    }
    ts.createLessThan = createLessThan;
    function createAssignment(left, right) {
        return createBinary(left, ts.SyntaxKind.EqualsToken, right);
    }
    ts.createAssignment = createAssignment;
    function createStrictEquality(left, right) {
        return createBinary(left, ts.SyntaxKind.EqualsEqualsEqualsToken, right);
    }
    ts.createStrictEquality = createStrictEquality;
    function createStrictInequality(left, right) {
        return createBinary(left, ts.SyntaxKind.ExclamationEqualsEqualsToken, right);
    }
    ts.createStrictInequality = createStrictInequality;
    function createAdd(left, right) {
        return createBinary(left, ts.SyntaxKind.PlusToken, right);
    }
    ts.createAdd = createAdd;
    function createSubtract(left, right) {
        return createBinary(left, ts.SyntaxKind.MinusToken, right);
    }
    ts.createSubtract = createSubtract;
    function createPostfixIncrement(operand) {
        return createPostfix(operand, ts.SyntaxKind.PlusPlusToken);
    }
    ts.createPostfixIncrement = createPostfixIncrement;
    function createLogicalAnd(left, right) {
        return createBinary(left, ts.SyntaxKind.AmpersandAmpersandToken, right);
    }
    ts.createLogicalAnd = createLogicalAnd;
    function createLogicalOr(left, right) {
        return createBinary(left, ts.SyntaxKind.BarBarToken, right);
    }
    ts.createLogicalOr = createLogicalOr;
    function createLogicalNot(operand) {
        return createPrefix(ts.SyntaxKind.ExclamationToken, operand);
    }
    ts.createLogicalNot = createLogicalNot;
    function createVoidZero() {
        return createVoid(createLiteral(0));
    }
    ts.createVoidZero = createVoidZero;
    function createExportDefault(expression) {
        return createExportAssignment(/*decorators*/ undefined, /*modifiers*/ undefined, /*isExportEquals*/ false, expression);
    }
    ts.createExportDefault = createExportDefault;
    function createExternalModuleExport(exportName) {
        return createExportDeclaration(/*decorators*/ undefined, /*modifiers*/ undefined, createNamedExports([createExportSpecifier(/*propertyName*/ undefined, exportName)]));
    }
    ts.createExternalModuleExport = createExternalModuleExport;
    function asName(name) {
        return ts.isString(name) ? createIdentifier(name) : name;
    }
    function asExpression(value) {
        return ts.isString(value) || typeof value === "number" ? createLiteral(value) : value;
    }
    function asNodeArray(array) {
        return array ? createNodeArray(array) : undefined;
    }
    function asToken(value) {
        return typeof value === "number" ? createToken(value) : value;
    }
    /**
     * Clears any EmitNode entries from parse-tree nodes.
     * @param sourceFile A source file.
     */
    function disposeEmitNodes(sourceFile) {
        // During transformation we may need to annotate a parse tree node with transient
        // transformation properties. As parse tree nodes live longer than transformation
        // nodes, we need to make sure we reclaim any memory allocated for custom ranges
        // from these nodes to ensure we do not hold onto entire subtrees just for position
        // information. We also need to reset these nodes to a pre-transformation state
        // for incremental parsing scenarios so that we do not impact later emit.
        sourceFile = ts.getSourceFileOfNode(ts.getParseTreeNode(sourceFile));
        const emitNode = sourceFile && sourceFile.emitNode;
        const annotatedNodes = emitNode && emitNode.annotatedNodes;
        if (annotatedNodes) {
            for (const node of annotatedNodes) {
                node.emitNode = undefined;
            }
        }
    }
    ts.disposeEmitNodes = disposeEmitNodes;
    /**
     * Associates a node with the current transformation, initializing
     * various transient transformation properties.
     */
    /* @internal */
    function getOrCreateEmitNode(node) {
        if (!node.emitNode) {
            if (ts.isParseTreeNode(node)) {
                // To avoid holding onto transformation artifacts, we keep track of any
                // parse tree node we are annotating. This allows us to clean them up after
                // all transformations have completed.
                if (node.kind === ts.SyntaxKind.SourceFile) {
                    return node.emitNode = { annotatedNodes: [node] };
                }
                const sourceFile = ts.getSourceFileOfNode(node);
                getOrCreateEmitNode(sourceFile).annotatedNodes.push(node);
            }
            node.emitNode = {};
        }
        return node.emitNode;
    }
    ts.getOrCreateEmitNode = getOrCreateEmitNode;
    function setTextRange(range, location) {
        if (location) {
            range.pos = location.pos;
            range.end = location.end;
        }
        return range;
    }
    ts.setTextRange = setTextRange;
    /**
     * Sets flags that control emit behavior of a node.
     */
    function setEmitFlags(node, emitFlags) {
        getOrCreateEmitNode(node).flags = emitFlags;
        return node;
    }
    ts.setEmitFlags = setEmitFlags;
    /**
     * Sets flags that control emit behavior of a node.
     */
    /* @internal */
    function addEmitFlags(node, emitFlags) {
        const emitNode = getOrCreateEmitNode(node);
        emitNode.flags = emitNode.flags | emitFlags;
        return node;
    }
    ts.addEmitFlags = addEmitFlags;
    /**
     * Gets a custom text range to use when emitting source maps.
     */
    function getSourceMapRange(node) {
        const emitNode = node.emitNode;
        return (emitNode && emitNode.sourceMapRange) || node;
    }
    ts.getSourceMapRange = getSourceMapRange;
    /**
     * Sets a custom text range to use when emitting source maps.
     */
    function setSourceMapRange(node, range) {
        getOrCreateEmitNode(node).sourceMapRange = range;
        return node;
    }
    ts.setSourceMapRange = setSourceMapRange;
    // tslint:disable-next-line variable-name
    let SourceMapSource;
    /**
     * Create an external source map source file reference
     */
    function createSourceMapSource(fileName, text, skipTrivia) {
        return new (SourceMapSource || (SourceMapSource = ts.objectAllocator.getSourceMapSourceConstructor()))(fileName, text, skipTrivia);
    }
    ts.createSourceMapSource = createSourceMapSource;
    /**
     * Gets the TextRange to use for source maps for a token of a node.
     */
    function getTokenSourceMapRange(node, token) {
        const emitNode = node.emitNode;
        const tokenSourceMapRanges = emitNode && emitNode.tokenSourceMapRanges;
        return tokenSourceMapRanges && tokenSourceMapRanges[token];
    }
    ts.getTokenSourceMapRange = getTokenSourceMapRange;
    /**
     * Sets the TextRange to use for source maps for a token of a node.
     */
    function setTokenSourceMapRange(node, token, range) {
        const emitNode = getOrCreateEmitNode(node);
        const tokenSourceMapRanges = emitNode.tokenSourceMapRanges || (emitNode.tokenSourceMapRanges = []);
        tokenSourceMapRanges[token] = range;
        return node;
    }
    ts.setTokenSourceMapRange = setTokenSourceMapRange;
    /**
     * Gets a custom text range to use when emitting comments.
     */
    /*@internal*/
    function getStartsOnNewLine(node) {
        const emitNode = node.emitNode;
        return emitNode && emitNode.startsOnNewLine;
    }
    ts.getStartsOnNewLine = getStartsOnNewLine;
    /**
     * Sets a custom text range to use when emitting comments.
     */
    /*@internal*/
    function setStartsOnNewLine(node, newLine) {
        getOrCreateEmitNode(node).startsOnNewLine = newLine;
        return node;
    }
    ts.setStartsOnNewLine = setStartsOnNewLine;
    /**
     * Gets a custom text range to use when emitting comments.
     */
    function getCommentRange(node) {
        const emitNode = node.emitNode;
        return (emitNode && emitNode.commentRange) || node;
    }
    ts.getCommentRange = getCommentRange;
    /**
     * Sets a custom text range to use when emitting comments.
     */
    function setCommentRange(node, range) {
        getOrCreateEmitNode(node).commentRange = range;
        return node;
    }
    ts.setCommentRange = setCommentRange;
    function getSyntheticLeadingComments(node) {
        const emitNode = node.emitNode;
        return emitNode && emitNode.leadingComments;
    }
    ts.getSyntheticLeadingComments = getSyntheticLeadingComments;
    function setSyntheticLeadingComments(node, comments) {
        getOrCreateEmitNode(node).leadingComments = comments;
        return node;
    }
    ts.setSyntheticLeadingComments = setSyntheticLeadingComments;
    function addSyntheticLeadingComment(node, kind, text, hasTrailingNewLine) {
        return setSyntheticLeadingComments(node, ts.append(getSyntheticLeadingComments(node), { kind, pos: -1, end: -1, hasTrailingNewLine, text }));
    }
    ts.addSyntheticLeadingComment = addSyntheticLeadingComment;
    function getSyntheticTrailingComments(node) {
        const emitNode = node.emitNode;
        return emitNode && emitNode.trailingComments;
    }
    ts.getSyntheticTrailingComments = getSyntheticTrailingComments;
    function setSyntheticTrailingComments(node, comments) {
        getOrCreateEmitNode(node).trailingComments = comments;
        return node;
    }
    ts.setSyntheticTrailingComments = setSyntheticTrailingComments;
    function addSyntheticTrailingComment(node, kind, text, hasTrailingNewLine) {
        return setSyntheticTrailingComments(node, ts.append(getSyntheticTrailingComments(node), { kind, pos: -1, end: -1, hasTrailingNewLine, text }));
    }
    ts.addSyntheticTrailingComment = addSyntheticTrailingComment;
    /**
     * Gets the constant value to emit for an expression.
     */
    function getConstantValue(node) {
        const emitNode = node.emitNode;
        return emitNode && emitNode.constantValue;
    }
    ts.getConstantValue = getConstantValue;
    /**
     * Sets the constant value to emit for an expression.
     */
    function setConstantValue(node, value) {
        const emitNode = getOrCreateEmitNode(node);
        emitNode.constantValue = value;
        return node;
    }
    ts.setConstantValue = setConstantValue;
    /**
     * Adds an EmitHelper to a node.
     */
    function addEmitHelper(node, helper) {
        const emitNode = getOrCreateEmitNode(node);
        emitNode.helpers = ts.append(emitNode.helpers, helper);
        return node;
    }
    ts.addEmitHelper = addEmitHelper;
    /**
     * Add EmitHelpers to a node.
     */
    function addEmitHelpers(node, helpers) {
        if (ts.some(helpers)) {
            const emitNode = getOrCreateEmitNode(node);
            for (const helper of helpers) {
                emitNode.helpers = ts.appendIfUnique(emitNode.helpers, helper);
            }
        }
        return node;
    }
    ts.addEmitHelpers = addEmitHelpers;
    /**
     * Removes an EmitHelper from a node.
     */
    function removeEmitHelper(node, helper) {
        const emitNode = node.emitNode;
        if (emitNode) {
            const helpers = emitNode.helpers;
            if (helpers) {
                return ts.orderedRemoveItem(helpers, helper);
            }
        }
        return false;
    }
    ts.removeEmitHelper = removeEmitHelper;
    /**
     * Gets the EmitHelpers of a node.
     */
    function getEmitHelpers(node) {
        const emitNode = node.emitNode;
        return emitNode && emitNode.helpers;
    }
    ts.getEmitHelpers = getEmitHelpers;
    /**
     * Moves matching emit helpers from a source node to a target node.
     */
    function moveEmitHelpers(source, target, predicate) {
        const sourceEmitNode = source.emitNode;
        const sourceEmitHelpers = sourceEmitNode && sourceEmitNode.helpers;
        if (!ts.some(sourceEmitHelpers))
            return;
        const targetEmitNode = getOrCreateEmitNode(target);
        let helpersRemoved = 0;
        for (let i = 0; i < sourceEmitHelpers.length; i++) {
            const helper = sourceEmitHelpers[i];
            if (predicate(helper)) {
                helpersRemoved++;
                targetEmitNode.helpers = ts.appendIfUnique(targetEmitNode.helpers, helper);
            }
            else if (helpersRemoved > 0) {
                sourceEmitHelpers[i - helpersRemoved] = helper;
            }
        }
        if (helpersRemoved > 0) {
            sourceEmitHelpers.length -= helpersRemoved;
        }
    }
    ts.moveEmitHelpers = moveEmitHelpers;
    /* @internal */
    function compareEmitHelpers(x, y) {
        if (x === y)
            return 0 /* EqualTo */;
        if (x.priority === y.priority)
            return 0 /* EqualTo */;
        if (x.priority === undefined)
            return 1 /* GreaterThan */;
        if (y.priority === undefined)
            return -1 /* LessThan */;
        return ts.compareValues(x.priority, y.priority);
    }
    ts.compareEmitHelpers = compareEmitHelpers;
    function setOriginalNode(node, original) {
        node.original = original;
        if (original) {
            const emitNode = original.emitNode;
            if (emitNode)
                node.emitNode = mergeEmitNode(emitNode, node.emitNode);
        }
        return node;
    }
    ts.setOriginalNode = setOriginalNode;
    function mergeEmitNode(sourceEmitNode, destEmitNode) {
        const { flags, leadingComments, trailingComments, commentRange, sourceMapRange, tokenSourceMapRanges, constantValue, helpers, startsOnNewLine, } = sourceEmitNode;
        if (!destEmitNode)
            destEmitNode = {};
        // We are using `.slice()` here in case `destEmitNode.leadingComments` is pushed to later.
        if (leadingComments)
            destEmitNode.leadingComments = ts.addRange(leadingComments.slice(), destEmitNode.leadingComments);
        if (trailingComments)
            destEmitNode.trailingComments = ts.addRange(trailingComments.slice(), destEmitNode.trailingComments);
        if (flags)
            destEmitNode.flags = flags;
        if (commentRange)
            destEmitNode.commentRange = commentRange;
        if (sourceMapRange)
            destEmitNode.sourceMapRange = sourceMapRange;
        if (tokenSourceMapRanges)
            destEmitNode.tokenSourceMapRanges = mergeTokenSourceMapRanges(tokenSourceMapRanges, destEmitNode.tokenSourceMapRanges);
        if (constantValue !== undefined)
            destEmitNode.constantValue = constantValue;
        if (helpers)
            destEmitNode.helpers = ts.addRange(destEmitNode.helpers, helpers);
        if (startsOnNewLine !== undefined)
            destEmitNode.startsOnNewLine = startsOnNewLine;
        return destEmitNode;
    }
    function mergeTokenSourceMapRanges(sourceRanges, destRanges) {
        if (!destRanges)
            destRanges = [];
        for (const key in sourceRanges) {
            destRanges[key] = sourceRanges[key];
        }
        return destRanges;
    }
})(ts || (ts = {}));
/* @internal */
(function (ts) {
    ts.nullTransformationContext = {
        enableEmitNotification: ts.noop,
        enableSubstitution: ts.noop,
        endLexicalEnvironment: () => undefined,
        getCompilerOptions: ts.notImplemented,
        getEmitHost: ts.notImplemented,
        getEmitResolver: ts.notImplemented,
        hoistFunctionDeclaration: ts.noop,
        hoistVariableDeclaration: ts.noop,
        isEmitNotificationEnabled: ts.notImplemented,
        isSubstitutionEnabled: ts.notImplemented,
        onEmitNode: ts.noop,
        onSubstituteNode: ts.notImplemented,
        readEmitHelpers: ts.notImplemented,
        requestEmitHelper: ts.noop,
        resumeLexicalEnvironment: ts.noop,
        startLexicalEnvironment: ts.noop,
        suspendLexicalEnvironment: ts.noop,
        addDiagnostic: ts.noop,
    };
    function createTypeCheck(value, tag) {
        return tag === "undefined"
            ? ts.createStrictEquality(value, ts.createVoidZero())
            : ts.createStrictEquality(ts.createTypeOf(value), ts.createLiteral(tag));
    }
    ts.createTypeCheck = createTypeCheck;
    function createMemberAccessForPropertyName(target, memberName, location) {
        if (ts.isComputedPropertyName(memberName)) {
            return ts.setTextRange(ts.createElementAccess(target, memberName.expression), location);
        }
        else {
            const expression = ts.setTextRange(ts.isIdentifier(memberName)
                ? ts.createPropertyAccess(target, memberName)
                : ts.createElementAccess(target, memberName), memberName);
            ts.getOrCreateEmitNode(expression).flags |= ts.EmitFlags.NoNestedSourceMaps;
            return expression;
        }
    }
    ts.createMemberAccessForPropertyName = createMemberAccessForPropertyName;
    function createFunctionCall(func, thisArg, argumentsList, location) {
        return ts.setTextRange(ts.createCall(ts.createPropertyAccess(func, "call"), 
        /*typeArguments*/ undefined, [
            thisArg,
            ...argumentsList
        ]), location);
    }
    ts.createFunctionCall = createFunctionCall;
    function createFunctionApply(func, thisArg, argumentsExpression, location) {
        return ts.setTextRange(ts.createCall(ts.createPropertyAccess(func, "apply"), 
        /*typeArguments*/ undefined, [
            thisArg,
            argumentsExpression
        ]), location);
    }
    ts.createFunctionApply = createFunctionApply;
    function createArraySlice(array, start) {
        const argumentsList = [];
        if (start !== undefined) {
            argumentsList.push(typeof start === "number" ? ts.createLiteral(start) : start);
        }
        return ts.createCall(ts.createPropertyAccess(array, "slice"), /*typeArguments*/ undefined, argumentsList);
    }
    ts.createArraySlice = createArraySlice;
    function createArrayConcat(array, values) {
        return ts.createCall(ts.createPropertyAccess(array, "concat"), 
        /*typeArguments*/ undefined, values);
    }
    ts.createArrayConcat = createArrayConcat;
    function createMathPow(left, right, location) {
        return ts.setTextRange(ts.createCall(ts.createPropertyAccess(ts.createIdentifier("Math"), "pow"), 
        /*typeArguments*/ undefined, [left, right]), location);
    }
    ts.createMathPow = createMathPow;
    function createReactNamespace(reactNamespace, parent) {
        // To ensure the emit resolver can properly resolve the namespace, we need to
        // treat this identifier as if it were a source tree node by clearing the `Synthesized`
        // flag and setting a parent node.
        const react = ts.createIdentifier(reactNamespace || "React");
        react.flags &= ~ts.NodeFlags.Synthesized;
        // Set the parent that is in parse tree
        // this makes sure that parent chain is intact for checker to traverse complete scope tree
        react.parent = ts.getParseTreeNode(parent);
        return react;
    }
    function createJsxFactoryExpressionFromEntityName(jsxFactory, parent) {
        if (ts.isQualifiedName(jsxFactory)) {
            const left = createJsxFactoryExpressionFromEntityName(jsxFactory.left, parent);
            const right = ts.createIdentifier(ts.idText(jsxFactory.right));
            right.escapedText = jsxFactory.right.escapedText;
            return ts.createPropertyAccess(left, right);
        }
        else {
            return createReactNamespace(ts.idText(jsxFactory), parent);
        }
    }
    function createJsxFactoryExpression(jsxFactoryEntity, reactNamespace, parent) {
        return jsxFactoryEntity ?
            createJsxFactoryExpressionFromEntityName(jsxFactoryEntity, parent) :
            ts.createPropertyAccess(createReactNamespace(reactNamespace, parent), "createElement");
    }
    function createExpressionForJsxElement(jsxFactoryEntity, reactNamespace, tagName, props, children, parentElement, location) {
        const argumentsList = [tagName];
        if (props) {
            argumentsList.push(props);
        }
        if (children && children.length > 0) {
            if (!props) {
                argumentsList.push(ts.createNull());
            }
            if (children.length > 1) {
                for (const child of children) {
                    startOnNewLine(child);
                    argumentsList.push(child);
                }
            }
            else {
                argumentsList.push(children[0]);
            }
        }
        return ts.setTextRange(ts.createCall(createJsxFactoryExpression(jsxFactoryEntity, reactNamespace, parentElement), 
        /*typeArguments*/ undefined, argumentsList), location);
    }
    ts.createExpressionForJsxElement = createExpressionForJsxElement;
    function createExpressionForJsxFragment(jsxFactoryEntity, reactNamespace, children, parentElement, location) {
        const tagName = ts.createPropertyAccess(createReactNamespace(reactNamespace, parentElement), "Fragment");
        const argumentsList = [tagName];
        argumentsList.push(ts.createNull());
        if (children && children.length > 0) {
            if (children.length > 1) {
                for (const child of children) {
                    startOnNewLine(child);
                    argumentsList.push(child);
                }
            }
            else {
                argumentsList.push(children[0]);
            }
        }
        return ts.setTextRange(ts.createCall(createJsxFactoryExpression(jsxFactoryEntity, reactNamespace, parentElement), 
        /*typeArguments*/ undefined, argumentsList), location);
    }
    ts.createExpressionForJsxFragment = createExpressionForJsxFragment;
    // Helpers
    function getHelperName(name) {
        return ts.setEmitFlags(ts.createIdentifier(name), ts.EmitFlags.HelperName | ts.EmitFlags.AdviseOnEmitNode);
    }
    ts.getHelperName = getHelperName;
    const valuesHelper = {
        name: "typescript:values",
        scoped: false,
        text: `
            var __values = (this && this.__values) || function (o) {
                var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
                if (m) return m.call(o);
                return {
                    next: function () {
                        if (o && i >= o.length) o = void 0;
                        return { value: o && o[i++], done: !o };
                    }
                };
            };`
    };
    function createValuesHelper(context, expression, location) {
        context.requestEmitHelper(valuesHelper);
        return ts.setTextRange(ts.createCall(getHelperName("__values"), 
        /*typeArguments*/ undefined, [expression]), location);
    }
    ts.createValuesHelper = createValuesHelper;
    const readHelper = {
        name: "typescript:read",
        scoped: false,
        text: `
            var __read = (this && this.__read) || function (o, n) {
                var m = typeof Symbol === "function" && o[Symbol.iterator];
                if (!m) return o;
                var i = m.call(o), r, ar = [], e;
                try {
                    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
                }
                catch (error) { e = { error: error }; }
                finally {
                    try {
                        if (r && !r.done && (m = i["return"])) m.call(i);
                    }
                    finally { if (e) throw e.error; }
                }
                return ar;
            };`
    };
    function createReadHelper(context, iteratorRecord, count, location) {
        context.requestEmitHelper(readHelper);
        return ts.setTextRange(ts.createCall(getHelperName("__read"), 
        /*typeArguments*/ undefined, count !== undefined
            ? [iteratorRecord, ts.createLiteral(count)]
            : [iteratorRecord]), location);
    }
    ts.createReadHelper = createReadHelper;
    const spreadHelper = {
        name: "typescript:spread",
        scoped: false,
        text: `
            var __spread = (this && this.__spread) || function () {
                for (var ar = [], i = 0; i < arguments.length; i++) ar = ar.concat(__read(arguments[i]));
                return ar;
            };`
    };
    function createSpreadHelper(context, argumentList, location) {
        context.requestEmitHelper(readHelper);
        context.requestEmitHelper(spreadHelper);
        return ts.setTextRange(ts.createCall(getHelperName("__spread"), 
        /*typeArguments*/ undefined, argumentList), location);
    }
    ts.createSpreadHelper = createSpreadHelper;
    // Utilities
    function createForOfBindingStatement(node, boundValue) {
        if (ts.isVariableDeclarationList(node)) {
            const firstDeclaration = ts.firstOrUndefined(node.declarations);
            const updatedDeclaration = ts.updateVariableDeclaration(firstDeclaration, firstDeclaration.name, 
            /*typeNode*/ undefined, boundValue);
            return ts.setTextRange(ts.createVariableStatement(
            /*modifiers*/ undefined, ts.updateVariableDeclarationList(node, [updatedDeclaration])), 
            /*location*/ node);
        }
        else {
            const updatedExpression = ts.setTextRange(ts.createAssignment(node, boundValue), /*location*/ node);
            return ts.setTextRange(ts.createStatement(updatedExpression), /*location*/ node);
        }
    }
    ts.createForOfBindingStatement = createForOfBindingStatement;
    function insertLeadingStatement(dest, source) {
        if (ts.isBlock(dest)) {
            return ts.updateBlock(dest, ts.setTextRange(ts.createNodeArray([source, ...dest.statements]), dest.statements));
        }
        else {
            return ts.createBlock(ts.createNodeArray([dest, source]), /*multiLine*/ true);
        }
    }
    ts.insertLeadingStatement = insertLeadingStatement;
    function restoreEnclosingLabel(node, outermostLabeledStatement, afterRestoreLabelCallback) {
        if (!outermostLabeledStatement) {
            return node;
        }
        const updated = ts.updateLabel(outermostLabeledStatement, outermostLabeledStatement.label, outermostLabeledStatement.statement.kind === ts.SyntaxKind.LabeledStatement
            ? restoreEnclosingLabel(node, outermostLabeledStatement.statement)
            : node);
        if (afterRestoreLabelCallback) {
            afterRestoreLabelCallback(outermostLabeledStatement);
        }
        return updated;
    }
    ts.restoreEnclosingLabel = restoreEnclosingLabel;
    function shouldBeCapturedInTempVariable(node, cacheIdentifiers) {
        const target = ts.skipParentheses(node);
        switch (target.kind) {
            case ts.SyntaxKind.Identifier:
                return cacheIdentifiers;
            case ts.SyntaxKind.ThisKeyword:
            case ts.SyntaxKind.NumericLiteral:
            case ts.SyntaxKind.StringLiteral:
                return false;
            case ts.SyntaxKind.ArrayLiteralExpression:
                const elements = target.elements;
                if (elements.length === 0) {
                    return false;
                }
                return true;
            case ts.SyntaxKind.ObjectLiteralExpression:
                return target.properties.length > 0;
            default:
                return true;
        }
    }
    function createCallBinding(expression, recordTempVariable, languageVersion, cacheIdentifiers) {
        const callee = skipOuterExpressions(expression, 7 /* All */);
        let thisArg;
        let target;
        if (ts.isSuperProperty(callee)) {
            thisArg = ts.createThis();
            target = callee;
        }
        else if (callee.kind === ts.SyntaxKind.SuperKeyword) {
            thisArg = ts.createThis();
            target = languageVersion < ts.ScriptTarget.ES2015
                ? ts.setTextRange(ts.createIdentifier("_super"), callee)
                : callee;
        }
        else if (ts.getEmitFlags(callee) & ts.EmitFlags.HelperName) {
            thisArg = ts.createVoidZero();
            target = parenthesizeForAccess(callee);
        }
        else {
            switch (callee.kind) {
                case ts.SyntaxKind.PropertyAccessExpression: {
                    if (shouldBeCapturedInTempVariable(callee.expression, cacheIdentifiers)) {
                        // for `a.b()` target is `(_a = a).b` and thisArg is `_a`
                        thisArg = ts.createTempVariable(recordTempVariable);
                        target = ts.createPropertyAccess(ts.setTextRange(ts.createAssignment(thisArg, callee.expression), callee.expression), callee.name);
                        ts.setTextRange(target, callee);
                    }
                    else {
                        thisArg = callee.expression;
                        target = callee;
                    }
                    break;
                }
                case ts.SyntaxKind.ElementAccessExpression: {
                    if (shouldBeCapturedInTempVariable(callee.expression, cacheIdentifiers)) {
                        // for `a[b]()` target is `(_a = a)[b]` and thisArg is `_a`
                        thisArg = ts.createTempVariable(recordTempVariable);
                        target = ts.createElementAccess(ts.setTextRange(ts.createAssignment(thisArg, callee.expression), callee.expression), callee.argumentExpression);
                        ts.setTextRange(target, callee);
                    }
                    else {
                        thisArg = callee.expression;
                        target = callee;
                    }
                    break;
                }
                default: {
                    // for `a()` target is `a` and thisArg is `void 0`
                    thisArg = ts.createVoidZero();
                    target = parenthesizeForAccess(expression);
                    break;
                }
            }
        }
        return { target, thisArg };
    }
    ts.createCallBinding = createCallBinding;
    function inlineExpressions(expressions) {
        // Avoid deeply nested comma expressions as traversing them during emit can result in "Maximum call
        // stack size exceeded" errors.
        return expressions.length > 10
            ? ts.createCommaList(expressions)
            : ts.reduceLeft(expressions, ts.createComma);
    }
    ts.inlineExpressions = inlineExpressions;
    function createExpressionFromEntityName(node) {
        if (ts.isQualifiedName(node)) {
            const left = createExpressionFromEntityName(node.left);
            const right = ts.getMutableClone(node.right);
            return ts.setTextRange(ts.createPropertyAccess(left, right), node);
        }
        else {
            return ts.getMutableClone(node);
        }
    }
    ts.createExpressionFromEntityName = createExpressionFromEntityName;
    function createExpressionForPropertyName(memberName) {
        if (ts.isIdentifier(memberName)) {
            return ts.createLiteral(memberName);
        }
        else if (ts.isComputedPropertyName(memberName)) {
            return ts.getMutableClone(memberName.expression);
        }
        else {
            return ts.getMutableClone(memberName);
        }
    }
    ts.createExpressionForPropertyName = createExpressionForPropertyName;
    function createExpressionForObjectLiteralElementLike(node, property, receiver) {
        switch (property.kind) {
            case ts.SyntaxKind.GetAccessor:
            case ts.SyntaxKind.SetAccessor:
                return createExpressionForAccessorDeclaration(node.properties, property, receiver, node.multiLine);
            case ts.SyntaxKind.PropertyAssignment:
                return createExpressionForPropertyAssignment(property, receiver);
            case ts.SyntaxKind.ShorthandPropertyAssignment:
                return createExpressionForShorthandPropertyAssignment(property, receiver);
            case ts.SyntaxKind.MethodDeclaration:
                return createExpressionForMethodDeclaration(property, receiver);
        }
    }
    ts.createExpressionForObjectLiteralElementLike = createExpressionForObjectLiteralElementLike;
    function createExpressionForAccessorDeclaration(properties, property, receiver, multiLine) {
        const { firstAccessor, getAccessor, setAccessor } = ts.getAllAccessorDeclarations(properties, property);
        if (property === firstAccessor) {
            const properties = [];
            if (getAccessor) {
                const getterFunction = ts.createFunctionExpression(getAccessor.modifiers, 
                /*asteriskToken*/ undefined, 
                /*name*/ undefined, 
                /*typeParameters*/ undefined, getAccessor.parameters, 
                /*type*/ undefined, getAccessor.body);
                ts.setTextRange(getterFunction, getAccessor);
                ts.setOriginalNode(getterFunction, getAccessor);
                const getter = ts.createPropertyAssignment("get", getterFunction);
                properties.push(getter);
            }
            if (setAccessor) {
                const setterFunction = ts.createFunctionExpression(setAccessor.modifiers, 
                /*asteriskToken*/ undefined, 
                /*name*/ undefined, 
                /*typeParameters*/ undefined, setAccessor.parameters, 
                /*type*/ undefined, setAccessor.body);
                ts.setTextRange(setterFunction, setAccessor);
                ts.setOriginalNode(setterFunction, setAccessor);
                const setter = ts.createPropertyAssignment("set", setterFunction);
                properties.push(setter);
            }
            properties.push(ts.createPropertyAssignment("enumerable", ts.createTrue()));
            properties.push(ts.createPropertyAssignment("configurable", ts.createTrue()));
            const expression = ts.setTextRange(ts.createCall(ts.createPropertyAccess(ts.createIdentifier("Object"), "defineProperty"), 
            /*typeArguments*/ undefined, [
                receiver,
                createExpressionForPropertyName(property.name),
                ts.createObjectLiteral(properties, multiLine)
            ]), 
            /*location*/ firstAccessor);
            return ts.aggregateTransformFlags(expression);
        }
        return undefined;
    }
    function createExpressionForPropertyAssignment(property, receiver) {
        return ts.aggregateTransformFlags(ts.setOriginalNode(ts.setTextRange(ts.createAssignment(createMemberAccessForPropertyName(receiver, property.name, /*location*/ property.name), property.initializer), property), property));
    }
    function createExpressionForShorthandPropertyAssignment(property, receiver) {
        return ts.aggregateTransformFlags(ts.setOriginalNode(ts.setTextRange(ts.createAssignment(createMemberAccessForPropertyName(receiver, property.name, /*location*/ property.name), ts.getSynthesizedClone(property.name)), 
        /*location*/ property), 
        /*original*/ property));
    }
    function createExpressionForMethodDeclaration(method, receiver) {
        return ts.aggregateTransformFlags(ts.setOriginalNode(ts.setTextRange(ts.createAssignment(createMemberAccessForPropertyName(receiver, method.name, /*location*/ method.name), ts.setOriginalNode(ts.setTextRange(ts.createFunctionExpression(method.modifiers, method.asteriskToken, 
        /*name*/ undefined, 
        /*typeParameters*/ undefined, method.parameters, 
        /*type*/ undefined, method.body), 
        /*location*/ method), 
        /*original*/ method)), 
        /*location*/ method), 
        /*original*/ method));
    }
    /**
     * Gets the internal name of a declaration. This is primarily used for declarations that can be
     * referred to by name in the body of an ES5 class function body. An internal name will *never*
     * be prefixed with an module or namespace export modifier like "exports." when emitted as an
     * expression. An internal name will also *never* be renamed due to a collision with a block
     * scoped variable.
     *
     * @param node The declaration.
     * @param allowComments A value indicating whether comments may be emitted for the name.
     * @param allowSourceMaps A value indicating whether source maps may be emitted for the name.
     */
    function getInternalName(node, allowComments, allowSourceMaps) {
        return getName(node, allowComments, allowSourceMaps, ts.EmitFlags.LocalName | ts.EmitFlags.InternalName);
    }
    ts.getInternalName = getInternalName;
    /**
     * Gets whether an identifier should only be referred to by its internal name.
     */
    function isInternalName(node) {
        return (ts.getEmitFlags(node) & ts.EmitFlags.InternalName) !== 0;
    }
    ts.isInternalName = isInternalName;
    /**
     * Gets the local name of a declaration. This is primarily used for declarations that can be
     * referred to by name in the declaration's immediate scope (classes, enums, namespaces). A
     * local name will *never* be prefixed with an module or namespace export modifier like
     * "exports." when emitted as an expression.
     *
     * @param node The declaration.
     * @param allowComments A value indicating whether comments may be emitted for the name.
     * @param allowSourceMaps A value indicating whether source maps may be emitted for the name.
     */
    function getLocalName(node, allowComments, allowSourceMaps) {
        return getName(node, allowComments, allowSourceMaps, ts.EmitFlags.LocalName);
    }
    ts.getLocalName = getLocalName;
    /**
     * Gets whether an identifier should only be referred to by its local name.
     */
    function isLocalName(node) {
        return (ts.getEmitFlags(node) & ts.EmitFlags.LocalName) !== 0;
    }
    ts.isLocalName = isLocalName;
    /**
     * Gets the export name of a declaration. This is primarily used for declarations that can be
     * referred to by name in the declaration's immediate scope (classes, enums, namespaces). An
     * export name will *always* be prefixed with an module or namespace export modifier like
     * `"exports."` when emitted as an expression if the name points to an exported symbol.
     *
     * @param node The declaration.
     * @param allowComments A value indicating whether comments may be emitted for the name.
     * @param allowSourceMaps A value indicating whether source maps may be emitted for the name.
     */
    function getExportName(node, allowComments, allowSourceMaps) {
        return getName(node, allowComments, allowSourceMaps, ts.EmitFlags.ExportName);
    }
    ts.getExportName = getExportName;
    /**
     * Gets whether an identifier should only be referred to by its export representation if the
     * name points to an exported symbol.
     */
    function isExportName(node) {
        return (ts.getEmitFlags(node) & ts.EmitFlags.ExportName) !== 0;
    }
    ts.isExportName = isExportName;
    /**
     * Gets the name of a declaration for use in declarations.
     *
     * @param node The declaration.
     * @param allowComments A value indicating whether comments may be emitted for the name.
     * @param allowSourceMaps A value indicating whether source maps may be emitted for the name.
     */
    function getDeclarationName(node, allowComments, allowSourceMaps) {
        return getName(node, allowComments, allowSourceMaps);
    }
    ts.getDeclarationName = getDeclarationName;
    function getName(node, allowComments, allowSourceMaps, emitFlags) {
        const nodeName = ts.getNameOfDeclaration(node);
        if (nodeName && ts.isIdentifier(nodeName) && !ts.isGeneratedIdentifier(nodeName)) {
            const name = ts.getMutableClone(nodeName);
            emitFlags |= ts.getEmitFlags(nodeName);
            if (!allowSourceMaps)
                emitFlags |= ts.EmitFlags.NoSourceMap;
            if (!allowComments)
                emitFlags |= ts.EmitFlags.NoComments;
            if (emitFlags)
                ts.setEmitFlags(name, emitFlags);
            return name;
        }
        return ts.getGeneratedNameForNode(node);
    }
    /**
     * Gets the exported name of a declaration for use in expressions.
     *
     * An exported name will *always* be prefixed with an module or namespace export modifier like
     * "exports." if the name points to an exported symbol.
     *
     * @param ns The namespace identifier.
     * @param node The declaration.
     * @param allowComments A value indicating whether comments may be emitted for the name.
     * @param allowSourceMaps A value indicating whether source maps may be emitted for the name.
     */
    function getExternalModuleOrNamespaceExportName(ns, node, allowComments, allowSourceMaps) {
        if (ns && ts.hasModifier(node, ts.ModifierFlags.Export)) {
            return getNamespaceMemberName(ns, getName(node), allowComments, allowSourceMaps);
        }
        return getExportName(node, allowComments, allowSourceMaps);
    }
    ts.getExternalModuleOrNamespaceExportName = getExternalModuleOrNamespaceExportName;
    /**
     * Gets a namespace-qualified name for use in expressions.
     *
     * @param ns The namespace identifier.
     * @param name The name.
     * @param allowComments A value indicating whether comments may be emitted for the name.
     * @param allowSourceMaps A value indicating whether source maps may be emitted for the name.
     */
    function getNamespaceMemberName(ns, name, allowComments, allowSourceMaps) {
        const qualifiedName = ts.createPropertyAccess(ns, ts.nodeIsSynthesized(name) ? name : ts.getSynthesizedClone(name));
        ts.setTextRange(qualifiedName, name);
        let emitFlags;
        if (!allowSourceMaps)
            emitFlags |= ts.EmitFlags.NoSourceMap;
        if (!allowComments)
            emitFlags |= ts.EmitFlags.NoComments;
        if (emitFlags)
            ts.setEmitFlags(qualifiedName, emitFlags);
        return qualifiedName;
    }
    ts.getNamespaceMemberName = getNamespaceMemberName;
    function convertToFunctionBody(node, multiLine) {
        return ts.isBlock(node) ? node : ts.setTextRange(ts.createBlock([ts.setTextRange(ts.createReturn(node), node)], multiLine), node);
    }
    ts.convertToFunctionBody = convertToFunctionBody;
    function convertFunctionDeclarationToExpression(node) {
        ts.Debug.assert(!!node.body);
        const updated = ts.createFunctionExpression(node.modifiers, node.asteriskToken, node.name, node.typeParameters, node.parameters, node.type, node.body);
        ts.setOriginalNode(updated, node);
        ts.setTextRange(updated, node);
        if (ts.getStartsOnNewLine(node)) {
            ts.setStartsOnNewLine(updated, /*newLine*/ true);
        }
        ts.aggregateTransformFlags(updated);
        return updated;
    }
    ts.convertFunctionDeclarationToExpression = convertFunctionDeclarationToExpression;
    function isUseStrictPrologue(node) {
        return ts.isStringLiteral(node.expression) && node.expression.text === "use strict";
    }
    /**
     * Add any necessary prologue-directives into target statement-array.
     * The function needs to be called during each transformation step.
     * This function needs to be called whenever we transform the statement
     * list of a source file, namespace, or function-like body.
     *
     * @param target: result statements array
     * @param source: origin statements array
     * @param ensureUseStrict: boolean determining whether the function need to add prologue-directives
     * @param visitor: Optional callback used to visit any custom prologue directives.
     */
    function addPrologue(target, source, ensureUseStrict, visitor) {
        const offset = addStandardPrologue(target, source, ensureUseStrict);
        return addCustomPrologue(target, source, offset, visitor);
    }
    ts.addPrologue = addPrologue;
    /**
     * Add just the standard (string-expression) prologue-directives into target statement-array.
     * The function needs to be called during each transformation step.
     * This function needs to be called whenever we transform the statement
     * list of a source file, namespace, or function-like body.
     */
    function addStandardPrologue(target, source, ensureUseStrict) {
        ts.Debug.assert(target.length === 0, "Prologue directives should be at the first statement in the target statements array");
        let foundUseStrict = false;
        let statementOffset = 0;
        const numStatements = source.length;
        while (statementOffset < numStatements) {
            const statement = source[statementOffset];
            if (ts.isPrologueDirective(statement)) {
                if (isUseStrictPrologue(statement)) {
                    foundUseStrict = true;
                }
                target.push(statement);
            }
            else {
                break;
            }
            statementOffset++;
        }
        if (ensureUseStrict && !foundUseStrict) {
            target.push(startOnNewLine(ts.createStatement(ts.createLiteral("use strict"))));
        }
        return statementOffset;
    }
    ts.addStandardPrologue = addStandardPrologue;
    /**
     * Add just the custom prologue-directives into target statement-array.
     * The function needs to be called during each transformation step.
     * This function needs to be called whenever we transform the statement
     * list of a source file, namespace, or function-like body.
     */
    function addCustomPrologue(target, source, statementOffset, visitor) {
        const numStatements = source.length;
        while (statementOffset < numStatements) {
            const statement = source[statementOffset];
            if (ts.getEmitFlags(statement) & ts.EmitFlags.CustomPrologue) {
                ts.append(target, visitor ? ts.visitNode(statement, visitor, ts.isStatement) : statement);
            }
            else {
                break;
            }
            statementOffset++;
        }
        return statementOffset;
    }
    ts.addCustomPrologue = addCustomPrologue;
    function startsWithUseStrict(statements) {
        const firstStatement = ts.firstOrUndefined(statements);
        return firstStatement !== undefined
            && ts.isPrologueDirective(firstStatement)
            && isUseStrictPrologue(firstStatement);
    }
    ts.startsWithUseStrict = startsWithUseStrict;
    /**
     * Ensures "use strict" directive is added
     *
     * @param statements An array of statements
     */
    function ensureUseStrict(statements) {
        let foundUseStrict = false;
        for (const statement of statements) {
            if (ts.isPrologueDirective(statement)) {
                if (isUseStrictPrologue(statement)) {
                    foundUseStrict = true;
                    break;
                }
            }
            else {
                break;
            }
        }
        if (!foundUseStrict) {
            return ts.setTextRange(ts.createNodeArray([
                startOnNewLine(ts.createStatement(ts.createLiteral("use strict"))),
                ...statements
            ]), statements);
        }
        return statements;
    }
    ts.ensureUseStrict = ensureUseStrict;
    /**
     * Wraps the operand to a BinaryExpression in parentheses if they are needed to preserve the intended
     * order of operations.
     *
     * @param binaryOperator The operator for the BinaryExpression.
     * @param operand The operand for the BinaryExpression.
     * @param isLeftSideOfBinary A value indicating whether the operand is the left side of the
     *                           BinaryExpression.
     */
    function parenthesizeBinaryOperand(binaryOperator, operand, isLeftSideOfBinary, leftOperand) {
        const skipped = ts.skipPartiallyEmittedExpressions(operand);
        // If the resulting expression is already parenthesized, we do not need to do any further processing.
        if (skipped.kind === ts.SyntaxKind.ParenthesizedExpression) {
            return operand;
        }
        return binaryOperandNeedsParentheses(binaryOperator, operand, isLeftSideOfBinary, leftOperand)
            ? ts.createParen(operand)
            : operand;
    }
    ts.parenthesizeBinaryOperand = parenthesizeBinaryOperand;
    /**
     * Determines whether the operand to a BinaryExpression needs to be parenthesized.
     *
     * @param binaryOperator The operator for the BinaryExpression.
     * @param operand The operand for the BinaryExpression.
     * @param isLeftSideOfBinary A value indicating whether the operand is the left side of the
     *                           BinaryExpression.
     */
    function binaryOperandNeedsParentheses(binaryOperator, operand, isLeftSideOfBinary, leftOperand) {
        // If the operand has lower precedence, then it needs to be parenthesized to preserve the
        // intent of the expression. For example, if the operand is `a + b` and the operator is
        // `*`, then we need to parenthesize the operand to preserve the intended order of
        // operations: `(a + b) * x`.
        //
        // If the operand has higher precedence, then it does not need to be parenthesized. For
        // example, if the operand is `a * b` and the operator is `+`, then we do not need to
        // parenthesize to preserve the intended order of operations: `a * b + x`.
        //
        // If the operand has the same precedence, then we need to check the associativity of
        // the operator based on whether this is the left or right operand of the expression.
        //
        // For example, if `a / d` is on the right of operator `*`, we need to parenthesize
        // to preserve the intended order of operations: `x * (a / d)`
        //
        // If `a ** d` is on the left of operator `**`, we need to parenthesize to preserve
        // the intended order of operations: `(a ** b) ** c`
        const binaryOperatorPrecedence = ts.getOperatorPrecedence(ts.SyntaxKind.BinaryExpression, binaryOperator);
        const binaryOperatorAssociativity = ts.getOperatorAssociativity(ts.SyntaxKind.BinaryExpression, binaryOperator);
        const emittedOperand = ts.skipPartiallyEmittedExpressions(operand);
        const operandPrecedence = ts.getExpressionPrecedence(emittedOperand);
        switch (ts.compareValues(operandPrecedence, binaryOperatorPrecedence)) {
            case -1 /* LessThan */:
                // If the operand is the right side of a right-associative binary operation
                // and is a yield expression, then we do not need parentheses.
                if (!isLeftSideOfBinary
                    && binaryOperatorAssociativity === 1 /* Right */
                    && operand.kind === ts.SyntaxKind.YieldExpression) {
                    return false;
                }
                return true;
            case 1 /* GreaterThan */:
                return false;
            case 0 /* EqualTo */:
                if (isLeftSideOfBinary) {
                    // No need to parenthesize the left operand when the binary operator is
                    // left associative:
                    //  (a*b)/x    -> a*b/x
                    //  (a**b)/x   -> a**b/x
                    //
                    // Parentheses are needed for the left operand when the binary operator is
                    // right associative:
                    //  (a/b)**x   -> (a/b)**x
                    //  (a**b)**x  -> (a**b)**x
                    return binaryOperatorAssociativity === 1 /* Right */;
                }
                else {
                    if (ts.isBinaryExpression(emittedOperand)
                        && emittedOperand.operatorToken.kind === binaryOperator) {
                        // No need to parenthesize the right operand when the binary operator and
                        // operand are the same and one of the following:
                        //  x*(a*b)     => x*a*b
                        //  x|(a|b)     => x|a|b
                        //  x&(a&b)     => x&a&b
                        //  x^(a^b)     => x^a^b
                        if (operatorHasAssociativeProperty(binaryOperator)) {
                            return false;
                        }
                        // No need to parenthesize the right operand when the binary operator
                        // is plus (+) if both the left and right operands consist solely of either
                        // literals of the same kind or binary plus (+) expressions for literals of
                        // the same kind (recursively).
                        //  "a"+(1+2)       => "a"+(1+2)
                        //  "a"+("b"+"c")   => "a"+"b"+"c"
                        if (binaryOperator === ts.SyntaxKind.PlusToken) {
                            const leftKind = leftOperand ? getLiteralKindOfBinaryPlusOperand(leftOperand) : ts.SyntaxKind.Unknown;
                            if (ts.isLiteralKind(leftKind) && leftKind === getLiteralKindOfBinaryPlusOperand(emittedOperand)) {
                                return false;
                            }
                        }
                    }
                    // No need to parenthesize the right operand when the operand is right
                    // associative:
                    //  x/(a**b)    -> x/a**b
                    //  x**(a**b)   -> x**a**b
                    //
                    // Parentheses are needed for the right operand when the operand is left
                    // associative:
                    //  x/(a*b)     -> x/(a*b)
                    //  x**(a/b)    -> x**(a/b)
                    const operandAssociativity = ts.getExpressionAssociativity(emittedOperand);
                    return operandAssociativity === 0 /* Left */;
                }
        }
    }
    /**
     * Determines whether a binary operator is mathematically associative.
     *
     * @param binaryOperator The binary operator.
     */
    function operatorHasAssociativeProperty(binaryOperator) {
        // The following operators are associative in JavaScript:
        //  (a*b)*c     -> a*(b*c)  -> a*b*c
        //  (a|b)|c     -> a|(b|c)  -> a|b|c
        //  (a&b)&c     -> a&(b&c)  -> a&b&c
        //  (a^b)^c     -> a^(b^c)  -> a^b^c
        //
        // While addition is associative in mathematics, JavaScript's `+` is not
        // guaranteed to be associative as it is overloaded with string concatenation.
        return binaryOperator === ts.SyntaxKind.AsteriskToken
            || binaryOperator === ts.SyntaxKind.BarToken
            || binaryOperator === ts.SyntaxKind.AmpersandToken
            || binaryOperator === ts.SyntaxKind.CaretToken;
    }
    /**
     * This function determines whether an expression consists of a homogeneous set of
     * literal expressions or binary plus expressions that all share the same literal kind.
     * It is used to determine whether the right-hand operand of a binary plus expression can be
     * emitted without parentheses.
     */
    function getLiteralKindOfBinaryPlusOperand(node) {
        node = ts.skipPartiallyEmittedExpressions(node);
        if (ts.isLiteralKind(node.kind)) {
            return node.kind;
        }
        if (node.kind === ts.SyntaxKind.BinaryExpression && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            if (node.cachedLiteralKind !== undefined) {
                return node.cachedLiteralKind;
            }
            const leftKind = getLiteralKindOfBinaryPlusOperand(node.left);
            const literalKind = ts.isLiteralKind(leftKind)
                && leftKind === getLiteralKindOfBinaryPlusOperand(node.right)
                ? leftKind
                : ts.SyntaxKind.Unknown;
            node.cachedLiteralKind = literalKind;
            return literalKind;
        }
        return ts.SyntaxKind.Unknown;
    }
    function parenthesizeForConditionalHead(condition) {
        const conditionalPrecedence = ts.getOperatorPrecedence(ts.SyntaxKind.ConditionalExpression, ts.SyntaxKind.QuestionToken);
        const emittedCondition = ts.skipPartiallyEmittedExpressions(condition);
        const conditionPrecedence = ts.getExpressionPrecedence(emittedCondition);
        if (ts.compareValues(conditionPrecedence, conditionalPrecedence) === -1 /* LessThan */) {
            return ts.createParen(condition);
        }
        return condition;
    }
    ts.parenthesizeForConditionalHead = parenthesizeForConditionalHead;
    function parenthesizeSubexpressionOfConditionalExpression(e) {
        // per ES grammar both 'whenTrue' and 'whenFalse' parts of conditional expression are assignment expressions
        // so in case when comma expression is introduced as a part of previous transformations
        // if should be wrapped in parens since comma operator has the lowest precedence
        const emittedExpression = ts.skipPartiallyEmittedExpressions(e);
        return emittedExpression.kind === ts.SyntaxKind.BinaryExpression && emittedExpression.operatorToken.kind === ts.SyntaxKind.CommaToken ||
            emittedExpression.kind === ts.SyntaxKind.CommaListExpression
            ? ts.createParen(e)
            : e;
    }
    ts.parenthesizeSubexpressionOfConditionalExpression = parenthesizeSubexpressionOfConditionalExpression;
    /**
     *  [Per the spec](https://tc39.github.io/ecma262/#prod-ExportDeclaration), `export default` accepts _AssigmentExpression_ but
     *  has a lookahead restriction for `function`, `async function`, and `class`.
     *
     * Basically, that means we need to parenthesize in the following cases:
     *
     * - BinaryExpression of CommaToken
     * - CommaList (synthetic list of multiple comma expressions)
     * - FunctionExpression
     * - ClassExpression
     */
    function parenthesizeDefaultExpression(e) {
        const check = ts.skipPartiallyEmittedExpressions(e);
        return (check.kind === ts.SyntaxKind.ClassExpression ||
            check.kind === ts.SyntaxKind.FunctionExpression ||
            check.kind === ts.SyntaxKind.CommaListExpression ||
            ts.isBinaryExpression(check) && check.operatorToken.kind === ts.SyntaxKind.CommaToken)
            ? ts.createParen(e)
            : e;
    }
    ts.parenthesizeDefaultExpression = parenthesizeDefaultExpression;
    /**
     * Wraps an expression in parentheses if it is needed in order to use the expression
     * as the expression of a NewExpression node.
     *
     * @param expression The Expression node.
     */
    function parenthesizeForNew(expression) {
        const leftmostExpr = getLeftmostExpression(expression, /*stopAtCallExpressions*/ true);
        switch (leftmostExpr.kind) {
            case ts.SyntaxKind.CallExpression:
                return ts.createParen(expression);
            case ts.SyntaxKind.NewExpression:
                return !leftmostExpr.arguments
                    ? ts.createParen(expression)
                    : expression;
        }
        return parenthesizeForAccess(expression);
    }
    ts.parenthesizeForNew = parenthesizeForNew;
    /**
     * Wraps an expression in parentheses if it is needed in order to use the expression for
     * property or element access.
     *
     * @param expr The expression node.
     */
    function parenthesizeForAccess(expression) {
        // isLeftHandSideExpression is almost the correct criterion for when it is not necessary
        // to parenthesize the expression before a dot. The known exception is:
        //
        //    NewExpression:
        //       new C.x        -> not the same as (new C).x
        //
        const emittedExpression = ts.skipPartiallyEmittedExpressions(expression);
        if (ts.isLeftHandSideExpression(emittedExpression)
            && (emittedExpression.kind !== ts.SyntaxKind.NewExpression || emittedExpression.arguments)) {
            return expression;
        }
        return ts.setTextRange(ts.createParen(expression), expression);
    }
    ts.parenthesizeForAccess = parenthesizeForAccess;
    function parenthesizePostfixOperand(operand) {
        return ts.isLeftHandSideExpression(operand)
            ? operand
            : ts.setTextRange(ts.createParen(operand), operand);
    }
    ts.parenthesizePostfixOperand = parenthesizePostfixOperand;
    function parenthesizePrefixOperand(operand) {
        return ts.isUnaryExpression(operand)
            ? operand
            : ts.setTextRange(ts.createParen(operand), operand);
    }
    ts.parenthesizePrefixOperand = parenthesizePrefixOperand;
    function parenthesizeListElements(elements) {
        let result;
        for (let i = 0; i < elements.length; i++) {
            const element = parenthesizeExpressionForList(elements[i]);
            if (result !== undefined || element !== elements[i]) {
                if (result === undefined) {
                    result = elements.slice(0, i);
                }
                result.push(element);
            }
        }
        if (result !== undefined) {
            return ts.setTextRange(ts.createNodeArray(result, elements.hasTrailingComma), elements);
        }
        return elements;
    }
    ts.parenthesizeListElements = parenthesizeListElements;
    function parenthesizeExpressionForList(expression) {
        const emittedExpression = ts.skipPartiallyEmittedExpressions(expression);
        const expressionPrecedence = ts.getExpressionPrecedence(emittedExpression);
        const commaPrecedence = ts.getOperatorPrecedence(ts.SyntaxKind.BinaryExpression, ts.SyntaxKind.CommaToken);
        return expressionPrecedence > commaPrecedence
            ? expression
            : ts.setTextRange(ts.createParen(expression), expression);
    }
    ts.parenthesizeExpressionForList = parenthesizeExpressionForList;
    function parenthesizeExpressionForExpressionStatement(expression) {
        const emittedExpression = ts.skipPartiallyEmittedExpressions(expression);
        if (ts.isCallExpression(emittedExpression)) {
            const callee = emittedExpression.expression;
            const kind = ts.skipPartiallyEmittedExpressions(callee).kind;
            if (kind === ts.SyntaxKind.FunctionExpression || kind === ts.SyntaxKind.ArrowFunction) {
                const mutableCall = ts.getMutableClone(emittedExpression);
                mutableCall.expression = ts.setTextRange(ts.createParen(callee), callee);
                return recreateOuterExpressions(expression, mutableCall, 4 /* PartiallyEmittedExpressions */);
            }
        }
        const leftmostExpressionKind = getLeftmostExpression(emittedExpression, /*stopAtCallExpressions*/ false).kind;
        if (leftmostExpressionKind === ts.SyntaxKind.ObjectLiteralExpression || leftmostExpressionKind === ts.SyntaxKind.FunctionExpression) {
            return ts.setTextRange(ts.createParen(expression), expression);
        }
        return expression;
    }
    ts.parenthesizeExpressionForExpressionStatement = parenthesizeExpressionForExpressionStatement;
    function parenthesizeConditionalTypeMember(member) {
        return member.kind === ts.SyntaxKind.ConditionalType ? ts.createParenthesizedType(member) : member;
    }
    ts.parenthesizeConditionalTypeMember = parenthesizeConditionalTypeMember;
    function parenthesizeElementTypeMember(member) {
        switch (member.kind) {
            case ts.SyntaxKind.UnionType:
            case ts.SyntaxKind.IntersectionType:
            case ts.SyntaxKind.FunctionType:
            case ts.SyntaxKind.ConstructorType:
                return ts.createParenthesizedType(member);
        }
        return parenthesizeConditionalTypeMember(member);
    }
    ts.parenthesizeElementTypeMember = parenthesizeElementTypeMember;
    function parenthesizeArrayTypeMember(member) {
        switch (member.kind) {
            case ts.SyntaxKind.TypeQuery:
            case ts.SyntaxKind.TypeOperator:
                return ts.createParenthesizedType(member);
        }
        return parenthesizeElementTypeMember(member);
    }
    ts.parenthesizeArrayTypeMember = parenthesizeArrayTypeMember;
    function parenthesizeElementTypeMembers(members) {
        return ts.createNodeArray(ts.sameMap(members, parenthesizeElementTypeMember));
    }
    ts.parenthesizeElementTypeMembers = parenthesizeElementTypeMembers;
    function parenthesizeTypeParameters(typeParameters) {
        if (ts.some(typeParameters)) {
            const params = [];
            for (let i = 0; i < typeParameters.length; ++i) {
                const entry = typeParameters[i];
                params.push(i === 0 && ts.isFunctionOrConstructorTypeNode(entry) && entry.typeParameters ?
                    ts.createParenthesizedType(entry) :
                    entry);
            }
            return ts.createNodeArray(params);
        }
    }
    ts.parenthesizeTypeParameters = parenthesizeTypeParameters;
    function getLeftmostExpression(node, stopAtCallExpressions) {
        while (true) {
            switch (node.kind) {
                case ts.SyntaxKind.PostfixUnaryExpression:
                    node = node.operand;
                    continue;
                case ts.SyntaxKind.BinaryExpression:
                    node = node.left;
                    continue;
                case ts.SyntaxKind.ConditionalExpression:
                    node = node.condition;
                    continue;
                case ts.SyntaxKind.CallExpression:
                    if (stopAtCallExpressions) {
                        return node;
                    }
                // falls through
                case ts.SyntaxKind.ElementAccessExpression:
                case ts.SyntaxKind.PropertyAccessExpression:
                    node = node.expression;
                    continue;
                case ts.SyntaxKind.PartiallyEmittedExpression:
                    node = node.expression;
                    continue;
            }
            return node;
        }
    }
    function parenthesizeConciseBody(body) {
        if (!ts.isBlock(body) && getLeftmostExpression(body, /*stopAtCallExpressions*/ false).kind === ts.SyntaxKind.ObjectLiteralExpression) {
            return ts.setTextRange(ts.createParen(body), body);
        }
        return body;
    }
    ts.parenthesizeConciseBody = parenthesizeConciseBody;
    function isOuterExpression(node, kinds = 7 /* All */) {
        switch (node.kind) {
            case ts.SyntaxKind.ParenthesizedExpression:
                return (kinds & 1 /* Parentheses */) !== 0;
            case ts.SyntaxKind.TypeAssertionExpression:
            case ts.SyntaxKind.AsExpression:
            case ts.SyntaxKind.NonNullExpression:
                return (kinds & 2 /* Assertions */) !== 0;
            case ts.SyntaxKind.PartiallyEmittedExpression:
                return (kinds & 4 /* PartiallyEmittedExpressions */) !== 0;
        }
        return false;
    }
    ts.isOuterExpression = isOuterExpression;
    function skipOuterExpressions(node, kinds = 7 /* All */) {
        let previousNode;
        do {
            previousNode = node;
            if (kinds & 1 /* Parentheses */) {
                node = ts.skipParentheses(node);
            }
            if (kinds & 2 /* Assertions */) {
                node = skipAssertions(node);
            }
            if (kinds & 4 /* PartiallyEmittedExpressions */) {
                node = ts.skipPartiallyEmittedExpressions(node);
            }
        } while (previousNode !== node);
        return node;
    }
    ts.skipOuterExpressions = skipOuterExpressions;
    function skipAssertions(node) {
        while (ts.isAssertionExpression(node) || node.kind === ts.SyntaxKind.NonNullExpression) {
            node = node.expression;
        }
        return node;
    }
    ts.skipAssertions = skipAssertions;
    function updateOuterExpression(outerExpression, expression) {
        switch (outerExpression.kind) {
            case ts.SyntaxKind.ParenthesizedExpression: return ts.updateParen(outerExpression, expression);
            case ts.SyntaxKind.TypeAssertionExpression: return ts.updateTypeAssertion(outerExpression, outerExpression.type, expression);
            case ts.SyntaxKind.AsExpression: return ts.updateAsExpression(outerExpression, expression, outerExpression.type);
            case ts.SyntaxKind.NonNullExpression: return ts.updateNonNullExpression(outerExpression, expression);
            case ts.SyntaxKind.PartiallyEmittedExpression: return ts.updatePartiallyEmittedExpression(outerExpression, expression);
        }
    }
    /**
     * Determines whether a node is a parenthesized expression that can be ignored when recreating outer expressions.
     *
     * A parenthesized expression can be ignored when all of the following are true:
     *
     * - It's `pos` and `end` are not -1
     * - It does not have a custom source map range
     * - It does not have a custom comment range
     * - It does not have synthetic leading or trailing comments
     *
     * If an outermost parenthesized expression is ignored, but the containing expression requires a parentheses around
     * the expression to maintain precedence, a new parenthesized expression should be created automatically when
     * the containing expression is created/updated.
     */
    function isIgnorableParen(node) {
        return node.kind === ts.SyntaxKind.ParenthesizedExpression
            && ts.nodeIsSynthesized(node)
            && ts.nodeIsSynthesized(ts.getSourceMapRange(node))
            && ts.nodeIsSynthesized(ts.getCommentRange(node))
            && !ts.some(ts.getSyntheticLeadingComments(node))
            && !ts.some(ts.getSyntheticTrailingComments(node));
    }
    function recreateOuterExpressions(outerExpression, innerExpression, kinds = 7 /* All */) {
        if (outerExpression && isOuterExpression(outerExpression, kinds) && !isIgnorableParen(outerExpression)) {
            return updateOuterExpression(outerExpression, recreateOuterExpressions(outerExpression.expression, innerExpression));
        }
        return innerExpression;
    }
    ts.recreateOuterExpressions = recreateOuterExpressions;
    function startOnNewLine(node) {
        return ts.setStartsOnNewLine(node, /*newLine*/ true);
    }
    ts.startOnNewLine = startOnNewLine;
    function getExternalHelpersModuleName(node) {
        const parseNode = ts.getOriginalNode(node, ts.isSourceFile);
        const emitNode = parseNode && parseNode.emitNode;
        return emitNode && emitNode.externalHelpersModuleName;
    }
    ts.getExternalHelpersModuleName = getExternalHelpersModuleName;
    function getOrCreateExternalHelpersModuleNameIfNeeded(node, compilerOptions, hasExportStarsToExportValues, hasImportStarOrImportDefault) {
        if (compilerOptions.importHelpers && ts.isEffectiveExternalModule(node, compilerOptions)) {
            const externalHelpersModuleName = getExternalHelpersModuleName(node);
            if (externalHelpersModuleName) {
                return externalHelpersModuleName;
            }
            const moduleKind = ts.getEmitModuleKind(compilerOptions);
            let create = (hasExportStarsToExportValues || (compilerOptions.esModuleInterop && hasImportStarOrImportDefault))
                && moduleKind !== ts.ModuleKind.System
                && moduleKind !== ts.ModuleKind.ES2015
                && moduleKind !== ts.ModuleKind.ESNext;
            if (!create) {
                const helpers = ts.getEmitHelpers(node);
                if (helpers) {
                    for (const helper of helpers) {
                        if (!helper.scoped) {
                            create = true;
                            break;
                        }
                    }
                }
            }
            if (create) {
                const parseNode = ts.getOriginalNode(node, ts.isSourceFile);
                const emitNode = ts.getOrCreateEmitNode(parseNode);
                return emitNode.externalHelpersModuleName || (emitNode.externalHelpersModuleName = ts.createUniqueName(ts.externalHelpersModuleNameText));
            }
        }
    }
    ts.getOrCreateExternalHelpersModuleNameIfNeeded = getOrCreateExternalHelpersModuleNameIfNeeded;
    /**
     * Get the name of that target module from an import or export declaration
     */
    function getLocalNameForExternalImport(node, sourceFile) {
        const namespaceDeclaration = ts.getNamespaceDeclarationNode(node);
        if (namespaceDeclaration && !ts.isDefaultImport(node)) {
            const name = namespaceDeclaration.name;
            return ts.isGeneratedIdentifier(name) ? name : ts.createIdentifier(ts.getSourceTextOfNodeFromSourceFile(sourceFile, name) || ts.idText(name));
        }
        if (node.kind === ts.SyntaxKind.ImportDeclaration && node.importClause) {
            return ts.getGeneratedNameForNode(node);
        }
        if (node.kind === ts.SyntaxKind.ExportDeclaration && node.moduleSpecifier) {
            return ts.getGeneratedNameForNode(node);
        }
        return undefined;
    }
    ts.getLocalNameForExternalImport = getLocalNameForExternalImport;
    /**
     * Get the name of a target module from an import/export declaration as should be written in the emitted output.
     * The emitted output name can be different from the input if:
     *  1. The module has a /// <amd-module name="<new name>" />
     *  2. --out or --outFile is used, making the name relative to the rootDir
     *  3- The containing SourceFile has an entry in renamedDependencies for the import as requested by some module loaders (e.g. System).
     * Otherwise, a new StringLiteral node representing the module name will be returned.
     */
    function getExternalModuleNameLiteral(importNode, sourceFile, host, resolver, compilerOptions) {
        const moduleName = ts.getExternalModuleName(importNode);
        if (moduleName.kind === ts.SyntaxKind.StringLiteral) {
            return tryGetModuleNameFromDeclaration(importNode, host, resolver, compilerOptions)
                || tryRenameExternalModule(moduleName, sourceFile)
                || ts.getSynthesizedClone(moduleName);
        }
        return undefined;
    }
    ts.getExternalModuleNameLiteral = getExternalModuleNameLiteral;
    /**
     * Some bundlers (SystemJS builder) sometimes want to rename dependencies.
     * Here we check if alternative name was provided for a given moduleName and return it if possible.
     */
    function tryRenameExternalModule(moduleName, sourceFile) {
        const rename = sourceFile.renamedDependencies && sourceFile.renamedDependencies.get(moduleName.text);
        return rename && ts.createLiteral(rename);
    }
    /**
     * Get the name of a module as should be written in the emitted output.
     * The emitted output name can be different from the input if:
     *  1. The module has a /// <amd-module name="<new name>" />
     *  2. --out or --outFile is used, making the name relative to the rootDir
     * Otherwise, a new StringLiteral node representing the module name will be returned.
     */
    function tryGetModuleNameFromFile(file, host, options) {
        if (!file) {
            return undefined;
        }
        if (file.moduleName) {
            return ts.createLiteral(file.moduleName);
        }
        if (!file.isDeclarationFile && (options.out || options.outFile)) {
            return ts.createLiteral(ts.getExternalModuleNameFromPath(host, file.fileName));
        }
        return undefined;
    }
    ts.tryGetModuleNameFromFile = tryGetModuleNameFromFile;
    function tryGetModuleNameFromDeclaration(declaration, host, resolver, compilerOptions) {
        return tryGetModuleNameFromFile(resolver.getExternalModuleFileFromDeclaration(declaration), host, compilerOptions);
    }
    /**
     * Gets the initializer of an BindingOrAssignmentElement.
     */
    function getInitializerOfBindingOrAssignmentElement(bindingElement) {
        if (ts.isDeclarationBindingElement(bindingElement)) {
            // `1` in `let { a = 1 } = ...`
            // `1` in `let { a: b = 1 } = ...`
            // `1` in `let { a: {b} = 1 } = ...`
            // `1` in `let { a: [b] = 1 } = ...`
            // `1` in `let [a = 1] = ...`
            // `1` in `let [{a} = 1] = ...`
            // `1` in `let [[a] = 1] = ...`
            return bindingElement.initializer;
        }
        if (ts.isPropertyAssignment(bindingElement)) {
            // `1` in `({ a: b = 1 } = ...)`
            // `1` in `({ a: {b} = 1 } = ...)`
            // `1` in `({ a: [b] = 1 } = ...)`
            return ts.isAssignmentExpression(bindingElement.initializer, /*excludeCompoundAssignment*/ true)
                ? bindingElement.initializer.right
                : undefined;
        }
        if (ts.isShorthandPropertyAssignment(bindingElement)) {
            // `1` in `({ a = 1 } = ...)`
            return bindingElement.objectAssignmentInitializer;
        }
        if (ts.isAssignmentExpression(bindingElement, /*excludeCompoundAssignment*/ true)) {
            // `1` in `[a = 1] = ...`
            // `1` in `[{a} = 1] = ...`
            // `1` in `[[a] = 1] = ...`
            return bindingElement.right;
        }
        if (ts.isSpreadElement(bindingElement)) {
            // Recovery consistent with existing emit.
            return getInitializerOfBindingOrAssignmentElement(bindingElement.expression);
        }
    }
    ts.getInitializerOfBindingOrAssignmentElement = getInitializerOfBindingOrAssignmentElement;
    /**
     * Gets the name of an BindingOrAssignmentElement.
     */
    function getTargetOfBindingOrAssignmentElement(bindingElement) {
        if (ts.isDeclarationBindingElement(bindingElement)) {
            // `a` in `let { a } = ...`
            // `a` in `let { a = 1 } = ...`
            // `b` in `let { a: b } = ...`
            // `b` in `let { a: b = 1 } = ...`
            // `a` in `let { ...a } = ...`
            // `{b}` in `let { a: {b} } = ...`
            // `{b}` in `let { a: {b} = 1 } = ...`
            // `[b]` in `let { a: [b] } = ...`
            // `[b]` in `let { a: [b] = 1 } = ...`
            // `a` in `let [a] = ...`
            // `a` in `let [a = 1] = ...`
            // `a` in `let [...a] = ...`
            // `{a}` in `let [{a}] = ...`
            // `{a}` in `let [{a} = 1] = ...`
            // `[a]` in `let [[a]] = ...`
            // `[a]` in `let [[a] = 1] = ...`
            return bindingElement.name;
        }
        if (ts.isObjectLiteralElementLike(bindingElement)) {
            switch (bindingElement.kind) {
                case ts.SyntaxKind.PropertyAssignment:
                    // `b` in `({ a: b } = ...)`
                    // `b` in `({ a: b = 1 } = ...)`
                    // `{b}` in `({ a: {b} } = ...)`
                    // `{b}` in `({ a: {b} = 1 } = ...)`
                    // `[b]` in `({ a: [b] } = ...)`
                    // `[b]` in `({ a: [b] = 1 } = ...)`
                    // `b.c` in `({ a: b.c } = ...)`
                    // `b.c` in `({ a: b.c = 1 } = ...)`
                    // `b[0]` in `({ a: b[0] } = ...)`
                    // `b[0]` in `({ a: b[0] = 1 } = ...)`
                    return getTargetOfBindingOrAssignmentElement(bindingElement.initializer);
                case ts.SyntaxKind.ShorthandPropertyAssignment:
                    // `a` in `({ a } = ...)`
                    // `a` in `({ a = 1 } = ...)`
                    return bindingElement.name;
                case ts.SyntaxKind.SpreadAssignment:
                    // `a` in `({ ...a } = ...)`
                    return getTargetOfBindingOrAssignmentElement(bindingElement.expression);
            }
            // no target
            return undefined;
        }
        if (ts.isAssignmentExpression(bindingElement, /*excludeCompoundAssignment*/ true)) {
            // `a` in `[a = 1] = ...`
            // `{a}` in `[{a} = 1] = ...`
            // `[a]` in `[[a] = 1] = ...`
            // `a.b` in `[a.b = 1] = ...`
            // `a[0]` in `[a[0] = 1] = ...`
            return getTargetOfBindingOrAssignmentElement(bindingElement.left);
        }
        if (ts.isSpreadElement(bindingElement)) {
            // `a` in `[...a] = ...`
            return getTargetOfBindingOrAssignmentElement(bindingElement.expression);
        }
        // `a` in `[a] = ...`
        // `{a}` in `[{a}] = ...`
        // `[a]` in `[[a]] = ...`
        // `a.b` in `[a.b] = ...`
        // `a[0]` in `[a[0]] = ...`
        return bindingElement;
    }
    ts.getTargetOfBindingOrAssignmentElement = getTargetOfBindingOrAssignmentElement;
    /**
     * Determines whether an BindingOrAssignmentElement is a rest element.
     */
    function getRestIndicatorOfBindingOrAssignmentElement(bindingElement) {
        switch (bindingElement.kind) {
            case ts.SyntaxKind.Parameter:
            case ts.SyntaxKind.BindingElement:
                // `...` in `let [...a] = ...`
                return bindingElement.dotDotDotToken;
            case ts.SyntaxKind.SpreadElement:
            case ts.SyntaxKind.SpreadAssignment:
                // `...` in `[...a] = ...`
                return bindingElement;
        }
        return undefined;
    }
    ts.getRestIndicatorOfBindingOrAssignmentElement = getRestIndicatorOfBindingOrAssignmentElement;
    /**
     * Gets the property name of a BindingOrAssignmentElement
     */
    function getPropertyNameOfBindingOrAssignmentElement(bindingElement) {
        switch (bindingElement.kind) {
            case ts.SyntaxKind.BindingElement:
                // `a` in `let { a: b } = ...`
                // `[a]` in `let { [a]: b } = ...`
                // `"a"` in `let { "a": b } = ...`
                // `1` in `let { 1: b } = ...`
                if (bindingElement.propertyName) {
                    const propertyName = bindingElement.propertyName;
                    return ts.isComputedPropertyName(propertyName) && ts.isStringOrNumericLiteral(propertyName.expression)
                        ? propertyName.expression
                        : propertyName;
                }
                break;
            case ts.SyntaxKind.PropertyAssignment:
                // `a` in `({ a: b } = ...)`
                // `[a]` in `({ [a]: b } = ...)`
                // `"a"` in `({ "a": b } = ...)`
                // `1` in `({ 1: b } = ...)`
                if (bindingElement.name) {
                    const propertyName = bindingElement.name;
                    return ts.isComputedPropertyName(propertyName) && ts.isStringOrNumericLiteral(propertyName.expression)
                        ? propertyName.expression
                        : propertyName;
                }
                break;
            case ts.SyntaxKind.SpreadAssignment:
                // `a` in `({ ...a } = ...)`
                return bindingElement.name;
        }
        const target = getTargetOfBindingOrAssignmentElement(bindingElement);
        if (target && ts.isPropertyName(target)) {
            return ts.isComputedPropertyName(target) && ts.isStringOrNumericLiteral(target.expression)
                ? target.expression
                : target;
        }
        ts.Debug.fail("Invalid property name for binding element.");
    }
    ts.getPropertyNameOfBindingOrAssignmentElement = getPropertyNameOfBindingOrAssignmentElement;
    /**
     * Gets the elements of a BindingOrAssignmentPattern
     */
    function getElementsOfBindingOrAssignmentPattern(name) {
        switch (name.kind) {
            case ts.SyntaxKind.ObjectBindingPattern:
            case ts.SyntaxKind.ArrayBindingPattern:
            case ts.SyntaxKind.ArrayLiteralExpression:
                // `a` in `{a}`
                // `a` in `[a]`
                return name.elements;
            case ts.SyntaxKind.ObjectLiteralExpression:
                // `a` in `{a}`
                return name.properties;
        }
    }
    ts.getElementsOfBindingOrAssignmentPattern = getElementsOfBindingOrAssignmentPattern;
    function convertToArrayAssignmentElement(element) {
        if (ts.isBindingElement(element)) {
            if (element.dotDotDotToken) {
                ts.Debug.assertNode(element.name, ts.isIdentifier);
                return ts.setOriginalNode(ts.setTextRange(ts.createSpread(element.name), element), element);
            }
            const expression = convertToAssignmentElementTarget(element.name);
            return element.initializer
                ? ts.setOriginalNode(ts.setTextRange(ts.createAssignment(expression, element.initializer), element), element)
                : expression;
        }
        ts.Debug.assertNode(element, ts.isExpression);
        return element;
    }
    ts.convertToArrayAssignmentElement = convertToArrayAssignmentElement;
    function convertToObjectAssignmentElement(element) {
        if (ts.isBindingElement(element)) {
            if (element.dotDotDotToken) {
                ts.Debug.assertNode(element.name, ts.isIdentifier);
                return ts.setOriginalNode(ts.setTextRange(ts.createSpreadAssignment(element.name), element), element);
            }
            if (element.propertyName) {
                const expression = convertToAssignmentElementTarget(element.name);
                return ts.setOriginalNode(ts.setTextRange(ts.createPropertyAssignment(element.propertyName, element.initializer ? ts.createAssignment(expression, element.initializer) : expression), element), element);
            }
            ts.Debug.assertNode(element.name, ts.isIdentifier);
            return ts.setOriginalNode(ts.setTextRange(ts.createShorthandPropertyAssignment(element.name, element.initializer), element), element);
        }
        ts.Debug.assertNode(element, ts.isObjectLiteralElementLike);
        return element;
    }
    ts.convertToObjectAssignmentElement = convertToObjectAssignmentElement;
    function convertToAssignmentPattern(node) {
        switch (node.kind) {
            case ts.SyntaxKind.ArrayBindingPattern:
            case ts.SyntaxKind.ArrayLiteralExpression:
                return convertToArrayAssignmentPattern(node);
            case ts.SyntaxKind.ObjectBindingPattern:
            case ts.SyntaxKind.ObjectLiteralExpression:
                return convertToObjectAssignmentPattern(node);
        }
    }
    ts.convertToAssignmentPattern = convertToAssignmentPattern;
    function convertToObjectAssignmentPattern(node) {
        if (ts.isObjectBindingPattern(node)) {
            return ts.setOriginalNode(ts.setTextRange(ts.createObjectLiteral(ts.map(node.elements, convertToObjectAssignmentElement)), node), node);
        }
        ts.Debug.assertNode(node, ts.isObjectLiteralExpression);
        return node;
    }
    ts.convertToObjectAssignmentPattern = convertToObjectAssignmentPattern;
    function convertToArrayAssignmentPattern(node) {
        if (ts.isArrayBindingPattern(node)) {
            return ts.setOriginalNode(ts.setTextRange(ts.createArrayLiteral(ts.map(node.elements, convertToArrayAssignmentElement)), node), node);
        }
        ts.Debug.assertNode(node, ts.isArrayLiteralExpression);
        return node;
    }
    ts.convertToArrayAssignmentPattern = convertToArrayAssignmentPattern;
    function convertToAssignmentElementTarget(node) {
        if (ts.isBindingPattern(node)) {
            return convertToAssignmentPattern(node);
        }
        ts.Debug.assertNode(node, ts.isExpression);
        return node;
    }
    ts.convertToAssignmentElementTarget = convertToAssignmentElementTarget;
})(ts || (ts = {}));
