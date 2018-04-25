define(["require", "exports", "flash/text/TextFormatAlign"], function (require, exports, TextFormatAlign_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var TextFormat = /** @class */ (function () {
        function TextFormat(f, s, c, b, i, a, l) {
            if (f === void 0) { f = null; }
            if (s === void 0) { s = null; }
            if (c === void 0) { c = null; }
            if (b === void 0) { b = null; }
            if (i === void 0) { i = null; }
            if (a === void 0) { a = null; }
            if (l === void 0) { l = null; }
            this.font = f ? f : "Times New Roman";
            this.size = s ? s : 12;
            this.color = c ? c : 0x000000;
            this.bold = b ? b : false;
            this.italic = i ? i : false;
            this.align = a ? a : TextFormatAlign_1.TextFormatAlign.LEFT;
            this.leading = l ? l : 0;
            this.maxW = 0;
            this.data = { image: null, tw: 0, th: 0, rw: 0, rh: 0 }; // image, text width/height, real width/height
            if (!TextFormat._canvas) {
                TextFormat._canvas = document.createElement("canvas");
                TextFormat._ctxext = TextFormat._canvas.getContext("2d");
            }
        }
        TextFormat.prototype.clone = function () {
            return (new TextFormat(this.font, this.size, this.color, this.bold, this.italic, this.align, this.leading));
        };
        TextFormat.prototype.set = function (tf) {
            this.font = tf.font;
            this.size = tf.size;
            this.color = tf.color;
            this.bold = tf.bold;
            this.italic = tf.italic;
            this.align = tf.align;
            this.leading = tf.leading;
        };
        TextFormat.prototype.setContext = function (ctx) {
            var c = this.color;
            var r = (c >> 16 & 0x0000ff);
            var g = (c >> 8 & 0x0000ff);
            var b = (c & 0x0000ff);
            ctx.textBaseline = "top";
            ctx.fillStyle = ctx.strokeStyle = "rgb(" + r + "," + g + "," + b + ")";
            ctx.font = (this.italic ? "italic " : "") + (this.bold ? "bold " : "") + this.size + "px " + this.font;
        };
        TextFormat.prototype.getImageData = function (s, tf) {
            var canv = TextFormat._canvas;
            var ctx = TextFormat._ctxext;
            var data = this.data;
            canv.width = data.rw = this._nhpt(tf._areaW); //console.log(tf._areaW, canv.width);
            canv.height = data.rh = this._nhpt(tf._areaH); //console.log(tf._areaH, canv.height);	
            if (tf._background) {
                //console.log("has background");
                ctx.fillStyle = "rgba(255,255,255,1)";
                ctx.fillRect(0, 0, tf._areaW, tf._areaH);
            }
            if (tf._border) {
                ctx.strokeStyle = "rgb(0,0,0)";
                ctx.beginPath();
                //ctx.moveTo(Math.round(b0.x)+0.5, b0.y);
                //ctx.lineTo(Math.round(b0.x)+0.5, b0.y+b0.height);			
                ctx.rect(0.5, 0.5, tf._areaW - 1, tf._areaH - 1);
                ctx.stroke();
            }
            this.setContext(ctx);
            var metrics = [];
            this.maxW = 0;
            var pars = s.split("\n");
            var line = 0;
            var posY = 0;
            var lineH = this.size * 1.25;
            var coff = 0; // character offset
            for (var i = 0; i < pars.length; i++) {
                var lc = this.renderPar(pars[i], posY, lineH, ctx, tf, coff, metrics);
                line += lc;
                posY += lc * (lineH + this.leading);
                coff += pars[i].length + 1;
            }
            if (this.align == TextFormatAlign_1.TextFormatAlign.JUSTIFY)
                this.maxW = Math.max(this.maxW, tf._areaW);
            data.tw = this.maxW;
            data.th = (lineH + this.leading) * line - this.leading;
            tf._metrics = metrics;
            if (tf._selectable && tf._select && tf._select.from < tf._select.to) {
                var sel = tf._select;
                var m = metrics;
                var l0 = tf.getLineIndexOfChar(sel.from);
                var l1 = tf.getLineIndexOfChar(sel.to - 1);
                var b0 = tf.getCharBoundaries(sel.from);
                var b1 = tf.getCharBoundaries(sel.to - 1);
                ctx.fillStyle = "rgba(0,0,0,0.25)";
                if (l0 == l1) {
                    ctx.fillRect(b0.x, b0.y, b1.x + b1.width - b0.x, b1.y + b1.height - b0.y);
                }
                else {
                    ctx.fillRect(b0.x, b0.y, m[l0].x + m[l0].width - b0.x, m[l0].y + m[l0].height - b0.y);
                    for (var l = l0 + 1; l < l1; l++)
                        ctx.fillRect(m[l].x, m[l].y, m[l].width, m[l].height);
                    ctx.fillRect(m[l1].x, m[l1].y, b1.x + b1.width - m[l1].x, b1.y + b1.height - m[l1].y);
                }
            }
            else if (tf._type == "input" && tf._curPos > -1) {
                var b0 = tf.getCharBoundaries(tf._curPos);
                ctx.beginPath();
                ctx.moveTo(Math.round(b0.x) + 0.5, b0.y);
                ctx.lineTo(Math.round(b0.x) + 0.5, b0.y + b0.height);
                ctx.stroke();
            }
            data.canvas = canv;
            var imgd = ctx.getImageData(0, 0, data.rw, data.rh);
            if (window['CanvasPixelArray']) {
                try {
                    data.ui8buff = new Uint8Array(imgd.data);
                }
                catch (e) {
                }
            }
            else
                data.ui8buff = new Uint8Array(imgd.data.buffer);
            //var ui8buff = new Uint8Array(imgd.data);
            //data.ui8buff = ui8buff;		
            return data;
        };
        TextFormat.prototype.renderPar = function (s, posY, lineH, ctx, tf, coff, metrics) {
            var words;
            if (tf._wordWrap)
                words = s.split(" ");
            else
                words = [s];
            var spacew = ctx.measureText(" ").width;
            var curlw = 0; // current line width
            var maxlw = tf._areaW; // maximum line width
            var cl = 0; // current line		
            var lines = [[]]; // array of lines , line = (arrays of words)
            var lspace = []; // free line space		
            for (var i = 0; i < words.length; i++) {
                var word = words[i];
                var ww = ctx.measureText(word).width;
                if (curlw + ww <= maxlw || curlw == 0) {
                    lines[cl].push(word);
                    curlw += ww + spacew;
                }
                else {
                    lspace.push(maxlw - curlw + spacew);
                    lines.push([]);
                    cl++;
                    curlw = 0;
                    i--;
                }
            }
            lspace.push(maxlw - curlw + spacew);
            for (var i = 0; i < lines.length; i++) {
                var mline = { x: 0, y: 0, width: 0, height: 0, charOffset: coff, words: [] };
                mline.height = this.size * 1.25 + this.leading;
                var line = lines[i];
                //while(line[line.length-1] == "") {line.pop(); lspace[i] += spacew; }
                this.maxW = Math.max(this.maxW, maxlw - lspace[i]);
                var gap, lineY = posY + (lineH + this.leading) * i;
                curlw = 0, gap = spacew;
                if (this.align == TextFormatAlign_1.TextFormatAlign.CENTER)
                    curlw = lspace[i] * 0.5;
                if (this.align == TextFormatAlign_1.TextFormatAlign.RIGHT)
                    curlw = lspace[i];
                if (this.align == TextFormatAlign_1.TextFormatAlign.JUSTIFY)
                    gap = spacew + lspace[i] / (line.length - 1);
                mline.x = curlw;
                mline.y = lineY;
                for (var j = 0; j < line.length; j++) {
                    var word = line[j];
                    ctx.fillText(word, curlw, lineY);
                    var ww = ctx.measureText(word).width;
                    mline.words.push({ x: curlw, y: lineY, width: ww, height: mline.height, charOffset: coff, word: word });
                    if (i < lines.length - 1)
                        curlw += ww + gap; // not last line
                    else {
                        curlw += ww + spacew;
                    } // last line
                    coff += word.length + 1;
                }
                mline.width = curlw - mline.x;
                if (i == lines.length - 1)
                    mline.width -= spacew;
                metrics.push(mline);
            }
            return cl + 1;
        };
        TextFormat.prototype._nhpt = function (x) {
            --x;
            for (var i = 1; i < 32; i <<= 1)
                x = x | x >> i;
            return x + 1;
        };
        return TextFormat;
    }());
    exports.TextFormat = TextFormat;
});
//# sourceMappingURL=TextFormat.js.map