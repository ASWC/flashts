var ts;
(function (ts) {
    class OperationCanceledException {
    }
    ts.OperationCanceledException = OperationCanceledException;
    /** Return code used by getEmitOutput function to indicate status of the function */
    let ExitStatus;
    (function (ExitStatus) {
        // Compiler ran successfully.  Either this was a simple do-nothing compilation (for example,
        // when -version or -help was provided, or this was a normal compilation, no diagnostics
        // were produced, and all outputs were generated successfully.
        ExitStatus[ExitStatus["Success"] = 0] = "Success";
        // Diagnostics were produced and because of them no code was generated.
        ExitStatus[ExitStatus["DiagnosticsPresent_OutputsSkipped"] = 1] = "DiagnosticsPresent_OutputsSkipped";
        // Diagnostics were produced and outputs were generated in spite of them.
        ExitStatus[ExitStatus["DiagnosticsPresent_OutputsGenerated"] = 2] = "DiagnosticsPresent_OutputsGenerated";
    })(ExitStatus = ts.ExitStatus || (ts.ExitStatus = {}));
    /** Indicates how to serialize the name for a TypeReferenceNode when emitting decorator metadata */
    /* @internal */
    let TypeReferenceSerializationKind;
    (function (TypeReferenceSerializationKind) {
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["Unknown"] = 0] = "Unknown";
        // should be emitted using a safe fallback.
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["TypeWithConstructSignatureAndValue"] = 1] = "TypeWithConstructSignatureAndValue";
        // function that can be reached at runtime (e.g. a `class`
        // declaration or a `var` declaration for the static side
        // of a type, such as the global `Promise` type in lib.d.ts).
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["VoidNullableOrNeverType"] = 2] = "VoidNullableOrNeverType";
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["NumberLikeType"] = 3] = "NumberLikeType";
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["StringLikeType"] = 4] = "StringLikeType";
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["BooleanType"] = 5] = "BooleanType";
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["ArrayLikeType"] = 6] = "ArrayLikeType";
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["ESSymbolType"] = 7] = "ESSymbolType";
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["Promise"] = 8] = "Promise";
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["TypeWithCallSignature"] = 9] = "TypeWithCallSignature";
        // with call signatures.
        TypeReferenceSerializationKind[TypeReferenceSerializationKind["ObjectType"] = 10] = "ObjectType";
    })(TypeReferenceSerializationKind = ts.TypeReferenceSerializationKind || (ts.TypeReferenceSerializationKind = {}));
    let DiagnosticCategory;
    (function (DiagnosticCategory) {
        DiagnosticCategory[DiagnosticCategory["Warning"] = 0] = "Warning";
        DiagnosticCategory[DiagnosticCategory["Error"] = 1] = "Error";
        DiagnosticCategory[DiagnosticCategory["Suggestion"] = 2] = "Suggestion";
        DiagnosticCategory[DiagnosticCategory["Message"] = 3] = "Message";
    })(DiagnosticCategory = ts.DiagnosticCategory || (ts.DiagnosticCategory = {}));
    /* @internal */
    function diagnosticCategoryName(d, lowerCase = true) {
        const name = DiagnosticCategory[d.category];
        return lowerCase ? name.toLowerCase() : name;
    }
    ts.diagnosticCategoryName = diagnosticCategoryName;
    let ModuleResolutionKind;
    (function (ModuleResolutionKind) {
        ModuleResolutionKind[ModuleResolutionKind["Classic"] = 1] = "Classic";
        ModuleResolutionKind[ModuleResolutionKind["NodeJs"] = 2] = "NodeJs";
    })(ModuleResolutionKind = ts.ModuleResolutionKind || (ts.ModuleResolutionKind = {}));
    let ModuleKind;
    (function (ModuleKind) {
        ModuleKind[ModuleKind["None"] = 0] = "None";
        ModuleKind[ModuleKind["CommonJS"] = 1] = "CommonJS";
        ModuleKind[ModuleKind["AMD"] = 2] = "AMD";
        ModuleKind[ModuleKind["UMD"] = 3] = "UMD";
        ModuleKind[ModuleKind["System"] = 4] = "System";
        ModuleKind[ModuleKind["ES2015"] = 5] = "ES2015";
        ModuleKind[ModuleKind["ESNext"] = 6] = "ESNext";
    })(ModuleKind = ts.ModuleKind || (ts.ModuleKind = {}));
    /**
     * This function only exists to cause exact types to be inferred for all the literals within `commentPragmas`
     */
    /* @internal */
    function _contextuallyTypePragmas(args) {
        return args;
    }
    // While not strictly a type, this is here because `PragmaMap` needs to be here to be used with `SourceFile`, and we don't
    //  fancy effectively defining it twice, once in value-space and once in type-space
    /* @internal */
    ts.commentPragmas = _contextuallyTypePragmas({
        "reference": {
            args: [
                { name: "types", optional: true, captureSpan: true },
                { name: "path", optional: true, captureSpan: true },
                { name: "no-default-lib", optional: true }
            ],
            kind: 1 /* TripleSlashXML */
        },
        "amd-dependency": {
            args: [{ name: "path" }, { name: "name", optional: true }],
            kind: 1 /* TripleSlashXML */
        },
        "amd-module": {
            args: [{ name: "name" }],
            kind: 1 /* TripleSlashXML */
        },
        "ts-check": {
            kind: 2 /* SingleLine */
        },
        "ts-nocheck": {
            kind: 2 /* SingleLine */
        },
        "jsx": {
            args: [{ name: "factory" }],
            kind: 4 /* MultiLine */
        },
    });
})(ts || (ts = {}));
