/* @internal */
var ts;
(function (ts) {
    function stringToInt(str) {
        const n = parseInt(str, 10);
        if (isNaN(n)) {
            throw new Error(`Error in parseInt(${JSON.stringify(str)})`);
        }
        return n;
    }
    const isPrereleaseRegex = /^(.*)-next.\d+/;
    const prereleaseSemverRegex = /^(\d+)\.(\d+)\.0-next.(\d+)$/;
    const semverRegex = /^(\d+)\.(\d+)\.(\d+)$/;
    class Semver {
        constructor(major, minor, patch, 
        /**
         * If true, this is `major.minor.0-next.patch`.
         * If false, this is `major.minor.patch`.
         */
        isPrerelease) {
            this.major = major;
            this.minor = minor;
            this.patch = patch;
            this.isPrerelease = isPrerelease;
        }
        static parse(semver) {
            const isPrerelease = isPrereleaseRegex.test(semver);
            const result = Semver.tryParse(semver, isPrerelease);
            if (!result) {
                throw new Error(`Unexpected semver: ${semver} (isPrerelease: ${isPrerelease})`);
            }
            return result;
        }
        static fromRaw({ major, minor, patch, isPrerelease }) {
            return new Semver(major, minor, patch, isPrerelease);
        }
        // This must parse the output of `versionString`.
        static tryParse(semver, isPrerelease) {
            // Per the semver spec <http://semver.org/#spec-item-2>:
            // "A normal version number MUST take the form X.Y.Z where X, Y, and Z are non-negative integers, and MUST NOT contain leading zeroes."
            const rgx = isPrerelease ? prereleaseSemverRegex : semverRegex;
            const match = rgx.exec(semver);
            return match ? new Semver(stringToInt(match[1]), stringToInt(match[2]), stringToInt(match[3]), isPrerelease) : undefined;
        }
        get versionString() {
            return this.isPrerelease ? `${this.major}.${this.minor}.0-next.${this.patch}` : `${this.major}.${this.minor}.${this.patch}`;
        }
        equals(sem) {
            return this.major === sem.major && this.minor === sem.minor && this.patch === sem.patch && this.isPrerelease === sem.isPrerelease;
        }
        greaterThan(sem) {
            return this.major > sem.major || this.major === sem.major
                && (this.minor > sem.minor || this.minor === sem.minor
                    && (!this.isPrerelease && sem.isPrerelease || this.isPrerelease === sem.isPrerelease
                        && this.patch > sem.patch));
        }
    }
    ts.Semver = Semver;
})(ts || (ts = {}));
