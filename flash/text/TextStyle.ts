import { Constants } from "flash/rendering/managers/Constants";
import { Utils } from "flash/rendering/webgl/Utils";

export class TextStyle
{
    public styleID:any;
    protected _dropShadowAlpha:number;  
    protected _align:string;   
    protected _dropShadow:boolean;   
    protected _breakWords:boolean;   
    protected _dropShadowAngle:number;   
    protected _dropShadowBlur:number;
    protected _dropShadowColor:string|number;
    protected _dropShadowDistance:number;
    protected _fill:string|string[]|number|number[]|CanvasGradient|CanvasPattern;   
    protected _fillGradientType:number;   
    protected _fillGradientStops:number[];
    protected _fontFamily:string|string[];   
    protected _fontSize:string|number;     
    protected  _fontStyle:string; 
    protected _fontVariant:string;  
    protected _fontWeight:string|number;
    protected _leading:number;  
    protected _letterSpacing:number;
    protected _wordWrapWidth:number;
    protected _stroke:string|number;
    protected _wordWrap:boolean;
    protected _textBaseline:string;
    protected _trim:boolean;
    protected _strokeThickness:number;
    protected _padding:number;
    protected _miterLimit:number;
    protected _lineJoin:string;  
    protected _lineHeight:number;

    constructor(style:any = null)
    {
        this.reset();
        if(style)
        {
            TextStyle.deepCopyProperties(this, style);
        }        
    }

    public static deepCopyProperties(target:TextStyle, source:any):void
    {
        for (const prop in source) 
        {
            if(target[prop])
            {
                target[prop] = source[prop];
            }
        }
    }

    public clone():TextStyle
    {
        var newstyle:TextStyle = new TextStyle();
        TextStyle.deepCopyProperties(newstyle, this);
        return newstyle;
    }
    
