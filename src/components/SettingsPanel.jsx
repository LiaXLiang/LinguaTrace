import { useState } from "react";

export default function SettingsPanel({
  customLabels,
  labelColors,
  setLabelColors,
  renameLabelEverywhere,
  deleteLabelEverywhere,
  agentPromptLabels,
  setAgentPromptLabels,
  setView,
  signOut,
}) {
  const [activeLabel, setActiveLabel] = useState(customLabels[0] || null);

  const [editingLabelName, setEditingLabelName] = useState(null);
  const [draftLabelName, setDraftLabelName] = useState("");

  const [editingPromptId, setEditingPromptId] = useState(null);
  const [draftPromptTitle, setDraftPromptTitle] = useState("");
  const [draftPromptText, setDraftPromptText] = useState("");

  const selectedLabel = customLabels.find((label) => label === activeLabel) || customLabels[0] || null;
  const selectedLabelColor = selectedLabel ? labelColors[selectedLabel] || "#64748b" : "#64748b";

  function updateLabelColor(label, color) {
    setLabelColors((prev) => ({
      ...prev,
      [label]: color,
    }));
  }

  function startEditLabelName(label) {
    setEditingLabelName(label);
    setDraftLabelName(label);
    setActiveLabel(label);
  }

  function cancelEditLabelName() {
    setEditingLabelName(null);
    setDraftLabelName("");
  }

  async function saveLabelName(oldLabel) {
    const cleanNewLabel = draftLabelName.trim();
    if (!cleanNewLabel) return;

    await renameLabelEverywhere(oldLabel, cleanNewLabel);
    setActiveLabel(cleanNewLabel);
    cancelEditLabelName();
  }

  function startEditAgentPromptLabel(item) {
    setEditingPromptId(item.id);
    setDraftPromptTitle(item.title);
    setDraftPromptText(item.prompt);
  }

  function cancelEditAgentPromptLabel() {
    setEditingPromptId(null);
    setDraftPromptTitle("");
    setDraftPromptText("");
  }

  function saveAgentPromptLabel(id) {
    setAgentPromptLabels((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              title: draftPromptTitle.trim() || "Untitled",
              prompt: draftPromptText.trim(),
            }
          : item
      )
    );

    cancelEditAgentPromptLabel();
  }

  function addAgentPromptLabel() {
    const newItem = {
      id: crypto.randomUUID(),
      title: "New action",
      prompt: "Write your prompt here.",
    };

    setAgentPromptLabels((prev) => [...prev, newItem]);
    startEditAgentPromptLabel(newItem);
  }

  function deleteAgentPromptLabel(id) {
    setAgentPromptLabels((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand" onClick={() => setView("reader")}>
          <span className="brand-mark">LT</span>
          <div>
            <h1>LinguaTrace</h1>
            <p>语迹 · Language Learning Notebook</p>
          </div>
        </div>

        <nav className="topnav" aria-label="Main navigation">
          <button type="button" className="nav-link active" onClick={() => setView("settings")}>
            Settings
          </button>

          <button className="nav-link" onClick={() => setView("reader")}>
            Reader
          </button>

          <button type="button" className="nav-link" onClick={() => setView("history")}>
            Note History
          </button>

          <button type="button" className="nav-link signout-link" onClick={signOut}>
            Sign Out
          </button>
        </nav>
      </header>

      <main className="settings-page compact-settings-page">
        <div className="settings-page-header compact-settings-header">
          <h2>Settings</h2>
        </div>

        <section className="settings-card compact-settings-card">
          <div className="settings-title-row">
            <h3>Label Colors</h3>
            <span className="settings-title-hint">
              Select a label, then modify its name or color.
            </span>
          </div>

          <div className="settings-label-manager">
            <div className="settings-label-cloud advanced-label-cloud">
              {customLabels.map((label) => {
                const color = labelColors[label] || "#64748b";

                return (
                  <button
                    key={label}
                    type="button"
                    className={
                      selectedLabel === label
                        ? "settings-label-pill active"
                        : "settings-label-pill"
                    }
                    style={{ "--label-color": color }}
                    onClick={() => {
                      setActiveLabel(label);
                      cancelEditLabelName();
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {selectedLabel && (
              <div className="label-editor-panel">
                <div className="label-editor-preview">
                  <span
                    className="settings-label-pill label-editor-big-pill"
                    style={{ "--label-color": selectedLabelColor }}
                  >
                    {editingLabelName === selectedLabel
                      ? draftLabelName || "Untitled"
                      : selectedLabel}
                  </span>
                </div>

                <div className="label-editor-fields">
                  <label className="label-editor-field">
                    <span>Name</span>

                    {editingLabelName === selectedLabel ? (
                      <input
                        className="settings-label-name-input"
                        value={draftLabelName}
                        onChange={(event) => setDraftLabelName(event.target.value)}
                        placeholder="Label name"
                      />
                    ) : (
                      <div className="label-editor-readonly-name">
                        {selectedLabel}
                      </div>
                    )}
                  </label>

                  <label className="label-editor-field">
                    <span>Color</span>

                    <input
                      className="label-editor-color-input"
                      type="color"
                      value={selectedLabelColor}
                      onChange={(event) =>
                        updateLabelColor(selectedLabel, event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="label-editor-actions">
                  {editingLabelName === selectedLabel ? (
                    <>
                      <button
                        type="button"
                        className="agent-prompt-save-button"
                        onClick={() => saveLabelName(selectedLabel)}
                      >
                        Save
                      </button>

                      <button
                        type="button"
                        className="agent-prompt-cancel-button"
                        onClick={cancelEditLabelName}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="agent-prompt-modify-button"
                        onClick={() => startEditLabelName(selectedLabel)}
                      >
                        Modify
                      </button>

                      {selectedLabel !== "Unlabeled" && (
                        <button
                          type="button"
                          className="agent-prompt-delete-button"
                          onClick={() => {
                            deleteLabelEverywhere(selectedLabel);
                            setActiveLabel("Unlabeled");
                            cancelEditLabelName();
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="settings-card compact-settings-card agent-prompt-settings-card">
          <div className="settings-title-row">
            <h3>AI Prompt Labels</h3>

            <button
              type="button"
              className="agent-prompt-add-button"
              onClick={addAgentPromptLabel}
            >
              + Add
            </button>
          </div>

          <div className="agent-prompt-list">
            {agentPromptLabels.map((item) => {
              const isEditing = editingPromptId === item.id;

              return (
                <div className="agent-prompt-item" key={item.id}>
                  <div className="agent-prompt-top-row">
                    {isEditing ? (
                      <input
                        className="agent-prompt-title-input"
                        value={draftPromptTitle}
                        onChange={(event) => setDraftPromptTitle(event.target.value)}
                        placeholder="Button name"
                      />
                    ) : (
                      <button type="button" className="cat-prompt-label preview-agent-label">
                        {item.title}
                      </button>
                    )}

                    <div className="agent-prompt-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="agent-prompt-save-button"
                            onClick={() => saveAgentPromptLabel(item.id)}
                          >
                            Save
                          </button>

                          <button
                            type="button"
                            className="agent-prompt-cancel-button"
                            onClick={cancelEditAgentPromptLabel}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="agent-prompt-modify-button"
                            onClick={() => startEditAgentPromptLabel(item)}
                          >
                            Modify
                          </button>

                          <button
                            type="button"
                            className="agent-prompt-delete-button"
                            onClick={() => deleteAgentPromptLabel(item.id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <textarea
                      className="agent-prompt-textarea"
                      value={draftPromptText}
                      onChange={(event) => setDraftPromptText(event.target.value)}
                      placeholder="Prompt sent to AI..."
                    />
                  ) : (
                    <div className="agent-prompt-preview-text">
                      {item.prompt}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}