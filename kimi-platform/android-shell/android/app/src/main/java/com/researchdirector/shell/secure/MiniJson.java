package com.researchdirector.shell.secure;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Minimal, dependency-free JSON parser/serializer.
 *
 * <p>Pure Java (no android.* imports) so it runs identically in the APK and in
 * local JVM unit tests. Supports objects, arrays, strings, numbers, booleans
 * and null — enough for the OpenAI/Anthropic REST payloads this app sends and
 * parses. It is not a general-purpose JSON library.
 */
public final class MiniJson {
    private MiniJson() {}

    public static final class ParseException extends Exception {
        public ParseException(String message) {
            super(message);
        }
    }

    // ------------------------------------------------------------------
    // Parsing
    // ------------------------------------------------------------------

    public static Object parse(String text) throws ParseException {
        if (text == null) {
            throw new ParseException("null input");
        }
        Parser p = new Parser(text);
        p.skipWhitespace();
        Object value = p.parseValue();
        p.skipWhitespace();
        if (!p.atEnd()) {
            throw new ParseException("trailing characters at offset " + p.pos);
        }
        return value;
    }

    private static final class Parser {
        final String s;
        int pos;

        Parser(String s) {
            this.s = s;
        }

        boolean atEnd() {
            return pos >= s.length();
        }

        void skipWhitespace() {
            while (pos < s.length()) {
                char c = s.charAt(pos);
                if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                    pos++;
                } else {
                    break;
                }
            }
        }

        char expect(char c) throws ParseException {
            if (atEnd() || s.charAt(pos) != c) {
                throw new ParseException("expected '" + c + "' at offset " + pos);
            }
            return s.charAt(pos++);
        }

        Object parseValue() throws ParseException {
            skipWhitespace();
            if (atEnd()) {
                throw new ParseException("unexpected end of input");
            }
            char c = s.charAt(pos);
            switch (c) {
                case '{':
                    return parseObject();
                case '[':
                    return parseArray();
                case '"':
                    return parseString();
                case 't':
                    expectLiteral("true");
                    return Boolean.TRUE;
                case 'f':
                    expectLiteral("false");
                    return Boolean.FALSE;
                case 'n':
                    expectLiteral("null");
                    return null;
                default:
                    if (c == '-' || (c >= '0' && c <= '9')) {
                        return parseNumber();
                    }
                    throw new ParseException("unexpected character '" + c + "' at offset " + pos);
            }
        }

        void expectLiteral(String literal) throws ParseException {
            if (!s.startsWith(literal, pos)) {
                throw new ParseException("invalid literal at offset " + pos);
            }
            pos += literal.length();
        }

        Map<String, Object> parseObject() throws ParseException {
            expect('{');
            Map<String, Object> map = new LinkedHashMap<>();
            skipWhitespace();
            if (!atEnd() && s.charAt(pos) == '}') {
                pos++;
                return map;
            }
            while (true) {
                skipWhitespace();
                String key = parseString();
                skipWhitespace();
                expect(':');
                Object value = parseValue();
                map.put(key, value);
                skipWhitespace();
                if (atEnd()) {
                    throw new ParseException("unterminated object");
                }
                char c = s.charAt(pos++); // ',' or '}'
                if (c == '}') {
                    return map;
                }
                if (c != ',') {
                    throw new ParseException("expected ',' or '}' in object at offset " + pos);
                }
            }
        }

        List<Object> parseArray() throws ParseException {
            expect('[');
            List<Object> list = new ArrayList<>();
            skipWhitespace();
            if (!atEnd() && s.charAt(pos) == ']') {
                pos++;
                return list;
            }
            while (true) {
                list.add(parseValue());
                skipWhitespace();
                if (atEnd()) {
                    throw new ParseException("unterminated array");
                }
                char c = s.charAt(pos++);
                if (c == ']') {
                    return list;
                }
                if (c != ',') {
                    throw new ParseException("expected ',' or ']' in array at offset " + pos);
                }
            }
        }

