import { useCallback, useEffect, useMemo, useState } from 'react';
import { DateIdeaCard } from '../components/date-ideas/DateIdeaCard';
import { DateIdeaFilters } from '../components/date-ideas/DateIdeaFilters';
import { DateIdeaForm } from '../components/date-ideas/DateIdeaForm';
import { DeleteDateIdeaDialog } from '../components/date-ideas/DeleteDateIdeaDialog';
import { AppIcon } from '../components/ui/AppIcon';
import { useCouple } from '../hooks/useCouple';
import {
  createDateIdea,
  deleteDateIdea,
  listDateIdeas,
  patchDateIdea,
  updateDateIdea,
} from '../services/dateIdeaService';
import type { DateIdea, DateIdeaFilter, DateIdeaValues } from '../types/dateIdea';

/**
 * Keeps favourites first, then upcoming plans, then most recently changed ideas.
 */
function sortDateIdeas(ideas: DateIdea[]): DateIdea[] {
  return [...ideas].sort((first, second) => {
    if (first.is_favorite !== second.is_favorite) {
      return first.is_favorite ? -1 : 1;
    }

    if (first.planned_for && second.planned_for) {
      return new Date(first.planned_for).getTime() - new Date(second.planned_for).getTime();
    }

    if (first.planned_for) return -1;
    if (second.planned_for) return 1;

    return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime();
  });
}

/**
 * Full shared date-ideas workflow. The page coordinates feature state while
 * forms, filters, cards, database calls, and types stay in separate modules.
 */
