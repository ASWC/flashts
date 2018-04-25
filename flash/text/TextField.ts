import { InteractiveObject } from "flash/display/InteractiveObject";
import { AntiAliasType } from "flash/text/AntiAliasType";
import { TextFieldAutoSize } from "flash/text/TextFieldAutoSize";

export class TextField extends InteractiveObject
{
    protected _alwaysShowSelection:boolean;
    protected _antiAliasType:string;
    protected _autoSize:string;
    protected _background:boolean;
    protected _backgroundColor:number;
    protected _border:boolean;
    protected _borderColor:number;
    protected _bottomScrollV:number;
    protected _caretIndex:number;
    protected _condenseWhite:boolean;

    constructor()
    {
        super();
        this._alwaysShowSelection = false;
        this._antiAliasType = AntiAliasType.NORMAL;
        this._autoSize = TextFieldAutoSize.NONE;
        this._background = false;
        this._border = false;
        this._backgroundColor = 0xFFFFFF;
        this._borderColor = 0x000000;
        this._bottomScrollV = 1;
        this._caretIndex = 0;
        this._condenseWhite = false;
    }

    public get condenseWhite():boolean
    {
        return this._condenseWhite;
    }
    public set condenseWhite(value:boolean)
    {
        this._condenseWhite = value;
    }

    public get caretIndex():number
    {
        return this._caretIndex;
    }

    public get bottomScrollV():number
    {
        return this._bottomScrollV;
    }

    public get borderColor():number
    {
        return this._borderColor;
    }

    public set borderColor(value:number)
    {
        this._borderColor = value;
    }

    public get border():boolean
    {
        return this._border;
    }
    public set border(value:boolean)
    {
        this._border = value;
    }

    public get backgroundColor():number
    {
        return this._backgroundColor;
    }

    public set backgroundColor(value:number)
    {
        this._backgroundColor = value;
    }

    public get background():boolean
    {
        return this._background;
    }
    public set background(value:boolean)
    {
        this._background = value;
    }

    public get autoSize():string
    {
        return this._autoSize;
    }
    public set autoSize(value:string)
    {
        this._autoSize = value;
    }

    public get alwaysShowSelection():boolean
    {
        return this._alwaysShowSelection;
    }
    public set alwaysShowSelection(value:boolean)
    {
        this._alwaysShowSelection = value;
    }

    public get antiAliasType():string
    {
        return this._antiAliasType;
    }
    public set antiAliasType(value:string)
    {
        this._antiAliasType = value;
    }



}