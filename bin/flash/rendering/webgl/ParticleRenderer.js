define(["require", "exports", "flash/rendering/core/renderers/ObjectRenderer", "../../geom/Matrix", "./Utils", "./ParticleBuffer", "flash/display/Bitmap"], function (require, exports, ObjectRenderer_1, Matrix_1, Utils_1, ParticleBuffer_1, Bitmap_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ParticleRenderer extends ObjectRenderer_1.ObjectRenderer {
        constructor() {
            super();
            this.shader = null;
            this.indexBuffer = null;
            this.properties = null;
            this.tempMatrix = new Matrix_1.Matrix();
            this.CONTEXT_UID = 0;
        }
        static get renderer() {
            if (!ParticleRenderer._particleRender) {
                ParticleRenderer._particleRender = new ParticleRenderer();
            }
            return ParticleRenderer._particleRender;
        }
        onContextChange() {
            /*const gl = this.renderer.gl;
            this.CONTEXT_UID = this.renderer.CONTEXT_UID;
            this.shader = new ParticleShader(gl);
            this.properties = [
                {
                    attribute: this.shader.attributes.aVertexPosition,
                    size: 2,
                    uploadFunction: this.uploadVertices,
                    offset: 0,
                },
                {
                    attribute: this.shader.attributes.aPositionCoord,
                    size: 2,
                    uploadFunction: this.uploadPosition,
                    offset: 0,
                },
                {
                    attribute: this.shader.attributes.aRotation,
                    size: 1,
                    uploadFunction: this.uploadRotation,
                    offset: 0,
                },
                {
                    attribute: this.shader.attributes.aTextureCoord,
                    size: 2,
                    uploadFunction: this.uploadUvs,
                    offset: 0,
                },
                {
                    attribute: this.shader.attributes.aColor,
                    size: 1,
                    unsignedByte: true,
                    uploadFunction: this.uploadTint,
                    offset: 0,
                },
            ];*/
        }
        start() {
            /*this.renderer.bindShader(this.shader);*/
        }
        render(container) {
            /* if(container instanceof ParticleContainer)
             {
                 const children = container.getChildren();
                 const maxSize = container._maxSize;
                 const batchSize = container._batchSize;
                 const renderer = this.renderer;
                 let totalChildren = children.length;
                 if (totalChildren === 0)
                 {
                     return;
                 }
                 else if (totalChildren > maxSize)
                 {
                     totalChildren = maxSize;
                 }
                 let buffers:ParticleBuffer[] = container._glBuffers[renderer.CONTEXT_UID];
                 if (!buffers)
                 {
                     buffers = container._glBuffers[renderer.CONTEXT_UID] = this.generateBuffers(container);
                 }
                 var sprite:DisplayObject = children[0];
                 if(sprite instanceof Bitmap)
                 {
                     const baseTexture = sprite._texture.baseTexture;
                     this.renderer.setBlendMode(Utils.correctBlendMode(container.blendMode, baseTexture.premultipliedAlpha));
                     const gl = renderer.gl;
                     const m = container.worldTransform.copy(this.tempMatrix);
                     m.prepend(renderer._activeRenderTarget.projectionMatrix);
                     this.shader.uniforms.projectionMatrix = m.toArray(true);
                     this.shader.uniforms.uColor = Utils.premultiplyRgba(container.tintRgb, container.worldAlpha, this.shader.uniforms.uColor, baseTexture.premultipliedAlpha);
                     this.shader.uniforms.uSampler = renderer.bindTexture(baseTexture);
                     let updateStatic = false;
                     for (let i = 0, j = 0; i < totalChildren; i += batchSize, j += 1)
                     {
                         let amount = (totalChildren - i);
                         if (amount > batchSize)
                         {
                             amount = batchSize;
                         }
                         if (j >= buffers.length)
                         {
                             if (!container.autoResize)
                             {
                                 break;
                             }
                             buffers.push(this._generateOneMoreBuffer(container));
                         }
                         const buffer = buffers[j];
                         buffer.uploadDynamic(children, i, amount);
                         const bid = container._bufferUpdateIDs[i] || 0;
                         updateStatic = updateStatic || (buffer._updateID < bid);
                         if (updateStatic)
                         {
                             buffer._updateID = container._updateID;
                             buffer.uploadStatic(children, i, amount);
                         }
                         renderer.bindVao(buffer.vao);
                         buffer.vao.draw(gl.TRIANGLES, amount * 6);
                     }
                 }
             }*/
        }
        generateBuffers(container) {
            /*const gl = this.renderer.gl;
            const buffers = [];
            const size = container._maxSize;
            const batchSize = container._batchSize;
            const dynamicPropertyFlags = container._properties;
            for (let i = 0; i < size; i += batchSize)
            {
                buffers.push(new ParticleBuffer(gl, this.properties, dynamicPropertyFlags, batchSize));
            }*/
            return null; //buffers;
        }
        _generateOneMoreBuffer(container) {
            const gl = null; //this.renderer.gl;
            const batchSize = container._batchSize;
            const dynamicPropertyFlags = container._properties;
            return new ParticleBuffer_1.ParticleBuffer(gl, this.properties, dynamicPropertyFlags, batchSize);
        }
        uploadVertices(children, startIndex, amount, array, stride, offset) {
            let w0 = 0;
            let w1 = 0;
            let h0 = 0;
            let h1 = 0;
            for (let i = 0; i < amount; ++i) {
                const sprite = children[startIndex + i];
                if (sprite instanceof Bitmap_1.Bitmap) {
                    const texture = sprite.texture;
                    const sx = sprite.scale.x;
                    const sy = sprite.scale.y;
                    const trim = texture.trim;
                    const orig = texture.orig;
                    if (trim) {
                        w1 = trim.x - (sprite.anchor.x * orig.width);
                        w0 = w1 + trim.width;
                        h1 = trim.y - (sprite.anchor.y * orig.height);
                        h0 = h1 + trim.height;
                    }
                    else {
                        w0 = (orig.width) * (1 - sprite.anchor.x);
                        w1 = (orig.width) * -sprite.anchor.x;
                        h0 = orig.height * (1 - sprite.anchor.y);
                        h1 = orig.height * -sprite.anchor.y;
                    }
                    array[offset] = w1 * sx;
                    array[offset + 1] = h1 * sy;
                    array[offset + stride] = w0 * sx;
                    array[offset + stride + 1] = h1 * sy;
                    array[offset + (stride * 2)] = w0 * sx;
                    array[offset + (stride * 2) + 1] = h0 * sy;
                    array[offset + (stride * 3)] = w1 * sx;
                    array[offset + (stride * 3) + 1] = h0 * sy;
                    offset += stride * 4;
                }
            }
        }
        uploadPosition(children, startIndex, amount, array, stride, offset) {
            for (let i = 0; i < amount; i++) {
                const spritePosition = children[startIndex + i].position;
                array[offset] = spritePosition.x;
                array[offset + 1] = spritePosition.y;
                array[offset + stride] = spritePosition.x;
                array[offset + stride + 1] = spritePosition.y;
                array[offset + (stride * 2)] = spritePosition.x;
                array[offset + (stride * 2) + 1] = spritePosition.y;
                array[offset + (stride * 3)] = spritePosition.x;
                array[offset + (stride * 3) + 1] = spritePosition.y;
                offset += stride * 4;
            }
        }
        uploadRotation(children, startIndex, amount, array, stride, offset) {
            for (let i = 0; i < amount; i++) {
                const spriteRotation = children[startIndex + i].rotation;
                array[offset] = spriteRotation;
                array[offset + stride] = spriteRotation;
                array[offset + (stride * 2)] = spriteRotation;
                array[offset + (stride * 3)] = spriteRotation;
                offset += stride * 4;
            }
        }
        uploadUvs(children, startIndex, amount, array, stride, offset) {
            for (let i = 0; i < amount; ++i) {
                var sprite = children[startIndex + i];
                if (sprite instanceof Bitmap_1.Bitmap) {
                    const textureUvs = sprite.texture._uvs;
                    if (textureUvs) {
                        array[offset] = textureUvs.x0;
                        array[offset + 1] = textureUvs.y0;
                        array[offset + stride] = textureUvs.x1;
                        array[offset + stride + 1] = textureUvs.y1;
                        array[offset + (stride * 2)] = textureUvs.x2;
                        array[offset + (stride * 2) + 1] = textureUvs.y2;
                        array[offset + (stride * 3)] = textureUvs.x3;
                        array[offset + (stride * 3) + 1] = textureUvs.y3;
                        offset += stride * 4;
                    }
                    else {
                        array[offset] = 0;
                        array[offset + 1] = 0;
                        array[offset + stride] = 0;
                        array[offset + stride + 1] = 0;
                        array[offset + (stride * 2)] = 0;
                        array[offset + (stride * 2) + 1] = 0;
                        array[offset + (stride * 3)] = 0;
                        array[offset + (stride * 3) + 1] = 0;
                        offset += stride * 4;
                    }
                }
            }
        }
        uploadTint(children, startIndex, amount, array, stride, offset) {
            for (let i = 0; i < amount; ++i) {
                const sprite = children[startIndex + i];
                if (sprite instanceof Bitmap_1.Bitmap) {
                    const premultiplied = sprite.texture.baseTexture.premultipliedAlpha;
                    const alpha = sprite.alpha;
                    const argb = alpha < 1.0 && premultiplied ? Utils_1.Utils.premultiplyTint(sprite._tintRGB, alpha) : sprite._tintRGB + (alpha * 255 << 24);
                    array[offset] = argb;
                    array[offset + stride] = argb;
                    array[offset + (stride * 2)] = argb;
                    array[offset + (stride * 3)] = argb;
                    offset += stride * 4;
                }
            }
        }
        destroy() {
            /*if (this.renderer.gl)
            {
                this.renderer.gl.deleteBuffer(this.indexBuffer);
            }
            super.destroy();
            this.shader.destroy();
            this.indices = null;
            this.tempMatrix = null;*/
        }
    }
    exports.ParticleRenderer = ParticleRenderer;
});
