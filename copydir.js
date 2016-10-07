"use strict";
const fs = require('fs');
var scope;
class Main {
    constructor() {
    }
    start() {
        scope.srcFolder = process.argv[2];
        scope.dstFolder = process.argv[3];
        scope.walk(scope.srcFolder);
    }
    compareFiles(src, dst) {
        var statSrc = fs.statSync(src);
        if (!fs.existsSync(dst))
            return true;
        var statDst = fs.statSync(dst);
        return (statSrc.size !== statDst.size) && (new Date().getTime() - statDst.mtime.getTime() > 30 * 60 * 1000);
    }
    walk(dir) {
        var results = [];
        var list = fs.readdirSync(dir);
        list.forEach(function (file) {
            file = dir + '/' + file;
            var stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                let dstFolder = file.replace(scope.srcFolder, scope.dstFolder);
                if (!fs.existsSync(dstFolder)) {
                    fs.mkdirSync(dstFolder);
                }
                scope.walk(file);
            }
            else {
                let dstFile = file.replace(scope.srcFolder, scope.dstFolder);
                if (scope.compareFiles(file, dstFile)) {
                    fs.createReadStream(file).pipe(fs.createWriteStream(dstFile));
                }
            }
        });
        return results;
    }
}
scope = new Main();
scope.start();
//# sourceMappingURL=app.js.map