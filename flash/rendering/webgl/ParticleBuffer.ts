import { VertexArrayObject } from "flash/rendering/core/gl/VertexArrayObject";
import { GLBuffer } from "flash/rendering/core/gl/GLBuffer";
import { CreateIndicesForQuads } from "./CreateIndicesForQuads";
import { DisplayObject } from "../../display/DisplayObject";

export class ParticleBuffer
{
    /**
     * @param {WebGLRenderingContext} gl - The rendering context.
     * @param {object} properties - The properties to upload.
     * @param {boolean[]} dynamicPropertyFlags - Flags for which properties are dynamic.
     * @param {number} size - The size of the batch.
     */
    public gl:any;
    public size:any;
    public dynamicProperties:any;
    public dynamicDataUint32:any;
    public staticStride:any;
    public staticProperties:any;
    public dynamicBuffer:any;
    public dynamicData:any;
    public dynamicStride:any;
    public staticBuffer:any;
    public staticData:any;
    public _updateID:any;
    public staticDataUint32:any;
    public indices:any;
    public indexBuffer:any;
    public vao:any;

    constructor(gl, properties, dynamicPropertyFlags, size)
    {
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

        for (let i = 0; i < properties.length; ++i)
        {
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

            if (dynamicPropertyFlags[i])
            {
                this.dynamicProperties.push(property);
            }
            else
            {
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
    public initBuffers()
    {
        const gl = this.gl;
        let dynamicOffset = 0;

        /**
         * Holds the indices of the geometry (quads) to draw
         *
         * @member {Uint16Array}
         */
        this.indices = CreateIndicesForQuads.createIndicesForQuads(this.size);
        this.indexBuffer = GLBuffer.createIndexBuffer(gl, this.indices, gl.STATIC_DRAW);

        this.dynamicStride = 0;

        for (let i = 0; i < this.dynamicProperties.length; ++i)
        {
            const property = this.dynamicProperties[i];

            property.offset = dynamicOffset;
            dynamicOffset += property.size;
            this.dynamicStride += property.size;
        }

        const dynBuffer = new ArrayBuffer(this.size * this.dynamicStride * 4 * 4);

        this.dynamicData = new Float32Array(dynBuffer);
        this.dynamicDataUint32 = new Uint32Array(dynBuffer);
        this.dynamicBuffer = GLBuffer.createVertexBuffer(gl, dynBuffer, gl.STREAM_DRAW);

        // static //
        let staticOffset = 0;

        this.staticStride = 0;

        for (let i = 0; i < this.staticProperties.length; ++i)
        {
            const property = this.staticProperties[i];

            property.offset = staticOffset;
            staticOffset += property.size;
            this.staticStride += property.size;
        }

        const statBuffer = new ArrayBuffer(this.size * this.staticStride * 4 * 4);

        this.staticData = new Float32Array(statBuffer);
        this.staticDataUint32 = new Uint32Array(statBuffer);
        this.staticBuffer = GLBuffer.createVertexBuffer(gl, statBuffer, gl.STATIC_DRAW);

        this.vao = new VertexArrayObject(gl)
        .addIndex(this.indexBuffer);

        for (let i = 0; i < this.dynamicProperties.length; ++i)
        {
            const property = this.dynamicProperties[i];

            if (property.unsignedByte)
            {
                this.vao.addAttribute(
                    this.dynamicBuffer,
                    property.attribute,
                    gl.UNSIGNED_BYTE,
                    true,
                    this.dynamicStride * 4,
                    property.offset * 4
                );
            }
            else
            {
                this.vao.addAttribute(
                    this.dynamicBuffer,
                    property.attribute,
                    gl.FLOAT,
                    false,
                    this.dynamicStride * 4,
                    property.offset * 4
                );
            }
        }

        for (let i = 0; i < this.staticProperties.length; ++i)
        {
            const property = this.staticProperties[i];

            if (property.unsignedByte)
            {
                this.vao.addAttribute(
                    this.staticBuffer,
                    property.attribute,
                    gl.UNSIGNED_BYTE,
                    true,
                    this.staticStride * 4,
                    property.offset * 4
                );
            }
            else
            {
                this.vao.addAttribute(
                    this.staticBuffer,
                    property.attribute,
                    gl.FLOAT,
                    false,
                    this.staticStride * 4,
                    property.offset * 4
                );
            }
        }
    }

    public uploadDynamic(children:DisplayObject[], startIndex:number, amount:number):void
    {
        for (let i = 0; i < this.dynamicProperties.length; i++)
        {
            const property = this.dynamicProperties[i];
            property.uploadFunction(children, startIndex, amount, property.unsignedByte ? this.dynamicDataUint32 : this.dynamicData, this.dynamicStride, property.offset);
        }
        this.dynamicBuffer.upload();
    }

    public uploadStatic(children:DisplayObject[], startIndex:number, amount:number):void
    {
        for (let i = 0; i < this.staticProperties.length; i++)
        {
            const property = this.staticProperties[i];
            property.uploadFunction(children, startIndex, amount, property.unsignedByte ? this.staticDataUint32 : this.staticData, this.staticStride, property.offset);
        }
        this.staticBuffer.upload();
    }

    /**
     * Destroys the ParticleBuffer.
     *
     */
    public destroy()
    {
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
}