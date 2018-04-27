import { Point } from "flash/geom/Point";
import { Constants } from "flash/rendering/managers/Constants";
import { WebGLGraphicsData } from "flash/rendering/core/gl/WebGLGraphicsData";
import { GraphicsData } from "flash/geom/shapes/GraphicsData";
import { Graphics } from "flash/display/Graphics";
import { WebGLData } from "flash/geom/shapes/WebGLData";

export class ShapeUtils
{
    public static buildRoundedRectangle(webGLData:WebGLGraphicsData, graphicsData:GraphicsData, webGLDataNativeLines:any):void
    {
        const rrectData = graphicsData.shape;
        const x = rrectData.x;
        const y = rrectData.y;
        const width = rrectData.width;
        const height = rrectData.height;
        const radius = rrectData.radius;
        const recPoints = [];
        recPoints.push(x, y + radius);
        ShapeUtils.quadraticBezierCurve(x, y + height - radius, x, y + height, x + radius, y + height, recPoints);
        ShapeUtils.quadraticBezierCurve(x + width - radius, y + height, x + width, y + height, x + width, y + height - radius, recPoints);
        ShapeUtils.quadraticBezierCurve(x + width, y + radius, x + width, y, x + width - radius, y, recPoints);
        ShapeUtils.quadraticBezierCurve(x + radius, y, x, y, x, y + radius + 0.0000000001, recPoints);
        if (graphicsData.fill)
        {
            const color = ShapeUtils.hex2rgb(graphicsData.fillColor);
            const alpha = graphicsData.fillAlpha;
            const r = color[0] * alpha;
            const g = color[1] * alpha;
            const b = color[2] * alpha;
            const verts = webGLData.points;
            const indices = webGLData.indices;
            const vecPos = verts.length / 6;
            const triangles = ShapeUtils.earcut(recPoints, null, 2);
            for (let i = 0, j = triangles.length; i < j; i += 3)
            {
                indices.push(triangles[i] + vecPos);
                indices.push(triangles[i] + vecPos);
                indices.push(triangles[i + 1] + vecPos);
                indices.push(triangles[i + 2] + vecPos);
                indices.push(triangles[i + 2] + vecPos);
            }
            for (let i = 0, j = recPoints.length; i < j; i++)
            {
                verts.push(recPoints[i], recPoints[++i], r, g, b, alpha);
            }
        }
        if (graphicsData.lineWidth)
        {
            const tempPoints = graphicsData.points;
            graphicsData.points = recPoints;
            ShapeUtils.buildLine(graphicsData, webGLData);
            graphicsData.points = tempPoints;
        }
    }

    public static getPt(n1:number, n2:number, perc:number):number
    {
        const diff = n2 - n1;
        return n1 + (diff * perc);
    }

    public static  quadraticBezierCurve(fromX:number, fromY:number, cpX:number, cpY:number, toX:number, toY:number, out:number[] = []):number[]
    {
        const n = 20;
        const points = out;
        let xa = 0;
        let ya = 0;
        let xb = 0;
        let yb = 0;
        let x = 0;
        let y = 0;
        for (let i = 0, j = 0; i <= n; ++i)
        {
            j = i / n;
            xa = ShapeUtils.getPt(fromX, cpX, j);
            ya = ShapeUtils.getPt(fromY, cpY, j);
            xb = ShapeUtils.getPt(cpX, toX, j);
            yb = ShapeUtils.getPt(cpY, toY, j);
            x = ShapeUtils.getPt(xa, xb, j);
            y = ShapeUtils.getPt(ya, yb, j);
            points.push(x, y);
        }
        return points;
    }
    
    public static buildComplexPoly(webGLData:WebGLGraphicsData, graphicsData:GraphicsData):void
    {
        const points = graphicsData.points.slice();
        if (points.length < 6)
        {
            return;
        }
        const indices = webGLData.indices;
        webGLData.points = points;
        //webGLData.alpha = graphicsData.fillAlpha;
        webGLData.color = ShapeUtils.hex2rgb(graphicsData.fillColor);
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let x = 0;
        let y = 0;
        for (let i = 0; i < points.length; i += 2)
        {
            x = points[i];
            y = points[i + 1];
            minX = x < minX ? x : minX;
            maxX = x > maxX ? x : maxX;
            minY = y < minY ? y : minY;
            maxY = y > maxY ? y : maxY;
        }
        points.push(minX, minY,
                    maxX, minY,
                    maxX, maxY,
                    minX, maxY);
        const length = points.length / 2;
        for (let i = 0; i < length; i++)
        {
            indices.push(i);
        }
    }

