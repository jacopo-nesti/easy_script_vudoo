export function cleanName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

export function nameIdentity(name) {
  return cleanName(name).toLowerCase();
}
