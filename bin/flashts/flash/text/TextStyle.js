define(["require", "exports", "flash/rendering/managers/Constants", "flash/rendering/webgl/Utils"], function (require, exports, Constants_1, Utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class TextStyle {
        constructor(style = null) {
            this.reset();
            if (style) {
                TextStyle.deepCopyProperties(this, style);
            }
        }
        static deepCopyProperties(target, source) {
            for (const prop in source) {
                if (target[prop]) {
                    target[prop] = source[prop];
                }
            }
        }
        clone() {
            var newstyle = new TextStyle();
            TextStyle.deepCopyProperties(newstyle, this);
            return newstyle;
        }
        reset() {
            this._dropShadowAlpha = 1;
            this._align = 'left';
            this._dropShadow = false;
            this._breakWords = false;
            this._dropShadowAngle = Math.PI / 6;
            this._dropShadowBlur = 0;
            this._dropShadowColor = 'black';
            this._dropShadowDistance = 5;
            this._fill = 'black';
            this._fillGradientType = Constants_1.Constants.TEXT_GRADIENT.LINEAR_VERTICAL;
            this._fillGradientStops = [];
            this._fontFamily = 'Arial';
            this._fontSize = 26;
            this._fontStyle = 'normal';
            this._fontVariant = 'normal';
            this._fontWeight = 'normal';
            this._leading = 0;
            this._letterSpacing = 0;
            this._lineHeight = 0;
            this._lineJoin = 'miter';
            this._miterLimit = 10;
            this._padding = 0;
            this._stroke = 'black';
            this._strokeThickness = 0;
            this._trim = false;
            this._textBaseline = 'alphabetic';
            this._wordWrap = false;
            this._wordWrapWidth = 100;
            this.styleID = 0;
        }
        get align() {
            return this._align;
        }
        set align(align) {
            if (this._align !== align) {
                this._align = align;
                this.styleID++;
            }
        }
        get breakWords() {
            return this._breakWords;
        }
        set breakWords(breakWords) {
            if (this._breakWords !== breakWords) {
                this._breakWords = breakWords;
                this.styleID++;
            }
        }
        get dropShadow() {
            return this._dropShadow;
        }
        set dropShadow(dropShadow) {
            if (this._dropShadow !== dropShadow) {
                this._dropShadow = dropShadow;
                this.styleID++;
            }
        }
        get dropShadowAlpha() {
            return this._dropShadowAlpha;
        }
        set dropShadowAlpha(dropShadowAlpha) {
            if (this._dropShadowAlpha !== dropShadowAlpha) {
                this._dropShadowAlpha = dropShadowAlpha;
                this.styleID++;
            }
        }
        get dropShadowAngle() {
            return this._dropShadowAngle;
        }
        set dropShadowAngle(dropShadowAngle) {
            if (this._dropShadowAngle !== dropShadowAngle) {
                this._dropShadowAngle = dropShadowAngle;
                this.styleID++;
            }
        }
        get dropShadowBlur() {
            return this._dropShadowBlur;
        }
        set dropShadowBlur(dropShadowBlur) {
            if (this._dropShadowBlur !== dropShadowBlur) {
                this._dropShadowBlur = dropShadowBlur;
                this.styleID++;
            }
        }
        get dropShadowColor() {
            return this._dropShadowColor;
        }
        set dropShadowColor(dropShadowColor) {
            if (typeof (dropShadowColor) == 'number') {
                const outputColor = TextStyle.getColor(dropShadowColor);
                if (this._dropShadowColor !== outputColor) {
                    if (typeof (outputColor) == 'string') {
                        this._dropShadowColor = outputColor;
                        this.styleID++;
                    }
                }
            }
        }
        get dropShadowDistance() {
            return this._dropShadowDistance;
        }
        set dropShadowDistance(dropShadowDistance) {
            if (this._dropShadowDistance !== dropShadowDistance) {
                this._dropShadowDistance = dropShadowDistance;
                this.styleID++;
            }
        }
        get fill() {
            return this._fill;
        }
        set fill(fill) {
            if (typeof (fill) == 'number') {
                const outputColor = TextStyle.getColor(fill);
                if (this._fill !== outputColor) {
                    this._fill = outputColor;
                    this.styleID++;
                }
            }
        }
        get fillGradientType() {
            return this._fillGradientType;
        }
        set fillGradientType(fillGradientType) {
            if (this._fillGradientType !== fillGradientType) {
                this._fillGradientType = fillGradientType;
                this.styleID++;
            }
        }
        get fillGradientStops() {
            return this._fillGradientStops;
        }
        set fillGradientStops(fillGradientStops) {
            if (!TextStyle.areArraysEqual(this._fillGradientStops, fillGradientStops)) {
                this._fillGradientStops = fillGradientStops;
                this.styleID++;
            }
        }
        get fontFamily() {
            return this._fontFamily;
        }
        set fontFamily(fontFamily) {
            if (this.fontFamily !== fontFamily) {
                this._fontFamily = fontFamily;
                this.styleID++;
            }
        }
        get fontSize() {
            return this._fontSize;
        }
        set fontSize(fontSize) {
            if (this._fontSize !== fontSize) {
                this._fontSize = fontSize;
                this.styleID++;
            }
        }
        get fontStyle() {
            return this._fontStyle;
        }
        set fontStyle(fontStyle) {
            if (this._fontStyle !== fontStyle) {
                this._fontStyle = fontStyle;
                this.styleID++;
            }
        }
        get fontVariant() {
            return this._fontVariant;
        }
        set fontVariant(fontVariant) {
            if (this._fontVariant !== fontVariant) {
                this._fontVariant = fontVariant;
                this.styleID++;
            }
        }
        get fontWeight() {
            return this._fontWeight.toString();
        }
        set fontWeight(fontWeight) {
            if (this._fontWeight !== fontWeight) {
                this._fontWeight = fontWeight;
                this.styleID++;
            }
        }
        get letterSpacing() {
            return this._letterSpacing;
        }
        set letterSpacing(letterSpacing) {
            if (this._letterSpacing !== letterSpacing) {
                this._letterSpacing = letterSpacing;
                this.styleID++;
            }
        }
        get lineHeight() {
            return this._lineHeight;
        }
        set lineHeight(lineHeight) {
            if (this._lineHeight !== lineHeight) {
                this._lineHeight = lineHeight;
                this.styleID++;
            }
        }
        get leading() {
            return this._leading;
        }
        set leading(leading) {
            if (this._leading !== leading) {
                this._leading = leading;
                this.styleID++;
            }
        }
        get lineJoin() {
            return this._lineJoin;
        }
        set lineJoin(lineJoin) {
            if (this._lineJoin !== lineJoin) {
                this._lineJoin = lineJoin;
                this.styleID++;
            }
        }
        get miterLimit() {
            return this._miterLimit;
        }
        set miterLimit(miterLimit) {
            if (this._miterLimit !== miterLimit) {
                this._miterLimit = miterLimit;
                this.styleID++;
            }
        }
        get padding() {
            return this._padding;
        }
        set padding(padding) {
            if (this._padding !== padding) {
                this._padding = padding;
                this.styleID++;
            }
        }
        get stroke() {
            return this._stroke;
        }
        set stroke(stroke) {
            if (typeof (stroke) == 'number') {
                const outputColor = TextStyle.getColor(stroke);
                if (this._stroke !== outputColor) {
                    if (typeof (outputColor) == 'string') {
                        this._stroke = outputColor;
                        this.styleID++;
                    }
                }
            }
        }
        get strokeThickness() {
            return this._strokeThickness;
        }
        set strokeThickness(strokeThickness) {
            if (this._strokeThickness !== strokeThickness) {
                this._strokeThickness = strokeThickness;
                this.styleID++;
            }
        }
        get textBaseline() {
            return this._textBaseline;
        }
        set textBaseline(textBaseline) {
            if (this._textBaseline !== textBaseline) {
                this._textBaseline = textBaseline;
                this.styleID++;
            }
        }
        get trim() {
            return this._trim;
        }
        set trim(trim) {
            if (this._trim !== trim) {
                this._trim = trim;
                this.styleID++;
            }
        }
        get wordWrap() {
            return this._wordWrap;
        }
        set wordWrap(wordWrap) {
            if (this._wordWrap !== wordWrap) {
                this._wordWrap = wordWrap;
                this.styleID++;
            }
        }
        get wordWrapWidth() {
            return this._wordWrapWidth;
        }
        set wordWrapWidth(wordWrapWidth) {
            if (this._wordWrapWidth !== wordWrapWidth) {
                this._wordWrapWidth = wordWrapWidth;
                this.styleID++;
            }
        }
        toFontString() {
            const fontSizeString = (typeof this.fontSize === 'number') ? `${this.fontSize}px` : this.fontSize;
            var fontFamilies = this.fontFamily;
            if (!Array.isArray(this.fontFamily)) {
                fontFamilies = this.fontFamily.split(',');
                return fontFamilies;
            }
            for (let i = fontFamilies.length - 1; i >= 0; i--) {
                var convertedcolors = [];
                let fontFamily = fontFamilies[i].trim();
                if (!(/([\"\'])[^\'\"]+\1/).test(fontFamily)) {
                    fontFamily = `"${fontFamily}"`;
                }
                convertedcolors[i] = fontFamily;
            }
            return `${this.fontStyle} ${this.fontVariant} ${this.fontWeight} ${fontSizeString} ${convertedcolors.join(',')}`;
        }
        static getSingleColor(color) {
            if (typeof color === 'number') {
                return Utils_1.Utils.hex2string(color);
            }
            else if (typeof color === 'string') {
                if (color.indexOf('0x') === 0) {
                    color = color.replace('0x', '#');
                }
            }
            return color;
        }
        static getColor(color) {
            if (!Array.isArray(color)) {
                return TextStyle.getSingleColor(color);
            }
            else {
                var convertedcolors = [];
                for (let i = 0; i < color.length; ++i) {
                    convertedcolors.push(TextStyle.getSingleColor(color[i]));
                }
                return convertedcolors;
            }
        }
        static areArraysEqual(array1, array2) {
            if (!Array.isArray(array1) || !Array.isArray(array2)) {
                return false;
            }
            if (array1.length !== array2.length) {
                return false;
            }
            for (let i = 0; i < array1.length; ++i) {
                if (array1[i] !== array2[i]) {
                    return false;
                }
            }
            return true;
        }
    }
    exports.TextStyle = TextStyle;
});
