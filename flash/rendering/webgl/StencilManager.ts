
import { Graphics } from "flash/display/Graphics";
import { ObjectRenderer } from "flash/display3D/renderers/ObjectRenderer";


export class StencilManager// extends WebGLManager
{
    public stencilMaskStack:Graphics[];

    constructor()
    {
        //super();
       // this.stencilMaskStack = null;
    }

    public setMaskStack(stencilMaskStack:Graphics[]):void
    {
       /* this.stencilMaskStack = stencilMaskStack;
        if (stencilMaskStack.length === 0)
        {
            this.renderer.gl.disable(this.renderer.gl.STENCIL_TEST);
        }
        else
        {
            this.renderer.gl.enable(this.renderer.gl.STENCIL_TEST);
        }*/
    }

    public pushStencil(graphics:Graphics):void
    {        
        /*this.renderer.setObjectRenderer(GraphicsRenderer.renderer);
        this.renderer._activeRenderTarget.attachStencilBuffer();        
        const prevMaskCount = this.stencilMaskStack.length;
        if (prevMaskCount === 0)
        {
            this.renderer.gl.enable(this.renderer.gl.STENCIL_TEST);
        }
        this.stencilMaskStack.push(graphics);
        this.renderer.gl.colorMask(false, false, false, false);
        this.renderer.gl.stencilFunc(this.renderer.gl.EQUAL, prevMaskCount, this._getBitwiseMask());
        this.renderer.gl.stencilOp(this.renderer.gl.KEEP, this.renderer.gl.KEEP, this.renderer.gl.INCR);
        //GraphicsRenderer.renderer.render(graphics);
        this._useCurrent();*/
    }

    public popStencil():void
    {
       /* this.renderer.setObjectRenderer(GraphicsRenderer.renderer);
        const graphics = this.stencilMaskStack.pop();
        if (this.stencilMaskStack.length === 0)
        {
            this.renderer.gl.disable(this.renderer.gl.STENCIL_TEST);
            this.renderer.gl.clear(this.renderer.gl.STENCIL_BUFFER_BIT);
            this.renderer.gl.clearStencil(0);
        }
        else
        {
            this.renderer.gl.colorMask(false, false, false, false);
            this.renderer.gl.stencilOp(this.renderer.gl.KEEP, this.renderer.gl.KEEP, this.renderer.gl.DECR);
            //GraphicsRenderer.renderer.render(graphics);
            this._useCurrent();
        }*/
    }

    public _useCurrent():void
    {
        /*this.renderer.gl.colorMask(true, true, true, true);
        this.renderer.gl.stencilFunc(this.renderer.gl.EQUAL, this.stencilMaskStack.length, this._getBitwiseMask());
        this.renderer.gl.stencilOp(this.renderer.gl.KEEP, this.renderer.gl.KEEP, this.renderer.gl.KEEP);*/
    }

    public _getBitwiseMask():number
    {
        return (1 << this.stencilMaskStack.length) - 1;
    }

    public destroy():void
    {
        this.stencilMaskStack = null;
    }
}