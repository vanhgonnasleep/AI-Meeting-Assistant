import { GitHubMark, GoogleMark } from '../../../shared/ui/BrandMarks.jsx';
import { API_BASE } from '../api-client.js';

export default function ProviderButtons({ providers }) {
  return (
    <div className="auth-provider-buttons">
      {[
        ['google', 'Google', GoogleMark],
        ['github', 'GitHub', GitHubMark],
      ].map(([provider, label, Mark]) => (
        <button
          key={provider}
          type="button"
          disabled={!providers[provider]}
          onClick={() =>
            window.location.assign(`${API_BASE}/api/auth/${provider}/login`)
          }
        >
          <Mark size={20} />
          Continue with {label}
          <span>↗</span>
        </button>
      ))}
    </div>
  );
}
