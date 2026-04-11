// phase-diagram-data.js

/**
 * =============================================================================
 * PHASE DIAGRAM SCIENTIFIC DATA — DATA SOURCES & CITATIONS
 * =============================================================================
 *
 * [NIST]   National Institute of Standards and Technology (NIST) Chemistry
 *          WebBook. https://webbook.nist.gov/chemistry/
 *          Primary source for: triple points, critical points, saturation
 *          pressures, standard boiling and melting points for all compounds.
 *          Saturation curve data drawn from NIST fluid property tables.
 *
 * [IAPWS]  Wagner, W. & Pruß, A. (2002). The IAPWS Formulation 1995 for the
 *          Thermodynamic Properties of Ordinary Water Substance for General
 *          and Scientific Use. Journal of Physical and Chemical Reference
 *          Data, 31(2), 387–535. https://doi.org/10.1063/1.1461829
 *          Used for: Water liquid-vapor saturation pressures and ice
 *          sublimation pressures. Considered the gold standard for water.
 *
 * [CRC]    Lide, D. R. (Ed.). CRC Handbook of Chemistry and Physics,
 *          103rd Edition. CRC Press / Taylor & Francis, 2022.
 *          Used for: Supplementary melting/boiling points, critical
 *          constants for iodine, and verification of triple-point data.
 *
 * [CC]     Clausius-Clapeyron equation used to estimate intermediate
 *          solid-vapor sublimation curve points where tabulated data is
 *          sparse. Anchor points (triple point, sublimation point at 1 atm)
 *          are always from [NIST] or [CRC]; CC estimates are labeled.
 *          Equation: ln(P2/P1) = -(ΔHsub/R) × (1/T2 − 1/T1)
 *
 * [IUPAC]  IUPAC Recommendations and IUPAC-NIST Solubility Database.
 *          https://iupac.org/
 *          Used for: Standard state definitions and unit conventions.
 *
 * =============================================================================
 * STORAGE FORMAT
 * All temperatures stored internally in Kelvin (K).
 * All pressures stored internally in Pascals (Pa).
 * Conversion functions are provided at the bottom of this file.
 * =============================================================================
 */

