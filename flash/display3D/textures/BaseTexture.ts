
import { Utils } from "flash/rendering/webgl/Utils";
import { BaseObject } from "flash/display/BaseObject";
import { GLTexture } from "flash/display3D/textures/GLTexture";
import { EventDispatcher } from "flash/events/EventDispatcher";
import { Event } from "flash/events/Event";
import { StageSettings } from "flash/display/StageSettings";
import { Rectangle } from "flash/geom/Rectangle";
import { TextureDictionary, BaseTextureDictionary, RenderTargetDictionary } from "flash/display3D/types/DataDictionaries";
import { DecomposedDataUri, SvgSize } from "flash/display3D/types/DataTypes";

class BaseTexture extends EventDispatcher
{
    protected static BaseTextureCache:BaseTextureDictionary = {};
    public static TextureCache:TextureDictionary = {};
    protected uid:number;
    protected valid:boolean;
    protected _touched:number;
    protected _resolution:number;
    protected _realHeight:number;
    protected _hasLoaded:boolean;
    protected _imageUrl:string;
    protected _realWidth:number;
    protected _scaleMode:number;
    protected imageType:string;
    protected _source:HTMLImageElement|HTMLCanvasElement;
    protected sourceScale:number;
    protected _wrapMode:number;
    protected _premultipliedAlpha:boolean;
    protected _enabled:number;
    protected _destroyed:boolean;
    protected _mipmap:boolean;
    protected _width:number;
    protected _height:number;
    protected _frame:Rectangle;
    protected origSource:HTMLImageElement|HTMLCanvasElement;
    protected _glRenderTargets:RenderTargetDictionary;    
    protected _isPowerOfTwo:boolean;
    protected _textureCacheIds:string[];  
    protected isLoading:boolean;
    protected _glTextures:GLTexture[];
    protected _virtalBoundId:number;

    constructor(source:HTMLImageElement|HTMLCanvasElement = null, scaleMode:number = StageSettings.SCALE_MODE, resolution:number = StageSettings.RESOLUTION)
    {
        super();
        this._frame = null;
        this.uid = Utils.uid();
        this._touched = 0;
        this._resolution = resolution;
        this._width = 100;
        this.height = 100;
        this._realWidth = 100;
        this._realHeight = 100;
        this._scaleMode = scaleMode;
        this._hasLoaded = false;
        this.isLoading = false;
        this._source = null;
        this.origSource = null; 
        this.imageType = null; 
        this.sourceScale = 1.0;
        this._premultipliedAlpha = true;
        this._imageUrl = null;
        this._isPowerOfTwo = false;
        this._mipmap = StageSettings.MIPMAP_TEXTURES;
        this._wrapMode = StageSettings.WRAP_MODE;
        this._glTextures = [];
        this._enabled = 0;
        this._virtalBoundId = -1;
        this._destroyed = false;
        this._textureCacheIds = [];
        if (source)
        {
            this.loadSource(source);
        }
    }
    
    public get realWidth():number
    {
        return this._realWidth;
    }

    public set realWidth(value:number)
    {
        this._realWidth = value;
    }

    public get realHeight():number
    {
        return this._realHeight;
    }

    public set realHeight(value:number)
    {
        this._realHeight = value;
    }
  
    public get textureCacheIds():string[]
    {
        return this._textureCacheIds;
    }

    public set textureCacheIds(value:string[])
    {
        this._textureCacheIds = value;
    }

    public get glTextures():GLTexture[]
    {
        return this._glTextures;
    }

    public set glTextures(value:GLTexture[])
    {
        this._glTextures = value;
    }

    public get isPowerOfTwo():boolean
    {
        return this._isPowerOfTwo;
    }

    public get glRenderTargets():RenderTargetDictionary
    {
        return this._glRenderTargets;
    }

    public set glRenderTargets(value:RenderTargetDictionary)
    {
        this._glRenderTargets = value;
    }
    
    public get virtalBoundId():number
    {
        return this._virtalBoundId;
    }

    public set virtalBoundId(value:number)
    {
        this._virtalBoundId = value;
    }

    public get enabled():number
    {
        return this._enabled;
    }

    public set enabled(value:number)
    {
        this._enabled = value;
    }

    public get width():number
    {
        return this._width;
    }

    public set width(value:number)
    {
        this._width = value;
    }
    
    public get source():HTMLImageElement|HTMLCanvasElement
    {
        return this._source;
    }

