package com.dawaa.domain.inventory;

import java.util.List;
import java.util.Optional;

public interface InventoryRepository {
  List<InventoryItem> findByPharmacyId(String pharmacyId);

  Optional<InventoryItem> findByPharmacyIdAndMedicineId(String pharmacyId, String medicineId);

  InventoryItem save(InventoryItem item);

  void delete(String pharmacyId, String medicineId);
}
