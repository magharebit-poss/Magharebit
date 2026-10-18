'use client';

import React, {
  Component,
  type ErrorInfo,
  type JSXElementConstructor,
  type ReactNode,
} from 'react';

interface Props {
  children: ReactNode;
  /** Optional custom fallback UI. Defaults to the Arabic error card. */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Class-based Error Boundary implementation (must be a class component).
 * Not exported directly — see the `ErrorBoundary` function wrapper below.
 */
class ErrorBoundaryClass extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Wire to Sentry or similar in production — see DEPLOY.md
    console.error('[ErrorBoundary] caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            borderRadius: '12px',
            background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.18)',
            textAlign: 'center',
            fontFamily: 'Noto Naskh Arabic, Cairo, serif',
          }}
        >
          <p style={{ fontSize: '2rem', marginBottom: '8px' }}>⚠️</p>
          <p style={{ fontSize: '14px', color: '#DC2626', fontWeight: 600, marginBottom: '4px' }}>
            حدث خطأ في تحميل هذا القسم
          </p>
          <p style={{ fontSize: '12px', color: '#9CA3AF', marginBottom: '16px' }}>
            يرجى إعادة تحميل الصفحة أو المحاولة لاحقاً
          </p>
          <button
            onClick={this.handleReset}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#0F3D2A',
              background: 'transparent',
              border: '1px solid #0F3D2A',
              borderRadius: '8px',
              padding: '8px 20px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Exported wrapper — a genuine function component that delegates to the class
 * implementation above. This sidesteps the `refs` property type mismatch
 * between react@18 runtime and @types/react@19, where class components
 * no longer satisfy the JSX element constructor constraint due to a breaking
 * change in how React 19 types handle string refs (removed).
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeInteractiveComponent />
 *   </ErrorBoundary>
 */
export default function ErrorBoundary(props: Props): React.JSX.Element {
  // Cast to JSXElementConstructor<Props> (a react-native type that already
  // contains `any` in its definition) sidesteps the class `refs` mismatch
  // without introducing explicit `any` in our own code.
  // Runtime: React detects the class via prototype.isReactComponent and
  // instantiates it correctly regardless of TypeScript's view.
  const EC = ErrorBoundaryClass as unknown as JSXElementConstructor<Props>;
  return React.createElement(EC, props) as React.JSX.Element;
}
