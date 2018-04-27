import { Filter } from "./Filter";
import { StageSettings } from "flash/display/StageSettings";


export class BlurYFilter extends Filter
{
    public static GAUSSIAN_VALUES = {
        5: [0.153388, 0.221461, 0.250301],
        7: [0.071303, 0.131514, 0.189879, 0.214607],
        9: [0.028532, 0.067234, 0.124009, 0.179044, 0.20236],
        11: [0.0093, 0.028002, 0.065984, 0.121703, 0.175713, 0.198596],
        13: [0.002406, 0.009255, 0.027867, 0.065666, 0.121117, 0.174868, 0.197641],
        15: [0.000489, 0.002403, 0.009246, 0.02784, 0.065602, 0.120999, 0.174697, 0.197448],
    };
    
    public static fragTemplate = [
        'varying vec2 vBlurTexCoords[%size%];',
        'uniform sampler2D uSampler;',
    
        'void main(void)',
        '{',
        '    gl_FragColor = vec4(0.0);',
        '    %blur%',
        '}',
    
    ].join('\n');

    public static vertTemplate = [
        'attribute vec2 aVertexPosition;',
        'attribute vec2 aTextureCoord;',
    
        'uniform float strength;',
        'uniform mat3 projectionMatrix;',
    
        'varying vec2 vBlurTexCoords[%size%];',
    
        'void main(void)',
        '{',
        'gl_Position = vec4((projectionMatrix * vec3((aVertexPosition), 1.0)).xy, 0.0, 1.0);',
        '%blur%',
        '}',
    ].join('\n');
    /**
     * @param {number} strength - The strength of the blur filter.
     * @param {number} quality - The quality of the blur filter.
     * @param {number} resolution - The resolution of the blur filter.
     * @param {number} [kernelSize=5] - The kernelSize of the blur filter.Options: 5, 7, 9, 11, 13, 15.
     */
    public _quality:any;
    public strength:any;
    public firstRun:any;
    public passes:any;

    constructor(strength, quality, resolution, kernelSize)
    {
        kernelSize = kernelSize || 5;
        const vertSrc = BlurYFilter.generateVertBlurSource(kernelSize, false);
        const fragSrc = BlurYFilter.generateFragBlurSource(kernelSize);

        super(
            // vertex shader
            vertSrc,
            // fragment shader
            fragSrc
        );

        this.resolution = resolution || StageSettings.RESOLUTION;

        this._quality = 0;

        this.quality = quality || 4;
        this.strength = strength || 8;

        this.firstRun = true;
    }

    /**
     * Applies the filter.
     *
     * @param {PIXI.FilterManager} filterManager - The manager.
     * @param {PIXI.RenderTarget} input - The input target.
     * @param {PIXI.RenderTarget} output - The output target.
     * @param {boolean} clear - Should the output be cleared before rendering?
     */
    public apply(filterManager, input, output, clear)
    {
        if (this.firstRun)
        {
            const gl = filterManager.renderer.gl;
            const kernelSize = BlurYFilter.getMaxKernelSize(gl);

            this.vertexSrc = BlurYFilter.generateVertBlurSource(kernelSize, false);
            this.fragmentSrc = BlurYFilter.generateFragBlurSource(kernelSize);

            this.firstRun = false;
        }

        this.uniforms.strength = (1 / output.size.height) * (output.size.height / input.size.height);

        this.uniforms.strength *= this.strength;
        this.uniforms.strength /= this.passes;

        if (this.passes === 1)
        {
            filterManager.applyFilter(this, input, output, clear);
        }
        else
        {
            const renderTarget = filterManager.getRenderTarget(true);
            let flip = input;
            let flop = renderTarget;

            for (let i = 0; i < this.passes - 1; i++)
            {
                filterManager.applyFilter(this, flip, flop, true);

                const temp = flop;

                flop = flip;
                flip = temp;
            }

            filterManager.applyFilter(this, flip, output, clear);

            filterManager.returnRenderTarget(renderTarget);
        }
    }

    /**
     * Sets the strength of both the blur.
     *
     * @member {number}
     * @default 2
     */
    public get blur()
    {
        return this.strength;
    }

    public set blur(value) // eslint-disable-line require-jsdoc
    {
        this.padding = Math.abs(value) * 2;
        this.strength = value;
    }

    /**
     * Sets the quality of the blur by modifying the number of passes. More passes means higher
     * quaility bluring but the lower the performance.
     *
     * @member {number}
     * @default 4
     */
    public get quality()
    {
        return this._quality;
    }

    public set quality(value) // eslint-disable-line require-jsdoc
    {
        this._quality = value;
        this.passes = value;
    }


    
    public static generateVertBlurSource(kernelSize, x = null)
    {
        const halfLength = Math.ceil(kernelSize / 2);
    
        let vertSource = BlurYFilter.vertTemplate;
    
        let blurLoop = '';
        let template;
        // let value;
    
        if (x)
        {
            template = 'vBlurTexCoords[%index%] = aTextureCoord + vec2(%sampleIndex% * strength, 0.0);';
        }
        else
        {
            template = 'vBlurTexCoords[%index%] = aTextureCoord + vec2(0.0, %sampleIndex% * strength);';
        }
    
        for (let i = 0; i < kernelSize; i++)
        {
            let blur = template.replace('%index%', i);
    
            // value = i;
    
            // if(i >= halfLength)
            // {
            //     value = kernelSize - i - 1;
            // }
    
            blur = blur.replace('%sampleIndex%', `${i - (halfLength - 1)}.0`);
    
            blurLoop += blur;
            blurLoop += '\n';
        }
    
        vertSource = vertSource.replace('%blur%', blurLoop);
        vertSource = vertSource.replace('%size%', kernelSize);
    
        return vertSource;
    }

    public static getMaxKernelSize(gl)
    {
        const maxVaryings = (gl.getParameter(gl.MAX_VARYING_VECTORS));
        let kernelSize = 15;
    
        while (kernelSize > maxVaryings)
        {
            kernelSize -= 2;
        }
    
        return kernelSize;
    }
    
    public static generateFragBlurSource(kernelSize)
    {
        const kernel = BlurYFilter.GAUSSIAN_VALUES[kernelSize];
        const halfLength = kernel.length;
    
        let fragSource = BlurYFilter.fragTemplate;
    
        let blurLoop = '';
        const template = 'gl_FragColor += texture2D(uSampler, vBlurTexCoords[%index%]) * %value%;';
        let value;
    
        for (let i = 0; i < kernelSize; i++)
        {
            let blur = template.replace('%index%', i.toString());
    
            value = i;
    
            if (i >= halfLength)
            {
                value = kernelSize - i - 1;
            }
    
            blur = blur.replace('%value%', kernel[value]);
    
            blurLoop += blur;
            blurLoop += '\n';
        }
    
        fragSource = fragSource.replace('%blur%', blurLoop);
        fragSource = fragSource.replace('%size%', kernelSize);
    
        return fragSource;
    }
}