    public static buildCircle(webGLData:WebGLGraphicsData, graphicsData:GraphicsData, webGLDataNativeLines:any):void
    {
        const circleData = graphicsData.shape;
        const x = circleData.x;
        const y = circleData.y;
        let width;
        let height;
        if (graphicsData.type === Constants.SHAPES.CIRC)
        {
            width = circleData.radius;
            height = circleData.radius;
        }
        else
        {
            width = circleData.width;
            height = circleData.height;
        }
        if (width === 0 || height === 0)
        {
            return;
        }
        const totalSegs = Math.floor(30 * Math.sqrt(circleData.radius))
            || Math.floor(15 * Math.sqrt(circleData.width + circleData.height));
        const seg = (Math.PI * 2) / totalSegs;
        if (graphicsData.fill)
        {
            const color = ShapeUtils.hex2rgb(graphicsData.fillColor);
            const alpha = graphicsData.fillAlpha;
            const r = color[0] * alpha;
            const g = color[1] * alpha;
            const b = color[2] * alpha;
            const verts = webGLData.points;
            const indices = webGLData.indices;
            let vecPos = verts.length / 6;
            indices.push(vecPos);
            for (let i = 0; i < totalSegs + 1; i++)
            {
                verts.push(x, y, r, g, b, alpha);
                verts.push(
                    x + (Math.sin(seg * i) * width),
                    y + (Math.cos(seg * i) * height),
                    r, g, b, alpha
                );
                indices.push(vecPos++, vecPos++);
            }
            indices.push(vecPos - 1);
        }
        if (graphicsData.lineWidth)
        {
            const tempPoints = graphicsData.points;
            graphicsData.points = [];
            for (let i = 0; i < totalSegs + 1; i++)
            {
                graphicsData.points.push(
                    x + (Math.sin(seg * i) * width),
                    y + (Math.cos(seg * i) * height)
                );
            }
            ShapeUtils.buildLine(graphicsData, webGLData);
            graphicsData.points = tempPoints;
        }
    }
 
    public static buildRectangle(webGLData:WebGLGraphicsData, graphicsData:GraphicsData, webGLDataNativeLines:any):void
    {
        const rectData = graphicsData.shape;
        const x = rectData.x;
        const y = rectData.y;
        const width = rectData.width;
        const height = rectData.height;
        if (graphicsData.fill)
        {
            const color = ShapeUtils.hex2rgb(graphicsData.fillColor);
            const alpha = graphicsData.fillAlpha;
            const r = color[0] * alpha;
            const g = color[1] * alpha;
            const b = color[2] * alpha;
            const verts = webGLData.points;
            const indices = webGLData.indices;
            const vertPos = verts.length / 6;
            verts.push(x, y);
            verts.push(r, g, b, alpha);
            verts.push(x + width, y);
            verts.push(r, g, b, alpha);
            verts.push(x, y + height);
            verts.push(r, g, b, alpha);
            verts.push(x + width, y + height);
            verts.push(r, g, b, alpha);
            indices.push(vertPos, vertPos, vertPos + 1, vertPos + 2, vertPos + 3, vertPos + 3);
        }
        if (graphicsData.lineWidth)
        {
            const tempPoints = graphicsData.points;
            graphicsData.points = [x, y,
                x + width, y,
                x + width, y + height,
                x, y + height,
                x, y];
                ShapeUtils.buildLine(graphicsData, webGLData);
            graphicsData.points = tempPoints;
        }
    }

