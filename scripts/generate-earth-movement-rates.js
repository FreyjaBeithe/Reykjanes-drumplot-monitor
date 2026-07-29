const fs = require("fs");

const outputPath = "earth-movement-rates.json";

const earthMovementRates = {
    generatedAt: new Date().toISOString(),
    source: "Temporary VolcanoWatchers test data - not real GNSS data",
    trendDays: 90,
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
