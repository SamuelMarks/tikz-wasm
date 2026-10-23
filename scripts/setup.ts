/**
 * CLI script (`scripts/setup.ts`) for downloading or copying the upstream `pdftex` WebAssembly
 * binary and patching its Emscripten JavaScript glue code into a Promise-based factory.
 *
 * @packageDocumentation
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

/**
 * Official upstream SwiftLaTeX PdfTeX WebAssembly release archive URL.
 */
export const SWIFTLATEX_RELEASE_URL =
  'https://github.com/SwiftLaTeX/SwiftLaTeX/releases/download/v20022022/20-02-2022.zip';

/**
 * Upstream download URLs for the WebAssembly binary and Emscripten glue code.
 */
/* v8 ignore start */
export const ASSET_URLS = {
  /**
   * URL to download `pdftex.wasm` (or the upstream SwiftLaTeX release `.zip` archive).
   */
  wasm: process.env['TIKZ_WASM_URL'] ?? SWIFTLATEX_RELEASE_URL,
  /**
   * URL to download `swiftlatexpdftex.js` glue code (or the upstream SwiftLaTeX release `.zip` archive).
   */
  glue: process.env['TIKZ_GLUE_URL'] ?? SWIFTLATEX_RELEASE_URL,
};
/* v8 ignore stop */

/**
 * Local asset destination configuration.
 */
export const CONFIG = {
  /**
   * Absolute path to `src/assets`.
   */
  assetsDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/assets'),
  /**
   * Filename for the WebAssembly binary inside `src/assets`.
   */
  wasmPath: 'tex.wasm',
  /**
   * Filename for the patched Emscripten glue module inside `src/assets`.
   */
  gluePath: 'tex_glue.js',
};

/**
 * Ensures that the specified directory exists, creating it recursively if absent.
 *
 * @param dirPath - Directory path to check and create.
 */
export function ensureDirectory(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Created directory: ${dirPath}`);
  }
}

/**
 * Extracts a single named file from a ZIP archive buffer using its Central Directory.
 *
 * @param zipBuffer - Raw Buffer containing a standard ZIP archive.
 * @param entryName - Basename or relative path of the file to extract.
 * @returns The uncompressed file content as a `Buffer`.
 * @throws Error if the EOCD header or target entry is missing, or if the compression method is unsupported.
 */
export function extractZipEntry(zipBuffer: Buffer, entryName: string): Buffer {
  let eocdOffset = -1;
  for (let i = zipBuffer.length - 22; i >= 0; i--) {
    if (zipBuffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) {
    throw new Error(`Invalid ZIP archive when extracting ${entryName}`);
  }

  const entryCount = zipBuffer.readUInt16LE(eocdOffset + 10);
  let cdPos = zipBuffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < entryCount; i++) {
    const method = zipBuffer.readUInt16LE(cdPos + 10);
    const compressedSize = zipBuffer.readUInt32LE(cdPos + 20);
    const nameLen = zipBuffer.readUInt16LE(cdPos + 28);
    const extraLen = zipBuffer.readUInt16LE(cdPos + 30);
    const commentLen = zipBuffer.readUInt16LE(cdPos + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(cdPos + 42);
    const name = zipBuffer.subarray(cdPos + 46, cdPos + 46 + nameLen).toString('utf8');

    if (name === entryName || name.endsWith(`/${entryName}`)) {
      const localNameLen = zipBuffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = zipBuffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const compressedData = zipBuffer.subarray(dataStart, dataStart + compressedSize);

      if (method === 0) {
        return Buffer.from(compressedData);
      }
      if (method === 8) {
        return zlib.inflateRawSync(compressedData);
      }
      throw new Error(`Unsupported ZIP compression method ${String(method)} for ${entryName}`);
    }

    cdPos += 46 + nameLen + extraLen + commentLen;
  }

  throw new Error(`Entry ${entryName} not found in ZIP archive`);
}

/**
 * Downloads a binary file (or extracts an entry from a downloaded ZIP archive) and saves it to disk.
 *
 * @param url - Remote HTTP/HTTPS URL to fetch.
 * @param destPath - Destination file path on disk.
 * @param zipEntryName - Optional filename to extract if the downloaded payload is a ZIP archive.
 * @throws Error if the HTTP response status is not OK.
 */
export async function downloadFile(
  url: string,
  destPath: string,
  zipEntryName?: string
): Promise<void> {
  console.log(`Downloading ${url} -> ${destPath}...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText} (${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);
  const isZip = rawBuffer.length >= 4 && rawBuffer.readUInt32LE(0) === 0x04034b50;
  const outputBuffer =
    isZip && zipEntryName ? extractZipEntry(rawBuffer, zipEntryName) : rawBuffer;

  fs.writeFileSync(destPath, outputBuffer);

  console.log(`Saved ${outputBuffer.byteLength} bytes to ${destPath}`);
}

