import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface UnauthorizedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UnauthorizedModal({ isOpen, onClose }: UnauthorizedModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-up">
        <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold">Access Denied</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <p className="text-gray-700 mb-4">
            You are not authorized to access this application.
          </p>
          
          <div className="bg-piano-cream/50 border border-piano-gold/30 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-piano-wine mb-2">Access Requirements:</h3>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start">
                <span className="text-piano-gold mr-2">•</span>
                <span><strong>Admin users:</strong> Must have admin role in the organization</span>
              </li>
              <li className="flex items-start">
                <span className="text-piano-gold mr-2">•</span>
                <span><strong>Jury members:</strong> Must have "jury" in email, username, or name</span>
              </li>
            </ul>
          </div>
          
          <p className="text-sm text-gray-500 mb-4">
            If you believe you should have access, please contact your administrator.
          </p>
          
          <button
            onClick={onClose}
            className="w-full py-3 bg-piano-wine text-white rounded-lg font-medium hover:bg-piano-wine/90 transition-colors duration-200"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
} 