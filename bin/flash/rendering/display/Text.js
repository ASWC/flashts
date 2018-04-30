define(["require", "exports", "flash/display/Bitmap", "flash/display3D/textures/Texture", "flash/geom/Rectangle", "flash/text/TextMetrics", "flash/rendering/managers/Constants", "flash/text/TextStyle", "flash/rendering/webgl/Utils", "flash/events/Event", "flash/display/StageSettings"], function (require, exports, Bitmap_1, Texture_1, Rectangle_1, TextMetrics_1, Constants_1, TextStyle_1, Utils_1, Event_1, StageSettings_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Text extends Bitmap_1.Bitmap {
        constructor(text, style, canvas = null) {
            canvas = canvas || document.createElement('canvas');
            canvas.width = 3;
            canvas.height = 3;
            const texture = Texture_1.Texture.fromCanvas(canvas, StageSettings_1.StageSettings.SCALE_MODE, 'text');
            texture.orig = new Rectangle_1.Rectangle();
            texture.trim = new Rectangle_1.Rectangle();
            super(texture);
            Texture_1.Texture.addToCache(this._texture, this._texture.baseTexture.textureCacheIds[0]);
            this.canvas = canvas;
            this.context = this.canvas.getContext('2d');
            this.resolution = StageSettings_1.StageSettings.RESOLUTION;
            this._text = null;
            this._style = null;
            this._styleListener = null;
            this._font = '';
            this.text = text;
            this.style = style;
            this.localStyleID = -1;
        }
        updateText(respectDirty) {
            const style = this._style;
            if (this.localStyleID !== style.styleID) {
                this.dirty = true;
                this.localStyleID = style.styleID;
            }
            if (!this.dirty && respectDirty) {
                return;
            }
            this._font = this._style.toFontString();
            const context = this.context;
            const measured = TextMetrics_1.TextMetrics.measureText(this._text, this._style, this._style.wordWrap, this.canvas);
            const width = measured.width;
            const height = measured.height;
            const lines = measured.lines;
            const lineHeight = measured.lineHeight;
            const lineWidths = measured.lineWidths;
            const maxLineWidth = measured.maxLineWidth;
            const fontProperties = measured.fontProperties;
            this.canvas.width = Math.ceil((Math.max(1, width) + (style.padding * 2)) * this.resolution);
            this.canvas.height = Math.ceil((Math.max(1, height) + (style.padding * 2)) * this.resolution);
            context.scale(this.resolution, this.resolution);
            context.clearRect(0, 0, this.canvas.width, this.canvas.height);
            context.font = this._font.toString();
            context.strokeStyle = style.stroke.toString();
            context.lineWidth = style.strokeThickness;
            context.textBaseline = style.textBaseline;
            context.lineJoin = style.lineJoin;
            context.miterLimit = style.miterLimit;
            let linePositionX;
            let linePositionY;
            if (style.dropShadow) {
                context.fillStyle = style.dropShadowColor.toString();
                context.globalAlpha = style.dropShadowAlpha;
                context.shadowBlur = style.dropShadowBlur;
                if (style.dropShadowBlur > 0) {
                    context.shadowColor = style.dropShadowColor.toString();
                }
                const xShadowOffset = Math.cos(style.dropShadowAngle) * style.dropShadowDistance;
                const yShadowOffset = Math.sin(style.dropShadowAngle) * style.dropShadowDistance;
                for (let i = 0; i < lines.length; i++) {
                    linePositionX = style.strokeThickness / 2;
                    linePositionY = ((style.strokeThickness / 2) + (i * lineHeight)) + fontProperties.ascent;
                    if (style.align === 'right') {
                        linePositionX += maxLineWidth - lineWidths[i];
                    }
                    else if (style.align === 'center') {
                        linePositionX += (maxLineWidth - lineWidths[i]) / 2;
                    }
                    if (style.fill) {
                        this.drawLetterSpacing(lines[i], linePositionX + xShadowOffset + style.padding, linePositionY + yShadowOffset + style.padding);
                        if (style.stroke && style.strokeThickness) {
                            context.strokeStyle = style.dropShadowColor.toString();
                            this.drawLetterSpacing(lines[i], linePositionX + xShadowOffset + style.padding, linePositionY + yShadowOffset + style.padding, true);
                            context.strokeStyle = style.stroke.toString();
                        }
                    }
                }
            }
            context.shadowBlur = 0;
            context.globalAlpha = 1;
            context.fillStyle = this._generateFillStyle(style, lines);
            for (let i = 0; i < lines.length; i++) {
                linePositionX = style.strokeThickness / 2;
                linePositionY = ((style.strokeThickness / 2) + (i * lineHeight)) + fontProperties.ascent;
                if (style.align === 'right') {
                    linePositionX += maxLineWidth - lineWidths[i];
                }
                else if (style.align === 'center') {
                    linePositionX += (maxLineWidth - lineWidths[i]) / 2;
                }
                if (style.stroke && style.strokeThickness) {
                    this.drawLetterSpacing(lines[i], linePositionX + style.padding, linePositionY + style.padding, true);
                }
                if (style.fill) {
                    this.drawLetterSpacing(lines[i], linePositionX + style.padding, linePositionY + style.padding);
                }
            }
            this.updateTexture();
        }
        drawLetterSpacing(text, x, y, isStroke = false) {
            const style = this._style;
            const letterSpacing = style.letterSpacing;
            if (letterSpacing === 0) {
                if (isStroke) {
                    this.context.strokeText(text, x, y);
                }
                else {
                    this.context.fillText(text, x, y);
                }
                return;
            }
            const characters = String.prototype.split.call(text, '');
            let currentPosition = x;
            let index = 0;
            let current = '';
            while (index < text.length) {
                current = characters[index++];
                if (isStroke) {
                    this.context.strokeText(current, currentPosition, y);
                }
                else {
                    this.context.fillText(current, currentPosition, y);
                }
                currentPosition += this.context.measureText(current).width + letterSpacing;
            }
        }
        updateTexture() {
            const canvas = this.canvas;
            if (this._style.trim) {
                const trimmed = Utils_1.Utils.trimCanvas(canvas);
                canvas.width = trimmed.width;
                canvas.height = trimmed.height;
                this.context.putImageData(trimmed.data, 0, 0);
            }
            const texture = this._texture;
            const style = this._style;
            const padding = style.trim ? 0 : style.padding;
            const baseTexture = texture.baseTexture;
            baseTexture.hasLoaded = true;
            baseTexture.resolution = this.resolution;
            baseTexture.realWidth = canvas.width;
            baseTexture.realHeight = canvas.height;
            baseTexture.width = canvas.width / this.resolution;
            baseTexture.height = canvas.height / this.resolution;
            texture.trim.width = texture.frame.width = canvas.width / this.resolution;
            texture.trim.height = texture.frame.height = canvas.height / this.resolution;
            texture.trim.x = -padding;
            texture.trim.y = -padding;
            texture.orig.width = texture.frame.width - (padding * 2);
            texture.orig.height = texture.frame.height - (padding * 2);
            this._onTextureUpdate();
            baseTexture.dispatchEvent(new Event_1.Event(Event_1.Event.CHANGE));
            this.dirty = false;
        }
        renderWebGL() {
            if (!this.stage) {
                return;
            }
            if (this.resolution !== this.stage.canvasResolution) {
                this.resolution = this.stage.canvasResolution;
                this.dirty = true;
            }
            if (this.transform.requireUpdate) {
                this.transform.updateWorldTransform(this._parent.transform);
            }
            this.updateText(true);
            super.renderWebGL();
        }
        getLocalBounds(rect) {
            this.updateText(true);
            return super.getLocalBounds.call(this, rect);
        }
        _calculateBounds() {
            this.updateText(true);
            this.calculateVertices();
            this._bounds.addQuad(this.vertexData);
        }
        _onStyleChange() {
            this.dirty = true;
        }
        _generateFillStyle(style, lines) {
            if (!Array.isArray(style.fill)) {
                return style.fill;
            }
            if (navigator['isCocoonJS']) {
                return style.fill[0];
            }
            let gradient;
            let totalIterations;
            let currentIteration;
            let stop;
            const width = this.canvas.width / this.resolution;
            const height = this.canvas.height / this.resolution;
            const fill = style.fill.slice();
            const fillGradientStops = style.fillGradientStops.slice();
            if (!fillGradientStops.length) {
                const lengthPlus1 = fill.length + 1;
                for (let i = 1; i < lengthPlus1; ++i) {
                    fillGradientStops.push(i / lengthPlus1);
                }
            }
            fill.unshift(style.fill[0]);
            fillGradientStops.unshift(0);
            fill.push(style.fill[style.fill.length - 1]);
            fillGradientStops.push(1);
            if (style.fillGradientType === Constants_1.Constants.TEXT_GRADIENT.LINEAR_VERTICAL) {
                gradient = this.context.createLinearGradient(width / 2, 0, width / 2, height);
                totalIterations = (fill.length + 1) * lines.length;
                currentIteration = 0;
                for (let i = 0; i < lines.length; i++) {
                    currentIteration += 1;
                    for (let j = 0; j < fill.length; j++) {
                        if (typeof fillGradientStops[j] === 'number') {
                            stop = (fillGradientStops[j] / lines.length) + (i / lines.length);
                        }
                        else {
                            stop = currentIteration / totalIterations;
                        }
                        gradient.addColorStop(stop, fill[j]);
                        currentIteration++;
                    }
                }
            }
            else {
                gradient = this.context.createLinearGradient(0, height / 2, width, height / 2);
                totalIterations = fill.length + 1;
                currentIteration = 1;
                for (let i = 0; i < fill.length; i++) {
                    if (typeof fillGradientStops[i] === 'number') {
                        stop = fillGradientStops[i];
                    }
                    else {
                        stop = currentIteration / totalIterations;
                    }
                    gradient.addColorStop(stop, fill[i]);
                    currentIteration++;
                }
            }
            return gradient;
        }
        destroy() {
            super.destroy();
            this.context = null;
            this.canvas = null;
            this._style = null;
        }
        get width() {
            this.updateText(true);
            return Math.abs(this.scale.x) * this._texture.orig.width;
        }
        set width(value) {
            this.updateText(true);
            const s = Utils_1.Utils.sign(this.scale.x) || 1;
            this.scale.x = s * value / this._texture.orig.width;
            this._width = value;
        }
        get height() {
            this.updateText(true);
            return Math.abs(this.scale.y) * this._texture.orig.height;
        }
        set height(value) {
            this.updateText(true);
            const s = Utils_1.Utils.sign(this.scale.y) || 1;
            this.scale.y = s * value / this._texture.orig.height;
            this._height = value;
        }
        get style() {
            return this._style;
        }
        set style(style) {
            if (style instanceof TextStyle_1.TextStyle) {
                this._style = style;
            }
            else {
                this._style = new TextStyle_1.TextStyle(style);
            }
            this.localStyleID = -1;
            this.dirty = true;
        }
        get text() {
            return this._text;
        }
        set text(text) {
            text = String(text === '' || text === null || text === undefined ? ' ' : text);
            if (this._text === text) {
                return;
            }
            this._text = text;
            this.dirty = true;
        }
    }
    exports.Text = Text;
});
//# sourceMappingURL=Text.js.map