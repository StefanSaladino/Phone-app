import { useCallback, useEffect, useMemo, useState } from 'react';
import { DeletePlaceDialog } from '../components/places/DeletePlaceDialog';
import { PlaceCard } from '../components/places/PlaceCard';
import { PlaceFilters } from '../components/places/PlaceFilters';
import { PlaceForm } from '../components/places/PlaceForm';
import { AppIcon } from '../components/ui/AppIcon';
import { useCouple } from '../hooks/useCouple';
import {
  createPlace,
  deletePlace,
  listPlaces,
  patchPlace,
  updatePlace,
} from '../services/placeService';
import {
  ALL_CITIES_FILTER,
  UNKNOWN_CITY_FILTER,
  type Place,
  type PlaceFilter,
  type PlaceValues,
} from '../types/place';

/**
 * Keeps favourites first, unvisited places next, then recently changed places.
 */
function sortPlaces(places: Place[]): Place[] {
  return [...places].sort((first, second) => {
    if (first.is_favorite !== second.is_favorite) {
      return first.is_favorite ? -1 : 1;
    }

    if (first.visited !== second.visited) {
      return first.visited ? 1 : -1;
    }

    return new Date(second.updated_at).getTime() - new Date(first.updated_at).getTime();
  });
}

/**
 * Complete shared place library with categories, search, links, and quick actions.
 */
