import { execSync } from "node:child_process";

/**
 * Returns the major version number from a version string.
 *
 * @param {string|number} v - The version string or number (e.g., "24.1.0" or 24).
 * @returns {number} The major version as an integer.
 */
function major(v) {
  return parseInt(String(v).split(".")[0], 10);
}

/**
 * Retrieves the current npm version as a string.
 *
 * Attempts to determine the npm version using the following strategies:
 * 1. Parses the npm user agent string from environment variables.
 * 2. Executes npm via the npm_execpath environment variable.
 * 3. Executes the npm command directly from the system PATH.
 *
 * @returns {string} The detected npm version (e.g., "11.0.0").
 */
function getNpmVersion() {
  // try to get it from npm_config_user_agent if available
  const ua = process.env.npm_config_user_agent || "";
  const m = ua.match(/npm\/(\d+\.\d+\.\d+)/);
  if (m) {
    return m[1];
  }
  // Fallback: try to get it from npm_execpath if available
  const execpath = process.env.npm_execpath;
  if (execpath) {
    try {
      const out = execSync(`"${process.execPath}" "${execpath}" -v`, {
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
      if (out) {
        return out;
      }
    } catch {}
  }

  // Fallback: try to get it from the PATH
  return execSync("npm -v", { stdio: ["ignore", "pipe", "ignore"] })
    .toString()
    .trim();
}

const nodeVer = process.versions.node;
const nodeMajor = major(nodeVer);
const npmVer = getNpmVersion();
const npmMajor = major(npmVer);

if (nodeMajor < 24 || npmMajor < 11) {
  console.error(
    `[engines] Node >=24 and npm >=11 are required. Detected: node ${nodeVer}, npm ${npmVer}`,
  );
  console.error(`[debug] npm_execpath=${process.env.npm_execpath || ""}`);
  console.error(`[debug] npm_config_user_agent=${process.env.npm_config_user_agent || ""}`);
  process.exit(1);
}
