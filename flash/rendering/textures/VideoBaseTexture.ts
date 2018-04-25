import { BaseTexture } from "./BaseTexture";
import { Timer } from "flash/utils/Timer";
import { Constants } from "../managers/Constants";
import { Utils } from "../webgl/Utils";
import { Event } from "flash/events/Event";

export class VideoBaseTexture extends BaseTexture
{
    /**
     * @param {HTMLVideoElement} source - Video source
     * @param {number} [scaleMode=PIXI.settings.SCALE_MODE] - See {@link PIXI.SCALE_MODES} for possible values
     */
    public static fromUrls:any;
    public _autoUpdate:any;
    public _isAutoUpdating:any;
    public autoPlay:any;
    public __loaded:any;

    constructor(source, scaleMode)
    {
        VideoBaseTexture.fromUrls = VideoBaseTexture.fromUrl;
        if (!source)
        {
            throw new Error('No video source element specified.');
        }

        // hook in here to check if video is already available.
        // BaseTexture looks for a source.complete boolean, plus width & height.

        if ((source.readyState === source.HAVE_ENOUGH_DATA || source.readyState === source.HAVE_FUTURE_DATA)
            && source.width && source.height)
        {
            source.complete = true;
        }

        super(source, scaleMode);

        this.width = source.videoWidth;
        this.height = source.videoHeight;

        this._autoUpdate = true;
        this._isAutoUpdating = false;

        /**
         * When set to true will automatically play videos used by this texture once
         * they are loaded. If false, it will not modify the playing state.
         *
         * @member {boolean}
         * @default true
         */
        this.autoPlay = true;

        this.update = this.update.bind(this);
        this._onCanPlay = this._onCanPlay.bind(this);

        source.addEventListener('play', this._onPlayStart.bind(this));
        source.addEventListener('pause', this._onPlayStop.bind(this));
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

    /**
     * Returns true if the underlying source is playing.
     *
     * @private
     * @return {boolean} True if playing.
     */
    public _isSourcePlaying()
    {
        const source:any = this.source;        
        return (this.getProperty(source, 'currentTime') > 0 && source.paused === false && source.ended === false && source.readyState > 2);
    }

    /**
     * Returns true if the underlying source is ready for playing.
     *
     * @private
     * @return {boolean} True if ready.
     */
    public _isSourceReady()
    {
        const source:any = this.source;    
        return source.readyState === 3 || source.readyState === 4;
    }

    /**
     * Runs the update loop when the video is ready to play
     *
     * @private
     */
    public _onPlayStart()
    {
        // Just in case the video has not received its can play even yet..
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

    /**
     * Fired when a pause event is triggered, stops the update loop
     *
     * @private
     */
    public _onPlayStop()
    {
        if (this._isAutoUpdating)
        {
            Timer.shared.remove(this.update, this);
            this._isAutoUpdating = false;
        }
    }

    /**
     * Fired when the video is loaded and ready to play
     *
     * @private
     */
    public _onCanPlay()
    {
        this.hasLoaded = true;
        const source:any = this.source;    
        if (this.source)
        {
            this.source.removeEventListener('canplay', this._onCanPlay);
            this.source.removeEventListener('canplaythrough', this._onCanPlay);

            this.width = source.videoWidth;
            this.height = source.videoHeight;

            // prevent multiple loaded dispatches..
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
                source.play();
            }
        }
    }

    /**
     * Destroys this texture
     *
     */
    public destroy()
    {
        const source:any = this.source;    
        if (this._isAutoUpdating)
        {
            Timer.shared.remove(this.update, this);
        }

        if (this.source && source._pixiId)
        {
            BaseTexture.removeFromCache(source._pixiId);
            delete source._pixiId;

            source.pause();
            source.src = '';
            source.load();
        }

        super.destroy();
    }

    /**
     * Mimic PixiJS BaseTexture.from.... method.
     *
     * @static
     * @param {HTMLVideoElement} video - Video to create texture from
     * @param {number} [scaleMode=PIXI.settings.SCALE_MODE] - See {@link PIXI.SCALE_MODES} for possible values
     * @return {PIXI.VideoBaseTexture} Newly created VideoBaseTexture
     */
    public static fromVideo(video, scaleMode)
    {
        if (!video._pixiId)
        {
            video._pixiId = `video_${Utils.uid()}`;
        }

        let baseTexture = BaseTexture.BaseTextureCache[video._pixiId];

        if (!baseTexture)
        {
            baseTexture = new VideoBaseTexture(video, scaleMode);
            BaseTexture.addToCache(baseTexture, video._pixiId);
        }

        return baseTexture;
    }

    /**
     * Helper function that creates a new BaseTexture based on the given video element.
     * This BaseTexture can then be used to create a texture
     *
     * @static
     * @param {string|object|string[]|object[]} videoSrc - The URL(s) for the video.
     * @param {string} [videoSrc.src] - One of the source urls for the video
     * @param {string} [videoSrc.mime] - The mimetype of the video (e.g. 'video/mp4'). If not specified
     *  the url's extension will be used as the second part of the mime type.
     * @param {number} scaleMode - See {@link PIXI.SCALE_MODES} for possible values
     * @param {boolean} [crossorigin=(auto)] - Should use anonymous CORS? Defaults to true if the URL is not a data-URI.
     * @return {PIXI.VideoBaseTexture} Newly created VideoBaseTexture
     */
    public static fromUrl(videoSrc, scaleMode, crossorigin = null)
    {
        const video = document.createElement('video');

        video.setAttribute('webkit-playsinline', '');
        video.setAttribute('playsinline', '');

        const url = Array.isArray(videoSrc) ? (videoSrc[0].src || videoSrc[0]) : (videoSrc.src || videoSrc);

        if (crossorigin === undefined && url.indexOf('data:') !== 0)
        {
            video.crossOrigin = Utils.determineCrossOrigin(url);
        }
        else if (crossorigin)
        {
            video.crossOrigin = typeof crossorigin === 'string' ? crossorigin : 'anonymous';
        }

        // array of objects or strings
        if (Array.isArray(videoSrc))
        {
            for (let i = 0; i < videoSrc.length; ++i)
            {
                video.appendChild(VideoBaseTexture.createSource(videoSrc[i].src || videoSrc[i], videoSrc[i].mime));
            }
        }
        // single object or string
        else
        {
            video.appendChild(VideoBaseTexture.createSource(url, videoSrc.mime));
        }

        video.load();

        return VideoBaseTexture.fromVideo(video, scaleMode);
    }

    /**
     * Should the base texture automatically update itself, set to true by default
     *
     * @member {boolean}
     */
    public get autoUpdate()
    {
        return this._autoUpdate;
    }

    public set autoUpdate(value) // eslint-disable-line require-jsdoc
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

    public static createSource(path, type)
    {
        if (!type)
        {
            type = `video/${path.substr(path.lastIndexOf('.') + 1)}`;
        }

        const source = document.createElement('source');

        source.src = path;
        source.type = type;

        return source;
    }
}