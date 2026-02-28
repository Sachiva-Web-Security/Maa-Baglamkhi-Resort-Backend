
import React, { useState } from "react";

const HeroSection = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  const months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const years = Array.from({ length: 20 }, (_, i) => 2015 + i);

  const startOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );

  const endOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  const startDay = startOfMonth.getDay();
  const totalDays = endOfMonth.getDate();

  const prevMonthDays = [];
  const prevMonthLastDate = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    0
  ).getDate();

  for (let i = startDay; i > 0; i--) {
    prevMonthDays.push(prevMonthLastDate - i + 1);
  }

  const currentMonthDays = [];
  for (let i = 1; i <= totalDays; i++) {
    currentMonthDays.push(i);
  }

  const nextMonthDays = [];
  const totalCells = prevMonthDays.length + currentMonthDays.length;

  for (let i = 1; totalCells + i <= 42; i++) {
    nextMonthDays.push(i);
  }

  const changeMonth = (direction) => {
    const newDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + direction,
      1
    );
    setCurrentDate(newDate);
  };

  const changeMonthDropdown = (monthIndex) => {
    const newDate = new Date(
      currentDate.getFullYear(),
      monthIndex,
      1
    );
    setCurrentDate(newDate);
  };

  const changeYearDropdown = (year) => {
    const newDate = new Date(
      year,
      currentDate.getMonth(),
      1
    );
    setCurrentDate(newDate);
  };

  const isSameDay = (day) => {
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentDate.getMonth() &&
      selectedDate.getFullYear() === currentDate.getFullYear()
    );
  };

  const selectDate = (day) => {
    setSelectedDate(
      new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        day
      )
    );
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="bg-[#1e1b2e] w-full max-w-3xl rounded-2xl p-6 shadow-2xl">

        <div className="flex justify-between items-center mb-6 gap-3">
          <button
            onClick={() => changeMonth(-1)}
            className="text-gray-400 text-xl hover:text-white"
          >
            ❮
          </button>

          <div className="flex gap-2">
            <select
              value={currentDate.getMonth()}
              onChange={(e) => changeMonthDropdown(Number(e.target.value))}
              className="bg-[#2a2740] text-white px-3 py-1 rounded-lg"
            >
              {months.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>

            <select
              value={currentDate.getFullYear()}
              onChange={(e) => changeYearDropdown(Number(e.target.value))}
              className="bg-[#2a2740] text-white px-3 py-1 rounded-lg"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => changeMonth(1)}
            className="text-gray-400 text-xl hover:text-white"
          >
            ❯
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-gray-400 text-sm mb-4">
          {days.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-4 text-center">
          {prevMonthDays.map((day, index) => (
            <div key={"p" + index} className="flex justify-center">
              <div className="w-10 h-10 flex items-center justify-center text-gray-600">
                {day}
              </div>
            </div>
          ))}

          {currentMonthDays.map((day) => (
            <div
              key={day}
              onClick={() => selectDate(day)}
              className="relative flex justify-center"
            >
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-xl cursor-pointer transition ${
                  isSameDay(day)
                    ? "bg-blue-600 text-white"
                    : "text-gray-300 hover:bg-[#2a2740]"
                }`}
              >
                {day}
              </div>

              {isSameDay(day) && (
                <div className="absolute top-0 right-5 w-2 h-2 bg-yellow-400 rounded-full"></div>
              )}
            </div>
          ))}

          {nextMonthDays.map((day, index) => (
            <div key={"n" + index} className="flex justify-center">
              <div className="w-10 h-10 flex items-center justify-center text-gray-600">
                {day}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center mt-6">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
