const Kitchen = require("../models/kitchen");

exports.createOrder = (req, res) => {
  const { table, waiter, items } = req.body;

  const order = {
    table_number: table,
    waiter_name: waiter,
    items: JSON.stringify(items),
    status: "Pending",
  };

  Kitchen.createOrder(order, (err, result) => {
    if (err) return res.status(500).json(err);

    res.json({ message: "Order sent to kitchen" });
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

      return {
        id: o.id,
        table: o.table_number,
        waiter: o.waiter_name,
        status: o.status,
        created_at: o.created_at,
        items
      };

    });

    res.json(orders);

  });

};

exports.updateOrderStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  Kitchen.updateOrderStatus(id, status, (err) => {
    if (err) return res.status(500).json(err);

    res.json({ message: "Order updated" });
  });
};