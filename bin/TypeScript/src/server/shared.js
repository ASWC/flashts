var ts;
(function (ts) {
    var server;
    (function (server) {
        // tslint:disable variable-name
        server.ActionSet = "action::set";
        server.ActionInvalidate = "action::invalidate";
        server.ActionPackageInstalled = "action::packageInstalled";
        server.EventTypesRegistry = "event::typesRegistry";
        server.EventBeginInstallTypes = "event::beginInstallTypes";
        server.EventEndInstallTypes = "event::endInstallTypes";
        server.EventInitializationFailed = "event::initializationFailed";
        let Arguments;
        (function (Arguments) {
            Arguments.GlobalCacheLocation = "--globalTypingsCacheLocation";
            Arguments.LogFile = "--logFile";
            Arguments.EnableTelemetry = "--enableTelemetry";
            Arguments.TypingSafeListLocation = "--typingSafeListLocation";
            Arguments.TypesMapLocation = "--typesMapLocation";
            /**
             * This argument specifies the location of the NPM executable.
             * typingsInstaller will run the command with `${npmLocation} install ...`.
             */
            Arguments.NpmLocation = "--npmLocation";
        })(Arguments = server.Arguments || (server.Arguments = {}));
        function hasArgument(argumentName) {
            return ts.sys.args.indexOf(argumentName) >= 0;
        }
        server.hasArgument = hasArgument;
        function findArgument(argumentName) {
            const index = ts.sys.args.indexOf(argumentName);
            return index >= 0 && index < ts.sys.args.length - 1
                ? ts.sys.args[index + 1]
                : undefined;
        }
        server.findArgument = findArgument;
        /*@internal*/
        function nowString() {
            // E.g. "12:34:56.789"
            const d = new Date();
            return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`;
        }
        server.nowString = nowString;
    })(server = ts.server || (ts.server = {}));
})(ts || (ts = {}));
