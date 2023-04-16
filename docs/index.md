---
title: 测试页
outline: [2, 3]
---

# Hello World

最开始使用 Hexo 作为博客框架，现在觉得太老，改用 Vitepress。

此页仅做测试页，记录一些配置项和博客的 TBD。

## Vitepress 的使用

[官方文档](https://vitepress.dev/guide/getting-started)

### Frontmatter 常见配置项

- `title`: title for this page.
- `outline`: list of numbers, he levels of header in the outline to display for the page

Frontmatter data can be accessed via the special `$frontmatter` global variable

### 图片

图片都需要放在 `/public/` 目录里，但引用时不需要带上 `/public/`。

### 使用 GitHub Actions 部署

原本使用网上抄的一个 deploy.sh 来部署：

```bash
#!/usr/bin/env sh

set -e # abort on errors
pnpm build
cd docs/.vitepress/dist
git add -A
git commit -m 'deploy'
git push -f git@github.com:xkz0777/xkz0777.github.io.git master
cd -
```

这样博客源代码跟 github pages 仓库分开了，并且源码修改 commit 后还要手动 deploy，有点麻烦。

用 GitHub Actions 部署，首先创建 `.github/workflows/deploy.yml`：

```yaml
name: Deploy GitHub Pages

on:
  push:
    branches:
      - master

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: pnpm/action-setup@v2
        with:
          version: 7.9.5

      - uses: actions/setup-node@v3
        with:
          node-version: latest

      # 拉取代码
      - uses: actions/checkout@v3
        with:
          persist-credentials: false
          fetch-depth: 0

      # 生成静态文件
      - name: Build
        run: pnpm install --frozen-lockfile && pnpm build

      # 部署到 GitHub Pages
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.ACCESS_TOKEN }}
          publish_dir: docs/.vitepress/dist
```

其中 pnpm 的 version 应该与本地的一致，否则在 `pnpm install` 那一步会报错。

## TBD

- 博客评论
- 编译实验记录
- 6.S081 实验记录

## 数学公式测试

$$
\begin{align}
\left(
\begin{matrix}
1 &1 &1\\
2 &2 &2\\
3 &3 &3\\
\end{matrix}
\right)
\end{align}
$$

## 代码配色测试

```cpp
void MorrisTraversal(Node* root) {
    Node *current, *pre;

    if (root == NULL)
        return;

    current = root;
    while (current != NULL) {
        if (current->left == NULL) {
            cout << current->data << " ";
            current = current->right;
        } else {
            pre = current->left;
            while (pre->right != NULL && pre->right != current)
                pre = pre->right;

            if (pre->right == NULL) {
                pre->right = current;
                current = current->left;
            } else {
                pre->right = NULL;
                cout << current->data << " ";
                current = current->right;
            }
        }
    }
}
```

```python
import socket

HOST = '127.0.0.1'  # Standard loopback interface address (localhost)
PORT = 65432        # Port to listen on (non-privileged ports are > 1023)

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
    s.bind((HOST, PORT))
    s.listen()
    conn, addr = s.accept()
    with conn:
        print('Connected by', addr)
        while True:
            data = conn.recv(1024)
            if not data:
                break
            conn.sendall(data)
```
