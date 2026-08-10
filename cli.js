#!/usr/bin/env node

const fs = require("fs/promises");
const path = require("path");
const { removeComments } = require("./removeComments");

const SUPPORTED_EXTENSIONS = new Set([".js", ".ts", ".jsx", ".tsx", ".css"]);
const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  "dist",
  ".git",
  "out",
  ".next",
  ".nuxt",
  "build",
]);

function getTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".ts") return "ts";
  if (ext === ".jsx") return "jsx";
  if (ext === ".tsx") return "tsx";
  if (ext === ".css") return "css";
  return "js";
}

function isSupportedFile(filePath) {
  return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

async function collectSupportedFiles(targetPath, files = []) {
  const stat = await fs.stat(targetPath);
  if (stat.isFile()) {
    if (isSupportedFile(targetPath)) files.push(targetPath);
    return files;
  }

  const entries = await fs.readdir(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) continue;
      await collectSupportedFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && isSupportedFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function processFile(filePath) {
  const code = await fs.readFile(filePath, "utf8");
  const type = getTypeFromPath(filePath);
  const newCode = await removeComments(code, type);

  if (newCode === code) return false;
  await fs.writeFile(filePath, newCode, "utf8");
  return true;
}

function printUsage() {
  console.log("Usage: remove-comments-frontend <file-or-folder-path>");
  console.log("Supported extensions: .js, .ts, .jsx, .tsx, .css");
}

async function run() {
  const targetArg = process.argv[2];

  if (!targetArg || targetArg === "--help" || targetArg === "-h") {
    printUsage();
    process.exit(targetArg ? 0 : 1);
  }

  const targetPath = path.resolve(process.cwd(), targetArg);

  try {
    const files = await collectSupportedFiles(targetPath);
    if (files.length === 0) {
      console.log("No supported files found.");
      return;
    }

    let updatedCount = 0;
    for (const filePath of files) {
      const updated = await processFile(filePath);
      if (updated) updatedCount++;
    }

    console.log(`Done. Removed comments in ${updatedCount} file(s).`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

run();
