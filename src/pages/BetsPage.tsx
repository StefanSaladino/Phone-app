import { useCallback, useEffect, useMemo, useState } from 'react';
import { BetCard } from '../components/bets/BetCard';
import { BetForm } from '../components/bets/BetForm';
import { BetsTabs } from '../components/bets/BetsTabs';
import { DisputeSettlementForm } from '../components/bets/DisputeSettlementForm';
import { SettlementForm } from '../components/bets/SettlementForm';
import { SettlementRevealModal } from '../components/bets/SettlementRevealModal';
import { WheelItemCard } from '../components/bets/WheelItemCard';
import { WheelItemForm } from '../components/bets/WheelItemForm';
import { AppIcon } from '../components/ui/AppIcon';
import { useCouple } from '../hooks/useCouple';
import {
  acceptBet,
  archiveWheelItem,
  cancelBet,
  confirmBetOutcomeCompletion,
  confirmBetSettlement,
  createBet,
  createWheelItem,
  disputeBetSettlement,
  loadBetWorkspace,
  proposeBetSettlement,
  rejectBet,
  requestBetOutcomeCompletion,
  revealBetOutcome,
  submitHiddenBetAnswer,
  updateWheelItem,
  waiveBetOutcome,
} from '../services/betService';
import type {
  Bet,
  BetSettlement,
  BetsPageTab,
  BetValues,
  HiddenBetState,
  RevealedBetOutcome,
  SettlementProposalValues,
  WheelItem,
  WheelItemValues,
  WheelReadiness,
} from '../types/bet';

