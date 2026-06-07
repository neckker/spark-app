export const WEB_URL =
    (import.meta.env.VITE_WEB_URL as string | undefined) ??
    'https://spark-bot.fun'

export const API_URL =
    (import.meta.env.VITE_API_URL as string | undefined) ??
    'https://api.spark-bot.fun'

export const SEQUOIA_WS_URL =
    (import.meta.env.VITE_SEQUOIA_URL as string | undefined) ??
    'wss://sequoia.spark-bot.fun/ws'
