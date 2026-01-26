/**
 * Comprehensive timezone utilities with search and formatting capabilities
 * Similar to Apple's Clock app timezone selector
 *
 * Uses Temporal API for accurate timezone offset calculations,
 * consistent with the rest of the codebase.
 */

import { nowInTimezone } from "~/lib/temporal";

export interface TimezoneOption {
  value: string; // IANA timezone identifier (e.g., "America/New_York")
  label: string; // Display name (e.g., "New York")
  city: string; // City name extracted from timezone
  region: string; // Region/continent (e.g., "America", "Europe")
  offset: string; // Current UTC offset (e.g., "GMT-5")
  offsetMinutes: number; // Offset in minutes for sorting
}

/**
 * Get all supported IANA timezones
 */
function getAllTimezones(): string[] {
  try {
    // Use Intl API to get all supported timezones
    if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Fallback if not supported
  }

  // Fallback comprehensive list of major timezones
  return [
    // Africa
    "Africa/Abidjan",
    "Africa/Accra",
    "Africa/Addis_Ababa",
    "Africa/Algiers",
    "Africa/Asmara",
    "Africa/Bamako",
    "Africa/Bangui",
    "Africa/Banjul",
    "Africa/Bissau",
    "Africa/Blantyre",
    "Africa/Brazzaville",
    "Africa/Bujumbura",
    "Africa/Cairo",
    "Africa/Casablanca",
    "Africa/Ceuta",
    "Africa/Conakry",
    "Africa/Dakar",
    "Africa/Dar_es_Salaam",
    "Africa/Djibouti",
    "Africa/Douala",
    "Africa/El_Aaiun",
    "Africa/Freetown",
    "Africa/Gaborone",
    "Africa/Harare",
    "Africa/Johannesburg",
    "Africa/Juba",
    "Africa/Kampala",
    "Africa/Khartoum",
    "Africa/Kigali",
    "Africa/Kinshasa",
    "Africa/Lagos",
    "Africa/Libreville",
    "Africa/Lome",
    "Africa/Luanda",
    "Africa/Lubumbashi",
    "Africa/Lusaka",
    "Africa/Malabo",
    "Africa/Maputo",
    "Africa/Maseru",
    "Africa/Mbabane",
    "Africa/Mogadishu",
    "Africa/Monrovia",
    "Africa/Nairobi",
    "Africa/Ndjamena",
    "Africa/Niamey",
    "Africa/Nouakchott",
    "Africa/Ouagadougou",
    "Africa/Porto-Novo",
    "Africa/Sao_Tome",
    "Africa/Tripoli",
    "Africa/Tunis",
    "Africa/Windhoek",
    // America
    "America/Adak",
    "America/Anchorage",
    "America/Anguilla",
    "America/Antigua",
    "America/Araguaina",
    "America/Argentina/Buenos_Aires",
    "America/Argentina/Catamarca",
    "America/Argentina/Cordoba",
    "America/Argentina/Jujuy",
    "America/Argentina/La_Rioja",
    "America/Argentina/Mendoza",
    "America/Argentina/Rio_Gallegos",
    "America/Argentina/Salta",
    "America/Argentina/San_Juan",
    "America/Argentina/San_Luis",
    "America/Argentina/Tucuman",
    "America/Argentina/Ushuaia",
    "America/Aruba",
    "America/Asuncion",
    "America/Atikokan",
    "America/Bahia",
    "America/Bahia_Banderas",
    "America/Barbados",
    "America/Belem",
    "America/Belize",
    "America/Blanc-Sablon",
    "America/Boa_Vista",
    "America/Bogota",
    "America/Boise",
    "America/Cambridge_Bay",
    "America/Campo_Grande",
    "America/Cancun",
    "America/Caracas",
    "America/Cayenne",
    "America/Cayman",
    "America/Chicago",
    "America/Chihuahua",
    "America/Costa_Rica",
    "America/Creston",
    "America/Cuiaba",
    "America/Curacao",
    "America/Danmarkshavn",
    "America/Dawson",
    "America/Dawson_Creek",
    "America/Denver",
    "America/Detroit",
    "America/Dominica",
    "America/Edmonton",
    "America/Eirunepe",
    "America/El_Salvador",
    "America/Fort_Nelson",
    "America/Fortaleza",
    "America/Glace_Bay",
    "America/Godthab",
    "America/Goose_Bay",
    "America/Grand_Turk",
    "America/Grenada",
    "America/Guadeloupe",
    "America/Guatemala",
    "America/Guayaquil",
    "America/Guyana",
    "America/Halifax",
    "America/Havana",
    "America/Hermosillo",
    "America/Indiana/Indianapolis",
    "America/Indiana/Knox",
    "America/Indiana/Marengo",
    "America/Indiana/Petersburg",
    "America/Indiana/Tell_City",
    "America/Indiana/Vevay",
    "America/Indiana/Vincennes",
    "America/Indiana/Winamac",
    "America/Inuvik",
    "America/Iqaluit",
    "America/Jamaica",
    "America/Juneau",
    "America/Kentucky/Louisville",
    "America/Kentucky/Monticello",
    "America/Kralendijk",
    "America/La_Paz",
    "America/Lima",
    "America/Los_Angeles",
    "America/Lower_Princes",
    "America/Maceio",
    "America/Managua",
    "America/Manaus",
    "America/Marigot",
    "America/Martinique",
    "America/Matamoros",
    "America/Mazatlan",
    "America/Menominee",
    "America/Merida",
    "America/Metlakatla",
    "America/Mexico_City",
    "America/Miquelon",
    "America/Moncton",
    "America/Monterrey",
    "America/Montevideo",
    "America/Montserrat",
    "America/Nassau",
    "America/New_York",
    "America/Nipigon",
    "America/Nome",
    "America/Noronha",
    "America/North_Dakota/Beulah",
    "America/North_Dakota/Center",
    "America/North_Dakota/New_Salem",
    "America/Nuuk",
    "America/Ojinaga",
    "America/Panama",
    "America/Pangnirtung",
    "America/Paramaribo",
    "America/Phoenix",
    "America/Port-au-Prince",
    "America/Port_of_Spain",
    "America/Porto_Velho",
    "America/Puerto_Rico",
    "America/Punta_Arenas",
    "America/Rainy_River",
    "America/Rankin_Inlet",
    "America/Recife",
    "America/Regina",
    "America/Resolute",
    "America/Rio_Branco",
    "America/Santarem",
    "America/Santiago",
    "America/Santo_Domingo",
    "America/Sao_Paulo",
    "America/Scoresbysund",
    "America/Sitka",
    "America/St_Barthelemy",
    "America/St_Johns",
    "America/St_Kitts",
    "America/St_Lucia",
    "America/St_Thomas",
    "America/St_Vincent",
    "America/Swift_Current",
    "America/Tegucigalpa",
    "America/Thule",
    "America/Thunder_Bay",
    "America/Tijuana",
    "America/Toronto",
    "America/Tortola",
    "America/Vancouver",
    "America/Whitehorse",
    "America/Winnipeg",
    "America/Yakutat",
    "America/Yellowknife",
    // Antarctica
    "Antarctica/Casey",
    "Antarctica/Davis",
    "Antarctica/DumontDUrville",
    "Antarctica/Macquarie",
    "Antarctica/Mawson",
    "Antarctica/McMurdo",
    "Antarctica/Palmer",
    "Antarctica/Rothera",
    "Antarctica/Syowa",
    "Antarctica/Troll",
    "Antarctica/Vostok",
    // Asia
    "Asia/Aden",
    "Asia/Almaty",
    "Asia/Amman",
    "Asia/Anadyr",
    "Asia/Aqtau",
    "Asia/Aqtobe",
    "Asia/Ashgabat",
    "Asia/Atyrau",
    "Asia/Baghdad",
    "Asia/Bahrain",
    "Asia/Baku",
    "Asia/Bangkok",
    "Asia/Barnaul",
    "Asia/Beirut",
    "Asia/Bishkek",
    "Asia/Brunei",
    "Asia/Chita",
    "Asia/Choibalsan",
    "Asia/Colombo",
    "Asia/Damascus",
    "Asia/Dhaka",
    "Asia/Dili",
    "Asia/Dubai",
    "Asia/Dushanbe",
    "Asia/Famagusta",
    "Asia/Gaza",
    "Asia/Hebron",
    "Asia/Ho_Chi_Minh",
    "Asia/Hong_Kong",
    "Asia/Hovd",
    "Asia/Irkutsk",
    "Asia/Jakarta",
    "Asia/Jayapura",
    "Asia/Jerusalem",
    "Asia/Kabul",
    "Asia/Kamchatka",
    "Asia/Karachi",
    "Asia/Kathmandu",
    "Asia/Khandyga",
    "Asia/Kolkata",
    "Asia/Krasnoyarsk",
    "Asia/Kuala_Lumpur",
    "Asia/Kuching",
    "Asia/Kuwait",
    "Asia/Macau",
    "Asia/Magadan",
    "Asia/Makassar",
    "Asia/Manila",
    "Asia/Muscat",
    "Asia/Nicosia",
    "Asia/Novokuznetsk",
    "Asia/Novosibirsk",
    "Asia/Omsk",
    "Asia/Oral",
    "Asia/Phnom_Penh",
    "Asia/Pontianak",
    "Asia/Pyongyang",
    "Asia/Qatar",
    "Asia/Qostanay",
    "Asia/Qyzylorda",
    "Asia/Riyadh",
    "Asia/Sakhalin",
    "Asia/Samarkand",
    "Asia/Seoul",
    "Asia/Shanghai",
    "Asia/Singapore",
    "Asia/Srednekolymsk",
    "Asia/Taipei",
    "Asia/Tashkent",
    "Asia/Tbilisi",
    "Asia/Tehran",
    "Asia/Thimphu",
    "Asia/Tokyo",
    "Asia/Tomsk",
    "Asia/Ulaanbaatar",
    "Asia/Urumqi",
    "Asia/Ust-Nera",
    "Asia/Vientiane",
    "Asia/Vladivostok",
    "Asia/Yakutsk",
    "Asia/Yangon",
    "Asia/Yekaterinburg",
    "Asia/Yerevan",
    // Atlantic
    "Atlantic/Azores",
    "Atlantic/Bermuda",
    "Atlantic/Canary",
    "Atlantic/Cape_Verde",
    "Atlantic/Faroe",
    "Atlantic/Madeira",
    "Atlantic/Reykjavik",
    "Atlantic/South_Georgia",
    "Atlantic/St_Helena",
    "Atlantic/Stanley",
    // Australia
    "Australia/Adelaide",
    "Australia/Brisbane",
    "Australia/Broken_Hill",
    "Australia/Currie",
    "Australia/Darwin",
    "Australia/Eucla",
    "Australia/Hobart",
    "Australia/Lindeman",
    "Australia/Lord_Howe",
    "Australia/Melbourne",
    "Australia/Perth",
    "Australia/Sydney",
    // Europe
    "Europe/Amsterdam",
    "Europe/Andorra",
    "Europe/Astrakhan",
    "Europe/Athens",
    "Europe/Belgrade",
    "Europe/Berlin",
    "Europe/Bratislava",
    "Europe/Brussels",
    "Europe/Bucharest",
    "Europe/Budapest",
    "Europe/Busingen",
    "Europe/Chisinau",
    "Europe/Copenhagen",
    "Europe/Dublin",
    "Europe/Gibraltar",
    "Europe/Guernsey",
    "Europe/Helsinki",
    "Europe/Isle_of_Man",
    "Europe/Istanbul",
    "Europe/Jersey",
    "Europe/Kaliningrad",
    "Europe/Kiev",
    "Europe/Kirov",
    "Europe/Lisbon",
    "Europe/Ljubljana",
    "Europe/London",
    "Europe/Luxembourg",
    "Europe/Madrid",
    "Europe/Malta",
    "Europe/Mariehamn",
    "Europe/Minsk",
    "Europe/Monaco",
    "Europe/Moscow",
    "Europe/Oslo",
    "Europe/Paris",
    "Europe/Podgorica",
    "Europe/Prague",
    "Europe/Riga",
    "Europe/Rome",
    "Europe/Samara",
    "Europe/San_Marino",
    "Europe/Sarajevo",
    "Europe/Saratov",
    "Europe/Simferopol",
    "Europe/Skopje",
    "Europe/Sofia",
    "Europe/Stockholm",
    "Europe/Tallinn",
    "Europe/Tirane",
    "Europe/Ulyanovsk",
    "Europe/Uzhgorod",
    "Europe/Vaduz",
    "Europe/Vatican",
    "Europe/Vienna",
    "Europe/Vilnius",
    "Europe/Volgograd",
    "Europe/Warsaw",
    "Europe/Zagreb",
    "Europe/Zaporozhye",
    "Europe/Zurich",
    // Indian
    "Indian/Antananarivo",
    "Indian/Chagos",
    "Indian/Christmas",
    "Indian/Cocos",
    "Indian/Comoro",
    "Indian/Kerguelen",
    "Indian/Mahe",
    "Indian/Maldives",
    "Indian/Mauritius",
    "Indian/Mayotte",
    "Indian/Reunion",
    // Pacific
    "Pacific/Apia",
    "Pacific/Auckland",
    "Pacific/Bougainville",
    "Pacific/Chatham",
    "Pacific/Chuuk",
    "Pacific/Easter",
    "Pacific/Efate",
    "Pacific/Fakaofo",
    "Pacific/Fiji",
    "Pacific/Funafuti",
    "Pacific/Galapagos",
    "Pacific/Gambier",
    "Pacific/Guadalcanal",
    "Pacific/Guam",
    "Pacific/Honolulu",
    "Pacific/Kanton",
    "Pacific/Kiritimati",
    "Pacific/Kosrae",
    "Pacific/Kwajalein",
    "Pacific/Majuro",
    "Pacific/Marquesas",
    "Pacific/Midway",
    "Pacific/Nauru",
    "Pacific/Niue",
    "Pacific/Norfolk",
    "Pacific/Noumea",
    "Pacific/Pago_Pago",
    "Pacific/Palau",
    "Pacific/Pitcairn",
    "Pacific/Pohnpei",
    "Pacific/Port_Moresby",
    "Pacific/Rarotonga",
    "Pacific/Saipan",
    "Pacific/Tahiti",
    "Pacific/Tarawa",
    "Pacific/Tongatapu",
    "Pacific/Wake",
    "Pacific/Wallis",
    // UTC
    "Etc/GMT",
    "Etc/GMT+1",
    "Etc/GMT+10",
    "Etc/GMT+11",
    "Etc/GMT+12",
    "Etc/GMT+2",
    "Etc/GMT+3",
    "Etc/GMT+4",
    "Etc/GMT+5",
    "Etc/GMT+6",
    "Etc/GMT+7",
    "Etc/GMT+8",
    "Etc/GMT+9",
    "Etc/GMT-1",
    "Etc/GMT-10",
    "Etc/GMT-11",
    "Etc/GMT-12",
    "Etc/GMT-13",
    "Etc/GMT-14",
    "Etc/GMT-2",
    "Etc/GMT-3",
    "Etc/GMT-4",
    "Etc/GMT-5",
    "Etc/GMT-6",
    "Etc/GMT-7",
    "Etc/GMT-8",
    "Etc/GMT-9",
    "Etc/UTC",
  ];
}

