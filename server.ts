import express from "express";
import { spawn } from "child_process";
import httpProxy from "http-proxy";
import path from "path";
import fs from "fs";
import https from "https";

const app = express();
const PORT = 3000;
const FLASK_PORT = 5000;

// Create uploads folder if missing so python and node share it
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const LOG_FILE = path.join(process.cwd(), "flask_logs.txt");
// Reset or create log file on startup
fs.writeFileSync(LOG_FILE, `--- PollutionWatch Pipeline Log Start: ${new Date().toISOString()} ---\n`);

function logToFile(msg: string) {
  const formatted = `[${new Date().toISOString()}] ${msg}`;
  console.log(formatted);
  fs.appendFileSync(LOG_FILE, formatted + "\n");
}

logToFile("Starting PollutionWatch Node.js & Flask Proxy System");

// Installs python dependencies from requirements.txt on startup
logToFile("Step 1/2: Checking and installing Python dependencies...");

function downloadAndInstallPip(callback: () => void) {
  const dest = path.join(process.cwd(), "get-pip.py");
  logToFile(`Downloading get-pip.py from bootstrap.pypa.io to ${dest}...`);
  
  const file = fs.createWriteStream(dest);
  https.get("https://bootstrap.pypa.io/get-pip.py", (response) => {
    response.pipe(file);
    file.on("finish", () => {
      file.close();
      logToFile("Downloaded get-pip.py. Running installation...");
      
      const child = spawn("python3", [dest]);
      child.stdout.on("data", (data) => {
        logToFile(`[get-pip] ${data.toString().trim()}`);
      });
      child.stderr.on("data", (data) => {
        logToFile(`[get-pip stderr] ${data.toString().trim()}`);
      });
      child.on("close", (code) => {
        // Clean up get-pip.py
        try { fs.unlinkSync(dest); } catch {}
        if (code === 0) {
          logToFile("pip installed successfully using get-pip.py!");
          callback();
        } else {
          logToFile(`get-pip.py exited with code ${code}.`);
          callback(); // Try anyway
        }
      });
    }).on("error", (err) => {
      try { fs.unlinkSync(dest); } catch {}
      logToFile(`Error writing get-pip.py: ${err.message}`);
      callback();
    });
  }).on("error", (err) => {
    try { fs.unlinkSync(dest); } catch {}
    logToFile(`Error downloading get-pip.py: ${err.message}`);
    callback();
  });
}

function bootstrapPip(callback: () => void) {
  logToFile("Attempting to bootstrap pip using ensurepip...");
  const child = spawn("python3", ["-m", "ensurepip", "--default-pip"]);
  
  child.on("error", (err) => {
    logToFile(`ensurepip failed to spawn: ${err.message}`);
    downloadAndInstallPip(callback);
  });

  child.stdout.on("data", (data) => {
    logToFile(`[ensurepip] ${data.toString().trim()}`);
  });

  child.stderr.on("data", (data) => {
    logToFile(`[ensurepip stderr] ${data.toString().trim()}`);
  });

  child.on("close", (code) => {
    if (code === 0) {
      logToFile("pip bootstrapped successfully using ensurepip!");
      callback();
    } else {
      logToFile(`ensurepip exited with code ${code}. Attempting get-pip.py fallback...`);
      downloadAndInstallPip(callback);
    }
  });
}

