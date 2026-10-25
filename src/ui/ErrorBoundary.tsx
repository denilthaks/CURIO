import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Keeps one broken screen from blanking the whole game. Saved progress is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode; resetKey: string }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CurioTrail screen error', error, info.componentStack);
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="panel-center card-solid error-state" role="alert">
        <h1>Something went wrong on this screen</h1>
        <p>Your saved progress is safe. Try going back to the map, or reload the page.</p>
        <p className="hint">Details: {this.state.error.message}</p>
        <div className="cta-row">
          <a className="btn btn-primary" href="#/map">Back to the map</a>
          <button type="button" className="btn btn-ghost" onClick={() => location.reload()}>Reload</button>
        </div>
      </section>
    );
  }
}
