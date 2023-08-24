/* eslint-env node*/

const fs = require("fs");
const path = require("path");


const DEBUG_WRTC_FOLDER = path.join(
    __dirname,
    "..",
    "node_modules",
    "@cubicleai",
    "wrtc",
    "build",
    "Debug"
);
const RELEASE_WRTC_FOLDER = path.join(
    __dirname,
    "..",
    "node_modules",
    "@cubicleai",
    "wrtc",
    "build",
    "Release"
);

// if debug folder not exists then create it and copy content from release folder
if (!fs.existsSync(DEBUG_WRTC_FOLDER)) {
    console.log("copying wrtc files from `release` to `debug`");
    fs.mkdirSync(DEBUG_WRTC_FOLDER);
    fs.copyFileSync(
        path.join(RELEASE_WRTC_FOLDER, "wrtc.node"),
        path.join(DEBUG_WRTC_FOLDER, "wrtc.node")
    );
    const wrtcLib = path.join(RELEASE_WRTC_FOLDER, "wrtc.lib");
    if (fs.existsSync(wrtcLib)) {
        fs.copyFileSync(wrtcLib, path.join(DEBUG_WRTC_FOLDER, "wrtc.lib"));
    }
    const wrtcExp = path.join(RELEASE_WRTC_FOLDER, "wrtc.exp");
    if (fs.existsSync(wrtcExp)) {
        fs.copyFileSync(wrtcExp, path.join(DEBUG_WRTC_FOLDER, "wrtc.exp"));
    }
}
