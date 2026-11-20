package com.researchdirector.shell.secure;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.util.List;
import java.util.Map;

import org.junit.Test;

public class MiniJsonTest {

    @Test
    public void roundTripsNestedValues() throws Exception {
        String json = "{\"a\":1,\"b\":[true,false,null],\"c\":{\"d\":\"e\\nf\"},\"g\":-2.5}";
        Object parsed = MiniJson.parse(json);
        Map<String, Object> obj = MiniJson.asObject(parsed);
        assertEquals(1L, MiniJson.asLong(obj.get("a")));
        List<Object> b = MiniJson.asArray(obj.get("b"));
        assertEquals(Boolean.TRUE, b.get(0));
        assertEquals(Boolean.FALSE, b.get(1));
        assertEquals(null, b.get(2));
        assertEquals("e\nf", MiniJson.asString(MiniJson.path(obj, "c", "d")));
        assertEquals(-2.5, ((Number) obj.get("g")).doubleValue(), 0.0001);

        // stringify(parse(x)) parses to an equal structure
        Object reparsed = MiniJson.parse(MiniJson.stringify(parsed));
        assertEquals(MiniJson.stringify(parsed), MiniJson.stringify(reparsed));
    }

    @Test
    public void parsesOpenAiShapedResponse() throws Exception {
        String body =
                "{\"choices\":[{\"message\":{\"role\":\"assistant\",\"content\":\"hello\"}}],"
                        + "\"model\":\"gpt-x\",\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":5}}";
        Object root = MiniJson.parse(body);
        List<Object> choices = MiniJson.asArray(MiniJson.path(root, "choices"));
        assertEquals("hello", MiniJson.asString(MiniJson.path(choices.get(0), "message", "content")));
        assertEquals(3L, MiniJson.asLong(MiniJson.path(root, "usage", "prompt_tokens")));
        assertEquals(5L, MiniJson.asLong(MiniJson.path(root, "usage", "completion_tokens")));
    }

    @Test
    public void parsesAnthropicShapedResponse() throws Exception {
        String body =
                "{\"model\":\"claude-x\",\"content\":[{\"type\":\"text\",\"text\":\"hi\"}],"
                        + "\"usage\":{\"input_tokens\":4,\"output_tokens\":2}}";
        Object root = MiniJson.parse(body);
        List<Object> content = MiniJson.asArray(MiniJson.path(root, "content"));
        assertEquals("hi", MiniJson.asString(MiniJson.path(content.get(0), "text")));
        assertEquals(4L, MiniJson.asLong(MiniJson.path(root, "usage", "input_tokens")));
    }

    @Test
    public void escapesControlCharactersWhenWriting() throws Exception {
        String s = "a\"b\\c\nd\tef";
        String written = MiniJson.stringify(s);
        assertEquals(s, MiniJson.asString(MiniJson.parse(written)));
    }

    @Test
    public void rejectsMalformedInput() {
        for (String bad : new String[] {"", "{", "[1,", "{\"a\":}", "nul", "truex", "{\"a\":1}x"}) {
            try {
                MiniJson.parse(bad);
                fail("should reject: " + bad);
            } catch (MiniJson.ParseException expected) {
                // ok
            }
        }
    }

    @Test
    public void pathReturnsNullOnMissingKeys() throws Exception {
        Object root = MiniJson.parse("{\"a\":{\"b\":1}}");
        assertTrue(MiniJson.path(root, "a", "zzz") == null);
        assertTrue(MiniJson.path(root, "zzz") == null);
    }
}
