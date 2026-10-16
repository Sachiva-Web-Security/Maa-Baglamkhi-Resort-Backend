import BanquetBookingRow from "./BanquetBookingRow";

const BanquetList = ({ bookings, onComplete, onGenerateBill, onView, onEdit }) => {

    return (
        <div className="bg-[#0f172a] rounded-xl p-4">

            <div className="text-xl font-bold text-white mb-4">
                Banquet Bookings
            </div>

            <table className="w-full">

                <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-white/10">
                        <th className="p-3">Hall</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Event</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Time</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Actions</th>
                    </tr>
                </thead>

                <tbody>

                    {bookings.map((booking) => (
                        <BanquetBookingRow
                            key={booking.id}
                            booking={booking}
                            onComplete={() => onComplete(booking)}
                            onGenerateBill={() => onGenerateBill(booking)}
                            onView={() => onView(booking)}
                            onEdit={() => onEdit(booking)}
                        />
                    ))}

                </tbody>

            </table>

        </div>
    );
};

export default BanquetList;