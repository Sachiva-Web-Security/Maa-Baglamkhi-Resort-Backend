import './TableCard.css';

const TableCard = ({ table, onClick, isSelected }) => {
  const getStatusClass = (status) => {
    switch (status) {
      case 'Available':
        return 'table-available';
      case 'Occupied':
        return 'table-occupied';
      case 'Reserved':
        return 'table-reserved';
      default:
        return '';
    }
  };

  return (
    <div 
      className={`table-card ${getStatusClass(table.status)} ${isSelected ? 'table-selected' : ''}`}
      onClick={() => onClick(table)}
    >
      <div className="table-number">Table {table.number}</div>
      <div className="table-status">{table.status}</div>
      {table.guestCount && (
        <div className="table-guest-count">{table.guestCount} Guests</div>
      )}
    </div>
  );
};

export default TableCard;

