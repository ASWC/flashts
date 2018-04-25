var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
define(["require", "exports", "flash/display/InteractiveObject", "flash/display/Stage", "flash/geom/Rectangle", "flash/events/MouseEvent", "flash/events/Event", "flash/events/KeyboardEvent", "flash/text/TextFormat"], function (require, exports, InteractiveObject_1, Stage_1, Rectangle_1, MouseEvent_1, Event_1, KeyboardEvent_1, TextFormat_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var TextField = /** @class */ (function (_super) {
        __extends(TextField, _super);
        function TextField() {
            var _this = _super.call(this) || this;
            _this._tarea = document.createElement("textarea");
            _this._tareaAdded = false;
            _this._tarea.setAttribute("style", "font-family:Times New Roman; font-size:12px; z-index:-1; \
											position:absolute; top:0px; left:0px; opacity:0; pointer-events:none; user-select:none; width:100px; height:100px;");
            _this._tarea.addEventListener("input", _this._tfInput.bind(_this), false);
            //this._tarea.addEventListener("mousedown", function(e){e.preventDefault();});	
            _this._stage = null;
            _this._type = "dynamic"; // "dynamic" or "input"
            _this._selectable = true;
            _this._mdown = false;
            _this._curPos = -1;
            _this._select = null; // selection
            _this._metrics = null; // metrics of rendered text
            _this._wordWrap = false; // wrap words 
            _this._textW = 0; // width of text
            _this._textH = 0; // height of text
            _this._areaW = 100; // width of whole TF area
            _this._areaH = 100; // height of whole TF area
            _this._text = ""; // current text
            _this._tForm = new TextFormat_1.TextFormat();
            _this._rwidth = 0;
            _this._rheight = 0;
            _this._background = false;
            _this._border = false;
            _this._texture = Stage_1.Stage.gl.createTexture(); // texture
            _this._tcArray = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0]);
            _this._tcBuffer = Stage_1.Stage.gl.createBuffer(); // texture coordinates buffer
            Stage_1.Stage._setBF(_this._tcBuffer);
            Stage_1.Stage.gl.bufferData(Stage_1.Stage.gl.ARRAY_BUFFER, _this._tcArray, Stage_1.Stage.gl.STATIC_DRAW);
            _this._fArray = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
            _this._vBuffer = Stage_1.Stage.gl.createBuffer(); // vertices buffer for 4 vertices
            Stage_1.Stage._setBF(_this._vBuffer);
            Stage_1.Stage.gl.bufferData(Stage_1.Stage.gl.ARRAY_BUFFER, _this._fArray, Stage_1.Stage.gl.STATIC_DRAW);
            _this.addEventListener2(Event_1.Event.ADDED_TO_STAGE, _this._tfATS, _this);
            _this.addEventListener2(Event_1.Event.REMOVED_FROM_STAGE, _this._tfRFS, _this);
            _this.addEventListener2(MouseEvent_1.MouseEvent.MOUSE_DOWN, _this._tfMD, _this);
            _this.addEventListener2(KeyboardEvent_1.KeyboardEvent.KEY_UP, _this._tfKU, _this);
            _this._brect = new Rectangle_1.Rectangle();
            return _this;
        }
        TextField.prototype._getLocRect = function () {
            return this._brect;
        };
        TextField.prototype._loseFocus = function () {
            if (this._tareaAdded)
                document.body.removeChild(this._tarea);
            this._tareaAdded = false;
            this._curPos = -1;
            this._update();
        };
        TextField.prototype._tfKU = function (e) {
            this._tfInput(null);
        };
        TextField.prototype._tfInput = function (e) {
            if (this._type != "input")
                return;
            this._text = this._tarea.value;
            this._select = null;
            this._curPos = this._tarea.selectionStart;
            this.setSelection(this._tarea.selectionStart, this._tarea.selectionEnd);
        };
        TextField.prototype._tfATS = function (e) {
            this._stage = this.stage;
        };
        TextField.prototype._tfRFS = function (e) {
            this._loseFocus();
        };
        TextField.prototype._tfMD = function (e) {
            if (!this._selectable)
                return;
            if (this._type == "input") {
                this._tareaAdded = true;
                document.body.appendChild(this._tarea);
                this._tarea.value = this._text;
                this._tarea.focus();
            }
            var ind = this.getCharIndexAtPoint(this.mouseX, this.mouseY);
            this._mdown = true;
            this._curPos = ind;
            this.setSelection(ind, ind);
            this._update();
            this.stage.addEventListener2(MouseEvent_1.MouseEvent.MOUSE_MOVE, this._tfMM, this);
            this.stage.addEventListener2(MouseEvent_1.MouseEvent.MOUSE_UP, this._tfMU, this);
        };
        TextField.prototype._tfMM = function (e) {
            if (!this._selectable || !this._mdown)
                return;
            var ind = this.getCharIndexAtPoint(this.mouseX, this.mouseY);
            this.setSelection(this._curPos, ind);
        };
        TextField.prototype._tfMU = function (e) {
            if (!this._selectable)
                return;
            //var sel = this._select;
            //if(sel) if(sel.from != sel.to) this._tarea.setSelectionRange(sel.from, sel.to); 
            //this.setSelection(this._curPos, ind);
            this._mdown = false;
            if (this._type == "input")
                this._tarea.focus();
            this._stage.removeEventListener(MouseEvent_1.MouseEvent.MOUSE_MOVE, this._tfMM);
            this._stage.removeEventListener(MouseEvent_1.MouseEvent.MOUSE_UP, this._tfMU);
        };
        TextField.prototype.appendText = function (newText) {
            this._text += newText;
            this._update();
        };
        TextField.prototype.getCharBoundaries = function (charIndex) {
            //if(charIndex>=this._text.length) {var lw =  return new Rectangle(0,0,30,30);}
            var ctx = TextFormat_1.TextFormat._ctxext;
            this._tForm.setContext(ctx);
            var m = this._metrics;
            var l = this.getLineIndexOfChar(charIndex);
            if (m[l].words.length == 0)
                return new Rectangle_1.Rectangle(m[l].x, m[l].y, m[l].width, m[l].height);
            var w = 0;
            while (w + 1 < m[l].words.length && m[l].words[w + 1].charOffset <= charIndex)
                w++;
            var word = m[l].words[w];
            var pref = word.word.substring(0, charIndex - word.charOffset);
            var rect = new Rectangle_1.Rectangle(word.x + ctx.measureText(pref).width, word.y, 0, word.height);
            rect.width = ctx.measureText(this._text.charAt(charIndex)).width;
            var nw = m[l].words[w + 1];
            if (nw && nw.charOffset == charIndex + 1)
                rect.width = nw.x - rect.x;
            return rect;
        };
        TextField.prototype.getCharIndexAtPoint = function (x, y) {
            if (this._text.length == 0)
                return 0;
            var ctx = TextFormat_1.TextFormat._ctxext;
            this._tForm.setContext(ctx);
            var m = this._metrics;
            var l = this.getLineIndexAtPoint(x, y);
            x = Math.max(m[l].x, Math.min(m[l].x + m[l].width, x));
            var w = 0;
            while (w + 1 < m[l].words.length && m[l].words[w + 1].x <= x)
                w++;
            var word = m[l].words[w];
            var ci = word.charOffset;
            var cx = word.x;
            while (true) {
                var cw = ctx.measureText(this._text.charAt(ci)).width;
                if (cx + cw * 0.5 < x && cw != 0) {
                    cx += cw;
                    ci++;
                }
                else
                    break;
            }
            return ci;
        };
        TextField.prototype.getLineIndexAtPoint = function (x, y) {
            var m = this._metrics;
            var l = 0;
            while (l + 1 < m.length && m[l + 1].y <= y)
                l++;
            return l;
        };
        TextField.prototype.getLineIndexOfChar = function (charIndex) {
            var m = this._metrics;
            var l = 0;
            while (l + 1 < m.length && m[l + 1].charOffset <= charIndex)
                l++;
            return l;
        };
        TextField.prototype.getTextFormat = function (ntf) {
            return this._tForm.clone();
        };
        TextField.prototype.setTextFormat = function (ntf) {
            this._tForm.set(ntf);
            this._tarea.style.fontFamily = ntf.font;
            this._tarea.style.fontSize = ntf.size + "px";
            this._tarea.style.textAlign = ntf.align;
            this._update();
        };
        TextField.prototype.setSelection = function (begin, end) {
            var a = Math.min(begin, end), b = Math.max(begin, end), s = this._select;
            if (s == null || s.from != a || s.to != b) {
                this._select = { from: a, to: b };
                //this._tarea.setSelectionRange(a,b);
                this._tarea.selectionStart = a;
                this._tarea.selectionEnd = b;
                this._update();
            }
        };
        TextField.prototype._update = function () {
            var w = this._brect.width = this._areaW;
            var h = this._brect.height = this._areaH;
            if (w == 0 || h == 0)
                return;
            var data = this._tForm.getImageData(this._text, this);
            this._textW = data.tw;
            this._textH = data.th;
            if (data.rw != this._rwidth || data.rh != this._rheight) {
                Stage_1.Stage.gl.deleteTexture(this._texture);
                this._texture = Stage_1.Stage.gl.createTexture();
            }
            Stage_1.Stage._setTEX(this._texture);
            //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data.image);
            Stage_1.Stage.gl.texImage2D(Stage_1.Stage.gl.TEXTURE_2D, 0, Stage_1.Stage.gl.RGBA, data.rw, data.rh, 0, Stage_1.Stage.gl.RGBA, Stage_1.Stage.gl.UNSIGNED_BYTE, data.ui8buff);
            //gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data.imageData);
            Stage_1.Stage.gl.texParameteri(Stage_1.Stage.gl.TEXTURE_2D, Stage_1.Stage.gl.TEXTURE_MAG_FILTER, Stage_1.Stage.gl.LINEAR);
            Stage_1.Stage.gl.texParameteri(Stage_1.Stage.gl.TEXTURE_2D, Stage_1.Stage.gl.TEXTURE_MIN_FILTER, Stage_1.Stage.gl.LINEAR_MIPMAP_LINEAR);
            Stage_1.Stage.gl.generateMipmap(Stage_1.Stage.gl.TEXTURE_2D);
            this._rwidth = data.rw;
            this._rheight = data.rh;
            var sx = w / data.rw;
            var sy = h / data.rh;
            var ta = this._tcArray;
            ta[2] = ta[6] = sx;
            ta[5] = ta[7] = sy;
            Stage_1.Stage._setBF(this._tcBuffer);
            Stage_1.Stage.gl.vertexAttribPointer(Stage_1.Stage._main._sprg.tca, 2, Stage_1.Stage.gl.FLOAT, false, 0, 0);
            Stage_1.Stage.gl.bufferSubData(Stage_1.Stage.gl.ARRAY_BUFFER, 0, ta);
            var fa = this._fArray;
            fa[3] = fa[9] = w;
            fa[7] = fa[10] = h;
            Stage_1.Stage._setBF(this._vBuffer);
            Stage_1.Stage.gl.vertexAttribPointer(Stage_1.Stage._main._sprg.vpa, 3, Stage_1.Stage.gl.FLOAT, false, 0, 0);
            Stage_1.Stage.gl.bufferSubData(Stage_1.Stage.gl.ARRAY_BUFFER, 0, fa);
        };
        TextField.prototype._render = function (st) {
            if (this._areaW == 0 || this._areaH == 0)
                return;
            Stage_1.Stage.gl.uniformMatrix4fv(st._sprg.tMatUniform, false, st._mstack.top());
            st._cmstack.update();
            Stage_1.Stage._setVC(this._vBuffer);
            Stage_1.Stage._setTC(this._tcBuffer);
            Stage_1.Stage._setUT(1);
            Stage_1.Stage._setTEX(this._texture);
            Stage_1.Stage._setEBF(st._unitIBuffer);
            Stage_1.Stage.gl.drawElements(Stage_1.Stage.gl.TRIANGLES, 6, Stage_1.Stage.gl.UNSIGNED_SHORT, 0);
        };
        Object.defineProperty(TextField.prototype, "textWidth", {
            get: function () {
                return this._textW;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "textHeight", {
            get: function () { return this._textH; },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "wordWrap", {
            get: function () { return this._wordWrap; },
            set: function (x) { this._wordWrap = x; this._update(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "width", {
            get: function () { return this._areaW; },
            set: function (x) { this._areaW = Math.max(0, x); this._tarea.style.width = this._areaW + "px"; this._update(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "height", {
            get: function () { return this._areaH; },
            set: function (x) { this._areaH = Math.max(0, x); this._tarea.style.height = this._areaH + "px"; this._update(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "text", {
            get: function () { return this._text; },
            set: function (x) { this._text = x + ""; this._update(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "selectable", {
            get: function () { return this._selectable; },
            set: function (x) { this._selectable = x; this._update(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "type", {
            get: function () { return this._type; },
            set: function (x) { this._type = x; this._update(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "background", {
            get: function () { return this._background; },
            set: function (x) { this._background = x; this._update(); },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TextField.prototype, "border", {
            get: function () { return this._border; },
            set: function (x) { this._border = x; this._update(); },
            enumerable: true,
            configurable: true
        });
        return TextField;
    }(InteractiveObject_1.InteractiveObject));
    exports.TextField = TextField;
});
//# sourceMappingURL=TextField.js.map