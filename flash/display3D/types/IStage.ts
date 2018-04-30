import { ObjectRenderer } from "flash/display3D/renderers/ObjectRenderer";
import { RenderTarget } from "flash/display3D/textures/RenderTarget";
import { FilterManager } from "flash/rendering/webgl/FilterManager";
import { IDisplayObjectContainer } from "flash/display/IDisplayObjectContainer";
import { MaskManager } from "flash/rendering/webgl/MaskManager";
import { GLShader } from "flash/display3D/GLShader";
import { WebGLState } from "flash/rendering/webgl/WebGLState";
import { VertexBuffer3D } from "flash/display3D/VertexBuffer3D";

export interface IStage
{
    currentRenderer:ObjectRenderer;
    activeRenderTarget:RenderTarget;
    emptyRoot:IDisplayObjectContainer;
    canvasResolution:number;
    context:WebGLRenderingContext;

    getFilterManager():FilterManager;
    bindRenderTarget(renderTarget:RenderTarget):void;    
    setObjectRenderer(objectRenderer:ObjectRenderer):void;
    getMaskManager():MaskManager;
    flush():void;
    getContextID():number;
    bindShader(shader:GLShader, autoProject:boolean):void;
    getRenderState():WebGLState;
    bindVao(vao:VertexBuffer3D):void;
}