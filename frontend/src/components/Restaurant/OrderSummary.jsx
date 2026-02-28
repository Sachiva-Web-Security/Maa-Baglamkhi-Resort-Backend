import './OrderSummary.css';

const OrderSummary = ({ orderItems, onRemoveItem, onUpdateQuantity }) => {
  const calculateSubtotal = () => {
    return orderItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const calculateGST = () => {
    return calculateSubtotal() * 0.05; // 5% GST
  };

  const calculateGrandTotal = () => {
    return calculateSubtotal() + calculateGST();
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      onRemoveItem(itemId);
    } else {
      onUpdateQuantity(itemId, newQuantity);
    }
  };

  return (
    <div className="order-summary">
      <h2 className="order-summary-title">Order Summary</h2>

      <div className="order-items">
        {orderItems.length === 0 ? (
          <div className="empty-order">
            <p>No items in order</p>
            <p className="empty-order-hint">Select items from menu to add</p>
          </div>
        ) : (
          <>
            {orderItems.map((item) => (
              <div key={item.id} className="order-item">
                <div className="order-item-info">
                  <div className="order-item-name">{item.name}</div>
                  <div className="order-item-price">₹{item.price}</div>
                </div>
                <div className="order-item-controls">
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span className="quantity-value">{item.quantity}</span>
                  <button 
                    className="quantity-btn"
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                  >
                    +
                  </button>
                  <button 
                    className="remove-btn"
                    onClick={() => onRemoveItem(item.id)}
                  >
                    ×
                  </button>
                </div>
                <div className="order-item-total">
                  ₹{item.price * item.quantity}
                </div>
              </div>
            ))}

            <hr className="order-divider" />

            <div className="order-totals">
              <div className="total-row">
                <span>Subtotal</span>
                <span>₹{calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="total-row gst-row">
                <span>GST (5%)</span>
                <span>₹{calculateGST().toFixed(2)}</span>
              </div>
              <div className="total-row grand-total">
                <span>Grand Total</span>
                <span>₹{calculateGrandTotal().toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default OrderSummary;

