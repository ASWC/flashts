
import { Point } from "flash/geom/Point";
import { Constants } from "flash/rendering/managers/Constants";
import { Texture } from "flash/display3D/textures/Texture";
import { Rectangle } from "flash/geom/Rectangle";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { Utils } from "flash/rendering/webgl/Utils";
import { SpriteRenderer } from "flash/display3D/renderers/SpriteRenderer";
import { GLShader } from "flash/display3D/GLShader";
import { Event } from "flash/events/Event";
import { DisplayObject } from "flash/display/DisplayObject";
import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { Matrix } from "flash/geom/Matrix";
import { StageSettings } from "flash/display/StageSettings";

// TYPED

export class Bitmap extends DisplayObject
{
    protected static tempPoint:Point = new Point();
    protected _anchor:Point;
    protected _texture:Texture;
    protected _blendMode:number;
    protected shader:GLShader;
    protected cachedTint:number;
    protected _vertexData:Float32Array;
    protected _tintRGB:number;
    protected _tint:number;
    protected vertexTrimmedData:Float32Array;
    protected _transformID:number;
    protected _textureID:number;
    protected _transformTrimmedID:number;
    protected _textureTrimmedID:number; 

    constructor(texture:Texture = null)
    {
        super();
        this._anchor = new Point(0, 0);
        this._texture = texture;
        this._width = 0;
        this._height = 0;
        this._tint = 0;
        this._tintRGB = 0;
        this.tint = 0xFFFFFF;
        this._blendMode = Constants.BLEND_MODES.NORMAL;
        this.shader = null;
        this.cachedTint = 0xFFFFFF;
        this.texture = texture || Texture.EMPTY;
        this._vertexData = new Float32Array(8);
        this.vertexTrimmedData = null;
        this._transformID = -1;
        this._textureID = -1;
        this._transformTrimmedID = -1;
        this._textureTrimmedID = -1;
    }

    public getLocalBounds(rect:Rectangle):Rectangle
    {
        this._bounds.minX = this._texture.orig.width * -this._anchor.x;
        this._bounds.minY = this._texture.orig.height * -this._anchor.y;
        this._bounds.maxX = this._texture.orig.width * (1 - this._anchor.x);
        this._bounds.maxY = this._texture.orig.height * (1 - this._anchor.y);
        if (!rect)
        {
            if (!this._localBoundsRect)
            {
                this._localBoundsRect = new Rectangle();
            }
            rect = this._localBoundsRect;
        }
        return this._bounds.getRectangle(rect);
    }

    public containsPoint(point:Point):boolean
    {
        this.worldTransform.applyInverse(point, Bitmap.tempPoint);
        const width:number = this._texture.orig.width;
        const height:number = this._texture.orig.height;
        const x1:number = -width * this.anchor.x;
        let y1:number = 0;
        if (Bitmap.tempPoint.x >= x1 && Bitmap.tempPoint.x < x1 + width)
        {
            y1 = -height * this.anchor.y;
            if (Bitmap.tempPoint.y >= y1 && Bitmap.tempPoint.y < y1 + height)
            {
                return true;
            }
        }
        return false;
    }

    public _calculateBounds():void
    {
        const trim:Rectangle = this._texture.trim;
        const orig:Rectangle = this._texture.orig;
        if (!trim || (trim.width === orig.width && trim.height === orig.height))
        {
            this.calculateVertices();
            this._bounds.addQuad(this._vertexData);
        }
        else
        {
            this.calculateTrimmedVertices();
            this._bounds.addQuad(this.vertexTrimmedData);
        }
    }

    public destroy():void
    {
        super.destroy();
        this._anchor = null;
        this._texture.destroy();
        this._texture = null;
        this.shader = null;
    }

    public renderWebGL():void
    {
        this._renderWebGL();
    }

    protected _onTextureUpdate():void
    {
        this._textureID = -1;
        this._textureTrimmedID = -1;
        this.cachedTint = 0xFFFFFF;
        if (this._width)
        {
            this.scale.x = Utils.sign(this.scale.x) * this._width / this._texture.orig.width;
        }
        if (this._height)
        {
            this.scale.y = Utils.sign(this.scale.y) * this._height / this._texture.orig.height;
        }
    }

    protected _onAnchorUpdate():void
    {
        this._transformID = -1;
        this._transformTrimmedID = -1;
    }

