/// <reference path="..\harness.ts" />
var ts;
(function (ts) {
    describe("assert", () => {
        it("deepEqual", () => {
            assert.throws(() => assert.deepEqual(ts.createNodeArray([ts.createIdentifier("A")]), ts.createNodeArray([ts.createIdentifier("B")])));
            assert.throws(() => assert.deepEqual(ts.createNodeArray([], /*hasTrailingComma*/ true), ts.createNodeArray([], /*hasTrailingComma*/ false)));
            assert.deepEqual(ts.createNodeArray([ts.createIdentifier("A")], /*hasTrailingComma*/ true), ts.createNodeArray([ts.createIdentifier("A")], /*hasTrailingComma*/ true));
        });
    });
})(ts || (ts = {}));