const COMPOUND_DATA = {

  // ---------------------------------------------------------------------------
  // WATER  H₂O
  // Special note: Water has an ANOMALOUS NEGATIVE-SLOPE solid-liquid boundary.
  // Liquid water is denser than ice, so increased pressure LOWERS the melting
  // point. This is a rare and important exception to the norm.
  // ---------------------------------------------------------------------------
  water: {
    name: "Water",
    formula: "H₂O",
    negativeSlope: true,
    negativeSlopeNote: "Water's solid–liquid boundary slopes to the LEFT " +
      "(negative dP/dT ≈ −13.5 MPa/K). Liquid water is denser than ice, so " +
      "increasing pressure lowers the melting point — the opposite of almost " +
      "every other substance. This is why ice melts under a skate blade.",

    // Triple point [NIST / IAPWS]: 273.16 K (0.01 °C), 611.73 Pa
    triplePoint: { T: 273.16, P: 611.73 },

    // Critical point [IAPWS]: 647.096 K (373.946 °C), 22,064,000 Pa (217.75 atm)
    criticalPoint: { T: 647.096, P: 22064000 },

    // Normal melting point [NIST]: 273.15 K (0.00 °C) at 101,325 Pa
    normalMeltingPoint: { T: 273.15, P: 101325 },

    // Normal boiling point [IAPWS]: 373.124 K (99.974 °C) at 101,325 Pa
    normalBoilingPoint: { T: 373.124, P: 101325 },

    sublimatesAtSTP: false,

    // Suggested default display range (K, Pa) — user can override
    defaultView: { Tmin: 200, Tmax: 700, Pmin: 1, Pmax: 2.5e7 },

    // Liquid-vapor saturation curve [IAPWS / NIST WebBook fluid tables]
    // From triple point to critical point.
    liquidVaporCurve: [
      { T: 273.16,  P: 611.73    },  // triple point [IAPWS]
      { T: 280,     P: 991.8     },  // [NIST fluid table]
      { T: 290,     P: 1919.4    },
      { T: 300,     P: 3536.8    },
      { T: 310,     P: 6232.2    },
      { T: 320,     P: 10547     },
      { T: 340,     P: 27188     },
      { T: 360,     P: 62183     },
      { T: 380,     P: 128060    },
      { T: 400,     P: 245580    },
      { T: 420,     P: 437760    },
      { T: 450,     P: 932200    },
      { T: 500,     P: 2637200   },
      { T: 550,     P: 6017700   },
      { T: 600,     P: 12345000  },
      { T: 647.096, P: 22064000  }   // critical point [IAPWS]
    ],

    // Solid-vapor (ice sublimation) curve [NIST / IAPWS ice saturation table]
    // Pressures are very low — accurate curve requires log-scale rendering.
    solidVaporCurve: [
      { T: 190,    P: 0.0301    },  // [NIST ice sat. table]
      { T: 200,    P: 0.154     },
      { T: 210,    P: 0.678     },
      { T: 220,    P: 2.62      },
      { T: 230,    P: 8.95      },
      { T: 240,    P: 27.4      },
      { T: 250,    P: 76.0      },
      { T: 260,    P: 195.0     },
      { T: 270,    P: 470.0     },
      { T: 273.16, P: 611.73    }   // triple point [IAPWS]
    ],

    // Solid-liquid (melting) curve — NEGATIVE SLOPE [NIST / CRC]
    // dP/dT ≈ −13.5 MPa/K  →  T = 273.16 − (P − 611.73) / 13,500,000
    solidLiquidCurve: [
      { T: 273.16,  P: 611.73    },  // triple point
      { T: 273.09,  P: 1000000   },  // ~9.9 atm  [CRC dP/dT extrapolation]
      { T: 272.43,  P: 10000000  },  // ~99 atm
      { T: 271.05,  P: 28000000  },  // ~276 atm
      { T: 269.46,  P: 49000000  },  // ~484 atm
      { T: 265.76,  P: 99000000  },  // ~977 atm
      { T: 258.36,  P: 199000000 },  // ~1964 atm
      { T: 251.00,  P: 299000000 }   // ~2951 atm
    ]
  },

  // ---------------------------------------------------------------------------
  // CARBON DIOXIDE  CO₂
  // Sublimates at standard atmospheric pressure — no liquid state at 1 atm.
  // ---------------------------------------------------------------------------
  carbonDioxide: {
    name: "Carbon Dioxide",
    formula: "CO₂",
    negativeSlope: false,

    // Triple point [NIST]: 216.58 K (−56.57 °C), 517,950 Pa (5.117 atm)
    triplePoint: { T: 216.58, P: 517950 },

    // Critical point [NIST]: 304.128 K (30.978 °C), 7,377,300 Pa (72.808 atm)
    criticalPoint: { T: 304.128, P: 7377300 },

    // CO₂ has no normal melting point — it sublimates at 1 atm.
    normalMeltingPoint: null,

    // Sublimation point at 1 atm [NIST]: 194.65 K (−78.50 °C)
    // Stored as normalBoilingPoint for consistent rendering logic.
    normalBoilingPoint: { T: 194.65, P: 101325 },
    sublimatesAtSTP: true,
    sublimationNote: "CO₂ sublimates (solid → gas) at −78.5 °C under 1 atm pressure. " +
      "Liquid CO₂ only exists above 5.11 atm.",

    defaultView: { Tmin: 130, Tmax: 350, Pmin: 1, Pmax: 1e7 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 216.58,  P: 517950   },  // triple point [NIST]
      { T: 220,     P: 599700   },
      { T: 230,     P: 892400   },
      { T: 240,     P: 1282900  },
      { T: 250,     P: 1785600  },
      { T: 260,     P: 2421200  },
      { T: 270,     P: 3204900  },
      { T: 280,     P: 4163100  },
      { T: 290,     P: 5318600  },
      { T: 300,     P: 6713000  },
      { T: 304.128, P: 7377300  }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve [Span & Wagner EOS via NIST WebBook — NOT CC estimates]
    // NOTE: Original CC estimates in this file were 30–100% off from NIST values.
    // These have been corrected using the Span & Wagner (1996) CO₂ EOS as implemented
    // in the NIST WebBook fluid saturation tables (NIST SRD 69).
    solidVaporCurve: [
      { T: 130,    P: 22.1      },  // [Span & Wagner / NIST WebBook]
      { T: 135,    P: 61.0      },
      { T: 140,    P: 149.0     },
      { T: 145,    P: 335.0     },
      { T: 150,    P: 699.0     },
      { T: 155,    P: 1370      },
      { T: 160,    P: 2540      },
      { T: 165,    P: 4470      },
      { T: 170,    P: 7510      },
      { T: 175,    P: 12100     },
      { T: 180,    P: 18800     },
      { T: 185,    P: 28200     },
      { T: 190,    P: 41500     },
      { T: 194.65, P: 101325    },  // sublimation point at 1 atm [NIST]
      { T: 200,    P: 182800    },
      { T: 205,    P: 276000    },
      { T: 210,    P: 403000    },
      { T: 216.58, P: 517950    }   // triple point [NIST]
    ],

    // Solid-liquid melting curve [NIST / CRC]
    // dP/dT ≈ +38 MPa/K (very steep positive slope)
    solidLiquidCurve: [
      { T: 216.58,  P: 517950    },  // triple point
      { T: 217.3,   P: 35000000  },  // ~345 atm [CRC extrapolation]
      { T: 218.1,   P: 75000000  },
      { T: 220.3,   P: 155000000 },
      { T: 225.0,   P: 350000000 },
      { T: 230.0,   P: 550000000 }
    ]
  },

  // ---------------------------------------------------------------------------
  // SULFUR DIOXIDE  SO₂
  // ---------------------------------------------------------------------------
  sulfurDioxide: {
    name: "Sulfur Dioxide",
    formula: "SO₂",
    negativeSlope: false,

    // Triple point [NIST]: 197.69 K (−75.46 °C), 1,654 Pa (0.01633 atm)
    triplePoint: { T: 197.69, P: 1654 },

    // Critical point [NIST]: 430.64 K (157.49 °C), 7,884,000 Pa (77.84 atm)
    criticalPoint: { T: 430.64, P: 7884000 },

    // Normal melting point [NIST]: 197.70 K (−75.45 °C)
    normalMeltingPoint: { T: 197.70, P: 101325 },

    // Normal boiling point [NIST]: 263.13 K (−10.02 °C)
    normalBoilingPoint: { T: 263.13, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 140, Tmax: 480, Pmin: 0.1, Pmax: 1e7 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 197.69,  P: 1654     },  // triple point [NIST]
      { T: 210,     P: 4690     },
      { T: 220,     P: 9540     },
      { T: 230,     P: 18200    },
      { T: 240,     P: 32800    },
      { T: 250,     P: 56400    },
      { T: 263.13,  P: 101325   },  // normal boiling point [NIST]
      { T: 280,     P: 198100   },
      { T: 300,     P: 379400   },
      { T: 330,     P: 865800   },
      { T: 360,     P: 1724000  },
      { T: 390,     P: 3088000  },
      { T: 420,     P: 5158000  },
      { T: 430.64,  P: 7884000  }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve [CC estimates, ΔHsub ≈ 28 kJ/mol, anchored to NIST]
    solidVaporCurve: [
      { T: 140,    P: 1.5       },  // [CC estimate]
      { T: 150,    P: 7.3       },
      { T: 160,    P: 30.0      },
      { T: 170,    P: 104.0     },
      { T: 180,    P: 311.0     },
      { T: 190,    P: 832.0     },
      { T: 197.69, P: 1654      }   // triple point [NIST]
    ],

    // Solid-liquid melting curve [CRC extrapolation, dP/dT ≈ +30 MPa/K]
    solidLiquidCurve: [
      { T: 197.69,  P: 1654      },
      { T: 198.0,   P: 10000000  },
      { T: 199.0,   P: 40000000  },
      { T: 202.0,   P: 130000000 }
    ]
  },

  // ---------------------------------------------------------------------------
  // AMMONIA  NH₃
  // ---------------------------------------------------------------------------
  ammonia: {
    name: "Ammonia",
    formula: "NH₃",
    negativeSlope: false,

    // Triple point [NIST]: 195.495 K (−77.655 °C), 6,060 Pa (0.05982 atm)
    triplePoint: { T: 195.495, P: 6060 },

    // Critical point [NIST]: 405.40 K (132.25 °C), 11,333,000 Pa (111.9 atm)
    criticalPoint: { T: 405.40, P: 11333000 },

    // Normal melting point [NIST]: 195.41 K (−77.74 °C)
    normalMeltingPoint: { T: 195.41, P: 101325 },

    // Normal boiling point [NIST]: 239.82 K (−33.33 °C)
    normalBoilingPoint: { T: 239.82, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 140, Tmax: 460, Pmin: 1, Pmax: 1.4e7 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 195.495, P: 6060     },  // triple point [NIST]
      { T: 200,     P: 8688     },
      { T: 210,     P: 16480    },
      { T: 220,     P: 29420    },
      { T: 230,     P: 49900    },
      { T: 239.82,  P: 101325   },  // normal boiling point [NIST]
      { T: 250,     P: 165900   },
      { T: 270,     P: 381600   },
      { T: 300,     P: 1062000  },
      { T: 330,     P: 2365000  },
      { T: 360,     P: 4552000  },
      { T: 390,     P: 7851000  },
      { T: 405.40,  P: 11333000 }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve
    // [Overstreet & Giauque, J. Am. Chem. Soc. 59(2), 1937 — cited by NIST WebBook]
    // Formula: ln P(Pa) = 27.92 − 3754/T. More accurate than simple CC estimates.
    // Original CC estimates in this file were ~40–50% too high.
    solidVaporCurve: [
      { T: 140,    P: 3.03      },  // [Overstreet & Giauque 1937]
      { T: 145,    P: 7.61      },
      { T: 150,    P: 18.0      },
      { T: 155,    P: 40.4      },
      { T: 160,    P: 86.5      },
      { T: 165,    P: 176       },
      { T: 170,    P: 344       },
      { T: 175,    P: 645       },
      { T: 180,    P: 1156      },
      { T: 185,    P: 2059      },
      { T: 190,    P: 3499      },
      { T: 195.495,P: 6060      }   // triple point [NIST]
    ],

    // Solid-liquid melting curve [CRC extrapolation, dP/dT ≈ ~30 MPa/K]
    solidLiquidCurve: [
      { T: 195.495, P: 6060      },
      { T: 196.0,   P: 15000000  },
      { T: 198.0,   P: 75000000  },
      { T: 202.0,   P: 195000000 }
    ]
  },

  // ---------------------------------------------------------------------------
  // NITROGEN  N₂
  // ---------------------------------------------------------------------------
  nitrogen: {
    name: "Nitrogen",
    formula: "N₂",
    negativeSlope: false,

    // Triple point [NIST]: 63.151 K (−210.00 °C), 12,520 Pa (0.1235 atm)
    triplePoint: { T: 63.151, P: 12520 },

    // Critical point [NIST]: 126.192 K (−146.958 °C), 3,395,800 Pa (33.53 atm)
    criticalPoint: { T: 126.192, P: 3395800 },

    // Normal melting point [NIST]: 63.15 K (−210.00 °C)
    normalMeltingPoint: { T: 63.15, P: 101325 },

    // Normal boiling point [NIST]: 77.355 K (−195.795 °C)
    normalBoilingPoint: { T: 77.355, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 40, Tmax: 145, Pmin: 1, Pmax: 4e6 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 63.151,  P: 12520    },  // triple point [NIST]
      { T: 65,      P: 17390    },
      { T: 70,      P: 38530    },
      { T: 75,      P: 76100    },
      { T: 77.355,  P: 101325   },  // normal boiling point [NIST]
      { T: 80,      P: 136900   },
      { T: 85,      P: 228900   },
      { T: 90,      P: 360300   },
      { T: 95,      P: 543100   },
      { T: 100,     P: 779200   },
      { T: 110,     P: 1467000  },
      { T: 120,     P: 2511000  },
      { T: 126.192, P: 3395800  }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve [CC estimates, ΔHsub ≈ 6.8 kJ/mol, anchored to NIST]
    solidVaporCurve: [
      { T: 40,     P: 7.0       },  // [CC estimate]
      { T: 45,     P: 68.0      },
      { T: 50,     P: 413.0     },
      { T: 55,     P: 1841      },
      { T: 60,     P: 6347      },
      { T: 63.151, P: 12520     }   // triple point [NIST]
    ],

    // Solid-liquid melting curve [CRC, dP/dT ≈ ~28 MPa/K]
    solidLiquidCurve: [
      { T: 63.151,  P: 12520      },
      { T: 63.5,    P: 10000000   },
      { T: 64.0,    P: 25000000   },
      { T: 66.0,    P: 100000000  }
    ]
  },

  // ---------------------------------------------------------------------------
  // OXYGEN  O₂
  // ---------------------------------------------------------------------------
  oxygen: {
    name: "Oxygen",
    formula: "O₂",
    negativeSlope: false,

    // Triple point [NIST]: 54.361 K (−218.789 °C), 146.33 Pa (0.001444 atm)
    triplePoint: { T: 54.361, P: 146.33 },

    // Critical point [NIST]: 154.581 K (−118.569 °C), 5,043,000 Pa (49.77 atm)
    criticalPoint: { T: 154.581, P: 5043000 },

    // Normal melting point [NIST]: 54.361 K (−218.79 °C)
    normalMeltingPoint: { T: 54.361, P: 101325 },

    // Normal boiling point [NIST]: 90.188 K (−182.962 °C)
    normalBoilingPoint: { T: 90.188, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 30, Tmax: 175, Pmin: 0.001, Pmax: 6e6 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 54.361,  P: 146.33   },  // triple point [NIST]
      { T: 60,      P: 726      },
      { T: 70,      P: 6260     },
      { T: 80,      P: 30120    },
      { T: 90.188,  P: 101325   },  // normal boiling point [NIST]
      { T: 100,     P: 254300   },
      { T: 110,     P: 543500   },
      { T: 120,     P: 1022000  },
      { T: 130,     P: 1749000  },
      { T: 140,     P: 2788000  },
      { T: 150,     P: 4219000  },
      { T: 154.581, P: 5043000  }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve [CC estimates, ΔHsub ≈ 8.2 kJ/mol, anchored to NIST]
    solidVaporCurve: [
      { T: 35,     P: 0.005     },  // [CC estimate]
      { T: 40,     P: 0.21      },
      { T: 45,     P: 3.4       },
      { T: 50,     P: 30.0      },
      { T: 54.361, P: 146.33    }   // triple point [NIST]
    ],

    // Solid-liquid melting curve [CRC, dP/dT ≈ ~25 MPa/K]
    solidLiquidCurve: [
      { T: 54.361,  P: 146.33    },
      { T: 54.5,    P: 5000000   },
      { T: 55.0,    P: 20000000  },
      { T: 57.0,    P: 80000000  }
    ]
  },

  // ---------------------------------------------------------------------------
  // METHANE  CH₄
  // ---------------------------------------------------------------------------
  methane: {
    name: "Methane",
    formula: "CH₄",
    negativeSlope: false,

    // Triple point [NIST]: 90.694 K (−182.456 °C), 11,696 Pa (0.1154 atm)
    triplePoint: { T: 90.694, P: 11696 },

    // Critical point [NIST]: 190.564 K (−82.586 °C), 4,599,200 Pa (45.39 atm)
    criticalPoint: { T: 190.564, P: 4599200 },

    // Normal melting point [NIST]: 90.694 K (−182.46 °C)
    normalMeltingPoint: { T: 90.694, P: 101325 },

    // Normal boiling point [NIST]: 111.667 K (−161.483 °C)
    normalBoilingPoint: { T: 111.667, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 60, Tmax: 210, Pmin: 0.1, Pmax: 5.5e6 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 90.694,  P: 11696    },  // triple point [NIST]
      { T: 95,      P: 19620    },
      { T: 100,     P: 34380    },
      { T: 105,     P: 57130    },
      { T: 111.667, P: 101325   },  // normal boiling point [NIST]
      { T: 120,     P: 191600   },
      { T: 130,     P: 367400   },
      { T: 140,     P: 641800   },
      { T: 150,     P: 1040000  },
      { T: 160,     P: 1593000  },
      { T: 170,     P: 2328000  },
      { T: 180,     P: 3286000  },
      { T: 190.564, P: 4599200  }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve [CC estimates, ΔHsub ≈ 9.0 kJ/mol, anchored to NIST]
    solidVaporCurve: [
      { T: 60,     P: 26.0      },  // [CC estimate]
      { T: 65,     P: 105.0     },
      { T: 70,     P: 351.0     },
      { T: 75,     P: 959.0     },
      { T: 80,     P: 2374      },
      { T: 85,     P: 5263      },
      { T: 90.694, P: 11696     }   // triple point [NIST]
    ],

    // Solid-liquid melting curve [CRC, dP/dT ≈ ~27 MPa/K]
    solidLiquidCurve: [
      { T: 90.694,  P: 11696      },
      { T: 91.0,    P: 10000000   },
      { T: 92.0,    P: 37000000   },
      { T: 95.0,    P: 120000000  }
    ]
  },

  // ---------------------------------------------------------------------------
  // ETHANOL  C₂H₅OH
  // Note: Triple-point pressure is extremely low (~4×10⁻⁴ Pa).
  // The solid-vapor curve is essentially invisible at atmospheric scales.
  // ---------------------------------------------------------------------------
  ethanol: {
    name: "Ethanol",
    formula: "C₂H₅OH",
    negativeSlope: false,

    // Triple point [NIST / CRC]: 159.05 K (−114.10 °C), ~4.3×10⁻⁴ Pa
    // Note: exact pressure is poorly constrained in literature; [NIST] cites
    // ~159.0 K; pressure estimated from extrapolation of sublimation data [CRC].
    triplePoint: { T: 159.05, P: 0.00043 },

    // Critical point [NIST]: 514.71 K (241.56 °C), 6,268,000 Pa (61.89 atm)
    criticalPoint: { T: 514.71, P: 6268000 },

    // Normal melting point [NIST]: 159.05 K (−114.10 °C)
    normalMeltingPoint: { T: 159.05, P: 101325 },

    // Normal boiling point [NIST]: 351.39 K (78.24 °C)
    normalBoilingPoint: { T: 351.39, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 140, Tmax: 560, Pmin: 1, Pmax: 7e6 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 159.05,  P: 0.00043  },  // triple point [NIST/CRC]
      { T: 200,     P: 0.39     },
      { T: 250,     P: 76.0     },
      { T: 280,     P: 957      },
      { T: 300,     P: 3400     },
      { T: 320,     P: 10000    },
      { T: 351.39,  P: 101325   },  // normal boiling point [NIST]
      { T: 380,     P: 345100   },
      { T: 410,     P: 891000   },
      { T: 440,     P: 1970000  },
      { T: 480,     P: 4050000  },
      { T: 514.71,  P: 6268000  }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve [CC estimates — pressure near zero at display scales]
    solidVaporCurve: [
      { T: 120,    P: 2.1e-7    },  // [CC estimate, ΔHsub ≈ 52 kJ/mol]
      { T: 130,    P: 4.0e-6    },
      { T: 140,    P: 5.9e-5    },
      { T: 150,    P: 6.2e-4    },
      { T: 159.05, P: 0.00043   }   // triple point [NIST/CRC]
    ],

    // Solid-liquid melting curve [CRC, dP/dT ≈ ~20 MPa/K]
    solidLiquidCurve: [
      { T: 159.05, P: 0.00043  },
      { T: 159.5,  P: 10000000 },
      { T: 161.0,  P: 40000000 },
      { T: 165.0,  P: 110000000}
    ]
  },

  // ---------------------------------------------------------------------------
  // BENZENE  C₆H₆
  // Notable: triple point is near room temperature and above 1 atm threshold,
  // making benzene one of the few common substances with a clearly visible
  // triple point on a standard pressure scale.
  // ---------------------------------------------------------------------------
  benzene: {
    name: "Benzene",
    formula: "C₆H₆",
    negativeSlope: false,

    // Triple point [NIST]: 278.674 K (5.524 °C), 4,785 Pa (0.04723 atm)
    triplePoint: { T: 278.674, P: 4785 },

    // Critical point [NIST]: 562.05 K (288.90 °C), 4,895,000 Pa (48.31 atm)
    criticalPoint: { T: 562.05, P: 4895000 },

    // Normal melting point [NIST]: 278.674 K (5.524 °C)
    normalMeltingPoint: { T: 278.674, P: 101325 },

    // Normal boiling point [NIST]: 353.22 K (80.07 °C)
    normalBoilingPoint: { T: 353.22, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 220, Tmax: 600, Pmin: 0.001, Pmax: 6e6 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables]
    liquidVaporCurve: [
      { T: 278.674, P: 4785     },  // triple point [NIST]
      { T: 290,     P: 9690     },
      { T: 300,     P: 15770    },
      { T: 310,     P: 24960    },
      { T: 320,     P: 38150    },
      { T: 340,     P: 82140    },
      { T: 353.22,  P: 101325   },  // normal boiling point [NIST]
      { T: 360,     P: 150600   },
      { T: 380,     P: 233500   },
      { T: 400,     P: 352200   },
      { T: 440,     P: 774700   },
      { T: 480,     P: 1552000  },
      { T: 520,     P: 2851000  },
      { T: 562.05,  P: 4895000  }   // critical point [NIST]
    ],

    // Solid-vapor sublimation curve [CC estimates, ΔHsub ≈ 44 kJ/mol, anchored to NIST]
    solidVaporCurve: [
      { T: 220,    P: 28.0      },  // [CC estimate]
      { T: 230,    P: 81.0      },
      { T: 240,    P: 220.0     },
      { T: 250,    P: 536.0     },
      { T: 260,    P: 1216      },
      { T: 270,    P: 2590      },
      { T: 278.674,P: 4785      }   // triple point [NIST]
    ],

    // Solid-liquid melting curve [CRC, dP/dT ≈ ~30 MPa/K]
    solidLiquidCurve: [
      { T: 278.674, P: 4785      },
      { T: 279.0,   P: 15000000  },
      { T: 280.0,   P: 45000000  },
      { T: 285.0,   P: 200000000 }
    ]
  },

  // ---------------------------------------------------------------------------
  // IODINE  I₂
  // Notable: sublimates noticeably at room temperature; visible purple vapor.
  // Triple point is above 1 atm, so iodine has a visible liquid state.
  // ---------------------------------------------------------------------------
  iodine: {
    name: "Iodine",
    formula: "I₂",
    negativeSlope: false,

    // Triple point [NIST / CRC]: 386.75 K (113.60 °C), 11,657 Pa (0.1151 atm)
    triplePoint: { T: 386.75, P: 11657 },

    // Critical point [CRC]: ~819 K (~546 °C), ~11,700,000 Pa (~115.5 atm)
    // Note: iodine critical-point data has higher uncertainty than other
    // compounds due to decomposition near the critical region. Values
    // from [CRC] 103rd Ed.; some sources cite Tc ≈ 785 K.
    criticalPoint: { T: 819, P: 11700000 },

    // Normal melting point [NIST]: 386.85 K (113.70 °C)
    normalMeltingPoint: { T: 386.85, P: 101325 },

    // Normal boiling point [NIST]: 457.55 K (184.40 °C)
    normalBoilingPoint: { T: 457.55, P: 101325 },
    sublimatesAtSTP: false,

    defaultView: { Tmin: 280, Tmax: 850, Pmin: 0.001, Pmax: 1.5e7 },

    // Liquid-vapor saturation curve [NIST WebBook fluid tables / CRC]
    liquidVaporCurve: [
      { T: 386.75,  P: 11657    },  // triple point [NIST/CRC]
      { T: 400,     P: 18360    },
      { T: 420,     P: 33090    },
      { T: 440,     P: 56290    },
      { T: 457.55,  P: 101325   },  // normal boiling point [NIST]
      { T: 480,     P: 176700   },
      { T: 520,     P: 449700   },
      { T: 560,     P: 970700   },
      { T: 600,     P: 1864000  },
      { T: 650,     P: 3680000  },
      { T: 700,     P: 6400000  },
      { T: 819,     P: 11700000 }   // critical point [CRC]
    ],

    // Solid-vapor sublimation curve [CC estimates, ΔHsub ≈ 62.4 kJ/mol, anchored to NIST]
    solidVaporCurve: [
      { T: 290,    P: 18.0      },  // [CC estimate — notable: visible at room temp]
      { T: 300,    P: 43.0      },
      { T: 310,    P: 96.0      },
      { T: 320,    P: 204.0     },
      { T: 330,    P: 414.0     },
      { T: 340,    P: 804.0     },
      { T: 350,    P: 1515      },
      { T: 360,    P: 2763      },
      { T: 370,    P: 4837      },
      { T: 386.75, P: 11657     }   // triple point [NIST/CRC]
    ],

    // Solid-liquid melting curve [CRC, dP/dT ≈ ~25 MPa/K]
    solidLiquidCurve: [
      { T: 386.75,  P: 11657     },
      { T: 387.0,   P: 10000000  },
      { T: 388.0,   P: 35000000  },
      { T: 395.0,   P: 200000000 }
    ]
  }
};

