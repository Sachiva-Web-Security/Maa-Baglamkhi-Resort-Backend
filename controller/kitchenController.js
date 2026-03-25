const Kitchen = require("../models/kitchen");
const AccountsModel = require("../models/AccountsModel");

const formatMySqlDateTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace("T", " ");
};

const normalizePrepTime = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 20;
  return Math.min(120, Math.max(5, Math.round(parsed)));
};

const inferEntityType = (orderLike = {}) => {
  if (String(orderLike.entity_type || orderLike.entityType || "").toLowerCase() === "room") {
    return "Room";
  }

  return String(orderLike.waiter_name || orderLike.waiter || "")
    .toLowerCase()
    .includes("room")
    ? "Room"
    : "Table";
};

exports.createOrder = (req, res) => {
  const { table, waiter, items, entityType, prepTimeMinutes } = req.body;
  const resolvedEntityType = entityType === "Room" ? "Room" : "Table";
  const resolvedWaiter =
    resolvedEntityType === "Room" ? "Room Service" : waiter || "Waiter";
  const prepMinutes = normalizePrepTime(prepTimeMinutes);
  const expectedReadyAt = formatMySqlDateTime(Date.now() + prepMinutes * 60 * 1000);

  const order = {
    table_number: table,
    waiter_name: resolvedWaiter,
    entity_type: resolvedEntityType,
    items: JSON.stringify(items),
    status: "Pending",
    prep_time_minutes: prepMinutes,
    expected_ready_at: expectedReadyAt,
  };

  Kitchen.createOrder(order, (err, result) => {
    if (err) return res.status(500).json(err);

    const payload = {
      id: result?.insertId || null,
      table,
      waiter: resolvedWaiter,
      entityType: resolvedEntityType,
      prepTimeMinutes: prepMinutes,
      expectedReadyAt,
      status: "Pending",
    };

    if (global.io) {
      global.io.emit("kitchen-order-created", payload);
    }

    res.json({ message: "Order sent to kitchen", order: payload });
  });
};

exports.getOrders = (req, res) => {

  Kitchen.getOrders((err, data) => {

    if (err) return res.status(500).json(err);

    const orders = data.map((o)=>{

      const parsedItems = JSON.parse(o.items || "[]");

      const items = parsedItems.map(item => ({
        name: item.name || item.item_name,
        qty: item.quantity,
        price: item.price
      }));

      const inferredEntityType = inferEntityType(o);

      return {
        id: o.id,
        table: o.table_number,
        waiter: o.waiter_name,
        entityType: inferredEntityType,
        status: o.status,
        created_at: o.created_at,
        prepTimeMinutes: Number(o.prep_time_minutes || 0) || 20,
        expectedReadyAt: o.expected_ready_at,
        readyAt: o.ready_at,
        readyMessage: o.ready_message || "",
        items
      };

    });

    res.json(orders);

  });

};

exports.updateOrderStatus = (req, res) => {
  const { id } = req.params;
  const { status, prepTimeMinutes, readyMessage } = req.body || {};

  Kitchen.getOrderById(id, (fetchErr, rows) => {
    if (fetchErr) return res.status(500).json(fetchErr);

    const order = rows?.[0];
    if (!order) return res.status(404).json({ message: "Order not found" });

    const updates = {};
    const nextStatus = status || order.status || "Pending";

    if (status) {
      updates.status = status;
    }

    if (prepTimeMinutes !== undefined) {
      const prepMinutes = normalizePrepTime(prepTimeMinutes);
      updates.prep_time_minutes = prepMinutes;
      updates.expected_ready_at = formatMySqlDateTime(Date.now() + prepMinutes * 60 * 1000);
    }

    if (String(nextStatus).toLowerCase() === "ready") {
      const entityType = inferEntityType(order);
      updates.ready_at = formatMySqlDateTime(new Date());
      updates.ready_message =
        String(readyMessage || "").trim() ||
        `${entityType} ${order.table_number || id} order is ready for service.`;
    } else if (status) {
      updates.ready_at = null;
      updates.ready_message = null;
    }

    if (!Object.keys(updates).length) {
      return res.json({ message: "No changes applied" });
    }

    Kitchen.updateOrder(id, updates, (err) => {
      if (err) return res.status(500).json(err);

      const entityType = inferEntityType(order);
      const responsePayload = {
        id: Number(id),
        table: order.table_number,
        entityType,
        status: updates.status || order.status,
        prepTimeMinutes: Number(updates.prep_time_minutes || order.prep_time_minutes || 20),
        expectedReadyAt: updates.expected_ready_at || order.expected_ready_at || null,
        readyAt: updates.ready_at || null,
        readyMessage: updates.ready_message || "",
      };

      if (global.io) {
        global.io.emit("kitchen-order-updated", responsePayload);
      }

      res.json({ message: "Order updated", order: responsePayload });
    });
  });
};

exports.saveOrder = (req, res) => {
  const { id } = req.params;
  const { status = "Saved" } = req.body || {};

  Kitchen.getOrderById(id, (fetchErr, rows) => {
    if (fetchErr) return res.status(500).json(fetchErr);
    const order = rows?.[0];
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (String(order.status || "").toLowerCase() === "saved") {
      return res.json({ message: "Order already saved" });
    }

    const items = JSON.parse(order.items || "[]");
    const amount = items.reduce((sum, item) => {
      const qty = Number(item.qty ?? item.quantity ?? 0);
      const price = Number(item.price || 0);
      return sum + price * qty;
    }, 0);

    const today = new Date().toISOString().slice(0, 10);
    const entityLabel =
      String(order.waiter_name || "").toLowerCase().includes("room") ? "Room" : "Table";
    const description = `Kitchen Order Saved - ${entityLabel} ${order.table_number || id}`;

    AccountsModel.createTransaction(
      {
        date: today,
        type: "Income",
        description,
        amount,
        paymentMode: "Kitchen",
      },
      (accountErr) => {
        if (accountErr) {
          console.error("Failed to save kitchen order to accounts:", accountErr);
          return res.status(500).json({ message: "Account save failed" });
        }

        Kitchen.updateOrder(id, { status }, (err) => {
          if (err) return res.status(500).json(err);

          res.json({
            message: "Order saved",
            accountEntry: {
              date: today,
              description,
              amount,
              paymentMode: "Kitchen",
            },
          });
        });
      }
    );
  });
};

exports.cancelOrder = (req, res) => {
  const { id } = req.params;

  Kitchen.cancelOrder(id, (err) => {
    if (err) return res.status(500).json(err);

    res.json({ message: "Order cancelled and removed" });
  });
};
