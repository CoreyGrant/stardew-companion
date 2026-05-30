import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
  /** Optional label for the section — shown in the error title for easier debugging. */
  section?: string;
}

interface State {
  error: Error | null;
}

/**
 * Page-level error boundary. Catches runtime errors in any child subtree and
 * renders a recovery UI instead of a blank screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.section ?? 'App', error, info.componentStack);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="page error-boundary">
        <h1 className="page__title">Something went wrong</h1>
        <p className="error-boundary__message">{error.message}</p>
        <p className="error-boundary__hint">
          Try navigating back to the home page. If this keeps happening, open the browser console
          for details.
        </p>
        <div className="error-boundary__actions">
          <Link to="/" className="btn btn--primary" onClick={this.handleReset}>
            Home
          </Link>
          <button className="btn" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      </div>
    );
  }
}
