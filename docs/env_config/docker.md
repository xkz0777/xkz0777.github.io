# 服务器上使用 Docker

## 使用 GPU

需要在 `docker run`（或 `docker create`，下同）命令中加上参数 `--gpus all`，启动 container 后输入 `nvidia-smi -L` 可以检查是否配置成功。

## 挂载目录下的权限问题

创建容器时 `-v` 参数可以将本地目录挂载到容器上，但容器运行时使用的是 root 身份，如果使用 docker 在挂载目录下创建了文件，文件的所有者就是 `root`，退出 docker 后便无法进行修改。

解决方案：

- 已经创建：

  需要在 docker 内用 `chown` 命令修改所有者，例如：
  ```shell
  $ chown -R <uid>:<gid> <directory>
  ```

- 还未创建：

  首先保存当前容器：
  ```shell
  $ docker commit <container_name> <image_name>:<tag>
  ```

  然后在 `docker run` 命令中加上参数 `-u <uid>` 重新创建容器。不过这样创建的容器里，prompt 中的 username 会是 "I have no name!"（因为 docker 并不知道宿主机的用户）。虽然能用但是看起来很难受，可以选择在 `docker run` 命令中加上 `-v /etc/passwd:/etc/passwd:ro`，或是在 `Dockerfile` 中加上

  ```dockerfile
  RUN useradd -u <uid> -m <username>
  USER <username>
  ```

## 从容器中下载文件到宿主机

```shell
$ docker cp <container_name>:<source_path> <dest_path>
```

## 参考

- https://blog.csdn.net/dwqy11/article/details/109384445
- https://forums.docker.com/t/error-i-have-no-name-occurs-when-trying-to-run-sudo-docker-run-volume/117963/8
