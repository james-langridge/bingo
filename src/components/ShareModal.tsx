import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameCode: string;
  gameTitle: string;
  adminToken?: string;
}

export function ShareModal({ isOpen, onClose, gameCode, gameTitle, adminToken }: ShareModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  
  const playerUrl = `${window.location.origin}/game/${gameCode}`;
  const adminUrl = adminToken ? `${window.location.origin}/game/${gameCode}/admin/${adminToken}` : null;
  
  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, playerUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#8b5cf6',
          light: '#ffffff'
        }
      });
    }
  }, [isOpen, playerUrl]);
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = () => {
    const shareText = `Join my Family Bingo game "${gameTitle}"!\n\nGame Code: ${gameCode}\nPlay at: ${playerUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: gameTitle,
        text: shareText,
        url: playerUrl
      });
    } else {
      handleCopy(shareText);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-slideUp"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl"
        >
          ×
        </button>
        
        <h2 className="text-2xl font-bold text-center mb-4">Share Game</h2>
        
        <div className="text-center mb-4">
          <p className="text-lg font-semibold text-gray-800">{gameTitle}</p>
          <p className="text-3xl font-mono font-bold text-purple-600 my-2">{gameCode}</p>
        </div>
        
        <div className="flex justify-center mb-4">
          <canvas ref={canvasRef} className="border-2 border-purple-200 rounded-lg" />
        </div>
        
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Player Link:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={playerUrl}
                readOnly
                className="flex-1 px-2 py-1 text-sm bg-white border rounded font-mono"
              />
              <button
                onClick={() => handleCopy(playerUrl)}
                className="px-3 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600"
              >
                Copy
              </button>
            </div>
          </div>
          
          {adminUrl && (
            <div className="p-3 bg-yellow-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Admin Link (keep private!):</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={adminUrl}
                  readOnly
                  className="flex-1 px-2 py-1 text-sm bg-white border rounded font-mono"
                />
                <button
                  onClick={() => handleCopy(adminUrl)}
                  className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
          
          <button
            onClick={handleShare}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all"
          >
            {'share' in navigator ? 'Share Game' : 'Copy Share Text'}
          </button>
          
          {copied && (
            <p className="text-center text-green-600 text-sm animate-fadeIn">
              Copied to clipboard!
            </p>
          )}
        </div>
      </div>
      
      <style>{`
        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}