define(["require", "exports", "flash/display3D/VertexBuffer3D", "flash/display3D/IndexBuffer3D"], function (require, exports, VertexBuffer3D_1, IndexBuffer3D_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class ParticleBuffer {
        constructor(gl, properties, dynamicPropertyFlags, size) {
            /**
             * The current WebGL drawing context.
             *
             * @member {WebGLRenderingContext}
             */
            this.gl = gl;
            /**
             * The number of particles the buffer can hold
             *
             * @member {number}
             */
            this.size = size;
            /**
             * A list of the properties that are dynamic.
             *
             * @member {object[]}
             */
            this.dynamicProperties = [];
            /**
             * A list of the properties that are static.
             *
             * @member {object[]}
             */
            this.staticProperties = [];
            for (let i = 0; i < properties.length; ++i) {
                let property = properties[i];
                // Make copy of properties object so that when we edit the offset it doesn't
                // change all other instances of the object literal
                property = {
                    attribute: property.attribute,
                    size: property.size,
                    uploadFunction: property.uploadFunction,
                    unsignedByte: property.unsignedByte,
                    offset: property.offset,
                };
                if (dynamicPropertyFlags[i]) {
                    this.dynamicProperties.push(property);
                }
                else {
                    this.staticProperties.push(property);
                }
            }
            this.staticStride = 0;
            this.staticBuffer = null;
            this.staticData = null;
            this.staticDataUint32 = null;
            this.dynamicStride = 0;
            this.dynamicBuffer = null;
            this.dynamicData = null;
            this.dynamicDataUint32 = null;
            this._updateID = 0;
            this.initBuffers();
        }
        /**
         * Sets up the renderer context and necessary buffers.
         *
         * @private
         */
        initBuffers() {
            const gl = this.gl;
            let dynamicOffset = 0;
            /**
             * Holds the indices of the geometry (quads) to draw
             *
             * @member {Uint16Array}
             */
            this.indices = ParticleBuffer.createIndicesForQuads(this.size);
            this.indexBuffer = IndexBuffer3D_1.IndexBuffer3D.createIndexBuffer(gl, this.indices, gl.STATIC_DRAW);
            this.dynamicStride = 0;
            for (let i = 0; i < this.dynamicProperties.length; ++i) {
                const property = this.dynamicProperties[i];
                property.offset = dynamicOffset;
                dynamicOffset += property.size;
                this.dynamicStride += property.size;
            }
            const dynBuffer = new ArrayBuffer(this.size * this.dynamicStride * 4 * 4);
            this.dynamicData = new Float32Array(dynBuffer);
            this.dynamicDataUint32 = new Uint32Array(dynBuffer);
            this.dynamicBuffer = IndexBuffer3D_1.IndexBuffer3D.createVertexBuffer(gl, dynBuffer, gl.STREAM_DRAW);
            // static //
            let staticOffset = 0;
            this.staticStride = 0;
            for (let i = 0; i < this.staticProperties.length; ++i) {
                const property = this.staticProperties[i];
                property.offset = staticOffset;
                staticOffset += property.size;
                this.staticStride += property.size;
            }
            const statBuffer = new ArrayBuffer(this.size * this.staticStride * 4 * 4);
            this.staticData = new Float32Array(statBuffer);
            this.staticDataUint32 = new Uint32Array(statBuffer);
            this.staticBuffer = IndexBuffer3D_1.IndexBuffer3D.createVertexBuffer(gl, statBuffer, gl.STATIC_DRAW);
            this.vao = new VertexBuffer3D_1.VertexBuffer3D(gl)
                .addIndex(this.indexBuffer);
            for (let i = 0; i < this.dynamicProperties.length; ++i) {
                const property = this.dynamicProperties[i];
                if (property.unsignedByte) {
                    this.vao.addAttribute(this.dynamicBuffer, property.attribute, gl.UNSIGNED_BYTE, true, this.dynamicStride * 4, property.offset * 4);
                }
                else {
                    this.vao.addAttribute(this.dynamicBuffer, property.attribute, gl.FLOAT, false, this.dynamicStride * 4, property.offset * 4);
                }
            }
            for (let i = 0; i < this.staticProperties.length; ++i) {
                const property = this.staticProperties[i];
                if (property.unsignedByte) {
                    this.vao.addAttribute(this.staticBuffer, property.attribute, gl.UNSIGNED_BYTE, true, this.staticStride * 4, property.offset * 4);
                }
                else {
                    this.vao.addAttribute(this.staticBuffer, property.attribute, gl.FLOAT, false, this.staticStride * 4, property.offset * 4);
                }
            }
        }
        uploadDynamic(children, startIndex, amount) {
            for (let i = 0; i < this.dynamicProperties.length; i++) {
                const property = this.dynamicProperties[i];
                property.uploadFunction(children, startIndex, amount, property.unsignedByte ? this.dynamicDataUint32 : this.dynamicData, this.dynamicStride, property.offset);
            }
            this.dynamicBuffer.upload();
        }
        uploadStatic(children, startIndex, amount) {
            for (let i = 0; i < this.staticProperties.length; i++) {
                const property = this.staticProperties[i];
                property.uploadFunction(children, startIndex, amount, property.unsignedByte ? this.staticDataUint32 : this.staticData, this.staticStride, property.offset);
            }
            this.staticBuffer.upload();
        }
        /**
         * Destroys the ParticleBuffer.
         *
         */
        destroy() {
            this.dynamicProperties = null;
            this.dynamicBuffer.destroy();
            this.dynamicBuffer = null;
            this.dynamicData = null;
            this.dynamicDataUint32 = null;
            this.staticProperties = null;
            this.staticBuffer.destroy();
            this.staticBuffer = null;
            this.staticData = null;
            this.staticDataUint32 = null;
        }
        static createIndicesForQuads(size) {
            const totalIndices = size * 6;
            const indices = new Uint16Array(totalIndices);
            for (let i = 0, j = 0; i < totalIndices; i += 6, j += 4) {
                indices[i + 0] = j + 0;
                indices[i + 1] = j + 1;
                indices[i + 2] = j + 2;
                indices[i + 3] = j + 0;
                indices[i + 4] = j + 2;
                indices[i + 5] = j + 3;
            }
            return indices;
        }
    }
    exports.ParticleBuffer = ParticleBuffer;
});
//# sourceMappingURL=ParticleBuffer.js.map