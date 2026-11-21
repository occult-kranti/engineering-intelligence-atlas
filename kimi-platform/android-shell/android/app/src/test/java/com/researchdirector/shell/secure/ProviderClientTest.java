package com.researchdirector.shell.secure;

import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

/**
 * Validation-only tests for {@link ProviderClient}. No network is used: every
 * call here must fail before any socket is opened, and no real keys exist.
 */
public class ProviderClientTest {

    private final ProviderClient client = new ProviderClient();
    private final char[] fakeKey = "not-a-real-key".toCharArray();

    @Test
    public void generateRejectsUnknownProviderBeforeAnyNetwork() {
        try {
            client.generate("evil-host.example", "m", "hi", 100, fakeKey);
            fail("should reject unknown provider");
        } catch (ProviderClient.ProviderException e) {
            assertTrue(e.getMessage().contains("provider"));
        }
    }

    @Test
    public void generateRejectsInvalidModelBeforeAnyNetwork() {
        try {
            client.generate("openai", "bad model!", "hi", 100, fakeKey);
            fail("should reject invalid model");
        } catch (ProviderClient.ProviderException e) {
            // ok — rejected locally
        }
    }

    @Test
    public void generateRejectsEmptyAndOversizedPromptsBeforeAnyNetwork() {
        try {
            client.generate("openai", "gpt-x", "   ", 100, fakeKey);
            fail("should reject empty prompt");
        } catch (ProviderClient.ProviderException e) {
            // ok
        }
        StringBuilder huge = new StringBuilder();
        for (int i = 0; i < EndpointPolicy.MAX_PROMPT_CHARS + 1; i++) {
            huge.append('x');
        }
        try {
            client.generate("anthropic", "claude-x", huge.toString(), 100, fakeKey);
            fail("should reject oversized prompt");
        } catch (ProviderClient.ProviderException e) {
            // ok
        }
    }

    @Test
    public void listModelsRejectsUnknownProviderBeforeAnyNetwork() {
        try {
            client.listModels("attacker.example", fakeKey);
            fail("should reject unknown provider");
        } catch (ProviderClient.ProviderException e) {
            // ok
        }
    }
}
