import './MenuItem.css';

const MenuItem = ({ item, onAddToOrder }) => {
  const handleClick = () => {
    onAddToOrder(item);
  };

  return (
    <div 
      className="menu-item "
      onClick={handleClick}
    >
      {item.image && (
        <div className="menu-item-image-container  ">
          <img 
            src={item.image} 
            alt={item.name}
            className="menu-item-image"
            onError={(e) => {
              e.target.src = 'https://via.placeholder.com/200x150?text=' + encodeURIComponent(item.name);
            }}
          />
        </div>
      )}
      <div className="menu-item-content">
        <div className="menu-item-header">
          <h3 className="menu-item-name">{item.name}</h3>
          {item.category && (
            <span className="menu-item-category">{item.category}</span>
          )}
        </div>
        <div className="menu-item-footer">
          <p className="menu-item-price">₹{item.price}</p>
          {item.description && (
            <p className="menu-item-description">{item.description}</p>
          )}
        </div>
      </div>
      {item.available === false && (
        <div className="menu-item-unavailable">Unavailable</div>
      )}
    </div>
  );
};

export default MenuItem;

