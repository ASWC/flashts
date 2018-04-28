import { Utils } from "./Utils";
import { numberNumberArrayDictionary } from "../../display3D/types/DataDictionaries";
import { AttributeState } from "../../display3D/types/DataTypes";

export class WebGLState
{
    public static BLEND:number = 0;
    public static DEPTH_TEST :number= 1;
    public static FRONT_FACE:number = 2;
    public static CULL_FACE :number= 3;
    public static BLEND_FUNC:number = 4;
    public activeState:Uint8Array;
    public defaultState:Uint8Array;
    public stackIndex:number;
    public blendModes:numberNumberArrayDictionary;
    public maxAttribs:number;
    public attribState:AttributeState;

    public nativeVaoExtension:any;

    public gl:WebGLRenderingContext;
    
    public stack:any[];

    constructor(gl:WebGLRenderingContext)
    {
        this.activeState = new Uint8Array(16);
        this.defaultState = new Uint8Array(16);
        this.defaultState[0] = 1;
        this.stackIndex = 0;
        this.stack = [];
        this.gl = gl;
        this.maxAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
        this.attribState = new AttributeState(this.maxAttribs);
        this.blendModes = Utils.mapWebGLBlendModesToPixi(gl);
        this.nativeVaoExtension = (gl.getExtension('OES_vertex_array_object') || gl.getExtension('MOZ_OES_vertex_array_object') || gl.getExtension('WEBKIT_OES_vertex_array_object'));
    }

    public push():void
    {
        let state = this.stack[this.stackIndex];
        if (!state)
        {
            state = this.stack[this.stackIndex] = new Uint8Array(16);
        }
        ++this.stackIndex;
        for (let i = 0; i < this.activeState.length; i++)
        {
            state[i] = this.activeState[i];
        }
    }

    public pop():void
    {
        const state = this.stack[--this.stackIndex];

        this.setState(state);
    }

    public setState(state:any):void
    {
        this.setBlend(state[WebGLState.BLEND]);
        this.setDepthTest(state[WebGLState.DEPTH_TEST]);
        this.setFrontFace(state[WebGLState.FRONT_FACE]);
        this.setCullFace(state[WebGLState.CULL_FACE]);
        this.setBlendMode(state[WebGLState.BLEND_FUNC]);
    }

    public setBlend(value:boolean):void
    {
        var direction:number = 1;
        if(value)
        {
            direction = 1;
        }
        else
        {
            direction = 0;
        }
        if (this.activeState[WebGLState.BLEND] === direction)
        {
            return;
        }
        this.activeState[WebGLState.BLEND] = direction;
        this.gl[value ? 'enable' : 'disable'](this.gl.BLEND);
    }

    public setBlendMode(value:number):void
    {
        if (value === this.activeState[WebGLState.BLEND_FUNC])
        {
            return;
        }
        this.activeState[WebGLState.BLEND_FUNC] = value;
        const mode = this.blendModes[value];
        if (mode.length === 2)
        {
            this.gl.blendFunc(mode[0], mode[1]);
        }
        else
        {
            this.gl.blendFuncSeparate(mode[0], mode[1], mode[2], mode[3]);
        }
    }

    public setDepthTest(value:boolean):void
    {
        var direction:number = 1;
        if(value)
        {
            direction = 1;
        }
        else
        {
            direction = 0;
        }
        if (this.activeState[WebGLState.DEPTH_TEST] === direction)
        {
            return;
        }
        this.activeState[WebGLState.DEPTH_TEST] = direction;
        this.gl[value ? 'enable' : 'disable'](this.gl.DEPTH_TEST);
    }

    public setCullFace(value:boolean):void
    {
        var direction:number = 1;
        if(value)
        {
            direction = 1;
        }
        else
        {
            direction = 0;
        }
        if (this.activeState[WebGLState.CULL_FACE] === direction)
        {
            return;
        }
        this.activeState[WebGLState.CULL_FACE] = direction;
        this.gl[value ? 'enable' : 'disable'](this.gl.CULL_FACE);
    }

    public setFrontFace(value:boolean):void
    {
        var direction:number = 1;
        if(value)
        {
            direction = 1;
        }
        else
        {
            direction = 0;
        }
        if (this.activeState[WebGLState.FRONT_FACE] === direction)
        {
            return;
        }
        this.activeState[WebGLState.FRONT_FACE] = direction;
        this.gl.frontFace(this.gl[value ? 'CW' : 'CCW']);
    }

    public resetAttributes():void
    {
        for (let i = 0; i < this.attribState.tempAttribState.length; i++)
        {
            this.attribState.tempAttribState[i] = 0;
        }
        for (let i = 0; i < this.attribState.attribState.length; i++)
        {
            this.attribState.attribState[i] = 0;
        }
        for (let i = 1; i < this.maxAttribs; i++)
        {
            this.gl.disableVertexAttribArray(i);
        }
    }

    public resetToDefault():void
    {
        if (this.nativeVaoExtension)
        {
            this.nativeVaoExtension.bindVertexArrayOES(null);
        }
        this.resetAttributes();
        for (let i = 0; i < this.activeState.length; ++i)
        {
            this.activeState[i] = 32;
        }
        this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
        this.setState(this.defaultState);
    }
}