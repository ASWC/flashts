import { Utils } from "flash/rendering/webgl/Utils";
import { BaseObject } from "flash/rendering/core/BaseObject";
import { GLAttributeData } from "flash/display3D/types/DataTypes";
import { AttributeDataDictionary } from "flash/display3D/types/DataDictionaries";
import { StringNumberDictionary } from "flash/display3D/types/DataDictionaries";
import { StringStringDictionary } from "flash/display3D/types/DataDictionaries";

export class GLShader extends BaseObject
{
    public static GL_TABLE = null;

    public static GLSL_SINGLE_SETTERS = {
        float: function setSingleFloat(gl:WebGLRenderingContext, location, value) { gl.uniform1f(location, value); },
        vec2: function setSingleVec2(gl:WebGLRenderingContext, location, value) { gl.uniform2f(location, value[0], value[1]); },
        vec3: function setSingleVec3(gl:WebGLRenderingContext, location, value) { gl.uniform3f(location, value[0], value[1], value[2]); },
        vec4: function setSingleVec4(gl:WebGLRenderingContext, location, value) { gl.uniform4f(location, value[0], value[1], value[2], value[3]); },    
        int: function setSingleInt(gl:WebGLRenderingContext, location, value) { gl.uniform1i(location, value); },
        ivec2: function setSingleIvec2(gl:WebGLRenderingContext, location, value) { gl.uniform2i(location, value[0], value[1]); },
        ivec3: function setSingleIvec3(gl:WebGLRenderingContext, location, value) { gl.uniform3i(location, value[0], value[1], value[2]); },
        ivec4: function setSingleIvec4(gl:WebGLRenderingContext, location, value) { gl.uniform4i(location, value[0], value[1], value[2], value[3]); },    
        bool: function setSingleBool(gl:WebGLRenderingContext, location, value) { gl.uniform1i(location, value); },
        bvec2: function setSingleBvec2(gl:WebGLRenderingContext, location, value) { gl.uniform2i(location, value[0], value[1]); },
        bvec3: function setSingleBvec3(gl:WebGLRenderingContext, location, value) { gl.uniform3i(location, value[0], value[1], value[2]); },
        bvec4: function setSingleBvec4(gl:WebGLRenderingContext, location, value) { gl.uniform4i(location, value[0], value[1], value[2], value[3]); },    
        mat2: function setSingleMat2(gl:WebGLRenderingContext, location, value) { gl.uniformMatrix2fv(location, false, value); },
        mat3: function setSingleMat3(gl:WebGLRenderingContext, location, value) { gl.uniformMatrix3fv(location, false, value); },
        mat4: function setSingleMat4(gl:WebGLRenderingContext, location, value) { gl.uniformMatrix4fv(location, false, value); },    
        sampler2D: function setSingleSampler2D(gl:WebGLRenderingContext, location, value) { gl.uniform1i(location, value); },
    };

    public static GLSL_ARRAY_SETTERS = {
        float: function setFloatArray(gl:WebGLRenderingContext, location, value) { gl.uniform1fv(location, value); },
        vec2: function setVec2Array(gl:WebGLRenderingContext, location, value) { gl.uniform2fv(location, value); },
        vec3: function setVec3Array(gl:WebGLRenderingContext, location, value) { gl.uniform3fv(location, value); },
        vec4: function setVec4Array(gl:WebGLRenderingContext, location, value) { gl.uniform4fv(location, value); },
        int: function setIntArray(gl:WebGLRenderingContext, location, value) { gl.uniform1iv(location, value); },
        ivec2: function setIvec2Array(gl:WebGLRenderingContext, location, value) { gl.uniform2iv(location, value); },
        ivec3: function setIvec3Array(gl:WebGLRenderingContext, location, value) { gl.uniform3iv(location, value); },
        ivec4: function setIvec4Array(gl:WebGLRenderingContext, location, value) { gl.uniform4iv(location, value); },
        bool: function setBoolArray(gl:WebGLRenderingContext, location, value) { gl.uniform1iv(location, value); },
        bvec2: function setBvec2Array(gl:WebGLRenderingContext, location, value) { gl.uniform2iv(location, value); },
        bvec3: function setBvec3Array(gl:WebGLRenderingContext, location, value) { gl.uniform3iv(location, value); },
        bvec4: function setBvec4Array(gl:WebGLRenderingContext, location, value) { gl.uniform4iv(location, value); },
        sampler2D: function setSampler2DArray(gl:WebGLRenderingContext, location, value) { gl.uniform1iv(location, value); },
    };
    
