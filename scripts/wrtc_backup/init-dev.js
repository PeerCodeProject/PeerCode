const fs = require("fs");
const path = require("path");

const DEBUG_WRTC_FOLDER = path.join(
  __dirname,
  "..",
  "node_modules",
  "wrtc",
  "build",
  "Debug"
);

// if ../node_modules/wrtc/build/Debug not exists then copy recursive from ./Debug directory
if (!fs.existsSync(DEBUG_WRTC_FOLDER)) {
  const backup = path.join(__dirname, "Debug");
  const bindingjs = path.join(
    "..",
    "node_modules",
    "wrtc",
    "lib",
    "binding.js"
  );
  copyFolderRecursiveSync(backup, DEBUG_WRTC_FOLDER);
  fs.copyFileSync(backup, bindingjs);
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
