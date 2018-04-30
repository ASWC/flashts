
import { Rectangle } from "flash/geom/Rectangle";
import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { TextureUvs } from "flash/display3D/textures/TextureUvs";
import { Utils } from "flash/rendering/webgl/Utils";
import { VideoBaseTexture } from "flash/display3D/textures/VideoBaseTexture";
import { TextureMatrix } from "flash/display3D/textures/TextureMatrix";
import { EventDispatcher } from "flash/events/EventDispatcher";
import { Event } from "flash/events/Event";
import { StageSettings } from "flash/display/StageSettings";

export class Texture extends EventDispatcher
{
    protected static _EMPTY:Texture;
    protected static _WHITE:Texture;    
    protected noFrame:boolean;
    protected _baseTexture:BaseTexture;
    protected _trim:Rectangle;
    protected _uvs:TextureUvs;
    protected requiresUpdate:boolean;
    protected _orig:Rectangle;
    protected _updateID:number;
    protected _rotate:number;
    protected _frame:Rectangle;
    protected _valid:boolean;
    protected textureCacheIds:string[];
    protected transform:TextureMatrix;

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
        this._baseTexture = baseTexture;
        this._frame = frame;
        this._trim = trim;
        this._valid = false;
        this.requiresUpdate = false;
        this._uvs = null;
        this._orig = orig || frame;
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

    public set valid(value:boolean)
    {
        this._valid = value;
    }

    public get valid():boolean
    {
        return this._valid;
    }

    public get frame():Rectangle
    {
        return this._frame;
    }

    public get updateID():number
    {
        return this._updateID;
    }

    public get orig():Rectangle
    {
        return this._orig;
    }

    public set orig(value:Rectangle)
    {
        this._orig = value;
    }

    public get uvs():TextureUvs
    {
        return this._uvs;
    }

    public set trim(value:Rectangle)
    {
        this._trim = value;
    }

    public get trim():Rectangle
    {
        return this._trim;
    }

