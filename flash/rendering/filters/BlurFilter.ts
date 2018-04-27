import { Filter } from "./Filter";
import { BlurXFilter } from "./BlurXFilter";
import { BlurYFilter } from "./BlurYFilter";
import { StageSettings } from "flash/display/StageSettings";


export class BlurFilter extends Filter
{
    /**
     * @param {number} strength - The strength of the blur filter.
     * @param {number} quality - The quality of the blur filter.
     * @param {number} resolution - The resolution of the blur filter.
     * @param {number} [kernelSize=5] - The kernelSize of the blur filter.Options: 5, 7, 9, 11, 13, 15.
     */
    public blurXFilter:any;
    public blurYFilter:any;
    constructor(strength, quality, resolution, kernelSize)
    {
        super();

        this.blurXFilter = new BlurXFilter(strength, quality, resolution, kernelSize);
        this.blurYFilter = new BlurYFilter(strength, quality, resolution, kernelSize);

        this.padding = 0;
        this.resolution = resolution || StageSettings.RESOLUTION;
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
    public apply(filterManager, input, output)
    {
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
    public get blur()
    {
        return this.blurXFilter.blur;
    }

    public set blur(value) // eslint-disable-line require-jsdoc
    {
        this.blurXFilter.blur = this.blurYFilter.blur = value;
        this.padding = Math.max(Math.abs(this.blurXFilter.strength), Math.abs(this.blurYFilter.strength)) * 2;
    }

    /**
     * Sets the number of passes for blur. More passes means higher quaility bluring.
     *
     * @member {number}
     * @default 1
     */
    public get quality()
    {
        return this.blurXFilter.quality;
    }

    public set quality(value) // eslint-disable-line require-jsdoc
    {
        this.blurXFilter.quality = this.blurYFilter.quality = value;
    }

    /**
     * Sets the strength of the blurX property
     *
     * @member {number}
     * @default 2
     */
    public get blurX()
    {
        return this.blurXFilter.blur;
    }

    public set blurX(value) // eslint-disable-line require-jsdoc
    {
        this.blurXFilter.blur = value;
        this.padding = Math.max(Math.abs(this.blurXFilter.strength), Math.abs(this.blurYFilter.strength)) * 2;
    }

    /**
     * Sets the strength of the blurY property
     *
     * @member {number}
     * @default 2
     */
    public get blurY()
    {
        return this.blurYFilter.blur;
    }

    public set blurY(value) // eslint-disable-line require-jsdoc
    {
        this.blurYFilter.blur = value;
        this.padding = Math.max(Math.abs(this.blurXFilter.strength), Math.abs(this.blurYFilter.strength)) * 2;
    }

    /**
     * Sets the blendmode of the filter
     *
     * @member {number}
     * @default PIXI.BLEND_MODES.NORMAL
     */
    public get blendMode()
    {
        return this.blurYFilter._blendMode;
    }

    public set blendMode(value) // eslint-disable-line require-jsdoc
    {
        this.blurYFilter._blendMode = value;
    }
}