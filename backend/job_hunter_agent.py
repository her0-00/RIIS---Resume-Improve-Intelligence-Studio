import sys
import os
import io
# Force UTF-8 stdout on Windows to avoid surrogate/encoding crashes
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
import socket
import httpx
import requests

# Force IPv4 to avoid timeouts on networks with broken IPv6 (common on Windows)
orig_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4(host, port, family=0, type=0, proto=0, flags=0):
    return orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = getaddrinfo_ipv4

# Monkey-patch httpx to handle the 'proxies' argument removed in v0.28.0
# but still used by older versions of the openai library.
orig_init = httpx.Client.__init__
def new_init(self, *args, **kwargs):
    if 'proxies' in kwargs:
        kwargs['proxy'] = kwargs.pop('proxies')
    orig_init(self, *args, **kwargs)
httpx.Client.__init__ = new_init

orig_async_init = httpx.AsyncClient.__init__
def new_async_init(self, *args, **kwargs):
    if 'proxies' in kwargs:
        kwargs['proxy'] = kwargs.pop('proxies')
    orig_async_init(self, *args, **kwargs)
httpx.AsyncClient.__init__ = new_async_init

import json
import time
import datetime
import re
import traceback
from typing import List, Dict, Any
from playwright.sync_api import sync_playwright
from openai import AzureOpenAI, OpenAI
from groq import Groq

# Add parent dir to path to import backend modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from backend.worker import generate_pdf, THEMES

# Get project root directory
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

