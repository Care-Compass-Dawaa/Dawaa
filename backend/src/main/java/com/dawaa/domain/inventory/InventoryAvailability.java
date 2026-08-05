package com.dawaa.domain.inventory;

public record InventoryAvailability(
    String pharmacyId,
    String medicineId,
    String availableMedicineId,
    String availableLocationKey,
    int quantity,
    boolean inStock,
    String updatedAt,
    long version) {}
