"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-red-500 text-4xl mb-4">⚠</div>
            <h2 className="text-lg font-medium text-gray-900 mb-2">エラーが発生しました</h2>
            <p className="text-sm text-gray-500 mb-4">
              {this.state.error?.message || "予期しないエラーです"}
            </p>
            <Button onClick={() => this.setState({ hasError: false, error: undefined })}>
              再試行
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
