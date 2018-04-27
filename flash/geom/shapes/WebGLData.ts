import { BaseObject } from "flash/display/BaseObject";
import { WebGLGraphicsData } from "flash/rendering/core/gl/WebGLGraphicsData";

export class WebGLData extends BaseObject
{
    public lastIndex:number;
    public clearDirty:number;
    public dirty:number;
    public data:WebGLGraphicsData[];
    public gl:WebGLRenderingContext;

    constructor(gl:WebGLRenderingContext)
    {
        super();
        this.gl = gl;
        this.data = [];
        this.lastIndex = 0;
        this.clearDirty = -1;
        this.dirty = -1;
    }
}