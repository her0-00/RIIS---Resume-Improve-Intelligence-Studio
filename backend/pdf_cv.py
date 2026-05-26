"""
IRIS — Moteur de génération PDF
5 thèmes CV : Classic-Dark, Canva-Minimal, Executive-Dark, Nordic-Clean, Tech-Grid, Luxury-Serif
"""

import io
import os
import re
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

from backend.logger import get_logger
from backend.ats_metadata import add_ats_metadata

log = get_logger("pdf_cv")

# ── FONT REGISTRATION ──────────────────────────────────────────────
_HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(_HERE, "..", "fonts", "")

_FALLBACKS = {
    "Poppins":        "Helvetica",
    "Poppins-Bold":   "Helvetica-Bold",
    "Poppins-Light":  "Helvetica",
    "Poppins-Medium": "Helvetica",
    "Poppins-Italic": "Helvetica-Oblique",
    "Lora":           "Times-Roman",
    "Lora-Italic":    "Times-Italic",
}
_FONT_MAP = {}


def register_fonts():
    fonts = {
        "Poppins":        "Poppins-Regular.ttf",
        "Poppins-Bold":   "Poppins-Bold.ttf",
        "Poppins-Light":  "Poppins-Light.ttf",
        "Poppins-Medium": "Poppins-Medium.ttf",
        "Poppins-Italic": "Poppins-Italic.ttf",
        "Lora":           "Lora-Regular.ttf",
        "Lora-Italic":    "Lora-Italic.ttf",
    }
    for name, filename in fonts.items():
        path = os.path.join(FONT_DIR, filename)
        try:
            pdfmetrics.registerFont(TTFont(name, path, asciiReadable=1))
            _FONT_MAP[name] = name
        except Exception as e:
            _FONT_MAP[name] = _FALLBACKS[name]
            log.warning(f"Font {name} fallback → {_FALLBACKS[name]}")


register_fonts()


def _f(name: str, force_family: str = None) -> str:
    """Get registered font name with fallback and family overrides."""
    if not force_family:
        return _FONT_MAP.get(name, _FALLBACKS.get(name, "Helvetica"))

    # If force_family is set, we MUST map the requested style (bold, italic, etc.) 
    # to the corresponding variant of the forced family.
    is_bold = "Bold" in name or "Medium" in name # Treat medium as bold for families that lack it
    is_italic = "Italic" in name
    is_light = "Light" in name
    
    if force_family == "Roboto" or force_family == "Inter":
        # Map to standard sans-serif PDF fonts
        if is_bold: return "Helvetica-Bold"
        if is_italic: return "Helvetica-Oblique"
        return "Helvetica"
    elif force_family == "Times-Roman":
        # Map to standard serif PDF font
        if is_bold: return "Times-Bold"
        if is_italic: return "Times-Italic"
        return "Times-Roman"
    elif force_family == "Lora":
        # Lora is a serif font we have registered
        if is_italic: return "Lora-Italic"
        return "Lora" # We use regular for bold/light if not available
    elif force_family == "Poppins":
        # Poppins is a sans-serif font we have registered
        if is_bold: return "Poppins-Bold"
        if is_italic: return "Poppins-Italic"
        if is_light: return "Poppins-Light"
        return "Poppins"
    
    return _FONT_MAP.get(name, _FALLBACKS.get(name, "Helvetica"))


def _get_labels(lang="fr") -> dict:
    """Get localized section labels."""
    labels = {
        "fr": {
            "experience": "EXPÉRIENCE PROFESSIONNELLE",
            "education": "FORMATION",
            "skills": "COMPÉTENCES",
            "summary": "PROFIL",
            "languages": "LANGUES",
            "projects": "PROJETS",
            "certifications": "CERTIFICATIONS",
            "contact": "CONTACT",
            "expertise": "EXPERTISE",
            "skills_lang": "COMPÉTENCES & LANGUES",
            "interests": "CENTRES D'INTÉRÊT"
        },
        "en": {
            "experience": "PROFESSIONAL EXPERIENCE",
            "education": "EDUCATION",
            "skills": "SKILLS & EXPERTISE",
            "summary": "SUMMARY",
            "languages": "LANGUAGES",
            "projects": "PROJECTS",
            "certifications": "CERTIFICATIONS",
            "contact": "CONTACT INFO",
            "expertise": "EXPERTISE",
            "skills_lang": "SKILLS & LANGUAGES",
            "interests": "INTERESTS"
        }
    }
    return labels.get(lang.lower(), labels["fr"])


