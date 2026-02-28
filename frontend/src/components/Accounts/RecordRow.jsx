import './RecordRow.css';

const formatINR = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

const RecordRow = ({ record, onView }) => {
  const typeClass = record.type === 'Income' ? 'accounts-badge--income' : 'accounts-badge--expense';

  return (
    <tr className="accounts-row">
      <td className="accounts-td">{record.date}</td>
      <td className="accounts-td">
        <span className={`accounts-badge ${typeClass}`}>{record.type}</span>
      </td>
      <td className="accounts-td">{record.description}</td>
      <td className="accounts-td accounts-td--amount">{formatINR(record.amount)}</td>
      <td className="accounts-td">{record.paymentMode}</td>
      <td className="accounts-td">
        <button className="accounts-view-btn" onClick={() => onView(record)}>
          View
        </button>
      </td>
    </tr>
  );
};

export default RecordRow;

