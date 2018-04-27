define(["require", "exports", "../webgl/RenderTarget", "flash/rendering/core/gl/GLTexture", "../webgl/Utils", "../managers/Constants", "./Texture", "flash/display/BaseObject", "flash/events/Event"], function (require, exports, RenderTarget_1, GLTexture_1, Utils_1, Constants_1, Texture_1, BaseObject_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextureManager extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this._managedTextures = [];
        }
        bindTexture() {
        }
        getTexture() {
            return null;
        }
        updateTexture(texture, location) {
            if (!this.stage) {
                return;
            }
            const isRenderTexture = !!texture._glRenderTargets;
            if (!texture.hasLoaded) {
                return null;
            }
            const boundTextures = this.stage.boundTextures;
            if (location === undefined) {
                location = 0;
                for (let i = 0; i < boundTextures.length; ++i) {
                    if (boundTextures[i] === texture) {
                        location = i;
                        break;
                    }
                }
            }
            boundTextures[location] = texture;
            this.stage.context.activeTexture(this.stage.context.TEXTURE0 + location);
            let glTexture = texture._glTextures[this.stage.getContextID()];
            if (!glTexture) {
                if (isRenderTexture) {
                    const renderTarget = new RenderTarget_1.RenderTarget(this.stage.context, texture.width, texture.height, texture.scaleMode, texture.resolution);
                    renderTarget.resize(texture.width, texture.height);
                    texture._glRenderTargets[this.stage.getContextID()] = renderTarget;
                    glTexture = renderTarget.texture;
                }
                else {
                    var textsource = texture.source;
                    glTexture = new GLTexture_1.GLTexture(this.stage.context);
                    glTexture.bind(location);
                    glTexture.premultiplyAlpha = true;
                    glTexture.upload(textsource);
                }
                texture._glTextures[this.stage.getContextID()] = glTexture;
                texture.removeEventListener(Event_1.Event.CHANGE, this.updateTexture);
                texture.removeEventListener(Event_1.Event.UNLOAD, this.destroyTexture);
                this._managedTextures.push(texture);
                if (texture.isPowerOfTwo) {
                    if (texture.mipmap) {
                        glTexture.enableMipmap();
                    }
                    if (texture.wrapMode === Constants_1.Constants.WRAP_MODES.CLAMP) {
                        glTexture.enableWrapClamp();
                    }
                    else if (texture.wrapMode === Constants_1.Constants.WRAP_MODES.REPEAT) {
                        glTexture.enableWrapRepeat();
                    }
                    else {
                        glTexture.enableWrapMirrorRepeat();
                    }
                }
                else {
                    glTexture.enableWrapClamp();
                }
                if (texture.scaleMode === Constants_1.Constants.SCALE_MODES.NEAREST) {
                    glTexture.enableNearestScaling();
                }
                else {
                    glTexture.enableLinearScaling();
                }
            }
            else if (isRenderTexture) {
                texture._glRenderTargets[this.stage.getContextID()].resize(texture.width, texture.height);
            }
            else {
                var textsource = texture.source;
                glTexture.upload(textsource);
            }
            return glTexture;
        }
        destroyTexture(value, skipRemove) {
            var text = value;
            var basetext;
            if (text instanceof Texture_1.Texture) {
                basetext = text.baseTexture;
            }
            else {
                basetext = text;
            }
            if (!basetext.hasLoaded) {
                return;
            }
            const uid = this.stage.getContextID();
            const glTextures = basetext._glTextures;
            const glRenderTargets = basetext._glRenderTargets;
            if (glTextures[uid]) {
                this.stage.unbindTexture(basetext);
                glTextures[uid].destroy();
                basetext.removeEventListener(Event_1.Event.CHANGE, this.updateTexture);
                basetext.removeEventListener(Event_1.Event.UNLOAD, this.destroyTexture);
                delete glTextures[uid];
                if (!skipRemove) {
                    const i = this._managedTextures.indexOf(basetext);
                    if (i !== -1) {
                        Utils_1.Utils.removeItems(this._managedTextures, i, 1);
                    }
                }
            }
            if (glRenderTargets && glRenderTargets[uid]) {
                glRenderTargets[uid].destroy();
                delete glRenderTargets[uid];
            }
        }
        removeAll() {
            for (let i = 0; i < this._managedTextures.length; ++i) {
                const texture = this._managedTextures[i];
                if (texture._glTextures[this.stage.getContextID()]) {
                    delete texture._glTextures[this.stage.getContextID()];
                }
            }
        }
        destroy() {
            for (let i = 0; i < this._managedTextures.length; ++i) {
                const texture = this._managedTextures[i];
                this.destroyTexture(texture, true);
                texture.removeEventListener(Event_1.Event.CHANGE, this.updateTexture);
                texture.removeEventListener(Event_1.Event.UNLOAD, this.destroyTexture);
            }
            this._managedTextures = null;
        }
    }
    exports.TextureManager = TextureManager;
});
//# sourceMappingURL=TextureManager.js.map