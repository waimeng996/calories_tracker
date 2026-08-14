'use client';

interface PhotoCaptureProps {
  onCapture: (file: File) => void;
}

export default function PhotoCapture({ onCapture }: PhotoCaptureProps) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
  }

  return (
    <div className="flex gap-3">
      <label className="flex-1 cursor-pointer rounded border-2 border-dashed border-gray-400 p-6 text-center">
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
        📷 拍照
      </label>
      <label className="flex-1 cursor-pointer rounded border-2 border-dashed border-gray-400 p-6 text-center">
        <input type="file" accept="image/*" className="hidden" onChange={handleChange} />
        🖼️ 从相册选
      </label>
    </div>
  );
}