    public get baseTexture():BaseTexture
    {
        return this._baseTexture;
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

    protected update():void
    {
        this._baseTexture.update();
    }

    protected onBaseTextureLoaded(event:Event):void
    {
        this._baseTexture.removeEventListener(Event.COMPLETE, this.onBaseTextureLoaded);        
        this._updateID++;
        if (this.noFrame)
        {
            this.frame = new Rectangle(0, 0, this._baseTexture.width, this._baseTexture.height);
        }
        else
        {
            this.frame = this._frame;
        }
        this._baseTexture.addEventListener(Event.CHANGE, this.onBaseTextureUpdated, this);
        this.dispatchEvent(new Event(Event.CHANGE));
    }

    protected onBaseTextureUpdated(event:Event):void
    {
        this._baseTexture.removeEventListener(Event.CHANGE, this.onBaseTextureUpdated);
        this._updateID++;
        this._frame.width = this._baseTexture.width;
        this._frame.height = this._baseTexture.height;
        this.dispatchEvent(new Event(Event.CHANGE));
    }

    public destroy():void
    {
        if (this._baseTexture)
        {
            if (BaseTexture.TextureCache[this._baseTexture.imageUrl])
            {
                Texture.removeFromCache(this._baseTexture.imageUrl);
            }
            this._baseTexture.destroy();           
            this._baseTexture.removeEventListener(Event.COMPLETE, this.onBaseTextureLoaded);
            this._baseTexture.removeEventListener(Event.CHANGE, this.onBaseTextureUpdated);
            this._baseTexture = null;
        }
        this._frame = null;
        this._uvs = null;
        this._trim = null;
        this._orig = null;
        this._valid = false;
        Texture.removeFromCache(this);
        this.textureCacheIds = null;
    }

    protected clone():Texture
    {
        var rotating:boolean = false;
        if(this.rotate != 0)
        {
            rotating = true;
        }
        return new Texture(this._baseTexture, this.frame, this._orig, this._trim, rotating);
    }

    protected _updateUvs():void
    {
        if (!this._uvs)
        {
            this._uvs = new TextureUvs();
        }
        this._uvs.set(this._frame, this._baseTexture.frame, this.rotate);
        this._updateID++;
    }

    public static fromImage(imageUrl:string, crossorigin:boolean = false, scaleMode:number = StageSettings.SCALE_MODE, sourceScale:number = StageSettings.SCALE_MODE):Texture
    {
        let texture:Texture = BaseTexture.TextureCache[imageUrl];
        if (!texture)
        {
            texture = new Texture(BaseTexture.fromImage(imageUrl, crossorigin, scaleMode, sourceScale));
            Texture.addToCache(texture, imageUrl);
        }
        return texture;
    }

    public static fromFrame(frameId:string):Texture
    {
        const texture:Texture = BaseTexture.TextureCache[frameId];
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
            const texture:Texture = BaseTexture.TextureCache[source];
            if (!texture)
            {
                const isVideo:boolean = source.match(/\.(mp4|webm|ogg|h264|avi|mov)$/) !== null;
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
        const baseTexture:BaseTexture = new BaseTexture(source, undefined, Utils.getResolutionOfUrl(imageUrl));
        const texture:Texture = new Texture(baseTexture);
        baseTexture.imageUrl = imageUrl;
        if (!name)
        {
            name = imageUrl;
        }
        BaseTexture.addToCache(texture._baseTexture, name);
        Texture.addToCache(texture, name);
        if (name !== imageUrl)
        {
            BaseTexture.addToCache(texture._baseTexture, imageUrl);
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
            const textureFromCache:Texture = BaseTexture.TextureCache[texture];
            if (textureFromCache)
            {
                const index:number = textureFromCache.textureCacheIds.indexOf(texture);
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
            for (let i:number = 0; i < texture.textureCacheIds.length; ++i)
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

    public set frame(frame:Rectangle)
    {
        this._frame = frame;
        this.noFrame = false;
        const xNotFit:boolean = this._frame.x + this._frame.width > this._baseTexture.width;
        const yNotFit:boolean = this._frame.y + this._frame.height > this._baseTexture.height;
        if (xNotFit || yNotFit)
        {
            const relationship:string = xNotFit && yNotFit ? 'and' : 'or';
            const errorX:string = `X: ${this._frame.x} + ${this._frame.width} = ${this._frame.x + this._frame.width} > ${this._baseTexture.width}`;
            const errorY:string = `Y: ${this._frame.y} + ${this._frame.height} = ${this._frame.y + this._frame.height} > ${this._baseTexture.height}`;
            throw new Error('Texture Error: frame does not fit inside the base Texture dimensions: ' + `${errorX} ${relationship} ${errorY}`);
        }
        this._valid = this._frame.width && this._frame.height && this._baseTexture.hasLoaded;
        if (!this._trim && !this.rotate)
        {
            this._orig = frame;
        }
        if (this._valid)
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
        if (this._valid)
        {
            this._updateUvs();
        }
    }

    public get width():number
    {
        return this._orig.width;
    }

    public get height():number
    {
        return this._orig.height;
    }

    public static createWhiteTexture(width:number = 100, height:number = 100):Texture
    {
        const canvas:HTMLCanvasElement = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context:CanvasRenderingContext2D = canvas.getContext('2d');
        context.fillStyle = 'white';
        context.fillRect(0, 0, width, height);
        return new Texture(new BaseTexture(canvas));
    }

    public static createRedTexture(width:number = 10, height:number = 10):Texture
    {
        const canvas:HTMLCanvasElement = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const context:CanvasRenderingContext2D = canvas.getContext('2d');
        context.fillStyle = 'red';
        context.fillRect(0, 0, width, height);
        return new Texture(new BaseTexture(canvas));
    }
}