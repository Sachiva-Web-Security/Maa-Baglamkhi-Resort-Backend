import { useState } from 'react';
import './PaymentSection.css';

const PaymentSection = ({ 
  totalAmount, 
  selectedTable, 
  onGenerateBill, 
  onTransferToRoom, 
  onSplitBill 
}) => {
  const [paymentMethod, setPaymentMethod] = useState('Cash');

  const handleGenerateBill = () => {
    if (totalAmount === 0) {
      alert('Please add items to the order');
      return;
    }
    onGenerateBill({ paymentMethod, totalAmount });
  };

  const handleTransferToRoom = () => {
    if (totalAmount === 0) {
      alert('Please add items to the order');
      return;
    }
    if (!selectedTable) {
      alert('Please select a table first');
      return;
    }
    onTransferToRoom({ paymentMethod, totalAmount, table: selectedTable });
  };

  const handleSplitBill = () => {
    if (totalAmount === 0) {
      alert('Please add items to the order');
      return;
    }
    onSplitBill({ totalAmount });
  };

  return (
    <div className="payment-section">
      <select 
        className="payment-method-select"
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
      >
        <option value="Cash">Cash</option>
        <option value="Card">Card</option>
        <option value="UPI">UPI</option>
        <option value="Online">Online</option>
      </select>

      <button 
        className="payment-btn payment-btn-green"
        onClick={handleGenerateBill}
      >
        Generate Bill
      </button>

      <button 
        className="payment-btn payment-btn-blue"
        onClick={handleTransferToRoom}
      >
        Transfer to Room
      </button>

      <button 
        className="payment-btn payment-btn-yellow"
        onClick={handleSplitBill}
      >
        Split Bill
      </button>
    </div>
  );
};

export default PaymentSection;

