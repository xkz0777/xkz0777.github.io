module.exports = {
  title: "xkz's blog", // Website title
  description: "my new Blog using vitrepress", //Website description
  base: "/", //  The default path during deployment / secondary address / base can be used/
  // Lang: 'en US', / / language
  // Page header configuration, icon, css, js
  head: [
    // Change the icon of the title
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
    repo: "xkz0777/Blogs", // Your github warehouse address will jump in the upper right corner of the page
    //   Head navigation
    nav: [
      { text: "Homepage", link: "/" },
      { text: "About", link: "/about/" },
      { text: "Friends", link: "/friends/" },
    ],
    //   Side navigation
    // sidebar: [{ text: "my", link: "/mine/" }],
  },
};
