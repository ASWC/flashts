
import { Utils } from "../webgl/Utils";
import { BaseObject } from "../core/BaseObject";
import { GLTexture } from "flash/rendering/core/gl/GLTexture";
import { EventDispatcher } from "flash/events/EventDispatcher";
import { Event } from "flash/events/Event";
import { StageSettings } from "flash/rendering/core/StageSettings";

class BaseTexture extends EventDispatcher
{
    public static BaseTextureCache:any = {};
    public static TextureCache:any = {};
    public _canvasRenderTarget:any;    
    public _glRenderTargets:any;
    public uid:number;
    public valid:boolean;
    public renderer:any;
    public touched:number;
    public _resolution:number;
    public realHeight:number;
    public hasLoaded:boolean;
    public imageUrl:string;
    public realWidth:number;
    public scaleMode:number;
    public imageType:string;
    public source:HTMLImageElement|HTMLCanvasElement;
    public origSource:any;
    public sourceScale:number;
    public wrapMode:number;
    public premultipliedAlpha:boolean;
    public _enabled:number;
    public _destroyed:boolean;
    public mipmap:boolean;
    public _virtalBoundId:number;
    public isPowerOfTwo:boolean;
    public _glTextures:GLTexture[];
    public isLoading:boolean;
    public textureCacheIds:string[];
    public width:number;
    public height:number;

    constructor(source:HTMLImageElement|HTMLCanvasElement = null, scaleMode:number = StageSettings.SCALE_MODE, resolution:number = StageSettings.RESOLUTION)
    {
        super();
        this.uid = Utils.uid();

        this.show('got new texture id: ' + this.uid)

        this.touched = 0;
        this._resolution = resolution;
        this.width = 100;
        this.height = 100;
        this.realWidth = 100;
        this.realHeight = 100;
        this.scaleMode = scaleMode;
        this.hasLoaded = false;
        this.isLoading = false;
        this.source = null;
        this.origSource = null; 
        this.imageType = null; 
        this.sourceScale = 1.0;
        this.premultipliedAlpha = true;
        this.imageUrl = null;
        this.isPowerOfTwo = false;
        this.mipmap = StageSettings.MIPMAP_TEXTURES;
        this.wrapMode = StageSettings.WRAP_MODE;
        this._glTextures = [];
        this._enabled = 0;
        this._virtalBoundId = -1;
        this._destroyed = false;
        this.textureCacheIds = [];
        if (source)
        {
            this.loadSource(source);
        }
    }

