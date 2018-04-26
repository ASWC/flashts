
import { Rectangle } from "flash/geom/Rectangle";
import { BaseTexture } from "./BaseTexture";
import { TextureUvs } from "../webgl/TextureUvs";
import { Utils } from "../webgl/Utils";
import { VideoBaseTexture } from "./VideoBaseTexture";
import { TextureMatrix } from "../math/TextureMatrix";
import { EventDispatcher } from "flash/events/EventDispatcher";
import { Event } from "flash/events/Event";
import { StageSettings } from "flash/rendering/core/StageSettings";

export class Texture extends EventDispatcher
{
    public static _EMPTY:Texture;
    public static _WHITE:Texture;    
    public noFrame:boolean;
    public baseTexture:BaseTexture;
    public trim:Rectangle;
    public _uvs:TextureUvs;
    public requiresUpdate:boolean;
    public orig:Rectangle;
    public _updateID:number;
    public _rotate:number;
    public _frame:Rectangle;
    public valid:boolean;
    public textureCacheIds:string[];
    public transform:TextureMatrix;

    constructor(baseTexture:BaseTexture = null, frame:Rectangle = null, orig:Rectangle = null, trim:Rectangle = null, rotate:boolean = false)
    {
        super();
        this.noFrame = false;
        if (!frame)
        {
            this.noFrame = true;
            frame = new Rectangle(0, 0, 1, 1);
        }
        if (baseTexture instanceof Texture)
        {
            baseTexture = baseTexture.baseTexture;
        }
        this.baseTexture = baseTexture;
        this._frame = frame;
        this.trim = trim;
        this.valid = false;
        this.requiresUpdate = false;
        this._uvs = null;
        this.orig = orig || frame;
        this._rotate = 0;
        if (rotate === true)
        {
            this._rotate = 2;
        }
        else if (this._rotate % 2 !== 0)
        {
            throw new Error('attempt to use diamond-shaped UVs. If you are sure, set rotation manually');
        }
        if (baseTexture.hasLoaded)
        {
            if (this.noFrame)
            {
                frame = new Rectangle(0, 0, baseTexture.width, baseTexture.height);
                baseTexture.addEventListener(Event.CHANGE, this.onBaseTextureUpdated, this);
            }
            this.frame = frame;
        }
        else
        {
            baseTexture.addEventListener(Event.COMPLETE, this.onBaseTextureLoaded, this);
        }
        this._updateID = 0;
        this.transform = null;
        this.textureCacheIds = [];
    }

    public static get WHITE():Texture
    {
        if(!Texture._WHITE)
        {
            Texture._WHITE = Texture.createWhiteTexture();
        }
        return Texture._WHITE;
    }

    public static get EMPTY():Texture
    {
        if(!Texture._EMPTY)
        {
            Texture._EMPTY = new Texture(new BaseTexture());
        }
        return Texture._EMPTY;
    }

    /*public static init():void
    {
        Texture.EMPTY = new Texture(new BaseTexture());
        Texture.WHITE = Texture.createWhiteTexture();
        Texture.removeAllHandlers(Texture.EMPTY);
        Texture.removeAllHandlers(Texture.EMPTY.baseTexture);
        Texture.removeAllHandlers(Texture.WHITE);
        Texture.removeAllHandlers(Texture.WHITE.baseTexture);
    }*/

    public update():void
    {
        this.baseTexture.update();
    }

    public onBaseTextureLoaded(event:Event):void
    {
        this.baseTexture.removeEventListener(Event.COMPLETE, this.onBaseTextureLoaded);
        this.show("base texture loaded")
        this._updateID++;
        if (this.noFrame)
        {
            this.frame = new Rectangle(0, 0, this.baseTexture.width, this.baseTexture.height);
        }
        else
        {
            this.frame = this._frame;
        }
        this.baseTexture.addEventListener(Event.CHANGE, this.onBaseTextureUpdated, this);
        this.dispatchEvent(new Event(Event.CHANGE));
    }

