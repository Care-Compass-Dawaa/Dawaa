package com.dawaa.domain.inventory;

import java.util.List;

public interface InventoryAvailabilityRepository {
  List<InventoryAvailability> findByMedicineId(String medicineId);
}
