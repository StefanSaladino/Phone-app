import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Recipe, RecipeValues } from '../types/recipe';

interface UseRecipesResult {
  recipes: Recipe[];
  loading: boolean;
  busyRecipeId: string | null;
  error: string;
  createRecipe: (values: RecipeValues) => Promise<void>;
  updateRecipe: (recipeId: string, values: RecipeValues) => Promise<void>;
  deleteRecipe: (recipeId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return fallbackMessage;
}

/**
 * Loads and mutates the couple's shared recipe list.
 */
export function useRecipes(
  coupleId: string,
  currentUserId: string,
): UseRecipesResult {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyRecipeId, setBusyRecipeId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async (): Promise<void> => {
    setError('');

    const { data, error: loadError } = await supabase
      .from('recipes')
      .select(
        [
          'id',
          'couple_id',
          'name',
          'date_tried',
          'created_by',
          'updated_by',
          'created_at',
          'updated_at',
        ].join(','),
      )
      .eq('couple_id', coupleId)
      .order('date_tried', {
        ascending: false,
        nullsFirst: true,
      })
      .order('name', {
        ascending: true,
      })
      .returns<Recipe[]>();

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setRecipes(data ?? []);
  }, [coupleId]);

  useEffect(() => {
    let isActive = true;

    async function loadRecipes(): Promise<void> {
      setLoading(true);
      await refresh();

      if (isActive) {
        setLoading(false);
      }
    }

    void loadRecipes();

    const channel = supabase
      .channel(`recipes:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recipes',
          filter: `couple_id=eq.${coupleId}`,
        },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      isActive = false;
      void supabase.removeChannel(channel);
    };
  }, [coupleId, refresh]);

  async function createRecipe(values: RecipeValues): Promise<void> {
    const name = values.name.trim();

    if (!name) {
      throw new Error('Recipe name is required.');
    }

    setBusyRecipeId('new');
    setError('');

    try {
      const { error: createError } = await supabase.from('recipes').insert({
        couple_id: coupleId,
        name,
        date_tried: values.dateTried || null,
        created_by: currentUserId,
        updated_by: currentUserId,
      });

      if (createError) {
        throw createError;
      }

      await refresh();
    } catch (createError) {
      const message = getErrorMessage(createError, 'Unable to add this recipe.');
      setError(message);
      throw new Error(message);
    } finally {
      setBusyRecipeId(null);
    }
  }

  async function updateRecipe(
    recipeId: string,
    values: RecipeValues,
  ): Promise<void> {
    const name = values.name.trim();

    if (!name) {
      throw new Error('Recipe name is required.');
    }

    setBusyRecipeId(recipeId);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('recipes')
        .update({
          name,
          date_tried: values.dateTried || null,
          updated_by: currentUserId,
        })
        .eq('id', recipeId)
        .eq('couple_id', coupleId);

      if (updateError) {
        throw updateError;
      }

      await refresh();
    } catch (updateError) {
      const message = getErrorMessage(
        updateError,
        'Unable to update this recipe.',
      );
      setError(message);
      throw new Error(message);
    } finally {
      setBusyRecipeId(null);
    }
  }

  async function deleteRecipe(recipeId: string): Promise<void> {
    setBusyRecipeId(recipeId);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('recipes')
        .delete()
        .eq('id', recipeId)
        .eq('couple_id', coupleId);

      if (deleteError) {
        throw deleteError;
      }

      await refresh();
    } catch (deleteError) {
      const message = getErrorMessage(
        deleteError,
        'Unable to delete this recipe.',
      );
      setError(message);
      throw new Error(message);
    } finally {
      setBusyRecipeId(null);
    }
  }

  return {
    recipes,
    loading,
    busyRecipeId,
    error,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    refresh,
  };
}