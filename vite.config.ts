import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import { defineConfig } from "vite";

const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf-8"));

interface ChangelogEntry {
  version: string;
  date: string;
  features: string[];
  fixes: string[];
}

let parsedChangelog: ChangelogEntry[] = [];
try {
  const changelogMarkdown = fs.readFileSync("./CHANGELOG.md", "utf-8");
  const releases = changelogMarkdown.split("## [").slice(1);
  parsedChangelog = releases.map((release) => {
    const [header, ...rest] = release.split("\n");
    
    const versionMatch = header.match(/^([^\]]+)\]/);
    const dateMatch = header.match(/\(([^)]+)\)$/);
    
    if (!versionMatch) return null;
    
    const version = versionMatch[1];
    const date = dateMatch ? dateMatch[1] : "";

    const features: string[] = [];
    const fixes: string[] = [];
    let currentSection: "features" | "fixes" | null = null;

    for (const line of rest) {
      if (line.startsWith("### ")) {
        if (line.includes("Features") || line.includes("Novidades")) {
          currentSection = "features";
        } else if (line.includes("Bug Fixes") || line.includes("Correções")) {
          currentSection = "fixes";
        } else {
          currentSection = null;
        }
      } else if (line.trim().startsWith("* ") && currentSection) {
        // remove emojis at the start, remove commit links at the end
        const cleanLine = line
          .replace(/^\* (?::[a-z_]+: )?/, "")
          .replace(/\s\(\[.*?\]\(.*?\)\)$/, "")
          .trim();
        
        if (currentSection === "features") {
          features.push(cleanLine);
        } else if (currentSection === "fixes") {
          fixes.push(cleanLine);
        }
      }
    }

    return { version, date, features, fixes };
  }).filter((entry): entry is ChangelogEntry => entry !== null).slice(0, 5);
} catch (err) {
  console.warn("Failed to parse CHANGELOG.md", err);
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __APP_CHANGELOG__: JSON.stringify(parsedChangelog),
  },

  plugins: [react(), tailwindcss()],
  server: {
    open: true,
    host: "0.0.0.0",
    port: 5174,
    hmr: {
      host: "192.168.31.2",
      port: 5174,
    },
  },
});
