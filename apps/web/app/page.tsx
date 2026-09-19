import { AppShot } from "@/components/AppShot";
import { Hero } from "@/components/Hero";
import { HoloMap } from "@/components/HoloMap";
import { Mission } from "@/components/Mission";
import { Showcase } from "@/components/Showcase";
import { DataReadout, Download, Faq, Route } from "@/components/Sections";
import { Why } from "@/components/Why";

export default function Home() {
  return (
    <main>
      <Hero />
      <AppShot caption="Darth Malgus · Nar Shaddaa · Lower Promenade" />
      <Mission />
      <Why />
      <HoloMap />
      <Showcase />
      <DataReadout />
      <Route />
      <Faq />
      <Download />
    </main>
  );
}
