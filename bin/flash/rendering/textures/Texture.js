define(["require", "exports", "flash/geom/Rectangle", "./BaseTexture", "../webgl/TextureUvs", "../webgl/Utils", "./VideoBaseTexture", "flash/events/EventDispatcher", "flash/events/Event", "flash/rendering/core/StageSettings"], function (require, exports, Rectangle_1, BaseTexture_1, TextureUvs_1, Utils_1, VideoBaseTexture_1, EventDispatcher_1, Event_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Texture extends EventDispatcher_1.EventDispatcher {
        constructor(baseTexture = null, frame = null, orig = null, trim = null, rotate = false) {
            super();
            this.noFrame = false;
            if (!frame) {
                this.noFrame = true;
                frame = new Rectangle_1.Rectangle(0, 0, 1, 1);
            }
            if (baseTexture instanceof Texture) {
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
            if (rotate === true) {
                this._rotate = 2;
            }
            else if (this._rotate % 2 !== 0) {
                throw new Error('attempt to use diamond-shaped UVs. If you are sure, set rotation manually');
            }
            if (baseTexture.hasLoaded) {
                if (this.noFrame) {
                    frame = new Rectangle_1.Rectangle(0, 0, baseTexture.width, baseTexture.height);
                    baseTexture.addEventListener(Event_1.Event.CHANGE, this.onBaseTextureUpdated, this);
                }
                this.frame = frame;
            }
            else {
                baseTexture.addEventListener(Event_1.Event.COMPLETE, this.onBaseTextureLoaded, this);
            }
            this._updateID = 0;
            this.transform = null;
            this.textureCacheIds = [];
        }
        static get WHITE() {
            if (!Texture._WHITE) {
                Texture._WHITE = Texture.createWhiteTexture();
            }
            return Texture._WHITE;
        }
        static get EMPTY() {
            if (!Texture._EMPTY) {
                Texture._EMPTY = new Texture(new BaseTexture_1.BaseTexture());
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
        update() {
            this.baseTexture.update();
        }
        onBaseTextureLoaded(event) {
            this.baseTexture.removeEventListener(Event_1.Event.COMPLETE, this.onBaseTextureLoaded);
            this.show("base texture loaded");
            this._updateID++;
            if (this.noFrame) {
                this.frame = new Rectangle_1.Rectangle(0, 0, this.baseTexture.width, this.baseTexture.height);
            }
            else {
                this.frame = this._frame;
            }
            this.baseTexture.addEventListener(Event_1.Event.CHANGE, this.onBaseTextureUpdated, this);
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
        }
        onBaseTextureUpdated(event) {
            this.baseTexture.removeEventListener(Event_1.Event.CHANGE, this.onBaseTextureUpdated);
            this._updateID++;
            this._frame.width = this.baseTexture.width;
            this._frame.height = this.baseTexture.height;
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
        }
        destroy(destroyBase) {
            if (this.baseTexture) {
                if (destroyBase) {
                    if (BaseTexture_1.BaseTexture.TextureCache[this.baseTexture.imageUrl]) {
                        Texture.removeFromCache(this.baseTexture.imageUrl);
                    }
                    this.baseTexture.destroy();
                }
                this.baseTexture.removeEventListener(Event_1.Event.COMPLETE, this.onBaseTextureLoaded);
                this.baseTexture.removeEventListener(Event_1.Event.CHANGE, this.onBaseTextureUpdated);
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
        clone() {
            var rotating = false;
            if (this.rotate != 0) {
                rotating = true;
            }
            return new Texture(this.baseTexture, this.frame, this.orig, this.trim, rotating);
        }
        _updateUvs() {
            if (!this._uvs) {
                this._uvs = new TextureUvs_1.TextureUvs();
            }
            this._uvs.set(this._frame, this.baseTexture.frame, this.rotate);
            this._updateID++;
        }
        static fromImage(imageUrl, crossorigin = false, scaleMode = StageSettings_1.StageSettings.SCALE_MODE, sourceScale = StageSettings_1.StageSettings.SCALE_MODE) {
            let texture = BaseTexture_1.BaseTexture.TextureCache[imageUrl];
            if (!texture) {
                texture = new Texture(BaseTexture_1.BaseTexture.fromImage(imageUrl, crossorigin, scaleMode, sourceScale));
                Texture.addToCache(texture, imageUrl);
            }
            return texture;
        }
        static fromFrame(frameId) {
            const texture = BaseTexture_1.BaseTexture.TextureCache[frameId];
            if (!texture) {
                throw new Error(`The frameId "${frameId}" does not exist in the texture cache`);
            }
            return texture;
        }
        static fromCanvas(canvas, scaleMode, origin = 'canvas') {
            return new Texture(BaseTexture_1.BaseTexture.fromCanvas(canvas, scaleMode, origin));
        }
        static fromVideo(video, scaleMode = null) {
            if (typeof video === 'string') {
                return Texture.fromVideoUrl(video, scaleMode);
            }
            return new Texture(VideoBaseTexture_1.VideoBaseTexture.fromVideo(video, scaleMode));
        }
        static fromVideoUrl(videoUrl, scaleMode = null) {
            return new Texture(VideoBaseTexture_1.VideoBaseTexture.fromUrl(videoUrl, scaleMode));
        }
        static from(source) {
            if (typeof source === 'string') {
                const texture = BaseTexture_1.BaseTexture.TextureCache[source];
                if (!texture) {
                    const isVideo = source.match(/\.(mp4|webm|ogg|h264|avi|mov)$/) !== null;
                    if (isVideo) {
                        return Texture.fromVideoUrl(source);
                    }
                    return Texture.fromImage(source);
                }
                return texture;
            }
            else if (source instanceof HTMLImageElement) {
                return new Texture(BaseTexture_1.BaseTexture.from(source));
            }
            else if (source instanceof HTMLCanvasElement) {
                return Texture.fromCanvas(source, StageSettings_1.StageSettings.SCALE_MODE, 'HTMLCanvasElement');
            }
            else if (source instanceof HTMLVideoElement) {
                return Texture.fromVideo(source);
            }
            else if (source instanceof BaseTexture_1.BaseTexture) {
                return new Texture(source);
            }
            return null;
        }
        static fromLoader(source, imageUrl, name) {
            const baseTexture = new BaseTexture_1.BaseTexture(source, undefined, Utils_1.Utils.getResolutionOfUrl(imageUrl));
            const texture = new Texture(baseTexture);
            baseTexture.imageUrl = imageUrl;
            if (!name) {
                name = imageUrl;
            }
            BaseTexture_1.BaseTexture.addToCache(texture.baseTexture, name);
            Texture.addToCache(texture, name);
            if (name !== imageUrl) {
                BaseTexture_1.BaseTexture.addToCache(texture.baseTexture, imageUrl);
                Texture.addToCache(texture, imageUrl);
            }
            return texture;
        }
        static addToCache(texture, id) {
            if (id) {
                if (texture.textureCacheIds.indexOf(id) === -1) {
                    texture.textureCacheIds.push(id);
                }
                if (BaseTexture_1.BaseTexture.TextureCache[id]) {
                    console.warn(`Texture added to the cache with an id [${id}] that already had an entry`);
                }
                BaseTexture_1.BaseTexture.TextureCache[id] = texture;
            }
        }
        static removeFromCache(texture) {
            if (typeof texture === 'string') {
                const textureFromCache = BaseTexture_1.BaseTexture.TextureCache[texture];
                if (textureFromCache) {
                    const index = textureFromCache.textureCacheIds.indexOf(texture);
                    if (index > -1) {
                        textureFromCache.textureCacheIds.splice(index, 1);
                    }
                    delete BaseTexture_1.BaseTexture.TextureCache[texture];
                    return textureFromCache;
                }
            }
            else if (texture && texture.textureCacheIds) {
                for (let i = 0; i < texture.textureCacheIds.length; ++i) {
                    if (BaseTexture_1.BaseTexture.TextureCache[texture.textureCacheIds[i]] === texture) {
                        delete BaseTexture_1.BaseTexture.TextureCache[texture.textureCacheIds[i]];
                    }
                }
                texture.textureCacheIds.length = 0;
                return texture;
            }
            return null;
        }
        get frame() {
            return this._frame;
        }
        set frame(frame) {
            this._frame = frame;
            this.noFrame = false;
            const { x, y, width, height } = frame;
            const xNotFit = x + width > this.baseTexture.width;
            const yNotFit = y + height > this.baseTexture.height;
            if (xNotFit || yNotFit) {
                const relationship = xNotFit && yNotFit ? 'and' : 'or';
                const errorX = `X: ${x} + ${width} = ${x + width} > ${this.baseTexture.width}`;
                const errorY = `Y: ${y} + ${height} = ${y + height} > ${this.baseTexture.height}`;
                throw new Error('Texture Error: frame does not fit inside the base Texture dimensions: '
                    + `${errorX} ${relationship} ${errorY}`);
            }
            this.valid = width && height && this.baseTexture.hasLoaded;
            if (!this.trim && !this.rotate) {
                this.orig = frame;
            }
            if (this.valid) {
                this._updateUvs();
            }
        }
        get rotate() {
            return this._rotate;
        }
        set rotate(rotate) {
            this._rotate = rotate;
            if (this.valid) {
                this._updateUvs();
            }
        }
        get width() {
            return this.orig.width;
        }
        get height() {
            return this.orig.height;
        }
        static createWhiteTexture(width = 100, height = 100) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.fillStyle = 'white';
            context.fillRect(0, 0, width, height);
            return new Texture(new BaseTexture_1.BaseTexture(canvas));
        }
        static createRedTexture(width = 10, height = 10) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d');
            context.fillStyle = 'red';
            context.fillRect(0, 0, width, height);
            return new Texture(new BaseTexture_1.BaseTexture(canvas));
        }
        static removeAllHandlers(tex) {
            tex.destroy = function _emptyDestroy() { };
            //tex.on = function _emptyOn() { /* empty */ };
            //tex.once = function _emptyOnce() { /* empty */ };
            //tex.emit = null;
        }
    }
    exports.Texture = Texture;
});