def _sanitize_text(text: str) -> str:
    """Replace problematic Unicode characters."""
    if not text:
        return text
    replacements = {
        '\u0153': 'oe',
        '\u0152': 'OE',
        '\u00e6': 'ae',
        '\u00c6': 'AE',
        '\u20ac': 'EUR',
        '\u2014': '-',
        '\u2013': '-',
        '\u2018': "'",
        '\u2019': "'",
        '\u201c': '"',
        '\u201d': '"',
        '\u2026': '...',
        '\uf000': '-',  # Private Use Area character often used as dash
        '\uf001': '-',
        '\uf002': '-',
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
    # Remove any remaining Private Use Area characters (U+E000 to U+F8FF)
    import re
    text = re.sub(r'[\uE000-\uF8FF]', '-', text)
    return text


# ── ATS OPTIMIZATIONS (STEALTH MODE) ──────────────────────────────────

def _draw_ats_hidden_keywords(c, cv_data, bg_color=None):
    """
    Désactivé : Supprime l'injection automatique de mots-clés en bas de page.
    L'IA gère maintenant l'incorporation organique des mots-clés dans les sections visibles.
    """
    pass


# ── HYPERLINK PARSING ──────────────────────────────────────────────
_LINK_RE = re.compile(r'^(.+?)\[(https?://[^\]]+)\]$')


def _parse_link(text: str):
    """Parse 'Label[https://url]' → (label, url) or (text, None)."""
    if not text:
        return (text, None)
    t = text.strip()
    
    # 1. Standard bracketed format: Label[https://url]
    m = _LINK_RE.match(t)
    if m:
        return (m.group(1).strip(), m.group(2).strip())
    
    # 2. Bare URLs starting with http
    if t.startswith(('http://', 'https://')):
        return (t, t)
        
    # 3. Bare Email Addresses
    if '@' in t and '.' in t and ' ' not in t and not t.startswith('mailto:'):
        return (t, f"mailto:{t}")
        
    # 3. Detect common professional links even without http prefix
    low = t.lower()
    if any(p in low for p in ['linkedin.com/', 'github.com/', 'portfolio.', 'bit.ly/', 'me.io/']):
        url = t if t.startswith('http') else 'https://' + t
        return (t, url)
        
    return (t, None)


def _draw_link(c, x, y, label, url, font, size, color, underline=True, force_family=None):
    """Draw clickable hyperlink text. Returns width of the drawn text."""
    fn = _f(font, force_family=force_family)
    c.setFont(fn, size)
    c.setFillColor(color)
    
    # 1. Standard visible text
    c.drawString(x, y, label)
    w = c.stringWidth(label, fn, size)
    
    # 2. ATS-Proofing: Inject Label + URL as invisible text into the PDF footer area
    # This helps ATS systems map the links to the correct database fields.
    if not hasattr(c, '_ats_link_x'):
        c._ats_link_x = 30
    
    # Map to standard ATS field labels
    low_url = url.lower()
    ats_prefix = ""
    if "linkedin.com" in low_url: ats_prefix = "LinkedIn URL: "
    elif "github.com" in low_url: ats_prefix = "GitHub URL: "
    elif "twitter.com" in low_url: ats_prefix = "Twitter URL: "
    elif "scholar.google" in low_url: ats_prefix = "Google Scholar URL: "
    elif any(p in low_url for p in ["portfolio", "behance", "dribbble", "me.io"]): 
        ats_prefix = "Design Portfolio URL: "
    
    full_ats_text = f"{ats_prefix}{url} "
    
    to = c.beginText(c._ats_link_x, 15) 
    to.setFont(fn, 0.1)
    to.setTextRenderMode(0)
    c.setFillColor(HexColor("#FFFFFF"))
    to.textOut(full_ats_text)
    c.drawText(to)
    
    # Update tracking X for next link
    c._ats_link_x += c.stringWidth(full_ats_text, fn, 0.1)
    
    if underline:
        c.setStrokeColor(color)
        c.setLineWidth(0.4)
        c.line(x, y - 1.5, x + w, y - 1.5)
    
    # 3. Clickable annotation rect
    c.linkURL(url, (x, y - 2, x + w, y + size), relative=0)
    return w


def _get_luminance(color):
    """Calculate relative luminance of a ReportLab color."""
    return 0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue


def _ensure_contrast(fg_color, bg_color, min_ratio=4.0, attr_name="Color"):
    """Adjust foreground color to ensure minimum contrast against background."""
    l1 = _get_luminance(fg_color)
    l2 = _get_luminance(bg_color)
    # Contrast ratio = (L1 + 0.05) / (L2 + 0.05)
    ratio = (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)

    if ratio < min_ratio:
        new_col = HexColor("#FFFFFF") if l2 < 0.5 else HexColor("#1A1A1A")
        log.info(f"[CONTRAST] {attr_name} adjusted: {fg_color.hexval()} -> {new_col.hexval()} (ratio {ratio:.2f} < {min_ratio})")
        return new_col
    return fg_color


def _apply_custom_style(cls, cv_data):
    """Apply granular custom_style overrides from cv_data onto a theme class copy."""
    import types
    style = cv_data.get("custom_style", {})

    # Filter out None and empty string values
    style = {k: v for k, v in style.items() if v}

    ns = types.SimpleNamespace()
    for attr in dir(cls):
        if attr.startswith('_'): continue
        setattr(ns, attr, getattr(cls, attr))

    # Ensure all required attributes are present, falling back to _ClassicDark
    for attr in dir(_ClassicDark):
        if attr.startswith('_') or attr in ['generate', 'render']: continue
        if not hasattr(ns, attr):
            setattr(ns, attr, getattr(_ClassicDark, attr))

    setattr(ns, "LANG", cv_data.get("lang", "fr"))

    if not style:
        setattr(ns, "FONT_OVERRIDE", getattr(cls, "FONT_OVERRIDE", None))
        return ns, 1.0

    log.info(f"[CUSTOM_STYLE] Applying: {style}")

    # 1b. Font Global Override
    if style.get("font_family"):
        setattr(ns, "FONT_OVERRIDE", style["font_family"])
    else:
        setattr(ns, "FONT_OVERRIDE", getattr(cls, "FONT_OVERRIDE", None))

    # 1. Backgrounds
    if style.get("main_bg"):
        try:
            col = HexColor(style["main_bg"])
            for a in ['BODY_BG', 'BG']:
                if hasattr(ns, a): setattr(ns, a, col)
        except: pass

    if style.get("sidebar_bg"):
        try:
            col = HexColor(style["sidebar_bg"])
            for a in ['SIDEBAR_BG', 'SIDEBAR_BG2', 'SURFACE', 'SURFACE2']:
                if hasattr(ns, a): setattr(ns, a, col)
        except: pass

    if style.get("header_bg"):
        try:
            col = HexColor(style["header_bg"])
            if hasattr(ns, 'HEADER_BG'): setattr(ns, 'HEADER_BG', col)
        except: pass

    # Current background for contrast checks (main body)
    body_bg = getattr(ns, 'BODY_BG', getattr(ns, 'BG', HexColor("#FFFFFF")))
    sidebar_bg = getattr(ns, 'SIDEBAR_BG', body_bg)

    # 2. Colors - General Accent (Lines, Dots, etc.)
    if style.get("accent_color"):
        try:
            acc = HexColor(style["accent_color"])
            # Aggressively override common accent keys
            # TAG_BG is EXCLUDED here to prevent text/bg color collision in Medical/Canva themes
            # DIVIDER is EXCLUDED here to prevent language level dots from appearing all filled
            for a in ['ACCENT', 'ACCENT_LIGHT', 'ACCENT_DARK', 'ACCENT2', 'ACCENT3', 
                      'TAG_BORDER', 'BORDER']:
                if hasattr(ns, a): setattr(ns, a, acc)
        except: pass

    # 3. Colors - General Typography
    if style.get("text_color"):
        try:
            col = HexColor(style["text_color"])
            # Enforce contrast against main background
            col = _ensure_contrast(col, body_bg, attr_name="Body Text")

            for a in ['TEXT', 'TEXT_DARK', 'TEXT_MED', 'TEXT_LIGHT', 'BODY_TEXT']:
                if hasattr(ns, a): setattr(ns, a, col)
            setattr(ns, 'CONTACT_COLOR', col)

            # Sidebar text contrast check
            scol = _ensure_contrast(col, sidebar_bg, attr_name="Sidebar Text")
            for a in ['SIDEBAR_TEXT', 'SIDEBAR_MUTED']:
                if hasattr(ns, a): setattr(ns, a, scol)
            
            # Greedily apply to Roles/Titles if they are not explicitly colored
            if not style.get("subheading_color"):
                setattr(ns, 'TITLE_COLOR', col)
                setattr(ns, 'ROLE_COLOR', col)
        except: pass

    # 4. Specific Typography (Applied last to override general settings)
    if style.get("subheading_color"):
        # This is "Post / Roles" in the frontend
        try:
            col = HexColor(style["subheading_color"])
            col = _ensure_contrast(col, body_bg)
            setattr(ns, 'TITLE_COLOR', col)
            setattr(ns, 'ROLE_COLOR', col)
            setattr(ns, 'ACCENT_DARK', col)
            if hasattr(ns, 'ACCENT_LIGHT'): setattr(ns, 'ACCENT_LIGHT', col)
            if hasattr(ns, 'SUBHEADING_COLOR'): setattr(ns, 'SUBHEADING_COLOR', col)
            if hasattr(ns, 'ACCENT3'): setattr(ns, 'ACCENT3', col)
        except: pass
    
    if style.get("heading_color"):
        # This is "Section Titles" in the frontend
        try:
            col = HexColor(style["heading_color"])
            setattr(ns, 'SECTION_TITLE_COLOR', col)
            if hasattr(ns, 'HEADING_COLOR'): setattr(ns, 'HEADING_COLOR', col)
            if hasattr(ns, 'ACCENT2'): setattr(ns, 'ACCENT2', col)
        except: pass
    
    if style.get("name_color"):
        try:
            col = HexColor(style["name_color"])
            setattr(ns, 'NAME_COLOR', col)
            # We don't override generic WHITE here to avoid background corruption
            if hasattr(ns, 'NAME_TEXT_COLOR'): setattr(ns, 'NAME_TEXT_COLOR', col)
        except: pass
    
    # 5. Photo Border Color
    if style.get("photo_border_color"):
        try:
            col = HexColor(style["photo_border_color"])
            setattr(ns, 'PHOTO_BORDER', col)
        except: pass
    
    font_scale = 1.0
    if style.get("font_scale"):
        try:
            font_scale = max(0.5, min(2.0, float(style["font_scale"])))
        except: pass
    
    log.info(f"[CUSTOM_STYLE] Applied successfully, font_scale={font_scale}")
    return ns, font_scale


# ── SHARED HELPERS ─────────────────────────────────────────────────
def _draw_rect(c, x, y, w, h, fill=None, stroke=None, radius=0, stroke_width=0.5):
    if fill:   c.setFillColor(fill)
    if stroke: c.setStrokeColor(stroke)
    c.setLineWidth(stroke_width)
    if radius > 0:
        c.roundRect(x, y, w, h, radius, fill=1 if fill else 0, stroke=1 if stroke else 0)
    else:
        c.rect(x, y, w, h, fill=1 if fill else 0, stroke=1 if stroke else 0)


def _parse_markdown(text):
    """Parse **bold** and *italic* markdown. Returns list of (text, style) tuples."""
    if not text:
        return [(text, 'normal')]
    
    import re
    parts = []
    pos = 0
    
    # Match **bold** or *italic*
    pattern = r'(\*\*(.+?)\*\*|\*(.+?)\*)'
    
    for match in re.finditer(pattern, text):
        # Add text before match
        if match.start() > pos:
            parts.append((text[pos:match.start()], 'normal'))
        
        # Add matched text with style
        if match.group(2):  # **bold**
            parts.append((match.group(2), 'bold'))
        elif match.group(3):  # *italic*
            parts.append((match.group(3), 'italic'))
        
        pos = match.end()
    
    # Add remaining text
    if pos < len(text):
        parts.append((text[pos:], 'normal'))
    
    return parts if parts else [(text, 'normal')]


def _draw_multiline(c, text, x, y, font, size, color, max_width, line_height, align='left', dry_run=False, force_family=None):
    """Draw text with word-wrap and markdown support. returns the new y position."""
    text = _sanitize_text(text)
    fscale = getattr(c, "_fscale", 1.0)
    line_height = line_height * fscale
    base_font = _f(font, force_family=force_family)
    
    if not text or not text.strip():
        return y - line_height
    
    # Parse markdown
    parts = _parse_markdown(text)
    
    # Build words with their styles
    styled_words = []
    for part_text, style in parts:
        words = part_text.split()
        for word in words:
            styled_words.append((word, style))
    
    # Word wrap with style tracking
    lines = []  # [([(word, style), ...], total_width), ...]
    current_words = []
    current_width = 0
    
    for word, style in styled_words:
        # Get font for this style
        if style == 'bold':
            word_font = _f(font.replace('Regular', 'Bold').replace('Light', 'Bold').replace('Medium', 'Bold') if 'Bold' not in font else font, force_family=force_family)
        elif style == 'italic':
            word_font = _f(font.replace('Regular', 'Italic').replace('Bold', 'Bold') if 'Italic' not in font else font, force_family=force_family)
        else:
            word_font = base_font
        
        word_width = c.stringWidth(word, word_font, size)
        space_width = c.stringWidth(' ', base_font, size) if current_words else 0
        
        if current_width + space_width + word_width <= max_width or not current_words:
            current_words.append((word, style))
            current_width += space_width + word_width
        else:
            lines.append(current_words)
            current_words = [(word, style)]
            current_width = word_width
    
    if current_words:
        lines.append(current_words)
    
    if not lines:
        return y - line_height
    
    if dry_run:
        return y - (len(lines) * line_height)
    
    # Draw lines with styles
    c.setFillColor(color)
    for line_words in lines:
        line_w = 0
        if align == 'center':
            # Calculate total width for centering
            for i, (word, style) in enumerate(line_words):
                if style == 'bold':
                    word_font = _f(font.replace('Regular', 'Bold').replace('Light', 'Bold').replace('Medium', 'Bold') if 'Bold' not in font else font, force_family=force_family)
                elif style == 'italic':
                    word_font = _f(font.replace('Regular', 'Italic').replace('Bold', 'Bold') if 'Italic' not in font else font, force_family=force_family)
                else:
                    word_font = base_font
                line_w += c.stringWidth(word, word_font, size)
                if i < len(line_words) - 1:
                    line_w += c.stringWidth(' ', base_font, size)
            cx = x + (max_width - line_w) / 2
        else:
            cx = x
            
        for i, (word, style) in enumerate(line_words):
            # Get font for this style
            if style == 'bold':
                word_font = _f(font.replace('Regular', 'Bold').replace('Light', 'Bold').replace('Medium', 'Bold') if 'Bold' not in font else font, force_family=force_family)
            elif style == 'italic':
                word_font = _f(font.replace('Regular', 'Italic').replace('Bold', 'Bold') if 'Italic' not in font else font, force_family=force_family)
            else:
                word_font = base_font
            
            c.setFont(word_font, size)
            c.drawString(cx, y, word)
            cx += c.stringWidth(word, word_font, size)
            
            # Add space after word (except last)
            if i < len(line_words) - 1:
                cx += c.stringWidth(' ', base_font, size)
        
        y -= line_height
    
    return y


def _multiline_height(c, text, font, size, max_width, line_height, force_family=None):
    """Calculate the pixel height that _draw_multiline would consume without drawing."""
    font = _f(font, force_family=force_family)
    c.setFont(font, size)
    if not text or not text.strip():
        return line_height
    words = text.split()
    lines, current = [], []
    for word in words:
        test = " ".join(current + [word])
        if c.stringWidth(test, font, size) <= max_width:
            current.append(word)
        else:
            if current: lines.append(" ".join(current))
            current = [word]
    if current: lines.append(" ".join(current))
    fscale = getattr(c, "_fscale", 1.0)
    return len(lines) * line_height * fscale


def _spaced_string(c, x, y, text, font, size, color, spacing=0.8, force_family=None):
    """Draw text with letter-spacing as a single string (ATS-safe)."""
    text = _sanitize_text(text)
    c.setFont(_f(font, force_family=force_family), size)
    c.setFillColor(color)
    c._charSpace = spacing
    c.drawString(x, y, text)
    c._charSpace = 0


def _spaced_centred(c, cx, y, text, font, size, color, spacing=0.8, force_family=None):
    text = _sanitize_text(text)
    c.setFont(_f(font, force_family=force_family), size)
    c.setFillColor(color)
    c._charSpace = spacing
    c.drawCentredString(cx, y, text)
    c._charSpace = 0


def _draw_wrapped_header(c, text, x, y, font, size, color, max_width, line_height, centered=False, dry_run=False, force_family=None):
    """Specifically for Name/Title wrapping in headers."""
    text = _sanitize_text(text)
    fscale = getattr(c, "_fscale", 1.0)
    line_height = line_height * fscale
    font = _f(font, force_family=force_family)
    c.setFont(font, size)
    c.setFillColor(color)
    if not text: return y
    
    words = text.split()
    lines, current = [], []
    for word in words:
        test = " ".join(current + [word])
        if c.stringWidth(test, font, size) <= max_width:
            current.append(word)
        else:
            if current: lines.append(" ".join(current))
            current = [word]
    if current: lines.append(" ".join(current))
    
    if dry_run:
        return y - (len(lines) * line_height)

    for line in lines:
        if centered:
            c.drawCentredString(x + max_width/2, y, line)
        else:
            c.drawString(x, y, line)
        y -= line_height
    return y


def _prepare_canvas(c, fscale):
    """
    Monkey-patch the canvas to scale all font sizes consistently.
    Ensures that c.stringWidth correctly accounts for fscale in measurements.
    """
    c._fscale = fscale
    if fscale == 1.0: return
    
    # 1. Scale drawing font size
    c._old_setFont = c.setFont
    c.setFont = lambda psname, size: c._old_setFont(psname, size * fscale)
    
    # 2. Scale measurement font size
    c._old_stringWidth = c.stringWidth
    def scaled_stringWidth(text, fontName=None, fontSize=None):
        if fontSize is not None:
            return c._old_stringWidth(text, fontName, fontSize * fscale)
        # If fontSize is None, ReportLab uses the current state (already scaled)
        return c._old_stringWidth(text, fontName, fontSize)
    c.stringWidth = scaled_stringWidth


def _draw_wrapped_contact(c, cv_data, x, y, max_w, font_name="Poppins", font_size=8, color=None, sep="  ·  ", dry_run=False, force_family=None, keys=None):
    """
    Draws contact items (email, phone, etc.) wrapping them to new lines if they exceed max_w.
    Returns the new 'y' position.
    """
    from reportlab.lib.colors import HexColor
    color = color or HexColor("#666666")
    items = []
    keys_list = keys or ["email", "phone", "location", "linkedin", "github", "portfolio"]
    for key in keys_list:
        if cv_data.get(key):
            items.append((key, cv_data[key]))
    
    if not items:
        return y

    curr_x = x
    curr_y = y
    fscale = getattr(c, "_fscale", 1.0)
    c.setFont(_f(font_name, force_family=force_family), font_size)
    c.setFillColor(color)
    
    sep_w = c.stringWidth(sep, _f(font_name, force_family=force_family), font_size)
    
    for i, (key, val) in enumerate(items):
        label, url = _parse_link(val)
        item_w = c.stringWidth(label, _f(font_name, force_family=force_family), font_size)
        
        # Check if we need to wrap
        if i > 0 and curr_x + sep_w + item_w > x + max_w:
            curr_x = x
            curr_y -= (font_size * fscale + 4)
        
        if i > 0 and curr_x > x:
            c.setFont(_f(font_name, force_family=force_family), font_size)
            c.setFillColor(color)
            c.drawString(curr_x, curr_y, sep)
            curr_x += sep_w

        if not dry_run:
            if url:
                curr_x += _draw_link(c, curr_x, curr_y, label, url, font_name, font_size, color, force_family=force_family)
            else:
                c.setFont(_f(font_name, force_family=force_family), font_size)
                c.setFillColor(color)
                c.drawString(curr_x, curr_y, label)
                curr_x += item_w
        else:
            curr_x += (item_w + 2) # small buffer
            
    return curr_y - 14 * fscale


def _draw_vertical_contact(c, cv_data, x, y, font_name="Poppins", font_size=7, color=None, spacing=11, force_family=None):
    """Draw contact info as a vertical list (ideal for sidebars)."""
    from reportlab.lib.colors import HexColor
    color = color or HexColor("#666666")
    fscale = getattr(c, "_fscale", 1.0)
    spacing = spacing * fscale
    
    items = []
    for key in ["email", "phone", "location", "linkedin", "github", "portfolio"]:
        if cv_data.get(key):
            items.append((key, cv_data[key]))
    
    curr_y = y
    for key, val in items:
        label, url = _parse_link(val)

        if url:
            _draw_link(c, x, curr_y, label, url, font_name, font_size, color, force_family=force_family)
        else:
            c.setFont(_f(font_name, force_family=force_family), font_size)
            c.setFillColor(color)
            c.drawString(x, curr_y, label)
        curr_y -= spacing
    
    return curr_y


def _draw_wrapped_centred_contact(c, cv_data, cx, y, max_w, font_name="Poppins", font_size=8, color=None, sep="  ·  ", dry_run=False, force_family=None):
    """Centred version of the wrapped contact line."""
    from reportlab.lib.colors import HexColor
    color = color or HexColor("#666666")
    items = []
    for key in ["email", "phone", "location", "linkedin", "github", "portfolio"]:
        if cv_data.get(key):
            items.append((key, cv_data[key]))
    
    if not items: return y

    fscale = getattr(c, "_fscale", 1.0)
    c.setFont(_f(font_name, force_family=force_family), font_size)
    c.setFillColor(color)
    
    sep_w = c.stringWidth(sep, _f(font_name, force_family=force_family), font_size)
    
    # We group items into lines manually
    lines = []
    current_line = []
    curr_w = 0
    
    for i, (key, val) in enumerate(items):
        label, url = _parse_link(val)
        item_w = c.stringWidth(label, _f(font_name, force_family=force_family), font_size)
        
        needed = item_w + (sep_w if current_line else 0)
        if curr_w + needed > max_w and current_line:
            lines.append(current_line)
            current_line = [(key, label, url, item_w)]
            curr_w = item_w
        else:
            current_line.append((key, label, url, item_w))
            curr_w += needed
    if current_line:
        lines.append(current_line)

    curr_y = y
    for line in lines:
        row_w = sum([it[3] for it in line]) + (sep_w * (len(line) - 1))
        lx = cx - row_w / 2
        for j, (key, label, url, item_w) in enumerate(line):
            if j > 0:
                c.setFont(_f(font_name, force_family=force_family), font_size)
                c.setFillColor(color)
                c.drawString(lx, curr_y, sep)
                lx += sep_w

            if url:
                lx += _draw_link(c, lx, curr_y, label, url, font_name, font_size, color, force_family=force_family)
            else:
                c.setFont(_f(font_name, force_family=force_family), font_size)
                c.setFillColor(color)
                c.drawString(lx, curr_y, label)
                lx += item_w
        curr_y -= (font_size * fscale + 4)
        
    return curr_y - (font_size * fscale + 4)


def _draw_interests_tags(c, interests, x, y, max_w, font_name="Poppins", font_size=7, color=None, bg_color=None, force_family=None):
    """Draw interests as a comma-separated list or small tags. Returns new y."""
    if not interests: return y
    from reportlab.lib.colors import HexColor
    color = color or HexColor("#444444")
    fscale = getattr(c, "_fscale", 1.0)
    line_h = (font_size + 4) * fscale
    
    text = ", ".join(interests)
    return _draw_multiline(c, text, x, y, font_name, font_size, color, max_w, font_size + 4, force_family=force_family)


def _smart_generate(theme_cls, cv_data, render_callback):
    import io
    from reportlab.pdfgen import canvas
    from reportlab.lib.pagesizes import A4
    
    # Preprocess certifications to inject them into Skills categories, ensuring they render on all themes
    if cv_data.get("certifications"):
        cv_data = cv_data.copy()
        if "skills" not in cv_data or not isinstance(cv_data["skills"], dict):
            cv_data["skills"] = {"categories": []}
        elif "categories" not in cv_data["skills"] or not isinstance(cv_data["skills"]["categories"], list):
            cv_data["skills"]["categories"] = []
            
        has_cert_cat = any(cat.get("name", "").lower() == "certifications" for cat in cv_data["skills"]["categories"])
        if not has_cert_cat:
            cv_data["skills"]["categories"].append({
                "name": "Certifications",
                "items": cv_data["certifications"]
            })
            
    theme_cls, initial_fscale = _apply_custom_style(theme_cls, cv_data)
    
    for scale in [1.05, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7]:
        _fscale = initial_fscale * scale
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        _prepare_canvas(c, _fscale)
        
        pages_count = [1]
        
        def new_page_func():
            pages_count[0] += 1
            c.showPage()
            return A4[1] - 50 * _fscale
            
        render_callback(c, theme_cls, cv_data, _fscale, new_page_func)
        
        if pages_count[0] == 1 or scale == 0.7:
            c.save()
            return buf.getvalue()

class _ClassicDark:
    SIDEBAR_BG    = HexColor("#0F1117")
    SIDEBAR_BG2   = HexColor("#141720")
    ACCENT        = HexColor("#C8A96E")
    ACCENT_LIGHT  = HexColor("#E8C98E")
    ACCENT_DARK   = HexColor("#9A7840")
    WHITE         = HexColor("#FFFFFF")
    BODY_BG       = HexColor("#FAFAFA")
    TEXT_DARK     = HexColor("#1A1C22")
    TEXT_MED      = HexColor("#4A4E5C")
    TEXT_LIGHT    = HexColor("#8A8FA0")
    DIVIDER       = HexColor("#E8EAF0")
    SIDEBAR_TEXT  = HexColor("#E8EAF2")
    SIDEBAR_MUTED = HexColor("#6A6E82")

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 52, W - 104

        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BODY_BG)
            _draw_rect(c, 0, H - 4, W, 4, fill=theme_cls.ACCENT)
            return y

        # Background
        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BODY_BG)

        # 1. Header (Dark Full Width)
        name = cv_data.get("name", "")
        title = cv_data.get("title", "")
        
        # Estimate header height
        hy = H - 52
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 28, theme_cls.WHITE, MW, 32, dry_run=True)
        hy -= 4
        hy = _draw_wrapped_header(c, title, MX, hy, "Lora-Italic", 14, theme_cls.ACCENT_LIGHT, MW, 18, dry_run=True)
        
        # Contacts line
        cy = _draw_wrapped_contact(c, cv_data, MX, hy - 12 * _fscale, MW, "Poppins", 8, theme_cls.SIDEBAR_TEXT, "  ·  ", dry_run=True, force_family=FF)
        
        HEADER_BOT = cy - 20
        HEADER_H = H - HEADER_BOT
        
        # Draw Header background
        _draw_rect(c, 0, HEADER_BOT, W, HEADER_H, fill=theme_cls.SIDEBAR_BG)
        _draw_rect(c, 0, H - 4, W, 4, fill=theme_cls.ACCENT)

        # Render Header content
        hy = H - 52
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 28, getattr(theme_cls, 'NAME_COLOR', theme_cls.WHITE), MW, 32, force_family=FF)
        hy -= 4
        hy = _draw_wrapped_header(c, title, MX, hy, "Lora-Italic", 14, getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT_LIGHT), MW, 18, force_family=FF)
        _draw_wrapped_contact(c, cv_data, MX, hy - 12 * _fscale, MW, "Poppins", 8, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.SIDEBAR_TEXT), "  ·  ", force_family=FF)

        my = HEADER_BOT - 35

        def section_title(t, y):
            if y < 80: y = new_page()
            _spaced_string(c, MX, y, t.upper(), "Poppins-Bold", 8, getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT), 0.6, force_family=FF)
            c.setStrokeColor(theme_cls.DIVIDER)
            c.setLineWidth(0.6)
            c.line(MX, y - 4 * _fscale, MX + MW, y - 4 * _fscale)
            return y - 20 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = section_title(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Lora-Italic", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 20 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for i, exp in enumerate(cv_data["experiences"]):
                if my < 110 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 8.5)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  ·  " + exp["location"]
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT_DARK))
                c.drawString(MX, my, comp)
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 100 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFillColor(theme_cls.ACCENT)
                    c.setFont(_f("Poppins-Bold", FF), 8)
                    c.drawString(MX + 2, bullet_y + 0.8 * _fscale, "›")
                    my = _draw_multiline(c, bullet, MX + 13, bullet_y, "Poppins", 8.2, theme_cls.TEXT_MED, MW - 16, 12, force_family=FF) - 2 * _fscale
                my -= 8 * _fscale
                if i < len(cv_data["experiences"]) - 1:
                    # Only draw separator if we have room — skip if near bottom
                    if my > 100:
                        c.setStrokeColor(theme_cls.DIVIDER)
                        c.setLineWidth(0.3)
                        c.setDash(2, 3)
                        c.line(MX, my + 3, MX + MW, my + 3)
                        c.setDash()
                    my -= 6

        # Education
        if cv_data.get("education"):
            if my < 140 * _fscale: my = new_page()
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 100 * _fscale: my = new_page()
                c.setFillColor(theme_cls.ACCENT)
                c.rect(MX, my - 1, 5, 5, fill=1, stroke=0)
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX + 10, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 13
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(theme_cls.ACCENT_DARK)
                c.drawString(MX + 10, my, edu.get("school", ""))
                if edu.get("detail"):
                    my -= 12
                    my = _draw_multiline(c, edu["detail"], MX + 10, my, "Poppins", 7.8, theme_cls.TEXT_LIGHT, MW - 12, 11)
                else:
                    my -= 16

        # Skills (AFTER Edu)
        if cv_data.get("skills", {}).get("categories"):
            if my < 100 * _fscale: my = new_page()
            my = section_title(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page(); my = section_title(L["skills"], my)
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX + 10, my, cat.get("name", "").upper())
                my -= 12 * _fscale
                tx = MX + 10
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        my = section_title(L["skills"], my)
                        tx = MX + 10
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX + 10
                        my -= 18 * _fscale
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, my - 10, sw_tag, tag_h, fill=theme_cls.SIDEBAR_BG, radius=3)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(theme_cls.WHITE)
                    c.drawString(tx + 6, my - 6, skill)
                    tx += sw_tag + 5
                my -= 24 * _fscale

        # Languages (Classic Dark style)
        if cv_data.get("languages") and my > 80:
            my = section_title(L["languages"], my)
            for li in cv_data["languages"]:
                if my < 60 * _fscale: break
                txt = f"{li.get('lang', '')} ({li.get('level', '')})"
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX + 10, my, txt)
                my -= 14 * _fscale
            my -= 10 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX + 10, my, MW - 10, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)

        # Footer
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(theme_cls.SIDEBAR_MUTED)
        c.drawCentredString(W / 2, 10, cv_data.get("name", "") + "  ·  CV")
        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


