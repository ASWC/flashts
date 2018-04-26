import { GroupD8 } from "flash/rendering/math/GroupD8";
import { Rectangle } from "flash/geom/Rectangle";

export class TextureUvs
{
    public x0:number;
    public y0:number;
    public x1:number;
    public y1:number;
    public x2:number;
    public y2:number;
    public x3:number;
    public y3:number;
    public uvsUint32:Uint32Array;

    constructor()
    {
        this.x0 = 0;
        this.y0 = 0;
        this.x1 = 1;
        this.y1 = 0;
        this.x2 = 1;
        this.y2 = 1;
        this.x3 = 0;
        this.y3 = 1;
        this.uvsUint32 = new Uint32Array(4);
    }

    public set(frame:Rectangle, baseFrame:Rectangle, rotate:number):void
    {
        const tw:number = baseFrame.width;
        const th:number = baseFrame.height;
        if (rotate)
        {
            const w2:number = frame.width / 2 / tw;
            const h2:number = frame.height / 2 / th;
            const cX:number = (frame.x / tw) + w2;
            const cY:number = (frame.y / th) + h2;
            rotate = GroupD8.add(rotate, GroupD8.NW);
            this.x0 = cX + (w2 * GroupD8.uX(rotate));
            this.y0 = cY + (h2 * GroupD8.uY(rotate));
            rotate = GroupD8.add(rotate, 2); 
            this.x1 = cX + (w2 * GroupD8.uX(rotate));
            this.y1 = cY + (h2 * GroupD8.uY(rotate));
            rotate = GroupD8.add(rotate, 2);
            this.x2 = cX + (w2 * GroupD8.uX(rotate));
            this.y2 = cY + (h2 * GroupD8.uY(rotate));
            rotate = GroupD8.add(rotate, 2);
            this.x3 = cX + (w2 * GroupD8.uX(rotate));
            this.y3 = cY + (h2 * GroupD8.uY(rotate));
        }
        else
        {
            this.x0 = frame.x / tw;
            this.y0 = frame.y / th;
            this.x1 = (frame.x + frame.width) / tw;
            this.y1 = frame.y / th;
            this.x2 = (frame.x + frame.width) / tw;
            this.y2 = (frame.y + frame.height) / th;
            this.x3 = frame.x / tw;
            this.y3 = (frame.y + frame.height) / th;
        }
        this.uvsUint32[0] = (((this.y0 * 65535) & 0xFFFF) << 16) | ((this.x0 * 65535) & 0xFFFF);
        this.uvsUint32[1] = (((this.y1 * 65535) & 0xFFFF) << 16) | ((this.x1 * 65535) & 0xFFFF);
        this.uvsUint32[2] = (((this.y2 * 65535) & 0xFFFF) << 16) | ((this.x2 * 65535) & 0xFFFF);
        this.uvsUint32[3] = (((this.y3 * 65535) & 0xFFFF) << 16) | ((this.x3 * 65535) & 0xFFFF);
    }
}