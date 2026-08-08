package com.dawaa.domain.user;

public record User(
    String id,
    String email,
    String name,
    UserRole role,
    String passwordHash,
    boolean active,
    String createdAt,
    String updatedAt
){}
