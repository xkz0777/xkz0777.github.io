---
title: Make 和 CMake 的使用
outline: [2, 3, 4]
---

# Make 和 CMake 的使用

本文简单介绍如何使用命令行工具编译。在此之前，先简单说说 C/C++ 文件的编译过程。

## C/C++ 文件编译过程

1. 预处理：源代码（\*.c 或 \*.cpp）经预处理变为预处理文件（\*.i），主要进行宏替换。
2. 编译：将预处理文件（\*.i）编译成汇编文件（\*.s）
3. 汇编：把汇编文件（\*.s）转换成目标文件（Object File，在 Windows 下是 \*.obj 文件，Linux 下则是 \*.o）。
4. 链接：将目标文件、库文件、启动文件等链接起来生成可执行文件。

源代码到 \*.o：

```bash
$ gcc -c test.c -o test.o
```

或

```bash
$ gcc -c test.c
```

\*.o 到可执行文件：

```bash
$ gcc test.o -o test
```

或

```bash
$ g++ -o test test.o
```

对于 \*.cpp 文件，只要把 gcc 换成 g++。

事实上从源代码可以直接生成可执行文件：

```bash
$ gcc test.c -o test
```

但是先生成目标文件的好处在于，编译大项目时，如果只修改了部分文件，可以只编译生成对应的目标文件然后直接链接，可以节省很多编译时间。

## Make 和 Makefile

### 什么是 Make

> In software development, Make is a build automation tool that automatically builds executable programs and libraries from source code by reading files called Makefiles which specify how to derive the target program. --Wikipedia

写好了 Makefile 以后，使用 `make` 命令即可编译。Make 有许多不同的版本，最常用的是 GNU Make.

### Makefile 语法

#### 基本语法

```makefile
targets: prerequisites
	command
```

- targets：规则的目标，可以是目标文件（\*.o），也可以是可执行文件，还可以是一个标签；

- prerequisites：是我们的**依赖文件**，要生成 targets 需要的文件或者是目标。可以是多个，也可以没有；

* command：make 需要执行的命令（**任意的 shell 命令**）。可以有多条命令，每一条命令占一行。

prerequisites 中如果**有一个以上的文件比 target 文件要新**的话，command 所定义的命令就会被执行。

注意：command 前**必须有一个 tab**。

那么简单的 Makefile 如下：

```makefile
test: test.cpp # comment
	g++ -c test.cpp -o test.o
	g++ test.o -o test
```

其中 test.cpp 内容：

```cpp
#include <iostream>
using namespace std;
int main() {
    cout << "hello world\n";
    return 0;
}
```

文件结构：

```bash
$ ls
Makefile test.cpp
```

之后在含 Makefile 的目录下用命令 make 即可编译：

```bash
$ make
g++ -c test.cpp -o test.o
g++ test.o -o test
$ ls
Makefile  test  test.cpp  test.o
```

对于大型一点的工程，就需要用到下面的语法。

#### 变量

定义时很简单，使用 `变量名=变量值`，使用时用 `${变量名}` 或 `$(变量名)` 的形式。事实上这里称作变量并不是太合适，因为在使用变量时只是进行了宏替换。例如上面的 Makefile 可以改成

```makefile
CC=g++
TARGET=test
SRC=test.cpp
OBJ=test.o
${TARGET}: ${SRC}
	${CC} -c ${SRC} -o ${OBJ}
	${CC} ${OBJ} -o ${TARGET}
```

#### 通配符

shell 支持的通配符（类似于正则）都可以在 Makefile 中使用，有如下通配符：

| 通配符 |              使用说明              |
| :----: | :--------------------------------: |
|   \*   |     匹配 0 个或者是任意个字符      |
|   ？   |          匹配任意一个字符          |
|   []   | 我们可以指定匹配的字符放在 "[]" 中 |

此外，在 Makefile 中，字符 `%` 也可以用于匹配任意个字符（shell 中不可），使用在我们的的规则当中，可以快速生成 `.o` 文件（使用类似循环的方式） ，这个在后面的例子中会体现。

#### 自动化变量

| 自动化变量 |                                                                                         说明                                                                                          |
| :--------: | :-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------: |
|    \$@     |                                                                                表示规则的目标文件名。                                                                                 |
|    \$%     |                                                                当目标文件是一个静态库文件时，代表静态库的一个成员名。                                                                 |
|    \$<     |                                      规则的第一个依赖的文件名。如果是一个目标文件使用隐含的规则来重建，则它代表由隐含规则加入的第一个依赖文件。                                       |
|    \$?     |                                           所有比目标文件更新的依赖文件列表，空格分隔。如果目标文件时静态库文件，代表的是库文件（.o 文件）。                                           |
|    \$^     | 代表的是所有依赖文件列表，使用空格分隔。如果目标是静态库文件，它所代表的只能是所有的库成员（.o 文件）名。 一个文件可重复的出现在目标的依赖中，变量 `\$^` 只记录它的第一次引用的情况。 |
|    \$\+    |                                                类似 `\$^`，但是它保留了依赖文件中重复出现的文件。主要用在程序链接时库的交叉引用场合。                                                 |

