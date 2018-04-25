define(["require", "exports", "./Filter", "./Shaders"], function (require, exports, Filter_1, Shaders_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class AlphaFilter extends Filter_1.Filter {
        /**
         * @param {number} [alpha=1] Amount of alpha from 0 to 1, where 0 is transparent
         */
        constructor(alpha = 1.0) {
            super(Shaders_1.Shaders.DEFAULT, Shaders_1.Shaders.ALPHA);
            this.alpha = alpha;
            this.glShaderKey = 'alpha';
        }
        /**
         * Coefficient for alpha multiplication
         *
         * @member {number}
         * @default 1
         */
        get alpha() {
            return this.uniforms.uAlpha;
        }
        set alpha(value) {
            this.uniforms.uAlpha = value;
        }
    }
    exports.AlphaFilter = AlphaFilter;
});
