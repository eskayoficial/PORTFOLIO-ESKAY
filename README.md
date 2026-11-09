# Portfólio Kauan — Editor de Vídeos (v2)

Site de portfólio com **shorts do TikTok**, vídeos do **YouTube**, serviços, processo de trabalho e contato.
Feito com **HTML, CSS e JavaScript** puros, com servidor opcional em **Java** e em **Python** e um
**gerenciador de vídeos em Python**.

## 1. Abrir o site (mais simples)
Dê dois cliques em `index.html`. Funciona sem instalar nada (os vídeos precisam de internet).

## 2. Rodar com servidor (Java ou Python)
**Windows:** dois cliques em `iniciar_windows.bat` e escolha `1` (Java) ou `2` (Python). O navegador abre sozinho.

**Manual:**
```
java java/PortfolioServer.java          # http://localhost:8080  (JDK 17+)
python python/servidor.py               # http://localhost:8000  (Python 3.9+)
```
**macOS/Linux:** `sh iniciar_mac_linux.sh` (Java) ou `sh iniciar_mac_linux.sh python`.

### API (igual nos dois servidores)
| Rota | O que faz |
|---|---|
| `/api/projects` | lista todos os vídeos |
| `/api/projects?platform=tiktok` | só TikTok (ou `youtube`) |
| `/api/stats` | contagem de vídeos, requisições e tempo no ar |
| `/api/health` | status do servidor |

O servidor Java usa compressão gzip, cabeçalhos de segurança e bloqueia acesso às pastas de código.

## 3. Adicionar / remover vídeos (Python)
Nada de editar código na mão — o script atualiza `assets/data/projects.json` **e** o `index.html` juntos:
```
python python/gerenciar_videos.py listar
python python/gerenciar_videos.py adicionar https://www.tiktok.com/@canal/video/123 --categoria futebol --titulo "Meu short"
python python/gerenciar_videos.py adicionar https://youtu.be/XXXXXXXXXXX --categoria games
python python/gerenciar_videos.py remover 7
python python/gerenciar_videos.py titulos       # busca títulos reais na internet
```
Categorias: `games`, `futebol`, `outros`. Sem `--titulo`, o script tenta buscar o título sozinho.
Para mostrar curtidas no card do short, adicione `"likes": "12K"` ao vídeo no JSON e rode `sincronizar`.

## Estrutura
- `index.html` — página (hero, sobre, shorts, YouTube, serviços, processo, contato)
- `assets/css/styles.css` — visual, tema claro/escuro, responsivo, animações
- `assets/js/app.js` — players em modal (TikTok e YouTube), carrossel, busca, filtros, menu mobile, tema
- `assets/data/projects.json` — lista de vídeos
- `assets/img/` — capas reserva e ícone
- `java/PortfolioServer.java` — servidor + API em Java
- `python/servidor.py` — servidor + API em Python
- `python/gerenciar_videos.py` — gerenciador de vídeos

## Publicar na internet
Para hospedagem grátis (GitHub Pages, Netlify, Vercel), envie `index.html` + a pasta `assets/`.
Os servidores Java/Python são opcionais e servem para rodar localmente ou em hospedagem com backend.

## Contato
Instagram: https://www.instagram.com/kauan.alv3s/ · WhatsApp: https://wa.me/5522996003777
