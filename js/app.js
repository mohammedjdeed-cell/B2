/**
 * TELC B2 Diskussionstrainer — Core Engine
 * Unified, Zero-Loss & Dynamic Scaffold
 */

(function () {
    "use strict";

    // 1. STATE STORE
    const state = {
        topics: [],            // Dynamic: 52, 55, 60+ topics
        activeIdx: 0,
        activeTab: "template", // "template" | "wortschatz" | "mindmap" | "redemittel" | "grammar" | "settings"
        learnedIds: new Set(),
        highlights: {},        // topicId -> { blockKey: html }
        vocabulary: {},        // topicId -> [ { de, en, ar, type, learned } ]
        redemittel: {},        // category -> [ { de, en } ]
        grammar: [],
        filter: "all",
        search: "",
        isEditMode: false,
        theme: localStorage.getItem("b2_theme_setting") || "system",
        voiceSpeed: parseFloat(localStorage.getItem("b2_voice_speed")) || 1.0,
        selectedVoice: localStorage.getItem("b2_selected_voice") || ""
    };

    const CONNECTORS = [
        "Meiner Meinung nach", "Ein weiteres großes Argument", "Zudem wird betont",
        "Ich betrachte", "Darüber hinaus", "Anstatt", "Was meine persönlichen Erfahrungen betrifft",
        "Vielleicht können wir uns darauf einigen", "Zusammenfassend lässt sich sagen",
        "weil", "da", "sodass", "Allerdings", "Einerseits", "andererseits"
    ];

    // 2. BACKWARD-COMPATIBLE DATA MIGRATION BRIDGE (ZERO DATA LOSS)
    function runMigrationBridge() {
        const suffix = "local"; // Support current and legacy profile storage

        // A. Migrate Learned Topics
        const legacyLearned = localStorage.getItem(`learned_topics_1_52_${suffix}`) || localStorage.getItem("b2_learned_topics");
        if (legacyLearned) {
            try {
                const parsed = JSON.parse(legacyLearned);
                if (Array.isArray(parsed)) parsed.forEach(id => state.learnedIds.add(Number(id)));
            } catch (e) { console.warn("Learned migration:", e); }
        }

        // B. Migrate Highlights
        const legacyHighlights = localStorage.getItem(`b2_highlights_${suffix}`) || localStorage.getItem("b2_highlights");
        if (legacyHighlights) {
            try {
                state.highlights = JSON.parse(legacyHighlights) || {};
            } catch (e) { console.warn("Highlights migration:", e); }
        }

        // C. Migrate Vocabulary
        const legacyVocab = localStorage.getItem(`b2_vocab_${suffix}`) || localStorage.getItem("b2_vocab");
        if (legacyVocab) {
            try {
                state.vocabulary = JSON.parse(legacyVocab) || {};
            } catch (e) { console.warn("Vocab migration:", e); }
        }

        // D. Migrate Redemittel
        const legacyRede = localStorage.getItem(`b2_redemittel_${suffix}`);
        if (legacyRede) {
            try {
                state.redemittel = JSON.parse(legacyRede) || {};
            } catch (e) { console.warn("Redemittel migration:", e); }
        }

        console.log("Migration Bridge executed: Existing notes, highlights & vocab preserved.");
    }

    // 3. DATA PERSISTENCE
    function persistState() {
        const suffix = "local";
        localStorage.setItem(`learned_topics_1_52_${suffix}`, JSON.stringify(Array.from(state.learnedIds)));
        localStorage.setItem(`b2_highlights_${suffix}`, JSON.stringify(state.highlights));
        localStorage.setItem(`b2_vocab_${suffix}`, JSON.stringify(state.vocabulary));
        localStorage.setItem(`edited_template_data_1_52_${suffix}`, JSON.stringify(state.topics));
    }

    // 4. AUDIO ENGINE (FIXES THE APOSTROPHE ' CRASH)
    const audio = {
        synth: window.speechSynthesis,
        activeBtn: null,

        play(text, buttonEl) {
            if (!text || !('speechSynthesis' in window)) return;

            if (this.activeBtn === buttonEl && this.synth.speaking) {
                this.stop();
                return;
            }

            this.stop();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = "de-DE";
            utterance.rate = state.voiceSpeed;

            const voices = this.synth.getVoices().filter(v => v.lang.startsWith("de"));
            const chosen = voices.find(v => v.name === state.selectedVoice) || voices[0];
            if (chosen) utterance.voice = chosen;

            this.activeBtn = buttonEl;
            if (buttonEl) buttonEl.classList.add("playing", "text-sky-500");

            utterance.onend = utterance.onerror = () => {
                if (this.activeBtn) this.activeBtn.classList.remove("playing", "text-sky-500");
                this.activeBtn = null;
            };

            this.synth.speak(utterance);
        },

        stop() {
            if (this.synth.speaking) this.synth.cancel();
            if (this.activeBtn) this.activeBtn.classList.remove("playing", "text-sky-500");
            this.activeBtn = null;
        }
    };

    // 5. DATA FETCHING (SAFE LOADING WITHOUT TOPICS.JSON)
    async function loadAllData() {
        runMigrationBridge();

        try {
            // Load templates, discussions, and grammar safely
            const [templatesRes, diskRes, gramRes] = await Promise.all([
                fetch("./template.json").catch(() => null),
                fetch("./diskussionen.json").catch(() => null),
                fetch("./Grammatik.json").catch(() => fetch("./grammatik.json")).catch(() => null)
            ]);

            let templates = templatesRes && templatesRes.ok ? await templatesRes.json() : [];
            let discussions = diskRes && diskRes.ok ? await diskRes.json() : [];
            state.grammar = gramRes && gramRes.ok ? await gramRes.json() : [];

            // Merge with local user customizations
            const suffix = "local";
            const savedEdits = localStorage.getItem(`edited_template_data_1_52_${suffix}`);
            if (savedEdits) {
                try {
                    const localList = JSON.parse(savedEdits);
                    templates = templates.map(t => {
                        const match = localList.find(l => l.id === t.id);
                        return match ? { ...t, ...match } : t;
                    });
                } catch (e) { }
            }

            state.topics = templates;

            // Apply default Redemittel if missing
            if (Object.keys(state.redemittel).length === 0) {
                state.redemittel = {
                    "Meinung äußern": [
                        { de: "Meiner Meinung nach sollte man das differenzierter betrachten.", en: "In my opinion, one should look at this in a more differentiated way." },
                        { de: "Ich bin der festen Ansicht, dass dieses Thema eine wichtige Rolle spielt.", en: "I am of the firm view that this topic plays an important role." }
                    ],
                    "Zustimmung": [
                        { de: "Da stimme ich dir völlig zu. Das ist ein schlagendes Argument.", en: "I completely agree with you. That is a compelling argument." }
                    ],
                    "Widerspruch": [
                        { de: "Das sehe ich etwas anders. Man muss auch bedenken, dass...", en: "I see that a bit differently. One must also consider that..." }
                    ]
                };
            }

            renderSidebar();
            renderActiveTopic();
            updateProgress();
        } catch (e) {
            console.error("Critical Data Load Error:", e);
        }
    }

    // 6. RENDER SIDEBAR & PROGRESS
    function renderSidebar() {
        const listEl = document.getElementById("topic-list");
        if (!listEl) return;
        listEl.innerHTML = "";

        const query = state.search.toLowerCase();

        state.topics.forEach((topic, idx) => {
            const isLearned = state.learnedIds.has(topic.id);
            const isActive = idx === state.activeIdx;

            if (state.filter === "learned" && !isLearned) return;
            if (state.filter === "offen" && isLearned) return;
            if (query && !topic.title_de.toLowerCase().includes(query)) return;

            const item = document.createElement("button");
            const activeBg = isActive ? "bg-[var(--accent)] text-white font-bold" : "hover:bg-[var(--bg-app)] text-[var(--text-primary)]";
            item.className = `w-full text-left p-3 rounded-xl flex items-center justify-between gap-2.5 transition-all text-xs cursor-pointer ${activeBg}`;

            item.innerHTML = `
                <div class="flex items-center gap-2.5 truncate">
                    <span class="text-base">${topic.icon || "📌"}</span>
                    <span class="font-mono text-[10px] opacity-70">#${topic.id}</span>
                    <span class="truncate font-semibold">${topic.title_de}</span>
                </div>
                <span class="w-2.5 h-2.5 rounded-full ${isLearned ? 'bg-emerald-400' : 'bg-zinc-300 dark:bg-zinc-700'} shrink-0"></span>
            `;

            item.onclick = () => {
                state.activeIdx = idx;
                renderSidebar();
                renderActiveTopic();
                closeMobileSidebar();
            };

            listEl.appendChild(item);
        });

        updateProgress();
    }

    function updateProgress() {
        const total = state.topics.length;
        const learned = state.topics.filter(t => state.learnedIds.has(t.id)).length;
        
        const progText = document.getElementById("progress-text");
        const progBar = document.getElementById("progress-bar");
        
        if (progText) progText.textContent = `${learned} / ${total}`;
        if (progBar && total > 0) progBar.style.width = `${(learned / total) * 100}%`;
    }

    // 7. RENDER ACTIVE TOPIC (DISCUSSION TEMPLATE)
    function renderActiveTopic() {
        const topic = state.topics[state.activeIdx];
        if (!topic) return;

        const titleEl = document.getElementById("active-topic-title");
        const emojiEl = document.getElementById("active-topic-emoji");
        const badgeEl = document.getElementById("active-topic-badge");
        const toggleBtn = document.getElementById("learned-toggle");

        if (titleEl) titleEl.textContent = topic.title_de;
        if (emojiEl) emojiEl.textContent = topic.icon || "📌";
        if (badgeEl) badgeEl.textContent = `Thema ${topic.id}`;

        const isLearned = state.learnedIds.has(topic.id);
        if (toggleBtn) {
            toggleBtn.className = isLearned 
                ? "h-6 text-[10px] font-bold rounded-md px-2.5 bg-emerald-500 text-white flex items-center gap-1 shadow-sm" 
                : "h-6 text-[10px] font-bold rounded-md px-2.5 bg-[var(--bg-app)] border border-[var(--border)] text-[var(--text-muted)]";
            toggleBtn.innerHTML = isLearned ? "✓ Gelernt" : "Als gelernt markieren";
            toggleBtn.onclick = () => {
                if (isLearned) state.learnedIds.delete(topic.id);
                else state.learnedIds.add(topic.id);
                persistState();
                renderActiveTopic();
                renderSidebar();
            };
        }

        const container = document.getElementById("active-topic-container");
        if (!container) return;
        container.innerHTML = "";

        // Template Sub-Blocks
        const blocks = [
            { key: "einleitung_de", label: "1. Einleitung & Problemstellung", text: topic.einleitung_de },
            { key: "pro", label: "2. Pro-Argumente", list: topic.pro_de },
            { key: "contra", label: "3. Kontra-Argumente", list: topic.contra_de },
            { key: "pers_erfahrung_de", label: "4. Eigene Erfahrung & Heimatland", text: topic.pers_erfahrung_de },
            { key: "schluss_de", label: "5. Fazit & Kompromiss", text: topic.schluss_de }
        ];

        blocks.forEach(b => {
            const card = document.createElement("div");
            card.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-2";

            let contentHtml = "";
            if (b.text) {
                const saved = state.highlights[topic.id]?.[b.key] || b.text;
                contentHtml = `<div class="text-xs leading-relaxed selectable-text select-text" data-block="${b.key}">${saved}</div>`;
            } else if (b.list && Array.isArray(b.list)) {
                contentHtml = `<ul class="space-y-2 text-xs">` + 
                    b.list.map((item, i) => `<li class="flex items-start gap-2"><span class="text-sky-500 font-bold">•</span><span class="selectable-text select-text">${item}</span></li>`).join("") +
                    `</ul>`;
            }

            card.innerHTML = `
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-2 mb-2">
                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-[var(--text-muted)]">${b.label}</span>
                    <button class="audio-trigger p-1.5 rounded-lg hover:bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-sky-500 transition-colors cursor-pointer" title="Vorlesen">
                        <span class="soundwave-bar"></span>
                        <span class="soundwave-bar"></span>
                        <span class="soundwave-bar"></span>
                        <span class="soundwave-bar"></span>
                    </button>
                </div>
                ${contentHtml}
            `;

            // Robust Audio Click Attachment (Apostrophe-safe)
            const audioBtn = card.querySelector(".audio-trigger");
            if (audioBtn) {
                const textToRead = b.text || (b.list ? b.list.join(". ") : "");
                audioBtn.addEventListener("click", () => audio.play(textToRead, audioBtn));
            }

            container.appendChild(card);
        });

        // 5-Phase Partner Dialog Section
        if (topic.dialog && Array.isArray(topic.dialog)) {
            const dialogCard = document.createElement("div");
            dialogCard.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3";
            dialogCard.innerHTML = `<h3 class="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-2">5-Phasen Prüfungsdialog</h3>`;
            
            topic.dialog.forEach((d, idx) => {
                const bubble = document.createElement("div");
                const isA = d.role && d.role.includes("A");
                bubble.className = `p-3 rounded-xl border border-[var(--border)] text-xs space-y-1 ${isA ? 'bg-[var(--accent-light)] mr-4' : 'bg-[var(--bg-app)] ml-4'}`;
                bubble.innerHTML = `
                    <div class="flex justify-between items-center text-[10px] font-extrabold text-[var(--text-muted)]">
                        <span>${d.role || 'Sprecher'} (Phase ${d.phase || (idx + 1)})</span>
                        <button class="dialog-audio-btn hover:text-sky-500 cursor-pointer">🔊</button>
                    </div>
                    <div class="selectable-text leading-relaxed select-text">${d.de}</div>
                `;
                const btn = bubble.querySelector(".dialog-audio-btn");
                if (btn) btn.addEventListener("click", () => audio.play(d.de, btn));
                dialogCard.appendChild(bubble);
            });
            container.appendChild(dialogCard);
        }
    }

    // 8. HORIZONTAL SWIPE NAVIGATION (FIXED GESTURE DEADZONE)
    let touchStartX = 0, touchStartY = 0;

    document.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        // Ignore if user is scrolling vertically or selecting text
        if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 70) return;
        if (window.getSelection() && window.getSelection().toString().length > 0) return;
        
        // Target is an active form control
        if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;

        if (deltaX < 0 && state.activeIdx < state.topics.length - 1) {
            // Swipe Left -> Next
            state.activeIdx++;
            renderActiveTopic();
            renderSidebar();
        } else if (deltaX > 0 && state.activeIdx > 0) {
            // Swipe Right -> Prev
            state.activeIdx--;
            renderActiveTopic();
            renderSidebar();
        }
    }, { passive: true });

    // 9. SAFE BACKUP EXPORT (BLOB-BASED, NO DATA URI TRUNCATION)
    function exportBackup() {
        const payload = {
            version: "B2_Studio_2026",
            timestamp: new Date().toISOString(),
            topics: state.topics,
            highlights: state.highlights,
            vocabulary: state.vocabulary,
            learned: Array.from(state.learnedIds)
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `B2_Trainer_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // 10. SETUP & INITIALIZATION
    function closeMobileSidebar() {
        const s = document.getElementById("sidebar");
        const o = document.getElementById("drawer-overlay");
        if (s) s.classList.remove("sidebar-open");
        if (o) o.classList.add("hidden");
    }

    function openMobileSidebar() {
        const s = document.getElementById("sidebar");
        const o = document.getElementById("drawer-overlay");
        if (s) s.classList.add("sidebar-open");
        if (o) o.classList.remove("hidden");
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadAllData();

        // Mobile drawer openers
        const mobDrawerBtn = document.getElementById("mob-center-drawer-btn");
        const overlay = document.getElementById("drawer-overlay");
        const dragHandle = document.getElementById("sidebar-drag-handle");
        const reloadBtn = document.getElementById("header-reload-btn");

        if (mobDrawerBtn) mobDrawerBtn.onclick = openMobileSidebar;
        if (overlay) overlay.onclick = closeMobileSidebar;
        if (dragHandle) dragHandle.onclick = closeMobileSidebar;
        if (reloadBtn) reloadBtn.onclick = () => window.location.reload();

        // Search bar
        const searchInput = document.getElementById("search-bar");
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                state.search = e.target.value;
                renderSidebar();
            });
        }

        // Filters
        ["all", "learned", "offen"].forEach(f => {
            const btn = document.getElementById(`filter-${f}-btn`);
            if (btn) {
                btn.onclick = () => {
                    state.filter = f;
                    ["all", "learned", "offen"].forEach(k => {
                        const b = document.getElementById(`filter-${k}-btn`);
                        if (b) b.className = k === f ? "py-1 text-center rounded bg-[var(--bg-app)] text-[var(--text-primary)] shadow-sm font-bold" : "py-1 text-center rounded text-[var(--text-muted)]";
                    });
                    renderSidebar();
                };
            }
        });

        // PDF / Sichern actions
        const btnSave = document.getElementById("btn-save-manual");
        if (btnSave) btnSave.onclick = () => { persistState(); alert("Gespeichert!"); };

        const btnPdf = document.getElementById("btn-pdf-export");
        if (btnPdf) btnPdf.onclick = () => window.print();
    });

})();
