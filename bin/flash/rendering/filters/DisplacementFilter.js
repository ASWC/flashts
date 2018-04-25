define(["require", "exports", "./Filter", "../../geom/Matrix", "./Shaders", "../../geom/Point"], function (require, exports, Filter_1, Matrix_1, Shaders_1, Point_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class DisplacementFilter extends Filter_1.Filter {
        constructor(sprite, scale) {
            const maskMatrix = new Matrix_1.Matrix();
            sprite.renderable = false;
            super(Shaders_1.Shaders.FILTER_MATRIX, Shaders_1.Shaders.DISPLACEMENT);
            this.maskSprite = sprite;
            this.maskMatrix = maskMatrix;
            this.uniforms.mapSampler = sprite._texture;
            this.uniforms.filterMatrix = maskMatrix;
            this.uniforms.scale = { x: 1, y: 1 };
            if (scale === null || scale === undefined) {
                scale = 20;
            }
            this.scale = new Point_1.Point(scale, scale);
        }
        /**
         * Applies the filter.
         *
         * @param {PIXI.FilterManager} filterManager - The manager.
         * @param {PIXI.RenderTarget} input - The input target.
         * @param {PIXI.RenderTarget} output - The output target.
         */
        apply(filterManager, input, output) {
            this.uniforms.filterMatrix = filterManager.calculateSpriteMatrix(this.maskMatrix, this.maskSprite);
            this.uniforms.scale.x = this.scale.x;
            this.uniforms.scale.y = this.scale.y;
            // draw the filter...
            filterManager.applyFilter(this, input, output);
        }
        /**
         * The texture used for the displacement map. Must be power of 2 sized texture.
         *
         * @member {PIXI.Texture}
         */
        get map() {
            return this.uniforms.mapSampler;
        }
        set map(value) {
            this.uniforms.mapSampler = value;
        }
    }
    exports.DisplacementFilter = DisplacementFilter;
});
