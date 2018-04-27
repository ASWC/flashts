define(["require", "exports", "./Utils"], function (require, exports, Utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class WebGLState {
        constructor(gl) {
            this.activeState = new Uint8Array(16);
            this.defaultState = new Uint8Array(16);
            this.defaultState[0] = 1;
            this.stackIndex = 0;
            this.stack = [];
            this.gl = gl;
            this.maxAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
            this.attribState = {
                tempAttribState: new Array(this.maxAttribs),
                attribState: new Array(this.maxAttribs),
            };
            this.blendModes = Utils_1.Utils.mapWebGLBlendModesToPixi(gl);
            this.nativeVaoExtension = (gl.getExtension('OES_vertex_array_object')
                || gl.getExtension('MOZ_OES_vertex_array_object')
                || gl.getExtension('WEBKIT_OES_vertex_array_object'));
        }
        push() {
            let state = this.stack[this.stackIndex];
            if (!state) {
                state = this.stack[this.stackIndex] = new Uint8Array(16);
            }
            ++this.stackIndex;
            for (let i = 0; i < this.activeState.length; i++) {
                state[i] = this.activeState[i];
            }
        }
        pop() {
            const state = this.stack[--this.stackIndex];
            this.setState(state);
        }
        setState(state) {
            this.setBlend(state[WebGLState.BLEND]);
            this.setDepthTest(state[WebGLState.DEPTH_TEST]);
            this.setFrontFace(state[WebGLState.FRONT_FACE]);
            this.setCullFace(state[WebGLState.CULL_FACE]);
            this.setBlendMode(state[WebGLState.BLEND_FUNC]);
        }
        setBlend(value) {
            var direction = 1;
            if (value) {
                direction = 1;
            }
            else {
                direction = 0;
            }
            if (this.activeState[WebGLState.BLEND] === direction) {
                return;
            }
            this.activeState[WebGLState.BLEND] = direction;
            this.gl[value ? 'enable' : 'disable'](this.gl.BLEND);
        }
        setBlendMode(value) {
            if (value === this.activeState[WebGLState.BLEND_FUNC]) {
                return;
            }
            this.activeState[WebGLState.BLEND_FUNC] = value;
            const mode = this.blendModes[value];
            if (mode.length === 2) {
                this.gl.blendFunc(mode[0], mode[1]);
            }
            else {
                this.gl.blendFuncSeparate(mode[0], mode[1], mode[2], mode[3]);
            }
        }
        setDepthTest(value) {
            var direction = 1;
            if (value) {
                direction = 1;
            }
            else {
                direction = 0;
            }
            if (this.activeState[WebGLState.DEPTH_TEST] === direction) {
                return;
            }
            this.activeState[WebGLState.DEPTH_TEST] = direction;
            this.gl[value ? 'enable' : 'disable'](this.gl.DEPTH_TEST);
        }
        setCullFace(value) {
            var direction = 1;
            if (value) {
                direction = 1;
            }
            else {
                direction = 0;
            }
            if (this.activeState[WebGLState.CULL_FACE] === direction) {
                return;
            }
            this.activeState[WebGLState.CULL_FACE] = direction;
            this.gl[value ? 'enable' : 'disable'](this.gl.CULL_FACE);
        }
        setFrontFace(value) {
            var direction = 1;
            if (value) {
                direction = 1;
            }
            else {
                direction = 0;
            }
            if (this.activeState[WebGLState.FRONT_FACE] === direction) {
                return;
            }
            this.activeState[WebGLState.FRONT_FACE] = direction;
            this.gl.frontFace(this.gl[value ? 'CW' : 'CCW']);
        }
        resetAttributes() {
            for (let i = 0; i < this.attribState.tempAttribState.length; i++) {
                this.attribState.tempAttribState[i] = 0;
            }
            for (let i = 0; i < this.attribState.attribState.length; i++) {
                this.attribState.attribState[i] = 0;
            }
            for (let i = 1; i < this.maxAttribs; i++) {
                this.gl.disableVertexAttribArray(i);
            }
        }
        resetToDefault() {
            if (this.nativeVaoExtension) {
                this.nativeVaoExtension.bindVertexArrayOES(null);
            }
            this.resetAttributes();
            for (let i = 0; i < this.activeState.length; ++i) {
                this.activeState[i] = 32;
            }
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
            this.setState(this.defaultState);
        }
    }
    WebGLState.BLEND = 0;
    WebGLState.DEPTH_TEST = 1;
    WebGLState.FRONT_FACE = 2;
    WebGLState.CULL_FACE = 3;
    WebGLState.BLEND_FUNC = 4;
    exports.WebGLState = WebGLState;
});
//# sourceMappingURL=WebGLState.js.map