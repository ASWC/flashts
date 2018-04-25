import { Constants } from "../managers/Constants";
import { Utils } from "../webgl/Utils";
import { StageSettings } from "flash/rendering/core/StageSettings";


export class Filter
{
    public static SOURCE_KEY_MAP = {};
    /**
     * @param {string} [vertexSrc] - The source of the vertex shader.
     * @param {string} [fragmentSrc] - The source of the fragment shader.
     * @param {object} [uniforms] - Custom uniforms to use to augment the built-in ones.
     */
    public vertexSrc:any;
    public fragmentSrc:any;
    public _blendMode:any;
    public uniformData:any;
    public glShaders:any;
    public glShaderKey:any;
    public uniforms:any;
    public autoFit:any;
    public enabled:any;
    public resolution:any;
    public padding:any;

    constructor(vertexSrc = null, fragmentSrc = null, uniforms = null)
    {
        /**
         * The vertex shader.
         *
         * @member {string}
         */
        this.vertexSrc = vertexSrc || Filter.defaultVertexSrc;

        /**
         * The fragment shader.
         *
         * @member {string}
         */
        this.fragmentSrc = fragmentSrc || Filter.defaultFragmentSrc;

        this._blendMode = Constants.BLEND_MODES.NORMAL;

        this.uniformData = uniforms || Utils.extractUniformsFromSrc(this.vertexSrc, this.fragmentSrc, 'projectionMatrix|uSampler');

        /**
         * An object containing the current values of custom uniforms.
         * @example <caption>Updating the value of a custom uniform</caption>
         * filter.uniforms.time = performance.now();
         *
         * @member {object}
         */
        this.uniforms = {};

        for (const i in this.uniformData)
        {
            this.uniforms[i] = this.uniformData[i].value;
            if (this.uniformData[i].type)
            {
                this.uniformData[i].type = this.uniformData[i].type.toLowerCase();
            }
        }

        // this is where we store shader references..
        // TODO we could cache this!
        this.glShaders = {};

        // used for cacheing.. sure there is a better way!
        if (!Filter.SOURCE_KEY_MAP[this.vertexSrc + this.fragmentSrc])
        {
            Filter.SOURCE_KEY_MAP[this.vertexSrc + this.fragmentSrc] = Utils.uid();
        }

        this.glShaderKey = Filter.SOURCE_KEY_MAP[this.vertexSrc + this.fragmentSrc];

        /**
         * The padding of the filter. Some filters require extra space to breath such as a blur.
         * Increasing this will add extra width and height to the bounds of the object that the
         * filter is applied to.
         *
         * @member {number}
         */
        this.padding = 4;

        /**
         * The resolution of the filter. Setting this to be lower will lower the quality but
         * increase the performance of the filter.
         *
         * @member {number}
         */
        this.resolution = StageSettings.FILTER_RESOLUTION;

        /**
         * If enabled is true the filter is applied, if false it will not.
         *
         * @member {boolean}
         */
        this.enabled = true;

        /**
         * If enabled, PixiJS will fit the filter area into boundaries for better performance.
         * Switch it off if it does not work for specific shader.
         *
         * @member {boolean}
         */
        this.autoFit = true;
    }

    /**
     * Applies the filter
     *
     * @param {PIXI.FilterManager} filterManager - The renderer to retrieve the filter from
     * @param {PIXI.RenderTarget} input - The input render target.
     * @param {PIXI.RenderTarget} output - The target to output to.
     * @param {boolean} clear - Should the output be cleared before rendering to it
     * @param {object} [currentState] - It's current state of filter.
     *        There are some useful properties in the currentState :
     *        target, filters, sourceFrame, destinationFrame, renderTarget, resolution
     */
    public apply(filterManager, input, output, clear, currentState) // eslint-disable-line no-unused-vars
    {
        // --- //
        //  this.uniforms.filterMatrix = filterManager.calculateSpriteMatrix(tempMatrix, window.panda );

        // do as you please!

        filterManager.applyFilter(this, input, output, clear);

        // or just do a regular render..
    }

    /**
     * Sets the blendmode of the filter
     *
     * @member {number}
     * @default PIXI.BLEND_MODES.NORMAL
     */
    public get blendMode()
    {
        return this._blendMode;
    }

    public set blendMode(value) // eslint-disable-line require-jsdoc
    {
        this._blendMode = value;
    }

    /**
     * The default vertex shader source
     *
     * @static
     * @constant
     */
    public static get defaultVertexSrc()
    {
        return [
            'attribute vec2 aVertexPosition;',
            'attribute vec2 aTextureCoord;',

            'uniform mat3 projectionMatrix;',
            'uniform mat3 filterMatrix;',

            'varying vec2 vTextureCoord;',
            'varying vec2 vFilterCoord;',

            'void main(void){',
            '   gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);',
            '   vFilterCoord = ( filterMatrix * vec3( aTextureCoord, 1.0)  ).xy;',
            '   vTextureCoord = aTextureCoord ;',
            '}',
        ].join('\n');
    }

    /**
     * The default fragment shader source
     *
     * @static
     * @constant
     */
    public static get defaultFragmentSrc()
    {
        return [
            'varying vec2 vTextureCoord;',
            'varying vec2 vFilterCoord;',

            'uniform sampler2D uSampler;',
            'uniform sampler2D filterSampler;',

            'void main(void){',
            '   vec4 masky = texture2D(filterSampler, vFilterCoord);',
            '   vec4 sample = texture2D(uSampler, vTextureCoord);',
            '   vec4 color;',
            '   if(mod(vFilterCoord.x, 1.0) > 0.5)',
            '   {',
            '     color = vec4(1.0, 0.0, 0.0, 1.0);',
            '   }',
            '   else',
            '   {',
            '     color = vec4(0.0, 1.0, 0.0, 1.0);',
            '   }',
            // '   gl_FragColor = vec4(mod(vFilterCoord.x, 1.5), vFilterCoord.y,0.0,1.0);',
            '   gl_FragColor = mix(sample, masky, 0.5);',
            '   gl_FragColor *= sample.a;',
            '}',
        ].join('\n');
    }
}