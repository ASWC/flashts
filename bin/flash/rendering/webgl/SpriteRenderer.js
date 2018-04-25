define(["require", "exports", "flash/rendering/core/renderers/ObjectRenderer", "../Settings", "./Buffer", "./Utils", "./CreateIndicesForQuads", "./GLBuffer"], function (require, exports, ObjectRenderer_1, Settings_1, Buffer_1, Utils_1, CreateIndicesForQuads_1, GLBuffer_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class SpriteRenderer extends ObjectRenderer_1.ObjectRenderer {
        constructor(renderer = null) {
            super(null);
            this.vertSize = 5;
            this.vertByteSize = this.vertSize * 4;
            this.size = Settings_1.Settings.SPRITE_BATCH_SIZE; // 2000 is a nice balance between mobile / desktop
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
            this.vaoMax = 2;
            this.vertexCount = 0;
            if (this.renderer) {
                this.renderer.on('prerender', this.onPrerender, this);
            }
            this.MAX_TEXTURES = 1;
            this.sprites = [];
            this.vertexBuffers = [];
            this.vaos = [];
        }
        static get renderer() {
            if (!SpriteRenderer._spriteRenderer) {
                SpriteRenderer._spriteRenderer = new SpriteRenderer();
            }
            return SpriteRenderer._spriteRenderer;
        }
        onContextChange() {
            if (!this._context) {
                return;
            }
            const gl = this._context.gl;
            if (this._context.legacy) {
                this.MAX_TEXTURES = 1;
            }
            else {
                this.MAX_TEXTURES = Math.min(gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS), Settings_1.Settings.SPRITE_MAX_TEXTURES);
                this.MAX_TEXTURES = Utils_1.Utils.checkMaxIfStatmentsInShader(this.MAX_TEXTURES, gl);
            }
            this.shader = Utils_1.Utils.generateMultiTextureShader(gl, this.MAX_TEXTURES);
            this.indexBuffer = GLBuffer_1.GLBuffer.createIndexBuffer(gl, this.indices, gl.STATIC_DRAW);
            this._context.bindVao(null);
            const attrs = this.shader.attributes;
            for (let i = 0; i < this.vaoMax; i++) {
                const vertexBuffer = this.vertexBuffers[i] = GLBuffer_1.GLBuffer.createVertexBuffer(gl, null, gl.STREAM_DRAW);
                const vao = this._context.createVao()
                    .addIndex(this.indexBuffer)
                    .addAttribute(vertexBuffer, attrs.aVertexPosition, gl.FLOAT, false, this.vertByteSize, 0)
                    .addAttribute(vertexBuffer, attrs.aTextureCoord, gl.UNSIGNED_SHORT, true, this.vertByteSize, 2 * 4)
                    .addAttribute(vertexBuffer, attrs.aColor, gl.UNSIGNED_BYTE, true, this.vertByteSize, 3 * 4);
                if (attrs.aTextureId) {
                    vao.addAttribute(vertexBuffer, attrs.aTextureId, gl.FLOAT, false, this.vertByteSize, 4 * 4);
                }
                this.vaos[i] = vao;
            }
            this.vao = this.vaos[0];
            this.currentBlendMode = 99999;
            this.boundTextures = new Array(this.MAX_TEXTURES);
        }
        onPrerender() {
            this.vertexCount = 0;
        }
        render(sprite) {
            if (this.currentIndex >= this.size) {
                this.flush();
            }
            if (!sprite._texture._uvs) {
                return;
            }
            this.sprites[this.currentIndex++] = sprite;
        }
        flush() {
            if (!this._context) {
                return;
            }
            if (this.currentIndex === 0) {
                return;
            }
            const gl = this._context.gl;
            const MAX_TEXTURES = this.MAX_TEXTURES;
            const np2 = Utils_1.Utils.nextPow2(this.currentIndex);
            const log2 = Utils_1.Utils.log2(np2);
            const buffer = this.buffers[log2];
            const sprites = this.sprites;
            const groups = this.groups;
            const float32View = buffer.float32View;
            const uint32View = buffer.uint32View;
            const boundTextures = [];
            const rendererBoundTextures = this._context.boundTextures;
            const touch = this.renderer.textureGC.count;
            let index = 0;
            let nextTexture;
            let currentTexture;
            let groupCount = 1;
            let textureCount = 0;
            let currentGroup = groups[0];
            let vertexData;
            let uvs;
            let blendMode = Utils_1.Utils.mapPremultipliedBlendModes()[sprites[0]._texture.baseTexture.premultipliedAlpha ? 1 : 0][sprites[0].blendMode];
            currentGroup.textureCount = 0;
            currentGroup.start = 0;
            currentGroup.blend = blendMode;
            SpriteRenderer.TICK++;
            let i;
            for (i = 0; i < MAX_TEXTURES; ++i) {
                const bt = rendererBoundTextures[i];
                if (bt._enabled === SpriteRenderer.TICK) {
                    boundTextures[i] = this.renderer.emptyTextures[i];
                    continue;
                }
                boundTextures[i] = bt;
                bt._virtalBoundId = i;
                bt._enabled = SpriteRenderer.TICK;
            }
            SpriteRenderer.TICK++;
            for (i = 0; i < this.currentIndex; ++i) {
                const sprite = sprites[i];
                nextTexture = sprite._texture.baseTexture;
                const spriteBlendMode = Utils_1.Utils.mapPremultipliedBlendModes()[Number(nextTexture.premultipliedAlpha)][sprite.blendMode];
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
                uvs = sprite._texture._uvs.uvsUint32;
                if (this.renderer.roundPixels) {
                    const resolution = this._context.resolution;
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
            if (!Settings_1.Settings.CAN_UPLOAD_SAME_BUFFER) {
                if (this.vaoMax <= this.vertexCount) {
                    this.vaoMax++;
                    const attrs = this.shader.attributes;
                    const vertexBuffer = this.vertexBuffers[this.vertexCount] = GLBuffer_1.GLBuffer.createVertexBuffer(gl, null, gl.STREAM_DRAW);
                    const vao = this._context.createVao()
                        .addIndex(this.indexBuffer)
                        .addAttribute(vertexBuffer, attrs.aVertexPosition, gl.FLOAT, false, this.vertByteSize, 0)
                        .addAttribute(vertexBuffer, attrs.aTextureCoord, gl.UNSIGNED_SHORT, true, this.vertByteSize, 2 * 4)
                        .addAttribute(vertexBuffer, attrs.aColor, gl.UNSIGNED_BYTE, true, this.vertByteSize, 3 * 4);
                    if (attrs.aTextureId) {
                        vao.addAttribute(vertexBuffer, attrs.aTextureId, gl.FLOAT, false, this.vertByteSize, 4 * 4);
                    }
                    this.vaos[this.vertexCount] = vao;
                }
                this._context.bindVao(this.vaos[this.vertexCount]);
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
                        this._context.bindTexture(currentTexture, group.ids[j], true);
                    }
                    currentTexture._virtalBoundId = -1;
                }
                this._context.state.setBlendMode(group.blend);
                gl.drawElements(gl.TRIANGLES, group.size * 6, gl.UNSIGNED_SHORT, group.start * 6 * 2);
            }
            this.currentIndex = 0;
        }
        start() {
            if (!this._context) {
                return;
            }
            this._context.bindShader(this.shader);
            if (Settings_1.Settings.CAN_UPLOAD_SAME_BUFFER) {
                this._context.bindVao(this.vaos[this.vertexCount]);
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
            if (this._context) {
                this._context.off('prerender', this.onPrerender, this);
            }
            super.destroy();
            if (this.shader) {
                this.shader.destroy();
                this.shader = null;
            }
            this._context = null;
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
});
