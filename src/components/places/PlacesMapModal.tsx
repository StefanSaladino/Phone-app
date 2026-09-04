import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import {
  loadGoogleMapsLibraries,
  type GoogleAdvancedMarkerInstance,
  type GoogleInfoWindowInstance,
  type GoogleLatLngLiteral,
  type GoogleMapInstance,
  type GoogleMapsLibraries,
} from '../../lib/googleMaps';
import { getGoogleMapsUrl } from '../../lib/placeLinks';
import {
  resolveSavedPlaces,
  type ResolvedGooglePlace,
  type UnmatchedGooglePlace,
} from '../../services/googlePlaceService';
import type { Place, PlaceCategory } from '../../types/place';
import { AppIcon } from '../ui/AppIcon';

interface PlacesMapModalProps {
  places: Place[];
  onClose: () => void;
}

type MapStatus = 'loading' | 'ready' | 'error';
type LocationStatus = 'idle' | 'requesting' | 'shown' | 'error';

const categoryLabels: Record<PlaceCategory, string> = {
  food: 'Food',
  coffee: 'Coffee',
  drinks: 'Drinks',
  dessert: 'Dessert',
  recreation: 'Recreation',
};

function getLoadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'Unable to load Google Maps right now.';
}

function getLocationErrorMessage(error: GeolocationPositionError): string {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location access is off. Allow location for Together in your browser or device settings, then try again.';
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Your device could not determine its location right now.';
  }

  if (error.code === error.TIMEOUT) {
    return 'Location took too long to respond. Try again somewhere with a stronger GPS or network signal.';
  }

  return 'Unable to get your current location.';
}

function createInfoWindowContent(result: ResolvedGooglePlace): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'places-map-popup';

  const category = document.createElement('p');
  category.className = 'places-map-popup__category';
  category.textContent = categoryLabels[result.place.category];

  const title = document.createElement('h3');
  title.textContent = result.place.name;

  wrapper.append(category, title);

  if (result.place.location) {
    const location = document.createElement('p');
    location.textContent = result.place.location;
    wrapper.append(location);
  }

  const addressText = result.place.address ?? result.formattedAddress;
  if (addressText) {
    const address = document.createElement('p');
    address.textContent = addressText;
    wrapper.append(address);
  }

  const mapsLink = document.createElement('a');
  mapsLink.href = getGoogleMapsUrl(result.place);
  mapsLink.target = '_blank';
  mapsLink.rel = 'noreferrer noopener';
  mapsLink.textContent = 'Open in Google Maps';
  wrapper.append(mapsLink);

  return wrapper;
}

function fitMapToContent(
  map: GoogleMapInstance,
  libraries: GoogleMapsLibraries,
  resolvedPlaces: ResolvedGooglePlace[],
  currentLocation: GoogleLatLngLiteral | null,
): void {
  const locations = resolvedPlaces.map((result) => result.location);
  if (currentLocation) locations.push(currentLocation);

  if (locations.length === 0) {
    map.setCenter({ lat: 0, lng: 0 });
    map.setZoom(2);
    return;
  }

  if (locations.length === 1) {
    map.setCenter(locations[0]);
    map.setZoom(15);
    return;
  }

  const bounds = new libraries.LatLngBounds();
  locations.forEach((location) => bounds.extend(location));
  map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
}

function createCurrentLocationMarkerContent(): HTMLElement {
  const marker = document.createElement('div');
  marker.className = 'places-map-user-marker';
  marker.setAttribute('aria-hidden', 'true');

  const pulse = document.createElement('span');
  pulse.className = 'places-map-user-marker__pulse';

  const dot = document.createElement('span');
  dot.className = 'places-map-user-marker__dot';

  marker.append(pulse, dot);
  return marker;
}

/**
 * Large filtered-result map sheet. It exists only while the user is viewing
 * the map, which keeps Google Maps out of the normal Places page load path.
 */
