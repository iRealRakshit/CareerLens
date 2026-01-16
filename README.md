CareerLens – Smart Career Path & Market Insight Platform
=======================================================

Local, privacy‑friendly career guidance web app powered by your Ollama model (`llama3.1`). No external web APIs are used. All AI comes from your local Ollama through the CLI.

What’s inside
- Python single‑file server (`server.py`) — no external Python deps
- Multi‑page UI (`static/*.html`) — vanilla HTML/CSS/JS, tiny canvas charts
- Endpoints that invoke your local Ollama CLI to generate all insights (no mock data, no network APIs)

Prerequisites
- Python 3.9+
- Ollama installed locally and available on PATH (CLI `ollama`)
- Model available: `ollama pull llama3.1`

Quick start
1) Ensure the model is present:
   - `ollama pull llama3.1`
2) Run the web app (from the project folder):
   - `python server.py`
3) Open your browser: `http://127.0.0.1:8000`

macOS users
- See step‑by‑step setup: `docs/MAC.md:1`

Pages
- `http://127.0.0.1:8000/` — Home
- `http://127.0.0.1:8000/quiz` — AI Career Compatibility Test
- `http://127.0.0.1:8000/insights` — Market Insight Dashboard
- `http://127.0.0.1:8000/recommend` — Smart Recommendations
- `http://127.0.0.1:8000/compare` — Career Comparison
- `http://127.0.0.1:8000/resume` — Resume & Portfolio Enhancer

Config (optional)
- Change port: `PORT=8080 python server.py`
- Change bind address: `HOST=0.0.0.0 python server.py` (LAN access)
- Pick a different model: `CAREERLENS_MODEL=mistral python server.py`
- Custom Ollama command path: `OLLAMA_CMD="C:\\path\\to\\ollama.exe" python server.py`

Speed tips (fast responses)
- Enable fast mode (caps output tokens for quicker replies):
  - `CAREERLENS_FAST=1 python server.py`
- Fine-tune generation with extra Ollama flags (example):
  - `OLLAMA_FLAGS="--num-predict 200 --temperature 0.2" python server.py`
- Use a smaller/faster model:
  - `CAREERLENS_MODEL=llama3.2:1b python server.py`
- Keep Ollama warm by running it once before demos to avoid cold starts.

Key features
- AI Career Compatibility Test — 10 Q quiz → top 3 matching careers with reasoning
- Market Insight Dashboard — demand trend (5y), salary by region, skills, and forecast
- Smart Recommendations — learning paths, week‑by‑week roadmap, resume tips
- Career Comparison — side‑by‑side metrics for two roles
- Resume & Portfolio Enhancer — ATS‑style score, missing keywords, feedback, projects/certs

Notes
- All analytics come from your local model (no remote API calls). The server does not use Ollama’s HTTP API; it shells out to the `ollama` CLI.
- Charts are rendered locally without external libraries.
- If JSON output looks off, your model may not fully honor `format: "json"`. The server attempts to recover by extracting JSON blocks.

Troubleshooting
- `ollama` command not found: add Ollama to PATH or set `OLLAMA_CMD` env var to its full path.
- Firewall prompts: allow local connections for Python.
- Model too slow: try a smaller model or reduce context.

Security & privacy
- Your data stays local. The browser reads resume files on the client and sends extracted text to the local server only.
