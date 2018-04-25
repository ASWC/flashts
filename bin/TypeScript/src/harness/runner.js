//
// Copyright (c) Microsoft Corporation.  All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
/// <reference path="test262Runner.ts" />
/// <reference path="compilerRunner.ts" />
/// <reference path="fourslashRunner.ts" />
/// <reference path="projectsRunner.ts" />
/// <reference path="rwcRunner.ts" />
/// <reference path="externalCompileRunner.ts" />
/// <reference path="harness.ts" />
/// <reference path="./parallel/shared.ts" />
let runners = [];
let iterations = 1;
function runTests(runners) {
    for (let i = iterations; i > 0; i--) {
        for (const runner of runners) {
            runner.initializeTests();
        }
    }
}
function tryGetConfig(args) {
    const prefix = "--config=";
    const configPath = ts.forEach(args, arg => arg.lastIndexOf(prefix, 0) === 0 && arg.substr(prefix.length));
    // strip leading and trailing quotes from the path (necessary on Windows since shell does not do it automatically)
    return configPath && configPath.replace(/(^[\"'])|([\"']$)/g, "");
}
function createRunner(kind) {
    switch (kind) {
        case "conformance":
            return new CompilerBaselineRunner(0 /* Conformance */);
        case "compiler":
            return new CompilerBaselineRunner(1 /* Regressions */);
        case "fourslash":
            return new FourSlashRunner(0 /* Native */);
        case "fourslash-shims":
            return new FourSlashRunner(1 /* Shims */);
        case "fourslash-shims-pp":
            return new FourSlashRunner(2 /* ShimsWithPreprocess */);
        case "fourslash-server":
            return new FourSlashRunner(3 /* Server */);
        case "project":
            return new ProjectRunner();
        case "rwc":
            return new RWCRunner();
        case "test262":
            return new Test262BaselineRunner();
        case "user":
            return new UserCodeRunner();
        case "dt":
            return new DefinitelyTypedRunner();
    }
    ts.Debug.fail(`Unknown runner kind ${kind}`);
}
if (Harness.IO.tryEnableSourceMapsForHost && /^development$/i.test(Harness.IO.getEnvironmentVariable("NODE_ENV"))) {
    Harness.IO.tryEnableSourceMapsForHost();
}
// users can define tests to run in mytest.config that will override cmd line args, otherwise use cmd line args (test.config), otherwise no options
const mytestconfigFileName = "mytest.config";
const testconfigFileName = "test.config";
const customConfig = tryGetConfig(Harness.IO.args());
let testConfigContent = customConfig && Harness.IO.fileExists(customConfig)
    ? Harness.IO.readFile(customConfig)
    : Harness.IO.fileExists(mytestconfigFileName)
        ? Harness.IO.readFile(mytestconfigFileName)
        : Harness.IO.fileExists(testconfigFileName) ? Harness.IO.readFile(testconfigFileName) : "";
let taskConfigsFolder;
let workerCount;
let runUnitTests;
let stackTraceLimit;
let noColors = false;
let configOption;
let globalTimeout;
function handleTestConfig() {
    if (testConfigContent !== "") {
        const testConfig = JSON.parse(testConfigContent);
        if (testConfig.light) {
            Harness.lightMode = true;
        }
        if (testConfig.timeout) {
            globalTimeout = testConfig.timeout;
        }
        runUnitTests = testConfig.runUnitTests;
        if (testConfig.workerCount) {
            workerCount = +testConfig.workerCount;
        }
        if (testConfig.taskConfigsFolder) {
            taskConfigsFolder = testConfig.taskConfigsFolder;
        }
        if (testConfig.noColors !== undefined) {
            noColors = testConfig.noColors;
        }
        if (testConfig.stackTraceLimit === "full") {
            Error.stackTraceLimit = Infinity;
            stackTraceLimit = testConfig.stackTraceLimit;
        }
        else if ((+testConfig.stackTraceLimit | 0) > 0) {
            Error.stackTraceLimit = +testConfig.stackTraceLimit | 0;
            stackTraceLimit = +testConfig.stackTraceLimit | 0;
        }
        if (testConfig.listenForWork) {
            return true;
        }
        const runnerConfig = testConfig.runners || testConfig.test;
        if (runnerConfig && runnerConfig.length > 0) {
            for (const option of runnerConfig) {
                if (!option) {
                    continue;
                }
                if (!configOption) {
                    configOption = option;
                }
                else {
                    configOption += "+" + option;
                }
                switch (option) {
                    case "compiler":
                        runners.push(new CompilerBaselineRunner(0 /* Conformance */));
                        runners.push(new CompilerBaselineRunner(1 /* Regressions */));
                        runners.push(new ProjectRunner());
                        break;
                    case "conformance":
                        runners.push(new CompilerBaselineRunner(0 /* Conformance */));
                        break;
                    case "project":
                        runners.push(new ProjectRunner());
                        break;
                    case "fourslash":
                        runners.push(new FourSlashRunner(0 /* Native */));
                        break;
                    case "fourslash-shims":
                        runners.push(new FourSlashRunner(1 /* Shims */));
                        break;
                    case "fourslash-shims-pp":
                        runners.push(new FourSlashRunner(2 /* ShimsWithPreprocess */));
                        break;
                    case "fourslash-server":
                        runners.push(new FourSlashRunner(3 /* Server */));
                        break;
                    case "fourslash-generated":
                        runners.push(new GeneratedFourslashRunner(0 /* Native */));
                        break;
                    case "rwc":
                        runners.push(new RWCRunner());
                        break;
                    case "test262":
                        runners.push(new Test262BaselineRunner());
                        break;
                    case "user":
                        runners.push(new UserCodeRunner());
                        break;
                    case "dt":
                        runners.push(new DefinitelyTypedRunner());
                        break;
                }
            }
        }
    }
    if (runners.length === 0) {
        // compiler
        runners.push(new CompilerBaselineRunner(0 /* Conformance */));
        runners.push(new CompilerBaselineRunner(1 /* Regressions */));
        // TODO: project tests don"t work in the browser yet
        if (Utils.getExecutionEnvironment() !== 1 /* Browser */) {
            runners.push(new ProjectRunner());
        }
        // language services
        runners.push(new FourSlashRunner(0 /* Native */));
        runners.push(new FourSlashRunner(1 /* Shims */));
        runners.push(new FourSlashRunner(2 /* ShimsWithPreprocess */));
        runners.push(new FourSlashRunner(3 /* Server */));
        // runners.push(new GeneratedFourslashRunner());
        // CRON-only tests
        if (Utils.getExecutionEnvironment() !== 1 /* Browser */ && process.env.TRAVIS_EVENT_TYPE === "cron") {
            runners.push(new UserCodeRunner());
        }
    }
    if (runUnitTests === undefined) {
        runUnitTests = runners.length !== 1; // Don't run unit tests when running only one runner if unit tests were not explicitly asked for
    }
}
function beginTests() {
    if (ts.Debug.isDebugging) {
        ts.Debug.enableDebugInfo();
    }
    // run tests in en-US by default.
    let savedUILocale;
    beforeEach(() => {
        savedUILocale = ts.getUILocale();
        ts.setUILocale("en-US");
    });
    afterEach(() => ts.setUILocale(savedUILocale));
    runTests(runners);
    if (!runUnitTests) {
        // patch `describe` to skip unit tests
        global.describe = ts.noop;
    }
}
let isWorker;
function startTestEnvironment() {
    isWorker = handleTestConfig();
    if (Utils.getExecutionEnvironment() !== 1 /* Browser */) {
        if (isWorker) {
            return Harness.Parallel.Worker.start();
        }
        else if (taskConfigsFolder && workerCount && workerCount > 1) {
            return Harness.Parallel.Host.start();
        }
    }
    beginTests();
}
startTestEnvironment();
