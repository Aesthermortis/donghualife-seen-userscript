import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let metadata = readFileSync(resolve(__dirname, "src", "metadata.txt"), "utf8");

const cssAsStringPlugin = {
  name: "css-as-string",
  transform(code, id) {
    if (!id.endsWith(".css")) {
      return null;
    }
    return {
      code: `export default ${JSON.stringify(code)};`,
      map: { mappings: "" },
    };
  },
};

// Get version from workflow tag (refs/tags/vX.Y.Z)
const fromTag = process.env.GITHUB_REF_NAME || ""; // e.g. "v3.2.1"
const tagVersion = fromTag.startsWith("v") ? fromTag.slice(1) : "";

// Fallbacks: if running locally without tag, try package.json, or use "0.0.0"
let pkgVersion = "0.0.0";
try {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"));
  pkgVersion = pkg.version || pkgVersion;
} catch {}

const version = tagVersion || pkgVersion;

// Ensure metadata banner uses the resolved version
const updateMetadataVersion = (banner, bannerVersion) => {
  if (!bannerVersion) {
    return banner;
  }
  return banner.replace(/(@version\s+)([^\r\n]+)/, `$1${bannerVersion}`);
};

metadata = updateMetadataVersion(metadata, version);

export default {
  input: "src/index.js",
  output: {
    file: "dist/donghualife-seen.user.js",
    format: "iife",
    banner: metadata,
    strict: false,
  },
  treeshake: false,
  plugins: [cssAsStringPlugin],
};