    public resize(width:number, height:number):void
    {
        width = Math.ceil(width);
        height = Math.ceil(height);
        if (width === this.width && height === this.height)
        {
            return;
        }
        this.valid = (width > 0 && height > 0);
        this.width = width;
        this.height = height;
        this.realWidth = this.width * this.resolution;
        this.realHeight = this.height * this.resolution;
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
            this.realWidth = this.source['naturalWidth'] || this.source['videoWidth'] || this.source.width;
            this.realHeight = this.source['naturalHeight'] || this.source['videoHeight'] || this.source.height;           
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

    public _updateDimensions():void
    {
        this.width = this.realWidth / this.resolution;
        this.height = this.realHeight / this.resolution;
        this.isPowerOfTwo = false;
        if(Utils.isPow2(this.realWidth) && Utils.isPow2(this.realHeight))
        {
            this.isPowerOfTwo = true;
        }  
    }

    public loadSource(source:HTMLImageElement|HTMLCanvasElement):void
    {        
        const wasLoading = this.isLoading;
        this.hasLoaded = false;
        this.isLoading = false;
        if (wasLoading && this.source)
        {
            this.source.onload = null;
            this.source.onerror = null;
        }
        const firstSourceLoaded = !this.source;
        this.source = source;
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
                scope._updateImageType();
                source.onload = null;
                source.onerror = null;
                if (!scope.isLoading)
                {
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

    public _updateImageType():void
    {
        if (!this.imageUrl)
        {
            return;
        }
        const dataUri = Utils.decomposeDataUri(this.imageUrl);
        let imageType;
        if (dataUri && dataUri.mediaType === 'image')
        {
            const firstSubType = dataUri.subType.split('+')[0];
            imageType = Utils.getUrlFileExtension(`.${firstSubType}`);
            if (!imageType)
            {
                throw new Error('Invalid image type in data URI.');
            }
        }
        else
        {
            imageType = Utils.getUrlFileExtension(this.imageUrl);
            if (!imageType)
            {
                imageType = 'png';
            }
        }
        this.imageType = imageType;
    }

    public _loadSvgSource():void
    {
        if (this.imageType !== 'svg')
        {
            return;
        }
        const dataUri = Utils.decomposeDataUri(this.imageUrl);
        if (dataUri)
        {
            this._loadSvgSourceUsingDataUri(dataUri);
        }
        else
        {
            this._loadSvgSourceUsingXhr();
        }
    }

    public _loadSvgSourceUsingDataUri(dataUri:any):void
    {
        let svgString;
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

    public  _loadSvgSourceUsingXhr():void
    {
        const svgXhr = new XMLHttpRequest();
        svgXhr.onload = () =>
        {
            if (svgXhr.readyState !== svgXhr.DONE || svgXhr.status !== 200)
            {
                throw new Error('Failed to load SVG using XHR.');
            }
            this._loadSvgSourceUsingString(svgXhr.response);
        };
        svgXhr.onerror = () => {this.dispatchEvent(new Event(Event.ERROR));}
        svgXhr.open('GET', this.imageUrl, true);
        svgXhr.send();
    }

    public _loadSvgSourceUsingString(svgString:string):void
    {
        const svgSize:any = Utils.getSvgSize(svgString);
        const svgWidth = svgSize.width;
        const svgHeight = svgSize.height;
        if (!svgWidth || !svgHeight)
        {
            throw new Error('The SVG image must have width and height defined (in pixels), canvas API needs them.');
        }
        this.realWidth = Math.round(svgWidth * this.sourceScale);
        this.realHeight = Math.round(svgHeight * this.sourceScale);
        this._updateDimensions();
        const canvas:any = document.createElement('canvas');
        canvas.width = this.realWidth;
        canvas.height = this.realHeight;
        canvas._pixiId = `canvas_${Utils.uid()}`;
        canvas.getContext('2d').drawImage(this.source, 0, 0, svgWidth, svgHeight, 0, 0, this.realWidth, this.realHeight);
        this.origSource = this.source;
        this.source = canvas;
        BaseTexture.addToCache(this, canvas._pixiId);
        this.isLoading = false;
        this._sourceLoaded();
        this.dispatchEvent(new Event(Event.COMPLETE));
    }

    public _sourceLoaded():void
    {
        this.hasLoaded = true;
        this.update();
    }

    public destroy(options:any = null):void
    {
        if (this.imageUrl)
        {
            delete BaseTexture.BaseTextureCache[this.imageUrl];
            this.imageUrl = null;
            if (!navigator['isCocoonJS'])
            {
                var src:any = this.getProperty(this.source, 'src')
                src = '';
            }
        }
        this.source = null;
        this.dispose();
        BaseTexture.removeFromCache(this);
        this.textureCacheIds = null;
        this._destroyed = true;
    }

    public dispose():void
    {
        this.dispatchEvent(new Event(Event.UNLOAD));
    }

    public updateSourceImage(newSrc:string):void
    {
        var src:any = this.getProperty(this.source, 'src')
        src = newSrc;
        this.loadSource(this.source);
    }

    public static fromImage(imageUrl:string, crossorigin:boolean, scaleMode:number, sourceScale:number):BaseTexture
    {
        let baseTexture = BaseTexture.BaseTextureCache[imageUrl];
        if (!baseTexture)
        {
            const image = document.createElement('img');
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
        let baseTexture = BaseTexture.BaseTextureCache[BaseObject.getProperty(canvas, '_pixiId')];
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
            const imageUrl = source.src;
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
        BaseObject.show("new tex: " + id)
        if (id)
        {
            if (baseTexture.textureCacheIds.indexOf(id) === -1)
            {
                baseTexture.textureCacheIds.push(id);
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
                const index = baseTextureFromCache.textureCacheIds.indexOf(baseTexture);
                if (index > -1)
                {
                    baseTextureFromCache.textureCacheIds.splice(index, 1);
                }
                delete BaseTexture.BaseTextureCache[baseTexture];
                return baseTextureFromCache;
            }
        }
        else if (baseTexture && baseTexture.textureCacheIds)
        {
            for (let i = 0; i < baseTexture.textureCacheIds.length; ++i)
            {
                delete BaseTexture.BaseTextureCache[baseTexture.textureCacheIds[i]];
            }
            baseTexture.textureCacheIds.length = 0;
            return baseTexture;
        }
        return null;
    }
}
export { BaseTexture };