    public reset()
    {
        this._dropShadowAlpha = 1;
        this._align = 'left';
        this._dropShadow = false;
        this._breakWords = false;
        this._dropShadowAngle = Math.PI / 6;
        this._dropShadowBlur = 0;
        this._dropShadowColor = 'black';
        this._dropShadowDistance = 5;
        this._fill = 'black';
        this._fillGradientType = Constants.TEXT_GRADIENT.LINEAR_VERTICAL;
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

    public get align():string
    {
        return this._align;
    }

    public set align(align:string)
    {
        if (this._align !== align)
        {
            this._align = align;
            this.styleID++;
        }
    }

    public get breakWords():boolean
    {
        return this._breakWords;
    }

    public set breakWords(breakWords:boolean)
    {
        if (this._breakWords !== breakWords)
        {
            this._breakWords = breakWords;
            this.styleID++;
        }
    }

    public get dropShadow():boolean
    {
        return this._dropShadow;
    }

    public set dropShadow(dropShadow:boolean) 
    {
        if (this._dropShadow !== dropShadow)
        {
            this._dropShadow = dropShadow;
            this.styleID++;
        }
    }

    public get dropShadowAlpha():number
    {
        return this._dropShadowAlpha;
    }

    public set dropShadowAlpha(dropShadowAlpha:number)
    {
        if (this._dropShadowAlpha !== dropShadowAlpha)
        {
            this._dropShadowAlpha = dropShadowAlpha;
            this.styleID++;
        }
    }

    public get dropShadowAngle():number
    {
        return this._dropShadowAngle;
    }
    public set dropShadowAngle(dropShadowAngle:number)
    {
        if (this._dropShadowAngle !== dropShadowAngle)
        {
            this._dropShadowAngle = dropShadowAngle;
            this.styleID++;
        }
    }

    public get dropShadowBlur():number
    {
        return this._dropShadowBlur;
    }
    public set dropShadowBlur(dropShadowBlur:number) 
    {
        if (this._dropShadowBlur !== dropShadowBlur)
        {
            this._dropShadowBlur = dropShadowBlur;
            this.styleID++;
        }
    }

    public get dropShadowColor():string|number
    {
        return this._dropShadowColor;
    }
    public set dropShadowColor(dropShadowColor:string|number)
    {
        if(typeof(dropShadowColor) == 'number')
        {
            const outputColor = TextStyle.getColor(dropShadowColor);
            if (this._dropShadowColor !== outputColor)
            {
                if(typeof(outputColor) == 'string')
                {
                    this._dropShadowColor = outputColor;
                    this.styleID++;
                }                
            }
        }        
    }

    public get dropShadowDistance():number
    {
        return this._dropShadowDistance;
    }
    public set dropShadowDistance(dropShadowDistance:number) 
    {
        if (this._dropShadowDistance !== dropShadowDistance)
        {
            this._dropShadowDistance = dropShadowDistance;
            this.styleID++;
        }
    }

    public get fill():string|string[]|number|number[]|CanvasGradient|CanvasPattern
    {
        return this._fill;
    }
    public set fill(fill:string|string[]|number|number[]|CanvasGradient|CanvasPattern) 
    {
        if(typeof(fill) == 'number')
        {
            const outputColor = TextStyle.getColor(fill);
            if (this._fill !== outputColor)
            {
                this._fill = outputColor;
                this.styleID++;
            }
        }        
    }

    public get fillGradientType():number
    {
        return this._fillGradientType;
    }
    public set fillGradientType(fillGradientType:number) 
    {
        if (this._fillGradientType !== fillGradientType)
        {
            this._fillGradientType = fillGradientType;
            this.styleID++;
        }
    }

    public get fillGradientStops():number[]
    {
        return this._fillGradientStops;
    }
    public set fillGradientStops(fillGradientStops:number[])
    {
        if (!TextStyle.areArraysEqual(this._fillGradientStops,fillGradientStops))
        {
            this._fillGradientStops = fillGradientStops;
            this.styleID++;
        }
    }

    public get fontFamily():string|string[]
    {
        return this._fontFamily;
    }
    public set fontFamily(fontFamily:string|string[])
    {
        if (this.fontFamily !== fontFamily)
        {
            this._fontFamily = fontFamily;
            this.styleID++;
        }
    }

    public get fontSize()
    {
        return this._fontSize;
    }
    public set fontSize(fontSize)
    {
        if (this._fontSize !== fontSize)
        {
            this._fontSize = fontSize;
            this.styleID++;
        }
    }

    public get fontStyle():string
    {
        return this._fontStyle;
    }
    public set fontStyle(fontStyle:string)
    {
        if (this._fontStyle !== fontStyle)
        {
            this._fontStyle = fontStyle;
            this.styleID++;
        }
    }

    public get fontVariant():string
    {
        return this._fontVariant;
    }
    public set fontVariant(fontVariant:string)
    {
        if (this._fontVariant !== fontVariant)
        {
            this._fontVariant = fontVariant;
            this.styleID++;
        }
    }

    public get fontWeight():string
    {
        return this._fontWeight.toString();
    }
    public set fontWeight(fontWeight:string)
    {
        if (this._fontWeight !== fontWeight)
        {
            this._fontWeight = fontWeight;
            this.styleID++;
        }
    }

    public get letterSpacing():number
    {
        return this._letterSpacing;
    }
    public set letterSpacing(letterSpacing:number) 
    {
        if (this._letterSpacing !== letterSpacing)
        {
            this._letterSpacing = letterSpacing;
            this.styleID++;
        }
    }

    public get lineHeight():number
    {
        return this._lineHeight;
    }
    public set lineHeight(lineHeight:number) 
    {
        if (this._lineHeight !== lineHeight)
        {
            this._lineHeight = lineHeight;
            this.styleID++;
        }
    }

    public get leading():number
    {
        return this._leading;
    }
    public set leading(leading:number)
    {
        if (this._leading !== leading)
        {
            this._leading = leading;
            this.styleID++;
        }
    }

    public get lineJoin():string
    {
        return this._lineJoin;
    }
    public set lineJoin(lineJoin:string)
    {
        if (this._lineJoin !== lineJoin)
        {
            this._lineJoin = lineJoin;
            this.styleID++;
        }
    }

    public get miterLimit():number
    {
        return this._miterLimit;
    }
    public set miterLimit(miterLimit:number)
    {
        if (this._miterLimit !== miterLimit)
        {
            this._miterLimit = miterLimit;
            this.styleID++;
        }
    }

    public get padding():number
    {
        return this._padding;
    }
    public set padding(padding:number)
    {
        if (this._padding !== padding)
        {
            this._padding = padding;
            this.styleID++;
        }
    }

    public get stroke():string|number
    {
        return this._stroke;
    }
    public set stroke(stroke:string|number) 
    {
        if(typeof(stroke) == 'number')
        {
            const outputColor = TextStyle.getColor(stroke);            
            if (this._stroke !== outputColor)
            {
                if(typeof(outputColor) == 'string')
                {
                    this._stroke = outputColor;
                    this.styleID++;
                }                
            }
        }        
    }

    public get strokeThickness():number
    {
        return this._strokeThickness;
    }
    public set strokeThickness(strokeThickness:number)
    {
        if (this._strokeThickness !== strokeThickness)
        {
            this._strokeThickness = strokeThickness;
            this.styleID++;
        }
    }

    public get textBaseline():string
    {
        return this._textBaseline;
    }
    public set textBaseline(textBaseline:string) 
    {
        if (this._textBaseline !== textBaseline)
        {
            this._textBaseline = textBaseline;
            this.styleID++;
        }
    }

    public get trim():boolean
    {
        return this._trim;
    }
    public set trim(trim:boolean)
    {
        if (this._trim !== trim)
        {
            this._trim = trim;
            this.styleID++;
        }
    }

    public get wordWrap():boolean
    {
        return this._wordWrap;
    }
    public set wordWrap(wordWrap:boolean)
    {
        if (this._wordWrap !== wordWrap)
        {
            this._wordWrap = wordWrap;
            this.styleID++;
        }
    }

    public get wordWrapWidth():number
    {
        return this._wordWrapWidth;
    }
    public set wordWrapWidth(wordWrapWidth:number)
    {
        if (this._wordWrapWidth !== wordWrapWidth)
        {
            this._wordWrapWidth = wordWrapWidth;
            this.styleID++;
        }
    }

    public toFontString():string|string[]
    {
        const fontSizeString = (typeof this.fontSize === 'number') ? `${this.fontSize}px` : this.fontSize;
        var fontFamilies:string|string[] = this.fontFamily;
        if (!Array.isArray(this.fontFamily))
        {
            fontFamilies = this.fontFamily.split(',');
            return fontFamilies;
        }
        for (let i = fontFamilies.length - 1; i >= 0; i--)
        {
            var convertedcolors:string[] = [];
            let fontFamily = fontFamilies[i].trim();
            if (!(/([\"\'])[^\'\"]+\1/).test(fontFamily))
            {
                fontFamily = `"${fontFamily}"`;
            }
            convertedcolors[i] = fontFamily;
        }
        return `${this.fontStyle} ${this.fontVariant} ${this.fontWeight} ${fontSizeString} ${convertedcolors.join(',')}`;
    }

    public static getSingleColor(color:number|string):string
    {
        if (typeof color === 'number')
        {
            return Utils.hex2string(color);
        }
        else if ( typeof color === 'string' )
        {
            if ( color.indexOf('0x') === 0 )
            {
                color = color.replace('0x', '#');
            }
        }
        return color;
    }

    public static getColor(color:number|number[]):string|string[]
    {
        if (!Array.isArray(color))
        {
            return TextStyle.getSingleColor(color);
        }
        else
        {
            var convertedcolors:string[] = [];
            for (let i = 0; i < color.length; ++i)
            {
                convertedcolors.push(TextStyle.getSingleColor(color[i]));
            }
            return convertedcolors;
        }
    }

    public static areArraysEqual(array1:any, array2:any):boolean
    {
        if (!Array.isArray(array1) || !Array.isArray(array2))
        {
            return false;
        }
        if (array1.length !== array2.length)
        {
            return false;
        }
        for (let i = 0; i < array1.length; ++i)
        {
            if (array1[i] !== array2[i])
            {
                return false;
            }
        }
        return true;
    }


}