import type { WheelItem } from '../../types/bet';
import { AppIcon } from '../ui/AppIcon';

interface WheelItemCardProps {
  item: WheelItem;
  currentFirstName: string;
  partnerFirstName: string;
  busy: boolean;
  onArchive: (item: WheelItem) => void;
}

/** Displays one wheel item that is visible only to its creator. */
export function WheelItemCard({
  item,
  currentFirstName,
  partnerFirstName,
  busy,
  onArchive,
}: WheelItemCardProps) {
  const targetName =
    item.item_type === 'prize' ? currentFirstName : partnerFirstName;

  return (
    <article className={`wheel-item-card wheel-item-card--${item.item_type}`}>
      <header className="wheel-item-card__header">
        <span className={`wheel-kind-badge wheel-kind-badge--${item.item_type}`}>
          <AppIcon
            name={item.item_type === 'prize' ? 'trophy' : 'bets'}
            size={15}
          />
          {item.item_type === 'prize' ? 'Prize' : 'Punishment'}
        </span>

        <span className="wheel-status wheel-status--private">
          <AppIcon name="lock" size={13} />
          Private
        </span>
      </header>

      <div className="wheel-item-card__body">
        <h3>{item.title}</h3>
        {item.description ? <p>{item.description}</p> : null}
      </div>

      <dl className="wheel-item-card__details">
        <div>
          <dt>For</dt>
          <dd>{targetName}</dd>
        </div>
        <div>
          <dt>Visible to your partner</dt>
          <dd>Only if this result is selected</dd>
        </div>
      </dl>

      <footer className="wheel-item-card__actions wheel-item-card__actions--quiet">
        <button
          className="text-button"
          type="button"
          disabled={busy}
          onClick={() => onArchive(item)}
        >
          Archive
        </button>
      </footer>
    </article>
  );
}
