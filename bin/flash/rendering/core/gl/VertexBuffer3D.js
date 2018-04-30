define(["require", "exports", "flash/display/BaseObject"], function (require, exports, BaseObject_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class VertexBuffer3D extends BaseObject_1.BaseObject {
        constructor(gl, state = null) {
            super();
            this.attributes = [];
            this.gl = gl;
            this.nativeVaoExtension = null;
            if (!VertexBuffer3D.FORCE_NATIVE) {
                this.nativeVaoExtension = gl.getExtension('OES_vertex_array_object') ||
                    gl.getExtension('MOZ_OES_vertex_array_object') ||
                    gl.getExtension('WEBKIT_OES_vertex_array_object');
            }
            this.nativeState = state;
            if (this.nativeVaoExtension) {
                this.nativeVao = this.nativeVaoExtension.createVertexArrayOES();
                var maxAttribs = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
                this.nativeState = {
                    tempAttribState: new Array(maxAttribs),
                    attribState: new Array(maxAttribs)
                };
            }
            this.indexBuffer = null;
            this.dirty = false;
        }
        bind() {
            if (this.nativeVao) {
                this.nativeVaoExtension.bindVertexArrayOES(this.nativeVao);
                if (this.dirty) {
                    this.dirty = false;
                    this.activate();
                    return this;
                }
                if (this.indexBuffer) {
                    this.indexBuffer.bind();
                }
            }
            else {
                this.activate();
            }
            return this;
        }
        ;
        unbind() {
            if (this.nativeVao) {
                this.nativeVaoExtension.bindVertexArrayOES(null);
            }
            return this;
        }
        ;
        activate() {
            var gl = this.gl;
            var lastBuffer = null;
            for (var i = 0; i < this.attributes.length; i++) {
                var attrib = this.attributes[i];
                if (lastBuffer !== attrib.buffer) {
                    attrib.buffer.bind();
                    lastBuffer = attrib.buffer;
                }
                gl.vertexAttribPointer(attrib.attribute.location, attrib.attribute.size, attrib.type || gl.FLOAT, attrib.normalized || false, attrib.stride || 0, attrib.start || 0);
            }
            this.setVertexAttribArrays(gl, this.attributes, this.nativeState);
            if (this.indexBuffer) {
                this.indexBuffer.bind();
            }
            return this;
        }
        ;
        setVertexAttribArrays(gl, attribs, state) {
            var i;
            if (state) {
                var tempAttribState = state.tempAttribState, attribState = state.attribState;
                for (i = 0; i < tempAttribState.length; i++) {
                    tempAttribState[i] = false;
                }
                for (i = 0; i < attribs.length; i++) {
                    tempAttribState[attribs[i].attribute.location] = true;
                }
                for (i = 0; i < attribState.length; i++) {
                    if (attribState[i] !== tempAttribState[i]) {
                        attribState[i] = tempAttribState[i];
                        if (state.attribState[i]) {
                            gl.enableVertexAttribArray(i);
                        }
                        else {
                            gl.disableVertexAttribArray(i);
                        }
                    }
                }
            }
            else {
                for (i = 0; i < attribs.length; i++) {
                    var attrib = attribs[i];
                    gl.enableVertexAttribArray(attrib.attribute.location);
                }
            }
        }
        ;
        addAttribute(buffer, attribute, type, normalized, stride, start) {
            this.attributes.push({
                buffer: buffer,
                attribute: attribute,
                location: attribute.location,
                type: type || this.gl.FLOAT,
                normalized: normalized || false,
                stride: stride || 0,
                start: start || 0
            });
            this.dirty = true;
            return this;
        }
        ;
        addIndex(buffer) {
            this.indexBuffer = buffer;
            this.dirty = true;
            return this;
        }
        ;
        clear() {
            if (this.nativeVao) {
                this.nativeVaoExtension.bindVertexArrayOES(this.nativeVao);
            }
            this.attributes.length = 0;
            this.indexBuffer = null;
            return this;
        }
        ;
        draw(type, size, start = 0) {
            var gl = this.gl;
            if (this.indexBuffer) {
                size = size || this.indexBuffer.data['length'];
                gl.drawElements(type, size, gl.UNSIGNED_SHORT, (start || 0) * 2);
            }
            else {
                gl.drawArrays(type, start, size || this.getSize());
            }
            return this;
        }
        ;
        destroy() {
            this.gl = null;
            this.indexBuffer = null;
            this.attributes = null;
            this.nativeState = null;
            if (this.nativeVao) {
                this.nativeVaoExtension.deleteVertexArrayOES(this.nativeVao);
            }
            this.nativeVaoExtension = null;
            this.nativeVao = null;
        }
        ;
        getSize() {
            var attrib = this.attributes[0];
            return attrib.buffer.data.length / ((attrib.stride / 4) || attrib.attribute.size);
        }
        ;
    }
    VertexBuffer3D.FORCE_NATIVE = false;
    exports.VertexBuffer3D = VertexBuffer3D;
});
//# sourceMappingURL=VertexBuffer3D.js.map