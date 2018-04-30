define(["require", "exports", "flash/display3D/textures/BaseTexture", "flash/utils/Timer", "flash/rendering/managers/Constants", "flash/rendering/webgl/Utils", "flash/events/Event"], function (require, exports, BaseTexture_1, Timer_1, Constants_1, Utils_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class VideoBaseTexture extends BaseTexture_1.BaseTexture {
        constructor(source, scaleMode) {
            super(null, scaleMode);
            // super(source, scaleMode); resolve casting
            if ((source.readyState === source.HAVE_ENOUGH_DATA || source.readyState === source.HAVE_FUTURE_DATA) && source.width && source.height) {
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
            if (!this._isSourceReady()) {
                source.addEventListener('canplay', this._onCanPlay);
                source.addEventListener('canplaythrough', this._onCanPlay);
            }
            else {
                this._onCanPlay();
            }
        }
        _isSourcePlaying() {
            return (this.getProperty(this.source, 'currentTime') > 0 && this.source['paused'] === false && this.source['ended'] === false && this.source['readyState'] > 2);
        }
        _isSourceReady() {
            return this.source['readyState'] === 3 || this.source['readyState'] === 4;
        }
        _onPlayStart() {
            if (!this.hasLoaded) {
                this._onCanPlay();
            }
            if (!this._isAutoUpdating && this.autoUpdate) {
                Timer_1.Timer.shared.add(this.update, this, Constants_1.Constants.UPDATE_PRIORITY.HIGH);
                this._isAutoUpdating = true;
            }
        }
        _onPlayStop() {
            if (this._isAutoUpdating) {
                Timer_1.Timer.shared.remove(this.update, this);
                this._isAutoUpdating = false;
            }
        }
        _onCanPlay() {
            this.hasLoaded = true;
            if (this.source) {
                this.source.removeEventListener('canplay', this._onCanPlay);
                this.source.removeEventListener('canplaythrough', this._onCanPlay);
                this.width = this.source['videoWidth'];
                this.height = this.source['videoHeight'];
                if (!this.__loaded) {
                    this.__loaded = true;
                    this.dispatchEvent(new Event_1.Event(Event_1.Event.COMPLETE));
                }
                if (this._isSourcePlaying()) {
                    this._onPlayStart();
                }
                else if (this.autoPlay) {
                    this.source['play']();
                }
            }
        }
        destroy() {
            if (this._isAutoUpdating) {
                Timer_1.Timer.shared.remove(this.update, this);
            }
            if (this.source && this.source['_pixiId']) {
                BaseTexture_1.BaseTexture.removeFromCache(this.source['_pixiId']);
                delete this.source['_pixiId'];
                this.source['pause']();
                this.source['src'] = '';
                this.source['load']();
            }
            super.destroy();
        }
        static fromVideo(video, scaleMode) {
            if (!video['_pixiId']) {
                video['_pixiId'] = `video_${Utils_1.Utils.uid()}`;
            }
            let baseTexture = BaseTexture_1.BaseTexture.BaseTextureCache[video['_pixiId']];
            if (!baseTexture) {
                baseTexture = new VideoBaseTexture(video, scaleMode);
                BaseTexture_1.BaseTexture.addToCache(baseTexture, video['_pixiId']);
            }
            return baseTexture;
        }
        static fromUrl(videoSrc, scaleMode, crossorigin = false) {
            const video = document.createElement('video');
            video.setAttribute('webkit-playsinline', '');
            video.setAttribute('playsinline', '');
            const url = Array.isArray(videoSrc) ? (videoSrc[0]['src'] || videoSrc[0]) : (videoSrc['src'] || videoSrc);
            if (crossorigin === undefined && url.indexOf('data:') !== 0) {
                video.crossOrigin = Utils_1.Utils.determineCrossOrigin(url);
            }
            else if (crossorigin) {
                video.crossOrigin = typeof crossorigin === 'string' ? crossorigin : 'anonymous';
            }
            if (Array.isArray(videoSrc)) {
                for (let i = 0; i < videoSrc.length; ++i) {
                    video.appendChild(VideoBaseTexture.createSource(videoSrc[i]['src'] || videoSrc[i], videoSrc[i]['mime']));
                }
            }
            else {
                video.appendChild(VideoBaseTexture.createSource(url, videoSrc['mime']));
            }
            video.load();
            return VideoBaseTexture.fromVideo(video, scaleMode);
        }
        get autoUpdate() {
            return this._autoUpdate;
        }
        set autoUpdate(value) {
            if (value !== this._autoUpdate) {
                this._autoUpdate = value;
                if (!this._autoUpdate && this._isAutoUpdating) {
                    Timer_1.Timer.shared.remove(this.update, this);
                    this._isAutoUpdating = false;
                }
                else if (this._autoUpdate && !this._isAutoUpdating) {
                    Timer_1.Timer.shared.add(this.update, this, Constants_1.Constants.UPDATE_PRIORITY.HIGH);
                    this._isAutoUpdating = true;
                }
            }
        }
        static createSource(path, type) {
            if (!type) {
                type = `video/${path.substr(path.lastIndexOf('.') + 1)}`;
            }
            const source = document.createElement('source');
            source.src = path;
            source.type = type;
            return source;
        }
    }
    exports.VideoBaseTexture = VideoBaseTexture;
});
//# sourceMappingURL=VideoBaseTexture.js.map