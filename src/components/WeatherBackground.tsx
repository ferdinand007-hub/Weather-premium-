import { motion } from 'motion/react';
import { memo } from 'react';
import { WeatherType } from '../services/weatherService';

interface WeatherBackgroundProps {
  type: WeatherType;
  isDay: boolean;
}

export const WeatherBackground = memo(({ type, isDay }: WeatherBackgroundProps) => {
  const getBaseColors = () => {
    if (!isDay) return 'from-slate-950 via-indigo-950 to-slate-900';
    
    switch (type) {
      case 'clear': return 'from-blue-400 via-sky-300 to-amber-100';
      case 'cloudy': return 'from-blue-500 via-slate-400 to-slate-300';
      case 'rain': return 'from-slate-700 via-blue-900 to-slate-800';
      case 'snow': return 'from-blue-100 via-slate-200 to-sky-100';
      case 'fog': return 'from-slate-500 via-gray-400 to-slate-300';
      case 'thunderstorm': return 'from-indigo-950 via-slate-900 to-purple-950';
      default: return 'from-blue-600 to-pink-400';
    }
  };

  return (
    <div className={`fixed inset-0 -z-10 bg-gradient-to-br ${getBaseColors()} transition-colors duration-1000 overflow-hidden will-change-contents`}>
      {/* Universal Ambient Light - Uses static scale to save GPU */}
      <motion.div 
        animate={{ 
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute -top-1/4 -left-1/4 w-full h-full bg-white/10 rounded-full blur-[100px] pointer-events-none"
      />

      {/* Weather Specific Animations - Reduced counts for performance */}
      {type === 'rain' && <RainEffect />}
      {type === 'snow' && <SnowEffect />}
      {type === 'cloudy' && <CloudEffect />}
      {type === 'clear' && isDay && <SunEffect />}
      {type === 'thunderstorm' && <ThunderEffect />}
      {type === 'fog' && <FogEffect />}
    </div>
  );
});

WeatherBackground.displayName = 'WeatherBackground';

const RainEffect = () => (
  <div className="absolute inset-0 pointer-events-none">
    {/* Reduced to 30 drops for smoothness */}
    {[...Array(30)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ y: -100, x: Math.random() * 100 + '%' }}
        animate={{ y: '110vh' }}
        transition={{
          duration: 0.6 + Math.random() * 0.4,
          repeat: Infinity,
          ease: "linear",
          delay: Math.random() * 2
        }}
        className="absolute w-[1px] h-6 bg-blue-200/30 will-change-transform"
      />
    ))}
  </div>
);

const SnowEffect = () => (
  <div className="absolute inset-0 pointer-events-none">
    {/* Reduced to 25 flakes */}
    {[...Array(25)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ y: -20, x: Math.random() * 100 + '%', opacity: 0 }}
        animate={{ 
          y: '110vh', 
          x: (Math.random() * 100 + (Math.sin(i) * 5)) + '%',
          opacity: [0, 0.8, 0.8, 0]
        }}
        transition={{
          duration: 4 + Math.random() * 4,
          repeat: Infinity,
          ease: "linear",
          delay: Math.random() * 8
        }}
        className="absolute w-1.5 h-1.5 bg-white rounded-full blur-[1px] will-change-transform"
      />
    ))}
  </div>
);

const CloudEffect = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {/* Reduced to 3 major clouds */}
    {[...Array(3)].map((_, i) => (
      <motion.div
        key={i}
        initial={{ x: '-60%', y: (20 + (i * 20)) + '%', opacity: 0 }}
        animate={{ 
          x: '150%',
          opacity: [0, 0.15, 0.15, 0]
        }}
        transition={{
          duration: 30 + Math.random() * 30,
          repeat: Infinity,
          ease: "linear",
          delay: Math.random() * -60
        }}
        className="absolute w-[500px] h-[250px] bg-white rounded-full blur-[120px] will-change-transform"
      />
    ))}
  </div>
);

const SunEffect = () => (
  <motion.div
    animate={{ 
      opacity: [0.3, 0.5, 0.3],
    }}
    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    className="absolute -top-20 -right-20 w-96 h-96 bg-yellow-200/20 rounded-full blur-[100px] will-change-opacity pointer-events-none"
  />
);

const ThunderEffect = () => (
  <>
    <RainEffect />
    <motion.div
      animate={{ 
        opacity: [0, 0, 0.4, 0, 0.6, 0, 0],
      }}
      transition={{ 
        duration: 5, 
        repeat: Infinity, 
        times: [0, 0.8, 0.82, 0.85, 0.87, 0.9, 1],
        ease: "linear"
      }}
      className="absolute inset-0 bg-white/30 pointer-events-none will-change-opacity"
    />
  </>
);

const FogEffect = () => (
  <div className="absolute inset-0 pointer-events-none">
    {[...Array(2)].map((_, i) => (
      <motion.div
        key={i}
        animate={{ 
          x: ['-5%', '5%', '-5%'],
        }}
        transition={{
          duration: 40 + (i * 10),
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute inset-0 bg-white/5 blur-[100px]"
      />
    ))}
  </div>
);