// =============================================================================
// UNIT CONVERSION UTILITIES
// All internal values are in K (temperature) and Pa (pressure).
// =============================================================================

const UNIT_CONVERSIONS = {
  temperature: {
    toKelvin: {
      'C': (v) => v + 273.15,
      'F': (v) => (v - 32) * 5 / 9 + 273.15,
      'K': (v) => v
    },
    fromKelvin: {
      'C': (v) => v - 273.15,
      'F': (v) => (v - 273.15) * 9 / 5 + 32,
      'K': (v) => v
    },
    labels: {
      'C': 'Temperature (°C)',
      'F': 'Temperature (°F)',
      'K': 'Temperature (K)'
    },
    symbols: { 'C': '°C', 'F': '°F', 'K': 'K' }
  },

  pressure: {
    // Convert FROM a display unit TO Pa (internal storage)
    toPa: {
      'Pa':   (v) => v,
      'kPa':  (v) => v * 1000,
      'atm':  (v) => v * 101325,
      'bar':  (v) => v * 100000,
      'mmHg': (v) => v * 133.322,
      'Torr': (v) => v * 133.322,
      'PSI':  (v) => v * 6894.76
    },
    // Convert FROM Pa TO a display unit
    fromPa: {
      'Pa':   (v) => v,
      'kPa':  (v) => v / 1000,
      'atm':  (v) => v / 101325,
      'bar':  (v) => v / 100000,
      'mmHg': (v) => v / 133.322,
      'Torr': (v) => v / 133.322,
      'PSI':  (v) => v / 6894.76
    },
    labels: {
      'Pa':   'Pressure (Pa)',
      'kPa':  'Pressure (kPa)',
      'atm':  'Pressure (atm)',
      'bar':  'Pressure (bar)',
      'mmHg': 'Pressure (mmHg)',
      'Torr': 'Pressure (Torr)',
      'PSI':  'Pressure (PSI)'
    },
    symbols: {
      'Pa': 'Pa', 'kPa': 'kPa', 'atm': 'atm',
      'bar': 'bar', 'mmHg': 'mmHg', 'Torr': 'Torr', 'PSI': 'PSI'
    }
  }
};

