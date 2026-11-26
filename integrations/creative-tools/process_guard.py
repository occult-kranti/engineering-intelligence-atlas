"""Linux-only fixed process guard for the owner-configured creative executables.

No shell, user script, environment lookup or command template is evaluated.
The daemon supplies all limits and arguments after its operation validation.
"""
import ctypes
import os
from pathlib import Path, PurePosixPath
import resource
import signal
import sys


class GpuMemoryPrerequisite(RuntimeError):
    pass


def verified_cgroup_memory_limit(memory, read_text=None):
    """Read the kernel cgroup-v2 limit for this process; never trust an env flag.

    CPU jobs retain RLIMIT_AS. GPU mappings may reserve large virtual ranges,
    so they instead require a finite kernel memory.max at least as restrictive
    as the configured byte allowance. Unknown layouts fail closed.
    """
    read_text = read_text or (lambda filename: Path(filename).read_text())
    try:
        entries = [line.split(":", 2)[2] for line in read_text("/proc/self/cgroup").splitlines()
                   if line.startswith("0::")]
        if len(entries) != 1:
            raise ValueError("No unique unified cgroup")
        membership = PurePosixPath(entries[0])
        if not membership.is_absolute() or ".." in membership.parts:
            raise ValueError("Invalid cgroup membership")
        mounts = []
        for line in read_text("/proc/self/mountinfo").splitlines():
            before, separator, after = line.partition(" - ")
            fields = before.split()
            if separator and after.split()[0] == "cgroup2" and len(fields) >= 6:
                root, mounted = fields[3], fields[4]
                # These fixed kernel paths contain no escaping in supported
                # Docker/systemd layouts. Refuse ambiguous alternative mounts.
                if mounted == "/sys/fs/cgroup" and "\\" not in root:
                    mounts.append(PurePosixPath(root))
        if len(mounts) != 1 or not mounts[0].is_absolute() or ".." in mounts[0].parts:
            raise ValueError("Unsupported cgroup mount")
        relative = membership.relative_to(mounts[0])
        mount = PurePosixPath("/sys/fs/cgroup")
        current = mount / relative
        limits = []
        while True:
            try:
                raw = read_text(str(current / "memory.max")).strip()
            except FileNotFoundError:
                # The host hierarchy's root has no memory controller limit.
                # A namespaced container root may have one and is read above.
                if current != mount:
                    raise
                raw = "max"
            if raw != "max":
                if not raw.isdecimal() or int(raw) < 1:
                    raise ValueError("Invalid cgroup memory limit")
                limits.append(int(raw))
            if current == mount:
                break
            current = current.parent
        effective = min(limits) if limits else None
        if effective is None or effective > memory:
            raise ValueError("Unbounded or wider cgroup memory allowance")
        return effective
    except (OSError, ValueError, IndexError) as error:
        raise GpuMemoryPrerequisite("GPU rendering requires a verified cgroup-v2 memory.max no larger than maxMemoryBytes") from error


def main():
    if sys.platform != "linux" or len(sys.argv) < 6:
        raise RuntimeError("A Linux runtime and fixed launch arguments are required")
    parent, seconds, memory, output = (int(item) for item in sys.argv[1:5])
    gpu = sys.argv[5] == "--gpu-cgroup"
    arguments = sys.argv[6:] if gpu else sys.argv[5:]
    if not arguments:
        raise ValueError("Missing fixed executable")
    executable = arguments[0]
    if parent < 1 or not 1 <= seconds <= 1201 or not 268435456 <= memory <= 17179869184 or not 1024 <= output <= 104857600:
        raise ValueError("Invalid fixed process limits")
    # A daemon crash must not leave its immediate creative process rendering.
    # Set the death signal before comparing parent identity to close the race.
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(1, signal.SIGKILL, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), "Cannot set parent-death signal")
    if os.getppid() != parent:
        raise RuntimeError("Creative controller exited before launch")
    resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
    resource.setrlimit(resource.RLIMIT_CPU, (seconds, seconds))
    if gpu:
        try:
            verified_cgroup_memory_limit(memory)
        except GpuMemoryPrerequisite:
            print("DAFTAR_GUARD_ERROR=GPU_CGROUP_REQUIRED", file=sys.stderr, flush=True)
            return 78
    else:
        resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
    resource.setrlimit(resource.RLIMIT_FSIZE, (output, output))
    resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
    os.execve(executable, arguments, dict(os.environ))


if __name__ == "__main__":
    sys.exit(main())
