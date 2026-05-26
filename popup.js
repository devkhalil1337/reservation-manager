const BUILD_NUMBER = 9;

let SITE_KEY = null;

function showVersionInfo() {
    const el = document.getElementById('versionInfo');
    if (!el) return;

    const version = chrome.runtime.getManifest().version;
    el.textContent = `v${version} · Build ${BUILD_NUMBER}`;
}

const fields = {
    numberOfDays: document.getElementById('numberOfDays'),
    people: document.getElementById('people'),
    vehicles: document.getElementById('vehicles'),
    trailerLength: document.getElementById('trailerLength'),
    passType: document.getElementById('passType'),
    passNumber: document.getElementById('passNumber')
};

function loadFormData(siteKey) {
    chrome.storage.sync.get(siteKey, data => {
        const cfg = data[siteKey] || {};

        fields.numberOfDays.value = cfg.numberOfDays ?? 2;
        fields.people.value = cfg.people ?? 1;
        fields.vehicles.value = cfg.vehicles ?? 0;
        fields.trailerLength.value = cfg.trailerLength ?? 25;
        fields.passType.value = 'Interagency Lifetime Senior Pass';
        fields.passNumber.value = cfg.passNumber ?? '';
    });
}

function showSavedMessage() {
    const el = document.getElementById('saveStatus');
    if (!el) return;

    el.style.display = 'block';
    el.textContent = '✅ Saved successfully';

    setTimeout(() => {
        el.style.display = 'none';
    }, 2000);
}


// 🔹 Load data when popup opens
document.addEventListener('DOMContentLoaded', () => {
    showVersionInfo();

    chrome.storage.sync.get('LAST_SITE_KEY', data => {
        if (data.LAST_SITE_KEY) {
            SITE_KEY = data.LAST_SITE_KEY;
            loadFormData(SITE_KEY);
        }
    });
});

// 🔹 Receive site key dynamically
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.siteKey) {
        SITE_KEY = msg.siteKey;

        chrome.storage.sync.set({ LAST_SITE_KEY: SITE_KEY });
        loadFormData(SITE_KEY);

        console.log('[RM] Popup received site key:', SITE_KEY);
    }
});

// 🔹 Save button
document.getElementById('saveReservation').addEventListener('click', () => {
    if (!SITE_KEY) return;

    chrome.storage.sync.set({
        [SITE_KEY]: {
            numberOfDays: Number(fields.numberOfDays.value),
            people: Number(fields.people.value),
            vehicles: Number(fields.vehicles.value),
            trailerLength: Number(fields.trailerLength.value),
            passType: "Interagency Lifetime Senior Pass",
            passNumber: fields.passNumber.value
        }
    }, () => {
        // ✅ Show confirmation after save completes
        showSavedMessage();
    });
});
