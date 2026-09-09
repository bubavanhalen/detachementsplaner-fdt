const people = [
  { name: "Anna Meier", role: "Detachementsführerin", rank: "Hptm", detachment: "Führung", status: "Bestätigt" },
  { name: "Lukas Keller", role: "Stv. Detachementsführer", rank: "Oblt", detachment: "Führung", status: "Bestätigt" },
  { name: "Sofia Brunner", role: "Chef Logistik", rank: "Lt", detachment: "Logistik", status: "Bestätigt" },
  { name: "David Schmid", role: "Fahrer", rank: "Wm", detachment: "Transport", status: "Offen" },
  { name: "Lea Frei", role: "Sanitätsspezialistin", rank: "Sdt", detachment: "Sanität", status: "Bestätigt" },
  { name: "Marco Graf", role: "Gruppenführer", rank: "Sgt", detachment: "Sicherung", status: "Bestätigt" },
  { name: "Nina Huber", role: "Übermittlung", rank: "Gfr", detachment: "Führung", status: "Bestätigt" },
  { name: "Jonas Moser", role: "Materialwart", rank: "Kpl", detachment: "Logistik", status: "Offen" },
  { name: "Elena Steiner", role: "Fahrerin", rank: "Sdt", detachment: "Transport", status: "Bestätigt" },
  { name: "Simon Baumann", role: "Sicherungsangehöriger", rank: "Sdt", detachment: "Sicherung", status: "Bestätigt" },
  { name: "Mia Wenger", role: "Sanitätsgruppenführerin", rank: "Sgt", detachment: "Sanität", status: "Bestätigt" },
  { name: "Noah Zimmermann", role: "Küchenchef", rank: "Four", detachment: "Logistik", status: "Offen" },
];

const tableBody = document.querySelector("#person-table-body");
const searchInput = document.querySelector("#person-search");
const clearButton = document.querySelector("#clear-search");
const emptyClearButton = document.querySelector("#empty-clear-search");
const resultCount = document.querySelector("#result-count");
const emptyState = document.querySelector("#empty-state");
const tableWrap = document.querySelector(".table-wrap");

function normalize(value) {
  return value
    .toLocaleLowerCase("de-CH")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function addCell(row, value, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  cell.textContent = value;
  row.append(cell);
}

function render(rows) {
  tableBody.replaceChildren();

  rows.forEach((person) => {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const personWrap = document.createElement("div");
    const avatar = document.createElement("span");
    const name = document.createElement("span");
    personWrap.className = "person-cell";
    avatar.className = "avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = initials(person.name);
    name.textContent = person.name;
    personWrap.append(avatar, name);
    nameCell.append(personWrap);
    row.append(nameCell);

    addCell(row, person.role);
    addCell(row, person.rank, "rank");
    addCell(row, person.detachment);

    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status ${person.status === "Bestätigt" ? "status-confirmed" : "status-open"}`;
    status.textContent = person.status;
    statusCell.append(status);
    row.append(statusCell);

    tableBody.append(row);
  });

  const countLabel = rows.length === 1 ? "1 Person" : `${rows.length} Personen`;
  resultCount.textContent = searchInput.value.trim() ? `${countLabel} gefunden` : countLabel;
  emptyState.hidden = rows.length !== 0;
  tableWrap.hidden = rows.length === 0;
}

function filterPeople() {
  const query = normalize(searchInput.value);
  const terms = query.split(/\s+/).filter(Boolean);

  const matches = people.filter((person) => {
    const searchable = normalize(`${person.name} ${person.role} ${person.rank}`);
    return terms.every((term) => searchable.includes(term));
  });

  clearButton.hidden = query.length === 0;
  render(matches);
  return matches;
}

function clearSearch() {
  searchInput.value = "";
  filterPeople();
  searchInput.focus();
}

searchInput.addEventListener("input", filterPeople);
clearButton.addEventListener("click", clearSearch);
emptyClearButton.addEventListener("click", clearSearch);

function registerModelTools() {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const lifecycle = new AbortController();
  const registration = context.registerTool(
    {
      name: "search_people",
      title: "Personen suchen",
      description: "Filtert die sichtbare Gesamtliste nach Name, Funktion oder Grad.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            maxLength: 120,
            description: "Ein oder mehrere Suchbegriffe für Name, Funktion oder Grad.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== "object" || typeof input.query !== "string") {
          throw new TypeError("query muss eine Zeichenfolge sein.");
        }

        const query = input.query.slice(0, 120);
        searchInput.value = query;
        const matches = filterPeople();
        return { query, resultCount: matches.length };
      },
    },
    { signal: lifecycle.signal },
  );

  Promise.resolve(registration).catch(() => lifecycle.abort());
  window.addEventListener("pagehide", () => lifecycle.abort(), { once: true });
}

registerModelTools();
render(people);
