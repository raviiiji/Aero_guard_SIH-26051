import React from 'react';
import { SimulationResult, WeatherResponse } from '../types';
import { AnalyticsDashboard } from '../components/AnalyticsDashboard';

interface ThermalAnalyticsSectionProps {
  simResult: SimulationResult | null;
  weatherData: WeatherResponse | null;
}

export const ThermalAnalyticsSection: React.FC<ThermalAnalyticsSectionProps> = ({
  simResult,
  weatherData,
}) => {
  return (
    <div className="space-y-4">
      <AnalyticsDashboard
        simResult={simResult}
        weatherData={weatherData}
      />
    </div>
  );
};
