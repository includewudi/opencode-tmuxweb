#!/usr/bin/env python3
"""
PTY helper: spawns a shell inside a real pseudoterminal.
Bridges stdin/stdout between the calling process and the PTY.
Usage: python3 pty_helper.py [shell] [cols] [rows]
"""
import sys
import os
import pty
import select
import signal
import struct
import fcntl
import termios

def set_winsize(fd, rows, cols):
    """Set the window size of a PTY."""
    winsize = struct.pack('HHHH', rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

def main():
    shell = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('SHELL', '/bin/zsh')
    cols = int(sys.argv[2]) if len(sys.argv) > 2 else 80
    rows = int(sys.argv[3]) if len(sys.argv) > 3 else 24

    # Create a new PTY
    master_fd, slave_fd = pty.openpty()
    
    # Set initial window size
    set_winsize(master_fd, rows, cols)

    # Fork the shell
    pid = os.fork()
    if pid == 0:
        # Child: set up the slave PTY as stdin/stdout/stderr
        os.close(master_fd)
        os.setsid()
        
        # Make slave_fd the controlling terminal
        fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)
        
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        if slave_fd > 2:
            os.close(slave_fd)
        
        os.environ['TERM'] = 'xterm-256color'
        os.environ['COLUMNS'] = str(cols)
        os.environ['LINES'] = str(rows)
        
        os.execv(shell, [shell])
    else:
        # Parent: bridge stdin <-> master_fd
        os.close(slave_fd)
        
        # Make stdin non-blocking
        stdin_fd = sys.stdin.fileno()
        
        # Handle SIGWINCH to resize PTY (cols:rows sent as special escape)
        def handle_sigwinch(signo, frame):
            pass
        signal.signal(signal.SIGWINCH, handle_sigwinch)
        
        try:
            while True:
                rlist, _, _ = select.select([stdin_fd, master_fd], [], [], 0.1)
                
                if stdin_fd in rlist:
                    data = os.read(stdin_fd, 4096)
                    if not data:
                        break
                    
                    # Check for resize command: \x1b]resize;COLS;ROWS\x07
                    if b'\x1b]resize;' in data:
                        parts = data.split(b'\x1b]resize;')
                        for part in parts:
                            if b'\x07' in part:
                                cmd, rest = part.split(b'\x07', 1)
                                try:
                                    c, r = cmd.decode().split(';')
                                    set_winsize(master_fd, int(r), int(c))
                                    # Send SIGWINCH to the shell
                                    os.kill(pid, signal.SIGWINCH)
                                except:
                                    pass
                                if rest:
                                    os.write(master_fd, rest)
                            else:
                                if part:
                                    os.write(master_fd, part)
                    else:
                        os.write(master_fd, data)
                
                if master_fd in rlist:
                    try:
                        data = os.read(master_fd, 4096)
                        if not data:
                            break
                        os.write(sys.stdout.fileno(), data)
                        sys.stdout.flush()
                    except OSError:
                        break
        except (IOError, OSError):
            pass
        finally:
            os.close(master_fd)
            try:
                os.kill(pid, signal.SIGTERM)
                os.waitpid(pid, 0)
            except:
                pass

if __name__ == '__main__':
    main()
