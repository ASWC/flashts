import { GLShader } from "flash/rendering/core/gl/GLShader";
import { Utils } from "../webgl/Utils";
import { StageSettings } from "flash/rendering/core/StageSettings";



export class Shaders
{
    public static fragStatments = [
        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',
        'varying float vTextureId;',
        'uniform sampler2D uSamplers[%count%];',
    
        'void main(void){',
        'vec4 color;',
        'float textureId = floor(vTextureId+0.5);',
        '%forloop%',
        'gl_FragColor = color * vColor;',
        '}',
    ].join('\n');

    public static checkMaxIfStatmentsInShader(maxIfs, gl)
    {
        const createTempContext = !gl;

        // @if DEBUG
        if (maxIfs === 0)
        {
            throw new Error('Invalid value of `0` passed to `checkMaxIfStatementsInShader`');
        }
        // @endif

        if (createTempContext)
        {
            const tinyCanvas = document.createElement('canvas');

            tinyCanvas.width = 1;
            tinyCanvas.height = 1;

            

            gl = Utils.createContext(tinyCanvas);
        }

        const shader = gl.createShader(gl.FRAGMENT_SHADER);

        while (true) // eslint-disable-line no-constant-condition
        {
            const fragmentSrc = Shaders.fragStatments.replace(/%forloop%/gi, Shaders.generateIfTestSrc(maxIfs));

            gl.shaderSource(shader, fragmentSrc);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            {
                maxIfs = (maxIfs / 2) | 0;
            }
            else
            {
                // valid!
                break;
            }
        }

        if (createTempContext)
        {
            // get rid of context
            if (gl.getExtension('WEBGL_lose_context'))
            {
                gl.getExtension('WEBGL_lose_context').loseContext();
            }
        }

        return maxIfs;
    }

    public static generateIfTestSrc(maxIfs)
    {
        let src = '';

        for (let i = 0; i < maxIfs; ++i)
        {
            if (i > 0)
            {
                src += '\nelse ';
            }

            if (i < maxIfs - 1)
            {
                src += `if(test == ${i}.0){}`;
            }
        }

        return src;
    }

    public static get TEXTURE():string
    {
        var shader:string = "precision highp float;" + Shaders.lineBreak;
        shader += "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "attribute vec4 aColor;" + Shaders.lineBreak;
        shader += "attribute float aTextureId;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "varying vec4 vColor;" + Shaders.lineBreak;
        shader += "varying float vTextureId;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vTextureCoord = aTextureCoord;" + Shaders.lineBreak;
        shader += "vTextureId = aTextureId;" + Shaders.lineBreak;
        shader += "vColor = aColor;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static fragTemplate = [
        'varying vec2 vTextureCoord;',
        'varying vec4 vColor;',
        'varying float vTextureId;',
        'uniform sampler2D uSamplers[%count%];',
    
        'void main(void){',
        'vec4 color;',
        'float textureId = floor(vTextureId+0.5);',
        '%forloop%',
        'gl_FragColor = color * vColor;',
        '}',
    ].join('\n');

    public static generateMultiTextureShader(gl, maxTextures)
    {
        const vertexSrc = Shaders.TEXTURE;
        let fragmentSrc = Shaders.fragTemplate;

        fragmentSrc = fragmentSrc.replace(/%count%/gi, maxTextures);
        fragmentSrc = fragmentSrc.replace(/%forloop%/gi, Shaders.generateSampleSrc(maxTextures));

        const shader = new GLShader(gl, vertexSrc, fragmentSrc);

        const sampleValues = [];

        for (let i = 0; i < maxTextures; i++)
        {
            sampleValues[i] = i;
        }

        shader.bind();
        shader.uniforms.uSamplers = sampleValues;

        return shader;
    }

    public static generateSampleSrc(maxTextures)
    {
        let src = '';

        src += '\n';
        src += '\n';

        for (let i = 0; i < maxTextures; i++)
        {
            if (i > 0)
            {
                src += '\nelse ';
            }

            if (i < maxTextures - 1)
            {
                src += `if(textureId == ${i}.0)`;
            }

            src += '\n{';
            src += `\n\tcolor = texture2D(uSamplers[${i}], vTextureCoord);`;
            src += '\n}';
        }

        src += '\n';
        src += '\n';

        return src;
    }