class _CanvaMinimal:
    BG          = HexColor("#FFFFFF")
    ACCENT      = HexColor("#FF6B6B")
    ACCENT2     = HexColor("#4ECDC4")
    TEXT_DARK   = HexColor("#2D3436")
    TEXT_MED    = HexColor("#636E72")
    TEXT_LIGHT  = HexColor("#B2BEC3")
    DIVIDER     = HexColor("#F0F0F0")
    TAG_BG      = HexColor("#FFF5F5")
    TAG_BORDER  = HexColor("#FFD5D5")


    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 48, W - 96

        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            _draw_rect(c, 0, H - 6, W, 6, fill=theme_cls.ACCENT)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        _draw_rect(c, 0, H - 6, W, 6, fill=theme_cls.ACCENT)

        # Header zone
        my = H - 50
        name = cv_data.get("name", "")
        my = _draw_wrapped_header(c, name, MX, my, "Poppins-Bold", 32, getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK), MW, 36, force_family=FF)
        my -= 2
        my = _draw_wrapped_header(c, cv_data.get("title", ""), MX, my, "Lora-Italic", 14, getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT), MW, 18, force_family=FF)
        my -= 6
        my = _draw_wrapped_contact(c, cv_data, MX, my, MW, "Poppins", 8, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.TEXT_LIGHT), force_family=FF)

        c.setStrokeColor(theme_cls.ACCENT)
        c.setLineWidth(2)
        c.line(MX, my, MX + MW, my)
        my -= 30

        def section_title(t, y, color=None):
            if y < 80: y = new_page()
            col = color or getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT)
            _spaced_string(c, MX, y, t.upper(), "Poppins-Bold", 7, col, 1, force_family=FF)
            c.setStrokeColor(col)
            c.setLineWidth(1.5)
            c.line(MX, y - 4 * _fscale, MX + MW, y - 4 * _fscale)
            return y - 18 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = section_title(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins-Italic", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 20 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 110 * _fscale: my = new_page()
                if my < 110 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 8)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 14 * _fscale
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  ·  " + exp["location"]
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, comp)
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFillColor(theme_cls.ACCENT)
                    c.circle(MX + 4 * _fscale, bullet_y + 3 * _fscale, 2.2 * _fscale, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 14 * _fscale, bullet_y, "Poppins", 8.5, theme_cls.TEXT_MED, MW - 16 * _fscale, 13, force_family=FF) - 2 * _fscale
                my -= 12 * _fscale

        # Education
        if cv_data.get("education"):
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 70 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 8.5)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 14 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                my -= 11 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_LIGHT)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 7.8, theme_cls.TEXT_LIGHT, MW, 11, force_family=FF) - 4 * _fscale
                my -= 7 * _fscale

        # Skills (AFTER Exp)
        if cv_data.get("skills", {}).get("categories"):
            my = section_title(L["skills"], my, theme_cls.ACCENT2)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat.get("name", ""))
                my -= 12 * _fscale
                tx = MX
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        my = section_title(L["skills"], my, theme_cls.ACCENT2)
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 18 * _fscale
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, my - 10 * _fscale, sw_tag, tag_h, fill=theme_cls.TAG_BG, stroke=theme_cls.TAG_BORDER, radius=3, stroke_width=0.5)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(theme_cls.ACCENT)
                    c.drawString(tx + 6, my - 10 * _fscale + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, skill)
                    tx += sw_tag + 5
                my -= 24 * _fscale

        # Languages
        if cv_data.get("languages"):
            my = section_title(L["languages"], my, theme_cls.ACCENT2)
            for li in cv_data["languages"]:
                if my < 50 * _fscale: my = new_page()
                txt = f"{li.get('lang', '')} ({li.get('level', '')})"
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, txt)
                my -= 18 * _fscale
            my -= 10 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my, theme_cls.ACCENT2)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8.5, theme_cls.TEXT_MED, force_family=FF)

        # Footer
        _draw_rect(c, 0, 0, W, 22, fill=theme_cls.ACCENT)
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(HexColor("#FFFFFF"))
        c.drawCentredString(W / 2, 8, name + "  ·  CV")

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))



# ══════════════════════════════════════════════════════════════════
#  THÈME 3 — NORDIC CLEAN  (pastel, espace généreux, Scandinavie)
# ══════════════════════════════════════════════════════════════════
class _NordicClean:
    BG          = HexColor("#F7F5F2")
    HEADER_BG   = HexColor("#2C3E50")
    ACCENT      = HexColor("#5B8DB8")
    ACCENT2     = HexColor("#A8C5DA")
    TEXT_DARK   = HexColor("#2C3E50")
    TEXT_MED    = HexColor("#5D6D7E")
    TEXT_LIGHT  = HexColor("#AEB6BF")
    DIVIDER     = HexColor("#E8E4DF")
    WHITE       = HexColor("#FFFFFF")
    TAG_BG      = HexColor("#EBF3F9")


    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 52, W - 104

        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            _draw_rect(c, 0, H - 6, W, 6, fill=theme_cls.ACCENT)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)

        # 1. Header
        name = cv_data.get("name", "")
        title = cv_data.get("title", "")
        
        hy = H - 55 * _fscale
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 30, theme_cls.WHITE, MW, 34, dry_run=True, force_family=FF)
        hy -= 2 * _fscale
        hy = _draw_wrapped_header(c, title, MX, hy, "Poppins-Light", 13, theme_cls.ACCENT2, MW, 16, dry_run=True, force_family=FF)
        
        cy = _draw_wrapped_contact(c, cv_data, MX, hy - 12 * _fscale, MW, "Poppins", 8, theme_cls.ACCENT2, dry_run=True, force_family=FF)
        
        HEADER_BOT = cy - 20 * _fscale
        HEADER_H = H - 12 * _fscale - HEADER_BOT
        
        _draw_rect(c, 0, HEADER_BOT, W, HEADER_H, fill=theme_cls.HEADER_BG)
        _draw_rect(c, 0, HEADER_BOT, 5, HEADER_H, fill=theme_cls.ACCENT)

        hy = H - 55 * _fscale
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 30, getattr(theme_cls, 'NAME_COLOR', theme_cls.WHITE), MW, 34, force_family=FF)
        hy -= 2 * _fscale
        hy = _draw_wrapped_header(c, title, MX, hy, "Poppins-Light", 13, getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT2), MW, 16, force_family=FF)
        _draw_wrapped_contact(c, cv_data, MX, hy - 12 * _fscale, MW, "Poppins", 8, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.ACCENT2), force_family=FF)

        my = HEADER_BOT - 30 * _fscale

        def section_title(t, y):
            if y < 80 * _fscale: y = new_page()
            _draw_rect(c, MX - 14, y - 2 * _fscale, 4, 14 * _fscale, fill=theme_cls.ACCENT)
            _spaced_string(c, MX, y, t.upper(), "Poppins-Bold", 9, getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.TEXT_DARK), 1.2, force_family=FF)
            c.setStrokeColor(theme_cls.DIVIDER)
            c.setLineWidth(0.8)
            c.line(MX, y - 5 * _fscale, MX + MW, y - 5 * _fscale)
            return y - 24 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = section_title(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Lora-Italic", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 20 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page()
                _draw_rect(c, MX - 18, my + 1 * _fscale, 6 * _fscale, 6 * _fscale, fill=theme_cls.ACCENT, radius=3 * _fscale)
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 8)
                c.setFillColor(theme_cls.ACCENT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 14 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.TEXT_MED)
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  —  " + exp["location"]
                c.drawString(MX, my, comp)
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page()
                    bullet_y = my
                    bullet_h = _multiline_height(c, bullet, "Poppins", 8.5, MW - 14, 12, force_family=FF)
                    c.setStrokeColor(theme_cls.ACCENT)
                    c.setLineWidth(0.8)
                    c.line(MX + 2, bullet_y + 6, MX + 2, bullet_y - bullet_h + 10)
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8.5, theme_cls.TEXT_MED, MW - 14, 12, force_family=FF) - 2 * _fscale
                my -= 12 * _fscale

        # Education
        if cv_data.get("education"):
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 70 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 14 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                my -= 11 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_LIGHT)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 8, theme_cls.TEXT_LIGHT, MW, 11, force_family=FF) - 4 * _fscale
                my -= 7 * _fscale

        # Skills (AFTER Exp)
        if cv_data.get("skills", {}).get("categories"):
            my = section_title(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 8.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat.get("name", ""))
                my -= 12 * _fscale
                tx = MX
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        my = section_title(L["skills"], my)
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 18 * _fscale
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, my - 10 * _fscale, sw_tag, tag_h, fill=theme_cls.TAG_BG, stroke=theme_cls.ACCENT2, radius=4, stroke_width=0.5)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(theme_cls.TEXT_DARK)
                    c.drawString(tx + 6, my - 10 * _fscale + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, skill)
                    tx += sw_tag + 5
                my -= 24 * _fscale

        # Languages
        if cv_data.get("languages"):
            my = section_title(L["languages"], my)
            txt = ", ".join([f"{li.get('lang', '')} ({li.get('level', '')})" for li in cv_data["languages"]])
            my = _draw_multiline(c, txt, MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF)
            my -= 20 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)
        
        # Footer
        _draw_rect(c, 0, 0, W, 22, fill=theme_cls.HEADER_BG)
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(theme_cls.ACCENT2)
        c.drawCentredString(W / 2, 8, name + "  ·  CV")

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# ══════════════════════════════════════════════════════════════════
#  THÈME 4 — TECH GRID  (géométrique, startup Silicon Valley)
# ══════════════════════════════════════════════════════════════════
class _TechGrid:
    BG          = HexColor("#0D1117")
    SURFACE     = HexColor("#161B22")
    SURFACE2    = HexColor("#21262D")
    ACCENT      = HexColor("#58A6FF")
    ACCENT2     = HexColor("#3FB950")
    ACCENT3     = HexColor("#F78166")
    TEXT        = HexColor("#E6EDF3")
    TEXT_MED    = HexColor("#8B949E")
    TEXT_LIGHT  = HexColor("#484F58")
    BORDER      = HexColor("#30363D")


    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 44, W - 88

        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            # Grid lines
            c.setStrokeColor(theme_cls.BORDER)
            c.setLineWidth(0.3)
            for gx in range(0, int(W), 30):
                c.line(gx, 0, gx, H)
            for gy in range(0, int(H), 30):
                c.line(0, gy, W, gy)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)

        # Subtle grid
        c.setStrokeColor(theme_cls.BORDER)
        c.setLineWidth(0.3)
        for gx in range(0, int(W), 30):
            c.line(gx, 0, gx, H)
        for gy in range(0, int(H), 30):
            c.line(0, gy, W, gy)

        # 1. PRE-CALCULATE Header Height (Dry Run)
        name = cv_data.get("name", "")
        # Estimate height for background card
        hy = H - 52
        # Internal wrapping calculation (simulated heights)
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 26, theme_cls.TEXT, MW, 30, dry_run=True)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Medium", 11, theme_cls.ACCENT, MW, 14, dry_run=True)
        
        # Contact badges wrap estimate
        cx = MX
        cy_h = hy - 12 * _fscale
        contact_keys = [("email", "✉", theme_cls.ACCENT), ("phone", "✆", theme_cls.ACCENT2),
                         ("location", "⌖", theme_cls.ACCENT3), ("linkedin", "↗", theme_cls.ACCENT),
                         ("github", "git", theme_cls.ACCENT2), ("portfolio", "🕸", theme_cls.ACCENT3)]
        for key, icon, col in contact_keys:
            if not cv_data.get(key): continue
            label, _ = _parse_link(cv_data[key])
            badge_text = icon + " " + label
            badge_w = c.stringWidth(badge_text, _f("Poppins", FF), 7) + 14
            if cx + badge_w > W - MX:
                cx = MX
                cy_h -= 18 * _fscale
            cx += badge_w + 6
            
        HEADER_BOT = cy_h - 18 * _fscale
        header_card_h = H - 12 - HEADER_BOT
        
        # 2. DRAW Backgrounds FIRST
        _draw_rect(c, MX - 12, HEADER_BOT, MW + 24, header_card_h, fill=theme_cls.SURFACE, stroke=theme_cls.BORDER, radius=8, stroke_width=0.8)
        _draw_rect(c, MX - 12, H - 18, 60 * _fscale, 6 * _fscale, fill=theme_cls.ACCENT, radius=3)

        # 3. DRAW Header Content NOW (On top of backgrounds)
        hy = H - 52
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 26, getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT), MW, 30)
        hy -= 2
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Medium", 11, getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT), MW, 14)

        cx = MX
        cy_h = hy - 12 * _fscale
        for key, icon, col in contact_keys:
            if not cv_data.get(key): continue
            label, url = _parse_link(cv_data[key])
            badge_text = icon + " " + label
            badge_w = c.stringWidth(badge_text, _f("Poppins", FF), 7) + 14
            if cx + badge_w > W - MX:
                cx = MX
                cy_h -= 18 * _fscale
            tag_h = 14 * _fscale
            _draw_rect(c, cx, cy_h - 8 * _fscale, badge_w, tag_h, fill=theme_cls.SURFACE2, stroke=theme_cls.BORDER, radius=4, stroke_width=0.5)
            c.setFont(_f("Poppins", FF), 7)
            c.setFillColor(getattr(theme_cls, 'CONTACT_COLOR', col))
            c.drawString(cx + 5, (cy_h - 8 * _fscale) + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, badge_text)
            if url:
                c.linkURL(url, (cx, cy_h - 8 * _fscale, cx + badge_w, cy_h + 6 * _fscale), relative=0)
            cx += badge_w + 6

        # 4. Main content start relative to header bottom
        my = HEADER_BOT - 20 * _fscale

        def section_title(t, y):
            _spaced_string(c, MX, y, t.upper(), "Poppins-Bold", 7, getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT), 0.8, force_family=FF)
            c.setStrokeColor(theme_cls.BORDER)
            c.setLineWidth(0.5)
            c.line(MX, y - 5 * _fscale, MX + MW, y - 5 * _fscale)
            return y - 18 * _fscale

        # Summary with scaled offset
        if cv_data.get("summary"):
            my = section_title(f"// {L['summary']}", my)
            # Accent bar sits just below the section title, above the text
            _draw_rect(c, MX - 12, my + 6 * _fscale, MW + 24, 2, fill=theme_cls.ACCENT)
            my -= 8 * _fscale  # gap below the bar before text starts
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 8.5, theme_cls.TEXT_MED, MW, 13, force_family=FF) - 10 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(f"// {L['experience']}", my)
            for exp in cv_data["experiences"]:
                bullets = exp.get("bullets", [])

                # Pre-calculate content height with scaling
                content_h = (13 + 12) * _fscale
                for bullet in bullets:
                    content_h += _multiline_height(c, bullet, "Poppins", 8, MW - 14, 12, force_family=FF) + 2 * _fscale
                
                PAD_TOP, PAD_BOT = 14 * _fscale, 14 * _fscale
                card_h = content_h + PAD_TOP + PAD_BOT
                
                if my - card_h < 40:
                    my = new_page()
                
                _draw_rect(c, MX - 10, my - content_h - PAD_BOT, MW + 20, card_h,
                           fill=theme_cls.SURFACE, stroke=theme_cls.BORDER, radius=6, stroke_width=0.5)
                
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.ACCENT2)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  /  " + exp["location"]
                c.drawString(MX, my, comp)
                my -= 12 * _fscale
                for bullet in bullets:
                    bullet_y = my
                    c.setFont(_f("Poppins-Bold", FF), 8)
                    # Force visibility for bullets using a high-contrast choice if needed
                    # but usually ACCENT2 is the brand color now.
                    c.setFillColor(getattr(theme_cls, 'ACCENT2', theme_cls.ACCENT2))
                    c.drawString(MX + 2, bullet_y + 0.8 * _fscale, ">")
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8, theme_cls.TEXT_MED, MW - 14, 12, force_family=FF) - 2 * _fscale
                my -= (PAD_BOT + PAD_TOP + 12)

        # Education
        if cv_data.get("education"):
            if my < 120 * _fscale: my = new_page()
            my = section_title(f"// {L['education']}", my)
            for edu in cv_data["education"]:
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(theme_cls.TEXT)
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.ACCENT2)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                my -= 11 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.ACCENT)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 7.5, theme_cls.ACCENT, MW, 11, force_family=FF) - 3 * _fscale
                my -= 5 * _fscale

        # Skills as inline tags
        if cv_data.get("skills", {}).get("categories"):
            my = section_title(f"// {L['skills']}", my)
            tx = MX
            for cat in cv_data["skills"]["categories"]:
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 19 * _fscale
                        if my < 50 * _fscale: 
                            my = new_page()
                            tx = MX
                    tag_h = 15 * _fscale
                    _draw_rect(c, tx, my - 10 * _fscale, sw_tag, tag_h, fill=theme_cls.SURFACE2, stroke=theme_cls.ACCENT, radius=3, stroke_width=0.5)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(theme_cls.ACCENT)
                    c.drawString(tx + 5, my - 10 * _fscale + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, skill)
                    tx += sw_tag + 5 * _fscale
            my -= 20 * _fscale

        # Languages
        if cv_data.get("languages"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(f"// {L['languages']}", my)
            tx = MX
            for li in cv_data["languages"]:
                if my < 45 * _fscale: 
                    my = new_page()
                    tx = MX
                lang_text = f"{li.get('lang', '')} ({li.get('level', '')})"
                sw_tag = c.stringWidth(lang_text, _f("Poppins", FF), 7) + 12
                if tx + sw_tag > MX + MW:
                    tx = MX
                    my -= 19 * _fscale
                    if my < 45 * _fscale: 
                        my = new_page()
                        tx = MX
                tag_h = 16 * _fscale
                _draw_rect(c, tx, my - 10 * _fscale, sw_tag, tag_h, fill=theme_cls.SURFACE2, stroke=theme_cls.ACCENT2, radius=3, stroke_width=0.5)
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(theme_cls.ACCENT2)
                c.drawString(tx + 5, my - 10 * _fscale + (tag_h - 7 * _fscale) / 2 + 0.5 * _fscale, lang_text)
                tx += sw_tag + 5 * _fscale
            my -= 30 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(f"// {L['interests']}", my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)
            my -= 10 * _fscale

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# ══════════════════════════════════════════════════════════════════
#  THÈME 5 — LUXURY SERIF  (cabinet de conseil, élégance classique)
# ══════════════════════════════════════════════════════════════════
class _LuxurySerif:
    BG          = HexColor("#FFFEF9")
    ACCENT      = HexColor("#8B6914")
    ACCENT2     = HexColor("#C4A35A")
    ACCENT3     = HexColor("#E8D5A3")
    TEXT_DARK   = HexColor("#1A1208")
    TEXT_MED    = HexColor("#4A3F2F")
    TEXT_LIGHT  = HexColor("#9A8F7F")
    DIVIDER     = HexColor("#E8E0D0")
    HEADER_BG   = HexColor("#1A1208")


    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 56, W - 112

        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)

        # Elegant top border (double line)
        _draw_rect(c, 0, H - 3, W, 3, fill=theme_cls.ACCENT)
        _draw_rect(c, 0, H - 6, W, 1, fill=theme_cls.ACCENT2)

        # Header — centered, serif
        name = cv_data.get("name", "")
        # Name wrapping 
        hy = H - 48
        hy = _draw_wrapped_header(c, name, MX, hy, "Lora", 30, getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK), MW, 34, centered=True, force_family=FF)
        hy -= 4
        # Title wrapping
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy, "Poppins-Light", 11, getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT), MW, 14, centered=True, force_family=FF)

        # Ornamental divider — RELATIVE to title bottom
        div_y = hy - 14 * _fscale
        c.setStrokeColor(theme_cls.ACCENT2)
        c.setLineWidth(0.8)
        c.line(MX, div_y, W / 2 - 20 * _fscale, div_y)
        c.setFont(_f("Lora"), 10)
        c.setFillColor(theme_cls.ACCENT2)
        c.drawCentredString(W / 2, div_y - 3 * _fscale, "◆")
        c.line(W / 2 + 20 * _fscale, div_y, MX + MW, div_y)

        # Contact centered — RELATIVE to divider
        my = _draw_wrapped_centred_contact(c, cv_data, W/2, div_y - 24 * _fscale, MW, "Poppins", 7.5, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.TEXT_LIGHT), "  ·  ", force_family=FF)

        # Main body starts below contact
        my -= 20 * _fscale

        def section_title(t, y):
            c.setStrokeColor(theme_cls.ACCENT3)
            c.setLineWidth(0.6)
            c.line(MX, y, MX + MW * 0.3, y)
            c.line(MX + MW * 0.7, y, MX + MW, y)
            _spaced_centred(c, W / 2, y - 2 * _fscale, t.upper(), "Poppins-Bold", 7, getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT), 1.2, force_family=FF)
            return y - 18 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = section_title("Profil", my)
            c.setFont(_f("Lora-Italic", FF), 9.5)
            c.setFillColor(theme_cls.TEXT_MED)
            # Centered italic summary
            words = cv_data["summary"].split()
            lines, current = [], []
            for word in words:
                test = " ".join(current + [word])
                if c.stringWidth(test, _f("Lora-Italic", FF), 9.5) <= MW:
                    current.append(word)
                else:
                    lines.append(" ".join(current))
                    current = [word]
            if current: lines.append(" ".join(current))
            for line in lines:
                c.drawCentredString(W / 2, my, line)
                my -= 13 * _fscale
            my -= 10 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title("Expérience", my)
            for exp in cv_data["experiences"]:
                if my < 80 * _fscale: my = new_page()
                # Role in serif
                c.setFont(_f("Lora"), 11)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                comp = exp.get("company", "")
                if exp.get("location"): comp += "  ·  " + exp["location"]
                c.drawString(MX, my, comp)
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 80 * _fscale: my = new_page()
                    c.setFillColor(theme_cls.ACCENT2)
                    c.setFont(_f("Lora"), 9)
                    c.drawString(MX + 2, my + 1.2 * _fscale, "—")
                    my = _draw_multiline(c, bullet, MX + 14, my, "Poppins", 8.2, theme_cls.TEXT_MED, MW - 16, 12, force_family=FF) - 3 * _fscale
                my -= 10 * _fscale
                c.setStrokeColor(theme_cls.DIVIDER)
                c.setLineWidth(0.4)
                c.line(MX + 20, my + 4 * _fscale, MX + MW - 20, my + 4 * _fscale)
                my -= 6 * _fscale

        # Education
        if cv_data.get("education"):
            if my < 120 * _fscale: my = new_page()
            my = section_title("Formation", my)
            for edu in cv_data["education"]:
                c.setFont(_f("Lora"), 10)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                my -= 11
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    my -= 1
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 7.8, theme_cls.TEXT_LIGHT, MW, 11, force_family=FF)
                my -= 10

        # Skills — elegant tag layout (prevents overflow)
        if cv_data.get("skills", {}).get("categories"):
            if my < 100 * _fscale: my = new_page()
            my = section_title("Compétences", my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page(); my = section_title("Compétences", my)
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat.get("name", "").upper())
                my -= 12 * _fscale
                tx = MX
                for skill in cat.get("items", []):
                    if my < 45 * _fscale: 
                        my = new_page()
                        my = section_title("Compétences", my)
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 18 * _fscale
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, my - 10 * _fscale, sw_tag, tag_h, fill=theme_cls.HEADER_BG, radius=3)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(HexColor("#FFFFFF"))
                    c.drawString(tx + 6, my - 6 * _fscale, skill)
                    tx += sw_tag + 5 * _fscale
                my -= 24 * _fscale

        # Languages
        if cv_data.get("languages"):
            my -= 4
            my = section_title("Langues", my)
            lang_str = "  ·  ".join([f"{li.get('lang','')} ({li.get('level','')})" for li in cv_data["languages"]])
            c.setFont(_f("Poppins", FF), 8)
            c.drawCentredString(W / 2, my, lang_str)
            my -= 18

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            # Center the tags for Luxury theme
            tag_str = "  ◆  ".join(cv_data["interests"])
            c.setFont(_f("Lora", FF), 9)
            c.setFillColor(theme_cls.TEXT_MED)
            c.drawCentredString(W / 2, my, tag_str)
            my -= 18

        # Bottom double border
        _draw_rect(c, 0, 3, W, 1, fill=theme_cls.ACCENT2)
        _draw_rect(c, 0, 0, W, 3, fill=theme_cls.ACCENT)
        c.setFont(_f("Poppins", FF), 6.5)
        c.setFillColor(theme_cls.TEXT_LIGHT)
        c.drawCentredString(W / 2, 8, name + "  ◆  CV")

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# ══════════════════════════════════════════════════════════════════
#  FACTORY EXPANSION: 10 NEW INDUSTRY THEMES 
# ══════════════════════════════════════════════════════════════════

