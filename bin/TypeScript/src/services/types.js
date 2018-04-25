var ts;
(function (ts) {
    let ScriptSnapshot;
    (function (ScriptSnapshot) {
        class StringScriptSnapshot {
            constructor(text) {
                this.text = text;
            }
            getText(start, end) {
                return start === 0 && end === this.text.length
                    ? this.text
                    : this.text.substring(start, end);
            }
            getLength() {
                return this.text.length;
            }
            getChangeRange() {
                // Text-based snapshots do not support incremental parsing. Return undefined
                // to signal that to the caller.
                return undefined;
            }
        }
        function fromString(text) {
            return new StringScriptSnapshot(text);
        }
        ScriptSnapshot.fromString = fromString;
    })(ScriptSnapshot = ts.ScriptSnapshot || (ts.ScriptSnapshot = {}));
    /* @internal */
    ts.defaultPreferences = {};
    class TextChange {
    }
    ts.TextChange = TextChange;
    let IndentStyle;
    (function (IndentStyle) {
        IndentStyle[IndentStyle["None"] = 0] = "None";
        IndentStyle[IndentStyle["Block"] = 1] = "Block";
        IndentStyle[IndentStyle["Smart"] = 2] = "Smart";
    })(IndentStyle = ts.IndentStyle || (ts.IndentStyle = {}));
    let SymbolDisplayPartKind;
    (function (SymbolDisplayPartKind) {
        SymbolDisplayPartKind[SymbolDisplayPartKind["aliasName"] = 0] = "aliasName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["className"] = 1] = "className";
        SymbolDisplayPartKind[SymbolDisplayPartKind["enumName"] = 2] = "enumName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["fieldName"] = 3] = "fieldName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["interfaceName"] = 4] = "interfaceName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["keyword"] = 5] = "keyword";
        SymbolDisplayPartKind[SymbolDisplayPartKind["lineBreak"] = 6] = "lineBreak";
        SymbolDisplayPartKind[SymbolDisplayPartKind["numericLiteral"] = 7] = "numericLiteral";
        SymbolDisplayPartKind[SymbolDisplayPartKind["stringLiteral"] = 8] = "stringLiteral";
        SymbolDisplayPartKind[SymbolDisplayPartKind["localName"] = 9] = "localName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["methodName"] = 10] = "methodName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["moduleName"] = 11] = "moduleName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["operator"] = 12] = "operator";
        SymbolDisplayPartKind[SymbolDisplayPartKind["parameterName"] = 13] = "parameterName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["propertyName"] = 14] = "propertyName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["punctuation"] = 15] = "punctuation";
        SymbolDisplayPartKind[SymbolDisplayPartKind["space"] = 16] = "space";
        SymbolDisplayPartKind[SymbolDisplayPartKind["text"] = 17] = "text";
        SymbolDisplayPartKind[SymbolDisplayPartKind["typeParameterName"] = 18] = "typeParameterName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["enumMemberName"] = 19] = "enumMemberName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["functionName"] = 20] = "functionName";
        SymbolDisplayPartKind[SymbolDisplayPartKind["regularExpressionLiteral"] = 21] = "regularExpressionLiteral";
    })(SymbolDisplayPartKind = ts.SymbolDisplayPartKind || (ts.SymbolDisplayPartKind = {}));
    let TokenClass;
    (function (TokenClass) {
        TokenClass[TokenClass["Punctuation"] = 0] = "Punctuation";
        TokenClass[TokenClass["Keyword"] = 1] = "Keyword";
        TokenClass[TokenClass["Operator"] = 2] = "Operator";
        TokenClass[TokenClass["Comment"] = 3] = "Comment";
        TokenClass[TokenClass["Whitespace"] = 4] = "Whitespace";
        TokenClass[TokenClass["Identifier"] = 5] = "Identifier";
        TokenClass[TokenClass["NumberLiteral"] = 6] = "NumberLiteral";
        TokenClass[TokenClass["StringLiteral"] = 7] = "StringLiteral";
        TokenClass[TokenClass["RegExpLiteral"] = 8] = "RegExpLiteral";
    })(TokenClass = ts.TokenClass || (ts.TokenClass = {}));
})(ts || (ts = {}));
