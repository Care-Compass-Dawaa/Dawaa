package com.dawaa.business.user;

import com.dawaa.common.PasswordHasher;
import com.dawaa.domain.user.*;
import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.mindrot.jbcrypt.BCrypt;

public class UserService {
    private static final Pattern EMAIL_PATTERN =
        Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private enum PasswordMatch {
        CURRENT_BCRYPT,
        LEGACY_REHASH_NEEDED,
        NO_MATCH
    }

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
            isEmpty(user.passwordHash())) // passwordHash carries the plain password before persistence
            {
                throw new IllegalArgumentException("email, name, and password are required");
            }
        requirePasswordLength(user.passwordHash());

        String normalizedEmail = normalizeEmailRequired(user.email());
        Optional<User> existingUser = userRepository.findByEmail(normalizedEmail);
        if (existingUser.isPresent()) { //returns true if user already exists
            throw new IllegalArgumentException("An account with this email already exists");
        }
        String hashedPassword = hashPassword(user.passwordHash());

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
            hashedPassword,//this will be stored in user.passwordHash
            true,
            !isEmpty(user.createdAt()) ? user.createdAt().trim() : now,
            !isEmpty(user.updatedAt()) ? user.updatedAt().trim() : now
        );

        return userRepository.save(newUser);
        //save user if no account with this email exists
    }

    public User loginUser(String email, String plainPassword) {
        if (isEmpty(email) || isEmpty(plainPassword)) {
            throw new IllegalArgumentException("email and password are required");
        }

        User user =
            userRepository.findByEmail(normalizeEmailRequired(email))
                .orElseThrow(() -> new SecurityException("Invalid email or password"));

        PasswordMatch passwordMatch = matchPassword(plainPassword, user.passwordHash());
        if (passwordMatch == PasswordMatch.NO_MATCH) {
            throw new SecurityException("Invalid email or password");
        }
        if (!user.active()) {
            throw new SecurityException("Account is inactive");
        }
        if (passwordMatch == PasswordMatch.LEGACY_REHASH_NEEDED) {
            user =
                userRepository.update(
                    new User(
                        user.userId(),
                        user.email(),
                        user.name(),
                        user.role(),
                        hashPassword(plainPassword),
                        user.active(),
                        user.createdAt(),
                        user.updatedAt()));
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
        return updateUser(requester, name, email, "");
    }

    public User updateUser(User requester, String name, String email, String plainPassword){
        if (requester==null){
            throw new IllegalArgumentException("Requester is required");
        }
        if (!requester.active()) {
            throw new SecurityException("Requester account is inactive");
        }

        if (isEmpty(name)){
            throw new IllegalArgumentException("name is required");
        }

        if (isEmpty(email)){
            throw new IllegalArgumentException("email is required");
        }
        if (!isEmpty(plainPassword)) {
            requirePasswordLength(plainPassword);
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
            isEmpty(plainPassword) ? requester.passwordHash() : hashPassword(plainPassword),
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

    private static void requirePasswordLength(String password) {
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password must be at least 8 characters");
        }
    }

    private static String hashPassword(String plainPassword) {
        return BCrypt.hashpw(plainPassword, BCrypt.gensalt(10));
    }

    private static PasswordMatch matchPassword(String plainPassword, String storedPasswordHash) {
        if (isEmpty(storedPasswordHash)) {
            return PasswordMatch.NO_MATCH;
        }

        if (isBcryptHash(storedPasswordHash)) {
            if (safeBcryptCheck(plainPassword, storedPasswordHash)) {
                return PasswordMatch.CURRENT_BCRYPT;
            }
            if (safeBcryptCheck(PasswordHasher.hash(plainPassword), storedPasswordHash)) {
                return PasswordMatch.LEGACY_REHASH_NEEDED;
            }
            return PasswordMatch.NO_MATCH;
        }

        String legacyHash = PasswordHasher.hash(plainPassword);
        if (storedPasswordHash.equalsIgnoreCase(legacyHash)) {
            return PasswordMatch.LEGACY_REHASH_NEEDED;
        }
        return PasswordMatch.NO_MATCH;
    }

    private static boolean isBcryptHash(String storedPasswordHash) {
        return storedPasswordHash.startsWith("$2a$")
            || storedPasswordHash.startsWith("$2b$")
            || storedPasswordHash.startsWith("$2y$");
    }

    private static boolean safeBcryptCheck(String plainPassword, String storedPasswordHash) {
        if (isEmpty(storedPasswordHash)) {
            return false;
        }
        try {
            return BCrypt.checkpw(plainPassword, storedPasswordHash);
        } catch (IllegalArgumentException error) {
            return false;
        }
    }

}
