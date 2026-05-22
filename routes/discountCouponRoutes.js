const router = require("express").Router();
const { list, create, update, remove } = require("../models/discountCouponModel");

router.get("/", async (_req, res) => {
  try {
    res.json(await list());
  } catch (error) {
    res.status(500).json({ message: "Failed to load coupons" });
  }
});

router.post("/", async (req, res) => {
  try {
    res.status(201).json(await create(req.body));
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A coupon with this code already exists"
        : error.message || "Failed to create",
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const updated = await update(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Coupon not found" });
    res.json(updated);
  } catch (error) {
    const isDup = error?.code === "ER_DUP_ENTRY";
    res.status(isDup ? 409 : 400).json({
      message: isDup
        ? "A coupon with this code already exists"
        : error.message || "Failed to update",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await remove(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ message: error.message || "Failed to delete" });
  }
});

module.exports = router;
