import { useCallback, useEffect, useMemo, useState } from 'react';
import { BetCard } from '../components/bets/BetCard';
import { BetForm } from '../components/bets/BetForm';
import { BetsTabs } from '../components/bets/BetsTabs';
import { WheelItemCard } from '../components/bets/WheelItemCard';
import { WheelItemForm } from '../components/bets/WheelItemForm';
import { AppIcon } from '../components/ui/AppIcon';
import { useCouple } from '../hooks/useCouple';
import {
  acceptBet,
  archiveWheelItem,
  cancelBet,
  createBet,
  createWheelItem,
  loadBetWorkspace,
  rejectBet,
} from '../services/betService';
import type {
  Bet,
  BetsPageTab,
  BetValues,
  WheelItem,
  WheelItemValues,
  WheelReadiness,
} from '../types/bet';

/** Returns the profile first name for a known couple member. */
function memberName(
  userId: string,
  currentUserId: string,
  currentName: string,
  partnerName: string,
): string {
  return userId === currentUserId ? currentName : partnerName;
}

/** Coordinates bets and each user's private prize/punishment wheels. */
export function BetsPage() {
  const { workspace } = useCouple();
  const [activeTab, setActiveTab] = useState<BetsPageTab>('bets');
  const [bets, setBets] = useState<Bet[]>([]);
  const [wheelItems, setWheelItems] = useState<WheelItem[]>([]);
  const [wheelReadiness, setWheelReadiness] = useState<WheelReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [betFormOpen, setBetFormOpen] = useState(false);
  const [wheelFormOpen, setWheelFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadWorkspaceData = useCallback(async () => {
    if (!workspace) return;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await loadBetWorkspace(
        workspace.couple.id,
        workspace.currentMember.user_id,
      );
      setBets(data.bets);
      setWheelItems(data.wheelItems);
      setWheelReadiness(data.wheelReadiness);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load the bets workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const currentUserId = workspace?.currentMember.user_id ?? '';
  const partnerUserId = workspace?.partnerMember.user_id ?? '';
  const currentFirstName = workspace?.currentMember.profile.first_name ?? 'You';
  const partnerFirstName = workspace?.partnerMember.profile.first_name ?? 'Partner';

  const activeBets = useMemo(
    () => bets.filter((bet) => bet.status === 'active'),
    [bets],
  );

  const awaitingYou = useMemo(
    () =>
      bets.filter(
        (bet) => bet.status === 'pending' && bet.opponent_id === currentUserId,
      ),
    [bets, currentUserId],
  );

  const sentInvitations = useMemo(
    () =>
      bets.filter(
        (bet) => bet.status === 'pending' && bet.created_by === currentUserId,
      ),
    [bets, currentUserId],
  );

  const betHistory = useMemo(
    () =>
      bets.filter((bet) =>
        ['rejected', 'cancelled', 'settled'].includes(bet.status),
      ),
    [bets],
  );

  const activeWheelItems = useMemo(
    () => wheelItems.filter((item) => item.status === 'active'),
    [wheelItems],
  );

  const currentPrizeCount = activeWheelItems.filter(
    (item) => item.item_type === 'prize',
  ).length;

  const currentPunishmentCount = activeWheelItems.filter(
    (item) => item.item_type === 'punishment',
  ).length;

  const currentReadiness = wheelReadiness.find(
    (entry) => entry.user_id === currentUserId,
  );
  const partnerReadiness = wheelReadiness.find(
    (entry) => entry.user_id === partnerUserId,
  );

  const currentWheelsReady = Boolean(
    currentReadiness?.prize_ready && currentReadiness.punishment_ready,
  );
  const partnerWheelsReady = Boolean(
    partnerReadiness?.prize_ready && partnerReadiness.punishment_ready,
  );
  const wheelsReady = currentWheelsReady && partnerWheelsReady;

  const replaceBet = (updatedBet: Bet) => {
    setBets((current) =>
      current.map((bet) => (bet.id === updatedBet.id ? updatedBet : bet)),
    );
  };

  const refreshWorkspaceData = async () => {
    if (!workspace) return;

    const data = await loadBetWorkspace(workspace.couple.id, currentUserId);
    setBets(data.bets);
    setWheelItems(data.wheelItems);
    setWheelReadiness(data.wheelReadiness);
  };

  const saveWheelItem = async (values: WheelItemValues) => {
    if (!workspace) return;

    setSubmitting(true);
    setActionError(null);

    try {
      await createWheelItem({
        coupleId: workspace.couple.id,
        currentUserId,
        partnerUserId,
        values,
      });

      await refreshWorkspaceData();
      setWheelFormOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to add this private wheel option.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveBet = async (values: BetValues) => {
    if (!workspace) return;

    setSubmitting(true);
    setActionError(null);

    try {
      const bet = await createBet({
        coupleId: workspace.couple.id,
        currentUserId,
        partnerUserId,
        values,
      });

      setBets((current) => [bet, ...current]);
      setBetFormOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to send this bet.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const archivePrivateItem = async (item: WheelItem) => {
    setBusyId(item.id);
    setActionError(null);

    try {
      await archiveWheelItem(item.id);
      await refreshWorkspaceData();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to archive this private wheel option.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const runBetAction = async (
    bet: Bet,
    action: 'accept' | 'reject' | 'cancel',
  ) => {
    setBusyId(bet.id);
    setActionError(null);

    try {
      const updated =
        action === 'accept'
          ? await acceptBet(bet.id)
          : action === 'reject'
            ? await rejectBet(bet.id)
            : await cancelBet(bet.id);

      replaceBet(updated);

      if (action === 'accept') {
        await refreshWorkspaceData();
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to update this bet.',
      );
    } finally {
      setBusyId(null);
    }
  };

  if (!workspace) return null;

  const renderBetList = (items: Bet[], label: string) => {
    if (items.length === 0) return null;

    return (
      <section className="bets-section" aria-label={label}>
        <div className="bets-section__heading">
          <h3>{label}</h3>
          <span>{items.length}</span>
        </div>
        <div className="bet-grid">
          {items.map((bet) => (
            <BetCard
              key={bet.id}
              bet={bet}
              currentUserId={currentUserId}
              creatorName={memberName(
                bet.created_by,
                currentUserId,
                currentFirstName,
                partnerFirstName,
              )}
              opponentName={memberName(
                bet.opponent_id,
                currentUserId,
                currentFirstName,
                partnerFirstName,
              )}
              busy={busyId === bet.id}
              onAccept={(selected) => void runBetAction(selected, 'accept')}
              onReject={(selected) => void runBetAction(selected, 'reject')}
              onCancel={(selected) => void runBetAction(selected, 'cancel')}
            />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="page-stack">
      <section className="page-toolbar bets-toolbar">
        <div>
          <p className="section-heading__eyebrow">Friendly competition</p>
          <h2>Bets and wheels</h2>
        </div>

        <button
          className="compact-button"
          type="button"
          onClick={() => {
            setActionError(null);
            if (activeTab === 'bets') setBetFormOpen(true);
            else setWheelFormOpen(true);
          }}
        >
          <AppIcon name="plus" size={18} />
          {activeTab === 'bets' ? 'New bet' : 'Add option'}
        </button>
      </section>

      <BetsTabs
        activeTab={activeTab}
        betCount={activeBets.length + awaitingYou.length + sentInvitations.length}
        wheelCount={activeWheelItems.length}
        onChange={(tab) => {
          setActionError(null);
          setActiveTab(tab);
        }}
      />

      {actionError ? (
        <section className="inline-error" role="alert">
          <div>
            <strong>That did not work</strong>
            <p>{actionError}</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </section>
      ) : null}

      {loadError ? (
        <section className="inline-error" role="alert">
          <div>
            <strong>Unable to load Bets</strong>
            <p>{loadError}</p>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadWorkspaceData()}
          >
            Try again
          </button>
        </section>
      ) : null}

      {loading ? (
        <section className="empty-state empty-state--compact" aria-live="polite">
          <span className="empty-state__mark" aria-hidden="true">
            ◎
          </span>
          <h3>Loading your bets…</h3>
        </section>
      ) : activeTab === 'bets' ? (
        <>
          {!wheelsReady ? (
            <section className="bets-readiness-callout">
              <AppIcon name="lock" size={22} />
              <div>
                <strong>Private wheels must be ready before acceptance</strong>
                <p>
                  Each of you privately needs at least one prize for yourself
                  and one punishment for your partner. Only readiness is shared.
                </p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setActiveTab('wheels')}
              >
                Open my wheels
              </button>
            </section>
          ) : null}

          {renderBetList(awaitingYou, 'Awaiting you')}
          {renderBetList(activeBets, 'Active bets')}
          {renderBetList(sentInvitations, 'Sent invitations')}
          {renderBetList(betHistory, 'History')}

          {bets.length === 0 ? (
            <section className="empty-state">
              <span className="empty-state__mark" aria-hidden="true">
                ◎
              </span>
              <h3>No bets yet</h3>
              <p>
                Create a friendly wager, lock both predictions, and settle it
                together later.
              </p>
              <button
                className="primary-button empty-state__button"
                type="button"
                onClick={() => setBetFormOpen(true)}
              >
                <AppIcon name="plus" size={18} />
                Propose your first bet
              </button>
            </section>
          ) : null}
        </>
      ) : (
        <>
          <section className="wheel-privacy-callout">
            <AppIcon name="lock" size={22} />
            <div>
              <strong>Your wheel contents are private</strong>
              <p>
                {partnerFirstName} can see only whether your required wheels are
                ready. Titles and details stay hidden unless one is selected
                during settlement.
              </p>
            </div>
          </section>

          <section className="wheel-readiness" aria-label="Private wheel readiness">
            <div className={currentPrizeCount > 0 ? 'is-ready' : ''}>
              <span>My prize wheel</span>
              <strong>{currentPrizeCount}</strong>
            </div>
            <div className={currentPunishmentCount > 0 ? 'is-ready' : ''}>
              <span>Punishments for {partnerFirstName}</span>
              <strong>{currentPunishmentCount}</strong>
            </div>
            <div className={partnerReadiness?.prize_ready ? 'is-ready' : ''}>
              <span>{partnerFirstName}&apos;s prize wheel</span>
              <strong>{partnerReadiness?.prize_ready ? 'Ready' : 'Not ready'}</strong>
            </div>
            <div className={partnerReadiness?.punishment_ready ? 'is-ready' : ''}>
              <span>{partnerFirstName}&apos;s punishment wheel</span>
              <strong>
                {partnerReadiness?.punishment_ready ? 'Ready' : 'Not ready'}
              </strong>
            </div>
          </section>

          {activeWheelItems.length > 0 ? (
            <section className="bets-section" aria-label="My private wheel options">
              <div className="bets-section__heading">
                <h3>My private options</h3>
                <span>{activeWheelItems.length}</span>
              </div>
              <div className="wheel-grid">
                {activeWheelItems.map((item) => (
                  <WheelItemCard
                    key={item.id}
                    item={item}
                    currentFirstName={currentFirstName}
                    partnerFirstName={partnerFirstName}
                    busy={busyId === item.id}
                    onArchive={(selected) => void archivePrivateItem(selected)}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section className="empty-state">
              <span className="empty-state__mark" aria-hidden="true">
                ★
              </span>
              <h3>Your private wheels are empty</h3>
              <p>
                Add prizes for yourself and punishments for {partnerFirstName}.
                Only you can see their contents before settlement.
              </p>
              <button
                className="primary-button empty-state__button"
                type="button"
                onClick={() => setWheelFormOpen(true)}
              >
                <AppIcon name="plus" size={18} />
                Add the first secret option
              </button>
            </section>
          )}
        </>
      )}

      {betFormOpen ? (
        <BetForm
          currentFirstName={currentFirstName}
          partnerFirstName={partnerFirstName}
          submitting={submitting}
          serverError={actionError}
          onCancel={() => {
            if (submitting) return;
            setBetFormOpen(false);
            setActionError(null);
          }}
          onSubmit={saveBet}
        />
      ) : null}

      {wheelFormOpen ? (
        <WheelItemForm
          partnerFirstName={partnerFirstName}
          submitting={submitting}
          serverError={actionError}
          onCancel={() => {
            if (submitting) return;
            setWheelFormOpen(false);
            setActionError(null);
          }}
          onSubmit={saveWheelItem}
        />
      ) : null}
    </div>
  );
}
