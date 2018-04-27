define(["require", "exports", "./Filter", "./BlurYFilter", "flash/display/StageSettings"], function (require, exports, Filter_1, BlurYFilter_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BlurXFilter extends Filter_1.Filter {
        constructor(strength, quality, resolution, kernelSize) {
            kernelSize = kernelSize || 5;
            const vertSrc = BlurYFilter_1.BlurYFilter.generateVertBlurSource(kernelSize, true);
            const fragSrc = BlurYFilter_1.BlurYFilter.generateVertBlurSource(kernelSize);
            super(
            // vertex shader
            vertSrc, 
            // fragment shader
            fragSrc);
            this.resolution = resolution || StageSettings_1.StageSettings.RESOLUTION;
            this._quality = 0;
            this.quality = quality || 4;
            this.strength = strength || 8;
            this.firstRun = true;
        }
        /**
         * Applies the filter.
         *
         * @param {PIXI.FilterManager} filterManager - The manager.
         * @param {PIXI.RenderTarget} input - The input target.
         * @param {PIXI.RenderTarget} output - The output target.
         * @param {boolean} clear - Should the output be cleared before rendering?
         */
        apply(filterManager, input, output, clear) {
            if (this.firstRun) {
                const gl = filterManager.renderer.gl;
                const kernelSize = BlurYFilter_1.BlurYFilter.getMaxKernelSize(gl);
                this.vertexSrc = BlurYFilter_1.BlurYFilter.generateVertBlurSource(kernelSize, true);
                this.fragmentSrc = BlurYFilter_1.BlurYFilter.generateFragBlurSource(kernelSize);
                this.firstRun = false;
            }
            this.uniforms.strength = (1 / output.size.width) * (output.size.width / input.size.width);
            // screen space!
            this.uniforms.strength *= this.strength;
            this.uniforms.strength /= this.passes; // / this.passes//Math.pow(1, this.passes);
            if (this.passes === 1) {
                filterManager.applyFilter(this, input, output, clear);
            }
            else {
                const renderTarget = filterManager.getRenderTarget(true);
                let flip = input;
                let flop = renderTarget;
                for (let i = 0; i < this.passes - 1; i++) {
                    filterManager.applyFilter(this, flip, flop, true);
                    const temp = flop;
                    flop = flip;
                    flip = temp;
                }
                filterManager.applyFilter(this, flip, output, clear);
                filterManager.returnRenderTarget(renderTarget);
            }
        }
        /**
         * Sets the strength of both the blur.
         *
         * @member {number}
         * @default 16
         */
        get blur() {
            return this.strength;
        }
        set blur(value) {
            this.padding = Math.abs(value) * 2;
            this.strength = value;
        }
        /**
        * Sets the quality of the blur by modifying the number of passes. More passes means higher
        * quaility bluring but the lower the performance.
        *
        * @member {number}
        * @default 4
        */
        get quality() {
            return this._quality;
        }
        set quality(value) {
            this._quality = value;
            this.passes = value;
        }
    }
    exports.BlurXFilter = BlurXFilter;
});
//# sourceMappingURL=BlurXFilter.js.map