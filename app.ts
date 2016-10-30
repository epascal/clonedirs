import * as fs from 'fs';

var scope: Main;
const TIME_ACTIVITY: number = 1;

class Main {
  srcFolder: string;
  dstFolder: string;
  bigFilesMap: Map<string, Object> = new Map<string, Object>();

  constructor() {
  }

  start() {
    scope.srcFolder = process.argv[2];
    scope.dstFolder = process.argv[3];

    scope.walkScanDest(scope.dstFolder);
    scope.walkCopy(scope.srcFolder);
    scope.walkDelete(scope.dstFolder);
    process.exit(0);
  }

  compareFiles(src: string, dst: string): boolean {
    var statSrc = fs.statSync(src);
    if (!fs.existsSync(dst)) return true;
    var statDst = fs.statSync(dst);
    return (statSrc.size !== statDst.size) && (new Date().getTime() - statSrc.mtime.getTime() > TIME_ACTIVITY * 60 * 1000);
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
        if (!oneFileHasChanged && scope.compareFiles(file, dstFile)) {
          let fileName = file.substr(file.lastIndexOf('/') + 1);
          let destObject: any = this.bigFilesMap.get(fileName);
          if (destObject && destObject.size === stat.size) {
            console.log('move file', file);
            fs.renameSync(destObject.file, dstFile);
          } else {
            console.log('copy file', file);
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
  /* remove file no longer present in source folder */
  walkDelete(dir: string): string[] {
    let results: string[] = [];
    let list = fs.readdirSync(dir);
    let removedAll: boolean = true;
    for (let file of list) {
      file = dir + '/' + file;
      let stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        scope.walkDelete(file);
      } else {
        let srcFile: string = file.replace(scope.dstFolder, scope.srcFolder);
        if (!fs.existsSync(srcFile)) {
          fs.unlinkSync(file);
        } else {
          removedAll = false;
        }
      }
    }
    if (removedAll) {
      try {
        fs.rmdirSync(dir);
      } catch (e) {

      }
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
          this.bigFilesMap.set(fileName, { 'file': file, 'size': stat.size });
        }
      }
    }
    return results;
  }
}
scope = new Main();
scope.start();
