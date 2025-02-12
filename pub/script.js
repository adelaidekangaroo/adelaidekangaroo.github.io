document.addEventListener("DOMContentLoaded", function () {
    const startDate = new Date(2022, 6);
    const currentDate = new Date();

    let years = currentDate.getFullYear() - startDate.getFullYear();
    let months = currentDate.getMonth() - startDate.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }

    document.getElementById("difference").textContent = `... ${years} yrs ${months} mos · (Aug 2022 - Present)`;
});
