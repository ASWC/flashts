import { Bitmap } from "flash/display/Bitmap";
import { RenderTexture } from "../textures/RenderTexture";
import { Matrix } from "../../geom/Matrix";
import { Bounds } from "../math/Bounds";
import { Rectangle } from "../../geom/Rectangle";



export class SpriteBuffer
{
    public static getSprite(texture:RenderTexture, m:Matrix, bounds:Rectangle, alpha:number, area:Bounds):any
    {
        var cachedSprite:Bitmap = new Bitmap(texture);
        cachedSprite.transform.worldTransform = m;
        cachedSprite.anchor.x = -(bounds.x / bounds.width);
        cachedSprite.anchor.y = -(bounds.y / bounds.height);
        cachedSprite.alpha = alpha;
        cachedSprite.bounds = area;
        return cachedSprite;
    }
}