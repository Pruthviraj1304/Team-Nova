import { Hero } from "../sections/Hero";
import { StatsBar } from "../sections/StatsBar";
import { Problem } from "../sections/Problem";
import { Features } from "../sections/Features";
import { Hardware } from "../sections/Hardware";
import { HowItWorks } from "../sections/HowItWorks";
import { Modes } from "../sections/Modes";
import { Applications } from "../sections/Applications";
import { Advantages } from "../sections/Advantages";
import { CTA } from "../sections/CTA";

export function Landing() {
  return (
    <>
      <Hero />
      <StatsBar />
      <Problem />
      <Features />
      <Hardware />
      <HowItWorks />
      <Modes />
      <Applications />
      <Advantages />
      <CTA />
    </>
  );
}
