import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  MapPin,
  Wind,
  Droplets,
  Thermometer,
  Clock,
  Calendar,
  Cloud,
  CloudSun,
  Sun,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudLightning,
  Loader2,
  AlarmClock,
  Plus,
  Trash2,
  Hourglass,
  Bell,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import {
  searchCities,
  getWeatherData,
  CityResult,
  WeatherData,
  getWeatherIconName,
  getSchemaForWeather,
  getLocalHourFromIso
} from './services/weatherService';
import { WeatherBackground } from './components/WeatherBackground';

const ICON_MAP: Record<string, any> = {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle: CloudRain,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Thermometer
};

const WeatherIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = ICON_MAP[name] || Thermometer;
  return <Icon className={className} />;
};

// ---------- localStorage helpers ----------
const ALARMS_KEY = 'gh-alarms';
const TIMER_END_KEY = 'gh-timer-end';
const LAST_CITY_KEY = 'gh-last-city';

interface Alarm {
  id: string;
  time: string; // "HH:mm" in the city's timezone
  active: boolean;
}

const DEFAULT_CITY: CityResult = {
  id: 2332459,
  name: 'Lagos',
  latitude: 6.4531,
  longitude: 3.3958,
  timezone: 'Africa/Lagos',
  country: 'Nigeria'
};

function loadAlarms(): Alarm[] {
  try {
    const raw = localStorage.getItem(ALARMS_KEY);
    return raw ? (JSON.parse(raw) as Alarm[]) : [];
  } catch {
    return [];
  }
}

function loadTimerEnd(): number | null {
  try {
    const raw = localStorage.getItem(TIMER_END_KEY);
    if (!raw) return null;
    const end = parseInt(raw, 10);
    return Number.isNaN(end) || end <= Date.now() ? null : end;
  } catch {
    return null;
  }
}

function loadLastCity(): CityResult {
  try {
    const raw = localStorage.getItem(LAST_CITY_KEY);
    if (!raw) return DEFAULT_CITY;
    const city = JSON.parse(raw) as CityResult;
    if (typeof city.latitude !== 'number' || typeof city.longitude !== 'number' || !city.timezone) {
      return DEFAULT_CITY;
    }
    return city;
  } catch {
    return DEFAULT_CITY;
  }
}

