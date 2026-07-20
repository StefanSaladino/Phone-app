import type { BetsPageTab } from '../../types/bet';

interface BetsTabsProps {
  activeTab: BetsPageTab;
  betCount: number;
  wheelCount: number;
  onChange: (tab: BetsPageTab) => void;
}

/** Switches between the shared bet lifecycle and the user's private wheels. */
export function BetsTabs({
  activeTab,
  betCount,
  wheelCount,
  onChange,
}: BetsTabsProps) {
  return (
    <div className="bets-tabs" role="tablist" aria-label="Bets sections">
      <button
        className={activeTab === 'bets' ? 'is-active' : ''}
        type="button"
        role="tab"
        aria-selected={activeTab === 'bets'}
        onClick={() => onChange('bets')}
      >
        Bets
        <span>{betCount}</span>
      </button>

      <button
        className={activeTab === 'wheels' ? 'is-active' : ''}
        type="button"
        role="tab"
        aria-selected={activeTab === 'wheels'}
        onClick={() => onChange('wheels')}
      >
        My wheels
        <span>{wheelCount}</span>
      </button>
    </div>
  );
}
