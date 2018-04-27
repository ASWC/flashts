
import { StageSettings } from "flash/display/StageSettings";


export class CanvasRenderTarget
{
    public canvas:any;
    public context:any;
    public resolution:any;
    /**
     * @param {number} width - the width for the newly created canvas
     * @param {number} height - the height for the newly created canvas
     * @param {number} [resolution=1] - The resolution / device pixel ratio of the canvas
     */
    constructor(width, height, resolution = null)
    {
        /**
         * The Canvas object that belongs to this CanvasRenderTarget.
         *
         * @member {HTMLCanvasElement}
         */
        this.canvas = document.createElement('canvas');

        /**
         * A CanvasRenderingContext2D object representing a two-dimensional rendering context.
         *
         * @member {CanvasRenderingContext2D}
         */
        this.context = this.canvas.getContext('2d');

        this.resolution = resolution || StageSettings.RESOLUTION;

        this.resize(width, height);
    }

    /**
     * Clears the canvas that was created by the CanvasRenderTarget class.
     *
     * @private
     */
    public clear()
    {
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Resizes the canvas to the specified width and height.
     *
     * @param {number} width - the new width of the canvas
     * @param {number} height - the new height of the canvas
     */
    public resize(width, height)
    {
        this.canvas.width = width * this.resolution;
        this.canvas.height = height * this.resolution;
    }

    /**
     * Destroys this canvas.
     *
     */
    public destroy()
    {
        this.context = null;
        this.canvas = null;
    }

    /**
     * The width of the canvas buffer in pixels.
     *
     * @member {number}
     */
    public get width()
    {
        return this.canvas.width;
    }

    public set width(val) // eslint-disable-line require-jsdoc
    {
        this.canvas.width = val;
    }

    /**
     * The height of the canvas buffer in pixels.
     *
     * @member {number}
     */
    public get height()
    {
        return this.canvas.height;
    }

    public set height(val) // eslint-disable-line require-jsdoc
    {
        this.canvas.height = val;
    }
}