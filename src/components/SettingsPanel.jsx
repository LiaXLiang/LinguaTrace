import { useState } from "react";

export default function SettingsPanel({
  customLabels,
  labelColors,
  setLabelColors,
  agentPromptLabels,
  setAgentPromptLabels,
  setView,
  signOut,
}) {
  const [activeLabel, setActiveLabel] = useState(null);

  const [editingPromptId, setEditingPromptId] = useState(null);
  const [draftPromptTitle, setDraftPromptTitle] = useState("");
  const [draftPromptText, setDraftPromptText] = useState("");

  function updateLabelColor(label, color) {
    setLabelColors((prev) => ({
      ...prev,
      [label]: color,
    }));
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

    setEditingPromptId(newItem.id);
    setDraftPromptTitle(newItem.title);
    setDraftPromptText(newItem.prompt);
  }

  function updateAgentPromptLabel(id, field, value) {
    setAgentPromptLabels((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function addAgentPromptLabel() {
    setAgentPromptLabels((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: "New action",
        prompt: "Write your prompt here.",
      },
    ]);
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
          <button
            type="button"
            className="nav-link active"
            onClick={() => setView("settings")}
          >
            Settings
          </button>

         <button className="nav-link" onClick={() => setView("reader")}>
             Reader
         </button>

          <button
            type="button"
            className="nav-link"
            onClick={() => setView("history")}
          >
            Note History
          </button>

          <button
            type="button"
            className="nav-link signout-link"
            onClick={signOut}
          >
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
              Click a label to change its color.
            </span>
          </div>


          <div className="settings-label-cloud">
            {customLabels.map((label) => {
              const color = labelColors[label] || "#64748b";

              return (
                <div className="settings-label-wrapper" key={label}>
                  <button
                    type="button"
                    className={
                      activeLabel === label
                        ? "settings-label-pill active"
                        : "settings-label-pill"
                    }
                    style={{ "--label-color": color }}
                    onClick={() => setActiveLabel(label)}
                  >
                    {label}
                  </button>

                  <input
                    className="label-native-color-input"
                    type="color"
                    value={color}
                    onChange={(event) =>
                      updateLabelColor(label, event.target.value)
                    }
                    onClick={() => setActiveLabel(label)}
                  />
                </div>
              );
            })}
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
                            onClick={() =>
                              setAgentPromptLabels((prev) =>
                                prev.filter((label) => label.id !== item.id)
                              )
                            }
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