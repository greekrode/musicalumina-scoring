import { MessageSquare, X } from 'lucide-react';

interface RemarksModalProps {
  remarks: Array<{ jury_name: string; remarks: string }>;
  onClose: () => void;
}

export default function RemarksModal({ remarks, onClose }: RemarksModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="bg-piano-wine p-4 text-white">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Jury Remarks</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {remarks.length > 0 ? (
            <div className="space-y-4">
              {remarks.map((remark, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                  <div className="flex items-center mb-2">
                    <MessageSquare className="w-4 h-4 text-piano-wine mr-2" />
                    <h4 className="font-medium text-piano-wine">
                      {remark.jury_name || 'Unknown Jury'}
                    </h4>
                  </div>
                  <p className="text-gray-700 text-sm leading-relaxed">
                    {remark.remarks}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Remarks
              </h3>
              <p className="text-gray-500">
                No jury members have provided remarks for this participant yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
