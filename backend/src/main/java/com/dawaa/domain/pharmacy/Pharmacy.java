package com.dawaa.domain.pharmacy;

public record Pharmacy(
    String pharmacyId,
    String ownerUserId,
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
    PharmacyHours hours,
    String createdAt,
    String updatedAt) {}
