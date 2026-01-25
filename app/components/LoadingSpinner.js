'use client';

import { useState, useEffect } from 'react';

/**
 * Enhanced Loading Spinner with Football-themed animation
 * Features: Animated pitch, pulsing position dots, loading stages
 */
export const LoadingSpinner = ({ message = "Loading..." }) => {
  const [loadingStage, setLoadingStage] = useState(0);
  const [dots, setDots] = useState('');

  const stages = [
    { text: 'Connecting to Sleeper', icon: '🔗' },
    { text: 'Fetching player data', icon: '📊' },
    { text: 'Loading predictions', icon: '🎯' },
    { text: 'Optimizing lineup', icon: '⚡' },
  ];

  // Cycle through loading stages
  useEffect(() => {
    const stageInterval = setInterval(() => {
      setLoadingStage(prev => (prev + 1) % stages.length);
    }, 2000);
    return () => clearInterval(stageInterval);
  }, []);

  // Animate dots
  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    return () => clearInterval(dotInterval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full max-w-md">
      {/* Football Pitch Animation */}
      <div className="relative w-64 h-40 mb-8">
        {/* Pitch background */}
        <div className="absolute inset-0 bg-gradient-to-b from-green-800 to-green-900 rounded-lg border-2 border-green-600 overflow-hidden">
          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-2 border-green-600 rounded-full opacity-50" />
          {/* Center line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-green-600 opacity-50" />
          {/* Penalty boxes */}
          <div className="absolute top-1/2 left-0 -translate-y-1/2 w-8 h-20 border-2 border-l-0 border-green-600 opacity-50" />
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-8 h-20 border-2 border-r-0 border-green-600 opacity-50" />
        </div>

        {/* Animated Position Dots - Formation 4-3-3 */}
        {/* GK */}
        <div
          className="absolute w-4 h-4 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50"
          style={{
            top: '50%',
            left: '8%',
            transform: 'translate(-50%, -50%)',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}
        />

        {/* Defenders */}
        {[20, 35, 65, 80].map((top, i) => (
          <div
            key={`def-${i}`}
            className="absolute w-4 h-4 rounded-full bg-green-400 shadow-lg shadow-green-400/50"
            style={{
              top: `${top}%`,
              left: '28%',
              transform: 'translate(-50%, -50%)',
              animation: `pulse 1.5s ease-in-out infinite ${i * 0.15}s`
            }}
          />
        ))}

        {/* Midfielders */}
        {[25, 50, 75].map((top, i) => (
          <div
            key={`mid-${i}`}
            className="absolute w-4 h-4 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50"
            style={{
              top: `${top}%`,
              left: '55%',
              transform: 'translate(-50%, -50%)',
              animation: `pulse 1.5s ease-in-out infinite ${i * 0.15 + 0.3}s`
            }}
          />
        ))}

        {/* Forwards */}
        {[25, 50, 75].map((top, i) => (
          <div
            key={`fwd-${i}`}
            className="absolute w-4 h-4 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50"
            style={{
              top: `${top}%`,
              left: '82%',
              transform: 'translate(-50%, -50%)',
              animation: `pulse 1.5s ease-in-out infinite ${i * 0.15 + 0.6}s`
            }}
          />
        ))}

        {/* Scanning line effect */}
        <div
          className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
          style={{ animation: 'scanLine 2s ease-in-out infinite' }}
        />
      </div>

      {/* App Title */}
      <h1 className="text-2xl font-bold text-white mb-2 tracking-wide">
        Fantasy FC Playbook
      </h1>

      {/* Loading Stage Indicator */}
      <div className="flex items-center gap-2 text-gray-300 mb-4">
        <span className="text-xl">{stages[loadingStage].icon}</span>
        <span className="font-medium">
          {stages[loadingStage].text}
          <span className="inline-block w-6 text-left">{dots}</span>
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 rounded-full"
          style={{
            width: '100%',
            animation: 'shimmer 1.5s ease-in-out infinite',
            backgroundSize: '200% 100%'
          }}
        />
      </div>

      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.3);
            opacity: 0.7;
          }
        }

        @keyframes scanLine {
          0% { transform: translateY(0); }
          100% { transform: translateY(160px); }
        }

        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
};

/**
 * Compact loading indicator for inline use
 */
export const LoadingDots = ({ className = '' }) => (
  <span className={`inline-flex gap-1 ${className}`}>
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
  </span>
);

/**
 * Skeleton loader for cards
 */
export const SkeletonCard = ({ className = '' }) => (
  <div className={`bg-gray-800 rounded-lg p-4 animate-pulse ${className}`}>
    <div className="h-4 bg-gray-700 rounded w-3/4 mb-3" />
    <div className="h-8 bg-gray-700 rounded w-1/2 mb-2" />
    <div className="h-3 bg-gray-700 rounded w-full" />
  </div>
);