        String parseString() throws ParseException {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (true) {
                if (atEnd()) {
                    throw new ParseException("unterminated string");
                }
                char c = s.charAt(pos++);
                if (c == '"') {
                    return sb.toString();
                }
                if (c == '\\') {
                    if (atEnd()) {
                        throw new ParseException("unterminated escape");
                    }
                    char esc = s.charAt(pos++);
                    switch (esc) {
                        case '"':
                            sb.append('"');
                            break;
                        case '\\':
                            sb.append('\\');
                            break;
                        case '/':
                            sb.append('/');
                            break;
                        case 'b':
                            sb.append('\b');
                            break;
                        case 'f':
                            sb.append('\f');
                            break;
                        case 'n':
                            sb.append('\n');
                            break;
                        case 'r':
                            sb.append('\r');
                            break;
                        case 't':
                            sb.append('\t');
                            break;
                        case 'u':
                            if (pos + 4 > s.length()) {
                                throw new ParseException("bad \\u escape at offset " + pos);
                            }
                            sb.append((char) Integer.parseInt(s.substring(pos, pos + 4), 16));
                            pos += 4;
                            break;
                        default:
                            throw new ParseException("bad escape '\\" + esc + "' at offset " + pos);
                    }
                } else {
                    sb.append(c);
                }
            }
        }

        Number parseNumber() throws ParseException {
            int start = pos;
            if (!atEnd() && s.charAt(pos) == '-') {
                pos++;
            }
            while (!atEnd()) {
                char c = s.charAt(pos);
                if ((c >= '0' && c <= '9') || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-') {
                    pos++;
                } else {
                    break;
                }
            }
            String num = s.substring(start, pos);
            try {
                if (num.indexOf('.') < 0 && num.indexOf('e') < 0 && num.indexOf('E') < 0) {
                    return Long.parseLong(num);
                }
                return Double.parseDouble(num);
            } catch (NumberFormatException e) {
                throw new ParseException("bad number '" + num + "' at offset " + start);
            }
        }
    }

    // ------------------------------------------------------------------
    // Typed accessors (throw ParseException on type mismatch)
    // ------------------------------------------------------------------

    @SuppressWarnings("unchecked")
    public static Map<String, Object> asObject(Object value) throws ParseException {
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        throw new ParseException("expected object");
    }

    @SuppressWarnings("unchecked")
    public static List<Object> asArray(Object value) throws ParseException {
        if (value instanceof List) {
            return (List<Object>) value;
        }
        throw new ParseException("expected array");
    }

    public static String asString(Object value) throws ParseException {
        if (value instanceof String) {
            return (String) value;
        }
        throw new ParseException("expected string");
    }

    public static long asLong(Object value) throws ParseException {
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        throw new ParseException("expected number");
    }

    /** Convenience: navigate obj.get(k1).get(k2)... returning null if absent. */
    public static Object path(Object value, String... keys) {
        Object current = value;
        for (String key : keys) {
            if (!(current instanceof Map)) {
                return null;
            }
            current = ((Map<?, ?>) current).get(key);
        }
        return current;
    }

    // ------------------------------------------------------------------
    // Serialization
    // ------------------------------------------------------------------

    public static String stringify(Object value) {
        StringBuilder sb = new StringBuilder();
        write(value, sb);
        return sb.toString();
    }

    private static void write(Object value, StringBuilder sb) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof String) {
            writeString((String) value, sb);
        } else if (value instanceof Number || value instanceof Boolean) {
            sb.append(value.toString());
        } else if (value instanceof Map) {
            sb.append('{');
            boolean first = true;
            for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                writeString(String.valueOf(entry.getKey()), sb);
                sb.append(':');
                write(entry.getValue(), sb);
            }
            sb.append('}');
        } else if (value instanceof List) {
            sb.append('[');
            boolean first = true;
            for (Object item : (List<?>) value) {
                if (!first) {
                    sb.append(',');
                }
                first = false;
                write(item, sb);
            }
            sb.append(']');
        } else {
            throw new IllegalArgumentException("cannot serialize " + value.getClass());
        }
    }

    private static void writeString(String s, StringBuilder sb) {
        sb.append('"');
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '"':
                    sb.append("\\\"");
                    break;
                case '\\':
                    sb.append("\\\\");
                    break;
                case '\n':
                    sb.append("\\n");
                    break;
                case '\r':
                    sb.append("\\r");
                    break;
                case '\t':
                    sb.append("\\t");
                    break;
                case '\b':
                    sb.append("\\b");
                    break;
                case '\f':
                    sb.append("\\f");
                    break;
                default:
                    if (c < 0x20) {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
            }
        }
        sb.append('"');
    }
}
