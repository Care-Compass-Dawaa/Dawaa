package com.dawaa.common;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class PasswordHasher {
  private static final String SALT = "dawaa_salt_2024";

  private PasswordHasher() {}

  public static String hash(String password) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] bytes =
          digest.digest(
              ((password == null ? "" : password) + SALT).getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(bytes);
    } catch (NoSuchAlgorithmException error) {
      throw new IllegalStateException("SHA-256 not available", error);
    }
  }
}
