import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Last line of defence: a crash in one view shows what broke instead of an empty window. */
export class Boundary extends Component<{ children: ReactNode; name: string }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: String((e as Error)?.message ?? e) };
  }
  componentDidCatch(e: unknown) {
    console.error(`[${this.props.name}]`, e);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <b>Something went wrong in the {this.props.name}.</b>
        <code>{this.state.error}</code>
        <div>
          <Button size="sm" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>{" "}
          <Button variant="secondary" size="sm" onClick={() => location.reload()}>
            Reload Hydian
          </Button>
        </div>
      </div>
    );
  }
}
