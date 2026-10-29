import React, { Component, ErrorInfo, ReactNode } from "react";
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ApexAnimehub page error", error, info.componentStack);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-recovery" role="alert">
        <img src="/apex-logo.png" width="48" height="48" alt="ApexAnimehub" />
        <h1>This page couldn’t load</h1>
        <p>
          Try opening it again. Your saved lists and watch progress are kept.
        </p>
        <div>
          <button onClick={() => this.setState({ failed: false })}>
            Try again
          </button>
          <button onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </main>
    );
  }
}
