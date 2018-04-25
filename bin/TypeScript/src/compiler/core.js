var ts;
(function (ts) {
    // WARNING: The script `configureNightly.ts` uses a regexp to parse out these values.
    // If changing the text in this section, be sure to test `configureNightly` too.
    ts.versionMajorMinor = "2.9";
    /** The version of the TypeScript compiler release */
    ts.version = `${ts.versionMajorMinor}.0-dev`;
})(ts || (ts = {}));
(function (ts) {
    function isExternalModuleNameRelative(moduleName) {
        // TypeScript 1.0 spec (April 2014): 11.2.1
        // An external module name is "relative" if the first term is "." or "..".
        // Update: We also consider a path like `C:\foo.ts` "relative" because we do not search for it in `node_modules` or treat it as an ambient module.
        return ts.pathIsRelative(moduleName) || ts.isRootedDiskPath(moduleName);
    }
    ts.isExternalModuleNameRelative = isExternalModuleNameRelative;
    function sortAndDeduplicateDiagnostics(diagnostics) {
        return ts.sortAndDeduplicate(diagnostics, ts.compareDiagnostics);
    }
    ts.sortAndDeduplicateDiagnostics = sortAndDeduplicateDiagnostics;
})(ts || (ts = {}));
/* @internal */
(function (ts) {
    ts.emptyArray = [];
    function closeFileWatcher(watcher) {
        watcher.close();
    }
    ts.closeFileWatcher = closeFileWatcher;
    /** Create a MapLike with good performance. */
    function createDictionaryObject() {
        const map = Object.create(/*prototype*/ null); // tslint:disable-line:no-null-keyword
        // Using 'delete' on an object causes V8 to put the object in dictionary mode.
        // This disables creation of hidden classes, which are expensive when an object is
        // constantly changing shape.
        map.__ = undefined;
        delete map.__;
        return map;
    }
    /** Create a new map. If a template object is provided, the map will copy entries from it. */
    function createMap() {
        return new MapCtr();
    }
    ts.createMap = createMap;
    /** Create a new escaped identifier map. */
    function createUnderscoreEscapedMap() {
        return new MapCtr();
    }
    ts.createUnderscoreEscapedMap = createUnderscoreEscapedMap;
    function createSymbolTable(symbols) {
        const result = createMap();
        if (symbols) {
            for (const symbol of symbols) {
                result.set(symbol.escapedName, symbol);
            }
        }
        return result;
    }
    ts.createSymbolTable = createSymbolTable;
    function createMapFromTemplate(template) {
        const map = new MapCtr();
        // Copies keys/values from template. Note that for..in will not throw if
        // template is undefined, and instead will just exit the loop.
        for (const key in template) {
            if (hasOwnProperty.call(template, key)) {
                map.set(key, template[key]);
            }
        }
        return map;
    }
    ts.createMapFromTemplate = createMapFromTemplate;
    // Internet Explorer's Map doesn't support iteration, so don't use it.
    // tslint:disable-next-line no-in-operator variable-name
    const MapCtr = typeof Map !== "undefined" && "entries" in Map.prototype ? Map : shimMap();
    // Keep the class inside a function so it doesn't get compiled if it's not used.
    function shimMap() {
        class MapIterator {
            constructor(data, selector) {
                this.index = 0;
                this.data = data;
                this.selector = selector;
                this.keys = Object.keys(data);
            }
            next() {
                const index = this.index;
                if (index < this.keys.length) {
                    this.index++;
                    return { value: this.selector(this.data, this.keys[index]), done: false };
                }
                return { value: undefined, done: true };
            }
        }
        return class {
            constructor() {
                this.data = createDictionaryObject();
                this.size = 0;
            }
            get(key) {
                return this.data[key];
            }
            set(key, value) {
                if (!this.has(key)) {
                    this.size++;
                }
                this.data[key] = value;
                return this;
            }
            has(key) {
                // tslint:disable-next-line:no-in-operator
                return key in this.data;
            }
            delete(key) {
                if (this.has(key)) {
                    this.size--;
                    delete this.data[key];
                    return true;
                }
                return false;
            }
            clear() {
                this.data = createDictionaryObject();
                this.size = 0;
            }
            keys() {
                return new MapIterator(this.data, (_data, key) => key);
            }
            values() {
                return new MapIterator(this.data, (data, key) => data[key]);
            }
            entries() {
                return new MapIterator(this.data, (data, key) => [key, data[key]]);
            }
            forEach(action) {
                for (const key in this.data) {
                    action(this.data[key], key);
                }
            }
        };
    }
    function toPath(fileName, basePath, getCanonicalFileName) {
        const nonCanonicalizedPath = isRootedDiskPath(fileName)
            ? normalizePath(fileName)
            : getNormalizedAbsolutePath(fileName, basePath);
        return getCanonicalFileName(nonCanonicalizedPath);
    }
    ts.toPath = toPath;
    function length(array) {
        return array ? array.length : 0;
    }
    ts.length = length;
    /**
     * Iterates through 'array' by index and performs the callback on each element of array until the callback
     * returns a truthy value, then returns that value.
     * If no such value is found, the callback is applied to each element of array and undefined is returned.
     */
    function forEach(array, callback) {
        if (array) {
            for (let i = 0; i < array.length; i++) {
                const result = callback(array[i], i);
                if (result) {
                    return result;
                }
            }
        }
        return undefined;
    }
    ts.forEach = forEach;
    /** Like `forEach`, but suitable for use with numbers and strings (which may be falsy). */
    function firstDefined(array, callback) {
        if (array === undefined) {
            return undefined;
        }
        for (let i = 0; i < array.length; i++) {
            const result = callback(array[i], i);
            if (result !== undefined) {
                return result;
            }
        }
        return undefined;
    }
    ts.firstDefined = firstDefined;
    function firstDefinedIterator(iter, callback) {
        while (true) {
            const { value, done } = iter.next();
            if (done) {
                return undefined;
            }
            const result = callback(value);
            if (result !== undefined) {
                return result;
            }
        }
    }
    ts.firstDefinedIterator = firstDefinedIterator;
    function findAncestor(node, callback) {
        while (node) {
            const result = callback(node);
            if (result === "quit") {
                return undefined;
            }
            else if (result) {
                return node;
            }
            node = node.parent;
        }
        return undefined;
    }
    ts.findAncestor = findAncestor;
    function zipWith(arrayA, arrayB, callback) {
        const result = [];
        Debug.assertEqual(arrayA.length, arrayB.length);
        for (let i = 0; i < arrayA.length; i++) {
            result.push(callback(arrayA[i], arrayB[i], i));
        }
        return result;
    }
    ts.zipWith = zipWith;
    function zipToIterator(arrayA, arrayB) {
        Debug.assertEqual(arrayA.length, arrayB.length);
        let i = 0;
        return {
            next() {
                if (i === arrayA.length) {
                    return { value: undefined, done: true };
                }
                i++;
                return { value: [arrayA[i - 1], arrayB[i - 1]], done: false };
            }
        };
    }
    ts.zipToIterator = zipToIterator;
    function zipToMap(keys, values) {
        Debug.assert(keys.length === values.length);
        const map = createMap();
        for (let i = 0; i < keys.length; ++i) {
            map.set(keys[i], values[i]);
        }
        return map;
    }
    ts.zipToMap = zipToMap;
    /**
     * Iterates through `array` by index and performs the callback on each element of array until the callback
     * returns a falsey value, then returns false.
     * If no such value is found, the callback is applied to each element of array and `true` is returned.
     */
    function every(array, callback) {
        if (array) {
            for (let i = 0; i < array.length; i++) {
                if (!callback(array[i], i)) {
                    return false;
                }
            }
        }
        return true;
    }
    ts.every = every;
    function find(array, predicate) {
        for (let i = 0; i < array.length; i++) {
            const value = array[i];
            if (predicate(value, i)) {
                return value;
            }
        }
        return undefined;
    }
    ts.find = find;
    function findLast(array, predicate) {
        for (let i = array.length - 1; i >= 0; i--) {
            const value = array[i];
            if (predicate(value, i)) {
                return value;
            }
        }
        return undefined;
    }
    ts.findLast = findLast;
    /** Works like Array.prototype.findIndex, returning `-1` if no element satisfying the predicate is found. */
    function findIndex(array, predicate) {
        for (let i = 0; i < array.length; i++) {
            if (predicate(array[i], i)) {
                return i;
            }
        }
        return -1;
    }
    ts.findIndex = findIndex;
    /**
     * Returns the first truthy result of `callback`, or else fails.
     * This is like `forEach`, but never returns undefined.
     */
    function findMap(array, callback) {
        for (let i = 0; i < array.length; i++) {
            const result = callback(array[i], i);
            if (result) {
                return result;
            }
        }
        Debug.fail();
    }
    ts.findMap = findMap;
    function contains(array, value, equalityComparer = equateValues) {
        if (array) {
            for (const v of array) {
                if (equalityComparer(v, value)) {
                    return true;
                }
            }
        }
        return false;
    }
    ts.contains = contains;
    function arraysEqual(a, b, equalityComparer = equateValues) {
        return a.length === b.length && a.every((x, i) => equalityComparer(x, b[i]));
    }
    ts.arraysEqual = arraysEqual;
    function indexOfAnyCharCode(text, charCodes, start) {
        for (let i = start || 0; i < text.length; i++) {
            if (contains(charCodes, text.charCodeAt(i))) {
                return i;
            }
        }
        return -1;
    }
    ts.indexOfAnyCharCode = indexOfAnyCharCode;
    function countWhere(array, predicate) {
        let count = 0;
        if (array) {
            for (let i = 0; i < array.length; i++) {
                const v = array[i];
                if (predicate(v, i)) {
                    count++;
                }
            }
        }
        return count;
    }
    ts.countWhere = countWhere;
    function filter(array, f) {
        if (array) {
            const len = array.length;
            let i = 0;
            while (i < len && f(array[i]))
                i++;
            if (i < len) {
                const result = array.slice(0, i);
                i++;
                while (i < len) {
                    const item = array[i];
                    if (f(item)) {
                        result.push(item);
                    }
                    i++;
                }
                return result;
            }
        }
        return array;
    }
    ts.filter = filter;
    function filterMutate(array, f) {
        let outIndex = 0;
        for (let i = 0; i < array.length; i++) {
            if (f(array[i], i, array)) {
                array[outIndex] = array[i];
                outIndex++;
            }
        }
        array.length = outIndex;
    }
    ts.filterMutate = filterMutate;
    function clear(array) {
        array.length = 0;
    }
    ts.clear = clear;
    function map(array, f) {
        let result;
        if (array) {
            result = [];
            for (let i = 0; i < array.length; i++) {
                result.push(f(array[i], i));
            }
        }
        return result;
    }
    ts.map = map;
    function mapIterator(iter, mapFn) {
        return {
            next() {
                const iterRes = iter.next();
                return iterRes.done ? iterRes : { value: mapFn(iterRes.value), done: false };
            }
        };
    }
    ts.mapIterator = mapIterator;
    function sameMap(array, f) {
        if (array) {
            for (let i = 0; i < array.length; i++) {
                const item = array[i];
                const mapped = f(item, i);
                if (item !== mapped) {
                    const result = array.slice(0, i);
                    result.push(mapped);
                    for (i++; i < array.length; i++) {
                        result.push(f(array[i], i));
                    }
                    return result;
                }
            }
        }
        return array;
    }
    ts.sameMap = sameMap;
    /**
     * Flattens an array containing a mix of array or non-array elements.
     *
     * @param array The array to flatten.
     */
    function flatten(array) {
        let result;
        if (array) {
            result = [];
            for (const v of array) {
                if (v) {
                    if (isArray(v)) {
                        addRange(result, v);
                    }
                    else {
                        result.push(v);
                    }
                }
            }
        }
        return result;
    }
    ts.flatten = flatten;
    /**
     * Maps an array. If the mapped value is an array, it is spread into the result.
     *
     * @param array The array to map.
     * @param mapfn The callback used to map the result into one or more values.
     */
    function flatMap(array, mapfn) {
        let result;
        if (array) {
            result = [];
            for (let i = 0; i < array.length; i++) {
                const v = mapfn(array[i], i);
                if (v) {
                    if (isArray(v)) {
                        addRange(result, v);
                    }
                    else {
                        result.push(v);
                    }
                }
            }
        }
        return result;
    }
    ts.flatMap = flatMap;
    function flatMapIterator(iter, mapfn) {
        const first = iter.next();
        if (first.done) {
            return ts.emptyIterator;
        }
        let currentIter = getIterator(first.value);
        return {
            next() {
                while (true) {
                    const currentRes = currentIter.next();
                    if (!currentRes.done) {
                        return currentRes;
                    }
                    const iterRes = iter.next();
                    if (iterRes.done) {
                        return iterRes;
                    }
                    currentIter = getIterator(iterRes.value);
                }
            },
        };
        function getIterator(x) {
            const res = mapfn(x);
            return res === undefined ? ts.emptyIterator : isArray(res) ? arrayIterator(res) : res;
        }
    }
    ts.flatMapIterator = flatMapIterator;
    function sameFlatMap(array, mapfn) {
        let result;
        if (array) {
            for (let i = 0; i < array.length; i++) {
                const item = array[i];
                const mapped = mapfn(item, i);
                if (result || item !== mapped || isArray(mapped)) {
                    if (!result) {
                        result = array.slice(0, i);
                    }
                    if (isArray(mapped)) {
                        addRange(result, mapped);
                    }
                    else {
                        result.push(mapped);
                    }
                }
            }
        }
        return result || array;
    }
    ts.sameFlatMap = sameFlatMap;
    function mapAllOrFail(array, mapFn) {
        const result = [];
        for (let i = 0; i < array.length; i++) {
            const mapped = mapFn(array[i], i);
            if (mapped === undefined) {
                return undefined;
            }
            result.push(mapped);
        }
        return result;
    }
    ts.mapAllOrFail = mapAllOrFail;
    function mapDefined(array, mapFn) {
        const result = [];
        if (array) {
            for (let i = 0; i < array.length; i++) {
                const mapped = mapFn(array[i], i);
                if (mapped !== undefined) {
                    result.push(mapped);
                }
            }
        }
        return result;
    }
    ts.mapDefined = mapDefined;
    function mapDefinedIterator(iter, mapFn) {
        return {
            next() {
                while (true) {
                    const res = iter.next();
                    if (res.done) {
                        return res;
                    }
                    const value = mapFn(res.value);
                    if (value !== undefined) {
                        return { value, done: false };
                    }
                }
            }
        };
    }
    ts.mapDefinedIterator = mapDefinedIterator;
    ts.emptyIterator = { next: () => ({ value: undefined, done: true }) };
    function singleIterator(value) {
        let done = false;
        return {
            next() {
                const wasDone = done;
                done = true;
                return wasDone ? { value: undefined, done: true } : { value, done: false };
            }
        };
    }
    ts.singleIterator = singleIterator;
    /**
     * Maps contiguous spans of values with the same key.
     *
     * @param array The array to map.
     * @param keyfn A callback used to select the key for an element.
     * @param mapfn A callback used to map a contiguous chunk of values to a single value.
     */
    function spanMap(array, keyfn, mapfn) {
        let result;
        if (array) {
            result = [];
            const len = array.length;
            let previousKey;
            let key;
            let start = 0;
            let pos = 0;
            while (start < len) {
                while (pos < len) {
                    const value = array[pos];
                    key = keyfn(value, pos);
                    if (pos === 0) {
                        previousKey = key;
                    }
                    else if (key !== previousKey) {
                        break;
                    }
                    pos++;
                }
                if (start < pos) {
                    const v = mapfn(array.slice(start, pos), previousKey, start, pos);
                    if (v) {
                        result.push(v);
                    }
                    start = pos;
                }
                previousKey = key;
                pos++;
            }
        }
        return result;
    }
    ts.spanMap = spanMap;
    function mapEntries(map, f) {
        if (!map) {
            return undefined;
        }
        const result = createMap();
        map.forEach((value, key) => {
            const [newKey, newValue] = f(key, value);
            result.set(newKey, newValue);
        });
        return result;
    }
    ts.mapEntries = mapEntries;
    function some(array, predicate) {
        if (array) {
            if (predicate) {
                for (const v of array) {
                    if (predicate(v)) {
                        return true;
                    }
                }
            }
            else {
                return array.length > 0;
            }
        }
        return false;
    }
    ts.some = some;
    function concatenate(array1, array2) {
        if (!some(array2))
            return array1;
        if (!some(array1))
            return array2;
        return [...array1, ...array2];
    }
    ts.concatenate = concatenate;
    function deduplicateRelational(array, equalityComparer, comparer) {
        // Perform a stable sort of the array. This ensures the first entry in a list of
        // duplicates remains the first entry in the result.
        const indices = array.map((_, i) => i);
        stableSortIndices(array, indices, comparer);
        let last = array[indices[0]];
        const deduplicated = [indices[0]];
        for (let i = 1; i < indices.length; i++) {
            const index = indices[i];
            const item = array[index];
            if (!equalityComparer(last, item)) {
                deduplicated.push(index);
                last = item;
            }
        }
        // restore original order
        deduplicated.sort();
        return deduplicated.map(i => array[i]);
    }
    function deduplicateEquality(array, equalityComparer) {
        const result = [];
        for (const item of array) {
            pushIfUnique(result, item, equalityComparer);
        }
        return result;
    }
    /**
     * Deduplicates an unsorted array.
     * @param equalityComparer An optional `EqualityComparer` used to determine if two values are duplicates.
     * @param comparer An optional `Comparer` used to sort entries before comparison, though the
     * result will remain in the original order in `array`.
     */
    function deduplicate(array, equalityComparer, comparer) {
        return !array ? undefined :
            array.length === 0 ? [] :
                array.length === 1 ? array.slice() :
                    comparer ? deduplicateRelational(array, equalityComparer, comparer) :
                        deduplicateEquality(array, equalityComparer);
    }
    ts.deduplicate = deduplicate;
    /**
     * Deduplicates an array that has already been sorted.
     */
    function deduplicateSorted(array, comparer) {
        if (!array)
            return undefined;
        if (array.length === 0)
            return [];
        let last = array[0];
        const deduplicated = [last];
        for (let i = 1; i < array.length; i++) {
            const next = array[i];
            switch (comparer(next, last)) {
                // equality comparison
                case true:
                // relational comparison
                case 0 /* EqualTo */:
                    continue;
                case -1 /* LessThan */:
                    // If `array` is sorted, `next` should **never** be less than `last`.
                    return Debug.fail("Array is unsorted.");
            }
            deduplicated.push(last = next);
        }
        return deduplicated;
    }
    function insertSorted(array, insert, compare) {
        if (array.length === 0) {
            array.push(insert);
            return;
        }
        const insertIndex = binarySearch(array, insert, identity, compare);
        if (insertIndex < 0) {
            array.splice(~insertIndex, 0, insert);
        }
    }
    ts.insertSorted = insertSorted;
    function sortAndDeduplicate(array, comparer, equalityComparer) {
        return deduplicateSorted(sort(array, comparer), equalityComparer || comparer);
    }
    ts.sortAndDeduplicate = sortAndDeduplicate;
    function arrayIsEqualTo(array1, array2, equalityComparer = equateValues) {
        if (!array1 || !array2) {
            return array1 === array2;
        }
        if (array1.length !== array2.length) {
            return false;
        }
        for (let i = 0; i < array1.length; i++) {
            if (!equalityComparer(array1[i], array2[i])) {
                return false;
            }
        }
        return true;
    }
    ts.arrayIsEqualTo = arrayIsEqualTo;
    function changesAffectModuleResolution(oldOptions, newOptions) {
        return !oldOptions ||
            (oldOptions.module !== newOptions.module) ||
            (oldOptions.moduleResolution !== newOptions.moduleResolution) ||
            (oldOptions.noResolve !== newOptions.noResolve) ||
            (oldOptions.target !== newOptions.target) ||
            (oldOptions.noLib !== newOptions.noLib) ||
            (oldOptions.jsx !== newOptions.jsx) ||
            (oldOptions.allowJs !== newOptions.allowJs) ||
            (oldOptions.rootDir !== newOptions.rootDir) ||
            (oldOptions.configFilePath !== newOptions.configFilePath) ||
            (oldOptions.baseUrl !== newOptions.baseUrl) ||
            (oldOptions.maxNodeModuleJsDepth !== newOptions.maxNodeModuleJsDepth) ||
            !arrayIsEqualTo(oldOptions.lib, newOptions.lib) ||
            !arrayIsEqualTo(oldOptions.typeRoots, newOptions.typeRoots) ||
            !arrayIsEqualTo(oldOptions.rootDirs, newOptions.rootDirs) ||
            !equalOwnProperties(oldOptions.paths, newOptions.paths);
    }
    ts.changesAffectModuleResolution = changesAffectModuleResolution;
    function compact(array) {
        let result;
        if (array) {
            for (let i = 0; i < array.length; i++) {
                const v = array[i];
                if (result || !v) {
                    if (!result) {
                        result = array.slice(0, i);
                    }
                    if (v) {
                        result.push(v);
                    }
                }
            }
        }
        return result || array;
    }
    ts.compact = compact;
    /**
     * Gets the relative complement of `arrayA` with respect to `arrayB`, returning the elements that
     * are not present in `arrayA` but are present in `arrayB`. Assumes both arrays are sorted
     * based on the provided comparer.
     */
    function relativeComplement(arrayA, arrayB, comparer) {
        if (!arrayB || !arrayA || arrayB.length === 0 || arrayA.length === 0)
            return arrayB;
        const result = [];
        loopB: for (let offsetA = 0, offsetB = 0; offsetB < arrayB.length; offsetB++) {
            if (offsetB > 0) {
                // Ensure `arrayB` is properly sorted.
                Debug.assertGreaterThanOrEqual(comparer(arrayB[offsetB], arrayB[offsetB - 1]), 0 /* EqualTo */);
            }
            loopA: for (const startA = offsetA; offsetA < arrayA.length; offsetA++) {
                if (offsetA > startA) {
                    // Ensure `arrayA` is properly sorted. We only need to perform this check if
                    // `offsetA` has changed since we entered the loop.
                    Debug.assertGreaterThanOrEqual(comparer(arrayA[offsetA], arrayA[offsetA - 1]), 0 /* EqualTo */);
                }
                switch (comparer(arrayB[offsetB], arrayA[offsetA])) {
                    case -1 /* LessThan */:
                        // If B is less than A, B does not exist in arrayA. Add B to the result and
                        // move to the next element in arrayB without changing the current position
                        // in arrayA.
                        result.push(arrayB[offsetB]);
                        continue loopB;
                    case 0 /* EqualTo */:
                        // If B is equal to A, B exists in arrayA. Move to the next element in
                        // arrayB without adding B to the result or changing the current position
                        // in arrayA.
                        continue loopB;
                    case 1 /* GreaterThan */:
                        // If B is greater than A, we need to keep looking for B in arrayA. Move to
                        // the next element in arrayA and recheck.
                        continue loopA;
                }
            }
        }
        return result;
    }
    ts.relativeComplement = relativeComplement;
    function sum(array, prop) {
        let result = 0;
        for (const v of array) {
            result += v[prop];
        }
        return result;
    }
    ts.sum = sum;
    /**
     * Appends a value to an array, returning the array.
     *
     * @param to The array to which `value` is to be appended. If `to` is `undefined`, a new array
     * is created if `value` was appended.
     * @param value The value to append to the array. If `value` is `undefined`, nothing is
     * appended.
     */
    function append(to, value) {
        if (value === undefined)
            return to;
        if (to === undefined)
            return [value];
        to.push(value);
        return to;
    }
    ts.append = append;
    /**
     * Gets the actual offset into an array for a relative offset. Negative offsets indicate a
     * position offset from the end of the array.
     */
    function toOffset(array, offset) {
        return offset < 0 ? array.length + offset : offset;
    }
    /**
     * Appends a range of value to an array, returning the array.
     *
     * @param to The array to which `value` is to be appended. If `to` is `undefined`, a new array
     * is created if `value` was appended.
     * @param from The values to append to the array. If `from` is `undefined`, nothing is
     * appended. If an element of `from` is `undefined`, that element is not appended.
     * @param start The offset in `from` at which to start copying values.
     * @param end The offset in `from` at which to stop copying values (non-inclusive).
     */
    function addRange(to, from, start, end) {
        if (from === undefined || from.length === 0)
            return to;
        if (to === undefined)
            return from.slice(start, end);
        start = start === undefined ? 0 : toOffset(from, start);
        end = end === undefined ? from.length : toOffset(from, end);
        for (let i = start; i < end && i < from.length; i++) {
            if (from[i] !== undefined) {
                to.push(from[i]);
            }
        }
        return to;
    }
    ts.addRange = addRange;
    /**
     * @return Whether the value was added.
     */
    function pushIfUnique(array, toAdd, equalityComparer) {
        if (contains(array, toAdd, equalityComparer)) {
            return false;
        }
        else {
            array.push(toAdd);
            return true;
        }
    }
    ts.pushIfUnique = pushIfUnique;
    /**
     * Unlike `pushIfUnique`, this can take `undefined` as an input, and returns a new array.
     */
    function appendIfUnique(array, toAdd, equalityComparer) {
        if (array) {
            pushIfUnique(array, toAdd, equalityComparer);
            return array;
        }
        else {
            return [toAdd];
        }
    }
    ts.appendIfUnique = appendIfUnique;
    function stableSortIndices(array, indices, comparer) {
        // sort indices by value then position
        indices.sort((x, y) => comparer(array[x], array[y]) || compareValues(x, y));
    }
    /**
     * Returns a new sorted array.
     */
    function sort(array, comparer) {
        return array.slice().sort(comparer);
    }
    ts.sort = sort;
    function best(iter, isBetter) {
        const x = iter.next();
        if (x.done) {
            return undefined;
        }
        let best = x.value;
        while (true) {
            const { value, done } = iter.next();
            if (done) {
                return best;
            }
            if (isBetter(value, best)) {
                best = value;
            }
        }
    }
    ts.best = best;
    function arrayIterator(array) {
        let i = 0;
        return { next: () => {
                if (i === array.length) {
                    return { value: undefined, done: true };
                }
                else {
                    i++;
                    return { value: array[i - 1], done: false };
                }
            } };
    }
    ts.arrayIterator = arrayIterator;
    /**
     * Stable sort of an array. Elements equal to each other maintain their relative position in the array.
     */
    function stableSort(array, comparer) {
        const indices = array.map((_, i) => i);
        stableSortIndices(array, indices, comparer);
        return indices.map(i => array[i]);
    }
    ts.stableSort = stableSort;
    function rangeEquals(array1, array2, pos, end) {
        while (pos < end) {
            if (array1[pos] !== array2[pos]) {
                return false;
            }
            pos++;
        }
        return true;
    }
    ts.rangeEquals = rangeEquals;
    /**
     * Returns the element at a specific offset in an array if non-empty, `undefined` otherwise.
     * A negative offset indicates the element should be retrieved from the end of the array.
     */
    function elementAt(array, offset) {
        if (array) {
            offset = toOffset(array, offset);
            if (offset < array.length) {
                return array[offset];
            }
        }
        return undefined;
    }
    ts.elementAt = elementAt;
    /**
     * Returns the first element of an array if non-empty, `undefined` otherwise.
     */
    function firstOrUndefined(array) {
        return array.length === 0 ? undefined : array[0];
    }
    ts.firstOrUndefined = firstOrUndefined;
    function first(array) {
        Debug.assert(array.length !== 0);
        return array[0];
    }
    ts.first = first;
    /**
     * Returns the last element of an array if non-empty, `undefined` otherwise.
     */
    function lastOrUndefined(array) {
        return array.length === 0 ? undefined : array[array.length - 1];
    }
    ts.lastOrUndefined = lastOrUndefined;
    function last(array) {
        Debug.assert(array.length !== 0);
        return array[array.length - 1];
    }
    ts.last = last;
    /**
     * Returns the only element of an array if it contains only one element, `undefined` otherwise.
     */
    function singleOrUndefined(array) {
        return array && array.length === 1
            ? array[0]
            : undefined;
    }
    ts.singleOrUndefined = singleOrUndefined;
    function singleOrMany(array) {
        return array && array.length === 1
            ? array[0]
            : array;
    }
    ts.singleOrMany = singleOrMany;
    function replaceElement(array, index, value) {
        const result = array.slice(0);
        result[index] = value;
        return result;
    }
    ts.replaceElement = replaceElement;
    /**
     * Performs a binary search, finding the index at which `value` occurs in `array`.
     * If no such index is found, returns the 2's-complement of first index at which
     * `array[index]` exceeds `value`.
     * @param array A sorted array whose first element must be no larger than number
     * @param value The value to be searched for in the array.
     * @param keySelector A callback used to select the search key from `value` and each element of
     * `array`.
     * @param keyComparer A callback used to compare two keys in a sorted array.
     * @param offset An offset into `array` at which to start the search.
     */
    function binarySearch(array, value, keySelector, keyComparer, offset) {
        if (!array || array.length === 0) {
            return -1;
        }
        let low = offset || 0;
        let high = array.length - 1;
        const key = keySelector(value);
        while (low <= high) {
            const middle = low + ((high - low) >> 1);
            const midKey = keySelector(array[middle]);
            switch (keyComparer(midKey, key)) {
                case -1 /* LessThan */:
                    low = middle + 1;
                    break;
                case 0 /* EqualTo */:
                    return middle;
                case 1 /* GreaterThan */:
                    high = middle - 1;
                    break;
            }
        }
        return ~low;
    }
    ts.binarySearch = binarySearch;
    function reduceLeft(array, f, initial, start, count) {
        if (array && array.length > 0) {
            const size = array.length;
            if (size > 0) {
                let pos = start === undefined || start < 0 ? 0 : start;
                const end = count === undefined || pos + count > size - 1 ? size - 1 : pos + count;
                let result;
                if (arguments.length <= 2) {
                    result = array[pos];
                    pos++;
                }
                else {
                    result = initial;
                }
                while (pos <= end) {
                    result = f(result, array[pos], pos);
                    pos++;
                }
                return result;
            }
        }
        return initial;
    }
    ts.reduceLeft = reduceLeft;
    const hasOwnProperty = Object.prototype.hasOwnProperty;
    /**
     * Indicates whether a map-like contains an own property with the specified key.
     *
     * @param map A map-like.
     * @param key A property key.
     */
    function hasProperty(map, key) {
        return hasOwnProperty.call(map, key);
    }
    ts.hasProperty = hasProperty;
    /**
     * Gets the value of an owned property in a map-like.
     *
     * @param map A map-like.
     * @param key A property key.
     */
    function getProperty(map, key) {
        return hasOwnProperty.call(map, key) ? map[key] : undefined;
    }
    ts.getProperty = getProperty;
    /**
     * Gets the owned, enumerable property keys of a map-like.
     */
    function getOwnKeys(map) {
        const keys = [];
        for (const key in map) {
            if (hasOwnProperty.call(map, key)) {
                keys.push(key);
            }
        }
        return keys;
    }
    ts.getOwnKeys = getOwnKeys;
    function getOwnValues(sparseArray) {
        const values = [];
        for (const key in sparseArray) {
            if (hasOwnProperty.call(sparseArray, key)) {
                values.push(sparseArray[key]);
            }
        }
        return values;
    }
    ts.getOwnValues = getOwnValues;
    function arrayFrom(iterator, map) {
        const result = [];
        for (let { value, done } = iterator.next(); !done; { value, done } = iterator.next()) {
            result.push(map ? map(value) : value);
        }
        return result;
    }
    ts.arrayFrom = arrayFrom;
    function forEachEntry(map, callback) {
        const iterator = map.entries();
        for (let { value: pair, done } = iterator.next(); !done; { value: pair, done } = iterator.next()) {
            const [key, value] = pair;
            const result = callback(value, key);
            if (result) {
                return result;
            }
        }
        return undefined;
    }
    ts.forEachEntry = forEachEntry;
    function forEachKey(map, callback) {
        const iterator = map.keys();
        for (let { value: key, done } = iterator.next(); !done; { value: key, done } = iterator.next()) {
            const result = callback(key);
            if (result) {
                return result;
            }
        }
        return undefined;
    }
    ts.forEachKey = forEachKey;
    function copyEntries(source, target) {
        source.forEach((value, key) => {
            target.set(key, value);
        });
    }
    ts.copyEntries = copyEntries;
    function assign(t, ...args) {
        for (const arg of args) {
            for (const p in arg) {
                if (hasProperty(arg, p)) {
                    t[p] = arg[p];
                }
            }
        }
        return t;
    }
    ts.assign = assign;
    /**
     * Performs a shallow equality comparison of the contents of two map-likes.
     *
     * @param left A map-like whose properties should be compared.
     * @param right A map-like whose properties should be compared.
     */
    function equalOwnProperties(left, right, equalityComparer = equateValues) {
        if (left === right)
            return true;
        if (!left || !right)
            return false;
        for (const key in left) {
            if (hasOwnProperty.call(left, key)) {
                if (!hasOwnProperty.call(right, key) === undefined)
                    return false;
                if (!equalityComparer(left[key], right[key]))
                    return false;
            }
        }
        for (const key in right) {
            if (hasOwnProperty.call(right, key)) {
                if (!hasOwnProperty.call(left, key))
                    return false;
            }
        }
        return true;
    }
    ts.equalOwnProperties = equalOwnProperties;
    function arrayToMap(array, makeKey, makeValue = identity) {
        const result = createMap();
        for (const value of array) {
            const key = makeKey(value);
            if (key !== undefined)
                result.set(key, makeValue(value));
        }
        return result;
    }
    ts.arrayToMap = arrayToMap;
    function arrayToNumericMap(array, makeKey, makeValue = identity) {
        const result = [];
        for (const value of array) {
            result[makeKey(value)] = makeValue(value);
        }
        return result;
    }
    ts.arrayToNumericMap = arrayToNumericMap;
    function arrayToSet(array, makeKey) {
        return arrayToMap(array, makeKey || (s => s), () => true);
    }
    ts.arrayToSet = arrayToSet;
    function arrayToMultiMap(values, makeKey, makeValue = identity) {
        const result = createMultiMap();
        for (const value of values) {
            result.add(makeKey(value), makeValue(value));
        }
        return result;
    }
    ts.arrayToMultiMap = arrayToMultiMap;
    function group(values, getGroupId) {
        return arrayFrom(arrayToMultiMap(values, getGroupId).values());
    }
    ts.group = group;
    function cloneMap(map) {
        const clone = createMap();
        copyEntries(map, clone);
        return clone;
    }
    ts.cloneMap = cloneMap;
    function clone(object) {
        const result = {};
        for (const id in object) {
            if (hasOwnProperty.call(object, id)) {
                result[id] = object[id];
            }
        }
        return result;
    }
    ts.clone = clone;
    function extend(first, second) {
        const result = {};
        for (const id in second) {
            if (hasOwnProperty.call(second, id)) {
                result[id] = second[id];
            }
        }
        for (const id in first) {
            if (hasOwnProperty.call(first, id)) {
                result[id] = first[id];
            }
        }
        return result;
    }
    ts.extend = extend;
    function createMultiMap() {
        const map = createMap();
        map.add = multiMapAdd;
        map.remove = multiMapRemove;
        return map;
    }
    ts.createMultiMap = createMultiMap;
    function multiMapAdd(key, value) {
        let values = this.get(key);
        if (values) {
            values.push(value);
        }
        else {
            this.set(key, values = [value]);
        }
        return values;
    }
    function multiMapRemove(key, value) {
        const values = this.get(key);
        if (values) {
            unorderedRemoveItem(values, value);
            if (!values.length) {
                this.delete(key);
            }
        }
    }
    /**
     * Tests whether a value is an array.
     */
    function isArray(value) {
        return Array.isArray ? Array.isArray(value) : value instanceof Array;
    }
    ts.isArray = isArray;
    function toArray(value) {
        return isArray(value) ? value : [value];
    }
    ts.toArray = toArray;
    /**
     * Tests whether a value is string
     */
    function isString(text) {
        return typeof text === "string";
    }
    ts.isString = isString;
    function tryCast(value, test) {
        return value !== undefined && test(value) ? value : undefined;
    }
    ts.tryCast = tryCast;
    function cast(value, test) {
        if (value !== undefined && test(value))
            return value;
        if (value && typeof value.kind === "number") {
            Debug.fail(`Invalid cast. The supplied ${Debug.showSyntaxKind(value)} did not pass the test '${Debug.getFunctionName(test)}'.`);
        }
        else {
            Debug.fail(`Invalid cast. The supplied value did not pass the test '${Debug.getFunctionName(test)}'.`);
        }
    }
    ts.cast = cast;
    /** Does nothing. */
    function noop(_) { } // tslint:disable-line no-empty
    ts.noop = noop;
    /** Do nothing and return false */
    function returnFalse() { return false; }
    ts.returnFalse = returnFalse;
    /** Do nothing and return true */
    function returnTrue() { return true; }
    ts.returnTrue = returnTrue;
    /** Returns its argument. */
    function identity(x) { return x; }
    ts.identity = identity;
    /** Returns lower case string */
    function toLowerCase(x) { return x.toLowerCase(); }
    ts.toLowerCase = toLowerCase;
    /** Throws an error because a function is not implemented. */
    function notImplemented() {
        throw new Error("Not implemented");
    }
    ts.notImplemented = notImplemented;
    function memoize(callback) {
        let value;
        return () => {
            if (callback) {
                value = callback();
                callback = undefined;
            }
            return value;
        };
    }
    ts.memoize = memoize;
    function chain(a, b, c, d, e) {
        if (e) {
            const args = [];
            for (let i = 0; i < arguments.length; i++) {
                args[i] = arguments[i];
            }
            return t => compose(...map(args, f => f(t)));
        }
        else if (d) {
            return t => compose(a(t), b(t), c(t), d(t));
        }
        else if (c) {
            return t => compose(a(t), b(t), c(t));
        }
        else if (b) {
            return t => compose(a(t), b(t));
        }
        else if (a) {
            return t => compose(a(t));
        }
        else {
            return _ => u => u;
        }
    }
    ts.chain = chain;
    function compose(a, b, c, d, e) {
        if (e) {
            const args = [];
            for (let i = 0; i < arguments.length; i++) {
                args[i] = arguments[i];
            }
            return t => reduceLeft(args, (u, f) => f(u), t);
        }
        else if (d) {
            return t => d(c(b(a(t))));
        }
        else if (c) {
            return t => c(b(a(t)));
        }
        else if (b) {
            return t => b(a(t));
        }
        else if (a) {
            return t => a(t);
        }
        else {
            return t => t;
        }
    }
    ts.compose = compose;
    function formatStringFromArgs(text, args, baseIndex) {
        baseIndex = baseIndex || 0;
        return text.replace(/{(\d+)}/g, (_match, index) => Debug.assertDefined(args[+index + baseIndex]));
    }
    ts.formatStringFromArgs = formatStringFromArgs;
    function getLocaleSpecificMessage(message) {
        return ts.localizedDiagnosticMessages && ts.localizedDiagnosticMessages[message.key] || message.message;
    }
    ts.getLocaleSpecificMessage = getLocaleSpecificMessage;
    function createFileDiagnostic(file, start, length, message) {
        Debug.assertGreaterThanOrEqual(start, 0);
        Debug.assertGreaterThanOrEqual(length, 0);
        if (file) {
            Debug.assertLessThanOrEqual(start, file.text.length);
            Debug.assertLessThanOrEqual(start + length, file.text.length);
        }
        let text = getLocaleSpecificMessage(message);
        if (arguments.length > 4) {
            text = formatStringFromArgs(text, arguments, 4);
        }
        return {
            file,
            start,
            length,
            messageText: text,
            category: message.category,
            code: message.code,
            reportsUnnecessary: message.reportsUnnecessary,
        };
    }
    ts.createFileDiagnostic = createFileDiagnostic;
    /* internal */
    function formatMessage(_dummy, message) {
        let text = getLocaleSpecificMessage(message);
        if (arguments.length > 2) {
            text = formatStringFromArgs(text, arguments, 2);
        }
        return text;
    }
    ts.formatMessage = formatMessage;
    function createCompilerDiagnostic(message) {
        let text = getLocaleSpecificMessage(message);
        if (arguments.length > 1) {
            text = formatStringFromArgs(text, arguments, 1);
        }
        return {
            file: undefined,
            start: undefined,
            length: undefined,
            messageText: text,
            category: message.category,
            code: message.code,
            reportsUnnecessary: message.reportsUnnecessary,
        };
    }
    ts.createCompilerDiagnostic = createCompilerDiagnostic;
    function createCompilerDiagnosticFromMessageChain(chain) {
        return {
            file: undefined,
            start: undefined,
            length: undefined,
            code: chain.code,
            category: chain.category,
            messageText: chain.next ? chain : chain.messageText,
        };
    }
    ts.createCompilerDiagnosticFromMessageChain = createCompilerDiagnosticFromMessageChain;
    function chainDiagnosticMessages(details, message) {
        let text = getLocaleSpecificMessage(message);
        if (arguments.length > 2) {
            text = formatStringFromArgs(text, arguments, 2);
        }
        return {
            messageText: text,
            category: message.category,
            code: message.code,
            next: details
        };
    }
    ts.chainDiagnosticMessages = chainDiagnosticMessages;
    function concatenateDiagnosticMessageChains(headChain, tailChain) {
        let lastChain = headChain;
        while (lastChain.next) {
            lastChain = lastChain.next;
        }
        lastChain.next = tailChain;
        return headChain;
    }
    ts.concatenateDiagnosticMessageChains = concatenateDiagnosticMessageChains;
    function equateValues(a, b) {
        return a === b;
    }
    ts.equateValues = equateValues;
    /**
     * Compare the equality of two strings using a case-sensitive ordinal comparison.
     *
     * Case-sensitive comparisons compare both strings one code-point at a time using the integer
     * value of each code-point after applying `toUpperCase` to each string. We always map both
     * strings to their upper-case form as some unicode characters do not properly round-trip to
     * lowercase (such as `ẞ` (German sharp capital s)).
     */
    function equateStringsCaseInsensitive(a, b) {
        return a === b
            || a !== undefined
                && b !== undefined
                && a.toUpperCase() === b.toUpperCase();
    }
    ts.equateStringsCaseInsensitive = equateStringsCaseInsensitive;
    /**
     * Compare the equality of two strings using a case-sensitive ordinal comparison.
     *
     * Case-sensitive comparisons compare both strings one code-point at a time using the
     * integer value of each code-point.
     */
    function equateStringsCaseSensitive(a, b) {
        return equateValues(a, b);
    }
    ts.equateStringsCaseSensitive = equateStringsCaseSensitive;
    function compareComparableValues(a, b) {
        return a === b ? 0 /* EqualTo */ :
            a === undefined ? -1 /* LessThan */ :
                b === undefined ? 1 /* GreaterThan */ :
                    a < b ? -1 /* LessThan */ :
                        1 /* GreaterThan */;
    }
    /**
     * Compare two numeric values for their order relative to each other.
     * To compare strings, use any of the `compareStrings` functions.
     */
    function compareValues(a, b) {
        return compareComparableValues(a, b);
    }
    ts.compareValues = compareValues;
    function min(a, b, compare) {
        return compare(a, b) === -1 /* LessThan */ ? a : b;
    }
    ts.min = min;
    /**
     * Compare two strings using a case-insensitive ordinal comparison.
     *
     * Ordinal comparisons are based on the difference between the unicode code points of both
     * strings. Characters with multiple unicode representations are considered unequal. Ordinal
     * comparisons provide predictable ordering, but place "a" after "B".
     *
     * Case-insensitive comparisons compare both strings one code-point at a time using the integer
     * value of each code-point after applying `toUpperCase` to each string. We always map both
     * strings to their upper-case form as some unicode characters do not properly round-trip to
     * lowercase (such as `ẞ` (German sharp capital s)).
     */
    function compareStringsCaseInsensitive(a, b) {
        if (a === b)
            return 0 /* EqualTo */;
        if (a === undefined)
            return -1 /* LessThan */;
        if (b === undefined)
            return 1 /* GreaterThan */;
        a = a.toUpperCase();
        b = b.toUpperCase();
        return a < b ? -1 /* LessThan */ : a > b ? 1 /* GreaterThan */ : 0 /* EqualTo */;
    }
    ts.compareStringsCaseInsensitive = compareStringsCaseInsensitive;
    /**
     * Compare two strings using a case-sensitive ordinal comparison.
     *
     * Ordinal comparisons are based on the difference between the unicode code points of both
     * strings. Characters with multiple unicode representations are considered unequal. Ordinal
     * comparisons provide predictable ordering, but place "a" after "B".
     *
     * Case-sensitive comparisons compare both strings one code-point at a time using the integer
     * value of each code-point.
     */
    function compareStringsCaseSensitive(a, b) {
        return compareComparableValues(a, b);
    }
    ts.compareStringsCaseSensitive = compareStringsCaseSensitive;
    /**
     * Creates a string comparer for use with string collation in the UI.
     */
    const createUIStringComparer = (() => {
        let defaultComparer;
        let enUSComparer;
        const stringComparerFactory = getStringComparerFactory();
        return createStringComparer;
        function compareWithCallback(a, b, comparer) {
            if (a === b)
                return 0 /* EqualTo */;
            if (a === undefined)
                return -1 /* LessThan */;
            if (b === undefined)
                return 1 /* GreaterThan */;
            const value = comparer(a, b);
            return value < 0 ? -1 /* LessThan */ : value > 0 ? 1 /* GreaterThan */ : 0 /* EqualTo */;
        }
        function createIntlCollatorStringComparer(locale) {
            // Intl.Collator.prototype.compare is bound to the collator. See NOTE in
            // http://www.ecma-international.org/ecma-402/2.0/#sec-Intl.Collator.prototype.compare
            const comparer = new Intl.Collator(locale, { usage: "sort", sensitivity: "variant" }).compare;
            return (a, b) => compareWithCallback(a, b, comparer);
        }
        function createLocaleCompareStringComparer(locale) {
            // if the locale is not the default locale (`undefined`), use the fallback comparer.
            if (locale !== undefined)
                return createFallbackStringComparer();
            return (a, b) => compareWithCallback(a, b, compareStrings);
            function compareStrings(a, b) {
                return a.localeCompare(b);
            }
        }
        function createFallbackStringComparer() {
            // An ordinal comparison puts "A" after "b", but for the UI we want "A" before "b".
            // We first sort case insensitively.  So "Aaa" will come before "baa".
            // Then we sort case sensitively, so "aaa" will come before "Aaa".
            //
            // For case insensitive comparisons we always map both strings to their
            // upper-case form as some unicode characters do not properly round-trip to
            // lowercase (such as `ẞ` (German sharp capital s)).
            return (a, b) => compareWithCallback(a, b, compareDictionaryOrder);
            function compareDictionaryOrder(a, b) {
                return compareStrings(a.toUpperCase(), b.toUpperCase()) || compareStrings(a, b);
            }
            function compareStrings(a, b) {
                return a < b ? -1 /* LessThan */ : a > b ? 1 /* GreaterThan */ : 0 /* EqualTo */;
            }
        }
        function getStringComparerFactory() {
            // If the host supports Intl, we use it for comparisons using the default locale.
            if (typeof Intl === "object" && typeof Intl.Collator === "function") {
                return createIntlCollatorStringComparer;
            }
            // If the host does not support Intl, we fall back to localeCompare.
            // localeCompare in Node v0.10 is just an ordinal comparison, so don't use it.
            if (typeof String.prototype.localeCompare === "function" &&
                typeof String.prototype.toLocaleUpperCase === "function" &&
                "a".localeCompare("B") < 0) {
                return createLocaleCompareStringComparer;
            }
            // Otherwise, fall back to ordinal comparison:
            return createFallbackStringComparer;
        }
        function createStringComparer(locale) {
            // Hold onto common string comparers. This avoids constantly reallocating comparers during
            // tests.
            if (locale === undefined) {
                return defaultComparer || (defaultComparer = stringComparerFactory(locale));
            }
            else if (locale === "en-US") {
                return enUSComparer || (enUSComparer = stringComparerFactory(locale));
            }
            else {
                return stringComparerFactory(locale);
            }
        }
    })();
    let uiComparerCaseSensitive;
    let uiLocale;
    function getUILocale() {
        return uiLocale;
    }
    ts.getUILocale = getUILocale;
    function setUILocale(value) {
        if (uiLocale !== value) {
            uiLocale = value;
            uiComparerCaseSensitive = undefined;
        }
    }
    ts.setUILocale = setUILocale;
    /**
     * Compare two strings in a using the case-sensitive sort behavior of the UI locale.
     *
     * Ordering is not predictable between different host locales, but is best for displaying
     * ordered data for UI presentation. Characters with multiple unicode representations may
     * be considered equal.
     *
     * Case-sensitive comparisons compare strings that differ in base characters, or
     * accents/diacritic marks, or case as unequal.
     */
    function compareStringsCaseSensitiveUI(a, b) {
        const comparer = uiComparerCaseSensitive || (uiComparerCaseSensitive = createUIStringComparer(uiLocale));
        return comparer(a, b);
    }
    ts.compareStringsCaseSensitiveUI = compareStringsCaseSensitiveUI;
    function compareProperties(a, b, key, comparer) {
        return a === b ? 0 /* EqualTo */ :
            a === undefined ? -1 /* LessThan */ :
                b === undefined ? 1 /* GreaterThan */ :
                    comparer(a[key], b[key]);
    }
    ts.compareProperties = compareProperties;
    function getDiagnosticFileName(diagnostic) {
        return diagnostic.file ? diagnostic.file.fileName : undefined;
    }
    function compareDiagnostics(d1, d2) {
        return compareStringsCaseSensitive(getDiagnosticFileName(d1), getDiagnosticFileName(d2)) ||
            compareValues(d1.start, d2.start) ||
            compareValues(d1.length, d2.length) ||
            compareValues(d1.code, d2.code) ||
            compareMessageText(d1.messageText, d2.messageText) ||
            0 /* EqualTo */;
    }
    ts.compareDiagnostics = compareDiagnostics;
    /** True is greater than false. */
    function compareBooleans(a, b) {
        return compareValues(a ? 1 : 0, b ? 1 : 0);
    }
    ts.compareBooleans = compareBooleans;
    function compareMessageText(text1, text2) {
        while (text1 && text2) {
            // We still have both chains.
            const string1 = isString(text1) ? text1 : text1.messageText;
            const string2 = isString(text2) ? text2 : text2.messageText;
            const res = compareStringsCaseSensitive(string1, string2);
            if (res) {
                return res;
            }
            text1 = isString(text1) ? undefined : text1.next;
            text2 = isString(text2) ? undefined : text2.next;
        }
        if (!text1 && !text2) {
            // if the chains are done, then these messages are the same.
            return 0 /* EqualTo */;
        }
        // We still have one chain remaining.  The shorter chain should come first.
        return text1 ? 1 /* GreaterThan */ : -1 /* LessThan */;
    }
    function normalizeSlashes(path) {
        return path.replace(/\\/g, "/");
    }
    ts.normalizeSlashes = normalizeSlashes;
    /**
     * Returns length of path root (i.e. length of "/", "x:/", "//server/share/, file:///user/files")
     */
    function getRootLength(path) {
        if (path.charCodeAt(0) === 47 /* slash */) {
            if (path.charCodeAt(1) !== 47 /* slash */)
                return 1;
            const p1 = path.indexOf("/", 2);
            if (p1 < 0)
                return 2;
            const p2 = path.indexOf("/", p1 + 1);
            if (p2 < 0)
                return p1 + 1;
            return p2 + 1;
        }
        if (path.charCodeAt(1) === 58 /* colon */) {
            if (path.charCodeAt(2) === 47 /* slash */ || path.charCodeAt(2) === 92 /* backslash */)
                return 3;
        }
        // Per RFC 1738 'file' URI schema has the shape file://<host>/<path>
        // if <host> is omitted then it is assumed that host value is 'localhost',
        // however slash after the omitted <host> is not removed.
        // file:///folder1/file1 - this is a correct URI
        // file://folder2/file2 - this is an incorrect URI
        if (path.lastIndexOf("file:///", 0) === 0) {
            return "file:///".length;
        }
        const idx = path.indexOf("://");
        if (idx !== -1) {
            return idx + "://".length;
        }
        return 0;
    }
    ts.getRootLength = getRootLength;
    /**
     * Internally, we represent paths as strings with '/' as the directory separator.
     * When we make system calls (eg: LanguageServiceHost.getDirectory()),
     * we expect the host to correctly handle paths in our specified format.
     */
    ts.directorySeparator = "/";
    const directorySeparatorCharCode = 47 /* slash */;
    function getNormalizedParts(normalizedSlashedPath, rootLength) {
        const parts = normalizedSlashedPath.substr(rootLength).split(ts.directorySeparator);
        const normalized = [];
        for (const part of parts) {
            if (part !== ".") {
                if (part === ".." && normalized.length > 0 && lastOrUndefined(normalized) !== "..") {
                    normalized.pop();
                }
                else {
                    // A part may be an empty string (which is 'falsy') if the path had consecutive slashes,
                    // e.g. "path//file.ts".  Drop these before re-joining the parts.
                    if (part) {
                        normalized.push(part);
                    }
                }
            }
        }
        return normalized;
    }
    function normalizePath(path) {
        return normalizePathAndParts(path).path;
    }
    ts.normalizePath = normalizePath;
    function normalizePathAndParts(path) {
        path = normalizeSlashes(path);
        const rootLength = getRootLength(path);
        const root = path.substr(0, rootLength);
        const parts = getNormalizedParts(path, rootLength);
        if (parts.length) {
            const joinedParts = root + parts.join(ts.directorySeparator);
            return { path: pathEndsWithDirectorySeparator(path) ? joinedParts + ts.directorySeparator : joinedParts, parts };
        }
        else {
            return { path: root, parts };
        }
    }
    ts.normalizePathAndParts = normalizePathAndParts;
    /** A path ending with '/' refers to a directory only, never a file. */
    function pathEndsWithDirectorySeparator(path) {
        return path.charCodeAt(path.length - 1) === directorySeparatorCharCode;
    }
    ts.pathEndsWithDirectorySeparator = pathEndsWithDirectorySeparator;
    function getDirectoryPath(path) {
        return path.substr(0, Math.max(getRootLength(path), path.lastIndexOf(ts.directorySeparator)));
    }
    ts.getDirectoryPath = getDirectoryPath;
    function isUrl(path) {
        return path && !isRootedDiskPath(path) && stringContains(path, "://");
    }
    ts.isUrl = isUrl;
    function pathIsRelative(path) {
        return /^\.\.?($|[\\/])/.test(path);
    }
    ts.pathIsRelative = pathIsRelative;
    function getEmitScriptTarget(compilerOptions) {
        return compilerOptions.target || ts.ScriptTarget.ES3;
    }
    ts.getEmitScriptTarget = getEmitScriptTarget;
    function getEmitModuleKind(compilerOptions) {
        return typeof compilerOptions.module === "number" ?
            compilerOptions.module :
            getEmitScriptTarget(compilerOptions) >= ts.ScriptTarget.ES2015 ? ts.ModuleKind.ES2015 : ts.ModuleKind.CommonJS;
    }
    ts.getEmitModuleKind = getEmitModuleKind;
    function getEmitModuleResolutionKind(compilerOptions) {
        let moduleResolution = compilerOptions.moduleResolution;
        if (moduleResolution === undefined) {
            moduleResolution = getEmitModuleKind(compilerOptions) === ts.ModuleKind.CommonJS ? ts.ModuleResolutionKind.NodeJs : ts.ModuleResolutionKind.Classic;
        }
        return moduleResolution;
    }
    ts.getEmitModuleResolutionKind = getEmitModuleResolutionKind;
    function getAreDeclarationMapsEnabled(options) {
        return !!(options.declaration && options.declarationMap);
    }
    ts.getAreDeclarationMapsEnabled = getAreDeclarationMapsEnabled;
    function getAllowSyntheticDefaultImports(compilerOptions) {
        const moduleKind = getEmitModuleKind(compilerOptions);
        return compilerOptions.allowSyntheticDefaultImports !== undefined
            ? compilerOptions.allowSyntheticDefaultImports
            : compilerOptions.esModuleInterop
                ? moduleKind !== ts.ModuleKind.None && moduleKind < ts.ModuleKind.ES2015
                : moduleKind === ts.ModuleKind.System;
    }
    ts.getAllowSyntheticDefaultImports = getAllowSyntheticDefaultImports;
    function getStrictOptionValue(compilerOptions, flag) {
        return compilerOptions[flag] === undefined ? compilerOptions.strict : compilerOptions[flag];
    }
    ts.getStrictOptionValue = getStrictOptionValue;
    function hasZeroOrOneAsteriskCharacter(str) {
        let seenAsterisk = false;
        for (let i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) === 42 /* asterisk */) {
                if (!seenAsterisk) {
                    seenAsterisk = true;
                }
                else {
                    // have already seen asterisk
                    return false;
                }
            }
        }
        return true;
    }
    ts.hasZeroOrOneAsteriskCharacter = hasZeroOrOneAsteriskCharacter;
    function isRootedDiskPath(path) {
        return path && getRootLength(path) !== 0;
    }
    ts.isRootedDiskPath = isRootedDiskPath;
    function convertToRelativePath(absoluteOrRelativePath, basePath, getCanonicalFileName) {
        return !isRootedDiskPath(absoluteOrRelativePath)
            ? absoluteOrRelativePath
            : getRelativePathToDirectoryOrUrl(basePath, absoluteOrRelativePath, basePath, getCanonicalFileName, /*isAbsolutePathAnUrl*/ false);
    }
    ts.convertToRelativePath = convertToRelativePath;
    function normalizedPathComponents(path, rootLength) {
        const normalizedParts = getNormalizedParts(path, rootLength);
        return [path.substr(0, rootLength)].concat(normalizedParts);
    }
    function getNormalizedPathComponents(path, currentDirectory) {
        path = normalizeSlashes(path);
        let rootLength = getRootLength(path);
        if (rootLength === 0) {
            // If the path is not rooted it is relative to current directory
            path = combinePaths(normalizeSlashes(currentDirectory), path);
            rootLength = getRootLength(path);
        }
        return normalizedPathComponents(path, rootLength);
    }
    ts.getNormalizedPathComponents = getNormalizedPathComponents;
    function getNormalizedAbsolutePath(fileName, currentDirectory) {
        return getNormalizedPathFromPathComponents(getNormalizedPathComponents(fileName, currentDirectory));
    }
    ts.getNormalizedAbsolutePath = getNormalizedAbsolutePath;
    function getNormalizedPathFromPathComponents(pathComponents) {
        if (pathComponents && pathComponents.length) {
            return pathComponents[0] + pathComponents.slice(1).join(ts.directorySeparator);
        }
    }
    ts.getNormalizedPathFromPathComponents = getNormalizedPathFromPathComponents;
    function getNormalizedPathComponentsOfUrl(url) {
        // Get root length of http://www.website.com/folder1/folder2/
        // In this example the root is: http://www.website.com/
        // normalized path components should be ["http://www.website.com/", "folder1", "folder2"]
        const urlLength = url.length;
        // Initial root length is http:// part
        let rootLength = url.indexOf("://") + "://".length;
        while (rootLength < urlLength) {
            // Consume all immediate slashes in the protocol
            // eg.initial rootlength is just file:// but it needs to consume another "/" in file:///
            if (url.charCodeAt(rootLength) === 47 /* slash */) {
                rootLength++;
            }
            else {
                // non slash character means we continue proceeding to next component of root search
                break;
            }
        }
        // there are no parts after http:// just return current string as the pathComponent
        if (rootLength === urlLength) {
            return [url];
        }
        // Find the index of "/" after website.com so the root can be http://www.website.com/ (from existing http://)
        const indexOfNextSlash = url.indexOf(ts.directorySeparator, rootLength);
        if (indexOfNextSlash !== -1) {
            // Found the "/" after the website.com so the root is length of http://www.website.com/
            // and get components after the root normally like any other folder components
            rootLength = indexOfNextSlash + 1;
            return normalizedPathComponents(url, rootLength);
        }
        else {
            // Can't find the host assume the rest of the string as component
            // but make sure we append "/" to it as root is not joined using "/"
            // eg. if url passed in was http://website.com we want to use root as [http://website.com/]
            // so that other path manipulations will be correct and it can be merged with relative paths correctly
            return [url + ts.directorySeparator];
        }
    }
    function getNormalizedPathOrUrlComponents(pathOrUrl, currentDirectory) {
        if (isUrl(pathOrUrl)) {
            return getNormalizedPathComponentsOfUrl(pathOrUrl);
        }
        else {
            return getNormalizedPathComponents(pathOrUrl, currentDirectory);
        }
    }
    function getRelativePathToDirectoryOrUrl(directoryPathOrUrl, relativeOrAbsolutePath, currentDirectory, getCanonicalFileName, isAbsolutePathAnUrl) {
        const pathComponents = getNormalizedPathOrUrlComponents(relativeOrAbsolutePath, currentDirectory);
        const directoryComponents = getNormalizedPathOrUrlComponents(directoryPathOrUrl, currentDirectory);
        if (directoryComponents.length > 1 && lastOrUndefined(directoryComponents) === "") {
            // If the directory path given was of type test/cases/ then we really need components of directory to be only till its name
            // that is ["test", "cases", ""] needs to be actually ["test", "cases"]
            directoryComponents.pop();
        }
        // Find the component that differs
        let joinStartIndex;
        for (joinStartIndex = 0; joinStartIndex < pathComponents.length && joinStartIndex < directoryComponents.length; joinStartIndex++) {
            if (getCanonicalFileName(directoryComponents[joinStartIndex]) !== getCanonicalFileName(pathComponents[joinStartIndex])) {
                break;
            }
        }
        // Get the relative path
        if (joinStartIndex) {
            let relativePath = "";
            const relativePathComponents = pathComponents.slice(joinStartIndex, pathComponents.length);
            for (; joinStartIndex < directoryComponents.length; joinStartIndex++) {
                if (directoryComponents[joinStartIndex] !== "") {
                    relativePath = relativePath + ".." + ts.directorySeparator;
                }
            }
            return relativePath + relativePathComponents.join(ts.directorySeparator);
        }
        // Cant find the relative path, get the absolute path
        let absolutePath = getNormalizedPathFromPathComponents(pathComponents);
        if (isAbsolutePathAnUrl && isRootedDiskPath(absolutePath)) {
            absolutePath = "file:///" + absolutePath;
        }
        return absolutePath;
    }
    ts.getRelativePathToDirectoryOrUrl = getRelativePathToDirectoryOrUrl;
    function getRelativePath(path, directoryPath, getCanonicalFileName) {
        const relativePath = getRelativePathToDirectoryOrUrl(directoryPath, path, directoryPath, getCanonicalFileName, /*isAbsolutePathAnUrl*/ false);
        return ensurePathIsRelative(relativePath);
    }
    ts.getRelativePath = getRelativePath;
    function ensurePathIsRelative(path) {
        return !pathIsRelative(path) ? "./" + path : path;
    }
    ts.ensurePathIsRelative = ensurePathIsRelative;
    function getBaseFileName(path) {
        if (path === undefined) {
            return undefined;
        }
        const i = path.lastIndexOf(ts.directorySeparator);
        return i < 0 ? path : path.substring(i + 1);
    }
    ts.getBaseFileName = getBaseFileName;
    function combinePaths(path1, path2) {
        if (!(path1 && path1.length))
            return path2;
        if (!(path2 && path2.length))
            return path1;
        if (getRootLength(path2) !== 0)
            return path2;
        if (path1.charAt(path1.length - 1) === ts.directorySeparator)
            return path1 + path2;
        return path1 + ts.directorySeparator + path2;
    }
    ts.combinePaths = combinePaths;
    function removeTrailingDirectorySeparator(path) {
        if (path.charAt(path.length - 1) === ts.directorySeparator) {
            return path.substr(0, path.length - 1);
        }
        return path;
    }
    ts.removeTrailingDirectorySeparator = removeTrailingDirectorySeparator;
    function ensureTrailingDirectorySeparator(path) {
        if (path.charAt(path.length - 1) !== ts.directorySeparator) {
            return path + ts.directorySeparator;
        }
        return path;
    }
    ts.ensureTrailingDirectorySeparator = ensureTrailingDirectorySeparator;
    function comparePaths(a, b, currentDirectory, ignoreCase) {
        if (a === b)
            return 0 /* EqualTo */;
        if (a === undefined)
            return -1 /* LessThan */;
        if (b === undefined)
            return 1 /* GreaterThan */;
        a = removeTrailingDirectorySeparator(a);
        b = removeTrailingDirectorySeparator(b);
        const aComponents = getNormalizedPathComponents(a, currentDirectory);
        const bComponents = getNormalizedPathComponents(b, currentDirectory);
        const sharedLength = Math.min(aComponents.length, bComponents.length);
        const comparer = ignoreCase ? compareStringsCaseInsensitive : compareStringsCaseSensitive;
        for (let i = 0; i < sharedLength; i++) {
            const result = comparer(aComponents[i], bComponents[i]);
            if (result !== 0 /* EqualTo */) {
                return result;
            }
        }
        return compareValues(aComponents.length, bComponents.length);
    }
    ts.comparePaths = comparePaths;
    function containsPath(parent, child, currentDirectory, ignoreCase) {
        if (parent === undefined || child === undefined)
            return false;
        if (parent === child)
            return true;
        parent = removeTrailingDirectorySeparator(parent);
        child = removeTrailingDirectorySeparator(child);
        if (parent === child)
            return true;
        const parentComponents = getNormalizedPathComponents(parent, currentDirectory);
        const childComponents = getNormalizedPathComponents(child, currentDirectory);
        if (childComponents.length < parentComponents.length) {
            return false;
        }
        const equalityComparer = ignoreCase ? equateStringsCaseInsensitive : equateStringsCaseSensitive;
        for (let i = 0; i < parentComponents.length; i++) {
            if (!equalityComparer(parentComponents[i], childComponents[i])) {
                return false;
            }
        }
        return true;
    }
    ts.containsPath = containsPath;
    function startsWith(str, prefix) {
        return str.lastIndexOf(prefix, 0) === 0;
    }
    ts.startsWith = startsWith;
    function removePrefix(str, prefix) {
        return startsWith(str, prefix) ? str.substr(prefix.length) : str;
    }
    ts.removePrefix = removePrefix;
    function endsWith(str, suffix) {
        const expectedPos = str.length - suffix.length;
        return expectedPos >= 0 && str.indexOf(suffix, expectedPos) === expectedPos;
    }
    ts.endsWith = endsWith;
    function removeSuffix(str, suffix) {
        return endsWith(str, suffix) ? str.slice(0, str.length - suffix.length) : str;
    }
    ts.removeSuffix = removeSuffix;
    function stringContains(str, substring) {
        return str.indexOf(substring) !== -1;
    }
    ts.stringContains = stringContains;
    function hasExtension(fileName) {
        return stringContains(getBaseFileName(fileName), ".");
    }
    ts.hasExtension = hasExtension;
    function fileExtensionIs(path, extension) {
        return path.length > extension.length && endsWith(path, extension);
    }
    ts.fileExtensionIs = fileExtensionIs;
    function fileExtensionIsOneOf(path, extensions) {
        for (const extension of extensions) {
            if (fileExtensionIs(path, extension)) {
                return true;
            }
        }
        return false;
    }
    ts.fileExtensionIsOneOf = fileExtensionIsOneOf;
    // Reserved characters, forces escaping of any non-word (or digit), non-whitespace character.
    // It may be inefficient (we could just match (/[-[\]{}()*+?.,\\^$|#\s]/g), but this is future
    // proof.
    const reservedCharacterPattern = /[^\w\s\/]/g;
    const wildcardCharCodes = [42 /* asterisk */, 63 /* question */];
    ts.commonPackageFolders = ["node_modules", "bower_components", "jspm_packages"];
    const implicitExcludePathRegexPattern = `(?!(${ts.commonPackageFolders.join("|")})(/|$))`;
    const filesMatcher = {
        /**
         * Matches any single directory segment unless it is the last segment and a .min.js file
         * Breakdown:
         *  [^./]                   # matches everything up to the first . character (excluding directory seperators)
         *  (\\.(?!min\\.js$))?     # matches . characters but not if they are part of the .min.js file extension
         */
        singleAsteriskRegexFragment: "([^./]|(\\.(?!min\\.js$))?)*",
        /**
         * Regex for the ** wildcard. Matches any number of subdirectories. When used for including
         * files or directories, does not match subdirectories that start with a . character
         */
        doubleAsteriskRegexFragment: `(/${implicitExcludePathRegexPattern}[^/.][^/]*)*?`,
        replaceWildcardCharacter: match => replaceWildcardCharacter(match, filesMatcher.singleAsteriskRegexFragment)
    };
    const directoriesMatcher = {
        singleAsteriskRegexFragment: "[^/]*",
        /**
         * Regex for the ** wildcard. Matches any number of subdirectories. When used for including
         * files or directories, does not match subdirectories that start with a . character
         */
        doubleAsteriskRegexFragment: `(/${implicitExcludePathRegexPattern}[^/.][^/]*)*?`,
        replaceWildcardCharacter: match => replaceWildcardCharacter(match, directoriesMatcher.singleAsteriskRegexFragment)
    };
    const excludeMatcher = {
        singleAsteriskRegexFragment: "[^/]*",
        doubleAsteriskRegexFragment: "(/.+?)?",
        replaceWildcardCharacter: match => replaceWildcardCharacter(match, excludeMatcher.singleAsteriskRegexFragment)
    };
    const wildcardMatchers = {
        files: filesMatcher,
        directories: directoriesMatcher,
        exclude: excludeMatcher
    };
    function getRegularExpressionForWildcard(specs, basePath, usage) {
        const patterns = getRegularExpressionsForWildcards(specs, basePath, usage);
        if (!patterns || !patterns.length) {
            return undefined;
        }
        const pattern = patterns.map(pattern => `(${pattern})`).join("|");
        // If excluding, match "foo/bar/baz...", but if including, only allow "foo".
        const terminator = usage === "exclude" ? "($|/)" : "$";
        return `^(${pattern})${terminator}`;
    }
    ts.getRegularExpressionForWildcard = getRegularExpressionForWildcard;
    function getRegularExpressionsForWildcards(specs, basePath, usage) {
        if (specs === undefined || specs.length === 0) {
            return undefined;
        }
        return flatMap(specs, spec => spec && getSubPatternFromSpec(spec, basePath, usage, wildcardMatchers[usage]));
    }
    /**
     * An "includes" path "foo" is implicitly a glob "foo/** /*" (without the space) if its last component has no extension,
     * and does not contain any glob characters itself.
     */
    function isImplicitGlob(lastPathComponent) {
        return !/[.*?]/.test(lastPathComponent);
    }
    ts.isImplicitGlob = isImplicitGlob;
    function getSubPatternFromSpec(spec, basePath, usage, { singleAsteriskRegexFragment, doubleAsteriskRegexFragment, replaceWildcardCharacter }) {
        let subpattern = "";
        let hasWrittenComponent = false;
        const components = getNormalizedPathComponents(spec, basePath);
        const lastComponent = lastOrUndefined(components);
        if (usage !== "exclude" && lastComponent === "**") {
            return undefined;
        }
        // getNormalizedPathComponents includes the separator for the root component.
        // We need to remove to create our regex correctly.
        components[0] = removeTrailingDirectorySeparator(components[0]);
        if (isImplicitGlob(lastComponent)) {
            components.push("**", "*");
        }
        let optionalCount = 0;
        for (let component of components) {
            if (component === "**") {
                subpattern += doubleAsteriskRegexFragment;
            }
            else {
                if (usage === "directories") {
                    subpattern += "(";
                    optionalCount++;
                }
                if (hasWrittenComponent) {
                    subpattern += ts.directorySeparator;
                }
                if (usage !== "exclude") {
                    let componentPattern = "";
                    // The * and ? wildcards should not match directories or files that start with . if they
                    // appear first in a component. Dotted directories and files can be included explicitly
                    // like so: **/.*/.*
                    if (component.charCodeAt(0) === 42 /* asterisk */) {
                        componentPattern += "([^./]" + singleAsteriskRegexFragment + ")?";
                        component = component.substr(1);
                    }
                    else if (component.charCodeAt(0) === 63 /* question */) {
                        componentPattern += "[^./]";
                        component = component.substr(1);
                    }
                    componentPattern += component.replace(reservedCharacterPattern, replaceWildcardCharacter);
                    // Patterns should not include subfolders like node_modules unless they are
                    // explicitly included as part of the path.
                    //
                    // As an optimization, if the component pattern is the same as the component,
                    // then there definitely were no wildcard characters and we do not need to
                    // add the exclusion pattern.
                    if (componentPattern !== component) {
                        subpattern += implicitExcludePathRegexPattern;
                    }
                    subpattern += componentPattern;
                }
                else {
                    subpattern += component.replace(reservedCharacterPattern, replaceWildcardCharacter);
                }
            }
            hasWrittenComponent = true;
        }
        while (optionalCount > 0) {
            subpattern += ")?";
            optionalCount--;
        }
        return subpattern;
    }
    function replaceWildcardCharacter(match, singleAsteriskRegexFragment) {
        return match === "*" ? singleAsteriskRegexFragment : match === "?" ? "[^/]" : "\\" + match;
    }
    function getFileMatcherPatterns(path, excludes, includes, useCaseSensitiveFileNames, currentDirectory) {
        path = normalizePath(path);
        currentDirectory = normalizePath(currentDirectory);
        const absolutePath = combinePaths(currentDirectory, path);
        return {
            includeFilePatterns: map(getRegularExpressionsForWildcards(includes, absolutePath, "files"), pattern => `^${pattern}$`),
            includeFilePattern: getRegularExpressionForWildcard(includes, absolutePath, "files"),
            includeDirectoryPattern: getRegularExpressionForWildcard(includes, absolutePath, "directories"),
            excludePattern: getRegularExpressionForWildcard(excludes, absolutePath, "exclude"),
            basePaths: getBasePaths(path, includes, useCaseSensitiveFileNames)
        };
    }
    ts.getFileMatcherPatterns = getFileMatcherPatterns;
    function matchFiles(path, extensions, excludes, includes, useCaseSensitiveFileNames, currentDirectory, depth, getFileSystemEntries) {
        path = normalizePath(path);
        currentDirectory = normalizePath(currentDirectory);
        const patterns = getFileMatcherPatterns(path, excludes, includes, useCaseSensitiveFileNames, currentDirectory);
        const regexFlag = useCaseSensitiveFileNames ? "" : "i";
        const includeFileRegexes = patterns.includeFilePatterns && patterns.includeFilePatterns.map(pattern => new RegExp(pattern, regexFlag));
        const includeDirectoryRegex = patterns.includeDirectoryPattern && new RegExp(patterns.includeDirectoryPattern, regexFlag);
        const excludeRegex = patterns.excludePattern && new RegExp(patterns.excludePattern, regexFlag);
        // Associate an array of results with each include regex. This keeps results in order of the "include" order.
        // If there are no "includes", then just put everything in results[0].
        const results = includeFileRegexes ? includeFileRegexes.map(() => []) : [[]];
        for (const basePath of patterns.basePaths) {
            visitDirectory(basePath, combinePaths(currentDirectory, basePath), depth);
        }
        return flatten(results);
        function visitDirectory(path, absolutePath, depth) {
            const { files, directories } = getFileSystemEntries(path);
            for (const current of sort(files, compareStringsCaseSensitive)) {
                const name = combinePaths(path, current);
                const absoluteName = combinePaths(absolutePath, current);
                if (extensions && !fileExtensionIsOneOf(name, extensions))
                    continue;
                if (excludeRegex && excludeRegex.test(absoluteName))
                    continue;
                if (!includeFileRegexes) {
                    results[0].push(name);
                }
                else {
                    const includeIndex = findIndex(includeFileRegexes, re => re.test(absoluteName));
                    if (includeIndex !== -1) {
                        results[includeIndex].push(name);
                    }
                }
            }
            if (depth !== undefined) {
                depth--;
                if (depth === 0) {
                    return;
                }
            }
            for (const current of sort(directories, compareStringsCaseSensitive)) {
                const name = combinePaths(path, current);
                const absoluteName = combinePaths(absolutePath, current);
                if ((!includeDirectoryRegex || includeDirectoryRegex.test(absoluteName)) &&
                    (!excludeRegex || !excludeRegex.test(absoluteName))) {
                    visitDirectory(name, absoluteName, depth);
                }
            }
        }
    }
    ts.matchFiles = matchFiles;
    /**
     * Computes the unique non-wildcard base paths amongst the provided include patterns.
     */
    function getBasePaths(path, includes, useCaseSensitiveFileNames) {
        // Storage for our results in the form of literal paths (e.g. the paths as written by the user).
        const basePaths = [path];
        if (includes) {
            // Storage for literal base paths amongst the include patterns.
            const includeBasePaths = [];
            for (const include of includes) {
                // We also need to check the relative paths by converting them to absolute and normalizing
                // in case they escape the base path (e.g "..\somedirectory")
                const absolute = isRootedDiskPath(include) ? include : normalizePath(combinePaths(path, include));
                // Append the literal and canonical candidate base paths.
                includeBasePaths.push(getIncludeBasePath(absolute));
            }
            // Sort the offsets array using either the literal or canonical path representations.
            includeBasePaths.sort(useCaseSensitiveFileNames ? compareStringsCaseSensitive : compareStringsCaseInsensitive);
            // Iterate over each include base path and include unique base paths that are not a
            // subpath of an existing base path
            for (const includeBasePath of includeBasePaths) {
                if (every(basePaths, basePath => !containsPath(basePath, includeBasePath, path, !useCaseSensitiveFileNames))) {
                    basePaths.push(includeBasePath);
                }
            }
        }
        return basePaths;
    }
    function getIncludeBasePath(absolute) {
        const wildcardOffset = indexOfAnyCharCode(absolute, wildcardCharCodes);
        if (wildcardOffset < 0) {
            // No "*" or "?" in the path
            return !hasExtension(absolute)
                ? absolute
                : removeTrailingDirectorySeparator(getDirectoryPath(absolute));
        }
        return absolute.substring(0, absolute.lastIndexOf(ts.directorySeparator, wildcardOffset));
    }
    function ensureScriptKind(fileName, scriptKind) {
        // Using scriptKind as a condition handles both:
        // - 'scriptKind' is unspecified and thus it is `undefined`
        // - 'scriptKind' is set and it is `Unknown` (0)
        // If the 'scriptKind' is 'undefined' or 'Unknown' then we attempt
        // to get the ScriptKind from the file name. If it cannot be resolved
        // from the file name then the default 'TS' script kind is returned.
        return scriptKind || getScriptKindFromFileName(fileName) || ts.ScriptKind.TS;
    }
    ts.ensureScriptKind = ensureScriptKind;
    function getScriptKindFromFileName(fileName) {
        const ext = fileName.substr(fileName.lastIndexOf("."));
        switch (ext.toLowerCase()) {
            case ts.Extension.Js:
                return ts.ScriptKind.JS;
            case ts.Extension.Jsx:
                return ts.ScriptKind.JSX;
            case ts.Extension.Ts:
                return ts.ScriptKind.TS;
            case ts.Extension.Tsx:
                return ts.ScriptKind.TSX;
            case ts.Extension.Json:
                return ts.ScriptKind.JSON;
            default:
                return ts.ScriptKind.Unknown;
        }
    }
    ts.getScriptKindFromFileName = getScriptKindFromFileName;
    /**
     *  List of supported extensions in order of file resolution precedence.
     */
    ts.supportedTypeScriptExtensions = [ts.Extension.Ts, ts.Extension.Tsx, ts.Extension.Dts];
    /** Must have ".d.ts" first because if ".ts" goes first, that will be detected as the extension instead of ".d.ts". */
    ts.supportedTypescriptExtensionsForExtractExtension = [ts.Extension.Dts, ts.Extension.Ts, ts.Extension.Tsx];
    ts.supportedJavascriptExtensions = [ts.Extension.Js, ts.Extension.Jsx];
    const allSupportedExtensions = [...ts.supportedTypeScriptExtensions, ...ts.supportedJavascriptExtensions];
    function getSupportedExtensions(options, extraFileExtensions) {
        const needAllExtensions = options && options.allowJs;
        if (!extraFileExtensions || extraFileExtensions.length === 0 || !needAllExtensions) {
            return needAllExtensions ? allSupportedExtensions : ts.supportedTypeScriptExtensions;
        }
        return deduplicate([...allSupportedExtensions, ...extraFileExtensions.map(e => e.extension)], equateStringsCaseSensitive, compareStringsCaseSensitive);
    }
    ts.getSupportedExtensions = getSupportedExtensions;
    function hasJavaScriptFileExtension(fileName) {
        return forEach(ts.supportedJavascriptExtensions, extension => fileExtensionIs(fileName, extension));
    }
    ts.hasJavaScriptFileExtension = hasJavaScriptFileExtension;
    function hasTypeScriptFileExtension(fileName) {
        return forEach(ts.supportedTypeScriptExtensions, extension => fileExtensionIs(fileName, extension));
    }
    ts.hasTypeScriptFileExtension = hasTypeScriptFileExtension;
    function isSupportedSourceFileName(fileName, compilerOptions, extraFileExtensions) {
        if (!fileName) {
            return false;
        }
        for (const extension of getSupportedExtensions(compilerOptions, extraFileExtensions)) {
            if (fileExtensionIs(fileName, extension)) {
                return true;
            }
        }
        return false;
    }
    ts.isSupportedSourceFileName = isSupportedSourceFileName;
    function getExtensionPriority(path, supportedExtensions) {
        for (let i = supportedExtensions.length - 1; i >= 0; i--) {
            if (fileExtensionIs(path, supportedExtensions[i])) {
                return adjustExtensionPriority(i, supportedExtensions);
            }
        }
        // If its not in the list of supported extensions, this is likely a
        // TypeScript file with a non-ts extension
        return 0 /* Highest */;
    }
    ts.getExtensionPriority = getExtensionPriority;
    /**
     * Adjusts an extension priority to be the highest priority within the same range.
     */
    function adjustExtensionPriority(extensionPriority, supportedExtensions) {
        if (extensionPriority < 2 /* DeclarationAndJavaScriptFiles */) {
            return 0 /* TypeScriptFiles */;
        }
        else if (extensionPriority < supportedExtensions.length) {
            return 2 /* DeclarationAndJavaScriptFiles */;
        }
        else {
            return supportedExtensions.length;
        }
    }
    ts.adjustExtensionPriority = adjustExtensionPriority;
    /**
     * Gets the next lowest extension priority for a given priority.
     */
    function getNextLowestExtensionPriority(extensionPriority, supportedExtensions) {
        if (extensionPriority < 2 /* DeclarationAndJavaScriptFiles */) {
            return 2 /* DeclarationAndJavaScriptFiles */;
        }
        else {
            return supportedExtensions.length;
        }
    }
    ts.getNextLowestExtensionPriority = getNextLowestExtensionPriority;
    const extensionsToRemove = [ts.Extension.Dts, ts.Extension.Ts, ts.Extension.Js, ts.Extension.Tsx, ts.Extension.Jsx];
    function removeFileExtension(path) {
        for (const ext of extensionsToRemove) {
            const extensionless = tryRemoveExtension(path, ext);
            if (extensionless !== undefined) {
                return extensionless;
            }
        }
        return path;
    }
    ts.removeFileExtension = removeFileExtension;
    function tryRemoveExtension(path, extension) {
        return fileExtensionIs(path, extension) ? removeExtension(path, extension) : undefined;
    }
    ts.tryRemoveExtension = tryRemoveExtension;
    function removeExtension(path, extension) {
        return path.substring(0, path.length - extension.length);
    }
    ts.removeExtension = removeExtension;
    function changeExtension(path, newExtension) {
        return (removeFileExtension(path) + newExtension);
    }
    ts.changeExtension = changeExtension;
    /**
     * Takes a string like "jquery-min.4.2.3" and returns "jquery"
     */
    function removeMinAndVersionNumbers(fileName) {
        // Match a "." or "-" followed by a version number or 'min' at the end of the name
        const trailingMinOrVersion = /[.-]((min)|(\d+(\.\d+)*))$/;
        // The "min" or version may both be present, in either order, so try applying the above twice.
        return fileName.replace(trailingMinOrVersion, "").replace(trailingMinOrVersion, "");
    }
    ts.removeMinAndVersionNumbers = removeMinAndVersionNumbers;
    function Symbol(flags, name) {
        this.flags = flags;
        this.escapedName = name;
        this.declarations = undefined;
        this.valueDeclaration = undefined;
        this.id = undefined;
        this.mergeId = undefined;
        this.parent = undefined;
    }
    function Type(checker, flags) {
        this.flags = flags;
        if (Debug.isDebugging) {
            this.checker = checker;
        }
    }
    function Signature() { } // tslint:disable-line no-empty
    function Node(kind, pos, end) {
        this.pos = pos;
        this.end = end;
        this.kind = kind;
        this.id = 0;
        this.flags = ts.NodeFlags.None;
        this.modifierFlagsCache = ts.ModifierFlags.None;
        this.transformFlags = 0 /* None */;
        this.parent = undefined;
        this.original = undefined;
    }
    function SourceMapSource(fileName, text, skipTrivia) {
        this.fileName = fileName;
        this.text = text;
        this.skipTrivia = skipTrivia || (pos => pos);
    }
    ts.objectAllocator = {
        getNodeConstructor: () => Node,
        getTokenConstructor: () => Node,
        getIdentifierConstructor: () => Node,
        getSourceFileConstructor: () => Node,
        getSymbolConstructor: () => Symbol,
        getTypeConstructor: () => Type,
        getSignatureConstructor: () => Signature,
        getSourceMapSourceConstructor: () => SourceMapSource,
    };
    let Debug;
    (function (Debug) {
        Debug.currentAssertionLevel = 0 /* None */;
        Debug.isDebugging = false;
        function shouldAssert(level) {
            return Debug.currentAssertionLevel >= level;
        }
        Debug.shouldAssert = shouldAssert;
        function assert(expression, message, verboseDebugInfo, stackCrawlMark) {
            if (!expression) {
                if (verboseDebugInfo) {
                    message += "\r\nVerbose Debug Information: " + (typeof verboseDebugInfo === "string" ? verboseDebugInfo : verboseDebugInfo());
                }
                fail(message ? "False expression: " + message : "False expression.", stackCrawlMark || assert);
            }
        }
        Debug.assert = assert;
        function assertEqual(a, b, msg, msg2) {
            if (a !== b) {
                const message = msg ? msg2 ? `${msg} ${msg2}` : msg : "";
                fail(`Expected ${a} === ${b}. ${message}`);
            }
        }
        Debug.assertEqual = assertEqual;
        function assertLessThan(a, b, msg) {
            if (a >= b) {
                fail(`Expected ${a} < ${b}. ${msg || ""}`);
            }
        }
        Debug.assertLessThan = assertLessThan;
        function assertLessThanOrEqual(a, b) {
            if (a > b) {
                fail(`Expected ${a} <= ${b}`);
            }
        }
        Debug.assertLessThanOrEqual = assertLessThanOrEqual;
        function assertGreaterThanOrEqual(a, b) {
            if (a < b) {
                fail(`Expected ${a} >= ${b}`);
            }
        }
        Debug.assertGreaterThanOrEqual = assertGreaterThanOrEqual;
        function fail(message, stackCrawlMark) {
            debugger;
            const e = new Error(message ? `Debug Failure. ${message}` : "Debug Failure.");
            if (Error.captureStackTrace) {
                Error.captureStackTrace(e, stackCrawlMark || fail);
            }
            throw e;
        }
        Debug.fail = fail;
        function assertDefined(value, message) {
            assert(value !== undefined && value !== null, message);
            return value;
        }
        Debug.assertDefined = assertDefined;
        function assertEachDefined(value, message) {
            for (const v of value) {
                assertDefined(v, message);
            }
            return value;
        }
        Debug.assertEachDefined = assertEachDefined;
        function assertNever(member, message, stackCrawlMark) {
            return fail(message || `Illegal value: ${member}`, stackCrawlMark || assertNever);
        }
        Debug.assertNever = assertNever;
        function getFunctionName(func) {
            if (typeof func !== "function") {
                return "";
            }
            else if (func.hasOwnProperty("name")) {
                return func.name;
            }
            else {
                const text = Function.prototype.toString.call(func);
                const match = /^function\s+([\w\$]+)\s*\(/.exec(text);
                return match ? match[1] : "";
            }
        }
        Debug.getFunctionName = getFunctionName;
        function showSymbol(symbol) {
            const symbolFlags = ts.SymbolFlags;
            return `{ flags: ${symbolFlags ? showFlags(symbol.flags, symbolFlags) : symbol.flags}; declarations: ${map(symbol.declarations, showSyntaxKind)} }`;
        }
        Debug.showSymbol = showSymbol;
        function showFlags(flags, flagsEnum) {
            const out = [];
            for (let pow = 0; pow <= 30; pow++) {
                const n = 1 << pow;
                if (flags & n) {
                    out.push(flagsEnum[n]);
                }
            }
            return out.join("|");
        }
        function showSyntaxKind(node) {
            const syntaxKind = ts.SyntaxKind;
            return syntaxKind ? syntaxKind[node.kind] : node.kind.toString();
        }
        Debug.showSyntaxKind = showSyntaxKind;
    })(Debug = ts.Debug || (ts.Debug = {}));
    /** Remove an item from an array, moving everything to its right one space left. */
    function orderedRemoveItem(array, item) {
        for (let i = 0; i < array.length; i++) {
            if (array[i] === item) {
                orderedRemoveItemAt(array, i);
                return true;
            }
        }
        return false;
    }
    ts.orderedRemoveItem = orderedRemoveItem;
    /** Remove an item by index from an array, moving everything to its right one space left. */
    function orderedRemoveItemAt(array, index) {
        // This seems to be faster than either `array.splice(i, 1)` or `array.copyWithin(i, i+ 1)`.
        for (let i = index; i < array.length - 1; i++) {
            array[i] = array[i + 1];
        }
        array.pop();
    }
    ts.orderedRemoveItemAt = orderedRemoveItemAt;
    function unorderedRemoveItemAt(array, index) {
        // Fill in the "hole" left at `index`.
        array[index] = array[array.length - 1];
        array.pop();
    }
    ts.unorderedRemoveItemAt = unorderedRemoveItemAt;
    /** Remove the *first* occurrence of `item` from the array. */
    function unorderedRemoveItem(array, item) {
        return unorderedRemoveFirstItemWhere(array, element => element === item);
    }
    ts.unorderedRemoveItem = unorderedRemoveItem;
    /** Remove the *first* element satisfying `predicate`. */
    function unorderedRemoveFirstItemWhere(array, predicate) {
        for (let i = 0; i < array.length; i++) {
            if (predicate(array[i])) {
                unorderedRemoveItemAt(array, i);
                return true;
            }
        }
        return false;
    }
    function createGetCanonicalFileName(useCaseSensitiveFileNames) {
        return useCaseSensitiveFileNames ? identity : toLowerCase;
    }
    ts.createGetCanonicalFileName = createGetCanonicalFileName;
    /**
     * patternStrings contains both pattern strings (containing "*") and regular strings.
     * Return an exact match if possible, or a pattern match, or undefined.
     * (These are verified by verifyCompilerOptions to have 0 or 1 "*" characters.)
     */
    function matchPatternOrExact(patternStrings, candidate) {
        const patterns = [];
        for (const patternString of patternStrings) {
            const pattern = tryParsePattern(patternString);
            if (pattern) {
                patterns.push(pattern);
            }
            else if (patternString === candidate) {
                // pattern was matched as is - no need to search further
                return patternString;
            }
        }
        return findBestPatternMatch(patterns, _ => _, candidate);
    }
    ts.matchPatternOrExact = matchPatternOrExact;
    function patternText({ prefix, suffix }) {
        return `${prefix}*${suffix}`;
    }
    ts.patternText = patternText;
    /**
     * Given that candidate matches pattern, returns the text matching the '*'.
     * E.g.: matchedText(tryParsePattern("foo*baz"), "foobarbaz") === "bar"
     */
    function matchedText(pattern, candidate) {
        Debug.assert(isPatternMatch(pattern, candidate));
        return candidate.substring(pattern.prefix.length, candidate.length - pattern.suffix.length);
    }
    ts.matchedText = matchedText;
    /** Return the object corresponding to the best pattern to match `candidate`. */
    function findBestPatternMatch(values, getPattern, candidate) {
        let matchedValue;
        // use length of prefix as betterness criteria
        let longestMatchPrefixLength = -1;
        for (const v of values) {
            const pattern = getPattern(v);
            if (isPatternMatch(pattern, candidate) && pattern.prefix.length > longestMatchPrefixLength) {
                longestMatchPrefixLength = pattern.prefix.length;
                matchedValue = v;
            }
        }
        return matchedValue;
    }
    ts.findBestPatternMatch = findBestPatternMatch;
    function isPatternMatch({ prefix, suffix }, candidate) {
        return candidate.length >= prefix.length + suffix.length &&
            startsWith(candidate, prefix) &&
            endsWith(candidate, suffix);
    }
    function tryParsePattern(pattern) {
        // This should be verified outside of here and a proper error thrown.
        Debug.assert(hasZeroOrOneAsteriskCharacter(pattern));
        const indexOfStar = pattern.indexOf("*");
        return indexOfStar === -1 ? undefined : {
            prefix: pattern.substr(0, indexOfStar),
            suffix: pattern.substr(indexOfStar + 1)
        };
    }
    ts.tryParsePattern = tryParsePattern;
    function positionIsSynthesized(pos) {
        // This is a fast way of testing the following conditions:
        //  pos === undefined || pos === null || isNaN(pos) || pos < 0;
        return !(pos >= 0);
    }
    ts.positionIsSynthesized = positionIsSynthesized;
    /** True if an extension is one of the supported TypeScript extensions. */
    function extensionIsTypeScript(ext) {
        return ext === ts.Extension.Ts || ext === ts.Extension.Tsx || ext === ts.Extension.Dts;
    }
    ts.extensionIsTypeScript = extensionIsTypeScript;
    /**
     * Gets the extension from a path.
     * Path must have a valid extension.
     */
    function extensionFromPath(path) {
        const ext = tryGetExtensionFromPath(path);
        if (ext !== undefined) {
            return ext;
        }
        Debug.fail(`File ${path} has unknown extension.`);
    }
    ts.extensionFromPath = extensionFromPath;
    function isAnySupportedFileExtension(path) {
        return tryGetExtensionFromPath(path) !== undefined;
    }
    ts.isAnySupportedFileExtension = isAnySupportedFileExtension;
    function tryGetExtensionFromPath(path) {
        return find(ts.supportedTypescriptExtensionsForExtractExtension, e => fileExtensionIs(path, e)) || find(ts.supportedJavascriptExtensions, e => fileExtensionIs(path, e));
    }
    ts.tryGetExtensionFromPath = tryGetExtensionFromPath;
    // Retrieves any string from the final "." onwards from a base file name.
    // Unlike extensionFromPath, which throws an exception on unrecognized extensions.
    function getAnyExtensionFromPath(path) {
        const baseFileName = getBaseFileName(path);
        const extensionIndex = baseFileName.lastIndexOf(".");
        if (extensionIndex >= 0) {
            return baseFileName.substring(extensionIndex);
        }
    }
    ts.getAnyExtensionFromPath = getAnyExtensionFromPath;
    function isCheckJsEnabledForFile(sourceFile, compilerOptions) {
        return sourceFile.checkJsDirective ? sourceFile.checkJsDirective.enabled : compilerOptions.checkJs;
    }
    ts.isCheckJsEnabledForFile = isCheckJsEnabledForFile;
    function and(f, g) {
        return (arg) => f(arg) && g(arg);
    }
    ts.and = and;
    function or(f, g) {
        return arg => f(arg) || g(arg);
    }
    ts.or = or;
    function assertTypeIsNever(_) { } // tslint:disable-line no-empty
    ts.assertTypeIsNever = assertTypeIsNever;
    ts.emptyFileSystemEntries = {
        files: ts.emptyArray,
        directories: ts.emptyArray
    };
    function singleElementArray(t) {
        return t === undefined ? undefined : [t];
    }
    ts.singleElementArray = singleElementArray;
    function enumerateInsertsAndDeletes(newItems, oldItems, comparer, inserted, deleted, unchanged) {
        unchanged = unchanged || noop;
        let newIndex = 0;
        let oldIndex = 0;
        const newLen = newItems.length;
        const oldLen = oldItems.length;
        while (newIndex < newLen && oldIndex < oldLen) {
            const newItem = newItems[newIndex];
            const oldItem = oldItems[oldIndex];
            const compareResult = comparer(newItem, oldItem);
            if (compareResult === -1 /* LessThan */) {
                inserted(newItem);
                newIndex++;
            }
            else if (compareResult === 1 /* GreaterThan */) {
                deleted(oldItem);
                oldIndex++;
            }
            else {
                unchanged(oldItem, newItem);
                newIndex++;
                oldIndex++;
            }
        }
        while (newIndex < newLen) {
            inserted(newItems[newIndex++]);
        }
        while (oldIndex < oldLen) {
            deleted(oldItems[oldIndex++]);
        }
    }
    ts.enumerateInsertsAndDeletes = enumerateInsertsAndDeletes;
})(ts || (ts = {}));
