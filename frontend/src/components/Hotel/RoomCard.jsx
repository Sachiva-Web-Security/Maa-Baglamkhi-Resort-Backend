import { useState } from 'react';

const RoomCard = ({ room, onRoomClick, onCheckIn, onCheckOut, onMarkCleaning, onMarkAvailable }) => {
  const [showActions, setShowActions] = useState(false);

  const handleCardClick = () => {
    if (onRoomClick) {
      onRoomClick(room);
    }
    setShowActions(!showActions);
  };

  const handleActionClick = (e, action) => {
    e.stopPropagation();
    if (action === 'checkIn' && onCheckIn) {
      onCheckIn(room);
    } else if (action === 'checkOut' && onCheckOut) {
      onCheckOut(room);
    } else if (action === 'cleaning' && onMarkCleaning) {
      onMarkCleaning(room);
    }
    setShowActions(false);
  };

  return (
    <div
      onClick={handleCardClick}
      className="w-full max-w-xs
           bg-white/10
           backdrop-blur-md
           border border-white/20
           rounded-xl
           shadow-lg
           p-4
           hover:shadow-2xl hover:scale-[1.02]
           transition duration-300
           cursor-pointer"
    >
      {/* Smaller Image */}
      <div className="overflow-hidden rounded-lg">
        <img
          src={room.image || "https://images.unsplash.com/photo-1566665797739-1674de7a421a"}
          alt="room"
          className="w-full h-24 object-cover rounded-lg"
        />
      </div>

      {/* Compact Content */}
      <div className="mt-2 space-y-1">
        <h3 className="text-sm font-semibold text-white ml-10">
          Room {room.number}
        </h3>

        <p className="text-xs text-white ml-7">
          Status: <span className="font-medium">{room.status}</span>
        </p>

        {room.guest && (
          <p className="text-xs text-white ml-6">
            Guest: {room.guest}
          </p>
        )}

        {room.checkIn && (
          <p className="text-xs text-white ml-7">
            In: {room.checkIn}
          </p>
        )}

        {room.checkOut && (
          <p className="text-xs text-white ml-6">
            Out: {room.checkOut}
          </p>
        )}
      </div>

      {/* Compact Buttons */}
      {showActions && (
        <div
          className="mt-2 space-y-1"
          onClick={(e) => e.stopPropagation()}
        >
          {room.status === 'Available' && (
            <button
              className="w-full bg-blue-600 text-white py-1 text-xs rounded-full hover:bg-blue-700 transition"
              onClick={(e) => handleActionClick(e, 'checkIn')}
            >
              Check-In
            </button>
          )}

          {room.status === 'Occupied' && (
            <>
              <button
                className="w-full bg-red-600 text-white py-1 text-xs rounded-full hover:bg-red-700 transition"
                onClick={(e) => handleActionClick(e, 'checkOut')}
              >
                Check-Out
              </button>

              <button
                className="w-full bg-yellow-500 text-white py-1 text-xs rounded-full hover:bg-yellow-600 transition"
                onClick={(e) => handleActionClick(e, 'cleaning')}
              >
                Cleaning
              </button>
            </>
          )}

          {room.status === 'Cleaning' && (
            <button
              className="w-full bg-green-600 text-white py-1 text-xs rounded-full hover:bg-green-700 transition"
              onClick={(e) => {
                e.stopPropagation();
                if (onMarkAvailable) {
                  onMarkAvailable(room);
                }
                setShowActions(false);
              }}
            >
              Available
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RoomCard;