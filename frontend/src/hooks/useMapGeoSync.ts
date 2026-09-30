import React, { useCallback, useEffect, useRef } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { metersPerPixel, type SceneOrigin } from '../services/geoProjection';

/**
 * Camera state published by the existing Leaflet map so the 3D scene can be
 * driven from the same projection the tiles use.
 */
export interface MapCameraState {
  /** Map centre, in WGS84. This is the origin of the 3D scene. */
  center: { latitude: number; longitude: number };
  /** DEM elevation used as the scene's vertical datum. */
  centerElevation: number;
  zoom: number;
  /** Compass rotation of the map. Core Leaflet reports 0. */
  bearing: number;
  /** Tilt in degrees above the horizon. Core Leaflet has no pitch; we use our own. */
  pitchDeg: number;
  /** Map viewport in CSS pixels. */
  widthPx: number;
  heightPx: number;
  /** Ground resolution at the centre, in metres per CSS pixel. */
  metersPerPixel: number;
  /** Increments on every move/zoom/resize so consumers can detect staleness. */
  revision: number;
}

export interface MapCameraReporterProps {
  /** Vertical datum for the 3D scene (DEM elevation of the shelter). */
  centerElevation: number;
  /** Tilt used for the 3D view. 0 = straight down (pixel-exact overlay). */
  pitchDeg: number;
  onCameraChange: (state: MapCameraState) => void;
}

const DEFAULT_PITCH_DEG = 55;

/**
 * Must be rendered INSIDE the existing <MapContainer>. Adds no map of its own:
 * it only observes the map that is already there and republishes its camera.
 *
 * `bearing` and `pitch` are read from Leaflet when the installed build exposes
 * them (some plugins add them); otherwise the map is north-up and we drive the
 * pitch ourselves.
 */
export const MapCameraReporter: React.FC<MapCameraReporterProps> = ({
  centerElevation,
  pitchDeg = DEFAULT_PITCH_DEG,
  onCameraChange,
}) => {
  const map = useMap();
  const revisionRef = useRef(0);
  const centerElevationRef = useRef(centerElevation);

  // Written during render on purpose: Leaflet events fire outside React's
  // batching, so the datum must be current before the next map event.
  useEffect(() => {
    centerElevationRef.current = centerElevation;
  }, [centerElevation]);

  const emit = useCallback(() => {
    const center = map.getCenter();
    const size = map.getSize();
    const mapWithRot = map as LeafletMap & {
      getBearing?: () => number;
      getPitch?: () => number;
    };
    const zoom = map.getZoom();
    revisionRef.current += 1;
    onCameraChange({
      center: { latitude: center.lat, longitude: center.lng },
      centerElevation: centerElevationRef.current,
      zoom,
      bearing: typeof mapWithRot.getBearing === 'function' ? mapWithRot.getBearing() : 0,
      pitchDeg:
        typeof mapWithRot.getPitch === 'function' && mapWithRot.getPitch() > 0
          ? mapWithRot.getPitch()
          : pitchDeg,
      widthPx: size.x,
      heightPx: size.y,
      metersPerPixel: metersPerPixel(center.lat, zoom),
      revision: revisionRef.current,
    });
  }, [map, onCameraChange, pitchDeg]);

  // Republish on every move, zoom, resize and view reset.
  useMapEvents({
    movestart: emit,
    move: emit,
    zoomend: emit,
    resize: emit,
    viewreset: emit,
  });

  useEffect(() => {
    emit();
    const container = map.getContainer();
    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => emit())
        : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  }, [emit, map]);

  // Centre elevation changes (new DEM sample) also invalidate the scene datum.
  useEffect(() => {
    emit();
  }, [centerElevation, emit]);

  return null;
};

/** Scene origin for the map-centred 3D scene. */
export function sceneOriginFromCamera(
  camera: MapCameraState
): SceneOrigin {
  return {
    latitude: camera.center.latitude,
    longitude: camera.center.longitude,
    elevation: camera.centerElevation,
  };
}