class _FinancePro(_NordicClean):
    BG          = HexColor("#FFFFFF")
    HEADER_BG   = HexColor("#1A2530")  # Navy
    ACCENT      = HexColor("#A78B50")  # Gold
    ACCENT2     = HexColor("#627C6C")  # Muted Green
    TEXT_DARK   = HexColor("#111820")
    TEXT_MED    = HexColor("#334155")
    TEXT_LIGHT  = HexColor("#64748B")
    DIVIDER     = HexColor("#E2E8F0")

class _MedicalClean(_CanvaMinimal):
    BG          = HexColor("#F8FAFC")
    ACCENT      = HexColor("#0EA5E9")  # Aqua/Sky
    ACCENT2     = HexColor("#38BDF8")
    TEXT_DARK   = HexColor("#0F172A")
    TEXT_MED    = HexColor("#475569")
    TEXT_LIGHT  = HexColor("#94A3B8")
    TAG_BG      = HexColor("#E0F2FE")
    TAG_BORDER  = HexColor("#BAE6FD")

class _BTPIndustry(_CanvaMinimal):
    BG          = HexColor("#FFFFFF")
    ACCENT      = HexColor("#F97316")  # Safety Orange
    ACCENT2     = HexColor("#475569")  # Steel Gray
    TEXT_DARK   = HexColor("#1E293B")
    TEXT_MED    = HexColor("#334155")
    TEXT_LIGHT  = HexColor("#64748B")
    TAG_BG      = HexColor("#F1F5F9")
    TAG_BORDER  = HexColor("#CBD5E1")
    DIVIDER     = HexColor("#E2E8F0")

class _ApprenticeStarter(_ClassicDark):
    SIDEBAR_BG    = HexColor("#FCD34D") # Vibrant Yellow
    SIDEBAR_BG2   = HexColor("#FBBF24")
    ACCENT        = HexColor("#1E3A8A") # Royal Blue
    ACCENT_LIGHT  = HexColor("#2563EB")
    ACCENT_DARK   = HexColor("#1E40AF")
    WHITE         = HexColor("#111827") # Dark text on sidebar
    BODY_BG       = HexColor("#FFFFFF")
    TEXT_DARK     = HexColor("#111827")
    TEXT_MED      = HexColor("#374151")
    TEXT_LIGHT    = HexColor("#6B7280")
    SIDEBAR_TEXT  = HexColor("#1F2937")
    SIDEBAR_MUTED = HexColor("#4B5563")

class _StartupSaaS(_TechGrid):
    BG          = HexColor("#0F172A")
    SURFACE     = HexColor("#1E293B")
    SURFACE2    = HexColor("#334155")
    ACCENT      = HexColor("#8B5CF6") # Violet
    ACCENT2     = HexColor("#EC4899") # Pink
    ACCENT3     = HexColor("#06B6D4") # Cyan
    TEXT        = HexColor("#F8FAFC")
    TEXT_MED    = HexColor("#94A3B8")
    TEXT_LIGHT  = HexColor("#64748B")
    BORDER      = HexColor("#475569")

class _AcademicLegal(_NordicClean):
    BG          = HexColor("#FFFFFF")
    HEADER_BG   = HexColor("#000000")
    ACCENT      = HexColor("#404040")
    ACCENT2     = HexColor("#737373")
    TEXT_DARK   = HexColor("#171717")
    TEXT_MED    = HexColor("#404040")
    TEXT_LIGHT  = HexColor("#737373")
    DIVIDER     = HexColor("#D4D4D4")
    WHITE       = HexColor("#FFFFFF")
    TAG_BG      = HexColor("#FAFAFA")

class _CreativeAgency(_ClassicDark):
    SIDEBAR_BG    = HexColor("#FFE4E6") # Rose
    SIDEBAR_BG2   = HexColor("#FECDD3")
    ACCENT        = HexColor("#E11D48") # Rose strong
    ACCENT_LIGHT  = HexColor("#F43F5E")
    ACCENT_DARK   = HexColor("#BE123C")
    WHITE         = HexColor("#4C0519") # Dark red text on sidebar
    BODY_BG       = HexColor("#FFFFFF")
    TEXT_DARK     = HexColor("#111827")
    TEXT_MED      = HexColor("#4C0519")
    TEXT_LIGHT    = HexColor("#881337")
    SIDEBAR_TEXT  = HexColor("#881337")
    SIDEBAR_MUTED = HexColor("#9F1239")

class _Logistics(_TechGrid):
    BG          = HexColor("#FFFFFF")
    SURFACE     = HexColor("#F1F5F9")
    SURFACE2    = HexColor("#E2E8F0")
    ACCENT      = HexColor("#1E40AF") # Navy
    ACCENT2     = HexColor("#16A34A") # Green
    ACCENT3     = HexColor("#CA8A04") # Yellow
    TEXT        = HexColor("#0F172A")
    TEXT_MED    = HexColor("#334155")
    TEXT_LIGHT  = HexColor("#64748B")
    BORDER      = HexColor("#CBD5E1")

class _RetailSales(_CanvaMinimal):
    BG          = HexColor("#FFFFFF")
    ACCENT      = HexColor("#DC2626") # Red
    ACCENT2     = HexColor("#111827") # Black
    TEXT_DARK   = HexColor("#111827")
    TEXT_MED    = HexColor("#4B5563")
    TEXT_LIGHT  = HexColor("#6B7280")
    TAG_BG      = HexColor("#FEF2F2")
    TAG_BORDER  = HexColor("#FCA5A5")

class _Executive(_ClassicDark):
    SIDEBAR_BG    = HexColor("#E2E8F0") # Slate
    SIDEBAR_BG2   = HexColor("#CBD5E1")
    ACCENT        = HexColor("#334155") # Deep Slate
    ACCENT_LIGHT  = HexColor("#475569")
    ACCENT_DARK   = HexColor("#1E293B")
    WHITE         = HexColor("#0F172A")
    BODY_BG       = HexColor("#FFFFFF")
    TEXT_DARK     = HexColor("#0F172A")
    TEXT_MED      = HexColor("#334155")
    TEXT_LIGHT    = HexColor("#64748B")
    SIDEBAR_TEXT  = HexColor("#0F172A")
    SIDEBAR_MUTED = HexColor("#475569")

class _SotaLuxury(_CanvaMinimal):
    BG          = HexColor("#FDFDFD")
    ACCENT      = HexColor("#C5B358") # Champagne Gold
    ACCENT2     = HexColor("#D4C3A3")
    TEXT_DARK   = HexColor("#1A1A1A")
    TEXT_MED    = HexColor("#404040")
    TEXT_LIGHT  = HexColor("#808080")
    TAG_BG      = HexColor("#FBF9F0")
    TAG_BORDER  = HexColor("#EAE7D2")
    DIVIDER     = HexColor("#F2F2F2")


class _SoberClassic(_AcademicLegal):
    BG            = HexColor("#FFFFFF")
    ACCENT        = HexColor("#000000")
    ACCENT2       = HexColor("#000000")
    TEXT_DARK     = HexColor("#000000")
    TEXT_MED      = HexColor("#1F2937")
    TEXT_LIGHT    = HexColor("#4B5563")
    SIDEBAR_BG    = HexColor("#FFFFFF")
    SIDEBAR_BG2   = HexColor("#FFFFFF")
    SIDEBAR_MUTED = HexColor("#4B5563")
    ACCENT_LIGHT  = HexColor("#1F2937")
    WHITE         = HexColor("#000000")
    SOBER         = True
    FONT_OVERRIDE = "Times-Roman"
    TAG_BG        = HexColor("#FAFAFA")
    TAG_BORDER    = HexColor("#D4D4D4")
    HEADER_BG     = HexColor("#FFFFFF")


# ══════════════════════════════════════════════════════════════════
#  DISPATCHER — point d'entrée unique
# ══════════════════════════════════════════════════════════════════
THEMES = {
    "Classic Dark":   _ClassicDark,
    "Sober Classic":  _SoberClassic,
    "Canva Minimal":  _CanvaMinimal,
    "Nordic Clean":   _NordicClean,
    "Tech Grid":      _TechGrid,
    "Luxury Serif":   _LuxurySerif,
    "Finance Pro":    _FinancePro,
    "Medical Clean":  _MedicalClean,
    "BTP Industry":   _BTPIndustry,
    "Apprentice":     _ApprenticeStarter,
    "Startup SaaS":   _StartupSaaS,
    "Academic Legal": _AcademicLegal,
    "Creative Ag.":   _CreativeAgency,
    "Logistics":      _Logistics,
    "Retail Sales":   _RetailSales,
    "Executive C":    _Executive,
    "SOTA Luxury":    _SotaLuxury
}


def generate_cv_pdf(cv_data: dict, theme: str = "Classic Dark") -> bytes:
    theme_cls = THEMES.get(theme, _ClassicDark)
    log.info(f"generate_cv_pdf | theme={theme} | name={cv_data.get('name')}")
    result = theme_cls.generate(cv_data)
    log.info(f"generate_cv_pdf | done | size={len(result)} bytes")
    return result


