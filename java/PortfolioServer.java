import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.awt.Desktop;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPOutputStream;

/**
 * Servidor do portfólio do Kauan — Java puro, sem dependências (JDK 17+).
 *
 * Rotas:
 *   /                       site estático (index.html, assets/)
 *   /api/projects           todos os vídeos (assets/data/projects.json)
 *   /api/projects?platform=tiktok|youtube   filtra por plataforma
 *   /api/health             status do servidor
 *   /api/stats              contagem de vídeos e requisições
 *
 * Executar a partir da raiz do site:  java java/PortfolioServer.java [porta]
 */
public class PortfolioServer {

    private static final Map<String, String> TYPES = Map.ofEntries(
        Map.entry("html", "text/html; charset=UTF-8"),
        Map.entry("css", "text/css; charset=UTF-8"),
        Map.entry("js", "text/javascript; charset=UTF-8"),
        Map.entry("json", "application/json; charset=UTF-8"),
        Map.entry("svg", "image/svg+xml"),
        Map.entry("png", "image/png"),
        Map.entry("jpg", "image/jpeg"),
        Map.entry("jpeg", "image/jpeg"),
        Map.entry("webp", "image/webp"),
        Map.entry("gif", "image/gif"),
        Map.entry("ico", "image/x-icon"),
        Map.entry("mp4", "video/mp4"),
        Map.entry("webm", "video/webm"),
        Map.entry("woff2", "font/woff2")
    );
    private static final Path ROOT = Path.of(".").toAbsolutePath().normalize();
    private static final Path DATA = ROOT.resolve("assets/data/projects.json");
    private static final AtomicLong REQUESTS = new AtomicLong();
    private static final Instant STARTED = Instant.now();

    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        if (!Files.isRegularFile(ROOT.resolve("index.html"))) {
            System.err.println("Execute este servidor na pasta do site (onde está o index.html).");
            System.exit(1);
        }
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
        server.createContext("/", PortfolioServer::handle);
        server.setExecutor(Executors.newFixedThreadPool(8));
        server.start();

