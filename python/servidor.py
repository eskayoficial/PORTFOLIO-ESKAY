"""Servidor do portfólio do Kauan em Python puro (3.9+, sem instalar nada).

Mesmas rotas do servidor Java:
  /                     site estático
  /api/projects         todos os vídeos  (?platform=tiktok|youtube para filtrar)
  /api/health           status
  /api/stats            contagem de vídeos e requisições

Uso (na pasta do site):  python python/servidor.py [porta]
"""
from __future__ import annotations

import gzip
import json
import sys
import time
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data" / "projects.json"
STARTED = time.time()
REQUESTS = 0


def load_projects() -> list[dict]:
    return json.loads(DATA.read_text(encoding="utf-8"))


class PortfolioHandler(SimpleHTTPRequestHandler):
    server_version = "KauanPortfolio/2.0"

    def end_headers(self) -> None:
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _json(self, payload, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        if "gzip" in self.headers.get("Accept-Encoding", "") and len(body) > 512:
            body = gzip.compress(body)
            gz = True
        else:
            gz = False
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=UTF-8")
        if gz:
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _route(self) -> bool:
        """Responde rotas da API. Retorna True se a rota foi tratada."""
        global REQUESTS
        REQUESTS += 1
        url = urlparse(self.path)
        if url.path.startswith(("/java/", "/python/")):
            self.send_error(403, "Acesso negado")
            return True
        if url.path == "/api/health":
            self._json({"status": "ok", "site": "Kauan", "server": "python"})
            return True
        if url.path == "/api/projects":
            projects = load_projects()
            platform = parse_qs(url.query).get("platform", [None])[0]
            if platform:
                projects = [p for p in projects if p.get("platform", "").lower() == platform.lower()]
            self._json(projects)
            return True
        if url.path == "/api/stats":
            projects = load_projects()
            self._json({
                "videos": len(projects),
                "tiktok": sum(p.get("platform") == "tiktok" for p in projects),
                "youtube": sum(p.get("platform") == "youtube" for p in projects),
                "requests": REQUESTS,
                "uptimeSeconds": int(time.time() - STARTED),
            })
            return True
        return False

    def do_GET(self) -> None:  # noqa: N802
        if not self._route():
            super().do_GET()

    def do_HEAD(self) -> None:  # noqa: N802
        if not self._route():
            super().do_HEAD()

    def log_message(self, fmt: str, *args) -> None:
        sys.stdout.write(f"  [{time.strftime('%H:%M:%S')}] {fmt % args}\n")


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(PortfolioHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        url = f"http://localhost:{port}"
        print("=" * 46)
        print("  Portfólio Kauan (servidor Python) no ar")
        print(f"  Site:  {url}")
        print(f"  API:   {url}/api/projects")
        print("  Ctrl+C para parar")
        print("=" * 46)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor encerrado.")


if __name__ == "__main__":
    main()