    public get height():number
    {
        return this._height;
    }

    public set height(value:number)
    {
        this._height = value;
    }

    public get wrapMode():number
    {
        return this._wrapMode;
    }
    
    public get scaleMode():number
    {
        return this._scaleMode;
    }

    public set scaleMode(value:number)
    {
        this._scaleMode = value;
    }

    public get imageUrl():string
    {
        return this._imageUrl;
    }

    public set imageUrl(value:string)
    {
        this._imageUrl = value;
    }

    public get premultipliedAlpha():boolean
    {
        return this._premultipliedAlpha;
    }

    public get mipmap():boolean
    {
        return this._mipmap;
    }
    
    public get hasLoaded():boolean
    {
        return this._hasLoaded;
    }

    public set hasLoaded(value:boolean)
    {
        this._hasLoaded = value;
    }

    public set touched(value:number)
    {
        this._touched = value;
    }
    
    public get touched():number
    {
        return this._touched;
    }

    public get frame():Rectangle
    {
        if(!this._frame)
        {
            this._frame = new Rectangle();
        }
        this._frame.width = this._width;
        this._frame.height = this._height;
        return this._frame;
    }

    public resize(width:number, height:number):void
    {
        width = Math.ceil(width);
        height = Math.ceil(height);
        if (width === this._width && height === this._height)
        {
            return;
        }
        this.valid = (width > 0 && height > 0);
        this._width = width;
        this._height = height;
        this._realWidth = this._width * this.resolution;
        this._realHeight = this._height * this.resolution;
        if (!this.valid)
        {
            return;
        }
        this.dispatchEvent(new Event(Event.CHANGE));
    }

    public update():void
    {        
        if (this.imageType !== 'svg')
        {
            this._realWidth = this._source['naturalWidth'] || this._source['videoWidth'] || this._source.width;
            this._realHeight = this._source['naturalHeight'] || this._source['videoHeight'] || this._source.height;           
            this._updateDimensions();
        }
        this.dispatchEvent(new Event(Event.CHANGE));
    }

    public get resolution():number
    {
        if(this._resolution == null || this._resolution == undefined || isNaN(this._resolution))
        {
            this._resolution = StageSettings.RESOLUTION
        }
        return this._resolution;
    }

    public set resolution(value:number)
    {
        this._resolution = value;
    }

    protected _updateDimensions():void
    {
        this._width = this._realWidth / this.resolution;
        this._height = this._realHeight / this.resolution;
        this._isPowerOfTwo = false;
        if(Utils.isPow2(this._realWidth) && Utils.isPow2(this._realHeight))
        {
            this._isPowerOfTwo = true;
        }  
    }

    protected loadSource(source:HTMLImageElement|HTMLCanvasElement):void
    {        
        const wasLoading:boolean = this.isLoading;
        this._hasLoaded = false;
        this.isLoading = false;
        if (wasLoading && this._source)
        {
            this._source.onload = null;
            this._source.onerror = null;
        }
        const firstSourceLoaded:boolean = !this._source;
        this._source = source;
        if (((source['src'] && source['complete']) || source['getContext']) && source.width && source.height)
        {
            this._updateImageType();
            if (this.imageType === 'svg')
            {
                this._loadSvgSource();
            }
            else
            {
                this._sourceLoaded();
            }
            if (firstSourceLoaded)
            {
                this.dispatchEvent(new Event(Event.COMPLETE));
            }
        }
        else if (!source['getContext'])
        {
            this.isLoading = true;
            const scope = this;
            source.onload = () =>
            {
                scope.show('loaded')
                scope._updateImageType();
                source.onload = null;
                source.onerror = null;
                if (!scope.isLoading)
                {
                    scope.show('already loading')
                    return;
                }
                scope.isLoading = false;
                scope._sourceLoaded();
                if (scope.imageType === 'svg')
                {
                    scope._loadSvgSource();
                    return;
                }
                this.dispatchEvent(new Event(Event.COMPLETE));
            };
            source.onerror = () =>
            {
                source.onload = null;
                source.onerror = null;
                if (!scope.isLoading)
                {
                    return;
                }
                scope.isLoading = false;
                this.dispatchEvent(new Event(Event.ERROR));
            };
            if (source['complete'] && source['src'])
            {
                source.onload = null;
                source.onerror = null;
                if (scope.imageType === 'svg')
                {
                    scope._loadSvgSource();
                    return;
                }
                this.isLoading = false;
                if (source.width && source.height)
                {
                    this._sourceLoaded();
                    if (wasLoading)
                    {
                        this.dispatchEvent(new Event(Event.COMPLETE));
                    }
                }
                else if (wasLoading)
                {
                    this.dispatchEvent(new Event(Event.ERROR));
                }
            }
        }
    }

