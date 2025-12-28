let SITE_KEY = null;

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.siteKey) {
        SITE_KEY = msg.siteKey;
        console.log('[RM] Popup received site key:', SITE_KEY);

        // Load saved config
        chrome.storage.sync.get(SITE_KEY, data => {
            const cfg = data[SITE_KEY] || {};

            numberOfDays.value = cfg.numberOfDays ?? 2;
            people.value = cfg.people ?? 1;
            vehicles.value = cfg.vehicles ?? 0;
            trailerLength.value = cfg.trailerLength ?? 25;
            passType.value = cfg.passType ?? '';
            passNumber.value = cfg.passNumber ?? '';
        });
    }
});

// Save button
document.getElementById('saveReservation').addEventListener('click', () => {
    if (!SITE_KEY) return;
    chrome.storage.sync.set({
        [SITE_KEY]: {
            numberOfDays: Number(numberOfDays.value),
            people: Number(people.value),
            vehicles: Number(vehicles.value),
            trailerLength: Number(trailerLength.value),
            passType: passType.value,
            passNumber: passNumber.value
        }
    });
});
