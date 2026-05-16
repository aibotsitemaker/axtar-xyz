import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Production-da console.log yox
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary:', error, info)
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Xəta baş verdi</h2>
            <p className="text-gray-500 text-sm mb-6">Gözlənilməz bir xəta baş verdi. Səhifəni yeniləyin.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="btn-primary py-2.5 px-6"
              >
                🔄 Yenilə
              </button>
              <button
                onClick={() => { this.setState({ hasError: false }); window.location.href = '/' }}
                className="btn-secondary py-2.5 px-6"
              >
                🏠 Ana səhifə
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