def generate_cover_letter_pdf(letter_data: dict, theme: str = "Classic Dark") -> bytes:
    log.info(f"generate_cover_letter_pdf | name={letter_data.get('name')} company={letter_data.get('company_name')} | theme={theme}")
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    W, H = A4
    MX, MXR = 52, W - 52
    MW = MXR - MX

    theme_cls = THEMES.get(theme, _ClassicDark)
    C, _fscale = _apply_custom_style(theme_cls, letter_data)
    _prepare_canvas(c, _fscale)
    
    FF = getattr(C, 'FONT_OVERRIDE', None)
    is_sober = getattr(C, 'SOBER', False)
    name = letter_data.get("name", "")
    title = letter_data.get("title", "")
    c.setTitle(name + " — Lettre de motivation")
    add_ats_metadata(c, letter_data)

    if is_sober:
        # Sober traditional layout: clean white background, no header rectangle or accent lines
        _draw_rect(c, 0, 0, W, H, fill=HexColor("#FFFFFF"))
        
        cy = H - 55
        c.setFont(_f("Poppins-Bold", FF), 14)
        c.setFillColor(HexColor("#000000"))
        c.drawString(MX, cy, letter_data.get("name", ""))
        cy -= 16
        
        if letter_data.get("title"):
            c.setFont(_f("Poppins", FF), 10)
            c.setFillColor(HexColor("#333333"))
            c.drawString(MX, cy, letter_data.get("title", ""))
            cy -= 15
        
        contact_items = []
        for key in ["phone", "email", "location", "linkedin", "github", "portfolio"]:
            if letter_data.get(key):
                contact_items.append(_parse_link(letter_data[key]))
        
        c.setFont(_f("Poppins", FF), 8.5)
        c.setFillColor(HexColor("#444444"))
        contact_str = "  ·  ".join([it[0] for it in contact_items])
        cy = _draw_multiline(c, contact_str, MX, cy, "Poppins", 8.5, HexColor("#444444"), MW, 12, force_family=FF)
        
        HEADER_BOT = cy - 15
        c.setStrokeColor(HexColor("#E2E8F0"))
        c.setLineWidth(0.5)
        c.line(MX, HEADER_BOT, MXR, HEADER_BOT)
    else:
        # Original colored/stylish layout
        _draw_rect(c, 0, 0, W, H, fill=HexColor("#FAFAFA"))
        _draw_rect(c, 0, 0, 5, H, fill=C.ACCENT)
        
        # 1. Measure Header
        name  = letter_data.get("name", "")
        title = letter_data.get("title", "")
        hy = H - 46
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 22, C.WHITE, MW/2, 26, dry_run=True)
        hy -= 4
        hy = _draw_wrapped_header(c, title, MX, hy, "Lora-Italic", 11, C.ACCENT_LIGHT, MW/2, 14, dry_run=True)
        
        contact_items = []
        for key in ["email", "phone", "location", "linkedin", "github", "portfolio"]:
            if letter_data.get(key):
                contact_items.append(_parse_link(letter_data[key]))
                
        sep = "  ·  "
        current_x = MXR
        cy_h = H - 50
        for i, (label, url) in enumerate(reversed(contact_items)):
            sw_label = c.stringWidth(label, _f("Poppins", FF), 7.5)
            sw_sep = c.stringWidth(sep, _f("Poppins", FF), 7.5) if i > 0 else 0
            if current_x - sw_label - sw_sep < MX + MW/2 + 20:
                 current_x = MXR
                 cy_h -= 14 * _fscale
            current_x -= (sw_label + sw_sep)
        
        HEADER_BOT = min(hy, cy_h) - 20
        
        # 2. Draw Header Backgrounds
        _draw_rect(c, 0, HEADER_BOT, W, H - HEADER_BOT, fill=C.SIDEBAR_BG2)
        _draw_rect(c, 0, H - 4, W, 4, fill=C.ACCENT)
        _draw_rect(c, 0, HEADER_BOT, 5, H - HEADER_BOT, fill=C.ACCENT)

        # 3. Draw Header Content
        hy = H - 46
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 22, C.WHITE, MW/2, 26, force_family=FF)
        hy -= 4
        hy = _draw_wrapped_header(c, title, MX, hy, "Lora-Italic", 11, C.ACCENT_LIGHT, MW/2, 14, force_family=FF)

        current_x = MXR
        cy_h = H - 50
        for i, (label, url) in enumerate(reversed(contact_items)):
            sw_label = c.stringWidth(label, _f("Poppins", FF), 7.5)
            sw_sep = c.stringWidth(sep, _f("Poppins", FF), 7.5) if i > 0 else 0
            if current_x - sw_label - sw_sep < MX + MW/2 + 20:
                 current_x = MXR
                 cy_h -= 14 * _fscale
            
            if i > 0:
                current_x -= sw_sep
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(C.SIDEBAR_MUTED)
                c.drawString(current_x, cy_h, sep)
                
            current_x -= sw_label
            if url:
                _draw_link(c, current_x, cy_h, label, url, "Poppins", 7.5, C.SIDEBAR_MUTED, force_family=FF)
            else:
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(C.SIDEBAR_MUTED)
                c.drawString(current_x, cy_h, label)

        c.setStrokeColor(C.ACCENT)
        c.setLineWidth(0.6)
        c.line(MX, HEADER_BOT + 12, MXR, HEADER_BOT + 12)

    # 4. Content
    cy = HEADER_BOT - 35
    date_str = letter_data.get("date", "")
    if date_str:
        c.setFont(_f("Poppins", FF), 9)
        c.setFillColor(C.TEXT_MED)
        c.drawRightString(MXR, cy, date_str)
        cy -= 25

    company      = letter_data.get("company_name", "")
    company_addr = letter_data.get("company_address", "")
    hiring       = letter_data.get("hiring_manager", "")

    c.setFont(_f("Poppins-Bold", FF), 9.5)
    c.setFillColor(C.TEXT_DARK)
    c.drawString(MX, cy, company)
    cy -= 14
    if hiring:
        c.setFont(_f("Poppins", FF), 9)
        c.setFillColor(C.TEXT_MED)
        c.drawString(MX, cy, "À l'attention de " + hiring)
        cy -= 12
    if company_addr:
        c.setFont(_f("Poppins", FF), 9)
        c.setFillColor(C.TEXT_LIGHT)
        c.drawString(MX, cy, company_addr)
        cy -= 12
    cy -= 20

    subject = letter_data.get("subject", "Candidature")
    c.setFont(_f("Poppins-Bold", FF), 10)
    c.setFillColor(C.TEXT_DARK)
    subj_prefix = "Objet : "
    c.drawString(MX, cy, subj_prefix + subject)
    c.setStrokeColor(C.ACCENT)
    c.setLineWidth(1)
    c.line(MX, cy - 4, MX + c.stringWidth(subj_prefix + subject, _f("Poppins-Bold", FF), 10), cy - 4)
    cy -= 30

    salutation = "Madame, Monsieur,"
    if hiring:
        last = hiring.split()[-1] if " " in hiring.strip() else hiring
        salutation = f"Madame, Monsieur {last},"
    c.setFont(_f("Poppins", FF), 10)
    c.setFillColor(C.TEXT_DARK)
    c.drawString(MX, cy, salutation)
    cy -= 25

    for i, para in enumerate(letter_data.get("body_paragraphs", [])):
        if cy < 100:
            c.showPage()
            if is_sober:
                _draw_rect(c, 0, 0, W, H, fill=HexColor("#FFFFFF"))
            else:
                _draw_rect(c, 0, 0, W, H, fill=HexColor("#FAFAFA"))
                _draw_rect(c, 0, 0, 5, H, fill=C.ACCENT)
            cy = H - 50
        
        cy = _draw_multiline(c, para, MX, cy, "Poppins", 10, C.TEXT_DARK, MW, 15, force_family=FF)
        cy -= 12

    if cy < 150:
        c.showPage()
        if is_sober:
            _draw_rect(c, 0, 0, W, H, fill=HexColor("#FFFFFF"))
        else:
            _draw_rect(c, 0, 0, W, H, fill=HexColor("#FAFAFA"))
            _draw_rect(c, 0, 0, 5, H, fill=C.ACCENT)
        cy = H - 50

    cy -= 10
    cy = _draw_multiline(c, "Dans l'attente de vous rencontrer, je vous adresse mes cordiales salutations.",
                    MX, cy, "Poppins", 10, C.TEXT_DARK, MW, 15, force_family=FF)
    cy -= 40

    c.setFont(_f("Poppins-Bold", FF), 11)
    c.setFillColor(C.TEXT_DARK)
    c.drawString(MX, cy, name)
    cy -= 14
    c.setFont(_f("Lora-Italic", FF), 9.5)
    c.setFillColor(C.ACCENT)
    c.drawString(MX, cy, title)



    c.save()
    return buf.getvalue()



# ══════════════════════════════════════════════════════════════════
#  PHOTO HELPER — Draw profile photos in PDFs
# ══════════════════════════════════════════════════════════════════

def _draw_photo(c, photo_base64, x, y, size, shape='circle', border_color=None, border_width=2):
    """Draw profile photo from base64 string."""
    if not photo_base64: return
    try:
        import base64
        from reportlab.lib.utils import ImageReader
        img_data = base64.b64decode(photo_base64)
        img_reader = ImageReader(io.BytesIO(img_data))
        if border_color is None: border_color = HexColor("#E0E0E0")
        if shape == 'circle':
            c.saveState()
            p = c.beginPath()
            p.circle(x + size/2, y + size/2, size/2)
            c.clipPath(p, stroke=0, fill=0)
            c.drawImage(img_reader, x, y, width=size, height=size, preserveAspectRatio=True, mask='auto')
            c.restoreState()
            c.setStrokeColor(border_color)
            c.setLineWidth(border_width)
            c.circle(x + size/2, y + size/2, size/2, stroke=1, fill=0)
        else:
            c.drawImage(img_reader, x, y, width=size, height=size, preserveAspectRatio=True, mask='auto')
            c.setStrokeColor(border_color)
            c.setLineWidth(border_width)
            c.rect(x, y, size, size, stroke=1, fill=0)
    except Exception as e:
        log.error(f"[_draw_photo] Error: {e}")


# ══════════════════════════════════════════════════════════════════
#  10 NEW PHOTO-ENABLED THEMES
# ══════════════════════════════════════════════════════════════════

class _ExecutivePortrait:
    """Photo ronde en header, layout premium corporate"""
    BG = HexColor("#FFFFFF")
    HEADER_BG = HexColor("#1A2332")
    ACCENT = HexColor("#B8956A")
    ACCENT2 = HexColor("#D4C5A8")
    TEXT_DARK = HexColor("#1A1A1A")
    TEXT_MED = HexColor("#4A4A4A")
    TEXT_LIGHT = HexColor("#8A8A8A")
    DIVIDER = HexColor("#E8E8E8")
    PHOTO_BORDER = HexColor("#B8956A")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 50, W - 100
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)
        
        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            _draw_rect(c, 0, H - HEADER_H, W, HEADER_H, fill=theme_cls.HEADER_BG)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        
        # Header with photo
        HEADER_H = 140 * _fscale
        _draw_rect(c, 0, H - HEADER_H, W, HEADER_H, fill=theme_cls.HEADER_BG)
        
        # Photo (round, top-left)
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 90 * _fscale
        if photo:
            _draw_photo(c, photo, MX, H - HEADER_H + 25 * _fscale, PHOTO_SIZE, 'circle', 
                       border_color=getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT), border_width=3 * _fscale)
        
        # Name & Title (right of photo)
        name_x = MX + PHOTO_SIZE + 20 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 24)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', HexColor("#FFFFFF")))
        c.drawString(name_x, H - 50 * _fscale, cv_data.get("name", ""))
        
        c.setFont(_f("Poppins-Light", FF), 11)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT2))
        c.drawString(name_x, H - 70 * _fscale, cv_data.get("title", ""))
        
        # Contact (below name)
        _draw_wrapped_contact(c, cv_data, name_x, H - 95 * _fscale, W - name_x - 50, "Poppins", 7, getattr(theme_cls, 'CONTACT_COLOR', HexColor("#CCCCCC")), force_family=FF)
        
        # Content
        my = H - HEADER_H - 30 * _fscale
        
        def section_title(t, y):
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.setLineWidth(2)
            c.line(MX, y - 4 * _fscale, MX + 60 * _fscale, y - 4 * _fscale)
            return y - 20 * _fscale
        
        if cv_data.get("summary"):
            my = section_title(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Lora-Italic", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF) - 18 * _fscale
        
        # Experience (standard layout)
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 120 * _fscale: my = new_page(); my = section_title(L["experience"], my)
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page(); my = section_title(L["experience"], my)
                    bullet_y = my
                    c.setFillColor(theme_cls.ACCENT)
                    c.circle(MX + 3, bullet_y + 2.5 * _fscale, 2 * _fscale, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8, theme_cls.TEXT_MED, MW - 14, 11, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
        
        # Education
        if cv_data.get("education"):
            if my < 120 * _fscale: my = new_page()
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 80 * _fscale: my = new_page(); my = section_title(L["education"], my)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 10 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_LIGHT)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 7.5, theme_cls.TEXT_LIGHT, MW, 11, force_family=FF) - 3 * _fscale
                my -= 12 * _fscale

        # Skills (AFTER Exp/Edu)
        if cv_data.get("skills", {}).get("categories"):
            my = section_title(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat.get("name", "").upper())
                my -= 12 * _fscale
                tx = MX
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        my = section_title(L["skills"], my)
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 18 * _fscale
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, my - 10 * _fscale, sw_tag, tag_h, fill=theme_cls.HEADER_BG, radius=3)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(HexColor("#FFFFFF"))
                    c.drawString(tx + 6, my - 6 * _fscale, skill)
                    tx += sw_tag + 5 * _fscale
                my -= 24 * _fscale

        # Languages
        if cv_data.get("languages") and my > 80 * _fscale:
            my = section_title(L["languages"], my)
            for li in cv_data["languages"]:
                if my < 60 * _fscale: break
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, li.get("lang", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawString(MX + 80, my, li.get("level", ""))
                my -= 12 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)
        
        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


class _ModernProfile:
    BG = HexColor("#F8F9FA")
    SIDEBAR_BG = HexColor("#2C3E50")
    ACCENT = HexColor("#3498DB")
    ACCENT2 = HexColor("#E74C3C")
    TEXT_DARK = HexColor("#2C3E50")
    TEXT_MED = HexColor("#7F8C8D")
    TEXT_LIGHT = HexColor("#BDC3C7")
    PHOTO_BORDER = HexColor("#3498DB")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 52, W - 104
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)
        
        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            _draw_rect(c, 0, H - 4, W, 4, fill=theme_cls.ACCENT)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        
        # 1. Unified Header (Dark)
        name = cv_data.get("name", "")
        title = cv_data.get("title", "")
        photo = cv_data.get("profile_photo")
        
        # Initial coordinate setup
        hx = MX
        hw = MW
        hy = H - 50
        PHOTO_SIZE = 100 * _fscale
        
        if photo:
            hx = MX + PHOTO_SIZE + 25 * _fscale
            hw = MW - PHOTO_SIZE - 25 * _fscale
            
        # 1. Dry run to calculate Header Height
        dhy = _draw_wrapped_header(c, name, hx, hy, "Poppins-Bold", 30, HexColor("#FFFFFF"), hw, 34, dry_run=True)
        dhy -= 4
        dhy = _draw_wrapped_header(c, title, hx, dhy, "Poppins-Light", 14, theme_cls.ACCENT, hw, 18, dry_run=True)
        dcy = _draw_wrapped_contact(c, cv_data, hx, dhy - 12 * _fscale, hw, "Poppins", 8, theme_cls.TEXT_LIGHT, "  |  ", dry_run=True)
        
        HEADER_BOT = min(dhy, dcy) - 30 * _fscale
        if photo: HEADER_BOT = min(HEADER_BOT, H - PHOTO_SIZE - 70 * _fscale)
        HEADER_H = H - HEADER_BOT

        # 2. Draw Background Layer
        _draw_rect(c, 0, HEADER_BOT, W, HEADER_H, fill=theme_cls.SIDEBAR_BG)
        _draw_rect(c, 0, H - 4, W, 4, fill=theme_cls.ACCENT)

        # 3. Draw Content Layer on Top
        hy = H - 50
        hy = _draw_wrapped_header(c, name, hx, hy, "Poppins-Bold", 30, getattr(theme_cls, 'NAME_COLOR', HexColor("#FFFFFF")), hw, 34, force_family=FF)
        hy -= 4
        hy = _draw_wrapped_header(c, title, hx, hy, "Poppins-Light", 14, getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT), hw, 18, force_family=FF)
        _draw_wrapped_contact(c, cv_data, hx, hy - 12 * _fscale, hw, "Poppins", 8, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.TEXT_LIGHT), "  |  ", force_family=FF)

        if photo:
            _draw_photo(c, photo, MX, H - PHOTO_SIZE - 40 * _fscale, PHOTO_SIZE, 'square', 
                       border_color=getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT), border_width=3 * _fscale)

        my = HEADER_BOT - 35

        def section_title(t, y):
            if y < 80 * _fscale: y = new_page()
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(theme_cls.ACCENT)
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(theme_cls.ACCENT)
            c.setLineWidth(1.5 * _fscale)
            c.line(MX, y - 5 * _fscale, MX + 40 * _fscale, y - 5 * _fscale)
            return y - 24 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 25 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 110 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 8)
                c.setFillColor(theme_cls.ACCENT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 14 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.ACCENT2)
                exp_line = exp.get("company", "")
                if exp.get("location"): exp_line += "  •  " + exp["location"]
                c.drawString(MX, my, exp_line)
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFont(_f("Poppins-Bold", FF), 10)
                    c.setFillColor(theme_cls.ACCENT)
                    c.drawString(MX + 2, bullet_y + 0.5 * _fscale, "•")
                    my = _draw_multiline(c, bullet, MX + 14, bullet_y, "Poppins", 9, theme_cls.TEXT_MED, MW - 14, 13, force_family=FF) - 2 * _fscale
                my -= 14 * _fscale

        # Education
        if cv_data.get("education"):
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 70 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 14 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                my -= 11 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 8, theme_cls.TEXT_MED, MW, 11, force_family=FF) - 3 * _fscale
                my -= 7 * _fscale

        # Skills (Bottom)
        if cv_data.get("skills", {}).get("categories"):
            my = section_title(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 8.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat.get("name", "").upper())
                my -= 12 * _fscale
                tx = MX
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        my = section_title(L["skills"], my)
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7.5) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 18 * _fscale
                    _draw_rect(c, tx, my - 10 * _fscale, sw_tag, 14 * _fscale, fill=theme_cls.SIDEBAR_BG, radius=3)
                    c.setFont(_f("Poppins", FF), 7.5)
                    c.setFillColor(HexColor("#FFFFFF"))
                    c.drawString(tx + 6, my - 6 * _fscale, skill)
                    tx += sw_tag + 5 * _fscale
                my -= 24 * _fscale

        # Languages
        if cv_data.get("languages"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["languages"], my)
            for li in cv_data["languages"]:
                if my < 50 * _fscale: my = new_page(); my = section_title(L["languages"], my)
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, li.get("lang", ""))
                c.drawRightString(MX + MW, my, li.get("level", ""))
                my -= 12 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8.5, theme_cls.TEXT_MED, force_family=FF)

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


class _CreativeVision:
    """Photo artistique avec overlay coloré, créatif"""
    BG = HexColor("#FAFAFA")
    ACCENT = HexColor("#FF6B9D")
    ACCENT2 = HexColor("#C44569")
    ACCENT3 = HexColor("#FFA07A")
    TEXT_DARK = HexColor("#2C2C2C")
    TEXT_MED = HexColor("#666666")
    TEXT_LIGHT = HexColor("#999999")
    PHOTO_BORDER = HexColor("#FFA07A")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 45, W - 90
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)
        
        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        
        # Diagonal accent bar
        c.setFillColor(theme_cls.ACCENT)
        p = c.beginPath()
        p.moveTo(0, H)
        p.lineTo(W, H)
        p.lineTo(W, H - 120)
        p.lineTo(0, H - 80)
        p.close()
        c.drawPath(p, fill=1, stroke=0)
        
        # Photo with creative positioning (top-left, overlapping accent)
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 100
        if photo:
            _draw_photo(c, photo, MX, H - PHOTO_SIZE - 20, PHOTO_SIZE, 'circle',
                       border_color=getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT3), border_width=3)
            # Add colored ring around photo
            c.setStrokeColor(getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT3))
            c.setLineWidth(3)
            c.circle(MX + PHOTO_SIZE/2, H - PHOTO_SIZE/2 - 20, PHOTO_SIZE/2 + 5, stroke=1, fill=0)
        
        # Name & Title (right of photo)
        name_x = MX + PHOTO_SIZE + 25
        name_y = H - 45 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 26)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', HexColor("#FFFFFF")))
        c.drawString(name_x, name_y, cv_data.get("name", ""))
        
        title_y = name_y - 20 * _fscale
        c.setFont(_f("Poppins-Light", FF), 12)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', HexColor("#FFFFFF")))
        c.drawString(name_x, title_y, cv_data.get("title", ""))
        
        # Contact info follows title
        contact_y = title_y - 20 * _fscale
        contact_end_y = _draw_wrapped_contact(c, cv_data, name_x, contact_y, W - name_x - 45, "Poppins", 7, getattr(theme_cls, 'CONTACT_COLOR', HexColor("#FFFFFF")), force_family=FF)
        
        # Content starts below the contact info with safety margin
        my = min(contact_end_y - 30 * _fscale, H - 150 * _fscale)
        
        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            # Simple accent strip for brand continuity on new pages
            _draw_rect(c, 0, H - 10, W, 10, fill=theme_cls.ACCENT)
            return y

        def creative_section(title, y):
            if y < 100 * _fscale: y = new_page()
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
            c.drawString(MX, y, title)
            c.setStrokeColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.setLineWidth(3)
            c.line(MX, y - 5, MX + 80, y - 5)
            return y - 20 * _fscale
        
        if cv_data.get("summary"):
            my = creative_section("À PROPOS", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF) - 18 * _fscale
        
        # Experience 
        if cv_data.get("experiences"):
            my = creative_section("EXPÉRIENCE", my)
            for exp in cv_data["experiences"]:
                if my < 80 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                my -= 11 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, exp.get("company", "") + " | " + exp.get("period", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 40 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFillColor(theme_cls.ACCENT3)
                    c.rect(MX, bullet_y + 1.5 * _fscale, 4, 4, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 10, bullet_y, "Poppins", 8, theme_cls.TEXT_MED, MW - 12, 11, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
        
        # Education
        if cv_data.get("education"):
            my = creative_section("ÉDUCATION", my)
            for edu in cv_data["education"]:
                if my < 60 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, edu.get("school", "") + " | " + edu.get("year", ""))
                my -= 10 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 7.5, theme_cls.TEXT_MED, MW, 11, force_family=FF) - 3 * _fscale
                my -= 8 * _fscale

        # Skills Section
        if cv_data.get("skills", {}).get("categories"):
            my = creative_section(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat.get("name", "").upper())
                my -= 12 * _fscale
                tx = MX
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        my = creative_section(L["skills"], my)
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 18 * _fscale
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, my - 10, sw_tag, tag_h, fill=theme_cls.ACCENT, radius=4)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(HexColor("#FFFFFF"))
                    c.drawString(tx + 6, my - 6, skill)
                    tx += sw_tag + 5
                my -= 24 * _fscale
        
        # Languages
        if cv_data.get("languages"):
            my = creative_section("LANGUES", my)
            for li in cv_data["languages"]:
                if my < 40 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, li.get("lang", "") + " — " + li.get("level", ""))
                my -= 12 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = creative_section(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)
        
        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


