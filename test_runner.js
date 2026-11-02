const { spawn } = require('child_process');
const net = require('net');

function checkPort(port) {
  return new Promise(resolve => {
    const s = net.createConnection({ port, host: '127.0.0.1' }, () => {
      s.end();
      resolve(true);
    });
    s.on('error', () => resolve(false));
  });
}

function runScript(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [file], { stdio: 'inherit' });
    p.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${file} exited with code ${code}`));
    });
  });
}

async function main() {
  const isRunning = await checkPort(3000);
  let serverProcess = null;
  if (!isRunning) {
    serverProcess = spawn(process.execPath, ['server.js'], { stdio: 'ignore' });
    for (let i = 0; i < 25; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (await checkPort(3000)) break;
    }
  }

  try {
    await runScript('test_suite.js');
    await runScript('security_audit_test.js');
  } finally {
    if (serverProcess) {
      try { serverProcess.kill(); } catch (e) {}
    }
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
