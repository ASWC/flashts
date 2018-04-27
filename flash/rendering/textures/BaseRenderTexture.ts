import { BaseTexture } from "./BaseTexture";
import { StageSettings } from "flash/display/StageSettings";

export class BaseRenderTexture extends BaseTexture
{
    constructor(width:number = 100, height:number = 100, scaleMode:number = StageSettings.SCALE_MODE, resolution:number = StageSettings.RESOLUTION)
    {
        super(null, scaleMode);
        this.resolution = resolution || StageSettings.RESOLUTION;
        this.width = Math.ceil(width);
        this.height = Math.ceil(height);
        this.realWidth = this.width * this.resolution;
        this.realHeight = this.height * this.resolution;
        this.scaleMode = scaleMode !== undefined ? scaleMode : StageSettings.SCALE_MODE;
        this.hasLoaded = true;
        this._glRenderTargets = {};
        this._canvasRenderTarget = null;
        this.valid = false;
    }

    public destroy(options:any = null):void
    {
        super.destroy(true);
        this.renderer = null;
    }
}