/**
 * Copies `pdftex.wasm` and `PdfTeXEngine.js` from a local SwiftLaTeX build directory.
 *
 * @param srcDir - Source directory containing `pdftex.wasm` and `PdfTeXEngine.js`.
 * @param destDir - Target `src/assets` directory.
 * @throws Error if either artifact is missing in `srcDir`.
 */
export async function copyLocal(srcDir: string, destDir: string): Promise<void> {
  console.log(`Copying artifacts from local build: ${srcDir}`);

  const srcWasm = path.join(srcDir, 'pdftex.wasm');
  const srcGlue = path.join(srcDir, 'PdfTeXEngine.js');

  if (!fs.existsSync(srcWasm)) {
    throw new Error(`Local build missing WASM at: ${srcWasm}`);
  }
  if (!fs.existsSync(srcGlue)) {
    throw new Error(`Local build missing JS Glue at: ${srcGlue}`);
  }

  fs.copyFileSync(srcWasm, path.join(destDir, CONFIG.wasmPath));
  console.log(`Copied ${CONFIG.wasmPath}`);

  fs.copyFileSync(srcGlue, path.join(destDir, 'temp_glue.js'));
  console.log(`Copied ${CONFIG.gluePath} (to temp)`);
}

/**
 * Patches the raw SwiftLaTeX Emscripten JS glue code into an ES module exporting
 * a Promise-returning `TikZModuleFactory` function.
 *
 * @param rawJs - Raw upstream JavaScript glue code.
 * @returns Patched ES module JavaScript string.
 */
