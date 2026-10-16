const BanquetMenu = ({ menuPackages }) => {

    return (
        <div className="grid md:grid-cols-3 gap-4 p-4">

            {menuPackages.map((pkg) => (

                <div
                    key={pkg.id}
                    className="bg-[#0f172a] border border-white/10 rounded-xl p-4"
                >

                    <div className="text-lg font-bold text-white mb-2">
                        {pkg.name}
                    </div>

                    <div className="text-gray-300 mb-2">
                        ₹{pkg.perGuest} / Guest
                    </div>

                    <div className="text-gray-400 text-sm">
                        {pkg.description}
                    </div>

                </div>

            ))}

        </div>
    );
};

export default BanquetMenu;