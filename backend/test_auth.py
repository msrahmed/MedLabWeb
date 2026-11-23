
from auth import (
    hash_web_password,
    verify_web_password,
    hash_legacy_password,
    verify_legacy_password,
    validate_password,
)

# Test password
password = "MedLab@Test2026"

# 1. Test Argon2id
web_hash = hash_web_password(password)

assert verify_web_password(password, web_hash)
assert not verify_web_password("WrongPassword", web_hash)

# 2. Test legacy SHA-256 compatibility
legacy_hash = hash_legacy_password(password)

assert verify_legacy_password(password, legacy_hash)
assert not verify_legacy_password("WrongPassword", legacy_hash)

# 3. Test password policy
valid, message = validate_password(password, "admin")

assert valid, message

print("Argon2id: PASS")
print("Legacy SHA-256 compatibility: PASS")
print("Password policy: PASS")
print("All authentication tests passed.")
