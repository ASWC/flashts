import { Utils } from "flash/rendering/webgl/Utils";
import { BaseObject } from "flash/display/BaseObject";
import { GLAttributeData } from "flash/display3D/types/DataTypes";
import { ShaderUnniformData } from "flash/display3D/types/DataTypes";
import { AttributeDataDictionary } from "flash/display3D/types/DataDictionaries";
import { StringNumberDictionary } from "flash/display3D/types/DataDictionaries";
import { StringStringDictionary } from "flash/display3D/types/DataDictionaries";
import { ShaderUnnifromDataDictionary } from "flash/display3D/types/DataDictionaries";
import { ShaderUnniformAccess } from "flash/display3D/types/DataTypes";



export class GLShader extends BaseObject
{
    protected static GL_TABLE:StringStringDictionary = null;

    public static GLSL_SINGLE_SETTERS = 
    {
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

    public static GLSL_ARRAY_SETTERS = 
    {
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
    
    protected static GL_TO_GLSL_TYPES:StringStringDictionary = 
    {
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

    protected static GLSL_TO_SIZE:StringNumberDictionary = 
    {
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

    protected gl:WebGLRenderingContext;
    protected program:WebGLProgram;
    protected _attributes:AttributeDataDictionary;
    protected _uniforms:ShaderUnniformAccess;  
    protected uniformData:ShaderUnnifromDataDictionary;        
    protected location:number;    
    protected size:number; 

    constructor(gl:WebGLRenderingContext, vertexSrc:string, fragmentSrc:string, attributeLocations:number[] = null)
    {
        super();
        this.size = 0;
        this.gl = gl;
        if(vertexSrc && fragmentSrc && this.gl)
        {
            this.program = this.compileProgram(gl, vertexSrc, fragmentSrc, attributeLocations);
        }
        if(this.gl)
        {
            this._attributes = this.extractAttributes(gl, this.program);
            this.uniformData = this.extractUniforms(gl, this.program);
            this._uniforms = this.generateUniformAccessObject(gl, this.uniformData);
        }        
    }

    public generateUniformAccessObject(gl:WebGLRenderingContext, uniformData:ShaderUnnifromDataDictionary):ShaderUnniformAccess
    {
        var uniforms:ShaderUnniformAccess = new ShaderUnniformAccess(gl);         
        var uniformKeys:string[] = Object.keys(uniformData);    
        for (var i = 0; i < uniformKeys.length; i++)
        {
            var fullName:string = uniformKeys[i]; 
            var nameTokens:string[] = fullName.split('.');
            var name:string = nameTokens[nameTokens.length - 1]; 
            var uniformGroup:ShaderUnniformAccess = this.getUniformGroup(nameTokens, uniforms);  
            var uniform:ShaderUnniformData = uniformData[fullName];
            uniformGroup.data[name] = uniform;    
            uniformGroup.gl = gl;    
        }    
        return uniforms;
    };

    public get attributes():AttributeDataDictionary
    {
        return this._attributes;
    }

    public get uniforms():ShaderUnniformAccess
    {
        return this._uniforms;
    }

    public getUniformGroup(nameTokens:string[], uniform:ShaderUnniformAccess):ShaderUnniformAccess
    {  
        for (var i:number = 0; i < nameTokens.length - 1; i++)
        {
            var o:ShaderUnniformAccess = uniform[nameTokens[i]] || {data:{}};
            uniform[nameTokens[i]] = o;
            uniform = o;
        }    
        return uniform;
    }

    public extractUniforms(gl:WebGLRenderingContext, program:WebGLProgram):ShaderUnnifromDataDictionary
    {
        var uniforms:ShaderUnnifromDataDictionary = {};  
        var totalUniforms:number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);    
        for (var i = 0; i < totalUniforms; i++)
        {
            var uniformData:WebGLActiveInfo = gl.getActiveUniform(program, i);
            var name:string = uniformData.name.replace(/\[.*?\]/, "");
            var type:string = this.mapType(gl, uniformData.type ); 
            uniforms[name] = new ShaderUnniformData(type, uniformData.size, gl.getUniformLocation(program, name), Utils.defaultValue(type, uniformData.size));
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
            var typeNames:string[] = Object.keys(GLShader.GL_TO_GLSL_TYPES);    
            GLShader.GL_TABLE = {};    
            for(var i = 0; i < typeNames.length; ++i) 
            {
                var tn:string = typeNames[i];
                GLShader.GL_TABLE[ gl[tn] ] = GLShader.GL_TO_GLSL_TYPES[tn];
            }
        }    
        return GLShader.GL_TABLE[type];
    };

    public mapSize(type:string):number
    { 
        return GLShader.GLSL_TO_SIZE[type];
    };

    public compileProgram (gl:WebGLRenderingContext, vertexSrc:string, fragmentSrc:string, attributeLocations:number[]):WebGLProgram
    {
        var glVertShader:WebGLShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
        var glFragShader:WebGLShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);    
        var program:WebGLProgram = gl.createProgram();    
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
        var shader:WebGLShader = gl.createShader(type);  
        gl.shaderSource(shader, src);
        gl.compileShader(shader);         
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        {
            return null;
        }    
        return shader;
    };
 
    public bind():GLShader
    {    
        this.gl.useProgram(this.program);
        return this;
    };

    public destroy():void
    {
        this._attributes = null;
        this.uniformData = null;
        this._uniforms = null;
        this.gl.deleteProgram(this.program);
    };


}
