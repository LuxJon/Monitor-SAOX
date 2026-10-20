import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
if (!existsSync(resolve(root, "dist/index.html"))) throw new Error("Build the theme before packaging");
const manifest = JSON.parse(readFileSync(resolve(root, "theme.json"), "utf8"));
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
if (manifest.short !== "saox" || manifest.name !== "SAOX" || manifest.version !== pkg.version) throw new Error("SAOX release identity mismatch");
const files = ["theme.json", "preview.png", "LICENSE", "THIRD_PARTY_NOTICES.md", "dist"];
execFileSync("tar", ["-czf", "theme.tar.gz", ...files], { cwd: root, stdio: "inherit" });
const archive = readFileSync(resolve(root, "theme.tar.gz"));
// gunzip validates the complete stream and CRC, including on Windows without gzip.exe.
const plain = gunzipSync(archive);
const entries = [];
for (let offset = 0; offset + 512 <= plain.length;) {
  const header = plain.subarray(offset, offset + 512);
  if (header.every(value => value === 0)) break;
  const text = (start, length) => header.subarray(start, start + length).toString().replace(/\0.*$/s, "");
  const name = text(345, 155) + text(0, 100);
  const size = Number.parseInt(text(124, 12).trim() || "0", 8);
  if (!Number.isFinite(size) || size > 8 * 1024 * 1024 || name.startsWith("/") || name.split(/[\\/]/).includes("..")) throw new Error("Unsafe archive entry: " + name);
  if (["1", "2"].includes(text(156, 1))) throw new Error("Archive contains a link: " + name);
  entries.push(name);
  offset += 512 + Math.ceil(size / 512) * 512;
}
for (const name of files) if (!entries.some(entry => entry === name || entry === name + "/")) throw new Error("Missing archive entry: " + name);
const filename = "theme.tar.gz";
mkdirSync(resolve(root, "qa"), { recursive: true });
if (entries.length > 2000 || plain.length > 64 * 1024 * 1024) throw new Error("Package exceeds Monitor limits");
const result = { theme: manifest.name, short: manifest.short, version: manifest.version, filename, bytes: archive.length, sha256: createHash("sha256").update(archive).digest("hex"), entries: entries.length, gzipCRC: "passed", layout: files };
writeFileSync(resolve(root, "qa/package-report.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
