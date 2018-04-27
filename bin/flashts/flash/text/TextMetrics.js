define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextMetrics {
        constructor(text, style, width, height, lines, lineWidths, lineHeight, maxLineWidth, fontProperties) {
            if (!TextMetrics.canvas) {
                TextMetrics.canvas = document.createElement('canvas');
                TextMetrics.canvas.width = TextMetrics.canvas.height = 10;
                TextMetrics._fonts = {};
                TextMetrics._context = TextMetrics.canvas.getContext('2d');
            }
            this.text = text;
            this.style = style;
            this._width = width;
            this._height = height;
            this._lines = lines;
            this._lineWidths = lineWidths;
            this._lineHeight = lineHeight;
            this._maxLineWidth = maxLineWidth;
            this._fontProperties = fontProperties;
            this.fontSize = style.fontSize;
        }
        get fontProperties() {
            return this._fontProperties;
        }
        get maxLineWidth() {
            return this._maxLineWidth;
        }
        get lineWidths() {
            return this._lineWidths;
        }
        get lineHeight() {
            return this._lineHeight;
        }
        get lines() {
            return this._lines;
        }
        get height() {
            return this._height;
        }
        get width() {
            return this._width;
        }
        static measureText(text, style, wordWrap, canvas = TextMetrics.canvas) {
            wordWrap = wordWrap || style.wordWrap;
            const font = style.toFontString();
            const fontProperties = TextMetrics.measureFont(font);
            const context = canvas.getContext('2d');
            context.font = font;
            const outputText = wordWrap ? TextMetrics.wordWrap(text, style, canvas) : text;
            const lines = outputText.split(/(?:\r\n|\r|\n)/);
            const lineWidths = new Array(lines.length);
            let maxLineWidth = 0;
            for (let i = 0; i < lines.length; i++) {
                const lineWidth = context.measureText(lines[i]).width + ((lines[i].length - 1) * style.letterSpacing);
                lineWidths[i] = lineWidth;
                maxLineWidth = Math.max(maxLineWidth, lineWidth);
            }
            let width = maxLineWidth + style.strokeThickness;
            if (style.dropShadow) {
                width += style.dropShadowDistance;
            }
            const lineHeight = style.lineHeight || fontProperties.fontSize + style.strokeThickness;
            let height = Math.max(lineHeight, fontProperties.fontSize + style.strokeThickness)
                + ((lines.length - 1) * (lineHeight + style.leading));
            if (style.dropShadow) {
                height += style.dropShadowDistance;
            }
            return new TextMetrics(text, style, width, height, lines, lineWidths, lineHeight + style.leading, maxLineWidth, fontProperties);
        }
        static wordWrap(text, style, canvas = TextMetrics.canvas) {
            const context = canvas.getContext('2d');
            let line = '';
            let width = 0;
            let lines = '';
            const cache = {};
            const ls = style.letterSpacing;
            const wordWrapWidth = style.wordWrapWidth + style.letterSpacing;
            const spaceWidth = TextMetrics.getFromCache(' ', ls, cache, context);
            const words = text.split(' ');
            for (let i = 0; i < words.length; i++) {
                const word = words[i];
                const wordWidth = TextMetrics.getFromCache(word, ls, cache, context);
                if (wordWidth > wordWrapWidth) {
                    if (style.breakWords) {
                        const tmpWord = (line.length > 0) ? ` ${word}` : word;
                        const characters = tmpWord.split('');
                        for (let j = 0; j < characters.length; j++) {
                            const character = characters[j];
                            const characterWidth = TextMetrics.getFromCache(character, ls, cache, context);
                            if (characterWidth + width > wordWrapWidth) {
                                lines += TextMetrics.addLine(line);
                                line = '';
                                width = 0;
                            }
                            line += character;
                            width += characterWidth;
                        }
                    }
                    else {
                        if (line.length > 0) {
                            lines += TextMetrics.addLine(line);
                            line = '';
                            width = 0;
                        }
                        lines += TextMetrics.addLine(word);
                        line = '';
                        width = 0;
                    }
                }
                else {
                    if (wordWidth + width > wordWrapWidth) {
                        lines += TextMetrics.addLine(line);
                        line = '';
                        width = 0;
                    }
                    if (line.length > 0) {
                        line += ` ${word}`;
                    }
                    else {
                        line += word;
                    }
                    width += wordWidth + spaceWidth;
                }
            }
            lines += TextMetrics.addLine(line, false);
            return lines;
        }
        static addLine(line, newLine = true) {
            line = (newLine) ? `${line}\n` : line;
            return line;
        }
        static getFromCache(key, letterSpacing, cache, context) {
            let width = cache[key];
            if (width === undefined) {
                const spacing = ((key.length) * letterSpacing);
                width = context.measureText(key).width + spacing;
                cache[key] = width;
            }
            return width;
        }
        static measureFont(font) {
            if (!TextMetrics.canvas) {
                TextMetrics.canvas = document.createElement('canvas');
                TextMetrics.canvas.width = TextMetrics.canvas.height = 10;
                TextMetrics._fonts = {};
                TextMetrics._context = TextMetrics.canvas.getContext('2d');
            }
            font = font || "Arial";
            if (TextMetrics._fonts[font]) {
                return TextMetrics._fonts[font];
            }
            const properties = {};
            const canvas = TextMetrics.canvas;
            const context = TextMetrics._context;
            context.font = font;
            const width = Math.ceil(context.measureText('|MÉq').width);
            let baseline = Math.ceil(context.measureText('M').width);
            const height = 2 * baseline;
            baseline = baseline * 1.4 | 0;
            canvas.width = width;
            canvas.height = height;
            context.fillStyle = '#f00';
            context.fillRect(0, 0, width, height);
            context.font = font;
            context.textBaseline = 'alphabetic';
            context.fillStyle = '#000';
            context.fillText('|MÉq', 0, baseline);
            const imagedata = context.getImageData(0, 0, width, height).data;
            const pixels = imagedata.length;
            const line = width * 4;
            let i = 0;
            let idx = 0;
            let stop = false;
            for (i = 0; i < baseline; ++i) {
                for (let j = 0; j < line; j += 4) {
                    if (imagedata[idx + j] !== 255) {
                        stop = true;
                        break;
                    }
                }
                if (!stop) {
                    idx += line;
                }
                else {
                    break;
                }
            }
            properties.ascent = baseline - i;
            idx = pixels - line;
            stop = false;
            for (i = height; i > baseline; --i) {
                for (let j = 0; j < line; j += 4) {
                    if (imagedata[idx + j] !== 255) {
                        stop = true;
                        break;
                    }
                }
                if (!stop) {
                    idx -= line;
                }
                else {
                    break;
                }
            }
            properties.descent = i - baseline;
            properties.fontSize = properties.ascent + properties.descent;
            TextMetrics._fonts[font] = properties;
            return properties;
        }
    }
    TextMetrics._fonts = {};
    exports.TextMetrics = TextMetrics;
});
//# sourceMappingURL=TextMetrics.js.map