import { BaseTexture } from "flash/display3D/textures/BaseTexture";
import { Timer } from "flash/utils/Timer";
import { Constants } from "flash/rendering/managers/Constants";
import { Utils } from "flash/rendering/webgl/Utils";
import { Event } from "flash/events/Event";

export class VideoBaseTexture extends BaseTexture
{
    public static fromUrls:boolean;
    public _autoUpdate:boolean;
    public _isAutoUpdating:boolean;
    public autoPlay:boolean;
    public __loaded:boolean;

    constructor(source:HTMLVideoElement, scaleMode:number)
    {       
        super(null, scaleMode);
        // super(source, scaleMode); resolve casting
        if ((source.readyState === source.HAVE_ENOUGH_DATA || source.readyState === source.HAVE_FUTURE_DATA) && source.width && source.height)
        {
            source['complete'] = true;
        } 
        this.width = source.videoWidth;
        this.height = source.videoHeight;
        this._autoUpdate = true;
        this._isAutoUpdating = false;
        this.autoPlay = true;
        source.addEventListener('play', this._onPlayStart);
        source.addEventListener('pause', this._onPlayStop);
        this.hasLoaded = false;
        this.__loaded = false;
        if (!this._isSourceReady())
        {
            source.addEventListener('canplay', this._onCanPlay);
            source.addEventListener('canplaythrough', this._onCanPlay);
        }
        else
        {
            this._onCanPlay();
        }
    }

    public _isSourcePlaying():boolean
    {       
        return (this.getProperty(this.source, 'currentTime') > 0 && this.source['paused'] === false && this.source['ended'] === false && this.source['readyState'] > 2);
    }

    public _isSourceReady():boolean
    {
        return this.source['readyState'] === 3 || this.source['readyState'] === 4;
    }

    public _onPlayStart():void
    {
        if (!this.hasLoaded)
        {
            this._onCanPlay();
        }
        if (!this._isAutoUpdating && this.autoUpdate)
        {            
            Timer.shared.add(this.update, this, Constants.UPDATE_PRIORITY.HIGH);
            this._isAutoUpdating = true;
        }
    }

    public _onPlayStop():void
    {
        if (this._isAutoUpdating)
        {
            Timer.shared.remove(this.update, this);
            this._isAutoUpdating = false;
        }
    }

    public _onCanPlay():void
    {
        this.hasLoaded = true;  
        if (this.source)
        {
            this.source.removeEventListener('canplay', this._onCanPlay);
            this.source.removeEventListener('canplaythrough', this._onCanPlay);
            this.width = this.source['videoWidth'];
            this.height = this.source['videoHeight'];
            if (!this.__loaded)
            {
                this.__loaded = true;
                this.dispatchEvent(new Event(Event.COMPLETE));
            }
            if (this._isSourcePlaying())
            {
                this._onPlayStart();
            }
            else if (this.autoPlay)
            {
                this.source['play']();
            }
        }
    }

    public destroy():void
    {  
        if (this._isAutoUpdating)
        {
            Timer.shared.remove(this.update, this);
        }
        if (this.source && this.source['_pixiId'])
        {
            BaseTexture.removeFromCache(this.source['_pixiId']);
            delete this.source['_pixiId'];
            this.source['pause']();
            this.source['src'] = '';
            this.source['load']();
        }
        super.destroy();
    }

    public static fromVideo(video:HTMLVideoElement, scaleMode:number):VideoBaseTexture
    {
        if (!video['_pixiId'])
        {
            video['_pixiId'] = `video_${Utils.uid()}`;
        }
        let baseTexture:VideoBaseTexture = <VideoBaseTexture> BaseTexture.BaseTextureCache[video['_pixiId']];
        if (!baseTexture)
        {
            baseTexture = new VideoBaseTexture(video, scaleMode);
            BaseTexture.addToCache(baseTexture, video['_pixiId']);
        }
        return baseTexture;
    }

    public static fromUrl(videoSrc:string|string[], scaleMode:number, crossorigin:boolean = false):VideoBaseTexture
    {
        const video:HTMLVideoElement = document.createElement('video');
        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('playsinline', '');
        const url:string = Array.isArray(videoSrc) ? (videoSrc[0]['src'] || videoSrc[0]) : (videoSrc['src'] || videoSrc);
        if (crossorigin === undefined && url.indexOf('data:') !== 0)
        {
            video.crossOrigin = Utils.determineCrossOrigin(url);
        }
        else if (crossorigin)
        {
            video.crossOrigin = typeof crossorigin === 'string' ? crossorigin : 'anonymous';
        }
        if (Array.isArray(videoSrc))
        {
            for (let i = 0; i < videoSrc.length; ++i)
            {
                video.appendChild(VideoBaseTexture.createSource(videoSrc[i]['src'] || videoSrc[i], videoSrc[i]['mime']));
            }
        }
        else
        {
            video.appendChild(VideoBaseTexture.createSource(url, videoSrc['mime']));
        }
        video.load();
        return VideoBaseTexture.fromVideo(video, scaleMode);
    }

    public get autoUpdate():boolean
    {
        return this._autoUpdate;
    }

    public set autoUpdate(value:boolean) 
    {
        if (value !== this._autoUpdate)
        {
            this._autoUpdate = value;
            if (!this._autoUpdate && this._isAutoUpdating)
            {
                Timer.shared.remove(this.update, this);
                this._isAutoUpdating = false;
            }
            else if (this._autoUpdate && !this._isAutoUpdating)
            {
                Timer.shared.add(this.update, this, Constants.UPDATE_PRIORITY.HIGH);
                this._isAutoUpdating = true;
            }
        }
    }

    public static createSource(path:string, type:string):HTMLSourceElement
    {
        if (!type)
        {
            type = `video/${path.substr(path.lastIndexOf('.') + 1)}`;
        }
        const source:HTMLSourceElement = document.createElement('source');
        source.src = path;
        source.type = type;
        return source;
    }
}