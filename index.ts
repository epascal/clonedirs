import * as fs from 'fs';

var scope: Main;
const TIME_ACTIVITY: number = 1;

class Main {
  srcFolder: string;
  dstFolder: string;
  bigFilesMapSrc: Map<string, Object> = new Map<string, Object>();
  bigFilesMapDest: Map<string, Object> = new Map<string, Object>();
  directoriesToDelete: Array<string> = new Array<string>();

  constructor() {
  }

  start() {
    if (process.argv.length < 4) {
      console.error("Usage: \nclonedirs source_folder target_folder");
      process.exit(1);
    }
    scope.srcFolder = process.argv[2];
    scope.dstFolder = process.argv[3];
    let npid = require('npid');
    let pidFileName = process.platform === 'win32' ? 'C:/Temp/clonedirs.pid' : '/tmp/clonedirs.pid';

    try {
      let pid = npid.create(pidFileName);
      pid.removeOnExit();
    } catch (err) {
      try {
        process.kill(parseInt(fs.readFileSync(pidFileName, 'utf8')), 0);
        console.error(err);
        process.exit(1);
      } catch (err) {
        try {
          fs.unlinkSync(pidFileName);
        } catch (err2) {
        }
        let pid = npid.create(pidFileName);
        pid.removeOnExit();
      }
    }

    console.log('Scanning source folder...');
    scope.walkScanSrc(scope.srcFolder);
    console.log('Scanning destination folder...');
    scope.walkScanDest(scope.dstFolder);
    console.log('Deleting files in destination...');
    scope.walkDelete(scope.dstFolder);
    console.log('Copying small files to destination or moving displaced big files in destination...');
    scope.walkCopy(scope.srcFolder);
    // check candidate directories for deletion and remove them is not present in source
    scope.directoriesToDelete.forEach(dir => {
      if (!fs.existsSync(dir.replace(scope.dstFolder, scope.srcFolder))) {
        try {
          fs.rmdirSync(dir);
        } catch (e) {

        }
      }
    });

    process.exit(0);
  }

  compareFiles(src: string, dst: string): boolean {
    var statSrc = fs.statSync(src);
    if (!fs.existsSync(dst)) return true;
    var statDst = fs.statSync(dst);
    return ((statSrc.size !== statDst.size) || (statDst.mtime.getTime() < statSrc.mtime.getTime())) && (new Date().getTime() - statSrc.mtime.getTime() > TIME_ACTIVITY * 60 * 1000);
  }

  walkCopy(dir: string): string[] {
    var results: string[] = [];
    var list = fs.readdirSync(dir);
    var oneFileHasChanged: boolean = false;
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
        let dstFolder: string = file.replace(scope.srcFolder, scope.dstFolder);
        if (!fs.existsSync(dstFolder)) {
          fs.mkdirSync(dstFolder);
        }
        scope.walkCopy(file);
      } else {
        let dstFile: string = file.replace(scope.srcFolder, scope.dstFolder);
        let fileName = file.substr(file.lastIndexOf('/') + 1);
        let bigFilesList: Array<any> = this.bigFilesMapDest.get(fileName) as Array<any>;
        // if ambiguity two big files with same name, then do not try to move
        let destObject: any = bigFilesList && bigFilesList.length == 1 ? bigFilesList[0] : null;
        if (destObject && destObject.size === stat.size && destObject.file != dstFile) {
          console.log('move file', destObject.file, dstFile);
          try { if (fs.existsSync(dstFile)) { fs.unlinkSync(dstFile); } } catch (e) { console.error(e); }
          fs.renameSync(destObject.file, dstFile);
        } else {
          if (!oneFileHasChanged && scope.compareFiles(file, dstFile)) {
            console.log('copy file', file, dstFile);
            this.copyFileSync(file, dstFile);
          }
        }
      }
    }
    return results;
  }

  copyFileSync(srcFile: string, destFile: string) {
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
  walkDelete(dir: string): string[] {
    let results: string[] = [];
    let list = fs.readdirSync(dir);
    let removedAll: boolean = true;
    for (let file of list) {
      file = dir + '/' + file;
      let stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        let srcFile: string = file.replace(scope.dstFolder, scope.srcFolder);
        scope.walkDelete(file);
        if (fs.existsSync(srcFile)) {
          removedAll = false;
        }
      } else {
        let srcFile: string = file.replace(scope.dstFolder, scope.srcFolder);
        let fileName = file.substr(file.lastIndexOf('/') + 1);
        let bigfileList: Array<any> = this.bigFilesMapSrc.get(fileName) as Array<any>;
        let srcObject: any = bigfileList && bigfileList.length == 1 ? bigfileList[0] : null;
        // do not delete if file will be moved
        if (srcObject && srcObject.size === stat.size && srcObject.file.replace(scope.srcFolder, scope.dstFolder) != file) {
          removedAll = false;
        } else if (!fs.existsSync(srcFile)) {
          fs.unlinkSync(file);
        } else {
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
  walkScanDest(dir: string): string[] {
    var results: string[] = [];
    var list = fs.readdirSync(dir);
    for (let file of list) {
      file = dir + '/' + file;
      let stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        scope.walkScanDest(file);
      } else {
        let fileName = file.substr(file.lastIndexOf('/') + 1);
        if (stat.size > 10000000 && fileName.length > 10) {
          if (this.bigFilesMapDest.get(fileName)) {
            (this.bigFilesMapDest.get(fileName) as Array<any>).push({ 'file': file, 'size': stat.size });
          } else {
            this.bigFilesMapDest.set(fileName, [{ 'file': file, 'size': stat.size }]);
          }
        }
      }
    }
    return results;
  }
  /* scan to find the big files that could be moved in destination instead of copied */
  walkScanSrc(dir: string): string[] {
    var results: string[] = [];
    var list = fs.readdirSync(dir);
    for (let file of list) {
      file = dir + '/' + file;
      let stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        scope.walkScanSrc(file);
      } else {
        let fileName = file.substr(file.lastIndexOf('/') + 1);
        if (stat.size > 10000000 && fileName.length > 10) {
          if (this.bigFilesMapSrc.get(fileName)) {
            (this.bigFilesMapSrc.get(fileName) as Array<any>).push({ 'file': file, 'size': stat.size });
          } else {
            this.bigFilesMapSrc.set(fileName, [{ 'file': file, 'size': stat.size }]);
          }
        }
      }
    }
    return results;
  }
}
scope = new Main();
scope.start();
