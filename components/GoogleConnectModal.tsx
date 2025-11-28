import React from 'react';
import { X, Check, Calendar, ShieldCheck } from 'lucide-react';

interface GoogleConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
  isLoading: boolean;
}

export const GoogleConnectModal: React.FC<GoogleConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={isLoading ? undefined : onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
        
        {/* Header */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            Google カレンダー連携
          </h3>
          <button 
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 flex flex-col items-center text-center">
          
          <div className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center mb-6 border border-gray-100 p-3">
             {/* Google "G" Logo SVG */}
             <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-full h-full block">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
             </svg>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Googleアカウントでログイン
          </h2>
          
          <p className="text-gray-500 mb-8 leading-relaxed">
            Googleカレンダーの予定をOptiPlanに取り込み、<br/>
            AIが最適なスケジュールを提案できるようにします。
          </p>

          <div className="w-full space-y-3 bg-indigo-50/50 p-4 rounded-xl mb-8 text-left">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div>
                <span className="block text-sm font-semibold text-gray-800">予定の同期</span>
                <span className="block text-xs text-gray-500">Googleカレンダーの既存の予定を表示します</span>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div>
                <span className="block text-sm font-semibold text-gray-800">プライバシー保護</span>
                <span className="block text-xs text-gray-500">データはブラウザ内でのみ使用されます</span>
              </div>
            </div>
          </div>

          <button
            onClick={onConnect}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow-md active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
               <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                 <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.11c-.22-.66-.35-1.36-.35-2.11s.13-1.45.35-2.11V7.05H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.95l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 4.62c1.61 0 3.06.56 4.23 1.64l3.18-3.18C17.45 1.19 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.05l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Googleでログインして連携</span>
              </>
            )}
          </button>
          
          <p className="mt-4 text-xs text-gray-400">
             続行することで、利用規約とプライバシーポリシーに同意したことになります。
          </p>

        </div>
      </div>
    </div>
  );
};