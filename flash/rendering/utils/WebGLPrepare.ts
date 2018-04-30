import { BasePrepare } from "./BasePrepare";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { Graphics } from "flash/display/Graphics";



export class WebGLPrepare extends BasePrepare
{
    // WebGLRenderer.registerPlugin('prepare', WebGLPrepare);
    /**
     * @param {PIXI.WebGLRenderer} renderer - A reference to the current renderer
     */
    constructor(renderer)
    {
        super(renderer);

        this.uploadHookHelper = this.renderer;

        // Add textures and graphics to upload
        this.registerFindHook(WebGLPrepare.findGraphics);
        this.registerUploadHook(WebGLPrepare.uploadBaseTextures);
        this.registerUploadHook(WebGLPrepare.uploadGraphics);
    }

    /**
     * Built-in hook to find graphics.
     *
     * @private
     * @param {PIXI.DisplayObject} item - Display object to check
     * @param {Array<*>} queue - Collection of items to upload
     * @return {boolean} if a PIXI.Graphics object was found.
     */
    public static findGraphics(item, queue)
    {
        if (item instanceof Graphics)
        {
            queue.push(item);

            return true;
        }

        return false;
    }

    /**
     * Built-in hook to upload PIXI.Graphics to the GPU.
     *
     * @private
     * @param {PIXI.WebGLRenderer} renderer - instance of the webgl renderer
     * @param {PIXI.DisplayObject} item - Item to check
     * @return {boolean} If item was uploaded.
     */
    public static uploadGraphics(renderer, item)
    {
        if (item instanceof Graphics)
        {
            // if the item is not dirty and already has webgl data, then it got prepared or rendered
            // before now and we shouldn't waste time updating it again
            /*if (item.dirty || item.clearDirty || !item._webGL[renderer.plugins.graphics.CONTEXT_UID])
            {
                renderer.plugins.graphics.updateGraphics(item);
            }*/

            return true;
        }

        return false;
    }

    /**
     * Built-in hook to upload PIXI.Texture objects to the GPU.
     *
     * @private
     * @param {PIXI.WebGLRenderer} renderer - instance of the webgl renderer
     * @param {PIXI.DisplayObject} item - Item to check
     * @return {boolean} If item was uploaded.
     */
    public static uploadBaseTextures(renderer, item)
    {
        if (item instanceof BaseTexture)
        {
            // if the texture already has a GL texture, then the texture has been prepared or rendered
            // before now. If the texture changed, then the changer should be calling texture.update() which
            // reuploads the texture without need for preparing it again
            if (!item.glTextures[renderer.CONTEXT_UID])
            {
                renderer.textureManager.updateTexture(item);
            }

            return true;
        }

        return false;
    }
}