export function PlacesPage() {
  const { workspace, refreshWorkspace } = useCouple();
  const [places, setPlaces] = useState<Place[]>([]);
  const [filter, setFilter] = useState<PlaceFilter>('all');
  const [cityFilter, setCityFilter] = useState(ALL_CITIES_FILTER);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [placeToDelete, setPlaceToDelete] = useState<Place | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyPlaceId, setBusyPlaceId] = useState<string | null>(null);

  const loadSavedPlaces = useCallback(async () => {
    if (!workspace) return;

    setLoading(true);
    setLoadError(null);

    try {
      setPlaces(await listPlaces(workspace.couple.id));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to load the shared places.');
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    void loadSavedPlaces();
  }, [loadSavedPlaces]);

  const counts = useMemo<Record<PlaceFilter, number>>(
    () => ({
      all: places.length,
      food: places.filter((place) => place.category === 'food').length,
      coffee: places.filter((place) => place.category === 'coffee').length,
      drinks: places.filter((place) => place.category === 'drinks').length,
      dessert: places.filter((place) => place.category === 'dessert').length,
      recreation: places.filter((place) => place.category === 'recreation').length,
      favorites: places.filter((place) => place.is_favorite).length,
      'want-to-go': places.filter((place) => !place.visited).length,
      visited: places.filter((place) => place.visited).length,
    }),
    [places],
  );

  const cityOptions = useMemo(() => {
    const citiesByNormalizedName = new Map<string, string>();

    for (const place of places) {
      const city = place.city?.trim();
      if (!city) continue;

      const normalizedCity = city.toLocaleLowerCase();
      if (!citiesByNormalizedName.has(normalizedCity)) {
        citiesByNormalizedName.set(normalizedCity, city);
      }
    }

    return [...citiesByNormalizedName.values()].sort((first, second) =>
      first.localeCompare(second, undefined, { sensitivity: 'base' }),
    );
  }, [places]);

  const unknownCityCount = useMemo(
    () => places.filter((place) => !place.city?.trim()).length,
    [places],
  );

  useEffect(() => {
    if (
      cityFilter === ALL_CITIES_FILTER ||
      (cityFilter === UNKNOWN_CITY_FILTER && unknownCityCount > 0) ||
      cityOptions.some(
        (city) =>
          city.localeCompare(cityFilter, undefined, { sensitivity: 'base' }) ===
          0,
      )
    ) {
      return;
    }

    setCityFilter(ALL_CITIES_FILTER);
  }, [cityFilter, cityOptions, unknownCityCount]);

  const visiblePlaces = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return places.filter((place) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'favorites' && place.is_favorite) ||
        (filter === 'want-to-go' && !place.visited) ||
        (filter === 'visited' && place.visited) ||
        place.category === filter;

      const matchesCity =
        cityFilter === ALL_CITIES_FILTER ||
        (cityFilter === UNKNOWN_CITY_FILTER && !place.city?.trim()) ||
        Boolean(
          place.city &&
            place.city.localeCompare(cityFilter, undefined, {
              sensitivity: 'base',
            }) === 0,
        );

      if (!matchesFilter || !matchesCity) return false;
      if (!normalizedQuery) return true;

      return [place.name, place.city, place.address, place.notes, place.category]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    });
  }, [cityFilter, filter, places, searchQuery]);

  const closeForm = () => {
    if (submitting) return;
    setFormOpen(false);
    setEditingPlace(null);
    setFormError(null);
  };

  const openCreateForm = () => {
    setEditingPlace(null);
    setFormError(null);
    setFormOpen(true);
  };

  const openEditForm = (place: Place) => {
    setEditingPlace(place);
    setFormError(null);
    setFormOpen(true);
  };

  const savePlace = async (values: PlaceValues) => {
    if (!workspace) return;

    setSubmitting(true);
    setFormError(null);

    try {
      if (editingPlace) {
        const updatedPlace = await updatePlace({
          coupleId: workspace.couple.id,
          placeId: editingPlace.id,
          values,
        });

        setPlaces((current) =>
          sortPlaces(current.map((place) => (place.id === updatedPlace.id ? updatedPlace : place))),
        );
      } else {
        const createdPlace = await createPlace({
          coupleId: workspace.couple.id,
          currentUserId: workspace.currentMember.user_id,
          values,
        });

        setPlaces((current) => sortPlaces([createdPlace, ...current]));
      }

      setFormOpen(false);
      setEditingPlace(null);
      setFormError(null);
      void refreshWorkspace();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save this place.');
    } finally {
      setSubmitting(false);
    }
  };

  const runQuickUpdate = async (
    place: Place,
    patch: Partial<Pick<Place, 'is_favorite' | 'visited'>>,
  ) => {
    if (!workspace) return;

    setBusyPlaceId(place.id);
    setLoadError(null);

    try {
      const updatedPlace = await patchPlace(workspace.couple.id, place.id, patch);
      setPlaces((current) =>
        sortPlaces(current.map((currentPlace) =>
          currentPlace.id === updatedPlace.id ? updatedPlace : currentPlace,
        )),
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Unable to update this place.');
    } finally {
      setBusyPlaceId(null);
    }
  };

  const confirmDelete = async () => {
    if (!workspace || !placeToDelete) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deletePlace(workspace.couple.id, placeToDelete.id);
      setPlaces((current) => current.filter((place) => place.id !== placeToDelete.id));
      setPlaceToDelete(null);
      void refreshWorkspace();
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Unable to delete this place.');
    } finally {
      setDeleting(false);
    }
  };

  if (!workspace) return null;

  return (
    <div className="page-stack">
      <section className="page-toolbar">
        <div>
          <p className="section-heading__eyebrow">Our shortlist</p>
          <h2>Places worth remembering</h2>
        </div>
        <button className="compact-button" type="button" onClick={openCreateForm}>
          <AppIcon name="plus" size={18} />
          Add place
        </button>
      </section>

      <label className="places-search">
        <span className="sr-only">Search saved places</span>
        <AppIcon name="search" size={19} />
        <input
          type="search"
          value={searchQuery}
          placeholder="Search names, addresses, or notes"
          onChange={(event) => setSearchQuery(event.target.value)}
        />
        {searchQuery ? (
          <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear place search">
            <AppIcon name="close" size={16} />
          </button>
        ) : null}
      </label>

      <PlaceFilters
        activeFilter={filter}
        activeCityFilter={cityFilter}
        cities={cityOptions}
        counts={counts}
        unknownCityCount={unknownCityCount}
        onChange={setFilter}
        onCityChange={setCityFilter}
      />

      {loadError ? (
        <section className="inline-error" role="alert">
          <div>
            <strong>Something went wrong</strong>
            <p>{loadError}</p>
          </div>
          <button className="secondary-button" type="button" onClick={() => void loadSavedPlaces()}>
            Try again
          </button>
        </section>
      ) : null}

      {loading ? (
        <section className="empty-state empty-state--compact" aria-live="polite">
          <span className="empty-state__mark" aria-hidden="true">⌖</span>
          <h3>Loading your places…</h3>
        </section>
      ) : visiblePlaces.length > 0 ? (
        <section className="place-grid" aria-label="Shared saved places">
          {visiblePlaces.map((place) => (
            <PlaceCard
              place={place}
              busy={busyPlaceId === place.id}
              key={place.id}
              onEdit={openEditForm}
              onDelete={(selectedPlace) => {
                setDeleteError(null);
                setPlaceToDelete(selectedPlace);
              }}
              onToggleFavorite={(selectedPlace) =>
                runQuickUpdate(selectedPlace, { is_favorite: !selectedPlace.is_favorite })
              }
              onToggleVisited={(selectedPlace) =>
                runQuickUpdate(selectedPlace, { visited: !selectedPlace.visited })
              }
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <span className="empty-state__mark" aria-hidden="true">⌖</span>
          <h3>{places.length === 0 ? 'No places saved yet' : 'No matching places'}</h3>
          <p>
            {places.length === 0
              ? 'Save a restaurant, café, bar, dessert stop, or activity you both want to remember.'
              : 'Try a different category or location, or clear the search.'}
          </p>
          {places.length === 0 ? (
            <button className="primary-button empty-state__button" type="button" onClick={openCreateForm}>
              <AppIcon name="plus" size={18} />
              Save your first place
            </button>
          ) : null}
        </section>
      )}

      {formOpen ? (
        <PlaceForm
          place={editingPlace}
          submitting={submitting}
          serverError={formError}
          onCancel={closeForm}
          onSubmit={savePlace}
        />
      ) : null}

      {placeToDelete ? (
        <DeletePlaceDialog
          place={placeToDelete}
          deleting={deleting}
          error={deleteError}
          onCancel={() => {
            if (deleting) return;
            setPlaceToDelete(null);
            setDeleteError(null);
          }}
          onConfirm={confirmDelete}
        />
      ) : null}
    </div>
  );
}
