export const PASSWORD_MIN_LENGTH = 8;
// Supabase Auth hashes passwords with bcrypt, which ignores bytes past 72.
export const PASSWORD_MAX_BYTES = 72;

export function validateNewPassword(password, confirmPassword) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return "Password is too long. Use 72 characters or fewer.";
  }
  if (password.trim() !== password) {
    return "Password cannot start or end with a space.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}
