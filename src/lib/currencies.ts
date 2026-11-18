export interface CurrencyMeta {
  code: string
  name: string
  /** Where the currency's inflation is measured. */
  region: string
  flag: string
}

const list: CurrencyMeta[] = [
  { code: 'USD', name: 'US Dollar', region: 'United States', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', region: 'Euro area', flag: '🇪🇺' },
  { code: 'JPY', name: 'Japanese Yen', region: 'Japan', flag: '🇯🇵' },
  { code: 'GBP', name: 'British Pound', region: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CNY', name: 'Chinese Yuan', region: 'China', flag: '🇨🇳' },
  { code: 'CHF', name: 'Swiss Franc', region: 'Switzerland', flag: '🇨🇭' },
  { code: 'CAD', name: 'Canadian Dollar', region: 'Canada', flag: '🇨🇦' },
  { code: 'AUD', name: 'Australian Dollar', region: 'Australia', flag: '🇦🇺' },
  { code: 'NZD', name: 'New Zealand Dollar', region: 'New Zealand', flag: '🇳🇿' },
  { code: 'HKD', name: 'Hong Kong Dollar', region: 'Hong Kong', flag: '🇭🇰' },
  { code: 'SGD', name: 'Singapore Dollar', region: 'Singapore', flag: '🇸🇬' },
  { code: 'KRW', name: 'South Korean Won', region: 'South Korea', flag: '🇰🇷' },
  { code: 'INR', name: 'Indian Rupee', region: 'India', flag: '🇮🇳' },
  { code: 'IDR', name: 'Indonesian Rupiah', region: 'Indonesia', flag: '🇮🇩' },
  { code: 'MYR', name: 'Malaysian Ringgit', region: 'Malaysia', flag: '🇲🇾' },
  { code: 'PHP', name: 'Philippine Peso', region: 'Philippines', flag: '🇵🇭' },
  { code: 'THB', name: 'Thai Baht', region: 'Thailand', flag: '🇹🇭' },
  { code: 'MXN', name: 'Mexican Peso', region: 'Mexico', flag: '🇲🇽' },
  { code: 'BRL', name: 'Brazilian Real', region: 'Brazil', flag: '🇧🇷' },
  { code: 'ZAR', name: 'South African Rand', region: 'South Africa', flag: '🇿🇦' },
  { code: 'TRY', name: 'Turkish Lira', region: 'Türkiye', flag: '🇹🇷' },
  { code: 'ILS', name: 'Israeli Shekel', region: 'Israel', flag: '🇮🇱' },
  { code: 'SEK', name: 'Swedish Krona', region: 'Sweden', flag: '🇸🇪' },
  { code: 'NOK', name: 'Norwegian Krone', region: 'Norway', flag: '🇳🇴' },
  { code: 'DKK', name: 'Danish Krone', region: 'Denmark', flag: '🇩🇰' },
  { code: 'ISK', name: 'Icelandic Króna', region: 'Iceland', flag: '🇮🇸' },
  { code: 'PLN', name: 'Polish Złoty', region: 'Poland', flag: '🇵🇱' },
  { code: 'CZK', name: 'Czech Koruna', region: 'Czechia', flag: '🇨🇿' },
  { code: 'HUF', name: 'Hungarian Forint', region: 'Hungary', flag: '🇭🇺' },
  { code: 'RON', name: 'Romanian Leu', region: 'Romania', flag: '🇷🇴' },
]

export const CURRENCIES: readonly CurrencyMeta[] = list
export const CURRENCY: Readonly<Record<string, CurrencyMeta>> = Object.fromEntries(list.map((c) => [c.code, c]))
export const isCurrency = (code: string): boolean => code in CURRENCY
