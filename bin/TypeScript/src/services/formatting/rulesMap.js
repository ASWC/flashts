/* @internal */
var ts;
(function (ts) {
    var formatting;
    (function (formatting) {
        function getFormatContext(options) {
            return { options, getRule: getRulesMap() };
        }
        formatting.getFormatContext = getFormatContext;
        let rulesMapCache;
        function getRulesMap() {
            if (rulesMapCache === undefined) {
                rulesMapCache = createRulesMap(formatting.getAllRules());
            }
            return rulesMapCache;
        }
        function createRulesMap(rules) {
            const map = buildMap(rules);
            return context => {
                const bucket = map[getRuleBucketIndex(context.currentTokenSpan.kind, context.nextTokenSpan.kind)];
                return bucket && ts.find(bucket, rule => ts.every(rule.context, c => c(context)));
            };
        }
        function buildMap(rules) {
            // Map from bucket index to array of rules
            const map = new Array(mapRowLength * mapRowLength);
            // This array is used only during construction of the rulesbucket in the map
            const rulesBucketConstructionStateList = new Array(map.length);
            for (const rule of rules) {
                const specificRule = rule.leftTokenRange.isSpecific && rule.rightTokenRange.isSpecific;
                for (const left of rule.leftTokenRange.tokens) {
                    for (const right of rule.rightTokenRange.tokens) {
                        const index = getRuleBucketIndex(left, right);
                        let rulesBucket = map[index];
                        if (rulesBucket === undefined) {
                            rulesBucket = map[index] = [];
                        }
                        addRule(rulesBucket, rule.rule, specificRule, rulesBucketConstructionStateList, index);
                    }
                }
            }
            return map;
        }
        function getRuleBucketIndex(row, column) {
            ts.Debug.assert(row <= ts.SyntaxKind.LastKeyword && column <= ts.SyntaxKind.LastKeyword, "Must compute formatting context from tokens");
            return (row * mapRowLength) + column;
        }
        const maskBitSize = 5;
        const mask = 0b11111; // MaskBitSize bits
        const mapRowLength = ts.SyntaxKind.LastToken + 1;
        let RulesPosition;
        (function (RulesPosition) {
            RulesPosition[RulesPosition["IgnoreRulesSpecific"] = 0] = "IgnoreRulesSpecific";
            RulesPosition[RulesPosition["IgnoreRulesAny"] = maskBitSize * 1] = "IgnoreRulesAny";
            RulesPosition[RulesPosition["ContextRulesSpecific"] = maskBitSize * 2] = "ContextRulesSpecific";
            RulesPosition[RulesPosition["ContextRulesAny"] = maskBitSize * 3] = "ContextRulesAny";
            RulesPosition[RulesPosition["NoContextRulesSpecific"] = maskBitSize * 4] = "NoContextRulesSpecific";
            RulesPosition[RulesPosition["NoContextRulesAny"] = maskBitSize * 5] = "NoContextRulesAny";
        })(RulesPosition || (RulesPosition = {}));
        // The Rules list contains all the inserted rules into a rulebucket in the following order:
        //    1- Ignore rules with specific token combination
        //    2- Ignore rules with any token combination
        //    3- Context rules with specific token combination
        //    4- Context rules with any token combination
        //    5- Non-context rules with specific token combination
        //    6- Non-context rules with any token combination
        //
        // The member rulesInsertionIndexBitmap is used to describe the number of rules
        // in each sub-bucket (above) hence can be used to know the index of where to insert
        // the next rule. It's a bitmap which contains 6 different sections each is given 5 bits.
        //
        // Example:
        // In order to insert a rule to the end of sub-bucket (3), we get the index by adding
        // the values in the bitmap segments 3rd, 2nd, and 1st.
        function addRule(rules, rule, specificTokens, constructionState, rulesBucketIndex) {
            const position = rule.action === 1 /* Ignore */
                ? specificTokens ? RulesPosition.IgnoreRulesSpecific : RulesPosition.IgnoreRulesAny
                : rule.context !== formatting.anyContext
                    ? specificTokens ? RulesPosition.ContextRulesSpecific : RulesPosition.ContextRulesAny
                    : specificTokens ? RulesPosition.NoContextRulesSpecific : RulesPosition.NoContextRulesAny;
            const state = constructionState[rulesBucketIndex] || 0;
            rules.splice(getInsertionIndex(state, position), 0, rule);
            constructionState[rulesBucketIndex] = increaseInsertionIndex(state, position);
        }
        function getInsertionIndex(indexBitmap, maskPosition) {
            let index = 0;
            for (let pos = 0; pos <= maskPosition; pos += maskBitSize) {
                index += indexBitmap & mask;
                indexBitmap >>= maskBitSize;
            }
            return index;
        }
        function increaseInsertionIndex(indexBitmap, maskPosition) {
            const value = ((indexBitmap >> maskPosition) & mask) + 1;
            ts.Debug.assert((value & mask) === value, "Adding more rules into the sub-bucket than allowed. Maximum allowed is 32 rules.");
            return (indexBitmap & ~(mask << maskPosition)) | (value << maskPosition);
        }
    })(formatting = ts.formatting || (ts.formatting = {}));
})(ts || (ts = {}));
