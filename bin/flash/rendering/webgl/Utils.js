define(["require", "exports", "flash/rendering/managers/Constants", "flash/display3D/GLShader", "../../geom/Matrix", "../filters/Shaders", "../../display3D/types/DataTypes"], function (require, exports, Constants_1, GLShader_1, Matrix_1, Shaders_1, DataTypes_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Utils {
        static getPointData(value) {
            var data = [];
            for (var i = 0; i < value.length; i++) {
                data.push(value[i].x);
                data.push(value[i].y);
            }
            return data;
        }
        /**
         * Calculates the mapped matrix
         * @param filterArea {Rectangle} The filter area
         * @param sprite {Sprite} the target sprite
         * @param outputMatrix {Matrix} @alvin
         * @private
         */
        // TODO playing around here.. this is temporary - (will end up in the shader)
        // this returns a matrix that will normalise map filter cords in the filter to screen space
        static calculateScreenSpaceMatrix(outputMatrix, filterArea, textureSize) {
            // let worldTransform = sprite.worldTransform.copy(Matrix.TEMP_MATRIX),
            // let texture = {width:1136, height:700};//sprite._texture.baseTexture;
            // TODO unwrap?
            const mappedMatrix = outputMatrix.identity();
            mappedMatrix.translate(filterArea.x / textureSize.width, filterArea.y / textureSize.height);
            mappedMatrix.scale(textureSize.width, textureSize.height);
            return mappedMatrix;
        }
        static calculateNormalizedScreenSpaceMatrix(outputMatrix, filterArea, textureSize, frame = null) {
            const mappedMatrix = outputMatrix.identity();
            mappedMatrix.translate(filterArea.x / textureSize.width, filterArea.y / textureSize.height);
            const translateScaleX = (textureSize.width / filterArea.width);
            const translateScaleY = (textureSize.height / filterArea.height);
            mappedMatrix.scale(translateScaleX, translateScaleY);
            return mappedMatrix;
        }
        // this will map the filter coord so that a texture can be used based on the transform of a sprite
        static calculateSpriteMatrix(outputMatrix, filterArea, textureSize, sprite) {
            const orig = sprite._texture.orig;
            const mappedMatrix = outputMatrix.set(textureSize.width, 0, 0, textureSize.height, filterArea.x, filterArea.y);
            const worldTransform = sprite.worldTransform.copy(Matrix_1.Matrix.TEMP_MATRIX);
            worldTransform.invert();
            mappedMatrix.prepend(worldTransform);
            mappedMatrix.scale(1.0 / orig.width, 1.0 / orig.height);
            mappedMatrix.translate(sprite.anchor.x, sprite.anchor.y);
            return mappedMatrix;
        }
        static generateSampleSrc(maxTextures) {
            var src = '';
            src += '\n';
            src += '\n';
            for (var i = 0; i < maxTextures; i++) {
                if (i > 0) {
                    src += '\nelse ';
                }
                if (i < maxTextures - 1) {
                    src += 'if(textureId == ' + i + '.0)';
                }
                src += '\n{';
                src += '\n\tcolor = texture2D(uSamplers[' + i.toString() + '], vTextureCoord);';
                src += '\n}';
            }
            src += '\n';
            src += '\n';
            return src;
        }
        static generateMultiTextureShader(gl, maxTextures) {
            var fragmentSrc = Shaders_1.Shaders.FRAGMENT_MULTITEXTURE;
            console.log('text : ' + maxTextures);
            fragmentSrc = fragmentSrc.replace(/%count%/gi, maxTextures.toString());
            fragmentSrc = fragmentSrc.replace(/%forloop%/gi, Utils.generateSampleSrc(maxTextures));
            var shader = new GLShader_1.GLShader(gl, Shaders_1.Shaders.VERTEX_MULTITEXTURE, fragmentSrc);
            var sampleValues = [];
            for (var i = 0; i < maxTextures; i++) {
                sampleValues[i] = i;
            }
            shader.bind();
            shader.uniforms.uSamplers = sampleValues;
            return shader;
        }
        static generateIfTestSrc(maxIfs) {
            var src = '';
            for (var i = 0; i < maxIfs; ++i) {
                if (i > 0) {
                    src += '\nelse ';
                }
                if (i < maxIfs - 1) {
                    src += 'if(test == ' + i + '.0){}';
                }
            }
            return src;
        }
        static checkMaxIfStatmentsInShader(maxIfs, gl) {
            var createTempContext = !gl;
            if (maxIfs === 0) {
                throw new Error('Invalid value of `0` passed to `checkMaxIfStatementsInShader`');
            }
            if (createTempContext) {
                var tinyCanvas = document.createElement('canvas');
                tinyCanvas.width = 1;
                tinyCanvas.height = 1;
                gl = Utils.createContext(tinyCanvas);
            }
            var shader = gl.createShader(gl.FRAGMENT_SHADER);
            while (true) // eslint-disable-line no-constant-condition
             {
                var fragmentSrc = Utils.fragTemplate.replace(/%forloop%/gi, Utils.generateIfTestSrc(maxIfs));
                gl.shaderSource(shader, fragmentSrc);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    maxIfs = maxIfs / 2 | 0;
                }
                else {
                    // valid!
                    break;
                }
            }
            if (createTempContext) {
                // get rid of context
                if (gl.getExtension('WEBGL_lose_context')) {
                    gl.getExtension('WEBGL_lose_context').loseContext();
                }
            }
            return maxIfs;
        }
        static log2(v) {
            var r, shift, compute;
            compute = v > 0xFFFF;
            r = compute << 4;
            v >>>= r;
            compute = v > 0xFF;
            shift = compute << 3;
            v >>>= shift;
            r |= shift;
            compute = v > 0xF;
            shift = compute << 2;
            v >>>= shift;
            r |= shift;
            compute = v > 0x3;
            shift = compute << 1;
            v >>>= shift;
            r |= shift;
            return r | (v >> 1);
        }
        static nextPow2(v) {
            (v += v) === 0;
            --v;
            v |= v >>> 1;
            v |= v >>> 2;
            v |= v >>> 4;
            v |= v >>> 8;
            v |= v >>> 16;
            return v + 1;
        }
        static premultiplyTint(tint, alpha) {
            if (alpha === 1.0) {
                return (alpha * 255 << 24) + tint;
            }
            if (alpha === 0.0) {
                return 0;
            }
            var R = tint >> 16 & 0xFF;
            var G = tint >> 8 & 0xFF;
            var B = tint & 0xFF;
            R = R * alpha + 0.5 | 0;
            G = G * alpha + 0.5 | 0;
            B = B * alpha + 0.5 | 0;
            return (alpha * 255 << 24) + (R << 16) + (G << 8) + B;
        }
        static splitPath(filename) {
            return Utils.splitPathRe.exec(filename).slice(1);
        }
        ;
        static dirname(path) {
            var result = Utils.splitPath(path), root = result[0], dir = result[1];
            if (!root && !dir) {
                // No dirname whatsoever
                return '.';
            }
            if (dir) {
                // It has a dirname, strip trailing slash
                dir = dir.substr(0, dir.length - 1);
            }
            return root + dir;
        }
        ;
        static merge_options(obj1, obj2) {
            var obj3 = {};
            for (var attrname in obj1) {
                obj3[attrname] = obj1[attrname];
            }
            for (var attrname in obj2) {
                obj3[attrname] = obj2[attrname];
            }
            return obj3;
        }
        static sign(x) {
            x = Number(x);
            if (x === 0 || isNaN(x)) {
                return x;
            }
            return x > 0 ? 1 : -1;
        }
        ;
        static trimCanvas(canvas) {
            var width = canvas.width;
            var height = canvas.height;
            var context = canvas.getContext('2d');
            var imageData = context.getImageData(0, 0, width, height);
            var pixels = imageData.data;
            var len = pixels.length;
            var bound = {
                top: null,
                left: null,
                right: null,
                bottom: null
            };
            var i = void 0;
            var x = void 0;
            var y = void 0;
            for (i = 0; i < len; i += 4) {
                if (pixels[i + 3] !== 0) {
                    x = i / 4 % width;
                    y = ~~(i / 4 / width);
                    if (bound.top === null) {
                        bound.top = y;
                    }
                    if (bound.left === null) {
                        bound.left = x;
                    }
                    else if (x < bound.left) {
                        bound.left = x;
                    }
                    if (bound.right === null) {
                        bound.right = x + 1;
                    }
                    else if (bound.right < x) {
                        bound.right = x + 1;
                    }
                    if (bound.bottom === null) {
                        bound.bottom = y;
                    }
                    else if (bound.bottom < y) {
                        bound.bottom = y;
                    }
                }
            }
            width = bound.right - bound.left;
            height = bound.bottom - bound.top + 1;
            var data = context.getImageData(bound.left, bound.top, width, height);
            return {
                height: height,
                width: width,
                data: data
            };
        }
        /**
         * converts integer tint and float alpha to vec4 form, premultiplies by default
         *
         * @memberof PIXI.utils
         * @param {number} tint input tint
         * @param {number} alpha alpha param
         * @param {Float32Array} [out] output
         * @param {boolean} [premultiply=true] do premultiply it
         * @returns {Float32Array} vec4 rgba
         */
        static premultiplyTintToRgba(tint, alpha, out, premultiply) {
            out = out || new Float32Array(4);
            out[0] = (tint >> 16 & 0xFF) / 255.0;
            out[1] = (tint >> 8 & 0xFF) / 255.0;
            out[2] = (tint & 0xFF) / 255.0;
            if (premultiply || premultiply === undefined) {
                out[0] *= alpha;
                out[1] *= alpha;
                out[2] *= alpha;
            }
            out[3] = alpha;
            return out;
        }
        /**
         * combines rgb and alpha to out array
         *
         * @memberof PIXI.utils
         * @param {Float32Array|number[]} rgb input rgb
         * @param {number} alpha alpha param
         * @param {Float32Array} [out] output
         * @param {boolean} [premultiply=true] do premultiply it
         * @returns {Float32Array} vec4 rgba
         */
        static premultiplyRgba(rgb, alpha, out, premultiply) {
            out = out || new Float32Array(4);
            if (premultiply || premultiply === undefined) {
                out[0] = rgb[0] * alpha;
                out[1] = rgb[1] * alpha;
                out[2] = rgb[2] * alpha;
            }
            else {
                out[0] = rgb[0];
                out[1] = rgb[1];
                out[2] = rgb[2];
            }
            out[3] = alpha;
            return out;
        }
        static validateMasking(gl) {
            var attributes = gl.getContextAttributes();
            return attributes.stencil;
        }
        /**
         * changes blendMode according to texture format
         *
         * @memberof PIXI.utils
         * @function correctBlendMode
         * @param {number} blendMode supposed blend mode
         * @param {boolean} premultiplied  whether source is premultiplied
         * @returns {number} true blend mode for this texture
         */
        static correctBlendMode(blendMode, premultiplied) {
            var array = Utils.mapPremultipliedBlendModes();
            return array[premultiplied ? 1 : 0][blendMode];
        }
        /**
         * Converts a color as an [R, G, B] array to a hex number
         *
         * @memberof PIXI.utils
         * @function rgb2hex
         * @param {number[]} rgb - rgb array
         * @return {number} The color number
         */
        static rgb2hex(rgb) {
            return (rgb[0] * 255 << 16) + (rgb[1] * 255 << 8) + (rgb[2] * 255 | 0);
        }
        /**
         * Get type of the image by regexp for extension. Returns undefined for unknown extensions.
         *
         * @memberof PIXI.utils
         * @function getUrlFileExtension
         * @param {string} url - the image path
         * @return {string|undefined} image extension
         */
        static getUrlFileExtension(url) {
            var extension = Constants_1.Constants.URL_FILE_EXTENSION.exec(url);
            if (extension) {
                return extension[1].toLowerCase();
            }
            return undefined;
        }
        static decomposeDataUri(url) {
            var dataUriMatch = Constants_1.Constants.DATA_URI.exec(url);
            if (dataUriMatch) {
                var datauri = new DataTypes_1.DecomposedDataUri();
                datauri.mediaType = dataUriMatch[1] ? dataUriMatch[1].toLowerCase() : undefined,
                    datauri.subType = dataUriMatch[2] ? dataUriMatch[2].toLowerCase() : undefined,
                    datauri.encoding = dataUriMatch[3] ? dataUriMatch[3].toLowerCase() : undefined,
                    datauri.data = dataUriMatch[4];
                return datauri;
            }
            return undefined;
        }
        static getSvgSize(svgString) {
            var sizeMatch = Constants_1.Constants.SVG_SIZE.exec(svgString);
            var size = new DataTypes_1.SvgSize();
            if (sizeMatch) {
                size.width = Math.round(parseFloat(sizeMatch[3]));
                size.height = Math.round(parseFloat(sizeMatch[7]));
            }
            return size;
        }
        /**
         * get the resolution / device pixel ratio of an asset by looking for the prefix
         * used by spritesheets and image urls
         *
         * @memberof PIXI.utils
         * @function getResolutionOfUrl
         * @param {string} url - the image path
         * @param {number} [defaultValue=1] - the defaultValue if no filename prefix is set.
         * @return {number} resolution / device pixel ratio of an asset
         */
        static getResolutionOfUrl(url, defaultValue = null) {
            var reg = /@([0-9\.]+)x/;
            var resolution = reg.exec(url);
            if (resolution) {
                return parseFloat(resolution[1]);
            }
            return defaultValue !== undefined ? defaultValue : 1;
        }
        static isPow2(value) {
            return !(value & (value - 1)) && (!!value);
        }
        /**
         * Sets the `crossOrigin` property for this resource based on if the url
         * for this resource is cross-origin. If crossOrigin was manually set, this
         * function does nothing.
         * Nipped from the resource loader!
         *
         * @ignore
         * @param {string} url - The url to test.
         * @param {object} [loc=window.location] - The location object to test against.
         * @return {string} The crossOrigin value to use (or empty string for none).
         */
        static determineCrossOrigin(url, loc = window.location) {
            if (url.indexOf('data:') === 0) {
                return '';
            }
            loc = loc || window.location;
            if (!Utils.tempAnchor) {
                Utils.tempAnchor = document.createElement('a');
            }
            Utils.tempAnchor.href = url;
            var originCheck = Utils.tempAnchor.hostname == loc.hostname && Utils.tempAnchor.port == loc.port && Utils.tempAnchor.protocol == loc.protocol;
            if (!originCheck) {
                return 'anonymous';
            }
            return '';
        }
        /**
         * Helper class to create a webGL Context
         *
         * @class
         * @memberof PIXI.glCore
         * @param canvas {HTMLCanvasElement} the canvas element that we will get the context from
         * @param options {Object} An options object that gets passed in to the canvas element containing the context attributes,
         *                         see https://developer.mozilla.org/en/docs/Web/API/HTMLCanvasElement/getContext for the options available
         * @return {WebGLRenderingContext} the WebGL context
         */
        static createContext(canvas, options = null) {
            var gl = canvas.getContext('webgl', options) || canvas.getContext('experimental-webgl', options);
            if (!gl) {
                throw new Error('This browser does not support webGL. Try using the canvas renderer');
            }
            return gl;
        }
        ;
        static uid() {
            return ++Utils.nextUid;
        }
        static extractUniformsFromSrc(vertexSrc, fragmentSrc, mask) {
            var vertUniforms = Utils.extractUniformsFromString(vertexSrc);
            var fragUniforms = Utils.extractUniformsFromString(fragmentSrc);
            return { vertUniforms, fragUniforms };
        }
        static extractUniformsFromString(string) {
            var maskRegex = new RegExp('^(projectionMatrix|uSampler|filterArea|filterClamp)$');
            var uniforms = {};
            var nameSplit = void 0;
            // clean the lines a little - remove extra spaces / tabs etc
            // then split along ';'
            var lines = string.replace(/\s+/g, ' ').split(/\s*;\s*/);
            // loop through..
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line.indexOf('uniform') > -1) {
                    var splitLine = line.split(' ');
                    var type = splitLine[1];
                    var name = splitLine[2];
                    var size = 1;
                    if (name.indexOf('[') > -1) {
                        // array!
                        nameSplit = name.split(/\[|]/);
                        name = nameSplit[0];
                        size *= Number(nameSplit[1]);
                    }
                    if (!name.match(maskRegex)) {
                        uniforms[name] = {
                            value: Utils.defaultValue(type, size),
                            name: name,
                            type: type
                        };
                    }
                }
            }
            return uniforms;
        }
        static defaultValue(type, size) {
            switch (type) {
                case 'float':
                    return 0;
                case 'vec2':
                    return new Float32Array(2 * size);
                case 'vec3':
                    return new Float32Array(3 * size);
                case 'vec4':
                    return new Float32Array(4 * size);
                case 'int':
                case 'sampler2D':
                    return 0;
                case 'ivec2':
                    return new Int32Array(2 * size);
                case 'ivec3':
                    return new Int32Array(3 * size);
                case 'ivec4':
                    return new Int32Array(4 * size);
                case 'bool':
                    return false;
                case 'bvec2':
                    return Utils.booleanArray(2 * size);
                case 'bvec3':
                    return Utils.booleanArray(3 * size);
                case 'bvec4':
                    return Utils.booleanArray(4 * size);
                case 'mat2':
                    return new Float32Array([1, 0,
                        0, 1]);
                case 'mat3':
                    return new Float32Array([1, 0, 0,
                        0, 1, 0,
                        0, 0, 1]);
                case 'mat4':
                    return new Float32Array([1, 0, 0, 0,
                        0, 1, 0, 0,
                        0, 0, 1, 0,
                        0, 0, 0, 1]);
            }
        }
        ;
        static booleanArray(size) {
            var array = new Array(size);
            for (var i = 0; i < array.length; i++) {
                array[i] = false;
            }
            return array;
        }
        ;
        static hex2rgb(hex, out = null) {
            out = out || [];
            out[0] = (hex >> 16 & 0xFF) / 255;
            out[1] = (hex >> 8 & 0xFF) / 255;
            out[2] = (hex & 0xFF) / 255;
            return out;
        }
        static removeItems(arr, startIdx, removeCount) {
            var length = arr.length;
            if (startIdx >= length || removeCount === 0) {
                return;
            }
            removeCount = (startIdx + removeCount > length ? length - startIdx : removeCount);
            for (var i = startIdx, len = length - removeCount; i < len; ++i) {
                arr[i] = arr[i + removeCount];
            }
            arr.length = len;
        }
        static mapWebGLDrawModesToPixi(gl) {
            var object = {};
            object[Constants_1.Constants.DRAW_MODES.POINTS] = gl.POINTS;
            object[Constants_1.Constants.DRAW_MODES.LINES] = gl.LINES;
            object[Constants_1.Constants.DRAW_MODES.LINE_LOOP] = gl.LINE_LOOP;
            object[Constants_1.Constants.DRAW_MODES.LINE_STRIP] = gl.LINE_STRIP;
            object[Constants_1.Constants.DRAW_MODES.TRIANGLES] = gl.TRIANGLES;
            object[Constants_1.Constants.DRAW_MODES.TRIANGLE_STRIP] = gl.TRIANGLE_STRIP;
            object[Constants_1.Constants.DRAW_MODES.TRIANGLE_FAN] = gl.TRIANGLE_FAN;
            return object;
        }
        /**
         * Maps gl blend combinations to WebGL.
         *
         * @memberof PIXI
         * @function mapWebGLBlendModesToPixi
         * @private
         * @param {WebGLRenderingContext} gl - The rendering context.
         * @param {string[]} [array=[]] - The array to output into.
         * @return {string[]} Mapped modes.
         */
        static mapWebGLBlendModesToPixi(gl, array = []) {
            array[Constants_1.Constants.BLEND_MODES.NORMAL] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.ADD] = [gl.ONE, gl.DST_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.MULTIPLY] = [gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.SCREEN] = [gl.ONE, gl.ONE_MINUS_SRC_COLOR];
            array[Constants_1.Constants.BLEND_MODES.OVERLAY] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.DARKEN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.LIGHTEN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.COLOR_DODGE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.COLOR_BURN] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.HARD_LIGHT] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.SOFT_LIGHT] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.DIFFERENCE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.EXCLUSION] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.HUE] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.SATURATION] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.COLOR] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.LUMINOSITY] = [gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.NORMAL_NPM] = [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.ADD_NPM] = [gl.SRC_ALPHA, gl.DST_ALPHA, gl.ONE, gl.DST_ALPHA];
            array[Constants_1.Constants.BLEND_MODES.SCREEN_NPM] = [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_COLOR, gl.ONE, gl.ONE_MINUS_SRC_COLOR];
            return array;
        }
        static mapPremultipliedBlendModes() {
            const pm = [];
            const npm = [];
            for (let i = 0; i < 32; i++) {
                pm[i] = i;
                npm[i] = i;
            }
            pm[Constants_1.Constants.BLEND_MODES.NORMAL_NPM] = Constants_1.Constants.BLEND_MODES.NORMAL;
            pm[Constants_1.Constants.BLEND_MODES.ADD_NPM] = Constants_1.Constants.BLEND_MODES.ADD;
            pm[Constants_1.Constants.BLEND_MODES.SCREEN_NPM] = Constants_1.Constants.BLEND_MODES.SCREEN;
            npm[Constants_1.Constants.BLEND_MODES.NORMAL] = Constants_1.Constants.BLEND_MODES.NORMAL_NPM;
            npm[Constants_1.Constants.BLEND_MODES.ADD] = Constants_1.Constants.BLEND_MODES.ADD_NPM;
            npm[Constants_1.Constants.BLEND_MODES.SCREEN] = Constants_1.Constants.BLEND_MODES.SCREEN_NPM;
            const array = [];
            array.push(npm);
            array.push(pm);
            return array;
        }
        static getMaxKernelSize(gl) {
            const maxVaryings = (gl.getParameter(gl.MAX_VARYING_VECTORS));
            let kernelSize = 15;
            while (kernelSize > maxVaryings) {
                kernelSize -= 2;
            }
            return kernelSize;
        }
        /**
         * Creates a little colored canvas
         *
         * @ignore
         * @param {string} color - The color to make the canvas
         * @return {canvas} a small canvas element
         */
        static createColoredCanvas(color) {
            const canvas = document.createElement('canvas');
            canvas.width = 6;
            canvas.height = 1;
            const context = canvas.getContext('2d');
            context.fillStyle = color;
            context.fillRect(0, 0, 6, 1);
            return canvas;
        }
        /**
         * Maps blend combinations to Canvas.
         *
         * @memberof PIXI
         * @function mapCanvasBlendModesToPixi
         * @private
         * @param {string[]} [array=[]] - The array to output into.
         * @return {string[]} Mapped modes.
         */
        static mapCanvasBlendModesToPixi(array = []) {
            if (Utils.canUseNewCanvasBlendModes()) {
                array[Constants_1.Constants.BLEND_MODES.NORMAL] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.ADD] = 'lighter'; // IS THIS OK???
                array[Constants_1.Constants.BLEND_MODES.MULTIPLY] = 'multiply';
                array[Constants_1.Constants.BLEND_MODES.SCREEN] = 'screen';
                array[Constants_1.Constants.BLEND_MODES.OVERLAY] = 'overlay';
                array[Constants_1.Constants.BLEND_MODES.DARKEN] = 'darken';
                array[Constants_1.Constants.BLEND_MODES.LIGHTEN] = 'lighten';
                array[Constants_1.Constants.BLEND_MODES.COLOR_DODGE] = 'color-dodge';
                array[Constants_1.Constants.BLEND_MODES.COLOR_BURN] = 'color-burn';
                array[Constants_1.Constants.BLEND_MODES.HARD_LIGHT] = 'hard-light';
                array[Constants_1.Constants.BLEND_MODES.SOFT_LIGHT] = 'soft-light';
                array[Constants_1.Constants.BLEND_MODES.DIFFERENCE] = 'difference';
                array[Constants_1.Constants.BLEND_MODES.EXCLUSION] = 'exclusion';
                array[Constants_1.Constants.BLEND_MODES.HUE] = 'hue';
                array[Constants_1.Constants.BLEND_MODES.SATURATION] = 'saturate';
                array[Constants_1.Constants.BLEND_MODES.COLOR] = 'color';
                array[Constants_1.Constants.BLEND_MODES.LUMINOSITY] = 'luminosity';
            }
            else {
                // this means that the browser does not support the cool new blend modes in canvas 'cough' ie 'cough'
                array[Constants_1.Constants.BLEND_MODES.NORMAL] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.ADD] = 'lighter'; // IS THIS OK???
                array[Constants_1.Constants.BLEND_MODES.MULTIPLY] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.SCREEN] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.OVERLAY] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.DARKEN] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.LIGHTEN] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.COLOR_DODGE] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.COLOR_BURN] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.HARD_LIGHT] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.SOFT_LIGHT] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.DIFFERENCE] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.EXCLUSION] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.HUE] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.SATURATION] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.COLOR] = 'source-over';
                array[Constants_1.Constants.BLEND_MODES.LUMINOSITY] = 'source-over';
            }
            // not-premultiplied, only for webgl
            array[Constants_1.Constants.BLEND_MODES.NORMAL_NPM] = array[Constants_1.Constants.BLEND_MODES.NORMAL];
            array[Constants_1.Constants.BLEND_MODES.ADD_NPM] = array[Constants_1.Constants.BLEND_MODES.ADD];
            array[Constants_1.Constants.BLEND_MODES.SCREEN_NPM] = array[Constants_1.Constants.BLEND_MODES.SCREEN];
            return array;
        }
        /**
         * Checks whether the Canvas BlendModes are supported by the current browser
         *
         * @return {boolean} whether they are supported
         */
        static canUseNewCanvasBlendModes() {
            if (typeof document === 'undefined') {
                return false;
            }
            const magenta = Utils.createColoredCanvas('#ff00ff');
            const yellow = Utils.createColoredCanvas('#ffff00');
            const canvas = document.createElement('canvas');
            canvas.width = 6;
            canvas.height = 1;
            const context = canvas.getContext('2d');
            context.globalCompositeOperation = 'multiply';
            context.drawImage(magenta, 0, 0);
            context.drawImage(yellow, 2, 0);
            const imageData = context.getImageData(2, 0, 1, 1);
            if (!imageData) {
                return false;
            }
            const data = imageData.data;
            return (data[0] === 255 && data[1] === 0 && data[2] === 0);
        }
        static hex2string(value) {
            var hex = value.toString(16);
            hex = '000000'.substr(0, 6 - hex.length) + hex;
            return '#' + hex;
        }
        static maxRecommendedTextures(max) {
            /*if (Utils.Device.tablet || Utils.Device.phone)
            {
                return 4;
            }*/
            return max;
        }
        static canUploadSameBuffer() {
            // Uploading the same buffer multiple times in a single frame can cause perf issues.
            // Apparent on IOS so only check for that at the moment
            // this check may become more complex if this issue pops up elsewhere.
            const ios = !!navigator.platform && (/iPad|iPhone|iPod/).test(navigator.platform);
            return !ios;
        }
    }
    Utils.nextUid = 0;
    Utils.splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
    Utils.fragTemplate = ['precision mediump float;', 'void main(void){', 'float test = 0.1;', '%forloop%', 'gl_FragColor = vec4(0.0);', '}'].join('\n');
    exports.Utils = Utils;
});
//# sourceMappingURL=Utils.js.map