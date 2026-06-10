// Dev launcher: opens the server and client each in their OWN terminal window.
//
// Why not `concurrently`? On Windows, `tsx watch` spawns a child process and
// relies on a real console (TTY). Under `concurrently` the stdio is piped with
// no TTY, and the watch child fails to keep the server alive — the port never
// binds and the client gets ECONNREFUSED. Two separate terminals give each
// process its own console, which works reliably.

import { spawn } from 'node:child_process';
import process from 'node:process';

const cwd = process.cwd();

const tasks = [
  { name: 'SERVER', script: 'npm run dev:server' },
  { name: 'CLIENT', script: 'npm run dev:client' },
];

function launch({ name, script }) {
  switch (process.platform) {
    case 'win32':
      // `start` opens a new VISIBLE console window; the quoted token is its
      // title. -NoExit keeps the window open after the command runs so you can
      // read the logs (and any errors). windowsVerbatimArguments avoids Node
      // re-quoting the command string.
      return spawn(
        'cmd.exe',
        ['/c', 'start', `"${name}"`, 'powershell', '-NoExit', '-Command', script],
        { cwd, detached: true, stdio: 'ignore', windowsVerbatimArguments: true },
      );
    case 'darwin':
      return spawn(
        'osascript',
        ['-e', `tell application "Terminal" to do script "cd '${cwd}' && ${script}"`],
        { detached: true, stdio: 'ignore' },
      );
    default:
      // Linux: requires a terminal emulator on PATH.
      return spawn(
        'x-terminal-emulator',
        ['-e', `bash -c "cd '${cwd}' && ${script}; exec bash"`],
        { detached: true, stdio: 'ignore' },
      );
  }
}

for (const task of tasks) {
  const child = launch(task);
  child.unref();
  console.log(`Launched ${task.name} -> ${task.script}`);
}

console.log('\nTwo terminals opened. Wait for "Cortex server running" in the SERVER window before querying.');
