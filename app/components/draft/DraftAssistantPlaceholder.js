'use client';

export default function DraftAssistantPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="text-5xl">🔗</div>
      <h2 className="text-xl font-bold text-white">Draft Assistant</h2>
      <p className="text-slate-400 text-sm max-w-md">
        Live draft sync with your Sleeper league — track picks in real time,
        get VORP suggestions on the clock, and see every team's roster as the
        draft unfolds.
      </p>
      <span className="px-3 py-1 rounded-full bg-violet-600/20 border border-violet-500/40 text-violet-300 text-xs font-medium">
        Coming soon
      </span>
    </div>
  );
}
