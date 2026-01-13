// CSS imported in layout.tsx
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import GapSection from "./components/GapSection";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import Audience from "./components/Audience";
import Promise from "./components/Promise";
import Demo from "./components/Demo";
import Pricing from "./components/Pricing";
import Academy from "./components/Academy";
import FAQ from "./components/FAQ";
import CTA from "./components/CTA";
import Footer from "./components/Footer";
import ScrollObserver from "./components/ScrollObserver";

// Metadata managed in layout.tsx

export default function FlowBridgePage() {
    return (
        <div className="fb-wrapper">
            <ScrollObserver />
            <Nav />
            <Hero />
            <GapSection />
            <HowItWorks />
            <Features />
            <Audience />
            <Promise />
            <Demo />
            <Pricing />
            <Academy />
            <FAQ />
            <CTA />
            <Footer />
        </div>
    );
}
