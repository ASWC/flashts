import { TextStyle } from "flash/text/TextStyle";

export class TextMetrics
{
    public static canvas:HTMLCanvasElement;
    public static _context:CanvasRenderingContext2D;
    public static _fonts:any = {};
    protected text:string;
    protected style:TextStyle;
    protected _width:number;
    protected _height:number;
    protected _lines:string[];
    protected _lineWidths:number[];
    protected _lineHeight:number;
    protected _maxLineWidth:number;
    protected _fontProperties:any;
    protected fontSize:number|string;

    constructor(text:string, style:TextStyle, width:number, height:number, lines:string[], lineWidths:number[], lineHeight:number, maxLineWidth:number, fontProperties:any)
    {
        if(!TextMetrics.canvas)
        {
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

    public get fontProperties():any
    {
        return this._fontProperties;
    }

    public get maxLineWidth():number
    {
        return this._maxLineWidth;
    }

    public get lineWidths():number[]
    {
        return this._lineWidths;
    }

    public get lineHeight():number
    {
        return this._lineHeight;
    }

    public get lines():string[]
    {
        return this._lines;
    }

    public get height():number
    {
        return this._height;
    }

    public get width():number
    {
        return this._width;
    }

    public static measureText(text:string, style:TextStyle, wordWrap:boolean, canvas:HTMLCanvasElement = TextMetrics.canvas):TextMetrics
    {
        wordWrap = wordWrap || style.wordWrap;
        const font:string = <string> style.toFontString();
        const fontProperties = TextMetrics.measureFont(font);
        const context = canvas.getContext('2d');
        context.font = font;
        const outputText = wordWrap ? TextMetrics.wordWrap(text, style, canvas) : text;
        const lines = outputText.split(/(?:\r\n|\r|\n)/);
        const lineWidths = new Array(lines.length);
        let maxLineWidth = 0;
        for (let i = 0; i < lines.length; i++)
        {
            const lineWidth = context.measureText(lines[i]).width + ((lines[i].length - 1) * style.letterSpacing);
            lineWidths[i] = lineWidth;
            maxLineWidth = Math.max(maxLineWidth, lineWidth);
        }
        let width = maxLineWidth + style.strokeThickness;
        if (style.dropShadow)
        {
            width += style.dropShadowDistance;
        }
        const lineHeight = style.lineHeight || <number> fontProperties.fontSize + <number> style.strokeThickness;
        let height = Math.max(lineHeight, <number> fontProperties.fontSize + <number> style.strokeThickness)
            + ((lines.length - 1) * (lineHeight + style.leading));
        if (style.dropShadow)
        {
            height += style.dropShadowDistance;
        }
        return new TextMetrics(
            text,
            style,
            width,
            height,
            lines,
            lineWidths,
            lineHeight + style.leading,
            maxLineWidth,
            fontProperties
        );
    }

    public static wordWrap(text:string, style:TextStyle, canvas:HTMLCanvasElement = TextMetrics.canvas):string
    {
        const context = canvas.getContext('2d');
        let line = '';
        let width = 0;
        let lines = '';
        const cache = {};
        const ls = style.letterSpacing;
        const wordWrapWidth = style.wordWrapWidth + style.letterSpacing;
        const spaceWidth = TextMetrics.getFromCache(' ', ls, cache, context);
        const words = text.split(' ');
        for (let i = 0; i < words.length; i++)
        {
            const word = words[i];
            const wordWidth = TextMetrics.getFromCache(word, ls, cache, context);
            if (wordWidth > wordWrapWidth)
            {
                if (style.breakWords)
                {
                    const tmpWord = (line.length > 0) ? ` ${word}` : word;
                    const characters = tmpWord.split('');
                    for (let j = 0; j < characters.length; j++)
                    {
                        const character = characters[j];
                        const characterWidth = TextMetrics.getFromCache(character, ls, cache, context);
                        if (characterWidth + width > wordWrapWidth)
                        {
                            lines += TextMetrics.addLine(line);
                            line = '';
                            width = 0;
                        }
                        line += character;
                        width += characterWidth;
                    }
                }
                else
                {
                    if (line.length > 0)
                    {
                        lines += TextMetrics.addLine(line);
                        line = '';
                        width = 0;
                    }
                    lines += TextMetrics.addLine(word);
                    line = '';
                    width = 0;
                }
            }
            else
            {
                if (wordWidth + width > wordWrapWidth)
                {
                    lines += TextMetrics.addLine(line);
                    line = '';
                    width = 0;
                }
                if (line.length > 0)
                {
                    line += ` ${word}`;
                }
                else
                {
                    line += word;
                }
                width += wordWidth + spaceWidth;
            }
        }
        lines += TextMetrics.addLine(line, false);
        return lines;
    }

    public static addLine(line:string, newLine:boolean = true):string
    {
        line = (newLine) ? `${line}\n` : line;
        return line;
    }

    public static getFromCache(key:string, letterSpacing:number, cache:object, context:CanvasRenderingContext2D):number
    {
        let width = cache[key];
        if (width === undefined)
        {
            const spacing = ((key.length) * letterSpacing);
            width = context.measureText(key).width + spacing;
            cache[key] = width;
        }
        return width;
    }

    public static measureFont(font:string):TextMetrics
    {
        if(!TextMetrics.canvas)
        {
            TextMetrics.canvas = document.createElement('canvas');
            TextMetrics.canvas.width = TextMetrics.canvas.height = 10;
            TextMetrics._fonts = {};
            TextMetrics._context = TextMetrics.canvas.getContext('2d');
        }
        font = font || "Arial"
        if (TextMetrics._fonts[font])
        {
            return TextMetrics._fonts[font];
        }
        const properties:any = {};
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
        for (i = 0; i < baseline; ++i)
        {
            for (let j = 0; j < line; j += 4)
            {
                if (imagedata[idx + j] !== 255)
                {
                    stop = true;
                    break;
                }
            }
            if (!stop)
            {
                idx += line;
            }
            else
            {
                break;
            }
        }
        properties.ascent = baseline - i;
        idx = pixels - line;
        stop = false;
        for (i = height; i > baseline; --i)
        {
            for (let j = 0; j < line; j += 4)
            {
                if (imagedata[idx + j] !== 255)
                {
                    stop = true;
                    break;
                }
            }
            if (!stop)
            {
                idx -= line;
            }
            else
            {
                break;
            }
        }
        properties.descent = i - baseline;
        properties.fontSize = properties.ascent + properties.descent;
        TextMetrics._fonts[font] = properties;
        return properties;
    }
}