    public static GL_TO_GLSL_TYPES:StringStringDictionary = {
      'FLOAT':       'float',
      'FLOAT_VEC2':  'vec2',
      'FLOAT_VEC3':  'vec3',
      'FLOAT_VEC4':  'vec4',    
      'INT':         'int',
      'INT_VEC2':    'ivec2',
      'INT_VEC3':    'ivec3',
      'INT_VEC4':    'ivec4',      
      'BOOL':        'bool',
      'BOOL_VEC2':   'bvec2',
      'BOOL_VEC3':   'bvec3',
      'BOOL_VEC4':   'bvec4',      
      'FLOAT_MAT2':  'mat2',
      'FLOAT_MAT3':  'mat3',
      'FLOAT_MAT4':  'mat4',      
      'SAMPLER_2D':  'sampler2D'  
    };

    public static GLSL_TO_SIZE:StringNumberDictionary = {
        'float':    1,
        'vec2':     2,
        'vec3':     3,
        'vec4':     4,    
        'int':      1,
        'ivec2':    2,
        'ivec3':    3,
        'ivec4':    4,    
        'bool':     1,
        'bvec2':    2,
        'bvec3':    3,
        'bvec4':    4,    
        'mat2':     4,
        'mat3':     9,
        'mat4':     16,    
        'sampler2D':  1
    };

    public gl:WebGLRenderingContext;
    public program:WebGLProgram;
    public attributes:AttributeDataDictionary;
    public attributesuniforms:any;
    public uniformData:any;    
    public uniforms:any;    
    public location:any;    
    public size:number; 
    protected precisionType:string;

    constructor(gl:WebGLRenderingContext, vertexSrc:string, fragmentSrc:string, attributeLocations:any = null, precision:number = 2)
    {
        super();
        this.size = 0;
        this.precisionType = "mediump";
        if(precision == 2)
        {
            this.precisionType = "mediump";
        }
        this.gl = gl;
        if(vertexSrc)
        {
            vertexSrc = this.setPrecision(vertexSrc);
        }
        if(fragmentSrc)
        {
            fragmentSrc = this.setPrecision(fragmentSrc);
        }
        if(vertexSrc && fragmentSrc && this.gl)
        {
            this.program = this.compileProgram(gl, vertexSrc, fragmentSrc, attributeLocations);
        }
        if(this.gl)
        {
            this.attributes = this.extractAttributes(gl, this.program);

            this.reveal(this.attributes)

            this.uniformData = this.extractUniforms(gl, this.program);
            this.uniforms = this.generateUniformAccessObject(gl, this.uniformData);
        }        
    }

    public generateUniformAccessObject(gl:WebGLRenderingContext, uniformData:any):any
    {
        var uniforms:any = {data:{}};    
        uniforms.gl = gl;    
        var uniformKeys= Object.keys(uniformData);    
        for (var i = 0; i < uniformKeys.length; i++)
        {
            var fullName = uniformKeys[i];    
            var nameTokens = fullName.split('.');
            var name = nameTokens[nameTokens.length - 1];    
            var uniformGroup = this.getUniformGroup(nameTokens, uniforms);    
            var uniform =  uniformData[fullName];
            uniformGroup.data[name] = uniform;    
            uniformGroup.gl = gl;    
            Object.defineProperty(uniformGroup, name, {
                get: this.generateGetter(name),
                set: this.generateSetter(name, uniform)
            });
        }    
        return uniforms;
    };

    public generateSetter(name, uniform)
    {
        return function(value) {
            this.data[name].value = value;
            var location = this.data[name].location;
            if (uniform.size === 1)
            {
                GLShader.GLSL_SINGLE_SETTERS[uniform.type](this.gl, location, value);
            }
            else
            {
                GLShader.GLSL_ARRAY_SETTERS[uniform.type](this.gl, location, value);
            }
        };
    }

    public generateGetter = function(name)
    {
        return function() {
            return this.data[name].value;
        };
    };

