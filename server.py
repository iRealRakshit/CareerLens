import json
import os
import posixpath
import traceback
import shutil
import urllib.parse
import threading
import time
import hashlib
from groq import Groq
from http.server import HTTPServer, SimpleHTTPRequestHandler
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure Groq API
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY environment variable not set!")
client = Groq(api_key=GROQ_API_KEY)
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama-3.1-8b-instant")

# Host and Port configuration (for local development)
# In production, Gunicorn will handle this.
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))


def call_groq(prompt: str) -> str:
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
            model=GROQ_MODEL,
        )
        return chat_completion.choices[0].message.content
    except Exception as e:
        raise RuntimeError(f"Groq API call failed: {e}")


def ensure_json_response(text: str):
    # Remove markdown code block fences if present
    if text.strip().startswith("```json"):
        text = text.strip()[len("```json"):].strip()
        if text.strip().endswith("```"):
            text = text.strip()[:-len("```")].strip()
    elif text.strip().startswith("```"):
        text = text.strip()[len("```"):].strip()
        if text.strip().endswith("```"):
            text = text.strip()[:-len("```")].strip()

    # Try to parse model output as JSON, otherwise attempt extraction of object or array
    # 1) Direct parse
    try:
        return json.loads(text)
    except Exception:
        pass
    # 2) Extract first {{...}}
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        snippet = text[start : end + 1]
        try:
            return json.loads(snippet)
        except Exception:
            pass
    # 3) Extract first [...]
    lb = text.find("[")
    rb = text.rfind("]")
    if lb != -1 and rb != -1 and rb > lb:
        snippet = text[lb : rb + 1]
        try:
            return json.loads(snippet)
        except Exception:
            pass
    return {"error": "Model did not return valid JSON", "raw": text}


# Simple in-memory cache with TTL for faster repeat responses
_CACHE: dict = {}
_CACHE_LIMIT = 256

def _cache_get(key: str):
    now = time.time()
    entry = _CACHE.get(key)
    if not entry:
        return None
    exp, val = entry
    if exp < now:
        try:
            del _CACHE[key]
        except Exception:
            pass
        return None
    return val

