"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
var scope;
const TIME_ACTIVITY = 1;
class Main {
    constructor() {
        this.bigFilesMap = new Map();
        this.directoriesToDelete = new Array();
    }
    start() {
        scope.srcFolder = process.argv[2];
        scope.dstFolder = process.argv[3];
        let npid = require('npid');
        let pidFileName = process.platform === 'win32' ? 'C:/Temp/clonedirs.pid' : '/var/run/clonedirs.pid';
        try {
            let pid = npid.create(pidFileName);
            pid.removeOnExit();
        }
        catch (err) {
            try {
                process.kill(parseInt(fs.readFileSync(pidFileName, 'utf8')), 0);
                console.log(err);
                process.exit(1);
            }
            catch (err) {
                fs.unlinkSync(pidFileName);
                let pid = npid.create(pidFileName);
                pid.removeOnExit();
            }
        }
        scope.walkScanDest(scope.dstFolder);
        scope.walkDelete(scope.dstFolder);
        scope.walkCopy(scope.srcFolder);
        // check candidate directories for deletion and remove them is not present in source
        scope.directoriesToDelete.forEach(dir => {
            if (!fs.existsSync(dir.replace(scope.dstFolder, scope.srcFolder))) {
                try {
                    fs.rmdirSync(dir);
                }
                catch (e) {
                }
            }
        });
        process.exit(0);
    }
    compareFiles(src, dst) {
        var statSrc = fs.statSync(src);
        if (!fs.existsSync(dst))
            return true;
        var statDst = fs.statSync(dst);
        return ((statSrc.size !== statDst.size) || (statDst.mtime.getTime() < statSrc.mtime.getTime())) && (new Date().getTime() - statSrc.mtime.getTime() > TIME_ACTIVITY * 60 * 1000);
    }
    walkCopy(dir) {
        var results = [];
        var list = fs.readdirSync(dir);
        var oneFileHasChanged = false;
        for (let file of list) {
            file = dir + '/' + file;
            let stat = fs.statSync(file);
            if (stat.isFile()) {
                if (new Date().getTime() - stat.mtime.getTime() < TIME_ACTIVITY * 60 * 1000) {
                    oneFileHasChanged = true;
                    break;
                }
            }
        }
        for (let file of list) {
            file = dir + '/' + file;
            let stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                let dstFolder = file.replace(scope.srcFolder, scope.dstFolder);
                if (!fs.existsSync(dstFolder)) {
                    fs.mkdirSync(dstFolder);
                }
                scope.walkCopy(file);
            }
            else {
                let dstFile = file.replace(scope.srcFolder, scope.dstFolder);
                if (!oneFileHasChanged && scope.compareFiles(file, dstFile)) {
                    let fileName = file.substr(file.lastIndexOf('/') + 1);
                    let destObject = this.bigFilesMap.get(fileName);
                    if (destObject && destObject.size === stat.size && destObject.file != dstFile) {
                        console.log('move file', destObject.file, dstFile);
                        try {
                            if (!fs.existsSync(dstFile)) {
                                fs.unlinkSync(dstFile);
                            }
                        }
                        catch (e) {
                            console.error(e);
                        }
                        fs.renameSync(destObject.file, dstFile);
                    }
                    else {
                        console.log('copy file', file, dstFile);
                        this.copyFileSync(file, dstFile);
                    }
                }
            }
        }
        return results;
    }
    copyFileSync(srcFile, destFile) {
        let BUF_LENGTH = 10 * 1024 * 1024;
        let buff = new Buffer(BUF_LENGTH);
        let fdr = fs.openSync(srcFile, 'r');
        let fdw = fs.openSync(destFile, 'w');
        let bytesRead = 1;
        let pos = 0;
        while (bytesRead > 0) {
            bytesRead = fs.readSync(fdr, buff, 0, BUF_LENGTH, pos);
            fs.writeSync(fdw, buff, 0, bytesRead);
            pos += bytesRead;
        }
        fs.closeSync(fdr);
        fs.closeSync(fdw);
    }
    /* remove file no longer present in destination folder */
    walkDelete(dir) {
        let results = [];
        let list = fs.readdirSync(dir);
        let removedAll = true;
        for (let file of list) {
            file = dir + '/' + file;
            let stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                scope.walkDelete(file);
                removedAll = false;
            }
            else {
                let srcFile = file.replace(scope.dstFolder, scope.srcFolder);
                let fileName = file.substr(file.lastIndexOf('/') + 1);
                let destObject = this.bigFilesMap.get(fileName);
                // do not delete if file will be moved
                if (destObject && destObject.size === stat.size && destObject.file != file) {
                    removedAll = false;
                }
                else if (!fs.existsSync(srcFile)) {
                    fs.unlinkSync(file);
                }
                else {
                    removedAll = false;
                }
            }
        }
        if (removedAll) {
            this.directoriesToDelete.push(dir);
        }
        return results;
    }
    /* scan to find the big files that could be moved in destination instead of copied */
    walkScanDest(dir) {
        var results = [];
        var list = fs.readdirSync(dir);
        for (let file of list) {
            file = dir + '/' + file;
            let stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                scope.walkScanDest(file);
            }
            else {
                let fileName = file.substr(file.lastIndexOf('/') + 1);
                if (stat.size > 10000000 && fileName.length > 10) {
                    this.bigFilesMap.set(fileName, { 'file': file, 'size': stat.size });
                }
            }
        }
        return results;
    }
}
scope = new Main();
scope.start();
//# sourceMappingURL=index.js.map