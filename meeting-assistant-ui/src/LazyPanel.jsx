import { Component, Suspense, lazy } from 'react';

// Keep failures below the owner of the current meeting's unsaved state.
export default class LazyPanel extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, Panel: lazy(props.load) };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  // React caches rejected lazy imports; retry needs a fresh lazy component.
  retry = () => this.setState({ failed: false, Panel: lazy(this.props.load) });

  render() {
    if (this.state.failed) {
      return (
        <section role="alert" className={this.props.errorClassName || 'rounded-2xl border border-amber-200 bg-white p-6 space-y-3'}>
          <p className="text-sm text-slate-800">Unable to load {this.props.name || 'this panel'}. Your current meeting is still available.</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={this.retry} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">Retry loading</button>
            {this.props.onClose && <button type="button" onClick={this.props.onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700">Close panel</button>}
          </div>
        </section>
      );
    }
    return <Suspense fallback={this.props.fallback}>{this.props.children(this.state.Panel)}</Suspense>;
  }
}
