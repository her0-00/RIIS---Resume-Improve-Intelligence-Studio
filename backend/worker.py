import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import json
import io
import traceback
from backend.pdf_cv import THEMES, _ClassicDark, generate_cover_letter_pdf
from backend.docx_cv import generate_cv_docx

def get_theme_class(theme_name):
    return THEMES.get(theme_name, _ClassicDark)

def generate_pdf(cv_data, theme="Classic Dark", is_cover_letter=False):
    if is_cover_letter:
        return generate_cover_letter_pdf(cv_data, theme=theme)
    theme_cls = get_theme_class(theme)
    # The new structure has `generate` method on the theme class
    pdf_bytes = theme_cls.generate(cv_data)
    return pdf_bytes

def generate_docx(cv_data):
    """Generate DOCX format CV."""
    return generate_cv_docx(cv_data)

def main():
    try:
        # Support file-based I/O (args) or stdin/stdout fallback
        if len(sys.argv) == 3:
            with open(sys.argv[1], 'r', encoding='utf-8') as f:
                input_data = f.read()
        else:
            input_data = sys.stdin.read()

        if not input_data:
            print(json.dumps({"success": False, "error": "No input provided"}))
            sys.exit(1)
            
        data = json.loads(input_data)
        
        cv_data = data.get("cv_data", {})
        theme = data.get("theme", "Classic Dark")
        is_cover_letter = data.get("is_cover_letter", False)
        output_format = data.get("output_format") or data.get("format", "pdf")  # Support both keys

        # Sanitize: replace None lists/strings with safe defaults
        experiences = [e for e in (cv_data.get("experiences") or []) if isinstance(e, (dict, str))]
        cv_data["experiences"] = []
        for e in experiences:
            if isinstance(e, str):
                e = {"role": e, "company": "", "period": "", "location": "", "bullets": []}
            if not isinstance(e.get("bullets"), list): e["bullets"] = []
            e["bullets"] = [b for b in e["bullets"] if isinstance(b, str)]
            if not isinstance(e.get("location"), str): e["location"] = ""
            for f in ["role", "company", "period"]:
                if not isinstance(e.get(f), str): e[f] = e.get(f) or ""
            # Sanitize period: replace Private Use Area characters with dash
            import re
            e["period"] = re.sub(r'[\uE000-\uF8FF]', '-', e["period"])
            cv_data["experiences"].append(e)

        education = [e for e in (cv_data.get("education") or []) if isinstance(e, (dict, str))]
        cv_data["education"] = []
        for e in education:
            if isinstance(e, str):
                e = {"degree": e, "school": "", "year": "", "detail": None}
            if not isinstance(e.get("detail"), str): e["detail"] = None
            for f in ["degree", "school", "year"]:
                if not isinstance(e.get(f), str): e[f] = e.get(f) or ""
            cv_data["education"].append(e)

        if not isinstance(cv_data.get("certifications"), list): cv_data["certifications"] = []
        cv_data["certifications"] = [c for c in cv_data["certifications"] if isinstance(c, str)]

        if not isinstance(cv_data.get("interests"), list): cv_data["interests"] = []
        cv_data["interests"] = [i for i in cv_data["interests"] if isinstance(i, str)]

        if not isinstance(cv_data.get("languages"), list): cv_data["languages"] = []
        cv_data["languages"] = [l for l in cv_data["languages"] if isinstance(l, dict)]
        for li in cv_data["languages"]:
            try:
                li["level_num"] = int(li.get("level_num", 3))
            except (ValueError, TypeError):
                li["level_num"] = 3
            if not isinstance(li.get("lang"), str): li["lang"] = ""
            if not isinstance(li.get("level"), str): li["level"] = ""

        skills = cv_data.get("skills")
        if not isinstance(skills, dict) or not isinstance(skills.get("categories"), list):
            cv_data["skills"] = {"categories": []}
        cv_data["skills"]["categories"] = [c for c in cv_data["skills"]["categories"] if isinstance(c, dict)]
        for cat in cv_data["skills"]["categories"]:
            if not isinstance(cat.get("items"), list): cat["items"] = []
            cat["items"] = [i for i in cat["items"] if isinstance(i, str)]
            if not isinstance(cat.get("name"), str): cat["name"] = ""

        for field in ["name", "title", "email", "phone", "location", "summary", "github", "portfolio", "linkedin"]:
            if not isinstance(cv_data.get(field), str): cv_data[field] = cv_data.get(field) or ""

        # Pass custom_style through (dict with accent_color, text_color, heading_color, font_scale)
        custom_style = cv_data.get("custom_style")
        if custom_style and not isinstance(custom_style, dict):
            cv_data["custom_style"] = {}

        # Generate based on format
        if output_format == "docx":
            output_bytes = generate_docx(cv_data)
        else:
            output_bytes = generate_pdf(cv_data, theme, is_cover_letter)
        
        # Write bytes payload directly to stdout 
        # (Alternatively base64 encode it so it can be safely sent as JSON)
        import base64
        b64_output = base64.b64encode(output_bytes).decode('utf-8')
        
        output_key = "pdf_base64" if output_format == "pdf" else "docx_base64"
        output = {"success": True, output_key: b64_output}
        result = json.dumps(output)
        if len(sys.argv) == 3:
            with open(sys.argv[2], 'w', encoding='utf-8') as f:
                f.write(result)
        else:
            print(result)
        
    except Exception as e:
        error_info = {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        result = json.dumps(error_info)
        if len(sys.argv) == 3:
            try:
                with open(sys.argv[2], 'w', encoding='utf-8') as f:
                    f.write(result)
            except:
                print(result)
        else:
            print(result)
        sys.exit(1)

if __name__ == "__main__":
    main()
