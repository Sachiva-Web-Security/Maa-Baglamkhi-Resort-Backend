
import React from "react";
import { CheckCircle, XCircle, Star } from "lucide-react";

const ReviewCard = ({
  name,
  image,
  rating,
  text,
}) => {
  return (
    <div className="flex gap-4 py-4 border-b border-slate-700 last:border-none">
      <img
        src={image}
        alt={name}
        className="w-12 h-12 rounded-full object-cover"
      />

      <div className="flex-1">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white font-semibold">{name}</p>
            <p className="text-gray-400 text-xs">
              Posted on 26/04/2020, 12:42 AM
            </p>
          </div>

          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={16}
                className={
                  i < rating
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-600"
                }
              />
            ))}
          </div>
        </div>

        <p className="text-gray-300 text-sm mt-2 leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
};

const ProductTabs = () => {
  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-6">
      <div className="bg-[#1e1b2e] w-full max-w-3xl rounded-2xl p-6 shadow-xl">

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-lg font-semibold">
            Latest Customer Review
          </h2>

          <button className="text-gray-400 text-xl">⋮</button>
        </div>

        <ReviewCard
          name="Ali Muzair"
          image="https://i.pravatar.cc/100?img=1"
          rating={4}
          text="I have been there many times. Rooms, Food and Service are excellent. We did lots of excursions and all the places are from the Hotel reachable, we visited Long Waterfall and was very helpful and excellent."
        />

        <ReviewCard
          name="Keanu Repes"
          image="https://i.pravatar.cc/100?img=2"
          rating={3}
          text="Hotel reachable, we visited waterfall and staff was very helpful. Overall experience was good."
        />

        <div className="flex justify-end gap-3 mt-4">
          <button className="bg-green-500 p-2 rounded-full hover:bg-green-600">
            <CheckCircle className="text-white" size={20} />
          </button>

          <button className="bg-red-500 p-2 rounded-full hover:bg-red-600">
            <XCircle className="text-white" size={20} />
          </button>
        </div>

      </div>
    </div>
  );
};

export default ProductTabs;

