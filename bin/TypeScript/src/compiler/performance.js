/*@internal*/
var ts;
(function (ts) {
    /** Gets a timestamp with (at least) ms resolution */
    ts.timestamp = typeof performance !== "undefined" && performance.now ? () => performance.now() : Date.now ? Date.now : () => +(new Date());
})(ts || (ts = {}));
/*@internal*/
/** Performance measurements for the compiler. */
(function (ts) {
    var performance;
    (function (performance) {
        // NOTE: cannot use ts.noop as core.ts loads after this
        const profilerEvent = typeof onProfilerEvent === "function" && onProfilerEvent.profiler === true ? onProfilerEvent : () => { };
        let enabled = false;
        let profilerStart = 0;
        let counts;
        let marks;
        let measures;
        /**
         * Marks a performance event.
         *
         * @param markName The name of the mark.
         */
        function mark(markName) {
            if (enabled) {
                marks.set(markName, ts.timestamp());
                counts.set(markName, (counts.get(markName) || 0) + 1);
                profilerEvent(markName);
            }
        }
        performance.mark = mark;
        /**
         * Adds a performance measurement with the specified name.
         *
         * @param measureName The name of the performance measurement.
         * @param startMarkName The name of the starting mark. If not supplied, the point at which the
         *      profiler was enabled is used.
         * @param endMarkName The name of the ending mark. If not supplied, the current timestamp is
         *      used.
         */
        function measure(measureName, startMarkName, endMarkName) {
            if (enabled) {
                const end = endMarkName && marks.get(endMarkName) || ts.timestamp();
                const start = startMarkName && marks.get(startMarkName) || profilerStart;
                measures.set(measureName, (measures.get(measureName) || 0) + (end - start));
            }
        }
        performance.measure = measure;
        /**
         * Gets the number of times a marker was encountered.
         *
         * @param markName The name of the mark.
         */
        function getCount(markName) {
            return counts && counts.get(markName) || 0;
        }
        performance.getCount = getCount;
        /**
         * Gets the total duration of all measurements with the supplied name.
         *
         * @param measureName The name of the measure whose durations should be accumulated.
         */
        function getDuration(measureName) {
            return measures && measures.get(measureName) || 0;
        }
        performance.getDuration = getDuration;
        /**
         * Iterate over each measure, performing some action
         *
         * @param cb The action to perform for each measure
         */
        function forEachMeasure(cb) {
            measures.forEach((measure, key) => {
                cb(key, measure);
            });
        }
        performance.forEachMeasure = forEachMeasure;
        /** Enables (and resets) performance measurements for the compiler. */
        function enable() {
            counts = ts.createMap();
            marks = ts.createMap();
            measures = ts.createMap();
            enabled = true;
            profilerStart = ts.timestamp();
        }
        performance.enable = enable;
        /** Disables performance measurements for the compiler. */
        function disable() {
            enabled = false;
        }
        performance.disable = disable;
    })(performance = ts.performance || (ts.performance = {}));
})(ts || (ts = {}));
