import { DisplayObjectContainer } from "flash/display/DisplayObjectContainer";
import { Point } from "../../geom/Point";
import { Polygon } from "flash/rendering/core/shapes/Polygon";
import { Texture } from "../textures/Texture";
import { Constants } from "../managers/Constants";
import { TextureMatrix } from "../math/TextureMatrix";
import { Utils } from "../webgl/Utils";
import { StageSettings } from "flash/display/StageSettings";

export class Mesh extends DisplayObjectContainer
{
    /**
     * Different drawing buffer modes supported
     *
     * @static
     * @constant
     * @type {object}
     * @property {number} TRIANGLE_MESH
     * @property {number} TRIANGLES
     */
    public static DRAW_MODES = {
        TRIANGLE_MESH: 0,
        TRIANGLES: 1,
    };
    public static tempPoint = new Point();
    public static tempPolygon = new Polygon();
    
    /**
     * @param {PIXI.Texture} texture - The texture to use
     * @param {Float32Array} [vertices] - if you want to specify the vertices
     * @param {Float32Array} [uvs] - if you want to specify the uvs
     * @param {Uint16Array} [indices] - if you want to specify the indices
     * @param {number} [drawMode] - the drawMode, can be any of the Mesh.DRAW_MODES consts
     */
    public _texture:any;
    public uvs:any;
    public _uvTransform:any;
    public indices:any;
    public pluginName:any;
    public _glDatas:any;
    public uploadUvTransform:any;
    public blendMode:any;
    public vertices:any;
    public indexDirty:any;
    public dirty:any;
    public canvasPadding:any;
    public drawMode:any;
    public tintRgb:any;
    public shader:any;

    constructor(texture, vertices = null, uvs = null, indices = null, drawMode = null)
    {
        super();

        /**
         * The texture of the Mesh
         *
         * @member {PIXI.Texture}
         * @default PIXI.Texture.EMPTY
         * @private
         */
        this._texture = texture || Texture.EMPTY;

        /**
         * The Uvs of the Mesh
         *
         * @member {Float32Array}
         */
        this.uvs = uvs || new Float32Array([
            0, 0,
            1, 0,
            1, 1,
            0, 1]);

        /**
         * An array of vertices
         *
         * @member {Float32Array}
         */
        this.vertices = vertices || new Float32Array([
            0, 0,
            100, 0,
            100, 100,
            0, 100]);

        /**
         * An array containing the indices of the vertices
         *
         * @member {Uint16Array}
         */
        //  TODO auto generate this based on draw mode!
        this.indices = indices || new Uint16Array([0, 1, 3, 2]);

        /**
         * Version of mesh uvs are dirty or not
         *
         * @member {number}
         */
        this.dirty = 0;

        /**
         * Version of mesh indices
         *
         * @member {number}
         */
        this.indexDirty = 0;

        /**
         * The blend mode to be applied to the sprite. Set to `PIXI.BLEND_MODES.NORMAL` to remove
         * any blend mode.
         *
         * @member {number}
         * @default PIXI.BLEND_MODES.NORMAL
         * @see PIXI.BLEND_MODES
         */
        this.blendMode = Constants.BLEND_MODES.NORMAL;

        /**
         * Triangles in canvas mode are automatically antialiased, use this value to force triangles
         * to overlap a bit with each other.
         *
         * @member {number}
         */
        this.canvasPadding = StageSettings.MESH_CANVAS_PADDING;

        /**
         * The way the Mesh should be drawn, can be any of the {@link PIXI.mesh.Mesh.DRAW_MODES} consts
         *
         * @member {number}
         * @see PIXI.mesh.Mesh.DRAW_MODES
         */
        this.drawMode = drawMode || Mesh.DRAW_MODES.TRIANGLE_MESH;

        /**
         * The default shader that is used if a mesh doesn't have a more specific one.
         *
         * @member {PIXI.Shader}
         */
        this.shader = null;

        /**
         * The tint applied to the mesh. This is a [r,g,b] value. A value of [1,1,1] will remove any
         * tint effect.
         *
         * @member {number}
         */
        this.tintRgb = new Float32Array([1, 1, 1]);

        /**
         * A map of renderer IDs to webgl render data
         *
         * @private
         * @member {object<number, object>}
         */
        this._glDatas = {};

        /**
         * transform that is applied to UV to get the texture coords
         * its updated independently from texture uvTransform
         * updates of uvs are tied to that thing
         *
         * @member {PIXI.TextureMatrix}
         * @private
         */
        this._uvTransform = new TextureMatrix(this._texture);

        /**
         * whether or not upload uvTransform to shader
         * if its false, then uvs should be pre-multiplied
         * if you change it for generated mesh, please call 'refresh(true)'
         * @member {boolean}
         * @default false
         */
        this.uploadUvTransform = false;

        /**
         * Plugin that is responsible for rendering this element.
         * Allows to customize the rendering process without overriding '_renderWebGL' & '_renderCanvas' methods.
         * @member {string}
         * @default 'mesh'
         */
        this.pluginName = 'mesh';
    }

