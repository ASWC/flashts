define(["require", "exports", "./Filter", "./BlurXFilter", "./BlurYFilter", "flash/rendering/core/StageSettings"], function (require, exports, Filter_1, BlurXFilter_1, BlurYFilter_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BlurFilter extends Filter_1.Filter {
        constructor(strength, quality, resolution, kernelSize) {
            super();
            this.blurXFilter = new BlurXFilter_1.BlurXFilter(strength, quality, resolution, kernelSize);
            this.blurYFilter = new BlurYFilter_1.BlurYFilter(strength, quality, resolution, kernelSize);
            this.padding = 0;
            this.resolution = resolution || StageSettings_1.StageSettings.RESOLUTION;
            this.quality = quality || 4;
            this.blur = strength || 8;
        }
        /**
         * Applies the filter.
         *
         * @param {PIXI.FilterManager} filterManager - The manager.
         * @param {PIXI.RenderTarget} input - The input target.
         * @param {PIXI.RenderTarget} output - The output target.
         */
        apply(filterManager, input, output) {
            const renderTarget = filterManager.getRenderTarget(true);
            this.blurXFilter.apply(filterManager, input, renderTarget, true);
            this.blurYFilter.apply(filterManager, renderTarget, output, false);
            filterManager.returnRenderTarget(renderTarget);
        }
        /**
         * Sets the strength of both the blurX and blurY properties simultaneously
         *
         * @member {number}
         * @default 2
         */
        get blur() {
            return this.blurXFilter.blur;
        }
        set blur(value) {
            this.blurXFilter.blur = this.blurYFilter.blur = value;
            this.padding = Math.max(Math.abs(this.blurXFilter.strength), Math.abs(this.blurYFilter.strength)) * 2;
        }
        /**
         * Sets the number of passes for blur. More passes means higher quaility bluring.
         *
         * @member {number}
         * @default 1
         */
        get quality() {
            return this.blurXFilter.quality;
        }
        set quality(value) {
            this.blurXFilter.quality = this.blurYFilter.quality = value;
        }
        /**
         * Sets the strength of the blurX property
         *
         * @member {number}
         * @default 2
         */
        get blurX() {
            return this.blurXFilter.blur;
        }
        set blurX(value) {
            this.blurXFilter.blur = value;
            this.padding = Math.max(Math.abs(this.blurXFilter.strength), Math.abs(this.blurYFilter.strength)) * 2;
        }
        /**
         * Sets the strength of the blurY property
         *
         * @member {number}
         * @default 2
         */
        get blurY() {
            return this.blurYFilter.blur;
        }
        set blurY(value) {
            this.blurYFilter.blur = value;
            this.padding = Math.max(Math.abs(this.blurXFilter.strength), Math.abs(this.blurYFilter.strength)) * 2;
        }
        /**
         * Sets the blendmode of the filter
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL
         */
        get blendMode() {
            return this.blurYFilter._blendMode;
        }
        set blendMode(value) {
            this.blurYFilter._blendMode = value;
        }
    }
    exports.BlurFilter = BlurFilter;
});
//# sourceMappingURL=BlurFilter.js.map