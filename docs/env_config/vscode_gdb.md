---
title: VSCode 使用 GDB 调试
---

# VSCode 下使用 GDB 调试

## 单文件调试

在 `.vscode` 目录下创建 `tasks.json` 和 `launch.json` 文件，配置如下：

`tasks.json` 文件：

```json
{
  "tasks": [
    {
      "type": "cppbuild",
      "label": "compile", // 该任务的名称
      "command": " g++",
      "args": [
        "-g",
        "${file}",
        "-o",
        "${fileDirname}/${fileBasenameNoExtension}" // 可执行文件的路径
      ],
      "options": {
        "cwd": "${fileDirname}"
      },
      "problemMatcher": ["$gcc"],
      "group": {
        "kind": "build",
        "isDefault": true
      }
    }
  ],
  "version": "2.0.0"
}
```

`launch.json` 文件：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "debug",
      "type": "cppdbg",
      "request": "launch",
      "program": "${fileDirname}/${fileBasenameNoExtension}", // 要调试的程序名称，要和前面对应
      "args": [], // 调试时的命令行参数
      "stopAtEntry": false,
      "cwd": "${fileDirname}",
      "environment": [],
      "externalConsole": false, // 调试时是否需要弹出外部终端
      "MIMode": "gdb",
      "miDebuggerPath": "gdb",
      "setupCommands": [
        {
          "description": "为 gdb 启用整齐打印",
          "text": "-enable-pretty-printing",
          "ignoreFailures": true
        }
      ],
      "preLaunchTask": "compile" // 对应 task.json 里面的 "label" 值
    }
  ]
}
```

## 多文件项目调试

可以有两种方式，如果希望像单文件一样通过 VSCode 编译后调试，需要修改 task.json 里面的参数，先把 `$file$` 去掉，防止重复链接，再加上所有需要编译的 `.cpp` 文件和包含的头文件位置，如下：

```json
"args": [
    "-g",
    "-std=c++17",
    "-I",
    "${workspaceFolder}/incl",
    "${workspaceFolder}/src/*.cpp",
    "-o",
    "${workspaceFolder}/build/${workspaceFolderBasename}"
],
```

之后再修改 `launch.json`：

```json
"program": "${workspaceFolder}/build/${workspaceFolderBasename}",
```

也可以选择使用 Make 编译，这样 `tasks.json` 里的 `command` 无论单文件还是多文件都可以直接写 `make`，也不需要提供 `args`。
