define(["require", "exports", "flash/display/Bitmap", "flash/display3D/textures/Texture", "flash/utils/Timer", "../managers/Constants", "../webgl/Utils"], function (require, exports, Bitmap_1, Texture_1, Timer_1, Constants_1, Utils_1) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class AnimatedSprite extends Bitmap_1.Bitmap {
        constructor(textures, autoUpdate = null) {
            super(textures[0] instanceof Texture_1.Texture ? textures[0] : textures[0].texture);
            /**
             * @private
             */
            this._textures = null;
            /**
             * @private
             */
            this._durations = null;
            this.textures = textures;
            /**
             * `true` uses PIXI.ticker.shared to auto update animation time.
             * @type {boolean}
             * @default true
             * @private
             */
            this._autoUpdate = autoUpdate !== false;
            /**
             * The speed that the AnimatedSprite will play at. Higher is faster, lower is slower
             *
             * @member {number}
             * @default 1
             */
            this.animationSpeed = 1;
            /**
             * Whether or not the animate sprite repeats after playing.
             *
             * @member {boolean}
             * @default true
             */
            this.loop = true;
            /**
             * Function to call when a AnimatedSprite finishes playing
             *
             * @member {Function}
             */
            this.onComplete = null;
            /**
             * Function to call when a AnimatedSprite changes which texture is being rendered
             *
             * @member {Function}
             */
            this.onFrameChange = null;
            /**
            * Function to call when 'loop' is true, and an AnimatedSprite is played and loops around to start again
            *
            * @member {Function}
            */
            this.onLoop = null;
            /**
             * Elapsed time since animation has been started, used internally to display current texture
             *
             * @member {number}
             * @private
             */
            this._currentTime = 0;
            /**
             * Indicates if the AnimatedSprite is currently playing
             *
             * @member {boolean}
             * @readonly
             */
            this.playing = false;
        }
        /**
         * Stops the AnimatedSprite
         *
         */
        stop() {
            if (!this.playing) {
                return;
            }
            this.playing = false;
            if (this._autoUpdate) {
                Timer_1.Timer.shared.remove(this.update, this);
            }
        }
        /**
         * Plays the AnimatedSprite
         *
         */
        play() {
            if (this.playing) {
                return;
            }
            this.playing = true;
            if (this._autoUpdate) {
                Timer_1.Timer.shared.add(this.update, this, Constants_1.Constants.UPDATE_PRIORITY.HIGH);
            }
        }
        /**
         * Stops the AnimatedSprite and goes to a specific frame
         *
         * @param {number} frameNumber - frame index to stop at
         */
        gotoAndStop(frameNumber) {
            this.stop();
            const previousFrame = this.currentFrame;
            this._currentTime = frameNumber;
            if (previousFrame !== this.currentFrame) {
                this.updateTexture();
            }
        }
        /**
         * Goes to a specific frame and begins playing the AnimatedSprite
         *
         * @param {number} frameNumber - frame index to start at
         */
        gotoAndPlay(frameNumber) {
            const previousFrame = this.currentFrame;
            this._currentTime = frameNumber;
            if (previousFrame !== this.currentFrame) {
                this.updateTexture();
            }
            this.play();
        }
        /**
         * Updates the object transform for rendering.
         *
         * @private
         * @param {number} deltaTime - Time since last tick.
         */
        update(deltaTime) {
            const elapsed = this.animationSpeed * deltaTime;
            const previousFrame = this.currentFrame;
            if (this._durations !== null) {
                let lag = this._currentTime % 1 * this._durations[this.currentFrame];
                lag += elapsed / 60 * 1000;
                while (lag < 0) {
                    this._currentTime--;
                    lag += this._durations[this.currentFrame];
                }
                const sign = Utils_1.Utils.sign(this.animationSpeed * deltaTime);
                this._currentTime = Math.floor(this._currentTime);
                while (lag >= this._durations[this.currentFrame]) {
                    lag -= this._durations[this.currentFrame] * sign;
                    this._currentTime += sign;
                }
                this._currentTime += lag / this._durations[this.currentFrame];
            }
            else {
                this._currentTime += elapsed;
            }
            if (this._currentTime < 0 && !this.loop) {
                this.gotoAndStop(0);
                if (this.onComplete) {
                    this.onComplete();
                }
            }
            else if (this._currentTime >= this._textures.length && !this.loop) {
                this.gotoAndStop(this._textures.length - 1);
                if (this.onComplete) {
                    this.onComplete();
                }
            }
            else if (previousFrame !== this.currentFrame) {
                if (this.loop && this.onLoop) {
                    if (this.animationSpeed > 0 && this.currentFrame < previousFrame) {
                        this.onLoop();
                    }
                    else if (this.animationSpeed < 0 && this.currentFrame > previousFrame) {
                        this.onLoop();
                    }
                }
                this.updateTexture();
            }
        }
        /**
         * Updates the displayed texture to match the current frame index
         *
         * @private
         */
        updateTexture() {
            this._texture = this._textures[this.currentFrame];
            this._textureID = -1;
            this.cachedTint = 0xFFFFFF;
            if (this.onFrameChange) {
                this.onFrameChange(this.currentFrame);
            }
        }
        /**
         * Stops the AnimatedSprite and destroys it
         *
         * @param {object|boolean} [options] - Options parameter. A boolean will act as if all options
         *  have been set to that value
         * @param {boolean} [options.children=false] - if set to true, all the children will have their destroy
         *      method called as well. 'options' will be passed on to those calls.
         * @param {boolean} [options.texture=false] - Should it destroy the current texture of the sprite as well
         * @param {boolean} [options.baseTexture=false] - Should it destroy the base texture of the sprite as well
         */
        destroy() {
            this.stop();
            super.destroy();
        }
        /**
         * A short hand way of creating a movieclip from an array of frame ids
         *
         * @static
         * @param {string[]} frames - The array of frames ids the movieclip will use as its texture frames
         * @return {AnimatedSprite} The new animated sprite with the specified frames.
         */
        static fromFrames(frames) {
            const textures = [];
            for (let i = 0; i < frames.length; ++i) {
                textures.push(Texture_1.Texture.fromFrame(frames[i]));
            }
            return new AnimatedSprite(textures);
        }
        /**
         * A short hand way of creating a movieclip from an array of image ids
         *
         * @static
         * @param {string[]} images - the array of image urls the movieclip will use as its texture frames
         * @return {AnimatedSprite} The new animate sprite with the specified images as frames.
         */
        static fromImages(images) {
            const textures = [];
            for (let i = 0; i < images.length; ++i) {
                textures.push(Texture_1.Texture.fromImage(images[i]));
            }
            return new AnimatedSprite(textures);
        }
        /**
         * totalFrames is the total number of frames in the AnimatedSprite. This is the same as number of textures
         * assigned to the AnimatedSprite.
         *
         * @readonly
         * @member {number}
         * @default 0
         */
        get totalFrames() {
            return this._textures.length;
        }
        /**
         * The array of textures used for this AnimatedSprite
         *
         * @member {PIXI.Texture[]}
         */
        get textures() {
            return this._textures;
        }
        set textures(value) {
            if (value[0] instanceof Texture_1.Texture) {
                this._textures = value;
                this._durations = null;
            }
            else {
                this._textures = [];
                this._durations = [];
                for (let i = 0; i < value.length; i++) {
                    this._textures.push(value[i].texture);
                    this._durations.push(value[i].time);
                }
            }
            this.gotoAndStop(0);
            this.updateTexture();
        }
        /**
        * The AnimatedSprites current frame index
        *
        * @member {number}
        * @readonly
        */
        get currentFrame() {
            let currentFrame = Math.floor(this._currentTime) % this._textures.length;
            if (currentFrame < 0) {
                currentFrame += this._textures.length;
            }
            return currentFrame;
        }
    }
    exports.AnimatedSprite = AnimatedSprite;
});
//# sourceMappingURL=AnimatedSprite.js.map