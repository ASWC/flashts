import { Filter } from "./Filter";
import { Shaders } from "./Shaders";



export class AlphaFilter extends Filter
{
    

    


    /**
     * @param {number} [alpha=1] Amount of alpha from 0 to 1, where 0 is transparent
     */
    constructor(alpha = 1.0)
    {
        super(Shaders.DEFAULT, Shaders.ALPHA);
        this.alpha = alpha;
        this.glShaderKey = 'alpha';
    }

    /**
     * Coefficient for alpha multiplication
     *
     * @member {number}
     * @default 1
     */
    public get alpha()
    {
        return this.uniforms.uAlpha;
    }

    public set alpha(value) // eslint-disable-line require-jsdoc
    {
        this.uniforms.uAlpha = value;
    }
}