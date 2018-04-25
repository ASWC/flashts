import { Filter } from "./Filter";
import { Shaders } from "./Shaders";



export class NoiseFilter extends Filter
{
    /**
     * @param {number} noise - The noise intensity, should be a normalized value in the range [0, 1].
     * @param {number} seed - A random seed for the noise generation. Default is `Math.random()`.
     */
    constructor(noise = 0.5, seed = Math.random())
    {
        super(Shaders.DEFAULT, Shaders.NOISE);
        this.noise = noise;
        this.seed = seed;
    }

    /**
     * The amount of noise to apply, this value should be in the range (0, 1].
     *
     * @member {number}
     * @default 0.5
     */
    public get noise()
    {
        return this.uniforms.uNoise;
    }

    public set noise(value) // eslint-disable-line require-jsdoc
    {
        this.uniforms.uNoise = value;
    }

    /**
     * A seed value to apply to the random noise generation. `Math.random()` is a good value to use.
     *
     * @member {number}
     */
    public get seed()
    {
        return this.uniforms.uSeed;
    }

    public set seed(value) // eslint-disable-line require-jsdoc
    {
        this.uniforms.uSeed = value;
    }
}