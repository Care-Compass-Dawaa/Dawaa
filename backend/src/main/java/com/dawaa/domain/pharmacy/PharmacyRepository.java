package com.dawaa.domain.pharmacy;

import java.util.List;
import java.util.Optional;

public interface PharmacyRepository {
  Pharmacy save(Pharmacy pharmacy);

  Optional<Pharmacy> findByPharmacistId(String pharmacistId);

  List<Pharmacy> findAll();

  void updateApproval(String pharmacyId, boolean approved);
}
