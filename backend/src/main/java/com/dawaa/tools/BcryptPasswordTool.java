package com.dawaa.tools;

import org.mindrot.jbcrypt.BCrypt;

//purpose of this is to allow us to generate a valid bycrypt hash from the terminal
public final class BcryptPasswordTool {
  private BcryptPasswordTool() {}

  public static void main(String[] args) {
    if (args.length != 1 || args[0] == null || args[0].isBlank()) {
      throw new IllegalArgumentException("Password is required");
    }
    if (args[0].length() < 8) {
      throw new IllegalArgumentException("Password must be at least 8 characters");
    }

    System.out.print(BCrypt.hashpw(args[0], BCrypt.gensalt(10)));
  }
}
