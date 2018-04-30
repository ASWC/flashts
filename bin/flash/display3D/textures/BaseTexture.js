define(["require", "exports", "flash/rendering/webgl/Utils", "flash/display/BaseObject", "flash/events/EventDispatcher", "flash/events/Event", "flash/display/StageSettings", "flash/geom/Rectangle"], function (require, exports, Utils_1, BaseObject_1, EventDispatcher_1, Event_1, StageSettings_1, Rectangle_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class BaseTexture extends EventDispatcher_1.EventDispatcher {
        constructor(source = null, scaleMode = StageSettings_1.StageSettings.SCALE_MODE, resolution = StageSettings_1.StageSettings.RESOLUTION) {
            super();
            this._frame = null;
            this.uid = Utils_1.Utils.uid();
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
            this._mipmap = StageSettings_1.StageSettings.MIPMAP_TEXTURES;
            this._wrapMode = StageSettings_1.StageSettings.WRAP_MODE;
            this._glTextures = [];
            this._enabled = 0;
            this._virtalBoundId = -1;
            this._destroyed = false;
            this._textureCacheIds = [];
            if (source) {
                this.loadSource(source);
            }
        }
        get realWidth() {
            return this._realWidth;
        }
        set realWidth(value) {
            this._realWidth = value;
        }
        get realHeight() {
            return this._realHeight;
        }
        set realHeight(value) {
            this._realHeight = value;
        }
        get textureCacheIds() {
            return this._textureCacheIds;
        }
        set textureCacheIds(value) {
            this._textureCacheIds = value;
        }
        get glTextures() {
            return this._glTextures;
        }
        set glTextures(value) {
            this._glTextures = value;
        }
        get isPowerOfTwo() {
            return this._isPowerOfTwo;
        }
        get glRenderTargets() {
            return this._glRenderTargets;
        }
        set glRenderTargets(value) {
            this._glRenderTargets = value;
        }
        get virtalBoundId() {
            return this._virtalBoundId;
        }
        set virtalBoundId(value) {
            this._virtalBoundId = value;
        }
        get enabled() {
            return this._enabled;
        }
        set enabled(value) {
            this._enabled = value;
        }
        get width() {
            return this._width;
        }
        set width(value) {
            this._width = value;
        }
        get source() {
            return this._source;
        }
        get height() {
            return this._height;
        }
        set height(value) {
            this._height = value;
        }
        get wrapMode() {
            return this._wrapMode;
        }
        get scaleMode() {
            return this._scaleMode;
        }
        set scaleMode(value) {
            this._scaleMode = value;
        }
        get imageUrl() {
            return this._imageUrl;
        }
        set imageUrl(value) {
            this._imageUrl = value;
        }
        get premultipliedAlpha() {
            return this._premultipliedAlpha;
        }
        get mipmap() {
            return this._mipmap;
        }
        get hasLoaded() {
            return this._hasLoaded;
        }
        set hasLoaded(value) {
            this._hasLoaded = value;
        }
        set touched(value) {
            this._touched = value;
        }
        get touched() {
            return this._touched;
        }
        get frame() {
            if (!this._frame) {
                this._frame = new Rectangle_1.Rectangle();
            }
            this._frame.width = this._width;
            this._frame.height = this._height;
            return this._frame;
        }
        resize(width, height) {
            width = Math.ceil(width);
            height = Math.ceil(height);
            if (width === this._width && height === this._height) {
                return;
            }
            this.valid = (width > 0 && height > 0);
            this._width = width;
            this._height = height;
            this._realWidth = this._width * this.resolution;
            this._realHeight = this._height * this.resolution;
            if (!this.valid) {
                return;
            }
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
        }
        update() {
            if (this.imageType !== 'svg') {
                this._realWidth = this._source['naturalWidth'] || this._source['videoWidth'] || this._source.width;
                this._realHeight = this._source['naturalHeight'] || this._source['videoHeight'] || this._source.height;
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
            this._width = this._realWidth / this.resolution;
            this._height = this._realHeight / this.resolution;
            this._isPowerOfTwo = false;
            if (Utils_1.Utils.isPow2(this._realWidth) && Utils_1.Utils.isPow2(this._realHeight)) {
                this._isPowerOfTwo = true;
            }
        }
        loadSource(source) {
            const wasLoading = this.isLoading;
            this._hasLoaded = false;
            this.isLoading = false;
            if (wasLoading && this._source) {
                this._source.onload = null;
                this._source.onerror = null;
            }
            const firstSourceLoaded = !this._source;
            this._source = source;
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
                    scope.show('loaded');
                    scope._updateImageType();
                    source.onload = null;
                    source.onerror = null;
                    if (!scope.isLoading) {
                        scope.show('already loading');
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
            if (!this._imageUrl) {
                return;
            }
            const dataUri = Utils_1.Utils.decomposeDataUri(this._imageUrl);
            let imageType;
            if (dataUri && dataUri.mediaType === 'image') {
                const firstSubType = dataUri.subType.split('+')[0];
                imageType = Utils_1.Utils.getUrlFileExtension(`.${firstSubType}`);
                if (!imageType) {
                    throw new Error('Invalid image type in data URI.');
                }
            }
            else {
                imageType = Utils_1.Utils.getUrlFileExtension(this._imageUrl);
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
            const dataUri = Utils_1.Utils.decomposeDataUri(this._imageUrl);
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
            svgXhr.open('GET', this._imageUrl, true);
            svgXhr.send();
        }
        _loadSvgSourceUsingString(svgString) {
            const svgSize = Utils_1.Utils.getSvgSize(svgString);
            const svgWidth = svgSize.width;
            const svgHeight = svgSize.height;
            if (!svgWidth || !svgHeight) {
                throw new Error('The SVG image must have width and height defined (in pixels), canvas API needs them.');
            }
            this._realWidth = Math.round(svgWidth * this.sourceScale);
            this._realHeight = Math.round(svgHeight * this.sourceScale);
            this._updateDimensions();
            const canvas = document.createElement('canvas');
            canvas.width = this._realWidth;
            canvas.height = this._realHeight;
            canvas['_pixiId'] = `canvas_${Utils_1.Utils.uid()}`;
            canvas.getContext('2d').drawImage(this._source, 0, 0, svgWidth, svgHeight, 0, 0, this._realWidth, this._realHeight);
            this.origSource = this._source;
            this._source = canvas;
            BaseTexture.addToCache(this, canvas['_pixiId']);
            this.isLoading = false;
            this._sourceLoaded();
            this.dispatchEvent(new Event_1.Event(Event_1.Event.COMPLETE));
        }
        _sourceLoaded() {
            this._hasLoaded = true;
            this.update();
        }
        destroy() {
            if (this._imageUrl) {
                delete BaseTexture.BaseTextureCache[this._imageUrl];
                this._imageUrl = null;
                if (!navigator['isCocoonJS']) {
                    var src = this.getProperty(this._source, 'src');
                    src = '';
                }
            }
            this._source = null;
            this.dispose();
            BaseTexture.removeFromCache(this);
            this._textureCacheIds = null;
            this._destroyed = true;
        }
        dispose() {
            this.dispatchEvent(new Event_1.Event(Event_1.Event.UNLOAD));
        }
        updateSourceImage(newSrc) {
            var src = this.getProperty(this._source, 'src');
            src = newSrc;
            this.loadSource(this._source);
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
            if (id) {
                if (baseTexture._textureCacheIds.indexOf(id) === -1) {
                    baseTexture._textureCacheIds.push(id);
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
                    const index = baseTextureFromCache._textureCacheIds.indexOf(baseTexture);
                    if (index > -1) {
                        baseTextureFromCache._textureCacheIds.splice(index, 1);
                    }
                    delete BaseTexture.BaseTextureCache[baseTexture];
                    return baseTextureFromCache;
                }
            }
            else if (baseTexture && baseTexture._textureCacheIds) {
                for (let i = 0; i < baseTexture._textureCacheIds.length; ++i) {
                    delete BaseTexture.BaseTextureCache[baseTexture._textureCacheIds[i]];
                }
                baseTexture._textureCacheIds.length = 0;
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