define(["require", "exports", "./Filter", "./Shaders"], function (require, exports, Filter_1, Shaders_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class NoiseFilter extends Filter_1.Filter {
        /**
         * @param {number} noise - The noise intensity, should be a normalized value in the range [0, 1].
         * @param {number} seed - A random seed for the noise generation. Default is `Math.random()`.
         */
        constructor(noise = 0.5, seed = Math.random()) {
            super(Shaders_1.Shaders.DEFAULT, Shaders_1.Shaders.NOISE);
            this.noise = noise;
            this.seed = seed;
        }
        /**
         * The amount of noise to apply, this value should be in the range (0, 1].
         *
         * @member {number}
         * @default 0.5
         */
        get noise() {
            return this.uniforms.uNoise;
        }
        set noise(value) {
            this.uniforms.uNoise = value;
        }
        /**
         * A seed value to apply to the random noise generation. `Math.random()` is a good value to use.
         *
         * @member {number}
         */
        get seed() {
            return this.uniforms.uSeed;
        }
        set seed(value) {
            this.uniforms.uSeed = value;
        }
    }
    exports.NoiseFilter = NoiseFilter;
});
//# sourceMappingURL=NoiseFilter.js.map