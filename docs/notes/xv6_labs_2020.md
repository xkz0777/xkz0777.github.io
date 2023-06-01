# xv6 labs 2020 笔记

## Lab Util

这个实验主要就是调 syscall 来写用户态程序，所有程序后面都要 `exit(0)` 来返回到 shell。

除了 `primes` 都比较简单，只讲 `primes`。

根据 [示意图](https://swtch.com/~rsc/thread/sieve.gif)，思路应该是主进程把所有数都发到下一个进程，之后每个进程判断输入是否只有一个，如果不是就再 `fork` 新进程，把筛过的数继续往后发。

主函数：

```c
int fd[2];
Pipe(fd);

int pid = fork();

if (pid == 0) {
  primes(fd);
} else {
  close(fd[0]);

  for (int i = 2; i < 36; ++i) {
      write(fd[1], &i, 1);
  }

  close(fd[1]);
  wait(NULL);
}
```

接下来编写每个进程的行为 `primes`，按照上面的描述，容易想到使用递归来解决，因为迭代不知道要进行多少次循环，会带来困难。

```c
void primes(int *fd) {
  close(fd[1]); // 父进程已经用了 fd 的写端口，这里 fd 只用来读

  int prime = 0; // 第一个读到的一定是质数，之后读到的，如果不是这个数的倍数，发往下一个进程
  read(fd[0], &prime, 1);
  fprintf(1, "prime %d\n", prime);

  int p = 0;

  if (read(fd[0], &p, 1) == 0) { // 没有下一个数，不需要再创建子进程，递归终止
    close(fd[0]);
    exit(0);
  } else {
    int new_fd[2]; // new_fd 用来给子进程传
    Pipe(new_fd);

    int pid = fork();
    if (pid == 0) {
      primes(new_fd);
    } else {
      close(new_fd[0]);

      while (1) {
        if (p % prime != 0) {
          write(new_fd[1], &p, 1);
        }
        if (read(fd[0], &p, 1) == 0) { // 从父进程读完，可以结束
          close(fd[0]);
          close(new_fd[1]);
          wait(NULL);
          exit(0);
        }
      }
    }
  }
}
```

这里还需要注意，因为 `int` 是四字节，代码里的 `prime` 和 `p` 都要初始化。也可以改成读或者写四字节，或者使用 `char` 代替 `int` 来避免错误。

## Lab Syscall

本次实验添加两个 syscall，`trace` 和 `sysinfo`。

添加 syscall 的步骤为

1. 到 `user/user.h` 里添加 syscall 的原型，这里参数和返回值都可以自定义，例如对于 `trace`，应是接收一个整形参数，标志需要记录的 syscall，执行正常返回 0，否则返回 -1。

2. `user/usys.pl` 里添加对应的 entry，这将使得调用 syscall 时，寄存器 `a7` 被载入对应 `SYS_${name}` 的值，然后通过 `ecall` 调用对应 syscall。

3. 在 `kernel/syscall.h` 里添加对应的 syscall number，也就是 `a7` 具体被载入的值。

4. 在 `kernel/sysproc.c` 里添加对应的函数，这里的函数一定都没有参数，并且返回值类型为 `uint64`，其参数根据其类型通过 `argint`、`argaddr`、`argfd` 来获取。

5. 在 `kernel/syscalls.c` 里增加 syscall number 和调用函数的 mapping。

### Trace

为了方便 trace 打印 syscall 的名字，在 `kernel/syscalls.c` 里需要加上 syscall number 到 syscall name 的 mapping。

`trace` 在当前进程里记录下调用的参数：

```c
uint64 sys_trace(void) {
  int mask;
  if (argint(0, &mask) < 0) {
      return -1;
  }

  struct proc *p = myproc();
  p->mask = mask;
  return 0;
}
```

调用 `syscall()` 时检查当前的 syscall number 和该参数的逻辑与，如果非 0，打印 trace 信息：

```c
void syscall(void) {
  int num;
  struct proc *p = myproc();

  num = p->trapframe->a7;
  if(num > 0 && num < NELEM(syscalls) && syscalls[num]) {
    p->trapframe->a0 = syscalls[num]();
    if ((p->mask & (1 << num)) != 0) {
      printf("%d: syscall %s -> %d\n", p->pid, syscall_names[num], p->trapframe->a0);
    }
  } else {
    printf("%d %s: unknown sys call %d\n", p->pid, p->name, num);
    p->trapframe->a0 = -1;
  }
}
```

### Sysinfo

获取 `struct sysinfo` 的对应信息，然后通过 `copyout` 从内核空间复制到用户空间：

```c
uint64
sys_sysinfo(void) {
  struct proc *p = myproc();
  struct sysinfo info;

  uint64 addr;
  if (argaddr(0, &addr) < 0) {
    return -1;
  }

  info.freemem = freemem();
  info.nproc = numproc();

  if (copyout(p->pagetable, addr, (char *)&info, sizeof(info)) < 0) {
    return -1;
  }

  return 0;
}
```

`freemem` 在 `kernel/kalloc.c` 里实现，只要用一个全局计数器记录空页数，每次 `kfree` 增加一页，`kalloc` 减少一页，之后乘以每页的大小 `PGSIZE` 即可。

`numproc` 在 `kernel/proc.c` 里实现，最多也就 `NPROC` 个，遍历整个 `proc` 数组，不在 `UNUSED` 状态就算一个。

## Lab Pagetable

### Print a page table

仿照 `freewalk` 即可，可以选择递归，这需要一个 helper function，添加一个参数记录递归层数以在 `printf` 中缩进。这里因为只有三层，我暴力展开了三重循环：

```c
void vmprint(pagetable_t pgtbl) {
  printf("page table %p\n", pgtbl);

  for (int i = 0; i < PGSIZE / 8; ++i) {
    uint64 pte1 = pgtbl[i];
    if ((pte1 & PTE_V) && (pte1 & (PTE_R | PTE_W | PTE_X)) == 0) {
      uint64 pa1 = PTE2PA(pte1);
      printf("..%d: pte %p pa %p\n", i, pte1, pa1);
      for (int j = 0; j < PGSIZE / 8; ++j) {
        uint64 pte2 = ((pagetable_t)pa1)[j];
				if ((pte2 & PTE_V) && (pte2 & (PTE_R | PTE_W | PTE_X)) == 0) {
					uint64 pa2 = PTE2PA(pte2);
					printf(".. ..%d: pte %p pa %p\n", j, pte2, pa2);
					for (int k = 0; k < PGSIZE / 8; ++k) {
						uint64 pte3 = ((pagetable_t)pa2)[k];
						if (pte3 & PTE_V) {
							uint64 pa3 = PTE2PA(pte3);
							printf(".. .. ..%d: pte %p pa %p\n", k, pte3, pa3);
						}
					}
				}
			}
		}
  }
}
```

注意 `PTE2PA` 等宏的使用，因为索引是 PPN 加上 12 位 offset（前两层都是 0），并且前两层 ` pte & (PTE_R | PTE_W | PTE_X)` 应该都是 0，最后一层则只要求 Valid。

下面两问比较困难，一出错就是各种 panic，debug 很痛苦。

### A kernel page table per process

这问主要是为下一问做准备，因为 xv6 原本的实现中只有一个全局内核页表，内核为了解析用户地址，需要传入用户页表，并通过软件模拟页表查询来获取对应的物理地址，例如在 `copyin` 中，需要通过 `walkaddr` 在页表中找到对应的物理地址，但如果为每个进程维护对应的 kernel page table，并在进程进入内核时，对应的内核页表被写入 `satp` 寄存器，硬件就可以完成虚拟地址的解析，并且还能利用 TLB 进行加速查找。

首先，原本的 `kvminit` 只要创建一个内核页表，现在抽象出一个函数专门用来创建内核页表：

```c
pagetable_t kpgtbl_create() {
  pagetable_t pagetable = vmcreate();

  // uart registers
  kvmmap(pagetable, UART0, UART0, PGSIZE, PTE_R | PTE_W);
  // virtio mmio disk interface
  kvmmap(pagetable, VIRTIO0, VIRTIO0, PGSIZE, PTE_R | PTE_W);
  // PLIC
  kvmmap(pagetable, PLIC, PLIC, 0x400000, PTE_R | PTE_W);
  // map kernel text executable and read-only.
  kvmmap(pagetable, KERNBASE, KERNBASE, (uint64)etext-KERNBASE, PTE_R | PTE_X);
  // map kernel data and the physical RAM we'll make use of.
  kvmmap(pagetable, (uint64)etext, (uint64)etext, PHYSTOP-(uint64)etext, PTE_R | PTE_W);
  // map the trampoline for trap entry/exit to
  // the highest virtual address in the kernel.
  kvmmap(pagetable, TRAMPOLINE, (uint64)trampoline, PGSIZE, PTE_R | PTE_X);

  return pagetable;
}
```

这对比 `kvminit`，少了 `CLINT` 的 mapping，因为在第三问中，`0 ~ PLIC` 这一地址空间是给用户页表的，然而 `CLINT` 比它小，由于这个 mapping 仅在启动时 enable interrupt 有用，因此只添加在 `kernel_pagetable` 里：

```c
void kvminit() {
  kernel_pagetable = kpgtbl_create();
  kvmmap(kernel_pagetable, CLINT, CLINT, 0x10000, PTE_R | PTE_W);
}
```

这里为 `kvmmap` 添加了额外的参数，以对不同进程的内核页表添加 mapping。

然后在 `struct proc` 里添加一个 `kpagetable` 域。

在 `allocproc` 函数中，为进程分配 `kpagetable`，此外，因为这个 `kpagetable` 需要包含这个进程对应内核栈的 mapping，因此原本在 `procinit` 里统一分配到内核栈也改到 `allocproc` 分配：

```c
static struct proc*
allocproc(void)
{
  ...
  // An empty user page table.
  p->pagetable = proc_pagetable(p);
  if(p->pagetable == 0){
    freeproc(p);
    release(&p->lock);
    return 0;
  }

  p->kpagetable = kpgtbl_create();

  char *pa = kalloc();
  if(pa == 0)
    panic("kalloc");
  uint64 va = KSTACK((int)(p - proc));
  p->kstack = va;
  // Each process's kernel page table has a mapping for that process's kernel stack
  kvmmap(p->kpagetable, va, (uint64)pa, PGSIZE, PTE_R | PTE_W);
  ...
}
```

这里 `va` 也可以用 `KSTACK(0)`，因为每个进程页表里就一个内核栈。

相应的，`freeproc` 里要对进程的内核页表和内核栈进行释放。

```c
static void
freeproc(struct proc *p)
{
  ...
  if(p->kpagetable) {
    if(p->kstack) {
    uint64 pa = kvmpa(p->kpagetable, p->kstack);
    kfree((void *)pa);
  }
    proc_freekpagetable(p->kpagetable);
  }

  p->kstack = 0;
  ...
}
```

这里 `proc_freekpagetable` 和 `proc_freepagetable` 的区别在于前者不释放三级页表对应的物理空间，那么编写起来和 `freewalk` 没有区别，只是不需要在发现 leaf 没有被 free 时 panic。

最后，在调度器 `scheduler` 里，在进程切换时需要把对应的内核页表写到 `satp` 寄存器，进程运行结束后再换回 `kernel_pagetable`：

```c
if(p->state == RUNNABLE) {
  p->state = RUNNING;
  c->proc = p;

  w_satp(MAKE_SATP(p->kpagetable)); // 写入 satp，之后 flush TLB
  sfence_vma();

  swtch(&c->context, &p->context);
    c->proc = 0;

  // 换回 kernel_pagetable
  kvminithart();

  found = 1;
}
```

在写完后运行，发现报错 `panic: kvmpa`，用 GDB 调试，发现 `kvmpa` 试图在 `kernel_pagetable` 里找内核栈的地址。

于是我想在 `allocproc` 时把创建的栈也加到 `kernel_pagetable` 里，这时错误果然已经消失，但是换成了 `panic: remap`，因为进程会被 free，在用到之前被释放的进程时，它对应的内核栈已经 map 过了，需要在 `freeproc` 里对应进行 `unmap`。

更好的做法是把 `kernel/vertio_disk.c` 里 `disk.desc[idx[0]].addr = (uint64) kvmpa((uint64) &buf0);` 改成 `disk.desc[idx[0]].addr = (uint64) kvmpa(myproc()->kpagetable, (uint64) &buf0);`（当然要为 `kvmpa` 添加对应的参数）

### Simplify copyin/copyinstr

首先把 `copyin` 和 `copyinstr` 改成调用 `vmcopy.c` 里两个对应的函数：

```c
int copyin(pagetable_t pagetable, char *dst, uint64 srcva, uint64 len) {
  return copyin_new(pagetable, dst, srcva, len);
}

int copyinstr(pagetable_t pagetable, char *dst, uint64 srcva, uint64 max) {
  return copyinstr_new(pagetable, dst, srcva, max);
}
```

接下来，为了硬件能正确的解析用户地址，需要在每个为用户页表添加 mapping 的地方相应的为内核页表也添加这个 mapping。

实现一个 `kvmcopy` 函数，用于向内核页表拷贝用户页表：

```c
int kvmcopy(pagetable_t pagetable, pagetable_t kpagetable, uint64 start, uint64 end) {
  start = PGROUNDUP(start);
  for (uint64 i = start; i < end; i += PGSIZE) {
    pte_t *pte = walk(pagetable, i, 0);
    uint64 pa = PTE2PA(*pte);
    int perm = PTE_FLAGS(*pte) & ~PTE_U;
    if (mappages(kpagetable, i, PGSIZE, pa, perm) != 0) {
      uvmunmap(kpagetable, start, (i - start) / PGSIZE, 0);
      return -1;
    }
  }
  return 0;
}
```

这和 `uvmcopy` 基本类似，但由于 `uvmcopy` 一定是从地址空间 0 开始拷贝，而 `kvmcopy` 不一定（后面会讲到），所以要一个 `start` 参数。此外，`uvmcopy` 会创建新的物理空间，但 `kvmcopy` 只要让两个页表的虚拟地址指向相同的物理地址就行了，在权限位需要 clear `PTU_U` 这一位，否则会导致内核模式下无法访问。

之后就是在改变用户页表的地方做同步，首先是 `fork`：

```c
if((uvmcopy(p->pagetable, np->pagetable, p->sz) < 0) ||
     (kvmcopy(np->pagetable, np->kpagetable, 0, p->sz) < 0)) {
  freeproc(np);
  release(&np->lock);
  return -1;
}
```

`exec`：

```c
// Save program name for debugging.
for(last=s=path; *s; s++)
if(*s == '/')
  last = s+1;
safestrcpy(p->name, last, sizeof(p->name));

uvmunmap(p->kpagetable, 0, PGROUNDUP(oldsz) / PGSIZE, 0);
kvmcopy(pagetable, p->kpagetable, 0, sz);

// Commit to the user image.
oldpagetable = p->pagetable;
p->pagetable = pagetable;
p->sz = sz;
p->trapframe->epc = elf.entry;  // initial program counter = main
p->trapframe->sp = sp; // initial stack pointer
proc_freepagetable(oldpagetable, oldsz);
if (p->pid == 1) {
  vmprint(p->pagetable);
}
```

因为 `exec` 直接替换进程的地址空间，因此对应的内核页表需要先清空再复制，防止出现 remap 错误。

`growproc`：

```c
uint64 newsz;

if((newsz = uvmalloc(p->pagetable, sz, sz + n)) == 0) {
    return -1;
}

if (kvmcopy(p->pagetable, p->kpagetable, sz, sz + n) < 0) {
    uvmdealloc(p->pagetable, newsz, sz);
    return -1;
}
sz = newsz;
```

需要注意的是，这里不是从 0 开始 copy，而是从旧的 `size` 处开始，copy 需要 grow 的大小 `n`。这也是为什么 `kvmcopy` 需要增加一个参数。

最后是 `userinit`：

```c
uvminit(p->pagetable, initcode, sizeof(initcode));
p->sz = PGSIZE;
kvmcopy(p->pagetable, p->kpagetable, 0, p->sz);
```

此外，因为用户页表还可能会去除一些映射，再新增一个函数 `kvmdealloc` 在 `growproc` 里调用：

```c
uint64 kvmdealloc(pagetable_t pagetable, uint64 oldsz, uint64 newsz) {
  if(newsz >= oldsz)
    return oldsz;

  if(PGROUNDUP(newsz) < PGROUNDUP(oldsz)){
    int npages = (PGROUNDUP(oldsz) - PGROUNDUP(newsz)) / PGSIZE;
    uvmunmap(pagetable, PGROUNDUP(newsz), npages, 0); // 只有这里和 uvm 有区别，并不释放内存
  }

  return newsz;
}
```

最后，为了防止用户使用的地址超过 `PLIC`，在 `uvmalloc` 里添加判断：

```c
if (PGROUNDDOWN(newsz) >= PLIC) {
  return 0;
}
```

## Lab Traps

### RISC-V assembly

本次实验不需要对 RISC-V 汇编有很深入的了解，只需要知道基本的就可以了。

> Q: Which registers contain arguments to functions? For example, which register holds 13 in main's call to printf?

A: 根据 [Calling convensions](https://pdos.csail.mit.edu/6.S081/2020/readings/riscv-calling.pdf) 18.2 章，a0-a7 用来存整形参数，fa0-fa7 用来存浮点参数，13 是第三个参数，在 a2 中。

> Q: Where is the call to function f in the assembly code for main? Where is the call to g? (Hint: the compiler may inline functions.)

A: 都没有，编译器自动把 g(x) 内联进了 f(x)，f(x) 又被内联进了 main()，f(8) + 1 直接被展开为 12。

> Q: At what address is the function printf located?

A: 0x628。

> Q: What value is in the register ra just after the jalr to printf in main?

A: 0x38。ra: return address（返回地址），除此之外，还要知道 s0/fp: frame pointer（帧指针）、sp: stack pointer（栈指针）、sepc: supervised exception program counter（中断返回的地址）。

> Q: Run the following code.
>
> ```c
> unsigned int i = 0x00646c72;
> printf("H%x Wo%s", 57616, &i);
> ```
>
> What is the output?
> If the RISC-V were instead big-endian what would you set i to in order to yield the same output?
> Would you need to change 57616 to a different value?

A: `He110 World`。如果是大端设计，i 应该设成 `0x726c6400`。因为把整数作为字符串打印时，寻址是按字节的，不妨假设地址空间是 00-03，大端和小端都是依次打印 00-03 的字节，说明地址空间应该为 0x72，0x6c，0x64，0x00，拼起来即可。57616 不用变，因为转成 16 进制打印永远是 110。

> Q: In the following code, what is going to be printed after 'y='?
> (note: the answer is not a specific value.) Why does this happen?
>
> ```c
> printf("x=%d y=%d", 3);
> ```

A: 是个随机值，因为提供的参数不足，会打印调用这个代码时 a2 里面的值。

### Backtrace

参考 [lecture notes](https://pdos.csail.mit.edu/6.828/2020/lec/l-riscv-slides.pdf) 里的栈帧图即可，个人感觉应该属于 easy：

```c
void backtrace() {
  printf("backtrace:\n");
  uint64 fp = r_fp();
  uint64 top = PGROUNDUP(fp);

  while (fp != top) {
    uint64 ra = *((uint64 *)(fp - 8));
    printf("%p\n", ra);
    fp = *((uint64 *)(fp - 16));
  }
}
```

### Alarm

#### test0

难点在于 `trap.c` 里 `usertrap` 的修改，为了执行 handler，我一开始的做法是直接通过 `walkaddr` 在页表里找到地址，然后执行：

```c
uint64 addr = walkaddr(p->pagetable, p->handler);
((void (*)()) addr)();
```

但会报错 panic: kerneltrap，思考提示里的 "When a trap on the RISC-V returns to user space, what determines the instruction address at which user-space code resumes execution?" 后想出应该修改 trapframe 里的 epc。

#### test1

这个测试考察寄存器的保存，因为需要恢复中断前执行位置、栈、栈帧以及寄存器，最简单的做法是直接保存调用 handler 前的整个 trapframe，在 `sigreturn` 里恢复。我的做法是只保存 `pc`、`ra`、`sp`、`s0` 和 `a0-a7`。

#### test2

要求不能 re-entrant handler，也即 handler 如果需要较长时间完成，可能会导致上一次还没执行完，就进行了新一次的中断，这会导致死循环，在进程里提供一个标记域标志是否已经在 handler 中即可。

## Lab Lazy Page Allocation

## Eliminate allocation from sbrk()

取消 `sbrk` 里 `growproc` 的调用，只改变 `p->sz` 即可。

调用 `echo hi` 时，进行了如下调用：

`sh.c` 200 行 `malloc`
`umalloc.c` 87 行 `morecore`
`umalloc.c` 54 行 `sbrk`

之后由于 `fork` 后父进程需要调用 `wait`，发生了如下调用：

`trap.c` 75 行 `syscall`
`syscall.c` 139 行，调用 `sys_wait`
`sysproc.c` 38 行，调用 `wait`
`proc.c` 429 行，调用 `freeproc`
`proc.c` 143 行，`proc_freepagetable`
`proc.c` 195 行，`uvmfree`
`vm.c` 298 行，`uvmunmap`
`vm.c` 186 行，`panic`

从而导致发生 panic。

### Lazy allocation

这个 Lab 成功做完后觉得自己写的很差，看了网上 [大佬的博客]([Miigon's blog](https://blog.miigon.net/))，深受启发，又做了部分修改，很推荐看一看。

这步只要让 `echo hi` 能工作即可，没什么实际价值，和后面连起来说。

首先是在 page fault 时分配所需页，需要满足以下条件：

1. `scause` 寄存器值为 13 或 15（分别对应读和写）
2. 地址不超过 `p->sz`
3. 访问的不是 stack 下面的 guard page

其中第三点我一开始试过判断 `PTE_U` 被 clear 来做：

```c
uint64 va = PGROUNDDOWN(stval);
pte_t *pte = walk(p->pagetable, va, 0);
if (pte != 0 && (*pte & PTE_V) == 1 && (*pte & PTE_U) == 0) {
  p->killed = 1; // stack overflow
}
```

尽管正确，但觉得不够优雅，后面换成了和栈指针的距离判断：

```c
PGROUNDUP(stval) != PGROUNDDOWN(p->trapframe->sp)
```

之后就是做内存分配，一开始我直接写在 `trap.c` 的 `usertrap` 函数里，这导致后面处理 syscall 的用户指针未分配时不能复用，又要调用 `uvmalloc` 并对它进行修改，防止可能中间某段地址 map 过，导致 `mappages` 里 panic，最后改成在 `vm.c` 里新增函数：

```c
int lazyalloc(pagetable_t pagetable, uint64 va) {
  char *mem = kalloc();
  if(mem == 0){
    return -1; // kalloc fails, kill process
  }
  memset(mem, 0, PGSIZE);
  if(mappages(pagetable, va, PGSIZE, (uint64)mem, PTE_W|PTE_X|PTE_R|PTE_U) != 0){
    kfree(mem);
    uvmdealloc(pagetable, va, va);
    panic("lazyalloc");
  }
  return 0;
}
```

这会报错 `incomplete type proc`，实验文档中解释道要在 `vm.c` 中 `#include "spinlock.h"` 然后 `#include "proc.h"`。

还需要修改一些 unmap 的函数，防止它们遇到未分配的页时 panic。

首先是 `uvmunmap`，在没有找到 entry 或是 entry 的 valid bit 无效时都直接跳过。然后是 `uvmcopy`，这在 `fork` 时会用到，父进程的 entry 可能也还未分配。

需要正确处理 `sbrk` 的负数参数：直接调用 `uvmdealloc`：

```c
uint64 sys_sbrk(void) {
  int addr;
  int n;

  if(argint(0, &n) < 0)
    return -1;

  struct proc *p = myproc();
  addr = p->sz;
  if (n > 0) {
    p->sz += n; // lazy allocation
  } else {
    p->sz = uvmdealloc(p->pagetable, p->sz, p->sz + n);
  }
  return addr;
}
```

最后还要处理 syscall 地址有效但还未分配，我一开始是处理了 `sysfile.c` 里三个相关 syscall 函数，`read`、`write` 和 `pipe`：

```c
uint64 sys_read(void) {
  ...
  if(argfd(0, 0, &f) < 0 || argint(2, &n) < 0 || argaddr(1, &p) < 0)
    return -1;

  struct proc *process = myproc();
  if (p + n < process->sz) {
    uvmalloc(process->pagetable, p, p + n);
  }

  return fileread(f, p, n);
}

uint64 sys_pipe(void) {
  ...
  if((fd0 = fdalloc(rf)) < 0 || (fd1 = fdalloc(wf)) < 0){
    if(fd0 >= 0)
      p->ofile[fd0] = 0;
    fileclose(rf);
    fileclose(wf);
    return -1;
  }

  uvmalloc(p->pagetable, fdarray, fdarray + sizeof(fd0) + sizeof(fd1));
  ...
}
```

修改 `uvmalloc`：

```c
uint64 uvmalloc(pagetable_t pagetable, uint64 oldsz, uint64 newsz) {
  ...
  for(a = oldsz; a < newsz; a += PGSIZE){
    if (walkaddr(pagetable, a) != 0) {
      continue;
    }
    ...
  }
  return newsz;
}
```

参考大佬博客后发现根源都在 `copyin` 和 `copyout`，只做这两个函数的修改即可：

```c
int copyout(pagetable_t pagetable, uint64 dstva, char *src, uint64 len) {
  uint64 n, va0, pa0;

  while(len > 0){
    va0 = PGROUNDDOWN(dstva);

    // 防止 syscall 的 user page 还没分配
    pte_t *pte;
    if (va0 < myproc()->sz &&
        ((pte = walk(pagetable, va0, 0)) == 0 ||
        (*pte & PTE_V) == 0)) {
      lazyalloc(pagetable, va0);
    }
    ...
  }
  return 0;
}

// Copy from user to kernel.
// Copy len bytes to dst from virtual address srcva in a given page table.
// Return 0 on success, -1 on error.
int copyin(pagetable_t pagetable, char *dst, uint64 srcva, uint64 len) {
  uint64 n, va0, pa0;

  while(len > 0){
    va0 = PGROUNDDOWN(srcva);
    pte_t *pte;
    if (va0 < myproc()->sz &&
        ((pte = walk(pagetable, va0, 0)) == 0 ||
        (*pte & PTE_V) == 0)) {
      lazyalloc(pagetable, va0);
    }
    ...
  }
  return 0;
}
```

