const fs = require("fs");
const path = require("path");
// npm install --build-from-source
// path join

 const DEBUG_WRTC_FOLDER = path.join(
  __dirname,
  "..",
  "node_modules",
  "wrtc",
  "build",
  "Debug"
);
const RELEASE_WRTC_FOLDER = path.join(
  __dirname,
  "..",
  "node_modules",
  "wrtc",
  "build",
  "Release"
);

// if debug folder not exists then create it and copy content from release folder
if (!fs.existsSync(DEBUG_WRTC_FOLDER)) {
  fs.mkdirSync(DEBUG_WRTC_FOLDER);
  fs.copyFileSync(
    path.join(RELEASE_WRTC_FOLDER, "wrtc.node"),
    path.join(DEBUG_WRTC_FOLDER, "wrtc.node")
  );

  fs.copyFileSync(
    path.join(RELEASE_WRTC_FOLDER, "wrtc.lib"),
    path.join(DEBUG_WRTC_FOLDER, "wrtc.lib")
  );
  fs.copyFileSync(
    path.join(RELEASE_WRTC_FOLDER, "wrtc.exp"),
    path.join(DEBUG_WRTC_FOLDER, "wrtc.exp")
  );
}