    protected calculateVertices():void
    {
        if (this._transformID === this.transform.worldID && this._textureID === this._texture.updateID)
        {
            return;
        }
        this._transformID = this.transform.worldID;
        this._textureID = this._texture.updateID;
        const texture:Texture = this._texture;
        const wt:Matrix = this.transform.worldTransform;
        const a:number = wt.a;
        const b:number = wt.b;
        const c:number = wt.c;
        const d:number = wt.d;
        const tx:number = wt.tx;
        const ty:number = wt.ty;
        const vertexData:Float32Array = this._vertexData;
        const trim:Rectangle = texture.trim;
        const orig:Rectangle = texture.orig;
        const anchor:Point = this._anchor;
        let w0:number = 0;
        let w1:number = 0;
        let h0:number = 0;
        let h1:number = 0;
        if (trim)
        {
            w1 = trim.x - (anchor.x * orig.width);
            w0 = w1 + trim.width;
            h1 = trim.y - (anchor.y * orig.height);
            h0 = h1 + trim.height;
        }
        else
        {
            w1 = -anchor.x * orig.width;
            w0 = w1 + orig.width;
            h1 = -anchor.y * orig.height;
            h0 = h1 + orig.height;
        }
        var value:number = (a * w1) + (c * h1) + tx;
        vertexData[0] = value;
        value = (d * h1) + (b * w1) + ty;
        vertexData[1] = value;
        value = (a * w0) + (c * h1) + tx;
        vertexData[2] = value;
        value = (d * h1) + (b * w0) + ty;
        vertexData[3] = value;
        value = (a * w0) + (c * h0) + tx;
        vertexData[4] = value;
        value = (d * h0) + (b * w0) + ty;
        vertexData[5] = value;
        value = (a * w1) + (c * h0) + tx;
        vertexData[6] = value;
        value = (d * h0) + (b * w1) + ty;
        vertexData[7] = value;
    }

    protected calculateTrimmedVertices():void
    {
        if (!this.vertexTrimmedData)
        {
            this.vertexTrimmedData = new Float32Array(8);
        }
        else if (this._transformTrimmedID === this.transform.worldID && this._textureTrimmedID === this._texture.updateID)
        {
            return;
        }
        this._transformTrimmedID = this.transform.worldID;
        this._textureTrimmedID = this._texture.updateID;
        const texture:Texture = this._texture;
        const vertexData:Float32Array = this.vertexTrimmedData;
        const orig:Rectangle = texture.orig;
        const anchor:Point = this._anchor;
        const wt:Matrix = this.transform.worldTransform;
        const a:number = wt.a;
        const b:number = wt.b;
        const c:number = wt.c;
        const d:number = wt.d;
        const tx:number = wt.tx;
        const ty:number = wt.ty;
        const w1:number = -anchor.x * orig.width;
        const w0:number = w1 + orig.width;
        const h1:number = -anchor.y * orig.height;
        const h0:number = h1 + orig.height;
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
    }

    protected _renderWebGL():void
    {
        if(!this.stage)
        {
            return;
        }        
        if(this.transform.requireUpdate)
        {
            this.updateTransform();
            this.transform.updateWorldTransform(this._parent.transform);            
        }
        this.transform.update();
        this.calculateVertices();
        this.stage.setObjectRenderer(SpriteRenderer.renderer);
        SpriteRenderer.renderer.render(this);
    }

    public static from(source:number|string|BaseTexture|HTMLCanvasElement|HTMLVideoElement, width:number = 0, height:number = 0):Bitmap
    {
        return new Bitmap(Texture.from(source));
    }

    public static fromFrame(frameId:string, width:number = 0, height:number = 0):Bitmap
    {
        const texture:Texture = BaseTexture.TextureCache[frameId];
        if (!texture)
        {
            throw new Error(`The frameId "${frameId}" does not exist in the texture cache`);
        }
        return new Bitmap(texture);
    }

    public static fromImage(imageId:string, crossorigin:boolean, scaleMode:number = StageSettings.SCALE_MODE, width:number = 0, height:number = 0):Bitmap
    {
        return new Bitmap(Texture.fromImage(imageId, crossorigin, scaleMode));
    }

    public get width():number
    {
        return Math.abs(this.scale.x) * this._texture.orig.width;
    }

    public set width(value:number)
    {
        const s:number = Utils.sign(this.scale.x) || 1;
        this.scale.x = s * value / this._texture.orig.width;
        this._width = value;
    }

    public get height():number
    {
        return Math.abs(this.scale.y) * this._texture.orig.height;
    }

    public set height(value:number)
    {
        const s:number = Utils.sign(this.scale.y) || 1;
        this.scale.y = s * value / this._texture.orig.height;
        this._height = value;
    }

    public get anchor():Point
    {
        return this._anchor;
    }

    public set anchor(value:Point)
    {
        this._anchor.copy(value);
    }

    public get tint():number
    {
        return this._tint;
    }

    public set tint(value:number)
    {
        this._tint = value;
        this._tintRGB = (value >> 16) + (value & 0xff00) + ((value & 0xff) << 16);
    }

    public get vertexData():Float32Array
    {
        return this._vertexData;
    }
    
    public get blendMode():number
    {
        return this._blendMode;
    }

    public get tintRGB():number
    {
        return this._tintRGB;
    }

    public get texture():Texture
    {
        return this._texture;
    }

    public set texture(value:Texture)
    {
        if (this._texture === value)
        {
            return;
        }
        this._texture = value;
        this.cachedTint = 0xFFFFFF;
        this._textureID = -1;
        this._textureTrimmedID = -1;
        if (value)
        {
            if (value.baseTexture.hasLoaded)
            {
                this._onTextureUpdate();
            }
            else
            {
                value.addEventListener(Event.CHANGE, this._onTextureUpdate, this);
            }
        }
    }
}