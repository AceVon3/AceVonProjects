// GENERATED FILE — written by scripts/brand_health/probe_quoteflow.ts
// on 2026-07-17. Do not edit by hand; run the probe instead.

import { type QuoteFlowSnapshot } from "./brandHealthWebsite";

export const QUOTEFLOW_SNAPSHOT: QuoteFlowSnapshot | null =
  {
    "probedAt": "2026-07-17",
    "brands": {
      "Allstate": {
        "zipOnHomepage": false,
        "clicksToQuote": 1,
        "msToQuoteStart": 14310,
        "finalUrl": "https://www.allstate.com/"
      },
      "American Family": {
        "zipOnHomepage": false,
        "clicksToQuote": 1,
        "msToQuoteStart": 13799,
        "finalUrl": "https://www.amfam.com/"
      },
      "COUNTRY Financial": {
        "failed": "no quote CTA found on homepage"
      },
      "Encompass": {
        "failed": "no quote CTA found on homepage"
      },
      "Farmers": {
        "zipOnHomepage": true,
        "clicksToQuote": 0,
        "msToQuoteStart": 5824,
        "finalUrl": "https://www.farmers.com/"
      },
      "GEICO": {
        "failed": "locator.click: Timeout 10000ms exceeded."
      },
      "Liberty Mutual": {
        "zipOnHomepage": true,
        "clicksToQuote": 0,
        "msToQuoteStart": 4339,
        "finalUrl": "https://www.libertymutual.com/"
      },
      "Nationwide": {
        "failed": "no quote CTA found on homepage"
      },
      "Progressive": {
        "failed": "no quote CTA found on homepage"
      },
      "Safeco": {
        "failed": "no quote CTA found on homepage"
      },
      "State Farm": {
        "zipOnHomepage": true,
        "clicksToQuote": 0,
        "msToQuoteStart": 4476,
        "finalUrl": "https://www.statefarm.com/"
      },
      "Travelers": {
        "zipOnHomepage": true,
        "clicksToQuote": 0,
        "msToQuoteStart": 4074,
        "finalUrl": "https://www.travelers.com/"
      },
      "USAA": {
        "failed": "locator.click: Timeout 10000ms exceeded."
      }
    }
  };
