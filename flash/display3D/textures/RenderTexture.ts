import { Texture } from "flash/display3D/textures/Texture";
import { BaseRenderTexture } from "flash/display3D/textures/BaseRenderTexture";
import { Rectangle } from "flash/geom/Rectangle";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { StageSettings } from "flash/display/StageSettings";

class RenderTexture extends Texture
{
    protected legacyRenderer:BaseTexture;

    constructor(baseRenderTexture:BaseRenderTexture, frame:Rectangle = null)
    {
        super(baseRenderTexture, frame);
        let _legacyRenderer:BaseTexture = null;
        if (!(baseRenderTexture instanceof BaseRenderTexture))
        {
            const width:number = arguments[1];
            const height:number = arguments[2];
            const scaleMode:number = arguments[3];
            const resolution:number = arguments[4];
            console.warn(`Please use RenderTexture.create(${width}, ${height}) instead of the ctor directly.`);
            _legacyRenderer = arguments[0];
            frame = null;
            baseRenderTexture = new BaseRenderTexture(width, height, scaleMode, resolution);
        }
        this.legacyRenderer = _legacyRenderer;
        this.valid = true;
        this._updateUvs();
    }

    public resize(width:number, height:number, doNotResizeBaseTexture:boolean):void
    {
        width = Math.ceil(width);
        height = Math.ceil(height);
        this.valid = (width > 0 && height > 0);
        this._frame.width = this.orig.width = width;
        this._frame.height = this.orig.height = height;
        if (!doNotResizeBaseTexture)
        {
            this.baseTexture.resize(width, height);
        }
        this._updateUvs();
    }

    public static create(width:number, height:number, scaleMode:number = StageSettings.SCALE_MODE, resolution:number = StageSettings.RESOLUTION):RenderTexture
    {
        return new RenderTexture(new BaseRenderTexture(width, height, scaleMode, resolution));
    }
}
export { RenderTexture };