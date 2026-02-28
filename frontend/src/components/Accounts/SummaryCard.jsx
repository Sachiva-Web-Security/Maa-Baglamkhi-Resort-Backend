import './SummaryCard.css';

const SummaryCard = ({ label, value, valueColor = 'default', bg = 'default', onClick }) => {
  return (
    <div
      className={`accounts-summary-card accounts-summary-card--${bg} ${onClick ? 'accounts-summary-card--clickable' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
    >
      <p className="accounts-summary-card__label">{label}</p>
      <h2 className={`accounts-summary-card__value accounts-summary-card__value--${valueColor}`}>{value}</h2>
    </div>
  );
};

export default SummaryCard;

