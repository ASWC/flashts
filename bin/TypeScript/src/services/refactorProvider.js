/* @internal */
var ts;
(function (ts) {
    let refactor;
    (function (refactor_1) {
        // A map with the refactor code as key, the refactor itself as value
        // e.g.  nonSuggestableRefactors[refactorCode] -> the refactor you want
        const refactors = ts.createMap();
        /** @param name An unique code associated with each refactor. Does not have to be human-readable. */
        function registerRefactor(name, refactor) {
            refactors.set(name, refactor);
        }
        refactor_1.registerRefactor = registerRefactor;
        function getApplicableRefactors(context) {
            return ts.arrayFrom(ts.flatMapIterator(refactors.values(), refactor => context.cancellationToken && context.cancellationToken.isCancellationRequested() ? undefined : refactor.getAvailableActions(context)));
        }
        refactor_1.getApplicableRefactors = getApplicableRefactors;
        function getEditsForRefactor(context, refactorName, actionName) {
            const refactor = refactors.get(refactorName);
            return refactor && refactor.getEditsForAction(context, actionName);
        }
        refactor_1.getEditsForRefactor = getEditsForRefactor;
    })(refactor = ts.refactor || (ts.refactor = {}));
    function getRefactorContextLength(context) {
        return context.endPosition === undefined ? 0 : context.endPosition - context.startPosition;
    }
    ts.getRefactorContextLength = getRefactorContextLength;
})(ts || (ts = {}));