export function DateIdeasPage() {
  const { workspace, refreshWorkspace } = useCouple();
  const [ideas, setIdeas] = useState<DateIdea[]>([]);
  const [filter, setFilter] = useState<DateIdeaFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingIdea, setEditingIdea] = useState<DateIdea | null>(null);
  const [ideaToDelete, setIdeaToDelete] = useState<DateIdea | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyIdeaId, setBusyIdeaId] = useState<string | null>(null);

  const loadIdeas = useCallback(async () => {
    if (!workspace) return;

    setLoading(true);
    setLoadError(null);

    try {
      setIdeas(await listDateIdeas(workspace.couple.id));
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : 'Unable to load the shared date ideas.',
      );
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void loadIdeas();
  }, [loadIdeas]);

  const counts = useMemo<Record<DateIdeaFilter, number>>(
    () => ({
      all: ideas.length,
      idea: ideas.filter((idea) => idea.status === 'idea').length,
      planned: ideas.filter((idea) => idea.status === 'planned').length,
      done: ideas.filter((idea) => idea.status === 'done').length,
      favorites: ideas.filter((idea) => idea.is_favorite).length,
    }),
    [ideas],
  );

  const visibleIdeas = useMemo(() => {
    if (filter === 'all') return ideas;
    if (filter === 'favorites') return ideas.filter((idea) => idea.is_favorite);
    return ideas.filter((idea) => idea.status === filter);
  }, [filter, ideas]);

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditingIdea(null);
    setFormError(null);
  };

  const openCreateForm = () => {
    setEditingIdea(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (idea: DateIdea) => {
    setEditingIdea(idea);
    setFormError(null);
    setFormOpen(true);
  };

  const saveIdea = async (values: DateIdeaValues) => {
    if (!workspace) return;

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingIdea) {
        const updatedIdea = await updateDateIdea({
          coupleId: workspace.couple.id,
          ideaId: editingIdea.id,
          values,
        });

        setIdeas((current) =>
          sortDateIdeas(
            current.map((idea) => (idea.id === updatedIdea.id ? updatedIdea : idea)),
          ),
        );
      } else {
        const createdIdea = await createDateIdea({
          coupleId: workspace.couple.id,
          currentUserId: workspace.currentMember.user_id,
          values,
        });

        setIdeas((current) => sortDateIdeas([createdIdea, ...current]));
      }

      setFormOpen(false);
      setEditingIdea(null);
      setFormError(null);
      void refreshWorkspace();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save this idea.');
    } finally {
      setSubmitting(false);
    }
  };

  const runQuickUpdate = async (
    idea: DateIdea,
    patch: Partial<Pick<DateIdea, 'is_favorite' | 'status' | 'planned_for'>>,
  ) => {
    if (!workspace) return;

    setBusyIdeaId(idea.id);
    setLoadError(null);

    try {
      const updatedIdea = await patchDateIdea(
        workspace.couple.id,
        idea.id,
        patch,
      );

      setIdeas((current) =>
        sortDateIdeas(
          current.map((currentIdea) =>
            currentIdea.id === updatedIdea.id ? updatedIdea : currentIdea,
          ),
        ),
      );
      void refreshWorkspace();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to update this idea.');
    } finally {
      setBusyIdeaId(null);
    }
  };

  const confirmDelete = async () => {
    if (!workspace || !ideaToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteDateIdea(workspace.couple.id, ideaToDelete.id);
      setIdeas((current) => current.filter((idea) => idea.id !== ideaToDelete.id));
      setIdeaToDelete(null);
      void refreshWorkspace();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this idea.');
    } finally {
      setDeleting(false);
    }
  };

  if (!workspace) return null;

  return (
    <div className="page-stack">
      <section className="page-toolbar">
        <div>
          <p className="section-heading__eyebrow">Shared inspiration</p>
          <h2>Things we should do</h2>
        </div>
        <button className="compact-button" type="button" onClick={openCreateForm}>
          <AppIcon name="plus" size={18} />
          Add idea
        </button>
      </section>

      <DateIdeaFilters activeFilter={filter} counts={counts} onChange={setFilter} />

      {loadError ? (
        <section className="inline-error" role="alert">
          <div>
            <strong>Something went wrong</strong>
            <p>{loadError}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadIdeas()}>
            Try again
          </button>
        </section>
      ) : null}

      {loading ? (
        <section className="empty-state empty-state--compact" aria-live="polite">
          <span className="empty-state__mark" aria-hidden="true">✦</span>
          <h3>Loading your ideas…</h3>
        </section>
      ) : visibleIdeas.length > 0 ? (
        <section className="date-idea-grid" aria-label="Shared date ideas">
          {visibleIdeas.map((idea) => (
            <DateIdeaCard
              idea={idea}
              busy={busyIdeaId === idea.id}
              key={idea.id}
              onEdit={openEditForm}
              onDelete={(selectedIdea) => {
                setDeleteError(null);
                setIdeaToDelete(selectedIdea);
              }}
              onToggleFavorite={(selectedIdea) =>
                runQuickUpdate(selectedIdea, {
                  is_favorite: !selectedIdea.is_favorite,
                })
              }
              onMarkComplete={(selectedIdea) =>
                runQuickUpdate(selectedIdea, {
                  status: 'done',
                  planned_for: null,
                })
              }
              onReturnToIdeas={(selectedIdea) =>
                runQuickUpdate(selectedIdea, {
                  status: 'idea',
                  planned_for: null,
                })
              }
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">✦</span>
          <h3>{ideas.length === 0 ? 'No date ideas yet' : 'Nothing in this filter yet'}</h3>
          <p>
            {ideas.length === 0
              ? 'Add anything from a quiet night in to a full weekend away.'
              : 'Try another filter or add something new.'}
          </p>
          {ideas.length === 0 ? (
            <button className="primary-button empty-state__button" type="button" onClick={openCreateForm}>
              <AppIcon name="plus" size={18} />
              Add your first idea
            </button>
          ) : null}
        </section>
      )}

      {formOpen ? (
        <DateIdeaForm
          idea={editingIdea}
          submitting={submitting}
          serverError={formError}
          onCancel={closeForm}
          onSubmit={saveIdea}
        />
      ) : null}

      {ideaToDelete ? (
        <DeleteDateIdeaDialog
          idea={ideaToDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (deleting) return;
            setIdeaToDelete(null);
            setDeleteError(null);
          }}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
