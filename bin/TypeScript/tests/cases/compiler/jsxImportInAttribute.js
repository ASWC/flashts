//@jsx: preserve
//@module: commonjs
define(["require", "exports", "Test"], function (require, exports, Test_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    let x = Test_1.default; // emit test_1.default
    <anything attr={Test_1.default}/>; // ?
});
