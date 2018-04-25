var Harness;
(function (Harness) {
    var Parallel;
    (function (Parallel) {
        var Worker;
        (function (Worker) {
            let errors = [];
            let passing = 0;
            function resetShimHarnessAndExecute(runner) {
                errors = [];
                passing = 0;
                testList.length = 0;
                const start = +(new Date());
                runner.initializeTests();
                testList.forEach(({ name, callback, kind }) => executeCallback(name, callback, kind));
                return { errors, passing, duration: +(new Date()) - start };
            }
            let beforeEachFunc;
            const namestack = [];
            let testList = [];
            function shimMochaHarness() {
                global.before = undefined;
                global.after = undefined;
                global.beforeEach = undefined;
                global.describe = ((name, callback) => {
                    testList.push({ name, callback, kind: "suite" });
                });
                global.it = ((name, callback) => {
                    if (!testList) {
                        throw new Error("Tests must occur within a describe block");
                    }
                    testList.push({ name, callback, kind: "test" });
                });
            }
            function setTimeoutAndExecute(timeout, f) {
                if (timeout !== undefined) {
                    const timeoutMsg = { type: "timeout", payload: { duration: timeout } };
                    process.send(timeoutMsg);
                }
                f();
                if (timeout !== undefined) {
                    // Reset timeout
                    const timeoutMsg = { type: "timeout", payload: { duration: "reset" } };
                    process.send(timeoutMsg);
                }
            }
            function executeSuiteCallback(name, callback) {
                let timeout;
                const fakeContext = {
                    retries() { return this; },
                    slow() { return this; },
                    timeout(n) {
                        timeout = n;
                        return this;
                    },
                };
                namestack.push(name);
                let beforeFunc;
                before = (cb) => beforeFunc = cb;
                let afterFunc;
                after = (cb) => afterFunc = cb;
                const savedBeforeEach = beforeEachFunc;
                beforeEach = (cb) => beforeEachFunc = cb;
                const savedTestList = testList;
                testList = [];
                try {
                    callback.call(fakeContext);
                }
                catch (e) {
                    errors.push({ error: `Error executing suite: ${e.message}`, stack: e.stack, name: [...namestack] });
                    return cleanup();
                }
                try {
                    if (beforeFunc) {
                        beforeFunc();
                    }
                }
                catch (e) {
                    errors.push({ error: `Error executing before function: ${e.message}`, stack: e.stack, name: [...namestack] });
                    return cleanup();
                }
                finally {
                    beforeFunc = undefined;
                }
                setTimeoutAndExecute(timeout, () => {
                    testList.forEach(({ name, callback, kind }) => executeCallback(name, callback, kind));
                });
                try {
                    if (afterFunc) {
                        afterFunc();
                    }
                }
                catch (e) {
                    errors.push({ error: `Error executing after function: ${e.message}`, stack: e.stack, name: [...namestack] });
                }
                finally {
                    afterFunc = undefined;
                    cleanup();
                }
                function cleanup() {
                    testList.length = 0;
                    testList = savedTestList;
                    beforeEachFunc = savedBeforeEach;
                    namestack.pop();
                }
            }
            function executeCallback(name, callback, kind) {
                if (kind === "suite") {
                    executeSuiteCallback(name, callback);
                }
                else {
                    executeTestCallback(name, callback);
                }
            }
            function executeTestCallback(name, callback) {
                let timeout;
                const fakeContext = {
                    skip() { return this; },
                    timeout(n) {
                        timeout = n;
                        const timeoutMsg = { type: "timeout", payload: { duration: timeout } };
                        process.send(timeoutMsg);
                        return this;
                    },
                    retries() { return this; },
                    slow() { return this; },
                };
                namestack.push(name);
                if (beforeEachFunc) {
                    try {
                        beforeEachFunc();
                    }
                    catch (error) {
                        errors.push({ error: error.message, stack: error.stack, name: [...namestack] });
                        namestack.pop();
                        return;
                    }
                }
                if (callback.length === 0) {
                    try {
                        // TODO: If we ever start using async test completions, polyfill promise return handling
                        callback.call(fakeContext);
                    }
                    catch (error) {
                        errors.push({ error: error.message, stack: error.stack, name: [...namestack] });
                        return;
                    }
                    finally {
                        namestack.pop();
                        if (timeout !== undefined) {
                            const timeoutMsg = { type: "timeout", payload: { duration: "reset" } };
                            process.send(timeoutMsg);
                        }
                    }
                    passing++;
                }
                else {
                    // Uses `done` callback
                    let completed = false;
                    try {
                        callback.call(fakeContext, (err) => {
                            if (completed) {
                                throw new Error(`done() callback called multiple times; ensure it is only called once.`);
                            }
                            if (err) {
                                errors.push({ error: err.toString(), stack: "", name: [...namestack] });
                            }
                            else {
                                passing++;
                            }
                            completed = true;
                        });
                    }
                    catch (error) {
                        errors.push({ error: error.message, stack: error.stack, name: [...namestack] });
                        return;
                    }
                    finally {
                        namestack.pop();
                        if (timeout !== undefined) {
                            const timeoutMsg = { type: "timeout", payload: { duration: "reset" } };
                            process.send(timeoutMsg);
                        }
                    }
                    if (!completed) {
                        errors.push({ error: "Test completes asynchronously, which is unsupported by the parallel harness", stack: "", name: [...namestack] });
                    }
                }
            }
            function start() {
                let initialized = false;
                const runners = ts.createMap();
                process.on("message", (data) => {
                    if (!initialized) {
                        initialized = true;
                        shimMochaHarness();
                    }
                    switch (data.type) {
                        case "test":
                            const { runner, file } = data.payload;
                            if (!runner) {
                                console.error(data);
                            }
                            const message = { type: "result", payload: handleTest(runner, file) };
                            process.send(message);
                            break;
                        case "close":
                            process.exit(0);
                            break;
                        case "batch": {
                            const items = data.payload;
                            for (let i = 0; i < items.length; i++) {
                                const { runner, file } = items[i];
                                if (!runner) {
                                    console.error(data);
                                }
                                let message;
                                const payload = handleTest(runner, file);
                                if (i === (items.length - 1)) {
                                    message = { type: "result", payload };
                                }
                                else {
                                    message = { type: "progress", payload };
                                }
                                process.send(message);
                            }
                            break;
                        }
                    }
                });
                process.on("uncaughtException", error => {
                    const message = { type: "error", payload: { error: error.message, stack: error.stack, name: [...namestack] } };
                    try {
                        process.send(message);
                    }
                    catch (e) {
                        console.error(error);
                        throw error;
                    }
                });
                if (!runUnitTests) {
                    // ensure unit tests do not get run
                    global.describe = ts.noop;
                }
                else {
                    initialized = true;
                    shimMochaHarness();
                }
                function handleTest(runner, file) {
                    collectUnitTestsIfNeeded();
                    if (runner === unittest) {
                        return executeUnitTest(file);
                    }
                    else {
                        if (!runners.has(runner)) {
                            runners.set(runner, createRunner(runner));
                        }
                        const instance = runners.get(runner);
                        instance.tests = [file];
                        return Object.assign({}, resetShimHarnessAndExecute(instance), { runner, file });
                    }
                }
            }
            Worker.start = start;
            const unittest = "unittest";
            let unitTests;
            function collectUnitTestsIfNeeded() {
                if (!unitTests && testList.length) {
                    unitTests = {};
                    for (const test of testList) {
                        unitTests[test.name] = test.callback;
                    }
                    testList.length = 0;
                }
            }
            function executeUnitTest(name) {
                if (!unitTests) {
                    throw new Error(`Asked to run unit test ${name}, but no unit tests were discovered!`);
                }
                if (unitTests[name]) {
                    errors = [];
                    passing = 0;
                    const start = +(new Date());
                    executeSuiteCallback(name, unitTests[name]);
                    delete unitTests[name];
                    return { file: name, runner: unittest, errors, passing, duration: +(new Date()) - start };
                }
                throw new Error(`Unit test with name "${name}" was asked to be run, but such a test does not exist!`);
            }
        })(Worker = Parallel.Worker || (Parallel.Worker = {}));
    })(Parallel = Harness.Parallel || (Harness.Parallel = {}));
})(Harness || (Harness = {}));
