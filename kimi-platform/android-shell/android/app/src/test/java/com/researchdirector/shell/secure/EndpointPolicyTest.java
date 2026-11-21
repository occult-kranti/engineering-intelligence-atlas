package com.researchdirector.shell.secure;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

public class EndpointPolicyTest {

    @Test
    public void allowlistContainsExactlyTheTwoProviderHosts() {
        assertTrue(EndpointPolicy.isAllowedHost("api.openai.com"));
        assertTrue(EndpointPolicy.isAllowedHost("api.anthropic.com"));
    }

    @Test
    public void allowlistRejectsLookalikesSubdomainsAndArbitraryHosts() {
        assertFalse(EndpointPolicy.isAllowedHost("api.openai.com.evil.example"));
        assertFalse(EndpointPolicy.isAllowedHost("sub.api.openai.com"));
        assertFalse(EndpointPolicy.isAllowedHost("apiopenai.com"));
        assertFalse(EndpointPolicy.isAllowedHost("localhost"));
        assertFalse(EndpointPolicy.isAllowedHost("127.0.0.1"));
        assertFalse(EndpointPolicy.isAllowedHost("example.com"));
        assertFalse(EndpointPolicy.isAllowedHost(null));
        assertFalse(EndpointPolicy.isAllowedHost(""));
    }

    @Test
    public void endpointsAreHttpsOnAllowedHostsOnly() throws Exception {
        assertEquals("https://api.openai.com/v1/models", EndpointPolicy.modelsUrl("openai"));
        assertEquals("https://api.anthropic.com/v1/models", EndpointPolicy.modelsUrl("anthropic"));
        assertEquals(
                "https://api.openai.com/v1/chat/completions", EndpointPolicy.generateUrl("openai"));
        assertEquals("https://api.anthropic.com/v1/messages", EndpointPolicy.generateUrl("anthropic"));
    }

    @Test
    public void unknownProvidersAreRejected() {
        for (String bad : new String[] {"", "OPENAI", "openai ", "azure", "localhost", null}) {
            try {
                EndpointPolicy.requireProvider(bad);
                fail("should reject provider: " + bad);
            } catch (EndpointPolicy.PolicyException expected) {
                // ok
            }
        }
    }

    @Test
    public void maxTokensAreCapped() {
        assertEquals(EndpointPolicy.DEFAULT_MAX_TOKENS, EndpointPolicy.clampMaxTokens(0));
        assertEquals(EndpointPolicy.DEFAULT_MAX_TOKENS, EndpointPolicy.clampMaxTokens(-5));
        assertEquals(100, EndpointPolicy.clampMaxTokens(100));
        assertEquals(EndpointPolicy.MAX_MAX_TOKENS, EndpointPolicy.clampMaxTokens(999_999));
    }

    @Test
    public void modelIdsAreValidatedNotFaked() throws Exception {
        assertEquals("gpt-4o-mini", EndpointPolicy.requireModelId(" gpt-4o-mini "));
        for (String bad : new String[] {"", "  ", "bad model!", "m\nmodel", null}) {
            try {
                EndpointPolicy.requireModelId(bad);
                fail("should reject model: " + bad);
            } catch (EndpointPolicy.PolicyException expected) {
                // ok
            }
        }
    }

    @Test
    public void redactionRemovesKeysAndTruncates() {
        char[] secret = "sk-test-ABCDEF123456".toCharArray();
        String msg = "401 unauthorized for key sk-test-ABCDEF123456 with Bearer abc.def.ghi";
        String redacted = EndpointPolicy.redact(msg, secret);
        assertFalse(redacted.contains("sk-test-ABCDEF123456"));
        assertFalse(redacted.contains("abc.def.ghi"));
        assertTrue(redacted.contains("[redacted]"));

        StringBuilder longMsg = new StringBuilder();
        for (int i = 0; i < 1000; i++) {
            longMsg.append('x');
        }
        assertTrue(
                EndpointPolicy.redact(longMsg.toString(), secret).length()
                        <= EndpointPolicy.MAX_ERROR_CHARS + 1);
    }
}
