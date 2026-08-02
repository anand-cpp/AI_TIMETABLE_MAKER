const Teacher = require('../models/Teacher');

// Convert name to base username
// "John Doe" -> "johndoe"
// "Mary Ann Joseph" -> "maryann"
const nameToUsername = (name) => {
  const parts = name.trim().toLowerCase().split(/\s+/);
  if (parts.length === 1) return parts[0];
  // Use first name + first letter of last name, or just first two parts joined
  return (parts[0] + parts[parts.length - 1]).replace(/[^a-z0-9]/g, '');
};

// Generate unique username with counter suffix if needed
// john -> john2 -> john3 ...
const generateUniqueUsername = async (name) => {
  const base = nameToUsername(name);

  // Check if base username exists
  const existing = await Teacher.findOne({ username: base });
  if (!existing) return base;

  // Find highest counter suffix
  let counter = 2;
  while (true) {
    const candidate = `${base}${counter}`;
    const found = await Teacher.findOne({ username: candidate });
    if (!found) return candidate;
    counter++;
  }
};

// Generate default password from name
// "John Doe" -> "johndoe123"
const generateDefaultPassword = (name) => {
  const base = nameToUsername(name);
  return `${base}123`;
};

module.exports = {
  nameToUsername,
  generateUniqueUsername,
  generateDefaultPassword,
};