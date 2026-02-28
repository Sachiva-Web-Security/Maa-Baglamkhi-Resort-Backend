import React from "react";
import {
  FaUtensils,
  FaShoppingCart,
  FaUsers,
  FaChartLine,
  FaChair,
  FaMoneyBillWave,
  FaClipboardList,
  FaConciergeBell
} from "react-icons/fa";

const stats = [
  {
    title: "Today's Orders",
    value: 145,
    icon: <FaShoppingCart />,
    color: "bg-blue-100 text-blue-600",
  },
  {
    title: "Food Revenue",
    value: "₹32,500",
    icon: <FaMoneyBillWave />,
    color: "bg-green-100 text-green-600",
  },
  {
    title: "Active Tables",
    value: 18,
    icon: <FaChair />,
    color: "bg-purple-100 text-purple-600",
  },
  {
    title: "Customers",
    value: 98,
    icon: <FaUsers />,
    color: "bg-orange-100 text-orange-600",
  },
  {
    title: "Kitchen Orders",
    value: 32,
    icon: <FaUtensils />,
    color: "bg-pink-100 text-pink-600",
  },
  {
    title: "Pending Bills",
    value: 12,
    icon: <FaClipboardList />,
    color: "bg-yellow-100 text-yellow-600",
  },
  {
    title: "Waiter Requests",
    value: 5,
    icon: <FaConciergeBell />,
    color: "bg-indigo-100 text-indigo-600",
  },
  {
    title: "Growth",
    value: "+12%",
    icon: <FaChartLine />,
    color: "bg-teal-100 text-teal-600",
  },
];

const NewDash = () => {
  return (
    <div className="bg-white rounded-2xl shadow-md p-6 w-full mt-10">

      {/* Header */}
      <div className="flex justify-between items-center mb-6">

        <div className="flex items-center gap-4">
          {/* Image via Link */}
          <img
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5"
            alt="Restaurant"
            className="w-14 h-14 rounded-lg object-cover"
          />

          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              Restaurant Overview
            </h2>
            <p className="text-sm text-gray-500">
              Daily restaurant performance summary
            </p>
          </div>
        </div>

        <button className="text-sm text-blue-600 hover:underline">
          View Report
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-4 rounded-xl border hover:shadow-md transition"
          >
            <div
              className={`w-11 h-11 flex items-center justify-center rounded-lg ${item.color}`}
            >
              {item.icon}
            </div>

            <div>
              <p className="text-sm text-gray-500">{item.title}</p>
              <h3 className="text-lg font-semibold">{item.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="grid md:grid-cols-2 gap-4 mt-6">

        {/* Most Selling Item */}
        <div className="p-4 rounded-xl bg-gray-50 flex justify-between items-center">

          <div className="flex items-center gap-3">
            <img
              src="https://images.unsplash.com/photo-1603894584373-5ac82b2ae398"
              alt="Food"
              className="w-12 h-12 rounded-lg object-cover"
            />

            <div>
              <p className="text-sm text-gray-500">Most Selling Item</p>
              <h3 className="font-semibold text-gray-700">
                Paneer Butter Masala
              </h3>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Orders</p>
            <h3 className="font-semibold text-gray-700">54</h3>
          </div>
        </div>

        {/* Top Waiter */}
        <div className="p-4 rounded-xl bg-gray-50 flex justify-between items-center">

          <div className="flex items-center gap-3">
            <img
              src="https://randomuser.me/api/portraits/men/32.jpg"
              alt="Waiter"
              className="w-12 h-12 rounded-full object-cover"
            />

            <div>
              <p className="text-sm text-gray-500">Top Waiter</p>
              <h3 className="font-semibold text-gray-700">
                Rahul Sharma
              </h3>
            </div>
          </div>

          <div className="text-right">
            <p className="text-sm text-gray-500">Orders Served</p>
            <h3 className="font-semibold text-gray-700">38</h3>
          </div>
        </div>

      </div>
    </div>
  );
};

export default NewDash;
