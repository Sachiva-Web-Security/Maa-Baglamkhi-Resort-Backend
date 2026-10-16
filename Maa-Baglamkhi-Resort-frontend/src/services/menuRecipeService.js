import API from "../api";

export async function fetchRecipeMenuItems() {
  const response = await API.get("/menu-recipes/menu-items");
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchRecipeInventoryItems() {
  const response = await API.get("/menu-recipes/inventory-items");
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchRecipeCatalogue() {
  const response = await API.get("/menu-recipes/recipes");
  return Array.isArray(response.data) ? response.data : [];
}

export async function fetchRecipeForMenuItem(menuItemId) {
  const response = await API.get(`/menu-recipes/menu/${menuItemId}`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function saveRecipe(menuItemId, ingredients) {
  const response = await API.post(`/menu-recipes/menu/${menuItemId}`, { ingredients });
  return response.data;
}

export async function updateRecipeRow(recipeRowId, payload) {
  const response = await API.put(`/menu-recipes/recipes/${recipeRowId}`, payload);
  return response.data;
}

export async function deleteRecipeRow(recipeRowId) {
  const response = await API.delete(`/menu-recipes/recipes/${recipeRowId}`);
  return response.data;
}

export async function previewRecipeConsumption(payload) {
  const response = await API.post("/menu-recipes/preview-consumption", payload);
  return Array.isArray(response.data) ? response.data : [];
}

export async function applyRecipeConsumption(payload) {
  const response = await API.post("/menu-recipes/apply-consumption", payload);
  return response.data;
}

export async function fetchConsumptionLog(limit = 100) {
  const response = await API.get("/menu-recipes/consumption-log", {
    params: { limit },
  });
  return Array.isArray(response.data) ? response.data : [];
}
