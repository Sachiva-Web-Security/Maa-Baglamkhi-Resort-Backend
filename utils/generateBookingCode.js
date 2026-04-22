function generateBookingCode(id) {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `MBR-${yyyy}${mm}${dd}-${String(id).padStart(4, "0")}`;
}

module.exports = { generateBookingCode };