读者看到这个表可能已经晕了，不知道到底这些有啥用，事实上我也没有全部看懂，在后面的教程只用到了 `$@` 和 `$<`，其他的应该用在一些更高级的项目里，具体遇到再查。

#### 目标文件搜索

当所需的 \*.cpp、\*.h 文件不在 Makefile 所在目录下时，需要特别指定其路径，这里有一种更简单的方法，指定 `VPATH=src`，src 为需要寻找对应文件的地址（具体见后面的例子）。

#### 例

以我本学期数据结构第一次大作业的工程（银行业务模拟）为例，工程目录：

```bash
$ ls
Makefile  incl/  src/
```

其中 src 里为 \*.cpp 文件，incl 里为 \*.h 文件。

```bash
$ ls incl
client.h  event.h  global_variable.h  main.h  queue.h
$ ls src
client.cpp  event.cpp  global_variable.cpp  main.cpp
```

初版 Makefile：

```makefile
CC=g++
INCL=./incl
SRC=./src
OBJ=client.o event.o global_variable.o main.o

test: ${OBJ}
	${CC} -o test ${OBJ}

client.o: ${INCL}/client.h ${SRC}/client.cpp
	${CC} -c ${SRC}/client.cpp

global_variable.o: ${INCL}/global_variable.h ${SRC}/global_variable.cpp
	${CC} -c ${SRC}/global_variable.cpp

event.o: ${INCL}/event.h ${SRC}/event.cpp
	${CC} -c ${SRC}/event.cpp

main.o: ${INCL}/main.h ${SRC}/main.cpp
	${CC} -c ${SRC}/main.cpp
```

很明显写起来非常麻烦，每个目标文件都得有对应的处理语句，语句一多就很麻烦。

之后我们用通配符和自动化变量改进：

```makefile
CC=g++
INCL=./incl
SRC=./src
OBJ=client.o event.o global_variable.o main.o # 宏替换，所以有空格也没事

test: $(OBJ)
	$(CC) -o test $(OBJ)

%.o: $(SRC)/%.cpp $(INCL)
	$(CC) -c $< -o $@ # 也可以简写成 $(CC) -c $<
```

这里 `%.o` 把我们需要的所有的 `.o` 文件组合成为一个列表，从列表中挨个取出每一个文件，`%` 表示取出来文件的文件名（不包含后缀），然后找到文件中和 `%` 名称相同的 `.cpp` 文件，然后执行下面的命令，直到列表中的文件全部被取出来为止。

如果再使用 `VPATH`，可以最终简化为：

```makefile
CC=g++
OBJ=client.o event.o global_variable.o main.o
VPATH=src incl

test: $(OBJ)
	$(CC) -o test $(OBJ)

%.o: %.cpp
	${CC} -c $< -o $@
```

此外，也可以写一个伪目标用于清除过程中生成的 \*.o 文件：

```makefile
.PHONY: clean

clean:
	rm -rf $(OBJ)
```

其中 clean 不是一个文件，因此也不会被 Makefile 执行，只有执行 `make clean` 才会调用 clean 里的 command。`.PHONY` 的作用有二：

- 避免 Makefile 中定义的只执行的命令的目标和工作目录下的实际文件出现名字冲突。
- 提高执行 make 时的效率。

PS：写 OBJ 的列表也有点麻烦，我尝试在 Makefile 写一个获取该列表的函数，但是没有成功，只能写了个 Python 脚本：

```python
import os

for fileName in os.listdir('./src'):
    s = os.path.splitext(fileName)
    if s[1] == '.cpp':
        print(s[0] + '.o', end=" ") # client.o event.o global_variable.o main.o
```

## CMake 和 CMakeLists.txt

CMake 是一个**跨平台的编译工具**，能够输出各种各样的 Makefile 或者项目文件，能测试编译器所支持的 C++ 特性，类似 UNIX 下的 automake. （在 UNIX 中，生成 Makefile，在 Visual Studio 中会生成项目解决方案……）

安装 CMake 后，输入 cmake，可以发现有三种 Usage：

```bash
$ cmake
Usage

  cmake [options] <path-to-source>
  cmake [options] <path-to-existing-build>
  cmake [options] -S <path-to-source> -B <path-to-build>

Specify a source directory to (re-)generate a build system for it in the
current working directory.  Specify an existing build directory to
re-generate its build system.

Run 'cmake --help' for more information.
```