    public static get lineBreak():string
    {
        return "\n";
    }
    
    public static get COLOR_MATRIX():string
    {
        var shader:string = "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "uniform float m[20];" + Shaders.lineBreak;
        shader += "uniform float uAlpha;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec4 c = texture2D(uSampler, vTextureCoord);" + Shaders.lineBreak;
        shader += "if (uAlpha == 0.0) {" + Shaders.lineBreak;
        shader += "gl_FragColor = c;" + Shaders.lineBreak;
        shader += "return;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "if (c.a > 0.0)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "c.rgb /= c.a;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "vec4 result;" + Shaders.lineBreak;
        shader += "result.r = (m[0] * c.r);" + Shaders.lineBreak;
        shader += "result.r += (m[1] * c.g);" + Shaders.lineBreak;
        shader += "result.r += (m[2] * c.b);" + Shaders.lineBreak;
        shader += "result.r += (m[3] * c.a);" + Shaders.lineBreak;
        shader += "result.r += m[4];" + Shaders.lineBreak;
        shader += "result.g = (m[5] * c.r);" + Shaders.lineBreak;
        shader += "result.g += (m[6] * c.g);" + Shaders.lineBreak;
        shader += "result.g += (m[7] * c.b);" + Shaders.lineBreak;
        shader += "result.g += (m[8] * c.a);" + Shaders.lineBreak;
        shader += "result.g += m[9];" + Shaders.lineBreak;
        shader += "result.b = (m[10] * c.r);" + Shaders.lineBreak;
        shader += "result.b += (m[11] * c.g);" + Shaders.lineBreak;
        shader += "result.b += (m[12] * c.b);" + Shaders.lineBreak;
        shader += "result.b += (m[13] * c.a);" + Shaders.lineBreak;
        shader += "result.b += m[14];" + Shaders.lineBreak;
        shader += "result.a = (m[15] * c.r);" + Shaders.lineBreak;
        shader += "result.a += (m[16] * c.g);" + Shaders.lineBreak;
        shader += "result.a += (m[17] * c.b);" + Shaders.lineBreak;
        shader += "result.a += (m[18] * c.a);" + Shaders.lineBreak;
        shader += "result.a += m[19];" + Shaders.lineBreak;
        shader += "vec3 rgb = mix(c.rgb, result.rgb, uAlpha);" + Shaders.lineBreak;
        shader += "rgb *= result.a;" + Shaders.lineBreak;
        shader += "gl_FragColor = vec4(rgb, result.a);" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get VERTEX_MASK():string
    {
        var shader:string = "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "uniform mat3 otherMatrix;" + Shaders.lineBreak;
        shader += "varying vec2 vMaskCoord;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vTextureCoord = aTextureCoord;" + Shaders.lineBreak;
        shader += "vMaskCoord = ( otherMatrix * vec3( aTextureCoord, 1.0)  ).xy;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;        
        return shader;
    }

    public static get FRAGMENT_MASK():string
    {
        var shader:string = "";
        shader += "varying vec2 vMaskCoord;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "uniform sampler2D mask;" + Shaders.lineBreak;
        shader += "uniform float alpha;" + Shaders.lineBreak;
        shader += "uniform vec4 maskClamp;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "float clip = step(3.5, step(maskClamp.x, vMaskCoord.x) + step(maskClamp.y, vMaskCoord.y) + step(vMaskCoord.x, maskClamp.z) + step(vMaskCoord.y, maskClamp.w));" + Shaders.lineBreak;
        shader += "vec4 original = texture2D(uSampler, vTextureCoord);" + Shaders.lineBreak;
        shader += "vec4 masky = texture2D(mask, vMaskCoord);" + Shaders.lineBreak;
        shader += "original *= (masky.r * masky.a * alpha * clip);" + Shaders.lineBreak;
        shader += "gl_FragColor = original;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get NOISE():string
    {
        var shader:string = "precision highp float;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "varying vec4 vColor;" + Shaders.lineBreak;
        shader += "uniform float uNoise;" + Shaders.lineBreak;
        shader += "uniform float uSeed;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "float rand(vec2 co)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "void main()" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec4 color = texture2D(uSampler, vTextureCoord);" + Shaders.lineBreak;
        shader += "float randomValue = rand(gl_FragCoord.xy * uSeed);" + Shaders.lineBreak;
        shader += "float diff = (randomValue - 0.5) * uNoise;" + Shaders.lineBreak;
        shader += "if (color.a > 0.0) " + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "color.rgb /= color.a;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "color.r += diff;" + Shaders.lineBreak;
        shader += "color.g += diff;" + Shaders.lineBreak;
        shader += "color.b += diff;" + Shaders.lineBreak;
        shader += "color.rgb *= color.a;" + Shaders.lineBreak;
        shader += "gl_FragColor = color;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get DISPLACEMENT():string
    {
        var shader:string = "varying vec2 vFilterCoord;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "uniform vec2 scale;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "uniform sampler2D mapSampler;" + Shaders.lineBreak;
        shader += "uniform vec4 filterArea;" + Shaders.lineBreak;
        shader += "uniform vec4 filterClamp;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec4 map =  texture2D(mapSampler, vFilterCoord);" + Shaders.lineBreak;
        shader += "map -= 0.5;" + Shaders.lineBreak;
        shader += "map.xy *= scale / filterArea.xy;" + Shaders.lineBreak;
        shader += "gl_FragColor = texture2D(uSampler, clamp(vec2(vTextureCoord.x + map.x, vTextureCoord.y + map.y), filterClamp.xy, filterClamp.zw));" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get FRAGMENT_FXAA():string
    {
        var shader:string = "varying vec2 v_rgbNW;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbNE;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbSW;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbSE;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbM;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "uniform vec4 filterArea;" + Shaders.lineBreak;
        shader += "#ifndef FXAA_REDUCE_MIN" + Shaders.lineBreak;
        shader += "#define FXAA_REDUCE_MIN   (1.0/ 128.0)" + Shaders.lineBreak;
        shader += "#endif" + Shaders.lineBreak;
        shader += "#ifndef FXAA_REDUCE_MUL" + Shaders.lineBreak;
        shader += "#define FXAA_REDUCE_MUL   (1.0 / 8.0)" + Shaders.lineBreak;
        shader += "#endif" + Shaders.lineBreak;
        shader += "#ifndef FXAA_SPAN_MAX" + Shaders.lineBreak;
        shader += "#define FXAA_SPAN_MAX     8.0" + Shaders.lineBreak;
        shader += "#endif" + Shaders.lineBreak;
        shader += "vec4 fxaa(sampler2D tex, vec2 fragCoord, vec2 resolution, vec2 v_rgbNW, vec2 v_rgbNE, vec2 v_rgbSW, vec2 v_rgbSE, vec2 v_rgbM) " + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec4 color;" + Shaders.lineBreak;
        shader += "mediump vec2 inverseVP = vec2(1.0 / resolution.x, 1.0 / resolution.y);" + Shaders.lineBreak;
        shader += "vec3 rgbNW = texture2D(tex, v_rgbNW).xyz;" + Shaders.lineBreak;
        shader += "vec3 rgbNE = texture2D(tex, v_rgbNE).xyz;" + Shaders.lineBreak;
        shader += "vec3 rgbSW = texture2D(tex, v_rgbSW).xyz;" + Shaders.lineBreak;
        shader += "vec3 rgbSE = texture2D(tex, v_rgbSE).xyz;" + Shaders.lineBreak;
        shader += "vec4 texColor = texture2D(tex, v_rgbM);" + Shaders.lineBreak;
        shader += "vec3 rgbM  = texColor.xyz;" + Shaders.lineBreak;
        shader += "vec3 luma = vec3(0.299, 0.587, 0.114);" + Shaders.lineBreak;
        shader += "float lumaNW = dot(rgbNW, luma);" + Shaders.lineBreak;
        shader += "float lumaNE = dot(rgbNE, luma);" + Shaders.lineBreak;
        shader += "float lumaSW = dot(rgbSW, luma);" + Shaders.lineBreak;
        shader += "float lumaSE = dot(rgbSE, luma);" + Shaders.lineBreak;
        shader += "float lumaM  = dot(rgbM,  luma);" + Shaders.lineBreak;
        shader += "float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));" + Shaders.lineBreak;
        shader += "float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));" + Shaders.lineBreak;
        shader += "mediump vec2 dir;" + Shaders.lineBreak;
        shader += "dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));" + Shaders.lineBreak;
        shader += "dir.y =  ((lumaNW + lumaSW) - (lumaNE + lumaSE));" + Shaders.lineBreak;
        shader += "float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25 * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);" + Shaders.lineBreak;
        shader += "float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);" + Shaders.lineBreak;
        shader += "dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) * inverseVP;" + Shaders.lineBreak;
        shader += "vec3 rgbA = 0.5 * (texture2D(tex, fragCoord * inverseVP + dir * (1.0 / 3.0 - 0.5)).xyz + texture2D(tex, fragCoord * inverseVP + dir * (2.0 / 3.0 - 0.5)).xyz);" + Shaders.lineBreak;
        shader += "vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tex, fragCoord * inverseVP + dir * -0.5).xyz + texture2D(tex, fragCoord * inverseVP + dir * 0.5).xyz);" + Shaders.lineBreak;
        shader += "float lumaB = dot(rgbB, luma);" + Shaders.lineBreak;
        shader += "if ((lumaB < lumaMin) || (lumaB > lumaMax))" + Shaders.lineBreak;
        shader += "    color = vec4(rgbA, texColor.a);" + Shaders.lineBreak;
        shader += "else" + Shaders.lineBreak;
        shader += "    color = vec4(rgbB, texColor.a);" + Shaders.lineBreak;
        shader += "return color;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "void main()" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec2 fragCoord = vTextureCoord * filterArea.xy;" + Shaders.lineBreak;
        shader += "vec4 color;" + Shaders.lineBreak;
        shader += "color = fxaa(uSampler, fragCoord, filterArea.xy, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);" + Shaders.lineBreak;
        shader += "gl_FragColor = color;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get VERTEX_FXAA():string
    {
        var shader:string = "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbNW;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbNE;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbSW;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbSE;" + Shaders.lineBreak;
        shader += "varying vec2 v_rgbM;" + Shaders.lineBreak;
        shader += "uniform vec4 filterArea;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "vec2 mapCoord( vec2 coord )" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "coord *= filterArea.xy;" + Shaders.lineBreak;
        shader += "coord += filterArea.zw;" + Shaders.lineBreak;
        shader += "return coord;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "vec2 unmapCoord( vec2 coord )" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "coord -= filterArea.zw;" + Shaders.lineBreak;
        shader += "coord /= filterArea.xy;" + Shaders.lineBreak;
        shader += "return coord;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "void texcoords(vec2 fragCoord, vec2 resolution, out vec2 v_rgbNW, out vec2 v_rgbNE, out vec2 v_rgbSW, out vec2 v_rgbSE, out vec2 v_rgbM)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec2 inverseVP = 1.0 / resolution.xy;" + Shaders.lineBreak;
        shader += "v_rgbNW = (fragCoord + vec2(-1.0, -1.0)) * inverseVP;" + Shaders.lineBreak;
        shader += "v_rgbNE = (fragCoord + vec2(1.0, -1.0)) * inverseVP;" + Shaders.lineBreak;
        shader += "v_rgbSW = (fragCoord + vec2(-1.0, 1.0)) * inverseVP;" + Shaders.lineBreak;
        shader += "v_rgbSE = (fragCoord + vec2(1.0, 1.0)) * inverseVP;" + Shaders.lineBreak;
        shader += "v_rgbM = vec2(fragCoord * inverseVP);" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vTextureCoord = aTextureCoord;" + Shaders.lineBreak;
        shader += "vec2 fragCoord = vTextureCoord * filterArea.xy;" + Shaders.lineBreak;
        shader += "texcoords(fragCoord, filterArea.xy, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get ALPHA():string
    {
        var shader:string = "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "uniform float uAlpha;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_FragColor = texture2D(uSampler, vTextureCoord) * uAlpha;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get FILTER_MATRIX():string
    {
        var shader:string = "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "uniform mat3 filterMatrix;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "varying vec2 vFilterCoord;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vFilterCoord = ( filterMatrix * vec3( aTextureCoord, 1.0)  ).xy;" + Shaders.lineBreak;
        shader += "vTextureCoord = aTextureCoord;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get DEFAULT():string
    {
        var shader:string = "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get FRAGMENT_MESH():string
    {
        var shader:string = "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "uniform vec4 uColor;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_FragColor = texture2D(uSampler, vTextureCoord) * uColor;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get VERTEX_MESH():string
    {
        var shader:string = "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "uniform mat3 translationMatrix;" + Shaders.lineBreak;
        shader += "uniform mat3 uTransform;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vTextureCoord = (uTransform * vec3(aTextureCoord, 1.0)).xy;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }



    public static get FRAGMENT_TILE():string
    {
        var shader:string = "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSampler;" + Shaders.lineBreak;
        shader += "uniform vec4 uColor;" + Shaders.lineBreak;
        shader += "uniform mat3 uMapCoord;" + Shaders.lineBreak;
        shader += "uniform vec4 uClampFrame;" + Shaders.lineBreak;
        shader += "uniform vec2 uClampOffset;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec2 coord = mod(vTextureCoord - uClampOffset, vec2(1.0, 1.0)) + uClampOffset;" + Shaders.lineBreak;
        shader += "coord = (uMapCoord * vec3(coord, 1.0)).xy;" + Shaders.lineBreak;
        shader += "coord = clamp(coord, uClampFrame.xy, uClampFrame.zw);" + Shaders.lineBreak;
        shader += "vec4 sample = texture2D(uSampler, coord);" + Shaders.lineBreak;
        shader += "gl_FragColor = sample * uColor;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }


    public static get VERTEX_TILE():string
    {
        var shader:string = "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "uniform mat3 translationMatrix;" + Shaders.lineBreak;
        shader += "uniform mat3 uTransform;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vTextureCoord = (uTransform * vec3(aTextureCoord, 1.0)).xy;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get VERTEX_PRIMITIVE():string
    {
        var shader:string = "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec4 aColor;" + Shaders.lineBreak;
        shader += "uniform mat3 translationMatrix;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "uniform float alpha;" + Shaders.lineBreak;
        shader += "uniform vec3 tint;" + Shaders.lineBreak;
        shader += "varying vec4 vColor;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * translationMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vColor = aColor * vec4(tint * alpha, alpha);" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get FRAGMENT_PRIMITIVE():string
    {
        var shader:string = "precision mediump float;" + Shaders.lineBreak;
        shader += "varying vec4 vColor;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_FragColor = vColor;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get FRAGMENT_MULTITEXTURE():string
    {
        var shader:string = "precision mediump float;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "varying vec4 vColor;" + Shaders.lineBreak;
        shader += "varying float vTextureId;" + Shaders.lineBreak;
        shader += "uniform sampler2D uSamplers[%count%];" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "vec4 color;" + Shaders.lineBreak;
        shader += "float textureId = floor(vTextureId+0.5);" + Shaders.lineBreak;        
        shader += "%forloop%" + Shaders.lineBreak;
        shader += "gl_FragColor = color * vColor;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }

    public static get VERTEX_MULTITEXTURE():string
    {
        var shader:string = "precision mediump float;" + Shaders.lineBreak;
        shader += "attribute vec2 aVertexPosition;" + Shaders.lineBreak;
        shader += "attribute vec2 aTextureCoord;" + Shaders.lineBreak;
        shader += "attribute vec4 aColor;" + Shaders.lineBreak;
        shader += "attribute float aTextureId;" + Shaders.lineBreak;
        shader += "uniform mat3 projectionMatrix;" + Shaders.lineBreak;
        shader += "varying vec2 vTextureCoord;" + Shaders.lineBreak;
        shader += "varying vec4 vColor;" + Shaders.lineBreak;
        shader += "varying float vTextureId;" + Shaders.lineBreak;
        shader += "void main(void)" + Shaders.lineBreak;
        shader += "{" + Shaders.lineBreak;
        shader += "gl_Position = vec4((projectionMatrix * vec3(aVertexPosition, 1.0)).xy, 0.0, 1.0);" + Shaders.lineBreak;
        shader += "vTextureCoord = aTextureCoord;" + Shaders.lineBreak;
        shader += "vTextureId = aTextureId;" + Shaders.lineBreak;
        shader += "vColor = aColor;" + Shaders.lineBreak;
        shader += "}" + Shaders.lineBreak;
        return shader;
    }
}