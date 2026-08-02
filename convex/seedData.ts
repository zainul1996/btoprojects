/**
 * GENERATED from docs/seed/*.json (researched, cross-checked seed data).
 * Convex cannot read files at runtime, so the seed JSONs are materialised
 * here as typed consts. Regenerate by re-running the transform on the JSONs;
 * do not hand-edit values here — edit docs/seed/*.json instead.
 */

export interface SeedTown {
  name: string;
  region: string;
  lat: number;
  lng: number;
}

export interface SeedMrtStation {
  name: string;
  code: string;
  line: string;
  lat: number;
  lng: number;
}

export interface SeedFlatType {
  type: "2-room Flexi" | "3-room" | "4-room" | "5-room" | "3Gen";
  units: number;
  minPrice: number;
  maxPrice: number;
}

export interface SeedProject {
  slug: string;
  name: string;
  exercise: string;
  exerciseLabel: string;
  town: string;
  region: string;
  classification: "Standard" | "Plus" | "Prime";
  lifecycleStatus: "announced" | "launched" | "construction" | "sbf" | "mop";
  applicationDeadline?: string;
  flatTypes: SeedFlatType[];
  totalUnits: number;
  estimatedWaitMonths: number;
  estimatedCompletion: string;
  nearestMrt: string[];
  mrtWalkingMinutes: number;
  lat: number;
  lng: number;
  description: string;
  notes?: string;
  sourceUrls: string[];
}

export const seedTowns: SeedTown[] = [
  {
    "name": "Ang Mo Kio",
    "region": "North-East",
    "lat": 1.3691,
    "lng": 103.8454
  },
  {
    "name": "Bedok",
    "region": "East",
    "lat": 1.3236,
    "lng": 103.9273
  },
  {
    "name": "Bishan",
    "region": "Central",
    "lat": 1.3508,
    "lng": 103.848
  },
  {
    "name": "Bukit Batok",
    "region": "West",
    "lat": 1.349,
    "lng": 103.7496
  },
  {
    "name": "Bukit Merah",
    "region": "Central",
    "lat": 1.2819,
    "lng": 103.8239
  },
  {
    "name": "Bukit Panjang",
    "region": "West",
    "lat": 1.3774,
    "lng": 103.7719
  },
  {
    "name": "Bukit Timah",
    "region": "Central",
    "lat": 1.3294,
    "lng": 103.8021
  },
  {
    "name": "Central Area",
    "region": "Central",
    "lat": 1.2903,
    "lng": 103.852
  },
  {
    "name": "Choa Chu Kang",
    "region": "West",
    "lat": 1.384,
    "lng": 103.7446
  },
  {
    "name": "Clementi",
    "region": "West",
    "lat": 1.3162,
    "lng": 103.7649
  },
  {
    "name": "Geylang",
    "region": "Central",
    "lat": 1.3205,
    "lng": 103.8918
  },
  {
    "name": "Hougang",
    "region": "North-East",
    "lat": 1.3612,
    "lng": 103.8863
  },
  {
    "name": "Jurong East",
    "region": "West",
    "lat": 1.3331,
    "lng": 103.742
  },
  {
    "name": "Jurong West",
    "region": "West",
    "lat": 1.3404,
    "lng": 103.709
  },
  {
    "name": "Kallang/Whampoa",
    "region": "Central",
    "lat": 1.3107,
    "lng": 103.866
  },
  {
    "name": "Marine Parade",
    "region": "Central",
    "lat": 1.302,
    "lng": 103.9071
  },
  {
    "name": "Pasir Ris",
    "region": "East",
    "lat": 1.3721,
    "lng": 103.9474
  },
  {
    "name": "Punggol",
    "region": "North-East",
    "lat": 1.4052,
    "lng": 103.9023
  },
  {
    "name": "Queenstown",
    "region": "Central",
    "lat": 1.2942,
    "lng": 103.8061
  },
  {
    "name": "Sembawang",
    "region": "North",
    "lat": 1.4491,
    "lng": 103.8185
  },
  {
    "name": "Sengkang",
    "region": "North-East",
    "lat": 1.3868,
    "lng": 103.8914
  },
  {
    "name": "Serangoon",
    "region": "North-East",
    "lat": 1.3496,
    "lng": 103.873
  },
  {
    "name": "Tampines",
    "region": "East",
    "lat": 1.3496,
    "lng": 103.9568
  },
  {
    "name": "Tengah",
    "region": "West",
    "lat": 1.3583,
    "lng": 103.7327
  },
  {
    "name": "Toa Payoh",
    "region": "Central",
    "lat": 1.3328,
    "lng": 103.8474
  },
  {
    "name": "Woodlands",
    "region": "North",
    "lat": 1.4362,
    "lng": 103.786
  },
  {
    "name": "Yishun",
    "region": "North",
    "lat": 1.4294,
    "lng": 103.835
  }
];

