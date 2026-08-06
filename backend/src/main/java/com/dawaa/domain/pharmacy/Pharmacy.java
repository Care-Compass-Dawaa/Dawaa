package com.dawaa.domain.pharmacy;

public record Pharmacy(
    String pharmacyId,
    String pharmacistId,
    String name,
    String address,
    String area,
    String district,
    String phone,
    String email,
    double latitude,
    double longitude,
    boolean approved,
    boolean active,
    String createdAt,
    String updatedAt) {}
