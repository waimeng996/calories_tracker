'use client';

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
}

export default function PhotoCapture({ onCapture }: PhotoCaptureProps) {
  return (
    <label className="block cursor-pointer rounded border-2 border-dashed border-gray-400 p-6 text-center">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onCapture(file);
        }}
      />
      拍照记录
    </label>
  );
}
