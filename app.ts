import * as fs from 'fs';

var scope: Main;

class Main {
  srcFolder: string;
  dstFolder: string;

  constructor() {
  }

  start() {
    scope.srcFolder = process.argv[2];
    scope.dstFolder = process.argv[3];
    scope.walk(scope.srcFolder);
  }

  compareFiles(src: string, dst: string): boolean {
    var statSrc = fs.statSync(src);
    if (!fs.existsSync(dst)) return true;
    var statDst = fs.statSync(dst);
    return (statSrc.size !== statDst.size) && (new Date().getTime() - statSrc.mtime.getTime() > 30 * 60 * 1000);
  }

  walk(dir: string): string[] {
    var results: string[] = [];
    var list = fs.readdirSync(dir);
    var oneFileHasChanged: boolean = false;
    for (let file of list) {
      let stat = fs.statSync(file);
      if (stat.isFile()) {
          if (new Date().getTime() - stat.mtime.getTime() < 30 * 60 * 1000) {
            oneFileHasChanged = true;
            break;
          } 
      }
    }
    list.forEach ((file) => {
      file = dir + '/' + file;
      let stat = fs.statSync(file);
      if (stat && stat.isDirectory()) {
        let dstFolder: string = file.replace(scope.srcFolder, scope.dstFolder);
        if (!fs.existsSync(dstFolder)) {
          fs.mkdirSync(dstFolder);
        }  
        scope.walk(file); 
      } else {
        let dstFile: string = file.replace(scope.srcFolder, scope.dstFolder);
        if (!oneFileHasChanged && scope.compareFiles(file, dstFile)) {
          console.log('copy file', file);
          fs.createReadStream(file).pipe(fs.createWriteStream(dstFile));
        }
      }
    });
    return results;
  }
}
scope = new Main();
scope.start();
