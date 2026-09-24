import { readFileSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { SourceReader } from "./load-site.ts";

/** Reads source files relative to `rootDir`. A missing file is reported as `undefined`. */
export function fileSystemReader(rootDir: string): SourceReader {
  const publicDir = resolve(rootDir, "public");
  const assetDir = resolve(rootDir, "src/assets");

  return {
    readText(relativePath) {
      try {
        return readFileSync(resolve(rootDir, relativePath), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
        throw error;
      }
    },
    hasPublicFile(sitePath) {
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(sitePath);
      } catch {
        return false;
      }

      const filePath = resolve(publicDir, `.${decodedPath}`);
      const pathFromPublic = relative(publicDir, filePath);
      if (pathFromPublic === "" || pathFromPublic.startsWith("..") || pathFromPublic.includes("../")) return false;

      try {
        return statSync(filePath).isFile();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    },
    hasAssetFile(imagePath) {
      // The schema rules out absolute paths and "..", so the path cannot leave src/assets/.
      try {
        return statSync(resolve(assetDir, imagePath)).isFile();
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    },
  };
}
