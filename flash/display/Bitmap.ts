
import { Point } from "flash/geom/Point";
import { Constants } from "flash/rendering/managers/Constants";
import { Texture } from "flash/rendering/textures/Texture";
import { Rectangle } from "flash/geom/Rectangle";
import { BaseTexture } from "flash/rendering/textures/BaseTexture";
import { Utils } from "flash/rendering/webgl/Utils";
import { SpriteRenderer } from "flash/rendering/core/renderers/SpriteRenderer";
import { GLShader } from "flash/rendering/core/gl/GLShader";
import { Event } from "flash/events/Event";
import { DisplayObject } from "flash/display/DisplayObject";
import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { Matrix } from "flash/geom/Matrix";
import { StageSettings } from "flash/rendering/core/StageSettings";

export class Bitmap extends DisplayObject
{
    public static tempPoint:Point = new Point();
    public _anchor:Point;
    protected _texture:Texture;
    public blendMode:number;
    public shader:GLShader;
    public cachedTint:number;
    public vertexData:Float32Array;
    public _tintRGB:number;
    public _tint:number;
    public vertexTrimmedData:Float32Array;
    public _transformID:number;
    public _textureID:number;
    public _transformTrimmedID:number;
    public _textureTrimmedID:number;
    public pluginName:string;    

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
        this.blendMode = Constants.BLEND_MODES.NORMAL;
        this.shader = null;
        this.cachedTint = 0xFFFFFF;
        this.texture = texture || Texture.EMPTY;
        this.vertexData = new Float32Array(8);
        this.vertexTrimmedData = null;
        this._transformID = -1;
        this._textureID = -1;
        this._transformTrimmedID = -1;
        this._textureTrimmedID = -1;
        this.pluginName = 'sprite';
    }

    public _onTextureUpdate()
    {
        this.show("texture update")
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

    public _onAnchorUpdate()
    {
        this._transformID = -1;
        this._transformTrimmedID = -1;
    }

    public calculateVertices()
    {
        if (this._transformID === this.transform._worldID && this._textureID === this._texture._updateID)
        {
            return;
        }
        this._transformID = this.transform._worldID;
        this._textureID = this._texture._updateID;
        const texture = this._texture;
        const wt:Matrix = this.transform.worldTransform;
        const a:number = wt.a;
        const b:number = wt.b;
        const c:number = wt.c;
        const d:number = wt.d;
        const tx:number = wt.tx;
        const ty:number = wt.ty;
        const vertexData:Float32Array = this.vertexData;
        const trim:Rectangle = texture.trim;
        const orig:Rectangle = texture.orig;
        const anchor:Point = this._anchor;
        let w0 = 0;
        let w1 = 0;
        let h0 = 0;
        let h1 = 0;
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

        //this.show("a " + a)
        //this.show("w1 " + w1)
        //this.show("c " + c)
        //this.show("h1 " + h1)
        //this.show("tx " + tx)


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

    public calculateTrimmedVertices()
    {
        if (!this.vertexTrimmedData)
        {
            this.vertexTrimmedData = new Float32Array(8);
        }
        else if (this._transformTrimmedID === this.transform._worldID && this._textureTrimmedID === this._texture._updateID)
        {
            return;
        }
        this._transformTrimmedID = this.transform._worldID;
        this._textureTrimmedID = this._texture._updateID;
        const texture = this._texture;
        const vertexData = this.vertexTrimmedData;
        const orig = texture.orig;
        const anchor = this._anchor;
        const wt = this.transform.worldTransform;
        const a = wt.a;
        const b = wt.b;
        const c = wt.c;
        const d = wt.d;
        const tx = wt.tx;
        const ty = wt.ty;
        const w1 = -anchor.x * orig.width;
        const w0 = w1 + orig.width;
        const h1 = -anchor.y * orig.height;
        const h0 = h1 + orig.height;
        vertexData[0] = (a * w1) + (c * h1) + tx;
        vertexData[1] = (d * h1) + (b * w1) + ty;
        vertexData[2] = (a * w0) + (c * h1) + tx;
        vertexData[3] = (d * h1) + (b * w0) + ty;
        vertexData[4] = (a * w0) + (c * h0) + tx;
        vertexData[5] = (d * h0) + (b * w0) + ty;
        vertexData[6] = (a * w1) + (c * h0) + tx;
        vertexData[7] = (d * h0) + (b * w1) + ty;
    }

    public renderWebGL():void
    {
        this._renderWebGL();
    }

    public _renderWebGL()
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

    public _calculateBounds()
    {
        const trim = this._texture.trim;
        const orig = this._texture.orig;
        if (!trim || (trim.width === orig.width && trim.height === orig.height))
        {
            this.calculateVertices();
            this._bounds.addQuad(this.vertexData);
        }
        else
        {
            this.calculateTrimmedVertices();
            this._bounds.addQuad(this.vertexTrimmedData);
        }
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
        const width = this._texture.orig.width;
        const height = this._texture.orig.height;
        const x1 = -width * this.anchor.x;
        let y1 = 0;
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

    public destroy(options:any|boolean = null)
    {
        super.destroy(options);
        this._anchor = null;
        const destroyTexture = typeof options === 'boolean' ? options : options && options.texture;
        if (destroyTexture)
        {
            const destroyBaseTexture = typeof options === 'boolean' ? options : options && options.baseTexture;
            this._texture.destroy(!!destroyBaseTexture);
        }
        this._texture = null;
        this.shader = null;
    }

    public static from(source:number|string|BaseTexture|HTMLCanvasElement|HTMLVideoElement, width:number = 0, height:number = 0):Bitmap
    {
        return new Bitmap(Texture.from(source));
    }

    public static fromFrame(frameId:string, width:number = 0, height:number = 0):Bitmap
    {
        const texture = BaseTexture.TextureCache[frameId];
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
        const s = Utils.sign(this.scale.x) || 1;
        this.scale.x = s * value / this._texture.orig.width;
        this._width = value;
    }

    public get height():number
    {
        return Math.abs(this.scale.y) * this._texture.orig.height;
    }

    public set height(value:number)
    {
        const s = Utils.sign(this.scale.y) || 1;
        this.scale.y = s * value / this._texture.orig.height;
        this._height = value;
    }

    public get anchor():Point
    {
        return this._anchor;
    }

    public set anchor(value) // eslint-disable-line require-jsdoc
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