export const seedMrtStations: SeedMrtStation[] = [
  {
    "name": "Pasir Ris",
    "code": "EW1",
    "line": "East-West",
    "lat": 1.3731,
    "lng": 103.9493
  },
  {
    "name": "Tampines",
    "code": "EW2/DT32",
    "line": "East-West / Downtown",
    "lat": 1.3533,
    "lng": 103.9452
  },
  {
    "name": "Tanah Merah",
    "code": "EW4",
    "line": "East-West",
    "lat": 1.3272,
    "lng": 103.9465
  },
  {
    "name": "Bedok",
    "code": "EW5",
    "line": "East-West",
    "lat": 1.324,
    "lng": 103.9301
  },
  {
    "name": "Paya Lebar",
    "code": "EW8/CC9",
    "line": "East-West / Circle",
    "lat": 1.3177,
    "lng": 103.8926
  },
  {
    "name": "Bugis",
    "code": "EW12/DT14",
    "line": "East-West / Downtown",
    "lat": 1.3008,
    "lng": 103.8561
  },
  {
    "name": "City Hall",
    "code": "EW13/NS25",
    "line": "East-West / North-South",
    "lat": 1.2931,
    "lng": 103.852
  },
  {
    "name": "Raffles Place",
    "code": "EW14/NS26",
    "line": "East-West / North-South",
    "lat": 1.284,
    "lng": 103.851
  },
  {
    "name": "Outram Park",
    "code": "EW16/NE3/TE17",
    "line": "East-West / North East / Thomson-East Coast",
    "lat": 1.2805,
    "lng": 103.8395
  },
  {
    "name": "Tiong Bahru",
    "code": "EW17",
    "line": "East-West",
    "lat": 1.2861,
    "lng": 103.827
  },
  {
    "name": "Redhill",
    "code": "EW18",
    "line": "East-West",
    "lat": 1.2896,
    "lng": 103.8168
  },
  {
    "name": "Buona Vista",
    "code": "EW21/CC22",
    "line": "East-West / Circle",
    "lat": 1.3069,
    "lng": 103.7906
  },
  {
    "name": "Clementi",
    "code": "EW23",
    "line": "East-West",
    "lat": 1.3151,
    "lng": 103.7652
  },
  {
    "name": "Jurong East",
    "code": "EW24/NS1",
    "line": "East-West / North-South",
    "lat": 1.3332,
    "lng": 103.7422
  },
  {
    "name": "Expo",
    "code": "DT35/CG1",
    "line": "Downtown / Changi Airport Branch",
    "lat": 1.3356,
    "lng": 103.9617
  },
  {
    "name": "Choa Chu Kang",
    "code": "NS4",
    "line": "North-South",
    "lat": 1.3853,
    "lng": 103.7443
  },
  {
    "name": "Marsiling",
    "code": "NS8",
    "line": "North-South",
    "lat": 1.4325,
    "lng": 103.7741
  },
  {
    "name": "Woodlands",
    "code": "NS9/TE2",
    "line": "North-South / Thomson-East Coast",
    "lat": 1.437,
    "lng": 103.7865
  },
  {
    "name": "Admiralty",
    "code": "NS10",
    "line": "North-South",
    "lat": 1.4407,
    "lng": 103.801
  },
  {
    "name": "Sembawang",
    "code": "NS11",
    "line": "North-South",
    "lat": 1.4491,
    "lng": 103.8201
  },
  {
    "name": "Canberra",
    "code": "NS12",
    "line": "North-South",
    "lat": 1.4431,
    "lng": 103.8297
  },
  {
    "name": "Yishun",
    "code": "NS13",
    "line": "North-South",
    "lat": 1.4294,
    "lng": 103.835
  },
  {
    "name": "Ang Mo Kio",
    "code": "NS16",
    "line": "North-South",
    "lat": 1.37,
    "lng": 103.8495
  },
  {
    "name": "Bishan",
    "code": "NS17/CC15",
    "line": "North-South / Circle",
    "lat": 1.3508,
    "lng": 103.8482
  },
  {
    "name": "Braddell",
    "code": "NS18",
    "line": "North-South",
    "lat": 1.3404,
    "lng": 103.8468
  },
  {
    "name": "Toa Payoh",
    "code": "NS19",
    "line": "North-South",
    "lat": 1.3328,
    "lng": 103.8474
  },
  {
    "name": "Novena",
    "code": "NS20",
    "line": "North-South",
    "lat": 1.3204,
    "lng": 103.8438
  },
  {
    "name": "Newton",
    "code": "NS21/DT11",
    "line": "North-South / Downtown",
    "lat": 1.3136,
    "lng": 103.838
  },
  {
    "name": "Orchard",
    "code": "NS22/TE14",
    "line": "North-South / Thomson-East Coast",
    "lat": 1.304,
    "lng": 103.8318
  },
  {
    "name": "Dhoby Ghaut",
    "code": "NS24/NE6/CC1",
    "line": "North-South / North East / Circle",
    "lat": 1.2987,
    "lng": 103.8457
  },
  {
    "name": "Marina Bay",
    "code": "NS27/TE20",
    "line": "North-South / Thomson-East Coast",
    "lat": 1.2761,
    "lng": 103.8545
  },
  {
    "name": "HarbourFront",
    "code": "NE1/CC29",
    "line": "North East / Circle",
    "lat": 1.2653,
    "lng": 103.8223
  },
  {
    "name": "Chinatown",
    "code": "NE4/DT19",
    "line": "North East / Downtown",
    "lat": 1.2844,
    "lng": 103.8444
  },
  {
    "name": "Little India",
    "code": "NE7/DT12",
    "line": "North East / Downtown",
    "lat": 1.3067,
    "lng": 103.8492
  },
  {
    "name": "Potong Pasir",
    "code": "NE10",
    "line": "North East",
    "lat": 1.3313,
    "lng": 103.8691
  },
  {
    "name": "Serangoon",
    "code": "NE12/CC13",
    "line": "North East / Circle",
    "lat": 1.3496,
    "lng": 103.873
  },
  {
    "name": "Sengkang",
    "code": "NE16/STC",
    "line": "North East / Sengkang LRT",
    "lat": 1.3916,
    "lng": 103.8954
  },
  {
    "name": "Punggol",
    "code": "NE17/PTC",
    "line": "North East / Punggol LRT",
    "lat": 1.4052,
    "lng": 103.9023
  },
  {
    "name": "MacPherson",
    "code": "CC10/DT26",
    "line": "Circle / Downtown",
    "lat": 1.3266,
    "lng": 103.8901
  },
  {
    "name": "Marymount",
    "code": "CC16",
    "line": "Circle",
    "lat": 1.3415,
    "lng": 103.8394
  },
  {
    "name": "Caldecott",
    "code": "CC17/TE9",
    "line": "Circle / Thomson-East Coast",
    "lat": 1.3378,
    "lng": 103.8395
  },
  {
    "name": "Botanic Gardens",
    "code": "CC19/DT9",
    "line": "Circle / Downtown",
    "lat": 1.3225,
    "lng": 103.8154
  },
  {
    "name": "Labrador Park",
    "code": "CC27",
    "line": "Circle",
    "lat": 1.2723,
    "lng": 103.8028
  },
  {
    "name": "Telok Blangah",
    "code": "CC28",
    "line": "Circle",
    "lat": 1.2707,
    "lng": 103.8097
  },
  {
    "name": "Promenade",
    "code": "CC4/DT15",
    "line": "Circle / Downtown",
    "lat": 1.2932,
    "lng": 103.8611
  },
  {
    "name": "Tampines West",
    "code": "DT31",
    "line": "Downtown",
    "lat": 1.3456,
    "lng": 103.9382
  },
  {
    "name": "Tampines East",
    "code": "DT33",
    "line": "Downtown",
    "lat": 1.3562,
    "lng": 103.9546
  },
  {
    "name": "Stevens",
    "code": "DT10/TE11",
    "line": "Downtown / Thomson-East Coast",
    "lat": 1.3201,
    "lng": 103.8259
  },
  {
    "name": "Mayflower",
    "code": "TE6",
    "line": "Thomson-East Coast",
    "lat": 1.3709,
    "lng": 103.8374
  },
  {
    "name": "Upper Thomson",
    "code": "TE8",
    "line": "Thomson-East Coast",
    "lat": 1.3412,
    "lng": 103.8357
  }
];