class _FinanceExecutive(_ExecutivePortrait):
    """Photo formelle, couleurs sobres finance"""
    HEADER_BG = HexColor("#0A1929")
    ACCENT = HexColor("#A78B50")
    ACCENT2 = HexColor("#C4B998")
    PHOTO_BORDER = HexColor("#A78B50")


class _TechLeader(_ModernProfile):
    """Photo moderne, accents tech"""
    SIDEBAR_BG = HexColor("#0D1117")
    ACCENT = HexColor("#58A6FF")
    ACCENT2 = HexColor("#3FB950")
    PHOTO_BORDER = HexColor("#58A6FF")


class _StartupFounder(_CreativeVision):
    """Photo dynamique, layout innovant"""
    ACCENT = HexColor("#8B5CF6")
    ACCENT2 = HexColor("#EC4899")
    ACCENT3 = HexColor("#06B6D4")
    PHOTO_BORDER = HexColor("#06B6D4")


class _ConsultantPremium:
    BG = HexColor("#FDFCFA")
    ACCENT = HexColor("#2C5F7C")
    ACCENT2 = HexColor("#8B7355")
    TEXT_DARK = HexColor("#1A1A1A")
    TEXT_MED = HexColor("#4A4A4A")
    TEXT_LIGHT = HexColor("#8A8A8A")
    DIVIDER = HexColor("#E8E4DF")
    PHOTO_BORDER = HexColor("#8B7355")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 60, W - 120
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)
        
        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            _draw_rect(c, 0, H - 2, W, 2, fill=theme_cls.ACCENT)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        _draw_rect(c, 0, H - 2, W, 2, fill=theme_cls.ACCENT)
        
        # 1. Centered Header
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 85 * _fscale
        my = H - 35
        
        if photo:
            _draw_photo(c, photo, (W - PHOTO_SIZE) / 2, my - PHOTO_SIZE, PHOTO_SIZE, 'circle',
                       border_color=getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT2), border_width=3)
            my -= (PHOTO_SIZE + 20)
        
        name = cv_data.get("name", "")
        my = _draw_wrapped_header(c, name, 50, my, "Lora", 24, getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK), W - 100, 28, centered=True)
        my -= 4
        my = _draw_wrapped_header(c, cv_data.get("title", ""), 50, my, "Poppins-Light", 10, getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT), W - 100, 14, centered=True, force_family=FF)
        my -= 15
        
        my = _draw_wrapped_centred_contact(c, cv_data, W/2, my, W - 100, "Poppins", 8, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.TEXT_LIGHT), "  |  ", force_family=FF)
        my -= 25
        
        c.setStrokeColor(theme_cls.DIVIDER)
        c.setLineWidth(0.5)
        c.line(MX, my, MX + MW, my)
        my -= 20 * _fscale

        def section_title(t, y):
            if y < 80 * _fscale: y = new_page()
            c.setFont(_f("Poppins-Bold", FF), 8)
            c.setFillColor(theme_cls.ACCENT)
            c.drawCentredString(W/2, y, t.upper())
            c.setStrokeColor(theme_cls.ACCENT2)
            c.setLineWidth(1.2 * _fscale)
            c.line(W/2 - 20 * _fscale, y - 5 * _fscale, W/2 + 20 * _fscale, y - 5 * _fscale)
            return y - 22 * _fscale

        # Summary
        if cv_data.get("summary"):
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9.5, theme_cls.TEXT_MED, MW, 14, align='center', force_family=FF) - 30 * _fscale

        # Experience
        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 110 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.ACCENT2)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, exp.get("company", ""))
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFillColor(theme_cls.ACCENT2)
                    
                    # Draw a crisp vector diamond to avoid TTF font unicode encoding issues
                    dp = c.beginPath()
                    cx = MX + 4.5 * _fscale
                    cy = bullet_y + 3.5 * _fscale
                    r = 2 * _fscale
                    dp.moveTo(cx, cy + r)
                    dp.lineTo(cx + r, cy)
                    dp.lineTo(cx, cy - r)
                    dp.lineTo(cx - r, cy)
                    dp.close()
                    c.drawPath(dp, fill=1, stroke=0)
                    
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8.5, theme_cls.TEXT_MED, MW - 14, 12, force_family=FF) - 2 * _fscale
                my -= 14 * _fscale

        # Education
        if cv_data.get("education"):
            if my < 120 * _fscale: my = new_page()
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 70 * _fscale: my = new_page(); my = section_title(L["education"], my)
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, edu.get("degree", ""))
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, edu.get("school", ""))
                my -= 10 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 8, theme_cls.TEXT_MED, MW, 11, force_family=FF) - 3 * _fscale
                my -= 8 * _fscale

        # Skills (Expertise)
        if cv_data.get("skills", {}).get("categories"):
            if my < 100 * _fscale: my = new_page()
            my = section_title(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 8.5)
                c.setFillColor(theme_cls.ACCENT2)
                c.drawString(MX, my, cat.get("name", "").upper())
                my -= 12 * _fscale
                txt = ", ".join(cat.get("items", []))
                my = _draw_multiline(c, txt, MX, my, "Poppins", 8.5, theme_cls.TEXT_MED, MW, 11, force_family=FF) - 15 * _fscale

        # Languages
        if cv_data.get("languages"):
            my = section_title(L["languages"], my)
            txt = ", ".join([f"{li.get('lang', '')} ({li.get('level', '')})" for li in cv_data["languages"]])
            my = _draw_multiline(c, txt, MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 12, align='center', force_family=FF)
            my -= 20 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)
        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


class _CorporateElite:
    """Layout asymétrique avec photo dans header coloré"""
    BG = HexColor("#FFFFFF")
    ACCENT = HexColor("#1E3A5F")
    ACCENT2 = HexColor("#8B7355")
    TEXT_DARK = HexColor("#1A1A1A")
    TEXT_MED = HexColor("#555555")
    TEXT_LIGHT = HexColor("#999999")
    DIVIDER = HexColor("#DDDDDD")
    PHOTO_BORDER = HexColor("#8B7355")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 50, W - 100
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)
        
        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        
        # Header avec fond personnalisé
        HEADER_H = 110 * _fscale
        _draw_rect(c, 0, H - HEADER_H, W, HEADER_H, fill=getattr(theme_cls, 'HEADER_BG', HexColor("#F8F9FA")))
        
        # Photo ronde DANS le header (gauche)
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 75 * _fscale
        if photo:
            _draw_photo(c, photo, MX, H - HEADER_H + 18 * _fscale, PHOTO_SIZE, 'circle',
                       border_color=getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT2), border_width=3 * _fscale)
        
        # Name & Title à droite de la photo
        name_x = MX + PHOTO_SIZE + 20 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 20)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        c.drawString(name_x, H - 40 * _fscale, cv_data.get("name", ""))
        
        c.setFont(_f("Poppins-Light", FF), 10)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT))
        c.drawString(name_x, H - 58 * _fscale, cv_data.get("title", ""))
        
        _draw_wrapped_contact(c, cv_data, name_x, H - 80 * _fscale, W - name_x - 50, "Poppins", 7, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.TEXT_LIGHT), " | ")
        
        my = H - HEADER_H - 25 * _fscale
        
        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            return y

        def section_title(t, y):
            if y < 80 * _fscale: y = new_page()
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
            c.setLineWidth(2)
            c.line(MX, y - 4 * _fscale, MX + 60 * _fscale, y - 4 * _fscale)
            return y - 18 * _fscale
        
        if cv_data.get("summary"):
            my = section_title("À Propos", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF) - 18 * _fscale
        
        if cv_data.get("experiences"):
            if my < 120 * _fscale: my = new_page()
            my = section_title("Expérience", my)
            for exp in cv_data["experiences"]:
                if my < 120 * _fscale: my = new_page(); my = section_title("Expérience", my)
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7.5)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 40 * _fscale: my = new_page(); my = section_title("Expérience", my)
                    bullet_y = my
                    c.setFillColor(theme_cls.ACCENT2)
                    c.circle(MX + 3, bullet_y + 2.5 * _fscale, 2 * _fscale, fill=1, stroke=0)
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8, theme_cls.TEXT_MED, MW - 14, 11, force_family=FF) - 2 * _fscale
                my -= 12 * _fscale
        
        # Education
        if cv_data.get("education"):
            if my < 120 * _fscale: my = new_page()
            my = section_title("Éducation", my)
            for edu in cv_data["education"]:
                if my < 80 * _fscale: my = new_page(); my = section_title("Éducation", my)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 10 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_LIGHT)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 7.5, theme_cls.TEXT_LIGHT, MW, 11, force_family=FF) - 3 * _fscale
                my -= 12 * _fscale

        # Skills Section
        if cv_data.get("skills", {}).get("categories"):
            if my < 100 * _fscale: my = new_page()
            my = section_title(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page(); my = section_title(L["skills"], my)
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat.get("name", "").upper())
                my -= 12 * _fscale
                tx = MX
                for skill in cat.get("items", []):
                    if my < 50 * _fscale: 
                        my = new_page()
                        my = section_title(L["skills"], my)
                        tx = MX
                    sw_tag = c.stringWidth(skill, _f("Poppins", FF), 7) + 12
                    if tx + sw_tag > MX + MW:
                        tx = MX
                        my -= 18 * _fscale
                    tag_h = 14 * _fscale
                    _draw_rect(c, tx, my - 10, sw_tag, tag_h, fill=theme_cls.ACCENT, radius=3)
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(HexColor("#FFFFFF"))
                    c.drawString(tx + 6, my - 6, skill)
                    tx += sw_tag + 5
                my -= 24 * _fscale

        # Languages
        if cv_data.get("languages"):
            if my < 80 * _fscale: my = new_page()
            my = section_title("Langues", my)
            for li in cv_data["languages"]:
                if my < 60 * _fscale: my = new_page(); my = section_title("Langues", my)
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, li.get("lang", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawString(MX + 80, my, li.get("level", ""))
                my -= 12 * _fscale

        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)
        
        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


class _MinimalistPro:
    """Design ultra-minimaliste avec photo petite en haut à gauche"""
    BG = HexColor("#FFFFFF")
    ACCENT = HexColor("#2C3E50")
    ACCENT2 = HexColor("#95A5A6")
    TEXT_DARK = HexColor("#2C3E50")
    TEXT_MED = HexColor("#7F8C8D")
    TEXT_LIGHT = HexColor("#BDC3C7")
    DIVIDER = HexColor("#ECF0F1")
    PHOTO_BORDER = HexColor("#2C3E50")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 60, W - 120
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)
        
        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            return y

        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        
        # Header CENTRÉ (comme demandé par la description de l'UI)
        name = cv_data.get("name", "")
        my = H - 40 * _fscale
        
        # Nom centré
        c.setFont(_f("Poppins-Bold", FF), 28)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        c.drawCentredString(W / 2, my, name)
        my -= 32 * _fscale
        
        # Titre centré
        c.setFont(_f("Poppins-Light", FF), 11)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT))
        c.drawCentredString(W / 2, my, cv_data.get("title", ""))
        my -= 4 * _fscale
        
        # Petite photo centrée si présente
        photo = cv_data.get("profile_photo")
        if photo:
            PHOTO_SIZE = 55 * _fscale
            _draw_photo(c, photo, (W - PHOTO_SIZE) / 2, my - PHOTO_SIZE - 10 * _fscale, PHOTO_SIZE, 'circle',
                       border_color=getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT), border_width=1.5 * _fscale)
            my -= (PHOTO_SIZE + 25 * _fscale)
        else:
            my -= 10 * _fscale

        # Diviseur ornemental (Red Dot Divider comme sur le screenshot)
        c.setStrokeColor(theme_cls.DIVIDER)
        c.setLineWidth(0.5 * _fscale)
        c.line(W / 2 - 40 * _fscale, my, W / 2 - 10 * _fscale, my)
        c.line(W / 2 + 10 * _fscale, my, W / 2 + 40 * _fscale, my)
        c.setFillColor(theme_cls.ACCENT) # Le point rouge (ou couleur d'accent)
        c.circle(W / 2, my, 2.5 * _fscale, fill=1, stroke=0)
        my -= 22 * _fscale

        # Contact centré - avec wrapping
        my = _draw_wrapped_centred_contact(c, cv_data, W / 2, my, MW, "Poppins", 7.5, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.TEXT_LIGHT), "     ", force_family=FF)
        my -= 20 * _fscale
        
        # Ligne séparatrice fine footer header
        c.setStrokeColor(theme_cls.DIVIDER)
        c.setLineWidth(0.5 * _fscale)
        c.line(MX, my, W - MX, my)
        my -= 25 * _fscale
        
        def section_title(t, y):
            c.setFont(_f("Poppins-Bold", FF), 7.5)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
            c.setLineWidth(0.3 * _fscale)
            c.line(MX, y - 3 * _fscale, W - MX, y - 3 * _fscale)
            return y - 14 * _fscale
        
        # Summary
        if cv_data.get("summary"):
            my = section_title("Profil", my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF) - 18 * _fscale
        
        # Experience
        if cv_data.get("experiences"):
            if my < 120 * _fscale: my = new_page()
            my = section_title("Expérience Professionnelle", my)
            for exp in cv_data["experiences"]:
                if my < 120 * _fscale: my = new_page(); my = section_title("Expérience Professionnelle", my)
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 11 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, exp.get("company", ""))
                my -= 12 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page(); my = section_title("Expérience Professionnelle", my)
                    bullet_y = my
                    my = _draw_multiline(c, "— " + bullet, MX, bullet_y, "Poppins", 8, theme_cls.TEXT_MED, MW, 11, force_family=FF) - 2 * _fscale
                my -= 10 * _fscale
        
        # Education
        if cv_data.get("education"):
            if my < 120 * _fscale: my = new_page()
            my = section_title("Formation", my)
            for edu in cv_data["education"]:
                if my < 80 * _fscale: my = new_page(); my = section_title("Formation", my)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFont(_f("Poppins", FF), 7)
                c.setFillColor(theme_cls.TEXT_LIGHT)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 10 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_LIGHT)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 7.5, theme_cls.TEXT_LIGHT, MW, 11, force_family=FF) - 3 * _fscale
                my -= 10 * _fscale
        
        # Languages
        if cv_data.get("languages") and my > 80 * _fscale:
            my = section_title("Langues", my)
            for li in cv_data["languages"]:
                if my < 60 * _fscale: break
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MX, my, li.get("lang", "") + " — " + li.get("level", ""))
                my -= 12 * _fscale
        
        # Interests
        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_title(L["interests"], my)
            my = _draw_interests_tags(c, cv_data["interests"], MX, my, MW, "Poppins", 8, theme_cls.TEXT_MED, force_family=FF)
        
        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


