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

## TBD

- 博客评论

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