export const seedProjects: SeedProject[] = [
  {
    "slug": "redhill-peaks",
    "name": "Redhill Peaks",
    "exercise": "2026-02",
    "exerciseLabel": "February 2026 BTO",
    "town": "Bukit Merah",
    "region": "Central",
    "classification": "Prime",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-02-11",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 368,
        "minPrice": 215000,
        "maxPrice": 373000
      },
      {
        "type": "3-room",
        "units": 91,
        "minPrice": 385000,
        "maxPrice": 537000
      },
      {
        "type": "4-room",
        "units": 593,
        "minPrice": 563000,
        "maxPrice": 783000
      }
    ],
    "totalUnits": 1052,
    "estimatedWaitMonths": 55,
    "estimatedCompletion": "2030-09",
    "nearestMrt": [
      "Redhill (EW18)"
    ],
    "mrtWalkingMinutes": 5,
    "lat": 1.2893,
    "lng": 103.8175,
    "description": "Prime project on the former Redhill Close SIT estate in Bukit Merah, about a five-minute walk from Redhill MRT station. Its 1,052 units across three 49-storey blocks form the second batch of Redhill Peaks flats, after 1,021 units launched in October 2025; it carries a 12% subsidy clawback.",
    "notes": "Unit counts and 99-year-lease price ranges from Stacked Homes/DollarsAndSense project tables (2-room Flexi combines Type 1: 92 units and Type 2: 276 units); lat/lng is an approximate site centroid near Redhill Close; estimatedCompletion computed as launch month + 55-month wait.",
    "sourceUrls": [
      "https://www.hdb.gov.sg/about-us/news-and-publications/press-releases/hdb-launches-9012-flats-in-february-2026-bto-and-sbf-exercises",
      "https://www.straitstimes.com/singapore/housing/hdb-launches-9012-bto-and-balance-flats-including-prime-project-in-redhill",
      "https://stackedhomes.com/february-2026-bto-launch-review/",
      "https://dollarsandsense.sg/february-2026-bto-sales-launch-guide-bukit-merah-sembawang-north-tampines-toa-payoh/"
    ]
  },
  {
    "slug": "kim-keat-crest",
    "name": "Kim Keat Crest",
    "exercise": "2026-02",
    "exerciseLabel": "February 2026 BTO",
    "town": "Toa Payoh",
    "region": "Central",
    "classification": "Plus",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-02-11",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 277,
        "minPrice": 203000,
        "maxPrice": 304000
      },
      {
        "type": "3-room",
        "units": 87,
        "minPrice": 356000,
        "maxPrice": 450000
      },
      {
        "type": "4-room",
        "units": 787,
        "minPrice": 455000,
        "maxPrice": 624000
      }
    ],
    "totalUnits": 1151,
    "estimatedWaitMonths": 37,
    "estimatedCompletion": "2029-03",
    "nearestMrt": [
      "Toa Payoh (NS19)",
      "Potong Pasir (NE10)"
    ],
    "mrtWalkingMinutes": 18,
    "lat": 1.3325,
    "lng": 103.858,
    "description": "Plus project bounded by Kim Keat Avenue and Toa Payoh East, beside the CTE and Kallang River, with riverine-themed landscaping. Its 1,151 units are not within walking distance of an MRT station, which HDB reflected in a lower 6% subsidy clawback for a Plus project.",
    "notes": "Unit counts from DollarsAndSense/Stacked Homes tables (2-room Flexi combines Type 1: 58 and Type 2: 219). Headline sources quote 2-room Flexi 'from $203,000' while Stacked's detailed 99-year-lease table shows $214,000-$304,000 - both captured in the range. mrtWalkingMinutes estimated (project is not near an MRT); lat/lng approximate; estimatedCompletion = launch + 37 months.",
    "sourceUrls": [
      "https://www.hdb.gov.sg/about-us/news-and-publications/press-releases/hdb-launches-9012-flats-in-february-2026-bto-and-sbf-exercises",
      "https://www.straitstimes.com/singapore/housing/hdb-launches-9012-bto-and-balance-flats-including-prime-project-in-redhill",
      "https://stackedhomes.com/february-2026-bto-launch-review/",
      "https://dollarsandsense.sg/february-2026-bto-sales-launch-guide-bukit-merah-sembawang-north-tampines-toa-payoh/"
    ]
  },
  {
    "slug": "tampines-nova",
    "name": "Tampines Nova",
    "exercise": "2026-02",
    "exerciseLabel": "February 2026 BTO",
    "town": "Tampines",
    "region": "East",
    "classification": "Plus",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-02-11",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 122,
        "minPrice": 197000,
        "maxPrice": 292000
      },
      {
        "type": "4-room",
        "units": 133,
        "minPrice": 459000,
        "maxPrice": 602000
      }
    ],
    "totalUnits": 255,
    "estimatedWaitMonths": 32,
    "estimatedCompletion": "2028-10",
    "nearestMrt": [
      "Tampines (EW2/DT32)"
    ],
    "mrtWalkingMinutes": 4,
    "lat": 1.3538,
    "lng": 103.9438,
    "description": "Plus project in the heart of Tampines Regional Centre, bounded by Tampines Avenue 5, Tampines Central 8 and Tampines Concourse, next to Tampines MRT station and Our Tampines Hub. Its 255 units are Shorter Waiting Time flats completing in about 2 years 8 months, with a 6% subsidy clawback.",
    "notes": "Unit counts and 99-year-lease prices from Stacked Homes project table (2-room Flexi combines Type 1: 24 and Type 2: 98); mrtWalkingMinutes estimated from 'situated next to Tampines MRT station'; lat/lng approximate; estimatedCompletion = launch + 32 months.",
    "sourceUrls": [
      "https://www.hdb.gov.sg/about-us/news-and-publications/press-releases/hdb-launches-9012-flats-in-february-2026-bto-and-sbf-exercises",
      "https://stackedhomes.com/february-2026-bto-launch-review/",
      "https://stackedhomes.com/shorter-waiting-time-bto-flats/",
      "https://www.homeanddecor.com.sg/property/hdb/bto-february-2026"
    ]
  },
  {
    "slug": "tampines-bliss",
    "name": "Tampines Bliss",
    "exercise": "2026-02",
    "exerciseLabel": "February 2026 BTO",
    "town": "Tampines",
    "region": "East",
    "classification": "Standard",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-02-11",
    "flatTypes": [
      {
        "type": "3-room",
        "units": 80,
        "minPrice": 363000,
        "maxPrice": 444000
      },
      {
        "type": "4-room",
        "units": 204,
        "minPrice": 481000,
        "maxPrice": 600000
      }
    ],
    "totalUnits": 284,
    "estimatedWaitMonths": 23,
    "estimatedCompletion": "2028-01",
    "nearestMrt": [
      "Tampines East (DT33)",
      "Tampines (EW2/DT32)"
    ],
    "mrtWalkingMinutes": 12,
    "lat": 1.346,
    "lng": 103.9368,
    "description": "Standard project bordered by Tampines Avenue 2 and Tampines Street 22, with kampung-inspired landscaping and a nursing home on site. Its 284 units are the fastest-completing flats of the February 2026 exercise, with a wait of about 1 year 11 months.",
    "notes": "Unit counts and prices from Stacked Homes project table; mrtWalkingMinutes estimated (Stacked: under 15-minute walk to both Tampines and Tampines East MRT); lat/lng approximate; estimatedCompletion = launch + 23 months.",
    "sourceUrls": [
      "https://www.hdb.gov.sg/about-us/news-and-publications/press-releases/hdb-launches-9012-flats-in-february-2026-bto-and-sbf-exercises",
      "https://stackedhomes.com/february-2026-bto-launch-review/",
      "https://stackedhomes.com/shorter-waiting-time-bto-flats/",
      "https://www.homeanddecor.com.sg/property/hdb/bto-february-2026"
    ]
  },
  {
    "slug": "sembawang-deck",
    "name": "Sembawang Deck",
    "exercise": "2026-02",
    "exerciseLabel": "February 2026 BTO",
    "town": "Sembawang",
    "region": "North",
    "classification": "Standard",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-02-11",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 188,
        "minPrice": 158000,
        "maxPrice": 237000
      },
      {
        "type": "3-room",
        "units": 84,
        "minPrice": 261000,
        "maxPrice": 343000
      },
      {
        "type": "4-room",
        "units": 271,
        "minPrice": 338000,
        "maxPrice": 426000
      },
      {
        "type": "5-room",
        "units": 234,
        "minPrice": 479000,
        "maxPrice": 585000
      }
    ],
    "totalUnits": 777,
    "estimatedWaitMonths": 33,
    "estimatedCompletion": "2028-11",
    "nearestMrt": [
      "Sembawang (NS11)"
    ],
    "mrtWalkingMinutes": 15,
    "lat": 1.448,
    "lng": 103.823,
    "description": "Standard project in the emerging Sembawang North precinct, about a 15-minute walk from Sembawang MRT station and Sun Plaza. Its 777 units across four flat types are Shorter Waiting Time flats completing in about 2 years 9 months.",
    "notes": "Unit counts and 99-year-lease prices from Stacked Homes project table (2-room Flexi combines Type 1: 42 and Type 2: 146); lat/lng approximate for the Sembawang North site (blocks 446A/446B); estimatedCompletion = launch + 33 months.",
    "sourceUrls": [
      "https://www.hdb.gov.sg/about-us/news-and-publications/press-releases/hdb-launches-9012-flats-in-february-2026-bto-and-sbf-exercises",
      "https://www.mynicehome.gov.sg/get-started/hdb-bto-sales-launch/",
      "https://stackedhomes.com/february-2026-bto-launch-review/",
      "https://stackedhomes.com/shorter-waiting-time-bto-flats/"
    ]
  },
  {
    "slug": "berlayar-rise",
    "name": "Berlayar Rise",
    "exercise": "2026-06",
    "exerciseLabel": "June 2026 BTO",
    "town": "Bukit Merah",
    "region": "Central",
    "classification": "Prime",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-06-24",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 816,
        "minPrice": 247000,
        "maxPrice": 406000
      },
      {
        "type": "3-room",
        "units": 172,
        "minPrice": 435000,
        "maxPrice": 591000
      },
      {
        "type": "4-room",
        "units": 988,
        "minPrice": 592000,
        "maxPrice": 810000
      }
    ],
    "totalUnits": 1976,
    "estimatedWaitMonths": 49,
    "estimatedCompletion": "2030-07",
    "nearestMrt": [
      "Telok Blangah (CC28)",
      "Labrador Park (CC27)"
    ],
    "mrtWalkingMinutes": 3,
    "lat": 1.2708,
    "lng": 103.8099,
    "description": "Prime project bounded by Berlayar Street and Berlayar Drive in the Greater Southern Waterfront, right in front of Telok Blangah MRT station. With 1,976 units across six blocks of 33 to 49 storeys, it is the largest project of the June 2026 exercise and carries a 14% subsidy clawback.",
    "notes": "Unit counts from DollarsAndSense table (2-room Flexi combines Type 1: 172 and Type 2: 644); 99-year-lease prices from Stacked Homes. Wait is 49 months for blocks 201B/204A/204B and 54 months for blocks 200A/200B/201A - shortest used; mrtWalkingMinutes estimated (sheltered linkway to Telok Blangah MRT); lat/lng approximate; estimatedCompletion = launch + 49 months.",
    "sourceUrls": [
      "https://stackedhomes.com/june-2026-bto-launch-review/",
      "https://dollarsandsense.sg/june-2026-bto-sales-launch-guide-ang-mo-kio-bishan-lakeview-berlayar-sembawang-north/",
      "https://www.homeanddecor.com.sg/property/hdb/june-2026-bto-exercise-prices-waiting-times-and-unit-types",
      "https://uchify.com/june-2026-bto-launch-ranked/"
    ]
  },
  {
    "slug": "lakeview-cascadia",
    "name": "Lakeview Cascadia",
    "exercise": "2026-06",
    "exerciseLabel": "June 2026 BTO",
    "town": "Bishan",
    "region": "Central",
    "classification": "Prime",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-06-24",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 476,
        "minPrice": 216000,
        "maxPrice": 361000
      },
      {
        "type": "4-room",
        "units": 745,
        "minPrice": 534000,
        "maxPrice": 742000
      }
    ],
    "totalUnits": 1221,
    "estimatedWaitMonths": 51,
    "estimatedCompletion": "2030-09",
    "nearestMrt": [
      "Marymount (CC16)",
      "Upper Thomson (TE8)"
    ],
    "mrtWalkingMinutes": 8,
    "lat": 1.3412,
    "lng": 103.8358,
    "description": "Prime project along Upper Thomson Road - the first BTO in Bishan's Lakeview area in nearly 40 years. Its 1,221 units are within walking distance of both Marymount and Upper Thomson MRT stations, with a 10% subsidy clawback.",
    "notes": "Unit counts from DollarsAndSense table (2-room Flexi combines Type 1: 118 and Type 2: 358); 99-year-lease prices from Stacked Homes; mrtWalkingMinutes estimated ('walking distance to both stations'); lat/lng approximate for the Lakeview/Shunfu site; estimatedCompletion = launch + 51 months.",
    "sourceUrls": [
      "https://stackedhomes.com/june-2026-bto-launch-review/",
      "https://dollarsandsense.sg/june-2026-bto-sales-launch-guide-ang-mo-kio-bishan-lakeview-berlayar-sembawang-north/",
      "https://www.homeanddecor.com.sg/property/hdb/june-2026-bto-exercise-prices-waiting-times-and-unit-types",
      "https://uchify.com/june-2026-bto-launch-ranked/"
    ]
  },
  {
    "slug": "kebun-baru-ridge",
    "name": "Kebun Baru Ridge",
    "exercise": "2026-06",
    "exerciseLabel": "June 2026 BTO",
    "town": "Ang Mo Kio",
    "region": "North-East",
    "classification": "Plus",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-06-24",
    "flatTypes": [
      {
        "type": "3-room",
        "units": 95,
        "minPrice": 380000,
        "maxPrice": 492000
      },
      {
        "type": "4-room",
        "units": 390,
        "minPrice": 543000,
        "maxPrice": 693000
      }
    ],
    "totalUnits": 485,
    "estimatedWaitMonths": 37,
    "estimatedCompletion": "2029-07",
    "nearestMrt": [
      "Mayflower (TE6)"
    ],
    "mrtWalkingMinutes": 6,
    "lat": 1.371,
    "lng": 103.8382,
    "description": "Plus project along Ang Mo Kio Avenue 2, within walking distance of Mayflower MRT station and Mayflower Market. Its 485 units of 3- and 4-room flats across three 20-21 storey blocks have a relatively short wait of about 3 years 1 month, with an 8% subsidy clawback.",
    "notes": "Unit counts from DollarsAndSense table; prices from Stacked Homes/Home&Decor; mrtWalkingMinutes estimated ('walking distance to Mayflower MRT'); lat/lng approximate; estimatedCompletion = launch + 37 months.",
    "sourceUrls": [
      "https://stackedhomes.com/june-2026-bto-launch-review/",
      "https://dollarsandsense.sg/june-2026-bto-sales-launch-guide-ang-mo-kio-bishan-lakeview-berlayar-sembawang-north/",
      "https://www.homeanddecor.com.sg/property/hdb/june-2026-bto-exercise-prices-waiting-times-and-unit-types",
      "https://uchify.com/june-2026-bto-launch-ranked/"
    ]
  },
  {
    "slug": "kebun-baru-breeze",
    "name": "Kebun Baru Breeze",
    "exercise": "2026-06",
    "exerciseLabel": "June 2026 BTO",
    "town": "Ang Mo Kio",
    "region": "North-East",
    "classification": "Plus",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-06-24",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 377,
        "minPrice": 191000,
        "maxPrice": 349000
      },
      {
        "type": "4-room",
        "units": 202,
        "minPrice": 547000,
        "maxPrice": 746000
      }
    ],
    "totalUnits": 579,
    "estimatedWaitMonths": 52,
    "estimatedCompletion": "2030-10",
    "nearestMrt": [
      "Mayflower (TE6)"
    ],
    "mrtWalkingMinutes": 10,
    "lat": 1.3685,
    "lng": 103.8395,
    "description": "Plus project along Ang Mo Kio Avenue 1 served by Mayflower MRT station on the Thomson-East Coast Line. Its 579 units of 2-room Flexi and 4-room flats have the longest wait of the June 2026 exercise at about 4 years 4 months, with an 8% subsidy clawback.",
    "notes": "Unit counts from DollarsAndSense table (2-room Flexi combines Type 1: 261 and Type 2: 116); 99-year-lease prices from Stacked Homes; mrtWalkingMinutes estimated; lat/lng approximate; estimatedCompletion = launch + 52 months.",
    "sourceUrls": [
      "https://stackedhomes.com/june-2026-bto-launch-review/",
      "https://dollarsandsense.sg/june-2026-bto-sales-launch-guide-ang-mo-kio-bishan-lakeview-berlayar-sembawang-north/",
      "https://www.homeanddecor.com.sg/property/hdb/june-2026-bto-exercise-prices-waiting-times-and-unit-types",
      "https://uchify.com/june-2026-bto-launch-ranked/"
    ]
  },
  {
    "slug": "sembawang-portico",
    "name": "Sembawang Portico",
    "exercise": "2026-06",
    "exerciseLabel": "June 2026 BTO",
    "town": "Sembawang",
    "region": "North",
    "classification": "Standard",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-06-24",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 200,
        "minPrice": 142000,
        "maxPrice": 225000
      },
      {
        "type": "3-room",
        "units": 100,
        "minPrice": 250000,
        "maxPrice": 344000
      },
      {
        "type": "4-room",
        "units": 300,
        "minPrice": 320000,
        "maxPrice": 437000
      },
      {
        "type": "5-room",
        "units": 275,
        "minPrice": 465000,
        "maxPrice": 579000
      }
    ],
    "totalUnits": 875,
    "estimatedWaitMonths": 31,
    "estimatedCompletion": "2029-01",
    "nearestMrt": [
      "Sembawang (NS11)"
    ],
    "mrtWalkingMinutes": 15,
    "lat": 1.4468,
    "lng": 103.8218,
    "description": "Standard project bounded by Admiralty Lane and Sembawang Drive in Sembawang North, with three 26-storey blocks (one including 50 rental flats). Its 875 units are Shorter Waiting Time flats - the fastest of the June 2026 exercise at about 2 years 7 months.",
    "notes": "Unit counts from DollarsAndSense table (2-room Flexi combines Type 1: 50 and Type 2: 150); 99-year-lease prices from Stacked Homes; lat/lng approximate; estimatedCompletion = launch + 31 months.",
    "sourceUrls": [
      "https://stackedhomes.com/june-2026-bto-launch-review/",
      "https://dollarsandsense.sg/june-2026-bto-sales-launch-guide-ang-mo-kio-bishan-lakeview-berlayar-sembawang-north/",
      "https://www.homeanddecor.com.sg/property/hdb/june-2026-bto-exercise-prices-waiting-times-and-unit-types",
      "https://uchify.com/june-2026-bto-launch-ranked/"
    ]
  },
  {
    "slug": "sembawang-brook",
    "name": "Sembawang Brook",
    "exercise": "2026-06",
    "exerciseLabel": "June 2026 BTO",
    "town": "Sembawang",
    "region": "North",
    "classification": "Standard",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-06-24",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 261,
        "minPrice": 139000,
        "maxPrice": 218000
      },
      {
        "type": "3-room",
        "units": 87,
        "minPrice": 257000,
        "maxPrice": 333000
      },
      {
        "type": "4-room",
        "units": 464,
        "minPrice": 302000,
        "maxPrice": 428000
      },
      {
        "type": "5-room",
        "units": 319,
        "minPrice": 420000,
        "maxPrice": 571000
      },
      {
        "type": "3Gen",
        "units": 29,
        "minPrice": 468000,
        "maxPrice": 567000
      }
    ],
    "totalUnits": 1160,
    "estimatedWaitMonths": 33,
    "estimatedCompletion": "2029-03",
    "nearestMrt": [
      "Sembawang (NS11)"
    ],
    "mrtWalkingMinutes": 15,
    "lat": 1.4515,
    "lng": 103.816,
    "description": "Standard project along Admiralty Street in Sembawang North, and the only June 2026 project offering 3Gen flats (29 units). Its 1,160 units are Shorter Waiting Time flats completing in about 2 years 9 months.",
    "notes": "Unit counts from DollarsAndSense table (2-room Flexi combines Type 1: 58 and Type 2: 203); 99-year-lease prices from Stacked Homes; lat/lng approximate for the Admiralty Street site; estimatedCompletion = launch + 33 months.",
    "sourceUrls": [
      "https://stackedhomes.com/june-2026-bto-launch-review/",
      "https://dollarsandsense.sg/june-2026-bto-sales-launch-guide-ang-mo-kio-bishan-lakeview-berlayar-sembawang-north/",
      "https://www.homeanddecor.com.sg/property/hdb/june-2026-bto-exercise-prices-waiting-times-and-unit-types",
      "https://uchify.com/june-2026-bto-launch-ranked/"
    ]
  },
  {
    "slug": "woodgrove-acres",
    "name": "Woodgrove Acres",
    "exercise": "2026-06",
    "exerciseLabel": "June 2026 BTO",
    "town": "Woodlands",
    "region": "North",
    "classification": "Standard",
    "lifecycleStatus": "launched",
    "applicationDeadline": "2026-06-24",
    "flatTypes": [
      {
        "type": "2-room Flexi",
        "units": 157,
        "minPrice": 137000,
        "maxPrice": 211000
      },
      {
        "type": "3-room",
        "units": 80,
        "minPrice": 260000,
        "maxPrice": 325000
      },
      {
        "type": "4-room",
        "units": 162,
        "minPrice": 353000,
        "maxPrice": 437000
      },
      {
        "type": "5-room",
        "units": 257,
        "minPrice": 472000,
        "maxPrice": 582000
      }
    ],
    "totalUnits": 656,
    "estimatedWaitMonths": 42,
    "estimatedCompletion": "2029-12",
    "nearestMrt": [
      "Woodlands (NS9/TE2)"
    ],
    "mrtWalkingMinutes": 15,
    "lat": 1.4298,
    "lng": 103.7845,
    "description": "Standard project along Woodgrove Avenue with five 15-19 storey blocks plus a standalone rental block, next to the SLE. Its 656 units are about a 15-minute walk from Woodlands MRT station, Causeway Point and The Woodgrove mall.",
    "notes": "Unit counts from DollarsAndSense/Stacked tables (2-room Flexi combines Type 1: 31 and Type 2: 126); 99-year-lease prices from Stacked Homes; uchify lists 654 units vs 656 in other sources - 656 used (sums with flat-type breakdown); lat/lng approximate; estimatedCompletion = launch + 42 months.",
    "sourceUrls": [
      "https://stackedhomes.com/june-2026-bto-launch-review/",
      "https://dollarsandsense.sg/june-2026-bto-sales-launch-guide-ang-mo-kio-bishan-lakeview-berlayar-sembawang-north/",
      "https://www.homeanddecor.com.sg/property/hdb/june-2026-bto-exercise-prices-waiting-times-and-unit-types",
      "https://uchify.com/june-2026-bto-launch-ranked/"
    ]
  }
];
