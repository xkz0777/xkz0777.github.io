import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { SearchPlugin } from "vitepress-plugin-search";
import flexSearchIndexOptions from "flexsearch";

const SearchOptions = {
  ...flexSearchIndexOptions,
  previewLength: 62,
  buttonLabel: "Search",
  placeholder: "Search docs",
  allow: [],
  ignore: [],
};

// https://github.com/vuejs/vitepress/discussions/1015#discussioncomment-3177860
const NavLinkPatch = (): Plugin => ({
  name: "override-target-blank",
  enforce: "pre",
  transform: (code, id) => {
    if (id.endsWith("VPLink.vue")) return code.replace("_blank", "_self");
  },
});

export default defineConfig({
  plugins: [NavLinkPatch(), SearchPlugin(SearchOptions)],
  optimizeDeps: {
    exclude: ["vitepress"],
  },
  css: {
    postcss: {
      plugins: [
        {
          postcssPlugin: "internal:charset-removal",
          AtRule: {
            charset: (atRule) => {
              if (atRule.name === "charset") atRule.remove();
            },
          },
        },
      ],
    },
  },
});