/**
 * Extract city name from timezone identifier
 * e.g., "America/New_York" -> "New York"
 */
function extractCityName(timezone: string): string {
  const parts = timezone.split("/");
  if (parts.length > 1) {
    // Handle cases like "America/Argentina/Buenos_Aires"
    const cityPart = parts[parts.length - 1];
    if (cityPart) {
      return cityPart.replace(/_/g, " ");
    }
  }
  return timezone;
}

/**
 * Get current UTC offset for a timezone using Temporal API
 * This is more accurate than Date/Intl APIs and handles DST correctly
 */
function getTimezoneOffset(timezone: string): {
  offset: string;
  offsetMinutes: number;
} {
  try {
    // Special handling for Etc/GMT timezones (they use inverted sign convention)
    if (timezone.startsWith("Etc/GMT")) {
      const match = timezone.match(/Etc\/GMT([+-]?)(\d+)/);
      if (match?.[2]) {
        const signChar = match[1] ?? "+";
        const hours = parseInt(match[2], 10);
        // Etc/GMT uses inverted sign: GMT+5 means 5 hours behind UTC
        const offsetMinutes = signChar === "+" ? -hours * 60 : hours * 60;
        const displaySign = signChar === "+" ? "-" : "+";
        const offset = `GMT${displaySign}${hours}`;
        return { offset, offsetMinutes };
      }
    }
    if (timezone === "Etc/UTC") {
      return { offset: "GMT+0", offsetMinutes: 0 };
    }

    // Use Temporal for accurate offset calculation
    // Get current time in UTC and in the target timezone
    const nowUtc = nowInTimezone("UTC");
    const nowTz = nowInTimezone(timezone);

    // Calculate the offset by comparing the same instant in both timezones
    // The offset is the difference between the local times
    const utcHour = nowUtc.hour;
    const utcMinute = nowUtc.minute;
    const tzHour = nowTz.hour;
    const tzMinute = nowTz.minute;

    // Calculate difference in minutes
    let offsetMinutes = tzHour * 60 + tzMinute - (utcHour * 60 + utcMinute);

    // Handle day boundaries (if difference is > 12 hours, we probably crossed midnight)
    if (offsetMinutes > 12 * 60) {
      offsetMinutes -= 24 * 60;
    } else if (offsetMinutes < -12 * 60) {
      offsetMinutes += 24 * 60;
    }

    // Format as GMT±X or GMT±X:XX
    const hours = Math.floor(Math.abs(offsetMinutes) / 60);
    const minutes = Math.abs(offsetMinutes) % 60;
    const sign = offsetMinutes >= 0 ? "+" : "-";

    let offset: string;
    if (minutes === 0) {
      offset = `GMT${sign}${hours}`;
    } else {
      // Handle half-hour and quarter-hour offsets (e.g., GMT+5:30, GMT+9:30)
      offset = `GMT${sign}${hours}:${minutes.toString().padStart(2, "0")}`;
    }

    return { offset, offsetMinutes };
  } catch (error) {
    // Fallback - log error in development but don't break the UI
    if (process.env.NODE_ENV === "development") {
      console.warn(`Failed to calculate offset for ${timezone}:`, error);
    }
    return { offset: "GMT+0", offsetMinutes: 0 };
  }
}