第三种指定的参数最多，也最灵活，后面都使用第三种方式。

### 简单的示例

创建源文件 `tutorial.cxx` 在 `Step0` 目录下，用于计算平方根：

```cpp
// A simple program that computes the square root of a number
#include <cmath>
#include <iostream>
int main(int argc, char *argv[]) {
    if (argc < 2) {
        std::cout << "Usage: " << argv[0] << " number" << std::endl;
        return 1;
    }
    double inputValue = atof(argv[1]);
    double outputValue = sqrt(inputValue);
    std::cout << "The square root of " << inputValue << " is " << outputValue << std::endl;
    return 0;
}
```

之后在同目录下创建 `CMakeLists.txt`：

```cmake
# CMake 最低版本要求
cmake_minimum_required(VERSION 3.10)

# 设置项目名称和版本
project(Test)

# 添加可执行文件
add_executable(${PROJECT_NAME} tutorial.cxx) # ${PROJECT_NAME} 即为 Test，也是最后生成可执行文件的名字
```

之后需要指定需要 build 的目录：

```bash
$ mkdir build
$ cd build
$ cmake -S .. -B . # 等价于 cmake ..
-- The C compiler identification is GNU 9.3.0
-- The CXX compiler identification is GNU 9.3.0
-- Check for working C compiler: /usr/bin/cc
-- Check for working C compiler: /usr/bin/cc -- works
-- Detecting C compiler ABI info
-- Detecting C compiler ABI info - done
-- Detecting C compile features
-- Detecting C compile features - done
-- Check for working CXX compiler: /usr/bin/c++
-- Check for working CXX compiler: /usr/bin/c++ -- works
-- Detecting CXX compiler ABI info
-- Detecting CXX compiler ABI info - done
-- Detecting CXX compile features
-- Detecting CXX compile features - done
-- Configuring done
-- Generating done
-- Build files have been written to: .../Step0/build
```

这时可以发现 `build` 目录下生成了 Makefile：

```bash
$ ls
CMakeCache.txt  CMakeFiles  Makefile  cmake_install.cmake
```

内容好长，我也没太看懂，直接 `make`：

```bash
$ make
Scanning dependencies of target Test
[ 50%] Building CXX object CMakeFiles/Test.dir/tutorial.cxx.o
[100%] Linking CXX executable Test
[100%] Built target Test
```

发现多出了可执行文件 `Test`，运行一下：

```bash
$ ./Test
Usage: ./Test number

$ ./Test 49
The square root of 49 is 7
```

### 为项目添加版本号和可配置的头文件

修改 `CMakeLists.txt` 如下：

```cmake
# CMake 最低版本要求
cmake_minimum_required(VERSION 3.10)

# 设置项目名称和版本
project(Tutorial VERSION 1.0)

# 添加可执行文件
add_executable(Tutorial tutorial.cxx)

# 配置文件，用于将后者的内容替换为前者
configure_file(TutorialConfig.h.in TutorialConfig.h)

# 固定写法
target_include_directories(${PROJECT_NAME} PUBLIC "${PROJECT_BINARY_DIR}")

# 指定 C++ 标准
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)
```

在目录下添加头文件 `TutorialConfig.h.in`：

```cpp
// Tutorial 的配置选项和设置
#define Tutorial_VERSION_MAJOR @Tutorial_VERSION_MAJOR@
#define Tutorial_VERSION_MINOR @Tutorial_VERSION_MINOR@
```

其中以 `@` 开头和结尾的宏将会被 camke 替换为对应的版本。

修改 `tutorial.cxx` 并让其包含头文件：

```cpp
// A simple program that computes the square root of a number
#include <cmath>
#include <iostream>
#include "TutorialConfig.h"
int main(int argc, char *argv[]) {
    if (argc < 2) {
        std::cout << argv[0] << " Version " << Tutorial_VERSION_MAJOR << "."
                  << Tutorial_VERSION_MINOR << std::endl;
        std::cout << "Usage: " << argv[0] << " number" << std::endl;
        return 1;
    }
    double inputValue = atof(argv[1]);
    double outputValue = sqrt(inputValue);
    std::cout << "The square root of " << inputValue << " is " << outputValue << std::endl;
    return 0;
}
```

重新操作一番后执行：

```bash
$ mkdir build
$ cmake -S . -B build
$ cd build
$ make
$ ./Tutorial
./Tutorial Version 1.0
Usage: ./Tutorial number
```

发现多出了一行版本信息，同时在 `build` 目录下也多出了 CMake 为我们自动生成的 `TutorialConfig.h` 文件同时并作了替换：

