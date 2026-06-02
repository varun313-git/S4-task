const nameInput = document.getElementById("name");
const ageInput = document.getElementById("age");
const occupationInput = document.getElementById("occupation");
const saveButton = document.getElementById("saveButton");
const cancelEditButton = document.getElementById("cancelEditButton");
const entriesTableBody = document.querySelector("#entriesTable tbody");
const recordCount = document.getElementById("recordCount");
const messageBox = document.getElementById("messageBox");

let editId = null;

function formatCount(count) {
  return `${count} record${count === 1 ? "" : "s"}`;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function fetchEntries() {
  const response = await fetch("/api/entries");
  if (!response.ok) {
    throw new Error(`Server returned ${response.status}`);
  }
  const data = await parseJsonSafe(response);
  return data || [];
}

function showMessage(message, type = "success") {
  messageBox.textContent = message;
  messageBox.style.color = type === "error" ? "#fda4af" : "#4ade80";
}

function clearForm() {
  nameInput.value = "";
  ageInput.value = "";
  occupationInput.value = "";
  editId = null;
  saveButton.textContent = "Save";
  cancelEditButton.classList.add("hidden");
}

function populateForm(entry) {
  nameInput.value = entry.name;
  ageInput.value = entry.age;
  occupationInput.value = entry.occupation;
  editId = entry.id;
  saveButton.textContent = "Update";
  cancelEditButton.classList.remove("hidden");
}

function renderEntries(entries) {
  entriesTableBody.innerHTML = "";
  if (entries.length === 0) {
    entriesTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-row">No records yet. Add one above.</td>
      </tr>
    `;
  }

  entries.forEach((entry) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${entry.name}</td>
      <td>${entry.age}</td>
      <td>${entry.occupation}</td>
      <td>${entry.category}</td>
      <td>
        <button class="action-button edit" data-id="${entry.id}">Edit</button>
        <button class="action-button delete" data-id="${entry.id}">Delete</button>
      </td>
    `;
    entriesTableBody.appendChild(row);
  });
  recordCount.textContent = formatCount(entries.length);
}

async function loadEntries() {
  try {
    const entries = await fetchEntries();
    renderEntries(entries);
  } catch (error) {
    showMessage("Unable to load records.", "error");
  }
}

async function submitForm() {
  const name = nameInput.value.trim();
  const age = parseInt(ageInput.value, 10);
  const occupation = occupationInput.value.trim();

  if (!name || !age || !occupation) {
    showMessage("Please fill in all fields.", "error");
    return;
  }

  const payload = { name, age, occupation };
  const url = editId ? `/api/entries/${editId}` : "/api/entries";
  const method = editId ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error((result && result.error) || `Failed to save record (${response.status}).`);
    }

    const action = editId ? "updated" : "saved";
    showMessage(`Record ${action} successfully.`);
    clearForm();
    await loadEntries();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

async function deleteEntry(entryId) {
  try {
    const response = await fetch(`/api/entries/${entryId}`, { method: "DELETE" });
    const result = await parseJsonSafe(response);
    if (!response.ok) {
      throw new Error((result && result.error) || `Unable to delete record (${response.status}).`);
    }
    showMessage("Record deleted.");
    await loadEntries();
  } catch (error) {
    showMessage(error.message, "error");
  }
}

function handleTableClick(event) {
  const button = event.target.closest("button");
  if (!button) return;

  const entryId = Number(button.dataset.id);
  if (button.classList.contains("edit")) {
    fetchEntries().then((entries) => {
      const entry = entries.find((item) => item.id === entryId);
      if (entry) {
        populateForm(entry);
      }
    });
    return;
  }

  if (button.classList.contains("delete")) {
    deleteEntry(entryId);
  }
}

saveButton.addEventListener("click", submitForm);
cancelEditButton.addEventListener("click", () => {
  clearForm();
  showMessage("Edit canceled.");
});
entriesTableBody.addEventListener("click", handleTableClick);
window.addEventListener("load", loadEntries);
