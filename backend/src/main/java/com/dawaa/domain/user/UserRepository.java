package com.dawaa.domain.user;

import java.util.*;
//we used List, Optional,... from imports of java.util.* so far

public interface UserRepository {
    Optional<User> findById(String userId);

    Optional<User> findByEmail(String userEmail);

    User save(User user);

    List<User> findAll();
    
    void update(User user);

    void deactivate(String userId);

    void delete(String userId);
}