/**
 * Get all timezone options with formatting
 * Results are memoized for performance - timezone list doesn't change at runtime
 */
let cachedTimezoneOptions: TimezoneOption[] | null = null;

export function getAllTimezoneOptions(): TimezoneOption[] {
  // Return cached result if available (timezone list is static)
  if (cachedTimezoneOptions !== null) {
    return cachedTimezoneOptions;
  }

  const timezones = getAllTimezones();

  const options = timezones
    .map((tz) => {
      try {
        const parts = tz.split("/");
        const region = parts[0] ?? "";
        const city = extractCityName(tz);
        const { offset, offsetMinutes } = getTimezoneOffset(tz);

        // Create a friendly label
        let label = city;
        if (region && region !== "Etc") {
          // For better UX, show "City, Region" format for some cases
          if (region === "America" && city.includes(" ")) {
            // Already has space, keep as is
          } else if (city !== region) {
            label = `${city}`;
          }
        }

        return {
          value: tz,
          label,
          city,
          region,
          offset,
          offsetMinutes,
        };
      } catch (error) {
        // Skip invalid timezones gracefully
        if (process.env.NODE_ENV === "development") {
          console.warn(`Skipping invalid timezone ${tz}:`, error);
        }
        return null;
      }
    })
    .filter((opt): opt is TimezoneOption => opt !== null)
    .sort((a, b) => {
      // Sort by offset first, then by city name
      if (a.offsetMinutes !== b.offsetMinutes) {
        return a.offsetMinutes - b.offsetMinutes;
      }
      return a.city.localeCompare(b.city);
    });

  // Cache the result
  cachedTimezoneOptions = options;
  return options;
}

/**
 * Search timezones by query
 */
export function searchTimezones(
  query: string,
  options: TimezoneOption[] = getAllTimezoneOptions()
): TimezoneOption[] {
  if (!query.trim()) {
    return options;
  }

  const lowerQuery = query.toLowerCase().trim();

  return options.filter((option) => {
    const searchableText =
      `${option.city} ${option.region} ${option.label} ${option.value} ${option.offset}`.toLowerCase();
    return searchableText.includes(lowerQuery);
  });
}

/**
 * Get timezone option by value
 */
export function getTimezoneOption(
  value: string,
  options: TimezoneOption[] = getAllTimezoneOptions()
): TimezoneOption | undefined {
  return options.find((opt) => opt.value === value);
}

/**
 * Format timezone for display
 */
export function formatTimezoneDisplay(option: TimezoneOption): string {
  return `${option.label} (${option.offset})`;
}