    public onBaseTextureUpdated(event:Event):void
    {
        this.baseTexture.removeEventListener(Event.CHANGE, this.onBaseTextureUpdated);
        this._updateID++;
        this._frame.width = this.baseTexture.width;
        this._frame.height = this.baseTexture.height;
        this.dispatchEvent(new Event(Event.CHANGE));
    }

    public destroy(destroyBase:boolean):void
    {
        if (this.baseTexture)
        {
            if (destroyBase)
            {
                if (BaseTexture.TextureCache[this.baseTexture.imageUrl])
                {
                    Texture.removeFromCache(this.baseTexture.imageUrl);
                }
                this.baseTexture.destroy();
            }
            this.baseTexture.removeEventListener(Event.COMPLETE, this.onBaseTextureLoaded);
            this.baseTexture.removeEventListener(Event.CHANGE, this.onBaseTextureUpdated);
            this.baseTexture = null;
        }
        this._frame = null;
        this._uvs = null;
        this.trim = null;
        this.orig = null;
        this.valid = false;
        Texture.removeFromCache(this);
        this.textureCacheIds = null;
    }

    public clone():Texture
    {
        var rotating:boolean = false;
        if(this.rotate != 0)
        {
            rotating = true;
        }
        return new Texture(this.baseTexture, this.frame, this.orig, this.trim, rotating);
    }

    public _updateUvs():void
    {
        if (!this._uvs)
        {
            this._uvs = new TextureUvs();
        }
        this._uvs.set(this._frame, this.baseTexture.frame, this.rotate);
        this._updateID++;
    }

    public static fromImage(imageUrl:string, crossorigin:boolean = false, scaleMode:number = StageSettings.SCALE_MODE, sourceScale:number = StageSettings.SCALE_MODE):Texture
    {
        let texture = BaseTexture.TextureCache[imageUrl];
        if (!texture)
        {
            texture = new Texture(BaseTexture.fromImage(imageUrl, crossorigin, scaleMode, sourceScale));
            Texture.addToCache(texture, imageUrl);
        }
        return texture;
    }

    public static fromFrame(frameId:string):Texture
    {
        const texture = BaseTexture.TextureCache[frameId];
        if (!texture)
        {
            throw new Error(`The frameId "${frameId}" does not exist in the texture cache`);
        }
        return texture;
    }
  
    public static fromCanvas(canvas:HTMLCanvasElement, scaleMode:number, origin:string = 'canvas'):Texture
    {
        return new Texture(BaseTexture.fromCanvas(canvas, scaleMode, origin));
    }
 
    public static fromVideo(video:HTMLVideoElement|string, scaleMode:number = null):Texture
    {
        if (typeof video === 'string')
        {
            return Texture.fromVideoUrl(video, scaleMode);
        }
        return new Texture(VideoBaseTexture.fromVideo(video, scaleMode));
    }

    public static fromVideoUrl(videoUrl:string, scaleMode:number = null):Texture
    {
        return new Texture(VideoBaseTexture.fromUrl(videoUrl, scaleMode));
    }

    static from(source:number|string|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement|BaseTexture):Texture
    {
        if (typeof source === 'string')
        {
            const texture = BaseTexture.TextureCache[source];
            if (!texture)
            {
                const isVideo = source.match(/\.(mp4|webm|ogg|h264|avi|mov)$/) !== null;
                if (isVideo)
                {
                    return Texture.fromVideoUrl(source);
                }
                return Texture.fromImage(source);
            }
            return texture;
        }
        else if (source instanceof HTMLImageElement)
        {
            return new Texture(BaseTexture.from(source));
        }
        else if (source instanceof HTMLCanvasElement)
        {
            return Texture.fromCanvas(source, StageSettings.SCALE_MODE, 'HTMLCanvasElement');
        }
        else if (source instanceof HTMLVideoElement)
        {
            return Texture.fromVideo(source);
        }
        else if (source instanceof BaseTexture)
        {
            return new Texture(source);
        }
        return null;
    }

