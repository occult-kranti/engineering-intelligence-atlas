package com.researchdirector.shell.secure;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Direct native HTTPS client for the two supported LLM providers.
 *
 * <p>Guarantees:
 * <ul>
 *   <li>Only {@code https://api.openai.com} and {@code https://api.anthropic.com}
 *       are ever contacted (see {@link EndpointPolicy}); the scheme, host, and
 *       port come from constants, never from user input.</li>
 *   <li>Redirects are disabled and any 3xx is an error — the key can never be
 *       forwarded to another host.</li>
 *   <li>The API key is used only as an HTTP header on the provider connection.
 *       It is never logged, never placed in a URL, and never returned in any
 *       result or error object.</li>
 *   <li>One attempt per call — no automatic retries (retries could double a
 *       billed request). Fixed connect/read timeouts; max_tokens is capped by
 *       {@link EndpointPolicy}.</li>
 *   <li>Provider error bodies are redacted ({@link EndpointPolicy#redact})
 *       before they can reach the UI.</li>
 * </ul>
 *
 * <p>Pure Java: uses {@link HttpURLConnection} and {@link MiniJson} only, so the
 * request/response logic is unit-testable on the JVM against a local stub
 * server (no real provider calls in tests).
 */
public final class ProviderClient {

    /** Error whose message is already redacted and safe to surface. */
    public static final class ProviderException extends Exception {
        public final int status;

        public ProviderException(String redactedMessage, int status) {
            super(redactedMessage);
            this.status = status;
        }
    }

    /** Result of a text-generation call. */
    public static final class Generation {
        public final String text;
        public final String model;
        public final long inputTokens;
        public final long outputTokens;

        Generation(String text, String model, long inputTokens, long outputTokens) {
            this.text = text;
            this.model = model;
            this.inputTokens = inputTokens;
            this.outputTokens = outputTokens;
        }
    }

    private static final int MAX_RESPONSE_BYTES = 1 << 20; // 1 MiB cap

    // ------------------------------------------------------------------
    // Public API (blocking; callers must run off the UI thread)
    // ------------------------------------------------------------------

    /**
     * Live model discovery — also used as the connection test. Returns real
     * model IDs from the provider; never a fake/canned list.
     */
    public List<String> listModels(String provider, char[] secret) throws ProviderException {
        String body = request("GET", checkedUrl(safeModelsUrl(provider)), null, provider, secret);
        try {
            Object root = MiniJson.parse(body);
            List<Object> data = MiniJson.asArray(MiniJson.path(root, "data"));
            List<String> models = new ArrayList<>();
            for (Object item : data) {
                Object id = MiniJson.path(item, "id");
                if (id instanceof String) {
                    models.add((String) id);
                }
            }
            return models;
        } catch (MiniJson.ParseException e) {
            throw new ProviderException("could not parse the model list", -1);
        }
    }

    /** Text generation with one user-turn prompt. */
    public Generation generate(String provider, String model, String prompt, int maxTokens, char[] secret)
            throws ProviderException {
        try {
            model = EndpointPolicy.requireModelId(model);
            prompt = EndpointPolicy.requirePrompt(prompt);
        } catch (EndpointPolicy.PolicyException e) {
            throw new ProviderException(e.getMessage(), -1);
        }
        int cappedTokens = EndpointPolicy.clampMaxTokens(maxTokens);
        String requestBody = buildGenerateBody(provider, model, prompt, cappedTokens);
        String responseBody =
                request("POST", checkedUrl(safeGenerateUrl(provider)), requestBody, provider, secret);
        return parseGeneration(provider, responseBody);
    }

    // ------------------------------------------------------------------
    // Request/response internals
    // ------------------------------------------------------------------

    private static String safeModelsUrl(String provider) throws ProviderException {
        try {
            return EndpointPolicy.modelsUrl(provider);
        } catch (EndpointPolicy.PolicyException e) {
            throw new ProviderException(e.getMessage(), -1);
        }
    }

    private static String safeGenerateUrl(String provider) throws ProviderException {
        try {
            return EndpointPolicy.generateUrl(provider);
        } catch (EndpointPolicy.PolicyException e) {
            throw new ProviderException(e.getMessage(), -1);
        }
    }

    /** Defense in depth: re-validate scheme+host of the final URL object. */
    private static URL checkedUrl(String url) throws ProviderException {
        try {
            URL u = new URL(url);
            if (!"https".equalsIgnoreCase(u.getProtocol()) || !EndpointPolicy.isAllowedHost(u.getHost())) {
                throw new ProviderException("endpoint is not on the provider allowlist", -1);
            }
            return u;
        } catch (java.net.MalformedURLException e) {
            throw new ProviderException("invalid endpoint", -1);
        }
    }

    private String request(String method, URL url, String jsonBody, String provider, char[] secret)
            throws ProviderException {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod(method);
            // Never follow redirects: the API key must not leak to another host.
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(EndpointPolicy.CONNECT_TIMEOUT_MS);
            conn.setReadTimeout(EndpointPolicy.READ_TIMEOUT_MS);
            conn.setRequestProperty("Accept", "application/json");
            setAuthHeader(conn, provider, secret);
            if (jsonBody != null) {
                byte[] body = jsonBody.getBytes(StandardCharsets.UTF_8);
                conn.setDoOutput(true);
                conn.setFixedLengthStreamingMode(body.length);
                conn.setRequestProperty("Content-Type", "application/json");
                try (OutputStream out = conn.getOutputStream()) {
                    out.write(body);
                }
            }
            int status = conn.getResponseCode();
            if (status >= 300 && status < 400) {
                throw new ProviderException("provider attempted a redirect; refused", status);
            }
            if (status >= 400) {
                String err = readLimited(conn.getErrorStream());
                throw new ProviderException(
                        "provider returned HTTP " + status + ": " + EndpointPolicy.redact(err, secret),
                        status);
            }
            return readLimited(conn.getInputStream());
        } catch (ProviderException e) {
            throw e;
        } catch (IOException e) {
            // e.getMessage() can embed the URL (never the key), redact anyway.
            throw new ProviderException(
                    "network error: " + EndpointPolicy.redact(String.valueOf(e.getMessage()), secret), -1);
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    /** Only place the secret is used: an HTTP header on the provider connection. */
    private static void setAuthHeader(HttpURLConnection conn, String provider, char[] secret) {
        if (EndpointPolicy.PROVIDER_OPENAI.equals(provider)) {
            conn.setRequestProperty("Authorization", "Bearer " + new String(secret));
        } else {
            conn.setRequestProperty("x-api-key", new String(secret));
            conn.setRequestProperty("anthropic-version", "2023-06-01");
        }
    }

    private static String readLimited(InputStream in) throws IOException {
        if (in == null) {
            return "";
        }
        try (InputStream stream = in) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int total = 0;
            int n;
            while ((n = stream.read(buf)) != -1) {
                total += n;
                if (total > MAX_RESPONSE_BYTES) {
                    throw new IOException("response too large");
                }
                out.write(buf, 0, n);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }

    private static String buildGenerateBody(String provider, String model, String prompt, int maxTokens) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("role", "user");
        message.put("content", prompt);
        List<Object> messages = new ArrayList<>();
        messages.add(message);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        if (EndpointPolicy.PROVIDER_OPENAI.equals(provider)) {
            body.put("messages", messages);
            body.put("max_tokens", maxTokens);
        } else {
            body.put("max_tokens", maxTokens);
            body.put("messages", messages);
        }
        return MiniJson.stringify(body);
    }

    private static Generation parseGeneration(String provider, String body) throws ProviderException {
        try {
            Object root = MiniJson.parse(body);
            if (EndpointPolicy.PROVIDER_OPENAI.equals(provider)) {
                List<Object> choices = MiniJson.asArray(MiniJson.path(root, "choices"));
                if (choices.isEmpty()) {
                    throw new ProviderException("provider returned no choices", -1);
                }
                String text = MiniJson.asString(MiniJson.path(choices.get(0), "message", "content"));
                Object modelObj = MiniJson.path(root, "model");
                long in = MiniJson.asLong(MiniJson.path(root, "usage", "prompt_tokens"));
                long out = MiniJson.asLong(MiniJson.path(root, "usage", "completion_tokens"));
                return new Generation(text, modelObj instanceof String ? (String) modelObj : "", in, out);
            }
            List<Object> content = MiniJson.asArray(MiniJson.path(root, "content"));
            StringBuilder text = new StringBuilder();
            for (Object block : content) {
                Object t = MiniJson.path(block, "text");
                if (t instanceof String) {
                    text.append((String) t);
                }
            }
            Object modelObj = MiniJson.path(root, "model");
            long in = MiniJson.asLong(MiniJson.path(root, "usage", "input_tokens"));
            long out = MiniJson.asLong(MiniJson.path(root, "usage", "output_tokens"));
            return new Generation(
                    text.toString(), modelObj instanceof String ? (String) modelObj : "", in, out);
        } catch (ProviderException e) {
            throw e;
        } catch (MiniJson.ParseException | NullPointerException e) {
            throw new ProviderException("could not parse the provider response", -1);
        }
    }
}
