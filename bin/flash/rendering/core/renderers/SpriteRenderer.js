define(["require", "exports", "flash/rendering/core/renderers/ObjectRenderer", "flash/rendering/core/gl/Buffer", "flash/rendering/webgl/Utils", "flash/rendering/webgl/CreateIndicesForQuads", "flash/rendering/core/gl/GLBuffer", "flash/rendering/core/BaseObject", "flash/rendering/core/StageSettings", "flash/events/Event"], function (require, exports, ObjectRenderer_1, Buffer_1, Utils_1, CreateIndicesForQuads_1, GLBuffer_1, BaseObject_1, StageSettings_1, Event_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SpriteRenderer extends ObjectRenderer_1.ObjectRenderer {
        constructor() {
            super();
            this.vertSize = 5;
            this.vertByteSize = this.vertSize * 4;
            this.size = StageSettings_1.StageSettings.SPRITE_BATCH_SIZE;
            this.buffers = [];
            for (let i = 1; i <= Utils_1.Utils.nextPow2(this.size); i *= 2) {
                this.buffers.push(new Buffer_1.Buffer(i * 4 * this.vertByteSize));
            }
            this.indices = CreateIndicesForQuads_1.CreateIndicesForQuads.createIndicesForQuads(this.size);
            this.shader = null;
            this.currentIndex = 0;
            this.groups = [];
            for (let k = 0; k < this.size; k++) {
                this.groups[k] = { textures: [], textureCount: 0, ids: [], size: 0, start: 0, blend: 0 };
            }
            this.sprites = [];
            this.vertexBuffers = [];
            this.vaos = [];
            this.vaoMax = 2;
            this.vertexCount = 0;
        }
        static get renderer() {
            if (!SpriteRenderer._spriteRenderer) {
                SpriteRenderer._spriteRenderer = new SpriteRenderer();
            }
            return SpriteRenderer._spriteRenderer;
        }
        onContextChange() {
            if (this.stageContext.canvasLegacy) {
                this.MAX_TEXTURES = 1;
            }
            else {
                this.show('S: ' + StageSettings_1.StageSettings.SPRITE_MAX_TEXTURES);
                this.MAX_TEXTURES = Math.min(this.stageContext.context.getParameter(this.stageContext.context.MAX_TEXTURE_IMAGE_UNITS), StageSettings_1.StageSettings.SPRITE_MAX_TEXTURES);
                this.show('sr: ' + this.MAX_TEXTURES);
                this.MAX_TEXTURES = Utils_1.Utils.checkMaxIfStatmentsInShader(this.MAX_TEXTURES, this.stageContext.context);
            }
            this.shader = Utils_1.Utils.generateMultiTextureShader(this.stageContext.context, this.MAX_TEXTURES);
            this.indexBuffer = GLBuffer_1.GLBuffer.createIndexBuffer(this.stageContext.context, this.indices, this.stageContext.context.STATIC_DRAW);
            this.stageContext.bindVao(null);
            const attrs = this.shader.attributes;
            for (let i = 0; i < this.vaoMax; i++) {
                const vertexBuffer = GLBuffer_1.GLBuffer.createVertexBuffer(this.stageContext.context, null, this.stageContext.context.STREAM_DRAW);
                this.vertexBuffers[i] = vertexBuffer;
                const vao = this.stageContext.createVao()
                    .addIndex(this.indexBuffer)
                    .addAttribute(vertexBuffer, attrs.aVertexPosition, this.stageContext.context.FLOAT, false, this.vertByteSize, 0)
                    .addAttribute(vertexBuffer, attrs.aTextureCoord, this.stageContext.context.UNSIGNED_SHORT, true, this.vertByteSize, 2 * 4)
                    .addAttribute(vertexBuffer, attrs.aColor, this.stageContext.context.UNSIGNED_BYTE, true, this.vertByteSize, 3 * 4);
                if (attrs.aTextureId) {
                    vao.addAttribute(vertexBuffer, attrs.aTextureId, this.stageContext.context.FLOAT, false, this.vertByteSize, 4 * 4);
                }
                this.vaos[i] = vao;
            }
            this.vao = this.vaos[0];
            this.currentBlendMode = 99999;
            this.boundTextures = [];
        }
        onPrerender() {
            this.vertexCount = 0;
        }
        render(sprite) {
            if (this.currentIndex >= this.size) {
                this.flush();
            }
            if (!sprite.texture._uvs) {
                return;
            }
            this.sprites[this.currentIndex++] = sprite;
        }
        flush() {
            if (this.currentIndex === 0) {
                return;
            }
            const MAX_TEXTURES = this.MAX_TEXTURES;
            const np2 = Utils_1.Utils.nextPow2(this.currentIndex);
            const log2 = Utils_1.Utils.log2(np2);
            const buffer = this.buffers[log2];
            const sprites = this.sprites;
            const groups = this.groups;
            const float32View = buffer.float32View;
            const uint32View = buffer.uint32View;
            const boundTextures = this.boundTextures;
            const rendererBoundTextures = this.stageContext.boundTextures;
            const touch = this.stageContext.textureGCCount;
            let index = 0;
            let nextTexture;
            let currentTexture;
            let groupCount = 1;
            let textureCount = 0;
            let currentGroup = groups[0];
            let vertexData;
            let uvs;
            let globalmodes = Utils_1.Utils.mapPremultipliedBlendModes();
            let bitmap = sprites[0];
            let blendcategory = globalmodes[bitmap.texture.baseTexture.premultipliedAlpha ? 1 : 0];
            let blendindex = bitmap.blendMode;
            let blendMode = blendcategory[blendindex];
            if (!blendMode) {
                blendMode = blendcategory[0];
            }
            currentGroup.textureCount = 0;
            currentGroup.start = 0;
            currentGroup.blend = blendMode;
            SpriteRenderer.TICK++;
            let i;
            for (i = 0; i < MAX_TEXTURES; ++i) {
                const bt = rendererBoundTextures[i];
                if (bt._enabled === SpriteRenderer.TICK) {
                    boundTextures[i] = this.stageContext.emptyTextures[i];
                    continue;
                }
                boundTextures[i] = bt;
                bt._virtalBoundId = i;
                bt._enabled = SpriteRenderer.TICK;
            }
            SpriteRenderer.TICK++;
            for (i = 0; i < this.currentIndex; ++i) {
                const sprite = sprites[i];
                nextTexture = sprite.texture.baseTexture;
                var spriteBlendMode = globalmodes[Number(nextTexture.premultipliedAlpha)][sprite.blendMode];
                if (!spriteBlendMode) {
                    spriteBlendMode = 0;
                }
                if (blendMode !== spriteBlendMode) {
                    blendMode = spriteBlendMode;
                    currentTexture = null;
                    textureCount = MAX_TEXTURES;
                    SpriteRenderer.TICK++;
                }
                if (currentTexture !== nextTexture) {
                    currentTexture = nextTexture;
                    if (nextTexture._enabled !== SpriteRenderer.TICK) {
                        if (textureCount === MAX_TEXTURES) {
                            SpriteRenderer.TICK++;
                            currentGroup.size = i - currentGroup.start;
                            textureCount = 0;
                            currentGroup = groups[groupCount++];
                            currentGroup.blend = blendMode;
                            currentGroup.textureCount = 0;
                            currentGroup.start = i;
                        }
                        nextTexture.touched = touch;
                        if (nextTexture._virtalBoundId === -1) {
                            for (let j = 0; j < MAX_TEXTURES; ++j) {
                                const tIndex = (j + SpriteRenderer.TEXTURE_TICK) % MAX_TEXTURES;
                                const t = boundTextures[tIndex];
                                if (t._enabled !== SpriteRenderer.TICK) {
                                    SpriteRenderer.TEXTURE_TICK++;
                                    t._virtalBoundId = -1;
                                    nextTexture._virtalBoundId = tIndex;
                                    boundTextures[tIndex] = nextTexture;
                                    break;
                                }
                            }
                        }
                        nextTexture._enabled = SpriteRenderer.TICK;
                        currentGroup.textureCount++;
                        currentGroup.ids[textureCount] = nextTexture._virtalBoundId;
                        currentGroup.textures[textureCount++] = nextTexture;
                    }
                }
                vertexData = sprite.vertexData;
                uvs = sprite.texture._uvs.uvsUint32;
                if (this.stageContext.canvasRoundPixels) {
                    const resolution = this.stageContext.canvasResolution;
                    float32View[index] = ((vertexData[0] * resolution) | 0) / resolution;
                    float32View[index + 1] = ((vertexData[1] * resolution) | 0) / resolution;
                    float32View[index + 5] = ((vertexData[2] * resolution) | 0) / resolution;
                    float32View[index + 6] = ((vertexData[3] * resolution) | 0) / resolution;
                    float32View[index + 10] = ((vertexData[4] * resolution) | 0) / resolution;
                    float32View[index + 11] = ((vertexData[5] * resolution) | 0) / resolution;
                    float32View[index + 15] = ((vertexData[6] * resolution) | 0) / resolution;
                    float32View[index + 16] = ((vertexData[7] * resolution) | 0) / resolution;
                }
                else {
                    float32View[index] = vertexData[0];
                    float32View[index + 1] = vertexData[1];
                    float32View[index + 5] = vertexData[2];
                    float32View[index + 6] = vertexData[3];
                    float32View[index + 10] = vertexData[4];
                    float32View[index + 11] = vertexData[5];
                    float32View[index + 15] = vertexData[6];
                    float32View[index + 16] = vertexData[7];
                }
                uint32View[index + 2] = uvs[0];
                uint32View[index + 7] = uvs[1];
                uint32View[index + 12] = uvs[2];
                uint32View[index + 17] = uvs[3];
                const alpha = Math.min(sprite.worldAlpha, 1.0);
                const argb = alpha < 1.0 && nextTexture.premultipliedAlpha ? Utils_1.Utils.premultiplyTint(sprite._tintRGB, alpha)
                    : sprite._tintRGB + (alpha * 255 << 24);
                uint32View[index + 3] = uint32View[index + 8] = uint32View[index + 13] = uint32View[index + 18] = argb;
                float32View[index + 4] = float32View[index + 9] = float32View[index + 14] = float32View[index + 19] = nextTexture._virtalBoundId;
                index += 20;
            }
            currentGroup.size = i - currentGroup.start;
            if (!StageSettings_1.StageSettings.CAN_UPLOAD_SAME_BUFFER) {
                if (this.vaoMax <= this.vertexCount) {
                    this.vaoMax++;
                    const attrs = this.shader.attributes;
                    const vertexBuffer = this.vertexBuffers[this.vertexCount] = GLBuffer_1.GLBuffer.createVertexBuffer(this.stageContext.context, null, this.stageContext.context.STREAM_DRAW);
                    const vao = this.stageContext.createVao()
                        .addIndex(this.indexBuffer)
                        .addAttribute(vertexBuffer, attrs.aVertexPosition, this.stageContext.context.FLOAT, false, this.vertByteSize, 0)
                        .addAttribute(vertexBuffer, attrs.aTextureCoord, this.stageContext.context.UNSIGNED_SHORT, true, this.vertByteSize, 2 * 4)
                        .addAttribute(vertexBuffer, attrs.aColor, this.stageContext.context.UNSIGNED_BYTE, true, this.vertByteSize, 3 * 4);
                    if (attrs.aTextureId) {
                        vao.addAttribute(vertexBuffer, attrs.aTextureId, this.stageContext.context.FLOAT, false, this.vertByteSize, 4 * 4);
                    }
                    this.vaos[this.vertexCount] = vao;
                }
                this.stageContext.bindVao(this.vaos[this.vertexCount]);
                this.vertexBuffers[this.vertexCount].upload(buffer.vertices, 0, false);
                this.vertexCount++;
            }
            else {
                this.vertexBuffers[this.vertexCount].upload(buffer.vertices, 0, true);
            }
            for (i = 0; i < MAX_TEXTURES; ++i) {
                rendererBoundTextures[i]._virtalBoundId = -1;
            }
            for (i = 0; i < groupCount; ++i) {
                const group = groups[i];
                const groupTextureCount = group.textureCount;
                for (let j = 0; j < groupTextureCount; j++) {
                    currentTexture = group.textures[j];
                    if (rendererBoundTextures[group.ids[j]] !== currentTexture) {
                        this.stageContext.bindTexture(currentTexture, group.ids[j], true);
                    }
                    currentTexture._virtalBoundId = -1;
                }
                this.stageContext.getRenderState().setBlendMode(group.blend);
                this.stageContext.context.drawElements(this.stageContext.context.TRIANGLES, group.size * 6, this.stageContext.context.UNSIGNED_SHORT, group.start * 6 * 2);
            }
            this.currentIndex = 0;
        }
        start() {
            if (!this.shader) {
                this.onContextChange();
            }
            this.onPrerender();
            this.stageContext.bindShader(this.shader);
            if (Utils_1.Utils.canUploadSameBuffer()) {
                this.stageContext.bindVao(this.vaos[this.vertexCount]);
                this.vertexBuffers[this.vertexCount].bind();
            }
        }
        stop() {
            this.flush();
        }
        destroy() {
            for (let i = 0; i < this.vaoMax; i++) {
                if (this.vertexBuffers[i]) {
                    this.vertexBuffers[i].destroy();
                }
                if (this.vaos[i]) {
                    this.vaos[i].destroy();
                }
            }
            if (this.indexBuffer) {
                this.indexBuffer.destroy();
            }
            if (this.stageContext) {
                this.stageContext.removeEventListener(Event_1.Event.RENDER, this.onPrerender);
            }
            super.destroy();
            if (this.shader) {
                this.shader.destroy();
                this.shader = null;
            }
            this.stageContext = null;
            this.vertexBuffers = null;
            this.vaos = null;
            this.indexBuffer = null;
            this.indices = null;
            this.sprites = null;
            for (let i = 0; i < this.buffers.length; ++i) {
                this.buffers[i].destroy();
            }
        }
    }
    SpriteRenderer.TICK = 0;
    SpriteRenderer.TEXTURE_TICK = 0;
    exports.SpriteRenderer = SpriteRenderer;
    class TextureGroupItem extends BaseObject_1.BaseObject {
        constructor() {
            super();
            this.textureCount = 0;
            this.size = 0;
            this.start = 0;
            this.blend = 0;
            this.textures = [];
            this.ids = [];
        }
    }
});
