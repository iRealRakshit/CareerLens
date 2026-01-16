CareerLens on macOS — Install & Run
===================================

This guide walks you through installing Ollama on macOS and running CareerLens locally.

Prerequisites
- macOS 12+ (Apple Silicon or Intel)
- Python 3.9+ (check with `python3 --version`)

1) Install Ollama (macOS)
- Using Homebrew (recommended):
  - `brew install ollama`
  - If you don’t have Homebrew: https://brew.sh
- Or download the mac app: https://ollama.com/download
  - Open the .dmg, drag Ollama to Applications, then launch it once.

2) Verify Ollama CLI
- Open Terminal and run:
  - `ollama --version`
  - `ollama list`
  - If you see “command not found”, ensure Homebrew is on PATH or launch the Ollama app once so it initializes the CLI.

3) Pull the model used by CareerLens
- `ollama pull llama3.1`

4) Get CareerLens locally
- Place the CareerLens project folder anywhere (e.g., `~/Projects/CareerLens`).
- Change into the folder:
  - `cd ~/Projects/CareerLens`

5) Run CareerLens
- Start the local server (no extra dependencies required):
  - `python3 server.py`
- Open your browser at:
  - `http://127.0.0.1:8000`

6) Optional configuration
- Use a different model:
  - `CAREERLENS_MODEL=mistral python3 server.py`
- Bind to all interfaces (LAN):
  - `HOST=0.0.0.0 python3 server.py`
- Change port:
  - `PORT=8080 python3 server.py`
- If the `ollama` CLI is not on PATH, point to its binary explicitly:
  - `OLLAMA_CMD="/usr/local/bin/ollama" python3 server.py`
  - or (Apple Silicon default) `OLLAMA_CMD="/opt/homebrew/bin/ollama" python3 server.py`

7) Quick sanity checks
- Test that Ollama answers:
  - `ollama run llama3.1`
- From your browser, open diagnostics:
  - `http://127.0.0.1:8000/api/diag`
  - Confirms Ollama version, model presence, and a short generation status.

Troubleshooting
- “Checking Ollama…” never updates:
  - Confirm `http://127.0.0.1:8000/api/diag` loads and shows `ollama_which` and `ollama_list` results.
  - Ensure the model is installed: `ollama pull llama3.1`.
  - If `ollama` is not found, use `OLLAMA_CMD` with the full path (see step 6).
- “Permission denied” or blocked app:
  - Open System Settings → Privacy & Security → Allow apps from identified developers; re‑launch Ollama.
- Firewall prompts:
  - Allow local network connections for “Python” (the server) and “Ollama”.
- Slow first response:
  - The first generation may take longer while the model warms up.

That’s it — CareerLens should now be running locally on macOS with all AI powered by your local Ollama model.

