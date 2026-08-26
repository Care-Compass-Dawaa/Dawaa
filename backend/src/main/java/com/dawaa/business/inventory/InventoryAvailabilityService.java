package com.dawaa.business.inventory;

import com.dawaa.domain.inventory.InventoryAvailability;
import com.dawaa.domain.inventory.InventoryAvailabilityRepository;
import java.util.List;
import java.util.Objects;

public class InventoryAvailabilityService {
  private final InventoryAvailabilityRepository inventoryAvailabilityRepository;

  public InventoryAvailabilityService(
      InventoryAvailabilityRepository inventoryAvailabilityRepository) {
    this.inventoryAvailabilityRepository =
        Objects.requireNonNull(
            inventoryAvailabilityRepository, "inventoryAvailabilityRepository is required");
  }

  public List<InventoryAvailability> findAvailableInventoryByMedicineId(String medicineId) {
    String normalizedMedicineId = requireText(medicineId, "medicineId");

    return inventoryAvailabilityRepository.findByMedicineId(normalizedMedicineId).stream()
        .filter(item -> item.quantity() > 0)
        .toList();
  }

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }
}
