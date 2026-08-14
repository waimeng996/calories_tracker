'use client';

interface PhotoLightboxProps {
  src: string;
  onClose: () => void;
}

export default function PhotoLightbox({ src, onClose }: PhotoLightboxProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="关闭"
        className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
      <img src={src} alt="相片大图" className="max-h-full max-w-full rounded object-contain" />
    </div>
  );
}
