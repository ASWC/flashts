
import { Constants } from "flash/rendering/managers/Constants";
import { Stage } from "flash/display/Stage";
import { DisplayObject } from "flash/display/DisplayObject";
import { Sprite } from "flash/display/Sprite";
import { Bitmap } from "flash/display/Bitmap";
import { DisplayObjectContainer } from "../../display/DisplayObjectContainer";
import { StageSettings } from "flash/rendering/core/StageSettings";

class TextureGarbageCollector
{
    public _stage:Stage;
    public checkCount:number;
    public maxIdle:number;
    public count:number;
    public mode:number;
    public checkCountMax:number;

    constructor(renderer:Stage)
    {
        this._stage = renderer;
        this.count = 0;
        this.checkCount = 0;
        this.maxIdle = StageSettings.GC_MAX_IDLE;
        this.checkCountMax = StageSettings.GC_MAX_CHECK_COUNT;
        this.mode = StageSettings.GC_MODE;
    }

    public update():void
    {
        this.count++;
        if (this.mode === Constants.GC_MODES.MANUAL)
        {
            return;
        }
        this.checkCount++;
        if (this.checkCount > this.checkCountMax)
        {
            this.checkCount = 0;
            this.run();
        }
    }

    public run():void
    {
        const tm = this._stage.getTextureManager();
        if(!tm)
        {
            return;
        }
        const managedTextures =  tm._managedTextures;
        if(!managedTextures)
        {
            return;
        }
        let wasRemoved = false;
        for (let i = 0; i < managedTextures.length; i++)
        {
            const texture = managedTextures[i];
            if (!texture._glRenderTargets && this.count - texture.touched > this.maxIdle)
            {
                tm.destroyTexture(texture, true);
                managedTextures[i] = null;
                wasRemoved = true;
            }
        }
        if (wasRemoved)
        {
            let j = 0;
            for (let i = 0; i < managedTextures.length; i++)
            {
                if (managedTextures[i] !== null)
                {
                    managedTextures[j++] = managedTextures[i];
                }
            }
            managedTextures.length = j;
        }
    }

    public unload(displayObject:DisplayObject):void
    {
        const tm = this._stage.getTextureManager();
        if(displayObject instanceof Bitmap)
        {
            if (displayObject.texture && displayObject.texture['_glRenderTargets'])
            {
                tm.destroyTexture(displayObject.texture, true);
            }            
        }
        if(displayObject instanceof DisplayObjectContainer)
        {
            for (let i = displayObject.numChildren - 1; i >= 0; i--)
            {
                this.unload(displayObject.removeChildAt[i]);
            }
        }        
    }
}
export { TextureGarbageCollector };