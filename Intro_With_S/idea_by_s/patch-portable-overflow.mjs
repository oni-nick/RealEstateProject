import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const htmlPath = resolve(process.argv[2] ?? "");
if (!process.argv[2]) {
  throw new Error("Usage: node patch-portable-overflow.mjs <report.html>");
}

const marker = "</head>";
const compatibilityStyle = [
  "<style data-local-portable-compatibility=\"true\">",
  ".analytics-top-bar{width:100%!important;margin-right:0!important;margin-left:0!important}",
  "@media screen and (min-width:761px){",
  ".portable-page-header{width:100%!important;margin-right:0!important;margin-left:0!important}",
  "}",
  "</style>",
].join("");

const html = readFileSync(htmlPath, "utf8");
if (!html.includes(marker)) {
  throw new Error(`Could not find ${marker} in ${htmlPath}`);
}
if (html.includes("data-local-portable-compatibility")) {
  throw new Error(`Compatibility style already exists in ${htmlPath}`);
}

writeFileSync(htmlPath, html.replace(marker, `${compatibilityStyle}\n${marker}`), "utf8");
