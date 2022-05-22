"use strict";
const os = require("os");

function isWindows() {
    return os.platform() === "win32";
}

try {
  if (isWindows()) {
    module.exports = require("../build/Debug/win/wrtc.node");
  } else {
    module.exports = require("../build/Debug/linux/wrtc.node");

  }
} catch (error) {
  module.exports = require("../build/Release/wrtc.node");
}