class _InternationalProfile:
    """Sidebar avec photo carrée et barres de progression"""
    BG = HexColor("#FFFFFF")
    SIDEBAR_BG = HexColor("#F5F5F5")
    ACCENT = HexColor("#D32F2F")
    ACCENT2 = HexColor("#1976D2")
    TEXT_DARK = HexColor("#212121")
    TEXT_MED = HexColor("#616161")
    TEXT_LIGHT = HexColor("#9E9E9E")
    PHOTO_BORDER = HexColor("#D32F2F")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        SIDEBAR_W = 170
        MAIN_X = SIDEBAR_W + 30
        MAIN_W = W - MAIN_X - 25
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)
        
        _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
        _draw_rect(c, 0, 0, SIDEBAR_W, H, fill=theme_cls.SIDEBAR_BG)
        _draw_rect(c, SIDEBAR_W - 5, 0, 5, H, fill=theme_cls.ACCENT)
        
        def new_page():
            y = new_page_func()
            _draw_rect(c, 0, 0, W, H, fill=theme_cls.BG)
            _draw_rect(c, 0, 0, SIDEBAR_W, H, fill=theme_cls.SIDEBAR_BG)
            _draw_rect(c, SIDEBAR_W - 5, 0, 5, H, fill=theme_cls.ACCENT)
            return y

        # Photo carrée en haut sidebar
        photo = cv_data.get("profile_photo")
        PHOTO_SIZE = 130 * _fscale
        if photo:
            _draw_photo(c, photo, (SIDEBAR_W - PHOTO_SIZE) / 2, H - PHOTO_SIZE - 35 * _fscale, PHOTO_SIZE, 'square',
                       border_color=getattr(theme_cls, 'PHOTO_BORDER', theme_cls.ACCENT), border_width=3 * _fscale)
        
        sy = H - PHOTO_SIZE - 55 * _fscale
        
        def sidebar_title(t, y):
            if y < 60 * _fscale: y = new_page()
            c.setFont(_f("Poppins-Bold", FF), 8)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.drawString(15, y, t.upper())
            c.setStrokeColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.setLineWidth(2)
            c.line(15, y - 4 * _fscale, SIDEBAR_W - 15, y - 4 * _fscale)
            return y - 16 * _fscale
        
        if cv_data.get("skills", {}).get("categories"):
            sy = sidebar_title(L["skills"], sy)
            for cat in cv_data["skills"]["categories"]:
                if sy < 50 * _fscale: sy = new_page()
                for skill in cat.get("items", []):
                    if sy < 40 * _fscale: sy = new_page()
                    c.setFont(_f("Poppins", FF), 7)
                    c.setFillColor(theme_cls.TEXT_DARK)
                    c.drawString(15, sy, skill[:18])
                    bar_y = sy - 8 * _fscale
                    bar_w = SIDEBAR_W - 30
                    _draw_rect(c, 15, bar_y, bar_w, 4 * _fscale, fill=HexColor("#E0E0E0"))
                    _draw_rect(c, 15, bar_y, bar_w * 0.85, 4 * _fscale, fill=getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
                    sy -= 18 * _fscale
        
        if cv_data.get("languages"):
            sy -= 8 * _fscale
            sy = sidebar_title(L["languages"], sy)
            for li in cv_data["languages"]:
                if sy < 80 * _fscale: sy = new_page()
                c.setFont(_f("Poppins-Bold", FF), 7.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(15, sy, li.get("lang", ""))
                
                try: level_num = int(li.get("level_num", 3))
                except: level_num = 3
                
                bar_w = SIDEBAR_W - 30
                bar_y = sy - 11 * _fscale
                _draw_rect(c, 15, bar_y, bar_w, 3 * _fscale, fill=HexColor("#E2E8F0"))
                _draw_rect(c, 15, bar_y, bar_w * (level_num / 5.0), 3 * _fscale, fill=getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
                
                c.setFont(_f("Poppins", FF), 6.5)
                c.setFillColor(theme_cls.TEXT_MED)
                c.drawString(15, sy - 20 * _fscale, li.get("level", ""))
                sy -= 32 * _fscale

            # Interests in Sidebar (Bottom)
            if cv_data.get("interests"):
                sy -= 10 * _fscale
                sy = sidebar_title(L["interests"], sy)
                sy = _draw_interests_tags(c, cv_data["interests"], 15, sy, SIDEBAR_W - 30, "Poppins", 7, theme_cls.TEXT_DARK, force_family=FF)
        
        # Main content
        my = H - 45 * _fscale
        c.setFont(_f("Poppins-Bold", FF), 28)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        c.drawString(MAIN_X, my, cv_data.get("name", ""))
        my -= 22 * _fscale
        
        c.setFont(_f("Poppins-Light", FF), 12)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT))
        c.drawString(MAIN_X, my, cv_data.get("title", ""))
        my -= 18 * _fscale
        
        my = _draw_wrapped_contact(c, cv_data, MAIN_X, my, MAIN_W, "Poppins", 7.5, getattr(theme_cls, 'CONTACT_COLOR', theme_cls.TEXT_LIGHT), "  •  ", force_family=FF)
        my -= 22 * _fscale
        
        if cv_data.get("summary"):
            if my < 100 * _fscale: my = new_page()
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
            c.drawString(MAIN_X, my, L["summary"].upper())
            my -= 14 * _fscale
            my = _draw_multiline(c, cv_data["summary"], MAIN_X, my, "Poppins", 9, theme_cls.TEXT_MED, MAIN_W, 13, force_family=FF) - 18 * _fscale
        
        if cv_data.get("experiences"):
            if my < 120 * _fscale: my = new_page()
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
            c.drawString(MAIN_X, my, L["experience"].upper())
            my -= 16 * _fscale
            
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page()
                c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
                c.circle(MAIN_X - 8, my + 4 * _fscale, 4 * _fscale, fill=1, stroke=0)
                
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MAIN_X, my, exp.get("role", ""))
                my -= 12 * _fscale
                
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MAIN_X, my, exp.get("company", "") + "  |  " + exp.get("period", ""))
                my -= 14 * _fscale
                
                for bullet in exp.get("bullets", []):
                    if my < 40 * _fscale: my = new_page()
                    bullet_y = my
                    my = _draw_multiline(c, "→ " + bullet, MAIN_X, bullet_y, "Poppins", 8, theme_cls.TEXT_MED, MAIN_W, 11, force_family=FF) - 3 * _fscale
                my -= 12 * _fscale
        
        # Education
        if cv_data.get("education"):
            if my < 120 * _fscale: my = new_page()
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
            c.drawString(MAIN_X, my, L["education"].upper())
            my -= 14 * _fscale
            for edu in cv_data["education"]:
                if my < 80 * _fscale: 
                    my = new_page()
                    c.setFont(_f("Poppins-Bold", FF), 9)
                    c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT2))
                    c.drawString(MAIN_X, my, L["education"].upper())
                    my -= 14 * _fscale
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.TEXT_DARK))
                c.drawString(MAIN_X, my, edu.get("degree", ""))
                my -= 10 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', theme_cls.ACCENT))
                c.drawString(MAIN_X, my, edu.get("school", "") + "  |  " + edu.get("year", ""))
                my -= 10 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MAIN_X, my, "Poppins", 7.5, theme_cls.TEXT_MED, MAIN_W, 11, force_family=FF) - 3 * _fscale
                my -= 6 * _fscale
        
        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))



# ══════════════════════════════════════════════════════════════════
#  THÈME — IMPACT BOLD (ATS RESTRICTED)
# ══════════════════════════════════════════════════════════════════
class _ImpactBoldATS:
    HEADER_BG    = HexColor("#000000")
    WHITE        = HexColor("#FFFFFF")
    TEXT_DARK    = HexColor("#000000")
    TEXT_MED     = HexColor("#333333")
    TEXT_LIGHT   = HexColor("#666666")
    DIVIDER      = HexColor("#E0E0E0")
    ACCENT       = HexColor("#000000")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 50, W - 100
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            return y

        # 1. HEADER (Dynamic Accent or Black)
        accent_color = getattr(theme_cls, 'ACCENT', theme_cls.HEADER_BG)
        name = cv_data.get("name", "").upper()
        hy = H - 45
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 26, theme_cls.WHITE, MW/2, 28, dry_run=True, force_family=FF)
        hy = _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy - 4, "Poppins-Medium", 12, theme_cls.WHITE, MW/2, 16, dry_run=True, force_family=FF)
        
        HEADER_BOT = min(hy - 25, H - 120) 
        _draw_rect(c, 0, HEADER_BOT, W, H - HEADER_BOT, fill=accent_color)
        
        hy = H - 45
        hy = _draw_wrapped_header(c, name, MX, hy, "Poppins-Bold", 26, theme_cls.WHITE, MW/2, 28, force_family=FF)
        _draw_wrapped_header(c, cv_data.get("title", ""), MX, hy - 4, "Poppins-Medium", 12, theme_cls.WHITE, MW/2, 16, force_family=FF)
        
        if cv_data.get("location"):
            c.setFont(_f("Poppins-Medium", FF), 8)
            c.setFillColor(theme_cls.WHITE)
            c.drawString(MX, HEADER_BOT + 12, "LOCATION: " + cv_data["location"])
            
        rx = MX + MW/2 + 20
        ry = H - 45
        c.setFont(_f("Poppins-Medium", FF), 7.5)
        c.setFillColor(theme_cls.WHITE)
        contact_keys = [("email", "EMAIL"), ("phone", "PHONE"), ("linkedin", "LINKEDIN"), ("github", "GITHUB"), ("portfolio", "PORTFOLIO")]
        for key, label in contact_keys:
            if cv_data.get(key):
                val, url = _parse_link(cv_data[key])
                if url:
                    _draw_link(c, rx, ry, f"{label}: {val}", url, "Poppins-Medium", 7.5, theme_cls.WHITE, underline=False, force_family=FF)
                else:
                    c.drawString(rx, ry, f"{label}: {val}")
                ry -= 12 * _fscale

        my = HEADER_BOT - 30 * _fscale

        def block_title(t, y):
            if y < 80 * _fscale: y = new_page()
            tw = c.stringWidth(t.upper(), _f("Poppins-Bold", FF), 9) + 20
            _draw_rect(c, MX, y - 4 * _fscale, tw, 16 * _fscale, fill=accent_color)
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(theme_cls.WHITE)
            c.drawString(MX + 10, y, t.upper())
            return y - 24 * _fscale

        if cv_data.get("summary"):
            my = block_title(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 20 * _fscale

        if cv_data.get("experiences"):
            my = block_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", "").upper())
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                
                company_text = exp.get("company", "")
                if exp.get("location"): company_text += "  /  " + exp["location"]
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.TEXT_MED)
                c.drawString(MX, my, company_text.upper())
                my -= 14 * _fscale
                
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFont(_f("Poppins-Bold", FF), 8)
                    c.setFillColor(theme_cls.TEXT_DARK)
                    c.drawString(MX + 2, bullet_y + 0.5 * _fscale, "•")
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 8.5, theme_cls.TEXT_MED, MW - 14, 12, force_family=FF) - 3 * _fscale
                
                my -= 10 * _fscale
                if my > 60:
                    c.setStrokeColor(theme_cls.DIVIDER)
                    c.setLineWidth(0.5)
                    c.setDash(1, 2)
                    c.line(MX, my + 5 * _fscale, MX + MW, my + 5 * _fscale)
                    c.setDash()
                my -= 8 * _fscale

        # 2-Column Section (Education/Projects vs Skills/Interests)
        COL_GAP = 30
        CW = (MW - COL_GAP) / 2
        col1_y = my
        col2_y = my
        
        # We need a shared state for page breaks
        class State:
            y1 = col1_y
            y2 = col2_y
            page = 1
            
        def check_page(st, needed):
            if st.y1 < needed or st.y2 < needed:
                st.y1 = new_page()
                st.y2 = st.y1
                st.page += 1
            return st

        def draw_block_title(st, t, col=1):
            x = MX if col == 1 else MX + CW + COL_GAP
            st = check_page(st, 80 * _fscale)
            y = st.y1 if col == 1 else st.y2
            tw = c.stringWidth(t.upper(), _f("Poppins-Bold", FF), 9) + 20
            _draw_rect(c, x, y - 4 * _fscale, tw, 16 * _fscale, fill=accent_color)
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(theme_cls.WHITE)
            c.drawString(x + 10, y, t.upper())
            if col == 1: st.y1 = y - 24 * _fscale
            else: st.y2 = y - 24 * _fscale
            return st

        st = State()

        # Education col1
        if cv_data.get("education"):
            st = draw_block_title(st, L["education"], col=1)
            for edu in cv_data["education"]:
                if st.y1 < 60 * _fscale: st = check_page(st, 60 * _fscale)
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', getattr(theme_cls, 'TITLE_COLOR', theme_cls.TEXT_DARK)))
                c.drawString(MX, st.y1, edu.get("degree", ""))
                st.y1 -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(getattr(theme_cls, 'ACCENT', theme_cls.TEXT_LIGHT))
                c.drawString(MX, st.y1, edu.get("school", "") + " / " + edu.get("year", ""))
                st.y1 -= 12 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    st.y1 = _draw_multiline(c, edu_detail, MX, st.y1, "Poppins", 8, theme_cls.TEXT_MED, CW, 11, force_family=FF) - 3 * _fscale
                st.y1 -= 6 * _fscale
        
        # Projects col1
        if cv_data.get("projects"):
            st.y1 -= 10 * _fscale
            st = draw_block_title(st, L["projects"], col=1)
            for proj in cv_data["projects"]:
                if st.y1 < 60 * _fscale: st = check_page(st, 60 * _fscale)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, st.y1, proj.get("name", ""))
                st.y1 -= 12 * _fscale
                st.y1 = _draw_multiline(c, proj.get("desc", ""), MX, st.y1, "Poppins", 8, theme_cls.TEXT_MED, CW, 11, force_family=FF) - 8 * _fscale

        # Skills col2 — bold category name + normal items below
        if cv_data.get("skills", {}).get("categories"):
            st = draw_block_title(st, L["skills"], col=2)
            col2_x = MX + CW + COL_GAP
            for cat in cv_data["skills"]["categories"]:
                if st.y2 < 45 * _fscale: st = check_page(st, 45 * _fscale)
                c.setFont(_f("Poppins-Bold", FF), 8)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(col2_x, st.y2, cat.get("name", "").upper())
                st.y2 -= 11 * _fscale
                c.setFont(_f("Poppins", FF), 8)
                c.setFillColor(theme_cls.TEXT_MED)
                items_text = ", ".join(cat.get("items", []))
                st.y2 = _draw_multiline(c, items_text, col2_x, st.y2, "Poppins", 8, theme_cls.TEXT_MED, CW, 11, force_family=FF) - 10 * _fscale

        # Interests col2
        if cv_data.get("interests"):
            st.y2 -= 15 * _fscale
            st = draw_block_title(st, L["interests"], col=2)
            col2_x = MX + CW + COL_GAP
            for inter in cv_data["interests"]:
                if st.y2 < 20 * _fscale: st = check_page(st, 20 * _fscale)
                c.setFont(_f("Poppins", FF), 8.5)
                c.setFillColor(theme_cls.TEXT_MED)
                c.drawString(col2_x, st.y2, "• " + inter)
                st.y2 -= 12 * _fscale

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# ══════════════════════════════════════════════════════════════════
#  THÈME — ELITE ATS (MAXIMUM EXTRACTION)
# ══════════════════════════════════════════════════════════════════
class _EliteATS:
    TEXT_DARK    = HexColor("#111111")
    TEXT_MED     = HexColor("#333333")
    ACCENT       = HexColor("#1E40AF")
    DIVIDER      = HexColor("#DDDDDD")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 60, W - 120
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            return y

        my = H - 60
        c.setFont(_f("Poppins-Bold", FF), 22)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        c.drawString(MX, my, cv_data.get("name", "").upper())
        my -= 24 * _fscale
        
        c.setFont(_f("Poppins-Medium", FF), 12)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT))
        c.drawString(MX, my, cv_data.get("title", "").upper())
        my -= 20 * _fscale
        
        y_before = my
        my = _draw_wrapped_contact(c, cv_data, MX, my, MW, "Poppins", 8.5, theme_cls.TEXT_MED, sep=" | ", force_family=FF, keys=["email", "phone", "location"])
        my -= 2 * _fscale
        my = _draw_wrapped_contact(c, cv_data, MX, my, MW, "Poppins", 8.5, theme_cls.TEXT_MED, sep=" | ", force_family=FF, keys=["linkedin", "github", "portfolio"])
        if my < y_before - 5 * _fscale:
            my -= 10 * _fscale
            
        my -= 15 * _fscale

        def section_hr(t, y):
            if y < 80: y = new_page()
            sc = getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.TEXT_DARK)
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(sc)
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(sc)
            c.setLineWidth(1)
            c.line(MX, y - 4 * _fscale, MX + MW, y - 4 * _fscale)
            return y - 20 * _fscale

        if cv_data.get("summary"):
            my = section_hr(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 20 * _fscale

        if cv_data.get("experiences"):
            my = section_hr(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, exp.get("company", "") + (f" - {exp['location']}" if exp.get('location') else ""))
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 40 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFont(_f("Poppins", FF), 8.5)
                    c.setFillColor(theme_cls.TEXT_DARK)
                    c.drawString(MX, bullet_y, "-")
                    my = _draw_multiline(c, bullet, MX + 10, bullet_y, "Poppins", 9, theme_cls.TEXT_MED, MW - 10, 13, force_family=FF) - 2 
                my -= 12 * _fscale

        if cv_data.get("education"):
            if my < 100 * _fscale: my = new_page()
            my = section_hr(L["education"], my)
            for edu in cv_data["education"]:
                if my < 60 * _fscale: my = new_page(); my = section_hr(L["education"], my)
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', getattr(theme_cls, 'TITLE_COLOR', theme_cls.TEXT_DARK)))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ACCENT', theme_cls.TEXT_MED))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 13 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 8.5, theme_cls.TEXT_MED, MW, 12, force_family=FF) - 4 * _fscale
                my -= 6 * _fscale

        # Skills — bold category name, normal items on same line
        if cv_data.get("skills", {}).get("categories"):
            if my < 100 * _fscale: my = new_page()
            my = section_hr(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                cat_name = cat.get('name', '') + ": "
                cat_items = ", ".join(cat.get("items", []))
                name_w = c.stringWidth(cat_name, _f("Poppins-Bold", FF), 9)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat_name)
                my = _draw_multiline(c, cat_items, MX + name_w, my, "Poppins", 9, theme_cls.TEXT_MED, MW - name_w, 13, force_family=FF) - 6 * _fscale

        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_hr(L["interests"], my)
            items_txt = ", ".join(cv_data["interests"])
            my = _draw_multiline(c, items_txt, MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF)

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# ══════════════════════════════════════════════════════════════════
#  THÈME — STRATEGIC PROFESSIONAL (CLEAN HYBRID)
# ══════════════════════════════════════════════════════════════════
class _StrategicProfessional:
    ACCENT       = HexColor("#2563EB")
    TEXT_DARK    = HexColor("#1E293B")
    TEXT_MED     = HexColor("#475569")
    TEXT_LIGHT   = HexColor("#94A3B8")
    BG           = HexColor("#FFFFFF")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 52, W - 104
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            return y

        my = H - 55
        c.setFont(_f("Poppins-Bold", FF), 32)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        c.drawString(MX, my, cv_data.get("name", ""))
        my -= 36 * _fscale
        
        c.setFont(_f("Poppins-Light", FF), 14)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT))
        c.drawString(MX, my, cv_data.get("title", "").upper())
        my -= 24 * _fscale
        
        my = _draw_wrapped_contact(c, cv_data, MX, my, MW, "Poppins", 8.5, theme_cls.TEXT_MED, sep="  •  ", force_family=FF, keys=["email", "phone", "location", "linkedin", "github"]) - 10 * _fscale

        def section_line(t, y):
            if y < 80: y = new_page()
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(theme_cls.TEXT_DARK)
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(theme_cls.ACCENT)
            c.setLineWidth(2)
            c.line(MX, y - 6, MX + 30, y - 6)
            return y - 22 * _fscale

        if cv_data.get("summary"):
            my = section_line(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 20 * _fscale

        if cv_data.get("experiences"):
            my = section_line(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 11)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                
                c.setFont(_f("Poppins-Medium", FF), 9.5)
                c.setFillColor(theme_cls.ACCENT)
                c.drawString(MX, my, exp.get("company", "") + (f" | {exp['location']}" if exp.get('location') else ""))
                my -= 14 * _fscale
                
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFont(_f("Poppins-Bold", FF), 8)
                    c.setFillColor(theme_cls.ACCENT)
                    c.drawString(MX + 2, bullet_y + 0.5 * _fscale, "▪")
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 9, theme_cls.TEXT_MED, MW - 14, 13, force_family=FF) - 3 * _fscale
                my -= 12 * _fscale

        if cv_data.get("education"):
            if my < 100 * _fscale: my = new_page()
            my = section_line(L["education"], my)
            for edu in cv_data["education"]:
                if my < 60 * _fscale: my = new_page(); my = section_line(L["education"], my)
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', getattr(theme_cls, 'TITLE_COLOR', theme_cls.TEXT_DARK)))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ACCENT', theme_cls.TEXT_MED))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 13 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 8.5, theme_cls.TEXT_MED, MW, 12, force_family=FF) - 4 * _fscale
                my -= 6 * _fscale

        # Skills — bold category name, normal items same line
        if cv_data.get("skills", {}).get("categories"):
            if my < 100 * _fscale: my = new_page()
            my = section_line(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                cat_name = cat.get('name', '') + ": "
                cat_items = ", ".join(cat.get("items", []))
                name_w = c.stringWidth(cat_name, _f("Poppins-Bold", FF), 9)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat_name)
                my = _draw_multiline(c, cat_items, MX + name_w, my, "Poppins", 9, theme_cls.TEXT_MED, MW - name_w, 13, force_family=FF) - 6 * _fscale

        if cv_data.get("interests"):
            if my < 80 * _fscale: my = new_page()
            my = section_line(L["interests"], my)
            items_txt = ", ".join(cv_data["interests"])
            my = _draw_multiline(c, items_txt, MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF)

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))



