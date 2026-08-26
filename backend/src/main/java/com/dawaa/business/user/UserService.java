package com.dawaa.business.user;

import com.dawaa.domain.user.*;
import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

public class UserService {
    private static final Pattern EMAIL_PATTERN =
        Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository){
        this.userRepository = 
            Objects.requireNonNull(userRepository, "userRepository is required.");
    }

    private static boolean isEmpty(String value){
        return value==null || value.isBlank();
    }

    public User getRequester(String requesterUserId) {
        if (isEmpty(requesterUserId)) {
            throw new IllegalArgumentException("Requester user id is required");
        }

        User requester = userRepository.findById(requesterUserId.trim())
            .orElseThrow(() -> new IllegalArgumentException("Requester not found"));
        if (!requester.active()) {
            throw new SecurityException("Requester account is inactive");
        }
        return requester;
    }

    public User registerUser(User user){
        if (user == null) {
            throw new IllegalArgumentException("User is required");
        }
        if( isEmpty(user.email())||
            isEmpty(user.name())||
            isEmpty(user.passwordHash()))
            {
                throw new IllegalArgumentException("email, name, and password are required");
            }

        String normalizedEmail = normalizeEmailRequired(user.email());
        Optional<User> existingUser = userRepository.findByEmail(normalizedEmail);
        if (existingUser.isPresent()) { //returns true if user already exists
            throw new IllegalArgumentException("An account with this email already exists");
        }

        String now = Instant.now().toString();
        String userId = !isEmpty(user.userId())? user.userId().trim()
                : "USER#" + UUID.randomUUID();
        //replaces user id if not found
        UserRole role = user.role() == null ? UserRole.PATIENT : user.role();

        User newUser = new User(
            userId,
            normalizedEmail,
            user.name().trim(),
            role,
            user.passwordHash(),
            true,
            !isEmpty(user.createdAt()) ? user.createdAt().trim() : now,
            !isEmpty(user.updatedAt()) ? user.updatedAt().trim() : now
        );

        return userRepository.save(newUser);
        //save user if no account with this email exists
    }

    public User loginUser(String email, String passwordHash) {
        if (isEmpty(email) || isEmpty(passwordHash)) {
            throw new IllegalArgumentException("email and password are required");
        }

        User user =
            userRepository.findByEmail(normalizeEmailRequired(email))
                .orElseThrow(() -> new SecurityException("Invalid email or password"));

        if (!user.passwordHash().equals(passwordHash)) {
            throw new SecurityException("Invalid email or password");
        }
        if (!user.active()) {
            throw new SecurityException("Account is inactive");
        }

        return user;
    }

    public User getMyProfile(User requester) {
        if (requester == null) {
            throw new IllegalArgumentException("Requester is required");
        }
        return requester;
    }

    public static void requireAdmin(User requester){
        if (requester == null) {
            throw new IllegalArgumentException("Requester is required");
        }
        if (requester.role()!=UserRole.ADMIN){
            throw new SecurityException("Admin access is required.");
        }
    } 

    public User getById(User requester, String userId){
        requireAdmin(requester); //requester has to be an admin
        if (isEmpty(userId)){
            throw new IllegalArgumentException("userId is required");
        }
        return userRepository.findById(userId.trim())
            .orElseThrow(() -> new NoSuchElementException("User not found"));
    }
    
    public User getByEmail(User requester, String userEmail){
        requireAdmin(requester); //requester has to be an admin
        if (isEmpty(userEmail)){
            throw new IllegalArgumentException("userEmail is required");
        }
        return userRepository.findByEmail(userEmail.trim())
            .orElseThrow(() -> new NoSuchElementException("User not found"));
    }

    public List<User> getAllUsers(User requester){
        requireAdmin(requester);
        return userRepository.findAll();
    }

    public User updateUser(User requester, String name, String email){
        if (requester==null){
            throw new IllegalArgumentException("Requester is required");
        }

        if (isEmpty(name)){
            throw new IllegalArgumentException("name is required");
        }

        if (isEmpty(email)){
            throw new IllegalArgumentException("email is required");
        }

        String normalizedEmail = normalizeEmailRequired(email);
        Optional<User> existingUser = userRepository.findByEmail(normalizedEmail);
        if (existingUser.isPresent() && !existingUser.get().userId().equals(requester.userId())){
            throw new IllegalArgumentException("Email is already used by another account");
        }

        User updatedUser = new User(
            requester.userId(),
            normalizedEmail,
            name.trim(),
            requester.role(),
            requester.passwordHash(),
            requester.active(),
            requester.createdAt(),
            Instant.now().toString());

        return userRepository.update(updatedUser);
    }

    public void deactivateMyAccount(User requester){
        if (requester == null) {
            throw new IllegalArgumentException("Requester is required");
        }
        if (requester.role() == UserRole.ADMIN) {
            throw new SecurityException("Admin accounts cannot self-deactivate");
        }
        userRepository.deactivate(requester.userId());
    }

    public void activateUser(User requester, String userId){
        requireAdmin(requester);

        if (isEmpty(userId)) {
            throw new IllegalArgumentException("userId is required");
        }

        userRepository.findById(userId.trim())
            .orElseThrow(() -> new NoSuchElementException("User not found"));

        userRepository.activate(userId.trim());
    }

    public void deactivateUser(User requester, String userId){
        requireAdmin(requester);//person should be an admin to deactivate someone
        
        if (isEmpty(userId)) {//if user id is missing, throw exception
            throw new IllegalArgumentException("userId is required");
        }

        User target = userRepository.findById(userId.trim())
            .orElseThrow(() -> new NoSuchElementException("User not found"));

        if (target.role() == UserRole.ADMIN) {
            throw new SecurityException("Admin accounts cannot be deactivated here");
        }

        userRepository.deactivate(userId.trim());
    }

    private static String normalizeEmailRequired(String email) {
        if (isEmpty(email)) {
            throw new IllegalArgumentException("email is required");
        }
        String normalizedEmail = email.trim().toLowerCase();
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new IllegalArgumentException("email must be valid");
        }
        return normalizedEmail;
    }

}