        String url = "http://localhost:" + port;
        System.out.println("==============================================");
        System.out.println("  Portfólio Kauan (servidor Java) no ar");
        System.out.println("  Site:  " + url);
        System.out.println("  API:   " + url + "/api/projects");
        System.out.println("  Ctrl+C para parar");
        System.out.println("==============================================");
        if (java.util.Arrays.asList(args).contains("--sem-navegador")) return;
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(URI.create(url));
            }
        } catch (Exception ignored) { /* sem navegador disponível: tudo bem */ }
    }

    private static void handle(HttpExchange e) throws IOException {
        REQUESTS.incrementAndGet();
        try {
            var h = e.getResponseHeaders();
            h.set("X-Content-Type-Options", "nosniff");
            h.set("Referrer-Policy", "strict-origin-when-cross-origin");
            h.set("X-Frame-Options", "SAMEORIGIN");

            String method = e.getRequestMethod();
            if (!"GET".equals(method) && !"HEAD".equals(method)) {
                text(e, 405, "Método não permitido");
                return;
            }
            String path = URLDecoder.decode(e.getRequestURI().getRawPath(), StandardCharsets.UTF_8);
            String query = e.getRequestURI().getQuery();

            switch (path) {
                case "/api/health" -> {
                    json(e, 200, "{\"status\":\"ok\",\"site\":\"Kauan\",\"server\":\"java\"}");
                    return;
                }
                case "/api/projects" -> {
                    String all = Files.readString(DATA, StandardCharsets.UTF_8);
                    String platform = param(query, "platform");
                    json(e, 200, platform == null ? all : filterByPlatform(all, platform));
                    return;
                }
                case "/api/stats" -> {
                    String all = Files.readString(DATA, StandardCharsets.UTF_8);
                    Map<String, Object> s = new LinkedHashMap<>();
                    s.put("videos", count(all, "\"videoId\""));
                    s.put("tiktok", count(all, "\"platform\": \"tiktok\""));
                    s.put("youtube", count(all, "\"platform\": \"youtube\""));
                    s.put("requests", REQUESTS.get());
                    s.put("uptimeSeconds", Instant.now().getEpochSecond() - STARTED.getEpochSecond());
                    json(e, 200, toJson(s));
                    return;
                }
                default -> { /* arquivo estático */ }
            }

            if (path.endsWith("/")) path += "index.html";
            if (path.startsWith("/java/") || path.startsWith("/python/")) { text(e, 403, "Acesso negado"); return; }
            Path target = ROOT.resolve(path.substring(1)).normalize();
            if (!target.startsWith(ROOT) || !Files.isRegularFile(target)) { text(e, 404, "Arquivo não encontrado"); return; }

            String name = target.getFileName().toString();
            String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
            String type = TYPES.get(ext);
            if (type == null) { text(e, 403, "Tipo de arquivo não permitido"); return; }

            boolean compress = type.startsWith("text/") || type.startsWith("application/json") || ext.equals("svg");
            respond(e, 200, type, Files.readAllBytes(target), compress);
        } catch (Exception ex) {
            text(e, 500, "Erro interno");
        } finally {
            e.close();
        }
    }

    /** Filtra o array JSON por plataforma sem bibliotecas: separa os objetos de primeiro nível. */
    private static String filterByPlatform(String jsonArray, String platform) {
        StringBuilder out = new StringBuilder("[");
        int depth = 0, start = -1;
        boolean inStr = false, first = true;
        for (int i = 0; i < jsonArray.length(); i++) {
            char c = jsonArray.charAt(i);
            if (inStr) { if (c == '\\') i++; else if (c == '"') inStr = false; continue; }
            if (c == '"') inStr = true;
            else if (c == '{') { if (depth++ == 0) start = i; }
            else if (c == '}' && --depth == 0) {
                String obj = jsonArray.substring(start, i + 1);
                Matcher m = Pattern.compile("\"platform\"\\s*:\\s*\"([^\"]+)\"").matcher(obj);
                if (m.find() && m.group(1).equalsIgnoreCase(platform)) {
                    if (!first) out.append(',');
                    out.append(obj);
                    first = false;
                }
            }
        }
        return out.append(']').toString();
    }

    private static int count(String s, String needle) {
        int n = 0, i = 0;
        String compact = s.replaceAll("\"\\s*:\\s*\"", "\": \"");
        while ((i = compact.indexOf(needle, i)) >= 0) { n++; i += needle.length(); }
        return n;
    }

    private static String param(String query, String key) {
        if (query == null) return null;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv[0].equals(key) && kv.length == 2) return URLDecoder.decode(kv[1], StandardCharsets.UTF_8);
        }
        return null;
    }

    private static String toJson(Map<String, Object> map) {
        StringBuilder sb = new StringBuilder("{");
        map.forEach((k, v) -> sb.append(sb.length() > 1 ? "," : "").append('"').append(k).append("\":").append(v));
        return sb.append('}').toString();
    }

    private static void json(HttpExchange e, int status, String body) throws IOException {
        respond(e, status, TYPES.get("json"), body.getBytes(StandardCharsets.UTF_8), true);
    }

    private static void text(HttpExchange e, int status, String body) throws IOException {
        respond(e, status, "text/plain; charset=UTF-8", body.getBytes(StandardCharsets.UTF_8), false);
    }

    private static void respond(HttpExchange e, int status, String type, byte[] data, boolean compress) throws IOException {
        var h = e.getResponseHeaders();
        h.set("Content-Type", type);
        h.set("Cache-Control", "no-cache");
        String accept = e.getRequestHeaders().getFirst("Accept-Encoding");
        if (compress && accept != null && accept.contains("gzip") && data.length > 512) {
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            try (GZIPOutputStream gz = new GZIPOutputStream(buf)) { gz.write(data); }
            data = buf.toByteArray();
            h.set("Content-Encoding", "gzip");
            h.set("Vary", "Accept-Encoding");
        }
        if ("HEAD".equals(e.getRequestMethod())) {
            h.set("Content-Length", String.valueOf(data.length));
            e.sendResponseHeaders(status, -1);
            return;
        }
        e.sendResponseHeaders(status, data.length);
        try (OutputStream out = e.getResponseBody()) { out.write(data); }
    }
}
