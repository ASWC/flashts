import { BaseObject } from "flash/rendering/core/BaseObject";

export class WebGLData extends BaseObject
{
    public lastIndex:number;
    public clearDirty:number;
    public dirty:number;
    public data:any[];
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