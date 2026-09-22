/* =========================================================
   VoetbalTeam Manager - app.js
   Hoofdlogica: single-page-app navigatie tussen 5 views
   ========================================================= */

(function () {
  "use strict";

  /**
   * Schakelt tussen views (schermen) op basis van de data-target
   * waarde van een nav-item. Werkt volledig client-side, geen
   * page reloads: alleen CSS classes worden getoggled.
   */
  function initNavigation() {
    const navButtons = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".view");

    function activateView(targetName) {
      views.forEach(function (view) {
        const isMatch = view.getAttribute("data-view") === targetName;
        view.classList.toggle("view--active", isMatch);
      });

      navButtons.forEach(function (btn) {
        const isMatch = btn.getAttribute("data-target") === targetName;
        btn.classList.toggle("nav-item--active", isMatch);
      });

      // Scroll terug naar boven bij wisselen van scherm
      const main = document.getElementById("main-content");
      if (main) {
        main.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
      }

      // Onthoud laatst geopende view voor volgend bezoek
      try {
        localStorage.setItem("vtm:lastView", targetName);
      } catch (e) {
        /* localStorage niet beschikbaar (bv. privénavigatie) — geen probleem */
      }

      // Laat andere modules weten dat een view actief is geworden,
      // zodat ze hun data desgewenst kunnen verversen.
      document.dispatchEvent(new CustomEvent("vtm:view-activated", { detail: { view: targetName } }));
    }

    navButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const target = btn.getAttribute("data-target");
        if (target) {
          activateView(target);
        }
      });
    });

    // Open de laatst bekeken view, of anders het dashboard
    let initialView = "dashboard";
    try {
      const stored = localStorage.getItem("vtm:lastView");
      if (stored) {
        initialView = stored;
      }
    } catch (e) {
      /* negeren */
    }
    activateView(initialView);
  }

  /* =========================================================
     Teambeheer: teams, seizoenen en spelers
     Alle data wordt bewaard in localStorage zodat de app
     na herladen dezelfde stand toont.
     ========================================================= */

  const TEAM_STORAGE_KEY = "vtm:teamData";

  const STATUS_LABELS = {
    fit: "Fit",
    geblesseerd: "Geblesseerd",
    afwezig: "Afwezig"
  };

  const POSITION_ABBR = {
    Keeper: "K",
    Verdediger: "V",
    Middenvelder: "M",
    Aanvaller: "A"
  };

  /**
   * Genereert een korte, unieke id met een prefix (bv. "team" of "player").
   */
  function createId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Zet een volledige naam om in maximaal 2 hoofdletters (initialen),
   * gebruikt voor avatars in spelerslijsten, bank-kaarten en veld-tokens.
   */
  function getInitials(name) {
    const initials = name
      .trim()
      .split(/\s+/)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .slice(0, 2)
      .join("");
    return initials || "?";
  }

  /**
   * Standaard startdata die wordt gebruikt zolang er nog niets
   * in localStorage staat (bv. bij de allereerste keer openen).
   */
  function getDefaultTeamData() {
    const defaultTeamId = createId("team");
    return {
      activeTeamId: defaultTeamId,
      teams: [
        {
          id: defaultTeamId,
          name: "JO13-1",
          season: "2025 / 2026",
          players: [
            { id: createId("player"), name: "Sem de Vries", positions: ["Aanvaller"], status: "fit", isGuest: false, seasonMinutes: 0 },
            { id: createId("player"), name: "Lars Bakker", positions: ["Middenvelder"], status: "fit", isGuest: false, seasonMinutes: 0 },
            { id: createId("player"), name: "Noah Jansen", positions: ["Verdediger"], status: "fit", isGuest: false, seasonMinutes: 0 }
          ]
        }
      ]
    };
  }

  /**
   * Laadt teamdata uit localStorage, of valt terug op de standaarddata
   * wanneer er nog niets is opgeslagen of de data corrupt is.
   */
  function loadTeamData() {
    try {
      const raw = localStorage.getItem(TEAM_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.teams) && parsed.teams.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Kon teamdata niet laden uit localStorage:", e);
    }
    return getDefaultTeamData();
  }

  /**
   * Slaat de volledige teamdata op in localStorage.
   */
  function saveTeamData(data) {
    try {
      localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error("Kon teamdata niet opslaan in localStorage:", e);
    }
  }

  /**
   * Voegt geïmporteerde teams en spelers samen met de al lokaal opgeslagen
   * teamdata. Er wordt nooit iets bestaands verwijderd of overschreven:
   * - Een geïmporteerd team met een onbekend id wordt als nieuw team
   *   toegevoegd aan de lijst.
   * - Een geïmporteerd team met een al bekend id (bv. je eigen team dat
   *   een collega ook heeft geëxporteerd) blijft lokaal ongewijzigd,
   *   behalve dat spelers uit de import die nog niet in je eigen
   *   spelerslijst staan (op id) daaraan worden toegevoegd.
   */
  function mergeTeamData(localTeamData, importedTeamData) {
    const merged = {
      activeTeamId: localTeamData.activeTeamId,
      teams: localTeamData.teams.map(function (team) {
        return Object.assign({}, team, { players: team.players.slice() });
      })
    };

    let addedTeams = 0;
    let addedPlayers = 0;

    (Array.isArray(importedTeamData.teams) ? importedTeamData.teams : []).forEach(function (importedTeam) {
      const existingTeam = merged.teams.find(function (team) {
        return team.id === importedTeam.id;
      });

      if (!existingTeam) {
        merged.teams.push(JSON.parse(JSON.stringify(importedTeam)));
        addedTeams += 1;
        addedPlayers += Array.isArray(importedTeam.players) ? importedTeam.players.length : 0;
        return;
      }

      (Array.isArray(importedTeam.players) ? importedTeam.players : []).forEach(function (importedPlayer) {
        const alreadyExists = existingTeam.players.some(function (player) {
          return player.id === importedPlayer.id;
        });
        if (!alreadyExists) {
          existingTeam.players.push(JSON.parse(JSON.stringify(importedPlayer)));
          addedPlayers += 1;
        }
      });
    });

    if (!merged.teams.some(function (team) { return team.id === merged.activeTeamId; })) {
      merged.activeTeamId = merged.teams.length > 0 ? merged.teams[0].id : merged.activeTeamId;
    }

    return { teamData: merged, addedTeams: addedTeams, addedPlayers: addedPlayers };
  }

  /**
   * Initialiseert het Teambeheer-scherm: team-/seizoenbeheer,
   * spelersbeheer (toevoegen, bewerken, verwijderen) en persistentie.
   */
  function initTeamManagement() {
    const selectTeam = document.getElementById("select-team");
    const btnAddTeam = document.getElementById("btn-add-team");
    const teamDetailsCard = document.getElementById("team-details-card");
    const teamForm = document.getElementById("team-form");
    const teamNameInput = document.getElementById("team-name");
    const teamSeasonInput = document.getElementById("team-season");
    const btnDeleteTeam = document.getElementById("btn-delete-team");

    const playerForm = document.getElementById("player-form");
    const playerNameInput = document.getElementById("player-name");
    const playerPositionsWrap = document.getElementById("player-positions");
    const playerStatusSelect = document.getElementById("player-status");
    const playerGuestCheckbox = document.getElementById("player-guest");
    const btnPlayerSubmit = document.getElementById("btn-player-submit");
    const btnPlayerCancel = document.getElementById("btn-player-cancel");

    const playerListEl = document.getElementById("player-list");
    const playerListEmpty = document.getElementById("player-list-empty");

    if (!selectTeam || !teamForm || !playerForm || !playerListEl) {
      return; // Teambeheer-view niet (meer) aanwezig in de DOM
    }

    const teamData = loadTeamData();
    let editingPlayerId = null;

    function persist() {
      saveTeamData(teamData);
    }

    function getActiveTeam() {
      return teamData.teams.find(function (team) {
        return team.id === teamData.activeTeamId;
      }) || teamData.teams[0];
    }

    function setPlayerSubmitLabel(isEditing) {
      btnPlayerSubmit.innerHTML = isEditing
        ? '<span aria-hidden="true">💾</span> Wijzigingen opslaan'
        : '<span aria-hidden="true">👤</span> Speler toevoegen';
    }

    function renderTeamSelect() {
      selectTeam.innerHTML = "";
      teamData.teams.forEach(function (team) {
        const option = document.createElement("option");
        option.value = team.id;
        option.textContent = team.name + " (" + team.season + ")";
        selectTeam.appendChild(option);
      });
      selectTeam.value = teamData.activeTeamId;
    }

    function renderTeamForm() {
      const team = getActiveTeam();
      if (!team) {
        return;
      }
      teamNameInput.value = team.name;
      teamSeasonInput.value = team.season;
      btnDeleteTeam.disabled = teamData.teams.length <= 1;
    }

    function resetPlayerForm() {
      playerForm.reset();
      playerPositionsWrap.querySelectorAll(".chip").forEach(function (chip) {
        chip.classList.remove("chip--checked");
      });
      editingPlayerId = null;
      setPlayerSubmitLabel(false);
      btnPlayerCancel.hidden = true;
    }

    function renderPlayerList() {
      const team = getActiveTeam();
      playerListEl.innerHTML = "";

      if (!team || team.players.length === 0) {
        playerListEmpty.hidden = false;
        return;
      }
      playerListEmpty.hidden = true;

      const sortedPlayers = team.players.slice().sort(function (a, b) {
        return a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
      });

      sortedPlayers.forEach(function (player) {
        const li = document.createElement("li");
        li.className = "player-list__item";
        li.setAttribute("data-player-id", player.id);

        const avatar = document.createElement("span");
        avatar.className = "player-list__avatar";
        avatar.textContent = getInitials(player.name);

        const info = document.createElement("div");
        info.className = "player-list__info";

        const nameEl = document.createElement("span");
        nameEl.className = "player-list__name";
        nameEl.textContent = player.name;
        nameEl.title = player.name;

        const subRow = document.createElement("div");
        subRow.className = "player-list__subrow";

        const metaEl = document.createElement("span");
        metaEl.className = "player-list__meta";
        metaEl.textContent = player.positions.length > 0
          ? player.positions.map(function (pos) {
              return POSITION_ABBR[pos] || pos;
            }).join("/")
          : "\u2013";
        metaEl.title = player.positions.length > 0 ? player.positions.join(", ") : "Geen voorkeurspositie";

        const badgesEl = document.createElement("div");
        badgesEl.className = "player-list__badges";

        const statusBadge = document.createElement("span");
        statusBadge.className = "badge badge--" + player.status;
        statusBadge.textContent = STATUS_LABELS[player.status] || player.status;
        badgesEl.appendChild(statusBadge);

        if (player.isGuest) {
          const guestBadge = document.createElement("span");
          guestBadge.className = "badge badge--guest";
          guestBadge.textContent = "Gastspeler";
          badgesEl.appendChild(guestBadge);
        }

        subRow.appendChild(metaEl);
        subRow.appendChild(badgesEl);

        info.appendChild(nameEl);
        info.appendChild(subRow);

        const actions = document.createElement("div");
        actions.className = "player-list__actions";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "icon-btn";
        editBtn.setAttribute("aria-label", "Speler bewerken");
        editBtn.setAttribute("data-action", "edit");
        editBtn.textContent = "✏️";

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "icon-btn icon-btn--danger";
        deleteBtn.setAttribute("aria-label", "Speler verwijderen");
        deleteBtn.setAttribute("data-action", "delete");
        deleteBtn.textContent = "🗑️";

        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);

        li.appendChild(avatar);
        li.appendChild(info);
        li.appendChild(actions);
        playerListEl.appendChild(li);
      });
    }

    // --- Team-events ---

    selectTeam.addEventListener("change", function () {
      teamData.activeTeamId = selectTeam.value;
      persist();
      renderTeamForm();
      renderPlayerList();
      resetPlayerForm();
    });

    btnAddTeam.addEventListener("click", function () {
      const newTeam = { id: createId("team"), name: "Nieuw team", season: "", players: [] };
      teamData.teams.push(newTeam);
      teamData.activeTeamId = newTeam.id;
      persist();
      renderTeamSelect();
      renderTeamForm();
      renderPlayerList();
      resetPlayerForm();
      if (teamDetailsCard) {
        teamDetailsCard.open = true;
      }
      teamNameInput.focus();
      teamNameInput.select();
    });

    teamForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const team = getActiveTeam();
      if (!team) {
        return;
      }
      const name = teamNameInput.value.trim();
      const season = teamSeasonInput.value.trim();
      if (!name || !season) {
        return;
      }
      team.name = name;
      team.season = season;
      persist();
      renderTeamSelect();
    });

    btnDeleteTeam.addEventListener("click", function () {
      if (teamData.teams.length <= 1) {
        window.alert("Je kunt het laatste team niet verwijderen.");
        return;
      }
      const team = getActiveTeam();
      if (!team) {
        return;
      }
      const confirmed = window.confirm(
        'Weet je zeker dat je "' + team.name + '" wilt verwijderen? Dit verwijdert ook alle spelers van dit team.'
      );
      if (!confirmed) {
        return;
      }
      teamData.teams = teamData.teams.filter(function (t) {
        return t.id !== team.id;
      });
      teamData.activeTeamId = teamData.teams[0].id;
      persist();
      renderTeamSelect();
      renderTeamForm();
      renderPlayerList();
      resetPlayerForm();
    });

    // --- Speler-events ---

    playerPositionsWrap.querySelectorAll(".chip__input").forEach(function (checkbox) {
      checkbox.addEventListener("change", function () {
        checkbox.closest(".chip").classList.toggle("chip--checked", checkbox.checked);
      });
    });

    playerForm.addEventListener("submit", function (event) {
      event.preventDefault();
      const team = getActiveTeam();
      if (!team) {
        return;
      }

      const name = playerNameInput.value.trim();
      if (!name) {
        return;
      }

      const positions = Array.from(playerPositionsWrap.querySelectorAll(".chip__input:checked")).map(function (cb) {
        return cb.value;
      });
      const status = playerStatusSelect.value;
      const isGuest = playerGuestCheckbox.checked;

      if (editingPlayerId) {
        const player = team.players.find(function (p) {
          return p.id === editingPlayerId;
        });
        if (player) {
          player.name = name;
          player.positions = positions;
          player.status = status;
          player.isGuest = isGuest;
        }
      } else {
        team.players.push({
          id: createId("player"),
          name: name,
          positions: positions,
          status: status,
          isGuest: isGuest,
          seasonMinutes: 0
        });
      }

      persist();
      renderPlayerList();
      resetPlayerForm();
    });

    btnPlayerCancel.addEventListener("click", function () {
      resetPlayerForm();
    });

    playerListEl.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-action]");
      if (!button) {
        return;
      }
      const li = button.closest(".player-list__item");
      if (!li) {
        return;
      }
      const playerId = li.getAttribute("data-player-id");
      const team = getActiveTeam();
      if (!team) {
        return;
      }
      const action = button.getAttribute("data-action");

      if (action === "edit") {
        const player = team.players.find(function (p) {
          return p.id === playerId;
        });
        if (!player) {
          return;
        }
        editingPlayerId = player.id;
        playerNameInput.value = player.name;
        playerPositionsWrap.querySelectorAll(".chip__input").forEach(function (cb) {
          const checked = player.positions.indexOf(cb.value) !== -1;
          cb.checked = checked;
          cb.closest(".chip").classList.toggle("chip--checked", checked);
        });
        playerStatusSelect.value = player.status;
        playerGuestCheckbox.checked = player.isGuest;
        setPlayerSubmitLabel(true);
        btnPlayerCancel.hidden = false;
        playerNameInput.focus();
      } else if (action === "delete") {
        const confirmed = window.confirm("Weet je zeker dat je deze speler wilt verwijderen?");
        if (!confirmed) {
          return;
        }
        team.players = team.players.filter(function (p) {
          return p.id !== playerId;
        });
        persist();
        renderPlayerList();
        if (editingPlayerId === playerId) {
          resetPlayerForm();
        }
      }
    });

    // --- Ververs bij terugkeer naar dit scherm (bv. na een import) ---

    document.addEventListener("vtm:view-activated", function (event) {
      if (!event.detail || event.detail.view !== "teambeheer") {
        return;
      }
      const fresh = loadTeamData();
      teamData.teams = fresh.teams;
      teamData.activeTeamId = fresh.activeTeamId;
      renderTeamSelect();
      renderTeamForm();
      renderPlayerList();
      resetPlayerForm();
    });

    // --- Initieel renderen ---
    renderTeamSelect();
    renderTeamForm();
    renderPlayerList();
    resetPlayerForm();
  }

  /* =========================================================
     Dashboard: overzicht per team van spelers en speelminuten.
     ========================================================= */

  /**
   * Initialiseert het Dashboard-scherm: teamkeuze, statistiekkaarten,
   * de speelminutenlijst per speler en de eerstvolgende wedstrijd.
   */
  const DASHBOARD_SORT_KEY = "vtm:dashboardSort";

  function initDashboard() {
    const teamSelect = document.getElementById("dashboard-team-select");
    const sortSelect = document.getElementById("dashboard-sort-select");
    const statPlayersEl = document.getElementById("stat-players");
    const statGuestsEl = document.getElementById("stat-guests");
    const statTotalMinutesEl = document.getElementById("stat-total-minutes");
    const statAvgMinutesEl = document.getElementById("stat-avg-minutes");
    const emptyHintEl = document.getElementById("dashboard-empty-hint");
    const minutesListEl = document.getElementById("player-minutes-list");
    const upcomingTeamsEl = document.getElementById("upcoming-teams");
    const upcomingMetaEl = document.getElementById("upcoming-meta");

    if (!teamSelect || !minutesListEl) {
      return; // Dashboard-view niet (meer) aanwezig in de DOM
    }

    let selectedTeamId = null;
    let sortMode = localStorage.getItem(DASHBOARD_SORT_KEY) || "minutes-desc";
    if (sortSelect) {
      sortSelect.value = sortMode;
    }

    function sortPlayers(players) {
      const sorted = players.slice();
      if (sortMode === "alpha") {
        sorted.sort(function (a, b) {
          return a.name.localeCompare(b.name, "nl", { sensitivity: "base" });
        });
      } else if (sortMode === "minutes-asc") {
        sorted.sort(function (a, b) {
          return (a.seasonMinutes || 0) - (b.seasonMinutes || 0);
        });
      } else {
        sorted.sort(function (a, b) {
          return (b.seasonMinutes || 0) - (a.seasonMinutes || 0);
        });
      }
      return sorted;
    }

    function renderTeamSelect(teamData) {
      teamSelect.innerHTML = "";
      teamData.teams.forEach(function (team) {
        const option = document.createElement("option");
        option.value = team.id;
        option.textContent = team.name + (team.season ? " (" + team.season + ")" : "");
        teamSelect.appendChild(option);
      });
      const stillExists = teamData.teams.some(function (team) {
        return team.id === selectedTeamId;
      });
      if (!stillExists) {
        selectedTeamId = teamData.activeTeamId;
      }
      teamSelect.value = selectedTeamId;
    }

    function formatMatchDate(dateStr) {
      const parsed = new Date(dateStr + "T00:00:00");
      if (isNaN(parsed.getTime())) {
        return dateStr;
      }
      return parsed.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
    }

    function renderUpcomingMatch(team) {
      const matchStore = loadMatchStore();
      const bucket = ensureTeamMatchBucket(matchStore, team);
      const match = getBucketMatch(bucket, bucket.activeMatchId);
      if (!match || !match.opponent) {
        upcomingTeamsEl.textContent = "–";
        upcomingMetaEl.textContent = "Geen wedstrijd ingepland";
        return;
      }
      upcomingTeamsEl.innerHTML = team.name + ' <span class="upcoming-card__vs">vs</span> ' + match.opponent;
      const parts = [];
      if (match.date) {
        parts.push(formatMatchDate(match.date));
      }
      if (match.time) {
        parts.push(match.time);
      }
      upcomingMetaEl.textContent = parts.length > 0 ? parts.join(" · ") : "Datum/tijd nog niet ingevuld";
    }

    function render() {
      const teamData = loadTeamData();
      renderTeamSelect(teamData);

      const team = teamData.teams.find(function (t) {
        return t.id === selectedTeamId;
      }) || teamData.teams[0];

      if (!team) {
        return;
      }

      const players = team.players;
      const guestCount = players.filter(function (p) {
        return p.isGuest;
      }).length;
      const totalMinutes = players.reduce(function (sum, p) {
        return sum + (p.seasonMinutes || 0);
      }, 0);
      const avgMinutes = players.length > 0 ? Math.round(totalMinutes / players.length) : 0;

      statPlayersEl.textContent = String(players.length);
      statGuestsEl.textContent = String(guestCount);
      statTotalMinutesEl.textContent = totalMinutes + "'";
      statAvgMinutesEl.textContent = avgMinutes + "'";

      minutesListEl.innerHTML = "";
      if (players.length === 0) {
        emptyHintEl.hidden = false;
      } else {
        emptyHintEl.hidden = true;
        const maxMinutes = players.reduce(function (max, p) {
          return Math.max(max, p.seasonMinutes || 0);
        }, 0);

        const sortedPlayers = sortPlayers(players);

        sortedPlayers.forEach(function (player) {
          const minutes = player.seasonMinutes || 0;
          const pct = maxMinutes > 0 ? Math.round((minutes / maxMinutes) * 100) : 0;

          const li = document.createElement("li");
          li.className = "player-minutes-item";

          const nameEl = document.createElement("span");
          nameEl.className = "player-minutes-item__name";
          nameEl.textContent = player.name;

          const barWrap = document.createElement("div");
          barWrap.className = "player-minutes-item__bar";
          const barFill = document.createElement("span");
          barFill.style.width = pct + "%";
          barWrap.appendChild(barFill);

          const valueEl = document.createElement("span");
          valueEl.className = "player-minutes-item__value";
          valueEl.textContent = minutes + "'";

          li.appendChild(nameEl);
          li.appendChild(barWrap);
          li.appendChild(valueEl);
          minutesListEl.appendChild(li);
        });
      }

      renderUpcomingMatch(team);
    }

    teamSelect.addEventListener("change", function () {
      selectedTeamId = teamSelect.value;
      render();
    });

    if (sortSelect) {
      sortSelect.addEventListener("change", function () {
        sortMode = sortSelect.value;
        localStorage.setItem(DASHBOARD_SORT_KEY, sortMode);
        render();
      });
    }

    document.addEventListener("vtm:view-activated", function (event) {
      if (event.detail && event.detail.view === "dashboard") {
        render();
      }
    });

    render();
  }

  /* =========================================================
     Wedstrijd & Opstelling: wedstrijdformulier, afwezigheid,
     de wisselbank en het versleepbare visuele veld.
     ========================================================= */

  const MATCH_STORAGE_KEY = "vtm:matchData";

  /**
   * Zet de opgeslagen wedstrijddata van één team om naar het huidige
   * formaat: { matches: [...], activeMatchId }. Zo kan een team meerdere
   * wedstrijden hebben (bv. een paar wedstrijden vooruit voorbereiden) in
   * plaats van maar 1 wedstrijd-"slot". Herkent en migreert ook het oude
   * formaat (vóór meerdere wedstrijden per team), waarin er direct één
   * wedstrijdobject stond in plaats van een { matches, activeMatchId }.
   */
  function normalizeMatchBucket(raw) {
    if (!raw || typeof raw !== "object") {
      return { matches: [], activeMatchId: null };
    }

    if (!Array.isArray(raw.matches)) {
      // Oud formaat: raw ís het wedstrijdobject zelf.
      if (raw.lineupBlocks || raw.opponent !== undefined) {
        const migrated = JSON.parse(JSON.stringify(raw));
        if (!migrated.id) {
          migrated.id = createId("match");
        }
        return { matches: [migrated], activeMatchId: migrated.id };
      }
      return { matches: [], activeMatchId: null };
    }

    const matches = raw.matches.map(function (match) {
      return match.id ? match : Object.assign({}, match, { id: createId("match") });
    });
    const activeStillExists = matches.some(function (match) {
      return match.id === raw.activeMatchId;
    });
    return {
      matches: matches,
      activeMatchId: activeStillExists ? raw.activeMatchId : (matches.length > 0 ? matches[0].id : null)
    };
  }

  /**
   * Zoekt een specifieke wedstrijd op in een bucket, of valt terug op de
   * eerste wedstrijd wanneer het opgegeven id niet (meer) bestaat.
   */
  function getBucketMatch(bucket, matchId) {
    return bucket.matches.find(function (match) {
      return match.id === matchId;
    }) || bucket.matches[0] || null;
  }

  /**
   * Zorgt dat een team altijd minstens 1 wedstrijd heeft in de opgegeven
   * matchStore (maakt er anders een lege standaardwedstrijd bij aan) en
   * geeft de (genormaliseerde) bucket van dat team terug.
   */
  function ensureTeamMatchBucket(matchStore, team) {
    const bucket = normalizeMatchBucket(matchStore[team.id]);
    if (bucket.matches.length === 0) {
      const defaultMatch = getDefaultMatch(team);
      bucket.matches.push(defaultMatch);
      bucket.activeMatchId = defaultMatch.id;
    }
    matchStore[team.id] = bucket;
    return bucket;
  }

  /**
   * Laadt alle wedstrijddata (per team) uit localStorage. Elk team-item
   * wordt genormaliseerd naar { matches: [...], activeMatchId } zodat de
   * rest van de app altijd met hetzelfde (huidige) formaat werkt, ook als
   * er nog oudere data (1 wedstrijd per team) in localStorage staat.
   */
  function loadMatchStore() {
    let raw = {};
    try {
      const stored = localStorage.getItem(MATCH_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          raw = parsed;
        }
      }
    } catch (e) {
      console.error("Kon wedstrijddata niet laden uit localStorage:", e);
    }

    const normalized = {};
    Object.keys(raw).forEach(function (teamId) {
      normalized[teamId] = normalizeMatchBucket(raw[teamId]);
    });
    return normalized;
  }

  /**
   * Slaat alle wedstrijddata (per team) op in localStorage.
   */
  function saveMatchStore(store) {
    try {
      localStorage.setItem(MATCH_STORAGE_KEY, JSON.stringify(store));
    } catch (e) {
      console.error("Kon wedstrijddata niet opslaan in localStorage:", e);
    }
  }

  /**
   * Voegt geïmporteerde wedstrijden samen met de al lokaal opgeslagen
   * wedstrijddata. Een team kan meerdere wedstrijden hebben; bestaande
   * wedstrijden worden nooit stilzwijgend overschreven:
   * - Heeft het team lokaal nog helemaal geen wedstrijden, of is de
   *   geïmporteerde wedstrijd (op datum + tegenstander) nog niet bekend,
   *   dan wordt de geïmporteerde wedstrijd gewoon toegevoegd naast de
   *   eventueel al bestaande wedstrijden.
   * - Is de geïmporteerde wedstrijd (zelfde datum + tegenstander) al
   *   lokaal bekend, dan wordt om bevestiging gevraagd voordat de
   *   gegevens worden bijgewerkt.
   */
  function mergeMatchData(localMatchStore, importedMatchData) {
    const merged = {};
    Object.keys(localMatchStore || {}).forEach(function (teamId) {
      const bucket = normalizeMatchBucket(localMatchStore[teamId]);
      merged[teamId] = { matches: JSON.parse(JSON.stringify(bucket.matches)), activeMatchId: bucket.activeMatchId };
    });

    let addedMatches = 0;
    let updatedMatches = 0;
    let skippedMatches = 0;

    Object.keys(importedMatchData || {}).forEach(function (teamId) {
      const importedBucket = normalizeMatchBucket(importedMatchData[teamId]);
      if (importedBucket.matches.length === 0) {
        return;
      }

      if (!merged[teamId]) {
        merged[teamId] = { matches: [], activeMatchId: null };
      }
      const localBucket = merged[teamId];

      importedBucket.matches.forEach(function (importedMatch) {
        if (!importedMatch.opponent) {
          // Lege/nog niet ingevulde wedstrijd: alleen toevoegen als het team
          // lokaal nog helemaal niets heeft klaarstaan.
          if (localBucket.matches.length === 0) {
            const cloned = JSON.parse(JSON.stringify(importedMatch));
            localBucket.matches.push(cloned);
            localBucket.activeMatchId = cloned.id;
            addedMatches += 1;
          }
          return;
        }

        const existingMatch = localBucket.matches.find(function (match) {
          return match.date === importedMatch.date && match.opponent === importedMatch.opponent;
        });

        if (!existingMatch) {
          const cloned = JSON.parse(JSON.stringify(importedMatch));
          if (localBucket.matches.some(function (match) { return match.id === cloned.id; })) {
            cloned.id = createId("match"); // voorkom id-botsing met een lokale wedstrijd
          }
          localBucket.matches.push(cloned);
          if (!localBucket.activeMatchId) {
            localBucket.activeMatchId = cloned.id;
          }
          addedMatches += 1;
          return;
        }

        const question = "Wedstrijd tegen " + importedMatch.opponent + " op " + (importedMatch.date || "onbekende datum") + " bestaat al. Wilt u de gegevens updaten met de nieuwe import?";
        const confirmed = window.confirm(question);
        if (confirmed) {
          const cloned = JSON.parse(JSON.stringify(importedMatch));
          cloned.id = existingMatch.id; // lokale id behouden zodat de actieve selectie geldig blijft
          const index = localBucket.matches.indexOf(existingMatch);
          localBucket.matches[index] = cloned;
          updatedMatches += 1;
        } else {
          skippedMatches += 1;
        }
      });
    });

    return { matchData: merged, addedMatches: addedMatches, updatedMatches: updatedMatches, skippedMatches: skippedMatches };
  }

  /**
   * Standaard wedstrijdgegevens voor een team dat nog geen wedstrijd
   * heeft aangemaakt. Spelers die niet 'fit' zijn worden alvast als
   * afwezig gemarkeerd (kan altijd handmatig aangepast worden).
   * Er wordt altijd één basisblok aangemaakt vanaf minuut 0.
   */
  function getDefaultMatch(team) {
    const baseBlockId = createId("block");
    return {
      id: createId("match"),
      opponent: "",
      date: "",
      time: "",
      duration: 70,
      type: "competitie",
      homeAway: "thuis",
      absentPlayerIds: team.players
        .filter(function (player) {
          return player.status !== "fit";
        })
        .map(function (player) {
          return player.id;
        }),
      lineupBlocks: [{ id: baseBlockId, startMinute: 0, positions: {} }],
      activeBlockId: baseBlockId
    };
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /**
   * Zoekt het actieve tijdsblok (wisselmoment) van een wedstrijd op.
   */
  function getActiveBlock(match) {
    return (
      match.lineupBlocks.find(function (block) {
        return block.id === match.activeBlockId;
      }) || match.lineupBlocks[0]
    );
  }

  function getBlockIndex(match, block) {
    return match.lineupBlocks.indexOf(block);
  }

  /**
   * Het vorige tijdsblok is het vertrekpunt/vergelijkingspunt voor
   * kleurcodering. Het eerste blok (minuut 0) heeft geen voorganger.
   */
  function getPreviousBlock(match, block) {
    const index = getBlockIndex(match, block);
    return index > 0 ? match.lineupBlocks[index - 1] : null;
  }

  function getBlockEndLabel(match, index) {
    const isLast = index === match.lineupBlocks.length - 1;
    return isLast ? "Einde wedstrijd" : "Minuut " + match.lineupBlocks[index + 1].startMinute;
  }

  function getBlockLabel(match, index) {
    return "Minuut " + match.lineupBlocks[index].startMinute + " - " + getBlockEndLabel(match, index);
  }

  /**
   * Korte label voor een tijdsblok/opstelling, zoals gebruikt in de
   * bloktabs (Opstelling) en de opstelling-kiezer (Live Tracker).
   */
  function getBlockShortLabel(match, index) {
    return index === 0 ? "Basis (min. 0)" : "Vanaf min. " + match.lineupBlocks[index].startMinute;
  }

  /**
   * Kort, herkenbaar label voor een wedstrijd, gebruikt in de
   * wedstrijd-kiezers van zowel Opstelling als Live Tracker.
   */
  function getMatchLabel(match) {
    if (!match.opponent) {
      return "Nieuwe wedstrijd";
    }
    let label = "vs " + match.opponent;
    if (match.date) {
      const parsed = new Date(match.date + "T00:00:00");
      if (!isNaN(parsed.getTime())) {
        label += " (" + parsed.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) + ")";
      }
    }
    return label;
  }

  /**
   * Initialiseert het Wedstrijd &amp; Opstelling-scherm: formulier,
   * afwezigheidslijst, wisselmomenten, wisselbank en het sleepbare
   * visuele veld.
   */
  function initMatchManagement() {
    const matchSelectEl = document.getElementById("match-select");
    const btnAddMatch = document.getElementById("btn-add-match");
    const btnDeleteMatch = document.getElementById("btn-delete-match");
    const matchSummaryDetails = document.getElementById("match-summary");
    const matchSummaryLineEl = document.getElementById("match-summary-line");
    const matchForm = document.getElementById("match-form");
    const opponentInput = document.getElementById("opponent");
    const dateInput = document.getElementById("match-date");
    const timeInput = document.getElementById("match-time");
    const durationInput = document.getElementById("match-duration");
    const typeSelect = document.getElementById("match-type");
    const homeAwayButtons = Array.from(document.querySelectorAll("#match-home-away .toggle-btn"));

    const absenceListEl = document.getElementById("absence-list");
    const blockTabsEl = document.getElementById("block-tabs");
    const newBlockMinuteInput = document.getElementById("new-block-minute");
    const btnAddBlock = document.getElementById("btn-add-block");
    const blockActiveLabelEl = document.getElementById("block-active-label");
    const pitchEl = document.getElementById("pitch");
    const benchEl = document.getElementById("bench");
    const benchEmptyEl = document.getElementById("bench-empty");
    const saveHintEl = document.getElementById("lineup-save-hint");

    if (!matchForm || !pitchEl || !benchEl) {
      return; // Wedstrijd-view niet (meer) aanwezig in de DOM
    }

    let matchStore = null;
    let currentTeam = null;
    let currentBucket = null;
    let currentMatch = null;
    let saveHintTimeoutId = null;

    function persistMatchStore() {
      saveMatchStore(matchStore);
    }

    function showAutosaveHint() {
      saveHintEl.hidden = false;
      window.clearTimeout(saveHintTimeoutId);
      saveHintTimeoutId = window.setTimeout(function () {
        saveHintEl.hidden = true;
      }, 2000);
    }

    /**
     * Migratie voor wedstrijden die zijn aangemaakt vóór de introductie
     * van meerdere tijdsblokken (wisselmomenten) binnen een wedstrijd.
     */
    function ensureLineupBlocksMigrated(match) {
      if (!Array.isArray(match.lineupBlocks) || match.lineupBlocks.length === 0) {
        const baseBlockId = createId("block");
        match.lineupBlocks = [{ id: baseBlockId, startMinute: 0, positions: match.lineup || {} }];
        match.activeBlockId = baseBlockId;
        delete match.lineup;
        delete match.lineupSnapshots;
      }
    }

    /**
     * Vult de wedstrijd-kiezer met alle wedstrijden van het huidige team,
     * zodat de trainer kan wisselen tussen bv. meerdere komende
     * wedstrijden waarvoor alvast een opstelling wordt voorbereid.
     */
    function renderMatchSelect() {
      if (!matchSelectEl) {
        return;
      }
      matchSelectEl.innerHTML = "";
      currentBucket.matches.forEach(function (match) {
        const option = document.createElement("option");
        option.value = match.id;
        option.textContent = getMatchLabel(match);
        matchSelectEl.appendChild(option);
      });
      matchSelectEl.value = currentMatch.id;
      if (btnDeleteMatch) {
        btnDeleteMatch.disabled = currentBucket.matches.length <= 1;
      }
    }

    /**
     * Activeert een specifieke wedstrijd van het huidige team: past de
     * migratie toe indien nodig en ververst het volledige scherm.
     */
    function selectMatch(match) {
      currentMatch = match;
      currentBucket.activeMatchId = match.id;
      ensureLineupBlocksMigrated(currentMatch);
      persistMatchStore();

      loadFormFromMatch();
      renderMatchSummaryLine();
      // Al ingevulde wedstrijden tonen we ingeklapt (max 1 regel); pas als
      // er nog geen tegenstander bekend is, staat het blok open om in te vullen.
      matchSummaryDetails.open = !currentMatch.opponent;
      renderAbsenceList();
      renderBlockTabs();
      renderActiveBlockLabel();
      renderPitch();
      renderBench();
      renderMatchSelect();
    }

    function loadFormFromMatch() {
      opponentInput.value = currentMatch.opponent;
      dateInput.value = currentMatch.date;
      timeInput.value = currentMatch.time;
      durationInput.value = currentMatch.duration;
      typeSelect.value = currentMatch.type;
      homeAwayButtons.forEach(function (btn) {
        btn.classList.toggle("toggle-btn--active", btn.getAttribute("data-value") === currentMatch.homeAway);
      });
    }

    function formatMatchDateShort(dateStr) {
      const parsed = new Date(dateStr + "T00:00:00");
      if (isNaN(parsed.getTime())) {
        return dateStr;
      }
      return parsed.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
    }

    /**
     * Bouwt de 1-regelige samenvatting die zichtbaar blijft als het
     * wedstrijdblok is ingeklapt (na invullen/opslaan).
     */
    function renderMatchSummaryLine() {
      if (!currentMatch.opponent) {
        matchSummaryLineEl.textContent = "Wedstrijdgegevens invullen…";
        return;
      }
      const parts = [(currentMatch.homeAway === "uit" ? "🚗" : "🏠") + " vs " + currentMatch.opponent];
      if (currentMatch.date) {
        parts.push(formatMatchDateShort(currentMatch.date));
      }
      if (currentMatch.time) {
        parts.push(currentMatch.time);
      }
      parts.push(currentMatch.duration + " min");
      const absentCount = currentMatch.absentPlayerIds.length;
      if (absentCount > 0) {
        parts.push(absentCount + " afwezig");
      }
      matchSummaryLineEl.textContent = parts.join(" · ");
    }

    function renderAbsenceList() {
      absenceListEl.innerHTML = "";
      currentTeam.players.forEach(function (player) {
        const li = document.createElement("li");
        li.className = "absence-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = currentMatch.absentPlayerIds.indexOf(player.id) !== -1;

        checkbox.addEventListener("change", function () {
          if (checkbox.checked) {
            if (currentMatch.absentPlayerIds.indexOf(player.id) === -1) {
              currentMatch.absentPlayerIds.push(player.id);
            }
            // Een afwezige speler kan in geen enkel tijdsblok op het veld staan
            currentMatch.lineupBlocks.forEach(function (block) {
              delete block.positions[player.id];
            });
          } else {
            currentMatch.absentPlayerIds = currentMatch.absentPlayerIds.filter(function (id) {
              return id !== player.id;
            });
          }
          persistMatchStore();
          showAutosaveHint();
          renderMatchSummaryLine();
          renderPitch();
          renderBench();
        });

        const nameEl = document.createElement("span");
        nameEl.className = "absence-item__name";
        nameEl.textContent = player.name;

        const metaEl = document.createElement("span");
        metaEl.className = "absence-item__meta";
        metaEl.textContent = player.positions.length > 0 ? player.positions.join(", ") : "";

        li.appendChild(checkbox);
        li.appendChild(nameEl);
        li.appendChild(metaEl);

        li.addEventListener("click", function (event) {
          if (event.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event("change"));
          }
        });

        absenceListEl.appendChild(li);
      });
    }

    function renderBlockTabs() {
      blockTabsEl.innerHTML = "";

      currentMatch.lineupBlocks.forEach(function (block, index) {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "block-tab" + (block.id === currentMatch.activeBlockId ? " block-tab--active" : "");
        tab.textContent = getBlockShortLabel(currentMatch, index);

        tab.addEventListener("click", function () {
          currentMatch.activeBlockId = block.id;
          persistMatchStore();
          renderBlockTabs();
          renderActiveBlockLabel();
          renderPitch();
          renderBench();
        });

        // Alleen het laatste (meest recente) wisselmoment mag verwijderd worden
        if (index > 0 && index === currentMatch.lineupBlocks.length - 1) {
          const deleteBtn = document.createElement("span");
          deleteBtn.className = "block-tab__delete";
          deleteBtn.textContent = "✕";
          deleteBtn.setAttribute("role", "button");
          deleteBtn.setAttribute("aria-label", "Wisselmoment verwijderen");
          deleteBtn.addEventListener("click", function (event) {
            event.stopPropagation();
            const confirmed = window.confirm(
              "Wisselmoment vanaf minuut " + block.startMinute + " verwijderen?"
            );
            if (!confirmed) {
              return;
            }
            currentMatch.lineupBlocks = currentMatch.lineupBlocks.filter(function (b) {
              return b.id !== block.id;
            });
            currentMatch.activeBlockId = currentMatch.lineupBlocks[currentMatch.lineupBlocks.length - 1].id;
            persistMatchStore();
            showAutosaveHint();
            renderBlockTabs();
            renderActiveBlockLabel();
            renderPitch();
            renderBench();
          });
          tab.appendChild(deleteBtn);
        }

        blockTabsEl.appendChild(tab);
      });
    }

    function renderActiveBlockLabel() {
      const activeBlock = getActiveBlock(currentMatch);
      const index = getBlockIndex(currentMatch, activeBlock);
      blockActiveLabelEl.textContent = "Actief blok: " + getBlockLabel(currentMatch, index);
    }

    function createPitchToken(player, pos, changeType) {
      const token = document.createElement("div");
      let className = "pitch-token";
      if (player.isGuest) {
        className += " pitch-token--guest";
      }
      if (changeType === "new-in") {
        className += " pitch-token--new-in";
      } else if (changeType === "moved") {
        className += " pitch-token--moved";
      }
      token.className = className;
      token.style.left = pos.x + "%";
      token.style.top = pos.y + "%";
      token.setAttribute("data-player-id", player.id);

      const avatar = document.createElement("span");
      avatar.className = "pitch-token__avatar";
      avatar.textContent = getInitials(player.name);

      const nameEl = document.createElement("span");
      nameEl.className = "pitch-token__name";
      nameEl.textContent = player.name.split(/\s+/)[0];

      const minutesEl = document.createElement("span");
      minutesEl.className = "pitch-token__minutes";
      minutesEl.textContent = (player.seasonMinutes || 0) + "'";

      token.appendChild(avatar);
      token.appendChild(nameEl);
      token.appendChild(minutesEl);

      token.addEventListener("pointerdown", function (event) {
        startDrag(event, token, player.id, "pitch");
      });

      return token;
    }

    function renderPitch() {
      pitchEl.querySelectorAll(".pitch-token").forEach(function (el) {
        el.remove();
      });

      const activeBlock = getActiveBlock(currentMatch);
      const previousBlock = getPreviousBlock(currentMatch, activeBlock);

      Object.keys(activeBlock.positions).forEach(function (playerId) {
        const player = currentTeam.players.find(function (p) {
          return p.id === playerId;
        });
        if (!player || currentMatch.absentPlayerIds.indexOf(playerId) !== -1) {
          delete activeBlock.positions[playerId];
          return;
        }

        const pos = activeBlock.positions[playerId];
        let changeType = null;

        if (previousBlock) {
          const prevPos = previousBlock.positions[playerId];
          if (!prevPos) {
            changeType = "new-in"; // nieuw vanaf de bank ingevallen
          } else if (prevPos.x !== pos.x || prevPos.y !== pos.y) {
            changeType = "moved"; // stond al op het veld, andere positie
          }
        }

        pitchEl.appendChild(createPitchToken(player, pos, changeType));
      });
    }

    function renderBench() {
      benchEl.querySelectorAll(".bench-card").forEach(function (el) {
        el.remove();
      });

      const activeBlock = getActiveBlock(currentMatch);
      const benchPlayers = currentTeam.players.filter(function (player) {
        return currentMatch.absentPlayerIds.indexOf(player.id) === -1 && !activeBlock.positions[player.id];
      });

      benchEmptyEl.hidden = benchPlayers.length > 0;

      benchPlayers.forEach(function (player) {
        const card = document.createElement("div");
        card.className = "bench-card" + (player.isGuest ? " bench-card--guest" : "");
        card.setAttribute("data-player-id", player.id);

        const avatar = document.createElement("span");
        avatar.className = "bench-card__avatar";
        avatar.textContent = getInitials(player.name);

        const nameEl = document.createElement("span");
        nameEl.className = "bench-card__name";
        nameEl.textContent = player.name;

        const minutesEl = document.createElement("span");
        minutesEl.className = "bench-card__minutes";
        minutesEl.textContent = (player.seasonMinutes || 0) + "'";

        card.appendChild(avatar);
        card.appendChild(nameEl);
        card.appendChild(minutesEl);

        card.addEventListener("pointerdown", function (event) {
          startDrag(event, card, player.id, "bench");
        });

        benchEl.appendChild(card);
      });
    }

    /**
     * Universele sleeplogica op basis van Pointer Events, zodat muis-
     * en touch-bediening op precies dezelfde manier werken.
     */
    function startDrag(event, sourceEl, playerId, origin) {
      if (event.button !== undefined && event.button !== 0) {
        return; // alleen linkermuisknop / primaire aanraking
      }
      event.preventDefault();

      const player = currentTeam.players.find(function (p) {
        return p.id === playerId;
      });
      if (!player) {
        return;
      }

      sourceEl.classList.add("is-dragging");

      const ghost = document.createElement("div");
      ghost.className = "drag-ghost pitch-token" + (player.isGuest ? " pitch-token--guest" : "");

      const avatar = document.createElement("span");
      avatar.className = "pitch-token__avatar";
      avatar.textContent = getInitials(player.name);

      const nameEl = document.createElement("span");
      nameEl.className = "pitch-token__name";
      nameEl.textContent = player.name.split(/\s+/)[0];

      ghost.appendChild(avatar);
      ghost.appendChild(nameEl);
      document.body.appendChild(ghost);

      function moveGhostTo(clientX, clientY) {
        ghost.style.transform = "translate(" + clientX + "px, " + clientY + "px) translate(-50%, -50%)";
      }

      moveGhostTo(event.clientX, event.clientY);

      function onPointerMove(moveEvent) {
        moveGhostTo(moveEvent.clientX, moveEvent.clientY);
      }

      function onPointerUp(upEvent) {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
        ghost.remove();
        sourceEl.classList.remove("is-dragging");

        const activeBlock = getActiveBlock(currentMatch);
        const pitchRect = pitchEl.getBoundingClientRect();
        const droppedInPitch =
          upEvent.clientX >= pitchRect.left &&
          upEvent.clientX <= pitchRect.right &&
          upEvent.clientY >= pitchRect.top &&
          upEvent.clientY <= pitchRect.bottom;

        if (droppedInPitch) {
          const xPct = clamp(((upEvent.clientX - pitchRect.left) / pitchRect.width) * 100, 4, 96);
          const yPct = clamp(((upEvent.clientY - pitchRect.top) / pitchRect.height) * 100, 4, 96);
          activeBlock.positions[playerId] = {
            x: Math.round(xPct * 10) / 10,
            y: Math.round(yPct * 10) / 10
          };
        } else if (origin === "pitch") {
          delete activeBlock.positions[playerId]; // terug naar de bank
        }

        persistMatchStore();
        showAutosaveHint();
        renderPitch();
        renderBench();
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    }

    function refreshForActiveTeam() {
      const teamData = loadTeamData();
      currentTeam = teamData.teams.find(function (team) {
        return team.id === teamData.activeTeamId;
      }) || teamData.teams[0];

      if (!currentTeam) {
        return;
      }

      matchStore = loadMatchStore();
      currentBucket = ensureTeamMatchBucket(matchStore, currentTeam);
      persistMatchStore();
      selectMatch(getBucketMatch(currentBucket, currentBucket.activeMatchId));
    }

    // --- Wedstrijd kiezen, toevoegen en verwijderen ---

    if (matchSelectEl) {
      matchSelectEl.addEventListener("change", function () {
        const match = currentBucket.matches.find(function (m) {
          return m.id === matchSelectEl.value;
        });
        if (match) {
          selectMatch(match);
        }
      });
    }

    if (btnAddMatch) {
      btnAddMatch.addEventListener("click", function () {
        const newMatch = getDefaultMatch(currentTeam);
        currentBucket.matches.push(newMatch);
        persistMatchStore();
        showAutosaveHint();
        selectMatch(newMatch);
        opponentInput.focus();
      });
    }

    if (btnDeleteMatch) {
      btnDeleteMatch.addEventListener("click", function () {
        if (currentBucket.matches.length <= 1) {
          return; // een team houdt altijd minstens 1 wedstrijd over
        }
        const confirmed = window.confirm(
          "Wedstrijd " + getMatchLabel(currentMatch) + " verwijderen? Dit kan niet ongedaan gemaakt worden."
        );
        if (!confirmed) {
          return;
        }
        currentBucket.matches = currentBucket.matches.filter(function (match) {
          return match.id !== currentMatch.id;
        });
        persistMatchStore();
        showAutosaveHint();
        selectMatch(currentBucket.matches[currentBucket.matches.length - 1]);
      });
    }

    // --- Formulier-events (auto-opslaan) ---

    matchForm.addEventListener("submit", function (event) {
      event.preventDefault();
    });

    opponentInput.addEventListener("input", function () {
      currentMatch.opponent = opponentInput.value;
      persistMatchStore();
      renderMatchSummaryLine();
      renderMatchSelect();
    });

    dateInput.addEventListener("change", function () {
      currentMatch.date = dateInput.value;
      persistMatchStore();
      renderMatchSummaryLine();
      renderMatchSelect();
    });

    timeInput.addEventListener("change", function () {
      currentMatch.time = timeInput.value;
      persistMatchStore();
      renderMatchSummaryLine();
    });

    durationInput.addEventListener("input", function () {
      currentMatch.duration = parseInt(durationInput.value, 10) || 0;
      persistMatchStore();
      renderMatchSummaryLine();
    });

    typeSelect.addEventListener("change", function () {
      currentMatch.type = typeSelect.value;
      persistMatchStore();
    });

    homeAwayButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentMatch.homeAway = btn.getAttribute("data-value");
        homeAwayButtons.forEach(function (b) {
          b.classList.toggle("toggle-btn--active", b === btn);
        });
        persistMatchStore();
        renderMatchSummaryLine();
      });
    });

    // --- Nieuw wisselmoment toevoegen ---

    btnAddBlock.addEventListener("click", function () {
      const minuteValue = parseInt(newBlockMinuteInput.value, 10);
      const lastBlock = currentMatch.lineupBlocks[currentMatch.lineupBlocks.length - 1];

      if (!Number.isFinite(minuteValue) || minuteValue <= lastBlock.startMinute) {
        window.alert(
          "Vul een minuut in die later is dan het vorige wisselmoment (minuut " + lastBlock.startMinute + ")."
        );
        return;
      }
      if (minuteValue >= currentMatch.duration) {
        window.alert("Deze minuut valt buiten de speelduur van de wedstrijd (" + currentMatch.duration + " min).");
        return;
      }

      const newBlock = {
        id: createId("block"),
        startMinute: minuteValue,
        // Vertrekpunt is de opstelling van het vorige blok
        positions: JSON.parse(JSON.stringify(lastBlock.positions))
      };
      currentMatch.lineupBlocks.push(newBlock);
      currentMatch.activeBlockId = newBlock.id;
      persistMatchStore();
      showAutosaveHint();
      newBlockMinuteInput.value = "";

      renderBlockTabs();
      renderActiveBlockLabel();
      renderPitch();
      renderBench();
    });

    // --- Ververs bij wisselen van team of terugkeer naar deze view ---

    document.addEventListener("vtm:view-activated", function (event) {
      if (event.detail && event.detail.view === "wedstrijd") {
        refreshForActiveTeam();
      }
    });

    refreshForActiveTeam();
  }

  /**
   * Live Tracker: het actieve scherm tijdens de wedstrijd. Bevat een
   * bijstelbare wedstrijdtimer, een live versleepbare opstelling
   * (met realtime wissel-logica en automatische minutenregistratie
   * per speler) en een alarm 5 minuten voor elk gepland wisselmoment.
   */
  function initLiveTracker() {
    const liveMatchSelectEl = document.getElementById("live-match-select");
    const alarmBanner = document.getElementById("alarm-banner");
    const alarmBannerText = document.getElementById("alarm-banner-text");
    const btnApplySuggestedSub = document.getElementById("btn-apply-suggested-sub");
    const btnDismissSuggestedSub = document.getElementById("btn-dismiss-suggested-sub");
    const display = document.getElementById("timer-display");
    const halfLabel = document.getElementById("timer-half");
    const btnMinus = document.getElementById("btn-timer-minus");
    const btnPlus = document.getElementById("btn-timer-plus");
    const btnToggle = document.getElementById("btn-timer-toggle");
    const btnReset = document.getElementById("btn-timer-reset");
    const pitchEl = document.getElementById("live-pitch");
    const benchEl = document.getElementById("live-bench");
    const benchEmptyEl = document.getElementById("live-bench-empty");
    const lineupSelect = document.getElementById("live-lineup-select");
    const btnApplyLineup = document.getElementById("btn-apply-lineup");
    const subLogEl = document.getElementById("sub-log");
    const subLogEmptyEl = document.getElementById("sub-log-empty");
    const btnEndMatch = document.getElementById("btn-end-match");

    if (!display || !pitchEl || !benchEl) {
      return; // Live Tracker-view niet (meer) aanwezig in de DOM
    }

    let teamDataRef = null;
    let currentTeam = null;
    let matchStore = null;
    let currentBucket = null;
    let currentMatch = null;
    let tickIntervalId = null;
    let alertedBlockIds = {};
    let pendingSuggestionBlock = null;

    function persistMatchStore() {
      saveMatchStore(matchStore);
    }

    function persistTeamData() {
      saveTeamData(teamDataRef);
    }

    function findPlayer(playerId) {
      return currentTeam.players.find(function (p) {
        return p.id === playerId;
      });
    }

    function ensureLiveState() {
      if (!currentMatch.live || !currentMatch.live.positions) {
        const baseBlock = currentMatch.lineupBlocks[0];
        currentMatch.live = {
          elapsedSeconds: 0,
          running: false,
          positions: JSON.parse(JSON.stringify(baseBlock.positions || {})),
          referencePositions: JSON.parse(JSON.stringify(baseBlock.positions || {})),
          subLog: []
        };
        persistMatchStore();
      } else if (!currentMatch.live.referencePositions) {
        // Oudere, al opgeslagen wedstrijden hebben nog geen referentiepunt:
        // start zonder kleurcodering totdat de eerstvolgende wissel gebeurt.
        currentMatch.live.referencePositions = JSON.parse(JSON.stringify(currentMatch.live.positions));
        persistMatchStore();
      }
    }

    function clearTickInterval() {
      if (tickIntervalId) {
        window.clearInterval(tickIntervalId);
        tickIntervalId = null;
      }
    }

    function formatTime(totalSeconds) {
      const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
      const seconds = (totalSeconds % 60).toString().padStart(2, "0");
      return minutes + ":" + seconds;
    }

    function renderTimer() {
      display.textContent = formatTime(currentMatch.live.elapsedSeconds);
      const currentMinute = Math.floor(currentMatch.live.elapsedSeconds / 60);
      halfLabel.textContent = currentMinute >= Math.floor((currentMatch.duration || 70) / 2) ? "2e helft" : "1e helft";
      btnToggle.textContent = currentMatch.live.running ? "⏸️" : "▶️";
      btnToggle.classList.toggle("is-running", currentMatch.live.running);
      btnToggle.setAttribute("aria-label", currentMatch.live.running ? "Pauze" : "Start");
    }

    function createLiveToken(player, pos, changeType) {
      const token = document.createElement("div");
      let className = "pitch-token" + (player.isGuest ? " pitch-token--guest" : "");
      if (changeType === "new-in") {
        className += " pitch-token--new-in";
      } else if (changeType === "moved") {
        className += " pitch-token--moved";
      }
      token.className = className;
      token.style.left = pos.x + "%";
      token.style.top = pos.y + "%";
      token.setAttribute("data-player-id", player.id);

      const avatar = document.createElement("span");
      avatar.className = "pitch-token__avatar";
      avatar.textContent = getInitials(player.name);

      const nameEl = document.createElement("span");
      nameEl.className = "pitch-token__name";
      nameEl.textContent = player.name.split(/\s+/)[0];

      const minutesEl = document.createElement("span");
      minutesEl.className = "pitch-token__minutes";
      minutesEl.textContent = (player.seasonMinutes || 0) + "'";

      token.appendChild(avatar);
      token.appendChild(nameEl);
      token.appendChild(minutesEl);

      token.addEventListener("pointerdown", function (event) {
        startDrag(event, token, player.id, "pitch");
      });

      return token;
    }

    function renderPitch() {
      pitchEl.querySelectorAll(".pitch-token").forEach(function (el) {
        el.remove();
      });

      const referencePositions = currentMatch.live.referencePositions || {};

      Object.keys(currentMatch.live.positions).forEach(function (playerId) {
        const player = findPlayer(playerId);
        if (!player || currentMatch.absentPlayerIds.indexOf(playerId) !== -1) {
          delete currentMatch.live.positions[playerId];
          return;
        }

        const pos = currentMatch.live.positions[playerId];
        const refPos = referencePositions[playerId];
        let changeType = null;
        if (!refPos) {
          changeType = "new-in"; // nieuw vanaf de bank ingevallen sinds de vorige wissel
        } else if (refPos.x !== pos.x || refPos.y !== pos.y) {
          changeType = "moved"; // stond al op het veld, andere positie sinds de vorige wissel
        }

        pitchEl.appendChild(createLiveToken(player, pos, changeType));
      });
    }

    function renderBench() {
      benchEl.querySelectorAll(".bench-card").forEach(function (el) {
        el.remove();
      });

      const benchPlayers = currentTeam.players.filter(function (player) {
        return currentMatch.absentPlayerIds.indexOf(player.id) === -1 && !currentMatch.live.positions[player.id];
      });

      benchEmptyEl.hidden = benchPlayers.length > 0;

      benchPlayers.forEach(function (player) {
        const card = document.createElement("div");
        card.className = "bench-card" + (player.isGuest ? " bench-card--guest" : "");
        card.setAttribute("data-player-id", player.id);

        const avatar = document.createElement("span");
        avatar.className = "bench-card__avatar";
        avatar.textContent = getInitials(player.name);

        const nameEl = document.createElement("span");
        nameEl.className = "bench-card__name";
        nameEl.textContent = player.name;

        const minutesEl = document.createElement("span");
        minutesEl.className = "bench-card__minutes";
        minutesEl.textContent = (player.seasonMinutes || 0) + "'";

        card.appendChild(avatar);
        card.appendChild(nameEl);
        card.appendChild(minutesEl);

        card.addEventListener("pointerdown", function (event) {
          startDrag(event, card, player.id, "bench");
        });

        benchEl.appendChild(card);
      });
    }

    function renderSubLog() {
      subLogEl.innerHTML = "";
      const entries = currentMatch.live.subLog || [];
      subLogEmptyEl.hidden = entries.length > 0;

      entries.forEach(function (entry) {
        const li = document.createElement("li");
        li.className = "sub-log__item";

        const timeEl = document.createElement("span");
        timeEl.className = "sub-log__time";
        timeEl.textContent = entry.minute + "'";

        const textEl = document.createElement("span");
        textEl.textContent = entry.text;

        li.appendChild(timeEl);
        li.appendChild(textEl);
        subLogEl.appendChild(li);
      });
    }

    function logSubstitution(text) {
      currentMatch.live.subLog.unshift({
        minute: Math.floor(currentMatch.live.elapsedSeconds / 60),
        text: text
      });
      renderSubLog();
    }

    /**
     * Universele sleeplogica op basis van Pointer Events (muis + touch).
     * Slepen boven op een reeds geplaatste veldspeler registreert een
     * live wissel; slepen naar een lege plek plaatst de speler erbij;
     * terugslepen naar de bank haalt een veldspeler eraf.
     */
    function startDrag(event, sourceEl, playerId, origin) {
      if (event.button !== undefined && event.button !== 0) {
        return; // alleen linkermuisknop / primaire aanraking
      }
      event.preventDefault();

      const player = findPlayer(playerId);
      if (!player) {
        return;
      }

      sourceEl.classList.add("is-dragging");

      const ghost = document.createElement("div");
      ghost.className = "drag-ghost pitch-token" + (player.isGuest ? " pitch-token--guest" : "");

      const avatar = document.createElement("span");
      avatar.className = "pitch-token__avatar";
      avatar.textContent = getInitials(player.name);

      const nameEl = document.createElement("span");
      nameEl.className = "pitch-token__name";
      nameEl.textContent = player.name.split(/\s+/)[0];

      ghost.appendChild(avatar);
      ghost.appendChild(nameEl);
      document.body.appendChild(ghost);

      function moveGhostTo(clientX, clientY) {
        ghost.style.transform = "translate(" + clientX + "px, " + clientY + "px) translate(-50%, -50%)";
      }

      moveGhostTo(event.clientX, event.clientY);

      function onPointerMove(moveEvent) {
        moveGhostTo(moveEvent.clientX, moveEvent.clientY);
      }

      function onPointerUp(upEvent) {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
        ghost.remove();
        sourceEl.classList.remove("is-dragging");

        // Bewaar de opstelling van vóór deze sleepactie als referentie, zodat
        // na het verwerken zichtbaar is wie er is ingevallen (rood) of van
        // plek is gewisseld (oranje) — net als in de module Opstelling.
        currentMatch.live.referencePositions = JSON.parse(JSON.stringify(currentMatch.live.positions));

        const pitchRect = pitchEl.getBoundingClientRect();
        const droppedInPitch =
          upEvent.clientX >= pitchRect.left &&
          upEvent.clientX <= pitchRect.right &&
          upEvent.clientY >= pitchRect.top &&
          upEvent.clientY <= pitchRect.bottom;

        if (droppedInPitch) {
          const xPct = clamp(((upEvent.clientX - pitchRect.left) / pitchRect.width) * 100, 4, 96);
          const yPct = clamp(((upEvent.clientY - pitchRect.top) / pitchRect.height) * 100, 4, 96);

          // Zoek of er al een andere speler vlakbij deze positie staat
          const PROXIMITY_PCT = 9;
          let targetPlayerId = null;
          Object.keys(currentMatch.live.positions).forEach(function (otherId) {
            if (otherId === playerId) {
              return;
            }
            const otherPos = currentMatch.live.positions[otherId];
            const dx = otherPos.x - xPct;
            const dy = otherPos.y - yPct;
            if (Math.sqrt(dx * dx + dy * dy) <= PROXIMITY_PCT) {
              targetPlayerId = otherId;
            }
          });

          if (targetPlayerId && origin === "bench") {
            // Live wissel: bankspeler komt exact in op de plek van een veldspeler
            const outPlayer = findPlayer(targetPlayerId);
            const outPos = currentMatch.live.positions[targetPlayerId];
            delete currentMatch.live.positions[targetPlayerId];
            currentMatch.live.positions[playerId] = { x: outPos.x, y: outPos.y };
            logSubstitution((outPlayer ? outPlayer.name : "Speler") + " eruit, " + player.name + " erin");
          } else if (targetPlayerId && origin === "pitch") {
            // Twee veldspelers ruilen simpelweg van positie
            const otherPos = currentMatch.live.positions[targetPlayerId];
            const ownPos = currentMatch.live.positions[playerId];
            currentMatch.live.positions[targetPlayerId] = ownPos;
            currentMatch.live.positions[playerId] = otherPos;
          } else {
            currentMatch.live.positions[playerId] = {
              x: Math.round(xPct * 10) / 10,
              y: Math.round(yPct * 10) / 10
            };
            if (origin === "bench") {
              logSubstitution(player.name + " erbij (geen speler uit het veld gehaald)");
            }
          }
        } else if (origin === "pitch") {
          delete currentMatch.live.positions[playerId];
          logSubstitution(player.name + " eruit zonder vervanger — team speelt met een man minder");
        }

        persistMatchStore();
        renderPitch();
        renderBench();
      }

      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    }

    // --- Automatische speelminuten-registratie (seizoenstotaal) ---

    function accrueMinuteForOnFieldPlayers() {
      let changed = false;
      Object.keys(currentMatch.live.positions).forEach(function (playerId) {
        const player = findPlayer(playerId);
        if (player) {
          player.seasonMinutes = (player.seasonMinutes || 0) + 1;
          changed = true;
        }
      });
      if (changed) {
        persistTeamData();
      }
    }

    // --- Alarm 5 minuten voor een gepland wisselmoment ---

    let audioCtx = null;

    function playAlertSound() {
      try {
        if (!audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (!AudioCtx) {
            return;
          }
          audioCtx = new AudioCtx();
        }
        for (let i = 0; i < 3; i++) {
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 880;
          gainNode.gain.value = 0.2;
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          const startTime = audioCtx.currentTime + i * 0.35;
          oscillator.start(startTime);
          oscillator.stop(startTime + 0.2);
        }
      } catch (e) {
        console.error("Geluidsalarm kon niet worden afgespeeld:", e);
      }
    }

    /**
     * Neemt de opstelling van het opgegeven tijdsblok over als de nieuwe
     * live-opstelling en registreert dit in het wisselregistratie-log.
     * Wordt gebruikt door zowel de wissel-suggestiebanner als de
     * handmatige opstelling-kiezer.
     */
    function applyLineupToLive(block, sourceLabel) {
      const previousPositions = currentMatch.live.positions;
      const newPositions = JSON.parse(JSON.stringify(block.positions || {}));

      const outgoingNames = Object.keys(previousPositions)
        .filter(function (id) {
          return !newPositions[id];
        })
        .map(function (id) {
          const player = findPlayer(id);
          return player ? player.name : null;
        })
        .filter(Boolean);

      const incomingNames = Object.keys(newPositions)
        .filter(function (id) {
          return !previousPositions[id];
        })
        .map(function (id) {
          const player = findPlayer(id);
          return player ? player.name : null;
        })
        .filter(Boolean);

      let text = "Opstelling \"" + sourceLabel + "\" overgenomen";
      if (outgoingNames.length > 0 || incomingNames.length > 0) {
        text += ": " + [
          outgoingNames.length > 0 ? outgoingNames.join(", ") + " eruit" : null,
          incomingNames.length > 0 ? incomingNames.join(", ") + " erin" : null
        ].filter(Boolean).join(", ");
      }
      logSubstitution(text);

      // De opstelling van vóór het overnemen wordt het nieuwe referentiepunt,
      // zodat ingevallen (rood) en verplaatste (oranje) spelers zichtbaar
      // zijn — net als bij het wisselen van blok in de module Opstelling.
      currentMatch.live.referencePositions = JSON.parse(JSON.stringify(previousPositions));
      currentMatch.live.positions = newPositions;
      persistMatchStore();
      renderPitch();
      renderBench();
    }

    /**
     * Vult de opstelling-kiezer met alle gemaakte tijdsblokken (basis-
     * opstelling en eventuele wisselopstellingen), zodat de trainer op elk
     * moment een eerder gemaakte opstelling live kan overnemen.
     */
    function renderLineupPicker() {
      if (!lineupSelect) {
        return;
      }
      const previousValue = lineupSelect.value;
      lineupSelect.innerHTML = "";
      currentMatch.lineupBlocks.forEach(function (block, index) {
        const option = document.createElement("option");
        option.value = block.id;
        option.textContent = getBlockShortLabel(currentMatch, index);
        lineupSelect.appendChild(option);
      });
      const stillExists = currentMatch.lineupBlocks.some(function (block) {
        return block.id === previousValue;
      });
      if (stillExists) {
        lineupSelect.value = previousValue;
      }
    }

    if (btnApplyLineup) {
      btnApplyLineup.addEventListener("click", function () {
        const block = currentMatch.lineupBlocks.find(function (b) {
          return b.id === lineupSelect.value;
        });
        if (!block) {
          return;
        }
        const index = getBlockIndex(currentMatch, block);
        applyLineupToLive(block, getBlockShortLabel(currentMatch, index));
      });
    }

    /**
     * Toont een keuze-banner voor een aankomend wisselmoment: de trainer
     * kan de vooraf gemaakte opstelling in 1 tik doorvoeren, of zelf
     * (via slepen) een eigen wissel regelen. De banner blijft zichtbaar
     * totdat een keuze is gemaakt.
     */
    function showSubstitutionSuggestion(block) {
      pendingSuggestionBlock = block;
      const previousBlock = getPreviousBlock(currentMatch, block);
      const incomingNames = [];
      if (previousBlock) {
        Object.keys(block.positions).forEach(function (playerId) {
          if (!previousBlock.positions[playerId]) {
            const player = findPlayer(playerId);
            if (player) {
              incomingNames.push(player.name);
            }
          }
        });
      }
      const namesText = incomingNames.length > 0 ? " — " + incomingNames.join(", ") + " klaarzetten" : "";
      alarmBannerText.textContent = "Wissel gepland vanaf minuut " + block.startMinute + namesText;
      alarmBanner.hidden = false;
      alarmBanner.classList.add("is-blinking");
      playAlertSound();
    }

    function resolvePendingSuggestion() {
      pendingSuggestionBlock = null;
      alarmBanner.hidden = true;
      alarmBanner.classList.remove("is-blinking");
    }

    btnApplySuggestedSub.addEventListener("click", function () {
      if (!pendingSuggestionBlock) {
        return;
      }
      const index = getBlockIndex(currentMatch, pendingSuggestionBlock);
      applyLineupToLive(pendingSuggestionBlock, getBlockShortLabel(currentMatch, index));
      resolvePendingSuggestion();
    });

    btnDismissSuggestedSub.addEventListener("click", function () {
      resolvePendingSuggestion();
    });

    function checkUpcomingBlockAlert() {
      if (pendingSuggestionBlock) {
        return; // wacht tot de trainer een keuze heeft gemaakt voor het huidige wisselmoment
      }
      const currentMinute = Math.floor(currentMatch.live.elapsedSeconds / 60);
      currentMatch.lineupBlocks.forEach(function (block, index) {
        if (index === 0 || alertedBlockIds[block.id]) {
          return;
        }
        if (currentMinute >= block.startMinute - 5) {
          alertedBlockIds[block.id] = true;
          showSubstitutionSuggestion(block);
        }
      });
    }

    // --- Timer ---

    function tick() {
      currentMatch.live.elapsedSeconds += 1;
      renderTimer();

      if (currentMatch.live.elapsedSeconds % 60 === 0) {
        accrueMinuteForOnFieldPlayers();
        renderPitch();
        renderBench();
      }

      checkUpcomingBlockAlert();
      persistMatchStore();
    }

    function startTimer() {
      if (tickIntervalId) {
        return;
      }
      currentMatch.live.running = true;
      persistMatchStore();
      renderTimer();
      tickIntervalId = window.setInterval(tick, 1000);
    }

    function pauseTimer() {
      clearTickInterval();
      currentMatch.live.running = false;
      persistMatchStore();
      renderTimer();
    }

    btnToggle.addEventListener("click", function () {
      if (currentMatch.live.running) {
        pauseTimer();
      } else {
        startTimer();
      }
    });

    btnReset.addEventListener("click", function () {
      const confirmed = window.confirm("Timer terugzetten naar 00:00?");
      if (!confirmed) {
        return;
      }
      pauseTimer();
      currentMatch.live.elapsedSeconds = 0;
      alertedBlockIds = {};
      persistMatchStore();
      renderTimer();
    });

    btnMinus.addEventListener("click", function () {
      currentMatch.live.elapsedSeconds = Math.max(0, currentMatch.live.elapsedSeconds - 60);
      persistMatchStore();
      renderTimer();
    });

    btnPlus.addEventListener("click", function () {
      currentMatch.live.elapsedSeconds += 60;
      persistMatchStore();
      renderTimer();
    });

    btnEndMatch.addEventListener("click", function () {
      const confirmed = window.confirm("Wedstrijd beëindigen? De timer wordt gestopt.");
      if (!confirmed) {
        return;
      }
      pauseTimer();
    });

    // --- Ververs bij wisselen van team of terugkeer naar deze view ---

    /**
     * Vult de wedstrijd-kiezer met alle wedstrijden van het huidige team,
     * zodat de trainer kan kiezen welke wedstrijd hij live wil volgen.
     */
    function renderMatchSelect() {
      if (!liveMatchSelectEl) {
        return;
      }
      liveMatchSelectEl.innerHTML = "";
      currentBucket.matches.forEach(function (match) {
        const option = document.createElement("option");
        option.value = match.id;
        option.textContent = getMatchLabel(match);
        liveMatchSelectEl.appendChild(option);
      });
      liveMatchSelectEl.value = currentMatch.id;
    }

    /**
     * Laadt een specifieke wedstrijd van het huidige team in de Live
     * Tracker: past eventuele migraties toe, herstelt de timer-/alarm-
     * status en ververst het volledige scherm.
     */
    function loadMatch(match) {
      currentMatch = match;
      currentBucket.activeMatchId = match.id;

      if (!Array.isArray(currentMatch.lineupBlocks) || currentMatch.lineupBlocks.length === 0) {
        const baseBlockId = createId("block");
        currentMatch.lineupBlocks = [{ id: baseBlockId, startMinute: 0, positions: currentMatch.lineup || {} }];
        currentMatch.activeBlockId = baseBlockId;
      }

      ensureLiveState();
      persistMatchStore();

      clearTickInterval();

      // Alarmeer niet met terugwerkende kracht voor blokken waarvan de
      // waarschuwingsminuut al gepasseerd is bij het (her)openen van dit scherm.
      alertedBlockIds = {};
      pendingSuggestionBlock = null;
      const currentMinute = Math.floor(currentMatch.live.elapsedSeconds / 60);
      currentMatch.lineupBlocks.forEach(function (block, index) {
        if (index > 0 && currentMinute >= block.startMinute - 5) {
          alertedBlockIds[block.id] = true;
        }
      });

      alarmBanner.hidden = true;
      alarmBanner.classList.remove("is-blinking");

      renderMatchSelect();
      renderTimer();
      renderPitch();
      renderBench();
      renderSubLog();
      renderLineupPicker();

      if (currentMatch.live.running) {
        startTimer();
      }
    }

    if (liveMatchSelectEl) {
      liveMatchSelectEl.addEventListener("change", function () {
        const match = currentBucket.matches.find(function (m) {
          return m.id === liveMatchSelectEl.value;
        });
        if (match) {
          loadMatch(match);
        }
      });
    }

    function refreshForActiveTeam() {
      teamDataRef = loadTeamData();
      currentTeam = teamDataRef.teams.find(function (team) {
        return team.id === teamDataRef.activeTeamId;
      }) || teamDataRef.teams[0];

      if (!currentTeam) {
        return;
      }

      matchStore = loadMatchStore();
      currentBucket = ensureTeamMatchBucket(matchStore, currentTeam);
      persistMatchStore();

      loadMatch(getBucketMatch(currentBucket, currentBucket.activeMatchId));
    }

    document.addEventListener("vtm:view-activated", function (event) {
      if (event.detail && event.detail.view === "live") {
        refreshForActiveTeam();
      } else {
        clearTickInterval(); // pauzeer de klok-interval als de trainer wegnavigeert
      }
    });

    refreshForActiveTeam();
  }


  /**
   * Zet tekstinhoud om in een downloadbaar bestand.
   */
  function downloadTextFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  /**
   * Zet een export-payload om in een downloadbaar JSON-bestand.
   */
  function downloadJsonPayload(payload, filenamePrefix) {
    const json = JSON.stringify(payload, null, 2);
    downloadTextFile(json, filenamePrefix + "-" + new Date().toISOString().slice(0, 10) + ".json", "application/json");
  }

  /**
   * Bouwt een exportpakket met de wedstrijd + opstelling(en) van één team
   * (herkenbaar bij import aan format "vtm-match-export"). Bevat ook de
   * spelerslijst van dat team, zodat de spelers in de opstelling bij
   * import herkend of toegevoegd kunnen worden.
   */
  function buildMatchExportPayload(team, match) {
    const matchData = {};
    if (match) {
      const clonedMatch = JSON.parse(JSON.stringify(match));
      matchData[team.id] = { matches: [clonedMatch], activeMatchId: clonedMatch.id };
    }
    return {
      format: "vtm-match-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      teamData: {
        activeTeamId: team.id,
        teams: [JSON.parse(JSON.stringify(team))]
      },
      matchData: matchData
    };
  }

  /**
   * Bouwt een exportpakket met het teamoverzicht (alle spelers, hun
   * basisplekken en speelminuten) van één team, zonder wedstrijdgegevens
   * (herkenbaar bij import aan format "vtm-team-overview-export").
   */
  function buildTeamOverviewExportPayload(team) {
    return {
      format: "vtm-team-overview-export",
      version: 1,
      exportedAt: new Date().toISOString(),
      teamData: {
        activeTeamId: team.id,
        teams: [JSON.parse(JSON.stringify(team))]
      }
    };
  }

  const TEAM_OVERVIEW_CSV_HEADER = ["TeamId", "TeamNaam", "Seizoen", "SpelerId", "SpelerNaam", "Posities", "Status", "Gast", "Speelminuten"];

  /**
   * Escaped een enkele waarde volgens de CSV-regels (RFC 4180): als de
   * waarde een komma, aanhalingsteken of nieuwe regel bevat, wordt hij
   * tussen aanhalingstekens gezet en worden aanhalingstekens verdubbeld.
   */
  function csvEscapeField(value) {
    const text = value === null || value === undefined ? "" : String(value);
    if (/[",\n\r]/.test(text)) {
      return "\"" + text.replace(/"/g, "\"\"") + "\"";
    }
    return text;
  }

  /**
   * Bouwt een teamoverzicht als CSV-tekst (opent direct in Excel), met
   * dezelfde gegevens als de JSON-teamoverzicht-export: per speler het
   * team, de basisplekken (posities), status, gast-indicatie en
   * speelminuten. Begint met een UTF-8 BOM zodat Excel speciale tekens
   * (bv. ë, ï) correct toont.
   */
  function buildTeamOverviewCsv(team) {
    const rows = [TEAM_OVERVIEW_CSV_HEADER];
    team.players.forEach(function (player) {
      rows.push([
        team.id,
        team.name,
        team.season || "",
        player.id,
        player.name,
        (player.positions || []).join("|"),
        player.status || "",
        player.isGuest ? "Ja" : "Nee",
        player.seasonMinutes || 0
      ]);
    });
    const csvBody = rows.map(function (row) {
      return row.map(csvEscapeField).join(",");
    }).join("\r\n");
    return "\uFEFF" + csvBody;
  }

  /**
   * Ontleedt platte CSV-tekst naar een array van rijen (elk een array van
   * celwaarden), met ondersteuning voor tussen aanhalingstekens geplaatste
   * velden (die komma's of nieuwe regels mogen bevatten) volgens RFC 4180.
   */
  function parseCsvText(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const normalized = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (inQuotes) {
        if (char === "\"") {
          if (normalized[i + 1] === "\"") {
            field += "\"";
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += char;
        }
      } else if (char === "\"") {
        inQuotes = true;
      } else if (char === ",") {
        row.push(field);
        field = "";
      } else if (char === "\r") {
        // negeren, \n handelt de regeleinde af
      } else if (char === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += char;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter(function (r) {
      return !(r.length === 1 && r[0].trim() === "");
    });
  }

  /**
   * Probeert geïmporteerde CSV-tekst te herkennen als een teamoverzicht
   * (zoals gebouwd door buildTeamOverviewCsv) en zet deze om naar
   * dezelfde payloadvorm als de JSON-teamoverzicht-export, zodat die met
   * dezelfde mergeTeamData-logica verwerkt kan worden. Geeft null terug
   * als de CSV niet de verwachte kolommen bevat.
   */
  function parseTeamOverviewCsvPayload(csvText) {
    const rows = parseCsvText(csvText);
    if (rows.length < 1) {
      return null;
    }
    const header = rows[0].map(function (cell) { return cell.trim(); });
    const isRecognizedHeader = TEAM_OVERVIEW_CSV_HEADER.every(function (col) {
      return header.indexOf(col) !== -1;
    });
    if (!isRecognizedHeader) {
      return null;
    }

    const colIndex = {};
    header.forEach(function (col, index) {
      colIndex[col] = index;
    });

    const teamsById = {};
    const teamOrder = [];

    rows.slice(1).forEach(function (row) {
      if (row.every(function (cell) { return cell.trim() === ""; })) {
        return;
      }
      const teamName = (row[colIndex.TeamNaam] || "").trim();
      let teamId = (row[colIndex.TeamId] || "").trim();
      if (!teamId) {
        teamId = "team-csv-" + teamName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      }
      if (!teamsById[teamId]) {
        teamsById[teamId] = {
          id: teamId,
          name: teamName || "Geïmporteerd team",
          season: (row[colIndex.Seizoen] || "").trim(),
          players: []
        };
        teamOrder.push(teamId);
      }

      const playerName = (row[colIndex.SpelerNaam] || "").trim();
      if (!playerName) {
        return;
      }
      let playerId = (row[colIndex.SpelerId] || "").trim();
      if (!playerId) {
        playerId = createId("player");
      }
      const positionsCell = (row[colIndex.Posities] || "").trim();
      const seasonMinutesCell = (row[colIndex.Speelminuten] || "").trim();

      teamsById[teamId].players.push({
        id: playerId,
        name: playerName,
        positions: positionsCell ? positionsCell.split("|").map(function (p) { return p.trim(); }).filter(Boolean) : [],
        status: (row[colIndex.Status] || "fit").trim() || "fit",
        isGuest: (row[colIndex.Gast] || "").trim().toLowerCase() === "ja",
        seasonMinutes: seasonMinutesCell ? Number(seasonMinutesCell) || 0 : 0
      });
    });

    const teams = teamOrder.map(function (id) { return teamsById[id]; });
    if (teams.length === 0) {
      return null;
    }

    return {
      format: "vtm-team-overview-export",
      version: 1,
      teamData: {
        activeTeamId: teams[0].id,
        teams: teams
      }
    };
  }

  /**
   * Data Import/Export: laat een wedstrijd + opstelling, een
   * teamoverzicht of een volledige back-up (JSON) exporteren, en
   * importeert zo'n export weer in, zonder ooit bestaande lokale data
   * (teams, spelers, wedstrijden) te verwijderen of stilzwijgend te
   * overschrijven. De import herkent zelf aan het "format"-veld om welk
   * type export het gaat.
   */
  function initDataImport() {
    const fileInput = document.getElementById("file-import");
    const fileNameLabel = document.getElementById("import-filename");
    const textArea = document.getElementById("import-textarea");
    const btnImportData = document.getElementById("btn-import-data");
    const resultEl = document.getElementById("import-result");
    const btnBackup = document.getElementById("btn-backup");
    const exportTeamSelect = document.getElementById("export-team-select");
    const btnExportMatch = document.getElementById("btn-export-match");
    const btnExportTeamOverview = document.getElementById("btn-export-team-overview");
    const btnExportTeamOverviewCsv = document.getElementById("btn-export-team-overview-csv");

    if (!fileInput || !fileNameLabel) {
      return;
    }

    let selectedFile = null;

    fileInput.addEventListener("change", function () {
      if (fileInput.files && fileInput.files.length > 0) {
        selectedFile = fileInput.files[0];
        fileNameLabel.textContent = selectedFile.name;
      } else {
        selectedFile = null;
        fileNameLabel.textContent = "Geen bestand geselecteerd";
      }
    });

    function renderExportTeamOptions() {
      if (!exportTeamSelect) {
        return;
      }
      const teamData = loadTeamData();
      const previousValue = exportTeamSelect.value;
      exportTeamSelect.innerHTML = "";
      teamData.teams.forEach(function (team) {
        const option = document.createElement("option");
        option.value = team.id;
        option.textContent = team.name;
        exportTeamSelect.appendChild(option);
      });
      const hasPreviousValue = teamData.teams.some(function (team) {
        return team.id === previousValue;
      });
      exportTeamSelect.value = hasPreviousValue ? previousValue : teamData.activeTeamId;
    }

    function getSelectedExportTeam() {
      const teamData = loadTeamData();
      const teamId = exportTeamSelect ? exportTeamSelect.value : teamData.activeTeamId;
      return teamData.teams.find(function (team) {
        return team.id === teamId;
      }) || null;
    }

    if (btnExportMatch) {
      btnExportMatch.addEventListener("click", function () {
        const team = getSelectedExportTeam();
        if (!team) {
          return;
        }
        const bucket = loadMatchStore()[team.id];
        const match = bucket ? getBucketMatch(bucket, bucket.activeMatchId) : null;
        downloadJsonPayload(buildMatchExportPayload(team, match), "wedstrijd-opstelling-" + team.name);
      });
    }

    if (btnExportTeamOverview) {
      btnExportTeamOverview.addEventListener("click", function () {
        const team = getSelectedExportTeam();
        if (!team) {
          return;
        }
        downloadJsonPayload(buildTeamOverviewExportPayload(team), "teamoverzicht-" + team.name);
      });
    }

    if (btnExportTeamOverviewCsv) {
      btnExportTeamOverviewCsv.addEventListener("click", function () {
        const team = getSelectedExportTeam();
        if (!team) {
          return;
        }
        const csv = buildTeamOverviewCsv(team);
        const filename = "teamoverzicht-" + team.name + "-" + new Date().toISOString().slice(0, 10) + ".csv";
        downloadTextFile(csv, filename, "text/csv;charset=utf-8");
      });
    }

    function showImportResult(message, isError) {
      if (!resultEl) {
        return;
      }
      resultEl.textContent = message;
      resultEl.hidden = false;
      resultEl.classList.toggle("card__filename--error", !!isError);
    }

    function readFileAsText(file) {
      return new Promise(function (resolve, reject) {
        const reader = new FileReader();
        reader.onload = function () {
          resolve(String(reader.result || ""));
        };
        reader.onerror = function () {
          reject(reader.error);
        };
        reader.readAsText(file);
      });
    }

    /**
     * Verwerkt de ingelezen back-uptekst: herkent zelf of het om JSON of
     * CSV/Excel gaat en om welk exporttype (wedstrijd+opstelling,
     * teamoverzicht of volledige back-up) het gaat, voegt samen met de
     * bestaande lokale data (nooit overschrijven/verwijderen) en slaat
     * op. Toont daarna een korte samenvatting van wat er is
     * toegevoegd/bijgewerkt/overgeslagen.
     */
    function processImportedText(raw) {
      const trimmed = raw.trim();
      let payload;

      if (trimmed.charAt(0) === "{") {
        try {
          payload = JSON.parse(trimmed);
        } catch (e) {
          showImportResult("⚠️ Kon de import niet lezen: geen geldige back-uptekst of -bestand.", true);
          return;
        }
      } else {
        payload = parseTeamOverviewCsvPayload(trimmed);
        if (!payload) {
          showImportResult("⚠️ Kon de import niet lezen: geen geldig JSON- of CSV-bestand herkend.", true);
          return;
        }
      }

      if (!payload || typeof payload !== "object" || !payload.teamData || !Array.isArray(payload.teamData.teams)) {
        showImportResult("⚠️ Geen geldige back-updata gevonden in de import.", true);
        return;
      }

      const isTeamOverviewExport = payload.format === "vtm-team-overview-export";
      const isMatchExport = payload.format === "vtm-match-export";

      const teamMergeResult = mergeTeamData(loadTeamData(), payload.teamData);
      saveTeamData(teamMergeResult.teamData);

      const summaryParts = [
        teamMergeResult.addedTeams + " nieuw(e) team(s)",
        teamMergeResult.addedPlayers + " nieuwe speler(s)"
      ];

      let matchMergeResult = null;
      if (!isTeamOverviewExport) {
        matchMergeResult = mergeMatchData(loadMatchStore(), payload.matchData || {});
        saveMatchStore(matchMergeResult.matchData);
        summaryParts.push(matchMergeResult.addedMatches + " nieuwe wedstrijd(en)");
        summaryParts.push(matchMergeResult.updatedMatches + " bijgewerkte wedstrijd(en)");
        if (matchMergeResult.skippedMatches > 0) {
          summaryParts.push(matchMergeResult.skippedMatches + " overgeslagen wedstrijd(en)");
        }
      }

      const resultPrefix = isMatchExport
        ? "✓ Wedstrijd + opstelling geïmporteerd: "
        : isTeamOverviewExport
          ? "✓ Teamoverzicht geïmporteerd: "
          : "✓ Import voltooid: ";
      showImportResult(resultPrefix + summaryParts.join(", ") + ".", false);

      renderExportTeamOptions();

      if (textArea) {
        textArea.value = "";
      }
    }

    if (btnImportData) {
      btnImportData.addEventListener("click", function () {
        if (selectedFile) {
          readFileAsText(selectedFile)
            .then(processImportedText)
            .catch(function () {
              showImportResult("⚠️ Kon het gekozen bestand niet lezen.", true);
            });
          return;
        }

        const pastedText = textArea ? textArea.value.trim() : "";
        if (pastedText) {
          processImportedText(pastedText);
          return;
        }

        showImportResult("⚠️ Kies eerst een bestand of plak de geëxporteerde back-uptekst.", true);
      });
    }

    if (btnBackup) {
      btnBackup.addEventListener("click", function () {
        downloadJsonPayload({
          format: "vtm-backup",
          version: 1,
          exportedAt: new Date().toISOString(),
          teamData: loadTeamData(),
          matchData: loadMatchStore()
        }, "voetbalteam-backup");
      });
    }

    document.addEventListener("vtm:view-activated", function (event) {
      if (event.detail && event.detail.view === "data") {
        renderExportTeamOptions();
      }
    });

    renderExportTeamOptions();
  }

  /**
   * Registreert de Service Worker voor offline gebruik (PWA) en zorgt
   * ervoor dat updates (nieuwe CACHE_NAME-versie in sw.js) direct
   * zichtbaar worden:
   * - updateViaCache: "none" dwingt de browser om sw.js zelf altijd
   *   rechtstreeks bij de server te controleren op wijzigingen, in
   *   plaats van een verouderde versie uit de HTTP-cache te gebruiken
   *   (een bekende oorzaak van "blijft oude versie tonen" op GitHub
   *   Pages).
   * - De "controllerchange"-listener herlaadt de pagina automatisch
   *   zodra een nieuwe service worker de controle overneemt, zodat de
   *   trainer de update direct ziet zonder handmatig te hoeven
   *   verversen.
   */
  function initServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker
          .register("sw.js", { updateViaCache: "none" })
          .catch(function (error) {
            console.error("Service worker registratie mislukt:", error);
          });
      });

      let reloadedForUpdate = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (reloadedForUpdate) {
          return;
        }
        reloadedForUpdate = true;
        window.location.reload();
      });
    }
  }

  /**
   * Past de afmetingen van de veld-weergaves (Opstelling en Live Tracker)
   * dynamisch aan op de beschikbare ruimte van het scherm, zodat het
   * volledige voetbalveld altijd zo groot mogelijk getoond wordt — tot
   * aan de onderste navigatiebalk — met alleen de smalle wisselbank
   * ernaast. Werkt voor elk schermformaat (telefoon, tablet, desktop) en
   * herberekent bij het draaien/resizen van het scherm, het wisselen van
   * view en het open-/dichtklappen van de wedstrijdgegevens.
   *
   * De Opstelling ("#pitch") is hierbij leidend: het veld bij Live
   * Tracker ("#live-pitch") krijgt altijd exact dezelfde breedte/hoogte
   * als het veld bij Opstelling, zodat beide velden er identiek uitzien.
   */
  function initResponsivePitchSizing() {
    const pitchEl = document.getElementById("pitch");
    const livePitchEl = document.getElementById("live-pitch");
    const pitchEls = [pitchEl, livePitchEl].filter(Boolean);
    const bottomNav = document.getElementById("bottom-nav");
    const topbar = document.querySelector(".app-topbar");
    const viewportProbe = document.getElementById("viewport-probe");

    if (pitchEls.length === 0) {
      return;
    }

    // Breedte/hoogte-verhouding van het volledige veld (zie .pitch in style.css)
    const PITCH_ASPECT = 3 / 4;
    const MIN_PITCH_WIDTH = 160;
    const BOTTOM_MARGIN = 12;

    // Geeft een stabiele totale viewporthoogte terug die niet meebeweegt
    // met het in-/uitklappen van de adresbalk van mobiele browsers tijdens
    // het scrollen (zie #viewport-probe in style.css, gebaseerd op de
    // CSS-eenheid "svh"). window.innerHeight is hiervoor NIET geschikt:
    // die verandert juist wél live mee met de adresbalk, wat ervoor
    // zorgde dat het veld tijdens het scrollen door de spelerslijst
    // steeds van grootte veranderde.
    function getStableViewportHeight() {
      if (viewportProbe) {
        const height = viewportProbe.getBoundingClientRect().height;
        if (height > 0) {
          return height;
        }
      }
      return window.innerHeight;
    }

    // Berekent de ideale breedte voor een veld-element op basis van de
    // ruimte die er op dit moment voor beschikbaar is. Geeft null terug
    // als het element in een niet-actieve (display:none) view zit.
    //
    // De beschikbare hoogte wordt berekend als: stabiele viewporthoogte
    // min de (vaste, CSS-bepaalde) hoogte van topbar en onderste
    // navigatiebalk. Er wordt bewust NIET gerekend met de positie
    // (top/bottom) van deze fixed/sticky elementen: die positie schuift
    // op mobiele browsers namelijk mee met de in-/uitklappende adresbalk
    // en met de actuele scrollpositie, wat het veld onterecht van
    // grootte liet veranderen tijdens het scrollen door de spelerslijst.
    // De hóógte van topbar/navbalk zelf is wél altijd stabiel (vaste
    // CSS-waarden), dus die mag gewoon gemeten worden.
    function computeCandidateWidth(pitchEl) {
      if (!pitchEl || pitchEl.offsetParent === null) {
        return null;
      }

      const layout = pitchEl.closest(".pitch-layout");
      const bench = layout ? layout.querySelector(".bench-sidebar") : null;
      const gap = 8;
      const benchWidth = bench ? bench.getBoundingClientRect().width : 0;
      const availableWidth = layout
        ? layout.getBoundingClientRect().width - benchWidth - gap
        : pitchEl.clientWidth;

      const topbarHeight = topbar ? topbar.getBoundingClientRect().height : 0;
      const navHeight = bottomNav ? bottomNav.getBoundingClientRect().height : 0;
      const availableHeight = getStableViewportHeight() - topbarHeight - navHeight - BOTTOM_MARGIN;

      const widthFromHeight = availableHeight * PITCH_ASPECT;
      return Math.max(MIN_PITCH_WIDTH, Math.min(availableWidth, widthFromHeight));
    }

    // Referentiebreedte: zolang Opstelling zichtbaar is (geweest), is
    // haar veld leidend voor de afmetingen van beide velden.
    let referenceWidth = null;

    function applyWidth(width) {
      const height = width / PITCH_ASPECT;
      pitchEls.forEach(function (el) {
        el.style.width = Math.floor(width) + "px";

        // De wisselbank ernaast krijgt exact dezelfde hoogte als het
        // veld, en scrollt daarbinnen zelf (zie .bench.bench--sidebar
        // in style.css). Zo blijft het veld altijd volledig zichtbaar
        // terwijl je door de spelerslijst scrolt om een speler te
        // vinden en naar het veld te slepen.
        const layout = el.closest(".pitch-layout");
        const bench = layout ? layout.querySelector(".bench-sidebar") : null;
        if (bench) {
          bench.style.height = Math.floor(height) + "px";
        }
      });
    }

    let rafId = null;
    function scheduleResize() {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      rafId = window.requestAnimationFrame(function () {
        rafId = null;

        const opstellingCandidate = computeCandidateWidth(pitchEl);
        if (opstellingCandidate !== null) {
          referenceWidth = opstellingCandidate;
        } else if (referenceWidth === null) {
          // Opstelling is nog nooit gemeten (bv. Live is als eerste geopend):
          // val tijdelijk terug op de eigen meting van Live Tracker.
          const liveCandidate = computeCandidateWidth(livePitchEl);
          if (liveCandidate !== null) {
            referenceWidth = liveCandidate;
          }
        }

        if (referenceWidth !== null) {
          applyWidth(referenceWidth);
        }
      });
    }

    window.addEventListener("resize", scheduleResize);
    window.addEventListener("orientationchange", scheduleResize);
    document.addEventListener("vtm:view-activated", scheduleResize);

    const matchSummaryDetails = document.getElementById("match-summary");
    if (matchSummaryDetails) {
      matchSummaryDetails.addEventListener("toggle", scheduleResize);
    }

    scheduleResize();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNavigation();
    initDashboard();
    initTeamManagement();
    initMatchManagement();
    initLiveTracker();
    initDataImport();
    initResponsivePitchSizing();
    initServiceWorker();
  });
})();