// Isolated clock and tools component for maximum performance
const WorldClock = ({ timezone, city }: { timezone: string; city: string }) => {
  const [time, setTime] = useState(() => new Date());
  const [alarms, setAlarms] = useState<Alarm[]>(loadAlarms);
  const [newAlarm, setNewAlarm] = useState("");
  const [timerLeft, setTimerLeft] = useState<number | null>(null);
  const [timerInput, setTimerInput] = useState("");
  const [isAlarmSounding, setIsAlarmSounding] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  // Persist alarms across reloads
  useEffect(() => {
    try {
      localStorage.setItem(ALARMS_KEY, JSON.stringify(alarms));
    } catch {
      // storage unavailable (private mode etc.) — alarms just won't persist
    }
  }, [alarms]);

  // Restore a running timer across reloads (stored as an end timestamp)
  useEffect(() => {
    const end = loadTimerEnd();
    if (end) {
      setTimerLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    }
  }, []);

  // Sound Engine
  const startAlarmSound = () => {
    if (isAlarmSounding) return;
    setIsAlarmSounding(true);

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }

    const playPulse = () => {
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    };

    const interval = setInterval(() => {
      if (!oscillatorRef.current) {
        clearInterval(interval);
        return;
      }
      playPulse();
    }, 1000);

    oscillatorRef.current = {} as unknown as OscillatorNode; // active flag
  };

  const stopAlarmSound = () => {
    setIsAlarmSounding(false);
    oscillatorRef.current = null;
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setTime(now);

      // Check Alarms
      const currentTimeStr = formatInTimeZone(now, timezone, 'HH:mm');
      const triggeredAlarm = alarms.find(a => a.active && a.time === currentTimeStr);

      if (triggeredAlarm) {
        startAlarmSound();
        // Deactivate alarm after triggering so it doesn't loop forever
        setAlarms(prev => prev.map(a => a.id === triggeredAlarm.id ? { ...a, active: false } : a));
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timezone, alarms]);

  // Timer Effect
  useEffect(() => {
    if (timerLeft === null) return;
    if (timerLeft <= 0) {
      startAlarmSound();
      setTimerLeft(null);
      try { localStorage.removeItem(TIMER_END_KEY); } catch { /* ignore */ }
      return;
    }
    const interval = setInterval(() => setTimerLeft(prev => (prev ? prev - 1 : 0)), 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerLeft]);

  const addAlarm = () => {
    if (!newAlarm) return;
    setAlarms(prev => [...prev, { id: Math.random().toString(36).slice(2), time: newAlarm, active: true }]);
    setNewAlarm("");
  };

  const startTimer = () => {
    const mins = parseInt(timerInput, 10);
    if (isNaN(mins) || mins <= 0) return;
    try {
      localStorage.setItem(TIMER_END_KEY, String(Date.now() + mins * 60 * 1000));
    } catch { /* ignore */ }
    setTimerLeft(mins * 60);
    setTimerInput("");
  };

  const cancelTimer = () => {
    setTimerLeft(null);
    try { localStorage.removeItem(TIMER_END_KEY); } catch { /* ignore */ }
  };

  const timeStr = formatInTimeZone(time, timezone, 'HH:mm:ss');
  const dateStr = formatInTimeZone(time, timezone, 'EEEE, MMMM do, yyyy');

  return (
    <div className="flex flex-col items-center w-full">
      {/* No key-based re-mount animation: the clock ticks every second and must not re-render its animation */}
      <h2 className="text-7xl md:text-9xl font-bold text-white tracking-tighter mb-4 drop-shadow-xl tabular-nums">
        {timeStr}
      </h2>

      <div className="flex flex-col items-center gap-1 mb-12">
        <div className="flex items-center gap-2 text-xl text-white/80 font-medium">
          <Calendar className="w-5 h-5 text-pink-400" />
          {dateStr}
        </div>
        <div className="text-white/40 text-sm mt-2 font-mono tracking-widest uppercase bg-white/5 px-3 py-1 rounded-full">
          {timezone}
        </div>
      </div>

      {isAlarmSounding && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-8 p-6 bg-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.3)] border border-red-500/50 rounded-3xl backdrop-blur-3xl flex flex-col items-center gap-4 w-full"
        >
          <div className="text-red-100 font-bold text-xl animate-pulse flex items-center gap-2 text-center">
            <Bell className="w-6 h-6" /> ALARM TRIGGERED!
          </div>
          <button
            onClick={stopAlarmSound}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-2xl transition-all shadow-xl"
          >
            DISMISS
          </button>
        </motion.div>
      )}

      {/* Tools Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
        {/* Alarms */}
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md">
          <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            <AlarmClock className="w-4 h-4 text-pink-400" /> Alarms
          </h4>
          <div className="flex gap-2 mb-4">
            <input
              type="time"
              value={newAlarm}
              onChange={(e) => setNewAlarm(e.target.value)}
              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none focus:bg-white/20"
            />
            <button onClick={addAlarm} className="bg-white/10 hover:bg-white/20 p-2 rounded-xl text-white transition-colors" aria-label="Add alarm">
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar">
            {alarms.map(alarm => (
              <div key={alarm.id} className={`flex justify-between items-center p-3 rounded-xl border ${alarm.active ? 'bg-white/10 border-white/20' : 'bg-black/20 border-white/5 opacity-50'}`}>
                <span className="text-white font-mono">{alarm.time}</span>
                <button
                  onClick={() => setAlarms(prev => prev.filter(a => a.id !== alarm.id))}
                  className="text-white/40 hover:text-red-400 transition-colors"
                  aria-label="Delete alarm"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            {alarms.length === 0 && <div className="text-white/20 text-xs text-center py-4 italic">No active alarms</div>}
          </div>
        </div>

        {/* Timer */}
        <div className="bg-white/5 border border-white/10 rounded-[2rem] p-6 backdrop-blur-md flex flex-col">
          <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            <Hourglass className="w-4 h-4 text-sky-400" /> Timer
          </h4>

          {timerLeft === null ? (
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                placeholder="Mins"
                value={timerInput}
                onChange={(e) => setTimerInput(e.target.value)}
                className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
              />
              <button onClick={startTimer} className="bg-sky-500/50 hover:bg-sky-500/70 px-4 rounded-xl text-white font-bold transition-all">
                START
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center flex-1 py-2">
              <div className="text-4xl font-bold text-white mb-2 tabular-nums">
                {Math.floor(timerLeft / 60)}:{String(timerLeft % 60).padStart(2, '0')}
              </div>
              <button
                onClick={cancelTimer}
                className="text-xs text-white/40 hover:text-white uppercase tracking-tighter font-bold"
              >
                Cancel
              </button>
            </div>
          )}
          <div className="mt-auto pt-4 text-[10px] text-white/20 text-center uppercase tracking-widest">
            Sounds alarm on finish
          </div>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [query, setQuery] = useState('');
  const [cities, setCities] = useState<CityResult[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Handle city search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        try {
          setSearchError(null);
          const results = await searchCities(query);
          setCities(results);
        } catch (err) {
          setCities([]);
          setSearchError(err instanceof Error ? err.message : 'Search failed. Please try again.');
        }
      } else {
        setCities([]);
        setSearchError(null);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Load weather for selected city
  const fetchCityData = useCallback(async (city: CityResult) => {
    setLoading(true);
    setError(null);
    try {
      const weatherData = await getWeatherData(city.latitude, city.longitude);
      setWeather(weatherData);
      setSelectedCity(city);
      setCities([]);
      setQuery('');
      setIsSearchFocused(false);
      try {
        localStorage.setItem(LAST_CITY_KEY, JSON.stringify(city));
      } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load weather. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load: last city if the user picked one before, else Lagos
  useEffect(() => {
    fetchCityData(loadLastCity());
  }, [fetchCityData]);

  // Click outside search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const weatherType = weather ? getSchemaForWeather(weather.weatherCode) : 'clear';

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 md:p-8 overflow-x-hidden relative">
      {/* Background with dynamic animations */}
      <WeatherBackground type={weatherType} isDay={weather?.isDay ?? true} />

      {/* Search Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-2xl mb-8 z-50 text-center"
        ref={searchRef}
      >
        <h1 className="text-white text-4xl font-bold mb-2 drop-shadow-md">Global Horizon</h1>
        <p className="text-white/60 mb-6 text-sm font-medium tracking-wide uppercase">Real-time Weather & World Clock</p>

        <div className="relative group max-w-xl mx-auto">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            {loading ? <Loader2 className="w-5 h-5 text-white/50 animate-spin" /> : <Search className="w-5 h-5 text-white/50" />}
          </div>
          <input
            type="text"
            className="w-full bg-white/10 backdrop-blur-3xl border border-white/20 text-white placeholder:text-white/40 rounded-2xl py-4 pl-12 pr-4 outline-none focus:ring-2 focus:ring-white/30 transition-all shadow-2xl"
            placeholder="Search city (e.g. Tokyo, New York)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
          />

          <AnimatePresence>
            {isSearchFocused && (cities.length > 0 || searchError) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
              >
                {searchError ? (
                  <div className="px-6 py-4 text-left text-red-200/90 text-sm">{searchError}</div>
                ) : (
                  cities.map((city) => (
                    <button
                      key={city.id}
                      onClick={() => fetchCityData(city)}
                      className="w-full flex items-center gap-3 px-6 py-4 hover:bg-white/10 text-left transition-colors text-white border-b border-white/5 last:border-none"
                    >
                      <MapPin className="w-4 h-4 text-white/50" />
                      <div>
                        <div className="font-medium text-sm">{city.name}</div>
                        <div className="text-[10px] text-white/40 uppercase tracking-wider">{city.admin1 ? `${city.admin1}, ` : ''}{city.country}</div>
                      </div>
                    </button>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-5 gap-6 md:gap-8 min-h-[600px]">

        {/* Clock & Tools Card */}
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="hidden-scrollbar lg:col-span-3 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[3rem] p-8 md:p-12 shadow-2xl flex flex-col items-center relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <Clock className="w-64 h-64" />
          </div>

          <div className="flex items-center gap-2 text-white/60 mb-8 bg-white/5 px-4 py-1.5 rounded-full border border-white/10 z-10">
            <MapPin className="w-4 h-4" />
            <span className="text-sm font-bold tracking-[0.2em] uppercase">
              {selectedCity?.name}, {selectedCity?.country}
            </span>
          </div>

          {selectedCity && <WorldClock timezone={selectedCity.timezone} city={selectedCity.name} />}
        </motion.div>

        {/* Weather Card */}
        <motion.div
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[3rem] p-8 md:p-12 shadow-2xl flex flex-col h-full overflow-hidden"
        >
          {error ? (
            <div className="flex flex-col items-center justify-center flex-1 text-center gap-4 py-16">
              <AlertTriangle className="w-12 h-12 text-amber-300" />
              <p className="text-white/80 font-medium max-w-xs">{error}</p>
              <button
                onClick={() => selectedCity && fetchCityData(selectedCity)}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold px-6 py-3 rounded-2xl transition-all"
              >
                <RotateCcw className="w-4 h-4" /> Try again
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-white/60 text-sm font-bold uppercase tracking-widest mb-1">Local Conditions</h3>
                  <p className="text-white text-2xl font-semibold capitalize">{weather?.description}</p>
                </div>
                <div className="bg-white/20 p-4 rounded-3xl backdrop-blur-3xl shadow-inner border border-white/10">
                  {weather && (
                    <WeatherIcon
                      name={getWeatherIconName(weather.weatherCode)}
                      className="w-12 h-12 text-white drop-shadow-md"
                    />
                  )}
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-10">
                <span className="text-8xl font-bold text-white tracking-tighter">{weather?.temp}°</span>
                <span className="text-2xl text-white/40 font-medium pb-2">Feels like {weather?.feelsLike}°</span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-wider">
                    <Wind className="w-4 h-4" />
                    Wind Speed
                  </div>
                  <div className="text-white text-xl font-semibold">{weather?.windSpeed} <span className="text-sm font-normal text-white/60">km/h</span></div>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-3xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-white/40 text-xs font-bold uppercase tracking-wider">
                    <Droplets className="w-4 h-4" />
                    Humidity
                  </div>
                  <div className="text-white text-xl font-semibold">{weather?.humidity}<span className="text-sm font-normal text-white/60">%</span></div>
                </div>
              </div>

              <div className="mt-auto">
                <h4 className="text-white/40 text-xs font-bold uppercase tracking-widest mb-6 border-b border-white/10 pb-2">Next 5 Hours</h4>
                <div className="flex justify-between items-center overflow-x-auto pb-4 gap-4 no-scrollbar">
                  {weather?.forecast.map((item, index) => {
                    // API times are local to the selected city; parse the hour from the string
                    // so viewers in other timezones still see the city's local hours.
                    const hour = getLocalHourFromIso(item.time);
                    const displayHour = hour > 12 ? `${hour - 12} PM` : hour === 0 ? '12 AM' : hour === 12 ? '12 PM' : `${hour} AM`;

                    return (
                      <div key={index} className="flex flex-col items-center gap-3 min-w-[60px]">
                        <span className="text-white/40 text-xs font-medium uppercase">{displayHour}</span>
                        <WeatherIcon
                          name={getWeatherIconName(item.weatherCode)}
                          className="w-6 h-6 text-white"
                        />
                        <span className="text-white font-bold">{Math.round(item.temp)}°</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </motion.div>

      </div>

      {/* Decorative elements */}
      <div className="mt-12 text-white/20 text-xs flex items-center gap-4 hover:text-white/40 transition-colors cursor-default">
        <span>DATA POWERED BY OPEN-METEO</span>
        <span className="w-1 h-1 bg-white/20 rounded-full" />
        <span>REAL-TIME GLOBAL HORIZON</span>
      </div>
    </div>
  );
}
