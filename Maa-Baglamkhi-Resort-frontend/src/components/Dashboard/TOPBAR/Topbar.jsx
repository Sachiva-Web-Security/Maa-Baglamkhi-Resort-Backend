import { HiOutlineBell, HiOutlineClipboardDocumentList } from "react-icons/hi2";
import { FiSearch } from "react-icons/fi";
import { useState } from "react";

const TopBar = () => {
    const [search, setSearch] = useState("");

    const handleSearch = (e) => {
        if (e.key === "Enter") {
            console.log("Search:", search);
        }
    };

    return (
        <div className="w-full bg-slate-900/80 backdrop-blur-md shadow-lg rounded-2xl px-5 py-3 flex items-center justify-between border border-slate-700">

            {/* Search */}
            <div className="flex items-center bg-slate-800 px-4 py-2 rounded-xl w-[320px] focus-within:ring-2 ring-blue-500 transition-all">

                <FiSearch className="text-gray-400 text-lg mr-3" />

                <input
                    type="text"
                    placeholder="Search anything..."
                    className="bg-transparent outline-none text-white w-full placeholder-gray-400"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={handleSearch}
                />
            </div>

            {/* Icons */}
            <div className="flex items-center gap-6 text-white text-xl">

                {/* Notifications */}
                <div className="relative group cursor-pointer">
                    <div className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600 transition-all">
                        <HiOutlineBell />
                    </div>

                    <span className="absolute -top-2 -right-2 text-xs bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full px-1.5 py-0.5">
                        8
                    </span>
                </div>

                {/* Tasks */}
                <div className="relative group cursor-pointer">
                    <div className="p-2 rounded-xl bg-slate-800 hover:bg-purple-600 transition-all">
                        <HiOutlineClipboardDocumentList />
                    </div>

                    <span className="absolute -top-2 -right-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-1.5 py-0.5">
                        8
                    </span>
                </div>

            </div>

        </div>
    );
};

export default TopBar;