class JobHunterAgent:
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.ai_provider = config.get("ai_provider", "groq")
        self.cv_path = config.get("cv_path")
        self.letter_path = config.get("letter_path")
        self.output_dir = config.get("output_dir", os.path.join(ROOT_DIR, "outputs", "job_hunter"))
        self.cv_text = self._load_cv_text()
        self.letter_text = self._load_letter_text()
        self.client = self._init_ai_client()
        
        self.recency = config.get("recency", "any")
        raw_exclude = config.get("exclude_companies") or ""
        if isinstance(raw_exclude, str):
            self.exclude_companies = [c.strip().lower() for c in raw_exclude.split(",") if c.strip()]
        else:
            self.exclude_companies = [c.strip().lower() for c in raw_exclude if c.strip()]
            
        os.makedirs(self.output_dir, exist_ok=True)

    def _load_cv_text(self) -> str:
        if self.cv_path.endswith(".pdf"):
            try:
                import pdfplumber
                with pdfplumber.open(self.cv_path) as pdf:
                    return "\n".join([page.extract_text() or "" for page in pdf.pages])
            except ImportError:
                return "Error: pdfplumber not installed. Please install it to parse PDFs."
        else:
            with open(self.cv_path, 'r', encoding='utf-8') as f:
                return f.read()

    def _load_letter_text(self) -> str:
        if not self.letter_path:
            return ""
        try:
            if self.letter_path.endswith(".pdf"):
                try:
                    import pdfplumber
                    with pdfplumber.open(self.letter_path) as pdf:
                        return "\n".join([page.extract_text() or "" for page in pdf.pages])
                except ImportError:
                    return "Error: pdfplumber not installed. Please install it to parse PDFs."
            else:
                with open(self.letter_path, 'r', encoding='utf-8') as f:
                    return f.read()
        except Exception:
            return ""

    def _is_direct_job_offer(self, url: str) -> bool:
        url_lower = url.lower()
        # Basic homepages / generic portals / search listings to filter out
        generic_filters = [
            "linkedin.com/jobs/search",
            "linkedin.com/jobs/collections",
            "welcometothejungle.com/fr/jobs",
            "welcometothejungle.com/fr/companies",
            "hellowork.com/fr-fr/recherche",
            "hellowork.com/fr-fr/emploi/",
            "hellowork.com/fr-fr/alternance/",
            "apec.fr/candidat/recherche-offres",
            "indeed.com/q-",
            "indeed.com/jobs",
            "/recherche",
            "/search",
            "/sea/",
            "/mot-cle",
            "/tags/",
            "/metier/",
            "/poste/",
            "/ville/",
            "/secteur/",
            "/departement/",
            "/region/",
            "metier_",
            "ville_",
            "login",
            "signup",
            "create-account",
            "/salary",
            "/salaries",
            "/salaire",
            "/salaires",
            "/reviews",
            "/avis",
            "/interview",
            "/entretiens",
            "/faq",
            "/companies",
            "/entreprises",
            "/directory",
            "/annuaire",
            "/forum",
            "/questions",
            "career-path",
            "career-planning"
        ]
        if any(gf in url_lower for gf in generic_filters):
            return False
            
        # Ensure it has a deep path structure or a query parameter indicating an ID
        path = url.replace("https://", "").replace("http://", "").split("/")
        if len(path) <= 2 and "?" not in url:
            # E.g. domain.com or domain.com/something-generic
            return False
            
        # Enforce direct link formats for major aggregators
        if "linkedin.com" in url_lower:
            if not any(x in url_lower for x in ["/view/", "/viewjob", "/jobs/view"]):
                return False
                
        if "indeed.com" in url_lower:
            if not any(x in url_lower for x in ["/viewjob", "/rc/clk", "/rc/", "/clk"]):
                return False
                
        return True

    def _init_ai_client(self):
        api_key = self.config.get("api_key")
        if self.ai_provider == "azure":
            return AzureOpenAI(
                api_key=api_key,
                api_version="2024-12-01-preview",
                azure_endpoint=self.config.get("azure_endpoint")
            )
        elif self.ai_provider == "groq":
            return Groq(api_key=api_key)
        else:
            return OpenAI(api_key=api_key)

    def log(self, tag: str, message: str):
        timestamp = datetime.datetime.now().strftime("%H:%M:%S")
        icons = {"NAV": "[NAV]", "THINK": "[AI]", "EXTRACT": "[EXT]", "MATCH": "[MATCH]", "SAVE": "[SAVE]", "ERROR": "[ERR]", "AI": "[AI]"}
        emoji_icons = {"NAV": "\U0001f310", "THINK": "\U0001f9e0", "EXTRACT": "\U0001f4c4", "MATCH": "\U0001f3af", "SAVE": "\U0001f4be", "ERROR": "\u26a0\ufe0f", "AI": "\U0001f916"}
        icon = emoji_icons.get(tag, "\u2022")
        # Sanitize surrogates from message before printing (Windows stdout safety)
        safe_msg = message.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        line = f"[{timestamp}] {icon} [{tag}] {safe_msg}"
        # Also sanitize the line itself
        safe_line = line.encode('utf-8', errors='replace').decode('utf-8', errors='replace')
        print(safe_line, flush=True)

    def _brainstorm_corporate_targets(self, query: str, location: str) -> Dict[str, str]:
        self.log("THINK", f"L'IA analyse le domaine '{query}' ({location}) pour identifier les meilleurs recruteurs de ce secteur...")
        default_targets = {
            "safran": "safran-group.com",
            "thales": "thalesgroup.com",
            "airbus": "careers.airbus.com",
            "suez": "suez.com",
            "edf": "edf.fr",
            "engie": "engie.com",
            "dassault": "dassault-aviation.com",
            "capgemini": "capgemini.com",
            "soprasteria": "soprasteria.com",
            "orange": "orange.jobs",
            "veolia": "veolia.com",
            "schneider": "se.com",
            "totalenergies": "totalenergies.com",
            "renault": "renaultgroup.com",
            "sanofi": "sanofi.com"
        }
        
        try:
            prompt = f"""Targeted Company Search Engine.
You are a SOTA career targeting intelligence system.
Based on the job search query: "{query}" and the target location: "{location}", brainstorm the top 5 to 10 most relevant, high-probability employers or industry giants that recruit in this specific domain and area.

For example:
- Query "Architecte" and Location "Paris" -> returns major construction giants (Vinci, Bouygues, Eiffage) or renowned architecture firms (Jean Nouvel, Wilmotte, Valode & Pistre) with their primary website domains.
- Query "Data Analyst" and Location "Paris" -> returns tech, banking, energy and consulting giants (Safran, Thales, Suez, EDF, Capgemini, etc.) with their domains.
- Query "Biomedical researcher" and Location "Lyon" -> returns pharma and biotech giants (Sanofi, bioMerieux, Boehringer Ingelheim) with their domains.

Return ONLY a flat JSON object where keys are the lowercase company names and values are their official main website domains (do NOT include protocols like http or https).
Format:
{{
  "company1": "domain1.com",
  "company2": "domain2.com"
}}
Do NOT output any markdown, code blocks, or preamble. Just raw JSON."""

            model = "llama-3.3-70b-versatile" if self.ai_provider == "groq" else "gpt-4o-mini"
            if self.ai_provider == "azure":
                deployment = self.config.get("azure_deployment") or "gpt-4o-mini"
                resp = self.client.chat.completions.create(
                    model=deployment,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.1
                )
            else:
                params = {
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1
                }
                if self.ai_provider == "groq":
                    params["max_tokens"] = 1000
                else:
                    # Use max_completion_tokens for modern OpenAI models to prevent deprecation warnings
                    params["max_completion_tokens"] = 1000
                resp = self.client.chat.completions.create(**params)
                
            text = resp.choices[0].message.content.strip()
            # Clean markdown JSON block if present
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\n", "", text)
                text = re.sub(r"\n```$", "", text)
            
            targets = json.loads(text)
            if isinstance(targets, dict) and len(targets) > 0:
                self.log("MATCH", f"L'IA a ciblé avec succès {len(targets)} mega-employeurs pour votre profil !")
                return {str(k).lower().strip(): str(v).lower().strip() for k, v in targets.items()}
        except Exception as e:
            self.log("ERROR", f"Échec du brainstorming IA, utilisation du catalogue de repli : {e}")
            
        return default_targets

    def search_jobs(self, query: str, location: str = "") -> List[str]:
        self.log("NAV", f"Recherche multi-sources pour : '{query}' (Location: {location})...")
        candidates = []
        
        # --- SOTA AI-DRIVEN CORPORATE TARGETING ENGINE ---
        self.corporate_domains = self._brainstorm_corporate_targets(query, location)
        targeted_companies = list(self.corporate_domains.keys())
        
        # Build search queries
        loc_str = f" {location}" if location else ""
        search_queries = [
            f"{query}{loc_str} offre d'emploi",
            f"recrutement {query}{loc_str} carrière",
            f"site:linkedin.com/jobs {query}{loc_str}"
        ]
        
        # 1. Simple direct site queries (Yahoo-friendly, no complex parenthesized OR clauses!)
        for company in targeted_companies[:5]:
            domain = self.corporate_domains[company]
            search_queries.append(f"site:{domain} \"{query}\"{loc_str}")
            
        # 2. String-literal company target searches (100% reliable on simplified search engines, retrieves listings from anywhere!)
        for company in targeted_companies:
            search_queries.append(f'"{company}" "{query}"{loc_str}')

        def _wait_for_cloudflare(page, timeout_ms=120000):
            """Wait for Cloudflare Turnstile/challenge to resolve (manual or auto). Returns True if page is clear."""
            deadline = time.time() + timeout_ms / 1000
            while time.time() < deadline:
                page.wait_for_timeout(2000)
                content = page.content().lower()
                if 'verify you are human' not in content and 'test de s\u00e9curit\u00e9' not in content and 'checking your browser' not in content:
                    return True
            return False

        try:
            with sync_playwright() as p:
                search_mode = self.config.get("search_mode", "all")
                jt_url = self.config.get("jobteaser_url", "").strip().rstrip('/')
                jt_email = self.config.get("jobteaser_email")
                jt_pass = self.config.get("jobteaser_password")

                # JobTeaser = navigateur VISIBLE pour que l'utilisateur puisse valider Cloudflare manuellement
                use_headful = (search_mode == "jobteaser" and jt_url and jt_email and jt_pass)

                if use_headful:
                    self.log("NAV", "Mode navigateur VISIBLE activ\u00e9 (utilisation de Edge/Chrome r\u00e9el pour Cloudflare)...")
                    launched = False
                    use_persistent = False
                    for channel in ['msedge', 'chrome']:
                        try:
                            browser = p.chromium.launch(
                                channel=channel,
                                headless=False,
                                slow_mo=80,
                                ignore_default_args=["--enable-automation"],
                                args=[
                                    "--disable-blink-features=AutomationControlled",
                                    "--start-maximized",
                                    "--no-sandbox",
                                ]
                            )
                            self.log("NAV", f"Navigateur r\u00e9el ({channel}) lanc\u00e9 en mode ultra-discret.")
                            launched = True
                            break
                        except Exception as e:
                            self.log("NAV", f"Navigateur {channel} introuvable...")
                    
                    if not launched:
                        self.log("NAV", "Aucun navigateur r\u00e9el trouv\u00e9. Bascule sur Chromium basique...")
                        browser = p.chromium.launch(
                            headless=False,
                            slow_mo=80,
                            args=[
                                "--disable-blink-features=AutomationControlled",
                                "--no-sandbox",
                                "--start-maximized",
                            ]
                        )
                else:
                    browser = p.chromium.launch(
                        headless=True,
                        args=[
                            "--disable-blink-features=AutomationControlled",
                            "--no-sandbox",
                            "--disable-dev-shm-usage",
                            "--disable-web-security",
                            "--disable-features=IsolateOrigins,site-per-process",
                            "--flag-switches-begin",
                            "--disable-site-isolation-trials",
                            "--flag-switches-end",
                        ]
                    )

                if not use_headful or not locals().get('use_persistent', False):
                    use_persistent = False
                    context = browser.new_context(
                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                        viewport={'width': 1366, 'height': 768},
                        locale='fr-FR',
                        timezone_id='Europe/Paris',
                        extra_http_headers={
                            'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                            'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                            'sec-ch-ua-mobile': '?0',
                            'sec-ch-ua-platform': '"Windows"',
                            'Upgrade-Insecure-Requests': '1',
                        }
                    )
                    
                    if not use_headful:
                        # Only use these anti-bot scripts in headless mode. 
                        # In headful, Cloudflare detects these exact overrides as malicious extensions.
                        context.add_init_script("""
                            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                            Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
                            window.chrome = { runtime: {} };
                        """)
                    page = context.new_page()

                
                # --- SECTION 1: BASIC YAHOO SEARCH & PORTALS ---
                portals_to_explore = []
                if search_mode == "jobteaser":
                    self.log("NAV", "Mode 'JobTeaser Uniquement' activ\u00e9. Recherche basique Web (Yahoo) ignor\u00e9e.")
                else:
                    self.log("NAV", "Exécution de la recherche basique multi-sources (Yahoo)...")
                    import urllib.parse
                    for q in search_queries:
                        encoded_q = urllib.parse.quote(q.strip())
                        search_url = f"https://fr.search.yahoo.com/search?p={encoded_q}"
                        if self.recency == "24h":
                            search_url += "&btf=d"
                        elif self.recency == "7d":
                            search_url += "&btf=w"
                        self.log("NAV", f"Exploration Yahoo : '{q}' (Fraîcheur : {self.recency})...")
                        try:
                            page.goto(search_url, timeout=30000)
                            
                            # Handle Yahoo Consent
                            try:
                                if page.query_selector("button[name='agree']"):
                                    page.click("button[name='agree']")
                                    page.wait_for_timeout(1000)
                            except: pass
                                
                            page.wait_for_timeout(3000)
                            
                            # Extract ONLY real organic search result blocks for precise snippets & links
                            yahoo_items = page.evaluate("""() => {
                                let results = Array.from(document.querySelectorAll('div.algo, li.algo, div.dd.algo')).map(div => {
                                    let a = div.querySelector('h3 a, a.d-ib, a');
                                    if (!a) return null;
                                    return { href: a.href, text: div.innerText.toLowerCase() };
                                }).filter(item => item !== null);
                                
                                if (results.length === 0) {
                                    results = Array.from(document.querySelectorAll('h3')).map(h3 => {
                                        let a = h3.querySelector('a');
                                        if (!a) return null;
                                        
                                        // Skip if inside an ad or sponsored container
                                        let curr = h3;
                                        while (curr) {
                                            let cl = (curr.className || '').toLowerCase();
                                            let id = (curr.id || '').toLowerCase();
                                            if (cl.includes('ad') || cl.includes('sponsor') || id.includes('ad') || id.includes('sponsor')) {
                                                return null;
                                            }
                                            curr = curr.parentElement;
                                        }
                                        
                                        let parentText = '';
                                        let p = h3.parentElement;
                                        for (let i = 0; i < 2 && p; i++) {
                                            parentText += ' ' + p.innerText;
                                            p = p.parentElement;
                                        }
                                        return { href: a.href, text: parentText.toLowerCase() };
                                    }).filter(item => item !== null);
                                }
                                return results;
                            }""")
                            
                            job_boards = [
                                'hellowork', 'adzuna', 'indeed', 
                                'linkedin', 'safran', 'thales', 'airbus', 'dassault', 'edf', 'engie',
                                'suez', 'capgemini', 'soprasteria', 'orange', 'veolia', 'se.com',
                                'totalenergies', 'renault', 'sanofi',
                                'apec.fr', 'pole-emploi', 'meteojob', 'monster', 'talent.com', 
                                'michaelpage', 'cadremploi', 'stratojob', 'regionsjob', 'boursorama'
                            ]
                            # Dynamically extend with the SOTA brainstormed corporate targets!
                            job_boards = list(dict.fromkeys(job_boards + list(self.corporate_domains.keys())))
                            
                            for item in yahoo_items:
                                href = item['href']
                                href_lower = href.lower()
                                if any(board in href_lower for board in job_boards) and 'http' in href:
                                    if self._is_direct_job_offer(href):
                                        # Guess company if possible from URL or text
                                        company = ''
                                        for board in job_boards:
                                            if board in href_lower and board not in ['indeed', 'linkedin','adzuna', 'hellowork', 'apec.fr', 'pole-emploi', 'meteojob', 'monster', 'talent.com', 'cadremploi', 'regionsjob']:
                                                company = board
                                                break
                                        
                                        candidates.append({
                                            'href': href,
                                            'text': item['text'],
                                            'company': company
                                        })
                                    else:
                                        if href not in portals_to_explore:
                                            portals_to_explore.append(href)
                        except Exception as e:
                            self.log("ERROR", f"Erreur lors du scraping de Yahoo Search : {str(e)}")

                # --- EXPLORE PORTAL LIST PAGES ---
                # To prevent long wait times, we select the top 3 unique portals and extract direct jobs from them
                portals_to_explore = portals_to_explore[:3]
                if portals_to_explore:
                    self.log("NAV", f"Exploration de {len(portals_to_explore)} portails d'offres pour extraire les annonces individuelles...")
                    for portal_url in portals_to_explore:
                        self.log("NAV", f"Exploration du portail : {portal_url[:60]}...")
                        try:
                            page.goto(portal_url, timeout=30000)
                            page.wait_for_timeout(3000)
                            
                            # Handle cookie consents on job boards
                            try:
                                if page.query_selector("button[id*='accept'], button[class*='accept'], button[id*='cookie'], button[class*='cookie']"):
                                    page.click("button[id*='accept'], button[class*='accept'], button[id*='cookie'], button[class*='cookie']", timeout=2000)
                                    page.wait_for_timeout(1000)
                            except: pass

                            # Extract direct job offers based on the domain
                            url_lower = portal_url.lower()
                            links_data = []
                            
                            if "linkedin.com" in url_lower:
                                # Dismiss sign-in popup if overlaying
                                try:
                                    page.evaluate("""() => {
                                        let btn = document.querySelector('button[data-tracking-control-name*="dismiss"], button[class*="dismiss"], button[aria-label*="dismiss"]');
                                        if (btn) btn.click();
                                    }""")
                                    page.wait_for_timeout(500)
                                except: pass
                                
                                links_data = page.evaluate("""() => {
                                    return Array.from(document.querySelectorAll('a')).filter(a => {
                                        let h = a.href.toLowerCase();
                                        return h.includes('/jobs/view/') || h.includes('/view/') || h.includes('/jobs/collections/') || a.classList.contains('base-card__full-link');
                                    }).map(a => {
                                        return { href: a.href, text: a.innerText.toLowerCase() };
                                    });
                                }""")
                            elif "welcometothejungle" in url_lower:
                                links_data = page.evaluate("""() => {
                                    return Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/jobs/') && a.href.includes('/companies/')).map(a => {
                                        return { href: a.href, text: a.innerText.toLowerCase() };
                                    });
                                }""")
                            elif "hellowork" in url_lower:
                                links_data = page.evaluate("""() => {
                                    return Array.from(document.querySelectorAll('a')).filter(a => {
                                        let h = a.href.toLowerCase();
                                        return h.includes('/offre-') || h.includes('/offre-emploi/') || (h.includes('/emplois/') && h.endsWith('.html'));
                                    }).map(a => {
                                        return { href: a.href, text: a.innerText.toLowerCase() };
                                    });
                                }""")
                            elif "apec.fr" in url_lower:
                                links_data = page.evaluate("""() => {
                                    return Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/detail-offre/') || a.href.includes('/association/recherche-offre/')).map(a => {
                                        return { href: a.href, text: a.innerText.toLowerCase() };
                                    });
                                }""")
                            elif "indeed" in url_lower:
                                links_data = page.evaluate("""() => {
                                    return Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/rc/clk') || a.href.includes('/viewjob')).map(a => {
                                        return { href: a.href, text: a.innerText.toLowerCase() };
                                    });
                                }""")
                            elif "pole-emploi" in url_lower or "france-travail" in url_lower:
                                links_data = page.evaluate("""() => {
                                    return Array.from(document.querySelectorAll('a')).filter(a => a.href.includes('/offre-demploi/')).map(a => {
                                        return { href: a.href, text: a.innerText.toLowerCase() };
                                    });
                                }""")
                            else:
                                # Generic deep path offer guesser
                                links_data = page.evaluate("""() => {
                                    return Array.from(document.querySelectorAll('a')).filter(a => {
                                        let h = a.href.toLowerCase();
                                        return (h.includes('/job/') || h.includes('/offre/') || h.includes('/careers/')) && h.split('/').length > 4;
                                    }).map(a => {
                                        return { href: a.href, text: a.innerText.toLowerCase() };
                                    });
                                }""")
                                
                            extracted_count = 0
                            for ld in links_data:
                                href = ld['href']
                                if self._is_direct_job_offer(href):
                                    # Guess company
                                    company = ''
                                    for board in job_boards:
                                        if board in href.lower() and board not in ['indeed', 'linkedin', 'adzuna', 'hellowork', 'apec.fr', 'pole-emploi', 'meteojob', 'monster', 'talent.com', 'cadremploi', 'regionsjob']:
                                            company = board
                                            break
                                    candidates.append({
                                        'href': href,
                                        'text': ld['text'],
                                        'company': company
                                    })
                                    extracted_count += 1
                                    
                            self.log("NAV", f"Portail exploré avec succès : {extracted_count} offres directes extraites.")
                        except Exception as e:
                            self.log("ERROR", f"Erreur lors de l'exploration du portail {portal_url[:50]} : {str(e)}")

                # --- SECTION 2: JOBTEASER INTEGRATION ---
                if jt_url and jt_email and jt_pass:
                    self.log("NAV", f"Tentative de connexion \u00e0 JobTeaser via {jt_url}...")
                    try:
                        login_url = f"{jt_url}/fr/users/sign_in"
                        page.goto(login_url, wait_until='domcontentloaded', timeout=30000)

                        if use_headful:
                            # Always wait on login page in headful mode — Cloudflare may appear at any point
                            self.log("NAV", "\ud83d\udda5\ufe0f Navigateur ouvert sur JobTeaser. Si un 'Test de s\u00e9curit\u00e9' appara\u00eet, \ud83d\udc46 CLIQUEZ sur la case puis attendez que la page de connexion s'affiche. Vous avez 2 minutes...")
                            cf_resolved = _wait_for_cloudflare(page, timeout_ms=120000)
                            if not cf_resolved:
                                self.log("ERROR", "\u274c Timeout: Cloudflare non r\u00e9solu sur la page de login. JobTeaser ignor\u00e9.")
                                page.screenshot(path="jt_debug.png", full_page=True)
                                raise Exception("Cloudflare not resolved on login page")
                            self.log("NAV", "\u2705 Page de connexion accessible ! Remplissage du formulaire en cours...")
                        else:
                            page.wait_for_timeout(2000)
                            page_content = page.content().lower()
                            if 'verify you are human' in page_content or 'test de s\u00e9curit\u00e9' in page_content:
                                self.log("NAV", "\u23f3 Cloudflare d\u00e9tect\u00e9. Attente de r\u00e9solution automatique (20s)...")
                                cf_resolved = _wait_for_cloudflare(page, timeout_ms=20000)
                                if not cf_resolved:
                                    self.log("ERROR", "\u274c Cloudflare non r\u00e9solu sur la page de connexion. JobTeaser ignor\u00e9.")
                                    page.screenshot(path="jt_debug.png", full_page=True)
                                    raise Exception("Cloudflare not resolved")
                                self.log("NAV", "\u2705 Cloudflare r\u00e9solu ! Reprise de la connexion...")

                        # Wait for login form
                        try:
                            page.wait_for_selector("input[type='email']", timeout=8000)
                        except:
                            self.log("ERROR", "Formulaire de connexion JobTeaser introuvable (bloqu\u00e9 ?).")
                            page.screenshot(path="jt_debug.png", full_page=True)
                            raise Exception("Login form not found")

                        page.fill("input[type='email']", jt_email)
                        page.wait_for_timeout(500)
                        page.fill("input[type='password']", jt_pass)
                        page.wait_for_timeout(500)
                        page.click("button[type='submit']")
                        page.wait_for_timeout(5000)
                        
                        if "sign_in" not in page.url and "cloudflare" not in page.url:
                            self.log("NAV", f"Connect\u00e9 \u00e0 JobTeaser ! Recherche d'offres pour : '{query}'...")
                            import urllib.parse as _up
                            search_jt = f"{jt_url}/fr/job-offers?q={_up.quote(query)}"
                            if location:
                                search_jt += f"&localized_location={_up.quote(location)}"
                            
                            page.goto(search_jt, wait_until='domcontentloaded', timeout=30000)
                            page.wait_for_timeout(3000)

                            # --- Handle Cloudflare on search results page ---
                            page_content = page.content().lower()
                            if 'verify you are human' in page_content or 'test de s\u00e9curit\u00e9' in page_content:
                                if use_headful:
                                    self.log("NAV", "\u23f3 Cloudflare sur les r\u00e9sultats ! \ud83d\udc46 CLIQUEZ sur la case 'Verify you are human'. Vous avez 2 minutes...")
                                else:
                                    self.log("NAV", "\u23f3 Cloudflare d\u00e9tect\u00e9 sur la page des r\u00e9sultats. Attente (20s)...")
                                cf_resolved = _wait_for_cloudflare(page, timeout_ms=120000 if use_headful else 20000)
                                if not cf_resolved:
                                    self.log("ERROR", "\u274c Cloudflare bloque la page de r\u00e9sultats JobTeaser.")
                                    page.screenshot(path="jt_debug.png", full_page=True)
                                    raise Exception("Cloudflare block on results page")
                                self.log("NAV", "\u2705 Cloudflare r\u00e9solu sur la page des r\u00e9sultats !")
                                page.wait_for_timeout(2000)

                            try:
                                page.wait_for_selector('a[href*="/job-offers/"]', timeout=10000)
                            except:
                                self.log("NAV", "Attention: Les offres JobTeaser semblent longues à charger ou aucune offre trouvée.")
                            
                            page.wait_for_timeout(2000)
                            
                            jt_jobs = page.evaluate("""() => {
                                // Sanitize text: remove surrogate characters that break UTF-8 encoding
                                function cleanText(s) {
                                    if (!s) return '';
                                    return s.replace(/[\\uD800-\\uDFFF]/g, '').replace(/\\s+/g, ' ').trim().toLowerCase();
                                }
                                // Selector 1: named card components
                                let jobs = Array.from(document.querySelectorAll('a[class*="JobAdCard"], a[class*="job-ad-card"], a[class*="offer-card"]')).map(a => {
                                    let comp = '';
                                    let img = a.querySelector('img');
                                    if (img && img.alt) comp = cleanText(img.alt.replace(/logo (de |d')?/gi, ''));
                                    return { href: a.href, text: cleanText(a.innerText), company: comp };
                                });
                                return jobs;
                            }""")
                            
                            if not jt_jobs:
                                # Fallback: any /job-offers/ link not pointing to applications
                                jt_jobs = page.evaluate("""() => {
                                    function cleanText(s) {
                                        if (!s) return '';
                                        return s.replace(/[\\uD800-\\uDFFF]/g, '').replace(/\\s+/g, ' ').trim().toLowerCase();
                                    }
                                    return Array.from(document.querySelectorAll('a')).filter(a => {
                                        let h = a.href;
                                        return h.includes('/job-offers/') && !h.includes('/applications') && !h.includes('/search') && h.split('/').length > 5;
                                    }).map(a => {
                                        let comp = '';
                                        let card = a.closest('[class*="card"], [class*="Card"], article, li');
                                        if (card) {
                                            let img = card.querySelector('img[alt]');
                                            if (img) comp = cleanText(img.alt.replace(/logo (de |d')?/gi, ''));
                                        }
                                        let cardEl = a.closest('article, li, div');
                                        let txt = cleanText(a.innerText) || (cardEl ? cleanText(cardEl.innerText) : '');
                                        return { href: a.href, text: txt, company: comp };
                                    });
                                }""")
                                
                            # Python-side surrogate safety
                            def _safe_str(s):
                                if not s:
                                    return ''
                                return s.encode('utf-8', errors='replace').decode('utf-8', errors='replace')

                            if not jt_jobs:
                                self.log("ERROR", "0 offre trouv\u00e9e sur JobTeaser. Capture de debug enregistr\u00e9e.")
                                page.screenshot(path="jt_debug.png", full_page=True)
                            else:
                                self.log("NAV", f"{len(jt_jobs)} offres trouv\u00e9es sur JobTeaser.")
                                for job in jt_jobs:
                                    candidates.append({
                                        'href': _safe_str(job.get('href', '')),
                                        'text': _safe_str(job.get('text', '')),
                                        'company': _safe_str(job.get('company', ''))
                                    })
                        else:
                            self.log("ERROR", f"Échec de connexion à JobTeaser ({jt_url}) — Redirection inattendue vers : {page.url}")
                            page.screenshot(path="jt_debug.png", full_page=True)
                    except Exception as e:
                        self.log("ERROR", f"Erreur JobTeaser : {str(e)}")
                
                browser.close()
        except Exception as e:
            self.log("ERROR", f"Erreur globale lors de la recherche : {str(e)}")

        # --- SECTION 3: UNIFIED LOCAL TOKEN SCORING & DEDUPLICATION ---
        self.log("NAV", f"Scoring local et déduplication de {len(candidates)} opportunités brutes...")
        
        # 1. Score candidates based on query token matching and apply direct corporate site priority bonus
        query_tokens = set(query.lower().replace('-', ' ').replace('/', ' ').split())
        for cand in candidates:
            score = 0
            text_lower = cand['text'].lower()
            href_lower = cand['href'].lower()
            for token in query_tokens:
                if len(token) > 2 and token in text_lower:
                    score += 1
            
            # Direct Corporate Career Site Bonus (+10 points!)
            # Prioritize direct employer portals over aggregators (Glassdoor, Indeed, Hellowork, etc.)
            for comp, domain in self.corporate_domains.items():
                if domain in href_lower:
                    score += 10
                    break
                    
            cand['score'] = score

        # Sort all candidates by score descending
        candidates.sort(key=lambda x: x['score'], reverse=True)

        # 2. Filter visited/historical URLs to avoid scanning them again
        visited_urls = set()
        if os.path.exists(self.output_dir):
            for folder in os.listdir(self.output_dir):
                folder_path = os.path.join(self.output_dir, folder)
                if os.path.isdir(folder_path):
                    info_path = os.path.join(folder_path, "offre_info.json")
                    if os.path.exists(info_path):
                        try:
                            with open(info_path, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                if "source_url" in data:
                                    visited_urls.add(data["source_url"])
                        except:
                            pass
        self.log("NAV", f"Historique : {len(visited_urls)} offres déjà traitées précédemment.")

        # 3. Apply strict diversity and exclusions filter
        import difflib
        selected_links = []
        selected_texts = []
        company_counts = {}
        unique_urls = set()

        for cand in candidates:
            href = cand['href']
            
            # Skip if already visited or duplicate URL
            if href in visited_urls or href in unique_urls:
                continue

            comp = cand.get('company', '').lower().strip()
            text = cand['text']
            
            # Exclusion companies check
            if comp and any(exc in comp for exc in self.exclude_companies):
                self.log("NAV", f"Filtrage : Offre de '{comp}' ignorée (entreprise bannie).")
                continue
            if any(exc in text for exc in self.exclude_companies):
                self.log("NAV", f"Filtrage : Offre ignorée (contient une entreprise bannie : '{text[:50]}...').")
                continue
            if any(exc in href.lower() for exc in self.exclude_companies):
                self.log("NAV", f"Filtrage : Offre ignorée (l'URL contient une entreprise bannie).")
                continue

            # Limit to 3 offers per company to prevent monopolies
            if comp and company_counts.get(comp, 0) >= 3:
                continue

            # Skip highly similar texts (deduplication)
            is_duplicate_text = False
            for st in selected_texts:
                if difflib.SequenceMatcher(None, text[:300], st[:300]).ratio() > 0.85:
                    is_duplicate_text = True
                    break
            if is_duplicate_text:
                continue

            # Select this offer!
            if comp:
                company_counts[comp] = company_counts.get(comp, 0) + 1
            
            unique_urls.add(href)
            selected_texts.append(text)
            selected_links.append(href)
            
            # Limit to exactly 15 best links combined
            if len(selected_links) >= 15:
                break

        self.log("NAV", f"{len(selected_links)} meilleures opportunités uniques retenues (tous sites confondus).")
        return selected_links

    def analyze_and_optimize(self, url: str) -> Dict[str, Any]:
        self.log("EXTRACT", f"Ouverture du navigateur pour : {url[:50]}...")
        content = ""
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=True,
                    args=["--disable-blink-features=AutomationControlled"]
                )
                page = browser.new_page(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                    viewport={'width': 1280, 'height': 800}
                )
                self.log("NAV", f"Navigation vers la page...")
                page.goto(url, timeout=30000)
                self.log("NAV", f"Chargement du contenu (4s d'attente)...")
                page.wait_for_timeout(4000)
                # Handle JobTeaser expansion with specific user selectors
                if "jobteaser.com" in url:
                    try:
                        jt_expand = "button.ReadMore-module__PJm3va__button"
                        if page.query_selector(jt_expand):
                            self.log("NAV", "Expansion JobTeaser détectée...")
                            page.click(jt_expand, timeout=3000)
                            page.wait_for_timeout(1000)
                        
                        apply_btn_selector = "button[data-testid*='apply_external_candidacy']"
                        if page.query_selector(apply_btn_selector):
                            self.log("NAV", "Bouton de candidature externe identifié.")
                    except: pass

                # Generic expansion fallback
                try:
                    if page.query_selector("text=Voir plus") or page.query_selector("text=Afficher plus"):
                        self.log("NAV", "Expansion du contenu détectée...")
                        page.click("text=Voir plus", timeout=2000)
                        page.wait_for_timeout(1000)
                except: pass
                
                content = page.inner_text("body").strip()[:8000]
                self.log("EXTRACT", f"Texte extrait avec succès ({len(content)} caractères).")
                browser.close()
        except Exception as e:
            self.log("ERROR", f"Échec de l'extraction pour {url}")
            return None

        if len(content) < 200:
            self.log("ERROR", "Contenu trop court, probablement bloqué par un anti-bot.")
            return None

        self.log("THINK", "L'IA analyse le matching avec votre CV...")
        
        system_prompt = """You are an Autonomous Job Hunter.
Analyze the job content against the candidate's CV.
If the match is good (>70%), generate both an optimized CV JSON AND a tailored Cover Letter ("Lettre de Motivation") JSON.

CRITICAL REQUIREMENT: If the analyzed text is NOT an active job opening/offer (e.g. it is a salary estimate page, a company review page, an interview prep guide, an informational page, or a generic landing page), you MUST return "verdict": "PASS" and "match_score": 0. DO NOT generate any CV or Cover Letter content for such pages.

Write the Cover Letter paragraphs in the SAME language as the job offer description (usually French or English).

Output EXACTLY this JSON structure:
{
    "match_score": 0-100,
    "job_title": "...",
    "company": "...",
    "verdict": "APPLY" | "PASS",
    "justification": "Max 5 words.",
    "optimized_cv_json": {
        "name": "...",
        "title": "...",
        "email": "...",
        "phone": "...",
        "location": "...",
        "summary": "...",
        "experiences": [{"role": "...", "company": "...", "period": "...", "location": "...", "bullets": ["..."]}],
        "education": [{"degree": "...", "school": "...", "year": "...", "detail": "..."}],
        "skills": {"categories": [{"name": "...", "items": ["..."]}]},
        "languages": [{"lang": "...", "level": "...", "level_num": 1-5}],
        "certifications": ["..."],
        "interests": ["..."]
    },
    "cover_letter_json": {
        "name": "...",
        "title": "...",
        "email": "...",
        "phone": "...",
        "location": "...",
        "linkedin": "...",
        "github": "...",
        "portfolio": "...",
        "date": "...",
        "company_name": "...",
        "company_address": "...",
        "hiring_manager": "...",
        "subject": "...",
        "body_paragraphs": [
            "...",
            "...",
            "..."
        ]
    }
}
CRITICAL: "justification" MUST be extremely short (under 5 words). Do not waste tokens! For date field in cover_letter_json, use today's date formatted nicely (e.g. "Le 18 mai 2026" or "May 18, 2026"). For hiring_manager, use "Responsable Recrutement" if no name is specified.
"""

        user_prompt = f"CV CANDIDAT:\n{self.cv_text[:4000]}"
        if self.letter_text:
            user_prompt += f"\n\nANCIENNE LETTRE DE MOTIVATION DU CANDIDAT (guide de style et d'anecdotes):\n{self.letter_text[:3000]}"
        user_prompt += f"\n\nOFFRE D'EMPLOI:\n{content}"

        try:
            # Clean up deployment names (remove -pro suffix)
            raw_deployment = self.config.get("azure_deployment") or "gpt-5.4"
            main_deployment = raw_deployment.replace("-pro", "")
            
            deployments = [main_deployment, "gpt-5.4", "gpt-4o"]
            # Remove duplicates while preserving order
            deployments = list(dict.fromkeys([d for d in deployments if d]))
            
            resp = None
            last_err = None
            
            for deployment in deployments:
                try:
                    if self.ai_provider == "azure":
                        self.log("AI", f"Appel Azure OpenAI (déploiement : {deployment})...")
                        
                        # Use requests directly to avoid httpx/openai library hangs on this system
                        url = f"{self.config.get('azure_endpoint')}/openai/deployments/{deployment}/chat/completions?api-version=2024-12-01-preview"
                        headers = {
                            "Content-Type": "application/json",
                            "api-key": self.config.get("api_key")
                        }
                        payload = {
                            "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                            "temperature": 0.1,
                            "response_format": {"type": "json_object"}
                        }
                        
                        response = requests.post(url, headers=headers, json=payload, timeout=60)
                        response.raise_for_status()
                        
                        resp_json = response.json()
                        content = resp_json["choices"][0]["message"]["content"]
                        
                        self.log("AI", "Réponse reçue de l'IA.")
                        result = json.loads(content)
                        return result
                    elif self.ai_provider == "groq":
                        resp = self.client.chat.completions.create(
                            model="llama-3.1-70b-versatile",
                            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                            temperature=0.1,
                            response_format={"type": "json_object"}
                        )
                        break
                    else:
                        resp = self.client.chat.completions.create(
                            model="gpt-4o",
                            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
                            temperature=0.1,
                            response_format={"type": "json_object"}
                        )
                        break
                except Exception as e:
                    last_err = e
                    self.log("ERROR", f"Échec avec {deployment}: {str(e)}")
                    continue
            
            if not resp:
                raise last_err or Exception("Aucun modèle n'a pu répondre.")

            result = json.loads(resp.choices[0].message.content)
            return result
        except Exception as e:
            self.log("ERROR", f"Erreur AI finale : {str(e)}")
            return None

    def save_results(self, result: Dict[str, Any]):
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        company = re.sub(r'[^\w\s]', '', result.get("company", "Inconnu")).strip().replace(" ", "_")
        job = re.sub(r'[^\w\s]', '', result.get("job_title", "Poste")).strip().replace(" ", "_")
        
        folder_name = f"{timestamp}_{company}_{job}"
        folder_path = os.path.join(self.output_dir, folder_name)
        os.makedirs(folder_path, exist_ok=True)

        # Save Info
        result["theme"] = self.config.get("theme", "Classic Dark")
        with open(os.path.join(folder_path, "offre_info.json"), "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        # Save CV PDF
        cv_data = result.get("optimized_cv_json")
        theme = self.config.get("theme", "Classic Dark")
        if cv_data:
            try:
                self.log("SAVE", "Génération du CV optimisé (Smart Auto-Scaling 1 page)...")
                # Remove static scaling, let the PDF engine decide
                if "custom_style" in cv_data:
                    cv_data["custom_style"].pop("font_scale", None)
                
                pdf_bytes = generate_pdf(cv_data, theme=theme)
                with open(os.path.join(folder_path, "CV_Optimise.pdf"), "wb") as f:
                    f.write(pdf_bytes)
                self.log("SAVE", f"Dossier CV créé avec succès.")
            except Exception as e:
                self.log("ERROR", f"Échec génération PDF CV : {str(e)}")
                traceback.print_exc()

        # Save Cover Letter PDF
        letter_data = result.get("cover_letter_json")
        if letter_data:
            try:
                self.log("SAVE", "Génération de la Lettre de Motivation optimisée correspondante...")
                letter_pdf_bytes = generate_pdf(letter_data, theme=theme, is_cover_letter=True)
                with open(os.path.join(folder_path, "Lettre_Motivation.pdf"), "wb") as f:
                    f.write(letter_pdf_bytes)
                self.log("SAVE", "Dossier Lettre de Motivation créé avec succès.")
            except Exception as e:
                self.log("ERROR", f"Échec génération PDF Lettre de Motivation : {str(e)}")
                traceback.print_exc()
        
        self.log("SAVE", f"Dossier complet créé : {folder_path}")

    def run(self, query: str, location: str = ""):
        print("\n" + "═"*70)
        print(f" 🚀  MISSION DE CHASSE ACTIVÉE : '{query}' (Location: {location})")
        print("═"*70 + "\n")
        
        links = self.search_jobs(query, location)
        matches_found = 0
        
        for link in links:
            try:
                result = self.analyze_and_optimize(link)
                if result:
                    # Post-analysis AI company exclusion check (100% bulletproof protection)
                    ai_company = (result.get("company") or "").lower().strip()
                    if any(exc in ai_company for exc in self.exclude_companies):
                        self.log("THINK", f"Filtrage : Offre de '{result.get('company')}' ignorée après analyse AI (entreprise bannie).")
                        continue
                        
                    if result.get("verdict") == "APPLY":
                        result["source_url"] = link
                        self.log("MATCH", f"Match trouvé ! {result.get('company')} - {result.get('job_title')} ({result.get('match_score')}%).")
                        self.save_results(result)
                        matches_found += 1
                    else:
                        self.log("THINK", f"Verdict PASS pour {result.get('company', 'Inconnu')} (Score: {result.get('match_score')}%). Motif: {result.get('justification', 'N/A')[:100]}...")
                else:
                    self.log("ERROR", f"Échec de l'analyse pour {link[:50]}...")
                
                # Small breathe between calls
                time.sleep(2)
            except Exception as e:
                self.log("ERROR", f"Erreur inattendue sur {link[:30]}: {str(e)}")
                continue
        
        print("\n" + "═"*70)
        print(f" ✅  MISSION TERMINÉE : {matches_found} opportunités générées.")
        print("═"*70 + "\n")

if __name__ == "__main__":
    # Integration for local testing
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--query", required=True)
    parser.add_argument("--cv", required=True)
    parser.add_argument("--letter", default="", help="Base cover letter file (PDF or text)")
    parser.add_argument("--provider", default="groq")
    parser.add_argument("--key", required=True)
    parser.add_argument("--location", default="", help="City or Geographic area")
    parser.add_argument("--endpoint", help="Azure Endpoint")
    parser.add_argument("--deployment", help="Azure Deployment Name")
    parser.add_argument("--theme", default="Classic Dark", help="CV Theme Name")
    parser.add_argument("--jobteaser-email", help="JobTeaser email")
    parser.add_argument("--jobteaser-password", help="JobTeaser password")
    parser.add_argument("--jobteaser-url", help="JobTeaser university root URL")
    parser.add_argument("--exclude-companies", default="", help="Comma-separated list of companies to exclude")
    parser.add_argument("--search-mode", default="all", help="all or jobteaser")
    parser.add_argument("--recency", default="any", choices=["any", "24h", "7d"], help="Yahoo date filter")
    
    args = parser.parse_args()
    
    config = {
        "ai_provider": args.provider,
        "cv_path": args.cv,
        "letter_path": args.letter,
        "api_key": args.key,
        "azure_endpoint": args.endpoint,
        "azure_deployment": args.deployment,
        "theme": args.theme,
        "jobteaser_email": args.jobteaser_email,
        "jobteaser_password": args.jobteaser_password,
        "jobteaser_url": args.jobteaser_url,
        "exclude_companies": args.exclude_companies,
        "search_mode": args.search_mode,
        "recency": args.recency
    }
    
    agent = JobHunterAgent(config)
    agent.run(args.query, args.location)
