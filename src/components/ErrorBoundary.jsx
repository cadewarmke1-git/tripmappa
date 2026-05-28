import { Component } from "react";

/** Catches render errors so one failed panel does not white-screen the app. */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`ErrorBoundary (${this.props.label || "panel"}):`, error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="error-boundary-fallback" role="alert">
          <p className="error-boundary-title">{this.props.title || "Something went wrong"}</p>
          <p className="error-boundary-msg">{error.message || "An unexpected error occurred."}</p>
          <button type="button" className="error-boundary-retry" onClick={this.handleRetry}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
