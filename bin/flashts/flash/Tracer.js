define(["require", "exports"], function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    class Tracer {
        static revealMethods(value) {
            try {
                if (!value) {
                    var result = "reveal methods: null";
                }
                else {
                    var result = "reveal methods: ";
                }
                for (var key in value) {
                    var instanceItem = value[key];
                    if (instanceItem instanceof Function) {
                        result += 'method: ' + key + ' : ' + value[key] + "\n";
                    }
                }
                if (Tracer.WATCHER) {
                    Tracer.WATCHER.watch(result);
                }
                Tracer.DUMP.push(result);
                console.log(result);
            }
            catch (e) {
            }
        }
        static reveal(value) {
            if (!value) {
                var result = "reveal: null";
                console.log(result);
                return;
            }
            if (value === undefined) {
                var result = "reveal: undefined";
                console.log(result);
                return;
            }
            var result = "reveal: ";
            for (var key in value) {
                //console.log(key)
                var instanceItem = Tracer.getValue(key, value);
                if (instanceItem) {
                    if (instanceItem instanceof Function) {
                        result += 'method: ' + key + "\n";
                    }
                    else {
                        try {
                            result += key + ' : ' + instanceItem + "\n";
                        }
                        catch (e) {
                        }
                    }
                }
            }
            if (Tracer.WATCHER) {
                Tracer.WATCHER.watch(result);
            }
            Tracer.DUMP.push(result);
            console.log(result);
        }
        static getValue(key, value) {
            var valueResult = null;
            try {
                valueResult = value[key];
            }
            catch (e) {
            }
            return valueResult;
        }
        static show(value) {
            try {
                if (!value) {
                    var result = "show: null";
                }
                else {
                    var result = "show: " + value.toString();
                }
                if (Tracer.WATCHER) {
                    Tracer.WATCHER.watch(result);
                }
                Tracer.DUMP.push(result);
                console.log(result);
            }
            catch (e) {
            }
        }
        static clear() {
            Tracer.DUMP = [];
        }
    }
    Tracer.DUMP = [];
    exports.Tracer = Tracer;
    class Watcher {
        watch(value) {
        }
    }
});
//# sourceMappingURL=Tracer.js.map