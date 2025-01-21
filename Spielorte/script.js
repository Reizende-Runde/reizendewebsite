/************************************************************
 * GLOBALS & INITIAL SETUP
 ************************************************************/
const googleSheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRGFAymdV00LZFi09qBg6j5smzX07s9YWplUmwwkvu5h6sn3VdzzLMUg07t3kqh5TKHrgAjWDR_DkcK/pubhtml?gid=0&single=true";

// Default columns to display by name
const defaultColumns = [
  "Name",
  "Gegend",
  "Pro",
  "Kontra",
  "Bierpreis 0,4l",
  "Bierpreis 0,5l",
  "Bewertung (0-10)",
  "Raucherkneipe?"
];

// We'll store per-column filter data in this array
// Each element looks like:
// {
//   columnIndex: number,        // index in the original sheet
//   headerText: string,         // e.g. 'Name'
//   activeValues: Set<string>,  // all unique cell values in that column
//   checkedValues: Set<string>, // currently checked subset
//   popoverElement: HTMLElement
// }
let columnFilters = [];

// Leaflet map & markers
let map;
const markers = [];

/************************************************************
 * EVENT LISTENERS (on DOMContentLoaded, etc.)
 ************************************************************/
document.addEventListener("DOMContentLoaded", () => {
  // Initialize the map
  map = L.map("map").setView([52.52, 13.405], 12); // Berlin center
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  // Fetch sheet data
  fetchGoogleSheet();

  // Map popup buttons
  const showMapButton = document.getElementById("showMapButton");
  showMapButton.addEventListener("click", handleShowMap);

  const closeMapPopup = document.getElementById("closeMapPopup");
  closeMapPopup.addEventListener("click", () => {
    document.getElementById("mapPopup").style.display = "none";
  });
});


/************************************************************
 * FETCH & PARSE THE GOOGLE SHEET
 ************************************************************/
async function fetchGoogleSheet() {
  try {
    const response = await fetch(googleSheetUrl);
    const text = await response.text();

    // Parse the response to extract the table
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "text/html");
    const table = doc.querySelector("table");

    if (table) {
      populateCustomTable(table);
    } else {
      console.error("Failed to retrieve the table from the Google Sheet.");
    }
  } catch (err) {
    console.error("Error fetching Google Sheet:", err);
  }
}


/************************************************************
 * BUILD THE CUSTOM TABLE
 ************************************************************/
