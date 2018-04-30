define(["require", "exports", "./Filter", "../../geom/Matrix", "flash/display3D/textures/TextureMatrix", "./Shaders"], function (require, exports, Filter_1, Matrix_1, TextureMatrix_1, Shaders_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SpriteMaskFilter extends Filter_1.Filter {
        constructor(sprite) {
            const maskMatrix = new Matrix_1.Matrix();
            super(Shaders_1.Shaders.VERTEX_MASK, Shaders_1.Shaders.FRAGMENT_MASK);
            sprite.renderable = false;
            this.maskSprite = sprite;
            this.maskMatrix = maskMatrix;
        }
        /**
         * Applies the filter
         *
         * @param {PIXI.FilterManager} filterManager - The renderer to retrieve the filter from
         * @param {PIXI.RenderTarget} input - The input render target.
         * @param {PIXI.RenderTarget} output - The target to output to.
         */
        apply(filterManager, input, output) {
            const maskSprite = this.maskSprite;
            const tex = this.maskSprite.texture;
            if (!tex.valid) {
                return;
            }
            if (!tex.transform) {
                // margin = 0.0, let it bleed a bit, shader code becomes easier
                // assuming that atlas textures were made with 1-pixel padding
                tex.transform = new TextureMatrix_1.TextureMatrix(tex, 0.0);
            }
            tex.transform.update();
            this.uniforms.mask = tex;
            this.uniforms.otherMatrix = filterManager.calculateSpriteMatrix(this.maskMatrix, maskSprite)
                .prepend(tex.transform.mapCoord);
            this.uniforms.alpha = maskSprite.worldAlpha;
            this.uniforms.maskClamp = tex.transform.uClampFrame;
            filterManager.applyFilter(this, input, output);
        }
    }
    exports.SpriteMaskFilter = SpriteMaskFilter;
});
//# sourceMappingURL=SpriteMaskFilter.js.map