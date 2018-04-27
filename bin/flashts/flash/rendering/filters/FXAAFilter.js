define(["require", "exports", "./Filter", "./Shaders"], function (require, exports, Filter_1, Shaders_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class FXAAFilter extends Filter_1.Filter {
        /**
         *
         */
        constructor() {
            super(Shaders_1.Shaders.VERTEX_FXAA, Shaders_1.Shaders.FRAGMENT_FXAA);
        }
    }
    exports.FXAAFilter = FXAAFilter;
});
