define(["require", "exports", "../webgl/Utils", "flash/display/BaseObject", "flash/events/EventDispatcher", "flash/events/Event", "flash/display/StageSettings", "../../geom/Rectangle"], function (require, exports, Utils_1, BaseObject_1, EventDispatcher_1, Event_1, StageSettings_1, Rectangle_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseTexture extends EventDispatcher_1.EventDispatcher {
        constructor(source = null, scaleMode = StageSettings_1.StageSettings.SCALE_MODE, resolution = StageSettings_1.StageSettings.RESOLUTION) {
            super();
            this._frame = null;
            this.uid = Utils_1.Utils.uid();
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
            this.mipmap = StageSettings_1.StageSettings.MIPMAP_TEXTURES;
            this.wrapMode = StageSettings_1.StageSettings.WRAP_MODE;
            this._glTextures = [];
            this._enabled = 0;
            this._virtalBoundId = -1;
            this._destroyed = false;
            this.textureCacheIds = [];
            if (source) {
                this.loadSource(source);
            }
        }
        get frame() {
            if (!this._frame) {
                this._frame = new Rectangle_1.Rectangle();
            }
            this._frame.width = this.width;
            this._frame.height = this.height;
            return this._frame;
        }
        resize(width, height) {
            width = Math.ceil(width);
            height = Math.ceil(height);
            if (width === this.width && height === this.height) {
                return;
            }
            this.valid = (width > 0 && height > 0);
            this.width = width;
            this.height = height;
            this.realWidth = this.width * this.resolution;
            this.realHeight = this.height * this.resolution;
            if (!this.valid) {
                return;
            }
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
        }
        update() {
            if (this.imageType !== 'svg') {
                this.realWidth = this.source['naturalWidth'] || this.source['videoWidth'] || this.source.width;
                this.realHeight = this.source['naturalHeight'] || this.source['videoHeight'] || this.source.height;
                this._updateDimensions();
            }
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
        }
        get resolution() {
            if (this._resolution == null || this._resolution == undefined || isNaN(this._resolution)) {
                this._resolution = StageSettings_1.StageSettings.RESOLUTION;
            }
            return this._resolution;
        }
        set resolution(value) {
            this._resolution = value;
        }
        _updateDimensions() {
            this.width = this.realWidth / this.resolution;
            this.height = this.realHeight / this.resolution;
            this.isPowerOfTwo = false;
            if (Utils_1.Utils.isPow2(this.realWidth) && Utils_1.Utils.isPow2(this.realHeight)) {
                this.isPowerOfTwo = true;
            }
        }
        loadSource(source) {
            const wasLoading = this.isLoading;
            this.hasLoaded = false;
            this.isLoading = false;
            if (wasLoading && this.source) {
                this.source.onload = null;
                this.source.onerror = null;
            }
            const firstSourceLoaded = !this.source;
            this.source = source;
            if (((source['src'] && source['complete']) || source['getContext']) && source.width && source.height) {
                this._updateImageType();
                if (this.imageType === 'svg') {
                    this._loadSvgSource();
                }
                else {
                    this._sourceLoaded();
                }
                if (firstSourceLoaded) {
                    this.dispatchEvent(new Event_1.Event(Event_1.Event.COMPLETE));
                }
            }
            else if (!source['getContext']) {
                this.isLoading = true;
                const scope = this;
                source.onload = () => {
                    scope._updateImageType();
                    source.onload = null;
                    source.onerror = null;
                    if (!scope.isLoading) {
                        return;
                    }
                    scope.isLoading = false;
                    scope._sourceLoaded();
                    if (scope.imageType === 'svg') {
                        scope._loadSvgSource();
                        return;
                    }
                    this.dispatchEvent(new Event_1.Event(Event_1.Event.COMPLETE));
                };
                source.onerror = () => {
                    source.onload = null;
                    source.onerror = null;
                    if (!scope.isLoading) {
                        return;
                    }
                    scope.isLoading = false;
                    this.dispatchEvent(new Event_1.Event(Event_1.Event.ERROR));
                };
                if (source['complete'] && source['src']) {
                    source.onload = null;
                    source.onerror = null;
                    if (scope.imageType === 'svg') {
                        scope._loadSvgSource();
                        return;
                    }
                    this.isLoading = false;
                    if (source.width && source.height) {
                        this._sourceLoaded();
                        if (wasLoading) {
                            this.dispatchEvent(new Event_1.Event(Event_1.Event.COMPLETE));
                        }
                    }
                    else if (wasLoading) {
                        this.dispatchEvent(new Event_1.Event(Event_1.Event.ERROR));
                    }
                }
            }
        }
        _updateImageType() {
            if (!this.imageUrl) {
                return;
            }
            const dataUri = Utils_1.Utils.decomposeDataUri(this.imageUrl);
            let imageType;
            if (dataUri && dataUri.mediaType === 'image') {
                const firstSubType = dataUri.subType.split('+')[0];
                imageType = Utils_1.Utils.getUrlFileExtension(`.${firstSubType}`);
                if (!imageType) {
                    throw new Error('Invalid image type in data URI.');
                }
            }
            else {
                imageType = Utils_1.Utils.getUrlFileExtension(this.imageUrl);
                if (!imageType) {
                    imageType = 'png';
                }
            }
            this.imageType = imageType;
        }
        _loadSvgSource() {
            if (this.imageType !== 'svg') {
                return;
            }
            const dataUri = Utils_1.Utils.decomposeDataUri(this.imageUrl);
            if (dataUri) {
                this._loadSvgSourceUsingDataUri(dataUri);
            }
            else {
                this._loadSvgSourceUsingXhr();
            }
        }
        _loadSvgSourceUsingDataUri(dataUri) {
            let svgString;
            if (this.getProperty(dataUri, 'encoding') && this.getProperty(dataUri, 'encoding') === 'base64') {
                if (!atob) {
                    throw new Error('Your browser doesn\'t support base64 conversions.');
                }
                svgString = atob(this.getProperty(dataUri, 'data'));
            }
            else {
                svgString = this.getProperty(dataUri, 'data');
            }
            this._loadSvgSourceUsingString(svgString);
        }
        _loadSvgSourceUsingXhr() {
            const svgXhr = new XMLHttpRequest();
            svgXhr.onload = () => {
                if (svgXhr.readyState !== svgXhr.DONE || svgXhr.status !== 200) {
                    throw new Error('Failed to load SVG using XHR.');
                }
                this._loadSvgSourceUsingString(svgXhr.response);
            };
            svgXhr.onerror = () => { this.dispatchEvent(new Event_1.Event(Event_1.Event.ERROR)); };
            svgXhr.open('GET', this.imageUrl, true);
            svgXhr.send();
        }
        _loadSvgSourceUsingString(svgString) {
            const svgSize = Utils_1.Utils.getSvgSize(svgString);
            const svgWidth = svgSize.width;
            const svgHeight = svgSize.height;
            if (!svgWidth || !svgHeight) {
                throw new Error('The SVG image must have width and height defined (in pixels), canvas API needs them.');
            }
            this.realWidth = Math.round(svgWidth * this.sourceScale);
            this.realHeight = Math.round(svgHeight * this.sourceScale);
            this._updateDimensions();
            const canvas = document.createElement('canvas');
            canvas.width = this.realWidth;
            canvas.height = this.realHeight;
            canvas._pixiId = `canvas_${Utils_1.Utils.uid()}`;
            canvas.getContext('2d').drawImage(this.source, 0, 0, svgWidth, svgHeight, 0, 0, this.realWidth, this.realHeight);
            this.origSource = this.source;
            this.source = canvas;
            BaseTexture.addToCache(this, canvas._pixiId);
            this.isLoading = false;
            this._sourceLoaded();
            this.dispatchEvent(new Event_1.Event(Event_1.Event.COMPLETE));
        }
        _sourceLoaded() {
            this.hasLoaded = true;
            this.update();
        }
        destroy(options = null) {
            if (this.imageUrl) {
                delete BaseTexture.BaseTextureCache[this.imageUrl];
                this.imageUrl = null;
                if (!navigator['isCocoonJS']) {
                    var src = this.getProperty(this.source, 'src');
                    src = '';
                }
            }
            this.source = null;
            this.dispose();
            BaseTexture.removeFromCache(this);
            this.textureCacheIds = null;
            this._destroyed = true;
        }
        dispose() {
            this.dispatchEvent(new Event_1.Event(Event_1.Event.UNLOAD));
        }
        updateSourceImage(newSrc) {
            var src = this.getProperty(this.source, 'src');
            src = newSrc;
            this.loadSource(this.source);
        }
        static fromImage(imageUrl, crossorigin, scaleMode, sourceScale) {
            let baseTexture = BaseTexture.BaseTextureCache[imageUrl];
            if (!baseTexture) {
                const image = document.createElement('img');
                if (crossorigin === undefined && imageUrl.indexOf('data:') !== 0) {
                    image.crossOrigin = Utils_1.Utils.determineCrossOrigin(imageUrl);
                }
                else if (crossorigin) {
                    image.crossOrigin = typeof crossorigin === 'string' ? crossorigin : 'anonymous';
                }
                baseTexture = new BaseTexture(image, scaleMode);
                baseTexture.imageUrl = imageUrl;
                if (sourceScale) {
                    baseTexture.sourceScale = sourceScale;
                }
                baseTexture.resolution = Utils_1.Utils.getResolutionOfUrl(imageUrl);
                image.src = imageUrl;
                BaseTexture.addToCache(baseTexture, imageUrl);
            }
            return baseTexture;
        }
        static fromCanvas(canvas, scaleMode, origin = 'canvas') {
            if (!BaseObject_1.BaseObject.getProperty(canvas, '_pixiId')) {
                var pixi = BaseObject_1.BaseObject.getProperty(canvas, '_pixiId');
                pixi = `${origin}_${Utils_1.Utils.uid()}`;
            }
            let baseTexture = BaseTexture.BaseTextureCache[BaseObject_1.BaseObject.getProperty(canvas, '_pixiId')];
            if (!baseTexture) {
                baseTexture = new BaseTexture(canvas, scaleMode);
                BaseTexture.addToCache(baseTexture, BaseObject_1.BaseObject.getProperty(canvas, '_pixiId'));
            }
            return baseTexture;
        }
        static from(source, scaleMode = null, sourceScale = null) {
            if (typeof source === 'string') {
                return BaseTexture.fromImage(source, undefined, scaleMode, sourceScale);
            }
            else if (source instanceof HTMLImageElement) {
                const imageUrl = source.src;
                let baseTexture = BaseTexture.BaseTextureCache[imageUrl];
                if (!baseTexture) {
                    baseTexture = new BaseTexture(source, scaleMode);
                    baseTexture.imageUrl = imageUrl;
                    if (sourceScale) {
                        baseTexture.sourceScale = sourceScale;
                    }
                    baseTexture.resolution = Utils_1.Utils.getResolutionOfUrl(imageUrl);
                    BaseTexture.addToCache(baseTexture, imageUrl);
                }
                return baseTexture;
            }
            else if (source instanceof HTMLCanvasElement) {
                return BaseTexture.fromCanvas(source, scaleMode);
            }
            return source;
        }
        static addToCache(baseTexture, id) {
            BaseObject_1.BaseObject.show("new tex: " + id);
            if (id) {
                if (baseTexture.textureCacheIds.indexOf(id) === -1) {
                    baseTexture.textureCacheIds.push(id);
                }
                if (BaseTexture.BaseTextureCache[id]) {
                    console.warn(`BaseTexture added to the cache with an id [${id}] that already had an entry`);
                }
                BaseTexture.BaseTextureCache[id] = baseTexture;
            }
        }
        static removeFromCache(baseTexture) {
            if (typeof baseTexture === 'string') {
                const baseTextureFromCache = BaseTexture.BaseTextureCache[baseTexture];
                if (baseTextureFromCache) {
                    const index = baseTextureFromCache.textureCacheIds.indexOf(baseTexture);
                    if (index > -1) {
                        baseTextureFromCache.textureCacheIds.splice(index, 1);
                    }
                    delete BaseTexture.BaseTextureCache[baseTexture];
                    return baseTextureFromCache;
                }
            }
            else if (baseTexture && baseTexture.textureCacheIds) {
                for (let i = 0; i < baseTexture.textureCacheIds.length; ++i) {
                    delete BaseTexture.BaseTextureCache[baseTexture.textureCacheIds[i]];
                }
                baseTexture.textureCacheIds.length = 0;
                return baseTexture;
            }
            return null;
        }
    }
    BaseTexture.BaseTextureCache = {};
    BaseTexture.TextureCache = {};
    exports.BaseTexture = BaseTexture;
});
//# sourceMappingURL=BaseTexture.js.map