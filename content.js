const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function waitForElement(selector, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(`Timeout waiting for ${selector}`);
        }, timeout);
    });
}

async function selectDropdownValue(selector, value, delayMs = 50) {
    const dropdown = await waitForElement(selector);
    if (!dropdown) return false;

    dropdown.focus();
    dropdown.click();
    await delay(delayMs);

    const option = [...dropdown.options].find(o => o.value === value);
    if (!option) return false;

    option.selected = true;
    await delay(delayMs);

    dropdown.dispatchEvent(new Event('input', { bubbles: true }));
    dropdown.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
}

async function typeIntoInput(selector, value, options = {}) {
    const { delayMs = 50, clearFirst = true } = options;
    const input = await waitForElement(selector);
    if (!input) return false;

    input.focus();

    if (clearFirst) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    for (const char of String(value)) {
        // Only trigger key events; do NOT modify input.value manually
        input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keypress', { key: char, bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
        await delay(delayMs);
    }

    // Ensure the input ends with the correct final value
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
}




async function setCheckbox(selector, checked = true) {
    const checkbox = await waitForElement(selector);
    if (!checkbox) return false;

    if (checkbox.checked !== checked) {
        checkbox.focus();
        checkbox.click();

        checkbox.dispatchEvent(new Event('input', { bubbles: true }));
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return true;
}

async function clickElement(selector, options = {}) {
    const {
        wait = true,
        delayMs = 0
    } = options;

    const el = wait
        ? await waitForElement(selector)
        : document.querySelector(selector);

    if (!el) return false;

    el.focus();
    el.click();

    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    if (delayMs) await delay(delayMs);

    return true;
}




(function () {
    const host = location.hostname;
    console.log("Host: ", host)
    if (host.includes('recreation.gov')) {
        runRecreationGov();
    } else if (host.includes('reservecalifornia.com')) {
        reservecalifornia();
    }
})();
