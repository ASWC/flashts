import { Filter } from "./Filter";
import { Matrix } from "../../geom/Matrix";
import { Shaders } from "./Shaders";
import { Point } from "../../geom/Point";



export class DisplacementFilter extends Filter
{
    /**
     * @param {PIXI.Sprite} sprite - The sprite used for the displacement map. (make sure its added to the scene!)
     * @param {number} scale - The scale of the displacement
     */
    public maskSprite:any;
    public maskMatrix:any;
    public scale:any;

    constructor(sprite, scale)
    {
        const maskMatrix = new Matrix();
        sprite.renderable = false;
        super(Shaders.FILTER_MATRIX, Shaders.DISPLACEMENT);
        this.maskSprite = sprite;
        this.maskMatrix = maskMatrix;
        this.uniforms.mapSampler = sprite._texture;
        this.uniforms.filterMatrix = maskMatrix;
        this.uniforms.scale = { x: 1, y: 1 };
        if (scale === null || scale === undefined)
        {
            scale = 20;
        }
        this.scale = new Point(scale, scale);
    }

    /**
     * Applies the filter.
     *
     * @param {PIXI.FilterManager} filterManager - The manager.
     * @param {PIXI.RenderTarget} input - The input target.
     * @param {PIXI.RenderTarget} output - The output target.
     */
    public apply(filterManager, input, output)
    {
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
    public get map()
    {
        return this.uniforms.mapSampler;
    }

    public set map(value) // eslint-disable-line require-jsdoc
    {
        this.uniforms.mapSampler = value;
    }
}