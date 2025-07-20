import { FeatureCard } from "@/components/FeatureCard";
import { Sprout, HeartPulse, Droplets, BadgeCheck, Bug, BotMessageSquare, ClipboardList } from "lucide-react";

const features = [
  {
    icon: <Sprout size={32} />,
    title: "Production",
    description: "Track harvest yields and planting schedules.",
    href: "/production",
  },
  {
    icon: <HeartPulse size={32} />,
    title: "Health",
    description: "Record plant health, diseases, and treatments.",
    href: "/health",
  },
  {
    icon: <Droplets size={32} />,
    title: "Irrigation",
    description: "Log irrigation schedules and water usage.",
    href: "/irrigation",
  },
  {
    icon: <BadgeCheck size={32} />,
    title: "Quality Control",
    description: "Input parameters for product quality.",
    href: "/quality-control",
  },
  {
    icon: <Bug size={32} />,
    title: "Biological Control",
    description: "Track agents for pest management.",
    href: "/biological-control",
  },
  {
    icon: <BotMessageSquare size={32} />,
    title: "AI Queries",
    description: "Ask questions about your field data.",
    href: "/queries",
  },
  {
    icon: <ClipboardList size={32} />,
    title: "Summary",
    description: "View a summary of all recorded data.",
    href: "/summary",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="text-4xl font-bold text-primary mb-2">Welcome to Brujos</h1>
      <p className="text-lg text-foreground/80 mb-10 max-w-2xl">
        Your all-in-one solution for smart field management. Track, analyze, and optimize your agricultural operations with ease.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full text-left">
        {features.map((feature) => (
          <FeatureCard key={feature.title} {...feature} />
        ))}
      </div>
    </div>
  );
}