function populateCustomTable(sheetTable) {
  const tableHeaders = document.getElementById("tableHeaders");
  const tableBody = document.getElementById("tableBody");
  const columnSelector = document.getElementById("columnSelector");

  // Clear any existing content
  tableHeaders.innerHTML = "";
  tableBody.innerHTML = "";
  columnSelector.innerHTML = "";
  columnFilters = [];

  // Extract headers (the first row in the sheet table)
  const firstRowCells = sheetTable.querySelectorAll("tbody tr:first-child td");
  const nonEmptyColumns = [];
  let longitudeIndex = null;
  let latitudeIndex = null;
  let nameIndex = null;

  firstRowCells.forEach((headerCell, index) => {
    const headerText = headerCell.textContent.trim();
    if (!headerText) return; // skip empty

    // Track special columns
    if (headerText.toLowerCase() === "longitude") longitudeIndex = index;
    if (headerText.toLowerCase() === "latitude") latitudeIndex = index;
    if (headerText.toLowerCase() === "name") nameIndex = index;

    nonEmptyColumns.push({
      index,
      text: headerText
    });
  });

  // Create "Karte" TH first
  const mapHeader = document.createElement("th");
  mapHeader.textContent = "Karte";
  tableHeaders.appendChild(mapHeader);

  // For each data column from the sheet, create a TH with a filter icon
  nonEmptyColumns.forEach((colObj, visibleColIdx) => {
    const { index, text } = colObj;
    const th = document.createElement("th");

    // Column title
    const labelSpan = document.createElement("span");
    labelSpan.textContent = text;

    // Filter icon
    const filterIcon = document.createElement("span");
    filterIcon.classList.add("filter-icon");
    filterIcon.textContent = "▼";

    // Filter popover
    const popover = document.createElement("div");
    popover.classList.add("filter-popover");

    // Toggle popover on icon click
    filterIcon.addEventListener("click", (e) => {
        e.stopPropagation();
      
        const isAlreadyOpen = (popover.style.display === "block");
        closeAllPopovers(); // close everything
        if (!isAlreadyOpen) {
          popover.style.display = "block"; // open only if it wasn't open
        } 
      });

      
    // Close popover if clicking outside
    document.addEventListener("click", () => {
      popover.style.display = "none";
    });
    // Prevent popover from closing if clicked inside
    popover.addEventListener("click", (ev) => {
      ev.stopPropagation();
    });

    // Assemble TH
    th.appendChild(labelSpan);
    th.appendChild(filterIcon);
    th.appendChild(popover);
    tableHeaders.appendChild(th);

    // Create column selector checkbox
    const selectorLabel = document.createElement("label");
    selectorLabel.classList.add("checkbox-label");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = index; // the original sheet index
    checkbox.checked = defaultColumns.includes(text);

    const span = document.createElement("span");
    span.classList.add("checkbox-custom");
    span.textContent = text;

    selectorLabel.appendChild(checkbox);
    selectorLabel.appendChild(span);
    columnSelector.appendChild(selectorLabel);

    // Initialize column filter record
    columnFilters[visibleColIdx] = {
      columnIndex: index,
      headerText: text,
      activeValues: new Set(),
      checkedValues: new Set(), // will be filled after we read data
      popoverElement: popover
    };
  });

  // Build rows
  const dataRows = sheetTable.querySelectorAll("tbody tr:not(:first-child)");
  dataRows.forEach(rawRow => {
    const cells = rawRow.querySelectorAll("td");
    // Check if row is basically empty
    const hasValidData = Array.from(cells).some(cell => cell.textContent.trim() !== "");
    if (!hasValidData) return;

    const tr = document.createElement("tr");

    // Fill lat/lng/name
    const latitude = (latitudeIndex !== null) ? cells[latitudeIndex].textContent.trim() : "";
    const longitude = (longitudeIndex !== null) ? cells[longitudeIndex].textContent.trim() : "";
    const rowName = (nameIndex !== null) ? cells[nameIndex].textContent.trim() : "";

    tr.setAttribute("data-latitude", latitude);
    tr.setAttribute("data-longitude", longitude);
    tr.setAttribute("data-name", rowName);

    // Create the "Karte" cell
    const mapCell = document.createElement("td");
    if (longitude && latitude) {
      const mapLink = document.createElement("a");
      mapLink.href = `https://www.google.com/maps?q=${latitude},${longitude}`;
      mapLink.target = "_blank";
      mapLink.textContent = "Karte";
      mapLink.classList.add("map-button");
      mapCell.appendChild(mapLink);
    } else {
      mapCell.textContent = "N/A";
      mapCell.style.color = "#aaa";
    }
    tr.appendChild(mapCell);

    // Create data cells for each non-empty column
    nonEmptyColumns.forEach((colObj, visibleColIdx) => {
      const { index, text } = colObj;
      const cellText = cells[index].textContent.trim();

      const td = document.createElement("td");
      td.textContent = cellText;
      tr.appendChild(td);

      // Track distinct values for filtering
      columnFilters[visibleColIdx].activeValues.add(cellText);
    });

    tableBody.appendChild(tr);
  });

  // Build each column's popover (distinct values checkboxes)
  buildColumnFilterPopovers();

  // Listen for column checkbox changes
  columnSelector.addEventListener("change", updateTableColumns);
  // Initial column show/hide
  updateTableColumns();

  // Initialize the global search filter
  initializeGlobalFilter();

  // Make rows expandable
  addRowClickEvent();
}


/************************************************************
 * BUILD EACH COLUMN’S FILTER POPOVER
 ************************************************************/
function buildColumnFilterPopovers() {
  columnFilters.forEach((colFilter, visibleColIdx) => {
    const { activeValues, popoverElement } = colFilter;
    // Sort the distinct values
    const sortedValues = Array.from(activeValues).sort();
    popoverElement.innerHTML = "";

    // "Select All" & "Clear" Buttons
    const selectAllBtn = document.createElement("button");
    selectAllBtn.textContent = "Select All";
    selectAllBtn.addEventListener("click", () => {
      sortedValues.forEach(val => colFilter.checkedValues.add(val));

      popoverElement.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = true;
      });

      applyAllFilters();
    });

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear";
    clearBtn.addEventListener("click", () => {
      colFilter.checkedValues.clear();

      popoverElement.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = false;
      });

      applyAllFilters();
    });

    popoverElement.appendChild(selectAllBtn);
    popoverElement.appendChild(clearBtn);
    popoverElement.appendChild(document.createElement("hr"));

    // Initially, all values are checked
    colFilter.checkedValues = new Set(sortedValues);

    // Create a checkbox for each value
    sortedValues.forEach(value => {
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.classList.add("filter-checkbox");
      cb.checked = true;
      cb.value = value;

      cb.addEventListener("change", () => {
        if (cb.checked) {
          colFilter.checkedValues.add(value);
        } else {
          colFilter.checkedValues.delete(value);
        }
        applyAllFilters();
      });

      label.appendChild(cb);
      label.appendChild(document.createTextNode(value));
      popoverElement.appendChild(label);
    });
  });
}


/************************************************************
 * APPLY ALL FILTERS (GLOBAL + PER-COLUMN)
 ************************************************************/
