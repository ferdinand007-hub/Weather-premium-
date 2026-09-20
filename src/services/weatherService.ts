/**
 * Service for fetching weather and geocoding data using Open-Meteo.
 * Free for non-commercial use, no API key required.
 */

export interface CityResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  admin1?: string;
}

export interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  description: string;
  isDay: boolean;
  /** IANA timezone of the weather location (from the API response). */
  timezone: string;
  /** Hour entries in the location's local time (ISO strings like "2026-09-20T14:00"). */
  forecast: {
    time: string;
    temp: number;
    weatherCode: number;
  }[];
}

// Full WMO weather-code table: https://open-meteo.com/en/docs
const WEATHER_CODES: Record<number, { desc: string; icon: string }> = {
  0: { desc: "Clear sky", icon: "Sun" },
  1: { desc: "Mainly clear", icon: "CloudSun" },
  2: { desc: "Partly cloudy", icon: "CloudSun" },
  3: { desc: "Overcast", icon: "Cloud" },
  45: { desc: "Foggy", icon: "CloudFog" },
  48: { desc: "Depositing rime fog", icon: "CloudFog" },
  51: { desc: "Light drizzle", icon: "CloudDrizzle" },
  53: { desc: "Moderate drizzle", icon: "CloudDrizzle" },
  55: { desc: "Dense drizzle", icon: "CloudDrizzle" },
  56: { desc: "Light freezing drizzle", icon: "CloudDrizzle" },
  57: { desc: "Dense freezing drizzle", icon: "CloudDrizzle" },
  61: { desc: "Slight rain", icon: "CloudRain" },
  63: { desc: "Moderate rain", icon: "CloudRain" },
  65: { desc: "Heavy rain", icon: "CloudRain" },
  66: { desc: "Light freezing rain", icon: "CloudRain" },
  67: { desc: "Heavy freezing rain", icon: "CloudRain" },
  71: { desc: "Slight snow fall", icon: "CloudSnow" },
  73: { desc: "Moderate snow fall", icon: "CloudSnow" },
  75: { desc: "Heavy snow fall", icon: "CloudSnow" },
  77: { desc: "Snow grains", icon: "CloudSnow" },
  80: { desc: "Slight rain showers", icon: "CloudRain" },
  81: { desc: "Moderate rain showers", icon: "CloudRain" },
  82: { desc: "Violent rain showers", icon: "CloudRain" },
  85: { desc: "Slight snow showers", icon: "CloudSnow" },
  86: { desc: "Heavy snow showers", icon: "CloudSnow" },
  95: { desc: "Thunderstorm", icon: "CloudLightning" },
  96: { desc: "Thunderstorm with slight hail", icon: "CloudLightning" },
  99: { desc: "Thunderstorm with heavy hail", icon: "CloudLightning" },
};

export async function searchCities(query: string): Promise<CityResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`City search failed (HTTP ${response.status}). Check your connection and try again.`);
  }
  const data = await response.json();
  return data.results || [];
}

export async function getWeatherData(lat: number, lon: number): Promise<WeatherData> {
  // timezone=auto makes all returned times local to the requested coordinates.
  // forecast_days=2 guarantees at least 5 hourly entries after the current hour,
  // even when the current hour is late in the day.
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=2`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed (HTTP ${response.status}). Check your connection and try again.`);
  }
  const data = await response.json();

  if (!data.current || !data.hourly) {
    throw new Error("The weather service returned an unexpected response. Please try again.");
  }

  const current = data.current;
  const weatherInfo = WEATHER_CODES[current.weather_code] || { desc: "Unknown", icon: "Thermometer" };

  const hourlyTimes: string[] = data.hourly.time;
  const hourlyTemps: number[] = data.hourly.temperature_2m;
  const hourlyCodes: number[] = data.hourly.weather_code;

  // Start the forecast at the current hour, not at midnight.
  const currentHour = current.time.slice(0, 13); // "YYYY-MM-DDTHH"
  let startIndex = hourlyTimes.findIndex((t: string) => t.slice(0, 13) === currentHour);
  if (startIndex < 0) startIndex = 0;

  const forecast = hourlyTimes.slice(startIndex, startIndex + 5).map((time: string, i: number) => ({
    time,
    temp: hourlyTemps[startIndex + i],
    weatherCode: hourlyCodes[startIndex + i],
  }));

  return {
    temp: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    description: weatherInfo.desc,
    isDay: current.is_day === 1,
    timezone: data.timezone ?? "UTC",
    forecast,
  };
}

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunderstorm';

export function getSchemaForWeather(code: number): WeatherType {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code === 95 || code === 96 || code === 99) return 'thunderstorm';
  return 'clear';
}

export function getWeatherIconName(code: number): string {
  return WEATHER_CODES[code]?.icon || "Thermometer";
}

/** Extract the location-local hour (0-23) from an API ISO string like "2026-09-20T14:00". */
export function getLocalHourFromIso(iso: string): number {
  return parseInt(iso.slice(11, 13), 10);
}
