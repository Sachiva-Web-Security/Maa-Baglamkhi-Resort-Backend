import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

const BanquetCalendar = ({ bookings }) => {

    const events = bookings.map((b) => ({
        title: `${b.eventType} - ${b.customerName}`,
        start: new Date(`${b.date}T${b.startTime}`),
        end: new Date(`${b.date}T${b.endTime}`)
    }));

    return (
        <div className="p-4 bg-white rounded-xl h-[600px]">
            <Calendar
                localizer={localizer}
                events={events}
                startAccessor="start"
                endAccessor="end"
            />
        </div>
    );
};

export default BanquetCalendar;