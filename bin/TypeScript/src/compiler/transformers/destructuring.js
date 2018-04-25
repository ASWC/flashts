/*@internal*/
var ts;
(function (ts) {
    /**
     * Flattens a DestructuringAssignment or a VariableDeclaration to an expression.
     *
     * @param node The node to flatten.
     * @param visitor An optional visitor used to visit initializers.
     * @param context The transformation context.
     * @param level Indicates the extent to which flattening should occur.
     * @param needsValue An optional value indicating whether the value from the right-hand-side of
     * the destructuring assignment is needed as part of a larger expression.
     * @param createAssignmentCallback An optional callback used to create the assignment expression.
     */
    function flattenDestructuringAssignment(node, visitor, context, level, needsValue, createAssignmentCallback) {
        let location = node;
        let value;
        if (ts.isDestructuringAssignment(node)) {
            value = node.right;
            while (ts.isEmptyArrayLiteral(node.left) || ts.isEmptyObjectLiteral(node.left)) {
                if (ts.isDestructuringAssignment(value)) {
                    location = node = value;
                    value = node.right;
                }
                else {
                    return value;
                }
            }
        }
        let expressions;
        const flattenContext = {
            context,
            level,
            downlevelIteration: context.getCompilerOptions().downlevelIteration,
            hoistTempVariables: true,
            emitExpression,
            emitBindingOrAssignment,
            createArrayBindingOrAssignmentPattern: makeArrayAssignmentPattern,
            createObjectBindingOrAssignmentPattern: makeObjectAssignmentPattern,
            createArrayBindingOrAssignmentElement: makeAssignmentElement,
            visitor
        };
        if (value) {
            value = ts.visitNode(value, visitor, ts.isExpression);
            if (ts.isIdentifier(value) && bindingOrAssignmentElementAssignsToName(node, value.escapedText)) {
                // If the right-hand value of the assignment is also an assignment target then
                // we need to cache the right-hand value.
                value = ensureIdentifier(flattenContext, value, /*reuseIdentifierExpressions*/ false, location);
            }
            else if (needsValue) {
                // If the right-hand value of the destructuring assignment needs to be preserved (as
                // is the case when the destructuring assignment is part of a larger expression),
                // then we need to cache the right-hand value.
                //
                // The source map location for the assignment should point to the entire binary
                // expression.
                value = ensureIdentifier(flattenContext, value, /*reuseIdentifierExpressions*/ true, location);
            }
            else if (ts.nodeIsSynthesized(node)) {
                // Generally, the source map location for a destructuring assignment is the root
                // expression.
                //
                // However, if the root expression is synthesized (as in the case
                // of the initializer when transforming a ForOfStatement), then the source map
                // location should point to the right-hand value of the expression.
                location = value;
            }
        }
        flattenBindingOrAssignmentElement(flattenContext, node, value, location, /*skipInitializer*/ ts.isDestructuringAssignment(node));
        if (value && needsValue) {
            if (!ts.some(expressions)) {
                return value;
            }
            expressions.push(value);
        }
        return ts.aggregateTransformFlags(ts.inlineExpressions(expressions)) || ts.createOmittedExpression();
        function emitExpression(expression) {
            // NOTE: this completely disables source maps, but aligns with the behavior of
            //       `emitAssignment` in the old emitter.
            ts.setEmitFlags(expression, ts.EmitFlags.NoNestedSourceMaps);
            ts.aggregateTransformFlags(expression);
            expressions = ts.append(expressions, expression);
        }
        function emitBindingOrAssignment(target, value, location, original) {
            ts.Debug.assertNode(target, createAssignmentCallback ? ts.isIdentifier : ts.isExpression);
            const expression = createAssignmentCallback
                ? createAssignmentCallback(target, value, location)
                : ts.setTextRange(ts.createAssignment(ts.visitNode(target, visitor, ts.isExpression), value), location);
            expression.original = original;
            emitExpression(expression);
        }
    }
    ts.flattenDestructuringAssignment = flattenDestructuringAssignment;
    function bindingOrAssignmentElementAssignsToName(element, escapedName) {
        const target = ts.getTargetOfBindingOrAssignmentElement(element);
        if (ts.isBindingOrAssignmentPattern(target)) {
            return bindingOrAssignmentPatternAssignsToName(target, escapedName);
        }
        else if (ts.isIdentifier(target)) {
            return target.escapedText === escapedName;
        }
        return false;
    }
    function bindingOrAssignmentPatternAssignsToName(pattern, escapedName) {
        const elements = ts.getElementsOfBindingOrAssignmentPattern(pattern);
        for (const element of elements) {
            if (bindingOrAssignmentElementAssignsToName(element, escapedName)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Flattens a VariableDeclaration or ParameterDeclaration to one or more variable declarations.
     *
     * @param node The node to flatten.
     * @param visitor An optional visitor used to visit initializers.
     * @param context The transformation context.
     * @param boundValue The value bound to the declaration.
     * @param skipInitializer A value indicating whether to ignore the initializer of `node`.
     * @param hoistTempVariables Indicates whether temporary variables should not be recorded in-line.
     * @param level Indicates the extent to which flattening should occur.
     */
    function flattenDestructuringBinding(node, visitor, context, level, rval, hoistTempVariables, skipInitializer) {
        let pendingExpressions;
        const pendingDeclarations = [];
        const declarations = [];
        const flattenContext = {
            context,
            level,
            downlevelIteration: context.getCompilerOptions().downlevelIteration,
            hoistTempVariables,
            emitExpression,
            emitBindingOrAssignment,
            createArrayBindingOrAssignmentPattern: makeArrayBindingPattern,
            createObjectBindingOrAssignmentPattern: makeObjectBindingPattern,
            createArrayBindingOrAssignmentElement: makeBindingElement,
            visitor
        };
        if (ts.isVariableDeclaration(node)) {
            let initializer = ts.getInitializerOfBindingOrAssignmentElement(node);
            if (initializer && ts.isIdentifier(initializer) && bindingOrAssignmentElementAssignsToName(node, initializer.escapedText)) {
                // If the right-hand value of the assignment is also an assignment target then
                // we need to cache the right-hand value.
                initializer = ensureIdentifier(flattenContext, initializer, /*reuseIdentifierExpressions*/ false, initializer);
                node = ts.updateVariableDeclaration(node, node.name, node.type, initializer);
            }
        }
        flattenBindingOrAssignmentElement(flattenContext, node, rval, node, skipInitializer);
        if (pendingExpressions) {
            const temp = ts.createTempVariable(/*recordTempVariable*/ undefined);
            if (hoistTempVariables) {
                const value = ts.inlineExpressions(pendingExpressions);
                pendingExpressions = undefined;
                emitBindingOrAssignment(temp, value, /*location*/ undefined, /*original*/ undefined);
            }
            else {
                context.hoistVariableDeclaration(temp);
                const pendingDeclaration = ts.lastOrUndefined(pendingDeclarations);
                pendingDeclaration.pendingExpressions = ts.append(pendingDeclaration.pendingExpressions, ts.createAssignment(temp, pendingDeclaration.value));
                ts.addRange(pendingDeclaration.pendingExpressions, pendingExpressions);
                pendingDeclaration.value = temp;
            }
        }
        for (const { pendingExpressions, name, value, location, original } of pendingDeclarations) {
            const variable = ts.createVariableDeclaration(name, 
            /*type*/ undefined, pendingExpressions ? ts.inlineExpressions(ts.append(pendingExpressions, value)) : value);
            variable.original = original;
            ts.setTextRange(variable, location);
            if (ts.isIdentifier(name)) {
                ts.setEmitFlags(variable, ts.EmitFlags.NoNestedSourceMaps);
            }
            ts.aggregateTransformFlags(variable);
            declarations.push(variable);
        }
        return declarations;
        function emitExpression(value) {
            pendingExpressions = ts.append(pendingExpressions, value);
        }
        function emitBindingOrAssignment(target, value, location, original) {
            ts.Debug.assertNode(target, ts.isBindingName);
            if (pendingExpressions) {
                value = ts.inlineExpressions(ts.append(pendingExpressions, value));
                pendingExpressions = undefined;
            }
            pendingDeclarations.push({ pendingExpressions, name: target, value, location, original });
        }
    }
    ts.flattenDestructuringBinding = flattenDestructuringBinding;
    /**
     * Flattens a BindingOrAssignmentElement into zero or more bindings or assignments.
     *
     * @param flattenContext Options used to control flattening.
     * @param element The element to flatten.
     * @param value The current RHS value to assign to the element.
     * @param location The location to use for source maps and comments.
     * @param skipInitializer An optional value indicating whether to include the initializer
     * for the element.
     */
    function flattenBindingOrAssignmentElement(flattenContext, element, value, location, skipInitializer) {
        if (!skipInitializer) {
            const initializer = ts.visitNode(ts.getInitializerOfBindingOrAssignmentElement(element), flattenContext.visitor, ts.isExpression);
            if (initializer) {
                // Combine value and initializer
                value = value ? createDefaultValueCheck(flattenContext, value, initializer, location) : initializer;
            }
            else if (!value) {
                // Use 'void 0' in absence of value and initializer
                value = ts.createVoidZero();
            }
        }
        const bindingTarget = ts.getTargetOfBindingOrAssignmentElement(element);
        if (ts.isObjectBindingOrAssignmentPattern(bindingTarget)) {
            flattenObjectBindingOrAssignmentPattern(flattenContext, element, bindingTarget, value, location);
        }
        else if (ts.isArrayBindingOrAssignmentPattern(bindingTarget)) {
            flattenArrayBindingOrAssignmentPattern(flattenContext, element, bindingTarget, value, location);
        }
        else {
            flattenContext.emitBindingOrAssignment(bindingTarget, value, location, /*original*/ element);
        }
    }
    /**
     * Flattens an ObjectBindingOrAssignmentPattern into zero or more bindings or assignments.
     *
     * @param flattenContext Options used to control flattening.
     * @param parent The parent element of the pattern.
     * @param pattern The ObjectBindingOrAssignmentPattern to flatten.
     * @param value The current RHS value to assign to the element.
     * @param location The location to use for source maps and comments.
     */
    function flattenObjectBindingOrAssignmentPattern(flattenContext, parent, pattern, value, location) {
        const elements = ts.getElementsOfBindingOrAssignmentPattern(pattern);
        const numElements = elements.length;
        if (numElements !== 1) {
            // For anything other than a single-element destructuring we need to generate a temporary
            // to ensure value is evaluated exactly once. Additionally, if we have zero elements
            // we need to emit *something* to ensure that in case a 'var' keyword was already emitted,
            // so in that case, we'll intentionally create that temporary.
            const reuseIdentifierExpressions = !ts.isDeclarationBindingElement(parent) || numElements !== 0;
            value = ensureIdentifier(flattenContext, value, reuseIdentifierExpressions, location);
        }
        let bindingElements;
        let computedTempVariables;
        for (let i = 0; i < numElements; i++) {
            const element = elements[i];
            if (!ts.getRestIndicatorOfBindingOrAssignmentElement(element)) {
                const propertyName = ts.getPropertyNameOfBindingOrAssignmentElement(element);
                if (flattenContext.level >= 1 /* ObjectRest */
                    && !(element.transformFlags & (524288 /* ContainsRest */ | 1048576 /* ContainsObjectRest */))
                    && !(ts.getTargetOfBindingOrAssignmentElement(element).transformFlags & (524288 /* ContainsRest */ | 1048576 /* ContainsObjectRest */))
                    && !ts.isComputedPropertyName(propertyName)) {
                    bindingElements = ts.append(bindingElements, element);
                }
                else {
                    if (bindingElements) {
                        flattenContext.emitBindingOrAssignment(flattenContext.createObjectBindingOrAssignmentPattern(bindingElements), value, location, pattern);
                        bindingElements = undefined;
                    }
                    const rhsValue = createDestructuringPropertyAccess(flattenContext, value, propertyName);
                    if (ts.isComputedPropertyName(propertyName)) {
                        computedTempVariables = ts.append(computedTempVariables, rhsValue.argumentExpression);
                    }
                    flattenBindingOrAssignmentElement(flattenContext, element, rhsValue, /*location*/ element);
                }
            }
            else if (i === numElements - 1) {
                if (bindingElements) {
                    flattenContext.emitBindingOrAssignment(flattenContext.createObjectBindingOrAssignmentPattern(bindingElements), value, location, pattern);
                    bindingElements = undefined;
                }
                const rhsValue = createRestCall(flattenContext.context, value, elements, computedTempVariables, pattern);
                flattenBindingOrAssignmentElement(flattenContext, element, rhsValue, element);
            }
        }
        if (bindingElements) {
            flattenContext.emitBindingOrAssignment(flattenContext.createObjectBindingOrAssignmentPattern(bindingElements), value, location, pattern);
        }
    }
    /**
     * Flattens an ArrayBindingOrAssignmentPattern into zero or more bindings or assignments.
     *
     * @param flattenContext Options used to control flattening.
     * @param parent The parent element of the pattern.
     * @param pattern The ArrayBindingOrAssignmentPattern to flatten.
     * @param value The current RHS value to assign to the element.
     * @param location The location to use for source maps and comments.
     */
    function flattenArrayBindingOrAssignmentPattern(flattenContext, parent, pattern, value, location) {
        const elements = ts.getElementsOfBindingOrAssignmentPattern(pattern);
        const numElements = elements.length;
        if (flattenContext.level < 1 /* ObjectRest */ && flattenContext.downlevelIteration) {
            // Read the elements of the iterable into an array
            value = ensureIdentifier(flattenContext, ts.createReadHelper(flattenContext.context, value, numElements > 0 && ts.getRestIndicatorOfBindingOrAssignmentElement(elements[numElements - 1])
                ? undefined
                : numElements, location), 
            /*reuseIdentifierExpressions*/ false, location);
        }
        else if (numElements !== 1 && (flattenContext.level < 1 /* ObjectRest */ || numElements === 0)
            || ts.every(elements, ts.isOmittedExpression)) {
            // For anything other than a single-element destructuring we need to generate a temporary
            // to ensure value is evaluated exactly once. Additionally, if we have zero elements
            // we need to emit *something* to ensure that in case a 'var' keyword was already emitted,
            // so in that case, we'll intentionally create that temporary.
            // Or all the elements of the binding pattern are omitted expression such as "var [,] = [1,2]",
            // then we will create temporary variable.
            const reuseIdentifierExpressions = !ts.isDeclarationBindingElement(parent) || numElements !== 0;
            value = ensureIdentifier(flattenContext, value, reuseIdentifierExpressions, location);
        }
        let bindingElements;
        let restContainingElements;
        for (let i = 0; i < numElements; i++) {
            const element = elements[i];
            if (flattenContext.level >= 1 /* ObjectRest */) {
                // If an array pattern contains an ObjectRest, we must cache the result so that we
                // can perform the ObjectRest destructuring in a different declaration
                if (element.transformFlags & 1048576 /* ContainsObjectRest */) {
                    const temp = ts.createTempVariable(/*recordTempVariable*/ undefined);
                    if (flattenContext.hoistTempVariables) {
                        flattenContext.context.hoistVariableDeclaration(temp);
                    }
                    restContainingElements = ts.append(restContainingElements, [temp, element]);
                    bindingElements = ts.append(bindingElements, flattenContext.createArrayBindingOrAssignmentElement(temp));
                }
                else {
                    bindingElements = ts.append(bindingElements, element);
                }
            }
            else if (ts.isOmittedExpression(element)) {
                continue;
            }
            else if (!ts.getRestIndicatorOfBindingOrAssignmentElement(element)) {
                const rhsValue = ts.createElementAccess(value, i);
                flattenBindingOrAssignmentElement(flattenContext, element, rhsValue, /*location*/ element);
            }
            else if (i === numElements - 1) {
                const rhsValue = ts.createArraySlice(value, i);
                flattenBindingOrAssignmentElement(flattenContext, element, rhsValue, /*location*/ element);
            }
        }
        if (bindingElements) {
            flattenContext.emitBindingOrAssignment(flattenContext.createArrayBindingOrAssignmentPattern(bindingElements), value, location, pattern);
        }
        if (restContainingElements) {
            for (const [id, element] of restContainingElements) {
                flattenBindingOrAssignmentElement(flattenContext, element, id, element);
            }
        }
    }
    /**
     * Creates an expression used to provide a default value if a value is `undefined` at runtime.
     *
     * @param flattenContext Options used to control flattening.
     * @param value The RHS value to test.
     * @param defaultValue The default value to use if `value` is `undefined` at runtime.
     * @param location The location to use for source maps and comments.
     */
    function createDefaultValueCheck(flattenContext, value, defaultValue, location) {
        value = ensureIdentifier(flattenContext, value, /*reuseIdentifierExpressions*/ true, location);
        return ts.createConditional(ts.createTypeCheck(value, "undefined"), defaultValue, value);
    }
    /**
     * Creates either a PropertyAccessExpression or an ElementAccessExpression for the
     * right-hand side of a transformed destructuring assignment.
     *
     * @link https://tc39.github.io/ecma262/#sec-runtime-semantics-keyeddestructuringassignmentevaluation
     *
     * @param flattenContext Options used to control flattening.
     * @param value The RHS value that is the source of the property.
     * @param propertyName The destructuring property name.
     */
    function createDestructuringPropertyAccess(flattenContext, value, propertyName) {
        if (ts.isComputedPropertyName(propertyName)) {
            const argumentExpression = ensureIdentifier(flattenContext, ts.visitNode(propertyName.expression, flattenContext.visitor), /*reuseIdentifierExpressions*/ false, /*location*/ propertyName);
            return ts.createElementAccess(value, argumentExpression);
        }
        else if (ts.isStringOrNumericLiteral(propertyName)) {
            const argumentExpression = ts.getSynthesizedClone(propertyName);
            argumentExpression.text = argumentExpression.text;
            return ts.createElementAccess(value, argumentExpression);
        }
        else {
            const name = ts.createIdentifier(ts.idText(propertyName));
            return ts.createPropertyAccess(value, name);
        }
    }
    /**
     * Ensures that there exists a declared identifier whose value holds the given expression.
     * This function is useful to ensure that the expression's value can be read from in subsequent expressions.
     * Unless 'reuseIdentifierExpressions' is false, 'value' will be returned if it is just an identifier.
     *
     * @param flattenContext Options used to control flattening.
     * @param value the expression whose value needs to be bound.
     * @param reuseIdentifierExpressions true if identifier expressions can simply be returned;
     * false if it is necessary to always emit an identifier.
     * @param location The location to use for source maps and comments.
     */
    function ensureIdentifier(flattenContext, value, reuseIdentifierExpressions, location) {
        if (ts.isIdentifier(value) && reuseIdentifierExpressions) {
            return value;
        }
        else {
            const temp = ts.createTempVariable(/*recordTempVariable*/ undefined);
            if (flattenContext.hoistTempVariables) {
                flattenContext.context.hoistVariableDeclaration(temp);
                flattenContext.emitExpression(ts.setTextRange(ts.createAssignment(temp, value), location));
            }
            else {
                flattenContext.emitBindingOrAssignment(temp, value, location, /*original*/ undefined);
            }
            return temp;
        }
    }
    function makeArrayBindingPattern(elements) {
        ts.Debug.assertEachNode(elements, ts.isArrayBindingElement);
        return ts.createArrayBindingPattern(elements);
    }
    function makeArrayAssignmentPattern(elements) {
        return ts.createArrayLiteral(ts.map(elements, ts.convertToArrayAssignmentElement));
    }
    function makeObjectBindingPattern(elements) {
        ts.Debug.assertEachNode(elements, ts.isBindingElement);
        return ts.createObjectBindingPattern(elements);
    }
    function makeObjectAssignmentPattern(elements) {
        return ts.createObjectLiteral(ts.map(elements, ts.convertToObjectAssignmentElement));
    }
    function makeBindingElement(name) {
        return ts.createBindingElement(/*dotDotDotToken*/ undefined, /*propertyName*/ undefined, name);
    }
    function makeAssignmentElement(name) {
        return name;
    }
    const restHelper = {
        name: "typescript:rest",
        scoped: false,
        text: `
            var __rest = (this && this.__rest) || function (s, e) {
                var t = {};
                for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
                    t[p] = s[p];
                if (s != null && typeof Object.getOwnPropertySymbols === "function")
                    for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
                        t[p[i]] = s[p[i]];
                return t;
            };`
    };
    /** Given value: o, propName: p, pattern: { a, b, ...p } from the original statement
     * `{ a, b, ...p } = o`, create `p = __rest(o, ["a", "b"]);`
     */
    function createRestCall(context, value, elements, computedTempVariables, location) {
        context.requestEmitHelper(restHelper);
        const propertyNames = [];
        let computedTempVariableOffset = 0;
        for (let i = 0; i < elements.length - 1; i++) {
            const propertyName = ts.getPropertyNameOfBindingOrAssignmentElement(elements[i]);
            if (propertyName) {
                if (ts.isComputedPropertyName(propertyName)) {
                    const temp = computedTempVariables[computedTempVariableOffset];
                    computedTempVariableOffset++;
                    // typeof _tmp === "symbol" ? _tmp : _tmp + ""
                    propertyNames.push(ts.createConditional(ts.createTypeCheck(temp, "symbol"), temp, ts.createAdd(temp, ts.createLiteral(""))));
                }
                else {
                    propertyNames.push(ts.createLiteral(propertyName));
                }
            }
        }
        return ts.createCall(ts.getHelperName("__rest"), 
        /*typeArguments*/ undefined, [
            value,
            ts.setTextRange(ts.createArrayLiteral(propertyNames), location)
        ]);
    }
})(ts || (ts = {}));
