import Nav from "@/components/Nav";
import TuriBot from "@/components/TuriBot";
import TravelHero from "@/components/travel/TravelHero";

export default function Home() {
  return (
    <main className="min-h-svh overflow-x-clip">
      <Nav />
      <TravelHero />
      <TuriBot />
    </main>
  );
}
