import styles from './NodeEditor.module.css';
import ImageUpload from './ImageUpload';

export default function NodeEditor({ node, onChange, onDelete, onClose }) {
    const { type, data } = node;

    function set(key, value) {
        onChange({ [key]: value });
    }

    function setOption(i, value) {
        const opts = [...(data.options || [])];
        opts[i] = { ...opts[i], label: value };
        onChange({ options: opts });
    }

    function addOption() {
        onChange({ options: [...(data.options || []), { label: `Option ${(data.options?.length || 0) + 1}` }] });
    }

    function removeOption(i) {
        const opts = [...(data.options || [])];
        opts.splice(i, 1);
        onChange({ options: opts });
    }

    return (
        <div className={styles.panel}>
            <div className={styles.header}>
                <span className={styles.title}>Edit Node</span>
                <button className={styles.close} onClick={onClose}>✕</button>
            </div>

            <div className={styles.body}>
                {type === 'trigger' && (
                    <>
                        <Field label="Match Type">
                            <select className={styles.select} value={data.matchType || 'any'} onChange={e => set('matchType', e.target.value)}>
                                <option value="any">Any message</option>
                                <option value="keyword">Contains keyword</option>
                                <option value="exact">Exact match</option>
                                <option value="regex">Regex</option>
                            </select>
                        </Field>
                        {data.matchType !== 'any' && (
                            <Field label="Keyword / Pattern">
                                <input className={styles.input} value={data.keyword || ''} onChange={e => set('keyword', e.target.value)} placeholder="e.g. hello" />
                            </Field>
                        )}
                    </>
                )}

                {type === 'image' && (
                    <>
                        <Field label="Image / File">
                            <ImageUpload
                                value={data.filename}
                                previewUrl={data.previewUrl}
                                onChange={({ filename, previewUrl, originalName }) =>
                                    onChange({ filename, previewUrl, originalName })
                                }
                            />
                        </Field>
                        <Field label="Caption (optional)">
                            <textarea
                                className={styles.textarea}
                                rows={3}
                                value={data.caption || ''}
                                onChange={e => set('caption', e.target.value)}
                                placeholder="Add a caption... Use {{name}} for variables"
                            />
                        </Field>
                    </>
                )}

                {type === 'message' && (
                    <>
                        <Field label="Message Text">
                            <textarea
                                className={styles.textarea}
                                rows={6}
                                value={data.text || ''}
                                onChange={e => set('text', e.target.value)}
                                placeholder="Type your message... Use {{name}}, {{phone}} for collected data"
                            />
                            <p className={styles.hint}>Use {'{{fieldName}}'} to insert collected data</p>
                        </Field>
                        <Field label="Attach Image (optional)">
                            <ImageUpload
                                value={data.filename}
                                previewUrl={data.previewUrl}
                                onChange={({ filename, previewUrl }) => onChange({ filename, previewUrl })}
                            />
                            <p className={styles.hint}>If image attached, message text becomes the caption</p>
                        </Field>
                    </>
                )}

                {type === 'options' && (
                    <>
                        <Field label="Question">
                            <textarea className={styles.textarea} rows={3} value={data.question || ''} onChange={e => set('question', e.target.value)} placeholder="Please choose an option:" />
                        </Field>
                        <Field label="Input Type">
                            <select className={styles.select} value={data.inputType || 'text'} onChange={e => set('inputType', e.target.value)}>
                                <option value="text">Text (reply 1,2,3...)</option>
                                <option value="buttons">Buttons (max 3)</option>
                                <option value="list">List Menu (max 10)</option>
                            </select>
                        </Field>
                        {data.inputType === 'list' && (
                            <Field label="List Button Label">
                                <input className={styles.input} value={data.listButtonText || 'View Options'} onChange={e => set('listButtonText', e.target.value)} placeholder="View Options" />
                            </Field>
                        )}
                        <Field label="Save answer to field">
                            <input className={styles.input} value={data.saveField || ''} onChange={e => set('saveField', e.target.value)} placeholder="e.g. interest (optional)" />
                        </Field>
                        <Field label="Options">
                            {(data.options || []).map((opt, i) => (
                                <div key={i} className={styles.optionRow}>
                                    <span className={styles.optNum}>{i + 1}</span>
                                    <input className={styles.input} value={opt.label} onChange={e => setOption(i, e.target.value)} placeholder={`Option ${i + 1}`} />
                                    <button className={styles.removeBtn} onClick={() => removeOption(i)}>✕</button>
                                </div>
                            ))}
                            <button className={styles.addBtn} onClick={addOption}>+ Add Option</button>
                            {data.inputType === 'buttons' && (data.options || []).length > 3 && (
                                <p style={{ color: '#f87171', fontSize: 11, marginTop: 4 }}>⚠️ Max 3 buttons</p>
                            )}
                        </Field>
                    </>
                )}

                {type === 'collect' && (
                    <>
                        <Field label="Question to ask">
                            <textarea className={styles.textarea} rows={3} value={data.question || ''} onChange={e => set('question', e.target.value)} placeholder="What is your name?" />
                        </Field>
                        <Field label="Save answer as field">
                            <input className={styles.input} value={data.field || ''} onChange={e => set('field', e.target.value)} placeholder="e.g. name, phone, age, city" />
                            <p className={styles.hint}>This field name is used in conditions and message templates</p>
                        </Field>
                    </>
                )}

                {type === 'condition' && (
                    <>
                        <Field label="Field to check">
                            <input className={styles.input} value={data.field || ''} onChange={e => set('field', e.target.value)} placeholder="e.g. city" />
                        </Field>
                        <Field label="Operator">
                            <select className={styles.select} value={data.operator || 'equals'} onChange={e => set('operator', e.target.value)}>
                                <option value="equals">equals</option>
                                <option value="not_equals">not equals</option>
                                <option value="contains">contains</option>
                            </select>
                        </Field>
                        <Field label="Value">
                            <input className={styles.input} value={data.value || ''} onChange={e => set('value', e.target.value)} placeholder="e.g. Delhi" />
                        </Field>
                        <p className={styles.hint}>Connect the green handle for True, red for False</p>
                    </>
                )}

                {type === 'handover' && (
                    <>
                        <Field label="Notify this number (WhatsApp)">
                            <input className={styles.input} value={data.notifyNumber || ''} onChange={e => set('notifyNumber', e.target.value)} placeholder="919876543210" />
                            <p className={styles.hint}>Country code + number, no + or spaces</p>
                        </Field>
                        <Field label="Notification message">
                            <textarea className={styles.textarea} rows={4} value={data.notifyMessage || ''} onChange={e => set('notifyMessage', e.target.value)} placeholder="New lead: {{name}}, {{phone}}" />
                        </Field>
                        <Field label="Reply to user">
                            <textarea className={styles.textarea} rows={3} value={data.replyText || ''} onChange={e => set('replyText', e.target.value)} placeholder="Our team will reach out shortly!" />
                        </Field>
                    </>
                )}

                {type === 'save_data' && (
                    <p className={styles.hint} style={{ padding: '8px 0' }}>
                        This node saves all collected data to Firebase at this point in the flow. No configuration needed.
                    </p>
                )}

                {type === 'end' && (
                    <Field label="Final message (optional)">
                        <textarea className={styles.textarea} rows={4} value={data.text || ''} onChange={e => set('text', e.target.value)} placeholder="Thank you! Have a great day 😊" />
                    </Field>
                )}
            </div>

            <div className={styles.footer}>
                <button className={styles.deleteBtn} onClick={onDelete}>🗑 Delete Node</button>
            </div>
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {label}
            </label>
            {children}
        </div>
    );
}