```bash
$ ls
CMakeCache.txt  CMakeFiles  Makefile  TutorialConfig.h  cmake_install.cmake

$ cat TutorialConfig.h
// Tutorial 的配置选项和设置
#define Tutorial_VERSION_MAJOR 1
#define Tutorial_VERSION_MINOR 0
```

### 为工程添加链接库

#### 什么是链接库

链接库（下面简称库）分为静态库和动态库。

#### 静态库

静态库是一些目标文件（`.o` 文件）的集合，在 Windows 中通常后缀为 `.lib`，Linux 中为 `.a`。静态库在链接时会直接把里面的函数代码全部链接到可执行文件中，便于程序的移植，但是也浪费了空间和资源。例如，当多个程序都调用相同函数时，内存中就会存在这个函数的多个拷贝。此外，当静态库变动时，需要链接到库的程序需要重新进行编译，小小的改动可能就要浪费很多时间。因此，静态库的使用不如动态库来得方便。

#### 动态库

在 Windows 中为 `.dll`，Linux 中为 `.so`（例如 LabS 中要用到的 boost 装上以后就是 .so 文件）。动态库在程序编译时**并不会被链接到目标代码**中**，而是在程序运行时才被载入。**不同的应用程序如果调用相同的库，那么在内存里只需要有一份该共享库的实例**，规避了空间浪费问题，也解决了静态库对程序的更新、部署和发布页带来的麻烦。用户只需要更新动态库即可，**增量更新。

#### 如何添加库

这里以静态库为例，动态库也是类似的。

首先新建子文件夹 `Adder`，里面包含 `adder.cpp` 及 `adder.h`，用于计算两个整数的和。

`adder.cpp`：

```cpp
#include "adder.h"
int add(int a, int b) {
    return a + b;
}
```

`adder.h`：

```cpp
int add(int, int);
```

并在该目录中创建 `CMakeLists.txt`：

```cmake
# 指定库名以及编译库所需要的依赖文件
add_library(adder adder.cpp adder.h)
```

修改父文件夹的 `CMakeLists.txt`

```cmake
# CMake 最低版本要求
cmake_minimum_required(VERSION 3.10)

# 设置项目名称和版本
project(Tutorial VERSION 1.0)

# 添加可执行文件
add_executable(Tutorial tutorial.cxx)

# 配置文件，用于将后者的内容替换为前者
configure_file(TutorialConfig.h.in TutorialConfig.h)

# 这里加上了 Adder，固定写法
target_include_directories(${PROJECT_NAME} PUBLIC "${PROJECT_BINARY_DIR}" Adder)

# 添加子目录，这时会把该子目录编译成库
add_subdirectory(Adder)

# 指定当CMake从那里寻找我们需要链接的库
target_link_directories(${PROJECT_NAME} PUBLIC Adder)

# 将库链接到程序里
target_link_libraries(${PROJECT_NAME} adder)

# 指定 C++ 标准，set 用来对变量复制
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED True)
```

`tutorial.cxx`：

```cpp
// A simple program that computes the square root of a number
#include <adder.h>
#include <iostream>
#include "TutorialConfig.h"
int main(int argc, char *argv[]) {
    if (argc < 2) {
        std::cout << argv[0] << " Version " << Tutorial_VERSION_MAJOR << "."
                  << Tutorial_VERSION_MINOR << std::endl;
        std::cout << "Usage: " << argv[0] << " number1 number2" << std::endl;
        return 1;
    }
    int a = atof(argv[1]);
    int b = atof(argv[2]);
    int outputValue = add(a, b);
    std::cout << "The sum of " << a << " and " << b << " is " << outputValue << std::endl;
    return 0;
}
```

注意到这里可以直接 `#include <adder.h>` 因为 adder 已经被我们配置成了库加到 `CMakeLists.txt` 中。

之后编译运行：

```bash
$ ./Tutorial 2 3
The sum of 2 and 3 is 5
```

同时可以在 `build/Adder` 目录下找到 `libadder.a`，这便是 adder 编译成的链接文件。

## 参考文档

[Makefile 由浅入深--教程、干货 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/47390641)

[C 程序的编译过程 - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/106777805)

[Makefile 教程：Makefile 文件编写 1 天入门 (biancheng.net)](http://c.biancheng.net/makefile/)

[Makefile 简易教程 - 简书 (jianshu.com)](https://www.jianshu.com/p/ff0e0e26c47a)

[Linux 中的动态链接库和静态链接库是干什么的？ - 知乎 (zhihu.com)](https://www.zhihu.com/question/20484931)

[CMake 官方教程](https://cmake.org/cmake/help/latest/guide/tutorial/index.html)

[CMake 教程（一） - 知乎 (zhihu.com)](https://zhuanlan.zhihu.com/p/119426899)