    protected _updateImageType():void
    {
        if (!this._imageUrl)
        {
            return;
        }
        const dataUri:DecomposedDataUri = Utils.decomposeDataUri(this._imageUrl);
        let imageType:string;
        if (dataUri && dataUri.mediaType === 'image')
        {
            const firstSubType:string = dataUri.subType.split('+')[0];
            imageType = Utils.getUrlFileExtension(`.${firstSubType}`);
            if (!imageType)
            {
                throw new Error('Invalid image type in data URI.');
            }
        }
        else
        {
            imageType = Utils.getUrlFileExtension(this._imageUrl);
            if (!imageType)
            {
                imageType = 'png';
            }
        }
        this.imageType = imageType;
    }

    protected _loadSvgSource():void
    {
        if (this.imageType !== 'svg')
        {
            return;
        }
        const dataUri:DecomposedDataUri = Utils.decomposeDataUri(this._imageUrl);
        if (dataUri)
        {
            this._loadSvgSourceUsingDataUri(dataUri);
        }
        else
        {
            this._loadSvgSourceUsingXhr();
        }
    }

    protected _loadSvgSourceUsingDataUri(dataUri:DecomposedDataUri):void
    {
        let svgString:string;
        if (this.getProperty(dataUri, 'encoding') && this.getProperty(dataUri, 'encoding') === 'base64')
        {
            if (!atob)
            {
                throw new Error('Your browser doesn\'t support base64 conversions.');
            }
            svgString = atob(this.getProperty(dataUri, 'data'));
        }
        else
        {
            svgString = this.getProperty(dataUri, 'data');
        }
        this._loadSvgSourceUsingString(svgString);
    }

    protected _loadSvgSourceUsingXhr():void
    {
        const svgXhr:XMLHttpRequest = new XMLHttpRequest();
        svgXhr.onload = () =>
        {
            if (svgXhr.readyState !== svgXhr.DONE || svgXhr.status !== 200)
            {
                throw new Error('Failed to load SVG using XHR.');
            }
            this._loadSvgSourceUsingString(svgXhr.response);
        };
        svgXhr.onerror = () => {this.dispatchEvent(new Event(Event.ERROR));}
        svgXhr.open('GET', this._imageUrl, true);
        svgXhr.send();
    }

    protected _loadSvgSourceUsingString(svgString:string):void
    {
        const svgSize:SvgSize = Utils.getSvgSize(svgString);
        const svgWidth = svgSize.width;
        const svgHeight = svgSize.height;
        if (!svgWidth || !svgHeight)
        {
            throw new Error('The SVG image must have width and height defined (in pixels), canvas API needs them.');
        }
        this._realWidth = Math.round(svgWidth * this.sourceScale);
        this._realHeight = Math.round(svgHeight * this.sourceScale);
        this._updateDimensions();
        const canvas:HTMLCanvasElement = document.createElement('canvas');
        canvas.width = this._realWidth;
        canvas.height = this._realHeight;
        canvas['_pixiId'] = `canvas_${Utils.uid()}`;
        canvas.getContext('2d').drawImage(this._source, 0, 0, svgWidth, svgHeight, 0, 0, this._realWidth, this._realHeight);
        this.origSource = this._source;
        this._source = canvas;
        BaseTexture.addToCache(this, canvas['_pixiId']);
        this.isLoading = false;
        this._sourceLoaded();
        this.dispatchEvent(new Event(Event.COMPLETE));
    }

    protected _sourceLoaded():void
    {
        this._hasLoaded = true;
        this.update();
    }

    public destroy():void
    {
        if (this._imageUrl)
        {
            delete BaseTexture.BaseTextureCache[this._imageUrl];
            this._imageUrl = null;
            if (!navigator['isCocoonJS'])
            {
                var src:any = this.getProperty(this._source, 'src')
                src = '';
            }
        }
        this._source = null;
        this.dispose();
        BaseTexture.removeFromCache(this);
        this._textureCacheIds = null;
        this._destroyed = true;
    }

    public dispose():void
    {
        this.dispatchEvent(new Event(Event.UNLOAD));
    }

