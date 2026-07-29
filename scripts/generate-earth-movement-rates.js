const fs = require("fs");

const outputPath = "earth-movement-rates.json";
const trendDays = 90;

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

async function main() {
    const sengPoints = await fetchGnssNeuPoints("seng");

    console.log("SENG parsed GNSS points:", sengPoints.length);

    if (sengPoints.length > 0) {
        console.log("SENG latest parsed point:", sengPoints[sengPoints.length - 1]);
    }

    // Temporary output while we build the generator.
    // Real GNSS values will replace this in a later step.
    const earthMovementRates = {
        generatedAt: new Date().toISOString(),
        source: "Temporary VolcanoWatchers test data - not real GNSS data",
        trendDays: trendDays,
        rates: {
            seng: {
                n: 12.4,
                e: -3.1,
                up: 45.8
            }
        }
    };

    fs.writeFileSync(
        outputPath,
        JSON.stringify(earthMovementRates, null, 2) + "\n"
    );

    console.log("Earth Movement rates JSON written to", outputPath);
    console.log("Generated at", earthMovementRates.generatedAt);
    console.log("Future SENG GNSS URL:", getGnssDataUrl("seng"));
}

main();
