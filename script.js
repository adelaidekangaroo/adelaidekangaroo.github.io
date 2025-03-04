document.addEventListener("DOMContentLoaded", function() {

    function calculateExperience(start, now) {
        let years = now.getFullYear() - start.getFullYear();
        let months = now.getMonth() - start.getMonth();

        if (months < 0) {
            years--;
            months += 12;
        }

        return `${years} yrs ${months} mos`;
    }

    const start = new Date(2022, 6);
    const now = new Date();

    let experienceText = calculateExperience(start, now);

    document.querySelectorAll("#experienceDuration").forEach(el => {
        el.textContent = experienceText;
    });
});