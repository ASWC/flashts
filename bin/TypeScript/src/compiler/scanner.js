var ts;
(function (ts) {
    /* @internal */
    function tokenIsIdentifierOrKeyword(token) {
        return token >= ts.SyntaxKind.Identifier;
    }
    ts.tokenIsIdentifierOrKeyword = tokenIsIdentifierOrKeyword;
    /* @internal */
    function tokenIsIdentifierOrKeywordOrGreaterThan(token) {
        return token === ts.SyntaxKind.GreaterThanToken || tokenIsIdentifierOrKeyword(token);
    }
    ts.tokenIsIdentifierOrKeywordOrGreaterThan = tokenIsIdentifierOrKeywordOrGreaterThan;
    const textToToken = ts.createMapFromTemplate({
        "abstract": ts.SyntaxKind.AbstractKeyword,
        "any": ts.SyntaxKind.AnyKeyword,
        "as": ts.SyntaxKind.AsKeyword,
        "boolean": ts.SyntaxKind.BooleanKeyword,
        "break": ts.SyntaxKind.BreakKeyword,
        "case": ts.SyntaxKind.CaseKeyword,
        "catch": ts.SyntaxKind.CatchKeyword,
        "class": ts.SyntaxKind.ClassKeyword,
        "continue": ts.SyntaxKind.ContinueKeyword,
        "const": ts.SyntaxKind.ConstKeyword,
        "constructor": ts.SyntaxKind.ConstructorKeyword,
        "debugger": ts.SyntaxKind.DebuggerKeyword,
        "declare": ts.SyntaxKind.DeclareKeyword,
        "default": ts.SyntaxKind.DefaultKeyword,
        "delete": ts.SyntaxKind.DeleteKeyword,
        "do": ts.SyntaxKind.DoKeyword,
        "else": ts.SyntaxKind.ElseKeyword,
        "enum": ts.SyntaxKind.EnumKeyword,
        "export": ts.SyntaxKind.ExportKeyword,
        "extends": ts.SyntaxKind.ExtendsKeyword,
        "false": ts.SyntaxKind.FalseKeyword,
        "finally": ts.SyntaxKind.FinallyKeyword,
        "for": ts.SyntaxKind.ForKeyword,
        "from": ts.SyntaxKind.FromKeyword,
        "function": ts.SyntaxKind.FunctionKeyword,
        "get": ts.SyntaxKind.GetKeyword,
        "if": ts.SyntaxKind.IfKeyword,
        "implements": ts.SyntaxKind.ImplementsKeyword,
        "import": ts.SyntaxKind.ImportKeyword,
        "in": ts.SyntaxKind.InKeyword,
        "infer": ts.SyntaxKind.InferKeyword,
        "instanceof": ts.SyntaxKind.InstanceOfKeyword,
        "interface": ts.SyntaxKind.InterfaceKeyword,
        "is": ts.SyntaxKind.IsKeyword,
        "keyof": ts.SyntaxKind.KeyOfKeyword,
        "let": ts.SyntaxKind.LetKeyword,
        "module": ts.SyntaxKind.ModuleKeyword,
        "namespace": ts.SyntaxKind.NamespaceKeyword,
        "never": ts.SyntaxKind.NeverKeyword,
        "new": ts.SyntaxKind.NewKeyword,
        "null": ts.SyntaxKind.NullKeyword,
        "number": ts.SyntaxKind.NumberKeyword,
        "object": ts.SyntaxKind.ObjectKeyword,
        "package": ts.SyntaxKind.PackageKeyword,
        "private": ts.SyntaxKind.PrivateKeyword,
        "protected": ts.SyntaxKind.ProtectedKeyword,
        "public": ts.SyntaxKind.PublicKeyword,
        "readonly": ts.SyntaxKind.ReadonlyKeyword,
        "require": ts.SyntaxKind.RequireKeyword,
        "global": ts.SyntaxKind.GlobalKeyword,
        "return": ts.SyntaxKind.ReturnKeyword,
        "set": ts.SyntaxKind.SetKeyword,
        "static": ts.SyntaxKind.StaticKeyword,
        "string": ts.SyntaxKind.StringKeyword,
        "super": ts.SyntaxKind.SuperKeyword,
        "switch": ts.SyntaxKind.SwitchKeyword,
        "symbol": ts.SyntaxKind.SymbolKeyword,
        "this": ts.SyntaxKind.ThisKeyword,
        "throw": ts.SyntaxKind.ThrowKeyword,
        "true": ts.SyntaxKind.TrueKeyword,
        "try": ts.SyntaxKind.TryKeyword,
        "type": ts.SyntaxKind.TypeKeyword,
        "typeof": ts.SyntaxKind.TypeOfKeyword,
        "undefined": ts.SyntaxKind.UndefinedKeyword,
        "unique": ts.SyntaxKind.UniqueKeyword,
        "var": ts.SyntaxKind.VarKeyword,
        "void": ts.SyntaxKind.VoidKeyword,
        "while": ts.SyntaxKind.WhileKeyword,
        "with": ts.SyntaxKind.WithKeyword,
        "yield": ts.SyntaxKind.YieldKeyword,
        "async": ts.SyntaxKind.AsyncKeyword,
        "await": ts.SyntaxKind.AwaitKeyword,
        "of": ts.SyntaxKind.OfKeyword,
        "{": ts.SyntaxKind.OpenBraceToken,
        "}": ts.SyntaxKind.CloseBraceToken,
        "(": ts.SyntaxKind.OpenParenToken,
        ")": ts.SyntaxKind.CloseParenToken,
        "[": ts.SyntaxKind.OpenBracketToken,
        "]": ts.SyntaxKind.CloseBracketToken,
        ".": ts.SyntaxKind.DotToken,
        "...": ts.SyntaxKind.DotDotDotToken,
        ";": ts.SyntaxKind.SemicolonToken,
        ",": ts.SyntaxKind.CommaToken,
        "<": ts.SyntaxKind.LessThanToken,
        ">": ts.SyntaxKind.GreaterThanToken,
        "<=": ts.SyntaxKind.LessThanEqualsToken,
        ">=": ts.SyntaxKind.GreaterThanEqualsToken,
        "==": ts.SyntaxKind.EqualsEqualsToken,
        "!=": ts.SyntaxKind.ExclamationEqualsToken,
        "===": ts.SyntaxKind.EqualsEqualsEqualsToken,
        "!==": ts.SyntaxKind.ExclamationEqualsEqualsToken,
        "=>": ts.SyntaxKind.EqualsGreaterThanToken,
        "+": ts.SyntaxKind.PlusToken,
        "-": ts.SyntaxKind.MinusToken,
        "**": ts.SyntaxKind.AsteriskAsteriskToken,
        "*": ts.SyntaxKind.AsteriskToken,
        "/": ts.SyntaxKind.SlashToken,
        "%": ts.SyntaxKind.PercentToken,
        "++": ts.SyntaxKind.PlusPlusToken,
        "--": ts.SyntaxKind.MinusMinusToken,
        "<<": ts.SyntaxKind.LessThanLessThanToken,
        "</": ts.SyntaxKind.LessThanSlashToken,
        ">>": ts.SyntaxKind.GreaterThanGreaterThanToken,
        ">>>": ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken,
        "&": ts.SyntaxKind.AmpersandToken,
        "|": ts.SyntaxKind.BarToken,
        "^": ts.SyntaxKind.CaretToken,
        "!": ts.SyntaxKind.ExclamationToken,
        "~": ts.SyntaxKind.TildeToken,
        "&&": ts.SyntaxKind.AmpersandAmpersandToken,
        "||": ts.SyntaxKind.BarBarToken,
        "?": ts.SyntaxKind.QuestionToken,
        ":": ts.SyntaxKind.ColonToken,
        "=": ts.SyntaxKind.EqualsToken,
        "+=": ts.SyntaxKind.PlusEqualsToken,
        "-=": ts.SyntaxKind.MinusEqualsToken,
        "*=": ts.SyntaxKind.AsteriskEqualsToken,
        "**=": ts.SyntaxKind.AsteriskAsteriskEqualsToken,
        "/=": ts.SyntaxKind.SlashEqualsToken,
        "%=": ts.SyntaxKind.PercentEqualsToken,
        "<<=": ts.SyntaxKind.LessThanLessThanEqualsToken,
        ">>=": ts.SyntaxKind.GreaterThanGreaterThanEqualsToken,
        ">>>=": ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
        "&=": ts.SyntaxKind.AmpersandEqualsToken,
        "|=": ts.SyntaxKind.BarEqualsToken,
        "^=": ts.SyntaxKind.CaretEqualsToken,
        "@": ts.SyntaxKind.AtToken,
    });
    /*
        As per ECMAScript Language Specification 3th Edition, Section 7.6: Identifiers
        IdentifierStart ::
            Can contain Unicode 3.0.0 categories:
            Uppercase letter (Lu),
            Lowercase letter (Ll),
            Titlecase letter (Lt),
            Modifier letter (Lm),
            Other letter (Lo), or
            Letter number (Nl).
        IdentifierPart :: =
            Can contain IdentifierStart + Unicode 3.0.0 categories:
            Non-spacing mark (Mn),
            Combining spacing mark (Mc),
            Decimal number (Nd), or
            Connector punctuation (Pc).

        Codepoint ranges for ES3 Identifiers are extracted from the Unicode 3.0.0 specification at:
        http://www.unicode.org/Public/3.0-Update/UnicodeData-3.0.0.txt
    */
    const unicodeES3IdentifierStart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 543, 546, 563, 592, 685, 688, 696, 699, 705, 720, 721, 736, 740, 750, 750, 890, 890, 902, 902, 904, 906, 908, 908, 910, 929, 931, 974, 976, 983, 986, 1011, 1024, 1153, 1164, 1220, 1223, 1224, 1227, 1228, 1232, 1269, 1272, 1273, 1329, 1366, 1369, 1369, 1377, 1415, 1488, 1514, 1520, 1522, 1569, 1594, 1600, 1610, 1649, 1747, 1749, 1749, 1765, 1766, 1786, 1788, 1808, 1808, 1810, 1836, 1920, 1957, 2309, 2361, 2365, 2365, 2384, 2384, 2392, 2401, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2524, 2525, 2527, 2529, 2544, 2545, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654, 2674, 2676, 2693, 2699, 2701, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2784, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2870, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 2997, 2999, 3001, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3168, 3169, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3294, 3294, 3296, 3297, 3333, 3340, 3342, 3344, 3346, 3368, 3370, 3385, 3424, 3425, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3760, 3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3805, 3840, 3840, 3904, 3911, 3913, 3946, 3976, 3979, 4096, 4129, 4131, 4135, 4137, 4138, 4176, 4181, 4256, 4293, 4304, 4342, 4352, 4441, 4447, 4514, 4520, 4601, 4608, 4614, 4616, 4678, 4680, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4742, 4744, 4744, 4746, 4749, 4752, 4782, 4784, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4814, 4816, 4822, 4824, 4846, 4848, 4878, 4880, 4880, 4882, 4885, 4888, 4894, 4896, 4934, 4936, 4954, 5024, 5108, 5121, 5740, 5743, 5750, 5761, 5786, 5792, 5866, 6016, 6067, 6176, 6263, 6272, 6312, 7680, 7835, 7840, 7929, 7936, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8319, 8319, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8497, 8499, 8505, 8544, 8579, 12293, 12295, 12321, 12329, 12337, 12341, 12344, 12346, 12353, 12436, 12445, 12446, 12449, 12538, 12540, 12542, 12549, 12588, 12593, 12686, 12704, 12727, 13312, 19893, 19968, 40869, 40960, 42124, 44032, 55203, 63744, 64045, 64256, 64262, 64275, 64279, 64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65136, 65138, 65140, 65140, 65142, 65276, 65313, 65338, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];
    const unicodeES3IdentifierPart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 543, 546, 563, 592, 685, 688, 696, 699, 705, 720, 721, 736, 740, 750, 750, 768, 846, 864, 866, 890, 890, 902, 902, 904, 906, 908, 908, 910, 929, 931, 974, 976, 983, 986, 1011, 1024, 1153, 1155, 1158, 1164, 1220, 1223, 1224, 1227, 1228, 1232, 1269, 1272, 1273, 1329, 1366, 1369, 1369, 1377, 1415, 1425, 1441, 1443, 1465, 1467, 1469, 1471, 1471, 1473, 1474, 1476, 1476, 1488, 1514, 1520, 1522, 1569, 1594, 1600, 1621, 1632, 1641, 1648, 1747, 1749, 1756, 1759, 1768, 1770, 1773, 1776, 1788, 1808, 1836, 1840, 1866, 1920, 1968, 2305, 2307, 2309, 2361, 2364, 2381, 2384, 2388, 2392, 2403, 2406, 2415, 2433, 2435, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2492, 2492, 2494, 2500, 2503, 2504, 2507, 2509, 2519, 2519, 2524, 2525, 2527, 2531, 2534, 2545, 2562, 2562, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2620, 2620, 2622, 2626, 2631, 2632, 2635, 2637, 2649, 2652, 2654, 2654, 2662, 2676, 2689, 2691, 2693, 2699, 2701, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2748, 2757, 2759, 2761, 2763, 2765, 2768, 2768, 2784, 2784, 2790, 2799, 2817, 2819, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2870, 2873, 2876, 2883, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2909, 2911, 2913, 2918, 2927, 2946, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 2997, 2999, 3001, 3006, 3010, 3014, 3016, 3018, 3021, 3031, 3031, 3047, 3055, 3073, 3075, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3134, 3140, 3142, 3144, 3146, 3149, 3157, 3158, 3168, 3169, 3174, 3183, 3202, 3203, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3262, 3268, 3270, 3272, 3274, 3277, 3285, 3286, 3294, 3294, 3296, 3297, 3302, 3311, 3330, 3331, 3333, 3340, 3342, 3344, 3346, 3368, 3370, 3385, 3390, 3395, 3398, 3400, 3402, 3405, 3415, 3415, 3424, 3425, 3430, 3439, 3458, 3459, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3530, 3530, 3535, 3540, 3542, 3542, 3544, 3551, 3570, 3571, 3585, 3642, 3648, 3662, 3664, 3673, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3769, 3771, 3773, 3776, 3780, 3782, 3782, 3784, 3789, 3792, 3801, 3804, 3805, 3840, 3840, 3864, 3865, 3872, 3881, 3893, 3893, 3895, 3895, 3897, 3897, 3902, 3911, 3913, 3946, 3953, 3972, 3974, 3979, 3984, 3991, 3993, 4028, 4038, 4038, 4096, 4129, 4131, 4135, 4137, 4138, 4140, 4146, 4150, 4153, 4160, 4169, 4176, 4185, 4256, 4293, 4304, 4342, 4352, 4441, 4447, 4514, 4520, 4601, 4608, 4614, 4616, 4678, 4680, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4742, 4744, 4744, 4746, 4749, 4752, 4782, 4784, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4814, 4816, 4822, 4824, 4846, 4848, 4878, 4880, 4880, 4882, 4885, 4888, 4894, 4896, 4934, 4936, 4954, 4969, 4977, 5024, 5108, 5121, 5740, 5743, 5750, 5761, 5786, 5792, 5866, 6016, 6099, 6112, 6121, 6160, 6169, 6176, 6263, 6272, 6313, 7680, 7835, 7840, 7929, 7936, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8255, 8256, 8319, 8319, 8400, 8412, 8417, 8417, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8497, 8499, 8505, 8544, 8579, 12293, 12295, 12321, 12335, 12337, 12341, 12344, 12346, 12353, 12436, 12441, 12442, 12445, 12446, 12449, 12542, 12549, 12588, 12593, 12686, 12704, 12727, 13312, 19893, 19968, 40869, 40960, 42124, 44032, 55203, 63744, 64045, 64256, 64262, 64275, 64279, 64285, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65056, 65059, 65075, 65076, 65101, 65103, 65136, 65138, 65140, 65140, 65142, 65276, 65296, 65305, 65313, 65338, 65343, 65343, 65345, 65370, 65381, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];
    /*
        As per ECMAScript Language Specification 5th Edition, Section 7.6: ISyntaxToken Names and Identifiers
        IdentifierStart ::
            Can contain Unicode 6.2 categories:
            Uppercase letter (Lu),
            Lowercase letter (Ll),
            Titlecase letter (Lt),
            Modifier letter (Lm),
            Other letter (Lo), or
            Letter number (Nl).
        IdentifierPart ::
            Can contain IdentifierStart + Unicode 6.2 categories:
            Non-spacing mark (Mn),
            Combining spacing mark (Mc),
            Decimal number (Nd),
            Connector punctuation (Pc),
            <ZWNJ>, or
            <ZWJ>.

        Codepoint ranges for ES5 Identifiers are extracted from the Unicode 6.2 specification at:
        http://www.unicode.org/Public/6.2.0/ucd/UnicodeData.txt
    */
    const unicodeES5IdentifierStart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 880, 884, 886, 887, 890, 893, 902, 902, 904, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1162, 1319, 1329, 1366, 1369, 1369, 1377, 1415, 1488, 1514, 1520, 1522, 1568, 1610, 1646, 1647, 1649, 1747, 1749, 1749, 1765, 1766, 1774, 1775, 1786, 1788, 1791, 1791, 1808, 1808, 1810, 1839, 1869, 1957, 1969, 1969, 1994, 2026, 2036, 2037, 2042, 2042, 2048, 2069, 2074, 2074, 2084, 2084, 2088, 2088, 2112, 2136, 2208, 2208, 2210, 2220, 2308, 2361, 2365, 2365, 2384, 2384, 2392, 2401, 2417, 2423, 2425, 2431, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2493, 2493, 2510, 2510, 2524, 2525, 2527, 2529, 2544, 2545, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2649, 2652, 2654, 2654, 2674, 2676, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2749, 2749, 2768, 2768, 2784, 2785, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2877, 2877, 2908, 2909, 2911, 2913, 2929, 2929, 2947, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3024, 3024, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3133, 3133, 3160, 3161, 3168, 3169, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3261, 3261, 3294, 3294, 3296, 3297, 3313, 3314, 3333, 3340, 3342, 3344, 3346, 3386, 3389, 3389, 3406, 3406, 3424, 3425, 3450, 3455, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3585, 3632, 3634, 3635, 3648, 3654, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3760, 3762, 3763, 3773, 3773, 3776, 3780, 3782, 3782, 3804, 3807, 3840, 3840, 3904, 3911, 3913, 3948, 3976, 3980, 4096, 4138, 4159, 4159, 4176, 4181, 4186, 4189, 4193, 4193, 4197, 4198, 4206, 4208, 4213, 4225, 4238, 4238, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4992, 5007, 5024, 5108, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5872, 5888, 5900, 5902, 5905, 5920, 5937, 5952, 5969, 5984, 5996, 5998, 6000, 6016, 6067, 6103, 6103, 6108, 6108, 6176, 6263, 6272, 6312, 6314, 6314, 6320, 6389, 6400, 6428, 6480, 6509, 6512, 6516, 6528, 6571, 6593, 6599, 6656, 6678, 6688, 6740, 6823, 6823, 6917, 6963, 6981, 6987, 7043, 7072, 7086, 7087, 7098, 7141, 7168, 7203, 7245, 7247, 7258, 7293, 7401, 7404, 7406, 7409, 7413, 7414, 7424, 7615, 7680, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8305, 8305, 8319, 8319, 8336, 8348, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11310, 11312, 11358, 11360, 11492, 11499, 11502, 11506, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11648, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 11823, 11823, 12293, 12295, 12321, 12329, 12337, 12341, 12344, 12348, 12353, 12438, 12445, 12447, 12449, 12538, 12540, 12543, 12549, 12589, 12593, 12686, 12704, 12730, 12784, 12799, 13312, 19893, 19968, 40908, 40960, 42124, 42192, 42237, 42240, 42508, 42512, 42527, 42538, 42539, 42560, 42606, 42623, 42647, 42656, 42735, 42775, 42783, 42786, 42888, 42891, 42894, 42896, 42899, 42912, 42922, 43000, 43009, 43011, 43013, 43015, 43018, 43020, 43042, 43072, 43123, 43138, 43187, 43250, 43255, 43259, 43259, 43274, 43301, 43312, 43334, 43360, 43388, 43396, 43442, 43471, 43471, 43520, 43560, 43584, 43586, 43588, 43595, 43616, 43638, 43642, 43642, 43648, 43695, 43697, 43697, 43701, 43702, 43705, 43709, 43712, 43712, 43714, 43714, 43739, 43741, 43744, 43754, 43762, 43764, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43968, 44002, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64285, 64287, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65136, 65140, 65142, 65276, 65313, 65338, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];
    const unicodeES5IdentifierPart = [170, 170, 181, 181, 186, 186, 192, 214, 216, 246, 248, 705, 710, 721, 736, 740, 748, 748, 750, 750, 768, 884, 886, 887, 890, 893, 902, 902, 904, 906, 908, 908, 910, 929, 931, 1013, 1015, 1153, 1155, 1159, 1162, 1319, 1329, 1366, 1369, 1369, 1377, 1415, 1425, 1469, 1471, 1471, 1473, 1474, 1476, 1477, 1479, 1479, 1488, 1514, 1520, 1522, 1552, 1562, 1568, 1641, 1646, 1747, 1749, 1756, 1759, 1768, 1770, 1788, 1791, 1791, 1808, 1866, 1869, 1969, 1984, 2037, 2042, 2042, 2048, 2093, 2112, 2139, 2208, 2208, 2210, 2220, 2276, 2302, 2304, 2403, 2406, 2415, 2417, 2423, 2425, 2431, 2433, 2435, 2437, 2444, 2447, 2448, 2451, 2472, 2474, 2480, 2482, 2482, 2486, 2489, 2492, 2500, 2503, 2504, 2507, 2510, 2519, 2519, 2524, 2525, 2527, 2531, 2534, 2545, 2561, 2563, 2565, 2570, 2575, 2576, 2579, 2600, 2602, 2608, 2610, 2611, 2613, 2614, 2616, 2617, 2620, 2620, 2622, 2626, 2631, 2632, 2635, 2637, 2641, 2641, 2649, 2652, 2654, 2654, 2662, 2677, 2689, 2691, 2693, 2701, 2703, 2705, 2707, 2728, 2730, 2736, 2738, 2739, 2741, 2745, 2748, 2757, 2759, 2761, 2763, 2765, 2768, 2768, 2784, 2787, 2790, 2799, 2817, 2819, 2821, 2828, 2831, 2832, 2835, 2856, 2858, 2864, 2866, 2867, 2869, 2873, 2876, 2884, 2887, 2888, 2891, 2893, 2902, 2903, 2908, 2909, 2911, 2915, 2918, 2927, 2929, 2929, 2946, 2947, 2949, 2954, 2958, 2960, 2962, 2965, 2969, 2970, 2972, 2972, 2974, 2975, 2979, 2980, 2984, 2986, 2990, 3001, 3006, 3010, 3014, 3016, 3018, 3021, 3024, 3024, 3031, 3031, 3046, 3055, 3073, 3075, 3077, 3084, 3086, 3088, 3090, 3112, 3114, 3123, 3125, 3129, 3133, 3140, 3142, 3144, 3146, 3149, 3157, 3158, 3160, 3161, 3168, 3171, 3174, 3183, 3202, 3203, 3205, 3212, 3214, 3216, 3218, 3240, 3242, 3251, 3253, 3257, 3260, 3268, 3270, 3272, 3274, 3277, 3285, 3286, 3294, 3294, 3296, 3299, 3302, 3311, 3313, 3314, 3330, 3331, 3333, 3340, 3342, 3344, 3346, 3386, 3389, 3396, 3398, 3400, 3402, 3406, 3415, 3415, 3424, 3427, 3430, 3439, 3450, 3455, 3458, 3459, 3461, 3478, 3482, 3505, 3507, 3515, 3517, 3517, 3520, 3526, 3530, 3530, 3535, 3540, 3542, 3542, 3544, 3551, 3570, 3571, 3585, 3642, 3648, 3662, 3664, 3673, 3713, 3714, 3716, 3716, 3719, 3720, 3722, 3722, 3725, 3725, 3732, 3735, 3737, 3743, 3745, 3747, 3749, 3749, 3751, 3751, 3754, 3755, 3757, 3769, 3771, 3773, 3776, 3780, 3782, 3782, 3784, 3789, 3792, 3801, 3804, 3807, 3840, 3840, 3864, 3865, 3872, 3881, 3893, 3893, 3895, 3895, 3897, 3897, 3902, 3911, 3913, 3948, 3953, 3972, 3974, 3991, 3993, 4028, 4038, 4038, 4096, 4169, 4176, 4253, 4256, 4293, 4295, 4295, 4301, 4301, 4304, 4346, 4348, 4680, 4682, 4685, 4688, 4694, 4696, 4696, 4698, 4701, 4704, 4744, 4746, 4749, 4752, 4784, 4786, 4789, 4792, 4798, 4800, 4800, 4802, 4805, 4808, 4822, 4824, 4880, 4882, 4885, 4888, 4954, 4957, 4959, 4992, 5007, 5024, 5108, 5121, 5740, 5743, 5759, 5761, 5786, 5792, 5866, 5870, 5872, 5888, 5900, 5902, 5908, 5920, 5940, 5952, 5971, 5984, 5996, 5998, 6000, 6002, 6003, 6016, 6099, 6103, 6103, 6108, 6109, 6112, 6121, 6155, 6157, 6160, 6169, 6176, 6263, 6272, 6314, 6320, 6389, 6400, 6428, 6432, 6443, 6448, 6459, 6470, 6509, 6512, 6516, 6528, 6571, 6576, 6601, 6608, 6617, 6656, 6683, 6688, 6750, 6752, 6780, 6783, 6793, 6800, 6809, 6823, 6823, 6912, 6987, 6992, 7001, 7019, 7027, 7040, 7155, 7168, 7223, 7232, 7241, 7245, 7293, 7376, 7378, 7380, 7414, 7424, 7654, 7676, 7957, 7960, 7965, 7968, 8005, 8008, 8013, 8016, 8023, 8025, 8025, 8027, 8027, 8029, 8029, 8031, 8061, 8064, 8116, 8118, 8124, 8126, 8126, 8130, 8132, 8134, 8140, 8144, 8147, 8150, 8155, 8160, 8172, 8178, 8180, 8182, 8188, 8204, 8205, 8255, 8256, 8276, 8276, 8305, 8305, 8319, 8319, 8336, 8348, 8400, 8412, 8417, 8417, 8421, 8432, 8450, 8450, 8455, 8455, 8458, 8467, 8469, 8469, 8473, 8477, 8484, 8484, 8486, 8486, 8488, 8488, 8490, 8493, 8495, 8505, 8508, 8511, 8517, 8521, 8526, 8526, 8544, 8584, 11264, 11310, 11312, 11358, 11360, 11492, 11499, 11507, 11520, 11557, 11559, 11559, 11565, 11565, 11568, 11623, 11631, 11631, 11647, 11670, 11680, 11686, 11688, 11694, 11696, 11702, 11704, 11710, 11712, 11718, 11720, 11726, 11728, 11734, 11736, 11742, 11744, 11775, 11823, 11823, 12293, 12295, 12321, 12335, 12337, 12341, 12344, 12348, 12353, 12438, 12441, 12442, 12445, 12447, 12449, 12538, 12540, 12543, 12549, 12589, 12593, 12686, 12704, 12730, 12784, 12799, 13312, 19893, 19968, 40908, 40960, 42124, 42192, 42237, 42240, 42508, 42512, 42539, 42560, 42607, 42612, 42621, 42623, 42647, 42655, 42737, 42775, 42783, 42786, 42888, 42891, 42894, 42896, 42899, 42912, 42922, 43000, 43047, 43072, 43123, 43136, 43204, 43216, 43225, 43232, 43255, 43259, 43259, 43264, 43309, 43312, 43347, 43360, 43388, 43392, 43456, 43471, 43481, 43520, 43574, 43584, 43597, 43600, 43609, 43616, 43638, 43642, 43643, 43648, 43714, 43739, 43741, 43744, 43759, 43762, 43766, 43777, 43782, 43785, 43790, 43793, 43798, 43808, 43814, 43816, 43822, 43968, 44010, 44012, 44013, 44016, 44025, 44032, 55203, 55216, 55238, 55243, 55291, 63744, 64109, 64112, 64217, 64256, 64262, 64275, 64279, 64285, 64296, 64298, 64310, 64312, 64316, 64318, 64318, 64320, 64321, 64323, 64324, 64326, 64433, 64467, 64829, 64848, 64911, 64914, 64967, 65008, 65019, 65024, 65039, 65056, 65062, 65075, 65076, 65101, 65103, 65136, 65140, 65142, 65276, 65296, 65305, 65313, 65338, 65343, 65343, 65345, 65370, 65382, 65470, 65474, 65479, 65482, 65487, 65490, 65495, 65498, 65500,];
    function lookupInUnicodeMap(code, map) {
        // Bail out quickly if it couldn't possibly be in the map.
        if (code < map[0]) {
            return false;
        }
        // Perform binary search in one of the Unicode range maps
        let lo = 0;
        let hi = map.length;
        let mid;
        while (lo + 1 < hi) {
            mid = lo + (hi - lo) / 2;
            // mid has to be even to catch a range's beginning
            mid -= mid % 2;
            if (map[mid] <= code && code <= map[mid + 1]) {
                return true;
            }
            if (code < map[mid]) {
                hi = mid;
            }
            else {
                lo = mid + 2;
            }
        }
        return false;
    }
    /* @internal */ function isUnicodeIdentifierStart(code, languageVersion) {
        return languageVersion >= ts.ScriptTarget.ES5 ?
            lookupInUnicodeMap(code, unicodeES5IdentifierStart) :
            lookupInUnicodeMap(code, unicodeES3IdentifierStart);
    }
    ts.isUnicodeIdentifierStart = isUnicodeIdentifierStart;
    function isUnicodeIdentifierPart(code, languageVersion) {
        return languageVersion >= ts.ScriptTarget.ES5 ?
            lookupInUnicodeMap(code, unicodeES5IdentifierPart) :
            lookupInUnicodeMap(code, unicodeES3IdentifierPart);
    }
    function makeReverseMap(source) {
        const result = [];
        source.forEach((value, name) => {
            result[value] = name;
        });
        return result;
    }
    const tokenStrings = makeReverseMap(textToToken);
    function tokenToString(t) {
        return tokenStrings[t];
    }
    ts.tokenToString = tokenToString;
    /* @internal */
    function stringToToken(s) {
        return textToToken.get(s);
    }
    ts.stringToToken = stringToToken;
    /* @internal */
    function computeLineStarts(text) {
        const result = new Array();
        let pos = 0;
        let lineStart = 0;
        while (pos < text.length) {
            const ch = text.charCodeAt(pos);
            pos++;
            switch (ch) {
                case 13 /* carriageReturn */:
                    if (text.charCodeAt(pos) === 10 /* lineFeed */) {
                        pos++;
                    }
                // falls through
                case 10 /* lineFeed */:
                    result.push(lineStart);
                    lineStart = pos;
                    break;
                default:
                    if (ch > 127 /* maxAsciiCharacter */ && isLineBreak(ch)) {
                        result.push(lineStart);
                        lineStart = pos;
                    }
                    break;
            }
        }
        result.push(lineStart);
        return result;
    }
    ts.computeLineStarts = computeLineStarts;
    function getPositionOfLineAndCharacter(sourceFile, line, character) {
        return computePositionOfLineAndCharacter(getLineStarts(sourceFile), line, character, sourceFile.text);
    }
    ts.getPositionOfLineAndCharacter = getPositionOfLineAndCharacter;
    /* @internal */
    function computePositionOfLineAndCharacter(lineStarts, line, character, debugText) {
        if (line < 0 || line >= lineStarts.length) {
            ts.Debug.fail(`Bad line number. Line: ${line}, lineStarts.length: ${lineStarts.length} , line map is correct? ${debugText !== undefined ? ts.arraysEqual(lineStarts, computeLineStarts(debugText)) : "unknown"}`);
        }
        const res = lineStarts[line] + character;
        if (line < lineStarts.length - 1) {
            ts.Debug.assert(res < lineStarts[line + 1]);
        }
        else if (debugText !== undefined) {
            ts.Debug.assert(res <= debugText.length); // Allow single character overflow for trailing newline
        }
        return res;
    }
    ts.computePositionOfLineAndCharacter = computePositionOfLineAndCharacter;
    /* @internal */
    function getLineStarts(sourceFile) {
        return sourceFile.lineMap || (sourceFile.lineMap = computeLineStarts(sourceFile.text));
    }
    ts.getLineStarts = getLineStarts;
    /* @internal */
    /**
     * We assume the first line starts at position 0 and 'position' is non-negative.
     */
    function computeLineAndCharacterOfPosition(lineStarts, position) {
        let lineNumber = ts.binarySearch(lineStarts, position, ts.identity, ts.compareValues);
        if (lineNumber < 0) {
            // If the actual position was not found,
            // the binary search returns the 2's-complement of the next line start
            // e.g. if the line starts at [5, 10, 23, 80] and the position requested was 20
            // then the search will return -2.
            //
            // We want the index of the previous line start, so we subtract 1.
            // Review 2's-complement if this is confusing.
            lineNumber = ~lineNumber - 1;
            ts.Debug.assert(lineNumber !== -1, "position cannot precede the beginning of the file");
        }
        return {
            line: lineNumber,
            character: position - lineStarts[lineNumber]
        };
    }
    ts.computeLineAndCharacterOfPosition = computeLineAndCharacterOfPosition;
    function getLineAndCharacterOfPosition(sourceFile, position) {
        return computeLineAndCharacterOfPosition(getLineStarts(sourceFile), position);
    }
    ts.getLineAndCharacterOfPosition = getLineAndCharacterOfPosition;
    function isWhiteSpaceLike(ch) {
        return isWhiteSpaceSingleLine(ch) || isLineBreak(ch);
    }
    ts.isWhiteSpaceLike = isWhiteSpaceLike;
    /** Does not include line breaks. For that, see isWhiteSpaceLike. */
    function isWhiteSpaceSingleLine(ch) {
        // Note: nextLine is in the Zs space, and should be considered to be a whitespace.
        // It is explicitly not a line-break as it isn't in the exact set specified by EcmaScript.
        return ch === 32 /* space */ ||
            ch === 9 /* tab */ ||
            ch === 11 /* verticalTab */ ||
            ch === 12 /* formFeed */ ||
            ch === 160 /* nonBreakingSpace */ ||
            ch === 133 /* nextLine */ ||
            ch === 5760 /* ogham */ ||
            ch >= 8192 /* enQuad */ && ch <= 8203 /* zeroWidthSpace */ ||
            ch === 8239 /* narrowNoBreakSpace */ ||
            ch === 8287 /* mathematicalSpace */ ||
            ch === 12288 /* ideographicSpace */ ||
            ch === 65279 /* byteOrderMark */;
    }
    ts.isWhiteSpaceSingleLine = isWhiteSpaceSingleLine;
    function isLineBreak(ch) {
        // ES5 7.3:
        // The ECMAScript line terminator characters are listed in Table 3.
        //     Table 3: Line Terminator Characters
        //     Code Unit Value     Name                    Formal Name
        //     \u000A              Line Feed               <LF>
        //     \u000D              Carriage Return         <CR>
        //     \u2028              Line separator          <LS>
        //     \u2029              Paragraph separator     <PS>
        // Only the characters in Table 3 are treated as line terminators. Other new line or line
        // breaking characters are treated as white space but not as line terminators.
        return ch === 10 /* lineFeed */ ||
            ch === 13 /* carriageReturn */ ||
            ch === 8232 /* lineSeparator */ ||
            ch === 8233 /* paragraphSeparator */;
    }
    ts.isLineBreak = isLineBreak;
    function isDigit(ch) {
        return ch >= 48 /* _0 */ && ch <= 57 /* _9 */;
    }
    /* @internal */
    function isOctalDigit(ch) {
        return ch >= 48 /* _0 */ && ch <= 55 /* _7 */;
    }
    ts.isOctalDigit = isOctalDigit;
    function couldStartTrivia(text, pos) {
        // Keep in sync with skipTrivia
        const ch = text.charCodeAt(pos);
        switch (ch) {
            case 13 /* carriageReturn */:
            case 10 /* lineFeed */:
            case 9 /* tab */:
            case 11 /* verticalTab */:
            case 12 /* formFeed */:
            case 32 /* space */:
            case 47 /* slash */:
            // starts of normal trivia
            case 60 /* lessThan */:
            case 124 /* bar */:
            case 61 /* equals */:
            case 62 /* greaterThan */:
                // Starts of conflict marker trivia
                return true;
            case 35 /* hash */:
                // Only if its the beginning can we have #! trivia
                return pos === 0;
            default:
                return ch > 127 /* maxAsciiCharacter */;
        }
    }
    ts.couldStartTrivia = couldStartTrivia;
    /* @internal */
    function skipTrivia(text, pos, stopAfterLineBreak, stopAtComments = false) {
        if (ts.positionIsSynthesized(pos)) {
            return pos;
        }
        // Keep in sync with couldStartTrivia
        while (true) {
            const ch = text.charCodeAt(pos);
            switch (ch) {
                case 13 /* carriageReturn */:
                    if (text.charCodeAt(pos + 1) === 10 /* lineFeed */) {
                        pos++;
                    }
                // falls through
                case 10 /* lineFeed */:
                    pos++;
                    if (stopAfterLineBreak) {
                        return pos;
                    }
                    continue;
                case 9 /* tab */:
                case 11 /* verticalTab */:
                case 12 /* formFeed */:
                case 32 /* space */:
                    pos++;
                    continue;
                case 47 /* slash */:
                    if (stopAtComments) {
                        break;
                    }
                    if (text.charCodeAt(pos + 1) === 47 /* slash */) {
                        pos += 2;
                        while (pos < text.length) {
                            if (isLineBreak(text.charCodeAt(pos))) {
                                break;
                            }
                            pos++;
                        }
                        continue;
                    }
                    if (text.charCodeAt(pos + 1) === 42 /* asterisk */) {
                        pos += 2;
                        while (pos < text.length) {
                            if (text.charCodeAt(pos) === 42 /* asterisk */ && text.charCodeAt(pos + 1) === 47 /* slash */) {
                                pos += 2;
                                break;
                            }
                            pos++;
                        }
                        continue;
                    }
                    break;
                case 60 /* lessThan */:
                case 124 /* bar */:
                case 61 /* equals */:
                case 62 /* greaterThan */:
                    if (isConflictMarkerTrivia(text, pos)) {
                        pos = scanConflictMarkerTrivia(text, pos);
                        continue;
                    }
                    break;
                case 35 /* hash */:
                    if (pos === 0 && isShebangTrivia(text, pos)) {
                        pos = scanShebangTrivia(text, pos);
                        continue;
                    }
                    break;
                default:
                    if (ch > 127 /* maxAsciiCharacter */ && (isWhiteSpaceLike(ch))) {
                        pos++;
                        continue;
                    }
                    break;
            }
            return pos;
        }
    }
    ts.skipTrivia = skipTrivia;
    // All conflict markers consist of the same character repeated seven times.  If it is
    // a <<<<<<< or >>>>>>> marker then it is also followed by a space.
    const mergeConflictMarkerLength = "<<<<<<<".length;
    function isConflictMarkerTrivia(text, pos) {
        ts.Debug.assert(pos >= 0);
        // Conflict markers must be at the start of a line.
        if (pos === 0 || isLineBreak(text.charCodeAt(pos - 1))) {
            const ch = text.charCodeAt(pos);
            if ((pos + mergeConflictMarkerLength) < text.length) {
                for (let i = 0; i < mergeConflictMarkerLength; i++) {
                    if (text.charCodeAt(pos + i) !== ch) {
                        return false;
                    }
                }
                return ch === 61 /* equals */ ||
                    text.charCodeAt(pos + mergeConflictMarkerLength) === 32 /* space */;
            }
        }
        return false;
    }
    function scanConflictMarkerTrivia(text, pos, error) {
        if (error) {
            error(Diagnostics.Merge_conflict_marker_encountered, pos, mergeConflictMarkerLength);
        }
        const ch = text.charCodeAt(pos);
        const len = text.length;
        if (ch === 60 /* lessThan */ || ch === 62 /* greaterThan */) {
            while (pos < len && !isLineBreak(text.charCodeAt(pos))) {
                pos++;
            }
        }
        else {
            ts.Debug.assert(ch === 124 /* bar */ || ch === 61 /* equals */);
            // Consume everything from the start of a ||||||| or ======= marker to the start
            // of the next ======= or >>>>>>> marker.
            while (pos < len) {
                const currentChar = text.charCodeAt(pos);
                if ((currentChar === 61 /* equals */ || currentChar === 62 /* greaterThan */) && currentChar !== ch && isConflictMarkerTrivia(text, pos)) {
                    break;
                }
                pos++;
            }
        }
        return pos;
    }
    const shebangTriviaRegex = /^#!.*/;
    function isShebangTrivia(text, pos) {
        // Shebangs check must only be done at the start of the file
        ts.Debug.assert(pos === 0);
        return shebangTriviaRegex.test(text);
    }
    function scanShebangTrivia(text, pos) {
        const shebang = shebangTriviaRegex.exec(text)[0];
        pos = pos + shebang.length;
        return pos;
    }
    /**
     * Invokes a callback for each comment range following the provided position.
     *
     * Single-line comment ranges include the leading double-slash characters but not the ending
     * line break. Multi-line comment ranges include the leading slash-asterisk and trailing
     * asterisk-slash characters.
     *
     * @param reduce If true, accumulates the result of calling the callback in a fashion similar
     *      to reduceLeft. If false, iteration stops when the callback returns a truthy value.
     * @param text The source text to scan.
     * @param pos The position at which to start scanning.
     * @param trailing If false, whitespace is skipped until the first line break and comments
     *      between that location and the next token are returned. If true, comments occurring
     *      between the given position and the next line break are returned.
     * @param cb The callback to execute as each comment range is encountered.
     * @param state A state value to pass to each iteration of the callback.
     * @param initial An initial value to pass when accumulating results (when "reduce" is true).
     * @returns If "reduce" is true, the accumulated value. If "reduce" is false, the first truthy
     *      return value of the callback.
     */
    function iterateCommentRanges(reduce, text, pos, trailing, cb, state, initial) {
        let pendingPos;
        let pendingEnd;
        let pendingKind;
        let pendingHasTrailingNewLine;
        let hasPendingCommentRange = false;
        let collecting = trailing || pos === 0;
        let accumulator = initial;
        scan: while (pos >= 0 && pos < text.length) {
            const ch = text.charCodeAt(pos);
            switch (ch) {
                case 13 /* carriageReturn */:
                    if (text.charCodeAt(pos + 1) === 10 /* lineFeed */) {
                        pos++;
                    }
                // falls through
                case 10 /* lineFeed */:
                    pos++;
                    if (trailing) {
                        break scan;
                    }
                    collecting = true;
                    if (hasPendingCommentRange) {
                        pendingHasTrailingNewLine = true;
                    }
                    continue;
                case 9 /* tab */:
                case 11 /* verticalTab */:
                case 12 /* formFeed */:
                case 32 /* space */:
                    pos++;
                    continue;
                case 47 /* slash */:
                    const nextChar = text.charCodeAt(pos + 1);
                    let hasTrailingNewLine = false;
                    if (nextChar === 47 /* slash */ || nextChar === 42 /* asterisk */) {
                        const kind = nextChar === 47 /* slash */ ? ts.SyntaxKind.SingleLineCommentTrivia : ts.SyntaxKind.MultiLineCommentTrivia;
                        const startPos = pos;
                        pos += 2;
                        if (nextChar === 47 /* slash */) {
                            while (pos < text.length) {
                                if (isLineBreak(text.charCodeAt(pos))) {
                                    hasTrailingNewLine = true;
                                    break;
                                }
                                pos++;
                            }
                        }
                        else {
                            while (pos < text.length) {
                                if (text.charCodeAt(pos) === 42 /* asterisk */ && text.charCodeAt(pos + 1) === 47 /* slash */) {
                                    pos += 2;
                                    break;
                                }
                                pos++;
                            }
                        }
                        if (collecting) {
                            if (hasPendingCommentRange) {
                                accumulator = cb(pendingPos, pendingEnd, pendingKind, pendingHasTrailingNewLine, state, accumulator);
                                if (!reduce && accumulator) {
                                    // If we are not reducing and we have a truthy result, return it.
                                    return accumulator;
                                }
                            }
                            pendingPos = startPos;
                            pendingEnd = pos;
                            pendingKind = kind;
                            pendingHasTrailingNewLine = hasTrailingNewLine;
                            hasPendingCommentRange = true;
                        }
                        continue;
                    }
                    break scan;
                default:
                    if (ch > 127 /* maxAsciiCharacter */ && (isWhiteSpaceLike(ch))) {
                        if (hasPendingCommentRange && isLineBreak(ch)) {
                            pendingHasTrailingNewLine = true;
                        }
                        pos++;
                        continue;
                    }
                    break scan;
            }
        }
        if (hasPendingCommentRange) {
            accumulator = cb(pendingPos, pendingEnd, pendingKind, pendingHasTrailingNewLine, state, accumulator);
        }
        return accumulator;
    }
    function forEachLeadingCommentRange(text, pos, cb, state) {
        return iterateCommentRanges(/*reduce*/ false, text, pos, /*trailing*/ false, cb, state);
    }
    ts.forEachLeadingCommentRange = forEachLeadingCommentRange;
    function forEachTrailingCommentRange(text, pos, cb, state) {
        return iterateCommentRanges(/*reduce*/ false, text, pos, /*trailing*/ true, cb, state);
    }
    ts.forEachTrailingCommentRange = forEachTrailingCommentRange;
    function reduceEachLeadingCommentRange(text, pos, cb, state, initial) {
        return iterateCommentRanges(/*reduce*/ true, text, pos, /*trailing*/ false, cb, state, initial);
    }
    ts.reduceEachLeadingCommentRange = reduceEachLeadingCommentRange;
    function reduceEachTrailingCommentRange(text, pos, cb, state, initial) {
        return iterateCommentRanges(/*reduce*/ true, text, pos, /*trailing*/ true, cb, state, initial);
    }
    ts.reduceEachTrailingCommentRange = reduceEachTrailingCommentRange;
    function appendCommentRange(pos, end, kind, hasTrailingNewLine, _state, comments) {
        if (!comments) {
            comments = [];
        }
        comments.push({ kind, pos, end, hasTrailingNewLine });
        return comments;
    }
    function getLeadingCommentRanges(text, pos) {
        return reduceEachLeadingCommentRange(text, pos, appendCommentRange, /*state*/ undefined, /*initial*/ undefined);
    }
    ts.getLeadingCommentRanges = getLeadingCommentRanges;
    function getTrailingCommentRanges(text, pos) {
        return reduceEachTrailingCommentRange(text, pos, appendCommentRange, /*state*/ undefined, /*initial*/ undefined);
    }
    ts.getTrailingCommentRanges = getTrailingCommentRanges;
    /** Optionally, get the shebang */
    function getShebang(text) {
        const match = shebangTriviaRegex.exec(text);
        if (match) {
            return match[0];
        }
    }
    ts.getShebang = getShebang;
    function isIdentifierStart(ch, languageVersion) {
        return ch >= 65 /* A */ && ch <= 90 /* Z */ || ch >= 97 /* a */ && ch <= 122 /* z */ ||
            ch === 36 /* $ */ || ch === 95 /* _ */ ||
            ch > 127 /* maxAsciiCharacter */ && isUnicodeIdentifierStart(ch, languageVersion);
    }
    ts.isIdentifierStart = isIdentifierStart;
    function isIdentifierPart(ch, languageVersion) {
        return ch >= 65 /* A */ && ch <= 90 /* Z */ || ch >= 97 /* a */ && ch <= 122 /* z */ ||
            ch >= 48 /* _0 */ && ch <= 57 /* _9 */ || ch === 36 /* $ */ || ch === 95 /* _ */ ||
            ch > 127 /* maxAsciiCharacter */ && isUnicodeIdentifierPart(ch, languageVersion);
    }
    ts.isIdentifierPart = isIdentifierPart;
    /* @internal */
    function isIdentifierText(name, languageVersion) {
        if (!isIdentifierStart(name.charCodeAt(0), languageVersion)) {
            return false;
        }
        for (let i = 1; i < name.length; i++) {
            if (!isIdentifierPart(name.charCodeAt(i), languageVersion)) {
                return false;
            }
        }
        return true;
    }
    ts.isIdentifierText = isIdentifierText;
    // Creates a scanner over a (possibly unspecified) range of a piece of text.
    function createScanner(languageVersion, skipTrivia, languageVariant = ts.LanguageVariant.Standard, text, onError, start, length) {
        // Current position (end position of text of current token)
        let pos;
        // end of text
        let end;
        // Start position of whitespace before current token
        let startPos;
        // Start position of text of current token
        let tokenPos;
        let token;
        let tokenValue;
        let tokenFlags;
        setText(text, start, length);
        return {
            getStartPos: () => startPos,
            getTextPos: () => pos,
            getToken: () => token,
            getTokenPos: () => tokenPos,
            getTokenText: () => text.substring(tokenPos, pos),
            getTokenValue: () => tokenValue,
            hasExtendedUnicodeEscape: () => (tokenFlags & 8 /* ExtendedUnicodeEscape */) !== 0,
            hasPrecedingLineBreak: () => (tokenFlags & 1 /* PrecedingLineBreak */) !== 0,
            isIdentifier: () => token === ts.SyntaxKind.Identifier || token > ts.SyntaxKind.LastReservedWord,
            isReservedWord: () => token >= ts.SyntaxKind.FirstReservedWord && token <= ts.SyntaxKind.LastReservedWord,
            isUnterminated: () => (tokenFlags & 4 /* Unterminated */) !== 0,
            getTokenFlags: () => tokenFlags,
            reScanGreaterToken,
            reScanSlashToken,
            reScanTemplateToken,
            scanJsxIdentifier,
            scanJsxAttributeValue,
            reScanJsxToken,
            scanJsxToken,
            scanJSDocToken,
            scan,
            getText,
            setText,
            setScriptTarget,
            setLanguageVariant,
            setOnError,
            setTextPos,
            tryScan,
            lookAhead,
            scanRange,
        };
        function error(message, errPos = pos, length) {
            if (onError) {
                const oldPos = pos;
                pos = errPos;
                onError(message, length || 0);
                pos = oldPos;
            }
        }
        function scanNumberFragment() {
            let start = pos;
            let allowSeparator = false;
            let isPreviousTokenSeparator = false;
            let result = "";
            while (true) {
                const ch = text.charCodeAt(pos);
                if (ch === 95 /* _ */) {
                    tokenFlags |= 512 /* ContainsSeparator */;
                    if (allowSeparator) {
                        allowSeparator = false;
                        isPreviousTokenSeparator = true;
                        result += text.substring(start, pos);
                    }
                    else if (isPreviousTokenSeparator) {
                        error(Diagnostics.Multiple_consecutive_numeric_separators_are_not_permitted, pos, 1);
                    }
                    else {
                        error(Diagnostics.Numeric_separators_are_not_allowed_here, pos, 1);
                    }
                    pos++;
                    start = pos;
                    continue;
                }
                if (isDigit(ch)) {
                    allowSeparator = true;
                    isPreviousTokenSeparator = false;
                    pos++;
                    continue;
                }
                break;
            }
            if (text.charCodeAt(pos - 1) === 95 /* _ */) {
                error(Diagnostics.Numeric_separators_are_not_allowed_here, pos - 1, 1);
            }
            return result + text.substring(start, pos);
        }
        function scanNumber() {
            const start = pos;
            const mainFragment = scanNumberFragment();
            let decimalFragment;
            let scientificFragment;
            if (text.charCodeAt(pos) === 46 /* dot */) {
                pos++;
                decimalFragment = scanNumberFragment();
            }
            let end = pos;
            if (text.charCodeAt(pos) === 69 /* E */ || text.charCodeAt(pos) === 101 /* e */) {
                pos++;
                tokenFlags |= 16 /* Scientific */;
                if (text.charCodeAt(pos) === 43 /* plus */ || text.charCodeAt(pos) === 45 /* minus */)
                    pos++;
                const preNumericPart = pos;
                const finalFragment = scanNumberFragment();
                if (!finalFragment) {
                    error(Diagnostics.Digit_expected);
                }
                else {
                    scientificFragment = text.substring(end, preNumericPart) + finalFragment;
                    end = pos;
                }
            }
            if (tokenFlags & 512 /* ContainsSeparator */) {
                let result = mainFragment;
                if (decimalFragment) {
                    result += "." + decimalFragment;
                }
                if (scientificFragment) {
                    result += scientificFragment;
                }
                return "" + +result;
            }
            else {
                return "" + +(text.substring(start, end)); // No need to use all the fragments; no _ removal needed
            }
        }
        function scanOctalDigits() {
            const start = pos;
            while (isOctalDigit(text.charCodeAt(pos))) {
                pos++;
            }
            return +(text.substring(start, pos));
        }
        /**
         * Scans the given number of hexadecimal digits in the text,
         * returning -1 if the given number is unavailable.
         */
        function scanExactNumberOfHexDigits(count, canHaveSeparators) {
            return scanHexDigits(/*minCount*/ count, /*scanAsManyAsPossible*/ false, canHaveSeparators);
        }
        /**
         * Scans as many hexadecimal digits as are available in the text,
         * returning -1 if the given number of digits was unavailable.
         */
        function scanMinimumNumberOfHexDigits(count, canHaveSeparators) {
            return scanHexDigits(/*minCount*/ count, /*scanAsManyAsPossible*/ true, canHaveSeparators);
        }
        function scanHexDigits(minCount, scanAsManyAsPossible, canHaveSeparators) {
            let digits = 0;
            let value = 0;
            let allowSeparator = false;
            let isPreviousTokenSeparator = false;
            while (digits < minCount || scanAsManyAsPossible) {
                const ch = text.charCodeAt(pos);
                if (canHaveSeparators && ch === 95 /* _ */) {
                    tokenFlags |= 512 /* ContainsSeparator */;
                    if (allowSeparator) {
                        allowSeparator = false;
                        isPreviousTokenSeparator = true;
                    }
                    else if (isPreviousTokenSeparator) {
                        error(Diagnostics.Multiple_consecutive_numeric_separators_are_not_permitted, pos, 1);
                    }
                    else {
                        error(Diagnostics.Numeric_separators_are_not_allowed_here, pos, 1);
                    }
                    pos++;
                    continue;
                }
                allowSeparator = canHaveSeparators;
                if (ch >= 48 /* _0 */ && ch <= 57 /* _9 */) {
                    value = value * 16 + ch - 48 /* _0 */;
                }
                else if (ch >= 65 /* A */ && ch <= 70 /* F */) {
                    value = value * 16 + ch - 65 /* A */ + 10;
                }
                else if (ch >= 97 /* a */ && ch <= 102 /* f */) {
                    value = value * 16 + ch - 97 /* a */ + 10;
                }
                else {
                    break;
                }
                pos++;
                digits++;
                isPreviousTokenSeparator = false;
            }
            if (digits < minCount) {
                value = -1;
            }
            if (text.charCodeAt(pos - 1) === 95 /* _ */) {
                error(Diagnostics.Numeric_separators_are_not_allowed_here, pos - 1, 1);
            }
            return value;
        }
        function scanString(jsxAttributeString = false) {
            const quote = text.charCodeAt(pos);
            pos++;
            let result = "";
            let start = pos;
            while (true) {
                if (pos >= end) {
                    result += text.substring(start, pos);
                    tokenFlags |= 4 /* Unterminated */;
                    error(Diagnostics.Unterminated_string_literal);
                    break;
                }
                const ch = text.charCodeAt(pos);
                if (ch === quote) {
                    result += text.substring(start, pos);
                    pos++;
                    break;
                }
                if (ch === 92 /* backslash */ && !jsxAttributeString) {
                    result += text.substring(start, pos);
                    result += scanEscapeSequence();
                    start = pos;
                    continue;
                }
                if (isLineBreak(ch) && !jsxAttributeString) {
                    result += text.substring(start, pos);
                    tokenFlags |= 4 /* Unterminated */;
                    error(Diagnostics.Unterminated_string_literal);
                    break;
                }
                pos++;
            }
            return result;
        }
        /**
         * Sets the current 'tokenValue' and returns a NoSubstitutionTemplateLiteral or
         * a literal component of a TemplateExpression.
         */
        function scanTemplateAndSetTokenValue() {
            const startedWithBacktick = text.charCodeAt(pos) === 96 /* backtick */;
            pos++;
            let start = pos;
            let contents = "";
            let resultingToken;
            while (true) {
                if (pos >= end) {
                    contents += text.substring(start, pos);
                    tokenFlags |= 4 /* Unterminated */;
                    error(Diagnostics.Unterminated_template_literal);
                    resultingToken = startedWithBacktick ? ts.SyntaxKind.NoSubstitutionTemplateLiteral : ts.SyntaxKind.TemplateTail;
                    break;
                }
                const currChar = text.charCodeAt(pos);
                // '`'
                if (currChar === 96 /* backtick */) {
                    contents += text.substring(start, pos);
                    pos++;
                    resultingToken = startedWithBacktick ? ts.SyntaxKind.NoSubstitutionTemplateLiteral : ts.SyntaxKind.TemplateTail;
                    break;
                }
                // '${'
                if (currChar === 36 /* $ */ && pos + 1 < end && text.charCodeAt(pos + 1) === 123 /* openBrace */) {
                    contents += text.substring(start, pos);
                    pos += 2;
                    resultingToken = startedWithBacktick ? ts.SyntaxKind.TemplateHead : ts.SyntaxKind.TemplateMiddle;
                    break;
                }
                // Escape character
                if (currChar === 92 /* backslash */) {
                    contents += text.substring(start, pos);
                    contents += scanEscapeSequence();
                    start = pos;
                    continue;
                }
                // Speculated ECMAScript 6 Spec 11.8.6.1:
                // <CR><LF> and <CR> LineTerminatorSequences are normalized to <LF> for Template Values
                if (currChar === 13 /* carriageReturn */) {
                    contents += text.substring(start, pos);
                    pos++;
                    if (pos < end && text.charCodeAt(pos) === 10 /* lineFeed */) {
                        pos++;
                    }
                    contents += "\n";
                    start = pos;
                    continue;
                }
                pos++;
            }
            ts.Debug.assert(resultingToken !== undefined);
            tokenValue = contents;
            return resultingToken;
        }
        function scanEscapeSequence() {
            pos++;
            if (pos >= end) {
                error(Diagnostics.Unexpected_end_of_text);
                return "";
            }
            const ch = text.charCodeAt(pos);
            pos++;
            switch (ch) {
                case 48 /* _0 */:
                    return "\0";
                case 98 /* b */:
                    return "\b";
                case 116 /* t */:
                    return "\t";
                case 110 /* n */:
                    return "\n";
                case 118 /* v */:
                    return "\v";
                case 102 /* f */:
                    return "\f";
                case 114 /* r */:
                    return "\r";
                case 39 /* singleQuote */:
                    return "\'";
                case 34 /* doubleQuote */:
                    return "\"";
                case 117 /* u */:
                    // '\u{DDDDDDDD}'
                    if (pos < end && text.charCodeAt(pos) === 123 /* openBrace */) {
                        tokenFlags |= 8 /* ExtendedUnicodeEscape */;
                        pos++;
                        return scanExtendedUnicodeEscape();
                    }
                    // '\uDDDD'
                    return scanHexadecimalEscape(/*numDigits*/ 4);
                case 120 /* x */:
                    // '\xDD'
                    return scanHexadecimalEscape(/*numDigits*/ 2);
                // when encountering a LineContinuation (i.e. a backslash and a line terminator sequence),
                // the line terminator is interpreted to be "the empty code unit sequence".
                case 13 /* carriageReturn */:
                    if (pos < end && text.charCodeAt(pos) === 10 /* lineFeed */) {
                        pos++;
                    }
                // falls through
                case 10 /* lineFeed */:
                case 8232 /* lineSeparator */:
                case 8233 /* paragraphSeparator */:
                    return "";
                default:
                    return String.fromCharCode(ch);
            }
        }
        function scanHexadecimalEscape(numDigits) {
            const escapedValue = scanExactNumberOfHexDigits(numDigits, /*canHaveSeparators*/ false);
            if (escapedValue >= 0) {
                return String.fromCharCode(escapedValue);
            }
            else {
                error(Diagnostics.Hexadecimal_digit_expected);
                return "";
            }
        }
        function scanExtendedUnicodeEscape() {
            const escapedValue = scanMinimumNumberOfHexDigits(1, /*canHaveSeparators*/ false);
            let isInvalidExtendedEscape = false;
            // Validate the value of the digit
            if (escapedValue < 0) {
                error(Diagnostics.Hexadecimal_digit_expected);
                isInvalidExtendedEscape = true;
            }
            else if (escapedValue > 0x10FFFF) {
                error(Diagnostics.An_extended_Unicode_escape_value_must_be_between_0x0_and_0x10FFFF_inclusive);
                isInvalidExtendedEscape = true;
            }
            if (pos >= end) {
                error(Diagnostics.Unexpected_end_of_text);
                isInvalidExtendedEscape = true;
            }
            else if (text.charCodeAt(pos) === 125 /* closeBrace */) {
                // Only swallow the following character up if it's a '}'.
                pos++;
            }
            else {
                error(Diagnostics.Unterminated_Unicode_escape_sequence);
                isInvalidExtendedEscape = true;
            }
            if (isInvalidExtendedEscape) {
                return "";
            }
            return utf16EncodeAsString(escapedValue);
        }
        // Derived from the 10.1.1 UTF16Encoding of the ES6 Spec.
        function utf16EncodeAsString(codePoint) {
            ts.Debug.assert(0x0 <= codePoint && codePoint <= 0x10FFFF);
            if (codePoint <= 65535) {
                return String.fromCharCode(codePoint);
            }
            const codeUnit1 = Math.floor((codePoint - 65536) / 1024) + 0xD800;
            const codeUnit2 = ((codePoint - 65536) % 1024) + 0xDC00;
            return String.fromCharCode(codeUnit1, codeUnit2);
        }
        // Current character is known to be a backslash. Check for Unicode escape of the form '\uXXXX'
        // and return code point value if valid Unicode escape is found. Otherwise return -1.
        function peekUnicodeEscape() {
            if (pos + 5 < end && text.charCodeAt(pos + 1) === 117 /* u */) {
                const start = pos;
                pos += 2;
                const value = scanExactNumberOfHexDigits(4, /*canHaveSeparators*/ false);
                pos = start;
                return value;
            }
            return -1;
        }
        function scanIdentifierParts() {
            let result = "";
            let start = pos;
            while (pos < end) {
                let ch = text.charCodeAt(pos);
                if (isIdentifierPart(ch, languageVersion)) {
                    pos++;
                }
                else if (ch === 92 /* backslash */) {
                    ch = peekUnicodeEscape();
                    if (!(ch >= 0 && isIdentifierPart(ch, languageVersion))) {
                        break;
                    }
                    result += text.substring(start, pos);
                    result += String.fromCharCode(ch);
                    // Valid Unicode escape is always six characters
                    pos += 6;
                    start = pos;
                }
                else {
                    break;
                }
            }
            result += text.substring(start, pos);
            return result;
        }
        function getIdentifierToken() {
            // Reserved words are between 2 and 11 characters long and start with a lowercase letter
            const len = tokenValue.length;
            if (len >= 2 && len <= 11) {
                const ch = tokenValue.charCodeAt(0);
                if (ch >= 97 /* a */ && ch <= 122 /* z */) {
                    token = textToToken.get(tokenValue);
                    if (token !== undefined) {
                        return token;
                    }
                }
            }
            return token = ts.SyntaxKind.Identifier;
        }
        function scanBinaryOrOctalDigits(base) {
            ts.Debug.assert(base === 2 || base === 8, "Expected either base 2 or base 8");
            let value = 0;
            // For counting number of digits; Valid binaryIntegerLiteral must have at least one binary digit following B or b.
            // Similarly valid octalIntegerLiteral must have at least one octal digit following o or O.
            let numberOfDigits = 0;
            let separatorAllowed = false;
            let isPreviousTokenSeparator = false;
            while (true) {
                const ch = text.charCodeAt(pos);
                // Numeric seperators are allowed anywhere within a numeric literal, except not at the beginning, or following another separator
                if (ch === 95 /* _ */) {
                    tokenFlags |= 512 /* ContainsSeparator */;
                    if (separatorAllowed) {
                        separatorAllowed = false;
                        isPreviousTokenSeparator = true;
                    }
                    else if (isPreviousTokenSeparator) {
                        error(Diagnostics.Multiple_consecutive_numeric_separators_are_not_permitted, pos, 1);
                    }
                    else {
                        error(Diagnostics.Numeric_separators_are_not_allowed_here, pos, 1);
                    }
                    pos++;
                    continue;
                }
                separatorAllowed = true;
                const valueOfCh = ch - 48 /* _0 */;
                if (!isDigit(ch) || valueOfCh >= base) {
                    break;
                }
                value = value * base + valueOfCh;
                pos++;
                numberOfDigits++;
                isPreviousTokenSeparator = false;
            }
            // Invalid binaryIntegerLiteral or octalIntegerLiteral
            if (numberOfDigits === 0) {
                return -1;
            }
            if (text.charCodeAt(pos - 1) === 95 /* _ */) {
                // Literal ends with underscore - not allowed
                error(Diagnostics.Numeric_separators_are_not_allowed_here, pos - 1, 1);
                return value;
            }
            return value;
        }
        function scan() {
            startPos = pos;
            tokenFlags = 0;
            while (true) {
                tokenPos = pos;
                if (pos >= end) {
                    return token = ts.SyntaxKind.EndOfFileToken;
                }
                let ch = text.charCodeAt(pos);
                // Special handling for shebang
                if (ch === 35 /* hash */ && pos === 0 && isShebangTrivia(text, pos)) {
                    pos = scanShebangTrivia(text, pos);
                    if (skipTrivia) {
                        continue;
                    }
                    else {
                        return token = ts.SyntaxKind.ShebangTrivia;
                    }
                }
                switch (ch) {
                    case 10 /* lineFeed */:
                    case 13 /* carriageReturn */:
                        tokenFlags |= 1 /* PrecedingLineBreak */;
                        if (skipTrivia) {
                            pos++;
                            continue;
                        }
                        else {
                            if (ch === 13 /* carriageReturn */ && pos + 1 < end && text.charCodeAt(pos + 1) === 10 /* lineFeed */) {
                                // consume both CR and LF
                                pos += 2;
                            }
                            else {
                                pos++;
                            }
                            return token = ts.SyntaxKind.NewLineTrivia;
                        }
                    case 9 /* tab */:
                    case 11 /* verticalTab */:
                    case 12 /* formFeed */:
                    case 32 /* space */:
                        if (skipTrivia) {
                            pos++;
                            continue;
                        }
                        else {
                            while (pos < end && isWhiteSpaceSingleLine(text.charCodeAt(pos))) {
                                pos++;
                            }
                            return token = ts.SyntaxKind.WhitespaceTrivia;
                        }
                    case 33 /* exclamation */:
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            if (text.charCodeAt(pos + 2) === 61 /* equals */) {
                                return pos += 3, token = ts.SyntaxKind.ExclamationEqualsEqualsToken;
                            }
                            return pos += 2, token = ts.SyntaxKind.ExclamationEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.ExclamationToken;
                    case 34 /* doubleQuote */:
                    case 39 /* singleQuote */:
                        tokenValue = scanString();
                        return token = ts.SyntaxKind.StringLiteral;
                    case 96 /* backtick */:
                        return token = scanTemplateAndSetTokenValue();
                    case 37 /* percent */:
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.PercentEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.PercentToken;
                    case 38 /* ampersand */:
                        if (text.charCodeAt(pos + 1) === 38 /* ampersand */) {
                            return pos += 2, token = ts.SyntaxKind.AmpersandAmpersandToken;
                        }
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.AmpersandEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.AmpersandToken;
                    case 40 /* openParen */:
                        pos++;
                        return token = ts.SyntaxKind.OpenParenToken;
                    case 41 /* closeParen */:
                        pos++;
                        return token = ts.SyntaxKind.CloseParenToken;
                    case 42 /* asterisk */:
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.AsteriskEqualsToken;
                        }
                        if (text.charCodeAt(pos + 1) === 42 /* asterisk */) {
                            if (text.charCodeAt(pos + 2) === 61 /* equals */) {
                                return pos += 3, token = ts.SyntaxKind.AsteriskAsteriskEqualsToken;
                            }
                            return pos += 2, token = ts.SyntaxKind.AsteriskAsteriskToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.AsteriskToken;
                    case 43 /* plus */:
                        if (text.charCodeAt(pos + 1) === 43 /* plus */) {
                            return pos += 2, token = ts.SyntaxKind.PlusPlusToken;
                        }
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.PlusEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.PlusToken;
                    case 44 /* comma */:
                        pos++;
                        return token = ts.SyntaxKind.CommaToken;
                    case 45 /* minus */:
                        if (text.charCodeAt(pos + 1) === 45 /* minus */) {
                            return pos += 2, token = ts.SyntaxKind.MinusMinusToken;
                        }
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.MinusEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.MinusToken;
                    case 46 /* dot */:
                        if (isDigit(text.charCodeAt(pos + 1))) {
                            tokenValue = scanNumber();
                            return token = ts.SyntaxKind.NumericLiteral;
                        }
                        if (text.charCodeAt(pos + 1) === 46 /* dot */ && text.charCodeAt(pos + 2) === 46 /* dot */) {
                            return pos += 3, token = ts.SyntaxKind.DotDotDotToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.DotToken;
                    case 47 /* slash */:
                        // Single-line comment
                        if (text.charCodeAt(pos + 1) === 47 /* slash */) {
                            pos += 2;
                            while (pos < end) {
                                if (isLineBreak(text.charCodeAt(pos))) {
                                    break;
                                }
                                pos++;
                            }
                            if (skipTrivia) {
                                continue;
                            }
                            else {
                                return token = ts.SyntaxKind.SingleLineCommentTrivia;
                            }
                        }
                        // Multi-line comment
                        if (text.charCodeAt(pos + 1) === 42 /* asterisk */) {
                            pos += 2;
                            if (text.charCodeAt(pos) === 42 /* asterisk */ && text.charCodeAt(pos + 1) !== 47 /* slash */) {
                                tokenFlags |= 2 /* PrecedingJSDocComment */;
                            }
                            let commentClosed = false;
                            while (pos < end) {
                                const ch = text.charCodeAt(pos);
                                if (ch === 42 /* asterisk */ && text.charCodeAt(pos + 1) === 47 /* slash */) {
                                    pos += 2;
                                    commentClosed = true;
                                    break;
                                }
                                if (isLineBreak(ch)) {
                                    tokenFlags |= 1 /* PrecedingLineBreak */;
                                }
                                pos++;
                            }
                            if (!commentClosed) {
                                error(Diagnostics.Asterisk_Slash_expected);
                            }
                            if (skipTrivia) {
                                continue;
                            }
                            else {
                                if (!commentClosed) {
                                    tokenFlags |= 4 /* Unterminated */;
                                }
                                return token = ts.SyntaxKind.MultiLineCommentTrivia;
                            }
                        }
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.SlashEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.SlashToken;
                    case 48 /* _0 */:
                        if (pos + 2 < end && (text.charCodeAt(pos + 1) === 88 /* X */ || text.charCodeAt(pos + 1) === 120 /* x */)) {
                            pos += 2;
                            let value = scanMinimumNumberOfHexDigits(1, /*canHaveSeparators*/ true);
                            if (value < 0) {
                                error(Diagnostics.Hexadecimal_digit_expected);
                                value = 0;
                            }
                            tokenValue = "" + value;
                            tokenFlags |= 64 /* HexSpecifier */;
                            return token = ts.SyntaxKind.NumericLiteral;
                        }
                        else if (pos + 2 < end && (text.charCodeAt(pos + 1) === 66 /* B */ || text.charCodeAt(pos + 1) === 98 /* b */)) {
                            pos += 2;
                            let value = scanBinaryOrOctalDigits(/* base */ 2);
                            if (value < 0) {
                                error(Diagnostics.Binary_digit_expected);
                                value = 0;
                            }
                            tokenValue = "" + value;
                            tokenFlags |= 128 /* BinarySpecifier */;
                            return token = ts.SyntaxKind.NumericLiteral;
                        }
                        else if (pos + 2 < end && (text.charCodeAt(pos + 1) === 79 /* O */ || text.charCodeAt(pos + 1) === 111 /* o */)) {
                            pos += 2;
                            let value = scanBinaryOrOctalDigits(/* base */ 8);
                            if (value < 0) {
                                error(Diagnostics.Octal_digit_expected);
                                value = 0;
                            }
                            tokenValue = "" + value;
                            tokenFlags |= 256 /* OctalSpecifier */;
                            return token = ts.SyntaxKind.NumericLiteral;
                        }
                        // Try to parse as an octal
                        if (pos + 1 < end && isOctalDigit(text.charCodeAt(pos + 1))) {
                            tokenValue = "" + scanOctalDigits();
                            tokenFlags |= 32 /* Octal */;
                            return token = ts.SyntaxKind.NumericLiteral;
                        }
                    // This fall-through is a deviation from the EcmaScript grammar. The grammar says that a leading zero
                    // can only be followed by an octal digit, a dot, or the end of the number literal. However, we are being
                    // permissive and allowing decimal digits of the form 08* and 09* (which many browsers also do).
                    // falls through
                    case 49 /* _1 */:
                    case 50 /* _2 */:
                    case 51 /* _3 */:
                    case 52 /* _4 */:
                    case 53 /* _5 */:
                    case 54 /* _6 */:
                    case 55 /* _7 */:
                    case 56 /* _8 */:
                    case 57 /* _9 */:
                        tokenValue = scanNumber();
                        return token = ts.SyntaxKind.NumericLiteral;
                    case 58 /* colon */:
                        pos++;
                        return token = ts.SyntaxKind.ColonToken;
                    case 59 /* semicolon */:
                        pos++;
                        return token = ts.SyntaxKind.SemicolonToken;
                    case 60 /* lessThan */:
                        if (isConflictMarkerTrivia(text, pos)) {
                            pos = scanConflictMarkerTrivia(text, pos, error);
                            if (skipTrivia) {
                                continue;
                            }
                            else {
                                return token = ts.SyntaxKind.ConflictMarkerTrivia;
                            }
                        }
                        if (text.charCodeAt(pos + 1) === 60 /* lessThan */) {
                            if (text.charCodeAt(pos + 2) === 61 /* equals */) {
                                return pos += 3, token = ts.SyntaxKind.LessThanLessThanEqualsToken;
                            }
                            return pos += 2, token = ts.SyntaxKind.LessThanLessThanToken;
                        }
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.LessThanEqualsToken;
                        }
                        if (languageVariant === ts.LanguageVariant.JSX &&
                            text.charCodeAt(pos + 1) === 47 /* slash */ &&
                            text.charCodeAt(pos + 2) !== 42 /* asterisk */) {
                            return pos += 2, token = ts.SyntaxKind.LessThanSlashToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.LessThanToken;
                    case 61 /* equals */:
                        if (isConflictMarkerTrivia(text, pos)) {
                            pos = scanConflictMarkerTrivia(text, pos, error);
                            if (skipTrivia) {
                                continue;
                            }
                            else {
                                return token = ts.SyntaxKind.ConflictMarkerTrivia;
                            }
                        }
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            if (text.charCodeAt(pos + 2) === 61 /* equals */) {
                                return pos += 3, token = ts.SyntaxKind.EqualsEqualsEqualsToken;
                            }
                            return pos += 2, token = ts.SyntaxKind.EqualsEqualsToken;
                        }
                        if (text.charCodeAt(pos + 1) === 62 /* greaterThan */) {
                            return pos += 2, token = ts.SyntaxKind.EqualsGreaterThanToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.EqualsToken;
                    case 62 /* greaterThan */:
                        if (isConflictMarkerTrivia(text, pos)) {
                            pos = scanConflictMarkerTrivia(text, pos, error);
                            if (skipTrivia) {
                                continue;
                            }
                            else {
                                return token = ts.SyntaxKind.ConflictMarkerTrivia;
                            }
                        }
                        pos++;
                        return token = ts.SyntaxKind.GreaterThanToken;
                    case 63 /* question */:
                        pos++;
                        return token = ts.SyntaxKind.QuestionToken;
                    case 91 /* openBracket */:
                        pos++;
                        return token = ts.SyntaxKind.OpenBracketToken;
                    case 93 /* closeBracket */:
                        pos++;
                        return token = ts.SyntaxKind.CloseBracketToken;
                    case 94 /* caret */:
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.CaretEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.CaretToken;
                    case 123 /* openBrace */:
                        pos++;
                        return token = ts.SyntaxKind.OpenBraceToken;
                    case 124 /* bar */:
                        if (isConflictMarkerTrivia(text, pos)) {
                            pos = scanConflictMarkerTrivia(text, pos, error);
                            if (skipTrivia) {
                                continue;
                            }
                            else {
                                return token = ts.SyntaxKind.ConflictMarkerTrivia;
                            }
                        }
                        if (text.charCodeAt(pos + 1) === 124 /* bar */) {
                            return pos += 2, token = ts.SyntaxKind.BarBarToken;
                        }
                        if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                            return pos += 2, token = ts.SyntaxKind.BarEqualsToken;
                        }
                        pos++;
                        return token = ts.SyntaxKind.BarToken;
                    case 125 /* closeBrace */:
                        pos++;
                        return token = ts.SyntaxKind.CloseBraceToken;
                    case 126 /* tilde */:
                        pos++;
                        return token = ts.SyntaxKind.TildeToken;
                    case 64 /* at */:
                        pos++;
                        return token = ts.SyntaxKind.AtToken;
                    case 92 /* backslash */:
                        const cookedChar = peekUnicodeEscape();
                        if (cookedChar >= 0 && isIdentifierStart(cookedChar, languageVersion)) {
                            pos += 6;
                            tokenValue = String.fromCharCode(cookedChar) + scanIdentifierParts();
                            return token = getIdentifierToken();
                        }
                        error(Diagnostics.Invalid_character);
                        pos++;
                        return token = ts.SyntaxKind.Unknown;
                    default:
                        if (isIdentifierStart(ch, languageVersion)) {
                            pos++;
                            while (pos < end && isIdentifierPart(ch = text.charCodeAt(pos), languageVersion))
                                pos++;
                            tokenValue = text.substring(tokenPos, pos);
                            if (ch === 92 /* backslash */) {
                                tokenValue += scanIdentifierParts();
                            }
                            return token = getIdentifierToken();
                        }
                        else if (isWhiteSpaceSingleLine(ch)) {
                            pos++;
                            continue;
                        }
                        else if (isLineBreak(ch)) {
                            tokenFlags |= 1 /* PrecedingLineBreak */;
                            pos++;
                            continue;
                        }
                        error(Diagnostics.Invalid_character);
                        pos++;
                        return token = ts.SyntaxKind.Unknown;
                }
            }
        }
        function reScanGreaterToken() {
            if (token === ts.SyntaxKind.GreaterThanToken) {
                if (text.charCodeAt(pos) === 62 /* greaterThan */) {
                    if (text.charCodeAt(pos + 1) === 62 /* greaterThan */) {
                        if (text.charCodeAt(pos + 2) === 61 /* equals */) {
                            return pos += 3, token = ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken;
                        }
                        return pos += 2, token = ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken;
                    }
                    if (text.charCodeAt(pos + 1) === 61 /* equals */) {
                        return pos += 2, token = ts.SyntaxKind.GreaterThanGreaterThanEqualsToken;
                    }
                    pos++;
                    return token = ts.SyntaxKind.GreaterThanGreaterThanToken;
                }
                if (text.charCodeAt(pos) === 61 /* equals */) {
                    pos++;
                    return token = ts.SyntaxKind.GreaterThanEqualsToken;
                }
            }
            return token;
        }
        function reScanSlashToken() {
            if (token === ts.SyntaxKind.SlashToken || token === ts.SyntaxKind.SlashEqualsToken) {
                let p = tokenPos + 1;
                let inEscape = false;
                let inCharacterClass = false;
                while (true) {
                    // If we reach the end of a file, or hit a newline, then this is an unterminated
                    // regex.  Report error and return what we have so far.
                    if (p >= end) {
                        tokenFlags |= 4 /* Unterminated */;
                        error(Diagnostics.Unterminated_regular_expression_literal);
                        break;
                    }
                    const ch = text.charCodeAt(p);
                    if (isLineBreak(ch)) {
                        tokenFlags |= 4 /* Unterminated */;
                        error(Diagnostics.Unterminated_regular_expression_literal);
                        break;
                    }
                    if (inEscape) {
                        // Parsing an escape character;
                        // reset the flag and just advance to the next char.
                        inEscape = false;
                    }
                    else if (ch === 47 /* slash */ && !inCharacterClass) {
                        // A slash within a character class is permissible,
                        // but in general it signals the end of the regexp literal.
                        p++;
                        break;
                    }
                    else if (ch === 91 /* openBracket */) {
                        inCharacterClass = true;
                    }
                    else if (ch === 92 /* backslash */) {
                        inEscape = true;
                    }
                    else if (ch === 93 /* closeBracket */) {
                        inCharacterClass = false;
                    }
                    p++;
                }
                while (p < end && isIdentifierPart(text.charCodeAt(p), languageVersion)) {
                    p++;
                }
                pos = p;
                tokenValue = text.substring(tokenPos, pos);
                token = ts.SyntaxKind.RegularExpressionLiteral;
            }
            return token;
        }
        /**
         * Unconditionally back up and scan a template expression portion.
         */
        function reScanTemplateToken() {
            ts.Debug.assert(token === ts.SyntaxKind.CloseBraceToken, "'reScanTemplateToken' should only be called on a '}'");
            pos = tokenPos;
            return token = scanTemplateAndSetTokenValue();
        }
        function reScanJsxToken() {
            pos = tokenPos = startPos;
            return token = scanJsxToken();
        }
        function scanJsxToken() {
            startPos = tokenPos = pos;
            if (pos >= end) {
                return token = ts.SyntaxKind.EndOfFileToken;
            }
            let char = text.charCodeAt(pos);
            if (char === 60 /* lessThan */) {
                if (text.charCodeAt(pos + 1) === 47 /* slash */) {
                    pos += 2;
                    return token = ts.SyntaxKind.LessThanSlashToken;
                }
                pos++;
                return token = ts.SyntaxKind.LessThanToken;
            }
            if (char === 123 /* openBrace */) {
                pos++;
                return token = ts.SyntaxKind.OpenBraceToken;
            }
            // First non-whitespace character on this line.
            let firstNonWhitespace = 0;
            // These initial values are special because the first line is:
            // firstNonWhitespace = 0 to indicate that we want leading whitspace,
            while (pos < end) {
                char = text.charCodeAt(pos);
                if (char === 123 /* openBrace */) {
                    break;
                }
                if (char === 60 /* lessThan */) {
                    if (isConflictMarkerTrivia(text, pos)) {
                        pos = scanConflictMarkerTrivia(text, pos, error);
                        return token = ts.SyntaxKind.ConflictMarkerTrivia;
                    }
                    break;
                }
                // FirstNonWhitespace is 0, then we only see whitespaces so far. If we see a linebreak, we want to ignore that whitespaces.
                // i.e (- : whitespace)
                //      <div>----
                //      </div> becomes <div></div>
                //
                //      <div>----</div> becomes <div>----</div>
                if (isLineBreak(char) && firstNonWhitespace === 0) {
                    firstNonWhitespace = -1;
                }
                else if (!isWhiteSpaceLike(char)) {
                    firstNonWhitespace = pos;
                }
                pos++;
            }
            return firstNonWhitespace === -1 ? ts.SyntaxKind.JsxTextAllWhiteSpaces : ts.SyntaxKind.JsxText;
        }
        // Scans a JSX identifier; these differ from normal identifiers in that
        // they allow dashes
        function scanJsxIdentifier() {
            if (tokenIsIdentifierOrKeyword(token)) {
                const firstCharPosition = pos;
                while (pos < end) {
                    const ch = text.charCodeAt(pos);
                    if (ch === 45 /* minus */ || ((firstCharPosition === pos) ? isIdentifierStart(ch, languageVersion) : isIdentifierPart(ch, languageVersion))) {
                        pos++;
                    }
                    else {
                        break;
                    }
                }
                tokenValue += text.substring(firstCharPosition, pos);
            }
            return token;
        }
        function scanJsxAttributeValue() {
            startPos = pos;
            switch (text.charCodeAt(pos)) {
                case 34 /* doubleQuote */:
                case 39 /* singleQuote */:
                    tokenValue = scanString(/*jsxAttributeString*/ true);
                    return token = ts.SyntaxKind.StringLiteral;
                default:
                    // If this scans anything other than `{`, it's a parse error.
                    return scan();
            }
        }
        function scanJSDocToken() {
            if (pos >= end) {
                return token = ts.SyntaxKind.EndOfFileToken;
            }
            startPos = pos;
            tokenPos = pos;
            const ch = text.charCodeAt(pos);
            pos++;
            switch (ch) {
                case 9 /* tab */:
                case 11 /* verticalTab */:
                case 12 /* formFeed */:
                case 32 /* space */:
                    while (pos < end && isWhiteSpaceSingleLine(text.charCodeAt(pos))) {
                        pos++;
                    }
                    return token = ts.SyntaxKind.WhitespaceTrivia;
                case 64 /* at */:
                    return token = ts.SyntaxKind.AtToken;
                case 10 /* lineFeed */:
                case 13 /* carriageReturn */:
                    return token = ts.SyntaxKind.NewLineTrivia;
                case 42 /* asterisk */:
                    return token = ts.SyntaxKind.AsteriskToken;
                case 123 /* openBrace */:
                    return token = ts.SyntaxKind.OpenBraceToken;
                case 125 /* closeBrace */:
                    return token = ts.SyntaxKind.CloseBraceToken;
                case 91 /* openBracket */:
                    return token = ts.SyntaxKind.OpenBracketToken;
                case 93 /* closeBracket */:
                    return token = ts.SyntaxKind.CloseBracketToken;
                case 60 /* lessThan */:
                    return token = ts.SyntaxKind.LessThanToken;
                case 61 /* equals */:
                    return token = ts.SyntaxKind.EqualsToken;
                case 44 /* comma */:
                    return token = ts.SyntaxKind.CommaToken;
                case 46 /* dot */:
                    return token = ts.SyntaxKind.DotToken;
                case 96 /* backtick */:
                    while (pos < end && text.charCodeAt(pos) !== 96 /* backtick */) {
                        pos++;
                    }
                    tokenValue = text.substring(tokenPos + 1, pos);
                    pos++;
                    return token = ts.SyntaxKind.NoSubstitutionTemplateLiteral;
            }
            if (isIdentifierStart(ch, ts.ScriptTarget.Latest)) {
                while (isIdentifierPart(text.charCodeAt(pos), ts.ScriptTarget.Latest) && pos < end) {
                    pos++;
                }
                tokenValue = text.substring(tokenPos, pos);
                return token = ts.SyntaxKind.Identifier;
            }
            else {
                return token = ts.SyntaxKind.Unknown;
            }
        }
        function speculationHelper(callback, isLookahead) {
            const savePos = pos;
            const saveStartPos = startPos;
            const saveTokenPos = tokenPos;
            const saveToken = token;
            const saveTokenValue = tokenValue;
            const saveTokenFlags = tokenFlags;
            const result = callback();
            // If our callback returned something 'falsy' or we're just looking ahead,
            // then unconditionally restore us to where we were.
            if (!result || isLookahead) {
                pos = savePos;
                startPos = saveStartPos;
                tokenPos = saveTokenPos;
                token = saveToken;
                tokenValue = saveTokenValue;
                tokenFlags = saveTokenFlags;
            }
            return result;
        }
        function scanRange(start, length, callback) {
            const saveEnd = end;
            const savePos = pos;
            const saveStartPos = startPos;
            const saveTokenPos = tokenPos;
            const saveToken = token;
            const saveTokenValue = tokenValue;
            const saveTokenFlags = tokenFlags;
            setText(text, start, length);
            const result = callback();
            end = saveEnd;
            pos = savePos;
            startPos = saveStartPos;
            tokenPos = saveTokenPos;
            token = saveToken;
            tokenValue = saveTokenValue;
            tokenFlags = saveTokenFlags;
            return result;
        }
        function lookAhead(callback) {
            return speculationHelper(callback, /*isLookahead*/ true);
        }
        function tryScan(callback) {
            return speculationHelper(callback, /*isLookahead*/ false);
        }
        function getText() {
            return text;
        }
        function setText(newText, start, length) {
            text = newText || "";
            end = length === undefined ? text.length : start + length;
            setTextPos(start || 0);
        }
        function setOnError(errorCallback) {
            onError = errorCallback;
        }
        function setScriptTarget(scriptTarget) {
            languageVersion = scriptTarget;
        }
        function setLanguageVariant(variant) {
            languageVariant = variant;
        }
        function setTextPos(textPos) {
            ts.Debug.assert(textPos >= 0);
            pos = textPos;
            startPos = textPos;
            tokenPos = textPos;
            token = ts.SyntaxKind.Unknown;
            tokenValue = undefined;
            tokenFlags = 0;
        }
    }
    ts.createScanner = createScanner;
})(ts || (ts = {}));
