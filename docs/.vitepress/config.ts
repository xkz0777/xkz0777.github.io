import { defineConfig } from "vitepress";
import mathjax3 from "markdown-it-mathjax3";

const customElements = ["mjx-container"];
const config = defineConfig({
  title: "xkz's blog", // Website title
  description: "my new Blog using vitrepress", //Website description
  base: "/",
  // lang: "zh-CN",
  lastUpdated: true,
  // Page header configuration, icon, css, js
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "/img/icon.jpg", //The pictures are placed in the public folder
      },
    ],
  ],
  // Theme configuration
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/xkz0777/Blogs",
      },
    ],
    //   Head navigation
    nav: [
      { text: "Homepage", link: "/" },
      { text: "About", link: "/about/" },
      { text: "Friends", link: "/friends/" },
    ],
    //   Side navigation
    // algolia: {
    //   appId: "JLN7294SFK",
    //   apiKey: "c3e50fff39e131aac4010ca3e6988077",
    //   indexName: "blog",
    // },
    // sidebar: [{ text: "my", link: "/mine/" }],
  },
  markdown: {
    config: (md) => {
      md.use(mathjax3);
    },
  },
});

export default config;
