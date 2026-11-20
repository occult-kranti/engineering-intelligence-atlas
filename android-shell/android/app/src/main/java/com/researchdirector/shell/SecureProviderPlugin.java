package com.researchdirector.shell;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.researchdirector.shell.secure.EndpointPolicy;
import com.researchdirector.shell.secure.ProviderClient;
import com.researchdirector.shell.secure.SecretStore;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * SecureProvider — custom native Capacitor plugin.
 *
 * <p>Contract with the WebView:
 * <ul>
 *   <li>{@code setSecret({provider, secret})} receives the API key exactly once
 *       (from a password input), encrypts it via Android Keystore AES/GCM, and
 *       resolves with {@code {configured: true}} only. The secret is never
 *       echoed back, logged, emitted in an event, or written anywhere as
 *       plaintext.</li>
 *   <li>{@code hasSecret} / {@code deleteSecret} expose booleans only.</li>
 *   <li>{@code testConnection} / {@code listModels} / {@code generate} run the
 *       HTTPS call natively with the stored key; the key never enters the
 *       WebView. Results contain model IDs, generated text, and token usage —
 *       never credentials.</li>
 * </ul>
 *
 * <p>Only api.openai.com and api.anthropic.com are reachable (see
 * {@code EndpointPolicy}); redirects are refused; no automatic retries.
 */
@CapacitorPlugin(name = "SecureProvider")
public class SecureProviderPlugin extends Plugin {
    private SecretStore secretStore;
    private final ProviderClient client = new ProviderClient();
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void load() {
        secretStore = new SecretStore(getContext());
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdownNow();
    }

    @PluginMethod
    public void setSecret(PluginCall call) {
        String provider;
        try {
            provider = EndpointPolicy.requireProvider(call.getString("provider"));
        } catch (EndpointPolicy.PolicyException e) {
            call.reject(e.getMessage(), "INVALID_PROVIDER");
            return;
        }
        String secret = call.getString("secret");
        if (secret == null || secret.trim().isEmpty()) {
            call.reject("secret must not be empty", "INVALID_SECRET");
            return;
        }
        char[] chars = secret.toCharArray();
        try {
            secretStore.setSecret(provider, chars);
            JSObject ret = new JSObject();
            ret.put("configured", true);
            call.resolve(ret);
        } catch (SecretStore.KeystoreException e) {
            // Message is generic and contains no key material.
            call.reject(e.getMessage(), "KEYSTORE_UNAVAILABLE");
        } catch (IllegalArgumentException e) {
            call.reject(e.getMessage(), "INVALID_SECRET");
        } finally {
            Arrays.fill(chars, '\0');
            // Intentionally no logging: the secret must never reach logcat.
        }
    }

    @PluginMethod
    public void hasSecret(PluginCall call) {
        String provider;
        try {
            provider = EndpointPolicy.requireProvider(call.getString("provider"));
        } catch (EndpointPolicy.PolicyException e) {
            call.reject(e.getMessage(), "INVALID_PROVIDER");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("configured", secretStore.isConfigured(provider));
        call.resolve(ret);
    }

    @PluginMethod
    public void deleteSecret(PluginCall call) {
        String provider;
        try {
            provider = EndpointPolicy.requireProvider(call.getString("provider"));
        } catch (EndpointPolicy.PolicyException e) {
            call.reject(e.getMessage(), "INVALID_PROVIDER");
            return;
        }
        boolean existed = secretStore.deleteSecret(provider);
        JSObject ret = new JSObject();
        ret.put("configured", false);
        ret.put("deleted", existed);
        call.resolve(ret);
    }

    /** Connection test = live model discovery with the stored key. */
    @PluginMethod
    public void testConnection(PluginCall call) {
        final String provider;
        try {
            provider = EndpointPolicy.requireProvider(call.getString("provider"));
        } catch (EndpointPolicy.PolicyException e) {
            call.reject(e.getMessage(), "INVALID_PROVIDER");
            return;
        }
        executor.execute(() -> {
            char[] secret = null;
            try {
                secret = secretStore.getSecret(provider);
                List<String> models = client.listModels(provider, secret);
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("provider", provider);
                ret.put("modelCount", models.size());
                call.resolve(ret);
            } catch (SecretStore.KeystoreException e) {
                call.reject(e.getMessage(), "NO_SECRET");
            } catch (ProviderClient.ProviderException e) {
                // Message already redacted by the client.
                call.reject(e.getMessage(), "PROVIDER_ERROR");
            } finally {
                if (secret != null) {
                    Arrays.fill(secret, '\0');
                }
            }
        });
    }

    /** Live model discovery; results feed the model pickers (no fake lists). */
    @PluginMethod
    public void listModels(PluginCall call) {
        final String provider;
        try {
            provider = EndpointPolicy.requireProvider(call.getString("provider"));
        } catch (EndpointPolicy.PolicyException e) {
            call.reject(e.getMessage(), "INVALID_PROVIDER");
            return;
        }
        executor.execute(() -> {
            char[] secret = null;
            try {
                secret = secretStore.getSecret(provider);
                List<String> models = client.listModels(provider, secret);
                JSArray modelArray = new JSArray();
                for (String id : models) {
                    modelArray.put(id);
                }
                JSObject ret = new JSObject();
                ret.put("ok", true);
                ret.put("models", modelArray);
                call.resolve(ret);
            } catch (SecretStore.KeystoreException e) {
                call.reject(e.getMessage(), "NO_SECRET");
            } catch (ProviderClient.ProviderException e) {
                call.reject(e.getMessage(), "PROVIDER_ERROR");
            } finally {
                if (secret != null) {
                    Arrays.fill(secret, '\0');
                }
            }
        });
    }

    /**
     * Text generation. Model IDs come from the user (via live discovery or an
     * explicit setting); maxTokens is hard-capped natively.
     */
    @PluginMethod
    public void generate(PluginCall call) {
        final String provider;
        final String model;
        final String prompt;
        final int maxTokens;
        try {
            provider = EndpointPolicy.requireProvider(call.getString("provider"));
            model = EndpointPolicy.requireModelId(call.getString("model"));
            prompt = EndpointPolicy.requirePrompt(call.getString("prompt"));
            Integer requested = call.getInt("maxTokens");
            maxTokens = EndpointPolicy.clampMaxTokens(requested == null ? 0 : requested);
        } catch (EndpointPolicy.PolicyException e) {
            call.reject(e.getMessage(), "INVALID_ARGUMENT");
            return;
        }
        executor.execute(() -> {
            char[] secret = null;
            try {
                secret = secretStore.getSecret(provider);
                ProviderClient.Generation g = client.generate(provider, model, prompt, maxTokens, secret);
                JSObject ret = new JSObject();
                ret.put("text", g.text);
                ret.put("model", g.model);
                ret.put("inputTokens", g.inputTokens);
                ret.put("outputTokens", g.outputTokens);
                call.resolve(ret);
            } catch (SecretStore.KeystoreException e) {
                call.reject(e.getMessage(), "NO_SECRET");
            } catch (ProviderClient.ProviderException e) {
                call.reject(e.getMessage(), "PROVIDER_ERROR");
            } finally {
                if (secret != null) {
                    Arrays.fill(secret, '\0');
                }
            }
        });
    }
}
