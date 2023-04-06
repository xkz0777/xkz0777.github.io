import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { SearchPlugin } from "vitepress-plugin-search";
import flexSearchIndexOptions from "flexsearch";

const SearchOptions = {
  ...flexSearchIndexOptions,
  previewLength: 62,
  encode: false,
  buttonLabel: "Search",
  placeholder: "Search docs",
  allow: [],
  ignore: [],
};

export default defineConfig({
  plugins: [SearchPlugin(SearchOptions)],
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
