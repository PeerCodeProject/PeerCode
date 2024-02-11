"use strict";

const os = require("os");
const fs = require("fs");

const modulePathToTryCheck = [
  {
    require: "../build/wrtc.node",
    pathToCheck: "node_modules/@roamhq/wrtc/build/wrtc.node",
  },
  {
    require: "../build/Debug/wrtc.node",
    pathToCheck: "node_modules/@roamhq/wrtc/build/Debug/wrtc.node",
  },
  {
    require: "../build/Release/wrtc.node",
    pathToCheck: "node_modules/@roamhq/wrtc/build/Release/wrtc.node",
  },
  {
    require: `@roamhq/wrtc-${os.platform()}-${os.arch()}`,
    pathToCheck: `node_modules/@roamhq/wrtc-${os.platform()}-${os.arch()}/wrtc.node`,
  },
];

const bindingJsPath = "node_modules/@roamhq/wrtc/lib/binding.js";


function checkPackages(packagePaths) {
  for (const packagePath of packagePaths) {
    if (fs.existsSync(packagePath.pathToCheck)) {
      return packagePath.require;
    }
  }
  throw new Error(`Could not find wrtc binary on any of the paths: ${packagePaths}`);

}

function updateBindingJsContent(packagePath) {
  const content = getBindingJsContent(packagePath);
  fs.writeFileSync(bindingJsPath, content);
}

function getBindingJsContent(packagePath) {
  return `'use strict';

try {
  module.exports = require(\"${packagePath}\")
} catch (error) {
  throw new Error("Could not find wrtc binary on the path: ${packagePath}");
}
`;
}


function  updateBindingJs() {
  const packagePath = checkPackages(modulePathToTryCheck);
  updateBindingJsContent(packagePath);
}

updateBindingJs();
