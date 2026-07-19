package com.dawaa.domain.medicine;

import java.util.Optional;

public interface MedicineRepository {
  Optional<Medicine> findByNormalizedBrandName(String normalizedBrandName);
}
