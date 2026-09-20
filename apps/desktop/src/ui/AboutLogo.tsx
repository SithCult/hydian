import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Logo } from "./Logo";
import "../styles/sith-code.css";

const CODE = [
  "Peace is a lie. There is only passion.",
  "Through passion, I gain strength.",
  "Through strength, I gain power.",
  "Through power, I gain victory.",
  "Through victory, my chains are broken.",
  "The Force shall free me.",
];

export function AboutLogo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="about-logo" aria-label="Hydian logo">
          <Logo size={40} />
        </button>
      </DialogTrigger>
      <DialogContent className="sith-dialog" showCloseButton={false}>
        <div className="sith-crest" aria-hidden="true">
          <Logo size={52} />
        </div>
        <DialogTitle className="sith-title">The Sith Code</DialogTitle>
        <DialogDescription className="sr-only">{CODE.join(" ")}</DialogDescription>
        <blockquote className="sith-code" aria-hidden="true">
          {CODE.map((line, index) => (
            <p key={line} style={{ animationDelay: `${0.65 + index * 1.65}s` }}>
              {line}
            </p>
          ))}
        </blockquote>
        <DialogClose asChild>
          <Button variant="outline" className="sith-release">
            Break free
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
