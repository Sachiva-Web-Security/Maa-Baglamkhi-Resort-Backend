const router = require("express").Router();

const {
  listSections,
  listRecords,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
} = require("../controller/inventoryMastersController");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const READERS = ["admin", "manager", "kitchen", "chef", "accountant", "receptionist"];
const EDITORS = ["admin", "manager", "receptionist"];

router.get("/sections", authMiddleware, roleMiddleware(READERS), listSections);
router.get("/:sectionKey", authMiddleware, roleMiddleware(READERS), listRecords);
router.get("/:sectionKey/:id", authMiddleware, roleMiddleware(READERS), getRecord);
router.post("/:sectionKey", authMiddleware, roleMiddleware(EDITORS), createRecord);
router.put("/:sectionKey/:id", authMiddleware, roleMiddleware(EDITORS), updateRecord);
router.delete("/:sectionKey/:id", authMiddleware, roleMiddleware(EDITORS), deleteRecord);

module.exports = router;