# ══════════════════════════════════════════════════════════════════
#  THÈME — STANDARD CORPORATE (HARVARD STYLE)
# ══════════════════════════════════════════════════════════════════
class _StandardCorporate:
    TEXT_DARK    = HexColor("#000000")
    TEXT_MED     = HexColor("#333333")
    ACCENT       = HexColor("#000000")
    DIVIDER      = HexColor("#000000")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 60, W - 120
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            return y

        my = H - 60
        # Name Centered
        c.setFont(_f("Lora-Bold", FF), 20)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        name = cv_data.get("name", "").upper()
        c.drawCentredString(W/2, my, name)
        my -= 20 * _fscale
        
        # Contact Line Centered
        my = _draw_wrapped_centred_contact(c, cv_data, W/2, my, MW, "Poppins", 8.5, theme_cls.TEXT_MED, sep="  |  ", force_family=FF)
        my -= 14 * _fscale

        def section_hr(t, y):
            if y < 80: y = new_page()
            sc = getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.TEXT_DARK)
            c.setFont(_f("Lora-Bold", FF), 10)
            c.setFillColor(sc)
            c.drawString(MX, y, t.upper())
            c.setStrokeColor(getattr(theme_cls, 'DIVIDER', sc))
            c.setLineWidth(0.8)
            c.line(MX, y - 4 * _fscale, MX + MW, y - 4 * _fscale)
            return y - 18 * _fscale

        if cv_data.get("summary"):
            my = section_hr(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9.5, theme_cls.TEXT_MED, MW, 13, force_family=FF) - 20 * _fscale

        if cv_data.get("experiences"):
            my = section_hr(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', getattr(theme_cls, 'TITLE_COLOR', theme_cls.TEXT_DARK)))
                c.drawString(MX, my, exp.get("role", "").upper())
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Italic", FF), 9.5)
                c.setFillColor(getattr(theme_cls, 'ACCENT', theme_cls.TEXT_DARK))
                c.drawString(MX, my, exp.get("company", "") + (f", {exp['location']}" if exp.get('location') else ""))
                my -= 14 * _fscale
                for bullet in exp.get("bullets", []):
                    if my < 40 * _fscale: my = new_page()
                    bullet_y = my
                    c.setFont(_f("Poppins", FF), 9)
                    c.setFillColor(theme_cls.TEXT_DARK)
                    c.drawString(MX + 5, bullet_y, "•")
                    my = _draw_multiline(c, bullet, MX + 15, bullet_y, "Poppins", 9, theme_cls.TEXT_MED, MW - 15, 12, force_family=FF) - 2 
                my -= 10 * _fscale

        if cv_data.get("education"):
            if my < 100 * _fscale: my = new_page()
            my = section_hr(L["education"], my)
            for edu in cv_data["education"]:
                if my < 60 * _fscale: my = new_page(); my = section_hr(L["education"], my)
                c.setFont(_f("Poppins-Bold", FF), 9.5)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', getattr(theme_cls, 'TITLE_COLOR', theme_cls.TEXT_DARK)))
                c.drawString(MX, my, edu.get("school", ""))
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Italic", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ACCENT', theme_cls.TEXT_DARK))
                c.drawString(MX, my, edu.get("degree", ""))
                my -= 11 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 8, theme_cls.TEXT_MED, MW, 12, force_family=FF) - 3 * _fscale
                my -= 7 * _fscale

        if cv_data.get("skills", {}).get("categories"):
            if my < 100 * _fscale: my = new_page()
            my = section_hr(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                cat_name = cat.get('name', '') + ": "
                cat_items = ", ".join(cat.get("items", []))
                name_w = c.stringWidth(cat_name, _f("Lora-Bold", FF), 9)
                c.setFont(_f("Lora-Bold", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat_name)
                my = _draw_multiline(c, cat_items, MX + name_w, my, "Poppins", 9, theme_cls.TEXT_MED, MW - name_w, 12, force_family=FF) - 6 * _fscale

        if cv_data.get("interests"):
            my -= 10 * _fscale
            my = section_hr(L["interests"], my)
            items_txt = ", ".join(cv_data["interests"])
            my = _draw_multiline(c, items_txt, MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 12, force_family=FF)

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# ══════════════════════════════════════════════════════════════════
#  THÈME — STRATEGIC MODERN (MINIMALIST TECH)
# ══════════════════════════════════════════════════════════════════
class _StrategicModern:
    TEXT_DARK    = HexColor("#1F2937")
    TEXT_MED     = HexColor("#4B5563")
    ACCENT       = HexColor("#2563EB") # Royal Blue
    DIVIDER      = HexColor("#E5E7EB")
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 55, W - 110
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            return y

        # Header Left
        my = H - 50
        c.setFont(_f("Poppins-Bold", FF), 28)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        c.drawString(MX, my, cv_data.get("name", ""))
        my -= 32 * _fscale
        
        c.setFont(_f("Poppins-Medium", FF), 12)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT))
        c.drawString(MX, my, cv_data.get("title", "").upper())
        my -= 18 * _fscale
        
        # Contact line
        my = _draw_wrapped_contact(c, cv_data, MX, my, MW, "Poppins", 8.5, theme_cls.TEXT_MED, sep="  •  ", force_family=FF, keys=["email", "phone", "location", "linkedin", "github"]) - 10 * _fscale


        def section_title(t, y):
            if y < 80: y = new_page()
            sc = getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT)
            c.setFont(_f("Poppins-Bold", FF), 10)
            c.setFillColor(sc)
            c.drawString(MX, y, t.upper())
            return y - 18 * _fscale

        if cv_data.get("summary"):
            my = section_title(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], MX, my, "Poppins", 9.5, theme_cls.TEXT_MED, MW, 14, force_family=FF) - 25 * _fscale

        if cv_data.get("experiences"):
            my = section_title(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page()
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, exp.get("role", ""))
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(theme_cls.TEXT_MED)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                
                c.setFont(_f("Poppins-Medium", FF), 9.5)
                c.setFillColor(theme_cls.TEXT_MED)
                c.drawString(MX, my, exp.get("company", "") + (f" | {exp['location']}" if exp.get('location') else ""))
                my -= 14 * _fscale
                
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page()
                    bullet_y = my
                    # Minimal square bullet
                    _draw_rect(c, MX + 2, bullet_y + 3 * _fscale, 2.5 * _fscale, 2.5 * _fscale, fill=theme_cls.ACCENT)
                    my = _draw_multiline(c, bullet, MX + 12, bullet_y, "Poppins", 9, theme_cls.TEXT_MED, MW - 14, 13, force_family=FF) - 3 * _fscale
                my -= 15 * _fscale

        if cv_data.get("education"):
            if my < 100 * _fscale: my = new_page()
            my = section_title(L["education"], my)
            for edu in cv_data["education"]:
                if my < 60 * _fscale: my = new_page(); my = section_title(L["education"], my)
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', getattr(theme_cls, 'TITLE_COLOR', theme_cls.TEXT_DARK)))
                c.drawString(MX, my, edu.get("degree", ""))
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ACCENT', theme_cls.TEXT_MED))
                c.drawString(MX, my, edu.get("school", ""))
                my -= 13 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, MX, my, "Poppins", 8.5, theme_cls.TEXT_MED, MW, 12, force_family=FF) - 4 * _fscale
                my -= 6 * _fscale

        if cv_data.get("skills", {}).get("categories"):
            my = section_title(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                cat_name = cat.get('name', '') + ": "
                cat_items = ", ".join(cat.get("items", []))
                name_w = c.stringWidth(cat_name, _f("Poppins-Bold", FF), 9)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(MX, my, cat_name)
                my = _draw_multiline(c, cat_items, MX + name_w, my, "Poppins", 9, theme_cls.TEXT_MED, MW - name_w, 13, force_family=FF) - 6 * _fscale

        if cv_data.get("interests"):
            my -= 10
            my = section_title(L["interests"], my)
            items_txt = ", ".join(cv_data["interests"])
            my = _draw_multiline(c, items_txt, MX, my, "Poppins", 9, theme_cls.TEXT_MED, MW, 13, force_family=FF)

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# ══════════════════════════════════════════════════════════════════
#  THÈME — EXECUTIVE NARRATIVE (SCAN-FRIENDLY LABELS)
# ══════════════════════════════════════════════════════════════════
class _ExecutiveNarrative:
    TEXT_DARK    = HexColor("#111827")
    TEXT_MED     = HexColor("#374151")
    ACCENT       = HexColor("#4F46E5") # Indigo
    BG           = HexColor("#FFFFFF")
    LABEL_WIDTH  = 120
    

    @classmethod
    def generate(cls, cv_data: dict) -> bytes:
        return _smart_generate(cls, cv_data, cls._render)

    @staticmethod
    def _render(c, theme_cls, cv_data, _fscale, new_page_func):
        L = _get_labels(getattr(theme_cls, 'LANG', 'fr'))
        FF = getattr(theme_cls, 'FONT_OVERRIDE', None)
        W, H = A4
        MX, MW = 50, W - 100
        LW = theme_cls.LABEL_WIDTH * _fscale
        CX = MX + LW + 20
        CW = MW - LW - 20
        
        c.setTitle(cv_data.get("name", "CV") + " — CV")
        add_ats_metadata(c, cv_data)

        def new_page():
            y = new_page_func()
            return y

        # Header Full Width
        my = H - 50
        c.setFont(_f("Poppins-Bold", FF), 26)
        c.setFillColor(getattr(theme_cls, 'NAME_COLOR', theme_cls.TEXT_DARK))
        c.drawString(MX, my, cv_data.get("name", ""))
        my -= 28 * _fscale
        
        c.setFont(_f("Poppins-Medium", FF), 12)
        c.setFillColor(getattr(theme_cls, 'TITLE_COLOR', theme_cls.ACCENT))
        c.drawString(MX, my, cv_data.get("title", "").upper())
        
        # Contacts Right Aligned
        ry = H - 50
        for k in ["email", "phone", "location", "linkedin", "github"]:
            if cv_data.get(k):
                val, url = _parse_link(cv_data[k])
                c.setFont(_f("Poppins", FF), 8)
                c.setFillColor(theme_cls.TEXT_MED)
                c.drawRightString(MX + MW, ry, val)
                if url:
                    w_val = c.stringWidth(val, _f("Poppins", FF), 8)
                    c.linkURL(url, (MX + MW - w_val, ry - 2 * _fscale, MX + MW, ry + 8 * _fscale), relative=0)
                ry -= 12 * _fscale
        
        my = min(my - 12 * _fscale, ry - 15 * _fscale)


        def section_block(t, y):
            if y < 100: y = new_page()
            # Label in the left margin
            c.setFont(_f("Poppins-Bold", FF), 9)
            c.setFillColor(getattr(theme_cls, 'SECTION_TITLE_COLOR', theme_cls.ACCENT))
            c.drawString(MX, y, t.upper())
            return y

        if cv_data.get("summary"):
            my = section_block(L["summary"], my)
            my = _draw_multiline(c, cv_data["summary"], CX, my, "Poppins", 10, theme_cls.TEXT_MED, CW, 14, force_family=FF) - 25 * _fscale

        if cv_data.get("experiences"):
            my = section_block(L["experience"], my)
            for exp in cv_data["experiences"]:
                if my < 100 * _fscale: my = new_page(); my = section_block(L["experience"], my)
                c.setFont(_f("Poppins-Bold", FF), 10.5)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(CX, my, exp.get("role", ""))
                c.setFont(_f("Poppins-Medium", FF), 8.5)
                c.setFillColor(theme_cls.ACCENT)
                c.drawRightString(MX + MW, my, exp.get("period", ""))
                my -= 13 * _fscale
                
                c.setFont(_f("Poppins-Medium", FF), 9.5)
                c.setFillColor(theme_cls.TEXT_MED)
                c.drawString(CX, my, exp.get("company", "") + (f" | {exp['location']}" if exp.get('location') else ""))
                my -= 14 * _fscale
                
                for bullet in exp.get("bullets", []):
                    if my < 45 * _fscale: my = new_page(); my = section_block(L["experience"], my)
                    bullet_y = my
                    c.setFont(_f("Poppins", FF), 9)
                    c.setFillColor(theme_cls.TEXT_MED)
                    c.drawString(CX, bullet_y, "–")
                    my = _draw_multiline(c, bullet, CX + 12, bullet_y, "Poppins", 9, theme_cls.TEXT_MED, CW - 12, 13, force_family=FF) - 2 
                my -= 15 * _fscale

        if cv_data.get("education"):
            my = section_block(L["education"], my)
            for edu in cv_data["education"]:
                if my < 60 * _fscale: my = new_page(); my = section_block(L["education"], my)
                c.setFont(_f("Poppins-Bold", FF), 10)
                c.setFillColor(getattr(theme_cls, 'ROLE_COLOR', getattr(theme_cls, 'TITLE_COLOR', theme_cls.TEXT_DARK)))
                c.drawString(CX, my, edu.get("degree", ""))
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawRightString(MX + MW, my, edu.get("year", ""))
                my -= 12 * _fscale
                c.setFont(_f("Poppins-Medium", FF), 9)
                c.setFillColor(getattr(theme_cls, 'ACCENT', theme_cls.TEXT_MED))
                c.drawString(CX, my, edu.get("school", ""))
                my -= 13 * _fscale
                edu_detail = edu.get("details") or edu.get("detail")
                if edu_detail:
                    c.setFillColor(theme_cls.TEXT_MED)
                    my = _draw_multiline(c, edu_detail, CX, my, "Poppins", 8.5, theme_cls.TEXT_MED, CW, 12, force_family=FF) - 4 * _fscale
                my -= 6 * _fscale

        if cv_data.get("skills", {}).get("categories"):
            my = section_block(L["skills"], my)
            for cat in cv_data["skills"]["categories"]:
                if my < 60 * _fscale: my = new_page()
                cat_name = cat.get('name', '') + ": "
                cat_items = ", ".join(cat.get("items", []))
                name_w = c.stringWidth(cat_name, _f("Poppins-Bold", FF), 9)
                c.setFont(_f("Poppins-Bold", FF), 9)
                c.setFillColor(theme_cls.TEXT_DARK)
                c.drawString(CX, my, cat_name)
                my = _draw_multiline(c, cat_items, CX + name_w, my, "Poppins", 9, theme_cls.TEXT_MED, CW - name_w, 13, force_family=FF) - 6 * _fscale

        if cv_data.get("interests"):
            my -= 10
            my = section_block(L["interests"], my)
            items_txt = ", ".join(cv_data["interests"])
            my = _draw_multiline(c, items_txt, CX, my, "Poppins", 9, theme_cls.TEXT_MED, CW, 13, force_family=FF)

        _draw_ats_hidden_keywords(c, cv_data, getattr(theme_cls, 'BODY_BG', getattr(theme_cls, 'BG', None)))


# Update THEMES dictionary
THEMES.update({
    "Executive Portrait": _ExecutivePortrait,
    "Modern Profile": _ModernProfile,
    "Corporate Elite": _CorporateElite,
    "Creative Vision": _CreativeVision,
    "Minimalist Pro": _MinimalistPro,
    "Finance Executive": _FinanceExecutive,
    "Tech Leader": _TechLeader,
    "Startup Founder": _StartupFounder,
    "Consultant Premium": _ConsultantPremium,
    "International Profile": _InternationalProfile,
    "Impact Bold ATS": _ImpactBoldATS,
    "Elite ATS": _EliteATS,
    "Strategic Professional": _StrategicProfessional,
    "Standard Corporate": _StandardCorporate,
    "Strategic Modern": _StrategicModern,
    "Executive Narrative": _ExecutiveNarrative,
})



