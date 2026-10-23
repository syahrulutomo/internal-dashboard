import type { StorybookConfig } from "@storybook/react-vite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// Documents the design system (views/ui + views/presentation). We use the
// react-vite framework, not @storybook/nextjs: those two layers are pure React
// with no next/* imports, so this avoids coupling Storybook to the Next 16
// toolchain. Containers (which do use next/navigation) are intentionally out of
// scope.
const config: StorybookConfig = {
  stories: ["../views/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  viteFinal: async (viteConfig) => {
    // Tailwind v4 (the app styles the components with it) + the `@/*` path alias
    // used throughout the codebase.
    viteConfig.plugins = viteConfig.plugins ?? [];
    viteConfig.plugins.push(tailwindcss());

    // Add the `@/*` → frontend-root alias WITHOUT replacing react-vite's own
    // aliases. Use a string `find` (not a regex): string aliases still get
    // vite's extension/index resolution, so `@/views/ui/Button` resolves to
    // `.../Button/index.tsx` — a regex replacement yields a bare directory path
    // and fails with EISDIR. This mirrors the working vitest.config alias.
    viteConfig.resolve = viteConfig.resolve ?? {};
    // Ensure TS/TSX (and index files) resolve — the component imports are
    // extensionless directory/index imports.
    viteConfig.resolve.extensions = [
      ".mjs",
      ".js",
      ".mts",
      ".ts",
      ".jsx",
      ".tsx",
      ".json",
    ];
    const aliasEntry = { find: "@", replacement: frontendRoot };
    if (Array.isArray(viteConfig.resolve.alias)) {
      viteConfig.resolve.alias.push(aliasEntry);
    } else {
      viteConfig.resolve.alias = {
        ...(viteConfig.resolve.alias ?? {}),
        "@": frontendRoot,
      };
    }
    return viteConfig;
  },
};

export default config;
