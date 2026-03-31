// Centralized gameweek status styling utilities
// Used by GameweekDisplay and DashboardHeader components

export function getGameweekStatusStyles(status) {
  const styles = {
    upcoming: {
      icon: '🏁',
      bg: 'bg-blue-900 border-blue-700',
      hover: 'hover:bg-blue-800 hover:border-blue-600',
      text: 'text-blue-100',
      subText: 'text-blue-200',
    },
    live: {
      icon: '🔴',
      bg: 'bg-red-900 border-red-700',
      hover: 'hover:bg-red-800 hover:border-red-600',
      text: 'text-red-100',
      subText: 'text-red-200',
    },
    completed: {
      icon: '✅',
      bg: 'bg-green-900 border-green-700',
      hover: 'hover:bg-green-800 hover:border-green-600',
      text: 'text-green-100',
      subText: 'text-green-200',
    },
  };

  return styles[status] || {
    icon: '⚽',
    bg: 'bg-slate-900 border-slate-700',
    hover: 'hover:bg-slate-800 hover:border-slate-600',
    text: 'text-slate-100',
    subText: 'text-slate-200',
  };
}
