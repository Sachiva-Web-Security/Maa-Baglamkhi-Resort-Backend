const router = require("express").Router();

const {
  getMenuItems,
  getInventoryItems,
  getRecipeCatalogue,
  getRecipeByMenuItem,
  replaceRecipe,
  updateRecipeRow,
  deleteRecipeRow,
  previewConsumption,
  applyConsumption,
  getConsumptionLog,
} = require("../controller/menuRecipeController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "kitchen", "accountant", "receptionist"];
const EDITORS = ["admin", "manager", "receptionist"];
const OPERATORS = ["admin", "manager", "kitchen", "receptionist"];

router.get("/menu-items", authMiddleware, roleMiddleware(READERS), getMenuItems);
router.get("/inventory-items", authMiddleware, roleMiddleware(READERS), getInventoryItems);
router.get("/recipes", authMiddleware, roleMiddleware(READERS), getRecipeCatalogue);
router.get("/menu/:menuItemId", authMiddleware, roleMiddleware(READERS), getRecipeByMenuItem);
router.post("/menu/:menuItemId", authMiddleware, roleMiddleware(EDITORS), replaceRecipe);
router.put("/recipes/:recipeRowId", authMiddleware, roleMiddleware(EDITORS), updateRecipeRow);
router.delete("/recipes/:recipeRowId", authMiddleware, roleMiddleware(EDITORS), deleteRecipeRow);
router.post("/preview-consumption", authMiddleware, roleMiddleware(READERS), previewConsumption);
router.post("/apply-consumption", authMiddleware, roleMiddleware(OPERATORS), applyConsumption);
router.get("/consumption-log", authMiddleware, roleMiddleware(READERS), getConsumptionLog);

module.exports = router;
