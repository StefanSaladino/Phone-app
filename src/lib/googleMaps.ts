/**
 * Minimal runtime types for the Google Maps JavaScript API.
 *
 * Together deliberately avoids adding @googlemaps/js-api-loader or the large
 * Google Maps TypeScript declaration package for this one lazy feature.
 */
export type GoogleLatLngLiteral = {
  lat: number;
  lng: number;
};

export type GoogleLatLngLike =
  | GoogleLatLngLiteral
  | {
      lat: () => number;
      lng: () => number;
    };

export interface GooglePlaceLike {
  id?: string;
  displayName?: string;
  formattedAddress?: string;
  location?: GoogleLatLngLike;
  googleMapsURI?: string;
  fetchFields: (request: { fields: string[] }) => Promise<void>;
}

export interface GooglePlaceConstructor {
  new (options: { id: string }): GooglePlaceLike;
  searchByText: (request: {
    textQuery: string;
    fields: string[];
    maxResultCount?: number;
    language?: string;
  }) => Promise<{ places: GooglePlaceLike[] }>;
}

export interface GoogleMapInstance {
  fitBounds: (bounds: GoogleLatLngBoundsInstance, padding?: number | Record<string, number>) => void;
  setCenter: (position: GoogleLatLngLike) => void;
  setZoom: (zoom: number) => void;
}

export interface GoogleMapConstructor {
  new (
    element: HTMLElement,
    options: {
      center: GoogleLatLngLike;
      zoom: number;
      mapId: string;
      mapTypeControl?: boolean;
      streetViewControl?: boolean;
      fullscreenControl?: boolean;
      gestureHandling?: string;
    },
  ): GoogleMapInstance;
}

export interface GoogleInfoWindowInstance {
  setContent: (content: Node | string) => void;
  open: (options: {
    map: GoogleMapInstance;
    anchor: GoogleAdvancedMarkerInstance;
    shouldFocus?: boolean;
  }) => void;
  close: () => void;
}

export interface GoogleInfoWindowConstructor {
  new (): GoogleInfoWindowInstance;
}

export interface GoogleAdvancedMarkerInstance {
  map: GoogleMapInstance | null;
  addListener: (eventName: 'click', handler: () => void) => unknown;
}

export interface GoogleAdvancedMarkerConstructor {
  new (options: {
    map: GoogleMapInstance;
    position: GoogleLatLngLike;
    title?: string;
    content?: Node;
  }): GoogleAdvancedMarkerInstance;
}

export interface GoogleLatLngBoundsInstance {
  extend: (position: GoogleLatLngLike) => GoogleLatLngBoundsInstance;
}

export interface GoogleLatLngBoundsConstructor {
  new (): GoogleLatLngBoundsInstance;
}

export interface GoogleMapsLibraries {
  Map: GoogleMapConstructor;
  InfoWindow: GoogleInfoWindowConstructor;
  AdvancedMarkerElement: GoogleAdvancedMarkerConstructor;
  LatLngBounds: GoogleLatLngBoundsConstructor;
  Place: GooglePlaceConstructor;
}

interface GoogleMapsNamespace {
  importLibrary: (libraryName: string) => Promise<unknown>;
}

interface MapsWindow extends Window {
  google?: {
    maps?: GoogleMapsNamespace;
  };
  __togetherGoogleMapsReady?: () => void;
}

const MAPS_SCRIPT_ID = 'together-google-maps-script';
let mapsApiPromise: Promise<GoogleMapsNamespace> | null = null;

/**
 * Loads the Maps JavaScript API only after the filtered-map UI is opened.
 */
export function loadGoogleMapsApi(apiKey: string): Promise<GoogleMapsNamespace> {
  const trimmedApiKey = apiKey.trim();

  if (!trimmedApiKey) {
    return Promise.reject(
      new Error('Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY and reload the app.'),
    );
  }

  const mapsWindow = window as MapsWindow;
  const existingMaps = mapsWindow.google?.maps;

  if (existingMaps?.importLibrary) {
    return Promise.resolve(existingMaps);
  }

  if (mapsApiPromise) return mapsApiPromise;

  mapsApiPromise = new Promise<GoogleMapsNamespace>((resolve, reject) => {
    const staleScript = document.getElementById(MAPS_SCRIPT_ID);
    if (staleScript) staleScript.remove();

    const cleanupCallback = () => {
      delete mapsWindow.__togetherGoogleMapsReady;
    };

    mapsWindow.__togetherGoogleMapsReady = () => {
      const loadedMaps = mapsWindow.google?.maps;

      if (!loadedMaps?.importLibrary) {
        cleanupCallback();
        mapsApiPromise = null;
        reject(new Error('Google Maps loaded without the expected library interface.'));
        return;
      }

      cleanupCallback();
      resolve(loadedMaps);
    };

    const script = document.createElement('script');
    const params = new URLSearchParams({
      key: trimmedApiKey,
      loading: 'async',
      callback: '__togetherGoogleMapsReady',
      v: 'weekly',
    });

    script.id = MAPS_SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.onerror = () => {
      script.remove();
      cleanupCallback();
      mapsApiPromise = null;
      reject(
        new Error(
          'Google Maps could not load. Check the API key, browser restrictions, enabled APIs, and network connection.',
        ),
      );
    };

    document.head.appendChild(script);
  });

  return mapsApiPromise;
}

/**
 * Imports only the libraries the map modal needs, after the base API is ready.
 */
export async function loadGoogleMapsLibraries(apiKey: string): Promise<GoogleMapsLibraries> {
  const maps = await loadGoogleMapsApi(apiKey);

  const [mapsLibrary, markerLibrary, placesLibrary, coreLibrary] = await Promise.all([
    maps.importLibrary('maps'),
    maps.importLibrary('marker'),
    maps.importLibrary('places'),
    maps.importLibrary('core'),
  ]);

  const { Map, InfoWindow } = mapsLibrary as {
    Map: GoogleMapConstructor;
    InfoWindow: GoogleInfoWindowConstructor;
  };
  const { AdvancedMarkerElement } = markerLibrary as {
    AdvancedMarkerElement: GoogleAdvancedMarkerConstructor;
  };
  const { Place } = placesLibrary as {
    Place: GooglePlaceConstructor;
  };
  const { LatLngBounds } = coreLibrary as {
    LatLngBounds: GoogleLatLngBoundsConstructor;
  };

  if (!Map || !InfoWindow || !AdvancedMarkerElement || !Place || !LatLngBounds) {
    throw new Error('Google Maps did not provide all required map libraries.');
  }

  return {
    Map,
    InfoWindow,
    AdvancedMarkerElement,
    LatLngBounds,
    Place,
  };
}
