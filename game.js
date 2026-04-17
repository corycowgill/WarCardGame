/* War — classic 2-player card game (you vs. AI)
 * Self-contained: no dependencies, no build step.
 */
(() => {
  "use strict";

  // --- constants ---
  const SUITS = [
    { s: "♠", cls: "black" },
    { s: "♥", cls: "red"   },
    { s: "♦", cls: "red"   },
    { s: "♣", cls: "black" },
  ];
  const RANKS = [
    { r: 2, t: "2" }, { r: 3, t: "3" }, { r: 4, t: "4" }, { r: 5, t: "5" },
    { r: 6, t: "6" }, { r: 7, t: "7" }, { r: 8, t: "8" }, { r: 9, t: "9" },
    { r: 10, t: "10" },
    { r: 11, t: "J", face: true },
    { r: 12, t: "Q", face: true },
    { r: 13, t: "K", face: true },
    { r: 14, t: "A" },
  ];

  // --- state ---
  const state = {
    playerDeck: [],
    aiDeck: [],
    warPile: [],          // cards committed to the current skirmish
    phase: "idle",        // idle | busy | gameover
    round: 0,
    auto: false,
  };

  // --- DOM ---
  const $ = (id) => document.getElementById(id);
  const els = {
    flip: $("flipBtn"),
    auto: $("autoBtn"),
    newg: $("newBtn"),
    fs: $("fsBtn"),
    speed: $("speed"),
    roundNum: $("roundNum"),
    playerCount: $("playerCount"),
    aiCount: $("aiCount"),
    playerDeck: $("playerDeck"),
    aiDeck: $("aiDeck"),
    playerSlot: $("playerSlot"),
    aiSlot: $("aiSlot"),
    pileLabel: $("pileLabel"),
    messages: $("messages"),
    warBanner: $("warBanner"),
    modal: $("modal"),
    modalTitle: $("modalTitle"),
    modalSub: $("modalSub"),
    modalBtn: $("modalBtn"),
    battlefield: $("battlefield"),
    fx: $("fx"),
  };

  // --- utilities ---
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const speed = () => parseInt(els.speed.value, 10);

  function createDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) {
      d.push({ rank: r.r, text: r.t, suit: s.s, color: s.cls, face: !!r.face, id: `${r.t}${s.s}${Math.random().toString(36).slice(2,6)}` });
    }
    return d;
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // --- rendering ---
  function cardEl(card, { faceUp = false } = {}) {
    const el = document.createElement("div");
    el.className = "card" + (faceUp ? " flipped" : "");
    el.dataset.id = card.id;

    const back = document.createElement("div");
    back.className = "card-face card-back";

    const front = document.createElement("div");
    front.className = "card-face card-front " + card.color + (card.face ? " face" : "");

    const tl = document.createElement("div");
    tl.className = "corner tl";
    tl.innerHTML = `<span class="rank">${card.text}</span><span class="suit">${card.suit}</span>`;

    const center = document.createElement("div");
    center.className = "center-suit";
    center.textContent = card.suit;
    if (card.face) center.dataset.rank = card.text;

    const br = document.createElement("div");
    br.className = "corner br";
    br.innerHTML = `<span class="rank">${card.text}</span><span class="suit">${card.suit}</span>`;

    front.append(tl, center, br);
    el.append(back, front);
    return el;
  }

  function renderDeckStacks() {
    renderDeckStack(els.playerDeck, state.playerDeck.length);
    renderDeckStack(els.aiDeck, state.aiDeck.length);
    updateCounts();
  }

  function renderDeckStack(container, n) {
    container.innerHTML = "";
    container.classList.toggle("empty", n === 0);
    const visible = Math.min(n, 6);
    for (let i = 0; i < visible; i++) {
      const layer = document.createElement("div");
      layer.className = "stacked card-face card-back";
      const offset = i * 1.2;
      layer.style.transform = `translate(${offset}px, ${-offset}px)`;
      layer.style.zIndex = String(i);
      container.appendChild(layer);
    }
  }

  function updateCounts() {
    const p = state.playerDeck.length;
    const a = state.aiDeck.length;
    flashCount(els.playerCount, p);
    flashCount(els.aiCount, a);
    els.roundNum.textContent = state.round;
  }

  function flashCount(el, n) {
    if (el.textContent !== String(n)) {
      el.textContent = n;
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 400);
    }
  }

  function setMessage(html) { els.messages.innerHTML = html; }

  function clearSlots() {
    [els.playerSlot, els.aiSlot].forEach(slot => {
      slot.classList.remove("glow", "winner", "loser");
      [...slot.querySelectorAll(".card")].forEach(c => c.remove());
    });
  }

  function clearPileLabel() { els.pileLabel.textContent = ""; }

  // Stacked war-pile visual at the edges of the battlefield.
  function renderWarPile() {
    const count = state.warPile.length;
    els.pileLabel.textContent = count > 0 ? `Pile: ${count} cards at stake` : "";
  }

  // --- game flow ---
  function newGame() {
    const deck = shuffle(createDeck());
    state.playerDeck = deck.slice(0, 26);
    state.aiDeck = deck.slice(26);
    state.warPile = [];
    state.phase = "idle";
    state.round = 0;
    state.auto = false;
    els.auto.textContent = "AUTO ▷";
    els.modal.hidden = true;
    clearSlots();
    clearPileLabel();
    renderDeckStacks();
    setMessage(`Shuffled. 26 cards each. Click <b>FLIP</b> to start the battle.`);
  }

  async function playRound() {
    if (state.phase !== "idle") return;
    if (state.playerDeck.length === 0 || state.aiDeck.length === 0) return;

    state.phase = "busy";
    els.flip.disabled = true;
    state.round++;
    updateCounts();
    clearSlots();

    const pCard = state.playerDeck.shift();
    const aCard = state.aiDeck.shift();
    state.warPile.push(pCard, aCard);

    // Slam cards into slots face-down.
    const pEl = cardEl(pCard, { faceUp: false });
    const aEl = cardEl(aCard, { faceUp: false });
    pEl.classList.add("slam");
    aEl.classList.add("slam");
    els.playerSlot.appendChild(pEl);
    els.aiSlot.appendChild(aEl);
    renderDeckStacks();
    renderWarPile();

    await wait(speed() * 0.45);

    // Glow then flip.
    els.playerSlot.classList.add("glow");
    els.aiSlot.classList.add("glow");
    await wait(speed() * 0.25);
    pEl.classList.add("flipped");
    aEl.classList.add("flipped");
    await wait(600);

    await resolve(pCard, aCard);
  }

  async function resolve(pCard, aCard) {
    if (pCard.rank > aCard.rank) {
      await awardPile("player", pCard, aCard);
    } else if (aCard.rank > pCard.rank) {
      await awardPile("ai", pCard, aCard);
    } else {
      await triggerWar(pCard, aCard);
      return;
    }
    finishTurn();
  }

  async function awardPile(winner, pCard, aCard) {
    const winEl = winner === "player" ? els.playerSlot : els.aiSlot;
    const loseEl = winner === "player" ? els.aiSlot : els.playerSlot;
    winEl.classList.remove("glow");
    loseEl.classList.remove("glow");
    winEl.classList.add("winner");
    loseEl.classList.add("loser");

    const winName = winner === "player" ? "You" : "AI";
    setMessage(`<b>${winName}</b> win ${state.warPile.length} card${state.warPile.length>1?"s":""}: <b>${cardText(pCard)}</b> vs <b>${cardText(aCard)}</b>`);

    burst(winner);
    await wait(speed() * 0.9);

    // If there were hidden face-down cards (war occurred), reveal the full pile.
    await revealPile(winner);

    // Shuffle the pile before giving to winner (prevents infinite loops with known orderings).
    shuffle(state.warPile);
    const target = winner === "player" ? state.playerDeck : state.aiDeck;
    for (const c of state.warPile) target.push(c);
    state.warPile = [];
    updateCounts();
    renderDeckStacks();
    renderWarPile();
  }

  // Show every card in the current pile face-up so the player can see what was actually played.
  // Only triggers when a war occurred (pile > 2 cards); normal rounds already display both cards.
  async function revealPile(winner) {
    if (state.warPile.length <= 2) return;

    clearSlotCards();

    const overlay = document.createElement("div");
    overlay.className = "pile-reveal";

    const header = document.createElement("div");
    header.className = "pile-reveal-header";
    header.textContent = winner === "player"
      ? `You captured ${state.warPile.length} cards`
      : `AI captured ${state.warPile.length} of your cards`;

    const sub = document.createElement("div");
    sub.className = "pile-reveal-sub";
    sub.textContent = "— The spoils of war —";

    const grid = document.createElement("div");
    grid.className = "pile-reveal-grid";

    // Split pile by side so the player can see their losses separately.
    const playerCards = [];
    const aiCards = [];
    for (let i = 0; i < state.warPile.length; i++) {
      (i % 2 === 0 ? playerCards : aiCards).push(state.warPile[i]);
    }

    const row = (label, cards, highlight) => {
      const r = document.createElement("div");
      r.className = "pile-reveal-row" + (highlight ? " highlight" : "");
      const lab = document.createElement("div");
      lab.className = "pile-reveal-label";
      lab.textContent = label;
      const cards_ = document.createElement("div");
      cards_.className = "pile-reveal-cards";
      cards.forEach((c, i) => {
        const el = cardEl(c, { faceUp: true });
        el.classList.add("mini");
        el.style.animationDelay = (i * 40) + "ms";
        el.classList.add("pop-in");
        cards_.appendChild(el);
      });
      r.append(lab, cards_);
      return r;
    };

    grid.append(
      row("YOU played", playerCards, winner === "ai"),
      row("AI played",  aiCards,     winner === "player"),
    );

    overlay.append(header, sub, grid);
    els.battlefield.appendChild(overlay);

    await wait(Math.max(1800, speed() * 2.2));

    overlay.classList.add("fade-out");
    await wait(300);
    overlay.remove();
  }

  async function triggerWar(pCard, aCard) {
    setMessage(`Matching <b>${pCard.text}</b>s — THIS MEANS WAR!`);
    // shake + banner
    const pEl = els.playerSlot.querySelector(".card");
    const aEl = els.aiSlot.querySelector(".card");
    pEl && pEl.classList.add("shake");
    aEl && aEl.classList.add("shake");
    els.warBanner.classList.remove("show");
    void els.warBanner.offsetWidth;
    els.warBanner.classList.add("show");
    warFlash();
    await wait(900);

    // Check both players have enough cards for war (3 down + 1 up). If not, whoever can play more wins.
    const pAvail = state.playerDeck.length;
    const aAvail = state.aiDeck.length;
    const pCanPlay = Math.min(4, pAvail);
    const aCanPlay = Math.min(4, aAvail);

    if (pAvail === 0 || aAvail === 0) {
      // Immediate loss for empty-handed side.
      const winner = pAvail === 0 ? "ai" : "player";
      setMessage(`${winner === "player" ? "AI has" : "You have"} no cards left — surrender!`);
      await awardPile(winner, pCard, aCard);
      finishTurn();
      return;
    }

    // Move previous up-cards off the slots into the pile visually.
    archiveSlotCards();

    // Place face-down cards.
    const pDown = [];
    const aDown = [];
    const downCount = Math.min(3, pCanPlay - 1, aCanPlay - 1);
    for (let i = 0; i < downCount; i++) {
      const p = state.playerDeck.shift();
      const a = state.aiDeck.shift();
      state.warPile.push(p, a);
      pDown.push(p); aDown.push(a);
      placeInPile(p, "player", i);
      placeInPile(a, "ai", i);
      renderDeckStacks();
      renderWarPile();
      await wait(speed() * 0.25);
    }

    // Final battle cards face up.
    let p2, a2;
    if (pCanPlay >= 2 && aCanPlay >= 2) {
      p2 = state.playerDeck.shift();
      a2 = state.aiDeck.shift();
      state.warPile.push(p2, a2);

      const pe = cardEl(p2, { faceUp: false });
      const ae = cardEl(a2, { faceUp: false });
      pe.classList.add("slam"); ae.classList.add("slam");
      clearSlotCards();
      els.playerSlot.appendChild(pe);
      els.aiSlot.appendChild(ae);
      els.playerSlot.classList.add("glow");
      els.aiSlot.classList.add("glow");
      renderDeckStacks();
      await wait(speed() * 0.5);
      pe.classList.add("flipped");
      ae.classList.add("flipped");
      await wait(650);

      await resolve(p2, a2);
    } else {
      // One side couldn't commit full war; they lose the pile.
      const winner = pCanPlay > aCanPlay ? "player"
                    : aCanPlay > pCanPlay ? "ai"
                    : (Math.random() < .5 ? "player" : "ai");
      setMessage(`Not enough cards for war — ${winner === "player" ? "you take" : "AI takes"} the pile!`);
      await awardPile(winner, pCard, aCard);
      finishTurn();
    }
  }

  function archiveSlotCards() {
    // Visually remove the two face-up cards — they're already in state.warPile.
    clearSlotCards();
  }
  function clearSlotCards() {
    [...els.playerSlot.querySelectorAll(".card")].forEach(c => c.remove());
    [...els.aiSlot.querySelectorAll(".card")].forEach(c => c.remove());
    els.playerSlot.classList.remove("glow","winner","loser");
    els.aiSlot.classList.remove("glow","winner","loser");
  }

  function placeInPile(card, side, idx) {
    // Small visual: drop a face-down card onto the respective slot with offset to suggest pile growth.
    const el = cardEl(card, { faceUp: false });
    el.style.position = "absolute";
    const ox = (idx + 1) * 12 * (side === "player" ? 1 : -1);
    const oy = (idx + 1) * 2;
    const rot = (idx + 1) * (side === "player" ? 3 : -3);
    el.style.transform = `translate(${ox}px, ${oy}px) rotate(${rot}deg)`;
    el.style.zIndex = String(10 + idx);
    el.classList.add("slam");
    (side === "player" ? els.playerSlot : els.aiSlot).appendChild(el);
  }

  function cardText(c) { return `${c.text}${c.suit}`; }

  function finishTurn() {
    state.phase = "idle";
    els.flip.disabled = false;

    if (state.playerDeck.length === 0 || state.aiDeck.length === 0) {
      endGame();
      return;
    }

    if (state.auto) setTimeout(playRound, Math.max(200, speed() * 0.4));
  }

  function endGame() {
    state.phase = "gameover";
    const youWin = state.playerDeck.length > 0;
    els.modalTitle.textContent = youWin ? "VICTORY" : "DEFEAT";
    els.modalSub.textContent = youWin
      ? "You have conquered the deck."
      : "The machine holds all 52 cards.";
    els.modal.hidden = false;
    if (youWin) celebrate();
  }

  // --- FX: canvas particles ---
  const fx = els.fx;
  const ctx = fx.getContext("2d");
  const particles = [];
  let fxRunning = false;

  function resizeCanvas() {
    fx.width = window.innerWidth;
    fx.height = window.innerHeight;
  }
  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();

  function spawn(x, y, opts = {}) {
    const count = opts.count ?? 18;
    const colors = opts.colors ?? ["#ffd97a", "#e9c464", "#ffffff", "#ff8a2e"];
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const speedV = 2 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(ang) * speedV,
        vy: Math.sin(ang) * speedV - 2,
        life: 60 + Math.random() * 40,
        age: 0,
        size: 2 + Math.random() * 3,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
    startFX();
  }

  function startFX() {
    if (fxRunning) return;
    fxRunning = true;
    const loop = () => {
      ctx.clearRect(0, 0, fx.width, fx.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age++;
        p.vy += 0.15;
        p.x += p.vx;
        p.y += p.vy;
        const alpha = 1 - p.age / p.life;
        if (alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (particles.length) {
        requestAnimationFrame(loop);
      } else {
        fxRunning = false;
      }
    };
    requestAnimationFrame(loop);
  }

  function burst(winner) {
    const rect = (winner === "player" ? els.playerSlot : els.aiSlot).getBoundingClientRect();
    spawn(rect.left + rect.width / 2, rect.top + rect.height / 2, { count: 24 });
  }

  function warFlash() {
    const rect = els.battlefield.getBoundingClientRect();
    for (let i = 0; i < 3; i++) {
      setTimeout(() => spawn(rect.left + Math.random() * rect.width,
                             rect.top + Math.random() * rect.height,
                             { count: 20, colors: ["#ff3b3b", "#ff7a3b", "#ffd97a", "#ffffff"] }),
                 i * 120);
    }
  }

  function celebrate() {
    const w = window.innerWidth, h = window.innerHeight;
    let i = 0;
    const id = setInterval(() => {
      spawn(Math.random() * w, -10, { count: 24, colors: ["#ffd97a", "#ff7a3b", "#8bd4ff", "#a8ffcf", "#ff6a9f"] });
      if (++i > 15) clearInterval(id);
    }, 200);
  }

  // --- controls ---
  els.flip.addEventListener("click", () => {
    if (state.phase === "idle") playRound();
  });

  els.auto.addEventListener("click", () => {
    state.auto = !state.auto;
    els.auto.textContent = state.auto ? "AUTO ◼" : "AUTO ▷";
    if (state.auto && state.phase === "idle") playRound();
  });

  els.newg.addEventListener("click", () => newGame());
  els.modalBtn.addEventListener("click", () => newGame());

  els.fs.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.();
    }
  });
  document.addEventListener("fullscreenchange", () => {
    els.fs.textContent = document.fullscreenElement ? "⛶ EXIT FS" : "⛶ FULLSCREEN";
    // Canvas needs a resize after fullscreen transition.
    resizeCanvas();
  });

  // Keyboard: space/enter to flip.
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (state.phase === "idle") playRound();
    }
  });

  // Kick off.
  newGame();
})();