export function patchGlueCode(rawJs: string): string {
  const header = `
export default function TikZModuleFactory(moduleOverrides = {}) {
  return new Promise(async (resolve, reject) => {
    var Module = Object.assign({}, moduleOverrides);
    if (!Module.wasmBinary && typeof process === "object" && process.versions && process.versions.node) {
      var nodeFs = await import("node:" + "fs");
      Module.wasmBinary = nodeFs.readFileSync(new URL("./tex.wasm", import.meta.url));
    }
    Module.noInitialRun = true;

    // Safety for 'document.currentScript' in workers
    var _scriptDir = typeof self !== 'undefined' && self.location ? self.location.href : undefined;

    var vfsFileIndex = new Map();
    function kpse_find_file_impl(nameptr, _format, _mustexist) {
      var reqname = UTF8ToString(nameptr);
      var exts = ["", ".tex", ".tfm", ".sty", ".def", ".cfg", ".fd", ".cls", ".clo", ".ltx", ".ini", ".code.tex", ".fmt"];
      for (var i = 0; i < exts.length; i++) {
        var candidate = reqname + exts[i];
        if (vfsFileIndex.has(candidate)) {
          var foundPath = vfsFileIndex.get(candidate);
          return allocate(intArrayFromString(foundPath), "i8", ALLOC_NORMAL);
        }
      }
      return 0;
    }
    function kpse_find_pk_impl(_nameptr, _dpi) {
      return 0;
    }

    Module.onRuntimeInitialized = function() {
      if (typeof FS !== "undefined") {
        var origWriteFile = FS.writeFile.bind(FS);
        FS.writeFile = function(p, data, opts) {
          var norm = String(p).replace(/\\\\/g, "/");
          var lastSlash = norm.lastIndexOf("/");
          if (lastSlash > 0) {
            var parts = norm.slice(0, lastSlash).split("/").filter(Boolean);
            var cur = norm.startsWith("/") ? "" : ".";
            for (var i = 0; i < parts.length; i++) {
              cur += "/" + parts[i];
              try { FS.mkdir(cur); } catch (_e) {}
            }
          }
          origWriteFile(norm, data, opts);
          var base = lastSlash >= 0 ? norm.slice(lastSlash + 1) : norm;
          if (!vfsFileIndex.has(base)) {
            vfsFileIndex.set(base, norm);
          }
        };
        Module.FS = FS;
      }
      var initMem = typeof wasmMemory !== "undefined" ? new Uint8Array(wasmMemory.buffer).slice() : null;
      Module.callMain = function(args) {
        var inputFilename = Array.isArray(args) && args.length > 0 ? args[args.length - 1] : "input.tex";
        if (initMem && typeof wasmMemory !== "undefined") {
          new Uint8Array(wasmMemory.buffer).set(initMem);
        }
        if (typeof FS !== "undefined" && Array.isArray(FS.streams)) {
          for (var i = 0; i < FS.streams.length; i++) {
            var stream = FS.streams[i];
            if (stream && stream.fd > 2) {
              try { FS.close(stream); } catch (_e) {}
            }
          }
        }
        if (inputFilename.startsWith("ini_") || inputFilename.endsWith(".ini")) {
          if (inputFilename !== "pdflatex.ini") {
            var iniData = FS.readFile(inputFilename);
            FS.writeFile("pdflatex.ini", iniData);
          }
          var fmtStatus = _compileFormat();
          if (fmtStatus === 0) {
            var fmtOutName = inputFilename.replace(/\\.(tex|ini)$/, "") + ".fmt";
            var fmtBytes = FS.readFile("pdflatex.fmt");
            FS.writeFile(fmtOutName, fmtBytes);
          }
          return fmtStatus;
        }
        try {
          var tikzFmt = FS.readFile("tikz.fmt");
          FS.writeFile("swiftlatexpdftex.fmt", tikzFmt);
        } catch (_e) {}
        ccall("setMainEntry", "number", ["string"], [inputFilename]);
        return _compileLaTeX();
      };
      resolve(Module);
    };

    Module.onAbort = function(what) {
      reject(new Error("WASM Aborted: " + what));
    };

    // --- START UPSTREAM CODE ---
`;

  const emscriptenMarker = 'var moduleOverrides=Object.assign({},Module);';
  const markerIndex = rawJs.indexOf(emscriptenMarker);
  const strippedJs = markerIndex !== -1 ? rawJs.slice(markerIndex) : rawJs;

  const content = strippedJs
    .replace(/require\(['"]fs['"]\)/g, '{}')
    .replace(/require\(['"]path['"]\)/g, '{}')
    .replace(/scriptDirectory=__dirname\+"\/"/g, 'scriptDirectory=""')
    .replace(/var Module=typeof Module!==?"undefined"\?Module:{};/g, 'var Module = moduleOverrides || {};')
    .replace(/if\(typeof Module!=='undefined'\)Module=/, '// Module=');

  const footer = `
    // --- END UPSTREAM CODE ---
  });
} 
`;

  return header + content + footer;
}

/**
 * Executes the setup workflow (remote download or `--local <dir>` copy, followed by glue patching).
 *
 * @param argv - CLI arguments (defaults to `process.argv.slice(2)`).
 */
export async function main(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  try {
    ensureDirectory(CONFIG.assetsDir);

    const localFlagIndex = argv.indexOf('--local');
    const isLocal = localFlagIndex !== -1;

    if (isLocal) {
      const srcPath = argv[localFlagIndex + 1];
      if (!srcPath) {
        throw new Error('Missing path argument for --local');
      }
      await copyLocal(srcPath, CONFIG.assetsDir);
    } else {
      if (ASSET_URLS.wasm.includes('https://github.com/USER/REPO')) {
        console.warn('WARNING: Using placeholder URLs. Setup will likely fail.');
        console.warn('Please build SwiftLaTeX/PdfTeX-WASM locally and run: npm run setup -- --local ../PdfTeX-WASM/');
      }

      const wasmDest = path.join(CONFIG.assetsDir, CONFIG.wasmPath);
      const glueDest = path.join(CONFIG.assetsDir, 'temp_glue.js');

      await downloadFile(ASSET_URLS.wasm, wasmDest, 'swiftlatexpdftex.wasm');
      await downloadFile(ASSET_URLS.glue, glueDest, 'swiftlatexpdftex.js');
    }

    const tempGlue = path.join(CONFIG.assetsDir, 'temp_glue.js');
    const glueDest = path.join(CONFIG.assetsDir, CONFIG.gluePath);

    if (fs.existsSync(tempGlue)) {
      const rawGlue = fs.readFileSync(tempGlue, 'utf-8');
      const patchedGlue = patchGlueCode(rawGlue);
      fs.writeFileSync(glueDest, patchedGlue);
      console.log(`Patched glue code written to ${glueDest}`);
      fs.unlinkSync(tempGlue);
    }
  } catch (err: unknown) {
    console.error('Setup failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

/* v8 ignore start */
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
/* v8 ignore stop */
