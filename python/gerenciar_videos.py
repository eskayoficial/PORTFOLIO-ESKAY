"""Gerenciador de vídeos do portfólio do Kauan (Python puro, sem instalar nada).

Edita assets/data/projects.json e sincroniza a cópia embutida no index.html
(assim o site continua funcionando ao abrir o arquivo direto, sem servidor).

Exemplos (na pasta do site):
  python python/gerenciar_videos.py listar
  python python/gerenciar_videos.py adicionar https://www.tiktok.com/@canal/video/123 --categoria futebol
  python python/gerenciar_videos.py adicionar https://youtu.be/abc123XYZ --titulo "Meu vídeo" --categoria games
  python python/gerenciar_videos.py remover 7
  python python/gerenciar_videos.py titulos      # busca títulos reais na internet (oEmbed)
  python python/gerenciar_videos.py sincronizar  # só copia o JSON para o index.html
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "assets" / "data" / "projects.json"
INDEX = ROOT / "index.html"
CATEGORIES = {"games": "Games", "futebol": "Futebol", "outros": "Conteúdo"}

TIKTOK_RE = re.compile(r"tiktok\.com/@([\w.\-]+)/video/(\d+)")
YOUTUBE_RE = re.compile(r"(?:youtube\.com/(?:watch\?v=|shorts/|embed/)|youtu\.be/)([\w\-]{11})")
EMBED_RE = re.compile(
    r'(<script type="application/json" id="fallback-projects">)(.*?)(</script>)', re.S
)


def load() -> list[dict]:
    return json.loads(DATA.read_text(encoding="utf-8"))


def save(projects: list[dict]) -> None:
    for i, p in enumerate(projects, start=1):
        p["id"] = i
    DATA.write_text(json.dumps(projects, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sync(projects)


def sync(projects: list[dict] | None = None) -> None:
    projects = projects if projects is not None else load()
    html = INDEX.read_text(encoding="utf-8")
    compact = json.dumps(projects, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    new_html, n = EMBED_RE.subn(lambda m: m.group(1) + compact + m.group(3), html)
    if n != 1:
        sys.exit("Não encontrei o bloco 'fallback-projects' no index.html.")
    INDEX.write_text(new_html, encoding="utf-8")
    print(f"✔ index.html sincronizado ({len(projects)} vídeos).")


def oembed(p: dict) -> dict | None:
    if p["platform"] == "tiktok":
        page = f"https://www.tiktok.com/@{p.get('author', '')}/video/{p['videoId']}"
        api = "https://www.tiktok.com/oembed?url=" + urllib.parse.quote(page, safe="")
    else:
        page = f"https://www.youtube.com/watch?v={p['videoId']}"
        api = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(page, safe="")
    try:
        req = urllib.request.Request(api, headers={"User-Agent": "Mozilla/5.0 (portfolio-script)"})
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception as exc:  # sem internet, vídeo privado etc.
        print(f"  ! não consegui buscar {page}: {exc}")
        return None


def parse_url(url: str) -> dict:
    if m := TIKTOK_RE.search(url):
        return {"platform": "tiktok", "author": m.group(1), "videoId": m.group(2)}
    if m := YOUTUBE_RE.search(url):
        return {"platform": "youtube", "videoId": m.group(1)}
    sys.exit("Link não reconhecido. Use um link do TikTok (…/@canal/video/ID) ou do YouTube.")


def cmd_listar(_args) -> None:
    projects = load()
    print(f"{'ID':>3}  {'PLATAFORMA':<9} {'CATEGORIA':<8} TÍTULO")
    for p in projects:
        flag = " (título pendente)" if p.get("status") == "pendente" else ""
        print(f"{p['id']:>3}  {p['platform']:<9} {p['category']:<8} {p['title']}{flag}")
    print(f"\nTotal: {len(projects)} vídeos")


def cmd_adicionar(args) -> None:
    projects = load()
    info = parse_url(args.url)
    if any(p["videoId"] == info["videoId"] for p in projects):
        sys.exit("Esse vídeo já está no portfólio.")
    plat = "TikTok" if info["platform"] == "tiktok" else "YouTube"
    item = {
        **info,
        "title": args.titulo or (f"Short para @{info['author']}" if info["platform"] == "tiktok" else "Vídeo para YouTube"),
        "category": args.categoria,
        "categoryLabel": f"{plat} · {CATEGORIES[args.categoria]}",
        "status": "confirmado" if args.titulo else "pendente",
    }
    if not args.titulo and (meta := oembed(item)) and meta.get("title"):
        item["title"] = " ".join(meta["title"].split())[:140]
        item["status"] = "confirmado"
    projects.append(item)
    save(projects)
    print(f"✔ Adicionado: [{plat}] {item['title']}")


def cmd_remover(args) -> None:
    projects = load()
    keep = [p for p in projects if p["id"] != args.id]
    if len(keep) == len(projects):
        sys.exit(f"Não existe vídeo com ID {args.id}.")
    save(keep)
    print(f"✔ Vídeo {args.id} removido.")


def cmd_titulos(_args) -> None:
    projects = load()
    changed = 0
    for p in projects:
        if p.get("status") != "pendente":
            continue
        meta = oembed(p)
        if meta and meta.get("title"):
            p["title"] = " ".join(meta["title"].split())[:140]
            p["status"] = "confirmado"
            changed += 1
            print(f"  ✔ {p['id']}: {p['title']}")
    save(projects)
    print(f"{changed} título(s) atualizado(s).")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser(description="Gerencia os vídeos do portfólio do Kauan.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("listar", help="mostra todos os vídeos").set_defaults(fn=cmd_listar)
    a = sub.add_parser("adicionar", help="adiciona um vídeo do TikTok ou YouTube")
    a.add_argument("url")
    a.add_argument("--titulo")
    a.add_argument("--categoria", choices=CATEGORIES, default="outros")
    a.set_defaults(fn=cmd_adicionar)
    r = sub.add_parser("remover", help="remove um vídeo pelo ID")
    r.add_argument("id", type=int)
    r.set_defaults(fn=cmd_remover)
    sub.add_parser("titulos", help="busca títulos reais dos vídeos pendentes").set_defaults(fn=cmd_titulos)
    sub.add_parser("sincronizar", help="copia o JSON para dentro do index.html").set_defaults(fn=lambda _a: sync())
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
