import { Resource, MiniSignal } from "./Resource";
import { EventDispatcher } from "flash/events/EventDispatcher";


export class ResourceLoader extends EventDispatcher
{
    public static MAX_PROGRESS = 100;
    public static rgxExtractUrlHash = /(#[\w-]+)?$/;
    /**
     * @param {string} [baseUrl=''] - The base url for all resources loaded by this loader.
     * @param {number} [concurrency=10] - The number of resources to load concurrently.
     */
    public  baseUrl:any;
    public progress:any;
    public _afterMiddleware:any;
    public loading:any;
    public _resourcesParsing:any;
    public _boundLoadResource:any;
    public _beforeMiddleware:any;
    public _queue:any;
    public defaultQueryString:any;
    public onComplete:MiniSignal;
    public onLoad:MiniSignal;
    public onError:MiniSignal;
    public onProgress:MiniSignal;
    public onStart:MiniSignal;
    public resources:any;

    constructor(baseUrl = '', concurrency = 10) 
    {
        super();
        /**
         * The base url for all resources loaded by this loader.
         *
         * @member {string}
         */
        this.baseUrl = baseUrl;

        /**
         * The progress percent of the loader going through the queue.
         *
         * @member {number}
         */
        this.progress = 0;

        /**
         * Loading state of the loader, true if it is currently loading resources.
         *
         * @member {boolean}
         */
        this.loading = false;

        /**
         * A querystring to append to every URL added to the loader.
         *
         * This should be a valid query string *without* the question-mark (`?`). The loader will
         * also *not* escape values for you. Make sure to escape your parameters with
         * [`encodeURIComponent`](https://mdn.io/encodeURIComponent) before assigning this property.
         *
         * @example
         * const loader = new Loader();
         *
         * loader.defaultQueryString = 'user=me&password=secret';
         *
         * // This will request 'image.png?user=me&password=secret'
         * loader.add('image.png').load();
         *
         * loader.reset();
         *
         * // This will request 'image.png?v=1&user=me&password=secret'
         * loader.add('iamge.png?v=1').load();
         */
        this.defaultQueryString = '';

        /**
         * The middleware to run before loading each resource.
         *
         * @member {function[]}
         */
        this._beforeMiddleware = [];

        /**
         * The middleware to run after loading each resource.
         *
         * @member {function[]}
         */
        this._afterMiddleware = [];

        /**
         * The tracks the resources we are currently completing parsing for.
         *
         * @member {Resource[]}
         */
        this._resourcesParsing = [];

        /**
         * The `_loadResource` function bound with this object context.
         *
         * @private
         * @member {function}
         * @param {Resource} r - The resource to load
         * @param {Function} d - The dequeue function
         * @return {undefined}
         */
        this._boundLoadResource = (r, d) => this._loadResource(r, d);

        /**
         * The resources waiting to be loaded.
         *
         * @private
         * @member {Resource[]}
         */
        this._queue = this.queue(this._boundLoadResource, concurrency);

        this._queue.pause();

        /**
         * All the resources for this loader keyed by name.
         *
         * @member {object<string, Resource>}
         */
        this.resources = {};

        /**
         * Dispatched once per loaded or errored resource.
         *
         * The callback looks like {@link Loader.OnProgressSignal}.
         *
         * @member {Signal}
         */
        this.onProgress = new MiniSignal();

        /**
         * Dispatched once per errored resource.
         *
         * The callback looks like {@link Loader.OnErrorSignal}.
         *
         * @member {Signal}
         */
        this.onError = new MiniSignal();

        /**
         * Dispatched once per loaded resource.
         *
         * The callback looks like {@link Loader.OnLoadSignal}.
         *
         * @member {Signal}
         */
        this.onLoad = new MiniSignal();

        /**
         * Dispatched when the loader begins to process the queue.
         *
         * The callback looks like {@link Loader.OnStartSignal}.
         *
         * @member {Signal}
         */
        this.onStart = new MiniSignal();

        /**
         * Dispatched when the queued resources all load.
         *
         * The callback looks like {@link Loader.OnCompleteSignal}.
         *
         * @member {Signal}
         */
        this.onComplete = new MiniSignal();

        /**
         * When the progress changes the loader and resource are disaptched.
         *
         * @memberof Loader
         * @callback OnProgressSignal
         * @param {Loader} loader - The loader the progress is advancing on.
         * @param {Resource} resource - The resource that has completed or failed to cause the progress to advance.
         */

        /**
         * When an error occurrs the loader and resource are disaptched.
         *
         * @memberof Loader
         * @callback OnErrorSignal
         * @param {Loader} loader - The loader the error happened in.
         * @param {Resource} resource - The resource that caused the error.
         */

        /**
         * When a load completes the loader and resource are disaptched.
         *
         * @memberof Loader
         * @callback OnLoadSignal
         * @param {Loader} loader - The loader that laoded the resource.
         * @param {Resource} resource - The resource that has completed loading.
         */

        /**
         * When the loader starts loading resources it dispatches this callback.
         *
         * @memberof Loader
         * @callback OnStartSignal
         * @param {Loader} loader - The loader that has started loading resources.
         */

        /**
         * When the loader completes loading resources it dispatches this callback.
         *
         * @memberof Loader
         * @callback OnCompleteSignal
         * @param {Loader} loader - The loader that has finished loading resources.
         */
    }

    /**
     * Adds a resource (or multiple resources) to the loader queue.
     *
     * This function can take a wide variety of different parameters. The only thing that is always
     * required the url to load. All the following will work:
     *
     * ```js
     * loader
     *     // normal param syntax
     *     .add('key', 'http://...', function () {})
     *     .add('http://...', function () {})
     *     .add('http://...')
     *
     *     // object syntax
     *     .add({
     *         name: 'key2',
     *         url: 'http://...'
     *     }, function () {})
     *     .add({
     *         url: 'http://...'
     *     }, function () {})
     *     .add({
     *         name: 'key3',
     *         url: 'http://...'
     *         onComplete: function () {}
     *     })
     *     .add({
     *         url: 'https://...',
     *         onComplete: function () {},
     *         crossOrigin: true
     *     })
     *
     *     // you can also pass an array of objects or urls or both
     *     .add([
     *         { name: 'key4', url: 'http://...', onComplete: function () {} },
     *         { url: 'http://...', onComplete: function () {} },
     *         'http://...'
     *     ])
     *
     *     // and you can use both params and options
     *     .add('key', 'http://...', { crossOrigin: true }, function () {})
     *     .add('http://...', { crossOrigin: true }, function () {});
     * ```
     *
     * @param {string} [name] - The name of the resource to load, if not passed the url is used.
     * @param {string} [url] - The url for this resource, relative to the baseUrl of this loader.
     * @param {object} [options] - The options for the load.
     * @param {boolean} [options.crossOrigin] - Is this request cross-origin? Default is to determine automatically.
     * @param {Resource.LOAD_TYPE} [options.loadType=Resource.LOAD_TYPE.XHR] - How should this resource be loaded?
     * @param {Resource.XHR_RESPONSE_TYPE} [options.xhrType=Resource.XHR_RESPONSE_TYPE.DEFAULT] - How should
     *      the data being loaded be interpreted when using XHR?
     * @param {object} [options.metadata] - Extra configuration for middleware and the Resource object.
     * @param {HTMLImageElement|HTMLAudioElement|HTMLVideoElement} [options.metadata.loadElement=null] - The
     *      element to use for loading, instead of creating one.
     * @param {boolean} [options.metadata.skipSource=false] - Skips adding source(s) to the load element. This
     *      is useful if you want to pass in a `loadElement` that you already added load sources to.
     * @param {function} [cb] - Function to call when this specific resource completes loading.
     * @return {Loader} Returns itself.
     */
    public add(name, url = null, options = null, cb = null) 
    {
        // special case of an array of objects or urls
        if (Array.isArray(name)) {
            for (let i = 0; i < name.length; ++i) {
                this.add(name[i]);
            }

            return this;
        }

        // if an object is passed instead of params
        if (typeof name === 'object') {
            cb = url || name.callback || name.onComplete;
            options = name;
            url = name.url;
            name = name.name || name.key || name.url;
        }

        // case where no name is passed shift all args over by one.
        if (typeof url !== 'string') {
            cb = options;
            options = url;
            url = name;
        }

        // now that we shifted make sure we have a proper url.
        if (typeof url !== 'string') {
            throw new Error('No url passed to add resource to loader.');
        }

        // options are optional so people might pass a function and no options
        if (typeof options === 'function') {
            cb = options;
            options = null;
        }

        // if loading already you can only add resources that have a parent.
        if (this.loading && (!options || !options.parentResource)) {
            throw new Error('Cannot add resources while the loader is running.');
        }

        // check if resource already exists.
        if (this.resources[name]) {
            throw new Error(`Resource named "${name}" already exists.`);
        }

        // add base url if this isn't an absolute url
        url = this._prepareUrl(url);

        // create the store the resource
        this.resources[name] = new Resource(name, url, options);

        if (typeof cb === 'function') {
            this.resources[name].onAfterMiddleware.once(cb);
        }

        // if actively loading, make sure to adjust progress chunks for that parent and its children
        if (this.loading) {
            const parent = options.parentResource;
            const incompleteChildren = [];

            for (let i = 0; i < parent.children.length; ++i) {
                if (!parent.children[i].isComplete) {
                    incompleteChildren.push(parent.children[i]);
                }
            }

            const fullChunk = parent.progressChunk * (incompleteChildren.length + 1); // +1 for parent
            const eachChunk = fullChunk / (incompleteChildren.length + 2); // +2 for parent & new child

            parent.children.push(this.resources[name]);
            parent.progressChunk = eachChunk;

            for (let i = 0; i < incompleteChildren.length; ++i) {
                incompleteChildren[i].progressChunk = eachChunk;
            }

            this.resources[name].progressChunk = eachChunk;
        }

        // add the resource to the queue
        this._queue.push(this.resources[name]);

        return this;
    }

    public eachSeries(array, iterator, callback, deferNext) {
        let i = 0;
        const len = array.length;
    
        (function next(err) {
            if (err || i === len) {
                if (callback) {
                    callback(err);
                }
    
                return;
            }
    
            if (deferNext) {
                setTimeout(() => {
                    iterator(array[i++], next);
                }, 1);
            }
            else {
                iterator(array[i++], next);
            }
        })();
    }

    /**
     * Sets up a middleware function that will run *before* the
     * resource is loaded.
     *
     * @method before
     * @param {function} fn - The middleware function to register.
     * @return {Loader} Returns itself.
     */
    public pre(fn) {
        this._beforeMiddleware.push(fn);

        return this;
    }

    /**
     * Sets up a middleware function that will run *after* the
     * resource is loaded.
     *
     * @alias use
     * @method after
     * @param {function} fn - The middleware function to register.
     * @return {Loader} Returns itself.
     */
    public use(fn) {
        this._afterMiddleware.push(fn);

        return this;
    }

    /**
     * Resets the queue of the loader to prepare for a new load.
     *
     * @return {Loader} Returns itself.
     */
    public reset() {
        this.progress = 0;
        this.loading = false;

        this._queue.kill();
        this._queue.pause();

        // abort all resource loads
        for (const k in this.resources) {
            const res = this.resources[k];

            if (res._onLoadBinding) {
                res._onLoadBinding.detach();
            }

            if (res.isLoading) {
                res.abort();
            }
        }

        this.resources = {};

        return this;
    }

    /**
     * Starts loading the queued resources.
     *
     * @param {function} [cb] - Optional callback that will be bound to the `complete` event.
     * @return {Loader} Returns itself.
     */
    public load(cb) {
        // register complete callback if they pass one
        if (typeof cb === 'function') {
            this.onComplete.once(cb);
        }

        // if the queue has already started we are done here
        if (this.loading) {
            return this;
        }

        if (this._queue.idle()) {
            this._onStart();
            this._onComplete();
        }
        else {
            // distribute progress chunks
            const numTasks = this._queue._tasks.length;
            const chunk = ResourceLoader.MAX_PROGRESS / numTasks;

            for (let i = 0; i < this._queue._tasks.length; ++i) {
                this._queue._tasks[i].data.progressChunk = chunk;
            }

            // notify we are starting
            this._onStart();

            // start loading
            this._queue.resume();
        }

        return this;
    }

    /**
     * The number of resources to load concurrently.
     *
     * @member {number}
     * @default 10
     */
    public get concurrency() {
        return this._queue.concurrency;
    }
    // eslint-disable-next-line require-jsdoc
    public set concurrency(concurrency) {
        this._queue.concurrency = concurrency;
    }

    public _noop() { /* empty */ }

    public _insert(data, insertAtFront, callback, q) {
        if (callback != null && typeof callback !== 'function') { // eslint-disable-line no-eq-null,eqeqeq
            throw new Error('task callback must be a function');
        }

        q.started = true;

        if (data == null && q.idle()) { // eslint-disable-line no-eq-null,eqeqeq
            // call drain immediately if there are no tasks
            setTimeout(() => q.drain(), 1);

            return;
        }

        const item = {
            data,
            callback: typeof callback === 'function' ? callback : this._noop,
        };

        if (insertAtFront) {
            q._tasks.unshift(item);
        }
        else {
            q._tasks.push(item);
        }

        setTimeout(() => q.process(), 1);
    }
    /**
     * Async queue implementation,
     *
     * @param {function} worker - The worker function to call for each task.
     * @param {number} concurrency - How many workers to run in parrallel.
     * @return {*} The async queue object.
     */
    public queue(worker, concurrency) 
    {
        if (concurrency == null) { // eslint-disable-line no-eq-null,eqeqeq
            concurrency = 1;
        }
        else if (concurrency === 0) {
            throw new Error('Concurrency must not be zero');
        }

        let workers = 0;
        const q = {
            _tasks: [],
            concurrency,
            saturated: this._noop,
            unsaturated: this._noop,
            buffer: concurrency / 4,
            empty: this._noop,
            drain: this._noop,
            error: this._noop,
            started: false,
            paused: false,
            push(data, callback) {
                this._insert(data, false, callback, q);
            },
            kill() {
                workers = 0;
                q.drain = this._noop;
                q.started = false;
                q._tasks = [];
            },
            unshift(data, callback) {
                this._insert(data, true, callback, q);
            },
            process() {
                while (!q.paused && workers < q.concurrency && q._tasks.length) {
                    const task = q._tasks.shift();

                    if (q._tasks.length === 0) {
                        q.empty();
                    }

                    workers += 1;

                    if (workers === q.concurrency) {
                        q.saturated();
                    }

                    worker(task.data, this.onlyOnce(this._next(task, worker, q)));
                }
            },
            length() {
                return q._tasks.length;
            },
            running() {
                return workers;
            },
            idle() {
                return q._tasks.length + workers === 0;
            },
            pause() {
                if (q.paused === true) {
                    return;
                }

                q.paused = true;
            },
            resume() {
                if (q.paused === false) {
                    return;
                }

                q.paused = false;

                // Need to call q.process once per concurrent
                // worker to preserve full concurrency after pause
                for (let w = 1; w <= q.concurrency; w++) {
                    q.process();
                }
            }
        }
    }

    /**
     * Ensures a function is only called once.
     *
     * @param {function} fn - The function to wrap.
     * @return {function} The wrapping function.
     */
    public onlyOnce(fn) {
        return function onceWrapper() {
            if (fn === null) {
                throw new Error('Callback was already called.');
            }

            const callFn = fn;

            fn = null;
            callFn.apply(this, arguments);
        };
    }

    public _next(task, workers, q) {
        return function next() 
        {
            workers -= 1;

            task.callback.apply(task, arguments);

            if (arguments[0] != null) { // eslint-disable-line no-eq-null,eqeqeq
                q.error(arguments[0], task.data);
            }

            if (workers <= (q.concurrency - q.buffer)) {
                q.unsaturated();
            }

            if (q.idle()) {
                q.drain();
            }

            q.process();
        };
    }

    /**
     * Prepares a url for usage based on the configuration of this object
     *
     * @private
     * @param {string} url - The url to prepare.
     * @return {string} The prepared url.
     */
    public _prepareUrl(url) {
        const parsedUrl:any = Resource.parseUri(url, { strictMode: true });
        let result;

        // absolute url, just use it as is.
        if (parsedUrl.protocol || !parsedUrl.path || url.indexOf('//') === 0) {
            result = url;
        }
        // if baseUrl doesn't end in slash and url doesn't start with slash, then add a slash inbetween
        else if (this.baseUrl.length
            && this.baseUrl.lastIndexOf('/') !== this.baseUrl.length - 1
            && url.charAt(0) !== '/'
        ) {
            result = `${this.baseUrl}/${url}`;
        }
        else {
            result = this.baseUrl + url;
        }

        // if we need to add a default querystring, there is a bit more work
        if (this.defaultQueryString) {
            const hash = ResourceLoader.rgxExtractUrlHash.exec(result)[0];

            result = result.substr(0, result.length - hash.length);

            if (result.indexOf('?') !== -1) {
                result += `&${this.defaultQueryString}`;
            }
            else {
                result += `?${this.defaultQueryString}`;
            }

            result += hash;
        }

        return result;
    }

    /**
     * Loads a single resource.
     *
     * @private
     * @param {Resource} resource - The resource to load.
     * @param {function} dequeue - The function to call when we need to dequeue this item.
     */
    public _loadResource(resource, dequeue) {
        resource._dequeue = dequeue;

        // run before middleware
        this.eachSeries(
            this._beforeMiddleware,
            (fn, next) => {
                fn.call(this, resource, () => {
                    // if the before middleware marks the resource as complete,
                    // break and don't process any more before middleware
                    next(resource.isComplete ? {} : null);
                });
            },
            () => {
                if (resource.isComplete) {
                    this._onLoad(resource);
                }
                else {
                    resource._onLoadBinding = resource.onComplete.once(this._onLoad, this);
                    resource.load();
                }
            },
            true
        );
    }

    /**
     * Called once loading has started.
     *
     * @private
     */
    public _onStart() {
        this.progress = 0;
        this.loading = true;
        this.onStart.dispatch();
    }

    /**
     * Called once each resource has loaded.
     *
     * @private
     */
    public _onComplete() {
        this.progress = ResourceLoader.MAX_PROGRESS;
        this.loading = false;
        this.onComplete.dispatch();
    }

    /**
     * Called each time a resources is loaded.
     *
     * @private
     * @param {Resource} resource - The resource that was loaded
     */
    public _onLoad(resource) {
        resource._onLoadBinding = null;

        // remove this resource from the async queue, and add it to our list of resources that are being parsed
        this._resourcesParsing.push(resource);
        resource._dequeue();

        // run all the after middleware for this resource
        this.eachSeries(
            this._afterMiddleware,
            (fn, next) => {
                fn.call(this, resource, next);
            },
            () => {
                resource.onAfterMiddleware.dispatch(resource);

                this.progress = Math.min(ResourceLoader.MAX_PROGRESS, this.progress + resource.progressChunk);
                this.onProgress.dispatch();

                if (resource.error) {
                    this.onError.dispatch();
                }
                else {
                    this.onLoad.dispatch();
                }

                this._resourcesParsing.splice(this._resourcesParsing.indexOf(resource), 1);

                // do completion check
                if (this._queue.idle() && this._resourcesParsing.length === 0) {
                    this._onComplete();
                }
            },
            true
        );
    }
}