/** Coordinates bets, private wheels, and the mutual settlement game. */
export function BetsPage() {
  const { workspace } = useCouple();
  const [activeTab, setActiveTab] = useState<BetsPageTab>('bets');
  const [bets, setBets] = useState<Bet[]>([]);
  const [wheelItems, setWheelItems] = useState<WheelItem[]>([]);
  const [wheelReadiness, setWheelReadiness] = useState<WheelReadiness[]>([]);
  const [settlements, setSettlements] = useState<BetSettlement[]>([]);
  const [hiddenBetStates, setHiddenBetStates] = useState<HiddenBetState[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [betFormOpen, setBetFormOpen] = useState(false);
  const [wheelFormOpen, setWheelFormOpen] = useState(false);
  const [editingWheelItem, setEditingWheelItem] = useState<WheelItem | null>(null);
  const [settlementBet, setSettlementBet] = useState<Bet | null>(null);
  const [disputeBet, setDisputeBet] = useState<Bet | null>(null);
  const [revealBet, setRevealBet] = useState<Bet | null>(null);
  const [revealOutcome, setRevealOutcome] =
    useState<RevealedBetOutcome | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const currentUserId = workspace?.currentMember.user_id ?? '';
  const partnerUserId = workspace?.partnerMember.user_id ?? '';
  const currentFirstName = workspace?.currentMember.profile.first_name ?? 'You';
  const partnerFirstName =
    workspace?.partnerMember.profile.first_name ?? 'Partner';

  const getMemberName = useCallback(
    (userId: string | null): string => {
      if (!userId) return 'No one';
      return userId === currentUserId ? currentFirstName : partnerFirstName;
    },
    [currentFirstName, currentUserId, partnerFirstName],
  );

  const applyWorkspaceData = useCallback(
    (data: Awaited<ReturnType<typeof loadBetWorkspace>>) => {
      setBets(data.bets);
      setWheelItems(data.wheelItems);
      setWheelReadiness(data.wheelReadiness);
      setSettlements(data.settlements);
      setHiddenBetStates(data.hiddenBetStates);
    },
    [],
  );

  const loadWorkspaceData = useCallback(async () => {
    if (!workspace) return;

    setLoading(true);
    setLoadError(null);

    try {
      const data = await loadBetWorkspace(
        workspace.couple.id,
        workspace.currentMember.user_id,
      );
      applyWorkspaceData(data);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : 'Unable to load the bets workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, [applyWorkspaceData, workspace]);

  useEffect(() => {
    void loadWorkspaceData();
  }, [loadWorkspaceData]);

  const settlementByBetId = useMemo(
    () => new Map(settlements.map((settlement) => [settlement.bet_id, settlement])),
    [settlements],
  );

  const hiddenStateByBetId = useMemo(
    () => new Map(hiddenBetStates.map((state) => [state.bet_id, state])),
    [hiddenBetStates],
  );

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

  const outcomeInProgress = useMemo(
    () =>
      bets.filter((bet) => {
        if (bet.status !== 'settled') return false;
        const settlement = settlementByBetId.get(bet.id);
        return Boolean(
          settlement &&
            ['ready_to_reveal', 'revealed', 'completion_requested'].includes(
              settlement.status,
            ),
        );
      }),
    [bets, settlementByBetId],
  );

  const betHistory = useMemo(
    () =>
      bets.filter((bet) => {
        if (['rejected', 'cancelled'].includes(bet.status)) return true;
        if (bet.status !== 'settled') return false;
        const settlement = settlementByBetId.get(bet.id);
        return Boolean(
          settlement && ['completed', 'waived', 'draw'].includes(settlement.status),
        );
      }),
    [bets, settlementByBetId],
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

  const refreshWorkspaceData = async () => {
    if (!workspace) return null;

    const data = await loadBetWorkspace(workspace.couple.id, currentUserId);
    applyWorkspaceData(data);
    return data;
  };

  const replaceBet = (updatedBet: Bet) => {
    setBets((current) =>
      current.map((bet) => (bet.id === updatedBet.id ? updatedBet : bet)),
    );
  };

  const saveWheelItem = async (values: WheelItemValues) => {
    if (!workspace) return;

    setSubmitting(true);
    setActionError(null);

    try {
      if (editingWheelItem) {
        await updateWheelItem({
          coupleId: workspace.couple.id,
          currentUserId,
          itemId: editingWheelItem.id,
          values,
        });
      } else {
        await createWheelItem({
          coupleId: workspace.couple.id,
          currentUserId,
          partnerUserId,
          values,
        });
      }

      await refreshWorkspaceData();
      setWheelFormOpen(false);
      setEditingWheelItem(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to save this private wheel option.',
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
      await refreshWorkspaceData();
      setBetFormOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to send this bet.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveSettlement = async (values: SettlementProposalValues) => {
    if (!settlementBet) return;

    setSubmitting(true);
    setActionError(null);

    try {
      await proposeBetSettlement(settlementBet.id, values);
      await refreshWorkspaceData();
      setSettlementBet(null);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to propose this result.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveDispute = async (reason: string) => {
    if (!disputeBet) return;

    setSubmitting(true);
    setActionError(null);

    try {
      await disputeBetSettlement(disputeBet.id, reason);
      await refreshWorkspaceData();
      setDisputeBet(null);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to dispute this result.',
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

  const runInvitationAction = async (
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


  const saveHiddenAnswer = async (bet: Bet, answer: string) => {
    setBusyId(bet.id);
    setActionError(null);

    try {
      await submitHiddenBetAnswer(bet.id, answer);
      await refreshWorkspaceData();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to submit this hidden answer.',
      );
      throw error;
    } finally {
      setBusyId(null);
    }
  };

  const confirmSettlement = async (bet: Bet) => {
    setBusyId(bet.id);
    setActionError(null);

    try {
      await confirmBetSettlement(bet.id);
      const data = await refreshWorkspaceData();
      const settlement = data?.settlements.find((entry) => entry.bet_id === bet.id);

      if (settlement && settlement.status === 'ready_to_reveal') {
        setRevealOutcome(null);
        setRevealBet(bet);
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to confirm this result.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const runSettlementAction = async (
    bet: Bet,
    action: 'request-completion' | 'confirm-completion' | 'waive',
  ) => {
    setBusyId(bet.id);
    setActionError(null);

    try {
      if (action === 'request-completion') {
        await requestBetOutcomeCompletion(bet.id);
      } else if (action === 'confirm-completion') {
        await confirmBetOutcomeCompletion(bet.id);
      } else {
        await waiveBetOutcome(bet.id);
      }

      await refreshWorkspaceData();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to update this settlement.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const spinWheel = async () => {
    if (!revealBet) return;

    setSpinning(true);
    setActionError(null);

    try {
      const outcome = await revealBetOutcome(revealBet.id);

      // Keep the server result hidden while the visual wheel completes a spin.
      await new Promise((resolve) => window.setTimeout(resolve, 1800));
      setRevealOutcome(outcome);
      await refreshWorkspaceData();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to reveal this wheel result.',
      );
    } finally {
      setSpinning(false);
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
              settlement={settlementByBetId.get(bet.id) ?? null}
              hiddenState={hiddenStateByBetId.get(bet.id) ?? null}
              currentUserId={currentUserId}
              creatorName={getMemberName(bet.created_by)}
              opponentName={getMemberName(bet.opponent_id)}
              memberName={getMemberName}
              busy={busyId === bet.id}
              onAccept={(selected) =>
                void runInvitationAction(selected, 'accept')
              }
              onReject={(selected) =>
                void runInvitationAction(selected, 'reject')
              }
              onCancel={(selected) =>
                void runInvitationAction(selected, 'cancel')
              }
              onSubmitHiddenAnswer={saveHiddenAnswer}
              onProposeSettlement={(selected) => {
                setActionError(null);
                setSettlementBet(selected);
              }}
              onConfirmSettlement={(selected) =>
                void confirmSettlement(selected)
              }
              onDisputeSettlement={(selected) => {
                setActionError(null);
                setDisputeBet(selected);
              }}
              onOpenReveal={(selected) => {
                setActionError(null);
                setRevealOutcome(null);
                setRevealBet(selected);
              }}
              onRequestCompletion={(selected) =>
                void runSettlementAction(selected, 'request-completion')
              }
              onConfirmCompletion={(selected) =>
                void runSettlementAction(selected, 'confirm-completion')
              }
              onWaive={(selected) =>
                void runSettlementAction(selected, 'waive')
              }
            />
          ))}
        </div>
      </section>
    );
  };

  const activeRevealSettlement = revealBet
    ? settlementByBetId.get(revealBet.id) ?? null
    : null;

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
            else {
              setEditingWheelItem(null);
              setWheelFormOpen(true);
            }
          }}
        >
          <AppIcon name="plus" size={18} />
          {activeTab === 'bets' ? 'New bet' : 'Add option'}
        </button>
      </section>

      <BetsTabs
        activeTab={activeTab}
        betCount={
          activeBets.length +
          awaitingYou.length +
          sentInvitations.length +
          outcomeInProgress.length
        }
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
          {renderBetList(outcomeInProgress, 'Outcome in progress')}
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
              <strong>
                {partnerReadiness?.prize_ready ? 'Ready' : 'Not ready'}
              </strong>
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
                    onEdit={(selected) => {
                      setActionError(null);
                      setEditingWheelItem(selected);
                      setWheelFormOpen(true);
                    }}
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
                onClick={() => {
                  setEditingWheelItem(null);
                  setWheelFormOpen(true);
                }}
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
          item={editingWheelItem}
          partnerFirstName={partnerFirstName}
          submitting={submitting}
          serverError={actionError}
          onCancel={() => {
            if (submitting) return;
            setWheelFormOpen(false);
            setEditingWheelItem(null);
            setActionError(null);
          }}
          onSubmit={saveWheelItem}
        />
      ) : null}

      {settlementBet ? (
        <SettlementForm
          bet={settlementBet}
          settlement={settlementByBetId.get(settlementBet.id) ?? null}
          currentUserId={currentUserId}
          currentFirstName={currentFirstName}
          partnerFirstName={partnerFirstName}
          submitting={submitting}
          serverError={actionError}
          onCancel={() => {
            if (submitting) return;
            setSettlementBet(null);
            setActionError(null);
          }}
          onSubmit={saveSettlement}
        />
      ) : null}

      {disputeBet ? (
        <DisputeSettlementForm
          bet={disputeBet}
          submitting={submitting}
          serverError={actionError}
          onCancel={() => {
            if (submitting) return;
            setDisputeBet(null);
            setActionError(null);
          }}
          onSubmit={saveDispute}
        />
      ) : null}

      {revealBet && activeRevealSettlement ? (
        <SettlementRevealModal
          settlement={activeRevealSettlement}
          currentUserId={currentUserId}
          winnerName={getMemberName(activeRevealSettlement.winner_user_id)}
          loserName={getMemberName(activeRevealSettlement.loser_user_id)}
          spinnerName={getMemberName(activeRevealSettlement.spinner_user_id)}
          spinning={spinning}
          outcome={revealOutcome}
          onSpin={spinWheel}
          onClose={() => {
            if (spinning) return;
            setRevealBet(null);
            setRevealOutcome(null);
          }}
        />
      ) : null}
    </div>
  );
}