    public getUniformGroup(nameTokens, uniform)
    {
        var cur = uniform;    
        for (var i = 0; i < nameTokens.length - 1; i++)
        {
            var o = cur[nameTokens[i]] || {data:{}};
            cur[nameTokens[i]] = o;
            cur = o;
        }    
        return cur;
    }

    public extractUniforms(gl:WebGLRenderingContext, program:WebGLProgram):any
    {
        var uniforms:any = {};    
        var totalUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);    
        for (var i = 0; i < totalUniforms; i++)
        {
            var uniformData = gl.getActiveUniform(program, i);
            var name = uniformData.name.replace(/\[.*?\]/, "");
            var type = this.mapType(gl, uniformData.type );    
            uniforms[name] = {
                type:type,
                size:uniformData.size,
                location:gl.getUniformLocation(program, name),
                value:Utils.defaultValue(type, uniformData.size)
            };
        }    
        return uniforms;
    };

    public extractAttributes(gl:WebGLRenderingContext, program:WebGLProgram):AttributeDataDictionary
    {
        var attributes:AttributeDataDictionary = {};    
        var totalAttributes:number = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);    
        for (var i = 0; i < totalAttributes; i++)
        {
            var attribData:WebGLActiveInfo = gl.getActiveAttrib(program, i);
            var type:string = this.mapType(gl, attribData.type);    
            attributes[attribData.name] = new GLAttributeData(type, this.mapSize(type), gl.getAttribLocation(program, attribData.name), this.pointer)            
        }    
        return attributes;
    };

    public pointer(type:number, normalized:boolean, stride:number, start:number):void
    {
        this.gl.vertexAttribPointer(this.location, this.size, type || this.gl.FLOAT, normalized || false, stride || 0, start || 0);
    };

    public mapType(gl:WebGLRenderingContext, type:number):string
    {
        if(!GLShader.GL_TABLE) 
        {
            var typeNames = Object.keys(GLShader.GL_TO_GLSL_TYPES);    
            GLShader.GL_TABLE = {};    
            for(var i = 0; i < typeNames.length; ++i) 
            {
                var tn = typeNames[i];
                GLShader.GL_TABLE[ gl[tn] ] = GLShader.GL_TO_GLSL_TYPES[tn];
            }
        }    
        return GLShader.GL_TABLE[type];
    };

    public mapSize(type:string):number
    { 
        return GLShader.GLSL_TO_SIZE[type];
    };

    public compileProgram (gl:WebGLRenderingContext, vertexSrc:string, fragmentSrc:string, attributeLocations:any):WebGLProgram
    {
        var glVertShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
        var glFragShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);    
        var program = gl.createProgram();    
        gl.attachShader(program, glVertShader);
        gl.attachShader(program, glFragShader);
        if(attributeLocations)
        {
            for(var i in attributeLocations)
            {
                gl.bindAttribLocation(program, attributeLocations[i], i);
            }
        }    
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        {
            console.error('Pixi.js Error: Could not initialize shader.');
            console.error('gl.VALIDATE_STATUS', gl.getProgramParameter(program, gl.VALIDATE_STATUS));
            console.error('gl.getError()', gl.getError());
            if (gl.getProgramInfoLog(program) !== '')
            {
                console.warn('Pixi.js Warning: gl.getProgramInfoLog()', gl.getProgramInfoLog(program));
            }    
            gl.deleteProgram(program);
            program = null;
        }
        gl.deleteShader(glVertShader);
        gl.deleteShader(glFragShader);    
        return program;
    };

    public compileShader (gl:WebGLRenderingContext, type:number, src:string):WebGLShader
    {        
        var shader = gl.createShader(type);  
        gl.shaderSource(shader, src);
        gl.compileShader(shader);    
       
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        {
            return null;
        }    
        return shader;
    };

    public setPrecision(src:string)
    {
        if(src.substring(0, 9) !== 'precision')
        {
            return 'precision ' + this.precisionType + ' float;\n' + src;
        }    
        return src;
    };
 
    public bind():GLShader
    {
    
        this.gl.useProgram(this.program);
        return this;
    };

    /**
     * Destroys this shader
     * TODO
     */
    public destroy()
    {
        this.attributes = null;
        this.uniformData = null;
        this.uniforms = null;

        var gl = this.gl;
        gl.deleteProgram(this.program);
    };


}
