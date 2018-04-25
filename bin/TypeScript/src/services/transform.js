var ts;
(function (ts) {
    /**
     * Transform one or more nodes using the supplied transformers.
     * @param source A single `Node` or an array of `Node` objects.
     * @param transformers An array of `TransformerFactory` callbacks used to process the transformation.
     * @param compilerOptions Optional compiler options.
     */
    function transform(source, transformers, compilerOptions) {
        const diagnostics = [];
        compilerOptions = ts.fixupCompilerOptions(compilerOptions, diagnostics);
        const nodes = ts.isArray(source) ? source : [source];
        const result = ts.transformNodes(/*resolver*/ undefined, /*emitHost*/ undefined, compilerOptions, nodes, transformers, /*allowDtsFiles*/ true);
        result.diagnostics = ts.concatenate(result.diagnostics, diagnostics);
        return result;
    }
    ts.transform = transform;
})(ts || (ts = {}));
