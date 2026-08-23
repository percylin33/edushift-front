// BCrypt hash generator (sync). Uses bcryptjs (pure JS).
import bcrypt from 'bcryptjs';
const pwd = 'EduShift2026!';
const hash = bcrypt.hashSync(pwd, 10);
console.log(hash);