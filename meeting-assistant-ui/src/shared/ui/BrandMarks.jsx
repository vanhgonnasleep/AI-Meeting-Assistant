export function GitHubMark({ size = 22 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .8a11.5 11.5 0 0 0-3.64 22.4c.58.1.78-.25.78-.55v-2.1c-3.2.7-3.88-1.35-3.88-1.35-.52-1.32-1.28-1.67-1.28-1.67-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.18 1.77 1.18 1.03 1.76 2.69 1.25 3.35.95.1-.75.4-1.25.73-1.54-2.55-.3-5.23-1.28-5.23-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.39c.98 0 1.96.13 2.88.39 2.19-1.49 3.15-1.18 3.15-1.18.63 1.58.23 2.75.12 3.04.73.81 1.17 1.83 1.17 3.09 0 4.42-2.69 5.39-5.25 5.68.42.36.78 1.06.78 2.14v3.1c0 .31.21.66.79.55A11.5 11.5 0 0 0 12 .8Z" />
  </svg>;
}

export function GmailMark({ size = 25 }) {
  return <svg width={size} height={size} viewBox="0 0 28 22" fill="none" aria-hidden="true">
    <path d="M2 20V5l5 4v11H2Z" fill="#4285F4" /><path d="M21 20V9l5-4v15h-5Z" fill="#34A853" />
    <path d="m7 9 7 5 7-5V3l-7 5-7-5v6Z" fill="#EA4335" /><path d="M2 5V3c0-2 2-2.7 3.5-1.6L7 3v6L2 5Z" fill="#C5221F" />
    <path d="m21 3 1.5-1.6C24-.7 26 1 26 3v2l-5 4V3Z" fill="#FBBC04" />
  </svg>;
}

export function GoogleMark({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.41l-3.23-2.51c-.9.6-2.04.96-3.38.96-2.61 0-4.82-1.76-5.61-4.12H3.05v2.59A10 10 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.49H3.05a10 10 0 0 0 0 9.02l3.34-2.59Z" />
    <path fill="#EA4335" d="M12 5.96c1.47 0 2.79.51 3.82 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.95 5.49l3.34 2.59C7.18 7.72 9.39 5.96 12 5.96Z" />
  </svg>;
}

export function ClarionMark({ size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M7 14v4m6-11v18m6-23v28m6-17v6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>;
}

export function ClarionWordmark({ 
  markSize = 19, 
  textSize = 'text-[20px]', 
  showTagline = false,
  tagline = 'Private Intelligence',
  className = '' 
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <span className="grid place-items-center w-[32px] h-[32px] rounded-[10px] text-white bg-[#6370ce] shadow-[inset_0_1px_0_#9eabed] shrink-0">
        <ClarionMark size={markSize} />
      </span>
      <div className="min-w-0 flex flex-col justify-center">
        <span className={`font-semibold tracking-[-0.8px] text-[#2b3559] leading-tight flex items-baseline ${textSize}`}>
          clarion<span className="text-[#5363c9] ml-[-0.05em]">.</span>
        </span>
        {showTagline && (
          <span className="text-[10px] text-slate-500 tracking-normal font-normal leading-tight mt-0.5">
            {tagline}
          </span>
        )}
      </div>
    </div>
  );
}
