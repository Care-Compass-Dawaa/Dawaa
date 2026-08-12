package com.dawaa.domain.user;

public record User(
    String userId,
    String email,
    String name,
    UserRole role,
    String passwordHash,
    boolean active,
    String createdAt,
    String updatedAt
){}
