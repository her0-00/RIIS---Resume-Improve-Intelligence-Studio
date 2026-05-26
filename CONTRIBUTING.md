# Contributing to IRIS

Thank you for your interest in contributing to **IRIS — Improve Resume Intelligence Studio**! Community contributions are what make open-source projects thrive. We are excited to collaborate with you to make CV optimization accessible and premium for everyone.

Please take a moment to review this document before you start contributing.

---

## 🧭 Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it to ensure we keep our community welcoming and professional.

---

## 🛠️ Local Development Setup

IRIS consists of two main components:
1. **Frontend**: Next.js 15/16 App Router (written in TypeScript/React with Tailwind CSS).
2. **Backend**: Python 3.11+ processing engine (utilizing ReportLab for PDF rendering, pdfminer.six, python-docx, and Playwright for scraping).

### Step 1: Fork and Clone

1. Fork the repository to your own GitHub account.
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/IRIS---Improve-Resume-Intelligence-Studio.git
   cd IRIS---Improve-Resume-Intelligence-Studio
   ```

### Step 2: Set up the Python Backend

1. Create a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
2. Install the backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Install Playwright browser engines (needed for job scraping and the Autonomous Hunter):
   ```bash
   python -m playwright install chromium
   ```

### Step 3: Set up the Next.js Frontend

1. Navigate to the `web/` directory:
   ```bash
   cd web
   ```
2. Install the Node dependencies:
   ```bash
   npm install
   ```
3. Copy the environment template file:
   ```bash
   cp .env.example .env.local
   ```
4. Edit `.env.local` to add your API keys (e.g., `GROQ_API_KEY`, `GOOGLE_API_KEY`, or `AZURE_OPENAI_API_KEY`). At least one AI key must be active.
5. Start the Next.js development server:
   ```bash
   npm run dev
   ```
6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📝 Coding Standards & Style Guide

### Frontend Guidelines
* **TypeScript**: Enforce strict types. Avoid using `any`.
* **React**: Use functional components and modern React hooks. Use React Server Components (RSC) where appropriate, keeping `"use client"` only for components needing browser interactions.
* **Styling**: We use Tailwind CSS for rapid layout design, combined with vanilla CSS utilities. Ensure responsive layouts (tested down to 320px mobile width).
* **Aesthetics**: IRIS values beautiful, modern, high-end interfaces. Maintain glassmorphism overlays, smooth transitions, and premium color palettes.

### Backend Guidelines
* **Python**: Adhere to PEP 8 standards. Document your functions using clear docstrings.
* **Security**: Never log sensitive data or personal resume contents. Clean up temporary files (like PDFs generated during a background run) immediately.
* **ReportLab**: When modifying or adding themes in `backend/pdf_cv.py`, maintain exact coordinate drawing with proper scale calculations.

---

## 🌿 Git Workflow

We use the following branch structure:
* `main`: Represents the stable production release.
* Feature branches: Name your branches following the pattern `feature/amazing-new-feature` or `bugfix/issue-description`.

### Commit Conventions (Conventional Commits)

To maintain a clean and automated changelog, please format your commit messages as follows:

* **`feat: ...`** — Adding a new feature (e.g., `feat: add PDF resume preview zoom`)
* **`fix: ...`** — Resolving a bug (e.g., `fix: resolve crash when email field is missing in PDF`)
* **`docs: ...`** — Documentation updates (e.g., `docs: update setup steps in contributing guide`)
* **`style: ...`** — Formatting, CSS, or UI polish without changing logic (e.g., `style: adjust margin on theme card list`)
* **`refactor: ...`** — Code refactoring without behavioral changes (e.g., `refactor: extract AI prompt builder to helper file`)
* **`chore: ...`** — General maintenance, dependencies, or configuration changes

---

## 🚀 Submitting a Pull Request (PR)

1. **Commit your changes** to a descriptive branch on your fork.
2. **Push** your branch to GitHub.
3. Open a **Pull Request** against the `main` branch of the original repository.
4. Fill out the [Pull Request Template](.github/pull_request_template.md) completely.
5. Ensure there are no merge conflicts and that your local build passes without errors.
6. The maintainers will review your PR, suggest changes if needed, and merge it once it is approved.

Thank you for contributing! Your efforts help make IRIS the best tool for avoiding the "Resume Black Hole"! ⬡
