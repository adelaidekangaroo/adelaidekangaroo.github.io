document.addEventListener("DOMContentLoaded", function () {
    const term = document.getElementById("term");
    const screen = document.getElementById("screen");
    const titlebar = document.getElementById("titlebar");
    const shell = document.getElementById("shell");
    const input = document.getElementById("cmd");
    const cmdlineGhost = document.getElementById("cmdline-ghost");
    const log = document.getElementById("shell-log");
    const dock = document.getElementById("dock");
    const menuBtn = document.getElementById("shell-menu-btn");
    const dropdown = document.getElementById("shell-menu");
    const clock = document.getElementById("clock");
    const loginTime = document.getElementById("login-time");

    const THEMES = ["pro", "homebrew", "ocean", "novel", "manpage", "retro"];
    let sectionIds = [];
    let links = {};
    let profile = null;
    const COMMANDS = [
        "help", "man", "ls", "open", "cd", "cat", "whoami", "cvfetch", "neofetch",
        "theme", "clear", "history", "echo", "mail", "date", "pwd", "hostname",
        "exit", "sudo", "vim", "rm", "uname", "pdf"
    ];
    const ALIASES = {
        about: "aboutme",
        contact: "contacts",
        contacts: "contacts",
        loc: "location",
        jobs: "experience",
        work: "experience",
        edu: "education",
        pubs: "publications",
        certs: "certifications",
        pets: "petprojects",
        projects: "petprojects"
    };

    let ps1Text = "";
    let totalExperienceText = "";
    let cmdHistory = loadHistory();
    let histCursor = -1;
    let draft = "";

    initChrome();
    initTheme();
    initWindow();
    loadCv();

    function loadCv() {
        fetch("cv.json")
            .then(function (res) {
                if (!res.ok) throw new Error(String(res.status));
                return res.json();
            })
            .then(function (data) {
                profile = data;
                sectionIds = (data.sections || []).map(function (section) { return section.id; });
                links = Object.assign({}, data.links || {});
                if (data.email) links.mail = "mailto:" + data.email;
                applyPrompt(data);
                renderCv(data);
                initNav();
                initShell();
                input.focus();
                const hash = location.hash.slice(1);
                if (sectionIds.includes(hash)) reveal(hash);
            })
            .catch(function () {
                const note = document.createElement("p");
                note.className = "hint";
                note.textContent = "не удалось прочитать cv.json";
                document.getElementById("cv").append(note);
                initShell();
                input.focus();
            });
    }

    function applyPrompt(data) {
        ps1Text = data.user + "@" + data.host + " ~ $";
        document.documentElement.style.setProperty("--ps1", JSON.stringify(ps1Text + " "));
        document.querySelectorAll(".ps1-full").forEach(function (el) {
            el.textContent = ps1Text;
        });
        const title = document.getElementById("window-title");
        if (title) title.textContent = "cv — zsh — " + data.user;
    }

    function renderCv(data) {
        totalExperienceText = ruDuration(totalMonths(data));
        const root = document.getElementById("cv");
        root.replaceChildren();

        const help = document.createElement("div");
        help.append(command("help"));
        const header = document.createElement("header");
        const nav = document.createElement("nav");
        data.sections.forEach(function (section) {
            const link = document.createElement("a");
            link.href = "#" + section.id;
            link.textContent = section.id;
            nav.append(link);
        });
        header.append(nav);
        help.append(header);
        root.append(help);

        data.sections.forEach(function (section) {
            root.append(renderSection(section));
        });
    }

    function renderSection(section) {
        const el = document.createElement("section");
        el.id = section.id;
        el.append(command(section.id));
        (section.blocks || []).forEach(function (block, index) {
            if (block.type === "job") {
                el.append(separator(index > 0));
                el.append(renderJob(block));
            } else {
                if (index > 0) el.append(separator(true));
                el.append(renderLines(block.lines || []));
            }
        });
        return el;
    }

    function renderJob(job) {
        const wrap = document.createDocumentFragment();
        const head = document.createElement("div");
        head.className = "highlight";
        const list = document.createElement("ul");
        (job.head || []).forEach(function (line) {
            const li = document.createElement("li");
            li.append("... ", headText(line));
            list.append(li);
        });
        head.append(list);
        wrap.append(head, separator(false));
        (job.fields || []).forEach(function (field) {
            const label = document.createElement("div");
            label.className = "highlight";
            label.textContent = "... " + field.label + ":";
            wrap.append(label, document.createTextNode(" " + field.text + " "), document.createElement("br"));
        });
        if (job.achievements && job.achievements.length) {
            const label = document.createElement("div");
            label.className = "highlight";
            label.textContent = "... Main achievements:";
            const items = document.createElement("ul");
            job.achievements.forEach(function (text, index) {
                const li = document.createElement("li");
                li.textContent = (index + 1) + ". " + text;
                items.append(li);
            });
            wrap.append(label, items);
        }
        return wrap;
    }

    function headText(line) {
        if (!line || typeof line === "string") return document.createTextNode(line || "");
        if (!line.from) return document.createTextNode("");
        return document.createTextNode(formatMonths(monthsBetween(line.from, line.to)) + (line.suffix || ""));
    }

    function totalMonths(data) {
        let months = 0;
        (data.sections || []).forEach(function (section) {
            (section.blocks || []).forEach(function (block) {
                if (block.type !== "job") return;
                (block.head || []).forEach(function (line) {
                    if (line && line.from) months += monthsBetween(line.from, line.to);
                });
            });
        });
        return months;
    }

    function monthsBetween(from, to) {
        const start = from.split("-").map(Number);
        let endYear;
        let endMonth;
        if (to) {
            const end = to.split("-").map(Number);
            endYear = end[0];
            endMonth = end[1];
        } else {
            const now = new Date();
            endYear = now.getFullYear();
            endMonth = now.getMonth() + 1;
        }
        let months = (endYear - start[0]) * 12 + (endMonth - start[1]);
        if (to) months += 1;
        return Math.max(0, months);
    }

    function formatMonths(months) {
        const years = Math.floor(months / 12);
        const rest = months % 12;
        return years + (years === 1 ? " yr " : " yrs ") + rest + (rest === 1 ? " mo" : " mos");
    }

    function ruDuration(total) {
        const years = Math.floor(total / 12);
        const months = total % 12;
        const parts = [];
        if (years) parts.push(ruUnit(years, "год", "года", "лет"));
        if (months) parts.push(ruUnit(months, "месяц", "месяца", "месяцев"));
        return parts.join(" ") || "0 месяцев";
    }

    function ruUnit(n, one, few, many) {
        const n10 = n % 10;
        const n100 = n % 100;
        if (n10 === 1 && n100 !== 11) return n + " " + one;
        if (n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return n + " " + few;
        return n + " " + many;
    }

    function renderLines(lines) {
        const list = document.createElement("ul");
        lines.forEach(function (line) {
            const li = document.createElement("li");
            li.append("... ");
            appendRich(li, line);
            list.append(li);
        });
        return list;
    }

    const ICONS = {
        "fa-telegram": "M9.04 15.3 8.7 19.6c.46 0 .66-.2.9-.44l2.16-2.07 4.48 3.29c.82.45 1.4.21 1.62-.76l2.94-13.84h.01c.26-1.22-.44-1.7-1.24-1.4L2.3 10.1c-1.18.46-1.16 1.12-.2 1.42l4.6 1.43L17.38 6.2c.5-.32.96-.14.58.18",
        "fa-linkedin": "M4.98 3.5A2.5 2.5 0 1 1 2.5 1a2.5 2.5 0 0 1 2.48 2.5zM.5 8.5h4V24h-4V8.5zM8.5 8.5h3.8v2.1h.06c.53-1 1.84-2.1 3.78-2.1 4.06 0 4.81 2.67 4.81 6.14V24h-4v-7.7c0-1.84-.03-4.2-2.56-4.2-2.56 0-2.95 2-2.95 4.06V24h-4V8.5z",
        "fa-envelope": "M1.5 4.5h21v15h-21v-15zm1.7 1.6 8.8 6.4 8.8-6.4H3.2zm17.1 11.8V8.2l-8.3 6-8.3-6v9.7h16.6z",
        "fa-github": "M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3z"
    };

    function contactIcon(names) {
        const key = names.split(/\s+/).filter(function (name) { return ICONS[name]; })[0];
        if (!key) return null;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.classList.add("contact-icon");
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", ICONS[key]);
        svg.append(path);
        return svg;
    }

    function appendRich(parent, node) {
        if (node == null) return;
        if (typeof node === "string") {
            parent.append(node);
            return;
        }
        if (node.parts) {
            node.parts.forEach(function (part) { appendRich(parent, part); });
            return;
        }
        if (node.icon) {
            const icon = contactIcon(node.icon);
            if (icon) parent.append(icon, " ");
        }
        if (node.totalExperience) {
            const text = totalExperienceText;
            if (node.mark) {
                const mark = document.createElement("u");
                mark.textContent = text;
                parent.append(mark);
            } else {
                parent.append(text);
            }
            return;
        }
        if (node.mark) {
            const mark = document.createElement("u");
            mark.textContent = node.text || "";
            parent.append(mark);
            return;
        }
        if (node.href) {
            const link = document.createElement("a");
            link.href = node.href;
            link.textContent = node.label || node.href;
            parent.append(link);
            return;
        }
        if (node.text) parent.append(node.text);
    }

    function command(name) {
        const wrap = document.createDocumentFragment();
        const prompt = document.createElement("p");
        prompt.className = "command-line";
        const flag = document.createElement("div");
        flag.className = "cmd";
        flag.textContent = "-" + name;
        wrap.append(prompt, flag);
        return wrap;
    }

    function separator(large) {
        const line = document.createElement("span");
        line.className = large ? "separator_large" : "separator";
        return line;
    }

    function initChrome() {
        if (loginTime) {
            loginTime.textContent = formatLogin(new Date());
            loginTime.setAttribute("datetime", new Date().toISOString());
        }
        tickClock();
        setInterval(tickClock, 1000);

        menuBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            const open = menuBtn.getAttribute("aria-expanded") === "true";
            setMenu(!open);
        });
        dropdown.addEventListener("click", function (e) {
            const item = e.target.closest("[data-cmd], [data-theme]");
            if (!item) return;
            setMenu(false);
            if (item.dataset.theme) {
                run("theme " + item.dataset.theme);
            } else if (item.dataset.cmd) {
                run(item.dataset.cmd);
            }
            input.focus();
        });
        document.addEventListener("click", function () {
            setMenu(false);
        });
        document.addEventListener("keydown", function (e) {
            if (e.key === "Escape") setMenu(false);
        });
    }

    function tickClock() {
        clock.textContent = new Date().toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
    }

    function formatLogin(d) {
        const wd = d.toLocaleString("en-US", { weekday: "short" });
        const mo = d.toLocaleString("en-US", { month: "short" });
        const day = String(d.getDate()).padStart(2, " ");
        const time = d.toTimeString().slice(0, 8);
        return wd + " " + mo + " " + day + " " + time + " " + d.getFullYear();
    }

    function setMenu(open) {
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
        dropdown.hidden = !open;
        markTheme();
    }

    function initTheme() {
        let saved = "pro";
        try {
            saved = localStorage.getItem("cv-theme") || "pro";
        } catch (err) {
            saved = "pro";
        }
        if (!THEMES.includes(saved)) saved = "pro";
        applyTheme(saved);
    }

    function applyTheme(name) {
        term.dataset.theme = name;
        try {
            localStorage.setItem("cv-theme", name);
        } catch (err) {
            /* private mode */
        }
        markTheme();
    }

    function markTheme() {
        dropdown.querySelectorAll("[data-theme]").forEach(function (btn) {
            const on = btn.dataset.theme === term.dataset.theme;
            btn.querySelector(".check").textContent = on ? "✓" : "";
        });
    }

    function initWindow() {
        let drag = null;
        let resize = null;
        let moved = false;

        titlebar.addEventListener("pointerdown", function (e) {
            if (e.button !== 0) return;
            if (e.target.closest("button")) return;
            if (term.classList.contains("is-closed")) return;
            if (window.matchMedia("(max-width: 720px)").matches) return;
            const rect = term.getBoundingClientRect();
            drag = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, x: e.clientX, y: e.clientY };
            moved = false;
            titlebar.setPointerCapture(e.pointerId);
        });

        titlebar.addEventListener("pointermove", function (e) {
            if (!drag) return;
            if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) moved = true;
            const maxL = window.innerWidth - term.offsetWidth - 8;
            const maxT = window.innerHeight - 90;
            const left = Math.max(8, Math.min(e.clientX - drag.dx, maxL));
            const top = Math.max(36, Math.min(e.clientY - drag.dy, maxT));
            term.classList.add("is-dragged");
            term.style.left = left + "px";
            term.style.top = top + "px";
            term.style.right = "auto";
            term.style.margin = "0";
            term.style.transform = "none";
        });

        function endDrag() {
            drag = null;
        }
        titlebar.addEventListener("pointerup", endDrag);
        titlebar.addEventListener("pointercancel", endDrag);

        term.querySelectorAll(".resize").forEach(function (handle) {
            handle.addEventListener("pointerdown", function (e) {
                if (e.button !== 0) return;
                if (term.classList.contains("is-closed") || term.classList.contains("is-min")) return;
                if (window.matchMedia("(max-width: 720px)").matches) return;
                e.preventDefault();
                e.stopPropagation();
                const rect = term.getBoundingClientRect();
                term.classList.add("is-resized");
                term.classList.remove("is-small", "is-max");
                pinWindow(rect);
                resize = {
                    edge: handle.dataset.edge,
                    x: e.clientX,
                    y: e.clientY,
                    left: rect.left,
                    top: rect.top,
                    width: rect.width,
                    height: rect.height
                };
                handle.setPointerCapture(e.pointerId);
                document.body.style.cursor = handle.style.cursor || getComputedStyle(handle).cursor;
            });
        });

        document.addEventListener("pointermove", function (e) {
            if (!resize) return;
            applyResize(e.clientX, e.clientY);
        });
        document.addEventListener("pointerup", endResize);
        document.addEventListener("pointercancel", endResize);

        titlebar.addEventListener("dblclick", function (e) {
            if (e.target.closest("button")) return;
            if (moved) return;
            if (term.classList.contains("is-min")) showWindow();
            else toggleZoom();
        });

        document.getElementById("btn-close").addEventListener("click", closeWindow);
        document.getElementById("btn-min").addEventListener("click", minimizeWindow);
        document.getElementById("btn-zoom").addEventListener("click", toggleZoom);
        dock.addEventListener("click", function () {
            bounceDock();
            if (term.classList.contains("is-min") || term.classList.contains("is-closed")) {
                showWindow();
            } else {
                input.focus();
            }
        });

        function pinWindow(rect) {
            term.style.left = rect.left + "px";
            term.style.top = rect.top + "px";
            term.style.right = "auto";
            term.style.margin = "0";
            term.style.transform = "none";
            term.style.width = rect.width + "px";
            term.style.height = rect.height + "px";
        }

        function applyResize(clientX, clientY) {
            const dx = clientX - resize.x;
            const dy = clientY - resize.y;
            const edge = resize.edge;
            const minW = 320;
            const minH = 180;
            const minL = 8;
            const minT = 36;
            const maxR = window.innerWidth - 8;
            const maxB = window.innerHeight - 78;
            let left = resize.left;
            let top = resize.top;
            let width = resize.width;
            let height = resize.height;
            if (edge.indexOf("e") !== -1) width = resize.width + dx;
            if (edge.indexOf("s") !== -1) height = resize.height + dy;
            if (edge.indexOf("w") !== -1) {
                width = resize.width - dx;
                left = resize.left + dx;
            }
            if (edge.indexOf("n") !== -1) {
                height = resize.height - dy;
                top = resize.top + dy;
            }
            if (width < minW) {
                if (edge.indexOf("w") !== -1) left -= minW - width;
                width = minW;
            }
            if (height < minH) {
                if (edge.indexOf("n") !== -1) top -= minH - height;
                height = minH;
            }
            if (left < minL) {
                width -= minL - left;
                left = minL;
            }
            if (top < minT) {
                height -= minT - top;
                top = minT;
            }
            if (left + width > maxR) {
                if (edge.indexOf("w") !== -1) left -= left + width - maxR;
                else width = maxR - left;
            }
            if (top + height > maxB) {
                if (edge.indexOf("n") !== -1) top -= top + height - maxB;
                else height = maxB - top;
            }
            term.style.left = Math.round(left) + "px";
            term.style.top = Math.round(top) + "px";
            term.style.width = Math.round(Math.max(minW, width)) + "px";
            term.style.height = Math.round(Math.max(minH, height)) + "px";
        }

        function endResize() {
            if (!resize) return;
            resize = null;
            term.classList.remove("is-resized");
            document.body.style.cursor = "";
        }
    }

    function bounceDock() {
        dock.classList.remove("bounce");
        void dock.offsetWidth;
        dock.classList.add("bounce");
    }

    function toggleZoom() {
        if (term.classList.contains("is-min") || term.classList.contains("is-closed")) return;
        term.style.left = "";
        term.style.top = "";
        term.style.right = "";
        term.style.margin = "";
        term.style.width = "";
        term.style.height = "";
        term.style.transform = "";
        if (term.classList.contains("is-max")) {
            term.classList.remove("is-max");
            term.classList.add("is-small");
        } else if (term.classList.contains("is-small")) {
            term.classList.remove("is-small");
        } else {
            term.classList.add("is-max");
        }
    }

    function minimizeWindow() {
        if (term.classList.contains("is-closed")) return;
        if (term.classList.contains("is-min")) {
            showWindow();
            return;
        }
        term.classList.add("is-min");
        bounceDock();
    }

    function closeWindow() {
        if (term.classList.contains("is-closed")) return;
        term.classList.add("is-closed");
        dock.classList.add("is-off");
    }

    function showWindow() {
        term.classList.remove("is-min", "is-closed");
        dock.classList.remove("is-off");
        input.focus();
    }

    function initNav() {
        document.querySelectorAll('a[href^="http"]').forEach(function (link) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
        });

        document.querySelectorAll("nav a").forEach(function (link) {
            link.addEventListener("click", function (e) {
                const id = (link.getAttribute("href") || "").slice(1);
                if (!document.getElementById(id)) return;
                e.preventDefault();
                historyPush("open " + id);
                printEntry("open " + id, "→ #" + id);
                reveal(id);
            });
        });

        if ("IntersectionObserver" in window) {
            const obs = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (!entry.isIntersecting) return;
                    document.querySelectorAll("nav a").forEach(function (link) {
                        link.classList.toggle("active", link.getAttribute("href") === "#" + entry.target.id);
                    });
                });
            }, { root: screen, rootMargin: "-15% 0px -65% 0px", threshold: 0.01 });
            sectionIds.forEach(function (id) {
                const el = document.getElementById(id);
                if (el) obs.observe(el);
            });
        }
    }

    function reveal(id) {
        const el = document.getElementById(id);
        if (!el) return false;
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.remove("flash");
        void el.offsetWidth;
        el.classList.add("flash");
        if (window.history.replaceState) {
            window.history.replaceState(null, "", "#" + id);
        }
        return true;
    }

    let caretIndex = 0;

    function syncCaret() {
        if (document.activeElement === input && input.selectionStart != null) {
            caretIndex = input.selectionStart;
        }
        caretIndex = Math.min(caretIndex, input.value.length);
        cmdlineGhost.textContent = input.value.slice(0, caretIndex);
    }

    function initShell() {
        shell.addEventListener("submit", function (e) {
            e.preventDefault();
            const raw = input.value;
            input.value = "";
            caretIndex = 0;
            histCursor = -1;
            draft = "";
            syncCaret();
            run(raw);
        });

        input.addEventListener("input", syncCaret);
        input.addEventListener("keyup", syncCaret);
        input.addEventListener("click", syncCaret);
        input.addEventListener("focus", syncCaret);
        document.addEventListener("selectionchange", function () {
            if (document.activeElement === input) syncCaret();
        });
        syncCaret();

        input.addEventListener("keydown", function (e) {
            if (e.key === "Tab") {
                e.preventDefault();
                complete();
                return;
            }
            if (e.key === "ArrowUp") {
                e.preventDefault();
                travel(-1);
                return;
            }
            if (e.key === "ArrowDown") {
                e.preventDefault();
                travel(1);
                return;
            }
            if (e.ctrlKey && (e.key === "l" || e.key === "L")) {
                e.preventDefault();
                clearLog();
                return;
            }
            if (e.ctrlKey && (e.key === "c" || e.key === "C")) {
                e.preventDefault();
                printEntry(input.value + "^C", "");
                input.value = "";
                caretIndex = 0;
                histCursor = -1;
                syncCaret();
            }
        });

        document.addEventListener("keydown", function (e) {
            if (e.target === input) return;
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            if ((term.classList.contains("is-min") || term.classList.contains("is-closed")) && e.key.length === 1) {
                showWindow();
            }
            if (e.key.length === 1 && !e.target.closest("input, textarea, button")) {
                input.focus();
                input.value += e.key;
                caretIndex = input.value.length;
                syncCaret();
                e.preventDefault();
            }
        });

        screen.addEventListener("mouseup", function (e) {
            if (e.target.closest("a, button")) return;
            const sel = window.getSelection();
            if (sel && !sel.isCollapsed) return;
            input.focus();
        });
    }

    function travel(dir) {
        if (!cmdHistory.length) return;
        if (dir < 0) {
            if (histCursor === -1) {
                draft = input.value;
                histCursor = cmdHistory.length - 1;
            } else if (histCursor > 0) {
                histCursor--;
            }
            input.value = cmdHistory[histCursor];
            caretIndex = input.value.length;
            syncCaret();
            return;
        }
        if (histCursor === -1) return;
        histCursor++;
        if (histCursor >= cmdHistory.length) {
            histCursor = -1;
            input.value = draft;
        } else {
            input.value = cmdHistory[histCursor];
        }
        caretIndex = input.value.length;
        syncCaret();
    }

    function normalizeLine(line) {
        const text = line.trim();
        if (/^cv$/i.test(text)) return "help";
        const prefixed = text.match(/^cv\s+-\s*([\s\S]*)$/i) || text.match(/^cv\s+([\s\S]*)$/i);
        if (!prefixed) return text;
        return prefixed[1].trim() || "help";
    }

    function splitInput(value) {
        if (/^cv$/i.test(value)) return { head: "cv -", rest: "" };
        const dashed = value.match(/^cv\s+-\s*/i);
        if (dashed) return { head: "cv -", rest: value.slice(dashed[0].length) };
        const plain = value.match(/^cv\s+/i);
        if (plain) return { head: "cv -", rest: value.slice(plain[0].length) };
        return { head: "", rest: value };
    }

    function complete() {
        const split = splitInput(input.value);
        const matches = completionsFor(split.rest, !!split.head);
        if (!matches.length) {
            bell();
            return;
        }
        let next = split.rest;
        if (matches.length === 1) {
            next = replaceToken(split.rest, matches[0], true);
        } else {
            const prefix = commonPrefix(matches);
            if (prefix) next = replaceToken(split.rest, prefix, false);
            if (next === split.rest) {
                printEntry(input.value, matches.join("   "));
                return;
            }
        }
        input.value = split.head + next;
        caretIndex = input.value.length;
        syncCaret();
    }

    function completionsFor(value, withSections) {
        const trailing = /\s$/.test(value);
        const parts = value.trim().split(/\s+/).filter(Boolean);
        const pool = COMMANDS.concat(withSections ? sectionIds.filter(function (id) {
            return COMMANDS.indexOf(id) === -1;
        }) : []);
        if (!parts.length) return pool;
        if (parts.length === 1 && !trailing) {
            return pool.filter(function (c) { return c.startsWith(parts[0]); });
        }
        const cmd = parts[0];
        const partial = trailing ? "" : (parts[1] || "");
        let nextPool = [];
        if (cmd === "open" || cmd === "cd" || cmd === "cat") {
            nextPool = sectionIds.concat(Object.keys(links));
        } else if (cmd === "theme") {
            nextPool = THEMES.slice();
        } else {
            return [];
        }
        if (parts.length > 2 && !trailing) return [];
        if (parts.length > 2) return [];
        return nextPool.filter(function (item) { return item.startsWith(partial); });
    }

    function replaceToken(value, token, done) {
        const trailing = /\s$/.test(value);
        const parts = value.trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return token + (done ? " " : "");
        if (parts.length === 1 && !trailing) parts[0] = token;
        else if (trailing) parts.push(token);
        else parts[parts.length - 1] = token;
        return parts.join(" ") + (done ? " " : "");
    }

    function commonPrefix(items) {
        if (!items.length) return "";
        let prefix = items[0];
        for (let i = 1; i < items.length; i++) {
            while (!items[i].startsWith(prefix)) {
                prefix = prefix.slice(0, -1);
                if (!prefix) return "";
            }
        }
        return prefix;
    }

    function run(raw) {
        const line = raw.trim();
        if (!line) {
            printEntry("", null);
            return;
        }
        historyPush(line);
        const normalized = normalizeLine(line);
        const parts = normalized.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg = parts.slice(1).join(" ");
        const out = dispatch(cmd, arg, parts.slice(1));
        if (out === undefined) return;
        printEntry(line, out.text, out.error, out.top);
        if (out.top) screen.scrollTo({ top: 0, behavior: "auto" });
        if (out.reveal) reveal(out.reveal);
        if (out.bell) bell();
    }

    function dispatch(cmd, arg) {
        switch (cmd) {
            case "help":
            case "man":
                return { text: helpText() };
            case "ls":
                return { text: sectionIds.join("   ") };
            case "open":
            case "cd":
            case "cat":
                return openThing(arg);
            case "whoami":
                return { text: (profile && profile.whoami || []).join("\n") };
            case "hostname":
                return { text: profile ? profile.host : "" };
            case "pwd":
                return { text: profile ? "/Users/" + profile.user + "/cv" : "" };
            case "date":
                return { text: new Date().toString() };
            case "uname":
                return { text: "Darwin " + (profile ? profile.host : "") + " 25.0.0 CV_XNU Terminal" };
            case "cvfetch":
            case "neofetch":
                return { text: fetchText() };
            case "theme":
                return setThemeCmd(arg.trim());
            case "clear":
                clearLog();
                return undefined;
            case "history":
                return { text: cmdHistory.map(function (item, i) {
                    return String(i + 1).padStart(4, " ") + "  " + item;
                }).join("\n") || "(empty)" };
            case "echo":
                return { text: arg };
            case "mail":
                copyMail();
                return { text: "copied " + (profile ? profile.email : "") };
            case "exit":
                closeWindow();
                return { text: "[Process completed]" };
            case "pdf":
                return { text: exportPdf() };
            case "sudo":
                return { text: (profile ? profile.user : "user") + " is not in the sudoers file. this incident will be reported.", error: true };
            case "vim":
            case "nvim":
                return { text: "already inside the only editor that ships a résumé. try help." };
            case "rm":
                return { text: "rm: permission denied, résumé is read-only", error: true, bell: true };
            default:
                if (sectionIds.includes(cmd) || ALIASES[cmd]) {
                    return openThing(cmd);
                }
                return { text: "zsh: command not found: " + cmd + "\ntry help", error: true, bell: true };
        }
    }

    function openThing(arg) {
        const key = (arg || "").trim().toLowerCase();
        if (!key) return { text: "usage: open <section|telegram|linkedin|github>", error: true };
        if (links[key]) {
            window.open(links[key], "_blank", "noopener");
            return { text: "opened " + key };
        }
        const id = ALIASES[key] || key;
        if (sectionIds.includes(id)) {
            return { text: "→ #" + id, reveal: id };
        }
        return { text: "no such section: " + key, error: true, bell: true };
    }

    function setThemeCmd(name) {
        if (!name) return { text: "theme is " + term.dataset.theme + "\n" + THEMES.join("   ") };
        if (!THEMES.includes(name)) {
            return { text: "no such theme: " + name + "\n" + THEMES.join("   "), error: true, bell: true };
        }
        applyTheme(name);
        return { text: "theme → " + name, top: true };
    }

    let pdfBusy = false;

    function exportPdf() {
        if (pdfBusy) return "PDF уже собирается…";
        const cv = document.getElementById("cv");
        if (!cv || !cv.childElementCount) return "резюме ещё не загрузилось";
        pdfBusy = true;
        const filename = "Sergey-Simonov-CV.pdf";
        buildPdf(cv, filename).then(function () {
            reportPdf("скачан " + filename, false);
        }).catch(function () {
            reportPdf("не удалось скачать PDF", true);
        }).finally(function () {
            pdfBusy = false;
        });
        return "скачиваю " + filename + "…";
    }

    function reportPdf(text, isError) {
        const outs = log.querySelectorAll(".entry-out");
        const last = outs[outs.length - 1];
        if (last && last.textContent.indexOf("скачиваю ") === 0) {
            last.textContent = text;
            last.classList.toggle("is-error", !!isError);
            return;
        }
        printEntry("pdf", text, isError);
    }

    function loadHtml2Pdf() {
        if (window.html2pdf) return Promise.resolve();
        return new Promise(function (resolve, reject) {
            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
            script.onload = function () { resolve(); };
            script.onerror = function () { reject(new Error("html2pdf")); };
            document.head.append(script);
        });
    }

    function buildPdf(cv, filename) {
        const sheet = document.createElement("div");
        sheet.className = "pdf-sheet";
        sheet.append(cv.cloneNode(true));
        const prevBody = document.body.style.overflow;
        const prevHtml = document.documentElement.style.overflow;
        document.body.style.overflow = "visible";
        document.documentElement.style.overflow = "visible";
        document.body.append(sheet);
        return loadHtml2Pdf().then(function () {
            return window.html2pdf().set({
                margin: [12, 12, 14, 12],
                filename: filename,
                image: { type: "jpeg", quality: 0.95 },
                html2canvas: { scale: 2, backgroundColor: "#ffffff", windowWidth: 794 },
                jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
                pagebreak: { mode: ["css", "legacy"], avoid: [".command-line", ".highlight"] }
            }).from(sheet).outputPdf("blob");
        }).then(function (blob) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.append(link);
            link.click();
            link.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        }).finally(function () {
            sheet.remove();
            document.body.style.overflow = prevBody;
            document.documentElement.style.overflow = prevHtml;
        });
    }

    function helpText() {
        return [
            "cv — интерактивное резюме. резюме выше, шелл внизу.",
            "команды как на экране: cv -aboutme, cv -help. голое имя тоже работает.",
            "",
            "  help                 эта справка",
            "  ls                   список разделов",
            "  open <section>       перейти к разделу",
            "  whoami               кто я",
            "  cvfetch              сводка",
            "  theme <name>         pro | homebrew | ocean | novel | manpage | retro",
            "  mail                 скопировать email",
            "  pdf                  скачать резюме файлом PDF",
            "  open telegram        внешние ссылки: telegram | linkedin | github",
            "  clear                очистить вывод команд   (ctrl+l)",
            "  history              история                 (↑ ↓)",
            "  exit                 закрыть окно",
            "",
            "окно можно тащить за шапку, двойной клик разворачивает.",
            "tab дополняет команды и разделы."
        ].join("\n");
    }

    function fetchText() {
        const card = (profile && profile.summary) || {};
        const user = profile ? profile.user : "";
        const host = profile ? profile.host : "";
        return [
            "  ┌───┐   " + (card.title || (user + "@" + host)),
            "  │ >_│   ------------------",
            "  └───┘   role      " + (card.role || ""),
            "          location  " + (card.location || ""),
            "          company   " + (card.company || ""),
            "          focus     " + (card.focus || ""),
            "          theme     " + term.dataset.theme,
            "          contact   " + (profile ? profile.email : "")
        ].join("\n");
    }

    function copyMail() {
        const email = profile ? profile.email : "";
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(email).catch(function () {});
        }
    }

    function clearLog() {
        log.replaceChildren();
        screen.scrollTo({ top: 0, behavior: "smooth" });
    }

    function historyPush(line) {
        if (!line || cmdHistory[cmdHistory.length - 1] === line) return;
        cmdHistory.push(line);
        if (cmdHistory.length > 80) cmdHistory.shift();
        try {
            sessionStorage.setItem("cv-history", JSON.stringify(cmdHistory));
        } catch (err) {
            /* ignore */
        }
    }

    function loadHistory() {
        try {
            const raw = JSON.parse(sessionStorage.getItem("cv-history") || "[]");
            return Array.isArray(raw) ? raw.filter(function (item) { return typeof item === "string"; }) : [];
        } catch (err) {
            return [];
        }
    }

    function printEntry(command, text, isError, stay) {
        const entry = document.createElement("div");
        entry.className = "entry";

        const cmd = document.createElement("div");
        cmd.className = "entry-cmd";
        const ps = document.createElement("span");
        ps.className = "ps1";
        ps.textContent = ps1Text + " ";
        cmd.append(ps, document.createTextNode(command));
        entry.append(cmd);

        if (text) {
            const out = document.createElement("div");
            out.className = "entry-out" + (isError ? " is-error" : "");
            out.textContent = text;
            entry.append(out);
        }

        log.append(entry);
        if (!stay) entry.scrollIntoView({ block: "nearest" });
    }

    function bell() {
        shell.classList.remove("shake");
        void shell.offsetWidth;
        shell.classList.add("shake");
    }
});
