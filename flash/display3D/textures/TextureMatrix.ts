import { Matrix } from "flash/geom/Matrix";
import { Texture } from "flash/display3D/textures/Texture";
import { TextureUvs } from "flash/display3D/textures/TextureUvs";
import { Rectangle } from "flash/geom/Rectangle";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";

class TextureMatrix
{
    protected static tempMat:Matrix = new Matrix();
    protected  _texture:Texture;
    protected mapCoord:Matrix;
    protected uClampFrame:Float32Array;
    protected uClampOffset:Float32Array;
    protected _lastTextureID:number;
    protected clampOffset:number;
    protected clampMargin:number;
    
    constructor(texture:Texture, clampMargin:number = undefined)
    {
        this._texture = texture;
        this.mapCoord = new Matrix();
        this.uClampFrame = new Float32Array(4);
        this.uClampOffset = new Float32Array(2);
        this._lastTextureID = -1;
        this.clampOffset = 0;
        this.clampMargin = (typeof clampMargin === 'undefined') ? 0.5 : clampMargin;
    }

    public get texture():Texture
    {
        return this._texture;
    }

    public set texture(value:Texture) 
    {
        this._texture = value;
        this._lastTextureID = -1;
    }

    public multiplyUvs(uvs:Float32Array, out:Float32Array):Float32Array
    {
        if (out === undefined)
        {
            out = uvs;
        }
        const mat:Matrix = this.mapCoord;
        for (let i:number = 0; i < uvs.length; i += 2)
        {
            const x:number = uvs[i];
            const y:number = uvs[i + 1];
            out[i] = (x * mat.a) + (y * mat.c) + mat.tx;
            out[i + 1] = (x * mat.b) + (y * mat.d) + mat.ty;
        }
        return out;
    }

    public update(forceUpdate:boolean):boolean
    {
        const tex:Texture = this._texture;
        if (!tex || !tex.valid)
        {
            return false;
        }
        if (!forceUpdate && this._lastTextureID === tex.updateID)
        {
            return false;
        }
        this._lastTextureID = tex.updateID;
        const uvs:TextureUvs = tex.uvs;
        this.mapCoord.set(uvs.x1 - uvs.x0, uvs.y1 - uvs.y0, uvs.x3 - uvs.x0, uvs.y3 - uvs.y0, uvs.x0, uvs.y0);
        const orig:Rectangle = tex.orig;
        const trim:Rectangle = tex.trim;
        if (trim)
        {
            TextureMatrix.tempMat.set(orig.width / trim.width, 0, 0, orig.height / trim.height, -trim.x / trim.width, -trim.y / trim.height);
            this.mapCoord.append(TextureMatrix.tempMat);
        }
        const texBase:BaseTexture = tex.baseTexture;
        const frame:Float32Array = this.uClampFrame;
        const margin:number = this.clampMargin / texBase.resolution;
        const offset:number = this.clampOffset;
        frame[0] = (tex.frame.x + margin + offset) / texBase.width;
        frame[1] = (tex.frame.y + margin + offset) / texBase.height;
        frame[2] = (tex.frame.x + tex.frame.width - margin + offset) / texBase.width;
        frame[3] = (tex.frame.y + tex.frame.height - margin + offset) / texBase.height;
        this.uClampOffset[0] = offset / texBase.realWidth;
        this.uClampOffset[1] = offset / texBase.realHeight;
        return true;
    }
}
export { TextureMatrix };