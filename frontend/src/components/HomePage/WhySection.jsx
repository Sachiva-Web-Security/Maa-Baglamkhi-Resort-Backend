const WhySection = () => {
  return (
    <section className="bg-[#071c2c] text-white py-20 text-center">
      <h2 className="text-4xl font-semibold mb-4">
        Simple & Powerful
      </h2>

      <p className="text-gray-300 max-w-xl mx-auto mb-12">
        We craft top-quality products for peak performance.
      </p>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        <div className="bg-[#0d2b40] p-8 rounded-3xl">
          <h3 className="text-xl font-semibold mb-2">Continuous Innovation</h3>
          <p className="text-gray-400">
            We continuously research and improve features.
          </p>
        </div>

        <div className="bg-[#0d2b40] p-8 rounded-3xl">
          <h3 className="text-xl font-semibold mb-2">Simplicity</h3>
          <p className="text-gray-400">
            User-centric design with creative interfaces.
          </p>
        </div>

        <div className="bg-[#0d2b40] p-8 rounded-3xl">
          <h3 className="text-xl font-semibold mb-2">24x7 Support</h3>
          <p className="text-gray-400">
            Dedicated support team ready anytime.
          </p>
        </div>
      </div>
    </section>
  );
};

export default WhySection;