export function PlacesMapModal({ places, onClose }: PlacesMapModalProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const markersRef = useRef<GoogleAdvancedMarkerInstance[]>([]);
  const userMarkerRef = useRef<GoogleAdvancedMarkerInstance | null>(null);
  const infoWindowRef = useRef<GoogleInfoWindowInstance | null>(null);
  const mapRef = useRef<GoogleMapInstance | null>(null);
  const librariesRef = useRef<GoogleMapsLibraries | null>(null);
  const [status, setStatus] = useState<MapStatus>('loading');
  const [resolvedPlaces, setResolvedPlaces] = useState<ResolvedGooglePlace[]>([]);
  const [unmatchedPlaces, setUnmatchedPlaces] = useState<UnmatchedGooglePlace[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<GoogleLatLngLiteral | null>(null);

  useEffect(() => {
    const scrollY = window.scrollY;
    const previousBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.position = previousBodyStyles.position;
      document.body.style.top = previousBodyStyles.top;
      document.body.style.width = previousBodyStyles.width;
      document.body.style.overflow = previousBodyStyles.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = [];
    if (userMarkerRef.current) userMarkerRef.current.map = null;
    userMarkerRef.current = null;
    infoWindowRef.current?.close();
    infoWindowRef.current = null;
    mapRef.current = null;
    librariesRef.current = null;

    setStatus('loading');
    setResolvedPlaces([]);
    setUnmatchedPlaces([]);
    setErrorMessage(null);
    setLocationStatus('idle');
    setLocationMessage(null);
    setCurrentLocation(null);

    async function initializeMap(): Promise<void> {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '';
      const mapId = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? '';

      if (!mapId.trim()) {
        throw new Error(
          'Google Maps is not configured. Add VITE_GOOGLE_MAPS_MAP_ID and reload the app.',
        );
      }

      const libraries = await loadGoogleMapsLibraries(apiKey);
      const resolution = await resolveSavedPlaces(places, libraries.Place);

      if (cancelled) return;

      setResolvedPlaces(resolution.resolved);
      setUnmatchedPlaces(resolution.unmatched);

      const mapElement = mapElementRef.current;
      if (!mapElement) {
        throw new Error('The map view could not be initialized.');
      }

      const firstResult = resolution.resolved[0];
      const map = new libraries.Map(mapElement, {
        center: firstResult?.location ?? { lat: 0, lng: 0 },
        zoom: firstResult ? 14 : 2,
        mapId: mapId.trim(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
      });

      mapRef.current = map;
      librariesRef.current = libraries;

      const infoWindow = new libraries.InfoWindow();
      infoWindowRef.current = infoWindow;
      const markers: GoogleAdvancedMarkerInstance[] = [];

      for (const result of resolution.resolved) {
        if (cancelled) break;

        const marker = new libraries.AdvancedMarkerElement({
          map,
          position: result.location,
          title: result.place.name,
        });

        marker.addListener('click', () => {
          infoWindow.setContent(createInfoWindowContent(result));
          infoWindow.open({ map, anchor: marker, shouldFocus: false });
        });

        markers.push(marker);
      }

      if (cancelled) {
        markers.forEach((marker) => {
          marker.map = null;
        });
        return;
      }

      markersRef.current = markers;
      fitMapToContent(map, libraries, resolution.resolved, null);
      setStatus('ready');
    }

    void initializeMap().catch((error: unknown) => {
      if (cancelled) return;

      setStatus('error');
      setErrorMessage(getLoadErrorMessage(error));
      setResolvedPlaces([]);
      setUnmatchedPlaces(places.map((place) => ({ place, reason: 'lookup-failed' })));
    });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => {
        marker.map = null;
      });
      markersRef.current = [];
      if (userMarkerRef.current) userMarkerRef.current.map = null;
      userMarkerRef.current = null;
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapRef.current = null;
      librariesRef.current = null;
    };
  }, [places]);

  const requestCurrentLocation = () => {
    if (status !== 'ready' || locationStatus === 'requesting') return;

    if (!window.isSecureContext) {
      setLocationStatus('error');
      setLocationMessage('Current location is available only on HTTPS or localhost.');
      return;
    }

    if (!('geolocation' in navigator)) {
      setLocationStatus('error');
      setLocationMessage('Current location is not supported by this browser or device.');
      return;
    }

    const map = mapRef.current;
    const libraries = librariesRef.current;

    if (!map || !libraries) {
      setLocationStatus('error');
      setLocationMessage('The map is not ready for location yet.');
      return;
    }

    setLocationStatus('requesting');
    setLocationMessage('Waiting for your device…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };

        if (userMarkerRef.current) userMarkerRef.current.map = null;

        userMarkerRef.current = new libraries.AdvancedMarkerElement({
          map,
          position: location,
          title: 'Your current location',
          content: createCurrentLocationMarkerContent(),
        });

        setCurrentLocation(location);
        setLocationStatus('shown');
        setLocationMessage('Your current location is shown on the map.');
        fitMapToContent(map, libraries, resolvedPlaces, location);
      },
      (error) => {
        setLocationStatus('error');
        setLocationMessage(getLocationErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    );
  };

  const mappedCount = resolvedPlaces.length;
  const totalCount = places.length;
  const mapSummary =
    status === 'loading'
      ? `Preparing ${totalCount} ${totalCount === 1 ? 'place' : 'places'}`
      : `${mappedCount} of ${totalCount} ${totalCount === 1 ? 'place' : 'places'} on the map`;

  return (
    <div
      className="places-map-backdrop"
      role="presentation"
      onMouseDown={(event: ReactMouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="places-map-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="places-map-title"
        aria-describedby="places-map-description"
        onMouseDown={(event: ReactMouseEvent<HTMLElement>) => event.stopPropagation()}
      >
        <header className="places-map-sheet__header">
          <div>
            <p className="section-heading__eyebrow">Current results</p>
            <h2 id="places-map-title">{mapSummary}</h2>
            <p id="places-map-description">
              This map uses exactly the places matching your current filters and search.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            className="places-map-close"
            type="button"
            aria-label="Close map"
            onClick={onClose}
          >
            <AppIcon name="close" size={20} />
          </button>
        </header>

        <div className="places-map-sheet__body">
          <div
            ref={mapElementRef}
            className={`places-map-canvas${mappedCount === 0 && !currentLocation && status !== 'loading' ? ' is-empty' : ''}`}
            aria-label="Google Map of filtered saved places"
          />

          {status === 'ready' ? (
            <div className="places-map-location-control">
              <button
                className="secondary-button"
                type="button"
                disabled={locationStatus === 'requesting'}
                onClick={requestCurrentLocation}
              >
                <AppIcon name="places" size={17} />
                {locationStatus === 'requesting'
                  ? 'Getting location…'
                  : locationStatus === 'shown'
                    ? 'Update my location'
                    : 'Show my location'}
              </button>
              <span
                className={`places-map-location-control__message${locationStatus === 'error' ? ' is-error' : ''}`}
                aria-live="polite"
              >
                {locationMessage ?? 'Tap to let Together ask your device for your current location.'}
              </span>
            </div>
          ) : null}

          {status === 'loading' ? (
            <div className="places-map-overlay" aria-live="polite">
              <span className="places-map-overlay__mark" aria-hidden="true">
                ⌖
              </span>
              <strong>Finding your saved places…</strong>
              <p>Google Maps loads only because you opened this view.</p>
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="places-map-overlay places-map-overlay--error" role="alert">
              <span className="places-map-overlay__mark" aria-hidden="true">
                !
              </span>
              <strong>Map unavailable</strong>
              <p>{errorMessage}</p>
            </div>
          ) : null}

          {status === 'ready' && mappedCount === 0 && !currentLocation ? (
            <div className="places-map-overlay places-map-overlay--no-matches" aria-live="polite">
              <span className="places-map-overlay__mark" aria-hidden="true">
                ⌖
              </span>
              <strong>No confident map matches</strong>
              <p>
                Nothing was guessed. You can still show your current location or use the Google Maps links below.
              </p>
            </div>
          ) : null}
        </div>

        {unmatchedPlaces.length > 0 ? (
          <section className="places-map-unmatched" aria-labelledby="unmatched-places-title">
            <div className="places-map-unmatched__heading">
              <div>
                <p className="section-heading__eyebrow">Needs a closer look</p>
                <h3 id="unmatched-places-title">
                  {unmatchedPlaces.length}{' '}
                  {unmatchedPlaces.length === 1 ? 'place was' : 'places were'} not plotted
                </h3>
              </div>
              <p>We leave uncertain matches off the map instead of guessing.</p>
            </div>

            <div className="places-map-unmatched__list">
              {unmatchedPlaces.map(({ place }) => (
                <article className="places-map-unmatched__item" key={place.id}>
                  <div>
                    <strong>{place.name}</strong>
                    <span>{place.address ?? place.location ?? 'No saved address or location'}</span>
                  </div>
                  <a
                    className="secondary-button external-action"
                    href={getGoogleMapsUrl(place)}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <AppIcon name="map" size={16} />
                    Open in Google Maps
                    <AppIcon name="external-link" size={13} />
                  </a>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}
