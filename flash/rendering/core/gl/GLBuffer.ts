
export class GLBuffer
{
    public static EMPTY_ARRAY_BUFFER:ArrayBuffer = new ArrayBuffer(0);
    public gl:WebGLRenderingContext;
    public type:number;
    public _updateID:number;
    public data:ArrayBuffer|Float32Array|Uint16Array;
    public buffer:WebGLBuffer;
    public drawType:number;

    constructor(gl:WebGLRenderingContext, type:number, data:ArrayBuffer|Float32Array|Uint16Array, drawType:number)
    {
        this.gl = gl;
        this.buffer = gl.createBuffer();
        this.type = type || gl.ARRAY_BUFFER;
        this.drawType = drawType || gl.STATIC_DRAW;
        this.data = GLBuffer.EMPTY_ARRAY_BUFFER;    
        if(data)
        {
            this.upload(data);
        }    
        this._updateID = 0;
    };
 
    public upload(data:ArrayBuffer|Float32Array|Uint16Array, offset:number = null, dontBind:boolean = null):void
    {
        if(!dontBind) this.bind();    
        var gl = this.gl;    
        data = data || this.data;
        offset = offset || 0;    
        if(this.data.byteLength >= data.byteLength)
        {
            gl.bufferSubData(this.type, offset, data);
        }
        else
        {
            gl.bufferData(this.type, data, this.drawType);
        }    
        this.data = data;
    };
  
    public bind():void
    {
        var gl = this.gl;
        gl.bindBuffer(this.type, this.buffer);
    };
    
    public static createVertexBuffer(gl:WebGLRenderingContext, data:ArrayBuffer|Float32Array|Uint16Array = null, drawType:number = null):GLBuffer
    {
        return new GLBuffer(gl, gl.ARRAY_BUFFER, data, drawType);
    };
    
    public static createIndexBuffer(gl:WebGLRenderingContext, data:ArrayBuffer|Float32Array|Uint16Array = null, drawType:number = null):GLBuffer
    {
        return new GLBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, data, drawType);
    };
    
    public create(gl:WebGLRenderingContext, type:number, data:ArrayBuffer|Float32Array|Uint16Array, drawType:number):GLBuffer
    {
        return new GLBuffer(gl, type, data, drawType);
    };
 
    public destroy():void
    {
        this.gl.deleteBuffer(this.buffer);
    };
}