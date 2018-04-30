
import { Graphics } from "flash/display/Graphics";
import { ObjectRenderer } from "flash/display3D/renderers/ObjectRenderer";
import { Stage } from "flash/display/Stage";
import { BaseObject } from "flash/display/BaseObject";
import { GraphicsRenderer } from "flash/display3D/renderers/GraphicsRenderer";

export class StencilManager extends BaseObject
{
    protected stencilMaskStack:Graphics[];
    protected _stage:Stage;

    constructor()
    {
        super();
        this.stencilMaskStack = null;
    }

    public set stage(value:Stage)
    {
        this._stage = value;
    }

    public setMaskStack(stencilMaskStack:Graphics[]):void
    {
        if(!this._stage)
        {
            return;
        }
        this.stencilMaskStack = stencilMaskStack;
        if (stencilMaskStack.length === 0)
        {
            this._stage.context.disable(this._stage.context.STENCIL_TEST);
        }
        else
        {
            this._stage.context.enable(this._stage.context.STENCIL_TEST);
        }
    }

    public pushStencil(graphics:Graphics):void
    {        
        if(!this._stage)
        {
            return;
        }
        this._stage.setObjectRenderer(GraphicsRenderer.renderer);
        this._stage.activeRenderTarget.attachStencilBuffer();        
        const prevMaskCount = this.stencilMaskStack.length;
        if (prevMaskCount === 0)
        {
            this._stage.context.enable(this._stage.context.STENCIL_TEST);
        }
        this.stencilMaskStack.push(graphics);
        this._stage.context.colorMask(false, false, false, false);
        this._stage.context.stencilFunc(this._stage.context.EQUAL, prevMaskCount, this._getBitwiseMask());
        this._stage.context.stencilOp(this._stage.context.KEEP, this._stage.context.KEEP, this._stage.context.INCR);
        GraphicsRenderer.renderer.render(graphics);
        this._useCurrent();
    }

    public popStencil():void
    {
        if(!this._stage)
        {
            return;
        }
        this._stage.setObjectRenderer(GraphicsRenderer.renderer);
        const graphics = this.stencilMaskStack.pop();
        if (this.stencilMaskStack.length === 0)
        {
            this._stage.context.disable(this._stage.context.STENCIL_TEST);
            this._stage.context.clear(this._stage.context.STENCIL_BUFFER_BIT);
            this._stage.context.clearStencil(0);
        }
        else
        {
            this._stage.context.colorMask(false, false, false, false);
            this._stage.context.stencilOp(this._stage.context.KEEP, this._stage.context.KEEP, this._stage.context.DECR);
            GraphicsRenderer.renderer.render(graphics);
            this._useCurrent();
        }
    }

    public _useCurrent():void
    {
        if(!this._stage)
        {
            return;
        }
        this._stage.context.colorMask(true, true, true, true);
        this._stage.context.stencilFunc(this._stage.context.EQUAL, this.stencilMaskStack.length, this._getBitwiseMask());
        this._stage.context.stencilOp(this._stage.context.KEEP, this._stage.context.KEEP, this._stage.context.KEEP);
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