    public static buildPoly(webGLData:WebGLGraphicsData, graphicsData:GraphicsData , webGLDataNativeLines:any):void
    {
        graphicsData.points = graphicsData.shape.points.slice();
        let points = graphicsData.points;
        if (graphicsData.fill && points.length >= 6)
        {
            const holeArray = [];
            const holes = graphicsData.holes;
            for (let i = 0; i < holes.length; i++)
            {
                const hole = holes[i];
                holeArray.push(points.length / 2);
                points = points.concat(hole.points);
            }
            const verts = webGLData.points;
            const indices = webGLData.indices;
            const length = points.length / 2;
            const color = ShapeUtils.hex2rgb(graphicsData.fillColor);
            const alpha = graphicsData.fillAlpha;
            const r = color[0] * alpha;
            const g = color[1] * alpha;
            const b = color[2] * alpha;
            const triangles = ShapeUtils.earcut(points, holeArray, 2);
            if (!triangles)
            {
                return;
            }
            const vertPos = verts.length / 6;
            for (let i = 0; i < triangles.length; i += 3)
            {
                indices.push(triangles[i] + vertPos);
                indices.push(triangles[i] + vertPos);
                indices.push(triangles[i + 1] + vertPos);
                indices.push(triangles[i + 2] + vertPos);
                indices.push(triangles[i + 2] + vertPos);
            }
            for (let i = 0; i < length; i++)
            {
                verts.push(points[i * 2], points[(i * 2) + 1],
                    r, g, b, alpha);
            }
        }
        if (graphicsData.lineWidth > 0)
        {
            ShapeUtils.buildLine(graphicsData, webGLData);
        }
    }

