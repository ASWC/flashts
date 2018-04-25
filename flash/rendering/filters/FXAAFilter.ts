import { Filter } from "./Filter";
import { Shaders } from "./Shaders";



export class FXAAFilter extends Filter
{
    /**
     *
     */
    constructor()
    {
        super(Shaders.VERTEX_FXAA, Shaders.FRAGMENT_FXAA);
    }
}