    /**
     * Renders the object using the WebGL renderer
     *
     * @private
     * @param {PIXI.WebGLRenderer} renderer - a reference to the WebGL renderer
     */
    public _renderWebGL()
    {
        if(!this.stage)
        {
            return;
        }
        this.refresh();
        //this.stage.setObjectRenderer(renderer.plugins[this.pluginName]);
        //this.stage.plugins[this.pluginName].render(this);
    }

    /**
     * Renders the object using the Canvas renderer
     *
     * @private
     * @param {PIXI.CanvasRenderer} renderer - The canvas renderer.
     */
    public _renderCanvas(renderer)
    {
        this.refresh();
        renderer.plugins[this.pluginName].render(this);
    }

    /**
     * When the texture is updated, this event will fire to update the scale and frame
     *
     * @private
     */
    public _onTextureUpdate()
    {
        this._uvTransform.texture = this._texture;
        this.refresh();
    }

    /**
     * multiplies uvs only if uploadUvTransform is false
     * call it after you change uvs manually
     * make sure that texture is valid
     */
    public multiplyUvs()
    {
        if (!this.uploadUvTransform)
        {
            this._uvTransform.multiplyUvs(this.uvs);
        }
    }

    /**
     * Refreshes uvs for generated meshes (rope, plane)
     * sometimes refreshes vertices too
     *
     * @param {boolean} [forceUpdate=false] if true, matrices will be updated any case
     */
    public refresh(forceUpdate = null)
    {
        if (this._uvTransform.update(forceUpdate))
        {
            this._refresh();
        }
    }

    /**
     * re-calculates mesh coords
     * @protected
     */
    public _refresh()
    {
        /* empty */
    }

    /**
     * Returns the bounds of the mesh as a rectangle. The bounds calculation takes the worldTransform into account.
     *
     */
    public _calculateBounds()
    {
        // TODO - we can cache local bounds and use them if they are dirty (like graphics)
        this._bounds.addVertices(this.transform, this.vertices, 0, this.vertices.length);
    }

    /**
     * Tests if a point is inside this mesh. Works only for TRIANGLE_MESH
     *
     * @param {PIXI.Point} point - the point to test
     * @return {boolean} the result of the test
     */
    public containsPoint(point)
    {
        if (!this.getBounds().contains(point.x, point.y))
        {
            return false;
        }

        this.worldTransform.applyInverse(point, Mesh.tempPoint);

        const vertices = this.vertices;
        const points = Mesh.tempPolygon.points;
        const indices = this.indices;
        const len = this.indices.length;
        const step = this.drawMode === Mesh.DRAW_MODES.TRIANGLES ? 3 : 1;

        for (let i = 0; i + 2 < len; i += step)
        {
            const ind0 = indices[i] * 2;
            const ind1 = indices[i + 1] * 2;
            const ind2 = indices[i + 2] * 2;

            points[0] = vertices[ind0];
            points[1] = vertices[ind0 + 1];
            points[2] = vertices[ind1];
            points[3] = vertices[ind1 + 1];
            points[4] = vertices[ind2];
            points[5] = vertices[ind2 + 1];

            if (Mesh.tempPolygon.contains(Mesh.tempPoint.x, Mesh.tempPoint.y))
            {
                return true;
            }
        }

        return false;
    }

    /**
     * The texture that the mesh uses.
     *
     * @member {PIXI.Texture}
     */
    public get texture()
    {
        return this._texture;
    }

    public set texture(value) // eslint-disable-line require-jsdoc
    {
        if (this._texture === value)
        {
            return;
        }

        this._texture = value;

        if (value)
        {
            // wait for the texture to load
            if (value.baseTexture.hasLoaded)
            {
                this._onTextureUpdate();
            }
            else
            {
                value.once('update', this._onTextureUpdate, this);
            }
        }
    }

    /**
     * The tint applied to the mesh. This is a hex value. A value of 0xFFFFFF will remove any tint effect.
     *
     * @member {number}
     * @default 0xFFFFFF
     */
    public get tint()
    {
        return Utils.rgb2hex(this.tintRgb);
    }

    public set tint(value) // eslint-disable-line require-jsdoc
    {
        this.tintRgb = Utils.hex2rgb(value, this.tintRgb);
    }
}