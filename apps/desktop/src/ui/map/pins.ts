// Player pins on the canvas map: registered users, sightings, the LFRP beacon and the staleness ring.
import { STATUS_META, LFRP_COLOR, presenceOf, type Player } from "../../model";
import { initials } from "../bits";

/** A position older than this is drawn as an estimate (dashed ring, age in the label). */
export const STALE_POS_MS = 45_000;

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export interface PinStyle {
  hovered: boolean;
  dim: boolean; // filtered out by the search box
  showName: boolean;
  iso: boolean; // 3D mode: add a contact shadow on the plane the pin stands on
  t: number; // animation clock (ms)
}

export function drawPin(ctx: CanvasRenderingContext2D, p: Player, sx: number, sy: number, o: PinStyle) {
  if (o.iso) {
    const r0 = p.isMe ? 12 : 9;
    const sh = ctx.createRadialGradient(sx, sy + r0 * 0.9, 0, sx, sy + r0 * 0.9, r0 * 1.6);
    sh.addColorStop(0, "rgba(0,0,0,.45)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.ellipse(sx, sy + r0 * 0.9, r0 * 1.6, r0 * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // The combat log only records a position when something happens (an ability, a buff, a target). While
  // people stand and talk nothing is logged, so a pin can lag reality by minutes: say so, visibly.
  const ageMs = Math.max(0, Date.now() - p.lastActive),
    stale = ageMs > STALE_POS_MS,
    idle = presenceOf(p.lastActive) === "idle";
  ctx.globalAlpha = o.dim ? 0.22 : idle ? 0.55 : 1;
  const col = p.isSeen ? "#8b8f98" : STATUS_META[p.status].color;
  const r = p.isMe ? 12 : o.hovered ? 11 : p.isSeen ? 8 : 9;
  if (p.isSeen) ctx.globalAlpha *= o.hovered ? 0.95 : 0.7;
  const beacon = !!p.lfrp && p.status !== "invisible";
  if (stale) {
    // uncertainty ring: grows with age (walking speed ≈ 1 m/s, capped), "somewhere around here"
    const ur = Math.min(46, r + 6 + ageMs / 20_000);
    ctx.strokeStyle = p.isSeen ? "rgba(139,143,152,.35)" : "rgba(229,231,235,.28)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(sx, sy, ur, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (p.isMe && !beacon) {
    // the LFRP sonar replaces the "me" pulse, never both
    const pulse = 1 + 0.35 * (0.5 + 0.5 * Math.sin(o.t / 380));
    ctx.strokeStyle = "rgba(143,220,255,.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 1.9 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (p.isSeen) {
    // unregistered sighting: hollow monochrome ghost, no status, no glow
    ctx.fillStyle = "rgba(20,22,27,.85)";
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = o.hovered ? 2 : 1.5;
    ctx.strokeStyle = col;
    ctx.setLineDash([2.5, 2.5]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#b5b9c2";
    ctx.font = "600 8px system-ui, sans-serif";
    ctx.fillText(initials(p.name), sx, sy + 0.5);
  } else {
    // registered Hydian user: status glow + coloured avatar + presence dot (bottom-right)
    const rg = ctx.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 2.2);
    rg.addColorStop(0, col + "66");
    rg.addColorStop(1, col + "00");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    const grad = ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r);
    grad.addColorStop(0, `hsl(${p.hue} 70% 58%)`);
    grad.addColorStop(1, `hsl(${p.hue + 40} 70% 40%)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = o.hovered || p.isMe ? 2.5 : 2;
    ctx.strokeStyle = p.isMe ? "#e0f2fe" : "rgba(6,9,26,.9)";
    ctx.stroke();
    if (beacon) {
      // sonar beacon: two expanding pulses + a solid ring, "looking for someone"
      for (let k = 0; k < 2; k++) {
        const ph = (o.t / 1600 + k * 0.5) % 1;
        ctx.strokeStyle = `rgba(143,220,255,${(1 - ph) * 0.8})`;
        ctx.lineWidth = 2.5 - ph * 1.5;
        ctx.beginPath();
        ctx.arc(sx, sy, r * (1.3 + ph * 2.6), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = LFRP_COLOR;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sx, sy, r + 3.5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${p.isMe ? 10 : 9}px system-ui, sans-serif`;
    ctx.fillText(initials(p.name), sx, sy + 0.5);
    const dr = Math.max(3, r * 0.4),
      dx = sx + r * 0.72,
      dy = sy + r * 0.72;
    ctx.fillStyle = "#06091a";
    ctx.beginPath();
    ctx.arc(dx, dy, dr + 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.showName || o.hovered || p.isMe) {
    ctx.font = `${p.isMe ? 700 : 600} 11px system-ui, sans-serif`;
    const label =
      (p.isMe ? `${p.name} (you)` : p.name) +
      (beacon ? " · LFRP" : "") +
      (p.instance ? ` · inst ${p.instance}` : "") +
      (stale ? ` · ${ageMs < 90_000 ? `${Math.round(ageMs / 1000)}s` : `${Math.round(ageMs / 60000)}m`} ago` : "");
    const w = ctx.measureText(label).width + 10;
    ctx.fillStyle = beacon ? "rgba(14,116,144,.92)" : "rgba(6,9,26,.85)";
    roundRect(ctx, sx - w / 2, sy + r + 6, w, 16, 4);
    ctx.fill();
    ctx.fillStyle = beacon ? "#e0f7ff" : p.isMe ? "#bfe9ff" : p.isSeen ? "#9aa0ab" : "#e5e7eb";
    ctx.fillText(label, sx, sy + r + 14);
  }
  ctx.globalAlpha = 1;
}
