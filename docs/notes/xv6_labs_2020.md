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
        printf("%d %s: unknown sys call %d\n",
            p->pid, p->name, num);
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
