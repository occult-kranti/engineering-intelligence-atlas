"""Linux-only fixed process guard for the owner-configured creative executables.

No shell, user script, environment lookup or command template is evaluated.
The daemon supplies all limits and arguments after its operation validation.
"""
import ctypes
import os
import resource
import signal
import sys


def main():
    if sys.platform != "linux" or len(sys.argv) < 6:
        raise RuntimeError("A Linux runtime and fixed launch arguments are required")
    parent, seconds, memory, output = (int(item) for item in sys.argv[1:5])
    executable = sys.argv[5]
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
    resource.setrlimit(resource.RLIMIT_AS, (memory, memory))
    resource.setrlimit(resource.RLIMIT_FSIZE, (output, output))
    resource.setrlimit(resource.RLIMIT_NOFILE, (256, 256))
    os.execve(executable, sys.argv[5:], dict(os.environ))


if __name__ == "__main__":
    main()
