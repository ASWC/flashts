import { Utils } from "flash/rendering/webgl/Utils";

export class StageSettings
{
    public static FPS:number = 60;
    public static MIPMAP_TEXTURES:boolean = false;
    public static RESOLUTION:number = 1;
    public static FILTER_RESOLUTION:number = 1;
    public static SPRITE_BATCH_SIZE:number = 4096;
    public static TRANSFORM_MODE:number = 0;
    public static GC_MODE:number = 0;
    public static GC_MAX_IDLE:number = 60 * 60;
    public static GC_MAX_CHECK_COUNT:number = 60 * 10;
    public static WRAP_MODE:number = 0;
    public static SCALE_MODE:number = 0;
    public static PRECISION_VERTEX:string = 'highp';
    public static PRECISION_FRAGMENT:string = 'mediump';
    public static MESH_CANVAS_PADDING:number = 0;

    public static get CAN_UPLOAD_SAME_BUFFER():boolean
    {
        var value:boolean = Utils.canUploadSameBuffer();
        return value;
    } 

    public static get SPRITE_MAX_TEXTURES():number
    {
        var maxtext:number = Utils.maxRecommendedTextures(32);
        return maxtext;
    } 

    public static get FPMS():number
    {
        return StageSettings.FPS / 1000;
    }
}