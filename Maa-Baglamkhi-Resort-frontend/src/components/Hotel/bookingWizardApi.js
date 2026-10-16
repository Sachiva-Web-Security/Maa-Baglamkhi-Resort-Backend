import API from "../../api";

export const fetchBookingWizard = async (bookingId) => {
  if (!bookingId) return null;
   try {
   const response = await API.get(`/hotel/wizard/${bookingId}`);
   return response.data || null;
 } catch (error) {
   console.error(`Failed to fetch booking wizard for ID ${bookingId}:`, error);
   throw error; // Re-throw to let caller handle the error
 }
};
