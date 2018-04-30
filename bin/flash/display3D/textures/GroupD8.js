define(["require", "exports", "flash/geom/Matrix"], function (require, exports, Matrix_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class GroupD8 {
        static signum(x) {
            if (x < 0) {
                return -1;
            }
            if (x > 0) {
                return 1;
            }
            return 0;
        }
        static init() {
            if (GroupD8._isInit) {
                return;
            }
            GroupD8._isInit = true;
            GroupD8.mul = [];
            for (let i = 0; i < 16; i++) {
                const row = [];
                GroupD8.mul.push(row);
                for (let j = 0; j < 16; j++) {
                    const _ux = GroupD8.signum((GroupD8.ux[i] * GroupD8.ux[j]) + (GroupD8.vx[i] * GroupD8.uy[j]));
                    const _uy = GroupD8.signum((GroupD8.uy[i] * GroupD8.ux[j]) + (GroupD8.vy[i] * GroupD8.uy[j]));
                    const _vx = GroupD8.signum((GroupD8.ux[i] * GroupD8.vx[j]) + (GroupD8.vx[i] * GroupD8.vy[j]));
                    const _vy = GroupD8.signum((GroupD8.uy[i] * GroupD8.vx[j]) + (GroupD8.vy[i] * GroupD8.vy[j]));
                    for (let k = 0; k < 16; k++) {
                        if (GroupD8.ux[k] === _ux && GroupD8.uy[k] === _uy && GroupD8.vx[k] === _vx && GroupD8.vy[k] === _vy) {
                            row.push(k);
                            break;
                        }
                    }
                }
            }
            for (let i = 0; i < 16; i++) {
                const mat = new Matrix_1.Matrix();
                mat.set(GroupD8.ux[i], GroupD8.uy[i], GroupD8.vx[i], GroupD8.vy[i], 0, 0);
                GroupD8.tempMatrices.push(mat);
            }
        }
        static uX(ind) {
            GroupD8.init();
            return GroupD8.ux[ind];
        }
        static uY(ind) {
            GroupD8.init();
            return GroupD8.uy[ind];
        }
        static vX(ind) {
            GroupD8.init();
            return GroupD8.vx[ind];
        }
        static vY(ind) {
            GroupD8.init();
            return GroupD8.vy[ind];
        }
        static add(rotationSecond, rotationFirst) {
            GroupD8.init();
            return GroupD8.mul[rotationSecond][rotationFirst];
        }
        static inv(rotation) {
            if (rotation & 8) {
                return rotation & 15;
            }
            return (-rotation) & 7;
        }
        static sub(rotationSecond, rotationFirst) {
            GroupD8.mul[rotationSecond][GroupD8.inv(rotationFirst)];
        }
        static rotate180(rotation) {
            return rotation ^ 4;
        }
        static isVertical(rotation) {
            return (rotation & 3) === 2;
        }
        static byDirection(dx, dy) {
            if (Math.abs(dx) * 2 <= Math.abs(dy)) {
                if (dy >= 0) {
                    return GroupD8.S;
                }
                return GroupD8.N;
            }
            else if (Math.abs(dy) * 2 <= Math.abs(dx)) {
                if (dx > 0) {
                    return GroupD8.E;
                }
                return GroupD8.W;
            }
            else if (dy > 0) {
                if (dx > 0) {
                    return GroupD8.SE;
                }
                return GroupD8.SW;
            }
            else if (dx > 0) {
                return GroupD8.NE;
            }
            return GroupD8.NW;
        }
        static matrixAppendRotationInv(matrix, rotation, tx = 0, ty = 0) {
            const mat = GroupD8.tempMatrices[GroupD8.inv(rotation)];
            mat.tx = tx;
            mat.ty = ty;
            matrix.append(mat);
        }
    }
    GroupD8._isInit = false;
    GroupD8.E = 0;
    GroupD8.SE = 1;
    GroupD8.S = 2;
    GroupD8.SW = 3;
    GroupD8.W = 4;
    GroupD8.NW = 5;
    GroupD8.N = 6;
    GroupD8.NE = 7;
    GroupD8.MIRROR_VERTICAL = 8;
    GroupD8.MIRROR_HORIZONTAL = 12;
    GroupD8.ux = [1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1, 0, 1];
    GroupD8.uy = [0, 1, 1, 1, 0, -1, -1, -1, 0, 1, 1, 1, 0, -1, -1, -1];
    GroupD8.vx = [0, -1, -1, -1, 0, 1, 1, 1, 0, 1, 1, 1, 0, -1, -1, -1];
    GroupD8.vy = [1, 1, 0, -1, -1, -1, 0, 1, -1, -1, 0, 1, 1, 1, 0, -1];
    GroupD8.tempMatrices = [];
    GroupD8.mul = [];
    exports.GroupD8 = GroupD8;
});
//# sourceMappingURL=GroupD8.js.map