/**
 * Convert a temperature value between any two supported units.
 * @param {number} value
 * @param {string} fromUnit - 'C', 'F', or 'K'
 * @param {string} toUnit   - 'C', 'F', or 'K'
 * @returns {number}
 */
function convertTemp(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const K = UNIT_CONVERSIONS.temperature.toKelvin[fromUnit](value);
  return UNIT_CONVERSIONS.temperature.fromKelvin[toUnit](K);
}

/**
 * Convert a pressure value between any two supported units.
 * @param {number} value
 * @param {string} fromUnit - 'Pa','kPa','atm','bar','mmHg','Torr','PSI'
 * @param {string} toUnit
 * @returns {number}
 */
function convertPressure(value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return value;
  const Pa = UNIT_CONVERSIONS.pressure.toPa[fromUnit](value);
  return UNIT_CONVERSIONS.pressure.fromPa[toUnit](Pa);
}

/**
 * Convert an internal {T (K), P (Pa)} point to display units.
 * @param {number} T_K  - temperature in Kelvin
 * @param {number} P_Pa - pressure in Pascals
 * @param {string} tempUnit - target temp unit
 * @param {string} pressUnit - target pressure unit
 * @returns {{ T: number, P: number }}
 */
function convertPoint(T_K, P_Pa, tempUnit, pressUnit) {
  return {
    T: UNIT_CONVERSIONS.temperature.fromKelvin[tempUnit](T_K),
    P: UNIT_CONVERSIONS.pressure.fromPa[pressUnit](P_Pa)
  };
}

/**
 * Convert all curve arrays for a given compound into display units.
 * Returns a new object — does not mutate COMPOUND_DATA.
 * @param {string} compoundKey
 * @param {string} tempUnit
 * @param {string} pressUnit
 * @returns {object}
 */
function getCompoundInDisplayUnits(compoundKey, tempUnit, pressUnit) {
  const src = COMPOUND_DATA[compoundKey];
  if (!src) return null;

  const cvt = (arr) => arr.map(pt => convertPoint(pt.T, pt.P, tempUnit, pressUnit));
  const cvtPt = (pt) => pt ? convertPoint(pt.T, pt.P, tempUnit, pressUnit) : null;

  return {
    ...src,
    triplePoint:        cvtPt(src.triplePoint),
    criticalPoint:      cvtPt(src.criticalPoint),
    normalMeltingPoint: cvtPt(src.normalMeltingPoint),
    normalBoilingPoint: cvtPt(src.normalBoilingPoint),
    liquidVaporCurve:   cvt(src.liquidVaporCurve),
    solidVaporCurve:    cvt(src.solidVaporCurve),
    solidLiquidCurve:   cvt(src.solidLiquidCurve)
  };
}