def _cache_set(key: str, value, ttl: int = 900):
    # TTL defaults to 15 minutes; tighter or looser per endpoint below
    try:
        if len(_CACHE) > _CACHE_LIMIT:
            # naive purge: remove expired or oldest items
            for k in list(_CACHE.keys())[: len(_CACHE)//2]:
                _CACHE.pop(k, None)
        _CACHE[key] = (time.time() + ttl, value)
    except Exception:
        pass


def _heuristic_job_suggestions(resume_text: str, target_role: str = ""):
    txt = (resume_text or "")
    low = txt.lower()
    def has(*keys):
        return any(k in low for k in keys)
    # Rough experience level detection
    level = "entry"
    if "intern" in low or "internship" in low:
        level = "entry"
    else:
        import re
        m = re.search(r"(\d+)\+?\s*(years|yrs)", low)
        years = int(m.group(1)) if m else 0
        if years >= 7:
            level = "senior"
        elif years >= 4:
            level = "mid"
        elif years >= 2:
            level = "junior"
        else:
            level = "entry"

    roles = []
    def add(title, why, score):
        roles.append({"title": title, "level": level, "why_fit": why, "_score": score})

    # Keyword-based scoring
    score = 0
    if has("python", "pandas", "numpy", "sklearn", "sql"):
        score = sum(1 for k in ["python","pandas","numpy","sql","excel","tableau","power bi"] if k in low)
        if has("tensorflow","pytorch","scikit"):
            add("Data Scientist", "ML libraries and data tools present", score + 2)
        add("Data Analyst", "Data tools (" + ", ".join([k for k in ["sql","excel","tableau","power bi","python"] if k in low]) + ")", score)
    if has("react", "javascript", "typescript"):
        score = sum(1 for k in ["react","typescript","javascript","next.js"] if k in low)
        add("Frontend Developer", "Web stack (" + ", ".join([k for k in ["react","typescript","javascript"] if k in low]) + ")", score)
    if has("node", "express", "java", "spring", "django", "flask"):
        score = sum(1 for k in ["node","express","java","spring","django","flask","go",".net"] if k in low)
        add("Backend Developer", "Backend frameworks present", score)
    if has("aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ci/cd"):
        score = sum(1 for k in ["aws","azure","gcp","docker","kubernetes","terraform","jenkins","ci/cd"] if k in low)
        add("Cloud/DevOps Engineer", "Cloud/DevOps tooling experience", score)
    if has("figma", "ux", "ui", "sketch"):
        score = sum(1 for k in ["figma","ux","ui","sketch","wireframe"] if k in low)
        add("UI/UX Designer", "Design tools and UX keywords", score)
    if has("excel", "tableau", "power bi") and not any(r["title"].startswith("Data") for r in roles):
        score = sum(1 for k in ["excel","tableau","power bi","sql"] if k in low)
        add("Business Analyst", "BI/analytics tools present", score)
    if has("qa", "testing", "selenium", "cypress"):
        score = sum(1 for k in ["qa","testing","selenium","cypress","jest"] if k in low)
        add("QA Engineer", "Test frameworks and QA focus", score)
    if has("security", "cyber", "soc"):
        score = sum(1 for k in ["security","cyber","siem","soc","splunk"] if k in low)
        add("Security Analyst", "Security keywords present", score)
    if has("marketing", "seo", "content", "social"):
        score = sum(1 for k in ["marketing","seo","content","social"] if k in low)
        add("Digital Marketing Specialist", "Marketing stack keywords present", score)
    if has("salesforce"):
        add("Salesforce Administrator", "Salesforce keyword present", 1)
    if has("project management", "scrum", "jira"):
        add("Project Coordinator", "Project management tools present", 1)

    # Include target role if provided and absent
    if (target_role or "").strip():
        tr = (target_role or "").strip()
        if not any(r["title"].lower() == tr.lower() for r in roles):
            add(tr, "Matches your target role", 0)

    # De-duplicate by title and sort by score desc
    uniq = {}
    for r in roles:
        t = r["title"].strip()
        if t and (t not in uniq or r.get("_score", 0) > uniq[t].get("_score", 0)):
            uniq[t] = r
    out = list(uniq.values())
    out.sort(key=lambda x: x.get("_score", 0), reverse=True)
    # Strip internal keys
    for r in out:
        r.pop("_score", None)
    return out[:4]


def _heuristic_matches_from_answers(answers):
    try:
        txt = " \n ".join([str(a) for a in (answers or [])])
    except Exception:
        txt = str(answers)
    low = txt.lower()
    found = []
    def score_for(keys):
        return sum(1 for k in keys if k in low)
    candidates = []
    # Role candidate tuples: (title, keywords, personality, extra_skills)
    candidates.append(("Data Analyst", ["python","sql","excel","tableau","power bi","statistics","pandas"], ["Analytical","Detail-oriented"], ["SQL","Excel"]))
    candidates.append(("Data Scientist", ["tensorflow","pytorch","ml","machine learning","sklearn","deep learning"], ["Curious","Analytical"], ["ML","Python"]))
    candidates.append(("Frontend Developer", ["react","javascript","typescript","css","html","ui"], ["Creative","User-focused"], ["React","JS"]))
    candidates.append(("Backend Developer", ["node","express","java","spring","django","flask","api"], ["System-thinking","Problem-solving"], ["APIs","Databases"]))
    candidates.append(("UI/UX Designer", ["figma","ui","ux","wireframe","prototype","design"], ["Empathy","Creative"], ["Figma","Prototyping"]))
    candidates.append(("Business Analyst", ["excel","tableau","power bi","stakeholder","requirements"], ["Communicator","Analytical"], ["Dashboards","KPIs"]))
    candidates.append(("Cloud/DevOps Engineer", ["aws","azure","gcp","docker","kubernetes","ci/cd","terraform"], ["Pragmatic","Reliable"], ["CI/CD","Cloud"]))
    for title, keys, persona, extra in candidates:
        sc = score_for(keys)
        if sc:
            found.append({
                "title": title,
                "score": sc,
                "personality": persona,
                "skills": [k.upper() for k in keys if k in low][:5] or extra,
            })
    if not found:
        # default generic
        found.append({"title": "Generalist (Explore)", "score": 1, "personality": ["Curious"], "skills": ["Communication","Basics"]})
    found.sort(key=lambda x: x["score"], reverse=True)
    matches = []
    for f in found[:3]:
        conf = min(90, 40 + f["score"] * 10)
        matches.append({
            "role": f["title"],
            "confidence": conf,
            "reasoning": f"Signals found in your answers (e.g., {', '.join(f['skills'])}).",
            "personality_fit": f["personality"],
            "skills_fit": f["skills"],
        })
    return matches


class CareerLensHandler(SimpleHTTPRequestHandler):

    def translate_path(self, path):
        # Serve files from ./static by default
        path = path.split("?", 1)[0]
        path = path.split("#", 1)[0]
        path = posixpath.normpath(urllib.parse.unquote(path))
        if path == "/":
            return os.path.join(os.getcwd(), "static", "index.html")
        # pretty routes -> static pages
        pretty = {
            "/quiz": "quiz.html",
            "/insights": "insights.html",
            "/recommend": "recommend.html",
            "/compare": "compare.html",
            "/resume": "resume.html",
            "/grow": "grow.html",
        }
        if path in pretty:
            return os.path.join(os.getcwd(), "static", pretty[path])
        if path.startswith("/static/"):
            return os.path.join(os.getcwd(), path.lstrip("/"))
        # fallback to static
        return os.path.join(os.getcwd(), "static", path.lstrip("/"))

    def do_OPTIONS(self):
        # basic CORS for potential local cross-origin use
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, data: dict, code: int = 200):
        out = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def _body_json(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length) if length > 0 else b"{}"
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def handle_adaptive_quiz_start(self):
        prompt = f"""
        You are CareerLens AI, a friendly, encouraging, and creative career guide.
        Your task is to initiate an adaptive career quiz by asking the very first question.
        This question should be broad and engaging, suitable for all users to start.

        Output your response as a STRICT JSON object, adhering precisely to the following schema.
        DO NOT include any additional text, markdown, or commentary outside the JSON object.

        Schema:
        {{
          "question": {{
            "id": "string", // A short, unique identifier for the question (e.g., "start_interest")
            "text": "string", // The engaging question text
            "options": ["string", "string", "string", "string"] // 3-5 diverse and creative options. Include an implied "Other"
          }}
        }}

        Example creative first question:
        "If you could have a superpower that directly helped your career, what would it be? (e.g., Instantly Master Any Skill, Perfect Networking, Unlimited Energy, Future Vision for Trends)"
        """
        try:
            txt = call_groq(prompt)
            print(f"[DEBUG] Raw Groq response (start): {txt[:500]}") # Debug print
            data = ensure_json_response(txt)
            # Ensure the response adheres to the {"question": {...}} schema
            if "question" not in data and isinstance(data, dict):
                data = {"question": data} # Wrap the question
            self._json(data)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "adaptive_quiz_start"}, 200)

    def handle_adaptive_quiz_next(self):
        body = self._body_json()
        conversation_history = body.get("history", [])

        # Prepare the conversation for the AI
        messages_for_groq = []
        for msg in conversation_history:
            messages_for_groq.append({"role": msg["role"], "content": msg["content"]})
        
        # Add a system message to guide the AI for the next question
        messages_for_groq.append({
            "role": "system",
            "content": f"""
            You are CareerLens AI, a friendly, encouraging, and creative career guide.
            Your task is to ask the NEXT adaptive question in a 10-question career quiz.
            Each question and its options should be creatively crafted and directly informed by the user's PREVIOUS answer and the ongoing conversation history.
            Focus on uncovering career interests, skills, work preferences, and motivations.
            Maintain a light, engaging, and curious tone.

            Output your response as a STRICT JSON object, adhering precisely to the following schema.
            DO NOT include any additional text, markdown, or commentary outside the JSON object.
            Ensure the 'id' for the question is unique for this quiz session.

            Schema:
            {{
              "question": {{
                "id": "string", // A short, unique identifier for the question (e.g., "preferred_challenge", "skill_curiosity")
                "text": "string", // The engaging, adaptive question text
                "options": ["string", "string", "string", "string"] // 3-5 diverse and creative options. Include an implied "Other"
              }}
            }}

            Constraint:
            - Avoid asking questions that are too similar to previous ones.
            - Progressively delve deeper into the user's profile with each question.
            - You have 10 questions in total for the quiz. You are now being asked to generate question number {len(conversation_history) // 2 + 1}.
            """
        })
        
        # Append a user message to explicitly ask for the next question
        messages_for_groq.append({
            "role": "user",
            "content": f"Given our conversation so far, what's the next creative question you have for me, along with some fun options? I am on question number {len(conversation_history) // 2 + 1}."
        })

        try:
            chat_completion = client.chat.completions.create(
                messages=messages_for_groq,
                model=GROQ_MODEL,
            )
            txt = chat_completion.choices[0].message.content
            print(f"[DEBUG] Raw Groq response (next): {txt[:500]}") # Debug print
            data = ensure_json_response(txt)
            # Ensure the response adheres to the {"question": {...}} schema
            if "question" not in data and isinstance(data, dict):
                data = {"question": data} # Wrap the question
            self._json(data)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "adaptive_quiz_next"}, 200)




    def do_GET(self):
        if self.path == "/api/ping":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            print("[DEBUG] Pinging Groq API...") # Debug print
            status = {"ok": False, "error": "AI connectivity check failed"}
            try:
                # Perform a lightweight call to check Groq API connectivity
                _ = client.chat.completions.create(
                    messages=[
                        {
                            "role": "user",
                            "content": "ping",
                        }
                    ],
                    model=GROQ_MODEL,
                    max_tokens=1 # Request minimal output
                )
                status = {"ok": True}
                print("[DEBUG] Groq API ping successful.") # Debug print
            except Exception as e:
                status["error"] = str(e)
                print(f"[DEBUG] Groq API ping failed: {e}") # Debug print
            self.wfile.write(json.dumps(status).encode("utf-8"))
            return
        return super().do_GET()

    def do_POST(self):
        # Normalize trailing slash for robustness
        path = self.path.rstrip('/') or '/'
        if path == "/api/quiz":
            self.handle_quiz()
            return
        if path == "/api/adaptive_quiz/start":
            self.handle_adaptive_quiz_start()
            return
        if path == "/api/adaptive_quiz/next":
            self.handle_adaptive_quiz_next()
            return
        if path == "/api/market":
            self.handle_market()
            return
        if path == "/api/recommend":
            self.handle_recommend()
            return
        if path == "/api/compare":
            self.handle_compare()
            return
        if path == "/api/resume/analyze":
            self.handle_resume_analyze()
            return
        if path == "/api/roadmap":
            self.handle_roadmap()
            return
        # not found
        self._json({"error": "Not found"}, 404)

    def handle_quiz(self):
        # Read answers first (so we can fallback even if model is unavailable)
        body = self._body_json()
        answers = body.get("answers", [])
        # Prepare heuristic matches early
        base_matches = _heuristic_matches_from_answers(answers)

        prompt = f"""
        You are CareerLens AI, an expert career advisor.
        A student has completed an adaptive career quiz.
        Your task is to analyze the provided quiz answers and map them to the top 3 most fitting career roles.

        For EACH of the top 3 roles, provide:
        - The `role` title (string).
        - A `confidence` percentage (integer 0-100) reflecting how well the answers align with the role.
        - `reasoning`: A concise (1-2 sentences) explanation of why this role fits, based *only* on the provided answers.
        - `personality_fit`: A list of 1-3 personality traits (strings) evident from the answers that suit the role.
        - `skills_fit`: A list of 1-3 skills (strings) evident from the answers that suit the role.

        Output your response as a STRICT JSON object, adhering precisely to the following schema.
        DO NOT include any additional text, markdown, or commentary outside the JSON.
        DO NOT invent roles, traits, or skills not suggested by the answers.

        Schema:
        {{
          "matches": [
            {{
              "role": "string",
              "confidence": 0-100,
              "reasoning": "string",
              "personality_fit": ["string"],
              "skills_fit": ["string"]
            }},
            // ... up to 3 similar objects
          ]
        }}

        Quiz Answers: {answers}
        """.strip()
        try:
            txt = call_groq(prompt)
            data = ensure_json_response(txt)
            if not isinstance(data, dict):
                data = {"raw": data}
            # Ensure matches present
            if not isinstance(data.get("matches"), list) or not data.get("matches"):
                data["matches"] = base_matches
            # Final safety: always return at least one match
            if not data.get("matches"):
                data["matches"] = [{
                    "role": "Generalist (Explore)",
                    "confidence": 60,
                    "reasoning": "Based on your answers, exploring broad roles is recommended.",
                    "personality_fit": ["Curious"],
                    "skills_fit": ["Communication", "Problem-solving"],
                }]
            self._json(data)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "quiz"}, 200)

    def handle_market(self):

        body = self._body_json()
        role = body.get("role", "").strip()
        region = body.get("region", "global").strip() or "global"
        prompt = f"""
        You are an expert labor market analyst.
        For the career role: "{role}" in region: "{region}", infer realistic and current market insights.
        Base your insights strictly on widely known public knowledge and typical market patterns.
        DO NOT invent sources or reference any proprietary or fictional data.
        If specific data is not available, use your best professional judgment to provide reasonable estimates.

        Output your response as a STRICT JSON object, adhering precisely to the following schema.
        DO NOT include any additional text, markdown, or commentary outside the JSON.

        Schema:
        {{
          "role": "{role}",
          "region": "{region}",
          "demand_trend": {{"years": [int, int, int, int, int], "demand_index": [int, int, int, int, int]}},
          "salary_by_region": [{{"region": "string", "avg_salary": int}}],
          "top_skills": ["string", "string", "string", "string", "string"],
          "growth_forecast": {{
            "five_year_outlook": "string",
            "automation_risk_percent": int,
            "notes": "string"
          }}
        }}

        Requirements for accuracy and descriptiveness:
        - `demand_trend.years` MUST be the last 5 calendar years in chronological order (e.g., [2020, 2021, 2022, 2023, 2024]).
        - `demand_trend.demand_index` MUST be 5 integers on a 0-100 scale, corresponding to the `years`.
        - `salary_by_region` should include 1-3 relevant regions, with `avg_salary` as a whole number in USD.
        - `top_skills` MUST contain exactly 5 relevant and distinct skills.
        - `growth_forecast.five_year_outlook` should be a detailed paragraph (3-5 sentences) summarizing the outlook, including contributing factors.
        - `growth_forecast.automation_risk_percent` MUST be an integer between 0 and 100.
        - `growth_forecast.notes` should be a comprehensive summary (3-5 sentences) discussing key challenges, opportunities, and emerging trends for the role.
        """.strip()
        # cache key
        cache_key = "market|" + hashlib.sha1(f"{role}|{region}".encode("utf-8", errors="ignore")).hexdigest()
        cached = _cache_get(cache_key)
        if cached is not None:
            self._json(cached)
            return
        try:
            txt = call_groq(prompt)
            data = ensure_json_response(txt)
            # Remove skill_gaps if present to keep response consistent
            if isinstance(data, dict) and "skill_gaps" in data:
                try:
                    del data["skill_gaps"]
                except Exception:
                    pass
            # store in cache (1 hour in FAST mode, else 15 minutes)
            _cache_set(cache_key, data, ttl=3600)
            self._json(data)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "market"}, 200)

    def handle_recommend(self):

        body = self._body_json()
        role = (body.get("role") or "").strip()
        background = (body.get("background") or "").strip()
        # robust weeks parsing (JSON NaN -> null)
        weeks_val = body.get("weeks", 8)
        try:
            weeks = int(weeks_val)
        except Exception:
            weeks = 8
        if weeks < 1 or weeks > 52:
            weeks = 8
        prompt = f"""
        You are an experienced and practical career mentor.
        Your task is to build a comprehensive, detailed, and actionable learning plan for a learner targeting the career role "{role}".
        The learner's background is: "{background}".
        The learning plan should cover a duration of {weeks} weeks.

        Important Constraints:
        - Provide ONLY free or very low-cost resources (e.g., official documentation, open-source tutorials, popular MOOCs, reputable YouTube channels).
        - DO NOT suggest specific paid platforms or courses unless they are widely recognized as having free tiers/content.
        - Ensure all suggested URLs are valid and accessible HTTP/HTTPS links if specific links are provided, otherwise use a descriptive placeholder like "Search for [Topic] tutorial".

        Output your response as a STRICT JSON object, adhering precisely to the following schema.
        DO NOT include any additional text, markdown, or commentary outside the JSON object.

        Schema:
        {{
          "role": "{role}",
          "learning_paths": [
            {{
              "title": "string",
              "resources": [{{"name":"string","url":"string"}}]
            }}
          ],
          "roadmap_weeks": [
            {{
              "week": 1,
              "focus": "string",
              "outcomes": ["string"]
            }}
          ],
          "resume_tips": ["string"]
        }}

        Requirements for accuracy and detail:
        - `learning_paths`: Include 3 distinct, comprehensive learning paths.
            - Each path should have a descriptive `title` (e.g., "Foundational Skills in [Area]", "Deep Dive into [Technology]").
            - Each path should list 3-5 generic but highly relevant `resources`, each with a descriptive `name` and a placeholder `url` if a specific free URL is not globally well-known (e.g., "Google [Skill] Certification").
        - `roadmap_weeks`: Provide exactly {weeks} weekly entries (week 1 to {weeks}).
            - Each `week` MUST be an integer from 1 to {weeks}.
            - `focus`: A detailed paragraph (2-4 sentences) describing the main topic, key concepts, and high-level activities for that week.
            - `outcomes`: 3-4 specific, measurable skills or knowledge points the learner should achieve by the end of the week.
        - `resume_tips`: Provide 5-7 highly actionable and practical tips (strings) relevant to optimizing a resume for the target role and the learner's background.
        """.strip()
        try:
            txt = call_groq(prompt)
            data = ensure_json_response(txt)
            # Normalize common key variants to the expected structure
            if isinstance(data, dict):
                normalized = {
                    "role": data.get("role") or role,
                    "learning_paths": data.get("learning_paths") or data.get("learning_path") or data.get("paths") or [],
                    "roadmap_weeks": data.get("roadmap_weeks") or data.get("roadmap") or data.get("plan") or [],
                    "resume_tips": data.get("resume_tips") or data.get("resume_advice") or data.get("tips") or [],
                }
                # Coerce types
                if not isinstance(normalized["learning_paths"], list):
                    normalized["learning_paths"] = [normalized["learning_paths"]]
                if not isinstance(normalized["roadmap_weeks"], list):
                    normalized["roadmap_weeks"] = [normalized["roadmap_weeks"]]
                if not isinstance(normalized["resume_tips"], list):
                    normalized["resume_tips"] = [normalized["resume_tips"]]
                data = normalized
            self._json(data)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "recommend"}, 200)

    def handle_compare(self):

        body = self._body_json()
        role_a = body.get("role_a", "").strip()
        role_b = body.get("role_b", "").strip()
        region = body.get("region", "global").strip() or "global"
        prompt = f"""
        You are a highly skilled and detailed career analyst providing an in-depth comparative overview of job roles.
        Your task is to thoroughly compare two distinct career roles: "{role_a}" and "{role_b}", considering the specified region "{region}".

        For each role, provide:
        - `role`: The precise title of the career role.
        - `salary_range`: A detailed comparative description (2-3 sentences) of the typical annual salary range in numerical format (e.g., "$50,000 - $70,000 USD", "€45,000 - €60,000 EUR"). Include factors that might influence it (e.g., experience, location, industry, specific currency for the region).
        - `demand_growth`: A detailed comparative description (2-3 sentences) of the demand trend over the next 5-10 years, including reasons for growth or decline and relevant market indicators.
        - `work_life_balance`: A detailed comparative description (2-3 sentences) of the typical work-life balance, touching upon common hours, flexibility, and potential stress factors.
        - `education`: A detailed description (2-3 sentences) of the typical education and certifications required or highly valued for entry and advancement in the role.
        - `top_skills`: A list of 5 essential skills for the role. Each skill string should also briefly explain its importance (e.g., "Data Analysis: Crucial for interpreting market trends and user behavior").
        - `automation_risk_percent`: An integer (0-100) representing the estimated risk of automation significantly impacting the role in the next 10-20 years, with 0 being no risk and 100 being high risk.

        Finally, provide a `summary`: A comprehensive and objective comparison (4-6 sentences) highlighting the key differences, similarities, and strategic considerations for choosing between "{role_a}" and "{role_b}". This should offer a holistic perspective.

        Output your response as a STRICT JSON object, adhering precisely to the following schema.
        DO NOT include any additional text, markdown, or commentary outside the JSON.
        Keep all descriptions detailed, comparative, and grounded strictly in widely-known, realistic patterns.
        DO NOT invent data or make overly specific claims without broad public basis.

        Schema:
        {{
          "roles": [
            {{"role": "string", "salary_range": "string", "demand_growth": "string", "work_life_balance": "string", "education": "string", "top_skills": ["string"], "automation_risk_percent": int}},
            {{"role": "string", "salary_range": "string", "demand_growth": "string", "work_life_balance": "string", "education": "string", "top_skills": ["string"], "automation_risk_percent": int}}
          ],
          "summary": "string"
        }}
        """.strip()
        # cache key
        cache_key = "compare|" + hashlib.sha1(f"{role_a}|{role_b}|{region}".encode("utf-8", errors="ignore")).hexdigest()
        cached = _cache_get(cache_key)
        if cached is not None:
            self._json(cached)
            return
        try:
            txt = call_groq(prompt)
            print(f"[DEBUG] Raw Groq response (compare): {txt[:1000]}") # Debug print
            data = ensure_json_response(txt)
            # cache results (1 hour in FAST mode, else 15 minutes)
            _cache_set(cache_key, data, ttl=3600)
            self._json(data)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "compare"}, 200)

    def handle_resume_analyze(self):

        body = self._body_json()
        resume_text = body.get("resume_text", "").strip()
        target_role = body.get("target_role", "").strip()
        job_desc = body.get("job_description", "").strip()
        prompt = f"""
        You are an expert ATS (Applicant Tracking System) and resume specialist, providing comprehensive and actionable feedback.
        Your task is to thoroughly analyze the provided resume text against the target role "{target_role}".
        If a job description is provided, meticulously compare the resume to it.

        Resume text:
        ---
        {resume_text}
        ---

        Job Description (if provided, otherwise ignore):
        ---
        {job_desc}
        ---

        Output your response as a STRICT JSON object, adhering precisely to the following schema.
        DO NOT include any additional text, markdown, or commentary outside the JSON.
        Keep all feedback and suggestions detailed, actionable, and strictly grounded in the supplied resume text and job description.
        DO NOT invent or hallucinate information not present in the provided texts.

        Schema:
        {{
          "target_role": "{target_role}",
          "ats_score_percent": 0-100,
          "missing_keywords": ["string"],
          "sections_feedback": {{"summary": "string", "experience": "string", "skills": "string", "education": "string"}},
          "bullet_improvements": ["string"],
          "suggested_projects": ["string"],
          "certification_suggestions": ["string"],
          "job_suggestions": [{{"title": "string", "level": "entry|junior|mid|senior", "why_fit": "string"}}]
        }}

        Requirements for accuracy and detail:
        - `ats_score_percent`: An integer (0-100) indicating how well the resume matches the target role/job description.
        - `missing_keywords`: A list of 5-7 crucial keywords or phrases from the job description (or common for the target role) that are missing or underrepresented. For each, suggest *where* in the resume it could be strategically added (e.g., "Keyword: Description (suggested section: Summary)").
        - `sections_feedback`: Provide 2-3 detailed and actionable sentences of feedback for EACH of the 'summary', 'experience', 'skills', and 'education' sections. Include specific examples or recommendations for improvement tailored to the target role.
        - `bullet_improvements`: A list of 3-5 specific suggestions for improving existing bullet points in the experience section. For each suggestion, provide an example of how a generic bullet point could be rephrased to be more impactful (e.g., "Weak: 'Managed projects.' -> Strong: 'Led cross-functional teams to deliver X project, resulting in Y% efficiency gain.'").
        - `suggested_projects`: A list of 2-4 relevant project ideas. For each project, include a 1-sentence description of what it entails and how it would strengthen the candidate's profile for the target role.
        - `certification_suggestions`: A list of 2-3 certifications that would significantly boost the candidate's eligibility. Briefly explain the relevance of each certification.
        - `job_suggestions`: A list of 2-4 alternative job titles. For each, provide a 2-sentence explanation for `why_fit`, elaborating on how the candidate's current profile aligns and the estimated `level`.
        """.strip()
        try:
            txt = call_groq(prompt)
            data = ensure_json_response(txt)
            self._json(data)
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "resume"}, 200)

    def handle_roadmap(self):

        body = self._body_json()
        job = (body.get("job") or "").strip()
        weeks = int(body.get("weeks") or 10)
        if weeks < 8:
            weeks = 8
        if weeks > 12:
            weeks = 12
        if not job:
            self._json({"error": "Missing job title"})
            return
        prompt = f"""
        You are an expert and highly practical career coach.
        Your task is to create a detailed, weekly skill development roadmap for someone pursuing the dream job: "{job}".
        The roadmap should span exactly {weeks} weeks.

        Output your response as a STRICT JSON object, adhering precisely to the following schema.
        DO NOT include any additional text, markdown, or commentary outside the JSON.

        Schema:
        {{
          "job": "{job}",
          "weeks": [
            {{
              "week": 1,
              "focus_description": "string", // Added this field
              "skills": ["string", "string", "string"]
            }},
            // ... up to {weeks} similar objects
          ]
        }}

        Requirements for accuracy and detail:
        - The "weeks" array MUST contain exactly {weeks} objects, representing week 1 through week {weeks}.
        - For each week:
            - "week": An integer representing the week number (1 to {weeks}).
            - "focus_description": A detailed paragraph (2-3 sentences) explaining the main theme of the week, the goals, and how it contributes to overall job readiness.
            - "skills": A list of 3 to 5 distinct skills, tools, or concepts.
              - Each item in the list should be a descriptive string, combining the skill name with a brief explanation of its importance or application (e.g., "SQL Fundamentals: Mastering database queries for data extraction and manipulation").
              - The skills must be highly specific, practical, and show a clear logical progression, building upon knowledge from previous weeks.
              - Avoid vague terms.
        """.strip()
        try:
            txt = call_groq(prompt)
            data = ensure_json_response(txt)
            # Normalize
            job_out = data.get("job") if isinstance(data, dict) else None
            weeks_out = []
            if isinstance(data, dict) and isinstance(data.get("weeks"), list):
                for w in data.get("weeks"):
                    try:
                        wk = int(w.get("week"))
                        skills = w.get("skills") or []
                        if not isinstance(skills, list):
                            skills = [skills]
                        # coerce to short strings
                        skills = [str(s).strip() for s in skills if str(s).strip()]
                        weeks_out.append({"week": wk, "skills": skills[:4]})
                    except Exception:
                        continue
            # Fallback if model output was malformed
            if not weeks_out:
                weeks_out = [{"week": i+1, "skills": ["Research role", "Core fundamentals"]} for i in range(weeks)]
            self._json({"job": job_out or job, "weeks": weeks_out})
        except Exception as e:
            traceback.print_exc()
            self._json({"error": str(e), "where": "roadmap"}, 200)



# Create an app instance for Gunicorn
app = HTTPServer((HOST, PORT), CareerLensHandler)

# Kept for local development; Gunicorn will not use this.
if __name__ == "__main__":
    print(f"CareerLens server running locally on http://{HOST}:{PORT}")
    app.serve_forever()
