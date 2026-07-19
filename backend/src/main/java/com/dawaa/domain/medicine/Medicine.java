package com.dawaa.domain.medicine;

public record Medicine(
    String medicineId,
    String brandName,
    String genericName,
    String strength,
    String dosageForm,
    String manufacturer,
    String normalizedBrandName,
    String normalizedGenericName,
    boolean active,
    String createdAt,
    String updatedAt,
    long version) {}