function startPythonPipeline() {
  const attempts = [
    { cmd: "python3", args: ["-m", "pip", "install", "-r", "requirements.txt"] },
    { cmd: "pip3", args: ["install", "-r", "requirements.txt"] },
    { cmd: "pip", args: ["install", "-r", "requirements.txt"] },
    { cmd: "python", args: ["-m", "pip", "install", "-r", "requirements.txt"] }
  ];

  let attemptIndex = 0;

  function tryNextInstall() {
    if (attemptIndex >= attempts.length) {
      logToFile("All pip install attempts failed. Trying to start Flask anyway...");
      startFlask();
      return;
    }

    const { cmd, args } = attempts[attemptIndex];
    logToFile(`Attempting installation with: ${cmd} ${args.join(" ")}`);
    
    let started = false;
    try {
      const child = spawn(cmd, args);

      child.on("error", (err) => {
        logToFile(`Installation attempt with '${cmd}' failed to spawn: ${err.message}`);
        if (!started) {
          started = true;
          attemptIndex++;
          tryNextInstall();
        }
      });

      child.stdout.on("data", (data) => {
        const line = data.toString().trim();
        if (line) logToFile(`[${cmd}] ${line}`);
      });

      child.stderr.on("data", (data) => {
        const line = data.toString().trim();
        if (line) logToFile(`[${cmd} stderr] ${line}`);
      });

      child.on("close", (code) => {
        if (started) return;
        started = true;
        if (code === 0) {
          logToFile(`Dependencies installed successfully using ${cmd}!`);
          startFlask();
        } else {
          logToFile(`Installation with ${cmd} exited with code ${code}. Trying next...`);
          attemptIndex++;
          tryNextInstall();
        }
      });
    } catch (e: any) {
      logToFile(`Exception spawning ${cmd}: ${e.message}`);
      if (!started) {
        started = true;
        attemptIndex++;
        tryNextInstall();
      }
    }
  }

  function startFlask() {
    const pythonExecs = ["python3", "python"];
    let pyIndex = 0;

    function tryNextFlask() {
      if (pyIndex >= pythonExecs.length) {
        logToFile("All Python launch attempts failed.");
        return;
      }

      const pyCmd = pythonExecs[pyIndex];
      logToFile(`Attempting to launch Flask with: ${pyCmd} app.py`);

      try {
        const flaskProcess = spawn(pyCmd, ["app.py"]);
        let started = false;

        flaskProcess.on("error", (err) => {
          logToFile(`Flask launch attempt with ${pyCmd} failed to spawn: ${err.message}`);
          if (!started) {
            started = true;
            pyIndex++;
            tryNextFlask();
          }
        });

        flaskProcess.stdout.on("data", (data) => {
          logToFile(`[Flask Python] ${data.toString().trim()}`);
        });

        flaskProcess.stderr.on("data", (data) => {
          const str = data.toString().trim();
          if (str) {
            const lowerStr = str.toLowerCase();
            const isActualError = (lowerStr.includes("traceback") || lowerStr.includes("exception") || lowerStr.includes("failed to") || lowerStr.includes("modulenotfound")) && !lowerStr.includes("development server") && !lowerStr.includes("debugger") && !lowerStr.includes("restart with stat");
            if (isActualError) {
              logToFile(`[Flask Stderr Alert] ${str}`);
            } else {
              logToFile(`[Flask Python Log] ${str}`);
            }
          }
        });

        flaskProcess.on("close", (code) => {
          if (started) return;
          started = true;
          logToFile(`Flask process (${pyCmd}) terminated with code ${code}`);
          if (code !== 0) {
            pyIndex++;
            tryNextFlask();
          }
        });
      } catch (e: any) {
        logToFile(`Exception launching Flask with ${pyCmd}: ${e.message}`);
        pyIndex++;
        tryNextFlask();
      }
    }

    tryNextFlask();
  }

  bootstrapPip(tryNextInstall);
}

startPythonPipeline();

// Create http proxy instance to redirect traffic from port 3000 to 5000
const proxy = httpProxy.createProxyServer({});

// Handle proxy errors gracefully (e.g. before flask has fully booted up)
proxy.on("error", (err, req, res: any) => {
  console.error("Proxy error:", err.message);
  if (!res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/html" });
    res.end(`
      <html>
        <head>
          <title>Starting Application...</title>
          <meta http-equiv="refresh" content="3">
          <style>
            body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f8fafc; color: #0f172a; text-align: center; }
            .card { background: white; border: 1px solid #e2e8f0; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; }
            h2 { color: #4f46e5; margin-top: 0; font-weight: 800; }
            p { font-size: 0.9rem; color: #64748b; line-height: 1.5; }
            .spinner { border: 3px solid #f1f5f9; border-top: 3px solid #4f46e5; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin: 1.5rem auto 0; }
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Initializing Pipeline...</h2>
            <p>Please wait a few seconds while we verify and boot your Python Flask & LangChain container backend.</p>
            <div class="spinner"></div>
          </div>
        </body>
      </html>
    `);
  }
});

// Route everything through the proxy to Flask
app.all("*", (req, res) => {
  proxy.web(req, res, { target: `http://127.0.0.1:${FLASK_PORT}` });
});

// Listen on port 3000 (standard for the sandbox)
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Node.js proxy listener successfully bound to port ${PORT}`);
});
