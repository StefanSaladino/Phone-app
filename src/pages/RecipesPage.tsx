import { useState } from 'react';
import { useCouple } from '../hooks/useCouple';
import { useRecipes } from '../hooks/useRecipes';
import type { Recipe, RecipeValues } from '../types/recipe';
import { AppIcon } from '../components/ui/AppIcon';
import '../styles/recipes.css';

const emptyValues: RecipeValues = {
  name: '',
  dateTried: '',
};

function formatTriedDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${value}T12:00:00`));
}

/**
 * Route wrapper keeps every hook call stable while the couple workspace loads.
 */
export default function RecipesPage() {
  const { workspace } = useCouple();

  if (!workspace) return null;

  return (
    <RecipesWorkspace
      coupleId={workspace.couple.id}
      currentUserId={workspace.currentMember.user_id}
    />
  );
}

interface RecipesWorkspaceProps {
  coupleId: string;
  currentUserId: string;
}

/** Shared recipe tracker for both partners. */
function RecipesWorkspace({
  coupleId,
  currentUserId,
}: RecipesWorkspaceProps) {

  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [formValues, setFormValues] = useState<RecipeValues>(emptyValues);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState('');

  const recipes = useRecipes(coupleId, currentUserId);

  function openCreateForm(): void {
    setEditingRecipe(null);
    setFormValues(emptyValues);
    setFormError('');
    setIsFormOpen(true);
  }

  function openEditForm(recipe: Recipe): void {
    setEditingRecipe(recipe);
    setFormValues({
      name: recipe.name,
      dateTried: recipe.date_tried ?? '',
    });
    setFormError('');
    setIsFormOpen(true);
  }

  function closeForm(): void {
    setEditingRecipe(null);
    setFormValues(emptyValues);
    setFormError('');
    setIsFormOpen(false);
  }

  async function handleSubmit(): Promise<void> {
    setFormError('');

    try {
      if (editingRecipe) {
        await recipes.updateRecipe(editingRecipe.id, formValues);
      } else {
        await recipes.createRecipe(formValues);
      }

      closeForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Unable to save recipe.',
      );
    }
  }

  async function handleDelete(recipe: Recipe): Promise<void> {
    const confirmed = window.confirm(
      `Delete "${recipe.name}" from your shared recipes?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await recipes.deleteRecipe(recipe.id);
    } catch {
      // Hook error state displays the database message.
    }
  }

  return (
    <div className="page-stack recipes-page">
      <section className="hero-card recipes-hero">
        <p className="hero-card__eyebrow">Cook together</p>

        <h2>Recipes we want to remember.</h2>

        <p>
          Save meals you want to try and record the date after you make them
          together.
        </p>
      </section>

      <div className="page-toolbar">
        <div>
          <p className="section-heading__eyebrow">Shared list</p>
          <h2>Recipes</h2>
        </div>

        <button
          className="primary-button"
          type="button"
          onClick={openCreateForm}
        >
          <AppIcon name="plus" size={18} />
          Add recipe
        </button>
      </div>

      {recipes.error ? (
        <p className="form-message form-message--error" role="alert">
          {recipes.error}
        </p>
      ) : null}

      {recipes.loading ? (
        <section className="empty-state empty-state--compact">
          <p>Loading recipes…</p>
        </section>
      ) : null}

      {!recipes.loading && recipes.recipes.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">
            ♨
          </span>

          <h3>No recipes saved yet</h3>

          <p>
            Add the first recipe you want to try together.
          </p>
        </section>
      ) : null}

      {!recipes.loading && recipes.recipes.length > 0 ? (
        <div className="recipe-grid">
          {recipes.recipes.map((recipe) => {
            const isBusy = recipes.busyRecipeId === recipe.id;

            return (
              <article
                className={`recipe-card${
                  recipe.date_tried ? ' recipe-card--tried' : ''
                }`}
                key={recipe.id}
              >
                <div className="recipe-card__content">
                  <span
                    className={`recipe-status${
                      recipe.date_tried ? ' is-tried' : ''
                    }`}
                  >
                    {recipe.date_tried ? 'Tried' : 'Not tried yet'}
                  </span>

                  <h3>{recipe.name}</h3>

                  {recipe.date_tried ? (
                    <p className="recipe-card__date">
                      <AppIcon name="calendar" size={17} />
                      Tried {formatTriedDate(recipe.date_tried)}
                    </p>
                  ) : (
                    <p className="recipe-card__date">
                      Add a date after you make it.
                    </p>
                  )}
                </div>

                <div className="recipe-card__actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => openEditForm(recipe)}
                  >
                    <AppIcon name="edit" size={17} />
                    Edit
                  </button>

                  <button
                    className="danger-button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => void handleDelete(recipe)}
                  >
                    <AppIcon name="trash" size={17} />
                    {isBusy ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {isFormOpen ? (
        <div className="modal-backdrop">
          <section
            aria-labelledby="recipe-form-title"
            aria-modal="true"
            className="recipe-form-card"
            role="dialog"
          >
            <header className="recipe-form-card__header">
              <div>
                <p className="section-heading__eyebrow">
                  {editingRecipe ? 'Update recipe' : 'New recipe'}
                </p>

                <h2 id="recipe-form-title">
                  {editingRecipe ? 'Edit recipe' : 'Add a recipe'}
                </h2>
              </div>

              <button
                aria-label="Close recipe form"
                className="icon-button"
                type="button"
                onClick={closeForm}
              >
                <AppIcon name="close" size={20} />
              </button>
            </header>

            <div className="form-stack">
              <label className="field-group">
                <span>Recipe name</span>

                <input
                  autoFocus
                  maxLength={140}
                  type="text"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="field-group">
                <span>Date tried</span>

                <input
                  type="date"
                  value={formValues.dateTried}
                  onChange={(event) =>
                    setFormValues((current) => ({
                      ...current,
                      dateTried: event.target.value,
                    }))
                  }
                />

                <small>Leave blank if you have not tried it yet.</small>
              </label>

              {formError ? (
                <p className="form-message form-message--error" role="alert">
                  {formError}
                </p>
              ) : null}

              <div className="recipe-form-card__actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={closeForm}
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    !formValues.name.trim() ||
                    recipes.busyRecipeId !== null
                  }
                  onClick={() => void handleSubmit()}
                >
                  {recipes.busyRecipeId
                    ? 'Saving…'
                    : editingRecipe
                      ? 'Save changes'
                      : 'Add recipe'}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}