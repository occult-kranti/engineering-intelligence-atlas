package com.researchdirector.shell.secure;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.SecureRandom;
import java.util.Arrays;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Android Keystore-backed storage for provider API secrets.
 *
 * <p>Design:
 * <ul>
 *   <li>A single AES-256/GCM key lives in the Android Keystore
 *       ({@code AndroidKeyStore} provider). The key material is non-exportable;
 *       it never leaves the hardware/TEE-backed keystore.</li>
 *   <li>Only the GCM ciphertext (IV || ciphertext || tag, Base64) is written,
 *       to an app-private SharedPreferences file. Plaintext secrets are never
 *       persisted anywhere.</li>
 *   <li>Fail closed: any keystore/cipher error while reading or writing a
 *       secret deletes the stored ciphertext and raises
 *       {@link KeystoreException}. There is no plaintext or "less secure"
 *       fallback path.</li>
 *   <li>Secrets are handled as {@code char[]} and zeroed after use. Nothing in
 *       this class logs; callers must never log secrets either.</li>
 * </ul>
 *
 * <p>Documented limitations (also in the app README): the wrapping key is not
 * bound to the device lock screen (no user-authentication requirement), so a
 * passphrase is not requested at unlock; on a rooted device or with a
 * compromised OS/keystore, ciphertexts in app-private storage may be
 * decryptable by an attacker. Device lock + full-disk encryption remain the
 * primary protection.
 */
public final class SecretStore {
    private static final String KEYSTORE_PROVIDER = "AndroidKeyStore";
    private static final String KEY_ALIAS = "research-director/secret-wrapping-key";
    private static final String PREFS_NAME = "research-director.secure-secrets";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;

    /** Raised on any keystore/cipher failure; the store fails closed. */
    public static final class KeystoreException extends Exception {
        public KeystoreException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    private final SharedPreferences prefs;

    public SecretStore(Context context) {
        // MODE_PRIVATE: file is readable only by this app's uid.
        this.prefs = context.getApplicationContext()
                .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String prefKey(String provider) {
        return "secret." + provider;
    }

    /** True when a ciphertext for the provider exists (boolean only, never the secret). */
    public boolean isConfigured(String provider) {
        return prefs.contains(prefKey(provider));
    }

    /** Encrypts and stores a secret. Any failure wipes the entry and throws. */
    public void setSecret(String provider, char[] secret) throws KeystoreException {
        if (secret == null || secret.length == 0) {
            throw new IllegalArgumentException("secret must not be empty");
        }
        if (secret.length > EndpointPolicy.MAX_SECRET_CHARS) {
            throw new IllegalArgumentException("secret is too long");
        }
        byte[] plain = null;
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, requireKey());
            byte[] iv = cipher.getIV();
            plain = toBytes(secret);
            byte[] ciphertext = cipher.doFinal(plain);
            byte[] blob = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, blob, 0, iv.length);
            System.arraycopy(ciphertext, 0, blob, iv.length, ciphertext.length);
            // commit (not apply) so a configured state is durable before we report it.
            prefs.edit()
                    .putString(prefKey(provider), Base64.encodeToString(blob, Base64.NO_WRAP))
                    .commit();
            Arrays.fill(blob, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
        } catch (Exception e) {
            // Fail closed: never leave a possibly-corrupt entry behind.
            prefs.edit().remove(prefKey(provider)).commit();
            throw new KeystoreException("secure storage is unavailable; the secret was not saved", e);
        } finally {
            if (plain != null) {
                Arrays.fill(plain, (byte) 0);
            }
        }
    }

    /**
     * Decrypts the stored secret for immediate native use (provider HTTPS call).
     * Never expose the return value to the WebView, logs, or plugin results.
     */
    public char[] getSecret(String provider) throws KeystoreException {
        String encoded = prefs.getString(prefKey(provider), null);
        if (encoded == null) {
            throw new KeystoreException("no secret stored for provider " + provider, null);
        }
        byte[] plain = null;
        try {
            byte[] blob = Base64.decode(encoded, Base64.NO_WRAP);
            if (blob.length <= 12) {
                throw new IllegalStateException("corrupt ciphertext");
            }
            byte[] iv = Arrays.copyOfRange(blob, 0, 12);
            byte[] ciphertext = Arrays.copyOfRange(blob, 12, blob.length);
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, requireKey(), new GCMParameterSpec(GCM_TAG_BITS, iv));
            plain = cipher.doFinal(ciphertext);
            Arrays.fill(blob, (byte) 0);
            Arrays.fill(ciphertext, (byte) 0);
            return toChars(plain);
        } catch (Exception e) {
            // Fail closed: a ciphertext we cannot decrypt is worse than none.
            prefs.edit().remove(prefKey(provider)).commit();
            throw new KeystoreException("secure storage is unavailable; the stored secret was wiped", e);
        } finally {
            if (plain != null) {
                Arrays.fill(plain, (byte) 0);
            }
        }
    }

    /** Explicitly deletes a provider secret. Returns false if nothing was stored. */
    public boolean deleteSecret(String provider) {
        boolean existed = prefs.contains(prefKey(provider));
        prefs.edit().remove(prefKey(provider)).commit();
        return existed;
    }

    private static SecretKey requireKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE_PROVIDER);
        keyStore.load(null);
        SecretKey existing = (SecretKey) keyStore.getKey(KEY_ALIAS, null);
        if (existing != null) {
            return existing;
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE_PROVIDER);
        generator.init(new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }

    private static byte[] toBytes(char[] chars) {
        ByteBuffer bb = StandardCharsets.UTF_8.encode(CharBuffer.wrap(chars));
        byte[] bytes = new byte[bb.remaining()];
        bb.get(bytes);
        Arrays.fill(bb.array(), (byte) 0);
        return bytes;
    }

    private static char[] toChars(byte[] bytes) {
        CharBuffer cb = StandardCharsets.UTF_8.decode(ByteBuffer.wrap(bytes));
        char[] chars = new char[cb.remaining()];
        cb.get(chars);
        return chars;
    }
}