    public static fromLoader(source:HTMLImageElement|HTMLCanvasElement, imageUrl:string, name:string):Texture
    {
        const baseTexture = new BaseTexture(source, undefined, Utils.getResolutionOfUrl(imageUrl));
        const texture = new Texture(baseTexture);
        baseTexture.imageUrl = imageUrl;
        if (!name)
        {
            name = imageUrl;
        }
        BaseTexture.addToCache(texture.baseTexture, name);
        Texture.addToCache(texture, name);
        if (name !== imageUrl)
        {
            BaseTexture.addToCache(texture.baseTexture, imageUrl);
            Texture.addToCache(texture, imageUrl);
        }
        return texture;
    }

    public static addToCache(texture:Texture, id:string):void
    {
        if (id)
        {
            if (texture.textureCacheIds.indexOf(id) === -1)
            {
                texture.textureCacheIds.push(id);
            }
            if (BaseTexture.TextureCache[id])
            {
                console.warn(`Texture added to the cache with an id [${id}] that already had an entry`);
            }
            BaseTexture.TextureCache[id] = texture;
        }
    }

    public static removeFromCache(texture:string|Texture):Texture
    {
        if (typeof texture === 'string')
        {
            const textureFromCache = BaseTexture.TextureCache[texture];
            if (textureFromCache)
            {
                const index = textureFromCache.textureCacheIds.indexOf(texture);
                if (index > -1)
                {
                    textureFromCache.textureCacheIds.splice(index, 1);
                }
                delete BaseTexture.TextureCache[texture];
                return textureFromCache;
            }
        }
        else if (texture && texture.textureCacheIds)
        {
            for (let i = 0; i < texture.textureCacheIds.length; ++i)
            {
                if (BaseTexture.TextureCache[texture.textureCacheIds[i]] === texture)
                {
                    delete BaseTexture.TextureCache[texture.textureCacheIds[i]];
                }
            }
            texture.textureCacheIds.length = 0;
            return texture;
        }
        return null;
    }

    public get frame():Rectangle
    {
        return this._frame;
    }

    public set frame(frame:Rectangle) 
    {
        this._frame = frame;
        this.noFrame = false;
        const { x, y, width, height } = frame;
        const xNotFit = x + width > this.baseTexture.width;
        const yNotFit = y + height > this.baseTexture.height;
        if (xNotFit || yNotFit)
        {
            const relationship = xNotFit && yNotFit ? 'and' : 'or';
            const errorX = `X: ${x} + ${width} = ${x + width} > ${this.baseTexture.width}`;
            const errorY = `Y: ${y} + ${height} = ${y + height} > ${this.baseTexture.height}`;
            throw new Error('Texture Error: frame does not fit inside the base Texture dimensions: '
                + `${errorX} ${relationship} ${errorY}`);
        }
        this.valid = width && height && this.baseTexture.hasLoaded;
        if (!this.trim && !this.rotate)
        {
            this.orig = frame;
        }
        if (this.valid)
        {
            this._updateUvs();
        }
    }

    public get rotate():number
    {
        return this._rotate;
    }

    public set rotate(rotate:number) 
    {
        this._rotate = rotate;
        if (this.valid)
        {
            this._updateUvs();
        }
    }

    public get width():number
    {
        return this.orig.width;
    }

    public get height():number
    {
        return this.orig.height;
    }

    public static createWhiteTexture(width:number = 100, height:number = 100):Texture
    {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);
        return new Texture(new BaseTexture(canvas));
    }

    public static createRedTexture(width:number = 10, height:number = 10):Texture
    {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext('2d');
        context.fillStyle = 'red';
        context.fillRect(0, 0, width, height);
        return new Texture(new BaseTexture(canvas));
    }

    public static removeAllHandlers(tex:Texture|BaseTexture):void
    {
        tex.destroy = function _emptyDestroy() { /* empty */ };
        //tex.on = function _emptyOn() { /* empty */ };
        //tex.once = function _emptyOnce() { /* empty */ };
        //tex.emit = null;
    }
}