    public static earcut(data, holeIndices, dim) 
    {    
        dim = dim || 2;    
        var hasHoles = holeIndices && holeIndices.length,
            outerLen = hasHoles ? holeIndices[0] * dim : data.length,
            outerNode = ShapeUtils.linkedList(data, 0, outerLen, dim, true),
            triangles = [];    
        if (!outerNode) return triangles;    
        var minX, minY, maxX, maxY, x, y, invSize;    
        if (hasHoles) outerNode = ShapeUtils.eliminateHoles(data, holeIndices, outerNode, dim);
        if (data.length > 80 * dim) {
            minX = maxX = data[0];
            minY = maxY = data[1];    
            for (var i = dim; i < outerLen; i += dim) {
                x = data[i];
                y = data[i + 1];
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
            invSize = Math.max(maxX - minX, maxY - minY);
            invSize = invSize !== 0 ? 1 / invSize : 0;
        }    
        ShapeUtils.earcutLinked(outerNode, triangles, dim, minX, minY, invSize);    
        return triangles;
    }

    public static earcutLinked(ear, triangles, dim, minX, minY, invSize, pass = null) 
    {
        if (!ear) return;
        if (!pass && invSize) ShapeUtils.indexCurve(ear, minX, minY, invSize);    
        var stop = ear,
            prev, next;    
        while (ear.prev !== ear.next) 
        {
            prev = ear.prev;
            next = ear.next;    
            if (invSize ? ShapeUtils.isEarHashed(ear, minX, minY, invSize) : ShapeUtils.isEar(ear)) 
            {
                triangles.push(prev.i / dim);
                triangles.push(ear.i / dim);
                triangles.push(next.i / dim);    
                ShapeUtils.removeNode(ear);
                ear = next.next;
                stop = next.next;    
                continue;
            }    
            ear = next;
            if (ear === stop) 
            {
                if (!pass) 
                {
                    ShapeUtils.earcutLinked(ShapeUtils.filterPoints(ear), triangles, dim, minX, minY, invSize, 1);
                } 
                else if (pass === 1) 
                {
                    ear = ShapeUtils.cureLocalIntersections(ear, triangles, dim);
                    ShapeUtils.earcutLinked(ear, triangles, dim, minX, minY, invSize, 2);
                } 
                else if (pass === 2) 
                {
                    ShapeUtils.splitEarcut(ear, triangles, dim, minX, minY, invSize);
                }    
                break;
            }
        }
    }

    public static isEar(ear) 
    {
        var a = ear.prev,
            b = ear,
            c = ear.next;    
        if (ShapeUtils.area(a, b, c) >= 0) return false;
        var p = ear.next.next;    
        while (p !== ear.prev) 
        {
            if (ShapeUtils.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
            ShapeUtils.area(p.prev, p, p.next) >= 0) return false;
            p = p.next;
        }    
        return true;
    }

    public static indexCurve(start, minX, minY, invSize) 
    {
        var p = start;
        do 
        {
            if (p.z === null) p.z = ShapeUtils.zOrder(p.x, p.y, minX, minY, invSize);
            p.prevZ = p.prev;
            p.nextZ = p.next;
            p = p.next;
        } while (p !== start);    
        p.prevZ.nextZ = null;
        p.prevZ = null;    
        ShapeUtils.sortLinked(p);
    }

    public static sortLinked(list) 
    {
        var i, p, q, e, tail, numMerges, pSize, qSize,
            inSize = 1;    
        do 
        {
            p = list;
            list = null;
            tail = null;
            numMerges = 0;    
            while (p) 
            {
                numMerges++;
                q = p;
                pSize = 0;
                for (i = 0; i < inSize; i++) 
                {
                    pSize++;
                    q = q.nextZ;
                    if (!q) break;
                }
                qSize = inSize;    
                while (pSize > 0 || (qSize > 0 && q)) 
                {
    
                    if (pSize !== 0 && (qSize === 0 || !q || p.z <= q.z)) 
                    {
                        e = p;
                        p = p.nextZ;
                        pSize--;
                    } 
                    else 
                    {
                        e = q;
                        q = q.nextZ;
                        qSize--;
                    }    
                    if (tail) tail.nextZ = e;
                    else list = e;    
                    e.prevZ = tail;
                    tail = e;
                }    
                p = q;
            }    
            tail.nextZ = null;
            inSize *= 2;    
        } while (numMerges > 1);    
        return list;
    }

    public static isEarHashed(ear, minX, minY, invSize) 
    {
        var a = ear.prev,
            b = ear,
            c = ear.next;    
        if (ShapeUtils.area(a, b, c) >= 0) return false;
        var minTX = a.x < b.x ? (a.x < c.x ? a.x : c.x) : (b.x < c.x ? b.x : c.x),
            minTY = a.y < b.y ? (a.y < c.y ? a.y : c.y) : (b.y < c.y ? b.y : c.y),
            maxTX = a.x > b.x ? (a.x > c.x ? a.x : c.x) : (b.x > c.x ? b.x : c.x),
            maxTY = a.y > b.y ? (a.y > c.y ? a.y : c.y) : (b.y > c.y ? b.y : c.y);
        var minZ = ShapeUtils.zOrder(minTX, minTY, minX, minY, invSize),
            maxZ = ShapeUtils.zOrder(maxTX, maxTY, minX, minY, invSize);    
        var p = ear.prevZ,
            n = ear.nextZ;
        while (p && p.z >= minZ && n && n.z <= maxZ) 
        {
            if (p !== ear.prev && p !== ear.next &&
                ShapeUtils.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                ShapeUtils.area(p.prev, p, p.next) >= 0) return false;
            p = p.prevZ;    
            if (n !== ear.prev && n !== ear.next &&
                ShapeUtils.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y) &&
                ShapeUtils.area(n.prev, n, n.next) >= 0) return false;
            n = n.nextZ;
        }
        while (p && p.z >= minZ) 
        {
            if (p !== ear.prev && p !== ear.next &&
                ShapeUtils.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, p.x, p.y) &&
                ShapeUtils.area(p.prev, p, p.next) >= 0) return false;
            p = p.prevZ;
        }
        while (n && n.z <= maxZ) 
        {
            if (n !== ear.prev && n !== ear.next &&
                ShapeUtils.pointInTriangle(a.x, a.y, b.x, b.y, c.x, c.y, n.x, n.y) &&
                ShapeUtils.area(n.prev, n, n.next) >= 0) return false;
            n = n.nextZ;
        }    
        return true;
    }

    public static zOrder(x, y, minX, minY, invSize) 
    {
        x = 32767 * (x - minX) * invSize;
        y = 32767 * (y - minY) * invSize;    
        x = (x | (x << 8)) & 0x00FF00FF;
        x = (x | (x << 4)) & 0x0F0F0F0F;
        x = (x | (x << 2)) & 0x33333333;
        x = (x | (x << 1)) & 0x55555555;    
        y = (y | (y << 8)) & 0x00FF00FF;
        y = (y | (y << 4)) & 0x0F0F0F0F;
        y = (y | (y << 2)) & 0x33333333;
        y = (y | (y << 1)) & 0x55555555;    
        return x | (y << 1);
    }

    public static cureLocalIntersections(start, triangles, dim) 
    {
        var p = start;
        do 
        {
            var a = p.prev,
                b = p.next.next;    
            if (!ShapeUtils.equals(a, b) && ShapeUtils.intersects(a, p, p.next, b) && ShapeUtils.locallyInside(a, b) && ShapeUtils.locallyInside(b, a)) 
            {    
                triangles.push(a.i / dim);
                triangles.push(p.i / dim);
                triangles.push(b.i / dim);
                ShapeUtils.removeNode(p);
                ShapeUtils.removeNode(p.next);    
                p = start = b;
            }
            p = p.next;
        } while (p !== start);    
        return p;
    }

    public static splitEarcut(start, triangles, dim, minX, minY, invSize) 
    {
        var a = start;
        do 
        {
            var b = a.next.next;
            while (b !== a.prev) 
            {
                if (a.i !== b.i && ShapeUtils.isValidDiagonal(a, b)) 
                {
                    var c = ShapeUtils.splitPolygon(a, b);
                    a = ShapeUtils.filterPoints(a, a.next);
                    c = ShapeUtils.filterPoints(c, c.next);
                    ShapeUtils.earcutLinked(a, triangles, dim, minX, minY, invSize);
                    ShapeUtils.earcutLinked(c, triangles, dim, minX, minY, invSize);
                    return;
                }
                b = b.next;
            }
            a = a.next;
        } while (a !== start);
    }

    public static isValidDiagonal(a, b) 
    {
        return a.next.i !== b.i && a.prev.i !== b.i && !ShapeUtils.intersectsPolygon(a, b) &&
        ShapeUtils.locallyInside(a, b) && ShapeUtils.locallyInside(b, a) && ShapeUtils.middleInside(a, b);
    }

    public static intersectsPolygon(a, b) 
    {
        var p = a;
        do 
        {
            if (p.i !== a.i && p.next.i !== a.i && p.i !== b.i && p.next.i !== b.i &&
                ShapeUtils.intersects(p, p.next, a, b)) return true;
            p = p.next;
        } while (p !== a);    
        return false;
    }

    public static intersects(p1, q1, p2, q2) 
    {
        if ((ShapeUtils.equals(p1, q1) && ShapeUtils.equals(p2, q2)) ||
            (ShapeUtils.equals(p1, q2) && ShapeUtils.equals(p2, q1))) return true;
        return ShapeUtils.area(p1, q1, p2) > 0 !== ShapeUtils.area(p1, q1, q2) > 0 &&
        ShapeUtils.area(p2, q2, p1) > 0 !== ShapeUtils.area(p2, q2, q1) > 0;
    }

    public static middleInside(a, b) 
    {
        var p = a,
            inside = false,
            px = (a.x + b.x) / 2,
            py = (a.y + b.y) / 2;
        do {
            if (((p.y > py) !== (p.next.y > py)) && p.next.y !== p.y &&
                    (px < (p.next.x - p.x) * (py - p.y) / (p.next.y - p.y) + p.x))
                inside = !inside;
            p = p.next;
        } while (p !== a);    
        return inside;
    }

    public static eliminateHoles(data, holeIndices, outerNode, dim) 
    {
        var queue = [],
            i, len, start, end, list;        
        for (i = 0, len = holeIndices.length; i < len; i++) 
        {
            start = holeIndices[i] * dim;
            end = i < len - 1 ? holeIndices[i + 1] * dim : data.length;
            list = ShapeUtils.linkedList(data, start, end, dim, false);
            if (list === list.next) list.steiner = true;
            queue.push(ShapeUtils.getLeftmost(list));
        }        
        queue.sort(ShapeUtils.compareX);
        for (i = 0; i < queue.length; i++) 
        {
            ShapeUtils.eliminateHole(queue[i], outerNode);
            outerNode = ShapeUtils.filterPoints(outerNode, outerNode.next);
        }        
        return outerNode;
    }

    public static getLeftmost(start) 
    {
        var p = start,
            leftmost = start;
        do 
        {
            if (p.x < leftmost.x) leftmost = p;
            p = p.next;
        } while (p !== start);    
        return leftmost;
    }

    public static eliminateHole(hole, outerNode) 
    {
        outerNode = ShapeUtils.findHoleBridge(hole, outerNode);
        if (outerNode) 
        {
            var b = ShapeUtils.splitPolygon(outerNode, hole);
            ShapeUtils.filterPoints(b, b.next);
        }
    }

    public static splitPolygon(a, b) 
    {
        var a2 = new Node(a.i, a.x, a.y),
            b2 = new Node(b.i, b.x, b.y),
            an = a.next,
            bp = b.prev;    
        a.next = b;
        b.prev = a;    
        a2.next = an;
        an.prev = a2;    
        b2.next = a2;
        a2.prev = b2;    
        bp.next = b2;
        b2.prev = bp;    
        return b2;
    }

    public static findHoleBridge(hole, outerNode) 
    {
        var p = outerNode,
            hx = hole.x,
            hy = hole.y,
            qx = -Infinity,
            m;
        do 
        {
            if (hy <= p.y && hy >= p.next.y && p.next.y !== p.y) 
            {
                var x = p.x + (hy - p.y) * (p.next.x - p.x) / (p.next.y - p.y);
                if (x <= hx && x > qx) 
                {
                    qx = x;
                    if (x === hx) 
                    {
                        if (hy === p.y) return p;
                        if (hy === p.next.y) return p.next;
                    }
                    m = p.x < p.next.x ? p : p.next;
                }
            }
            p = p.next;
        } while (p !== outerNode);    
        if (!m) return null;    
        if (hx === qx) return m.prev;     
        var stop = m,
            mx = m.x,
            my = m.y,
            tanMin = Infinity,
            tan;    
        p = m.next;    
        while (p !== stop) 
        {
            if (hx >= p.x && p.x >= mx && hx !== p.x &&
                ShapeUtils.pointInTriangle(hy < my ? hx : qx, hy, mx, my, hy < my ? qx : hx, hy, p.x, p.y)) 
                {    
                tan = Math.abs(hy - p.y) / (hx - p.x); // tangential    
                if ((tan < tanMin || (tan === tanMin && p.x > m.x)) && ShapeUtils.locallyInside(p, hole)) 
                {
                    m = p;
                    tanMin = tan;
                }
            }    
            p = p.next;
        }    
        return m;
    }

    public static locallyInside(a, b) 
    {
        return ShapeUtils.area(a.prev, a, a.next) < 0 ?
        ShapeUtils.area(a, b, a.next) >= 0 && ShapeUtils.area(a, a.prev, b) >= 0 :
        ShapeUtils.area(a, b, a.prev) < 0 || ShapeUtils.area(a, a.next, b) < 0;
    }

    public static pointInTriangle(ax, ay, bx, by, cx, cy, px, py) 
    {
        return (cx - px) * (ay - py) - (ax - px) * (cy - py) >= 0 &&
               (ax - px) * (by - py) - (bx - px) * (ay - py) >= 0 &&
               (bx - px) * (cy - py) - (cx - px) * (by - py) >= 0;
    }

    public static filterPoints(start, end = null) 
    {
        if (!start) return start;
        if (!end) end = start;    
        var p = start,
            again;
        do {
            again = false;
    
            if (!p.steiner && (ShapeUtils.equals(p, p.next) || ShapeUtils.area(p.prev, p, p.next) === 0)) {
                ShapeUtils.removeNode(p);
                p = end = p.prev;
                if (p === p.next) break;
                again = true;
    
            } else {
                p = p.next;
            }
        } while (again || p !== end);    
        return end;
    }

    public static area(p, q, r) 
    {
        return (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    }

    public static compareX(a, b) 
    {
        return a.x - b.x;
    }

    public static linkedList(data, start, end, dim, clockwise) 
    {
        var i, last;        
        if (clockwise === (ShapeUtils.signedArea(data, start, end, dim) > 0)) {
            for (i = start; i < end; i += dim) last = ShapeUtils.insertNode(i, data[i], data[i + 1], last);
        } else {
            for (i = end - dim; i >= start; i -= dim) last = ShapeUtils.insertNode(i, data[i], data[i + 1], last);
        }        
        if (last && ShapeUtils.equals(last, last.next)) {
            ShapeUtils.removeNode(last);
            last = last.next;
        }        
        return last;
    }

    public static equals(p1, p2) 
    {
        return p1.x === p2.x && p1.y === p2.y;
    }

    public static removeNode(p) 
    {
        p.next.prev = p.prev;
        p.prev.next = p.next;    
        if (p.prevZ) p.prevZ.nextZ = p.nextZ;
        if (p.nextZ) p.nextZ.prevZ = p.prevZ;
    }

    public static insertNode(i, x, y, last) 
    {
        var p = new Node(i, x, y);        
        if (!last) {
            p.prev = p;
            p.next = p;
        
        } else {
            p.next = last.next;
            p.prev = last;
            last.next.prev = p;
            last.next = p;
        }
        return p;
    }

    public static  signedArea(data, start, end, dim) 
    {
        var sum = 0;
        for (var i = start, j = end - dim; i < end; i += dim) {
            sum += (data[j] - data[i]) * (data[i + 1] + data[j + 1]);
            j = i;
        }
        return sum;
    }
 
    public static buildLine(graphicsData:GraphicsData, webGLData:any):void
    {
        let points = graphicsData.points;
        if (points.length === 0)
        {
            return;
        }
        if (graphicsData.nativeLines)
        {
            ShapeUtils.buildNativeLine(graphicsData, webGLData);
            return;
        }
        const firstPoint = new Point(points[0], points[1]);
        let lastPoint = new Point(points[points.length - 2], points[points.length - 1]);
        if (firstPoint.x === lastPoint.x && firstPoint.y === lastPoint.y)
        {
            points = points.slice();
            points.pop();
            points.pop();
            lastPoint = new Point(points[points.length - 2], points[points.length - 1]);
            const midPointX = lastPoint.x + ((firstPoint.x - lastPoint.x) * 0.5);
            const midPointY = lastPoint.y + ((firstPoint.y - lastPoint.y) * 0.5);
            points.unshift(midPointX, midPointY);
            points.push(midPointX, midPointY);
        }
        const verts = webGLData.points;
        const indices = webGLData.indices;
        const length = points.length / 2;
        let indexCount = points.length;
        let indexStart = verts.length / 6;
        const width = graphicsData.lineWidth / 2;
        const color = ShapeUtils.hex2rgb(graphicsData.lineColor);
        const alpha = graphicsData.lineAlpha;
        const r = color[0] * alpha;
        const g = color[1] * alpha;
        const b = color[2] * alpha;
        let p1x = points[0];
        let p1y = points[1];
        let p2x = points[2];
        let p2y = points[3];
        let p3x = 0;
        let p3y = 0;
        let perpx = -(p1y - p2y);
        let perpy = p1x - p2x;
        let perp2x = 0;
        let perp2y = 0;
        let perp3x = 0;
        let perp3y = 0;
        let dist = Math.sqrt((perpx * perpx) + (perpy * perpy));
        perpx /= dist;
        perpy /= dist;
        perpx *= width;
        perpy *= width;
        verts.push(
            p1x - perpx,
            p1y - perpy,
            r, g, b, alpha
        );
        verts.push(
            p1x + perpx,
            p1y + perpy,
            r, g, b, alpha
        );
        for (let i = 1; i < length - 1; ++i)
        {
            p1x = points[(i - 1) * 2];
            p1y = points[((i - 1) * 2) + 1];
            p2x = points[i * 2];
            p2y = points[(i * 2) + 1];
            p3x = points[(i + 1) * 2];
            p3y = points[((i + 1) * 2) + 1];
            perpx = -(p1y - p2y);
            perpy = p1x - p2x;
            dist = Math.sqrt((perpx * perpx) + (perpy * perpy));
            perpx /= dist;
            perpy /= dist;
            perpx *= width;
            perpy *= width;
            perp2x = -(p2y - p3y);
            perp2y = p2x - p3x;
            dist = Math.sqrt((perp2x * perp2x) + (perp2y * perp2y));
            perp2x /= dist;
            perp2y /= dist;
            perp2x *= width;
            perp2y *= width;
            const a1 = (-perpy + p1y) - (-perpy + p2y);
            const b1 = (-perpx + p2x) - (-perpx + p1x);
            const c1 = ((-perpx + p1x) * (-perpy + p2y)) - ((-perpx + p2x) * (-perpy + p1y));
            const a2 = (-perp2y + p3y) - (-perp2y + p2y);
            const b2 = (-perp2x + p2x) - (-perp2x + p3x);
            const c2 = ((-perp2x + p3x) * (-perp2y + p2y)) - ((-perp2x + p2x) * (-perp2y + p3y));
            let denom = (a1 * b2) - (a2 * b1);
            if (Math.abs(denom) < 0.1)
            {
                denom += 10.1;
                verts.push(
                    p2x - perpx,
                    p2y - perpy,
                    r, g, b, alpha
                );
                verts.push(
                    p2x + perpx,
                    p2y + perpy,
                    r, g, b, alpha
                );
                continue;
            }
            const px = ((b1 * c2) - (b2 * c1)) / denom;
            const py = ((a2 * c1) - (a1 * c2)) / denom;
            const pdist = ((px - p2x) * (px - p2x)) + ((py - p2y) * (py - p2y));
            if (pdist > (196 * width * width))
            {
                perp3x = perpx - perp2x;
                perp3y = perpy - perp2y;
                dist = Math.sqrt((perp3x * perp3x) + (perp3y * perp3y));
                perp3x /= dist;
                perp3y /= dist;
                perp3x *= width;
                perp3y *= width;
                verts.push(p2x - perp3x, p2y - perp3y);
                verts.push(r, g, b, alpha);
                verts.push(p2x + perp3x, p2y + perp3y);
                verts.push(r, g, b, alpha);
                verts.push(p2x - perp3x, p2y - perp3y);
                verts.push(r, g, b, alpha);
                indexCount++;
            }
            else
            {
                verts.push(px, py);
                verts.push(r, g, b, alpha);
                verts.push(p2x - (px - p2x), p2y - (py - p2y));
                verts.push(r, g, b, alpha);
            }
        }
        p1x = points[(length - 2) * 2];
        p1y = points[((length - 2) * 2) + 1];
        p2x = points[(length - 1) * 2];
        p2y = points[((length - 1) * 2) + 1];
        perpx = -(p1y - p2y);
        perpy = p1x - p2x;
        dist = Math.sqrt((perpx * perpx) + (perpy * perpy));
        perpx /= dist;
        perpy /= dist;
        perpx *= width;
        perpy *= width;
        verts.push(p2x - perpx, p2y - perpy);
        verts.push(r, g, b, alpha);
        verts.push(p2x + perpx, p2y + perpy);
        verts.push(r, g, b, alpha);
        indices.push(indexStart);
        for (let i = 0; i < indexCount; ++i)
        {
            indices.push(indexStart++);
        }
        indices.push(indexStart - 1);
    }

    public static  buildNativeLine(graphicsData:GraphicsData, webGLData:any):void
    {
        let i = 0;
        const points = graphicsData.points;
        if (points.length === 0) return;
        const verts = webGLData.points;
        const length = points.length / 2;
        const color = ShapeUtils.hex2rgb(graphicsData.lineColor);
        const alpha = graphicsData.lineAlpha;
        const r = color[0] * alpha;
        const g = color[1] * alpha;
        const b = color[2] * alpha;
        for (i = 1; i < length; i++)
        {
            const p1x = points[(i - 1) * 2];
            const p1y = points[((i - 1) * 2) + 1];
            const p2x = points[i * 2];
            const p2y = points[(i * 2) + 1];
            verts.push(p1x, p1y);
            verts.push(r, g, b, alpha);
            verts.push(p2x, p2y);
            verts.push(r, g, b, alpha);
        }
    }

    public static hex2rgb(hex:number, out:number[] = null):number[]
    {
        out = out || [];
        out[0] = (hex >> 16 & 0xFF) / 255;
        out[1] = (hex >> 8 & 0xFF) / 255;
        out[2] = (hex & 0xFF) / 255;
        return out;
    }

    public static bezierCurveTo(fromX:number, fromY:number, cpX:number, cpY:number, cpX2:number, cpY2:number, toX:number, toY:number, path:number[] = []):number[]
    {
        const n = 20;
        let dt = 0;
        let dt2 = 0;
        let dt3 = 0;
        let t2 = 0;
        let t3 = 0;
        path.push(fromX, fromY);
        for (let i = 1, j = 0; i <= n; ++i)
        {
            j = i / n;
            dt = (1 - j);
            dt2 = dt * dt;
            dt3 = dt2 * dt;
            t2 = j * j;
            t3 = t2 * j;
            path.push(
                (dt3 * fromX) + (3 * dt2 * j * cpX) + (3 * dt * t2 * cpX2) + (t3 * toX),
                (dt3 * fromY) + (3 * dt2 * j * cpY) + (3 * dt * t2 * cpY2) + (t3 * toY)
            );
        }
        return path;
    }
}


class Node
{
    public i:any;
    public x:any;
    public y:any;
    public next:any;
    public prev:any;
    public nextZ:any;
    public steiner:any;
    public prevZ:any;
    public z:any;

    constructor(i, x, y) 
    {
        this.i = i;
        this.x = x;
        this.y = y;
        this.prev = null;
        this.next = null;
        this.z = null;
        this.prevZ = null;
        this.nextZ = null;
        this.steiner = false;
    }
}