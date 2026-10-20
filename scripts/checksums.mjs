import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
const root = fileURLToPath(new URL("..", import.meta.url));
const {version} = JSON.parse(readFileSync(resolve(root,"theme.json"),"utf8"));
const files = ["theme.tar.gz", "SAOX-" + version + "-source.zip"];
writeFileSync(resolve(root,"SHA256SUMS"), files.map(name => createHash("sha256").update(readFileSync(resolve(root,name))).digest("hex") + "  " + name).join("\n") + "\n");
console.log("Wrote SHA256SUMS");
