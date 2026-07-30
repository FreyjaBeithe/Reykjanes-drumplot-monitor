const fs = require("fs");

const outputPath = "earth-movement-rates.json";
const trendDays = 90;

// Start with a small real station test set.
// Later we will add more station codes here gradually.
const stationCodes = [
    "seng",
    "gusk",
    "gjog",
    "afst",
    "moha",
    "akur",
    "alfd",
    "arho",
    "aust",
    "bald",
    "baug",
    "bjac",
    "bjtv",
    "brik",
    "brtt",
    "budh",
    "dync",
    "dyng",
    "dyny",
    "eldc",
    "eley",
    "entc",
    "fagc",
    "fagd",
    "fedg",
    "fefc",
    "fim2",
    "fjoc",
    "ftey",
    "gake",
    "gevk",
    "gfel",
    "gfum",
    "gigo",
    "gler",
    "gmey",
    "gola",
    "gonh",
    "gran",
    "grfs",
    "griv",
    "grvm",
    "grvv",
    "hafc",
    "hafs",
    "haud",
    "helc",
    "helf",
    "herv"
];

function getGnssDataUrl(stationCode) {
    // Builds the expected IMO/Vedur GNSS .NEU data URL for a station.
    // Example station code: SENG -> SENG-plate.NEU

    const code = String(stationCode || "").trim().toUpperCase();

    if (!code) {
        return null;
    }

    return "https://www.vedur.is/gogn/gps/timeseries/timeseries-fractional/" +
        code +
        "-plate.NEU";
}

function parseNeuLine(line) {
    // Parses one .NEU data line.
    // Format:
    // yyyy.dddd dN DN dE DE dU DU
    //
    // Returns:
    // year = fractional year
    // n = north displacement in mm
    // e = east displacement in mm
    // up = vertical displacement in mm

    const parts = String(line || "").trim().split(/\s+/);

    if (parts.length < 7) {
        return null;
    }

    const year = Number(parts[0]);
    const n = Number(parts[1]);
    const e = Number(parts[3]);
    const up = Number(parts[5]);

    if (
        isNaN(year) ||
        isNaN(n) ||
        isNaN(e) ||
        isNaN(up)
    ) {
        return null;
    }

    return {
        year: year,
        n: n,
        e: e,
        up: up
    };
}

function parseNeuText(text) {
    // Parses a full .NEU text file.
    // Keeps only valid data rows and ignores headers/comments/blank lines.

    const lines = String(text || "").split(/\r?\n/);
    const points = [];

    lines.forEach(function (line) {
        const point = parseNeuLine(line);

        if (point) {
            points.push(point);
        }
    });

    return points;
}

async function fetchGnssNeuPoints(stationCode) {
    // Fetches one IMO/Vedur .NEU station file from GitHub Actions.
    // This server-side fetch avoids browser CORS restrictions.

    const url = getGnssDataUrl(stationCode);

    if (!url) {
        return [];
    }

    try {
        const response = await fetch(url);

        if (!response.ok) {
            console.warn("GNSS fetch failed for", stationCode, response.status);
            return [];
        }

        const text = await response.text();
        return parseNeuText(text);
    } catch (error) {
        console.warn("GNSS fetch error for", stationCode, error);
        return [];
    }
}

function calculateTrendRate(points, days) {
    // Calculates N / E / Up trend rates over the requested window.
    // Input displacement values are in mm.
    // Output trend rates are annualised mm/yr.

    if (!points || points.length < 2) {
        return null;
    }

    const sortedPoints = points.slice().sort(function (a, b) {
        return a.year - b.year;
    });

    const latestPoint = sortedPoints[sortedPoints.length - 1];
    const targetStartYear = latestPoint.year - (days / 365.25);

    let startPoint = null;

    for (let i = sortedPoints.length - 1; i >= 0; i--) {
        if (sortedPoints[i].year <= targetStartYear) {
            startPoint = sortedPoints[i];
            break;
        }
    }

    if (!startPoint) {
        return null;
    }

    const yearSpan = latestPoint.year - startPoint.year;

    if (yearSpan <= 0) {
        return null;
    }

    return {
        n: (latestPoint.n - startPoint.n) / yearSpan,
        e: (latestPoint.e - startPoint.e) / yearSpan,
        up: (latestPoint.up - startPoint.up) / yearSpan,
        startYear: startPoint.year,
        endYear: latestPoint.year,
        daysApprox: yearSpan * 365.25
    };
}

function roundRate(value) {
    // Rounds trend rates to one decimal place for the JSON file.

    return Math.round(value * 10) / 10;
}

async function calculateStationRate(stationCode) {
    // Fetches and calculates one station's 90-day trend rate.

    const points = await fetchGnssNeuPoints(stationCode);

    console.log(stationCode.toUpperCase() + " parsed GNSS points:", points.length);

    if (points.length > 0) {
        console.log(stationCode.toUpperCase() + " latest parsed point:", points[points.length - 1]);
    }

    const trend = calculateTrendRate(points, trendDays);

    if (!trend) {
        console.warn(stationCode.toUpperCase() + " calculated 90-day trend: unavailable");
        return null;
    }

    const rate = {
        n: roundRate(trend.n),
        e: roundRate(trend.e),
        up: roundRate(trend.up),
        startYear: trend.startYear,
        endYear: trend.endYear,
        daysApprox: roundRate(trend.daysApprox)
    };

    console.log(stationCode.toUpperCase() + " calculated 90-day trend:", rate);

    return rate;
}

async function main() {
    const rates = {};

    for (const stationCode of stationCodes) {
        const rate = await calculateStationRate(stationCode);

        if (rate) {
            rates[stationCode.toLowerCase()] = rate;
        }
    }

    const earthMovementRates = {
        generatedAt: new Date().toISOString(),
        source: "IMO/Vedur GNSS .NEU files via VolcanoWatchers GitHub Action",
        trendDays: trendDays,
        rates: rates
    };

    fs.writeFileSync(
        outputPath,
        JSON.stringify(earthMovementRates, null, 2) + "\n"
    );

    console.log("Earth Movement rates JSON written to", outputPath);
    console.log("Generated at", earthMovementRates.generatedAt);
    console.log("Stations written:", Object.keys(rates).join(", "));
}

main();
