import React from "react";
import { X } from "lucide-react";

export function AdminModal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-4 select-none md:select-text">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full md:max-w-2xl bg-ipl-surface border-t border-white/10 rounded-t-[28px] md:rounded-3xl shadow-2xl z-10 flex flex-col pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8 p-6 md:p-8 md:border-t-4 md:border-ipl-gold animate-in slide-in-from-bottom md:zoom-in-95 duration-300 max-h-[90vh] md:max-h-[85vh]">
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-5 shrink-0 md:hidden" />
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors p-1 active:scale-90 z-20">
          <X className="w-6 h-6" />
        </button>
        {title && <div className="mb-6 pr-8">{title}</div>}
        <div className="overflow-y-auto scrollbar-hide flex-1 max-md:-mx-2 max-md:px-2 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
}
