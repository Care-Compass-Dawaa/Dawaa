package com.dawaa.business.inventory;

import com.dawaa.business.medicine.MedicineService;
import com.dawaa.domain.inventory.InventoryItem;
import com.dawaa.domain.inventory.InventoryRepository;
import com.dawaa.domain.medicine.Medicine;
import com.dawaa.domain.medicine.MedicineRepository;
import com.dawaa.domain.pharmacy.Pharmacy;
import com.dawaa.domain.pharmacy.PharmacyRepository;
import com.dawaa.domain.user.User;
import com.dawaa.domain.user.UserRole;
import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;

public class InventoryService {
  private final InventoryRepository inventoryRepository;
  private final PharmacyRepository pharmacyRepository;
  private final MedicineService medicineService;

  public InventoryService(
      InventoryRepository inventoryRepository,
      PharmacyRepository pharmacyRepository,
      MedicineRepository medicineRepository) {
    this.inventoryRepository =
        Objects.requireNonNull(inventoryRepository, "inventoryRepository is required");
    this.pharmacyRepository =
        Objects.requireNonNull(pharmacyRepository, "pharmacyRepository is required");
    this.medicineService =
        new MedicineService(Objects.requireNonNull(medicineRepository, "medicineRepository is required"));
  }

  public List<InventoryItem> listMyInventory(User requester) {
    Pharmacy pharmacy = requireOwnedPharmacy(requester);
    return inventoryRepository.findByPharmacyId(pharmacy.pharmacyId());
  }

  public InventoryItem upsertMyInventoryItem(
      User requester,
      String existingMedicineId,
      String selectedMedicineId,
      String medicineName,
      int quantity,
      boolean inStock) {
    Pharmacy pharmacy = requireOwnedPharmacy(requester);
    Medicine medicine =
        findSelectedMedicine(selectedMedicineId, medicineName);

    String now = Instant.now().toString();
    String oldMedicineId = trimToEmpty(existingMedicineId);
    String medicineId = medicine.medicineId();
    int normalizedQuantity = Math.max(0, quantity);
    boolean normalizedInStock = normalizedQuantity > 0;
    InventoryItem existing =
        inventoryRepository
            .findByPharmacyIdAndMedicineId(pharmacy.pharmacyId(), medicineId)
            .orElse(null);
    if (existing != null && oldMedicineId.isBlank()) {
      throw new IllegalArgumentException(
          "Medicine is already in your inventory. Edit it from current inventory.");
    }
    if (existing != null && !oldMedicineId.equals(medicineId)) {
      throw new IllegalArgumentException(
          "Medicine is already in your inventory. Edit it from current inventory.");
    }

    String createdAt = existing == null ? now : existing.createdAt();
    long version = existing == null ? 1 : existing.version() + 1;

    InventoryItem saved =
        inventoryRepository.save(
            new InventoryItem(
                pharmacy.pharmacyId(),
                medicineId,
                medicine.brandName(),
                medicineId,
                pharmacy.pharmacyId(),
                normalizedQuantity,
                normalizedInStock,
                createdAt,
                now,
                version));

    if (!oldMedicineId.isBlank() && !oldMedicineId.equals(medicineId)) {
      inventoryRepository.delete(pharmacy.pharmacyId(), oldMedicineId);
    }

    return saved;
  }

  private Medicine findSelectedMedicine(String medicineId, String medicineName) {
    if (medicineId != null && !medicineId.isBlank()) {
      return medicineService
          .findActiveMedicineById(medicineId)
          .orElseThrow(() -> new NoSuchElementException("Medicine not found in catalog"));
    }
    return medicineService
        .findActiveMedicineByName(medicineName)
        .orElseThrow(() -> new NoSuchElementException("Medicine not found in catalog"));
  }

  public void deleteMyInventoryItem(User requester, String medicineId) {
    Pharmacy pharmacy = requireOwnedPharmacy(requester);
    String normalizedMedicineId = requireText(medicineId, "medicineId");

    inventoryRepository
        .findByPharmacyIdAndMedicineId(pharmacy.pharmacyId(), normalizedMedicineId)
        .orElseThrow(() -> new NoSuchElementException("Inventory item not found"));

    inventoryRepository.delete(pharmacy.pharmacyId(), normalizedMedicineId);
  }

  private Pharmacy requireOwnedPharmacy(User requester) {
    requirePharmacist(requester);
    return pharmacyRepository
        .findByOwnerUserId(requester.userId())
        .orElseThrow(() -> new NoSuchElementException("Pharmacy not found for requester"));
  }

  private static void requirePharmacist(User requester) {
    if (requester == null) {
      throw new IllegalArgumentException("Requester is required");
    }
    if (!requester.active()) {
      throw new SecurityException("Requester account is inactive");
    }
    if (requester.role() != UserRole.PHARMACIST) {
      throw new SecurityException("Only pharmacists can manage inventory");
    }
  }

  private static String requireText(String value, String name) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(name + " is required");
    }
    return value.trim();
  }

  private static String trimToEmpty(String value) {
    return value == null ? "" : value.trim();
  }
}
