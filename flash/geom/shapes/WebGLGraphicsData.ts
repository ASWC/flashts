import { IndexBuffer3D } from "flash/display3D/IndexBuffer3D";
import { VertexBuffer3D } from "flash/display3D/VertexBuffer3D";
import { GLShader } from "flash/display3D/GLShader";
import { Point } from "flash/geom/Point";
import { Utils } from "flash/rendering/webgl/Utils";
import { BaseObject } from "flash/display/BaseObject";
import { AttributeState } from "flash/display3D/types/DataTypes";

export class WebGLGraphicsData extends BaseObject
{
    public gl:WebGLRenderingContext;
    public color:number[];
    public points:number[];
    public indices:number[];
    public buffer:IndexBuffer3D;
    public indexBuffer:IndexBuffer3D;    
    public dirty:boolean;
    public nativeLines:boolean;
    public shader:GLShader;
    public vao:VertexBuffer3D;
    public glPoints:Float32Array;
    public glIndices:Uint16Array;
    public alpha:number;

    constructor(gl:WebGLRenderingContext, shader:GLShader, attribsState:AttributeState)
    {
        super();
        this.gl = gl;
        this.color = [0, 0, 0];
        this.points = [];
        this.indices = [];
        this.buffer = IndexBuffer3D.createVertexBuffer(gl);
        this.indexBuffer = IndexBuffer3D.createIndexBuffer(gl);
        this.dirty = true;
        this.nativeLines = false;
        this.glPoints = null;
        this.glIndices = null;
        this.shader = shader;
        this.vao = new VertexBuffer3D(gl, attribsState)
        .addIndex(this.indexBuffer)
        .addAttribute(this.buffer, shader.attributes.aVertexPosition, gl.FLOAT, false, 4 * 6, 0)
        .addAttribute(this.buffer, shader.attributes.aColor, gl.FLOAT, false, 4 * 6, 2 * 4);
    }

    public reset():void
    {
        this.points.length = 0;
        this.indices.length = 0;
    }

    public upload():void
    {        
        this.glPoints = new Float32Array(this.points);
        this.buffer.upload(this.glPoints);
        this.glIndices = new Uint16Array(this.indices);
        this.indexBuffer.upload(this.glIndices);
        this.dirty = false;
    }

    public destroy():void
    {
        this.color = null;
        this.points = null;
        this.indices = null;
        this.vao.destroy();
        this.buffer.destroy();
        this.indexBuffer.destroy();
        this.gl = null;
        this.buffer = null;
        this.indexBuffer = null;
        this.glPoints = null;
        this.glIndices = null;
    }
}