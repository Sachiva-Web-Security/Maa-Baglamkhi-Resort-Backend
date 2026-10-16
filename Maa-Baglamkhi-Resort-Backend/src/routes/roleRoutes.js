const express = require("express");
const router = express.Router();
const ctrl = require("../controller/roleController");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const ADMIN = ["admin"];
const READERS = ["admin", "manager"];

router.use(authMiddleware);

// /permissions is a sibling of the role namespace: register it before /:id.
router.get("/permissions", roleMiddleware(READERS), ctrl.listPermissions);

router.get("/", roleMiddleware(READERS), ctrl.listRoles);
router.post("/", roleMiddleware(ADMIN), ctrl.createRole);
router.get("/:id", roleMiddleware(READERS), ctrl.getRole);
router.patch("/:id", roleMiddleware(ADMIN), ctrl.updateRole);
router.put("/:id", roleMiddleware(ADMIN), ctrl.updateRole);
router.delete("/:id", roleMiddleware(ADMIN), ctrl.deleteRole);
router.get("/:id/permissions", roleMiddleware(READERS), ctrl.getRolePermissions);
router.put("/:id/permissions", roleMiddleware(ADMIN), ctrl.setRolePermissions);

module.exports = router;