    protected updateSourceImage(newSrc:string):void
    {
        var src:any = this.getProperty(this._source, 'src')
        src = newSrc;
        this.loadSource(this._source);
    }

    public static fromImage(imageUrl:string, crossorigin:boolean, scaleMode:number, sourceScale:number):BaseTexture
    {
        let baseTexture:BaseTexture = BaseTexture.BaseTextureCache[imageUrl];
        if (!baseTexture)
        {
            const image:HTMLImageElement = document.createElement('img');
            if (crossorigin === undefined && imageUrl.indexOf('data:') !== 0)
            {
                image.crossOrigin = Utils.determineCrossOrigin(imageUrl);
            }
            else if (crossorigin)
            {
                image.crossOrigin = typeof crossorigin === 'string' ? crossorigin : 'anonymous';
            }
            baseTexture = new BaseTexture(image, scaleMode);
            baseTexture.imageUrl = imageUrl;
            if (sourceScale)
            {
                baseTexture.sourceScale = sourceScale;
            }
            baseTexture.resolution = Utils.getResolutionOfUrl(imageUrl);
            image.src = imageUrl; 
            BaseTexture.addToCache(baseTexture, imageUrl);
        }
        return baseTexture;
    }

    public static fromCanvas(canvas:HTMLCanvasElement, scaleMode:number, origin:string = 'canvas'):BaseTexture
    {
        if (!BaseObject.getProperty(canvas, '_pixiId'))
        {
            var pixi:any = BaseObject.getProperty(canvas, '_pixiId')
            pixi = `${origin}_${Utils.uid()}`;
        }
        let baseTexture:BaseTexture = BaseTexture.BaseTextureCache[BaseObject.getProperty(canvas, '_pixiId')];
        if (!baseTexture)
        {
            baseTexture = new BaseTexture(canvas, scaleMode);
            BaseTexture.addToCache(baseTexture, BaseObject.getProperty(canvas, '_pixiId'));
        }
        return baseTexture;
    }

    public static from(source:string|HTMLImageElement|HTMLCanvasElement, scaleMode:number = null, sourceScale:number = null):BaseTexture
    {
        if (typeof source === 'string')
        {
            return BaseTexture.fromImage(source, undefined, scaleMode, sourceScale);
        }
        else if (source instanceof HTMLImageElement)
        {
            const imageUrl:string = source.src;
            let baseTexture = BaseTexture.BaseTextureCache[imageUrl];
            if (!baseTexture)
            {
                baseTexture = new BaseTexture(source, scaleMode);
                baseTexture.imageUrl = imageUrl;
                if (sourceScale)
                {
                    baseTexture.sourceScale = sourceScale;
                }
                baseTexture.resolution = Utils.getResolutionOfUrl(imageUrl);
                BaseTexture.addToCache(baseTexture, imageUrl);
            }
            return baseTexture;
        }
        else if (source instanceof HTMLCanvasElement)
        {
            return BaseTexture.fromCanvas(source, scaleMode);
        }
        return source;
    }

    public static addToCache(baseTexture:BaseTexture, id:string):void
    {
        if (id)
        {
            if (baseTexture._textureCacheIds.indexOf(id) === -1)
            {
                baseTexture._textureCacheIds.push(id);
            }
            if (BaseTexture.BaseTextureCache[id])
            {
                console.warn(`BaseTexture added to the cache with an id [${id}] that already had an entry`);
            }
            BaseTexture.BaseTextureCache[id] = baseTexture;
        }
    }

    public static removeFromCache(baseTexture:BaseTexture):BaseTexture
    {
        if (typeof baseTexture === 'string')
        {
            const baseTextureFromCache = BaseTexture.BaseTextureCache[baseTexture];
            if (baseTextureFromCache)
            {
                const index = baseTextureFromCache._textureCacheIds.indexOf(baseTexture);
                if (index > -1)
                {
                    baseTextureFromCache._textureCacheIds.splice(index, 1);
                }
                delete BaseTexture.BaseTextureCache[baseTexture];
                return baseTextureFromCache;
            }
        }
        else if (baseTexture && baseTexture._textureCacheIds)
        {
            for (let i = 0; i < baseTexture._textureCacheIds.length; ++i)
            {
                delete BaseTexture.BaseTextureCache[baseTexture._textureCacheIds[i]];
            }
            baseTexture._textureCacheIds.length = 0;
            return baseTexture;
        }
        return null;
    }
}
export { BaseTexture };