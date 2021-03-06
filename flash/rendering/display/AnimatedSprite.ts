import { Bitmap } from "flash/display/Bitmap";
import { Texture } from "flash/display3D/textures/Texture";
import { Timer } from "flash/utils/Timer";
import { Constants } from "../managers/Constants";
import { Utils } from "../webgl/Utils";


export class AnimatedSprite extends Bitmap
{
    /**
     * @param {PIXI.Texture[]|PIXI.extras.AnimatedSprite~FrameObject[]} textures - an array of {@link PIXI.Texture} or frame
     *  objects that make up the animation
     * @param {boolean} [autoUpdate=true] - Whether to use PIXI.ticker.shared to auto update animation time.
     */
    public _textures:any;
    public _durations:any;
    public _autoUpdate:any;
    public loop:any;
    public onComplete:any;
    public onFrameChange:any;
    public _currentTime:any;
    public onLoop:any;
    public animationSpeed:any;
    public playing:any;

    constructor(textures, autoUpdate = null)
    {
        super(textures[0] instanceof Texture ? textures[0] : textures[0].texture);

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
    public stop()
    {
        if (!this.playing)
        {
            return;
        }

        this.playing = false;
        if (this._autoUpdate)
        {
            Timer.shared.remove(this.update, this);
        }
    }

    /**
     * Plays the AnimatedSprite
     *
     */
    public play()
    {
        if (this.playing)
        {
            return;
        }

        this.playing = true;
        if (this._autoUpdate)
        {
            Timer.shared.add(this.update, this, Constants.UPDATE_PRIORITY.HIGH);
        }
    }

    /**
     * Stops the AnimatedSprite and goes to a specific frame
     *
     * @param {number} frameNumber - frame index to stop at
     */
    public gotoAndStop(frameNumber)
    {
        this.stop();

        const previousFrame = this.currentFrame;

        this._currentTime = frameNumber;

        if (previousFrame !== this.currentFrame)
        {
            this.updateTexture();
        }
    }

    /**
     * Goes to a specific frame and begins playing the AnimatedSprite
     *
     * @param {number} frameNumber - frame index to start at
     */
    public gotoAndPlay(frameNumber)
    {
        const previousFrame = this.currentFrame;

        this._currentTime = frameNumber;

        if (previousFrame !== this.currentFrame)
        {
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
    public update(deltaTime)
    {
        const elapsed = this.animationSpeed * deltaTime;
        const previousFrame = this.currentFrame;

        if (this._durations !== null)
        {
            let lag = this._currentTime % 1 * this._durations[this.currentFrame];

            lag += elapsed / 60 * 1000;

            while (lag < 0)
            {
                this._currentTime--;
                lag += this._durations[this.currentFrame];
            }

            const sign = Utils.sign(this.animationSpeed * deltaTime);

            this._currentTime = Math.floor(this._currentTime);

            while (lag >= this._durations[this.currentFrame])
            {
                lag -= this._durations[this.currentFrame] * sign;
                this._currentTime += sign;
            }

            this._currentTime += lag / this._durations[this.currentFrame];
        }
        else
        {
            this._currentTime += elapsed;
        }

        if (this._currentTime < 0 && !this.loop)
        {
            this.gotoAndStop(0);

            if (this.onComplete)
            {
                this.onComplete();
            }
        }
        else if (this._currentTime >= this._textures.length && !this.loop)
        {
            this.gotoAndStop(this._textures.length - 1);

            if (this.onComplete)
            {
                this.onComplete();
            }
        }
        else if (previousFrame !== this.currentFrame)
        {
            if (this.loop && this.onLoop)
            {
                if (this.animationSpeed > 0 && this.currentFrame < previousFrame)
                {
                    this.onLoop();
                }
                else if (this.animationSpeed < 0 && this.currentFrame > previousFrame)
                {
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
    public updateTexture()
    {
        this._texture = this._textures[this.currentFrame];
        this._textureID = -1;
        this.cachedTint = 0xFFFFFF;

        if (this.onFrameChange)
        {
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
    public destroy()
    {
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
    static fromFrames(frames)
    {
        const textures = [];

        for (let i = 0; i < frames.length; ++i)
        {
            textures.push(Texture.fromFrame(frames[i]));
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
    public static fromImages(images)
    {
        const textures = [];

        for (let i = 0; i < images.length; ++i)
        {
            textures.push(Texture.fromImage(images[i]));
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
    public get totalFrames()
    {
        return this._textures.length;
    }

    /**
     * The array of textures used for this AnimatedSprite
     *
     * @member {PIXI.Texture[]}
     */
    public get textures()
    {
        return this._textures;
    }

    public set textures(value) // eslint-disable-line require-jsdoc
    {
        if (value[0] instanceof Texture)
        {
            this._textures = value;
            this._durations = null;
        }
        else
        {
            this._textures = [];
            this._durations = [];

            for (let i = 0; i < value.length; i++)
            {
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
   public get currentFrame()
    {
        let currentFrame = Math.floor(this._currentTime) % this._textures.length;

        if (currentFrame < 0)
        {
            currentFrame += this._textures.length;
        }

        return currentFrame;
    }
}