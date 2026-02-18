import { tool } from "ai";
import { z } from "zod";
import { wrapToolExecution } from "./tool-wrapper";

async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number; name: string } | null> {
  try {
    const response = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=ru&format=json`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return null;
    }

    const result = data.results[0];
    return {
      latitude: result.latitude,
      longitude: result.longitude,
      name: result.name || city,
    };
  } catch {
    return null;
  }
}

// WMO Weather interpretation codes → Russian descriptions
const WMO_CODES: Record<number, string> = {
  0: 'Ясно',
  1: 'Преимущественно ясно',
  2: 'Переменная облачность',
  3: 'Пасмурно',
  45: 'Туман',
  48: 'Изморозь',
  51: 'Лёгкая морось',
  53: 'Морось',
  55: 'Сильная морось',
  61: 'Небольшой дождь',
  63: 'Дождь',
  65: 'Сильный дождь',
  66: 'Ледяной дождь',
  67: 'Сильный ледяной дождь',
  71: 'Небольшой снег',
  73: 'Снег',
  75: 'Сильный снег',
  77: 'Снежные зёрна',
  80: 'Небольшой ливень',
  81: 'Ливень',
  82: 'Сильный ливень',
  85: 'Небольшой снегопад',
  86: 'Сильный снегопад',
  95: 'Гроза',
  96: 'Гроза с градом',
  99: 'Сильная гроза с градом',
};

export const getWeather = tool({
  description: "Get the current weather at a location. Provide either coordinates (latitude + longitude) or a city name.",
  inputSchema: z.object({
    latitude: z.number().optional().describe("Latitude coordinate"),
    longitude: z.number().optional().describe("Longitude coordinate"),
    city: z.string().optional().describe("City name (e.g., 'Москва', 'London', 'New York')"),
  }),
  execute: wrapToolExecution(
    {
      name: "getWeather",
      timeout: 10000,
      enableLogging: true,
    },
    async (input) => {
    let latitude: number;
    let longitude: number;
    let cityName = input.city || '';

    if (input.city) {
      const coords = await geocodeCity(input.city);
      if (!coords) {
        return {
          error: `Could not find coordinates for "${input.city}". Please check the city name.`,
        };
      }
      latitude = coords.latitude;
      longitude = coords.longitude;
      cityName = coords.name;
    } else if (input.latitude !== undefined && input.longitude !== undefined) {
      latitude = input.latitude;
      longitude = input.longitude;
    } else {
      return {
        error: "Please provide either a city name or latitude/longitude coordinates.",
      };
    }

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&hourly=temperature_2m` +
      `&daily=sunrise,sunset` +
      `&timezone=auto&forecast_days=1`
    );

    const weatherData = await response.json();

    // Add cityName for UI component
    if (cityName) {
      weatherData.cityName = cityName;
    }

    // Add summary for model — clean, unambiguous data
    const current = weatherData.current;
    if (current) {
      const weatherCode = current.weather_code ?? -1;
      weatherData.summary = {
        location: cityName || `${latitude}, ${longitude}`,
        temperature: `${current.temperature_2m}°C`,
        feelsLike: `${current.apparent_temperature}°C`,
        description: WMO_CODES[weatherCode] || `Код ${weatherCode}`,
        humidity: `${current.relative_humidity_2m}%`,
        wind: `${current.wind_speed_10m} км/ч`,
        time: current.time,
      };
    }

    return weatherData;
  }),
});
