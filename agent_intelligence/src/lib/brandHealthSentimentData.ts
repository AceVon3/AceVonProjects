// GENERATED FILE — written by scripts/brand_health/refresh_sentiment.ts
// on 2026-07-16. Do not edit by hand; run the refresh script instead.

import { type SentimentSnapshot } from "./brandHealthSentiment";

export const SENTIMENT_SNAPSHOT: SentimentSnapshot | null =
  {
    "retrievedAt": "2026-07-16",
    "naicReportYear": 2025,
    "brands": {
      "Allstate": {
        "raw": {
          "placesRating": 4.650295967443581,
          "placesReviewCount": 21624,
          "placesListingCount": 189,
          "complaintIndex": 2.68787609
        },
        "metric": {
          "value": 68,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.65★ across 189 listings (21.6k reviews, 10-metro sample); NAIC complaint index 2.69 (2025, Allstate Fire and Casualty Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "American Family": {
        "raw": {
          "placesRating": 4.6795879435330034,
          "placesReviewCount": 7863,
          "placesListingCount": 124,
          "complaintIndex": 1.529724019
        },
        "metric": {
          "value": 75,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.68★ across 124 listings (7.9k reviews, 10-metro sample); NAIC complaint index 1.53 (2025, American Family Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "COUNTRY Financial": {
        "raw": {
          "placesRating": 4.743509477311889,
          "placesReviewCount": 3482,
          "placesListingCount": 90,
          "complaintIndex": 0.358683379
        },
        "metric": {
          "value": 83,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.74★ across 90 listings (3.5k reviews, 10-metro sample); NAIC complaint index 0.36 (2025, COUNTRY Preferred Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "Encompass": {
        "raw": {
          "placesRating": 4.095398380911803,
          "placesReviewCount": 2347,
          "placesListingCount": 28,
          "complaintIndex": 3.021698062
        },
        "metric": {
          "value": 54,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "medium",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.10★ across 28 listings (2.3k reviews, 10-metro sample); NAIC complaint index 3.02 (2025, Encompass Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume); sparse listing sample (28 listings) — direct-writer brands have few local storefronts, so ratings skew toward corporate/claims offices. NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "Farmers": {
        "raw": {
          "placesRating": 4.848642789820924,
          "placesReviewCount": 10610,
          "placesListingCount": 166,
          "complaintIndex": 2.308497484
        },
        "metric": {
          "value": 72,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.85★ across 166 listings (10.6k reviews, 10-metro sample); NAIC complaint index 2.31 (2025, Farmers Insurance Exchange; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "GEICO": {
        "raw": {
          "placesRating": 4.68913808188847,
          "placesReviewCount": 56003,
          "placesListingCount": 96,
          "complaintIndex": 2.6993933
        },
        "metric": {
          "value": 70,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.69★ across 96 listings (56.0k reviews, 10-metro sample); NAIC complaint index 2.70 (2025, GEICO General Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "Liberty Mutual": {
        "raw": {
          "placesRating": 3.091461988304094,
          "placesReviewCount": 855,
          "placesListingCount": 23,
          "complaintIndex": 3.388505747
        },
        "metric": {
          "value": 35,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "medium",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 3.09★ across 23 listings (0.9k reviews, 10-metro sample); NAIC complaint index 3.39 (2025, Liberty Mutual Personal Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume); sparse listing sample (23 listings) — direct-writer brands have few local storefronts, so ratings skew toward corporate/claims offices. NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "Nationwide": {
        "raw": {
          "placesRating": 4.3677413308341135,
          "placesReviewCount": 5335,
          "placesListingCount": 109,
          "complaintIndex": 1.986131259
        },
        "metric": {
          "value": 67,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.37★ across 109 listings (5.3k reviews, 10-metro sample); NAIC complaint index 1.99 (2025, Nationwide Mutual Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "Progressive": {
        "raw": {
          "placesRating": 3.500350058343057,
          "placesReviewCount": 5142,
          "placesListingCount": 61,
          "complaintIndex": 2.314854384
        },
        "metric": {
          "value": 51,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 3.50★ across 61 listings (5.1k reviews, 10-metro sample); NAIC complaint index 2.31 (2025, Progressive Direct Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "Safeco": {
        "raw": {
          "placesRating": 2.1294403892944036,
          "placesReviewCount": 1233,
          "placesListingCount": 19,
          "complaintIndex": 3.265921245
        },
        "metric": {
          "value": 22,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "medium",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 2.13★ across 19 listings (1.2k reviews, 10-metro sample); NAIC complaint index 3.27 (2025, Safeco Insurance Company of Illinois; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume); sparse listing sample (19 listings) — direct-writer brands have few local storefronts, so ratings skew toward corporate/claims offices. NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "State Farm": {
        "raw": {
          "placesRating": 4.923303145252725,
          "placesReviewCount": 71441,
          "placesListingCount": 197,
          "complaintIndex": 1.798544891
        },
        "metric": {
          "value": 80,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "high",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 4.92★ across 197 listings (71.4k reviews, 10-metro sample); NAIC complaint index 1.80 (2025, State Farm Mutual Automobile Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume). NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "Travelers": {
        "raw": {
          "placesRating": 2.2146938775510208,
          "placesReviewCount": 490,
          "placesListingCount": 19,
          "complaintIndex": 2.025523401
        },
        "metric": {
          "value": 31,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "medium",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 2.21★ across 19 listings (0.5k reviews, 10-metro sample); NAIC complaint index 2.03 (2025, Travelers Property Casualty Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume); sparse listing sample (19 listings) — direct-writer brands have few local storefronts, so ratings skew toward corporate/claims offices. NAIC complaint data is annual; ratings are point-in-time."
        }
      },
      "USAA": {
        "raw": {
          "placesRating": 2.7115513392857147,
          "placesReviewCount": 1792,
          "placesListingCount": 8,
          "complaintIndex": 2.98337425
        },
        "metric": {
          "value": 33,
          "sourceTier": "platform",
          "sourceName": "Google Places ratings + NAIC complaint index",
          "sourceUrl": "https://content.naic.org/cis_consumer_information.htm",
          "dataAsOf": "2026-07-16",
          "retrievedAt": "2026-07-16",
          "confidence": "medium",
          "refreshCadence": "monthly",
          "scope": "national",
          "note": "Google 2.71★ across 8 listings (1.8k reviews, 10-metro sample); NAIC complaint index 2.98 (2025, USAA Casualty Insurance Company; 1.0 = industry average, peer-ranked). Blend 45/35/20 (ratings/complaints/volume); sparse listing sample (8 listings) — direct-writer brands have few local storefronts, so ratings skew toward corporate/claims offices. NAIC complaint data is annual; ratings are point-in-time."
        }
      }
    }
  };
