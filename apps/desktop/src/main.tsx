import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./ui/App";
import { Overlay } from "./ui/Overlay";
import { LogoDefs } from "./ui/Logo";
import { TooltipProvider } from "@/components/ui/tooltip";
import { OS } from "./core/platform";
import "./styles/tailwind.css";
import "./styles/fonts.css";
import "./styles/app.css";
import "./styles/game-link.css";
import "./styles/onboarding.css";
import "./styles/tools.css";

// The same bundle serves two windows: the app, and the transparent in-game overlay (index.html?overlay=1).
const overlay = new URLSearchParams(location.search).has("overlay");
document.documentElement.dataset.os = OS; // macOS chrome (traffic-light inset) is CSS-only
document.documentElement.classList.add("dark"); // shadcn: the app has one theme
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LogoDefs />
    <TooltipProvider>{overlay ? <Overlay /> : <App />}</TooltipProvider>
  </StrictMode>,
);
