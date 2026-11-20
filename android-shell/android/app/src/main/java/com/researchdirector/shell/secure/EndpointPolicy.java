package com.researchdirector.shell.secure;

import java.util.regex.Pattern;

/**
 * Network endpoint policy for provider calls.
 *
 * <p>Pure Java (no android.* imports) so the allowlist is directly unit-testable
 * on the JVM.
 *
 * <p>Policy:
 * <ul>
 *   <li>Exactly two hosts may ever be contacted: {@code api.openai.com} and
 *       {@code api.anthropic.com}. URLs are constructed from these constants —
 *       user input can never influence scheme, host, or port.</li>
 *   <li>HTTPS only. No redirects (enforced in {@link ProviderClient}).</li>
 *   <li>Fixed connect/read timeouts and hard caps on prompt size and
 *       max_tokens so a run cannot silently burn budget.</li>
 *   <li>Model IDs are validated against a strict character whitelist; there is
 *       no hard-coded fake model list — models come from live discovery or an
 *       explicit user-provided ID.</li>
 * </ul>
 */
public final class EndpointPolicy {
    public static final String PROVIDER_OPENAI = "openai";
    public static final String PROVIDER_ANTHROPIC = "anthropic";

    public static final String HOST_OPENAI = "api.openai.com";
    public static final String HOST_ANTHROPIC = "api.anthropic.com";

    public static final int CONNECT_TIMEOUT_MS = 10_000;
    public static final int READ_TIMEOUT_MS = 30_000;

    /** Default output cap per generation call. */
    public static final int DEFAULT_MAX_TOKENS = 512;
    /** Absolute output cap per generation call — never exceeded, user setting or not. */
    public static final int MAX_MAX_TOKENS = 4096;
    /** Prompt size cap (characters) sent to any provider. */
    public static final int MAX_PROMPT_CHARS = 24_000;
    /** Maximum accepted API key length. */
    public static final int MAX_SECRET_CHARS = 512;
    /** Max error body characters ever surfaced to the UI. */
    public static final int MAX_ERROR_CHARS = 240;

    private static final Pattern MODEL_ID = Pattern.compile("[A-Za-z0-9._:/-]{1,128}");

    private EndpointPolicy() {}

    public static final class PolicyException extends Exception {
        public PolicyException(String message) {
            super(message);
        }
    }

    /** Returns the canonical provider id or throws. */
    public static String requireProvider(String provider) throws PolicyException {
        if (PROVIDER_OPENAI.equals(provider) || PROVIDER_ANTHROPIC.equals(provider)) {
            return provider;
        }
        throw new PolicyException("unknown provider (expected \"openai\" or \"anthropic\")");
    }

    /** The single allowed host for a provider. */
    public static String hostFor(String provider) throws PolicyException {
        switch (requireProvider(provider)) {
            case PROVIDER_OPENAI:
                return HOST_OPENAI;
            case PROVIDER_ANTHROPIC:
                return HOST_ANTHROPIC;
            default:
                throw new PolicyException("unknown provider");
        }
    }

    /** Exact-match host allowlist. Subdomains and lookalikes are rejected. */
    public static boolean isAllowedHost(String host) {
        if (host == null) {
            return false;
        }
        String h = host.trim().toLowerCase();
        return h.equals(HOST_OPENAI) || h.equals(HOST_ANTHROPIC);
    }

    /** Live model-discovery endpoint (used by connection tests and model lists). */
    public static String modelsUrl(String provider) throws PolicyException {
        return "https://" + hostFor(provider) + "/v1/models";
    }

    /** Text-generation endpoint. */
    public static String generateUrl(String provider) throws PolicyException {
        switch (requireProvider(provider)) {
            case PROVIDER_OPENAI:
                return "https://" + HOST_OPENAI + "/v1/chat/completions";
            case PROVIDER_ANTHROPIC:
                return "https://" + HOST_ANTHROPIC + "/v1/messages";
            default:
                throw new PolicyException("unknown provider");
        }
    }

    /** Clamps a requested max_tokens into (0, MAX_MAX_TOKENS]; non-positive -> default. */
    public static int clampMaxTokens(int requested) {
        if (requested <= 0) {
            return DEFAULT_MAX_TOKENS;
        }
        return Math.min(requested, MAX_MAX_TOKENS);
    }

    /** Validates an explicit/discovered model id. Never returns a fake default. */
    public static String requireModelId(String model) throws PolicyException {
        if (model == null) {
            throw new PolicyException("a model id is required");
        }
        String m = model.trim();
        if (!MODEL_ID.matcher(m).matches()) {
            throw new PolicyException("invalid model id");
        }
        return m;
    }

    /** Validates/normalizes a prompt within the size cap. */
    public static String requirePrompt(String prompt) throws PolicyException {
        if (prompt == null || prompt.trim().isEmpty()) {
            throw new PolicyException("prompt must not be empty");
        }
        String p = prompt.trim();
        if (p.length() > MAX_PROMPT_CHARS) {
            throw new PolicyException("prompt exceeds " + MAX_PROMPT_CHARS + " characters");
        }
        return p;
    }

    private static final Pattern SECRETISH = Pattern.compile(
            "(sk-[A-Za-z0-9_\\-]{6,}|Bearer\\s+\\S+|x-api-key[\"']?\\s*[:=]\\s*\\S+)",
            Pattern.CASE_INSENSITIVE);

    /**
     * Redacts a provider error message before it can reach the UI, logs, or the
     * WebView: removes the caller's actual API key (if present), common key
     * shapes (sk-…, Bearer …, x-api-key: …), then truncates.
     */
    public static String redact(String message, char[] secret) {
        if (message == null) {
            return "request failed";
        }
        String out = message;
        if (secret != null && secret.length > 0) {
            String s = new String(secret);
            out = out.replace(s, "[redacted]");
        }
        out = SECRETISH.matcher(out).replaceAll("[redacted]");
        out = out.replaceAll("\\s+", " ").trim();
        if (out.length() > MAX_ERROR_CHARS) {
            out = out.substring(0, MAX_ERROR_CHARS) + "…";
        }
        if (out.isEmpty()) {
            out = "request failed";
        }
        return out;
    }
}
