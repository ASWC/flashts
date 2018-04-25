import { GLShader } from "flash/rendering/core/gl/GLShader";
import { Shaders } from "../filters/Shaders";

export class PrimitiveShader extends GLShader
{
    constructor(gl:WebGLRenderingContext)
    {
        super(gl,Shaders.VERTEX_PRIMITIVE, Shaders.FRAGMENT_PRIMITIVE);
    }
}