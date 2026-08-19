package com.dawaa.domain.inventory;

public record InventoryItem(
    String pharmacyId,
    String medicineId,
    String medicineName,
    String availableMedicineId,
    String availableLocationKey,
    int quantity,
    boolean inStock,
    String createdAt,
    String updatedAt,
    long version) {}
