define(["require", "exports", "flash/geom/Rectangle", "flash/display3D/textures/BaseTexture", "../webgl/TextureUvs", "flash/rendering/webgl/Utils", "flash/display3D/textures/VideoBaseTexture", "flash/events/EventDispatcher", "flash/events/Event", "flash/display/StageSettings"], function (require, exports, Rectangle_1, BaseTexture_1, TextureUvs_1, Utils_1, VideoBaseTexture_1, EventDispatcher_1, Event_1, StageSettings_1) {
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
            this._baseTexture = baseTexture;
            this._frame = frame;
            this._trim = trim;
            this._valid = false;
            this.requiresUpdate = false;
            this._uvs = null;
            this._orig = orig || frame;
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
        set valid(value) {
            this._valid = value;
        }
        get valid() {
            return this._valid;
        }
        get frame() {
            return this._frame;
        }
        get updateID() {
            return this._updateID;
        }
        get orig() {
            return this._orig;
        }
        set orig(value) {
            this._orig = value;
        }
        get uvs() {
            return this._uvs;
        }
        set trim(value) {
            this._trim = value;
        }
        get trim() {
            return this._trim;
        }
        get baseTexture() {
            return this._baseTexture;
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
        update() {
            this._baseTexture.update();
        }
        onBaseTextureLoaded(event) {
            this._baseTexture.removeEventListener(Event_1.Event.COMPLETE, this.onBaseTextureLoaded);
            this._updateID++;
            if (this.noFrame) {
                this.frame = new Rectangle_1.Rectangle(0, 0, this._baseTexture.width, this._baseTexture.height);
            }
            else {
                this.frame = this._frame;
            }
            this._baseTexture.addEventListener(Event_1.Event.CHANGE, this.onBaseTextureUpdated, this);
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
        }
        onBaseTextureUpdated(event) {
            this._baseTexture.removeEventListener(Event_1.Event.CHANGE, this.onBaseTextureUpdated);
            this._updateID++;
            this._frame.width = this._baseTexture.width;
            this._frame.height = this._baseTexture.height;
            this.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
        }
        destroy() {
            if (this._baseTexture) {
                if (BaseTexture_1.BaseTexture.TextureCache[this._baseTexture.imageUrl]) {
                    Texture.removeFromCache(this._baseTexture.imageUrl);
                }
                this._baseTexture.destroy();
                this._baseTexture.removeEventListener(Event_1.Event.COMPLETE, this.onBaseTextureLoaded);
                this._baseTexture.removeEventListener(Event_1.Event.CHANGE, this.onBaseTextureUpdated);
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
        clone() {
            var rotating = false;
            if (this.rotate != 0) {
                rotating = true;
            }
            return new Texture(this._baseTexture, this.frame, this._orig, this._trim, rotating);
        }
        _updateUvs() {
            if (!this._uvs) {
                this._uvs = new TextureUvs_1.TextureUvs();
            }
            this._uvs.set(this._frame, this._baseTexture.frame, this.rotate);
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
            BaseTexture_1.BaseTexture.addToCache(texture._baseTexture, name);
            Texture.addToCache(texture, name);
            if (name !== imageUrl) {
                BaseTexture_1.BaseTexture.addToCache(texture._baseTexture, imageUrl);
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
        set frame(frame) {
            this._frame = frame;
            this.noFrame = false;
            const xNotFit = this._frame.x + this._frame.width > this._baseTexture.width;
            const yNotFit = this._frame.y + this._frame.height > this._baseTexture.height;
            if (xNotFit || yNotFit) {
                const relationship = xNotFit && yNotFit ? 'and' : 'or';
                const errorX = `X: ${this._frame.x} + ${this._frame.width} = ${this._frame.x + this._frame.width} > ${this._baseTexture.width}`;
                const errorY = `Y: ${this._frame.y} + ${this._frame.height} = ${this._frame.y + this._frame.height} > ${this._baseTexture.height}`;
                throw new Error('Texture Error: frame does not fit inside the base Texture dimensions: ' + `${errorX} ${relationship} ${errorY}`);
            }
            this._valid = this._frame.width && this._frame.height && this._baseTexture.hasLoaded;
            if (!this._trim && !this.rotate) {
                this._orig = frame;
            }
            if (this._valid) {
                this._updateUvs();
            }
        }
        get rotate() {
            return this._rotate;
        }
        set rotate(rotate) {
            this._rotate = rotate;
            if (this._valid) {
                this._updateUvs();
            }
        }
        get width() {
            return this._orig.width;
        }
        get height() {
            return this._orig.height;
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
    }
    exports.Texture = Texture;
});
//# sourceMappingURL=Texture.js.map