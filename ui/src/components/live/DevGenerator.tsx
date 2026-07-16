import React, { useState } from 'react';
import { Beaker, Settings2, X, Send } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { toast } from 'sonner';

export const DevGenerator: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  
  if (import.meta.env.PROD) {
    return null;
  }

  const generateEvent = async (type: string) => {
    setSending(true);
    try {
      const payloads: Record<string, any> = {
        'Solar Order': { type: 'ORDER_CREATED', amount: 5000, items: ['Solar Panel X1'] },
        'Payment': { type: 'PAYMENT_RECEIVED', amount: 5000, status: 'success' },
        'Invoice': { type: 'INVOICE_GENERATED', invoiceId: `INV-${Date.now()}` },
        'Customer': { type: 'CUSTOMER_CREATED', name: 'Acme Corp' },
      };

      await apiFetch('/api/v1/events/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloads[type] || payloads['Solar Order']),
      });
      toast.success(`Injected ${type} event`);
    } catch (err) {
      toast.error('Failed to inject event');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 bg-slate-800 border border-slate-700 p-4 rounded-xl shadow-2xl w-64 animate-in slide-in-from-bottom-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Settings2 size={16} /> Dev Generator
            </h4>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-200">
              <X size={16} />
            </button>
          </div>
          
          <div className="flex flex-col gap-2">
            {['Solar Order', 'Payment', 'Invoice', 'Customer'].map((type) => (
              <button
                key={type}
                disabled={sending}
                onClick={() => generateEvent(type)}
                className="flex items-center justify-between px-3 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-sm text-slate-300 transition-colors disabled:opacity-50"
              >
                <span>{type}</span>
                <Send size={14} className="text-slate-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-4 rounded-full shadow-2xl shadow-indigo-500/20 text-white transition-all transform hover:scale-105 active:scale-95 ${
          isOpen ? 'bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-500'
        }`}
      >
        {isOpen ? <X size={24} /> : <Beaker size={24} />}
      </button>
    </div>
  );
};
