import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { DefenseStation, WeatherResponse } from '../types';
import { MapPin, ThermometerSnowflake, Sun, Wind, Mountain, Compass } from 'lucide-react';

// Fix Leaflet default icon paths
const customIcon = new L.DivIcon({
  className: 'custom-military-pin',
  html: `
    <div style="
      background: radial-gradient(circle, #06b6d4 0%, #1e3a8a 100%);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #ffffff;
      box-shadow: 0 0 12px #06b6d4;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 6px; height: 6px; background: #ffffff; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const stationIcon = new L.DivIcon({
  className: 'custom-station-pin',
  html: `
    <div style="
      background: radial-gradient(circle, #f59e0b 0%, #78350f 100%);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid #fef08a;
      box-shadow: 0 0 10px #f59e0b;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="width: 5px; height: 5px; background: #ffffff; border-radius: 50%;"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface MapClickHandlerProps {
  onLocationSelect: (lat: number, lng: number) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onLocationSelect }) => {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

// Recenter helper
const ChangeMapView: React.FC<{ coords: [number, number] }> = ({ coords }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(coords, map.getZoom());
  }, [coords, map]);
  return null;
};

interface GeospatialMapProps {
  latitude: number;
  longitude: number;
  elevation: number;
  currentStation: DefenseStation | null;
  stations: DefenseStation[];
  weatherData: WeatherResponse | null;
  onLocationSelect: (lat: number, lng: number) => void;
}

export const GeospatialMap: React.FC<GeospatialMapProps> = ({
  latitude,
  longitude,
  elevation,
  currentStation,
  stations,
  weatherData,
  onLocationSelect,
}) => {
  const position: [number, number] = [latitude, longitude];

  return (
    <div className="tactical-card p-3.5 flex flex-col h-full">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-tactical-cyan" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
            Geospatial Deployment Zone & Terrain Map
          </h2>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Click map to drop tactical deployment pin
        </span>
      </div>

      {/* Map Container */}
      <div className="relative rounded-lg overflow-hidden border border-command-700/80 h-64 md:h-72 w-full">
        <MapContainer
          center={position}
          zoom={7}
          scrollWheelZoom={true}
          className="h-full w-full"
        >
          {/* High-Contrast OpenStreetMap CartoDB Dark Matter */}
          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

          <ChangeMapView coords={position} />
          <MapClickHandler onLocationSelect={onLocationSelect} />

          {/* Preset Military Stations */}
          {stations.map((st) => (
            <Marker
              key={st.id}
              position={[st.lat, st.lng]}
              icon={stationIcon}
              eventHandlers={{
                click: () => onLocationSelect(st.lat, st.lng),
              }}
            >
              <Popup>
                <div className="p-1 font-mono text-xs text-slate-100">
                  <div className="font-bold text-amber-400">{st.name}</div>
                  <div className="text-[10px] text-slate-400">{st.region}</div>
                  <div className="mt-1 text-[11px]">
                    Alt: <strong className="text-tactical-cyan">{st.elevation_m}m</strong> | Min T:{' '}
                    <strong className="text-blue-400">{st.winter_temp_min}°C</strong>
                  </div>
                  <div className="text-[10px] text-slate-300 mt-0.5">{st.description}</div>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Current Selected Tactical Pin */}
          <Marker position={position} icon={customIcon}>
            <Popup>
              <div className="p-1 font-mono text-xs text-slate-100">
                <div className="font-bold text-tactical-cyan">Active Deployment Site</div>
                <div>
                  Lat: {latitude.toFixed(3)}°N, Lng: {longitude.toFixed(3)}°E
                </div>
                <div>Elevation: {elevation} m</div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>

        {/* Floating Telemetry Badge on Map */}
        <div className="absolute bottom-2 left-2 z-[400] bg-command-950/90 backdrop-blur-md border border-command-700/80 rounded px-2.5 py-1.5 font-mono text-[11px] flex items-center gap-3">
          <div className="flex items-center gap-1 text-tactical-cyan">
            <Mountain className="w-3.5 h-3.5" />
            <span>{elevation}m ASL</span>
          </div>
          <div className="flex items-center gap-1 text-slate-300 border-l border-command-700 pl-2">
            <span>{latitude.toFixed(2)}°N, {longitude.toFixed(2)}°E</span>
          </div>
        </div>
      </div>

      {/* Meteorological Summary Grid */}
      {weatherData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2.5 font-mono">
          <div className="bg-command-950/70 border border-command-700/60 rounded p-2 flex items-center gap-2">
            <ThermometerSnowflake className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">90d Min Temp</div>
              <div className="text-xs font-bold text-blue-400">
                {weatherData.metrics_90day.extreme_min_temp_c}°C
              </div>
            </div>
          </div>

          <div className="bg-command-950/70 border border-command-700/60 rounded p-2 flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">Avg Solar Yield</div>
              <div className="text-xs font-bold text-amber-400">
                {weatherData.metrics_90day.avg_daily_solar_kwh_m2} <span className="text-[10px]">kWh/m²/d</span>
              </div>
            </div>
          </div>

          <div className="bg-command-950/70 border border-command-700/60 rounded p-2 flex items-center gap-2">
            <Wind className="w-4 h-4 text-slate-300 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">Peak Wind Gust</div>
              <div className="text-xs font-bold text-slate-200">
                {weatherData.metrics_90day.avg_peak_wind_mps} m/s
              </div>
            </div>
          </div>

          <div className="bg-command-950/70 border border-command-700/60 rounded p-2 flex items-center gap-2">
            <Mountain className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-[10px] text-slate-400">Seasonal Solar</div>
              <div className="text-xs font-bold text-emerald-400">
                {weatherData.metrics_90day.total_seasonal_solar_kwh_m2} <span className="text-[10px]">kWh/m²</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
