import './ReportCard.css';

const ReportCard = ({ title, subtitle, variant = 'blue', onClick }) => {
  return (
    <button className={`accounts-report-card accounts-report-card--${variant}`} onClick={onClick} type="button">
      <h3 className="accounts-report-card__title">{title}</h3>
      <p className="accounts-report-card__subtitle">{subtitle}</p>
    </button>
  );
};

export default ReportCard;

