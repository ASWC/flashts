import { Matrix } from "../../geom/Matrix";



export class GroupD8
{
    public static E:any = 0
    public static SE:any =  1
    public static S:any =  2
    public static SW:any =  3
    public static W:any =  4
    public static NW:any =  5
    public static N:any =  6
    public static NE:any =  7
    public static MIRROR_VERTICAL:any =  8
    public static MIRROR_HORIZONTAL:any =  12
    public static ux = [1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1, 0, 1];
    public static uy = [0, 1, 1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1];
    public static vx = [0, -1, -1, -1, 0, 1, 1, 1, 0, 1, 1, 1, 0, -1, -1, -1];
    public static vy = [1, 1, 0, -1, -1, -1, 0, 1, -1, -1, 0, 1, 1, 1, 0, -1];
    public static tempMatrices = [];
    public static mul = [];

    constructor()
    {
        GroupD8.init();
    }

    public static signum(x)
    {
        if (x < 0)
        {
            return -1;
        }
        if (x > 0)
        {
            return 1;
        }

        return 0;
    }

    public static init()
    {
        for (let i = 0; i < 16; i++)
        {
            const row = [];

            GroupD8.mul.push(row);

            for (let j = 0; j < 16; j++)
            {
                const _ux = GroupD8.signum((GroupD8.ux[i] * GroupD8.ux[j]) + (GroupD8.vx[i] * GroupD8.uy[j]));
                const _uy = GroupD8.signum((GroupD8.uy[i] * GroupD8.ux[j]) + (GroupD8.vy[i] * GroupD8.uy[j]));
                const _vx = GroupD8.signum((GroupD8.ux[i] * GroupD8.vx[j]) + (GroupD8.vx[i] * GroupD8.vy[j]));
                const _vy = GroupD8.signum((GroupD8.uy[i] * GroupD8.vx[j]) + (GroupD8.vy[i] * GroupD8.vy[j]));

                for (let k = 0; k < 16; k++)
                {
                    if (GroupD8.ux[k] === _ux && GroupD8.uy[k] === _uy && GroupD8.vx[k] === _vx && GroupD8.vy[k] === _vy)
                    {
                        row.push(k);
                        break;
                    }
                }
            }
        }

        for (let i = 0; i < 16; i++)
        {
            const mat = new Matrix();

            mat.set(GroupD8.ux[i], GroupD8.uy[i], GroupD8.vx[i], GroupD8.vy[i], 0, 0);
            GroupD8.tempMatrices.push(mat);
        }
    }

    public static uX(ind)  {return GroupD8.ux[ind]}
    public static uY(ind)  {return GroupD8.uy[ind]}
    public static vX(ind)  {return GroupD8.vx[ind]}
    public static vY(ind)  {return GroupD8.vy[ind]}
    public static inv(rotation) 
    {
        if (rotation & 8)
        {
            return rotation & 15;
        }

        return (-rotation) & 7;
    }
    public static add(rotationSecond, rotationFirst)  {GroupD8.mul[rotationSecond][rotationFirst]}
    public static sub(rotationSecond, rotationFirst) { GroupD8.mul[rotationSecond][GroupD8.inv(rotationFirst)]}

    /**
     * Adds 180 degrees to rotation. Commutative operation.
     *
     * @memberof PIXI.GroupD8
     * @param {number} rotation - The number to rotate.
     * @returns {number} rotated number
     */
    public static rotate180 (rotation) { rotation ^ 4}

    /**
     * Direction of main vector can be horizontal, vertical or diagonal.
     * Some objects work with vertical directions different.
     *
     * @memberof PIXI.GroupD8
     * @param {number} rotation - The number to check.
     * @returns {boolean} Whether or not the direction is vertical
     */
    public static isVertical (rotation) { (rotation & 3) === 2}

    /**
     * @memberof PIXI.GroupD8
     * @param {number} dx - TODO
     * @param {number} dy - TODO
     *
     * @return {number} TODO
     */
    public static byDirection (dx, dy) 
    {
        if (Math.abs(dx) * 2 <= Math.abs(dy))
        {
            if (dy >= 0)
            {
                return GroupD8.S;
            }

            return GroupD8.N;
        }
        else if (Math.abs(dy) * 2 <= Math.abs(dx))
        {
            if (dx > 0)
            {
                return GroupD8.E;
            }

            return GroupD8.W;
        }
        else if (dy > 0)
        {
            if (dx > 0)
            {
                return GroupD8.SE;
            }

            return GroupD8.SW;
        }
        else if (dx > 0)
        {
            return GroupD8.NE;
        }

        return GroupD8.NW;
    }

    /**
     * Helps sprite to compensate texture packer rotation.
     *
     * @memberof PIXI.GroupD8
     * @param {PIXI.Matrix} matrix - sprite world matrix
     * @param {number} rotation - The rotation factor to use.
     * @param {number} tx - sprite anchoring
     * @param {number} ty - sprite anchoring
     */
    public static matrixAppendRotationInv (matrix, rotation, tx = 0, ty = 0) 
    {
        // Packer used "rotation", we use "inv(rotation)"
        const mat = GroupD8.tempMatrices[GroupD8.inv(rotation)];

        mat.tx = tx;
        mat.ty = ty;
        matrix.append(mat);
    }
}