function applyAllFilters() {
  const filterInput = document.getElementById("filterInput");
  const filterValue = filterInput.value.toLowerCase().trim();
  const rows = document.querySelectorAll("#dataTable tbody tr");
  const noResultsMessage = document.getElementById("noResultsMessage");

  let visibleRowCount = 0;

  rows.forEach(row => {
    // 1) Check the global text filter
    // We'll only check visible columns' text (excluding the map cell at index 0)
    const cells = row.querySelectorAll("td");
    let rowText = "";
    for (let i = 1; i < cells.length; i++) {
      if (cells[i].style.display !== "none") {
        rowText += cells[i].textContent.toLowerCase() + " ";
      }
    }
    const passGlobalFilter = (rowText.indexOf(filterValue) !== -1);

    // 2) Check each column’s distinct-value filter
    let passColumnFilters = true;
    columnFilters.forEach((colFilter, visibleColIdx) => {
      const cell = cells[visibleColIdx + 1]; 
      if (!cell) return;
      // If the cell’s value isn't in that column's 'checkedValues', row fails
      if (!colFilter.checkedValues.has(cell.textContent)) {
        passColumnFilters = false;
      }
    });

    // Final decision
    if (passGlobalFilter && passColumnFilters) {
      row.style.display = "";
      visibleRowCount++;
    } else {
      row.style.display = "none";
    }
  });
  columnFilters.forEach((colFilter) => {
    // If colFilter.checkedValues < colFilter.activeValues => means we are filtering
    const isFiltering = (colFilter.checkedValues.size < colFilter.activeValues.size);
    
    // The popover is inside the same TH that also has the icon
    // You can store a reference to the icon or find it
    const thIndex = columnFilters.indexOf(colFilter) + 1; // +1 because first TH is "Karte"
    const th = document.querySelector(`#tableHeaders th:nth-child(${thIndex+1})`);
    if (!th) return;
    
    const icon = th.querySelector(".filter-icon");
    if (!icon) return;
    
    if (isFiltering) {
      icon.classList.add("active-filter");
    } else {
      icon.classList.remove("active-filter");
    }
  });
  noResultsMessage.style.display = (visibleRowCount === 0) ? "block" : "none";
}


/************************************************************
 * HELPER: CLOSE ALL FILTER POPOVERS
 ************************************************************/
function closeAllPopovers() {
  columnFilters.forEach(cf => {
    cf.popoverElement.style.display = "none";
  });
}


/************************************************************
 * GLOBAL TEXT FILTER
 ************************************************************/
function initializeGlobalFilter() {
  const filterInput = document.getElementById("filterInput");
  filterInput.addEventListener("input", () => {
    applyAllFilters();
  });
}


/************************************************************
 * ROW EXPANSION (CLICK TO TOGGLE "expanded" CLASS)
 ************************************************************/
function addRowClickEvent() {
  const rows = document.querySelectorAll("#dataTable tbody tr");
  rows.forEach(row => {
    row.addEventListener("click", () => {
      row.classList.toggle("expanded");

      // Example: if content is long, use smaller font
      const cells = row.querySelectorAll("td");
      cells.forEach(cell => {
        if (cell.textContent.length > 20) {
          cell.classList.add("small-font");
        } else {
          cell.classList.remove("small-font");
        }
      });
    });
  });
}


/************************************************************
 * SHOW/HIDE COLUMNS ACCORDING TO CHECKBOXES
 ************************************************************/
function updateTableColumns() {
  const columnSelector = document.getElementById("columnSelector");
  // Collect the 'value' of all checked boxes
  const checkedIndices = Array.from(
    columnSelector.querySelectorAll("input:checked")
  ).map(input => parseInt(input.value));

  const ths = document.querySelectorAll("#tableHeaders th");
  const rows = document.querySelectorAll("#dataTable tbody tr");

  // The first TH is "Karte", always visible
  ths.forEach((th, thIndex) => {
    if (thIndex === 0) {
      th.style.display = "";
    } else {
      const colFilter = columnFilters[thIndex - 1];
      if (!colFilter) return;
      const sheetIndex = colFilter.columnIndex;
      th.style.display = checkedIndices.includes(sheetIndex) ? "" : "none";
    }
  });

  // For each row, the first TD is map cell
  rows.forEach(row => {
    const cells = row.children;
    for (let i = 1; i < cells.length; i++) {
      const colFilter = columnFilters[i - 1];
      if (!colFilter) continue;
      const sheetIndex = colFilter.columnIndex;
      cells[i].style.display = checkedIndices.includes(sheetIndex) ? "" : "none";
    }
  });

  // After toggling columns, re-apply filters
  applyAllFilters();
}


/************************************************************
 * SHOW MAP POPUP (MARKERS BASED ON VISIBLE ROWS)
 ************************************************************/
function handleShowMap() {
  const visibleRows = document.querySelectorAll("#dataTable tbody tr:not([style*='display: none'])");
  const bounds = L.latLngBounds();

  // Clear old markers
  markers.forEach(marker => map.removeLayer(marker));
  markers.length = 0;

  visibleRows.forEach(row => {
    const longitude = row.getAttribute("data-longitude");
    const latitude = row.getAttribute("data-latitude");
    const name = row.getAttribute("data-name");

    if (longitude && latitude) {
      const marker = L.marker([latitude, longitude])
                      .addTo(map)
                      .bindPopup(name);
      markers.push(marker);
      bounds.extend(marker.getLatLng());
    }
  });

  if (markers.length > 0) {
    map.fitBounds(bounds, { padding: [20, 20] });
  }

  // Show the map popup
  const mapPopup = document.getElementById("mapPopup");
  mapPopup.style.display = "block";
}
