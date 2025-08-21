'use client';

import React from 'react';
import PricingClient from './PricingClient';
import { X } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPurchaseComplete?: () => void;
}

export default function PricingModal({ isOpen, onClose, onPurchaseComplete }: PricingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-extrabold font-heading tracking-tighter mb-4 leading-tight">
              Upgrade your plan
            </h1>
          </div>
        <PricingClient onPurchaseComplete={onPurchaseComplete} />
      </div>
    </div>
  );
}
