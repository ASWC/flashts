import { Filter } from "./Filter";
import { Matrix } from "../../geom/Matrix";
import { TextureMatrix } from "../math/TextureMatrix";
import { Shaders } from "./Shaders";




class SpriteMaskFilter extends Filter
{
    /**
     * @param {PIXI.Sprite} sprite - the target sprite
     */
    public maskSprite:any;
    public maskMatrix:any;

    constructor(sprite)
    {
        const maskMatrix = new Matrix();
        super(Shaders.VERTEX_MASK, Shaders.FRAGMENT_MASK);

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
    public apply(filterManager, input, output)
    {
        const maskSprite = this.maskSprite;
        const tex = this.maskSprite.texture;

        if (!tex.valid)
        {
            return;
        }
        if (!tex.transform)
        {
            // margin = 0.0, let it bleed a bit, shader code becomes easier
            // assuming that atlas textures were made with 1-pixel padding
            tex.transform = new TextureMatrix(tex, 0.0);
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
export { SpriteMaskFilter };