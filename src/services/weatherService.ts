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
  forecast: {
    time: string;
    temp: number;
    weatherCode: number;
  }[];
}

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
  61: { desc: "Slight rain", icon: "CloudRain" },
  63: { desc: "Moderate rain", icon: "CloudRain" },
  65: { desc: "Heavy rain", icon: "CloudRain" },
  71: { desc: "Slight snow fall", icon: "CloudSnow" },
  73: { desc: "Moderate snow fall", icon: "CloudSnow" },
  75: { desc: "Heavy snow fall", icon: "CloudSnow" },
  80: { desc: "Slight rain showers", icon: "CloudRain" },
  81: { desc: "Moderate rain showers", icon: "CloudRain" },
  82: { desc: "Violent rain showers", icon: "CloudRain" },
  95: { desc: "Thunderstorm", icon: "CloudLightning" },
};

export async function searchCities(query: string): Promise<CityResult[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const response = await fetch(url);
  const data = await response.json();
  return data.results || [];
}

export async function getWeatherData(lat: number, lon: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&forecast_days=1`;
  const response = await fetch(url);
  const data = await response.json();

  const current = data.current;
  const weatherInfo = WEATHER_CODES[current.weather_code] || { desc: "Unknown", icon: "Thermometer" };

  const hourlyTimes = data.hourly.time;
  const hourlyTemps = data.hourly.temperature_2m;
  const hourlyCodes = data.hourly.weather_code;

  // Next 5 hours of forecast
  const forecast = hourlyTimes.slice(0, 5).map((time: string, i: number) => ({
    time,
    temp: hourlyTemps[i],
    weatherCode: hourlyCodes[i],
  }));

  return {
    temp: Math.round(current.temperature_2m),
    feelsLike: Math.round(current.apparent_temperature),
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    description: weatherInfo.desc,
    isDay: current.is_day === 1,
    forecast,
  };
}

export type WeatherType = 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunderstorm';

export function getSchemaForWeather(code: number): WeatherType {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'fog';
  if ((code >= 51 && code <= 65) || (code >= 80 && code <= 82)) return 'rain';
  if (code >= 71 && code <= 75) return 'snow';
  if (code === 95) return 'thunderstorm';
  return 'clear';
}

export function getWeatherIconName(code: number): string {
  return WEATHER_CODES[code]?.icon || "Thermometer";
}
