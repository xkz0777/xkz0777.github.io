import { defineConfig } from "vitepress";
import mathjax3 from "markdown-it-mathjax3";

const customElements = ["mjx-container"];
const config = defineConfig({
  title: "xkz's blog", // Website title
  description: "my new Blog using vitrepress", //Website description
  base: "/",
  lastUpdated: true,
  // Page header configuration, icon, css, js
  head: [
    [
      "link",
      {
        rel: "icon",
        href: "/img/icon.jpg", // The pictures are placed in the public folder
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
    // Navigation Bar
    nav: [
      { text: "Homepage", link: "/" },
      { text: "Notes", link: "/notes/" },
      { text: "Environment", link: "/env_config/" },
      { text: "About", link: "/about/" },
      { text: "Friends", link: "/friends/" },
    ],

    // Side Bar
    sidebar: {
      "/homepage": [
        {
          text: "主页",
          items: [
            {
              text: "Hello world",
              link: "/index.md",
            },
          ],
        },
      ],
      "/notes": [
        {
          text: "学习笔记",
          items: [
            {
              text: "Make 和 CMake 的使用",
              link: "/notes/make.md",
            },
            {
              text: "CS61A 学习笔记",
              link: "notes/cs61a.md",
            },
          ],
        },
      ],
      "/env_config": [
        {
          text: "配环境记录",
          items: [
            {
              text: "vscode 使用 GDB 调试",
              link: "/env_config/vscode_gdb.md",
            },
            {
              text: "记一次重装系统",
              link: "/env_config/reinstall.md",
            },
          ],
        },
      ],
    },
  },
  markdown: {
    theme: "one-dark-pro", // https://github.com/shikijs/shiki/blob/main/docs/themes.md
    lineNumbers: true, // codeblock
    config: (md) => {
      md.use(mathjax3);
    },
  },
});

export default config;
