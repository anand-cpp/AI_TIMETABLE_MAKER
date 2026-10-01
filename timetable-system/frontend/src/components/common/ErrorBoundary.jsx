import React from 'react';
import Button from '../ui/Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-[var(--bg-surface)] border border-[var(--border)] rounded-md space-y-4 font-sans my-4">
          <div className="w-12 h-12 rounded-full bg-[var(--error)]/10 text-[var(--error)] flex items-center justify-center mx-auto text-xl font-bold">
            ⚠️
          </div>
          <h3 className="font-serif text-xl font-normal text-[var(--text-primary)]">
            Something went wrong in this component
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <Button
            size="sm"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
