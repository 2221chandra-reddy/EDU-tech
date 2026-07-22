import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected error' };
  }

  componentDidCatch(error, info) {
    console.error('[UI ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-sand px-4 text-center">
          <h1 className="font-display text-3xl text-forest">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-slate">{this.state.message}</p>
          <button
            type="button"
            className="mt-6 rounded-xl bg-forest px-4 py-2 text-sm text-sand"
            onClick={() => window.location.assign('/')}
          >
            Go home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
