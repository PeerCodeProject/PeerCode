/* eslint-env node*/

const fs = require("fs");
const path = require("path");

const DEBUG_WRTC_FOLDER = path.join(
  __dirname,
  "..",
  "..",
  "node_modules",
  "wrtc",
  "build",
  "Debug"
);

console.log(
  "debug folder: " + DEBUG_WRTC_FOLDER,
  fs.existsSync(DEBUG_WRTC_FOLDER)
);

// if ../node_modules/wrtc/build/Debug not exists then copy recursive from ./Debug directory
if (!fs.existsSync(DEBUG_WRTC_FOLDER)) {
  console.log("creating wrtc folder " + DEBUG_WRTC_FOLDER);
  fs.mkdirSync(DEBUG_WRTC_FOLDER, true);
  const backup = path.join(__dirname, "Debug");
  const bindingjs = path.join(
    __dirname,
    "..",
    "..",

    "node_modules",
    "wrtc",
    "lib",
    "binding.js"
  );
  console.log("backup: " + backup + ", bindingjs: " + bindingjs);
  copyFolderRecursiveSync(backup,  path.join(DEBUG_WRTC_FOLDER,".."));
  fs.copyFileSync(path.join(__dirname,  "binding.js"), bindingjs,);
}

function copyFileSync(source, target) {
  let targetFile = target;

  // If target is a directory, a new file with the same name will be created
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isDirectory()) {
      targetFile = path.join(target, path.basename(source));
    }
  }

  fs.writeFileSync(targetFile, fs.readFileSync(source));
}

function copyFolderRecursiveSync(source, target) {
  console.log("source: "+ source, ", target: "+ target);
  let files = [];

  // Check if folder needs to be created or integrated
  const targetFolder = path.join(target, path.basename(source));
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder);
  }

  // Copy
  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function (file) {
      const curSource = path.join(source, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, targetFolder);
      } else {
        copyFileSync(curSource, targetFolder);
      }
    });
  }
}
