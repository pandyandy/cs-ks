'use client';

import Image from 'next/image';

export default function Header({ text = '' }) {
  return (
    <div className="rounded-xl mb-5 shadow-elevated" style={{ backgroundColor: '#266fee' }}>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-white text-xl font-semibold tracking-tight">
            Digitální kulaté stoly
          </h1>
          {text && (
            <p className="text-blue-200 text-xs font-medium">{text}</p>
          )}
        </div>
        <Image
          src="/logo.png"
          alt="Logo"
          width={120}
          height={60}
          className="object-contain opacity-90"
          priority
        />
      </div>
    </div>
  );
}
