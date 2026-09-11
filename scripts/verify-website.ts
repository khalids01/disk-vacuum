import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const website = join(import.meta.dirname, "..", "website");
const requiredFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "assets/app-icon.png",
  "CNAME",
  ".nojekyll",
];

for (const file of requiredFiles) {
  const details = await stat(join(website, file));
  if (!details.isFile()) throw new Error(`Missing website artifact: ${file}`);
}

const [html, cname] = await Promise.all([
  readFile(join(website, "index.html"), "utf8"),
  readFile(join(website, "CNAME"), "utf8"),
]);

if (html.includes("/src/main.tsx")) {
  throw new Error("The website artifact points to the Vite development entry.");
}
if (!html.includes('src="app.js"') || !html.includes('href="styles.css"')) {
  throw new Error("The website entry does not load its production static assets.");
}
if (cname.trim() !== "diskvacuum.skycanvasstudio.com") {
  throw new Error("The website CNAME does not match the configured custom domain.");
}

console.log("Static website artifact is ready for GitHub Pages.");
