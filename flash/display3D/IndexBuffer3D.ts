import { BaseObject } from "flash/display/BaseObject";

// typed

export class IndexBuffer3D extends BaseObject
{
    protected static EMPTY_ARRAY_BUFFER:ArrayBuffer = new ArrayBuffer(0);
    protected gl:WebGLRenderingContext;
    protected type:number;
    protected _updateID:number;
    protected _data:ArrayBuffer|Float32Array|Uint16Array;
    protected buffer:WebGLBuffer;
    protected drawType:number;

    constructor(gl:WebGLRenderingContext, type:number, data:ArrayBuffer|Float32Array|Uint16Array, drawType:number)
    {
        super();
        this.gl = gl;
        this.buffer = gl.createBuffer();
        this.type = type || gl.ARRAY_BUFFER;
        this.drawType = drawType || gl.STATIC_DRAW;
        this._data = IndexBuffer3D.EMPTY_ARRAY_BUFFER;    
        if(data)
        {
            this.upload(data);
        }    
        this._updateID = 0;
    };

    public get data():ArrayBuffer|Float32Array|Uint16Array
    {
        return this._data;
    }
 
    public upload(data:ArrayBuffer|Float32Array|Uint16Array, offset:number = null, dontBind:boolean = null):void
    {
        if(!dontBind) this.bind();    
        if(!this.gl)
        {
            return;
        } 
        data = data || this._data;
        offset = offset || 0;    
        if(this._data.byteLength >= data.byteLength)
        {
            this.gl.bufferSubData(this.type, offset, data);
        }
        else
        {
            this.gl.bufferData(this.type, data, this.drawType);
        }    
        this._data = data;
    };
  
    public bind():void
    {
        this.gl.bindBuffer(this.type, this.buffer);
    };
    
    public static createVertexBuffer(gl:WebGLRenderingContext, data:ArrayBuffer|Float32Array|Uint16Array = null, drawType:number = null):IndexBuffer3D
    {
        return new IndexBuffer3D(gl, gl.ARRAY_BUFFER, data, drawType);
    };
    
    public static createIndexBuffer(gl:WebGLRenderingContext, data:ArrayBuffer|Float32Array|Uint16Array = null, drawType:number = null):IndexBuffer3D
    {
        return new IndexBuffer3D(gl, gl.ELEMENT_ARRAY_BUFFER, data, drawType);
    };
    
    public create(gl:WebGLRenderingContext, type:number, data:ArrayBuffer|Float32Array|Uint16Array, drawType:number):IndexBuffer3D
    {
        return new IndexBuffer3D(gl, type, data, drawType);
    };
 
    public destroy():void
    {
        this.gl.deleteBuffer(this.buffer);
    };
}