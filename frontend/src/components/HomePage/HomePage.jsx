import HeroSection from "./HeroSection";
import ProductTabs from "./ProductTabs";
import WhySection from "./WhySection";
import States from "./States";

const HomePage = () => {
  return (
    <div className="space-y-6">

      <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">
        <HeroSection />
      </div>

      <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">
        <ProductTabs />
      </div>

      <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">
        <WhySection />
      </div>

      <div className="bg-[#1e293b] rounded-2xl p-4 shadow-lg">
        <States />
      </div>

    </div>
  );
};

export default HomePage;