import { BaseObject } from "flash/display/BaseObject";

export class Buffer extends BaseObject
{
    public vertices:ArrayBuffer;
    public float32View:Float32Array;
    public uint32View:Uint32Array;
    public positions:any;
    public uvs:any;
    public colors:any;
 
    constructor(size:number)
    {
        super();
        this.vertices = new ArrayBuffer(size);
        this.float32View = new Float32Array(this.vertices);
        this.uint32View = new Uint32Array(this.vertices);
    }

    public destroy():void
    {
        this.vertices = null;
        this.positions = null;
        this.uvs = null;
        this.colors = null;
    }
}