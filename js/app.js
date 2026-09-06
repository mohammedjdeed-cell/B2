
(function () {
    "use strict";

    // 1. GLOBAL STATE
    const state = {
        topics: [],           // Dynamic 55+ topics (from template.json)
        discussions: [],      // From diskussionen.json
        grammar: [],          // From Grammatik.json
        activeIdx: parseInt(localStorage.getItem("b2_active_idx")) || 0,
        activeTab: "template", // "template" | "diskussion" | "wortschatz" | "mindmap" | "redemittel" | "grammar" | "settings"
        learnedIds: new Set(),
        highlights: {},       // topicId -> { blockKey: html }
        vocabulary: {},       // topicId -> [ { de, en, ar, type, learned } ]
        redemittel: {},       // category -> [ { de, en } ]
        filter: "all",
        search: "",
        isEditMode: false,
        theme: localStorage.getItem("b2_theme_setting") || "system",
        textScale: localStorage.getItem("b2_text_scale") || "100%",
        voiceSpeed: parseFloat(localStorage.getItem("b2_voice_speed")) || 1.0,
        selectedVoice: localStorage.getItem("b2_selected_voice") || "",
        vocabPracticeMode: false,
        vocabShowAll: false,
        miniViewMode: "wortschatz",
        expandedTranslations: new Set()
    };

    // Structural default debate phrases
    const DEFAULT_REDEMITTEL = {
        "Meinung äußern": [
            { de: "Meiner Meinung nach sollte man das differenzierter betrachten.", en: "In my opinion, one should look at this in a more differentiated way." },
            { de: "Ich bin der festen Ansicht, dass dieses Thema eine wichtige Rolle spielt.", en: "I am of the firm view that this topic plays an important role." }
        ],
        "Zustimmung": [
            { de: "Da stimme ich dir völlig zu. Das ist ein schlagendes Argument.", en: "I completely agree with you. That is a compelling argument." }
        ],
        "Widerspruch": [
            { de: "Das sehe ich etwas anders. Man muss auch bedenken, dass...", en: "I see that a bit differently. One must also consider that..." }
        ],
        "Abschluss": [
            { de: "Zusammenfassend lässt sich sagen, dass wir einen Kompromiss brauchen.", en: "In summary, we need a compromise." }
        ]
    };

    // 2. ZERO-DATA-LOSS MIGRATION BRIDGE
    function runDataMigrationBridge() {
        const suffix = "local";

        // A. Learned topics
        const legacyLearned = localStorage.getItem(`learned_topics_1_52_${suffix}`) || localStorage.getItem("b2_learned_topics");
        if (legacyLearned) {
            try {
                const parsed = JSON.parse(legacyLearned);
                if (Array.isArray(parsed)) parsed.forEach(id => state.learnedIds.add(Number(id)));
            } catch (e) { }
        }

        // B. Custom highlights & notes
        const legacyHighlights = localStorage.getItem(`b2_highlights_${suffix}`) || localStorage.getItem("b2_highlights");
        if (legacyHighlights) {
            try { state.highlights = JSON.parse(legacyHighlights) || {}; } catch (e) { }
        }

        // C. Custom Vocabulary
        const legacyVocab = localStorage.getItem(`b2_vocab_${suffix}`) || localStorage.getItem("b2_vocab");
        if (legacyVocab) {
            try { state.vocabulary = JSON.parse(legacyVocab) || {}; } catch (e) { }
        }

        // D. Redemittel
        const legacyRede = localStorage.getItem(`b2_redemittel_${suffix}`);
        if (legacyRede) {
            try { state.redemittel = JSON.parse(legacyRede) || {}; } catch (e) { }
        }
        if (Object.keys(state.redemittel).length === 0) {
            state.redemittel = JSON.parse(JSON.stringify(DEFAULT_REDEMITTEL));
        }

        console.log("Migration Bridge: Complete data continuity guaranteed.");
    }

    function persistLocalData() {
        const suffix = "local";
        localStorage.setItem(`learned_topics_1_52_${suffix}`, JSON.stringify(Array.from(state.learnedIds)));
        localStorage.setItem(`b2_highlights_${suffix}`, JSON.stringify(state.highlights));
        localStorage.setItem(`b2_vocab_${suffix}`, JSON.stringify(state.vocabulary));
        localStorage.setItem(`b2_redemittel_${suffix}`, JSON.stringify(state.redemittel));
        localStorage.setItem(`edited_template_data_1_52_${suffix}`, JSON.stringify(state.topics));
    }

    // 3. SPEECH SYNTHESIS ENGINE (APOSTROPHE-SAFE)
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
            const match = voices.find(v => v.name === state.selectedVoice) || voices[0];
            if (match) utterance.voice = match;

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

    // 4. DATA LOADER (WITHOUT TOPICS.JSON)
    async function loadData() {
        runDataMigrationBridge();
        applyTheme();
        applyTextScale();

        try {
            const [tempRes, diskRes, gramRes] = await Promise.all([
                fetch("./template.json").catch(() => null),
                fetch("./diskussionen.json").catch(() => null),
                fetch("./Grammatik.json").catch(() => fetch("./grammatik.json")).catch(() => null)
            ]);

            let templates = tempRes && tempRes.ok ? await tempRes.json() : [];
            state.discussions = diskRes && diskRes.ok ? await diskRes.json() : [];
            state.grammar = gramRes && gramRes.ok ? await gramRes.json() : [];

            // Merge local edits
            const suffix = "local";
            const savedEdits = localStorage.getItem(`edited_template_data_1_52_${suffix}`);
            if (savedEdits) {
                try {
                    const localList = JSON.parse(savedEdits);
                    templates = templates.map(t => {
                        const m = localList.find(l => l.id === t.id);
                        return m ? { ...t, ...m } : t;
                    });
                } catch (e) { }
            }

            state.topics = templates;
            if (state.activeIdx >= state.topics.length) state.activeIdx = 0;

            renderSidebar();
            renderActiveTopic();
            renderRightPanel();
            updateProgress();
        } catch (e) {
            console.error("Data load failed:", e);
        }
    }

    // 5. THEME & TEXT SCALE
    function applyTheme() {
        const root = document.documentElement;
        let isDark = state.theme === "dark";
        if (state.theme === "system") {
            isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        if (isDark) {
            root.classList.add("dark");
            root.setAttribute("data-theme", "dark");
        } else {
            root.classList.remove("dark");
            root.setAttribute("data-theme", "light");
        }
    }

    function applyTextScale() {
        document.documentElement.style.setProperty("--text-scale", state.textScale);
    }

    // 6. RENDER SIDEBAR & MINI-VIEW
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
                localStorage.setItem("b2_active_idx", state.activeIdx);
                renderSidebar();
                renderActiveTopic();
                renderRightPanel();
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

    function renderRightPanel() {
        const container = document.getElementById("right-panel-content");
        if (!container || !state.topics[state.activeIdx]) return;
        const tId = state.topics[state.activeIdx].id;
        container.innerHTML = "";

        if (state.miniViewMode === "wortschatz") {
            const words = state.vocabulary[tId] || [];
            if (words.length === 0) {
                container.innerHTML = `<p class="text-xs text-[var(--text-muted)] text-center p-4">Keine Vokabeln für Thema ${tId}.</p>`;
                return;
            }
            words.forEach(w => {
                const card = document.createElement("div");
                card.className = "bg-[var(--bg-card)] p-2.5 rounded-xl border border-[var(--border)] shadow-sm text-xs space-y-1";
                card.innerHTML = `
                    <div class="flex justify-between items-center font-bold text-[var(--text-primary)]">
                        <span>${w.de}</span>
                        <span class="text-[9px] font-mono px-1.5 py-0.5 bg-[var(--bg-app)] rounded text-sky-500">${w.type || 'Wort'}</span>
                    </div>
                    <div class="text-[11px] text-blue-500">${w.en || ''}</div>
                    ${w.ar ? `<div dir="rtl" class="text-[11px] font-arabic text-purple-500 text-right">${w.ar}</div>` : ''}
                `;
                container.appendChild(card);
            });
        } else {
            Object.keys(state.redemittel).forEach(cat => {
                const sec = document.createElement("div");
                sec.className = "space-y-1.5";
                sec.innerHTML = `<h5 class="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">${cat}</h5>`;
                state.redemittel[cat].forEach(r => {
                    sec.innerHTML += `
                        <div class="bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border)] text-xs">
                            <div class="font-bold text-[var(--text-primary)]">${r.de}</div>
                            <div class="text-[10px] text-blue-500">${r.en}</div>
                        </div>
                    `;
                });
                container.appendChild(sec);
            });
        }
    }

    // 7. RENDER ACTIVE TOPIC (TEMPLATE, DISKUSSION, OR WORTSCHATZ)
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
                persistLocalData();
                renderActiveTopic();
                renderSidebar();
            };
        }

        const container = document.getElementById("active-topic-container");
        if (!container) return;
        container.innerHTML = "";

        // SUBTAB: 1. TEMPLATE
        if (state.activeTab === "template") {
            const blocks = [
                { key: "einleitung_de", label: "1. Einleitung / Problemstellung", text: topic.einleitung_de },
                { key: "pro", label: "2. Dafür (Pro)", list: topic.pro_de },
                { key: "contra", label: "3. Dagegen (Kontra)", list: topic.contra_de },
                { key: "pers_erfahrung_de", label: "4. Eigene Erfahrung / Heimatland", text: topic.pers_erfahrung_de },
                { key: "schluss_de", label: "5. Fazit & Kompromiss", text: topic.schluss_de }
            ];

            blocks.forEach(b => {
                const card = document.createElement("div");
                card.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-2.5";
                
                let contentHtml = "";
                if (b.text) {
                    const saved = state.highlights[topic.id]?.[b.key] || b.text;
                    contentHtml = `<div class="text-xs leading-relaxed selectable-text select-text outline-none" contenteditable="${state.isEditMode}" data-block="${b.key}">${saved}</div>`;
                } else if (b.list) {
                    contentHtml = `<ul class="space-y-2 text-xs">` + 
                        b.list.map(item => `<li class="flex items-start gap-2"><span class="text-sky-500 font-bold">•</span><span class="selectable-text select-text">${item}</span></li>`).join("") +
                        `</ul>`;
                }

                card.innerHTML = `
                    <div class="flex items-center justify-between border-b border-[var(--border)] pb-2">
                        <span class="text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)]">${b.label}</span>
                        <button class="audio-trigger p-1 rounded hover:bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-sky-500 cursor-pointer">
                            <span class="soundwave-bar"></span><span class="soundwave-bar"></span><span class="soundwave-bar"></span><span class="soundwave-bar"></span>
                        </button>
                    </div>
                    ${contentHtml}
                `;

                const btn = card.querySelector(".audio-trigger");
                const readText = b.text || (b.list ? b.list.join(". ") : "");
                if (btn) btn.onclick = () => audio.play(readText, btn);

                // Inline text blur saver
                const editable = card.querySelector("[contenteditable='true']");
                if (editable) {
                    editable.onblur = () => {
                        if (!state.highlights[topic.id]) state.highlights[topic.id] = {};
                        state.highlights[topic.id][b.key] = editable.innerHTML;
                        persistLocalData();
                    };
                }

                container.appendChild(card);
            });

            // 5-Phase Dialog
            if (topic.dialog) {
                const dial = document.createElement("div");
                dial.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3";
                dial.innerHTML = `<h3 class="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-2">5-Phasen Partnerdialog</h3>`;
                topic.dialog.forEach((d, i) => {
                    const isA = d.role && d.role.includes("A");
                    const bub = document.createElement("div");
                    bub.className = `p-3 rounded-xl border border-[var(--border)] text-xs space-y-1 ${isA ? 'bg-[var(--accent-light)] mr-4' : 'bg-[var(--bg-app)] ml-4'}`;
                    bub.innerHTML = `
                        <div class="flex justify-between items-center text-[10px] font-extrabold text-[var(--text-muted)]">
                            <span>${d.role} (Phase ${d.phase || (i+1)})</span>
                            <button class="dial-audio hover:text-sky-500 cursor-pointer">🔊</button>
                        </div>
                        <div class="selectable-text leading-relaxed select-text">${d.de}</div>
                    `;
                    const b = bub.querySelector(".dial-audio");
                    if (b) b.onclick = () => audio.play(d.de, b);
                    dial.appendChild(bub);
                });
                container.appendChild(dial);
            }
        } 
        // SUBTAB: 2. DISKUSSION
        else if (state.activeTab === "diskussion") {
            const diskMatch = state.discussions.find(d => d.id === topic.id);
            const diskText = diskMatch ? diskMatch.content : "Kein Text verfügbar.";
            const card = document.createElement("div");
            card.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3";
            card.innerHTML = `
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-2">
                    <span class="text-xs font-black uppercase tracking-wider text-[var(--text-muted)]">Diskussionstext</span>
                    <button id="disk-audio-btn" class="p-1 rounded hover:bg-[var(--bg-app)] text-[var(--text-muted)] hover:text-sky-500 cursor-pointer">🔊 Vorlesen</button>
                </div>
                <div class="text-xs leading-relaxed selectable-text select-text whitespace-pre-wrap">${diskText}</div>
            `;
            const aBtn = card.querySelector("#disk-audio-btn");
            if (aBtn) aBtn.onclick = () => audio.play(diskText, aBtn);
            container.appendChild(card);
        }
        // SUBTAB: 3. WORTSCHATZ (FLASHCARDS & PRACTICE)
        else if (state.activeTab === "wortschatz") {
            renderVocabWorkspace(container, topic.id);
        }
    }

    // 8. WORTSCHATZ WORKSPACE (3D FLASHCARDS & LIST MODE)
    function renderVocabWorkspace(container, topicId) {
        let words = [];
        if (state.vocabShowAll) {
            Object.keys(state.vocabulary).forEach(id => {
                (state.vocabulary[id] || []).forEach((w, idx) => words.push({ ...w, origId: id, origIdx: idx }));
            });
        } else {
            words = (state.vocabulary[topicId] || []).map((w, idx) => ({ ...w, origId: topicId, origIdx: idx }));
        }

        const headerCard = document.createElement("div");
        headerCard.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm flex flex-wrap justify-between items-center gap-3";
        headerCard.innerHTML = `
            <div>
                <h3 class="text-sm font-black text-[var(--text-primary)]">🧠 Vokabel-Management</h3>
                <p class="text-[10px] text-[var(--text-muted)]">${words.length} Wörter in der Sammlung</p>
            </div>
            <div class="flex gap-2">
                <button id="toggle-practice-btn" class="px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${state.vocabPracticeMode ? 'bg-indigo-600 text-white' : 'bg-[var(--bg-app)] text-[var(--text-primary)]'}">${state.vocabPracticeMode ? '🃏 Karten: AN' : '📋 Liste'}</button>
                <button id="toggle-show-all-btn" class="px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${state.vocabShowAll ? 'bg-teal-600 text-white' : 'bg-[var(--bg-app)] text-[var(--text-primary)]'}">${state.vocabShowAll ? '🌍 Alle Themen' : '📌 Nur dieses'}</button>
                <button id="btn-add-vocab-modal-open" class="px-3 py-1.5 text-xs font-bold rounded-xl bg-[var(--accent)] text-white shadow-sm cursor-pointer">➕ Neu</button>
            </div>
        `;

        headerCard.querySelector("#toggle-practice-btn").onclick = () => { state.vocabPracticeMode = !state.vocabPracticeMode; renderActiveTopic(); };
        headerCard.querySelector("#toggle-show-all-btn").onclick = () => { state.vocabShowAll = !state.vocabShowAll; renderActiveTopic(); };
        headerCard.querySelector("#btn-add-vocab-modal-open").onclick = () => document.getElementById("wortschatz-editor-modal").classList.remove("hidden");
        container.appendChild(headerCard);

        if (words.length === 0) {
            container.innerHTML += `<div class="p-8 text-center text-xs text-[var(--text-muted)] border-2 border-dashed border-[var(--border)] rounded-2xl">Keine Vokabeln gefunden. Klicke auf "➕ Neu" um ein Wort hinzuzufügen!</div>`;
            return;
        }

        // Flashcards 3D Grid
        if (state.vocabPracticeMode) {
            const grid = document.createElement("div");
            grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5";
            words.forEach(w => {
                const card = document.createElement("div");
                card.className = "perspective-1000 flashcard-container h-44 cursor-pointer";
                card.onclick = () => card.classList.toggle("flipped");
                card.innerHTML = `
                    <div class="flashcard-inner w-full h-full relative transform-style-3d shadow-sm rounded-2xl">
                        <!-- Front -->
                        <div class="flashcard-front absolute inset-0 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between">
                            <div class="flex justify-between items-center">
                                <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-sky-100 dark:bg-sky-950/40 text-sky-600 rounded">${w.type || 'Wort'}</span>
                                <button class="card-audio-btn text-sm hover:text-sky-500">🔊</button>
                            </div>
                            <h4 class="text-base font-black text-[var(--text-primary)] text-center de-word-fit">${w.de}</h4>
                            <span class="text-[9px] text-[var(--text-muted)] text-right">Umdrehen ↻</span>
                        </div>
                        <!-- Back -->
                        <div class="flashcard-back absolute inset-0 bg-[var(--bg-sidebar)] border border-[var(--border)] rounded-2xl p-4 flex flex-col justify-between">
                            <div class="text-xs font-bold text-blue-600 text-center my-auto">${w.en || '-'}</div>
                            ${w.ar ? `<div dir="rtl" class="text-sm font-arabic font-bold text-purple-600 text-center my-auto">${w.ar}</div>` : ''}
                        </div>
                    </div>
                `;
                const a = card.querySelector(".card-audio-btn");
                if (a) a.onclick = (e) => { e.stopPropagation(); audio.play(w.de, a); };
                grid.appendChild(card);
            });
            container.appendChild(grid);
        } 
        // List Mode
        else {
            const list = document.createElement("div");
            list.className = "grid grid-cols-1 lg:grid-cols-2 gap-3";
            words.forEach(w => {
                const item = document.createElement("div");
                item.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-3.5 shadow-sm flex flex-col gap-2";
                item.innerHTML = `
                    <div class="flex justify-between items-start gap-2">
                        <div class="font-bold text-xs text-[var(--text-primary)]">${w.de}</div>
                        <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/30 text-sky-500 border border-sky-200/40">${w.type || 'Wort'}</span>
                    </div>
                    <div class="text-xs text-blue-500">${w.en || ''}</div>
                    ${w.ar ? `<div dir="rtl" class="text-xs font-arabic text-purple-500 text-right">${w.ar}</div>` : ''}
                    <div class="flex justify-end gap-2 border-t border-[var(--border)] pt-2 mt-1">
                        <button class="vocab-speak text-xs p-1 hover:text-sky-500 cursor-pointer">🔊</button>
                        <button class="vocab-del text-xs text-rose-500 hover:text-rose-700 p-1 cursor-pointer">🗑️</button>
                    </div>
                `;
                item.querySelector(".vocab-speak").onclick = (e) => audio.play(w.de, e.target);
                item.querySelector(".vocab-del").onclick = () => {
                    if (confirm("Vokabel löschen?")) {
                        state.vocabulary[w.origId].splice(w.origIdx, 1);
                        persistLocalData();
                        renderActiveTopic();
                        renderRightPanel();
                    }
                };
                list.appendChild(item);
            });
            container.appendChild(list);
        }
    }

    // 9. BENTO GRID / MINDMAP
    function renderBentoGrid() {
        const grid = document.getElementById("box-grid-container");
        if (!grid) return;
        grid.innerHTML = "";

        const query = (document.getElementById("grid-search")?.value || "").toLowerCase();
        const catFilter = document.getElementById("grid-category-filter")?.value || "all";

        state.topics.forEach((t, idx) => {
            if (catFilter !== "all" && t.category !== catFilter) return;
            if (query && !t.title_de.toLowerCase().includes(query)) return;

            const isLearned = state.learnedIds.has(t.id);
            const card = document.createElement("div");
            card.className = "bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent)] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between min-h-[160px]";
            card.innerHTML = `
                <div class="flex justify-between items-start gap-2 mb-2">
                    <span class="text-[9px] font-black uppercase tracking-wider text-sky-500 bg-sky-50 dark:bg-sky-950/30 px-2 py-0.5 rounded">${t.category || 'Allgemein'}</span>
                    <span class="text-xl">${t.icon || '📌'}</span>
                </div>
                <h4 class="text-xs font-extrabold text-[var(--text-primary)] leading-snug line-clamp-2">${t.title_de}</h4>
                <div class="flex justify-between items-center border-t border-[var(--border)]/50 pt-2 mt-3 text-[10px] font-mono">
                    <span>#${t.id}</span>
                    <span class="${isLearned ? 'text-emerald-500 font-bold' : 'text-[var(--text-muted)]'}">${isLearned ? '✓ Gelernt' : 'Offen'}</span>
                </div>
            `;
            card.onclick = () => {
                state.activeIdx = idx;
                switchTab("template");
            };
            grid.appendChild(card);
        });
    }

    // 10. REDEMITTEL VIEW
    function renderRedemittel() {
        const container = document.getElementById("section-redemittel");
        if (!container) return;
        container.innerHTML = "";

        Object.keys(state.redemittel).forEach(cat => {
            const card = document.createElement("div");
            card.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-2.5";
            card.innerHTML = `<h3 class="text-xs font-black uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)] pb-2">${cat}</h3>`;

            state.redemittel[cat].forEach((r, idx) => {
                const item = document.createElement("div");
                item.className = "p-2.5 bg-[var(--bg-app)] rounded-xl flex justify-between items-center gap-3";
                item.innerHTML = `
                    <div>
                        <div class="text-xs font-bold text-[var(--text-primary)]">${r.de}</div>
                        <div class="text-[11px] text-blue-500">${r.en}</div>
                    </div>
                    <button class="p-1 text-xs hover:text-sky-500 cursor-pointer shrink-0">🔊</button>
                `;
                item.querySelector("button").onclick = (e) => audio.play(r.de, e.target);
                card.appendChild(item);
            });
            container.appendChild(card);
        });
    }

    // 11. GRAMMAR VIEW
    function renderGrammar() {
        const container = document.getElementById("section-grammar");
        if (!container) return;
        container.innerHTML = "";

        if (state.grammar.length === 0) {
            container.innerHTML = `<p class="text-xs text-[var(--text-muted)] text-center p-8">Lade Grammatikdaten...</p>`;
            return;
        }

        const grid = document.createElement("div");
        grid.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
        state.grammar.forEach(g => {
            const card = document.createElement("div");
            card.className = "bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-2";
            let exHtml = (g.examples || []).map(ex => `<li class="text-xs list-disc ml-4 text-[var(--text-muted)]">${ex}</li>`).join("");
            card.innerHTML = `
                <div class="flex justify-between items-center text-[10px] font-bold text-[var(--text-muted)] uppercase">
                    <span>${g.level || 'B2'} | ${g.category || 'Grammatik'}</span>
                    <button class="grammar-speak hover:text-sky-500 cursor-pointer">🔊</button>
                </div>
                <h4 class="text-xs font-black text-sky-500">${g.title}</h4>
                <p class="text-[11px] text-[var(--text-primary)] leading-relaxed">${g.description}</p>
                ${exHtml ? `<ul class="space-y-1 border-t border-[var(--border)] pt-2">${exHtml}</ul>` : ''}
            `;
            card.querySelector(".grammar-speak").onclick = (e) => audio.play(`${g.title}. ${g.description}`, e.target);
            grid.appendChild(card);
        });
        container.appendChild(grid);
    }

    // 12. SETTINGS VIEW & BLOB EXPORT
    function renderSettings() {
        const container = document.getElementById("section-settings");
        if (!container) return;
        container.innerHTML = `
            <div class="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm text-center mb-4">
                <h2 class="text-xl font-black text-[var(--text-primary)]">⚙️ Einstellungen & Daten</h2>
                <p class="text-xs text-[var(--text-muted)] mt-0.5">Konfiguration, Audio-Ausgabe und Cloud-Sicherung.</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- Voice -->
                <div class="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3">
                    <h4 class="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Sprachausgabe (TTS)</h4>
                    <select id="voice-select" class="w-full text-xs font-bold p-2.5 bg-[var(--bg-app)] border border-[var(--border)] rounded-lg outline-none"></select>
                </div>
                <!-- Theme & Scale -->
                <div class="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3">
                    <h4 class="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Ansicht & Schrift</h4>
                    <div class="grid grid-cols-3 gap-2">
                        <button class="scale-btn py-1.5 text-xs font-bold rounded-lg border" data-scale="80%">80%</button>
                        <button class="scale-btn py-1.5 text-xs font-bold rounded-lg border" data-scale="100%">100%</button>
                        <button class="scale-btn py-1.5 text-xs font-bold rounded-lg border" data-scale="125%">125%</button>
                    </div>
                </div>
                <!-- Data Backup -->
                <div class="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-4 shadow-sm space-y-3 md:col-span-2">
                    <h4 class="text-xs font-black text-[var(--text-muted)] uppercase tracking-wider">Sicherung & Wiederherstellung</h4>
                    <div class="flex flex-wrap gap-2">
                        <button id="btn-export-backup" class="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-lg shadow-sm cursor-pointer">💾 Vollbackup exportieren (.json)</button>
                        <button onclick="document.getElementById('import-backup-input').click()" class="px-4 py-2 text-xs font-bold bg-zinc-700 text-white rounded-lg shadow-sm cursor-pointer">📥 Backup einspielen</button>
                    </div>
                </div>
            </div>
        `;

        // Populate TTS Voices
        const voiceSelect = container.querySelector("#voice-select");
        if (voiceSelect && window.speechSynthesis) {
            const voices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("de"));
            voiceSelect.innerHTML = `<option value="">Standard-Stimme</option>` + 
                voices.map(v => `<option value="${v.name}" ${v.name === state.selectedVoice ? 'selected' : ''}>${v.name}</option>`).join("");
            voiceSelect.onchange = (e) => {
                state.selectedVoice = e.target.value;
                localStorage.setItem("b2_selected_voice", state.selectedVoice);
            };
        }

        // Scale buttons
        container.querySelectorAll(".scale-btn").forEach(b => {
            b.onclick = () => {
                state.textScale = b.dataset.scale;
                localStorage.setItem("b2_text_scale", state.textScale);
                applyTextScale();
            };
        });

        // Backup Export
        container.querySelector("#btn-export-backup").onclick = exportFullBackup;
    }

    function exportFullBackup() {
        const payload = {
            version: "B2_Studio_2026",
            timestamp: new Date().toISOString(),
            topics: state.topics,
            highlights: state.highlights,
            vocabulary: state.vocabulary,
            redemittel: state.redemittel,
            learned: Array.from(state.learnedIds)
        };

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `B2_Trainer_Backup_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // 13. TAB ROUTER
    function switchTab(tabId) {
        state.activeTab = tabId;

        // Toggle Views
        ["workspace", "mindmap", "redemittel", "grammar", "settings"].forEach(sec => {
            const el = document.getElementById(`section-${sec}`);
            if (el) el.classList.toggle("hidden", sec !== tabId && !(sec === "workspace" && ["template", "diskussion", "wortschatz"].includes(tabId)));
        });

        // Update Desktop Navigation Styling
        const deskNavMap = {
            "template": "nav-themen-desk",
            "diskussion": "nav-themen-desk",
            "wortschatz": "nav-themen-desk",
            "mindmap": "nav-raster-desk",
            "redemittel": "nav-tools-desk",
            "grammar": "nav-grammar-desk",
            "settings": "nav-settings-desk"
        };
        ["nav-themen-desk", "nav-raster-desk", "nav-tools-desk", "nav-grammar-desk", "nav-settings-desk"].forEach(id => {
            const b = document.getElementById(id);
            if (b) {
                b.className = id === deskNavMap[tabId]
                    ? "px-3.5 py-1.5 text-xs font-black rounded-lg bg-[var(--accent)] text-white shadow-md transition-all"
                    : "px-3.5 py-1.5 text-xs font-black rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all";
            }
        });

        // Subtabs
        ["template", "diskussion", "wortschatz"].forEach(sub => {
            const b = document.getElementById(`subtab-${sub}`);
            if (b) {
                b.className = sub === tabId 
                    ? "py-2 text-xs font-black rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm"
                    : "py-2 text-xs font-black rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]";
            }
        });

        if (["template", "diskussion", "wortschatz"].includes(tabId)) renderActiveTopic();
        if (tabId === "mindmap") renderBentoGrid();
        if (tabId === "redemittel") renderRedemittel();
        if (tabId === "grammar") renderGrammar();
        if (tabId === "settings") renderSettings();
    }

    // 14. MOBILE SWIPE NAVIGATION
    let touchStartX = 0, touchStartY = 0;
    document.addEventListener("touchstart", (e) => {
        touchStartX = e.changedTouches[0].clientX;
        touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    document.addEventListener("touchend", (e) => {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(deltaY) > Math.abs(deltaX) || Math.abs(deltaX) < 70) return;
        if (window.getSelection() && window.getSelection().toString().length > 0) return;
        if (e.target.closest("input, textarea, select, [contenteditable='true']")) return;

        if (["template", "diskussion", "wortschatz"].includes(state.activeTab)) {
            if (deltaX < 0 && state.activeIdx < state.topics.length - 1) {
                state.activeIdx++;
                renderActiveTopic();
                renderSidebar();
            } else if (deltaX > 0 && state.activeIdx > 0) {
                state.activeIdx--;
                renderActiveTopic();
                renderSidebar();
            }
        }
    }, { passive: true });

    // 15. GLOBAL EVENT WIRING
    function closeMobileSidebar() {
        document.getElementById("sidebar")?.classList.remove("sidebar-open");
        document.getElementById("drawer-overlay")?.classList.add("hidden");
    }

    document.addEventListener("DOMContentLoaded", () => {
        loadData();

        // Mobile Drawer openers
        document.getElementById("mob-center-drawer-btn")?.addEventListener("click", () => {
            document.getElementById("sidebar")?.classList.add("sidebar-open");
            document.getElementById("drawer-overlay")?.classList.remove("hidden");
        });
        document.getElementById("drawer-overlay")?.addEventListener("click", closeMobileSidebar);
        document.getElementById("sidebar-drag-handle")?.addEventListener("click", closeMobileSidebar);

        // Desktop Collapser
        document.getElementById("sidebar-toggle-btn")?.addEventListener("click", () => {
            document.getElementById("sidebar")?.classList.toggle("sidebar-collapsed");
        });

        // Search
        document.getElementById("search-bar")?.addEventListener("input", (e) => {
            state.search = e.target.value;
            renderSidebar();
        });

        // Filter buttons
        ["all", "learned", "offen"].forEach(f => {
            document.getElementById(`filter-${f}-btn`)?.addEventListener("click", () => {
                state.filter = f;
                ["all", "learned", "offen"].forEach(k => {
                    const b = document.getElementById(`filter-${k}-btn`);
                    if (b) b.className = k === f ? "py-1 text-center rounded bg-[var(--bg-app)] text-[var(--text-primary)] shadow-sm font-bold" : "py-1 text-center rounded text-[var(--text-muted)]";
                });
                renderSidebar();
            });
        });

        // Tab events
        document.getElementById("nav-themen-desk")?.addEventListener("click", () => switchTab("template"));
        document.getElementById("nav-raster-desk")?.addEventListener("click", () => switchTab("mindmap"));
        document.getElementById("nav-tools-desk")?.addEventListener("click", () => switchTab("redemittel"));
        document.getElementById("nav-grammar-desk")?.addEventListener("click", () => switchTab("grammar"));
        document.getElementById("nav-settings-desk")?.addEventListener("click", () => switchTab("settings"));

        document.getElementById("nav-themen-mob")?.addEventListener("click", () => switchTab("template"));
        document.getElementById("nav-raster-mob")?.addEventListener("click", () => switchTab("mindmap"));
        document.getElementById("nav-tools-mob")?.addEventListener("click", () => switchTab("redemittel"));
        document.getElementById("nav-settings-mob")?.addEventListener("click", () => switchTab("settings"));

        document.getElementById("subtab-template")?.addEventListener("click", () => switchTab("template"));
        document.getElementById("subtab-diskussion")?.addEventListener("click", () => switchTab("diskussion"));
        document.getElementById("subtab-wortschatz")?.addEventListener("click", () => switchTab("wortschatz"));

        // Sidebar Mini Tab Switcher
        document.getElementById("sbar-tab-list")?.addEventListener("click", () => {
            document.getElementById("sidebar-themen-content")?.classList.remove("hidden");
            document.getElementById("sidebar-mini-content")?.classList.add("hidden");
        });
        document.getElementById("sbar-tab-mini")?.addEventListener("click", () => {
            document.getElementById("sidebar-themen-content")?.classList.add("hidden");
            document.getElementById("sidebar-mini-content")?.classList.remove("hidden");
            renderRightPanel();
        });

        // Edit Mode Toggle
        document.getElementById("fab-edit-toggle")?.addEventListener("click", () => {
            state.isEditMode = !state.isEditMode;
            document.getElementById("studio-command-bar")?.classList.toggle("hidden", !state.isEditMode);
            renderActiveTopic();
        });
        document.getElementById("cmd-done")?.addEventListener("click", () => {
            state.isEditMode = false;
            document.getElementById("studio-command-bar")?.classList.add("hidden");
            renderActiveTopic();
        });

        // Profile Modal
        document.getElementById("header-profile-btn")?.addEventListener("click", () => {
            document.getElementById("profile-settings-modal")?.classList.remove("hidden");
        });

        // Vocab modal save
        document.getElementById("btn-save-vocab-modal")?.addEventListener("click", () => {
            const de = document.getElementById("modal-vocab-de")?.value.trim();
            const en = document.getElementById("modal-vocab-en")?.value.trim();
            const ar = document.getElementById("modal-vocab-ar")?.value.trim();
            const type = document.getElementById("modal-vocab-type")?.value || "Nomen";
            if (!de) return;

            const tId = state.topics[state.activeIdx].id;
            if (!state.vocabulary[tId]) state.vocabulary[tId] = [];
            state.vocabulary[tId].push({ de, en, ar, type, learned: false });

            persistLocalData();
            document.getElementById("wortschatz-editor-modal")?.classList.add("hidden");
            renderActiveTopic();
            renderRightPanel();
        });

        // Backup Import listener
        document.getElementById("import-backup-input")?.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.topics) state.topics = data.topics;
                    if (data.highlights) state.highlights = data.highlights;
                    if (data.vocabulary) state.vocabulary = data.vocabulary;
                    if (data.redemittel) state.redemittel = data.redemittel;
                    if (data.learned) state.learnedIds = new Set(data.learned);
                    persistLocalData();
                    renderSidebar();
                    renderActiveTopic();
                    alert("Backup erfolgreich wiederhergestellt!");
                } catch (err) {
                    alert("Ungültige Backup-Datei.");
                }
            };
            r.readAsText(file);
        });

        // Service Worker registration
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(() => {});
        }
    });

})();
